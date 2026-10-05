"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Clock, Lock, Plus, X } from "lucide-react";
import {
    FAVORITE_KINDS,
    MODULE_LABELS,
    SOURCE_KINDS,
    criteriaAverage,
    newId,
    type ArticleModule,
    type BookReviewData,
    type FavoriteData,
    type GuestFavoriteData,
    type ModuleImage,
    type ProductReviewData,
    type RecipeData,
    type SourcesData,
    type TechReviewData,
} from "@/lib/modules/types";
import { Area, CriteriaInput, Field, IconBtn, ImageInput, LinkInput, Lines, Num, RowTools, ScoreInput, Select, Text, input, move } from "./fields";

export interface TeamMember {
    id: string;
    name: string;
}

type Pick = () => Promise<ModuleImage | null>;

/** Fenêtre d'édition d'un module : un formulaire par type */
export default function ModuleForm({ module, onSave, onClose, pickImage, team }: { module: ArticleModule; onSave: (m: ArticleModule) => void; onClose: () => void; pickImage: Pick; team: TeamMember[] }) {
    const [draft, setDraft] = useState<ArticleModule>(module);
    const set = (data: object) => setDraft((m) => ({ ...m, data: { ...m.data, ...data } }) as ArticleModule);

    return createPortal(
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label={MODULE_LABELS[module.type].label} onClick={onClose}>
            <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 border-b border-ink/10 px-6 py-4">
                    <div className="min-w-0 flex-1">
                        <h2 className="font-display text-2xl">{MODULE_LABELS[module.type].label}</h2>
                        <p className="text-xs text-ink/55">{MODULE_LABELS[module.type].hint}</p>
                    </div>
                    <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper2" aria-label="Fermer">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                    {draft.type === "recipe" && <RecipeForm d={draft.data} set={set} pick={pickImage} />}
                    {draft.type === "techReview" && <TechForm d={draft.data} set={set} pick={pickImage} />}
                    {draft.type === "bookReview" && <BookForm d={draft.data} set={set} pick={pickImage} />}
                    {draft.type === "productReview" && <ProductForm d={draft.data} set={set} pick={pickImage} />}
                    {draft.type === "favorite" && <FavoriteForm d={draft.data} set={set} pick={pickImage} />}
                    {draft.type === "guestFavorite" && <GuestForm d={draft.data} set={set} pick={pickImage} team={team} />}
                    {draft.type === "sources" && <SourcesForm d={draft.data} set={set} />}
                </div>
                <div className="flex justify-end gap-2 border-t border-ink/10 px-6 py-4">
                    <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
                        Annuler
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onSave(draft);
                            onClose();
                        }}
                        className="btn-orange px-5 py-2 text-sm"
                    >
                        Enregistrer le module
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

const grid2 = "grid gap-3 sm:grid-cols-2";
const grid3 = "grid gap-3 sm:grid-cols-3";
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <fieldset className="space-y-3 rounded-2xl border border-ink/10 bg-white p-4">
        <legend className="px-1 font-display text-lg">{title}</legend>
        {children}
    </fieldset>
);

/* ─── Recette ─── */

function RecipeForm({ d, set, pick }: { d: RecipeData; set: (p: Partial<RecipeData>) => void; pick: Pick }) {
    const groups = d.ingredientGroups;
    const setGroup = (gi: number, patch: Partial<RecipeData["ingredientGroups"][number]>) => set({ ingredientGroups: groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)) });
    return (
        <>
            <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
                <div className="space-y-3">
                    <Field label="Nom de la recette *">
                        <Text value={d.name} onChange={(name) => set({ name })} placeholder="Crêpes de la Chandeleur" />
                    </Field>
                    <Field label="Présentation">
                        <Area value={d.description} onChange={(description) => set({ description })} rows={2} placeholder="Une phrase pour donner envie" />
                    </Field>
                </div>
                <ImageInput label="Photo du plat *" value={d.image} onChange={(image) => set({ image })} pickImage={pick} />
            </div>
            <div className={grid3}>
                <Field label="Portions">
                    <Num value={d.servings} onChange={(servings) => set({ servings: Math.max(1, servings) })} min={1} max={100} />
                </Field>
                <Field label="Difficulté">
                    <Select value={d.difficulty} onChange={(difficulty) => set({ difficulty })} options={[["", "—"], ["facile", "Facile"], ["moyen", "Moyen"], ["difficile", "Difficile"]] as const} />
                </Field>
                <Field label="Coût">
                    <Select value={d.cost} onChange={(cost) => set({ cost })} options={[["", "—"], ["€", "€ bon marché"], ["€€", "€€ moyen"], ["€€€", "€€€ cher"]] as const} />
                </Field>
                <Field label="Préparation">
                    <Num value={d.prepMinutes} onChange={(prepMinutes) => set({ prepMinutes })} suffix="min" />
                </Field>
                <Field label="Cuisson">
                    <Num value={d.cookMinutes} onChange={(cookMinutes) => set({ cookMinutes })} suffix="min" />
                </Field>
                <Field label="Repos">
                    <Num value={d.restMinutes} onChange={(restMinutes) => set({ restMinutes })} suffix="min" />
                </Field>
            </div>

            <Section title="Ingrédients *">
                {groups.map((g, gi) => (
                    <div key={gi} className="space-y-2 rounded-xl bg-paper p-3">
                        <div className="flex items-center gap-2">
                            <input value={g.title} onChange={(e) => setGroup(gi, { title: e.target.value })} placeholder="Groupe (facultatif : « Pour la pâte »)" className={`${input} font-semibold`} />
                            {groups.length > 1 && (
                                <IconBtn label="Retirer le groupe" onClick={() => set({ ingredientGroups: groups.filter((_, i) => i !== gi) })}>
                                    <X className="h-4 w-4" />
                                </IconBtn>
                            )}
                        </div>
                        {g.items.map((it, ii) => (
                            <div key={ii} className="flex items-center gap-1.5">
                                <input value={it.qty} onChange={(e) => setGroup(gi, { items: g.items.map((x, j) => (j === ii ? { ...x, qty: e.target.value } : x)) })} placeholder="250" className={`${input} w-16`} />
                                <input value={it.unit} onChange={(e) => setGroup(gi, { items: g.items.map((x, j) => (j === ii ? { ...x, unit: e.target.value } : x)) })} placeholder="g" className={`${input} w-20`} />
                                <input value={it.name} onChange={(e) => setGroup(gi, { items: g.items.map((x, j) => (j === ii ? { ...x, name: e.target.value } : x)) })} placeholder="farine" className={input} />
                                <RowTools index={ii} count={g.items.length} onMove={(to) => setGroup(gi, { items: move(g.items, ii, to) })} onRemove={() => setGroup(gi, { items: g.items.filter((_, j) => j !== ii) })} />
                            </div>
                        ))}
                        <button type="button" onClick={() => setGroup(gi, { items: [...g.items, { qty: "", unit: "", name: "" }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-accentdark">
                            <Plus className="h-3.5 w-3.5" /> Ingrédient
                        </button>
                    </div>
                ))}
                <button type="button" onClick={() => set({ ingredientGroups: [...groups, { title: "", items: [{ qty: "", unit: "", name: "" }] }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-ink/60">
                    <Plus className="h-3.5 w-3.5" /> Groupe d&apos;ingrédients
                </button>
                <p className="text-[11px] text-ink/45">Les quantités en chiffres (250, 1/2, 1,5) suivent le nombre de portions choisi par le lecteur.</p>
            </Section>

            <Section title="Étapes *">
                {d.steps.map((s, i) => (
                    <div key={i} className="flex gap-2">
                        <span className="mt-2 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">{i + 1}</span>
                        <div className="min-w-0 flex-1 space-y-2">
                            <Area value={s.text} onChange={(text) => set({ steps: d.steps.map((x, j) => (j === i ? { ...x, text } : x)) })} rows={2} placeholder="Dans un saladier, mélanger…" />
                            {s.image ? (
                                <div className="w-48">
                                    <ImageInput value={s.image} onChange={(image) => set({ steps: d.steps.map((x, j) => (j === i ? { ...x, image } : x)) })} pickImage={pick} label="Photo de l'étape" aspect="aspect-[16/10]" />
                                </div>
                            ) : (
                                <button type="button" onClick={async () => { const image = await pick(); if (image) set({ steps: d.steps.map((x, j) => (j === i ? { ...x, image } : x)) }); }} className="text-[11px] font-semibold text-ink/50 underline">
                                    + Photo de l&apos;étape
                                </button>
                            )}
                        </div>
                        <RowTools index={i} count={d.steps.length} onMove={(to) => set({ steps: move(d.steps, i, to) })} onRemove={() => set({ steps: d.steps.filter((_, j) => j !== i) })} />
                    </div>
                ))}
                <button type="button" onClick={() => set({ steps: [...d.steps, { text: "", image: null }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-accentdark">
                    <Plus className="h-3.5 w-3.5" /> Étape
                </button>
            </Section>

            <div className={grid2}>
                <Field label="Ustensiles" group>
                    <Lines value={d.tools} onChange={(tools) => set({ tools })} placeholder="Une poêle, un fouet…" />
                </Field>
                <Field label="Régimes" group hint="végétarien, végétalien, sans gluten, halal… (repris par Google)">
                    <Lines value={d.diets} onChange={(diets) => set({ diets })} placeholder="végétarien" max={8} />
                </Field>
            </div>
            <Field label="Astuce">
                <Area value={d.tips} onChange={(tips) => set({ tips })} rows={2} placeholder="Laisser reposer la pâte une heure : les crêpes seront plus fines." />
            </Field>
            <Section title="Valeurs nutritionnelles (par portion, facultatif)">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {(
                        [
                            ["calories", "Calories (kcal)"],
                            ["proteins", "Protéines (g)"],
                            ["carbs", "Glucides (g)"],
                            ["fats", "Lipides (g)"],
                        ] as const
                    ).map(([k, l]) => (
                        <Field key={k} label={l}>
                            <Text value={d.nutrition[k]} onChange={(v) => set({ nutrition: { ...d.nutrition, [k]: v } })} />
                        </Field>
                    ))}
                </div>
            </Section>
        </>
    );
}

/* ─── Avis tech ─── */

function TechForm({ d, set, pick }: { d: TechReviewData; set: (p: Partial<TechReviewData>) => void; pick: Pick }) {
    return (
        <>
            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                <div className="space-y-3">
                    <Field label="Produit *">
                        <Text value={d.product} onChange={(product) => set({ product })} placeholder="Tablette Galaxy Tab S9" />
                    </Field>
                    <div className={grid3}>
                        <Field label="Marque">
                            <Text value={d.brand} onChange={(brand) => set({ brand })} />
                        </Field>
                        <Field label="Modèle">
                            <Text value={d.model} onChange={(model) => set({ model })} />
                        </Field>
                        <Field label="Prix constaté">
                            <Text value={d.price} onChange={(price) => set({ price })} placeholder="499 €" />
                        </Field>
                    </div>
                </div>
                <ImageInput value={d.image} onChange={(image) => set({ image })} pickImage={pick} aspect="aspect-square" />
            </div>
            <Field label="Note globale *" group>
                <ScoreInput value={d.score} onChange={(score) => set({ score })} max={10} criteria={d.criteria} />
            </Field>
            <Section title="Critères notés">
                <CriteriaInput value={d.criteria} onChange={(criteria) => set({ criteria, score: criteriaAverage(criteria) ?? d.score })} max={10} />
            </Section>
            <div className={grid2}>
                <Field label="Points forts" group>
                    <Lines value={d.pros} onChange={(pros) => set({ pros })} placeholder="Écran superbe" />
                </Field>
                <Field label="Points faibles" group>
                    <Lines value={d.cons} onChange={(cons) => set({ cons })} placeholder="Stylet vendu à part" />
                </Field>
            </div>
            <Field label="Verdict">
                <Area value={d.verdict} onChange={(verdict) => set({ verdict })} rows={3} placeholder="Pour qui ? Ça vaut le coup ?" />
            </Field>
            <Section title="Fiche technique">
                {d.specs.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <input value={s.key} onChange={(e) => set({ specs: d.specs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)) })} placeholder="Écran" className={`${input} w-40`} />
                        <input value={s.value} onChange={(e) => set({ specs: d.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} placeholder="11 pouces, 120 Hz" className={input} />
                        <RowTools index={i} count={d.specs.length} onMove={(to) => set({ specs: move(d.specs, i, to) })} onRemove={() => set({ specs: d.specs.filter((_, j) => j !== i) })} />
                    </div>
                ))}
                <button type="button" onClick={() => set({ specs: [...d.specs, { key: "", value: "" }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-accentdark">
                    <Plus className="h-3.5 w-3.5" /> Caractéristique
                </button>
            </Section>
        </>
    );
}

/* ─── Avis lecture ─── */

function BookForm({ d, set, pick }: { d: BookReviewData; set: (p: Partial<BookReviewData>) => void; pick: Pick }) {
    return (
        <>
            <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
                <div className="space-y-3">
                    <div className={grid2}>
                        <Field label="Titre *">
                            <Text value={d.title} onChange={(title) => set({ title })} />
                        </Field>
                        <Field label="Auteur(s) *">
                            <Text value={d.authors} onChange={(authors) => set({ authors })} placeholder="Albert Camus" />
                        </Field>
                        <Field label="Éditeur">
                            <Text value={d.publisher} onChange={(publisher) => set({ publisher })} />
                        </Field>
                        <Field label="Genre">
                            <Text value={d.genre} onChange={(genre) => set({ genre })} placeholder="Roman" />
                        </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Field label="Année">
                            <Text value={d.year} onChange={(year) => set({ year })} />
                        </Field>
                        <Field label="Pages">
                            <Text value={d.pages} onChange={(pages) => set({ pages })} />
                        </Field>
                        <Field label="ISBN" className="col-span-2">
                            <Text value={d.isbn} onChange={(isbn) => set({ isbn })} />
                        </Field>
                    </div>
                    <Field label="Pour qui ?">
                        <Text value={d.audience} onChange={(audience) => set({ audience })} placeholder="Dès la 3e, et pour le bac de français" />
                    </Field>
                </div>
                <ImageInput label="Couverture" value={d.image} onChange={(image) => set({ image })} pickImage={pick} aspect="aspect-[2/3]" />
            </div>
            <Field label="Note *" group>
                <ScoreInput value={d.score} onChange={(score) => set({ score })} max={5} criteria={d.criteria} />
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={d.favorite} onChange={(e) => set({ favorite: e.target.checked })} className="h-4 w-4 accent-[#ff6a1a]" /> C&apos;est un coup de cœur
            </label>
            <Field label="Résumé (sans spoiler !)">
                <Area value={d.summary} onChange={(summary) => set({ summary })} rows={4} />
            </Field>
            <Section title="Critères notés">
                <CriteriaInput value={d.criteria} onChange={(criteria) => set({ criteria, score: criteriaAverage(criteria) ?? d.score })} max={5} />
            </Section>
            <div className={grid2}>
                <Field label="On aime" group>
                    <Lines value={d.pros ?? []} onChange={(pros) => set({ pros })} placeholder="Une écriture simple et forte" />
                </Field>
                <Field label="On aime moins" group>
                    <Lines value={d.cons ?? []} onChange={(cons) => set({ cons })} placeholder="Un début un peu lent" />
                </Field>
            </div>
        </>
    );
}

/* ─── Avis produit ─── */

function ProductForm({ d, set, pick }: { d: ProductReviewData; set: (p: Partial<ProductReviewData>) => void; pick: Pick }) {
    return (
        <>
            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                <div className="space-y-3">
                    <Field label="Produit *">
                        <Text value={d.product} onChange={(product) => set({ product })} />
                    </Field>
                    <div className={grid2}>
                        <Field label="Prix">
                            <Text value={d.price} onChange={(price) => set({ price })} placeholder="79,99 €" />
                        </Field>
                        <Field label="Marchand">
                            <Text value={d.merchant} onChange={(merchant) => set({ merchant })} placeholder="Fnac" />
                        </Field>
                    </div>
                    <Field label="Lien marchand" group hint="Un lien affilié est marqué « sponsorisé » automatiquement, avec la mention de transparence.">
                        <LinkInput value={d.link} onChange={(link) => set({ link })} />
                    </Field>
                </div>
                <ImageInput value={d.image} onChange={(image) => set({ image })} pickImage={pick} aspect="aspect-square" />
            </div>
            <Field label="Note globale *" group>
                <ScoreInput value={d.score} onChange={(score) => set({ score })} max={10} criteria={d.criteria} />
            </Field>
            <Section title="Critères notés">
                <CriteriaInput value={d.criteria} onChange={(criteria) => set({ criteria, score: criteriaAverage(criteria) ?? d.score })} max={10} />
            </Section>
            <div className={grid2}>
                <Field label="Points forts" group>
                    <Lines value={d.pros} onChange={(pros) => set({ pros })} placeholder="Léger" />
                </Field>
                <Field label="Points faibles" group>
                    <Lines value={d.cons} onChange={(cons) => set({ cons })} placeholder="Fragile" />
                </Field>
            </div>
            <p className="text-[11px] text-ink/45">Avec plusieurs avis produit dans l&apos;article, un tableau comparatif s&apos;affiche automatiquement.</p>
        </>
    );
}

/* ─── Coups de cœur ─── */

const KIND_OPTIONS = FAVORITE_KINDS.map((k) => [k, k.charAt(0).toUpperCase() + k.slice(1)] as const);

function FavoriteObject({ d, set, pick }: { d: FavoriteData; set: (p: Partial<FavoriteData>) => void; pick: Pick }) {
    return (
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <div className="space-y-3">
                <div className={grid2}>
                    <Field label="C'est…">
                        <Select value={d.kind} onChange={(kind) => set({ kind })} options={KIND_OPTIONS} />
                    </Field>
                    <Field label="Badge">
                        <Text value={d.badge} onChange={(badge) => set({ badge })} />
                    </Field>
                </div>
                <Field label="Nom *">
                    <Text value={d.name} onChange={(name) => set({ name })} placeholder="Le Petit Prince" />
                </Field>
                <Field label="Lien (facultatif)" group>
                    <LinkInput value={d.link} onChange={(link) => set({ link })} />
                </Field>
            </div>
            <ImageInput value={d.image} onChange={(image) => set({ image })} pickImage={pick} aspect="aspect-square" />
        </div>
    );
}

function FavoriteForm({ d, set, pick }: { d: FavoriteData; set: (p: Partial<FavoriteData>) => void; pick: Pick }) {
    return (
        <>
            <FavoriteObject d={d} set={set} pick={pick} />
            <Field label="Pourquoi on l'aime *" hint={`${d.why.length}/700 · 2 ou 3 phrases, signées par toi.`}>
                <Area value={d.why} onChange={(why) => set({ why })} rows={3} />
            </Field>
        </>
    );
}

function GuestForm({ d, set, pick, team }: { d: GuestFavoriteData; set: (p: Partial<GuestFavoriteData>) => void; pick: Pick; team: TeamMember[] }) {
    return (
        <>
            <Field label="Rédacteur invité *" hint="Il reçoit une invitation, écrit son texte et le valide. Tant qu'il ne l'a pas validé, l'article ne part pas en approbation.">
                <select
                    value={d.guest?.memberId ?? ""}
                    onChange={(e) => {
                        const m = team.find((t) => t.id === e.target.value);
                        set({ guest: m ? { memberId: m.id, name: m.name } : null });
                    }}
                    className={input}
                >
                    <option value="">Choisir dans la rédaction…</option>
                    {team.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name}
                        </option>
                    ))}
                </select>
            </Field>
            <FavoriteObject d={d} set={set} pick={pick} />
            <div className="rounded-2xl border border-ink/10 bg-white p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-ink/60">
                    <Lock className="h-3.5 w-3.5" /> Son texte (écrit par {d.guest?.name ?? "l'invité"})
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${d.status === "validated" ? "bg-leaf/25 text-[#2f6e14]" : "bg-sun/30 text-[#8a560a]"}`}>
                        {d.status === "validated" ? "Validé" : d.guest ? "En attente" : "Pas encore invité"}
                    </span>
                </p>
                <p className="mt-2 text-sm italic text-ink/70">{d.why ? `« ${d.why} »` : <span className="inline-flex items-center gap-1.5 not-italic text-ink/45"><Clock className="h-3.5 w-3.5" /> Pas encore écrit.</span>}</p>
            </div>
        </>
    );
}

/* ─── Sources ─── */

function SourcesForm({ d, set }: { d: SourcesData; set: (p: Partial<SourcesData>) => void }) {
    const items = d.items;
    const up = (i: number, patch: Partial<SourcesData["items"][number]>) => set({ items: items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
    return (
        <>
            {items.map((s, i) => (
                <div key={s.id} className="space-y-2 rounded-2xl border border-ink/10 bg-white p-4">
                    <div className="flex items-center gap-2">
                        <span className="font-display text-lg text-accentdark">[{i + 1}]</span>
                        <select value={s.kind} onChange={(e) => up(i, { kind: e.target.value as (typeof SOURCE_KINDS)[number] })} className={`${input} w-32`}>
                            {SOURCE_KINDS.map((k) => (
                                <option key={k}>{k}</option>
                            ))}
                        </select>
                        <input value={s.title} onChange={(e) => up(i, { title: e.target.value })} placeholder="Titre *" className={input} />
                        <RowTools index={i} count={items.length} onMove={(to) => set({ items: move(items, i, to) })} onRemove={() => set({ items: items.filter((_, j) => j !== i) })} />
                    </div>
                    <div className={grid3}>
                        <input value={s.authors} onChange={(e) => up(i, { authors: e.target.value })} placeholder="Auteur(s)" className={input} />
                        <input value={s.publisher} onChange={(e) => up(i, { publisher: e.target.value })} placeholder="Éditeur / média" className={input} />
                        <input type="date" value={s.date} onChange={(e) => up(i, { date: e.target.value })} className={input} title="Date de publication" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
                        <input value={s.url} onChange={(e) => up(i, { url: e.target.value })} placeholder="https://…" className={input} />
                        <input type="date" value={s.accessed} onChange={(e) => up(i, { accessed: e.target.value })} className={input} title="Consulté le" />
                    </div>
                    <input value={s.quote} onChange={(e) => up(i, { quote: e.target.value })} placeholder="Citation (facultatif)" className={input} />
                </div>
            ))}
            <button
                type="button"
                onClick={() => set({ items: [...items, { id: newId(), kind: "site", title: "", authors: "", publisher: "", date: "", url: "", accessed: new Date().toISOString().slice(0, 10), quote: "" }] })}
                className="inline-flex items-center gap-1 text-sm font-semibold text-accentdark"
            >
                <Plus className="h-4 w-4" /> Ajouter une source
            </button>
            <p className="text-[11px] text-ink/45">Pour citer une source dans le texte, place le curseur puis « Citer » dans l&apos;onglet Modules : un appel [n] cliquable s&apos;insère.</p>
        </>
    );
}
