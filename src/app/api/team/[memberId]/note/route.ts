import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { can } from "@/lib/roles";
import { currentActor, unauthorized } from "@/lib/session";
import Member from "@/models/Member";

/**
 * PATCH /api/team/<memberId>/note/ — { note } : note interne sur un compte
 * (prénom, pseudo Discord…), visible des seuls gestionnaires de l'équipe.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ memberId: string }> }) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    if (!can(actor.role, "team.manage")) return NextResponse.json({ success: false, error: "Réservé à la gestion de l'équipe." }, { status: 403 });

    const { memberId } = await params;
    if (!mongoose.isValidObjectId(memberId)) return NextResponse.json({ success: false, error: "Membre introuvable." }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    if (typeof body?.note !== "string") return NextResponse.json({ success: false, error: "Note manquante." }, { status: 400 });
    const note = body.note.replace(/\s+/g, " ").trim().slice(0, 200);

    await connectDB();
    const m = await Member.findByIdAndUpdate(memberId, { $set: { note } }, { new: true }).select("note").lean();
    if (!m) return NextResponse.json({ success: false, error: "Membre introuvable." }, { status: 404 });
    return NextResponse.json({ success: true, data: { id: memberId, note: m.note } });
}
