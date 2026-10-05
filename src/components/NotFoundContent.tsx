import Link from "next/link";
import FoxScene from "./FoxScene";
import NotFoundBeacon from "./NotFoundBeacon";

export default function NotFoundContent() {
    return (
        <div className="mx-auto max-w-3xl px-6 pb-24 pt-10 text-center">
            <NotFoundBeacon />
            <FoxScene />
            <p className="eyebrow mt-6">Erreur 404</p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl">Plus un seul mouton dans le champ…</h1>
            <p className="mx-auto mt-4 max-w-xl text-ink/60">
                … et pas de page à cette adresse non plus. Le renard est passé par là : l&apos;article a peut-être changé d&apos;adresse. Essaie la recherche, ou repars de l&apos;accueil.
            </p>
            <form action="/" className="mx-auto mt-8 flex max-w-md gap-2" role="search">
                <input name="s" placeholder="Rechercher un article…" className="min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-5 py-3 text-sm outline-none focus:border-accent" />
                <button className="btn-orange px-5 py-3 text-sm">Chercher</button>
            </form>
            <Link href="/" className="mt-6 inline-block text-sm font-semibold text-accentdark underline underline-offset-4">
                Retour à l&apos;accueil du blog
            </Link>
        </div>
    );
}
