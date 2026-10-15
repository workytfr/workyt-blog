/**
 * Rubriques imbriquées de WordPress : « /category/actualites/education/ »,
 * « /category/culture/high-tech/page/2/ » → « /category/education/ »,
 * « /category/high-tech/page/2/ » (le blog ne garde que la dernière rubrique).
 */
export function flatCategoryPath(pathname: string): string | null {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] !== "category") return null;
    let slugs = parts.slice(1);
    let suffix = "";
    const last = slugs[slugs.length - 1];
    if (slugs.length >= 2 && slugs[slugs.length - 2] === "page" && /^\d+$/.test(last)) {
        suffix = `page/${last}/`;
        slugs = slugs.slice(0, -2);
    } else if (last === "feed") {
        suffix = "feed/";
        slugs = slugs.slice(0, -1);
    }
    if (slugs.length < 2) return null;
    return `/category/${slugs[slugs.length - 1]}/${suffix}`;
}
