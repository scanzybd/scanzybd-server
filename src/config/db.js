import mongoose from "mongoose";

/*
  👉 Build Mongo URI from env variables
  👉 More secure + reusable
*/

export const connectDB = async () => {

    try {
        const explicitUri = process.env.MONGODB_URI?.trim();
        const dbUser = encodeURIComponent(String(process.env.DB_USER || "").trim());
        const dbPass = encodeURIComponent(String(process.env.DB_PASS || "").trim());
        const defaultUri = `mongodb://${dbUser}:${dbPass}@ac-mihdfkl-shard-00-00.mh16alw.mongodb.net:27017,ac-mihdfkl-shard-00-01.mh16alw.mongodb.net:27017,ac-mihdfkl-shard-00-02.mh16alw.mongodb.net:27017/qrTag?authSource=admin&replicaSet=atlas-2rjx63-shard-0&tls=true&retryWrites=true&w=majority`;
        const uri = explicitUri || defaultUri;

        if (!uri || (!explicitUri && (!dbUser || !dbPass))) {
            throw new Error("Missing MongoDB credentials. Set MONGODB_URI or DB_USER/DB_PASS.");
        }

        await mongoose.connect(uri);

        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.log("❌ DB Error:", err.message);
        process.exit(1);
    }
};


