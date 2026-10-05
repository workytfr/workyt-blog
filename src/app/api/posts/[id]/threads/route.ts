import { NextResponse } from "next/server";
import { createThread, listThreads } from "@/lib/review";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/posts/<id>/threads/ — discussions de relecture */
export async function GET(_req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    try {
        return NextResponse.json({ success: true, data: await listThreads((await params).id, actor) });
    } catch (error) {
        return errorResponse(error);
    }
}

/** POST /api/posts/<id>/threads/ — { text, quote?, anchored? } nouvelle discussion */
export async function POST(req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => ({}));
    try {
        return NextResponse.json({ success: true, data: await createThread((await params).id, actor, body ?? {}) });
    } catch (error) {
        return errorResponse(error);
    }
}
