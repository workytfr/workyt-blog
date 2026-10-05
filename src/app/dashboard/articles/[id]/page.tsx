import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { getBlogSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { actorContext } from "@/lib/posts";
import { editorState } from "@/lib/review";
import { canReview } from "@/lib/workflow";
import Post from "@/models/Post";
import Category from "@/models/Category";
import Tag from "@/models/Tag";
import Member from "@/models/Member";
import "@/models/Author";
import BlogEditor from "@/editor/ui/BlogEditor";
import type { EditorPost } from "@/editor/types";

/** Page de l'éditeur d'un article */
export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) notFound();
    const session = (await getBlogSession())!;
    await connectDB();
    const post = await Post.findById(id).populate("authors", "name").lean();
    if (!post) notFound();

    const actor = { memberId: session.user.memberId, role: session.user.role, name: session.user.name || "" };
    const ctx = await actorContext(actor, post);
    // Auteurs, correcteurs et rédaction en chef ouvrent l'article (en lecture si besoin)
    if (!canReview(ctx)) {
        return (
            <main className="grid flex-1 place-items-center p-8 text-center">
                <div>
                    <h1 className="font-display text-3xl">Cet article n&apos;est pas à toi</h1>
                    <p className="mt-2 text-ink/60">Seuls ses auteurs, les correcteurs et la rédaction en chef peuvent l&apos;ouvrir.</p>
                </div>
            </main>
        );
    }

    const fullPost = await Post.findById(id);
    const review = await editorState(actor, fullPost!);
    // La rédaction, pour inviter quelqu'un à écrire un coup de cœur (pas soi-même)
    const team = (await Member.find({ role: { $ne: "lecteur" }, _id: { $ne: actor.memberId } }).select("username").sort({ username: 1 }).lean()).map((m) => ({ id: String(m._id), name: m.username }));
    const [cats, tags] = await Promise.all([Category.find({}).sort({ order: 1, name: 1 }).lean(), Tag.find({ _id: { $in: post.tags } }).lean()]);
    /* eslint-disable @typescript-eslint/no-explicit-any -- document « lean » */
    const p = post as any;
    const data: EditorPost = {
        id: String(p._id),
        title: p.title,
        slug: p.slug,
        status: p.status,
        excerpt: p.excerpt || "",
        contentJson: p.contentJson ?? null,
        categories: (p.categories || []).map(String),
        primaryCategory: p.primaryCategory ? String(p.primaryCategory) : null,
        tags: tags.map((t) => t.name),
        featuredImage: p.featuredImage?.url
            ? {
                  url: p.featuredImage.url,
                  alt: p.featuredImage.alt || "",
                  credit: {
                      author: p.featuredImage.credit?.author || "",
                      source: p.featuredImage.credit?.source || "",
                      license: p.featuredImage.credit?.license || "",
                      sourceUrl: p.featuredImage.credit?.sourceUrl || "",
                  },
              }
            : null,
        seo: { title: p.seo?.title || "", description: p.seo?.description || "", focusKeywords: p.seo?.focusKeywords || [], noindex: !!p.seo?.noindex },
        authors: (p.authors || []).filter(Boolean).map((a: any) => a.name),
        publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
        scheduledAt: p.scheduledAt ? new Date(p.scheduledAt).toISOString() : null,
        modules: p.modules ?? [],
        isPillar: !!p.isPillar,
        updatedAt: new Date(p.updatedAt).toISOString(),
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return (
        <BlogEditor
            post={data}
            categories={cats.map((c) => ({ id: String(c._id), name: c.name, color: c.color || "#ff6a1a", parentId: c.parent ? String(c.parent) : null }))}
            me={{ id: actor.memberId, name: actor.name }}
            initialReview={review}
            team={team}
        />
    );
}
