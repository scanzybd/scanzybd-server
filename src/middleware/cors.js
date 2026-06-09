import cors from "cors";

const DEFAULT_ORIGINS = [
    "https://scanzybd.com",
    "https://www.scanzybd.com",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
];

function buildAllowedOrigins() {
    const extra = String(process.env.CORS_ALLOWED_ORIGINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const fromEnv = [process.env.CLIENT_URL, process.env.FRONTEND_URL]
        .map((s) => String(s || "").trim().replace(/\/$/, ""))
        .filter(Boolean);

    return [...new Set([...DEFAULT_ORIGINS, ...fromEnv, ...extra])];
}

function isAllowedOrigin(origin, allowed) {
    if (!origin) return true;
    if (allowed.includes(origin)) return true;
    try {
        const host = new URL(origin).hostname;
        if (host === "scanzybd.com" || host.endsWith(".scanzybd.com")) {
            return true;
        }
        if (host === "localhost" || host === "127.0.0.1") {
            return true;
        }
    } catch {
        return false;
    }
    return false;
}

export function createCorsMiddleware() {
    const allowed = buildAllowedOrigins();

    return cors({
        origin(origin, callback) {
            if (isAllowedOrigin(origin, allowed)) {
                callback(null, true);
            } else {
                console.warn("[cors] blocked origin:", origin);
                callback(null, false);
            }
        },
        credentials: true,
    });
}
