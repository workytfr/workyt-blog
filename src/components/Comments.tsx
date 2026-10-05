"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Clock, Flag, Heart, Loader2, MessageCircle, Pencil, Reply, Trash2 } from "lucide-react";
import type { CommentView } from "@/lib/comments";
import { COMMENT_MAX } from "@/lib/commentRules";
import { formatDate, formatTime } from "@/lib/format";

const MODERATORS = ["correcteur", "redac_chef", "admin"];

/**
 * Commentaires sous l'article (§ 11) : comptes Workyt connectés, réponses sur
 * un niveau, « j'aime », modification pendant 15 min, signalement. La liste
 * publiée arrive déjà dans la page (référencement) ; elle est rafraîchie dans
 * le navigateur avec ce qui concerne la personne connectée.
 */
export default function Comments({ postId, slug, initial }: { postId: string; slug: string; initial: CommentView[] }) {
    const { data: session, status } = useSession();
    const user = session?.user as { memberId?: string; role?: string; name?: string | null; image?: string | null } | undefined;
    const logged = !!user?.memberId;
    const moderator = MODERATORS.includes(user?.role ?? "");
    const [comments, setComments] = useState(initial);
    const [notice, setNotice] = useState<{ tone: "ok" | "wait" | "error"; text: string } | null>(null);
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [editing, setEditing] = useState<string | null>(null);

    const reload = useCallback(async () => {
        const j = await fetch(`/api/posts/${postId}/comments/`).then((r) => r.json()).catch(() => null);
        if (j?.success) setComments(j.data);
    }, [postId]);

    // Données propres à la personne connectée (ses commentaires en attente, ses « j'aime »)
    useEffect(() => {
        if (status === "loading") return;
        const t = setTimeout(() => void reload(), 0);
        return () => clearTimeout(t);
    }, [status, reload]);

    const call = async (url: string, init: RequestInit) => {
        const j = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init }).then((r) => r.json()).catch(() => ({ success: false, error: "Connexion impossible. Réessaie." }));
        if (!j.success) setNotice({ tone: "error", text: j.error || "Une erreur est survenue." });
        return j;
    };

    const post = async (text: string, parentId?: string) => {
        const j = await call(`/api/posts/${postId}/comments/`, { method: "POST", body: JSON.stringify({ text, parentId }) });
        if (!j.success) return false;
        setNotice(
            j.data.status === "published"
                ? { tone: "ok", text: "Merci ! Ton commentaire est publié." }
                : { tone: "wait", text: j.data.reasons.includes("premier commentaire") ? "Merci ! C'est ton premier commentaire : il sera visible dès que la rédaction l'aura validé." : "Merci ! Ton commentaire contient un lien ou des coordonnées : la rédaction va le relire avant de le publier." }
        );
        setReplyTo(null);
        await reload();
        return true;
    };

    const top = comments.filter((c) => !c.parentId);
    const replies = (id: string) => comments.filter((c) => c.parentId === id);
    const count = comments.filter((c) => c.status === "published").length;

    const item = (c: CommentView) => (
        <CommentItem
            key={c.id}
            c={c}
            logged={logged}
            moderator={moderator}
            loginHref={`/connexion/?callbackUrl=${encodeURIComponent(`/${slug}/#commentaires`)}`}
            editing={editing === c.id}
            onReply={!c.parentId && logged && c.status === "published" ? () => setReplyTo(replyTo === c.id ? null : c.id) : undefined}
            onEdit={() => setEditing(c.id)}
            onCancelEdit={() => setEditing(null)}
            onSave={async (text) => {
                const j = await call(`/api/comments/${c.id}/`, { method: "PATCH", body: JSON.stringify({ text }) });
                if (!j.success) return false;
                setEditing(null);
                if (j.data.status === "pending") setNotice({ tone: "wait", text: "Ton commentaire modifié contient un lien ou des coordonnées : il repasse en modération." });
                await reload();
                return true;
            }}
            onDelete={async () => {
                if (!confirm("Supprimer ce commentaire ?")) return;
                if ((await call(`/api/comments/${c.id}/`, { method: "DELETE" })).success) await reload();
            }}
            onLike={async () => {
                const j = await call(`/api/comments/${c.id}/`, { method: "POST", body: JSON.stringify({ action: "like" }) });
                if (j.success) setComments((list) => list.map((x) => (x.id === c.id ? { ...x, liked: j.data.liked, likes: j.data.likes } : x)));
            }}
            onReport={async () => {
                if (!confirm("Signaler ce commentaire à la modération ?")) return;
                const j = await call(`/api/comments/${c.id}/`, { method: "POST", body: JSON.stringify({ action: "report" }) });
                if (j.success) {
                    setNotice({ tone: "ok", text: "Merci, la modération va regarder ce commentaire." });
                    await reload();
                }
            }}
        />
    );

    return (
        <section id="commentaires" className="mt-12 scroll-mt-28">
            <h2 className="flex items-center gap-3 font-display text-3xl">
                {count} commentaire{count > 1 ? "s" : ""}
                <MessageCircle className="h-6 w-6 text-accent" />
            </h2>

            {/* Écrire */}
            <div className="mt-5">
                {status === "loading" ? (
                    <div className="h-[132px] animate-pulse rounded-[24px] bg-paper2" />
                ) : logged ? (
                    <div className="flex gap-3 rounded-[24px] border border-ink/10 bg-white p-4 sm:p-5">
                        {/* eslint-disable-next-line @next/next/no-img-element -- avatar workyt.fr */}
                        {user?.image ? <img src={user.image} alt="" className="h-10 w-10 shrink-0 rounded-full bg-paper2 object-cover" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent font-bold text-white">{(user?.name || "?").charAt(0)}</span>}
                        <CommentForm placeholder="Écris ton commentaire…" submitLabel="Publier" onSubmit={(t) => post(t)} />
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-4 rounded-[24px] border border-dashed border-ink/15 bg-white p-5">
                        {/* eslint-disable-next-line @next/next/no-img-element -- logo */}
                        <img src="/renard-workyt.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" />
                        <p className="min-w-0 flex-1 text-sm text-ink/65">Connecte-toi avec ton compte Workyt pour commenter et répondre.</p>
                        <Link href={`/connexion/?callbackUrl=${encodeURIComponent(`/${slug}/#commentaires`)}`} className="btn-orange px-5 py-2.5 text-sm">
                            Se connecter
                        </Link>
                    </div>
                )}
                <p className="mt-2 px-1 text-[11.5px] text-ink/45">Reste bienveillant·e. Un lien externe ou des coordonnées (e-mail, téléphone, pseudo) font passer le commentaire en modération.</p>
                {notice && (
                    <p role="status" className={`mt-3 rounded-2xl px-4 py-3 text-sm ${notice.tone === "error" ? "bg-red-50 text-red-700" : notice.tone === "wait" ? "bg-sun/20" : "bg-leaf/15"}`}>
                        {notice.text}
                    </p>
                )}
            </div>

            {/* Liste */}
            {top.length === 0 ? (
                <p className="mt-8 text-sm text-ink/50">Personne n&apos;a encore commenté. À toi de lancer la discussion !</p>
            ) : (
                <ol className="mt-8 space-y-6">
                    {top.map((c) => (
                        <li key={c.id}>
                            {item(c)}
                            {(replies(c.id).length > 0 || replyTo === c.id) && (
                                <ol className="mt-3 space-y-3 border-l-2 border-ink/10 pl-4 sm:ml-5 sm:pl-6">
                                    {replies(c.id).map((r) => (
                                        <li key={r.id}>{item(r)}</li>
                                    ))}
                                    {replyTo === c.id && (
                                        <li className="rounded-[20px] border border-ink/10 bg-white p-4">
                                            <CommentForm autoFocus placeholder={`Répondre à ${c.name}…`} submitLabel="Répondre" onSubmit={(t) => post(t, c.id)} onCancel={() => setReplyTo(null)} />
                                        </li>
                                    )}
                                </ol>
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

function CommentForm({ placeholder, submitLabel, initial = "", autoFocus, onSubmit, onCancel }: { placeholder: string; submitLabel: string; initial?: string; autoFocus?: boolean; onSubmit: (text: string) => Promise<boolean>; onCancel?: () => void }) {
    const [text, setText] = useState(initial);
    const [busy, setBusy] = useState(false);
    const ok = text.trim().length >= 2;
    return (
        <form
            className="min-w-0 flex-1"
            onSubmit={async (e) => {
                e.preventDefault();
                if (!ok || busy) return;
                setBusy(true);
                if (await onSubmit(text.trim())) setText("");
                setBusy(false);
            }}
        >
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX))}
                placeholder={placeholder}
                rows={3}
                autoFocus={autoFocus}
                aria-label={placeholder}
                className="w-full resize-y rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-[15px] outline-none transition focus:border-accent"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
                <span className={`mr-auto text-[11px] ${text.length > COMMENT_MAX - 100 ? "text-accentdark" : "text-ink/40"}`}>
                    {text.length}/{COMMENT_MAX}
                </span>
                {onCancel && (
                    <button type="button" onClick={onCancel} className="btn-ghost px-4 py-2 text-sm">
                        Annuler
                    </button>
                )}
                <button type="submit" disabled={!ok || busy} className="btn-orange px-5 py-2 text-sm disabled:opacity-50">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitLabel}
                </button>
            </div>
        </form>
    );
}

function CommentItem({
    c,
    logged,
    moderator,
    loginHref,
    editing,
    onReply,
    onEdit,
    onCancelEdit,
    onSave,
    onDelete,
    onLike,
    onReport,
}: {
    c: CommentView;
    logged: boolean;
    moderator: boolean;
    loginHref: string;
    editing: boolean;
    onReply?: () => void;
    onEdit: () => void;
    onCancelEdit: () => void;
    onSave: (text: string) => Promise<boolean>;
    onDelete: () => void;
    onLike: () => void;
    onReport: () => void;
}) {
    // Minutes restantes pour modifier (calculées dans le navigateur)
    const [now, setNow] = useState<number | null>(null);
    useEffect(() => {
        if (!c.editableUntil) return;
        const tick = () => setNow(Date.now());
        const first = setTimeout(tick, 0);
        const t = setInterval(tick, 30_000);
        return () => {
            clearTimeout(first);
            clearInterval(t);
        };
    }, [c.editableUntil]);
    const minutesLeft = c.editableUntil && now ? Math.ceil((c.editableUntil - now) / 60_000) : 0;

    if (c.status === "deleted") return <p className="rounded-[20px] bg-paper2/60 px-5 py-3 text-sm italic text-ink/45">Commentaire supprimé.</p>;

    const pending = c.status === "pending";
    return (
        <article className={`rounded-[22px] p-4 sm:p-5 ${pending ? "border border-dashed border-sun bg-sun/10" : "border border-ink/10 bg-white"}`}>
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- avatars workyt.fr ou Blobatar */}
                <img src={c.avatar} alt="" className="h-9 w-9 rounded-full bg-paper2 object-cover" />
                <span className="font-semibold">{c.name}</span>
                {c.badge === "auteur" && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">Auteur</span>}
                {c.badge === "redaction" && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">Rédaction</span>}
                <time dateTime={c.createdAt} className="text-xs text-ink/45">
                    {formatDate(c.createdAt)} à {formatTime(c.createdAt)}
                    {c.edited && " · modifié"}
                </time>
            </header>
            {pending && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8a560a]">
                    <Clock className="h-3.5 w-3.5" /> En attente de modération{c.reasons.length > 0 && ` (${c.reasons.join(", ")})`} : toi seul·e le vois pour l&apos;instant.
                </p>
            )}
            {editing ? (
                <div className="mt-3">
                    <CommentForm autoFocus initial={c.text} placeholder="Modifier ton commentaire" submitLabel="Enregistrer" onSubmit={onSave} onCancel={onCancelEdit} />
                </div>
            ) : (
                <p className="mt-2.5 whitespace-pre-line break-words text-[15px] leading-relaxed text-ink/85">{c.text}</p>
            )}
            {!editing && (
                <footer className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-ink/55">
                    {!pending &&
                        (logged && !c.mine ? (
                            <button type="button" onClick={onLike} aria-pressed={c.liked} className={`inline-flex items-center gap-1 transition hover:text-ink ${c.liked ? "text-accentdark" : ""}`}>
                                <Heart className="h-4 w-4" fill={c.liked ? "currentColor" : "none"} /> {c.likes > 0 ? c.likes : "J'aime"}
                            </button>
                        ) : logged ? (
                            <span className="inline-flex items-center gap-1" title="Mentions « j'aime »">
                                <Heart className="h-4 w-4" /> {c.likes}
                            </span>
                        ) : (
                            <Link href={loginHref} className="inline-flex items-center gap-1 hover:text-ink">
                                <Heart className="h-4 w-4" /> {c.likes > 0 ? c.likes : "J'aime"}
                            </Link>
                        ))}
                    {onReply && (
                        <button type="button" onClick={onReply} className="inline-flex items-center gap-1 hover:text-ink">
                            <Reply className="h-4 w-4" /> Répondre
                        </button>
                    )}
                    {c.mine && minutesLeft > 0 && (
                        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 hover:text-ink">
                            <Pencil className="h-3.5 w-3.5" /> Modifier ({minutesLeft} min)
                        </button>
                    )}
                    {(c.mine || moderator) && (
                        <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" /> Supprimer
                        </button>
                    )}
                    {logged && !c.mine && !pending && (
                        <button type="button" onClick={onReport} className="ml-auto inline-flex items-center gap-1 text-ink/40 hover:text-red-600" title="Signaler à la modération">
                            <Flag className="h-3.5 w-3.5" /> Signaler
                        </button>
                    )}
                </footer>
            )}
        </article>
    );
}
