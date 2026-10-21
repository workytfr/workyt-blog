import { test } from "node:test";
import assert from "node:assert/strict";
import { blogRole, displayName, parseArticles, parseStaff, titleKey, titleSimilarity } from "../src/lib/staffSheet";

test("suivi de rédaction : staff (e-mail, prénom, présence, rôle sur le blog)", () => {
    const staff = parseStaff([
        ["Adresse Mail", "Statut de présence (rédaction)", "Statut de Présence au 6/10/25", "Pseudo discord", "Prénom", "Rôle(s)"],
        ["Laura@Gmail.com ", "x", "Présent(e)", "lauramaes_71662", "Laura", "Rédaction Blog"],
        ["chloe@gmail.com", "x", "Ancien(ne) bénévole", "mensonges.\n", "", "Correction"],
        ["pas-un-mail", "x", "Présent(e)", "jade", "Jade", "Rédaction Blog, Rédaction Cours, Correction"],
        ["", "", "", "", "", ""],
    ]);
    assert.equal(staff.length, 3);
    assert.deepEqual(staff[0], { discord: "lauramaes_71662", email: "laura@gmail.com", firstName: "Laura", present: true, role: "redacteur" });
    assert.equal(staff[1].discord, "mensonges.");
    assert.equal(staff[1].present, false);
    assert.equal(displayName(staff[1]), "mensonges.");
    assert.equal(staff[2].email, null);
    assert.equal(staff[2].role, "correcteur");
});

test("suivi de rédaction : rôle (correction > rédaction blog, cours seuls = aucun)", () => {
    assert.equal(blogRole("Rédaction Blog, Correction"), "correcteur");
    assert.equal(blogRole("Rédaction Blog"), "redacteur");
    assert.equal(blogRole("Rédaction Cours"), null);
    assert.equal(blogRole(null), null);
});

test("suivi de rédaction : articles sans correcteur ignorés, titres comparables", () => {
    const articles = parseArticles([
        ["Nom du cours ", "Catégories", "Rédacteur", "Correcteur", "État"],
        ["L’inscription au salon est ouverte !", "Orientation", "nad.s", "Geraldinem._ ", "En ligne"],
        ["Sans correcteur", "x", "nad.s", null, "En ligne"],
        ["À faire", "x", "nad.s", "todo", "En ligne"],
    ]);
    assert.deepEqual(articles, [{ title: "L’inscription au salon est ouverte !", corrector: "geraldinem._" }]);
    assert.equal(titleKey("L’inscription au salon est ouverte !"), titleKey("L'inscription au salon est ouverte"));
    assert.equal(titleKey("Les soucis des cours à distance !"), "lessoucisdescoursadistance");
});

test("suivi de rédaction : titre retouché à la publication reconnu, titre voisin non", () => {
    assert.ok(titleSimilarity("L'effet Matilda en sciences, illustré en 4 exemples", "L’effet Matilda en sciences, illustré avec 4 exemples") >= 0.75);
    assert.ok(titleSimilarity("Péache, autrice de 19 ans, sort son troisième roman", "Péache, 19 ans, sort son troisième roman") >= 0.75);
    assert.ok(titleSimilarity("Malte, perle de la Méditerranée : Un voyage à travers le temps", "L’histoire de Marathon : une course à travers le temps") < 0.75);
});
