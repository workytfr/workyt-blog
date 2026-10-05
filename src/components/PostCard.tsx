import Image from "next/image";
import Link from "next/link";
import type { PostCardView } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { CategoryPill } from "./ui";

/** Carte d'article des listes (accueil, rubriques, « Tu aimeras aussi ») */
export default function PostCard({ post, priority = false }: { post: PostCardView; priority?: boolean }) {
    const href = `/${post.slug}/`;
    return (
        <article className="group relative">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[22px] bg-paper2">
                {post.featuredImage && (
                    <Image
                        src={post.featuredImage.url}
                        alt={post.featuredImage.alt}
                        fill
                        priority={priority}
                        sizes="(min-width: 1536px) 360px, (min-width: 1024px) 300px, (min-width: 640px) 45vw, 100vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                    />
                )}
                {post.primaryCategory && (
                    <span className="absolute left-3 top-3">
                        <CategoryPill category={post.primaryCategory} variant="soft" />
                    </span>
                )}
            </div>
            <h3 className="mt-3 font-semibold leading-snug">
                <Link href={href} className="after:absolute after:inset-0 group-hover:text-accentdark">
                    {post.title}
                </Link>
            </h3>
            <p className="mt-1 text-xs text-ink/50">
                {formatDate(post.publishedAt)} · {post.readingMinutes} min de lecture
            </p>
        </article>
    );
}
