import { NextResponse } from "next/server";
import { deleteLink, updateLink } from "@/lib/affiliate";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/links/<id>/ — modifier (l'adresse /go/<nom>/ ne change pas) */
export async function PATCH(req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => ({}));
    try {
        return NextResponse.json({ success: true, data: await updateLink(actor, (await params).id, body ?? {}) });
    } catch (error) {
        return errorResponse(error);
    }
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    try {
        await deleteLink(actor, (await params).id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
}
