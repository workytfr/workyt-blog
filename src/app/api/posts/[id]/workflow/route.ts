import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { applyAction } from "@/lib/review";
import { ACTION_LABELS, type WorkflowAction } from "@/lib/workflow";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/**
 * POST /api/posts/<id>/workflow/ — { action, reason?, at? }
 * Une étape du circuit : envoyer en correction, prendre, renvoyer, valider,
 * approuver (maintenant ou à une date), refuser, publier, dépublier…
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => null);
    const action = body?.action as WorkflowAction;
    if (!action || !(action in ACTION_LABELS)) return NextResponse.json({ success: false, error: "Action inconnue." }, { status: 400 });
    try {
        const result = await applyAction((await params).id, action, actor, { reason: body.reason, at: body.at });
        // Pages publiques concernées : l'article et les listes
        if (["approve", "publish", "unpublish", "unschedule"].includes(action)) {
            revalidatePath(`/${result.slug}/`);
            revalidatePath("/");
        }
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        return errorResponse(error);
    }
}
