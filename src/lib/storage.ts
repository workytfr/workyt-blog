import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp, { type OutputInfo } from "sharp";

/**
 * Stockage des images. En production : Cloudflare R2 (mêmes variables S3_*
 * que workyt-next). Sans R2 configuré (développement) : dossier local
 * public/uploads-dev/, ignoré par git.
 *
 * Chaque image est ré-encodée en WebP (2 400 px de large au plus) : le fichier
 * est assaini (métadonnées EXIF, dont la position GPS, retirées) et léger.
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

const r2Configured = () => !!(process.env.S3_ENDPOINT && process.env.S3_BUCKET_NAME && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY && process.env.S3_PUBLIC_URL);

let client: S3Client | null = null;
function r2() {
    client ??= new S3Client({
        region: process.env.S3_REGION || "auto",
        endpoint: process.env.S3_ENDPOINT,
        credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
        forcePathStyle: true,
    });
    return client;
}

/** Nom de fichier lisible et sûr : « mon-image-a1b2c3.webp » */
function safeName(original: string): string {
    const base = original
        .replace(/\.[^.]+$/, "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
    return `${base || "image"}-${Math.random().toString(36).slice(2, 8)}.webp`;
}

export interface StoredImage {
    key: string;
    url: string;
    mime: string;
    size: number;
    width: number;
    height: number;
}

export async function storeImage(file: File): Promise<StoredImage> {
    if (!ACCEPTED.includes(file.type)) throw new UploadError("Format non pris en charge : JPEG, PNG, WebP, GIF ou AVIF.");
    if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Image trop lourde (15 Mo au maximum).");

    const input = Buffer.from(await file.arrayBuffer());
    let output: Buffer;
    let info: OutputInfo;
    try {
        ({ data: output, info } = await sharp(input, { animated: file.type === "image/gif" })
            .rotate() // applique l'orientation EXIF avant de la retirer
            .resize({ width: 2400, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer({ resolveWithObject: true }));
    } catch {
        throw new UploadError("Ce fichier n'est pas une image lisible.");
    }

    const now = new Date();
    // Bucket dédié au blog : pas de préfixe « blog/ »
    const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${safeName(file.name)}`;

    if (r2Configured()) {
        await r2().send(
            new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key, Body: output, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" })
        );
        return { key, url: `${process.env.S3_PUBLIC_URL!.replace(/\/$/, "")}/${key}`, mime: "image/webp", size: output.length, width: info.width, height: info.height };
    }

    // Développement : fichier local servi par Next
    const dir = path.join(process.cwd(), "public", "uploads-dev", path.dirname(key));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(process.cwd(), "public", "uploads-dev", key), output);
    return { key, url: `/uploads-dev/${key}`, mime: "image/webp", size: output.length, width: info.width, height: info.height };
}

export class UploadError extends Error {}
