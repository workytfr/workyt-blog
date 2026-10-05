import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Réaction à un article (« Quelle est ta réaction ? »). Une par lecteur et
 * par article, modifiable. « voter » : « m:<membre> » pour un compte connecté,
 * « a:<identifiant> » pour un visiteur (cookie anonyme, sans donnée perso).
 * Les totaux sont recopiés dans Post.reactions pour l'affichage.
 */
const ReactionSchema = new Schema(
    {
        post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
        voter: { type: String, required: true },
        type: { type: String, required: true },
    },
    { timestamps: true, versionKey: false }
);

ReactionSchema.index({ post: 1, voter: 1 }, { unique: true });

export type ReactionDoc = InferSchemaType<typeof ReactionSchema> & { _id: mongoose.Types.ObjectId };

const Reaction: Model<ReactionDoc> = (mongoose.models.Reaction as Model<ReactionDoc>) || mongoose.model<ReactionDoc>("Reaction", ReactionSchema);
export default Reaction;
