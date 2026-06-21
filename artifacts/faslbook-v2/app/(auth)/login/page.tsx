"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  FacebookAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { Wheat, Mail, Phone, Chrome, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          // AuthProvider will handle redirect automatically
          // via onAuthStateChanged
        }
      })
      .catch((err) => {
        console.error("Redirect error:", err);
        setError("Login failed. Please try again.");
      })
      .finally(() => setChecking(false));
  }, []);

  const handleGoogle = async () => {
    try {
      setLoading(true);
      setError("");
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch {
      setError("Google login failed. Please try again.");
      setLoading(false);
    }
  };

  const handleFacebook = async () => {
    try {
      setLoading(true);
      setError("");
      const provider = new FacebookAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch {
      setError("Facebook login failed. Please try again.");
      setLoading(false);
    }
  };

  if (checking || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <div
          className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100"
          style={{ borderTopColor: "#1B5E20" }}
        />
        <p className="text-gray-400 text-sm">
          {loading ? "Redirecting..." : "Loading..."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Green Top */}
      <div
        className="flex flex-col items-center justify-center pt-16 pb-10 px-6"
        style={{ backgroundColor: "#1B5E20" }}
      >
        <div className="bg-white rounded-full p-4 mb-4 shadow-lg">
          <Wheat size={48} color="#1B5E20" />
        </div>
        <h1 className="text-white text-4xl font-bold tracking-wide">
          FaslBook
        </h1>
        <p className="text-green-200 text-sm mt-1">Farm Operating System</p>
        <p className="text-green-100 text-xl mt-3 font-semibold">
          خوش آمدید
        </p>
        <p className="text-green-200 text-xs mt-1 text-center px-8">
          Manage your farm, finances & team all in one place
        </p>
      </div>

      {/* White Bottom */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 px-6 pt-8 pb-10">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {/* Google */}
          <button
            onClick={handleGoogle}
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
            className="flex items-center gap-3 w-full bg-blue-600 rounded-2xl px-5 py-4 shadow-sm active:scale-95 transition-transform"
          >
            <div className="bg-blue-500 rounded-full p-2">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
              </svg>
            </div>
            <span className="text-white font-semibold text-base">
              Continue with Facebook
            </span>
          </button>

          {/* Phone — disabled */}
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
              <span className="text-xs text-gray-400">
                Not available right now
              </span>
            </div>
          </button>

          {/* Email */}
          <button
            onClick={() => router.push("/email")}
            className="flex items-center gap-3 w-full border-2 rounded-2xl px-5 py-4 active:scale-95 transition-transform"
            style={{ borderColor: "#1B5E20" }}
          >
            <div className="rounded-full p-2" style={{ backgroundColor: "#E8F5E9" }}>
              <Mail size={22} color="#1B5E20" />
            </div>
            <span className="font-semibold text-base" style={{ color: "#1B5E20" }}>
              Continue with Email
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-xs">OR</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="text-center">
          <p className="text-gray-500 text-sm">
            New to FaslBook?{" "}
            <button
              onClick={() => router.push("/role-select")}
              className="font-bold"
              style={{ color: "#1B5E20" }}
            >
              Create Account
            </button>
          </p>
        </div>

        <p className="text-center text-gray-300 text-xs mt-8">
          FaslBook V2 • Farm Operating System
        </p>
      </div>
    </div>
  );
}
