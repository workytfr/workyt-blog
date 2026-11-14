"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ExternalLink, FileAudio, Loader2, Mic, Square, Users, X } from "lucide-react";
import { parseVokytNote } from "../nodes";

/**
 * Extrait audio Vokyt depuis l'éditeur : enregistrer au micro, envoyer un fichier ou reprendre
 * un vocal existant. L'audio part directement du navigateur vers le stockage de Vokyt (adresse
 * signée demandée par le serveur du blog, qui garde la clé secrète), puis Vokyt le transcrit.
 * « Plusieurs voix » : Vokyt sépare les intervenants (podcast, interview).
 */

const MAX_MS = 3 * 60_000;
const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPTED = ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav"];
const VOKYT_URL = "https://vokyt.cc";

type Tab = "record" | "file" | "existing";
type Take = { blob: Blob; url: string; ms: number };
type NoteView = { id: string; status: string; title: string | null; durationMs: number | null; multiVoice: boolean; excerpt: string; error: string | null };
type Sent = { id: string; status: string; error: string | null; multiVoice: boolean };

const mmss = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`;
const baseType = (t: string) => t.split(";")[0].trim().toLowerCase();

async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { success?: boolean; data?: T; error?: string } | null;
    if (!res?.ok || !body?.success) throw new Error(body?.error || "Connexion impossible. Réessaie.");
    return body.data as T;
}

/** Durée d'un fichier audio, lue par le navigateur (0 si illisible) */
function audioDuration(url: string): Promise<number> {
    return new Promise((resolve) => {
        const a = new Audio();
        a.preload = "metadata";
        a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration * 1000 : 0);
        a.onerror = () => resolve(0);
        a.src = url;
    });
}

export default function VokytRecorder({ open, postId, onClose, onInsert }: { open: boolean; postId: string; onClose: () => void; onInsert: (noteId: string) => void }) {
    const [tab, setTab] = useState<Tab>("record");
    const [take, setTake] = useState<Take | null>(null);
    const [title, setTitle] = useState("");
    const [multiVoice, setMultiVoice] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState<Sent | null>(null);
    // Enregistrement
    const [recording, setRecording] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [level, setLevel] = useState(0);
    const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; ctx: AudioContext; timer: number; raf: number; started: number } | null>(null);
    // Vocaux existants
    const [notes, setNotes] = useState<NoteView[] | null>(null);
    const [listError, setListError] = useState("");
    const [pasted, setPasted] = useState("");

    const stopTracks = () => {
        const r = rec.current;
        if (!r) return;
        clearInterval(r.timer);
        cancelAnimationFrame(r.raf);
        r.stream.getTracks().forEach((t) => t.stop());
        void r.ctx.close().catch(() => {});
        rec.current = null;
    };

    // Fenêtre fermée : micro coupé, prise oubliée
    useEffect(() => {
        if (open) return;
        if (rec.current?.mr.state === "recording") rec.current.mr.stop();
        stopTracks();
    }, [open]);
    useEffect(() => () => stopTracks(), []);
    useEffect(() => () => (take ? URL.revokeObjectURL(take.url) : undefined), [take]);

    // Liste des vocaux, à l'ouverture de l'onglet
    useEffect(() => {
        if (!open || tab !== "existing" || notes) return;
        api<NoteView[]>("/api/vokyt/notes/")
            .then((n) => setNotes(n.filter((x) => x.status === "ready" || x.status === "processing" || x.status === "queued")))
            .catch((e: Error) => {
                setNotes([]);
                setListError(e.message);
            });
    }, [open, tab, notes]);

    // Suivi du traitement, une fois le vocal envoyé
    useEffect(() => {
        if (!sent || sent.status === "ready" || sent.status === "failed") return;
        const t = window.setTimeout(async () => {
            const n = await api<NoteView>(`/api/vokyt/notes/${sent.id}/`).catch(() => null);
            setSent((s) => (s && n ? { ...s, status: n.status, error: n.error } : s));
        }, 3000);
        return () => clearTimeout(t);
    }, [sent]);

    async function startRecording() {
        setError("");
        setTake(null);
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        } catch {
            setError("Micro refusé. Autorise le micro dans le navigateur, ou envoie un fichier.");
            return;
        }
        const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
        const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
        const chunks: Blob[] = [];
        mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        mr.onstop = () => {
            const ms = rec.current ? Date.now() - rec.current.started : elapsed;
            stopTracks();
            setRecording(false);
            setLevel(0);
            const blob = new Blob(chunks, { type: baseType(mr.mimeType || "audio/webm") });
            if (blob.size) setTake({ blob, url: URL.createObjectURL(blob), ms });
        };
        // Niveau du micro : on voit que ça capte
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        const tick = () => {
            analyser.getByteTimeDomainData(buf);
            let peak = 0;
            for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
            setLevel(Math.min(1, peak / 64));
            if (rec.current) rec.current.raf = requestAnimationFrame(tick);
        };
        const started = Date.now();
        const timer = window.setInterval(() => {
            const ms = Date.now() - started;
            setElapsed(ms);
            if (ms >= MAX_MS && mr.state === "recording") mr.stop();
        }, 250);
        rec.current = { mr, stream, ctx, timer, raf: requestAnimationFrame(tick), started };
        setElapsed(0);
        setRecording(true);
        mr.start(1000);
    }

    async function chooseFile(file: File | undefined) {
        setError("");
        setTake(null);
        if (!file) return;
        const type = baseType(file.type);
        if (!ACCEPTED.includes(type)) return setError("Format non accepté : MP3, M4A, WAV, OGG ou WebM.");
        if (file.size > MAX_BYTES) return setError("Fichier trop lourd (50 Mo maximum).");
        const url = URL.createObjectURL(file);
        const ms = await audioDuration(url);
        if (ms > MAX_MS + 2000) {
            URL.revokeObjectURL(url);
            return setError("Extrait trop long : 3 minutes maximum. Le podcast complet se met avec le bloc Spotify.");
        }
        setTake({ blob: file, url, ms });
        if (!title) setTitle(file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 120));
    }

    async function send() {
        if (!take) return;
        setBusy(true);
        setError("");
        try {
            const contentType = baseType(take.blob.type) || "audio/webm";
            const created = await api<{ id: string; upload: { url: string; method: string; headers: Record<string, string> } }>("/api/vokyt/notes/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, contentType, bytes: take.blob.size, durationMs: Math.round(take.ms), multiVoice, postId }),
            });
            try {
                const put = await fetch(created.upload.url, { method: "PUT", headers: created.upload.headers, body: take.blob }).catch(() => null);
                if (!put?.ok) throw new Error("L'envoi du fichier a échoué. Vérifie ta connexion et réessaie.");
                await api(`/api/vokyt/notes/${created.id}/complete/`, { method: "POST" });
            } catch (e) {
                // Envoi abandonné : le vocal vide est supprimé, les minutes réservées rendues
                void fetch(`/api/vokyt/notes/${created.id}/`, { method: "DELETE" }).catch(() => {});
                throw e;
            }
            // Le bloc est posé tout de suite : le lecteur s'affichera quand Vokyt aura fini
            onInsert(created.id);
            setSent({ id: created.id, status: "queued", error: null, multiVoice });
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }

    const reset = () => {
        setSent(null);
        setTake(null);
        setTitle("");
        setMultiVoice(false);
        setError("");
    };

    if (!open) return null;
    const tabBtn = (t: Tab, label: string, Icon: typeof Mic) => (
        <button
            type="button"
            onClick={() => !recording && setTab(t)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${tab === t ? "bg-ink text-white" : "text-ink/60"}`}
            aria-pressed={tab === t}
        >
            <Icon className="h-3.5 w-3.5" /> {label}
        </button>
    );

    return createPortal(
        <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label="Extrait audio" onClick={() => !recording && onClose()}>
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-wrap items-center gap-3 border-b border-ink/10 px-6 py-4">
                    <h2 className="font-display text-2xl">Extrait audio</h2>
                    {!sent && (
                        <div className="flex gap-1 rounded-full border border-ink/10 bg-white p-1 text-sm font-semibold">
                            {tabBtn("record", "Enregistrer", Mic)}
                            {tabBtn("file", "Fichier", FileAudio)}
                            {tabBtn("existing", "Vocal existant", CheckCircle2)}
                        </div>
                    )}
                    <button type="button" onClick={onClose} disabled={recording} className="ml-auto grid h-9 w-9 place-items-center rounded-full hover:bg-paper2 disabled:opacity-40" aria-label="Fermer">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                    {sent ? (
                        <SentStatus sent={sent} onAnother={reset} onClose={onClose} />
                    ) : tab === "existing" ? (
                        <div className="space-y-4">
                            {notes === null ? (
                                <div className="grid place-items-center py-10 text-ink/40">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            ) : notes.length === 0 ? (
                                <p className="rounded-2xl border border-dashed border-ink/15 p-6 text-center text-sm text-ink/60">{listError || "Aucun vocal sur Vokyt pour l'instant."}</p>
                            ) : (
                                <ul className="space-y-2">
                                    {notes.map((n) => (
                                        <li key={n.id}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onInsert(n.id);
                                                    onClose();
                                                }}
                                                className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-left hover:border-ink/30"
                                            >
                                                <span className="flex items-center gap-2 text-sm font-semibold">
                                                    {n.multiVoice && <Users className="h-4 w-4 shrink-0 text-ink/50" aria-label="Plusieurs voix" />}
                                                    <span className="min-w-0 flex-1 truncate">{n.title || "Sans titre"}</span>
                                                    <span className="text-xs font-normal text-ink/50">{n.status === "ready" ? (n.durationMs ? mmss(n.durationMs) : "") : "en traitement"}</span>
                                                </span>
                                                {n.excerpt && <span className="mt-1 line-clamp-1 block text-xs text-ink/55">{n.excerpt}</span>}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {/* Toujours possible, même sans clé secrète : coller l'identifiant du vocal */}
                            <form
                                className="flex gap-2 border-t border-ink/10 pt-4"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const id = parseVokytNote(pasted);
                                    if (!id) return setError("Vocal non reconnu : colle son identifiant (note_…) ou son lien d'écoute.");
                                    onInsert(id);
                                    onClose();
                                }}
                            >
                                <input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Ou coller un identifiant ou un lien d'écoute (note_…)" className="min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm outline-none focus:border-ink/40" />
                                <button type="submit" className="btn-ink px-4 py-2 text-sm">
                                    Insérer
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {tab === "record" ? (
                                <div className="flex flex-col items-center gap-4 rounded-[24px] border border-ink/10 bg-white px-6 py-8 text-center">
                                    <button
                                        type="button"
                                        onClick={() => (recording ? rec.current?.mr.stop() : void startRecording())}
                                        className={`grid h-20 w-20 place-items-center rounded-full text-white transition ${recording ? "bg-red-600" : "bg-ink hover:scale-105"}`}
                                        style={recording ? { boxShadow: `0 0 0 ${4 + level * 18}px rgb(220 38 38 / 0.18)` } : undefined}
                                        aria-label={recording ? "Arrêter l'enregistrement" : "Enregistrer"}
                                    >
                                        {recording ? <Square className="h-7 w-7" fill="currentColor" /> : <Mic className="h-8 w-8" />}
                                    </button>
                                    <p className="font-mono text-sm text-ink/70" aria-live="polite">
                                        {recording ? `● ${mmss(elapsed)} / 3:00` : take ? "Ta prise" : "Prêt à enregistrer"}
                                    </p>
                                    <p className="text-xs text-ink/50">3 minutes maximum · idéal entre 30 s et 1 min 30</p>
                                </div>
                            ) : (
                                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[24px] border border-dashed border-ink/20 bg-white px-6 py-8 text-center hover:border-ink/40">
                                    <FileAudio className="h-8 w-8 text-ink/50" />
                                    <span className="text-sm font-semibold">Choisir un fichier audio</span>
                                    <span className="text-xs text-ink/50">MP3, M4A, WAV, OGG ou WebM · 3 minutes et 50 Mo maximum</span>
                                    <input type="file" accept={ACCEPTED.join(",")} className="sr-only" onChange={(e) => void chooseFile(e.target.files?.[0])} />
                                </label>
                            )}

                            {take && !recording && <audio src={take.url} controls className="w-full" />}

                            <label className="block">
                                <span className="mb-1.5 block text-sm font-semibold">Titre de l&apos;extrait</span>
                                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Ex. Le moment où tout a basculé" className="w-full rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-ink/40" />
                            </label>
                            <label className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-white p-4">
                                <input type="checkbox" checked={multiVoice} onChange={(e) => setMultiVoice(e.target.checked)} className="mt-1 h-4 w-4" />
                                <span>
                                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                                        <Users className="h-4 w-4" /> Plusieurs voix (podcast, interview)
                                    </span>
                                    <span className="mt-0.5 block text-xs text-ink/60">
                                        Vokyt sépare les intervenants. Tu diras ensuite qui parle sur Vokyt : son nom, sa photo et sa couleur s&apos;afficheront dans la transcription.
                                    </span>
                                </span>
                            </label>

                            {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

                            <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={onClose} disabled={recording} className="rounded-full px-4 py-2 text-sm font-semibold text-ink/60 hover:bg-paper2">
                                    Annuler
                                </button>
                                <button type="button" onClick={() => void send()} disabled={!take || busy || recording} className="btn-ink px-5 py-2.5 text-sm disabled:opacity-40">
                                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />} {busy ? "Envoi…" : "Envoyer et insérer"}
                                </button>
                            </div>
                        </div>
                    )}
                    {tab === "existing" && error && !sent && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
                </div>
            </div>
        </div>,
        document.body
    );
}

/** Après l'envoi : suivi du traitement, et le lien pour relire et nommer les voix sur Vokyt */
function SentStatus({ sent, onAnother, onClose }: { sent: Sent; onAnother: () => void; onClose: () => void }) {
    const ready = sent.status === "ready";
    const failed = sent.status === "failed";
    return (
        <div className="space-y-5 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-paper2">
                {ready ? <CheckCircle2 className="h-8 w-8 text-ink" /> : failed ? <X className="h-8 w-8 text-red-600" /> : <Loader2 className="h-8 w-8 animate-spin text-ink/60" />}
            </div>
            <div aria-live="polite">
                <p className="font-display text-xl">{ready ? "Extrait prêt" : failed ? "Le traitement a échoué" : "Extrait inséré, transcription en cours…"}</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">
                    {failed
                        ? sent.error || "Supprime le bloc et renvoie l'extrait."
                        : ready
                          ? sent.multiVoice
                              ? "Dernière étape : sur Vokyt, relis la transcription et dis qui parle (nom, photo, couleur)."
                              : "Tu peux relire la transcription sur Vokyt avant de publier."
                          : "Tu peux continuer à écrire : le lecteur apparaîtra dans l'article dès que Vokyt aura fini."}
                </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
                <a href={`${VOKYT_URL}/tableau-de-bord/vocaux/${sent.id}`} target="_blank" rel="noopener noreferrer" className="btn-ink px-5 py-2.5 text-sm">
                    <ExternalLink className="h-4 w-4" /> {sent.multiVoice ? "Nommer les voix sur Vokyt" : "Ouvrir sur Vokyt"}
                </a>
                <button type="button" onClick={onAnother} className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold hover:bg-paper2">
                    Un autre extrait
                </button>
                <button type="button" onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink/60 hover:bg-paper2">
                    Fermer
                </button>
            </div>
        </div>
    );
}
