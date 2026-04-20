import admin from "firebase-admin";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, "firebaseServiceKey.json");

if (!admin.apps.length) {
  if (existsSync(keyPath)) {
    const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // Cloud Functions / Cloud Run: default credentials for this Firebase/GCP project
    admin.initializeApp();
  }
}

export default admin;
