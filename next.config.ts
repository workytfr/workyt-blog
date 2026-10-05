import type { NextConfig } from "next";

/**
 * Hôtes des images (médiathèque R2, et images de démonstration en local).
 * MEDIA_HOSTS="pub-xxx.r2.dev,images.unsplash.com"
 */
const mediaHosts = (process.env.MEDIA_HOSTS || "images.unsplash.com")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

const nextConfig: NextConfig = {
    poweredByHeader: false,
    // Format attendu par l'hébergeur (comme workyt-next)
    output: "standalone",
    outputFileTracingRoot: import.meta.dirname,
    // Les adresses WordPress finissent toutes par « / » : on garde la même forme
    // (les fichiers .xml/.txt ne sont pas concernés).
    trailingSlash: true,
    images: {
        remotePatterns: mediaHosts.map((hostname) => ({ protocol: "https", hostname, pathname: "/**" })),
    },
    async redirects() {
        return [
            // Rank Math servait aussi sitemap.xml : on renvoie vers l'index
            { source: "/sitemap.xml", destination: "/sitemap_index.xml", permanent: true },
            // Anciennes formes d'adresses WordPress / Pixwell
            { source: "/:slug/amp", destination: "/:slug/", permanent: true },
            { source: "/:slug/feed", destination: "/:slug/", permanent: true },
            { source: "/:slug/embed", destination: "/:slug/", permanent: true },
            { source: "/:year(\\d{4})", destination: "/", permanent: true },
            { source: "/:year(\\d{4})/:month(\\d{2})", destination: "/", permanent: true },
            { source: "/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})", destination: "/", permanent: true },
            { source: "/wp-admin/:path*", destination: "/dashboard/", permanent: true },
            { source: "/wp-login.php", destination: "/connexion/", permanent: true },
            { source: "/comments/feed", destination: "/feed/", permanent: true },
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
                source: "/:path*",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                ],
            },
        ];
    },
};

export default nextConfig;
