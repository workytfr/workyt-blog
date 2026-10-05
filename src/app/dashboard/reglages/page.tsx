import { notFound } from "next/navigation";
import { getBlogSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getSettings } from "@/lib/settings";
import SettingsForm from "./SettingsForm";

/** Réglages du blog (§ 13, Admin) */
export default async function SettingsPage() {
    const session = (await getBlogSession())!;
    if (!can(session.user.role, "settings.manage")) notFound();
    const settings = await getSettings();
    return (
        <main className="min-w-0 flex-1 px-10 py-10">
            <div className="mx-auto max-w-3xl">
                <p className="eyebrow">Gestion</p>
                <h1 className="mt-1 font-display text-5xl">Réglages</h1>
                <p className="mt-2 text-ink/60">Le nom du blog, son adresse et les modèles de titre restent ceux de Rank Math (« Mon article - Workyt ») pour que Google ne voie aucune différence.</p>
                <SettingsForm initial={settings} />
            </div>
        </main>
    );
}
