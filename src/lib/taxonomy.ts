import "server-only";
import mongoose from "mongoose";
import { connectDB } from "./db";
import { can } from "./roles";
import { PostError, slugify, type Actor } from "./posts";
import { invalidateRedirects, normalizePath } from "./redirects";
import Category from "@/models/Category";
import Tag from "@/models/Tag";
import Post from "@/models/Post";
import Redirect from "@/models/Redirect";

/**
 * Rubriques et étiquettes (§ 13) : arbre, adresses, descriptions SEO.
 * Changer une adresse crée une redirection 301 (comme pour un article).
 * Réservé au Rédacteur en chef et aux Admins.
 */

const assert = (actor: Actor) => {
    if (!can(actor.role, "taxonomy.manage")) throw new PostError("Réservé au Rédacteur en chef et aux Admins.", 403);
};
const isId = (v: unknown): v is string => typeof v === "string" && mongoose.isValidObjectId(v);
const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export interface CategoryRow {
    id: string;
    slug: string;
    name: string;
    description: string;
    color: string;
    parentId: string | null;
    order: number;
    inMenu: boolean;
    seoTitle: string;
    seoDescription: string;
    count: number;
}

export async function listCategories(): Promise<CategoryRow[]> {
    await connectDB();
    const [cats, counts] = await Promise.all([
        Category.find({}).sort({ order: 1, name: 1 }).lean(),
        Post.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([{ $match: { status: { $ne: "trash" } } }, { $unwind: "$categories" }, { $group: { _id: "$categories", n: { $sum: 1 } } }]),
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c.n]));
    return cats.map((c) => ({
        id: String(c._id),
        slug: c.slug,
        name: c.name,
        description: c.description || "",
        color: c.color || "#ff6a1a",
        parentId: c.parent ? String(c.parent) : null,
        order: c.order ?? 0,
        inMenu: c.inMenu !== false,
        seoTitle: c.seo?.title || "",
        seoDescription: c.seo?.description || "",
        count: byId.get(String(c._id)) ?? 0,
    }));
}

/** Adresse changée : redirection 301 de l'ancienne (page et flux) vers la nouvelle */
async function redirectBase(base: "category" | "tag", from: string, to: string) {
    const pairs = [[`/${base}/${from}/`, `/${base}/${to}/`], ...(base === "category" ? [[`/${base}/${from}/feed/`, `/${base}/${to}/feed/`]] : [])];
    for (const [f, t] of pairs) {
        await Redirect.findOneAndUpdate({ from: normalizePath(f) }, { to: t, status: 301, source: "slug-change" }, { upsert: true });
        await Redirect.deleteOne({ from: normalizePath(t) });
    }
    invalidateRedirects();
}

async function uniqueTaxSlug(model: "category" | "tag", wanted: string, excludeId?: string) {
    const M = (model === "category" ? Category : Tag) as unknown as mongoose.Model<{ slug: string }>;
    let slug = wanted;
    for (let i = 2; await M.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); i++) slug = `${wanted}-${i}`;
    return slug;
}

export async function saveCategory(actor: Actor, id: string | null, input: Record<string, unknown>) {
    assert(actor);
    await connectDB();
    const name = s(input.name, 80);
    if (!name) throw new PostError("Donne un nom à la rubrique.");
    const parent = isId(input.parentId) ? input.parentId : null;
    if (parent && parent === id) throw new PostError("Une rubrique ne peut pas être sa propre parente.");
    if (parent) {
        const p = await Category.findById(parent).select("parent").lean();
        if (!p) throw new PostError("Rubrique parente introuvable.");
        // Deux niveaux au plus (comme le menu) : pas de parent qui a lui-même un parent
        if (p.parent) throw new PostError("Une sous-rubrique ne peut pas avoir de sous-rubriques.");
    }
    const color = /^#[0-9a-f]{6}$/i.test(String(input.color)) ? String(input.color) : "#ff6a1a";
    const data = {
        name,
        description: s(input.description, 600),
        color,
        parent,
        order: Number.isFinite(Number(input.order)) ? Number(input.order) : 0,
        inMenu: input.inMenu !== false,
        seo: { title: s(input.seoTitle, 120) || undefined, description: s(input.seoDescription, 320) || undefined },
    };
    const wanted = slugify(s(input.slug, 80) || name);
    if (!id) {
        const c = await Category.create({ ...data, slug: await uniqueTaxSlug("category", wanted) });
        return String(c._id);
    }
    if (!isId(id)) throw new PostError("Rubrique introuvable.", 404);
    const c = await Category.findById(id);
    if (!c) throw new PostError("Rubrique introuvable.", 404);
    if (parent && (await Category.exists({ parent: id }))) throw new PostError("Cette rubrique a des sous-rubriques : elle reste au premier niveau.");
    if (wanted !== c.slug) {
        const next = await uniqueTaxSlug("category", wanted, id);
        await redirectBase("category", c.slug, next);
        c.slug = next;
    }
    c.set(data);
    await c.save();
    return id;
}

export async function deleteCategory(actor: Actor, id: string) {
    assert(actor);
    await connectDB();
    if (!isId(id)) throw new PostError("Rubrique introuvable.", 404);
    const [kids, posts] = await Promise.all([Category.countDocuments({ parent: id }), Post.countDocuments({ categories: id, status: { $ne: "trash" } })]);
    if (kids) throw new PostError("Elle a des sous-rubriques : déplace-les ou supprime-les d'abord.", 409);
    if (posts) throw new PostError(`${posts} article${posts > 1 ? "s" : ""} y ${posts > 1 ? "sont rangés" : "est rangé"} : change-les de rubrique d'abord.`, 409);
    await Category.deleteOne({ _id: id });
}

export interface TagRow {
    id: string;
    slug: string;
    name: string;
    description: string;
    count: number;
}

export async function listTags(): Promise<TagRow[]> {
    await connectDB();
    const [tags, counts] = await Promise.all([
        Tag.find({}).sort({ name: 1 }).lean(),
        Post.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([{ $match: { status: { $ne: "trash" } } }, { $unwind: "$tags" }, { $group: { _id: "$tags", n: { $sum: 1 } } }]),
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c.n]));
    return tags.map((t) => ({ id: String(t._id), slug: t.slug, name: t.name, description: t.description || "", count: byId.get(String(t._id)) ?? 0 }));
}

export async function saveTag(actor: Actor, id: string, input: Record<string, unknown>) {
    assert(actor);
    await connectDB();
    if (!isId(id)) throw new PostError("Étiquette introuvable.", 404);
    const t = await Tag.findById(id);
    if (!t) throw new PostError("Étiquette introuvable.", 404);
    const name = s(input.name, 80);
    if (!name) throw new PostError("Donne un nom à l'étiquette.");
    const wanted = slugify(s(input.slug, 80) || name);
    if (wanted !== t.slug) {
        const next = await uniqueTaxSlug("tag", wanted, id);
        await redirectBase("tag", t.slug, next);
        t.slug = next;
    }
    t.name = name;
    t.description = s(input.description, 600);
    await t.save();
}

/** Fusionne une étiquette dans une autre : articles retagués, ancienne adresse redirigée */
export async function mergeTag(actor: Actor, id: string, into: string) {
    assert(actor);
    await connectDB();
    if (!isId(id) || !isId(into) || id === into) throw new PostError("Choisis une autre étiquette.");
    const [from, to] = await Promise.all([Tag.findById(id), Tag.findById(into)]);
    if (!from || !to) throw new PostError("Étiquette introuvable.", 404);
    await Post.updateMany({ tags: from._id }, { $addToSet: { tags: to._id } });
    await Post.updateMany({ tags: from._id }, { $pull: { tags: from._id } });
    await redirectBase("tag", from.slug, to.slug);
    await from.deleteOne();
}

export async function deleteTag(actor: Actor, id: string) {
    assert(actor);
    await connectDB();
    if (!isId(id)) throw new PostError("Étiquette introuvable.", 404);
    await Post.updateMany({ tags: id }, { $pull: { tags: id } });
    await Tag.deleteOne({ _id: id });
}
