import rateLimit from "express-rate-limit";

const jsonHandler = (message) => (req, res) => {
    res.status(429).json({ message });
};

function clientIp(req) {
    return (
        req.ip ||
        req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "unknown"
    );
}

/** Authenticated sensitive routes: limit per user and per IP together. */
export function userAndIpKey(req) {
    const ip = clientIp(req);
    const userId = req.user?._id || req.user?.id;
    if (userId) {
        return `user:${userId}:ip:${ip}`;
    }
    return `ip:${ip}`;
}

/** Login: limit per email when provided (slows targeted brute-force). */
function loginEmailKey(req) {
    const email = String(req.body?.email || "")
        .toLowerCase()
        .trim();
    if (email) return `login-email:${email}`;
    return `login-ip:${clientIp(req)}`;
}

const GLOBAL_SKIP_PREFIXES = [
    "/api/payment/bkash/callback",
    "/api/payment/sslcommerz/",
    "/api/order/cron/purge-abandoned",
    "/api/cart/cron/purge-stale",
];

export function shouldSkipGlobalRateLimit(req) {
    const url = String(req.originalUrl || req.url || "");
    return GLOBAL_SKIP_PREFIXES.some((prefix) => url.startsWith(prefix));
}

/** Baseline protection for all /api routes (scraping / light DDoS). */
export const globalApiRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 250,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipGlobalRateLimit,
    handler: jsonHandler("Too many requests. Please try again later."),
});

/** Brute-force protection for email/password login (per IP). */
export const loginIpRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `login-ip:${clientIp(req)}`,
    handler: jsonHandler("Too many login attempts. Try again in 15 minutes."),
});

/** Login attempts per email address. */
export const loginEmailRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: loginEmailKey,
    handler: jsonHandler("Too many login attempts for this email. Try again later."),
});

/** New account creation (per IP). */
export const registerRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `register-ip:${clientIp(req)}`,
    handler: jsonHandler("Too many registration attempts. Try again later."),
});

/** Password reset abuse */
export const forgotPasswordRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `forgot-ip:${clientIp(req)}`,
    handler: jsonHandler("Too many reset requests. Try again later."),
});

/** Social login attempts */
export const socialLoginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `social-ip:${clientIp(req)}`,
    handler: jsonHandler("Too many sign-in attempts. Try again later."),
});

/** Payment initiation (authenticated: user + IP). */
export const paymentCreateRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userAndIpKey,
    handler: jsonHandler("Too many payment requests. Try again later."),
});

/** Checkout order create (authenticated: user + IP). */
export const orderCreateRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userAndIpKey,
    handler: jsonHandler("Too many order requests. Try again later."),
});

/** Backward-compatible alias */
export const loginRateLimit = loginIpRateLimit;
