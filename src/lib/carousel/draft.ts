import "server-only";
import type { JSONContent } from "@tiptap/core";
import { avatarSrc } from "@/lib/avatar";
import { SITE } from "@/lib/site";
import Author from "@/models/Author";
import Category from "@/models/Category";
import Tag from "@/models/Tag";
import { MAX_POINTS, type CarouselData } from "./data";

/** Texte d'un nœud de l'éditeur, gras et surlignage compris (**…**, ==…==) */
function inline(n: JSONContent): string {
    if (n.type === "text") {
        const t = n.text ?? "";
        const marks = n.marks?.map((m) => m.type) ?? [];
        // Les espaces restent hors des marqueurs : « ** mot **» se lirait mal
        const [, before, word, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(t) ?? ["", "", t, ""];
        if (!word) return t;
        if (marks.includes("highlight")) return `${before}==${word}==${after}`;
        if (marks.includes("bold")) return `${before}**${word}**${after}`;
        return t;
    }
    return (n.content ?? []).map(inline).join(n.type === "paragraph" || n.type === "listItem" ? " " : "");
}

const plain = (s: string) => s.replace(/\*\*|==/g, "");
const clip = (s: string, max: number) => {
    const t = s.replace(/\s+/g, " ").trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max - 1);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6))}…`;
};
/** Première phrase d'un paragraphe */
const sentence = (s: string) => (s.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? s).trim();

/**
 * Brouillon du carrousel tiré de l'article : chapô, intertitres (H2 + leur
 * première phrase), première citation, étiquettes, image de une, auteur.
 * La rédaction retouche ensuite chaque texte.
 */
export async function carouselDraft(post: {
    title: string;
    slug: string;
    excerpt?: string | null;
    contentJson?: unknown;
    readingMinutes?: number | null;
    authors?: unknown[];
    primaryCategory?: unknown;
    categories?: unknown[];
    tags?: unknown[];
    featuredImage?: { url?: string | null } | null;
    seo?: { description?: string | null } | null;
}): Promise<CarouselData> {
    const catId = post.primaryCategory ?? post.categories?.[0];
    const [category, author, tags] = await Promise.all([
        catId ? Category.findById(catId).select("name color").lean() : null,
        post.authors?.[0] ? Author.findById(post.authors[0]).select("name title slug avatarUrl workytId").lean() : null,
        Tag.find({ _id: { $in: post.tags ?? [] } }).select("name").lean(),
    ]);

    // Parcours du document : intertitres et leur premier paragraphe, citations
    const blocks = ((post.contentJson as JSONContent | undefined)?.content ?? []) as JSONContent[];
    const points: string[] = [];
    let quote = "";
    let firstParagraph = "";
    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (b.type === "paragraph" && !firstParagraph) firstParagraph = plain(inline(b));
        if (b.type === "blockquote" && !quote) quote = plain(inline(b));
        if (b.type === "heading" && b.attrs?.level === 2 && points.length < MAX_POINTS) {
            const heading = plain(inline(b)).trim();
            const next = blocks.slice(i + 1).find((n) => n.type === "paragraph" && inline(n).trim());
            const line = next ? sentence(inline(next)) : "";
            if (heading) points.push(clip(line ? `**${heading}** : ${line}` : `**${heading}**`, 200));
        }
    }

    const intro = post.excerpt?.trim() || post.seo?.description?.trim() || firstParagraph;
    const host = SITE.url.replace(/^https?:\/\//, "");
    return {
        title: post.title,
        category: category ? { name: category.name, color: category.color || "#ff6a1a" } : null,
        readingMinutes: post.readingMinutes || 1,
        author: author
            ? {
                  name: author.name,
                  title: author.title || "Rédaction bénévole chez Workyt",
                  avatar: avatarSrc({ avatarUrl: author.avatarUrl, workytId: author.workytId, seed: author.slug }),
              }
            : null,
        image: post.featuredImage?.url || null,
        intro: { heading: "L'essentiel en deux mots", text: clip(intro, 400) },
        points,
        quote: clip(quote, 130),
        tags: tags.map((t) => t.name).slice(0, 8),
        url: `${host}/${post.slug}`,
    };
}
