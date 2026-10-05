import { Extension, type Editor } from "@tiptap/core";
import { Fragment, type Mark, type MarkType, type Node as PMNode, type Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";

/**
 * Mode suggestion du correcteur (« suivi des modifications ») :
 * - ce qu'il tape est marqué « ajout » (vert) ;
 * - ce qu'il efface n'est pas supprimé mais marqué « suppression » (barré) ;
 * - effacer son propre ajout le supprime pour de bon.
 * Le rédacteur accepte ou refuse ensuite chaque suggestion.
 *
 * On suit les modifications À L'INTÉRIEUR d'un paragraphe (taper, effacer,
 * remplacer, coller du texte). Le reste (couper un paragraphe, déplacer un
 * bloc, mettre en gras…) est bloqué dans ce mode : pour ça, un commentaire.
 */

export const SUGGEST_INTERNAL = "wkSuggestInternal";
const key = new PluginKey("suggestMode");

export interface SuggestOptions {
    author: string;
}

const newId = () => Math.random().toString(36).slice(2, 10);

/** Contenu inséré par une étape, s'il s'agit uniquement de texte dans le même paragraphe */
function inlineInsert(slice: Slice): Fragment | null {
    if (slice.openStart === 0 && slice.openEnd === 0) {
        let ok = true;
        slice.content.forEach((n) => (ok &&= n.isInline));
        return ok ? slice.content : null;
    }
    if (slice.openStart === 1 && slice.openEnd === 1 && slice.content.childCount === 1 && slice.content.firstChild!.isTextblock) return slice.content.firstChild!.content;
    return null;
}

function isTrackable(tr: Transaction, state: EditorState): boolean {
    if (tr.steps.length !== 1) return false;
    const step = tr.steps[0];
    if (!(step instanceof ReplaceStep)) return false;
    const { from, to, slice } = step;
    // « structure » : étape qui ne fait que déplacer des limites de blocs (champ interne de ReplaceStep)
    if ((step as unknown as { structure: boolean }).structure) return false;
    const $from = state.doc.resolve(from);
    const $to = state.doc.resolve(to);
    if (!$from.parent.isTextblock || $from.parent !== $to.parent) return false;
    return inlineInsert(slice) !== null;
}

/** Suggestion voisine du même auteur : on la prolonge (même identifiant, même date) pour regrouper les frappes */
function neighbour(doc: PMNode, pos: number, type: MarkType, author: string): { id: string; at: string } | null {
    const $p = doc.resolve(pos);
    for (const n of [$p.nodeBefore, $p.nodeAfter]) {
        const m = n?.marks.find((mk) => mk.type === type && mk.attrs.author === author);
        if (m) return { id: m.attrs.id as string, at: m.attrs.at as string };
    }
    return null;
}

export const SuggestMode = Extension.create<SuggestOptions, { enabled: boolean; author: string }>({
    name: "suggestMode",
    addOptions: () => ({ author: "" }),
    addStorage: () => ({ enabled: false, author: "" }),

    addProseMirrorPlugins() {
        // Objet partagé avec editor.storage.suggestMode : setSuggesting() le modifie
        const storage = this.storage;
        const fallbackAuthor = this.options.author;
        const author = () => storage.author || fallbackAuthor || "Correcteur";
        const skip = (tr: Transaction) => !storage.enabled || !tr.docChanged || tr.getMeta(SUGGEST_INTERNAL) || tr.getMeta("history$") || tr.getMeta("appendedTransaction");

        return [
            new Plugin({
                key,
                // Ce qu'on ne sait pas suivre est refusé (le correcteur passe par un commentaire)
                filterTransaction: (tr, state) => skip(tr) || isTrackable(tr, state),

                appendTransaction(trs, oldState, newState) {
                    const tr0 = trs.find((t) => !skip(t));
                    if (!tr0 || trs.length !== 1) return null;
                    const step = tr0.steps[0] as ReplaceStep & { from: number; to: number; slice: Slice };
                    const { from, to } = step;
                    const inserted = inlineInsert(step.slice) ?? Fragment.empty;
                    const insType = newState.schema.marks.suggestionInsert;
                    const delType = newState.schema.marks.suggestionDelete;
                    const me = author();
                    const at = new Date().toISOString();
                    const tr = newState.tr.setMeta(SUGGEST_INTERNAL, true);

                    // 1. Ce qui a été tapé ou collé : « ajout »
                    if (inserted.size) {
                        const near = neighbour(newState.doc, from, insType, me) ?? { id: newId(), at };
                        tr.removeMark(from, from + inserted.size, delType);
                        tr.addMark(from, from + inserted.size, insType.create({ ...near, author: me }));
                    }

                    // 2. Ce qui a été effacé revient, barré (sauf son propre ajout, vraiment supprimé)
                    const removed: PMNode[] = [];
                    if (to > from) {
                        const del = neighbour(oldState.doc, from, delType, me) ?? neighbour(oldState.doc, to, delType, me) ?? { id: newId(), at };
                        oldState.doc.nodesBetween(from, to, (node, pos) => {
                            if (!node.isInline) return true;
                            const start = Math.max(from, pos);
                            const end = Math.min(to, pos + node.nodeSize);
                            const piece = node.isText ? node.cut(start - pos, end - pos) : node;
                            if (piece.marks.some((m: Mark) => m.type === insType && m.attrs.author === me)) return false;
                            removed.push(piece.marks.some((m: Mark) => m.type === delType) ? piece : piece.mark(delType.create({ ...del, author: me }).addToSet(piece.marks.filter((m) => m.type !== insType))));
                            return false;
                        });
                    }
                    if (removed.length) {
                        const frag = Fragment.from(removed);
                        tr.insert(from, frag);
                        // Retour arrière : le curseur se place AVANT le texte barré (on continue d'effacer vers la gauche)
                        const backspace = oldState.selection.empty && oldState.selection.head === to && !inserted.size;
                        const cursor = backspace ? from : from + frag.size + inserted.size;
                        tr.setSelection(TextSelection.create(tr.doc, cursor));
                    }
                    return tr.steps.length ? tr : null;
                },
            }),
        ];
    },
});

export function setSuggesting(editor: Editor, on: boolean, author?: string) {
    const st = (editor.storage as unknown as Record<string, { enabled: boolean; author: string } | undefined>).suggestMode;
    if (!st) return;
    st.enabled = on;
    if (author) st.author = author;
}

/* ─── Accepter / refuser ─── */

interface Range {
    from: number;
    to: number;
    kind: "insert" | "delete";
}

function rangesOf(state: EditorState, id?: string): Range[] {
    const out: Range[] = [];
    state.doc.descendants((node, pos) => {
        if (!node.isInline) return true;
        for (const m of node.marks) {
            const kind = m.type.name === "suggestionInsert" ? "insert" : m.type.name === "suggestionDelete" ? "delete" : null;
            if (kind && (id === undefined || m.attrs.id === id)) out.push({ from: pos, to: pos + node.nodeSize, kind });
        }
        return false;
    });
    return out;
}

/**
 * Accepte ou refuse une suggestion (ou toutes si pas d'id).
 * Ajout accepté = texte gardé ; suppression acceptée = texte retiré ; et l'inverse pour un refus.
 */
export function resolveSuggestion(editor: Editor, accept: boolean, id?: string) {
    const { state } = editor;
    const tr = state.tr.setMeta(SUGGEST_INTERNAL, true);
    const ranges = rangesOf(state, id).sort((a, b) => b.from - a.from);
    for (const r of ranges) {
        const removeText = (r.kind === "insert" && !accept) || (r.kind === "delete" && accept);
        if (removeText) tr.delete(r.from, r.to);
        else tr.removeMark(r.from, r.to, state.schema.marks[r.kind === "insert" ? "suggestionInsert" : "suggestionDelete"]);
    }
    if (tr.steps.length) editor.view.dispatch(tr);
}

/** Pose la marque d'une discussion sur la sélection (autorisé même en mode suggestion) */
export function anchorComment(editor: Editor, threadId: string, from: number, to: number) {
    const tr = editor.state.tr.setMeta(SUGGEST_INTERNAL, true).addMark(from, to, editor.schema.marks.comment.create({ threadId }));
    editor.view.dispatch(tr);
}

/** Retire la marque d'une discussion (résolue) */
export function unanchorComment(editor: Editor, threadId: string) {
    const { state } = editor;
    const tr = state.tr.setMeta(SUGGEST_INTERNAL, true);
    state.doc.descendants((node, pos) => {
        const m = node.marks.find((mk) => mk.type.name === "comment" && mk.attrs.threadId === threadId);
        if (m) tr.removeMark(pos, pos + node.nodeSize, m);
    });
    if (tr.steps.length) editor.view.dispatch(tr);
}
