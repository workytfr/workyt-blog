import { test } from "node:test";
import assert from "node:assert/strict";
import { containsRegex } from "../src/lib/searchRegex";

test("containsRegex : mots partiels, sans casse ni accents", () => {
    const title = "FantomApp : l'application de la CNIL — Révisions du bac, cœur";
    for (const term of ["appli", "fantom", "cnil", "revision", "RÉVISION", "révisions", "coeur", "cœur", "bac,"]) {
        assert.ok(containsRegex(term).test(title), term);
    }
    assert.ok(!containsRegex("maths").test(title));
});

test("containsRegex : les caractères spéciaux sont pris à la lettre", () => {
    assert.ok(containsRegex("c++").test("Apprendre le C++"));
    assert.ok(!containsRegex(".*").test("rien"));
});
