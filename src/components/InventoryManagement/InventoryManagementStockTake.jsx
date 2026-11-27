import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  FaBarcode, FaPlus, FaCheckCircle, FaTimesCircle, FaBan,
  FaClipboardCheck, FaSyncAlt, FaTrash, FaHistory,
} from "react-icons/fa";

const API_BASE = `${APP_API_URL}`;

const cn = (...a) => a.filter(Boolean).join(" ");

function authHeaders(extra = {}) {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: authHeaders({ "Content-Type": "application/json", ...(opts.headers || {}) }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Request failed");
  return data;
}

const INP = "w-full bg-slate-100 rounded-xl px-3 py-2.5 text-sm text-slate-900 border border-blue-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 outline-none placeholder:text-slate-400";

export default function InventoryManagementStockTake() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [newScope, setNewScope] = useState({ division: "", section: "", department: "", note: "" });
  const [barcode, setBarcode] = useState("");
  const [scanError, setScanError] = useState("");
  const [posting, setPosting] = useState(false);
  const barcodeRef = useRef(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await api("/stock-take/sessions");
      setSessions(data.data || []);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const openSession = sessions.find((s) => s.status === "open" && (!activeSession || s.id === activeSession.id));

  const loadDetail = useCallback(async (sessionId) => {
    setLoading(true);
    try {
      const data = await api(`/stock-take/sessions/${sessionId}`);
      setActiveSession(data.session);
      setLines(data.lines || []);
    } catch (e) {
      setScanError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (openSession && !activeSession) loadDetail(openSession.id);
  }, [openSession, activeSession, loadDetail]);

  const startSession = async () => {
    setStarting(true);
    setScanError("");
    try {
      const data = await api("/stock-take/sessions", { method: "POST", body: JSON.stringify(newScope) });
      await loadSessions();
      await loadDetail(data.id);
      setNewScope({ division: "", section: "", department: "", note: "" });
    } catch (e) {
      setScanError(e.message);
    } finally {
      setStarting(false);
    }
  };

  const scan = async (e) => {
    e?.preventDefault();
    if (!activeSession || !barcode.trim()) return;
    setScanError("");
    try {
      await api(`/stock-take/sessions/${activeSession.id}/scan`, { method: "POST", body: JSON.stringify({ barcode: barcode.trim(), qty: 1 }) });
      setBarcode("");
      await loadDetail(activeSession.id);
    } catch (e) {
      setScanError(e.message);
    } finally {
      barcodeRef.current?.focus();
    }
  };

  const updateCounted = async (line, value) => {
    const qty = Number(value);
    if (!Number.isFinite(qty) || qty < 0) return;
    try {
      await api(`/stock-take/sessions/${activeSession.id}/lines/${line.id}`, { method: "PATCH", body: JSON.stringify({ counted_qty: qty }) });
      setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, counted_qty: qty, variance: Math.round((qty - l.system_qty) * 1000) / 1000 } : l)));
    } catch (e) {
      setScanError(e.message);
    }
  };

  const removeLine = async (line) => {
    try {
      await api(`/stock-take/sessions/${activeSession.id}/lines/${line.id}`, { method: "DELETE" });
      setLines((prev) => prev.filter((l) => l.id !== line.id));
    } catch (e) {
      setScanError(e.message);
    }
  };

  const postSession = async () => {
    if (!activeSession) return;
    if (!window.confirm("Post this stock take? This will create a Stock Adjustment for every line with a variance, and the session can't be edited afterward.")) return;
    setPosting(true);
    try {
      const result = await api(`/stock-take/sessions/${activeSession.id}/post`, { method: "POST" });
      alert(`Posted — ${result.variance_count} variance line(s) adjusted.`);
      setActiveSession(null);
      setLines([]);
      await loadSessions();
    } catch (e) {
      setScanError(e.message);
    } finally {
      setPosting(false);
    }
  };

  const cancelSession = async () => {
    if (!activeSession) return;
    if (!window.confirm("Cancel this stock take? Nothing counted so far will be applied to stock.")) return;
    try {
      await api(`/stock-take/sessions/${activeSession.id}/cancel`, { method: "POST" });
      setActiveSession(null);
      setLines([]);
      await loadSessions();
    } catch (e) {
      setScanError(e.message);
    }
  };

  const varianceCount = lines.filter((l) => Math.abs(l.variance) > 0.0001).length;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white">
          <FaClipboardCheck />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">Stock Take</h1>
          <p className="text-xs text-slate-500">Count physical stock, compare against the system, and post only what's actually different.</p>
        </div>
      </div>

      {!activeSession && (
        <div className="rounded-2xl border border-blue-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">Start a new count</h2>
          <p className="text-xs text-slate-500">Optionally narrow this session to one division/section/department so you can count in batches instead of the whole store at once. Leave blank to count anything.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input className={INP} placeholder="Division (optional)" value={newScope.division} onChange={(e) => setNewScope((s) => ({ ...s, division: e.target.value }))} />
            <input className={INP} placeholder="Section (optional)" value={newScope.section} onChange={(e) => setNewScope((s) => ({ ...s, section: e.target.value }))} />
            <input className={INP} placeholder="Department (optional)" value={newScope.department} onChange={(e) => setNewScope((s) => ({ ...s, department: e.target.value }))} />
          </div>
          <input className={INP} placeholder="Note (optional)" value={newScope.note} onChange={(e) => setNewScope((s) => ({ ...s, note: e.target.value }))} />
          <button
            onClick={startSession}
            disabled={starting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition disabled:opacity-60"
          >
            <FaPlus /> {starting ? "Starting…" : "Start Stock Take"}
          </button>

          {sessions.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FaHistory /> Recent sessions</p>
              <div className="space-y-1.5">
                {sessions.slice(0, 8).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-slate-600">
                      {[s.division, s.section, s.department].filter(Boolean).join(" / ") || "All items"} — {s.line_count} item(s) counted
                      {s.status === "posted" && `, ${s.variance_count} adjusted`}
                    </span>
                    <span className={cn(
                      "font-bold px-2 py-0.5 rounded-full",
                      s.status === "open" ? "bg-amber-100 text-amber-700"
                        : s.status === "posted" ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-500"
                    )}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeSession && (
        <>
          <div className="rounded-2xl border border-blue-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Counting: {[activeSession.division, activeSession.section, activeSession.department].filter(Boolean).join(" / ") || "All items"}
                </p>
                {activeSession.note && <p className="text-xs text-slate-500">{activeSession.note}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={cancelSession} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition">
                  <FaBan /> Cancel
                </button>
                <button
                  onClick={postSession}
                  disabled={posting || lines.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-60"
                >
                  <FaCheckCircle /> {posting ? "Posting…" : `Post (${varianceCount} variance${varianceCount !== 1 ? "s" : ""})`}
                </button>
              </div>
            </div>

            <form onSubmit={scan} className="flex items-center gap-2">
              <FaBarcode className="text-slate-400 shrink-0" />
              <input
                ref={barcodeRef}
                autoFocus
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or type a barcode and press Enter — each scan adds 1 unit"
                className={INP}
              />
            </form>
            {scanError && <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5"><FaTimesCircle /> {scanError}</p>}
          </div>

          <div className="rounded-2xl border border-blue-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Barcode</th>
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-right px-4 py-3">System Qty</th>
                  <th className="text-right px-4 py-3">Counted Qty</th>
                  <th className="text-right px-4 py-3">Variance</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading…</td></tr>
                ) : lines.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">Scan the first item to begin counting.</td></tr>
                ) : lines.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{l.barcode}</td>
                    <td className="px-4 py-2.5 text-slate-800">{l.product || "—"}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{l.system_qty}</td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number" min="0" value={l.counted_qty}
                        onChange={(e) => updateCounted(l, e.target.value)}
                        className="w-20 text-right rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className={cn("px-4 py-2.5 text-right font-bold", l.variance > 0 ? "text-emerald-600" : l.variance < 0 ? "text-rose-600" : "text-slate-400")}>
                      {l.variance > 0 ? `+${l.variance}` : l.variance}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => removeLine(l)} className="text-slate-300 hover:text-rose-500 transition"><FaTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
