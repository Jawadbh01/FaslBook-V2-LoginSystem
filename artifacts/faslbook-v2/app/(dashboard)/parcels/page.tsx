"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";
import {
  MapPin, Plus, Search, X, ChevronRight,
  Wheat, User, Edit3, Check,
  Loader2, Map,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────
interface Parcel {
  id: string;
  name: string;
  acres: number;
  location: string;
  assignedFarmer: string;
  assignedFarmerName: string;
  currentCropId: string;
  currentCropName: string;
  status: string;
  organizationId: string;
  createdAt: any;
}

interface Farmer {
  id: string;
  name: string;
  email: string;
}

// ── Status config ──────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "Active",    color: "#1B5E20", bg: "#E8F5E9" },
  fallow:    { label: "Fallow",    color: "#E65100", bg: "#FFF3E0" },
  leased:    { label: "Leased",    color: "#1565C0", bg: "#E3F2FD" },
  inactive:  { label: "Inactive",  color: "#757575", bg: "#F5F5F5" },
};

export default function ParcelsPage() {
  const { organization, role } = useAuthStore();
  const orgId = organization?.id;
  const canEdit = role === "landlord" || role === "manager";

  // ── State ──────────────────────────────────────────────────
  const [parcels, setParcels]   = useState<Parcel[]>([]);
  const [farmers, setFarmers]   = useState<Farmer[]>([]);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [selected, setSelected] = useState<Parcel | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "", acres: "", location: "",
    assignedFarmer: "", status: "active",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // ── Firestore listeners ────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(
      query(
        collection(db, "parcels"),
        where("organizationId", "==", orgId),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        setParcels(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Parcel)));
        setLoading(false);
      }
    ));

    unsubs.push(onSnapshot(
      query(
        collection(db, "users"),
        where("organizationId", "==", orgId),
        where("role", "==", "farmer")
      ),
      (snap) => {
        setFarmers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Farmer)));
      }
    ));

    return () => unsubs.forEach((u) => u());
  }, [orgId]);

  // ── Filtered parcels ───────────────────────────────────────
  const filtered = parcels.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.location?.toLowerCase().includes(search.toLowerCase()) ||
    p.assignedFarmerName?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Save parcel ────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name || !form.acres || !form.location) {
      setFormError("Please fill Farm Name, Acres and Location");
      return;
    }
    if (isNaN(Number(form.acres)) || Number(form.acres) <= 0) {
      setFormError("Acres must be a valid number");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const farmer = farmers.find((f) => f.id === form.assignedFarmer);

      const data = {
        name: form.name.trim(),
        acres: Number(form.acres),
        location: form.location.trim(),
        assignedFarmer: form.assignedFarmer || "",
        assignedFarmerName: farmer?.name || "",
        currentCropId: "",
        currentCropName: "",
        status: form.status,
        organizationId: orgId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        syncStatus: "synced",
      };

      if (selected) {
        await updateDoc(doc(db, "parcels", selected.id), {
          ...data,
          createdAt: selected.createdAt,
        });
      } else {
        await addDoc(collection(db, "parcels"), data);
      }

      setShowAdd(false);
      setSelected(null);
      resetForm();
    } catch (err) {
      setFormError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () =>
    setForm({ name: "", acres: "", location: "", assignedFarmer: "", status: "active" });

  const openEdit = (parcel: Parcel) => {
    setSelected(parcel);
    setForm({
      name: parcel.name,
      acres: String(parcel.acres),
      location: parcel.location,
      assignedFarmer: parcel.assignedFarmer,
      status: parcel.status || "active",
    });
    setShowAdd(true);
  };

  // ── Add/Edit Sheet ─────────────────────────────────────────
  if (showAdd) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div
          className="flex items-center px-4 pt-12 pb-6"
          style={{ backgroundColor: "#1B5E20" }}
        >
          <button
            onClick={() => { setShowAdd(false); setSelected(null); resetForm(); }}
            className="text-white mr-3"
          >
            <X size={24} />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">
              {selected ? "Edit Parcel" : "Add New Parcel"}
            </h1>
            <p className="text-green-200 text-xs">
              {selected ? "Update parcel details" : "Add a new land parcel"}
            </p>
          </div>
        </div>

        <div className="flex-1 px-6 pt-6 pb-10 overflow-y-auto">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">
              {formError}
            </div>
          )}

          {/* Parcel Name */}
          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">
              Parcel Name *
            </label>
            <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
              <MapPin size={20} color="#9E9E9E" className="mr-3 shrink-0" />
              <input
                type="text"
                placeholder="e.g. Green Field, North Plot"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="flex-1 outline-none text-gray-800 text-base bg-transparent"
              />
            </div>
          </div>

          {/* Acres */}
          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">
              Acres *
            </label>
            <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
              <Map size={20} color="#9E9E9E" className="mr-3 shrink-0" />
              <input
                type="number"
                placeholder="e.g. 25.5"
                value={form.acres}
                onChange={(e) => setForm({ ...form, acres: e.target.value })}
                className="flex-1 outline-none text-gray-800 text-base bg-transparent"
              />
              <span className="text-gray-400 text-sm">acres</span>
            </div>
          </div>

          {/* Location */}
          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">
              Location *
            </label>
            <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
              <MapPin size={20} color="#9E9E9E" className="mr-3 shrink-0" />
              <input
                type="text"
                placeholder="Village, Area or GPS location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="flex-1 outline-none text-gray-800 text-base bg-transparent"
              />
            </div>
          </div>

          {/* Assign Farmer */}
          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">
              Assign Farmer (Optional)
            </label>
            <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
              <User size={20} color="#9E9E9E" className="mr-3 shrink-0" />
              <select
                value={form.assignedFarmer}
                onChange={(e) => setForm({ ...form, assignedFarmer: e.target.value })}
                className="flex-1 outline-none text-gray-800 text-base bg-transparent"
              >
                <option value="">No farmer assigned</option>
                {farmers.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            {farmers.length === 0 && (
              <p className="text-gray-400 text-xs mt-1 ml-2">
                No farmers in your team yet. Add farmers first.
              </p>
            )}
          </div>

          {/* Status */}
          <div className="mb-8">
            <label className="text-gray-600 text-sm font-medium mb-3 block">
              Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(statusConfig).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setForm({ ...form, status: key })}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: form.status === key ? val.color : "#E5E7EB",
                    backgroundColor: form.status === key ? val.bg : "white",
                  }}
                >
                  {form.status === key && (
                    <Check size={14} color={val.color} />
                  )}
                  <span
                    className="text-sm font-medium"
                    style={{ color: form.status === key ? val.color : "#6B7280" }}
                  >
                    {val.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: "#1B5E20" }}
          >
            {saving
              ? <Loader2 size={22} className="animate-spin" />
              : selected ? "Update Parcel" : "Save Parcel"
            }
          </button>
        </div>
      </div>
    );
  }

  // ── Main List ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div
        className="px-4 pt-12 pb-5"
        style={{ backgroundColor: "#1B5E20" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-white text-xl font-bold">My Land</h1>
            <p className="text-green-200 text-xs">
              {parcels.length} parcel{parcels.length !== 1 ? "s" : ""} •{" "}
              {parcels.reduce((s, p) => s + (p.acres || 0), 0).toFixed(1)} total acres
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowAdd(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              <Plus size={22} color="white" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center bg-white rounded-2xl px-4 py-3 gap-3">
          <Search size={18} color="#9E9E9E" />
          <input
            type="text"
            placeholder="Search parcels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 outline-none text-gray-800 text-sm bg-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X size={16} color="#9E9E9E" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center pt-20">
            <div
              className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100"
              style={{ borderTopColor: "#1B5E20" }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: "#E8F5E9" }}
            >
              <MapPin size={36} color="#1B5E20" />
            </div>
            <p className="text-gray-600 font-semibold mb-2">
              {search ? "No parcels found" : "No parcels yet"}
            </p>
            <p className="text-gray-400 text-sm mb-6">
              {search
                ? "Try a different search term"
                : "Add your first land parcel to get started"
              }
            </p>
            {canEdit && !search && (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold"
                style={{ backgroundColor: "#1B5E20" }}
              >
                <Plus size={18} />
                Add First Parcel
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((parcel) => {
              const sc = statusConfig[parcel.status] || statusConfig.active;
              return (
                <div
                  key={parcel.id}
                  className="bg-white rounded-2xl p-4 shadow-sm"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "#E8F5E9" }}
                      >
                        <MapPin size={22} color="#1B5E20" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-base">
                          {parcel.name}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {parcel.location}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="px-3 py-1 rounded-full"
                        style={{ backgroundColor: sc.bg }}
                      >
                        <span
                          className="text-xs font-bold"
                          style={{ color: sc.color }}
                        >
                          {sc.label}
                        </span>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => openEdit(parcel)}
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: "#F5F5F5" }}
                        >
                          <Edit3 size={14} color="#757575" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div
                      className="rounded-xl p-2 text-center"
                      style={{ backgroundColor: "#F1F8E9" }}
                    >
                      <p className="text-green-800 font-bold text-sm">
                        {parcel.acres}
                      </p>
                      <p className="text-green-600 text-xs">Acres</p>
                    </div>
                    <div
                      className="rounded-xl p-2 text-center"
                      style={{ backgroundColor: "#F5F5F5" }}
                    >
                      <p className="text-gray-800 font-bold text-xs truncate">
                        {parcel.assignedFarmerName || "—"}
                      </p>
                      <p className="text-gray-500 text-xs">Farmer</p>
                    </div>
                    <div
                      className="rounded-xl p-2 text-center"
                      style={{ backgroundColor: "#FFF3E0" }}
                    >
                      <p className="text-orange-800 font-bold text-xs truncate">
                        {parcel.currentCropName || "—"}
                      </p>
                      <p className="text-orange-600 text-xs">Crop</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Wheat size={14} color="#9E9E9E" />
                      <span className="text-gray-400 text-xs">
                        {parcel.currentCropName
                          ? `Growing: ${parcel.currentCropName}`
                          : "No active crop"
                        }
                      </span>
                    </div>
                    <button className="flex items-center gap-1 text-xs font-medium" style={{ color: "#1B5E20" }}>
                      Details
                      <ChevronRight size={14} color="#1B5E20" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      {canEdit && parcels.length > 0 && (
        <button
          onClick={() => setShowAdd(true)}
          className="fixed bottom-24 right-5 w-14 h-14 rounded-full shadow-lg flex items-center justify-center"
          style={{ backgroundColor: "#1B5E20" }}
        >
          <Plus size={26} color="white" />
        </button>
      )}
    </div>
  );
}
