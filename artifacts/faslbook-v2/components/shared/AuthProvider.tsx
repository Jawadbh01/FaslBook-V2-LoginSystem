"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";

const PUBLIC_PATHS = ["/login", "/email", "/register", "/create-farm"];

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { setUser, setOrganization, setRole, setLoading, loading } =
    useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

      if (firebaseUser) {
        setUser(firebaseUser);

        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (!userDoc.exists()) {
            // New Google/Facebook user — create Firestore user doc
            await setDoc(userDocRef, {
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
            setLoading(false);
            router.replace("/create-farm");
            return;
          }

          const userData = userDoc.data();
          setRole(userData.role);

          if (userData.organizationId) {
            const orgDoc = await getDoc(
              doc(db, "organizations", userData.organizationId)
            );
            if (orgDoc.exists()) {
              setOrganization(orgDoc.data() as any);
              setLoading(false);
              // Only redirect away if on a public/auth page
              if (isPublicPath) {
                router.replace("/overview");
              }
              return;
            }
          }

          // User exists but no valid org
          setLoading(false);
          if (pathname !== "/create-farm") {
            router.replace("/create-farm");
          }
        } catch (error) {
          console.error("Auth check error:", error);
          setLoading(false);
        }
      } else {
        // Not logged in
        setUser(null);
        setOrganization(null);
        setRole(null);
        setLoading(false);
        if (!isPublicPath) {
          router.replace("/login");
        }
      }
    });

    return () => unsubscribe();
  }, [pathname]);

  if (loading) {
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
