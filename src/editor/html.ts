import { generateHTML } from "@tiptap/html/server";
import type { JSONContent } from "@tiptap/core";
import { schemaExtensions } from "./extensions";

/** HTML public d'un document de l'éditeur (assaini ensuite au rendu, voir lib/render.ts) */
export function documentToHtml(doc: JSONContent | null | undefined): string {
    if (!doc || doc.type !== "doc") return "";
    return generateHTML(doc, schemaExtensions());
}

/** Images d'un document : pour vérifier qu'elles ont toutes un crédit */
export function documentImages(doc: JSONContent | null | undefined): { src: string; hasCredit: boolean }[] {
    const out: { src: string; hasCredit: boolean }[] = [];
    const walk = (n: JSONContent) => {
        if (n.type === "image") out.push({ src: String(n.attrs?.src || ""), hasCredit: !!(n.attrs?.creditAuthor && n.attrs?.creditSource && n.attrs?.creditLicense) });
        n.content?.forEach(walk);
    };
    if (doc) walk(doc);
    return out;
}

/** Texte brut d'un document (nombre de mots, extrait automatique) */
export function documentText(doc: JSONContent | null | undefined): string {
    const parts: string[] = [];
    const walk = (n: JSONContent) => {
        if (n.text) parts.push(n.text);
        n.content?.forEach(walk);
        if (n.type && ["paragraph", "heading", "listItem", "taskItem", "tableCell", "tableHeader"].includes(n.type)) parts.push(" ");
    };
    if (doc) walk(doc);
    return parts.join("").replace(/\s+/g, " ").trim();
}


/** Attributs qui portent une adresse (liens, images, vidéos, contenus intégrés) */
const URL_ATTRS = ["href", "src", "url"];

/**
 * Adresse sans danger : relative, ancre, ou http(s)/mailto. Les navigateurs
 * ignorent espaces et caractères de contrôle dans le schéma
 * (« java\tscript: »), on les retire avant de regarder.
 */
export function isSafeUrl(raw: string): boolean {
    const url = raw.replace(/[\u0000-\u0020\u007f]/g, "");
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase();
    return !scheme || scheme === "http" || scheme === "https" || scheme === "mailto";
}

/**
 * Document envoyé par l'éditeur : retire les adresses « javascript: », « data: »…
 * des nœuds et des marques. L'éditeur affiche le JSON tel quel (sans passer
 * par sanitize-html) : un lien piégé s'exécuterait chez la personne qui l'ouvre.
 */
export function withSafeUrls(doc: JSONContent): JSONContent {
    const clean = (attrs: Record<string, unknown> | undefined) => {
        if (!attrs) return attrs;
        const out = { ...attrs };
        for (const k of URL_ATTRS) if (typeof out[k] === "string" && !isSafeUrl(out[k] as string)) out[k] = "";
        return out;
    };
    const walk = (n: JSONContent): JSONContent => ({
        ...n,
        ...(n.attrs ? { attrs: clean(n.attrs) } : {}),
        ...(n.marks ? { marks: n.marks.map((m) => ({ ...m, ...(m.attrs ? { attrs: clean(m.attrs) } : {}) })) } : {}),
        ...(n.content ? { content: n.content.map(walk) } : {}),
    });
    return walk(doc);
}
