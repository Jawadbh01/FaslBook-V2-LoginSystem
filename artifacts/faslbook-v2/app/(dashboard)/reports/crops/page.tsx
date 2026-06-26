"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";
import {
  ArrowLeft, Wheat, MapPin, User,
  Calendar, FileText, Printer,
} from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(val: any) {
  if (!val) return "—";
  const d = val?.toDate ? val.toDate() : new Date(val);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  planned:   { label: "Planned",   color: "#1565C0", bg: "#E3F2FD" },
  sowing:    { label: "Sowing",    color: "#E65100", bg: "#FFF3E0" },
  growing:   { label: "Growing",   color: "#1B5E20", bg: "#E8F5E9" },
  harvesting:{ label: "Harvesting",color: "#6A1B9A", bg: "#F3E5F5" },
  completed: { label: "Completed", color: "#424242", bg: "#F5F5F5" },
  failed:    { label: "Failed",    color: "#B71C1C", bg: "#FFEBEE" },
};

interface Crop {
  id: string;
  cropName: string;
  season: string;
  parcelId: string;
  parcelName: string;
  assignedFarmerName: string;
  sowingDate: any;
  expectedHarvest: any;
  status: string;
  notes: string;
}

interface Parcel {
  id: string;
  name: string;
  acres: number;
}

const SEASONS = ["All", "Kharif", "Rabi", "Zaid"];

export default function CropsReportPage() {
  const router = useRouter();
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  const [crops, setCrops]     = useState<Crop[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [season, setSeason]   = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (orgId) loadData(); }, [orgId]);

  const loadData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [cropSnap, parcelSnap] = await Promise.all([
        getDocs(query(collection(db, "crops"), where("organizationId", "==", orgId))),
        getDocs(query(collection(db, "parcels"), where("organizationId", "==", orgId))),
      ]);
      const parcelMap: Record<string, Parcel> = {};
      parcelSnap.docs.forEach(d => { parcelMap[d.id] = { id: d.id, ...d.data() } as Parcel; });
      setParcels(parcelSnap.docs.map(d => ({ id: d.id, ...d.data() } as Parcel)));

      const list: Crop[] = cropSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          cropName: data.cropName || "Unknown",
          season: data.season || "",
          parcelId: data.parcelId || "",
          parcelName: parcelMap[data.parcelId]?.name || data.parcelName || "—",
          assignedFarmerName: data.assignedFarmerName || "—",
          sowingDate: data.sowingDate,
          expectedHarvest: data.expectedHarvest,
          status: data.status || "planned",
          notes: data.notes || "",
        };
      });
      list.sort((a, b) => {
        const sa = STATUS_CFG[a.status] ? Object.keys(STATUS_CFG).indexOf(a.status) : 99;
        const sb = STATUS_CFG[b.status] ? Object.keys(STATUS_CFG).indexOf(b.status) : 99;
        return sa - sb;
      });
      setCrops(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const filtered = season === "All" ? crops : crops.filter(c => c.season === season);

  const statusCounts = Object.fromEntries(
    Object.keys(STATUS_CFG).map(s => [s, crops.filter(c => c.status === s).length])
  );

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
              <h1 className="text-white text-xl font-bold">Crops Report</h1>
              <p className="text-green-200 text-xs">{crops.length} crop{crops.length !== 1 ? "s" : ""} across {parcels.length} parcel{parcels.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button onClick={() => window.print()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}>
              <Printer size={13} />Print
            </button>
          </div>
        </div>

        {/* Season filter pills */}
        <div className="flex gap-2 print:hidden">
          {SEASONS.map(s => (
            <button key={s} onClick={() => setSeason(s)}
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: season === s ? "white" : "rgba(255,255,255,0.2)", color: season === s ? "#1B5E20" : "white" }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* ── Status summary ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Status Overview</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(STATUS_CFG).map(([key, cfg]) => (
              statusCounts[key] > 0 && (
                <div key={key} className="rounded-xl p-2.5 text-center" style={{ backgroundColor: cfg.bg }}>
                  <p className="font-bold text-base" style={{ color: cfg.color }}>{statusCounts[key]}</p>
                  <p className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</p>
                </div>
              )
            ))}
          </div>
        </div>

        {/* ── Crop list ── */}
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100" style={{ borderTopColor: "#1B5E20" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="text-5xl mb-3">🌾</div>
            <p className="text-gray-600 font-semibold">No crops{season !== "All" ? ` for ${season}` : ""}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(crop => {
              const cfg = STATUS_CFG[crop.status] ?? STATUS_CFG.planned;
              return (
                <div key={crop.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#E8F5E9" }}>
                        <Wheat size={20} color="#1B5E20" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{crop.cropName}</p>
                        <p className="text-gray-400 text-xs">{crop.season || "—"} Season</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <MapPin size={12} color="#9E9E9E" />
                      <span>Parcel: <span className="font-semibold text-gray-700">{crop.parcelName}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <User size={12} color="#9E9E9E" />
                      <span>Farmer: <span className="font-semibold text-gray-700">{crop.assignedFarmerName}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar size={12} color="#9E9E9E" />
                      <span>Sowing: <span className="font-semibold text-gray-700">{fmtDate(crop.sowingDate)}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar size={12} color="#9E9E9E" />
                      <span>Expected Harvest: <span className="font-semibold text-gray-700">{fmtDate(crop.expectedHarvest)}</span></span>
                    </div>
                    {crop.notes && (
                      <div className="mt-1 px-3 py-2 rounded-xl" style={{ backgroundColor: "#F9F9F9" }}>
                        <p className="text-xs text-gray-500">{crop.notes}</p>
                      </div>
                    )}
                  </div>
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
