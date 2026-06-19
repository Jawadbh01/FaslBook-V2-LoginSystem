import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "*.sisko.replit.dev",
    "*.replit.dev",
    "*.repl.co",
  ],
};

export default nextConfig;
