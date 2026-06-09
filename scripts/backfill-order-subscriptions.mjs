/**
 * Safe backfill: paid orders missing item validity and/or TagSubscription.
 *
 * Usage:
 *   node scripts/backfill-order-subscriptions.mjs --dry-run --orderNo=00035
 *   node scripts/backfill-order-subscriptions.mjs --apply --orderNo=00035
 *   node scripts/backfill-order-subscriptions.mjs --apply --all
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { backfillLegacyOrders } from "../src/utils/backfillLegacyOrders.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const args = process.argv.slice(2);
const dryRun = !args.includes("--apply");
const all = args.includes("--all");
const orderNoArg = args.find((a) => a.startsWith("--orderNo="));
const orderNo = orderNoArg ? orderNoArg.split("=")[1] : null;

if (!all && !orderNo) {
    console.error(
        "Specify --orderNo=00035 or --all. Use --dry-run (default) or --apply."
    );
    process.exit(1);
}

const dbUser = encodeURIComponent(String(process.env.DB_USER || "").trim());
const dbPass = encodeURIComponent(String(process.env.DB_PASS || "").trim());
const uri =
    process.env.MONGODB_URI?.trim() ||
    `mongodb+srv://${dbUser}:${dbPass}@cluster0.zzqq3aq.mongodb.net/scanzybd_db?appName=Cluster0`;

process.stdout.write(`${dryRun ? "DRY RUN (no writes)" : "APPLY mode (will write to DB)"}\n`);
process.stdout.write(`${all ? "Scope: all legacy paid orders" : `Scope: orderNo=${orderNo}`}\n`);

await mongoose.connect(uri);

try {
    const report = await backfillLegacyOrders({
        dryRun,
        orderNo: all ? null : orderNo,
        limit: all ? 2000 : 50,
    });

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

    if (dryRun) {
        process.stdout.write("\nNo changes written. Re-run with --apply to persist.\n");
    } else {
        process.stdout.write("\nBackfill complete.\n");
    }
} finally {
    await mongoose.disconnect();
}
