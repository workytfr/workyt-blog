import Link from "next/link";
import { Camera } from "lucide-react";
import type { AuthorView, CategoryView, ImageView } from "@/lib/content";

/** Pastille de rubrique, à la couleur de la rubrique */
export function CategoryPill({ category, variant = "solid" }: { category: CategoryView; variant?: "solid" | "soft" }) {
    const dark = ["#1a1512", "#ff6a1a", "#c24a0a", "#e5484d", "#6b3fbf"].includes(category.color.toLowerCase());
    return (
        <Link
            href={`/category/${category.slug}/`}
            className="cat-pill relative z-10"
            style={
                variant === "solid"
                    ? { background: category.color, color: dark ? "#fff" : "#1a1512" }
                    : { background: "rgba(253,250,244,.92)", color: "#1a1512" }
            }
        >
            {variant === "soft" && <span className="mr-1.5 h-2 w-2 rounded-full" style={{ background: category.color }} />}
            {category.name}
        </Link>
    );
}

/**
 * Avatar d'auteur, comme sur workyt.fr : sa photo, sinon son Blobatar
 * (détouré, sans cercle de fond). Voir lib/avatar.ts.
 */
export function Avatar({ author, size = 36 }: { author: Pick<AuthorView, "name" | "avatarUrl" | "slug">; size?: number }) {
    const generated = author.avatarUrl.includes("/api/avatar/");
    return (
        // eslint-disable-next-line @next/next/no-img-element -- avatars d'origines diverses (workyt.fr, R2, Blobatar)
        <img
            src={author.avatarUrl}
            alt=""
            width={size}
            height={size}
            loading="lazy"
            className={`shrink-0 rounded-full ${generated ? "bg-paper2/60" : "object-cover ring-2 ring-white"}`}
            style={{ width: size, height: size }}
        />
    );
}

/**
 * Crédit d'une image, au style Workyt (cahier des charges § 8.4) :
 * « Auteur · Provenance · Licence ». Rien si l'image n'a pas de source
 * (images WordPress à vérifier) — elles sont signalées dans le dashboard.
 */
export function CreditBadge({ image, className = "" }: { image: ImageView; className?: string }) {
    const { author, source, license, sourceUrl } = image.credit;
    if (!author && !source) return null;
    const label = [author, source].filter(Boolean).join(" · ");
    const content = (
        <>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-white">
                <Camera className="h-[11px] w-[11px]" />
            </span>
            {label}
            {license && <span className="hidden font-medium text-ink/50 sm:inline">· {license}</span>}
        </>
    );
    return sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className={`credit z-10 hover:underline ${className}`}>
            {content}
        </a>
    ) : (
        <span className={`credit z-10 ${className}`}>{content}</span>
    );
}

/** Logo d'un réseau (chemins SVG de simple-icons), dans sa couleur */
export function BrandIcon({ path, color, size = 18, title }: { path: string; color: string; size?: number; title: string }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={title}>
            <path d={path} fill={color} />
        </svg>
    );
}
