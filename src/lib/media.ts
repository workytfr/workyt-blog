/** Forme d'une image de la médiathèque envoyée au navigateur */
export function toMediaView(m: {
    _id: unknown;
    url: string;
    width?: number | null;
    height?: number | null;
    alt?: string | null;
    originalName?: string | null;
    size: number;
    credit?: { author?: string | null; source?: string | null; license?: string | null; sourceUrl?: string | null; proofUrl?: string | null } | null;
    rightsVerified?: boolean | null;
    rightsToCheck?: boolean | null;
    createdAt?: Date | null;
}) {
    const c = m.credit ?? {};
    return {
        id: String(m._id),
        url: m.url,
        width: m.width ?? null,
        height: m.height ?? null,
        alt: m.alt || "",
        name: m.originalName || "",
        size: m.size,
        credit: { author: c.author || "", source: c.source || "", license: c.license || "", sourceUrl: c.sourceUrl || "", proofUrl: c.proofUrl || "" },
        rightsVerified: !!m.rightsVerified,
        rightsToCheck: !!m.rightsToCheck,
        createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
    };
}
export type MediaView = ReturnType<typeof toMediaView>;
