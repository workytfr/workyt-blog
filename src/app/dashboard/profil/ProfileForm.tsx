"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

export default function ProfileForm({ initial }: { initial: { bio: string; title: string } }) {
    const [v, setV] = useState(initial);
    const [state, setState] = useState<"idle" | "busy" | "ok" | string>("idle");
    const save = async () => {
        setState("busy");
        const j = await fetch("/api/me/author/", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }).then((r) => r.json());
        setState(j.success ? "ok" : j.error);
    };
    const field = "mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-accent";
    return (
        <div className="mt-6 space-y-4 rounded-[24px] border border-ink/10 bg-white p-6">
            <label className="block text-xs font-semibold text-ink/60">
                Fonction (sous ton nom)
                <input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Rédactrice, élève de terminale…" maxLength={60} className={field} />
            </label>
            <label className="block text-xs font-semibold text-ink/60">
                Bio (2 ou 3 phrases)
                <textarea value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} rows={4} maxLength={600} placeholder="Qui es-tu, de quoi aimes-tu parler ?" className={`${field} resize-y`} />
                <span className="mt-0.5 block text-right font-normal text-ink/40">{v.bio.length}/600</span>
            </label>
            <div className="flex items-center justify-end gap-3">
                {state === "ok" && (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#2f6e14]">
                        <Check className="h-4 w-4" /> Enregistré
                    </span>
                )}
                {state !== "idle" && state !== "ok" && state !== "busy" && <span className="text-sm text-red-700">{state}</span>}
                <button type="button" onClick={save} disabled={state === "busy"} className="btn-orange px-5 py-2.5 text-sm">
                    {state === "busy" && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
                </button>
            </div>
        </div>
    );
}
