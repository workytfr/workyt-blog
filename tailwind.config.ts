import type { Config } from "tailwindcss";

/** Couleurs et polices de workyt.fr (Funnel Display + Montserrat uniquement). */
const config: Config = {
    darkMode: "class",
    content: ["./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            // Couleurs du thème en variables (clair / sombre, voir globals.css)
            colors: {
                ink: "rgb(var(--c-ink) / <alpha-value>)",
                paper: "rgb(var(--c-paper) / <alpha-value>)",
                paper2: "rgb(var(--c-paper2) / <alpha-value>)",
                // Cartes pastel de l'accueil (version foncée en mode sombre)
                peach: "rgb(var(--c-peach) / <alpha-value>)",
                skysoft: "rgb(var(--c-skysoft) / <alpha-value>)",
                cream: "rgb(var(--c-cream) / <alpha-value>)",
                accent: "#ff6a1a",
                accentdark: "#c24a0a",
                sun: "#ffb547",
                sky: "#6ec1e4",
                leaf: "#7ed957",
            },
            // Fonds : « bg-white » = surface des cartes, « bg-ink » = bloc sombre (reste sombre en mode sombre)
            backgroundColor: {
                white: "rgb(var(--c-surface) / <alpha-value>)",
                ink: "rgb(var(--c-night) / <alpha-value>)",
            },
            gradientColorStops: {
                ink: "rgb(var(--c-night) / <alpha-value>)",
            },
            fontFamily: {
                display: ["var(--font-funnel-display)", "system-ui", "sans-serif"],
                sans: ["var(--font-montserrat)", "system-ui", "sans-serif"],
                mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
            },
        },
    },
    plugins: [],
};

export default config;
