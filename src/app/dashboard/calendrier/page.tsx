import { notFound } from "next/navigation";
import { getBlogSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import "@/models/Category";
import CalendarView, { type CalItem } from "./CalendarView";

type Props = { searchParams: Promise<{ mois?: string; semaine?: string }> };

/** Lundi de la semaine d'une date (heure locale) */
function monday(d: Date) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
}

/**
 * Calendrier éditorial (§ 7.3, § 13) : articles planifiés et publiés, vue mois
 * ou semaine ; glisser un article planifié sur un autre jour le reprogramme.
 */
export default async function CalendarPage({ searchParams }: Props) {
    const session = (await getBlogSession())!;
    if (!can(session.user.role, "calendar.view")) notFound();
    const sp = await searchParams;
    const now = new Date();
    let start: Date;
    let end: Date;
    let mode: "mois" | "semaine";
    let anchor: string;
    if (sp.semaine && /^\d{4}-\d{2}-\d{2}$/.test(sp.semaine)) {
        mode = "semaine";
        start = monday(new Date(`${sp.semaine}T12:00:00`));
        end = new Date(start);
        end.setDate(end.getDate() + 7);
        anchor = sp.semaine;
    } else {
        mode = "mois";
        const [y, m] = /^\d{4}-\d{2}$/.test(sp.mois ?? "") ? sp.mois!.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
        const first = new Date(y, m - 1, 1);
        start = monday(first);
        const last = new Date(y, m, 0);
        end = monday(last);
        end.setDate(end.getDate() + 7);
        anchor = `${y}-${String(m).padStart(2, "0")}`;
    }

    await connectDB();
    const posts = await Post.find({
        $or: [
            { status: "scheduled", scheduledAt: { $gte: start, $lt: end } },
            { status: "published", publishedAt: { $gte: start, $lt: end } },
        ],
    })
        .select("title status scheduledAt publishedAt primaryCategory categories")
        .populate("primaryCategory", "color name")
        .populate("categories", "color name")
        .lean();

    /* eslint-disable @typescript-eslint/no-explicit-any -- rubriques peuplées */
    const items: CalItem[] = posts.map((p) => {
        const cat = (p.primaryCategory as any) ?? (p.categories as any[])?.[0];
        return { id: String(p._id), title: p.title, status: p.status as "scheduled" | "published", at: new Date((p.status === "scheduled" ? p.scheduledAt : p.publishedAt) as Date).toISOString(), color: cat?.color ?? "#ff6a1a", category: cat?.name ?? "" };
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return (
        <main className="min-w-0 flex-1 px-10 py-10">
            <div className="mx-auto max-w-6xl">
                <p className="eyebrow">Rédaction</p>
                <h1 className="mt-1 font-display text-5xl">Calendrier</h1>
                <CalendarView items={items} mode={mode} anchor={anchor} start={start.toISOString()} canMove={can(session.user.role, "post.publish")} />
            </div>
        </main>
    );
}
