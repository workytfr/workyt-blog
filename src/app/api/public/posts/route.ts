import { NextResponse, type NextRequest } from "next/server";
import { listPosts } from "@/lib/content";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 300;

/**
 * GET /api/public/posts/?search=&after=<ISO>&limit= — articles publiés, pour
 * workyt.fr (recherche globale, newsletter). Lecture seule, sans compte.
 */
export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams;
    const limit = Math.min(50, Math.max(1, Number(q.get("limit")) || 10));
    const search = q.get("search")?.trim() || undefined;
    const after = q.get("after") ? new Date(q.get("after")!) : null;

    // « contient » plutôt que $text : workyt.fr cherche pendant la frappe (« appli »,
    // « revision » sans accent), comme le faisait l'ancien WordPress
    const { items } = await listPosts({ perPage: limit, contains: search, after: after && !isNaN(after.getTime()) ? after : undefined });

    return NextResponse.json({
        success: true,
        data: items.map((p) => ({
            id: p.id,
            title: p.title,
            url: absoluteUrl(`/${p.slug}/`),
            excerpt: p.excerpt,
            publishedAt: p.publishedAt,
            image: p.featuredImage?.url ?? null,
            category: p.primaryCategory?.name ?? null,
        })),
    });
}
