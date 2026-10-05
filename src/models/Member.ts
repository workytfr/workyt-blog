import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ROLES } from "@/lib/roles";

/**
 * Un compte Workyt qui s'est connecté au blog. Pas de mot de passe ici : la
 * connexion passe toujours par workyt.fr (« Se connecter avec Workyt »).
 */
const MemberSchema = new Schema(
    {
        /** Identifiant du compte sur workyt.fr (claim `sub`) */
        workytId: { type: String, required: true, unique: true },
        username: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true },
        avatarUrl: { type: String },
        /** Rôle sur workyt.fr, recopié à chaque connexion */
        workytRole: { type: String },
        /** Rôle sur le blog (cahier des charges § 6) */
        role: { type: String, enum: ROLES, default: "lecteur" },
        /** Profil d'auteur public, s'il écrit pour le blog */
        author: { type: Schema.Types.ObjectId, ref: "Author" },
        lastLoginAt: { type: Date },
    },
    { timestamps: true }
);

export type MemberDoc = InferSchemaType<typeof MemberSchema> & { _id: mongoose.Types.ObjectId };

const Member: Model<MemberDoc> = (mongoose.models.Member as Model<MemberDoc>) || mongoose.model<MemberDoc>("Member", MemberSchema);
export default Member;
