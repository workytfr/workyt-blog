import { NextResponse } from "next/server";
import { updateThread } from "@/lib/review";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** PATCH /api/posts/<id>/threads/<tid>/ — { text? (réponse), resolved? } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; tid: string }> }) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const { id, tid } = await params;
    const body = await req.json().catch(() => ({}));
    try {
        return NextResponse.json({ success: true, data: await updateThread(id, tid, actor, body ?? {}) });
    } catch (error) {
        return errorResponse(error);
    }
}
