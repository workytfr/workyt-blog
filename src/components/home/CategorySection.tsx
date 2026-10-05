import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { CategoryView, PostCardView } from "@/lib/content";

/**
 * Une rubrique sur l'accueil, avec les cartes de la grille du haut : grande
 * photo à encoche (dernier article), carte à la couleur de la rubrique (article
 * suivant + deux en liste), carte de la rubrique (description, sous-rubriques,
 * lien). « flip » : grande photo à droite, une rubrique sur deux.
 */

const short = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

/** Teinte de la couleur de la rubrique (#rrggbb + opacité en hexadécimal) */
const tint = (color: string, alpha: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : fallback);

export default function CategorySection({
    category,
    subcategories = [],
    posts,
    count,
    flip = false,
}: {
    category: CategoryView;
    subcategories?: CategoryView[];
    posts: PostCardView[];
    count: number;
    flip?: boolean;
}) {
    if (posts.length === 0) return null;
    const [lead, next, ...list] = posts;
    const href = `/category/${category.slug}/`;
    // Sans 2e article : la grande photo prend la place de la carte couleur
    const leadSpan = next ? "lg:col-span-5" : "lg:col-span-9";

    const leadCard = (
        <article key="lead" className={`group relative min-h-[320px] overflow-hidden rounded-[30px] bg-paper2 ${leadSpan}`}>
            {lead.featuredImage && <Image src={lead.featuredImage.url} alt={lead.featuredImage.alt} fill sizes="(min-width: 1536px) 660px, (min-width: 1024px) 520px, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />}
            <div className="notch-bl max-w-[86%] px-5 pb-1 pt-4">
                <p className="text-[11.5px] text-ink/55">
                    <time dateTime={lead.publishedAt}>{short(lead.publishedAt)}</time> · {lead.readingMinutes} min de lecture
                </p>
                <h3 className="mt-1.5 font-display text-[22px] leading-[1.1] sm:text-[24px]">
                    <Link href={`/${lead.slug}/`} className="after:absolute after:inset-0 hover:text-accentdark">
                        {lead.title}
                    </Link>
                </h3>
            </div>
        </article>
    );

    const nextCard = next && (
        <article key="next" className="relative flex flex-col overflow-hidden rounded-[30px] lg:col-span-4" style={{ background: tint(category.color, "2e", "#ffe3cf") }}>
            <div className="relative flex-1 p-6 pr-16">
                <p className="text-[11.5px] text-ink/55">
                    <time dateTime={next.publishedAt}>{short(next.publishedAt)}</time> · {next.readingMinutes} min de lecture
                </p>
                <h3 className="mt-2.5 font-display text-[22px] leading-[1.1]">
                    <Link href={`/${next.slug}/`} className="hover:text-accentdark">
                        {next.title}
                    </Link>
                </h3>
                {next.excerpt && <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink/65">{next.excerpt}</p>}
            </div>
            <div className="notch-tr">
                <Link href={`/${next.slug}/`} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-ink/10 transition hover:bg-ink hover:text-white" aria-label={`Lire « ${next.title} »`}>
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
    );

    const categoryCard = (
        <div key="category" className="relative order-first flex flex-col overflow-hidden rounded-[30px] p-5 lg:order-none lg:col-span-3" style={{ background: tint(category.color, "52", "#fff1d6") }}>
            <span className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/25" aria-hidden />
            <p className="relative text-[11px] font-bold uppercase tracking-[0.14em] text-ink/55">
                {count} article{count > 1 ? "s" : ""}
            </p>
            <h3 className="relative mt-1 font-display text-[30px] leading-none">{category.name}</h3>
            {category.description && <p className="relative mt-2 line-clamp-3 text-[13px] leading-relaxed text-ink/70">{category.description}</p>}
            {subcategories.length > 0 && (
                <div className="relative mt-3 flex flex-wrap gap-1.5">
                    {subcategories.map((k) => (
                        <Link key={k.id} href={`/category/${k.slug}/`} className="rounded-full bg-white/80 px-3 py-1.5 text-[12px] font-semibold ring-1 ring-ink/5 transition hover:-translate-y-px hover:bg-white">
                            {k.name}
                        </Link>
                    ))}
                </div>
            )}
            <div className="relative mt-auto flex items-center justify-between gap-3 pt-5">
                <span className="font-display text-[18px] leading-tight">Toute la rubrique</span>
                <Link href={href} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white ring-4 ring-white/50 transition hover:bg-ink hover:text-white" aria-label={`Toute la rubrique ${category.name}`}>
                    <ArrowRight className="h-5 w-5" />
                </Link>
            </div>
        </div>
    );

    // Une rubrique sur deux : la carte de la rubrique en premier, la grande photo à droite
    // (sur téléphone, la carte de la rubrique est toujours en tête)
    const cards = flip ? [categoryCard, nextCard, leadCard] : [leadCard, nextCard, categoryCard];
    return (
        <section aria-label={category.name} className="grid gap-4 lg:min-h-[320px] lg:grid-cols-12 2xl:gap-5">
            {cards}
        </section>
    );
}
