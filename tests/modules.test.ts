import { test } from "node:test";
import assert from "node:assert/strict";
import { applyGuestEdit, cleanLink, moduleIssues, sanitizeModules } from "../src/lib/modules/sanitize";
import { citationJsonLd, moduleJsonLd } from "../src/lib/modules/jsonld";
import { emptyModule, type ArticleModule } from "../src/lib/modules/types";

const img = { url: "https://cdn.workyt.fr/a.webp", alt: "Crêpes", credit: { author: "Jean", source: "Unsplash", license: "Licence Unsplash", sourceUrl: "" } };
const ctx = { abs: (p: string) => `https://blog.workyt.fr${p}`, authors: [{ name: "Sarah", url: "https://blog.workyt.fr/author/sarah/" }], datePublished: "2026-10-03T08:00:00.000Z" };

test("nettoyage : champs bornés, liens et images vérifiés, type inconnu ignoré", () => {
    const [m, ...rest] = sanitizeModules([
        { id: "abcd1234", type: "productReview", data: { product: "  Casque  ", score: 8.74, link: "javascript:alert(1)", image: { url: "http://x/y.png" }, pros: ["Léger", "", 3] } },
        { type: "inconnu", data: {} },
    ]);
    assert.equal(rest.length, 0);
    assert.equal(m.type, "productReview");
    if (m.type !== "productReview") return;
    assert.equal(m.data.product, "Casque");
    assert.equal(m.data.score, 8.5, "arrondi au demi-point");
    assert.equal(m.data.link, "", "pas de javascript:");
    assert.equal(m.data.image, null, "image hors médiathèque refusée");
    assert.deepEqual(m.data.pros, ["Léger"]);
    assert.equal(cleanLink("/go/casque-sony"), "/go/casque-sony/");
});

test("avis : la note globale est la moyenne des critères notés", () => {
    const [book, tech] = sanitizeModules([
        { id: "book0001", type: "bookReview", data: { title: "L'Étranger", score: 1, criteria: [{ label: "Style", score: 4.5 }, { label: "Intrigue", score: 4 }, { label: "Personnages", score: 3.5 }, { label: "", score: 0 }] } },
        { id: "tech0001", type: "techReview", data: { product: "Tablette", score: 6, criteria: [{ label: "Écran", score: 9 }, { label: "Autonomie", score: 7.5 }, { label: "Prix", score: 6.5 }] } },
    ]);
    assert.equal(book.type === "bookReview" && book.data.score, 4, "moyenne de 4,5 · 4 · 3,5 (critère sans nom ignoré)");
    assert.equal(tech.type === "techReview" && tech.data.score, 7.7, "moyenne au dixième");
});

test("coup de cœur d'un invité : le texte appartient à l'invité", () => {
    const guest = { memberId: "a".repeat(24), name: "Camille" };
    const [invited] = sanitizeModules([{ id: "gfav0001", type: "guestFavorite", data: { kind: "film", name: "Le Voyage de Chihiro", guest } }]);
    assert.equal(invited.type === "guestFavorite" && invited.data.status, "invited");
    if (invited.type !== "guestFavorite") return;

    const done = applyGuestEdit(invited.data, { why: "Un film qui grandit avec toi.", validate: true });
    assert.equal(done.status, "validated");
    // L'auteur ré-enregistre en essayant de réécrire le texte : on garde celui de l'invité
    const [again] = sanitizeModules([{ id: "gfav0001", type: "guestFavorite", data: { ...done, why: "Texte de l'auteur" } }], [{ ...invited, data: done }]);
    assert.equal(again.type === "guestFavorite" && again.data.why, "Un film qui grandit avec toi.");
    assert.equal(again.type === "guestFavorite" && again.data.status, "validated");
    assert.throws(() => applyGuestEdit(invited.data, { validate: true }), /Écris quelques mots/);

    const issues = moduleIssues([invited]);
    assert.deepEqual(issues.submit, []);
    assert.match(issues.approval[0], /Camille n'a pas encore validé/);
});

test("points bloquants : recette sans photo ni étapes, image sans crédit", () => {
    const r = emptyModule("recipe");
    r.data.name = "Crêpes";
    r.data.steps = [];
    const fav = emptyModule("favorite");
    fav.data.name = "Un livre";
    fav.data.why = "Parce que.";
    fav.data.image = { ...img, credit: { author: "", source: "", license: "", sourceUrl: "" } };
    const { submit } = moduleIssues([r, fav] as ArticleModule[]);
    assert.ok(submit.some((s) => /photo du plat/.test(s)));
    assert.ok(submit.some((s) => /étapes/.test(s)));
    assert.ok(submit.some((s) => /Un livre.*source/.test(s)));
});

test("schema.org : Recipe, Product + Review, Book, citations", () => {
    const r = emptyModule("recipe");
    Object.assign(r.data, { name: "Crêpes", image: img, prepMinutes: 15, cookMinutes: 90, servings: 6, diets: ["végétarien"] });
    r.data.ingredientGroups = [{ title: "", items: [{ qty: "250", unit: "g", name: "farine" }] }];
    r.data.steps = [{ text: "Mélanger.", image: null }];
    const recipe = moduleJsonLd(r, ctx)!;
    assert.equal(recipe["@type"], "Recipe");
    assert.equal(recipe.cookTime, "PT1H30M");
    assert.equal(recipe.totalTime, "PT1H45M");
    assert.deepEqual(recipe.recipeIngredient, ["250 g farine"]);
    assert.deepEqual(recipe.suitableForDiet, ["https://schema.org/VegetarianDiet"]);

    const p = emptyModule("productReview");
    Object.assign(p.data, { product: "Casque", price: "79,99 €", link: "/go/casque/", score: 8, pros: ["Léger"] });
    const product = moduleJsonLd(p, ctx) as { offers: { price: string; url: string }; review: { reviewRating: { bestRating: number } } };
    assert.equal(product.offers.price, "79.99");
    assert.equal(product.offers.url, "https://blog.workyt.fr/go/casque/");
    assert.equal(product.review.reviewRating.bestRating, 10);

    const b = emptyModule("bookReview");
    Object.assign(b.data, { title: "L'Étranger", authors: "Albert Camus", score: 4.5 });
    const book = moduleJsonLd(b, ctx) as { itemReviewed: { "@type": string; author: { name: string }[] }; reviewRating: { bestRating: number } };
    assert.equal(book.itemReviewed["@type"], "Book");
    assert.equal(book.itemReviewed.author[0].name, "Albert Camus");
    assert.equal(book.reviewRating.bestRating, 5);

    assert.equal(citationJsonLd([{ id: "s1aa", kind: "étude", title: "Une étude", authors: "", publisher: "INSEE", date: "2025", url: "https://insee.fr", accessed: "", quote: "" }])[0]["@type"], "ScholarlyArticle");
});

test("rendu : liens affiliés « sponsored », appels de source numérotés, emplacements de modules", async () => {
    const { renderPostHtml, splitAtModules } = await import("../src/lib/render");
    const html = '<p>Le casque <a href="/go/casque-sony/">ici</a>, selon une étude<sup data-source="s2" class="wk-cite"></sup> et une autre<sup class="wk-cite" data-source="s1"></sup><sup data-source="old"></sup>.</p><div data-module="rec1" class="wk-module-slot"></div><p>Fin.</p>';
    const out = renderPostHtml(html, { linkIcons: true, sourceIds: ["s1", "s2"] });
    assert.match(out, /<a href="\/go\/casque-sony\/" target="_blank" rel="sponsored nofollow noopener">ici<span class="wk-aff">sponsorisé<\/span><\/a>/);
    assert.match(out, /<a href="#source-s2" id="cite-s2-1" aria-label="Source 2">\[2\]<\/a>/);
    assert.match(out, /\[1\]/);
    // Domaine du marchand connu (gestionnaire de liens) : son logo, puis la mention
    const withShop = renderPostHtml(html, { linkIcons: true, affiliates: { "casque-sony": "fnac.com" } });
    assert.match(withShop, /ici<img class="wk-fav" src="\/api\/favicon\/fnac\.com\/"[^>]*><span class="wk-aff">sponsorisé<\/span>/);
    assert.doesNotMatch(out, /data-source="old"/, "appel vers une source retirée effacé");
    const parts = splitAtModules(out);
    assert.equal(parts.length, 3);
    assert.deepEqual(parts[1], { moduleId: "rec1" });
});
