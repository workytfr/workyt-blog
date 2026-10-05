import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBlogSession } from "@/lib/auth";
import { can, ROLE_LABELS } from "@/lib/roles";
import { listInvitations, unreadCount } from "@/lib/review";
import { avatarSrc } from "@/lib/avatar";
import { connectDB } from "@/lib/db";
import Member from "@/models/Member";
import Post from "@/models/Post";
import Category from "@/models/Category";
import DashboardNav from "./DashboardNav";
import TopBar from "./TopBar";
import ForceLight from "@/components/ForceLight";
import { pendingCommentCount } from "@/lib/comments";

export const metadata: Metadata = { title: "Rédaction", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Coque du tableau de bord (§ 13.1) : barre latérale, barre du haut, contrôle d'accès */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await getBlogSession();
    if (!session?.user) redirect("/connexion/?callbackUrl=/dashboard/");
    const role = session.user.role;
    if (!can(role, "dashboard.access")) {
        return (
            <main className="grid min-h-screen place-items-center bg-paper p-8 text-center">
                <div>
                    <h1 className="font-display text-4xl">Espace réservé à la rédaction</h1>
                    <p className="mt-3 text-ink/60">Ton compte est « {ROLE_LABELS[role]} ». Pour écrire sur le blog, demande à la rédactrice en chef.</p>
                    <Link href="/" className="btn-ink mt-6 px-5 py-2.5 text-sm">
                        Retour au blog
                    </Link>
                </div>
            </main>
        );
    }

    await connectDB();
    const actor = { memberId: session.user.memberId, role, name: session.user.name || "" };
    const [unread, invitations, me, categories] = await Promise.all([
        unreadCount(session.user.memberId),
        // Coups de cœur qu'on m'a demandé d'écrire et pas encore validés
        listInvitations(actor).then((l) => l.filter((i) => !i.locked && i.data.status !== "validated").length),
        Member.findById(session.user.memberId).select("avatarUrl workytId username author").lean(),
        Category.find({ parent: null }).sort({ order: 1, name: 1 }).select("slug name color").lean(),
    ]);
    const correction = can(role, "post.correct") ? await Post.countDocuments({ status: "pending_correction", authors: { $ne: me?.author ?? null } }) : 0;
    const comments = can(role, "comment.moderate") ? await pendingCommentCount() : 0;

    return (
        <div className="flex min-h-screen bg-paper">
            <ForceLight />
            <DashboardNav
                can={{
                    calendar: can(role, "calendar.view"),
                    correction: can(role, "post.correct"),
                    comments: can(role, "comment.moderate"),
                    taxonomy: can(role, "taxonomy.manage"),
                    team: can(role, "team.manage"),
                    redirects: can(role, "redirects.manage"),
                    stats: can(role, "stats.view"),
                    settings: can(role, "settings.manage"),
                }}
                badges={{ notifications: unread, invitations, correction, comments }}
                categories={categories.map((c) => ({ slug: c.slug, name: c.name, color: c.color || "#ff6a1a" }))}
                me={{ name: session.user.name || "", role: ROLE_LABELS[role], avatar: avatarSrc({ avatarUrl: me?.avatarUrl, workytId: me?.workytId, seed: me?.username || "membre" }) }}
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <TopBar canWrite={can(role, "post.create")} />
                <div className="flex min-w-0 flex-1">{children}</div>
            </div>
        </div>
    );
}
