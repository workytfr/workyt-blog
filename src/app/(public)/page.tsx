import type { Metadata } from "next";
import Home, { homeMetadata } from "./home";

// Accueil en cache, régénéré toutes les 5 min (la recherche « /?s= » est servie à part, voir proxy.ts)
export const revalidate = 300;

export const metadata: Metadata = homeMetadata(1);

export default function HomePage() {
    return <Home />;
}
