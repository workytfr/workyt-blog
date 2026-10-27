import { test } from "node:test";
import assert from "node:assert/strict";
import { captionRepeatsCredit, renderPostHtml } from "../src/lib/render";

test("crédit des images : légende qui répète le crédit (reprise de WordPress)", () => {
    assert.ok(captionRepeatsCredit("Photo de Greg Rosenke sur Unsplash", "Greg Rosenke", "Unsplash"));
    assert.ok(captionRepeatsCredit("Photo by Andrew Neel on Pexels.com ©", "Andrew Neel", "Pexels"));
    assert.ok(captionRepeatsCredit("Image by Gerd Altmann from Pixabay", "Gerd Altmann", "Pixabay"));
    assert.ok(captionRepeatsCredit("CR : Ouka Leele / Agence Vu ©", "Ouka Leele / Agence Vu", ""));
    assert.ok(captionRepeatsCredit("Photographe : DEZALB", "DEZALB", ""));
    assert.ok(captionRepeatsCredit("Photo de 王倩生 sur Pixabay", "王倩生", "Pixabay"));
    assert.ok(captionRepeatsCredit("Photo de Yulia Gapeenko sur Vecteezy", "Yulia Gapeenko", "Autre"));
    // La légende dit autre chose, ou parle de quelqu'un d'autre : gardée
    assert.ok(!captionRepeatsCredit("Sagrada Familia, Crédit : Léo Thomas", "Léo Thomas", ""));
    assert.ok(!captionRepeatsCredit("MindMap fait par Workyt via Discord", "Rédaction Workyt", "Photo maison"));
    assert.ok(!captionRepeatsCredit("Photo de Greg Rosenke sur Unsplash", "Emily Levine", "Unsplash"));
    assert.ok(!captionRepeatsCredit("Le port de Marseille", "", ""));
});

test("crédit des images : pastille cliquable, légende en double retirée", () => {
    const fig = (caption: string, url = "https://unsplash.com/@gregrosenke") =>
        `<figure class="wk-figure"><div class="wk-figure-media"><img src="/m/a.webp" alt=""><span class="credit" data-author="Greg Rosenke" data-source="Unsplash" data-license="Licence Unsplash" data-url="${url}">Greg Rosenke · Unsplash<span class="credit-lic"> · Licence Unsplash</span></span></div><figcaption>${caption}</figcaption></figure>`;
    const out = renderPostHtml(fig("Photo de Greg Rosenke sur Unsplash"));
    assert.match(out, /<a class="credit" href="https:\/\/unsplash\.com\/@gregrosenke" target="_blank" rel="noopener noreferrer nofollow">Greg Rosenke · Unsplash<span class="credit-lic"> · Licence Unsplash<\/span><\/a>/);
    assert.doesNotMatch(out, /figcaption/);
    // Vraie légende : gardée ; sans adresse : pastille non cliquable
    const kept = renderPostHtml(fig("Le bureau d'une étudiante", ""));
    assert.match(kept, /<figcaption>Le bureau d&#39;une étudiante<\/figcaption>|<figcaption>Le bureau d'une étudiante<\/figcaption>/);
    assert.match(kept, /<span class="credit"/);
    // Lien piégé : jamais en href
    assert.doesNotMatch(renderPostHtml(fig("x", "javascript:alert(1)")), /href="javascript/);
});
