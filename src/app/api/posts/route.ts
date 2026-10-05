import { NextResponse } from "next/server";
import { createDraft } from "@/lib/posts";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** POST /api/posts/ — { template? } nouveau brouillon (rédaction uniquement), vide ou d'après un modèle ; renvoie son id */
export async function POST(req: Request) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => ({}));
    try {
        return NextResponse.json({ success: true, data: { id: await createDraft(actor, typeof body?.template === "string" ? body.template : undefined) } }, { status: 201 });
    } catch (error) {
        return errorResponse(error);
    }
}
