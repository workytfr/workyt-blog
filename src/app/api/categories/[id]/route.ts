import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deleteCategory, saveCategory } from "@/lib/taxonomy";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/categories/<id>/ — modifier (adresse changée : redirection 301 automatique) */
export async function PATCH(req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => ({}));
    try {
        await saveCategory(actor, (await params).id, body ?? {});
        // Menu et pages de rubrique de tout le site
        revalidatePath("/", "layout");
        return NextResponse.json({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
}

/** DELETE /api/categories/<id>/ — seulement si elle est vide */
export async function DELETE(_req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    try {
        await deleteCategory(actor, (await params).id);
        revalidatePath("/", "layout");
        return NextResponse.json({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
}
