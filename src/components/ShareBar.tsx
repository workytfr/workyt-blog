"use client";

import { useState } from "react";
import { Check, Link2, Mail } from "lucide-react";
import { siFacebook, siLinkedin, siPinterest, siWhatsapp, siX } from "simple-icons";
import { BrandIcon } from "./ui";

/**
 * Partage, collé à gauche du texte (Pixwell) : le logo de chaque réseau, dans
 * sa couleur. Aucun script tiers : de simples liens de partage.
 */
export default function ShareBar({ url, title, image }: { url: string; title: string; image?: string }) {
    const [copied, setCopied] = useState(false);
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(title);
    const networks = [
        { name: "WhatsApp", icon: siWhatsapp, href: `https://wa.me/?text=${t}%20${u}` },
        { name: "Facebook", icon: siFacebook, href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
        { name: "X", icon: siX, href: `https://x.com/intent/post?url=${u}&text=${t}` },
        { name: "LinkedIn", icon: siLinkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
        { name: "Pinterest", icon: siPinterest, href: `https://pinterest.com/pin/create/button/?url=${u}&description=${t}${image ? `&media=${encodeURIComponent(image)}` : ""}` },
    ];
    const btn =
        "grid h-[42px] w-[42px] place-items-center rounded-[14px] border border-ink/10 bg-white text-ink/70 transition hover:-translate-y-px hover:border-accent/40 hover:text-accent hover:shadow-[0_6px_14px_rgba(26,21,18,.08)]";

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            /* presse-papiers indisponible */
        }
    };

    return (
        <div className="flex flex-row items-center gap-2 lg:sticky lg:top-28 lg:flex-col" aria-label="Partager l'article">
            <span className="hidden rotate-180 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/40 [writing-mode:vertical-rl] lg:mb-1 lg:block">Partager</span>
            {networks.map((n) => (
                <a key={n.name} href={n.href} target="_blank" rel="noopener noreferrer" className={btn} title={`Partager sur ${n.name}`}>
                    <BrandIcon path={n.icon.path} color={`#${n.name === "X" ? "000000" : n.icon.hex}`} title={n.name} />
                </a>
            ))}
            <a href={`mailto:?subject=${t}&body=${u}`} className={btn} title="Envoyer par e-mail">
                <Mail className="h-[17px] w-[17px]" />
            </a>
            <button type="button" onClick={copy} className={btn} title="Copier le lien">
                {copied ? <Check className="h-[17px] w-[17px] text-[#3f8a1f]" /> : <Link2 className="h-[17px] w-[17px]" />}
            </button>
        </div>
    );
}
