/**
 * Formats de date du WordPress actuel : « 2 octobre 2026 » (j F Y) et « 8h02 »
 * (G\hi), affichés à l'heure de Paris.
 */
const TZ = "Europe/Paris";

export function formatDate(iso: string | Date): string {
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date(iso));
}

export function formatTime(iso: string | Date): string {
    const parts = new Intl.DateTimeFormat("fr-FR", { hour: "numeric", minute: "2-digit", timeZone: TZ }).formatToParts(new Date(iso));
    const h = parts.find((p) => p.type === "hour")?.value ?? "";
    const m = parts.find((p) => p.type === "minute")?.value ?? "";
    return `${Number(h)}h${m}`;
}

/** « il y a 3 j », puis la date au-delà d'un mois */
export function relativeDate(iso: string | Date, now = new Date()): string {
    const diff = now.getTime() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `il y a ${d} j`;
    if (d < 30) return `il y a ${Math.floor(d / 7)} sem.`;
    return formatDate(iso);
}

export function formatCount(n: number): string {
    return new Intl.NumberFormat("fr-FR").format(n);
}

/** « Sarah », « Sarah et Camille », « Sarah, Léa et Camille » */
export function joinNames(names: string[]): string {
    if (names.length <= 1) return names[0] || "";
    return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}
