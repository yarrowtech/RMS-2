import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Papa from "papaparse";
import axios from "axios";
import { UploadCloud, FileSpreadsheet, Download, X, AlertCircle, CheckCircle2, XCircle, ArrowRight, ChevronDown, HelpCircle } from "lucide-react";
import { API_BASE_URL } from "../config/api.js";

const API_BASE = API_BASE_URL;
const authHeaders = () => {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// column, required?, plain-language meaning, example — shown compactly as
// chips by default, or as a full reference table when "Show column
// details" is expanded. Written for someone running a shop, not a
// developer — no jargon like "SKU" or "tax classification" left unexplained.
const COLUMN_DETAILS = [
  { key: "product_name", required: true, meaning: "The name of the product, exactly as you want it to appear.", example: "Engine Oil 1L" },
  { key: "mrp or selling_price", required: true, meaning: "At least one price is needed. MRP is the printed maximum price; selling price is what you actually charge.", example: "399" },
  { key: "quantity", required: false, meaning: "How many you currently have. Added straight to your store's sellable stock.", example: "25" },
  { key: "unit", required: false, meaning: "How it's measured or sold — pieces, kilograms, litres, boxes, etc.", example: "ltr" },
  { key: "division", required: false, meaning: "A broad category. Leave blank if you don't group products yet.", example: "Lubricants" },
  { key: "section", required: false, meaning: "A sub-category under Division.", example: "Engine Care" },
  { key: "department", required: false, meaning: "The most specific classification, under Section.", example: "Oils" },
  { key: "cost_price", required: false, meaning: "What you paid for it — used only to track your margin, never shown to customers.", example: "280" },
  { key: "hsn_code", required: false, meaning: "The tax code used on GST invoices for this item. Ask your accountant if unsure.", example: "27101981" },
  { key: "gst_rate", required: false, meaning: "The GST percentage charged on this item.", example: "18" },
  { key: "barcode", required: false, meaning: "Your own barcode or item code, if you already use one. Leave blank and RMS creates one for you.", example: "(auto-generated)" },
  { key: "description", required: false, meaning: "A short line describing the product.", example: "Fully synthetic engine oil" },
  { key: "specification", required: false, meaning: "Any extra detail — pack size, grade, material, etc.", example: "1 litre bottle" },
];
const REQUIRED_COLUMNS = COLUMN_DETAILS.filter((c) => c.required).map((c) => c.key);
const OPTIONAL_COLUMNS = COLUMN_DETAILS.filter((c) => !c.required).map((c) => c.key);
const TEMPLATE_HEADERS = ["product_name", "division", "section", "department", "hsn_code", "gst_rate", "cost_price", "mrp", "selling_price", "quantity", "unit", "barcode", "description", "specification"];
const TEMPLATE_EXAMPLE = ["Engine Oil 1L", "Lubricants", "Engine Care", "Oils", "27101981", "18", "280", "399", "379", "25", "ltr", "", "Fully synthetic engine oil", "1 litre bottle"];

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "product-import-template.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function StepBadge({ n }) {
  return <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-600 text-[10px] font-black text-white">{n}</span>;
}

function normaliseRow(raw) {
  const get = (...keys) => {
    for (const k of keys) {
      const hit = Object.keys(raw).find((rk) => rk.trim().toLowerCase() === k);
      if (hit && String(raw[hit] || "").trim()) return String(raw[hit]).trim();
    }
    return "";
  };
  return {
    product_name: get("product_name", "name", "product name"),
    division: get("division"),
    section: get("section"),
    department: get("department"),
    hsn_code: get("hsn_code", "hsn"),
    gst_rate: get("gst_rate", "gst", "gst %"),
    cost_price: get("cost_price", "cost"),
    mrp: get("mrp"),
    selling_price: get("selling_price", "price"),
    quantity: get("quantity", "qty", "opening stock"),
    unit: get("unit") || "pcs",
    barcode: get("barcode", "sku"),
    description: get("description"),
    specification: get("specification", "spec"),
  };
}

/**
 * Bulk-create products (plain, non-variant only) from a CSV/Excel-exported
 * CSV. Reuses the same POST /api/products/add endpoint the single "Add
 * Product" form already uses, one row at a time — SKU/barcode generation,
 * per-tenant uniqueness, and (for a single-store tenant) seeding opening
 * stock straight into that store's stock all apply exactly the same way
 * here, since it's the same backend code path.
 */
export default function BulkProductImportModal({ onClose, onImported }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    setParseError(""); setResults(null); setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRows((res.data || []).map(normaliseRow)),
      error: (err) => setParseError(err.message || "Could not read that file."),
    });
  };

  const rowIssue = (row) => {
    if (!row.product_name) return "Missing product name";
    if (!row.mrp && !row.selling_price) return "Needs MRP or selling price";
    return "";
  };

  const validRows = rows.filter((r) => !rowIssue(r));
  const invalidRows = rows.filter((r) => rowIssue(r));

  const runImport = async () => {
    setImporting(true);
    const outcomes = [];
    for (const row of validRows) {
      try {
        const fd = new FormData();
        fd.append("product_name", row.product_name);
        fd.append("division", row.division);
        fd.append("section", row.section);
        fd.append("department", row.department);
        fd.append("hsn_code", row.hsn_code);
        fd.append("gst_rate", String(Number(row.gst_rate) || 0));
        fd.append("cost_price", String(Number(row.cost_price) || 0));
        fd.append("mrp", String(Number(row.mrp) || 0));
        fd.append("selling_price", String(Number(row.selling_price) || Number(row.mrp) || 0));
        fd.append("quantity", String(parseInt(row.quantity, 10) || 0));
        fd.append("unit", row.unit);
        fd.append("description", row.description);
        fd.append("specification", row.specification);
        fd.append("has_variants", "false");
        fd.append("variant_type", "none");
        fd.append("variants", "[]");
        if (row.barcode) fd.append("barcode_override", row.barcode);
        await axios.post(`${API_BASE}/api/products/add`, fd, { headers: authHeaders() });
        outcomes.push({ row, ok: true, message: "Created" });
      } catch (err) {
        outcomes.push({ row, ok: false, message: err?.response?.data?.detail || err.message || "Failed" });
      }
    }
    setResults(outcomes);
    setImporting(false);
    onImported?.();
  };

  const succeeded = results ? results.filter((r) => r.ok).length : 0;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl" style={{ maxHeight: "90dvh" }}>
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-800 px-7 py-6">
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-fuchsia-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 left-1/4 h-28 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-lg shadow-black/20">
                <UploadCloud className="h-6 w-6 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-xl font-black leading-tight tracking-tight text-white">Bulk Import Products</h2>
                <p className="mt-0.5 text-sm text-indigo-100">Upload a CSV instead of adding products one by one</p>
              </div>
            </div>
            <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {!results && (
            <>
              <div>
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <StepBadge n={1} />
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">Column guide</span>
                  </div>
                  <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100">
                    <Download className="h-3.5 w-3.5" /> Download template
                  </button>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Required</span>
                    {REQUIRED_COLUMNS.map((c) => (
                      <span key={c} className="rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm shadow-indigo-200">{c}</span>
                    ))}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Optional</span>
                    {OPTIONAL_COLUMNS.map((c) => (
                      <span key={c} className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">{c}</span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowDetails((v) => !v)}
                    className="mt-3 flex w-full items-center justify-between border-t border-slate-200/80 pt-3 text-xs font-bold text-indigo-700"
                  >
                    <span className="flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5" /> {showDetails ? "Hide" : "Show"} what each column means</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} />
                  </button>

                  {showDetails && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white"><tr>
                          <th className="px-3 py-2 font-bold text-slate-500">Column</th>
                          <th className="px-3 py-2 font-bold text-slate-500">What it means</th>
                          <th className="px-3 py-2 font-bold text-slate-500">Example</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {COLUMN_DETAILS.map((c) => (
                            <tr key={c.key}>
                              <td className="px-3 py-2 align-top font-mono font-bold text-slate-700">
                                {c.key}
                                {c.required && <span className="ml-1 text-rose-500">*</span>}
                              </td>
                              <td className="px-3 py-2 align-top leading-5 text-slate-500">{c.meaning}</td>
                              <td className="px-3 py-2 align-top text-slate-400">{c.example}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <p className="mt-3 border-t border-slate-200/80 pt-3 text-xs leading-5 text-slate-500">
                    Variant (size/colour) products aren't supported by this import — add those one at a time instead.
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-2.5 flex items-center gap-2">
                  <StepBadge n={2} />
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Upload your CSV</span>
                </div>
                <label
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
                  className={`group flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-all ${
                    dragOver ? "scale-[1.01] border-indigo-400 bg-indigo-50" : fileName ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40"
                  }`}
                >
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                  {fileName ? (
                    <>
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 shadow-sm shadow-emerald-200"><FileSpreadsheet className="h-5 w-5 text-emerald-600" /></div>
                      <p className="text-sm font-bold text-slate-800">{fileName}</p>
                      <p className="text-xs text-slate-400">Click or drop another file to replace it</p>
                    </>
                  ) : (
                    <>
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition group-hover:shadow-md group-hover:ring-indigo-200"><UploadCloud className="h-5 w-5 text-indigo-500" /></div>
                      <p className="text-sm font-bold text-slate-700">Click to choose a CSV file, or drag it here</p>
                      <p className="text-xs text-slate-400">.csv files only</p>
                    </>
                  )}
                </label>
                {parseError && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-600"><AlertCircle className="h-3.5 w-3.5" />{parseError}</p>}
              </div>

              {rows.length > 0 && (
                <div>
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <StepBadge n={3} />
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">Review</span>
                    </div>
                    <p className="text-xs font-bold text-slate-500">
                      <span className="text-emerald-600">{validRows.length} ready</span>
                      {invalidRows.length ? <span className="text-rose-500"> · {invalidRows.length} need fixing</span> : null}
                    </p>
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-50"><tr>
                        <th className="px-3 py-2 text-left font-bold text-slate-500">Product</th>
                        <th className="px-3 py-2 text-left font-bold text-slate-500">MRP</th>
                        <th className="px-3 py-2 text-left font-bold text-slate-500">Qty</th>
                        <th className="px-3 py-2 text-left font-bold text-slate-500">Unit</th>
                        <th className="px-3 py-2 text-left font-bold text-slate-500">Status</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((row, i) => {
                          const issue = rowIssue(row);
                          return (
                            <tr key={i} className={issue ? "bg-rose-50/50" : ""}>
                              <td className="px-3 py-2 font-semibold text-slate-800">{row.product_name || "—"}</td>
                              <td className="px-3 py-2 text-slate-600">{row.mrp || "—"}</td>
                              <td className="px-3 py-2 text-slate-600">{row.quantity || "0"}</td>
                              <td className="px-3 py-2 text-slate-600">{row.unit || "pcs"}</td>
                              <td className="px-3 py-2">
                                {issue
                                  ? <span className="font-semibold text-rose-600">{issue}</span>
                                  : <span className="flex items-center gap-1 font-semibold text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Ready</span>}
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
              <div className="mb-3 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <p className="text-sm font-black text-emerald-800">{succeeded} of {results.length} products created</p>
              </div>
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${r.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {r.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                    <span className="font-bold">{r.row.product_name}</span>
                    <span className="text-slate-400">·</span>
                    <span>{r.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
            {results ? "Close" : "Cancel"}
          </button>
          {!results && (
            <button onClick={runImport} disabled={importing || !validRows.length}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">
              {importing ? "Importing…" : <>Import {validRows.length} Product{validRows.length === 1 ? "" : "s"} <ArrowRight className="h-3.5 w-3.5" /></>}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
