"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, ShieldCheck, Upload, X } from "lucide-react";
import { IMAGE_LICENSES, IMAGE_SOURCES, checkCredit } from "@/lib/licenses";
import SourceUrlInput from "@/editor/ui/SourceUrlInput";
import type { MediaView } from "@/lib/media";
import { UploadForm } from "@/editor/ui/MediaPicker";

/** Grille de la médiathèque, envoi d'images, édition des crédits */
export default function MediaLibrary({ canVerify }: { canVerify: boolean }) {
    const [items, setItems] = useState<MediaView[] | null>(null);
    const [q, setQ] = useState("");
    const [toCheck, setToCheck] = useState(false);
    const [upload, setUpload] = useState(false);
    const [selected, setSelected] = useState<MediaView | null>(null);

    const load = useCallback(async () => {
        const r = await fetch(`/api/media/?q=${encodeURIComponent(q)}${toCheck ? "&toCheck=1" : ""}`);
        const j = await r.json();
        setItems(j.success ? j.data : []);
    }, [q, toCheck]);

    useEffect(() => {
        const t = setTimeout(() => void load(), 250);
        return () => clearTimeout(t);
    }, [load]);

    return (
        <>
            <div className="mt-8 flex flex-wrap items-center gap-2">
                <label className="flex w-80 items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2.5 text-sm">
                    <Search className="h-4 w-4 text-ink/40" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une image…" className="min-w-0 flex-1 outline-none" />
                </label>
                <button type="button" onClick={() => setToCheck((v) => !v)} className={`chip !px-3 !py-2 ${toCheck ? "!border-red-300 !bg-red-50 !text-red-700" : ""}`}>
                    Droits à vérifier
                </button>
                <button type="button" onClick={() => setUpload(true)} className="btn-orange ml-auto px-5 py-2.5 text-sm">
                    <Upload className="h-4 w-4" /> Envoyer une image
                </button>
            </div>

            {items === null ? (
                <div className="grid place-items-center py-20 text-ink/40">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            ) : items.length === 0 ? (
                <p className="mt-8 rounded-[24px] border border-dashed border-ink/15 bg-white p-12 text-center text-ink/55">Aucune image.</p>
            ) : (
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    {items.map((m) => (
                        <button key={m.id} type="button" onClick={() => setSelected(m)} className="overflow-hidden rounded-[20px] border border-ink/10 bg-white text-left transition hover:-translate-y-0.5 hover:border-ink/25">
                            <span className="relative block aspect-[4/3] bg-paper2">
                                {/* eslint-disable-next-line @next/next/no-img-element -- vignette */}
                                <img src={m.url} alt={m.alt} className="h-full w-full object-cover" loading="lazy" />
                                {m.rightsVerified && (
                                    <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-leaf" title="Droits vérifiés">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                    </span>
                                )}
                                {m.rightsToCheck && <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">À vérifier</span>}
                            </span>
                            <span className="block truncate px-3 pt-2 text-xs font-semibold">{m.alt || m.name}</span>
                            <span className="block truncate px-3 pb-2.5 text-[11px] text-ink/50">
                                {m.credit.author} · {m.credit.license}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {upload && (
                <Modal title="Envoyer une image" onClose={() => setUpload(false)}>
                    <UploadForm
                        onDone={(m) => {
                            setItems((l) => [m, ...(l || [])]);
                            setUpload(false);
                        }}
                    />
                </Modal>
            )}
            {selected && (
                <Modal title="Image" onClose={() => setSelected(null)}>
                    <MediaDetails
                        media={selected}
                        canVerify={canVerify}
                        onSaved={(m) => {
                            setItems((l) => (l || []).map((x) => (x.id === m.id ? m : x)));
                            setSelected(m);
                        }}
                    />
                </Modal>
            )}
        </>
    );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label={title} onClick={onClose}>
            <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center border-b border-ink/10 px-6 py-4">
                    <h2 className="font-display text-2xl">{title}</h2>
                    <button type="button" onClick={onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-full hover:bg-paper2" aria-label="Fermer">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function MediaDetails({ media, canVerify, onSaved }: { media: MediaView; canVerify: boolean; onSaved: (m: MediaView) => void }) {
    const [alt, setAlt] = useState(media.alt);
    const [credit, setCredit] = useState(media.credit);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const { errors, warnings } = checkCredit(credit);
    const field = "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent";

    const patch = async (body: Record<string, unknown>) => {
        setBusy(true);
        setMsg(null);
        const r = await fetch(`/api/media/${media.id}/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const j = await r.json();
        setBusy(false);
        if (j.success) {
            onSaved(j.data);
            setMsg({ ok: true, text: "Enregistré." });
        } else setMsg({ ok: false, text: j.error });
    };

    return (
        <div className="grid min-h-0 gap-6 overflow-y-auto p-6 md:grid-cols-[1.1fr_1fr]">
            <div>
                {/* eslint-disable-next-line @next/next/no-img-element -- aperçu */}
                <img src={media.url} alt={media.alt} className="w-full rounded-2xl" />
                <p className="mt-2 text-xs text-ink/50">
                    {media.width} × {media.height} px · {Math.round(media.size / 1024)} Ko · WebP
                </p>
            </div>
            <div className="space-y-3">
                <label className="block text-xs font-semibold text-ink/60">
                    Texte alternatif
                    <input value={alt} onChange={(e) => setAlt(e.target.value)} className={`${field} mt-1`} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                    <input value={credit.author} onChange={(e) => setCredit({ ...credit, author: e.target.value })} placeholder="Auteur" className={field} />
                    <select value={credit.source} onChange={(e) => setCredit({ ...credit, source: e.target.value })} className={field}>
                        <option value="">Provenance…</option>
                        {IMAGE_SOURCES.map((s) => (
                            <option key={s}>{s}</option>
                        ))}
                    </select>
                    <select value={credit.license} onChange={(e) => setCredit({ ...credit, license: e.target.value })} className={`${field} col-span-2`}>
                        <option value="">Licence…</option>
                        {IMAGE_LICENSES.map((s) => (
                            <option key={s}>{s}</option>
                        ))}
                    </select>
                    <SourceUrlInput value={credit.sourceUrl} onChange={(v) => setCredit({ ...credit, sourceUrl: v })} className="col-span-2" />
                    <input value={credit.proofUrl} onChange={(e) => setCredit({ ...credit, proofUrl: e.target.value })} placeholder="Preuve d'autorisation (si besoin)" className={`${field} col-span-2`} />
                </div>
                {warnings.map((w) => (
                    <p key={w} className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {w}
                    </p>
                ))}
                {errors.length > 0 && (
                    <ul className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                        {errors.map((e) => (
                            <li key={e}>{e}</li>
                        ))}
                    </ul>
                )}
                <button type="button" disabled={busy || errors.length > 0} onClick={() => patch({ alt, credit })} className="btn-ink w-full justify-center py-2.5 text-sm disabled:opacity-40">
                    Enregistrer
                </button>
                {canVerify && (
                    <button type="button" disabled={busy} onClick={() => patch({ rightsVerified: !media.rightsVerified })} className={`w-full justify-center rounded-full py-2.5 text-sm font-semibold ${media.rightsVerified ? "bg-leaf/30 text-[#2f6e14]" : "btn-ghost"}`}>
                        <ShieldCheck className="mr-1.5 inline h-4 w-4" />
                        {media.rightsVerified ? "Droits vérifiés ✓ (annuler)" : "Marquer les droits comme vérifiés"}
                    </button>
                )}
                {msg && <p className={`text-xs ${msg.ok ? "text-[#2f6e14]" : "text-red-700"}`}>{msg.text}</p>}
            </div>
        </div>
    );
}
