"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";
import {
  ArrowLeft, Plus, TrendingUp, TrendingDown,
  ChevronLeft, ChevronRight, X, Loader2, CheckCircle,
  Sprout, FlaskConical, Zap, Fuel, Wrench, Users,
  Wheat, Home, Beef, MoreHorizontal, Upload,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────
interface LedgerEntry {
  id: string;
  type: "credit" | "debit";
  category: string;
  amount: number;
  date: string;
  parcelId: string;
  parcelName: string;
  dealerId?: string;
  dealerName?: string;
  notes: string;
  organizationId: string;
  createdAt: any;
}
interface Parcel  { id: string; name: string; }
interface Dealer  { id: string; name: string; }

// ── Config ─────────────────────────────────────────────────────
const incomeTypes: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  cropSale:  { label: "Crop Sale",  color: "#1B5E20", bg: "#E8F5E9", emoji: "🌾" },
  rent:      { label: "Rent",       color: "#1565C0", bg: "#E3F2FD", emoji: "🏠" },
  livestock: { label: "Livestock",  color: "#00695C", bg: "#E0F2F1", emoji: "🐄" },
  other:     { label: "Other",      color: "#757575", bg: "#F5F5F5", emoji: "💰" },
};

const expenseCategories: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  fertilizer: { label: "Fertilizer",  color: "#1565C0", bg: "#E3F2FD", emoji: "🧪" },
  seed:        { label: "Seed",        color: "#1B5E20", bg: "#E8F5E9", emoji: "🌱" },
  pesticide:   { label: "Pesticide",   color: "#B71C1C", bg: "#FFEBEE", emoji: "⚡" },
  fuel:        { label: "Fuel",        color: "#E65100", bg: "#FFF3E0", emoji: "⛽" },
  labour:      { label: "Labour",      color: "#4527A0", bg: "#EDE7F6", emoji: "👷" },
  machinery:   { label: "Machinery",   color: "#00695C", bg: "#E0F2F1", emoji: "🔧" },
  other:       { label: "Other",       color: "#757575", bg: "#F5F5F5", emoji: "📋" },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type View = "list" | "addIncome" | "addExpense";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function fmtPKR(n: number) {
  return `Rs. ${n.toLocaleString("en-PK")}`;
}

function fmtDate(str: string) {
  if (!str) return "";
  const d = new Date(str + "T00:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function LedgerPage() {
  const { organization, role } = useAuthStore();
  const orgId   = organization?.id;
  const canEdit = role === "landlord" || role === "manager";

  // ── Data ───────────────────────────────────────────────────
  const [entries, setEntries]  = useState<LedgerEntry[]>([]);
  const [parcels, setParcels]  = useState<Parcel[]>([]);
  const [dealers, setDealers]  = useState<Dealer[]>([]);
  const [loading, setLoading]  = useState(true);

  // ── UI ─────────────────────────────────────────────────────
  const now   = new Date();
  const [viewMonth, setViewMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [view, setView]           = useState<View>("list");
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState(false);
  const [successMsg, setSuccessMsg] = useState({ title: "", sub: "" });
  const [formError, setFormError] = useState("");

  // ── Forms ──────────────────────────────────────────────────
  const [incomeForm, setIncomeForm] = useState({
    type: "cropSale", amount: "", date: todayStr(), parcelId: "", notes: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    category: "fertilizer", amount: "", date: todayStr(),
    parcelId: "", dealerId: "", notes: "",
  });

  // ── Listeners ──────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(
      query(collection(db, "ledgerEntries"), where("organizationId", "==", orgId)),
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LedgerEntry)));
        setLoading(false);
      }
    ));
    unsubs.push(onSnapshot(
      query(collection(db, "parcels"), where("organizationId", "==", orgId)),
      (snap) => setParcels(snap.docs.map((d) => ({ id: d.id, name: (d.data() as any).name })))
    ));
    unsubs.push(onSnapshot(
      query(collection(db, "dealers"), where("organizationId", "==", orgId)),
      (snap) => setDealers(snap.docs.map((d) => ({ id: d.id, name: (d.data() as any).name })))
    ));

    return () => unsubs.forEach((u) => u());
  }, [orgId]);

  // ── Derived stats ──────────────────────────────────────────
  const monthEntries = entries.filter((e) => {
    if (!e.date) return false;
    const d = new Date(e.date + "T00:00:00");
    return d.getFullYear() === viewMonth.year && d.getMonth() === viewMonth.month;
  }).sort((a, b) => (b.date > a.date ? 1 : -1));

  const totalCredit = monthEntries.filter((e) => e.type === "credit").reduce((s, e) => s + e.amount, 0);
  const totalDebit  = monthEntries.filter((e) => e.type === "debit").reduce((s, e) => s + e.amount, 0);
  const netBalance  = totalCredit - totalDebit;

  const prevMonth = () => setViewMonth((m) => {
    if (m.month === 0) return { year: m.year - 1, month: 11 };
    return { year: m.year, month: m.month - 1 };
  });
  const nextMonth = () => setViewMonth((m) => {
    if (m.month === 11) return { year: m.year + 1, month: 0 };
    return { year: m.year, month: m.month + 1 };
  });

  const resetForms = () => {
    setIncomeForm({ type: "cropSale", amount: "", date: todayStr(), parcelId: "", notes: "" });
    setExpenseForm({ category: "fertilizer", amount: "", date: todayStr(), parcelId: "", dealerId: "", notes: "" });
    setFormError(""); setSuccess(false);
  };
  const goBack = () => { setView("list"); resetForms(); };

  // ── Add Income ─────────────────────────────────────────────
  const handleAddIncome = async () => {
    if (!incomeForm.amount || Number(incomeForm.amount) <= 0) { setFormError("Enter a valid amount"); return; }
    if (!incomeForm.date) { setFormError("Select a date"); return; }
    const parcel = parcels.find((p) => p.id === incomeForm.parcelId);
    try {
      setSaving(true); setFormError("");
      await addDoc(collection(db, "ledgerEntries"), {
        organizationId: orgId,
        type: "credit",
        category: incomeForm.type,
        categoryLabel: incomeTypes[incomeForm.type]?.label || incomeForm.type,
        amount: Number(incomeForm.amount),
        date: incomeForm.date,
        parcelId: incomeForm.parcelId || "",
        parcelName: parcel?.name || "",
        notes: incomeForm.notes,
        createdBy: auth.currentUser?.uid || "",
        createdAt: serverTimestamp(),
        syncStatus: "synced",
      });
      await addDoc(collection(db, "activityLogs"), {
        organizationId: orgId,
        userId: auth.currentUser?.uid || "",
        userName: auth.currentUser?.displayName || "",
        action: "INCOME_ADDED",
        description: `${incomeTypes[incomeForm.type]?.label} income: ${fmtPKR(Number(incomeForm.amount))}`,
        createdAt: serverTimestamp(),
        syncStatus: "synced",
      });
      setSuccessMsg({ title: "Income Saved! ✅", sub: `+${fmtPKR(Number(incomeForm.amount))} (${incomeTypes[incomeForm.type]?.label})` });
      setSuccess(true);
    } catch { setFormError("Failed to save. Try again."); }
    finally { setSaving(false); }
  };

  // ── Add Expense ────────────────────────────────────────────
  const handleAddExpense = async () => {
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) { setFormError("Enter a valid amount"); return; }
    if (!expenseForm.date) { setFormError("Select a date"); return; }
    const parcel = parcels.find((p) => p.id === expenseForm.parcelId);
    const dealer = dealers.find((d) => d.id === expenseForm.dealerId);
    try {
      setSaving(true); setFormError("");
      await addDoc(collection(db, "ledgerEntries"), {
        organizationId: orgId,
        type: "debit",
        category: expenseForm.category,
        categoryLabel: expenseCategories[expenseForm.category]?.label || expenseForm.category,
        amount: Number(expenseForm.amount),
        date: expenseForm.date,
        parcelId: expenseForm.parcelId || "",
        parcelName: parcel?.name || "",
        dealerId: expenseForm.dealerId || "",
        dealerName: dealer?.name || "",
        notes: expenseForm.notes,
        createdBy: auth.currentUser?.uid || "",
        createdAt: serverTimestamp(),
        syncStatus: "synced",
      });
      await addDoc(collection(db, "activityLogs"), {
        organizationId: orgId,
        userId: auth.currentUser?.uid || "",
        userName: auth.currentUser?.displayName || "",
        action: "EXPENSE_ADDED",
        description: `${expenseCategories[expenseForm.category]?.label} expense: ${fmtPKR(Number(expenseForm.amount))}`,
        createdAt: serverTimestamp(),
        syncStatus: "synced",
      });
      setSuccessMsg({ title: "Expense Saved! ✅", sub: `−${fmtPKR(Number(expenseForm.amount))} (${expenseCategories[expenseForm.category]?.label})` });
      setSuccess(true);
    } catch { setFormError("Failed to save. Try again."); }
    finally { setSaving(false); }
  };

  // ══════════════════════════════════════════════════════════
  // SUCCESS
  // ══════════════════════════════════════════════════════════
  if (success) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg" style={{ backgroundColor: "#E8F5E9" }}>
        <CheckCircle size={52} color="#1B5E20" />
      </div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{successMsg.title}</h1>
      <p className="text-gray-500 text-sm mb-10">{successMsg.sub}</p>
      <button onClick={goBack}
        className="w-full py-4 rounded-2xl text-white font-bold text-base active:scale-95 transition-transform"
        style={{ backgroundColor: "#1B5E20" }}>
        Back to Khata
      </button>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // ADD INCOME FORM
  // ══════════════════════════════════════════════════════════
  if (view === "addIncome") return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center px-4 pt-12 pb-6" style={{ backgroundColor: "#1B5E20" }}>
        <button onClick={goBack} className="text-white mr-3"><ArrowLeft size={24} /></button>
        <h1 className="text-white text-xl font-bold">Add Income</h1>
      </div>

      <div className="flex-1 px-5 pt-6 pb-10 overflow-y-auto">
        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">{formError}</div>
        )}

        {/* Income Type */}
        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3 block">Income Type</label>
        <div className="grid grid-cols-4 gap-3 mb-5">
          {Object.entries(incomeTypes).map(([key, cfg]) => (
            <button key={key} onClick={() => setIncomeForm({ ...incomeForm, type: key })}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all"
              style={{
                borderColor: incomeForm.type === key ? cfg.color : "#E5E7EB",
                backgroundColor: incomeForm.type === key ? cfg.bg : "white",
              }}>
              <span className="text-2xl">{cfg.emoji}</span>
              <span className="text-xs font-semibold leading-tight text-center"
                style={{ color: incomeForm.type === key ? cfg.color : "#6B7280" }}>
                {cfg.label}
              </span>
            </button>
          ))}
        </div>

        {/* Amount */}
        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 block">Amount (Rs.)</label>
        <div className="border border-gray-200 rounded-2xl px-4 py-3.5 mb-4 focus-within:border-green-700 bg-white">
          <input type="number" placeholder="e.g. 45,000" value={incomeForm.amount}
            onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
            className="w-full outline-none text-gray-800 text-xl font-semibold bg-transparent" />
        </div>

        {/* Date */}
        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 block">Date</label>
        <div className="border border-gray-200 rounded-2xl px-4 py-3.5 mb-4 focus-within:border-green-700 bg-white flex items-center">
          <input type="date" value={incomeForm.date}
            onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })}
            className="flex-1 outline-none text-gray-800 text-base bg-transparent [&::-webkit-calendar-picker-indicator]:hidden" />
          <span className="text-gray-400 text-sm">
            {incomeForm.date ? new Date(incomeForm.date + "T00:00:00").toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : ""}
          </span>
        </div>

        {/* Select Parcel */}
        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 block">Select Parcel</label>
        <div className="border border-gray-200 rounded-2xl px-4 py-3.5 mb-4 bg-white">
          <select value={incomeForm.parcelId} onChange={(e) => setIncomeForm({ ...incomeForm, parcelId: e.target.value })}
            className="w-full outline-none text-gray-800 text-base bg-transparent">
            <option value="">— No parcel —</option>
            {parcels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Upload Proof */}
        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 block">Upload Proof</label>
        <div className="border border-gray-200 rounded-2xl px-4 py-4 mb-4 bg-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#E8F5E9" }}>
            <Upload size={20} color="#1B5E20" />
          </div>
          <span className="text-gray-400 text-sm">Tap to upload proof</span>
        </div>

        {/* Notes */}
        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 block">Notes (Optional)</label>
        <div className="border border-gray-200 rounded-2xl px-4 py-3 mb-8 focus-within:border-green-700 bg-white">
          <textarea placeholder="Enter notes" value={incomeForm.notes}
            onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })}
            rows={3} className="w-full outline-none text-gray-800 text-base bg-transparent resize-none" />
        </div>

        <button onClick={handleAddIncome} disabled={saving}
          className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
          style={{ backgroundColor: "#1B5E20" }}>
          {saving ? <Loader2 size={22} className="animate-spin" /> : "Save Income"}
        </button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // ADD EXPENSE FORM
  // ══════════════════════════════════════════════════════════
  if (view === "addExpense") return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center px-4 pt-12 pb-6" style={{ backgroundColor: "#1B5E20" }}>
        <button onClick={goBack} className="text-white mr-3"><ArrowLeft size={24} /></button>
        <h1 className="text-white text-xl font-bold">Add Expense</h1>
      </div>

      <div className="flex-1 px-5 pt-6 pb-10 overflow-y-auto">
        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">{formError}</div>
        )}

        {/* Category */}
        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 block">Category</label>
        <div className="border border-gray-200 rounded-2xl px-4 py-3.5 mb-5 bg-white flex items-center gap-3">
          <span className="text-2xl">{expenseCategories[expenseForm.category]?.emoji}</span>
          <select value={expenseForm.category}
            onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
            className="flex-1 outline-none text-gray-800 text-base font-medium bg-transparent">
            {Object.entries(expenseCategories).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 block">Amount (Rs.)</label>
        <div className="border border-gray-200 rounded-2xl px-4 py-3.5 mb-4 focus-within:border-green-700 bg-white">
          <input type="number" placeholder="e.g. 12,500" value={expenseForm.amount}
            onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            className="w-full outline-none text-gray-800 text-xl font-semibold bg-transparent" />
        </div>

        {/* Date */}
        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 block">Date</label>
        <div className="border border-gray-200 rounded-2xl px-4 py-3.5 mb-4 bg-white flex items-center">
          <input type="date" value={expenseForm.date}
            onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
            className="flex-1 outline-none text-gray-800 text-base bg-transparent [&::-webkit-calendar-picker-indicator]:hidden" />
          <span className="text-gray-400 text-sm">
            {expenseForm.date ? new Date(expenseForm.date + "T00:00:00").toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : ""}
          </span>
        </div>

        {/* Parcel */}
        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 block">Parcel</label>
        <div className="border border-gray-200 rounded-2xl px-4 py-3.5 mb-4 bg-white">
          <select value={expenseForm.parcelId} onChange={(e) => setExpenseForm({ ...expenseForm, parcelId: e.target.value })}
            className="w-full outline-none text-gray-800 text-base bg-transparent">
            <option value="">— No parcel —</option>
            {parcels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Vendor / Dealer */}
        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 block">Vendor</label>
        <div className="border border-gray-200 rounded-2xl px-4 py-3.5 mb-4 bg-white">
          <select value={expenseForm.dealerId} onChange={(e) => setExpenseForm({ ...expenseForm, dealerId: e.target.value })}
            className="w-full outline-none text-gray-800 text-base bg-transparent">
            <option value="">— No vendor —</option>
            {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {/* Upload Receipt */}
        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 block">Upload Receipt</label>
        <div className="border border-gray-200 rounded-2xl px-4 py-4 mb-4 bg-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#E8F5E9" }}>
            <Upload size={20} color="#1B5E20" />
          </div>
          <span className="text-gray-400 text-sm">Tap to upload receipt</span>
        </div>

        {/* Notes */}
        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 block">Notes (Optional)</label>
        <div className="border border-gray-200 rounded-2xl px-4 py-3 mb-8 focus-within:border-green-700 bg-white">
          <textarea placeholder="Enter notes" value={expenseForm.notes}
            onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
            rows={3} className="w-full outline-none text-gray-800 text-base bg-transparent resize-none" />
        </div>

        <button onClick={handleAddExpense} disabled={saving}
          className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
          style={{ backgroundColor: "#1B5E20" }}>
          {saving ? <Loader2 size={22} className="animate-spin" /> : "Save Expense"}
        </button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // MAIN LEDGER LIST
  // ══════════════════════════════════════════════════════════
  const monthLabel = `${MONTHS[viewMonth.month]} ${viewMonth.year}`;
  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const rangeLabel  = `01 ${MONTHS[viewMonth.month]} ${viewMonth.year}  –  ${daysInMonth} ${MONTHS[viewMonth.month]} ${viewMonth.year}`;

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#F5F5F5" }}>

      {/* ── Header ── */}
      <div className="px-4 pt-12 pb-5" style={{ backgroundColor: "#1B5E20" }}>
        <h1 className="text-white text-2xl font-bold">Khata</h1>
        <p className="text-green-200 text-xs mt-0.5">Farm Ledger</p>
      </div>

      <div className="px-4 pt-4">

        {/* ── Account Summary card ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Account Summary</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl p-3" style={{ backgroundColor: "#E8F5E9" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "#1B5E20" }}>Total Credit</p>
              <p className="text-lg font-bold" style={{ color: "#1B5E20" }}>{fmtPKR(totalCredit)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: "#FFEBEE" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "#B71C1C" }}>Total Debit</p>
              <p className="text-lg font-bold" style={{ color: "#B71C1C" }}>{fmtPKR(totalDebit)}</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3 text-center">
            <p className="text-gray-500 text-xs font-medium mb-0.5">Net Balance</p>
            <p className="text-3xl font-bold" style={{ color: netBalance >= 0 ? "#1B1B1B" : "#B71C1C" }}>
              {fmtPKR(Math.abs(netBalance))}
              {netBalance < 0 && <span className="text-base ml-1 text-red-600">(deficit)</span>}
            </p>
          </div>
        </div>

        {/* ── Month selector ── */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm mb-4 flex items-center justify-between">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg active:bg-gray-100">
            <ChevronLeft size={20} color="#6B7280" />
          </button>
          <div className="text-center">
            <p className="text-gray-700 text-sm font-semibold">{monthLabel}</p>
            <p className="text-gray-400 text-xs">{rangeLabel}</p>
          </div>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg active:bg-gray-100">
            <ChevronRight size={20} color="#6B7280" />
          </button>
        </div>

        {/* ── Transaction list ── */}
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100" style={{ borderTopColor: "#1B5E20" }} />
          </div>
        ) : monthEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="text-6xl mb-4">📒</div>
            <p className="text-gray-600 font-semibold mb-2">No entries for {monthLabel}</p>
            <p className="text-gray-400 text-sm mb-6">Add income or expense to see them here</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {monthEntries.map((entry, idx) => {
              const isCredit = entry.type === "credit";
              const cfg = isCredit
                ? incomeTypes[entry.category]
                : expenseCategories[entry.category];
              const emoji = cfg?.emoji || (isCredit ? "💰" : "📋");
              const label = entry.categoryLabel || cfg?.label || entry.category;

              return (
                <div key={entry.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${idx < monthEntries.length - 1 ? "border-b border-gray-50" : ""}`}>

                  {/* Date */}
                  <div className="w-10 shrink-0 text-center">
                    <p className="text-gray-400 text-xs leading-tight">
                      {fmtDate(entry.date).split(" ")[0]}
                    </p>
                    <p className="text-gray-400 text-xs leading-tight">
                      {fmtDate(entry.date).split(" ")[1]}
                    </p>
                  </div>

                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: isCredit ? "#E8F5E9" : "#FFEBEE" }}>
                    {isCredit
                      ? <TrendingUp size={18} color="#1B5E20" />
                      : <TrendingDown size={18} color="#B71C1C" />
                    }
                  </div>

                  {/* Title + label */}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 font-semibold text-sm truncate">
                      {emoji} {label}
                    </p>
                    <p className="text-xs" style={{ color: isCredit ? "#1B5E20" : "#B71C1C" }}>
                      {isCredit ? "Credit" : "Debit"}
                      {entry.parcelName ? ` • ${entry.parcelName}` : ""}
                    </p>
                    {entry.notes ? <p className="text-gray-400 text-xs truncate">{entry.notes}</p> : null}
                  </div>

                  {/* Amount */}
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-base" style={{ color: isCredit ? "#1B5E20" : "#B71C1C" }}>
                      {isCredit ? "+" : "−"}{fmtPKR(entry.amount)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── FABs ── */}
      {canEdit && (
        <div className="fixed bottom-24 right-4 flex flex-col gap-3 items-end">
          <button onClick={() => setView("addExpense")}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-white text-sm font-bold active:scale-95 transition-transform"
            style={{ backgroundColor: "#B71C1C" }}>
            <Plus size={18} />Expense
          </button>
          <button onClick={() => setView("addIncome")}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-white text-sm font-bold active:scale-95 transition-transform"
            style={{ backgroundColor: "#1B5E20" }}>
            <Plus size={18} />Income
          </button>
        </div>
      )}
    </div>
  );
}
