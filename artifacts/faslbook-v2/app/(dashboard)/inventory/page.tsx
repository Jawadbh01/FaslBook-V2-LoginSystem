"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, increment,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";
import { runFarmerTransferWorkflow } from "@/lib/workflows/farmerTransferWorkflow";
import { categoryConfig } from "./_categoryConfig";
import {
  Warehouse, Plus, X, ArrowDownToLine, ArrowUpFromLine,
  Users, Loader2, CheckCircle, Package, ChevronRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────
interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  pricePerUnit: number;
  organizationId: string;
  createdAt: any;
  updatedAt: any;
}

interface Farmer {
  id: string;
  name: string;
}

const categories = ["all", ...Object.keys(categoryConfig)];
const units = ["Maund", "KG", "Ton", "Quintal", "Bag", "Litre", "Piece", "Other"];
const stockInSources = ["Purchase", "Adjustment", "Transfer"];

type View = "list" | "addItem" | "stockIn" | "transfer";

export default function GodownPage() {
  const { organization, role } = useAuthStore();
  const orgId = organization?.id;
  const canEdit = role === "landlord" || role === "manager";

  // ── State ──────────────────────────────────────────────────
  const [items, setItems]       = useState<InventoryItem[]>([]);
  const [farmers, setFarmers]   = useState<Farmer[]>([]);
  const [filter, setFilter]     = useState("all");
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<View>("list");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState(false);
  const [formError, setFormError] = useState("");

  // Add Item form
  const [itemForm, setItemForm] = useState({
    name: "", category: "seed", unit: "Maund",
    initialStock: "", pricePerUnit: "",
  });

  // Stock In form
  const [inForm, setInForm] = useState({
    quantity: "", source: "Purchase", notes: "",
  });

  // Farmer Transfer form
  const [txForm, setTxForm] = useState({
    farmerId: "", quantity: "", notes: "",
  });

  // ── Listeners ──────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(
      query(collection(db, "inventoryItems"), where("organizationId", "==", orgId)),
      (snap) => {
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as InventoryItem))
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setItems(data);
        setLoading(false);
      }
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "users"), where("organizationId", "==", orgId), where("role", "==", "farmer")),
      (snap) => {
        setFarmers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Farmer)));
      }
    ));

    return () => unsubs.forEach((u) => u());
  }, [orgId]);

  const filtered = filter === "all" ? items : items.filter((i) => i.category === filter);

  const resetAll = () => {
    setItemForm({ name: "", category: "seed", unit: "Maund", initialStock: "", pricePerUnit: "" });
    setInForm({ quantity: "", source: "Purchase", notes: "" });
    setTxForm({ farmerId: "", quantity: "", notes: "" });
    setFormError("");
    setSuccess(false);
    setSelected(null);
  };

  const goBack = () => { setView("list"); resetAll(); };

  // ── Add Item ───────────────────────────────────────────────
  const handleAddItem = async () => {
    if (!itemForm.name.trim()) { setFormError("Enter item name"); return; }
    try {
      setSaving(true); setFormError("");
      const ref = await addDoc(collection(db, "inventoryItems"), {
        name: itemForm.name.trim(),
        category: itemForm.category,
        unit: itemForm.unit,
        currentStock: Number(itemForm.initialStock) || 0,
        pricePerUnit: Number(itemForm.pricePerUnit) || 0,
        organizationId: orgId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        syncStatus: "synced",
      });
      if (Number(itemForm.initialStock) > 0) {
        await addDoc(collection(db, "inventoryTransactions"), {
          organizationId: orgId,
          itemId: ref.id,
          itemName: itemForm.name.trim(),
          type: "in",
          source: "Adjustment",
          quantity: Number(itemForm.initialStock),
          unit: itemForm.unit,
          notes: "Opening stock",
          createdBy: auth.currentUser?.uid || "",
          createdAt: serverTimestamp(),
          syncStatus: "synced",
        });
      }
      await addDoc(collection(db, "activityLogs"), {
        organizationId: orgId,
        userId: auth.currentUser?.uid || "",
        userName: auth.currentUser?.displayName || "",
        action: "ITEM_ADDED",
        description: `Added ${itemForm.name.trim()} to Godown`,
        recordId: ref.id,
        recordType: "inventoryItems",
        createdAt: serverTimestamp(),
        syncStatus: "synced",
      });
      goBack();
    } catch { setFormError("Failed to add item. Try again."); }
    finally { setSaving(false); }
  };

  // ── Stock In ───────────────────────────────────────────────
  const handleStockIn = async () => {
    if (!inForm.quantity || Number(inForm.quantity) <= 0) {
      setFormError("Enter a valid quantity"); return;
    }
    if (!selected) return;
    try {
      setSaving(true); setFormError("");
      await updateDoc(doc(db, "inventoryItems", selected.id), {
        currentStock: increment(Number(inForm.quantity)),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "inventoryTransactions"), {
        organizationId: orgId,
        itemId: selected.id,
        itemName: selected.name,
        type: "in",
        source: inForm.source,
        quantity: Number(inForm.quantity),
        unit: selected.unit,
        notes: inForm.notes,
        createdBy: auth.currentUser?.uid || "",
        createdAt: serverTimestamp(),
        syncStatus: "synced",
      });
      await addDoc(collection(db, "activityLogs"), {
        organizationId: orgId,
        userId: auth.currentUser?.uid || "",
        userName: auth.currentUser?.displayName || "",
        action: "STOCK_IN",
        description: `Added ${inForm.quantity} ${selected.unit} of ${selected.name} (${inForm.source})`,
        recordId: selected.id,
        recordType: "inventoryItems",
        createdAt: serverTimestamp(),
        syncStatus: "synced",
      });
      setSuccess(true);
    } catch { setFormError("Failed to update stock. Try again."); }
    finally { setSaving(false); }
  };

  // ── Farmer Transfer ────────────────────────────────────────
  const handleTransfer = async () => {
    if (!txForm.farmerId) { setFormError("Select a farmer"); return; }
    if (!txForm.quantity || Number(txForm.quantity) <= 0) {
      setFormError("Enter a valid quantity"); return;
    }
    if (!selected) return;
    if (Number(txForm.quantity) > selected.currentStock) {
      setFormError(`Only ${selected.currentStock} ${selected.unit} available in Godown`); return;
    }
    const farmer = farmers.find((f) => f.id === txForm.farmerId);
    try {
      setSaving(true); setFormError("");
      await runFarmerTransferWorkflow({
        itemId: selected.id,
        itemName: selected.name,
        unit: selected.unit,
        quantity: Number(txForm.quantity),
        farmerId: txForm.farmerId,
        farmerName: farmer?.name || "",
        organizationId: orgId!,
        notes: txForm.notes,
      });
      setSuccess(true);
    } catch { setFormError("Transfer failed. Try again."); }
    finally { setSaving(false); }
  };

  // ── Success Screen ─────────────────────────────────────────
  if (success) {
    const isTransfer = view === "transfer";
    const farmer = farmers.find((f) => f.id === txForm.farmerId);
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg" style={{ backgroundColor: "#E8F5E9" }}>
          <CheckCircle size={52} color="#1B5E20" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {isTransfer ? "Transfer Done! 📦" : "Stock Updated! ✅"}
        </h1>
        {isTransfer ? (
          <>
            <p className="text-gray-500 text-sm mb-1">{txForm.quantity} {selected?.unit} of {selected?.name}</p>
            <p className="text-gray-400 text-xs mb-8">transferred to {farmer?.name}</p>
            <div className="w-full rounded-2xl p-4 mb-6 text-left" style={{ backgroundColor: "#E8F5E9" }}>
              <p className="text-green-800 text-sm font-semibold mb-2">✅ Updated automatically:</p>
              <p className="text-green-700 text-xs mb-1">• Godown stock reduced by {txForm.quantity} {selected?.unit}</p>
              <p className="text-green-700 text-xs mb-1">• {farmer?.name} stock increased</p>
              <p className="text-green-700 text-xs mb-1">• Inventory transaction created</p>
              <p className="text-green-700 text-xs">• Activity log updated</p>
            </div>
          </>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-1">{inForm.quantity} {selected?.unit} added to {selected?.name}</p>
            <p className="text-gray-400 text-xs mb-8">Source: {inForm.source}</p>
          </>
        )}
        <button onClick={goBack} className="w-full py-4 rounded-2xl text-white font-bold text-base active:scale-95 transition-transform" style={{ backgroundColor: "#1B5E20" }}>
          Back to Godown
        </button>
      </div>
    );
  }

  // ── Add Item Form ──────────────────────────────────────────
  if (view === "addItem") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex items-center px-4 pt-12 pb-6" style={{ backgroundColor: "#1B5E20" }}>
          <button onClick={goBack} className="text-white mr-3"><X size={24} /></button>
          <div>
            <h1 className="text-white text-xl font-bold">Add Item</h1>
            <p className="text-green-200 text-xs">New Godown Item</p>
          </div>
        </div>
        <div className="flex-1 px-6 pt-6 pb-10 overflow-y-auto">
          {formError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">{formError}</div>}

          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">Item Name *</label>
            <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
              <Package size={20} color="#9E9E9E" className="mr-3 shrink-0" />
              <input type="text" placeholder="e.g. DAP Fertilizer" value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                className="flex-1 outline-none text-gray-800 text-base bg-transparent" />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(categoryConfig).map(([key, cfg]) => (
                <button key={key} onClick={() => setItemForm({ ...itemForm, category: key })}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all"
                  style={{
                    borderColor: itemForm.category === key ? cfg.color : "#E5E7EB",
                    backgroundColor: itemForm.category === key ? cfg.bg : "white",
                    color: itemForm.category === key ? cfg.color : "#6B7280",
                  }}>
                  <cfg.Icon size={16} />
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">Unit</label>
            <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
              <select value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                className="flex-1 outline-none text-gray-800 text-base bg-transparent">
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div>
              <label className="text-gray-600 text-sm font-medium mb-2 block">Opening Stock</label>
              <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
                <input type="number" placeholder="0" value={itemForm.initialStock}
                  onChange={(e) => setItemForm({ ...itemForm, initialStock: e.target.value })}
                  className="flex-1 outline-none text-gray-800 text-base bg-transparent" />
              </div>
            </div>
            <div>
              <label className="text-gray-600 text-sm font-medium mb-2 block">Price / Unit</label>
              <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
                <input type="number" placeholder="0" value={itemForm.pricePerUnit}
                  onChange={(e) => setItemForm({ ...itemForm, pricePerUnit: e.target.value })}
                  className="flex-1 outline-none text-gray-800 text-base bg-transparent" />
              </div>
            </div>
          </div>

          <button onClick={handleAddItem} disabled={saving}
            className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
            style={{ backgroundColor: "#1B5E20" }}>
            {saving ? <Loader2 size={22} className="animate-spin" /> : "Add to Godown 📦"}
          </button>
        </div>
      </div>
    );
  }

  // ── Stock In Form ──────────────────────────────────────────
  if (view === "stockIn" && selected) {
    const cc = categoryConfig[selected.category] || categoryConfig.other;
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex items-center px-4 pt-12 pb-6" style={{ backgroundColor: "#1B5E20" }}>
          <button onClick={goBack} className="text-white mr-3"><X size={24} /></button>
          <div>
            <h1 className="text-white text-xl font-bold">Stock In</h1>
            <p className="text-green-200 text-xs">{selected.name} • Current: {selected.currentStock} {selected.unit}</p>
          </div>
        </div>
        <div className="flex-1 px-6 pt-6 pb-10 overflow-y-auto">
          {formError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">{formError}</div>}

          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-3 block">Source</label>
            <div className="flex gap-3">
              {stockInSources.map((s) => (
                <button key={s} onClick={() => setInForm({ ...inForm, source: s })}
                  className="flex-1 py-3 rounded-xl border-2 font-medium text-sm transition-all"
                  style={{
                    borderColor: inForm.source === s ? "#1B5E20" : "#E5E7EB",
                    backgroundColor: inForm.source === s ? "#E8F5E9" : "white",
                    color: inForm.source === s ? "#1B5E20" : "#6B7280",
                  }}>{s}</button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">Quantity ({selected.unit}) *</label>
            <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
              <ArrowDownToLine size={20} color="#9E9E9E" className="mr-3 shrink-0" />
              <input type="number" placeholder="e.g. 100" value={inForm.quantity}
                onChange={(e) => setInForm({ ...inForm, quantity: e.target.value })}
                className="flex-1 outline-none text-gray-800 text-base bg-transparent" />
              <span className="text-gray-400 text-sm">{selected.unit}</span>
            </div>
          </div>

          <div className="mb-8">
            <label className="text-gray-600 text-sm font-medium mb-2 block">Notes (Optional)</label>
            <div className="border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
              <textarea placeholder="Supplier name, bill number etc..." value={inForm.notes}
                onChange={(e) => setInForm({ ...inForm, notes: e.target.value })}
                rows={3} className="w-full outline-none text-gray-800 text-base bg-transparent resize-none" />
            </div>
          </div>

          <button onClick={handleStockIn} disabled={saving}
            className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
            style={{ backgroundColor: "#1B5E20" }}>
            {saving ? <Loader2 size={22} className="animate-spin" /> : "Add Stock ✅"}
          </button>
        </div>
      </div>
    );
  }

  // ── Farmer Transfer Form ───────────────────────────────────
  if (view === "transfer" && selected) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex items-center px-4 pt-12 pb-6" style={{ backgroundColor: "#1B5E20" }}>
          <button onClick={goBack} className="text-white mr-3"><X size={24} /></button>
          <div>
            <h1 className="text-white text-xl font-bold">Transfer to Farmer</h1>
            <p className="text-green-200 text-xs">{selected.name} • Available: {selected.currentStock} {selected.unit}</p>
          </div>
        </div>
        <div className="flex-1 px-6 pt-6 pb-10 overflow-y-auto">
          {formError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">{formError}</div>}

          <div className="rounded-2xl p-4 mb-5 flex items-center gap-3" style={{ backgroundColor: "#E8F5E9" }}>
            <Package size={22} color="#1B5E20" />
            <div>
              <p className="text-green-800 font-semibold text-sm">Godown → Farmer</p>
              <p className="text-green-700 text-xs">Stock moves automatically with full history</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">Select Farmer *</label>
            <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
              <Users size={20} color="#9E9E9E" className="mr-3 shrink-0" />
              <select value={txForm.farmerId} onChange={(e) => setTxForm({ ...txForm, farmerId: e.target.value })}
                className="flex-1 outline-none text-gray-800 text-base bg-transparent">
                <option value="">Select farmer</option>
                {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            {farmers.length === 0 && <p className="text-gray-400 text-xs mt-1 ml-2">No farmers in your organization yet.</p>}
          </div>

          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">Quantity ({selected.unit}) *</label>
            <div className="flex items-center border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
              <ArrowUpFromLine size={20} color="#9E9E9E" className="mr-3 shrink-0" />
              <input type="number" placeholder={`Max: ${selected.currentStock}`} value={txForm.quantity}
                onChange={(e) => setTxForm({ ...txForm, quantity: e.target.value })}
                className="flex-1 outline-none text-gray-800 text-base bg-transparent" />
              <span className="text-gray-400 text-sm">{selected.unit}</span>
            </div>
          </div>

          <div className="mb-8">
            <label className="text-gray-600 text-sm font-medium mb-2 block">Notes (Optional)</label>
            <div className="border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-700">
              <textarea placeholder="Reason, crop name, parcel etc..." value={txForm.notes}
                onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                rows={3} className="w-full outline-none text-gray-800 text-base bg-transparent resize-none" />
            </div>
          </div>

          <button onClick={handleTransfer} disabled={saving}
            className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
            style={{ backgroundColor: "#1B5E20" }}>
            {saving ? <Loader2 size={22} className="animate-spin" /> : "Transfer Stock 📦"}
          </button>
        </div>
      </div>
    );
  }

  // ── Main List ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="px-4 pt-12 pb-4" style={{ backgroundColor: "#1B5E20" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-white text-xl font-bold">Godown</h1>
            <p className="text-green-200 text-xs">{items.length} item{items.length !== 1 ? "s" : ""} in stock</p>
          </div>
          {canEdit && (
            <button onClick={() => setView("addItem")}
              className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
              <Plus size={22} color="white" />
            </button>
          )}
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((c) => {
            const cc = categoryConfig[c];
            const isActive = filter === c;
            return (
              <button key={c} onClick={() => setFilter(c)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
                style={{
                  backgroundColor: isActive ? "white" : "rgba(255,255,255,0.2)",
                  color: isActive ? (cc?.color || "#1B5E20") : "white",
                }}>
                {c === "all" ? "All" : cc?.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center pt-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100" style={{ borderTopColor: "#1B5E20" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "#E8F5E9" }}>
              <Warehouse size={36} color="#1B5E20" />
            </div>
            <p className="text-gray-600 font-semibold mb-2">
              {filter === "all" ? "Godown is empty" : `No ${categoryConfig[filter]?.label} items`}
            </p>
            <p className="text-gray-400 text-sm mb-6">
              {filter === "all" ? "Add your first item to get started" : "Try a different category"}
            </p>
            {canEdit && filter === "all" && (
              <button onClick={() => setView("addItem")}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold active:scale-95 transition-transform"
                style={{ backgroundColor: "#1B5E20" }}>
                <Plus size={18} />Add First Item
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((item) => {
              const cc = categoryConfig[item.category] || categoryConfig.other;
              const isLow = item.currentStock <= 10;
              return (
                <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: cc.bg }}>
                        <cc.Icon size={22} color={cc.color} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-base">{item.name}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: cc.bg, color: cc.color }}>
                          {cc.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg" style={{ color: isLow ? "#B71C1C" : "#1B5E20" }}>
                        {item.currentStock}
                      </p>
                      <p className="text-gray-400 text-xs">{item.unit}</p>
                      {isLow && <p className="text-red-500 text-xs font-semibold">Low Stock</p>}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setSelected(item); setView("stockIn"); }}
                        className="flex-1 py-2.5 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                        style={{ borderColor: "#1B5E20", color: "#1B5E20" }}>
                        <ArrowDownToLine size={14} />Stock In
                      </button>
                      <button
                        onClick={() => { setSelected(item); setView("transfer"); }}
                        className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                        style={{ backgroundColor: "#1B5E20" }}>
                        <Users size={14} />Transfer
                      </button>
                      <button
                        onClick={() => window.location.href = `/inventory/${item.id}`}
                        className="w-10 h-10 rounded-xl flex items-center justify-center border-2 border-gray-100 active:scale-95 transition-transform">
                        <ChevronRight size={18} color="#9E9E9E" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canEdit && items.length > 0 && (
        <button onClick={() => setView("addItem")}
          className="fixed bottom-24 right-5 w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{ backgroundColor: "#1B5E20" }}>
          <Plus size={26} color="white" />
        </button>
      )}
    </div>
  );
}
