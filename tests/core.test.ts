import { test } from "node:test";
import assert from "node:assert/strict";
import { can, canAssignRole, initialRole } from "../src/lib/roles";
import { normalizePath } from "../src/lib/redirects";
import { formatDate, formatTime, joinNames } from "../src/lib/format";
import { absoluteUrl, pageTitle } from "../src/lib/site";
import { plainText, readingMinutes, renderPostHtml } from "../src/lib/render";

test("rôles : aucun rédacteur ne publie seul", () => {
    assert.equal(can("redacteur", "post.create"), true);
    assert.equal(can("redacteur", "post.publish"), false);
    assert.equal(can("correcteur", "post.publish"), false);
    assert.equal(can("redac_chef", "post.publish"), true);
    assert.equal(can("admin", "post.publish"), true);
    assert.equal(can("lecteur", "dashboard.access"), false);
    assert.equal(can(null, "comment"), false);
});

test("rôles : qui peut nommer qui", () => {
    const chef = { id: "chef", role: "redac_chef" as const };
    const admin = { id: "admin", role: "admin" as const };
    const lea = { id: "lea", role: "lecteur" as const };
    const sarah = { id: "sarah", role: "redac_chef" as const };
    assert.equal(canAssignRole(chef, lea, "redacteur"), null, "le Rédacteur en chef recrute des rédacteurs");
    assert.equal(canAssignRole(chef, lea, "correcteur"), null);
    assert.match(canAssignRole(chef, lea, "redac_chef") || "", /Admin/, "seul l'Admin nomme le Rédacteur en chef");
    assert.match(canAssignRole(chef, sarah, "lecteur") || "", /Admin/, "un Rédacteur en chef ne retire pas un autre Rédacteur en chef");
    assert.equal(canAssignRole(admin, lea, "redac_chef"), null, "l'Admin nomme le Rédacteur en chef");
    assert.equal(canAssignRole(admin, sarah, "redacteur"), null, "l'Admin retire le Rédacteur en chef");
    assert.match(canAssignRole(admin, lea, "admin") || "", /workyt\.fr/, "le rôle Admin vient de workyt.fr");
    assert.match(canAssignRole(chef, chef, "lecteur") || "", /propre rôle/);
    assert.match(canAssignRole({ id: "x", role: "redacteur" }, lea, "redacteur") || "", /réservée/);
    assert.equal(initialRole("Admin"), "admin");
    assert.equal(initialRole("Rédacteur"), "lecteur", "un rédacteur de workyt.fr n'est pas rédacteur du blog d'office");
});

test("redirections : chemins normalisés", () => {
    assert.equal(normalizePath("/A-Propos"), "/a-propos/");
    assert.equal(normalizePath("a-propos/"), "/a-propos/");
    assert.equal(normalizePath("//double//slash"), "/double/slash/");
    assert.equal(normalizePath("/caf%C3%A9/"), "/café/");
    assert.equal(normalizePath("/?page_id=12"), "/?page_id=12");
    assert.equal(normalizePath("/?Page_ID=12"), "/?page_id=12");
});

test("dates au format du WordPress (heure de Paris)", () => {
    assert.equal(formatDate("2026-10-02T06:02:00Z"), "2 octobre 2026");
    assert.equal(formatTime("2026-10-02T06:02:00Z"), "8h02", "UTC+2 en été");
    assert.equal(formatTime("2026-12-02T07:05:00Z"), "8h05", "UTC+1 en hiver");
    assert.equal(formatDate("2026-09-30T22:30:00Z"), "1 octobre 2026", "minuit passé à Paris");
    assert.equal(joinNames(["Sarah", "Camille"]), "Sarah et Camille");
    assert.equal(joinNames(["Sarah", "Léa", "Camille"]), "Sarah, Léa et Camille");
});

test("titres et adresses comme Rank Math", () => {
    assert.equal(pageTitle("Mon article"), "Mon article - Workyt");
    assert.equal(absoluteUrl("/mon-article"), "https://blog.workyt.fr/mon-article/");
    assert.equal(absoluteUrl("/post-sitemap.xml"), "https://blog.workyt.fr/post-sitemap.xml", "pas de / après un fichier");
});

test("HTML d'article assaini", () => {
    const html = renderPostHtml(
        '<p>Intro <a href="https://exemple.org">lien</a> <a href="/autre/">interne</a></p><script>alert(1)</script><p onclick="x()">Suite</p><img src="https://img/x.jpg" onerror="x()"><iframe src="https://evil.example/"></iframe><iframe src="https://www.youtube.com/embed/abc"></iframe>'
    );
    assert.ok(!html.includes("<script"), "pas de script");
    assert.ok(!html.includes("onclick") && !html.includes("onerror"), "pas d'attribut d'événement");
    assert.ok(html.startsWith('<p class="lead">'), "lettrine sur le premier paragraphe");
    assert.match(html, /href="https:\/\/exemple\.org" target="_blank" rel="noopener noreferrer"/, "lien externe protégé");
    assert.match(html, /href="\/autre\/">interne/, "lien interne inchangé");
    assert.ok(!html.includes("evil.example"), "iframe d'un hôte inconnu retirée");
    assert.ok(html.includes("youtube.com/embed/abc"), "vidéo YouTube gardée");
    assert.match(html, /<img src="https:\/\/img\/x.jpg" loading="lazy" decoding="async"/);
    assert.equal(plainText("<p>Un <b>deux</b></p>\n<p>trois</p>"), "Un deux trois");
    assert.equal(readingMinutes("<p>" + "mot ".repeat(660) + "</p>"), 3);
});
