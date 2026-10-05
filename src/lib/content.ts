import "server-only";
import { cache } from "react";
import { Types } from "mongoose";
import { connectDB } from "./db";
import { SITE } from "./site";
import { avatarSrc } from "./avatar";
import { hostOf } from "./linkIcon";
import AffiliateLink from "@/models/AffiliateLink";
import type { ArticleModule } from "./modules/types";
import Post from "@/models/Post";
import Category from "@/models/Category";
import Tag from "@/models/Tag";
import Author from "@/models/Author";

/* ─── Formes envoyées aux pages (sérialisables) ─── */

export interface ImageView {
    url: string;
    width?: number;
    height?: number;
    alt: string;
    credit: { author: string; source: string; license: string; sourceUrl: string };
}
export interface CategoryView {
    id: string;
    slug: string;
    name: string;
    color: string;
    description: string;
    parentId: string | null;
}
export interface TagView {
    id: string;
    slug: string;
    name: string;
}
export interface AuthorView {
    id: string;
    slug: string;
    name: string;
    title: string;
    bio: string;
    /** Toujours renseigné : photo, ou Blobatar comme sur workyt.fr */
    avatarUrl: string;
}
export interface PostCardView {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    publishedAt: string;
    modifiedAt: string;
    readingMinutes: number;
    views: number;
    commentCount: number;
    featuredImage: ImageView | null;
    primaryCategory: CategoryView | null;
    categories: CategoryView[];
    authors: AuthorView[];
}
export interface PostView extends PostCardView {
    contentHtml: string;
    modules: ArticleModule[];
    /** Rédacteurs invités (coup de cœur externe validé) */
    contributors: AuthorView[];
    /** Profil d'auteur des invités des coups de cœur, par identifiant de membre */
    guests: Record<string, AuthorView>;
    /** Liens affiliés de l'article : /go/<nom>/ → domaine du marchand (logo à droite du lien) */
    affiliates: Record<string, string>;
    tags: TagView[];
    seo: { title?: string; description?: string; noindex: boolean; nofollow: boolean; canonical?: string; focusKeywords: string[] };
}

/* ─── Conversions ─── */

/* eslint-disable @typescript-eslint/no-explicit-any -- documents « lean » de Mongoose */
const id = (v: unknown) => String(v);

function toImage(img: any): ImageView | null {
    if (!img?.url) return null;
    return {
        url: img.url,
        width: img.width ?? undefined,
        height: img.height ?? undefined,
        alt: img.alt || "",
        credit: {
            author: img.credit?.author || "",
            source: img.credit?.source || "",
            license: img.credit?.license || "",
            sourceUrl: img.credit?.sourceUrl || "",
        },
    };
}
export function toCategory(c: any): CategoryView {
    return {
        id: id(c._id),
        slug: c.slug,
        name: c.name,
        color: c.color || "#ff6a1a",
        description: c.description || "",
        parentId: c.parent ? id(c.parent) : null,
    };
}
function toTag(t: any): TagView {
    return { id: id(t._id), slug: t.slug, name: t.name };
}
export function toAuthor(a: any): AuthorView {
    return { id: id(a._id), slug: a.slug, name: a.name, title: a.title || "", bio: a.bio || "", avatarUrl: avatarSrc({ avatarUrl: a.avatarUrl, workytId: a.workytId, seed: a.slug }) };
}
function toCard(p: any): PostCardView {
    const categories = (p.categories || []).filter(Boolean).map(toCategory);
    const primary = p.primaryCategory ? toCategory(p.primaryCategory) : categories[0] || null;
    return {
        id: id(p._id),
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt || "",
        publishedAt: new Date(p.publishedAt).toISOString(),
        modifiedAt: new Date(p.modifiedAt || p.publishedAt).toISOString(),
        readingMinutes: p.readingMinutes || 1,
        views: p.views || 0,
        commentCount: p.commentCount || 0,
        featuredImage: toImage(p.featuredImage),
        primaryCategory: primary,
        categories,
        authors: (p.authors || []).filter(Boolean).map(toAuthor),
    };
}
function toPost(p: any): PostView {
    return {
        ...toCard(p),
        contentHtml: p.contentHtml || "",
        modules: (p.modules ?? []) as ArticleModule[],
        contributors: (p.contributors || []).filter((c: any) => c?.slug).map(toAuthor),
        guests: {},
        affiliates: {},
        tags: (p.tags || []).filter(Boolean).map(toTag),
        seo: {
            title: p.seo?.title || undefined,
            description: p.seo?.description || undefined,
            noindex: !!p.seo?.noindex,
            nofollow: !!p.seo?.nofollow,
            canonical: p.seo?.canonical || undefined,
            focusKeywords: p.seo?.focusKeywords || [],
        },
    };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Article visible du public : publié, et date de publication passée */
function publishedFilter(extra: Record<string, unknown> = {}) {
    return { status: "published", publishedAt: { $lte: new Date() }, ...extra };
}

const CARD_FIELDS = "slug title excerpt publishedAt modifiedAt readingMinutes views commentCount featuredImage primaryCategory categories authors";
const POPULATE_CARD = [
    { path: "categories", select: "slug name color description parent" },
    { path: "primaryCategory", select: "slug name color description parent" },
    { path: "authors", select: "slug name title bio avatarUrl workytId" },
];

/* ─── Articles ─── */

export const getPostBySlug = cache(async (slug: string): Promise<PostView | null> => {
    await connectDB();
    const p = await Post.findOne(publishedFilter({ slug }))
        .populate([...POPULATE_CARD, { path: "tags", select: "slug name" }, { path: "contributors", select: "slug name title bio avatarUrl workytId" }])
        .lean();
    return p ? withGuests(toPost(p)) : null;
});

/** Aperçu de la rédaction : l'article quel que soit son statut (droits vérifiés par l'appelant) */
export async function getPostForPreview(id: string): Promise<PostView | null> {
    await connectDB();
    const p = await Post.findById(id)
        .populate([...POPULATE_CARD, { path: "tags", select: "slug name" }, { path: "contributors", select: "slug name title bio avatarUrl workytId" }])
        .lean();
    if (!p) return null;
    // Un brouillon n'a pas de date de publication : on affiche celle du jour
    return withGuests(toPost({ ...p, publishedAt: p.publishedAt ?? new Date(), modifiedAt: p.modifiedAt ?? p.publishedAt ?? new Date() }));
}

/** Profils d'auteur des rédacteurs invités des coups de cœur (avatar, lien) */
async function withGuests(post: PostView): Promise<PostView> {
    // Liens affiliés cités dans le texte : domaine du marchand pour son logo
    const names = [...new Set([...post.contentHtml.matchAll(/href="\/go\/([a-z0-9-]+)\/?"/g)].map((m) => m[1]))];
    if (names.length) {
        const links = await AffiliateLink.find({ name: { $in: names } }).select("name url").lean();
        post = { ...post, affiliates: Object.fromEntries(links.flatMap((l) => (hostOf(l.url) ? [[l.name, hostOf(l.url)!]] : []))) };
    }
    const ids = post.modules.flatMap((m) => (m.type === "guestFavorite" && m.data.guest ? [m.data.guest.memberId] : []));
    if (!ids.length) return post;
    const authors = await Author.find({ member: { $in: ids } }).lean();
    return { ...post, guests: Object.fromEntries(authors.map((a) => [String(a.member), toAuthor(a)])) };
}

export interface PostList {
    items: PostCardView[];
    total: number;
    page: number;
    pages: number;
}

export async function listPosts(
    opts: { page?: number; perPage?: number; category?: Types.ObjectId | string; categoryIds?: (Types.ObjectId | string)[]; tag?: Types.ObjectId | string; author?: Types.ObjectId | string; search?: string; after?: Date } = {}
): Promise<PostList> {
    await connectDB();
    const perPage = opts.perPage ?? SITE.postsPerPage;
    const page = Math.max(1, opts.page ?? 1);
    const extra: Record<string, unknown> = {};
    if (opts.categoryIds?.length) extra.categories = { $in: opts.categoryIds };
    else if (opts.category) extra.categories = opts.category;
    if (opts.tag) extra.tags = opts.tag;
    // Page auteur : ses articles, et ceux où il signe un coup de cœur
    if (opts.author) extra.$or = [{ authors: opts.author }, { contributors: opts.author }];
    if (opts.search?.trim()) extra.$text = { $search: opts.search.trim() };
    if (opts.after) extra.publishedAt = { $gt: opts.after, $lte: new Date() };
    const filter = publishedFilter(extra);
    const [docs, total] = await Promise.all([
        Post.find(filter).select(CARD_FIELDS).sort({ publishedAt: -1 }).skip((page - 1) * perPage).limit(perPage).populate(POPULATE_CARD).lean(),
        Post.countDocuments(filter),
    ]);
    return { items: docs.map(toCard), total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function mostReadPosts(limit = 3): Promise<PostCardView[]> {
    await connectDB();
    const docs = await Post.find(publishedFilter()).select(CARD_FIELDS).sort({ views: -1 }).limit(limit).populate(POPULATE_CARD).lean();
    return docs.map(toCard);
}

/** Articles de la même rubrique, les plus récents d'abord */
export async function relatedPosts(post: PostView, limit = 4): Promise<PostCardView[]> {
    await connectDB();
    const cats = post.categories.map((c) => c.id);
    const docs = await Post.find(publishedFilter({ _id: { $ne: post.id }, ...(cats.length ? { categories: { $in: cats } } : {}) }))
        .select(CARD_FIELDS)
        .sort({ publishedAt: -1 })
        .limit(limit)
        .populate(POPULATE_CARD)
        .lean();
    return docs.map(toCard);
}

/** Article précédent (plus ancien) et suivant (plus récent) */
export async function adjacentPosts(post: PostView): Promise<{ previous: PostCardView | null; next: PostCardView | null }> {
    await connectDB();
    const at = new Date(post.publishedAt);
    const [prev, next] = await Promise.all([
        Post.findOne(publishedFilter({ publishedAt: { $lt: at } })).select(CARD_FIELDS).sort({ publishedAt: -1 }).populate(POPULATE_CARD).lean(),
        Post.findOne({ status: "published", publishedAt: { $gt: at, $lte: new Date() } }).select(CARD_FIELDS).sort({ publishedAt: 1 }).populate(POPULATE_CARD).lean(),
    ]);
    return { previous: prev ? toCard(prev) : null, next: next ? toCard(next) : null };
}

/* ─── Rubriques, étiquettes, auteurs ─── */

export const getCategoryBySlug = cache(async (slug: string) => {
    await connectDB();
    const c = await Category.findOne({ slug }).lean();
    return c ? { ...toCategory(c), seo: { title: c.seo?.title, description: c.seo?.description, noindex: !!c.seo?.noindex } } : null;
});

export async function childCategoryIds(parentId: string): Promise<string[]> {
    await connectDB();
    const kids = await Category.find({ parent: parentId }).select("_id").lean();
    return kids.map((k) => id(k._id));
}

export const getTagBySlug = cache(async (slug: string) => {
    await connectDB();
    const t = await Tag.findOne({ slug }).lean();
    return t ? { ...toTag(t), description: t.description || "" } : null;
});

export const getAuthorBySlug = cache(async (slug: string) => {
    await connectDB();
    const a = await Author.findOne({ slug }).lean();
    return a ? { ...toAuthor(a), workytId: a.workytId || null, seo: { title: a.seo?.title, description: a.seo?.description } } : null;
});

export interface AuthorStats {
    published: number;
    views: number;
    since: string | null;
    lastAt: string | null;
    categories: (CategoryView & { count: number })[];
}

/** Chiffres d'un auteur (page de profil) : articles publiés, lectures, rubriques */
export async function authorStats(authorId: string): Promise<AuthorStats> {
    await connectDB();
    const match = publishedFilter({ authors: new Types.ObjectId(authorId) });
    const [totals, cats] = await Promise.all([
        Post.aggregate<{ n: number; views: number; first: Date; last: Date }>([{ $match: match }, { $group: { _id: null, n: { $sum: 1 }, views: { $sum: "$views" }, first: { $min: "$publishedAt" }, last: { $max: "$publishedAt" } } }]),
        Post.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: match }, { $unwind: "$categories" }, { $group: { _id: "$categories", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 8 }]),
    ]);
    const catDocs = await Category.find({ _id: { $in: cats.map((c) => c._id) } }).lean();
    const byId = new Map(catDocs.map((c) => [id(c._id), toCategory(c)]));
    const t = totals[0];
    return {
        published: t?.n ?? 0,
        views: t?.views ?? 0,
        since: t?.first ? new Date(t.first).toISOString() : null,
        lastAt: t?.last ? new Date(t.last).toISOString() : null,
        categories: cats.map((c) => (byId.get(id(c._id)) ? { ...byId.get(id(c._id))!, count: c.n } : null)).filter((c): c is CategoryView & { count: number } => c !== null),
    };
}

export interface MenuCategory extends CategoryView {
    children: CategoryView[];
}

/** Menu par défaut (rubriques du blog) si la base est injoignable, par exemple pendant le build */
const FALLBACK_MENU: MenuCategory[] = [
    ["actualites", "Actualités", "#ff6a1a"],
    ["conseils-methodes", "Conseils & méthodes", "#6ec1e4"],
    ["nos-interviews", "Nos interviews", "#b48cf2"],
    ["culture", "Culture", "#ffb547"],
    ["nos-tests", "Nos tests", "#7ed957"],
].map(([slug, name, color]) => ({ id: slug, slug, name, color, description: "", parentId: null, children: [] }));

/** Rubriques du menu : premier niveau, avec leurs sous-rubriques */
export const menuCategories = cache(async (): Promise<MenuCategory[]> => {
    try {
        await connectDB();
        const all = (await Category.find({ inMenu: true }).sort({ order: 1, name: 1 }).lean()).map(toCategory);
        const menu = all.filter((c) => !c.parentId).map((c) => ({ ...c, children: all.filter((k) => k.parentId === c.id) }));
        return menu.length ? menu : FALLBACK_MENU;
    } catch (error) {
        console.error("[menu] base injoignable, menu par défaut :", (error as Error).message);
        return FALLBACK_MENU;
    }
});

/** Rubriques de premier niveau et leur nombre d'articles publiés (sous-rubriques comprises) */
export async function categoriesWithCounts(): Promise<(CategoryView & { count: number })[]> {
    await connectDB();
    const [cats, counts] = await Promise.all([
        Category.find({}).sort({ order: 1, name: 1 }).lean(),
        Post.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: publishedFilter() }, { $unwind: "$categories" }, { $group: { _id: "$categories", n: { $sum: 1 } } }]),
    ]);
    const byId = new Map(counts.map((c) => [id(c._id), c.n]));
    const views = cats.map(toCategory);
    return views
        .filter((c) => !c.parentId)
        .map((c) => ({
            ...c,
            count: (byId.get(c.id) || 0) + views.filter((k) => k.parentId === c.id).reduce((s, k) => s + (byId.get(k.id) || 0), 0),
        }));
}
