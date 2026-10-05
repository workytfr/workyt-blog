import { isDomain } from "@/lib/linkIcon";

/**
 * GET /api/favicon/<domaine>/ — logo d'un site cité dans un article.
 * Récupéré une fois côté serveur puis mis en cache (mémoire + navigateur
 * 7 jours) ; à défaut, un petit globe.
 */
const MAX_BYTES = 100_000;
const MAX_ENTRIES = 1000;
const cache = new Map<string, { body: ArrayBuffer; type: string }>();

const GLOBE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8a8178" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>`;

async function fetchIcon(domain: string): Promise<{ body: ArrayBuffer; type: string } | null> {
    try {
        const r = await fetch(`https://icons.duckduckgo.com/ip3/${domain}.ico`, { headers: { "User-Agent": "WorkytBlog/1.0 (+https://blog.workyt.fr)" }, signal: AbortSignal.timeout(4000) });
        const type = r.headers.get("content-type") || "";
        if (!r.ok || !type.startsWith("image/")) return null;
        const body = await r.arrayBuffer();
        return body.byteLength > 0 && body.byteLength <= MAX_BYTES ? { body, type } : null;
    } catch {
        return null;
    }
}

export async function GET(_req: Request, { params }: { params: Promise<{ domain: string }> }) {
    const domain = (await params).domain.toLowerCase();
    if (!isDomain(domain)) return new Response("Domaine invalide", { status: 400 });

    let icon = cache.get(domain);
    if (!icon) {
        icon = (await fetchIcon(domain)) ?? { body: new TextEncoder().encode(GLOBE).buffer as ArrayBuffer, type: "image/svg+xml" };
        if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
        cache.set(domain, icon);
    }
    return new Response(icon.body, {
        headers: {
            "Content-Type": icon.type,
            "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
            "X-Content-Type-Options": "nosniff",
            // Un SVG venu d'ailleurs ne doit jamais exécuter de script s'il est ouvert directement
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        },
    });
}
