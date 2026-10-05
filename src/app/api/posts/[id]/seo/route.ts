import { NextResponse } from "next/server";
import { deadAffiliateHrefs, linkSuggestions } from "@/lib/seo/server";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** GET /api/posts/<id>/seo/ — suggestions de liens internes et liens affiliés cassés (assistant SEO) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    try {
        const [suggestions, deadLinks] = await Promise.all([linkSuggestions((await params).id), deadAffiliateHrefs()]);
        return NextResponse.json({ success: true, data: { suggestions, deadLinks } });
    } catch (error) {
        return errorResponse(error);
    }
}
