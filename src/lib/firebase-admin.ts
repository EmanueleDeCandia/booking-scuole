import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "booking-scuole";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey && privateKey.includes("\\n")) {
  privateKey = privateKey.replace(/\\n/g, "\n");
}

export const isFirebaseAdminConfigured = Boolean(clientEmail && privateKey);

let app: App | undefined;

if (!getApps().length) {
  if (isFirebaseAdminConfigured && clientEmail && privateKey) {
    try {
      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } catch (e) {
      console.warn("Failed to initialize Firebase Admin SDK:", e);
    }
  } else {
    try {
      app = initializeApp({ projectId });
    } catch {
      // ignore
    }
  }
} else {
  app = getApps()[0];
}

export const adminAuth: Auth | null = app ? getAuth(app) : null;
export default app;
