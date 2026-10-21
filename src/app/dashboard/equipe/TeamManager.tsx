"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Search } from "lucide-react";
import { canAssignRole, ROLE_LABELS, ROLES, type Role } from "@/lib/roles";

interface Row {
    id: string;
    name: string;
    email: string | null;
    note: string;
    role: Role;
    avatar: string;
    published: number;
    corrected: number;
    lastLogin: string | null;
}

const TONE: Record<Role, string> = {
    lecteur: "bg-paper2 text-ink/60",
    redacteur: "bg-sky/20 text-[#1f6f96]",
    correcteur: "bg-violet-100 text-violet-700",
    redac_chef: "bg-[#ffe3cf] text-accentdark",
    admin: "bg-ink text-white",
};

export default function TeamManager({ members, me, query, view }: { members: Row[]; me: { id: string; role: Role }; query: string; view: "equipe" | "tous" }) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const change = async (m: Row, role: Role) => {
        // La liste de tous les comptes est longue : on confirme pour éviter de se tromper de ligne
        if (!window.confirm(`Passer ${m.name} de ${ROLE_LABELS[m.role]} à ${ROLE_LABELS[role]} ?`)) return;
        setBusy(m.id);
        setError(null);
        const j = await fetch(`/api/team/${m.id}/role/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) }).then((r) => r.json());
        setBusy(null);
        if (!j.success) setError(`${m.name} : ${j.error}`);
        router.refresh();
    };
    return (
        <>
            <form action="/dashboard/equipe/" className="mt-4 flex max-w-md items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm focus-within:border-accent">
                <Search className="h-4 w-4 text-ink/40" />
                {view === "tous" && <input type="hidden" name="vue" value="tous" />}
                <input name="q" defaultValue={query} placeholder="Chercher par pseudo, e-mail ou note…" className="min-w-0 flex-1 outline-none" />
            </form>
            {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-4 overflow-hidden rounded-[24px] border border-ink/10 bg-white">
                {members.length === 0 ? (
                    <p className="p-10 text-center text-sm text-ink/50">Aucun compte trouvé.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-paper text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">
                            <tr>
                                <th className="px-5 py-3">Membre</th>
                                <th className="px-5 py-3">Note</th>
                                <th className="px-5 py-3">Rôle</th>
                                <th className="px-5 py-3">Articles publiés</th>
                                <th className="px-5 py-3">Articles corrigés</th>
                                <th className="px-5 py-3">Dernière visite</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map((m) => {
                                // Rôles permis par les règles du § 6 (les mêmes que côté serveur)
                                const options = ROLES.filter((r) => r === m.role || !canAssignRole(me, { id: m.id, role: m.role }, r));
                                const locked = options.length <= 1;
                                return (
                                    <tr key={m.id} className="border-t border-ink/5">
                                        <td className="px-5 py-3">
                                            <span className="flex items-center gap-3">
                                                {/* eslint-disable-next-line @next/next/no-img-element -- avatar */}
                                                <img src={m.avatar} alt="" className="h-9 w-9 rounded-full bg-paper2/60 object-cover" />
                                                <span className="min-w-0">
                                                    <span className="flex items-center gap-1.5">
                                                        <b>{m.name}</b>
                                                        {m.id === me.id && <span className="text-xs text-ink/45">(toi)</span>}
                                                    </span>
                                                    {m.email && (
                                                        <a href={`mailto:${m.email}`} className="block truncate text-xs text-ink/50 hover:text-accentdark">
                                                            {m.email}
                                                        </a>
                                                    )}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="px-5">
                                            <NoteCell member={m} />
                                        </td>
                                        <td className="px-5">
                                            {locked ? (
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[m.role]}`} title={m.id === me.id ? "On ne change pas son propre rôle" : m.role === "admin" ? "Le rôle Admin se gère sur workyt.fr" : "Hors de tes droits"}>
                                                    {ROLE_LABELS[m.role]}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-2">
                                                    <select value={m.role} disabled={busy === m.id} onChange={(e) => change(m, e.target.value as Role)} className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold outline-none ${TONE[m.role]}`} aria-label={`Rôle de ${m.name}`}>
                                                        {options.map((r) => (
                                                            <option key={r} value={r}>
                                                                {ROLE_LABELS[r]}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {busy === m.id && <Loader2 className="h-4 w-4 animate-spin" />}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 font-display text-lg">{m.published}</td>
                                        <td className="px-5 font-display text-lg">{m.corrected}</td>
                                        <td className="px-5 text-ink/55">{m.lastLogin ?? "—"}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
}

/** Note interne (prénom, pseudo Discord…) : on clique, on écrit, Entrée ou clic ailleurs pour enregistrer, Échap pour annuler */
function NoteCell({ member }: { member: Row }) {
    const [note, setNote] = useState(member.note);
    const [draft, setDraft] = useState<string | null>(null);
    const [state, setState] = useState<"idle" | "busy" | "error">("idle");
    const save = async () => {
        if (draft === null) return;
        const next = draft.trim();
        setDraft(null);
        if (next === note) return;
        setState("busy");
        const j = await fetch(`/api/team/${member.id}/note/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: next }) })
            .then((r) => r.json())
            .catch(() => ({ success: false }));
        if (j.success) setNote(j.data.note);
        setState(j.success ? "idle" : "error");
    };
    if (draft !== null)
        return (
            <input
                autoFocus
                value={draft}
                maxLength={200}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setDraft(null);
                }}
                placeholder="Prénom, pseudo Discord…"
                aria-label={`Note sur ${member.name}`}
                className="w-full min-w-[160px] rounded-lg border border-ink/15 bg-white px-2 py-1 text-xs outline-none focus:border-accent"
            />
        );
    return (
        <button type="button" onClick={() => setDraft(note)} title="Modifier la note" className="group flex max-w-[220px] items-center gap-1.5 text-left text-xs">
            {note ? <span className="line-clamp-2 text-ink/70">{note}</span> : <span className="text-ink/35 group-hover:text-ink/60">Ajouter une note</span>}
            {state === "busy" ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ink/40" /> : <Pencil className="h-3.5 w-3.5 shrink-0 text-ink/25 opacity-0 group-hover:opacity-100" />}
            {state === "error" && <span className="text-red-700">non enregistrée</span>}
        </button>
    );
}
