/**
 * Contenus intégrés d'autres plateformes : Spotify, Dailymotion, Instagram,
 * TikTok. Un lien collé par le rédacteur → l'adresse du lecteur officiel.
 * Partagé par l'éditeur (insertion), l'import WordPress et l'affichage
 * (le lecteur n'est chargé qu'au clic : ces plateformes déposent des cookies).
 *
 * YouTube a son propre bloc (mode « sans cookie », chargé directement).
 */

export const EMBED_PROVIDERS = {
    spotify: { label: "Spotify", hint: "Un titre, un album, une playlist ou un podcast" },
    dailymotion: { label: "Dailymotion", hint: "Une vidéo Dailymotion" },
    instagram: { label: "Instagram", hint: "Une publication ou un reel" },
    tiktok: { label: "TikTok", hint: "Une vidéo TikTok (lien complet)" },
} as const;

export type EmbedProvider = keyof typeof EMBED_PROVIDERS;

export interface Embed {
    provider: EmbedProvider;
    /** Lien d'origine (gardé dans l'article : lien de secours si le lecteur ne charge pas) */
    url: string;
    /** Adresse du lecteur officiel */
    embedUrl: string;
    /** Hauteur fixe en px, ou format 16/9 (vidéo) */
    height?: number;
    ratio?: "16/9";
    /** Largeur maximale du lecteur (formats verticaux) */
    maxWidth?: number;
}

export const isEmbedProvider = (v: unknown): v is EmbedProvider => typeof v === "string" && v in EMBED_PROVIDERS;

/** Lien collé → lecteur, ou null si le lien n'est pas reconnu */
export function parseEmbed(raw: string): Embed | null {
    const url = raw.trim();
    if (!/^https?:\/\//i.test(url)) return null;
    let m: RegExpExecArray | null;

    if ((m = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]{10,40})/i.exec(url))) {
        const kind = m[1].toLowerCase();
        return { provider: "spotify", url, embedUrl: `https://open.spotify.com/embed/${kind}/${m[2]}`, height: kind === "track" || kind === "episode" ? 152 : 352 };
    }
    if ((m = /^https?:\/\/(?:www\.)?dailymotion\.com\/(?:embed\/)?video\/([a-z0-9]+)/i.exec(url)) || (m = /^https?:\/\/dai\.ly\/([a-z0-9]+)/i.exec(url))) {
        return { provider: "dailymotion", url, embedUrl: `https://www.dailymotion.com/embed/video/${m[1]}`, ratio: "16/9" };
    }
    if ((m = /^https?:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]{5,40})/i.exec(url))) {
        const kind = m[1].toLowerCase() === "reel" ? "reel" : "p";
        return { provider: "instagram", url, embedUrl: `https://www.instagram.com/${kind}/${m[2]}/embed`, height: 680, maxWidth: 540 };
    }
    if ((m = /^https?:\/\/(?:www\.)?tiktok\.com\/(?:@[\w.-]+\/video\/|embed\/(?:v2\/)?)(\d{8,25})/i.exec(url))) {
        return { provider: "tiktok", url, embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}`, height: 740, maxWidth: 340 };
    }
    return null;
}
