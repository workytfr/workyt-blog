import "server-only";
import mongoose from "mongoose";
import type { JSONContent } from "@tiptap/core";
import { connectDB } from "../db";
import { normalize, analyzeSeo, type SeoReport } from "./analyze";
import type { ArticleModule } from "../modules/types";
import Post from "@/models/Post";
import AffiliateLink from "@/models/AffiliateLink";

/** Assistant SEO côté serveur : vérifications qui demandent la base, et note enregistrée */

/** Un autre article (non jeté) vise-t-il déjà ce mot-clé principal ? */
export async function keywordOwner(keyword: string, excludeId?: string): Promise<{ id: string; title: string } | null> {
    await connectDB();
    const k = normalize(keyword);
    if (!k) return null;
    const candidates = await Post.find({
        status: { $ne: "trash" },
        "seo.focusKeywords.0": { $exists: true },
        ...(excludeId && mongoose.isValidObjectId(excludeId) ? { _id: { $ne: excludeId } } : {}),
    })
        .select("title seo.focusKeywords")
        .lean();
    const hit = candidates.find((p) => normalize(p.seo?.focusKeywords?.[0] ?? "") === k);
    return hit ? { id: String(hit._id), title: hit.title } : null;
}

/** Liens affiliés cassés (vérification de nuit), au format des liens de l'article */
export async function deadAffiliateHrefs(): Promise<string[]> {
    await connectDB();
    return (await AffiliateLink.find({ health: "dead" }).select("name").lean()).map((l) => `/go/${l.name}/`);
}

type PostLike = {
    _id: unknown;
    title: string;
    slug: string;
    excerpt?: string | null;
    contentJson?: unknown;
    featuredImage?: { alt?: string | null } | null;
    modules?: unknown;
    seo?: { title?: string | null; description?: string | null; focusKeywords?: string[] | null } | null;
};

export async function seoReportFor(post: PostLike): Promise<SeoReport> {
    const keywords = post.seo?.focusKeywords ?? [];
    const [owner, deadLinks] = await Promise.all([keywords[0] ? keywordOwner(keywords[0], String(post._id)) : null, deadAffiliateHrefs()]);
    return analyzeSeo({
        title: post.title,
        seoTitle: post.seo?.title ?? "",
        seoDescription: post.seo?.description ?? "",
        excerpt: post.excerpt ?? "",
        slug: post.slug,
        keywords,
        doc: (post.contentJson as JSONContent) ?? null,
        featuredImage: post.featuredImage ? { alt: post.featuredImage.alt ?? "" } : null,
        modules: (post.modules ?? []) as ArticleModule[],
        keywordTaken: keywords[0] ? !!owner : null,
        deadLinks,
    });
}

/**
 * Suggestions de liens internes : articles publiés proches (mots-clés, titre),
 * les contenus piliers d'abord, avec leur mot-clé comme texte du lien.
 */
export async function linkSuggestions(postId: string) {
    await connectDB();
    if (!mongoose.isValidObjectId(postId)) return [];
    const post = await Post.findById(postId).select("title seo.focusKeywords categories contentHtml").lean();
    if (!post) return [];
    const terms = [...(post.seo?.focusKeywords ?? []), post.title].join(" ").trim();
    const already = new Set([...String(post.contentHtml ?? "").matchAll(/href="\/([^"/]+)\/"/g)].map((m) => m[1]));
    const base = { status: "published", publishedAt: { $lte: new Date() }, _id: { $ne: post._id } };
    const [byText, pillars] = await Promise.all([
        terms
            ? Post.find({ ...base, $text: { $search: terms } }, { score: { $meta: "textScore" } })
                  .select("title slug seo.focusKeywords isPillar")
                  .sort({ score: { $meta: "textScore" } })
                  .limit(8)
                  .lean()
            : Promise.resolve([]),
        Post.find({ ...base, isPillar: true, categories: { $in: post.categories ?? [] } })
            .select("title slug seo.focusKeywords isPillar")
            .limit(4)
            .lean(),
    ]);
    const seen = new Set<string>();
    return [...pillars, ...byText]
        .filter((p) => !already.has(p.slug) && !seen.has(p.slug) && seen.add(p.slug))
        .slice(0, 8)
        .map((p) => ({ title: p.title, href: `/${p.slug}/`, anchor: (p.isPillar && p.seo?.focusKeywords?.[0]) || p.title, pillar: !!p.isPillar }));
}
