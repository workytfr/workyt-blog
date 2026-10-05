import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import ViewDay from "@/models/ViewDay";

/** Jour de Paris (« 2026-10-03 ») */
const parisDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });

/** POST /api/views/<id>/ — +1 lecture (compteur repris de Post Views Counter) et compteur du jour (statistiques) */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ ok: false }, { status: 400 });
    await connectDB();
    const res = await Post.updateOne({ _id: id, status: "published" }, { $inc: { views: 1 } });
    if (res.modifiedCount) await ViewDay.updateOne({ day: parisDay(), post: id }, { $inc: { views: 1 } }, { upsert: true });
    return NextResponse.json({ ok: true });
}
