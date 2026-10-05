import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { can } from "@/lib/roles";
import { checkCredit } from "@/lib/licenses";
import { currentActor, unauthorized } from "@/lib/session";
import Media from "@/models/Media";
import { toMediaView } from "@/lib/media";

/**
 * PATCH /api/media/<id>/ — texte alternatif, crédit, « droits vérifiés ».
 * « Droits vérifiés » : correcteurs, Rédacteur en chef, Admins.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    if (!can(actor.role, "post.create")) return NextResponse.json({ success: false, error: "Réservé à la rédaction." }, { status: 403 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: "Image introuvable." }, { status: 404 });
    const body = await req.json().catch(() => ({}));

    await connectDB();
    const media = await Media.findById(id);
    if (!media) return NextResponse.json({ success: false, error: "Image introuvable." }, { status: 404 });

    if (typeof body.alt === "string") media.alt = body.alt.trim().slice(0, 300);
    if (body.credit && typeof body.credit === "object") {
        const credit = {
            author: String(body.credit.author ?? "").trim(),
            source: String(body.credit.source ?? "").trim(),
            license: String(body.credit.license ?? "").trim(),
            sourceUrl: String(body.credit.sourceUrl ?? "").trim(),
            proofUrl: String(body.credit.proofUrl ?? "").trim(),
        };
        const { errors } = checkCredit(credit);
        if (errors.length) return NextResponse.json({ success: false, error: errors.join(" "), issues: errors }, { status: 422 });
        media.credit = credit;
        media.rightsToCheck = false;
        media.rightsVerified = false; // un crédit modifié doit être revérifié
    }
    if (typeof body.rightsVerified === "boolean") {
        if (!can(actor.role, "post.correct")) return NextResponse.json({ success: false, error: "La vérification des droits revient aux correcteurs et à la rédaction en chef." }, { status: 403 });
        media.rightsVerified = body.rightsVerified;
    }
    await media.save();
    return NextResponse.json({ success: true, data: toMediaView(media.toObject()) });
}
