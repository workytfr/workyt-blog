/**
 * Lecture du tableau « Suivi de rédaction » (Google Sheets exporté en .xlsx) :
 * onglets « Présence de staff » et « Liste des articles ». Sert à créditer
 * les correcteurs des anciens articles (scripts/import-correcteurs.ts).
 */
import type { Role } from "./roles";

type Cell = string | number | boolean | Date | null | undefined;
export type SheetRows = Cell[][];

export interface StaffEntry {
    discord: string;
    email: string | null;
    firstName: string;
    /** Présent(e) au dernier pointage (les anciens bénévoles et suspendus ne le sont pas) */
    present: boolean;
    /** Rôle sur le blog d'après la colonne « Rôle(s) » ; null : aucun (cours seulement) */
    role: Role | null;
}

export interface ArticleEntry {
    title: string;
    corrector: string;
}

/** Texte comparable : sans accents, casse ni ponctuation */
export function plain(v: Cell): string {
    return String(v ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/œ/g, "oe")
        .replace(/æ/g, "ae")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

/** Clé d'un titre d'article, pour retrouver « L’inscription … ouverte ! » dans le blog */
export const titleKey = (title: Cell) => plain(title).replace(/ /g, "");

/**
 * Ressemblance de deux titres : part des mots porteurs (plus de 3 lettres) du
 * titre du tableau qu'on retrouve dans celui du blog. Le titre a souvent été
 * retouché à la publication (« … illustré en 4 exemples » → « … avec 4 exemples »).
 */
export function titleSimilarity(sheetTitle: Cell, blogTitle: Cell): number {
    const words = plain(sheetTitle)
        .split(" ")
        .filter((w) => w.length > 3);
    if (!words.length) return 0;
    const blog = new Set(plain(blogTitle).split(" "));
    return words.filter((w) => blog.has(w)).length / words.length;
}

/** Pseudo Discord tel qu'il sert de clé (le tableau a parfois un retour à la ligne en trop) */
export const discordKey = (v: Cell) => String(v ?? "").trim().toLowerCase();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NO_CORRECTOR = new Set(["", "none", "aucun", "aucune", "todo", "null", "x"]);

/** Nom affiché : le prénom, sinon le pseudo Discord */
export const displayName = (s: Pick<StaffEntry, "firstName" | "discord">) => s.firstName || s.discord;

/** Rôle sur le blog : la correction l'emporte (un correcteur peut aussi écrire), « Rédaction Cours » seule ne compte pas */
export function blogRole(roles: Cell): Role | null {
    const r = plain(roles);
    if (/\bcorrection\b/.test(r)) return "correcteur";
    if (/\bredaction blog\b/.test(r)) return "redacteur";
    return null;
}

/** Colonne dont l'en-tête correspond (sans accents ni casse) */
function column(header: Cell[], test: RegExp): number {
    return header.findIndex((h) => test.test(plain(h)));
}

export function parseStaff(rows: SheetRows): StaffEntry[] {
    const [header = [], ...data] = rows;
    const col = {
        email: column(header, /^adresse mail$/),
        presence: column(header, /^statut de presence au\b/),
        discord: column(header, /^pseudo discord$/),
        firstName: column(header, /^prenom$/),
        roles: column(header, /^role s$/),
    };
    if (Object.values(col).some((i) => i < 0)) throw new Error(`Onglet « Présence de staff » : colonnes introuvables (${Object.entries(col).filter(([, i]) => i < 0).map(([k]) => k).join(", ")})`);
    return data
        .filter((r) => discordKey(r[col.discord]))
        .map((r) => {
            const email = String(r[col.email] ?? "").trim().toLowerCase();
            return {
                discord: discordKey(r[col.discord]),
                email: EMAIL.test(email) ? email : null,
                firstName: String(r[col.firstName] ?? "").trim(),
                present: plain(r[col.presence]).startsWith("present"),
                role: blogRole(r[col.roles]),
            };
        });
}

export function parseArticles(rows: SheetRows): ArticleEntry[] {
    const [header = [], ...data] = rows;
    const title = column(header, /^nom du cours$/);
    const corrector = column(header, /^correcteur$/);
    if (title < 0 || corrector < 0) throw new Error("Onglet « Liste des articles » : colonnes « Nom du cours » ou « Correcteur » introuvables");
    return data
        .map((r) => ({ title: String(r[title] ?? "").trim(), corrector: discordKey(r[corrector]) }))
        .filter((a) => a.title && !NO_CORRECTOR.has(a.corrector));
}
