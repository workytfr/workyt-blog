import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Lectures par jour (statistiques du dashboard) : un simple compteur par
 * jour et par article, sans cookie ni donnée personnelle. Gardé 400 jours.
 */
const ViewDaySchema = new Schema(
    {
        /** Jour de Paris, « 2026-10-03 » */
        day: { type: String, required: true },
        post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
        views: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 400 },
    },
    { versionKey: false }
);
ViewDaySchema.index({ day: 1, post: 1 }, { unique: true });

export type ViewDayDoc = InferSchemaType<typeof ViewDaySchema> & { _id: mongoose.Types.ObjectId };

const ViewDay: Model<ViewDayDoc> = (mongoose.models.ViewDay as Model<ViewDayDoc>) || mongoose.model<ViewDayDoc>("ViewDay", ViewDaySchema);
export default ViewDay;
