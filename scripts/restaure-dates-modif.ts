/**
 * Remet la date « Modifié » (updatedAt) des articles touchés par l'import des
 * correcteurs du 21/10/2026 : l'écriture du correcteur l'avait mise à l'heure
 * de l'import, et les listes du tableau de bord, triées dessus, s'étaient mélangées.
 *
 *   npx tsx --env-file=.env.local scripts/restaure-dates-modif.ts            (à blanc)
 *   npx tsx --env-file=.env.local scripts/restaure-dates-modif.ts --apply    (écrit)
 *
 * Nouvelle date : la dernière trace d'une vraie modification avant l'import
 * (version enregistrée, étape du circuit, import WordPress, date de mise à jour
 * éditoriale). Seuls les articles dont la date tombe dans la fenêtre de l'import
 * sont touchés : un article modifié depuis garde sa date. Rejouable.
 * Base distante refusée, sauf `--distant` avec IMPORT_CONFIRM=OUI.
 */
import mongoose from "mongoose";
import Post from "../src/models/Post";
import Revision from "../src/models/Revision";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
/** Import des correcteurs et fusion Naho (heure UTC) */
const FROM = new Date("2026-10-21T14:30:00Z");
const TO = new Date("2026-10-21T14:45:00Z");

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

const before = (d: Date | null | undefined) => (d && d < FROM ? d : null);

async function main() {
    await mongoose.connect(uri);
    const posts = await Post.find({ updatedAt: { $gte: FROM, $lte: TO } }).select("title createdAt wpImportedAt modifiedAt publishedAt workflow.at").lean();
    const lastRevision = new Map(
        (await Revision.aggregate<{ _id: unknown; at: Date }>([{ $match: { post: { $in: posts.map((p) => p._id) }, createdAt: { $lt: FROM } } }, { $group: { _id: "$post", at: { $max: "$createdAt" } } }])).map((r) => [String(r._id), r.at])
    );
    console.log(`${apply ? "RESTAURATION" : "À BLANC (--apply pour écrire)"} : ${posts.length} articles modifiés entre ${FROM.toISOString()} et ${TO.toISOString()}\n`);

    let fixed = 0;
    for (const p of posts) {
        const candidates = [lastRevision.get(String(p._id)), p.wpImportedAt, p.modifiedAt, p.publishedAt, ...(p.workflow ?? []).map((w) => w.at), p.createdAt].map((d) => before(d ?? null)).filter((d): d is Date => !!d);
        if (!candidates.length) continue;
        const at = new Date(Math.max(...candidates.map((d) => d.getTime())));
        if (fixed < 15) console.log(`  ${at.toISOString().slice(0, 16).replace("T", " ")}  ${p.title}`);
        if (apply) await Post.collection.updateOne({ _id: p._id }, { $set: { updatedAt: at } });
        fixed++;
    }
    if (fixed > 15) console.log(`  … et ${fixed - 15} autres`);
    console.log(`\nDates remises : ${fixed} / ${posts.length}`);
    await mongoose.disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await mongoose.disconnect();
    process.exit(1);
});
