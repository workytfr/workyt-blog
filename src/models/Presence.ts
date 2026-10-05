import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Qui a l'article ouvert en ce moment (§ 7.4). Chaque éditeur ouvert envoie
 * un signal toutes les 15 s ; une présence sans signal depuis 2 min s'efface.
 * (Le cahier des charges prévoit workyt-socket : ces signaux le remplacent en
 * attendant, sans rien changer à l'affichage.)
 */
const PresenceSchema = new Schema(
    {
        post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
        member: { type: Schema.Types.ObjectId, ref: "Member", required: true },
        name: { type: String, required: true },
        avatarUrl: { type: String },
        mode: { type: String, enum: ["view", "edit"], default: "view" },
        at: { type: Date, default: Date.now, expires: 120 },
    },
    { versionKey: false }
);

PresenceSchema.index({ post: 1, member: 1 }, { unique: true });

export type PresenceDoc = InferSchemaType<typeof PresenceSchema> & { _id: mongoose.Types.ObjectId };

const Presence: Model<PresenceDoc> = (mongoose.models.Presence as Model<PresenceDoc>) || mongoose.model<PresenceDoc>("Presence", PresenceSchema);
export default Presence;
