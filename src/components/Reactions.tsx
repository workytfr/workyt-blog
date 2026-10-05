"use client";

import { useEffect, useState } from "react";
import { REACTIONS, type ReactionKey } from "@/lib/commentRules";
import ReactionIcon from "./ReactionIcon";

type Counts = Partial<Record<ReactionKey, number>>;

/**
 * « Quelle est ta réaction ? » (comme sur l'ancien blog) : une réaction par
 * lecteur, modifiable ; un nouveau clic sur la même la retire. Ouvert à tous,
 * sans compte.
 */
export default function Reactions({ postId, initial }: { postId: string; initial: Counts }) {
    const [counts, setCounts] = useState<Counts>(initial);
    const [mine, setMine] = useState<ReactionKey | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        void fetch(`/api/posts/${postId}/reactions/`)
            .then((r) => r.json())
            .then((j) => {
                if (!j.success) return;
                setCounts(j.data.counts);
                setMine(j.data.mine);
            })
            .catch(() => {});
    }, [postId]);

    const choose = async (key: ReactionKey) => {
        if (busy) return;
        const next = mine === key ? null : key;
        // Affichage immédiat, corrigé par la réponse du serveur
        const prev = { counts, mine };
        const optimistic = { ...counts };
        if (mine) optimistic[mine] = Math.max(0, (optimistic[mine] ?? 1) - 1);
        if (next) optimistic[next] = (optimistic[next] ?? 0) + 1;
        setCounts(optimistic);
        setMine(next);
        setBusy(true);
        try {
            const j = await fetch(`/api/posts/${postId}/reactions/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: next }) }).then((r) => r.json());
            if (!j.success) throw new Error();
            setCounts(j.data.counts);
            setMine(j.data.mine);
        } catch {
            setCounts(prev.counts);
            setMine(prev.mine);
        } finally {
            setBusy(false);
        }
    };

    const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
    return (
        <section aria-labelledby="reactions-titre" className="mt-12 rounded-[28px] border border-ink/10 bg-white p-6 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="reactions-titre" className="font-display text-2xl">
                    Quelle est ta réaction ?
                </h2>
                <span className="text-xs text-ink/45">
                    {total} réaction{total > 1 ? "s" : ""}
                </span>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {REACTIONS.map((r) => {
                    const on = mine === r.key;
                    return (
                        <button
                            key={r.key}
                            type="button"
                            onClick={() => void choose(r.key)}
                            aria-pressed={on}
                            className={`wk-rx-btn group flex flex-col items-center gap-1 rounded-2xl px-1 pb-3 pt-2.5 transition hover:-translate-y-0.5 ${on ? "bg-accent/10 ring-2 ring-accent" : "bg-paper ring-1 ring-ink/5 hover:ring-ink/20"}`}
                        >
                            <span className={`transition ${on ? "scale-110" : "opacity-85 saturate-[.8] group-hover:scale-110 group-hover:opacity-100 group-hover:saturate-100"}`}>
                                <ReactionIcon type={r.key} size={46} />
                            </span>
                            <span className="text-center text-[11.5px] font-semibold leading-tight">{r.label}</span>
                            <span className={`text-sm font-bold ${on ? "text-accentdark" : "text-ink/55"}`}>{counts[r.key] ?? 0}</span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
