"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";
import {
  Wheat,
  Mail,
  Phone,
  Facebook,
  Chrome,
  Loader2,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setLoading } = useAuthStore();
  const [error, setError] = useState("");
  const [loading, setLocalLoading] = useState(false);
  const [redirectChecking, setRedirectChecking] = useState(true);

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setUser(result.user);
          router.push("/overview");
        }
      })
      .catch((error) => {
        console.error("Redirect error:", error);
        setError("Login failed. Please try again.");
      })
      .finally(() => {
        setRedirectChecking(false);
      });
  }, []);

  const handleGoogle = async () => {
    try {
      setLocalLoading(true);
      setError("");
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      setError("Google login failed. Please try again.");
      setLocalLoading(false);
    }
  };

  const handleFacebook = async () => {
    try {
      setLocalLoading(true);
      setError("");
      const provider = new FacebookAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      setError("Facebook login failed. Please try again.");
      setLocalLoading(false);
    }
  };

  const handlePhone = () => {
    router.push("/auth/phone");
  };

  const handleEmail = () => {
    router.push("/email");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Top Green Section */}
      <div
        className="flex flex-col items-center justify-center pt-16 pb-10 px-6"
        style={{ backgroundColor: "#1B5E20" }}
      >
        {/* Logo */}
        <div className="bg-white rounded-full p-4 mb-4 shadow-lg">
          <Wheat size={48} color="#1B5E20" />
        </div>

        {/* App Name */}
        <h1 className="text-white text-4xl font-bold tracking-wide">
          FaslBook
        </h1>

        {/* Tagline English */}
        <p className="text-green-200 text-sm mt-1">
          Farm Operating System
        </p>

        {/* Welcome Urdu */}
        <p className="text-green-100 text-xl mt-3 font-semibold">
          خوش آمدید
        </p>

        {/* Subtitle */}
        <p className="text-green-200 text-xs mt-1 text-center px-8">
          Manage your farm, finances & team all in one place
        </p>
      </div>

      {/* White Bottom Section */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 px-6 pt-8 pb-10">

        {/* Redirect Checking Spinner — shown instead of buttons */}
        {redirectChecking ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="animate-spin" size={36} color="#1B5E20" />
            <p className="text-gray-400 text-sm">Signing you in…</p>
          </div>
        ) : (
          <>
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="flex justify-center mb-4">
            <Loader2
              className="animate-spin"
              size={28}
              color="#1B5E20"
            />
          </div>
        )}

        {/* Login Buttons */}
        <div className="flex flex-col gap-3">

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="flex items-center gap-3 w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm active:scale-95 transition-transform"
          >
            <div className="bg-red-50 rounded-full p-2">
              <Chrome size={22} color="#EA4335" />
            </div>
            <span className="text-gray-800 font-semibold text-base">
              Continue with Google
            </span>
          </button>

          {/* Facebook */}
          <button
            onClick={handleFacebook}
            disabled={loading}
            className="flex items-center gap-3 w-full bg-blue-600 rounded-2xl px-5 py-4 shadow-sm active:scale-95 transition-transform"
          >
            <div className="bg-blue-500 rounded-full p-2">
              <Facebook size={22} color="white" />
            </div>
            <span className="text-white font-semibold text-base">
              Continue with Facebook
            </span>
          </button>

          {/* Phone OTP — disabled */}
          <button
            disabled
            className="flex items-center gap-3 w-full border-2 border-gray-200 rounded-2xl px-5 py-4 opacity-50 cursor-not-allowed"
          >
            <div className="rounded-full p-2 bg-gray-100">
              <Phone size={22} color="#9CA3AF" />
            </div>
            <div className="flex flex-col items-start">
              <span className="font-semibold text-base text-gray-400">
                Continue with Phone (OTP)
              </span>
              <span className="text-xs text-gray-400">Not available right now</span>
            </div>
          </button>

          {/* Email */}
          <button
            onClick={handleEmail}
            disabled={loading}
            className="flex items-center gap-3 w-full border-2 rounded-2xl px-5 py-4 active:scale-95 transition-transform"
            style={{ borderColor: "#1B5E20" }}
          >
            <div
              className="rounded-full p-2"
              style={{ backgroundColor: "#E8F5E9" }}
            >
              <Mail size={22} color="#1B5E20" />
            </div>
            <span
              className="font-semibold text-base"
              style={{ color: "#1B5E20" }}
            >
              Continue with Email
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-xs">OR</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Create Farm */}
        <div className="text-center">
          <p className="text-gray-500 text-sm">
            New to FaslBook?{" "}
            <button
              onClick={() => router.push("/register")}
              className="font-bold"
              style={{ color: "#1B5E20" }}
            >
              Create Farm
            </button>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-300 text-xs mt-8">
          FaslBook V2 • Farm Operating System
        </p>
          </>
        )}
      </div>
    </div>
  );
}
