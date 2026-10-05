# Le blog de Workyt

Nouveau `blog.workyt.fr`, qui remplace le WordPress (Pixwell + Rank Math).
Cahier des charges : [`docs/CAHIER_DES_CHARGES.md`](docs/CAHIER_DES_CHARGES.md) ·
maquettes : [`maquettes/index.html`](maquettes/index.html).

Next.js 16 · React 19 · Tailwind 3 · MongoDB (Mongoose) · NextAuth — même pile
que workyt-next.

## Lancer en local

Toutes les commandes se lancent **dans le dossier `workyt-blog`** (pas dans
`workyt-next`). Trois terminaux.

**1. La base de données** (jetable, en mémoire : elle s'efface quand on ferme le terminal)

```sh
npm install                         # la première fois seulement
npm run db:dev                      # attendre « Base de développement prête », laisser ouvert
```

**2. Les articles d'exemple** (après chaque démarrage de la base ; refuse toute base distante)

PowerShell :

```powershell
$env:MONGODB_URI="mongodb://127.0.0.1:27018/workyt-blog"; npm run seed
```

Git Bash :

```sh
MONGODB_URI=mongodb://127.0.0.1:27018/workyt-blog npm run seed
```

**3. Le blog**, sur le port **3100** (le 3000 est celui de workyt-next, et
`NEXTAUTH_URL` attend 3100) :

```sh
npx next dev -p 3100                # http://localhost:3100
```

La première fois, copier `.env.example` en `.env.local` (PowerShell :
`Copy-Item .env.example .env.local`) et y mettre au moins
`MONGODB_URI=mongodb://127.0.0.1:27018/workyt-blog`,
`NEXTAUTH_URL=http://localhost:3100`, un `NEXTAUTH_SECRET` quelconque et
`BLOG_DEV_LOGIN=1`.

Avec `BLOG_DEV_LOGIN=1`, la page `/connexion/` propose une **connexion de
test** (pseudo + rôle : Rédacteur, Correcteur, Rédacteur en chef, Admin). Une
fenêtre de navigation privée par personne pour tester la relecture à
plusieurs. Elle est ignorée en production.

Pour essayer la vraie connexion « Se connecter avec Workyt », il faut aussi
lancer workyt-next sur une base de test : voir `OIDC.md` dans workyt-next
(partie « Essayer en local »), puis `WORKYT_URL=http://127.0.0.1:3200` dans
`.env.local`.

## Vérifier

```sh
npm run typecheck && npm run lint && npm test
npm run build
```

## Ce qui est en place (lot 1)

- **Adresses identiques au WordPress** (`trailingSlash`) : `/<slug>/`,
  `/category/<slug>/` (sous-rubriques comprises), `/tag/<slug>/`,
  `/author/<slug>/`, pagination `/page/<n>/`, recherche `/?s=`, flux `/feed/` et
  `/category/<slug>/feed/`.
- **Anciennes adresses** : `/?p=`, `?page_id=`, `?cat=`, `?tag=`, `?author=`,
  `?attachment_id=` (via `wpId`), `/<slug>/amp/`, `/<slug>/feed/`, archives par
  date, `wp-admin`, `wp-login.php`.
- **Table des redirections** (Rank Math, migration, manuelles) : 301/302, ou
  410 pour un contenu supprimé ; lue par `src/proxy.ts`, gardée en mémoire 1 min.
- **SEO comme Rank Math** : titres « … - Workyt », description = extrait ou
  description SEO, canonique, Open Graph, robots, schéma `Article` + fil
  d'Ariane + organisation + crédit d'image ; sitemaps `sitemap_index.xml`,
  `post-sitemap.xml` (1 000 liens par fichier), `category-sitemap.xml`,
  `author-sitemap.xml`, images incluses ; `page-sitemap.xml` en 410 ;
  `robots.txt`.
- **Pages publiques** au style des maquettes : accueil avec article à la une,
  article (image derrière le titre, crédit d'image, partage, widgets, auteurs,
  précédent / suivant, « Tu aimeras aussi »), rubrique, étiquette, auteur, 404,
  menu mobile.
- **Connexion** : fournisseur OpenID Connect « Workyt » (NextAuth), création du
  compte blog à la première connexion, Admin de workyt.fr = Admin du blog.
- **Rôles** (`src/lib/roles.ts`) : Lecteur, Rédacteur, Correcteur, Rédacteur en
  chef, Admin ; API `PATCH /api/team/<id>/role/` avec les règles du cahier des
  charges (le Rédacteur en chef gère la rédaction, l'Admin nomme le Rédacteur
  en chef).
- **API** : `/api/public/posts/` pour workyt.fr, et `/wp-json/wp/v2/posts`
  compatible le temps de la transition ; compteur de vues sans cookie.
- **Mesure d'audience** : Umami (`NEXT_PUBLIC_UMAMI_URL`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID`).

## Éditeur (lot 2)

- **Écriture par blocs** (TipTap) : menu « / », poignée pour déplacer, encadrés
  pédagogiques, formules LaTeX (`$x^2$`), tableaux, vidéos, listes à cocher ;
  enregistrement automatique ; aperçu `/apercu/<id>/` réservé à la rédaction.
- **Images** : médiathèque (R2 ou `public/uploads-dev` en local), source et
  licence obligatoires, crédit affiché sur l'image, droits vérifiés par la
  correction ; logo du site visé à droite des liens (`/api/favicon/<domaine>/`).

## Circuit de relecture (lot 3)

- **Étapes** (`src/lib/workflow.ts`, règles testées) : Brouillon → À corriger →
  En correction → (À réviser ↺) → À approuver → Planifié / Publié ; Dépublié,
  Corbeille (30 jours). Motif obligatoire pour renvoyer ou refuser ; aucun
  Rédacteur ne publie seul.
- **Mode suggestion** du correcteur : ajouts en vert, suppressions barrées, que
  le rédacteur accepte ou refuse une à une ; pas de publication tant qu'il en
  reste ; le HTML public ne les montre jamais.
- **Commentaires** ancrés sur un passage ou généraux, avec réponses et « Résolu ».
- **Versions** à chaque étape et à chaque séance d'écriture : comparaison mot à
  mot, restauration.
- **Présence et verrou** : avatars de qui regarde ou modifie ; une seule
  personne modifie à la fois (« Demander la main » / « Céder la main ») ; le
  verrou tombe après 2 min d'inactivité. Signaux HTTP toutes les 15 s, en
  attendant `workyt-socket`.
- **Notifications** dans le dashboard (cloche) ; le relais vers les
  notifications de workyt.fr viendra avec le lot 0.
- **Listes** : « À faire » selon le rôle (mes articles à réviser, file de
  correction, approbations), « Les miens », « Toute la rédaction », « Corbeille ».

## Modules et liens affiliés (lot 4)

- **Modules** (`src/lib/modules/`, onglet « Modules » de l'éditeur) : recette
  (portions ajustables, ingrédients à cocher, impression), avis tech, avis
  lecture, avis produit (comparatif automatique s'il y en a plusieurs), coup
  de cœur, coup de cœur d'un autre rédacteur (invitation, texte écrit et validé
  par l'invité, crédité comme contributeur ; l'article ne part pas en
  approbation avant), sources (appels `[n]` cliquables dans le texte).
  Chaque module s'affiche à la fin ou à l'endroit choisi, avec son balisage
  schema.org (`Recipe`, `Product` + `Review`, `Review` + `Book`, `citation`).
- **Liens affiliés** (`/dashboard/liens/`) : `/go/<nom>/` redirige vers le
  marchand et compte les clics sans cookie ; `rel="sponsored nofollow"`,
  mention « sponsorisé » et encadré de transparence automatiques ; liens morts
  vérifiés chaque nuit, rédaction en chef prévenue.

## Assistant SEO (lot 5)

- **Note sur 100** (`src/lib/seo/analyze.ts`, testée) comme Rank Math : mot-clé
  principal (35), titre et description (15), contenu (20), liens (15),
  lisibilité (15 : phrases, voix passive, mots de liaison, indice de Kandel et
  Moles). Recalculée en direct dans l'éditeur (jauge dans l'en-tête, onglet
  SEO avec « Voir » vers le passage), enregistrée avec l'article.
- Mot-clé déjà visé par un autre article, liens affiliés cassés, suggestions
  de liens internes (contenus piliers d'abord) ; avertissement sous 60 avant
  l'envoi en correction.

## Dashboard complet (lot 7)

Barre latérale repliable et recherche globale ; accueil (bilan, premiers pas,
modèles d'article, grille d'articles, à faire) ; articles (filtres statut,
auteur, rubrique, score SEO ; corbeille et restauration groupées) ;
calendrier (mois / semaine, glisser-déposer) ; correction ; rubriques et
étiquettes (redirections automatiques) ; équipe (rôles, journal) ;
redirections et journal des 404 ; statistiques (lectures par jour, plus lus,
rubriques, clics affiliés, Umami) ; réglages (description, réseaux,
vérifications) ; profil d'auteur.

## Connexion Workyt (lot 0)

workyt.fr est le fournisseur d'identité (OAuth 2.0 + OpenID Connect, PKCE) :
voir `OIDC.md` dans workyt-next. Sur le blog : `WORKYT_URL`, `WORKYT_CLIENT_ID=blog`,
`WORKYT_CLIENT_SECRET` (le même que `OIDC_BLOG_CLIENT_SECRET` sur workyt.fr).
« Se déconnecter partout » ferme aussi la session de workyt.fr.

Pas encore : commentaires des lecteurs (lot 6), import du WordPress (lot 8). Et la « mise à jour d'un article publié
repassant par la correction » (aujourd'hui, seule la rédaction en chef modifie
un article en ligne).

## Variables d'environnement

Voir [`.env.example`](.env.example). En production : `NEXT_PUBLIC_SITE_URL`,
`MONGODB_URI`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `WORKYT_URL`,
`WORKYT_CLIENT_ID`, `WORKYT_CLIENT_SECRET`, `MEDIA_HOSTS` (hôte R2 des images),
Umami, `CRON_SECRET`. Le build a besoin de la base : l'accueil est
pré-rendu avec les articles (les autres pages se génèrent à la demande).

## Hébergement

Sortie `standalone` (comme workyt-next). Aucune tâche planifiée dans le
processus : le cron externe de l'hébergeur appelle `/api/cron/<tâche>/` avec
le secret `CRON_SECRET` dans l'en-tête `x-cron-secret`, et
`curl -A "workyt-cron"` (jamais le User-Agent `curl` par défaut : ban
automatique).

| Tâche | Fréquence | Rôle |
|---|---|---|
| `publish` | toutes les 5 min | publie les articles planifiés dont l'heure est passée |
| `purge-trash` | chaque nuit | supprime les articles à la corbeille depuis plus de 30 jours |
| `check-links` | chaque nuit | vérifie les liens affiliés, prévient la rédaction en chef des liens morts |

Les deux sont idempotentes : un appel en trop ne fait rien.
