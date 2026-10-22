import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Dictionnaire Workyt : mots acceptés par le correcteur pour toute la rédaction */
const DictionaryWordSchema = new Schema(
    {
        /** Forme comparée (minuscules, apostrophe droite) : voir dictKey */
        key: { type: String, required: true, unique: true },
        /** Forme écrite par la personne qui l'a ajouté */
        word: { type: String, required: true },
        addedBy: { type: String, default: "" },
        member: { type: Schema.Types.ObjectId, ref: "Member" },
    },
    { timestamps: true }
);

export type DictionaryWordDoc = InferSchemaType<typeof DictionaryWordSchema> & { _id: mongoose.Types.ObjectId };

const DictionaryWord: Model<DictionaryWordDoc> = (mongoose.models.DictionaryWord as Model<DictionaryWordDoc>) || mongoose.model<DictionaryWordDoc>("DictionaryWord", DictionaryWordSchema);
export default DictionaryWord;
