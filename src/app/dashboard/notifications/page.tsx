import Link from "next/link";
import { Bell } from "lucide-react";
import { currentActor } from "@/lib/session";
import { listNotifications } from "@/lib/review";
import { relativeDate } from "@/lib/format";
import MarkAllRead from "./MarkAllRead";

/** Notifications de la rédaction (§ 7.2) */
export default async function NotificationsPage() {
    const actor = (await currentActor())!;
    const { items, unread } = await listNotifications(actor, 100);
    return (
        <main className="min-w-0 flex-1 px-10 py-12">
            <div className="mx-auto max-w-3xl">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <p className="eyebrow">Rédaction</p>
                        <h1 className="mt-1 font-display text-5xl">Notifications</h1>
                    </div>
                    {unread > 0 && <MarkAllRead />}
                </div>
                {items.length === 0 ? (
                    <p className="mt-8 rounded-[24px] border border-dashed border-ink/15 bg-white p-12 text-center text-ink/55">
                        <Bell className="mx-auto mb-2 h-6 w-6 text-ink/30" />
                        Rien de neuf. Tu seras prévenu ici quand un article bouge.
                    </p>
                ) : (
                    <ul className="mt-8 divide-y divide-ink/5 overflow-hidden rounded-[24px] border border-ink/10 bg-white">
                        {items.map((n) => (
                            <li key={n.id} className={n.read ? "" : "bg-accent/[0.05]"}>
                                <Link href={n.type === "link-dead" ? "/dashboard/liens/" : n.type === "invitation" ? "/dashboard/invitations/" : n.postId ? `/dashboard/articles/${n.postId}/` : "/dashboard/"} className="flex gap-3 px-5 py-4 hover:bg-paper">
                                    <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent"}`} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm">{n.text}</span>
                                        {n.postTitle && <span className="mt-0.5 block truncate text-xs font-semibold text-ink/55">{n.postTitle}</span>}
                                    </span>
                                    <span className="shrink-0 text-xs text-ink/45">{relativeDate(new Date(n.at))}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </main>
    );
}
