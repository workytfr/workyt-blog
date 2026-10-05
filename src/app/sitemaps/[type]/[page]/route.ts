import { SITEMAP_TYPES, sitemapXml, type SitemapType } from "@/lib/sitemaps";
import { xmlResponse } from "@/lib/feed";

// Généré à la demande (le build n'a pas besoin de la base) ; mis en cache 5 min par le navigateur et les proxys
export const dynamic = "force-dynamic";

/**
 * Sert post-sitemap.xml, post-sitemap2.xml, category-sitemap.xml… (réécrits
 * vers /sitemaps/<type>/<page> dans next.config.ts).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ type: string; page: string }> }) {
    const { type, page } = await params;
    const n = Number(page);
    if (!SITEMAP_TYPES.includes(type as SitemapType) || !Number.isInteger(n) || n < 1) return new Response("Introuvable", { status: 404 });
    const xml = await sitemapXml(type as SitemapType, n);
    return xml ? xmlResponse(xml) : new Response("Introuvable", { status: 404 });
}
