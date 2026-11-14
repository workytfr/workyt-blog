import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Headphones, Mic } from "lucide-react";
import { getPondaCategory, listPosts, type PostCardView } from "@/lib/content";
import { archiveMetadata, jsonLdString, pondaJsonLd } from "@/lib/seo";
import { PONDA } from "@/lib/ponda";
import { formatDate } from "@/lib/format";
import PostCard from "@/components/PostCard";
import Pagination from "@/components/Pagination";

/** Ponda Podcast : /ponda-podcast/ et /ponda-podcast/page/<n>/ */
export function pondaMetadata(page: number): Metadata {
    return archiveMetadata({
        title: "Ponda Podcast, l'émission du blog",
        description: PONDA.description,
        path: PONDA.path,
        page,
        card: { title: PONDA.name, kicker: "Émission" },
    });
}

const PER_PAGE = 13;

export default async function PondaPage({ page }: { page: number }) {
    const cat = await getPondaCategory();
    const empty = { items: [] as PostCardView[], total: 0, page, pages: 1 };
    const [episodes, audio] = await Promise.all([
        // Base injoignable (build sans base, par exemple) : page vide, régénérée 5 min plus tard
        cat ? listPosts({ page, perPage: PER_PAGE, category: cat.id }).catch(() => empty) : empty,
        // Articles des autres rubriques qui ont des extraits audio (première page seulement)
        page === 1 ? listPosts({ perPage: 6, hasAudio: true, notCategoryIds: cat ? [cat.id] : [], withTotal: false }).catch(() => empty) : empty,
    ]);
    // Page au-delà de la dernière : introuvable (et non une page vide indexée)
    if (page > 1 && episodes.items.length === 0) notFound();
    const [first, ...rest] = page === 1 ? episodes.items : [null, ...episodes.items];

    return (
        <>
            {/* Toute la page passe en noir et blanc (globals.css) */}
            <span className="ponda-scope" hidden />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(pondaJsonLd(episodes.items)) }} />

            {/* ─── En-tête de l'émission ─── */}
            <section className="mt-3 px-2 sm:mt-4 sm:px-4 lg:px-5">
                <div className="overflow-hidden rounded-[26px] bg-ink text-white sm:rounded-[36px]">
                    <div className="mx-auto max-w-[1240px] px-6 py-14 sm:px-10 sm:py-20">
                        <p className="lab flex items-center gap-2 text-white/70">
                            <Mic className="h-4 w-4" aria-hidden /> {PONDA.tagline}
                        </p>
                        <h1 className="mt-6">
                            {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG, déjà léger */}
                            <img src={PONDA.logo} alt={PONDA.name} width={1716} height={417} className="h-auto w-full max-w-[560px] invert" />
                        </h1>
                        <p className="mt-7 max-w-2xl text-[17px] leading-relaxed text-white/80">
                            Des épisodes courts ou longs, selon les sujets, à écouter et à lire. Dans les articles, des extraits audio se lancent au fil de la lecture.
                        </p>
                        <p className="mt-6 text-sm text-white/60">
                            {episodes.total} épisode{episodes.total > 1 ? "s" : ""}
                            {page > 1 && ` · page ${page} sur ${episodes.pages}`}
                        </p>
                    </div>
                </div>
            </section>

            <div className="mx-auto max-w-[1240px] px-6 pb-20 pt-12">
                {episodes.items.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-ink/20 bg-white p-12 text-center text-ink/65">Les premiers épisodes arrivent bientôt.</div>
                ) : (
                    <>
                        {/* Dernier épisode, en grand */}
                        {first && (
                            <article className="group relative grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center">
                                <div className="relative aspect-[16/10] overflow-hidden rounded-[28px] bg-paper2">
                                    {first.featuredImage && (
                                        <Image src={first.featuredImage.url} alt="" fill fetchPriority="high" loading="eager" sizes="(min-width: 1024px) 640px, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="lab text-ink/65">Dernier épisode · {formatDate(first.publishedAt)}</p>
                                    <h2 className="mt-3 font-display text-[34px] leading-[1.08] tracking-tight sm:text-[44px]">
                                        <Link href={`/${first.slug}/`} className="after:absolute after:inset-0">
                                            {first.title}
                                        </Link>
                                    </h2>
                                    {first.excerpt && <p className="mt-4 line-clamp-3 text-[16px] leading-relaxed text-ink/70">{first.excerpt}</p>}
                                    <span className="btn-ink mt-6 px-5 py-2.5 text-sm">
                                        <Headphones className="h-4 w-4" aria-hidden /> Écouter l&apos;épisode
                                    </span>
                                </div>
                            </article>
                        )}

                        {rest.length > 0 && (
                            <section className={first ? "mt-16" : ""}>
                                <h2 className="font-display text-[30px] leading-none">{first ? "Tous les épisodes" : `Épisodes, page ${page}`}</h2>
                                <div className="mt-7 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                                    {rest.map((p) => p && <PostCard key={p.id} post={p} />)}
                                </div>
                            </section>
                        )}
                    </>
                )}
                <Pagination base={PONDA.path} page={episodes.page} pages={episodes.pages} />

                {/* ─── Articles à écouter ─── */}
                {audio.items.length > 0 && (
                    <section className="mt-20 border-t border-ink/15 pt-12">
                        <h2 className="font-display text-[30px] leading-none">Articles à écouter</h2>
                        <p className="mt-3 max-w-2xl text-ink/65">Des articles du blog avec des extraits audio de leurs auteurs.</p>
                        <div className="mt-7 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                            {audio.items.map((p) => (
                                <PostCard key={p.id} post={p} />
                            ))}
                        </div>
                    </section>
                )}

                <p className="mt-16 text-sm text-ink/65">
                    <Link href="/" className="inline-flex items-center gap-1.5 font-semibold text-ink hover:underline">
                        Retour au blog <ArrowRight className="h-4 w-4" />
                    </Link>
                </p>
            </div>
        </>
    );
}
