import crypto from "crypto";
import { LRUCache } from "lru-cache";

const truthy = (v) => v === "1" || /^true$/i.test(String(v || ""));

const enabled = () => truthy(process.env.API_CACHE_ENABLED ?? "true");

const SKIP_GET_PATH_PREFIXES = ["/api/payment/bkash/callback"];

const RESOURCE_TO_GROUP = {
    products: "products",
    qr: "qr",
    vehicle: "vehicles",
    package: "packages",
    order: "orders",
    contact: "contacts",
    expenses: "expenses",
    users: "users",
    reviews: "reviews",
    locations: "locations",
    payment: "payments",
    auth: "auth",
};

const versions = new Map();

/** @type {LRUCache<string, { statusCode: number; body: unknown }>} */
let cache;

function getCache() {
    if (!cache) {
        cache = new LRUCache({
            max: Number(process.env.API_CACHE_MAX) || 500,
            ttl: Number(process.env.API_CACHE_TTL_MS) || 300_000,
            updateAgeOnGet: true,
        });
    }
    return cache;
}

function pathname(req) {
    return `${req.baseUrl || ""}${req.path || ""}`.split("?")[0];
}

function cacheGroupFromPath(p) {
    if (!p.startsWith("/api/")) return null;
    const rest = p.slice("/api/".length);
    const resource = rest.split("/")[0] || "";
    return RESOURCE_TO_GROUP[resource] || null;
}

function shouldSkipGetCache(req) {
    const p = pathname(req);
    return SKIP_GET_PATH_PREFIXES.some((prefix) => p.startsWith(prefix));
}

function authFingerprint(req) {
    const raw = req.headers.authorization || "";
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

function groupsToBump(p) {
    const groups = new Set();
    const primary = cacheGroupFromPath(p);
    if (primary) groups.add(primary);

    if (p.startsWith("/api/payment")) {
        groups.add("payments");
        if (p.includes("/confirm") || p.includes("/create")) groups.add("orders");
    }
    if (p.startsWith("/api/qr/assign")) groups.add("vehicles");
    if (p.startsWith("/api/users")) {
        groups.add("users");
        groups.add("auth");
    }
    return groups;
}

function bumpVersionsForPath(p) {
    for (const g of groupsToBump(p)) {
        versions.set(g, (versions.get(g) || 0) + 1);
    }
}

/** Successful mutation bumps version for related GET cache groups (stale entries age out via LRU TTL). */
export function bumpCacheOnMutation(req, res, next) {
    if (!enabled()) return next();

    const method = req.method;
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        return next();
    }

    res.on("finish", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        bumpVersionsForPath(pathname(req));
    });

    next();
}

/** Cache GET JSON responses keyed by group version + URL + auth fingerprint. */
export function serveApiGetCache(req, res, next) {
    if (!enabled()) return next();
    if (req.method !== "GET") return next();
    if (shouldSkipGetCache(req)) return next();

    const group = cacheGroupFromPath(pathname(req));
    if (!group) return next();

    const v = versions.get(group) || 0;
    const key = `${group}:${v}:${authFingerprint(req)}:${req.originalUrl}`;
    const store = getCache();
    const hit = store.get(key);
    if (hit) {
        res.setHeader("X-API-Cache", "HIT");
        return res.status(hit.statusCode).json(hit.body);
    }

    const origJson = res.json.bind(res);
    res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            store.set(key, { statusCode: res.statusCode, body });
            res.setHeader("X-API-Cache", "MISS");
        }
        return origJson(body);
    };

    next();
}

export function installApiResponseCache(app) {
    app.use("/api", bumpCacheOnMutation);
    app.use("/api", serveApiGetCache);
}
