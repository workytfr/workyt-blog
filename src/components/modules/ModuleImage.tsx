import { Camera } from "lucide-react";
import type { ModuleImage as Img } from "@/lib/modules/types";

/** Image d'un module, avec son crédit au style Workyt (comme toutes les images du blog) */
export default function ModuleImage({ image, className = "", rounded = "rounded-[22px]" }: { image: Img; className?: string; rounded?: string }) {
    const credit = [image.credit.author, image.credit.source].filter(Boolean).join(" · ");
    return (
        <figure className={`relative overflow-hidden bg-paper2 ${rounded} ${className}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- images de la médiathèque (R2 ou locale) */}
            <img src={image.url} alt={image.alt} width={image.width ?? undefined} height={image.height ?? undefined} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            {credit && (
                <figcaption className="absolute bottom-2 right-2 inline-flex max-w-[90%] items-center gap-1.5 rounded-full bg-paper/95 px-2.5 py-1 text-[10px] font-semibold shadow-sm">
                    <Camera className="h-3 w-3 shrink-0 text-accent" />
                    <span className="truncate">{credit}</span>
                </figcaption>
            )}
        </figure>
    );
}
