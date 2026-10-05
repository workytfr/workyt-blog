import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Redirections : celles de Rank Math (importées), celles créées à la migration
 * (pages WordPress → workyt.fr, anciennes adresses) et celles ajoutées à la
 * main. `to` peut être une adresse du blog (« /mon-article/ ») ou externe.
 */
const RedirectSchema = new Schema(
    {
        /** Chemin d'origine, normalisé : minuscules, « / » au début et à la fin */
        from: { type: String, required: true, unique: true },
        to: { type: String, default: "" },
        /** 301 (définitive), 302 (temporaire) ou 410 (supprimé) */
        status: { type: Number, enum: [301, 302, 410], default: 301 },
        source: { type: String, enum: ["rankmath", "migration", "manual", "slug-change"], default: "manual" },
        hits: { type: Number, default: 0 },
        lastHitAt: { type: Date },
    },
    { timestamps: true }
);

export type RedirectDoc = InferSchemaType<typeof RedirectSchema> & { _id: mongoose.Types.ObjectId };

const Redirect: Model<RedirectDoc> =
    (mongoose.models.Redirect as Model<RedirectDoc>) || mongoose.model<RedirectDoc>("Redirect", RedirectSchema);
export default Redirect;
