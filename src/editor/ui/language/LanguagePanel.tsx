"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/react";
import { BookPlus, ChevronDown, CircleCheck, EyeOff, Feather, Loader2, Search, Sparkles, Trash2, Undo2, Wand2, X } from "lucide-react";
import { CATEGORY_LABELS, SOFT_RULES, dictKey, type LangCategory } from "@/lib/language/core";
import { languageStorage, type LangStatus, type PlacedIssue } from "./LanguageCheck";
import { suggestWord, synonymsOf, type SynonymGroup } from "./engine";

/**
 * Correcteur de langue, côté interface : bulle sur une faute du texte,
 * onglet « Langue » du panneau latéral, dictionnaire Workyt.
 */

/** Couleurs des soulignements (globals.css, .wk-lang--…) */
export const CATEGORY_COLORS: Record<LangCategory, string> = {
    orthographe: "#d92d20",
    grammaire: "#2f86b3",
    typographie: "#8a8079",
    style: "#e08a00",
    nom: "#8a8079",
};

const DEFAULT_MESSAGE: Partial<Record<LangCategory, string>> = {
    orthographe: "Mot inconnu du dictionnaire.",
    nom: "Nom propre ou marque inconnus : s'il est bien écrit, ajoute-le au dictionnaire Workyt.",
};

const ORDER: LangCategory[] = ["orthographe", "grammaire", "typographie", "style", "nom"];
const SCORED: LangCategory[] = ["orthographe", "grammaire", "typographie"];

/** Majuscule du mot remplacé gardée (« Méthode » → « Façon ») */
const sameCase = (model: string, word: string) => (/^\p{Lu}/u.test(model) ? word.charAt(0).toUpperCase() + word.slice(1) : word);

/* ─── État du correcteur ─── */

export function useLanguageState(editor: Editor | null): { issues: PlacedIssue[]; status: LangStatus; typoCount: number } {
    const subscribe = useCallback(
        (cb: () => void) => {
            if (!editor) return () => {};
            const s = languageStorage(editor);
            s.listeners.add(cb);
            return () => void s.listeners.delete(cb);
        },
        [editor],
    );
    useSyncExternalStore(
        subscribe,
        () => (editor ? languageStorage(editor).version : -1),
        () => -1,
    );
    if (!editor) return { issues: [], status: "loading", typoCount: 0 };
    const s = languageStorage(editor);
    return { issues: s.issues, status: s.status, typoCount: s.typoCount };
}

/* ─── Dictionnaire Workyt ─── */

export interface DictionaryEntry {
    key: string;
    word: string;
    addedBy: string;
    removable: boolean;
    builtin: boolean;
}

export function useWorkytDictionary() {
    const [entries, setEntries] = useState<DictionaryEntry[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        let alive = true;
        fetch("/api/language/dictionary/")
            .then((r) => r.json())
            .then((j) => alive && setEntries(j.success ? j.data : []))
            .catch(() => alive && setEntries([]));
        return () => {
            alive = false;
        };
    }, []);
    const add = useCallback(async (word: string) => {
        setError(null);
        const j = await fetch("/api/language/dictionary/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word }) })
            .then((r) => r.json())
            .catch(() => ({ success: false, error: "Connexion impossible." }));
        if (!j.success) {
            setError(j.error || "Ajout impossible.");
            return false;
        }
        setEntries((list) => [...(list ?? []).filter((e) => e.key !== j.data.key), j.data].sort((a, b) => a.key.localeCompare(b.key, "fr")));
        return true;
    }, []);
    const remove = useCallback(async (key: string) => {
        setError(null);
        const j = await fetch(`/api/language/dictionary/?word=${encodeURIComponent(key)}`, { method: "DELETE" })
            .then((r) => r.json())
            .catch(() => ({ success: false, error: "Connexion impossible." }));
        if (!j.success) setError(j.error || "Retrait impossible.");
        else setEntries((list) => (list ?? []).filter((e) => e.key !== key));
    }, []);
    return { entries, add, remove, error };
}

/* ─── Bulle sur une faute ─── */

export interface PopoverState {
    issue: PlacedIssue;
    rect: DOMRect;
    mode: "issue" | "synonyms";
}

function useSuggestions(issue: PlacedIssue, mode: PopoverState["mode"]) {
    const spelling = issue.rule === "spell";
    const wantSyn = issue.repetition || mode === "synonyms";
    const [spell, setSpell] = useState<string[] | null>(spelling ? null : issue.suggestions);
    const [syn, setSyn] = useState<SynonymGroup[] | null>(wantSyn ? null : []);
    useEffect(() => {
        let alive = true;
        if (spelling) suggestWord(issue.text).then((s) => alive && setSpell(s), () => alive && setSpell([]));
        if (wantSyn) synonymsOf(issue.text).then((s) => alive && setSyn(s), () => alive && setSyn([]));
        return () => {
            alive = false;
        };
    }, [issue.text, spelling, wantSyn]);
    return { spell, syn };
}

export function LanguagePopover({
    state,
    canWrite,
    canIgnore,
    onApply,
    onIgnore,
    onAddWord,
    onClose,
}: {
    state: PopoverState;
    canWrite: boolean;
    canIgnore: boolean;
    onApply: (issue: PlacedIssue, text: string) => void;
    onIgnore: (issue: PlacedIssue) => void;
    onAddWord: (word: string) => Promise<boolean>;
    onClose: () => void;
}) {
    const { issue, rect, mode } = state;
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: rect.bottom + 8, left: rect.left });
    const [adding, setAdding] = useState(false);
    const { spell, syn } = useSuggestions(issue, mode);
    const suggestions = (issue.rule === "spell" ? spell : issue.suggestions) ?? null;
    const canFix = canWrite && issue.from !== null;
    const isWord = issue.rule === "spell";

    // Dans l'écran : sous le mot, ou au-dessus s'il n'y a pas la place
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const h = el.offsetHeight;
        const w = el.offsetWidth;
        const top = rect.bottom + 8 + h > window.innerHeight - 8 ? Math.max(8, rect.top - 8 - h) : rect.bottom + 8;
        const left = Math.min(Math.max(8, rect.left), window.innerWidth - w - 8);
        setPos({ top, left });
    }, [rect, spell, syn]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
        const onScroll = (e: Event) => !ref.current?.contains(e.target as Node) && onClose();
        window.addEventListener("keydown", onKey);
        window.addEventListener("mousedown", onDown, true);
        window.addEventListener("scroll", onScroll, true);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("mousedown", onDown, true);
            window.removeEventListener("scroll", onScroll, true);
        };
    }, [onClose]);

    const chip = "rounded-full bg-paper2 px-2.5 py-1 text-[13px] font-semibold transition hover:bg-accent/15 disabled:cursor-default disabled:hover:bg-paper2";
    return (
        <div
            ref={ref}
            role="dialog"
            aria-label={`${CATEGORY_LABELS[issue.category]} : ${issue.text}`}
            className="fixed z-[90] w-[320px] rounded-2xl border border-ink/10 bg-white p-4 shadow-[0_14px_40px_rgba(26,21,18,.18)]"
            style={{ top: pos.top, left: pos.left }}
            onMouseDown={(e) => e.preventDefault()}
        >
            <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[issue.category] }} />
                <p className="eyebrow flex-1">{mode === "synonyms" ? "Synonymes" : CATEGORY_LABELS[issue.category]}</p>
                <button type="button" onClick={onClose} className="grid h-6 w-6 place-items-center rounded-full text-ink/40 hover:bg-paper2 hover:text-ink" aria-label="Fermer">
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
            <p className="mt-2 font-display text-lg leading-tight">« {issue.text} »</p>
            {mode === "issue" && <p className="mt-1 text-[13px] text-ink/65">{issue.message || DEFAULT_MESSAGE[issue.category] || "À vérifier."}</p>}

            {mode === "issue" && !issue.repetition && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {suggestions === null ? (
                        <Loader2 className="h-4 w-4 animate-spin text-ink/30" />
                    ) : suggestions.length ? (
                        suggestions.slice(0, 6).map((s) => (
                            <button key={s} type="button" disabled={!canFix} onClick={() => onApply(issue, s)} className={chip} title={canFix ? "Remplacer" : undefined}>
                                {s.trim() ? s : "(supprimer)"}
                            </button>
                        ))
                    ) : (
                        <span className="text-xs text-ink/45">Pas de suggestion.</span>
                    )}
                </div>
            )}

            {(issue.repetition || mode === "synonyms") && (
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                    {syn === null ? (
                        <Loader2 className="h-4 w-4 animate-spin text-ink/30" />
                    ) : syn.length ? (
                        syn.map((g, i) => (
                            <div key={`${g.label}-${i}`}>
                                {g.label && <p className="text-[11px] font-semibold text-ink/45">{g.label}</p>}
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                    {g.words.map((w) => (
                                        <button key={w} type="button" disabled={!canFix} onClick={() => onApply(issue, sameCase(issue.text, w))} className={chip}>
                                            {w}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <span className="text-xs text-ink/45">Pas de synonyme trouvé.</span>
                    )}
                </div>
            )}

            {issue.from === null && <p className="mt-2 text-[11px] text-ink/45">Le passage touche une formule ou du code : corrige-le à la main.</p>}

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-ink/5 pt-3">
                {isWord && canIgnore && (
                    <button
                        type="button"
                        disabled={adding}
                        onClick={async () => {
                            setAdding(true);
                            if (await onAddWord(issue.text)) onClose();
                            setAdding(false);
                        }}
                        className="btn-ghost px-2.5 py-1 text-xs"
                        title="Le mot ne sera plus signalé, pour toute la rédaction"
                    >
                        {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookPlus className="h-3.5 w-3.5" />} Ajouter au dictionnaire Workyt
                    </button>
                )}
                {canIgnore && (
                    <button type="button" onClick={() => onIgnore(issue)} className="btn-ghost px-2.5 py-1 text-xs" title="Ignoré partout dans cet article, hors de la note">
                        <EyeOff className="h-3.5 w-3.5" /> Ignorer
                    </button>
                )}
                {issue.url && (
                    <a href={issue.url} target="_blank" rel="noreferrer" className="ml-auto text-xs font-semibold text-accentdark hover:underline">
                        La règle
                    </a>
                )}
            </div>
        </div>
    );
}

/* ─── Onglet « Langue » ─── */

export function LanguageTab({
    issues,
    status,
    typoCount,
    canWrite,
    canIgnore,
    ignoredCount,
    hidden,
    onToggleHidden,
    onApply,
    onIgnore,
    onResetIgnores,
    onGo,
    onFixTypography,
    dictionary,
}: {
    issues: PlacedIssue[];
    status: LangStatus;
    typoCount: number;
    canWrite: boolean;
    canIgnore: boolean;
    ignoredCount: number;
    hidden: Set<LangCategory>;
    onToggleHidden: (c: LangCategory) => void;
    onApply: (issue: PlacedIssue, text: string) => void;
    onIgnore: (issue: PlacedIssue) => void;
    onResetIgnores: () => void;
    onGo: (issue: PlacedIssue) => void;
    onFixTypography: () => void;
    dictionary: ReturnType<typeof useWorkytDictionary>;
}) {
    const [open, setOpen] = useState<LangCategory | "none" | null>(null);
    const byCat = Object.fromEntries(ORDER.map((c) => [c, issues.filter((i) => i.category === c)])) as Record<LangCategory, PlacedIssue[]>;
    const scored = SCORED.reduce((s, c) => s + byCat[c].length, 0);
    const first = ORDER.find((c) => byCat[c].length);
    const current = open ?? first ?? null;

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-ink/10 bg-white p-4">
                <div className="flex items-center gap-3">
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${status === "ready" && !scored ? "bg-leaf/25 text-[#2f6e14]" : "bg-paper2 text-ink/70"}`}>
                        {status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : status === "ready" && !scored ? <CircleCheck className="h-6 w-6" /> : <Feather className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                        <p className="font-display text-xl leading-tight">
                            {status === "error" ? "Correcteur indisponible" : status === "loading" ? "Le correcteur se prépare…" : scored ? `${scored} point${scored > 1 ? "s" : ""} à regarder` : "Rien à signaler"}
                        </p>
                        <p className="mt-0.5 text-xs text-ink/55">
                            {status === "error"
                                ? "Recharge la page. En attendant, le correcteur du navigateur reste actif."
                                : status === "loading"
                                  ? "Une seule fois par session, sans IA : tout reste dans ton navigateur."
                                  : "Grammalecte, sans IA · relu à chaque pause"}
                        </p>
                    </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {SCORED.map((c) => (
                        <button key={c} type="button" onClick={() => setOpen(c)} className="rounded-xl bg-paper2/70 px-2 py-2 text-left hover:bg-paper2">
                            <span className="block truncate text-[10px] font-semibold text-ink/55">{CATEGORY_LABELS[c]}</span>
                            <span className="mt-1 flex items-center gap-1.5 font-display text-xl leading-none">
                                <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[c] }} />
                                {status === "ready" ? byCat[c].length : "–"}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-4">
                <Wand2 className="h-5 w-5 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Typographie en un clic</p>
                    <p className="text-xs text-ink/55">{typoCount ? `${typoCount} retouche${typoCount > 1 ? "s" : ""} : apostrophes ’, espaces insécables, guillemets « », points de suspension…` : "Apostrophes, espaces insécables et guillemets : tout est propre."}</p>
                </div>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onFixTypography} disabled={!canWrite || !typoCount} className="btn-orange shrink-0 px-3 py-1.5 text-xs disabled:opacity-40">
                    Corriger
                </button>
            </div>

            {ORDER.map((c) => {
                const list = byCat[c];
                if (!list.length) return null;
                const isOpen = current === c;
                const counted = SCORED.includes(c);
                return (
                    <div key={c} className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
                        <button type="button" onClick={() => setOpen(isOpen ? "none" : c)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left" aria-expanded={isOpen}>
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[c] }} />
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold">{CATEGORY_LABELS[c]}</span>
                                <span className="block text-[11px] text-ink/45">{counted ? "Compte dans la note, avec une marge" : "Ne compte pas dans la note"}</span>
                            </span>
                            <span className="rounded-full bg-paper2 px-2 py-0.5 text-xs font-semibold text-ink/60">{list.length}</span>
                            <ChevronDown className={`h-4 w-4 text-ink/40 transition ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                        {isOpen && (
                            <ul className="max-h-[420px] space-y-2 overflow-y-auto border-t border-ink/5 px-4 py-3">
                                {list.slice(0, 80).map((i, n) => (
                                    <IssueRow key={`${i.key}-${i.from}-${n}`} issue={i} canWrite={canWrite} canIgnore={canIgnore} onApply={onApply} onIgnore={onIgnore} onGo={onGo} />
                                ))}
                                {list.length > 80 && <li className="text-xs text-ink/45">… et {list.length - 80} autres.</li>}
                            </ul>
                        )}
                    </div>
                );
            })}

            <div className="rounded-2xl border border-ink/10 bg-white p-4">
                <p className="text-xs font-semibold text-ink/60">Souligner dans le texte</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {ORDER.map((c) => {
                        const on = !hidden.has(c);
                        return (
                            <button key={c} type="button" onClick={() => onToggleHidden(c)} aria-pressed={on} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${on ? "bg-ink text-white" : "bg-paper2 text-ink/50"}`}>
                                <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[c] }} />
                                {CATEGORY_LABELS[c]}
                            </button>
                        );
                    })}
                </div>
                <p className="mt-2 text-[11px] text-ink/45">Ton choix, rangé dans ce navigateur. La note, elle, ne change pas.</p>
                {ignoredCount > 0 && (
                    <div className="mt-3 flex items-center gap-2 border-t border-ink/5 pt-3 text-xs text-ink/60">
                        <EyeOff className="h-3.5 w-3.5" /> {ignoredCount} alerte{ignoredCount > 1 ? "s" : ""} ignorée{ignoredCount > 1 ? "s" : ""} dans l&apos;article
                        {canIgnore && (
                            <button type="button" onClick={onResetIgnores} className="ml-auto inline-flex items-center gap-1 font-semibold text-accentdark hover:underline">
                                <Undo2 className="h-3.5 w-3.5" /> Tout réafficher
                            </button>
                        )}
                    </div>
                )}
            </div>

            <DictionaryCard dictionary={dictionary} canAdd={canIgnore} />

            <details className="group rounded-2xl border border-ink/10 bg-white p-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-sun" /> <span className="flex-1">Les règles souples de Workyt</span>
                    <ChevronDown className="h-4 w-4 text-ink/40 transition group-open:rotate-180" />
                </summary>
                <ul className="mt-3 space-y-2.5">
                    {SOFT_RULES.map((r) => (
                        <li key={r.title} className="text-[13px]">
                            <b className="font-semibold">{r.title}.</b> <span className="text-ink/65">{r.text}</span>
                        </li>
                    ))}
                </ul>
            </details>
        </div>
    );
}

function IssueRow({ issue, canWrite, canIgnore, onApply, onIgnore, onGo }: { issue: PlacedIssue; canWrite: boolean; canIgnore: boolean; onApply: (i: PlacedIssue, t: string) => void; onIgnore: (i: PlacedIssue) => void; onGo: (i: PlacedIssue) => void }) {
    const canFix = canWrite && issue.from !== null;
    return (
        <li className="text-[13px]">
            <div className="flex items-start gap-2">
                <button type="button" onClick={() => onGo(issue)} className="min-w-0 flex-1 text-left" title="Voir dans le texte">
                    <b className="font-semibold underline decoration-2 underline-offset-2" style={{ textDecorationColor: CATEGORY_COLORS[issue.category] }}>
                        {issue.text}
                    </b>{" "}
                    <span className="text-ink/60">{issue.message || DEFAULT_MESSAGE[issue.category]}</span>
                </button>
                {canIgnore && (
                    <button type="button" onClick={() => onIgnore(issue)} className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink/35 hover:bg-paper2 hover:text-ink" title="Ignorer dans cet article" aria-label="Ignorer">
                        <EyeOff className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
            {!issue.repetition && issue.suggestions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                    {issue.suggestions.slice(0, 3).map((s) => (
                        <button key={s} type="button" disabled={!canFix} onMouseDown={(e) => e.preventDefault()} onClick={() => onApply(issue, s)} className="rounded-full bg-paper2 px-2 py-0.5 text-xs font-semibold hover:bg-accent/15 disabled:hover:bg-paper2">
                            {s.trim() ? s : "(supprimer)"}
                        </button>
                    ))}
                </div>
            )}
        </li>
    );
}

function DictionaryCard({ dictionary, canAdd }: { dictionary: ReturnType<typeof useWorkytDictionary>; canAdd: boolean }) {
    const [draft, setDraft] = useState("");
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState(false);
    const list = dictionary.entries ?? [];
    const q = dictKey(query);
    const shown = q ? list.filter((e) => e.key.includes(q)) : list.filter((e) => !e.builtin);
    const submit = async () => {
        if (!draft.trim()) return;
        setBusy(true);
        if (await dictionary.add(draft.trim())) setDraft("");
        setBusy(false);
    };
    return (
        <div className="rounded-2xl border border-ink/10 bg-white p-4">
            <div className="flex items-center gap-2">
                <BookPlus className="h-4 w-4 text-accent" />
                <p className="flex-1 text-sm font-semibold">Dictionnaire Workyt</p>
                <span className="text-xs text-ink/45">{dictionary.entries ? `${list.length} mots` : "…"}</span>
            </div>
            <p className="mt-1 text-xs text-ink/55">Les mots justes que le correcteur ne connaît pas (applis, sigles, anglicismes…). Partagé avec toute la rédaction, sans effet négatif sur la note.</p>
            {canAdd && (
                <form
                    className="mt-3 flex gap-1.5"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void submit();
                    }}
                >
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ajouter un mot" maxLength={40} className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-white px-3 py-1.5 text-sm outline-none focus:border-accent" />
                    <button type="submit" disabled={busy || !draft.trim()} className="btn-ink px-3 py-1.5 text-xs disabled:opacity-40">
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ajouter"}
                    </button>
                </form>
            )}
            {dictionary.error && <p className="mt-2 text-xs text-red-700">{dictionary.error}</p>}
            <label className="mt-3 flex items-center gap-2 rounded-xl bg-paper2/70 px-3 py-1.5">
                <Search className="h-3.5 w-3.5 text-ink/40" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher (mots de départ compris)" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
            </label>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {shown.slice(0, 200).map((e) => (
                    <li key={e.key} className="group flex items-center gap-2 rounded-lg px-1.5 py-1 text-[13px] hover:bg-paper2/60">
                        <span className="min-w-0 flex-1 truncate font-semibold">{e.word}</span>
                        <span className="shrink-0 text-[11px] text-ink/40">{e.builtin ? "de départ" : e.addedBy}</span>
                        {e.removable && (
                            <button type="button" onClick={() => void dictionary.remove(e.key)} className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink/30 opacity-0 hover:bg-red-50 hover:text-red-700 group-hover:opacity-100" title="Retirer du dictionnaire" aria-label={`Retirer ${e.word}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </li>
                ))}
                {!shown.length && <li className="px-1.5 py-1 text-xs text-ink/45">{q ? "Aucun mot trouvé." : "Pas encore de mot ajouté par la rédaction."}</li>}
            </ul>
        </div>
    );
}
