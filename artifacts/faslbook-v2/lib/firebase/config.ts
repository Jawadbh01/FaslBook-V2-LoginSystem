import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
})();

export const storage = getStorage(app);

// ── FCM: only in browser ──────────────────────────────────────────
export async function requestNotificationPermission(organizationId: string): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const { getMessaging, getToken } = await import("firebase/messaging");
    const messaging = getMessaging(app);
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, { vapidKey });

    if (token) {
      const { doc, setDoc } = await import("firebase/firestore");
      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, "fcmTokens", user.uid), {
          token,
          organizationId,
          userId: user.uid,
          updatedAt: new Date(),
        });
        // Post Firebase config to service worker so it can init messaging
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.active?.postMessage({ type: "FIREBASE_CONFIG", config: firebaseConfig });
        }
      }
    }
    return token;
  } catch (err) {
    console.error("Notification permission error:", err);
    return null;
  }
}

export default app;
