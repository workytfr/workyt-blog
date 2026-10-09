import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp, { type OverlayOptions } from "sharp";
import { CAROUSEL_SIZE, POINTS_PER_SLIDE, parseRuns, slidesOf, type CarouselData, type SlideKind } from "./data";

/**
 * Diapositives du carrousel, 1080 × 1350 (4:5, Instagram et LinkedIn).
 * Papier beige, dégradé doux à la couleur de la rubrique, grain discret,
 * renard en trait dans le coin. Le fond (dégradés, lignes, photo en
 * transparence) et le grain sont faits avec sharp ; le texte par next/og.
 */

const { width: W, height: H } = CAROUSEL_SIZE;
const PUBLIC = path.join(process.cwd(), "public");
const INK = "#1a1512";
const PAPER = "#fdfaf4";
const ORANGE = "#ff6a1a";
const SUN = "#ffb547";
const POSTIT = "#fff3d6";
const PHOTO_H = 765;

type Fonts = NonNullable<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>;
type Assets = { fonts: Fonts; fox: string; grain: Buffer };
let assets: Promise<Assets> | null = null;

const dataUrl = (buf: Buffer, mime: string) => `data:${mime};base64,${buf.toString("base64")}`;

/** Le renard en trait (logo discret du blog), recoloré */
const foxSvg = (svg: string, color: string) => dataUrl(Buffer.from(svg.replace(/#1d1d1b/gi, color)), "image/svg+xml");

function loadAssets(): Promise<Assets> {
    assets ??= (async () => {
        const font = (f: string) => readFile(path.join(PUBLIC, "og", f));
        const [display, displayBold, body, bodySemi, bodyBold, fox] = await Promise.all([
            font("FunnelDisplay-SemiBold.ttf"),
            font("FunnelDisplay-Bold.ttf"),
            font("Montserrat-Medium.ttf"),
            font("Montserrat-SemiBold.ttf"),
            font("Montserrat-Bold.ttf"),
            readFile(path.join(PUBLIC, "renard-trait.svg"), "utf8"),
        ]);
        // Grain : bruit gris très léger, posé en mosaïque sur chaque diapositive
        const size = 256;
        const raw = Buffer.alloc(size * size * 4);
        for (let i = 0; i < size * size; i++) {
            const v = Math.floor(Math.random() * 255);
            raw[i * 4] = raw[i * 4 + 1] = raw[i * 4 + 2] = v;
            raw[i * 4 + 3] = 22;
        }
        const grain = await sharp(raw, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
        return {
            fonts: [
                { name: "Funnel Display", data: display, weight: 600 as const, style: "normal" as const },
                { name: "Funnel Display", data: displayBold, weight: 700 as const, style: "normal" as const },
                { name: "Montserrat", data: body, weight: 500 as const, style: "normal" as const },
                { name: "Montserrat", data: bodySemi, weight: 600 as const, style: "normal" as const },
                { name: "Montserrat", data: bodyBold, weight: 700 as const, style: "normal" as const },
            ],
            fox,
            grain,
        };
    })().catch((e) => {
        assets = null;
        throw e;
    });
    return assets;
}

/** Image (photo de l'article, avatar) lue en local ou téléchargée, en PNG/JPEG lisible par le générateur */
async function loadImage(src: string | null, width: number, height: number, origin: string): Promise<Buffer | null> {
    if (!src) return null;
    try {
        let buf: Buffer;
        if (src.startsWith("/") && !src.startsWith("/api/")) {
            buf = await readFile(path.join(PUBLIC, decodeURIComponent(src.split("?")[0])));
        } else {
            const url = src.startsWith("/") ? `${origin}${src}` : src;
            const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "WorkytBlog/1.0 (+https://blog.workyt.fr)" } });
            if (!res.ok) return null;
            buf = Buffer.from(await res.arrayBuffer());
        }
        return await sharp(buf, { density: 300 }).resize(width, height, { fit: "cover" }).png().toBuffer();
    } catch {
        return null;
    }
}

/** Fond d'une diapositive claire : papier + dégradés doux à la couleur de la rubrique (+ lignes de cahier) */
function paperBackground(color: string, lined: boolean): Promise<Buffer> {
    const lines = lined ? Array.from({ length: Math.floor(H / 84) }, (_, i) => `<rect x="0" y="${(i + 1) * 84}" width="${W}" height="2" fill="rgba(110,193,228,0.22)"/>`).join("") : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <defs>
            <radialGradient id="a" cx="100%" cy="0%" r="70%"><stop offset="0" stop-color="${color}" stop-opacity="0.17"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>
            <radialGradient id="b" cx="0%" cy="100%" r="60%"><stop offset="0" stop-color="${color}" stop-opacity="0.11"/><stop offset="0.55" stop-color="${SUN}" stop-opacity="0.06"/><stop offset="1" stop-color="${SUN}" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="${PAPER}"/>${lines}
        <rect width="100%" height="100%" fill="url(#a)"/><rect width="100%" height="100%" fill="url(#b)"/>
    </svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Fond de la dernière page : encre, photo de l'article en transparence, lueur à la couleur de la rubrique */
async function darkBackground(color: string, photo: Buffer | null): Promise<Buffer> {
    const glow = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <defs>
            <linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${INK}" stop-opacity="0.6"/><stop offset="0.45" stop-color="${INK}" stop-opacity="0.15"/><stop offset="1" stop-color="${INK}" stop-opacity="0.88"/></linearGradient>
            <radialGradient id="g" cx="100%" cy="100%" r="80%"><stop offset="0" stop-color="${color}" stop-opacity="0.45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#v)"/><rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`;
    const layers: OverlayOptions[] = [];
    if (photo) layers.push({ input: await sharp(photo).resize(W, H, { fit: "cover" }).modulate({ saturation: 0.7 }).removeAlpha().ensureAlpha(0.3).png().toBuffer() });
    layers.push({ input: Buffer.from(glow) });
    return sharp({ create: { width: W, height: H, channels: 4, background: INK } }).composite(layers).png().toBuffer();
}

type Part = { text: string; bold?: boolean; mark?: boolean };
/** Un mot, éventuellement fait de morceaux de styles différents (« s’**organiser**, ») */
type Token = { parts: Part[]; space: boolean };

/** Mots du texte avec leur style. La ponctuation « haute » reste collée au mot (espace insécable). */
function tokens(text: string): Token[] {
    const out: Token[] = [];
    let space = false;
    for (const run of parseRuns(text)) {
        for (const piece of run.text.split(/(\s+)/)) {
            if (!piece) continue;
            if (/^\s+$/.test(piece)) {
                space = true;
                continue;
            }
            const prev = out[out.length - 1];
            const part = { text: piece, bold: run.bold, mark: run.mark };
            const prevText = prev?.parts.map((x) => x.text).join("") ?? "";
            if (prev && !space) prev.parts.push(part);
            else if (prev && (/^[:;!?»]/.test(piece) || prevText.endsWith("«"))) prev.parts.push({ ...part, text: "\u00a0" + piece });
            else out.push({ parts: [part], space: space && out.length > 0 });
            space = false;
        }
    }
    return out;
}

/**
 * Texte avec **gras** et ==surligné==, mot par mot : le générateur d'images
 * ne coupe pas les lignes au milieu d'un <span>, il coupe entre les mots.
 * markAs « color » : le passage ==…== est en orange plutôt que surligné.
 */
function Rich({ text, size, markAs = "highlight" }: { text: string; size: number; markAs?: "highlight" | "color" }) {
    const space = Math.round(size * 0.27);
    const list = tokens(text);
    const marked = (t?: Token) => !!t && t.parts.every((x) => x.mark);
    const partStyle = (x: Part) => {
        const style: Record<string, unknown> = {};
        if (x.bold) style.fontWeight = 700;
        if (x.mark && markAs === "color") style.color = ORANGE;
        if (x.mark && markAs === "highlight") style.backgroundImage = `linear-gradient(180deg, rgba(255,181,71,0) 52%, rgba(255,181,71,0.85) 52%, rgba(255,181,71,0.85) 90%, rgba(255,181,71,0) 90%)`;
        return style;
    };
    // Conteneur à lui : un fragment ne serait pas « aplati » dans le parent
    return (
        <div style={{ display: "flex", flexWrap: "wrap", width: "100%" }}>
            {list.map((t, i) => {
                // L'espace suit le mot : en fin de ligne, il ne décale rien
                const next = list[i + 1];
                const style: Record<string, unknown> = { display: "flex" };
                // Entre deux mots surlignés, l'espace est surligné aussi
                if (next?.space && marked(t) && marked(next) && markAs === "highlight") {
                    style.paddingRight = space;
                    style.backgroundImage = partStyle({ text: "", mark: true }).backgroundImage;
                } else if (next?.space) style.marginRight = space;
                // Un <div> par mot : les <span> ne passent pas à la ligne dans un conteneur flex
                return (
                    <div key={i} style={style}>
                        {t.parts.map((x, j) => (
                            <span key={j} style={partStyle(x)}>
                                {x.text}
                            </span>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}

function Pager({ index, total, dark }: { index: number; total: number; dark?: boolean }) {
    return (
        <div style={{ position: "absolute", right: 60, bottom: 44, display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 700, color: dark ? PAPER : INK }}>
            <span style={{ marginRight: 6 }}>{`${index + 1}/${total}`}</span>
            {Array.from({ length: total }, (_, i) => (
                <div key={i} style={{ width: i === index ? 48 : 16, height: 16, borderRadius: 99, background: i === index ? ORANGE : dark ? "rgba(253,250,244,0.25)" : "rgba(26,21,18,0.16)" }} />
            ))}
        </div>
    );
}

const Handle = ({ dark, text = "@workyt" }: { dark?: boolean; text?: string }) => (
    <div style={{ position: "absolute", left: 60, bottom: 44, fontSize: 28, fontWeight: 600, color: dark ? "rgba(253,250,244,0.6)" : "rgba(26,21,18,0.5)" }}>{text}</div>
);

const Kicker = ({ children, color }: { children: string; color: string }) => (
    <div style={{ fontFamily: "Funnel Display", fontWeight: 700, fontSize: 38, color, textTransform: "uppercase", letterSpacing: 3 }}>{children}</div>
);

/** Couleur de rubrique trop claire pour du texte sur papier : on prend l'orange */
function readable(hex: string): string {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? ORANGE : hex;
}

function coverTitleSize(t: string): number {
    return t.length > 90 ? 76 : t.length > 60 ? 88 : 100;
}

interface Ctx {
    d: CarouselData;
    index: number;
    total: number;
    color: string;
    photo: Buffer | null;
    avatar: Buffer | null;
    fox: string;
    foxLight: string;
}

function Slide({ s, c }: { s: SlideKind; c: Ctx }) {
    const { d } = c;
    const accent = readable(c.color);
    const fox = (light?: boolean) => (
        // eslint-disable-next-line @next/next/no-img-element -- rendu d'image côté serveur
        <img src={light ? c.foxLight : c.fox} width={80} height={81} alt="" style={{ position: "absolute", top: 48, right: 48 }} />
    );

    if (s.kind === "cover") {
        return (
            <div style={{ width: W, height: H, display: "flex", position: "relative", fontFamily: "Montserrat", color: INK }}>
                {c.photo && (
                    <div style={{ position: "absolute", top: 0, left: 0, width: W, height: PHOTO_H, display: "flex" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- rendu d'image côté serveur */}
                        <img src={dataUrl(c.photo, "image/png")} width={W} height={PHOTO_H} alt="" />
                        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: PHOTO_H, display: "flex", backgroundImage: `linear-gradient(180deg, rgba(253,250,244,0) 58%, rgba(253,250,244,0.92) 100%)` }} />
                    </div>
                )}
                {fox(!!c.photo)}
                {d.category?.name && (
                    <div style={{ position: "absolute", top: 54, left: 60, display: "flex", alignItems: "center", gap: 18, background: "rgba(253,250,244,0.93)", borderRadius: 99, padding: "16px 32px 16px 26px", fontFamily: "Funnel Display", fontWeight: 700, fontSize: 32, letterSpacing: 3, textTransform: "uppercase" }}>
                        <div style={{ width: 20, height: 20, borderRadius: 99, background: c.color }} />
                        {d.category.name}
                    </div>
                )}
                <div style={{ position: "absolute", left: 66, right: 66, top: c.photo ? PHOTO_H - 60 : 300, display: "flex", flexDirection: "column" }}>
                    <div style={{ width: W - 132, display: "flex", flexWrap: "wrap", fontFamily: "Funnel Display", fontWeight: 700, fontSize: coverTitleSize(d.title), lineHeight: 1.04, letterSpacing: -1 }}>
                        <Rich text={d.title} size={coverTitleSize(d.title)} />
                    </div>
                    <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 20, fontSize: 32, fontWeight: 600 }}>
                        {c.avatar && (
                            // eslint-disable-next-line @next/next/no-img-element -- rendu d'image côté serveur
                            <img src={dataUrl(c.avatar, "image/png")} width={78} height={78} alt="" style={{ borderRadius: 99, border: "5px solid #fff" }} />
                        )}
                        {d.author?.name && <span>{`Par ${d.author.name}`}</span>}
                        <div style={{ width: 9, height: 9, borderRadius: 99, background: c.color }} />
                        <span style={{ color: "rgba(26,21,18,0.6)" }}>{`${d.readingMinutes} min de lecture`}</span>
                    </div>
                </div>
                <div style={{ position: "absolute", right: 60, bottom: 104, fontSize: 32, fontWeight: 700, color: accent }}>Glisse →</div>
                <Handle text="@workyt · blog.workyt.fr" />
            </div>
        );
    }

    if (s.kind === "intro") {
        return (
            <div style={{ width: W, height: H, display: "flex", flexDirection: "column", position: "relative", fontFamily: "Montserrat", color: INK, padding: "92px 72px" }}>
                {fox()}
                <Kicker color={accent}>L&apos;essentiel</Kicker>
                <div style={{ width: W - 144 - 80, display: "flex", flexWrap: "wrap", marginTop: 18, fontFamily: "Funnel Display", fontWeight: 700, fontSize: 88, lineHeight: 1.04, letterSpacing: -1 }}>
                    <Rich text={d.intro.heading} size={88} />
                </div>
                <div style={{ marginTop: 84, display: "flex", flexDirection: "column", alignItems: "center", transform: "rotate(-1.2deg)" }}>
                    <div style={{ width: 180, height: 42, background: "rgba(255,181,71,0.6)", marginBottom: -20, transform: "rotate(2deg)", display: "flex" }} />
                    <div style={{ width: W - 144, background: POSTIT, borderRadius: 10, padding: "62px 50px 54px", display: "flex", flexWrap: "wrap", fontSize: 40, lineHeight: 1.55, fontWeight: 500, boxShadow: "0 12px 0 rgba(26,21,18,0.05)" }}>
                        <Rich text={d.intro.text} size={40} />
                    </div>
                </div>
                <Handle />
                <Pager index={c.index} total={c.total} />
            </div>
        );
    }

    if (s.kind === "points") {
        const points = d.points.slice(s.from, s.to).map((text, i) => ({ text, n: s.from + i + 1 })).filter((p) => p.text.trim());
        const last = s.part === s.parts;
        return (
            <div style={{ width: W, height: H, display: "flex", flexDirection: "column", position: "relative", fontFamily: "Montserrat", color: INK, padding: "92px 72px" }}>
                {fox()}
                <Kicker color={accent}>{s.parts > 1 && s.part > 1 ? "À retenir (suite)" : "À retenir"}</Kicker>
                <div style={{ display: "flex", flexDirection: "column", gap: 52, marginTop: 56 }}>
                    {points.map((p) => (
                        <div key={p.n} style={{ display: "flex", gap: 42, alignItems: "flex-start" }}>
                            <div style={{ width: 96, fontFamily: "Funnel Display", fontWeight: 700, fontSize: 130, lineHeight: 0.85, color: accent, textShadow: "7px 7px 0 rgba(255,181,71,0.45)" }}>{String(p.n)}</div>
                            <div style={{ width: W - 144 - 96 - 42, display: "flex", flexWrap: "wrap", fontSize: 38, lineHeight: 1.5, fontWeight: 500 }}>
                                <Rich text={p.text} size={38} />
                            </div>
                        </div>
                    ))}
                </div>
                {last && d.quote.trim() && points.length < POINTS_PER_SLIDE && (
                    <div style={{ marginTop: 76, display: "flex", flexDirection: "column" }}>
                        <div style={{ borderLeft: `12px solid ${accent}`, paddingLeft: 42, fontFamily: "Funnel Display", fontWeight: 600, fontSize: 56, lineHeight: 1.22, display: "flex" }}>{`« ${d.quote.trim()} »`}</div>
                        <div style={{ marginTop: 22, marginLeft: 54, fontSize: 30, fontWeight: 600, color: "rgba(26,21,18,0.55)" }}>— extrait de l&apos;article</div>
                    </div>
                )}
                <Handle />
                <Pager index={c.index} total={c.total} />
            </div>
        );
    }

    // Dernière page : mots-clés, appel à lire, auteur
    return (
        <div style={{ width: W, height: H, display: "flex", flexDirection: "column", position: "relative", fontFamily: "Montserrat", color: PAPER, padding: "92px 72px" }}>
            {fox(true)}
            {d.tags.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <Kicker color={SUN}>Mots-clés</Kicker>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 40, marginRight: 60 }}>
                        {d.tags.map((t) => (
                            <div key={t} style={{ fontSize: 30, fontWeight: 700, border: "2px solid rgba(253,250,244,0.3)", borderRadius: 99, padding: "14px 30px", background: "rgba(26,21,18,0.25)" }}>
                                {t}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div style={{ width: W - 144, marginTop: d.tags.length ? 130 : 260, display: "flex", flexWrap: "wrap", fontFamily: "Funnel Display", fontWeight: 700, fontSize: 92, lineHeight: 1.04, letterSpacing: -1 }}>
                <Rich text="L'article complet est sur ==le blog==" size={92} markAs="color" />
            </div>
            <div style={{ display: "flex", marginTop: 66 }}>
                <div style={{ background: ORANGE, color: "#fff", borderRadius: 99, padding: "32px 56px", fontSize: 40, fontWeight: 700 }}>Lire l&apos;article →</div>
            </div>
            <div style={{ marginTop: 40, fontSize: 32, fontWeight: 600, color: "rgba(253,250,244,0.75)" }}>{`${d.url} · lien en bio`}</div>
            {d.author?.name && (
                <div style={{ marginTop: 78, display: "flex", alignItems: "center", gap: 30 }}>
                    {c.avatar && (
                        // eslint-disable-next-line @next/next/no-img-element -- rendu d'image côté serveur
                        <img src={dataUrl(c.avatar, "image/png")} width={104} height={104} alt="" style={{ borderRadius: 99, border: `6px solid ${ORANGE}` }} />
                    )}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 34, fontWeight: 700 }}>{`Un article de ${d.author.name}`}</span>
                        {d.author.title && <span style={{ marginTop: 6, fontSize: 28, fontWeight: 500, color: "rgba(253,250,244,0.65)" }}>{d.author.title}</span>}
                    </div>
                </div>
            )}
            <Handle dark />
            <Pager index={c.index} total={c.total} dark />
        </div>
    );
}

/** Toutes les diapositives (ou une seule), en PNG */
export async function renderCarousel(d: CarouselData, opts: { origin: string; only?: number }): Promise<Buffer[]> {
    const a = await loadAssets();
    const color = d.category?.color || ORANGE;
    const [photo, avatar, light, lined] = await Promise.all([
        loadImage(d.image, W, PHOTO_H, opts.origin),
        loadImage(d.author?.avatar ?? null, 160, 160, opts.origin),
        paperBackground(color, false),
        paperBackground(color, true),
    ]);
    const slides = slidesOf(d);
    const ctx: Omit<Ctx, "index"> = { d, total: slides.length, color, photo, avatar, fox: foxSvg(a.fox, INK), foxLight: foxSvg(a.fox, PAPER) };
    // Photo pleine taille pour la dernière page
    const fullPhoto = d.image ? await loadImage(d.image, W, H, opts.origin) : null;

    const out: Buffer[] = [];
    for (let i = 0; i < slides.length; i++) {
        if (opts.only !== undefined && opts.only !== i) continue;
        const s = slides[i];
        const bg = s.kind === "end" ? await darkBackground(color, fullPhoto) : s.kind === "intro" ? lined : light;
        const layer = Buffer.from(await new ImageResponse(<Slide s={s} c={{ ...ctx, index: i }} />, { width: W, height: H, fonts: a.fonts }).arrayBuffer());
        out.push(
            await sharp(bg)
                .composite([{ input: layer }, { input: a.grain, tile: true, blend: s.kind === "end" ? "screen" : "multiply" }])
                .png()
                .toBuffer()
        );
    }
    return out;
}
