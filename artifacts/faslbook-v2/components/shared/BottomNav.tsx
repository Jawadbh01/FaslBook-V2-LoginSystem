"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  Sprout,
  Package,
  Users,
  MoreHorizontal,
} from "lucide-react";

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/parcels", label: "Parcels", icon: MapPin },
  { href: "/crops", label: "Crops", icon: Sprout },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/farmers", label: "Farmers", icon: Users },
  { href: "/workers", label: "More", icon: MoreHorizontal },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-2 py-1 text-xs transition-colors ${
                isActive
                  ? "text-primary-900"
                  : "text-gray-500 hover:text-primary-700"
              }`}
            >
              <Icon
                size={22}
                className={isActive ? "text-primary-900" : "text-gray-400"}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
