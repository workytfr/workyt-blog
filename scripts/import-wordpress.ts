/**
 * Import du WordPress (lot 8, cahier des charges § 14).
 *
 *   python scripts/wp-images-utilisees.py        (tri des images, une fois)
 *   npx tsx --env-file=.env.local scripts/import-wordpress.ts
 *
 * Entrées : migration/*.sql (export phpMyAdmin) et migration/images-utilisees/.
 * Reprend rubriques, étiquettes, profils d'auteur (PublishPress), articles
 * (contenu Gutenberg → document de l'éditeur), images (WebP, une seule taille),
 * SEO Rank Math, vues, réactions, commentaires approuvés et redirections.
 *
 * Rejouable : tout est rattaché à l'identifiant WordPress (wpId). Un article
 * modifié sur le nouveau blog depuis le dernier import n'est pas écrasé.
 * Rapport : migration/rapport-import.md
 *
 * Base distante (production) refusée, sauf `--distant` avec IMPORT_CONFIRM=OUI.
 * Images : dossier public/uploads-dev/ ; sur R2 avec `--r2` (variables S3_*).
 */
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { generateJSON } from "@tiptap/html/server";
import type { JSONContent } from "@tiptap/core";
import { Window } from "happy-dom";
import mongoose, { type Types } from "mongoose";
import sharp from "sharp";
import { schemaExtensions } from "../src/editor/extensions";
import { documentToHtml, documentText } from "../src/editor/html";
import { readingMinutes } from "../src/lib/render";
import { normalizePath } from "../src/lib/redirects";
import { sanitizeModules } from "../src/lib/modules/sanitize";
import type { ArticleModule, ModuleImage } from "../src/lib/modules/types";
import type { Role } from "../src/lib/roles";
import Author from "../src/models/Author";
import Category from "../src/models/Category";
import Comment from "../src/models/Comment";
import Media from "../src/models/Media";
import Post, { type PostStatus } from "../src/models/Post";
import Redirect from "../src/models/Redirect";
import Tag from "../src/models/Tag";

// Lancé depuis la racine du projet (npx tsx scripts/import-wordpress.ts)
const ROOT = process.cwd();
const MIG = path.join(ROOT, "migration");
const IMAGES = path.join(MIG, "images-utilisees");
const P = "wpbq_";
const SITE_HOSTS = /^https?:\/\/(www\.)?blog\.workyt\.fr/i;
const args = new Set(process.argv.slice(2));

/* ─── Sécurité : base locale seulement, sauf demande explicite ─── */

const uri = process.env.MONGODB_URI || "";
const host = (() => {
    try {
        return new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://")).hostname;
    } catch {
        return "";
    }
})();
if (!["127.0.0.1", "localhost"].includes(host) && !(args.has("--distant") && process.env.IMPORT_CONFIRM === "OUI")) {
    console.error(`Refusé : base « ${host || "aucune"} » distante. Pour la production : --distant avec IMPORT_CONFIRM=OUI.`);
    process.exit(1);
}
const useR2 = args.has("--r2");
if (useR2 && !(process.env.S3_ENDPOINT && process.env.S3_BUCKET_NAME && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY && process.env.S3_PUBLIC_URL)) {
    console.error("--r2 demandé mais variables S3_* incomplètes.");
    process.exit(1);
}

/* ─── Lecture de l'export SQL ─── */

type Row = string[];

/** « (1,'a'),(2,'b') » → lignes de valeurs (guillemets et échappements MySQL) */
function* tuples(s: string): Generator<Row> {
    const ESC: Record<string, string> = { n: "\n", r: "\r", t: "\t", "0": "\0" };
    let i = 0;
    const n = s.length;
    while (i < n) {
        if (s[i] !== "(") {
            i++;
            continue;
        }
        i++;
        const row: Row = [];
        while (i < n) {
            if (s[i] === "'") {
                // Chaîne : copiée par morceaux (pas caractère par caractère : mémoire)
                const parts: string[] = [];
                let start = ++i;
                for (;;) {
                    const q = s.indexOf("'", i);
                    const b = s.indexOf("\\", i);
                    if (b !== -1 && b < q) {
                        parts.push(s.slice(start, b), ESC[s[b + 1]] ?? s[b + 1]);
                        i = start = b + 2;
                        continue;
                    }
                    if (s[q + 1] === "'") {
                        parts.push(s.slice(start, q), "'");
                        i = start = q + 2;
                        continue;
                    }
                    parts.push(s.slice(start, q));
                    i = q + 1;
                    break;
                }
                row.push(parts.join(""));
                while (i < n && s[i] !== "," && s[i] !== ")") i++;
            } else {
                let j = i;
                while (j < n && s[j] !== "," && s[j] !== ")") j++;
                const v = s.slice(i, j).trim();
                row.push(v === "NULL" ? "" : v);
                i = j;
            }
            if (s[i] === ")") {
                i++;
                break;
            }
            i++; // ,
            while (s[i] === " " || s[i] === "\n" || s[i] === "\r") i++;
        }
        yield row;
    }
}

/** Lignes des tables voulues, en une lecture du fichier (353 Mo) ; `keep` écarte les lignes inutiles au fil de l'eau */
async function readTables(file: string, wanted: string[], keep: Record<string, (r: Row) => boolean> = {}): Promise<Record<string, Row[]>> {
    const out: Record<string, Row[]> = Object.fromEntries(wanted.map((t) => [t, []]));
    const rl = readline.createInterface({ input: createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
    let table: string | null = null;
    let buf: string[] = [];
    for await (const line of rl) {
        if (!table) {
            const m = /^INSERT INTO `([^`]+)`/.exec(line);
            if (m && out[m[1]]) {
                table = m[1];
                buf = [line.slice(line.indexOf("VALUES") + 6)];
            }
        } else buf.push(line);
        if (table && line.trimEnd().endsWith(";")) {
            const filter = keep[table];
            for (const r of tuples(buf.join("\n"))) if (!filter || filter(r)) out[table].push(r);
            table = null;
            buf = [];
        }
    }
    return out;
}

/* ─── PHP serialize (réglages WordPress) ─── */

function unserialize(s: string): unknown {
    let i = 0;
    const read = (): unknown => {
        const t = s[i];
        if (t === "N") {
            i += 2;
            return null;
        }
        const colon = s.indexOf(":", i + 2);
        if (t === "s") {
            const len = Number(s.slice(i + 2, colon));
            // Longueur en octets UTF-8
            const start = colon + 2;
            let end = start;
            let bytes = 0;
            // Par point de code : un emoji (2 caractères JS) compte 4 octets, pas 2 × 3
            while (bytes < len) {
                const cp = s.codePointAt(end)!;
                bytes += cp > 0xffff ? 4 : cp > 0x7ff ? 3 : cp > 0x7f ? 2 : 1;
                end += cp > 0xffff ? 2 : 1;
            }
            i = end + 2;
            return s.slice(start, end);
        }
        if (t === "i" || t === "d" || t === "b") {
            const end = s.indexOf(";", i);
            const v = s.slice(i + 2, end);
            i = end + 1;
            return t === "b" ? v === "1" : Number(v);
        }
        if (t === "a") {
            const count = Number(s.slice(i + 2, colon));
            i = colon + 2;
            const obj: Record<string, unknown> = {};
            for (let k = 0; k < count; k++) {
                const key = read();
                obj[String(key)] = read();
            }
            i++; // }
            return obj;
        }
        throw new Error(`PHP serialize : type « ${t} » non pris en charge`);
    };
    try {
        return read();
    } catch {
        return null;
    }
}

/* ─── Outils ─── */

const window = new Window();
const document = window.document;

function decodeEntities(s: string): string {
    const el = document.createElement("textarea");
    el.innerHTML = s;
    return el.value;
}
const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const decodeSlug = (s: string) => {
    try {
        return decodeURIComponent(s).replace(/￼/g, "");
    } catch {
        return s;
    }
};
const gmt = (date: string, fallback?: string) => {
    const d = date && !date.startsWith("0000") ? date : fallback;
    if (!d || d.startsWith("0000")) return undefined;
    return new Date(`${d.replace(" ", "T")}Z`);
};
/**
 * Empreinte de ce que la rédaction peut retoucher (texte, classement, SEO, image) :
 * si elle change entre deux imports, l'article a été modifié sur le nouveau blog.
 */
interface Editorial {
    title: string;
    contentJson: unknown;
    excerpt?: string | null;
    categories?: unknown[] | null;
    primaryCategory?: unknown;
    tags?: unknown[] | null;
    authors?: unknown[] | null;
    seo?: { title?: string | null; description?: string | null; focusKeywords?: string[] | null; noindex?: boolean | null; nofollow?: boolean | null; canonical?: string | null } | null;
    featuredImage?: { url?: string | null } | null;
}
const ids = (list?: unknown[] | null) => (list ?? []).map(String);
const importHash = (p: Editorial) =>
    createHash("sha1")
        .update(
            JSON.stringify([
                p.title,
                p.contentJson,
                p.excerpt || "",
                ids(p.categories),
                p.primaryCategory ? String(p.primaryCategory) : "",
                ids(p.tags),
                ids(p.authors),
                [p.seo?.title || "", p.seo?.description || "", (p.seo?.focusKeywords ?? []).join(","), !!p.seo?.noindex, !!p.seo?.nofollow, p.seo?.canonical || ""],
                p.featuredImage?.url || "",
            ])
        )
        .digest("hex");
const shortExcerpt = (text: string, max = 220) => (text.length <= max ? text : `${text.slice(0, text.lastIndexOf(" ", max)).trim()}…`);

/* ─── Rapport ─── */

const report = {
    warnings: new Map<string, string[]>(),
    skippedEdited: [] as string[],
    missingImages: new Set<string>(),
    externalImages: new Set<string>(),
    reviews: [] as string[],
    missedSchedule: [] as string[],
    unknownRedirects: [] as string[],
    pages: [] as string[],
};
function warn(slug: string, msg: string) {
    const list = report.warnings.get(slug) ?? [];
    if (!list.includes(msg)) list.push(msg);
    report.warnings.set(slug, list);
}

/* ─── Images : WebP, une seule taille, médiathèque ─── */

const SIZE_RE = /-\d+x\d+(?=\.[a-z0-9]+$)/i;
const localIndex = new Map<string, string>(); // chemin relatif (minuscules) → fichier
const byName = new Map<string, string>(); // nom de fichier (minuscules) → fichier
function indexImages(dir: string, rel = "") {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
        const abs = path.join(dir, name);
        const r = rel ? `${rel}/${name}` : name;
        if (statSync(abs).isDirectory()) indexImages(abs, r);
        else {
            localIndex.set(r.toLowerCase(), abs);
            if (!byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), abs);
        }
    }
}

/** « https://blog.workyt.fr/wp-content/uploads/2024/03/x-300x200.jpg » → fichier local de l'original */
function localImage(src: string): { abs: string; rel: string } | null {
    const m = /\/wp-content\/uploads\/([^?#]+)/i.exec(src);
    if (!m) return null;
    let rel = decodeSlug(m[1]);
    rel = rel.replace(SIZE_RE, "");
    const { dir, name, ext } = path.posix.parse(rel);
    const cands = [rel, `${dir}/${name}-scaled${ext}`, rel.replace("-scaled", "")];
    for (const c of cands) {
        const abs = localIndex.get(c.toLowerCase());
        if (abs) return { abs, rel: c };
    }
    for (const c of cands) {
        const abs = byName.get(path.posix.basename(c).toLowerCase());
        if (abs) return { abs, rel: c };
    }
    return null;
}

let s3: S3Client | null = null;
interface StoredMedia {
    id: string;
    url: string;
    width: number;
    height: number;
}
const mediaCache = new Map<string, Promise<StoredMedia>>();

/** Comme storeImage, mais une image illisible renvoie null (signalée dans le rapport) */
async function uploadImage(file: { abs: string; rel: string }, meta: { alt?: string; wpId?: number }): Promise<StoredMedia | null> {
    try {
        return await storeWpImage(file, meta);
    } catch (e) {
        report.missingImages.add(`${file.rel} (illisible : ${(e as Error).message})`);
        return null;
    }
}

function storeWpImage(file: { abs: string; rel: string }, meta: { alt?: string; wpId?: number }): Promise<StoredMedia> {
    const { dir, name } = path.posix.parse(file.rel);
    const safe = name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 70);
    const key = `blog/wp/${dir.replace(/[^0-9/]/g, "") || "divers"}/${safe || "image"}.webp`;
    let job = mediaCache.get(key);
    if (job) return job;
    // Ancienne adresse WordPress de l'original : redirigée vers l'image reprise (route /wp-content/uploads/…)
    const wpPath = file.rel.replace(/^wpmc-trash\//i, "").toLowerCase();
    job = (async () => {
        const existing = await Media.findOneAndUpdate({ key }, { $set: { wpPath } }, { new: true }).lean();
        if (existing && !args.has("--images")) return { id: String(existing._id), url: existing.url, width: existing.width ?? 0, height: existing.height ?? 0 };
        const input = await readFile(file.abs);
        const gif = file.abs.toLowerCase().endsWith(".gif");
        // Fichier légèrement abîmé : on garde ce qui est lisible ; illisible → signalé, pas bloquant
        const { data, info } = await sharp(input, { animated: gif, failOn: "none" })
            .rotate()
            .resize({ width: 2400, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer({ resolveWithObject: true });
        let url: string;
        if (useR2) {
            s3 ??= new S3Client({
                region: process.env.S3_REGION || "auto",
                endpoint: process.env.S3_ENDPOINT,
                credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
                forcePathStyle: true,
            });
            await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key, Body: data, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }));
            url = `${process.env.S3_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
        } else {
            const dest = path.join(ROOT, "public", "uploads-dev", key);
            await mkdir(path.dirname(dest), { recursive: true });
            await writeFile(dest, data);
            url = `/uploads-dev/${key}`;
        }
        const doc = await Media.findOneAndUpdate(
            { key },
            {
                $set: { url, mime: "image/webp", size: data.length, width: info.width, height: info.height, originalName: path.posix.basename(file.rel), wpPath },
                $setOnInsert: {
                    alt: meta.alt || "",
                    // Image reprise du WordPress : source et licence à vérifier par la rédaction
                    credit: { author: "À compléter", source: "Ancien blog (WordPress)", license: "À vérifier" },
                    rightsToCheck: true,
                    ...(meta.wpId ? { wpId: meta.wpId } : {}),
                },
            },
            { upsert: true, new: true }
        );
        return { id: String(doc._id), url, width: info.width, height: info.height };
    })();
    mediaCache.set(key, job);
    return job;
}

/* ─── Contenu Gutenberg → HTML du schéma de l'éditeur ─── */

const YT = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i;
const UNWRAP = [
    ".wp-block-columns",
    ".wp-block-column",
    ".wp-block-group",
    ".wp-block-group__inner-container",
    ".wp-block-media-text",
    ".wp-block-media-text__media",
    ".wp-block-media-text__content",
    ".wp-block-cover",
    ".wp-block-cover__inner-container",
    ".wp-block-buttons",
    ".wp-block-button",
    ".wp-block-embed__wrapper",
];
const DROP = [
    ".wp-block-rank-math-toc-block",
    "nav",
    ".wp-block-spacer",
    "script",
    "style",
    "noscript",
    ".wp-block-social-links",
    ".wp-block-post-featured-image",
    ".wp-block-publishpress-authors-author-boxes-block",
    ".pp-multiple-authors-boxes-wrapper",
    "img.wp-block-cover__image-background ~ span",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- éléments happy-dom
type El = any;

function unwrap(el: El) {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    el.remove();
}

function youtubeBlock(id: string): El {
    const div = document.createElement("div");
    div.setAttribute("data-youtube-video", "");
    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", `https://www.youtube-nocookie.com/embed/${id}`);
    div.appendChild(iframe);
    return div;
}
function linkParagraph(url: string, label?: string): El {
    const p = document.createElement("p");
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.textContent = label || url;
    p.appendChild(a);
    return p;
}

interface ConvertCtx {
    slug: string;
    attachments: Map<string, { alt: string; caption: string }>;
}

async function convertContent(raw: string, ctx: ConvertCtx): Promise<{ json: JSONContent; html: string }> {
    const root = document.createElement("div");
    root.innerHTML = raw.replace(/<!--[\s\S]*?-->/g, "");

    for (const sel of DROP) root.querySelectorAll(sel).forEach((el: El) => el.remove());

    // Vidéos et intégrations
    root.querySelectorAll("figure.wp-block-embed, iframe").forEach((el: El) => {
        if (!el.isConnected) return;
        const url = el.tagName === "IFRAME" ? el.getAttribute("src") || "" : (el.querySelector("iframe")?.getAttribute("src") || el.textContent || "").trim();
        const yt = YT.exec(url);
        const fig = el.tagName === "IFRAME" ? el.closest("figure") || el : el;
        if (yt) fig.replaceWith(youtubeBlock(yt[1]));
        else if (/^https?:\/\//.test(url)) {
            fig.replaceWith(linkParagraph(url));
            warn(ctx.slug, `intégration remplacée par un lien : ${url}`);
        } else fig.remove();
    });
    root.querySelectorAll("video, audio").forEach((el: El) => {
        const src = el.getAttribute("src") || el.querySelector("source")?.getAttribute("src") || "";
        const fig = el.closest("figure") || el;
        if (src) fig.replaceWith(linkParagraph(src, el.tagName === "VIDEO" ? "Voir la vidéo" : "Écouter l'audio"));
        else fig.remove();
        warn(ctx.slug, `${el.tagName === "VIDEO" ? "vidéo" : "audio"} hébergé(e) sur WordPress : remplacé(e) par un lien, à revoir`);
    });

    // Galeries : une image après l'autre
    root.querySelectorAll(".wp-block-gallery, .wp-block-jetpack-tiled-gallery, .tiled-gallery").forEach((g: El) => {
        if (!g.isConnected) return;
        const frag = document.createDocumentFragment();
        g.querySelectorAll("img").forEach((img: El) => {
            const fig = document.createElement("figure");
            fig.appendChild(img.cloneNode(true));
            const cap = img.closest("figure")?.querySelector("figcaption");
            if (cap) fig.appendChild(cap.cloneNode(true));
            frag.appendChild(fig);
        });
        g.replaceWith(frag);
    });

    // Citations mises en avant, auteurs de citation
    root.querySelectorAll("figure.wp-block-pullquote").forEach((f: El) => {
        const q = f.querySelector("blockquote");
        if (q) f.replaceWith(q);
        else unwrap(f);
    });
    root.querySelectorAll("blockquote cite").forEach((c: El) => {
        const p = document.createElement("p");
        p.textContent = `— ${c.textContent.trim()}`;
        c.replaceWith(p);
    });

    // Tableaux : la légende devient un paragraphe sous le tableau
    root.querySelectorAll("figure.wp-block-table").forEach((f: El) => {
        const cap = f.querySelector("figcaption");
        if (cap) {
            const p = document.createElement("p");
            const em = document.createElement("em");
            em.textContent = cap.textContent.trim();
            p.appendChild(em);
            f.after(p);
            cap.remove();
        }
        unwrap(f);
    });

    for (const sel of UNWRAP) root.querySelectorAll(sel).forEach((el: El) => unwrap(el));
    root.querySelectorAll("a.wp-block-button__link").forEach((a: El) => {
        if (a.parentElement === root) {
            const p = document.createElement("p");
            a.replaceWith(p);
            p.appendChild(a);
        }
    });

    // Titres : H2 à H4 seulement
    root.querySelectorAll("h1").forEach((h: El) => (h.outerHTML = `<h2>${h.innerHTML}</h2>`));
    root.querySelectorAll("h5, h6").forEach((h: El) => (h.outerHTML = `<h4>${h.innerHTML}</h4>`));

    // Images → figure de l'éditeur (image du blog, sinon lien d'origine signalé)
    const imgs = [...root.querySelectorAll("img")];
    for (const img of imgs as El[]) {
        // CDN Jetpack (« https://i0.wp.com/blog.workyt.fr/wp-content/… ») : ce sont nos images
        const src = (img.getAttribute("src") || img.getAttribute("data-src") || "").replace(/^https?:\/\/i\d\.wp\.com\/(blog\.workyt\.fr\/)/i, "https://$1");
        const holder = img.closest("figure") || img;
        const caption = (holder.querySelector?.("figcaption")?.textContent || "").trim();
        const idClass = /wp-image-(\d+)/.exec(img.getAttribute("class") || "");
        const att = idClass ? ctx.attachments.get(idClass[1]) : undefined;
        const alt = (img.getAttribute("alt") || att?.alt || "").trim();
        const fig = document.createElement("figure");
        fig.setAttribute("class", "wk-figure");
        const media = document.createElement("div");
        media.setAttribute("class", "wk-figure-media");
        const out = document.createElement("img");
        out.setAttribute("alt", alt);
        const local = SITE_HOSTS.test(src) || src.startsWith("/wp-content/") ? localImage(src) : null;
        const m = local ? await uploadImage(local, { alt, wpId: idClass ? Number(idClass[1]) : undefined }) : null;
        if (local && !m) {
            warn(ctx.slug, `image illisible, retirée : ${local.rel}`);
            holder.remove();
            continue;
        }
        if (m) {
            fig.setAttribute("data-media-id", m.id);
            out.setAttribute("src", m.url);
            out.setAttribute("width", String(m.width));
            out.setAttribute("height", String(m.height));
        } else if (/^https?:\/\//.test(src)) {
            out.setAttribute("src", src);
            if (/\/wp-content\/uploads\//.test(src) && SITE_HOSTS.test(src)) {
                report.missingImages.add(src);
                warn(ctx.slug, `image introuvable dans l'archive : ${src}`);
            } else {
                report.externalImages.add(src);
                warn(ctx.slug, `image d'un autre site (lien direct) : ${src}`);
            }
        } else {
            holder.remove();
            continue;
        }
        media.appendChild(out);
        fig.appendChild(media);
        if (caption) {
            const fc = document.createElement("figcaption");
            fc.textContent = caption;
            fig.appendChild(fc);
        }
        // Le lien autour d'une image (vers le fichier ou la page de pièce jointe) disparaît
        const linkAround = img.parentElement?.tagName === "A" ? img.parentElement : null;
        const target = holder.tagName === "FIGURE" ? holder : linkAround && linkAround.childNodes.length === 1 ? linkAround : img;
        target.replaceWith(fig);
    }

    // Liens : adresses du blog en relatif ; fichiers WordPress signalés
    root.querySelectorAll("a[href]").forEach((a: El) => {
        const href = a.getAttribute("href") || "";
        if (/\/wp-content\/uploads\//i.test(href)) warn(ctx.slug, `lien vers un fichier WordPress (à reprendre) : ${href}`);
        else if (SITE_HOSTS.test(href)) a.setAttribute("href", href.replace(SITE_HOSTS, "") || "/");
    });

    // Paragraphes vides
    root.querySelectorAll("p").forEach((p: El) => {
        if (!p.textContent.replace(/ /g, " ").trim() && !p.querySelector("img, iframe, figure")) p.remove();
    });
    // Reste de blocs inconnus
    root.querySelectorAll("div").forEach((d: El) => {
        if (!d.hasAttribute("data-youtube-video") && !d.classList.contains("wk-figure-media")) unwrap(d);
    });

    const json = generateJSON(root.innerHTML, schemaExtensions()) as JSONContent;
    return { json, html: documentToHtml(json) };
}

/* ─── Correspondances ─── */

const STATUS: Record<string, PostStatus> = {
    publish: "published",
    draft: "draft",
    future: "scheduled",
    pending: "pending_correction",
    private: "unpublished",
};
const WP_ROLE: Record<string, Role> = {
    administrator: "redac_chef",
    editor: "redac_chef",
    author: "redacteur",
    contributor: "redacteur",
    correcteur: "correcteur",
};
/** Pixwell → réactions du nouveau blog */
const REACTION: Record<string, string> = { love: "love", sad: "sad", happy: "happy", sleepy: "sleep", sleep: "sleep", angry: "angry", dead: "dead", wink: "wink" };
/** Couleurs des rubriques principales (palette Workyt) ; les sous-rubriques prennent celle du parent */
const COLORS: Record<string, string> = {
    actualites: "#ff6a1a",
    "conseils-methodes": "#6ec1e4",
    "nos-interviews": "#b48cf2",
    culture: "#ffb547",
    "test-produit": "#7ed957",
    "orientation-scolaire": "#6ec1e4",
    "sante-vie-etudiante": "#7ed957",
    workyt: "#ff6a1a",
    "le-bon-plan": "#ffb547",
};
/**
 * Rubriques non reprises : « Workyt » est la rubrique par défaut de WordPress
 * (« Non classé » renommée), souvent laissée cochée par oubli. Les articles
 * gardent leurs autres rubriques ; l'ancienne adresse redirige vers l'accueil.
 */
const SKIPPED_CATEGORIES = new Set(["workyt", "codworkyt"]);
/** Pages WordPress non reprises : équivalent sur workyt.fr (ou l'accueil du blog) */
const PAGES: Record<string, string> = {
    "privacy-policy": "https://workyt.fr/politique-confidentialite",
    inscription: "https://workyt.fr/",
    activation: "https://workyt.fr/",
    membres: "https://workyt.fr/",
    "activites-du-site": "https://workyt.fr/",
    annonce: "https://workyt.fr/partenaires",
};

/** Titre / description Rank Math : variables remplacées, « - Workyt » final retiré (ajouté par le blog) */
function rankMathText(s: string | undefined, title: string, excerpt: string): string | undefined {
    if (!s) return undefined;
    const out = s
        .replace(/%title%/g, title)
        .replace(/%excerpt%/g, excerpt)
        .replace(/%sep%\s*%sitename%/g, "")
        .replace(/%sitename%/g, "Workyt")
        .replace(/%sep%/g, "-")
        .replace(/%[a-z_]+%/g, "")
        .replace(/\s+/g, " ")
        .trim();
    return out && out !== title ? decodeEntities(out) : undefined;
}

/* ─── Avis notés Pixwell ─── */

const CRITERIA_MAX = 7;
const BOOK_HINT = /personnage|écriture|lecture|livre|roman|récit|histoire|émotion|réflexion/i;

/** « Facile / Gratuit\r\n/ Rapide » → ["Facile", "Gratuit", "Rapide"] */
const splitList = (s: unknown) =>
    String(s || "")
        .split(/\s*\/\s*|\r?\n/)
        .map((x) => decodeEntities(x).trim())
        .filter(Boolean);

/** Titre du livre ou du produit, tiré du titre de l'article (« "La marcheuse" : entre… » → « La marcheuse ») */
const subjectOf = (title: string) =>
    (title.match(/[«"“]\s*([^»"”]+?)\s*[»"”]/)?.[1] ?? title.split(/\s+[:–—]\s+|\s+(?:est-(?:il|elle)|vaut-(?:il|elle))\b/)[0]).replace(/\s*\?\s*$/, "").trim();

async function pixwellReview(
    wpId: string,
    slug: string,
    title: string,
    meta: Record<string, unknown> | null,
    attachments: Map<string, { alt: string; caption: string; file: string }>
): Promise<ArticleModule[]> {
    if (!meta || String(meta.post_review) !== "1") return [];
    const stars: { label: string; star: number }[] = [];
    for (let i = 1; i <= CRITERIA_MAX; i++) {
        const label = decodeEntities(String(meta[`review_label_${i}`] || "")).trim();
        const star = Number(String(meta[`review_star_${i}`] || "").replace(",", "."));
        if (label && Number.isFinite(star)) stars.push({ label, star });
    }
    if (!stars.length) return [];

    let image: ModuleImage | null = null;
    const att = attachments.get(String(meta.review_feat || ""));
    if (att?.file) {
        const local = localImage(`/wp-content/uploads/${att.file}`);
        const media = local ? await uploadImage(local, { alt: att.alt, wpId: Number(meta.review_feat) }) : null;
        if (media) image = { url: media.url, alt: att.alt || "", width: media.width, height: media.height, mediaId: media.id, credit: { author: "", source: "", license: "", sourceUrl: "" } };
    }
    const pros = splitList(meta.review_pros);
    const cons = splitList(meta.review_cons);
    const summary = decodeEntities(String(meta.review_summary || meta.review_meta || "")).trim();
    const isBook = stars.filter((s) => BOOK_HINT.test(s.label)).length >= 2;
    const id = `wp${wpId}`.slice(0, 12);
    const raw = isBook
        ? { id, type: "bookReview", data: { title: subjectOf(title), summary, image, criteria: stars.map((s) => ({ label: s.label, score: s.star })), pros, cons } }
        : {
              id,
              type: "techReview",
              data: { product: subjectOf(title), image, price: decodeEntities(String(meta.review_button || "")), criteria: stars.map((s) => ({ label: s.label, score: s.star * 2 })), pros, cons, verdict: summary },
          };
    const modules = sanitizeModules([raw]);
    report.reviews.push(`${slug} → ${isBook ? "Avis lecture" : "Avis tech"} « ${subjectOf(title)} » (${stars.length} critères) : vérifier le nom${isBook ? ", l'auteur et l'éditeur du livre" : " du produit"}`);
    return modules;
}

/* ─── Import ─── */

async function main() {
    const sqlFile = readdirSync(MIG).find((f) => f.endsWith(".sql"));
    if (!sqlFile) throw new Error("Aucun export .sql dans migration/");
    indexImages(IMAGES);
    console.log(`Images triées disponibles : ${localIndex.size}`);

    console.log("Lecture de l'export SQL…");
    const T = await readTables(path.join(MIG, sqlFile), [
        `${P}posts`,
        `${P}postmeta`,
        `${P}terms`,
        `${P}term_taxonomy`,
        `${P}term_relationships`,
        `${P}termmeta`,
        `${P}usermeta`,
        `${P}comments`,
        `${P}post_views`,
        `${P}rank_math_redirections`,
    ], {
        // Ni révisions, ni caches, ni contenus d'extensions : seulement articles, pièces jointes et pages
        [`${P}posts`]: (r) => ["post", "attachment", "page", "nav_menu_item"].includes(r[20]),
        [`${P}post_views`]: (r) => r[1] === "4",
        [`${P}postmeta`]: (r) => !r[2]?.startsWith("_oembed") && r[2] !== "_wp_attachment_metadata" && r[2] !== "_jetpack_related_posts_cache",
    });
    await mongoose.connect(uri);
    const importedAt = new Date();

    // Contenus
    const posts = T[`${P}posts`].filter((r) => r[20] === "post" && STATUS[r[7]]);
    const keptIds = new Set(posts.map((r) => r[0]));
    const attachRows = T[`${P}posts`].filter((r) => r[20] === "attachment");
    const pages = T[`${P}posts`].filter((r) => r[20] === "page" && r[7] === "publish");

    const meta = new Map<string, Map<string, string>>();
    for (const [, postId, key, val] of T[`${P}postmeta`]) {
        if (!meta.has(postId)) meta.set(postId, new Map());
        meta.get(postId)!.set(key, val);
    }
    const attachments = new Map<string, { alt: string; caption: string; file: string; parent: string }>();
    for (const r of attachRows) {
        const m = meta.get(r[0]);
        attachments.set(r[0], { alt: m?.get("_wp_attachment_image_alt") || "", caption: stripTags(r[6] || ""), file: m?.get("_wp_attached_file") || "", parent: r[17] });
    }

    // Taxonomies
    const terms = new Map(T[`${P}terms`].map((r) => [r[0], { name: decodeEntities(r[1]), slug: decodeSlug(r[2]) }]));
    const tt = new Map(T[`${P}term_taxonomy`].map((r) => [r[0], { termId: r[1], taxonomy: r[2], description: r[3], parent: r[4], count: Number(r[5]) }]));
    const termMeta = new Map<string, Map<string, string>>();
    for (const [, termId, key, val] of T[`${P}termmeta`]) {
        if (!termMeta.has(termId)) termMeta.set(termId, new Map());
        termMeta.get(termId)!.set(key, val);
    }
    // Menu principal du WordPress (« Main Menu ») : ses rubriques de premier niveau forment le menu du blog
    const mainMenuTt = [...tt].find(([, t]) => t.taxonomy === "nav_menu" && terms.get(t.termId)?.name === "Main Menu")?.[0];
    const menuItemIds = new Set(T[`${P}term_relationships`].filter((r) => r[1] === mainMenuTt).map((r) => r[0]));
    const menuOrder = new Map<string, number>(); // term_id de la rubrique → position
    for (const r of T[`${P}posts`]) {
        if (r[20] !== "nav_menu_item" || r[7] !== "publish" || !menuItemIds.has(r[0])) continue;
        const m = meta.get(r[0]);
        if (m?.get("_menu_item_object") === "category" && (m.get("_menu_item_menu_item_parent") || "0") === "0") menuOrder.set(m.get("_menu_item_object_id") || "", Number(r[19]) || 0);
    }

    const rel = new Map<string, { ttId: string; order: number }[]>();
    for (const [objectId, ttId, order] of T[`${P}term_relationships`]) {
        if (!keptIds.has(objectId)) continue;
        if (!rel.has(objectId)) rel.set(objectId, []);
        rel.get(objectId)!.push({ ttId, order: Number(order) || 0 });
    }

    console.log("Rubriques…");
    const catByTerm = new Map<string, Types.ObjectId>();
    const cats = [...tt.values()].filter((t) => t.taxonomy === "category" && !SKIPPED_CATEGORIES.has(terms.get(t.termId)!.slug));
    await Category.deleteMany({ slug: { $in: [...SKIPPED_CATEGORIES] } });
    for (const [i, c] of cats.entries()) {
        const term = terms.get(c.termId)!;
        const doc = await Category.findOneAndUpdate(
            { $or: [{ wpId: Number(c.termId) }, { slug: term.slug }] },
            {
                $set: { wpId: Number(c.termId), slug: term.slug, name: term.name, description: stripTags(c.description) },
                // Menu modifiable ensuite dans le dashboard : repris seulement à la création
                $setOnInsert: { order: menuOrder.get(c.termId) ?? 100 + i, inMenu: menuOrder.has(c.termId), color: COLORS[term.slug] || "#ff6a1a" },
            },
            { upsert: true, new: true }
        );
        catByTerm.set(c.termId, doc._id);
    }
    for (const c of cats) {
        if (c.parent === "0") continue;
        await Category.updateOne({ _id: catByTerm.get(c.termId) }, { $set: { parent: catByTerm.get(c.parent) ?? null } });
        // Sous-rubrique sans couleur choisie : celle de la rubrique parente
        const parentColor = COLORS[terms.get(c.parent)?.slug ?? ""];
        if (parentColor && !COLORS[terms.get(c.termId)!.slug]) await Category.updateOne({ _id: catByTerm.get(c.termId), color: "#ff6a1a" }, { $set: { color: parentColor } });
    }

    console.log("Étiquettes…");
    const tagByTerm = new Map<string, Types.ObjectId>();
    const usedTags = new Set<string>();
    for (const list of rel.values()) for (const { ttId } of list) if (tt.get(ttId)?.taxonomy === "post_tag") usedTags.add(tt.get(ttId)!.termId);
    for (const termId of usedTags) {
        const term = terms.get(termId)!;
        const doc = await Tag.findOneAndUpdate(
            { $or: [{ wpId: Number(termId) }, { slug: term.slug }] },
            { $set: { wpId: Number(termId), slug: term.slug, name: term.name } },
            { upsert: true, new: true }
        );
        tagByTerm.set(termId, doc._id);
    }

    console.log("Auteurs…");
    const roles = new Map<string, string>();
    for (const [, userId, key, val] of T[`${P}usermeta`]) {
        if (key !== `${P}capabilities`) continue;
        const caps = unserialize(val) as Record<string, boolean> | null;
        const role = caps ? Object.keys(caps).find((k) => caps[k]) : undefined;
        if (role) roles.set(userId, role);
    }
    const authorByTerm = new Map<string, Types.ObjectId>();
    const authorByUser = new Map<string, Types.ObjectId>();
    for (const t of [...tt.values()].filter((x) => x.taxonomy === "author")) {
        const term = terms.get(t.termId)!;
        const m = termMeta.get(t.termId) ?? new Map<string, string>();
        const userId = m.get("user_id") || "";
        let avatarUrl: string | undefined;
        const avatarId = m.get("avatar");
        const att = avatarId ? attachments.get(avatarId) : undefined;
        if (att?.file) {
            const local = localImage(`/wp-content/uploads/${att.file}`);
            if (local) avatarUrl = (await uploadImage(local, { alt: term.name, wpId: Number(avatarId) }))?.url;
        }
        const wpRole = WP_ROLE[roles.get(userId) || ""];
        const doc = await Author.findOneAndUpdate(
            { $or: [{ wpId: Number(t.termId) }, { slug: term.slug }] },
            {
                $set: {
                    wpId: Number(t.termId),
                    slug: term.slug,
                    name: term.name,
                    ...(m.get("user_email") ? { email: m.get("user_email")!.toLowerCase() } : {}),
                    ...(wpRole ? { wpRole } : {}),
                },
                // Ce qu'un auteur a pu changer depuis sur le nouveau blog n'est pas écrasé
                $setOnInsert: { bio: stripTags(m.get("description") || ""), title: stripTags(m.get("job_title") || ""), ...(avatarUrl ? { avatarUrl } : {}) },
            },
            { upsert: true, new: true }
        );
        // Photo importée localement auparavant (essai sans R2) : remplacée par celle de R2
        if (avatarUrl && doc.avatarUrl?.startsWith("/uploads-dev/") && !avatarUrl.startsWith("/uploads-dev/")) await Author.updateOne({ _id: doc._id }, { $set: { avatarUrl } });
        authorByTerm.set(t.termId, doc._id);
        if (userId) authorByUser.set(userId, doc._id);
    }

    // Vues (Post Views Counter : type 4 = total) et réactions Pixwell
    const views = new Map(T[`${P}post_views`].filter((r) => r[1] === "4").map((r) => [r[0], Number(r[3]) || 0]));

    console.log(`Articles (${posts.length})…`);
    const postBySlug = new Map<string, string>();
    const postIdByWp = new Map<string, Types.ObjectId>();
    let done = 0;
    for (const r of posts) {
        const [wpId, postAuthor, , dateGmtRaw, content, titleRaw, excerptRaw, wpStatus, , , , nameRaw, , , , modifiedGmtRaw] = r;
        const dateLocal = r[2];
        const m = meta.get(wpId) ?? new Map<string, string>();
        const title = decodeEntities(titleRaw).trim() || "Sans titre";
        const slug = decodeSlug(nameRaw) || `article-${wpId}`;
        postBySlug.set(slug, wpId);

        // Article retouché sur le nouveau blog depuis le dernier import (les vues ou réactions ne comptent pas) : on n'écrase pas
        const existing = await Post.findOne({ wpId: Number(wpId) })
            .select("title contentJson excerpt categories primaryCategory tags authors seo featuredImage wpImportHash")
            .lean();
        if (existing?.wpImportHash && importHash(existing as unknown as Editorial) !== existing.wpImportHash && !args.has("--ecraser")) {
            report.skippedEdited.push(slug);
            postIdByWp.set(wpId, existing._id);
            continue;
        }

        const { json, html } = await convertContent(content, { slug, attachments });
        const text = documentText(json);
        const excerpt = stripTags(excerptRaw) || shortExcerpt(text);

        // Rubriques, étiquettes, auteurs (ordre PublishPress)
        const links = (rel.get(wpId) ?? []).sort((a, b) => a.order - b.order);
        const categories = links
            .filter((l) => tt.get(l.ttId)?.taxonomy === "category")
            .map((l) => catByTerm.get(tt.get(l.ttId)!.termId))
            .filter((id): id is Types.ObjectId => !!id);
        if (!categories.length) warn(slug, "aucune rubrique (seulement « Workyt », non reprise) : à classer");
        const tags = links.filter((l) => tt.get(l.ttId)?.taxonomy === "post_tag").map((l) => tagByTerm.get(tt.get(l.ttId)!.termId)!);
        let authors = links.filter((l) => tt.get(l.ttId)?.taxonomy === "author").map((l) => authorByTerm.get(tt.get(l.ttId)!.termId)!);
        if (!authors.length && authorByUser.has(postAuthor)) authors = [authorByUser.get(postAuthor)!];
        if (!authors.length) warn(slug, "aucun auteur retrouvé");
        const primary = catByTerm.get(m.get("rank_math_primary_category") || "") ?? categories[0];

        // Image à la une
        let featuredImage;
        const thumb = attachments.get(m.get("_thumbnail_id") || "");
        if (thumb?.file) {
            const local = localImage(`/wp-content/uploads/${thumb.file}`);
            const media = local ? await uploadImage(local, { alt: thumb.alt, wpId: Number(m.get("_thumbnail_id")) }) : null;
            if (media) {
                featuredImage = { url: media.url, width: media.width, height: media.height, alt: thumb.alt || "", credit: { author: "", source: "", license: "", sourceUrl: "" }, rightsToCheck: true };
            } else warn(slug, `image à la une introuvable : ${thumb.file}`);
        }

        // SEO Rank Math
        const robots = unserialize(m.get("rank_math_robots") || "") as Record<string, string> | null;
        const robotList = robots ? Object.values(robots) : [];
        const seo = {
            title: rankMathText(m.get("rank_math_title"), title, excerpt),
            description: rankMathText(m.get("rank_math_description"), title, excerpt),
            focusKeywords: (m.get("rank_math_focus_keyword") || "").split(",").map((k) => k.trim()).filter(Boolean),
            noindex: robotList.includes("noindex"),
            nofollow: robotList.includes("nofollow"),
            canonical: m.get("rank_math_canonical_url") || undefined,
            score: Number(m.get("rank_math_seo_score")) || undefined,
        };

        // Réactions (« Quelle est ta réaction ? »)
        const reactions: Record<string, number> = {};
        const rx = unserialize(m.get("rb_reaction_data") || "") as Record<string, Record<string, unknown>> | null;
        if (rx) for (const [k, voters] of Object.entries(rx)) if (REACTION[k]) reactions[REACTION[k]] = (reactions[REACTION[k]] || 0) + Object.keys(voters || {}).length;

        // Avis noté Pixwell → module « Avis lecture » ou « Avis tech »
        const modules = await pixwellReview(wpId, slug, title, unserialize(m.get("rb_global_meta") || "") as Record<string, unknown> | null, attachments);
        if (!modules.length && m.get("pixwell_review_stars")) report.reviews.push(`${slug} (note ${m.get("pixwell_review_stars")}/5, sans critères : rien à reprendre)`);

        const publishedAt = gmt(dateGmtRaw) ?? (dateLocal ? new Date(dateLocal.replace(" ", "T")) : undefined);
        // « Programmation manquée » de WordPress (date passée, encore « programmé ») : WordPress le publie
        // au prochain déclenchement de sa tâche planifiée ; on fait pareil, à sa date prévue
        const missed = wpStatus === "future" && !!publishedAt && publishedAt.getTime() <= Date.now();
        if (missed) report.missedSchedule.push(`${slug} (prévu le ${publishedAt!.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })})`);
        const status: PostStatus = missed ? "published" : STATUS[wpStatus];
        const doc = await Post.findOneAndUpdate(
            { wpId: Number(wpId) },
            {
                $set: {
                    title,
                    slug,
                    status,
                    excerpt,
                    contentJson: json,
                    contentHtml: html,
                    authors,
                    categories,
                    primaryCategory: primary,
                    tags,
                    featuredImage,
                    seo,
                    isPillar: m.get("rank_math_pillar_content") === "on",
                    publishedAt: status === "scheduled" ? undefined : publishedAt,
                    scheduledAt: status === "scheduled" ? publishedAt : undefined,
                    modifiedAt: gmt(modifiedGmtRaw) ?? publishedAt,
                    readingMinutes: readingMinutes(html),
                    views: views.get(wpId) || 0,
                    reactions,
                    modules,
                    wpImportedAt: importedAt,
                },
            },
            { upsert: true, new: true, timestamps: false }
        );
        // Empreinte calculée sur l'article tel qu'enregistré (relu en base, comme au prochain import)
        const saved = await Post.findById(doc._id).select("title contentJson excerpt categories primaryCategory tags authors seo featuredImage").lean();
        await Post.collection.updateOne({ _id: doc._id }, { $set: { wpImportHash: importHash(saved as unknown as Editorial) } });
        await Post.collection.updateOne({ _id: doc._id, createdAt: { $exists: false } }, { $set: { createdAt: publishedAt ?? importedAt, updatedAt: importedAt } });
        postIdByWp.set(wpId, doc._id);
        if (++done % 25 === 0) console.log(`  ${done}/${posts.length}`);
    }

    console.log("Commentaires…");
    const comments = T[`${P}comments`].filter((c) => c[10] === "1" && keptIds.has(c[1]) && (!c[12] || c[12] === "comment"));
    const parentOf = new Map(comments.map((c) => [c[0], c[13]]));
    const rootOf = (id: string): string => {
        let cur = id;
        for (let k = 0; k < 20 && parentOf.get(cur) && parentOf.get(cur) !== "0" && parentOf.has(parentOf.get(cur)!); k++) cur = parentOf.get(cur)!;
        return cur;
    };
    const commentIds = new Map<string, Types.ObjectId>();
    // Premier niveau d'abord, réponses ensuite (un seul niveau sur le nouveau blog)
    const ordered = [...comments].sort((a, b) => Number(rootOf(a[0]) !== a[0]) - Number(rootOf(b[0]) !== b[0]));
    for (const c of ordered) {
        const postId = postIdByWp.get(c[1]);
        if (!postId) continue;
        const at = gmt(c[7], c[6]) ?? importedAt;
        const root = rootOf(c[0]);
        const doc = await Comment.findOneAndUpdate(
            { wpId: Number(c[0]) },
            {
                $set: {
                    post: postId,
                    parent: root !== c[0] ? commentIds.get(root) ?? null : null,
                    name: decodeEntities(c[2]).trim() || "Invité",
                    text: stripTags(c[8].replace(/<br\s*\/?>|<\/p>/gi, "\n")).slice(0, 5000),
                    status: "published",
                    publishedAt: at,
                    moderatedBy: "import WordPress",
                },
            },
            { upsert: true, new: true, timestamps: false }
        );
        await Comment.collection.updateOne({ _id: doc._id }, { $set: { createdAt: at, updatedAt: at } });
        commentIds.set(c[0], doc._id);
    }
    for (const id of postIdByWp.values()) {
        const n = await Comment.countDocuments({ post: id, status: "published" });
        await Post.collection.updateOne({ _id: id }, { $set: { commentCount: n } });
    }

    console.log("Redirections…");
    const redirects: { from: string; to: string; status: 301 | 302 | 410; source: "rankmath" | "migration" }[] = [];
    const toPath = (url: string) => url.replace(SITE_HOSTS, "") || "/";
    for (const r of T[`${P}rank_math_redirections`]) {
        const [, sources, urlTo, code, , state] = r;
        if (state !== "active") continue;
        const list = Object.values((unserialize(sources) as Record<string, { pattern: string; comparison: string }>) || {});
        for (const s of list) {
            if (s.comparison !== "exact") {
                report.unknownRedirects.push(`${s.comparison} « ${s.pattern} » → ${urlTo}`);
                continue;
            }
            const status = Number(code) === 410 || Number(code) === 451 ? 410 : Number(code) === 302 || Number(code) === 307 ? 302 : 301;
            redirects.push({ from: normalizePath(s.pattern), to: status === 410 ? "" : toPath(urlTo), status, source: "rankmath" });
        }
    }
    for (const r of posts) {
        const slug = decodeSlug(r[11]);
        const old = meta.get(r[0])?.get("_wp_old_slug");
        if (old && decodeSlug(old) !== slug && !postBySlug.has(decodeSlug(old))) redirects.push({ from: normalizePath(decodeSlug(old)), to: `/${slug}/`, status: 301, source: "migration" });
        if (r[7] === "publish") redirects.push({ from: `/?p=${r[0]}`, to: `/${slug}/`, status: 301, source: "migration" });
    }
    for (const [id, a] of attachments) {
        const parent = posts.find((p) => p[0] === a.parent && p[7] === "publish");
        if (parent) redirects.push({ from: `/?attachment_id=${id}`, to: `/${decodeSlug(parent[11])}/`, status: 301, source: "migration" });
    }
    for (const slug of SKIPPED_CATEGORIES) redirects.push({ from: `/category/${slug}/`, to: "/", status: 301, source: "migration" });
    for (const pg of pages) {
        const to = PAGES[pg[11]] ?? "/";
        report.pages.push(`/${pg[11]}/ → ${to}`);
        redirects.push({ from: normalizePath(pg[11]), to, status: 301, source: "migration" });
        redirects.push({ from: `/?page_id=${pg[0]}`, to, status: 301, source: "migration" });
    }
    let redirCount = 0;
    for (const rd of redirects) {
        // Une redirection ajoutée à la main sur le nouveau blog garde la priorité
        const res = await Redirect.updateOne({ from: rd.from, source: { $ne: "manual" } }, { $set: rd }, { upsert: false });
        if (!res.matchedCount && !(await Redirect.exists({ from: rd.from }))) await Redirect.create(rd);
        redirCount++;
    }

    // Rapport
    const media = await Media.countDocuments({ key: /^blog\/wp\// });
    const lines = [
        `# Rapport d'import WordPress — ${importedAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`,
        "",
        `- Articles : ${posts.length} (dont ${report.skippedEdited.length} déjà modifiés sur le nouveau blog, non écrasés)`,
        `- Rubriques : ${cats.length} · étiquettes : ${usedTags.size} · auteurs : ${authorByTerm.size}`,
        `- Images (médiathèque) : ${media} · commentaires : ${commentIds.size} · redirections : ${redirCount}`,
        `- Images introuvables : ${report.missingImages.size} · images d'autres sites : ${report.externalImages.size}`,
        "",
        "## Avis notés (Pixwell) convertis en module",
        ...(report.reviews.length ? report.reviews.map((r) => `- ${r}`) : ["- aucun"]),
        "",
        "## Programmations manquées de WordPress, importées comme publiées",
        ...(report.missedSchedule.length ? report.missedSchedule.map((s) => `- ${s}`) : ["- aucune"]),
        "",
        "## Pages WordPress redirigées",
        ...report.pages.map((p) => `- ${p}`),
        "",
        "## Redirections Rank Math non reprises (règles non exactes)",
        ...(report.unknownRedirects.length ? report.unknownRedirects.map((r) => `- ${r}`) : ["- aucune"]),
        "",
        "## Articles modifiés depuis l'import précédent (non écrasés)",
        ...(report.skippedEdited.length ? report.skippedEdited.map((s) => `- /${s}/`) : ["- aucun"]),
        "",
        "## Points à revoir, article par article",
        ...[...report.warnings].flatMap(([slug, list]) => [`### /${slug}/`, ...list.map((w) => `- ${w}`), ""]),
    ];
    await writeFile(path.join(MIG, "rapport-import.md"), lines.join("\n"));
    console.log(lines.slice(0, 7).join("\n"));
    console.log("Rapport complet : migration/rapport-import.md");
    await mongoose.disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await mongoose.disconnect();
    process.exit(1);
});
