"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, GripVertical } from "lucide-react";

export interface CalItem {
    id: string;
    title: string;
    status: "scheduled" | "published";
    at: string;
    color: string;
    category: string;
}

const DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * Grille du calendrier. Les articles planifiés (bleu ciel) se déplacent par
 * glisser-déposer : même heure, autre jour. Les publiés (vert) sont fixes.
 */
export default function CalendarView({ items: initial, mode, anchor, start, canMove }: { items: CalItem[]; mode: "mois" | "semaine"; anchor: string; start: string; canMove: boolean }) {
    const [items, setItems] = useState(initial);
    const [dragging, setDragging] = useState<string | null>(null);
    const [over, setOver] = useState<string | null>(null);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const first = new Date(start);
    const days = Array.from({ length: mode === "semaine" ? 7 : 42 }, (_, i) => {
        const d = new Date(first);
        d.setDate(first.getDate() + i);
        return d;
    });
    // Mois affiché : on retire la dernière semaine si elle est entièrement hors du mois
    const month = mode === "mois" ? Number(anchor.split("-")[1]) - 1 : -1;
    const visible = mode === "mois" && days.slice(35).every((d) => d.getMonth() !== month) ? days.slice(0, 35) : days;
    const byDay = new Map<string, CalItem[]>();
    for (const it of items) {
        const k = keyOf(new Date(it.at));
        byDay.set(k, [...(byDay.get(k) ?? []), it].sort((a, b) => a.at.localeCompare(b.at)));
    }

    // Navigation
    const shift = (n: number) => {
        if (mode === "semaine") {
            const d = new Date(`${anchor}T12:00:00`);
            d.setDate(d.getDate() + 7 * n);
            return `/dashboard/calendrier/?semaine=${keyOf(d)}`;
        }
        const [y, m] = anchor.split("-").map(Number);
        const d = new Date(y, m - 1 + n, 1);
        return `/dashboard/calendrier/?mois=${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    };
    const today = keyOf(new Date());
    const label =
        mode === "mois"
            ? new Date(`${anchor}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
            : `Semaine du ${first.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;

    const drop = async (day: Date) => {
        const it = items.find((x) => x.id === dragging);
        setDragging(null);
        setOver(null);
        if (!it || keyOf(new Date(it.at)) === keyOf(day)) return;
        const old = new Date(it.at);
        const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), old.getHours(), old.getMinutes());
        const j = await fetch(`/api/posts/${it.id}/schedule/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ at: next.toISOString() }) }).then((r) => r.json());
        if (j.success) {
            setItems((l) => l.map((x) => (x.id === it.id ? { ...x, at: j.data.scheduledAt } : x)));
            setMessage({ ok: true, text: `« ${it.title} » passe au ${next.toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}.` });
        } else setMessage({ ok: false, text: j.error });
    };

    return (
        <div className="mt-6">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                    <Link href={shift(-1)} className="grid h-9 w-9 place-items-center rounded-full border border-ink/10 bg-white hover:bg-paper2" aria-label="Précédent">
                        <ChevronLeft className="h-4 w-4" />
                    </Link>
                    <Link href={shift(1)} className="grid h-9 w-9 place-items-center rounded-full border border-ink/10 bg-white hover:bg-paper2" aria-label="Suivant">
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                </div>
                <h2 className="font-display text-2xl first-letter:uppercase">{label}</h2>
                <Link href={mode === "mois" ? "/dashboard/calendrier/" : `/dashboard/calendrier/?semaine=${today}`} className="text-sm font-semibold text-ink/50 underline">
                    Aujourd&apos;hui
                </Link>
                <div className="ml-auto flex gap-1 rounded-full border border-ink/10 bg-white p-1 text-sm font-semibold">
                    <Link href={`/dashboard/calendrier/?mois=${keyOf(first).slice(0, 7)}`} className={`rounded-full px-3.5 py-1.5 ${mode === "mois" ? "bg-ink text-white" : "text-ink/60"}`}>
                        Mois
                    </Link>
                    <Link href={`/dashboard/calendrier/?semaine=${mode === "semaine" ? anchor : today}`} className={`rounded-full px-3.5 py-1.5 ${mode === "semaine" ? "bg-ink text-white" : "text-ink/60"}`}>
                        Semaine
                    </Link>
                </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink/55">
                <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#2f86b3]" /> Planifié {canMove && "(glisse-le sur un autre jour)"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#3f8a1f]" /> Publié
                </span>
                {message && <span className={`ml-auto rounded-full px-3 py-1 font-semibold ${message.ok ? "bg-leaf/20 text-[#2f6e14]" : "bg-red-50 text-red-700"}`}>{message.text}</span>}
            </div>

            <div className="mt-4 overflow-hidden rounded-[24px] border border-ink/10 bg-white">
                <div className="grid grid-cols-7 border-b border-ink/10 bg-paper text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">
                    {DAYS.map((d, i) => (
                        <div key={d} className="py-2.5">
                            {d} {mode === "semaine" && visible[i].getDate()}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {visible.map((d) => {
                        const k = keyOf(d);
                        const outside = mode === "mois" && d.getMonth() !== month;
                        return (
                            <div
                                key={k}
                                onDragOver={(e) => {
                                    if (!dragging) return;
                                    e.preventDefault();
                                    setOver(k);
                                }}
                                onDragLeave={() => setOver((o) => (o === k ? null : o))}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    void drop(d);
                                }}
                                className={`border-b border-r border-ink/5 p-1.5 ${mode === "semaine" ? "min-h-[420px]" : "min-h-[118px]"} ${outside ? "bg-paper/60" : ""} ${over === k ? "bg-sky/15 ring-2 ring-inset ring-sky" : ""}`}
                            >
                                {mode === "mois" && <div className={`mb-1 grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${k === today ? "bg-accent text-white" : outside ? "text-ink/30" : "text-ink/60"}`}>{d.getDate()}</div>}
                                <div className="space-y-1.5">
                                    {(byDay.get(k) ?? []).map((it) => {
                                        const movable = canMove && it.status === "scheduled";
                                        return (
                                            <Link
                                                key={it.id}
                                                href={`/dashboard/articles/${it.id}/`}
                                                draggable={movable}
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData("text/plain", it.id);
                                                    setDragging(it.id);
                                                }}
                                                onDragEnd={() => setDragging(null)}
                                                title={`${it.title} · ${it.category}`}
                                                className={`group relative block rounded-2xl border bg-white p-2 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(26,21,18,0.09)] ${it.status === "scheduled" ? "border-sky/50" : "border-ink/[0.08]"} ${movable ? "cursor-grab active:cursor-grabbing" : ""} ${dragging === it.id ? "opacity-40" : ""}`}
                                            >
                                                {/* Rubrique · statut, comme l'en-tête des cartes de workyt.fr */}
                                                <span className="flex min-w-0 items-center gap-1">
                                                    <span className="flex min-w-0 flex-1 items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: it.color }}>
                                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: it.color }} />
                                                        <span className="truncate">{it.category || "Sans rubrique"}</span>
                                                    </span>
                                                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${it.status === "scheduled" ? "bg-[#2f86b3]" : "bg-[#3f8a1f]"}`} title={it.status === "scheduled" ? "Planifié" : "Publié"} />
                                                </span>
                                                <span className="mt-1 line-clamp-2 font-display text-[13px] leading-[1.15] text-ink group-hover:text-accentdark">{it.title}</span>
                                                <span className="mt-1.5 flex items-center gap-1 border-t border-ink/[0.06] pt-1.5 text-[10px] text-ink/50">
                                                    <Clock className="h-2.5 w-2.5" /> {time(it.at)}
                                                    <span className={`ml-auto font-semibold ${it.status === "scheduled" ? "text-[#2f86b3]" : "text-[#3f8a1f]"}`}>{it.status === "scheduled" ? "Planifié" : "Publié"}</span>
                                                    {movable && <GripVertical className="h-3 w-3 shrink-0 text-ink/30" />}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
