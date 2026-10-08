import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { getBlogSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { can } from "@/lib/roles";
import { carouselDraft } from "@/lib/carousel/draft";
import Post from "@/models/Post";
import CarouselStudio from "./CarouselStudio";

/** Carrousel réseaux sociaux d'un article (Rédacteur en chef et Admin) */
export default async function CarouselPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) notFound();
    const session = (await getBlogSession())!;
    if (!can(session.user.role, "social.export")) {
        return (
            <main className="grid flex-1 place-items-center p-8 text-center">
                <div>
                    <h1 className="font-display text-3xl">Réservé à la rédaction en chef</h1>
                    <p className="mt-2 text-ink/60">Les carrousels Instagram et LinkedIn sont préparés par le Rédacteur en chef et les Admins.</p>
                </div>
            </main>
        );
    }
    await connectDB();
    const post = await Post.findById(id).lean();
    if (!post) notFound();
    return <CarouselStudio postId={id} initial={await carouselDraft(post)} />;
}
