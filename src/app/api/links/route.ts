import { NextResponse } from "next/server";
import { createLink, listLinks } from "@/lib/affiliate";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** GET /api/links/ — liens affiliés (toute la rédaction, pour les choisir dans l'éditeur) */
export async function GET() {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    try {
        return NextResponse.json({ success: true, data: await listLinks(actor) });
    } catch (error) {
        return errorResponse(error);
    }
}

/** POST /api/links/ — { label, name?, merchant, url, program, expiresAt } (Réd. en chef, Admin) */
export async function POST(req: Request) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => ({}));
    try {
        return NextResponse.json({ success: true, data: await createLink(actor, body ?? {}) }, { status: 201 });
    } catch (error) {
        return errorResponse(error);
    }
}
