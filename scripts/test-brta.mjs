import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const dbUser = encodeURIComponent(String(process.env.DB_USER || "").trim());
const dbPass = encodeURIComponent(String(process.env.DB_PASS || "").trim());
const uri =
  process.env.MONGODB_URI?.trim() ||
  `mongodb+srv://${dbUser}:${dbPass}@cluster0.zzqq3aq.mongodb.net/scanzybd_db?appName=Cluster0`;

await mongoose.connect(uri);
const db = mongoose.connection.db;
const cols = (await db.listCollections().toArray()).map((c) => c.name);
process.stdout.write(`collections with brta: ${JSON.stringify(cols.filter((n) => /brta/i.test(n)))}\n`);

for (const name of ["BRTA_zone", "BRTA_series", "brta_zone", "brta_series"]) {
  try {
    const count = await db.collection(name).countDocuments();
    if (count > 0) {
      const one = await db.collection(name).findOne();
      process.stdout.write(`${name} ${count} ${JSON.stringify(one)}\n`);
    }
  } catch (e) {
    process.stdout.write(`${name} err ${e.message}\n`);
  }
}

await mongoose.disconnect();
