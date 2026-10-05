"use client";

import { useEffect } from "react";

/** Signale l'adresse introuvable au journal des 404 (dashboard > Redirections), une fois */
export default function NotFoundBeacon() {
    useEffect(() => {
        const body = JSON.stringify({ path: window.location.pathname + window.location.search, referrer: document.referrer });
        if (!navigator.sendBeacon?.("/api/404/", body)) void fetch("/api/404/", { method: "POST", body, keepalive: true }).catch(() => {});
    }, []);
    return null;
}
