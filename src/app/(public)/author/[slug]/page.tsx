import type { Metadata } from "next";
import AuthorArchive, { authorMetadata } from "../archive";

export const revalidate = 300;
// Aucune page générée au build (pas besoin de la base) : chacune est créée à la première visite, puis mise en cache
export function generateStaticParams() {
    return [];
}
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return authorMetadata((await params).slug, 1);
}

export default async function AuthorPage({ params }: Props) {
    return <AuthorArchive slug={(await params).slug} page={1} />;
}
