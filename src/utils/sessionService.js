import crypto from "crypto";
import UserSession from "../models/UserSession.js";

const STAFF_ROLES = new Set(["admin", "provider"]);

export function isStaffRole(role) {
    return STAFF_ROLES.has(String(role || "").trim().toLowerCase());
}

export function buildSessionLabel(userAgent = "") {
    const ua = String(userAgent || "");
    if (!ua) return "Unknown device";

    let browser = "Browser";
    if (/Edg\//i.test(ua)) browser = "Edge";
    else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
    else if (/Firefox\//i.test(ua)) browser = "Firefox";
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";

    let os = "Device";
    if (/Windows NT/i.test(ua)) os = "Windows";
    else if (/Mac OS X/i.test(ua)) os = "macOS";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
    else if (/Linux/i.test(ua)) os = "Linux";

    return `${browser} on ${os}`;
}

export function getRequestIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
        return forwarded.split(",")[0].trim();
    }
    return req.socket?.remoteAddress || "";
}

export function newSessionId() {
    return crypto.randomUUID();
}

export async function revokeAllSessionsForUser(userId) {
    await UserSession.deleteMany({ userId });
}

export async function createStaffSession(user, req) {
    const userAgent = String(req.headers["user-agent"] || "");
    return UserSession.create({
        userId: user._id,
        sessionId: newSessionId(),
        role: user.role,
        userAgent,
        ip: getRequestIp(req),
        label: buildSessionLabel(userAgent),
        lastSeenAt: new Date(),
    });
}

export async function findActiveSession(sessionId, userId) {
    if (!sessionId || !userId) return null;
    return UserSession.findOne({ sessionId, userId }).lean();
}

export async function touchSession(sessionId, userId) {
    if (!sessionId || !userId) return;
    await UserSession.updateOne(
        { sessionId, userId },
        { $set: { lastSeenAt: new Date() } }
    );
}

export async function listSessionsForUser(userId) {
    return UserSession.find({ userId })
        .sort({ lastSeenAt: -1, createdAt: -1 })
        .lean();
}

export async function revokeSessionForUser(userId, sessionId) {
    return UserSession.deleteOne({ userId, sessionId });
}

export async function revokeOtherSessionsForUser(userId, keepSessionId) {
    return UserSession.deleteMany({
        userId,
        sessionId: { $ne: keepSessionId },
    });
}
