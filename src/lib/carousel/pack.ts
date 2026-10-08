import "server-only";
import sharp from "sharp";
import { CAROUSEL_SIZE } from "./data";

/**
 * Empaquetage des diapositives, sans dépendance :
 * - .zip d'images PNG (Instagram) — archive « stockée », sans compression
 *   (les PNG sont déjà compressés) ;
 * - PDF d'une page par diapositive (LinkedIn publie les carrousels en PDF).
 */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(buf: Buffer): number {
    let c = 0xffffffff;
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

export function zipFiles(files: { name: string; data: Buffer }[]): Buffer {
    const parts: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;
    for (const f of files) {
        const name = Buffer.from(f.name, "utf8");
        const crc = crc32(f.data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6); // noms en UTF-8
        local.writeUInt16LE(0, 8); // stocké
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(f.data.length, 18);
        local.writeUInt32LE(f.data.length, 22);
        local.writeUInt16LE(name.length, 26);
        parts.push(local, name, f.data);

        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014b50, 0);
        entry.writeUInt16LE(20, 4);
        entry.writeUInt16LE(20, 6);
        entry.writeUInt16LE(0x0800, 8);
        entry.writeUInt32LE(crc, 16);
        entry.writeUInt32LE(f.data.length, 20);
        entry.writeUInt32LE(f.data.length, 24);
        entry.writeUInt16LE(name.length, 28);
        entry.writeUInt32LE(offset, 42);
        central.push(entry, name);
        offset += local.length + name.length + f.data.length;
    }
    const dir = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(dir.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...parts, dir, end]);
}

/** PDF : chaque diapositive en JPEG pleine page (1080 × 1350 points) */
export async function pdfFromSlides(pngs: Buffer[]): Promise<Buffer> {
    const { width: W, height: H } = CAROUSEL_SIZE;
    const jpegs = await Promise.all(pngs.map((p) => sharp(p).flatten({ background: "#fdfaf4" }).jpeg({ quality: 90, mozjpeg: true }).toBuffer()));
    const chunks: Buffer[] = [];
    const offsets: number[] = [];
    let size = 0;
    const push = (b: Buffer | string) => {
        const buf = typeof b === "string" ? Buffer.from(b, "latin1") : b;
        chunks.push(buf);
        size += buf.length;
    };
    const obj = (n: number, body: () => void) => {
        offsets[n] = size;
        push(`${n} 0 obj\n`);
        body();
        push("\nendobj\n");
    };

    // 1 : catalogue, 2 : pages, puis par diapositive : page, contenu, image
    const pageIds = jpegs.map((_, i) => 3 + i * 3);
    push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
    obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
    obj(2, () => push(`<< /Type /Pages /Count ${jpegs.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`));
    jpegs.forEach((jpg, i) => {
        const [page, content, image] = [pageIds[i], pageIds[i] + 1, pageIds[i] + 2];
        const draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
        obj(page, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`));
        obj(content, () => push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
        obj(image, () => {
            push(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
            push(jpg);
            push("\nendstream");
        });
    });
    const count = 3 + jpegs.length * 3;
    const xref = size;
    push(`xref\n0 ${count}\n0000000000 65535 f \n`);
    for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
    push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return Buffer.concat(chunks);
}
