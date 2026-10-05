"use client";

import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { AlertTriangle } from "lucide-react";
import { Callout, CALLOUT_VARIANTS, Figure, ModuleEmbed, SourceRef, type CalloutVariant, type FigureAttrs } from "../nodes";
import { MODULE_LABELS, moduleSummary } from "@/lib/modules/types";
import { MODULE_ICONS, useModules } from "./modules/ModulesTab";

/** Image dans l'éditeur : crédit visible, ou alerte si la source manque */
function ImageView({ node, selected }: ReactNodeViewProps) {
    const a = node.attrs as FigureAttrs;
    const credited = !!(a.creditAuthor && a.creditSource && a.creditLicense);
    return (
        <NodeViewWrapper className={`my-6 ${selected ? "rounded-[26px] ring-2 ring-accent ring-offset-4" : ""}`} data-drag-handle>
            <div className="relative overflow-hidden rounded-[24px] bg-paper2">
                {/* eslint-disable-next-line @next/next/no-img-element -- aperçu dans l'éditeur */}
                <img src={a.src} alt={a.alt} className="block w-full" />
                {credited ? (
                    <span className="credit">
                        {a.creditAuthor} · {a.creditSource}
                        <span className="credit-lic">· {a.creditLicense}</span>
                    </span>
                ) : (
                    <span className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-2xl bg-red-600 px-3 py-2 text-xs font-semibold text-white">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Source manquante : clique sur l&apos;image pour la compléter, ou remplace-la par une image de la médiathèque.
                    </span>
                )}
            </div>
            {a.caption && <p className="mt-2 text-center text-[13px] text-ink/50">{a.caption}</p>}
            {!a.alt && <p className="mt-1 text-center text-[11px] font-semibold text-amber-700">Texte alternatif manquant</p>}
        </NodeViewWrapper>
    );
}

/** Encadré dans l'éditeur : en-tête non modifiable avec choix du type */
function CalloutView({ node, updateAttributes }: ReactNodeViewProps) {
    const variant = node.attrs.variant as CalloutVariant;
    return (
        <NodeViewWrapper as="aside" className={`wk-callout wk-callout--${variant} wk-callout--editing`}>
            <select
                contentEditable={false}
                value={variant}
                onChange={(e) => updateAttributes({ variant: e.target.value })}
                className="wk-callout-select"
                aria-label="Type d'encadré"
            >
                {CALLOUT_VARIANTS.map((v) => (
                    <option key={v.id} value={v.id}>
                        {v.label}
                    </option>
                ))}
            </select>
            <NodeViewContent className="wk-callout-body" />
        </NodeViewWrapper>
    );
}

/** Les nœuds maison, avec leur vue d'édition */
export const EditorFigure = Figure.extend({ addNodeView: () => ReactNodeViewRenderer(ImageView) });
export const EditorCallout = Callout.extend({ addNodeView: () => ReactNodeViewRenderer(CalloutView) });

/* ─── Modules (lot 4) ─── */

/** Bloc « module » dans l'éditeur : une carte qui dit quel module s'affichera ici */
function ModuleEmbedView({ node, selected }: ReactNodeViewProps) {
    const modules = useModules();
    const m = modules.find((x) => x.id === node.attrs.moduleId);
    const Icon = m ? MODULE_ICONS[m.type] : AlertTriangle;
    return (
        <NodeViewWrapper className={`my-5 flex items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3 ${m ? "border-accent/40 bg-accent/5" : "border-red-300 bg-red-50"} ${selected ? "ring-2 ring-accent ring-offset-2" : ""}`} data-drag-handle contentEditable={false}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-accentdark">
                <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-accentdark">{m ? MODULE_LABELS[m.type].label : "Module retiré"}</span>
                <span className="block truncate text-sm">{m ? moduleSummary(m) : "Ce module n'existe plus : supprime ce bloc."}</span>
            </span>
        </NodeViewWrapper>
    );
}

/** Appel de source « [n] », numéroté comme dans l'article */
function SourceRefView({ node, selected }: ReactNodeViewProps) {
    const modules = useModules();
    const items = modules.flatMap((m) => (m.type === "sources" ? m.data.items : []));
    const i = items.findIndex((s) => s.id === node.attrs.sourceId);
    return (
        <NodeViewWrapper as="sup" className={`wk-cite cursor-default rounded px-0.5 font-semibold ${i < 0 ? "bg-red-100 text-red-700" : "text-accentdark"} ${selected ? "bg-accent/15" : ""}`} title={i < 0 ? "Source retirée" : items[i].title}>
            [{i < 0 ? "?" : i + 1}]
        </NodeViewWrapper>
    );
}

export const EditorModuleEmbed = ModuleEmbed.extend({ addNodeView: () => ReactNodeViewRenderer(ModuleEmbedView) });
export const EditorSourceRef = SourceRef.extend({ addNodeView: () => ReactNodeViewRenderer(SourceRefView, { as: "sup" }) });
