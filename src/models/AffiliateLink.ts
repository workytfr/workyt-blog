import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Lien affilié géré (cahier des charges § 9.1). Les articles pointent vers
 * /go/<nom>/ : on change l'adresse marchande ici, à un seul endroit, et les
 * clics sont comptés sans cookie.
 */
const AffiliateLinkSchema = new Schema(
    {
        /** Nom court de l'adresse /go/<nom>/ */
        name: { type: String, required: true, unique: true, trim: true, lowercase: true },
        label: { type: String, required: true, trim: true },
        merchant: { type: String, default: "", trim: true },
        url: { type: String, required: true, trim: true },
        /** Amazon, Awin, Fnac… */
        program: { type: String, default: "", trim: true },
        expiresAt: { type: Date },
        clicks: { type: Number, default: 0 },
        lastClickAt: { type: Date },
        /** Dernière vérification par le cron : ok, dead (introuvable), unknown (le marchand bloque les robots) */
        health: { type: String, enum: ["ok", "dead", "unknown"], default: "unknown" },
        lastCheckedAt: { type: Date },
        lastStatus: { type: Number },
        createdBy: { type: String, default: "" },
    },
    { timestamps: true }
);

export type AffiliateLinkDoc = InferSchemaType<typeof AffiliateLinkSchema> & { _id: mongoose.Types.ObjectId };

const AffiliateLink: Model<AffiliateLinkDoc> = (mongoose.models.AffiliateLink as Model<AffiliateLinkDoc>) || mongoose.model<AffiliateLinkDoc>("AffiliateLink", AffiliateLinkSchema);
export default AffiliateLink;
