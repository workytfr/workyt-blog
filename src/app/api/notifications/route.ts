import { NextResponse } from "next/server";
import { listNotifications, markNotificationsRead } from "@/lib/review";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** GET /api/notifications/ — notifications de la rédaction (les 50 dernières) */
export async function GET() {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    try {
        return NextResponse.json({ success: true, data: await listNotifications(actor) });
    } catch (error) {
        return errorResponse(error);
    }
}

/** POST /api/notifications/ — { ids? } marque comme lues (toutes si pas d'ids) */
export async function POST(req: Request) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => ({}));
    try {
        await markNotificationsRead(actor, Array.isArray(body?.ids) ? body.ids : undefined);
        return NextResponse.json({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
}
