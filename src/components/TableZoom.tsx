"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";

/**
 * Tableaux trop larges pour la colonne (beaucoup de colonnes, petit écran) :
 * ils défilent dans l'article, et un bouton « Agrandir le tableau » les ouvre
 * en plein écran pour les lire d'un coup d'œil.
 */
export default function TableZoom() {
    const [table, setTable] = useState<string | null>(null);
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const buttons: HTMLButtonElement[] = [];
        const update = () => {
            document.querySelectorAll<HTMLElement>(".post-content .wk-table").forEach((wrap) => {
                const overflows = wrap.scrollWidth > wrap.clientWidth + 1;
                let btn = wrap.nextElementSibling as HTMLButtonElement | null;
                if (!btn?.classList.contains("wk-table-zoom")) {
                    btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "wk-table-zoom";
                    btn.innerHTML = '<span aria-hidden="true">⤢</span> Agrandir le tableau';
                    btn.addEventListener("click", () => setTable(wrap.querySelector("table")?.outerHTML ?? null));
                    wrap.after(btn);
                    buttons.push(btn);
                }
                btn.hidden = !overflows;
                wrap.classList.toggle("wk-table--scroll", overflows);
            });
        };
        update();
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("resize", update);
            buttons.forEach((b) => b.remove());
        };
    }, []);

    useEffect(() => {
        if (!table) return;
        closeRef.current?.focus();
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTable(null);
        document.addEventListener("keydown", onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = overflow;
        };
    }, [table]);

    if (!table) return null;
    return createPortal(
        <div className="fixed inset-0 z-[90] flex flex-col bg-paper" role="dialog" aria-modal="true" aria-label="Tableau en plein écran">
            <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3 sm:px-6">
                <span className="flex items-center gap-2 text-sm font-semibold">
                    <Maximize2 className="h-4 w-4" /> Tableau
                </span>
                <button ref={closeRef} type="button" onClick={() => setTable(null)} className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3.5 py-1.5 text-sm font-semibold hover:bg-ink/5">
                    <X className="h-4 w-4" /> Fermer
                </button>
            </div>
            <p className="px-4 pt-3 text-xs text-ink/55 sm:hidden">Astuce : tourne ton téléphone pour voir plus de colonnes.</p>
            {/* HTML déjà assaini (rendu de l'article) */}
            <div className="post-content wk-table-full flex-1 overflow-auto p-4 sm:p-6" dangerouslySetInnerHTML={{ __html: table }} />
        </div>,
        document.body
    );
}
