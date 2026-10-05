"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

/**
 * Page 404 : petite histoire animée (SVG + CSS, ~8 s). Trois moutons broutent,
 * le renard de Workyt sort du buisson, les attrape un à un (pouf de laine) et
 * repart : plus un mouton dans le champ, et un panneau « 404 » tombe sur la
 * clôture. Sans animation (réglage du système) : la scène finale directement.
 */

const SHEEP = [290, 510, 730];

function Sheep({ x, i }: { x: number; i: number }) {
    return (
        <g transform={`translate(${x} 300)`}>
            {/* « ! » juste avant d'être attrapé */}
            <g className={`wk-fs-alert wk-fs-alert-${i}`}>
                <text x="0" y="-78" textAnchor="middle" fontFamily="var(--font-funnel-display), sans-serif" fontWeight="700" fontSize="34" fill="#ff6a1a">
                    !
                </text>
            </g>
            <g className={`wk-fs-sheep wk-fs-sheep-${i}`}>
                {/* Pattes */}
                {[-22, -8, 10, 24].map((lx) => (
                    <rect key={lx} x={lx - 3} y="-6" width="6" height="22" rx="3" fill="#2b2420" />
                ))}
                {/* Laine */}
                <g fill="#fff" stroke="#e7dccb" strokeWidth="2">
                    <circle cx="-22" cy="-22" r="16" />
                    <circle cx="0" cy="-30" r="18" />
                    <circle cx="22" cy="-22" r="16" />
                    <circle cx="-12" cy="-10" r="16" />
                    <circle cx="12" cy="-10" r="16" />
                </g>
                <g fill="#fff">
                    <circle cx="0" cy="-18" r="20" />
                </g>
                {/* Tête qui broute */}
                <g className="wk-fs-graze">
                    <ellipse cx="-40" cy="-14" rx="11" ry="14" fill="#2b2420" />
                    <ellipse cx="-34" cy="-26" rx="7" ry="4" fill="#2b2420" transform="rotate(-25 -34 -26)" />
                    <circle cx="-44" cy="-18" r="2" fill="#fff" />
                </g>
            </g>
            {/* Pouf de laine */}
            <g className={`wk-fs-puff wk-fs-puff-${i}`} fill="#fff" stroke="#e7dccb" strokeWidth="2">
                <circle cx="-26" cy="-34" r="9" />
                <circle cx="20" cy="-42" r="11" />
                <circle cx="0" cy="-14" r="13" />
                <circle cx="30" cy="-12" r="8" />
                <circle cx="-30" cy="-8" r="8" />
            </g>
        </g>
    );
}

function Fox() {
    return (
        <g className="wk-fs-fox">
            <g className="wk-fs-bounce">
                {/* Queue */}
                <path d="M-62 -34 C-110 -40 -120 -90 -88 -96 C-96 -70 -78 -52 -52 -46 Z" fill="#ff6a1a" />
                <path d="M-88 -96 C-104 -92 -110 -76 -104 -66 C-98 -78 -92 -86 -80 -90 Z" fill="#fff" />
                {/* Pattes */}
                <rect x="-44" y="-16" width="9" height="26" rx="4" fill="#2b2420" className="wk-fs-leg-a" />
                <rect x="-26" y="-16" width="9" height="26" rx="4" fill="#2b2420" className="wk-fs-leg-b" />
                <rect x="18" y="-16" width="9" height="26" rx="4" fill="#2b2420" className="wk-fs-leg-b" />
                <rect x="34" y="-16" width="9" height="26" rx="4" fill="#2b2420" className="wk-fs-leg-a" />
                {/* Corps */}
                <ellipse cx="0" cy="-32" rx="62" ry="26" fill="#ff6a1a" />
                <ellipse cx="34" cy="-22" rx="22" ry="13" fill="#fff" />
                {/* Tête */}
                <g transform="translate(58 -52)">
                    <path d="M-14 -16 L-6 -44 L6 -18 Z" fill="#ff6a1a" />
                    <path d="M-9 -30 L-6 -44 L0 -30 Z" fill="#2b2420" />
                    <path d="M6 -18 L22 -42 L26 -12 Z" fill="#e85a10" />
                    <circle cx="0" cy="0" r="24" fill="#ff6a1a" />
                    <path d="M10 -4 L46 6 L12 18 Z" fill="#ff6a1a" />
                    <path d="M4 6 L44 7 L12 18 Z" fill="#fff" />
                    <circle cx="45" cy="6" r="4.5" fill="#2b2420" />
                    <circle cx="10" cy="-6" r="3.6" fill="#2b2420" />
                    <circle cx="11" cy="-7" r="1.2" fill="#fff" />
                    {/* Laine attrapée */}
                    <g className="wk-fs-tuft" fill="#fff" stroke="#e7dccb" strokeWidth="1.5">
                        <circle cx="34" cy="20" r="6" />
                        <circle cx="42" cy="22" r="5" />
                    </g>
                </g>
            </g>
        </g>
    );
}

export default function FoxScene() {
    const [run, setRun] = useState(0);
    return (
        <div className="wk-fox-scene">
            <svg key={run} viewBox="0 0 1000 380" role="img" aria-label="Un renard attrape un à un les moutons du champ et repart : il n'en reste plus aucun. Un panneau 404 tombe sur la clôture." className="h-auto w-full">
                {/* Soleil et nuages */}
                <circle cx="880" cy="70" r="40" fill="#ffb547" />
                <g className="wk-fs-cloud" fill="#fff">
                    <ellipse cx="180" cy="70" rx="56" ry="20" />
                    <ellipse cx="216" cy="56" rx="34" ry="22" />
                    <ellipse cx="150" cy="58" rx="26" ry="16" />
                </g>
                <g className="wk-fs-cloud wk-fs-cloud-2" fill="#fff">
                    <ellipse cx="610" cy="96" rx="44" ry="16" />
                    <ellipse cx="636" cy="84" rx="26" ry="17" />
                </g>
                {/* Colline et champ */}
                <path d="M0 230 C180 170 360 200 520 214 C700 230 840 180 1000 200 L1000 380 L0 380 Z" fill="#c9e7b2" />
                <path d="M0 262 C200 244 420 258 600 252 C780 246 900 256 1000 250 L1000 380 L0 380 Z" fill="#9fd07e" />
                {/* Clôture */}
                <g fill="#c98a52">
                    <rect x="780" y="226" width="200" height="8" rx="4" />
                    <rect x="780" y="246" width="200" height="8" rx="4" />
                    {[790, 850, 910, 966].map((x) => (
                        <rect key={x} x={x} y="210" width="12" height="62" rx="4" />
                    ))}
                </g>
                {/* Panneau 404 */}
                <g className="wk-fs-sign">
                    <line x1="860" y1="210" x2="842" y2="178" stroke="#8a5a32" strokeWidth="3" />
                    <line x1="900" y1="210" x2="918" y2="178" stroke="#8a5a32" strokeWidth="3" />
                    <rect x="820" y="130" width="120" height="56" rx="10" fill="#fff1d6" stroke="#c98a52" strokeWidth="4" />
                    <text x="880" y="171" textAnchor="middle" fontFamily="var(--font-funnel-display), sans-serif" fontWeight="700" fontSize="36" fill="#1a1512">
                        404
                    </text>
                </g>
                {/* Herbe */}
                <g fill="#7fbf5a">
                    {[60, 170, 400, 620, 840, 950].map((x) => (
                        <path key={x} d={`M${x} 330 l6 -18 l4 18 l6 -14 l3 14 Z`} />
                    ))}
                </g>
                {/* Moutons */}
                {SHEEP.map((x, i) => (
                    <Sheep key={x} x={x} i={i + 1} />
                ))}
                {/* Renard */}
                <g transform="translate(0 312)">
                    <Fox />
                </g>
                {/* Buisson (cachette du renard) */}
                <g fill="#5fa441">
                    <circle cx="20" cy="300" r="46" />
                    <circle cx="70" cy="312" r="36" />
                    <circle cx="-10" cy="320" r="40" />
                </g>
                <g fill="#4e9134">
                    <circle cx="40" cy="322" r="26" />
                </g>
            </svg>
            <button type="button" onClick={() => setRun((r) => r + 1)} className="wk-fs-replay mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink/70 ring-1 ring-ink/10 transition hover:text-ink">
                <RotateCcw className="h-3.5 w-3.5" /> Rejouer l&apos;histoire
            </button>
        </div>
    );
}
