import "server-only";
import mongoose from "mongoose";
import type { JSONContent } from "@tiptap/core";
import { connectDB } from "./db";
import { can, type Role } from "./roles";
import { documentImages, documentText, documentToHtml } from "@/editor/html";
import { readingMinutes } from "./render";
import { invalidateRedirects, normalizePath } from "./redirects";
import Post from "@/models/Post";
import Author from "@/models/Author";
import Member from "@/models/Member";
import Tag from "@/models/Tag";
import Category from "@/models/Category";
import Media from "@/models/Media";
import Redirect from "@/models/Redirect";
import Revision from "@/models/Revision";
import { documentSuggestions, withoutSuggestions } from "@/editor/marks";
import { editMode, type EditMode, type WorkflowContext } from "./workflow";
import { lockedByOther } from "./lockRule";
import { moduleIssues, sanitizeModules } from "./modules/sanitize";
import { MODULE_TYPES, emptyModule, type ArticleModule, type ModuleType } from "./modules/types";
import Notification from "@/models/Notification";
import { seoReportFor } from "./seo/server";
export { LOCK_TTL_MS, lockedByOther } from "./lockRule";

/**
 * Rédaction d'un article : brouillon, enregistrement automatique, adresse
 * unique. Le circuit (soumission, correction, approbation, publication) est
 * dans lib/review.ts ; qui peut modifier quoi, dans lib/workflow.ts.
 */

export interface Actor {
    memberId: string;
    role: Role;
    name: string;
}

/** Adresse lisible : « Mon Été à Paris ! » → « mon-ete-a-paris » */
export function slugify(text: string): string {
    return (
        text
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/œ/gi, "oe")
            .replace(/æ/gi, "ae")
            .toLowerCase()
            .replace(/['’]/g, "-")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 90)
            .replace(/-+$/g, "") || "article"
    );
}

/** Adresses réservées par les pages du blog : un article ne peut pas les prendre */
const RESERVED = new Set(["category", "tag", "author", "page", "feed", "search", "connexion", "dashboard", "api", "wp-json", "wp-admin", "sitemaps"]);

export async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = RESERVED.has(base) ? `${base}-article` : base;
    let candidate = root;
    for (let i = 2; i < 200; i++) {
        const taken = await Post.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
        if (!taken) return candidate;
        candidate = `${root}-${i}`;
    }
    return `${root}-${Date.now()}`;
}

/** Profil d'auteur public d'un membre (créé à son premier article) */
export async function ensureAuthor(memberId: string): Promise<mongoose.Types.ObjectId> {
    await connectDB();
    const member = await Member.findById(memberId);
    if (!member) throw new Error("Membre introuvable");
    // Profil d'auteur existant (et toujours présent : il a pu être supprimé)
    if (member.author && (await Author.exists({ _id: member.author }))) return member.author as mongoose.Types.ObjectId;
    const slug = await (async () => {
        const base = slugify(member.username);
        for (let i = 1; i < 100; i++) {
            const s = i === 1 ? base : `${base}-${i}`;
            if (!(await Author.exists({ slug: s }))) return s;
        }
        return `${base}-${Date.now()}`;
    })();
    const author = await Author.create({ slug, name: member.username, avatarUrl: member.avatarUrl, member: member._id, workytId: member.workytId });
    member.author = author._id;
    await member.save();
    return author._id;
}

type PostForContext = { authors: unknown[]; status: string; corrector?: { member?: unknown } | null; pendingSuggestions?: number | null };

/** La personne face à l'article : auteur ? correcteur qui l'a pris ? */
export async function actorContext(actor: Actor, post: PostForContext): Promise<WorkflowContext> {
    const member = await Member.findById(actor.memberId).select("author").lean();
    return {
        status: post.status as WorkflowContext["status"],
        role: actor.role,
        // Les auteurs peuvent arriver peuplés (documents) ou en identifiants
        isAuthor: !!member?.author && post.authors.map((a) => String((a as { _id?: unknown })?._id ?? a)).includes(String(member.author)),
        isCorrector: !!post.corrector?.member && String(post.corrector.member) === actor.memberId,
        pendingSuggestions: post.pendingSuggestions ?? 0,
    };
}

export async function editModeFor(actor: Actor, post: PostForContext): Promise<EditMode> {
    if (!can(actor.role, "post.create") && !can(actor.role, "post.correct")) return "read";
    return editMode(await actorContext(actor, post));
}

export async function canEditPost(actor: Actor, post: PostForContext): Promise<boolean> {
    return (await editModeFor(actor, post)) !== "read";
}

/**
 * Nouveau brouillon, vide ou « à partir d'un modèle » (§ 8.1) : le module du
 * modèle (recette, avis lecture…) est déjà ajouté et placé dans le texte.
 */
export async function createDraft(actor: Actor, template?: string): Promise<string> {
    if (!can(actor.role, "post.create")) throw new PostError("Réservé à la rédaction.", 403);
    await connectDB();
    const authorId = await ensureAuthor(actor.memberId);
    const mod = template && (MODULE_TYPES as readonly string[]).includes(template) && template !== "guestFavorite" ? emptyModule(template as ModuleType) : null;
    const post = await Post.create({
        title: "Sans titre",
        slug: await uniqueSlug(`brouillon-${Date.now().toString(36)}`),
        status: "draft",
        authors: [authorId],
        ...(mod
            ? {
                  modules: [mod],
                  contentJson: { type: "doc", content: [{ type: "paragraph" }, ...(mod.type === "sources" ? [] : [{ type: "moduleEmbed", attrs: { moduleId: mod.id } }]), { type: "paragraph" }] },
              }
            : {}),
    });
    return String(post._id);
}

export interface SaveInput {
    title?: string;
    slug?: string;
    excerpt?: string;
    contentJson?: JSONContent;
    categories?: string[];
    primaryCategory?: string | null;
    tags?: string[];
    featuredMediaId?: string | null;
    seo?: { title?: string; description?: string; focusKeywords?: string[]; noindex?: boolean };
    modules?: unknown;
    isPillar?: boolean;
}

const isId = (v: unknown): v is string => typeof v === "string" && mongoose.isValidObjectId(v);

/** Enregistre les champs envoyés (enregistrement automatique de l'éditeur) */
export async function savePost(id: string, rawInput: SaveInput, actor: Actor) {
    let input = rawInput;
    await connectDB();
    if (!isId(id)) throw new PostError("Article introuvable.", 404);
    const post = await Post.findById(id);
    if (!post) throw new PostError("Article introuvable.", 404);
    const mode = await editModeFor(actor, post);
    if (mode === "read") throw new PostError("Tu ne peux pas modifier cet article pour l'instant.", 403);
    if (lockedByOther(post, actor.memberId)) throw new PostError(`${post.lock?.name || "Quelqu'un"} est en train de modifier cet article.`, 409);
    // Le correcteur ne touche qu'au texte, en suggestions
    if (mode === "suggest") input = { contentJson: input.contentJson };

    // Une version par séance d'édition : l'état d'avant, dès qu'une autre personne s'y met ou après 30 min
    if ((input.contentJson || typeof input.title === "string") && post.contentJson) {
        const last = await Revision.findOne({ post: post._id }).sort({ createdAt: -1 }).select("member createdAt").lean();
        if (!last || String(last.member) !== actor.memberId || Date.now() - last.createdAt.getTime() > 30 * 60_000) {
            await Revision.create({
                post: post._id,
                title: post.title,
                excerpt: post.excerpt,
                contentJson: post.contentJson,
                status: post.status,
                label: `Avant les modifications de ${actor.name}`,
                member: actor.memberId,
                name: actor.name,
                words: documentText(post.contentJson as JSONContent).split(" ").filter(Boolean).length,
            });
        }
    }

    // Adresse automatique (« brouillon-… » ou tirée du titre) : elle suit le titre tant que l'article n'a jamais été publié
    const autoSlug = !post.publishedAt && (post.slug.startsWith("brouillon-") || post.slug.replace(/-\d+$/, "") === slugify(post.title));
    if (typeof input.title === "string") post.title = input.title.trim().slice(0, 200) || "Sans titre";
    if (autoSlug && typeof input.title === "string" && typeof input.slug !== "string" && post.title !== "Sans titre") {
        post.slug = await uniqueSlug(slugify(post.title), id);
    }

    // Adresse : libre tant que l'article n'est pas publié ; ensuite, un changement crée une redirection
    if (typeof input.slug === "string") {
        const wanted = slugify(input.slug || post.title);
        if (wanted !== post.slug) {
            const next = await uniqueSlug(wanted, id);
            if (post.status === "published" || post.publishedAt) {
                await Redirect.findOneAndUpdate(
                    { from: normalizePath(`/${post.slug}/`) },
                    { to: `/${next}/`, status: 301, source: "slug-change" },
                    { upsert: true }
                );
                // Une ancienne redirection vers la nouvelle adresse ferait une boucle : on la retire
                await Redirect.deleteOne({ from: normalizePath(`/${next}/`) });
                invalidateRedirects();
            }
            post.slug = next;
        }
    }

    if (typeof input.excerpt === "string") post.excerpt = input.excerpt.trim().slice(0, 400);

    if (input.contentJson && input.contentJson.type === "doc") {
        post.contentJson = input.contentJson;
        // Le HTML public ne montre jamais les suggestions en cours ni les commentaires
        post.contentHtml = documentToHtml(withoutSuggestions(input.contentJson));
        post.readingMinutes = readingMinutes(post.contentHtml);
        post.pendingSuggestions = documentSuggestions(input.contentJson).length;
    }

    if (Array.isArray(input.categories)) {
        const ids = input.categories.filter(isId);
        const existing = await Category.find({ _id: { $in: ids } }).select("_id").lean();
        post.categories = existing.map((c) => c._id);
    }
    if (input.primaryCategory === null) post.primaryCategory = undefined;
    else if (isId(input.primaryCategory) && post.categories.map(String).includes(input.primaryCategory)) {
        post.primaryCategory = new mongoose.Types.ObjectId(input.primaryCategory);
    }
    if (post.primaryCategory && !post.categories.map(String).includes(String(post.primaryCategory))) post.primaryCategory = undefined;

    if (Array.isArray(input.tags)) {
        const names = [...new Set(input.tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 20);
        const tagIds = [];
        for (const name of names) {
            const slug = slugify(name);
            const tag = await Tag.findOneAndUpdate({ slug }, { $setOnInsert: { slug, name } }, { upsert: true, new: true });
            tagIds.push(tag._id);
        }
        post.tags = tagIds;
    }

    if (input.featuredMediaId === null) post.featuredImage = undefined;
    else if (isId(input.featuredMediaId)) {
        const m = await Media.findById(input.featuredMediaId).lean();
        if (!m) throw new PostError("Image introuvable dans la médiathèque.", 400);
        post.featuredImage = {
            url: m.url,
            width: m.width ?? undefined,
            height: m.height ?? undefined,
            alt: m.alt,
            credit: { author: m.credit?.author || "", source: m.credit?.source || "", license: m.credit?.license || "", sourceUrl: m.credit?.sourceUrl || "" },
            rightsVerified: m.rightsVerified,
            rightsToCheck: m.rightsToCheck,
        };
    }

    if (input.modules !== undefined) await saveModules(post, input.modules, actor);

    if (input.seo) {
        post.set("seo.title", input.seo.title?.trim().slice(0, 120) || undefined);
        post.set("seo.description", input.seo.description?.trim().slice(0, 320) || undefined);
        post.set("seo.focusKeywords", (input.seo.focusKeywords || []).map((k) => String(k).trim()).filter(Boolean).slice(0, 5));
        post.set("seo.noindex", !!input.seo.noindex);
    }
    // Contenu pilier : l'assistant SEO propose des liens vers lui depuis les autres articles
    if (typeof input.isPillar === "boolean" && mode === "edit") post.isPillar = input.isPillar;

    // Note SEO (§ 10.3) enregistrée avec l'article : filtre « score < 60 » du dashboard
    post.set("seo.score", (await seoReportFor(post)).score);

    if (post.status === "published") post.modifiedAt = new Date();
    if (post.lock?.member && String(post.lock.member) === actor.memberId) post.set("lock.at", new Date());
    await post.save();
    return { slug: post.slug, savedAt: new Date().toISOString(), readingMinutes: post.readingMinutes, pendingSuggestions: post.pendingSuggestions, seoScore: post.seo?.score ?? null, ...(input.modules !== undefined ? { modules: post.modules } : {}) };
}

/**
 * Modules envoyés par l'éditeur : nettoyés, invités vérifiés (un rédacteur
 * du blog, pas soi-même), et invitation envoyée au nouvel invité.
 */
async function saveModules(post: { _id: unknown; title: string; modules?: unknown; set: (path: string, v: unknown) => void }, raw: unknown, actor: Actor) {
    const previous = (post.modules ?? []) as ArticleModule[];
    const modules = sanitizeModules(raw, previous);
    const invited: { memberId: string; name: string }[] = [];
    for (const m of modules) {
        if (m.type !== "guestFavorite" || !m.data.guest) continue;
        const guest = await Member.findById(m.data.guest.memberId).select("username role").lean();
        if (!guest || guest.role === "lecteur" || String(guest._id) === actor.memberId) {
            throw new PostError("Le coup de cœur externe est signé par un autre membre de la rédaction.");
        }
        m.data.guest.name = guest.username;
        const before = previous.find((p) => p.id === m.id);
        const wasInvited = before?.type === "guestFavorite" && before.data.guest?.memberId === m.data.guest.memberId && before.data.status !== "draft";
        if (!wasInvited) invited.push(m.data.guest);
    }
    post.set("modules", modules);
    if (invited.length) {
        await Notification.insertMany(
            invited.map((g) => ({ to: g.memberId, type: "invitation", post: post._id, postTitle: post.title, text: `${actor.name} t'invite à écrire ton coup de cœur dans son article.`, by: actor.name }))
        );
    }
}

/** Ce qui manque pour soumettre ou publier un article (bloquant) */
export function publishChecklist(post: {
    title: string;
    contentJson?: unknown;
    contentHtml?: string;
    categories: unknown[];
    excerpt?: string;
    featuredImage?: { url?: string | null; alt?: string | null; credit?: { author?: string | null; source?: string | null; license?: string | null } | null } | null;
    modules?: unknown;
}): string[] {
    const issues: string[] = [];
    if (!post.title || post.title === "Sans titre") issues.push("Donne un titre à l'article.");
    if (!post.categories.length) issues.push("Choisis au moins une rubrique.");
    if (!post.featuredImage?.url) issues.push("Ajoute une image à la une.");
    else {
        if (!post.featuredImage.alt) issues.push("Décris l'image à la une (texte alternatif).");
        const c = post.featuredImage.credit;
        if (!c?.author || !c.source || !c.license) issues.push("Indique la source et la licence de l'image à la une.");
    }
    const doc = post.contentJson as JSONContent | undefined;
    if (doc && documentText(doc).length < 50) issues.push("L'article est encore trop court.");
    const missing = documentImages(doc).filter((i) => !i.hasCredit).length;
    if (missing) issues.push(`${missing} image${missing > 1 ? "s" : ""} du texte sans source ni licence.`);
    issues.push(...moduleIssues((post.modules ?? []) as ArticleModule[]).submit);
    return issues;
}

export class PostError extends Error {
    constructor(
        message: string,
        public status = 400,
        public issues: string[] = []
    ) {
        super(message);
    }
}
