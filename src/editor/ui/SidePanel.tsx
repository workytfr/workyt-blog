"use client";

import { useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { AlignCenter, AlignLeft, AlignRight, Camera, ImagePlus, Star, X } from "lucide-react";
import { IMAGE_LICENSES, IMAGE_SOURCES, checkCredit } from "@/lib/licenses";
import SourceUrlInput from "./SourceUrlInput";
import { CALLOUT_VARIANTS } from "../nodes";
import type { EditorCategory } from "../types";

export interface PanelState {
    slug: string;
    excerpt: string;
    categories: string[];
    primaryCategory: string | null;
    tags: string[];
    featuredImage: { url: string; alt: string; credit: { author: string; source: string; license: string; sourceUrl: string } } | null;
    /** Image à la une choisie dans la médiathèque pendant cette session (à enregistrer) */
    featuredMediaId?: string;
    seo: { title: string; description: string; focusKeywords: string[]; noindex: boolean };
    /** Contenu pilier : l'assistant propose des liens vers lui depuis les autres articles */
    isPillar: boolean;
}

const field = "w-full rounded-xl border border-ink/12 border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent";
const lbl = "text-xs font-semibold text-ink/60";

export type PanelTab = "article" | "seo" | "bloc" | "modules" | "relecture";

/** Panneau latéral de l'éditeur : Article, SEO, Bloc, Modules, Relecture */
export default function SidePanel({
    editor,
    state,
    categories,
    authors,
    onChange,
    onPickFeatured,
    onReplaceImage,
    words,
    title,
    tab,
    onTab,
    review,
    reviewBadge,
    readOnly,
    modulesTab,
    modulesCount,
    seoAssistant,
}: {
    editor: Editor | null;
    state: PanelState;
    categories: EditorCategory[];
    authors: string[];
    onChange: (patch: Partial<PanelState>, field: string) => void;
    onPickFeatured: () => void;
    onReplaceImage: () => void;
    words: number;
    title: string;
    tab: PanelTab;
    onTab: (t: PanelTab) => void;
    /** Contenu de l'onglet Relecture */
    review: React.ReactNode;
    reviewBadge: number;
    /** Contenu de l'onglet Modules */
    modulesTab: React.ReactNode;
    modulesCount: number;
    /** Assistant SEO (note, critères, suggestions), en tête de l'onglet SEO */
    seoAssistant: React.ReactNode;
    /** Champs verrouillés (lecture, correction en mode suggestion, main prise par un autre) */
    readOnly: boolean;
}) {
    const setTab = onTab;
    return (
        <aside className="flex w-[360px] shrink-0 flex-col border-r border-ink/10 bg-paper">
            <div className="border-b border-ink/10 px-5 pb-4 pt-5">
                <p className="eyebrow">Rédaction</p>
                <p className="mt-1 text-sm text-ink/55">
                    {words} mot{words > 1 ? "s" : ""} · {Math.max(1, Math.round(words / 220))} min de lecture
                </p>
                <div className="mt-3 flex gap-1 rounded-full border border-ink/10 bg-white p-1" role="tablist">
                    {(
                        [
                            ["article", "Article"],
                            ["seo", "SEO"],
                            ["bloc", "Bloc"],
                            ["modules", "Modules"],
                            ["relecture", "Relecture"],
                        ] as const
                    ).map(([id, label]) => (
                        <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`relative flex-1 rounded-full py-1.5 text-[11px] font-semibold ${tab === id ? "bg-ink text-white" : "text-ink/60"}`}>
                            {label}
                            {id === "modules" && modulesCount > 0 && <span className="absolute -right-1 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-sky px-1 text-[9px] text-white">{modulesCount}</span>}
                            {id === "relecture" && reviewBadge > 0 && <span className="absolute -right-1 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] text-white">{reviewBadge}</span>}
                        </button>
                    ))}
                </div>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                {tab === "relecture" ? (
                    review
                ) : tab === "modules" ? (
                    modulesTab
                ) : (
                    <>
                    {tab === "seo" && seoAssistant}
                    <fieldset disabled={readOnly} className="min-w-0 space-y-5 disabled:opacity-70">
                        {tab === "article" && <ArticleTab state={state} categories={categories} authors={authors} onChange={onChange} onPickFeatured={onPickFeatured} />}
                        {tab === "seo" && <SeoTab state={state} onChange={onChange} title={title} />}
                        {tab === "bloc" && <BlockTab editor={editor} onReplaceImage={onReplaceImage} />}
                    </fieldset>
                    </>
                )}
            </div>
        </aside>
    );
}

function ArticleTab({ state, categories, authors, onChange, onPickFeatured }: { state: PanelState; categories: EditorCategory[]; authors: string[]; onChange: (p: Partial<PanelState>, f: string) => void; onPickFeatured: () => void }) {
    const [tagDraft, setTagDraft] = useState("");
    const top = categories.filter((c) => !c.parentId);
    const toggleCat = (id: string) => {
        const has = state.categories.includes(id);
        const next = has ? state.categories.filter((c) => c !== id) : [...state.categories, id];
        const primary = has && state.primaryCategory === id ? next[0] ?? null : state.primaryCategory ?? (has ? null : id);
        onChange({ categories: next, primaryCategory: primary }, "categories");
    };
    const addTag = () => {
        const t = tagDraft.trim();
        if (t && !state.tags.includes(t)) onChange({ tags: [...state.tags, t] }, "tags");
        setTagDraft("");
    };
    const img = state.featuredImage;

    return (
        <>
            <div>
                <span className={lbl}>Image à la une</span>
                {img ? (
                    <div className="mt-2 overflow-hidden rounded-2xl border border-ink/10 bg-white">
                        <div className="relative aspect-[16/9] bg-paper2">
                            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu */}
                            <img src={img.url} alt={img.alt} className="h-full w-full object-cover" />
                            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-paper/95 px-2.5 py-1 text-[10px] font-semibold">
                                <Camera className="h-3 w-3 text-accent" /> {img.credit.author} · {img.credit.source}
                            </span>
                        </div>
                        <label className="block px-3 pt-2.5">
                            <span className="text-[11px] font-semibold text-ink/60">Texte alternatif *</span>
                            <input
                                id="featured-alt"
                                value={img.alt || ""}
                                onChange={(e) => onChange({ featuredImage: { ...img, alt: e.target.value } }, "featuredAlt")}
                                placeholder="Décris l'image pour les lecteurs malvoyants"
                                className={`${field} mt-1 ${img.alt?.trim() ? "" : "border-red-300 ring-2 ring-red-100"}`}
                            />
                        </label>
                        <div className="flex items-center gap-2 px-3 py-2 text-xs">
                            <button type="button" onClick={onPickFeatured} className="ml-auto shrink-0 font-semibold text-accentdark">
                                Changer
                            </button>
                            <button type="button" onClick={() => onChange({ featuredImage: null, featuredMediaId: undefined }, "featured")} className="shrink-0 text-ink/40 hover:text-red-600" aria-label="Retirer l'image à la une">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <button type="button" onClick={onPickFeatured} className="mt-2 grid aspect-[16/9] w-full place-items-center rounded-2xl border-2 border-dashed border-ink/15 bg-white text-sm text-ink/50 hover:border-accent">
                        <span className="text-center">
                            <ImagePlus className="mx-auto mb-1 h-6 w-6" />
                            Choisir l&apos;image à la une
                        </span>
                    </button>
                )}
            </div>

            <div>
                <span className={lbl}>Rubriques</span>
                <div className="mt-2 space-y-1 rounded-2xl border border-ink/10 bg-white p-2">
                    {top.map((c) => (
                        <div key={c.id}>
                            <CatRow cat={c} checked={state.categories.includes(c.id)} primary={state.primaryCategory === c.id} onToggle={toggleCat} onPrimary={(id) => onChange({ primaryCategory: id }, "categories")} />
                            {categories
                                .filter((k) => k.parentId === c.id)
                                .map((k) => (
                                    <div key={k.id} className="ml-5">
                                        <CatRow cat={k} checked={state.categories.includes(k.id)} primary={state.primaryCategory === k.id} onToggle={toggleCat} onPrimary={(id) => onChange({ primaryCategory: id }, "categories")} />
                                    </div>
                                ))}
                        </div>
                    ))}
                </div>
                <p className="mt-1.5 text-[11px] text-ink/45">★ rubrique principale : fil d&apos;Ariane et Google.</p>
            </div>

            <div>
                <span className={lbl}>Étiquettes</span>
                <div className="mt-2 flex flex-wrap gap-1.5 rounded-2xl border border-ink/10 bg-white p-2">
                    {state.tags.map((t) => (
                        <span key={t} className="chip">
                            {t}
                            <button type="button" onClick={() => onChange({ tags: state.tags.filter((x) => x !== t) }, "tags")} aria-label={`Retirer ${t}`}>
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                    <input
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                                e.preventDefault();
                                addTag();
                            }
                        }}
                        onBlur={addTag}
                        placeholder="Ajouter…"
                        className="min-w-24 flex-1 px-1 text-sm outline-none"
                    />
                </div>
            </div>

            <label className="block">
                <span className={lbl}>Extrait</span>
                <textarea value={state.excerpt} onChange={(e) => onChange({ excerpt: e.target.value.slice(0, 400) }, "excerpt")} rows={3} placeholder="Deux phrases qui donnent envie de lire (sinon, le début de l'article)." className={`${field} mt-2 resize-none`} />
            </label>

            <label className="block">
                <span className={lbl}>Adresse</span>
                <div className="mt-2 flex items-center rounded-xl border border-ink/15 bg-white px-3 text-sm focus-within:border-accent">
                    <span className="text-ink/40">blog.workyt.fr/</span>
                    <input id="post-slug" value={state.slug} onChange={(e) => onChange({ slug: e.target.value }, "slug")} className="min-w-0 flex-1 py-2 font-semibold outline-none" />
                    <span className="text-ink/40">/</span>
                </div>
                <span className="mt-1 block text-[11px] text-ink/45">Une fois l&apos;article publié, changer l&apos;adresse crée une redirection automatique.</span>
            </label>

            <div>
                <span className={lbl}>Auteurs</span>
                <p className="mt-1.5 text-sm">{authors.join(", ") || "—"}</p>
            </div>
        </>
    );
}

function CatRow({ cat, checked, primary, onToggle, onPrimary }: { cat: EditorCategory; checked: boolean; primary: boolean; onToggle: (id: string) => void; onPrimary: (id: string) => void }) {
    return (
        <div className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-paper">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={checked} onChange={() => onToggle(cat.id)} className="accent-[#ff6a1a]" />
                <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                <span className="truncate">{cat.name}</span>
            </label>
            {checked && (
                <button type="button" onClick={() => onPrimary(cat.id)} title="Rubrique principale" aria-pressed={primary}>
                    <Star className={`h-4 w-4 ${primary ? "fill-accent text-accent" : "text-ink/25 hover:text-ink/50"}`} />
                </button>
            )}
        </div>
    );
}

function SeoTab({ state, onChange, title }: { state: PanelState; onChange: (p: Partial<PanelState>, f: string) => void; title: string }) {
    const seo = state.seo;
    const set = (patch: Partial<PanelState["seo"]>) => onChange({ seo: { ...seo, ...patch } }, "seo");
    const shownTitle = `${seo.title || title || "Titre de l'article"} - Workyt`;
    const shownDesc = seo.description || state.excerpt || "La description affichée dans Google (sinon, l'extrait de l'article).";
    const counter = (n: number, min: number, max: number) => <span className={n === 0 ? "text-ink/40" : n < min || n > max ? "text-amber-700" : "text-[#3f8a1f]"}>{n} car.</span>;
    return (
        <>
            <div>
                <span className={lbl}>Mot-clé principal (puis secondaires)</span>
                <input
                    id="seo-keywords"
                    value={seo.focusKeywords.join(", ")}
                    onChange={(e) => set({ focusKeywords: e.target.value.split(",").map((k) => k.trimStart()).slice(0, 5) })}
                    placeholder="Ex. : bac de français, révisions"
                    className={`${field} mt-2`}
                />
            </div>
            <label className="block">
                <span className={`${lbl} flex justify-between`}>
                    Titre SEO {counter(shownTitle.length, 40, 60)}
                </span>
                <input id="seo-title" value={seo.title} onChange={(e) => set({ title: e.target.value })} placeholder={title || "Par défaut : le titre de l'article"} className={`${field} mt-2`} />
            </label>
            <label className="block">
                <span className={`${lbl} flex justify-between`}>
                    Description {counter(seo.description.length, 120, 160)}
                </span>
                <textarea id="seo-description" value={seo.description} onChange={(e) => set({ description: e.target.value })} rows={3} placeholder="Par défaut : l'extrait" className={`${field} mt-2 resize-none`} />
            </label>
            <div>
                <span className={lbl}>Aperçu Google</span>
                <div className="mt-2 rounded-2xl border border-ink/10 bg-white p-4">
                    <div className="text-xs text-ink/60">blog.workyt.fr › {state.slug}</div>
                    <div className="mt-1 text-[17px] leading-snug text-[#1a0dab]">{shownTitle}</div>
                    <div className="mt-1 line-clamp-2 text-[13px] text-ink/70">{shownDesc}</div>
                </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={seo.noindex} onChange={(e) => set({ noindex: e.target.checked })} className="accent-[#ff6a1a]" />
                Ne pas indexer cet article (noindex)
            </label>
            <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={state.isPillar} onChange={(e) => onChange({ isPillar: e.target.checked }, "pillar")} className="mt-0.5 accent-[#ff6a1a]" />
                <span>
                    Contenu pilier
                    <span className="block text-xs text-ink/50">Un article de référence : l&apos;assistant propose des liens vers lui depuis les autres articles du même sujet.</span>
                </span>
            </label>
        </>
    );
}

/** Réglages du bloc sélectionné : image (crédit, légende), encadré, alignement */
function BlockTab({ editor, onReplaceImage }: { editor: Editor | null; onReplaceImage: () => void }) {
    const s = useEditorState({
        editor,
        selector: ({ editor: e }) => {
            if (!e) return null;
            const sel = e.state.selection;
            const image = sel instanceof NodeSelection && sel.node.type.name === "image" ? (sel.node.attrs as Record<string, string>) : null;
            return {
                image,
                callout: e.isActive("callout") ? (e.getAttributes("callout").variant as string) : null,
                align: (["center", "right"].find((a) => e.isActive({ textAlign: a })) || "left") as string,
                textBlock: e.isActive("paragraph") || e.isActive("heading"),
            };
        },
    });
    if (!editor || !s) return null;

    if (s.image) {
        const a = s.image;
        const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => editor.chain().updateAttributes("image", { [k]: e.target.value }).run();
        const { errors } = checkCredit({ author: a.creditAuthor, source: a.creditSource, license: a.creditLicense, sourceUrl: a.creditUrl });
        return (
            <>
                <p className="font-semibold">Image</p>
                <label className="block">
                    <span className={lbl}>Texte alternatif *</span>
                    <input id="bloc-image-alt" value={a.alt || ""} onChange={set("alt")} className={`${field} mt-2`} />
                </label>
                <label className="block">
                    <span className={lbl}>Légende</span>
                    <input value={a.caption || ""} onChange={set("caption")} className={`${field} mt-2`} />
                </label>
                <div className={`rounded-2xl border bg-white p-3 ${errors.length ? "border-red-300 ring-2 ring-red-100" : "border-ink/10"}`}>
                    <p className="flex items-center gap-1.5 text-xs font-semibold">
                        <Camera className="h-3.5 w-3.5 text-accent" /> Source et droits *
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <input id="bloc-credit-author" value={a.creditAuthor || ""} onChange={set("creditAuthor")} placeholder="Auteur" className={field} />
                        <select value={a.creditSource || ""} onChange={set("creditSource")} className={field}>
                            <option value="">Provenance…</option>
                            {IMAGE_SOURCES.map((x) => (
                                <option key={x}>{x}</option>
                            ))}
                        </select>
                        <select value={a.creditLicense || ""} onChange={set("creditLicense")} className={`${field} col-span-2`}>
                            <option value="">Licence…</option>
                            {IMAGE_LICENSES.map((x) => (
                                <option key={x}>{x}</option>
                            ))}
                        </select>
                        <SourceUrlInput value={a.creditUrl || ""} onChange={(v) => editor.chain().updateAttributes("image", { creditUrl: v }).run()} className="col-span-2" />
                    </div>
                    {errors.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-[11px] text-red-700">
                            {errors.map((e) => (
                                <li key={e}>{e}</li>
                            ))}
                        </ul>
                    )}
                </div>
                <button type="button" onClick={onReplaceImage} className="btn-ghost w-full justify-center py-2 text-sm">
                    Remplacer par une image de la médiathèque
                </button>
            </>
        );
    }

    return (
        <>
            {s.callout && (
                <div>
                    <p className="font-semibold">Encadré</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {CALLOUT_VARIANTS.map((v) => (
                            <button key={v.id} type="button" onClick={() => editor.chain().focus().updateCalloutVariant(v.id).run()} className={`chip ${s.callout === v.id ? "!border-ink !bg-ink !text-white" : ""}`}>
                                {v.label}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={() => editor.chain().focus().lift("callout").run()} className="mt-3 text-xs font-semibold text-ink/50 underline">
                        Retirer l&apos;encadré
                    </button>
                </div>
            )}
            {s.textBlock && (
                <div>
                    <p className="font-semibold">Alignement</p>
                    <div className="mt-2 flex w-fit gap-1 rounded-full border border-ink/10 bg-white p-1">
                        {(
                            [
                                ["left", AlignLeft],
                                ["center", AlignCenter],
                                ["right", AlignRight],
                            ] as const
                        ).map(([a, Icon]) => (
                            <button key={a} type="button" onClick={() => editor.chain().focus().setTextAlign(a).run()} className={`grid h-8 w-8 place-items-center rounded-full ${s.align === a ? "bg-ink text-white" : "text-ink/60"}`} aria-label={`Aligner : ${a}`}>
                                <Icon className="h-4 w-4" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {!s.callout && !s.textBlock && <p className="text-sm text-ink/55">Sélectionne un bloc (clique une image, un encadré, un paragraphe) pour voir ses réglages.</p>}
        </>
    );
}
