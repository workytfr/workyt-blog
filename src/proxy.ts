import { NextResponse, type NextRequest } from "next/server";
import { lookupRedirect, recordHit } from "@/lib/redirects";

/**
 * Avant chaque page :
 *  1. adresses WordPress par identifiant (« /?p=123 », « ?page_id= »,
 *     « ?attachment_id= », « ?cat= »…) → résolues par /api/legacy/ ;
 *  2. table des redirections (Rank Math, migration, manuelles) → 301/302,
 *     ou 410 pour un contenu supprimé définitivement.
 */
const LEGACY_PARAMS = ["p", "page_id", "attachment_id", "cat", "tag", "author"];

export async function proxy(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;

    // Recherche WordPress « /?s=mot » et « /page/2/?s=mot » : servie par /search/ (l'accueil reste en cache)
    const paged = pathname.match(/^\/page\/(\d+)\/?$/);
    if (searchParams.has("s") && (pathname === "/" || paged)) {
        const url = request.nextUrl.clone();
        url.pathname = "/search/";
        if (paged) url.searchParams.set("paged", paged[1]);
        return NextResponse.rewrite(url);
    }

    if (pathname === "/" && LEGACY_PARAMS.some((k) => searchParams.has(k))) {
        const url = request.nextUrl.clone();
        url.pathname = "/api/legacy/";
        return NextResponse.rewrite(url);
    }

    const rule = await lookupRedirect(pathname);
    if (rule) {
        recordHit(pathname);
        if (rule.status === 410) {
            return new NextResponse("Ce contenu a été supprimé définitivement.", {
                status: 410,
                headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
            });
        }
        const target = /^https?:\/\//.test(rule.to) ? rule.to : new URL(rule.to, request.url).toString();
        return NextResponse.redirect(target, rule.status);
    }

    return NextResponse.next();
}

export const config = {
    // Pas pour les fichiers de Next, les images optimisées, les API ni les fichiers statiques
    matcher: ["/((?!_next/|api/|favicon\\.ico|robots\\.txt|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|woff2?)$).*)"],
};
