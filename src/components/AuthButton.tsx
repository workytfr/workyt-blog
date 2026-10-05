"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { LayoutDashboard, UserRound } from "lucide-react";

/**
 * Bouton de compte de l'en-tête. Côté client, pour que les pages restent en
 * cache (ISR) : la session n'est lue que dans le navigateur.
 */
export default function AuthButton() {
    const { data, status } = useSession();
    const pill = "inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white p-1 sm:pr-4 text-sm font-semibold ring-1 ring-ink/10 transition hover:ring-ink/25";

    if (status === "loading") return <span className="h-10 w-10 animate-pulse rounded-full bg-paper2 sm:w-32" aria-hidden />;

    if (!data?.user) {
        return (
            <Link href="/connexion/" className={pill}>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-white">
                    <UserRound className="h-4 w-4" />
                </span>
                <span className="hidden sm:inline">Connexion</span>
            </Link>
        );
    }

    const role = (data.user as { role?: string }).role;
    const team = !!role && role !== "lecteur";
    return (
        <Link href={team ? "/dashboard/" : "/connexion/"} className={pill} title={team ? "Rédaction" : "Mon compte"}>
            {data.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar workyt.fr
                <img src={data.user.image} alt="" className="h-8 w-8 rounded-full bg-paper2 object-cover" />
            ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-sky text-xs font-bold text-white">{(data.user.name || "?").charAt(0)}</span>
            )}
            {team && <LayoutDashboard className="h-4 w-4 text-ink/50" />}
            <span className="hidden sm:inline">{team ? "Rédaction" : data.user.name}</span>
        </Link>
    );
}
