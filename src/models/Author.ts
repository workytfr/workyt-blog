import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Profil d'auteur public (page /author/<slug>/). Repris de PublishPress
 * Authors à la migration : un auteur peut ne pas avoir de compte Workyt
 * (« auteur invité »), d'où un modèle séparé de Member.
 */
const AuthorSchema = new Schema(
    {
        slug: { type: String, required: true, unique: true, trim: true },
        name: { type: String, required: true, trim: true },
        bio: { type: String, default: "" },
        /** Fonction affichée sous le nom (« Rédactrice en chef ») */
        title: { type: String, default: "" },
        avatarUrl: { type: String },
        member: { type: Schema.Types.ObjectId, ref: "Member" },
        /** Compte workyt.fr du membre : son avatar et le lien vers son profil */
        workytId: { type: String },
        seo: {
            title: { type: String },
            description: { type: String },
        },
        wpId: { type: Number, index: true },
    },
    { timestamps: true }
);

export type AuthorDoc = InferSchemaType<typeof AuthorSchema> & { _id: mongoose.Types.ObjectId };

const Author: Model<AuthorDoc> = (mongoose.models.Author as Model<AuthorDoc>) || mongoose.model<AuthorDoc>("Author", AuthorSchema);
export default Author;
