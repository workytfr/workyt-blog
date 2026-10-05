"use client";

import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import NewPostButton from "./NewPostButton";

/** Barre du haut (§ 13.1) : recherche globale (articles, médias, personnes) et « Nouvel article » ; absente de l'éditeur */
export default function TopBar({ canWrite }: { canWrite: boolean }) {
    const path = usePathname() || "";
    const router = useRouter();
    if (/^\/dashboard\/articles\/[0-9a-f]{24}\/?$/.test(path)) return null;
    return (
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink/10 bg-paper/90 px-10 py-3 backdrop-blur">
            <form
                role="search"
                onSubmit={(e) => {
                    e.preventDefault();
                    const q = new FormData(e.currentTarget).get("q")?.toString().trim();
                    if (q) router.push(`/dashboard/recherche/?q=${encodeURIComponent(q)}`);
                }}
                className="flex w-full max-w-md items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm focus-within:border-accent"
            >
                <Search className="h-4 w-4 text-ink/40" />
                <input name="q" placeholder="Chercher un article, une image, une personne…" className="min-w-0 flex-1 bg-transparent outline-none" aria-label="Recherche dans la rédaction" />
            </form>
            {canWrite && (
                <div className="ml-auto">
                    <NewPostButton compact />
                </div>
            )}
        </div>
    );
}
