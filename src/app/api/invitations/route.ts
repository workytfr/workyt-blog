import { NextResponse } from "next/server";
import { listInvitations } from "@/lib/review";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** GET /api/invitations/ — les coups de cœur qu'on m'a demandé d'écrire */
export async function GET() {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    try {
        return NextResponse.json({ success: true, data: await listInvitations(actor) });
    } catch (error) {
        return errorResponse(error);
    }
}
