/**
 * Vercel serverless entry — Node passes real `req`/`res` (not Lambda-style events).
 * Local dev: `npm run dev` → `src/index.js` (listen on PORT).
 */
import "dotenv/config";
import app from "../src/app.js";
import { connectDB } from "../src/config/db.js";

let dbReady = globalThis.__qrTagDbReady;
if (!dbReady) {
  dbReady = connectDB();
  globalThis.__qrTagDbReady = dbReady;
}

export default async function handler(req, res) {
  try {
    await dbReady;
  } catch (e) {
    console.error("[vercel] DB:", e);
    res.status(503).json({ success: false, message: "Database unavailable" });
    return;
  }
  app(req, res);
}
