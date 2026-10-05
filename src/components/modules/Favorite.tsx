import Link from "next/link";
import { ArrowUpRight, Heart } from "lucide-react";
import type { AuthorView } from "@/lib/content";
import type { FavoriteData } from "@/lib/modules/types";
import { isAffiliateHref } from "@/lib/modules/types";
import { Avatar } from "@/components/ui";
import ModuleImage from "./ModuleImage";
import { MerchantLink } from "./Reviews";

const KIND_LABEL: Record<FavoriteData["kind"], string> = {
    livre: "Un livre",
    film: "Un film",
    série: "Une série",
    appli: "Une appli",
    jeu: "Un jeu",
    lieu: "Un lieu",
    produit: "Un produit",
    site: "Un site",
    podcast: "Un podcast",
    autre: "",
};

/**
 * Coup de cœur (§ 9) : « Coup de cœur de la rédaction » signé par l'auteur
 * de l'article, ou « Le coup de cœur de Camille » (rédacteur invité), avec
 * son avatar, sa citation et le lien vers sa page auteur.
 */
export default function Favorite({ data, signer, guest }: { data: FavoriteData; signer: AuthorView | null; guest?: boolean }) {
    return (
        <section className="not-prose relative my-10 overflow-hidden rounded-[30px] bg-peach/60 p-6 sm:p-7" aria-label={`${data.badge} : ${data.name}`}>
            <Heart className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rotate-12 text-accent/10" fill="currentColor" aria-hidden="true" />
            <div className="relative grid gap-6 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center">
                <div className="min-w-0">
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-white">
                        <Heart className="h-3.5 w-3.5" fill="currentColor" /> {guest && signer ? `Le coup de cœur de ${signer.name}` : `${data.badge} de la rédaction`}
                    </p>
                    {KIND_LABEL[data.kind] && <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-ink/45">{KIND_LABEL[data.kind]}</p>}
                    <h3 className="mt-1 font-display text-[30px] leading-tight">{data.name}</h3>
                    <blockquote className="mt-3 border-l-[3px] border-accent pl-4 text-[16px] italic leading-relaxed text-ink/80">« {data.why} »</blockquote>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        {signer && (
                            <Link href={`/author/${signer.slug}/`} className="inline-flex items-center gap-2.5 rounded-full bg-white py-1 pl-1 pr-4 text-sm font-semibold shadow-sm hover:text-accentdark">
                                <Avatar author={signer} size={32} /> {signer.name}
                            </Link>
                        )}
                        {data.link && (
                            <MerchantLink href={data.link} className="inline-flex items-center gap-1 text-sm font-semibold text-accentdark underline underline-offset-4">
                                Découvrir <ArrowUpRight className="h-4 w-4" />
                            </MerchantLink>
                        )}
                        {data.link && isAffiliateHref(data.link) && <span className="text-[11px] text-ink/45">lien sponsorisé</span>}
                    </div>
                </div>
                {data.image && <ModuleImage image={data.image} className="aspect-square w-full max-w-[200px] rotate-2 shadow-[0_14px_30px_rgba(26,21,18,.16)]" />}
            </div>
        </section>
    );
}
