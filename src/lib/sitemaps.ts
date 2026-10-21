import "server-only";
import type { Types } from "mongoose";
import { connectDB } from "./db";
import { memoized } from "./content";
import { SITE, absoluteUrl } from "./site";
import Post from "@/models/Post";
import Category from "@/models/Category";
import Author from "@/models/Author";

/**
 * Sitemaps aux mêmes adresses que Rank Math (index relevé le 2 octobre 2026) :
 * post-sitemap.xml, category-sitemap.xml, author-sitemap.xml ; 1 000 liens
 * par fichier (post-sitemap2.xml au-delà) ; images incluses, image à la une
 * comprise. Pas de sitemap des étiquettes ni des pages, comme aujourd'hui.
 * Listes et fichiers gardés 5 min en mémoire (routes générées à la demande).
 */
export type SitemapType = "post" | "category" | "author";
export const SITEMAP_TYPES: SitemapType[] = ["post", "category", "author"];

const TTL_MS = 5 * 60_000;
const PUBLISHED = () => ({ status: "published", publishedAt: { $lte: new Date() } });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Entry {
    loc: string;
    lastmod?: Date;
    /** Article : son identifiant, pour aller chercher les images de son contenu */
    postId?: Types.ObjectId;
    images?: string[];
}

/** Adresse comparable : décodée, sans « / » final */
function sameUrl(a: string, b: string): boolean {
    const norm = (u: string) => {
        try {
            u = decodeURI(u);
        } catch {
            /* adresse mal encodée : gardée telle quelle */
        }
        return u.trim().replace(/\/+$/, "").toLowerCase();
    };
    return norm(a) === norm(b);
}

/** Articles indexables (sans noindex, sans canonique vers une autre adresse) : sans le contenu, trop lourd */
async function postEntries(): Promise<Entry[]> {
    const posts = await Post.find({ ...PUBLISHED(), "seo.noindex": { $ne: true } })
        .select("slug modifiedAt publishedAt featuredImage.url seo.canonical")
        .sort({ publishedAt: -1 })
        .lean();
    return posts.flatMap((p) => {
        const loc = absoluteUrl(`/${p.slug}/`);
        const canonical = p.seo?.canonical?.trim();
        if (canonical && !sameUrl(canonical.startsWith("/") ? absoluteUrl(canonical) : canonical, loc)) return [];
        return [{ loc, lastmod: p.modifiedAt || p.publishedAt || undefined, postId: p._id, images: p.featuredImage?.url ? [p.featuredImage.url] : [] }];
    });
}

/** Images du contenu (balises <img src>) de quelques articles, extraites par la base : le HTML ne voyage pas */
async function contentImages(ids: Types.ObjectId[]): Promise<Map<string, string[]>> {
    if (!ids.length) return new Map();
    const rows = await Post.aggregate<{ _id: Types.ObjectId; imgs: { captures: (string | null)[] }[] }>([
        { $match: { _id: { $in: ids } } },
        { $project: { imgs: { $regexFindAll: { input: { $ifNull: ["$contentHtml", ""] }, regex: `<img[^>]+src=["']([^"']+)["']`, options: "i" } } } },
    ]);
    return new Map(rows.map((r) => [String(r._id), r.imgs.map((m) => m.captures[0]).filter((u): u is string => !!u && /^https?:\/\//.test(u))]));
}

/** Date du dernier article publié par rubrique ou par auteur (auteurs et contributeurs) */
async function lastPostBy(ids: unknown): Promise<Map<string, Date>> {
    const rows = await Post.aggregate<{ _id: Types.ObjectId; last: Date }>([
        { $match: PUBLISHED() },
        { $project: { who: ids, at: { $ifNull: ["$modifiedAt", "$publishedAt"] } } },
        { $unwind: "$who" },
        { $group: { _id: "$who", last: { $max: "$at" } } },
    ]);
    return new Map(rows.map((r) => [String(r._id), r.last]));
}

const latest = (dates: (Date | undefined)[]) => dates.reduce<Date | undefined>((m, d) => (d && (!m || d > m) ? d : m), undefined);

/** Rubriques qui ont des articles publiés, les leurs ou ceux de leurs sous-rubriques ; lastmod = dernier article */
async function categoryEntries(): Promise<Entry[]> {
    const [cats, last] = await Promise.all([Category.find({}).select("slug parent seo.noindex").lean(), lastPostBy("$categories")]);
    return cats.flatMap((c) => {
        if (c.seo?.noindex) return [];
        const lastmod = latest([last.get(String(c._id)), ...cats.filter((k) => k.parent && String(k.parent) === String(c._id)).map((k) => last.get(String(k._id)))]);
        return lastmod ? [{ loc: absoluteUrl(`/category/${c.slug}/`), lastmod }] : [];
    });
}

/** Auteurs qui signent un article publié, ou un coup de cœur (contributeurs), comme la page auteur */
async function authorEntries(): Promise<Entry[]> {
    const [authors, last] = await Promise.all([
        Author.find({}).select("slug").lean(),
        lastPostBy({ $setUnion: [{ $ifNull: ["$authors", []] }, { $ifNull: ["$contributors", []] }] }),
    ]);
    return authors.filter((a) => last.has(String(a._id))).map((a) => ({ loc: absoluteUrl(`/author/${a.slug}/`), lastmod: last.get(String(a._id)) }));
}

function entries(type: SitemapType): Promise<Entry[]> {
    return memoized(`sitemap:${type}`, TTL_MS, async () => {
        await connectDB();
        if (type === "post") return postEntries();
        if (type === "category") return categoryEntries();
        return authorEntries();
    });
}

/** Un fichier de sitemap (page 1 = post-sitemap.xml, page 2 = post-sitemap2.xml…) ; null si la page n'existe pas */
export async function sitemapXml(type: SitemapType, page: number): Promise<string | null> {
    const all = await entries(type);
    const size = SITE.sitemapPageSize;
    if (page > 1 && (page - 1) * size >= all.length) return null;
    // Pages existantes seulement : le cache ne grossit pas avec des numéros inventés
    return memoized(`sitemap:${type}:${page}`, TTL_MS, async () => {
        const slice = all.slice((page - 1) * size, page * size);
        const images = type === "post" ? await contentImages(slice.flatMap((e) => (e.postId ? [e.postId] : []))) : new Map<string, string[]>();
        const urls = slice
            .map((e) => {
                const imgs = [...new Set([...(e.images || []), ...(e.postId ? images.get(String(e.postId)) || [] : [])])];
                return `
  <url>
    <loc>${esc(e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${new Date(e.lastmod).toISOString()}</lastmod>` : ""}${imgs
        .map((img) => `\n    <image:image><image:loc>${esc(img)}</image:loc></image:image>`)
        .join("")}
  </url>`;
            })
            .join("");
        return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls}
</urlset>`;
    });
}

export function sitemapFileName(type: SitemapType, page: number): string {
    return `${type}-sitemap${page > 1 ? page : ""}.xml`;
}

/** Index : un fichier par tranche de 1 000 liens, pour chaque type qui a du contenu (listes légères, sans images) */
export async function sitemapIndexXml(): Promise<string> {
    const parts: { loc: string; lastmod?: Date }[] = [];
    for (const type of SITEMAP_TYPES) {
        const all = await entries(type);
        if (!all.length) continue;
        const pages = Math.ceil(all.length / SITE.sitemapPageSize);
        for (let page = 1; page <= pages; page++) {
            const slice = all.slice((page - 1) * SITE.sitemapPageSize, page * SITE.sitemapPageSize);
            parts.push({ loc: `${SITE.url}/${sitemapFileName(type, page)}`, lastmod: latest(slice.map((e) => e.lastmod)) });
        }
    }
    const items = parts
        .map((p) => `\n  <sitemap>\n    <loc>${esc(p.loc)}</loc>${p.lastmod ? `\n    <lastmod>${new Date(p.lastmod).toISOString()}</lastmod>` : ""}\n  </sitemap>`)
        .join("");
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}
</sitemapindex>`;
}
