import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getBlogSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { canAssignRole, isRole, type Role } from "@/lib/roles";
import Member from "@/models/Member";
import RoleChange from "@/models/RoleChange";

/**
 * PATCH /api/team/<memberId>/role/ — { role } : changer le rôle d'un membre.
 * Règles (cahier des charges § 6) dans canAssignRole : le Rédacteur en chef
 * gère Rédacteurs et Correcteurs, l'Admin nomme le Rédacteur en chef.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ memberId: string }> }) {
    const session = await getBlogSession();
    if (!session?.user?.memberId) return NextResponse.json({ success: false, error: "Connecte-toi." }, { status: 401 });

    const { memberId } = await params;
    if (!mongoose.isValidObjectId(memberId)) return NextResponse.json({ success: false, error: "Membre introuvable." }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    if (!isRole(body?.role)) return NextResponse.json({ success: false, error: "Rôle inconnu." }, { status: 400 });

    await connectDB();
    const [actor, target] = await Promise.all([Member.findById(session.user.memberId).select("role").lean(), Member.findById(memberId)]);
    if (!actor || !target) return NextResponse.json({ success: false, error: "Membre introuvable." }, { status: 404 });

    const refusal = canAssignRole({ id: String(actor._id), role: actor.role as Role }, { id: String(target._id), role: target.role as Role }, body.role);
    if (refusal) return NextResponse.json({ success: false, error: refusal }, { status: 403 });

    const from = target.role;
    if (from === body.role) return NextResponse.json({ success: true, data: { id: String(target._id), role: target.role } });
    target.role = body.role;
    await target.save();
    // Journal de la page Équipe
    await RoleChange.create({ member: target._id, memberName: target.username, from, to: body.role, by: actor._id, byName: session.user.name || "" });
    return NextResponse.json({ success: true, data: { id: String(target._id), role: target.role } });
}
