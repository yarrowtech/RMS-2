import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  FaBarcode, FaPlus, FaCheckCircle, FaTimesCircle, FaBan,
  FaClipboardCheck, FaSyncAlt, FaTrash, FaHistory, FaSearch, FaFileUpload,
} from "react-icons/fa";
import Papa from "papaparse";

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

// A typeable, searchable dropdown -- types to filter `options`, click or
// Enter to pick one, blur closes it. Plain text is still allowed (these
// fields are an optional reference tag, not validated against the
// catalog), so it degrades gracefully to a free-text field if nothing
// matches what was typed.
function SearchableSelect({ value, onChange, options, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onClickAway = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const filtered = (options || []).filter((o) => !value || o.toLowerCase().includes(value.toLowerCase()));

  return (
    <div className="relative" ref={boxRef}>
      <input
        className={INP}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && !disabled && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-blue-200 bg-white shadow-lg">
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false); }}
              className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50"
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [mapping, setMapping] = useState({});
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [showProductResults, setShowProductResults] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState("");
  const [importParseError, setImportParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const barcodeRef = useRef(null);
  const productBoxRef = useRef(null);

  useEffect(() => {
    const onClickAway = (e) => { if (productBoxRef.current && !productBoxRef.current.contains(e.target)) setShowProductResults(false); };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  useEffect(() => {
    if (productQuery.trim().length < 2) { setProductResults([]); return; }
    const handle = setTimeout(() => {
      api(`/stock-take/search-products?q=${encodeURIComponent(productQuery.trim())}`)
        .then((d) => setProductResults(d.data || []))
        .catch(() => setProductResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [productQuery]);

  useEffect(() => {
    api("/inventory/filter-tree").then((d) => setMapping(d.data || {})).catch(() => {});
  }, []);

  const divisionOptions = Object.keys(mapping).sort();
  const sectionOptions = newScope.division && mapping[newScope.division] ? Object.keys(mapping[newScope.division]).sort() : [];
  const departmentOptions = newScope.division && newScope.section && mapping[newScope.division]?.[newScope.section]
    ? [...mapping[newScope.division][newScope.section]].sort() : [];

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

  const scanBarcode = async (bc) => {
    if (!activeSession || !bc.trim()) return;
    setScanError("");
    try {
      await api(`/stock-take/sessions/${activeSession.id}/scan`, { method: "POST", body: JSON.stringify({ barcode: bc.trim(), qty: 1 }) });
      await loadDetail(activeSession.id);
    } catch (e) {
      setScanError(e.message);
    } finally {
      barcodeRef.current?.focus();
    }
  };

  const scan = async (e) => {
    e?.preventDefault();
    const bc = barcode;
    setBarcode("");
    await scanBarcode(bc);
  };

  const pickProduct = async (product) => {
    setProductQuery("");
    setProductResults([]);
    setShowProductResults(false);
    await scanBarcode(product.barcode);
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

  const deleteSession = async (session) => {
    if (session.status === "posted") return;
    if (!window.confirm(`Delete this ${session.status} stock take? This removes the session and its counted lines -- it cannot be undone.`)) return;
    try {
      await api(`/stock-take/sessions/${session.id}`, { method: "DELETE" });
      if (activeSession?.id === session.id) { setActiveSession(null); setLines([]); }
      await loadSessions();
    } catch (e) {
      setScanError(e.message);
    }
  };

  const normaliseImportRow = (raw) => {
    const get = (...keys) => {
      for (const k of keys) {
        const hit = Object.keys(raw).find((rk) => rk.trim().toLowerCase() === k);
        if (hit && String(raw[hit] ?? "").trim() !== "") return String(raw[hit]).trim();
      }
      return "";
    };
    return {
      barcode: get("barcode", "barcode_number"),
      counted_qty: get("counted_qty", "counted qty", "count", "qty", "quantity"),
    };
  };

  const handleImportFile = async (file) => {
    setImportParseError("");
    setImportResult(null);
    setImportFileName(file.name);

    if (/\.xlsx?$/i.test(file.name)) {
      try {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const workbook = XLSX.read(buf, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        setImportRows(sheetRows.map((row) => {
          const raw = {};
          Object.entries(row).forEach(([header, value]) => { raw[String(header).trim()] = String(value ?? "").trim(); });
          return normaliseImportRow(raw);
        }));
      } catch (err) {
        setImportParseError(err.message || "Could not read that Excel file.");
      }
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setImportRows((res.data || []).map(normaliseImportRow)),
      error: (err) => setImportParseError(err.message || "Could not read that file."),
    });
  };

  const rowIssue = (row) => {
    if (!row.barcode) return "Missing barcode";
    if (row.counted_qty === "" || Number.isNaN(Number(row.counted_qty)) || Number(row.counted_qty) < 0) return "Missing/invalid counted qty";
    return "";
  };
  const validImportRows = importRows.filter((r) => !rowIssue(r));
  const invalidImportRows = importRows.filter((r) => rowIssue(r));

  const runImport = async () => {
    if (!activeSession || validImportRows.length === 0) return;
    setImporting(true);
    try {
      const result = await api(`/stock-take/sessions/${activeSession.id}/import`, {
        method: "POST",
        body: JSON.stringify({ rows: validImportRows.map((r) => ({ barcode: r.barcode, counted_qty: Number(r.counted_qty) })) }),
      });
      setImportResult(result);
      await loadDetail(activeSession.id);
    } catch (e) {
      setImportParseError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const closeImport = () => {
    setShowImport(false);
    setImportRows([]);
    setImportFileName("");
    setImportParseError("");
    setImportResult(null);
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
            <SearchableSelect
              placeholder="Division (optional)"
              value={newScope.division}
              options={divisionOptions}
              onChange={(v) => setNewScope((s) => ({ ...s, division: v, section: "", department: "" }))}
            />
            <SearchableSelect
              placeholder={newScope.division ? "Section (optional)" : "Division first"}
              value={newScope.section}
              options={sectionOptions}
              disabled={!newScope.division}
              onChange={(v) => setNewScope((s) => ({ ...s, section: v, department: "" }))}
            />
            <SearchableSelect
              placeholder={newScope.section ? "Department (optional)" : "Section first"}
              value={newScope.department}
              options={departmentOptions}
              disabled={!newScope.section}
              onChange={(v) => setNewScope((s) => ({ ...s, department: v }))}
            />
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
                  <div key={s.id} className="flex items-center justify-between gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-slate-600 min-w-0">
                      <span className="font-bold text-slate-700">{s.store_name || "HQ / Central"}</span>
                      {" — "}
                      {[s.division, s.section, s.department].filter(Boolean).join(" / ") || "All items"} — {s.line_count} item(s) counted
                      {s.status === "posted" && `, ${s.variance_count} adjusted`}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className={cn(
                        "font-bold px-2 py-0.5 rounded-full",
                        s.status === "open" ? "bg-amber-100 text-amber-700"
                          : s.status === "posted" ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-500"
                      )}>
                        {s.status}
                      </span>
                      {s.status === "open" && (
                        <button onClick={() => loadDetail(s.id)} className="text-blue-600 hover:text-blue-800 font-bold" title="Resume">
                          Resume
                        </button>
                      )}
                      {s.status !== "posted" && (
                        <button onClick={() => deleteSession(s)} className="text-slate-300 hover:text-rose-500 transition" title="Delete">
                          <FaTrash />
                        </button>
                      )}
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
                <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 text-blue-600 text-xs font-bold hover:bg-blue-50 transition">
                  <FaFileUpload /> Import CSV
                </button>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div className="relative" ref={productBoxRef}>
                <div className="flex items-center gap-2">
                  <FaSearch className="text-slate-400 shrink-0" />
                  <input
                    value={productQuery}
                    onChange={(e) => { setProductQuery(e.target.value); setShowProductResults(true); }}
                    onFocus={() => setShowProductResults(true)}
                    placeholder="...or find a product by name/SKU when the barcode isn't handy"
                    className={INP}
                  />
                </div>
                {showProductResults && productResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-blue-200 bg-white shadow-lg">
                    {productResults.map((p) => (
                      <button
                        key={p.barcode}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); pickProduct(p); }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                      >
                        <span className="font-semibold text-slate-800">{p.name || p.barcode}</span>
                        <span className="ml-2 text-xs text-slate-400 font-mono">{p.barcode}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
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

      {showImport && (
        <div className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4" onClick={closeImport}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-800 mb-1">Import counted quantities</h3>
            <p className="text-xs text-slate-500 mb-4">
              CSV/Excel with two columns: <b>barcode</b> and <b>counted_qty</b> (also accepts "qty"/"quantity"/"count"). A barcode already counted in this session gets overwritten by the sheet's value.
            </p>

            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white file:text-xs file:font-bold hover:file:bg-blue-700"
            />
            {importFileName && <p className="mt-2 text-xs text-slate-500">{importFileName} — {importRows.length} row(s) parsed</p>}
            {importParseError && <p className="mt-2 text-xs font-bold text-rose-600">{importParseError}</p>}

            {importRows.length > 0 && !importResult && (
              <>
                <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50 text-slate-500"><th className="text-left px-3 py-2">Barcode</th><th className="text-right px-3 py-2">Counted Qty</th><th className="text-left px-3 py-2">Status</th></tr></thead>
                    <tbody>
                      {importRows.slice(0, 200).map((r, i) => {
                        const issue = rowIssue(r);
                        return (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-3 py-1.5 font-mono">{r.barcode || "—"}</td>
                            <td className="px-3 py-1.5 text-right">{r.counted_qty || "—"}</td>
                            <td className={cn("px-3 py-1.5", issue ? "text-rose-600" : "text-emerald-600")}>{issue || "OK"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-slate-500">{validImportRows.length} valid, {invalidImportRows.length} skipped (will not be imported).</p>
              </>
            )}

            {importResult && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <p className="font-bold flex items-center gap-1.5"><FaCheckCircle /> {importResult.imported} row(s) imported.</p>
                {importResult.unlisted_barcodes?.length > 0 && (
                  <p className="mt-1 text-amber-700">{importResult.unlisted_barcodes.length} barcode(s) weren't found in the product master and were added as unlisted: {importResult.unlisted_barcodes.slice(0, 10).join(", ")}{importResult.unlisted_barcodes.length > 10 ? "…" : ""}</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={closeImport} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">{importResult ? "Close" : "Cancel"}</button>
              {!importResult && (
                <button
                  onClick={runImport}
                  disabled={importing || validImportRows.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {importing ? "Importing…" : `Import ${validImportRows.length} row(s)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
