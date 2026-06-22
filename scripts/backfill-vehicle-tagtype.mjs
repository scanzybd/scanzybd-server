/**
 * Backfill Vehicle.tagType for existing vehicles that have it empty.
 *
 * Source of truth: the order that sold the tag. Each order has
 * tagAssignments[{ vehicleId, productId }]; the Product.type holds the tag type
 * name (e.g. "Cycle Tag", "Bike Tag"). We map vehicle -> productId -> product.type.
 *
 * Usage:
 *   node scripts/backfill-vehicle-tagtype.mjs            # apply
 *   node scripts/backfill-vehicle-tagtype.mjs --dry-run  # report only, no writes
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Vehicle from "../src/models/Vehicle.js";
import Order from "../src/models/Order.js";
import Product from "../src/models/Product.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

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

await mongoose.connect(buildUri());

process.stdout.write(`${dryRun ? "DRY RUN" : "Backfill"} vehicle tagType\n`);

try {
    // Vehicles with no tagType yet (missing or empty string).
    const vehicles = await Vehicle.find({
        $or: [{ tagType: { $exists: false } }, { tagType: "" }, { tagType: null }],
    }).lean();

    process.stdout.write(`Found ${vehicles.length} vehicle(s) without tagType.\n`);

    // Cache product type lookups.
    const productTypeCache = new Map();
    const productType = async (productId) => {
        const key = String(productId || "");
        if (!key) return "";
        if (productTypeCache.has(key)) return productTypeCache.get(key);
        let type = "";
        if (mongoose.Types.ObjectId.isValid(key)) {
            const product = await Product.findById(key).select("type").lean();
            type = String(product?.type || "").trim();
        }
        productTypeCache.set(key, type);
        return type;
    };

    let updated = 0;
    let skipped = 0;

    for (const v of vehicles) {
        // Find an order that assigned this vehicle.
        const order = await Order.findOne({ "tagAssignments.vehicleId": v._id })
            .select("tagAssignments")
            .lean();

        const assignment = order?.tagAssignments?.find(
            (t) => String(t.vehicleId) === String(v._id)
        );

        let tagType = String(assignment?.tagType || "").trim();
        if (!tagType && assignment?.productId) {
            tagType = await productType(assignment.productId);
        }

        if (!tagType) {
            skipped += 1;
            process.stdout.write(`  skip: ${v.plate} (${v.vehicleName}) — no source type found\n`);
            continue;
        }

        process.stdout.write(`  set: ${v.plate} -> "${tagType}"\n`);
        if (!dryRun) {
            await Vehicle.updateOne({ _id: v._id }, { $set: { tagType } });
        }
        updated += 1;
    }

    process.stdout.write(
        `${dryRun ? "Would update" : "Updated"} ${updated}, skipped ${skipped}.\n`
    );
} finally {
    await mongoose.disconnect();
}
