import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { ensureAuthor } from "@/lib/posts";
import { can } from "@/lib/roles";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";
import Author from "@/models/Author";

/** PATCH /api/me/author/ — { bio, title } : mon profil d'auteur (page /author/<slug>/) */
export async function PATCH(req: Request) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    if (!can(actor.role, "post.create")) return NextResponse.json({ success: false, error: "Réservé à la rédaction." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    try {
        await connectDB();
        const id = await ensureAuthor(actor.memberId);
        const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : undefined);
        const a = await Author.findByIdAndUpdate(id, { $set: { ...(clean(body.bio, 600) !== undefined ? { bio: clean(body.bio, 600) } : {}), ...(clean(body.title, 60) !== undefined ? { title: clean(body.title, 60) } : {}) } }, { new: true }).lean();
        if (a) revalidatePath(`/author/${a.slug}/`);
        return NextResponse.json({ success: true, data: { slug: a?.slug, bio: a?.bio, title: a?.title } });
    } catch (error) {
        return errorResponse(error);
    }
}
