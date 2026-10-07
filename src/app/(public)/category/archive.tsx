import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { childCategoryIds, getCategoryBySlug, listPosts } from "@/lib/content";
import { archiveMetadata, categoryJsonLd, jsonLdString } from "@/lib/seo";
import Archive from "@/components/Archive";

/** Rubrique : /category/<slug>/ et /category/<slug>/page/<n>/ (articles des sous-rubriques compris) */
export async function categoryMetadata(slug: string, page: number): Promise<Metadata> {
    const cat = await getCategoryBySlug(decodeURIComponent(slug));
    if (!cat) return { title: "Rubrique introuvable", robots: { index: false } };
    return archiveMetadata({
        title: cat.seo.title || cat.name,
        description: cat.seo.description || cat.description || `Tous les articles de la rubrique ${cat.name} du blog Workyt.`,
        path: `/category/${cat.slug}/`,
        page,
        card: { title: cat.name, kicker: "Rubrique" },
        noindex: cat.seo.noindex,
    });
}

export default async function CategoryArchive({ slug, page }: { slug: string; page: number }) {
    const cat = await getCategoryBySlug(decodeURIComponent(slug));
    if (!cat) notFound();
    const ids = [cat.id, ...(await childCategoryIds(cat.id))];
    const list = await listPosts({ page, categoryIds: ids });
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(categoryJsonLd(cat)) }} />
            <Archive eyebrow="Rubrique" title={cat.name} description={cat.description} list={list} base={`/category/${cat.slug}/`} />
        </>
    );
}
