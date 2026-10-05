"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, ExternalLink, Loader2, Search } from "lucide-react";
import type { MediaView } from "@/lib/media";
import type { StockPhoto, StockProvider } from "@/lib/stock";

const NAMES: Record<StockProvider, string> = { pixabay: "Pixabay", pexels: "Pexels" };
const SITES: Record<StockProvider, string> = { pixabay: "https://pixabay.com/", pexels: "https://www.pexels.com/fr-fr/" };
const LICENSES: Record<StockProvider, string> = { pixabay: "Licence Pixabay", pexels: "Licence Pexels" };
const IDEAS = ["révisions", "bibliothèque", "lycée", "ordinateur", "examen", "lecture", "nature"];

/**
 * Banque d'images libres (Pixabay, Pexels) : on cherche, on choisit, on décrit
 * l'image, et elle entre dans la médiathèque avec son crédit déjà rempli.
 */
export default function StockSearch({ onImported }: { onImported: (m: MediaView) => void }) {
    const [providers, setProviders] = useState<StockProvider[] | null>(null);
    const [provider, setProvider] = useState<StockProvider>("pixabay");
    const [q, setQ] = useState("");
    const [results, setResults] = useState<{ key: string; items: StockPhoto[]; total: number; page: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<StockPhoto | null>(null);
    const [alt, setAlt] = useState("");
    const [importing, setImporting] = useState(false);
    const reqId = useRef(0);

    // Banques configurées (clés d'API présentes sur le serveur)
    useEffect(() => {
        void fetch("/api/stock/")
            .then((r) => r.json())
            .then((j) => {
                const list: StockProvider[] = j.success ? j.data.providers : [];
                setProviders(list);
                if (list.length) setProvider(list[0]);
            })
            .catch(() => setProviders([]));
    }, []);

    const search = async (page: number) => {
        const query = q.trim();
        const id = ++reqId.current;
        if (!query) {
            setResults(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const j = await fetch(`/api/stock/?${new URLSearchParams({ provider, q: query, page: String(page) })}`).then((r) => r.json());
            if (id !== reqId.current) return;
            if (!j.success) throw new Error(j.error);
            const key = `${provider}:${query}`;
            setResults((prev) => ({ key, total: j.data.total, page, items: page > 1 && prev?.key === key ? [...prev.items, ...j.data.items] : j.data.items }));
        } catch (e) {
            if (id === reqId.current) setError((e as Error).message || "Recherche impossible.");
        } finally {
            if (id === reqId.current) setLoading(false);
        }
    };

    // Recherche pendant la frappe (après une courte pause)
    useEffect(() => {
        if (!providers?.length) return;
        const t = setTimeout(() => void search(1), 450);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- on relance sur la saisie et la banque seulement
    }, [q, provider, providers]);

    const importPhoto = async () => {
        if (!selected) return;
        setImporting(true);
        setError(null);
        try {
            const j = await fetch("/api/stock/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: selected.provider, id: selected.id, alt }) }).then((r) => r.json());
            if (!j.success) throw new Error(j.error);
            onImported(j.data as MediaView);
        } catch (e) {
            setError((e as Error).message || "Import impossible.");
        } finally {
            setImporting(false);
        }
    };

    if (providers === null)
        return (
            <div className="grid flex-1 place-items-center py-16 text-ink/40">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    if (!providers.length)
        return (
            <div className="p-6 text-sm text-ink/60">
                Aucune banque d&apos;images n&apos;est configurée. Ajoute <code className="rounded bg-paper2 px-1">PIXABAY_API_KEY</code> ou <code className="rounded bg-paper2 px-1">PEXELS_API_KEY</code> dans les réglages du serveur.
            </div>
        );

    // Étape 2 : décrire la photo choisie, puis l'importer
    if (selected)
        return (
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <button type="button" onClick={() => setSelected(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/60 hover:text-ink">
                    <ArrowLeft className="h-4 w-4" /> Retour aux résultats
                </button>
                <div className="mt-4 grid gap-6 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                    <div className="self-start overflow-hidden rounded-2xl bg-paper2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- aperçu servi par la banque d'images */}
                        <img src={selected.thumb} alt="" className="w-full object-cover" />
                    </div>
                    <div className="space-y-4">
                        <label className="block">
                            <span className="text-xs font-semibold text-ink/60">Description de l&apos;image *</span>
                            <textarea value={alt} onChange={(e) => setAlt(e.target.value)} rows={3} autoFocus placeholder="Ce qu'on voit sur la photo, en une phrase" className="mt-1 w-full resize-y rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent" />
                            <span className="mt-1 block text-[11px] text-ink/45">Lue par les lecteurs d&apos;écran et par Google.{selected.tags && <> Mots-clés de la photo : {selected.tags}.</>}</span>
                        </label>
                        <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-ink/10">
                            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink/45">
                                <Check className="h-3.5 w-3.5 text-leaf" /> Crédit rempli automatiquement
                            </p>
                            <p className="mt-2">
                                <Camera className="mr-1 inline h-3.5 w-3.5 text-accent" />
                                <a href={selected.authorUrl} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
                                    {selected.author}
                                </a>{" "}
                                sur {NAMES[selected.provider]} · {LICENSES[selected.provider]}
                            </p>
                            <a href={selected.pageUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-ink/55 hover:text-ink">
                                Voir l&apos;original <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                        <button type="button" onClick={() => void importPhoto()} disabled={importing || !alt.trim()} className="btn-orange w-full justify-center py-2.5 text-sm disabled:opacity-50">
                            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {importing ? "Import en cours…" : "Utiliser cette photo"}
                        </button>
                        <p className="text-[11px] text-ink/45">La photo est copiée dans la médiathèque (elle reste disponible pour d&apos;autres articles).</p>
                    </div>
                </div>
            </div>
        );

    // Étape 1 : chercher
    return (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2.5 text-sm">
                    <Search className="h-4 w-4 text-ink/40" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder={`Chercher une photo libre sur ${NAMES[provider]}…`} className="min-w-0 flex-1 outline-none" />
                    {loading && <Loader2 className="h-4 w-4 animate-spin text-ink/40" />}
                </label>
                {providers.length > 1 && (
                    <div className="flex gap-1 rounded-full border border-ink/10 bg-white p-1 text-sm font-semibold" role="group" aria-label="Banque d'images">
                        {providers.map((p) => (
                            <button key={p} type="button" onClick={() => setProvider(p)} aria-pressed={provider === p} className={`rounded-full px-3 py-1.5 ${provider === p ? "bg-ink text-white" : "text-ink/60"}`}>
                                {NAMES[p]}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            {!q.trim() ? (
                <div className="py-10 text-center">
                    <p className="text-sm text-ink/55">Des photos libres de droits, utilisables sans frais. Le crédit est ajouté tout seul.</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                        {IDEAS.map((i) => (
                            <button key={i} type="button" onClick={() => setQ(i)} className="rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-ink/10 hover:ring-accent">
                                {i}
                            </button>
                        ))}
                    </div>
                </div>
            ) : results && results.items.length === 0 && !loading ? (
                <p className="py-16 text-center text-sm text-ink/55">Aucune photo pour « {q.trim()} ». Essaie un autre mot{providers.length > 1 ? " ou l'autre banque" : ""}.</p>
            ) : (
                <>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {results?.items.map((p) => (
                            <button
                                key={`${p.provider}-${p.id}`}
                                type="button"
                                onClick={() => {
                                    setSelected(p);
                                    setAlt(p.alt);
                                    setError(null);
                                }}
                                className="group relative overflow-hidden rounded-2xl bg-paper2 text-left ring-1 ring-ink/10 hover:ring-2 hover:ring-accent"
                                title={p.alt || p.tags}
                            >
                                <span className="block aspect-[4/3]">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- vignette servie par la banque d'images */}
                                    <img src={p.thumb} alt={p.alt || p.tags} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                                </span>
                                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-ink/70 to-transparent px-2.5 pb-1.5 pt-5 text-[11px] font-semibold text-white">{p.author}</span>
                            </button>
                        ))}
                    </div>
                    {results && results.items.length < results.total && (
                        <div className="mt-5 text-center">
                            <button type="button" onClick={() => void search(results.page + 1)} disabled={loading} className="btn-ghost px-5 py-2 text-sm">
                                {loading ? "Chargement…" : "Plus de photos"}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Mention demandée par les banques d'images */}
            <p className="mt-6 text-center text-[11px] text-ink/45">
                Photos fournies par{" "}
                <a href={SITES[provider]} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                    {NAMES[provider]}
                </a>
            </p>
        </div>
    );
}
