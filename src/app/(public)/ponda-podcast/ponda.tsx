import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPondaCategory, listPosts, type PostCardView } from "@/lib/content";
import { archiveMetadata, jsonLdString, pondaJsonLd } from "@/lib/seo";
import { PONDA } from "@/lib/ponda";
import { SITE } from "@/lib/site";
import PostCard from "@/components/PostCard";
import Pagination from "@/components/Pagination";
import Sidebar from "@/components/Sidebar";

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

/**
 * Page de l'émission, dans la mise en page des rubriques du blog (en-tête,
 * grille d'articles, colonne). Seule l'identité de Ponda est en noir et blanc :
 * le logo du panda et la pastille « Ponda Podcast » des cartes.
 */
export default async function PondaPage({ page }: { page: number }) {
    const cat = await getPondaCategory();
    const empty = { items: [] as PostCardView[], total: 0, page, pages: 1 };
    const [episodes, audio] = await Promise.all([
        // Base injoignable (build sans base, par exemple) : page vide, régénérée 5 min plus tard
        cat ? listPosts({ page, perPage: SITE.postsPerPage, category: cat.id }).catch(() => empty) : empty,
        // Articles des autres rubriques qui ont des extraits audio (première page seulement)
        page === 1 ? listPosts({ perPage: 4, hasAudio: true, notCategoryIds: cat ? [cat.id] : [], withTotal: false }).catch(() => empty) : empty,
    ]);
    // Page au-delà de la dernière : introuvable (et non une page vide indexée)
    if (page > 1 && episodes.items.length === 0) notFound();

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(pondaJsonLd(episodes.items)) }} />
            <div className="mx-auto grid max-w-[1240px] gap-12 px-6 pb-20 pt-12 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="min-w-0">
                    <header>
                        <p className="eyebrow">Émission</p>
                        <h1 className="mt-3">
                            {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG, déjà léger */}
                            <img src={PONDA.logo} alt={PONDA.name} width={1716} height={417} className="h-16 w-auto dark:invert sm:h-20" />
                        </h1>
                        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink/65">
                            L&apos;émission du blog Workyt : des épisodes courts ou longs selon les sujets, à écouter et à lire. Dans les articles, des extraits audio se lancent
                            au fil de la lecture.
                        </p>
                    </header>
                    {episodes.total > 0 && (
                        <p className="mt-6 text-sm text-ink/65">
                            {episodes.total} épisode{episodes.total > 1 ? "s" : ""}
                            {page > 1 && ` · page ${page} sur ${episodes.pages}`}
                        </p>
                    )}
                    {episodes.items.length === 0 ? (
                        <div className="mt-6 rounded-[24px] border border-dashed border-ink/15 bg-white p-10 text-center text-ink/65">Les premiers épisodes arrivent bientôt.</div>
                    ) : (
                        <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2">
                            {episodes.items.map((p, i) => (
                                <PostCard key={p.id} post={p} priority={i < 2} headingLevel={2} />
                            ))}
                        </div>
                    )}
                    <Pagination base={PONDA.path} page={episodes.page} pages={episodes.pages} />

                    {audio.items.length > 0 && (
                        <section className="mt-16">
                            <h2 className="section-title font-display text-[32px]">Articles à écouter</h2>
                            <p className="mt-3 text-ink/65">Des articles du blog avec des extraits audio de leurs auteurs.</p>
                            <div className="mt-7 grid gap-x-6 gap-y-10 sm:grid-cols-2">
                                {audio.items.map((p) => (
                                    <PostCard key={p.id} post={p} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
                <Sidebar />
            </div>
        </>
    );
}
