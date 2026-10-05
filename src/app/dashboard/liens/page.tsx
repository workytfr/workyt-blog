import { currentActor } from "@/lib/session";
import { can } from "@/lib/roles";
import { listLinks } from "@/lib/affiliate";
import LinkManager from "./LinkManager";

/** Gestionnaire de liens affiliés (§ 9.1) */
export default async function LinksPage() {
    const actor = (await currentActor())!;
    const links = await listLinks(actor);
    return (
        <main className="min-w-0 flex-1 px-10 py-12">
            <div className="mx-auto max-w-6xl">
                <p className="eyebrow">Rédaction</p>
                <h1 className="mt-1 font-display text-5xl">Liens affiliés</h1>
                <p className="mt-2 max-w-2xl text-ink/60">
                    Les articles pointent vers <code className="rounded bg-paper2 px-1.5">/go/nom/</code> : on change l&apos;adresse du marchand ici, à un seul endroit. Les clics sont comptés sans cookie, et chaque lien est vérifié
                    chaque nuit.
                </p>
                <LinkManager initial={links} canManage={can(actor.role, "links.manage")} />
            </div>
        </main>
    );
}
