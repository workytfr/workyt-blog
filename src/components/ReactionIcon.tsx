import type { ReactionKey } from "@/lib/commentRules";

/**
 * Réactions au style Workyt : la tête du renard, une expression par réaction
 * (SVG, pas d'emoji). Les petites animations (cœur qui bat, larme, « z »…)
 * sont dans globals.css (.wk-rx…), jouées au survol et quand la réaction est
 * choisie.
 */

const INK = "#2b2420";

function Base({ id, from, to }: { id: string; from: string; to: string }) {
    return (
        <>
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={from} />
                    <stop offset="1" stopColor={to} />
                </linearGradient>
            </defs>
            {/* Oreilles */}
            <path d="M9 27 L13 5 L28 17 Z" fill={from} />
            <path d="M13 22 L14.5 11 L23 18 Z" fill="#ffc29b" />
            <path d="M11.6 13 L13 5 L17.4 8.7 Z" fill={INK} />
            <path d="M55 27 L51 5 L36 17 Z" fill={from} />
            <path d="M51 22 L49.5 11 L41 18 Z" fill="#ffc29b" />
            <path d="M52.4 13 L51 5 L46.6 8.7 Z" fill={INK} />
            {/* Tête */}
            <path d="M6 28 C6 20 12 15 20 16 L32 19 L44 16 C52 15 58 20 58 28 C58 34 54 40 49 45 C44 52 38 58 32 59 C26 58 20 52 15 45 C10 40 6 34 6 28 Z" fill={`url(#${id})`} />
            {/* Museau blanc et truffe */}
            <path d="M14 38 C20 40 26 41 32 45.5 C38 41 44 40 50 38 C47 48 40 56 32 58 C24 56 17 48 14 38 Z" fill="#fff" />
            <path d="M28.5 45.2 Q32 43.2 35.5 45.2 Q33.6 49.2 32 49.2 Q30.4 49.2 28.5 45.2 Z" fill={INK} />
        </>
    );
}

const line = { stroke: INK, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const blush = (
    <g fill="#ff8fa0" opacity="0.75">
        <ellipse cx="15.5" cy="39" rx="3.2" ry="1.9" />
        <ellipse cx="48.5" cy="39" rx="3.2" ry="1.9" />
    </g>
);
const heart = (x: number, y: number, s = 1) => `M${x} ${y + 2.6 * s} C${x - 5.2 * s} ${y - 1.4 * s} ${x - 2.6 * s} ${y - 5.6 * s} ${x} ${y - 2.4 * s} C${x + 2.6 * s} ${y - 5.6 * s} ${x + 5.2 * s} ${y - 1.4 * s} ${x} ${y + 2.6 * s} Z`;

const FACES: Record<ReactionKey, (id: string) => React.ReactNode> = {
    love: (id) => (
        <>
            <Base id={id} from="#ff8a3d" to="#ff5a14" />
            <path className="wk-rx-pop" d={heart(22, 32.5)} fill="#e5484d" />
            <path className="wk-rx-pop" d={heart(42, 32.5)} fill="#e5484d" />
            {blush}
            <path d="M27.5 52 Q32 56 36.5 52" {...line} />
            <path className="wk-rx-float" d={heart(55, 9, 0.8)} fill="#e5484d" />
        </>
    ),
    sad: (id) => (
        <>
            <Base id={id} from="#ff9a55" to="#f0672a" />
            <path d="M16.5 28.5 L26 25.3 M47.5 28.5 L38 25.3" {...line} />
            <circle cx="22" cy="33" r="2.3" fill={INK} />
            <circle cx="42" cy="33" r="2.3" fill={INK} />
            <path className="wk-rx-tear" d="M24.5 36 C22.8 39.2 22.4 41 24.5 42 C26.6 41 26.2 39.2 24.5 36 Z" fill="#6ec1e4" />
            <path d="M27.5 54.2 Q32 50.8 36.5 54.2" {...line} />
        </>
    ),
    happy: (id) => (
        <>
            <Base id={id} from="#ff8a3d" to="#ff5a14" />
            <path d="M18.3 33.5 Q22 28.3 25.7 33.5 M38.3 33.5 Q42 28.3 45.7 33.5" {...line} />
            {blush}
            <path d="M26.5 50.5 Q32 59 37.5 50.5 Z" fill={INK} />
            <path d="M29.3 54.6 Q32 57.6 34.7 54.6 Q32 53.2 29.3 54.6 Z" fill="#ff8fa0" />
        </>
    ),
    sleep: (id) => (
        <>
            <Base id={id} from="#ff9a55" to="#f0672a" />
            <path d="M18.3 32 Q22 35.4 25.7 32 M38.3 32 Q42 35.4 45.7 32" {...line} />
            <ellipse cx="32" cy="53" rx="1.8" ry="1.4" fill={INK} />
            <g className="wk-rx-z" fill="#4aa8d4" fontFamily="var(--font-funnel-display), sans-serif" fontWeight="800">
                <text x="47" y="15" fontSize="9">z</text>
                <text x="53" y="8" fontSize="12">Z</text>
            </g>
        </>
    ),
    angry: (id) => (
        <>
            <Base id={id} from="#ff6a3d" to="#d9363e" />
            <path d="M16.5 25.8 L26.2 29.8 M47.5 25.8 L37.8 29.8" {...line} strokeWidth={2.7} />
            <circle cx="22" cy="33.6" r="2.3" fill={INK} />
            <circle cx="42" cy="33.6" r="2.3" fill={INK} />
            <path d="M27 54.4 Q32 50.6 37 54.4" {...line} />
            {/* Signe de colère */}
            <g className="wk-rx-vein" stroke="#e5484d" strokeWidth="2" strokeLinecap="round" fill="none">
                <path d="M49 6.5 Q52 9 49 11.5" />
                <path d="M57 6.5 Q54 9 57 11.5" />
                <path d="M50.5 4 Q53 7 55.5 4" />
                <path d="M50.5 14 Q53 11 55.5 14" />
            </g>
        </>
    ),
    dead: (id) => (
        <>
            <Base id={id} from="#ffa36b" to="#e8743f" />
            <ellipse className="wk-rx-halo" cx="32" cy="4.5" rx="10" ry="2.6" fill="none" stroke="#ffb547" strokeWidth="2" />
            <path d="M19 30 L25 36 M25 30 L19 36 M39 30 L45 36 M45 30 L39 36" {...line} />
            <path d="M27 52 L37 52" {...line} />
            <path d="M32.6 52 Q32.8 57.4 35.6 57 Q37.6 56.4 36.4 52 Z" fill="#ff8fa0" stroke={INK} strokeWidth="1.2" />
        </>
    ),
    wink: (id) => (
        <>
            <Base id={id} from="#ff8a3d" to="#ff5a14" />
            <circle cx="22" cy="32.5" r="2.6" fill={INK} />
            <circle cx="22.9" cy="31.6" r="0.9" fill="#fff" />
            <path d="M38.3 33.2 Q42 29.2 45.7 33.2" {...line} />
            {blush}
            <path d="M27 51.5 Q32 56.5 37 51.5" {...line} />
            <path className="wk-rx-spark" d="M55 4 L56.6 9.4 L62 11 L56.6 12.6 L55 18 L53.4 12.6 L48 11 L53.4 9.4 Z" fill="#ffb547" />
        </>
    ),
};

export default function ReactionIcon({ type, size = 44 }: { type: ReactionKey; size?: number }) {
    return (
        <svg viewBox="0 0 64 64" width={size} height={size} className={`wk-rx wk-rx--${type}`} aria-hidden overflow="visible">
            {FACES[type](`wk-rx-g-${type}`)}
        </svg>
    );
}
