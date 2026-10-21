import "server-only";
import mongoose from "mongoose";
import type { JSONContent } from "@tiptap/core";
import { connectDB } from "./db";
import { can, type Role } from "./roles";
import { documentText } from "@/editor/html";
import { after } from "next/server";
import { actorContext, editModeFor, ensureAuthor, isId, LOCK_TTL_MS, lockedByOther, PostError, publishChecklist, revalidatePostPages, savePost, type Actor } from "./posts";
import { ACTION_PAST, allowedActions, canReview, editMode, nextStatus, WorkflowError, type EditMode, type WorkflowAction } from "./workflow";
import Post from "@/models/Post";
import Member from "@/models/Member";
import Revision from "@/models/Revision";
import ReviewThread from "@/models/ReviewThread";
import Notification from "@/models/Notification";
import Presence from "@/models/Presence";
import Author from "@/models/Author";
import Comment from "@/models/Comment";
import Reaction from "@/models/Reaction";
import { moduleIssues, applyGuestEdit } from "./modules/sanitize";
import type { ArticleModule, GuestFavoriteData } from "./modules/types";
import { notifyReviewDiscord } from "./discord";
import { revisionKind } from "./revisionRules";
import { purgeRevisions, revisionContent, saveRevision } from "./revisions";
import { CORRECTION_PLACE_LABELS, isCorrectionPlace, type CorrectionPlace, type CorrectorInfo } from "./correction";

/**
 * Circuit de relecture (lot 3, cahier des charges § 7) : changements de
 * statut, journal, versions, discussions, notifications, présence et verrou.
 */

/** Tâche lancée après la réponse (after de Next) ; hors requête (scripts, tests), sans l'attendre */
function inBackground(task: () => Promise<unknown>) {
    try {
        after(task);
    } catch {
        void task();
    }
}

async function findPost(id: string) {
    await connectDB();
    if (!isId(id)) throw new PostError("Article introuvable.", 404);
    const post = await Post.findById(id);
    if (!post) throw new PostError("Article introuvable.", 404);
    return post;
}
type PostDocument = Awaited<ReturnType<typeof findPost>>;


/* ─── Notifications ─── */

type Audience = "authors" | "corrector" | "correctors" | "chiefs";

async function recipients(post: PostDocument, audience: Audience[]): Promise<string[]> {
    const ids = new Set<string>();
    if (audience.includes("authors")) (await Member.find({ author: { $in: post.authors } }).select("_id").lean()).forEach((m) => ids.add(String(m._id)));
    if (audience.includes("corrector") && post.corrector?.member) ids.add(String(post.corrector.member));
    const roles: Role[] = [...(audience.includes("correctors") ? (["correcteur"] as Role[]) : []), ...(audience.includes("chiefs") ? (["redac_chef", "admin"] as Role[]) : [])];
    if (roles.length) (await Member.find({ role: { $in: roles } }).select("_id").lean()).forEach((m) => ids.add(String(m._id)));
    return [...ids];
}

async function notify(post: PostDocument, type: string, text: string, audience: Audience[], actor: Actor, extra: string[] = []) {
    const to = new Set([...(await recipients(post, audience)), ...extra]);
    to.delete(actor.memberId);
    if (!to.size) return;
    await Notification.insertMany([...to].map((m) => ({ to: m, type, post: post._id, postTitle: post.title, text, by: actor.name })));
}

const NOTIFY: Partial<Record<WorkflowAction, { audience: Audience[]; text: (by: string, reason?: string) => string }>> = {
    submit: { audience: ["correctors", "chiefs"], text: (by) => `${by} a envoyé un article en correction.` },
    take: { audience: ["authors"], text: (by) => `${by} corrige ton article.` },
    return: { audience: ["authors"], text: (by, r) => `${by} te renvoie l'article : « ${r} »` },
    validate: { audience: ["chiefs", "authors"], text: (by) => `${by} a validé la correction : l'article attend l'approbation.` },
    approve: { audience: ["authors", "corrector"], text: (by) => `${by} a approuvé l'article.` },
    refuse: { audience: ["authors", "corrector"], text: (by, r) => `${by} a refusé l'article : « ${r} »` },
    publish: { audience: ["authors"], text: (by) => `${by} a publié l'article.` },
    unschedule: { audience: ["authors"], text: (by) => `${by} a annulé la publication programmée.` },
    unpublish: { audience: ["authors"], text: (by) => `${by} a dépublié l'article.` },
};

/* ─── Changements de statut ─── */

const REVISION_LABEL: Partial<Record<WorkflowAction, string>> = {
    submit: "Envoyé en correction",
    validate: "Correction validée",
    return: "Renvoyé au rédacteur",
    approve: "Approuvé",
    publish: "Publié",
};

/**
 * Applique une action du circuit. Vérifie les droits, le motif, la liste des
 * points bloquants (soumission, publication), puis tient le journal, garde
 * une version et prévient les personnes concernées.
 */
export async function applyAction(id: string, action: WorkflowAction, actor: Actor, opts: { reason?: string; at?: string | null } = {}) {
    const post = await findPost(id);
    const ctx = await actorContext(actor, post);
    const at = opts.at ? new Date(opts.at) : null;
    if (at && Number.isNaN(at.getTime())) throw new PostError("Date de publication invalide.");
    const reason = opts.reason?.trim().slice(0, 1000) || undefined;

    let to;
    try {
        to = nextStatus(action, ctx, { reason, at });
    } catch (e) {
        if (e instanceof WorkflowError) throw new PostError(e.message, e.status);
        throw e;
    }

    if (action === "submit" || action === "approve" || action === "publish") {
        const issues = publishChecklist(post);
        if (issues.length) throw new PostError(issues.join(" "), 422, issues);
    }
    // Coup de cœur d'un invité : l'article ne part pas en approbation tant qu'il n'a pas validé son texte
    if (action === "validate" || action === "approve" || action === "publish") {
        const waiting = moduleIssues((post.modules ?? []) as ArticleModule[]).approval;
        if (waiting.length) throw new PostError(waiting.join(" "), 422, waiting);
    }

    const from = post.status;
    post.status = to;
    if (action === "take") post.corrector = { member: new mongoose.Types.ObjectId(actor.memberId), name: actor.name, via: "blog" };
    if (action === "trash") post.trashedAt = new Date();
    if (action === "restore") post.trashedAt = undefined;
    if (to === "scheduled") {
        post.scheduledAt = at!;
        post.publishedAt = at!;
    }
    if (to === "published") {
        post.scheduledAt = undefined;
        // Republication : on garde la date d'origine
        post.publishedAt ??= new Date();
        post.modifiedAt = new Date();
        if (!post.excerpt) post.excerpt = documentText(post.contentJson as JSONContent).slice(0, 220);
    }
    if (action === "unschedule") {
        post.scheduledAt = undefined;
        // Jamais publié : plus de date de publication
        if (post.publishedAt && post.publishedAt > new Date()) post.publishedAt = undefined;
    }
    // Un changement de statut rend la main : le prochain qui modifie la reprend
    post.set("lock", undefined);
    post.workflow.push({ action, from, to, member: new mongoose.Types.ObjectId(actor.memberId), name: actor.name, reason, at: new Date() });
    // Écriture conditionnée au statut lu : deux clics simultanés (deux « Prendre », un « Annuler » pendant
    // la publication programmée) ne s'écrasent pas, le second reçoit un 409 (voir errorResponse)
    post.$where = { status: from };
    await post.save();

    if (REVISION_LABEL[action]) await saveRevision(post, "step", REVISION_LABEL[action]!, actor);
    const n = NOTIFY[action];
    if (n) {
        const text = to === "scheduled" ? `${actor.name} a programmé l'article pour le ${at!.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" })}.` : n.text(actor.name, reason);
        await notify(post, action, text, n.audience, actor);
    }
    // Annoncé aux correcteurs sur Discord, après la réponse : la personne qui l'envoie n'attend pas
    if (action === "submit") inBackground(() => notifyReviewDiscord(post, actor.name));
    // Mis en ligne ou retiré : pages publiques à régénérer (article, accueil, rubriques, étiquettes, auteurs)
    if (from === "published" || to === "published") await revalidatePostPages(post);
    return { status: post.status, slug: post.slug, publishedAt: post.publishedAt?.toISOString() ?? null, scheduledAt: post.scheduledAt?.toISOString() ?? null, ...(await editorState(actor, post)) };
}

/** Boutons et mode d'édition à jour pour cette personne (après une action) */
export async function editorState(actor: Actor, post: PostDocument) {
    const ctx = await actorContext(actor, post);
    return {
        actions: allowedActions(ctx),
        mode: (can(actor.role, "post.create") || can(actor.role, "post.correct") ? editMode(ctx) : "read") as EditMode,
        corrector: post.corrector?.name ?? null,
        workflow: workflowLog(post),
    };
}

/* ─── Correcteur choisi à la main (rédaction en chef) ─── */

type CorrectorField = { member?: unknown; author?: unknown; name?: string | null; via?: string | null } | null | undefined;

/** Correcteur de l'article pour l'éditeur ; un profil relié depuis à un compte est désigné par le compte */
export async function correctorInfo(c: CorrectorField): Promise<CorrectorInfo> {
    const via = isCorrectionPlace(c?.via) ? c.via : null;
    if (c?.member) return { key: `m:${c.member}`, name: c.name ?? null, via };
    if (c?.author) {
        const m = await Member.findOne({ author: c.author }).select("_id").lean();
        return { key: m ? `m:${m._id}` : `a:${c.author}`, name: c.name ?? null, via };
    }
    return { key: null, name: null, via };
}

/**
 * Personnes qu'on peut déclarer correcteur : les comptes de l'équipe et les
 * profils déjà crédités d'une correction (anciens correcteurs sans compte).
 */
export async function correctorOptions(): Promise<{ key: string; name: string; account: boolean }[]> {
    await connectDB();
    const [members, credited] = await Promise.all([
        Member.find({ role: { $ne: "lecteur" } }).select("username author").lean(),
        Post.distinct("corrector.author", { "corrector.author": { $exists: true } }),
    ]);
    const linked = new Set(members.map((m) => String(m.author ?? "")));
    const authors = await Author.find({ _id: { $in: credited }, member: null }).select("name").lean();
    const names = new Map((await Author.find({ _id: { $in: members.map((m) => m.author).filter(Boolean) } }).select("name").lean()).map((a) => [String(a._id), a.name]));
    return [
        ...members.map((m) => ({ key: `m:${m._id}`, name: names.get(String(m.author)) || m.username, account: true })),
        ...authors.filter((a) => !linked.has(String(a._id))).map((a) => ({ key: `a:${a._id}`, name: a.name, account: false })),
    ].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/**
 * Qui choisit le correcteur : la rédaction en chef, n'importe qui ; un
 * correcteur, lui-même seulement, sur un article sans correcteur ou le sien.
 */
export function correctorEditor(actor: Pick<Actor, "role" | "memberId">, currentKey: string | null): "all" | "self" | null {
    if (can(actor.role, "post.approve")) return "all";
    if (can(actor.role, "post.correct") && (!currentKey || currentKey === `m:${actor.memberId}`)) return "self";
    return null;
}

/**
 * Change le correcteur d'un article ou le lieu de la correction (Google Docs,
 * Discord…) : pour les corrections faites hors du circuit du blog. Noté au journal.
 * Voir correctorEditor pour qui peut le faire.
 */
export async function setCorrector(id: string, actor: Actor, input: { who: string | null; via: string | null }) {
    if (!can(actor.role, "post.correct")) throw new PostError("Réservé aux correcteurs et à la rédaction en chef.", 403);
    if (input.via !== null && !isCorrectionPlace(input.via)) throw new PostError("Lieu de correction inconnu.");
    const post = await findPost(id);
    const current = await correctorInfo(post.corrector);
    const rights = correctorEditor(actor, current.key);
    if (!rights) throw new PostError("Un autre correcteur est crédité : seule la rédaction en chef peut le changer.", 403);
    if (rights === "self" && input.who && input.who !== `m:${actor.memberId}`) throw new PostError("Tu ne peux déclarer que toi-même comme correcteur.", 403);

    let next: { member?: mongoose.Types.ObjectId; author?: mongoose.Types.ObjectId; name: string } | null = null;
    if (input.who && input.who !== current.key) {
        if (post.status === "in_correction") throw new PostError("L'article est en cours de correction sur le blog : le correcteur est celui qui l'a pris.", 409);
        const [kind, ref] = input.who.split(":");
        if (!isId(ref) || (kind !== "m" && kind !== "a")) throw new PostError("Correcteur introuvable.", 404);
        const member = kind === "m" ? await Member.findById(ref).select("username author role").lean() : await Member.findOne({ author: ref }).select("username author role").lean();
        const author = kind === "a" ? await Author.findById(ref).select("name").lean() : member?.author ? await Author.findById(member.author).select("name").lean() : null;
        if (kind === "m" ? !member || member.role === "lecteur" : !author) throw new PostError("Correcteur introuvable.", 404);
        if (author && post.authors.some((a) => String(a) === String(author._id))) throw new PostError("C'est un des auteurs de l'article.");
        next = { ...(member ? { member: member._id } : {}), ...(author ? { author: author._id } : {}), name: author?.name || member!.username };
    }
    const via = (input.via ?? undefined) as CorrectionPlace | undefined;
    if (!input.who && !current.key) return { corrector: current, slug: post.slug, status: post.status };
    if (!input.who) post.set("corrector", undefined);
    else if (next) post.set("corrector", { ...next, via });
    else if (post.corrector) post.set("corrector.via", via);
    if (!post.isModified()) return { corrector: current, slug: post.slug, status: post.status };

    const info = await correctorInfo(post.corrector);
    const reason = info.name ? [info.name, info.via ? CORRECTION_PLACE_LABELS[info.via] : null].filter(Boolean).join(" · ") : "aucun";
    post.workflow.push({ action: "corrector", member: new mongoose.Types.ObjectId(actor.memberId), name: actor.name, reason, at: new Date() });
    // Un crédit n'est pas une modification de l'article : la date « Modifié » (tri des listes) ne bouge pas
    await post.save({ timestamps: false });
    return { corrector: info, slug: post.slug, status: post.status };
}

export function workflowLog(post: { workflow?: { action: string; name?: string | null; reason?: string | null; at?: Date | null; to?: string | null }[] }) {
    return (post.workflow ?? [])
        .slice(-30)
        .reverse()
        .map((w) => ({ action: w.action, text: `${w.name || "Quelqu'un"} ${ACTION_PAST[w.action as WorkflowAction] ?? w.action}`, reason: w.reason || null, to: w.to || null, at: (w.at ?? new Date()).toISOString() }));
}

/* ─── Publication programmée et corbeille (cron externe) ─── */

/** Publie les articles planifiés dont l'heure est passée. Idempotent. */
export async function publishDue(now = new Date()) {
    await connectDB();
    const due = await Post.find({ status: "scheduled", scheduledAt: { $lte: now } });
    const system: Actor = { memberId: "000000000000000000000000", role: "admin", name: "La publication programmée" };
    const slugs: string[] = [];
    for (const post of due) {
        // Mise à jour conditionnelle : deux passages simultanés ne publient pas deux fois
        const res = await Post.updateOne(
            // Toujours planifié et toujours dû : une reprogrammation faite entre-temps n'est pas écrasée
            { _id: post._id, status: "scheduled", scheduledAt: { $lte: now } },
            { $set: { status: "published", modifiedAt: now, publishedAt: post.scheduledAt ?? now }, $unset: { scheduledAt: 1 }, $push: { workflow: { action: "publish", from: "scheduled", to: "published", name: system.name, at: now } } }
        );
        if (!res.modifiedCount) continue;
        slugs.push(post.slug);
        // Article, accueil, rubriques, étiquettes et auteurs (pas seulement la page de l'article)
        await revalidatePostPages(post).catch((e) => console.error("[cron] revalidation", e));
        // Une notification ratée n'empêche ni les publications suivantes ni le rafraîchissement des pages
        await notify(post, "publish", "Ton article programmé est en ligne.", ["authors"], system).catch((e) => console.error("[cron] notification", e));
    }
    return { published: slugs.length, slugs };
}

/** Vide la corbeille (articles jetés il y a plus de 30 jours) et efface les versions de séance de plus de 30 jours */
export async function purgeTrash(now = new Date()) {
    await connectDB();
    const old = await Post.find({ status: "trash", trashedAt: { $lte: new Date(now.getTime() - 30 * 86_400_000) } }).select("_id").lean();
    return { deleted: await deleteTrashed(old.map((p) => p._id)), revisions: (await purgeRevisions(now)).deleted };
}

/** Efface des articles de la corbeille et tout ce qui s'y rattache (les images restent dans la médiathèque) */
async function deleteTrashed(ids: mongoose.Types.ObjectId[]): Promise<number> {
    // L'article d'abord, s'il est toujours à la corbeille (restauré entre-temps : rien n'est effacé) ;
    // les données liées ensuite : une coupure au milieu laisse des restes orphelins, jamais un article sans ses versions
    const deleted: mongoose.Types.ObjectId[] = [];
    for (const id of ids) {
        if (await Post.findOneAndDelete({ _id: id, status: "trash" }).select("_id").lean()) deleted.push(id);
    }
    if (!deleted.length) return 0;
    const of = { post: { $in: deleted } };
    await Promise.all([Revision.deleteMany(of), ReviewThread.deleteMany(of), Presence.deleteMany(of), Notification.deleteMany(of), Comment.deleteMany(of), Reaction.deleteMany(of)]);
    return deleted.length;
}

/**
 * Suppression définitive, sans attendre les 30 jours : Admin seulement, et
 * seulement depuis la corbeille (on ne supprime pas d'un coup un article en ligne).
 */
export async function deletePostForever(id: string, actor: Actor) {
    if (actor.role !== "admin") throw new PostError("La suppression définitive est réservée aux admins.", 403);
    const post = await findPost(id);
    if (post.status !== "trash") throw new PostError("Mets d'abord l'article à la corbeille.", 409);
    // Par précaution (l'article avait pu être en ligne) : son adresse et les listes ne gardent rien en cache
    if (await deleteTrashed([post._id])) await revalidatePostPages(post);
}

/* ─── Versions ─── */

async function assertReview(actor: Actor, post: PostDocument) {
    if (!canReview(await actorContext(actor, post))) throw new PostError("Article réservé à ses auteurs et à la relecture.", 403);
}

export async function listRevisions(id: string, actor: Actor) {
    const post = await findPost(id);
    await assertReview(actor, post);
    const revs = await Revision.find({ post: post._id }).sort({ createdAt: -1 }).limit(100).select("kind label name member createdAt words status title").lean();
    return revs.map((r) => ({ id: String(r._id), kind: revisionKind(r), label: r.label, name: r.name, member: r.member ? String(r.member) : null, at: r.createdAt.toISOString(), words: r.words, status: r.status ?? null, title: r.title }));
}

export async function getRevision(id: string, revisionId: string, actor: Actor) {
    const post = await findPost(id);
    await assertReview(actor, post);
    if (!isId(revisionId)) throw new PostError("Version introuvable.", 404);
    const r = await Revision.findOne({ _id: revisionId, post: post._id }).lean();
    if (!r) throw new PostError("Version introuvable.", 404);
    return {
        id: String(r._id),
        label: r.label,
        name: r.name,
        at: r.createdAt.toISOString(),
        title: r.title,
        contentJson: (await revisionContent(r)) as JSONContent | null,
        // Absent des versions enregistrées avant que les modules y soient gardés
        modules: Array.isArray(r.modules) ? (r.modules as unknown[]) : null,
    };
}

/** Remet une ancienne version (l'état actuel est gardé comme version, on peut revenir en arrière) */
export async function restoreRevision(id: string, revisionId: string, actor: Actor) {
    const post = await findPost(id);
    if ((await editModeFor(actor, post)) !== "edit") throw new PostError("Tu ne peux pas modifier cet article pour l'instant.", 403);
    // Vérifié avant d'écrire quoi que ce soit (sinon « Avant restauration » restait sans restauration)
    if (lockedByOther(post, actor.memberId)) throw new PostError(`${post.lock?.name || "Quelqu'un"} est en train de modifier cet article.`, 409);
    const rev = await getRevision(id, revisionId, actor);
    if (!rev.contentJson) throw new PostError("Le texte de cette version n'a pas été retrouvé : elle ne peut pas être restaurée.", 410);
    await saveRevision(post, "restore", "Avant restauration", actor);
    // La version « Avant restauration » tient lieu de séance : pas de seconde version identique
    return savePost(id, { title: rev.title, contentJson: rev.contentJson, ...(rev.modules ? { modules: rev.modules } : {}) }, actor, { skipSession: true });
}

/* ─── Discussions de relecture ─── */

function toThreadView(t: { _id: unknown; quote?: string | null; anchored?: boolean | null; resolved?: boolean | null; resolvedBy?: string | null; messages: { name: string; text: string; at?: Date | null; member?: unknown }[]; createdAt: Date }) {
    return {
        id: String(t._id),
        quote: t.quote || "",
        anchored: !!t.anchored,
        resolved: !!t.resolved,
        resolvedBy: t.resolvedBy || null,
        messages: t.messages.map((m) => ({ name: m.name, text: m.text, at: (m.at ?? t.createdAt).toISOString(), member: m.member ? String(m.member) : null })),
        createdAt: t.createdAt.toISOString(),
    };
}
export type ThreadView = ReturnType<typeof toThreadView>;

export async function listThreads(id: string, actor: Actor) {
    const post = await findPost(id);
    await assertReview(actor, post);
    const threads = await ReviewThread.find({ post: post._id }).sort({ createdAt: 1 }).lean();
    return threads.map(toThreadView);
}

const cleanText = (t: unknown) => (typeof t === "string" ? t.trim().slice(0, 2000) : "");

export async function createThread(id: string, actor: Actor, input: { text?: string; quote?: string; anchored?: boolean }) {
    const post = await findPost(id);
    await assertReview(actor, post);
    const text = cleanText(input.text);
    if (!text) throw new PostError("Écris ton commentaire.");
    const t = await ReviewThread.create({ post: post._id, quote: cleanText(input.quote).slice(0, 300), anchored: !!input.anchored, messages: [{ member: actor.memberId, name: actor.name, text }] });
    await notify(post, "comment", `${actor.name} a commenté : « ${text.slice(0, 120)} »`, ["authors", "corrector"], actor);
    return toThreadView(t.toObject());
}

export async function updateThread(id: string, threadId: string, actor: Actor, input: { text?: string; resolved?: boolean }) {
    const post = await findPost(id);
    await assertReview(actor, post);
    if (!isId(threadId)) throw new PostError("Discussion introuvable.", 404);
    const t = await ReviewThread.findOne({ _id: threadId, post: post._id });
    if (!t) throw new PostError("Discussion introuvable.", 404);
    const text = cleanText(input.text);
    if (text) t.messages.push({ member: new mongoose.Types.ObjectId(actor.memberId), name: actor.name, text, at: new Date() });
    if (typeof input.resolved === "boolean") {
        t.resolved = input.resolved;
        t.resolvedBy = input.resolved ? actor.name : undefined;
    }
    await t.save();
    // Prévenus une fois la réponse enregistrée ; les anciens messages sans membre ne comptent pas
    if (text) {
        const participants = t.messages.flatMap((m) => (m.member ? [String(m.member)] : []));
        await notify(post, "comment", `${actor.name} a répondu : « ${text.slice(0, 120)} »`, ["authors", "corrector"], actor, participants);
    }
    return toThreadView(t.toObject());
}

/* ─── Présence et verrou d'édition (§ 7.4) ─── */

export interface PresenceInput {
    /** Veut modifier (éditeur ouvert en écriture) ou seulement regarder */
    want: "edit" | "view";
    /** A tapé quelque chose depuis le dernier signal */
    active?: boolean;
    /** « Demander la main » */
    request?: boolean;
    /** « Céder la main » */
    yield?: boolean;
    /** Fermeture de l'éditeur */
    leave?: boolean;
}

/**
 * Signal de présence (toutes les 15 s). Donne ou garde la main si elle est
 * libre (ou abandonnée depuis 2 min), et renvoie qui est là.
 */
export async function heartbeat(id: string, actor: Actor, input: PresenceInput) {
    const post = await findPost(id);
    // Comme l'éditeur : auteurs, correcteur et relecture (pas un lecteur ni le brouillon d'un autre rédacteur)
    if (!input.leave) await assertReview(actor, post);
    const now = new Date();
    const me = actor.memberId;
    const mode = await editModeFor(actor, post);
    const wantsEdit = input.want === "edit" && mode !== "read";

    // Verrou et présence : ne changent pas la date de modification de l'article (colonne « Modifié »)
    if (input.leave) {
        await Presence.deleteOne({ post: post._id, member: me });
        if (post.lock?.member && String(post.lock.member) === me) await Post.updateOne({ _id: post._id, "lock.member": me }, { $unset: { lock: 1 } }, { timestamps: false });
        return null;
    }

    const lock = post.lock;
    const holder = lock?.member ? String(lock.member) : null;
    const expired = !lock?.at || now.getTime() - new Date(lock.at).getTime() >= LOCK_TTL_MS;

    if (holder === me) {
        if (input.yield) await Post.updateOne({ _id: post._id, "lock.member": me }, { $unset: { lock: 1 } }, { timestamps: false });
        else if (input.active || !wantsEdit) {
            await Post.updateOne({ _id: post._id, "lock.member": me }, wantsEdit ? { $set: { "lock.at": now } } : { $unset: { lock: 1 } }, { timestamps: false });
        }
    } else if (wantsEdit && (!holder || expired)) {
        // Prise de la main, conditionnelle pour ne pas l'arracher à quelqu'un qui vient de la prendre
        await Post.updateOne(
            { _id: post._id, $or: [{ "lock.member": { $exists: false } }, { "lock.member": null }, { "lock.at": { $lt: new Date(now.getTime() - LOCK_TTL_MS) } }, { "lock.member": lock?.member ?? null, "lock.at": lock?.at ?? null }] },
            { $set: { lock: { member: new mongoose.Types.ObjectId(me), name: actor.name, at: now } } },
            { timestamps: false }
        );
    } else if (wantsEdit && input.request && holder) {
        await Post.updateOne({ _id: post._id, "lock.member": lock!.member }, { $set: { "lock.requestedBy": { member: new mongoose.Types.ObjectId(me), name: actor.name, at: now } } }, { timestamps: false });
    }

    await Presence.updateOne({ post: post._id, member: me }, { $set: { name: actor.name, mode: wantsEdit ? "edit" : "view", at: now } }, { upsert: true });

    const [fresh, present] = await Promise.all([
        Post.findById(post._id).select("lock status updatedAt").lean(),
        Presence.find({ post: post._id, at: { $gte: new Date(now.getTime() - 45_000) } })
            .select("member name mode")
            .lean(),
    ]);
    const l = fresh?.lock;
    const lockLive = !!l?.member && !!l.at && now.getTime() - new Date(l.at).getTime() < LOCK_TTL_MS;
    // Tant que personne ne l'a reprise, la main reste à qui l'avait, même après 2 min sans activité :
    // le délai sert seulement à laisser un autre la prendre (sinon l'éditeur passait en lecture seule
    // en pleine rédaction, sans pouvoir en sortir puisque seule une modification relançait le verrou)
    const mine = wantsEdit && !!l?.member && String(l.member) === me;
    return {
        mine,
        holder: lockLive || mine ? (l!.name ?? null) : null,
        requestedBy: mine && l!.requestedBy?.member ? (l!.requestedBy.name ?? null) : null,
        status: fresh?.status ?? post.status,
        updatedAt: fresh?.updatedAt ? new Date(fresh.updatedAt).toISOString() : null,
        people: present.filter((p) => String(p.member) !== me).map((p) => ({ name: p.name, editing: lockLive && String(p.member) === String(l!.member) })),
    };
}

/** Qui a quels articles ouverts (liste des articles) */
export async function presenceByPost(postIds: string[]) {
    await connectDB();
    const rows = await Presence.find({ post: { $in: postIds }, at: { $gte: new Date(Date.now() - 45_000) } })
        .select("post name mode")
        .lean();
    const out = new Map<string, { name: string; editing: boolean }[]>();
    for (const r of rows) {
        const key = String(r.post);
        out.set(key, [...(out.get(key) ?? []), { name: r.name, editing: r.mode === "edit" }]);
    }
    return out;
}

/* ─── Notifications ─── */

export async function listNotifications(actor: Actor, limit = 50) {
    await connectDB();
    const [items, unread] = await Promise.all([Notification.find({ to: actor.memberId }).sort({ createdAt: -1 }).limit(limit).lean(), Notification.countDocuments({ to: actor.memberId, read: false })]);
    return {
        unread,
        items: items.map((n) => ({ id: String(n._id), type: n.type, text: n.text, by: n.by, postId: n.post ? String(n.post) : null, postTitle: n.postTitle, read: n.read, at: n.createdAt.toISOString() })),
    };
}

export async function unreadCount(memberId: string) {
    await connectDB();
    return Notification.countDocuments({ to: memberId, read: false });
}

export async function markNotificationsRead(actor: Actor, ids?: string[]) {
    await connectDB();
    const filter: Record<string, unknown> = { to: actor.memberId, read: false };
    if (ids?.length) filter._id = { $in: ids.filter(isId) };
    await Notification.updateMany(filter, { $set: { read: true } });
}

/* ─── Coup de cœur d'un rédacteur invité (§ 9) ─── */

export interface InvitationView {
    postId: string;
    postTitle: string;
    postStatus: string;
    authors: string[];
    moduleId: string;
    data: GuestFavoriteData;
    locked: boolean;
}

const GUEST_LOCKED = ["published", "scheduled", "trash"];

/** Les coups de cœur qu'on m'a demandé d'écrire */
export async function listInvitations(actor: Actor): Promise<InvitationView[]> {
    await connectDB();
    const posts = await Post.find({ "modules.data.guest.memberId": actor.memberId, status: { $ne: "trash" } })
        .select("title status modules authors")
        .populate("authors", "name")
        .sort({ updatedAt: -1 })
        .lean();
    return posts.flatMap((p) =>
        ((p.modules ?? []) as ArticleModule[])
            .filter((m): m is Extract<ArticleModule, { type: "guestFavorite" }> => m.type === "guestFavorite" && m.data.guest?.memberId === actor.memberId)
            .map((m) => ({
                postId: String(p._id),
                postTitle: p.title,
                postStatus: p.status,
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- auteurs peuplés */
                authors: (p.authors as any[]).filter(Boolean).map((a) => a.name as string),
                moduleId: m.id,
                data: m.data,
                locked: GUEST_LOCKED.includes(p.status),
            }))
    );
}

/** L'invité écrit son texte, le valide, ou retire sa contribution (avant la publication) */
export async function guestEdit(postId: string, moduleId: string, actor: Actor, input: Record<string, unknown>) {
    const post = await findPost(postId);
    const modules = (post.modules ?? []) as ArticleModule[];
    const idx = modules.findIndex((m) => m.id === moduleId && m.type === "guestFavorite" && m.data.guest?.memberId === actor.memberId);
    if (idx < 0) throw new PostError("Invitation introuvable.", 404);
    if (GUEST_LOCKED.includes(post.status)) throw new PostError("L'article est déjà publié (ou programmé) : ton coup de cœur ne peut plus changer.", 409);
    const mod = modules[idx] as Extract<ArticleModule, { type: "guestFavorite" }>;
    const myAuthor = await ensureAuthor(actor.memberId);

    if (input.withdraw === true) {
        modules[idx] = { ...mod, data: { ...mod.data, guest: null, why: "", status: "draft", validatedAt: null } };
        post.set("modules", modules);
        post.set("contributors", (post.contributors ?? []).filter((c) => String(c) !== String(myAuthor)));
        await post.save();
        await notify(post, "invitation", `${actor.name} a retiré son coup de cœur de ton article.`, ["authors"], actor);
        return null;
    }

    let data: GuestFavoriteData;
    try {
        data = applyGuestEdit(mod.data, input);
    } catch (e) {
        throw new PostError((e as Error).message);
    }
    modules[idx] = { ...mod, data };
    post.set("modules", modules);
    // Crédité comme contributeur de l'article (encadré auteur, page auteur)
    if (data.status === "validated" && !(post.contributors ?? []).some((c) => String(c) === String(myAuthor))) post.contributors.push(myAuthor);
    await post.save();
    if (data.status === "validated") await notify(post, "invitation", `${actor.name} a validé son coup de cœur.`, ["authors"], actor);
    return { moduleId, data };
}

/** Auteur d'un membre (lien du coup de cœur externe vers sa page auteur) */
export async function authorSlugOfMember(memberId: string): Promise<string | null> {
    await connectDB();
    const a = await Author.findOne({ member: memberId }).select("slug").lean();
    return a?.slug ?? null;
}

/* ─── Calendrier : reprogrammer (§ 7.3) ─── */

/** Nouvelle date d'un article planifié (glisser-déposer du calendrier). Réd. en chef, Admin. */
export async function reschedule(id: string, at: string, actor: Actor) {
    if (!can(actor.role, "post.publish")) throw new PostError("Seuls le Rédacteur en chef et les Admins planifient.", 403);
    const post = await findPost(id);
    if (post.status !== "scheduled") throw new PostError("Seul un article planifié peut changer de date.", 409);
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) throw new PostError("Date invalide.");
    if (date.getTime() < Date.now() + 60_000) throw new PostError("Choisis une date à venir (pour publier tout de suite, ouvre l'article).", 422);
    post.scheduledAt = date;
    post.publishedAt = date;
    post.workflow.push({ action: "reschedule", from: "scheduled", to: "scheduled", member: new mongoose.Types.ObjectId(actor.memberId), name: actor.name, at: new Date() });
    // Publié entre-temps par le cron : pas de date future sur un article en ligne (il serait en 404)
    post.$where = { status: "scheduled" };
    await post.save();
    const when = date.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" });
    await notify(post, "reschedule", `${actor.name} a reprogrammé l'article pour le ${when}.`, ["authors"], actor);
    return { scheduledAt: date.toISOString() };
}
