import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { saveCategory } from "@/lib/taxonomy";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** POST /api/categories/ — nouvelle rubrique (Réd. en chef, Admin) */
export async function POST(req: Request) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => ({}));
    try {
        const id = await saveCategory(actor, null, body ?? {});
        revalidatePath("/", "layout");
        return NextResponse.json({ success: true, data: { id } }, { status: 201 });
    } catch (error) {
        return errorResponse(error);
    }
}
