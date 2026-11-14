/**
 * Lit la réponse d'une route /api/ du blog ({ success, data, error }).
 * Si le serveur — ou l'hébergeur devant lui (délai dépassé, passerelle en
 * erreur, page de maintenance) — renvoie autre chose que du JSON, on rend une
 * erreur lisible avec le code HTTP au lieu du « JSON.parse: unexpected
 * character » du navigateur.
 */
export async function readApi<T = unknown>(r: Response): Promise<{ success: boolean; data: T; error?: string; [k: string]: unknown }> {
    const text = await r.text().catch(() => "");
    try {
        const j = JSON.parse(text);
        if (j && typeof j === "object") return j;
    } catch {
        /* pas du JSON : message ci-dessous */
    }
    const reason =
        r.status === 413
            ? "Fichier trop lourd pour le serveur."
            : r.status === 401 || r.status === 403
              ? "Session expirée : recharge la page et reconnecte-toi."
              : r.status === 502 || r.status === 503 || r.status === 504
                ? "Le serveur met trop de temps à répondre. Réessaie dans un instant."
                : "Réponse inattendue du serveur. Réessaie dans un instant.";
    // Titre de la page d'erreur (Cloudflare, hébergeur…) : aide à savoir qui a répondu
    const title = text.match(/<title[^>]*>([^<]{1,120})<\/title>/i)?.[1]?.trim();
    return { success: false, data: undefined as T, error: `${reason} (code ${r.status}${title ? ` — « ${title} »` : ""})` };
}
