import { createHash } from "crypto";

/**
 * Règles des versions d'un article, sans base de données (testées à part) :
 * - une version de séance par personne qui s'y met (ou toutes les 30 min) ;
 * - séances effacées après 30 jours, 50 au plus par article ;
 * - étapes du circuit (envoyé, validé, publié…) et restaurations gardées pour toujours ;
 * - un texte identique à la version précédente n'est pas recopié.
 */

export type RevisionKind = "session" | "step" | "restore";

export const SESSION_GAP_MS = 30 * 60_000;
export const SESSION_TTL_DAYS = 30;
export const MAX_SESSIONS_PER_POST = 50;

const SESSION_LABEL = "Avant les modifications de ";
export const sessionLabel = (name: string) => `${SESSION_LABEL}${name}`;

/** Nature d'une version (les plus anciennes n'ont pas le champ : on la déduit du libellé) */
export function revisionKind(r: { kind?: string | null; label?: string | null }): RevisionKind {
    if (r.kind === "session" || r.kind === "step" || r.kind === "restore") return r.kind;
    if (r.label?.startsWith(SESSION_LABEL)) return "session";
    return r.label === "Avant restauration" ? "restore" : "step";
}

/** Filtre MongoDB des versions de séance (anciennes comprises) */
export const SESSION_FILTER = { $or: [{ kind: "session" }, { kind: { $exists: false }, label: { $regex: `^${SESSION_LABEL}` } }] };

/**
 * Faut-il une nouvelle version de séance avant d'enregistrer ce que
 * `memberId` a modifié ? Oui si la dernière version n'est pas sa séance en
 * cours : après une étape, la première modification ouvre une séance, pour
 * savoir qui a changé quoi.
 */
export function needsSession(last: { kind?: string | null; label?: string | null; member?: unknown; createdAt: Date } | null, memberId: string, now = Date.now()): boolean {
    return !last || revisionKind(last) !== "session" || String(last.member) !== memberId || now - last.createdAt.getTime() > SESSION_GAP_MS;
}

/** Empreinte du titre et du texte (l'ordre des clés du document est stable : il vient de l'éditeur) */
export function contentHash(title: string | null | undefined, contentJson: unknown): string {
    return createHash("sha1")
        .update(JSON.stringify([title ?? "", contentJson ?? null]))
        .digest("hex");
}

export const sessionCutoff = (now = new Date()) => new Date(now.getTime() - SESSION_TTL_DAYS * 86_400_000);
