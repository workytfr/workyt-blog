import { NextResponse } from "next/server";
import { savePost } from "@/lib/posts";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** PATCH /api/posts/<id>/ — enregistre les champs envoyés (enregistrement automatique) */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ success: false, error: "Requête invalide." }, { status: 400 });
    try {
        return NextResponse.json({ success: true, data: await savePost((await params).id, body, actor) });
    } catch (error) {
        return errorResponse(error);
    }
}
