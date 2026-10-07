import sanitizeHtml from "sanitize-html";
import katex from "katex";
import { addLinkIcons } from "./linkIcon";

/**
 * HTML d'un article, assaini avant affichage : ni le contenu repris de
 * WordPress ni celui de l'éditeur n'est affiché tel quel (pas de script, pas
 * d'attribut d'événement). Les intégrations vidéo ne sont autorisées que
 * depuis les hôtes connus. Les formules LaTeX sont calculées ici (KaTeX).
 */
const EMBED_HOSTS = ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "www.dailymotion.com", "open.spotify.com"];

const SANITIZE: sanitizeHtml.IOptions = {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "figure", "figcaption", "iframe", "video", "source", "aside", "input", "label", "mark", "del", "ins", "sup"],
    allowedAttributes: {
        a: ["href", "title", "target", "rel", "id"],
        img: ["src", "alt", "width", "height", "loading", "decoding"],
        iframe: ["src", "title", "allow", "allowfullscreen", "loading", "width", "height"],
        video: ["src", "controls", "poster", "preload"],
        source: ["src", "type"],
        figure: ["class", "data-media-id"],
        div: ["class", "data-type", "data-latex", "data-youtube-video", "data-module", "data-embed", "data-src"],
        sup: ["class", "data-source"],
        span: ["class", "data-type", "data-latex", "data-author", "data-source", "data-license", "data-url"],
        aside: ["class", "data-variant"],
        ul: ["data-type"],
        // Numéro de départ : une liste coupée en plusieurs morceaux (1, puis 2, puis 3) continue sa numérotation
        ol: ["start", "reversed"],
        li: ["data-type", "data-checked"],
        input: ["type", "checked"],
        pre: ["class"],
        code: ["class"],
        p: ["style"],
        h2: ["style", "id"],
        h3: ["style", "id"],
        h4: ["style", "id"],
        th: ["colspan", "rowspan", "scope"],
        td: ["colspan", "rowspan"],
        "*": ["id"],
    },
    allowedClasses: {
        figure: ["wk-figure"],
        div: ["wk-figure-media", "wk-video", "wk-module-slot", "wk-embed"],
        sup: ["wk-cite"],
        span: ["credit", "credit-lic", "wk-h"],
        aside: ["wk-callout", "wk-callout--*"],
        pre: ["wk-code"],
        code: ["language-*"],
    },
    // Alignement du texte (éditeur) : seule propriété de style permise
    allowedStyles: { "*": { "text-align": [/^(left|right|center|justify)$/] } },
    allowedSchemes: ["http", "https", "mailto"],
    allowedIframeHostnames: EMBED_HOSTS,
    transformTags: {
        // Liens sortants : nouvel onglet, sans transmettre l'origine
        a: (tagName, attribs) => {
            const href = attribs.href || "";
            // Lien affilié géré : obligatoirement « sponsored » (Google), nouvel onglet
            if (/^\/go\/[a-z0-9-]+\/?$/.test(href)) return { tagName, attribs: { ...attribs, target: "_blank", rel: "sponsored nofollow noopener" } };
            const external = /^https?:\/\//i.test(href) && !/^https?:\/\/(blog\.)?workyt\.fr/i.test(href);
            const rel = new Set((attribs.rel || "").split(/\s+/).filter(Boolean));
            if (external) {
                rel.add("noopener");
                rel.add("noreferrer");
            }
            return { tagName, attribs: { ...attribs, ...(external ? { target: "_blank", rel: [...rel].join(" ") } : {}) } };
        },
        img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy", decoding: "async" } }),
        iframe: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
        // Cases à cocher des listes de tâches : affichées, jamais modifiables
        input: (tagName, attribs) => ({ tagName, attribs: attribs.type === "checkbox" ? { type: "checkbox", disabled: "", ...(attribs.checked !== undefined ? { checked: "" } : {}) } : {} }),
    },
    exclusiveFilter: (frame) => frame.tag === "input" && frame.attribs.type !== "checkbox",
};

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Remplace les nœuds de formule de l'éditeur par leur rendu KaTeX */
function renderMath(html: string): string {
    const tex = (latex: string, displayMode: boolean) => katex.renderToString(decode(latex), { displayMode, throwOnError: false, output: "htmlAndMathml" });
    // L'ordre des attributs n'est pas garanti : on lit data-latex dans la balise trouvée
    const latexOf = (tag: string) => tag.match(/data-latex="([^"]*)"/)?.[1] ?? "";
    return html
        .replace(/<span\b[^>]*data-type="inline-math"[^>]*><\/span>/g, (tag) => tex(latexOf(tag), false))
        .replace(/<div\b[^>]*data-type="block-math"[^>]*><\/div>/g, (tag) => tex(latexOf(tag), true));
}

type RenderOptions = { linkIcons?: boolean; sourceIds?: string[]; affiliates?: Record<string, string> };

export function renderPostHtml(html: string, opts: RenderOptions = {}): string {
    return render(html, opts).html;
}

/** Page d'article : le HTML avec la carte « Au sommaire » avant le premier titre, et la liste des parties (sommaire de la colonne) */
export function renderArticle(html: string, opts: RenderOptions = {}): { html: string; toc: TocItem[] } {
    const { html: out, toc } = render(html, opts);
    return { html: showToc(toc) ? withTocCard(out, toc) : out, toc: showToc(toc) ? toc : [] };
}

function render(html: string, opts: RenderOptions): { html: string; toc: TocItem[] } {
    const clean = sanitizeHtml(html || "", SANITIZE);
    const { html: anchored, toc } = anchorHeadings(clean);
    // Logo du site à droite des liens : sur le blog seulement (pas dans le flux RSS, où les adresses relatives casseraient)
    const withIcons = wrapTables(wrapQuotes(wrapHeadings(opts.linkIcons ? addLinkIcons(anchored, opts.affiliates) : anchored)));
    // Lettrine sur le premier paragraphe du texte (pas celui d'une citation, d'un encadré, d'une liste…)
    return { html: withLead(renderCitations(renderMath(withIcons), opts.sourceIds ?? [])), toc };
}

/* ─── Sommaire ─── */

/** Une partie de l'article : titre H2 (numéroté comme à l'affichage) ou H3 */
export interface TocItem {
    id: string;
    text: string;
    level: 2 | 3;
    /** Numéro du H2 (celui du H3 : son H2 parent) */
    n: number;
}

/** Sommaire affiché à partir de 3 titres */
const showToc = (toc: TocItem[]) => toc.length >= 3;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decodeEntities = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m)));
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** « Les fiches qui marchent ! » → « les-fiches-qui-marchent » */
function anchorSlug(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/œ/gi, "oe")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
}

/**
 * Ancre sur chaque H2 et H3 (pour le sommaire et les liens directs vers une
 * partie). Une ancre déjà présente est gardée : les liens vers les sommaires
 * des articles WordPress continuent de marcher.
 */
function anchorHeadings(html: string): { html: string; toc: TocItem[] } {
    const used = new Set(["sommaire", "commentaires", "sources"]);
    const toc: TocItem[] = [];
    let n = 0;
    const out = html.replace(/<h([23])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/g, (whole, lvl: string, attrs: string, inner: string) => {
        const text = decodeEntities(inner.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
        if (!text) return whole;
        const base = attrs.match(/\sid="([^"]+)"/)?.[1] || anchorSlug(text) || "partie";
        let id = base;
        for (let k = 2; used.has(id); k++) id = `${base}-${k}`;
        used.add(id);
        if (lvl === "2") n++;
        toc.push({ id, text, level: lvl === "2" ? 2 : 3, n });
        return `<h${lvl} id="${id}"${attrs.replace(/\sid="[^"]*"/, "")}>${inner}</h${lvl}>`;
    });
    return { html: out, toc };
}

/** Carte « Au sommaire » (repliable, sans JavaScript), juste avant le premier titre */
function withTocCard(html: string, toc: TocItem[]): string {
    const h2 = toc.filter((t) => t.level === 2).length;
    const parts = h2 || toc.length;
    const items = toc
        .map((t) =>
            t.level === 2 || !h2
                ? `<li class="wk-toc-h2"><a href="#${t.id}"><span class="wk-toc-n">${String(t.level === 2 ? t.n : toc.indexOf(t) + 1).padStart(2, "0")}</span><span>${escapeHtml(t.text)}</span></a></li>`
                : `<li class="wk-toc-h3"><a href="#${t.id}">${escapeHtml(t.text)}</a></li>`
        )
        .join("");
    const card = `<details class="wk-toc" id="sommaire" open><summary><span class="wk-toc-title">Au sommaire</span><span class="wk-toc-meta">${parts} partie${parts > 1 ? "s" : ""}</span></summary><ol>${items}</ol></details>`;
    const at = html.search(/<h[23][\s>]/);
    return at < 0 ? card + html : html.slice(0, at) + card + html.slice(at);
}

/** Ajoute la classe « lead » au premier <p> de premier niveau */
function withLead(html: string): string {
    let depth = 0;
    const re = /<(\/?)(blockquote|aside|li|td|th|figure|div)\b[^>]*>|<p>/g;
    for (let m = re.exec(html); m; m = re.exec(html)) {
        if (m[0] === "<p>") {
            if (depth === 0) return `${html.slice(0, m.index)}<p class="lead">${html.slice(m.index + 3)}`;
        } else depth += m[1] ? -1 : 1;
    }
    return html;
}

/** Citation sans paragraphe (texte brut repris de WordPress) : un <p>, pour les guillemets du post-it */
/**
 * Tableaux : enveloppés pour ne jamais déborder sur les widgets. Ceux de 5
 * colonnes ou plus (emplois du temps…) passent en version compacte pour tenir
 * dans la colonne ; le défilement horizontal ne reste qu'en dernier recours.
 */
function wrapTables(html: string): string {
    return html.replace(/<table\b[\s\S]*?<\/table>/g, (t) => {
        const firstRow = t.match(/<tr\b[\s\S]*?<\/tr>/)?.[0] ?? "";
        const cols = [...firstRow.matchAll(/<t[hd]\b([^>]*)>/g)].reduce((n, m) => n + (Number(m[1].match(/colspan="(\d+)"/)?.[1]) || 1), 0);
        return `<div class="wk-table${cols >= 5 ? " wk-table--wide" : ""}">${t}</div>`;
    });
}

function wrapQuotes(html: string): string {
    return html.replace(/<blockquote>(?!\s*<(?:p|div|ul|ol)\b)([\s\S]*?)<\/blockquote>/g, (_m, inner: string) => {
        const cite = inner.match(/<cite\b[\s\S]*<\/cite>/)?.[0] ?? "";
        const text = inner.replace(cite, "").trim();
        return text ? `<blockquote><p>${text}</p>${cite}</blockquote>` : `<blockquote>${inner}</blockquote>`;
    });
}

/** Titres H2 et H3 sans enveloppe (articles repris de WordPress) : même style que ceux de l'éditeur */
function wrapHeadings(html: string): string {
    return html.replace(/<h([23])((?:\s[^>]*)?)>(?!<span class="wk-h">)([\s\S]*?)<\/h\1>/g, '<h$1$2><span class="wk-h">$3</span></h$1>');
}

/**
 * Appels de source : « [n] » renvoie à la n-ième référence du module Sources
 * (et la référence renvoie au premier appel). Appel vers une source retirée : effacé.
 */
function renderCitations(html: string, sourceIds: string[]): string {
    const seen = new Map<string, number>();
    return html.replace(/<sup\b[^>]*data-source="([^"]*)"[^>]*><\/sup>/g, (_tag, id: string) => {
        const n = sourceIds.indexOf(id) + 1;
        if (!n) return "";
        const k = (seen.get(id) ?? 0) + 1;
        seen.set(id, k);
        return `<sup class="wk-cite"><a href="#source-${id}" id="cite-${id}-${k}" aria-label="Source ${n}">[${n}]</a></sup>`;
    });
}

/** Le HTML d'un article coupé aux emplacements des modules (bloc « module » de l'éditeur) */
export function splitAtModules(html: string): ({ html: string } | { moduleId: string })[] {
    const out: ({ html: string } | { moduleId: string })[] = [];
    let last = 0;
    for (const m of html.matchAll(/<div\b[^>]*data-module="([^"]+)"[^>]*><\/div>/g)) {
        if (m.index! > last) out.push({ html: html.slice(last, m.index) });
        out.push({ moduleId: m[1] });
        last = m.index! + m[0].length;
    }
    if (last < html.length) out.push({ html: html.slice(last) });
    return out;
}

/** Texte brut (extraits, descriptions) */
export function plainText(html: string): string {
    return sanitizeHtml(html || "", { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}

/** Temps de lecture : 220 mots par minute, au moins une minute */
export function readingMinutes(html: string): number {
    const words = plainText(html).split(" ").filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
}
