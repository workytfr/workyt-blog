"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, GitMerge, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { CategoryRow, TagRow } from "@/lib/taxonomy";

const input = "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent";
const COLORS = ["#ff6a1a", "#6ec1e4", "#b48cf2", "#ffb547", "#7ed957", "#e5484d", "#1a1512"];
type Draft = Omit<CategoryRow, "id" | "count"> & { id: string | null };

export default function TaxonomyManager({ categories, tags }: { categories: CategoryRow[]; tags: TagRow[] }) {
    const router = useRouter();
    const [edit, setEdit] = useState<Draft | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const top = categories.filter((c) => !c.parentId);

    const call = async (url: string, method: string, body?: unknown) => {
        setBusy(true);
        setError(null);
        const j = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
        setBusy(false);
        if (!j.success) {
            setError(j.error);
            return false;
        }
        router.refresh();
        return true;
    };
    const openNew = (parentId: string | null = null) => setEdit({ id: null, slug: "", name: "", description: "", color: "#ff6a1a", parentId, order: 0, inMenu: true, seoTitle: "", seoDescription: "" });
    const save = async () => {
        if (!edit) return;
        if (await call(edit.id ? `/api/categories/${edit.id}/` : "/api/categories/", edit.id ? "PATCH" : "POST", edit)) setEdit(null);
    };

    const Row = ({ c, child }: { c: CategoryRow; child?: boolean }) => (
        <div className={`flex items-center gap-3 border-t border-ink/5 px-4 py-2.5 ${child ? "pl-10" : ""} ${edit?.id === c.id ? "bg-accent/[0.06]" : "hover:bg-paper"}`}>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
            <span className="min-w-0 flex-1">
                <span className="font-semibold">{c.name}</span>
                <span className="ml-2 font-mono text-xs text-ink/45">/category/{c.slug}/</span>
                {!c.inMenu && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-ink/45">
                        <EyeOff className="h-3 w-3" /> hors menu
                    </span>
                )}
            </span>
            <span className="rounded-full bg-paper2 px-2 py-0.5 text-xs text-ink/60">{c.count}</span>
            <button type="button" onClick={() => setEdit({ ...c })} className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 hover:bg-paper2" aria-label={`Modifier ${c.name}`}>
                <Pencil className="h-4 w-4" />
            </button>
            {!child && (
                <button type="button" onClick={() => openNew(c.id)} className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 hover:bg-paper2" title="Ajouter une sous-rubrique" aria-label={`Sous-rubrique de ${c.name}`}>
                    <Plus className="h-4 w-4" />
                </button>
            )}
        </div>
    );

    return (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
            <section>
                <div className="flex items-center justify-between">
                    <h2 className="font-display text-2xl">Rubriques</h2>
                    <button type="button" onClick={() => openNew()} className="btn-orange px-4 py-2 text-sm">
                        <Plus className="h-4 w-4" /> Nouvelle rubrique
                    </button>
                </div>
                <div className="mt-3 overflow-hidden rounded-[24px] border border-ink/10 bg-white text-sm">
                    {top.map((c) => (
                        <div key={c.id}>
                            <Row c={c} />
                            {categories
                                .filter((k) => k.parentId === c.id)
                                .map((k) => (
                                    <Row key={k.id} c={k} child />
                                ))}
                        </div>
                    ))}
                </div>

                <h2 className="mt-10 font-display text-2xl">Étiquettes</h2>
                <TagsTable tags={tags} call={call} />
            </section>

            <aside className="lg:sticky lg:top-20 lg:self-start">
                {edit ? (
                    <div className="space-y-3 rounded-[24px] border border-accent/30 bg-white p-5">
                        <div className="flex items-center">
                            <h3 className="flex-1 font-display text-xl">{edit.id ? "Modifier la rubrique" : edit.parentId ? "Nouvelle sous-rubrique" : "Nouvelle rubrique"}</h3>
                            <button type="button" onClick={() => setEdit(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper2" aria-label="Fermer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <label className="block text-xs font-semibold text-ink/60">
                            Nom *
                            <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={`${input} mt-1`} />
                        </label>
                        <label className="block text-xs font-semibold text-ink/60">
                            Adresse
                            <div className="mt-1 flex items-center rounded-xl border border-ink/15 bg-white px-3 text-sm">
                                <span className="text-ink/40">/category/</span>
                                <input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} placeholder="(tirée du nom)" className="min-w-0 flex-1 py-2 outline-none" />
                                <span className="text-ink/40">/</span>
                            </div>
                        </label>
                        <label className="block text-xs font-semibold text-ink/60">
                            Rubrique parente
                            <select value={edit.parentId ?? ""} onChange={(e) => setEdit({ ...edit, parentId: e.target.value || null })} className={`${input} mt-1`}>
                                <option value="">— Premier niveau —</option>
                                {top
                                    .filter((c) => c.id !== edit.id)
                                    .map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                            </select>
                        </label>
                        <div className="flex items-end gap-3">
                            <div className="text-xs font-semibold text-ink/60">
                                Couleur
                                <div className="mt-1 flex gap-1.5">
                                    {COLORS.map((c) => (
                                        <button key={c} type="button" onClick={() => setEdit({ ...edit, color: c })} className={`h-7 w-7 rounded-full ${edit.color === c ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: c }} aria-label={c} />
                                    ))}
                                </div>
                            </div>
                            <label className="w-20 text-xs font-semibold text-ink/60">
                                Ordre
                                <input type="number" value={edit.order} onChange={(e) => setEdit({ ...edit, order: Number(e.target.value) })} className={`${input} mt-1`} />
                            </label>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={edit.inMenu} onChange={(e) => setEdit({ ...edit, inMenu: e.target.checked })} className="accent-[#ff6a1a]" /> Dans le menu du blog
                        </label>
                        <label className="block text-xs font-semibold text-ink/60">
                            Description (en tête de la page de la rubrique)
                            <textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={2} className={`${input} mt-1 resize-y`} />
                        </label>
                        <label className="block text-xs font-semibold text-ink/60">
                            Titre SEO
                            <input value={edit.seoTitle} onChange={(e) => setEdit({ ...edit, seoTitle: e.target.value })} placeholder={edit.name} className={`${input} mt-1`} />
                        </label>
                        <label className="block text-xs font-semibold text-ink/60">
                            Description SEO
                            <textarea value={edit.seoDescription} onChange={(e) => setEdit({ ...edit, seoDescription: e.target.value })} rows={2} className={`${input} mt-1 resize-y`} />
                        </label>
                        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                        <div className="flex items-center gap-2">
                            {edit.id && (
                                <button type="button" disabled={busy} onClick={async () => window.confirm(`Supprimer la rubrique « ${edit.name} » ?`) && (await call(`/api/categories/${edit.id}/`, "DELETE")) && setEdit(null)} className="inline-flex items-center gap-1 text-sm font-semibold text-red-700">
                                    <Trash2 className="h-4 w-4" /> Supprimer
                                </button>
                            )}
                            <button type="button" disabled={busy} onClick={save} className="btn-orange ml-auto px-5 py-2 text-sm">
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="rounded-[24px] border border-dashed border-ink/15 p-6 text-sm text-ink/50">Choisis une rubrique pour la modifier, ou crée-en une nouvelle.</p>
                )}
            </aside>
        </div>
    );
}

function TagsTable({ tags, call }: { tags: TagRow[]; call: (url: string, method: string, body?: unknown) => Promise<boolean> }) {
    const [editing, setEditing] = useState<string | null>(null);
    const [draft, setDraft] = useState({ name: "", slug: "", description: "" });
    const [merging, setMerging] = useState<string | null>(null);
    if (!tags.length) return <p className="mt-3 rounded-[24px] border border-dashed border-ink/15 p-6 text-sm text-ink/50">Aucune étiquette : elles se créent dans l&apos;éditeur.</p>;
    return (
        <div className="mt-3 overflow-hidden rounded-[24px] border border-ink/10 bg-white text-sm">
            {tags.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center gap-3 border-t border-ink/5 px-4 py-2.5 first:border-t-0">
                    {editing === t.id ? (
                        <>
                            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`${input} w-40`} aria-label="Nom" />
                            <input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} className={`${input} w-40 font-mono text-xs`} aria-label="Adresse" />
                            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description" className={`${input} min-w-0 flex-1`} />
                            <button type="button" onClick={async () => (await call(`/api/tags/${t.id}/`, "PATCH", draft)) && setEditing(null)} className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white" aria-label="Enregistrer">
                                <Check className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => setEditing(null)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-paper2" aria-label="Annuler">
                                <X className="h-4 w-4" />
                            </button>
                        </>
                    ) : (
                        <>
                            <span className="min-w-0 flex-1">
                                <span className="font-semibold">#{t.name}</span>
                                <span className="ml-2 font-mono text-xs text-ink/45">/tag/{t.slug}/</span>
                            </span>
                            <span className="rounded-full bg-paper2 px-2 py-0.5 text-xs text-ink/60">{t.count}</span>
                            {merging === t.id ? (
                                <select
                                    autoFocus
                                    defaultValue=""
                                    onChange={async (e) => {
                                        const into = e.target.value;
                                        if (into && window.confirm(`Fusionner « ${t.name} » dans « ${tags.find((x) => x.id === into)?.name} » ?`)) await call(`/api/tags/${t.id}/`, "PATCH", { into });
                                        setMerging(null);
                                    }}
                                    className={`${input} w-44`}
                                >
                                    <option value="">Fusionner dans…</option>
                                    {tags
                                        .filter((x) => x.id !== t.id)
                                        .map((x) => (
                                            <option key={x.id} value={x.id}>
                                                {x.name}
                                            </option>
                                        ))}
                                </select>
                            ) : (
                                <button type="button" onClick={() => setMerging(t.id)} className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 hover:bg-paper2" title="Fusionner dans une autre étiquette" aria-label={`Fusionner ${t.name}`}>
                                    <GitMerge className="h-4 w-4" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setEditing(t.id);
                                    setDraft({ name: t.name, slug: t.slug, description: t.description });
                                }}
                                className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 hover:bg-paper2"
                                aria-label={`Modifier ${t.name}`}
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => window.confirm(`Supprimer l'étiquette « ${t.name} » ? Elle sera retirée des articles.`) && call(`/api/tags/${t.id}/`, "DELETE")} className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 hover:bg-red-50 hover:text-red-700" aria-label={`Supprimer ${t.name}`}>
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}
