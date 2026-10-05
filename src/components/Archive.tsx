import { notFound, permanentRedirect } from "next/navigation";
import type { PostList } from "@/lib/content";
import PostCard from "./PostCard";
import Pagination from "./Pagination";
import Sidebar from "./Sidebar";

/**
 * Numéro de page d'une adresse /…/page/<n>/ : entier ≥ 2. « page/1 » renvoie
 * vers l'adresse sans numéro (comme WordPress), le reste est introuvable.
 */
export function parsePageParam(raw: string | undefined, base: string): number {
    if (raw === undefined) return 1;
    if (!/^\d+$/.test(raw)) notFound();
    const n = Number(raw);
    if (n <= 1) permanentRedirect(base);
    return n;
}

export default function Archive({
    eyebrow,
    title,
    description,
    header,
    list,
    base,
    query,
}: {
    eyebrow: string;
    title: string;
    description?: string;
    /** En-tête personnalisé (page auteur) à la place du titre */
    header?: React.ReactNode;
    list: PostList;
    base: string;
    query?: string;
}) {
    // Page au-delà de la dernière : introuvable (et non une page vide indexée)
    if (list.page > 1 && list.items.length === 0) notFound();
    return (
        <div className="mx-auto grid max-w-[1240px] gap-12 px-6 pb-20 pt-12 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
                {header ?? (
                    <header>
                        <p className="eyebrow">{eyebrow}</p>
                        <h1 className="mt-2 font-display text-[44px] leading-[1.05] tracking-tight sm:text-[52px]">{title}</h1>
                        {description && <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ink/60">{description}</p>}
                    </header>
                )}
                <p className="mt-6 text-sm text-ink/50">
                    {list.total} article{list.total > 1 ? "s" : ""}
                    {list.page > 1 && ` · page ${list.page} sur ${list.pages}`}
                </p>
                {list.items.length === 0 ? (
                    <div className="mt-6 rounded-[24px] border border-dashed border-ink/15 bg-white p-10 text-center text-ink/60">Aucun article pour l&apos;instant.</div>
                ) : (
                    <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2">
                        {list.items.map((p, i) => (
                            <PostCard key={p.id} post={p} priority={i < 2} />
                        ))}
                    </div>
                )}
                <Pagination base={base} page={list.page} pages={list.pages} query={query} />
            </div>
            <Sidebar />
        </div>
    );
}
