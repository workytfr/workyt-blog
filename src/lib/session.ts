import "server-only";
import { NextResponse } from "next/server";
import { getBlogSession } from "./auth";
import type { Actor } from "./posts";
import { PostError } from "./posts";

/** Membre connecté sous la forme utilisée par les services, ou null */
export async function currentActor(): Promise<Actor | null> {
    const s = await getBlogSession();
    if (!s?.user?.memberId) return null;
    return { memberId: s.user.memberId, role: s.user.role, name: s.user.name || "" };
}

/** Réponse JSON d'erreur, avec le détail des points bloquants le cas échéant */
export function errorResponse(error: unknown) {
    if (error instanceof PostError) return NextResponse.json({ success: false, error: error.message, issues: error.issues }, { status: error.status });
    console.error("[api]", error);
    return NextResponse.json({ success: false, error: "Erreur serveur." }, { status: 500 });
}

export const unauthorized = () => NextResponse.json({ success: false, error: "Connecte-toi." }, { status: 401 });
