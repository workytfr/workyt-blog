import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Une version enregistrée d'un article (§ 7.2) : à chaque changement de statut
 * et à chaque séance d'édition. Sert à voir qui a modifié quoi, comparer et
 * restaurer. Les séances sont effacées après 30 jours, les étapes restent
 * (voir lib/revisionRules).
 */
const RevisionSchema = new Schema(
    {
        post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
        /** « session » : l'état d'avant une séance d'édition ; « step » : une étape du circuit ; « restore » : avant une restauration */
        kind: { type: String, enum: ["session", "step", "restore"] },
        title: { type: String, default: "" },
        excerpt: { type: String, default: "" },
        /** Absent quand le texte est identique à la version `sameAs` (pas de copie en double) */
        contentJson: { type: Schema.Types.Mixed },
        sameAs: { type: Schema.Types.ObjectId, ref: "Revision" },
        /** Empreinte du titre et du texte : repère les versions identiques */
        hash: { type: String },
        /** « Envoyé en correction », « Avant les modifications de Camille », « Avant restauration »… */
        label: { type: String, required: true },
        status: { type: String },
        member: { type: Schema.Types.ObjectId, ref: "Member" },
        name: { type: String, default: "" },
        words: { type: Number, default: 0 },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

RevisionSchema.index({ post: 1, createdAt: -1 });
RevisionSchema.index({ kind: 1, createdAt: 1 });

export type RevisionDoc = InferSchemaType<typeof RevisionSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };

const Revision: Model<RevisionDoc> = (mongoose.models.Revision as Model<RevisionDoc>) || mongoose.model<RevisionDoc>("Revision", RevisionSchema);
export default Revision;
