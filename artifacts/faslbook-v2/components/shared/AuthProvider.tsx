"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";

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
      if (firebaseUser) {
        setUser(firebaseUser);

        // Check user in Firestore
        try {
          const userDoc = await getDoc(
            doc(db, "users", firebaseUser.uid)
          );

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setRole(userData.role);

            // Check if user has organization
            if (userData.organizationId) {
              const orgDoc = await getDoc(
                doc(db, "organizations", userData.organizationId)
              );
              if (orgDoc.exists()) {
                setOrganization(orgDoc.data() as any);
                setLoading(false);
                router.replace("/overview");
                return;
              }
            }

            // User exists but no org — go create farm
            setLoading(false);
            router.replace("/create-farm");
          } else {
            // New Google/Facebook user — save to Firestore first
            const { setDoc, serverTimestamp } = await import(
              "firebase/firestore"
            );
            await setDoc(doc(db, "users", firebaseUser.uid), {
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
          }
        } catch (error) {
          console.error("Auth check error:", error);
          setLoading(false);
        }
      } else {
        // No user — redirect to login
        setUser(null);
        setOrganization(null);
        setRole(null);
        setLoading(false);
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, []);

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
