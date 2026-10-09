"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, Globe, ImagePlus, Loader2, Search, ShieldCheck, Upload, X } from "lucide-react";
import { IMAGE_LICENSES, IMAGE_SOURCES, PROOF_REQUIRED, checkCredit } from "@/lib/licenses";
import type { MediaView } from "@/lib/media";
import StockSearch from "./StockSearch";
import SourceUrlInput from "./SourceUrlInput";

/**
 * Médiathèque : choisir une image, ou en envoyer une nouvelle. Une image
 * n'entre pas sans auteur, provenance, licence et lien d'origine (§ 8.4).
 */
export default function MediaPicker({ open, onClose, onPick, title = "Choisir une image" }: { open: boolean; onClose: () => void; onPick: (m: MediaView) => void; title?: string }) {
    const [tab, setTab] = useState<"library" | "stock" | "upload">("library");
    const [items, setItems] = useState<MediaView[] | null>(null);
    const [q, setQ] = useState("");

    useEffect(() => {
        if (!open) return;
        const ctrl = new AbortController();
        const t = setTimeout(() => {
            fetch(`/api/media/?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
                .then((r) => r.json())
                .then((j) => setItems(j.success ? j.data : []))
                .catch(() => {});
        }, 250);
        return () => {
            clearTimeout(t);
            ctrl.abort();
        };
    }, [open, q]);

    if (!open) return null;
    // Au niveau de la page, au-dessus de la fenêtre d'un module qui l'a ouverte
    return createPortal(
        <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label={title} onClick={onClose}>
            <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 border-b border-ink/10 px-6 py-4">
                    <h2 className="font-display text-2xl">{title}</h2>
                    <div className="ml-4 flex gap-1 rounded-full border border-ink/10 bg-white p-1 text-sm font-semibold">
                        <button type="button" onClick={() => setTab("library")} className={`rounded-full px-3 py-1.5 ${tab === "library" ? "bg-ink text-white" : "text-ink/60"}`}>
                            Médiathèque
                        </button>
                        <button type="button" onClick={() => setTab("upload")} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${tab === "upload" ? "bg-ink text-white" : "text-ink/60"}`}>
                            <Upload className="h-3.5 w-3.5" /> Envoyer
                        </button>
                        <button type="button" onClick={() => setTab("stock")} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${tab === "stock" ? "bg-ink text-white" : "text-ink/60"}`}>
                            <Globe className="h-3.5 w-3.5" /> Banque d&apos;images
                        </button>
                    </div>
                    <button type="button" onClick={onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-full hover:bg-paper2" aria-label="Fermer">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {tab === "library" ? (
                    <div className="min-h-0 flex-1 overflow-y-auto p-6">
                        <label className="flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2.5 text-sm">
                            <Search className="h-4 w-4 text-ink/40" />
                            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher (description, auteur, nom de fichier)…" className="min-w-0 flex-1 outline-none" />
                        </label>
                        {items === null ? (
                            <div className="grid place-items-center py-16 text-ink/40">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="py-16 text-center text-sm text-ink/55">
                                Aucune image.{" "}
                                <button type="button" onClick={() => setTab("upload")} className="font-semibold text-accentdark underline">
                                    Envoie la première
                                </button>
                            </div>
                        ) : (
                            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {items.map((m) => (
                                    <button key={m.id} type="button" onClick={() => onPick(m)} className="group overflow-hidden rounded-2xl border border-ink/10 bg-white text-left hover:border-accent">
                                        <span className="relative block aspect-[4/3] bg-paper2">
                                            {/* eslint-disable-next-line @next/next/no-img-element -- vignette de la médiathèque */}
                                            <img src={m.url} alt={m.alt} className="h-full w-full object-cover" loading="lazy" />
                                            {m.rightsToCheck && <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">Droits à vérifier</span>}
                                            {m.rightsVerified && (
                                                <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-leaf text-ink" title="Droits vérifiés">
                                                    <ShieldCheck className="h-3.5 w-3.5" />
                                                </span>
                                            )}
                                        </span>
                                        <span className="block truncate px-2.5 pt-2 text-xs font-semibold">{m.alt || m.name}</span>
                                        <span className="block truncate px-2.5 pb-2 text-[11px] text-ink/50">
                                            {m.credit.author} · {m.credit.source}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : tab === "stock" ? (
                    <StockSearch
                        onImported={(m) => {
                            setItems((list) => [m, ...(list || []).filter((x) => x.id !== m.id)]);
                            onPick(m);
                        }}
                    />
                ) : (
                    <UploadForm
                        onDone={(m) => {
                            setItems((list) => [m, ...(list || [])]);
                            onPick(m);
                        }}
                    />
                )}
            </div>
        </div>,
        document.body
    );
}

export function UploadForm({ onDone }: { onDone: (m: MediaView) => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [alt, setAlt] = useState("");
    const [credit, setCredit] = useState({ author: "", source: "", license: "", sourceUrl: "", proofUrl: "" });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tried, setTried] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    const { errors, warnings } = checkCredit(credit);
    const set = (k: keyof typeof credit) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setCredit((c) => ({ ...c, [k]: e.target.value }));
    const choose = (f: File | null) => {
        setFile(f);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(f ? URL.createObjectURL(f) : null);
        if (f && !alt) setAlt(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setTried(true);
        if (!file || errors.length || !alt.trim()) return;
        setBusy(true);
        setError(null);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("alt", alt);
        Object.entries(credit).forEach(([k, v]) => fd.append(k, v));
        try {
            const r = await fetch("/api/media/", { method: "POST", body: fd });
            const j = await r.json();
            if (!j.success) throw new Error(j.error || "Envoi impossible.");
            onDone(j.data);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const field = "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent";
    return (
        <form onSubmit={submit} className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 md:grid-cols-[1fr_1.2fr]">
            <div>
                <button
                    type="button"
                    onClick={() => input.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        choose(e.dataTransfer.files?.[0] ?? null);
                    }}
                    className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-ink/15 bg-white text-ink/50 hover:border-accent"
                >
                    {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element -- aperçu local avant envoi
                        <img src={preview} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <span className="text-center text-sm">
                            <ImagePlus className="mx-auto mb-2 h-8 w-8" />
                            Glisse une image ici ou clique
                            <span className="mt-1 block text-xs">JPEG, PNG, WebP, GIF · 15 Mo max · convertie en WebP</span>
                        </span>
                    )}
                </button>
                <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="hidden" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
                <label className="mt-4 block text-xs font-semibold text-ink/60">
                    Description de l&apos;image (texte alternatif) *
                    <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Ex. : Une pile de livres sur un bureau" className={`${field} mt-1`} />
                </label>
            </div>

            <div>
                <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4 text-accent" /> Source et droits <span className="text-xs font-normal text-ink/50">(obligatoire)</span>
                </div>
                <p className="mt-1 text-xs text-ink/55">On doit pouvoir prouver qu&apos;on a le droit de publier cette image. Le crédit sera affiché sur l&apos;image.</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="text-xs font-semibold text-ink/60">
                        Auteur *
                        <input value={credit.author} onChange={set("author")} placeholder="Nom du photographe" className={`${field} mt-1`} />
                    </label>
                    <label className="text-xs font-semibold text-ink/60">
                        Provenance *
                        <select value={credit.source} onChange={set("source")} className={`${field} mt-1`}>
                            <option value="">Choisir…</option>
                            {IMAGE_SOURCES.map((s) => (
                                <option key={s}>{s}</option>
                            ))}
                        </select>
                    </label>
                    <label className="col-span-2 text-xs font-semibold text-ink/60">
                        Licence *
                        <select value={credit.license} onChange={set("license")} className={`${field} mt-1`}>
                            <option value="">Choisir…</option>
                            {IMAGE_LICENSES.map((s) => (
                                <option key={s}>{s}</option>
                            ))}
                        </select>
                    </label>
                    <label className="col-span-2 text-xs font-semibold text-ink/60">
                        Lien vers l&apos;image d&apos;origine <span className="font-normal">(facultatif)</span>
                        <SourceUrlInput value={credit.sourceUrl} onChange={(v) => setCredit((c) => ({ ...c, sourceUrl: v }))} placeholder="https://unsplash.com/photos/…" className="mt-1" />
                    </label>
                    {PROOF_REQUIRED.includes(credit.license) && (
                        <label className="col-span-2 text-xs font-semibold text-ink/60">
                            Preuve de l&apos;autorisation * <span className="font-normal">(lien vers l&apos;e-mail ou la page presse, visible de la rédaction seulement)</span>
                            <input value={credit.proofUrl} onChange={set("proofUrl")} placeholder="https://…" className={`${field} mt-1`} />
                        </label>
                    )}
                </div>

                {warnings.map((w) => (
                    <p key={w} className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <AlertTriangle className="h-4 w-4 shrink-0" /> {w}
                    </p>
                ))}
                {tried && (errors.length > 0 || !alt.trim() || !file) && (
                    <ul className="mt-3 space-y-1 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                        {!file && <li>Choisis une image.</li>}
                        {!alt.trim() && <li>Décris l&apos;image (texte alternatif).</li>}
                        {errors.map((e) => (
                            <li key={e}>{e}</li>
                        ))}
                    </ul>
                )}
                {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

                <button type="submit" disabled={busy} className="btn-orange mt-5 w-full justify-center py-3 text-sm disabled:opacity-60">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Envoyer et utiliser l&apos;image
                </button>
            </div>
        </form>
    );
}
