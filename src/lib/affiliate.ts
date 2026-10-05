import "server-only";
import mongoose from "mongoose";
import { connectDB } from "./db";
import { can } from "./roles";
import { PostError, slugify, type Actor } from "./posts";
import AffiliateLink from "@/models/AffiliateLink";
import Member from "@/models/Member";
import Notification from "@/models/Notification";

/** Liens affiliés (§ 9.1) : gestionnaire, redirection /go/<nom>/, vérification */

export interface AffiliateView {
    id: string;
    name: string;
    href: string;
    label: string;
    merchant: string;
    url: string;
    program: string;
    expiresAt: string | null;
    clicks: number;
    health: "ok" | "dead" | "unknown";
    lastCheckedAt: string | null;
    expired: boolean;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- document « lean » */
function toView(l: any): AffiliateView {
    return {
        id: String(l._id),
        name: l.name,
        href: `/go/${l.name}/`,
        label: l.label,
        merchant: l.merchant || "",
        url: l.url,
        program: l.program || "",
        expiresAt: l.expiresAt ? new Date(l.expiresAt).toISOString() : null,
        clicks: l.clicks || 0,
        health: l.health || "unknown",
        lastCheckedAt: l.lastCheckedAt ? new Date(l.lastCheckedAt).toISOString() : null,
        expired: !!l.expiresAt && new Date(l.expiresAt) < new Date(),
    };
}

export async function listLinks(actor: Actor): Promise<AffiliateView[]> {
    if (!can(actor.role, "dashboard.access")) throw new PostError("Réservé à la rédaction.", 403);
    await connectDB();
    return (await AffiliateLink.find({}).sort({ label: 1 }).lean()).map(toView);
}

function cleanInput(input: Record<string, unknown>) {
    const s = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const url = s(input.url, 1000);
    try {
        const u = new URL(url);
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    } catch {
        throw new PostError("Adresse marchande invalide (elle doit commencer par https://).");
    }
    const label = s(input.label, 120);
    if (!label) throw new PostError("Donne un nom au lien (ex. « Casque Sony WH-1000XM5 »).");
    const expires = s(input.expiresAt, 30);
    const date = expires ? new Date(expires) : null;
    return {
        label,
        name: slugify(s(input.name, 80) || label).slice(0, 60),
        merchant: s(input.merchant, 80),
        url,
        program: s(input.program, 60),
        expiresAt: date && !Number.isNaN(date.getTime()) ? date : undefined,
    };
}

const assertManage = (actor: Actor) => {
    if (!can(actor.role, "links.manage")) throw new PostError("Seuls le Rédacteur en chef et les Admins gèrent les liens affiliés.", 403);
};

export async function createLink(actor: Actor, input: Record<string, unknown>) {
    assertManage(actor);
    await connectDB();
    const data = cleanInput(input);
    if (await AffiliateLink.exists({ name: data.name })) throw new PostError(`L'adresse /go/${data.name}/ existe déjà : choisis un autre nom court.`, 409);
    return toView((await AffiliateLink.create({ ...data, createdBy: actor.name })).toObject());
}

export async function updateLink(actor: Actor, id: string, input: Record<string, unknown>) {
    assertManage(actor);
    await connectDB();
    if (!mongoose.isValidObjectId(id)) throw new PostError("Lien introuvable.", 404);
    const link = await AffiliateLink.findById(id);
    if (!link) throw new PostError("Lien introuvable.", 404);
    // Le nom court ne change pas : il est déjà dans les articles
    const data = cleanInput({ ...input, name: link.name });
    const urlChanged = data.url !== link.url;
    link.set({ ...data, expiresAt: data.expiresAt ?? null, ...(urlChanged ? { health: "unknown", lastStatus: null } : {}) });
    await link.save();
    return toView(link.toObject());
}

export async function deleteLink(actor: Actor, id: string) {
    assertManage(actor);
    await connectDB();
    if (!mongoose.isValidObjectId(id)) throw new PostError("Lien introuvable.", 404);
    await AffiliateLink.deleteOne({ _id: id });
}

/** /go/<nom>/ : adresse marchande et un clic de plus (sans cookie ni donnée personnelle) */
export async function resolveLink(name: string): Promise<string | null> {
    await connectDB();
    const link = await AffiliateLink.findOneAndUpdate({ name: name.toLowerCase() }, { $inc: { clicks: 1 }, $set: { lastClickAt: new Date() } }, { new: true }).select("url").lean();
    return link?.url ?? null;
}

/**
 * Vérification des liens (cron externe, chaque nuit). « Mort » seulement si
 * le marchand répond 404 / 410 ou si le site ne répond plus : beaucoup de
 * marchands refusent les robots (403, 503), ce qui ne veut pas dire que le
 * lien est cassé. Le Rédacteur en chef est prévenu des nouveaux liens morts.
 */
export async function checkLinks(now = new Date()) {
    await connectDB();
    const links = await AffiliateLink.find({}).select("name label url health").lean();
    const newlyDead: string[] = [];
    for (const l of links) {
        let status = 0;
        try {
            const r = await fetch(l.url, { method: "HEAD", redirect: "follow", headers: { "User-Agent": "WorkytBlog-LinkCheck/1.0 (+https://blog.workyt.fr)" }, signal: AbortSignal.timeout(8000) });
            status = r.status;
            // Certains marchands refusent HEAD : on retente en GET
            if (status === 405 || status === 501) status = (await fetch(l.url, { method: "GET", redirect: "follow", headers: { "User-Agent": "WorkytBlog-LinkCheck/1.0" }, signal: AbortSignal.timeout(8000) })).status;
        } catch {
            status = 0;
        }
        const health = status >= 200 && status < 400 ? "ok" : status === 404 || status === 410 || status === 0 ? "dead" : "unknown";
        if (health === "dead" && l.health !== "dead") newlyDead.push(l.label);
        await AffiliateLink.updateOne({ _id: l._id }, { $set: { health, lastStatus: status, lastCheckedAt: now } });
    }
    if (newlyDead.length) {
        const chiefs = await Member.find({ role: { $in: ["redac_chef", "admin"] } }).select("_id").lean();
        await Notification.insertMany(
            chiefs.map((c) => ({ to: c._id, type: "link-dead", text: `Lien${newlyDead.length > 1 ? "s" : ""} affilié${newlyDead.length > 1 ? "s" : ""} cassé${newlyDead.length > 1 ? "s" : ""} : ${newlyDead.join(", ")}.`, by: "Vérification des liens" }))
        );
    }
    return { checked: links.length, dead: newlyDead.length };
}
