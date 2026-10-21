import "server-only";
import { notFound, redirect } from "next/navigation";
import { getBlogSession } from "./auth";
import { can } from "./roles";
import type { Actor } from "./posts";

/**
 * Contrôle d'accès en tête de chaque page du dashboard : le layout le fait
 * déjà, mais une page ne doit jamais compter sur lui seul (rendu parallèle,
 * réutilisation ailleurs). Pas connecté → connexion ; sans le droit → 404.
 */
export async function requireDashboard() {
    const session = await getBlogSession();
    if (!session?.user?.memberId) redirect("/connexion/?callbackUrl=/dashboard/");
    if (!can(session.user.role, "dashboard.access")) notFound();
    return session;
}

/** Même contrôle, sous la forme utilisée par les services */
export async function requireDashboardActor(): Promise<Actor> {
    const s = await requireDashboard();
    return { memberId: s.user.memberId, role: s.user.role, name: s.user.name || "" };
}
