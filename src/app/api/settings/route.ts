import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { saveSettings } from "@/lib/settings";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** PATCH /api/settings/ — réglages du blog (Admin) */
export async function PATCH(req: Request) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => ({}));
    try {
        await saveSettings(actor, body ?? {});
        // En-tête, pied de page et balises de tout le site
        revalidatePath("/", "layout");
        return NextResponse.json({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
}
