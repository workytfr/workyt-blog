import "server-only";
import { SITE } from "./site";

/**
 * IndexNow : à chaque publication ou mise à jour, le blog prévient les moteurs
 * qui suivent ce protocole (Bing, Yandex, Seznam, Naver…) que des pages ont
 * changé ; elles sont revisitées dans les minutes qui suivent au lieu
 * d'attendre le prochain passage du robot. Google ne suit pas IndexNow : il
 * s'appuie sur le sitemap (dates de modification) et sur la Search Console.
 *
 *   INDEXNOW_KEY=<clé de 32 caractères>   (npm run cron:secret en donne une)
 * La clé est servie à /indexnow-key.txt pour prouver que le site est le nôtre.
 */
export const INDEXNOW_KEY = /^[A-Za-z0-9-]{8,128}$/.test(process.env.INDEXNOW_KEY || "") ? process.env.INDEXNOW_KEY! : "";

/** Prévient les moteurs, sans attendre ni faire échouer la publication */
export function pingIndexNow(urls: string[]): void {
    // Seulement le vrai site : jamais depuis une copie locale ou de test
    if (!INDEXNOW_KEY || process.env.NODE_ENV !== "production" || !SITE.url.startsWith("https://")) return;
    const urlList = urls.filter((u) => u.startsWith(`${SITE.url}/`)).slice(0, 500);
    if (!urlList.length) return;
    void fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ host: new URL(SITE.url).host, key: INDEXNOW_KEY, keyLocation: `${SITE.url}/indexnow-key.txt`, urlList }),
        signal: AbortSignal.timeout(5000),
    })
        .then((res) => {
            if (!res.ok) console.error(`[indexnow] refus ${res.status}`);
        })
        .catch((error) => console.error("[indexnow] envoi impossible :", (error as Error).message));
}
