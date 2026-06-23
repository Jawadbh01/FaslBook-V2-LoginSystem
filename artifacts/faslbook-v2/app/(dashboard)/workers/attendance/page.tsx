"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, getDocs, serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";
import { useAuthStore } from "@/store/authStore";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface Worker {
  id: string;
  name: string;
  workerType: "daily" | "monthly";
  dailyRate?: number;
  monthlySalary?: number;
  status: string;
  organizationId: string;
}

type AttStatus = "present" | "halfDay" | "absent" | null;

interface AttRow {
  workerId: string;
  workerName: string;
  status: AttStatus;
  existingDocId?: string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function fmt(d: Date) {
  return `${DAYS_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function AttendancePage() {
  const router = useRouter();
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  const [date, setDate] = useState(new Date());
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [rows, setRows] = useState<AttRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load workers
  useEffect(() => {
    if (!orgId) return;
    const unsub = onSnapshot(
      query(collection(db, "workers"), where("organizationId", "==", orgId), where("status", "==", "active")),
      (snap) => {
        setWorkers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Worker)));
        setLoading(false);
      }
    );
    return () => unsub();
  }, [orgId]);

  // Load existing attendance for selected date
  const loadAttendance = useCallback(async (d: Date) => {
    if (!orgId || workers.length === 0) return;
    const ds = toDateStr(d);
    const snap = await getDocs(
      query(collection(db, "attendance"),
        where("organizationId", "==", orgId),
        where("date", "==", ds)
      )
    );
    const existing: Record<string, { status: AttStatus; docId: string }> = {};
    snap.docs.forEach((doc) => {
      const data = doc.data();
      existing[data.workerId] = { status: data.status as AttStatus, docId: doc.id };
    });
    setRows(workers.map((w) => ({
      workerId: w.id,
      workerName: w.name,
      status: existing[w.id]?.status ?? null,
      existingDocId: existing[w.id]?.docId,
    })));
  }, [orgId, workers]);

  useEffect(() => { loadAttendance(date); }, [date, workers]);

  const setStatus = (workerId: string, status: AttStatus) => {
    setRows((prev) => prev.map((r) => r.workerId === workerId ? { ...r, status } : r));
  };

  const handleSave = async () => {
    const ds = toDateStr(date);
    try {
      setSaving(true);
      for (const row of rows) {
        if (!row.status) continue;
        const payload = {
          workerId: row.workerId,
          workerName: row.workerName,
          date: ds,
          status: row.status,
          organizationId: orgId,
          markedBy: auth.currentUser?.uid || "",
          updatedAt: serverTimestamp(),
          syncStatus: "synced",
        };
        if (row.existingDocId) {
          await updateDoc(doc(db, "attendance", row.existingDocId), payload);
        } else {
          const ref = await addDoc(collection(db, "attendance"), { ...payload, createdAt: serverTimestamp() });
          setRows((prev) => prev.map((r) => r.workerId === row.workerId ? { ...r, existingDocId: ref.id } : r));
        }
      }
      await addDoc(collection(db, "activityLogs"), {
        organizationId: orgId,
        userId: auth.currentUser?.uid || "",
        userName: auth.currentUser?.displayName || "",
        action: "ATTENDANCE_MARKED",
        description: `Attendance marked for ${ds}`,
        createdAt: serverTimestamp(),
        syncStatus: "synced",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const prevDay = () => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d); };
  const nextDay = () => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d); };

  const btnStyle = (active: boolean, color: string, bg: string) => ({
    width: 36, height: 36,
    borderRadius: 10,
    border: `2px solid ${active ? color : "#E5E7EB"}`,
    backgroundColor: active ? bg : "white",
    color: active ? color : "#9CA3AF",
    fontWeight: 700,
    fontSize: 13,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    cursor: "pointer",
    transition: "all 0.15s",
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div style={{ backgroundColor: "#1B5E20" }} className="px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="text-white active:scale-95">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">Attendance</h1>
            <p className="text-green-200 text-xs">{workers.length} active workers</p>
          </div>
        </div>
        {/* Date selector */}
        <div className="flex items-center justify-between bg-white bg-opacity-15 rounded-2xl px-4 py-3">
          <button onClick={prevDay} className="text-white active:scale-95 p-1">
            <ChevronLeft size={20} />
          </button>
          <p className="text-white font-semibold text-sm">{fmt(date)}</p>
          <button onClick={nextDay} className="text-white active:scale-95 p-1">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-3">
        {[
          { label: "Present", color: "#1B5E20", bg: "#E8F5E9", letter: "P" },
          { label: "Half Day", color: "#E65100", bg: "#FFF3E0", letter: "H" },
          { label: "Absent", color: "#C62828", bg: "#FFEBEE", letter: "A" },
        ].map(({ label, color, bg, letter }) => (
          <div key={letter} className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: bg, color }}>
              {letter}
            </div>
            <span className="text-gray-500 text-xs">{label}</span>
          </div>
        ))}
      </div>

      {/* Worker rows */}
      <div className="px-4 flex flex-col gap-2">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100" style={{ borderTopColor: "#1B5E20" }} />
          </div>
        ) : workers.length === 0 ? (
          <div className="text-center pt-16">
            <p className="text-gray-500 font-medium">No active workers found</p>
            <p className="text-gray-400 text-sm mt-1">Add workers in the Team tab first</p>
          </div>
        ) : (
          rows.map((row) => {
            const worker = workers.find((w) => w.id === row.workerId);
            const ini = row.workerName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
            const isDaily = worker?.workerType === "daily";
            return (
              <div key={row.workerId} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: isDaily ? "#1565C0" : "#6A1B9A" }}>
                  {ini}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{row.workerName}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: isDaily ? "#E3F2FD" : "#F3E5F5",
                      color: isDaily ? "#1565C0" : "#6A1B9A",
                    }}>
                    {isDaily ? "Daily" : "Monthly"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    style={btnStyle(row.status === "present", "#1B5E20", "#E8F5E9")}
                    onClick={() => setStatus(row.workerId, row.status === "present" ? null : "present")}>
                    P
                  </button>
                  <button
                    style={btnStyle(row.status === "halfDay", "#E65100", "#FFF3E0")}
                    onClick={() => setStatus(row.workerId, row.status === "halfDay" ? null : "halfDay")}>
                    H
                  </button>
                  <button
                    style={btnStyle(row.status === "absent", "#C62828", "#FFEBEE")}
                    onClick={() => setStatus(row.workerId, row.status === "absent" ? null : "absent")}>
                    A
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Save button */}
      {workers.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4">
          <button onClick={handleSave} disabled={saving}
            className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 active:scale-95 transition-transform"
            style={{ backgroundColor: saved ? "#2E7D32" : "#1B5E20" }}>
            {saving
              ? <Loader2 size={22} className="animate-spin" />
              : saved ? "✓ Saved!" : "Save All"}
          </button>
        </div>
      )}
    </div>
  );
}
