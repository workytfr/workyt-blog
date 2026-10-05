"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, CalendarDays, ChevronsLeft, ChevronsRight, FileText, FolderTree, HeartHandshake, House, Images, LogOut, MessagesSquare, PenLine, Settings, ShoppingBag, Signpost, Users, type LucideIcon } from "lucide-react";

export interface NavProps {
    can: { calendar: boolean; correction: boolean; comments: boolean; taxonomy: boolean; team: boolean; redirects: boolean; stats: boolean; settings: boolean };
    badges: { notifications: number; invitations: number; correction: number; comments: number };
    categories: { slug: string; name: string; color: string }[];
    me: { name: string; role: string; avatar: string };
}

/** L'éditeur prend toute la place : la navigation s'y replie en rail d'icônes */
const EDITOR = /^\/dashboard\/articles\/[0-9a-f]{24}\/?$/;

/**
 * Barre latérale du dashboard (§ 13.1) : navigation avec libellés, rubriques
 * en pastilles, avatar ; repliable en rail d'icônes (toujours repliée dans
 * l'éditeur).
 */
export default function DashboardNav({ can, badges, categories, me }: NavProps) {
    const path = usePathname() || "";
    const inEditor = EDITOR.test(path);
    const [folded, setFolded] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setFolded(localStorage.getItem("wk-nav") === "rail"), 0);
        return () => clearTimeout(t);
    }, []);
    const rail = inEditor || folded;
    const toggle = () => {
        localStorage.setItem("wk-nav", folded ? "full" : "rail");
        setFolded(!folded);
    };

    const main: [string, string, LucideIcon, number?][] = [
        ["/dashboard/", "Accueil", House],
        ["/dashboard/articles/", "Articles", FileText],
        ...(can.calendar ? [["/dashboard/calendrier/", "Calendrier", CalendarDays] as [string, string, LucideIcon]] : []),
        ...(can.correction ? [["/dashboard/correction/", "Correction", PenLine, badges.correction] as [string, string, LucideIcon, number]] : []),
        ...(can.comments ? [["/dashboard/commentaires/", "Commentaires", MessagesSquare, badges.comments] as [string, string, LucideIcon, number]] : []),
        ["/dashboard/medias/", "Médiathèque", Images],
        ["/dashboard/liens/", "Liens affiliés", ShoppingBag],
        ...(badges.invitations ? [["/dashboard/invitations/", "Coups de cœur invités", HeartHandshake, badges.invitations] as [string, string, LucideIcon, number]] : []),
        ["/dashboard/notifications/", "Notifications", Bell, badges.notifications],
    ];
    const admin: [string, string, LucideIcon][] = [
        ...(can.taxonomy ? [["/dashboard/rubriques/", "Rubriques et étiquettes", FolderTree] as [string, string, LucideIcon]] : []),
        ...(can.team ? [["/dashboard/equipe/", "Équipe", Users] as [string, string, LucideIcon]] : []),
        ...(can.stats ? [["/dashboard/statistiques/", "Statistiques", BarChart3] as [string, string, LucideIcon]] : []),
        ...(can.redirects ? [["/dashboard/redirections/", "Redirections", Signpost] as [string, string, LucideIcon]] : []),
        ...(can.settings ? [["/dashboard/reglages/", "Réglages", Settings] as [string, string, LucideIcon]] : []),
    ];
    const active = (href: string) => (href === "/dashboard/" ? path === "/dashboard" || path === "/dashboard/" : path.startsWith(href.replace(/\/$/, "")));

    const Item = ({ href, label, icon: Icon, badge }: { href: string; label: string; icon: LucideIcon; badge?: number }) => (
        <Link
            href={href}
            title={rail ? label : undefined}
            aria-current={active(href) ? "page" : undefined}
            className={`relative flex items-center gap-3 rounded-2xl text-sm font-semibold transition ${rail ? "h-11 w-11 justify-center" : "px-3 py-2.5"} ${active(href) ? "bg-ink text-white" : "text-ink/65 hover:bg-paper2 hover:text-ink"}`}
        >
            <Icon className="h-5 w-5 shrink-0" />
            {!rail && <span className="min-w-0 flex-1 truncate">{label}</span>}
            {!!badge && (
                <span className={`grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white ${rail ? "absolute right-0.5 top-0.5" : ""}`}>{badge > 99 ? "99+" : badge}</span>
            )}
        </Link>
    );

    return (
        <nav className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-ink/10 py-4 transition-[width] ${rail ? "w-[72px] items-center px-0" : "w-[248px] px-4"}`} aria-label="Rédaction">
            <Link href="/" className={`mb-4 flex items-center gap-2.5 ${rail ? "" : "px-1"}`} title="Voir le blog">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo */}
                {rail ? <img src="/renard-workyt.png" alt="Le blog de Workyt" width={44} height={44} className="h-11 w-11 object-contain" /> : <img src="/logo-blog-workyt.svg" alt="Le blog de Workyt" width={2485} height={549} className="h-10 w-auto" />}
            </Link>

            <div className={`flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto ${rail ? "items-center" : ""}`}>
                {main.map(([href, label, icon, badge]) => (
                    <Item key={href} href={href} label={label} icon={icon} badge={badge} />
                ))}
                {admin.length > 0 && (
                    <>
                        {!rail ? <p className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40">Gestion</p> : <span className="my-2 h-px w-8 bg-ink/10" />}
                        {admin.map(([href, label, icon]) => (
                            <Item key={href} href={href} label={label} icon={icon} />
                        ))}
                    </>
                )}
                {!rail && categories.length > 0 && (
                    <>
                        <p className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40">Rubriques</p>
                        {categories.map((c) => (
                            <Link key={c.slug} href={`/dashboard/articles/?vue=tous&rubrique=${c.slug}`} className="flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm text-ink/65 hover:bg-paper2 hover:text-ink">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                                <span className="truncate">{c.name}</span>
                            </Link>
                        ))}
                    </>
                )}
            </div>

            <div className={`mt-3 flex items-center gap-2 border-t border-ink/10 pt-3 ${rail ? "flex-col" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- avatar workyt.fr ou Blobatar */}
                <img src={me.avatar} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full bg-paper2/60 object-cover" title={rail ? `${me.name} · ${me.role}` : undefined} />
                {!rail && (
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{me.name}</span>
                        <span className="block truncate text-xs text-ink/50">{me.role}</span>
                    </span>
                )}
                <Link href="/connexion/" className="grid h-9 w-9 place-items-center rounded-xl text-ink/50 hover:bg-paper2 hover:text-ink" title="Compte / déconnexion">
                    <LogOut className="h-[18px] w-[18px]" />
                </Link>
                {!inEditor && (
                    <button type="button" onClick={toggle} className="grid h-9 w-9 place-items-center rounded-xl text-ink/40 hover:bg-paper2 hover:text-ink" title={folded ? "Déplier le menu" : "Replier le menu"} aria-label={folded ? "Déplier le menu" : "Replier le menu"}>
                        {folded ? <ChevronsRight className="h-[18px] w-[18px]" /> : <ChevronsLeft className="h-[18px] w-[18px]" />}
                    </button>
                )}
            </div>
        </nav>
    );
}
