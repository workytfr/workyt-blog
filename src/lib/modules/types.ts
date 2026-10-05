/**
 * Modules d'article (cahier des charges § 9) : recette, avis tech, avis
 * lecture, avis produit, coup de cœur, coup de cœur d'un autre rédacteur
 * (sur invitation), sources. Un article peut en avoir plusieurs ; chacun
 * s'affiche à la fin de l'article ou à l'endroit choisi dans le texte (bloc
 * « module »), avec son balisage schema.org.
 *
 * Fichier commun au navigateur et au serveur : types, valeurs par défaut,
 * libellés.
 */

export const MODULE_TYPES = ["recipe", "techReview", "bookReview", "productReview", "favorite", "guestFavorite", "sources"] as const;
export type ModuleType = (typeof MODULE_TYPES)[number];

/** Image d'un module : toujours choisie dans la médiathèque, donc créditée */
export interface ModuleImage {
    url: string;
    alt: string;
    width?: number | null;
    height?: number | null;
    mediaId?: string;
    credit: { author: string; source: string; license: string; sourceUrl: string };
}

/** Un critère noté (même échelle que la note globale du module) */
export interface Criterion {
    label: string;
    score: number;
}

/** Note globale d'un avis qui a des critères : leur moyenne, au dixième (les critères sans nom ne comptent pas) */
export function criteriaAverage(criteria: Criterion[]): number | null {
    const named = criteria.filter((c) => c.label.trim());
    if (!named.length) return null;
    return Math.round((named.reduce((s, c) => s + c.score, 0) / named.length) * 10) / 10;
}

export interface RecipeData {
    name: string;
    description: string;
    image: ModuleImage | null;
    servings: number;
    prepMinutes: number;
    cookMinutes: number;
    restMinutes: number;
    difficulty: "" | "facile" | "moyen" | "difficile";
    cost: "" | "€" | "€€" | "€€€";
    ingredientGroups: { title: string; items: { qty: string; unit: string; name: string }[] }[];
    tools: string[];
    steps: { text: string; image: ModuleImage | null }[];
    tips: string;
    diets: string[];
    nutrition: { calories: string; proteins: string; carbs: string; fats: string };
}

export interface TechReviewData {
    product: string;
    brand: string;
    model: string;
    image: ModuleImage | null;
    price: string;
    specs: { key: string; value: string }[];
    criteria: Criterion[];
    pros: string[];
    cons: string[];
    verdict: string;
    /** Sur 10 */
    score: number;
}

export interface BookReviewData {
    title: string;
    authors: string;
    publisher: string;
    year: string;
    isbn: string;
    pages: string;
    genre: string;
    audience: string;
    summary: string;
    image: ModuleImage | null;
    criteria: Criterion[];
    /** Ce qu'on a aimé / moins aimé */
    pros: string[];
    cons: string[];
    favorite: boolean;
    /** Sur 5 */
    score: number;
}

export interface ProductReviewData {
    product: string;
    image: ModuleImage | null;
    price: string;
    merchant: string;
    /** Lien marchand : /go/<nom>/ (lien affilié géré) ou adresse directe */
    link: string;
    pros: string[];
    cons: string[];
    criteria: Criterion[];
    /** Sur 10 */
    score: number;
}

export const FAVORITE_KINDS = ["livre", "film", "série", "appli", "jeu", "lieu", "produit", "site", "podcast", "autre"] as const;
export type FavoriteKind = (typeof FAVORITE_KINDS)[number];

export interface FavoriteData {
    kind: FavoriteKind;
    name: string;
    image: ModuleImage | null;
    /** « Pourquoi on l'aime » : 2 ou 3 phrases */
    why: string;
    link: string;
    badge: string;
}

/**
 * Coup de cœur d'un autre rédacteur : l'auteur de l'article choisit l'invité,
 * l'objet et l'image ; l'invité écrit son texte puis le valide (§ 9).
 */
export interface GuestFavoriteData extends FavoriteData {
    guest: { memberId: string; name: string } | null;
    status: "draft" | "invited" | "validated";
    validatedAt: string | null;
}

export const SOURCE_KINDS = ["article", "livre", "étude", "site", "vidéo", "podcast"] as const;

export interface SourceItem {
    id: string;
    kind: (typeof SOURCE_KINDS)[number];
    title: string;
    authors: string;
    publisher: string;
    date: string;
    url: string;
    accessed: string;
    quote: string;
}

export interface SourcesData {
    items: SourceItem[];
}

export interface ModuleDataMap {
    recipe: RecipeData;
    techReview: TechReviewData;
    bookReview: BookReviewData;
    productReview: ProductReviewData;
    favorite: FavoriteData;
    guestFavorite: GuestFavoriteData;
    sources: SourcesData;
}

export type ArticleModule = { [K in ModuleType]: { id: string; type: K; data: ModuleDataMap[K] } }[ModuleType];
export type ModuleOf<K extends ModuleType> = Extract<ArticleModule, { type: K }>;

export const MODULE_LABELS: Record<ModuleType, { label: string; hint: string; scale?: number }> = {
    recipe: { label: "Recette", hint: "Ingrédients, étapes, temps, portions" },
    techReview: { label: "Avis tech", hint: "Fiche technique, notes, verdict sur 10", scale: 10 },
    bookReview: { label: "Avis lecture", hint: "Le livre, résumé sans spoiler, note sur 5", scale: 5 },
    productReview: { label: "Avis produit", hint: "Prix, lien marchand, points forts et faibles", scale: 10 },
    favorite: { label: "Coup de cœur", hint: "Ce que la rédaction aime, signé par toi" },
    guestFavorite: { label: "Coup de cœur d'un rédacteur", hint: "Un autre rédacteur écrit son coup de cœur" },
    sources: { label: "Sources", hint: "Références numérotées, appels [1] dans le texte" },
};

export const newId = () => Math.random().toString(36).slice(2, 10);

const noImage = null;
export function emptyModule<K extends ModuleType>(type: K): ModuleOf<K> {
    const data: ModuleDataMap = {
        recipe: {
            name: "",
            description: "",
            image: noImage,
            servings: 4,
            prepMinutes: 0,
            cookMinutes: 0,
            restMinutes: 0,
            difficulty: "",
            cost: "",
            ingredientGroups: [{ title: "", items: [{ qty: "", unit: "", name: "" }] }],
            tools: [],
            steps: [{ text: "", image: null }],
            tips: "",
            diets: [],
            nutrition: { calories: "", proteins: "", carbs: "", fats: "" },
        },
        techReview: { product: "", brand: "", model: "", image: noImage, price: "", specs: [], criteria: [{ label: "Design", score: 0 }], pros: [], cons: [], verdict: "", score: 0 },
        bookReview: { title: "", authors: "", publisher: "", year: "", isbn: "", pages: "", genre: "", audience: "", summary: "", image: noImage, criteria: [], pros: [], cons: [], favorite: false, score: 0 },
        productReview: { product: "", image: noImage, price: "", merchant: "", link: "", pros: [], cons: [], criteria: [], score: 0 },
        favorite: { kind: "livre", name: "", image: noImage, why: "", link: "", badge: "Coup de cœur" },
        guestFavorite: { kind: "livre", name: "", image: noImage, why: "", link: "", badge: "Coup de cœur", guest: null, status: "draft", validatedAt: null },
        sources: { items: [] },
    };
    return { id: newId(), type, data: data[type] } as ModuleOf<K>;
}

/** Libellé court d'un module dans l'éditeur (« Recette · Crêpes ») */
export function moduleSummary(m: ArticleModule): string {
    const d = m.data as unknown as Record<string, unknown>;
    const name = (d.name || d.product || d.title || "") as string;
    if (m.type === "sources") return `${m.data.items.length} source${m.data.items.length > 1 ? "s" : ""}`;
    if (m.type === "guestFavorite") return [m.data.guest?.name, m.data.name].filter(Boolean).join(" · ") || "à compléter";
    return name || "à compléter";
}

/** Un lien est affilié s'il passe par le gestionnaire : /go/<nom>/ */
export const isAffiliateHref = (href: string) => /^\/go\/[a-z0-9-]+\/?$/.test(href);
