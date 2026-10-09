import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar, ChevronRight, Clock, MessageCircle } from "lucide-react";
import type { PostCardView, PostView } from "@/lib/content";
import { renderArticle, splitAtModules } from "@/lib/render";
import { isAffiliateHref } from "@/lib/modules/types";
import ModuleView from "@/components/modules/ModuleView";
import Sources from "@/components/modules/Sources";
import { ProductComparison } from "@/components/modules/Reviews";
import { postJsonLd, jsonLdString } from "@/lib/seo";
import { absoluteUrl, SITE } from "@/lib/site";
import { formatDate } from "@/lib/format";
import { Avatar, CategoryPill, CreditBadge } from "@/components/ui";
import ShareBar from "@/components/ShareBar";
import Sidebar from "@/components/Sidebar";
import TocRail from "@/components/TocRail";
import Comments from "@/components/Comments";
import Reactions from "@/components/Reactions";
import { listComments, reactionCounts } from "@/lib/comments";
import PostCard from "@/components/PostCard";
import ViewCounter from "@/components/ViewCounter";
import TableZoom from "@/components/TableZoom";
import EmbedLoader from "@/components/EmbedLoader";

/**
 * Mise en page d'un article (Pixwell au style Workyt) : héros avec l'image à
 * la une derrière le titre, contenu, partage, widgets, auteurs, articles
 * liés. Utilisée par la page publique et par l'aperçu de la rédaction.
 */
export default async function PostArticle({
    post,
    previous,
    next,
    related,
    preview = false,
}: {
    post: PostView;
    previous: PostCardView | null;
    next: PostCardView | null;
    related: PostCardView[];
    preview?: boolean;
}) {
    const url = absoluteUrl(`/${post.slug}/`);
    // Commentaires publiés et réactions : dans la page (référencement) ; l'aperçu de la rédaction n'en a pas
    const [comments, reactions] = preview ? [[], {}] : await Promise.all([listComments(post.id), reactionCounts(post.id)]);
    const img = post.featuredImage;

    // Modules (lot 4) : ceux placés dans le texte s'y affichent, les autres à la fin ; les sources en dernier
    const sources = post.modules.flatMap((m) => (m.type === "sources" ? m.data.items : []));
    // Sommaire : carte avant le premier titre, et version collante dans la colonne
    const { html, toc } = renderArticle(post.contentHtml, { linkIcons: true, sourceIds: sources.map((s) => s.id), affiliates: post.affiliates, featuredUrl: img?.url });
    const parts = splitAtModules(html);
    const placed = new Set(parts.flatMap((p) => ("moduleId" in p ? [p.moduleId] : [])));
    const byId = new Map(post.modules.map((m) => [m.id, m]));
    const atEnd = post.modules.filter((m) => !placed.has(m.id) && m.type !== "sources");
    const products = post.modules.flatMap((m) => (m.type === "productReview" ? [m.data] : []));
    const cited = new Set([...post.contentHtml.matchAll(/data-source="([^"]+)"/g)].map((m) => m[1]));
    // Mention obligatoire dès qu'un lien affilié est présent (texte ou module)
    const affiliate =
        /href="\/go\//.test(post.contentHtml) ||
        post.modules.some((m) => (m.type === "productReview" || m.type === "favorite" || m.type === "guestFavorite") && isAffiliateHref(m.data.link));

    return (
        <>
            {!preview && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(postJsonLd(post, comments)) }} />}
            {!preview && <ViewCounter postId={post.id} />}

            {/* ─── Héros : image à la une derrière le titre (Pixwell) ─── */}
            {/* Toute la largeur de l'écran (petite marge), le titre aligné sur le contenu */}
            <section className="mt-3 px-2 sm:mt-4 sm:px-4 lg:px-5">
                <div className="relative min-h-[460px] overflow-hidden rounded-[26px] bg-ink sm:min-h-[520px] sm:rounded-[36px] lg:h-[620px]">
                    {img && <Image src={img.url} alt={img.alt} fill priority sizes="100vw" className="object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/25" />
                    <div className="relative mx-auto flex h-full min-h-[460px] max-w-[1360px] flex-col px-5 pb-12 pt-6 text-white sm:min-h-[520px] sm:px-8 sm:pb-16 sm:pt-8 lg:min-h-0">
                        <nav className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-white/75" aria-label="Fil d'Ariane">
                            <Link href="/">{SITE.name}</Link>
                            {post.primaryCategory && (
                                <>
                                    <ChevronRight className="h-3 w-3" />
                                    <Link href={`/category/${post.primaryCategory.slug}/`}>{post.primaryCategory.name}</Link>
                                </>
                            )}
                            <ChevronRight className="h-3 w-3" />
                            <span className="line-clamp-1 max-w-[50ch] text-white/55">{post.title}</span>
                        </nav>
                        <div className="mt-auto max-w-[980px]">
                            <div className="flex flex-wrap gap-2">
                                {post.categories.map((c) => (
                                    <CategoryPill key={c.id} category={c} />
                                ))}
                            </div>
                            <h1 className="mt-5 break-words font-display text-[32px] leading-[1.06] tracking-tight sm:text-[48px] lg:text-[64px]">{post.title}</h1>
                            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80">
                                {post.authors.length > 0 && (
                                    <span className="flex items-center gap-2.5">
                                        <span className="flex -space-x-2">
                                            {post.authors.map((a) => (
                                                <Avatar key={a.id} author={a} size={34} />
                                            ))}
                                        </span>
                                        <span>
                                            {post.authors.map((a, i) => (
                                                <span key={a.id}>
                                                    {i > 0 && (i === post.authors.length - 1 ? " et " : ", ")}
                                                    <Link href={`/author/${a.slug}/`} className="font-semibold text-white hover:underline">
                                                        {a.name}
                                                    </Link>
                                                </span>
                                            ))}
                                        </span>
                                    </span>
                                )}
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="h-4 w-4" />
                                    <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Clock className="h-4 w-4" />
                                    {post.readingMinutes} min de lecture
                                </span>
                                <a href="#commentaires" className="flex items-center gap-1.5">
                                    <MessageCircle className="h-4 w-4" />
                                    {post.commentCount}
                                </a>
                            </div>
                        </div>
                    </div>
                    {img && <CreditBadge image={img} className="!bottom-6 !right-6" />}
                </div>
            </section>

            {/* ─── Contenu + widgets ─── */}
            <div className="mx-auto grid max-w-[1360px] gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pt-12 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="min-w-0">
                    <div className="grid gap-8 lg:grid-cols-[42px_minmax(0,1fr)]">
                        <ShareBar url={url} title={post.title} image={img?.url} />
                        <article className="wk-counter min-w-0">
                            {affiliate && (
                                <p className="mb-6 rounded-2xl border border-sun/50 bg-sun/15 px-4 py-3 text-sm text-ink/75">
                                    <b>Transparence :</b> cet article contient des liens sponsorisés. Si tu achètes en passant par eux, Workyt peut toucher une petite commission, sans
                                    surcoût pour toi. Ça aide l&apos;association à rester gratuite.
                                </p>
                            )}
                            {parts.map((p, i) =>
                                "html" in p ? (
                                    <div key={i} className="post-content" dangerouslySetInnerHTML={{ __html: p.html }} />
                                ) : byId.has(p.moduleId) ? (
                                    <ModuleView key={i} module={byId.get(p.moduleId)!} post={post} preview={preview} />
                                ) : null
                            )}
                            <TableZoom />
                            <EmbedLoader />
                            {products.length > 1 && <ProductComparison items={products} />}
                            {atEnd.map((m) => (
                                <ModuleView key={m.id} module={m} post={post} preview={preview} />
                            ))}
                            <Sources items={sources} cited={cited} />

                            {post.tags.length > 0 && (
                                <div className="mt-10 flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold">Étiquettes :</span>
                                    {post.tags.map((t) => (
                                        <Link key={t.id} href={`/tag/${t.slug}/`} className="chip hover:border-ink/30">
                                            #{t.name}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </article>
                    </div>

                    {!preview && <Reactions postId={post.id} initial={reactions} />}

                    {/* Encadrés auteur */}
                    {post.authors.map((a) => (
                        <div key={a.id} className="mt-12 flex gap-5 rounded-[28px] border border-ink/10 bg-white p-7">
                            <Avatar author={a} size={84} />
                            <div className="min-w-0">
                                <div className="lab text-ink/45">Écrit par</div>
                                <div className="mt-1 font-display text-[28px] leading-none">{a.name}</div>
                                {a.title && <div className="mt-1 text-sm font-semibold text-accentdark">{a.title}</div>}
                                {a.bio && <p className="mt-2 text-[15px] text-ink/65">{a.bio}</p>}
                                <Link href={`/author/${a.slug}/`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold hover:text-accentdark">
                                    Tous ses articles <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    ))}

                    {/* Rédacteurs invités (coup de cœur externe) */}
                    {post.contributors.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[24px] border border-ink/10 bg-white px-6 py-4">
                            <span className="lab text-ink/45">Avec la participation de</span>
                            {post.contributors.map((c) => (
                                <Link key={c.id} href={`/author/${c.slug}/`} className="inline-flex items-center gap-2 text-sm font-semibold hover:text-accentdark">
                                    <Avatar author={c} size={30} /> {c.name}
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Précédent / suivant */}
                    {(previous || next) && (
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            {previous ? <AdjacentLink post={previous} direction="previous" /> : <span />}
                            {next && <AdjacentLink post={next} direction="next" />}
                        </div>
                    )}

                    {/* Commentaires (lot 6) */}
                    {preview ? (
                        <p className="mt-12 rounded-[24px] border border-dashed border-ink/15 bg-white p-5 text-sm text-ink/55">Les commentaires s&apos;afficheront ici une fois l&apos;article publié.</p>
                    ) : (
                        <Comments postId={post.id} slug={post.slug} initial={comments} />
                    )}
                </div>

                <div>
                    <Sidebar />
                    {/* Sous les widgets (sans les cacher) : se colle en haut une fois qu'ils sont passés */}
                    {toc.length > 0 && <TocRail items={toc} readingMinutes={post.readingMinutes} />}
                </div>
            </div>

            {/* ─── Tu aimeras aussi ─── */}
            {related.length > 0 && (
                <section className="border-t border-ink/10 bg-paper2/60 py-14">
                    <div className="mx-auto max-w-[1360px] px-5 sm:px-8">
                        <h2 className="section-title font-display text-[32px]">Tu aimeras aussi</h2>
                        <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            {related.map((p) => (
                                <PostCard key={p.id} post={p} />
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </>
    );
}

function AdjacentLink({ post, direction }: { post: { slug: string; title: string; featuredImage: { url: string } | null }; direction: "previous" | "next" }) {
    const isNext = direction === "next";
    const thumb = (
        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-paper2">
            {post.featuredImage && <Image src={post.featuredImage.url} alt="" fill sizes="64px" className="object-cover" />}
        </span>
    );
    return (
        <Link href={`/${post.slug}/`} rel={isNext ? "next" : "prev"} className={`flex items-center gap-4 rounded-[24px] border border-ink/10 bg-white p-4 hover:border-ink/25 ${isNext ? "text-right" : ""}`}>
            {!isNext && thumb}
            <span className="min-w-0 flex-1">
                <span className={`flex items-center gap-1 text-xs font-semibold text-ink/45 ${isNext ? "justify-end" : ""}`}>
                    {!isNext && <ArrowLeft className="h-3.5 w-3.5" />}
                    {isNext ? "Article suivant" : "Article précédent"}
                    {isNext && <ArrowRight className="h-3.5 w-3.5" />}
                </span>
                <span className="mt-1 line-clamp-2 block text-sm font-semibold leading-snug">{post.title}</span>
            </span>
            {isNext && thumb}
        </Link>
    );
}
