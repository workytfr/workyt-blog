import { NextResponse } from "next/server";
import { resolveLink } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

/**
 * GET /go/<nom>/ — lien affilié : redirection 302 vers le marchand, un clic
 * compté (sans cookie). Jamais indexé.
 */
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
    const name = (await params).name;
    const headers = { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer-when-downgrade" };
    if (!/^[a-z0-9-]{1,80}$/i.test(name)) return new NextResponse("Lien introuvable", { status: 404, headers });
    const url = await resolveLink(name);
    if (!url) return NextResponse.redirect(new URL("/", req.url), { status: 302, headers });
    return NextResponse.redirect(url, { status: 302, headers });
}
