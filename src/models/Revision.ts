import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Une version enregistrée d'un article (§ 7.2) : à chaque changement de statut
 * et à chaque séance d'édition. Sert à comparer et à restaurer.
 */
const RevisionSchema = new Schema(
    {
        post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
        title: { type: String, default: "" },
        excerpt: { type: String, default: "" },
        contentJson: { type: Schema.Types.Mixed },
        /** « Envoyé en correction », « Séance d'édition », « Avant restauration »… */
        label: { type: String, required: true },
        status: { type: String },
        member: { type: Schema.Types.ObjectId, ref: "Member" },
        name: { type: String, default: "" },
        words: { type: Number, default: 0 },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

RevisionSchema.index({ post: 1, createdAt: -1 });

export type RevisionDoc = InferSchemaType<typeof RevisionSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };

const Revision: Model<RevisionDoc> = (mongoose.models.Revision as Model<RevisionDoc>) || mongoose.model<RevisionDoc>("Revision", RevisionSchema);
export default Revision;
