"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Trash2, X } from "lucide-react";

/** Boutons de modération d'un commentaire : publier, refuser, supprimer */
export default function ModerationActions({ id, status }: { id: string; status: string }) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async (key: string, init: RequestInit) => {
        setBusy(key);
        setError(null);
        const j = await fetch(`/api/comments/${id}/`, { headers: { "Content-Type": "application/json" }, ...init })
            .then((r) => r.json())
            .catch(() => ({ success: false, error: "Connexion impossible." }));
        setBusy(null);
        if (!j.success) setError(j.error || "Erreur.");
        else router.refresh();
    };
    const icon = (key: string, Icon: typeof Check) => (busy === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />);

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2">
            {status !== "published" && (
                <button type="button" disabled={!!busy} onClick={() => void run("approve", { method: "POST", body: JSON.stringify({ action: "approve" }) })} className="btn-orange px-4 py-2 text-sm">
                    {icon("approve", Check)} Publier
                </button>
            )}
            {status !== "rejected" && (
                <button type="button" disabled={!!busy} onClick={() => void run("reject", { method: "POST", body: JSON.stringify({ action: "reject" }) })} className="btn-ghost px-4 py-2 text-sm">
                    {icon("reject", X)} {status === "published" ? "Retirer" : "Refuser"}
                </button>
            )}
            <button
                type="button"
                disabled={!!busy}
                onClick={() => {
                    if (confirm("Supprimer définitivement ce commentaire ?")) void run("delete", { method: "DELETE" });
                }}
                className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-ink/45 hover:text-red-600"
            >
                {icon("delete", Trash2)} Supprimer
            </button>
            {error && <p className="w-full text-sm text-red-700">{error}</p>}
        </div>
    );
}
