import "katex/dist/katex.min.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

/** Pages publiques du blog : en-tête et pied de page du blog */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
                Aller au contenu
            </a>
            <SiteHeader />
            <main id="contenu">{children}</main>
            <SiteFooter />
        </>
    );
}
