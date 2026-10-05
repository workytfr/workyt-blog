import Image from "next/image";
import Link from "next/link";
import { Eye, TrendingUp } from "lucide-react";
import type { PostCardView } from "@/lib/content";
import { formatCount } from "@/lib/format";

/** « Le top » : les articles les plus lus, numérotés en grand */
export default function TopPosts({ posts }: { posts: PostCardView[] }) {
    if (posts.length < 3) return null;
    const [first, ...rest] = posts;
    return (
        <section className="rounded-[36px] bg-ink p-6 text-white sm:p-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="eyebrow !text-white/50">Le top</p>
                    <h2 className="mt-2 flex items-center gap-3 font-display text-[36px] leading-none sm:text-[44px]">
                        Les plus lus <TrendingUp className="h-8 w-8 text-accent" />
                    </h2>
                </div>
                <p className="max-w-sm text-sm text-white/55">Les articles que vous lisez le plus en ce moment.</p>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
                <Link href={`/${first.slug}/`} className="group relative block min-h-[320px] overflow-hidden rounded-[26px] bg-white/5">
                    {first.featuredImage && <Image src={first.featuredImage.url} alt={first.featuredImage.alt} fill sizes="(min-width: 1536px) 780px, (min-width: 1024px) 600px, 100vw" className="object-cover opacity-80 transition duration-700 group-hover:scale-[1.03] group-hover:opacity-90" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
                    <span className="absolute left-5 top-3 font-display text-[88px] leading-none text-accent">1</span>
                    <div className="absolute inset-x-0 bottom-0 p-6">
                        <p className="flex items-center gap-1.5 text-xs text-white/70">
                            <Eye className="h-3.5 w-3.5" /> {formatCount(first.views)} lectures · {first.primaryCategory?.name}
                        </p>
                        <h3 className="mt-2 font-display text-[26px] leading-tight group-hover:text-sun">{first.title}</h3>
                    </div>
                </Link>

                <ol className="space-y-1">
                    {rest.map((p, i) => (
                        <li key={p.id}>
                            <Link href={`/${p.slug}/`} className="group flex items-center gap-4 rounded-[20px] p-3 transition hover:bg-white/5">
                                <span className="outline-num w-12 text-center text-[52px] leading-none [-webkit-text-stroke-color:rgba(255,255,255,.35)] group-hover:[-webkit-text-stroke-color:#ff6a1a]">{i + 2}</span>
                                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/10">
                                    {p.featuredImage && <Image src={p.featuredImage.url} alt="" fill sizes="64px" className="object-cover" />}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[11px] text-white/50">
                                        {p.primaryCategory?.name} · {formatCount(p.views)} lectures
                                    </span>
                                    <span className="mt-0.5 line-clamp-2 font-semibold leading-snug group-hover:text-sun">{p.title}</span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}
