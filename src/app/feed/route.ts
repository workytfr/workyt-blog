import { listPosts } from "@/lib/content";
import { rssFeed, xmlResponse } from "@/lib/feed";
import { renderPostHtml } from "@/lib/render";
import { SITE } from "@/lib/site";
import Post from "@/models/Post";

// Généré à la demande (le build n'a pas besoin de la base) ; mis en cache 5 min par le navigateur et les proxys
export const dynamic = "force-dynamic";

/** GET /feed/ — flux RSS des 20 derniers articles (contenu complet, comme WordPress) */
export async function GET() {
    const { items } = await listPosts({ perPage: 20 });
    const html = new Map(
        (await Post.find({ _id: { $in: items.map((p) => p.id) } }).select("contentHtml").lean()).map((p) => [String(p._id), renderPostHtml(p.contentHtml || "")])
    );
    return xmlResponse(
        rssFeed({ title: `${SITE.name} ${SITE.titleSeparator} ${SITE.tagline}`, path: "/feed/", description: SITE.description, posts: items.map((p) => ({ ...p, contentHtml: html.get(p.id) })) }),
        "application/rss+xml; charset=utf-8"
    );
}
