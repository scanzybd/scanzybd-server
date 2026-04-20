import admin from "../config/firebaseAdmin.js";
import User from "../models/User.js";
import { findUserByFirebaseEmail } from "../utils/findUserByEmail.js";

export const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ message: "No token" });
        }

        const decoded = await admin.auth().verifyIdToken(token);

        const dbUser = await findUserByFirebaseEmail(decoded.email);

        if (!dbUser) {
            return res.status(404).json({ message: "User not found in DB" });
        }

        if (dbUser.isActive === false) {
            return res.status(403).json({ message: "Account is disabled" });
        }

        req.user = {
            _id: dbUser._id,   // 🔥 FIX HERE
            email: dbUser.email,
            uid: decoded.uid,
            role: dbUser.role,
        };

        next();
    } catch (err) {
        console.log(err);
        return res.status(401).json({ message: "Invalid token" });
    }
};

export const isProvider = (req, res, next) => {
    if (!req.user?.role) {
        return res.status(401).json({ message: "No role found" });
    }

    if (req.user.role !== "provider" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
    }

    next();
};

export const isAdmin = (req, res, next) => {
    if (!req.user?.role) {
        return res.status(401).json({ message: "No role found" });
    }

    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
    }

    next();
};

/** Admin or provider — e.g. assign vehicles to customer accounts */
export const isAdminOrProvider = (req, res, next) => {
    if (!req.user?.role) {
        return res.status(401).json({ message: "No role found" });
    }

    if (req.user.role !== "admin" && req.user.role !== "provider") {
        return res.status(403).json({ message: "Forbidden" });
    }

    next();
};

/**
 * If Authorization Bearer token is valid, sets req.user (same shape as verifyToken).
 * On missing/invalid token, sets req.user = null and continues (for public + scoped lists).
 */
export const optionalVerifyToken = async (req, res, next) => {
    req.user = null;
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return next();
        }

        const decoded = await admin.auth().verifyIdToken(token);
        const dbUser = await findUserByFirebaseEmail(decoded.email);

        if (!dbUser || dbUser.isActive === false) {
            return next();
        }

        req.user = {
            _id: dbUser._id,
            email: dbUser.email,
            uid: decoded.uid,
            role: dbUser.role,
        };
    } catch {
        // ignore — treat as anonymous (e.g. storefront catalog)
    }
    next();
};