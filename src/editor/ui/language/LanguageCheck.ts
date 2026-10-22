"use client";

import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { SKIP_BLOCKS, TEXT_BLOCKS, classifyBlock, inlinePiece, type LangCategory, type LangContext, type LangIssue } from "@/lib/language/core";
import { typographyFixes } from "@/lib/language/typography";
import { cachedIssues, checkTexts, startEngine } from "./engine";
import { SUGGEST_INTERNAL } from "../suggestMode";

/**
 * Correcteur de langue dans l'éditeur : souligne les fautes (rouge :
 * orthographe, bleu : grammaire, gris : typographie, pointillés : conseils
 * de style et noms propres), sans gêner la frappe : le paragraphe en cours
 * est relu une fois la pause marquée.
 */

export interface PlacedIssue extends LangIssue {
    /** Position dans le document, null si le passage touche une formule ou du code */
    from: number | null;
    to: number | null;
    /** Bloc de premier niveau */
    block: number;
}

export type LangStatus = "loading" | "ready" | "error";

export interface LanguageStorage {
    issues: PlacedIssue[];
    status: LangStatus;
    /** Retouches de typographie possibles en un clic */
    typoCount: number;
    ctx: LangContext;
    /** Catégories masquées dans le texte (elles restent listées et comptées) */
    hidden: Set<LangCategory>;
    /** Clic sur une faute (ou clic droit sur une répétition : synonymes) */
    onOpen: ((issue: PlacedIssue, rect: DOMRect, mode: "issue" | "synonyms") => void) | null;
    listeners: Set<() => void>;
    /** Version, change à chaque nouvelle liste (useSyncExternalStore) */
    version: number;
    refresh: () => void;
}

const key = new PluginKey<DecorationSet>("languageCheck");

interface TextBlock {
    index: number;
    text: string;
    /** Position de chaque caractère dans le document, -1 pour un caractère de remplacement */
    map: number[];
}

/** Paragraphes et titres du document, avec la position de chaque caractère (même texte que jsonBlocks) */
export function documentBlocks(doc: PMNode): TextBlock[] {
    const out: TextBlock[] = [];
    doc.forEach((top, offset, index) => {
        const visit = (node: PMNode, pos: number) => {
            if (SKIP_BLOCKS.has(node.type.name)) return;
            if (TEXT_BLOCKS.has(node.type.name)) {
                let text = "";
                const map: number[] = [];
                node.forEach((child, off) => {
                    const piece = inlinePiece(child.type.name, child.text, child.marks.map((m) => m.type.name));
                    if (!piece) return;
                    const start = pos + 1 + off;
                    for (let i = 0; i < piece.text.length; i++) map.push(piece.exact ? start + i : -1);
                    text += piece.text;
                });
                if (text.trim()) out.push({ index, text, map });
                return;
            }
            node.forEach((child, off) => visit(child, pos + 1 + off));
        };
        visit(top, offset);
    });
    return out;
}

/** Positions d'un passage [start, end) du bloc, si tous ses caractères sont du texte suivi */
function place(b: TextBlock, start: number, end: number): { from: number; to: number } | null {
    if (end <= start) {
        // Insertion : juste avant le caractère, ou juste après le précédent
        const at = start < b.map.length ? b.map[start] : start > 0 && b.map[start - 1] >= 0 ? b.map[start - 1] + 1 : -1;
        const prev = start > 0 ? b.map[start - 1] : at - 1;
        return at >= 0 && (start === 0 || prev === at - 1) ? { from: at, to: at } : null;
    }
    for (let i = start; i < end; i++) if (b.map[i] < 0 || (i > start && b.map[i] !== b.map[i - 1] + 1)) return null;
    return { from: b.map[start], to: b.map[end - 1] + 1 };
}

function build(state: EditorState, storage: LanguageStorage): { decos: DecorationSet; missing: string[] } {
    const blocks = documentBlocks(state.doc);
    const issues: PlacedIssue[] = [];
    const decos: Decoration[] = [];
    const missing: string[] = [];
    let typo = 0;
    for (const b of blocks) {
        typo += typographyFixes(b.text).filter((e) => place(b, e.start, e.end)).length;
        const raws = cachedIssues(b.text);
        if (!raws) {
            missing.push(b.text);
            continue;
        }
        for (const issue of classifyBlock(raws, b.text, storage.ctx)) {
            const at = place(b, issue.start, issue.end);
            const placed: PlacedIssue = { ...issue, from: at?.from ?? null, to: at?.to ?? null, block: b.index };
            issues.push(placed);
            if (at && at.to > at.from && !storage.hidden.has(issue.category)) {
                decos.push(Decoration.inline(at.from, at.to, { class: `wk-lang wk-lang--${issue.category}` }, { issue: placed, inclusiveStart: false, inclusiveEnd: false }));
            }
        }
    }
    storage.issues = issues;
    storage.typoCount = typo;
    return { decos: DecorationSet.create(state.doc, decos), missing };
}

function notify(storage: LanguageStorage) {
    storage.version++;
    storage.listeners.forEach((l) => l());
}

/** La faute soulignée à cette position (avec ses positions à jour) */
function issueAt(state: EditorState, pos: number): { issue: PlacedIssue; from: number; to: number } | null {
    const set = key.getState(state);
    const d = set?.find(pos, pos).find((x) => x.from <= pos && pos <= x.to);
    return d ? { issue: { ...(d.spec.issue as PlacedIssue), from: d.from, to: d.to }, from: d.from, to: d.to } : null;
}

export const LanguageCheck = Extension.create<Record<string, never>, LanguageStorage>({
    name: "languageCheck",

    addStorage() {
        return {
            issues: [],
            status: "loading",
            typoCount: 0,
            ctx: { dictionary: new Set(), ignores: new Set() },
            hidden: new Set(),
            onOpen: null,
            listeners: new Set(),
            version: 0,
            refresh: () => {},
        };
    },

    addProseMirrorPlugins() {
        const storage = this.storage;
        return [
            new Plugin<DecorationSet>({
                key,
                state: {
                    init: () => DecorationSet.empty,
                    apply(tr, old) {
                        const next = tr.getMeta(key) as DecorationSet | undefined;
                        if (next) return next;
                        if (!tr.docChanged) return old;
                        // Le paragraphe touché perd ses soulignements jusqu'à la prochaine relecture
                        let set = old.map(tr.mapping, tr.doc);
                        tr.mapping.maps.forEach((map, i) => {
                            const rest = tr.mapping.slice(i + 1);
                            map.forEach((_a, _b, from, to) => {
                                const a = Math.min(rest.map(from, -1), tr.doc.content.size);
                                const b = Math.min(rest.map(to, 1), tr.doc.content.size);
                                const $a = tr.doc.resolve(a);
                                const $b = tr.doc.resolve(b);
                                const start = $a.depth ? $a.start() : a;
                                const end = $b.depth ? $b.end() : b;
                                set = set.remove(set.find(start, end));
                            });
                        });
                        return set;
                    },
                },
                view(view: EditorView) {
                    let timer: ReturnType<typeof setTimeout> | undefined;
                    let run = 0;
                    let alive = true;
                    const apply = () => {
                        if (!alive) return [];
                        const { decos, missing } = build(view.state, storage);
                        view.dispatch(view.state.tr.setMeta(key, decos).setMeta("addToHistory", false).setMeta(SUGGEST_INTERNAL, true));
                        notify(storage);
                        return missing;
                    };
                    const check = async () => {
                        const mine = ++run;
                        const missing = apply();
                        if (!missing.length) {
                            if (storage.status !== "ready" && storage.status !== "error") {
                                // Rien à lire (article vide) : le moteur se charge quand même pour la suite
                                startEngine().then(
                                    () => {
                                        storage.status = "ready";
                                        notify(storage);
                                    },
                                    () => {
                                        storage.status = "error";
                                        notify(storage);
                                    },
                                );
                            }
                            return;
                        }
                        try {
                            await checkTexts(missing, () => mine === run && apply());
                            storage.status = "ready";
                            if (mine === run) apply();
                        } catch {
                            storage.status = "error";
                            notify(storage);
                        }
                    };
                    const schedule = (delay: number) => {
                        clearTimeout(timer);
                        timer = setTimeout(() => void check(), delay);
                    };
                    storage.refresh = () => schedule(0);
                    schedule(0);
                    return {
                        update(v, prev) {
                            if (!v.state.doc.eq(prev.doc)) schedule(800);
                        },
                        destroy() {
                            alive = false;
                            clearTimeout(timer);
                        },
                    };
                },
                props: {
                    decorations: (state) => key.getState(state),
                    handleClick(view, pos, event) {
                        const hit = issueAt(view.state, pos);
                        if (!hit || !storage.onOpen) return false;
                        const el = (event.target as HTMLElement | null)?.closest?.(".wk-lang");
                        storage.onOpen(hit.issue, (el ?? (event.target as HTMLElement)).getBoundingClientRect(), "issue");
                        return false;
                    },
                    handleDOMEvents: {
                        // Clic droit sur une répétition : synonymes (ailleurs, le menu du navigateur)
                        contextmenu(view, event) {
                            const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
                            const hit = at ? issueAt(view.state, at.pos) : null;
                            if (!hit?.issue.repetition || !storage.onOpen) return false;
                            event.preventDefault();
                            const el = (event.target as HTMLElement | null)?.closest?.(".wk-lang");
                            storage.onOpen(hit.issue, (el ?? (event.target as HTMLElement)).getBoundingClientRect(), "synonyms");
                            return true;
                        },
                    },
                },
            }),
        ];
    },
});

export const languageStorage = (editor: Editor) => (editor.storage as unknown as { languageCheck: LanguageStorage }).languageCheck;

/** Remplace un passage s'il n'a pas changé entre-temps */
export function replaceText(editor: Editor, from: number, to: number, expected: string, text: string): boolean {
    const { state } = editor;
    if (to > state.doc.content.size || state.doc.textBetween(from, to) !== expected) return false;
    editor.view.dispatch(state.tr.insertText(text, from, to));
    return true;
}

/** « Corriger la typographie » : toutes les retouches d'un coup (une seule étape d'annulation) */
export function fixTypography(editor: Editor): number {
    const { state } = editor;
    const edits: { from: number; to: number; insert: string }[] = [];
    for (const b of documentBlocks(state.doc)) {
        for (const e of typographyFixes(b.text)) {
            const at = place(b, e.start, e.end);
            if (at) edits.push({ ...at, insert: e.insert });
        }
    }
    if (!edits.length) return 0;
    const tr = state.tr;
    for (const e of edits.sort((a, b) => b.from - a.from)) tr.insertText(e.insert, e.from, e.to);
    editor.view.dispatch(tr);
    return edits.length;
}
