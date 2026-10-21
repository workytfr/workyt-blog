import { test } from "node:test";
import assert from "node:assert/strict";
import { slugFollowsTitle } from "../src/lib/slug";

test("adresse automatique : suit le titre, chiffres compris", () => {
    assert.ok(slugFollowsTitle("iphone-15", "iPhone 15"), "« -15 » fait partie du titre");
    assert.ok(slugFollowsTitle("iphone-15-2", "iPhone 15"), "suffixe d'une adresse déjà prise");
    assert.ok(slugFollowsTitle("mon-article-3", "Mon article"));
    assert.ok(slugFollowsTitle("category-article", "Category"), "adresse réservée");
    assert.ok(!slugFollowsTitle("iphone", "iPhone 15"), "« iphone-15 » sans le 15 : choisie à la main");
    assert.ok(!slugFollowsTitle("mon-adresse", "Mon article"));
    assert.ok(!slugFollowsTitle("autre-titre-2", "Mon article"), "suffixe sur une autre base");
});
