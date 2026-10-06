import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Une image de la médiathèque : un seul fichier, optimisé (WebP), sur R2. Les
 * tailles d'affichage sont produites à la volée par next/image : fini les 6 à
 * 10 copies de WordPress. Le crédit est obligatoire (cahier des charges § 8.4).
 */
const MediaSchema = new Schema(
    {
        key: { type: String, required: true, unique: true },
        url: { type: String, required: true },
        mime: { type: String, required: true },
        size: { type: Number, required: true },
        width: { type: Number },
        height: { type: Number },
        originalName: { type: String, default: "" },
        alt: { type: String, default: "" },
        credit: {
            author: { type: String, required: true },
            source: { type: String, required: true },
            license: { type: String, required: true },
            sourceUrl: { type: String, default: "" },
            /** Preuve d'autorisation (kit presse, accord écrit) : visible de la rédaction seulement */
            proofUrl: { type: String, default: "" },
        },
        /** Coché par le correcteur ou la rédaction en chef */
        rightsVerified: { type: Boolean, default: false },
        /** Image reprise de WordPress sans source : à compléter */
        rightsToCheck: { type: Boolean, default: false },
        uploadedBy: { type: Schema.Types.ObjectId, ref: "Member" },
        wpId: { type: Number, index: true },
        /** Chemin de l'original WordPress (« 2024/03/photo.jpg », minuscules) : l'ancienne adresse redirige ici (SEO, Google Images) */
        wpPath: { type: String, index: true, sparse: true },
    },
    { timestamps: true }
);

MediaSchema.index({ createdAt: -1 });
MediaSchema.index({ originalName: "text", alt: "text", "credit.author": "text" });

export type MediaDoc = InferSchemaType<typeof MediaSchema> & { _id: mongoose.Types.ObjectId };

const Media: Model<MediaDoc> = (mongoose.models.Media as Model<MediaDoc>) || mongoose.model<MediaDoc>("Media", MediaSchema);
export default Media;
