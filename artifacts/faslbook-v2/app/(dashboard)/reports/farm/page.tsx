"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";
import {
  ArrowLeft, TrendingUp, TrendingDown, Wallet, Package,
  FileText, MessageCircle, FileSpreadsheet, Wheat, Printer, ChevronDown,
} from "lucide-react";

const fmt = (n: number) => "Rs. " + n.toLocaleString("en-PK");

function today() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(str: string) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]} ${y}`;
}

function getStartStr(range: string): string | null {
  const now = new Date();
  if (range === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); }
  if (range === "month") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  if (range === "year") return `${now.getFullYear()}-01-01`;
  return null;
}

export default function FarmReportPage() {
  const router = useRouter();
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  const [range, setRange] = useState("month");
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [incomeByType, setIncomeByType] = useState<Record<string, number>>({});
  const [expenseByCategory, setExpenseByCategory] = useState<Record<string, number>>({});
  const [crops, setCrops] = useState<any[]>([]);

  useEffect(() => { if (orgId) loadData(); }, [orgId, range]);

  const loadData = async () => {
    if (!orgId) return;
    setLoading(true);
    const start = getStartStr(range);
    try {
      const [ledgerSnap, cropSnap, invSnap] = await Promise.all([
        getDocs(query(collection(db, "ledgerEntries"), where("organizationId", "==", orgId))),
        getDocs(query(collection(db, "crops"),         where("organizationId", "==", orgId))),
        getDocs(query(collection(db, "inventoryItems"),where("organizationId", "==", orgId))),
      ]);

      let inc = 0; let exp = 0;
      const byType: Record<string, number> = {};
      const byCat: Record<string, number> = {};

      ledgerSnap.docs.forEach(d => {
        const data = d.data();
        const dateStr: string = data.date || "";
        if (start && dateStr < start) return;
        const amount = Number(data.amount) || 0;
        if (data.type === "credit") {
          inc += amount;
          const k = data.categoryLabel || data.category || "Other";
          byType[k] = (byType[k] || 0) + amount;
        } else {
          exp += amount;
          const k = data.categoryLabel || data.category || "Other";
          byCat[k] = (byCat[k] || 0) + amount;
        }
      });

      setTotalIncome(inc);
      setTotalExpense(exp);
      setIncomeByType(byType);
      setExpenseByCategory(byCat);
      setCrops(cropSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const invVal = invSnap.docs.reduce((s, d) => {
        const data = d.data();
        return s + ((data.currentStock || 0) * (data.pricePerUnit || 0));
      }, 0);
      setInventoryValue(invVal);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const netBalance = totalIncome - totalExpense;
  const rangeLabels: Record<string, string> = { week: "This Week", month: "This Month", year: "This Year" };
  const rangeLabel = rangeLabels[range] ?? range;

  const handlePDF = async () => {
    setExporting("pdf"); setShowMenu(false);
    try {
      const { exportToPDF } = await import("@/lib/exports/pdfExport");
      const rows = [
        ["Total Income", fmt(totalIncome)], ["Total Expense", fmt(totalExpense)],
        ["Net Balance", fmt(netBalance)], ["Inventory Value", fmt(inventoryValue)],
        ...Object.entries(incomeByType).map(([k, v]) => [`Income: ${k}`, fmt(v)]),
        ...Object.entries(expenseByCategory).map(([k, v]) => [`Expense: ${k}`, fmt(v)]),
      ];
      await exportToPDF("Farm Overview — " + rangeLabel, rows, ["Item", "Amount"]);
    } catch { window.print(); }
    setExporting(null);
  };

  const handleExcel = async () => {
    setExporting("excel"); setShowMenu(false);
    try {
      const { exportToExcel } = await import("@/lib/exports/excelExport");
      const rows = [
        ...Object.entries(incomeByType).map(([k, v]) => ["Income", k, v]),
        ...Object.entries(expenseByCategory).map(([k, v]) => ["Expense", k, v]),
      ];
      await exportToExcel("Farm Overview", rows, ["Type", "Category", "Amount"]);
    } catch (e) { console.error(e); }
    setExporting(null);
  };

  const handleWhatsApp = async () => {
    setShowMenu(false);
    const { shareViaWhatsApp } = await import("@/lib/exports/whatsappShare");
    shareViaWhatsApp("Farm Overview — " + rangeLabel,
      `Income: ${fmt(totalIncome)}\nExpense: ${fmt(totalExpense)}\nNet: ${fmt(netBalance)}\nInventory: ${fmt(inventoryValue)}`);
  };

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#F5F5F5" }}>
      {/* ── Header ── */}
      <div className="px-4 pt-12 pb-4 screen-only" style={{ backgroundColor: "#1B5E20" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="text-white"><ArrowLeft size={24} /></button>
            <div>
              <h1 className="text-white text-xl font-bold">Farm Overview</h1>
              <p className="text-green-200 text-xs">{rangeLabel}</p>
            </div>
          </div>
          <div className="relative">
            <button onClick={() => setShowMenu(v => !v)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}>
              <Printer size={13} />Print<ChevronDown size={11} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-2xl shadow-xl overflow-hidden w-44">
                  {[
                    { icon: <Printer size={14} />, label: "Print Now", action: () => { setShowMenu(false); window.print(); } },
                    { icon: <FileText size={14} />, label: exporting==="pdf" ? "Exporting…" : "Save as PDF", action: handlePDF },
                    { icon: <FileSpreadsheet size={14} />, label: exporting==="excel" ? "Exporting…" : "Export Excel", action: handleExcel },
                    { icon: <MessageCircle size={14} />, label: "WhatsApp", action: handleWhatsApp },
                  ].map(({ icon, label, action }) => (
                    <button key={label} onClick={action}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">
                      <span style={{ color: "#1B5E20" }}>{icon}</span>{label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {["week","month","year"].map(v => (
            <button key={v} onClick={() => setRange(v)}
              className="px-3 py-1 rounded-full text-xs font-semibold capitalize"
              style={{ backgroundColor: range === v ? "white" : "rgba(255,255,255,0.2)", color: range === v ? "#1B5E20" : "white" }}>
              {rangeLabels[v]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Screen view ── */}
      <div className="px-4 pt-4 screen-only">
        {loading ? (
          <div className="flex justify-center pt-20"><div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100" style={{ borderTopColor: "#1B5E20" }} /></div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <p className="text-gray-400 text-xs mb-1">Net Balance — {rangeLabel}</p>
              <p className="font-bold text-2xl mb-3" style={{ color: netBalance >= 0 ? "#1B5E20" : "#C62828" }}>{fmt(netBalance)}</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-xl p-3" style={{ backgroundColor: "#E8F5E9" }}>
                  <div className="flex items-center gap-1 mb-1"><TrendingUp size={14} color="#1B5E20" /><p className="text-xs text-green-800 font-semibold">Income</p></div>
                  <p className="font-bold" style={{ color: "#1B5E20" }}>{fmt(totalIncome)}</p>
                </div>
                <div className="rounded-xl p-3" style={{ backgroundColor: "#FFEBEE" }}>
                  <div className="flex items-center gap-1 mb-1"><TrendingDown size={14} color="#C62828" /><p className="text-xs text-red-800 font-semibold">Expense</p></div>
                  <p className="font-bold text-red-700">{fmt(totalExpense)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1 mb-1"><Package size={14} color="#E65100" /><p className="text-xs text-gray-500">Inventory</p></div>
                  <p className="font-bold text-gray-800 text-sm">{fmt(inventoryValue)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1 mb-1"><Wheat size={14} color="#1B5E20" /><p className="text-xs text-gray-500">Crops</p></div>
                  <p className="font-bold text-gray-800 text-sm">{crops.length} active</p>
                </div>
              </div>
            </div>

            {Object.keys(incomeByType).length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <p className="font-bold text-gray-800 text-sm mb-3">Income Breakdown</p>
                {Object.entries(incomeByType).sort((a,b) => b[1]-a[1]).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm">{k}</span>
                    <span className="font-bold text-sm" style={{ color: "#1B5E20" }}>{fmt(v)}</span>
                  </div>
                ))}
              </div>
            )}

            {Object.keys(expenseByCategory).length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <p className="font-bold text-gray-800 text-sm mb-3">Expense Breakdown</p>
                {Object.entries(expenseByCategory).sort((a,b) => b[1]-a[1]).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm">{k}</span>
                    <span className="font-bold text-sm text-red-600">{fmt(v)}</span>
                  </div>
                ))}
              </div>
            )}

            {crops.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <p className="font-bold text-gray-800 text-sm mb-3">Active Crops ({crops.length})</p>
                {crops.slice(0, 10).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wheat size={14} color="#1B5E20" />
                      <div>
                        <p className="text-gray-700 text-sm">{c.cropName}</p>
                        <p className="text-gray-400 text-xs">{c.parcelName || "—"}</p>
                      </div>
                    </div>
                    <div className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: "#E8F5E9", color: "#1B5E20" }}>
                      {c.status}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(totalIncome === 0 && totalExpense === 0) && (
              <div className="flex flex-col items-center justify-center pt-8 text-center">
                <Wallet size={40} color="#E0E0E0" />
                <p className="text-gray-400 mt-3">No transactions in {rangeLabel}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Print-only view ── */}
      <div className="print-only" style={{ padding: "0 24px" }}>
        <div style={{ borderBottom: "3px solid #1B5E20", paddingBottom: 10, marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1B5E20", margin: 0 }}>{organization?.name || "Farm"} — Farm Overview</h1>
          <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0" }}>Period: {rangeLabel} &nbsp;|&nbsp; Generated: {today()}</p>
        </div>
        <table style={{ width: "50%", marginBottom: 20 }}>
          <tbody>
            {[["Total Income", fmt(totalIncome), "#1B5E20"], ["Total Expense", fmt(totalExpense), "#B71C1C"], ["Net Balance", fmt(netBalance), netBalance >= 0 ? "#1B5E20" : "#B71C1C"], ["Inventory Value", fmt(inventoryValue), "#333"]].map(([l,v,c]) => (
              <tr key={l}><td style={{ fontWeight: 600, fontSize: 12, padding: "3px 8px 3px 0" }}>{l}</td><td style={{ fontWeight: 700, color: c as string, fontSize: 13 }}>{v}</td></tr>
            ))}
          </tbody>
        </table>
        {Object.keys(incomeByType).length > 0 && <>
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: "16px 0 8px", color: "#333" }}>Income Breakdown</h2>
          <table><thead><tr><th style={{ width: 30 }}>#</th><th>Category</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
            <tbody>{Object.entries(incomeByType).sort((a,b) => b[1]-a[1]).map(([k,v],i) => (
              <tr key={k}><td>{i+1}</td><td>{k}</td><td style={{ textAlign: "right", color: "#1B5E20", fontWeight: 600 }}>{fmt(v)}</td></tr>
            ))}</tbody></table>
        </>}
        {Object.keys(expenseByCategory).length > 0 && <>
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: "16px 0 8px", color: "#333" }}>Expense Breakdown</h2>
          <table><thead><tr><th style={{ width: 30 }}>#</th><th>Category</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
            <tbody>{Object.entries(expenseByCategory).sort((a,b) => b[1]-a[1]).map(([k,v],i) => (
              <tr key={k}><td>{i+1}</td><td>{k}</td><td style={{ textAlign: "right", color: "#B71C1C", fontWeight: 600 }}>{fmt(v)}</td></tr>
            ))}</tbody></table>
        </>}
        {crops.length > 0 && <>
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: "16px 0 8px", color: "#333" }}>Crops ({crops.length})</h2>
          <table><thead><tr><th>#</th><th>Crop</th><th>Parcel</th><th>Season</th><th>Status</th></tr></thead>
            <tbody>{crops.map((c: any,i) => (
              <tr key={c.id}><td>{i+1}</td><td>{c.cropName}</td><td>{c.parcelName||"—"}</td><td>{c.season||"—"}</td><td>{c.status}</td></tr>
            ))}</tbody></table>
        </>}
      </div>

      <style>{`
        @media screen { .print-only { display: none !important; } }
        @media print {
          .screen-only { display: none !important; }
          .print-only { display: block !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background-color: #1B5E20 !important; color: white !important; padding: 7px 10px; text-align: left; }
          td { padding: 5px 10px; border-bottom: 1px solid #E8E8E8; }
          tr:nth-child(even) td { background: #F9F9F9; }
        }
      `}</style>
    </div>
  );
}
