import { test } from "node:test";
import assert from "node:assert/strict";
import { diffBlocks, diffWords } from "../src/lib/textDiff";
import { documentSuggestions, withoutSuggestions } from "../src/editor/marks";
import { documentToHtml } from "../src/editor/html";
import { documentBlocks } from "../src/editor/blocks";
import { lockedByOther } from "../src/lib/lockRule";

const ins = (id: string) => ({ type: "suggestionInsert", attrs: { id, author: "Camille", at: "2026-10-03T10:00:00Z" } });
const del = (id: string) => ({ type: "suggestionDelete", attrs: { id, author: "Camille", at: "2026-10-03T10:00:00Z" } });
const doc = {
    type: "doc",
    content: [
        {
            type: "paragraph",
            content: [
                { type: "text", text: "Les élèves " },
                { type: "text", marks: [del("d1")], text: "revisent" },
                { type: "text", marks: [ins("i1")], text: "révisent" },
                { type: "text", text: " le " },
                { type: "text", marks: [{ type: "comment", attrs: { threadId: "t1" } }], text: "bac" },
                { type: "text", text: "." },
            ],
        },
    ],
};

test("suggestions : listées par identifiant, jamais dans le HTML public", () => {
    assert.deepEqual(
        documentSuggestions(doc).map((s) => [s.kind, s.id, s.text]),
        [
            ["delete", "d1", "revisent"],
            ["insert", "i1", "révisent"],
        ]
    );
    const html = documentToHtml(withoutSuggestions(doc));
    assert.equal(html, "<p>Les élèves revisent le bac.</p>", "état d'origine, sans marque de relecture");
    assert.match(documentToHtml(doc), /<del data-suggestion="d1"[^>]*class="wk-sugg wk-sugg--del">revisent<\/del>/);
});

test("comparaison de versions : paragraphes puis mots", () => {
    assert.deepEqual(diffWords("le bac de maths", "le bac de français"), [
        { kind: "same", text: "le bac de " },
        { kind: "removed", text: "maths" },
        { kind: "added", text: "français" },
    ]);
    const d = diffBlocks(["Titre", "Un paragraphe stable.", "Ancien texte ici."], ["Titre", "Un paragraphe stable.", "Nouveau texte ici.", "Ajout."]);
    assert.equal(d.length, 4);
    assert.deepEqual(d[2].map((p) => p.kind), ["removed", "added", "same"]);
    assert.deepEqual(d[3], [{ kind: "added", text: "Ajout." }]);
    assert.deepEqual(documentBlocks(doc), ["Les élèves revisentrévisent le bac."]);
});

test("verrou : tenu par un autre tant qu'il est actif depuis moins de 2 min", () => {
    const now = Date.parse("2026-10-03T10:00:00Z");
    const lock = (min: number) => ({ lock: { member: "a", at: new Date(now - min * 60_000) } });
    assert.equal(lockedByOther(lock(1), "b", now), true);
    assert.equal(lockedByOther(lock(3), "b", now), false, "abandonné depuis plus de 2 min");
    assert.equal(lockedByOther(lock(1), "a", now), false, "c'est le mien");
    assert.equal(lockedByOther({ lock: null }, "b", now), false);
});
