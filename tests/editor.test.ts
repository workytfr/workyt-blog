import { test } from "node:test";
import assert from "node:assert/strict";
import { documentImages, documentText, documentToHtml } from "../src/editor/html";
import { renderArticle, renderPostHtml } from "../src/lib/render";
import { checkCredit } from "../src/lib/licenses";

const doc = {
    type: "doc",
    content: [
        { type: "paragraph", content: [{ type: "text", text: "Bonjour " }, { type: "text", marks: [{ type: "bold" }], text: "Workyt" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Un titre" }] },
        {
            type: "image",
            attrs: { src: "https://images.unsplash.com/photo-1.jpg", alt: "Des livres", width: 1600, height: 1067, mediaId: "m1", caption: "Une légende", creditAuthor: "Jean", creditSource: "Unsplash", creditLicense: "Licence Unsplash", creditUrl: "https://unsplash.com/x" },
        },
        { type: "image", attrs: { src: "https://exemple.org/collee.png", alt: "" } },
        { type: "callout", attrs: { variant: "definition" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Une définition." }] }] },
        { type: "paragraph", content: [{ type: "text", text: "Formule : " }, { type: "inlineMath", attrs: { latex: "\\frac{1}{2}" } }] },
        { type: "blockMath", attrs: { latex: "x^2 + 1" } },
    ],
};

test("document → HTML public : image avec crédit, encadré, formules", () => {
    const html = documentToHtml(doc);
    assert.match(html, /<figure class="wk-figure" data-media-id="m1">/);
    assert.match(html, /<span class="credit" data-author="Jean" data-source="Unsplash"[^>]*>Jean · Unsplash<span class="credit-lic"> · Licence Unsplash<\/span><\/span>/);
    assert.match(html, /<figcaption>Une légende<\/figcaption>/);
    assert.match(html, /<aside data-variant="definition" class="wk-callout wk-callout--definition"><p>Une définition.<\/p><\/aside>/);
    assert.match(html, /<span data-latex="\\frac\{1\}\{2\}" data-type="inline-math"><\/span>/);

    // Rendu public : assaini, formules calculées par KaTeX, crédit conservé
    const out = renderPostHtml(html);
    assert.match(out, /class="credit"/, "le crédit survit à l'assainissement");
    assert.match(out, /class="wk-callout wk-callout--definition"/, "l'encadré survit");
    assert.match(out, /class="katex"/, "formule en ligne rendue");
    assert.match(out, /katex-display/, "formule en bloc rendue");
    assert.ok(!out.includes("data-latex"), "plus de LaTeX brut");
});

test("images d'un document et texte", () => {
    assert.deepEqual(
        documentImages(doc).map((i) => i.hasCredit),
        [true, false],
        "l'image collée sans crédit est détectée"
    );
    assert.match(documentText(doc), /^Bonjour Workyt Un titre/);
});

test("crédit d'image obligatoire", () => {
    assert.equal(checkCredit({ author: "Jean", source: "Unsplash", license: "Licence Unsplash", sourceUrl: "https://unsplash.com/x" }).errors.length, 0);
    assert.equal(checkCredit({ author: "Rédaction Workyt", source: "Photo maison", license: "Photo maison" }).errors.length, 0, "photo maison : pas de lien demandé");
    assert.equal(checkCredit({ author: "Jean", source: "Wikimedia Commons", license: "CC BY-SA" }).errors.length, 0, "le lien vers l'original est facultatif");
    assert.equal(checkCredit({}).errors.length, 3);
    assert.match(checkCredit({ author: "X", source: "Kit presse", license: "Kit presse (usage autorisé)", sourceUrl: "https://a.b" }).errors.join(), /preuve/);
    assert.match(checkCredit({ author: "X", source: "Autre", license: "CC BY-NC", sourceUrl: "https://a.b" }).warnings.join(), /non commerciale/);
    assert.match(checkCredit({ author: "X", source: "Autre", license: "CC BY", sourceUrl: "javascript:alert(1)" }).errors.join(), /http/);
});

test("titres : texte enveloppé pour le style cahier (éditeur et articles repris de WordPress)", () => {
    const html = documentToHtml({ type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Faire un planning" }] }] });
    assert.equal(html, '<h2><span class="wk-h">Faire un planning</span></h2>');
    const out = renderPostHtml('<h2 id="plan">Ancien titre WordPress</h2><h3>Sous-partie</h3><h2><span class="wk-h">Déjà prêt</span></h2>');
    assert.match(out, /<h2 id="plan"><span class="wk-h">Ancien titre WordPress<\/span><\/h2>/);
    assert.match(out, /<h3 id="sous-partie"><span class="wk-h">Sous-partie<\/span><\/h3>/, "ancre ajoutée pour le sommaire");
    assert.equal((out.match(/class="wk-h"/g) || []).length, 3, "pas de double enveloppe");
});

test("citations : texte brut de WordPress mis dans un paragraphe (guillemets du post-it), auteur gardé à part", () => {
    assert.match(renderPostHtml("<blockquote>Lire, c'est déjà réviser.</blockquote>"), /<blockquote><p>Lire, c'est déjà réviser.<\/p><\/blockquote>/);
    assert.match(renderPostHtml("<blockquote>Une phrase.<cite>Victor Hugo</cite></blockquote>"), /<blockquote><p>Une phrase.<\/p><cite>Victor Hugo<\/cite><\/blockquote>/);
    assert.match(renderPostHtml("<blockquote><p>Déjà propre.</p></blockquote>"), /<blockquote><p>Déjà propre.<\/p><\/blockquote>/);
});

test("lettrine : premier paragraphe du texte, jamais celui d'une citation", () => {
    const out = renderPostHtml("<blockquote><p>Une citation en ouverture.</p></blockquote><p>Premier vrai paragraphe.</p><p>Suite.</p>");
    assert.match(out, /<blockquote><p>Une citation en ouverture.<\/p><\/blockquote><p class="lead">Premier vrai paragraphe.<\/p><p>Suite.<\/p>/);
});

test("sommaire : ancres sur les titres, carte avant le premier titre à partir de 3 titres", () => {
    const src = '<p>Intro.</p><h2>Le programme &amp; l’oral</h2><p>a</p><h3 id="ancien-ancre">Les œuvres</h3><p>b</p><h2>Le planning</h2><h2>Le planning</h2>';
    const { html, toc } = renderArticle(src);
    assert.deepEqual(
        toc.map((t) => [t.id, t.level, t.n, t.text]),
        [
            ["le-programme-l-oral", 2, 1, "Le programme & l’oral"],
            ["ancien-ancre", 3, 1, "Les œuvres"],
            ["le-planning", 2, 2, "Le planning"],
            ["le-planning-2", 2, 3, "Le planning"],
        ]
    );
    assert.match(html, /<p class="lead">Intro.<\/p><details class="wk-toc" id="sommaire" open>/, "carte juste avant le premier titre");
    assert.match(html, /<a href="#le-programme-l-oral"><span class="wk-toc-n">01<\/span><span>Le programme &amp; l’oral<\/span><\/a>/);
    assert.match(html, /<h2 id="le-planning-2"><span class="wk-h">Le planning<\/span><\/h2>/, "ancre unique");
    assert.match(html, /<h3 id="ancien-ancre">/, "ancre WordPress gardée");
    const short = renderArticle("<h2>Un</h2><h2>Deux</h2>");
    assert.equal(short.toc.length, 0);
    assert.doesNotMatch(short.html, /wk-toc/, "pas de sommaire sous 3 titres");
    assert.doesNotMatch(renderPostHtml(src), /wk-toc/, "pas de carte dans le flux RSS");
});
