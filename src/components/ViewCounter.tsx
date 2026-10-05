"use client";

import { useEffect } from "react";

/**
 * Compte une lecture, une fois par onglet (sessionStorage) : pas de cookie,
 * pas d'identifiant, juste un total par article.
 */
export default function ViewCounter({ postId }: { postId: string }) {
    useEffect(() => {
        const key = `wk-blog-vu:${postId}`;
        try {
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, "1");
        } catch {
            /* navigation privée stricte : on compte quand même */
        }
        void fetch(`/api/views/${postId}/`, { method: "POST", keepalive: true }).catch(() => {});
    }, [postId]);
    return null;
}
