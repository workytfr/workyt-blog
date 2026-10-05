import { NextResponse } from "next/server";
import { keywordOwner } from "@/lib/seo/server";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** GET /api/seo/keyword/?k=<mot-clé>&exclude=<id> — un autre article vise-t-il déjà ce mot-clé ? */
export async function GET(req: Request) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const url = new URL(req.url);
    try {
        const owner = await keywordOwner((url.searchParams.get("k") || "").slice(0, 120), url.searchParams.get("exclude") || undefined);
        return NextResponse.json({ success: true, data: { taken: !!owner, by: owner } });
    } catch (error) {
        return errorResponse(error);
    }
}
