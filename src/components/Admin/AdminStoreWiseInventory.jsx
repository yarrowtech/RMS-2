import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useState } from "react";
import { FaSearch, FaWarehouse, FaSync } from "react-icons/fa";

const API = APP_API_URL;
const cn = (...a) => a.filter(Boolean).join(" ");

const INP = "w-full bg-white rounded-lg px-3 py-2 text-sm text-slate-900 border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none placeholder:text-slate-400 transition";
const fmtQty = (n) => Number(n || 0).toLocaleString("en-IN");
const fmtVal = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function authHeaders() {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { Authorization: `Bearer ${token}` };
}

/* ── All-stores totals, side by side ── */
function StoreStockSummary({ refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`${API}/stock-allocation/store-summary`, { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json) => setRows(json.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const totalQty = rows.reduce((sum, r) => sum + r.total_qty, 0);
  const totalValue = rows.reduce((sum, r) => sum + r.total_value, 0);

  if (loading) return <div className="p-10 text-center text-slate-400 text-sm">Loading store comparison…</div>;
  if (error) return <div className="p-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">⚠ {error}</div>;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["Location", "Items in stock", "Total qty", "Stock value"].map((h) => (
                <th key={h} className={cn("px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500", h === "Location" ? "text-left" : "text-right")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.store_id || "central"} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">{r.store_name}</td>
                <td className="px-4 py-3 text-right font-mono">{fmtQty(r.item_count)}</td>
                <td className="px-4 py-3 text-right font-mono">{fmtQty(r.total_qty)}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-600">{fmtVal(r.total_value)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400 text-sm">No stores found.</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-900">All locations</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right font-mono font-bold">{fmtQty(totalQty)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{fmtVal(totalValue)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ── Item-level matrix — every product's qty at every location ── */
function ItemMatrixView({ refreshKey }) {
  const [stores, setStores] = useState([]);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (search.trim()) params.append("search", search.trim());
    const handle = setTimeout(() => {
      fetch(`${API}/stock-allocation/item-matrix?${params}`, { headers: authHeaders() })
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((json) => { setStores(json.stores || []); setRows(json.data || []); setCount(json.count || 0); })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [search, refreshKey]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-3 border-b border-slate-200">
        <div className="relative max-w-xs">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, SKU or barcode…"
            className={cn(INP, "pl-8")} />
        </div>
      </div>
      {error && <div className="p-4 text-sm text-rose-600 bg-rose-50 border-b border-rose-200">⚠ {error}</div>}
      {loading ? (
        <div className="p-10 text-center text-slate-400 text-sm">Loading item matrix…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Product</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Central</th>
                {stores.map((s) => (
                  <th key={s.id} className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.barcode} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{r.description}</div>
                    <div className="text-xs text-slate-400 font-mono">{r.barcode}{r.sku ? ` · ${r.sku}` : ""}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{fmtQty(r.central_qty)}</td>
                  {stores.map((s) => (
                    <td key={s.id} className={cn("px-4 py-3 text-right font-mono", !r.store_qty[s.id] && "text-slate-300")}>
                      {fmtQty(r.store_qty[s.id] || 0)}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={stores.length + 2} className="px-4 py-10 text-center text-slate-400 text-sm">No products found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {count > rows.length && (
        <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
          Showing {rows.length} of {count} products — refine your search to narrow this down.
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Store-wise Inventory — dedicated HQ page.
   Central + every store/branch's stock side by side (totals), plus an
   item-level matrix (one row per product, one column per store) so HQ
   can see exactly which branch holds how much of a specific SKU.
══════════════════════════════════════════════════════════════════ */
export default function AdminStoreWiseInventory() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FaWarehouse className="text-indigo-600 text-2xl shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Store-wise Inventory</h1>
            <p className="text-xs text-slate-500 mt-0.5">Central stock plus every store/branch's stock, side by side.</p>
          </div>
        </div>
        <button onClick={() => setRefreshKey((k) => k + 1)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition shadow-sm">
          <FaSync size={12} /> Refresh
        </button>
      </div>

      <StoreStockSummary refreshKey={refreshKey} />

      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">Item-level breakdown</h2>
        <ItemMatrixView refreshKey={refreshKey} />
      </div>
    </div>
  );
}
