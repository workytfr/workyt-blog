import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { absoluteUrl } from "@/lib/site";
import Post from "@/models/Post";

export const revalidate = 300;

/**
 * GET /wp-json/wp/v2/posts — compatibilité avec l'API WordPress, le temps de
 * basculer workyt.fr sur /api/public/posts/ (cahier des charges § 15).
 * Champs utilisés par workyt-next : id, title.rendered, link, date,
 * excerpt.rendered, _embedded["wp:featuredmedia"][0].source_url.
 * Paramètres : search, after (ISO), per_page.
 */
export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams;
    const perPage = Math.min(100, Math.max(1, Number(q.get("per_page")) || 10));
    const filter: Record<string, unknown> = { status: "published", publishedAt: { $lte: new Date() } };
    const after = q.get("after") ? new Date(q.get("after")!) : null;
    if (after && !isNaN(after.getTime())) filter.publishedAt = { $gt: after, $lte: new Date() };
    const search = q.get("search")?.trim();
    if (search) filter.$text = { $search: search };

    await connectDB();
    const posts = await Post.find(filter).select("title slug excerpt publishedAt featuredImage wpId").sort({ publishedAt: -1 }).limit(perPage).lean();

    return NextResponse.json(
        posts.map((p) => ({
            id: p.wpId ?? String(p._id),
            date: p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 19) : null,
            link: absoluteUrl(`/${p.slug}/`),
            slug: p.slug,
            title: { rendered: p.title },
            excerpt: { rendered: p.excerpt ? `<p>${p.excerpt}</p>` : "" },
            _embedded: p.featuredImage?.url ? { "wp:featuredmedia": [{ source_url: p.featuredImage.url, alt_text: p.featuredImage.alt || "" }] } : {},
        })),
        { headers: { "Access-Control-Allow-Origin": "*" } }
    );
}
