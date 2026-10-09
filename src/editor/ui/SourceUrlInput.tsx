"use client";

import { Link2 } from "lucide-react";

const VALID = /^https?:\/\/\S+\.\S+/i;

/**
 * Lien vers l'image d'origine (facultatif). Un lien valide affiche une
 * pastille verte, comme une case remplie ; un clic l'ouvre dans un onglet.
 */
export default function SourceUrlInput({ value, onChange, placeholder = "Lien vers l'original (facultatif)", className = "" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
    const ok = VALID.test(value.trim());
    return (
        <span className={`relative block ${className}`}>
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 pr-10 text-sm outline-none focus:border-accent" />
            {ok && (
                <a
                    href={value.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Ouvrir l'image d'origine"
                    aria-label="Ouvrir l'image d'origine"
                    className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-leaf/25 text-[#2f6e14] hover:bg-leaf/40"
                >
                    <Link2 className="h-3.5 w-3.5" />
                </a>
            )}
        </span>
    );
}
