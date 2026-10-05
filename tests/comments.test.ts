import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCommentText, commentFlags, editableUntil, EDIT_WINDOW_MS, initialStatus, isReaction, rateLimit, REACTIONS } from "../src/lib/commentRules";

test("filtre : liens externes et coordonnées vont en modération, pas les liens Workyt ni les mots courants", () => {
    assert.deepEqual(commentFlags("Super article, merci !"), []);
    assert.deepEqual(commentFlags("J'utilise Instagram et TikTok tous les jours"), [], "parler d'un réseau social reste permis");
    assert.deepEqual(commentFlags("Voir https://workyt.fr/cours/maths et blog.workyt.fr"), [], "liens Workyt permis");
    assert.deepEqual(commentFlags("Va sur https://exemple.com/promo"), ["lien externe"]);
    assert.deepEqual(commentFlags("regarde monsite.fr c'est top"), ["lien externe"]);
    assert.deepEqual(commentFlags("écris-moi : jean.dupont@gmail.com"), ["adresse e-mail"]);
    assert.deepEqual(commentFlags("appelle le 06 12 34 56 78"), ["numéro de téléphone"]);
    assert.deepEqual(commentFlags("suis-moi @jean_dupont"), ["pseudo de réseau social"]);
    assert.deepEqual(commentFlags("2 + 2 = 4 et 3,14159265"), [], "les calculs ne sont pas des numéros");
});

test("statut : premier commentaire en attente, ensuite publié ; le filtre renvoie toujours en modération", () => {
    assert.deepEqual(initialStatus({ trusted: false, flags: [] }), { status: "pending", reasons: ["premier commentaire"] });
    assert.deepEqual(initialStatus({ trusted: true, flags: [] }), { status: "published", reasons: [] });
    assert.deepEqual(initialStatus({ trusted: true, flags: ["lien externe"] }), { status: "pending", reasons: ["lien externe"] });
});

test("modification pendant 15 minutes, limites de fréquence, texte nettoyé", () => {
    const t0 = Date.parse("2026-10-05T10:00:00Z");
    assert.equal(editableUntil({ createdAt: new Date(t0) }, t0 + 60_000), t0 + EDIT_WINDOW_MS);
    assert.equal(editableUntil({ createdAt: new Date(t0) }, t0 + EDIT_WINDOW_MS + 1), null);
    assert.match(rateLimit({ lastAt: new Date(t0), lastHour: 1, now: t0 + 10_000 }) ?? "", /Doucement/);
    assert.match(rateLimit({ lastAt: new Date(t0 - 120_000), lastHour: 10, now: t0 }) ?? "", /beaucoup commenté/);
    assert.equal(rateLimit({ lastAt: new Date(t0 - 120_000), lastHour: 3, now: t0 }), null);
    assert.equal(cleanCommentText("  Bonjour\r\n\n\n\n\n\nfin  "), "Bonjour\n\n\nfin");
    assert.equal(cleanCommentText("x".repeat(5000)).length, 2000);
});

test("réactions : celles de l'ancien blog", () => {
    assert.deepEqual(
        REACTIONS.map((r) => r.label),
        ["J'aime", "Triste", "Happy", "En mode sleep", "Énervé", "Dead", "Clin d'œil"]
    );
    assert.ok(isReaction("love"));
    assert.ok(!isReaction("<script>"));
});
