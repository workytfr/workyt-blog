"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Loader2, Plus, RotateCcw, X } from "lucide-react";
import { MAX_POINTS, slidesOf, type CarouselData, type SlideKind } from "@/lib/carousel/data";

const input = "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent";

const SLIDE_NAMES: Record<SlideKind["kind"], string> = { cover: "Couverture", intro: "L'essentiel", points: "À retenir", end: "Fin" };

/**
 * Carrousel Instagram / LinkedIn d'un article : textes pré-remplis depuis
 * l'article, retouchés ici (gardés dans ce navigateur), aperçu des
 * diapositives et téléchargement en PNG (.zip) ou en PDF.
 */
export default function CarouselStudio({ postId, initial }: { postId: string; initial: CarouselData }) {
    const storageKey = `carrousel:${postId}`;
    const [data, setData] = useState<CarouselData>(initial);
    const [selected, setSelected] = useState(0);
    const [previews, setPreviews] = useState<(string | null)[]>([]);
    /** Version des textes dont l'aperçu est affiché : différente = aperçu en cours */
    const [shown, setShown] = useState<string | null>(null);
    const [busy, setBusy] = useState<"zip" | "pdf" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const generation = useRef(0);

    // Retouches déjà faites sur cet article (ce navigateur)
    useEffect(() => {
        const t = setTimeout(() => {
            try {
                const saved = localStorage.getItem(storageKey);
                if (saved) setData({ ...initial, ...JSON.parse(saved), image: initial.image, category: initial.category });
            } catch {}
        });
        return () => clearTimeout(t);
    }, [storageKey, initial]);

    const slides = useMemo(() => slidesOf(data), [data]);
    const version = useMemo(() => JSON.stringify(data), [data]);
    const loading = shown !== version;
    const current = slides[Math.min(selected, slides.length - 1)];

    // Aperçu : toutes les diapositives, regénérées un instant après la dernière frappe
    useEffect(() => {
        const gen = ++generation.current;
        const t = setTimeout(async () => {
            localStorage.setItem(storageKey, version);
            const urls = await Promise.all(
                slides.map(async (_, i) => {
                    const r = await fetch(`/api/posts/${postId}/carousel/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, format: "png", slide: i }) }).catch(() => null);
                    return r?.ok ? URL.createObjectURL(await r.blob()) : null;
                })
            );
            if (gen !== generation.current) return urls.forEach((u) => u && URL.revokeObjectURL(u));
            setPreviews((old) => {
                old.forEach((u) => u && URL.revokeObjectURL(u));
                return urls;
            });
            setError(urls.some((u) => !u) ? "Certaines diapositives n'ont pas pu être générées." : null);
            setShown(version);
        }, 700);
        return () => clearTimeout(t);
    }, [data, version, slides, postId, storageKey]);

    const download = async (format: "zip" | "pdf") => {
        setBusy(format);
        setError(null);
        try {
            const r = await fetch(`/api/posts/${postId}/carousel/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, format }) });
            if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || "Téléchargement impossible.");
            const name = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") || "")?.[1] || `carrousel.${format}`;
            const url = URL.createObjectURL(await r.blob());
            const a = Object.assign(document.createElement("a"), { href: url, download: name });
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Téléchargement impossible.");
        } finally {
            setBusy(null);
        }
    };

    const reset = () => {
        if (!window.confirm("Reprendre tous les textes depuis l'article ? Tes retouches seront perdues.")) return;
        localStorage.removeItem(storageKey);
        setData(initial);
    };

    const set = (patch: Partial<CarouselData>) => setData((d) => ({ ...d, ...patch }));
    const setPoint = (i: number, v: string) => setData((d) => ({ ...d, points: d.points.map((p, j) => (j === i ? v : p)) }));

    return (
        <main className="min-w-0 flex-1 px-10 py-10">
            <div className="mx-auto max-w-7xl">
                <Link href={`/dashboard/articles/${postId}/`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/55 hover:text-accentdark">
                    <ArrowLeft className="h-4 w-4" /> Retour à l&apos;article
                </Link>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                    <div className="min-w-0">
                        <p className="eyebrow">Réseaux sociaux</p>
                        <h1 className="mt-1 font-display text-4xl">Carrousel Instagram &amp; LinkedIn</h1>
                        <p className="mt-2 max-w-2xl text-sm text-ink/60">
                            Textes tirés de l&apos;article, à retoucher avant de télécharger. **gras** et ==surligné== comme dans l&apos;éditeur. La photo, la rubrique et l&apos;avatar viennent de l&apos;article.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                        <button type="button" onClick={reset} className="btn-ghost px-4 py-2.5 text-sm">
                            <RotateCcw className="h-4 w-4" /> Reprendre depuis l&apos;article
                        </button>
                        <button type="button" onClick={() => download("pdf")} disabled={!!busy} className="btn-ink px-4 py-2.5 text-sm disabled:opacity-60">
                            {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF (LinkedIn)
                        </button>
                        <button type="button" onClick={() => download("zip")} disabled={!!busy} className="btn-orange px-4 py-2.5 text-sm disabled:opacity-60">
                            {busy === "zip" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Images PNG (Instagram)
                        </button>
                    </div>
                </div>
                {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{error}</p>}

                <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="min-w-0">
                        {/* Diapositive choisie, en grand */}
                        <div className="relative mx-auto aspect-[4/5] w-full max-w-[520px] overflow-hidden rounded-2xl bg-paper2 shadow-[0_10px_30px_rgba(26,21,18,0.15)]">
                            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu généré */}
                            {previews[selected] && <img src={previews[selected]!} alt={`Diapositive ${selected + 1}`} className="h-full w-full object-cover" />}
                            {loading && (
                                <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aperçu…
                                </span>
                            )}
                        </div>
                        {/* Toutes les diapositives */}
                        <div className="mt-6 flex flex-wrap justify-center gap-3">
                            {slides.map((s, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setSelected(i)}
                                    className={`w-[110px] overflow-hidden rounded-xl bg-paper2 text-left ring-offset-2 transition ${i === selected ? "ring-[3px] ring-accent" : "opacity-80 hover:opacity-100"}`}
                                >
                                    <span className="block aspect-[4/5]">
                                        {/* eslint-disable-next-line @next/next/no-img-element -- aperçu généré */}
                                        {previews[i] && <img src={previews[i]!} alt="" className="h-full w-full object-cover" />}
                                    </span>
                                    <span className="block truncate px-2 py-1.5 text-[11px] font-semibold">
                                        {i + 1}. {SLIDE_NAMES[s.kind]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Textes de la diapositive choisie */}
                    <aside className="widget h-fit space-y-4">
                        <h2 className="font-display text-xl">
                            Diapositive {selected + 1} — {current ? SLIDE_NAMES[current.kind] : ""}
                        </h2>
                        {current?.kind === "cover" && (
                            <>
                                <Field label="Titre">
                                    <textarea value={data.title} onChange={(e) => set({ title: e.target.value })} rows={3} maxLength={160} className={input} />
                                </Field>
                                <Field label="Auteur·rice">
                                    <input value={data.author?.name ?? ""} onChange={(e) => data.author && set({ author: { ...data.author, name: e.target.value } })} disabled={!data.author} className={input} />
                                </Field>
                                <Field label="Temps de lecture (min)">
                                    <input type="number" min={1} max={120} value={data.readingMinutes} onChange={(e) => set({ readingMinutes: Number(e.target.value) || 1 })} className={input} />
                                </Field>
                            </>
                        )}
                        {current?.kind === "intro" && (
                            <>
                                <Field label="Accroche">
                                    <input value={data.intro.heading} onChange={(e) => set({ intro: { ...data.intro, heading: e.target.value } })} maxLength={90} className={input} />
                                </Field>
                                <Field label="Résumé (post-it)" hint="Vide = pas de diapositive « L'essentiel ».">
                                    <textarea value={data.intro.text} onChange={(e) => set({ intro: { ...data.intro, text: e.target.value } })} rows={7} maxLength={420} className={input} />
                                </Field>
                            </>
                        )}
                        {current?.kind === "points" && (
                            <>
                                {data.points.map((p, i) => (
                                    <Field key={i} label={`Point ${i + 1}`}>
                                        <div className="flex gap-2">
                                            <textarea value={p} onChange={(e) => setPoint(i, e.target.value)} rows={3} maxLength={220} className={input} />
                                            <button type="button" onClick={() => set({ points: data.points.filter((_, j) => j !== i) })} className="self-start rounded-lg p-1.5 text-ink/40 hover:bg-paper2 hover:text-ink" aria-label={`Retirer le point ${i + 1}`}>
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </Field>
                                ))}
                                {data.points.length < MAX_POINTS && (
                                    <button type="button" onClick={() => set({ points: [...data.points, ""] })} className="btn-ghost px-3 py-1.5 text-xs">
                                        <Plus className="h-3.5 w-3.5" /> Ajouter un point
                                    </button>
                                )}
                                <Field label="Citation" hint="Sous le dernier point, s'il reste de la place. Vide = pas de citation.">
                                    <textarea value={data.quote} onChange={(e) => set({ quote: e.target.value })} rows={2} maxLength={140} className={input} />
                                </Field>
                            </>
                        )}
                        {current?.kind === "end" && (
                            <>
                                <Field label="Mots-clés" hint="Séparés par des virgules (8 au plus).">
                                    <input value={data.tags.join(", ")} onChange={(e) => set({ tags: e.target.value.split(",").map((t) => t.trimStart()).slice(0, 8) })} className={input} />
                                </Field>
                                <Field label="Adresse affichée">
                                    <input value={data.url} onChange={(e) => set({ url: e.target.value })} maxLength={90} className={input} />
                                </Field>
                                <Field label="Fonction de l'auteur·rice">
                                    <input value={data.author?.title ?? ""} onChange={(e) => data.author && set({ author: { ...data.author, title: e.target.value } })} disabled={!data.author} maxLength={80} className={input} />
                                </Field>
                            </>
                        )}
                        {data.points.length === 0 && (
                            <button type="button" onClick={() => set({ points: [""] })} className="btn-ghost px-3 py-1.5 text-xs">
                                <Plus className="h-3.5 w-3.5" /> Ajouter des points « À retenir »
                            </button>
                        )}
                    </aside>
                </div>
            </div>
        </main>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="text-xs font-bold text-ink/60">{label}</span>
            <div className="mt-1">{children}</div>
            {hint && <span className="mt-1 block text-[11px] text-ink/45">{hint}</span>}
        </label>
    );
}
