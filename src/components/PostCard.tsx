import Image from "next/image";
import Link from "next/link";
import type { PostCardView } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { CategoryPill } from "./ui";

/**
 * Carte d'article des listes (accueil, rubriques, « Tu aimeras aussi »).
 * `priority` : image chargée en priorité (premières cartes visibles) ;
 * `headingLevel` : niveau du titre selon la page (h2 sous un h1, h3 sous un h2).
 */
export default function PostCard({ post, priority = false, headingLevel = 3 }: { post: PostCardView; priority?: boolean; headingLevel?: 2 | 3 }) {
    const href = `/${post.slug}/`;
    const Heading = headingLevel === 2 ? "h2" : "h3";
    return (
        <article className="group relative">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[22px] bg-paper2">
                {post.featuredImage && (
                    <Image
                        src={post.featuredImage.url}
                        // Image décorative : le lien du titre nomme déjà la carte
                        alt=""
                        fill
                        // Plusieurs cartes peuvent être le LCP : fetchPriority plutôt que preload (doc Next 16)
                        fetchPriority={priority ? "high" : undefined}
                        loading={priority ? "eager" : undefined}
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
            <Heading className="mt-3 font-semibold leading-snug">
                <Link href={href} className="after:absolute after:inset-0 group-hover:text-accentdark">
                    {post.title}
                </Link>
            </Heading>
            <p className="mt-1 text-xs text-ink/65">
                {formatDate(post.publishedAt)} · {post.readingMinutes} min de lecture
            </p>
        </article>
    );
}
