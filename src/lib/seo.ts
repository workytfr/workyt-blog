import type { Metadata } from "next";
import { SITE, absoluteUrl, pageTitle } from "./site";
import type { AuthorView, CategoryView, PostView } from "./content";
import { citationJsonLd, moduleJsonLd } from "./modules/jsonld";

/**
 * Métadonnées et données structurées, au plus près de ce que Rank Math
 * produisait : titre « %title% - Workyt », description = extrait (ou
 * description SEO), schéma `Article`, fil d'Ariane, éditeur Workyt.
 */

export function postMetadata(post: PostView): Metadata {
    const title = pageTitle(post.seo.title || post.title);
    const description = post.seo.description || post.excerpt;
    const url = post.seo.canonical || absoluteUrl(`/${post.slug}/`);
    const image = post.featuredImage;
    return {
        title: { absolute: title },
        description,
        alternates: { canonical: url },
        robots: { index: !post.seo.noindex, follow: !post.seo.nofollow, "max-image-preview": "large" },
        openGraph: {
            type: "article",
            url,
            title,
            description,
            siteName: SITE.name,
            locale: SITE.locale,
            publishedTime: post.publishedAt,
            modifiedTime: post.modifiedAt,
            authors: post.authors.map((a) => absoluteUrl(`/author/${a.slug}/`)),
            section: post.primaryCategory?.name,
            tags: post.tags.map((t) => t.name),
            images: image ? [{ url: image.url, width: image.width, height: image.height, alt: image.alt }] : undefined,
        },
        twitter: { card: "summary_large_image", title, description, images: image ? [image.url] : undefined },
    };
}

export function archiveMetadata(opts: { title: string; description?: string; path: string; page?: number; noindex?: boolean }): Metadata {
    const paged = opts.page && opts.page > 1 ? ` ${SITE.titleSeparator} Page ${opts.page}` : "";
    const path = opts.page && opts.page > 1 ? `${opts.path}page/${opts.page}/` : opts.path;
    return {
        title: { absolute: pageTitle(`${opts.title}${paged}`) },
        description: opts.description,
        alternates: { canonical: absoluteUrl(path) },
        robots: opts.noindex ? { index: false, follow: true } : undefined,
        openGraph: { type: "website", url: absoluteUrl(path), title: pageTitle(opts.title), description: opts.description, siteName: SITE.name, locale: SITE.locale },
    };
}

/* ─── JSON-LD ─── */

const ORGANIZATION = {
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.workytUrl,
    logo: { "@type": "ImageObject", url: `${SITE.url}/logo-workyt.png` },
};

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
    return {
        "@type": "BreadcrumbList",
        itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
    };
}

/** Commentaire repris dans le balisage (§ 11) */
export type JsonLdComment = { name: string; text: string; createdAt: string; status: string; parentId: string | null };

export function postJsonLd(post: PostView, comments: JsonLdComment[] = []) {
    const published = comments.filter((c) => c.status === "published");
    const url = absoluteUrl(`/${post.slug}/`);
    // Modules : Recipe, Product + Review, Review + Book… ; sources en « citation » de l'Article
    const modCtx = {
        abs: absoluteUrl,
        authors: post.authors.map((a) => ({ name: a.name, url: absoluteUrl(`/author/${a.slug}/`) })),
        datePublished: post.publishedAt,
        guestUrl: (memberId: string) => (post.guests[memberId] ? absoluteUrl(`/author/${post.guests[memberId].slug}/`) : undefined),
    };
    const moduleNodes = post.modules.map((m) => moduleJsonLd(m, modCtx)).filter((n): n is Record<string, unknown> => n !== null);
    const citations = citationJsonLd(post.modules.flatMap((m) => (m.type === "sources" ? m.data.items : [])));
    const crumbs: { name: string; path: string }[] = [{ name: SITE.name, path: "/" }];
    if (post.primaryCategory) crumbs.push({ name: post.primaryCategory.name, path: `/category/${post.primaryCategory.slug}/` });
    crumbs.push({ name: post.title, path: `/${post.slug}/` });
    const img = post.featuredImage;
    return {
        "@context": "https://schema.org",
        "@graph": [
            ORGANIZATION,
            {
                "@type": "WebSite",
                "@id": `${SITE.url}/#website`,
                url: SITE.url,
                name: SITE.name,
                publisher: { "@id": `${SITE.url}/#organization` },
                inLanguage: "fr-FR",
                potentialAction: { "@type": "SearchAction", target: `${SITE.url}/?s={search_term_string}`, "query-input": "required name=search_term_string" },
            },
            breadcrumbJsonLd(crumbs),
            {
                "@type": "Article",
                "@id": `${url}#article`,
                headline: post.seo.title || post.title,
                description: post.seo.description || post.excerpt,
                datePublished: post.publishedAt,
                dateModified: post.modifiedAt,
                mainEntityOfPage: url,
                articleSection: post.primaryCategory?.name,
                keywords: post.tags.map((t) => t.name).join(", ") || undefined,
                inLanguage: "fr-FR",
                author: post.authors.map((a) => ({ "@type": "Person", name: a.name, url: absoluteUrl(`/author/${a.slug}/`) })),
                contributor: post.contributors.length ? post.contributors.map((a) => ({ "@type": "Person", name: a.name, url: absoluteUrl(`/author/${a.slug}/`) })) : undefined,
                citation: citations.length ? citations : undefined,
                commentCount: published.length,
                comment: published.length
                    ? published.slice(0, 30).map((c) => ({ "@type": "Comment", text: c.text, dateCreated: c.createdAt, author: { "@type": "Person", name: c.name } }))
                    : undefined,
                publisher: { "@id": `${SITE.url}/#organization` },
                image: img
                    ? {
                          "@type": "ImageObject",
                          url: img.url,
                          width: img.width,
                          height: img.height,
                          caption: img.alt || undefined,
                          creditText: [img.credit.author, img.credit.source].filter(Boolean).join(" / ") || undefined,
                          license: img.credit.sourceUrl || undefined,
                      }
                    : undefined,
            },
            ...moduleNodes,
        ],
    };
}

export function authorJsonLd(author: AuthorView) {
    return { "@context": "https://schema.org", "@type": "ProfilePage", mainEntity: { "@type": "Person", name: author.name, description: author.bio || undefined, url: absoluteUrl(`/author/${author.slug}/`) } };
}

export function categoryJsonLd(cat: CategoryView) {
    return { "@context": "https://schema.org", "@graph": [breadcrumbJsonLd([{ name: SITE.name, path: "/" }, { name: cat.name, path: `/category/${cat.slug}/` }])] };
}

/** Sérialise un JSON-LD sans risque d'injection (« </script> ») */
export function jsonLdString(data: unknown): string {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}
