import { NextResponse } from "next/server";
import { reschedule } from "@/lib/review";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** POST /api/posts/<id>/schedule/ — { at } : nouvelle date d'un article planifié (calendrier) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => ({}));
    try {
        return NextResponse.json({ success: true, data: await reschedule((await params).id, String(body?.at ?? ""), actor) });
    } catch (error) {
        return errorResponse(error);
    }
}
