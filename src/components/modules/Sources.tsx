import { ArrowUp, BookMarked } from "lucide-react";
import type { SourceItem } from "@/lib/modules/types";

const fmtDate = (d: string) => {
    const t = Date.parse(d);
    return Number.isNaN(t) ? d : new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

/** Sources numérotées en fin d'article ; chaque appel [n] du texte y renvoie (§ 9) */
export default function Sources({ items, cited }: { items: SourceItem[]; cited: Set<string> }) {
    if (!items.length) return null;
    return (
        <section id="sources" className="not-prose mt-12 rounded-[28px] border border-ink/10 bg-white p-6 sm:p-7" aria-label="Sources">
            <h2 className="flex items-center gap-2 font-display text-2xl">
                <BookMarked className="h-5 w-5 text-accent" /> Sources
            </h2>
            <ol className="mt-4 space-y-3">
                {items.map((s, i) => (
                    <li key={s.id} id={`source-${s.id}`} className="flex scroll-mt-28 gap-3 text-[15px] target:rounded-xl target:bg-sun/20">
                        <span className="w-7 shrink-0 font-display text-accentdark">[{i + 1}]</span>
                        <div className="min-w-0">
                            <p>
                                {s.authors && <span>{s.authors}, </span>}
                                {s.url ? (
                                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline decoration-ink/20 underline-offset-4 hover:decoration-accent">
                                        {s.title}
                                    </a>
                                ) : (
                                    <b>{s.title}</b>
                                )}
                                {s.publisher && <span className="text-ink/60">, {s.publisher}</span>}
                                {s.date && <span className="text-ink/60">, {fmtDate(s.date)}</span>}
                                <span className="ml-2 rounded-full bg-paper2 px-2 py-0.5 text-[11px] text-ink/55">{s.kind}</span>
                            </p>
                            {s.quote && <blockquote className="mt-1 border-l-2 border-ink/15 pl-3 text-sm italic text-ink/60">« {s.quote} »</blockquote>}
                            {s.accessed && <p className="mt-0.5 text-xs text-ink/40">Consulté le {fmtDate(s.accessed)}</p>}
                            {cited.has(s.id) && (
                                <a href={`#cite-${s.id}-1`} className="mt-1 inline-flex items-center gap-1 text-xs text-ink/45 hover:text-accentdark" aria-label="Retour au texte">
                                    <ArrowUp className="h-3 w-3" /> au texte
                                </a>
                            )}
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}
