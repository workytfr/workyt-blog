import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deleteTag, mergeTag, saveTag } from "@/lib/taxonomy";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/tags/<id>/ — { name, slug, description } ou { into } pour fusionner */
export async function PATCH(req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => ({}));
    try {
        const id = (await params).id;
        if (typeof body?.into === "string") await mergeTag(actor, id, body.into);
        else await saveTag(actor, id, body ?? {});
        revalidatePath("/", "layout");
        return NextResponse.json({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    try {
        await deleteTag(actor, (await params).id);
        revalidatePath("/", "layout");
        return NextResponse.json({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
}
