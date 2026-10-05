import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Étiquette : /tag/<slug>/ (hors sitemap, comme aujourd'hui avec Rank Math) */
const TagSchema = new Schema(
    {
        slug: { type: String, required: true, unique: true, trim: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        wpId: { type: Number, index: true },
    },
    { timestamps: true }
);

export type TagDoc = InferSchemaType<typeof TagSchema> & { _id: mongoose.Types.ObjectId };

const Tag: Model<TagDoc> = (mongoose.models.Tag as Model<TagDoc>) || mongoose.model<TagDoc>("Tag", TagSchema);
export default Tag;
