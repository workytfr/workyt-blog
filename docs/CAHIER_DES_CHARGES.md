# Cahier des charges — Blog Workyt (remplacement du WordPress de blog.workyt.fr)

> Version 1 — 2 octobre 2026
> Dépôt : `git@github.com:workytfr/workyt-blog.git`
> Statut : à valider (voir § 18 « Décisions et questions ouvertes »)

---

## 1. Contexte

Le blog `blog.workyt.fr` tourne sous WordPress 7.1 (thème Pixwell 11.9 +
Elementor, 25 extensions actives). Il occupe **10,8 Go** sur le serveur
(rapport « Santé du site » du 2 octobre 2026) :

| Poste (serveur) | Taille | Utilité réelle |
|---|---|---|
| `wp-content/uploads` (images) | **4,99 Go** | chaque image est stockée en 6 à 10 tailles par WordPress et Pixwell ; beaucoup d'images ne sont plus utilisées |
| Base de données MariaDB | **362 Mo** | surtout des journaux (sécurité, statistiques, Rank Math), des révisions et des données temporaires |
| `wp-content/plugins` (25 actives) | 306 Mo | Elementor, Jetpack, Site Kit, sécurité… largement inutilisés |
| `wp-content/themes` | 11 Mo | un seul thème sert |
| Reste (cœur WordPress, cache, sauvegardes) | ~5 Go au total avec les images | — |

Contenu à reprendre : **279 articles publiés**, **50 commentaires**, 12 pages
(non reprises, § 14).

Autres constats : 131 comptes WordPress séparés de Workyt (inscription ouverte
à tous, rôle « Abonné » par défaut) ; fuseau horaire
réglé sur UTC (les dates des articles sont en UTC) ; éditeur classique +
Elementor (contenu en HTML ou en blocs Elementor) ; extensions de sécurité
empilées (AIOS, WP Hardening, WP Hide, Remove Dashboard Access) ; cache
d'opcodes PHP plein.

Le reste de l'écosystème (workyt.fr) est déjà en Next.js / MongoDB, avec des
comptes, des rôles, un éditeur riche (TipTap) et un stockage d'images (R2). Le
blog vit à part : comptes séparés, style différent, outils différents.

## 2. Objectifs

1. **Ne rien perdre en référencement** : mêmes adresses (slugs) qu'aujourd'hui,
   mêmes métadonnées, redirections pour tout ce qui change.
2. **Un seul compte** : on se connecte au blog uniquement avec son compte Workyt
   (bouton « Se connecter avec Workyt »).
3. **Le même univers visuel** que workyt.fr.
4. **Un éditeur moderne par blocs**, au moins aussi pratique que Gutenberg.
5. **Une vraie chaîne éditoriale** : brouillon, correction, approbation,
   planification, avec rôles Rédacteur / Correcteur.
6. **Des modules d'article** : recette, avis tech, avis lecture, avis produit,
   sources.
7. **Un assistant SEO** qui note l'article sur 100, comme le plugin actuel.
8. **Diviser le stockage** : une seule version optimisée de chaque image, pas de
   plugins, pas de cache disque.

## 3. Périmètre

**Dans le périmètre** : site public du blog, tableau de bord (dashboard),
éditeur, workflow, commentaires, SEO, médiathèque, migration complète du
WordPress, connexion via Workyt, API pour workyt.fr.

**Hors périmètre (v1)** : boutique, newsletter propre au blog (on renvoie vers
celle de Workyt), multilingue, application mobile, publicité.

## 4. Choix techniques

| Sujet | Choix | Pourquoi |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript | même pile que workyt-next : code, composants et équipe partagés |
| Style | Tailwind 3 + les jetons Workyt (papier, encre, orange) | même rendu que workyt.fr |
| Polices | **Funnel Display + Montserrat uniquement** | charte Workyt, ne pas en ajouter |
| E-mails | service d'envoi de workyt-next (remplace WP Mail SMTP) | un seul expéditeur pour tout Workyt |
| Base de données | MongoDB (Mongoose), base dédiée `workyt-blog` sur le même serveur | isolation des données du blog, sauvegardes séparées |
| Images | Cloudflare R2 (déjà utilisé), un original optimisé (WebP/AVIF), tailles générées à la volée par `next/image` | fin des 6 à 10 copies par image |
| Éditeur | TipTap 3 / ProseMirror (déjà utilisé par workyt-next) + interface de blocs maison | réutilise l'existant (formules, blocs pédagogiques, menu « / ») |
| Rendu | pages statiques régénérées (ISR) + revalidation à la publication | rapidité et SEO |
| Temps réel (présence) | serveur `workyt-socket` existant | déjà en production pour le forum et le suivi |
| Tâches planifiées | **cron externe de l'hébergeur** appelant `/api/cron/<tâche>` (comme workyt-next) | le site est gelé quand il est inactif : pas de `node-cron` |
| Hébergement | même plateforme que workyt.fr, sous-domaine `blog.workyt.fr` | — |

## 5. Connexion « Se connecter avec Workyt »

### 5.1 Principe

workyt.fr devient **fournisseur d'identité** (OAuth 2.0 + OpenID Connect,
flux « authorization code » avec PKCE). Le blog est un client. C'est le même
mécanisme que « Se connecter avec Google », mais avec Workyt.

1. Sur le blog, l'utilisateur clique **« Se connecter avec Workyt »**.
2. Il arrive sur workyt.fr, se connecte s'il ne l'est pas déjà, puis autorise le
   blog (une seule fois).
3. Il revient sur le blog, connecté. Le blog connaît son identifiant Workyt, son
   pseudo, son avatar, son e-mail et son rôle Workyt.

### 5.2 À développer dans workyt-next (lot 0)

- `GET /oauth/authorize` : écran d'autorisation (au style Workyt).
- `POST /oauth/token` : échange du code contre un jeton (code à usage unique,
  durée 60 s, PKCE obligatoire).
- `GET /oauth/userinfo` : `sub` (id Workyt), `username`, `avatar`, `email`,
  `role`.
- `/.well-known/openid-configuration` + clés de signature (JWKS).
- Liste blanche des clients (le blog) et de leurs adresses de retour.
- Déconnexion : un lien « se déconnecter partout ».

Côté blog : NextAuth avec un fournisseur OAuth « Workyt » ; pas de mot de passe,
pas d'inscription locale.

> Alternative écartée : partager le cookie de session entre `workyt.fr` et
> `blog.workyt.fr`. Plus simple au départ, mais elle lie les deux sites (même
> secret, même version de NextAuth) et ne donne pas de bouton de connexion clair.

## 6. Rôles et permissions

Les rôles du blog sont **propres au blog** et attribués dans son dashboard. Un
Admin de Workyt est automatiquement Admin du blog.

- **Rédacteur(trice) en chef** : dirige la rédaction. C'est elle (ou un Admin)
  qui approuve et publie : **aucun Rédacteur ne publie sans son approbation**,
  même confirmé. Elle recrute et retire les Rédacteurs et Correcteurs.
- **Admin** : nomme ou retire le / la Rédacteur(trice) en chef, gère les
  réglages techniques du blog.

| Action | Lecteur | Rédacteur | Correcteur | Réd. en chef | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Lire, commenter, mettre en favori | ✔ | ✔ | ✔ | ✔ | ✔ |
| Créer un article, modifier ses brouillons | | ✔ | ✔ | ✔ | ✔ |
| Soumettre à correction | | ✔ | ✔ | ✔ | ✔ |
| Corriger l'article d'un autre (suggestions, commentaires) | | | ✔ | ✔ | ✔ |
| Valider la correction | | | ✔ | ✔ | ✔ |
| Approuver, publier, planifier | | | | ✔ | ✔ |
| Modifier un article publié | | son article* | | ✔ | ✔ |
| Gérer catégories, étiquettes, médias de tous | | | | ✔ | ✔ |
| Modérer les commentaires | | ses articles | ✔ | ✔ | ✔ |
| Donner / retirer le rôle Rédacteur ou Correcteur | | | | ✔ | ✔ |
| Nommer / retirer le Rédacteur en chef | | | | | ✔ |
| Réglages du blog, redirections | | | | | ✔ |

\* la modification d'un article publié repasse par la correction (sauf faute de
frappe : option « petite correction » réservée au Rédacteur en chef et aux Admins).

Le dashboard contient une page **Équipe** : recherche d'un compte Workyt,
attribution ou retrait des rôles (Rédacteur / Correcteur par le Rédacteur en
chef ; Rédacteur en chef par l'Admin), journal des changements.

## 7. Workflow éditorial

### 7.1 Statuts

```
Brouillon ──soumettre──▶ En attente de correction ──prendre──▶ En correction
    ▲                                                         │
    └──────────────── renvoyer au rédacteur ◀──────────────────┤
                                                              ▼
                                      En attente d'approbation
                                        │            │
                                   approuver     refuser (motif)
                                        ▼            ▼
                              Planifié / Publié   Brouillon
                                        │
                               dépublier ▼
                                     Dépublié ── corbeille (30 j) ──▶ supprimé
```

| Statut | Visible du public | Qui peut le modifier |
|---|:-:|---|
| Brouillon | non | auteur, co-auteurs |
| En attente de correction | non | personne (verrouillé) ; l'auteur peut le retirer |
| En correction | non | le correcteur qui l'a pris (suggestions + commentaires) |
| En attente d'approbation | non | Rédacteur en chef, Admin |
| Planifié | non (avant la date) | Rédacteur en chef, Admin |
| Publié | oui | voir § 6 |
| Dépublié | non (410 ou redirection au choix) | Rédacteur en chef, Admin |

### 7.2 Règles

- **Brouillon automatique** : enregistrement toutes les 10 s et à la perte de
  focus ; récupération après fermeture accidentelle.
- **Révisions** : chaque changement de statut et chaque session d'édition crée
  une révision ; comparaison côte à côte et restauration.
- **Correction** : le correcteur travaille en **mode suggestion** (ajouts en
  vert, suppressions barrées, comme le « suivi des modifications » de Word) et
  laisse des **commentaires ancrés** sur un passage. Le rédacteur accepte ou
  refuse chaque suggestion.
- **Motif obligatoire** pour un refus ou un renvoi.
- **Checklist avant soumission** : titre, image à la une avec texte
  alternatif, catégorie, extrait, **source et licence de chaque image (bloquant,
  § 8.4)**, score SEO ≥ 60 (avertissement, pas blocage).
- **Notifications** (sur le blog et dans les notifications Workyt) : article
  soumis, pris en correction, corrigé, approuvé, refusé, publié, commentaire.

### 7.3 Planification

- Date et heure de publication (fuseau Europe/Paris), modifiables tant que
  l'article n'est pas publié.
- Publication par le **cron externe** (`/api/cron/publish`, toutes les 5 min,
  idempotent). Un article planifié dont l'heure est passée est publié au
  passage suivant.
- **Calendrier éditorial** dans le dashboard (vue mois / semaine,
  glisser-déposer pour replanifier).

### 7.4 Présence : « qui est en train de… »

- Dans l'éditeur et la liste des articles : avatars des personnes qui
  **consultent** ou **modifient** l'article en ce moment (via `workyt-socket`).
- **Verrou d'édition** : une seule personne modifie le contenu à la fois ; les
  autres voient « *Camille est en train de modifier* » et passent en lecture
  seule, avec « demander la main ». Le verrou tombe après 2 min d'inactivité.
- Les correcteurs peuvent commenter pendant que le verrou est pris.

## 8. Éditeur par blocs

### 8.1 Expérience (équivalent Gutenberg)

- **Tout est bloc** : poignée pour déplacer, barre d'outils du bloc,
  transformation (paragraphe → titre → citation…), duplication, suppression.
- **Insertion** : bouton « + » entre deux blocs, menu « / » au clavier,
  panneau latéral de blocs avec recherche.
- **Raccourcis Markdown** : `#`, `##`, `-`, `1.`, `>`, `` ``` ``, `---`, `**gras**`.
- **Panneau latéral** à onglets : *Article* (statut, catégorie, étiquettes,
  image à la une, extrait, auteur et co-auteurs, slug, date), *Bloc* (réglages
  du bloc sélectionné), *SEO* (§ 10), *Modules* (§ 9).
- **Collage propre** depuis Google Docs, Word ou une page web (styles nettoyés,
  images rapatriées dans la médiathèque).
- Annuler / rétablir, mode plein écran « focus », compteur de mots, temps de
  lecture, **aperçu ordinateur / tablette / mobile**, aperçu partageable par
  lien secret (avant publication).
- **Blocs réutilisables** et **modèles d'article** (ex. « Critique de livre »
  qui pré-insère le module Avis lecture).

### 8.2 Blocs

| Famille | Blocs |
|---|---|
| Texte | paragraphe, titres H2–H4, liste à puces / numérotée / à cocher, citation, citation mise en avant, code (coloration), formule LaTeX, note de bas de page |
| Médias | image (légende, alt obligatoire, lien), galerie, image + texte, vidéo (fichier ou YouTube / Vimeo / Dailymotion), audio, intégration (X/Twitter, Instagram, TikTok, Spotify…) |
| Mise en page | colonnes (2–4), séparateur, espace, groupe avec fond, bouton / groupe de boutons |
| Structure | sommaire automatique, accordéon / FAQ (balisage FAQPage), tableau, encadré (info, astuce, attention) |
| Workyt | blocs pédagogiques (définition, propriété, exemple, méthode, attention), carte vers un cours / une fiche / une question du forum Workyt |
| Modules | les modules du § 9, aussi insérables à un endroit précis de l'article |

### 8.3 Stockage du contenu

- Le contenu est enregistré en **JSON** (document ProseMirror) : jamais de HTML
  saisi tel quel, donc pas de faille XSS par le contenu.
- Le HTML public est généré à la publication et mis en cache.

### 8.4 Droits et crédit des images (obligatoire)

Chaque image publiée doit prouver qu'on a le droit de l'utiliser.

- **À l'envoi dans la médiathèque**, champs obligatoires :
  - **auteur** (ou « Rédaction Workyt » pour une photo maison) ;
  - **provenance** : Pixabay, Unsplash, Pexels, Wikimedia Commons, kit presse,
    photo personnelle, capture d'écran, image générée par IA, autre ;
  - **licence** : Pixabay, Unsplash, Pexels, CC0, CC BY, CC BY-SA, kit presse
    (usage autorisé), autorisation écrite, photo maison… ;
  - **lien vers l'original** (obligatoire sauf photo maison) ;
  - pour « autorisation écrite » ou « kit presse » : pièce jointe ou lien de
    preuve (e-mail, page presse), visible seulement de la rédaction.
- **Blocage** : un article ne peut pas être soumis à correction tant qu'une
  image (à la une, dans le texte, dans un module) n'a pas sa source. L'éditeur
  liste les images à compléter avec un bouton « Compléter maintenant ».
- **Vérification** : le correcteur coche « droits vérifiés » pour chaque image
  lors de la correction ; le Rédacteur en chef voit l'état avant d'approuver.
- **Licences interdites** : NC (non commercial) si le blog porte des liens
  affiliés, ND (pas de modification) si l'image est recadrée ; l'outil prévient.
- **Crédit affiché sur toutes les images**, au style Workyt : pastille claire
  arrondie en bas à droite de l'image, icône appareil photo orange,
  « Auteur · Provenance » (+ licence quand elle l'exige, ex. CC BY). Le crédit
  est aussi dans le balisage `ImageObject` (`creditText`, `license`,
  `acquireLicensePage`), ce que Google affiche dans Google Images.
- **Migration** : les images WordPress sans source passent en « à vérifier »
  dans la médiathèque ; liste dédiée pour la rédaction.

## 9. Modules d'article

Un article peut avoir **plusieurs modules**. Chacun a un formulaire dans
l'onglet *Modules*, un rendu soigné dans l'article, et son **balisage
schema.org** pour Google.

| Module | Champs | Rendu | Données structurées |
|---|---|---|---|
| **Recette** | nom, image, portions, temps de préparation / cuisson / total, difficulté, coût, ingrédients (quantité, unité, nom, groupes), ustensiles, étapes (texte + image), astuces, valeurs nutritionnelles (option), régimes (végétarien…) | carte recette, bouton « imprimer la recette », cases à cocher des ingrédients, ajustement des portions | `Recipe` |
| **Avis tech** | produit, marque, modèle, image, prix constaté, fiche technique (paires clé / valeur), critères notés (design, performances, autonomie…), points forts / faibles, verdict, note globale /10 | boîte de verdict, barres de notes, tableau de caractéristiques | `Review` + `Product` |
| **Avis lecture** | titre, auteur(s), éditeur, année, ISBN, pages, genre, public, résumé sans spoiler, critères notés, coup de cœur, note /5 | carte livre avec couverture | `Review` + `Book` |
| **Avis produit** | produit, image, prix, lien marchand (affiliation : `rel="sponsored nofollow"` + mention), points forts / faibles, critères, note | boîte d'achat, comparatif si plusieurs produits | `Review` + `Product` (+ `Offer`) |
| **Coup de cœur** | objet du coup de cœur (livre, film, appli, lieu, produit, site…), image, « pourquoi on l'aime » (2–3 phrases), lien (affilié possible), badge | encadré « Coup de cœur de la rédaction » signé par l'auteur de l'article | `Review` court ou `ItemList` selon l'objet |
| **Coup de cœur externe** | même contenu, mais **signé par un autre rédacteur du blog** (réservé aux comptes ayant un rôle de rédaction) | encadré « Le coup de cœur de *Camille* » avec son avatar et sa citation, lien vers sa page auteur | `Review` avec `author` = le rédacteur invité |
| **Sources** | liste de références : type (article, livre, étude, site, vidéo), titre, auteur(s), éditeur / média, date, URL, date de consultation, citation | « Sources » numérotées en fin d'article ; appels `[1]` cliquables dans le texte | `citation` dans `Article` |

**Coup de cœur externe — invitation** : l'auteur de l'article choisit un autre
rédacteur et lui envoie une invitation (notification). L'invité rédige ou
corrige son propre texte dans un petit formulaire, puis le **valide** ; tant
qu'il ne l'a pas validé, l'article ne peut pas partir en approbation. L'invité
est crédité comme contributeur de l'article (encart auteur et page auteur). Il
peut retirer sa contribution avant la publication.

Règles communes : notes affichées identiquement partout (même composant),
mention « lien sponsorisé » automatique pour l'affiliation, les modules
remplissent l'assistant SEO (ex. une recette sans image fait perdre des points).

### 9.1 Liens affiliés (confirmé : le blog en utilise)

- **Gestionnaire de liens** dans le dashboard : nom, marchand, URL d'affiliation,
  programme (Amazon, Awin, Fnac…), date d'expiration éventuelle.
- Liens courts **`/go/<nom>/`** (redirection 302) : on change l'URL marchande à
  un seul endroit, et les clics sont comptés (statistiques sans cookie).
- Attributs automatiques `rel="sponsored nofollow noopener"` et ouverture dans
  un nouvel onglet ; mention de transparence en tête de tout article qui
  contient un lien affilié (obligation légale).
- Vérification périodique des liens morts (cron externe) et alerte au
  Rédacteur en chef.
- Migration des « deals » de l'ancien plugin Pixwell Deal vers ce gestionnaire.

## 10. SEO

Le plugin utilisé aujourd'hui est **Rank Math** : le nouveau blog reprend ses
conventions pour que la bascule soit invisible pour Google.

### 10.1 Adresses conservées (priorité n° 1)

- **Mêmes slugs et même structure d'URL** que le WordPress. Réglages relevés
  le 2 octobre 2026 (Réglages → Permaliens, Rank Math → Liens) :
  - structure « Titre de la publication » : article `/<slug>/`
    (ex. `https://blog.workyt.fr/exemple-article/`) ;
  - préfixes de catégorie et d'étiquette **vides** (valeurs par défaut) et
    option Rank Math « Supprimer la base de catégorie » **désactivée** :
    catégorie `/category/<slug>/`, étiquette `/tag/<slug>/` ;
  - auteur `/author/<slug>/` ; pagination `/page/2/`,
    `/category/<slug>/page/2/` ;
  - flux `/feed/`, `/category/<slug>/feed/`, `/<slug>/feed/` (commentaires).
- **Barre oblique finale obligatoire** (`trailingSlash: true` dans Next.js) :
  toute adresse sans `/` final redirige en 301 vers la version avec.
- **Toutes les anciennes URL** (pièces jointes `?attachment_id=`, `?p=123`,
  archives par date, `amp/`, pages Elementor) : redirection 301 vers
  l'équivalent, ou 410 si le contenu n'existe plus.
- **Gestionnaire de redirections** dans le dashboard + journal des 404.
- **Contrôle avant bascule** : on parcourt le sitemap actuel ; chaque URL doit
  répondre 200 (ou 301 vers une page 200) sur le nouveau blog.

### 10.2 Technique

- Sitemaps aux **mêmes adresses que Rank Math** (index relevé le 2 octobre
  2026) : `sitemap_index.xml` (+ redirection de `sitemap.xml`) qui liste
  `post-sitemap.xml`, `category-sitemap.xml` et `author-sitemap.xml`.
  - **Pas de sitemap des étiquettes** aujourd'hui : on n'en ajoute pas (les
    pages d'étiquettes restent en ligne mais hors sitemap, comme maintenant).
  - **`page-sitemap.xml` disparaît** de l'index : les pages sont redirigées vers
    workyt.fr (§ 14). L'adresse répond 410 pour que Google l'oublie vite.
  - **1 000 liens maximum par fichier** (`post-sitemap2.xml` au-delà) ;
    **images incluses**, image à la une comprise ; balise `lastmod` exacte.
  - `robots.txt` (qui pointe vers `sitemap_index.xml`), flux RSS/Atom.
- Balises : `<title>`, meta description, canonique, Open Graph, Twitter Card,
  `noindex` réglable par article / catégorie.
- JSON-LD : `Article` (comme Rank Math aujourd'hui), `BreadcrumbList` (fil d'Ariane, en remplacement de
  Breadcrumb NavXT), `Organization`, `Person` (auteur), `WebSite` + recherche,
  et les données des modules (§ 9).
- **Performance** : LCP < 2,5 s, CLS < 0,1, INP < 200 ms sur mobile ; images
  responsive en AVIF/WebP ; aucune police tierce en dehors des deux autorisées.
- **IndexNow** et ping du sitemap à chaque publication.
- **Google Search Console** : la propriété `https://blog.workyt.fr/` est
  vérifiée **par fichier** aujourd'hui (Site Kit). Le fichier de vérification
  `google*.html` doit être servi à la racine du nouveau blog (ou passer à une
  vérification DNS, qui ne dépend plus du site) **avant** la bascule.
- **Mesure d'audience : Umami** (`https://stats.youss.dev`), comme workyt.fr :
  script chargé via `NEXT_PUBLIC_UMAMI_URL` et `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
  (un site Umami dédié au blog). Sans cookie, donc sans bandeau de
  consentement. **Google Analytics est abandonné** (Site Kit retiré).

### 10.3 Assistant SEO (score sur 100)

Panneau dans l'éditeur, recalculé en direct. Pour chaque critère : vert / orange
/ rouge, explication en une phrase et lien vers le passage concerné.

| Groupe | Critères (pondération indicative) |
|---|---|
| Mot-clé principal (35) | dans le titre SEO, en début de titre, dans le slug, dans la meta description, dans l'introduction, dans un sous-titre H2/H3, dans un texte alternatif, densité 0,5–2,5 %, mot-clé non utilisé par un autre article |
| Titre et description (15) | titre 40–60 caractères, description 120–160 caractères, aperçu Google (ordinateur et mobile) |
| Contenu (20) | longueur ≥ 600 mots (≥ 300 pour une brève), sous-titres tous les ~300 mots, paragraphes courts, au moins une image, toutes les images ont un alt |
| Liens (15) | ≥ 2 liens internes (blog ou workyt.fr), ≥ 1 lien externe de qualité, pas de lien cassé |
| Lisibilité (15) | phrases < 20 mots en moyenne, voix passive limitée, mots de transition (liste française), score de lisibilité adapté au français |

- Mot-clé principal + jusqu'à 4 mots-clés secondaires.
- Suggestion de liens internes (articles du blog et contenus workyt.fr proches).
- Score enregistré avec l'article ; filtre « score < 60 » dans le dashboard.
- Reprise des données **Rank Math** à la migration (métadonnées des articles,
  termes et auteurs) : `rank_math_title`, `rank_math_description`,
  `rank_math_focus_keyword` (mot-clé principal + secondaires),
  `rank_math_robots`, `rank_math_canonical_url`, `rank_math_primary_category`,
  `rank_math_facebook_*` / `rank_math_twitter_*`, données de schéma, et le score
  `rank_math_seo_score` (pour calibrer notre assistant).
- Modèles identiques à Rank Math (relevés le 2 octobre 2026) pour que Google
  ne voie aucune différence :
  - titre d'un article : `%title% %sep% %sitename%` avec **`-` comme
    séparateur** (remplacé par le titre SEO de l'article quand il en a un) ;
  - description : `%excerpt%` (remplacée par la description SEO de l'article) ;
  - type de schéma par défaut : **`Article`** (et non `BlogPosting`) ;
  - taxonomie principale : **Catégories** (catégorie principale choisie par
    article, utilisée dans le fil d'Ariane et le schéma).
- Fonction **« contenu pilier »** (comme Rank Math) : un article peut être
  marqué pilier ; l'assistant SEO propose alors des liens vers lui depuis les
  autres articles du même sujet, avec le mot-clé principal comme texte du lien.
- Import des **redirections Rank Math** (`wpbq_rank_math_redirections`) et de
  son journal des 404.

## 11. Commentaires

- Réservés aux comptes Workyt connectés ; réponses sur un niveau.
- **Premier commentaire** d'un compte en attente de modération ; une fois
  celui-ci approuvé, les suivants sont publiés directement (confirmé). Un
  signalement ou un filtre déclenché remet le commentaire en modération.
- Anti-spam (remplace Akismet) : limite de fréquence, filtre de liens et de
  coordonnées personnelles (comme le suivi de workyt.fr), signalement.
- Modification par l'auteur pendant 15 min, suppression par l'auteur ou la
  modération ; « j'aime » sur les commentaires.
- L'auteur de l'article est notifié ; les réponses notifient le commentateur.
- Les commentaires WordPress existants sont importés (comptes associés quand
  l'e-mail correspond à un compte Workyt, sinon affichés comme « invité »).
- Balisage `Comment` dans le JSON-LD.

## 12. Site public

- **Accueil** : à la une, dernières publications, catégories, articles
  populaires.
- **Article** : titre, chapô, auteur(s) avec avatar Workyt, date de
  publication et de mise à jour, temps de lecture, barre de progression,
  sommaire, partage, modules, sources, encart auteur, articles liés,
  commentaires, appel vers workyt.fr (cours, fiches, suivi).
- **Catégorie / étiquette / auteur / recherche** : listes paginées avec la
  carte de contenu commune de workyt.fr (`ContentCard`).
- **Navigation** : le blog est un **site séparé** de workyt.fr, avec son propre
  en-tête (pas celui de workyt.fr), construit comme le Pixwell actuel au style
  Workyt :
  - barre fine du haut : liens vers Workyt (Cours, Fiches, Forum, Devenir
    rédacteur, Annoncer sur Workyt) et réseaux sociaux ;
  - barre principale : logo « Le blog de Workyt », rubriques (Actualités,
    Conseils & méthodes, Nos interviews, Culture, Nos tests, avec sous-menus),
    favoris, mode sombre, recherche, Connexion ;
  - pied de page propre au blog (rubriques, liens Workyt, pages légales qui
    renvoient vers workyt.fr).
- **Page d'article** (maquette `maquettes/article.html`) : image à la une en
  pleine largeur derrière le titre, catégories, titre et méta en blanc, crédit
  de l'image ; puis contenu + partage à gauche (logos des réseaux) + colonne
  de widgets à droite ; « Tu aimeras aussi » en bas.
- Mode sombre, accessibilité RGAA niveau AA (contrastes, clavier, lecteurs
  d'écran).

## 13. Dashboard (`blog.workyt.fr/dashboard`)

| Page | Contenu | Rôles |
|---|---|---|
| Accueil | mes brouillons, articles à corriger, à approuver, planifiés, derniers commentaires | tous les membres de l'équipe |
| Articles | liste filtrable (statut, auteur, catégorie, score SEO), actions groupées, présence en direct | selon § 6 |
| Calendrier | articles planifiés et publiés, glisser-déposer | Réd. en chef, Admin |
| Correction | file des articles « en attente de correction », « mes corrections » | Correcteur+ |
| Médiathèque | images (recherche, alt, utilisation, doublons), envoi multiple, recadrage, **source et licence obligatoires**, filtre « droits à vérifier » | Rédacteur+ |
| Catégories / étiquettes | arbre, slugs, descriptions SEO | Réd. en chef, Admin |
| Commentaires | à modérer, signalés, tous | Correcteur+ |
| Équipe | rôles des comptes Workyt (§ 6) | Réd. en chef, Admin |
| Redirections | 301 / 410, journal des 404 | Admin |
| Statistiques | vues par article (compteur interne, repris de Post Views Counter), articles les plus lus, clics sur les liens affiliés ; lien vers le tableau Umami du blog | Réd. en chef, Admin |
| Réglages | titre, description, réseaux, réglages des commentaires, vérifications des moteurs | Admin |

### 13.1 Direction visuelle

Références fournies : un tableau de bord type « Bloggo » (accueil) et un
éditeur type « MarkAI » (rédaction). On en reprend la **structure**, habillée
aux couleurs de Workyt : fond papier, encre, accent orange, Funnel Display pour
les titres, Montserrat pour le texte, cartes blanches très arrondies.

**Coque commune**

- **Barre latérale gauche** : logo Workyt Blog ; Accueil, Articles,
  Calendrier, Correction, Médiathèque, Commentaires, Notifications (pastille
  du nombre non lus) ; un bloc « Mes rubriques » (catégories suivies, avec
  pastille de couleur) ; en bas « Aide » et l'avatar Workyt. Repliable en rail
  d'icônes (comme l'éditeur MarkAI) sur les petits écrans et dans l'éditeur.
- **Barre du haut** : recherche globale (articles, médias, personnes),
  bouton principal « Nouvel article », avatar.

**Accueil du dashboard**

- Salutation (« Bonjour Nadir 👋 ») et une phrase de bilan : articles publiés
  ce mois-ci, vues, articles en attente de toi.
- **Carte « Premiers pas »** pour un nouveau rédacteur, masquable : étapes à
  cocher (compléter son profil d'auteur → écrire un premier brouillon →
  atteindre 70 au score SEO → soumettre à correction), avec illustration et
  bouton d'action à droite.
- **Trois raccourcis** en cartes : « Nouvel article », « Partir d'un modèle »
  (recette, avis lecture, avis tech…), « Reprendre mon dernier brouillon ».
- **Grille d'articles** (filtre « Modifiés récemment par moi » / « Toute
  l'équipe ») : chaque carte montre une **miniature de la page**, une
  **étiquette de statut** colorée en haut au centre, le titre, « modifié il y
  a 20 min » et l'avatar de l'auteur. Couleurs d'étiquette :

  | Statut | Couleur |
  |---|---|
  | Brouillon | gris |
  | En attente de correction | violet |
  | En correction (quelqu'un modifie) | bleu, avec avatar de la personne |
  | À réviser (renvoyé au rédacteur) | jaune |
  | En attente d'approbation | orange |
  | Planifié | bleu ciel, avec la date |
  | Publié | vert |

- Colonne ou bloc « À faire » selon le rôle : corrections à prendre,
  approbations en attente, commentaires à modérer.

**Éditeur**

- **Trois zones** : rail d'icônes à gauche (navigation repliée) ; **panneau
  latéral** (onglets Article, SEO, Modules, Bloc — à gauche comme MarkAI ou à
  droite, à trancher en maquette) ; **page d'écriture** centrée et aérée qui
  ressemble à l'article publié.
- **En-tête** : titre de l'article, statut, avatars des personnes présentes
  (§ 7.4), boutons « Aperçu », « Partager l'aperçu », action principale selon
  le rôle (« Soumettre à correction », « Valider la correction »,
  « Approuver », « Publier » / « Planifier ») et menu « ⋯ » (révisions,
  dupliquer, exporter, corbeille).
- **Barre d'outils** : annuler / rétablir, style du bloc (Texte normal, H2,
  H3…), gras, italique, souligné, barré, listes, lien, image, insertion de
  bloc, puis l'indicateur d'enregistrement à droite (« Enregistré ✓ »,
  « Enregistrement… », « Hors ligne »).
- **Jauge du score SEO** toujours visible (cercle /100 de la couleur du
  score), qui ouvre l'onglet SEO au clic.
- Les **commentaires de correction** s'affichent en marge, à hauteur du
  passage commenté.

Les maquettes (Figma ou prototype HTML) de l'accueil, de la liste d'articles
et de l'éditeur sont à valider avant le lot 2.

## 14. Migration du WordPress

1. **Export** : sauvegarde complète de la base WordPress (préfixe `wpbq_`) et du
   dossier `uploads` du serveur (la copie locale ne contient pas les images).
2. **Script d'import** (rejouable, sans effet de bord) :
   - articles : titre, slug, date, auteur, statut, extrait,
     catégories, étiquettes, image à la une ;
   - contenu Gutenberg / éditeur classique / Elementor → blocs (§ 8.3) ;
     ce qui ne se convertit pas est signalé dans un rapport ;
   - données de notes Pixwell → module Avis ;
   - métadonnées et redirections **Rank Math** → champs SEO et redirections ;
   - « deals » Pixwell Deal → gestionnaire de liens affiliés ;
   - images : uniquement les **originaux réellement utilisés** (dans un
     contenu, une image à la une ou un profil d'auteur), convertis en WebP/AVIF,
     envoyés sur R2 ; les liens du contenu sont réécrits. Sur les 4,99 Go
     actuels, on vise **moins de 1 Go** ;
   - comptes : association des 131 comptes WordPress à leur compte Workyt
     (par e-mail) ; les auteurs sans compte deviennent des profils
     « auteur invité » ;
   - **PublishPress Authors** : co-auteurs de chaque article, profils d'auteur
     (biographie, champs personnalisés, photo) et pages auteur `/author/<slug>/` ;
   - **Post Views Counter** : nombre de vues de chaque article (point de départ
     des statistiques et du classement « les plus lus ») ;
   - dates : converties depuis UTC (réglage WordPress actuel) ;
   - commentaires approuvés.
3. **Redirections** générées pour toutes les anciennes formes d'URL (§ 10.1).
   Les **pages** WordPress (à propos, contact, mentions…) ne sont pas reprises :
   elles redirigent en 301 vers leur équivalent sur workyt.fr
   (`/a-propos`, `/mentions-legales`, `/politique-confidentialite`…).
4. **Recette** sur une copie : comparaison des URL, titres, descriptions et
   rendus de tous les articles.
5. **Bascule** : passage du DNS de `blog.workyt.fr` sur le nouveau site,
   soumission du sitemap, surveillance de la Search Console pendant 4 semaines.
6. Archivage du WordPress (sauvegarde gardée 3 mois), puis suppression.

## 15. Intégration avec workyt.fr

- workyt-next interroge aujourd'hui `https://blog.workyt.fr/wp-json/wp/v2/posts`
  (recherche globale `src/app/api/search/route.ts` et newsletter
  `src/lib/newsletter/fetchContent.ts`). Le nouveau blog expose :
  - une API propre `GET /api/public/posts?search=&after=&limit=` ;
  - **pendant la transition**, une route compatible
    `/wp-json/wp/v2/posts` (champs `id, title.rendered, link, date,
    excerpt.rendered, _embedded.wp:featuredmedia`) pour ne rien casser.
  - workyt-next sera ensuite basculé sur l'API propre.
- Les notifications du blog (article approuvé, commentaire…) apparaissent aussi
  dans les notifications Workyt (API interne protégée par secret).
- Points Workyt (option) : publier un article, recevoir des commentaires.

## 16. Exigences non fonctionnelles

- **Sécurité** : droits vérifiés côté serveur pour chaque action ; contenu
  stocké en JSON et assaini au rendu ; protection CSRF ; limites de débit ;
  envois de fichiers vérifiés (type, taille, ré-encodage des images) ; secrets
  hors du dépôt.
- **RGPD** : aucune donnée collectée en dehors du compte Workyt et des
  commentaires ; statistiques sans cookie ; export / suppression des données
  d'un compte relayés depuis workyt.fr.
- **Sauvegardes** : base sauvegardée chaque nuit, R2 versionné.
- **Qualité** : TypeScript strict, ESLint, tests unitaires sur le workflow
  (transitions de statuts, droits) et l'assistant SEO, tests de bout en bout
  sur les parcours clés (écrire → corriger → approuver → publier).
- **Stockage visé** : de 10,8 Go à **environ 1 Go** au total (images < 1 Go
  sur R2, base < 50 Mo, code < 50 Mo), aucune copie multiple d'image, aucun
  cache disque persistant.

## 17. Lots et ordre de réalisation

| Lot | Contenu | Livrable vérifiable |
|---|---|---|
| 0 | Fournisseur d'identité Workyt (OAuth/OIDC) dans workyt-next | « Se connecter avec Workyt » fonctionne sur un client de test |
| 1 | Socle du blog : connexion, rôles, modèle article, affichage public, routes et slugs identiques, SEO technique | un article importé s'affiche à la même adresse qu'aujourd'hui |
| 2 | Éditeur par blocs (§ 8) + médiathèque R2 | rédiger et publier un article complet |
| 3 | Workflow, révisions, mode suggestion, planification (cron externe), présence | parcours brouillon → correction → approbation → planifié → publié |
| 4 | Modules : sources, recette, avis tech / lecture / produit, coup de cœur (+ externe avec invitation), liens affiliés | chaque module affiché + validé par le test de résultats enrichis de Google |
| 5 | Assistant SEO /100 | score identique à ±5 points de Rank Math sur 10 articles témoins |
| 6 | Commentaires + modération + notifications | — |
| 7 | Dashboard complet (calendrier, statistiques, redirections, équipe) | — |
| 8 | Migration, recette, bascule DNS | 100 % des URL du sitemap actuel répondent 200/301 |

## 18. Décisions et questions ouvertes

### Décidé (2 octobre 2026)

| Sujet | Décision |
|---|---|
| Plugin SEO actuel | Rank Math : reprise de ses données, sitemaps et redirections (§ 10) |
| Publication | aucun Rédacteur ne publie seul : le Rédacteur en chef ou un Admin approuve |
| Rôles | le Rédacteur en chef gère la rédaction (Rédacteurs, Correcteurs) ; l'Admin nomme ou retire le Rédacteur en chef |
| Affiliation | oui : gestionnaire de liens affiliés (§ 9.1) |
| Commentaires | seul le premier commentaire d'un compte est modéré |
| Modules ajoutés | Coup de cœur, Coup de cœur externe signé par un autre rédacteur du blog uniquement (§ 9) |
| Pages statiques | pas reprises : redirigées vers les pages de workyt.fr (§ 14) |
| Adresses | `/<slug>/`, `/category/<slug>/`, `/tag/<slug>/`, barre oblique finale (§ 10.1) |
| SEO | modèles Rank Math repris tels quels, schéma `Article`, catégorie principale (§ 10.2) |
| Sitemaps | articles, catégories, auteurs (pas d'étiquettes) ; `page-sitemap.xml` supprimé (§ 10.2) |
| Séparateur des titres | `-` |
| Images | source + licence obligatoires, crédit affiché sur chaque image au style Workyt (§ 8.4) |
| Rubriques | Actualités, Conseils & méthodes, Nos interviews, Culture, Nos tests |
| Page d'article | mise en page Pixwell actuelle : image à la une en pleine largeur derrière le titre, au style Workyt |
| Volume actuel | 10,8 Go dont 4,99 Go d'images et 362 Mo de base ; 131 comptes ; 279 articles, 50 commentaires, 12 pages |
| Nom du site | `%sitename%` = **Workyt** (slogan « Blog ») : titres Google « Mon article - Workyt » |
| Formats | date « 2 octobre 2026 », heure « 8h02 », semaine du lundi, fuseau Europe/Paris (WordPress était réglé sur UTC) |
| Mesure d'audience | Umami (`stats.youss.dev`), pas de Google Analytics |

### Encore ouvert

Rien de bloquant pour démarrer. Restent à fournir au moment de la migration
(lot 8) : la sauvegarde de la base WordPress (`.sql`), le dossier
`wp-content/uploads` et le fichier de vérification Google `google*.html`
(ou le passage à une vérification DNS).
