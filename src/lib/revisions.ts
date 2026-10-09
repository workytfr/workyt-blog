import "server-only";
import type mongoose from "mongoose";
import type { JSONContent } from "@tiptap/core";
import { connectDB } from "./db";
import { documentText } from "@/editor/html";
import { contentHash, MAX_SESSIONS_PER_POST, SESSION_FILTER, sessionCutoff, type RevisionKind } from "./revisionRules";
import Revision from "@/models/Revision";

interface Snapshotable {
    _id: mongoose.Types.ObjectId;
    title: string;
    excerpt?: string | null;
    contentJson?: unknown;
    status?: string | null;
}

/**
 * Garde l'état actuel de l'article comme version. Une séance dont le texte
 * est identique à une étape ou une restauration n'en recopie pas le contenu
 * (elle pointe dessus) ; au-delà de 50 séances, les plus anciennes partent.
 */
export async function saveRevision(post: Snapshotable, kind: RevisionKind, label: string, actor: { memberId?: string; name: string }) {
    if (!post.contentJson) return;
    const hash = contentHash(post.title, post.contentJson);
    // Seulement vers une version gardée pour toujours : une séance effacée ne laisse pas de version orpheline
    const same = kind === "session" ? await Revision.findOne({ post: post._id, hash, kind: { $in: ["step", "restore"] } }).select("_id").lean() : null;
    await Revision.create({
        post: post._id,
        kind,
        title: post.title,
        excerpt: post.excerpt ?? "",
        ...(same ? { sameAs: same._id } : { contentJson: post.contentJson }),
        hash,
        status: post.status,
        label,
        member: actor.memberId,
        name: actor.name,
        words: documentText(post.contentJson as JSONContent).split(" ").filter(Boolean).length,
    });
    if (kind === "session") {
        const extra = await Revision.find({ post: post._id, ...SESSION_FILTER })
            .sort({ createdAt: -1 })
            .skip(MAX_SESSIONS_PER_POST)
            .select("_id")
            .lean();
        if (extra.length) await Revision.deleteMany({ _id: { $in: extra.map((r) => r._id) } });
    }
}

/** Texte d'une version (celui de la version identique quand il n'a pas été recopié) */
export async function revisionContent(r: { contentJson?: unknown; sameAs?: mongoose.Types.ObjectId | null }): Promise<unknown> {
    if (r.contentJson || !r.sameAs) return r.contentJson ?? null;
    return (await Revision.findById(r.sameAs).select("contentJson").lean())?.contentJson ?? null;
}

/** Efface les versions de séance de plus de 30 jours (cron de nuit). Les étapes restent. */
export async function purgeRevisions(now = new Date()) {
    await connectDB();
    const { deletedCount } = await Revision.deleteMany({ ...SESSION_FILTER, createdAt: { $lt: sessionCutoff(now) } });
    return { deleted: deletedCount };
}
