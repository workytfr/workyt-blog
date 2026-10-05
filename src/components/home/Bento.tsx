import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Flame, Sparkles } from "lucide-react";
import type { CategoryView, PostCardView } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { CreditBadge } from "@/components/ui";

/**
 * Accueil en grille de cartes (« bento ») : grande carte photo à encoche,
 * carte couleur avec liste, carte portrait, carte image, et une carte libre
 * (rubriques en haut de l'accueil). « mirror » : la même grille retournée,
 * couleurs échangées (« Derniers articles »). Couleurs et polices de la
 * charte Workyt.
 */

const short = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

function Meta({ post, light = false }: { post: PostCardView; light?: boolean }) {
    return (
        <p className={`flex flex-wrap items-center gap-x-2 text-[11.5px] ${light ? "text-white/80" : "text-ink/55"}`}>
            {post.primaryCategory && (
                <span>
                    Rubrique · <b className={light ? "text-white" : "text-ink"}>{post.primaryCategory.name}</b>
                </span>
            )}
            <span className={`h-3 w-px ${light ? "bg-white/40" : "bg-ink/20"}`} />
            <time dateTime={post.publishedAt}>{short(post.publishedAt)}</time>
        </p>
    );
}

/** Places des cartes : grille du haut, ou retournée (grande carte à droite) */
const PLACES = {
    normal: { main: "lg:col-span-5 lg:row-span-2", colored: "lg:col-span-4", portrait: "lg:col-span-3", wide: "lg:col-span-4", corner: "lg:col-span-3" },
    mirror: {
        portrait: "lg:col-start-1 lg:col-span-3 lg:row-start-1",
        colored: "lg:col-start-4 lg:col-span-4 lg:row-start-1",
        main: "lg:col-start-8 lg:col-span-5 lg:row-start-1 lg:row-span-2",
        corner: "lg:col-start-1 lg:col-span-3 lg:row-start-2",
        wide: "lg:col-start-4 lg:col-span-4 lg:row-start-2",
    },
};
// Couleurs du thème (versions foncées en mode sombre)
const PEACH = "--c-peach";
const SKY = "--c-skysoft";

export default function Bento({ posts, corner, mirror = false, priority = true }: { posts: PostCardView[]; corner: React.ReactNode; mirror?: boolean; priority?: boolean }) {
    const [main, colored, portrait, wide] = posts;
    const list = posts.slice(4, 6);
    if (!main) return null;
    const at = PLACES[mirror ? "mirror" : "normal"];
    // Couleurs échangées dans la version miroir
    const coloredBg = mirror ? SKY : PEACH;
    const portraitBg = mirror ? PEACH : SKY;

    return (
        <div className="grid gap-4 lg:grid-cols-12 lg:grid-rows-[300px_230px] 2xl:grid-rows-[370px_280px] 2xl:gap-5">
            {/* 1. Grande carte photo, titre dans l'encoche */}
            <article className={`group relative min-h-[420px] overflow-hidden rounded-[30px] bg-paper2 ${at.main}`}>
                {main.featuredImage && <Image src={main.featuredImage.url} alt={main.featuredImage.alt} fill priority={priority} sizes="(min-width: 1536px) 660px, (min-width: 1024px) 520px, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />}
                <span className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/80 text-accent backdrop-blur" title={mirror ? "Nouveau" : "À la une"}>
                    {mirror ? <Sparkles className="h-5 w-5" /> : <Flame className="h-5 w-5" />}
                </span>
                {main.featuredImage && <CreditBadge image={main.featuredImage} className="!bottom-auto !top-4 !right-4" />}
                <div className="notch-bl max-w-[86%] px-5 pb-1 pt-4">
                    <Meta post={main} />
                    <h2 className="mt-2 font-display text-[26px] leading-[1.08] sm:text-[30px] 2xl:text-[36px]">
                        <Link href={`/${main.slug}/`} className="after:absolute after:inset-0 hover:text-accentdark">
                            {main.title}
                        </Link>
                    </h2>
                </div>
            </article>

            {/* 2. Carte couleur : titre en grand, extrait, deux articles en liste */}
            {colored && (
                <article className={`relative flex flex-col overflow-hidden rounded-[30px] ${at.colored}`} style={{ background: `rgb(var(${coloredBg}))` }}>
                    <div className="relative flex-1 p-6 pr-16">
                        <Meta post={colored} />
                        <h2 className="mt-3 font-display text-[24px] leading-[1.08]">
                            <Link href={`/${colored.slug}/`} className="hover:text-accentdark">
                                {colored.title}
                            </Link>
                        </h2>
                        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink/65">{colored.excerpt}</p>
                    </div>
                    <div className="notch-tr">
                        <Link href={`/${colored.slug}/`} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-ink/10 transition hover:bg-ink hover:text-white" aria-label={`Lire « ${colored.title} »`}>
                            <ArrowUpRight className="h-5 w-5" />
                        </Link>
                    </div>
                    {list.length > 0 && (
                        <ul className="border-t border-ink/10">
                            {list.map((p) => (
                                <li key={p.id} className="border-b border-ink/10 last:border-0">
                                    <Link href={`/${p.slug}/`} className="flex items-center gap-3 px-6 py-2.5 text-[12.5px] font-semibold hover:bg-white/40">
                                        <span className="line-clamp-1 flex-1">{p.title}</span>
                                        <ArrowRight className="h-4 w-4 shrink-0" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </article>
            )}

            {/* 3. Carte portrait : titre en haut, photo dessous */}
            {portrait && (
                <article className={`group relative min-h-[300px] overflow-hidden rounded-[30px] ${at.portrait}`} style={{ background: `rgb(var(${portraitBg}))` }}>
                    {portrait.featuredImage && (
                        <Image src={portrait.featuredImage.url} alt={portrait.featuredImage.alt} fill sizes="(min-width: 1536px) 400px, (min-width: 1024px) 300px, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.04]" />
                    )}
                    <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, rgb(var(${portraitBg})), rgb(var(${portraitBg}) / 0.7), transparent)` }} />
                    <div className="relative p-5">
                        <p className="text-[11.5px] text-ink/60">
                            Rubrique · <b className="text-ink">{portrait.primaryCategory?.name}</b>
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink/50">{formatDate(portrait.publishedAt)}</p>
                        <h2 className="mt-2 font-display text-[22px] leading-[1.08]">
                            <Link href={`/${portrait.slug}/`} className="after:absolute after:inset-0">
                                {portrait.title}
                            </Link>
                        </h2>
                    </div>
                </article>
            )}

            {/* 4. Carte image, titre en bas */}
            {wide && (
                <article className={`group relative min-h-[230px] overflow-hidden rounded-[30px] bg-ink ${at.wide}`}>
                    {wide.featuredImage && <Image src={wide.featuredImage.url} alt={wide.featuredImage.alt} fill sizes="(min-width: 1536px) 520px, (min-width: 1024px) 400px, 100vw" className="object-cover opacity-90 transition duration-700 group-hover:scale-[1.04]" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <p className="text-[11px] text-white/75">
                            {wide.readingMinutes} min · {short(wide.publishedAt)}
                        </p>
                        <h2 className="mt-1 font-display text-[19px] leading-tight">
                            <Link href={`/${wide.slug}/`} className="after:absolute after:inset-0">
                                {wide.title}
                            </Link>
                        </h2>
                    </div>
                </article>
            )}

            {/* 5. Carte libre (rubriques, articles plus anciens…) */}
            <div className={`relative flex flex-col overflow-hidden rounded-[30px] bg-cream p-5 ${at.corner}`}>{corner}</div>
        </div>
    );
}

/** Carte libre du haut de l'accueil : les rubriques */
export function CategoriesCorner({ categories }: { categories: (CategoryView & { count: number })[] }) {
    return (
        <>
            <div className="flex flex-wrap gap-1.5">
                {categories.slice(0, 7).map((c, i) => (
                    <Link
                        key={c.id}
                        href={`/category/${c.slug}/`}
                        className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition hover:-translate-y-px ${i === 1 ? "bg-sun ring-sun" : "bg-white/80 ring-ink/5 hover:bg-white"}`}
                    >
                        {c.name}
                    </Link>
                ))}
            </div>
            <div className="mt-auto flex items-center justify-between pt-4">
                <span className="font-display text-[19px] leading-tight">Toutes les rubriques</span>
                <a href="#rubriques" className="grid h-12 w-12 place-items-center rounded-full bg-white ring-4 ring-sun/60 transition hover:bg-ink hover:text-white" aria-label="Voir toutes les rubriques">
                    <ArrowRight className="h-5 w-5" />
                </a>
            </div>
        </>
    );
}

/** Carte libre de « Derniers articles » : vers les articles plus anciens */
export function OlderCorner({ total, href }: { total: number; href: string }) {
    return (
        <>
            <p className="eyebrow">Les archives</p>
            <p className="mt-2 font-display text-[44px] leading-none">{total}</p>
            <p className="text-sm text-ink/60">articles publiés depuis le début du blog</p>
            <div className="mt-auto flex items-center justify-between pt-4">
                <span className="font-display text-[19px] leading-tight">Articles plus anciens</span>
                <Link href={href} className="grid h-12 w-12 place-items-center rounded-full bg-white ring-4 ring-sun/60 transition hover:bg-ink hover:text-white" aria-label="Voir les articles plus anciens">
                    <ArrowRight className="h-5 w-5" />
                </Link>
            </div>
        </>
    );
}
