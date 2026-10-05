import { NextResponse } from "next/server";
import { guestEdit } from "@/lib/review";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/**
 * PATCH /api/posts/<id>/modules/<mid>/guest/ — l'invité d'un coup de cœur :
 * { why?, name?, validate? } ou { withdraw: true }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; mid: string }> }) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const { id, mid } = await params;
    const body = await req.json().catch(() => ({}));
    try {
        return NextResponse.json({ success: true, data: await guestEdit(id, mid, actor, body ?? {}) });
    } catch (error) {
        return errorResponse(error);
    }
}
