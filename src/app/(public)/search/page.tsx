import type { Metadata } from "next";
import { listPosts } from "@/lib/content";
import { SITE } from "@/lib/site";
import Archive from "@/components/Archive";

/**
 * Résultats de recherche. Le visiteur reste sur l'adresse WordPress
 * « /?s=mot » (ou « /page/2/?s=mot ») : le proxy la réécrit vers cette page,
 * pour que l'accueil, lui, reste en cache.
 */
type Props = { searchParams: Promise<{ s?: string; paged?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
    const { s } = await searchParams;
    return { title: { absolute: `Recherche : ${s?.trim() || ""} ${SITE.titleSeparator} ${SITE.name}` }, robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: Props) {
    const { s, paged } = await searchParams;
    const query = s?.trim() || "";
    const page = Math.max(1, Number(paged) || 1);
    const list = query ? await listPosts({ page, search: query }) : { items: [], total: 0, page: 1, pages: 1 };
    return <Archive eyebrow="Recherche" title={query ? `« ${query} »` : "Rechercher"} list={list} base="/" query={`?s=${encodeURIComponent(query)}`} />;
}
