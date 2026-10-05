import type { Metadata } from "next";
import TagArchive, { tagMetadata } from "../../../archive";
import { parsePageParam } from "@/components/Archive";

export const revalidate = 300;
// Aucune page générée au build (pas besoin de la base) : chacune est créée à la première visite, puis mise en cache
export function generateStaticParams() {
    return [];
}
type Props = { params: Promise<{ slug: string; n: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, n } = await params;
    return tagMetadata(slug, Number(n) || 1);
}

export default async function TagPaged({ params }: Props) {
    const { slug, n } = await params;
    return <TagArchive slug={slug} page={parsePageParam(n, `/tag/${slug}/`)} />;
}
