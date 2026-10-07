import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTagBySlug, listPosts } from "@/lib/content";
import { archiveMetadata } from "@/lib/seo";
import Archive from "@/components/Archive";

/** Étiquette : /tag/<slug>/ (hors sitemap, comme avec Rank Math) */
export async function tagMetadata(slug: string, page: number): Promise<Metadata> {
    const tag = await getTagBySlug(decodeURIComponent(slug));
    if (!tag) return { title: "Étiquette introuvable", robots: { index: false } };
    return archiveMetadata({
        title: tag.name,
        description: tag.description || `Les articles du blog Workyt sur le thème « ${tag.name} ».`,
        path: `/tag/${tag.slug}/`,
        page,
        card: { title: `#${tag.name}`, kicker: "Étiquette" },
    });
}

export default async function TagArchive({ slug, page }: { slug: string; page: number }) {
    const tag = await getTagBySlug(decodeURIComponent(slug));
    if (!tag) notFound();
    const list = await listPosts({ page, tag: tag.id });
    return <Archive eyebrow="Étiquette" title={`#${tag.name}`} description={tag.description} list={list} base={`/tag/${tag.slug}/`} />;
}
