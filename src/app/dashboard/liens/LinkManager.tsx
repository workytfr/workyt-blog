"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { AffiliateView } from "@/lib/affiliate";

const input = "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent";
type Draft = { label: string; name: string; merchant: string; url: string; program: string; expiresAt: string };
const empty: Draft = { label: "", name: "", merchant: "", url: "", program: "", expiresAt: "" };

export default function LinkManager({ initial, canManage }: { initial: AffiliateView[]; canManage: boolean }) {
    const [links, setLinks] = useState(initial);
    const [editing, setEditing] = useState<string | "new" | null>(null);
    const [draft, setDraft] = useState<Draft>(empty);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const open = (l?: AffiliateView) => {
        setError(null);
        setEditing(l ? l.id : "new");
        setDraft(l ? { label: l.label, name: l.name, merchant: l.merchant, url: l.url, program: l.program, expiresAt: l.expiresAt?.slice(0, 10) ?? "" } : empty);
    };
    const submit = async () => {
        setBusy(true);
        setError(null);
        const isNew = editing === "new";
        const r = await fetch(isNew ? "/api/links/" : `/api/links/${editing}/`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
        const j = await r.json();
        setBusy(false);
        if (!j.success) return setError(j.error);
        setLinks((l) => (isNew ? [...l, j.data] : l.map((x) => (x.id === j.data.id ? j.data : x))).sort((a, b) => a.label.localeCompare(b.label)));
        setEditing(null);
    };
    const remove = async (l: AffiliateView) => {
        if (!window.confirm(`Supprimer « ${l.label} » ? Les articles qui l'utilisent renverront vers l'accueil.`)) return;
        const j = await fetch(`/api/links/${l.id}/`, { method: "DELETE" }).then((r) => r.json());
        if (j.success) setLinks((x) => x.filter((y) => y.id !== l.id));
    };
    const copy = async (href: string) => {
        await navigator.clipboard?.writeText(href);
        setCopied(href);
        setTimeout(() => setCopied(null), 1500);
    };

    const form = (
        <div className="space-y-3 rounded-[24px] border border-accent/30 bg-white p-5">
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-ink/60">
                    Nom *
                    <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Casque Sony WH-1000XM5" className={`${input} mt-1`} />
                </label>
                <label className="text-xs font-semibold text-ink/60">
                    Adresse courte
                    <div className="mt-1 flex items-center rounded-xl border border-ink/15 bg-paper2 px-3 text-sm">
                        <span className="text-ink/45">/go/</span>
                        <input value={draft.name} disabled={editing !== "new"} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="(tirée du nom)" className="min-w-0 flex-1 bg-transparent py-2 outline-none disabled:text-ink/55" />
                        <span className="text-ink/45">/</span>
                    </div>
                </label>
                <label className="text-xs font-semibold text-ink/60 sm:col-span-2">
                    Adresse d&apos;affiliation (chez le marchand) *
                    <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://www.amazon.fr/dp/…?tag=workyt-21" className={`${input} mt-1`} />
                </label>
                <label className="text-xs font-semibold text-ink/60">
                    Marchand
                    <input value={draft.merchant} onChange={(e) => setDraft({ ...draft, merchant: e.target.value })} placeholder="Amazon" className={`${input} mt-1`} />
                </label>
                <label className="text-xs font-semibold text-ink/60">
                    Programme
                    <input value={draft.program} onChange={(e) => setDraft({ ...draft, program: e.target.value })} placeholder="Amazon Partenaires, Awin, Fnac…" className={`${input} mt-1`} />
                </label>
                <label className="text-xs font-semibold text-ink/60">
                    Expire le (facultatif)
                    <input type="date" value={draft.expiresAt} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} className={`${input} mt-1`} />
                </label>
            </div>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(null)} className="btn-ghost px-4 py-2 text-sm">
                    Annuler
                </button>
                <button type="button" disabled={busy} onClick={submit} className="btn-orange px-5 py-2 text-sm">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer
                </button>
            </div>
        </div>
    );

    return (
        <div className="mt-8 space-y-4">
            {canManage && editing === null && (
                <button type="button" onClick={() => open()} className="btn-orange px-5 py-2.5 text-sm">
                    <Plus className="h-4 w-4" /> Nouveau lien
                </button>
            )}
            {editing === "new" && form}
            <div className="overflow-hidden rounded-[24px] border border-ink/10 bg-white">
                {links.length === 0 ? (
                    <p className="p-12 text-center text-ink/55">Aucun lien affilié pour l&apos;instant.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-paper text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">
                            <tr>
                                <th className="px-5 py-3">Lien</th>
                                <th className="px-5 py-3">Marchand</th>
                                <th className="px-5 py-3">Clics</th>
                                <th className="px-5 py-3">État</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {links.map((l) =>
                                editing === l.id ? (
                                    <tr key={l.id}>
                                        <td colSpan={5} className="p-3">
                                            {form}
                                        </td>
                                    </tr>
                                ) : (
                                    <tr key={l.id} className="border-t border-ink/5 hover:bg-paper">
                                        <td className="px-5 py-3.5">
                                            <div className="font-semibold">{l.label}</div>
                                            <button type="button" onClick={() => copy(l.href)} className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-ink/50 hover:text-accentdark" title="Copier l'adresse">
                                                {l.href} {copied === l.href ? <Check className="h-3 w-3 text-[#3f8a1f]" /> : <Copy className="h-3 w-3" />}
                                            </button>
                                        </td>
                                        <td className="px-5 text-ink/70">
                                            {l.merchant || "—"}
                                            {l.program && <div className="text-xs text-ink/45">{l.program}</div>}
                                        </td>
                                        <td className="px-5 font-display text-xl">{l.clicks}</td>
                                        <td className="px-5">
                                            {l.health === "dead" ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                                                    <AlertTriangle className="h-3.5 w-3.5" /> Cassé
                                                </span>
                                            ) : l.expired ? (
                                                <span className="rounded-full bg-sun/30 px-2.5 py-1 text-xs font-semibold text-[#8a560a]">Expiré</span>
                                            ) : l.health === "ok" ? (
                                                <span className="rounded-full bg-leaf/25 px-2.5 py-1 text-xs font-semibold text-[#2f6e14]">OK</span>
                                            ) : (
                                                <span className="rounded-full bg-paper2 px-2.5 py-1 text-xs font-semibold text-ink/55" title="Pas encore vérifié, ou le marchand bloque les robots">
                                                    À vérifier
                                                </span>
                                            )}
                                            {l.expiresAt && !l.expired && <div className="mt-1 text-[11px] text-ink/45">jusqu&apos;au {new Date(l.expiresAt).toLocaleDateString("fr-FR")}</div>}
                                        </td>
                                        <td className="px-5 text-right">
                                            {canManage && (
                                                <span className="inline-flex gap-1">
                                                    <button type="button" onClick={() => open(l)} className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 hover:bg-paper2" aria-label="Modifier">
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button type="button" onClick={() => remove(l)} className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 hover:bg-red-50 hover:text-red-700" aria-label="Supprimer">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                )}
            </div>
            {!canManage && (
                <p className="flex items-center gap-1.5 text-xs text-ink/50">
                    <X className="h-3.5 w-3.5" /> Seuls la rédaction en chef et les admins créent ou modifient les liens.
                </p>
            )}
        </div>
    );
}
