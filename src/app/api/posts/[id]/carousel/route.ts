import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { can } from "@/lib/roles";
import { currentActor, errorResponse, unauthorized } from "@/lib/session";
import { sanitizeCarousel } from "@/lib/carousel/data";
import { carouselDraft } from "@/lib/carousel/draft";
import { renderCarousel } from "@/lib/carousel/render";
import { pdfFromSlides, zipFiles } from "@/lib/carousel/pack";
import Post from "@/models/Post";

export const runtime = "nodejs";

/**
 * POST /api/posts/<id>/carousel/ — carrousel Instagram / LinkedIn de l'article
 * (Rédacteur en chef et Admin). Corps : { data, format: "png" | "zip" | "pdf", slide? }.
 * Les textes viennent du navigateur ; la photo et l'avatar, toujours de l'article.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    if (!can(actor.role, "social.export")) return NextResponse.json({ success: false, error: "Réservé au Rédacteur en chef et aux Admins." }, { status: 403 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: "Article introuvable." }, { status: 404 });
    try {
        await connectDB();
        const post = await Post.findById(id).lean();
        if (!post) return NextResponse.json({ success: false, error: "Article introuvable." }, { status: 404 });
        const body = (await req.json().catch(() => ({}))) as { data?: unknown; format?: string; slide?: number };
        const base = await carouselDraft(post);
        const edited = sanitizeCarousel(body.data);
        if (!edited) return NextResponse.json({ success: false, error: "Il faut au moins un titre." }, { status: 400 });
        const data = {
            ...edited,
            image: base.image,
            category: base.category,
            author: base.author && { ...base.author, name: edited.author?.name || base.author.name, title: edited.author?.title ?? base.author.title },
        };
        const origin = new URL(req.url).origin;
        const name = post.slug.slice(0, 60);

        if (body.format === "png") {
            const [png] = await renderCarousel(data, { origin, only: Math.max(0, Number(body.slide) || 0) });
            if (!png) return NextResponse.json({ success: false, error: "Diapositive introuvable." }, { status: 404 });
            return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
        }
        const slides = await renderCarousel(data, { origin });
        if (body.format === "pdf") {
            return new Response(new Uint8Array(await pdfFromSlides(slides)), {
                headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="carrousel-${name}.pdf"`, "Cache-Control": "no-store" },
            });
        }
        const zip = zipFiles(slides.map((data, i) => ({ name: `${name}-${String(i + 1).padStart(2, "0")}.png`, data })));
        return new Response(new Uint8Array(zip), {
            headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="carrousel-${name}.zip"`, "Cache-Control": "no-store" },
        });
    } catch (error) {
        return errorResponse(error);
    }
}
