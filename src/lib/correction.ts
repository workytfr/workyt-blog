/**
 * Où la correction a été faite : dans le circuit du blog, ou à côté (demandes
 * de modification sur Google Docs, sur Discord…). Information interne à la
 * rédaction ; l'article public affiche seulement « Relu et corrigé par ».
 */
export const CORRECTION_PLACES = ["blog", "google_docs", "discord", "word", "notion", "email", "visio", "autre"] as const;
export type CorrectionPlace = (typeof CORRECTION_PLACES)[number];

export const CORRECTION_PLACE_LABELS: Record<CorrectionPlace, string> = {
    blog: "Sur le blog",
    google_docs: "Google Docs",
    discord: "Discord",
    word: "Word",
    notion: "Notion",
    email: "E-mail",
    visio: "Appel ou visio",
    autre: "Ailleurs",
};

/** Logo du service (via /api/favicon) quand il en a un ; sinon une icône (voir CorrectionPlaceIcon) */
export const CORRECTION_PLACE_DOMAINS: Partial<Record<CorrectionPlace, string>> = {
    blog: "blog.workyt.fr",
    google_docs: "docs.google.com",
    discord: "discord.com",
    notion: "notion.so",
};

export const isCorrectionPlace = (v: unknown): v is CorrectionPlace => typeof v === "string" && (CORRECTION_PLACES as readonly string[]).includes(v);

/** Correcteur d'un article dans l'éditeur ; `key` : « m:<compte> » ou « a:<profil sans compte> » */
export interface CorrectorInfo {
    key: string | null;
    name: string | null;
    via: CorrectionPlace | null;
}
