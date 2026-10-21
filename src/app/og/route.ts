import { cachedOgCard, defaultOgCard, isKnownOgCard, ogResponse } from "@/lib/og";

/**
 * Carte de partage des pages sans photo : accueil, rubriques, étiquettes,
 * auteurs. /og/?titre=…&type=… (sans paramètre : la carte du blog). Seuls
 * les titres des pages du blog sont dessinés (et gardés en mémoire) : un
 * titre inventé reçoit la carte du blog, sans rien calculer.
 */
export async function GET(req: Request) {
    const q = new URL(req.url).searchParams;
    const title = q.get("titre") || "";
    const kicker = q.get("type") || "";
    if (!title || !(await isKnownOgCard(title, kicker))) return ogResponse(await defaultOgCard());
    const jpg = await cachedOgCard(`page:${title}\n${kicker}`, async () => ({ title, kicker: kicker || undefined }));
    return ogResponse(jpg ?? (await defaultOgCard()));
}
