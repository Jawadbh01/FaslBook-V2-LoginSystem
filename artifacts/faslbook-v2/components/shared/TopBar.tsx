"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronLeft } from "lucide-react";

const MAIN_NAV = ["/ledger", "/inventory", "/dealers", "/workers"];

const PAGE_TITLES: Record<string, string> = {
  "/ledger":       "Khata",
  "/inventory":    "Godown",
  "/dealers":      "Dealers",
  "/workers":      "Team",
  "/expenses":     "Expenses",
  "/income":       "Income",
  "/loans":        "Loans",
  "/parcels":      "Parcels",
  "/crops":        "Crops",
  "/farmers":      "Farmers",
  "/reports":      "Reports",
  "/approvals":    "Approvals",
  "/notifications":"Notifications",
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();

  // Overview has its own full header — don't render TopBar there
  if (pathname === "/overview") return null;

  const isMainNav = MAIN_NAV.includes(pathname);
  const title = PAGE_TITLES[pathname] ?? "FaslBook";

  if (isMainNav) {
    return (
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between h-14 px-4">
          <span className="font-bold text-lg text-gray-800">
            {title || "FaslBook"}
          </span>
          <button
            aria-label="Notifications"
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <Bell size={22} color="#1B5E20" />
          </button>
        </div>
      </header>
    );
  }

  return (
    <header
      className="sticky top-0 z-40 text-white"
      style={{ backgroundColor: "#1B5E20" }}
    >
      <div className="flex items-center h-14 px-2 gap-2">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-white/10 transition-colors flex items-center gap-1"
          aria-label="Go back"
        >
          <ChevronLeft size={24} color="white" />
        </button>
        <span className="font-bold text-lg text-white flex-1">
          {title}
        </span>
      </div>
    </header>
  );
}
