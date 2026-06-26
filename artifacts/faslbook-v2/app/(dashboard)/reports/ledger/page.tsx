"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";
import {
  ArrowLeft, TrendingUp, TrendingDown, Printer,
  FileText, FileSpreadsheet, MessageCircle,
} from "lucide-react";

const fmt = (n: number) => "Rs. " + n.toLocaleString("en-PK");

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(val: any) {
  if (!val) return "—";
  const d = val?.toDate ? val.toDate() : new Date(val);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const INCOME_LABELS: Record<string, string> = {
  cropSale: "Crop Sale", govtSubsidy: "Govt Subsidy", loanReceived: "Loan Received",
  rental: "Rental Income", livestock: "Livestock Sale", other: "Other Income",
};
const EXPENSE_LABELS: Record<string, string> = {
  seed: "Seeds", fertilizer: "Fertilizer", pesticide: "Pesticide",
  labor: "Labour", machinery: "Machinery", irrigation: "Irrigation",
  fuel: "Fuel", transport: "Transport", rent: "Land Rent",
  loan: "Loan Payment", maintenance: "Maintenance", other: "Other Expense",
};

interface Entry {
  id: string;
  type: "credit" | "debit";
  date: any;
  category: string;
  categoryLabel?: string;
  amount: number;
  description?: string;
}

const RANGES = [
  { val: "month", label: "This Month" },
  { val: "year",  label: "This Year"  },
  { val: "all",   label: "All Time"   },
];

function getStart(range: string): Date | null {
  const now = new Date();
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === "year")  return new Date(now.getFullYear(), 0, 1);
  return null;
}

export default function LedgerReportPage() {
  const router = useRouter();
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  const [range, setRange]       = useState("month");
  const [entries, setEntries]   = useState<Entry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => { if (orgId) loadData(); }, [orgId, range]);

  const loadData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const start = getStart(range);
      const [incSnap, expSnap] = await Promise.all([
        getDocs(query(collection(db, "income"),  where("organizationId", "==", orgId))),
        getDocs(query(collection(db, "ledgerEntries"), where("organizationId", "==", orgId))),
      ]);

      const all: Entry[] = [];

      incSnap.docs.forEach((d) => {
        const data = d.data();
        const date = data.date?.toDate ? data.date.toDate() : new Date(data.date || data.createdAt?.toDate?.());
        if (start && date < start) return;
        all.push({ id: d.id, type: "credit", date: data.date || data.createdAt, category: data.category || "other", categoryLabel: data.categoryLabel || INCOME_LABELS[data.category] || data.category, amount: Number(data.amount) || 0, description: data.description });
      });

      expSnap.docs.forEach((d) => {
        const data = d.data();
        const date = data.date?.toDate ? data.date.toDate() : new Date(data.date || data.createdAt?.toDate?.());
        if (start && date < start) return;
        all.push({ id: d.id, type: data.type === "credit" ? "credit" : "debit", date: data.date || data.createdAt, category: data.category || "other", categoryLabel: data.categoryLabel || (data.type === "credit" ? INCOME_LABELS[data.category] : EXPENSE_LABELS[data.category]) || data.category, amount: Number(data.amount) || 0, description: data.description });
      });

      all.sort((a, b) => {
        const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return db2.getTime() - da.getTime();
      });

      setEntries(all);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const totalCredit  = entries.filter(e => e.type === "credit").reduce((s, e) => s + e.amount, 0);
  const totalDebit   = entries.filter(e => e.type === "debit").reduce((s, e) => s + e.amount, 0);
  const netBalance   = totalCredit - totalDebit;
  const rangeLabel   = RANGES.find(r => r.val === range)?.label ?? "";

  const handlePDF = async () => {
    setExporting("pdf");
    try {
      const { exportLedgerToPDF } = await import("@/lib/exports/pdfExport");
      await exportLedgerToPDF({ entries, totalCredit, totalDebit, netBalance, range: rangeLabel, orgName: organization?.name ?? "Farm" });
    } catch { window.print(); }
    setExporting(null);
  };

  const handleExcel = async () => {
    setExporting("excel");
    try {
      const { exportLedgerToExcel } = await import("@/lib/exports/excelExport");
      await exportLedgerToExcel({ entries, totalCredit, totalDebit, netBalance, range: rangeLabel, orgName: organization?.name ?? "Farm" });
    } catch (e) { console.error(e); }
    setExporting(null);
  };

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#F5F5F5" }}>
      {/* ── Header ── */}
      <div className="px-4 pt-12 pb-4 print:pt-4" style={{ backgroundColor: "#1B5E20" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="text-white print:hidden">
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-white text-xl font-bold">Khata Report</h1>
              <p className="text-green-200 text-xs">Farm Ledger — {rangeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button onClick={handlePDF} disabled={!!exporting}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}>
              <FileText size={13} />{exporting === "pdf" ? "…" : "PDF"}
            </button>
            <button onClick={handleExcel} disabled={!!exporting}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}>
              <FileSpreadsheet size={13} />{exporting === "excel" ? "…" : "Excel"}
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}>
              <Printer size={13} />Print
            </button>
          </div>
        </div>

        {/* Range pills */}
        <div className="flex gap-2 print:hidden">
          {RANGES.map(({ val, label }) => (
            <button key={val} onClick={() => setRange(val)}
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: range === val ? "white" : "rgba(255,255,255,0.2)", color: range === val ? "#1B5E20" : "white" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* ── Summary ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Account Summary — {rangeLabel}</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl p-3" style={{ backgroundColor: "#E8F5E9" }}>
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp size={14} color="#1B5E20" />
                <p className="text-xs font-semibold" style={{ color: "#1B5E20" }}>Total Credit</p>
              </div>
              <p className="text-lg font-bold" style={{ color: "#1B5E20" }}>{fmt(totalCredit)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: "#FFEBEE" }}>
              <div className="flex items-center gap-1 mb-1">
                <TrendingDown size={14} color="#B71C1C" />
                <p className="text-xs font-semibold" style={{ color: "#B71C1C" }}>Total Debit</p>
              </div>
              <p className="text-lg font-bold" style={{ color: "#B71C1C" }}>{fmt(totalDebit)}</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3 text-center">
            <p className="text-gray-500 text-xs font-medium mb-0.5">Net Balance</p>
            <p className="text-2xl font-bold" style={{ color: netBalance >= 0 ? "#1B1B1B" : "#B71C1C" }}>
              {netBalance < 0 && "−"}{fmt(Math.abs(netBalance))}
            </p>
          </div>
        </div>

        {/* ── Transaction List ── */}
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100" style={{ borderTopColor: "#1B5E20" }} />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="text-5xl mb-3">📒</div>
            <p className="text-gray-600 font-semibold">No entries for {rangeLabel}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-gray-700 text-sm font-bold">{entries.length} transactions</p>
            </div>
            {entries.map((entry, idx) => {
              const isCredit = entry.type === "credit";
              return (
                <div key={entry.id}
                  className={`flex items-center gap-3 px-4 py-3 ${idx < entries.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: isCredit ? "#E8F5E9" : "#FFEBEE" }}>
                    {isCredit
                      ? <TrendingUp size={16} color="#1B5E20" />
                      : <TrendingDown size={16} color="#B71C1C" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 text-sm font-semibold truncate">
                      {entry.categoryLabel || entry.category}
                    </p>
                    <p className="text-gray-400 text-xs">{fmtDate(entry.date)}</p>
                    {entry.description && (
                      <p className="text-gray-400 text-xs truncate">{entry.description}</p>
                    )}
                  </div>
                  <p className="font-bold text-sm shrink-0" style={{ color: isCredit ? "#1B5E20" : "#B71C1C" }}>
                    {isCredit ? "+" : "−"}{fmt(entry.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@media print { .print\\:hidden { display: none !important; } .print\\:pt-4 { padding-top: 1rem !important; } }`}</style>
    </div>
  );
}
