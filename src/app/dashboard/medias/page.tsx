import { getBlogSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import MediaLibrary from "./MediaLibrary";

/** Médiathèque : images, crédits, vérification des droits */
export default async function MediasPage() {
    const session = (await getBlogSession())!;
    return (
        <main className="min-w-0 flex-1 px-10 py-12">
            <div className="mx-auto max-w-6xl">
                <p className="eyebrow">Rédaction</p>
                <h1 className="mt-1 font-display text-5xl">Médiathèque</h1>
                <p className="mt-2 max-w-2xl text-ink/60">Chaque image a son auteur, sa provenance et sa licence. Le crédit s&apos;affiche sur l&apos;image dans les articles.</p>
                <MediaLibrary canVerify={can(session.user.role, "post.correct")} />
            </div>
        </main>
    );
}
