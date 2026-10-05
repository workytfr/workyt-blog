import type { Metadata } from "next";
import { OlderPosts, homeMetadata } from "../../home";
import { parsePageParam } from "@/components/Archive";

export const revalidate = 300;
export function generateStaticParams() {
    return [];
}
type Props = { params: Promise<{ n: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return homeMetadata(Number((await params).n) || 1);
}

/** /page/<n>/ : les articles plus anciens, comme la pagination WordPress */
export default async function HomePaged({ params }: Props) {
    return <OlderPosts page={parsePageParam((await params).n, "/")} />;
}
