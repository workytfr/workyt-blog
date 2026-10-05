import type { Metadata } from "next";
import CategoryArchive, { categoryMetadata } from "../../../archive";
import { parsePageParam } from "@/components/Archive";

export const revalidate = 300;
// Aucune page générée au build (pas besoin de la base) : chacune est créée à la première visite, puis mise en cache
export function generateStaticParams() {
    return [];
}
type Props = { params: Promise<{ slug: string; n: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, n } = await params;
    return categoryMetadata(slug, Number(n) || 1);
}

export default async function CategoryPaged({ params }: Props) {
    const { slug, n } = await params;
    return <CategoryArchive slug={slug} page={parsePageParam(n, `/category/${slug}/`)} />;
}
