import "server-only";
import mongoose from "mongoose";
import { connectDB } from "../db";
import { can } from "../roles";
import { PostError, type Actor } from "../posts";
import { DEFAULT_WORDS, dictKey } from "./core";
import DictionaryWord from "@/models/DictionaryWord";

/**
 * Dictionnaire Workyt : les mots que le correcteur accepte pour toute la
 * rédaction (noms d'applis, anglicismes, jargon scolaire…). Tout rédacteur
 * peut en ajouter ; on retire les siens, la rédaction en chef retire tout.
 */

export interface DictionaryEntry {
    key: string;
    word: string;
    addedBy: string;
    /** Peut être retiré par la personne connectée */
    removable: boolean;
    /** Mot de départ, inscrit dans le code */
    builtin: boolean;
}

const MAX_WORDS = 5000;

/** Un mot : lettres, chiffres, apostrophe, trait d'union, point (« e.g. »), 40 caractères au plus */
export function cleanWord(raw: unknown): string {
    const w = typeof raw === "string" ? raw.normalize("NFC").trim().replace(/[’`]/g, "'") : "";
    if (!w || w.length > 40 || !/^[\p{L}\p{N}][\p{L}\p{N}'\-.·]*$/u.test(w)) throw new PostError("Un seul mot, sans espace (lettres, chiffres, apostrophe ou trait d'union).");
    return w;
}

export async function listDictionary(actor: Actor): Promise<DictionaryEntry[]> {
    await connectDB();
    const chief = can(actor.role, "team.manage");
    const rows = await DictionaryWord.find().sort({ key: 1 }).limit(MAX_WORDS).lean();
    const builtin = DEFAULT_WORDS.map((w) => ({ key: dictKey(w), word: w, addedBy: "Workyt", removable: false, builtin: true }));
    const added = rows.map((r) => ({ key: r.key, word: r.word, addedBy: r.addedBy, removable: chief || String(r.member ?? "") === actor.memberId, builtin: false }));
    const keys = new Set(builtin.map((b) => b.key));
    return [...builtin, ...added.filter((a) => !keys.has(a.key))].sort((a, b) => a.key.localeCompare(b.key, "fr"));
}

/** Clés de tous les mots acceptés (note SEO enregistrée) */
export async function dictionaryKeys(): Promise<Set<string>> {
    await connectDB();
    const rows = await DictionaryWord.find().select("key").limit(MAX_WORDS).lean();
    return new Set([...DEFAULT_WORDS.map(dictKey), ...rows.map((r) => r.key)]);
}

export async function addWord(actor: Actor, raw: unknown): Promise<DictionaryEntry> {
    if (!can(actor.role, "post.create")) throw new PostError("Réservé à la rédaction.", 403);
    const word = cleanWord(raw);
    const key = dictKey(word);
    await connectDB();
    if ((await DictionaryWord.estimatedDocumentCount()) >= MAX_WORDS) throw new PostError("Le dictionnaire est plein : retire d'abord des mots inutiles.");
    await DictionaryWord.updateOne({ key }, { $setOnInsert: { key, word, addedBy: actor.name, member: mongoose.isValidObjectId(actor.memberId) ? actor.memberId : undefined } }, { upsert: true });
    return { key, word, addedBy: actor.name, removable: true, builtin: false };
}

export async function removeWord(actor: Actor, rawKey: unknown) {
    if (!can(actor.role, "post.create")) throw new PostError("Réservé à la rédaction.", 403);
    const key = typeof rawKey === "string" ? dictKey(rawKey) : "";
    if (DEFAULT_WORDS.some((w) => dictKey(w) === key)) throw new PostError("Ce mot fait partie du dictionnaire de départ.");
    await connectDB();
    const row = await DictionaryWord.findOne({ key }).select("member").lean();
    if (!row) return;
    if (!can(actor.role, "team.manage") && String(row.member ?? "") !== actor.memberId) throw new PostError("Seule la personne qui l'a ajouté, ou la rédaction en chef, peut retirer ce mot.", 403);
    await DictionaryWord.deleteOne({ key });
}
