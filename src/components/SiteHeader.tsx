import Link from "next/link";
import { ChevronDown, Menu, Rss, Search, X } from "lucide-react";
import { siDiscord, siInstagram, siLinkedin, siTiktok, siX, siYoutube } from "simple-icons";
import { getSettings } from "@/lib/settings";
import { SITE, WORKYT_LINKS } from "@/lib/site";
import { menuCategories } from "@/lib/content";
import { BrandIcon } from "./ui";
import AuthButton from "./AuthButton";
import ThemeToggle from "./ThemeToggle";

const SOCIAL_ICONS = { x: siX, linkedin: siLinkedin, instagram: siInstagram, tiktok: siTiktok, youtube: siYoutube, discord: siDiscord } as const;

/** Logo « workyt le blog' » (renard au contour blanc : lisible sur fond clair comme sombre) */
export function BlogLogo({ compact = false }: { compact?: boolean }) {
    return (
        <Link href="/" className="flex shrink-0 items-center px-1" aria-label="Le blog de Workyt — accueil">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG, déjà léger */}
            <img src="/logo-blog-workyt.svg" alt="Le blog de Workyt" width={2485} height={549} className={`w-auto ${compact ? "h-9 sm:h-10" : "h-12"}`} />
        </Link>
    );
}

/**
 * En-tête du blog (site séparé de workyt.fr) : une ligne discrète de liens
 * vers Workyt, puis une barre flottante en pilule — logo, rubriques séparées
 * par des points, recherche, connexion.
 */
export default async function SiteHeader() {
    const [menu, settings] = await Promise.all([menuCategories(), getSettings()]);
    // Réseaux renseignés dans les réglages du dashboard
    const social = settings.social;
    const socials = (Object.keys(SOCIAL_ICONS) as (keyof typeof SOCIAL_ICONS)[]).filter((k) => social[k]);
    const roundBtn = "grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full bg-white text-ink/70 ring-1 ring-ink/10 transition hover:text-ink hover:ring-ink/25 [&::-webkit-details-marker]:hidden";

    return (
        <>
            {/* Liens vers Workyt */}
            <div className="text-[12.5px] text-ink/55">
                <div className="mx-auto flex max-w-[1240px] items-center gap-5 px-6 pt-3">
                    <a href={SITE.workytUrl} className="opacity-80 transition hover:opacity-100" title="Workyt">
                        {/* eslint-disable-next-line @next/next/no-img-element -- logo, déjà à la bonne taille */}
                        <img src="/logo-workyt-noir.png" alt="Workyt" width={450} height={96} className="h-4 w-auto dark:invert" />
                    </a>
                    <nav className="hidden items-center gap-5 md:flex" aria-label="Workyt">
                        {WORKYT_LINKS.map((l) => (
                            <a key={l.label} href={l.href} className="hover:text-ink">
                                {l.label}
                            </a>
                        ))}
                    </nav>
                    <div className="ml-auto flex items-center gap-3.5">
                        {socials.map((k) => (
                            <a key={k} href={social[k]} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100" title={SOCIAL_ICONS[k].title}>
                                <BrandIcon path={SOCIAL_ICONS[k].path} color="currentColor" size={14} title={SOCIAL_ICONS[k].title} />
                            </a>
                        ))}
                        <Link href="/feed/" title="Flux RSS" className="hover:text-ink">
                            <Rss className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Barre principale, flottante */}
            <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
                <div className="mx-auto flex max-w-[1240px] items-center gap-2 rounded-full border border-ink/10 bg-paper/85 py-2 pl-2 pr-2 sm:gap-3 sm:pl-3 shadow-[0_10px_30px_rgba(26,21,18,.06)] backdrop-blur-md">
                    <BlogLogo compact />

                    <nav className="mx-auto hidden items-center rounded-full bg-white px-1.5 py-1 ring-1 ring-ink/5 lg:flex" aria-label="Rubriques">
                        {menu.map((c, i) => (
                            <div key={c.id} className="group relative flex items-center">
                                {i > 0 && <span className="mx-0.5 h-1 w-1 rounded-full bg-ink/25" aria-hidden />}
                                <Link href={`/category/${c.slug}/`} className="flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-[13.5px] font-medium text-ink/65 transition hover:bg-paper2 hover:text-ink">
                                    {c.name}
                                    {c.children.length > 0 && <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
                                </Link>
                                {c.children.length > 0 && (
                                    <div className="invisible absolute left-0 top-full z-50 min-w-56 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                                        <div className="rounded-2xl border border-ink/10 bg-white p-2 shadow-[0_18px_44px_rgba(26,21,18,.12)]">
                                            {c.children.map((k) => (
                                                <Link key={k.id} href={`/category/${k.slug}/`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-paper2">
                                                    <span className="h-2 w-2 rounded-full" style={{ background: k.color }} />
                                                    {k.name}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </nav>

                    <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:ml-0">
                        {/* Recherche (/?s= comme WordPress) ; sur mobile, elle est dans le menu */}
                        <details className="group relative hidden sm:block">
                            <summary className={roundBtn} aria-label="Rechercher">
                                <Search className="h-[18px] w-[18px]" />
                            </summary>
                            <form action="/" role="search" className="absolute right-0 top-12 z-50 flex w-80 gap-2 rounded-full border border-ink/10 bg-white p-1.5 shadow-[0_18px_44px_rgba(26,21,18,.14)]">
                                <input name="s" autoFocus placeholder="Rechercher un article…" className="min-w-0 flex-1 rounded-full px-4 text-sm outline-none" />
                                <button className="btn-orange px-4 py-2 text-sm">OK</button>
                            </form>
                        </details>

                        <ThemeToggle className={roundBtn} />

                        <AuthButton />

                        {/* Menu mobile (sans JavaScript) */}
                        <details className="group relative lg:hidden">
                            <summary className={roundBtn} aria-label="Menu">
                                <Menu className="h-[18px] w-[18px] group-open:hidden" />
                                <X className="hidden h-[18px] w-[18px] group-open:block" />
                            </summary>
                            <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-ink/10 bg-white p-3 shadow-[0_18px_44px_rgba(26,21,18,.16)]">
                                <p className="eyebrow px-2 pb-1">Rubriques</p>
                                {menu.map((c) => (
                                    <div key={c.id}>
                                        <Link href={`/category/${c.slug}/`} className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold hover:bg-paper2">
                                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                                            {c.name}
                                        </Link>
                                        {c.children.map((k) => (
                                            <Link key={k.id} href={`/category/${k.slug}/`} className="ml-5 block rounded-xl px-2 py-1.5 text-sm text-ink/70 hover:bg-paper2">
                                                {k.name}
                                            </Link>
                                        ))}
                                    </div>
                                ))}
                                <form action="/" role="search" className="mt-3 border-t border-ink/10 px-1 pt-3">
                                    <input name="s" placeholder="Rechercher un article…" className="w-full rounded-full border border-ink/15 px-4 py-2 text-sm outline-none focus:border-accent" />
                                </form>
                                <p className="eyebrow mt-3 px-2 pb-1">Workyt</p>
                                {WORKYT_LINKS.map((l) => (
                                    <a key={l.label} href={l.href} className="block rounded-xl px-2 py-1.5 text-sm text-ink/70 hover:bg-paper2">
                                        {l.label}
                                    </a>
                                ))}
                            </div>
                        </details>
                    </div>
                </div>
            </header>
        </>
    );
}
