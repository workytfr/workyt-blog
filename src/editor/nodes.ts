import { Node, mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";

/**
 * Nœuds maison de l'éditeur, communs au navigateur et au serveur (le HTML
 * public est généré à partir du même schéma).
 */

/* ─── Image avec crédit et légende ─── */

export interface FigureAttrs {
    src: string;
    alt: string;
    width: number | null;
    height: number | null;
    mediaId: string | null;
    caption: string;
    creditAuthor: string;
    creditSource: string;
    creditLicense: string;
    creditUrl: string;
}

const attr = (name: string, fallback: unknown = null) => ({
    default: fallback,
    // Les attributs sont lus depuis la structure <figure> par parseHTML ci-dessous
    parseHTML: () => fallback,
    renderHTML: () => ({}),
    keepOnSplit: false,
    _name: name,
});

/**
 * Image d'article. Rendu public :
 * <figure class="wk-figure"><div class="wk-figure-media"><img …><span class="credit">…</span></div><figcaption>…</figcaption></figure>
 * Une image sans crédit (collée depuis le web, reprise de WordPress) est
 * signalée dans l'éditeur et bloque la soumission (lot 3).
 */
export const Figure = Image.extend({
    name: "image",
    draggable: true,

    addAttributes() {
        return {
            src: { default: "" },
            alt: { default: "" },
            width: { default: null },
            height: { default: null },
            mediaId: attr("mediaId"),
            caption: attr("caption", ""),
            creditAuthor: attr("creditAuthor", ""),
            creditSource: attr("creditSource", ""),
            creditLicense: attr("creditLicense", ""),
            creditUrl: attr("creditUrl", ""),
        };
    },

    parseHTML() {
        return [
            {
                tag: "figure.wk-figure",
                getAttrs: (el) => {
                    const fig = el as HTMLElement;
                    const img = fig.querySelector("img");
                    if (!img) return false;
                    const credit = fig.querySelector(".credit");
                    return {
                        src: img.getAttribute("src") || "",
                        alt: img.getAttribute("alt") || "",
                        width: Number(img.getAttribute("width")) || null,
                        height: Number(img.getAttribute("height")) || null,
                        mediaId: fig.getAttribute("data-media-id"),
                        caption: fig.querySelector("figcaption")?.textContent || "",
                        creditAuthor: credit?.getAttribute("data-author") || "",
                        creditSource: credit?.getAttribute("data-source") || "",
                        creditLicense: credit?.getAttribute("data-license") || "",
                        creditUrl: credit?.getAttribute("data-url") || "",
                    };
                },
            },
            // Image collée depuis le web ou un document : sans crédit, à compléter
            {
                tag: "img[src]",
                getAttrs: (el) => ({ src: (el as HTMLElement).getAttribute("src") || "", alt: (el as HTMLElement).getAttribute("alt") || "" }),
            },
        ];
    },

    renderHTML({ node }) {
        const a = node.attrs as FigureAttrs;
        const label = [a.creditAuthor, a.creditSource].filter(Boolean).join(" · ");
        const credit = label
            ? [
                  "span",
                  { class: "credit", "data-author": a.creditAuthor, "data-source": a.creditSource, "data-license": a.creditLicense, "data-url": a.creditUrl },
                  label,
                  ...(a.creditLicense ? [["span", { class: "credit-lic" }, ` · ${a.creditLicense}`]] : []),
              ]
            : null;
        const img = ["img", { src: a.src, alt: a.alt, ...(a.width ? { width: String(a.width) } : {}), ...(a.height ? { height: String(a.height) } : {}) }];
        const media = credit ? ["div", { class: "wk-figure-media" }, img, credit] : ["div", { class: "wk-figure-media" }, img];
        const children: unknown[] = [media];
        if (a.caption) children.push(["figcaption", {}, a.caption]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DOMOutputSpec imbriqué
        return ["figure", { class: "wk-figure", ...(a.mediaId ? { "data-media-id": a.mediaId } : {}) }, ...(children as any[])] as any;
    },
}).configure({ inline: false, allowBase64: false });

/* ─── Encadrés ─── */

export const CALLOUT_VARIANTS = [
    { id: "info", label: "Bon à savoir" },
    { id: "astuce", label: "Astuce" },
    { id: "attention", label: "Attention" },
    { id: "definition", label: "Définition" },
    { id: "exemple", label: "Exemple" },
    { id: "retenir", label: "À retenir" },
] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number]["id"];

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        callout: {
            setCallout: (variant: CalloutVariant) => ReturnType;
            updateCalloutVariant: (variant: CalloutVariant) => ReturnType;
        };
    }
}

/** Encadré : un bloc coloré qui contient d'autres blocs (paragraphes, listes…) */
export const Callout = Node.create({
    name: "callout",
    group: "block",
    content: "block+",
    defining: true,

    addAttributes() {
        return {
            variant: {
                default: "info",
                parseHTML: (el) => el.getAttribute("data-variant") || "info",
                renderHTML: (a) => ({ "data-variant": a.variant }),
            },
        };
    },

    parseHTML() {
        return [{ tag: "aside[data-variant]" }];
    },

    renderHTML({ node, HTMLAttributes }) {
        return ["aside", mergeAttributes(HTMLAttributes, { class: `wk-callout wk-callout--${node.attrs.variant}` }), 0];
    },

    addCommands() {
        return {
            setCallout:
                (variant) =>
                ({ commands }) =>
                    commands.wrapIn(this.name, { variant }),
            updateCalloutVariant:
                (variant) =>
                ({ commands }) =>
                    commands.updateAttributes(this.name, { variant }),
        };
    },
});

/* ─── Emplacement d'un module (lot 4) ─── */

/**
 * Bloc « module » : affiche un module de l'article (recette, avis…) à cet
 * endroit du texte. Les modules non placés s'affichent à la fin.
 */
export const ModuleEmbed = Node.create({
    name: "moduleEmbed",
    group: "block",
    atom: true,
    draggable: true,
    selectable: true,

    addAttributes() {
        return {
            moduleId: {
                default: "",
                parseHTML: (el) => el.getAttribute("data-module") || "",
                renderHTML: (a) => ({ "data-module": a.moduleId }),
            },
        };
    },

    parseHTML() {
        return [{ tag: "div[data-module]" }];
    },

    renderHTML({ HTMLAttributes }) {
        return ["div", mergeAttributes(HTMLAttributes, { class: "wk-module-slot" })];
    },
});

/**
 * Appel de source « [1] » dans le texte : renvoie à une référence du module
 * Sources (numérotée à l'affichage, dans l'ordre de la liste).
 */
export const SourceRef = Node.create({
    name: "sourceRef",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,

    addAttributes() {
        return {
            sourceId: {
                default: "",
                parseHTML: (el) => el.getAttribute("data-source") || "",
                renderHTML: (a) => ({ "data-source": a.sourceId }),
            },
        };
    },

    parseHTML() {
        return [{ tag: "sup[data-source]" }];
    },

    renderHTML({ HTMLAttributes }) {
        return ["sup", mergeAttributes(HTMLAttributes, { class: "wk-cite" })];
    },
});
