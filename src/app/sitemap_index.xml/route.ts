import { sitemapIndexXml } from "@/lib/sitemaps";
import { xmlResponse } from "@/lib/feed";

// Généré à la demande (le build n'a pas besoin de la base) ; mis en cache 5 min par le navigateur et les proxys
export const dynamic = "force-dynamic";

/** GET /sitemap_index.xml — index des sitemaps (adresse Rank Math) */
export async function GET() {
    return xmlResponse(await sitemapIndexXml());
}
