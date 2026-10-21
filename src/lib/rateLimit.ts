import { NextResponse } from "next/server";

/**
 * Limite de fréquence des points d'accès publics (vues, réactions, 404…).
 * Fenêtre glissante en mémoire : suffisant pour un seul processus
 * (output « standalone ») ; à remplacer par un stockage partagé si le blog
 * tourne un jour sur plusieurs instances.
 */
const MAX_KEYS = 10_000;
const buckets = new Map<string, number[]>();

/** IP du visiteur : premier élément de x-forwarded-for, sinon x-real-ip */
export function clientIp(req: Request): string {
    const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return fwd || req.headers.get("x-real-ip")?.trim() || "inconnue";
}

/**
 * true si l'appel est accepté : au plus `limit` appels par `windowMs` pour
 * `scope` + IP. Le tableau des clés est borné (les plus anciennes sortent).
 */
export function rateLimit(req: Request, scope: string, limit: number, windowMs: number): boolean {
    return hit(`${scope}:${clientIp(req)}`, limit, windowMs);
}

export function hit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
    const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
    const ok = recent.length < limit;
    if (ok) recent.push(now);
    // Réinsertion : la clé passe en fin d'ordre (la plus récente)
    buckets.delete(key);
    buckets.set(key, recent);
    while (buckets.size > MAX_KEYS) buckets.delete(buckets.keys().next().value!);
    return ok;
}

/** Réponse 429 simple */
export const tooMany = () => NextResponse.json({ success: false, error: "Trop de requêtes, réessaie dans un moment." }, { status: 429, headers: { "Retry-After": "60" } });
