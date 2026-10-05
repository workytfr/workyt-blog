import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Eye, FileText, MousePointerClick, TrendingUp } from "lucide-react";
import { getBlogSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import Category from "@/models/Category";
import ViewDay from "@/models/ViewDay";
import AffiliateLink from "@/models/AffiliateLink";

type Props = { searchParams: Promise<{ periode?: string }> };

const parisDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
/** Il y a n jours (début de la période affichée) */
const daysAgo = (n: number) => new Date(new Date().getTime() - n * 86_400_000);

/** Statistiques (§ 13) : lectures (compteur interne), articles les plus lus, rubriques, clics affiliés ; lien vers Umami */
export default async function StatsPage({ searchParams }: Props) {
    const session = (await getBlogSession())!;
    if (!can(session.user.role, "stats.view")) notFound();
    const { periode } = await searchParams;
    const days = periode === "90" ? 90 : periode === "7" ? 7 : 30;
    await connectDB();

    const since = daysAgo(days - 1);
    const sinceKey = parisDay(since);
    const [totals, daily, topPeriod, topAll, byCat, cats, links, publishedPeriod] = await Promise.all([
        Post.aggregate<{ n: number; v: number }>([{ $match: { status: "published" } }, { $group: { _id: null, n: { $sum: 1 }, v: { $sum: "$views" } } }]).then((r) => r[0] ?? { n: 0, v: 0 }),
        ViewDay.aggregate<{ _id: string; v: number }>([{ $match: { day: { $gte: sinceKey } } }, { $group: { _id: "$day", v: { $sum: "$views" } } }]),
        ViewDay.aggregate<{ _id: unknown; v: number }>([{ $match: { day: { $gte: sinceKey } } }, { $group: { _id: "$post", v: { $sum: "$views" } } }, { $sort: { v: -1 } }, { $limit: 10 }]),
        Post.find({ status: "published" }).sort({ views: -1 }).limit(10).select("title slug views publishedAt").lean(),
        Post.aggregate<{ _id: unknown; v: number; n: number }>([{ $match: { status: "published" } }, { $group: { _id: "$primaryCategory", v: { $sum: "$views" }, n: { $sum: 1 } } }, { $sort: { v: -1 } }]),
        Category.find({}).select("name color").lean(),
        AffiliateLink.find({}).sort({ clicks: -1 }).limit(10).select("label name clicks merchant").lean(),
        Post.countDocuments({ status: "published", publishedAt: { $gte: since, $lte: new Date() } }),
    ]);
    const topIds = topPeriod.map((t) => t._id);
    const topPosts = new Map((await Post.find({ _id: { $in: topIds } }).select("title slug").lean()).map((p) => [String(p._id), p]));
    const catById = new Map(cats.map((c) => [String(c._id), c]));

    // Courbe : un point par jour, y compris les jours sans lecture
    const series = Array.from({ length: days }, (_, i) => {
        const key = parisDay(new Date(since.getTime() + i * 86_400_000));
        return { key, v: daily.find((d) => d._id === key)?.v ?? 0 };
    });
    const periodViews = series.reduce((s, d) => s + d.v, 0);
    const max = Math.max(1, ...series.map((d) => d.v));
    const clicks = links.reduce((s, l) => s + (l.clicks || 0), 0);
    const umami = process.env.NEXT_PUBLIC_UMAMI_URL;

    const cards = [
        { icon: Eye, label: `lectures sur ${days} jours`, value: periodViews.toLocaleString("fr-FR"), tone: "text-[#2f86b3]" },
        { icon: TrendingUp, label: "lectures depuis le début", value: totals.v.toLocaleString("fr-FR"), tone: "text-accent" },
        { icon: FileText, label: `articles publiés (${publishedPeriod} sur la période)`, value: String(totals.n), tone: "text-[#3f8a1f]" },
        { icon: MousePointerClick, label: "clics sur les liens affiliés", value: clicks.toLocaleString("fr-FR"), tone: "text-[#9b6ef3]" },
    ];
    const card = "rounded-[24px] border border-ink/10 bg-white p-6";

    return (
        <main className="min-w-0 flex-1 px-10 py-10">
            <div className="mx-auto max-w-6xl">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="eyebrow">Gestion</p>
                        <h1 className="mt-1 font-display text-5xl">Statistiques</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1 rounded-full border border-ink/10 bg-white p-1 text-sm font-semibold">
                            {[7, 30, 90].map((d) => (
                                <Link key={d} href={`/dashboard/statistiques/?periode=${d}`} className={`rounded-full px-3.5 py-1.5 ${days === d ? "bg-ink text-white" : "text-ink/60"}`}>
                                    {d} jours
                                </Link>
                            ))}
                        </div>
                        {umami && (
                            <a href={umami} target="_blank" rel="noopener noreferrer" className="btn-ghost px-4 py-2 text-sm">
                                Tableau Umami <ArrowUpRight className="h-4 w-4" />
                            </a>
                        )}
                    </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {cards.map((c) => (
                        <div key={c.label} className={card}>
                            <c.icon className={`h-5 w-5 ${c.tone}`} />
                            <p className="mt-3 font-display text-4xl leading-none">{c.value}</p>
                            <p className="mt-1 text-sm text-ink/55">{c.label}</p>
                        </div>
                    ))}
                </div>

                <section className={`${card} mt-6`}>
                    <h2 className="font-display text-2xl">Lectures par jour</h2>
                    <div className="mt-5 flex h-48 items-end gap-[3px]" role="img" aria-label={`Lectures par jour sur ${days} jours, ${periodViews} au total`}>
                        {series.map((d) => (
                            <div key={d.key} className="group relative flex h-full min-w-0 flex-1 items-end">
                                <div className="w-full rounded-t-[4px] bg-accent/80 transition group-hover:bg-accentdark" style={{ height: `${Math.max(d.v ? 3 : 1, (d.v / max) * 100)}%`, opacity: d.v ? 1 : 0.25 }} />
                                <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] text-white group-hover:block">
                                    {new Date(`${d.key}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : {d.v}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-ink/45">
                        <span>{new Date(`${series[0].key}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                        <span>aujourd&apos;hui</span>
                    </div>
                    {periodViews === 0 && <p className="mt-3 text-xs text-ink/45">Le compteur par jour démarre avec le nouveau blog : la courbe se remplira avec les lectures.</p>}
                </section>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <section className={card}>
                        <h2 className="font-display text-2xl">Les plus lus sur {days} jours</h2>
                        <Ranking rows={topPeriod.flatMap((t) => (topPosts.get(String(t._id)) ? [{ title: topPosts.get(String(t._id))!.title, href: `/${topPosts.get(String(t._id))!.slug}/`, v: t.v }] : []))} empty="Pas encore de lecture comptée sur la période." />
                    </section>
                    <section className={card}>
                        <h2 className="font-display text-2xl">Les plus lus depuis le début</h2>
                        <Ranking rows={topAll.map((p) => ({ title: p.title, href: `/${p.slug}/`, v: p.views || 0 }))} empty="Aucun article publié." />
                    </section>
                    <section className={card}>
                        <h2 className="font-display text-2xl">Par rubrique</h2>
                        <ul className="mt-4 space-y-3">
                            {byCat.map((c) => {
                                const cat = catById.get(String(c._id));
                                const top = byCat[0]?.v || 1;
                                return (
                                    <li key={String(c._id)}>
                                        <div className="flex items-baseline justify-between text-sm">
                                            <span className="inline-flex items-center gap-2 font-semibold">
                                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: cat?.color ?? "#ccc" }} />
                                                {cat?.name ?? "Sans rubrique"}
                                            </span>
                                            <span className="text-ink/55">
                                                {c.v.toLocaleString("fr-FR")} lectures · {c.n} article{c.n > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/[0.06]">
                                            <div className="h-full rounded-full" style={{ width: `${(c.v / top) * 100}%`, background: cat?.color ?? "#ccc" }} />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                    <section className={card}>
                        <h2 className="font-display text-2xl">Liens affiliés</h2>
                        <Ranking rows={links.map((l) => ({ title: `${l.label}${l.merchant ? ` · ${l.merchant}` : ""}`, href: "/dashboard/liens/", v: l.clicks || 0 }))} unit="clics" empty="Aucun lien affilié." />
                    </section>
                </div>
            </div>
        </main>
    );
}

function Ranking({ rows, empty, unit = "lectures" }: { rows: { title: string; href: string; v: number }[]; empty: string; unit?: string }) {
    if (!rows.length) return <p className="mt-4 text-sm text-ink/50">{empty}</p>;
    return (
        <ol className="mt-4 space-y-2">
            {rows.map((r, i) => (
                <li key={`${r.href}-${i}`} className="flex items-center gap-3 text-sm">
                    <span className="w-6 font-display text-lg text-accent/80">{i + 1}</span>
                    <Link href={r.href} className="min-w-0 flex-1 truncate font-semibold hover:text-accentdark" target={r.href.startsWith("/dashboard") ? undefined : "_blank"}>
                        {r.title}
                    </Link>
                    <span className="shrink-0 text-ink/55">
                        {r.v.toLocaleString("fr-FR")} {r.v > 1 ? unit : unit.replace(/s$/, "")}
                    </span>
                </li>
            ))}
        </ol>
    );
}
