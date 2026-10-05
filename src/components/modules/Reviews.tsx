import { BookOpen, Cpu, Heart, ShoppingBag } from "lucide-react";
import type { BookReviewData, ProductReviewData, TechReviewData } from "@/lib/modules/types";
import { isAffiliateHref } from "@/lib/modules/types";
import ModuleImage from "./ModuleImage";
import { CriteriaBars, ProsCons, ScoreBadge, Stars } from "./Rating";

const Eyebrow = ({ icon: Icon, children }: { icon: typeof Cpu; children: React.ReactNode }) => (
    <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-accentdark">
        <Icon className="h-3.5 w-3.5" /> {children}
    </p>
);

/** Lien marchand : affilié → « sponsored », toujours nouvel onglet */
export function MerchantLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
    const affiliate = isAffiliateHref(href);
    return (
        <a href={href} target="_blank" rel={affiliate ? "sponsored nofollow noopener" : "noopener noreferrer"} className={className}>
            {children}
        </a>
    );
}

/* ─── Avis tech : boîte de verdict, barres, fiche technique ─── */

export function TechReview({ data }: { data: TechReviewData }) {
    return (
        <section className="not-prose my-10 overflow-hidden rounded-[30px] border border-ink/10 bg-white" aria-label={`Avis : ${data.product}`}>
            <div className="flex flex-wrap items-center gap-5 p-6 sm:p-7">
                {data.image && <ModuleImage image={data.image} className="h-28 w-28 shrink-0" rounded="rounded-2xl" />}
                <div className="min-w-0 flex-1">
                    <Eyebrow icon={Cpu}>Notre avis</Eyebrow>
                    <h3 className="mt-2 font-display text-[28px] leading-tight">{data.product}</h3>
                    <p className="mt-1 text-sm text-ink/55">{[data.brand, data.model, data.price && `Prix constaté : ${data.price}`].filter(Boolean).join(" · ")}</p>
                </div>
                <ScoreBadge value={data.score} max={10} />
            </div>
            <div className="grid gap-6 border-t border-ink/10 p-6 sm:p-7 md:grid-cols-2">
                <CriteriaBars criteria={data.criteria} max={10} />
                {data.verdict && (
                    <div className="rounded-2xl bg-ink p-5 text-white">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-accent">Verdict</p>
                        <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-white/85">{data.verdict}</p>
                    </div>
                )}
            </div>
            {(data.pros.length > 0 || data.cons.length > 0) && (
                <div className="px-6 pb-6 sm:px-7">
                    <ProsCons pros={data.pros} cons={data.cons} />
                </div>
            )}
            {data.specs.length > 0 && (
                <details className="group border-t border-ink/10 px-6 py-4 sm:px-7">
                    <summary className="cursor-pointer text-sm font-semibold">Fiche technique ({data.specs.length})</summary>
                    <table className="mt-3 w-full text-sm">
                        <tbody>
                            {data.specs.map((s) => (
                                <tr key={s.key} className="border-t border-ink/5">
                                    <th className="w-2/5 py-2 pr-4 text-left font-semibold text-ink/60">{s.key}</th>
                                    <td className="py-2">{s.value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </details>
            )}
        </section>
    );
}

/* ─── Avis lecture : carte livre avec couverture ─── */

export function BookReview({ data }: { data: BookReviewData }) {
    // Avis enregistrés avant l'ajout des points forts et faibles
    const pros = data.pros ?? [];
    const cons = data.cons ?? [];
    const facts = [
        ["Auteur", data.authors],
        ["Éditeur", data.publisher],
        ["Année", data.year],
        ["Pages", data.pages],
        ["Genre", data.genre],
        ["Pour qui", data.audience],
        ["ISBN", data.isbn],
    ].filter(([, v]) => v);
    return (
        <section className="not-prose my-10 overflow-hidden rounded-[30px] border border-ink/10 bg-white" aria-label={`Avis lecture : ${data.title}`}>
            <div className="grid gap-6 p-6 sm:grid-cols-[150px_minmax(0,1fr)] sm:p-7">
                {data.image ? <ModuleImage image={data.image} className="aspect-[2/3] w-[150px] shadow-[0_14px_30px_rgba(26,21,18,.18)]" rounded="rounded-lg" /> : <div className="grid aspect-[2/3] w-[150px] place-items-center rounded-lg bg-paper2"><BookOpen className="h-10 w-10 text-ink/25" /></div>}
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Eyebrow icon={BookOpen}>Avis lecture</Eyebrow>
                        {data.favorite && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                                <Heart className="h-3.5 w-3.5" fill="currentColor" /> Coup de cœur
                            </span>
                        )}
                    </div>
                    <h3 className="mt-2 font-display text-[28px] leading-tight">{data.title}</h3>
                    <p className="text-[15px] text-ink/60">{data.authors}</p>
                    <div className="mt-3 flex items-center gap-2">
                        <Stars value={data.score} size={20} />
                        <span className="text-sm font-semibold">{String(data.score).replace(".", ",")}/5</span>
                    </div>
                    {data.summary && <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-ink/75">{data.summary}</p>}
                    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
                        {facts.map(([k, v]) => (
                            <div key={k}>
                                <dt className="text-xs text-ink/45">{k}</dt>
                                <dd className="font-semibold">{v}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </div>
            {(data.criteria.length > 0 || pros.length > 0 || cons.length > 0) && (
                <div className="space-y-5 border-t border-ink/10 p-6 sm:p-7">
                    <CriteriaBars criteria={data.criteria} max={5} />
                    <ProsCons pros={pros} cons={cons} />
                </div>
            )}
        </section>
    );
}

/* ─── Avis produit : boîte d'achat ─── */

export function ProductReview({ data }: { data: ProductReviewData }) {
    return (
        <section className="not-prose my-10 overflow-hidden rounded-[30px] border border-ink/10 bg-white" aria-label={`Avis produit : ${data.product}`}>
            <div className={`grid gap-6 p-6 sm:items-center sm:p-7 ${data.image ? "sm:grid-cols-[180px_minmax(0,1fr)_auto]" : "sm:grid-cols-[minmax(0,1fr)_auto]"}`}>
                {data.image && <ModuleImage image={data.image} className="aspect-square w-[180px]" />}
                <div className="min-w-0">
                    <Eyebrow icon={ShoppingBag}>Avis produit</Eyebrow>
                    <h3 className="mt-2 font-display text-[28px] leading-tight">{data.product}</h3>
                    {data.price && <p className="mt-1 font-display text-2xl text-accentdark">{data.price}</p>}
                    {data.link && (
                        <MerchantLink href={data.link} className="btn-orange mt-4 px-5 py-2.5 text-sm">
                            <ShoppingBag className="h-4 w-4" /> Voir {data.merchant ? `chez ${data.merchant}` : "l'offre"}
                        </MerchantLink>
                    )}
                    {data.link && isAffiliateHref(data.link) && <p className="mt-2 text-[11px] text-ink/45">Lien sponsorisé : Workyt peut toucher une commission, sans surcoût pour toi.</p>}
                </div>
                <ScoreBadge value={data.score} max={10} />
            </div>
            {(data.criteria.length > 0 || data.pros.length > 0 || data.cons.length > 0) && (
                <div className="space-y-5 border-t border-ink/10 p-6 sm:p-7">
                    <CriteriaBars criteria={data.criteria} max={10} />
                    <ProsCons pros={data.pros} cons={data.cons} />
                </div>
            )}
        </section>
    );
}

/** Comparatif : plusieurs avis produit dans le même article */
export function ProductComparison({ items }: { items: ProductReviewData[] }) {
    return (
        <section className="not-prose my-10 overflow-x-auto rounded-[30px] border border-ink/10 bg-white" aria-label="Comparatif">
            <table className="w-full min-w-[520px] text-sm">
                <caption className="px-6 pt-6 text-left font-display text-2xl sm:px-7">Le comparatif</caption>
                <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-ink/45">
                        <th className="px-6 py-3 sm:px-7">Produit</th>
                        <th className="px-3 py-3">Note</th>
                        <th className="px-3 py-3">Prix</th>
                        <th className="px-6 py-3 sm:px-7" />
                    </tr>
                </thead>
                <tbody>
                    {[...items]
                        .sort((a, b) => b.score - a.score)
                        .map((p, i) => (
                            <tr key={p.product} className="border-t border-ink/5">
                                <td className="px-6 py-3 font-semibold sm:px-7">
                                    {i === 0 && <span className="mr-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-white">Meilleur</span>}
                                    {p.product}
                                </td>
                                <td className="px-3 py-3">
                                    <ScoreBadge value={p.score} max={10} size={46} />
                                </td>
                                <td className="px-3 py-3 font-semibold">{p.price || "—"}</td>
                                <td className="px-6 py-3 text-right sm:px-7">
                                    {p.link && (
                                        <MerchantLink href={p.link} className="btn-ghost px-3.5 py-1.5 text-xs">
                                            Voir l&apos;offre
                                        </MerchantLink>
                                    )}
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </section>
    );
}
