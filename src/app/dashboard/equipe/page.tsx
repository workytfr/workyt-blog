import Link from "next/link";
import { FileCheck, SpellCheck, UserPlus, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { getBlogSession } from "@/lib/auth";
import { can, ROLE_LABELS, type Role } from "@/lib/roles";
import { connectDB } from "@/lib/db";
import { avatarSrc } from "@/lib/avatar";
import { relativeDate } from "@/lib/format";
import Member from "@/models/Member";
import Post from "@/models/Post";
import RoleChange from "@/models/RoleChange";
import TeamManager from "./TeamManager";

type Props = { searchParams: Promise<{ q?: string; vue?: string; page?: string }> };

const PER_PAGE = 50;
const daysAgo = (n: number) => new Date(new Date().getTime() - n * 86_400_000);

/**
 * Équipe (§ 6, § 13) : rôles des comptes Workyt, journal des changements.
 * « L'équipe » : les comptes qui ont un rôle ; « Tous les comptes » : aussi
 * les lecteurs, des plus récemment venus aux plus anciens, pour donner un
 * rôle sans deviner le pseudo exact.
 */
export default async function TeamPage({ searchParams }: Props) {
    const session = (await getBlogSession())!;
    if (!can(session.user.role, "team.manage")) notFound();
    const sp = await searchParams;
    const query = sp.q?.trim();
    const all = sp.vue === "tous";
    const page = Math.max(1, Number.parseInt(sp.page || "1", 10) || 1);
    await connectDB();
    const filter = {
        // Par pseudo, adresse e-mail ou note (prénom, pseudo Discord…)
        ...(query ? { $or: ["username", "email", "note"].map((f) => ({ [f]: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } })) } : {}),
        ...(all || query ? {} : { role: { $ne: "lecteur" } }),
    };
    const month = daysAgo(30);
    const [members, total, teamCount, allCount, log, counts, corrected, byRole, publishedMonth, correctedMonth, newMembers] = await Promise.all([
        Member.find(filter)
            .sort(all ? { lastLoginAt: -1, username: 1 } : { role: 1, username: 1 })
            .skip(all ? (page - 1) * PER_PAGE : 0)
            .limit(all ? PER_PAGE : 100)
            .lean(),
        Member.countDocuments(filter),
        Member.countDocuments({ role: { $ne: "lecteur" } }),
        Member.estimatedDocumentCount(),
        RoleChange.find({}).sort({ createdAt: -1 }).limit(20).lean(),
        Post.aggregate<{ _id: unknown; n: number }>([{ $match: { status: "published" } }, { $unwind: "$authors" }, { $group: { _id: "$authors", n: { $sum: 1 } } }]),
        // Articles publiés passés par la correction, par correcteur
        Post.aggregate<{ _id: unknown; n: number }>([{ $match: { status: "published", "corrector.member": { $exists: true } } }, { $group: { _id: "$corrector.member", n: { $sum: 1 } } }]),
        Member.aggregate<{ _id: Role; n: number }>([{ $match: { role: { $ne: "lecteur" } } }, { $group: { _id: "$role", n: { $sum: 1 } } }]),
        Post.countDocuments({ status: "published", publishedAt: { $gte: month, $lte: new Date() } }),
        Post.countDocuments({ status: "published", publishedAt: { $gte: month, $lte: new Date() }, "corrector.member": { $exists: true } }),
        Member.countDocuments({ createdAt: { $gte: month } }),
    ]);
    const byCorrector = new Map(corrected.map((c) => [String(c._id), c.n]));
    const roleCount = (r: Role) => byRole.find((x) => x._id === r)?.n ?? 0;
    const correctedTotal = corrected.reduce((sum, c) => sum + c.n, 0);
    const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
    const cards = [
        {
            icon: Users,
            tone: "text-accentdark",
            value: teamCount,
            label: "Membres de l'équipe",
            sub: [plural(roleCount("redacteur"), "rédacteur", "rédacteurs"), plural(roleCount("correcteur"), "correcteur", "correcteurs"), plural(roleCount("redac_chef") + roleCount("admin"), "responsable", "responsables")].join(" · "),
        },
        { icon: FileCheck, tone: "text-[#1f6f96]", value: publishedMonth, label: "Articles publiés", sub: "ces 30 derniers jours" },
        { icon: SpellCheck, tone: "text-violet-700", value: correctedTotal, label: "Articles corrigés", sub: `dont ${correctedMonth} ces 30 derniers jours` },
        { icon: UserPlus, tone: "text-[#2f6e14]", value: newMembers, label: "Nouveaux comptes", sub: `ces 30 jours · ${allCount} au total` },
    ];
    const pages = all ? Math.max(1, Math.ceil(total / PER_PAGE)) : 1;
    const href = (o: { vue?: boolean; page?: number }) => {
        const p = new URLSearchParams();
        if (o.vue) p.set("vue", "tous");
        if (query) p.set("q", query);
        if (o.page && o.page > 1) p.set("page", String(o.page));
        const s = p.toString();
        return `/dashboard/equipe/${s ? `?${s}` : ""}`;
    };
    const byAuthor = new Map(counts.map((c) => [String(c._id), c.n]));

    return (
        <main className="min-w-0 flex-1 px-10 py-10">
            <div className="mx-auto max-w-5xl">
                <p className="eyebrow">Gestion</p>
                <h1 className="mt-1 font-display text-5xl">Équipe</h1>
                <p className="mt-2 max-w-2xl text-ink/60">
                    {session.user.role === "admin" ? "Tu peux nommer ou retirer le Rédacteur en chef." : "Tu donnes ou retires les rôles Rédacteur et Correcteur."} Un compte apparaît ici après sa première connexion au blog avec « Se connecter avec
                    Workyt ».
                </p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {cards.map((c) => (
                        <div key={c.label} className="rounded-[24px] border border-ink/10 bg-white p-6">
                            <c.icon className={`h-5 w-5 ${c.tone}`} />
                            <p className="mt-3 font-display text-4xl leading-none">{c.value}</p>
                            <p className="mt-1 text-sm font-semibold text-ink/70">{c.label}</p>
                            <p className="mt-0.5 text-xs text-ink/45">{c.sub}</p>
                        </div>
                    ))}
                </div>
                <div className="mt-8 flex w-fit gap-1 rounded-full border border-ink/10 bg-white p-1 text-sm font-semibold">
                    <Link href={href({})} className={`rounded-full px-3.5 py-1.5 ${!all ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}>
                        L&apos;équipe ({teamCount})
                    </Link>
                    <Link href={href({ vue: true })} className={`rounded-full px-3.5 py-1.5 ${all ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}>
                        Tous les comptes ({allCount})
                    </Link>
                </div>
                <TeamManager
                    query={query ?? ""}
                    view={all ? "tous" : "equipe"}
                    me={{ id: session.user.memberId, role: session.user.role as Role }}
                    members={members.map((m) => ({
                        id: String(m._id),
                        name: m.username,
                        email: m.email || null,
                        note: m.note || "",
                        role: m.role as Role,
                        avatar: avatarSrc({ avatarUrl: m.avatarUrl, workytId: m.workytId, seed: m.username }),
                        published: m.author ? (byAuthor.get(String(m.author)) ?? 0) : 0,
                        corrected: byCorrector.get(String(m._id)) ?? 0,
                        lastLogin: m.lastLoginAt ? relativeDate(m.lastLoginAt) : null,
                    }))}
                />
                {pages > 1 && (
                    <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-ink/50">
                            Page {page} sur {pages} · {total} comptes
                        </span>
                        <span className="flex gap-2">
                            {page > 1 && (
                                <Link href={href({ vue: true, page: page - 1 })} className="btn-ghost px-4 py-2">
                                    Précédente
                                </Link>
                            )}
                            {page < pages && (
                                <Link href={href({ vue: true, page: page + 1 })} className="btn-ghost px-4 py-2">
                                    Suivante
                                </Link>
                            )}
                        </span>
                    </div>
                )}
                <h2 className="mt-10 font-display text-2xl">Journal</h2>
                {log.length === 0 ? (
                    <p className="mt-3 text-sm text-ink/50">Aucun changement de rôle pour l&apos;instant.</p>
                ) : (
                    <ul className="mt-3 divide-y divide-ink/5 overflow-hidden rounded-[22px] border border-ink/10 bg-white text-sm">
                        {log.map((l) => (
                            <li key={String(l._id)} className="flex items-center gap-3 px-5 py-3">
                                <span className="min-w-0 flex-1">
                                    <b>{l.byName || "Quelqu'un"}</b> a fait passer <b>{l.memberName}</b> de {ROLE_LABELS[l.from as Role] ?? l.from} à <b>{ROLE_LABELS[l.to as Role] ?? l.to}</b>
                                </span>
                                <span className="text-xs text-ink/45">{relativeDate(l.createdAt)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </main>
    );
}
