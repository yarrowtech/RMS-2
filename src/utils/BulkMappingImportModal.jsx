import React, { useState } from "react";
import { createPortal } from "react-dom";
import Papa from "papaparse";
import { UploadCloud, X, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { API_BASE_URL } from "../config/api.js";

const authHeaders = () => {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const INP = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition bg-white";
const LBL = "block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5";

const capitalizeWords = (text) =>
  (text || "")
    .split(" ")
    .filter((t) => t.trim() !== "")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

function normaliseRow(raw) {
  const get = (...keys) => {
    for (const k of keys) {
      const hit = Object.keys(raw).find((rk) => rk.trim().toLowerCase() === k);
      if (hit && String(raw[hit] || "").trim()) return String(raw[hit]).trim();
    }
    return "";
  };
  return {
    product_type: capitalizeWords(get("product_type", "type", "product type")),
    division: capitalizeWords(get("division")),
    section: capitalizeWords(get("section")),
    department: capitalizeWords(get("department")),
  };
}

/**
 * Bulk-create Product Type -> Division -> Section -> Department mappings
 * from a CSV. Reuses the same POST /api/product-mapping/ endpoint the
 * single "Add Mapping" form already uses, one row at a time — the same
 * case-insensitive dedupe/update-if-exists logic applies exactly the same
 * way here, since it's the same backend code path.
 */
export default function BulkMappingImportModal({ onClose, onImported }) {
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

  const rowIssue = (row) => {
    if (!row.product_type) return "Missing product type";
    if (!row.division) return "Missing division";
    if (!row.section) return "Missing section";
    if (!row.department) return "Missing department";
    return "";
  };

  const validRows = rows.filter((r) => !rowIssue(r));
  const invalidRows = rows.filter((r) => rowIssue(r));

  const runImport = async () => {
    setImporting(true);
    const outcomes = [];
    for (const row of validRows) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/product-mapping/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(row),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Failed");
        outcomes.push({ row, ok: true, message: data.message || "Saved" });
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
            <div className="w-10 h-10 rounded-xl bg-indigo-400/20 flex items-center justify-center"><UploadCloud className="w-5 h-5 text-indigo-300" /></div>
            <div>
              <h2 className="text-lg font-bold text-white">Bulk Import Mappings</h2>
              <p className="text-xs text-slate-400">Upload a CSV instead of adding product groups one by one</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {!results && (
            <>
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500 leading-5">
                <b>Expected columns:</b> product_type, division, section, department — all four are required on every row.
                <br />A row matching an existing mapping (same text, any case) updates it instead of creating a duplicate.
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
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Product Type</th>
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Division</th>
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Section</th>
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Department</th>
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Status</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((row, i) => {
                          const issue = rowIssue(row);
                          return (
                            <tr key={i} className={issue ? "bg-rose-50/50" : ""}>
                              <td className="px-2 py-1.5">{row.product_type || "—"}</td>
                              <td className="px-2 py-1.5">{row.division || "—"}</td>
                              <td className="px-2 py-1.5">{row.section || "—"}</td>
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
              <p className="text-sm font-black text-slate-900 mb-3">{succeeded} of {results.length} mappings saved</p>
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {results.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${r.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {r.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                    <span className="font-bold">{r.row.product_type} / {r.row.division} / {r.row.section} / {r.row.department}</span>
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
              className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
              {importing ? "Importing…" : `Import ${validRows.length} Mapping${validRows.length === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
