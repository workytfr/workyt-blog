import Link from "next/link";
import { getBlogSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { can } from "@/lib/roles";
import { presenceByPost } from "@/lib/review";
import Post from "@/models/Post";
import Member from "@/models/Member";
import Author from "@/models/Author";
import Category from "@/models/Category";
import { STATUS_LABELS } from "@/editor/types";
import NewPostButton from "../NewPostButton";
import ArticlesTable, { type ArticleRow } from "./ArticlesTable";

type View = "afaire" | "miens" | "tous" | "corbeille";
type Props = { searchParams: Promise<{ vue?: string; statut?: string; auteur?: string; rubrique?: string; seo?: string }> };

/**
 * Liste des articles (§ 13) : ce qui m'attend, les miens, toute la rédaction,
 * la corbeille ; filtres statut, auteur, rubrique, score SEO ; actions groupées.
 */
export default async function ArticlesPage({ searchParams }: Props) {
    const session = (await getBlogSession())!;
    const sp = await searchParams;
    await connectDB();
    const me = await Member.findById(session.user.memberId).select("author").lean();
    const role = session.user.role;
    const chief = role === "admin" || role === "redac_chef";
    const corrector = can(role, "post.correct");
    const myAuthor = me?.author ?? null;
    const view: View = sp.vue === "miens" || sp.vue === "corbeille" || (sp.vue === "tous" && corrector) ? (sp.vue as View) : "afaire";

    // « À faire » selon le rôle : mes brouillons et articles à réviser, la file de correction, les approbations
    const todo: Record<string, unknown>[] = [{ authors: myAuthor, status: { $in: ["draft", "to_revise"] } }];
    if (corrector) todo.push({ status: "pending_correction", authors: { $ne: myAuthor } }, { status: "in_correction", "corrector.member": session.user.memberId });
    if (chief) todo.push({ status: { $in: ["pending_approval", "scheduled"] } });

    const filter: Record<string, unknown> =
        view === "afaire"
            ? { $or: todo }
            : view === "miens"
              ? { authors: myAuthor, status: { $ne: "trash" } }
              : view === "corbeille"
                ? { status: "trash", ...(chief ? {} : { authors: myAuthor }) }
                : { status: { $ne: "trash" } };

    // Filtres
    const [authors, categories] = await Promise.all([Author.find({}).sort({ name: 1 }).select("name slug").lean(), Category.find({}).sort({ order: 1, name: 1 }).select("name slug color parent").lean()]);
    const and: Record<string, unknown>[] = [filter];
    if (sp.statut && sp.statut in STATUS_LABELS) and.push({ status: sp.statut });
    const author = authors.find((a) => a.slug === sp.auteur);
    if (author) and.push({ $or: [{ authors: author._id }, { contributors: author._id }] });
    const cat = categories.find((c) => c.slug === sp.rubrique);
    if (cat) and.push({ categories: { $in: [cat._id, ...categories.filter((c) => String(c.parent) === String(cat._id)).map((c) => c._id)] } });
    if (sp.seo === "faible") and.push({ $or: [{ "seo.score": { $lt: 60 } }, { "seo.score": { $exists: false } }] });

    const posts = await Post.find(and.length > 1 ? { $and: and } : filter)
        .select("title slug status updatedAt publishedAt scheduledAt authors categories featuredImage corrector pendingSuggestions seo.score")
        .sort({ updatedAt: -1 })
        .limit(200)
        .populate("authors", "name")
        .populate("categories", "name color")
        .lean();
    const presence = await presenceByPost(posts.map((p) => String(p._id)));

    /* eslint-disable @typescript-eslint/no-explicit-any -- champs peuplés */
    const rows: ArticleRow[] = posts.map((p) => ({
        id: String(p._id),
        title: p.title,
        status: p.status,
        thumb: p.featuredImage?.url ?? null,
        categories: (p.categories as any[]).filter(Boolean).map((c) => ({ name: c.name as string, color: (c.color as string) || "#ff6a1a" })),
        authors: (p.authors as any[]).filter(Boolean).map((a) => a.name as string),
        corrector: p.status === "in_correction" ? (p.corrector?.name ?? null) : null,
        scheduledAt: p.status === "scheduled" && p.scheduledAt ? new Date(p.scheduledAt).toISOString() : null,
        suggestions: p.pendingSuggestions ?? 0,
        seo: typeof p.seo?.score === "number" ? p.seo.score : null,
        updatedAt: new Date(p.updatedAt as Date).toISOString(),
        here: presence.get(String(p._id)) ?? [],
    }));
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const tabs: [View, string][] = [
        ["afaire", "À faire"],
        ["miens", "Les miens"],
        ...(corrector ? ([["tous", "Toute la rédaction"]] as [View, string][]) : []),
        ["corbeille", "Corbeille"],
    ];
    const select = "rounded-full border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-accent";
    const filtered = !!(sp.statut || sp.auteur || sp.rubrique || sp.seo);

    return (
        <main className="min-w-0 flex-1 px-10 py-10">
            <div className="mx-auto max-w-6xl">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="eyebrow">Rédaction</p>
                        <h1 className="mt-1 font-display text-5xl">Articles</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1 rounded-full border border-ink/10 bg-white p-1 text-sm font-semibold">
                            {tabs.map(([id, label]) => (
                                <Link key={id} href={id === "afaire" ? "/dashboard/articles/" : `/dashboard/articles/?vue=${id}`} className={`rounded-full px-3.5 py-1.5 ${view === id ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}>
                                    {label}
                                </Link>
                            ))}
                        </div>
                        <NewPostButton compact />
                    </div>
                </div>

                <form className="mt-6 flex flex-wrap items-center gap-2" action="/dashboard/articles/">
                    {view !== "afaire" && <input type="hidden" name="vue" value={view} />}
                    <select name="statut" defaultValue={sp.statut ?? ""} className={select} aria-label="Statut">
                        <option value="">Tous les statuts</option>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v.label}
                            </option>
                        ))}
                    </select>
                    <select name="auteur" defaultValue={sp.auteur ?? ""} className={select} aria-label="Auteur">
                        <option value="">Tous les auteurs</option>
                        {authors.map((a) => (
                            <option key={a.slug} value={a.slug}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                    <select name="rubrique" defaultValue={sp.rubrique ?? ""} className={select} aria-label="Rubrique">
                        <option value="">Toutes les rubriques</option>
                        {categories.map((c) => (
                            <option key={c.slug} value={c.slug}>
                                {c.parent ? "— " : ""}
                                {c.name}
                            </option>
                        ))}
                    </select>
                    <label className={`${select} inline-flex cursor-pointer items-center gap-2`}>
                        <input type="checkbox" name="seo" value="faible" defaultChecked={sp.seo === "faible"} className="accent-[#ff6a1a]" /> Score SEO &lt; 60
                    </label>
                    <button className="btn-ink px-4 py-2 text-sm">Filtrer</button>
                    {filtered && (
                        <Link href={view === "afaire" ? "/dashboard/articles/" : `/dashboard/articles/?vue=${view}`} className="text-sm font-semibold text-ink/50 underline">
                            Effacer les filtres
                        </Link>
                    )}
                </form>

                <ArticlesTable rows={rows} view={view} canPurge={role === "admin"} canCarousel={can(role, "social.export")} empty={view === "afaire" && !filtered ? "Rien qui t'attend pour l'instant. 🎉" : view === "corbeille" ? "La corbeille est vide." : "Aucun article ne correspond."} />
            </div>
        </main>
    );
}

