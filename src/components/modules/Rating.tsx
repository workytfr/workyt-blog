import { Star } from "lucide-react";
import type { Criterion } from "@/lib/modules/types";

/**
 * Notes des modules : le même affichage partout (§ 9, « notes affichées
 * identiquement »). Pastille de note globale, étoiles (sur 5), barres des
 * critères.
 */

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

/** Couleur selon la note : vert, orange, rouge */
function tone(value: number, max: number) {
    const r = value / max;
    return r >= 0.75 ? "#3f8a1f" : r >= 0.5 ? "#c24a0a" : "#b42318";
}

export function ScoreBadge({ value, max, size = 84, label = "Note" }: { value: number; max: number; size?: number; label?: string }) {
    const pct = Math.max(0, Math.min(1, value / max));
    const r = 42;
    const c = 2 * Math.PI * r;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label} : ${fmt(value)} sur ${max}`}>
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                {/* Fond et piste aux couleurs du thème (clair / sombre) */}
                <circle cx="50" cy="50" r={r} strokeWidth="9" style={{ fill: "rgb(var(--c-surface))", stroke: "rgb(var(--c-ink) / 0.08)" }} />
                <circle cx="50" cy="50" r={r} fill="none" stroke={tone(value, max)} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${pct * c} ${c}`} />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center leading-none">
                <span>
                    <span className="font-display" style={{ fontSize: size * 0.32 }}>
                        {fmt(value)}
                    </span>
                    <span className="block text-ink/45" style={{ fontSize: size * 0.13 }}>
                        /{max}
                    </span>
                </span>
            </div>
        </div>
    );
}

export function Stars({ value, max = 5, size = 18 }: { value: number; max?: number; size?: number }) {
    return (
        <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${fmt(value)} sur ${max}`}>
            {Array.from({ length: max }, (_, i) => {
                const fill = Math.max(0, Math.min(1, value - i));
                return (
                    <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
                        <Star className="absolute inset-0 text-ink/15" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
                        <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                            <Star className="text-sun" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
                        </span>
                    </span>
                );
            })}
        </span>
    );
}

export function CriteriaBars({ criteria, max }: { criteria: Criterion[]; max: number }) {
    if (!criteria.length) return null;
    return (
        <ul className="space-y-2.5">
            {criteria.map((c) => (
                <li key={c.label}>
                    <div className="flex items-baseline justify-between text-sm">
                        <span className="font-semibold">{c.label}</span>
                        <span className="text-ink/55">
                            {fmt(c.score)}/{max}
                        </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/[0.07]">
                        <div className="h-full rounded-full" style={{ width: `${(c.score / max) * 100}%`, background: tone(c.score, max) }} />
                    </div>
                </li>
            ))}
        </ul>
    );
}

export function ProsCons({ pros, cons }: { pros: string[]; cons: string[] }) {
    if (!pros.length && !cons.length) return null;
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {pros.length > 0 && (
                <div className="rounded-2xl bg-leaf/15 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#2f6e14]">On aime</p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                        {pros.map((p) => (
                            <li key={p} className="flex gap-2">
                                <span className="font-bold text-[#3f8a1f]">+</span> {p}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {cons.length > 0 && (
                <div className="rounded-2xl bg-red-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-red-700">On aime moins</p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                        {cons.map((p) => (
                            <li key={p} className="flex gap-2">
                                <span className="font-bold text-red-600">−</span> {p}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export { fmt as formatScore };
