import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowUpRight, CalendarDays, Eye, FileText, FolderOpen, PenLine } from "lucide-react";
import { authorStats, getAuthorBySlug, listPosts } from "@/lib/content";
import { archiveMetadata, authorJsonLd, jsonLdString } from "@/lib/seo";
import { formatCount, relativeDate } from "@/lib/format";
import { workytProfileUrl } from "@/lib/avatar";
import PostCard from "@/components/PostCard";
import Pagination from "@/components/Pagination";
import { Avatar } from "@/components/ui";

/** Auteur : /author/<slug>/ (pages PublishPress Authors) */
export async function authorMetadata(slug: string, page: number): Promise<Metadata> {
    const a = await getAuthorBySlug(decodeURIComponent(slug));
    if (!a) return { title: "Auteur introuvable", robots: { index: false } };
    return archiveMetadata({
        title: a.seo.title || a.name,
        description: a.seo.description || a.bio || `Les articles de ${a.name} sur le blog Workyt.`,
        path: `/author/${a.slug}/`,
        page,
    });
}

const card = "rounded-3xl border border-ink/10 bg-white";
const cardTitle = "flex items-center gap-2.5 font-display text-2xl";
const monthYear = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

/**
 * Profil d'auteur, sur le modèle du profil workyt.fr : en-tête pointillé avec
 * l'avatar et le nom, chiffres clés, carte « Activité », articles, et une
 * colonne avec ses rubriques et le lien vers son profil Workyt.
 */
export default async function AuthorArchive({ slug, page }: { slug: string; page: number }) {
    const a = await getAuthorBySlug(decodeURIComponent(slug));
    if (!a) notFound();
    const [list, stats] = await Promise.all([listPosts({ page, author: a.id }), authorStats(a.id)]);
    if (list.page > 1 && list.items.length === 0) notFound();
    const profile = workytProfileUrl(a.workytId);

    const tiles = [
        { icon: FileText, value: formatCount(stats.published), label: `article${stats.published > 1 ? "s" : ""} publié${stats.published > 1 ? "s" : ""}`, color: "text-accent" },
        { icon: Eye, value: formatCount(stats.views), label: "lectures", color: "text-[#2f86b3]" },
        { icon: FolderOpen, value: String(stats.categories.length), label: `rubrique${stats.categories.length > 1 ? "s" : ""}`, color: "text-[#3f8a1f]" },
        { icon: PenLine, value: stats.lastAt ? relativeDate(stats.lastAt) : "—", label: "dernier article", color: "text-[#9b6ef3]" },
    ];

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(authorJsonLd(a)) }} />

            {/* ─── En-tête ─── */}
            <header className="relative overflow-hidden border-b border-ink/10">
                <div className="wk-dotgrid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
                <div className="relative mx-auto max-w-[1240px] px-6 pb-12 pt-12 md:pb-14 md:pt-14">
                    <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                            <div className="w-fit shrink-0 rounded-full bg-white shadow-lg ring-4 ring-white">
                                <Avatar author={a} size={104} />
                            </div>
                            <div className="min-w-0">
                                <p className="eyebrow">Auteur</p>
                                <h1 className="mt-3 break-words font-display text-[clamp(2.2rem,5vw,3.75rem)] leading-[0.95] tracking-tight">
                                    {a.name}
                                    <span className="text-accent">.</span>
                                </h1>
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    {a.title && <span className="inline-flex items-center rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-sm font-semibold text-accentdark">{a.title}</span>}
                                    {stats.since && (
                                        <span className="inline-flex items-center gap-1.5 text-sm text-ink/55">
                                            <CalendarDays className="h-4 w-4" /> Écrit pour le blog depuis {monthYear(stats.since)}
                                        </span>
                                    )}
                                </div>
                                {a.bio && <p className="mt-4 max-w-[60ch] leading-relaxed text-ink/70">{a.bio}</p>}
                            </div>
                        </div>

                        {/* Chiffres clés */}
                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <span className="chip !px-3.5 !py-2 text-sm">
                                <FileText className="h-4 w-4 text-accent" /> {formatCount(stats.published)} article{stats.published > 1 ? "s" : ""}
                            </span>
                            <span className="chip !px-3.5 !py-2 text-sm">
                                <Eye className="h-4 w-4 text-[#2f86b3]" /> {formatCount(stats.views)} lectures
                            </span>
                            {profile && (
                                <a href={profile} className="btn-ink px-4 py-2 text-sm">
                                    Profil Workyt <ArrowUpRight className="h-4 w-4" />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-[1240px] px-6 pb-20 pt-10">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-10">
                    {/* ─── Colonne principale ─── */}
                    <main className="min-w-0 space-y-8">
                        <section className={`${card} p-5 sm:p-6`}>
                            <h2 className={cardTitle}>
                                <Activity className="h-5 w-5 text-accent" /> Activité
                            </h2>
                            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                                {tiles.map((t) => (
                                    <div key={t.label} className="rounded-2xl bg-paper p-4">
                                        <t.icon className={`h-5 w-5 ${t.color}`} />
                                        <p className="mt-2 font-display text-3xl leading-none">{t.value}</p>
                                        <p className="mt-1 text-xs text-ink/55">{t.label}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section>
                            <h2 className={`${cardTitle} mb-5`}>
                                <FileText className="h-5 w-5 text-accent" /> Ses articles
                                <span className="text-base text-ink/45">({list.total})</span>
                                {list.page > 1 && <span className="ml-auto text-sm font-normal text-ink/50">page {list.page} sur {list.pages}</span>}
                            </h2>
                            {list.items.length === 0 ? (
                                <div className="rounded-3xl border border-dashed border-ink/15 bg-white p-10 text-center text-ink/60">Aucun article publié pour l&apos;instant.</div>
                            ) : (
                                <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2">
                                    {list.items.map((p, i) => (
                                        <PostCard key={p.id} post={p} priority={i < 2} />
                                    ))}
                                </div>
                            )}
                            <Pagination base={`/author/${a.slug}/`} page={list.page} pages={list.pages} />
                        </section>
                    </main>

                    {/* ─── Colonne latérale ─── */}
                    <aside className="min-w-0 space-y-6">
                        {stats.categories.length > 0 && (
                            <section className={`${card} p-5 sm:p-6`}>
                                <h2 className={cardTitle}>
                                    <FolderOpen className="h-5 w-5 text-accent" /> Ses rubriques
                                </h2>
                                <ul className="mt-4 space-y-1">
                                    {stats.categories.map((c) => (
                                        <li key={c.id}>
                                            <Link href={`/category/${c.slug}/`} className="flex items-center gap-3 rounded-xl px-2 py-2 text-[15px] font-semibold hover:bg-paper">
                                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                                                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                                                <span className="rounded-full bg-paper2 px-2 py-0.5 text-xs text-ink/60">{c.count}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white">
                            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-accent/30 blur-2xl" aria-hidden="true" />
                            <p className="relative font-display text-2xl leading-tight">{profile ? `Retrouve ${a.name} sur Workyt` : "Toi aussi, écris pour le blog"}</p>
                            <p className="relative mt-2 text-sm text-white/65">{profile ? "Ses fiches, ses questions et ses réponses sur le forum, ses badges." : "La rédaction de Workyt accueille les élèves, étudiants et bénévoles qui veulent partager."}</p>
                            <a href={profile ?? "https://workyt.fr/"} className="btn-orange relative mt-5 px-5 py-2.5 text-sm">
                                {profile ? "Voir son profil" : "Découvrir Workyt"} <ArrowUpRight className="h-4 w-4" />
                            </a>
                        </section>
                    </aside>
                </div>
            </div>
        </>
    );
}
