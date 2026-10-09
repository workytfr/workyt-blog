import { test } from "node:test";
import assert from "node:assert/strict";
import { contentHash, needsSession, revisionKind, sessionCutoff, sessionLabel, SESSION_GAP_MS } from "../src/lib/revisionRules";

const now = Date.parse("2026-10-09T12:00:00Z");
const at = (minAgo: number) => new Date(now - minAgo * 60_000);

test("versions : nature déduite du libellé pour les anciennes", () => {
    assert.equal(revisionKind({ label: sessionLabel("Camille") }), "session");
    assert.equal(revisionKind({ label: "Avant restauration" }), "restore");
    assert.equal(revisionKind({ label: "Publié" }), "step");
    assert.equal(revisionKind({ kind: "step", label: sessionLabel("Camille") }), "step", "le champ l'emporte");
});

test("versions : une séance par personne, après une étape, ou toutes les 30 min", () => {
    assert.ok(needsSession(null, "a", now), "première modification");
    assert.ok(!needsSession({ kind: "session", member: "a", createdAt: at(10) }, "a", now), "même personne, même séance");
    assert.ok(needsSession({ kind: "session", member: "a", createdAt: at(10) }, "b", now), "quelqu'un d'autre s'y met");
    assert.ok(needsSession({ kind: "session", member: "a", createdAt: new Date(now - SESSION_GAP_MS - 1) }, "a", now), "plus de 30 min");
    assert.ok(needsSession({ kind: "step", member: "a", createdAt: at(1) }, "a", now), "après une étape, nouvelle séance");
    assert.ok(!needsSession({ label: sessionLabel("A"), member: "a", createdAt: at(5) }, "a", now), "ancienne séance sans champ kind");
});

test("versions : empreinte du titre et du texte", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Bonjour" }] }] };
    assert.equal(contentHash("Titre", doc), contentHash("Titre", structuredClone(doc)));
    assert.notEqual(contentHash("Titre", doc), contentHash("Autre titre", doc));
    assert.notEqual(contentHash("Titre", doc), contentHash("Titre", { ...doc, content: [] }));
});

test("versions : séances effacées après 30 jours", () => {
    assert.equal(sessionCutoff(new Date(now)).toISOString(), "2026-09-09T12:00:00.000Z");
});
