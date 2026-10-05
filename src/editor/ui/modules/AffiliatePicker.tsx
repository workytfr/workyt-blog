"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertTriangle, Loader2, ShoppingBag, X } from "lucide-react";
import { useAffiliateLinks } from "./fields";

/**
 * Choix d'un lien affilié du gestionnaire : le texte sélectionné devient un
 * lien /go/<nom>/, marqué « sponsorisé » dans l'article (§ 9.1).
 */
export default function AffiliatePicker({ onPick, onClose }: { onPick: (href: string) => void; onClose: () => void }) {
    const links = useAffiliateLinks();
    return createPortal(
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label="Lien affilié" onClick={onClose}>
            <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 border-b border-ink/10 px-6 py-4">
                    <ShoppingBag className="h-5 w-5 text-accent" />
                    <h2 className="flex-1 font-display text-2xl">Lien affilié</h2>
                    <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper2" aria-label="Fermer">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {links === null ? (
                        <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-ink/30" />
                    ) : links.length === 0 ? (
                        <p className="p-6 text-center text-sm text-ink/55">
                            Aucun lien pour l&apos;instant. La rédaction en chef les crée dans{" "}
                            <Link href="/dashboard/liens/" className="font-semibold text-accentdark underline">
                                Liens affiliés
                            </Link>
                            .
                        </p>
                    ) : (
                        <ul className="space-y-1.5">
                            {links.map((l) => (
                                <li key={l.id}>
                                    <button type="button" onClick={() => onPick(l.href)} className="flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-left hover:border-accent">
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold">{l.label}</span>
                                            <span className="block text-xs text-ink/50">
                                                {l.href}
                                                {l.merchant ? ` · ${l.merchant}` : ""}
                                            </span>
                                        </span>
                                        {(l.health === "dead" || l.expired) && (
                                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                                <AlertTriangle className="h-3 w-3" /> {l.health === "dead" ? "cassé" : "expiré"}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <p className="border-t border-ink/10 px-6 py-3 text-[11px] text-ink/50">Le texte sélectionné devient le lien. Il est marqué « sponsorisé » et la mention de transparence s&apos;ajoute en tête de l&apos;article.</p>
            </div>
        </div>,
        document.body
    );
}
