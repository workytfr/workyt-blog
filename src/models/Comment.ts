import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Commentaire d'un lecteur (§ 11). Réponses sur un niveau (« parent » est
 * toujours un commentaire de premier niveau). Les commentaires repris de
 * WordPress sans compte Workyt correspondant n'ont pas de « member » : ils
 * s'affichent comme « invité » sous le nom d'origine.
 */
const CommentSchema = new Schema(
    {
        post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
        parent: { type: Schema.Types.ObjectId, ref: "Comment", default: null },
        member: { type: Schema.Types.ObjectId, ref: "Member", default: null },
        /** Nom affiché au moment de l'écriture */
        name: { type: String, required: true, trim: true },
        text: { type: String, default: "" },
        status: { type: String, enum: ["pending", "published", "rejected", "deleted"], default: "pending" },
        /** Pourquoi il attend la modération (premier commentaire, lien externe, signalé…) */
        reasons: { type: [String], default: [] },
        likes: { type: [{ type: Schema.Types.ObjectId, ref: "Member" }], default: [] },
        reports: { type: [{ member: { type: Schema.Types.ObjectId, ref: "Member" }, at: Date, _id: false }], default: [] },
        publishedAt: { type: Date, default: null },
        editedAt: { type: Date, default: null },
        moderatedBy: { type: String, default: "" },
        /** Identifiant WordPress (import, lot 8) */
        wpId: { type: Number, index: true, sparse: true },
    },
    { timestamps: true, versionKey: false }
);

CommentSchema.index({ post: 1, status: 1, createdAt: 1 });
CommentSchema.index({ member: 1, createdAt: -1 });
CommentSchema.index({ status: 1, updatedAt: -1 });

export type CommentDoc = InferSchemaType<typeof CommentSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date };

const Comment: Model<CommentDoc> = (mongoose.models.Comment as Model<CommentDoc>) || mongoose.model<CommentDoc>("Comment", CommentSchema);
export default Comment;
