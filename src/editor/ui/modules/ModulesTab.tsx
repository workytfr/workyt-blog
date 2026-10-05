"use client";

import { createContext, useContext, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { BookMarked, BookOpen, ChefHat, Cpu, Heart, HeartHandshake, MapPin, Pencil, Plus, Quote, ShoppingBag, Trash2, type LucideIcon } from "lucide-react";
import { emptyModule, MODULE_LABELS, MODULE_TYPES, moduleSummary, type ArticleModule, type ModuleImage, type ModuleType } from "@/lib/modules/types";
import ModuleForm, { type TeamMember } from "./ModuleForm";

export const MODULE_ICONS: Record<ModuleType, LucideIcon> = {
    recipe: ChefHat,
    techReview: Cpu,
    bookReview: BookOpen,
    productReview: ShoppingBag,
    favorite: Heart,
    guestFavorite: HeartHandshake,
    sources: BookMarked,
};

/** Modules de l'article, pour les vues d'édition (bloc « module », appel [n]) */
export const ModulesContext = createContext<ArticleModule[]>([]);
export const useModules = () => useContext(ModulesContext);

/** Emplacements des modules et appels de sources présents dans le texte */
function usePlacement(editor: Editor | null) {
    return (
        useEditorState({
            editor,
            selector: ({ editor: e }) => {
                const placed: string[] = [];
                const cited: string[] = [];
                e?.state.doc.descendants((n) => {
                    if (n.type.name === "moduleEmbed") placed.push(n.attrs.moduleId);
                    if (n.type.name === "sourceRef") cited.push(n.attrs.sourceId);
                });
                return { placed, cited };
            },
            equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
        }) ?? { placed: [], cited: [] }
    );
}

/** Retire du texte les emplacements d'un module (et les appels de ses sources) */
function removeFromText(editor: Editor, test: (node: { type: { name: string }; attrs: Record<string, unknown> }) => boolean) {
    const ranges: [number, number][] = [];
    editor.state.doc.descendants((n, pos) => {
        if (test(n)) ranges.push([pos, pos + n.nodeSize]);
    });
    if (!ranges.length) return;
    const tr = editor.state.tr;
    for (const [from, to] of ranges.reverse()) tr.delete(from, to);
    editor.view.dispatch(tr);
}

/**
 * Onglet « Modules » : ajouter un module, le modifier, le placer dans le
 * texte (sinon il s'affiche à la fin), citer une source.
 */
export default function ModulesTab({
    editor,
    modules,
    onChange,
    pickImage,
    team,
    readOnly,
}: {
    editor: Editor | null;
    modules: ArticleModule[];
    onChange: (m: ArticleModule[]) => void;
    pickImage: () => Promise<ModuleImage | null>;
    team: TeamMember[];
    readOnly: boolean;
}) {
    const [editing, setEditing] = useState<ArticleModule | null>(null);
    const [adding, setAdding] = useState(false);
    const { placed, cited } = usePlacement(editor);

    const save = (m: ArticleModule) => onChange(modules.some((x) => x.id === m.id) ? modules.map((x) => (x.id === m.id ? m : x)) : [...modules, m]);
    const remove = (m: ArticleModule) => {
        if (!window.confirm(`Retirer le module « ${MODULE_LABELS[m.type].label} » de l'article ?`)) return;
        if (editor) {
            const sourceIds = new Set(m.type === "sources" ? m.data.items.map((s) => s.id) : []);
            removeFromText(editor, (n) => (n.type.name === "moduleEmbed" && n.attrs.moduleId === m.id) || (n.type.name === "sourceRef" && sourceIds.has(String(n.attrs.sourceId))));
        }
        onChange(modules.filter((x) => x.id !== m.id));
    };
    const place = (m: ArticleModule) => {
        if (!editor) return;
        // Juste après le bloc où se trouve le curseur
        const { $from } = editor.state.selection;
        const at = $from.depth ? $from.after(1) : editor.state.doc.content.size;
        editor.chain().focus().insertContentAt(at, { type: "moduleEmbed", attrs: { moduleId: m.id } }).run();
    };
    const cite = (sourceId: string) => editor?.chain().focus().insertContent({ type: "sourceRef", attrs: { sourceId } }).run();

    return (
        <div className="space-y-3">
            {modules.length === 0 && <p className="rounded-2xl border border-dashed border-ink/15 bg-white p-4 text-sm text-ink/55">Recette, avis, coup de cœur, sources : chaque module a sa mise en page dans l&apos;article et son balisage pour Google.</p>}

            {modules.map((m) => {
                const Icon = MODULE_ICONS[m.type];
                const isPlaced = placed.includes(m.id);
                return (
                    <div key={m.id} className="rounded-2xl border border-ink/10 bg-white p-3">
                        <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accentdark">
                                <Icon className="h-[18px] w-[18px]" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold">{MODULE_LABELS[m.type].label}</p>
                                <p className="truncate text-xs text-ink/55">{moduleSummary(m)}</p>
                            </div>
                            {!readOnly && (
                                <>
                                    <button type="button" onClick={() => setEditing(m)} className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 hover:bg-paper2 hover:text-ink" title="Modifier" aria-label="Modifier">
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button type="button" onClick={() => remove(m)} className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 hover:bg-red-50 hover:text-red-700" title="Retirer" aria-label="Retirer">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </>
                            )}
                        </div>
                        {m.type === "guestFavorite" && m.data.guest && (
                            <p className={`mt-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${m.data.status === "validated" ? "bg-leaf/20 text-[#2f6e14]" : "bg-sun/25 text-[#8a560a]"}`}>
                                {m.data.status === "validated" ? `${m.data.guest.name} a validé son texte.` : `Invitation envoyée à ${m.data.guest.name} : en attente de son texte.`}
                            </p>
                        )}
                        {m.type !== "sources" && !readOnly && (
                            <div className="mt-2 flex items-center gap-2 text-[11px]">
                                {isPlaced ? (
                                    <>
                                        <span className="inline-flex items-center gap-1 font-semibold text-[#2f6e14]">
                                            <MapPin className="h-3 w-3" /> Placé dans le texte
                                        </span>
                                        <button type="button" onClick={() => editor && removeFromText(editor, (n) => n.type.name === "moduleEmbed" && n.attrs.moduleId === m.id)} className="text-ink/45 underline">
                                            remettre à la fin
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-ink/45">À la fin de l&apos;article ·</span>
                                        <button type="button" onClick={() => place(m)} className="font-semibold text-accentdark underline">
                                            placer sous le curseur
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                        {m.type === "sources" && m.data.items.length > 0 && (
                            <ol className="mt-2 space-y-1">
                                {m.data.items.map((s, i) => (
                                    <li key={s.id} className="flex items-center gap-2 text-xs">
                                        <span className="w-6 shrink-0 font-semibold text-accentdark">[{i + 1}]</span>
                                        <span className="min-w-0 flex-1 truncate">{s.title}</span>
                                        {cited.includes(s.id) && <span className="text-[10px] text-[#2f6e14]">cité</span>}
                                        {!readOnly && (
                                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cite(s.id)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-paper2 px-2 py-0.5 font-semibold hover:bg-accent/15" title="Insérer l'appel [n] à la place du curseur">
                                                <Quote className="h-3 w-3" /> Citer
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                );
            })}

            {!readOnly &&
                (adding ? (
                    <div className="grid grid-cols-2 gap-2">
                        {MODULE_TYPES.filter((t) => t !== "sources" || !modules.some((m) => m.type === "sources")).map((t) => {
                            const Icon = MODULE_ICONS[t];
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => {
                                        setAdding(false);
                                        setEditing(emptyModule(t));
                                    }}
                                    className="rounded-2xl border border-ink/10 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-accent"
                                >
                                    <Icon className="h-5 w-5 text-accent" />
                                    <span className="mt-1.5 block text-[13px] font-semibold leading-tight">{MODULE_LABELS[t].label}</span>
                                    <span className="mt-0.5 block text-[11px] leading-snug text-ink/50">{MODULE_LABELS[t].hint}</span>
                                </button>
                            );
                        })}
                        <button type="button" onClick={() => setAdding(false)} className="col-span-2 text-xs font-semibold text-ink/50 underline">
                            Annuler
                        </button>
                    </div>
                ) : (
                    <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-ink/20 py-3 text-sm font-semibold text-accentdark hover:border-accent">
                        <Plus className="h-4 w-4" /> Ajouter un module
                    </button>
                ))}

            {editing && <ModuleForm module={editing} onSave={save} onClose={() => setEditing(null)} pickImage={pickImage} team={team} />}
        </div>
    );
}
