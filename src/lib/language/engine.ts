import "server-only";
import type { RawIssue } from "./core";
import { loadBridge, type Bridge } from "./bridge";

/**
 * Grammalecte côté serveur, pour la note SEO enregistrée avec l'article :
 * le même pont que dans l'éditeur, chargé une fois (≈ 1 s, ≈ 150 Mo).
 * Les résultats sont gardés par paragraphe : à chaque enregistrement, seuls
 * les paragraphes modifiés sont relus.
 */

const MAX_CACHE = 20_000;

let bridge: Bridge | null | undefined;
const cache = new Map<string, RawIssue[]>();

/** Fautes de chaque texte, ou null si le moteur ne se charge pas (la note reste neutre) */
export async function checkTexts(texts: string[]): Promise<RawIssue[][] | null> {
    if (bridge === undefined) {
        try {
            bridge = loadBridge();
        } catch (error) {
            console.error("[langue] Grammalecte indisponible :", error);
            bridge = null;
        }
    }
    if (!bridge) return null;
    return texts.map((t) => {
        const hit = cache.get(t);
        if (hit) {
            cache.delete(t);
            cache.set(t, hit);
            return hit;
        }
        let issues: RawIssue[] = [];
        try {
            issues = bridge!.check(t);
        } catch {
            /* paragraphe illisible pour le moteur : rien à signaler */
        }
        cache.set(t, issues);
        while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
        return issues;
    });
}
