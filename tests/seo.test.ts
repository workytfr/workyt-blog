import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeSeo, containsKeyword, readingEase, sentencesOf, syllables, type SeoInput } from "../src/lib/seo/analyze";

const p = (text: string, href?: string) => ({ type: "paragraph", content: href ? [{ type: "text", text }, { type: "text", text: " lien", marks: [{ type: "link", attrs: { href } }] }] : [{ type: "text", text }] });
const h = (text: string) => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });

// Un paragraphe de ~45 mots, phrases courtes, avec mots de liaison
const para = (i: number) =>
    p(`D'abord, réviser le bac de français demande de la méthode ${i}. Ensuite, il faut lire les œuvres au programme sans se presser. Par exemple, une fiche par chapitre aide beaucoup. Enfin, on relit ses notes la veille, puis on dort bien.`);

function goodInput(): SeoInput {
    const content = [
        p("Réviser le bac de français sans stress, c'est possible avec un bon planning. Voici notre méthode, testée par des élèves de première."),
        h("Réviser le bac de français : le planning"),
        ...[1, 2, 3, 4, 5].map(para),
        h("Les bonnes ressources"),
        ...[6, 7, 8, 9, 10].map(para),
        p("Retrouve nos fiches sur Workyt.", "https://workyt.fr/fiches"),
        p("Et notre article sur l'orientation.", "/bien-choisir-son-orientation/"),
        p("Le programme officiel est sur le site du ministère.", "https://www.education.gouv.fr/"),
        h("En résumé"),
        ...[11, 12, 13].map(para),
    ];
    return {
        title: "Réviser le bac de français : notre méthode en 5 étapes",
        seoTitle: "",
        seoDescription: "Réviser le bac de français sans stress : un planning simple, les bonnes ressources et nos astuces d'élèves pour arriver serein le jour J.",
        excerpt: "",
        slug: "reviser-le-bac-de-francais",
        keywords: ["réviser le bac de français", "planning"],
        doc: { type: "doc", content: [...content, { type: "image", attrs: { src: "x", alt: "Réviser le bac de français à la bibliothèque" } }] },
        featuredImage: { alt: "Une élève qui révise" },
        modules: [],
        keywordTaken: false,
    };
}

test("texte : mot-clé sans accents ni majuscules, phrases, syllabes, lisibilité", () => {
    assert.ok(containsKeyword("Comment RÉVISER le Bac de français ?", "réviser le bac de francais"));
    assert.ok(!containsKeyword("réviserons", "réviser"), "mots entiers seulement");
    assert.equal(sentencesOf("Bonjour. Ça va ? Oui ! Bien sûr…").length, 4);
    assert.equal(syllables("élève"), 2);
    assert.equal(syllables("chocolat"), 3);
    assert.ok(readingEase(["Le chat dort.", "Il fait beau."]) > 80);
    assert.ok(readingEase(["L'institutionnalisation progressive des considérations épistémologiques contemporaines transforme considérablement l'appréhension intellectuelle des problématiques fondamentales."]) < 30);
});

test("un article bien optimisé dépasse 85/100, tous groupes au vert ou presque", () => {
    const r = analyzeSeo(goodInput());
    const weak = r.groups.flatMap((g) => g.checks).filter((c) => c.status !== "good");
    assert.ok(r.score >= 85, `score ${r.score}, à revoir : ${weak.map((c) => `${c.id} (${c.message})`).join(" ; ")}`);
    assert.equal(r.groups.reduce((s, g) => s + g.max, 0), 100, "barème sur 100");
    assert.deepEqual(r.secondary, [{ keyword: "planning", found: true }]);
});

test("un article vide ou sans mot-clé reste sous 30, avec des conseils", () => {
    const r = analyzeSeo({ title: "Brouillon", seoTitle: "", seoDescription: "", excerpt: "", slug: "brouillon", keywords: [], doc: { type: "doc", content: [p("Trois mots ici.")] }, featuredImage: null, modules: [] });
    assert.ok(r.score < 30, `score ${r.score}`);
    const kw = r.groups.find((g) => g.id === "keyword")!;
    assert.equal(kw.points, 0);
    assert.match(kw.checks[0].message, /mot-clé principal/);
});

test("critères : mot-clé déjà pris, densité trop forte, paragraphe trop long pointé", () => {
    const base = goodInput();
    const taken = analyzeSeo({ ...base, keywordTaken: true });
    assert.equal(taken.groups[0].checks.find((c) => c.id === "kw-unique")!.status, "bad");

    const stuffed = analyzeSeo({ ...base, doc: { type: "doc", content: [p(Array(40).fill("réviser le bac de français").join(" "))] } });
    assert.notEqual(stuffed.groups[0].checks.find((c) => c.id === "kw-density")!.status, "good");

    const long = analyzeSeo({ ...base, doc: { type: "doc", content: [p("intro"), p(Array(220).fill("mot").join(" "))] } });
    const para = long.groups.find((g) => g.id === "content")!.checks.find((c) => c.id === "paragraphs")!;
    assert.equal(para.status, "bad");
    assert.deepEqual(para.target, { block: 1 });
});
