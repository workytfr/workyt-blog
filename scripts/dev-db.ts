/**
 * Base MongoDB jetable pour le développement (en mémoire, rien sur disque) :
 *   npx tsx scripts/dev-db.ts      → mongodb://127.0.0.1:27018/workyt-blog
 * Puis, dans un autre terminal : MONGODB_URI=… npm run seed && npm run dev
 */
import { MongoMemoryServer } from "mongodb-memory-server";

async function main() {
    const server = await MongoMemoryServer.create({ instance: { port: 27018, dbName: "workyt-blog" } });
    console.log(`Base de développement prête : ${server.getUri("workyt-blog")}`);
    const stop = async () => {
        await server.stop();
        process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    // Garde le processus ouvert
    setInterval(() => {}, 1 << 30);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
