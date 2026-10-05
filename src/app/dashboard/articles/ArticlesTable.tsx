"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, MessageSquare, RotateCcw, Trash2 } from "lucide-react";
import { STATUS_LABELS } from "@/editor/types";
import { scoreTone } from "@/lib/seo/analyze";
import { relativeDate } from "@/lib/format";

export interface ArticleRow {
    id: string;
    title: string;
    status: string;
    thumb: string | null;
    categories: { name: string; color: string }[];
    authors: string[];
    corrector: string | null;
    scheduledAt: string | null;
    suggestions: number;
    seo: number | null;
    updatedAt: string;
    here: { name: string; editing: boolean }[];
}

/** Tableau des articles avec sélection et actions groupées (corbeille, restauration) */
export default function ArticlesTable({ rows, view, empty }: { rows: ArticleRow[]; view: string; empty: string }) {
    const router = useRouter();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const all = rows.length > 0 && selected.size === rows.length;
    const toggle = (id: string) =>
        setSelected((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });

    const bulk = async (action: "trash" | "restore") => {
        if (action === "trash" && !window.confirm(`Mettre ${selected.size} article${selected.size > 1 ? "s" : ""} à la corbeille ?`)) return;
        setBusy(true);
        setReport(null);
        let ok = 0;
        const refused: string[] = [];
        for (const id of selected) {
            const j = await fetch(`/api/posts/${id}/workflow/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })
                .then((r) => r.json())
                .catch(() => ({ success: false }));
            if (j.success) ok++;
            else refused.push(rows.find((r) => r.id === id)?.title ?? id);
        }
        setBusy(false);
        setSelected(new Set());
        setReport(`${ok} article${ok > 1 ? "s" : ""} ${action === "trash" ? "mis à la corbeille" : "restauré" + (ok > 1 ? "s" : "")}.${refused.length ? ` Pas possible pour : ${refused.join(", ")} (statut ou droits).` : ""}`);
        router.refresh();
    };

    return (
        <>
            {(selected.size > 0 || report) && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-ink px-5 py-3 text-sm text-white">
                    {selected.size > 0 ? (
                        <>
                            <b>
                                {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
                            </b>
                            {view === "corbeille" ? (
                                <button type="button" disabled={busy} onClick={() => bulk("restore")} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20">
                                    <RotateCcw className="h-4 w-4" /> Restaurer
                                </button>
                            ) : (
                                <button type="button" disabled={busy} onClick={() => bulk("trash")} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-semibold hover:bg-red-500/80">
                                    <Trash2 className="h-4 w-4" /> Mettre à la corbeille
                                </button>
                            )}
                            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                            <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-white/60 underline">
                                Désélectionner
                            </button>
                        </>
                    ) : (
                        <span>{report}</span>
                    )}
                </div>
            )}
            <div className="mt-4 overflow-hidden rounded-[24px] border border-ink/10 bg-white">
                {rows.length === 0 ? (
                    <p className="p-12 text-center text-ink/55">{empty}</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-paper text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">
                            <tr>
                                <th className="w-10 py-3 pl-5">
                                    <input type="checkbox" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} className="accent-[#ff6a1a]" aria-label="Tout sélectionner" />
                                </th>
                                <th className="px-4 py-3">Article</th>
                                <th className="px-4 py-3">Statut</th>
                                <th className="px-4 py-3">SEO</th>
                                <th className="px-4 py-3">Auteurs</th>
                                <th className="px-4 py-3">Modifié</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((p) => {
                                const st = STATUS_LABELS[p.status] ?? STATUS_LABELS.draft;
                                return (
                                    <tr key={p.id} className={`border-t border-ink/5 hover:bg-paper ${selected.has(p.id) ? "bg-accent/[0.05]" : ""}`}>
                                        <td className="py-3.5 pl-5">
                                            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="accent-[#ff6a1a]" aria-label={`Sélectionner ${p.title}`} />
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <span className="h-11 w-16 shrink-0 overflow-hidden rounded-xl bg-paper2">
                                                    {/* eslint-disable-next-line @next/next/no-img-element -- vignette */}
                                                    {p.thumb && <img src={p.thumb} alt="" className="h-full w-full object-cover" />}
                                                </span>
                                                <div className="min-w-0">
                                                    <Link href={`/dashboard/articles/${p.id}/`} className="font-semibold hover:text-accentdark">
                                                        {p.title}
                                                    </Link>
                                                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink/50">
                                                        {p.categories.map((c) => (
                                                            <span key={c.name} className="inline-flex items-center gap-1">
                                                                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                                                                {c.name}
                                                            </span>
                                                        ))}
                                                        {p.here.length > 0 && (
                                                            <span className="inline-flex items-center gap-1 font-semibold text-accentdark">
                                                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                                                                {p.here.map((h) => `${h.name}${h.editing ? " modifie" : " regarde"}`).join(", ")}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4">
                                            <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${st.className}`}>{st.label}</span>
                                            {p.corrector && <div className="mt-1 text-[11px] text-ink/50">par {p.corrector}</div>}
                                            {p.scheduledAt && (
                                                <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink/50">
                                                    <CalendarClock className="h-3 w-3" />
                                                    {new Date(p.scheduledAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                                </div>
                                            )}
                                            {p.suggestions > 0 && (
                                                <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink/50">
                                                    <MessageSquare className="h-3 w-3" /> {p.suggestions} suggestion{p.suggestions > 1 ? "s" : ""}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4">
                                            {p.seo === null ? (
                                                <span className="text-xs text-ink/35">—</span>
                                            ) : (
                                                <span className="font-display text-lg" style={{ color: scoreTone(p.seo) }}>
                                                    {p.seo}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 text-ink/70">{p.authors.join(", ")}</td>
                                        <td className="whitespace-nowrap px-4 text-ink/55">{relativeDate(p.updatedAt)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
}
