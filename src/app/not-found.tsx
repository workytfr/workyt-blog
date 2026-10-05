import NotFoundContent from "@/components/NotFoundContent";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

/** Adresse inconnue n'importe où sur le blog : la même 404, avec l'en-tête du blog */
export default function RootNotFound() {
    return (
        <>
            <SiteHeader />
            <main id="contenu">
                <NotFoundContent />
            </main>
            <SiteFooter />
        </>
    );
}
