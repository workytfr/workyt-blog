import "server-only";
import type { Types } from "mongoose";
import { connectDB } from "./db";
import { SITE, absoluteUrl } from "./site";
import Post from "@/models/Post";
import Category from "@/models/Category";
import Author from "@/models/Author";

/**
 * Sitemaps aux mêmes adresses que Rank Math (index relevé le 2 octobre 2026) :
 * post-sitemap.xml, category-sitemap.xml, author-sitemap.xml ; 1 000 liens
 * par fichier (post-sitemap2.xml au-delà) ; images incluses, image à la une
 * comprise. Pas de sitemap des étiquettes ni des pages, comme aujourd'hui.
 */
export type SitemapType = "post" | "category" | "author";
export const SITEMAP_TYPES: SitemapType[] = ["post", "category", "author"];

const PUBLISHED = () => ({ status: "published", publishedAt: { $lte: new Date() } });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Entry {
    loc: string;
    lastmod?: Date;
    images?: string[];
}

/** Images d'un contenu HTML (balises <img src>) */
function contentImages(html: string): string[] {
    return [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]).filter((u) => /^https?:\/\//.test(u));
}

async function postEntries(): Promise<Entry[]> {
    const posts = await Post.find(PUBLISHED()).select("slug modifiedAt publishedAt featuredImage contentHtml seo.noindex").sort({ publishedAt: -1 }).lean();
    return posts
        .filter((p) => !p.seo?.noindex)
        .map((p) => ({
            loc: absoluteUrl(`/${p.slug}/`),
            lastmod: p.modifiedAt || p.publishedAt || undefined,
            images: [...new Set([p.featuredImage?.url, ...contentImages(p.contentHtml || "")].filter(Boolean) as string[])],
        }));
}

/** Rubriques et auteurs : seulement ceux qui ont des articles publiés ; lastmod = dernier article */
async function lastPostBy(field: "categories" | "authors"): Promise<Map<string, Date>> {
    const rows = await Post.aggregate<{ _id: Types.ObjectId; last: Date }>([
        { $match: PUBLISHED() },
        { $unwind: `$${field}` },
        { $group: { _id: `$${field}`, last: { $max: { $ifNull: ["$modifiedAt", "$publishedAt"] } } } },
    ]);
    return new Map(rows.map((r) => [String(r._id), r.last]));
}

async function categoryEntries(): Promise<Entry[]> {
    const [cats, last] = await Promise.all([Category.find({ "seo.noindex": { $ne: true } }).select("slug").lean(), lastPostBy("categories")]);
    return cats.filter((c) => last.has(String(c._id))).map((c) => ({ loc: absoluteUrl(`/category/${c.slug}/`), lastmod: last.get(String(c._id)) }));
}

async function authorEntries(): Promise<Entry[]> {
    const [authors, last] = await Promise.all([Author.find({}).select("slug").lean(), lastPostBy("authors")]);
    return authors.filter((a) => last.has(String(a._id))).map((a) => ({ loc: absoluteUrl(`/author/${a.slug}/`), lastmod: last.get(String(a._id)) }));
}

async function entries(type: SitemapType): Promise<Entry[]> {
    await connectDB();
    if (type === "post") return postEntries();
    if (type === "category") return categoryEntries();
    return authorEntries();
}

/** Un fichier de sitemap (page 1 = post-sitemap.xml, page 2 = post-sitemap2.xml…) ; null si la page n'existe pas */
export async function sitemapXml(type: SitemapType, page: number): Promise<string | null> {
    const all = await entries(type);
    const size = SITE.sitemapPageSize;
    const slice = all.slice((page - 1) * size, page * size);
    if (page > 1 && slice.length === 0) return null;
    const urls = slice
        .map(
            (e) => `
  <url>
    <loc>${esc(e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${new Date(e.lastmod).toISOString()}</lastmod>` : ""}${(e.images || [])
        .map((img) => `\n    <image:image><image:loc>${esc(img)}</image:loc></image:image>`)
        .join("")}
  </url>`
        )
        .join("");
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls}
</urlset>`;
}

export function sitemapFileName(type: SitemapType, page: number): string {
    return `${type}-sitemap${page > 1 ? page : ""}.xml`;
}

/** Index : un fichier par tranche de 1 000 liens, pour chaque type qui a du contenu */
export async function sitemapIndexXml(): Promise<string> {
    const parts: { loc: string; lastmod?: Date }[] = [];
    for (const type of SITEMAP_TYPES) {
        const all = await entries(type);
        if (!all.length) continue;
        const pages = Math.ceil(all.length / SITE.sitemapPageSize);
        for (let page = 1; page <= pages; page++) {
            const slice = all.slice((page - 1) * SITE.sitemapPageSize, page * SITE.sitemapPageSize);
            const lastmod = slice.reduce<Date | undefined>((m, e) => (e.lastmod && (!m || e.lastmod > m) ? e.lastmod : m), undefined);
            parts.push({ loc: `${SITE.url}/${sitemapFileName(type, page)}`, lastmod });
        }
    }
    const items = parts
        .map((p) => `\n  <sitemap>\n    <loc>${esc(p.loc)}</loc>${p.lastmod ? `\n    <lastmod>${new Date(p.lastmod).toISOString()}</lastmod>` : ""}\n  </sitemap>`)
        .join("");
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}
</sitemapindex>`;
}
