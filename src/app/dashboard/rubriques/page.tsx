import { notFound } from "next/navigation";
import { getBlogSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { listCategories, listTags } from "@/lib/taxonomy";
import TaxonomyManager from "./TaxonomyManager";

/** Rubriques (arbre) et étiquettes (§ 13) */
export default async function TaxonomyPage() {
    const session = (await getBlogSession())!;
    if (!can(session.user.role, "taxonomy.manage")) notFound();
    const [categories, tags] = await Promise.all([listCategories(), listTags()]);
    return (
        <main className="min-w-0 flex-1 px-10 py-10">
            <div className="mx-auto max-w-6xl">
                <p className="eyebrow">Gestion</p>
                <h1 className="mt-1 font-display text-5xl">Rubriques et étiquettes</h1>
                <p className="mt-2 max-w-2xl text-ink/60">Deux niveaux de rubriques, comme le menu du blog. Changer l&apos;adresse d&apos;une rubrique ou d&apos;une étiquette crée une redirection : les anciens liens continuent de marcher.</p>
                <TaxonomyManager categories={categories} tags={tags} />
            </div>
        </main>
    );
}
