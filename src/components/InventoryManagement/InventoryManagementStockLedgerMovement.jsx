import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  FaExchangeAlt, FaSearch, FaFilter, FaLayerGroup, FaBuilding,
  FaCalendarAlt, FaWarehouse, FaFilePdf, FaSyncAlt,
} from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE = `${APP_API_URL}`;

/* ─── Movement types must match what backend returns ─── */
const MOVEMENT_TYPES = ["All", "GRN (Purchase In)", "GRN Reversal", "Adjustment", "POS Sale", "POS Return"];

/* ─── Helpers ─── */
function todayYmd() {
  const d = new Date(), pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function DocTypeBadge({ type }) {
  const cfg = {
    "GRN (Purchase In)": { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0", label: "GRN In" },
    "GRN Reversal":      { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", label: "Reversal" },
    "Adjustment":        { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A", label: "Adjustment" },
    "POS Sale":          { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", label: "POS Sale" },
    "POS Return":        { bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE", label: "POS Return" },
  }[type] || { bg: "#F1F5F9", color: "#475569", border: "#E2E8F0", label: type };

  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      whiteSpace: "nowrap",
    }}>{cfg.label}</span>
  );
}

/* ─── Main Component ─── */
export default function StockLedgerMovement() {
  const storeName = localStorage.getItem("store_name") || localStorage.getItem("admin_store_name") || "";
  const isStoreWorkspace = Boolean(localStorage.getItem("store_id") || localStorage.getItem("admin_store_id"));
  const isSingleStore = localStorage.getItem("admin_account_type") === "single_store";
  /* Filter state */
  const [division,     setDivision]     = useState("");
  const [section,      setSection]      = useState("");
  const [department,   setDepartment]   = useState("");
  const [movementType, setMovementType] = useState("All");
  const [warehouse,    setWarehouse]    = useState("All");
  const [fromDate,     setFromDate]     = useState("");
  const [toDate,       setToDate]       = useState("");
  const [search,       setSearch]       = useState("");

  /* Mapping for cascading dropdowns */
  const [mapping,     setMapping]     = useState({});   // { Division: { Section: [dept] } }
  const [warehouses,  setWarehouses]  = useState(["All"]);

  /* Data */
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  /* Derived cascade options */
  const divisions   = useMemo(() => Object.keys(mapping).sort(), [mapping]);
  const sections    = useMemo(() =>
    division && mapping[division] ? Object.keys(mapping[division]).sort() : [],
    [division, mapping]);
  const departments = useMemo(() =>
    division && section && mapping[division]?.[section]
      ? [...mapping[division][section]].sort()
      : [],
    [division, section, mapping]);

  /* Load mapping once */
  useEffect(() => {
  const token =
    localStorage.getItem("admin_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    "";

  fetch(`${API_BASE}/api/product-mapping/grouped`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then(r => r.json())
    .then(d => setMapping(d.data || {}))
    .catch(() => {});
}, []);

  /* Fetch ledger data */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (division     && division !== "All")     params.append("division",      division);
      if (section      && section  !== "All")     params.append("section",       section);
      if (department   && department !== "All")   params.append("department",    department);
      if (movementType && movementType !== "All") params.append("movement_type", movementType);
      if (warehouse    && warehouse !== "All")    params.append("warehouse",     warehouse);
      if (fromDate)   params.append("from_date", fromDate);
      if (toDate)     params.append("to_date",   toDate);
      if (search.trim()) params.append("search", search.trim());

      const token =
  localStorage.getItem("admin_token") ||
  localStorage.getItem("access_token") ||
  localStorage.getItem("token") ||
  "";

const res = await fetch(
  `${API_BASE}/inventory/stock-ledger?${params.toString()}`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);
      if (!res.ok) throw new Error("Failed to load ledger");
      const json = await res.json();
      const rows = json.data || [];
      setData(rows);

      /* Derive warehouses from data for filter dropdown */
      const whs = ["All", ...new Set(rows.map(r => r.warehouse).filter(Boolean))].sort();
      setWarehouses(whs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [division, section, department, movementType, warehouse, fromDate, toDate, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Reset cascades when parent changes */
  const handleDivision = (v) => { setDivision(v); setSection(""); setDepartment(""); };
  const handleSection  = (v) => { setSection(v);  setDepartment(""); };

  /* Totals */
  const totalIn    = useMemo(() => data.reduce((s, r) => s + (r.in_qty  || 0), 0), [data]);
  const totalOut   = useMemo(() => data.reduce((s, r) => s + (r.out_qty || 0), 0), [data]);
  const totalValue = useMemo(() => data.reduce((s, r) => s + (r.value   || 0), 0), [data]);

  /* PDF export */
  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("Stock Ledger / Movement", 40, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`Generated: ${todayYmd()}`, 40, 58);

    const filters = [
      division     ? `Division: ${division}`   : null,
      section      ? `Section: ${section}`     : null,
      department   ? `Dept: ${department}`     : null,
      movementType !== "All" ? `Type: ${movementType}` : null,
      warehouse    !== "All" ? `WH: ${warehouse}`      : null,
      fromDate     ? `From: ${fromDate}`       : null,
      toDate       ? `To: ${toDate}`           : null,
      search       ? `Search: ${search}`       : null,
    ].filter(Boolean).join(" | ");

    if (filters) doc.text(filters, 40, 74);

    autoTable(doc, {
      head: [["Date","Doc Type","Doc No","Barcode","SKU","Product","IN","OUT","Value (₹)","Warehouse","Reference","Remarks"]],
      body: data.map(r => [
        r.date, r.doc_type, r.doc_no, r.barcode, r.sku || "—", r.product,
        String(r.in_qty  || 0),
        String(r.out_qty || 0),
        r.value > 0 ? `₹${r.value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—",
        r.warehouse, r.ref, r.remarks,
      ]),
      startY: filters ? 92 : 82,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
      margin: { left: 40, right: 40 },
    });

    doc.save(`stock-ledger-${todayYmd()}.pdf`);
  };

  return (
    <div className="h-full min-h-0 overflow-hidden px-3 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <FaExchangeAlt className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{isStoreWorkspace ? "Store Stock Ledger" : "Stock Ledger / Movement"}</h1>
            <p className="text-xs text-slate-500">{data.length} records · Receiving, adjustments and POS movement{isStoreWorkspace ? ` · ${storeName}` : ""}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm font-medium transition-colors disabled:opacity-50">
            <FaSyncAlt className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={exportPdf}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.99]">
            <FaFilePdf /> Export PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* ── KPI strip ── */}
      <div className="flex gap-3 flex-wrap shrink-0">
        {[
          { label: "Total IN",    val: totalIn.toLocaleString(),    color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
          { label: "Total OUT",   val: totalOut.toLocaleString(),   color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
          { label: "Total Value", val: `₹${totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, color: "#6366F1", bg: "#EEF2FF", border: "#C7D2FE" },
        ].map(({ label, val, color, bg, border }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "10px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "monospace" }}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl shadow-sm p-3 sm:p-4 shrink-0 border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Division */}
          {!isSingleStore && <FS label="Division" icon={<FaLayerGroup className="text-slate-500 text-xs" />}
            value={division} onChange={handleDivision}
            options={["", ...divisions]} placeholder="All Divisions" />}

          {/* Section */}
          {!isSingleStore && <FS label="Section" icon={<FaFilter className="text-slate-500 text-xs" />}
            value={section} onChange={handleSection}
            options={["", ...sections]}
            placeholder={division ? (sections.length ? "All Sections" : "No sections") : "Select Division first"}
            disabled={!division || sections.length === 0} />}

          {/* Department */}
          {!isSingleStore && <FS label="Department" icon={<FaBuilding className="text-slate-500 text-xs" />}
            value={department} onChange={setDepartment}
            options={["", ...departments]}
            placeholder={section ? (departments.length ? "All Departments" : "No departments") : "Select Section first"}
            disabled={!section || departments.length === 0} />}

          {/* Search */}
          <div className={`min-w-0 ${isSingleStore ? "sm:col-span-2 lg:col-span-4" : ""}`}>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Search</label>
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <FaSearch className="text-slate-400 shrink-0 text-xs" />
              <input type="text" placeholder="Doc No / Barcode / SKU / Product"
                className="bg-transparent outline-none py-2 w-full text-sm"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">

          {/* Movement type */}
          <FS label="Movement Type" icon={<FaExchangeAlt className="text-slate-500 text-xs" />}
            value={movementType} onChange={setMovementType}
            options={MOVEMENT_TYPES} />

          {/* Warehouse */}
          {!isSingleStore && <FS label="Warehouse" icon={<FaWarehouse className="text-slate-500 text-xs" />}
            value={warehouse} onChange={setWarehouse}
            options={warehouses} />}

          {/* From date */}
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">From Date</label>
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 border border-slate-200 focus-within:border-indigo-400 transition-all">
              <FaCalendarAlt className="text-slate-400 shrink-0 text-xs" />
              <input type="date" className="bg-transparent outline-none py-2 w-full text-sm"
                value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
          </div>

          {/* To date */}
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">To Date</label>
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 border border-slate-200 focus-within:border-indigo-400 transition-all">
              <FaCalendarAlt className="text-slate-400 shrink-0 text-xs" />
              <input type="date" className="bg-transparent outline-none py-2 w-full text-sm"
                value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 text-xs text-slate-500 mt-1">
            Showing <span className="font-semibold text-slate-900">{data.length}</span> records
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl shadow-sm flex-1 min-h-0 overflow-hidden border border-slate-200">
        <div className="h-full overflow-auto">
          <table className={`w-full text-sm min-w-[1280px] ${isSingleStore ? "[&_th:nth-child(7)]:hidden [&_td:nth-child(7)]:hidden [&_th:nth-child(8)]:hidden [&_td:nth-child(8)]:hidden [&_th:nth-child(9)]:hidden [&_td:nth-child(9)]:hidden [&_th:nth-child(13)]:hidden [&_td:nth-child(13)]:hidden" : ""}`}>
            <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                {[
                  { col: "Date",       align: "left"  },
                  { col: "Type",       align: "left"  },
                  { col: "Doc No",     align: "left"  },
                  { col: "Barcode",    align: "left"  },
                  { col: "SKU",        align: "left"  },
                  { col: "Product",    align: "left"  },
                  { col: "Division",   align: "left"  },
                  { col: "Section",    align: "left"  },
                  { col: "Dept",       align: "left"  },
                  { col: "IN",         align: "right" },
                  { col: "OUT",        align: "right" },
                  { col: "Value (₹)",  align: "right" },
                  { col: "Warehouse",  align: "left"  },
                  { col: "Reference",  align: "left"  },
                  { col: "Remarks",    align: "left"  },
                ].map(({ col, align }) => (
                  <th key={col} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ textAlign: align }}>{col}</th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={15} className="p-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <FaSyncAlt className="animate-spin text-xl text-indigo-400" />
                    <span className="text-sm">Loading ledger…</span>
                  </div>
                </td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={15} className="p-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <FaExchangeAlt className="text-3xl opacity-30" />
                    <span className="text-sm">No movement records found</span>
                    <span className="text-xs">Try adjusting your filters</span>
                  </div>
                </td></tr>
              ) : data.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{r.date || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap"><DocTypeBadge type={r.doc_type} /></td>
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-indigo-600 whitespace-nowrap">{r.doc_no}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{r.barcode}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{r.sku || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-3 min-w-[200px] max-w-[280px]">
                    <span className="font-medium text-slate-800 leading-snug">{r.product}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{r.division  || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{r.section   || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{r.department|| <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums whitespace-nowrap"
                    style={{ color: r.in_qty > 0 ? "#059669" : "#CBD5E1" }}>
                    {r.in_qty > 0 ? r.in_qty.toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums whitespace-nowrap"
                    style={{ color: r.out_qty > 0 ? "#DC2626" : "#CBD5E1" }}>
                    {r.out_qty > 0 ? r.out_qty.toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-semibold tabular-nums whitespace-nowrap"
                    style={{ color: r.value > 0 ? "#6366F1" : "#CBD5E1" }}>
                    {r.value > 0 ? `₹${r.value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{r.warehouse || "—"}</td>
                  <td className="px-3 py-3 text-xs text-slate-500 min-w-[160px]">{r.ref || "—"}</td>
                  <td className="px-3 py-3 text-xs text-slate-400 min-w-[180px]">{r.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>

            {data.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 sticky bottom-0">
                <tr>
                  <td colSpan={9} className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {data.length} records
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-bold tabular-nums" style={{ color: "#059669" }}>
                    {totalIn.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-bold tabular-nums" style={{ color: "#DC2626" }}>
                    {totalOut.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-bold tabular-nums" style={{ color: "#6366F1" }}>
                    ₹{totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable filter select ── */
function FS({ label, icon, value, onChange, options, placeholder, disabled }) {
  return (
    <div className="min-w-0">
      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
      <div className={`relative flex items-center gap-2 rounded-xl px-3 border transition-all ${
        disabled ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100"
      }`}>
        {icon}
        <select className="bg-transparent outline-none py-2 w-full text-sm min-w-0 appearance-none pr-4"
          value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
          {placeholder && <option value="">{placeholder}</option>}
          {(options || []).filter(o => o !== "").map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

