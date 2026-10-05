import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { can } from "@/lib/roles";
import { checkCredit } from "@/lib/licenses";
import { storeImage, UploadError } from "@/lib/storage";
import { currentActor, unauthorized } from "@/lib/session";
import Media from "@/models/Media";
import { toMediaView } from "@/lib/media";

const forbidden = () => NextResponse.json({ success: false, error: "Réservé à la rédaction." }, { status: 403 });


/** GET /api/media/?q=&toCheck=1 — médiathèque (rédaction) */
export async function GET(req: NextRequest) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    if (!can(actor.role, "post.create")) return forbidden();
    await connectDB();
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const filter: Record<string, unknown> = {};
    if (q) filter.$text = { $search: q };
    if (req.nextUrl.searchParams.get("toCheck") === "1") filter.rightsToCheck = true;
    const items = await Media.find(filter).sort({ createdAt: -1 }).limit(60).lean();
    return NextResponse.json({ success: true, data: items.map(toMediaView) });
}

/**
 * POST /api/media/ — multipart : file + alt + author + source + license +
 * sourceUrl (+ proofUrl). Refusé sans source ni licence (cahier des charges § 8.4).
 */
export async function POST(req: NextRequest) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    if (!can(actor.role, "post.create")) return forbidden();

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ success: false, error: "Choisis une image." }, { status: 400 });

    const field = (k: string) => String(form?.get(k) ?? "").trim();
    const credit = { author: field("author"), source: field("source"), license: field("license"), sourceUrl: field("sourceUrl"), proofUrl: field("proofUrl") };
    const { errors, warnings } = checkCredit(credit);
    if (errors.length) return NextResponse.json({ success: false, error: errors.join(" "), issues: errors }, { status: 422 });
    const alt = field("alt");
    if (!alt) return NextResponse.json({ success: false, error: "Décris l'image (texte alternatif) : c'est utile aux lecteurs d'écran et à Google." }, { status: 422 });

    try {
        const stored = await storeImage(file);
        await connectDB();
        const media = await Media.create({ ...stored, originalName: file.name.slice(0, 120), alt: alt.slice(0, 300), credit, uploadedBy: actor.memberId });
        return NextResponse.json({ success: true, data: toMediaView(media.toObject()), warnings }, { status: 201 });
    } catch (error) {
        if (error instanceof UploadError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        console.error("[médias] envoi impossible :", error);
        return NextResponse.json({ success: false, error: "L'envoi de l'image a échoué. Réessaie." }, { status: 502 });
    }
}
