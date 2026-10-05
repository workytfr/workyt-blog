import { NextResponse } from "next/server";
import { deleteComment, editComment, moderateComment, reportComment, toggleLike } from "@/lib/comments";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH { text } — modifier son commentaire (15 minutes) */
export async function PATCH(req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const body = await req.json().catch(() => ({}));
    try {
        return NextResponse.json({ success: true, data: await editComment(actor, (await params).id, body.text) });
    } catch (error) {
        return errorResponse(error);
    }
}

/** DELETE — supprimer son commentaire (ou n'importe lequel, pour la modération) */
export async function DELETE(_req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    try {
        await deleteComment(actor, (await params).id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
}

/** POST { action: "like" | "report" | "approve" | "reject" } */
export async function POST(req: Request, { params }: Ctx) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    const { action } = await req.json().catch(() => ({}));
    const id = (await params).id;
    try {
        if (action === "like") return NextResponse.json({ success: true, data: await toggleLike(actor, id) });
        if (action === "report") return NextResponse.json({ success: true, data: await reportComment(actor, id) });
        if (action === "approve" || action === "reject") {
            await moderateComment(actor, id, action);
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ success: false, error: "Action inconnue." }, { status: 400 });
    } catch (error) {
        return errorResponse(error);
    }
}
