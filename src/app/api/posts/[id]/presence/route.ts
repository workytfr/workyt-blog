import { NextResponse } from "next/server";
import { heartbeat } from "@/lib/review";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/**
 * POST /api/posts/<id>/presence/ — signal de l'éditeur ouvert (toutes les 15 s)
 * { want: "edit" | "view", active?, request?, yield?, leave? }
 * Renvoie qui a la main et qui regarde l'article.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    // sendBeacon envoie du texte : on lit le corps à la main
    const body = await req
        .text()
        .then((t) => JSON.parse(t || "{}"))
        .catch(() => ({}));
    try {
        const data = await heartbeat((await params).id, actor, {
            want: body.want === "edit" ? "edit" : "view",
            active: !!body.active,
            request: !!body.request,
            yield: !!body.yield,
            leave: !!body.leave,
        });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        return errorResponse(error);
    }
}
