"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { SiteSettings } from "@/lib/settings";

const input = "mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-accent";
const NETWORKS = [
    ["instagram", "Instagram"],
    ["tiktok", "TikTok"],
    ["youtube", "YouTube"],
    ["x", "X (Twitter)"],
    ["linkedin", "LinkedIn"],
    ["discord", "Discord"],
] as const;

export default function SettingsForm({ initial }: { initial: SiteSettings }) {
    const [v, setV] = useState(initial);
    const [state, setState] = useState<"idle" | "busy" | "ok" | string>("idle");
    const save = async () => {
        setState("busy");
        const j = await fetch("/api/settings/", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }).then((r) => r.json());
        setState(j.success ? "ok" : j.error);
    };
    const card = "space-y-4 rounded-[24px] border border-ink/10 bg-white p-6";
    return (
        <div className="mt-8 space-y-6">
            <section className={card}>
                <h2 className="font-display text-2xl">Le blog</h2>
                <label className="block text-xs font-semibold text-ink/60">
                    Description (accueil, pied de page, Google)
                    <textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={3} maxLength={300} className={`${input} resize-y`} />
                    <span className="mt-0.5 block text-right font-normal text-ink/40">{v.description.length}/300 · idéal : 120 à 160</span>
                </label>
            </section>
            <section className={card}>
                <h2 className="font-display text-2xl">Réseaux sociaux</h2>
                <p className="text-sm text-ink/55">Seuls les réseaux renseignés s&apos;affichent en haut du blog.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                    {NETWORKS.map(([k, label]) => (
                        <label key={k} className="block text-xs font-semibold text-ink/60">
                            {label}
                            <input value={v.social[k]} onChange={(e) => setV({ ...v, social: { ...v.social, [k]: e.target.value } })} placeholder="https://…" className={input} />
                        </label>
                    ))}
                </div>
            </section>
            <section className={card}>
                <h2 className="font-display text-2xl">Vérification des moteurs</h2>
                <p className="text-sm text-ink/55">Colle le code (ou la balise entière) donné par Google Search Console ou Bing Webmaster Tools.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-semibold text-ink/60">
                        Google
                        <input value={v.verification.google} onChange={(e) => setV({ ...v, verification: { ...v.verification, google: e.target.value } })} className={`${input} font-mono`} />
                    </label>
                    <label className="block text-xs font-semibold text-ink/60">
                        Bing
                        <input value={v.verification.bing} onChange={(e) => setV({ ...v, verification: { ...v.verification, bing: e.target.value } })} className={`${input} font-mono`} />
                    </label>
                </div>
            </section>
            <div className="flex items-center justify-end gap-3">
                {state === "ok" && (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#2f6e14]">
                        <Check className="h-4 w-4" /> Enregistré
                    </span>
                )}
                {!["idle", "ok", "busy"].includes(state) && <span className="text-sm text-red-700">{state}</span>}
                <button type="button" onClick={save} disabled={state === "busy"} className="btn-orange px-6 py-2.5 text-sm">
                    {state === "busy" && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
                </button>
            </div>
        </div>
    );
}
