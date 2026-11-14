import { NextResponse } from "next/server";
import { vokytApi } from "@/lib/vokyt";
import { NOTE_ID, editor, vokytError } from "../../../guard";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/vokyt/notes/<id>/complete/ — étape 2 : le fichier est déposé, Vokyt le traite */
export async function POST(_req: Request, { params }: Ctx) {
    const { error } = await editor();
    if (error) return error;
    const { id } = await params;
    if (!NOTE_ID.test(id)) return NextResponse.json({ success: false, error: "Vocal introuvable." }, { status: 404 });
    try {
        await vokytApi(`/notes/${id}/complete`, { method: "POST" });
        return NextResponse.json({ success: true, data: { id } });
    } catch (e) {
        return vokytError(e);
    }
}
