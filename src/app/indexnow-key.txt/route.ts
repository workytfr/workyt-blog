import { INDEXNOW_KEY } from "@/lib/indexnow";

/** Clé IndexNow du site (preuve de propriété demandée par les moteurs) ; 404 si elle n'est pas réglée */
export function GET() {
    if (!INDEXNOW_KEY) return new Response("Not found", { status: 404 });
    return new Response(INDEXNOW_KEY, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
