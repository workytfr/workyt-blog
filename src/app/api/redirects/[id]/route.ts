import { NextResponse } from "next/server";
import { deleteRedirect, saveRedirect } from "@/lib/redirectsAdmin";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => ({}));
    try {
        await saveRedirect(actor, (await params).id, body ?? {});
        return NextResponse.json({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    try {
        await deleteRedirect(actor, (await params).id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
}
