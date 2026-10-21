import { notFound } from "next/navigation";
import { requireDashboard } from "@/lib/dashboardAccess";
import { can } from "@/lib/roles";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import "@/models/Category";
import CalendarView, { type CalItem } from "./CalendarView";
import { addDays, daysInMonth, mondayOf, parisMidnight, parisMonth } from "@/lib/parisTime";

type Props = { searchParams: Promise<{ mois?: string; semaine?: string }> };

/**
 * Calendrier éditorial (§ 7.3, § 13) : articles planifiés et publiés, vue mois
 * ou semaine ; glisser un article planifié sur un autre jour le reprogramme.
 */
export default async function CalendarPage({ searchParams }: Props) {
    const session = await requireDashboard();
    if (!can(session.user.role, "calendar.view")) notFound();
    const sp = await searchParams;
    // Bornes à minuit, heure de Paris (le serveur tourne en UTC)
    let first: string;
    let last: string;
    let mode: "mois" | "semaine";
    let anchor: string;
    if (sp.semaine && /^\d{4}-\d{2}-\d{2}$/.test(sp.semaine)) {
        mode = "semaine";
        first = mondayOf(sp.semaine);
        last = first;
        anchor = sp.semaine;
    } else {
        mode = "mois";
        anchor = /^\d{4}-\d{2}$/.test(sp.mois ?? "") ? sp.mois! : parisMonth();
        first = mondayOf(`${anchor}-01`);
        last = mondayOf(`${anchor}-${String(daysInMonth(anchor)).padStart(2, "0")}`);
    }
    // Jusqu'au dimanche soir de la dernière semaine
    const start = parisMidnight(first);
    const end = parisMidnight(addDays(last, 7));

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
                {/* key : un autre mois ou une autre semaine = un calendrier neuf (sinon il garde les articles du premier mois affiché) */}
                <CalendarView key={`${mode}-${anchor}`} items={items} mode={mode} anchor={anchor} start={start.toISOString()} canMove={can(session.user.role, "post.publish")} />
            </div>
        </main>
    );
}
