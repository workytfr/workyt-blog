"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";

/** Boutons de connexion : « Se connecter avec Workyt », et la connexion de test en local */
export default function SignInButtons({ mode, callbackUrl = "/", devLogin = false, logoutUrl }: { mode: "signin" | "signout"; callbackUrl?: string; devLogin?: boolean; logoutUrl?: string }) {
    const [username, setUsername] = useState("");
    const [role, setRole] = useState<Role>("redacteur");

    if (mode === "signout") {
        return (
            <div className="mt-6 flex flex-col items-center gap-2">
                <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="text-sm font-semibold text-ink/50 underline underline-offset-4 hover:text-ink">
                    Se déconnecter du blog
                </button>
                {logoutUrl && (
                    // « Se déconnecter partout » : la session du blog, puis celle de workyt.fr
                    <button type="button" onClick={async () => (await signOut({ redirect: false }), window.location.assign(logoutUrl))} className="text-xs text-ink/40 underline underline-offset-4 hover:text-ink">
                        Se déconnecter partout (blog et workyt.fr)
                    </button>
                )}
            </div>
        );
    }

    return (
        <>
            <button
                type="button"
                onClick={() => signIn("workyt", { callbackUrl })}
                className="mt-8 inline-flex items-center gap-3 rounded-full bg-ink py-3.5 pl-3 pr-6 font-semibold text-white shadow-[0_3px_0_#000,0_14px_30px_rgba(26,21,18,.25)] transition hover:-translate-y-px"
            >
                {/* eslint-disable-next-line @next/next/no-img-element -- logo */}
                <img src="/renard-workyt.png" alt="" width={32} height={32} className="h-8 w-8 object-contain" />
                Se connecter avec Workyt
            </button>

            {devLogin && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (username.trim()) void signIn("dev", { username, role, callbackUrl });
                    }}
                    className="mx-auto mt-8 max-w-sm rounded-2xl border border-dashed border-accent/40 bg-white p-4 text-left"
                >
                    <p className="text-xs font-semibold text-accentdark">Connexion de développement (local uniquement)</p>
                    <div className="mt-3 flex gap-2">
                        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Pseudo" className="min-w-0 flex-1 rounded-xl border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent" />
                        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-xl border border-ink/15 px-2 py-2 text-sm">
                            {ROLES.map((r) => (
                                <option key={r} value={r}>
                                    {ROLE_LABELS[r]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button type="submit" className="btn-orange mt-3 w-full justify-center py-2 text-sm">
                        Entrer
                    </button>
                </form>
            )}
        </>
    );
}
