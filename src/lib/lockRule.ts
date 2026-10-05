/** Verrou d'édition (§ 7.4) : il tombe après 2 min sans activité de la personne qui a la main */
export const LOCK_TTL_MS = 2 * 60_000;

/** Le verrou est-il tenu par quelqu'un d'autre ? */
export function lockedByOther(post: { lock?: { member?: unknown; at?: Date | null } | null }, memberId: string, now = Date.now()): boolean {
    const l = post.lock;
    return !!l?.member && String(l.member) !== memberId && !!l.at && now - new Date(l.at).getTime() < LOCK_TTL_MS;
}
