/**
 * Avatar d'un membre ou d'un auteur, le même que sur workyt.fr :
 * 1. sa photo (venue de workyt.fr à la connexion, ou de WordPress) ;
 * 2. sinon, pour un compte workyt.fr, son Blobatar servi par workyt.fr
 *    (/api/avatar/<id>, avec les accessoires achetés en boutique) ;
 * 3. sinon (auteur invité, compte de test), le même Blobatar généré par le
 *    blog (/api/avatar/<graine>/, sans accessoires).
 */

const WORKYT_ID = /^[a-f0-9]{24}$/i;

export function avatarSrc(p: { avatarUrl?: string | null; workytId?: string | null; seed: string }): string {
    if (p.avatarUrl) return p.avatarUrl;
    const workyt = process.env.WORKYT_URL;
    if (p.workytId && WORKYT_ID.test(p.workytId) && workyt) return `${workyt.replace(/\/$/, "")}/api/avatar/${p.workytId}?size=256`;
    return `/api/avatar/${encodeURIComponent(p.workytId || p.seed)}/`;
}

/** Profil workyt.fr d'un membre (lien « Voir le profil Workyt ») */
export function workytProfileUrl(workytId?: string | null): string | null {
    const workyt = process.env.WORKYT_URL;
    return workytId && WORKYT_ID.test(workytId) && workyt ? `${workyt.replace(/\/$/, "")}/compte/${workytId}` : null;
}
