import type { Metadata } from "next";
import PondaPage, { pondaMetadata } from "./ponda";

// Page en cache, régénérée toutes les 5 min
export const revalidate = 300;

export const metadata: Metadata = pondaMetadata(1);

export default function Page() {
    return <PondaPage page={1} />;
}
