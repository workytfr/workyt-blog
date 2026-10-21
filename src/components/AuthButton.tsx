"use client";

import Link from "next/link";
import { useSession } from "./Providers";
import { LayoutDashboard, UserRound } from "lucide-react";

/**
 * Bouton de compte de l'en-tête. Côté client, pour que les pages restent en
 * cache (ISR) : la session n'est lue que dans le navigateur. Place fixe dans
 * l'en-tête (40 px, 160 px dès sm) : rien ne bouge quand la session arrive.
 */
export default function AuthButton() {
    const { data, status } = useSession();
    const pill = "inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white p-1 sm:pr-4 text-sm font-semibold ring-1 ring-ink/10 transition hover:ring-ink/25";
    const slot = "inline-flex h-10 w-10 shrink-0 justify-end sm:w-40";

    if (status === "loading")
        return (
            <span className={slot} aria-hidden>
                <span className="h-10 w-10 animate-pulse rounded-full bg-paper2 sm:w-32" />
            </span>
        );

    if (!data?.user) {
        return (
            <span className={slot}>
                {/* Sur mobile le texte est masqué : aria-label donne le nom du lien */}
                <Link href="/connexion/" className={pill} aria-label="Connexion">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-white">
                        <UserRound className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="hidden sm:inline">Connexion</span>
                </Link>
            </span>
        );
    }

    const role = (data.user as { role?: string }).role;
    const team = !!role && role !== "lecteur";
    return (
        <span className={slot}>
            <Link href={team ? "/dashboard/" : "/connexion/"} className={pill} title={team ? "Rédaction" : "Mon compte"} aria-label={team ? "Rédaction" : `Mon compte : ${data.user.name ?? ""}`}>
                {data.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar workyt.fr
                    <img src={data.user.image} alt="" width={32} height={32} className="h-8 w-8 rounded-full bg-paper2 object-cover" />
                ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-sky text-xs font-bold text-ink">{(data.user.name || "?").charAt(0)}</span>
                )}
                {team && <LayoutDashboard className="h-4 w-4 text-ink/50" aria-hidden />}
                {/* Nom tronqué : le bouton ne dépasse jamais sa place */}
                <span className="hidden max-w-24 truncate sm:inline-block">{team ? "Rédaction" : data.user.name}</span>
            </Link>
        </span>
    );
}
