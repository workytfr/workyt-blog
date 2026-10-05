"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Loader2 } from "lucide-react";

/** Crée un brouillon puis ouvre l'éditeur */
export default function NewPostButton({ className = "", compact = false, template, children }: { className?: string; compact?: boolean; template?: string; children?: React.ReactNode }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const create = async () => {
        setBusy(true);
        setError(null);
        try {
            const r = await fetch("/api/posts/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template }) });
            const j = await r.json();
            if (!j.success) throw new Error(j.error);
            router.push(`/dashboard/articles/${j.data.id}/`);
        } catch (e) {
            setError((e as Error).message || "Création impossible.");
            setBusy(false);
        }
    };
    // Bouton libre (modèles d'article)
    if (children) {
        return (
            <button type="button" onClick={create} disabled={busy} className={className}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
            </button>
        );
    }
    if (compact) {
        return (
            <button type="button" onClick={create} disabled={busy} className="btn-orange px-5 py-2.5 text-sm disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />} Nouvel article
            </button>
        );
    }
    return (
        <button type="button" onClick={create} disabled={busy} className={className}>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ffe3cf] text-accentdark">{busy ? <Loader2 className="animate-spin" /> : <FilePlus2 />}</span>
            <span>
                <b className="block">Nouvel article</b>
                <span className="text-sm text-ink/55">{error || "Partir d'une page blanche"}</span>
            </span>
        </button>
    );
}
