import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { currentActor } from "@/lib/session";
import { ensureAuthor } from "@/lib/posts";
import { connectDB } from "@/lib/db";
import { avatarSrc } from "@/lib/avatar";
import Author from "@/models/Author";
import ProfileForm from "./ProfileForm";

/** Mon profil d'auteur : la bio et la fonction affichées sous mes articles et sur ma page auteur */
export default async function ProfilePage() {
    const actor = (await currentActor())!;
    await connectDB();
    const a = await Author.findById(await ensureAuthor(actor.memberId)).lean();
    return (
        <main className="min-w-0 flex-1 px-10 py-12">
            <div className="mx-auto max-w-2xl">
                <p className="eyebrow">Rédaction</p>
                <h1 className="mt-1 font-display text-5xl">Mon profil d&apos;auteur</h1>
                <div className="mt-8 flex items-center gap-4 rounded-[24px] border border-ink/10 bg-white p-5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- avatar */}
                    <img src={avatarSrc({ avatarUrl: a?.avatarUrl, workytId: a?.workytId, seed: a?.slug || "auteur" })} alt="" className="h-16 w-16 rounded-full bg-paper2/60 object-cover" />
                    <div className="min-w-0 flex-1">
                        <p className="font-display text-2xl">{a?.name}</p>
                        <p className="text-xs text-ink/50">Pseudo et photo viennent de ton compte workyt.fr.</p>
                    </div>
                    {a && (
                        <Link href={`/author/${a.slug}/`} target="_blank" className="btn-ghost px-4 py-2 text-sm">
                            Ma page <ArrowUpRight className="h-4 w-4" />
                        </Link>
                    )}
                </div>
                <ProfileForm initial={{ bio: a?.bio ?? "", title: a?.title ?? "" }} />
            </div>
        </main>
    );
}
