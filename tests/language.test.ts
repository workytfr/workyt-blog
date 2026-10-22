import { test } from "node:test";
import assert from "node:assert/strict";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { DEFAULT_WORDS, classify, classifyBlock, countIssues, dictKey, documentCounts, jsonBlocks, languageRatio, tolerance, type LangContext, type RawIssue } from "../src/lib/language/core";
import { applyTypography } from "../src/lib/language/typography";
import { loadBridge } from "../src/lib/language/bridge";
import { documentBlocks } from "../src/editor/ui/language/LanguageCheck";
import { schemaExtensions } from "../src/editor/extensions";
import { analyzeSeo } from "../src/lib/seo/analyze";

const NB = " ";
const FINE = " ";
const ctx = (words: string[] = [], ignores: string[] = []): LangContext => ({ dictionary: new Set(words.map(dictKey)), ignores: new Set(ignores) });
const raw = (start: number, end: number, rule = "spell", type = "spell"): RawIssue => ({ start, end, rule, type, message: "", suggestions: [] });

test("typographie : apostrophes, insécables, guillemets, points de suspension", () => {
    assert.equal(applyTypography("C'est l'été... Super !"), `C’est l’été… Super${FINE}!`);
    assert.equal(applyTypography('Il a dit "bonjour" hier.'), `Il a dit «${NB}bonjour${NB}» hier.`);
    assert.equal(applyTypography("Il a dit « bonjour » hier."), `Il a dit «${NB}bonjour${NB}» hier.`);
    assert.equal(applyTypography("Note: rendez-vous à 14:30."), `Note${NB}: rendez-vous à 14:30.`);
    assert.equal(applyTypography("Quoi ?! Vraiment!!!"), `Quoi${FINE}?! Vraiment${FINE}!!!`);
    assert.equal(applyTypography("Bonjour , toi  là ."), "Bonjour, toi là.");
    assert.equal(applyTypography("Va sur https://workyt.fr/fiches?x=1 tout de suite"), "Va sur https://workyt.fr/fiches?x=1 tout de suite", "adresse intacte");
    assert.equal(applyTypography("Merci ;) à demain"), "Merci ;) à demain", "smiley intact");
    // Déjà propre : rien ne change (et une deuxième passe ne refait rien)
    const once = applyTypography(`L'"atelier" commence: viens vite !`);
    assert.equal(applyTypography(once), once);
});

test("classement : dictionnaire Workyt, noms propres, alertes ignorées, règles souples", () => {
    const text = "Sur Parcoursup, Workyt aide. Pomne et pomne.";
    assert.equal(classify(raw(4, 14), text, ctx())!.category, "nom", "majuscule au milieu de la phrase");
    assert.equal(classify(raw(16, 22), text, ctx(["workyt"])), null, "mot du dictionnaire");
    assert.equal(classify(raw(29, 34), text, ctx())!.category, "orthographe", "majuscule de début de phrase");
    assert.equal(classify(raw(38, 43), text, ctx())!.category, "orthographe");
    assert.equal(classify(raw(38, 43), text, ctx([], ["spell|pomne"])), null, "ignorée dans l'article");
    const g = (rule: string, type: string) => classify(raw(0, 3, rule, type), "Les enfant", ctx())!;
    assert.equal(g("gn_les_1m", "gn").category, "grammaire");
    assert.equal(g("typo_virgule", "typo").category, "typographie");
    assert.equal(g("g2__bs_malgré_que", "bs").category, "style", "tournure populaire : un conseil");
    assert.equal(g("eepi_écriture_épicène", "notype").category, "style", "écriture inclusive : au choix");
    assert.ok(g("redondances_paragraphe", "redon1").repetition);
    assert.ok(DEFAULT_WORDS.includes("Workyt"));
});

test("marge : une faute de temps en temps ne fait pas chuter la note", () => {
    assert.equal(tolerance(300), 1);
    assert.equal(tolerance(1200), 3);
    assert.equal(languageRatio(0, 1), 1);
    assert.equal(languageRatio(1, 1), 0.8);
    assert.equal(languageRatio(3, 1), 0.5);
    assert.equal(languageRatio(30, 1), 0);
});

const doc = {
    type: "doc",
    content: [
        {
            type: "paragraph",
            content: [
                { type: "text", text: "Les élèves " },
                { type: "text", marks: [{ type: "suggestionDelete", attrs: { id: "d1", author: "C", at: "" } }], text: "revisent" },
                { type: "text", marks: [{ type: "suggestionInsert", attrs: { id: "i1", author: "C", at: "" } }], text: "révisent" },
                { type: "text", text: " avec " },
                { type: "text", marks: [{ type: "code" }], text: "print()" },
                { type: "text", text: " et " },
                { type: "inlineMath", attrs: { latex: "x^2" } },
                { type: "text", marks: [{ type: "bold" }], text: " vite." },
            ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Un titre" }] },
        { type: "codeBlock", content: [{ type: "text", text: "const x = 1" }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Dans une liste" }] }] }] },
        { type: "callout", attrs: { variant: "definition" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Dans un encadré" }] }] },
    ],
};

test("texte : le serveur et l'éditeur lisent exactement les mêmes paragraphes", () => {
    const fromJson = jsonBlocks(doc);
    assert.deepEqual(
        fromJson.map((b) => [b.index, b.text]),
        [
            [0, "Les élèves révisent avec 1 et 1 vite."],
            [1, "Un titre"],
            [3, "Dans une liste"],
            [4, "Dans un encadré"],
        ],
    );
    const pm = PMNode.fromJSON(getSchema(schemaExtensions()), doc);
    const blocks = documentBlocks(pm);
    assert.deepEqual(
        blocks.map((b) => [b.index, b.text]),
        fromJson.map((b) => [b.index, b.text]),
    );
    // Chaque caractère suivi pointe sur le bon caractère du document
    for (const b of blocks) {
        b.map.forEach((pos, i) => {
            if (pos >= 0) assert.equal(pm.textBetween(pos, pos + 1), b.text[i], `« ${b.text} » [${i}]`);
        });
    }
});

test("Grammalecte : vraies fautes trouvées, style oral du blog laissé tranquille", () => {
    const bridge = loadBridge();
    const check = (text: string) => classifyBlock(bridge.check(text), text, ctx(DEFAULT_WORDS));

    const errors = check("Les enfant mange des pomme. Je suis aller au marché. Je mange une pomne rouje.");
    const found = errors.map((e) => `${e.category}:${e.text}`);
    for (const e of ["grammaire:enfant", "grammaire:pomme", "grammaire:aller", "orthographe:pomne", "orthographe:rouje"]) assert.ok(found.includes(e), `${e} dans ${found.join(", ")}`);

    // Ton oral, mots du web et de l'école : rien qui compte dans la note
    const blog = check("Du coup, t'as pas besoin de stresser. Bref. Et franchement ? C'est top ! Le bac, c'est pas la fin du monde. Ouvre Pronote, puis Parcoursup, et checke tes mails sur Discord.");
    const counted = blog.filter((e) => e.category === "orthographe" || e.category === "grammaire" || e.category === "typographie");
    assert.deepEqual(
        [...counted.map((e) => e.text)],
        ["checke"],
        "seul « checke » (anglicisme hors dictionnaire) est compté",
    );

    // Synonymes et suggestions
    assert.ok(bridge.suggest("pomne").includes("pomme"));
    assert.ok(bridge.synonyms("méthodes").some((g) => g.words.includes("façon")));

    // Décompte d'un document entier
    const counts = documentCounts(jsonBlocks(doc), jsonBlocks(doc).map((b) => bridge.check(b.text)), ctx(DEFAULT_WORDS));
    assert.equal(counts.orthographe + counts.grammaire, 0, JSON.stringify(counts));
    assert.deepEqual(countIssues([{ category: "style" }, { category: "nom" }]), { orthographe: 0, grammaire: 0, typographie: 0, style: 1, nom: 1 });
});

test("note SEO : groupe Langue sur 15, neutre tant que la vérification n'est pas faite", () => {
    const words = Array(60).fill("Les élèves révisent leurs cours chaque soir avec méthode.").join(" ");
    const input = { title: "T", seoTitle: "", seoDescription: "", excerpt: "", slug: "t", keywords: [], doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: words }] }] }, featuredImage: null, modules: [] };
    const lang = (r: ReturnType<typeof analyzeSeo>) => r.groups.find((g) => g.id === "language")!;
    assert.equal(lang(analyzeSeo({ ...input, language: { orthographe: 0, grammaire: 0, typographie: 0, style: 9, nom: 4 } })).points, 15, "style et noms propres ne comptent pas");
    assert.equal(lang(analyzeSeo({ ...input, language: null })).points, 7.5);
    assert.ok(lang(analyzeSeo({ ...input, language: { orthographe: 12, grammaire: 9, typographie: 20, style: 0, nom: 0 } })).points < 3);
    assert.equal(analyzeSeo(input).groups.reduce((s, g) => s + g.max, 0), 100);
});
