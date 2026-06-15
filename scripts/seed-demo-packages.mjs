/**
 * Seed demo homepage offer packages (Offer Showcase).
 *
 * Usage:
 *   node scripts/seed-demo-packages.mjs           # skip if any package exists
 *   node scripts/seed-demo-packages.mjs --force   # delete demo-seed packages, re-insert
 *   node scripts/seed-demo-packages.mjs --dry-run # print only, no writes
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Package from "../src/models/Package.js";
import { DEMO_PACKAGES } from "./data/demoPackages.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");

function buildUri() {
    const explicit = process.env.MONGODB_URI?.trim();
    if (explicit) return explicit;

    const dbUser = encodeURIComponent(String(process.env.DB_USER || "").trim());
    const dbPass = encodeURIComponent(String(process.env.DB_PASS || "").trim());
    if (!dbUser || !dbPass) {
        throw new Error("Set MONGODB_URI or DB_USER + DB_PASS in startup-server/.env");
    }
    return `mongodb+srv://${dbUser}:${dbPass}@cluster0.zzqq3aq.mongodb.net/scanzybd_db?appName=Cluster0`;
}

const uri = buildUri();

process.stdout.write(
    `${dryRun ? "DRY RUN" : force ? "FORCE seed" : "Seed"} demo packages\n`
);

await mongoose.connect(uri);

try {
    const existingCount = await Package.countDocuments();
    const demoExisting = await Package.countDocuments({
        "createdBy.uid": "demo-seed",
    });

    if (existingCount > 0 && !force && !dryRun) {
        process.stdout.write(
            `Skip: ${existingCount} package(s) already in DB. Use --force to replace demo-seed rows only.\n`
        );
        process.exit(0);
    }

    if (force && !dryRun) {
        const removed = await Package.deleteMany({ "createdBy.uid": "demo-seed" });
        process.stdout.write(`Removed ${removed.deletedCount} previous demo package(s).\n`);
    }

    if (dryRun) {
        process.stdout.write(`${JSON.stringify(DEMO_PACKAGES, null, 2)}\n`);
        process.exit(0);
    }

    const created = await Package.insertMany(DEMO_PACKAGES);
    process.stdout.write(`Inserted ${created.length} demo package(s):\n`);
    for (const row of created) {
        process.stdout.write(`  - ${row.title} (৳${row.price}) [${row.category}]\n`);
    }
    process.stdout.write("Homepage Offer Showcase will show these after client refresh.\n");
} finally {
    await mongoose.disconnect();
}
