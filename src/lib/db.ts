import mongoose from "mongoose";

/**
 * Connexion MongoDB partagée entre les requêtes (et entre les rechargements à
 * chaud en développement).
 */
type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const globalCache = globalThis as unknown as { __blogMongoose?: Cache };
const cache: Cache = globalCache.__blogMongoose ?? { conn: null, promise: null };
globalCache.__blogMongoose = cache;

export async function connectDB(): Promise<typeof mongoose> {
    if (cache.conn) return cache.conn;
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI manquant : voir .env.example");
    cache.promise ??= mongoose.connect(uri, { bufferCommands: false });
    try {
        cache.conn = await cache.promise;
    } catch (error) {
        cache.promise = null;
        throw error;
    }
    return cache.conn;
}
