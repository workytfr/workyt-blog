import { test } from "node:test";
import assert from "node:assert/strict";
import { postDescription } from "../src/lib/seo";
import { categoryHref, isPondaPost } from "../src/lib/ponda";
import { parseVokytNote } from "../src/editor/nodes";

const seo = { noindex: false, nofollow: false, focusKeywords: [] };

test("description : l'intertitre collé au début de l'extrait est retiré", () => {
    const excerpt = "Une langue qui change selon les situations On a parfois l’impression de parler « normalement », comme si notre manière de nous exprimer était toujours la même.";
    const contentHtml = "<h2>Une langue qui change selon les situations</h2><p>On a parfois l’impression de parler…</p>";
    assert.equal(postDescription({ excerpt, contentHtml, seo }), "On a parfois l’impression de parler « normalement », comme si notre manière de nous exprimer était toujours la même.");
});

test("description : l'extrait est gardé quand il ne commence pas par un intertitre", () => {
    const excerpt = "Tu es étudiant ou lycéen et tu voudrais mieux gérer ton temps ? Notion peut t'aider.";
    assert.equal(postDescription({ excerpt, contentHtml: "<p>Tu es étudiant…</p><h2>Notion</h2>", seo }), excerpt);
    assert.equal(postDescription({ excerpt, contentHtml: "<h2>Autre titre</h2><p>…</p>", seo }), excerpt);
    // Reste trop court après l'intertitre : on ne coupe pas
    assert.equal(postDescription({ excerpt: "Mon titre Court.", contentHtml: "<h2>Mon titre</h2>", seo }), "Mon titre Court.");
});

test("description : la description SEO passe avant l'extrait", () => {
    assert.equal(postDescription({ excerpt: "Extrait", contentHtml: "", seo: { ...seo, description: "Écrite à la main" } }), "Écrite à la main");
});

test("Ponda Podcast : adresse de la rubrique et épisodes", () => {
    assert.equal(categoryHref("ponda-podcast"), "/ponda-podcast/");
    assert.equal(categoryHref("culture"), "/category/culture/");
    assert.equal(isPondaPost({ categories: [{ slug: "culture" }, { slug: "ponda-podcast" }] }), true);
    assert.equal(isPondaPost({ categories: [{ slug: "culture" }] }), false);
});

test("Vokyt : identifiant lu dans un identifiant ou un lien d'écoute", () => {
    assert.equal(parseVokytNote("note_8f3k2m"), "note_8f3k2m");
    assert.equal(parseVokytNote(" https://vokyt.cc/ecouter/note_8f3k2m?x=1 "), "note_8f3k2m");
    assert.equal(parseVokytNote("https://open.spotify.com/episode/abc"), null);
});
