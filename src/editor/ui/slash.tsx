"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Extension, type Editor, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import {
    AlertTriangle,
    Clapperboard,
    Instagram,
    Music,
    Video,
    BookOpen,
    CheckSquare,
    Code2,
    Heading2,
    Heading3,
    Heading4,
    Image as ImageIcon,
    Info,
    Lightbulb,
    List,
    ListOrdered,
    Minus,
    Pilcrow,
    Quote,
    Sigma,
    SquareFunction,
    Star,
    Table as TableIcon,
    Youtube,
    type LucideIcon,
} from "lucide-react";
import { EMBED_PROVIDERS, parseEmbed, type EmbedProvider } from "@/lib/embeds";
import type { CalloutVariant } from "../nodes";

/**
 * Menu « / » : taper « / » ouvre la liste des blocs à insérer ; on filtre en
 * tapant (« /def » → Définition), Entrée pour valider. Comme Gutenberg.
 */
export interface BlockItem {
    title: string;
    hint: string;
    icon: LucideIcon;
    group: "Texte" | "Encadrés" | "Médias" | "Structure";
    keywords: string;
    run: (editor: Editor, range?: Range) => void;
}

const chain = (editor: Editor, range?: Range) => (range ? editor.chain().focus().deleteRange(range) : editor.chain().focus());
const callout = (variant: CalloutVariant) => (editor: Editor, range?: Range) => chain(editor, range).setParagraph().setCallout(variant).run();
/** Contenu d'une autre plateforme : on colle le lien, il est vérifié avant d'être inséré */
const embed = (provider: EmbedProvider) => (editor: Editor, range?: Range) => {
    const { label, hint } = EMBED_PROVIDERS[provider];
    // La commande tapée (« /spotify ») disparaît dans tous les cas, lien accepté ou non
    if (range) editor.chain().focus().deleteRange(range).run();
    const url = window.prompt(`Lien ${label} (${hint.toLowerCase()}) :`);
    if (!url) return;
    const found = parseEmbed(url);
    if (!found || found.provider !== provider) {
        window.alert(`Ce lien n'est pas reconnu comme un contenu ${label}. Copie le lien depuis le bouton « Partager » de ${label}.`);
        return;
    }
    editor.chain().focus().insertContent({ type: "socialEmbed", attrs: { provider, url: found.url } }).run();
};

/** Demande l'image à l'éditeur parent (il ouvre la médiathèque) */
export const PICK_IMAGE_EVENT = "wk-editor:pick-image";

export const BLOCK_ITEMS: BlockItem[] = [
    { title: "Texte", hint: "Un paragraphe", icon: Pilcrow, group: "Texte", keywords: "paragraphe texte p", run: (e, r) => chain(e, r).setParagraph().run() },
    { title: "Titre", hint: "Grande partie", icon: Heading2, group: "Texte", keywords: "titre h2 partie", run: (e, r) => chain(e, r).setHeading({ level: 2 }).run() },
    { title: "Sous-titre", hint: "Sous-partie", icon: Heading3, group: "Texte", keywords: "sous titre h3", run: (e, r) => chain(e, r).setHeading({ level: 3 }).run() },
    { title: "Petit titre", hint: "Niveau 4", icon: Heading4, group: "Texte", keywords: "h4 petit titre", run: (e, r) => chain(e, r).setHeading({ level: 4 }).run() },
    { title: "Liste à puces", hint: "Tab pour un sous-niveau", icon: List, group: "Texte", keywords: "liste puces ul", run: (e, r) => chain(e, r).toggleBulletList().run() },
    { title: "Liste numérotée", hint: "Des étapes dans l'ordre", icon: ListOrdered, group: "Texte", keywords: "liste numero ol etapes", run: (e, r) => chain(e, r).toggleOrderedList().run() },
    { title: "Liste à cocher", hint: "Cases à cocher", icon: CheckSquare, group: "Texte", keywords: "taches cases checklist", run: (e, r) => chain(e, r).toggleTaskList().run() },
    { title: "Citation", hint: "Une phrase mise en avant", icon: Quote, group: "Texte", keywords: "citation quote", run: (e, r) => chain(e, r).toggleBlockquote().run() },

    { title: "Bon à savoir", hint: "Encadré bleu", icon: Info, group: "Encadrés", keywords: "info encadre savoir", run: callout("info") },
    { title: "Astuce", hint: "Encadré vert", icon: Lightbulb, group: "Encadrés", keywords: "astuce conseil encadre", run: callout("astuce") },
    { title: "Attention", hint: "Un piège à éviter", icon: AlertTriangle, group: "Encadrés", keywords: "attention piege erreur", run: callout("attention") },
    { title: "Définition", hint: "Le sens d'un mot", icon: BookOpen, group: "Encadrés", keywords: "definition mot sens", run: callout("definition") },
    { title: "Exemple", hint: "Un cas concret", icon: Star, group: "Encadrés", keywords: "exemple cas", run: callout("exemple") },
    { title: "À retenir", hint: "L'essentiel, en sombre", icon: Star, group: "Encadrés", keywords: "retenir essentiel resume", run: callout("retenir") },

    { title: "Image", hint: "Depuis la médiathèque (avec sa source)", icon: ImageIcon, group: "Médias", keywords: "image photo", run: (e, r) => {
        if (r) e.chain().focus().deleteRange(r).run();
        window.dispatchEvent(new Event(PICK_IMAGE_EVENT));
    } },
    { title: "Vidéo YouTube", hint: "Coller le lien de la vidéo", icon: Youtube, group: "Médias", keywords: "video youtube", run: (e, r) => {
        const src = window.prompt("Lien de la vidéo YouTube :");
        if (src) chain(e, r).setYoutubeVideo({ src }).run();
    } },
    { title: "Spotify", hint: EMBED_PROVIDERS.spotify.hint, icon: Music, group: "Médias", keywords: "spotify musique podcast playlist album son", run: embed("spotify") },
    { title: "Dailymotion", hint: EMBED_PROVIDERS.dailymotion.hint, icon: Clapperboard, group: "Médias", keywords: "dailymotion video", run: embed("dailymotion") },
    { title: "Instagram", hint: EMBED_PROVIDERS.instagram.hint, icon: Instagram, group: "Médias", keywords: "instagram post reel photo reseau", run: embed("instagram") },
    { title: "TikTok", hint: EMBED_PROVIDERS.tiktok.hint, icon: Video, group: "Médias", keywords: "tiktok video reseau", run: embed("tiktok") },
    { title: "Formule", hint: "LaTeX dans la phrase : x², ½…", icon: Sigma, group: "Médias", keywords: "formule latex math", run: (e, r) => {
        const latex = window.prompt("Formule LaTeX (ex. \\frac{1}{2}) :");
        if (latex) chain(e, r).insertInlineMath({ latex }).run();
    } },
    { title: "Formule centrée", hint: "Une équation sur sa ligne", icon: SquareFunction, group: "Médias", keywords: "equation formule bloc latex", run: (e, r) => {
        const latex = window.prompt("Formule LaTeX :");
        if (latex) chain(e, r).insertBlockMath({ latex }).run();
    } },

    { title: "Tableau", hint: "3 × 3 avec en-tête", icon: TableIcon, group: "Structure", keywords: "tableau table", run: (e, r) => chain(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { title: "Code", hint: "Bloc de code", icon: Code2, group: "Structure", keywords: "code programme", run: (e, r) => chain(e, r).toggleCodeBlock().run() },
    { title: "Séparateur", hint: "Une ligne horizontale", icon: Minus, group: "Structure", keywords: "separateur ligne hr", run: (e, r) => chain(e, r).setHorizontalRule().run() },
];

// « definition » trouve « Définition » : comparaison sans accents
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function filterBlocks(query: string): BlockItem[] {
    const q = norm(query.trim());
    return q ? BLOCK_ITEMS.filter((it) => norm(`${it.title} ${it.keywords}`).includes(q)) : BLOCK_ITEMS;
}

interface MenuHandle {
    onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const BlockMenu = forwardRef<MenuHandle, { items: BlockItem[]; command: (item: BlockItem) => void }>(function BlockMenu({ items, command }, ref) {
    const [selected, setSelected] = useState(0);
    const [prev, setPrev] = useState(items);
    if (items !== prev) {
        setPrev(items);
        setSelected(0);
    }
    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }) => {
            if (!items.length) return false;
            if (event.key === "ArrowDown") return setSelected((i) => (i + 1) % items.length), true;
            if (event.key === "ArrowUp") return setSelected((i) => (i - 1 + items.length) % items.length), true;
            if (event.key === "Enter" || event.key === "Tab") return command(items[selected]), true;
            return false;
        },
    }));
    if (!items.length) return <div className="w-72 rounded-2xl border border-ink/10 bg-white p-3 text-sm text-ink/50 shadow-xl">Aucun bloc ne correspond</div>;
    return (
        <div className="max-h-80 w-72 overflow-y-auto rounded-2xl border border-ink/10 bg-white p-1.5 shadow-[0_18px_44px_rgba(26,21,18,.16)]" role="listbox">
            {items.map((it, i) => {
                const Icon = it.icon;
                const showGroup = i === 0 || items[i - 1].group !== it.group;
                return (
                    <div key={it.title}>
                        {showGroup && <div className="eyebrow px-2 pb-1 pt-2">{it.group}</div>}
                        <button
                            type="button"
                            role="option"
                            aria-selected={i === selected}
                            onMouseEnter={() => setSelected(i)}
                            onClick={() => command(it)}
                            className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left ${i === selected ? "bg-paper2" : ""}`}
                        >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ink/10 bg-white">
                                <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold">{it.title}</span>
                                <span className="block truncate text-xs text-ink/50">{it.hint}</span>
                            </span>
                        </button>
                    </div>
                );
            })}
        </div>
    );
});

/** Extension « / » branchée sur @tiptap/suggestion */
export const SlashCommand = Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
        return [
            Suggestion<BlockItem>({
                editor: this.editor,
                char: "/",
                startOfLine: false,
                allowSpaces: false,
                items: ({ query }) => filterBlocks(query),
                command: ({ editor, range, props }) => props.run(editor, range),
                render: () => {
                    let renderer: ReactRenderer<MenuHandle> | null = null;
                    let host: HTMLDivElement | null = null;
                    const place = (props: SuggestionProps<BlockItem>) => {
                        const rect = props.clientRect?.();
                        if (!rect || !host) return;
                        host.style.left = `${rect.left}px`;
                        host.style.top = `${rect.bottom + 8}px`;
                    };
                    return {
                        onStart: (props) => {
                            host = document.createElement("div");
                            host.style.position = "fixed";
                            host.style.zIndex = "60";
                            document.body.appendChild(host);
                            renderer = new ReactRenderer(BlockMenu, { props: { items: props.items, command: props.command }, editor: props.editor });
                            host.appendChild(renderer.element);
                            place(props);
                        },
                        onUpdate: (props) => {
                            renderer?.updateProps({ items: props.items, command: props.command });
                            place(props);
                        },
                        onKeyDown: (props) => {
                            if (props.event.key === "Escape") {
                                host?.remove();
                                return true;
                            }
                            return renderer?.ref?.onKeyDown(props) ?? false;
                        },
                        onExit: () => {
                            renderer?.destroy();
                            host?.remove();
                            renderer = null;
                            host = null;
                        },
                    };
                },
            }),
        ];
    },
});
