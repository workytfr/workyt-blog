import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Journal des changements de rôle (page Équipe, § 6) */
const RoleChangeSchema = new Schema(
    {
        member: { type: Schema.Types.ObjectId, ref: "Member", required: true },
        memberName: { type: String, required: true },
        from: { type: String, required: true },
        to: { type: String, required: true },
        by: { type: Schema.Types.ObjectId, ref: "Member" },
        byName: { type: String, default: "" },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);
RoleChangeSchema.index({ createdAt: -1 });

export type RoleChangeDoc = InferSchemaType<typeof RoleChangeSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };

const RoleChange: Model<RoleChangeDoc> = (mongoose.models.RoleChange as Model<RoleChangeDoc>) || mongoose.model<RoleChangeDoc>("RoleChange", RoleChangeSchema);
export default RoleChange;
