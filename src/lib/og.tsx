import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";

/**
 * Cartes de partage (Open Graph) : ce qui s'affiche quand on partage un lien
 * sur WhatsApp, Facebook, LinkedIn, X ou Discord. 1200 × 630, en JPEG léger
 * (≈ 100 à 200 Ko) : certains réseaux ne lisent pas le WebP des articles, ou
 * ignorent les images trop lourdes.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const PUBLIC = path.join(process.cwd(), "public");
const INK = "#1a1512";
const PAPER = "#fdfaf4";
const ORANGE = "#ff6a1a";

type Assets = { display: Buffer; body: Buffer; logo: string; fox: string };
let assets: Promise<Assets> | null = null;

const dataUrl = (buf: Buffer, mime: string) => `data:${mime};base64,${buf.toString("base64")}`;

function loadAssets(): Promise<Assets> {
    assets ??= (async () => {
        const [display, body, logoSvg, fox] = await Promise.all([
            readFile(path.join(PUBLIC, "og", "FunnelDisplay-SemiBold.ttf")),
            readFile(path.join(PUBLIC, "og", "Montserrat-SemiBold.ttf")),
            readFile(path.join(PUBLIC, "logo-blog-workyt.svg")),
            readFile(path.join(PUBLIC, "renard-workyt.png")),
        ]);
        // Le logo est un SVG qui contient une image : rendu en PNG une fois pour toutes
        const logo = await sharp(logoSvg, { density: 144 }).resize({ width: 520 }).png().toBuffer();
        return { display, body, logo: dataUrl(logo, "image/png"), fox: dataUrl(fox, "image/png") };
    })().catch((e) => {
        assets = null;
        throw e;
    });
    return assets;
}

/** Photo de l'article, recadrée en 1200 × 630 et convertie en JPEG (le générateur ne lit pas le WebP) */
async function photo(url: string): Promise<string | null> {
    try {
        const buf = url.startsWith("/")
            ? await readFile(path.join(PUBLIC, decodeURIComponent(url.split("?")[0])))
            : Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(8000) })).arrayBuffer());
        const jpg = await sharp(buf).resize(OG_SIZE.width, OG_SIZE.height, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
        return dataUrl(jpg, "image/jpeg");
    } catch {
        return null;
    }
}

/** Titre raccourci et taille de police adaptée, pour tenir en 3 lignes au plus */
function fitTitle(title: string): { text: string; size: number } {
    const t = title.trim();
    const text = t.length > 110 ? `${t.slice(0, t.lastIndexOf(" ", 107))}…` : t;
    return { text, size: text.length > 75 ? 54 : text.length > 45 ? 62 : 72 };
}

export interface OgCard {
    title: string;
    /** Petite étiquette au-dessus du titre : rubrique, « Auteur »… */
    kicker?: string;
    /** Adresse de la photo (article) ; sans photo, la carte au renard */
    image?: string | null;
}

/** La carte, en JPEG */
export async function renderOgCard(card: OgCard): Promise<Buffer> {
    const [a, bg] = await Promise.all([loadAssets(), card.image ? photo(card.image) : Promise.resolve(null)]);
    const { text, size } = fitTitle(card.title);
    const fonts = [
        { name: "Funnel Display", data: a.display, weight: 600 as const, style: "normal" as const },
        { name: "Montserrat", data: a.body, weight: 600 as const, style: "normal" as const },
    ];

    const element = bg ? (
        // Article avec photo : la photo en plein cadre, assombrie en bas sous le titre
        <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "Montserrat" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendu d'image côté serveur */}
            <img src={bg} width={OG_SIZE.width} height={OG_SIZE.height} alt="" style={{ position: "absolute", top: 0, left: 0 }} />
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", backgroundImage: "linear-gradient(180deg, rgba(22,18,15,0.05) 0%, rgba(22,18,15,0.35) 45%, rgba(22,18,15,0.92) 100%)" }} />
            <div style={{ position: "absolute", top: 40, left: 48, display: "flex", background: PAPER, borderRadius: 999, padding: "14px 26px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- rendu d'image côté serveur */}
                <img src={a.logo} width={230} height={51} alt="" />
            </div>
            <div style={{ position: "absolute", left: 56, right: 56, bottom: 48, display: "flex", flexDirection: "column" }}>
                {card.kicker && (
                    <div style={{ display: "flex" }}>
                        <div style={{ background: ORANGE, color: "#fff", fontSize: 24, borderRadius: 999, padding: "8px 20px", textTransform: "uppercase", letterSpacing: 1 }}>{card.kicker}</div>
                    </div>
                )}
                <div style={{ marginTop: 18, color: "#fff", fontFamily: "Funnel Display", fontSize: size, lineHeight: 1.08, letterSpacing: -1 }}>{text}</div>
                <div style={{ marginTop: 18, color: "rgba(255,255,255,0.7)", fontSize: 24 }}>blog.workyt.fr</div>
            </div>
        </div>
    ) : (
        // Sans photo (accueil, rubriques, auteurs, article sans image) : la carte au renard
        <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: PAPER, fontFamily: "Montserrat", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -140, top: -120, width: 620, height: 620, borderRadius: 999, background: "#ffe3d1", display: "flex" }} />
            <div style={{ position: "absolute", right: 70, bottom: 40, display: "flex" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- rendu d'image côté serveur */}
                <img src={a.fox} width={380} height={375} alt="" />
            </div>
            <div style={{ position: "absolute", left: 64, top: 56, display: "flex" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- rendu d'image côté serveur */}
                <img src={a.logo} width={300} height={66} alt="" />
            </div>
            <div style={{ position: "absolute", left: 64, right: 470, bottom: 64, display: "flex", flexDirection: "column" }}>
                {card.kicker && <div style={{ color: ORANGE, fontSize: 26, textTransform: "uppercase", letterSpacing: 2 }}>{card.kicker}</div>}
                <div style={{ marginTop: 14, color: INK, fontFamily: "Funnel Display", fontSize: size, lineHeight: 1.08, letterSpacing: -1 }}>{text}</div>
                <div style={{ marginTop: 22, color: "rgba(26,21,18,0.55)", fontSize: 24 }}>blog.workyt.fr · éducation gratuite</div>
            </div>
            <div style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: 14, display: "flex" }}>
                <div style={{ flex: 1, background: ORANGE }} />
                <div style={{ flex: 1, background: "#ffb547" }} />
                <div style={{ flex: 1, background: "#6ec1e4" }} />
                <div style={{ flex: 1, background: "#7ed957" }} />
            </div>
        </div>
    );

    const png = Buffer.from(await new ImageResponse(element, { ...OG_SIZE, fonts }).arrayBuffer());
    return sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

/** Réponse HTTP d'une carte : mise en cache un jour (les réseaux la redemandent rarement) */
export function ogResponse(jpg: Buffer): Response {
    return new Response(new Uint8Array(jpg), {
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800" },
    });
}
