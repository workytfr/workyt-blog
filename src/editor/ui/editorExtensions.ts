"use client";

import { Extension, InputRule, type AnyExtension } from "@tiptap/core";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { faviconUrl, getEditorAffiliates, linkDomain } from "@/lib/linkIcon";
import { schemaExtensions } from "../extensions";
import { EditorCallout, EditorFigure, EditorModuleEmbed, EditorSourceRef } from "./nodeViews";
import { SlashCommand } from "./slash";
import { SuggestMode } from "./suggestMode";

/** Saisie « $x^2$ » : devient une formule dans la phrase (« $$…$$ » reste géré par Mathematics) */
const DollarMath = Extension.create({
    name: "dollarMath",
    addInputRules() {
        return [
            new InputRule({
                find: /(?:^|[^$])(\$([^$\n]+)\$)$/,
                handler: ({ state, range, match }) => {
                    const type = state.schema.nodes.inlineMath;
                    const latex = match[2]?.trim();
                    if (!type || !latex) return null;
                    const start = range.from + match[0].length - match[1].length;
                    state.tr.replaceWith(start, range.to, type.create({ latex }));
                },
            }),
        ];
    },
});

/** Logo du site au bout de chaque lien, comme sur l'article publié (affichage seulement, rien n'est enregistré) */
function linkIconDecorations(doc: PMNode): DecorationSet {
    const decos: Decoration[] = [];
    let open: { href: string; end: number } | null = null;
    const close = () => {
        if (!open) return;
        const domain = linkDomain(open.href, getEditorAffiliates());
        if (domain) {
            const src = faviconUrl(domain);
            decos.push(
                Decoration.widget(
                    open.end,
                    () => {
                        const img = document.createElement("img");
                        img.className = "wk-fav";
                        img.src = src;
                        img.alt = "";
                        img.width = img.height = 16;
                        return img;
                    },
                    { side: -1, key: `fav-${src}`, ignoreSelection: true },
                ),
            );
        }
        open = null;
    };
    doc.descendants((node, pos) => {
        if (!node.isInline) {
            close();
            return true;
        }
        const href = node.marks.find((m) => m.type.name === "link")?.attrs.href as string | undefined;
        if (href && open?.href === href && open.end === pos) open.end = pos + node.nodeSize;
        else {
            close();
            if (href) open = { href, end: pos + node.nodeSize };
        }
        return false;
    });
    close();
    return DecorationSet.create(doc, decos);
}

const linkIconsKey = new PluginKey<DecorationSet>("linkIcons");

const LinkIcons = Extension.create({
    name: "linkIcons",
    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: linkIconsKey,
                state: {
                    init: (_, { doc }) => linkIconDecorations(doc),
                    apply: (tr, old) => (tr.docChanged || tr.getMeta(linkIconsKey) ? linkIconDecorations(tr.doc) : old),
                },
                props: { decorations: (state) => linkIconsKey.getState(state) },
            }),
        ];
    },
});

/** Extensions de l'éditeur : le schéma commun + vues d'édition, menu « / », aide à la saisie */
export function editorExtensions(): AnyExtension[] {
    const base = schemaExtensions().filter((e) => !["image", "callout", "moduleEmbed", "sourceRef"].includes(e.name));
    return [
        ...base,
        EditorFigure,
        EditorCallout,
        EditorModuleEmbed,
        EditorSourceRef,
        SlashCommand,
        DollarMath,
        LinkIcons,
        SuggestMode,
        CharacterCount,
        Placeholder.configure({
            includeChildren: true,
            placeholder: ({ node, editor, pos }) => {
                if (node.type.name === "heading") return "Titre de la partie";
                // Appelé pendant l'application d'une modification : editor.state est encore l'ancien
                // document, la position peut ne pas y exister (contenu ajouté à la fin)
                const doc = editor.state.doc;
                if (pos <= doc.content.size && doc.resolve(pos).parent.type.name === "callout") return "Contenu de l'encadré…";
                return "Écris, ou tape « / » pour insérer un bloc";
            },
        }),
    ];
}
