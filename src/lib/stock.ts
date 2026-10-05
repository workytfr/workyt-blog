/**
 * Banques d'images libres (Pixabay, Pexels) : recherche, et import dans la
 * médiathèque avec le crédit rempli d'office. Côté serveur seulement : les
 * clés d'API ne partent jamais vers le navigateur.
 *
 * Règles des fournisseurs :
 * - Pixabay : pas de lien direct durable vers leurs images (on les copie chez
 *   nous à l'import) ; réponses à garder en cache 24 h ; 100 requêtes / min.
 * - Pexels : créditer le photographe et Pexels ; 200 requêtes / h.
 */

export const STOCK_PROVIDERS = ["pixabay", "pexels"] as const;
export type StockProvider = (typeof STOCK_PROVIDERS)[number];

export interface StockPhoto {
    provider: StockProvider;
    id: string;
    /** Vignette pour la grille de résultats */
    thumb: string;
    width: number;
    height: number;
    author: string;
    authorUrl: string;
    /** Page de la photo chez le fournisseur (lien du crédit) */
    pageUrl: string;
    /** Description fournie (Pexels) ou mots-clés (Pixabay) */
    alt: string;
    tags: string;
    /** Version à importer (1 280 à 1 900 px de large) */
    downloadUrl: string;
}

export const STOCK_LABELS: Record<StockProvider, { name: string; source: string; license: string; site: string }> = {
    pixabay: { name: "Pixabay", source: "Pixabay", license: "Licence Pixabay", site: "https://pixabay.com/" },
    pexels: { name: "Pexels", source: "Pexels", license: "Licence Pexels", site: "https://www.pexels.com/fr-fr/" },
};

const keyOf = (p: StockProvider) => (p === "pixabay" ? process.env.PIXABAY_API_KEY : process.env.PEXELS_API_KEY)?.trim() || "";

/** Banques dont la clé est configurée */
export const configuredProviders = (): StockProvider[] => STOCK_PROVIDERS.filter((p) => keyOf(p));

export class StockError extends Error {
    constructor(
        message: string,
        public status = 502
    ) {
        super(message);
    }
}

const UA = "WorkytBlog/1.0 (+https://blog.workyt.fr)";

/* Cache des réponses (exigé par Pixabay : 24 h) */
const CACHE_MS = 24 * 3600_000;
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
    const value = await load();
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), value });
    return value;
}

async function getJson(url: string, headers: Record<string, string> = {}) {
    const r = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!r) throw new StockError("La banque d'images ne répond pas. Réessaie dans un instant.");
    if (r.status === 429) throw new StockError("Trop de recherches d'un coup : attends une minute.", 429);
    if (r.status === 401 || r.status === 403) throw new StockError("Clé d'API refusée par la banque d'images.");
    if (r.status === 404) throw new StockError("Photo introuvable.", 404);
    if (!r.ok) throw new StockError("La banque d'images a renvoyé une erreur.");
    return r.json();
}

/* ─── Pixabay ─── */

interface PixabayHit {
    id: number;
    pageURL: string;
    tags: string;
    previewURL: string;
    webformatURL: string;
    largeImageURL: string;
    imageWidth: number;
    imageHeight: number;
    user: string;
    user_id: number;
}

const fromPixabay = (h: PixabayHit): StockPhoto => ({
    provider: "pixabay",
    id: String(h.id),
    thumb: h.webformatURL,
    width: h.imageWidth,
    height: h.imageHeight,
    author: h.user,
    authorUrl: `https://pixabay.com/users/${encodeURIComponent(h.user)}-${h.user_id}/`,
    pageUrl: h.pageURL,
    alt: "",
    // Mots-clés sans doublons (Pixabay répète souvent le même mot)
    tags: [...new Set(h.tags.split(",").map((t) => t.trim()).filter(Boolean))].join(", "),
    downloadUrl: h.largeImageURL,
});

const pixabayUrl = (params: Record<string, string>) => `https://pixabay.com/api/?${new URLSearchParams({ key: keyOf("pixabay"), image_type: "photo", safesearch: "true", lang: "fr", ...params })}`;

/* ─── Pexels ─── */

interface PexelsPhoto {
    id: number;
    width: number;
    height: number;
    url: string;
    alt: string;
    photographer: string;
    photographer_url: string;
    src: { large2x: string; large: string; medium: string };
}

const fromPexels = (p: PexelsPhoto): StockPhoto => ({
    provider: "pexels",
    id: String(p.id),
    thumb: p.src.medium,
    width: p.width,
    height: p.height,
    author: p.photographer,
    authorUrl: p.photographer_url,
    pageUrl: p.url,
    alt: p.alt ?? "",
    tags: "",
    downloadUrl: p.src.large2x,
});

const pexelsHeaders = () => ({ Authorization: keyOf("pexels") });

/* ─── Recherche et lecture d'une photo ─── */

export const PER_PAGE = 30;

export async function searchStock(provider: StockProvider, q: string, page = 1): Promise<{ items: StockPhoto[]; total: number }> {
    if (!keyOf(provider)) throw new StockError(`${STOCK_LABELS[provider].name} n'est pas configuré (clé d'API manquante).`, 503);
    const query = q.trim().slice(0, 100);
    if (!query) return { items: [], total: 0 };
    const p = Math.min(Math.max(1, Math.floor(page) || 1), 20);
    return cached(`${provider}:s:${query.toLowerCase()}:${p}`, async () => {
        if (provider === "pixabay") {
            const j = await getJson(pixabayUrl({ q: query, per_page: String(PER_PAGE), page: String(p) }));
            return { items: (j.hits as PixabayHit[]).map(fromPixabay), total: Math.min(j.totalHits ?? 0, 500) };
        }
        const j = await getJson(`https://api.pexels.com/v1/search?${new URLSearchParams({ query, per_page: String(PER_PAGE), page: String(p), locale: "fr-FR" })}`, pexelsHeaders());
        return { items: (j.photos as PexelsPhoto[]).map(fromPexels), total: Math.min(j.total_results ?? 0, 600) };
    });
}

/** Une photo, relue chez le fournisseur (on ne fait pas confiance aux adresses envoyées par le navigateur) */
export async function getStockPhoto(provider: StockProvider, id: string): Promise<StockPhoto> {
    if (!keyOf(provider)) throw new StockError(`${STOCK_LABELS[provider].name} n'est pas configuré (clé d'API manquante).`, 503);
    if (!/^\d{1,15}$/.test(id)) throw new StockError("Photo introuvable.", 404);
    return cached(`${provider}:id:${id}`, async () => {
        if (provider === "pixabay") {
            const j = await getJson(pixabayUrl({ id }));
            const hit = (j.hits as PixabayHit[])[0];
            if (!hit) throw new StockError("Photo introuvable.", 404);
            return fromPixabay(hit);
        }
        return fromPexels(await getJson(`https://api.pexels.com/v1/photos/${id}`, pexelsHeaders()));
    });
}

/** Télécharge l'image à importer (adresse venue de l'API du fournisseur, en https) */
export async function downloadStockPhoto(photo: StockPhoto): Promise<File> {
    const url = new URL(photo.downloadUrl);
    const hosts = photo.provider === "pixabay" ? ["pixabay.com", "cdn.pixabay.com"] : ["images.pexels.com"];
    if (url.protocol !== "https:" || !hosts.includes(url.hostname)) throw new StockError("Adresse d'image inattendue.");
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (!r?.ok) throw new StockError("Téléchargement de la photo impossible. Réessaie.");
    const type = (r.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
    const name = `${photo.provider}-${photo.id}-${(photo.alt || photo.tags || "photo").slice(0, 40)}`;
    return new File([await r.arrayBuffer()], `${name}.jpg`, { type });
}
