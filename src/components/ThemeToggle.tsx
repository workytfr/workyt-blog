"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_KEY, applyTheme, preferredTheme } from "@/lib/theme";

/** Le thème affiché = la classe « dark » de <html> (posée par le script du <head> ou par ce bouton) */
function subscribe(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
}
const isDark = () => document.documentElement.classList.contains("dark");

/** Bouton clair / sombre de l'en-tête */
export default function ThemeToggle({ className = "" }: { className?: string }) {
    const dark = useSyncExternalStore(subscribe, isDark, () => false);

    // En revenant du dashboard (toujours clair), on remet le thème du lecteur
    useEffect(() => applyTheme(preferredTheme()), []);

    const toggle = () => {
        const next = dark ? "light" : "dark";
        try {
            localStorage.setItem(THEME_KEY, next);
        } catch {
            /* navigation privée : le choix vaut pour la page */
        }
        applyTheme(next);
    };

    return (
        <button type="button" onClick={toggle} className={className} aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"} title={dark ? "Mode clair" : "Mode sombre"}>
            {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
    );
}
