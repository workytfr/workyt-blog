import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import ViewDay from "@/models/ViewDay";
import { rateLimit, tooMany } from "@/lib/rateLimit";
import { parisDay } from "@/lib/parisTime";

/** POST /api/views/<id>/ — +1 lecture (compteur repris de Post Views Counter) et compteur du jour (statistiques) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ ok: false }, { status: 400 });
    // Anti-gonflage, large pour une classe derrière une même IP : 30 lectures/h d'un article, 120 en 10 min au total
    if (!rateLimit(req, "views", 120, 10 * 60_000) || !rateLimit(req, `views:${id}`, 30, 60 * 60_000)) return tooMany();
    await connectDB();
    // Compteur : ne change pas la date de modification de l'article
    const res = await Post.updateOne({ _id: id, status: "published" }, { $inc: { views: 1 } }, { timestamps: false });
    if (res.modifiedCount) await ViewDay.updateOne({ day: parisDay(), post: id }, { $inc: { views: 1 } }, { upsert: true });
    return NextResponse.json({ ok: true });
}
