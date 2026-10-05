import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Réglages du blog modifiables dans le dashboard (§ 13, Admin) : un seul document « site » */
const SettingSchema = new Schema(
    {
        key: { type: String, required: true, unique: true, default: "site" },
        description: { type: String, default: "" },
        social: {
            x: { type: String, default: "" },
            linkedin: { type: String, default: "" },
            instagram: { type: String, default: "" },
            tiktok: { type: String, default: "" },
            youtube: { type: String, default: "" },
            discord: { type: String, default: "" },
        },
        verification: {
            google: { type: String, default: "" },
            bing: { type: String, default: "" },
        },
        updatedBy: { type: String, default: "" },
    },
    { timestamps: true }
);

export type SettingDoc = InferSchemaType<typeof SettingSchema> & { _id: mongoose.Types.ObjectId };

const Setting: Model<SettingDoc> = (mongoose.models.Setting as Model<SettingDoc>) || mongoose.model<SettingDoc>("Setting", SettingSchema);
export default Setting;
