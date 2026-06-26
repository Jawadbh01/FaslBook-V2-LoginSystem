"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";
import { ArrowLeft, User, MapPin, Wheat, Package, MessageCircle, FileText, Printer } from "lucide-react";

const fmt = (n: number) => "Rs. " + n.toLocaleString("en-PK");

export default function FarmerReportPage() {
  const router = useRouter();
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  const [farmers, setFarmers] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [parcels, setParcels] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [stockReceived, setStockReceived] = useState<any[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    loadFarmers();
  }, [orgId]);

  useEffect(() => {
    if (selectedId) loadFarmerData(selectedId);
  }, [selectedId]);

  const loadFarmers = async () => {
    if (!orgId) return;
    const [userSnap, workerSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("organizationId", "==", orgId), where("role", "==", "farmer"))),
      getDocs(query(collection(db, "workers"), where("organizationId", "==", orgId), where("workerType", "==", "farmer"))),
    ]);
    const list = [
      ...userSnap.docs.map((d) => ({ id: d.id, name: d.data().name || d.data().displayName, source: "user", ...d.data() })),
      ...workerSnap.docs.map((d) => ({ id: d.id, name: d.data().name, source: "worker", ...d.data() })),
    ];
    setFarmers(list);
    if (list.length > 0) setSelectedId(list[0].id);
  };

  const loadFarmerData = async (farmerId: string) => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [parcelSnap, cropSnap, stockSnap, expSnap] = await Promise.all([
        getDocs(query(collection(db, "parcels"), where("organizationId", "==", orgId), where("assignedFarmer", "==", farmerId))),
        getDocs(query(collection(db, "crops"), where("organizationId", "==", orgId), where("assignedFarmer", "==", farmerId))),
        getDocs(query(collection(db, "inventoryTransactions"), where("organizationId", "==", orgId), where("toFarmerId", "==", farmerId))),
        getDocs(query(collection(db, "expenses"), where("organizationId", "==", orgId))),
      ]);

      const farmerParcels = parcelSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const parcelIds = farmerParcels.map((p: any) => p.id);

      setParcels(farmerParcels);
      setCrops(cropSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setStockReceived(stockSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      let exp = 0;
      expSnap.docs.forEach((d) => {
        if (parcelIds.includes(d.data().parcelId)) {
          exp += Number(d.data().amount) || 0;
        }
      });
      setTotalExpense(exp);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const selectedFarmer = farmers.find((f) => f.id === selectedId);

  const handlePDF = async () => {
    setExporting(true);
    try {
      const { exportToPDF } = await import("@/lib/exports/pdfExport");
      const rows = [
        ["Farmer", selectedFarmer?.name || ""],
        ["Parcels", String(parcels.length)],
        ["Active Crops", String(crops.filter((c: any) => c.status !== "harvested" && c.status !== "closed").length)],
        ["Total Expenses", fmt(totalExpense)],
        ...stockReceived.map((s: any) => [`Stock - ${s.itemName}`, `${s.quantity} ${s.unit}`]),
      ];
      await exportToPDF(`Farmer Report - ${selectedFarmer?.name}`, rows, ["Item", "Details"]);
    } catch (e) { console.error(e); }
    setExporting(false);
  };

  const handleWhatsApp = async () => {
    const { shareViaWhatsApp } = await import("@/lib/exports/whatsappShare");
    shareViaWhatsApp(
      `Farmer Report - ${selectedFarmer?.name}`,
      `Parcels: ${parcels.length}\nCrops: ${crops.length}\nTotal Expenses: ${fmt(totalExpense)}`
    );
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="px-4 pt-12 pb-5" style={{ backgroundColor: "#1B5E20" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-white"><ArrowLeft size={24} /></button>
            <div>
              <h1 className="text-white text-xl font-bold">Farmer Report</h1>
              <p className="text-green-200 text-xs">Performance per farmer</p>
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
        <div className="bg-white/20 rounded-2xl px-4 py-3 flex items-center gap-3">
          <User size={18} color="white" />
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="flex-1 bg-transparent text-white outline-none text-sm font-medium"
          >
            {farmers.map((f) => (
              <option key={f.id} value={f.id} style={{ color: "#1B5E20" }}>{f.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-4 pt-4">
        {farmers.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <User size={40} color="#E0E0E0" />
            <p className="text-gray-400 mt-3">No farmers in your team yet</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center pt-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100" style={{ borderTopColor: "#1B5E20" }} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Parcels", value: parcels.length, color: "#1B5E20", bg: "#E8F5E9" },
                { label: "Crops", value: crops.length, color: "#1565C0", bg: "#E3F2FD" },
                { label: "Harvested", value: crops.filter((c: any) => c.status === "harvested").length, color: "#00695C", bg: "#E0F2F1" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-2xl p-3 shadow-sm text-center">
                  <p className="font-bold text-xl" style={{ color }}>{value}</p>
                  <p className="text-gray-400 text-xs">{label}</p>
                </div>
              ))}
            </div>

            {parcels.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <p className="font-bold text-gray-800 text-sm mb-3">Assigned Parcels</p>
                {parcels.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} color="#1B5E20" />
                      <span className="text-gray-700 text-sm">{p.name}</span>
                    </div>
                    <span className="text-gray-500 text-xs">{p.acres} acres</span>
                  </div>
                ))}
              </div>
            )}

            {crops.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <p className="font-bold text-gray-800 text-sm mb-3">Crops</p>
                {crops.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wheat size={14} color="#1B5E20" />
                      <div>
                        <p className="text-gray-700 text-sm">{c.cropName}</p>
                        <p className="text-gray-400 text-xs">{c.parcelName}</p>
                      </div>
                    </div>
                    <div className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: "#E8F5E9", color: "#1B5E20" }}>
                      {c.status}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {stockReceived.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <p className="font-bold text-gray-800 text-sm mb-3">Stock Received from Godown</p>
                {stockReceived.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package size={14} color="#E65100" />
                      <span className="text-gray-700 text-sm">{s.itemName}</span>
                    </div>
                    <span className="font-semibold text-sm text-gray-800">{s.quantity} {s.unit}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-600 text-sm">Total Expenses on Parcels</p>
                <p className="font-bold text-red-600">{fmt(totalExpense)}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Export</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handlePDF} disabled={exporting}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm active:scale-95 transition-all disabled:opacity-50"
                  style={{ backgroundColor: "#FFEBEE", color: "#C62828" }}>
                  <FileText size={16} /> PDF
                </button>
                <button onClick={handleWhatsApp}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm active:scale-95 transition-all"
                  style={{ backgroundColor: "#DCF8C6", color: "#1B5E20" }}>
                  <MessageCircle size={16} /> WhatsApp
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
