"use client";

import { useState } from "react";
import { ChevronDown, CircleCheck, CircleAlert, CircleX, Crown, Link2, Loader2, RefreshCw } from "lucide-react";
import { scoreTone, type SeoReport, type SeoTarget } from "@/lib/seo/analyze";

/** Jauge ronde de la note SEO (en-tête de l'éditeur et onglet SEO) */
export function SeoGauge({ score, size = 36, onClick }: { score: number; size?: number; onClick?: () => void }) {
    const r = 15.5;
    const c = 2 * Math.PI * r;
    const color = scoreTone(score);
    const body = (
        <span className="relative grid place-items-center" style={{ width: size, height: size }}>
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                <circle cx="18" cy="18" r={r} fill="#fff" stroke="rgba(26,21,18,.1)" strokeWidth="3.5" />
                <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
            </svg>
            <span className="relative font-display leading-none" style={{ fontSize: size * 0.36, color }}>
                {score}
            </span>
        </span>
    );
    return onClick ? (
        <button type="button" onClick={onClick} title={`Score SEO : ${score}/100 — ouvrir l'assistant`} aria-label={`Score SEO ${score} sur 100`} className="shrink-0 rounded-full transition hover:scale-105">
            {body}
        </button>
    ) : (
        body
    );
}

export interface LinkSuggestion {
    title: string;
    href: string;
    anchor: string;
    pillar: boolean;
}

const ICON = { good: CircleCheck, ok: CircleAlert, bad: CircleX };
const COLOR = { good: "text-[#3f8a1f]", ok: "text-[#e08a00]", bad: "text-[#d92d20]" };

/**
 * Assistant SEO (§ 10.3) : note sur 100 recalculée en direct, critères par
 * groupe avec « Voir » vers le passage, mots-clés secondaires, suggestions de
 * liens internes (contenus piliers d'abord).
 */
export default function SeoAssistant({
    report,
    onTarget,
    suggestions,
    onRefreshSuggestions,
    onInsertLink,
    readOnly,
}: {
    report: SeoReport;
    onTarget: (t: SeoTarget) => void;
    suggestions: LinkSuggestion[] | null;
    onRefreshSuggestions: () => void;
    onInsertLink: (s: LinkSuggestion) => void;
    readOnly: boolean;
}) {
    const [open, setOpen] = useState<string | null>(() => report.groups.find((g) => g.points < g.max)?.id ?? null);
    const verdict = report.score >= 80 ? "Très bien optimisé" : report.score >= 60 ? "Correct, quelques points à améliorer" : report.score >= 40 ? "À travailler avant la publication" : "Encore beaucoup à faire";
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-4">
                <SeoGauge score={report.score} size={64} />
                <div className="min-w-0">
                    <p className="font-display text-xl leading-tight">{verdict}</p>
                    <p className="mt-0.5 text-xs text-ink/55">
                        {report.words} mots · recalculé en direct · seuil conseillé : 60 avant la correction
                    </p>
                </div>
            </div>

            {report.groups.map((g) => {
                const isOpen = open === g.id;
                const pct = g.points / g.max;
                return (
                    <div key={g.id} className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
                        <button type="button" onClick={() => setOpen(isOpen ? null : g.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={isOpen}>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold">{g.label}</span>
                                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
                                    <span className="block h-full rounded-full" style={{ width: `${pct * 100}%`, background: scoreTone(pct * 100) }} />
                                </span>
                            </span>
                            <span className="text-xs font-semibold text-ink/60">
                                {Math.round(g.points)}/{g.max}
                            </span>
                            <ChevronDown className={`h-4 w-4 text-ink/40 transition ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                        {isOpen && (
                            <ul className="space-y-2.5 border-t border-ink/5 px-4 py-3">
                                {g.checks.map((c) => {
                                    const Icon = ICON[c.status];
                                    return (
                                        <li key={c.id} className="flex gap-2.5 text-[13px]">
                                            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${COLOR[c.status]}`} />
                                            <span className="min-w-0 flex-1">
                                                <b className="font-semibold">{c.label}</b> <span className="text-ink/65">{c.message}</span>
                                            </span>
                                            {c.target && c.status !== "good" && (
                                                <button type="button" onClick={() => onTarget(c.target!)} className="h-fit shrink-0 rounded-full bg-paper2 px-2 py-0.5 text-[11px] font-semibold hover:bg-accent/15">
                                                    Voir
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                );
            })}

            {report.secondary.length > 0 && (
                <div className="rounded-2xl border border-ink/10 bg-white p-4">
                    <p className="text-xs font-semibold text-ink/60">Mots-clés secondaires</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {report.secondary.map((s) => (
                            <span key={s.keyword} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.found ? "bg-leaf/25 text-[#2f6e14]" : "bg-paper2 text-ink/50"}`} title={s.found ? "Présent dans le titre ou le texte" : "Absent du texte"}>
                                {s.found ? "✓ " : ""}
                                {s.keyword}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="rounded-2xl border border-ink/10 bg-white p-4">
                <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-accent" />
                    <p className="flex-1 text-sm font-semibold">Liens internes à ajouter</p>
                    <button type="button" onClick={onRefreshSuggestions} className="grid h-7 w-7 place-items-center rounded-lg text-ink/45 hover:bg-paper2" title="Actualiser" aria-label="Actualiser les suggestions">
                        <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                </div>
                {suggestions === null ? (
                    <Loader2 className="mx-auto mt-3 h-4 w-4 animate-spin text-ink/30" />
                ) : suggestions.length === 0 ? (
                    <p className="mt-2 text-xs text-ink/50">Pas d&apos;article proche pour l&apos;instant (choisis un mot-clé principal).</p>
                ) : (
                    <ul className="mt-2 space-y-1.5">
                        {suggestions.map((s) => (
                            <li key={s.href} className="flex items-center gap-2 text-[13px]">
                                {s.pillar && <Crown className="h-3.5 w-3.5 shrink-0 text-sun" aria-label="Contenu pilier" />}
                                <span className="min-w-0 flex-1 truncate" title={s.title}>
                                    {s.title}
                                </span>
                                {!readOnly && (
                                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onInsertLink(s)} className="shrink-0 rounded-full bg-paper2 px-2 py-0.5 text-[11px] font-semibold hover:bg-accent/15" title="Lien sur le texte sélectionné, sinon inséré au curseur">
                                        Lier
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
