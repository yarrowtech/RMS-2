import React, { useState } from "react";
import { createPortal } from "react-dom";
import Papa from "papaparse";
import { UploadCloud, X, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

const INP = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition bg-white";
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
    phone: get("phone", "mobile"),
    role: get("role", "designation"),
    division: get("division"),
    section: get("section"),
    floor: get("floor"),
  };
}

/**
 * Bulk-create floor staff (salespeople, no login) from a CSV — all for the
 * caller's own store, same as the single "Add Floor Staff" form (only store
 * HR can create floor staff at all today, see FloorStaffModal). Reuses
 * POST /api/hr/floor-staff, one row at a time.
 */
export default function BulkFloorStaffImportModal({ onClose, onImported, storeId, postJson }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

  const handleFile = (file) => {
    setParseError(""); setResults(null); setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRows((res.data || []).map(normaliseRow)),
      error: (err) => setParseError(err.message || "Could not read that file."),
    });
  };

  const rowIssue = (row) => (!row.name ? "Missing name" : "");

  const validRows = rows.filter((r) => !rowIssue(r));
  const invalidRows = rows.filter((r) => rowIssue(r));

  const runImport = async () => {
    setImporting(true);
    const outcomes = [];
    for (const row of validRows) {
      try {
        await postJson("/api/hr/floor-staff", {
          name: row.name, phone: row.phone, role: row.role,
          division: row.division, section: row.section, floor: row.floor,
          store_id: storeId,
        });
        outcomes.push({ row, ok: true, message: "Added" });
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
              <h2 className="text-lg font-bold text-white">Bulk Import Floor Staff</h2>
              <p className="text-xs text-slate-400">Upload a CSV instead of adding floor staff one by one</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {!results && (
            <>
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500 leading-5">
                <b>Expected columns:</b> name, phone, role, division, section, floor.
                <br />No login is created for these — just an HR record for tracking, same as adding one at a time.
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
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Role</th>
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Placement</th>
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Status</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((row, i) => {
                          const issue = rowIssue(row);
                          return (
                            <tr key={i} className={issue ? "bg-rose-50/50" : ""}>
                              <td className="px-2 py-1.5">{row.name || "—"}</td>
                              <td className="px-2 py-1.5">{row.role || "—"}</td>
                              <td className="px-2 py-1.5">{[row.division, row.section, row.floor].filter(Boolean).join(" · ") || "—"}</td>
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
              <p className="text-sm font-black text-slate-900 mb-3">{succeeded} of {results.length} floor staff added</p>
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
            <button onClick={runImport} disabled={importing || !validRows.length}
              className="flex-1 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
              {importing ? "Importing…" : `Import ${validRows.length} Floor Staff`}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
