"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Heart, Loader2, Lock, Undo2 } from "lucide-react";
import type { InvitationView } from "@/lib/review";

export default function Invitations({ initial }: { initial: InvitationView[] }) {
    const [items, setItems] = useState(initial);
    if (!items.length) return <p className="mt-8 rounded-[24px] border border-dashed border-ink/15 bg-white p-12 text-center text-ink/55">Aucune invitation pour l&apos;instant.</p>;
    return (
        <div className="mt-8 space-y-5">
            {items.map((it) => (
                <Invitation
                    key={`${it.postId}-${it.moduleId}`}
                    it={it}
                    onChange={(next) => setItems((l) => (next ? l.map((x) => (x.postId === it.postId && x.moduleId === it.moduleId ? next : x)) : l.filter((x) => !(x.postId === it.postId && x.moduleId === it.moduleId))))}
                />
            ))}
        </div>
    );
}

function Invitation({ it, onChange }: { it: InvitationView; onChange: (next: InvitationView | null) => void }) {
    const [why, setWhy] = useState(it.data.why);
    const [name, setName] = useState(it.data.name);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const validated = it.data.status === "validated" && why === it.data.why && name === it.data.name;

    const send = async (body: Record<string, unknown>) => {
        setBusy(true);
        setError(null);
        const j = await fetch(`/api/posts/${it.postId}/modules/${it.moduleId}/guest/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
        setBusy(false);
        if (!j.success) return setError(j.error);
        onChange(j.data ? { ...it, data: j.data.data } : null);
    };

    return (
        <article className="overflow-hidden rounded-[28px] border border-ink/10 bg-white">
            <div className="flex items-center gap-3 bg-[#fff1ea] px-6 py-4">
                <Heart className="h-5 w-5 text-accent" fill="currentColor" />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{it.postTitle}</p>
                    <p className="text-xs text-ink/55">Article de {it.authors.join(", ") || "la rédaction"}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${it.data.status === "validated" ? "bg-leaf/25 text-[#2f6e14]" : "bg-sun/30 text-[#8a560a]"}`}>{it.data.status === "validated" ? "Validé" : "À écrire"}</span>
            </div>
            <div className="space-y-3 p-6">
                {it.locked ? (
                    <p className="flex items-center gap-2 rounded-xl bg-paper2 px-3 py-2 text-sm text-ink/60">
                        <Lock className="h-4 w-4" /> L&apos;article est publié : ton coup de cœur ne peut plus changer.
                    </p>
                ) : null}
                <label className="block text-xs font-semibold text-ink/60">
                    Ton coup de cœur ({it.data.kind})
                    <input value={name} disabled={it.locked} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent disabled:bg-paper2" />
                </label>
                <label className="block text-xs font-semibold text-ink/60">
                    Pourquoi tu l&apos;aimes (2 ou 3 phrases, signées de ton nom)
                    <textarea value={why} disabled={it.locked} onChange={(e) => setWhy(e.target.value)} rows={4} maxLength={700} className="mt-1 w-full resize-y rounded-xl border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent disabled:bg-paper2" />
                    <span className="mt-0.5 block text-right text-[11px] font-normal text-ink/40">{why.length}/700</span>
                </label>
                {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                {!it.locked && (
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" disabled={busy || validated || !why.trim()} onClick={() => send({ why, name, validate: true })} className="btn-orange px-5 py-2 text-sm disabled:opacity-50">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {validated ? "Validé" : "Valider mon texte"}
                        </button>
                        <Link href={`/apercu/${it.postId}/`} target="_blank" className="btn-ghost px-4 py-2 text-sm">
                            Voir l&apos;article
                        </Link>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => window.confirm("Retirer ta contribution ? Ton texte sera effacé de l'article.") && send({ withdraw: true })}
                            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-ink/50 hover:text-red-700"
                        >
                            <Undo2 className="h-3.5 w-3.5" /> Retirer ma contribution
                        </button>
                    </div>
                )}
            </div>
        </article>
    );
}
