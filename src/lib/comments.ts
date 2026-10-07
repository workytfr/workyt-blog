import "server-only";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { connectDB } from "./db";
import { can, type Role } from "./roles";
import { avatarSrc } from "./avatar";
import { PostError, type Actor } from "./posts";
import { cleanCommentText, commentFlags, editableUntil, initialStatus, isReaction, rateLimit, REACTIONS, type ReactionKey } from "./commentRules";
import Comment from "@/models/Comment";
import Member from "@/models/Member";
import Notification from "@/models/Notification";
import Post from "@/models/Post";
import Reaction from "@/models/Reaction";

/**
 * Commentaires des lecteurs (§ 11) et réactions aux articles. Les règles
 * pures (filtre, délais) sont dans commentRules.ts.
 */

const isId = (v: unknown): v is string => typeof v === "string" && mongoose.isValidObjectId(v);
const MODERATORS: Role[] = ["correcteur", "redac_chef", "admin"];

/** Commentaire tel qu'affiché sous l'article */
export interface CommentView {
    id: string;
    parentId: string | null;
    name: string;
    avatar: string;
    /** « Auteur » de l'article, ou membre de la « Rédaction » */
    badge: "auteur" | "redaction" | null;
    text: string;
    status: "published" | "pending" | "deleted";
    /** Pourquoi il attend (visible seulement par son auteur) */
    reasons: string[];
    createdAt: string;
    edited: boolean;
    likes: number;
    liked: boolean;
    mine: boolean;
    /** Fin du délai de modification (ms), pour son auteur */
    editableUntil: number | null;
}

async function publishedPost(postId: string) {
    if (!isId(postId)) throw new PostError("Article introuvable.", 404);
    await connectDB();
    const post = await Post.findById(postId).select("slug title status authors").lean();
    if (!post || post.status !== "published") throw new PostError("Article introuvable.", 404);
    return post;
}

/** Recompte des commentaires publiés, et page de l'article à régénérer */
async function refresh(postId: mongoose.Types.ObjectId | string, slug?: string) {
    const n = await Comment.countDocuments({ post: postId, status: "published" });
    const post = await Post.findByIdAndUpdate(postId, { $set: { commentCount: n } }, { new: true, timestamps: false }).select("slug").lean();
    const s = slug ?? post?.slug;
    if (s) {
        try {
            revalidatePath(`/${s}/`);
        } catch {
            /* hors requête (tests, scripts) */
        }
    }
}

/* ─── Lecture ─── */

/**
 * Commentaires d'un article : publiés, supprimés qui ont des réponses
 * (« Commentaire supprimé »), et, pour la personne connectée, les siens en
 * attente de modération.
 */
export async function listComments(postId: string, viewer?: string | null): Promise<CommentView[]> {
    if (!isId(postId)) return [];
    await connectDB();
    const or: Record<string, unknown>[] = [{ status: "published" }, { status: "deleted" }];
    if (viewer && isId(viewer)) or.push({ status: "pending", member: viewer });
    const [rows, post] = await Promise.all([
        Comment.find({ post: postId, $or: or }).sort({ createdAt: 1 }).limit(500).lean(),
        Post.findById(postId).select("authors").lean(),
    ]);
    const memberIds = [...new Set(rows.map((r) => (r.member ? String(r.member) : "")).filter(Boolean))];
    const members = new Map((await Member.find({ _id: { $in: memberIds } }).select("username avatarUrl workytId role author").lean()).map((m) => [String(m._id), m]));
    const authors = new Set((post?.authors ?? []).map(String));
    // Un commentaire supprimé ne reste affiché que s'il a des réponses visibles
    const withReplies = new Set(rows.filter((r) => r.parent && r.status !== "deleted").map((r) => String(r.parent)));
    const now = Date.now();

    return rows
        .filter((r) => r.status !== "deleted" || withReplies.has(String(r._id)))
        .map((r) => {
            const m = r.member ? members.get(String(r.member)) : undefined;
            const mine = !!viewer && !!r.member && String(r.member) === viewer;
            const deleted = r.status === "deleted";
            return {
                id: String(r._id),
                parentId: r.parent ? String(r.parent) : null,
                name: deleted ? "" : r.name,
                avatar: deleted ? "" : avatarSrc({ avatarUrl: m?.avatarUrl, workytId: m?.workytId, seed: m?.username || r.name }),
                badge: m?.author && authors.has(String(m.author)) ? "auteur" : m && m.role !== "lecteur" ? "redaction" : null,
                text: deleted ? "" : r.text,
                status: r.status as CommentView["status"],
                reasons: mine && r.status === "pending" ? r.reasons : [],
                createdAt: new Date(r.createdAt).toISOString(),
                edited: !!r.editedAt,
                likes: r.likes?.length ?? 0,
                liked: !!viewer && (r.likes ?? []).some((l) => String(l) === viewer),
                mine,
                editableUntil: mine && !deleted ? editableUntil(r, now) : null,
            };
        });
}

/* ─── Écrire, modifier, supprimer ─── */

async function isTrusted(actor: Actor): Promise<boolean> {
    // La rédaction est de confiance ; un lecteur l'est dès qu'un de ses commentaires a été publié
    if (actor.role !== "lecteur") return true;
    return !!(await Comment.exists({ member: actor.memberId, status: "published" }));
}

export async function createComment(actor: Actor, postId: string, input: { text?: unknown; parentId?: unknown }) {
    if (!can(actor.role, "comment")) throw new PostError("Connecte-toi pour commenter.", 401);
    const post = await publishedPost(postId);
    const text = cleanCommentText(String(input.text ?? ""));
    if (text.length < 2) throw new PostError("Ton commentaire est vide.", 400);

    // Réponse : toujours rattachée au commentaire de premier niveau (un seul niveau)
    let parent: mongoose.Types.ObjectId | null = null;
    if (input.parentId) {
        if (!isId(input.parentId)) throw new PostError("Commentaire introuvable.", 404);
        const p = await Comment.findOne({ _id: input.parentId, post: post._id, status: "published" }).select("parent").lean();
        if (!p) throw new PostError("Ce commentaire n'existe plus.", 404);
        parent = (p.parent as mongoose.Types.ObjectId | null) ?? p._id;
    }

    const [last, lastHour] = await Promise.all([
        Comment.findOne({ member: actor.memberId }).sort({ createdAt: -1 }).select("createdAt").lean(),
        Comment.countDocuments({ member: actor.memberId, createdAt: { $gte: new Date(Date.now() - 3600_000) } }),
    ]);
    const limited = rateLimit({ lastAt: last?.createdAt ?? null, lastHour });
    if (limited) throw new PostError(limited, 429);

    const { status, reasons } = initialStatus({ trusted: await isTrusted(actor), flags: commentFlags(text) });
    const c = await Comment.create({ post: post._id, parent, member: actor.memberId, name: actor.name || "Membre", text, status, reasons, publishedAt: status === "published" ? new Date() : null });

    if (status === "published") {
        await refresh(post._id, post.slug);
        await notifyPublished(c._id);
    } else await notifyModerators(post, actor.name, reasons);
    return { id: String(c._id), status, reasons };
}

export async function editComment(actor: Actor, id: string, rawText: unknown) {
    if (!isId(id)) throw new PostError("Commentaire introuvable.", 404);
    await connectDB();
    const c = await Comment.findById(id);
    if (!c || String(c.member) !== actor.memberId || !["published", "pending"].includes(c.status)) throw new PostError("Commentaire introuvable.", 404);
    if (!editableUntil(c)) throw new PostError("Le délai de 15 minutes pour modifier ce commentaire est passé.", 403);
    const text = cleanCommentText(String(rawText ?? ""));
    if (text.length < 2) throw new PostError("Ton commentaire est vide.", 400);
    const flags = commentFlags(text);
    const wasPublished = c.status === "published";
    c.text = text;
    c.editedAt = new Date();
    if (flags.length) {
        // Le filtre se déclenche : retour en modération
        c.status = "pending";
        c.reasons = [...new Set([...c.reasons.filter((r) => r === "premier commentaire"), ...flags])];
    } else if (c.status === "pending") c.reasons = c.reasons.filter((r) => r === "premier commentaire" || r === "signalé");
    await c.save();
    if (wasPublished) await refresh(c.post);
    return { status: c.status };
}

export async function deleteComment(actor: Actor, id: string) {
    if (!isId(id)) throw new PostError("Commentaire introuvable.", 404);
    await connectDB();
    const c = await Comment.findById(id);
    if (!c || c.status === "deleted") throw new PostError("Commentaire introuvable.", 404);
    const own = !!c.member && String(c.member) === actor.memberId;
    if (!own && !can(actor.role, "comment.moderate")) throw new PostError("Tu ne peux pas supprimer ce commentaire.", 403);
    c.status = "deleted";
    c.text = "";
    c.likes = [];
    c.moderatedBy = own ? "" : actor.name;
    await c.save();
    await refresh(c.post);
}

/* ─── J'aime, signalement ─── */

export async function toggleLike(actor: Actor, id: string) {
    if (!isId(id)) throw new PostError("Commentaire introuvable.", 404);
    await connectDB();
    const c = await Comment.findOne({ _id: id, status: "published" }).select("likes member").lean();
    if (!c) throw new PostError("Commentaire introuvable.", 404);
    if (c.member && String(c.member) === actor.memberId) throw new PostError("On ne peut pas aimer son propre commentaire.", 400);
    const liked = (c.likes ?? []).some((l) => String(l) === actor.memberId);
    const next = await Comment.findByIdAndUpdate(id, liked ? { $pull: { likes: actor.memberId } } : { $addToSet: { likes: actor.memberId } }, { new: true }).select("likes").lean();
    return { liked: !liked, likes: next?.likes?.length ?? 0 };
}

export async function reportComment(actor: Actor, id: string) {
    if (!isId(id)) throw new PostError("Commentaire introuvable.", 404);
    await connectDB();
    const c = await Comment.findById(id);
    if (!c || c.status !== "published") throw new PostError("Commentaire introuvable.", 404);
    if (c.member && String(c.member) === actor.memberId) throw new PostError("C'est ton propre commentaire.", 400);
    if (c.reports.some((r) => String(r.member) === actor.memberId)) return { already: true };
    c.reports.push({ member: new mongoose.Types.ObjectId(actor.memberId), at: new Date() });
    // Signalé : retiré en attendant la modération
    c.status = "pending";
    c.reasons = [...new Set([...c.reasons, "signalé"])];
    await c.save();
    await refresh(c.post);
    const post = await Post.findById(c.post).select("title").lean();
    if (post) await notifyModerators(post, actor.name, ["signalé"], "signale un commentaire");
    return { already: false };
}

/* ─── Modération (dashboard) ─── */

export async function moderateComment(actor: Actor, id: string, action: "approve" | "reject") {
    if (!can(actor.role, "comment.moderate")) throw new PostError("Réservé à la modération.", 403);
    if (!isId(id)) throw new PostError("Commentaire introuvable.", 404);
    await connectDB();
    const c = await Comment.findById(id);
    if (!c || c.status === "deleted") throw new PostError("Commentaire introuvable.", 404);
    const firstPublish = !c.publishedAt;
    c.status = action === "approve" ? "published" : "rejected";
    c.reasons = [];
    c.moderatedBy = actor.name;
    if (action === "approve") {
        c.set("reports", []);
        c.publishedAt ??= new Date();
    }
    await c.save();
    await refresh(c.post);
    if (action === "approve" && firstPublish) await notifyPublished(c._id);
}

export interface ModerationItem {
    id: string;
    text: string;
    name: string;
    avatar: string;
    status: string;
    reasons: string[];
    reports: number;
    createdAt: string;
    post: { id: string; title: string; slug: string };
    isReply: boolean;
}

export async function moderationQueue(filter: "pending" | "published" | "rejected", limit = 60): Promise<ModerationItem[]> {
    await connectDB();
    const rows = await Comment.find({ status: filter })
        .sort(filter === "pending" ? { updatedAt: 1 } : { updatedAt: -1 })
        .limit(limit)
        .populate<{ post: { _id: mongoose.Types.ObjectId; title: string; slug: string } | null }>("post", "title slug")
        .lean();
    const members = new Map((await Member.find({ _id: { $in: rows.map((r) => r.member).filter(Boolean) } }).select("username avatarUrl workytId").lean()).map((m) => [String(m._id), m]));
    return rows.map((r) => {
        const m = r.member ? members.get(String(r.member)) : undefined;
        return {
            id: String(r._id),
            text: r.text,
            name: r.name,
            avatar: avatarSrc({ avatarUrl: m?.avatarUrl, workytId: m?.workytId, seed: m?.username || r.name }),
            status: r.status,
            reasons: r.reasons,
            reports: r.reports?.length ?? 0,
            createdAt: new Date(r.createdAt).toISOString(),
            post: { id: r.post ? String(r.post._id) : "", title: r.post?.title ?? "(article supprimé)", slug: r.post?.slug ?? "" },
            isReply: !!r.parent,
        };
    });
}

export async function pendingCommentCount() {
    await connectDB();
    return Comment.countDocuments({ status: "pending" });
}

/* ─── Notifications ─── */

async function notifyModerators(post: { _id: mongoose.Types.ObjectId; title: string }, by: string, reasons: string[], verb = "a écrit un commentaire à modérer") {
    const mods = await Member.find({ role: { $in: MODERATORS } }).select("_id").lean();
    if (!mods.length) return;
    const why = reasons.length ? ` (${reasons.join(", ")})` : "";
    await Notification.insertMany(mods.map((m) => ({ to: m._id, type: "comment.pending", post: post._id, postTitle: post.title, text: `${by} ${verb}${why}.`, by })));
}

/** Commentaire publié : l'auteur de l'article, et la personne à qui l'on répond */
async function notifyPublished(commentId: mongoose.Types.ObjectId) {
    const c = await Comment.findById(commentId).lean();
    if (!c) return;
    const post = await Post.findById(c.post).select("title authors").lean();
    if (!post) return;
    const to = new Map<string, string>();
    for (const m of await Member.find({ author: { $in: post.authors } }).select("_id").lean()) to.set(String(m._id), `${c.name} a commenté ton article.`);
    if (c.parent) {
        const parent = await Comment.findById(c.parent).select("member").lean();
        if (parent?.member) to.set(String(parent.member), `${c.name} a répondu à ton commentaire.`);
    }
    if (c.member) to.delete(String(c.member));
    if (!to.size) return;
    await Notification.insertMany([...to].map(([member, text]) => ({ to: member, type: c.parent ? "comment.reply" : "comment", post: c.post, postTitle: post.title, text, by: c.name })));
}

/* ─── Réactions ─── */

export type ReactionCounts = Partial<Record<ReactionKey, number>>;

export async function reactionCounts(postId: string): Promise<ReactionCounts> {
    if (!isId(postId)) return {};
    await connectDB();
    const post = await Post.findById(postId).select("reactions").lean();
    const raw = (post?.reactions ?? {}) as Record<string, number>;
    return Object.fromEntries(REACTIONS.map((r) => [r.key, raw[r.key] ?? 0]).filter(([, n]) => (n as number) > 0));
}

export async function myReaction(postId: string, voter: string): Promise<ReactionKey | null> {
    if (!isId(postId)) return null;
    await connectDB();
    const r = await Reaction.findOne({ post: postId, voter }).select("type").lean();
    return r && isReaction(r.type) ? r.type : null;
}

/** Choisit (ou retire, avec null) sa réaction ; renvoie les nouveaux totaux */
export async function setReaction(postId: string, voter: string, type: unknown): Promise<{ counts: ReactionCounts; mine: ReactionKey | null }> {
    const post = await publishedPost(postId);
    if (type === null) await Reaction.deleteOne({ post: post._id, voter });
    else if (isReaction(type)) await Reaction.updateOne({ post: post._id, voter }, { $set: { type } }, { upsert: true });
    else throw new PostError("Réaction inconnue.", 400);
    const totals = await Reaction.aggregate<{ _id: string; n: number }>([{ $match: { post: post._id } }, { $group: { _id: "$type", n: { $sum: 1 } } }]);
    const counts = Object.fromEntries(totals.filter((t) => isReaction(t._id)).map((t) => [t._id, t.n])) as ReactionCounts;
    // strict: false : le total s'écrit même si le modèle chargé date d'avant le champ « reactions » (rechargement à chaud)
    await Post.updateOne({ _id: post._id }, { $set: { reactions: counts } }, { strict: false, timestamps: false });
    return { counts, mine: type === null ? null : (type as ReactionKey) };
}
