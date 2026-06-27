"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";

const PUBLIC = ["/login", "/email", "/register", "/create-farm", "/role-select", "/join-farm", "/pending"];
const CACHE_KEY = "faslbook_user_cache";
const ORG_KEY   = "faslbook_org_cache";

export function saveToCache(user: any, org: any, role: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role,
    }));
    if (org) localStorage.setItem(ORG_KEY, JSON.stringify(org));
    localStorage.setItem("faslbook_last_sync", Date.now().toString());
  } catch {}
}

export function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(ORG_KEY);
    localStorage.removeItem("faslbook_last_sync");
  } catch {}
}

function loadFromCache() {
  try {
    const user = localStorage.getItem(CACHE_KEY);
    const org  = localStorage.getItem(ORG_KEY);
    return {
      user: user ? JSON.parse(user) : null,
      org:  org  ? JSON.parse(org)  : null,
    };
  } catch {
    return { user: null, org: null };
  }
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setOrganization, setRole, setLoading } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    let settled = false;

    function resolveFromCache(redirect = true) {
      const { user: cu, org: co } = loadFromCache();
      if (cu) {
        setUser(cu as any);
        setRole(cu.role);
        if (co) setOrganization(co as any);
        setLoading(false);
        setReady(true);
        if (redirect && PUBLIC.includes(path)) window.location.replace("/overview");
      } else {
        setLoading(false);
        setReady(true);
        if (redirect && !PUBLIC.includes(path)) window.location.replace("/login");
      }
    }

    // ── Offline / slow-network timeout ────────────────────────────────────
    // If Firebase hasn't responded in 5 s, fall back to localStorage cache.
    // This handles: expired token + offline, slow connection, Firebase outage.
    const offlineTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.log("[Auth] Firebase timeout — falling back to cache");
      resolveFromCache();
    }, 5000);

    // ── Firebase auth listener ────────────────────────────────────────────
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (settled) return;

      if (firebaseUser) {
        try {
          const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));

          if (!userSnap.exists()) {
            settled = true;
            clearTimeout(offlineTimer);
            setLoading(false);
            setReady(true);
            if (path !== "/role-select") window.location.replace("/role-select");
            return;
          }

          const userData = userSnap.data();
          setRole(userData.role);

          if (!userData.role) {
            settled = true;
            clearTimeout(offlineTimer);
            setLoading(false);
            setReady(true);
            if (path !== "/role-select") window.location.replace("/role-select");
            return;
          }

          if (!userData.organizationId) {
            settled = true;
            clearTimeout(offlineTimer);
            setLoading(false);
            setReady(true);
            if (userData.role === "landlord" && path !== "/create-farm") {
              window.location.replace("/create-farm");
            } else if (userData.role !== "landlord" && path !== "/join-farm" && path !== "/pending") {
              window.location.replace("/join-farm");
            }
            return;
          }

          const orgSnap = await getDoc(doc(db, "organizations", userData.organizationId));
          const orgData = orgSnap.exists() ? orgSnap.data() : null;
          if (orgData) setOrganization(orgData as any);

          // Persist everything to localStorage so offline works
          saveToCache(firebaseUser, orgData, userData.role);
          setUser(firebaseUser);

          settled = true;
          clearTimeout(offlineTimer);
          setLoading(false);
          setReady(true);

          if (PUBLIC.includes(path)) window.location.replace("/overview");

        } catch {
          // Firestore network error (offline) — Firebase auth is fine though
          // Fall back to localStorage cache
          console.log("[Auth] Firestore offline — using cache");
          settled = true;
          clearTimeout(offlineTimer);
          resolveFromCache(false); // already authenticated, no redirect needed
        }

      } else {
        // Firebase returned null — could be genuinely logged out OR offline with expired token
        const { user: cached } = loadFromCache();

        if (cached) {
          // We have a cache → user was previously authenticated.
          // Treat this as offline mode, not logout.
          console.log("[Auth] Firebase null + cache found → offline mode");
          settled = true;
          clearTimeout(offlineTimer);
          setUser(cached as any);
          setRole(cached.role);
          const { org: co } = loadFromCache();
          if (co) setOrganization(co as any);
          setLoading(false);
          setReady(true);
          // Do NOT redirect — user is still "logged in" offline
          return;
        }

        // No cache + no Firebase user = genuinely logged out
        settled = true;
        clearTimeout(offlineTimer);
        clearCache();
        setUser(null);
        setOrganization(null);
        setRole(null);
        setLoading(false);
        setReady(true);
        if (!PUBLIC.includes(path)) window.location.replace("/login");
      }
    });

    return () => {
      clearTimeout(offlineTimer);
      unsub();
    };
  }, []);

  if (!ready) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "white",
        gap: "16px",
      }}>
        <img
          src="/logo.png"
          alt="FaslBook"
          style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 16 }}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <div style={{
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          border: "4px solid #e5e7eb",
          borderTopColor: "#1B5E20",
          animation: "spin 0.8s linear infinite",
        }} />
        <p style={{ color: "#9ca3af", fontSize: "14px" }}>Loading FaslBook...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <>{children}</>;
}
