import "server-only";
import { cache } from "react";
import { connectDB } from "./db";
import { can } from "./roles";
import { PostError, type Actor } from "./posts";
import { SITE } from "./site";
import Setting from "@/models/Setting";

/**
 * Réglages du blog (§ 13) : description, réseaux sociaux, vérifications des
 * moteurs. Les valeurs vides retombent sur celles du code (lib/site.ts) ;
 * si la base ne répond pas (build), le site garde ses valeurs par défaut.
 */

export const SOCIAL_KEYS = ["x", "linkedin", "instagram", "tiktok", "youtube", "discord"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export interface SiteSettings {
    description: string;
    social: Record<SocialKey, string>;
    verification: { google: string; bing: string };
}

const defaults = (): SiteSettings => ({
    description: SITE.description,
    social: { ...SITE.social },
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION ?? "", bing: "" },
});

export const getSettings = cache(async (): Promise<SiteSettings> => {
    try {
        await connectDB();
        const s = await Setting.findOne({ key: "site" }).lean();
        const d = defaults();
        if (!s) return d;
        return {
            description: s.description || d.description,
            social: Object.fromEntries(SOCIAL_KEYS.map((k) => [k, s.social?.[k] || d.social[k] || ""])) as Record<SocialKey, string>,
            verification: { google: s.verification?.google || d.verification.google, bing: s.verification?.bing || "" },
        };
    } catch {
        return defaults();
    }
});

export async function saveSettings(actor: Actor, input: Record<string, unknown>) {
    if (!can(actor.role, "settings.manage")) throw new PostError("Réservé aux Admins.", 403);
    await connectDB();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const url = (v: unknown) => {
        const s = str(v, 300);
        if (!s) return "";
        try {
            const u = new URL(s);
            if (u.protocol !== "https:") throw new Error();
            return u.toString();
        } catch {
            throw new PostError(`Adresse de réseau invalide : « ${s} » (elle doit commencer par https://).`);
        }
    };
    const social = (input.social ?? {}) as Record<string, unknown>;
    const verification = (input.verification ?? {}) as Record<string, unknown>;
    // Code de vérification : le contenu de la balise, pas la balise entière
    const code = (v: unknown) => str(v, 120).replace(/^.*content="([^"]+)".*$/s, "$1").replace(/[^A-Za-z0-9_\-=]/g, "");
    await Setting.updateOne(
        { key: "site" },
        {
            $set: {
                description: str(input.description, 300),
                social: Object.fromEntries(SOCIAL_KEYS.map((k) => [k, url(social[k])])),
                verification: { google: code(verification.google), bing: code(verification.bing) },
                updatedBy: actor.name,
            },
        },
        { upsert: true }
    );
}
