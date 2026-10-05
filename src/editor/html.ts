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

