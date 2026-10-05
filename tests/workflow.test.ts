import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedActions, editMode, nextStatus, WorkflowError, type WorkflowContext } from "../src/lib/workflow";

const ctx = (patch: Partial<WorkflowContext>): WorkflowContext => ({ status: "draft", role: "redacteur", isAuthor: true, isCorrector: false, pendingSuggestions: 0, ...patch });
const fails = (fn: () => unknown, status?: number) =>
    assert.throws(fn, (e: unknown) => e instanceof WorkflowError && (status === undefined || e.status === status));

test("le rédacteur soumet, retire, mais ne publie jamais seul", () => {
    assert.deepEqual(allowedActions(ctx({})), ["submit", "trash"]);
    assert.equal(nextStatus("submit", ctx({})), "pending_correction");
    assert.deepEqual(allowedActions(ctx({ status: "pending_correction" })), ["withdraw"]);
    fails(() => nextStatus("publish", ctx({})), 403);
    fails(() => nextStatus("approve", ctx({ status: "pending_approval" })), 403);
});

test("le correcteur prend, renvoie avec un motif, valide sans suggestion en attente", () => {
    const c = ctx({ role: "correcteur", isAuthor: false, status: "pending_correction" });
    assert.deepEqual(allowedActions(c), ["take"]);
    assert.equal(nextStatus("take", c), "in_correction");
    const mine = { ...c, status: "in_correction" as const, isCorrector: true };
    fails(() => nextStatus("return", mine), 400);
    assert.equal(nextStatus("return", mine, { reason: "Deux passages à revoir" }), "to_revise");
    fails(() => nextStatus("validate", { ...mine, pendingSuggestions: 2 }), 409);
    assert.equal(nextStatus("validate", mine), "pending_approval");
    // Un autre correcteur ne touche pas à une correction déjà prise
    assert.deepEqual(allowedActions({ ...mine, isCorrector: false }), []);
});

test("on ne corrige pas son propre article", () => {
    assert.deepEqual(allowedActions(ctx({ role: "correcteur", status: "pending_correction" })), ["withdraw"]);
});

test("la rédaction en chef approuve maintenant ou planifie, refuse avec un motif", () => {
    const now = new Date("2026-10-03T10:00:00Z");
    const c = ctx({ role: "redac_chef", isAuthor: false, status: "pending_approval" });
    assert.deepEqual(allowedActions(c), ["approve", "refuse"]);
    assert.equal(nextStatus("approve", c, { now }), "published");
    assert.equal(nextStatus("approve", c, { now, at: new Date("2026-10-03T10:00:30Z") }), "published", "moins d'une minute : tout de suite");
    assert.equal(nextStatus("approve", c, { now, at: new Date("2026-10-05T07:00:00Z") }), "scheduled");
    fails(() => nextStatus("refuse", c));
    assert.equal(nextStatus("refuse", c, { reason: "Hors sujet" }), "draft");
    assert.deepEqual(allowedActions({ ...c, status: "scheduled" }), ["unschedule"]);
});

test("qui modifie le texte selon le statut", () => {
    const base = { role: "redacteur" as const, isAuthor: true, isCorrector: false };
    assert.equal(editMode({ ...base, status: "draft" }), "edit");
    assert.equal(editMode({ ...base, status: "pending_correction" }), "read", "verrouillé pendant l'attente");
    assert.equal(editMode({ ...base, status: "in_correction" }), "read");
    assert.equal(editMode({ ...base, status: "to_revise" }), "edit");
    assert.equal(editMode({ ...base, status: "published" }), "read");
    assert.equal(editMode({ role: "correcteur", isAuthor: false, isCorrector: true, status: "in_correction" }), "suggest");
    assert.equal(editMode({ role: "redac_chef", isAuthor: false, isCorrector: false, status: "published" }), "edit");
});
