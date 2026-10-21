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
