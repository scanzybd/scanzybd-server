import axios from "axios";

/**
 * Verify Firebase/Google ID token via Identity Toolkit (server-side).
 * Requires FIREBASE_WEB_API_KEY in server env (Firebase console → Web API key).
 */
export async function verifyFirebaseIdToken(idToken) {
    const token = String(idToken || "").trim();
    if (!token) {
        throw new Error("idToken is required");
    }

    const apiKey = String(process.env.FIREBASE_WEB_API_KEY || "").trim();
    if (!apiKey) {
        throw new Error("FIREBASE_WEB_API_KEY is not configured on server");
    }

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
    const { data } = await axios.post(url, { idToken: token }, { timeout: 10000 });

    const account = data?.users?.[0];
    if (!account?.localId) {
        throw new Error("Invalid or expired ID token");
    }

    return {
        uid: account.localId,
        email: String(account.email || "").toLowerCase().trim(),
        name: account.displayName || "Social User",
        photo: account.photoUrl || null,
        emailVerified: account.emailVerified === true || account.emailVerified === "true",
    };
}
