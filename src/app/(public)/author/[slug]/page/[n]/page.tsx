import type { Metadata } from "next";
import AuthorArchive, { authorMetadata } from "../../../archive";
import { parsePageParam } from "@/components/Archive";

export const revalidate = 300;
// Aucune page générée au build (pas besoin de la base) : chacune est créée à la première visite, puis mise en cache
export function generateStaticParams() {
    return [];
}
type Props = { params: Promise<{ slug: string; n: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, n } = await params;
    return authorMetadata(slug, Number(n) || 1);
}

export default async function AuthorPaged({ params }: Props) {
    const { slug, n } = await params;
    return <AuthorArchive slug={slug} page={parsePageParam(n, `/author/${slug}/`)} />;
}
