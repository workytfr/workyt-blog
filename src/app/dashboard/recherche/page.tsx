import Link from "next/link";
import { FileText, Images, Users } from "lucide-react";
import { getBlogSession } from "@/lib/auth";
import { can, ROLE_LABELS, type Role } from "@/lib/roles";
import { connectDB } from "@/lib/db";
import { relativeDate } from "@/lib/format";
import { avatarSrc } from "@/lib/avatar";
import { STATUS_LABELS } from "@/editor/types";
import Post from "@/models/Post";
import Media from "@/models/Media";
import Member from "@/models/Member";

type Props = { searchParams: Promise<{ q?: string }> };

/** Recherche globale de la rédaction (§ 13.1) : articles, images, personnes */
export default async function SearchPage({ searchParams }: Props) {
    const session = (await getBlogSession())!;
    const q = ((await searchParams).q ?? "").trim().slice(0, 100);
    const role = session.user.role;
    await connectDB();
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const me = await Member.findById(session.user.memberId).select("author").lean();
    // Les articles visibles : tout pour la correction et la rédaction en chef, sinon les miens et ceux publiés
    const scope = can(role, "post.correct") ? {} : { $or: [{ authors: me?.author ?? null }, { status: "published" }] };
    const [posts, media, people] = q
        ? await Promise.all([
              Post.find({ status: { $ne: "trash" }, ...scope, $and: [{ $or: [{ title: rx }, { slug: rx }, { excerpt: rx }] }] })
                  .select("title status updatedAt featuredImage")
                  .sort({ updatedAt: -1 })
                  .limit(20)
                  .lean(),
              Media.find({ $or: [{ alt: rx }, { originalName: rx }, { "credit.author": rx }] }).select("url alt credit").limit(12).lean(),
              can(role, "team.manage") ? Member.find({ username: rx }).select("username role avatarUrl workytId").limit(10).lean() : [],
          ])
        : [[], [], []];
    const total = posts.length + media.length + people.length;

    return (
        <main className="min-w-0 flex-1 px-10 py-10">
            <div className="mx-auto max-w-5xl">
                <p className="eyebrow">Recherche</p>
                <h1 className="mt-1 font-display text-4xl">{q ? `« ${q} »` : "Que cherches-tu ?"}</h1>
                {q && <p className="mt-2 text-ink/55">{total ? `${total} résultat${total > 1 ? "s" : ""}` : "Aucun résultat."}</p>}

                {posts.length > 0 && (
                    <section className="mt-8">
                        <h2 className="flex items-center gap-2 font-display text-2xl">
                            <FileText className="h-5 w-5 text-accent" /> Articles
                        </h2>
                        <ul className="mt-3 divide-y divide-ink/5 overflow-hidden rounded-[22px] border border-ink/10 bg-white">
                            {posts.map((p) => {
                                const st = STATUS_LABELS[p.status] ?? STATUS_LABELS.draft;
                                return (
                                    <li key={String(p._id)}>
                                        <Link href={`/dashboard/articles/${p._id}/`} className="flex items-center gap-3 px-5 py-3 hover:bg-paper">
                                            <span className="h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-paper2">
                                                {/* eslint-disable-next-line @next/next/no-img-element -- vignette */}
                                                {p.featuredImage?.url && <img src={p.featuredImage.url} alt="" className="h-full w-full object-cover" />}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate font-semibold">{p.title}</span>
                                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.className}`}>{st.label}</span>
                                            <span className="w-28 text-right text-xs text-ink/45">{relativeDate(p.updatedAt as Date)}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}

                {media.length > 0 && (
                    <section className="mt-8">
                        <h2 className="flex items-center gap-2 font-display text-2xl">
                            <Images className="h-5 w-5 text-accent" /> Images
                        </h2>
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                            {media.map((m) => (
                                <Link key={String(m._id)} href={`/dashboard/medias/?q=${encodeURIComponent(m.alt || "")}`} className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- vignette */}
                                    <img src={m.url} alt={m.alt} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                                    <span className="block truncate px-2.5 py-1.5 text-xs">{m.alt}</span>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {people.length > 0 && (
                    <section className="mt-8">
                        <h2 className="flex items-center gap-2 font-display text-2xl">
                            <Users className="h-5 w-5 text-accent" /> Personnes
                        </h2>
                        <ul className="mt-3 flex flex-wrap gap-2">
                            {people.map((m) => (
                                <li key={String(m._id)}>
                                    <Link href={`/dashboard/equipe/?q=${encodeURIComponent(m.username)}`} className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white py-1 pl-1 pr-4 text-sm hover:border-ink/25">
                                        {/* eslint-disable-next-line @next/next/no-img-element -- avatar */}
                                        <img src={avatarSrc({ avatarUrl: m.avatarUrl, workytId: m.workytId, seed: m.username })} alt="" className="h-8 w-8 rounded-full bg-paper2/60 object-cover" />
                                        <b>{m.username}</b>
                                        <span className="text-xs text-ink/50">{ROLE_LABELS[m.role as Role]}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </main>
    );
}
