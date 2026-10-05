import type { Metadata } from "next";
import { Mail } from "lucide-react";
import {
  categoriesWithCounts,
  childCategoryIds,
  listPosts,
  menuCategories,
  mostReadPosts,
} from "@/lib/content";
import { archiveMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";
import Archive from "@/components/Archive";
import Bento, { CategoriesCorner, OlderCorner } from "@/components/home/Bento";
import TopPosts from "@/components/home/TopPosts";
import CategorySection from "@/components/home/CategorySection";

/** Accueil (page 1) et pages /page/<n>/ des articles plus anciens */
export function homeMetadata(page: number): Metadata {
  return archiveMetadata({
    title: SITE.tagline,
    description: SITE.description,
    path: "/",
    page,
  });
}

/** Pages 2 et suivantes : liste simple des articles plus anciens */
export async function OlderPosts({ page }: { page: number }) {
  const list = await listPosts({ page });
  return (
    <Archive
      eyebrow="Le blog de Workyt"
      title="Tous les articles"
      list={list}
      base="/"
    />
  );
}

export default async function Home() {
  // 12 articles : 6 dans la grille du haut, 6 dans « Derniers articles » (la même grille, en miroir)
  const [latest, top, cats, menu] = await Promise.all([
    listPosts({ page: 1 }),
    mostReadPosts(5),
    categoriesWithCounts(),
    menuCategories(),
  ]);
  const bento = latest.items.slice(0, 6);
  const recent = latest.items.slice(6);
  const hasOlder = latest.total > SITE.postsPerPage;

  // Une section par rubrique (sous-rubriques comprises), dans l'ordre du menu
  const sections = await Promise.all(
    cats
      .filter((c) => c.count > 0)
      .map(async (c) => {
        const ids = [c.id, ...(await childCategoryIds(c.id))];
        const { items } = await listPosts({ perPage: 4, categoryIds: ids });
        return {
          category: c,
          posts: items,
          count: c.count,
          subcategories: menu.find((m) => m.id === c.id)?.children ?? [],
        };
      }),
  );

  return (
    <div className="mx-auto max-w-[1600px] px-6 pb-20 pt-8 lg:px-10">
      {/* Titre de la page pour les moteurs et lecteurs d'écran (pas de grand titre visible) */}
      <h1 className="sr-only">Le blog de Workyt</h1>

      {latest.items.length === 0 ? (
        <p className="mt-10 rounded-[28px] border border-dashed border-ink/15 bg-white p-12 text-center text-ink/60">
          Aucun article pour l&apos;instant.
        </p>
      ) : (
        <>
          <div>
            <Bento
              posts={bento}
              corner={<CategoriesCorner categories={cats} />}
            />
          </div>

          {recent.length > 0 && (
            <section className="mt-16">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="section-title font-display text-[36px]">
                  Derniers articles
                </h2>
              </div>
              <div className="mt-7">
                <Bento
                  posts={recent}
                  mirror
                  priority={false}
                  corner={
                    <OlderCorner
                      total={latest.total}
                      href={hasOlder ? "/page/2/" : "#rubriques"}
                    />
                  }
                />
              </div>
            </section>
          )}

          <div className="mt-16">
            <TopPosts posts={top} />
          </div>

          <section id="rubriques" className="mt-20 scroll-mt-28">
            <h2 className="section-title font-display text-[36px]">
              Les rubriques
            </h2>
            <div className="mt-7 space-y-5">
              {sections.map((s, i) => (
                <CategorySection
                  key={s.category.id}
                  category={s.category}
                  subcategories={s.subcategories}
                  posts={s.posts}
                  count={s.count}
                  flip={i % 2 === 1}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {/* Newsletter de Workyt */}
      <section className="relative mt-20 overflow-hidden rounded-[36px] bg-accent p-8 text-white sm:p-12">
        <div
          className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-sun/40 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <p className="eyebrow !text-white/70">Chaque mercredi</p>
            <h2 className="mt-2 font-display text-[34px] leading-tight sm:text-[42px]">
              Le récap du blog et de Workyt dans ta boîte mail
            </h2>
            <p className="mt-2 text-white/80">
              Nouveaux articles, cours et fiches de la semaine. Gratuit, sans
              pub.
            </p>
          </div>
          <a
            href={`${SITE.workytUrl}/compte`}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 font-semibold text-ink shadow-[0_4px_0_rgba(26,21,18,.25)] transition hover:-translate-y-px"
          >
            <Mail className="h-5 w-5 text-accent" /> Je m&apos;abonne sur Workyt
          </a>
        </div>
      </section>
    </div>
  );
}
