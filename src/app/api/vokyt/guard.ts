import { NextResponse } from "next/server";
import { can } from "@/lib/roles";
import { currentActor, unauthorized } from "@/lib/session";
import { VokytApiError } from "@/lib/vokyt";

/** Identifiant de vocal Vokyt accepté dans les adresses */
export const NOTE_ID = /^note_[a-z0-9]{4,40}$/;

/** Rédaction seulement : sans contrôle, n'importe qui consommerait les minutes de Vokyt */
export async function editor() {
    const actor = await currentActor();
    if (!actor) return { error: unauthorized() } as const;
    if (!can(actor.role, "post.create")) return { error: NextResponse.json({ success: false, error: "Réservé à la rédaction." }, { status: 403 }) } as const;
    return { actor } as const;
}

export function vokytError(error: unknown) {
    if (error instanceof VokytApiError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("[vokyt]", error);
    return NextResponse.json({ success: false, error: "L'échange avec Vokyt a échoué. Réessaie." }, { status: 502 });
}
