/**
 * Ponda Podcast : l'émission du blog. C'est une rubrique comme les autres pour
 * la rédaction (slug « ponda-podcast »), mais elle a sa propre page,
 * /ponda-podcast/, et son habillage noir et blanc (le panda), repris sur
 * chaque épisode.
 */
export const PONDA = {
    slug: "ponda-podcast",
    name: "Ponda Podcast",
    path: "/ponda-podcast/",
    logo: "/ponda-podcast.svg",
    tagline: "L'émission du blog Workyt",
    description: "Ponda Podcast, l'émission du blog Workyt : des épisodes à écouter, courts ou longs, et des articles avec des extraits audio pour aller plus loin.",
} as const;

/** Adresse d'une rubrique : /category/<slug>/, sauf Ponda Podcast qui a sa page */
export function categoryHref(slug: string): string {
    return slug === PONDA.slug ? PONDA.path : `/category/${slug}/`;
}

/** L'article est-il un épisode de Ponda Podcast ? */
export function isPondaPost(post: { categories: { slug: string }[] }): boolean {
    return post.categories.some((c) => c.slug === PONDA.slug);
}
