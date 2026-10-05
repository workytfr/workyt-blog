import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adjacentPosts, getPostBySlug, relatedPosts } from "@/lib/content";
import { postMetadata } from "@/lib/seo";
import PostArticle from "@/components/PostArticle";

// Page en cache, régénérée toutes les 5 min (et à la publication)
export const revalidate = 300;
// Aucune page générée au build (pas besoin de la base) : chacune est créée à la première visite, puis mise en cache
export function generateStaticParams() {
    return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const post = await getPostBySlug(decodeURIComponent(slug));
    return post ? postMetadata(post) : { title: "Article introuvable", robots: { index: false } };
}

export default async function PostPage({ params }: Props) {
    const { slug } = await params;
    const post = await getPostBySlug(decodeURIComponent(slug));
    if (!post) notFound();
    const [{ previous, next }, related] = await Promise.all([adjacentPosts(post), relatedPosts(post, 4)]);
    return <PostArticle post={post} previous={previous} next={next} related={related} />;
}
