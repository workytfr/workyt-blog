import { NextResponse } from "next/server";
import { getRevision, restoreRevision } from "@/lib/review";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

type Ctx = { params: Promise<{ id: string; rid: string }> };

/** GET /api/posts/<id>/revisions/<rid>/ — contenu d'une version (pour comparer) */
export async function GET(_req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const { id, rid } = await params;
    try {
        return NextResponse.json({ success: true, data: await getRevision(id, rid, actor) });
    } catch (error) {
        return errorResponse(error);
    }
}

/** POST /api/posts/<id>/revisions/<rid>/ — restaurer cette version */
export async function POST(_req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const { id, rid } = await params;
    try {
        return NextResponse.json({ success: true, data: await restoreRevision(id, rid, actor) });
    } catch (error) {
        return errorResponse(error);
    }
}
