import Link from "next/link";
import { LEGAL_LINKS, WORKYT_LINKS } from "@/lib/site";
import { menuCategories } from "@/lib/content";
import { getSettings } from "@/lib/settings";
import { BlogLogo } from "./SiteHeader";

/** Pied de page propre au blog ; les pages légales renvoient vers workyt.fr */
export default async function SiteFooter() {
    const menu = await menuCategories();
    return (
        <footer className="bg-ink text-white/70">
            <div className="mx-auto grid max-w-[1600px] gap-10 px-6 py-14 lg:px-10 text-sm sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
                <div>
                    <BlogLogo />
                    <p className="mt-4 max-w-xs">{(await getSettings()).description}</p>
                </div>
                <div>
                    <div className="font-semibold text-white">Rubriques</div>
                    <ul className="mt-3 space-y-2">
                        {menu.map((c) => (
                            <li key={c.id}>
                                <Link href={`/category/${c.slug}/`} className="hover:text-white">
                                    {c.name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <div className="font-semibold text-white">Workyt</div>
                    <ul className="mt-3 space-y-2">
                        {WORKYT_LINKS.map((l) => (
                            <li key={l.label}>
                                <a href={l.href} className="hover:text-white">
                                    {l.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <div className="font-semibold text-white">Infos</div>
                    <ul className="mt-3 space-y-2">
                        {LEGAL_LINKS.map((l) => (
                            <li key={l.label}>
                                <a href={l.href} className="hover:text-white">
                                    {l.label}
                                </a>
                            </li>
                        ))}
                        <li>
                            <Link href="/feed/" className="hover:text-white">
                                Flux RSS
                            </Link>
                        </li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-white/10 py-5 text-center text-xs text-white/45">© {new Date().getFullYear()} Workyt · association loi 1901</div>
        </footer>
    );
}
