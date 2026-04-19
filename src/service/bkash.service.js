import axios from "axios";

/** bKash id_token is cached; refresh before 45 min expiry (small safety buffer). */
const BKASH_TOKEN_TTL_MS = 45 * 60 * 1000;
const REFRESH_BUFFER_MS = 60 * 1000;

let cache = {
    id_token: null,
    /** epoch ms — use cached token while Date.now() < expiresAt */
    expiresAt: 0,
};

async function fetchGrantToken() {
    const res = await axios.post(
        process.env.BKASH_GRANT_TOKEN_URL,
        {
            app_key: process.env.BKASH_APP_KEY,
            app_secret: process.env.BKASH_APP_SECRET,
        },
        {
            headers: {
                "Content-Type": "application/json",
                username: process.env.BKASH_USERNAME,
                password: process.env.BKASH_PASSWORD,
            },
        }
    );

    console.log("BKASH TOKEN OK (new grant)");
    return res.data.id_token;
}

/**
 * Returns a valid bKash id_token — reuses cache until ~45 min, then grants a new one.
 */
export const getBkashIdToken = async () => {
    const now = Date.now();
    if (
        cache.id_token &&
        now < cache.expiresAt - REFRESH_BUFFER_MS
    ) {
        return cache.id_token;
    }

    const id_token = await fetchGrantToken();
    cache = {
        id_token,
        expiresAt: now + BKASH_TOKEN_TTL_MS,
    };
    return id_token;
};

/** @deprecated Use getBkashIdToken — kept for any old imports */
export const grantBkashToken = getBkashIdToken;
