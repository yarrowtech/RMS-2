import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Papa from "papaparse";
import { UploadCloud, X, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { API_BASE_URL } from "../config/api.js";

const INP = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition bg-white";
const LBL = "block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5";

function normaliseRow(raw) {
  const get = (...keys) => {
    for (const k of keys) {
      const hit = Object.keys(raw).find((rk) => rk.trim().toLowerCase() === k);
      if (hit && String(raw[hit] || "").trim()) return String(raw[hit]).trim();
    }
    return "";
  };
  return {
    name: get("name", "full name"),
    email: get("email"),
    phone: get("phone", "mobile"),
    department: get("department"),
    division: get("division"),
    section: get("section"),
    floor: get("floor"),
    is_department_head: /^(y|yes|true|1)$/i.test(get("head", "is_department_head", "department head")),
  };
}

/**
 * Bulk-create store staff from a CSV. All rows go to ONE store per import —
 * the caller either locks that store (lockedStoreId, e.g. a store's own HR
 * admin) or lets the person creating pick one (stores prop). Reuses the same
 * POST /hq/admins endpoint the single "Add Staff" forms already use, one row
 * at a time — a store's real seat limit, department validity and the
 * HR/Finance HQ-approval guardrail all apply exactly the same way here.
 */
export default function BulkStaffImportModal({ onClose, onImported, deptConfig: deptConfigProp, stores: storesProp = [], lockedStoreId = "", postJson, getToken }) {
  const [storeId, setStoreId] = useState(lockedStoreId);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [deptConfig, setDeptConfig] = useState(deptConfigProp || null);
  const [stores, setStores] = useState(storesProp);

  // Self-fetch whatever the caller didn't already have handy, so this modal
  // works whether it's dropped into a screen that already loaded department
  // config (Admin Management) or one that didn't (the HR module).
  useEffect(() => {
    if (!deptConfigProp) {
      fetch(`${API_BASE_URL}/hq/departments`)
        .then((r) => r.json())
        .then((res) => setDeptConfig(res.data))
        .catch(() => {});
    }
    if (!lockedStoreId && !storesProp.length && getToken) {
      fetch(`${API_BASE_URL}/hq/stores`, { headers: { Authorization: `Bearer ${getToken()}` } })
        .then((r) => r.json())
        .then((res) => setStores(res.data || []))
        .catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const storeDepartments = new Set(deptConfig?.store_departments || []);
  const defaultPerms = deptConfig?.store_department_default_permissions || {};

  const handleFile = (file) => {
    setParseError(""); setResults(null); setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRows((res.data || []).map(normaliseRow)),
      error: (err) => setParseError(err.message || "Could not read that file."),
    });
  };

  const rowIssue = (row) => {
    if (!row.name) return "Missing name";
    if (!row.email) return "Missing email";
    if (!row.department) return "Missing department";
    if (!storeDepartments.has(row.department)) return `"${row.department}" isn't a valid store department`;
    return "";
  };

  const validRows = rows.filter((r) => !rowIssue(r));
  const invalidRows = rows.filter((r) => rowIssue(r));

  const runImport = async () => {
    if (!storeId) return;
    setImporting(true);
    const outcomes = [];
    for (const row of validRows) {
      try {
        await postJson("/hq/admins", {
          name: row.name, email: row.email, phone: row.phone,
          scope: "store", store_id: storeId,
          managedDepartments: [row.department],
          permissions: defaultPerms[row.department] || [],
          division: row.division, section: row.section, floor: row.floor,
          is_department_head: row.is_department_head,
        });
        outcomes.push({ row, ok: true, message: "Created" });
      } catch (err) {
        outcomes.push({ row, ok: false, message: err.message || "Failed" });
      }
    }
    setResults(outcomes);
    setImporting(false);
    onImported?.();
  };

  const succeeded = results ? results.filter((r) => r.ok).length : 0;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5" style={{ zIndex: 99999 }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "88dvh", overflow: "hidden" }}>
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-400/20 flex items-center justify-center"><UploadCloud className="w-5 h-5 text-teal-300" /></div>
            <div>
              <h2 className="text-lg font-bold text-white">Bulk Import Staff</h2>
              <p className="text-xs text-slate-400">Upload a CSV instead of adding staff one by one</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {!results && (
            <>
              {!lockedStoreId && (
                <div>
                  <label className={LBL}>Store *</label>
                  <select className={INP} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                    <option value="">— Select store / branch —</option>
                    {stores.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">All rows in one import go to a single store.</p>
                </div>
              )}

              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500 leading-5">
                <b>Expected columns:</b> name, email, phone, department, division, section, floor, head (yes/no).
                <br />Department must be one of: {(deptConfig?.store_departments || []).join(", ") || "loading…"}.
              </div>

              <label className={LBL}>CSV file *</label>
              <input type="file" accept=".csv" className={INP}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {parseError && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{parseError}</p>}

              {rows.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-600 mb-2">
                    {fileName} — {validRows.length} ready{invalidRows.length ? `, ${invalidRows.length} need fixing` : ""}
                  </p>
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0"><tr>
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Name</th>
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Email</th>
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Department</th>
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Status</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((row, i) => {
                          const issue = rowIssue(row);
                          return (
                            <tr key={i} className={issue ? "bg-rose-50/50" : ""}>
                              <td className="px-2 py-1.5">{row.name || "—"}</td>
                              <td className="px-2 py-1.5">{row.email || "—"}</td>
                              <td className="px-2 py-1.5">{row.department || "—"}</td>
                              <td className="px-2 py-1.5">
                                {issue
                                  ? <span className="text-rose-600 font-semibold">{issue}</span>
                                  : <span className="text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Ready</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {results && (
            <div>
              <p className="text-sm font-black text-slate-900 mb-3">{succeeded} of {results.length} staff created</p>
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {results.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${r.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {r.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                    <span className="font-bold">{r.row.name}</span>
                    <span className="text-slate-400">·</span>
                    <span>{r.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3" style={{ flexShrink: 0 }}>
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
            {results ? "Close" : "Cancel"}
          </button>
          {!results && (
            <button onClick={runImport} disabled={importing || !storeId || !validRows.length}
              className="flex-1 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
              {importing ? "Importing…" : `Import ${validRows.length} Staff`}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
