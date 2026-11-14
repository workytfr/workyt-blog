import { NextResponse } from "next/server";
import { toNoteView, vokytApi, type ApiNote } from "@/lib/vokyt";
import { NOTE_ID, editor, vokytError } from "../../guard";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/vokyt/notes/<id>/ — état du traitement (suivi dans l'éditeur) */
export async function GET(_req: Request, { params }: Ctx) {
    const { error } = await editor();
    if (error) return error;
    const { id } = await params;
    if (!NOTE_ID.test(id)) return NextResponse.json({ success: false, error: "Vocal introuvable." }, { status: 404 });
    try {
        return NextResponse.json({ success: true, data: toNoteView(await vokytApi<ApiNote>(`/notes/${id}`)) });
    } catch (e) {
        return vokytError(e);
    }
}

/** DELETE /api/vokyt/notes/<id>/ — envoi abandonné : Vokyt supprime le vocal et rend les minutes réservées */
export async function DELETE(_req: Request, { params }: Ctx) {
    const { error } = await editor();
    if (error) return error;
    const { id } = await params;
    if (!NOTE_ID.test(id)) return NextResponse.json({ success: false, error: "Vocal introuvable." }, { status: 404 });
    try {
        await vokytApi(`/notes/${id}`, { method: "DELETE" });
        return NextResponse.json({ success: true, data: null });
    } catch (e) {
        return vokytError(e);
    }
}
