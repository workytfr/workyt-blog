/**
 * Jours et mois à l'heure de Paris, quel que soit le fuseau du serveur (UTC
 * en production). Les jours se comptent sur le calendrier (« 2026-10-25 »),
 * jamais en ajoutant 24 h : un jour de changement d'heure dure 23 ou 25 h.
 */
const TZ = "Europe/Paris";

const PARTS = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/** Date et heure affichées à Paris à cet instant */
function parisParts(d: Date) {
    const p = Object.fromEntries(PARTS.formatToParts(d).map((x) => [x.type, x.value]));
    return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), min: Number(p.minute), s: Number(p.second) };
}

/** Avance de Paris sur UTC à cet instant (1 h l'hiver, 2 h l'été), en ms */
function offsetMs(d: Date): number {
    const p = parisParts(d);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(d.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => {
    // Normalise (32 octobre → 1er novembre) sur le calendrier, sans fuseau
    const x = new Date(Date.UTC(y, m - 1, d));
    return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
};

/** Jour de Paris (« 2026-10-03 ») */
export function parisDay(d = new Date()): string {
    const p = parisParts(d);
    return keyOf(p.y, p.m, p.d);
}

/** Mois de Paris (« 2026-10 ») */
export function parisMonth(d = new Date()): string {
    return parisDay(d).slice(0, 7);
}

/** Jour décalé de n jours sur le calendrier */
export function addDays(day: string, n: number): string {
    const [y, m, d] = day.split("-").map(Number);
    return keyOf(y, m, d + n);
}

/** Instant de minuit à Paris ce jour-là (« 2026-10-25 » → 2026-10-24T22:00:00Z) */
export function parisMidnight(day: string): Date {
    const [y, m, d] = day.split("-").map(Number);
    const guess = Date.UTC(y, m - 1, d);
    // Deux passes : l'avance de minuit peut différer de celle de l'instant deviné
    const first = guess - offsetMs(new Date(guess));
    return new Date(guess - offsetMs(new Date(first)));
}

/** Premier jour du mois de Paris, à minuit à Paris */
export function parisMonthStart(d = new Date()): Date {
    return parisMidnight(`${parisMonth(d)}-01`);
}

/** Lundi de la semaine de ce jour */
export function mondayOf(day: string): string {
    const [y, m, d] = day.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return addDays(day, -((weekday + 6) % 7));
}

/** Nombre de jours du mois (« 2026-02 » → 28) */
export function daysInMonth(month: string): number {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** n jours consécutifs à partir de `from` */
export function daySeries(from: string, n: number): string[] {
    return Array.from({ length: n }, (_, i) => addDays(from, i));
}
