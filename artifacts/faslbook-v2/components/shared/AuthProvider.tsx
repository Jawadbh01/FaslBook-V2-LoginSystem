"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";

const PUBLIC_ROUTES = ["/login", "/email", "/register", "/create-farm"];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setUser, setOrganization, setRole, setLoading, loading } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          const userRef = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            await setDoc(userRef, {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || "",
              email: firebaseUser.email || "",
              phone: firebaseUser.phoneNumber || "",
              photoUrl: firebaseUser.photoURL || "",
              role: null,
              organizationId: null,
              status: "pending",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              syncStatus: "synced",
            });
            setReady(true);
            setLoading(false);
            router.replace("/create-farm");
            return;
          }

          const userData = userSnap.data();
          setRole(userData.role);

          if (userData.organizationId) {
            const orgSnap = await getDoc(doc(db, "organizations", userData.organizationId));
            if (orgSnap.exists()) {
              setOrganization(orgSnap.data() as any);
              setReady(true);
              setLoading(false);
              if (PUBLIC_ROUTES.includes(pathname)) {
                router.replace("/overview");
              }
              return;
            }
          }

          setReady(true);
          setLoading(false);
          router.replace("/create-farm");

        } else {
          setUser(null);
          setOrganization(null);
          setRole(null);
          setReady(true);
          setLoading(false);
          if (!PUBLIC_ROUTES.includes(pathname)) {
            router.replace("/login");
          }
        }
      } catch (error) {
        console.error("Auth error:", error);
        setReady(true);
        setLoading(false);
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
