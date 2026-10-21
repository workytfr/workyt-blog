import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { setCorrector } from "@/lib/review";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/**
 * PATCH /api/posts/<id>/corrector/ — { who: "m:<compte>" | "a:<profil>" | null, via }
 * Correcteur et lieu de la correction (blog, Google Docs, Discord…), pour les
 * corrections faites hors du circuit. Rédaction en chef et Admins ; un
 * correcteur peut se déclarer lui-même (voir correctorEditor).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => null);
    const who = typeof body?.who === "string" && body.who ? body.who : null;
    const via = typeof body?.via === "string" && body.via ? body.via : null;
    try {
        const result = await setCorrector((await params).id, actor, { who, via });
        // « Relu et corrigé par » sous l'article publié
        if (result.status === "published") revalidatePath(`/${result.slug}/`);
        return NextResponse.json({ success: true, data: result.corrector });
    } catch (error) {
        return errorResponse(error);
    }
}
