/**
 * Logo du site visé par un lien, affiché à droite du texte du lien : le
 * lecteur voit la source avant de cliquer. Les logos passent par le blog
 * (/api/favicon/…) : le navigateur du lecteur ne contacte aucun service tiers.
 */

const WORKYT = /(^|\.)workyt\.fr$/i;
const DOMAIN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Lien affilié géré /go/<nom>/ → domaine du marchand (connu du gestionnaire de liens) */
export type AffiliateDomains = Record<string, string>;

export const affiliateName = (href: string) => href.match(/^\/go\/([a-z0-9-]+)\/?$/)?.[1] ?? null;

/** Domaine d'une adresse http(s), sans « www. » */
export function hostOf(url: string): string | null {
    try {
        const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
        return isDomain(host) ? host : null;
    } catch {
        return null;
    }
}

/**
 * Domaine d'un lien (sans « www. »), « workyt.fr » pour un lien interne, null
 * si pas de logo (mailto, ancre). Lien affilié : le domaine du marchand.
 */
export function linkDomain(href: string, affiliates: AffiliateDomains = {}): string | null {
    const aff = affiliateName(href);
    if (aff) return affiliates[aff] ?? null;
    if (/^\/(?!\/)/.test(href)) return "workyt.fr";
    if (!/^https?:\/\//i.test(href)) return null;
    return hostOf(href);
}

export function isDomain(d: string): boolean {
    return DOMAIN.test(d);
}

export function faviconUrl(domain: string): string {
    return WORKYT.test(domain) ? "/icon.svg" : `/api/favicon/${domain}/`;
}

/**
 * Ajoute le logo du site au bout de chaque lien du HTML (déjà assaini) d'un
 * article. Lien affilié : logo du marchand, puis la mention « sponsorisé ».
 */
export function addLinkIcons(html: string, affiliates: AffiliateDomains = {}): string {
    return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/g, (whole, attrs: string, inner: string) => {
        if (/<(img|svg)\b/i.test(inner) || !inner.replace(/<[^>]+>/g, "").trim()) return whole;
        const href = attrs.match(/\bhref="([^"]*)"/)?.[1]?.replace(/&amp;/g, "&");
        const domain = href ? linkDomain(href, affiliates) : null;
        const icon = domain ? `<img class="wk-fav" src="${faviconUrl(domain)}" alt="" width="16" height="16" loading="lazy" decoding="async">` : "";
        if (href && affiliateName(href)) return `<a${attrs}>${inner}${icon}<span class="wk-aff">sponsorisé</span></a>`;
        if (!domain) return whole;
        return `<a${attrs}>${inner}${icon}</a>`;
    });
}

/** Éditeur : domaines des liens affiliés, chargés une fois (voir BlogEditor) */
let editorAffiliates: AffiliateDomains = {};
export const setEditorAffiliates = (map: AffiliateDomains) => {
    editorAffiliates = map;
};
export const getEditorAffiliates = () => editorAffiliates;
