"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CORRECTION_PLACE_LABELS, CORRECTION_PLACES, type CorrectionPlace, type CorrectorInfo } from "@/lib/correction";
import CorrectionPlaceIcon from "@/components/CorrectionPlaceIcon";

export type CorrectorOption = { key: string; name: string; account: boolean };

const field = "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60";
const lbl = "text-xs font-semibold text-ink/60";

/**
 * Correcteur de l'article (onglet Article). Pris automatiquement dans le
 * circuit du blog ; la rédaction en chef peut le choisir à la main et dire où
 * la correction a été faite (demandes de modification sur Google Docs, Discord…).
 * Un correcteur peut s'y déclarer lui-même (`options` : lui seul).
 * `options` absent : lecture seule.
 */
export default function CorrectorField({ postId, initial, options, locked }: { postId: string; initial: CorrectorInfo; options: CorrectorOption[] | null; locked: boolean }) {
    const [value, setValue] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async (who: string | null, via: CorrectionPlace | null) => {
        setBusy(true);
        setError(null);
        const j = await fetch(`/api/posts/${postId}/corrector/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ who, via }) })
            .then((r) => r.json())
            .catch(() => ({ success: false, error: "Connexion impossible." }));
        setBusy(false);
        if (j.success) setValue(j.data);
        else setError(j.error || "Non enregistré.");
    };

    const place = value.via ? CORRECTION_PLACE_LABELS[value.via] : null;
    if (!options)
        return (
            <div>
                <span className={lbl}>Correcteur</span>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm">
                    {value.name ?? "—"}
                    {value.name && value.via && (
                        <span className="inline-flex items-center gap-1 text-ink/50">
                            · <CorrectionPlaceIcon place={value.via} /> {place}
                        </span>
                    )}
                </p>
            </div>
        );

    // Un ancien correcteur qui n'est plus dans la liste reste affiché
    const list = value.key && !options.some((o) => o.key === value.key) ? [{ key: value.key, name: value.name ?? "?", account: value.key.startsWith("m:") }, ...options] : options;
    return (
        <div>
            <span className="flex items-center gap-2">
                <span className={lbl}>Correcteur</span>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink/40" />}
            </span>
            <select
                value={value.key ?? ""}
                disabled={busy || locked}
                onChange={(e) => save(e.target.value || null, e.target.value ? value.via : null)}
                aria-label="Correcteur de l'article"
                title={locked ? "En cours de correction sur le blog : le correcteur est celui qui l'a pris." : undefined}
                className={`${field} mt-2`}
            >
                <option value="">Pas de correcteur</option>
                {list.map((o) => (
                    <option key={o.key} value={o.key}>
                        {o.name}
                        {o.account ? "" : " (sans compte)"}
                    </option>
                ))}
            </select>
            {value.key && (
                <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Où la correction a été faite">
                    {CORRECTION_PLACES.map((p) => (
                        <button
                            key={p}
                            type="button"
                            role="radio"
                            aria-checked={value.via === p}
                            disabled={busy}
                            onClick={() => save(value.key, value.via === p ? null : p)}
                            className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-2.5 text-[11px] font-semibold ${value.via === p ? "bg-ink text-white" : "border border-ink/12 bg-white text-ink/60 hover:text-ink"}`}
                        >
                            <span className={`grid h-[18px] w-[18px] place-items-center rounded-full ${value.via === p ? "bg-white" : ""}`}>
                                <CorrectionPlaceIcon place={p} className="h-3.5 w-3.5" />
                            </span>
                            {CORRECTION_PLACE_LABELS[p]}
                        </button>
                    ))}
                </div>
            )}
            <span className="mt-1.5 block text-[11px] text-ink/45">
                {value.key ? "Où la correction a été faite (visible de la rédaction seulement). " : ""}Crédité sous l&apos;article : « Relu et corrigé par ».
            </span>
            {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
        </div>
    );
}
