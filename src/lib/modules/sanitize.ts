import {
    criteriaAverage,
    FAVORITE_KINDS,
    MODULE_TYPES,
    SOURCE_KINDS,
    newId,
    type ArticleModule,
    type BookReviewData,
    type Criterion,
    type FavoriteData,
    type GuestFavoriteData,
    type ModuleImage,
    type ModuleType,
    type ProductReviewData,
    type RecipeData,
    type SourcesData,
    type TechReviewData,
} from "./types";

/**
 * Nettoyage des modules envoyés par l'éditeur : chaque champ est borné et
 * typé, les liens et images vérifiés. Rien n'est gardé tel quel. Le texte
 * du coup de cœur d'un invité ne peut être modifié que par l'invité.
 */

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const text = (v: unknown, max = 2000) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "");
const num = (v: unknown, min: number, max: number, step = 1) => {
    const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, Math.round(n / step) * step));
};
const list = <T,>(v: unknown, max: number, each: (x: unknown) => T | null): T[] => (Array.isArray(v) ? v.slice(0, max).map(each).filter((x): x is T => x !== null) : []);
const strings = (v: unknown, max: number, len = 200) => list(v, max, (x) => str(x, len) || null);
const oneOf = <T extends string>(v: unknown, values: readonly T[], fallback: T): T => (values.includes(v as T) ? (v as T) : fallback);

/** Lien : adresse http(s), ou lien affilié géré /go/<nom>/ */
export function cleanLink(v: unknown): string {
    const s = str(v, 500);
    if (/^\/go\/[a-z0-9-]+\/?$/.test(s)) return s.endsWith("/") ? s : `${s}/`;
    try {
        const u = new URL(s);
        return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
    } catch {
        return "";
    }
}

export function cleanImage(v: unknown): ModuleImage | null {
    const o = obj(v);
    const url = str(o.url, 600);
    if (!/^(https:\/\/|\/uploads-dev\/)/.test(url)) return null;
    const c = obj(o.credit);
    return {
        url,
        alt: str(o.alt, 300),
        width: typeof o.width === "number" ? o.width : null,
        height: typeof o.height === "number" ? o.height : null,
        mediaId: str(o.mediaId, 40) || undefined,
        credit: { author: str(c.author, 120), source: str(c.source, 120), license: str(c.license, 120), sourceUrl: cleanLink(c.sourceUrl) },
    };
}

/** Note globale : la moyenne des critères s'il y en a, sinon la note donnée (au demi-point) */
const score = (d: Raw, crit: Criterion[], scale: number) => criteriaAverage(crit) ?? num(d.score, 0, scale, 0.5);

const criteria = (v: unknown, scale: number): Criterion[] => list(v, 12, (x) => (str(obj(x).label, 60) ? { label: str(obj(x).label, 60), score: num(obj(x).score, 0, scale, 0.5) } : null));

function recipe(d: Raw): RecipeData {
    const n = obj(d.nutrition);
    return {
        name: str(d.name, 160),
        description: text(d.description, 600),
        image: cleanImage(d.image),
        servings: num(d.servings, 1, 100),
        prepMinutes: num(d.prepMinutes, 0, 6000),
        cookMinutes: num(d.cookMinutes, 0, 6000),
        restMinutes: num(d.restMinutes, 0, 6000),
        difficulty: oneOf(d.difficulty, ["", "facile", "moyen", "difficile"] as const, ""),
        cost: oneOf(d.cost, ["", "€", "€€", "€€€"] as const, ""),
        ingredientGroups: list(d.ingredientGroups, 10, (g) => {
            const items = list(obj(g).items, 60, (i) => (str(obj(i).name, 120) ? { qty: str(obj(i).qty, 20), unit: str(obj(i).unit, 30), name: str(obj(i).name, 120) } : null));
            return items.length || str(obj(g).title, 80) ? { title: str(obj(g).title, 80), items } : null;
        }),
        tools: strings(d.tools, 30, 80),
        steps: list(d.steps, 40, (s) => (text(obj(s).text, 1500) ? { text: text(obj(s).text, 1500), image: cleanImage(obj(s).image) } : null)),
        tips: text(d.tips, 1500),
        diets: strings(d.diets, 8, 40),
        nutrition: { calories: str(n.calories, 20), proteins: str(n.proteins, 20), carbs: str(n.carbs, 20), fats: str(n.fats, 20) },
    };
}

function techReview(d: Raw): TechReviewData {
    const crit = criteria(d.criteria, 10);
    return {
        product: str(d.product, 160),
        brand: str(d.brand, 80),
        model: str(d.model, 80),
        image: cleanImage(d.image),
        price: str(d.price, 40),
        specs: list(d.specs, 40, (s) => (str(obj(s).key, 60) ? { key: str(obj(s).key, 60), value: str(obj(s).value, 200) } : null)),
        criteria: crit,
        pros: strings(d.pros, 12),
        cons: strings(d.cons, 12),
        verdict: text(d.verdict, 1500),
        score: score(d, crit, 10),
    };
}

function bookReview(d: Raw): BookReviewData {
    const crit = criteria(d.criteria, 5);
    return {
        title: str(d.title, 200),
        authors: str(d.authors, 200),
        publisher: str(d.publisher, 120),
        year: str(d.year, 10),
        isbn: str(d.isbn, 20).replace(/[^0-9Xx-]/g, ""),
        pages: str(d.pages, 10).replace(/\D/g, ""),
        genre: str(d.genre, 80),
        audience: str(d.audience, 80),
        summary: text(d.summary, 2000),
        image: cleanImage(d.image),
        criteria: crit,
        pros: strings(d.pros, 12),
        cons: strings(d.cons, 12),
        favorite: d.favorite === true,
        score: score(d, crit, 5),
    };
}

function productReview(d: Raw): ProductReviewData {
    const crit = criteria(d.criteria, 10);
    return {
        product: str(d.product, 160),
        image: cleanImage(d.image),
        price: str(d.price, 40),
        merchant: str(d.merchant, 80),
        link: cleanLink(d.link),
        pros: strings(d.pros, 12),
        cons: strings(d.cons, 12),
        criteria: crit,
        score: score(d, crit, 10),
    };
}

function favorite(d: Raw): FavoriteData {
    return {
        kind: oneOf(d.kind, FAVORITE_KINDS, "autre"),
        name: str(d.name, 160),
        image: cleanImage(d.image),
        why: text(d.why, 700),
        link: cleanLink(d.link),
        badge: str(d.badge, 40) || "Coup de cœur",
    };
}

function sources(d: Raw): SourcesData {
    return {
        items: list(d.items, 60, (x) => {
            const o = obj(x);
            if (!str(o.title, 300)) return null;
            return {
                id: /^[a-z0-9]{4,12}$/.test(String(o.id)) ? String(o.id) : newId(),
                kind: oneOf(o.kind, SOURCE_KINDS, "site"),
                title: str(o.title, 300),
                authors: str(o.authors, 200),
                publisher: str(o.publisher, 120),
                date: str(o.date, 30),
                url: cleanLink(o.url),
                accessed: str(o.accessed, 30),
                quote: text(o.quote, 600),
            };
        }),
    };
}

/**
 * Coup de cœur d'un invité. L'auteur de l'article choisit l'invité, l'objet,
 * l'image et le lien ; une fois l'invitation envoyée, le texte et la
 * validation appartiennent à l'invité (repris de la version enregistrée).
 */
function guestFavorite(d: Raw, prev: GuestFavoriteData | null): GuestFavoriteData {
    const base = favorite(d);
    const g = obj(d.guest);
    const guest = /^[a-f0-9]{24}$/.test(String(g.memberId)) ? { memberId: String(g.memberId), name: str(g.name, 80) } : null;
    const sameGuest = !!guest && prev?.guest?.memberId === guest.memberId;
    if (!guest) return { ...base, guest: null, status: "draft", validatedAt: null };
    if (sameGuest && prev && prev.status !== "draft") {
        // Texte de l'invité : on garde le sien ; un changement d'objet par l'auteur repasse en « à valider »
        const objectChanged = prev.name !== base.name || prev.kind !== base.kind || prev.link !== base.link;
        return { ...base, why: prev.why, name: prev.status === "validated" && !objectChanged ? prev.name : base.name, guest, status: objectChanged ? "invited" : prev.status, validatedAt: objectChanged ? null : prev.validatedAt };
    }
    // Nouvel invité : l'invitation part à l'enregistrement
    return { ...base, why: sameGuest ? base.why : "", guest, status: "invited", validatedAt: null };
}

/** Ce que l'invité peut changer : son texte (et le nom de l'objet), puis valider ou retirer */
export function applyGuestEdit(prev: GuestFavoriteData, input: Raw): GuestFavoriteData {
    const next: GuestFavoriteData = { ...prev };
    if (typeof input.why === "string") next.why = text(input.why, 700);
    if (typeof input.name === "string" && str(input.name, 160)) next.name = str(input.name, 160);
    if (input.validate === true) {
        if (!next.why) throw new Error("Écris quelques mots sur ton coup de cœur avant de valider.");
        next.status = "validated";
        next.validatedAt = new Date().toISOString();
    } else if (typeof input.why === "string" || typeof input.name === "string") {
        // Le texte a changé : à revalider
        next.status = "invited";
        next.validatedAt = null;
    }
    return next;
}

export function sanitizeModules(raw: unknown, previous: ArticleModule[] = []): ArticleModule[] {
    const prevById = new Map(previous.map((m) => [m.id, m]));
    const seen = new Set<string>();
    return list(raw, 20, (x) => {
        const o = obj(x);
        const type = o.type as ModuleType;
        if (!MODULE_TYPES.includes(type)) return null;
        let id = /^[a-z0-9]{4,12}$/.test(String(o.id)) ? String(o.id) : newId();
        if (seen.has(id)) id = newId();
        seen.add(id);
        const d = obj(o.data);
        const prev = prevById.get(id);
        switch (type) {
            case "recipe":
                return { id, type, data: recipe(d) };
            case "techReview":
                return { id, type, data: techReview(d) };
            case "bookReview":
                return { id, type, data: bookReview(d) };
            case "productReview":
                return { id, type, data: productReview(d) };
            case "favorite":
                return { id, type, data: favorite(d) };
            case "guestFavorite":
                return { id, type, data: guestFavorite(d, prev?.type === "guestFavorite" ? prev.data : null) };
            case "sources":
                return { id, type, data: sources(d) };
        }
    });
}

const credited = (img: ModuleImage | null) => !img || !!(img.credit.author && img.credit.source && img.credit.license);

/**
 * Points bloquants des modules. `approval` : seulement pour passer en
 * approbation et publier (le coup de cœur d'un invité doit être validé).
 */
export function moduleIssues(modules: ArticleModule[]): { submit: string[]; approval: string[] } {
    const submit: string[] = [];
    const approval: string[] = [];
    for (const m of modules) {
        const d = m.data;
        const images: (ModuleImage | null)[] = [];
        switch (m.type) {
            case "recipe": {
                const r = m.data;
                if (!r.name) submit.push("Recette : donne-lui un nom.");
                if (!r.image) submit.push("Recette : ajoute une photo du plat (Google l'exige).");
                if (!r.ingredientGroups.some((g) => g.items.length)) submit.push("Recette : ajoute les ingrédients.");
                if (!r.steps.length) submit.push("Recette : ajoute les étapes.");
                images.push(r.image, ...r.steps.map((s) => s.image));
                break;
            }
            case "techReview":
            case "productReview":
                if (!m.data.product) submit.push(`${m.type === "techReview" ? "Avis tech" : "Avis produit"} : indique le produit.`);
                if (!m.data.score) submit.push(`${m.type === "techReview" ? "Avis tech" : "Avis produit"} : donne une note.`);
                images.push(m.data.image);
                break;
            case "bookReview":
                if (!m.data.title || !m.data.authors) submit.push("Avis lecture : indique le titre et l'auteur du livre.");
                if (!m.data.score) submit.push("Avis lecture : donne une note.");
                images.push(m.data.image);
                break;
            case "favorite":
                if (!m.data.name || !m.data.why) submit.push("Coup de cœur : indique l'objet et pourquoi on l'aime.");
                images.push(m.data.image);
                break;
            case "guestFavorite":
                if (!m.data.guest) submit.push("Coup de cœur d'un rédacteur : choisis le rédacteur invité.");
                else if (m.data.status !== "validated") approval.push(`Coup de cœur : ${m.data.guest.name} n'a pas encore validé son texte.`);
                images.push(m.data.image);
                break;
            case "sources":
                if (!m.data.items.length) submit.push("Sources : ajoute au moins une référence (ou retire le module).");
                break;
        }
        if (images.some((i) => !credited(i))) submit.push(`Module « ${d && "name" in d && d.name ? d.name : m.type} » : une image n'a pas de source ni de licence.`);
    }
    return { submit, approval };
}
