import type { Metadata } from "next";
import PondaPage, { pondaMetadata } from "../../ponda";
import { parsePageParam } from "@/components/Archive";
import { PONDA } from "@/lib/ponda";

export const revalidate = 300;
// Aucune page générée au build (pas besoin de la base) : chacune est créée à la première visite, puis mise en cache
export function generateStaticParams() {
    return [];
}
type Props = { params: Promise<{ n: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return pondaMetadata(Number((await params).n) || 1);
}

export default async function PondaPaged({ params }: Props) {
    return <PondaPage page={parsePageParam((await params).n, PONDA.path)} />;
}
