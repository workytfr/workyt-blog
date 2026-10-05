import { connectDB } from "./db";
import Redirect from "@/models/Redirect";

/**
 * Table des redirections gardée en mémoire (rafraîchie chaque minute) : le
 * proxy la consulte à chaque requête sans interroger la base.
 */
export interface RedirectRule {
    to: string;
    status: 301 | 302 | 410;
}

const TTL_MS = 60_000;
const state = globalThis as unknown as {
    __blogRedirects?: { at: number; map: Map<string, RedirectRule>; loading: Promise<void> | null };
};
state.__blogRedirects ??= { at: 0, map: new Map(), loading: null };
const store = state.__blogRedirects;

/**
 * Normalise un chemin : décodé, minuscules, « / » au début et à la fin.
 * Une requête éventuelle est gardée telle quelle (clés « /?page_id=12 » des
 * anciennes adresses WordPress).
 */
export function normalizePath(path: string): string {
    const [rawPath, query] = path.split("?", 2);
    return `${normalizePathname(rawPath || "/")}${query ? `?${query.toLowerCase()}` : ""}`;
}

function normalizePathname(path: string): string {
    let p = path;
    try {
        p = decodeURIComponent(p);
    } catch {
        /* chemin mal encodé : on le garde tel quel */
    }
    p = p.toLowerCase().trim();
    if (!p.startsWith("/")) p = `/${p}`;
    if (!p.endsWith("/")) p = `${p}/`;
    return p.replace(/\/{2,}/g, "/");
}

async function refresh() {
    await connectDB();
    const rows = await Redirect.find({}).select("from to status").lean();
    store.map = new Map(rows.map((r) => [r.from, { to: r.to || "/", status: r.status as RedirectRule["status"] }]));
    store.at = Date.now();
}

/** La règle qui s'applique à ce chemin, ou null. Ne lève jamais : le site reste servi si la base hoquette. */
export async function lookupRedirect(path: string): Promise<RedirectRule | null> {
    if (Date.now() - store.at > TTL_MS) {
        store.loading ??= refresh()
            .catch((error) => console.error("[redirections] rechargement impossible :", error))
            .finally(() => {
                store.loading = null;
            });
        // Premier chargement : on attend ; ensuite on sert l'ancienne table pendant le rechargement
        if (store.at === 0) await store.loading;
    }
    return store.map.get(normalizePath(path)) ?? null;
}

/** Compte un passage (sans bloquer la réponse) */
export function recordHit(path: string) {
    void connectDB()
        .then(() => Redirect.updateOne({ from: normalizePath(path) }, { $inc: { hits: 1 }, $set: { lastHitAt: new Date() } }))
        .catch(() => {});
}

/** Vide le cache (après une modification dans le dashboard) */
export function invalidateRedirects() {
    store.at = 0;
}
