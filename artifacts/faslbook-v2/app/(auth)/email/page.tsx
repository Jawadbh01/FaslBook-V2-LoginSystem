"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import {
  Mail, Lock, ArrowLeft, Loader2,
  Eye, EyeOff, Wheat, CheckCircle, X,
} from "lucide-react";

type Screen = "login" | "forgot" | "reset-sent";

export default function EmailLoginPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("login");

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [wrongPassword, setWrongPassword] = useState(false);

  // Forgot password state
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setWrongPassword(false);
      await signInWithEmailAndPassword(auth, email, password);
      // AuthProvider onAuthStateChanged handles redirect automatically
    } catch (err: any) {
      console.error("Login error:", err.code, err.message);
      const code = err.code ?? "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("Incorrect password. Try again or reset your password below.");
        setWrongPassword(true);
      } else if (code === "auth/user-not-found") {
        setError("No account found with this email. Please register first.");
      } else if (code === "auth/invalid-email") {
        setError("Invalid email address.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many failed attempts. Account temporarily locked. Reset your password or try again later.");
        setWrongPassword(true);
      } else if (code === "auth/user-disabled") {
        setError("This account has been disabled.");
      } else if (code === "auth/operation-not-allowed") {
        setError("Email login is not enabled in Firebase. Enable it in Firebase Console → Authentication → Sign-in method.");
      } else if (code === "auth/network-request-failed") {
        setError("Network error. Check your internet connection.");
      } else {
        setError(`Login failed (${code || err.message}). Please try again.`);
      }
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      setResetError("Please enter your email address");
      return;
    }
    try {
      setResetLoading(true);
      setResetError("");
      await sendPasswordResetEmail(auth, resetEmail);
      setScreen("reset-sent");
    } catch (err: any) {
      const code = err.code ?? "";
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
        setResetError("No account found with this email.");
      } else if (code === "auth/invalid-email") {
        setResetError("Invalid email address.");
      } else {
        setResetError(`Failed to send reset email (${code}). Please try again.`);
      }
      setResetLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  // ─── Password Reset Sent Screen ─────────────────────────────────────
  if (screen === "reset-sent") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg"
          style={{ backgroundColor: "#E8F5E9" }}
        >
          <CheckCircle size={42} color="#1B5E20" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-3">Email Sent!</h1>
        <p className="text-gray-500 text-sm mb-2">
          A password reset link was sent to:
        </p>
        <p className="text-green-800 font-semibold mb-8">{resetEmail}</p>
        <p className="text-gray-400 text-xs mb-8">
          Check your inbox (and spam folder). Click the link in the email to set a new password, then come back and login.
        </p>
        <button
          onClick={() => { setScreen("login"); setEmail(resetEmail); }}
          className="w-full py-4 rounded-2xl text-white font-bold text-base"
          style={{ backgroundColor: "#1B5E20" }}
        >
          Back to Login
        </button>
      </div>
    );
  }

  // ─── Forgot Password Screen ──────────────────────────────────────────
  if (screen === "forgot") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div
          className="flex items-center px-4 pt-12 pb-6"
          style={{ backgroundColor: "#1B5E20" }}
        >
          <button onClick={() => setScreen("login")} className="text-white mr-3">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <Wheat size={20} color="white" />
            <div>
              <h1 className="text-white text-xl font-bold">Reset Password</h1>
              <p className="text-green-200 text-xs">We'll send you a reset link</p>
            </div>
          </div>
        </div>

        <div className="flex-1 px-6 pt-8 pb-10">
          <p className="text-gray-500 text-sm mb-6">
            Enter the email you used to register. We'll send a password reset link immediately.
          </p>

          {resetError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-6">
              {resetError}
            </div>
          )}

          <div className="mb-8">
            <label className="text-gray-600 text-sm font-medium mb-2 block">
              Email Address
            </label>
            <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
              <Mail size={20} color="#9E9E9E" className="mr-3 shrink-0" />
              <input
                type="email"
                placeholder="Enter your registered email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
                className="flex-1 outline-none text-gray-800 text-base bg-transparent"
                autoFocus
              />
            </div>
          </div>

          <button
            onClick={handleForgotPassword}
            disabled={resetLoading}
            className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: "#1B5E20" }}
          >
            {resetLoading
              ? <Loader2 size={22} className="animate-spin" />
              : "Send Reset Link"
            }
          </button>
        </div>
      </div>
    );
  }

  // ─── Login Screen ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div
        className="flex items-center px-4 pt-12 pb-6"
        style={{ backgroundColor: "#1B5E20" }}
      >
        <button onClick={() => router.back()} className="text-white mr-3">
          <ArrowLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          <Wheat size={20} color="white" />
          <div>
            <h1 className="text-white text-xl font-bold">Login with Email</h1>
            <p className="text-green-200 text-xs">Welcome back!</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pt-8 pb-10">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4 flex items-start gap-2">
            <X size={16} className="shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              {wrongPassword && (
                <button
                  onClick={() => {
                    setResetEmail(email);
                    setScreen("forgot");
                  }}
                  className="mt-2 text-red-700 underline font-semibold text-xs"
                >
                  → Reset my password
                </button>
              )}
            </div>
          </div>
        )}

        {/* Email */}
        <div className="mb-5">
          <label className="text-gray-600 text-sm font-medium mb-2 block">
            Email Address
          </label>
          <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
            <Mail size={20} color="#9E9E9E" className="mr-3 shrink-0" />
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 outline-none text-gray-800 text-base bg-transparent"
              autoComplete="email"
            />
          </div>
        </div>

        {/* Password */}
        <div className="mb-3">
          <label className="text-gray-600 text-sm font-medium mb-2 block">
            Password
          </label>
          <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
            <Lock size={20} color="#9E9E9E" className="mr-3 shrink-0" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 outline-none text-gray-800 text-base bg-transparent"
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="ml-2">
              {showPassword ? <EyeOff size={20} color="#9E9E9E" /> : <Eye size={20} color="#9E9E9E" />}
            </button>
          </div>
        </div>

        <div className="text-right mb-8">
          <button
            onClick={() => { setResetEmail(email); setScreen("forgot"); }}
            style={{ color: "#1B5E20" }}
            className="text-sm font-semibold"
          >
            Forgot Password?
          </button>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ backgroundColor: "#1B5E20" }}
        >
          {loading ? <Loader2 size={22} className="animate-spin" /> : "Login"}
        </button>

        <div className="text-center mt-6">
          <p className="text-gray-500 text-sm">
            No account?{" "}
            <button
              onClick={() => router.push("/register")}
              className="font-bold"
              style={{ color: "#1B5E20" }}
            >
              Create Account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
