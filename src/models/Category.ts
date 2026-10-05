import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Rubrique : /category/<slug>/ (la base « category » de WordPress est conservée) */
const CategorySchema = new Schema(
    {
        slug: { type: String, required: true, unique: true, trim: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        /** Couleur de la pastille (palette Workyt) */
        color: { type: String, default: "#ff6a1a" },
        parent: { type: Schema.Types.ObjectId, ref: "Category", default: null },
        /** Ordre dans le menu ; absent du menu si `inMenu` est faux */
        order: { type: Number, default: 0 },
        inMenu: { type: Boolean, default: true },
        seo: {
            title: { type: String },
            description: { type: String },
            noindex: { type: Boolean, default: false },
        },
        wpId: { type: Number, index: true },
    },
    { timestamps: true }
);

export type CategoryDoc = InferSchemaType<typeof CategorySchema> & { _id: mongoose.Types.ObjectId };

const Category: Model<CategoryDoc> =
    (mongoose.models.Category as Model<CategoryDoc>) || mongoose.model<CategoryDoc>("Category", CategorySchema);
export default Category;
