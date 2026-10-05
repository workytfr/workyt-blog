import { currentActor } from "@/lib/session";
import { listInvitations } from "@/lib/review";
import Invitations from "./Invitations";

/** Coups de cœur qu'on m'a demandé d'écrire dans les articles des autres (§ 9) */
export default async function InvitationsPage() {
    const actor = (await currentActor())!;
    const items = await listInvitations(actor);
    return (
        <main className="min-w-0 flex-1 px-10 py-12">
            <div className="mx-auto max-w-3xl">
                <p className="eyebrow">Rédaction</p>
                <h1 className="mt-1 font-display text-5xl">Mes coups de cœur invités</h1>
                <p className="mt-2 text-ink/60">Un rédacteur t&apos;a invité à signer un coup de cœur dans son article. Écris ton texte puis valide-le : tu seras crédité sur l&apos;article et sur ta page auteur.</p>
                <Invitations initial={items} />
            </div>
        </main>
    );
}
