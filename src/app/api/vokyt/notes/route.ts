import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { absoluteUrl } from "@/lib/site";
import { isId } from "@/lib/posts";
import { toNoteView, vokytApi, type ApiNote } from "@/lib/vokyt";
import Post from "@/models/Post";
import Author from "@/models/Author";
import { editor, vokytError } from "../guard";

/** GET /api/vokyt/notes/ — les derniers vocaux du site (« Choisir un vocal existant ») */
export async function GET() {
    const { error } = await editor();
    if (error) return error;
    try {
        const { data } = await vokytApi<{ data: ApiNote[] }>("/notes?limit=30");
        return NextResponse.json({ success: true, data: data.map(toNoteView) });
    } catch (e) {
        return vokytError(e);
    }
}

/** Formats acceptés par Vokyt */
const ACCEPTED = /^audio\/(webm|ogg|mpeg|mp4|x-m4a|aac|wav|x-wav)$/;

/**
 * POST /api/vokyt/notes/ — étape 1 de l'envoi : Vokyt réserve les minutes et renvoie une adresse
 * de dépôt signée ; le navigateur y envoie le fichier lui-même (il ne transite pas par le blog).
 * Corps : { title, contentType, bytes, durationMs, multiVoice, postId }
 */
export async function POST(req: NextRequest) {
    const { actor, error } = await editor();
    if (error) return error;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const contentType = String(body?.contentType ?? "").split(";")[0].trim().toLowerCase();
    const bytes = Number(body?.bytes);
    if (!ACCEPTED.test(contentType)) return NextResponse.json({ success: false, error: "Format audio non accepté (MP3, M4A, WAV, OGG ou WebM)." }, { status: 400 });
    if (!(bytes > 0)) return NextResponse.json({ success: false, error: "Fichier vide." }, { status: 400 });
    try {
        // Article et auteur : le vocal sait où il est publié, et qui l'a enregistré
        await connectDB();
        const post = isId(body?.postId) ? await Post.findById(body.postId).select("slug").lean() : null;
        const author = await Author.findOne({ member: actor.memberId }).select("name").lean();
        const created = await vokytApi<{ id: string; upload: { url: string; method: string; headers: Record<string, string> } }>("/notes", {
            method: "POST",
            body: {
                title: String(body?.title ?? "").trim().slice(0, 200) || null,
                articleUrl: post ? absoluteUrl(`/${post.slug}/`) : null,
                authorName: author?.name || actor.name || null,
                contentType,
                bytes,
                durationMs: Number(body?.durationMs) > 0 ? Math.round(Number(body?.durationMs)) : null,
                multiVoice: body?.multiVoice === true,
            },
        });
        // Seule une adresse https de dépôt est renvoyée au navigateur (http accepté en développement)
        const secure = process.env.NODE_ENV === "production" ? /^https:\/\// : /^https?:\/\//;
        if (!secure.test(created.upload?.url ?? "")) {
            // Vocal annulé : Vokyt rend les minutes réservées
            await vokytApi(`/notes/${created.id}`, { method: "DELETE" }).catch(() => {});
            throw new Error("adresse de dépôt invalide");
        }
        return NextResponse.json({ success: true, data: { id: created.id, upload: created.upload } }, { status: 201 });
    } catch (e) {
        return vokytError(e);
    }
}
