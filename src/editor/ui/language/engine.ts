"use client";

import { GRAMMALECTE_DIR, GRAMMALECTE_OPTIONS, type RawIssue } from "@/lib/language/core";

/**
 * Grammalecte dans un Web Worker (public/grammalecte-2.3.0/workyt.js) :
 * chargé à la première ouverture de l'éditeur (≈ 2 Mo compressés, gardés
 * en cache par le navigateur), jamais sur le site public. L'analyse se fait
 * hors du fil principal : la frappe reste fluide.
 */

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
/** Résultats par texte de paragraphe : un paragraphe inchangé n'est jamais relu */
const results = new Map<string, RawIssue[]>();
const MAX_CACHE = 5000;

function call<T>(cmd: string, arg?: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        if (!worker) return reject(new Error("Correcteur arrêté."));
        const id = ++seq;
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
        worker.postMessage({ id, cmd, arg });
    });
}

function failAll(error: Error) {
    for (const p of pending.values()) p.reject(error);
    pending.clear();
}

/** Démarre le correcteur (une seule fois par page) */
export function startEngine(): Promise<void> {
    if (ready) return ready;
    ready = new Promise<void>((resolve, reject) => {
        try {
            worker = new Worker(`/${GRAMMALECTE_DIR}/workyt.js`);
        } catch (e) {
            return reject(e as Error);
        }
        worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
            const p = pending.get(e.data.id);
            if (!p) return;
            pending.delete(e.data.id);
            if (e.data.error) p.reject(new Error(e.data.error));
            else p.resolve(e.data.result);
        };
        worker.onerror = (e) => {
            const error = new Error(e.message || "Correcteur indisponible.");
            failAll(error);
            reject(error);
        };
        call<boolean>("init", GRAMMALECTE_OPTIONS).then(() => resolve(), reject);
    });
    // Échec : on pourra réessayer au prochain chargement de l'éditeur
    ready.catch(() => {
        worker?.terminate();
        worker = null;
        ready = null;
    });
    return ready;
}

export const cachedIssues = (text: string) => results.get(text);

/** Analyse les paragraphes pas encore lus (par lots, pour afficher les résultats au fur et à mesure) */
export async function checkTexts(texts: string[], onBatch?: () => void): Promise<void> {
    const todo = [...new Set(texts)].filter((t) => !results.has(t));
    if (!todo.length) return;
    await startEngine();
    for (let i = 0; i < todo.length; i += 12) {
        const batch = todo.slice(i, i + 12);
        const out = await call<RawIssue[][]>("check", batch);
        batch.forEach((t, k) => results.set(t, out[k] ?? []));
        while (results.size > MAX_CACHE) results.delete(results.keys().next().value!);
        onBatch?.();
    }
}

export const suggestWord = (word: string) => startEngine().then(() => call<string[]>("suggest", word));

export interface SynonymGroup {
    label: string;
    words: string[];
}
export const synonymsOf = (word: string) => startEngine().then(() => call<SynonymGroup[]>("synonyms", word));
