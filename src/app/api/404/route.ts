import { NextResponse } from "next/server";
import { record404 } from "@/lib/redirectsAdmin";
import { rateLimit, tooMany } from "@/lib/rateLimit";

/** POST /api/404/ — { path, referrer } : la page 404 signale une adresse introuvable (journal des 404) */
export async function POST(req: Request) {
    if (!rateLimit(req, "404", 20, 10 * 60_000)) return tooMany();
    const body = await req
        .text()
        // Corps anormalement long : ignoré
        .then((t) => JSON.parse(t.length > 4000 ? "{}" : t || "{}"))
        .catch(() => ({}));
    if (typeof body?.path === "string" && body.path.startsWith("/")) await record404(body.path, typeof body.referrer === "string" ? body.referrer : "").catch(() => {});
    return new NextResponse(null, { status: 204 });
}
