import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * robots.txt : tout est ouvert sauf la rédaction et les API ; sitemap = index Rank Math.
 * La recherche n'est pas bloquée : elle est en noindex, et Google doit pouvoir le lire
 * pour sortir de l'index les anciennes adresses « /?s= » du WordPress.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard/", "/api/", "/connexion/", "/apercu/", "/go/"] }],
        sitemap: `${SITE.url}/sitemap_index.xml`,
        host: SITE.url,
    };
}
