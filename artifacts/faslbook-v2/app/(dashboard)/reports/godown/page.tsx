"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";
import { ArrowLeft, Warehouse, FileText, FileSpreadsheet, MessageCircle, Printer } from "lucide-react";

const fmt = (n: number) => "Rs. " + n.toLocaleString("en-PK");

const CATEGORIES = ["All", "Seed", "Fertilizer", "Pesticide", "Fuel", "cropStock", "Other"];

export default function GodownReportPage() {
  const router = useRouter();
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  const [items, setItems] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    loadData();
  }, [orgId]);

  const loadData = async () => {
    if (!orgId) return;
    try {
      const [itemSnap, txSnap] = await Promise.all([
        getDocs(query(collection(db, "inventoryItems"), where("organizationId", "==", orgId))),
        getDocs(query(collection(db, "inventoryTransactions"), where("organizationId", "==", orgId))),
      ]);
      setItems(itemSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTransactions(txSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const stockIn = transactions.filter((t: any) => {
    const d = t.createdAt?.toDate ? t.createdAt.toDate() : new Date();
    return t.type === "in" && d >= monthStart;
  }).reduce((s: number, t: any) => s + (Number(t.quantity) || 0), 0);

  const stockOut = transactions.filter((t: any) => {
    const d = t.createdAt?.toDate ? t.createdAt.toDate() : new Date();
    return t.type === "out" && d >= monthStart;
  }).reduce((s: number, t: any) => s + (Number(t.quantity) || 0), 0);

  const totalValue = items.reduce((s: number, i: any) => s + ((i.currentStock || 0) * (i.pricePerUnit || 0)), 0);

  const filtered = filter === "All" ? items : items.filter((i: any) =>
    (i.category || "").toLowerCase() === filter.toLowerCase()
  );

  const handlePDF = async () => {
    setExporting("pdf");
    try {
      const { exportToPDF } = await import("@/lib/exports/pdfExport");
      const rows = items.map((i: any) => [i.name, i.category || "", `${i.currentStock || 0} ${i.unit || ""}`, fmt((i.currentStock || 0) * (i.pricePerUnit || 0))]);
      await exportToPDF("Godown Report", rows, ["Item", "Category", "Stock", "Value"]);
    } catch (e) { console.error(e); }
    setExporting(null);
  };

  const handleExcel = async () => {
    setExporting("excel");
    try {
      const { exportToExcel } = await import("@/lib/exports/excelExport");
      const rows = items.map((i: any) => [i.name, i.category || "", i.currentStock || 0, i.unit || "", (i.currentStock || 0) * (i.pricePerUnit || 0)]);
      await exportToExcel("Godown Report", rows, ["Item", "Category", "Stock", "Unit", "Value"]);
    } catch (e) { console.error(e); }
    setExporting(null);
  };

  const handleWhatsApp = async () => {
    const { shareViaWhatsApp } = await import("@/lib/exports/whatsappShare");
    const summary = items.map((i: any) => `${i.name}: ${i.currentStock || 0} ${i.unit || ""}`).join("\n");
    shareViaWhatsApp("Godown Report", `Total Value: ${fmt(totalValue)}\nStock In: ${stockIn} units\nStock Out: ${stockOut} units\n\n${summary}`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="px-4 pt-12 pb-5" style={{ backgroundColor: "#1B5E20" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-white"><ArrowLeft size={24} /></button>
            <div>
              <h1 className="text-white text-xl font-bold">Godown Report</h1>
              <p className="text-green-200 text-xs">Stock levels & inventory value</p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}
          >
            <Printer size={14} />
            Print
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setFilter(cat)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
              style={{ backgroundColor: filter === cat ? "white" : "rgba(255,255,255,0.2)", color: filter === cat ? "#1B5E20" : "white" }}>
              {cat === "cropStock" ? "Crop Stock" : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center pt-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100" style={{ borderTopColor: "#1B5E20" }} />
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <p className="text-gray-400 text-xs mb-1">Total Inventory Value</p>
              <p className="font-bold text-2xl mb-3" style={{ color: "#1B5E20" }}>{fmt(totalValue)}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{ backgroundColor: "#E8F5E9" }}>
                  <p className="text-green-600 text-xs">Stock In This Month</p>
                  <p className="font-bold text-green-800">{stockIn} units</p>
                </div>
                <div className="rounded-xl p-3" style={{ backgroundColor: "#FFEBEE" }}>
                  <p className="text-red-500 text-xs">Stock Out This Month</p>
                  <p className="font-bold text-red-700">{stockOut} units</p>
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-10 text-center">
                <Warehouse size={40} color="#E0E0E0" />
                <p className="text-gray-400 mt-3">No items in this category</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 mb-4">
                {filtered.map((item: any) => {
                  const value = (item.currentStock || 0) * (item.pricePerUnit || 0);
                  const isLow = (item.currentStock || 0) < 10;
                  return (
                    <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-gray-800">{item.name}</p>
                          <p className="text-gray-400 text-xs capitalize">{item.category || "Other"}</p>
                        </div>
                        <div className="px-2 py-1 rounded-full text-xs font-bold"
                          style={{ backgroundColor: isLow ? "#FFEBEE" : "#E8F5E9", color: isLow ? "#C62828" : "#1B5E20" }}>
                          {isLow ? "⚠️ Low" : "✅ OK"}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 rounded-xl p-2">
                          <p className="text-gray-400 text-xs">Current Stock</p>
                          <p className="font-bold text-gray-800">{item.currentStock || 0} <span className="text-gray-400 font-normal text-xs">{item.unit}</span></p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2">
                          <p className="text-gray-400 text-xs">Value</p>
                          <p className="font-bold text-gray-800 text-sm">{value > 0 ? fmt(value) : "—"}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {transactions.slice(0, 5).length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <p className="font-bold text-gray-800 text-sm mb-3">Recent Transactions</p>
                {transactions.slice(0, 5).map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-gray-700 text-sm">{tx.itemName}</p>
                      <p className="text-gray-400 text-xs capitalize">{tx.source || tx.type}</p>
                    </div>
                    <span className="font-semibold text-sm" style={{ color: tx.type === "in" ? "#1B5E20" : "#C62828" }}>
                      {tx.type === "in" ? "+" : "-"}{tx.quantity} {tx.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Export</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={handlePDF} disabled={!!exporting}
                  className="flex items-center justify-center gap-1 py-3 rounded-xl font-semibold text-sm active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: "#FFEBEE", color: "#C62828" }}>
                  <FileText size={15} /> PDF
                </button>
                <button onClick={handleExcel} disabled={!!exporting}
                  className="flex items-center justify-center gap-1 py-3 rounded-xl font-semibold text-sm active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: "#E8F5E9", color: "#1B5E20" }}>
                  <FileSpreadsheet size={15} /> Excel
                </button>
                <button onClick={handleWhatsApp}
                  className="flex items-center justify-center gap-1 py-3 rounded-xl font-semibold text-sm active:scale-95"
                  style={{ backgroundColor: "#DCF8C6", color: "#1B5E20" }}>
                  <MessageCircle size={15} /> Share
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
