import { Mark, mergeAttributes, type JSONContent } from "@tiptap/core";

/**
 * Marques de la relecture (cahier des charges § 7.2), communes au navigateur
 * et au serveur :
 * - suggestionInsert / suggestionDelete : le « suivi des modifications » du
 *   correcteur (ajout en vert, suppression barrée), que le rédacteur accepte
 *   ou refuse une par une ;
 * - comment : passage auquel est ancrée une discussion.
 * Un article ne se publie pas tant qu'il reste des suggestions.
 */

export interface SuggestionAttrs {
    id: string;
    author: string;
    at: string;
}

const suggestionAttrs = {
    id: { default: "", parseHTML: (el: HTMLElement) => el.getAttribute("data-suggestion") || "", renderHTML: (a: { id: string }) => ({ "data-suggestion": a.id }) },
    author: { default: "", parseHTML: (el: HTMLElement) => el.getAttribute("data-author") || "", renderHTML: (a: { author: string }) => ({ "data-author": a.author }) },
    at: { default: "", parseHTML: (el: HTMLElement) => el.getAttribute("data-at") || "", renderHTML: (a: { at: string }) => ({ "data-at": a.at }) },
};

export const SuggestionInsert = Mark.create({
    name: "suggestionInsert",
    // Ce qu'on tape juste après un ajout n'en hérite pas : chaque frappe est rattachée explicitement
    inclusive: false,
    excludes: "suggestionDelete",
    addAttributes: () => suggestionAttrs,
    parseHTML: () => [{ tag: "ins[data-suggestion]" }],
    renderHTML: ({ HTMLAttributes }) => ["ins", mergeAttributes(HTMLAttributes, { class: "wk-sugg wk-sugg--ins" }), 0],
});

export const SuggestionDelete = Mark.create({
    name: "suggestionDelete",
    inclusive: false,
    excludes: "suggestionInsert",
    addAttributes: () => suggestionAttrs,
    parseHTML: () => [{ tag: "del[data-suggestion]" }],
    renderHTML: ({ HTMLAttributes }) => ["del", mergeAttributes(HTMLAttributes, { class: "wk-sugg wk-sugg--del" }), 0],
});

export const CommentMark = Mark.create({
    name: "comment",
    inclusive: false,
    // Deux discussions peuvent porter sur le même passage
    excludes: "",
    addAttributes: () => ({
        threadId: { default: "", parseHTML: (el: HTMLElement) => el.getAttribute("data-comment") || "", renderHTML: (a: { threadId: string }) => ({ "data-comment": a.threadId }) },
    }),
    parseHTML: () => [{ tag: "span[data-comment]" }],
    renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes, { class: "wk-comment" }), 0],
});

export interface SuggestionView {
    id: string;
    kind: "insert" | "delete";
    author: string;
    at: string;
    text: string;
}

/** Suggestions d'un document, regroupées par identifiant (dans l'ordre du texte) */
export function documentSuggestions(doc: JSONContent | null | undefined): SuggestionView[] {
    const byId = new Map<string, SuggestionView>();
    const walk = (n: JSONContent) => {
        for (const m of n.marks ?? []) {
            if (m.type !== "suggestionInsert" && m.type !== "suggestionDelete") continue;
            const id = String(m.attrs?.id || "");
            const kind = m.type === "suggestionInsert" ? "insert" : "delete";
            const key = `${kind}:${id}`;
            const text = n.text ?? (n.type === "inlineMath" ? `$${n.attrs?.latex ?? ""}$` : " ");
            const prev = byId.get(key);
            if (prev) prev.text += text;
            else byId.set(key, { id, kind, author: String(m.attrs?.author || ""), at: String(m.attrs?.at || ""), text });
        }
        n.content?.forEach(walk);
    };
    if (doc) walk(doc);
    return [...byId.values()];
}

/** Identifiants des discussions ancrées dans le texte */
export function documentCommentIds(doc: JSONContent | null | undefined): string[] {
    const ids = new Set<string>();
    const walk = (n: JSONContent) => {
        for (const m of n.marks ?? []) if (m.type === "comment" && m.attrs?.threadId) ids.add(String(m.attrs.threadId));
        n.content?.forEach(walk);
    };
    if (doc) walk(doc);
    return [...ids];
}

/**
 * Le document tel qu'il serait si toutes les suggestions étaient refusées :
 * ce que le public voit tant que la relecture n'est pas terminée.
 */
export function withoutSuggestions(doc: JSONContent): JSONContent {
    const clean = (n: JSONContent): JSONContent | null => {
        const marks = n.marks?.filter((m) => m.type !== "suggestionDelete" && m.type !== "comment");
        if (n.marks?.some((m) => m.type === "suggestionInsert")) return null;
        const out: JSONContent = { ...n, ...(n.marks ? { marks } : {}) };
        if (marks && !marks.length) delete out.marks;
        if (n.content) out.content = n.content.map(clean).filter((c): c is JSONContent => c !== null);
        return out;
    };
    return clean(doc) ?? { type: "doc", content: [] };
}
