import { blobatar } from "blobatar";

/**
 * GET /api/avatar/<graine>/?size=128 — Blobatar (même bibliothèque et même
 * version que workyt.fr : même graine → même avatar). Pour les auteurs sans
 * compte workyt.fr ; les membres ont celui de workyt.fr, avec accessoires.
 */
const SEED = /^[\p{L}\p{N}_.-]{1,128}$/u;

export async function GET(req: Request, { params }: { params: Promise<{ seed: string }> }) {
    const seed = decodeURIComponent((await params).seed);
    if (!SEED.test(seed)) return new Response("Graine invalide", { status: 400 });
    const raw = Number.parseInt(new URL(req.url).searchParams.get("size") || "128", 10);
    const size = Number.isFinite(raw) ? Math.min(512, Math.max(32, raw)) : 128;
    const svg = blobatar(seed, { background: false }).replace("<svg ", `<svg width="${size}" height="${size}" `);
    return new Response(svg, {
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400, immutable", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" },
    });
}
