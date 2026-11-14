import { menuCategories } from "@/lib/content";
import { getSettings } from "@/lib/settings";
import { SITE, absoluteUrl } from "@/lib/site";
import { PONDA } from "@/lib/ponda";

// Régénéré toutes les heures
export const revalidate = 3600;

/**
 * /llms.txt : présentation du blog pour les assistants IA (ChatGPT, Perplexity,
 * Claude…), au format llmstxt.org : qui publie, quelles rubriques, où trouver
 * la liste complète des articles.
 */
export async function GET() {
    const [menu, settings] = await Promise.all([menuCategories(), getSettings()]);
    const lines = [
        `# ${SITE.name} - le blog`,
        "",
        `> ${settings.description || SITE.description}`,
        "",
        "Workyt est une association française d'éducation gratuite. Son blog est écrit par des bénévoles et passe par un circuit de relecture avant publication. Les articles sont en français.",
        "",
        "## Rubriques",
        "",
        ...menu.flatMap((c) => [
            `- [${c.name}](${absoluteUrl(`/category/${c.slug}/`)})${c.description ? ` : ${c.description}` : ""}`,
            ...c.children.map((k) => `  - [${k.name}](${absoluteUrl(`/category/${k.slug}/`)})`),
        ]),
        `- [${PONDA.name}](${absoluteUrl(PONDA.path)}) : ${PONDA.description}`,
        "",
        "## Tous les articles",
        "",
        `- [Sitemap des articles](${SITE.url}/post-sitemap.xml)`,
        `- [Flux RSS](${absoluteUrl("/feed/")}) : les derniers articles, texte complet`,
        "",
        "## L'association",
        "",
        `- [Workyt](${SITE.workytUrl}) : cours, fiches et forum gratuits`,
        `- [À propos](${SITE.workytUrl}/a-propos)`,
        "",
    ];
    return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" } });
}
