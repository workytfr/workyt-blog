"use client";

import { useEffect, useState } from "react";
import type { Session } from "next-auth";

/**
 * Session côté navigateur, sans le SessionProvider de next-auth (~37 Ko de
 * JS et un appel à chaque page ou retour sur l'onglet) : /api/auth/session
 * n'est lu qu'une fois par chargement, et seulement par les composants qui
 * en ont besoin (bouton de compte, commentaires). Connexion et déconnexion
 * rechargent la page : la valeur en mémoire reste juste.
 */
type State = { data: Session | null; status: "loading" | "authenticated" | "unauthenticated" };

let request: Promise<Session | null> | null = null;
let known: State | null = null;

const fetchSession = () =>
    (request ??= fetch("/api/auth/session/", { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((s: Session | null) => (s && s.user ? s : null))
        .catch(() => null));

/** Même forme que useSession() de next-auth : { data, status } */
export function useSession(): State {
    const [state, setState] = useState<State>(known ?? { data: null, status: "loading" });
    useEffect(() => {
        if (known) return;
        let alive = true;
        void fetchSession().then((data) => {
            known = { data, status: data ? "authenticated" : "unauthenticated" };
            if (alive) setState(known);
        });
        return () => {
            alive = false;
        };
    }, []);
    return state;
}
