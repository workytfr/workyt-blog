/**
 * Règles des commentaires (cahier des charges § 11), sans base de données :
 * filtre anti-spam, délai de modification, limites de fréquence, réactions.
 *
 * - Réservés aux comptes Workyt connectés ; réponses sur un niveau.
 * - Premier commentaire d'un compte en attente de modération ; ensuite
 *   publiés directement. Un signalement ou le filtre remet en modération.
 */

export const COMMENT_MAX = 2000;
/** L'auteur peut modifier son commentaire pendant 15 minutes */
export const EDIT_WINDOW_MS = 15 * 60_000;
/** Au plus un commentaire toutes les 30 s, et 10 par heure */
export const MIN_INTERVAL_MS = 30_000;
export const MAX_PER_HOUR = 10;

/* ─── Filtre : liens et coordonnées (même logique que le suivi de workyt.fr) ─── */

// 06 12 34 56 78, +33 6 12 34 56 78, 0612345678…
const PHONE_FR = /(?:(?:\+|00)\s?33[\s.-]?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/;
const PHONE_INTL = /\+\d{1,3}(?:[\s.-]?\d){8,}/;
const EMAIL = /[a-z0-9._%+-]+\s?(?:@|\(at\)|\[at\]|arobase)\s?[a-z0-9.-]+\s?(?:\.|\(dot\)|point)\s?[a-z]{2,}/i;
// @pseudo (Instagram, TikTok…). Les noms de réseaux seuls restent permis : un article peut en parler.
const HANDLE = /(?:^|\s)@[a-z0-9._]{3,}/i;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s]+|\b[a-z0-9-]+\.(?:com|fr|net|org|io|be|ch|ca|info|biz|xyz|ly|gg|me|tv)\b(?:\/[^\s]*)?/gi;

const workytHost = (raw: string) => {
    try {
        const host = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase();
        return host === "workyt.fr" || host.endsWith(".workyt.fr");
    } catch {
        return false;
    }
};

/** Raisons de mettre un texte en modération (vide : publiable) */
export function commentFlags(text: string): string[] {
    const reasons: string[] = [];
    // Une adresse e-mail n'est pas aussi un lien (« gmail.com »)
    const noEmails = text.replace(new RegExp(EMAIL.source, "gi"), " ");
    const links = noEmails.match(URL_RE) ?? [];
    if (links.some((l) => !workytHost(l))) reasons.push("lien externe");
    // Les liens workyt.fr peuvent contenir des chiffres : on les retire avant de chercher des numéros
    const rest = noEmails.replace(URL_RE, " ");
    if (EMAIL.test(text)) reasons.push("adresse e-mail");
    if (PHONE_FR.test(rest) || PHONE_INTL.test(rest)) reasons.push("numéro de téléphone");
    if (HANDLE.test(rest)) reasons.push("pseudo de réseau social");
    return reasons;
}

/** Texte nettoyé : espaces de bord, trois lignes vides au plus, longueur bornée */
export function cleanCommentText(text: string): string {
    return String(text ?? "")
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
        .replace(/\n{4,}/g, "\n\n\n")
        .trim()
        .slice(0, COMMENT_MAX);
}

/** Statut d'un nouveau commentaire, et pourquoi il attend */
export function initialStatus(opts: { trusted: boolean; flags: string[] }): { status: "published" | "pending"; reasons: string[] } {
    const reasons = [...(opts.trusted ? [] : ["premier commentaire"]), ...opts.flags];
    return { status: reasons.length ? "pending" : "published", reasons };
}

/** Peut encore modifier son commentaire ? (jusqu'à quand) */
export function editableUntil(c: { createdAt: Date | string }, now = Date.now()): number | null {
    const until = new Date(c.createdAt).getTime() + EDIT_WINDOW_MS;
    return until > now ? until : null;
}

/** Message d'erreur si la personne commente trop vite (null : permis) */
export function rateLimit(opts: { lastAt: Date | null; lastHour: number; now?: number }): string | null {
    const now = opts.now ?? Date.now();
    if (opts.lastAt && now - new Date(opts.lastAt).getTime() < MIN_INTERVAL_MS) return "Doucement : attends quelques secondes avant de publier un autre commentaire.";
    if (opts.lastHour >= MAX_PER_HOUR) return "Tu as beaucoup commenté cette heure-ci : réessaie un peu plus tard.";
    return null;
}

/* ─── Réactions à l'article (« Quelle est ta réaction ? », comme sur l'ancien blog) ─── */

export const REACTIONS = [
    { key: "love", emoji: "❤️", label: "J'aime" },
    { key: "sad", emoji: "😢", label: "Triste" },
    { key: "happy", emoji: "😄", label: "Happy" },
    { key: "sleep", emoji: "😴", label: "En mode sleep" },
    { key: "angry", emoji: "😠", label: "Énervé" },
    { key: "dead", emoji: "💀", label: "Dead" },
    { key: "wink", emoji: "😉", label: "Clin d'œil" },
] as const;
export type ReactionKey = (typeof REACTIONS)[number]["key"];
export const isReaction = (v: unknown): v is ReactionKey => REACTIONS.some((r) => r.key === v);
