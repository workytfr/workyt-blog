import { renderOgCard, ogResponse } from "@/lib/og";

/**
 * Carte de partage des pages sans photo : accueil, rubriques, étiquettes,
 * auteurs. /og/?titre=…&type=… (sans paramètre : la carte du blog).
 */
export async function GET(req: Request) {
    const q = new URL(req.url).searchParams;
    const title = (q.get("titre") || "Le blog de Workyt").slice(0, 140);
    const kicker = (q.get("type") || (q.get("titre") ? "" : "Actualités · Conseils · Culture")).slice(0, 40);
    return ogResponse(await renderOgCard({ title, kicker: kicker || undefined }));
}
