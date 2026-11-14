import type { NextConfig } from "next";

/**
 * Hôtes des images (médiathèque R2, et images de démonstration en local).
 * MEDIA_HOSTS="pub-xxx.r2.dev,images.unsplash.com"
 */
const mediaHosts = (process.env.MEDIA_HOSTS || "images.unsplash.com")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

/**
 * Politique de sécurité du contenu (CSP), en deux temps :
 *  - imposée : seulement des règles sans risque de casse (pas de plugins,
 *    pas de <base> détourné, pas d'affichage dans un cadre étranger,
 *    formulaires vers le blog ou la connexion workyt.fr) ;
 *  - « Report-Only » : la politique complète, qui ne bloque rien mais signale
 *    dans la console du navigateur ce qu'elle aurait bloqué. Après quelques
 *    jours sans alerte, la passer dans « Content-Security-Policy ».
 * 'unsafe-inline' (scripts) : Next injecte ses scripts en ligne sans nonce
 * (pages en cache) ; un nonce imposerait le rendu dynamique de tout le site.
 * Lu au build : WORKYT_URL et NEXT_PUBLIC_UMAMI_URL doivent y être définis.
 */
const origin = (url: string | undefined) => {
    try {
        return url ? new URL(url).origin : "";
    } catch {
        return "";
    }
};
const workyt = origin(process.env.WORKYT_URL || "https://workyt.fr");
const umami = origin(process.env.NEXT_PUBLIC_UMAMI_URL);
// Extraits audio des articles (lecteur, API et statistiques d'écoute)
const vokyt = origin(process.env.VOKYT_URL || "https://vokyt.cc");
// Dépôt des fichiers audio envoyés depuis l'éditeur (adresse signée du stockage de Vokyt)
const vokytUpload = origin(process.env.VOKYT_UPLOAD_URL || "https://s3.vokyt.cc");
const dev = process.env.NODE_ENV !== "production";
// Lecteurs intégrés (src/lib/render.ts, src/lib/embeds.ts)
const frameHosts = ["https://www.youtube-nocookie.com", "https://www.youtube.com", "https://player.vimeo.com", "https://www.dailymotion.com", "https://open.spotify.com", "https://www.instagram.com", "https://www.tiktok.com"];
const cspBase = ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'self'", `form-action 'self' ${workyt}`];
const cspFull = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} ${umami} ${vokyt}`,
    // KaTeX, styles en ligne de React et de l'éditeur
    "style-src 'self' 'unsafe-inline'",
    // Images des articles : médiathèque, anciens contenus WordPress, banques d'images…
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' https:",
    `connect-src 'self' ${umami} ${vokyt} ${vokytUpload}${dev ? " ws:" : ""}`,
    `frame-src 'self' ${frameHosts.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...cspBase,
];
const csp = (rules: string[]) => rules.map((r) => r.replace(/\s+/g, " ").trim()).join("; ");

const nextConfig: NextConfig = {
    poweredByHeader: false,
    // Format attendu par l'hébergeur (comme workyt-next)
    output: "standalone",
    outputFileTracingRoot: import.meta.dirname,
    // Correcteur de langue : le serveur lit Grammalecte sur le disque pour la note SEO enregistrée
    outputFileTracingIncludes: { "/api/posts/**": ["./public/grammalecte-2.3.0/**/*"] },
    // Les adresses WordPress finissent toutes par « / » : on garde la même forme
    // (les fichiers .xml/.txt ne sont pas concernés).
    trailingSlash: true,
    images: {
        // Une image d'article ne change pas : 31 jours (4 h par défaut), le serveur la recalcule moins souvent
        minimumCacheTTL: 2678400,
        remotePatterns: mediaHosts.map((hostname) => ({ protocol: "https", hostname, pathname: "/**" })),
    },
    async redirects() {
        return [
            // Ponda Podcast a sa page : l'adresse de rubrique y renvoie (le flux /category/ponda-podcast/feed/ reste servi)
            { source: "/category/ponda-podcast", destination: "/ponda-podcast/", permanent: true },
            { source: "/category/ponda-podcast/page/:n", destination: "/ponda-podcast/page/:n/", permanent: true },
            // Les navigateurs et les robots demandent encore /favicon.ico
            { source: "/favicon.ico", destination: "/icon1.ico", permanent: true },
            // Rank Math servait aussi sitemap.xml : on renvoie vers l'index
            { source: "/sitemap.xml", destination: "/sitemap_index.xml", permanent: true },
            // Anciennes formes d'adresses WordPress / Pixwell
            { source: "/:slug/amp", destination: "/:slug/", permanent: true },
            // Avant « /:slug/feed », qui l'attraperait sinon (la première règle qui correspond gagne)
            { source: "/comments/feed", destination: "/feed/", permanent: true },
            { source: "/feed/:kind(rss2|atom|rss|rdf)", destination: "/feed/", permanent: true },
            { source: "/:kind(tag|author)/:slug/feed", destination: "/:kind/:slug/", permanent: true },
            { source: "/:slug/feed", destination: "/:slug/", permanent: true },
            { source: "/:slug/embed", destination: "/:slug/", permanent: true },
            { source: "/:year(\\d{4})", destination: "/", permanent: true },
            { source: "/:year(\\d{4})/:month(\\d{2})", destination: "/", permanent: true },
            { source: "/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})", destination: "/", permanent: true },
            { source: "/wp-admin/:path*", destination: "/dashboard/", permanent: true },
            { source: "/wp-login.php", destination: "/connexion/", permanent: true },
        ];
    },
    async rewrites() {
        return [
            // Sitemaps aux adresses de Rank Math : post-sitemap.xml, post-sitemap2.xml…
            { source: "/:type(post|category|author)-sitemap.xml", destination: "/sitemaps/:type/1" },
            { source: "/:type(post|category|author)-sitemap:page(\\d+).xml", destination: "/sitemaps/:type/:page" },
        ];
    },
    async headers() {
        return [
            {
                // Logos et icônes de /public (pas les fichiers de Next, déjà en cache définitif) : 30 jours dans le navigateur (ils étaient redemandés toutes les 4 h)
                source: "/:file((?!_next/).+\.(?:svg|png|ico|ttf))",
                headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
            },
            {
                source: "/:path*",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                    // HTTPS obligatoire pendant un an, sous-domaines compris (pas de « preload » : irréversible)
                    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
                    // Fonctions du navigateur inutiles au blog ; plein écran et lecture auto restent permis aux lecteurs intégrés
                    // Micro : le site lui-même seulement (enregistrement des extraits audio dans l'éditeur)
                    { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()" },
                    { key: "Content-Security-Policy", value: csp(cspBase) },
                    { key: "Content-Security-Policy-Report-Only", value: csp(cspFull) },
                ],
            },
        ];
    },
};

export default nextConfig;
