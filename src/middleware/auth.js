import jwt from "jsonwebtoken";
import User from "../models/User.js";

const buildReqUser = (dbUser) => ({
    _id: dbUser._id,
    email: dbUser.email,
    uid: dbUser.uid || null,
    role: dbUser.role,
});

const verifyAppJwt = async (token) => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const dbUser = await User.findById(decoded.id).lean();
    if (!dbUser) {
        throw new Error("User not found in DB");
    }
    if (dbUser.isActive === false) {
        throw new Error("Account is disabled");
    }
    return buildReqUser(dbUser);
};

export const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ message: "No token" });
        }

        req.user = await verifyAppJwt(token);

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

        req.user = await verifyAppJwt(token);
        return next();
    } catch {
        // ignore — treat as anonymous (e.g. storefront catalog)
    }
    next();
};