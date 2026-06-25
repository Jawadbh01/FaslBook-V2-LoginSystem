"use client";

import { useEffect, useRef, useState } from "react";
import { Cloud, CloudOff, CloudLightning, RefreshCw, X } from "lucide-react";

const LAST_SYNC_KEY = "faslbook_last_sync";

function fmtSyncTime(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  if (diff < 60000)  return "Just now";
  if (mins < 60)     return `${mins}m ago`;
  if (hrs  < 24)     return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString("en-PK");
}

export default function SyncIndicator({ iconColor = "#1B5E20" }: { iconColor?: string }) {
  const [online, setOnline]         = useState(true);
  const [lastSync, setLastSync]     = useState<number | null>(null);
  const [open, setOpen]             = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [tick, setTick]             = useState(0);
  const ref                         = useRef<HTMLDivElement>(null);

  // Load last sync from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(LAST_SYNC_KEY);
    if (saved) setLastSync(Number(saved));
  }, []);

  // Track online/offline
  useEffect(() => {
    const markOnline = () => {
      setOnline(true);
      const now = Date.now();
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      setLastSync(now);
    };
    const markOffline = () => setOnline(false);

    window.addEventListener("online",  markOnline);
    window.addEventListener("offline", markOffline);
    setOnline(navigator.onLine);
    if (navigator.onLine && !localStorage.getItem(LAST_SYNC_KEY)) {
      const now = Date.now();
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      setLastSync(now);
    }
    return () => {
      window.removeEventListener("online",  markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  // Refresh "X ago" label every 30s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSyncNow = async () => {
    if (!online || syncing) return;
    setSyncing(true);
    // Firestore offline cache syncs automatically when online;
    // triggering a lightweight read forces a round-trip
    try {
      const { getFirestore, collection, getDocs, limit, query } = await import("firebase/firestore");
      const db = getFirestore();
      await getDocs(query(collection(db, "organizations"), limit(1)));
    } catch { /* ignore */ }
    const now = Date.now();
    localStorage.setItem(LAST_SYNC_KEY, String(now));
    setLastSync(now);
    setSyncing(false);
    setTick(t => t + 1);
  };

  const CloudIcon = online ? (syncing ? CloudLightning : Cloud) : CloudOff;
  const cloudColor = online ? iconColor : "#E65100";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Sync status"
        className="p-2 rounded-full transition-colors hover:bg-white/10"
      >
        <CloudIcon
          size={20}
          color={cloudColor}
          className={syncing ? "animate-pulse" : ""}
        />
        {!online && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500 border border-white" />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 w-60 rounded-2xl shadow-xl border border-gray-100 bg-white z-50 overflow-hidden"
          style={{ minWidth: 220 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="font-bold text-sm text-gray-800">Sync Status</span>
            <button onClick={() => setOpen(false)} className="p-0.5 rounded-full hover:bg-gray-100">
              <X size={14} color="#9E9E9E" />
            </button>
          </div>

          {/* Status row */}
          <div className="px-4 py-3 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: online ? "#E8F5E9" : "#FFF3E0" }}
            >
              <CloudIcon size={18} color={cloudColor} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {online ? "Connected" : "Offline"}
              </p>
              <p className="text-xs text-gray-400">
                {online
                  ? "Data syncing in real-time"
                  : "Changes saved locally"}
              </p>
            </div>
          </div>

          {/* Last sync */}
          <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500">Last synced</span>
            <span className="text-xs font-semibold text-gray-700">
              {fmtSyncTime(lastSync)}
            </span>
          </div>

          {/* Sync now button */}
          <div className="px-4 pb-4">
            <button
              onClick={handleSyncNow}
              disabled={!online || syncing}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: "#1B5E20", color: "white" }}
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
