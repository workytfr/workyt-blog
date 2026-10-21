import { childCategoryIds, getCategoryBySlug, listPosts, memoized } from "@/lib/content";
import { rssFeed, xmlResponse } from "@/lib/feed";
import { SITE } from "@/lib/site";
import { decodeSlug } from "@/lib/slug";

// Généré à la demande (le build n'a pas besoin de la base) ; mis en cache 5 min par le navigateur et les proxys
export const dynamic = "force-dynamic";

/** GET /category/<slug>/feed/ — flux RSS d'une rubrique */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const cat = await getCategoryBySlug(decodeSlug((await params).slug));
    if (!cat) return new Response("Rubrique introuvable", { status: 404 });
    // Gardé 5 min en mémoire ; une clé par rubrique existante, donc en nombre borné
    const xml = await memoized(`feed:category:${cat.id}`, 5 * 60_000, async () => {
        const { items } = await listPosts({ perPage: 20, categoryIds: [cat.id, ...(await childCategoryIds(cat.id))], withTotal: false });
        return rssFeed({ title: `${cat.name} ${SITE.titleSeparator} ${SITE.name}`, path: `/category/${cat.slug}/feed/`, description: cat.description || SITE.description, posts: items });
    });
    return xmlResponse(xml, "application/rss+xml; charset=utf-8");
}
