import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, daySeries, daysInMonth, mondayOf, parisDay, parisMidnight, parisMonth, parisMonthStart } from "../src/lib/parisTime";

test("heure de Paris : le jour change à minuit à Paris, pas à minuit UTC", () => {
    assert.equal(parisDay(new Date("2026-10-02T22:30:00Z")), "2026-10-03", "0 h 30 à Paris (été)");
    assert.equal(parisDay(new Date("2026-12-31T23:30:00Z")), "2027-01-01", "0 h 30 à Paris (hiver)");
    assert.equal(parisMonth(new Date("2026-10-31T23:30:00Z")), "2026-11");
});

test("heure de Paris : minuit, y compris les jours de changement d'heure", () => {
    assert.equal(parisMidnight("2026-07-14").toISOString(), "2026-07-13T22:00:00.000Z");
    assert.equal(parisMidnight("2026-01-15").toISOString(), "2026-01-14T23:00:00.000Z");
    // Passage à l'heure d'hiver le 25 octobre 2026, à l'heure d'été le 29 mars 2026
    assert.equal(parisMidnight("2026-10-25").toISOString(), "2026-10-24T22:00:00.000Z");
    assert.equal(parisMidnight("2026-10-26").toISOString(), "2026-10-25T23:00:00.000Z", "le 25 dure 25 h");
    assert.equal(parisMidnight("2026-03-29").toISOString(), "2026-03-28T23:00:00.000Z");
    assert.equal(parisMidnight("2026-03-30").toISOString(), "2026-03-29T22:00:00.000Z", "le 29 dure 23 h");
    assert.equal(parisMonthStart(new Date("2026-11-15T12:00:00Z")).toISOString(), "2026-10-31T23:00:00.000Z");
});

test("heure de Paris : jours du calendrier, sans ajouter 24 h", () => {
    assert.deepEqual(daySeries("2026-10-24", 4), ["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"]);
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(mondayOf("2026-10-25"), "2026-10-19", "dimanche → lundi d'avant");
    assert.equal(mondayOf("2026-10-19"), "2026-10-19");
    assert.equal(daysInMonth("2028-02"), 29);
});
