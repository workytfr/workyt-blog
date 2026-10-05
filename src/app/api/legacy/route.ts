import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import Category from "@/models/Category";
import Tag from "@/models/Tag";
import Author from "@/models/Author";
import { lookupRedirect } from "@/lib/redirects";

/**
 * Anciennes adresses WordPress par identifiant (reçues via le proxy) :
 * « /?p=123 », « /?page_id=12 », « /?attachment_id=45 », « /?cat=3 »,
 * « /?tag=bac », « /?author=7 » → redirection 301 vers l'adresse actuelle,
 * grâce aux identifiants WordPress gardés à la migration (`wpId`).
 */
export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams;
    const toHome = () => NextResponse.redirect(new URL("/", req.url), 301);
    const go = (path: string) => NextResponse.redirect(new URL(path, req.url), 301);
    const wpId = (key: string) => {
        const n = Number(q.get(key));
        return Number.isInteger(n) && n > 0 ? n : null;
    };

    await connectDB();

    const p = wpId("p") ?? wpId("page_id");
    if (p) {
        const post = await Post.findOne({ wpId: p, status: "published" }).select("slug").lean();
        if (post) return go(`/${post.slug}/`);
        // Page WordPress non reprise : sa redirection vers workyt.fr est dans la table
        const rule = await lookupRedirect(`/?page_id=${p}`);
        if (rule && rule.status !== 410) return NextResponse.redirect(/^https?:/.test(rule.to) ? rule.to : new URL(rule.to, req.url), 301);
        return toHome();
    }
    const att = wpId("attachment_id");
    if (att) {
        // Page de pièce jointe : on renvoie vers l'article qui contenait l'image (table de migration), sinon l'accueil
        const rule = await lookupRedirect(`/?attachment_id=${att}`);
        return rule && rule.status !== 410 ? NextResponse.redirect(new URL(rule.to, req.url), 301) : toHome();
    }
    const cat = wpId("cat");
    if (cat) {
        const c = await Category.findOne({ wpId: cat }).select("slug").lean();
        return c ? go(`/category/${c.slug}/`) : toHome();
    }
    const tag = q.get("tag");
    if (tag) {
        const t = await Tag.findOne({ slug: tag.toLowerCase() }).select("slug").lean();
        return t ? go(`/tag/${t.slug}/`) : toHome();
    }
    const author = wpId("author");
    if (author) {
        const a = await Author.findOne({ wpId: author }).select("slug").lean();
        return a ? go(`/author/${a.slug}/`) : toHome();
    }
    return toHome();
}
