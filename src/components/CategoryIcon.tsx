/**
 * Icônes des rubriques, dans le style des icônes de workyt.fr : de gros
 * morceaux géométriques pleins (demi-disques, feuilles, cercles, pilules)
 * séparés par un mince espace, l'étoile à quatre branches, les détails
 * évidés (evenodd). En grand (soft), le bas de l'icône se fond dans un flou
 * léger, comme les badges du site.
 * Une icône par slug de rubrique ; une rubrique inconnue prend le journal.
 * Sans hook : utilisable en composant serveur comme client.
 */

const ring = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
const rect = (x: number, y: number, w: number, h: number, r = 0) =>
    r ? `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z` : `M${x} ${y}h${w}v${h}h${-w}Z`;
/** Étoile à quatre branches */
const spark = (c: number, d: number, s: number, k = 0.22) => {
    const q = +(s * k).toFixed(2);
    return `M${c} ${d - s}Q${c + q} ${d - q} ${c + s} ${d}Q${c + q} ${d + q} ${c} ${d + s}Q${c - q} ${d + q} ${c - s} ${d}Q${c - q} ${d - q} ${c} ${d - s}Z`;
};
/** Feuille entre deux pointes (deux arcs de même rayon) */
const leaf = (x1: number, y1: number, x2: number, y2: number, r: number) => `M${x1} ${y1}A${r} ${r} 0 0 1 ${x2} ${y2}A${r} ${r} 0 0 1 ${x1} ${y1}Z`;
/** Demi-disque : bombé vers le haut (up) ou vers le bas, côté plat à la hauteur y */
const dome = (cx: number, y: number, r: number, up = true) => `M${cx - r} ${y}A${r} ${r} 0 0 1 ${cx + r} ${y}Z`.replace(" 0 0 1 ", up ? " 0 0 1 " : " 0 0 0 ");

/** Chevron de guillemet « (ou » en miroir), pointe à x, centré sur y = 10.2 */
const quote = (x: number, mirror = false) => {
    const pts: [number, number][] = [[x + 2.4, 7], [x, 10.2], [x + 2.4, 13.4], [x + 3.6, 12.5], [x + 1.9, 10.2], [x + 3.6, 7.9]];
    return `M${pts.map(([a, b]) => `${+(mirror ? 24 - a : a).toFixed(2)} ${b}`).join("L")}Z`;
};

/** [tracé, évidé (evenodd) ?, transform ?, opacité ?] */
type Part = [string, boolean?, string?, number?];

const GLYPHS: Record<string, Part[]> = {
    // Journal : la page, sa une évidée, le rabat (icône par défaut)
    journal: [
        [`${rect(6, 3, 16, 18, 3)}${rect(9, 6, 10, 4.4, 1.2)}${rect(9, 12.6, 10, 1.7, 0.85)}${rect(9, 16.2, 6.5, 1.7, 0.85)}`, true],
        [rect(2, 7.5, 2.8, 13.5, 1.4)],
    ],
    // Actualités : le haut-parleur qui annonce, l'étoile de la nouvelle
    actualites: [[rect(2.5, 8.6, 4.4, 6.8, 1.6)], ["M8.2 4.6a7.4 7.4 0 0 1 0 14.8Z"], [spark(18.8, 6.4, 3.4)], [ring(19.2, 16.6, 1.6)]],
    // Conseils & méthodes : l'ampoule et son idée qui brille
    "conseils-methodes": [[`${ring(12, 9, 6.6)}${spark(12, 9, 3.4)}`, true], [rect(8.6, 16.6, 6.8, 2, 1)], [dome(12, 19.6, 2.6, false)]],
    // Culture : la fleur qui s'ouvre, comme le savoir
    culture: [[`${ring(12, 7.6, 5.4)}${spark(12, 7.6, 3)}`, true], [leaf(11.2, 21.4, 2.6, 15, 6.6)], [leaf(21.4, 15, 12.8, 21.4, 6.6)]],
    // Orientation : le poteau et ses deux directions
    "orientation-scolaire": [[rect(11, 2.5, 2, 19.5, 1)], ["M13.9 4.6h4.6a3.1 3.1 0 0 1 0 6.2h-4.6Z"], ["M10.1 12.6H5.5a3.1 3.1 0 0 0 0 6.2h4.6Z"], [spark(5.8, 5.6, 2.6)]],
    // Interviews : le micro posé sur son pied
    "nos-interviews": [[`${rect(8.4, 2, 7.2, 11, 3.6)}${spark(12, 7.4, 2.2)}`, true], ["M5 11.2a7 7 0 0 0 14 0h-2.2a4.8 4.8 0 0 1-9.6 0Z"], [dome(12, 22.4, 3.4)]],
    // Tests : la loupe et l'étoile de l'avis
    tests: [[`${ring(10, 10, 7.4)}${ring(10, 10, 5.2)}`, true], [rect(13.4, 18.2, 9.4, 3, 1.5), false, "rotate(45 18.1 19.7)"], [spark(10, 10, 3.4)]],
    // Le bon plan : l'étiquette de prix
    "le-bon-plan": [[`M4.6 2.5h6.5a2 2 0 0 1 1.4.6l8.9 8.9a1.6 1.6 0 0 1 0 2.2l-6.8 6.8a1.6 1.6 0 0 1-2.2 0L3.1 12.1a2 2 0 0 1-.6-1.4V4.6a2.1 2.1 0 0 1 2.1-2.1Z${ring(7.6, 7.6, 1.9)}`, true], [spark(19.4, 4.6, 2.4)]],
    // Santé & vie étudiante : le cœur et l'étoile du soin
    "sante-vie-etudiante": [[`M12 21.2C5.2 16.8 2 13 2 8.8 2 5.8 4.3 3.5 7.1 3.5c2 0 3.8 1.1 4.9 2.8 1.1-1.7 2.9-2.8 4.9-2.8 2.8 0 5.1 2.3 5.1 5.3 0 4.2-3.2 8-10 12.4Z${spark(12, 11.6, 4)}`, true]],
    // Linguistique : la bulle et ses guillemets « »
    linguistique: [[`${rect(2.5, 3, 19, 14.4, 5)}${[4.2, 6.9].map((x) => quote(x)).join("")}${[4.2, 6.9].map((x) => quote(x, true)).join("")}`, true], ["M6 15.6v6.2l5.4-5.2Z"]],
    // Technologie (Cod'Workyt) : l'engrenage et l'étoile au cœur
    codworkyt: [
        [`${ring(12, 12, 7)}${spark(12, 12, 2.9)}`, true],
        ...[0, 45, 90, 135, 180, 225, 270, 315].map((a): Part => [rect(10.5, 2.2, 3, 4.4, 1.1), false, `rotate(${a} 12 12)`]),
    ],
    // Éducation : la toque, son bonnet et le pompon
    education: [["M12 3 22.4 8.4 12 13.8 1.6 8.4Z"], [`M6 14.8h12a6 6 0 0 1-12 0Z`], [`${rect(20.4, 9.6, 1.5, 5.6, 0.75)}${ring(21.15, 16.8, 1.4)}`]],
    // Politique : la coupole et ses colonnes
    politique: [[`${dome(12, 10.4, 8)}${spark(12, 7, 2.2)}`, true], [[3.6, 8.2, 13.4, 18].map((x) => rect(x, 11.8, 2.4, 6.4, 1.2)).join("")], [rect(2.5, 19.4, 19, 2.6, 1.3)]],
    // Géopolitique : le globe et son méridien
    geopolitique: [[`${ring(12, 12, 9.5)}${leaf(12, 2.5, 12, 21.5, 16)}${leaf(12, 2.5, 12, 21.5, 40)}`, true], [spark(21, 3.6, 2.4)]],
    // Lycée : la coupole de l'école, la porte en arche
    lycee: [
        [`${dome(12, 10.6, 8.5)}${spark(12, 6.8, 2.2)}`, true],
        [`${rect(4, 11.8, 16, 10.2, 1.6)}M10 22v-3.8a2 2 0 0 1 4 0V22Z${ring(7.4, 15.2, 1.3)}${ring(16.6, 15.2, 1.3)}`, true],
    ],
    // Étudiant : le sac à dos
    etudiant: [
        [`${rect(4.5, 7, 15, 15, 4.5)}${rect(8, 12.4, 8, 1.7, 0.85)}${rect(8, 15.8, 8, 3.6, 1.4)}`, true],
        ["M8.8 6V5.2a3.2 3.2 0 0 1 6.4 0V6h-1.8v-.8a1.4 1.4 0 0 0-2.8 0V6Z"],
    ],
    // Parcoursup : l'avion en papier qui part, en deux ailes
    parcoursup: [["M2 10.8 22 3l-9.4 9.8Z"], ["M22 3l-4.6 17.6-4-5.2Z"], ["M11.6 14.6l-1.4 6.6-.4-7.6Z", false, undefined, 0.6]],
    // Systèmes numériques : la puce qui brille
    "systemes-numeriques": [
        [`${rect(6, 6, 12, 12, 3)}${spark(12, 12, 3.6)}`, true],
        [[8.4, 11.2, 14].map((p) => `${rect(p, 2.2, 1.6, 2.8, 0.8)}${rect(p, 19, 1.6, 2.8, 0.8)}${rect(2.2, p, 2.8, 1.6, 0.8)}${rect(19, p, 2.8, 1.6, 0.8)}`).join("")],
    ],
    // Art : la palette et ses couleurs
    art: [[`M12 2.5C6.5 2.5 2 6.7 2 12s4.3 9.5 9.6 9.5c1.6 0 2.4-1 2.4-2.2 0-1.6-1.3-2-1.3-3.4 0-1.2 1-2 2.2-2H17c2.8 0 5-2 5-4.8 0-3.5-4.5-6.6-10-6.6Z${ring(6.8, 11.4, 1.6)}${ring(8.8, 6.9, 1.6)}${ring(13.8, 6, 1.6)}${ring(17.8, 9, 1.6)}`, true]],
    // Gaming : la manette
    gaming: [[`M7 6h10a5 5 0 0 1 4.9 4l.9 5.6a3 3 0 0 1-5.3 2.4L15.6 16H8.4l-1.9 2a3 3 0 0 1-5.3-2.4L2.1 10A5 5 0 0 1 7 6ZM6.3 8.6h1.6v1.8h1.8V12H7.9v1.8H6.3V12H4.5v-1.6h1.8Z${ring(16, 9.8, 1.15)}${ring(18.3, 12.3, 1.15)}`, true]],
    // Musique : les deux croches
    musique: [[`${ring(7.4, 17.8, 2.9)}${ring(16.4, 15.6, 2.9)}M8.6 5.2h1.7v12.6H8.6ZM17.6 3h1.7v12.6h-1.7ZM8.6 5.2 19.3 2.6v3.2L8.6 8.4Z`]],
    // Série télé / cinéma : le clap
    "serie-tele_cinema": [["M2.4 6 19.8 2.6l.6 3.2L3 9.2Z"], [`${rect(2.5, 10, 19, 11.5, 2.4)}${spark(12, 15.75, 3.2)}`, true]],
    // High-tech : le téléphone et son écran qui brille
    "high-tech": [[`${rect(6, 2, 12, 20, 3.4)}${rect(8, 4.6, 8, 12.4, 1.4)}${spark(12, 10.8, 3.2)}${ring(12, 19.4, 1)}`, true]],
    // Lifestyle : la tasse et sa vapeur
    lifestyle: [["M2.5 8.6h15a7.5 7.5 0 0 1-15 0Z"], ["M17.4 9.6a3.3 3.3 0 0 1 0 6.6v-1.8a1.5 1.5 0 0 0 0-3Z"], [rect(3, 18.2, 14, 2.4, 1.2)], [spark(10, 3.9, 2.6)]],
    // Lecture : le livre ouvert, l'étoile au-dessus
    lecture: [["M11 9.5C8.6 7.6 5.3 7.2 2 8v13c3.3-.8 6.6-.4 9 1.5Z"], ["M13 9.5c2.4-1.9 5.7-2.3 9-1.5v13c-3.3-.8-6.6-.4-9 1.5Z"], [ring(12, 4.4, 2.2)]],
    // Sciences : la fiole et ses bulles
    sciences: [[`M8.8 2h6.4v1.9h-1.1v4.5l5.7 9.7a2.6 2.6 0 0 1-2.3 3.9H6.5a2.6 2.6 0 0 1-2.3-3.9l5.7-9.7V3.9H8.8ZM8 14.4h8l-1-1.8H9Z${ring(10.4, 17.6, 1.2)}${ring(14, 18.4, 0.9)}`, true]],
    // Sport : la coupe, son étoile et son socle
    sport: [
        [`M5.5 3h13v5.5a6.5 6.5 0 0 1-13 0Z${spark(12, 7.8, 2.8)}`, true],
        ["M4.6 3.8a3.3 3.3 0 0 0 0 6.6Z"],
        ["M19.4 3.8a3.3 3.3 0 0 1 0 6.6Z"],
        [rect(10.9, 15.6, 2.2, 3, 1.1)],
        [dome(12, 22.4, 4.6)],
    ],
    // Communication : deux bulles qui se répondent, l'étoile de l'idée partagée
    communication: [[`${ring(8.4, 8.4, 6)}${spark(8.4, 8.4, 3.2)}`, true], ["M3.6 11.6 2.4 16.8 8 14.3Z"], [ring(16.8, 16, 4.6)], ["M19 18.8 21.6 22l-5-1.6Z"]],
    // Voyage : l'avion
    voyage: [["M11 3a1 1 0 0 1 2 0v6.2l8.5 5v2.2L13 13.8v4.4l2.6 2v1.6L12 21l-3.6.8v-1.6l2.6-2v-4.4l-8.5 2.6v-2.2l8.5-5Z", false, "rotate(45 12 12)"]],
    // Philosophie : le nuage de pensée
    "philosophie-et-contexte": [[`${ring(8.4, 9.2, 4)}${ring(12.8, 6.8, 4.4)}${ring(17.2, 9.6, 3.9)}${ring(12.4, 11.8, 3.8)}`], [ring(6, 17.6, 1.9)], [ring(3.4, 21, 1.2)]],
    // Poésie : la plume, une feuille et sa nervure
    poesie: [[`${leaf(5.4, 18.6, 21, 3, 11.5)}${leaf(8.2, 15.8, 17.4, 6.6, 26)}`, true], ["M2.4 20.4l3.4-3.4 1.2 1.2-3.4 3.4Z"]],
    // Espace & astronomie : la planète, son anneau et une étoile
    "espace-astronomie": [
        [ring(11.5, 12.5, 6.2)],
        [`${ellipse(11.5, 12.5, 10.4, 3.4)}${ellipse(11.5, 12.5, 8.6, 2.2)}`, true, "rotate(-22 11.5 12.5)"],
        [spark(20, 3.8, 2.4)],
    ],
    // Applications & extensions : la pièce de puzzle
    "applications-et-extensions": [[`${rect(3, 8.6, 13, 13, 2.4)}${ring(9.5, 7.6, 2.6)}${ring(16.4, 15.1, 2.6)}`]],
};

/** Slugs d'aujourd'hui ou repris de WordPress qui partagent une icône */
const ALIASES: Record<string, string> = {
    "nos-tests": "tests",
    "test-produit": "tests",
    "conseils-et-methodes": "conseils-methodes",
    interviews: "nos-interviews",
    "serie-tele-cinema": "serie-tele_cinema",
    cinema: "serie-tele_cinema",
    livres: "lecture",
    technologie: "codworkyt",
    technologies: "codworkyt",
    orientation: "orientation-scolaire",
};

export const CATEGORY_GLYPHS = Object.keys(GLYPHS);

export const categoryGlyphName = (slug: string) => (GLYPHS[slug] ? slug : ALIASES[slug] ?? "journal");

export default function CategoryIcon({
    slug,
    className = "h-4 w-4",
    color,
    soft = false,
}: {
    slug: string;
    className?: string;
    color?: string;
    /** Bas de l'icône fondu dans un flou léger (à réserver aux grandes tailles) */
    soft?: boolean;
}) {
    const name = categoryGlyphName(slug);
    const paths = GLYPHS[name].map(([d, holes, transform, opacity], i) => (
        <path key={i} d={d} fillRule={holes ? "evenodd" : undefined} transform={transform} opacity={opacity} />
    ));
    // Identifiants propres au dessin : deux icônes identiques sur la page partagent les mêmes définitions
    const id = `wkc-${name}`;
    return (
        <svg viewBox="1 1 22 22" fill={color ?? "currentColor"} className={`shrink-0 ${className}`} aria-hidden="true" overflow="visible">
            {soft ? (
                <>
                    <defs>
                        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="0" y1="1" x2="0" y2="23">
                            <stop offset="0.5" stopColor="#fff" />
                            <stop offset="1" stopColor="#000" />
                        </linearGradient>
                        <linearGradient id={`${id}-h`} gradientUnits="userSpaceOnUse" x1="0" y1="1" x2="0" y2="23">
                            <stop offset="0.5" stopColor="#000" />
                            <stop offset="1" stopColor="#fff" />
                        </linearGradient>
                        <mask id={`${id}-net`} maskUnits="userSpaceOnUse" x="-2" y="-2" width="28" height="28">
                            <rect x="-2" y="-2" width="28" height="28" fill={`url(#${id}-g)`} />
                        </mask>
                        <mask id={`${id}-flou`} maskUnits="userSpaceOnUse" x="-2" y="-2" width="28" height="28">
                            <rect x="-2" y="-2" width="28" height="28" fill={`url(#${id}-h)`} />
                        </mask>
                        <filter id={`${id}-f`} x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="0.6" />
                        </filter>
                    </defs>
                    <g mask={`url(#${id}-net)`}>{paths}</g>
                    <g mask={`url(#${id}-flou)`}>
                        <g filter={`url(#${id}-f)`}>{paths}</g>
                    </g>
                </>
            ) : (
                paths
            )}
        </svg>
    );
}
