import User from "../models/User.js";

function normalizeEmail(email) {
    return String(email || "").toLowerCase().trim();
}

function hasPassword(user) {
    return typeof user?.password === "string" && user.password !== "";
}

/** All rows for an email (legacy DB may have duplicates before unique index). */
export async function findUsersByEmail(email) {
    const emailNorm = normalizeEmail(email);
    if (!emailNorm) return [];
    return User.find({ email: emailNorm }).sort({ createdAt: -1 });
}

/** Password login: prefer active account with a password hash. */
export function pickLoginUser(users) {
    if (!users?.length) return null;
    const active = users.filter((u) => u.isActive !== false);
    const pool = active.length ? active : users;
    return pool.find((u) => hasPassword(u)) || pool[0] || null;
}

/** Social login: prefer matching uid, then password account, then newest active. */
export function pickSocialUser(users, { uid } = {}) {
    if (!users?.length) return null;
    const active = users.filter((u) => u.isActive !== false);
    const pool = active.length ? active : users;

    if (uid) {
        const byUid = pool.find((u) => u.uid && String(u.uid) === String(uid));
        if (byUid) return byUid;
    }

    const withPassword = pool.find((u) => hasPassword(u));
    if (withPassword) return withPassword;

    return pool[0] || null;
}
