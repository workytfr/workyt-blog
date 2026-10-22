import type { JSONContent } from "@tiptap/core";

/**
 * Correcteur de langue (Grammalecte, sans IA), partie commune au navigateur
 * et au serveur : texte des paragraphes, classement des fautes, règles
 * souples de Workyt et décompte pour la note SEO.
 *
 * Le moteur (public/grammalecte-2.3.0, GPL 3) tourne dans un Web Worker
 * pour l'éditeur et dans une machine virtuelle Node pour la note
 * enregistrée : les deux lisent les mêmes paragraphes avec les mêmes règles,
 * le rédacteur voit donc la note que le serveur enregistre.
 */

export const GRAMMALECTE_DIR = "grammalecte-2.3.0";

/**
 * Réglages du moteur. Ce que Workyt laisse passer est coupé ici (négation
 * sans « ne »…) ; les apostrophes et espaces insécables ne sont pas
 * soulignés une à une : « Corriger la typographie » les règle d'un coup.
 */
export const GRAMMALECTE_OPTIONS: Record<string, boolean> = {
    apos: false,
    nbsp: false,
    esp: false,
    tab: false,
    poncfin: false,
    mapos: false,
    ocr: false,
    liga: false,
    neg: false,
    redon1: true,
    redon2: false,
    mc: false,
    idrule: false,
    html: false,
    latex: false,
    md: false,
};

/** Faute brute renvoyée par le moteur (positions dans le texte du paragraphe) */
export interface RawIssue {
    start: number;
    end: number;
    /** Identifiant de la règle, « spell » pour un mot inconnu */
    rule: string;
    /** Famille Grammalecte (gn, conj, typo…), « spell » pour un mot inconnu */
    type: string;
    message: string;
    suggestions: string[];
    url?: string;
}

/**
 * - orthographe, grammaire, typographie : comptent dans la note (avec une marge) ;
 * - style : conseils, jamais comptés (le style de chacun est respecté) ;
 * - nom : mot inconnu avec une majuscule (nom propre, marque) : à ajouter au dictionnaire, pas compté.
 */
export type LangCategory = "orthographe" | "grammaire" | "typographie" | "style" | "nom";

export const CATEGORY_LABELS: Record<LangCategory, string> = {
    orthographe: "Orthographe",
    grammaire: "Grammaire",
    typographie: "Typographie",
    style: "Conseils de style",
    nom: "Noms propres",
};

export interface LangIssue extends RawIssue {
    category: LangCategory;
    /** Passage souligné */
    text: string;
    /** Clé d'« Ignorer » : même règle, même passage, partout dans l'article */
    key: string;
    /** Répétition : on propose des synonymes */
    repetition: boolean;
}

const GRAMMAR = new Set(["gn", "conj", "infi", "ppas", "imp", "inte", "vmode", "conf", "loc"]);
const TYPO = new Set(["typo", "apos", "esp", "nbsp", "tu", "maj", "minis", "num", "unit", "nf", "chim", "date"]);

/**
 * Règles souples de Workyt : un article de blog n'est pas une dissertation.
 * Affichées dans l'onglet Langue pour que chacun sache ce qui est accepté.
 */
export const SOFT_RULES: { title: string; text: string }[] = [
    { title: "Le ton oral", text: "« C'est pas », « du coup », « t'as », phrases sans verbe, « Et » ou « Mais » en début de phrase : c'est le style du blog, rien n'est signalé." },
    { title: "Les conseils de style", text: "Répétitions, pléonasmes, « malgré que », virgule avant « mais » : soulignés en pointillés, à toi de voir. Ils ne comptent jamais dans la note." },
    { title: "L'écriture inclusive", text: "Au choix du rédacteur : signalée comme un conseil, jamais comme une faute." },
    { title: "Les mots du web et de l'école", text: "Anglicismes, noms d'applis, sigles, jargon scolaire : ajoute-les au dictionnaire Workyt, ils ne seront plus signalés pour personne." },
    { title: "Les noms propres", text: "Un mot inconnu avec une majuscule (nom, marque) est signalé à part et ne compte pas dans la note." },
    { title: "Apostrophes et espaces insécables", text: "Pas soulignées une par une : « Corriger la typographie » les règle en un clic." },
    { title: "Une marge d'erreur", text: "Une faute de temps en temps ne fait pas chuter la note : il faut en moyenne plus d'une faute pour 500 mots pour perdre des points." },
];

/* ─── Texte des paragraphes ─── */

/** Blocs dont le texte est vérifié (dans les listes, encadrés, citations et tableaux compris) */
export const TEXT_BLOCKS = new Set(["paragraph", "heading"]);
/** Blocs jamais vérifiés */
export const SKIP_BLOCKS = new Set(["codeBlock", "blockMath"]);

/**
 * Texte d'un élément en ligne pour le moteur. `exact` : chaque caractère est
 * celui du document (on peut souligner et corriger). Code et formules
 * deviennent « 1 », neutre pour la grammaire ; un texte barré par le
 * correcteur (suppression suggérée) n'existe plus.
 */
export function inlinePiece(type: string, text: string | undefined, marks: string[]): { text: string; exact: boolean } | null {
    if (type === "text") {
        if (marks.includes("suggestionDelete")) return null;
        if (marks.includes("code")) return { text: "1", exact: false };
        return { text: text ?? "", exact: true };
    }
    if (type === "hardBreak") return { text: " ", exact: false };
    if (type === "inlineMath") return { text: "1", exact: false };
    return null;
}

export interface LangBlock {
    /** Bloc de premier niveau (« Voir » de l'assistant SEO) */
    index: number;
    text: string;
}

/** Paragraphes et titres d'un document enregistré (côté serveur) */
export function jsonBlocks(doc: JSONContent | null | undefined): LangBlock[] {
    const out: LangBlock[] = [];
    (doc?.content ?? []).forEach((top, index) => {
        const walk = (n: JSONContent) => {
            if (SKIP_BLOCKS.has(n.type ?? "")) return;
            if (TEXT_BLOCKS.has(n.type ?? "")) {
                let text = "";
                for (const c of n.content ?? []) {
                    const piece = inlinePiece(c.type ?? "", c.text, (c.marks ?? []).map((m) => m.type));
                    if (piece) text += piece.text;
                }
                if (text.trim()) out.push({ index, text });
                return;
            }
            n.content?.forEach(walk);
        };
        walk(top);
    });
    return out;
}

/* ─── Classement ─── */

/** Forme d'un mot dans le dictionnaire Workyt : minuscules, apostrophe droite */
export const dictKey = (word: string) => word.normalize("NFC").trim().toLowerCase().replace(/[’`]/g, "'");

/** Le passage commence-t-il une phrase ? (début du paragraphe, après . ! ? … ou un guillemet ouvrant) */
function sentenceStart(text: string, start: number): boolean {
    const before = text.slice(0, start).trimEnd();
    return !before || /[.!?…:«"“(\-–—•]$/.test(before);
}

export interface LangContext {
    /** Mots du dictionnaire Workyt (clés dictKey) */
    dictionary: Set<string>;
    /** Fautes ignorées dans l'article (clés LangIssue.key) */
    ignores: Set<string>;
}

/** Une faute du moteur, classée pour Workyt ; null si elle est acceptée (dictionnaire, ignorée) */
export function classify(raw: RawIssue, blockText: string, ctx: LangContext): LangIssue | null {
    const text = blockText.slice(raw.start, raw.end);
    if (!text.trim()) return null;
    const key = `${raw.rule}|${text}`;
    if (ctx.ignores.has(key)) return null;
    let category: LangCategory;
    if (raw.rule === "spell") {
        if (ctx.dictionary.has(dictKey(text))) return null;
        // Mot inconnu avec une majuscule (hors début de phrase), ou majuscule au milieu (« YouTube ») : un nom propre
        const capital = /^\p{Lu}/u.test(text);
        const inner = /^.\p{Ll}*\p{Lu}/u.test(text);
        category = capital && (inner || !sentenceStart(blockText, raw.start)) ? "nom" : "orthographe";
    } else if (raw.rule.startsWith("eepi") || raw.rule.startsWith("redondances")) category = "style";
    else if (GRAMMAR.has(raw.type)) category = "grammaire";
    else if (TYPO.has(raw.type)) category = "typographie";
    else category = "style";
    return { ...raw, category, text, key, repetition: raw.rule.startsWith("redondances") };
}

/** Les fautes d'un paragraphe, classées et filtrées, dans l'ordre du texte (une seule par passage) */
export function classifyBlock(raws: RawIssue[], blockText: string, ctx: LangContext): LangIssue[] {
    const seen = new Set<string>();
    return raws
        .map((r) => classify(r, blockText, ctx))
        .filter((i): i is LangIssue => {
            if (!i) return false;
            const span = `${i.start}:${i.end}:${i.category}`;
            if (seen.has(span)) return false;
            seen.add(span);
            return true;
        })
        .sort((a, b) => a.start - b.start);
}

export interface LangCounts {
    orthographe: number;
    grammaire: number;
    typographie: number;
    style: number;
    nom: number;
}

export function countIssues(issues: Pick<LangIssue, "category">[]): LangCounts {
    const c: LangCounts = { orthographe: 0, grammaire: 0, typographie: 0, style: 0, nom: 0 };
    for (const i of issues) c[i.category]++;
    return c;
}

/** Décompte d'un document (côté serveur) à partir des résultats du moteur, bloc par bloc */
export function documentCounts(blocks: LangBlock[], results: RawIssue[][], ctx: LangContext): LangCounts {
    return countIssues(blocks.flatMap((b, i) => classifyBlock(results[i] ?? [], b.text, ctx)));
}

/**
 * Marge tolérée avant de perdre des points : une faute pour 500 mots
 * (au moins une), deux fois plus en typographie.
 */
export const tolerance = (words: number, perWords = 500) => Math.max(1, Math.ceil(words / perWords));

/** Part des points gardée selon le nombre de fautes et la marge */
export function languageRatio(n: number, tol: number): number {
    if (n === 0) return 1;
    if (n <= tol) return 0.8;
    if (n <= tol * 3) return 0.5;
    if (n <= tol * 6) return 0.2;
    return 0;
}

/** Mots du dictionnaire Workyt de départ (le reste s'ajoute depuis l'éditeur) */
export const DEFAULT_WORDS = [
    "Workyt",
    "Workytien",
    "Workytiens",
    "Workytienne",
    "Workytiennes",
    "Parcoursup",
    "Pronote",
    "EcoleDirecte",
    "Moodle",
    "Discord",
    "YouTube",
    "TikTok",
    "Instagram",
    "LinkedIn",
    "WhatsApp",
    "Snapchat",
    "ChatGPT",
    "Canva",
    "Notion",
    "Anki",
    "Quizlet",
    "Duolingo",
    "Erasmus",
    "Pix",
    "e-mail",
    "e-mails",
    "email",
    "emails",
    "mail",
    "mails",
    "spoiler",
    "spoilers",
    "tips",
    "check-list",
    "checklist",
    "flashcard",
    "flashcards",
    "post-bac",
    "khôlle",
    "khôlles",
    "kholle",
    "kholles",
    "prépa",
    "prépas",
    "bachelier",
    "bachelière",
    "lycéen",
    "lycéenne",
    "lycéens",
    "lycéennes",
    "alternant",
    "alternante",
    "alternants",
    "alternantes",
    "replay",
    "podcast",
    "podcasts",
    "streameur",
    "streameuse",
    "youtubeur",
    "youtubeuse",
    "youtubeurs",
    "youtubeuses",
    "influenceur",
    "influenceuse",
];
