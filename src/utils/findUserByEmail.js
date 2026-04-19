import User from "../models/User.js";

/**
 * Find user by email from Firebase token (case-insensitive).
 * Fixes manual Mongo inserts with different casing vs Firebase.
 */
export async function findUserByFirebaseEmail(emailFromToken) {
    const norm = String(emailFromToken || "")
        .toLowerCase()
        .trim();
    if (!norm) return null;

    let dbUser = await User.findOne({ email: norm });
    if (dbUser) return dbUser;

    const safe = norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return User.findOne({
        email: { $regex: new RegExp(`^${safe}$`, "i") },
    });
}
