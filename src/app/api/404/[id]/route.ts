import { NextResponse } from "next/server";
import { ignore404 } from "@/lib/redirectsAdmin";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** DELETE /api/404/<id>/ — ignorer une adresse du journal des 404 (Admin) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    try {
        await ignore404(actor, (await params).id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
}
