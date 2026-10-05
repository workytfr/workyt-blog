import type { Role } from "./roles";

/**
 * Circuit éditorial (cahier des charges § 7) : qui peut faire quoi, à quel
 * statut. Fonctions pures, sans base de données : le service (lib/review.ts)
 * les applique, l'éditeur s'en sert pour afficher les bons boutons.
 *
 *   Brouillon ─soumettre─▶ À corriger ─prendre─▶ En correction ─valider─▶ À approuver ─approuver─▶ Planifié / Publié
 *        ▲                    │ retirer               │ renvoyer (motif)        │ refuser (motif)
 *        └────────────────────┴───────────────────────┴─▶ À réviser ─soumettre─┘─▶ Brouillon
 */

export type PostStatus = "draft" | "pending_correction" | "in_correction" | "to_revise" | "pending_approval" | "scheduled" | "published" | "unpublished" | "trash";

export type WorkflowAction = "submit" | "withdraw" | "take" | "return" | "validate" | "approve" | "refuse" | "publish" | "unschedule" | "unpublish" | "trash" | "restore";

/** Ce qu'on sait de la personne face à l'article */
export interface WorkflowContext {
    status: PostStatus;
    role: Role;
    /** Parmi les auteurs de l'article */
    isAuthor: boolean;
    /** Le correcteur qui a pris l'article */
    isCorrector: boolean;
    /** Suggestions du correcteur pas encore acceptées ni refusées */
    pendingSuggestions: number;
}

export const ACTION_LABELS: Record<WorkflowAction, string> = {
    submit: "Envoyer en correction",
    withdraw: "Retirer de la correction",
    take: "Prendre la correction",
    return: "Renvoyer au rédacteur",
    validate: "Valider la correction",
    approve: "Approuver",
    refuse: "Refuser",
    publish: "Publier",
    unschedule: "Annuler la planification",
    unpublish: "Dépublier",
    trash: "Mettre à la corbeille",
    restore: "Restaurer",
};

/** Actions qui demandent un motif écrit (§ 7.2) */
export const NEEDS_REASON: WorkflowAction[] = ["return", "refuse"];

const isChief = (role: Role) => role === "redac_chef" || role === "admin";
const canCorrect = (role: Role) => role === "correcteur" || isChief(role);
const WRITABLE: PostStatus[] = ["draft", "to_revise", "unpublished"];

interface Rule {
    from: PostStatus[];
    who: (c: WorkflowContext) => boolean;
    /** Statut d'arrivée ; « publish » et « approve » vont à « scheduled » si une date future est donnée */
    to: PostStatus;
}

const RULES: Record<WorkflowAction, Rule> = {
    submit: { from: WRITABLE, who: (c) => c.isAuthor || isChief(c.role), to: "pending_correction" },
    withdraw: { from: ["pending_correction"], who: (c) => c.isAuthor || isChief(c.role), to: "draft" },
    // On ne corrige pas son propre article (sauf la rédaction en chef)
    take: { from: ["pending_correction"], who: (c) => canCorrect(c.role) && (!c.isAuthor || isChief(c.role)), to: "in_correction" },
    return: { from: ["in_correction"], who: (c) => c.isCorrector || isChief(c.role), to: "to_revise" },
    validate: { from: ["in_correction"], who: (c) => c.isCorrector || isChief(c.role), to: "pending_approval" },
    approve: { from: ["pending_approval"], who: (c) => isChief(c.role), to: "published" },
    refuse: { from: ["pending_approval"], who: (c) => isChief(c.role), to: "draft" },
    // Raccourci de la rédaction en chef (ses propres articles, petites corrections)
    publish: { from: ["draft", "to_revise", "unpublished", "pending_correction", "in_correction"], who: (c) => isChief(c.role), to: "published" },
    unschedule: { from: ["scheduled"], who: (c) => isChief(c.role), to: "pending_approval" },
    unpublish: { from: ["published"], who: (c) => isChief(c.role), to: "unpublished" },
    trash: { from: ["draft", "to_revise", "unpublished"], who: (c) => c.isAuthor || isChief(c.role), to: "trash" },
    restore: { from: ["trash"], who: (c) => c.isAuthor || isChief(c.role), to: "draft" },
};

/** Les actions possibles pour cette personne, dans l'ordre d'affichage */
export function allowedActions(c: WorkflowContext): WorkflowAction[] {
    return (Object.keys(RULES) as WorkflowAction[]).filter((a) => RULES[a].from.includes(c.status) && RULES[a].who(c));
}

export class WorkflowError extends Error {
    constructor(
        message: string,
        public status = 400
    ) {
        super(message);
    }
}

/**
 * Statut d'arrivée d'une action, ou erreur. `at` : date de publication
 * voulue (approuver / publier) ; dans le futur, l'article est planifié.
 */
export function nextStatus(action: WorkflowAction, c: WorkflowContext, opts: { reason?: string; at?: Date | null; now?: Date } = {}): PostStatus {
    const rule = RULES[action];
    if (!rule) throw new WorkflowError("Action inconnue.");
    if (!rule.from.includes(c.status)) throw new WorkflowError("Cette action n'est pas possible à ce stade de l'article.", 409);
    if (!rule.who(c)) throw new WorkflowError("Tu n'as pas le droit de faire ça sur cet article.", 403);
    if (NEEDS_REASON.includes(action) && !opts.reason?.trim()) throw new WorkflowError("Explique en quelques mots pourquoi (le rédacteur le verra).");
    if (["validate", "approve", "publish"].includes(action) && c.pendingSuggestions > 0) {
        throw new WorkflowError(
            action === "validate"
                ? `Il reste ${c.pendingSuggestions} suggestion${c.pendingSuggestions > 1 ? "s" : ""} : renvoie l'article au rédacteur pour qu'il les accepte ou les refuse.`
                : `Il reste ${c.pendingSuggestions} suggestion${c.pendingSuggestions > 1 ? "s" : ""} à accepter ou refuser avant de publier.`,
            409
        );
    }
    if ((action === "approve" || action === "publish") && opts.at) {
        const now = opts.now ?? new Date();
        if (opts.at.getTime() > now.getTime() + 60_000) return "scheduled";
    }
    return rule.to;
}

export type EditMode = "edit" | "suggest" | "read";

/**
 * Ce que la personne peut faire du texte (§ 7.1) : le modifier, y proposer
 * des suggestions (le correcteur), ou seulement le lire et le commenter.
 */
export function editMode(c: Omit<WorkflowContext, "pendingSuggestions">): EditMode {
    switch (c.status) {
        case "draft":
        case "to_revise":
        case "unpublished":
            return c.isAuthor || isChief(c.role) ? "edit" : "read";
        case "in_correction":
            if (c.isCorrector) return "suggest";
            return isChief(c.role) ? "edit" : "read";
        case "pending_approval":
        case "scheduled":
        case "published":
            return isChief(c.role) ? "edit" : "read";
        default:
            return "read";
    }
}

/** Peut ouvrir l'article dans l'éditeur (même en lecture) et le commenter */
export function canReview(c: Omit<WorkflowContext, "pendingSuggestions">): boolean {
    return c.isAuthor || c.isCorrector || canCorrect(c.role);
}

/** Petits libellés du journal (« Camille a envoyé l'article en correction ») */
export const ACTION_PAST: Record<WorkflowAction | "reschedule", string> = {
    submit: "a envoyé l'article en correction",
    withdraw: "a retiré l'article de la correction",
    take: "a pris la correction",
    return: "a renvoyé l'article au rédacteur",
    validate: "a validé la correction",
    approve: "a approuvé l'article",
    refuse: "a refusé l'article",
    publish: "a publié l'article",
    unschedule: "a annulé la planification",
    unpublish: "a dépublié l'article",
    trash: "a mis l'article à la corbeille",
    restore: "a restauré l'article",
    reschedule: "a changé la date de publication",
};
