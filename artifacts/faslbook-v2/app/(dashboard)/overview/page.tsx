"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where,
  onSnapshot, orderBy, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";
import {
  TrendingUp, TrendingDown, Wallet,
  Package, Plus, ArrowUpRight,
  ArrowDownRight, Wheat, Clock,
  Users, LayoutGrid, Bell,
} from "lucide-react";
import Link from "next/link";

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) =>
  "Rs. " + n.toLocaleString("en-PK");

const timeAgo = (ts: any) => {
  if (!ts?.toDate) return "";
  const diff = Date.now() - ts.toDate().getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default function OverviewPage() {
  const { organization, role } = useAuthStore();
  const orgId = organization?.id;

  // ── State ──────────────────────────────────────────────────
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [pendingLoans, setPendingLoans] = useState(0);
  const [dealerDues, setDealerDues] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    const unsubs: (() => void)[] = [];

    // Income
    unsubs.push(onSnapshot(
      query(collection(db, "income"), where("organizationId", "==", orgId)),
      (snap) => {
        const total = snap.docs.reduce(
          (sum, d) => sum + (d.data().amount || 0), 0
        );
        setIncome(total);
      }
    ));

    // Expenses
    unsubs.push(onSnapshot(
      query(collection(db, "expenses"), where("organizationId", "==", orgId)),
      (snap) => {
        const total = snap.docs.reduce(
          (sum, d) => sum + (d.data().amount || 0), 0
        );
        setExpense(total);
      }
    ));

    // Loans
    unsubs.push(onSnapshot(
      query(collection(db, "loans"), where("organizationId", "==", orgId)),
      (snap) => {
        const total = snap.docs.reduce(
          (sum, d) => sum + ((d.data().amount || 0) - (d.data().paidAmount || 0)),
          0
        );
        setPendingLoans(total);
      }
    ));

    // Dealer dues
    unsubs.push(onSnapshot(
      query(collection(db, "dealerTransactions"), where("organizationId", "==", orgId)),
      (snap) => {
        const total = snap.docs.reduce(
          (sum, d) => sum + (d.data().payable || 0), 0
        );
        setDealerDues(total);
      }
    ));

    // Inventory value
    unsubs.push(onSnapshot(
      query(collection(db, "inventoryItems"), where("organizationId", "==", orgId)),
      (snap) => {
        const total = snap.docs.reduce(
          (sum, d) => sum + ((d.data().currentStock || 0) * (d.data().pricePerUnit || 0)),
          0
        );
        setInventoryValue(total);
        setLoading(false);
      }
    ));

    // Recent activity
    unsubs.push(onSnapshot(
      query(
        collection(db, "activityLogs"),
        where("organizationId", "==", orgId),
        orderBy("createdAt", "desc"),
        limit(8)
      ),
      (snap) => {
        setRecentActivity(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
      }
    ));

    // Pending join requests (landlord only)
    if (role === "landlord") {
      unsubs.push(onSnapshot(
        query(
          collection(db, "joinRequests"),
          where("organizationId", "==", orgId),
          where("status", "==", "pending")
        ),
        (snap) => setPendingRequests(snap.size)
      ));
    }

    return () => unsubs.forEach((u) => u());
  }, [orgId, role]);

  const profit = income - expense;

  // ── Summary cards ─────────────────────────────────────────
  const cards = [
    {
      label: "Income",
      urdu: "آمدن",
      value: fmt(income),
      icon: TrendingUp,
      color: "#1B5E20",
      bg: "#E8F5E9",
      trend: "+",
    },
    {
      label: "Expense",
      urdu: "خرچ",
      value: fmt(expense),
      icon: TrendingDown,
      color: "#C62828",
      bg: "#FFEBEE",
      trend: "-",
    },
    {
      label: "Profit",
      urdu: "منافع",
      value: fmt(profit),
      icon: Wallet,
      color: profit >= 0 ? "#1565C0" : "#C62828",
      bg: profit >= 0 ? "#E3F2FD" : "#FFEBEE",
      trend: profit >= 0 ? "+" : "-",
    },
    {
      label: "Inventory",
      urdu: "گودام",
      value: fmt(inventoryValue),
      icon: Package,
      color: "#E65100",
      bg: "#FFF3E0",
      trend: "",
    },
  ];

  // ── Quick actions ─────────────────────────────────────────
  const actions = [
    {
      label: "Add Expense",
      urdu: "خرچ",
      icon: ArrowDownRight,
      color: "#C62828",
      bg: "#FFEBEE",
      href: "/expenses",
    },
    {
      label: "Add Income",
      urdu: "آمدن",
      icon: ArrowUpRight,
      color: "#1B5E20",
      bg: "#E8F5E9",
      href: "/income",
    },
    {
      label: "Stock Transfer",
      urdu: "اسٹاک",
      icon: Package,
      color: "#E65100",
      bg: "#FFF3E0",
      href: "/inventory",
    },
    {
      label: "Attendance",
      urdu: "حاضری",
      icon: Clock,
      color: "#1565C0",
      bg: "#E3F2FD",
      href: "/workers",
    },
    {
      label: "Team",
      urdu: "ٹیم",
      icon: Users,
      color: "#6A1B9A",
      bg: "#F3E5F5",
      href: "/workers",
    },
    {
      label: "Reports",
      urdu: "رپورٹ",
      icon: LayoutGrid,
      color: "#00695C",
      bg: "#E0F2F1",
      href: "/reports",
    },
  ];

  // ── Activity icon map ─────────────────────────────────────
  const activityIcon = (action: string) => {
    if (action?.includes("EXPENSE")) return { icon: ArrowDownRight, color: "#C62828", bg: "#FFEBEE" };
    if (action?.includes("INCOME")) return { icon: ArrowUpRight, color: "#1B5E20", bg: "#E8F5E9" };
    if (action?.includes("INVENTORY")) return { icon: Package, color: "#E65100", bg: "#FFF3E0" };
    if (action?.includes("ATTENDANCE")) return { icon: Clock, color: "#1565C0", bg: "#E3F2FD" };
    return { icon: Wheat, color: "#1B5E20", bg: "#E8F5E9" };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div
          className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100"
          style={{ borderTopColor: "#1B5E20" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Top Bar */}
      <div
        className="px-4 pt-12 pb-5"
        style={{ backgroundColor: "#1B5E20" }}
      >
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-green-200 text-xs">
              {organization?.name}
            </p>
            <h1 className="text-white text-2xl font-bold">
              Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Pending requests badge */}
            {pendingRequests > 0 && (
              <Link href="/approvals">
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                  >
                    <Users size={20} color="white" />
                  </div>
                  <div
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: "#C62828" }}
                  >
                    {pendingRequests}
                  </div>
                </div>
              </Link>
            )}
            <Link href="/notifications">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              >
                <Bell size={20} color="white" />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-4 -mt-1">
        <div
          className="rounded-2xl p-4 shadow-lg -mt-2"
          style={{ backgroundColor: "white" }}
        >
          <div className="grid grid-cols-2 gap-3">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-xl p-3"
                  style={{ backgroundColor: card.bg }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-gray-500 text-xs">
                        {card.label}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: card.color }}
                      >
                        {card.urdu}
                      </p>
                    </div>
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: card.color + "20" }}
                    >
                      <Icon size={16} color={card.color} />
                    </div>
                  </div>
                  <p
                    className="font-bold text-sm"
                    style={{ color: card.color }}
                  >
                    {card.value}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Loans + Dealer row */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="rounded-xl p-3 bg-gray-50">
              <p className="text-gray-500 text-xs mb-1">
                Pending Loans
              </p>
              <p className="font-bold text-sm text-gray-800">
                {fmt(pendingLoans)}
              </p>
            </div>
            <div className="rounded-xl p-3 bg-gray-50">
              <p className="text-gray-500 text-xs mb-1">
                Dealer Dues
              </p>
              <p className="font-bold text-sm text-gray-800">
                {fmt(dealerDues)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-800 text-base">
            Quick Actions
          </h2>
          <p className="text-xs text-gray-400">فوری اقدام</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.label} href={action.href}>
                <div className="bg-white rounded-2xl p-3 flex flex-col items-center gap-2 shadow-sm active:scale-95 transition-transform">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: action.bg }}
                  >
                    <Icon size={22} color={action.color} />
                  </div>
                  <p className="text-gray-700 text-xs font-semibold text-center leading-tight">
                    {action.label}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: action.color }}
                  >
                    {action.urdu}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-800 text-base">
            Recent Activity
          </h2>
          <p className="text-xs text-gray-400">حالیہ سرگرمی</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: "#E8F5E9" }}
              >
                <Wheat size={28} color="#1B5E20" />
              </div>
              <p className="text-gray-500 text-sm font-medium">
                No activity yet
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Start by adding expenses or income
              </p>
            </div>
          ) : (
            recentActivity.map((item, i) => {
              const { icon: AIcon, color, bg } =
                activityIcon(item.action);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom:
                      i < recentActivity.length - 1
                        ? "1px solid #F5F5F5"
                        : "none",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: bg }}
                  >
                    <AIcon size={18} color={color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 text-sm font-medium truncate">
                      {item.description || item.action}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {item.userName || "System"}
                    </p>
                  </div>
                  <p className="text-gray-400 text-xs shrink-0">
                    {timeAgo(item.createdAt)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Farm ID card */}
      {role === "landlord" && (
        <div className="px-4 mt-5">
          <div
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{ backgroundColor: "#E8F5E9" }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#1B5E20" }}
            >
              <Wheat size={24} color="white" />
            </div>
            <div className="flex-1">
              <p className="text-green-700 text-xs font-medium mb-1">
                Your Farm ID — Share with team
              </p>
              <p
                className="font-bold text-xl tracking-widest"
                style={{ color: "#1B5E20" }}
              >
                {organization?.farmId}
              </p>
            </div>
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  organization?.farmId || ""
                )
              }
              className="text-xs font-bold px-3 py-2 rounded-xl text-white"
              style={{ backgroundColor: "#1B5E20" }}
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
