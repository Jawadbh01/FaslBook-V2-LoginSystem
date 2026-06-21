"use client";
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";

const PUBLIC_ROUTES = ["/login", "/email", "/register", "/create-farm", "/role-select", "/join-farm", "/pending"];

function isPublicPath(path: string) {
  return PUBLIC_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
}

function navigate(path: string) {
  if (typeof window !== "undefined") {
    window.location.replace(path);
  }
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const currentPath = window.location.pathname;
      const onPublic = isPublicPath(currentPath);

      const { setUser, setOrganization, setRole, setLoading } =
        useAuthStore.getState();

      try {
        if (firebaseUser) {
          setUser(firebaseUser);

          const userRef = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            // New social login — create bare user doc, send to role selection
            await setDoc(userRef, {
              id: firebaseUser.uid,
              name: firebaseUser.displayName ?? "",
              email: firebaseUser.email ?? "",
              phone: firebaseUser.phoneNumber ?? "",
              photoUrl: firebaseUser.photoURL ?? "",
              role: null,
              organizationId: null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              syncStatus: "synced",
            });
            setLoading(false);
            setReady(true);
            navigate("/role-select");
            return;
          }

          const userData = userSnap.data();
          const role = userData.role ?? null;
          setRole(role);

          if (userData.organizationId) {
            // Fetch org in parallel with nothing else to wait on
            const orgSnap = await getDoc(
              doc(db, "organizations", userData.organizationId)
            );
            if (orgSnap.exists()) {
              setOrganization(orgSnap.data() as any);
              setLoading(false);
              setReady(true);
              if (onPublic) navigate("/overview");
              return;
            }
          }

          // Logged in but no org yet
          setLoading(false);
          setReady(true);

          if (role === "landlord") {
            if (currentPath !== "/create-farm") navigate("/create-farm");
          } else if (role === "manager" || role === "farmer") {
            if (currentPath !== "/join-farm" && currentPath !== "/pending") {
              navigate("/join-farm");
            }
          } else {
            // role is null — Google user who never picked a role
            if (currentPath !== "/role-select") navigate("/role-select");
          }
        } else {
          // Not logged in
          setUser(null);
          setOrganization(null);
          setRole(null);
          setLoading(false);
          setReady(true);
          if (!onPublic) navigate("/login");
        }
      } catch (err) {
        console.error("AuthProvider error:", err);
        setLoading(false);
        setReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <div
          className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100"
          style={{ borderTopColor: "#1B5E20" }}
        />
        <p className="text-gray-400 text-sm">Loading FaslBook...</p>
      </div>
    );
  }

  return <>{children}</>;
}
