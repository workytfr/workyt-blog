/**
 * Réglages du site. Les modèles de titre reprennent ceux de Rank Math sur le
 * WordPress (relevés le 2 octobre 2026) : « %title% %sep% %sitename% » avec
 * « - » comme séparateur et « Workyt » comme nom de site.
 */
export const SITE = {
    url: (process.env.NEXT_PUBLIC_SITE_URL || "https://blog.workyt.fr").replace(/\/$/, ""),
    name: "Workyt",
    tagline: "Blog",
    titleSeparator: "-",
    description:
        "Le blog de l'association Workyt : actualités, conseils et méthodes, interviews, culture et tests pour réussir sa scolarité.",
    locale: "fr_FR",
    workytUrl: (process.env.WORKYT_URL || "https://workyt.fr").replace(/\/$/, ""),
    postsPerPage: 12,
    /** Rank Math : 1 000 liens maximum par fichier de sitemap */
    sitemapPageSize: 1000,
    /** Réseaux de l'association : à compléter ; seuls les réseaux renseignés s'affichent */
    social: {
        x: "",
        linkedin: "",
        instagram: "",
        tiktok: "",
        youtube: "",
        discord: "",
    } as Record<"x" | "linkedin" | "instagram" | "tiktok" | "youtube" | "discord", string>,
} as const;

/** Titre de page au format Rank Math : « Mon article - Workyt » */
export function pageTitle(title: string): string {
    return `${title} ${SITE.titleSeparator} ${SITE.name}`;
}

/** Adresse absolue, toujours avec « / » final (comme WordPress) */
export function absoluteUrl(path: string): string {
    const clean = path.startsWith("/") ? path : `/${path}`;
    const withSlash = /\.[a-z0-9]+$/i.test(clean) || clean.endsWith("/") ? clean : `${clean}/`;
    return `${SITE.url}${withSlash}`;
}

/** Liens de la barre fine du haut : vers le site principal */
export const WORKYT_LINKS = [
    { label: "Cours", href: `${SITE.workytUrl}/cours` },
    { label: "Fiches", href: `${SITE.workytUrl}/fiches` },
    { label: "Forum", href: `${SITE.workytUrl}/forum` },
    { label: "Devenir rédacteur", href: `${SITE.workytUrl}/a-propos` },
    { label: "Annoncer sur Workyt", href: `${SITE.workytUrl}/partenaires` },
];

/** Pages légales : elles vivent sur workyt.fr (les pages WordPress redirigent) */
export const LEGAL_LINKS = [
    { label: "À propos", href: `${SITE.workytUrl}/a-propos` },
    { label: "Mentions légales", href: `${SITE.workytUrl}/mentions-legales` },
    { label: "Confidentialité", href: `${SITE.workytUrl}/politique-confidentialite` },
    { label: "Conditions d'utilisation", href: `${SITE.workytUrl}/conditions-utilisation` },
];
