import { CircleEllipsis, FileText, Mail, Video } from "lucide-react";
import { CORRECTION_PLACE_DOMAINS, CORRECTION_PLACE_LABELS, type CorrectionPlace } from "@/lib/correction";
import { faviconUrl } from "@/lib/linkIcon";

const ICONS = { word: FileText, email: Mail, visio: Video, autre: CircleEllipsis } as const;

/** Où la correction a été faite : logo du service (Google Docs, Discord…) ou icône */
export default function CorrectionPlaceIcon({ place, className = "h-3.5 w-3.5" }: { place: CorrectionPlace; className?: string }) {
    const domain = CORRECTION_PLACE_DOMAINS[place];
    if (domain)
        return (
            // eslint-disable-next-line @next/next/no-img-element -- logo du service
            <img src={faviconUrl(domain)} alt="" title={CORRECTION_PLACE_LABELS[place]} className={`${className} shrink-0 rounded-[3px] object-contain`} />
        );
    const Icon = ICONS[place as keyof typeof ICONS] ?? CircleEllipsis;
    return <Icon className={`${className} shrink-0 ${place === "word" ? "text-[#185abd]" : "text-ink/55"}`} aria-label={CORRECTION_PLACE_LABELS[place]} />;
}
