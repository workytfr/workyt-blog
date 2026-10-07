import { getPostBySlug } from "@/lib/content";
import { renderOgCard, ogResponse } from "@/lib/og";

/** Carte de partage d'un article : sa photo, sa rubrique, son titre */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const post = await getPostBySlug(decodeURIComponent(slug));
    if (!post) return ogResponse(await renderOgCard({ title: "Le blog de Workyt", kicker: "Actualités · Conseils · Culture" }));
    return ogResponse(await renderOgCard({ title: post.title, kicker: post.primaryCategory?.name, image: post.featuredImage?.url ?? null }));
}
