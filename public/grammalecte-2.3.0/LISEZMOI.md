# Grammalecte 2.3.0

Correcteur grammatical et orthographique du français, par Olivier R.
Site : <https://grammalecte.net>. Licence : GPL 3 (<https://www.gnu.org/licenses/gpl-3.0.html>).

Fichiers repris tels quels de l'extension Firefox `grammalecte_fr-2.3.0.xpi`
(addons.mozilla.org, SHA-256
`443030004dbf62ecd5fc42f7b96872b96c9e3765f1cba4704a2a4170bb945256`), dossier
`grammalecte/` : le moteur (`fr/`, `graphspell/`, `text.js`), le dictionnaire
« toutes variantes » (orthographe classique et réformée de 1990 acceptées)
et le dictionnaire des synonymes. Les tests et les autres dictionnaires ne
sont pas repris.

`workyt.js` est le seul fichier écrit pour le blog : il relie le moteur à
l'éditeur (Web Worker) et au serveur (note SEO enregistrée), voir
`src/lib/language/`.

Mise à jour : remplacer les fichiers par ceux de la nouvelle version, renommer
le dossier et la constante `GRAMMALECTE_DIR` (`src/lib/language/core.ts`).
