import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Notification de la rédaction (§ 7.2) : article soumis, pris, renvoyé,
 * approuvé, publié, nouveau commentaire de relecture. Effacée après 120 jours.
 * (Le relais vers les notifications de workyt.fr viendra avec le lot 0.)
 */
const NotificationSchema = new Schema(
    {
        to: { type: Schema.Types.ObjectId, ref: "Member", required: true },
        type: { type: String, required: true },
        post: { type: Schema.Types.ObjectId, ref: "Post" },
        postTitle: { type: String, default: "" },
        text: { type: String, required: true },
        by: { type: String, default: "" },
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 120 },
    },
    { versionKey: false }
);

NotificationSchema.index({ to: 1, read: 1, createdAt: -1 });

export type NotificationDoc = InferSchemaType<typeof NotificationSchema> & { _id: mongoose.Types.ObjectId };

const Notification: Model<NotificationDoc> = (mongoose.models.Notification as Model<NotificationDoc>) || mongoose.model<NotificationDoc>("Notification", NotificationSchema);
export default Notification;
