import { NextResponse } from "next/server";
import { listRevisions } from "@/lib/review";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** GET /api/posts/<id>/revisions/ — versions de l'article, les plus récentes d'abord */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    try {
        return NextResponse.json({ success: true, data: await listRevisions((await params).id, actor) });
    } catch (error) {
        return errorResponse(error);
    }
}
