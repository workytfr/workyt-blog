/**
 * Thème clair / sombre du blog public. Clair par défaut ; le sombre seulement
 * si le lecteur l'a choisi avec le bouton (gardé dans le navigateur,
 * localStorage « wk-theme »). Le dashboard reste en clair.
 */

export type Theme = "light" | "dark";
export const THEME_KEY = "wk-theme";

/**
 * Script du <head>, exécuté avant l'affichage : pas de flash blanc au
 * chargement d'une page quand le lecteur a choisi le mode sombre.
 */
export const THEME_SCRIPT = `(function(){try{if(localStorage.getItem("${THEME_KEY}")==="dark"&&location.pathname.indexOf("/dashboard")!==0)document.documentElement.classList.add("dark")}catch(e){}})()`;

/** Thème choisi par le lecteur, sinon clair */
export function preferredTheme(): Theme {
    try {
        if (localStorage.getItem(THEME_KEY) === "dark") return "dark";
    } catch {
        /* stockage indisponible : clair */
    }
    return "light";
}

export function applyTheme(theme: Theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
}
