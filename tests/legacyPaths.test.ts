import { test } from "node:test";
import assert from "node:assert/strict";
import { flatCategoryPath } from "../src/lib/legacyPaths";

test("rubriques imbriquées de WordPress : on garde la dernière, pagination et flux compris", () => {
    assert.equal(flatCategoryPath("/category/actualites/education/"), "/category/education/");
    assert.equal(flatCategoryPath("/category/actualites/education/etudiant/"), "/category/etudiant/");
    assert.equal(flatCategoryPath("/category/culture/high-tech/page/2/"), "/category/high-tech/page/2/");
    assert.equal(flatCategoryPath("/category/culture/high-tech/feed/"), "/category/high-tech/feed/");
    assert.equal(flatCategoryPath("/category/culture/high-tech"), "/category/high-tech/");
});

test("adresses déjà à plat ou hors rubriques : rien à faire", () => {
    assert.equal(flatCategoryPath("/category/education/"), null);
    assert.equal(flatCategoryPath("/category/education/page/2/"), null);
    assert.equal(flatCategoryPath("/category/education/feed/"), null);
    assert.equal(flatCategoryPath("/tag/bac/"), null);
    assert.equal(flatCategoryPath("/un-article/"), null);
});
