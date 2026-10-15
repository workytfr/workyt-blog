/**
 * Expression régulière « contient », insensible à la casse et aux accents :
 * « revision » trouve « Révision », « appli » trouve « application ».
 *
 * C'est ce que faisait la recherche de l'ancien WordPress, et ce qu'attend la
 * recherche de workyt.fr, qui interroge le blog pendant la frappe : un index
 * texte MongoDB ($text) ne reconnaît que des mots entiers.
 */

const VARIANTS: Record<string, string> = {
    a: "aàâä",
    c: "cç",
    e: "eéèêë",
    i: "iîï",
    o: "oôö",
    u: "uùûü",
    y: "yÿ",
};

// Lettre accentuée → lettre de base (pour que « é » saisi trouve aussi « e »)
const BASE: Record<string, string> = {};
for (const [base, all] of Object.entries(VARIANTS)) for (const ch of all) BASE[ch] = base;

const letter = (ch: string) => (BASE[ch] ? `[${VARIANTS[BASE[ch]]}]` : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

export function containsRegex(term: string): RegExp {
    const chars = [...term.trim().toLowerCase()];
    let pattern = "";
    for (let i = 0; i < chars.length; i++) {
        const pair = chars[i] + (chars[i + 1] ?? "");
        // « coeur » trouve « cœur », et inversement
        if (pair === "oe" || pair === "ae") {
            pattern += `(?:${pair === "oe" ? "œ" : "æ"}|${letter(chars[i])}${letter(chars[i + 1])})`;
            i++;
        } else if (chars[i] === "œ" || chars[i] === "æ") {
            pattern += chars[i] === "œ" ? "(?:œ|oe)" : "(?:æ|ae)";
        } else {
            pattern += letter(chars[i]);
        }
    }
    return new RegExp(pattern, "i");
}
