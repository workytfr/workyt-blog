/**
 * Comparaison de deux versions d'un texte (versions d'un article, § 7.2) :
 * d'abord paragraphe par paragraphe, puis mot à mot dans les paragraphes
 * modifiés. Plus longue sous-suite commune, sans dépendance.
 */

export type DiffPart = { kind: "same" | "added" | "removed"; text: string };

/** Plus longue sous-suite commune : opérations pour passer de a à b */
function lcs<T>(a: T[], b: T[]): { kind: DiffPart["kind"]; item: T }[] {
    const n = a.length;
    const m = b.length;
    // Garde-fou mémoire : au-delà, on compare en bloc
    if (n * m > 4_000_000) return [...a.map((item) => ({ kind: "removed" as const, item })), ...b.map((item) => ({ kind: "added" as const, item }))];
    const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out: { kind: DiffPart["kind"]; item: T }[] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            out.push({ kind: "same", item: a[i] });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ kind: "removed", item: a[i++] });
        else out.push({ kind: "added", item: b[j++] });
    }
    while (i < n) out.push({ kind: "removed", item: a[i++] });
    while (j < m) out.push({ kind: "added", item: b[j++] });
    return out;
}

/** Regroupe les morceaux consécutifs de même nature */
function merge(parts: DiffPart[]): DiffPart[] {
    const out: DiffPart[] = [];
    for (const p of parts) {
        const last = out[out.length - 1];
        if (last && last.kind === p.kind) last.text += p.text;
        else if (p.text) out.push({ ...p });
    }
    return out;
}

export function diffWords(a: string, b: string): DiffPart[] {
    const tok = (s: string) => s.match(/\s+|[^\s]+/g) ?? [];
    return merge(lcs(tok(a), tok(b)).map((o) => ({ kind: o.kind, text: o.item })));
}

/** Paragraphes (séparés par une ligne vide) puis mots : une liste de paragraphes à afficher */
export function diffBlocks(a: string[], b: string[]): DiffPart[][] {
    const ops = lcs(a, b);
    const out: DiffPart[][] = [];
    for (let k = 0; k < ops.length; k++) {
        const o = ops[k];
        const next = ops[k + 1];
        // Un paragraphe retiré suivi d'un ajouté : c'est une modification, on compare les mots
        if (o.kind === "removed" && next?.kind === "added") {
            out.push(diffWords(o.item, next.item));
            k++;
        } else out.push([{ kind: o.kind, text: o.item }]);
    }
    return out;
}
