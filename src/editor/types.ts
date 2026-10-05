import type { JSONContent } from "@tiptap/core";

/** Données d'un article envoyées à l'éditeur */
export interface EditorPost {
    id: string;
    title: string;
    slug: string;
    status: string;
    excerpt: string;
    contentJson: JSONContent | null;
    categories: string[];
    primaryCategory: string | null;
    tags: string[];
    featuredImage: { url: string; alt: string; credit: { author: string; source: string; license: string; sourceUrl: string } } | null;
    seo: { title: string; description: string; focusKeywords: string[]; noindex: boolean };
    authors: string[];
    publishedAt: string | null;
    scheduledAt: string | null;
    updatedAt: string;
    modules: import("@/lib/modules/types").ArticleModule[];
    isPillar: boolean;
}

/** Journal du circuit (« Camille a renvoyé l'article au rédacteur » + motif) */
export interface WorkflowEntry {
    action: string;
    text: string;
    reason: string | null;
    to: string | null;
    at: string;
}

/** Ce que la personne connectée peut faire sur l'article */
export interface ReviewState {
    actions: import("@/lib/workflow").WorkflowAction[];
    mode: import("@/lib/workflow").EditMode;
    corrector: string | null;
    workflow: WorkflowEntry[];
}

export interface EditorCategory {
    id: string;
    name: string;
    color: string;
    parentId: string | null;
}

export const STATUS_LABELS: Record<string, { label: string; className: string }> = {
    draft: { label: "Brouillon", className: "bg-[#ece6da] text-ink/70" },
    pending_correction: { label: "À corriger", className: "bg-violet-100 text-violet-700" },
    in_correction: { label: "En correction", className: "bg-sky/25 text-[#1f6f96]" },
    to_revise: { label: "À réviser", className: "bg-sun/30 text-[#8a560a]" },
    pending_approval: { label: "À approuver", className: "bg-[#ffe3cf] text-accentdark" },
    scheduled: { label: "Planifié", className: "bg-[#e3f3fb] text-[#2f86b3]" },
    published: { label: "Publié", className: "bg-leaf/25 text-[#2f6e14]" },
    unpublished: { label: "Dépublié", className: "bg-[#ece6da] text-ink/70" },
    trash: { label: "Corbeille", className: "bg-red-100 text-red-700" },
};
