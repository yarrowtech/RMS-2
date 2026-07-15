import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  FaBoxes, FaSyncAlt, FaSearch, FaWarehouse, FaFilter,
  FaLayerGroup, FaBuilding, FaChevronDown, FaStore,
  FaArrowRight, FaClipboardList, FaUserTie, FaTrashAlt, FaTimes,
  FaEdit, FaPrint, FaSave, FaExchangeAlt,
} from "react-icons/fa";
import ReactDOM from "react-dom";
import BarcodeStickerPrint from "../Barcodestickerprint.jsx";

const API = APP_API_URL;

/* ── helpers ── */
const money = (v) =>
  Number(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function stockStatus(qty) {
  if (qty <= 0)  return { label: "Out of Stock", cls: "bg-rose-100 text-rose-700 border-rose-200" };
  if (qty <= 20) return { label: "Low Stock",    cls: "bg-amber-100 text-amber-800 border-amber-200" };
  return           { label: "In Stock",         cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };
}

function parseVariantLabel(label = "") {
  const parts = label.split(" | ");
  const base  = parts[0] || label;
  const size  = parts.length === 3 ? parts[1] : null;
  const color = parts.length >= 2 ? parts[parts.length - 1] : null;
  const isColour =
    color && (/^#?[0-9A-Fa-f]{3,6}$/.test(color) || /^[A-Za-z\s]+$/.test(color));
  return { base, size, color: isColour ? color : null };
}

/* ── Product Detail Modal ── */
function ProductDetailModal({ row, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!row) return;
    const t = setTimeout(() => setVisible(true), 10);
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [row, onClose]);

  if (!row) return null;

  const { base, size, color } = parseVariantLabel(row.description || "");
  const qty       = row.stockQty || 0;
  const rate      = row.rate || 0;
  const value     = qty * rate;
  const status    = stockStatus(qty);
  const qtyColor  = qty <= 0 ? "#EF4444" : qty <= 20 ? "#D97706" : "#059669";

  const modal = (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 99998,
          background: "rgba(10,14,22,0.65)",
          backdropFilter: "blur(8px)",
          transition: "opacity .22s ease", opacity: visible ? 1 : 0,
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed", top: "50%", left: "50%",
          transform: visible
            ? "translate(-50%,-50%) scale(1)"
            : "translate(-50%,-48%) scale(0.96)",
          zIndex: 99999,
          width: "calc(100vw - 40px)", maxWidth: 600,
          maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          borderRadius: 20,
          background: "#fff",
          border: "1px solid #E8ECF4",
          boxShadow: "0 32px 80px rgba(10,14,22,0.28)",
          overflow: "hidden",
          transition: "transform .28s cubic-bezier(.16,1,.3,1), opacity .22s ease",
          opacity: visible ? 1 : 0,
        }}
      >
        {/* Header */}
        <div style={{
          flexShrink: 0, padding: "18px 22px",
          borderBottom: "1px solid #F1F5F9",
          background: "linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#0E1117", lineHeight: 1.3, wordBreak: "break-word", marginBottom: 6 }}>
              {base}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {row.sku && (
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6366f1", background: "#EEEFFE", border: "1px solid #C5C8F8", borderRadius: 6, padding: "2px 8px" }}>
                  {row.sku}
                </span>
              )}
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "#4A5168", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 6, padding: "2px 8px" }}>
                {row.barcode}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "#EEF2FF", color: "#6366F1", border: "1px solid #C7D2FE" }}>
                <FaStore style={{ fontSize: 9 }} /> {row.store_name || "Store"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: "1px solid #E8ECF4", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#8C93AB" }}
          >
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "20px 22px 24px" }}>
          {/* Classification */}
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>Classification</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
            {[
              { label: "Division",   value: row.division },
              { label: "Section",    value: row.section },
              { label: "Department", value: row.department },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: value ? "#F8FAFC" : "#FFF7ED", borderRadius: 10, padding: "10px 14px", border: value ? "1px solid #F1F5F9" : "1px solid #FED7AA" }}>
                <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: value ? "#1e293b" : "#D97706" }}>{value || "—"}</div>
              </div>
            ))}
          </div>

          {/* Stock & Pricing */}
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>Stock & Pricing</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: "16px 12px", textAlign: "center", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: qtyColor, lineHeight: 1.1 }}>{qty.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Store Qty</div>
            </div>
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: "16px 12px", textAlign: "center", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: rate > 0 ? 20 : 26, fontWeight: 800, color: "#d97706", lineHeight: 1.1 }}>
                {rate > 0 ? `₹${rate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Rate</div>
            </div>
            <div style={{ background: value > 0 ? "#eef2ff" : "#f8fafc", borderRadius: 10, padding: "16px 12px", textAlign: "center", border: value > 0 ? "1px solid #c7d2fe" : "1px solid #f1f5f9" }}>
              <div style={{ fontSize: value > 0 ? 18 : 26, fontWeight: 800, color: value > 0 ? "#6366f1" : "#cbd5e1", lineHeight: 1.1 }}>
                {value > 0 ? `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Stock Value</div>
            </div>
          </div>

          {/* Status */}
          <div style={{ marginTop: 14 }}>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${status.cls}`}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: "12px 22px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", background: "#fafafa" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 22px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(modal, document.body);
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function InventoryManagementStoreStock() {
  const [data,       setData]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [search,     setSearch]     = useState("");
  const [division,   setDivision]   = useState("");
  const [section,    setSection]    = useState("");
  const [department, setDepartment] = useState("");
  const [selectedRow,setSelectedRow]= useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [stickerItems, setStickerItems] = useState(null);
  const [mappingRows, setMappingRows] = useState([]);
  const [variantParent, setVariantParent] = useState(null);

  /* ── Auth / store context ── */
  const token     = localStorage.getItem("admin_token") ||
                    localStorage.getItem("access_token") ||
                    localStorage.getItem("token") || "";
  const storeId   = localStorage.getItem("admin_store_id") || localStorage.getItem("store_id") || "";
  const storeName = localStorage.getItem("admin_store_name") || localStorage.getItem("store_name") || "Store";
  const isSingleStore = localStorage.getItem("admin_account_type") === "single_store";
  const headers   = { Authorization: `Bearer ${token}` };

  /* ── Fetch store stock ── */
  const fetchData = useCallback(async () => {
    if (!storeId) {
      setError("No store assigned. Contact your administrator.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(
        `${API}/stock-allocation/store-stock/${storeId}`,
        { headers }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.message || `Store Stock request failed (HTTP ${res.status}).`);
      }
      const json = await res.json();
      setData(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setError(e.message || "Could not load store stock. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!isSingleStore || !token) {
      setMappingRows([]);
      return;
    }
    fetch(`${API}/api/product-mapping/single-store-suggestions`, { headers })
      .then((res) => res.ok ? res.json() : { data: [] })
      .then((body) => setMappingRows(Array.isArray(body.data) ? body.data : []))
      .catch(() => setMappingRows([]));
  }, [isSingleStore, token]);

  const readError = async (res, fallback) => {
    try {
      const body = await res.json();
      return body.detail || body.message || fallback;
    } catch { return fallback; }
  };

  const saveItemDetails = async (row, details) => {
    const res = await fetch(`${API}/stock-allocation/store-stock/${encodeURIComponent(storeId)}/${encodeURIComponent(row.barcode)}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    if (!res.ok) throw new Error(await readError(res, "Could not save item details."));
    await fetchData();
    setEditingRow((current) => current ? { ...current, ...details } : current);
  };

  const adjustItemQuantity = async (row, { qtyChange, reason, remarks }) => {
    const now = new Date();
    const res = await fetch(`${API}/inventory/stock-adjustments`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        date: now.toISOString().slice(0, 16).replace("T", " "),
        warehouse: storeName,
        ref_no: `SS-ADJ-${now.getTime().toString().slice(-8)}`,
        created_by: localStorage.getItem("admin_name") || localStorage.getItem("user_name") || "Store Owner",
        note: remarks || reason,
        lines: [{
          barcode: row.barcode, sku: row.sku || "", product: row.description || "",
          division: row.division || "", section: row.section || "", department: row.department || "",
          qty_change: qtyChange, reason, remarks,
        }],
      }),
    });
    if (!res.ok) throw new Error(await readError(res, "Could not record stock adjustment."));
    await fetchData();
    setEditingRow((current) => current ? { ...current, stockQty: Number(current.stockQty || 0) + qtyChange } : current);
  };

  const generateItemSku = async (details) => {
    const res = await fetch(`${API}/api/product-mapping/single-store-sku`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    if (!res.ok) throw new Error(await readError(res, "Could not generate an SKU."));
    const body = await res.json();
    if (!body.sku) throw new Error("The server did not return an SKU.");
    return body.sku;
  };

  const loadVariants = async (parent) => {
    const res = await fetch(`${API}/stock-allocation/store-stock/${encodeURIComponent(storeId)}/${encodeURIComponent(parent.barcode)}/variants`, { headers });
    if (!res.ok) throw new Error(await readError(res, "Could not load product variants."));
    const body = await res.json();
    return Array.isArray(body.variants) ? body.variants : [];
  };

  const createVariants = async (parent, variants) => {
    const res = await fetch(`${API}/stock-allocation/store-stock/${encodeURIComponent(storeId)}/${encodeURIComponent(parent.barcode)}/variants`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        description: parent.description, sku: parent.sku, division: parent.division,
        section: parent.section, department: parent.department, rate: parent.rate, mrp: parent.mrp,
        variants,
      }),
    });
    if (!res.ok) throw new Error(await readError(res, "Could not create variants."));
    await fetchData();
  };

  /* ── Derived filters ── */
  const divisions = useMemo(() => {
    const s = new Set(data.map((r) => r.division).filter(Boolean));
    return [...s].sort();
  }, [data]);

  const sections = useMemo(() => {
    if (!division) return [];
    const s = new Set(
      data.filter((r) => r.division === division).map((r) => r.section).filter(Boolean)
    );
    return [...s].sort();
  }, [data, division]);

  const departments = useMemo(() => {
    if (!section) return [];
    const s = new Set(
      data.filter((r) => r.section === section).map((r) => r.department).filter(Boolean)
    );
    return [...s].sort();
  }, [data, section]);

  /* ── Filtered rows ── */
  const filtered = useMemo(() => {
    let rows = data;
    if (division)   rows = rows.filter((r) => r.division   === division);
    if (section)    rows = rows.filter((r) => r.section    === section);
    if (department) rows = rows.filter((r) => r.department === department);
    if (search) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.barcode      || "").toLowerCase().includes(q) ||
          (r.description  || "").toLowerCase().includes(q) ||
          (r.sku          || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, division, section, department, search]);

  /* ── KPIs ── */
  const inStock    = filtered.filter((r) => (r.stockQty || 0) > 20).length;
  const lowStock   = filtered.filter((r) => (r.stockQty || 0) > 0 && (r.stockQty || 0) <= 20).length;
  const outStock   = filtered.filter((r) => (r.stockQty || 0) <= 0).length;
  const totalValue = filtered.reduce((s, r) => s + (r.stockQty || 0) * (r.rate || 0), 0);
  const totalQty   = filtered.reduce((s, r) => s + (r.stockQty || 0), 0);

  return (
    <>
      <ProductDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />
      {isSingleStore && <StoreStockEditorModal
        row={editingRow}
        onClose={() => setEditingRow(null)}
        onSaveDetails={saveItemDetails}
        onAdjustQuantity={adjustItemQuantity}
        onPrint={(row) => setStickerItems([row])}
        onGenerateSku={generateItemSku}
        onManageVariants={(parent) => setVariantParent(parent)}
        mappingRows={mappingRows}
      />}
      {isSingleStore && <VariantMatrixModal parent={variantParent} onClose={() => setVariantParent(null)} onLoad={loadVariants} onCreate={createVariants} />}
      {isSingleStore && stickerItems && <BarcodeStickerPrint items={stickerItems} storeName={storeName} onClose={() => setStickerItems(null)} />}

      <div className="h-full min-h-0 overflow-hidden px-3 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <FaStore className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                Store Stock
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <FaWarehouse className="text-indigo-400" />
                {storeName} · {filtered.length} SKUs
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <FaSyncAlt className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {/* Store info banner */}
        {storeId && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200">
            <FaStore className="text-indigo-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-indigo-800">{storeName}</p>
              <p className="text-xs text-indigo-500 font-mono">{storeId}</p>
            </div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-lg">
              {isSingleStore ? "Store-managed stock" : "Allocated Stock Only"}
            </span>
          </div>
        )}

        {error && (
          <div className="shrink-0 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {error}
          </div>
        )}

        {/* KPI pills */}
        <div className="flex gap-2 flex-wrap shrink-0">
          {[
            { label: "In Stock",     count: inStock,  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            { label: "Low Stock",    count: lowStock, cls: "bg-amber-50 text-amber-700 border-amber-200" },
            { label: "Out of Stock", count: outStock, cls: "bg-rose-50 text-rose-700 border-rose-200" },
          ].map((p) => (
            <span
              key={p.label}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${p.cls}`}
            >
              <span className="text-base font-bold tabular-nums">{p.count}</span> {p.label}
            </span>
          ))}
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700">
            <FaWarehouse style={{ fontSize: 11 }} />
            Value: ₹{money(totalValue)}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3 sm:p-4 rounded-2xl shadow-sm shrink-0 border border-slate-200">
          {/* Division */}
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Division</label>
            <div className="relative flex items-center rounded-xl px-3 border bg-slate-50 border-slate-200 focus-within:border-indigo-400">
              <FaLayerGroup className="text-slate-400 text-xs shrink-0" />
              <select
                className="bg-transparent outline-none py-2 w-full text-sm ml-2 appearance-none pr-6"
                value={division}
                onChange={(e) => { setDivision(e.target.value); setSection(""); setDepartment(""); }}
              >
                <option value="">All Divisions</option>
                {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <FaChevronDown className="absolute right-3 text-slate-400 text-xs pointer-events-none" />
            </div>
          </div>

          {/* Section */}
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Section</label>
            <div className={`relative flex items-center rounded-xl px-3 border bg-slate-50 border-slate-200 ${!division ? "opacity-50" : "focus-within:border-indigo-400"}`}>
              <FaFilter className="text-slate-400 text-xs shrink-0" />
              <select
                className="bg-transparent outline-none py-2 w-full text-sm ml-2 appearance-none pr-6"
                value={section}
                onChange={(e) => { setSection(e.target.value); setDepartment(""); }}
                disabled={!division}
              >
                <option value="">All Sections</option>
                {sections.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <FaChevronDown className="absolute right-3 text-slate-400 text-xs pointer-events-none" />
            </div>
          </div>

          {/* Department */}
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Department</label>
            <div className={`relative flex items-center rounded-xl px-3 border bg-slate-50 border-slate-200 ${!section ? "opacity-50" : "focus-within:border-indigo-400"}`}>
              <FaBuilding className="text-slate-400 text-xs shrink-0" />
              <select
                className="bg-transparent outline-none py-2 w-full text-sm ml-2 appearance-none pr-6"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={!section}
              >
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <FaChevronDown className="absolute right-3 text-slate-400 text-xs pointer-events-none" />
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Search</label>
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <FaSearch className="text-slate-400 shrink-0 text-xs" />
              <input
                type="text"
                placeholder="Barcode / SKU / Product"
                className="bg-transparent outline-none py-2 w-full text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm flex-1 min-h-0 overflow-hidden border border-slate-200">
          <div className="h-full overflow-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  {[
                    { col: "Barcode",   align: "left"  },
                    { col: "SKU",       align: "left"  },
                    { col: "Product",   align: "left"  },
                    { col: "Division",  align: "left"  },
                    { col: "Section",   align: "left"  },
                    { col: "Dept",      align: "left"  },
                    { col: "Qty",       align: "right" },
                    { col: "Rate",      align: "right" },
                    { col: "Value",     align: "right" },
                    { col: "Status",    align: "left"  },
                    { col: "Actions",   align: "right" },
                  ].map(({ col, align }) => (
                    <th
                      key={col}
                      className="px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                      style={{ textAlign: align }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="p-10 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <FaSyncAlt className="animate-spin text-xl text-indigo-400" />
                        <span className="text-sm">Loading store stock…</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-10 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <FaBoxes className="text-3xl opacity-30" />
                        <span className="text-sm">
                          {data.length === 0
                            ? "No stock allocated to this store yet."
                            : "No items match your filters."}
                        </span>
                        {data.length === 0 && (
                          <p className="text-xs text-slate-400 max-w-xs text-center">
                            Ask your HQ Inventory admin to allocate stock from central inventory.
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, i) => {
                    const { base, size, color } = parseVariantLabel(row.description || "");
                    const qty    = row.stockQty || 0;
                    const rate   = row.rate || 0;
                    const value  = qty * rate;
                    const status = stockStatus(qty);

                    return (
                      <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-3 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {row.barcode}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {row.sku || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-3 min-w-[180px] max-w-[240px]">
                          <span className="font-medium text-slate-800">{base}</span>
                          {(size || color) && (
                            <span className="ml-1.5 text-xs text-indigo-600 font-semibold">
                              {size}{size && color ? " · " : ""}{color}
                            </span>
                          )}
                          {(row.size_label || row.color) && (
                            <span className="ml-1.5 text-xs text-violet-700 font-semibold">
                              {row.size_label || "One Size"}{row.color ? ` · ${row.color}` : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {row.division || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {row.section || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {row.department || <span className="text-slate-300">—</span>}
                        </td>
                        <td
                          className="px-3 py-3 text-right font-bold whitespace-nowrap tabular-nums"
                          style={{
                            color: qty <= 0 ? "#EF4444" : qty <= 20 ? "#D97706" : "#0F172A",
                          }}
                        >
                          {qty.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-slate-500 whitespace-nowrap tabular-nums">
                          {rate > 0
                            ? `₹${rate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td
                          className="px-3 py-3 text-right text-xs font-semibold whitespace-nowrap tabular-nums"
                          style={{ color: value > 0 ? "#6366F1" : "#CBD5E1" }}
                        >
                          {value > 0 ? `₹${money(value)}` : "—"}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${status.cls}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {isSingleStore && <button type="button" title="Print barcode sticker" aria-label="Print barcode sticker"
                              className="grid h-7 w-7 place-items-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all"
                              onClick={() => setStickerItems([row])}><FaPrint /></button>}
                            <button type="button"
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-all"
                              onClick={() => setSelectedRow(row)}>
                              View
                            </button>
                            {isSingleStore && <button type="button"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all"
                              onClick={() => setEditingRow(row)}>
                              <FaEdit /> Edit
                            </button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {filtered.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 sticky bottom-0">
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {filtered.length} SKUs · {storeName}
                    </td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-slate-700 tabular-nums">
                      {totalQty.toLocaleString()}
                    </td>
                    <td />
                    <td className="px-3 py-3 text-right text-xs font-bold text-indigo-700 tabular-nums">
                      ₹{money(totalValue)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function VariantMatrixModal({ parent, onClose, onLoad, onCreate }) {
  const [sizes, setSizes] = useState("");
  const [colors, setColors] = useState("");
  const [rows, setRows] = useState([]);
  const [existing, setExisting] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!parent) return;
    onLoad(parent).then(setExisting).catch((err) => setMessage(err.message || "Could not load existing variants."));
  }, [parent]);
  if (!parent) return null;
  const inputStyle = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
  const addMatrix = () => {
    const sizeValues = sizes.split(",").map((value) => value.trim()).filter(Boolean);
    const colorValues = colors.split(",").map((value) => value.trim()).filter(Boolean);
    const sizeList = sizeValues.length ? sizeValues : [""];
    const colorList = colorValues.length ? colorValues : [""];
    if (!sizeValues.length && !colorValues.length) return setMessage("Enter at least one size or colour.");
    const known = new Set([...existing, ...rows].map((item) => `${item.size_label || ""}|${item.color || ""}`.toLowerCase()));
    const additions = [];
    sizeList.forEach((size_label) => colorList.forEach((color) => {
      const key = `${size_label}|${color}`.toLowerCase();
      if (!known.has(key)) { known.add(key); additions.push({ size_label, color, rate: parent.rate || "", mrp: parent.mrp || parent.rate || "", opening_qty: 0 }); }
    }));
    if (!additions.length) return setMessage("Those combinations already exist.");
    setRows((current) => [...current, ...additions]); setMessage("");
  };
  const updateRow = (index, key, value) => setRows((current) => current.map((row, i) => i === index ? { ...row, [key]: value } : row));
  const save = async () => {
    if (!rows.length) return setMessage("Add at least one new combination first.");
    setBusy(true); setMessage("");
    try { await onCreate(parent, rows); onClose(); }
    catch (err) { setMessage(err.message || "Could not create variants."); }
    finally { setBusy(false); }
  };
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-violet-700 to-fuchsia-700 px-5 py-4 text-white"><div><div className="text-lg font-extrabold">Size & Colour Variants</div><div className="mt-1 text-xs text-violet-100">{parent.description || parent.barcode} · Each combination becomes a separate SKU and barcode.</div></div><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-white/25 bg-white/10 hover:bg-white/20"><FaTimes /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {message && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</div>}
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-4"><div className="text-sm font-extrabold text-violet-900">Build a variant matrix</div><p className="mt-1 text-xs text-violet-800">Type comma-separated values, for example: sizes <b>S, M, L, XL</b> and colours <b>Red, Blue</b>. RMS creates every required combination.</p><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-700">Sizes<input className={`${inputStyle} mt-1`} value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="S, M, L, XL" /></label><label className="text-xs font-bold text-slate-700">Colours<input className={`${inputStyle} mt-1`} value={colors} onChange={(e) => setColors(e.target.value)} placeholder="Red, Blue, Black" /></label></div><button onClick={addMatrix} className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">Generate combinations</button></div>
          {existing.length > 0 && <div className="mt-5"><div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Existing variants</div><div className="flex flex-wrap gap-2">{existing.map((item) => <span key={item.barcode} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{item.size_label || "Unspecified"} / {item.color || "Default"} · {item.stockQty} qty</span>)}</div></div>}
          {rows.length > 0 && <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[680px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Size</th><th className="px-3 py-3">Colour</th><th className="px-3 py-3">Cost rate</th><th className="px-3 py-3">MRP</th><th className="px-3 py-3">Opening qty</th><th /></tr></thead><tbody>{rows.map((item, index) => <tr key={`${item.size_label}-${item.color}-${index}`} className="border-t border-slate-100"><td className="px-2 py-2"><input className={inputStyle} value={item.size_label} onChange={(e) => updateRow(index, "size_label", e.target.value)} /></td><td className="px-2 py-2"><input className={inputStyle} value={item.color} onChange={(e) => updateRow(index, "color", e.target.value)} /></td><td className="px-2 py-2"><input type="number" min="0" className={inputStyle} value={item.rate} onChange={(e) => updateRow(index, "rate", e.target.value)} /></td><td className="px-2 py-2"><input type="number" min="0" className={inputStyle} value={item.mrp} onChange={(e) => updateRow(index, "mrp", e.target.value)} /></td><td className="px-2 py-2"><input type="number" min="0" step="1" className={inputStyle} value={item.opening_qty} onChange={(e) => updateRow(index, "opening_qty", e.target.value)} /></td><td className="px-2 py-2"><button onClick={() => setRows((current) => current.filter((_, i) => i !== index))} className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50">Remove</button></td></tr>)}</tbody></table></div>}
          <p className="mt-4 text-xs text-slate-500">Any existing unclassified stock stays unchanged. Move it to the new variants only through stock adjustments after a physical count.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3"><button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">Cancel</button><button disabled={busy || !rows.length} onClick={save} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">{busy ? "Creating…" : `Create ${rows.length} variant${rows.length === 1 ? "" : "s"}`}</button></div>
      </div>
    </div>, document.body
  );
}

/* â”€â”€ Store Item Editor â€” details and quantity are deliberately separate â”€â”€ */
function StoreStockEditorModal({ row, onClose, onSaveDetails, onAdjustQuantity, onPrint, onGenerateSku, onManageVariants, mappingRows = [] }) {
  const [draft, setDraft] = useState({});
  const [qtyChange, setQtyChange] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!row) return;
    setDraft({
      description: row.description || "", sku: row.sku || "", division: row.division || "",
      section: row.section || "", department: row.department || "", rate: row.rate || "",
      mrp: row.mrp || "", vendor_name: row.vendor_name || "",
    });
    setQtyChange(""); setReason(""); setRemarks(""); setMessage("");
  }, [row]);

  if (!row) return null;
  const inputStyle = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
  const setField = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));
  const uniqueValues = (key, predicate = () => true) => [...new Set(
    mappingRows.filter(predicate).map((item) => (item[key] || "").trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
  const divisions = uniqueValues("division");
  const sections = uniqueValues("section", (item) => !draft.division || item.division === draft.division);
  const departments = uniqueValues("department", (item) =>
    (!draft.division || item.division === draft.division) &&
    (!draft.section || item.section === draft.section)
  );
  const saveDetails = async () => {
    setBusy(true); setMessage("");
    try { await onSaveDetails(row, draft); setMessage("Item details saved."); }
    catch (err) { setMessage(err.message || "Could not save item details."); }
    finally { setBusy(false); }
  };
  const adjust = async () => {
    const change = Number(qtyChange);
    if (!Number.isInteger(change) || change === 0) return setMessage("Enter a whole quantity to add or remove.");
    if (!reason) return setMessage("Select a reason for this stock adjustment.");
    setBusy(true); setMessage("");
    try {
      await onAdjustQuantity(row, { qtyChange: change, reason, remarks });
      setQtyChange(""); setReason(""); setRemarks(""); setMessage("Stock adjustment recorded in the ledger.");
    } catch (err) { setMessage(err.message || "Could not save stock adjustment."); }
    finally { setBusy(false); }
  };
  const generateSku = async () => {
    setBusy(true); setMessage("");
    try {
      const sku = await onGenerateSku(draft);
      setField("sku", sku);
      setMessage("A unique SKU was generated. Save item details to apply it.");
    } catch (err) { setMessage(err.message || "Could not generate an SKU."); }
    finally { setBusy(false); }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-indigo-700 to-violet-700 px-5 py-4 text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-lg font-extrabold"><FaEdit /> Edit Store Item</div>
            <div className="mt-1 truncate text-xs text-indigo-100">{row.description || row.barcode} Â· Barcode: <span className="font-mono">{row.barcode}</span></div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20"><FaTimes /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {message && <div className={`mb-4 rounded-xl border px-3 py-2 text-sm ${message.includes("saved") || message.includes("recorded") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message}</div>}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
            <div><div className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Current store quantity</div><div className="text-2xl font-extrabold text-indigo-900">{Number(row.stockQty || 0).toLocaleString()}</div></div>
            <div className="flex flex-wrap gap-2"><button onClick={() => onManageVariants({ ...row, ...draft })} className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100">Variants</button><button onClick={() => onPrint(row)} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"><FaPrint /> Print barcode sticker</button></div>
          </div>

          <section>
            <div className="mb-3 text-sm font-extrabold text-slate-800">Item details</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-xs font-semibold text-slate-600">Product / description<input className={`${inputStyle} mt-1`} value={draft.description} onChange={(e) => setField("description", e.target.value)} /></label>
              <label className="text-xs font-semibold text-slate-600">SKU<div className="mt-1 flex gap-2"><input className={inputStyle} value={draft.sku} onChange={(e) => setField("sku", e.target.value)} placeholder="Type or generate SKU" /><button type="button" disabled={busy} onClick={generateSku} className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-extrabold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">Generate</button></div></label>
              <label className="text-xs font-semibold text-slate-600">Vendor / brand<input className={`${inputStyle} mt-1`} value={draft.vendor_name} onChange={(e) => setField("vendor_name", e.target.value)} /></label>
              <label className="text-xs font-semibold text-slate-600">Division<input list="single-store-divisions" className={`${inputStyle} mt-1`} value={draft.division} onChange={(e) => setField("division", e.target.value)} placeholder="Select or type a division" /><datalist id="single-store-divisions">{divisions.map((value) => <option key={value} value={value} />)}</datalist></label>
              <label className="text-xs font-semibold text-slate-600">Section<input list="single-store-sections" className={`${inputStyle} mt-1`} value={draft.section} onChange={(e) => setField("section", e.target.value)} placeholder="Select or type a section" /><datalist id="single-store-sections">{sections.map((value) => <option key={value} value={value} />)}</datalist></label>
              <label className="text-xs font-semibold text-slate-600">Department<input list="single-store-departments" className={`${inputStyle} mt-1`} value={draft.department} onChange={(e) => setField("department", e.target.value)} placeholder="Select or type a department" /><datalist id="single-store-departments">{departments.map((value) => <option key={value} value={value} />)}</datalist></label>
              <label className="text-xs font-semibold text-slate-600">Selling rate<input type="number" min="0" className={`${inputStyle} mt-1`} value={draft.rate} onChange={(e) => setField("rate", e.target.value)} /></label>
              <label className="text-xs font-semibold text-slate-600">MRP<input type="number" min="0" className={`${inputStyle} mt-1`} value={draft.mrp} onChange={(e) => setField("mrp", e.target.value)} /></label>
            </div>
            <button disabled={busy} onClick={saveDetails} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"><FaSave /> Save item details</button>
          </section>

          <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-amber-900"><FaExchangeAlt /> Adjust quantity</div>
            <p className="mt-1 text-xs text-amber-800">Use a positive number to add stock or a negative number to remove it. This creates a permanent stock-ledger record; it never overwrites the quantity.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">Quantity change<input type="number" step="1" placeholder="e.g. 5 or -2" className={`${inputStyle} mt-1`} value={qtyChange} onChange={(e) => setQtyChange(e.target.value)} /></label>
              <label className="text-xs font-semibold text-slate-700">Reason<select className={`${inputStyle} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)}><option value="">Select reason</option><option>Physical count correction</option><option>Damage / expiry</option><option>Customer return</option><option>Opening stock correction</option><option>Other</option></select></label>
              <label className="sm:col-span-2 text-xs font-semibold text-slate-700">Remarks (optional)<input className={`${inputStyle} mt-1`} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Explain the adjustment" /></label>
            </div>
            <button disabled={busy} onClick={adjust} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"><FaExchangeAlt /> Record stock adjustment</button>
          </section>
        </div>
        <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-3"><button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">Close</button></div>
      </div>
    </div>, document.body
  );
}
