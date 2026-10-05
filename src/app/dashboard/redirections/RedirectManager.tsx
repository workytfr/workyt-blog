"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, EyeOff, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { RedirectRow } from "@/lib/redirectsAdmin";
import { relativeDate } from "@/lib/format";

const input = "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent";
type Draft = { id: string | null; from: string; to: string; status: 301 | 302 | 410 };
const SOURCES: Record<string, string> = { rankmath: "Rank Math", migration: "Migration", manual: "Manuelle", "slug-change": "Changement d'adresse" };

export default function RedirectManager({ rows, misses, query }: { rows: RedirectRow[]; misses: { id: string; path: string; hits: number; referrer: string; lastAt: string }[]; query: string }) {
    const router = useRouter();
    const [draft, setDraft] = useState<Draft | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const call = async (url: string, method: string, body?: unknown) => {
        setBusy(true);
        setError(null);
        const j = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json().catch(() => ({ success: true })));
        setBusy(false);
        if (!j.success) {
            setError(j.error);
            return false;
        }
        router.refresh();
        return true;
    };
    const save = async () => {
        if (draft && (await call(draft.id ? `/api/redirects/${draft.id}/` : "/api/redirects/", draft.id ? "PATCH" : "POST", draft))) setDraft(null);
    };

    const form = draft && (
        <div className="space-y-3 rounded-[24px] border border-accent/30 bg-white p-5">
            <div className="grid items-end gap-3 md:grid-cols-[1fr_auto_1fr_140px]">
                <label className="text-xs font-semibold text-ink/60">
                    Adresse d&apos;origine
                    <input value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} placeholder="/ancien-article/" className={`${input} mt-1 font-mono`} />
                </label>
                <ArrowRight className="mb-2.5 hidden h-4 w-4 text-ink/40 md:block" />
                <label className="text-xs font-semibold text-ink/60">
                    Destination
                    <input
                        value={draft.to}
                        disabled={draft.status === 410}
                        onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                        placeholder={draft.status === 410 ? "(aucune : contenu supprimé)" : "/nouvel-article/ ou https://workyt.fr/…"}
                        className={`${input} mt-1 font-mono disabled:bg-paper2`}
                    />
                </label>
                <label className="text-xs font-semibold text-ink/60">
                    Type
                    <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: Number(e.target.value) as Draft["status"] })} className={`${input} mt-1`}>
                        <option value={301}>301 définitive</option>
                        <option value={302}>302 temporaire</option>
                        <option value={410}>410 supprimé</option>
                    </select>
                </label>
            </div>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDraft(null)} className="btn-ghost px-4 py-2 text-sm">
                    Annuler
                </button>
                <button type="button" disabled={busy} onClick={save} className="btn-orange px-5 py-2 text-sm">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer
                </button>
            </div>
        </div>
    );

    return (
        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <form action="/dashboard/redirections/" className="flex w-80 items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm">
                        <Search className="h-4 w-4 text-ink/40" />
                        <input name="q" defaultValue={query} placeholder="Chercher une adresse…" className="min-w-0 flex-1 outline-none" />
                    </form>
                    {!draft && (
                        <button type="button" onClick={() => setDraft({ id: null, from: "", to: "", status: 301 })} className="btn-orange ml-auto px-4 py-2 text-sm">
                            <Plus className="h-4 w-4" /> Nouvelle redirection
                        </button>
                    )}
                </div>
                {form}
                <div className="overflow-hidden rounded-[24px] border border-ink/10 bg-white">
                    {rows.length === 0 ? (
                        <p className="p-10 text-center text-sm text-ink/50">Aucune redirection.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-paper text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">
                                <tr>
                                    <th className="px-4 py-3">Origine → destination</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Visites</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} className="border-t border-ink/5 hover:bg-paper">
                                        <td className="max-w-0 px-4 py-3">
                                            <div className="truncate font-mono text-xs">{r.from}</div>
                                            <div className="truncate font-mono text-xs text-ink/50">→ {r.status === 410 ? "(supprimé)" : r.to}</div>
                                            <div className="mt-0.5 text-[11px] text-ink/40">{SOURCES[r.source] ?? r.source}</div>
                                        </td>
                                        <td className="px-4">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.status === 410 ? "bg-red-50 text-red-700" : r.status === 302 ? "bg-sun/30 text-[#8a560a]" : "bg-sky/20 text-[#1f6f96]"}`}
                                            >
                                                {r.status}
                                            </span>
                                        </td>
                                        <td className="px-4 text-ink/60">
                                            {r.hits}
                                            {r.lastHitAt && <div className="text-[11px] text-ink/40">{relativeDate(r.lastHitAt)}</div>}
                                        </td>
                                        <td className="whitespace-nowrap px-4 text-right">
                                            <span className="inline-flex">
                                                <button
                                                    type="button"
                                                    onClick={() => setDraft({ id: r.id, from: r.from, to: r.to, status: r.status })}
                                                    className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 hover:bg-paper2"
                                                    aria-label="Modifier"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => window.confirm(`Supprimer la redirection de ${r.from} ?`) && call(`/api/redirects/${r.id}/`, "DELETE")}
                                                    className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 hover:bg-red-50 hover:text-red-700"
                                                    aria-label="Supprimer"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>

            <aside>
                <h2 className="font-display text-2xl">Journal des 404</h2>
                <p className="mt-1 text-sm text-ink/55">Adresses demandées qui n&apos;existent pas. Les plus visitées d&apos;abord.</p>
                <div className="mt-3 overflow-hidden rounded-[24px] border border-ink/10 bg-white">
                    {misses.length === 0 ? (
                        <p className="p-8 text-center text-sm text-ink/50">Aucune page introuvable signalée. 🎉</p>
                    ) : (
                        <ul className="divide-y divide-ink/5 text-sm">
                            {misses.map((m) => (
                                <li key={m.id} className="flex items-center gap-2 px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate font-mono text-xs">{m.path}</div>
                                        <div className="text-[11px] text-ink/45">
                                            {m.hits} visite{m.hits > 1 ? "s" : ""} · {relativeDate(m.lastAt)}
                                            {m.referrer && ` · depuis ${m.referrer}`}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setDraft({ id: null, from: m.path, to: "", status: 301 })}
                                        className="shrink-0 rounded-full bg-paper2 px-2.5 py-1 text-[11px] font-semibold hover:bg-accent/15"
                                    >
                                        Rediriger
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => call(`/api/404/${m.id}/`, "DELETE")}
                                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink/40 hover:bg-paper2"
                                        title="Ignorer"
                                        aria-label="Ignorer"
                                    >
                                        <EyeOff className="h-3.5 w-3.5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                {draft && (
                    <button type="button" onClick={() => setDraft(null)} className="mt-3 inline-flex items-center gap-1 text-xs text-ink/45 underline">
                        <X className="h-3 w-3" /> fermer le formulaire
                    </button>
                )}
            </aside>
        </div>
    );
}
