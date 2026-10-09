"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useEditorState, type Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { Check, CheckCheck, Eye, Flag, GitCompare, History, Loader2, MessageSquare, RotateCcw, Send, X } from "lucide-react";
import { documentSuggestions, type SuggestionView } from "../marks";
import { documentBlocks } from "../blocks";
import { diffBlocks, diffWords, type DiffPart } from "@/lib/textDiff";
import type { ThreadView } from "@/lib/review";
import type { EditMode } from "@/lib/workflow";
import type { WorkflowEntry } from "../types";
import { anchorComment, resolveSuggestion, unanchorComment } from "./suggestMode";

/** Passage sélectionné à commenter (depuis la barre flottante) */
export interface PendingAnchor {
    from: number;
    to: number;
    quote: string;
}

type Section = "comments" | "suggestions" | "versions" | "journal";

const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const btn = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:opacity-40";

/**
 * Onglet « Relecture » du panneau latéral : discussions ancrées ou
 * générales, suggestions du correcteur à accepter ou refuser, versions
 * (comparer, restaurer), journal du circuit.
 */
export default function ReviewPanel({
    editor,
    postId,
    mode,
    canWrite,
    workflow,
    pending,
    onPendingDone,
    focusThread,
}: {
    editor: Editor | null;
    postId: string;
    mode: EditMode;
    /** A la main sur le texte (verrou) */
    canWrite: boolean;
    workflow: WorkflowEntry[];
    pending: PendingAnchor | null;
    onPendingDone: () => void;
    focusThread: string | null;
}) {
    const [section, setSection] = useState<Section>("comments");
    const suggestions = useEditorState({
        editor,
        selector: ({ editor: e }) => (e ? documentSuggestions(e.state.doc.toJSON()) : []),
        equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    }) ?? [];

    // Nouveau passage à commenter, ou clic sur un passage commenté : on montre les commentaires
    const [seen, setSeen] = useState({ pending, focusThread });
    if (seen.pending !== pending || seen.focusThread !== focusThread) {
        setSeen({ pending, focusThread });
        if (pending || focusThread) setSection("comments");
    }

    const tabs: [Section, string, number | null][] = [
        ["comments", "Commentaires", null],
        ["suggestions", "Suggestions", suggestions.length || null],
        ["versions", "Versions", null],
        ["journal", "Journal", null],
    ];

    return (
        <>
            <div className="flex flex-wrap gap-1">
                {tabs.map(([id, label, n]) => (
                    <button key={id} type="button" onClick={() => setSection(id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${section === id ? "bg-ink text-white" : "bg-white text-ink/60 hover:text-ink"}`}>
                        {label}
                        {n ? <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[10px] text-white">{n}</span> : null}
                    </button>
                ))}
            </div>
            {section === "comments" && <Threads postId={postId} editor={editor} canAnchor={canWrite && mode !== "read"} pending={pending} onPendingDone={onPendingDone} focusThread={focusThread} />}
            {section === "suggestions" && <Suggestions editor={editor} items={suggestions} canResolve={canWrite && mode === "edit"} />}
            {section === "versions" && <Versions postId={postId} editor={editor} canRestore={canWrite && mode === "edit"} />}
            {section === "journal" && <Journal workflow={workflow} />}
        </>
    );
}

/* ─── Discussions ─── */

function Threads({ postId, editor, canAnchor, pending, onPendingDone, focusThread }: { postId: string; editor: Editor | null; canAnchor: boolean; pending: PendingAnchor | null; onPendingDone: () => void; focusThread: string | null }) {
    const [threads, setThreads] = useState<ThreadView[] | null>(null);
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [showResolved, setShowResolved] = useState(false);

    const load = useCallback(async () => {
        const j = await fetch(`/api/posts/${postId}/threads/`).then((r) => r.json());
        if (j.success) setThreads(j.data);
    }, [postId]);
    useEffect(() => {
        const first = setTimeout(() => void load(), 0);
        const t = setInterval(() => void load(), 30_000);
        return () => {
            clearTimeout(first);
            clearInterval(t);
        };
    }, [load]);

    useEffect(() => {
        if (focusThread) document.getElementById(`thread-${focusThread}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [focusThread, threads]);

    const create = async () => {
        const text = draft.trim();
        if (!text) return;
        setBusy(true);
        const anchored = !!pending && canAnchor;
        const j = await fetch(`/api/posts/${postId}/threads/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, quote: pending?.quote, anchored }) }).then((r) => r.json());
        setBusy(false);
        if (!j.success) return;
        if (anchored && editor && pending) anchorComment(editor, j.data.id, pending.from, pending.to);
        setThreads((l) => [...(l ?? []), j.data]);
        setDraft("");
        onPendingDone();
    };

    const update = async (t: ThreadView, body: { text?: string; resolved?: boolean }) => {
        const j = await fetch(`/api/posts/${postId}/threads/${t.id}/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
        if (!j.success) return false;
        setThreads((l) => (l ?? []).map((x) => (x.id === t.id ? j.data : x)));
        // Discussion close : le passage n'est plus surligné
        if (body.resolved === true && t.anchored && editor && canAnchor) unanchorComment(editor, t.id);
        return true;
    };

    const open = (threads ?? []).filter((t) => !t.resolved);
    const resolved = (threads ?? []).filter((t) => t.resolved);

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-ink/10 bg-white p-3">
                {pending && (
                    <div className="mb-2 flex items-start gap-2 rounded-xl bg-sun/20 px-3 py-2 text-xs">
                        <span className="min-w-0 flex-1">
                            Sur « <i className="line-clamp-2">{pending.quote}</i> »
                        </span>
                        <button type="button" onClick={onPendingDone} aria-label="Annuler">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder={pending ? "Ton commentaire sur ce passage…" : "Un commentaire sur l'article…"} className="w-full resize-none text-sm outline-none" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-ink/40">{pending ? "" : "Astuce : sélectionne un passage puis « Commenter »."}</span>
                    <button type="button" disabled={busy || !draft.trim()} onClick={create} className={`${btn} bg-ink text-white`}>
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Envoyer
                    </button>
                </div>
            </div>

            {threads === null ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-ink/30" />
            ) : open.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink/45">Aucune discussion ouverte.</p>
            ) : (
                open.map((t) => <Thread key={t.id} t={t} focused={focusThread === t.id} onUpdate={update} />)
            )}
            {resolved.length > 0 && (
                <button type="button" onClick={() => setShowResolved((v) => !v)} className="text-xs font-semibold text-ink/50 underline">
                    {showResolved ? "Masquer" : "Voir"} les {resolved.length} discussion{resolved.length > 1 ? "s" : ""} résolue{resolved.length > 1 ? "s" : ""}
                </button>
            )}
            {showResolved && resolved.map((t) => <Thread key={t.id} t={t} focused={false} onUpdate={update} />)}
        </div>
    );
}

function Thread({ t, focused, onUpdate }: { t: ThreadView; focused: boolean; onUpdate: (t: ThreadView, b: { text?: string; resolved?: boolean }) => Promise<boolean> }) {
    const [reply, setReply] = useState("");
    const goTo = () => document.querySelector(`.wk-editor [data-comment="${t.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    return (
        <div id={`thread-${t.id}`} className={`rounded-2xl border bg-white p-3 text-sm ${t.resolved ? "border-ink/5 opacity-60" : focused ? "border-accent ring-2 ring-accent/30" : "border-ink/10"}`}>
            {t.quote && (
                <button type="button" onClick={goTo} disabled={!t.anchored} className="mb-2 block w-full border-l-[3px] border-sun pl-2 text-left text-xs italic text-ink/60">
                    « {t.quote} »
                </button>
            )}
            <div className="space-y-2">
                {t.messages.map((m, i) => (
                    <div key={i}>
                        <div className="text-[11px] text-ink/45">
                            <b className="text-ink/80">{m.name}</b> · {when(m.at)}
                        </div>
                        <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                ))}
            </div>
            {t.resolved ? (
                <div className="mt-2 flex items-center justify-between text-[11px] text-ink/45">
                    Résolue par {t.resolvedBy}
                    <button type="button" onClick={() => onUpdate(t, { resolved: false })} className="font-semibold underline">
                        Rouvrir
                    </button>
                </div>
            ) : (
                <div className="mt-2 flex items-center gap-1.5">
                    <input
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        onKeyDown={async (e) => {
                            if (e.key === "Enter" && reply.trim() && (await onUpdate(t, { text: reply }))) setReply("");
                        }}
                        placeholder="Répondre…"
                        className="min-w-0 flex-1 rounded-full border border-ink/10 px-3 py-1 text-xs outline-none focus:border-accent"
                    />
                    <button type="button" onClick={() => onUpdate(t, { resolved: true })} className={`${btn} bg-leaf/25 text-[#2f6e14]`} title="Le point est réglé">
                        <Check className="h-3 w-3" /> Résolu
                    </button>
                </div>
            )}
        </div>
    );
}

/* ─── Suggestions ─── */

function Suggestions({ editor, items, canResolve }: { editor: Editor | null; items: SuggestionView[]; canResolve: boolean }) {
    if (!items.length) return <p className="py-4 text-center text-sm text-ink/45">Aucune suggestion en attente.</p>;
    const goTo = (s: SuggestionView) => document.querySelector(`.wk-editor [data-suggestion="${s.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    return (
        <div className="space-y-2">
            {canResolve ? (
                <div className="flex gap-1.5">
                    <button type="button" onClick={() => editor && resolveSuggestion(editor, true)} className={`${btn} bg-leaf/25 text-[#2f6e14]`}>
                        <CheckCheck className="h-3.5 w-3.5" /> Tout accepter
                    </button>
                    <button type="button" onClick={() => editor && resolveSuggestion(editor, false)} className={`${btn} bg-red-50 text-red-700`}>
                        <X className="h-3.5 w-3.5" /> Tout refuser
                    </button>
                </div>
            ) : (
                <p className="rounded-xl bg-paper2 px-3 py-2 text-xs text-ink/60">Le rédacteur accepte ou refuse chaque suggestion quand l&apos;article lui revient.</p>
            )}
            {items.map((s) => (
                <div key={`${s.kind}-${s.id}`} className="rounded-2xl border border-ink/10 bg-white p-3 text-sm">
                    <button type="button" onClick={() => goTo(s)} className="block w-full text-left">
                        <span className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${s.kind === "insert" ? "bg-leaf/30 text-[#2f6e14]" : "bg-red-100 text-red-700"}`}>{s.kind === "insert" ? "Ajout" : "Suppression"}</span>
                        <span className={s.kind === "insert" ? "text-[#2f6e14]" : "text-red-700 line-through"}>{s.text.length > 120 ? `${s.text.slice(0, 120)}…` : s.text}</span>
                    </button>
                    <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[11px] text-ink/45">
                            {s.author}
                            {s.at ? ` · ${when(s.at)}` : ""}
                        </span>
                        {canResolve && editor && (
                            <span className="flex gap-1">
                                <button type="button" onClick={() => resolveSuggestion(editor, true, s.id)} className={`${btn} bg-leaf/25 text-[#2f6e14]`}>
                                    <Check className="h-3 w-3" /> Accepter
                                </button>
                                <button type="button" onClick={() => resolveSuggestion(editor, false, s.id)} className={`${btn} bg-red-50 text-red-700`}>
                                    <X className="h-3 w-3" /> Refuser
                                </button>
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ─── Versions ─── */

interface RevisionItem {
    id: string;
    kind: "session" | "step" | "restore";
    label: string;
    name: string;
    at: string;
    words: number;
    status: string | null;
    title: string;
}

/** Nombre de mots compté comme sur le serveur (lib/revisions) */
function wordsOf(doc: JSONContent): number {
    const parts: string[] = [];
    const walk = (n: JSONContent) => {
        if (n.text) parts.push(n.text);
        n.content?.forEach(walk);
        if (n.type && ["paragraph", "heading", "listItem", "taskItem", "tableCell", "tableHeader"].includes(n.type)) parts.push(" ");
    };
    walk(doc);
    return parts.join("").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
}

/** Ce qu'on compare : les modifications d'une séance (jusqu'à la version suivante) ou une version avec maintenant */
interface Comparison {
    from: RevisionItem;
    /** null : le texte actuel */
    to: RevisionItem | null;
    /** Modifications d'une personne (titre de la fenêtre) */
    by?: string;
}

/**
 * Qui a modifié quoi : chaque séance est l'état d'avant les modifications
 * d'une personne ; ses modifications vont jusqu'à la version suivante (ou
 * jusqu'à maintenant). Les étapes du circuit servent de repères.
 */
function Versions({ postId, editor, canRestore }: { postId: string; editor: Editor | null; canRestore: boolean }) {
    const [items, setItems] = useState<RevisionItem[] | null>(null);
    const [compare, setCompare] = useState<Comparison | null>(null);
    const [person, setPerson] = useState("");
    useEffect(() => {
        void fetch(`/api/posts/${postId}/revisions/`)
            .then((r) => r.json())
            .then((j) => setItems(j.success ? j.data : []));
    }, [postId]);
    const nowWords = useEditorState({ editor, selector: ({ editor: e }) => (e ? wordsOf(e.getJSON()) : 0) }) ?? 0;
    const people = useMemo(() => [...new Set((items ?? []).filter((r) => r.kind !== "step").map((r) => r.name))], [items]);

    if (items === null) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-ink/30" />;
    if (!items.length) return <p className="py-4 text-center text-sm text-ink/45">Pas encore de version enregistrée. Une version est gardée à chaque étape et à chaque séance d&apos;écriture.</p>;
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 text-[11px] leading-snug text-ink/45">Séances d&apos;écriture gardées 30 jours, étapes du circuit gardées pour toujours.</p>
                {people.length > 1 && (
                    <select value={person} onChange={(e) => setPerson(e.target.value)} className="rounded-full border border-ink/10 bg-white px-2 py-1 text-xs" aria-label="Filtrer par personne">
                        <option value="">Tout le monde</option>
                        {people.map((p) => (
                            <option key={p}>{p}</option>
                        ))}
                    </select>
                )}
            </div>
            {items.map((r, i) => {
                // Liste du plus récent au plus ancien : la version suivante est juste au-dessus
                const next = i > 0 ? items[i - 1] : null;
                if (person && (r.kind === "step" || r.name !== person)) return null;
                if (r.kind === "step") {
                    return (
                        <div key={r.id} className="flex items-center gap-2 rounded-2xl bg-paper2 px-3 py-2 text-xs text-ink/60">
                            <Flag className="h-3.5 w-3.5 shrink-0 text-accent" />
                            <span className="min-w-0 flex-1 truncate">
                                <b className="text-ink/80">{r.label}</b> · {r.name} · {when(r.at)}
                            </span>
                            <button type="button" onClick={() => setCompare({ from: r, to: null })} className="shrink-0 font-semibold hover:underline" disabled={!editor}>
                                Comparer
                            </button>
                        </div>
                    );
                }
                const delta = (next?.words ?? nowWords) - r.words;
                return (
                    <div key={r.id} className="rounded-2xl border border-ink/10 bg-white p-3 text-sm">
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4 shrink-0 text-ink/35" />
                            <span className="min-w-0 flex-1 truncate">
                                <b>{r.name}</b> {r.kind === "restore" ? "a remis une ancienne version" : "a modifié"}
                            </span>
                            {delta !== 0 && <span className={`shrink-0 text-[11px] font-semibold ${delta > 0 ? "text-[#2f6e14]" : "text-red-600"}`}>{delta > 0 ? `+${delta}` : delta} mots</span>}
                        </div>
                        <div className="mt-0.5 text-[11px] text-ink/45">
                            {when(r.at)}
                            {next ? ` → ${when(next.at)}` : " → maintenant"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            <button type="button" onClick={() => setCompare({ from: r, to: next, by: r.name })} className={`${btn} bg-ink text-white`} disabled={!editor}>
                                <Eye className="h-3 w-3" /> Voir ses modifications
                            </button>
                            {next && (
                                <button type="button" onClick={() => setCompare({ from: r, to: null })} className={`${btn} bg-paper2 text-ink/70`} disabled={!editor}>
                                    <GitCompare className="h-3 w-3" /> Comparer avec maintenant
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
            {compare && editor && <CompareModal postId={postId} cmp={compare} editor={editor} canRestore={canRestore} onClose={() => setCompare(null)} />}
        </div>
    );
}

function DiffLine({ parts }: { parts: DiffPart[] }) {
    return (
        <p className="leading-relaxed">
            {parts.map((p, i) =>
                p.kind === "same" ? (
                    <span key={i}>{p.text}</span>
                ) : p.kind === "added" ? (
                    <ins key={i} className="rounded bg-leaf/30 text-[#22560f] no-underline">
                        {p.text}
                    </ins>
                ) : (
                    <del key={i} className="rounded bg-red-100 text-red-700">
                        {p.text}
                    </del>
                )
            )}
        </p>
    );
}

type Loaded = { title: string; contentJson: unknown };
const loadRevision = (postId: string, id: string): Promise<Loaded | null> =>
    fetch(`/api/posts/${postId}/revisions/${id}/`)
        .then((r) => r.json())
        .then((j) => (j.success ? j.data : null));

function CompareModal({ postId, cmp, editor, canRestore, onClose }: { postId: string; cmp: Comparison; editor: Editor; canRestore: boolean; onClose: () => void }) {
    const { from, to, by } = cmp;
    const [pair, setPair] = useState<{ old: Loaded; next: Loaded | null } | null>(null);
    const [restoring, setRestoring] = useState(false);
    // Par défaut, seulement les passages modifiés : un long article se lit mal en entier
    const [onlyChanges, setOnlyChanges] = useState(true);
    useEffect(() => {
        void Promise.all([loadRevision(postId, from.id), to ? loadRevision(postId, to.id) : null]).then(([old, next]) => old && setPair({ old, next }));
    }, [postId, from.id, to]);
    const titleInput = typeof document !== "undefined" ? (document.querySelector("textarea[aria-label=\"Titre de l'article\"]") as HTMLTextAreaElement | null) : null;
    const diff = useMemo(() => {
        if (!pair) return null;
        const after = pair.next ?? { title: titleInput?.value || "", contentJson: editor.getJSON() };
        return { title: diffWords(pair.old.title, after.title), blocks: diffBlocks(documentBlocks(pair.old.contentJson as never), documentBlocks(after.contentJson as never)) };
    }, [pair, editor, titleInput]);
    const isChanged = (b: DiffPart[]) => b.some((p) => p.kind !== "same");
    const changed = diff?.blocks.filter(isChanged).length ?? 0;

    const restore = async () => {
        if (!window.confirm("Remettre cette version ? Le texte actuel est gardé dans les versions, tu pourras y revenir.")) return;
        setRestoring(true);
        const j = await fetch(`/api/posts/${postId}/revisions/${from.id}/`, { method: "POST" }).then((r) => r.json());
        if (j.success) window.location.reload();
        else {
            setRestoring(false);
            window.alert(j.error);
        }
    };

    // Rendue à la racine du document : le panneau latéral défile et ne doit pas contenir la fenêtre
    return createPortal(
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label="Comparer deux versions" onClick={onClose}>
            <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 border-b border-ink/10 px-6 py-4">
                    <div className="min-w-0 flex-1">
                        <h2 className="font-display text-2xl">{by ? `Modifications de ${by}` : "Comparer"}</h2>
                        <p className="text-xs text-ink/55">
                            {by ? when(from.at) : `« ${from.label} » (${when(from.at)})`} → {to ? when(to.at) : "maintenant"} · <del className="bg-red-100 px-1 text-red-700">retiré</del>{" "}
                            <ins className="bg-leaf/30 px-1 text-[#22560f] no-underline">ajouté</ins>
                        </p>
                    </div>
                    {canRestore && (
                        <button type="button" onClick={restore} disabled={restoring} className="btn-ghost px-3.5 py-2 text-sm" title={by ? `Remettre le texte d'avant les modifications de ${by}` : undefined}>
                            {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} {by ? "Revenir avant" : "Restaurer cette version"}
                        </button>
                    )}
                    <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper2" aria-label="Fermer">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white px-8 py-6 text-[15px]">
                    {!diff ? (
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-ink/30" />
                    ) : (
                        <>
                            {(!onlyChanges || isChanged(diff.title)) && (
                                <div className="font-display text-2xl">
                                    <DiffLine parts={diff.title} />
                                </div>
                            )}
                            {changed === 0 ? (
                                <p className="rounded-xl bg-paper2 px-3 py-2 text-sm text-ink/60">{to ? "Le texte n'a pas changé pendant cette séance (seulement les réglages, ou rien)." : "Le texte n'a pas changé depuis cette version."}</p>
                            ) : (
                                <label className="flex items-center gap-2 text-xs text-ink/55">
                                    <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} />
                                    Seulement {changed > 1 ? `les ${changed} passages modifiés` : "le passage modifié"}
                                </label>
                            )}
                            {diff.blocks.map((b, i) =>
                                !onlyChanges || isChanged(b) ? (
                                    <div key={i}>
                                        {/* Passages sautés entre deux modifications */}
                                        {onlyChanges && i > 0 && !isChanged(diff.blocks[i - 1]) && <div className="mb-3 text-center text-xs tracking-[0.3em] text-ink/25">• • •</div>}
                                        <DiffLine parts={b} />
                                    </div>
                                ) : null
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

/* ─── Journal ─── */

function Journal({ workflow }: { workflow: WorkflowEntry[] }) {
    if (!workflow.length) return <p className="py-4 text-center text-sm text-ink/45">Rien pour l&apos;instant : l&apos;article n&apos;a pas encore été envoyé en correction.</p>;
    return (
        <ol className="relative space-y-3 border-l-2 border-ink/10 pl-4">
            {workflow.map((w, i) => (
                <li key={i} className="text-sm">
                    <span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-accent" />
                    <div className="text-[11px] text-ink/45">{when(w.at)}</div>
                    <div>{w.text}</div>
                    {w.reason && (
                        <p className="mt-1 flex gap-1.5 rounded-xl bg-paper2 px-3 py-2 text-xs text-ink/70">
                            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" /> {w.reason}
                        </p>
                    )}
                </li>
            ))}
        </ol>
    );
}
