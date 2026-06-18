"use client";

import { Bell, Menu } from "lucide-react";

export default function TopBar() {
  return (
    <header className="sticky top-0 z-40 bg-primary-900 text-white shadow-md">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          <button
            aria-label="Open menu"
            className="p-1 rounded-md hover:bg-primary-800 transition-colors"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold text-lg tracking-tight">Faslbook</span>
        </div>
        <button
          aria-label="Notifications"
          className="p-1 rounded-md hover:bg-primary-800 transition-colors relative"
        >
          <Bell size={22} />
        </button>
      </div>
    </header>
  );
}
