/** Adresse lisible : « Mon Été à Paris ! » → « mon-ete-a-paris » */
export function slugify(text: string): string {
    return (
        text
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/œ/gi, "oe")
            .replace(/æ/gi, "ae")
            .toLowerCase()
            .replace(/['’]/g, "-")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 90)
            .replace(/-+$/g, "") || "article"
    );
}

/** Adresse reçue dans l'URL, décodée ; mal encodée (« %E9 », « %zz »), gardée telle quelle (→ 404, pas 500) */
export function decodeSlug(raw: string): string {
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

/**
 * Adresse tirée du titre : « iphone-15 » pour « iPhone 15 », ou suffixée
 * (« iphone-15-2 ») quand elle était déjà prise. Une adresse choisie à la
 * main ne suit plus le titre.
 */
export function slugFollowsTitle(slug: string, title: string): boolean {
    const base = slugify(title);
    // « -article » : adresse réservée par le blog (category, tag…)
    const bases = [base, `${base}-article`];
    if (bases.includes(slug)) return true;
    const suffixed = /^(.+)-\d+$/.exec(slug);
    return !!suffixed && bases.includes(suffixed[1]);
}
