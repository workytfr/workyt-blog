import { NextResponse } from "next/server";
import { can } from "@/lib/roles";
import { hit, tooMany } from "@/lib/rateLimit";
import { addWord, listDictionary, removeWord } from "@/lib/language/dictionary";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";

/** GET /api/language/dictionary/ — mots du dictionnaire Workyt (correcteur de l'éditeur) */
export async function GET() {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    if (!can(actor.role, "post.create")) return NextResponse.json({ success: false, error: "Réservé à la rédaction." }, { status: 403 });
    try {
        return NextResponse.json({ success: true, data: await listDictionary(actor) });
    } catch (error) {
        return errorResponse(error);
    }
}

/** POST { word } — ajoute un mot pour toute la rédaction */
export async function POST(req: Request) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    if (!hit(`dico:${actor.memberId}`, 60, 60_000)) return tooMany();
    const body = await req.json().catch(() => ({}));
    try {
        return NextResponse.json({ success: true, data: await addWord(actor, body.word) });
    } catch (error) {
        return errorResponse(error);
    }
}

/** DELETE ?word=<mot> — retire un mot (le sien, ou n'importe lequel pour la rédaction en chef) */
export async function DELETE(req: Request) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    try {
        await removeWord(actor, new URL(req.url).searchParams.get("word"));
        return NextResponse.json({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
}
