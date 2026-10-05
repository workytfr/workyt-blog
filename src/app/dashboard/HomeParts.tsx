"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ChefHat, CheckCircle2, Circle, Cpu, Heart, LayoutTemplate, ShoppingBag, X } from "lucide-react";
import NewPostButton from "./NewPostButton";

/** « Premiers pas » d'un nouveau rédacteur (§ 13.1), masquable */
export function FirstSteps({ steps }: { steps: { label: string; done: boolean; href?: string }[] }) {
    const [hidden, setHidden] = useState(true);
    useEffect(() => {
        const t = setTimeout(() => setHidden(localStorage.getItem("wk-premiers-pas") === "masque"), 0);
        return () => clearTimeout(t);
    }, []);
    const done = steps.filter((s) => s.done).length;
    if (hidden || done === steps.length) return null;
    const next = steps.find((s) => !s.done);
    return (
        <section className="relative mt-8 overflow-hidden rounded-[28px] bg-ink p-7 text-white">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/30 blur-3xl" aria-hidden="true" />
            <button type="button" onClick={() => (localStorage.setItem("wk-premiers-pas", "masque"), setHidden(true))} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white" aria-label="Masquer">
                <X className="h-4 w-4" />
            </button>
            <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Premiers pas · {done}/{steps.length}</p>
                    <h2 className="mt-2 font-display text-3xl">Bienvenue dans la rédaction !</h2>
                    <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                        {steps.map((s) => (
                            <li key={s.label} className={`flex items-center gap-2 text-sm ${s.done ? "text-white/45 line-through" : "text-white/90"}`}>
                                {s.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-leaf" /> : <Circle className="h-4 w-4 shrink-0 text-white/40" />}
                                {s.href && !s.done ? (
                                    <Link href={s.href} className="underline decoration-white/30 underline-offset-4 hover:decoration-accent">
                                        {s.label}
                                    </Link>
                                ) : (
                                    s.label
                                )}
                            </li>
                        ))}
                    </ol>
                </div>
                {next?.href && (
                    <Link href={next.href} className="btn-orange px-5 py-3 text-sm">
                        {next.label}
                    </Link>
                )}
            </div>
        </section>
    );
}

const TEMPLATES = [
    ["recipe", "Recette", ChefHat],
    ["bookReview", "Critique de livre", BookOpen],
    ["techReview", "Test tech", Cpu],
    ["productReview", "Avis produit", ShoppingBag],
    ["favorite", "Coup de cœur", Heart],
] as const;

/** « Partir d'un modèle » : un brouillon avec le module déjà en place */
export function TemplateCard() {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative rounded-[24px] border border-ink/10 bg-white p-5">
            <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-4 text-left" aria-expanded={open}>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky/20 text-[#2f86b3]">
                    <LayoutTemplate />
                </span>
                <span>
                    <b className="block">Partir d&apos;un modèle</b>
                    <span className="text-sm text-ink/55">Recette, critique, test…</span>
                </span>
            </button>
            {open && (
                <div className="absolute inset-x-3 top-[calc(100%+6px)] z-20 grid gap-1 rounded-2xl border border-ink/10 bg-white p-2 shadow-[0_18px_40px_rgba(26,21,18,.14)]">
                    {TEMPLATES.map(([id, label, Icon]) => (
                        <NewPostButton key={id} template={id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-paper">
                            <Icon className="h-4 w-4 text-accent" /> {label}
                        </NewPostButton>
                    ))}
                </div>
            )}
        </div>
    );
}
