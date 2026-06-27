"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";

const PUBLIC = ["/login", "/email", "/register", "/create-farm", "/role-select", "/join-farm", "/pending"];
const CACHE_KEY = "faslbook_user_cache";
const ORG_KEY   = "faslbook_org_cache";

function saveToCache(user: any, org: any, role: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role,
    }));
    if (org) localStorage.setItem(ORG_KEY, JSON.stringify(org));
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

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(ORG_KEY);
    localStorage.removeItem("faslbook_last_sync");
  } catch {}
}

export { saveToCache, clearCache };

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setOrganization, setRole, setLoading } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;

    // ── Step 1: Load from cache immediately so the app shows content without delay
    const { user: cachedUser, org: cachedOrg } = loadFromCache();

    if (cachedUser) {
      setUser(cachedUser as any);
      setRole(cachedUser.role);
      if (cachedOrg) setOrganization(cachedOrg);
      setLoading(false);
      setReady(true);
      if (PUBLIC.includes(path)) {
        window.location.replace("/overview");
      }
    } else {
      if (!PUBLIC.includes(path)) {
        window.location.replace("/login");
        return;
      }
      setReady(true);
    }

    // ── Step 2: Background Firebase auth check — does NOT block the UI
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));

          if (!userSnap.exists()) {
            if (!PUBLIC.includes(path)) window.location.replace("/role-select");
            return;
          }

          const userData = userSnap.data();
          setRole(userData.role);

          if (!userData.role) {
            if (!PUBLIC.includes(path)) window.location.replace("/role-select");
            return;
          }

          if (!userData.organizationId) {
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

          saveToCache(firebaseUser, orgData, userData.role);
          setUser(firebaseUser);
          setLoading(false);
          setReady(true);

          if (PUBLIC.includes(path)) {
            window.location.replace("/overview");
          }

        } catch {
          // Network error — cache is already loaded, just continue
          console.log("Firebase offline — using cached auth");
          setLoading(false);
          setReady(true);
        }

      } else {
        // Firebase returned null user.
        // If we have a cached user it means we are OFFLINE, not logged out — do NOT redirect.
        const { user: cached } = loadFromCache();
        if (cached) {
          console.log("Offline detected — keeping cached auth");
          setLoading(false);
          setReady(true);
          return;
        }

        // No cache and no Firebase user → genuinely logged out
        clearCache();
        setUser(null);
        setOrganization(null);
        setRole(null);
        setLoading(false);
        setReady(true);
        if (!PUBLIC.includes(path)) {
          window.location.replace("/login");
        }
      }
    });

    return () => unsub();
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
