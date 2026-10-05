import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Discussion de relecture sur un article (§ 7.2) : ancrée sur un passage
 * (marque « comment » dans le texte) ou générale. Jamais visible du public.
 */
const ReviewThreadSchema = new Schema(
    {
        post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
        /** Passage commenté, recopié à la création (il peut changer ensuite) */
        quote: { type: String, default: "" },
        anchored: { type: Boolean, default: false },
        resolved: { type: Boolean, default: false },
        resolvedBy: { type: String },
        messages: [
            {
                member: { type: Schema.Types.ObjectId, ref: "Member" },
                name: { type: String, required: true },
                text: { type: String, required: true, maxlength: 2000 },
                at: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

ReviewThreadSchema.index({ post: 1, createdAt: 1 });

export type ReviewThreadDoc = InferSchemaType<typeof ReviewThreadSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };

const ReviewThread: Model<ReviewThreadDoc> = (mongoose.models.ReviewThread as Model<ReviewThreadDoc>) || mongoose.model<ReviewThreadDoc>("ReviewThread", ReviewThreadSchema);
export default ReviewThread;
