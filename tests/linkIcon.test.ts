import { test } from "node:test";
import assert from "node:assert/strict";
import { addLinkIcons, faviconUrl, linkDomain } from "../src/lib/linkIcon";
import { renderPostHtml } from "../src/lib/render";

test("domaine d'un lien : sans www, interne = workyt, rien pour mailto ou ancre", () => {
    assert.equal(linkDomain("https://www.education.gouv.fr/bac"), "education.gouv.fr");
    assert.equal(linkDomain("/reviser-le-bac/"), "workyt.fr");
    assert.equal(linkDomain("https://blog.workyt.fr/x/"), "blog.workyt.fr");
    assert.equal(linkDomain("mailto:contact@workyt.fr"), null);
    assert.equal(linkDomain("#partie-2"), null);
    assert.equal(linkDomain("//evil.com/x"), null);
    assert.equal(faviconUrl("blog.workyt.fr"), "/icon.svg");
    assert.equal(faviconUrl("wikipedia.org"), "/api/favicon/wikipedia.org/");
});

test("le logo s'ajoute au bout du texte du lien, pas sur un lien-image", () => {
    const html = addLinkIcons('<p>Voir <a href="https://fr.wikipedia.org/wiki/Bac">le bac</a> et <a href="https://x.fr"><img src="a.webp"></a></p>');
    assert.match(html, /le bac<img class="wk-fav" src="\/api\/favicon\/fr\.wikipedia\.org\/"/);
    assert.equal((html.match(/wk-fav/g) || []).length, 1);
});

test("le flux RSS n'a pas de logo, la page de l'article si", () => {
    const html = '<p>Lire <a href="https://www.onisep.fr">Onisep</a></p>';
    assert.doesNotMatch(renderPostHtml(html), /wk-fav/);
    assert.match(renderPostHtml(html, { linkIcons: true }), /Onisep<img class="wk-fav" src="\/api\/favicon\/onisep\.fr\/"/);
});
