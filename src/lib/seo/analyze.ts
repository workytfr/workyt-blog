import type { JSONContent } from "@tiptap/core";
import type { ArticleModule } from "../modules/types";
import { moduleIssues } from "../modules/sanitize";

/**
 * Assistant SEO (cahier des charges § 10.3) : note sur 100, comme Rank Math.
 * Cinq groupes : mot-clé principal (35), titre et description (15), contenu
 * (20), liens (15), lisibilité (15). Chaque critère est vert, orange ou
 * rouge, avec une phrase d'explication et, si possible, le passage concerné.
 *
 * Fonction pure, partagée : l'éditeur la recalcule en direct, le serveur
 * l'enregistre avec l'article (filtre « score < 60 » du dashboard).
 */

export interface SeoInput {
    title: string;
    seoTitle: string;
    seoDescription: string;
    excerpt: string;
    slug: string;
    /** Mot-clé principal puis jusqu'à 4 secondaires */
    keywords: string[];
    doc: JSONContent | null;
    featuredImage: { alt: string } | null;
    modules: ArticleModule[];
    /** Le mot-clé principal est déjà celui d'un autre article (null : pas encore vérifié) */
    keywordTaken?: boolean | null;
    /** Liens affiliés connus pour être cassés */
    deadLinks?: string[];
    /** Adresses du blog et de workyt.fr (liens internes) */
    siteHosts?: string[];
}

export type CheckStatus = "good" | "ok" | "bad";
/** Où regarder : un champ, ou un bloc du texte (index du bloc de premier niveau) */
export type SeoTarget = { field: "seoTitle" | "seoDescription" | "slug" | "keywords" | "featured" } | { block: number };

export interface SeoCheck {
    id: string;
    label: string;
    status: CheckStatus;
    message: string;
    points: number;
    max: number;
    target?: SeoTarget;
}

export interface SeoGroup {
    id: "keyword" | "meta" | "content" | "links" | "readability";
    label: string;
    max: number;
    points: number;
    checks: SeoCheck[];
}

export interface SeoReport {
    score: number;
    groups: SeoGroup[];
    words: number;
    /** Mots-clés secondaires trouvés ou non dans le texte (indicatif, sans points) */
    secondary: { keyword: string; found: boolean }[];
}

/* ─── Texte ─── */

/** Minuscules, sans accents ni ponctuation : « Réviser l'été ! » → « reviser l ete » */
export function normalize(s: string): string {
    return s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[’']/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

/** Le mot-clé (plusieurs mots possibles) apparaît-il, en mots entiers ? */
export function containsKeyword(text: string, keyword: string): boolean {
    const k = normalize(keyword);
    if (!k) return false;
    return ` ${normalize(text)} `.includes(` ${k} `);
}

function countKeyword(text: string, keyword: string): number {
    const k = normalize(keyword);
    if (!k) return 0;
    const hay = ` ${normalize(text)} `;
    let n = 0;
    let i = hay.indexOf(` ${k} `);
    while (i >= 0) {
        n++;
        i = hay.indexOf(` ${k} `, i + k.length + 1);
    }
    return n;
}

const wordsOf = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));

interface Block {
    index: number;
    type: string;
    level?: number;
    text: string;
}

function inlineText(n: JSONContent): string {
    if (n.text) return n.marks?.some((m) => m.type === "suggestionDelete") ? "" : n.text;
    if (n.type === "hardBreak") return " ";
    return (n.content ?? []).map(inlineText).join("");
}

/** Blocs de texte (paragraphes, titres…), images, liens d'un document */
function extract(doc: JSONContent | null) {
    const blocks: Block[] = [];
    const images: { alt: string; block: number }[] = [];
    const links: { href: string; block: number }[] = [];
    (doc?.content ?? []).forEach((top, index) => {
        const walk = (n: JSONContent) => {
            if (n.type === "image") images.push({ alt: String(n.attrs?.alt ?? ""), block: index });
            for (const m of n.marks ?? []) if (m.type === "link" && m.attrs?.href) links.push({ href: String(m.attrs.href), block: index });
            if (n.type === "paragraph" || n.type === "heading") {
                const text = inlineText(n).trim();
                if (text) blocks.push({ index, type: n.type, level: n.attrs?.level as number | undefined, text });
            }
            n.content?.forEach(walk);
        };
        walk(top);
    });
    return { blocks, images, links };
}

/** Phrases d'un texte (point, point d'exclamation ou d'interrogation, points de suspension) */
export function sentencesOf(text: string): string[] {
    return text
        .split(/(?<=[.!?…])\s+(?=[A-ZÀ-Ý0-9«"(])/u)
        .map((s) => s.trim())
        .filter((s) => wordsOf(s).length > 0);
}

/** Syllabes d'un mot français (approximation : groupes de voyelles, « e » muet final) */
export function syllables(word: string): number {
    const w = word.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüÿœæ]/g, "");
    if (!w) return 0;
    const groups = w.match(/[aeiouyàâäéèêëîïôöùûüÿœæ]+/g)?.length ?? 1;
    const muet = /[^aeiouy]es?$|[^aeiouy]ent$/.test(w) && groups > 1 ? 1 : 0;
    return Math.max(1, groups - muet);
}

/** Lisibilité de Kandel et Moles (Flesch adapté au français) : 0 (difficile) à 100 (très facile) */
export function readingEase(sentences: string[]): number {
    const words = sentences.flatMap(wordsOf);
    if (!words.length || !sentences.length) return 100;
    const syl = words.reduce((s, w) => s + syllables(w), 0);
    return Math.round(207 - 1.015 * (words.length / sentences.length) - 73.6 * (syl / words.length));
}

/** Voix passive (approximation) : être conjugué + participe passé */
const PASSIVE = /\b(est|sont|était|étaient|sera|seront|serait|seraient|fut|furent|été|être)\s+(\p{L}+(é|ée|és|ées|i|ie|is|ies|u|ue|us|ues|it|ite|its|ites|t|te|ts|tes))\b/iu;
const TRANSITIONS = [
    "d'abord",
    "ensuite",
    "puis",
    "enfin",
    "finalement",
    "en effet",
    "car",
    "parce que",
    "donc",
    "ainsi",
    "alors",
    "c'est pourquoi",
    "par conséquent",
    "cependant",
    "pourtant",
    "toutefois",
    "néanmoins",
    "mais",
    "en revanche",
    "au contraire",
    "par ailleurs",
    "de plus",
    "en outre",
    "également",
    "aussi",
    "par exemple",
    "notamment",
    "en particulier",
    "c'est-à-dire",
    "autrement dit",
    "en résumé",
    "bref",
    "pour conclure",
    "en conclusion",
    "premièrement",
    "deuxièmement",
    "d'une part",
    "d'autre part",
    "en fait",
    "certes",
    "même si",
    "bien que",
    "tandis que",
    "alors que",
    "du coup",
    "en bref",
];
const hasTransition = (s: string) => {
    const t = ` ${s.toLowerCase().replace(/[’]/g, "'")} `;
    return TRANSITIONS.some((w) => t.includes(` ${w} `) || t.includes(` ${w},`) || t.startsWith(` ${w}`));
};

/* ─── Notation ─── */

function check(id: string, label: string, max: number, ratio: number, message: string, target?: SeoTarget): SeoCheck {
    const points = Math.round(max * Math.max(0, Math.min(1, ratio)) * 10) / 10;
    return { id, label, max, points, status: ratio >= 0.999 ? "good" : ratio > 0 ? "ok" : "bad", message, target };
}

const group = (id: SeoGroup["id"], label: string, max: number, checks: SeoCheck[]): SeoGroup => ({ id, label, max, checks, points: Math.round(checks.reduce((s, c) => s + c.points, 0) * 10) / 10 });

export function analyzeSeo(input: SeoInput): SeoReport {
    const { blocks, images, links } = extract(input.doc);
    const paragraphs = blocks.filter((b) => b.type === "paragraph");
    const headings = blocks.filter((b) => b.type === "heading");
    const body = blocks.map((b) => b.text).join("\n");
    const words = wordsOf(body).length;
    const kw = input.keywords.map((k) => k.trim()).filter(Boolean);
    const main = kw[0] ?? "";
    const seoTitle = input.seoTitle || input.title;
    const description = input.seoDescription || input.excerpt;
    const allImages = [...(input.featuredImage ? [{ alt: input.featuredImage.alt, block: -1 }] : []), ...images];

    /* Mot-clé principal (35) */
    const noKw = (id: string, label: string, max: number): SeoCheck => check(id, label, max, 0, "Choisis d'abord un mot-clé principal (onglet SEO).", { field: "keywords" });
    let keyword: SeoCheck[];
    if (!main) {
        keyword = [
            noKw("kw-title", "Dans le titre SEO", 6),
            noKw("kw-start", "En début de titre", 3),
            noKw("kw-slug", "Dans l'adresse", 4),
            noKw("kw-desc", "Dans la description", 4),
            noKw("kw-intro", "Dans l'introduction", 5),
            noKw("kw-heading", "Dans un sous-titre", 4),
            noKw("kw-alt", "Dans un texte alternatif", 3),
            noKw("kw-density", "Densité", 4),
            noKw("kw-unique", "Mot-clé unique", 2),
        ];
    } else {
        const inTitle = containsKeyword(seoTitle, main);
        const startPos = normalize(seoTitle).indexOf(normalize(main));
        const intro = paragraphs[0];
        const introText = paragraphs
            .slice(0, 2)
            .map((p) => p.text)
            .join(" ");
        const inHeading = headings.find((h) => (h.level ?? 2) <= 3 && containsKeyword(h.text, main));
        const inAlt = allImages.some((i) => containsKeyword(i.alt, main));
        const count = countKeyword(body, main);
        const density = words ? (count * wordsOf(main).length * 100) / words : 0;
        // Sur un texte court, la densité ne veut rien dire : on la mesure à partir de 300 mots
        const shortText = words < 300;
        const densityRatio = shortText ? (count ? 0.5 : 0) : density >= 0.5 && density <= 2.5 ? 1 : density > 0 ? 0.5 : 0;
        const slugOk = containsKeyword(input.slug.replace(/-/g, " "), main);
        keyword = [
            check("kw-title", "Dans le titre SEO", 6, inTitle ? 1 : 0, inTitle ? `« ${main} » est dans le titre.` : `Ajoute « ${main} » au titre (ou au titre SEO).`, { field: "seoTitle" }),
            check(
                "kw-start",
                "En début de titre",
                3,
                inTitle && startPos >= 0 && startPos <= normalize(seoTitle).length * 0.4 ? 1 : inTitle ? 0.5 : 0,
                inTitle && startPos <= normalize(seoTitle).length * 0.4 ? "Le mot-clé arrive tôt dans le titre." : "Place le mot-clé au début du titre : Google lui donne plus de poids.",
                { field: "seoTitle" },
            ),
            check("kw-slug", "Dans l'adresse", 4, slugOk ? 1 : 0, slugOk ? "L'adresse contient le mot-clé." : "Mets le mot-clé dans l'adresse de l'article (avant la publication).", { field: "slug" }),
            check(
                "kw-desc",
                "Dans la description",
                4,
                containsKeyword(description, main) ? 1 : 0,
                containsKeyword(description, main) ? "La description contient le mot-clé." : "Ajoute le mot-clé dans la description SEO (ou l'extrait).",
                { field: "seoDescription" },
            ),
            check(
                "kw-intro",
                "Dans l'introduction",
                5,
                containsKeyword(introText, main) ? 1 : 0,
                containsKeyword(introText, main) ? "Le mot-clé apparaît dès l'introduction." : "Cite le mot-clé dans le premier paragraphe.",
                intro ? { block: intro.index } : undefined,
            ),
            check(
                "kw-heading",
                "Dans un sous-titre",
                4,
                inHeading ? 1 : 0,
                inHeading ? "Un sous-titre reprend le mot-clé." : headings.length ? "Reprends le mot-clé dans au moins un sous-titre (H2 ou H3)." : "Ajoute des sous-titres, dont un avec le mot-clé.",
                inHeading ? { block: inHeading.index } : headings[0] ? { block: headings[0].index } : undefined,
            ),
            check(
                "kw-alt",
                "Dans un texte alternatif",
                3,
                inAlt ? 1 : 0,
                inAlt ? "Une image décrit le mot-clé." : allImages.length ? "Utilise le mot-clé dans la description (alt) d'une image." : "Ajoute une image décrite avec le mot-clé.",
                { field: "featured" },
            ),
            check(
                "kw-density",
                "Densité",
                4,
                densityRatio,
                count === 0
                    ? "Le mot-clé n'apparaît pas dans le texte."
                    : shortText
                      ? `${count} fois. La densité se mesure à partir de 300 mots (idéal : 0,5 à 2,5 %).`
                      : `${count} fois, soit ${density.toFixed(1).replace(".", ",")} % du texte ${density < 0.5 ? ": un peu plus (entre 0,5 et 2,5 %)" : density > 2.5 ? ": trop, ça sonne forcé (0,5 à 2,5 %)" : "(idéal : 0,5 à 2,5 %)"}.`,
            ),
            check(
                "kw-unique",
                "Mot-clé unique",
                2,
                input.keywordTaken === false ? 1 : input.keywordTaken === true ? 0 : 0.5,
                input.keywordTaken === true
                    ? "Un autre article vise déjà ce mot-clé : ils vont se concurrencer dans Google."
                    : input.keywordTaken === false
                      ? "Aucun autre article ne vise ce mot-clé."
                      : "Vérification en cours…",
                { field: "keywords" },
            ),
        ];
    }

    /* Titre et description (15) */
    const tl = seoTitle.trim().length;
    const dl = description.trim().length;
    const meta = [
        check(
            "title-length",
            "Longueur du titre",
            8,
            tl >= 40 && tl <= 60 ? 1 : tl >= 30 && tl <= 70 ? 0.5 : 0,
            `${tl} caractères ${tl < 40 ? ": un peu court (40 à 60)" : tl > 60 ? ": Google le coupera (40 à 60)" : "(idéal : 40 à 60)"}.`,
            { field: "seoTitle" },
        ),
        check(
            "desc-length",
            "Longueur de la description",
            7,
            dl >= 120 && dl <= 160 ? 1 : dl >= 80 && dl <= 180 ? 0.5 : 0,
            dl === 0
                ? "Écris une description (ou un extrait) : c'est le texte sous le titre dans Google."
                : `${dl} caractères ${dl < 120 ? ": un peu court (120 à 160)" : dl > 160 ? ": Google la coupera (120 à 160)" : "(idéal : 120 à 160)"}.`,
            { field: "seoDescription" },
        ),
    ];

    /* Contenu (20) */
    const longest = paragraphs.reduce<Block | null>((m, p) => (!m || wordsOf(p.text).length > wordsOf(m.text).length ? p : m), null);
    const longWords = longest ? wordsOf(longest.text).length : 0;
    // Sous-titres : le plus long passage sans sous-titre
    let run = 0;
    let maxRun = 0;
    let runStart: Block | null = null;
    let worstStart: Block | null = null;
    for (const b of blocks) {
        if (b.type === "heading") {
            run = 0;
            runStart = null;
        } else {
            runStart ??= b;
            run += wordsOf(b.text).length;
            if (run > maxRun) {
                maxRun = run;
                worstStart = runStart;
            }
        }
    }
    const missingAlt = allImages.filter((i) => !i.alt.trim());
    const modIssues = moduleIssues(input.modules).submit.length;
    const content = [
        check(
            "length",
            "Longueur",
            6,
            words >= 600 ? 1 : words >= 300 ? 0.6 : words >= 150 ? 0.3 : 0,
            `${words} mots ${words >= 600 ? "(au moins 600 : parfait)" : words >= 300 ? ": correct pour une brève, vise 600 pour un article" : ": trop court, vise au moins 600 mots"}.`,
        ),
        check(
            "headings",
            "Sous-titres réguliers",
            4,
            words < 300 ? (headings.length ? 1 : 0.5) : maxRun <= 300 ? 1 : maxRun <= 450 ? 0.5 : 0,
            maxRun <= 300 ? "Un sous-titre au moins tous les 300 mots : facile à parcourir." : `Un passage de ${maxRun} mots sans sous-titre : coupe-le.`,
            worstStart ? { block: worstStart.index } : undefined,
        ),
        check(
            "paragraphs",
            "Paragraphes courts",
            3,
            longWords <= 150 ? 1 : longWords <= 200 ? 0.5 : 0,
            longWords <= 150 ? "Les paragraphes sont courts." : `Un paragraphe de ${longWords} mots : coupe-le en deux.`,
            longest && longWords > 150 ? { block: longest.index } : undefined,
        ),
        check("image", "Au moins une image", 2, allImages.length ? 1 : 0, allImages.length ? `${allImages.length} image${allImages.length > 1 ? "s" : ""}.` : "Ajoute une image à la une ou dans le texte.", {
            field: "featured",
        }),
        check(
            "alt",
            "Images décrites",
            3,
            !allImages.length ? 0 : missingAlt.length ? 0.3 : 1,
            !allImages.length ? "Pas encore d'image." : missingAlt.length ? `${missingAlt.length} image${missingAlt.length > 1 ? "s" : ""} sans texte alternatif.` : "Toutes les images ont un texte alternatif.",
            missingAlt[0] && missingAlt[0].block >= 0 ? { block: missingAlt[0].block } : { field: "featured" },
        ),
        check(
            "modules",
            "Modules complets",
            2,
            modIssues ? 0 : 1,
            modIssues ? `${modIssues} point${modIssues > 1 ? "s" : ""} à compléter dans les modules (onglet Modules).` : input.modules.length ? "Modules complets." : "Pas de module : rien à compléter.",
        ),
    ];

    /* Liens (15) */
    const hosts = input.siteHosts ?? ["workyt.fr", "blog.workyt.fr"];
    const isInternal = (h: string) =>
        h.startsWith("/")
            ? !h.startsWith("/go/")
            : (() => {
                  try {
                      const host = new URL(h).hostname.replace(/^www\./, "");
                      return hosts.some((x) => host === x || host.endsWith(`.${x}`));
                  } catch {
                      return false;
                  }
              })();
    const internal = links.filter((l) => isInternal(l.href));
    const external = links.filter((l) => /^https?:\/\//.test(l.href) && !isInternal(l.href));
    const broken = links.filter((l) => (input.deadLinks ?? []).includes(l.href) || !/^(https?:\/\/|\/|#|mailto:)/.test(l.href));
    const linkChecks = [
        check(
            "internal",
            "Liens internes",
            6,
            internal.length >= 2 ? 1 : internal.length === 1 ? 0.5 : 0,
            internal.length >= 2 ? `${internal.length} liens vers le blog ou workyt.fr.` : `Fais au moins 2 liens vers d'autres articles ou vers workyt.fr (cours, fiches) : ${internal.length} pour l'instant.`,
        ),
        check(
            "external",
            "Lien externe",
            5,
            external.length ? 1 : 0,
            external.length ? `${external.length} lien${external.length > 1 ? "s" : ""} vers une source extérieure.` : "Ajoute au moins un lien vers une source fiable (site officiel, étude…).",
        ),
        check(
            "broken",
            "Liens valides",
            4,
            broken.length ? 0 : 1,
            broken.length ? `${broken.length} lien${broken.length > 1 ? "s" : ""} cassé${broken.length > 1 ? "s" : ""} ou mal écrit${broken.length > 1 ? "s" : ""}.` : "Aucun lien cassé connu.",
            broken[0] ? { block: broken[0].block } : undefined,
        ),
    ];

    /* Lisibilité (15) */
    const sentences = paragraphs.flatMap((p) => sentencesOf(p.text));
    const avg = sentences.length ? sentences.reduce((s, x) => s + wordsOf(x).length, 0) / sentences.length : 0;
    const passive = sentences.filter((s) => PASSIVE.test(s)).length;
    const passiveRate = sentences.length ? passive / sentences.length : 0;
    const transitions = sentences.filter(hasTransition).length;
    const transitionRate = sentences.length ? transitions / sentences.length : 0;
    const ease = readingEase(sentences);
    const empty = sentences.length < 3;
    const readability = [
        check(
            "sentences",
            "Phrases courtes",
            5,
            empty ? 0 : avg <= 20 ? 1 : avg <= 25 ? 0.5 : 0,
            empty ? "Pas encore assez de texte." : `${avg.toFixed(0)} mots par phrase en moyenne ${avg <= 20 ? "(moins de 20 : parfait)" : ": coupe les phrases les plus longues"}.`,
        ),
        check(
            "passive",
            "Voix passive limitée",
            3,
            empty ? 0 : passiveRate <= 0.1 ? 1 : passiveRate <= 0.2 ? 0.5 : 0,
            empty
                ? "Pas encore assez de texte."
                : `${Math.round(passiveRate * 100)} % de phrases au passif ${passiveRate <= 0.1 ? "(10 % au plus : parfait)" : ": préfère « le prof corrige » à « la copie est corrigée »"}.`,
        ),
        check(
            "transitions",
            "Mots de liaison",
            3,
            empty ? 0 : transitionRate >= 0.25 ? 1 : transitionRate >= 0.1 ? 0.5 : 0,
            empty
                ? "Pas encore assez de texte."
                : `${Math.round(transitionRate * 100)} % de phrases avec un mot de liaison (d'abord, ensuite, par exemple, donc…) ${transitionRate >= 0.25 ? ": le texte s'enchaîne bien" : ": vise au moins 25 %"}.`,
        ),
        check(
            "ease",
            "Facile à lire",
            4,
            empty ? 0 : ease >= 60 ? 1 : ease >= 45 ? 0.5 : 0,
            empty ? "Pas encore assez de texte." : `Indice de lisibilité ${ease}/100 ${ease >= 60 ? ": facile à lire pour un collégien ou un lycéen" : ": mots ou phrases un peu longs pour des élèves"}.`,
        ),
    ];

    const groups = [
        group("keyword", "Mot-clé principal", 35, keyword),
        group("meta", "Titre et description", 15, meta),
        group("content", "Contenu", 20, content),
        group("links", "Liens", 15, linkChecks),
        group("readability", "Lisibilité", 15, readability),
    ];
    return {
        score: Math.round(groups.reduce((s, g) => s + g.points, 0)),
        groups,
        words,
        secondary: kw.slice(1).map((k) => ({ keyword: k, found: containsKeyword(`${seoTitle} ${body}`, k) })),
    };
}

/** Couleur d'une note (même code que Rank Math : ≥ 80 vert, ≥ 50 orange, sinon rouge) */
export const scoreTone = (score: number) => (score >= 80 ? "#3f8a1f" : score >= 50 ? "#e08a00" : "#d92d20");
