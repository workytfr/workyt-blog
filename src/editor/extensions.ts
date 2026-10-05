import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import { mergeAttributes } from "@tiptap/core";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import Youtube from "@tiptap/extension-youtube";
import { Mathematics } from "@tiptap/extension-mathematics";
import { Callout, Figure, ModuleEmbed, SourceRef } from "./nodes";
import { CommentMark, SuggestionDelete, SuggestionInsert } from "./marks";

/**
 * Titres H2 à H4 : le texte est enveloppé dans <span class="wk-h">, pour le
 * style « cahier » des titres (surligneur sur le H2, souligné à la main sur
 * le H3). Le document enregistré (JSON) ne change pas.
 */
const WkHeading = Heading.extend({
    renderHTML({ node, HTMLAttributes }) {
        const level = this.options.levels.includes(node.attrs.level) ? node.attrs.level : this.options.levels[0];
        return [`h${level}`, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), ["span", { class: "wk-h" }, 0]];
    },
});

/**
 * Schéma du document d'un article : le même dans l'éditeur (navigateur) et
 * pour produire le HTML public (serveur). Toute modification ici change ce
 * qui est enregistré : ajouter, ne jamais renommer un nœud existant.
 */
export function schemaExtensions(): AnyExtension[] {
    return [
        StarterKit.configure({
            // Remplacé par WkHeading ci-dessous (texte enveloppé pour le style des titres)
            heading: false,
            link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"], HTMLAttributes: { rel: null, target: null } },
            codeBlock: { HTMLAttributes: { class: "wk-code" } },
        }),
        WkHeading.configure({ levels: [2, 3, 4] }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Highlight,
        TaskList,
        TaskItem.configure({ nested: true }),
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
        Youtube.configure({ nocookie: true, width: 0, height: 0, HTMLAttributes: { class: "wk-video" } }),
        Mathematics,
        Figure,
        Callout,
        ModuleEmbed,
        SourceRef,
        SuggestionInsert,
        SuggestionDelete,
        CommentMark,
    ];
}
