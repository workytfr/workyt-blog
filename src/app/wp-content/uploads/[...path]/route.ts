import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Media from "@/models/Media";

/**
 * Anciennes adresses des images WordPress (/wp-content/uploads/2024/03/photo-300x200.jpg) :
 * redirection définitive vers l'image reprise sur R2, pour garder le référencement
 * (Google Images, liens d'autres sites). Toutes les tailles WordPress pointent vers
 * l'unique image reprise. Fichier non repris : 410 (supprimé).
 */
const SIZE = /-\d+x\d+(?=\.[a-z0-9]+$)/i;

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    let rel = path.join("/");
    try {
        rel = decodeURIComponent(rel);
    } catch {
        /* adresse mal encodée : gardée telle quelle */
    }
    rel = rel.toLowerCase().replace(SIZE, "");
    const candidates = [...new Set([rel, rel.replace(/(\.[a-z0-9]+)$/, "-scaled$1"), rel.replace("-scaled", "")])];

    await connectDB();
    const media = await Media.findOne({ wpPath: { $in: candidates } }).select("url").lean();
    if (media?.url) {
        const res = NextResponse.redirect(new URL(media.url, process.env.NEXT_PUBLIC_SITE_URL || "https://blog.workyt.fr"), 301);
        res.headers.set("Cache-Control", "public, max-age=86400");
        return res;
    }
    return new NextResponse("Ce fichier n'existe plus.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
