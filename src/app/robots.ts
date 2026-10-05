import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/** robots.txt : tout est ouvert sauf la rédaction et les API ; sitemap = index Rank Math */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard/", "/api/", "/connexion/", "/search/", "/apercu/", "/go/", "/?s="] }],
        sitemap: `${SITE.url}/sitemap_index.xml`,
        host: SITE.url,
    };
}
