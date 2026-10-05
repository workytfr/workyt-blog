import { childCategoryIds, getCategoryBySlug, listPosts } from "@/lib/content";
import { rssFeed, xmlResponse } from "@/lib/feed";
import { SITE } from "@/lib/site";

// Généré à la demande (le build n'a pas besoin de la base) ; mis en cache 5 min par le navigateur et les proxys
export const dynamic = "force-dynamic";

/** GET /category/<slug>/feed/ — flux RSS d'une rubrique */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const cat = await getCategoryBySlug(decodeURIComponent((await params).slug));
    if (!cat) return new Response("Rubrique introuvable", { status: 404 });
    const { items } = await listPosts({ perPage: 20, categoryIds: [cat.id, ...(await childCategoryIds(cat.id))] });
    return xmlResponse(
        rssFeed({ title: `${cat.name} ${SITE.titleSeparator} ${SITE.name}`, path: `/category/${cat.slug}/feed/`, description: cat.description || SITE.description, posts: items }),
        "application/rss+xml; charset=utf-8"
    );
}
