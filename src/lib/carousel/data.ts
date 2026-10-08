/**
 * Carrousel Instagram / LinkedIn d'un article : son contenu, modifiable dans
 * le dashboard avant le téléchargement. Partagé entre le serveur (rendu des
 * images) et l'éditeur du carrousel.
 *
 * Dans les textes : **gras** et ==surligné==, comme dans l'éditeur.
 */

export const CAROUSEL_SIZE = { width: 1080, height: 1350 };
export const MAX_POINTS = 6;
/** Points par diapositive « À retenir » */
export const POINTS_PER_SLIDE = 3;

export interface CarouselData {
    title: string;
    category: { name: string; color: string } | null;
    readingMinutes: number;
    author: { name: string; title: string; avatar: string | null } | null;
    /** Photo de l'article : couverture, et en transparence sur la dernière page */
    image: string | null;
    intro: { heading: string; text: string };
    points: string[];
    quote: string;
    tags: string[];
    /** Adresse affichée sur la dernière page (sans https://) */
    url: string;
}

export type Run = { text: string; bold?: boolean; mark?: boolean };

/** « Un **mot** et un ==passage== » → morceaux de texte avec leur style */
export function parseRuns(s: string): Run[] {
    const runs: Run[] = [];
    const re = /\*\*(.+?)\*\*|==(.+?)==/g;
    let last = 0;
    for (let m = re.exec(s); m; m = re.exec(s)) {
        if (m.index > last) runs.push({ text: s.slice(last, m.index) });
        runs.push(m[1] !== undefined ? { text: m[1], bold: true } : { text: m[2], mark: true });
        last = m.index + m[0].length;
    }
    if (last < s.length) runs.push({ text: s.slice(last) });
    return runs;
}

/** Diapositives dans l'ordre : couverture, l'essentiel, points clés (1 ou 2), fin */
export type SlideKind = { kind: "cover" } | { kind: "intro" } | { kind: "points"; from: number; to: number; part: number; parts: number } | { kind: "end" };

export function slidesOf(d: CarouselData): SlideKind[] {
    // Les points vides comptent : la diapositive reste là pendant qu'on l'écrit
    const points = d.points.length;
    const parts = Math.ceil(points / POINTS_PER_SLIDE);
    const slides: SlideKind[] = [{ kind: "cover" }];
    if (d.intro.text.trim()) slides.push({ kind: "intro" });
    for (let i = 0; i < parts; i++) slides.push({ kind: "points", from: i * POINTS_PER_SLIDE, to: Math.min(points, (i + 1) * POINTS_PER_SLIDE), part: i + 1, parts });
    slides.push({ kind: "end" });
    return slides;
}

/** Contrôle de ce qui arrive du navigateur : longueurs bornées, types sûrs */
export function sanitizeCarousel(raw: unknown): CarouselData | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
    const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);
    const color = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : "#ff6a1a");
    const url = (v: unknown) => (typeof v === "string" && (/^https:\/\//.test(v) || /^\/(?!\/)/.test(v)) ? v.slice(0, 1000) : null);
    const cat = obj(r.category);
    const author = obj(r.author);
    const intro = obj(r.intro);
    const title = str(r.title, 160).trim();
    if (!title) return null;
    return {
        title,
        category: cat ? { name: str(cat.name, 40), color: color(cat.color) } : null,
        readingMinutes: Math.max(1, Math.min(120, Math.round(Number(r.readingMinutes) || 1))),
        author: author ? { name: str(author.name, 60), title: str(author.title, 80), avatar: url(author.avatar) } : null,
        image: url(r.image),
        intro: { heading: str(intro?.heading, 90), text: str(intro?.text, 420) },
        points: (Array.isArray(r.points) ? r.points : []).slice(0, MAX_POINTS).map((p) => str(p, 220)),
        quote: str(r.quote, 140),
        tags: (Array.isArray(r.tags) ? r.tags : []).slice(0, 8).map((t) => str(t, 30)).filter(Boolean),
        url: str(r.url, 90),
    };
}
