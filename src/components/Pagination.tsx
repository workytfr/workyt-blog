import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Pagination aux adresses WordPress : /page/2/, /category/x/page/2/…
 * `base` finit par « / » ; la page 1 est la base elle-même.
 */
export default function Pagination({ base, page, pages, query = "" }: { base: string; page: number; pages: number; query?: string }) {
    if (pages <= 1) return null;
    const href = (n: number) => `${n <= 1 ? base : `${base}page/${n}/`}${query}`;
    const around = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
    return (
        <nav className="mt-12 flex items-center justify-center gap-1" aria-label="Pagination">
            {page > 1 && (
                <Link href={href(page - 1)} className="btn-ghost px-3.5 py-2 text-sm" rel="prev">
                    <ChevronLeft className="h-4 w-4" /> Précédent
                </Link>
            )}
            {around.map((n, i) => (
                <span key={n} className="flex items-center">
                    {i > 0 && n - around[i - 1] > 1 && <span className="px-1 text-ink/40">…</span>}
                    <Link
                        href={href(n)}
                        aria-current={n === page ? "page" : undefined}
                        className={`grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm font-semibold ${n === page ? "bg-ink text-white" : "hover:bg-paper2"}`}
                    >
                        {n}
                    </Link>
                </span>
            ))}
            {page < pages && (
                <Link href={href(page + 1)} className="btn-ghost px-3.5 py-2 text-sm" rel="next">
                    Suivant <ChevronRight className="h-4 w-4" />
                </Link>
            )}
        </nav>
    );
}
