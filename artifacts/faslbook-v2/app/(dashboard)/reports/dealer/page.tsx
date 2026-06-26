"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";
import { ArrowLeft, Handshake, FileText, FileSpreadsheet, MessageCircle, Printer } from "lucide-react";

const fmt = (n: number) => "Rs. " + n.toLocaleString("en-PK");

export default function DealerReportPage() {
  const router = useRouter();
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  const [dealers, setDealers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    loadData();
  }, [orgId]);

  const loadData = async () => {
    if (!orgId) return;
    try {
      const [dealerSnap, txSnap] = await Promise.all([
        getDocs(query(collection(db, "dealers"), where("organizationId", "==", orgId))),
        getDocs(query(collection(db, "dealerTransactions"), where("organizationId", "==", orgId))),
      ]);
      setDealers(dealerSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTransactions(txSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const totalOutstanding = dealers.reduce((s: number, d: any) => s + Math.max(0, (d.totalPurchased || 0) - (d.totalPaid || 0)), 0);

  const handlePDF = async () => {
    setExporting("pdf");
    try {
      const { exportToPDF } = await import("@/lib/exports/pdfExport");
      const rows = dealers.map((d: any) => [
        d.name,
        fmt(d.totalPurchased || 0),
        fmt(d.totalPaid || 0),
        fmt(Math.max(0, (d.totalPurchased || 0) - (d.totalPaid || 0))),
      ]);
      await exportToPDF("Dealer Report", rows, ["Dealer", "Purchased", "Paid", "Outstanding"]);
    } catch (e) { console.error(e); }
    setExporting(null);
  };

  const handleExcel = async () => {
    setExporting("excel");
    try {
      const { exportToExcel } = await import("@/lib/exports/excelExport");
      const rows = dealers.map((d: any) => [
        d.name,
        d.totalPurchased || 0,
        d.totalPaid || 0,
        Math.max(0, (d.totalPurchased || 0) - (d.totalPaid || 0)),
      ]);
      await exportToExcel("Dealer Report", rows, ["Dealer", "Purchased", "Paid", "Outstanding"]);
    } catch (e) { console.error(e); }
    setExporting(null);
  };

  const handleWhatsApp = async () => {
    const { shareViaWhatsApp } = await import("@/lib/exports/whatsappShare");
    const summary = dealers.map((d: any) =>
      `${d.name}: Outstanding ${fmt(Math.max(0, (d.totalPurchased || 0) - (d.totalPaid || 0)))}`
    ).join("\n");
    shareViaWhatsApp("Dealer Report", `Total Outstanding: ${fmt(totalOutstanding)}\n\n${summary}`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="px-4 pt-12 pb-5" style={{ backgroundColor: "#1B5E20" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-white"><ArrowLeft size={24} /></button>
            <div>
              <h1 className="text-white text-xl font-bold">Dealer Report</h1>
              <p className="text-green-200 text-xs">Purchases & outstanding balances</p>
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
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center pt-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100" style={{ borderTopColor: "#1B5E20" }} />
          </div>
        ) : (
          <>
            {totalOutstanding > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Total Outstanding Balance</p>
                  <p className="font-bold text-xl" style={{ color: "#C62828" }}>{fmt(totalOutstanding)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#FFEBEE" }}>
                  <Handshake size={24} color="#C62828" />
                </div>
              </div>
            )}

            {dealers.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-16 text-center">
                <Handshake size={40} color="#E0E0E0" />
                <p className="text-gray-400 mt-3">No dealers yet</p>
              </div>
            ) : (
              <>
                {dealers.map((dealer: any) => {
                  const outstanding = Math.max(0, (dealer.totalPurchased || 0) - (dealer.totalPaid || 0));
                  const pct = dealer.totalPurchased > 0 ? Math.min(100, ((dealer.totalPaid || 0) / dealer.totalPurchased) * 100) : 0;
                  const dealerTx = transactions.filter((t: any) => t.dealerId === dealer.id)
                    .sort((a: any, b: any) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
                    .slice(0, 3);

                  return (
                    <div key={dealer.id} className="bg-white rounded-2xl p-4 shadow-sm mb-3">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#E8F5E9" }}>
                            <Handshake size={18} color="#1B5E20" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">{dealer.name}</p>
                            {dealer.phone && <p className="text-gray-400 text-xs">{dealer.phone}</p>}
                          </div>
                        </div>
                        <div className="px-2 py-1 rounded-full text-xs font-bold"
                          style={{ backgroundColor: outstanding > 0 ? "#FFEBEE" : "#E8F5E9", color: outstanding > 0 ? "#C62828" : "#1B5E20" }}>
                          {outstanding > 0 ? fmt(outstanding) : "✅ Cleared"}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-gray-50 rounded-xl p-2">
                          <p className="text-gray-400 text-xs">Purchased</p>
                          <p className="font-bold text-sm text-gray-800">{fmt(dealer.totalPurchased || 0)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2">
                          <p className="text-gray-400 text-xs">Paid</p>
                          <p className="font-bold text-sm" style={{ color: "#1B5E20" }}>{fmt(dealer.totalPaid || 0)}</p>
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Payment Progress</span>
                          <span>{Math.round(pct)}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#1B5E20" }} />
                        </div>
                      </div>
                      {dealerTx.length > 0 && (
                        <div>
                          <p className="text-gray-400 text-xs mb-2">Recent Transactions</p>
                          {dealerTx.map((tx: any) => (
                            <div key={tx.id} className="flex items-center justify-between mb-1">
                              <span className="text-gray-500 text-xs capitalize">{tx.type} • {tx.items || ""}</span>
                              <span className="text-xs font-semibold" style={{ color: tx.type === "purchase" ? "#C62828" : "#1B5E20" }}>
                                {tx.type === "purchase" ? "-" : "+"}{fmt(tx.amount || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

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
          </>
        )}
      </div>
    </div>
  );
}
