import { NextResponse } from "next/server";
import { record404 } from "@/lib/redirectsAdmin";

/** POST /api/404/ — { path, referrer } : la page 404 signale une adresse introuvable (journal des 404) */
export async function POST(req: Request) {
    const body = await req
        .text()
        .then((t) => JSON.parse(t || "{}"))
        .catch(() => ({}));
    if (typeof body?.path === "string" && body.path.startsWith("/")) await record404(body.path, typeof body.referrer === "string" ? body.referrer : "").catch(() => {});
    return new NextResponse(null, { status: 204 });
}
