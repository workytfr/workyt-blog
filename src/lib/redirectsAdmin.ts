import "server-only";
import mongoose from "mongoose";
import { connectDB } from "./db";
import { can } from "./roles";
import { PostError, type Actor } from "./posts";
import { invalidateRedirects, normalizePath } from "./redirects";
import Redirect from "@/models/Redirect";
import NotFoundHit from "@/models/NotFoundHit";

/** Gestion des redirections et du journal des 404 (§ 13, Admin) */

const assert = (actor: Actor) => {
    if (!can(actor.role, "redirects.manage")) throw new PostError("Réservé aux Admins.", 403);
};

export interface RedirectRow {
    id: string;
    from: string;
    to: string;
    status: 301 | 302 | 410;
    source: string;
    hits: number;
    lastHitAt: string | null;
}

export async function listRedirects(q = ""): Promise<RedirectRow[]> {
    await connectDB();
    const term = q.trim().toLowerCase();
    const filter = term ? { $or: [{ from: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } }, { to: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }] } : {};
    return (await Redirect.find(filter).sort({ updatedAt: -1 }).limit(300).lean()).map((r) => ({
        id: String(r._id),
        from: r.from,
        to: r.to || "",
        status: r.status as RedirectRow["status"],
        source: r.source || "manual",
        hits: r.hits || 0,
        lastHitAt: r.lastHitAt ? new Date(r.lastHitAt).toISOString() : null,
    }));
}

/** Cible valide : adresse du blog (« /mon-article/ ») ou adresse externe http(s) */
function cleanTarget(to: unknown): string {
    const t = typeof to === "string" ? to.trim() : "";
    if (/^\/(?!\/)/.test(t)) return normalizePath(t);
    try {
        const u = new URL(t);
        if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
    } catch {
        /* rien */
    }
    throw new PostError("Destination invalide : une adresse du blog (« /mon-article/ ») ou une adresse complète (https://…).");
}

export async function saveRedirect(actor: Actor, id: string | null, input: Record<string, unknown>) {
    assert(actor);
    await connectDB();
    const rawFrom = typeof input.from === "string" ? input.from.trim().replace(/^https?:\/\/[^/]+/i, "") : "";
    if (!rawFrom || !rawFrom.startsWith("/") || rawFrom === "/") throw new PostError("Adresse d'origine invalide (ex. « /ancien-article/ »).");
    const from = normalizePath(rawFrom);
    const status = [301, 302, 410].includes(Number(input.status)) ? Number(input.status) : 301;
    const to = status === 410 ? "" : cleanTarget(input.to);
    if (to && normalizePath(to) === from) throw new PostError("L'adresse redirige vers elle-même.");
    // Pas de chaîne : la destination ne doit pas être elle-même redirigée
    if (to.startsWith("/") && (await Redirect.exists({ from: normalizePath(to), ...(id ? { _id: { $ne: id } } : {}) }))) throw new PostError("La destination est elle-même redirigée : vise directement l'adresse finale.");
    const clash = await Redirect.findOne({ from }).select("_id").lean();
    if (clash && String(clash._id) !== id) throw new PostError("Une redirection existe déjà pour cette adresse.", 409);
    if (id) {
        if (!mongoose.isValidObjectId(id)) throw new PostError("Redirection introuvable.", 404);
        await Redirect.updateOne({ _id: id }, { $set: { from, to, status } });
    } else {
        await Redirect.create({ from, to, status, source: "manual" });
    }
    // L'adresse ne sera plus en 404
    await NotFoundHit.deleteOne({ path: from });
    invalidateRedirects();
}

export async function deleteRedirect(actor: Actor, id: string) {
    assert(actor);
    await connectDB();
    if (!mongoose.isValidObjectId(id)) throw new PostError("Redirection introuvable.", 404);
    await Redirect.deleteOne({ _id: id });
    invalidateRedirects();
}

export async function list404(limit = 100) {
    await connectDB();
    return (await NotFoundHit.find({}).sort({ hits: -1, lastAt: -1 }).limit(limit).lean()).map((h) => ({ id: String(h._id), path: h.path, hits: h.hits, referrer: h.referrer || "", lastAt: new Date(h.lastAt).toISOString() }));
}

export async function ignore404(actor: Actor, id: string) {
    assert(actor);
    await connectDB();
    if (mongoose.isValidObjectId(id)) await NotFoundHit.deleteOne({ _id: id });
}

/** Une visite sur une page introuvable (appelé par la page 404, sans donnée personnelle) */
export async function record404(path: string, referrer: string) {
    const p = normalizePath(path.slice(0, 300));
    // Pas de bruit : fichiers techniques, dashboard, robots qui sondent WordPress
    if (/^\/(dashboard|api|_next)\//.test(p) || /\.(php|env|xml|txt|ico|png|jpe?g|gif|svg|js|css|map)\/?$/.test(p) || p.includes("wp-content") || p.includes("wp-includes")) return;
    await connectDB();
    let ref = "";
    try {
        ref = referrer ? new URL(referrer).hostname : "";
    } catch {
        /* rien */
    }
    await NotFoundHit.updateOne({ path: p }, { $inc: { hits: 1 }, $set: { lastAt: new Date(), ...(ref ? { referrer: ref } : {}) } }, { upsert: true });
}
