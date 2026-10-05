import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { can } from "@/lib/roles";
import { toMediaView } from "@/lib/media";
import { currentActor, unauthorized } from "@/lib/session";
import { storeImage, UploadError } from "@/lib/storage";
import { STOCK_LABELS, STOCK_PROVIDERS, StockError, configuredProviders, downloadStockPhoto, getStockPhoto, searchStock, type StockProvider } from "@/lib/stock";
import Media from "@/models/Media";

const forbidden = () => NextResponse.json({ success: false, error: "Réservé à la rédaction." }, { status: 403 });
const asProvider = (v: unknown): StockProvider | null => (STOCK_PROVIDERS.includes(v as StockProvider) ? (v as StockProvider) : null);
const fail = (error: unknown) => {
    if (error instanceof StockError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    if (error instanceof UploadError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    console.error("[banque d'images]", error);
    return NextResponse.json({ success: false, error: "La banque d'images est indisponible. Réessaie." }, { status: 502 });
};

/**
 * GET /api/stock/?provider=pixabay&q=bibliothèque&page=1 — recherche dans une
 * banque d'images libres. Sans « q » : les banques configurées.
 */
export async function GET(req: NextRequest) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    if (!can(actor.role, "post.create")) return forbidden();
    const providers = configuredProviders();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim();
    if (!q) return NextResponse.json({ success: true, data: { providers, items: [], total: 0 } });
    const provider = asProvider(sp.get("provider"));
    if (!provider) return NextResponse.json({ success: false, error: "Banque d'images inconnue." }, { status: 400 });
    try {
        const { items, total } = await searchStock(provider, q, Number(sp.get("page")) || 1);
        return NextResponse.json({ success: true, data: { providers, items, total } });
    } catch (error) {
        return fail(error);
    }
}

/**
 * POST /api/stock/ { provider, id, alt } — copie la photo dans la médiathèque,
 * crédit rempli d'office (photographe, banque, licence, lien vers l'original).
 * Une photo déjà importée est reprise telle quelle.
 */
export async function POST(req: NextRequest) {
    const actor = await currentActor();
    if (!actor) return unauthorized();
    if (!can(actor.role, "post.create")) return forbidden();
    const body = await req.json().catch(() => ({}));
    const provider = asProvider(body.provider);
    const id = String(body.id ?? "");
    const alt = String(body.alt ?? "").trim().slice(0, 300);
    if (!provider) return NextResponse.json({ success: false, error: "Banque d'images inconnue." }, { status: 400 });
    if (!alt) return NextResponse.json({ success: false, error: "Décris l'image (texte alternatif) : c'est utile aux lecteurs d'écran et à Google." }, { status: 422 });

    try {
        const photo = await getStockPhoto(provider, id);
        await connectDB();
        const existing = await Media.findOne({ "credit.sourceUrl": photo.pageUrl }).lean();
        if (existing) return NextResponse.json({ success: true, data: toMediaView(existing), reused: true });

        const file = await downloadStockPhoto(photo);
        const stored = await storeImage(file);
        const label = STOCK_LABELS[provider];
        const media = await Media.create({
            ...stored,
            originalName: file.name.slice(0, 120),
            alt,
            credit: { author: photo.author, source: label.source, license: label.license, sourceUrl: photo.pageUrl, proofUrl: "" },
            uploadedBy: actor.memberId,
        });
        return NextResponse.json({ success: true, data: toMediaView(media.toObject()) }, { status: 201 });
    } catch (error) {
        return fail(error);
    }
}
