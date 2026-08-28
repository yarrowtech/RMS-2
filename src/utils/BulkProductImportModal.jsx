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

// Column guide shown in the bulk product import modal.
// Keep this plain and retail-facing so store teams understand what to fill.
const COLUMN_DETAILS = [
  { key: "product_name", required: true, meaning: "Retail item name shown in Product List, Inventory, POS search and printed bill.", example: "Classic Cotton Shirt" },
  { key: "mrp or selling_price", required: true, meaning: "Use MRP for printed price, or selling_price for your actual billing price. If selling_price is blank, RMS uses MRP.", example: "MRP 899 / Selling 799" },
  { key: "quantity", required: false, meaning: "Opening stock for this single store. After import, this quantity becomes available for cashier billing.", example: "25" },
  { key: "unit", required: false, meaning: "How the item is sold: pcs, box, pack, kg, litre, metre, pair, bottle, etc.", example: "pcs" },
  { key: "batch_no", required: false, meaning: "Batch number printed by supplier/manufacturer. Useful for FMCG, food, cosmetics and engine oil.", example: "BATCH-AUG26" },
  { key: "mfg_date", required: false, meaning: "Manufacturing date for this batch. Use YYYY-MM-DD format.", example: "2026-08-01" },
  { key: "expiry_date", required: false, meaning: "Expiry date for this batch. POS/inventory can use this for expiry checks. Use YYYY-MM-DD format.", example: "2027-02-01" },
  { key: "shelf_life_days", required: false, meaning: "Shelf life in days if you track by manufacturing date instead of exact expiry date.", example: "180" },
  { key: "division", required: false, meaning: "Top retail group used for filtering and reports.", example: "Menswear" },
  { key: "section", required: false, meaning: "Sub-group under Division.", example: "Shirts" },
  { key: "department", required: false, meaning: "Final selling department/counter inside the store.", example: "Casual Shirts" },
  { key: "cost_price", required: false, meaning: "Purchase cost for margin tracking. This is not shown to customers.", example: "520" },
  { key: "hsn_code", required: false, meaning: "GST HSN code for invoice/tax reporting. Leave blank if not maintained yet.", example: "620520" },
  { key: "gst_rate", required: false, meaning: "GST percentage used for tax calculation on the bill.", example: "5" },
  { key: "barcode", required: false, meaning: "Existing barcode printed on product. Leave blank and RMS generates a barcode automatically.", example: "8901234567890" },
  { key: "description", required: false, meaning: "Short note for staff or product reference.", example: "Slim fit casual shirt" },
  { key: "specification", required: false, meaning: "Extra detail like material, pack size, flavour, brand note, care or grade.", example: "Cotton blend, full sleeve" },
];
const REQUIRED_COLUMNS = COLUMN_DETAILS.filter((c) => c.required).map((c) => c.key);
const OPTIONAL_COLUMNS = COLUMN_DETAILS.filter((c) => !c.required).map((c) => c.key);
const TEMPLATE_HEADERS = ["product_name", "division", "section", "department", "hsn_code", "gst_rate", "cost_price", "mrp", "selling_price", "quantity", "unit", "batch_no", "mfg_date", "expiry_date", "shelf_life_days", "barcode", "description", "specification"];
const TEMPLATE_EXAMPLE = ["Bottled Water 1L", "Snacks & Refreshments", "Beverages", "Water", "220110", "18", "12", "20", "20", "48", "bottle", "BW-AUG26", "2026-08-01", "2027-02-01", "180", "", "Packaged drinking water", "1 litre bottle"];

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
  return <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-black text-white shadow-sm shadow-indigo-200">{n}</span>;
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
    batch_no: get("batch_no", "batch", "batch no"),
    mfg_date: get("mfg_date", "mfg", "manufacturing date"),
    expiry_date: get("expiry_date", "expiry", "expiry date"),
    shelf_life_days: get("shelf_life_days", "shelf life", "shelf_life"),
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
        fd.append("batch_no", row.batch_no || "");
        fd.append("mfg_date", row.mfg_date || "");
        fd.append("expiry_date", row.expiry_date || "");
        fd.append("shelf_life_days", String(parseInt(row.shelf_life_days, 10) || 0));
        fd.append("requires_expiry", String(Boolean(row.expiry_date || row.shelf_life_days)));
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
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-md sm:p-6">
      <div className="flex w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/40 bg-white shadow-2xl" style={{ maxHeight: "94dvh" }}>
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-800 px-5 py-5 sm:px-7 sm:py-6">
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-fuchsia-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 left-1/4 h-28 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-lg shadow-black/20">
                <UploadCloud className="h-6 w-6 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-xl font-black leading-tight tracking-tight text-white">Bulk Import Products</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-indigo-100">Upload simple retail products in bulk. Use this for normal items without size/colour variants.</p>
              </div>
            </div>
            <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-4 sm:p-6" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {!results && (
            <>
              <div>
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <StepBadge n={1} />
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">Column guide</span>
                  </div>
                </div>
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 bg-gradient-to-r from-sky-50 via-indigo-50 to-violet-50 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-base font-black text-slate-950">CSV format for product bulk upload</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Each row becomes one product in this store. Quantity becomes opening stock, price goes to POS billing, and barcode can be scanned by cashier.
                        </p>
                      </div>
                      <button onClick={downloadTemplate} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700">
                        <Download className="h-4 w-4" /> Download CSV template
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-5 p-5 lg:grid-cols-[0.7fr_1.3fr]">
                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Required columns</p>
                      <div className="mt-3 grid gap-2">
                        {REQUIRED_COLUMNS.map((c) => (
                          <div key={c} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-900 shadow-sm ring-1 ring-emerald-100">
                            {c}
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-emerald-800">
                        Product name is mandatory. Add either MRP or selling_price so RMS knows what to bill.
                      </p>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Optional columns</p>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {OPTIONAL_COLUMNS.map((c) => (
                          <span key={c} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setShowDetails((v) => !v)}
                      className="flex w-full items-center justify-between rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-sm font-black text-indigo-700 shadow-sm hover:bg-indigo-50"
                    >
                      <span className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /> {showDetails ? "Hide" : "Show"} full column meaning and examples</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`} />
                    </button>

                    {showDetails && (
                      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                        <table className="min-w-[900px] w-full text-left text-sm">
                          <thead className="bg-slate-100"><tr>
                            <th className="px-5 py-4 font-black uppercase tracking-wide text-slate-500">Column</th>
                            <th className="px-5 py-4 font-black uppercase tracking-wide text-slate-500">What it means</th>
                            <th className="px-5 py-4 font-black uppercase tracking-wide text-slate-500">Example</th>
                          </tr></thead>
                          <tbody className="divide-y divide-slate-100">
                            {COLUMN_DETAILS.map((c) => (
                              <tr key={c.key}>
                                <td className="px-5 py-4 align-top font-mono font-black text-slate-800">
                                  {c.key}
                                  {c.required && <span className="ml-1 text-rose-500">*</span>}
                                </td>
                                <td className="px-5 py-4 align-top leading-5 text-slate-600">{c.meaning}</td>
                                <td className="px-5 py-4 align-top font-semibold text-slate-500">{c.example}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-3">
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><b>Use for:</b> Basic retail products like shirts, grocery, cosmetics, snacks, accessories, water bottles and FMCG.</div>
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><b>Do not use for:</b> Size/colour variant products. Add those from Add Product so each variant gets proper stock and barcode.</div>
                      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4"><b>Single-store stock:</b> Enter quantity in the CSV. RMS creates the product, generates barcode if blank, and adds that quantity to this store inventory.</div>
                    </div>
                  </div>
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
                    dragOver ? "scale-[1.01] border-indigo-400 bg-indigo-50" : fileName ? "border-emerald-300 bg-emerald-50/80" : "border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40"
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
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <StepBadge n={3} />
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">Review</span>
                    </div>
                    <p className="text-xs font-bold text-slate-500">
                      <span className="text-emerald-600">{validRows.length} ready</span>
                      {invalidRows.length ? <span className="text-rose-500"> - {invalidRows.length} need fixing</span> : null}
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200">
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

        <div className="grid shrink-0 gap-3 border-t border-slate-100 bg-white px-6 py-4 sm:grid-cols-2">
          <button onClick={onClose} className="rounded-2xl border border-slate-200 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50">
            {results ? "Close" : "Cancel"}
          </button>
          {!results && (
            <button onClick={runImport} disabled={importing || !validRows.length}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">
              {importing ? "Importing..." : <>Import {validRows.length} Product{validRows.length === 1 ? "" : "s"} <ArrowRight className="h-3.5 w-3.5" /></>}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
