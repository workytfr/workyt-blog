import { getPostBySlug } from "@/lib/content";
import { cachedOgCard, defaultOgCard, ogResponse } from "@/lib/og";
import { decodeSlug } from "@/lib/slug";

/** Carte de partage d'un article : sa photo, sa rubrique, son titre (gardée 1 h en mémoire) */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const slug = decodeSlug((await params).slug);
    // Adresse inconnue : la carte du blog, et rien de gardé sous ce nom
    const jpg =
        slug.length <= 200
            ? await cachedOgCard(`post:${slug}`, async () => {
                  const post = await getPostBySlug(slug);
                  return post ? { title: post.title, kicker: post.primaryCategory?.name, image: post.featuredImage?.url ?? null } : null;
              })
            : null;
    return ogResponse(jpg ?? (await defaultOgCard()));
}
