import Link from "next/link";
import { CalendarClock, CheckCircle2, FileClock, Images, PenLine, RotateCcw } from "lucide-react";
import { getBlogSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { connectDB } from "@/lib/db";
import { relativeDate } from "@/lib/format";
import { avatarSrc } from "@/lib/avatar";
import { STATUS_LABELS } from "@/editor/types";
import Post from "@/models/Post";
import Member from "@/models/Member";
import Media from "@/models/Media";
import Author from "@/models/Author";
import NewPostButton from "./NewPostButton";
import { FirstSteps, TemplateCard } from "./HomeParts";

type Props = { searchParams: Promise<{ vue?: string }> };

/** Accueil du dashboard (§ 13.1) : bilan, premiers pas, raccourcis, articles, à faire */
export default async function Dashboard({ searchParams }: Props) {
    const session = (await getBlogSession())!;
    const { vue } = await searchParams;
    await connectDB();
    const role = session.user.role;
    const chief = role === "admin" || role === "redac_chef";
    const me = await Member.findById(session.user.memberId).select("author").lean();
    const mine = me?.author ?? null;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [publishedMonth, monthViews, toRevise, toCorrect, toApprove, scheduled, toCheck, lastDraft, author, myPosts, myBestSeo, mySubmitted] = await Promise.all([
        Post.countDocuments({ status: "published", publishedAt: { $gte: monthStart, $lte: new Date() } }),
        Post.aggregate<{ v: number }>([{ $match: { status: "published", publishedAt: { $gte: monthStart } } }, { $group: { _id: null, v: { $sum: "$views" } } }]).then((r) => r[0]?.v ?? 0),
        Post.countDocuments({ status: "to_revise", authors: mine }),
        can(role, "post.correct") ? Post.countDocuments({ status: "pending_correction", authors: { $ne: mine } }) : 0,
        chief ? Post.countDocuments({ status: "pending_approval" }) : 0,
        chief ? Post.countDocuments({ status: "scheduled" }) : 0,
        chief ? Media.countDocuments({ rightsToCheck: true }) : 0,
        Post.findOne({ authors: mine, status: { $in: ["draft", "to_revise"] } }).sort({ updatedAt: -1 }).select("title updatedAt").lean(),
        mine ? Author.findById(mine).select("bio").lean() : null,
        Post.countDocuments({ authors: mine }),
        Post.countDocuments({ authors: mine, "seo.score": { $gte: 70 } }),
        Post.countDocuments({ authors: mine, "workflow.action": "submit" }),
    ]);

    // Grille d'articles : les miens modifiés récemment, ou toute l'équipe
    const team = vue === "equipe";
    const cards = await Post.find({ status: { $ne: "trash" }, ...(team ? {} : { authors: mine }) })
        .sort({ updatedAt: -1 })
        .limit(8)
        .select("title status updatedAt scheduledAt featuredImage authors corrector")
        .populate("authors", "name slug avatarUrl workytId")
        .lean();

    const waiting = toRevise + toCorrect + toApprove;
    const todo = [
        { n: toRevise, label: "à réviser", icon: RotateCcw, tone: "bg-sun/25 text-[#8a560a]", href: "/dashboard/articles/", show: true },
        { n: toCorrect, label: "à corriger", icon: PenLine, tone: "bg-violet-100 text-violet-700", href: "/dashboard/correction/", show: can(role, "post.correct") },
        { n: toApprove, label: "à approuver", icon: CheckCircle2, tone: "bg-[#ffe3cf] text-accentdark", href: "/dashboard/articles/?statut=pending_approval&vue=tous", show: chief },
        { n: scheduled, label: "programmés", icon: CalendarClock, tone: "bg-[#e3f3fb] text-[#2f86b3]", href: "/dashboard/calendrier/", show: chief },
        { n: toCheck, label: "images à vérifier", icon: Images, tone: "bg-red-50 text-red-700", href: "/dashboard/medias/", show: chief },
    ].filter((t) => t.show);

    const steps = [
        { label: "Compléter mon profil d'auteur", done: !!author?.bio, href: "/dashboard/profil/" },
        { label: "Écrire un premier brouillon", done: myPosts > 0, href: undefined },
        { label: "Atteindre 70 au score SEO", done: myBestSeo > 0, href: lastDraft ? `/dashboard/articles/${lastDraft._id}/` : undefined },
        { label: "Envoyer en correction", done: mySubmitted > 0, href: lastDraft ? `/dashboard/articles/${lastDraft._id}/` : undefined },
    ];

    return (
        <main className="min-w-0 flex-1 px-10 py-10">
            <div className="mx-auto max-w-6xl">
                <h1 className="font-display text-5xl">Bonjour {session.user.name} 👋</h1>
                <p className="mt-2 text-lg text-ink/60">
                    Ce mois-ci : <b className="text-ink">{publishedMonth}</b> article{publishedMonth > 1 ? "s" : ""} publié{publishedMonth > 1 ? "s" : ""}, <b className="text-ink">{monthViews.toLocaleString("fr-FR")}</b> lectures.{" "}
                    {waiting ? (
                        <>
                            <b className="text-accentdark">{waiting}</b> article{waiting > 1 ? "s" : ""} t&apos;attend{waiting > 1 ? "ent" : ""}.
                        </>
                    ) : (
                        "Rien ne t'attend : à toi d'écrire !"
                    )}
                </p>

                {can(role, "post.create") && <FirstSteps steps={steps} />}

                {can(role, "post.create") && (
                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                        <NewPostButton className="flex items-center gap-4 rounded-[24px] border border-ink/10 bg-white p-5 text-left transition hover:-translate-y-0.5" />
                        <TemplateCard />
                        {lastDraft ? (
                            <Link href={`/dashboard/articles/${lastDraft._id}/`} className="flex items-center gap-4 rounded-[24px] border border-ink/10 bg-white p-5 transition hover:-translate-y-0.5">
                                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sun/25 text-[#a0650a]">
                                    <FileClock />
                                </span>
                                <span className="min-w-0">
                                    <b className="block">Reprendre mon brouillon</b>
                                    <span className="block truncate text-sm text-ink/55">{lastDraft.title}</span>
                                </span>
                            </Link>
                        ) : (
                            <div className="flex items-center gap-4 rounded-[24px] border border-dashed border-ink/15 p-5 text-sm text-ink/50">
                                <FileClock className="h-6 w-6" /> Pas de brouillon en cours.
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-2 rounded-[24px] border border-ink/10 bg-white p-4">
                    <b className="mr-2 font-display text-xl">À faire</b>
                    {todo.map((t) => (
                        <Link key={t.label} href={t.href} className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition hover:-translate-y-px ${t.n ? t.tone : "bg-paper2 text-ink/45"}`}>
                            <t.icon className="h-4 w-4" />
                            <b>{t.n}</b> {t.label}
                        </Link>
                    ))}
                </div>

                <div className="mt-10 flex items-end justify-between gap-4">
                    <h2 className="font-display text-3xl">Articles</h2>
                    <div className="flex gap-1 rounded-full border border-ink/10 bg-white p-1 text-sm font-semibold">
                        <Link href="/dashboard/" className={`rounded-full px-3.5 py-1.5 ${!team ? "bg-ink text-white" : "text-ink/60"}`}>
                            Modifiés par moi
                        </Link>
                        <Link href="/dashboard/?vue=equipe" className={`rounded-full px-3.5 py-1.5 ${team ? "bg-ink text-white" : "text-ink/60"}`}>
                            Toute l&apos;équipe
                        </Link>
                    </div>
                </div>
                {cards.length === 0 ? (
                    <p className="mt-5 rounded-[24px] border border-dashed border-ink/15 bg-white p-10 text-center text-ink/55">Aucun article pour l&apos;instant.</p>
                ) : (
                    <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {cards.map((p) => {
                            const st = STATUS_LABELS[p.status] ?? STATUS_LABELS.draft;
                            /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- auteurs peuplés */
                            const a = (p.authors as any[]).filter(Boolean)[0];
                            return (
                                <Link key={String(p._id)} href={`/dashboard/articles/${p._id}/`} className="group overflow-hidden rounded-[24px] border border-ink/10 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(26,21,18,.08)]">
                                    <div className="relative aspect-[4/3] bg-paper2">
                                        {/* eslint-disable-next-line @next/next/no-img-element -- miniature */}
                                        {p.featuredImage?.url ? <img src={p.featuredImage.url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center font-display text-4xl text-ink/10">w</div>}
                                        <span className={`absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${st.className}`}>
                                            {st.label}
                                            {p.status === "in_correction" && p.corrector?.name ? ` · ${p.corrector.name}` : ""}
                                            {p.status === "scheduled" && p.scheduledAt ? ` · ${new Date(p.scheduledAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : ""}
                                        </span>
                                    </div>
                                    <div className="p-4">
                                        <p className="line-clamp-2 font-semibold leading-snug group-hover:text-accentdark">{p.title}</p>
                                        <div className="mt-3 flex items-center gap-2 text-xs text-ink/50">
                                            {a && (
                                                // eslint-disable-next-line @next/next/no-img-element -- avatar
                                                <img src={avatarSrc({ avatarUrl: a.avatarUrl, workytId: a.workytId, seed: a.slug })} alt="" className="h-6 w-6 rounded-full bg-paper2/60 object-cover" />
                                            )}
                                            modifié {relativeDate(p.updatedAt as Date)}
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
