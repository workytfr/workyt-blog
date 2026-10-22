/*
    Workyt : pont entre le blog et Grammalecte 2.3.0 (https://grammalecte.net, GPL 3).

    Le même fichier sert :
    - dans l'éditeur, comme Web Worker (/grammalecte-2.3.0/workyt.js) ;
    - sur le serveur, chargé dans une machine virtuelle Node (src/lib/language/engine.ts)
      qui fournit importScripts et XMLHttpRequest.
    Les chemins sont relatifs à ce dossier.

    Messages (Worker) : { id, cmd, arg } → { id, result } ou { id, error }
    - init(options)      : charge le moteur et applique les options
    - check([textes])    : fautes de chaque paragraphe
    - suggest(mot)       : corrections d'un mot inconnu
    - synonyms(mot)      : synonymes (dictionnaire chargé à la première demande)
*/

"use strict";

importScripts(
    "graphspell/helpers.js",
    "graphspell/str_transform.js",
    "graphspell/char_player.js",
    "graphspell/lexgraph_fr.js",
    "graphspell/ibdawg.js",
    "graphspell/spellchecker.js",
    "text.js",
    "graphspell/tokenizer.js",
    "fr/conj.js",
    "fr/mfsp.js",
    "fr/phonet.js",
    "fr/thesaurus.js",
    "fr/cregex.js",
    "fr/gc_options.js",
    "fr/gc_functions.js",
    "fr/gc_rules.js",
    "fr/gc_rules_graph.js",
    "fr/gc_engine.js"
);

var workyt = {
    ready: false,
    synonymsReady: false,
    speller: null,

    init: function (options) {
        if (!this.ready) {
            conj.init(helpers.loadFile("fr/conj_data.json"));
            phonet.init(helpers.loadFile("fr/phonet_data.json"));
            mfsp.init(helpers.loadFile("fr/mfsp_data.json"));
            gc_engine.load("JavaScript", "aHSL", "graphspell/_dictionaries");
            this.speller = gc_engine.getSpellChecker();
            this.ready = true;
        }
        if (options) gc_engine.setOptions(helpers.objectToMap(options));
        return true;
    },

    check: function (text) {
        var out = [];
        var grammar = gc_engine.parse(text, "FR", false, null, false) || [];
        for (var i = 0; i < grammar.length; i++) {
            var e = grammar[i];
            out.push({ start: e.nStart, end: e.nEnd, rule: e.sRuleId, type: e.sType, message: e.sMessage, suggestions: e.aSuggestions || [], url: e.URL || "" });
        }
        var spelling = this.speller.parseParagraph(text) || [];
        for (var j = 0; j < spelling.length; j++) {
            var s = spelling[j];
            out.push({ start: s.nStart, end: s.nEnd, rule: "spell", type: "spell", message: "", suggestions: [], url: "" });
        }
        return out;
    },

    suggest: function (word) {
        var out = [];
        var it = this.speller.suggest(word);
        for (var list of it) {
            for (var k = 0; k < list.length; k++) if (out.indexOf(list[k]) < 0) out.push(list[k]);
        }
        return out.slice(0, 8);
    },

    synonyms: function (word) {
        if (!this.synonymsReady) {
            thesaurus.init(helpers.loadFile("fr/thesaurus1_data.json"), helpers.loadFile("fr/thesaurus2_data.json"));
            this.synonymsReady = true;
        }
        var forms = [word, word.toLowerCase()].concat(this.speller.getLemma(word) || []);
        var seen = {};
        var out = [];
        for (var i = 0; i < forms.length; i++) {
            if (seen[forms[i]]) continue;
            seen[forms[i]] = true;
            var groups = thesaurus.getSyns(forms[i]) || [];
            for (var g = 0; g < groups.length; g++) out.push({ label: String(groups[g][0]).replace(/[()]/g, ""), words: groups[g][1].slice(0, 24) });
        }
        return out.slice(0, 4);
    },
};

if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
    self.onmessage = function (event) {
        var d = event.data || {};
        try {
            var result;
            if (d.cmd === "init") result = workyt.init(d.arg);
            else if (d.cmd === "check") result = d.arg.map(function (t) { return workyt.check(t); });
            else if (d.cmd === "suggest") result = workyt.suggest(d.arg);
            else if (d.cmd === "synonyms") result = workyt.synonyms(d.arg);
            else throw new Error("Commande inconnue : " + d.cmd);
            self.postMessage({ id: d.id, result: result });
        } catch (e) {
            self.postMessage({ id: d.id, error: String((e && e.message) || e) });
        }
    };
}
