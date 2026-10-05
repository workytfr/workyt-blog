"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/render";

/**
 * Sommaire collant de la colonne de droite (ordinateur), sous les widgets : il
 * apparaît dès que la carte « Au sommaire » du haut de l'article sort de
 * l'écran, se colle en haut une fois les widgets passés, et suit la lecture (partie en cours surlignée, parties lues barrées, avancement).
 */
export default function TocRail({ items, readingMinutes }: { items: TocItem[]; readingMinutes: number }) {
    const [visible, setVisible] = useState(false);
    const [active, setActive] = useState(-1);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const card = document.getElementById("sommaire");
        const article = document.querySelector<HTMLElement>("article.wk-counter");
        const headings = items.map((t) => document.getElementById(t.id));
        let frame = 0;
        const update = () => {
            frame = 0;
            const offset = 140; // sous la barre de navigation collante
            // Visible quand la carte du haut est passée, et tant qu'on est dans l'article
            const cardGone = !card || card.getBoundingClientRect().bottom < 80;
            const box = article?.getBoundingClientRect();
            setVisible(cardGone && !!box && box.bottom > window.innerHeight * 0.4);
            let current = -1;
            headings.forEach((h, i) => {
                if (h && h.getBoundingClientRect().top < offset) current = i;
            });
            setActive(current);
            if (box) setProgress(Math.min(1, Math.max(0, (offset - box.top) / Math.max(1, box.height - window.innerHeight * 0.6))));
        };
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            cancelAnimationFrame(frame);
        };
    }, [items]);

    const left = Math.max(1, Math.ceil(readingMinutes * (1 - progress)));
    // Partie en cours : le H2, ou le H2 parent d'un H3 lu
    const activeH2 = active >= 0 ? items.slice(0, active + 1).findLast((t) => t.level === 2) : undefined;
    const hasH2 = items.some((t) => t.level === 2);

    return (
        // Dans le flux de la colonne, sous les widgets : il ne recouvre jamais rien
        <div className="sticky top-[92px] mt-6 hidden lg:block">
            <nav
                aria-label="Sommaire de l'article"
                aria-hidden={!visible}
                className={`max-h-[calc(100vh-120px)] overflow-y-auto rounded-[24px] border border-ink/10 bg-white p-5 shadow-[0_14px_40px_rgba(26,21,18,.10)] transition duration-300 ${visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"}`}
            >
                <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-lg">Sommaire</span>
                    <span className="text-[11px] text-ink/45">{progress >= 0.98 ? "Lu jusqu'au bout" : `Encore ${left} min`}</span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-paper2">
                    <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
                </div>
                <ol className="mt-3 space-y-0.5 text-[13.5px]">
                    {items.map((t, i) => {
                        const sub = hasH2 && t.level === 3;
                        const on = i === active || (sub ? false : t === activeH2 && items[active]?.level === 3);
                        const done = i < active && !on;
                        return (
                            <li key={t.id}>
                                <a
                                    href={`#${t.id}`}
                                    tabIndex={visible ? 0 : -1}
                                    className={`relative flex gap-2 rounded-lg py-1.5 pr-1 transition hover:text-ink ${sub ? "pl-7 text-[12.5px]" : "pl-4"} ${on ? "font-bold text-ink" : done ? "text-ink/40" : "text-ink/60"}`}
                                >
                                    {!sub && <span className={`absolute left-0.5 top-[13px] h-1.5 w-1.5 rounded-full ${on ? "bg-accent shadow-[0_0_0_4px_rgba(255,106,26,.2)]" : done ? "bg-accent/60" : "bg-ink/20"}`} />}
                                    {sub && <span className={`${on ? "text-accent" : "text-ink/30"}`}>→</span>}
                                    <span className={on ? "bg-[linear-gradient(transparent_55%,rgb(255_181_71/.8)_55%)] [box-decoration-break:clone]" : done ? "line-through decoration-ink/25" : ""}>{t.text}</span>
                                </a>
                            </li>
                        );
                    })}
                </ol>
                <a href="#sommaire" tabIndex={visible ? 0 : -1} className="mt-3 block text-[11px] font-semibold text-ink/45 hover:text-ink">
                    ↑ Haut de l&apos;article
                </a>
            </nav>
        </div>
    );
}
