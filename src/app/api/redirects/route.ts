import { NextResponse } from "next/server";
import { saveRedirect } from "@/lib/redirectsAdmin";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** POST /api/redirects/ — { from, to, status } nouvelle redirection (Admin) */
export async function POST(req: Request) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => ({}));
    try {
        await saveRedirect(actor, null, body ?? {});
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        return errorResponse(error);
    }
}
