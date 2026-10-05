import type { JSONContent } from "@tiptap/core";

const BLOCKS = ["paragraph", "heading", "listItem", "taskItem", "tableCell", "tableHeader", "blockquote", "codeBlock", "image", "blockMath", "youtube"];

/** Texte d'un document, un élément par bloc (pour comparer deux versions) */
export function documentBlocks(doc: JSONContent | null | undefined): string[] {
    const out: string[] = [];
    const inline = (n: JSONContent): string => {
        if (n.text) return n.text;
        if (n.type === "inlineMath") return `$${n.attrs?.latex ?? ""}$`;
        if (n.type === "hardBreak") return " ";
        return (n.content ?? []).map(inline).join("");
    };
    const walk = (n: JSONContent) => {
        if (n.type === "image") out.push(`[Image : ${n.attrs?.alt || n.attrs?.src || ""}]`);
        else if (n.type === "blockMath") out.push(`$$${n.attrs?.latex ?? ""}$$`);
        else if (n.type === "youtube") out.push(`[Vidéo : ${n.attrs?.src ?? ""}]`);
        else if (n.type && BLOCKS.includes(n.type) && !n.content?.some((c) => c.type && BLOCKS.includes(c.type))) {
            const t = inline(n).trim();
            if (t) out.push(n.type === "heading" ? `## ${t}` : t);
        } else n.content?.forEach(walk);
    };
    if (doc) walk(doc);
    return out;
}
