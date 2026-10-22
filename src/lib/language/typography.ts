/**
 * « Corriger la typographie » : les règles françaises qu'on n'a pas envie
 * de taper à la main, appliquées d'un coup sur un paragraphe.
 * - apostrophe ’ (l’été, aujourd’hui) ;
 * - espace fine insécable avant ; ! ? et insécable avant : ;
 * - guillemets « » (avec insécables) à la place de "…" et “…” ;
 * - points de suspension … ; pas d'espace avant la virgule ni le point ;
 *   pas de double espace.
 * Fonction pure : renvoie les remplacements à faire, sans toucher au texte.
 */

export interface TypoEdit {
    start: number;
    end: number;
    insert: string;
}

const NBSP = " ";
const THIN = " ";
const SPACES = "   ";

/** Le mot autour de `i` ressemble-t-il à une adresse (on n'y touche pas) ? */
function inUrl(text: string, i: number): boolean {
    let a = i;
    while (a > 0 && !/\s/.test(text[a - 1])) a--;
    let b = i;
    while (b < text.length && !/\s/.test(text[b])) b++;
    return /(:\/\/|^www\.|@)/.test(text.slice(a, b));
}

/** Espace avant une ponctuation double : `space` à la place d'une espace ordinaire, ou insérée */
function spaceBefore(text: string, i: number, space: string, out: TypoEdit[]) {
    const prev = text[i - 1];
    if (prev === undefined || prev === "\n") return;
    if (prev === space) return;
    if (prev === " " || prev === NBSP || prev === THIN) out.push({ start: i - 1, end: i, insert: space });
    else out.push({ start: i, end: i, insert: space });
}

export function typographyFixes(text: string): TypoEdit[] {
    const edits: TypoEdit[] = [];
    let m: RegExpExecArray | null;

    // Guillemets droits ou anglais, par paires dans le paragraphe
    const quotes = [...text.matchAll(/["“”]/g)].map((q) => q.index!);
    if (quotes.length && quotes.length % 2 === 0) {
        quotes.forEach((i, n) => {
            if (n % 2 === 0) {
                // Ouvrant : « + insécable, l'espace qui suivait disparaît
                const end = text[i + 1] === " " ? i + 2 : i + 1;
                edits.push({ start: i, end, insert: `«${NBSP}` });
            } else {
                const start = text[i - 1] === " " ? i - 1 : i;
                edits.push({ start, end: i + 1, insert: `${NBSP}»` });
            }
        });
    }
    // Chevrons déjà là : insécable à l'intérieur
    for (const g of text.matchAll(/[«»]/g)) {
        const i = g.index!;
        if (g[0] === "«") {
            const next = text[i + 1];
            if (next === undefined || next === NBSP || next === THIN) continue;
            edits.push(next === " " ? { start: i + 1, end: i + 2, insert: NBSP } : { start: i + 1, end: i + 1, insert: NBSP });
        } else {
            const prev = text[i - 1];
            if (prev === undefined || prev === NBSP || prev === THIN) continue;
            edits.push(prev === " " ? { start: i - 1, end: i, insert: NBSP } : { start: i, end: i, insert: NBSP });
        }
    }

    // Apostrophe entre deux lettres
    const apos = /(?<=\p{L})'(?=\p{L})/gu;
    while ((m = apos.exec(text))) if (!inUrl(text, m.index)) edits.push({ start: m.index, end: m.index + 1, insert: "’" });

    // Points de suspension
    const dots = /(?<!\.)\.\.\.(?!\.)/g;
    while ((m = dots.exec(text))) edits.push({ start: m.index, end: m.index + 3, insert: "…" });

    // Ponctuations doubles
    for (let i = 1; i < text.length; i++) {
        const c = text[i];
        if (c !== ";" && c !== "!" && c !== "?" && c !== ":") continue;
        const prev = text[i - 1];
        const next = text[i + 1];
        // « ?! », « !!! » : seule la première prend l'espace
        if (";!?:".includes(prev)) continue;
        if (inUrl(text, i)) continue;
        if (c === ":") {
            // Heures, ratios (14:30, 2:1), « :: », smileys
            if (/\d/.test(prev) && /\d/.test(next ?? "")) continue;
            if (next !== undefined && ":)(/-DPp".includes(next) && !SPACES.includes(next)) continue;
            spaceBefore(text, i, NBSP, edits);
        } else {
            // Smileys « ;) » « ;-) »
            if (c === ";" && next !== undefined && ")(-".includes(next)) continue;
            spaceBefore(text, i, THIN, edits);
        }
    }

    // Pas d'espace avant la virgule ni le point final
    const before = /(?<=[\p{L}\p{N})»])[   ]+(?=[,.](?!\.)(?:\s|$))/gu;
    while ((m = before.exec(text))) edits.push({ start: m.index, end: m.index + m[0].length, insert: "" });

    // Doubles espaces
    const doubles = / {2,}/g;
    while ((m = doubles.exec(text))) edits.push({ start: m.index, end: m.index + m[0].length, insert: " " });

    // Dans l'ordre, sans chevauchement (la première règle l'emporte)
    edits.sort((a, b) => a.start - b.start || a.end - b.end);
    const out: TypoEdit[] = [];
    for (const e of edits) {
        const last = out[out.length - 1];
        if (last && (e.start < last.end || (e.start === last.start && e.end === last.end))) continue;
        out.push(e);
    }
    return out;
}

/** Applique les remplacements (tests, aperçu) */
export function applyTypography(text: string, edits = typographyFixes(text)): string {
    let s = text;
    for (const e of [...edits].reverse()) s = s.slice(0, e.start) + e.insert + s.slice(e.end);
    return s;
}
