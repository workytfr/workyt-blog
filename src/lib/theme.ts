/**
 * Thème clair / sombre du blog public. Choix du lecteur gardé dans le
 * navigateur (localStorage « wk-theme »), sinon réglage du système. Le
 * dashboard reste en clair.
 */

export type Theme = "light" | "dark";
export const THEME_KEY = "wk-theme";

/**
 * Script du <head>, exécuté avant l'affichage : pas de flash blanc au
 * chargement d'une page en mode sombre.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;if(d&&location.pathname.indexOf("/dashboard")!==0)document.documentElement.classList.add("dark")}catch(e){}})()`;

/** Thème choisi par le lecteur, ou celui du système */
export function preferredTheme(): Theme {
    try {
        const t = localStorage.getItem(THEME_KEY);
        if (t === "light" || t === "dark") return t;
    } catch {
        /* stockage indisponible : réglage du système */
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
}
