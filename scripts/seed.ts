/**
 * Données de démonstration pour le développement local : les vraies rubriques
 * du blog, quelques auteurs, des articles avec images créditées, et des
 * redirections d'exemple (page WordPress → workyt.fr, contenu supprimé).
 *
 *   MONGODB_URI=mongodb://127.0.0.1:27017/workyt-blog npm run seed
 *
 * Refuse de tourner sur une base distante (production) : sécurité.
 */
import mongoose from "mongoose";
import Category from "../src/models/Category";
import Tag from "../src/models/Tag";
import Author from "../src/models/Author";
import Post from "../src/models/Post";
import Redirect from "../src/models/Redirect";
import AffiliateLink from "../src/models/AffiliateLink";
import type { ArticleModule } from "../src/lib/modules/types";
import { readingMinutes } from "../src/lib/render";

const uri = process.env.MONGODB_URI || "";
const host = (() => {
    try {
        return new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://")).hostname;
    } catch {
        return "";
    }
})();
if (!["127.0.0.1", "localhost"].includes(host)) {
    console.error(`Refusé : le seed ne tourne que sur une base locale (hôte actuel : « ${host || "aucun"} »).`);
    process.exit(1);
}

const U = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=75&auto=format&fit=crop`;
const unsplash = (id: string, alt: string) => ({
    url: U(id),
    width: 1600,
    height: 1067,
    alt,
    credit: { author: "Photographe", source: "Unsplash", license: "Licence Unsplash", sourceUrl: "https://unsplash.com/license" },
    rightsVerified: true,
});

const BODY = (topic: string) => `
<p>Ce texte sert d'exemple pour le blog : ${topic}. Il remplace provisoirement les vrais articles, qui seront repris du WordPress au moment de la migration, avec exactement les mêmes adresses.</p>
<h2>Ce qu'il faut retenir</h2>
<p>Un bon article de blog va droit au but, donne des exemples concrets et renvoie vers les <a href="https://workyt.fr/cours">cours de Workyt</a> quand on veut aller plus loin.</p>
<ul><li>Une idée par paragraphe</li><li>Des sous-titres clairs</li><li>Des sources quand on cite un chiffre</li></ul>
<blockquote>Lire, c'est déjà réviser.</blockquote>
<h2>Pour aller plus loin</h2>
<p>La rédaction du blog est ouverte : si tu veux écrire, rejoins-nous depuis la page « Devenir rédacteur ».</p>
`;

async function main() {
    await mongoose.connect(uri);
    await Promise.all([Category.deleteMany({}), Tag.deleteMany({}), Author.deleteMany({}), Post.deleteMany({}), Redirect.deleteMany({}), AffiliateLink.deleteMany({})]);

    // Les vraies rubriques du blog (menu Pixwell)
    const [actu, conseils, interviews, culture, tests] = await Category.create([
        { slug: "actualites", name: "Actualités", color: "#ff6a1a", order: 1, wpId: 2 },
        { slug: "conseils-methodes", name: "Conseils & méthodes", color: "#6ec1e4", order: 2, wpId: 3 },
        { slug: "nos-interviews", name: "Nos interviews", color: "#b48cf2", order: 3, wpId: 4 },
        { slug: "culture", name: "Culture", color: "#ffb547", order: 4, wpId: 5 },
        { slug: "nos-tests", name: "Nos tests", color: "#7ed957", order: 5, wpId: 6 },
    ]);
    const [livres] = await Category.create([
        { slug: "livres", name: "Livres", color: "#ffb547", parent: culture._id, order: 1, description: "Nos lectures et critiques." },
        { slug: "orientation", name: "Orientation", color: "#6ec1e4", parent: conseils._id, order: 1 },
    ]);
    const [bac, lecture, numerique] = await Tag.create([
        { slug: "bac", name: "bac" },
        { slug: "lecture", name: "lecture" },
        { slug: "numerique", name: "numérique" },
    ]);
    const [sarah, camille, melisande] = await Author.create([
        { slug: "sarah", name: "Sarah", title: "Rédactrice en chef", bio: "Prof de français dans une autre vie, lectrice compulsive dans celle-ci.", wpId: 2 },
        { slug: "camille", name: "Camille", title: "Correctrice", bio: "Elle relit chaque article avant publication." },
        { slug: "melisande", name: "Mélisande", title: "Rédactrice", bio: "Numérique, vie privée et applis utiles.", wpId: 7 },
    ]);

    const day = 24 * 3600 * 1000;
    const posts = [
        { slug: "fantomapp-application-cnil", title: "FantomApp : l'application de la CNIL pour se protéger sur les réseaux sociaux", cats: [conseils, actu], tags: [numerique], authors: [melisande], img: unsplash("1511707171634-5f897ff02aa9", "Un smartphone posé sur une table"), ago: 4, views: 812 },
        { slug: "bac-de-francais-coups-de-coeur", title: "Bac de français : nos coups de cœur pour réviser", cats: [culture, livres], tags: [bac, lecture], authors: [sarah, camille], img: unsplash("1512820790803-83ca734da794", "Des livres empilés sur une étagère"), ago: 6, views: 1208 },
        { slug: "bien-choisir-son-orientation", title: "Bien choisir son orientation après la troisième", cats: [conseils], tags: [], authors: [sarah], img: unsplash("1523240795612-9a054b0db644", "Des étudiants le jour de la remise des diplômes"), ago: 10, views: 3412 },
        { slug: "parcoursup-erreurs-a-eviter", title: "Parcoursup : les erreurs à éviter", cats: [conseils], tags: [bac], authors: [melisande], img: unsplash("1522202176988-66273c2fd55f", "Des lycéens qui travaillent ensemble"), ago: 14, views: 2150 },
        { slug: "interview-professeure-de-maths", title: "Interview : une professeure de maths nous parle du brevet", cats: [interviews], tags: [], authors: [camille], img: unsplash("1503676260728-1c00da094a0b", "Un bureau d'élève avec des cahiers"), ago: 20, views: 540 },
        { slug: "test-tablette-prise-de-notes", title: "Test : la tablette idéale pour prendre des notes en cours", cats: [tests], tags: [numerique], authors: [melisande], img: unsplash("1517694712202-14dd9538aa97", "Un ordinateur portable ouvert"), ago: 26, views: 960 },
        { slug: "les-10-romans-avant-le-bac", title: "Les 10 romans à lire avant le bac de français", cats: [culture, livres], tags: [bac, lecture], authors: [sarah], img: unsplash("1495446815901-a7297e633e8d", "Une pile de livres"), ago: 33, views: 1890 },
        { slug: "methode-flashcards", title: "Réviser avec la méthode des flashcards", cats: [conseils], tags: [bac], authors: [sarah], img: unsplash("1456513080510-7bf3a84b82f8", "Des fiches de révision"), ago: 44, views: 1420 },
        { slug: "rentree-7-applis", title: "Rentrée : 7 applis pour s'organiser", cats: [actu, tests], tags: [numerique], authors: [melisande], img: unsplash("1550745165-9bc0b252726f", "Un écran d'ordinateur coloré"), ago: 48, views: 2780 },
        { slug: "interview-bibliothecaire", title: "Interview : une bibliothécaire nous donne ses conseils lecture", cats: [interviews, culture], tags: [lecture], authors: [camille], img: unsplash("1481627834876-b7833e8f5570", "Les rayonnages d'une bibliothèque"), ago: 55, views: 410 },
        { slug: "lire-plus-sans-ecran", title: "Lire plus, scroller moins : nos astuces", cats: [conseils, culture], tags: [lecture], authors: [sarah], img: unsplash("1544716278-ca5e3f4abd8c", "Un livre ouvert sur une table"), ago: 61, views: 690 },
        { slug: "concours-ecriture-workyt", title: "Le concours d'écriture Workyt est ouvert", cats: [actu], tags: [], authors: [camille], img: unsplash("1544947950-fa07a98d237f", "Un carnet et un stylo"), ago: 70, views: 260 },
        { slug: "recette-cookies-de-revision", title: "Recette : les cookies de révision, sans sucre ajouté", cats: [culture], tags: [], authors: [camille], img: unsplash("1499636136210-6f4ee915583e", "Des cookies sur une grille"), ago: 40, views: 330 },
    ];
    // Modules d'exemple (lot 4) : un de chaque, pour voir leur rendu et leur balisage
    const credit = { author: "Photographe", source: "Unsplash", license: "Licence Unsplash", sourceUrl: "https://unsplash.com/license" };
    const mimg = (id: string, alt: string) => ({ url: U(id, 1200), alt, width: 1200, height: 800, credit });
    await AffiliateLink.create([
        { name: "tablette-galaxy-tab-s9", label: "Tablette Galaxy Tab S9", merchant: "Fnac", url: "https://www.fnac.com/", program: "Awin", clicks: 42, health: "ok" },
        { name: "le-petit-prince", label: "Le Petit Prince (poche)", merchant: "Amazon", url: "https://www.amazon.fr/", program: "Amazon Partenaires", clicks: 17, health: "ok" },
    ]);
    const MODULES: Record<string, ArticleModule[]> = {
        "recette-cookies-de-revision": [
            {
                id: "rcookie1",
                type: "recipe",
                data: {
                    name: "Cookies de révision",
                    description: "Des cookies moelleux, sans sucre ajouté, pour tenir pendant les révisions.",
                    image: mimg("1499636136210-6f4ee915583e", "Des cookies sur une grille"),
                    servings: 12,
                    prepMinutes: 15,
                    cookMinutes: 12,
                    restMinutes: 30,
                    difficulty: "facile",
                    cost: "€",
                    ingredientGroups: [
                        { title: "Pour la pâte", items: [{ qty: "200", unit: "g", name: "flocons d'avoine" }, { qty: "2", unit: "", name: "bananes bien mûres" }, { qty: "1/2", unit: "c. à café", name: "cannelle" }] },
                        { title: "Pour la garniture", items: [{ qty: "80", unit: "g", name: "pépites de chocolat noir" }] },
                    ],
                    tools: ["un saladier", "une plaque de cuisson", "du papier cuisson"],
                    steps: [
                        { text: "Préchauffer le four à 180 °C. Écraser les bananes à la fourchette.", image: null },
                        { text: "Ajouter les flocons d'avoine et la cannelle, mélanger, puis les pépites. Laisser reposer 30 minutes.", image: null },
                        { text: "Former 12 boules, les aplatir sur la plaque et cuire 12 minutes.", image: null },
                    ],
                    tips: "Ils se gardent 4 jours dans une boîte en métal.",
                    diets: ["végétarien"],
                    nutrition: { calories: "110", proteins: "3", carbs: "17", fats: "4" },
                },
            },
        ],
        "test-tablette-prise-de-notes": [
            {
                id: "rtech001",
                type: "techReview",
                data: {
                    product: "Galaxy Tab S9",
                    brand: "Samsung",
                    model: "SM-X710",
                    image: mimg("1517694712202-14dd9538aa97", "Une tablette posée sur un bureau"),
                    price: "699 €",
                    specs: [{ key: "Écran", value: "11 pouces, AMOLED 120 Hz" }, { key: "Stylet", value: "S Pen fourni" }, { key: "Poids", value: "498 g" }],
                    criteria: [{ label: "Prise de notes", score: 9 }, { label: "Autonomie", score: 8 }, { label: "Rapport qualité-prix", score: 6.5 }],
                    pros: ["Stylet fourni et précis", "Écran superbe"],
                    cons: ["Prix élevé", "Pas de prise jack"],
                    verdict: "La meilleure tablette pour prendre des notes en cours, si le budget suit.",
                    score: 8.5,
                },
            },
            {
                id: "rprod001",
                type: "productReview",
                data: { product: "Galaxy Tab S9", image: null, price: "699 €", merchant: "Fnac", link: "/go/tablette-galaxy-tab-s9/", pros: ["Stylet fourni"], cons: ["Prix"], criteria: [], score: 8.5 },
            },
            {
                id: "rprod002",
                type: "productReview",
                data: { product: "iPad 10e génération", image: null, price: "489 €", merchant: "Apple", link: "https://www.apple.com/fr/ipad/", pros: ["Très fluide"], cons: ["Stylet en plus"], criteria: [], score: 7.5 },
            },
        ],
        "les-10-romans-avant-le-bac": [
            {
                id: "rbook001",
                type: "bookReview",
                data: {
                    title: "L'Étranger",
                    authors: "Albert Camus",
                    publisher: "Gallimard",
                    year: "1942",
                    isbn: "9782070360024",
                    pages: "184",
                    genre: "Roman",
                    audience: "Dès la 3e, incontournable pour le bac",
                    summary: "Meursault, un employé de bureau à Alger, raconte sa vie avec un détachement qui dérange. Un court roman qui se lit d'une traite et qui fait beaucoup réfléchir.",
                    image: mimg("1495446815901-a7297e633e8d", "Une pile de livres"),
                    criteria: [{ label: "Facile à lire", score: 4 }, { label: "Utile pour le bac", score: 5 }],
                    pros: ["Court et percutant", "Une écriture très simple"],
                    cons: ["Un héros déroutant au début"],
                    favorite: true,
                    score: 4.5,
                },
            },
            {
                id: "rfav0001",
                type: "favorite",
                data: { kind: "livre", name: "Le Petit Prince", image: mimg("1512820790803-83ca734da794", "Des livres empilés"), why: "On le lit à 10 ans pour l'histoire et à 16 ans pour tout le reste. Court, drôle et profond à la fois.", link: "/go/le-petit-prince/", badge: "Coup de cœur" },
            },
        ],
        "parcoursup-erreurs-a-eviter": [
            {
                id: "rsrc0001",
                type: "sources",
                data: {
                    items: [
                        { id: "src01", kind: "site", title: "Parcoursup : le calendrier officiel", authors: "", publisher: "Ministère de l'Enseignement supérieur", date: "2026-01-15", url: "https://www.parcoursup.gouv.fr/", accessed: "2026-10-01", quote: "" },
                        { id: "src02", kind: "étude", title: "Les néo-bacheliers et leurs vœux", authors: "SIES", publisher: "Note d'information", date: "2025-06-01", url: "https://www.enseignementsup-recherche.gouv.fr/", accessed: "2026-10-01", quote: "Neuf candidats sur dix reçoivent au moins une proposition." },
                    ],
                },
            },
        ],
    };
    let wpId = 100;
    for (const p of posts) {
        let html = BODY(p.title.toLowerCase());
        // Appels de source dans le texte (module Sources)
        if (p.slug === "parcoursup-erreurs-a-eviter") html = html.replace("donne des exemples concrets", 'donne des exemples concrets<sup data-source="src01" class="wk-cite"></sup>').replace("Des sources quand on cite un chiffre", 'Des sources quand on cite un chiffre<sup data-source="src02" class="wk-cite"></sup>');
        // Un module placé au milieu du texte (les autres s'affichent à la fin)
        if (p.slug === "les-10-romans-avant-le-bac") html = html.replace("<h2>Pour aller plus loin</h2>", '<div data-module="rbook001" class="wk-module-slot"></div><h2>Pour aller plus loin</h2>');
        await Post.create({
            title: p.title,
            slug: p.slug,
            status: "published",
            excerpt: `${p.title}. Un article d'exemple du blog Workyt, en attendant la migration des vrais articles.`,
            contentHtml: html,
            authors: p.authors.map((a) => a._id),
            categories: p.cats.map((c) => c._id),
            primaryCategory: p.cats[0]._id,
            tags: p.tags.map((t) => t._id),
            featuredImage: p.img,
            seo: { focusKeywords: [p.slug.split("-")[0]] },
            publishedAt: new Date(Date.now() - p.ago * day),
            modifiedAt: new Date(Date.now() - p.ago * day),
            readingMinutes: readingMinutes(html),
            views: p.views,
            wpId: wpId++,
            modules: MODULES[p.slug] ?? [],
        });
    }
    // Un brouillon (ne doit apparaître nulle part côté public)
    await Post.create({ title: "Brouillon secret", slug: "brouillon-secret", status: "draft", contentHtml: "<p>Pas encore publié.</p>", authors: [sarah._id], categories: [actu._id] });
    // Un article programmé dans le futur (invisible tant que la date n'est pas passée)
    await Post.create({ title: "Article programmé", slug: "article-programme", status: "published", contentHtml: "<p>Demain.</p>", authors: [sarah._id], categories: [actu._id], publishedAt: new Date(Date.now() + day) });

    await Redirect.create([
        { from: "/a-propos/", to: "https://workyt.fr/a-propos", status: 301, source: "migration" },
        { from: "/contact/", to: "https://workyt.fr/a-propos", status: 301, source: "migration" },
        { from: "/?page_id=12", to: "https://workyt.fr/mentions-legales", status: 301, source: "migration" },
        { from: "/ancien-article-renomme/", to: "/bien-choisir-son-orientation/", status: 301, source: "rankmath" },
        { from: "/article-supprime/", to: "", status: 410, source: "manual" },
    ]);

    console.log(`Seed terminé : ${posts.length} articles publiés, 1 brouillon, 1 programmé, 7 rubriques, 3 auteurs, 5 redirections.`);
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
