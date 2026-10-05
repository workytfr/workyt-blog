"use client";

import "katex/dist/katex.min.css";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import {
    AlertTriangle,
    ArrowLeft,
    Bold,
    CalendarClock,
    CheckCircle2,
    Clock,
    Hand,
    Info,
    Lock,
    MessageSquare,
    MessageSquarePlus,
    PenLine,
    Send,
    ShoppingBag,
    Trash2,
    X,
    Code,
    Eye,
    GripVertical,
    Heading2,
    Heading3,
    Highlighter,
    Image as ImageIcon,
    Italic,
    Link2,
    List,
    ListOrdered,
    Loader2,
    Plus,
    Quote,
    Redo2,
    Rocket,
    Sigma,
    Strikethrough,
    Underline,
    Undo2,
    type LucideIcon,
} from "lucide-react";
import type { MediaView } from "@/lib/media";
import { editorExtensions } from "./editorExtensions";
import { PICK_IMAGE_EVENT } from "./slash";
import MediaPicker from "./MediaPicker";
import TableMenu from "./TableMenu";
import SidePanel, { type PanelState, type PanelTab } from "./SidePanel";
import ReviewPanel, { type PendingAnchor } from "./ReviewPanel";
import { SUGGEST_INTERNAL, setSuggesting } from "./suggestMode";
import { documentSuggestions } from "../marks";
import { STATUS_LABELS, type EditorCategory, type EditorPost, type ReviewState } from "../types";
import { ACTION_LABELS, NEEDS_REASON, type EditMode, type WorkflowAction } from "@/lib/workflow";
import type { ArticleModule, ModuleImage } from "@/lib/modules/types";
import ModulesTab, { ModulesContext } from "./modules/ModulesTab";
import type { TeamMember } from "./modules/ModuleForm";
import AffiliatePicker from "./modules/AffiliatePicker";
import SeoAssistant, { SeoGauge, type LinkSuggestion } from "./SeoAssistant";
import { analyzeSeo, type SeoTarget } from "@/lib/seo/analyze";
import type { JSONContent } from "@tiptap/core";
import { useAffiliateLinks } from "./modules/fields";
import { hostOf, setEditorAffiliates } from "@/lib/linkIcon";

type SaveState = "saved" | "dirty" | "saving" | "error";

interface LockState {
    /** Réponse reçue au moins une fois */
    known: boolean;
    mine: boolean;
    holder: string | null;
    requestedBy: string | null;
    people: { name: string; editing: boolean }[];
}

const PRIMARY: WorkflowAction[] = ["approve", "publish", "validate", "take", "submit", "restore"];

/**
 * L'éditeur d'article : page d'écriture par blocs, barre d'outils, panneau
 * latéral, enregistrement automatique (lot 2), et le circuit de relecture
 * (lot 3) : boutons d'étape, mode suggestion du correcteur, commentaires,
 * versions, présence et verrou d'édition.
 */
export default function BlogEditor({ post, categories, me, initialReview, team }: { post: EditorPost; categories: EditorCategory[]; me: { id: string; name: string; admin?: boolean }; initialReview: ReviewState; team: TeamMember[] }) {
    const router = useRouter();
    const [title, setTitle] = useState(post.title === "Sans titre" ? "" : post.title);
    const [meta, setMeta] = useState<PanelState>({
        slug: post.slug,
        excerpt: post.excerpt,
        categories: post.categories,
        primaryCategory: post.primaryCategory,
        tags: post.tags,
        featuredImage: post.featuredImage,
        featuredMediaId: undefined,
        seo: post.seo,
        isPillar: post.isPillar,
    });
    const [status, setStatus] = useState(post.status);
    const [modules, setModules] = useState<ArticleModule[]>(post.modules);
    const [affiliate, setAffiliate] = useState(false);
    // Image demandée par un formulaire de module : la médiathèque répond par cette promesse
    const pickResolve = useRef<((m: ModuleImage | null) => void) | null>(null);
    const [review, setReview] = useState<ReviewState>(initialReview);
    const [scheduledAt, setScheduledAt] = useState<string | null>(post.scheduledAt);
    const [save, setSave] = useState<SaveState>("saved");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState<string>(post.updatedAt);
    const [picker, setPicker] = useState<null | "content" | "featured" | "replace" | "module">(null);
    const [issues, setIssues] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [dialog, setDialog] = useState<WorkflowAction | null>(null);
    const [tab, setTab] = useState<PanelTab>(initialReview.mode === "suggest" || post.status === "to_revise" ? "relecture" : "article");
    // Onglet courant, lu par les gestionnaires de l'éditeur (créés une seule fois)
    const tabRef = useRef(tab);
    useEffect(() => {
        tabRef.current = tab;
    }, [tab]);
    const [pendingAnchor, setPendingAnchor] = useState<PendingAnchor | null>(null);
    const [focusThread, setFocusThread] = useState<string | null>(null);
    const [lock, setLock] = useState<LockState>({ known: false, mine: false, holder: null, requestedBy: null, people: [] });
    const [staleStatus, setStaleStatus] = useState(false);
    // Assistant SEO : texte relu 0,6 s après la dernière frappe, vérifications serveur à part
    const [docJson, setDocJson] = useState<JSONContent | null>(post.contentJson);
    const [keywordTaken, setKeywordTaken] = useState<boolean | null>(null);
    const [seoExtra, setSeoExtra] = useState<{ suggestions: LinkSuggestion[]; deadLinks: string[] } | null>(null);
    const dirtyFields = useRef<Set<string>>(new Set());
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveRef = useRef<() => Promise<boolean>>(async () => true);
    const active = useRef(false);
    const loadedAt = useRef(new Date(post.updatedAt).getTime());
    const statusRef = useRef(post.status);
    // Bloc survolé par la poignée (pour « + » : insérer juste dessous)
    const hovered = useRef<{ pos: number; size: number } | null>(null);

    const canWrite = review.mode !== "read" && lock.mine;
    const metaWritable = canWrite && review.mode === "edit";

    const editor = useEditor({
        extensions: editorExtensions(),
        content: post.contentJson ?? "",
        immediatelyRender: false,
        editable: false,
        editorProps: {
            attributes: {
                class: "post-content wk-editor outline-none",
                spellcheck: "true",
                lang: "fr",
            },
            // Un clic sur un passage commenté ouvre sa discussion
            handleClickOn: (_view, _pos, node, _nodePos, event) => {
                const el = (event.target as HTMLElement | null)?.closest?.("[data-comment]");
                if (el) {
                    setFocusThread(el.getAttribute("data-comment"));
                    setTab("relecture");
                    return false;
                }
                // Clic sur un bloc : ses réglages s'ouvrent (image : légende, source et licence)
                if (node.type.name === "image") {
                    setTab("bloc");
                    const a = node.attrs as { alt?: string; creditAuthor?: string; creditSource?: string; creditLicense?: string };
                    const target = !(a.creditAuthor && a.creditSource && a.creditLicense) ? "bloc-credit-author" : !a.alt ? "bloc-image-alt" : null;
                    if (target) setTimeout(() => document.getElementById(target)?.focus(), 80);
                } else if (node.type.name === "callout" && tabRef.current !== "relecture") setTab("bloc");
                else if (node.type.name === "moduleEmbed") setTab("modules");
                return false;
            },
        },
        onUpdate: ({ transaction }) => {
            if (transaction.docChanged) markDirty("content");
        },
    });

    // Liens affiliés : le logo du marchand à droite du lien, comme dans l'article
    const affiliateLinks = useAffiliateLinks();
    useEffect(() => {
        if (!editor || !affiliateLinks) return;
        setEditorAffiliates(Object.fromEntries(affiliateLinks.flatMap((l) => (hostOf(l.url) ? [[l.name, hostOf(l.url)!]] : []))));
        editor.view.dispatch(editor.state.tr.setMeta("linkIcons$", true).setMeta(SUGGEST_INTERNAL, true));
    }, [editor, affiliateLinks]);

    // Texte pour l'assistant SEO, relu après une courte pause
    useEffect(() => {
        if (!editor) return;
        let t: ReturnType<typeof setTimeout> | undefined;
        const onUpdate = () => {
            clearTimeout(t);
            t = setTimeout(() => setDocJson(editor.getJSON()), 600);
        };
        editor.on("update", onUpdate);
        return () => {
            clearTimeout(t);
            editor.off("update", onUpdate);
        };
    }, [editor]);

    // Mot-clé principal déjà visé par un autre article ?
    const mainKeyword = meta.seo.focusKeywords[0]?.trim() ?? "";
    useEffect(() => {
        if (!mainKeyword) return;
        const t = setTimeout(async () => {
            const j = await fetch(`/api/seo/keyword/?k=${encodeURIComponent(mainKeyword)}&exclude=${post.id}`).then((r) => r.json()).catch(() => null);
            setKeywordTaken(j?.success ? j.data.taken : null);
        }, 600);
        return () => clearTimeout(t);
    }, [mainKeyword, post.id]);

    const loadSeoExtra = useCallback(async () => {
        const j = await fetch(`/api/posts/${post.id}/seo/`).then((r) => r.json()).catch(() => null);
        setSeoExtra(j?.success ? j.data : { suggestions: [], deadLinks: [] });
    }, [post.id]);
    useEffect(() => {
        const t = setTimeout(() => void loadSeoExtra(), 0);
        return () => clearTimeout(t);
    }, [loadSeoExtra]);

    // Écriture permise ou non, suggestions ou non
    useEffect(() => {
        if (!editor) return;
        setSuggesting(editor, review.mode === "suggest", me.name);
        // Sans événement « update » : changer de mode n'est pas une modification à enregistrer
        editor.setEditable(canWrite, false);
    }, [editor, canWrite, review.mode, me.name]);

    const markDirty = useCallback((field: string) => {
        dirtyFields.current.add(field);
        active.current = true;
        setSave("dirty");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void saveRef.current(), 1500);
    }, []);

    // Enregistrement : on n'envoie que ce qui a changé (fonction tenue à jour après chaque rendu)
    useLayoutEffect(() => {
        saveRef.current = async () => {
            if (!dirtyFields.current.size) return true;
            const fields = new Set(dirtyFields.current);
            dirtyFields.current.clear();
            const body: Record<string, unknown> = {};
            if (fields.has("title")) body.title = title;
            if (fields.has("content") && editor) body.contentJson = editor.getJSON();
            if (fields.has("slug")) body.slug = meta.slug;
            if (fields.has("excerpt")) body.excerpt = meta.excerpt;
            if (fields.has("categories")) {
                body.categories = meta.categories;
                body.primaryCategory = meta.primaryCategory;
            }
            if (fields.has("tags")) body.tags = meta.tags;
            if (fields.has("featured")) body.featuredMediaId = meta.featuredImage ? (meta.featuredMediaId ?? undefined) : null;
            if (fields.has("seo")) body.seo = meta.seo;
            if (fields.has("modules")) body.modules = modules;
            if (fields.has("pillar")) body.isPillar = meta.isPillar;
            setSave("saving");
            try {
                const r = await fetch(`/api/posts/${post.id}/`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                const j = await r.json();
                // Main perdue (quelqu'un d'autre modifie) : on passe en lecture
                if (r.status === 409) setLock((l) => ({ ...l, mine: false }));
                if (!j.success) throw new Error(j.error || "Enregistrement impossible.");
                if (j.data.slug !== meta.slug) setMeta((m) => ({ ...m, slug: j.data.slug }));
                // Modules relus du serveur (nettoyés, invitations) si rien n'a changé entre-temps
                if (j.data.modules && !dirtyFields.current.has("modules")) setModules(j.data.modules);
                setSavedAt(j.data.savedAt);
                loadedAt.current = new Date(j.data.savedAt).getTime();
                setSaveError(null);
                setSave(dirtyFields.current.size ? "dirty" : "saved");
                return true;
            } catch (err) {
                fields.forEach((f) => dirtyFields.current.add(f));
                setSaveError((err as Error).message);
                setSave("error");
                return false;
            }
        };
    });

    // Présence et verrou : un signal toutes les 15 s
    const beat = useCallback(
        async (extra: Record<string, boolean> = {}) => {
            const body = { want: review.mode === "read" ? "view" : "edit", active: active.current, ...extra };
            active.current = false;
            try {
                const j = await fetch(`/api/posts/${post.id}/presence/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
                if (!j.success || !j.data) return;
                const d = j.data as { mine: boolean; holder: string | null; requestedBy: string | null; people: LockState["people"]; status: string; updatedAt: string | null };
                setLock((prev) => {
                    // On reprend la main sur un texte modifié entre-temps par quelqu'un d'autre : on recharge
                    if (d.mine && !prev.mine && prev.known && d.updatedAt && new Date(d.updatedAt).getTime() > loadedAt.current + 2000 && !dirtyFields.current.size) window.location.reload();
                    return { known: true, mine: d.mine, holder: d.holder, requestedBy: d.requestedBy, people: d.people };
                });
                if (d.status !== statusRef.current) setStaleStatus(true);
            } catch {
                /* réseau coupé : on réessaie au prochain signal */
            }
        },
        [post.id, review.mode]
    );
    // Activité : toute interaction avec la page (relire, choisir une image, remplir un module…),
    // pas seulement une modification enregistrée. Sans la main et sans personne qui l'a :
    // on la reprend tout de suite, sans attendre le prochain signal.
    const lockRef = useRef(lock);
    useEffect(() => {
        lockRef.current = lock;
    }, [lock]);
    useEffect(() => {
        let retaking = false;
        const mark = () => {
            active.current = true;
            const l = lockRef.current;
            if (l.known && !l.mine && !l.holder && review.mode !== "read" && !retaking) {
                retaking = true;
                void beat().finally(() => (retaking = false));
            }
        };
        const events = ["keydown", "pointerdown", "wheel"] as const;
        events.forEach((e) => window.addEventListener(e, mark, { capture: true, passive: true }));
        return () => events.forEach((e) => window.removeEventListener(e, mark, { capture: true }));
    }, [beat, review.mode]);

    useEffect(() => {
        void beat();
        const t = setInterval(() => void beat(), 15_000);
        const leave = () => navigator.sendBeacon?.(`/api/posts/${post.id}/presence/`, JSON.stringify({ leave: true }));
        window.addEventListener("pagehide", leave);
        return () => {
            clearInterval(t);
            window.removeEventListener("pagehide", leave);
        };
    }, [beat, post.id]);

    // Ctrl+S, et alerte avant de quitter avec des changements non enregistrés
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                void saveRef.current();
            }
        };
        const onLeave = (e: BeforeUnloadEvent) => {
            if (dirtyFields.current.size) e.preventDefault();
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("beforeunload", onLeave);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("beforeunload", onLeave);
        };
    }, []);

    // Le menu « / » demande une image : on ouvre la médiathèque
    useEffect(() => {
        const open = () => setPicker("content");
        window.addEventListener(PICK_IMAGE_EVENT, open);
        return () => window.removeEventListener(PICK_IMAGE_EVENT, open);
    }, []);

    const insertMedia = (m: MediaView) => {
        if (!editor) return;
        const attrs = {
            src: m.url,
            alt: m.alt,
            width: m.width,
            height: m.height,
            mediaId: m.id,
            caption: "",
            creditAuthor: m.credit.author,
            creditSource: m.credit.source,
            creditLicense: m.credit.license,
            creditUrl: m.credit.sourceUrl,
        };
        if (picker === "replace") editor.chain().focus().updateAttributes("image", attrs).run();
        else editor.chain().focus().insertContent({ type: "image", attrs }).run();
    };

    const pickModuleImage = () =>
        new Promise<ModuleImage | null>((resolve) => {
            pickResolve.current = resolve;
            setPicker("module");
        });

    const updateModules = (next: ArticleModule[]) => {
        if (!metaWritable) return;
        setModules(next);
        markDirty("modules");
    };

    const updateMeta = (patch: Partial<PanelState>, field: string) => {
        if (!metaWritable) return;
        setMeta((m) => ({ ...m, ...patch }));
        markDirty(field);
    };

    /** Une étape du circuit (après avoir enregistré) */
    const runAction = async (action: WorkflowAction, opts: { reason?: string; at?: string | null } = {}) => {
        setBusy(true);
        setIssues([]);
        try {
            if (!(await saveRef.current())) return false;
            const j = await fetch(`/api/posts/${post.id}/workflow/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...opts }) }).then((r) => r.json());
            if (!j.success) {
                setIssues(j.issues?.length ? j.issues : [j.error]);
                return false;
            }
            setStatus(j.data.status);
            statusRef.current = j.data.status;
            setScheduledAt(j.data.scheduledAt);
            setReview({ actions: j.data.actions, mode: j.data.mode, corrector: j.data.corrector, workflow: j.data.workflow });
            setStaleStatus(false);
            // Le changement de statut rend la main : on la redemande tout de suite
            setLock((l) => ({ ...l, mine: false }));
            setTimeout(() => void beat(), 50);
            return true;
        } finally {
            setBusy(false);
        }
    };

    const seoReport = analyzeSeo({
        title,
        seoTitle: meta.seo.title,
        seoDescription: meta.seo.description,
        excerpt: meta.excerpt,
        slug: meta.slug,
        keywords: meta.seo.focusKeywords,
        doc: docJson,
        featuredImage: meta.featuredImage ? { alt: meta.featuredImage.alt } : null,
        modules,
        keywordTaken: mainKeyword ? keywordTaken : null,
        deadLinks: seoExtra?.deadLinks,
    });

    /** « Voir » d'un critère SEO : le champ concerné, ou le bloc du texte */
    const goToTarget = (t: SeoTarget) => {
        if ("field" in t) {
            const ids = { seoTitle: ["seo", "seo-title"], seoDescription: ["seo", "seo-description"], keywords: ["seo", "seo-keywords"], slug: ["article", "post-slug"], featured: ["article", ""] } as const;
            const [tabName, id] = ids[t.field];
            setTab(tabName);
            if (id) setTimeout(() => document.getElementById(id)?.focus(), 50);
            return;
        }
        if (!editor || t.block >= editor.state.doc.childCount) return;
        let pos = 0;
        for (let i = 0; i < t.block; i++) pos += editor.state.doc.child(i).nodeSize;
        const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
        dom?.scrollIntoView({ behavior: "smooth", block: "center" });
        dom?.classList.add("wk-flash");
        setTimeout(() => dom?.classList.remove("wk-flash"), 1600);
        if (canWrite) editor.commands.setTextSelection(pos + 1);
    };

    const insertSuggestion = (s: LinkSuggestion) => {
        if (!editor || !canWrite) return;
        if (editor.state.selection.empty) editor.chain().focus().insertContent([{ type: "text", text: s.anchor, marks: [{ type: "link", attrs: { href: s.href } }] }, { type: "text", text: " " }]).run();
        else editor.chain().focus().setLink({ href: s.href }).run();
    };

    const onAction = (a: WorkflowAction) => {
        // Score SEO < 60 : avertissement, pas blocage (§ 7.2)
        if (a === "submit" && seoReport.score < 60 && !window.confirm(`Score SEO : ${seoReport.score}/100. Le seuil conseillé est 60 avant la correction.\n\nEnvoyer quand même ?`)) return;
        if (NEEDS_REASON.includes(a) || a === "approve" || a === "publish" || a === "trash" || a === "unpublish") setDialog(a);
        else void runAction(a);
    };

    const st = STATUS_LABELS[status] ?? STATUS_LABELS.draft;
    const words = editor?.storage.characterCount?.words?.() ?? 0;
    const pendingSuggestions = editor ? documentSuggestions(editor.state.doc.toJSON()).length : 0;
    const lastReason = review.workflow.find((w) => w.reason)?.reason ?? null;
    const primary = PRIMARY.find((a) => review.actions.includes(a));
    const banner = statusBanner({ status, mode: review.mode, corrector: review.corrector, lastReason, scheduledAt, lock, me: me.name });

    return (
        <div className="flex h-screen min-w-0 flex-1">
            <SidePanel
                editor={editor}
                state={meta}
                categories={categories}
                authors={post.authors}
                onChange={updateMeta}
                onPickFeatured={() => setPicker("featured")}
                onReplaceImage={() => setPicker("replace")}
                words={words}
                title={title}
                tab={tab}
                onTab={setTab}
                readOnly={!metaWritable}
                reviewBadge={pendingSuggestions}
                modulesCount={modules.length}
                seoAssistant={<SeoAssistant report={seoReport} onTarget={goToTarget} suggestions={seoExtra?.suggestions ?? null} onRefreshSuggestions={() => void loadSeoExtra()} onInsertLink={insertSuggestion} readOnly={!canWrite} />}
                modulesTab={<ModulesTab editor={editor} modules={modules} onChange={updateModules} pickImage={pickModuleImage} team={team} readOnly={!metaWritable} />}
                review={
                    <ReviewPanel
                        editor={editor}
                        postId={post.id}
                        mode={review.mode}
                        canWrite={canWrite}
                        workflow={review.workflow}
                        pending={pendingAnchor}
                        onPendingDone={() => setPendingAnchor(null)}
                        focusThread={focusThread}
                    />
                }
            />

            <main className="flex min-w-0 flex-1 flex-col bg-white">
                {/* En-tête */}
                <header className="flex items-center gap-3 border-b border-ink/10 px-6 py-3.5">
                    <Link href="/dashboard/articles/" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-paper2" aria-label="Retour aux articles">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <h1 className="min-w-0 truncate font-semibold">{title || "Sans titre"}</h1>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${st.className}`}>{st.label}</span>
                    {canWrite ? (
                        <SaveIndicator state={save} savedAt={savedAt} error={saveError} />
                    ) : (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-paper2 px-3 py-1 text-xs font-semibold text-ink/60">
                            <Lock className="h-3.5 w-3.5" /> Lecture
                        </span>
                    )}
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                        <SeoGauge score={seoReport.score} onClick={() => setTab("seo")} />
                        <PresenceAvatars people={lock.people} />
                        <Link href={`/apercu/${post.id}/`} target="_blank" className="btn-ghost h-9 w-9 justify-center !p-0" title="Aperçu" aria-label="Aperçu">
                            <Eye className="h-4 w-4" />
                        </Link>
                        {review.actions
                            .filter((a) => a !== primary && a !== "trash")
                            .map((a) => (
                                <button key={a} type="button" onClick={() => onAction(a)} disabled={busy} className="btn-ghost px-3.5 py-2 text-sm disabled:opacity-60">
                                    {ACTION_LABELS[a]}
                                </button>
                            ))}
                        {primary && (
                            <button type="button" onClick={() => onAction(primary)} disabled={busy} className="btn-orange px-4 py-2 text-sm disabled:opacity-60">
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ActionIcon action={primary} />} {ACTION_LABELS[primary]}
                            </button>
                        )}
                        {/* Article à la corbeille : suppression définitive (Admin), double confirmation */}
                        {status === "trash" && me.admin && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                    if (!window.confirm(`Supprimer définitivement « ${title || "Sans titre"} » ?

Le texte, les versions, les commentaires et les réactions seront effacés. C'est irréversible.`)) return;
                                    if (window.prompt("Pour confirmer, écris SUPPRIMER")?.trim().toUpperCase() !== "SUPPRIMER") return;
                                    const j = await fetch(`/api/posts/${post.id}/`, { method: "DELETE" })
                                        .then((r) => r.json())
                                        .catch(() => ({ success: false, error: "Connexion impossible." }));
                                    if (j.success) router.push("/dashboard/articles/?vue=corbeille");
                                    else window.alert(j.error || "Suppression impossible.");
                                }}
                                className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                            >
                                <Trash2 className="h-4 w-4" /> Supprimer définitivement
                            </button>
                        )}
                        {review.actions.includes("trash") && (
                            <button type="button" onClick={() => onAction("trash")} disabled={busy} className="grid h-9 w-9 place-items-center rounded-full text-ink/45 hover:bg-red-50 hover:text-red-700" title="Mettre à la corbeille" aria-label="Mettre à la corbeille">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </header>

                {issues.length > 0 && (
                    <div className="flex gap-3 border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-800">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <b>Pas encore possible :</b>
                            <ul className="mt-1 list-disc pl-5">
                                {issues.map((i) => (
                                    <li key={i}>{i}</li>
                                ))}
                            </ul>
                        </div>
                        <button type="button" onClick={() => setIssues([])} aria-label="Fermer">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {staleStatus && (
                    <div className="flex items-center gap-3 border-b border-sky/40 bg-sky/15 px-6 py-2.5 text-sm">
                        <Info className="h-4 w-4 shrink-0 text-[#2f86b3]" /> L&apos;article a changé d&apos;étape entre-temps.
                        <button type="button" onClick={() => window.location.reload()} className="font-semibold underline">
                            Recharger
                        </button>
                    </div>
                )}

                {lock.known && !lock.mine && lock.holder && review.mode !== "read" && (
                    <div className="flex items-center gap-3 border-b border-sun/50 bg-sun/15 px-6 py-2.5 text-sm">
                        <Lock className="h-4 w-4 shrink-0 text-[#a0650a]" />
                        <span>
                            <b>{lock.holder}</b> est en train de modifier : tu es en lecture seule.
                        </span>
                        <button type="button" onClick={() => void beat({ request: true })} className="ml-auto rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">
                            Demander la main
                        </button>
                    </div>
                )}
                {lock.mine && lock.requestedBy && (
                    <div className="flex items-center gap-3 border-b border-sky/40 bg-sky/15 px-6 py-2.5 text-sm">
                        <Hand className="h-4 w-4 shrink-0 text-[#2f86b3]" />
                        <span>
                            <b>{lock.requestedBy}</b> voudrait modifier l&apos;article.
                        </span>
                        <button
                            type="button"
                            onClick={async () => {
                                await saveRef.current();
                                setLock((l) => ({ ...l, mine: false, requestedBy: null }));
                                await beat({ yield: true });
                            }}
                            className="ml-auto rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white"
                        >
                            Céder la main
                        </button>
                    </div>
                )}
                {banner && (
                    <div className={`flex items-start gap-3 border-b px-6 py-2.5 text-sm ${banner.tone}`}>
                        <banner.icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                            {banner.text}
                            {banner.quote && <p className="mt-1 rounded-lg bg-white/70 px-2.5 py-1.5 text-[13px] italic">« {banner.quote} »</p>}
                        </div>
                    </div>
                )}

                {review.mode === "edit" && canWrite ? (
                    <Toolbar editor={editor} onImage={() => setPicker("content")} onAffiliate={() => setAffiliate(true)} />
                ) : review.mode === "suggest" && canWrite ? (
                    <div className="flex items-center gap-2 border-b border-ink/10 bg-leaf/10 px-6 py-2.5 text-xs text-ink/60">
                        <b className="inline-flex shrink-0 items-center gap-1 text-[#2f6e14]">
                            <PenLine className="h-3.5 w-3.5" /> Mode suggestion
                        </b>
                        <span className="rounded bg-leaf/30 px-1.5 text-[#22560f]">ajout</span>
                        <span className="rounded bg-red-100 px-1.5 text-red-700 line-through">suppression</span>
                        Tes modifications sont des suggestions : le rédacteur les acceptera ou les refusera. Pour couper un paragraphe ou déplacer un bloc, laisse un commentaire.
                    </div>
                ) : null}

                {/* Page d'écriture */}
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-[760px] px-8 pb-40 pt-12">
                        <textarea
                            value={title}
                            readOnly={!metaWritable}
                            onChange={(e) => {
                                setTitle(e.target.value.replace(/\n/g, ""));
                                markDirty("title");
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    editor?.commands.focus("start");
                                }
                            }}
                            rows={1}
                            placeholder="Titre de l'article"
                            className="w-full resize-none bg-transparent font-display text-[44px] leading-[1.08] tracking-tight outline-none placeholder:text-ink/25"
                            style={{ fieldSizing: "content" } as React.CSSProperties}
                            aria-label="Titre de l'article"
                        />
                        {editor && (
                            <>
                                {review.mode === "edit" && canWrite && (
                                    <DragHandle editor={editor} onNodeChange={({ node, pos }) => (hovered.current = node ? { pos, size: node.nodeSize } : null)}>
                                        <BlockHandle editor={editor} target={() => hovered.current} />
                                    </DragHandle>
                                )}
                                {review.mode === "edit" && canWrite && <TableMenu editor={editor} />}
                                <BubbleMenu editor={editor} shouldShow={({ editor: e, state }) => !state.selection.empty && !e.isActive("image")}>
                                    <BubbleBar
                                        editor={editor}
                                        formatting={review.mode === "edit" && canWrite}
                                        onComment={() => {
                                            const { from, to } = editor.state.selection;
                                            setPendingAnchor({ from, to, quote: editor.state.doc.textBetween(from, to, " ").slice(0, 300) });
                                            setTab("relecture");
                                        }}
                                    />
                                </BubbleMenu>
                            </>
                        )}
                        <ModulesContext.Provider value={modules}>
                            <EditorContent editor={editor} className="mt-6" />
                        </ModulesContext.Provider>
                    </div>
                </div>
            </main>

            <MediaPicker
                key={picker ?? "ferme"}
                open={!!picker}
                title={picker === "featured" ? "Image à la une" : picker === "module" ? "Image du module" : "Insérer une image"}
                onClose={() => {
                    pickResolve.current?.(null);
                    pickResolve.current = null;
                    setPicker(null);
                }}
                onPick={(m) => {
                    if (picker === "module") {
                        pickResolve.current?.({ url: m.url, alt: m.alt, width: m.width, height: m.height, mediaId: m.id, credit: { author: m.credit.author, source: m.credit.source, license: m.credit.license, sourceUrl: m.credit.sourceUrl } });
                        pickResolve.current = null;
                    } else if (picker === "featured")
                        updateMeta(
                            {
                                featuredImage: { url: m.url, alt: m.alt, credit: m.credit },
                                featuredMediaId: m.id,
                            },
                            "featured"
                        );
                    else insertMedia(m);
                    setPicker(null);
                }}
            />
            {affiliate && editor && (
                <AffiliatePicker
                    onClose={() => setAffiliate(false)}
                    onPick={(href) => {
                        setAffiliate(false);
                        if (editor.state.selection.empty) editor.chain().focus().insertContent({ type: "text", text: "voir l'offre", marks: [{ type: "link", attrs: { href } }] }).run();
                        else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
                    }}
                />
            )}
            {dialog && (
                <ActionDialog
                    action={dialog}
                    busy={busy}
                    onClose={() => setDialog(null)}
                    onConfirm={async (opts) => {
                        await runAction(dialog, opts);
                        setDialog(null);
                    }}
                />
            )}
        </div>
    );
}

/* ─── Circuit : bandeaux, boutons, fenêtre de confirmation ─── */

function statusBanner({
    status,
    mode,
    corrector,
    lastReason,
    scheduledAt,
    lock,
    me,
}: {
    status: string;
    mode: EditMode;
    corrector: string | null;
    lastReason: string | null;
    scheduledAt: string | null;
    lock: LockState;
    me: string;
}): { icon: LucideIcon; text: React.ReactNode; quote?: string; tone: string } | null {
    const blue = "border-sky/40 bg-sky/10 text-ink/80";
    const amber = "border-sun/50 bg-sun/15 text-ink/80";
    if (status === "pending_correction") return { icon: Clock, tone: blue, text: <>En attente d&apos;un correcteur. Le texte est verrouillé pendant l&apos;attente.</> };
    if (status === "in_correction" && mode === "suggest") return null;
    if (status === "in_correction") return { icon: PenLine, tone: blue, text: <>{corrector ?? "Un correcteur"} corrige l&apos;article. Tu peux lire et répondre aux commentaires.</> };
    if (status === "to_revise")
        return {
            icon: MessageSquare,
            tone: amber,
            quote: lastReason ?? undefined,
            text: <>L&apos;article a été renvoyé{corrector ? ` par ${corrector}` : ""}. Accepte ou refuse les suggestions (onglet Relecture), puis renvoie-le en correction.</>,
        };
    if (status === "pending_approval") return { icon: Clock, tone: blue, text: <>Correction validée{corrector ? ` par ${corrector}` : ""} : l&apos;article attend l&apos;approbation de la rédaction en chef.</> };
    if (status === "scheduled" && scheduledAt)
        return { icon: CalendarClock, tone: blue, text: <>Publication programmée le {new Date(scheduledAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" })}.</> };
    if (status === "published" && mode === "edit" && lock.mine) return { icon: AlertTriangle, tone: amber, text: <>Article en ligne, {me} : chaque modification enregistrée est visible tout de suite.</> };
    if (status === "trash") return { icon: Trash2, tone: "border-red-200 bg-red-50 text-red-800", text: <>Article à la corbeille : il sera supprimé définitivement 30 jours après y avoir été mis.</> };
    return null;
}

function ActionIcon({ action }: { action: WorkflowAction }) {
    const Icon = action === "approve" || action === "publish" ? Rocket : action === "validate" ? CheckCircle2 : action === "take" ? PenLine : action === "restore" ? Undo2 : Send;
    return <Icon className="h-4 w-4" />;
}

function PresenceAvatars({ people }: { people: LockState["people"] }) {
    if (!people.length) return null;
    return (
        <div className="flex -space-x-2" aria-label="Aussi sur l'article">
            {people.slice(0, 4).map((p) => (
                <span
                    key={p.name}
                    title={`${p.name} ${p.editing ? "modifie" : "consulte"} l'article`}
                    className={`grid h-8 w-8 place-items-center rounded-full border-2 bg-sky text-xs font-bold text-white ${p.editing ? "border-accent" : "border-white"}`}
                >
                    {p.name.charAt(0).toUpperCase()}
                </span>
            ))}
        </div>
    );
}

/** Demain 8 h (heure locale), au format du champ date-heure */
function defaultSchedule(): string {
    const d = new Date(Date.now() + 86_400_000);
    d.setHours(8, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ActionDialog({ action, busy, onClose, onConfirm }: { action: WorkflowAction; busy: boolean; onClose: () => void; onConfirm: (opts: { reason?: string; at?: string | null }) => void }) {
    const [reason, setReason] = useState("");
    const [when, setWhen] = useState<"now" | "later">("now");
    const [at, setAt] = useState(defaultSchedule);
    const needsReason = NEEDS_REASON.includes(action);
    const schedulable = action === "approve" || action === "publish";
    const danger = action === "trash" || action === "unpublish" || action === "refuse";
    const help: Partial<Record<WorkflowAction, string>> = {
        return: "Le rédacteur verra ce message, avec tes suggestions et commentaires.",
        refuse: "L'article repart en brouillon. Explique ce qui ne va pas.",
        trash: "L'article sera supprimé définitivement dans 30 jours. On peut le restaurer d'ici là.",
        unpublish: "L'article ne sera plus visible du public.",
    };
    const invalid = (needsReason && !reason.trim()) || (schedulable && when === "later" && !at);
    return (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label={ACTION_LABELS[action]} onClick={onClose}>
            <div className="w-full max-w-md rounded-[28px] bg-paper p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <h2 className="font-display text-2xl">{ACTION_LABELS[action]}</h2>
                {help[action] && <p className="mt-1 text-sm text-ink/60">{help[action]}</p>}
                {needsReason && (
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={4}
                        autoFocus
                        placeholder="Pourquoi ? (obligatoire)"
                        className="mt-4 w-full resize-none rounded-2xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                )}
                {schedulable && (
                    <div className="mt-4 space-y-2 text-sm">
                        <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-ink/10 bg-white px-3 py-2.5">
                            <input type="radio" checked={when === "now"} onChange={() => setWhen("now")} className="accent-[#ff6a1a]" /> Publier maintenant
                        </label>
                        <label className="flex cursor-pointer flex-wrap items-center gap-2 rounded-2xl border border-ink/10 bg-white px-3 py-2.5">
                            <input type="radio" checked={when === "later"} onChange={() => setWhen("later")} className="accent-[#ff6a1a]" /> Programmer le
                            <input
                                type="datetime-local"
                                value={at}
                                onChange={(e) => {
                                    setAt(e.target.value);
                                    setWhen("later");
                                }}
                                className="rounded-lg border border-ink/15 px-2 py-1 text-sm"
                            />
                            <span className="w-full pl-6 text-[11px] text-ink/45">Heure de Paris. L&apos;article passe en ligne au passage suivant du cron (5 min au plus).</span>
                        </label>
                    </div>
                )}
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
                        Annuler
                    </button>
                    <button
                        type="button"
                        disabled={busy || invalid}
                        onClick={() => onConfirm({ reason: reason || undefined, at: schedulable && when === "later" ? new Date(at).toISOString() : null })}
                        className={`${danger ? "bg-red-600 text-white shadow-[0_3px_0_#991b1b]" : "btn-orange"} inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50`}
                    >
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {ACTION_LABELS[action]}
                    </button>
                </div>
            </div>
        </div>
    );
}

function SaveIndicator({ state, savedAt, error }: { state: SaveState; savedAt: string; error: string | null }) {
    if (state === "saving" || state === "dirty")
        return (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-paper2 px-3 py-1 text-xs font-semibold text-ink/60">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enregistrement…
            </span>
        );
    if (state === "error")
        return (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700" title={error || ""}>
                <AlertTriangle className="h-3.5 w-3.5" /> Non enregistré
            </span>
        );
    const time = new Date(savedAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
    });
    return (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-leaf/20 px-3 py-1 text-xs font-semibold text-[#2f6e14]" title={`Enregistré à ${time}`}>
            Enregistré <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
    );
}

/* ─── Barre d'outils ─── */

function Tool({ icon: Icon, label, active, onClick, disabled }: { icon: LucideIcon; label: string; active?: boolean; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            disabled={disabled}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-lg px-1.5 transition disabled:opacity-30 ${active ? "bg-ink text-white" : "text-ink/70 hover:bg-paper2 hover:text-ink"}`}
        >
            <Icon className="h-[17px] w-[17px]" />
        </button>
    );
}
const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-ink/10" />;

function askLink(editor: Editor) {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Adresse du lien (laisser vide pour retirer) :", previous || "https://");
    if (url === null) return;
    if (!url.trim() || url === "https://") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
}

function Toolbar({ editor, onImage, onAffiliate }: { editor: Editor | null; onImage: () => void; onAffiliate: () => void }) {
    const s = useEditorState({
        editor,
        selector: ({ editor: e }) =>
            e
                ? {
                      bold: e.isActive("bold"),
                      italic: e.isActive("italic"),
                      underline: e.isActive("underline"),
                      strike: e.isActive("strike"),
                      highlight: e.isActive("highlight"),
                      code: e.isActive("code"),
                      link: e.isActive("link"),
                      h2: e.isActive("heading", { level: 2 }),
                      h3: e.isActive("heading", { level: 3 }),
                      bullet: e.isActive("bulletList"),
                      ordered: e.isActive("orderedList"),
                      quote: e.isActive("blockquote"),
                      canUndo: e.can().undo(),
                      canRedo: e.can().redo(),
                  }
                : null,
    });
    if (!editor || !s) return <div className="h-[49px] border-b border-ink/10" />;
    const c = () => editor.chain().focus();
    return (
        <div className="flex items-center gap-0.5 overflow-x-auto border-b border-ink/10 px-4 py-2">
            <Tool icon={Undo2} label="Annuler (Ctrl+Z)" onClick={() => c().undo().run()} disabled={!s.canUndo} />
            <Tool icon={Redo2} label="Rétablir (Ctrl+Y)" onClick={() => c().redo().run()} disabled={!s.canRedo} />
            <Sep />
            <Tool icon={Heading2} label="Titre" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} />
            <Tool icon={Heading3} label="Sous-titre" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} />
            <Sep />
            <Tool icon={Bold} label="Gras (Ctrl+B)" active={s.bold} onClick={() => c().toggleBold().run()} />
            <Tool icon={Italic} label="Italique (Ctrl+I)" active={s.italic} onClick={() => c().toggleItalic().run()} />
            <Tool icon={Underline} label="Souligné (Ctrl+U)" active={s.underline} onClick={() => c().toggleUnderline().run()} />
            <Tool icon={Strikethrough} label="Barré" active={s.strike} onClick={() => c().toggleStrike().run()} />
            <Tool icon={Highlighter} label="Surligner" active={s.highlight} onClick={() => c().toggleHighlight().run()} />
            <Tool icon={Code} label="Code" active={s.code} onClick={() => c().toggleCode().run()} />
            <Tool icon={Link2} label="Lien (Ctrl+K)" active={s.link} onClick={() => askLink(editor)} />
            <Tool icon={ShoppingBag} label="Lien affilié (sponsorisé)" onClick={onAffiliate} />
            <Sep />
            <Tool icon={List} label="Liste à puces" active={s.bullet} onClick={() => c().toggleBulletList().run()} />
            <Tool icon={ListOrdered} label="Liste numérotée" active={s.ordered} onClick={() => c().toggleOrderedList().run()} />
            <Tool icon={Quote} label="Citation" active={s.quote} onClick={() => c().toggleBlockquote().run()} />
            <Sep />
            <Tool icon={ImageIcon} label="Image" onClick={onImage} />
            <Tool
                icon={Sigma}
                label="Formule"
                onClick={() => {
                    const latex = window.prompt("Formule LaTeX (ex. \\frac{1}{2}) :");
                    if (latex) c().insertInlineMath({ latex }).run();
                }}
            />
            <Sep />
            <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => c().insertContent("/").run()}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-accentdark hover:bg-paper2"
            >
                <Plus className="h-4 w-4" /> Bloc
            </button>
        </div>
    );
}

/** Barre flottante sur une sélection de texte : mise en forme (si on écrit) et « Commenter » */
function BubbleBar({ editor, formatting, onComment }: { editor: Editor; formatting: boolean; onComment: () => void }) {
    const s = useEditorState({
        editor,
        selector: ({ editor: e }) => ({
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            link: e.isActive("link"),
            highlight: e.isActive("highlight"),
        }),
    });
    const c = () => editor.chain().focus();
    return (
        <div className="flex items-center gap-0.5 rounded-xl border border-ink/10 bg-white p-1 shadow-[0_10px_30px_rgba(26,21,18,.14)]">
            {formatting && (
                <>
                    <Tool icon={Bold} label="Gras" active={s.bold} onClick={() => c().toggleBold().run()} />
                    <Tool icon={Italic} label="Italique" active={s.italic} onClick={() => c().toggleItalic().run()} />
                    <Tool icon={Highlighter} label="Surligner" active={s.highlight} onClick={() => c().toggleHighlight().run()} />
                    <Tool icon={Link2} label="Lien" active={s.link} onClick={() => askLink(editor)} />
                    <Sep />
                </>
            )}
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onComment} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-ink/75 hover:bg-paper2">
                <MessageSquarePlus className="h-4 w-4" /> Commenter
            </button>
        </div>
    );
}

/** Poignée à gauche de chaque bloc : « + » pour insérer dessous, ⠿ pour déplacer */
function BlockHandle({ editor, target }: { editor: Editor; target: () => { pos: number; size: number } | null }) {
    return (
        <div className="flex items-center gap-0.5 pr-2">
            <button
                type="button"
                title="Insérer un bloc dessous"
                aria-label="Insérer un bloc dessous"
                onClick={() => {
                    const t = target();
                    const end = t ? t.pos + t.size : editor.state.doc.content.size;
                    editor
                        .chain()
                        .focus()
                        .insertContentAt(end, { type: "paragraph" })
                        .setTextSelection(end + 1)
                        .insertContent("/")
                        .run();
                }}
                className="grid h-6 w-6 place-items-center rounded-md text-ink/40 hover:bg-paper2 hover:text-ink"
            >
                <Plus className="h-4 w-4" />
            </button>
            <span className="grid h-6 w-6 cursor-grab place-items-center rounded-md text-ink/40 hover:bg-paper2 hover:text-ink" title="Glisser pour déplacer">
                <GripVertical className="h-4 w-4" />
            </span>
        </div>
    );
}
