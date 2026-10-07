import "server-only";
import { documentText } from "@/editor/html";
import type { JSONContent } from "@tiptap/core";
import { SITE } from "./site";
import Author from "@/models/Author";
import Category from "@/models/Category";

/**
 * Salon Discord « nouveaux articles à corriger » : un message par article
 * envoyé en correction, avec le lien vers l'éditeur. Webhook : DISCORD_REVIEW_WEBHOOK_URL.
 * Sans webhook configuré, rien n'est envoyé.
 */
export async function notifyReviewDiscord(post: {
    _id: unknown;
    title: string;
    contentJson?: unknown;
    authors?: unknown[];
    primaryCategory?: unknown;
}, by: string): Promise<void> {
    const url = process.env.DISCORD_REVIEW_WEBHOOK_URL;
    if (!url) return;
    try {
        const [authors, category] = await Promise.all([
            Author.find({ _id: { $in: post.authors ?? [] } }).select("name").lean(),
            post.primaryCategory ? Category.findById(post.primaryCategory).select("name").lean() : null,
        ]);
        const words = documentText((post.contentJson ?? {}) as JSONContent).split(/\s+/).filter(Boolean).length;
        const fields = [
            { name: "Rédaction", value: authors.map((a) => a.name).join(", ") || by, inline: true },
            ...(category ? [{ name: "Rubrique", value: category.name, inline: true }] : []),
            { name: "Longueur", value: `${words.toLocaleString("fr-FR")} mots`, inline: true },
            { name: "Corriger", value: `[Ouvrir l'article](${SITE.url}/dashboard/articles/${String(post._id)}/)` },
        ];
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                embeds: [{ title: `✏️ Nouvel article à corriger : ${post.title}`.slice(0, 256), color: 0xf97316, fields, timestamp: new Date().toISOString() }],
            }),
        });
        if (!res.ok) console.error("Webhook Discord (correction) :", res.status);
    } catch (e) {
        console.error("Webhook Discord (correction) :", e);
    }
}
