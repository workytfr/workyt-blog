/**
 * Provenances et licences des images (cahier des charges § 8.4). Une image
 * n'entre dans la médiathèque qu'avec son auteur, sa provenance, sa licence et
 * (sauf photo maison) le lien vers l'original.
 */

export const IMAGE_SOURCES = [
    "Unsplash",
    "Pixabay",
    "Pexels",
    "Wikimedia Commons",
    "Kit presse",
    "Photo maison",
    "Capture d'écran",
    "Image générée par IA",
    "Autre",
] as const;

export const IMAGE_LICENSES = [
    "Licence Unsplash",
    "Licence Pixabay",
    "Licence Pexels",
    "CC0 (domaine public)",
    "CC BY",
    "CC BY-SA",
    "CC BY-NC",
    "CC BY-ND",
    "Kit presse (usage autorisé)",
    "Autorisation écrite",
    "Photo maison",
    "Courte citation (capture d'écran)",
] as const;

/** Licences qui obligent à afficher le crédit (on l'affiche toujours, mais c'est alors une obligation légale) */
export const ATTRIBUTION_REQUIRED = ["CC BY", "CC BY-SA", "CC BY-NC", "CC BY-ND"];
/** Licences qui demandent une preuve (e-mail, page presse) */
export const PROOF_REQUIRED = ["Kit presse (usage autorisé)", "Autorisation écrite"];

export interface ImageCreditInput {
    author?: string;
    source?: string;
    license?: string;
    sourceUrl?: string;
    proofUrl?: string;
}

/**
 * Vérifie le crédit d'une image. Renvoie les erreurs bloquantes et les
 * avertissements (licences à risque pour un blog avec liens affiliés).
 */
export function checkCredit(c: ImageCreditInput): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const own = c.source === "Photo maison" || c.license === "Photo maison";
    if (!c.author?.trim()) errors.push("Indique l'auteur de l'image (ou « Rédaction Workyt » pour une photo maison).");
    if (!c.source?.trim()) errors.push("Indique la provenance de l'image.");
    if (!c.license?.trim()) errors.push("Indique la licence de l'image.");
    if (!own && !c.sourceUrl?.trim()) errors.push("Ajoute le lien vers l'image d'origine.");
    if (c.sourceUrl?.trim() && !/^https?:\/\//i.test(c.sourceUrl.trim())) errors.push("Le lien vers l'original doit commencer par http:// ou https://.");
    if (c.license && PROOF_REQUIRED.includes(c.license) && !c.proofUrl?.trim()) errors.push("Pour cette licence, ajoute la preuve de l'autorisation (lien vers l'e-mail ou la page presse).");
    if (c.license === "CC BY-NC") warnings.push("Licence « non commerciale » : interdite dans un article qui contient des liens affiliés.");
    if (c.license === "CC BY-ND") warnings.push("Licence « pas de modification » : ne pas recadrer ni retoucher l'image.");
    if (c.source === "Image générée par IA") warnings.push("Image générée par IA : mentionne-le dans la légende.");
    return { errors, warnings };
}
