"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { MousePointerClick } from "lucide-react";

/**
 * Enregistrement des sessions Umami (recorder.js) : il n'entre pas dans
 * l'exemption de la CNIL pour la mesure d'audience, il faut l'accord du
 * lecteur. Rien n'est chargé avant « Accepter » ; refuser est aussi simple
 * qu'accepter, et le choix se change depuis le pied de page.
 * La mesure d'audience sans cookie (script.js) reste chargée à part.
 */

const KEY = "wk-consent-replay";
const OPEN_EVENT = "wk-consent-open";
const CHANGE_EVENT = "wk-consent-change";

type Choice = "yes" | "no" | null;

function readChoice(): Choice {
    try {
        const v = localStorage.getItem(KEY);
        return v === "yes" || v === "no" ? v : null;
    } catch {
        return "no";
    }
}

function subscribe(cb: () => void) {
    window.addEventListener(CHANGE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
        window.removeEventListener(CHANGE_EVENT, cb);
        window.removeEventListener("storage", cb);
    };
}

export default function ReplayConsent({ src, websiteId }: { src: string; websiteId: string }) {
    const pathname = usePathname();
    // « undefined » côté serveur : le bandeau n'apparaît qu'une fois le choix lu (pas de clignotement)
    const choice = useSyncExternalStore<Choice | undefined>(subscribe, readChoice, () => undefined);
    const [reopened, setReopened] = useState(false);

    useEffect(() => {
        const reopen = () => setReopened(true);
        window.addEventListener(OPEN_EVENT, reopen);
        return () => window.removeEventListener(OPEN_EVENT, reopen);
    }, []);

    // La rédaction n'est jamais enregistrée (brouillons, données de l'équipe)
    if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/connexion")) return null;

    const decide = (c: "yes" | "no") => {
        const before = choice;
        try {
            localStorage.setItem(KEY, c);
        } catch {
            /* navigation privée : le choix vaut pour cette page */
        }
        setReopened(false);
        window.dispatchEvent(new Event(CHANGE_EVENT));
        // Retrait d'un accord : on recharge pour arrêter l'enregistrement déjà lancé
        if (before === "yes" && c === "no") window.location.reload();
    };

    const open = choice === null || (choice !== undefined && reopened);

    return (
        <>
            {choice === "yes" && <Script src={src} data-website-id={websiteId} strategy="lazyOnload" />}
            {open && (
                <section
                    role="dialog"
                    aria-labelledby="wk-consent-title"
                    aria-describedby="wk-consent-text"
                    className="fixed inset-x-3 bottom-3 z-[60] overflow-hidden rounded-[30px] border border-ink/10 bg-white p-6 text-ink shadow-[0_18px_50px_rgba(26,21,18,0.18)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:max-w-md print:hidden"
                >
                    <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-sun/30 blur-2xl" aria-hidden />
                    <div className="relative">
                        <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-peach text-accentdark" aria-hidden>
                                <MousePointerClick className="h-5 w-5" />
                            </span>
                            <div>
                                <p className="eyebrow">Ta navigation, ton choix</p>
                                <h2 id="wk-consent-title" className="font-display text-xl leading-tight">
                                    Tu nous aides à améliorer le blog ?
                                </h2>
                            </div>
                        </div>
                        <p id="wk-consent-text" className="mt-3 text-sm text-ink/75">
                            Avec ton accord, on enregistre anonymement tes clics et ton défilement pour repérer ce qui gêne la lecture. Aucun cookie, rien n&apos;est revendu. Sans accord, rien n&apos;est enregistré.
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                            <button type="button" onClick={() => decide("yes")} className="btn-orange px-5 py-2.5 text-sm">
                                Accepter
                            </button>
                            <button type="button" onClick={() => decide("no")} className="btn-ghost px-5 py-2.5 text-sm">
                                Refuser
                            </button>
                        </div>
                    </div>
                </section>
            )}
        </>
    );
}

/** Lien du pied de page : rouvre le bandeau pour changer d'avis */
export function ConsentSettingsButton({ className }: { className?: string }) {
    return (
        <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
            Gérer mes préférences
        </button>
    );
}
