import Link from "next/link";
import { notFound } from "next/navigation";
import { Flag, MessageSquareWarning } from "lucide-react";
import { getBlogSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { moderationQueue } from "@/lib/comments";
import { relativeDate } from "@/lib/format";
import ModerationActions from "./ModerationActions";

const VIEWS = [
    ["pending", "À modérer"],
    ["published", "Publiés"],
    ["rejected", "Refusés"],
] as const;
type View = (typeof VIEWS)[number][0];

/**
 * Modération des commentaires (§ 11) : premiers commentaires d'un compte,
 * commentaires avec un lien ou des coordonnées, commentaires signalés.
 */
export default async function CommentsModerationPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
    const session = (await getBlogSession())!;
    if (!can(session.user.role, "comment.moderate")) notFound();
    const asked = (await searchParams).vue;
    const vue: View = VIEWS.find(([k]) => k === asked)?.[0] ?? "pending";
    const items = await moderationQueue(vue);

    return (
        <main className="min-w-0 flex-1 px-10 py-10">
            <div className="mx-auto max-w-4xl">
                <p className="eyebrow">Rédaction</p>
                <h1 className="mt-1 font-display text-5xl">Commentaires</h1>
                <p className="mt-2 text-sm text-ink/55">
                    Le premier commentaire d&apos;un compte attend ta validation ; ensuite, les siens sont publiés directement. Un lien externe, des coordonnées ou un signalement renvoient
                    ici.
                </p>

                <div className="mt-6 flex gap-1 rounded-full border border-ink/10 bg-white p-1 text-sm font-semibold" role="tablist">
                    {VIEWS.map(([k, label]) => (
                        <Link key={k} href={`/dashboard/commentaires/?vue=${k}`} role="tab" aria-selected={vue === k} className={`rounded-full px-4 py-1.5 ${vue === k ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}>
                            {label}
                        </Link>
                    ))}
                </div>

                {items.length === 0 ? (
                    <p className="mt-6 rounded-[22px] border border-dashed border-ink/15 bg-white p-8 text-center text-sm text-ink/50">{vue === "pending" ? "Rien à modérer. 🎉" : "Aucun commentaire ici."}</p>
                ) : (
                    <ul className="mt-6 space-y-3">
                        {items.map((c) => (
                            <li key={c.id} className="rounded-[22px] border border-ink/10 bg-white p-5">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- avatars workyt.fr ou Blobatar */}
                                    <img src={c.avatar} alt="" className="h-8 w-8 rounded-full bg-paper2 object-cover" />
                                    <b>{c.name}</b>
                                    <span className="text-ink/45">{relativeDate(c.createdAt)}</span>
                                    <span className="text-ink/45">
                                        {c.isReply ? "a répondu sur" : "sur"}{" "}
                                        {c.post.slug ? (
                                            <Link href={`/${c.post.slug}/#commentaires`} target="_blank" className="font-semibold text-ink/70 underline underline-offset-2 hover:text-ink">
                                                {c.post.title}
                                            </Link>
                                        ) : (
                                            c.post.title
                                        )}
                                    </span>
                                </div>
                                {(c.reasons.length > 0 || c.reports > 0) && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {c.reasons.map((r) => (
                                            <span key={r} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${r === "signalé" ? "bg-red-50 text-red-700" : "bg-sun/25 text-[#8a560a]"}`}>
                                                {r === "signalé" ? <Flag className="h-3 w-3" /> : <MessageSquareWarning className="h-3 w-3" />}
                                                {r === "signalé" ? `signalé${c.reports > 1 ? ` ${c.reports} fois` : ""}` : r}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <p className="mt-3 whitespace-pre-line break-words rounded-2xl bg-paper px-4 py-3 text-[15px] leading-relaxed">{c.text}</p>
                                <ModerationActions id={c.id} status={c.status} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </main>
    );
}
