import "server-only";

/**
 * Vokyt (vokyt.cc) : des extraits audio dans l'article, lus au fil du
 * défilement, avec leur transcription. Dans le contenu, un extrait est un bloc
 * `<div class="wk-vokyt" data-vokyt="note_…">` ; à l'affichage, il devient la
 * balise `<vokyt-player>`. Avec la clé secrète, le serveur demande à Vokyt la
 * balise complète (transcription dans le HTML : lisible par les moteurs) ;
 * sans elle, le lecteur charge le vocal lui-même avec la clé publique.
 *
 *   VOKYT_SECRET_KEY=sk_live_…          (serveur, facultative)
 *   NEXT_PUBLIC_VOKYT_KEY=pk_live_…     (clé publique du site)
 *   VOKYT_URL=https://vokyt.cc          (facultative)
 */
const API = (process.env.VOKYT_URL || "https://vokyt.cc").replace(/\/$/, "");
const SECRET = process.env.VOKYT_SECRET_KEY || "";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VOKYT_KEY || "";

export const VOKYT = {
    /** Sans clé, les extraits ne s'affichent pas */
    enabled: !!(SECRET || PUBLIC_KEY),
    /** Enregistrer ou envoyer un vocal depuis l'éditeur : clé secrète obligatoire */
    canUpload: !!SECRET,
    playerScript: `${API}/player.js`,
    publicKey: PUBLIC_KEY,
};

const SLOT = /<div\b[^>]*\bdata-vokyt="(note_[A-Za-z0-9]{4,40})"[^>]*>\s*<\/div>/g;

/** Identifiants des extraits d'un contenu (sans doublon) */
export function vokytIds(html: string): string[] {
    return [...new Set([...html.matchAll(SLOT)].map((m) => m[1]))];
}

/**
 * Balises préparées par Vokyt, gardées en mémoire : 10 min pour un extrait prêt, 30 s pour
 * un extrait encore en traitement (il apparaît vite une fois transcrit). Une entrée par
 * extrait cité dans un article : le nombre reste borné.
 */
const embedState = globalThis as unknown as { __vokytEmbeds?: Map<string, { at: number; ttl: number; html: string | null; loading?: Promise<string | null> }> };
embedState.__vokytEmbeds ??= new Map();
const embeds = embedState.__vokytEmbeds;

async function fetchEmbed(id: string): Promise<string | null> {
    try {
        const res = await fetch(`${API}/v1/notes/${encodeURIComponent(id)}/embed`, {
            headers: { Authorization: `Bearer ${SECRET}` },
            signal: AbortSignal.timeout(5000),
            cache: "no-store",
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { html?: unknown };
        // Seule la balise du lecteur est acceptée (elle vient de notre compte Vokyt)
        return typeof data.html === "string" && data.html.startsWith("<vokyt-player ") ? data.html : null;
    } catch {
        return null;
    }
}

function embedHtml(id: string): Promise<string | null> {
    const hit = embeds.get(id);
    if (hit && Date.now() - hit.at < hit.ttl) return Promise.resolve(hit.html);
    if (hit?.loading) return hit.loading;
    const loading = fetchEmbed(id).then((html) => {
        embeds.set(id, { at: Date.now(), ttl: html ? 10 * 60_000 : 30_000, html });
        return html;
    });
    embeds.set(id, { at: hit?.at ?? 0, ttl: hit?.ttl ?? 0, html: hit?.html ?? null, loading });
    // Ancienne balise servie pendant le recalcul, s'il y en a une
    return hit?.html ? Promise.resolve(hit.html) : loading;
}

/**
 * Remplace les blocs d'extrait par le lecteur Vokyt. À appeler sur du HTML
 * déjà assaini : la balise du lecteur n'est pas dans la liste de l'assainisseur.
 */
export async function renderVokyt(html: string): Promise<{ html: string; count: number }> {
    const ids = vokytIds(html);
    if (!ids.length) return { html, count: 0 };
    if (!VOKYT.enabled) return { html: html.replace(SLOT, ""), count: 0 };
    // Au plus 20 extraits par article : chacun est un appel au service
    const known = ids.slice(0, 20);
    const embeds = new Map<string, string | null>(SECRET ? await Promise.all(known.map(async (id) => [id, await embedHtml(id)] as const)) : []);
    return {
        html: html.replace(SLOT, (_m, id: string) => (known.includes(id) ? embeds.get(id) || `<vokyt-player note="${id}"></vokyt-player>` : "")),
        count: known.length,
    };
}

/* ─── Envoi depuis l'éditeur (relais : la clé secrète reste sur le serveur) ─── */

export class VokytApiError extends Error {
    constructor(
        message: string,
        public status = 502
    ) {
        super(message);
    }
}

/** Appel à l'API secrète de Vokyt ; ses messages d'erreur (en français) sont repris tels quels */
export async function vokytApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    if (!SECRET) throw new VokytApiError("Vokyt n'est pas configuré sur ce blog (clé secrète manquante).", 503);
    const res = await fetch(`${API}/v1${path}`, {
        method: init.method ?? "GET",
        headers: { Authorization: `Bearer ${SECRET}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
    }).catch(() => null);
    if (!res) throw new VokytApiError("Vokyt ne répond pas. Réessaie dans un moment.");
    const data = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    if (!res.ok) throw new VokytApiError(data?.error?.message || `Vokyt a refusé la demande (${res.status}).`, res.status >= 500 ? 502 : res.status);
    return data as T;
}

/** Ce que l'éditeur a besoin de savoir d'un vocal */
export interface VokytNoteView {
    id: string;
    status: "uploading" | "queued" | "processing" | "ready" | "failed";
    title: string | null;
    durationMs: number | null;
    multiVoice: boolean;
    excerpt: string;
    error: string | null;
    createdAt: string;
}

export interface ApiNote {
    id: string;
    status: VokytNoteView["status"];
    title: string | null;
    durationMs: number | null;
    multiVoice?: boolean;
    transcript?: { text?: string } | null;
    error: string | null;
    createdAt: string;
}

export function toNoteView(n: ApiNote): VokytNoteView {
    // Sans les sons entre crochets (« [Générique] ») : le début de ce qui est dit
    const text = n.transcript?.text?.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim() ?? "";
    return { id: n.id, status: n.status, title: n.title, durationMs: n.durationMs, multiVoice: !!n.multiVoice, excerpt: text.slice(0, 140), error: n.error, createdAt: n.createdAt };
}
