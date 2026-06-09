import mongoose from "mongoose";

/** Direct Atlas URI — avoids Windows DNS `querySrv EREFUSED` on mongodb+srv */
function buildDirectUri(user, pass) {
    const u = encodeURIComponent(String(user || "").trim());
    const p = encodeURIComponent(String(pass || "").trim());
    return (
        `mongodb://${u}:${p}@ac-mazj4lj-shard-00-00.zzqq3aq.mongodb.net:27017,` +
        `ac-mazj4lj-shard-00-01.zzqq3aq.mongodb.net:27017,` +
        `ac-mazj4lj-shard-00-02.zzqq3aq.mongodb.net:27017/scanzybd_db` +
        `?ssl=true&replicaSet=atlas-7q9jwz-shard-0&authSource=admin&appName=Cluster0`
    );
}

function buildSrvUri(user, pass) {
    const u = encodeURIComponent(String(user || "").trim());
    const p = encodeURIComponent(String(pass || "").trim());
    return `mongodb+srv://${u}:${p}@cluster0.zzqq3aq.mongodb.net/scanzybd_db?appName=Cluster0`;
}

export const connectDB = async () => {
    try {
        const explicitUri = process.env.MONGODB_URI?.trim();
        const dbUser = String(process.env.DB_USER || "").trim();
        const dbPass = String(process.env.DB_PASS || "").trim();

        const candidates = [];
        if (explicitUri) candidates.push(explicitUri);
        if (dbUser && dbPass) {
            candidates.push(buildDirectUri(dbUser, dbPass));
            if (process.env.MONGODB_USE_SRV === "true") {
                candidates.push(buildSrvUri(dbUser, dbPass));
            }
        }

        if (candidates.length === 0) {
            throw new Error(
                "Missing MongoDB credentials. Set MONGODB_URI or DB_USER + DB_PASS in .env"
            );
        }

        let lastErr;
        for (const uri of candidates) {
            try {
                await mongoose.connect(uri, {
                    serverSelectionTimeoutMS: 15000,
                });
                return;
            } catch (err) {
                lastErr = err;
                const msg = String(err.message || "");
                const srvDns =
                    msg.includes("querySrv") ||
                    msg.includes("EREFUSED") ||
                    msg.includes("ENOTFOUND");
                if (srvDns && candidates.indexOf(uri) < candidates.length - 1) {
                    console.warn(
                        `⚠️ Mongo connect failed (${msg.slice(0, 60)}…) — trying fallback URI…`
                    );
                    await mongoose.disconnect().catch(() => {});
                    continue;
                }
                throw err;
            }
        }
        throw lastErr;
    } catch {
        process.exit(1);
    }
};
