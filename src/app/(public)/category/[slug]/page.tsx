import type { Metadata } from "next";
import CategoryArchive, { categoryMetadata } from "../archive";

export const revalidate = 300;
// Aucune page générée au build (pas besoin de la base) : chacune est créée à la première visite, puis mise en cache
export function generateStaticParams() {
    return [];
}
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return categoryMetadata((await params).slug, 1);
}

export default async function CategoryPage({ params }: Props) {
    return <CategoryArchive slug={(await params).slug} page={1} />;
}
