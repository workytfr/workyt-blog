import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MessageSquare, PenLine } from "lucide-react";
import { getBlogSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { connectDB } from "@/lib/db";
import { relativeDate } from "@/lib/format";
import Post from "@/models/Post";
import Member from "@/models/Member";
import "@/models/Author";

/** File de correction (§ 13) : articles en attente, et mes corrections en cours */
export default async function CorrectionPage() {
    const session = (await getBlogSession())!;
    if (!can(session.user.role, "post.correct")) notFound();
    await connectDB();
    const me = await Member.findById(session.user.memberId).select("author").lean();
    const fields = "title updatedAt workflow authors pendingSuggestions featuredImage";
    const [queue, mine, done] = await Promise.all([
        Post.find({ status: "pending_correction", authors: { $ne: me?.author ?? null } }).select(fields).sort({ updatedAt: 1 }).populate("authors", "name").lean(),
        Post.find({ status: "in_correction", "corrector.member": session.user.memberId }).select(fields).sort({ updatedAt: -1 }).populate("authors", "name").lean(),
        Post.find({ "corrector.member": session.user.memberId, status: { $in: ["to_revise", "pending_approval", "scheduled", "published"] } })
            .select("title status updatedAt")
            .sort({ updatedAt: -1 })
            .limit(8)
            .lean(),
    ]);

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- auteurs peuplés */
    const names = (p: { authors: any[] }) => p.authors.filter(Boolean).map((a) => a.name).join(", ");
    const submittedAt = (p: { workflow?: { action: string; at?: Date | null }[]; updatedAt?: Date }) => [...(p.workflow ?? [])].reverse().find((w) => w.action === "submit")?.at ?? p.updatedAt;

    const Card = ({ p, cta }: { p: (typeof queue)[number]; cta: string }) => (
        <Link href={`/dashboard/articles/${p._id}/`} className="flex items-center gap-4 rounded-[22px] border border-ink/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-ink/20">
            <span className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-paper2">
                {/* eslint-disable-next-line @next/next/no-img-element -- vignette */}
                {p.featuredImage?.url && <img src={p.featuredImage.url} alt="" className="h-full w-full object-cover" />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.title}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-ink/50">
                    <span>par {names(p as never) || "—"}</span>
                    <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> envoyé {relativeDate(submittedAt(p) as Date)}
                    </span>
                    {(p.pendingSuggestions ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> {p.pendingSuggestions} suggestion{(p.pendingSuggestions ?? 0) > 1 ? "s" : ""}
                        </span>
                    )}
                </span>
            </span>
            <span className="btn-ghost shrink-0 px-4 py-2 text-sm">{cta}</span>
        </Link>
    );

    return (
        <main className="min-w-0 flex-1 px-10 py-10">
            <div className="mx-auto max-w-4xl">
                <p className="eyebrow">Rédaction</p>
                <h1 className="mt-1 font-display text-5xl">Correction</h1>

                <h2 className="mt-8 flex items-center gap-2 font-display text-2xl">
                    <PenLine className="h-5 w-5 text-accent" /> Mes corrections en cours <span className="text-base text-ink/45">({mine.length})</span>
                </h2>
                <div className="mt-3 space-y-2.5">{mine.length ? mine.map((p) => <Card key={String(p._id)} p={p} cta="Continuer" />) : <p className="rounded-[22px] border border-dashed border-ink/15 bg-white p-6 text-center text-sm text-ink/50">Aucune correction en cours.</p>}</div>

                <h2 className="mt-10 flex items-center gap-2 font-display text-2xl">
                    <Clock className="h-5 w-5 text-violet-600" /> En attente de correction <span className="text-base text-ink/45">({queue.length})</span>
                </h2>
                <p className="mt-1 text-sm text-ink/50">Les plus anciens d&apos;abord. Ouvre un article puis « Prendre la correction ».</p>
                <div className="mt-3 space-y-2.5">{queue.length ? queue.map((p) => <Card key={String(p._id)} p={p} cta="Ouvrir" />) : <p className="rounded-[22px] border border-dashed border-ink/15 bg-white p-6 text-center text-sm text-ink/50">La file est vide. 🎉</p>}</div>

                {done.length > 0 && (
                    <>
                        <h2 className="mt-10 font-display text-2xl">Récemment corrigés par moi</h2>
                        <ul className="mt-3 divide-y divide-ink/5 overflow-hidden rounded-[22px] border border-ink/10 bg-white text-sm">
                            {done.map((p) => (
                                <li key={String(p._id)}>
                                    <Link href={`/dashboard/articles/${p._id}/`} className="flex items-center gap-3 px-5 py-3 hover:bg-paper">
                                        <span className="min-w-0 flex-1 truncate">{p.title}</span>
                                        <span className="text-xs text-ink/45">{relativeDate(p.updatedAt as Date)}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </main>
    );
}
