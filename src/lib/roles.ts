/**
 * Rôles du blog et ce qu'ils permettent (cahier des charges § 6).
 *
 * - Aucun Rédacteur ne publie seul : le Rédacteur en chef ou un Admin approuve.
 * - Le Rédacteur en chef gère la rédaction (Rédacteurs, Correcteurs).
 * - L'Admin nomme ou retire le Rédacteur en chef.
 * - Un Admin de workyt.fr est automatiquement Admin du blog.
 */

export const ROLES = ["lecteur", "redacteur", "correcteur", "redac_chef", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
    lecteur: "Lecteur",
    redacteur: "Rédacteur",
    correcteur: "Correcteur",
    redac_chef: "Rédacteur en chef",
    admin: "Admin",
};

export type Action =
    | "comment"
    | "post.create"
    | "post.submit"
    | "post.correct"
    | "post.approve"
    | "post.publish"
    | "post.editPublished"
    | "taxonomy.manage"
    | "media.manageAll"
    | "comment.moderate"
    | "dashboard.access"
    | "settings.manage"
    | "links.manage"
    | "calendar.view"
    | "team.manage"
    | "stats.view"
    | "redirects.manage"
    | "social.export";

const MATRIX: Record<Action, Role[]> = {
    comment: ["lecteur", "redacteur", "correcteur", "redac_chef", "admin"],
    "post.create": ["redacteur", "correcteur", "redac_chef", "admin"],
    "post.submit": ["redacteur", "correcteur", "redac_chef", "admin"],
    "post.correct": ["correcteur", "redac_chef", "admin"],
    "post.approve": ["redac_chef", "admin"],
    "post.publish": ["redac_chef", "admin"],
    "post.editPublished": ["redac_chef", "admin"],
    "taxonomy.manage": ["redac_chef", "admin"],
    "media.manageAll": ["redac_chef", "admin"],
    "comment.moderate": ["correcteur", "redac_chef", "admin"],
    "dashboard.access": ["redacteur", "correcteur", "redac_chef", "admin"],
    "settings.manage": ["admin"],
    "links.manage": ["redac_chef", "admin"],
    "calendar.view": ["redac_chef", "admin"],
    "team.manage": ["redac_chef", "admin"],
    "stats.view": ["redac_chef", "admin"],
    "redirects.manage": ["admin"],
    /** Carrousels Instagram / LinkedIn des articles */
    "social.export": ["redac_chef", "admin"],
};

export function can(role: Role | null | undefined, action: Action): boolean {
    return !!role && MATRIX[action].includes(role);
}

export function isRole(value: unknown): value is Role {
    return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Qui peut donner quel rôle. Renvoie un message d'erreur, ou null si permis.
 * - Le Rédacteur en chef : Lecteur ↔ Rédacteur ↔ Correcteur.
 * - L'Admin : tout, y compris nommer ou retirer le Rédacteur en chef.
 * - Personne ne change son propre rôle ; le rôle Admin vient de workyt.fr.
 */
export function canAssignRole(actor: { id: string; role: Role }, target: { id: string; role: Role }, next: Role): string | null {
    if (actor.id === target.id) return "On ne peut pas changer son propre rôle.";
    if (next === "admin" || target.role === "admin") return "Le rôle Admin se gère sur workyt.fr.";
    if (actor.role === "admin") return null;
    if (actor.role === "redac_chef") {
        const team: Role[] = ["lecteur", "redacteur", "correcteur"];
        if (!team.includes(target.role) || !team.includes(next)) {
            return "Seul un Admin nomme ou retire le Rédacteur en chef.";
        }
        return null;
    }
    return "Action réservée au Rédacteur en chef et aux Admins.";
}

/** Rôle du blog à la première connexion, selon le rôle sur workyt.fr */
export function initialRole(workytRole: string | null | undefined): Role {
    return workytRole === "Admin" ? "admin" : "lecteur";
}
