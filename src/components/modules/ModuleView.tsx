import { Clock } from "lucide-react";
import type { PostView } from "@/lib/content";
import type { ArticleModule } from "@/lib/modules/types";
import RecipeCard from "./RecipeCard";
import { BookReview, ProductReview, TechReview } from "./Reviews";
import Favorite from "./Favorite";

/** Un module dans l'article (recette, avis, coup de cœur) */
export default function ModuleView({ module: m, post, preview }: { module: ArticleModule; post: PostView; preview?: boolean }) {
    switch (m.type) {
        case "recipe":
            return <RecipeCard data={m.data} />;
        case "techReview":
            return <TechReview data={m.data} />;
        case "bookReview":
            return <BookReview data={m.data} />;
        case "productReview":
            return <ProductReview data={m.data} />;
        case "favorite":
            return <Favorite data={m.data} signer={post.authors[0] ?? null} />;
        case "guestFavorite": {
            const guest = m.data.guest ? post.guests[m.data.guest.memberId] : undefined;
            // Tant que l'invité n'a pas validé, rien en public ; un rappel dans l'aperçu
            if (m.data.status !== "validated" || !m.data.guest) {
                return preview ? (
                    <div className="not-prose my-8 flex items-center gap-3 rounded-[24px] border border-dashed border-accent/40 bg-accent/5 p-5 text-sm">
                        <Clock className="h-5 w-5 text-accent" /> Coup de cœur de {m.data.guest?.name ?? "un rédacteur"} : en attente de son texte.
                    </div>
                ) : null;
            }
            return <Favorite data={m.data} signer={guest ?? { id: "", slug: "", name: m.data.guest.name, title: "", bio: "", avatarUrl: `/api/avatar/${encodeURIComponent(m.data.guest.memberId)}/` }} guest />;
        }
        case "sources":
            return null;
    }
}
