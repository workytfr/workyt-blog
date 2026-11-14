import { Icon } from "workyt-icons/react";

/**
 * Icônes des rubriques, tirées du paquet workyt-icons (famille « rubriques ») :
 * de gros morceaux géométriques pleins, l'étoile à quatre branches, les détails
 * évidés. En grand (soft), le bas de l'icône se fond dans un flou léger.
 * Une icône par slug de rubrique ; une rubrique inconnue prend le journal.
 * Les anciens slugs WordPress (nos-tests, livres, cinema…) sont reconnus par le paquet.
 */

/** Slugs du blog qui portent le nom d'une autre icône du paquet */
const BLOG_SLUGS: Record<string, string> = {
    technologie: "codworkyt",
    technologies: "codworkyt",
    // Ponda Podcast : le casque d'écoute
    "ponda-podcast": "ecoute",
};

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
    return <Icon name={BLOG_SLUGS[slug] ?? slug} fallback="journal" className={`shrink-0 ${className}`} color={color} soft={soft} />;
}
