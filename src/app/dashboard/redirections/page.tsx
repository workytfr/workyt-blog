import { notFound } from "next/navigation";
import { getBlogSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { list404, listRedirects } from "@/lib/redirectsAdmin";
import RedirectManager from "./RedirectManager";

type Props = { searchParams: Promise<{ q?: string }> };

/** Redirections 301 / 302 / 410 et journal des 404 (§ 13, Admin) */
export default async function RedirectsPage({ searchParams }: Props) {
    const session = (await getBlogSession())!;
    if (!can(session.user.role, "redirects.manage")) notFound();
    const { q } = await searchParams;
    const [rows, misses] = await Promise.all([listRedirects(q ?? ""), list404()]);
    return (
        <main className="min-w-0 flex-1 px-10 py-10">
            <div className="mx-auto max-w-6xl">
                <p className="eyebrow">Gestion</p>
                <h1 className="mt-1 font-display text-5xl">Redirections</h1>
                <p className="mt-2 max-w-2xl text-ink/60">
                    301 : l&apos;adresse a changé pour de bon (Google transfère le référencement). 302 : changement temporaire. 410 : le contenu est supprimé. Les changements d&apos;adresse d&apos;article ou de rubrique en créent
                    automatiquement. Une nouvelle redirection est active en moins d&apos;une minute.
                </p>
                <RedirectManager rows={rows} misses={misses} query={q ?? ""} />
            </div>
        </main>
    );
}
