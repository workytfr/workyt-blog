import type { ArticleModule, ModuleImage, SourceItem } from "./types";

/**
 * Données structurées des modules (§ 9) : Recipe, Product + Review,
 * Review + Book (seulement avec une note), et `citation` de l'Article pour
 * les sources. Fonctions pures : testées sans serveur.
 */

type Json = Record<string, unknown>;
interface Ctx {
    /** Adresse absolue d'un chemin du blog */
    abs: (path: string) => string;
    /** Auteurs de l'article */
    authors: { name: string; url: string }[];
    datePublished: string;
    /** Auteur d'un rédacteur invité (coup de cœur externe) */
    guestUrl?: (memberId: string) => string | undefined;
}

const minutes = (m: number) => (m > 0 ? `PT${Math.floor(m / 60) ? `${Math.floor(m / 60)}H` : ""}${m % 60 ? `${m % 60}M` : ""}` : undefined);
const image = (img: ModuleImage | null, ctx: Ctx) => (img ? (img.url.startsWith("/") ? ctx.abs(img.url) : img.url) : undefined);
const link = (href: string, ctx: Ctx) => (href ? (href.startsWith("/") ? ctx.abs(href) : href) : undefined);
const people = (ctx: Ctx) => ctx.authors.map((a) => ({ "@type": "Person", name: a.name, url: a.url }));
const rating = (value: number, best: number) => ({ "@type": "Rating", ratingValue: value, bestRating: best, worstRating: 0 });
const notes = (items: string[]) => (items.length ? { "@type": "ItemList", itemListElement: items.map((name, i) => ({ "@type": "ListItem", position: i + 1, name })) } : undefined);
const clean = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
/** Note utilisable par Google : un nombre dans ]0, max] (0 = module pas encore noté) */
const validScore = (value: number, best: number) => Number.isFinite(value) && value > 0 && value <= best;

const DIETS: Record<string, string> = {
    végétarien: "https://schema.org/VegetarianDiet",
    végétalien: "https://schema.org/VeganDiet",
    vegan: "https://schema.org/VeganDiet",
    "sans gluten": "https://schema.org/GlutenFreeDiet",
    halal: "https://schema.org/HalalDiet",
    casher: "https://schema.org/KosherDiet",
    "sans lactose": "https://schema.org/LowLactoseDiet",
};

export function moduleJsonLd(m: ArticleModule, ctx: Ctx): Json | null {
    switch (m.type) {
        case "recipe": {
            const r = m.data;
            const total = r.prepMinutes + r.cookMinutes + r.restMinutes;
            return clean({
                "@type": "Recipe",
                name: r.name,
                description: r.description || undefined,
                image: image(r.image, ctx),
                author: people(ctx),
                datePublished: ctx.datePublished,
                prepTime: minutes(r.prepMinutes),
                cookTime: minutes(r.cookMinutes),
                totalTime: minutes(total),
                recipeYield: `${r.servings} portion${r.servings > 1 ? "s" : ""}`,
                recipeIngredient: r.ingredientGroups.flatMap((g) => g.items.map((i) => [i.qty, i.unit, i.name].filter(Boolean).join(" "))),
                recipeInstructions: r.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s.text, image: image(s.image, ctx) })),
                tool: r.tools.length ? r.tools.map((t) => ({ "@type": "HowToTool", name: t })) : undefined,
                suitableForDiet: r.diets.map((d) => DIETS[d.toLowerCase()]).filter(Boolean),
                nutrition: r.nutrition.calories
                    ? { "@type": "NutritionInformation", calories: `${r.nutrition.calories} kcal`, proteinContent: r.nutrition.proteins ? `${r.nutrition.proteins} g` : undefined, carbohydrateContent: r.nutrition.carbs ? `${r.nutrition.carbs} g` : undefined, fatContent: r.nutrition.fats ? `${r.nutrition.fats} g` : undefined }
                    : undefined,
            });
        }
        case "techReview":
        case "productReview": {
            const d = m.data;
            const price = Number.parseFloat(d.price.replace(",", ".").replace(/[^0-9.]/g, ""));
            const tech = m.type === "techReview" ? m.data : null;
            const prod = m.type === "productReview" ? m.data : null;
            // Google refuse un Product sans offre ni avis noté : rien plutôt qu'une erreur dans la Search Console
            const offer = Number.isFinite(price) && price > 0;
            const scored = validScore(d.score, 10);
            if (!d.product || (!offer && !scored)) return null;
            return clean({
                "@type": "Product",
                name: d.product,
                image: image(d.image, ctx),
                brand: tech?.brand ? { "@type": "Brand", name: tech.brand } : undefined,
                model: tech?.model || undefined,
                offers: offer
                    ? { "@type": "Offer", price: price.toFixed(2), priceCurrency: "EUR", url: prod ? link(prod.link, ctx) : undefined, seller: prod?.merchant ? { "@type": "Organization", name: prod.merchant } : undefined }
                    : undefined,
                review: scored
                    ? {
                          "@type": "Review",
                          author: people(ctx),
                          datePublished: ctx.datePublished,
                          reviewRating: rating(d.score, 10),
                          reviewBody: tech?.verdict || undefined,
                          positiveNotes: notes(d.pros),
                          negativeNotes: notes(d.cons),
                      }
                    : undefined,
            });
        }
        case "bookReview": {
            const b = m.data;
            // Avis sans note : invalide pour Google, rien n'est émis
            if (!b.title || !validScore(b.score, 5)) return null;
            return clean({
                "@type": "Review",
                itemReviewed: {
                    "@type": "Book",
                    name: b.title,
                    author: b.authors.split(/,| et /).map((n) => n.trim()).filter(Boolean).map((name) => ({ "@type": "Person", name })),
                    isbn: b.isbn || undefined,
                    numberOfPages: b.pages ? Number(b.pages) : undefined,
                    publisher: b.publisher ? { "@type": "Organization", name: b.publisher } : undefined,
                    datePublished: b.year || undefined,
                    genre: b.genre || undefined,
                    image: image(b.image, ctx),
                },
                author: people(ctx),
                datePublished: ctx.datePublished,
                reviewRating: rating(b.score, 5),
                reviewBody: b.summary || undefined,
                positiveNotes: notes(b.pros ?? []),
                negativeNotes: notes(b.cons ?? []),
            });
        }
        // Coups de cœur : pas de note, donc pas de Review valide (Google exige reviewRating, et
        // refuse les itemReviewed Place, WebSite, Thing…). Le texte reste dans la page.
        case "favorite":
        case "guestFavorite":
        case "sources":
            return null;
    }
}

/** Références de l'article (propriété `citation` de l'Article) */
export function citationJsonLd(items: SourceItem[]): Json[] {
    const TYPE: Record<SourceItem["kind"], string> = { article: "Article", livre: "Book", étude: "ScholarlyArticle", site: "WebPage", vidéo: "VideoObject", podcast: "PodcastEpisode" };
    return items.map((s) =>
        clean({
            "@type": TYPE[s.kind],
            name: s.title,
            author: s.authors || undefined,
            publisher: s.publisher ? { "@type": "Organization", name: s.publisher } : undefined,
            datePublished: s.date || undefined,
            url: s.url || undefined,
        })
    );
}
