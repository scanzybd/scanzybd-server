import jwt from "jsonwebtoken";
import User from "../models/User.js";
import {
    findActiveSession,
    isStaffRole,
    touchSession,
} from "../utils/sessionService.js";

export const SESSION_REVOKED_CODE = "SESSION_REVOKED";
export const SESSION_REVOKED_MESSAGE =
    "Your session ended because you signed in on another device or revoked this session.";

const buildReqUser = (dbUser, sessionId = null) => ({
    _id: dbUser._id,
    email: dbUser.email,
    uid: dbUser.uid || null,
    role: dbUser.role,
    sessionId: sessionId || null,
});

const verifyAppJwt = async (token, { touchLastSeen = false } = {}) => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const dbUser = await User.findById(decoded.id).lean();
    if (!dbUser) {
        throw new Error("User not found in DB");
    }
    if (dbUser.isActive === false) {
        throw new Error("Account is disabled");
    }

    const sessionId = decoded.sid || null;
    if (isStaffRole(dbUser.role) && sessionId) {
        const session = await findActiveSession(sessionId, dbUser._id);
        if (!session) {
            const err = new Error(SESSION_REVOKED_MESSAGE);
            err.code = SESSION_REVOKED_CODE;
            throw err;
        }
        if (touchLastSeen) {
            await touchSession(sessionId, dbUser._id);
        }
    }

    return buildReqUser(dbUser, sessionId);
};

export const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ message: "No token" });
        }

        req.user = await verifyAppJwt(token, { touchLastSeen: true });

        next();
    } catch (err) {
        if (err?.code === SESSION_REVOKED_CODE) {
            return res.status(401).json({
                message: SESSION_REVOKED_MESSAGE,
                code: SESSION_REVOKED_CODE,
            });
        }
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

export { verifyAppJwt };
