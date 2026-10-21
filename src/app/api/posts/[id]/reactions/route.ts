import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { myReaction, reactionCounts, setReaction } from "@/lib/comments";
import { currentActor, errorResponse } from "@/lib/session";
import { rateLimit, tooMany } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Réactions à un article (« Quelle est ta réaction ? »), ouvertes à tous :
 * compte connecté, sinon un identifiant anonyme gardé en cookie (aucune
 * donnée personnelle).
 */
const COOKIE = "wk_rid";

async function voter(create: boolean): Promise<{ id: string | null; fresh?: string }> {
    const actor = await currentActor();
    if (actor) return { id: `m:${actor.memberId}` };
    const jar = await cookies();
    const existing = jar.get(COOKIE)?.value;
    if (existing && /^[0-9a-f-]{36}$/.test(existing)) return { id: `a:${existing}` };
    if (!create) return { id: null };
    const fresh = randomUUID();
    return { id: `a:${fresh}`, fresh };
}

export async function GET(_req: Request, { params }: Ctx) {
    const id = (await params).id;
    const v = await voter(false);
    const [counts, mine] = await Promise.all([reactionCounts(id), v.id ? myReaction(id, v.id) : null]);
    return NextResponse.json({ success: true, data: { counts, mine } }, { headers: { "Cache-Control": "private, no-store" } });
}

/** POST { type } — choisir sa réaction (null : la retirer) */
export async function POST(req: Request, { params }: Ctx) {
    if (!rateLimit(req, "reactions", 30, 10 * 60_000)) return tooMany();
    const body = await req.json().catch(() => ({}));
    const type = body.type ?? null;
    const v = await voter(type !== null);
    // Retirer une réaction sans cookie : rien à retirer, rien à créer
    if (!v.id) return NextResponse.json({ success: true, data: { counts: await reactionCounts((await params).id), mine: null } });
    // Nouveau votant anonyme (sans cookie) : quelques-uns par IP et par heure, sinon on fabrique des votes à l'infini
    if (v.fresh && !rateLimit(req, "reactions:new", 5, 60 * 60_000)) return tooMany();
    try {
        const data = await setReaction((await params).id, v.id, type);
        const res = NextResponse.json({ success: true, data });
        if (v.fresh) res.cookies.set(COOKIE, v.fresh, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 * 2 });
        return res;
    } catch (error) {
        return errorResponse(error);
    }
}
