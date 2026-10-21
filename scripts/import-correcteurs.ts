/**
 * Correcteurs des anciens articles et rôles de l'équipe, repris du tableau
 * « Suivi de rédaction » (Google Sheets → Fichier → Télécharger → .xlsx).
 *
 *   npx tsx --env-file=.env.local scripts/import-correcteurs.ts migration/suivi.xlsx           (à blanc)
 *   npx tsx --env-file=.env.local scripts/import-correcteurs.ts migration/suivi.xlsx --apply   (écrit)
 *
 * - Chaque article du tableau avec un correcteur est retrouvé par son titre
 *   (ou, s'il a été retouché, par le plus ressemblant, listé pour vérification) ;
 *   le correcteur y est crédité (« Relu et corrigé par ») par son profil
 *   d'auteur, créé sans compte si besoin, avec son e-mail : il se relie au
 *   compte Workyt à la première connexion (même mécanisme que l'import
 *   WordPress). Nom affiché : le prénom, sinon le pseudo Discord.
 * - Un article déjà passé par le circuit de correction du blog n'est pas touché.
 * - Rôle donné à la première connexion : Correcteur ou Rédacteur pour les
 *   personnes « Présent(e) » ; aucun pour les anciens bénévoles. Déjà
 *   connecté et encore Lecteur : le rôle est donné tout de suite.
 *
 * Rejouable. Le tableau contient des e-mails : le garder dans migration/
 * (ignoré par git). Base distante refusée, sauf `--distant` avec IMPORT_CONFIRM=OUI.
 */
import { existsSync } from "node:fs";
import mongoose, { type Types } from "mongoose";
import { readSheet } from "read-excel-file/node";
import { slugify } from "../src/lib/slug";
import { displayName, parseArticles, parseStaff, titleKey, titleSimilarity, type SheetRows, type StaffEntry } from "../src/lib/staffSheet";
import { ROLE_LABELS, type Role } from "../src/lib/roles";
import Author from "../src/models/Author";
import Member from "../src/models/Member";
import Post from "../src/models/Post";
import RoleChange from "../src/models/RoleChange";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--apply");
const BY = "Import du suivi de rédaction";

if (!file || !existsSync(file)) {
    console.error("Usage : npx tsx --env-file=.env.local scripts/import-correcteurs.ts <tableau.xlsx> [--apply]");
    process.exit(1);
}

/* ─── Sécurité : base locale seulement, sauf demande explicite ─── */

const uri = process.env.MONGODB_URI || "";
const host = (() => {
    try {
        return new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://")).hostname;
    } catch {
        return "";
    }
})();
if (!["127.0.0.1", "localhost"].includes(host) && !(args.includes("--distant") && process.env.IMPORT_CONFIRM === "OUI")) {
    console.error(`Refusé : base « ${host || "aucune"} » distante. Pour la production : --distant avec IMPORT_CONFIRM=OUI.`);
    process.exit(1);
}

type AuthorRow = { _id: Types.ObjectId; slug: string; name: string; email?: string | null; discord?: string | null; member?: Types.ObjectId | null; wpRole?: string | null };

const SIMILAR = 0.75;
const log = { similar: [] as string[], created: [] as string[], credited: 0, unchanged: 0, skippedWorkflow: 0, skippedSelf: 0, notFound: [] as string[], roles: [] as string[], pending: [] as string[] };

async function uniqueSlug(name: string) {
    const base = slugify(name);
    for (let i = 1; i < 100; i++) {
        const s = i === 1 ? base : `${base}-${i}`;
        if (!(await Author.exists({ slug: s }))) return s;
    }
    return `${base}-${Date.now()}`;
}

/** Profil d'auteur d'une personne du tableau : par e-mail, pseudo Discord ou compte ; créé s'il n'existe pas */
const profiles = new Map<string, AuthorRow>();
async function profileOf(discord: string, staff: StaffEntry | undefined): Promise<AuthorRow> {
    const cached = profiles.get(discord);
    if (cached) return cached;
    const email = staff?.email ?? null;
    const member = email ? await Member.findOne({ email }).select("author").lean() : null;
    let a = ((email && (await Author.findOne({ email }).lean())) ||
        (await Author.findOne({ discord }).lean()) ||
        (member?.author && (await Author.findById(member.author).lean())) ||
        null) as AuthorRow | null;
    const name = staff ? displayName(staff) : discord;
    if (!a) {
        const fresh = { _id: new mongoose.Types.ObjectId(), slug: await uniqueSlug(name), name, email, discord, member: member?._id ?? null };
        if (apply) await Author.create(fresh);
        log.created.push(`${name} (${discord}${email ? `, ${email}` : ", sans e-mail"})`);
        a = fresh;
    } else {
        // Compléter sans écraser : le nom d'un ancien auteur WordPress reste le sien
        const set: Record<string, unknown> = {};
        if (!a.discord) set.discord = discord;
        if (email && !a.email && !(await Author.exists({ email }))) set.email = email;
        if (!a.member && member && !(await Author.exists({ member: member._id }))) set.member = member._id;
        if (Object.keys(set).length && apply) await Author.updateOne({ _id: a._id }, { $set: set });
        a = { ...a, ...set } as AuthorRow;
    }
    profiles.set(discord, a);
    return a;
}

/** Rôle : sur le compte s'il existe (et encore Lecteur), sinon en attente de la première connexion */
async function grantRole(staff: StaffEntry, a: AuthorRow) {
    const role: Role | null = staff.present ? staff.role : null;
    const memberId = a.member ?? (staff.email ? (await Member.findOne({ email: staff.email }).select("_id").lean())?._id : null);
    if (memberId) {
        const m = await Member.findById(memberId);
        if (!m) return;
        if (!m.author && apply) {
            m.author = a._id;
            await Author.updateOne({ _id: a._id, member: null }, { $set: { member: m._id } });
        }
        if (role && m.role === "lecteur") {
            log.roles.push(`${m.username} : Lecteur → ${ROLE_LABELS[role]}`);
            if (apply) {
                m.role = role;
                await RoleChange.create({ member: m._id, memberName: m.username, from: "lecteur", to: role, byName: BY });
            }
        }
        if (apply && m.isModified()) await m.save();
        return;
    }
    // Pas encore de compte : rôle donné à la première connexion (wpRole) ; les anciens n'en reçoivent pas
    if ((a.wpRole ?? null) !== role) {
        if (apply) await Author.updateOne({ _id: a._id }, role ? { $set: { wpRole: role } } : { $unset: { wpRole: 1 } });
        log.pending.push(`${a.name} : ${role ? ROLE_LABELS[role] : "aucun rôle"} à la première connexion${a.wpRole ? ` (avant : ${a.wpRole})` : ""}`);
    }
}

async function main() {
    const staff = parseStaff((await readSheet(file!, "Présence de staff")) as SheetRows);
    const articles = parseArticles((await readSheet(file!, "Liste des articles")) as SheetRows);
    const staffByDiscord = new Map(staff.map((s) => [s.discord, s]));
    console.log(`${apply ? "IMPORT" : "À BLANC (rien n'est écrit, --apply pour importer)"} : ${staff.length} personnes, ${articles.length} articles avec un correcteur\n`);

    await mongoose.connect(uri);
    const posts = await Post.find({ status: { $ne: "trash" } }).select("title slug status authors corrector").lean();
    const byTitle = new Map<string, (typeof posts)[number]>();
    for (const p of posts) {
        byTitle.set(titleKey(p.title), p);
        byTitle.set(`slug:${p.slug}`, p);
    }

    // 1. Correcteurs des anciens articles
    for (const art of articles) {
        let post = byTitle.get(titleKey(art.title)) ?? byTitle.get(`slug:${slugify(art.title)}`);
        if (!post) {
            // Titre retouché à la publication : l'article publié le plus ressemblant, s'il se détache nettement
            const [best, second] = posts
                .filter((p) => p.status === "published")
                .map((p) => ({ p, s: titleSimilarity(art.title, p.title) }))
                .sort((a, b) => b.s - a.s);
            if (best && best.s >= SIMILAR && (!second || second.s < best.s)) {
                post = best.p;
                log.similar.push(`« ${art.title} » → « ${best.p.title} »`);
            }
        }
        if (!post) {
            log.notFound.push(`${art.title} (${art.corrector})`);
            continue;
        }
        if (post.corrector?.member) {
            log.skippedWorkflow++;
            continue;
        }
        const s = staffByDiscord.get(art.corrector);
        const a = await profileOf(art.corrector, s);
        if (post.authors.some((id) => String(id) === String(a._id))) {
            log.skippedSelf++;
            continue;
        }
        if (String(post.corrector?.author ?? "") === String(a._id) && post.corrector?.name === a.name) {
            log.unchanged++;
            continue;
        }
        // Sans toucher la date « Modifié » : les listes du tableau de bord sont triées dessus
        if (apply) await Post.updateOne({ _id: post._id }, { $set: { corrector: { author: a._id, name: a.name } } }, { timestamps: false });
        log.credited++;
    }

    // 2. Rôles de toute l'équipe présente (et des correcteurs crédités, pour les anciens)
    for (const s of staff) {
        if (!s.email) continue;
        if (!(s.present && s.role) && !profiles.has(s.discord)) continue;
        await grantRole(s, await profileOf(s.discord, s));
    }

    await mongoose.disconnect();

    console.log(`Articles crédités : ${log.credited} · déjà à jour : ${log.unchanged} · déjà corrigés sur le blog : ${log.skippedWorkflow} · correcteur = auteur : ${log.skippedSelf}`);
    const section = (title: string, items: string[]) => items.length && console.log(`\n${title} (${items.length})\n${items.map((i) => `  - ${i}`).join("\n")}`);
    section("Retrouvés par ressemblance (à vérifier)", log.similar);
    section("Profils créés", log.created);
    section("Rôles donnés tout de suite (comptes existants)", log.roles);
    section("Rôles à la première connexion", log.pending);
    section("Articles du tableau introuvables sur le blog (titre différent ?)", log.notFound);
    if (!apply) console.log("\nÀ blanc : relancer avec --apply pour écrire.");
}

main().catch(async (e) => {
    console.error(e);
    await mongoose.disconnect();
    process.exit(1);
});
