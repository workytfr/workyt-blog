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

type Props = { searchParams: Promise<{ q?: string }> };

/** Équipe (§ 6, § 13) : rôles des comptes Workyt, journal des changements */
export default async function TeamPage({ searchParams }: Props) {
    const session = (await getBlogSession())!;
    if (!can(session.user.role, "team.manage")) notFound();
    const { q } = await searchParams;
    await connectDB();
    const query = q?.trim();
    const filter = query ? { username: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } } : { role: { $ne: "lecteur" } };
    const [members, log, counts] = await Promise.all([
        Member.find(filter).sort({ role: 1, username: 1 }).limit(100).lean(),
        RoleChange.find({}).sort({ createdAt: -1 }).limit(20).lean(),
        Post.aggregate<{ _id: unknown; n: number }>([{ $match: { status: "published" } }, { $unwind: "$authors" }, { $group: { _id: "$authors", n: { $sum: 1 } } }]),
    ]);
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
                <TeamManager
                    query={query ?? ""}
                    me={{ id: session.user.memberId, role: session.user.role as Role }}
                    members={members.map((m) => ({
                        id: String(m._id),
                        name: m.username,
                        role: m.role as Role,
                        avatar: avatarSrc({ avatarUrl: m.avatarUrl, workytId: m.workytId, seed: m.username }),
                        published: m.author ? (byAuthor.get(String(m.author)) ?? 0) : 0,
                        lastLogin: m.lastLoginAt ? relativeDate(m.lastLoginAt) : null,
                    }))}
                />
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
