import Image from "next/image";
import Link from "next/link";
import { categoriesWithCounts, mostReadPosts } from "@/lib/content";
import { SITE } from "@/lib/site";

/** Colonne de widgets (Pixwell) : présentation, les plus lus, newsletter, rubriques */
export default async function Sidebar() {
    const [popular, cats] = await Promise.all([mostReadPosts(3), categoriesWithCounts()]);
    return (
        <aside className="space-y-6">
            <div className="widget">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG, déjà léger */}
                <img src="/logo-blog-workyt.svg" alt="Le blog de Workyt" width={2485} height={549} className="h-12 w-auto" />
                <div className="mt-2 text-xs text-ink/55">Association · éducation gratuite</div>
                <p className="mt-3 text-sm leading-relaxed text-ink/65">{SITE.description}</p>
                <a href={SITE.workytUrl} className="btn-ink mt-4 w-full justify-center py-2.5 text-sm">
                    Découvrir Workyt
                </a>
            </div>

            {popular.length > 0 && (
                <div className="widget">
                    <h2 className="widget-title">Les plus lus</h2>
                    <ol className="mt-4 space-y-4">
                        {popular.map((p, i) => (
                            <li key={p.id} className="relative flex items-center gap-3">
                                <span className="w-5 font-display text-3xl text-accent/40">{i + 1}</span>
                                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-paper2">
                                    {p.featuredImage && <Image src={p.featuredImage.url} alt="" fill sizes="56px" className="object-cover" />}
                                </span>
                                <Link href={`/${p.slug}/`} className="text-sm font-semibold leading-snug after:absolute after:inset-0 hover:text-accentdark">
                                    {p.title}
                                </Link>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            <div className="sticky top-28 space-y-6">
                <div className="widget !border-transparent !bg-ink text-white">
                    <h2 className="widget-title text-white">Le récap du mercredi</h2>
                    <p className="mt-3 text-sm text-white/65">Les nouveaux articles, cours et fiches de la semaine, dans ta boîte mail.</p>
                    <a href={`${SITE.workytUrl}/compte`} className="btn-orange mt-4 w-full justify-center py-2.5 text-sm">
                        Je m&apos;abonne sur Workyt
                    </a>
                </div>
                {cats.length > 0 && (
                    <div className="widget">
                        <h2 className="widget-title">Rubriques</h2>
                        <ul className="mt-3 space-y-2 text-sm">
                            {cats.map((c) => (
                                <li key={c.id} className="flex items-center justify-between">
                                    <Link href={`/category/${c.slug}/`} className="flex items-center gap-2 hover:text-accentdark">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                                        {c.name}
                                    </Link>
                                    <span className="chip !py-0">{c.count}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </aside>
    );
}
