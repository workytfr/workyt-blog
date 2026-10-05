import { NextResponse } from "next/server";
import { createComment, listComments } from "@/lib/comments";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/posts/<id>/comments/ — commentaires de l'article (avec, pour la
 * personne connectée, ses commentaires en attente, ses « j'aime » et ce
 * qu'elle peut encore modifier).
 */
export async function GET(_req: Request, { params }: Ctx) {
    const actor = await currentActor();
    const data = await listComments((await params).id, actor?.memberId ?? null);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
}

/** POST { text, parentId? } — nouveau commentaire (compte Workyt connecté) */
export async function POST(req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => ({}));
    try {
        const data = await createComment(actor, (await params).id, { text: body.text, parentId: body.parentId });
        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (error) {
        return errorResponse(error);
    }
}
