"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd, BetweenVerticalStart, Minus, PanelLeft, PanelTop, TableCellsMerge, TableCellsSplit, Trash2 } from "lucide-react";

/**
 * Barre d'outils d'un tableau, au-dessus du tableau dès que le curseur y est :
 * ajouter / retirer des lignes et des colonnes, ligne ou colonne d'en-tête,
 * fusionner / scinder des cases, supprimer le tableau.
 */

/** Le <table> où se trouve le curseur, pour placer la barre au-dessus */
function currentTable(editor: Editor): HTMLElement | null {
    const { node } = editor.view.domAtPos(editor.state.selection.from);
    const el = node instanceof HTMLElement ? node : node.parentElement;
    return el?.closest("table") ?? null;
}

function Btn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={`grid h-8 w-8 place-items-center rounded-lg transition disabled:opacity-30 ${danger ? "text-white/70 hover:bg-red-500/80 hover:text-white" : "text-white/80 hover:bg-white/15 hover:text-white"}`}
        >
            {children}
        </button>
    );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-0.5" role="group" aria-label={label}>
            <span className="px-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">{label}</span>
            {children}
        </div>
    );
}

export default function TableMenu({ editor }: { editor: Editor }) {
    const s = useEditorState({
        editor,
        selector: ({ editor: e }) => ({
            addRow: e.can().addRowAfter(),
            addCol: e.can().addColumnAfter(),
            delRow: e.can().deleteRow(),
            delCol: e.can().deleteColumn(),
            merge: e.can().mergeCells(),
            split: e.can().splitCell(),
            headerRow: e.isActive("tableHeader") && e.can().toggleHeaderRow(),
        }),
    });
    const run = (fn: (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => fn(editor.chain().focus()).run();

    const sep = <span className="mx-1 h-5 w-px bg-white/15" aria-hidden />;

    return (
        <BubbleMenu
            editor={editor}
            pluginKey="tableMenu"
            shouldShow={({ editor: e }) => e.isEditable && e.isActive("table")}
            getReferencedVirtualElement={() => {
                const table = currentTable(editor);
                return table ? { getBoundingClientRect: () => table.getBoundingClientRect(), getClientRects: () => table.getClientRects() } : null;
            }}
            options={{ placement: "top-start", offset: 10 }}
        >
            <div className="flex flex-wrap items-center rounded-2xl bg-ink px-1.5 py-1 shadow-[0_12px_30px_rgba(26,21,18,.25)]">
                <Group label="Ligne">
                    <Btn label="Ajouter une ligne au-dessus" disabled={!s.addRow} onClick={() => run((c) => c.addRowBefore())}>
                        <BetweenHorizontalStart className="h-4 w-4" />
                    </Btn>
                    <Btn label="Ajouter une ligne en dessous" disabled={!s.addRow} onClick={() => run((c) => c.addRowAfter())}>
                        <BetweenHorizontalEnd className="h-4 w-4" />
                    </Btn>
                    <Btn label="Supprimer la ligne" danger disabled={!s.delRow} onClick={() => run((c) => c.deleteRow())}>
                        <Minus className="h-4 w-4" />
                    </Btn>
                </Group>
                {sep}
                <Group label="Colonne">
                    <Btn label="Ajouter une colonne à gauche" disabled={!s.addCol} onClick={() => run((c) => c.addColumnBefore())}>
                        <BetweenVerticalStart className="h-4 w-4" />
                    </Btn>
                    <Btn label="Ajouter une colonne à droite" disabled={!s.addCol} onClick={() => run((c) => c.addColumnAfter())}>
                        <BetweenVerticalEnd className="h-4 w-4" />
                    </Btn>
                    <Btn label="Supprimer la colonne" danger disabled={!s.delCol} onClick={() => run((c) => c.deleteColumn())}>
                        <Minus className="h-4 w-4" />
                    </Btn>
                </Group>
                {sep}
                <Btn label="Ligne d'en-tête (activer / désactiver)" onClick={() => run((c) => c.toggleHeaderRow())}>
                    <PanelTop className="h-4 w-4" />
                </Btn>
                <Btn label="Colonne d'en-tête (activer / désactiver)" onClick={() => run((c) => c.toggleHeaderColumn())}>
                    <PanelLeft className="h-4 w-4" />
                </Btn>
                <Btn label="Fusionner les cases sélectionnées" disabled={!s.merge} onClick={() => run((c) => c.mergeCells())}>
                    <TableCellsMerge className="h-4 w-4" />
                </Btn>
                <Btn label="Scinder la case" disabled={!s.split} onClick={() => run((c) => c.splitCell())}>
                    <TableCellsSplit className="h-4 w-4" />
                </Btn>
                {sep}
                <Btn
                    label="Supprimer le tableau"
                    danger
                    onClick={() => {
                        if (window.confirm("Supprimer tout le tableau ?")) run((c) => c.deleteTable());
                    }}
                >
                    <Trash2 className="h-4 w-4" />
                </Btn>
            </div>
        </BubbleMenu>
    );
}
