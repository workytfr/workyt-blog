import { connectDB } from "@/lib/db";
import { hostOf, isDomain, linkDomains } from "@/lib/linkIcon";
import { currentActor } from "@/lib/session";
import AffiliateLink from "@/models/AffiliateLink";
import Post from "@/models/Post";

/**
 * GET /api/favicon/<domaine>/ — logo d'un site cité dans un article.
 * Récupéré une fois côté serveur puis mis en cache (mémoire + navigateur
 * 7 jours) ; à défaut, un petit globe.
 *
 * Liste blanche : seulement les domaines cités par un article publié ou un
 * lien affilié (et n'importe lequel pour un membre connecté, qui écrit ou
 * relit un brouillon). Sinon le blog servirait de relais de favicons à
 * n'importe qui, et un inconnu pourrait vider le cache à coups de domaines.
 */
const MAX_BYTES = 100_000;
const MAX_ENTRIES = 1000;
const ALLOWED_TTL = 10 * 60 * 1000;
const cache = new Map<string, { body: ArrayBuffer; type: string }>();
let allowed: { domains: Set<string>; at: number; pending?: Promise<Set<string>> } = { domains: new Set(), at: 0 };

const GLOBE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8a8178" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>`;

/** Domaines cités par les articles publiés et les liens affiliés, relus toutes les 10 minutes */
async function allowedDomains(): Promise<Set<string>> {
    if (Date.now() - allowed.at < ALLOWED_TTL) return allowed.domains;
    allowed.pending ??= (async () => {
        await connectDB();
        const [posts, links] = await Promise.all([Post.find({ status: "published" }).select("contentHtml").lean(), AffiliateLink.find().select("url").lean()]);
        const domains = new Set(posts.flatMap((p) => linkDomains(p.contentHtml || "")));
        for (const l of links) {
            const host = hostOf(l.url);
            if (host) domains.add(host);
        }
        allowed = { domains, at: Date.now() };
        return domains;
    })().finally(() => {
        allowed.pending = undefined;
    });
    return allowed.pending;
}

async function isAllowed(domain: string): Promise<boolean> {
    if (cache.has(domain)) return true;
    try {
        if ((await allowedDomains()).has(domain)) return true;
    } catch (error) {
        console.error("[favicon]", error);
    }
    return !!(await currentActor());
}

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

const SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

export async function GET(_req: Request, { params }: { params: Promise<{ domain: string }> }) {
    const domain = (await params).domain.toLowerCase();
    if (!isDomain(domain)) return new Response("Domaine invalide", { status: 400 });
    // Domaine inconnu : le globe, sans rien demander à personne ni le garder (il peut être cité demain)
    if (!(await isAllowed(domain))) return new Response(GLOBE, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": SVG_CSP } });

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
            "Content-Security-Policy": SVG_CSP,
        },
    });
}
