import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const POST_STATUSES = [
    "draft",
    "pending_correction",
    "in_correction",
    "to_revise",
    "pending_approval",
    "scheduled",
    "published",
    "unpublished",
    "trash",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/**
 * Une image et ses droits. Source et licence sont obligatoires avant la
 * soumission d'un article (cahier des charges § 8.4) ; une image reprise de
 * WordPress sans source est marquée `rightsToCheck`.
 */
export const ImageSchema = new Schema(
    {
        url: { type: String, required: true },
        width: { type: Number },
        height: { type: Number },
        alt: { type: String, default: "" },
        credit: {
            author: { type: String, default: "" },
            /** Pixabay, Unsplash, Pexels, Wikimedia, kit presse, photo maison… */
            source: { type: String, default: "" },
            license: { type: String, default: "" },
            sourceUrl: { type: String, default: "" },
        },
        rightsVerified: { type: Boolean, default: false },
        rightsToCheck: { type: Boolean, default: false },
    },
    { _id: false }
);

const PostSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        /** Adresse /<slug>/ : identique à WordPress (structure « Titre de la publication ») */
        slug: { type: String, required: true, unique: true, trim: true },
        status: { type: String, enum: POST_STATUSES, default: "draft", index: true },
        excerpt: { type: String, default: "" },
        /** Document de l'éditeur par blocs (lot 2) */
        contentJson: { type: Schema.Types.Mixed },
        /** HTML public, généré à la publication (ou repris de WordPress), assaini au rendu */
        contentHtml: { type: String, default: "" },

        authors: [{ type: Schema.Types.ObjectId, ref: "Author" }],
        /** Contributeurs : rédacteurs invités (coup de cœur externe validé), crédités sous l'article */
        contributors: [{ type: Schema.Types.ObjectId, ref: "Author" }],
        /** Modules (lot 4) : recette, avis, coups de cœur, sources — voir lib/modules */
        modules: { type: [Schema.Types.Mixed], default: [] },
        categories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
        /** Catégorie principale (Rank Math) : fil d'Ariane et schéma */
        primaryCategory: { type: Schema.Types.ObjectId, ref: "Category" },
        tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],

        featuredImage: { type: ImageSchema },

        seo: {
            title: { type: String },
            description: { type: String },
            focusKeywords: [{ type: String }],
            noindex: { type: Boolean, default: false },
            nofollow: { type: Boolean, default: false },
            canonical: { type: String },
            score: { type: Number },
        },
        /** Contenu pilier : l'assistant SEO propose des liens vers lui (lot 5) */
        isPillar: { type: Boolean, default: false },

        publishedAt: { type: Date, index: true },
        /** Date de dernière mise à jour éditoriale affichée (≠ updatedAt technique) */
        modifiedAt: { type: Date },
        scheduledAt: { type: Date },
        readingMinutes: { type: Number, default: 1 },
        views: { type: Number, default: 0 },
        commentCount: { type: Number, default: 0 },
        /** Totaux des réactions (« Quelle est ta réaction ? ») : clé de réaction → nombre */
        reactions: { type: Map, of: Number, default: {} },

        /* ─── Circuit de relecture (lot 3) ─── */
        /** Le correcteur qui a pris l'article */
        corrector: {
            member: { type: Schema.Types.ObjectId, ref: "Member" },
            name: { type: String },
        },
        /** Suggestions en attente (copie du nombre trouvé dans contentJson, pour les listes) */
        pendingSuggestions: { type: Number, default: 0 },
        /** Journal : soumis, pris, renvoyé (motif), approuvé… */
        workflow: [
            {
                _id: false,
                action: { type: String, required: true },
                from: { type: String },
                to: { type: String },
                member: { type: Schema.Types.ObjectId, ref: "Member" },
                name: { type: String },
                reason: { type: String },
                at: { type: Date, default: Date.now },
            },
        ],
        /** Verrou d'édition : une seule personne modifie le texte à la fois (§ 7.4) */
        lock: {
            member: { type: Schema.Types.ObjectId, ref: "Member" },
            name: { type: String },
            /** Dernière activité de la personne qui a la main */
            at: { type: Date },
            requestedBy: {
                member: { type: Schema.Types.ObjectId, ref: "Member" },
                name: { type: String },
                at: { type: Date },
            },
        },
        trashedAt: { type: Date },

        wpId: { type: Number, index: true },
        /** Dernier import WordPress, et empreinte du titre + contenu importés : un article dont le texte a changé depuis n'est plus écrasé */
        wpImportedAt: { type: Date },
        wpImportHash: { type: String },
    },
    { timestamps: true }
);

PostSchema.index({ status: 1, publishedAt: -1 });
PostSchema.index({ categories: 1, status: 1, publishedAt: -1 });
PostSchema.index({ tags: 1, status: 1, publishedAt: -1 });
PostSchema.index({ authors: 1, status: 1, publishedAt: -1 });
PostSchema.index({ status: 1, scheduledAt: 1 });
PostSchema.index({ "modules.data.guest.memberId": 1 });
PostSchema.index({ contributors: 1, status: 1, publishedAt: -1 });
PostSchema.index({ title: "text", excerpt: "text" }, { default_language: "french" });

export type PostDoc = InferSchemaType<typeof PostSchema> & { _id: mongoose.Types.ObjectId };

const Post: Model<PostDoc> = (mongoose.models.Post as Model<PostDoc>) || mongoose.model<PostDoc>("Post", PostSchema);
export default Post;
