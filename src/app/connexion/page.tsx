import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getBlogSession, isDevLoginEnabled } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { SITE } from "@/lib/site";
import SignInButtons from "./SignInButtons";

export const metadata: Metadata = { title: "Connexion", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ callbackUrl?: string; error?: string }> };

/** Connexion : uniquement avec un compte Workyt */
export default async function ConnexionPage({ searchParams }: Props) {
    const [{ callbackUrl, error }, session] = await Promise.all([searchParams, getBlogSession()]);
    // Retour uniquement vers une page du blog (pas de redirection ouverte)
    const back = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";

    return (
        <main className="relative grid min-h-screen place-items-center overflow-hidden bg-paper px-6 py-16">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" aria-hidden />
            <div className="absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-sky/25 blur-3xl" aria-hidden />
            <div className="relative w-full max-w-md text-center">
                <Link href="/" className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent font-display text-3xl text-white">
                    w
                </Link>
                <p className="eyebrow mt-6">Le blog de Workyt</p>
                {session?.user ? (
                    <>
                        <h1 className="mt-2 font-display text-[36px] leading-[1.05]">Tu es connecté, {session.user.name}</h1>
                        <p className="mt-3 text-sm text-ink/60">Rôle sur le blog : {ROLE_LABELS[session.user.role]}</p>
                        <div className="mt-8 flex justify-center gap-2">
                            <Link href="/" className="btn-ghost px-5 py-2.5 text-sm">
                                Retour au blog
                            </Link>
                            {session.user.role !== "lecteur" && (
                                <Link href="/dashboard/" className="btn-orange px-5 py-2.5 text-sm">
                                    Rédaction
                                </Link>
                            )}
                        </div>
                        <SignInButtons mode="signout" logoutUrl={`${SITE.workytUrl}/oauth/logout?client_id=blog&post_logout_redirect_uri=${encodeURIComponent(`${SITE.url}/`)}`} />
                    </>
                ) : (
                    <>
                        <h1 className="mt-2 font-display text-[36px] leading-[1.05]">Connecte-toi pour commenter et écrire avec la rédaction</h1>
                        <p className="mt-3 text-sm text-ink/60">Un seul compte pour tout Workyt : cours, fiches, forum… et le blog.</p>
                        {error && <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">La connexion n&apos;a pas abouti : l&apos;autorisation a été refusée ou interrompue. Réessaie quand tu veux.</p>}
                        <SignInButtons mode="signin" callbackUrl={back} devLogin={isDevLoginEnabled()} />
                        <p className="mt-4 text-xs text-ink/50">
                            Pas encore de compte ?{" "}
                            <a href={SITE.workytUrl} className="font-semibold text-accentdark underline underline-offset-2">
                                Crée-le sur workyt.fr
                            </a>{" "}
                            — c&apos;est gratuit.
                        </p>
                        <p className="mt-10 flex items-center justify-center gap-2 text-xs text-ink/45">
                            <ShieldCheck className="h-4 w-4" />
                            Ton mot de passe reste sur workyt.fr : le blog ne le voit jamais.
                        </p>
                    </>
                )}
            </div>
        </main>
    );
}
