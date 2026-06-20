"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronLeft } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLangStore } from "@/store/langStore";

const MAIN_NAV = ["/ledger", "/inventory", "/dealers", "/workers"];

const PAGE_TITLE_KEYS: Record<string, string> = {
  "/ledger":        "khata",
  "/inventory":     "godown",
  "/dealers":       "dealer",
  "/workers":       "team",
  "/expenses":      "expense",
  "/income":        "income",
  "/loans":         "pending_loans",
  "/parcels":       "my_land",
  "/crops":         "crop",
  "/farmers":       "farmer",
  "/reports":       "reports",
  "/approvals":     "approvals",
  "/notifications": "notifications",
};

const HIDE_TOPBAR = new Set(["/overview", "/"]);

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLangStore();

  if (HIDE_TOPBAR.has(pathname ?? "") || (pathname ?? "").startsWith("/overview")) return null;

  const isMainNav = MAIN_NAV.includes(pathname);
  const titleKey = PAGE_TITLE_KEYS[pathname] ?? "";
  const title = titleKey ? t(titleKey) : "FaslBook";

  if (isMainNav) {
    return (
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between h-14 px-4">
          <span className="font-bold text-lg text-gray-800">{title}</span>
          <div className="flex items-center gap-2">
            <button aria-label="Notifications" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
              <Bell size={22} color="#1B5E20" />
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 text-white" style={{ backgroundColor: "#1B5E20" }}>
      <div className="flex items-center h-14 px-2 gap-2">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-white/10 transition-colors flex items-center gap-1"
          aria-label="Go back"
        >
          <ChevronLeft size={24} color="white" />
        </button>
        <span className="font-bold text-lg text-white flex-1">{title}</span>
        <LanguageSwitcher compact />
      </div>
    </header>
  );
}
