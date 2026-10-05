"use client";

import { useState } from "react";
import { ChefHat, Clock, Euro, Flame, Gauge, Lightbulb, Minus, Plus, Printer, Timer, Utensils } from "lucide-react";
import type { RecipeData } from "@/lib/modules/types";
import ModuleImage from "./ModuleImage";

/** « 1/2 », « 1,5 », « 250 » → nombre ; sinon null (« une pincée ») */
function parseQty(q: string): number | null {
    const s = q.trim().replace(",", ".");
    const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (frac) return Number(frac[1]) / Number(frac[2]);
    const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}
/** Quantité ajustée, arrondie comme dans une recette : 233 g → 235 g, 0,58 → ½ */
function scaleQty(q: string, factor: number): string {
    const n = parseQty(q);
    if (n === null || factor === 1) return q;
    const v = n * factor;
    if (v >= 100) return String(Math.round(v / 5) * 5);
    if (v >= 10) return String(Math.round(v));
    const quarters = Math.round(v * 4) / 4;
    const whole = Math.floor(quarters);
    const frac = { 0: "", 0.25: "¼", 0.5: "½", 0.75: "¾" }[quarters - whole as 0 | 0.25 | 0.5 | 0.75];
    if (quarters === 0) return (Math.round(v * 10) / 10).toString().replace(".", ",");
    return whole ? `${whole}${frac}` : frac || "0";
}
const duration = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}` : `${m} min`);

/**
 * Carte recette (§ 9) : portions ajustables, ingrédients à cocher, étapes,
 * bouton « Imprimer la recette » (seule la carte est imprimée).
 */
export default function RecipeCard({ data }: { data: RecipeData }) {
    const [servings, setServings] = useState(data.servings);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const factor = servings / data.servings;
    const total = data.prepMinutes + data.cookMinutes + data.restMinutes;
    const times = [
        { icon: Timer, label: "Préparation", value: data.prepMinutes },
        { icon: Flame, label: "Cuisson", value: data.cookMinutes },
        { icon: Clock, label: "Repos", value: data.restMinutes },
        { icon: Clock, label: "Total", value: total },
    ].filter((t) => t.value > 0);
    const toggle = (k: string) =>
        setChecked((s) => {
            const n = new Set(s);
            if (n.has(k)) n.delete(k);
            else n.add(k);
            return n;
        });

    return (
        <section className="wk-recipe not-prose my-10 overflow-hidden rounded-[30px] border border-ink/10 bg-white" aria-label={`Recette : ${data.name}`}>
            <div className="grid gap-0 md:grid-cols-[1fr_1.1fr]">
                {data.image && <ModuleImage image={data.image} rounded="" className="aspect-[4/3] md:aspect-auto md:h-full" />}
                <div className="p-6 sm:p-7">
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-accentdark">
                        <ChefHat className="h-3.5 w-3.5" /> Recette
                    </p>
                    <h3 className="mt-3 font-display text-[30px] leading-[1.05]">{data.name}</h3>
                    {data.description && <p className="mt-2 text-[15px] leading-relaxed text-ink/65">{data.description}</p>}
                    <div className="mt-5 flex flex-wrap gap-2">
                        {times.map((t) => (
                            <span key={t.label} className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-xs">
                                <t.icon className="h-3.5 w-3.5 text-accent" /> {t.label} <b>{duration(t.value)}</b>
                            </span>
                        ))}
                        {data.difficulty && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-xs">
                                <Gauge className="h-3.5 w-3.5 text-accent" /> <b className="capitalize">{data.difficulty}</b>
                            </span>
                        )}
                        {data.cost && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-xs">
                                <Euro className="h-3.5 w-3.5 text-accent" /> Coût <b>{data.cost}</b>
                            </span>
                        )}
                        {data.diets.map((d) => (
                            <span key={d} className="rounded-full bg-leaf/20 px-3 py-1.5 text-xs font-semibold text-[#2f6e14]">
                                {d}
                            </span>
                        ))}
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        <div className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white p-1 print:hidden">
                            <button type="button" onClick={() => setServings((s) => Math.max(1, s - 1))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper2" aria-label="Une portion de moins">
                                <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-[90px] text-center text-sm font-semibold" aria-live="polite">
                                {servings} portion{servings > 1 ? "s" : ""}
                            </span>
                            <button type="button" onClick={() => setServings((s) => Math.min(100, s + 1))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper2" aria-label="Une portion de plus">
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                        <button type="button" onClick={() => window.print()} className="btn-ink px-4 py-2 text-sm print:hidden">
                            <Printer className="h-4 w-4" /> Imprimer la recette
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid gap-8 border-t border-ink/10 p-6 sm:p-7 md:grid-cols-[0.9fr_1.1fr]">
                <div>
                    <h4 className="font-display text-xl">Ingrédients</h4>
                    {data.ingredientGroups.map((g, gi) => (
                        <div key={gi} className="mt-3">
                            {g.title && <p className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-ink/50">{g.title}</p>}
                            <ul className="space-y-1">
                                {g.items.map((it, ii) => {
                                    const k = `${gi}-${ii}`;
                                    return (
                                        <li key={k}>
                                            <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 text-[15px] hover:bg-paper ${checked.has(k) ? "text-ink/40 line-through" : ""}`}>
                                                <input type="checkbox" checked={checked.has(k)} onChange={() => toggle(k)} className="mt-1 h-4 w-4 accent-[#ff6a1a]" />
                                                <span>
                                                    {(it.qty || it.unit) && (
                                                        <b>
                                                            {scaleQty(it.qty, factor)} {it.unit}{" "}
                                                        </b>
                                                    )}
                                                    {it.name}
                                                </span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                    {data.tools.length > 0 && (
                        <>
                            <h4 className="mt-6 flex items-center gap-2 font-display text-xl">
                                <Utensils className="h-4 w-4 text-accent" /> Ustensiles
                            </h4>
                            <p className="mt-2 text-[15px] text-ink/70">{data.tools.join(", ")}</p>
                        </>
                    )}
                    {data.nutrition.calories && (
                        <div className="mt-6 rounded-2xl bg-paper p-4 text-sm">
                            <p className="font-semibold">Pour une portion</p>
                            <p className="mt-1 text-ink/65">
                                {data.nutrition.calories} kcal
                                {data.nutrition.proteins && ` · protéines ${data.nutrition.proteins} g`}
                                {data.nutrition.carbs && ` · glucides ${data.nutrition.carbs} g`}
                                {data.nutrition.fats && ` · lipides ${data.nutrition.fats} g`}
                            </p>
                        </div>
                    )}
                </div>
                <div>
                    <h4 className="font-display text-xl">Étapes</h4>
                    <ol className="mt-3 space-y-5">
                        {data.steps.map((s, i) => (
                            <li key={i} className="flex gap-4">
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink font-display text-white">{i + 1}</span>
                                <div className="min-w-0 pt-1">
                                    <p className="whitespace-pre-line text-[15px] leading-relaxed">{s.text}</p>
                                    {s.image && <ModuleImage image={s.image} className="mt-3 aspect-[16/10] max-w-sm" />}
                                </div>
                            </li>
                        ))}
                    </ol>
                    {data.tips && (
                        <div className="mt-6 flex gap-3 rounded-2xl bg-sun/20 p-4 text-[15px]">
                            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-[#a0650a]" />
                            <p className="whitespace-pre-line">
                                <b>Astuce · </b>
                                {data.tips}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
