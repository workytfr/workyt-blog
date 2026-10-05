import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import { Eye } from "lucide-react";
import { getBlogSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getPostForPreview } from "@/lib/content";
import { STATUS_LABELS } from "@/editor/types";
import PostArticle from "@/components/PostArticle";
import Post from "@/models/Post";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aperçu", robots: { index: false, follow: false } };

/** Aperçu d'un article non publié, tel qu'il apparaîtra en ligne (rédaction uniquement) */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getBlogSession();
    if (!session?.user) redirect(`/connexion/?callbackUrl=/apercu/${id}/`);
    if (!can(session.user.role, "dashboard.access")) notFound();
    if (!mongoose.isValidObjectId(id)) notFound();
    const post = await getPostForPreview(id);
    if (!post) notFound();
    const status = (await Post.findById(id).select("status").lean())?.status || "draft";
    const st = STATUS_LABELS[status] ?? STATUS_LABELS.draft;

    return (
        <>
            <div className="relative z-50 flex items-center justify-center gap-3 bg-ink px-4 py-2 text-sm text-white">
                <Eye className="h-4 w-4 text-accent" /> Aperçu de la rédaction ·{" "}
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink">{st.label}</span>
                {status === "published" ? " · déjà en ligne" : " · non visible du public"}
            </div>
            <PostArticle post={post} previous={null} next={null} related={[]} preview />
        </>
    );
}
