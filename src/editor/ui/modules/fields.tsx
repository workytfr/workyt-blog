"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Camera, ImagePlus, Link2, Minus, Plus, ShoppingBag, Sigma, Star, Trash2, X } from "lucide-react";
import { criteriaAverage, type Criterion, type ModuleImage } from "@/lib/modules/types";

/** Champs des formulaires de modules, au style de l'éditeur */

export const input = "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent disabled:bg-paper2 disabled:text-ink/50";

/**
 * Champ avec son libellé. « group » pour un contenu à plusieurs boutons (note,
 * lien, liste) : dans un <label>, un clic sur le libellé ou l'aide déclencherait
 * le premier bouton.
 */
export function Field({ label, hint, children, className = "", group = false }: { label: string; hint?: string; children: React.ReactNode; className?: string; group?: boolean }) {
    const Tag = group ? "div" : "label";
    return (
        <Tag className={`block min-w-0 ${className}`} {...(group ? { role: "group", "aria-label": label } : {})}>
            <span className="text-xs font-semibold text-ink/60">{label}</span>
            <div className="mt-1">{children}</div>
            {hint && <span className="mt-1 block text-[11px] text-ink/45">{hint}</span>}
        </Tag>
    );
}

export function Text({ value, onChange, placeholder, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
    return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className={input} />;
}

export function Area({ value, onChange, placeholder, rows = 3, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; disabled?: boolean }) {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled} className={`${input} resize-y`} />;
}

export function Num({ value, onChange, min = 0, max = 9999, step = 1, suffix }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
    // Saisie en cours : le champ peut être vidé pour taper un autre nombre (sinon « 1 » puis « 6 » donnait 16)
    const [draft, setDraft] = useState<string | null>(null);
    return (
        <div className="flex items-center gap-2">
            <input
                type="number"
                value={draft ?? String(value)}
                min={min}
                max={max}
                step={step}
                onChange={(e) => {
                    setDraft(e.target.value);
                    const n = Number(e.target.value);
                    if (e.target.value !== "" && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
                }}
                onBlur={() => setDraft(null)}
                className={`${input} w-24`}
            />
            {suffix && <span className="text-xs text-ink/50">{suffix}</span>}
        </div>
    );
}

export function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[] }) {
    return (
        <select value={value} onChange={(e) => onChange(e.target.value as T)} className={input}>
            {options.map(([v, l]) => (
                <option key={v} value={v}>
                    {l}
                </option>
            ))}
        </select>
    );
}

const fmtScore = (n: number) => String(n).replace(".", ",");

/**
 * Note au demi-point : étoiles (sur 5) ou segments (sur 10). Moitié gauche
 * d'une étoile = demi-point, moitié droite = point entier ; − et + pour
 * ajuster finement.
 */
export function ScorePicker({ value, onChange, max, small = false }: { value: number; onChange: (v: number) => void; max: number; small?: boolean }) {
    const set = (v: number) => onChange(Math.min(max, Math.max(0, Math.round(v * 2) / 2)));
    const stars = max === 5;
    const w = stars ? (small ? 22 : 30) : small ? 16 : 22;
    const h = stars ? w : small ? 12 : 16;
    return (
        <div className="flex min-w-0 items-center gap-1.5">
            <IconBtn label="Un demi-point de moins" onClick={() => set(value - 0.5)} disabled={value <= 0}>
                <Minus className="h-3.5 w-3.5" />
            </IconBtn>
            <div className="flex items-center gap-0.5">
                {Array.from({ length: max }, (_, i) => {
                    const fill = Math.max(0, Math.min(1, value - i));
                    return (
                        <span key={i} className="relative inline-block" style={{ width: w, height: h }}>
                            {stars ? (
                                <>
                                    <Star className="absolute inset-0 text-ink/15" style={{ width: w, height: h }} fill="currentColor" strokeWidth={0} />
                                    <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                                        <Star className="text-sun" style={{ width: w, height: h }} fill="currentColor" strokeWidth={0} />
                                    </span>
                                </>
                            ) : (
                                <span className="absolute inset-0 overflow-hidden rounded-[5px] bg-ink/10">
                                    <span className="block h-full bg-accent" style={{ width: `${fill * 100}%` }} />
                                </span>
                            )}
                            <button type="button" onClick={() => set(i + 0.5)} title={fmtScore(i + 0.5)} aria-label={`${fmtScore(i + 0.5)} sur ${max}`} className="absolute inset-y-0 left-0 w-1/2 cursor-pointer rounded-l focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" />
                            <button type="button" onClick={() => set(i + 1)} title={fmtScore(i + 1)} aria-label={`${fmtScore(i + 1)} sur ${max}`} className="absolute inset-y-0 right-0 w-1/2 cursor-pointer rounded-r focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" />
                        </span>
                    );
                })}
            </div>
            <IconBtn label="Un demi-point de plus" onClick={() => set(value + 0.5)} disabled={value >= max}>
                <Plus className="h-3.5 w-3.5" />
            </IconBtn>
            <span className={`whitespace-nowrap font-display ${small ? "w-14 text-base" : "w-20 text-2xl"}`}>
                {fmtScore(value)}
                <span className="text-sm text-ink/45">/{max}</span>
            </span>
        </div>
    );
}

/**
 * Note globale d'un avis : choisie à la main, ou, dès qu'un critère est
 * noté, la moyenne des critères (même calcul que sur le serveur).
 */
export function ScoreInput({ value, onChange, max, criteria = [] }: { value: number; onChange: (v: number) => void; max: number; criteria?: Criterion[] }) {
    const avg = criteriaAverage(criteria);
    if (avg === null) return <ScorePicker value={value} onChange={onChange} max={max} />;
    return (
        <div className="flex items-center gap-3 rounded-2xl bg-paper2 px-4 py-3">
            <Sigma className="h-5 w-5 shrink-0 text-accentdark" />
            <span className="whitespace-nowrap font-display text-2xl">
                {fmtScore(avg)}
                <span className="text-sm text-ink/45">/{max}</span>
            </span>
            <span className="text-xs text-ink/55">Moyenne des critères notés, calculée automatiquement. Retire les critères pour noter à la main.</span>
        </div>
    );
}

/** Liste de lignes (points forts, ustensiles…) */
export function Lines({ value, onChange, placeholder, max = 12 }: { value: string[]; onChange: (v: string[]) => void; placeholder: string; max?: number }) {
    const [draft, setDraft] = useState("");
    const add = () => {
        const t = draft.trim();
        if (t && value.length < max) onChange([...value, t]);
        setDraft("");
    };
    return (
        <div className="space-y-1.5">
            {value.map((v, i) => (
                <div key={i} className="flex items-center gap-1.5">
                    <input value={v} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} className={input} />
                    <IconBtn label="Retirer" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                    </IconBtn>
                </div>
            ))}
            <div className="flex items-center gap-1.5">
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            add();
                        }
                    }}
                    placeholder={placeholder}
                    className={input}
                />
                <IconBtn label="Ajouter" onClick={add}>
                    <Plus className="h-4 w-4" />
                </IconBtn>
            </div>
        </div>
    );
}

export function IconBtn({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink/45 hover:bg-paper2 hover:text-ink disabled:opacity-30">
            {children}
        </button>
    );
}

/** Ligne déplaçable d'une liste structurée (ingrédient, étape, source…) */
export function RowTools({ index, count, onMove, onRemove }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
    return (
        <div className="flex shrink-0 items-center">
            <IconBtn label="Monter" onClick={() => onMove(index - 1)} disabled={index === 0}>
                <ArrowUp className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Descendre" onClick={() => onMove(index + 1)} disabled={index === count - 1}>
                <ArrowDown className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Retirer" onClick={onRemove}>
                <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
        </div>
    );
}

export function move<T>(list: T[], from: number, to: number): T[] {
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    return next;
}

/** Critères notés (même échelle que la note globale, dont ils donnent la moyenne) */
export function CriteriaInput({ value, onChange, max }: { value: Criterion[]; onChange: (v: Criterion[]) => void; max: number }) {
    return (
        <div className="space-y-2">
            {value.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input value={c.label} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Critère (ex. Style)" className={`${input} min-w-0 flex-1`} />
                    <ScorePicker small value={c.score} onChange={(score) => onChange(value.map((x, j) => (j === i ? { ...x, score } : x)))} max={max} />
                    <IconBtn label="Retirer le critère" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                    </IconBtn>
                </div>
            ))}
            <button type="button" onClick={() => onChange([...value, { label: "", score: Math.round(max * 0.7) }])} className="inline-flex items-center gap-1 text-xs font-semibold text-accentdark">
                <Plus className="h-3.5 w-3.5" /> Ajouter un critère
            </button>
            {value.some((c) => !c.label.trim()) && <p className="text-[11px] text-ink/45">Un critère sans nom ne compte pas dans la note.</p>}
        </div>
    );
}

/** Image d'un module : choisie dans la médiathèque (donc avec sa source et sa licence) */
export function ImageInput({ value, onChange, pickImage, label = "Image", aspect = "aspect-[4/3]" }: { value: ModuleImage | null; onChange: (v: ModuleImage | null) => void; pickImage: () => Promise<ModuleImage | null>; label?: string; aspect?: string }) {
    return (
        <div>
            <span className="text-xs font-semibold text-ink/60">{label}</span>
            {value ? (
                <div className={`relative mt-1 overflow-hidden rounded-2xl bg-paper2 ${aspect}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- aperçu */}
                    <img src={value.url} alt={value.alt} className="h-full w-full object-cover" />
                    <span className="absolute bottom-2 left-2 inline-flex max-w-[70%] items-center gap-1 truncate rounded-full bg-paper/95 px-2 py-0.5 text-[10px] font-semibold">
                        <Camera className="h-3 w-3 shrink-0 text-accent" /> {value.credit.author} · {value.credit.source}
                    </span>
                    <div className="absolute right-2 top-2 flex gap-1">
                        <button type="button" onClick={async () => onChange((await pickImage()) ?? value)} className="rounded-full bg-paper/95 px-2.5 py-1 text-[11px] font-semibold">
                            Changer
                        </button>
                        <button type="button" onClick={() => onChange(null)} className="grid h-6 w-6 place-items-center rounded-full bg-paper/95" aria-label="Retirer l'image">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            ) : (
                <button type="button" onClick={async () => onChange(await pickImage())} className={`mt-1 grid w-full place-items-center rounded-2xl border border-dashed border-ink/20 bg-white text-sm text-ink/50 hover:border-accent hover:text-accentdark ${aspect}`}>
                    <span className="inline-flex flex-col items-center gap-1">
                        <ImagePlus className="h-5 w-5" /> Choisir dans la médiathèque
                    </span>
                </button>
            )}
        </div>
    );
}

export interface AffiliateOption {
    id: string;
    name: string;
    url: string;
    href: string;
    label: string;
    merchant: string;
    health: string;
    expired: boolean;
}

/** Liens affiliés du gestionnaire (chargés une fois par page) */
let linksCache: Promise<AffiliateOption[]> | null = null;
export function useAffiliateLinks(): AffiliateOption[] | null {
    const [links, setLinks] = useState<AffiliateOption[] | null>(null);
    useEffect(() => {
        linksCache ??= fetch("/api/links/")
            .then((r) => r.json())
            .then((j) => (j.success ? j.data : []))
            .catch(() => []);
        let alive = true;
        void linksCache.then((l) => alive && setLinks(l));
        return () => {
            alive = false;
        };
    }, []);
    return links;
}

/** Lien : adresse directe, ou lien affilié du gestionnaire (/go/<nom>/, « sponsorisé ») */
export function LinkInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const links = useAffiliateLinks();
    const affiliate = value.startsWith("/go/");
    return (
        <div className="space-y-1.5">
            <div className="flex gap-1 rounded-full border border-ink/10 bg-white p-0.5 text-xs font-semibold">
                <button type="button" onClick={() => affiliate && onChange("")} className={`flex flex-1 items-center justify-center gap-1 rounded-full py-1 ${!affiliate ? "bg-ink text-white" : "text-ink/60"}`}>
                    <Link2 className="h-3.5 w-3.5" /> Adresse
                </button>
                <button type="button" onClick={() => !affiliate && onChange(links?.[0]?.href ?? "/go/")} className={`flex flex-1 items-center justify-center gap-1 rounded-full py-1 ${affiliate ? "bg-ink text-white" : "text-ink/60"}`}>
                    <ShoppingBag className="h-3.5 w-3.5" /> Lien affilié
                </button>
            </div>
            {affiliate ? (
                <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
                    {!links?.length && <option value="/go/">Aucun lien : demande à la rédaction en chef d&apos;en créer</option>}
                    {links?.map((l) => (
                        <option key={l.id} value={l.href}>
                            {l.label}
                            {l.merchant ? ` · ${l.merchant}` : ""}
                            {l.health === "dead" ? " · ⚠ lien cassé" : l.expired ? " · expiré" : ""}
                        </option>
                    ))}
                </select>
            ) : (
                <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" className={input} />
            )}
        </div>
    );
}
