import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Journal des 404 (page Redirections, § 13) : adresses demandées qui
 * n'existent pas, pour créer les redirections qui manquent. Une ligne par
 * adresse ; effacée après 90 jours sans nouvelle visite.
 */
const NotFoundHitSchema = new Schema(
    {
        path: { type: String, required: true, unique: true },
        hits: { type: Number, default: 1 },
        referrer: { type: String, default: "" },
        lastAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
    },
    { versionKey: false }
);
NotFoundHitSchema.index({ hits: -1 });

export type NotFoundHitDoc = InferSchemaType<typeof NotFoundHitSchema> & { _id: mongoose.Types.ObjectId };

const NotFoundHit: Model<NotFoundHitDoc> = (mongoose.models.NotFoundHit as Model<NotFoundHitDoc>) || mongoose.model<NotFoundHitDoc>("NotFoundHit", NotFoundHitSchema);
export default NotFoundHit;
