import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tâches planifiées, déclenchées par le cron EXTERNE de l'hébergeur (comme
 * sur workyt.fr) : le site n'est pas un processus permanent, un cron interne
 * sauterait des passages.
 *
 *   GET ou POST /api/cron/<tâche>/
 *   Secret CRON_SECRET dans l'en-tête `x-cron-secret`, ou
 *   `Authorization: Bearer <secret>`, ou à défaut `?key=<secret>`.
 *
 * Tâches idempotentes : un appel en trop ne fait rien de plus.
 *   publish      toutes les 5 min : publie les articles planifiés dont l'heure est passée
 *   purge-trash  chaque nuit : vide la corbeille (articles jetés il y a plus de 30 jours) et efface les versions de séance de plus de 30 jours
 *   check-links  chaque nuit : vérifie les liens affiliés, prévient la rédaction en chef des liens morts
 */

const JOBS: Record<string, () => Promise<unknown>> = {
    publish: async () => {
        const { publishDue } = await import("@/lib/review");
        const result = await publishDue();
        for (const slug of result.slugs) revalidatePath(`/${slug}/`);
        if (result.published) revalidatePath("/");
        return result;
    },
    "check-links": async () => {
        const { checkLinks } = await import("@/lib/affiliate");
        return checkLinks();
    },
    "purge-trash": async () => {
        const { purgeTrash } = await import("@/lib/review");
        return purgeTrash();
    },
};

function secretOk(req: NextRequest): boolean {
    const expected = process.env.CRON_SECRET;
    if (!expected) return false;
    const auth = req.headers.get("authorization");
    const given = req.headers.get("x-cron-secret") || (auth?.startsWith("Bearer ") ? auth.slice(7) : null) || req.nextUrl.searchParams.get("key") || "";
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function run(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
    if (!process.env.CRON_SECRET) return NextResponse.json({ success: false, error: "CRON_SECRET non configuré" }, { status: 503 });
    if (!secretOk(req)) return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
    const { job } = await params;
    const task = JOBS[job];
    if (!task) return NextResponse.json({ success: false, error: "Tâche inconnue", jobs: Object.keys(JOBS) }, { status: 404 });
    const started = Date.now();
    try {
        const result = await task();
        return NextResponse.json({ success: true, job, ms: Date.now() - started, result });
    } catch (error) {
        console.error(`[cron] ${job} :`, error);
        return NextResponse.json({ success: false, job, error: "Échec de la tâche" }, { status: 500 });
    }
}

export const GET = run;
export const POST = run;
