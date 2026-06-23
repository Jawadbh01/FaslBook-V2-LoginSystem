"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection, query, where, onSnapshot,
  addDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";
import {
  Plus, X, Loader2, Phone, ClipboardList,
  ChevronRight, User, Wheat,
} from "lucide-react";

interface FarmerUser {
  id: string;
  displayName: string;
  email: string;
  phone?: string;
  photoURL?: string;
  role: string;
  status?: string;
  organizationId: string;
}

interface Worker {
  id: string;
  name: string;
  phone: string;
  workerType: "daily" | "monthly";
  dailyRate?: number;
  monthlySalary?: number;
  status: string;
  organizationId: string;
  createdAt: any;
}

interface Parcel {
  id: string;
  name: string;
  assignedFarmer?: string;
}

interface AttendanceRecord {
  workerId: string;
  date: string;
  status: "present" | "halfDay" | "absent";
}

export default function WorkersPage() {
  const router = useRouter();
  const { organization, role } = useAuthStore();
  const orgId = organization?.id;
  const canEdit = role === "landlord" || role === "manager";

  const [tab, setTab] = useState<"farmers" | "workers">("farmers");
  const [farmers, setFarmers] = useState<FarmerUser[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showSheet, setShowSheet] = useState(false);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [wForm, setWForm] = useState({
    name: "",
    phone: "",
    workerType: "daily" as "daily" | "monthly",
    dailyRate: "",
    monthlySalary: "",
    notes: "",
  });

  const todayStr = () => new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!orgId) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(
      query(collection(db, "users"), where("organizationId", "==", orgId), where("role", "==", "farmer")),
      (snap) => {
        setFarmers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FarmerUser)));
        setLoading(false);
      }
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "workers"), where("organizationId", "==", orgId)),
      (snap) => {
        setWorkers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Worker))
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)));
      }
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "parcels"), where("organizationId", "==", orgId)),
      (snap) => setParcels(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Parcel)))
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "attendance"),
        where("organizationId", "==", orgId),
        where("date", "==", todayStr())
      ),
      (snap) => setTodayAttendance(snap.docs.map((d) => d.data() as AttendanceRecord))
    ));

    return () => unsubs.forEach((u) => u());
  }, [orgId]);

  const handleSaveWorker = async () => {
    if (!wForm.name.trim()) { setError("Name is required"); return; }
    if (wForm.workerType === "daily" && !wForm.dailyRate) { setError("Enter daily rate"); return; }
    if (wForm.workerType === "monthly" && !wForm.monthlySalary) { setError("Enter monthly salary"); return; }
    try {
      setSaving(true); setError("");
      await addDoc(collection(db, "workers"), {
        name: wForm.name.trim(),
        phone: wForm.phone.trim(),
        workerType: wForm.workerType,
        dailyRate: wForm.workerType === "daily" ? Number(wForm.dailyRate) : 0,
        monthlySalary: wForm.workerType === "monthly" ? Number(wForm.monthlySalary) : 0,
        notes: wForm.notes.trim(),
        status: "active",
        organizationId: orgId,
        createdAt: serverTimestamp(),
        syncStatus: "synced",
      });
      setShowAddWorker(false);
      setShowSheet(false);
      setWForm({ name: "", phone: "", workerType: "daily", dailyRate: "", monthlySalary: "", notes: "" });
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const initials = (name: string) =>
    name?.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";

  const getAttendanceDot = (workerId: string) => {
    const rec = todayAttendance.find((a) => a.workerId === workerId);
    if (!rec) return "gray";
    if (rec.status === "present") return "#1B5E20";
    if (rec.status === "halfDay") return "#E65100";
    return "#C62828";
  };

  // ── Add Worker Form ─────────────────────────────────────────
  if (showAddWorker) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex items-center px-4 pt-12 pb-6" style={{ backgroundColor: "#1B5E20" }}>
          <button onClick={() => { setShowAddWorker(false); setError(""); }} className="text-white mr-3">
            <X size={24} />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">Invite Worker</h1>
            <p className="text-green-200 text-xs">Add to your team</p>
          </div>
        </div>
        <div className="flex-1 px-6 pt-6 pb-10 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">{error}</div>
          )}

          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">Worker Name *</label>
            <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
              <User size={18} color="#9E9E9E" className="mr-3 shrink-0" />
              <input type="text" placeholder="Full name" value={wForm.name}
                onChange={(e) => setWForm({ ...wForm, name: e.target.value })}
                className="flex-1 outline-none text-gray-800 text-base bg-transparent" />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">Phone Number</label>
            <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
              <Phone size={18} color="#9E9E9E" className="mr-3 shrink-0" />
              <input type="tel" placeholder="03XX-XXXXXXX" value={wForm.phone}
                onChange={(e) => setWForm({ ...wForm, phone: e.target.value })}
                className="flex-1 outline-none text-gray-800 text-base bg-transparent" />
            </div>
          </div>

          <div className="mb-5">
            <label className="text-gray-600 text-sm font-medium mb-3 block">Worker Type</label>
            <div className="flex gap-3">
              {[
                { val: "daily", label: "Daily" },
                { val: "monthly", label: "Monthly" },
              ].map(({ val, label }) => (
                <button key={val}
                  onClick={() => setWForm({ ...wForm, workerType: val as any })}
                  className="flex-1 py-3 rounded-2xl border-2 font-semibold text-sm transition-all"
                  style={{
                    borderColor: wForm.workerType === val ? "#1B5E20" : "#E5E7EB",
                    backgroundColor: wForm.workerType === val ? "#E8F5E9" : "white",
                    color: wForm.workerType === val ? "#1B5E20" : "#6B7280",
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {wForm.workerType === "daily" ? (
            <div className="mb-4">
              <label className="text-gray-600 text-sm font-medium mb-2 block">Daily Rate (Rs.) *</label>
              <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
                <span className="text-gray-400 mr-2 font-medium">Rs.</span>
                <input type="number" placeholder="0" value={wForm.dailyRate}
                  onChange={(e) => setWForm({ ...wForm, dailyRate: e.target.value })}
                  className="flex-1 outline-none text-gray-800 text-base bg-transparent" />
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <label className="text-gray-600 text-sm font-medium mb-2 block">Monthly Salary (Rs.) *</label>
              <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
                <span className="text-gray-400 mr-2 font-medium">Rs.</span>
                <input type="number" placeholder="0" value={wForm.monthlySalary}
                  onChange={(e) => setWForm({ ...wForm, monthlySalary: e.target.value })}
                  className="flex-1 outline-none text-gray-800 text-base bg-transparent" />
              </div>
            </div>
          )}

          <div className="mb-8">
            <label className="text-gray-600 text-sm font-medium mb-2 block">Notes</label>
            <div className="border-2 border-gray-200 rounded-2xl px-4 py-3">
              <textarea placeholder="Any notes..." value={wForm.notes}
                onChange={(e) => setWForm({ ...wForm, notes: e.target.value })}
                rows={3} className="w-full outline-none text-gray-800 text-base bg-transparent resize-none" />
            </div>
          </div>

          <button onClick={handleSaveWorker} disabled={saving}
            className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
            style={{ backgroundColor: "#1B5E20" }}>
            {saving ? <Loader2 size={22} className="animate-spin" /> : "Save Worker"}
          </button>
        </div>
      </div>
    );
  }

  // ── Main Screen ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div style={{ backgroundColor: "#1B5E20" }} className="px-4 pt-12 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-white text-xl font-bold">Our Team</h1>
            <p className="text-green-200 text-xs">
              {farmers.length} farmer{farmers.length !== 1 ? "s" : ""} · {workers.length} worker{workers.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => router.push("/workers/attendance")}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-white text-xs font-semibold active:scale-95 transition-transform"
            style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
            <ClipboardList size={15} />
            Attendance
          </button>
        </div>
        {/* Tabs */}
        <div className="flex">
          {(["farmers", "workers"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-3 text-sm font-semibold capitalize transition-all"
              style={{
                color: tab === t ? "white" : "rgba(255,255,255,0.55)",
                borderBottom: tab === t ? "3px solid white" : "3px solid transparent",
              }}>
              {t === "farmers" ? "Farmers" : "Workers"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100" style={{ borderTopColor: "#1B5E20" }} />
          </div>
        ) : tab === "farmers" ? (
          farmers.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "#E8F5E9" }}>
                <Wheat size={36} color="#1B5E20" />
              </div>
              <p className="text-gray-600 font-semibold mb-1">No farmers yet</p>
              <p className="text-gray-400 text-sm">Farmers join via the invite code</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {farmers.map((farmer) => {
                const farmerParcels = parcels.filter((p) => p.assignedFarmer === farmer.id);
                const ini = initials(farmer.displayName || farmer.email || "?");
                return (
                  <button key={farmer.id}
                    onClick={() => router.push(`/workers/farmer/${farmer.id}`)}
                    className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 w-full text-left active:scale-95 transition-transform">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-base"
                      style={{ backgroundColor: "#1B5E20" }}>
                      {ini}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-base truncate">{farmer.displayName || "Unnamed"}</p>
                      <p className="text-gray-500 text-xs truncate">
                        {farmerParcels.length > 0
                          ? farmerParcels.map((p) => p.name).join(", ")
                          : "No parcel assigned"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ backgroundColor: "#E8F5E9", color: "#1B5E20" }}>
                        Active
                      </span>
                      <ChevronRight size={16} color="#9CA3AF" />
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          workers.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "#E8F5E9" }}>
                <User size={36} color="#1B5E20" />
              </div>
              <p className="text-gray-600 font-semibold mb-1">No workers yet</p>
              <p className="text-gray-400 text-sm mb-6">Add daily or monthly workers</p>
              {canEdit && (
                <button onClick={() => setShowAddWorker(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold active:scale-95 transition-transform"
                  style={{ backgroundColor: "#1B5E20" }}>
                  <Plus size={18} /> Add First Worker
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {workers.map((worker) => {
                const dot = getAttendanceDot(worker.id);
                const isDaily = worker.workerType === "daily";
                const ini = initials(worker.name);
                return (
                  <button key={worker.id}
                    onClick={() => router.push(`/workers/worker/${worker.id}`)}
                    className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 w-full text-left active:scale-95 transition-transform">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base"
                        style={{ backgroundColor: isDaily ? "#1565C0" : "#6A1B9A" }}>
                        {ini}
                      </div>
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white"
                        style={{ backgroundColor: dot }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-base truncate">{worker.name}</p>
                      <p className="text-gray-500 text-xs">
                        {isDaily ? `Rs. ${(worker.dailyRate || 0).toLocaleString("en-PK")}/day` : `Rs. ${(worker.monthlySalary || 0).toLocaleString("en-PK")}/month`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: isDaily ? "#E3F2FD" : "#F3E5F5",
                          color: isDaily ? "#1565C0" : "#6A1B9A",
                        }}>
                        {isDaily ? "Daily" : "Monthly"}
                      </span>
                      <ChevronRight size={16} color="#9CA3AF" />
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Bottom sheet backdrop */}
      {showSheet && (
        <div className="fixed inset-0 z-40 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowSheet(false)}>
          <div className="w-full bg-white rounded-t-3xl p-6 pb-10"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
            <p className="font-bold text-gray-800 text-base mb-4">Add to Team</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setShowSheet(false); setShowAddWorker(true); }}
                className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 active:scale-95 transition-transform">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#E3F2FD" }}>
                  <User size={20} color="#1565C0" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800 text-sm">Invite Worker</p>
                  <p className="text-gray-400 text-xs">Daily or monthly worker</p>
                </div>
              </button>
              <button onClick={() => { setShowSheet(false); router.push("/approvals"); }}
                className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 active:scale-95 transition-transform">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#E8F5E9" }}>
                  <ClipboardList size={20} color="#1B5E20" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800 text-sm">View Join Requests</p>
                  <p className="text-gray-400 text-xs">Approve pending members</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      {canEdit && (
        <button onClick={() => setShowSheet(true)}
          className="fixed bottom-24 right-5 w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{ backgroundColor: "#1B5E20" }}>
          <Plus size={26} color="white" />
        </button>
      )}
    </div>
  );
}
