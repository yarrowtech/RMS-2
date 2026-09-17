import React, { useCallback, useEffect, useState } from "react";
import { getAdminName, getAdminScope, getStoreName, logoutOrReturnToDepartmentSelector } from "../utils/authRedirect";
import { API_BASE_URL } from "../config/api.js";
import {
  LineChart, TrendingUp, TrendingDown, Minus, Building2, Wallet, LogOut,
  Search, RefreshCw, AlertTriangle, ShoppingCart, BarChart3,
  UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, Undo2, History, Download, Trash2,
  Warehouse,
} from "lucide-react";
import {
  Bar, BarChart as RechartsBarChart, CartesianGrid, Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

function getAdminToken() {
  return (
    localStorage.getItem("admin_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

async function faFetch(path, options = {}) {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Request failed.");
  return data;
}

/* multipart upload — no JSON Content-Type header, FastAPI sets the boundary */
async function faUpload(path, file, extra = {}) {
  const token = getAdminToken();
  const form = new FormData();
  form.append("file", file);
  Object.entries(extra).forEach(([key, value]) => form.append(key, value));
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    throw new Error(typeof detail === "string" ? detail : detail?.message || "Upload failed.");
  }
  return data;
}

async function faDownload(path, filename) {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Could not download the template.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const MENU = [
  { id: "dashboard", label: "Overview", icon: BarChart3 },
  { id: "demand", label: "Demand Forecast", icon: LineChart },
  { id: "vendors", label: "Vendor Ranking", icon: Building2 },
  { id: "purchase", label: "Purchase Plan", icon: Wallet },
  { id: "alerts", label: "Low Stock Alerts", icon: AlertTriangle },
];

const SEVERITY_STYLE = {
  critical: "bg-rose-50 text-rose-700 border-rose-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
};

const FA_UI_STYLES = `
  .fa-workspace { min-height: 100vh; color: #17213a; background: radial-gradient(circle at 88% -8%, rgba(129,140,248,.16), transparent 32rem), radial-gradient(circle at 38% 0%, rgba(217,70,239,.10), transparent 31rem), #f5f7fb; }
  .fa-workspace .fa-sidebar { width: 280px; background: linear-gradient(165deg, #1e1b4b 0%, #312e81 50%, #6d28d9 145%); box-shadow: 14px 0 40px rgba(15,23,42,.10); }
  .fa-workspace .fa-brand { border: 1px solid rgba(255,255,255,.13); background: rgba(255,255,255,.065); }
  .fa-workspace .fa-nav-item { color: #c7d2fe; border: 1px solid transparent; }
  .fa-workspace .fa-nav-item:hover { background: rgba(255,255,255,.075); color: #fff; }
  .fa-workspace .fa-nav-item-active { color: #fff; border-color: rgba(199,210,254,.22); background: linear-gradient(90deg, rgba(99,102,241,.34), rgba(217,70,239,.26)); box-shadow: 0 8px 18px rgba(2,6,23,.18); }
  .fa-workspace .fa-content { min-width: 0; }
  .fa-workspace .fa-header { background: rgba(255,255,255,.86); border-bottom: 1px solid #e5eaf2; backdrop-filter: blur(14px); }
  .fa-workspace .fa-panel { background: rgba(255,255,255,.94); border: 1px solid #e2e8f0; border-radius: 20px; box-shadow: 0 14px 35px rgba(15,23,42,.07); }
  .fa-workspace input, .fa-workspace select { border-color: #d9e2ef; background: #fbfcfe; color: #17213a; }
  .fa-workspace input:focus, .fa-workspace select:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
  .fa-workspace table thead { background: #f6f8fc; }
  .fa-workspace table th { color: #66748d; font-size: .68rem; letter-spacing: .07em; }
  .fa-workspace table td { color: #3b4860; }
  .fa-workspace table tbody tr:hover { background: #f8fbff !important; }
  .fa-workspace .fa-stat-card { border: 1px solid #e4eaf2; background: rgba(255,255,255,.92); border-radius: 18px; box-shadow: 0 12px 26px rgba(15,23,42,.055); }
  @media (max-width: 900px) { .fa-workspace .fa-sidebar { width: 76px; } .fa-workspace .fa-brand-copy, .fa-workspace .fa-nav-label, .fa-workspace .fa-sidebar-note { display: none; } .fa-workspace .fa-nav-item { justify-content: center; padding-left: 0; padding-right: 0; } .fa-workspace .fa-nav-item svg { margin-right: 0; } }
`;

function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">⚠ {message}</div>;
}

function TrendBadge({ trend }) {
  const cfg = {
    rising: { icon: TrendingUp, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    falling: { icon: TrendingDown, cls: "bg-rose-50 text-rose-700 border-rose-200" },
    stable: { icon: Minus, cls: "bg-slate-100 text-slate-600 border-slate-200" },
  }[trend] || { icon: Minus, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  const Icon = cfg.icon;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${cfg.cls}`}><Icon size={11} />{trend}</span>;
}

/* ── Dashboard ── */
function DashboardView({ onNavigate, raphaaaMode = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});

  useEffect(() => {
    faFetch("/api/forecast-analytics/dashboard")
      .then((r) => setData(r))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const demandRows = data?.top_forecasted_items || [];
  const visibleDemandRows = filterProductRows(demandRows, search, filters, BASIC_PRODUCT_FILTERS).slice(0, 5);

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} />
      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-900 px-6 py-7 text-white shadow-[0_16px_35px_rgba(15,23,42,.14)] sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-indigo-200">Forecast & Analytics</p>
        <h3 className="mt-1 text-xl font-bold">Top forecasted demand — last 90 days</h3>
        <p className="mt-1 text-sm text-indigo-100/75">Simple moving average over your real sales history, not a mock chart.</p>
      </section>

      {!loading && Boolean(data?.low_stock_alert_count) && (
        <button
          type="button"
          onClick={() => onNavigate?.("alerts")}
          className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left transition hover:bg-rose-100"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-rose-800">{data.low_stock_alert_count} item{data.low_stock_alert_count === 1 ? "" : "s"} projected to run low on stock</p>
            <p className="mt-0.5 text-xs text-rose-600">Based on current stock vs. average daily sales — updated by the daily automation run. View details →</p>
          </div>
        </button>
      )}

      {raphaaaMode && !loading && (
        <ProductFilterPanel
          rows={demandRows} search={search} setSearch={setSearch} filters={filters} setFilters={setFilters}
          fields={BASIC_PRODUCT_FILTERS}
          title="Overview product filters"
          description="Choose a hierarchy or supplier to see its five highest-demand products. The alert count above remains the tenant-wide total."
        />
      )}

      <div className="fa-panel overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4"><h4 className="text-sm font-bold text-slate-900">Top 5 items by recent demand</h4></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{["Item", "SKU", "Weekly avg", "Next-period forecast", "Trend"].map((h) => <th key={h} className="px-4 py-2.5 text-left font-bold uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
                : !visibleDemandRows.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{demandRows.length ? "No products match the selected filters." : "No sales history yet in the lookback window."}</td></tr>
                : visibleDemandRows.map((row) => (
                  <tr key={row.barcode}>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">
                      {row.name || row.barcode}
                      {raphaaaMode && <span className="mt-0.5 block text-[10px] font-normal text-slate-400">{[row.section, row.department, row.design_no, row.brand, row.size].filter(Boolean).join(" / ")}</span>}
                      {raphaaaMode && row.vendor_name && <span className="block text-[10px] font-semibold text-blue-600">Supplier: {row.vendor_name}</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{row.sku}</td>
                    <td className="px-4 py-2.5">{row.avg_weekly_qty}</td>
                    <td className="px-4 py-2.5 font-bold">{row.forecast_next_period_qty}</td>
                    <td className="px-4 py-2.5"><TrendBadge trend={row.trend} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {data?.footfall && !data.footfall.available && (
        <div className="fa-stat-card flex items-start gap-3 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-bold text-slate-900">Footfall isn't tracked yet</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{data.footfall.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Demand Forecast ── */
const FORECAST_FILTERS = [
  ["division", "Division"], ["section", "Section"], ["department", "Department"],
  ["design_no", "Design No."], ["brand", "Brand"], ["style", "Style"],
  ["product_type", "Type"], ["size", "Size"], ["vendor_name", "Vendor"],
];

const BASIC_PRODUCT_FILTERS = [
  ["division", "Division"], ["section", "Section"], ["department", "Department"],
  ["design_no", "Design No."], ["brand", "Brand"], ["vendor_name", "Vendor"],
];
const VENDOR_RESULT_FILTERS = [["vendor_name", "Vendor"], ["category", "Category"]];
const ALERT_BASE_FILTERS = [["store_name", "Location"], ["severity", "Severity"]];
const PLAN_BASE_FILTERS = [["trend", "Trend"]];

function filterProductRows(rows, search, filters, fields) {
  const wanted = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (wanted && ![
      row.name, row.item_name, row.sku, row.barcode, row.design_no,
      row.vendor_name, row.category, row.store_name, row.severity,
    ].some((value) => String(value || "").toLowerCase().includes(wanted))) return false;
    return fields.every(([key]) => !filters[key] || String(row[key] || "") === String(filters[key]));
  });
}

function ProductFilterPanel({ rows, search, setSearch, filters, setFilters, fields, title, description }) {
  const options = React.useMemo(() => Object.fromEntries(
    fields.map(([key]) => [key, [...new Set(rows.map((row) => row[key]).filter((value) => value !== "" && value != null))]
      .sort((a, b) => String(a).localeCompare(String(b)))])
  ), [rows, fields]);
  const count = filterProductRows(rows, search, filters, fields).length;

  return (
    <div className="fa-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h4 className="text-sm font-bold text-slate-900">{title}</h4><p className="mt-0.5 text-xs text-slate-500">{description}</p></div>
        <button type="button" onClick={() => { setSearch(""); setFilters({}); }} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">Clear filters</button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, SKU, barcode, design or vendor" className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm" />
        </div>
        {fields.map(([key, label]) => (
          <select key={key} value={filters[key] || ""} onChange={(e) => setFilters((old) => ({ ...old, [key]: e.target.value }))} className="rounded-lg border px-2.5 py-2 text-sm">
            <option value="">All {label}</option>
            {(options[key] || []).map((value) => <option key={String(value)} value={String(value)}>{value}</option>)}
          </select>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-400">Showing {count} of {rows.length} records.</p>
    </div>
  );
}

function DemandForecastView({ raphaaaMode = false }) {
  const [rows, setRows] = useState([]);
  const [lookbackDays, setLookbackDays] = useState(90);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await faFetch(`/api/forecast-analytics/demand-forecast?lookback_days=${lookbackDays}&limit=${raphaaaMode ? 1000 : 50}`);
      setRows(r.data || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [lookbackDays, raphaaaMode]);

  useEffect(() => { load(); }, [load]);

  const filterOptions = React.useMemo(() => Object.fromEntries(
    FORECAST_FILTERS.map(([key]) => [key, [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)))])
  ), [rows]);

  const filteredRows = React.useMemo(() => {
    const wanted = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (wanted && ![row.name, row.sku, row.barcode, row.design_no, row.vendor_name]
        .some((value) => String(value || "").toLowerCase().includes(wanted))) return false;
      return FORECAST_FILTERS.every(([key]) => !filters[key] || row[key] === filters[key]);
    });
  }, [rows, search, filters]);

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />
      <div className="fa-panel flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Demand forecast</h4>
          <p className="mt-0.5 text-xs text-slate-500">Simple moving average over the last 3 weeks of real sales, per item.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500">Lookback</label>
          <select value={lookbackDays} onChange={(e) => setLookbackDays(Number(e.target.value))} className="rounded-lg border px-2.5 py-1.5 text-sm">
            {[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      {raphaaaMode && (
        <div className="fa-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Product hierarchy filters</h4>
              <p className="mt-0.5 text-xs text-slate-500">Segregate imported products by the Division, Section, Department and category hierarchy from your Sales Excel.</p>
            </div>
            <button type="button" onClick={() => { setSearch(""); setFilters({}); }} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">Clear filters</button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Product, SKU, barcode, design or vendor" className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm" />
            </div>
            {FORECAST_FILTERS.map(([key, label]) => (
              <select key={key} value={filters[key] || ""} onChange={(e) => setFilters((old) => ({ ...old, [key]: e.target.value }))} className="rounded-lg border px-2.5 py-2 text-sm">
                <option value="">All {label}</option>
                {(filterOptions[key] || []).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-400">Showing {filteredRows.length} of {rows.length} forecasted products.</p>
        </div>
      )}

      <div className="fa-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{["Item", "SKU", "Weeks active", "Weekly avg", "Forecast (next)", "Trend", "Avg price", "Avg cost", "Margin/unit"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left font-bold uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
                : filteredRows.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">{rows.length ? "No products match the selected hierarchy filters." : "No sales history in this window yet."}</td></tr>
                : filteredRows.map((row) => (
                  <tr key={row.barcode}>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">
                      {row.name || row.barcode}
                      {raphaaaMode && <span className="mt-0.5 block text-[10px] font-normal text-slate-400">{[row.division, row.section, row.department, row.design_no, row.style, row.product_type, row.size].filter(Boolean).join(" / ")}</span>}
                      {raphaaaMode && row.vendor_name && <span className="mt-0.5 block text-[10px] font-semibold text-blue-600">Supplier: {row.vendor_name}{!row.vendor_linked ? " · imported/unlinked" : ""}</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{row.sku}</td>
                    <td className="px-4 py-2.5">{row.weeks_active}</td>
                    <td className="px-4 py-2.5">{row.avg_weekly_qty}</td>
                    <td className="px-4 py-2.5 font-bold">{row.forecast_next_period_qty}</td>
                    <td className="px-4 py-2.5"><TrendBadge trend={row.trend} /></td>
                    <td className="px-4 py-2.5">₹{row.avg_selling_price}</td>
                    <td className="px-4 py-2.5">₹{row.avg_cost_price}</td>
                    <td className="px-4 py-2.5 font-semibold text-emerald-700">₹{row.margin_per_unit}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Vendor Ranking ── */
function GenericVendorRankingView() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [resultSearch, setResultSearch] = useState("");
  const [resultFilters, setResultFilters] = useState({});

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true); setError(null); setSearched(true);
    try {
      const r = await faFetch(`/api/forecast-analytics/vendor-ranking?q=${encodeURIComponent(q.trim())}&limit=20`);
      setRows(r.data || []);
      setNote(r.note || "");
      setResultSearch(""); setResultFilters({});
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const visibleRows = filterProductRows(rows, resultSearch, resultFilters, VENDOR_RESULT_FILTERS);

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />
      <div className="fa-panel p-5">
        <h4 className="text-sm font-bold text-slate-900">Vendor ranking</h4>
        <p className="mt-1 text-xs font-semibold text-indigo-600">Score: price 50% · MOQ 20% · your PO history 30%. Average fulfillment days are shown for review but are not yet part of the score.</p>
        <p className="mt-0.5 text-xs text-slate-500">Ranked by price, MOQ, and your own order/fulfillment history with each vendor — only vendors with an Approved relationship to you are shown.</p>
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Search product name or category…" className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm" />
          </div>
          <button onClick={search} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">Search</button>
        </div>
      </div>

      {searched && (
        <>
        <ProductFilterPanel
          rows={rows} search={resultSearch} setSearch={setResultSearch} filters={resultFilters} setFilters={setResultFilters}
          fields={VENDOR_RESULT_FILTERS}
          title="Refine vendor results"
          description="The main search finds matching catalogue products. These filters narrow that result by approved vendor or catalogue category without changing the ranking score."
        />
        <div className="fa-panel overflow-hidden">
          {note && <p className="border-b border-slate-100 bg-amber-50 px-5 py-2.5 text-xs font-semibold text-amber-700">{note}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>{["Vendor", "Item", "Category", "Price range", "MOQ", "Orders with you", "Avg fulfillment", "Score"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left font-bold uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Searching…</td></tr>
                  : visibleRows.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{rows.length ? "No vendor results match these filters." : "No approved vendors match this search."}</td></tr>
                  : visibleRows.map((row) => (
                    <tr key={row.catalogue_item_id}>
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-slate-800">{row.vendor_name}</p>
                        {row.vendor_email && <p className="text-xs text-slate-400">{row.vendor_email}</p>}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{row.item_name}</td>
                      <td className="px-4 py-2.5">{row.category}</td>
                      <td className="px-4 py-2.5">₹{row.price_range_min}–₹{row.price_range_max}</td>
                      <td className="px-4 py-2.5">{row.moq}</td>
                      <td className="px-4 py-2.5">{row.po_count_with_you}</td>
                      <td className="px-4 py-2.5">{row.avg_fulfillment_days != null ? `${row.avg_fulfillment_days} days` : "—"}</td>
                      <td className="px-4 py-2.5 font-bold text-indigo-700">{row.score}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

function VendorRankingView({ raphaaaMode = false }) {
  return raphaaaMode ? <RaphaaaVendorRankingView /> : <GenericVendorRankingView />;
}

function RaphaaaVendorRankingView() {
  const [historyPeriods, setHistoryPeriods] = useState(2);
  const [periodMode, setPeriodMode] = useState("calendar_year");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [metric, setMetric] = useState("net_sales");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setResult(await faFetch("/api/forecast-analytics/purchase-plan/raphaaa", {
        method: "POST",
        body: JSON.stringify({
          history_periods: historyPeriods,
          period_mode: periodMode,
          season_start_month: 10,
          season_end_month: 2,
        }),
      }));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [historyPeriods, periodMode]);

  useEffect(() => { load(); }, [load]);

  const filterFields = React.useMemo(() => [
    ...BASIC_PRODUCT_FILTERS, ["style", "Style"], ["product_type", "Type"],
    ["size", "Size"], ["promotion", "Promotion"], ["confidence", "Confidence"],
  ], []);
  const lines = React.useMemo(() => result?.lines || [], [result]);
  const visibleLines = React.useMemo(
    () => filterProductRows(lines, search, filters, filterFields),
    [lines, search, filters, filterFields],
  );
  const rankedVendors = React.useMemo(() => aggregateRaphaaaVendors(visibleLines)
    .sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0)), [visibleLines, metric]);
  const chartRows = rankedVendors.slice(0, 10);
  const summary = React.useMemo(() => ({
    vendor_count: rankedVendors.length,
    net_sales: visibleLines.reduce((sum, row) => sum + Number(row.net_sales || 0), 0),
    units_sold: visibleLines.reduce((sum, row) => sum + Object.values(row.quantities_by_period || {}).reduce((total, value) => total + Number(value || 0), 0), 0),
    final_purchase_qty: visibleLines.reduce((sum, row) => sum + Number(row.final_purchase_qty || 0), 0),
  }), [rankedVendors, visibleLines]);
  const periods = result?.periods || [];
  const isMoneyMetric = ["gross_sales", "discount_amount", "net_sales", "estimated_purchase_amount"].includes(metric);

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />
      <div className="fa-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h4 className="text-base font-black text-slate-900">Raphaaa vendor performance ranking</h4>
            <p className="mt-1 text-sm text-slate-600">Ranks suppliers from Raphaaa's actual product sales, returns, discounts, current stock and calculated repurchase need—not catalogue price or a hidden score.</p>
            <p className="mt-2 text-xs text-slate-500">How it's built: every filtered product line (same population as Purchase Plan) is grouped by its attributed vendor, and each vendor's units sold, gross/net sales, discount amount and recommended purchase quantity are summed straight from that real history — then vendors are sorted by whichever measure you pick above. There is no weighted composite score; changing the measure changes the ranking.</p>
            <p className="mt-2 text-xs text-slate-500">Vendor attribution uses the latest posted GRN first, then the Product Master supplier. Imported vendor names remain visible as unlinked evidence until they are connected to an approved RMS vendor.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-bold text-slate-600">Comparison
              <select value={periodMode} onChange={(e) => setPeriodMode(e.target.value)} className="mt-1 block rounded-lg border px-2.5 py-2 text-sm">
                <option value="calendar_year">Completed calendar years</option>
                <option value="seasonal_window">Winter seasons (Oct–Feb)</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">Periods
              <select value={historyPeriods} onChange={(e) => setHistoryPeriods(Number(e.target.value))} className="mt-1 block rounded-lg border px-2.5 py-2 text-sm">
                {[2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"><RefreshCw size={14} />{loading ? "Ranking…" : "Recalculate"}</button>
          </div>
        </div>
        {result && <p className="mt-3 text-xs text-slate-500">Compared: {periods.map((period) => period.label).join(", ")} · Snapshot: {new Date(result.generated_at).toLocaleString("en-IN")} · {result.data_quality?.invoice_count || 0} sales/return documents reviewed.</p>}
      </div>

      <ProductFilterPanel rows={lines} search={search} setSearch={setSearch} filters={filters} setFilters={setFilters} fields={filterFields} title="Vendor ranking filters" description="All cards, the chart, vendor table and product evidence use this same filtered product population." />

      {result && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Vendors represented" value={summary.vendor_count.toLocaleString("en-IN")} />
          <StatTile label="Units sold" value={summary.units_sold.toLocaleString("en-IN")} />
          <StatTile label="Historical net sales" value={formatMoney(summary.net_sales)} tone="emerald" />
          <StatTile label="Recommended repurchase" value={summary.final_purchase_qty.toLocaleString("en-IN")} tone="amber" />
        </div>

        <div className="fa-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h4 className="text-sm font-black text-slate-900">Top vendors by selected measure</h4><p className="mt-1 text-xs text-slate-500">The bars start at zero and rank the top 10 suppliers; choose the operational measure you want to compare.</p></div>
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className="rounded-lg border px-2.5 py-2 text-xs font-bold">
              <option value="net_sales">Net sales</option><option value="units_sold">Units sold</option><option value="gross_sales">Gross sales</option><option value="discount_amount">Discount amount</option><option value="final_purchase_qty">Recommended quantity</option><option value="estimated_purchase_amount">Estimated purchase amount</option>
            </select>
          </div>
          <div className="mt-4 h-[390px]">
            {chartRows.length ? <ResponsiveContainer width="100%" height="100%"><RechartsBarChart data={chartRows} layout="vertical" margin={{ top: 5, right: 24, left: 38, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, "auto"]} /><YAxis type="category" dataKey="vendor_name" width={145} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value) => [isMoneyMetric ? formatMoney(value) : Number(value).toLocaleString("en-IN"), metric.replaceAll("_", " ")]} />
              <Bar dataKey={metric} name={metric.replaceAll("_", " ")} fill="#7c3aed" radius={[0, 5, 5, 0]} />
            </RechartsBarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-400">{loading ? "Calculating vendor rankings…" : "No vendor evidence matches this selection."}</div>}
          </div>
        </div>

        <div className="fa-panel overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4"><h4 className="text-sm font-black text-slate-900">Vendor ranking details</h4><p className="mt-1 text-xs text-slate-500">Rank is based only on the selected chart measure. Discount results are descriptive and do not prove that a promotion caused sales.</p></div>
          <div className="max-h-[480px] overflow-auto"><table className="min-w-[1380px] w-full text-xs">
            <thead className="sticky top-0 z-10"><tr>{["Rank", "Vendor", "Products", "Units sold", "Gross sales", "Discount", "Discount rate", "Net sales", "Repurchase qty", "Purchase amount", "Top product"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3 text-left font-black uppercase">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{rankedVendors.length ? rankedVendors.map((row, index) => <tr key={row.vendor_name}>
              <td className="px-3 py-3 text-sm font-black text-indigo-700">#{index + 1}</td>
              <td className="px-3 py-3"><span className="font-bold text-slate-900">{row.vendor_name}</span><span className={`mt-1 block text-[10px] font-bold ${row.unlinked_product_count ? "text-amber-600" : "text-emerald-600"}`}>{row.unlinked_product_count ? `${row.unlinked_product_count} product(s) imported / unlinked` : "Linked supplier evidence"}</span></td>
              <td className="px-3 py-3">{row.product_count}</td><td className="px-3 py-3">{row.units_sold.toLocaleString("en-IN")}</td><td className="px-3 py-3">{formatMoney(row.gross_sales)}</td><td className="px-3 py-3 text-rose-600">{formatMoney(row.discount_amount)}</td><td className="px-3 py-3">{row.discount_rate.toFixed(1)}%</td><td className="px-3 py-3 font-bold">{formatMoney(row.net_sales)}</td><td className="px-3 py-3 font-bold text-emerald-700">{row.final_purchase_qty.toLocaleString("en-IN")}</td><td className="px-3 py-3">{formatMoney(row.estimated_purchase_amount)}</td><td className="px-3 py-3">{row.top_product}<span className="block text-[10px] text-slate-400">{formatMoney(row.top_product_net_sales)} net sales</span></td>
            </tr>) : <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">No vendor evidence matches the selected filters.</td></tr>}</tbody>
          </table></div>
        </div>

        <div className="fa-panel overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4"><h4 className="text-sm font-black text-slate-900">Product evidence behind the ranking</h4><p className="mt-1 text-xs text-slate-500">Use this table to verify which design, promotion, stock position and purchase recommendation contributed to each vendor total.</p></div>
          <div className="max-h-[480px] overflow-auto"><table className="min-w-[1450px] w-full text-xs">
            <thead className="sticky top-0 z-10"><tr>{["Vendor", "Product / hierarchy", "Promotion", "Units sold", "Gross", "Discount", "Net", "Current stock", "Final qty", "Evidence"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3 text-left font-black uppercase">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{visibleLines.length ? visibleLines.map((line) => <tr key={line.stock_identity || line.barcode}>
              <td className="px-3 py-3"><span className="font-bold">{line.vendor_name || "Vendor unavailable"}</span>{line.vendor_name && !line.vendor_linked && <span className="block text-[10px] font-bold text-amber-600">Imported / unlinked</span>}</td>
              <td className="px-3 py-3"><span className="font-bold text-slate-900">{line.name}</span><span className="block text-[10px] text-slate-400">{[line.division, line.section, line.department, line.design_no, line.brand, line.style, line.size].filter(Boolean).join(" / ")}</span></td>
              <td className="px-3 py-3">{line.promotion || "No promotion label"}</td><td className="px-3 py-3">{Object.values(line.quantities_by_period || {}).reduce((sum, value) => sum + Number(value || 0), 0).toLocaleString("en-IN")}</td><td className="px-3 py-3">{formatMoney(line.gross_sales)}</td><td className="px-3 py-3 text-rose-600">{formatMoney(line.discount_amount)}</td><td className="px-3 py-3 font-bold">{formatMoney(line.net_sales)}</td><td className="px-3 py-3">{Number(line.current_stock_qty || 0).toLocaleString("en-IN")}</td><td className="px-3 py-3 font-black text-emerald-700">{Number(line.final_purchase_qty || 0).toLocaleString("en-IN")}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${line.confidence === "High" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{line.confidence}</span></td>
            </tr>) : <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">No products match the selected filters.</td></tr>}</tbody>
          </table></div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><p className="font-black">Data-quality check</p><p>{result.data_quality?.vendor_caveat}</p></div>
          <div className="fa-panel p-4 text-xs leading-5 text-slate-600"><p className="font-black text-slate-900">How to use it</p><p>1. Select comparable years or winter seasons. 2. Filter the product hierarchy. 3. Choose a ranking measure. 4. Verify the product evidence and unlinked suppliers. 5. Use the Purchase Plan tab for row-level quantities before Procurement creates a PO.</p></div>
        </div>
      </>}
    </div>
  );
}

/* ── Low Stock Alerts (automation output) ── */
function AlertsView({ raphaaaMode = false }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});

  const load = useCallback(() => {
    setLoading(true); setError(null);
    faFetch("/api/forecast-analytics/alerts")
      .then((r) => setRows(r.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const alertFields = React.useMemo(() => raphaaaMode ? [...ALERT_BASE_FILTERS, ...BASIC_PRODUCT_FILTERS] : ALERT_BASE_FILTERS, [raphaaaMode]);
  const visibleRows = filterProductRows(rows, search, filters, alertFields);

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />
      <div className="fa-panel flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Low stock alerts</h4>
          <p className="mt-0.5 text-xs text-slate-500">Current on-hand stock vs. average daily sales. Recomputed once a day by the automation run, not live on page load.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"><RefreshCw size={13} /> Refresh</button>
      </div>

      <ProductFilterPanel
        rows={rows} search={search} setSearch={setSearch} filters={filters} setFilters={setFilters}
        fields={alertFields}
        title="Alert filters"
        description="Filter by location and severity. Raphaaa can also narrow alerts using the imported product hierarchy and supplier. Refresh reloads the saved daily calculation."
      />

      <div className="fa-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{["Item", "SKU", "Location", "Stock on hand", "Weekly avg sold", "Days remaining", "Severity"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left font-bold uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No low-stock items right now — nothing is projected to run out within 14 days.</td></tr>
                : visibleRows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No alerts match the selected filters.</td></tr>
                : visibleRows.map((row) => (
                  <tr key={`${row.store_id || "hq"}-${row.barcode}`}>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{row.name || row.barcode}{raphaaaMode && <><span className="mt-0.5 block text-[10px] font-normal text-slate-400">{[row.section, row.department, row.design_no, row.brand, row.size].filter(Boolean).join(" / ")}</span>{row.vendor_name && <span className="block text-[10px] font-semibold text-blue-600">Supplier: {row.vendor_name}</span>}</>}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{row.sku}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">{row.store_name || "HQ / Central"}</td>
                    <td className="px-4 py-2.5">{row.stock_qty}</td>
                    <td className="px-4 py-2.5">{row.avg_weekly_qty}</td>
                    <td className="px-4 py-2.5 font-bold">{row.days_remaining} days</td>
                    <td className="px-4 py-2.5"><span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${SEVERITY_STYLE[row.severity] || SEVERITY_STYLE.warning}`}>{row.severity}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Store Stock Value (same recorded-on-hand data as HQ Admin's
   Store-wise Inventory, surfaced here so Forecast & Analytics users don't
   need separate HQ Admin access to see it) ── */
function StoreStockValueView() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    faFetch("/stock-allocation/store-summary")
      .then((r) => setRows(r.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalQty = rows.reduce((sum, r) => sum + Number(r.total_qty || 0), 0);
  const totalValue = rows.reduce((sum, r) => sum + Number(r.total_value || 0), 0);

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />
      <div className="fa-panel flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Store-wise stock value</h4>
          <p className="mt-0.5 text-xs text-slate-500">Central plus every store/branch's recorded on-hand quantity and stock value, side by side. Same figures as HQ Admin's Store-wise Inventory.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"><RefreshCw size={13} /> Refresh</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label="Total quantity" value={totalQty.toLocaleString("en-IN")} />
        <StatTile label="Total stock value" value={formatMoney(totalValue)} tone="emerald" />
      </div>

      <div className="fa-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{["Location", "Items in stock", "Total qty", "Stock value"].map((h) => <th key={h} className={`whitespace-nowrap px-4 py-2.5 font-bold uppercase ${h === "Location" ? "text-left" : "text-right"}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No stores found.</td></tr>
                : rows.map((r) => (
                  <tr key={r.store_id || "central"}>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{r.store_name}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{Number(r.item_count || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{Number(r.total_qty || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">{formatMoney(r.total_value)}</td>
                  </tr>
                ))}
            </tbody>
            {rows.length > 0 && <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50">
              <td className="px-4 py-2.5 font-bold text-slate-900">All locations</td>
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5 text-right font-mono font-bold">{totalQty.toLocaleString("en-IN")}</td>
              <td className="px-4 py-2.5 text-right font-mono font-bold">{formatMoney(totalValue)}</td>
            </tr></tfoot>}
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Purchase Plan ── */
function GenericPurchasePlanView({ raphaaaMode = false }) {
  const [budget, setBudget] = useState("");
  const [lookbackDays, setLookbackDays] = useState(90);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(null);
  const [draftLoading, setDraftLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});

  useEffect(() => {
    faFetch("/api/forecast-analytics/restock-draft")
      .then((r) => setDraft(r))
      .catch(() => {})
      .finally(() => setDraftLoading(false));
  }, []);

  const build = async () => {
    const budgetNum = Number(budget);
    if (!budgetNum || budgetNum <= 0) { setError("Enter a budget greater than 0."); return; }
    setLoading(true); setError(null);
    try {
      const r = await faFetch("/api/forecast-analytics/purchase-plan", {
        method: "POST",
        body: JSON.stringify({ budget_inr: budgetNum, lookback_days: lookbackDays }),
      });
      setPlan(r);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const planFields = React.useMemo(() => raphaaaMode ? [...PLAN_BASE_FILTERS, ...BASIC_PRODUCT_FILTERS] : PLAN_BASE_FILTERS, [raphaaaMode]);
  const filterSourceRows = [...(draft?.lines || []), ...(plan?.lines || [])];
  const visibleDraftLines = filterProductRows(draft?.lines || [], search, filters, planFields);
  const visiblePlanLines = filterProductRows(plan?.lines || [], search, filters, planFields);

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />

      <ProductFilterPanel
        rows={filterSourceRows} search={search} setSearch={setSearch} filters={filters} setFilters={setFilters}
        fields={planFields}
        title="Purchase recommendation filters"
        description="Use these filters to review particular products, trends or Raphaaa hierarchy groups. They change only the displayed rows; build the budget plan again whenever you change the budget or lookback."
      />

      {!draftLoading && draft?.line_count > 0 && (
        <div className="fa-panel overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h4 className="text-sm font-bold text-slate-900">Automated restock draft</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Every item worth restocking, ranked by ROI, with no budget applied — generated by the daily automation run
              {draft.generated_at ? ` on ${new Date(draft.generated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}.
              This is a starting point to review, not an order — set a budget below to turn it into an actual plan.
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>{["Item", "SKU", "Suggested qty", "Line cost", "ROI", "Trend"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left font-bold uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visibleDraftLines.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No draft lines match the selected filters.</td></tr> : visibleDraftLines.map((line) => (
                  <tr key={line.barcode}>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{line.name || line.barcode}{raphaaaMode && <><span className="mt-0.5 block text-[10px] font-normal text-slate-400">{[line.section, line.department, line.design_no, line.brand, line.size].filter(Boolean).join(" / ")}</span>{line.vendor_name && <span className="block text-[10px] font-semibold text-blue-600">Supplier: {line.vendor_name}</span>}</>}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{line.sku}</td>
                    <td className="px-4 py-2.5">{line.recommended_qty}</td>
                    <td className="px-4 py-2.5">₹{line.line_cost}</td>
                    <td className="px-4 py-2.5">{(line.roi * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2.5"><TrendBadge trend={line.trend} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="fa-panel p-5">
        <h4 className="text-sm font-bold text-slate-900">Budget-constrained purchase plan</h4>
        <p className="mt-0.5 text-xs text-slate-500">Ranks items by expected ROI (margin × forecasted demand) and fills your budget with the most profitable, fastest-moving items first.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500">Budget (₹)</label>
            <input type="number" min="1" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 50000" className="mt-1 w-40 rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500">Lookback</label>
            <select value={lookbackDays} onChange={(e) => setLookbackDays(Number(e.target.value))} className="mt-1 rounded-lg border px-2.5 py-2 text-sm">
              {[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <button onClick={build} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
            <ShoppingCart size={15} /> {loading ? "Building…" : "Build plan"}
          </button>
        </div>
      </div>

      {plan && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Budget", `₹${plan.budget_inr.toLocaleString("en-IN")}`],
              ["Allocated", `₹${plan.allocated_total.toLocaleString("en-IN")}`],
              ["Remaining", `₹${plan.remaining_budget.toLocaleString("en-IN")}`],
            ].map(([label, value]) => (
              <div key={label} className="fa-stat-card p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="fa-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr>{["Item", "SKU", "Qty", "Unit cost", "Line cost", "Expected profit", "ROI", "Trend"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left font-bold uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {plan.lines.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Budget too small for any forecasted item, or no demand history yet.</td></tr>
                    : visiblePlanLines.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No purchase-plan lines match the selected filters.</td></tr>
                    : visiblePlanLines.map((line) => (
                      <tr key={line.barcode}>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{line.name || line.barcode}{line.partial && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">partial</span>}{raphaaaMode && <><span className="mt-0.5 block text-[10px] font-normal text-slate-400">{[line.section, line.department, line.design_no, line.brand, line.size].filter(Boolean).join(" / ")}</span>{line.vendor_name && <span className="block text-[10px] font-semibold text-blue-600">Supplier: {line.vendor_name}</span>}</>}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{line.sku}</td>
                        <td className="px-4 py-2.5">{line.recommended_qty}</td>
                        <td className="px-4 py-2.5">₹{line.unit_cost}</td>
                        <td className="px-4 py-2.5">₹{line.line_cost}</td>
                        <td className="px-4 py-2.5 font-semibold text-emerald-700">₹{line.expected_profit}</td>
                        <td className="px-4 py-2.5">{(line.roi * 100).toFixed(0)}%</td>
                        <td className="px-4 py-2.5"><TrendBadge trend={line.trend} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Data Import (Raphaa pilot only) ── */
function RaphaaaPurchasePlanView() {
  const [historyPeriods, setHistoryPeriods] = useState(2);
  const [periodMode, setPeriodMode] = useState("calendar_year");
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [vendorMetric, setVendorMetric] = useState("net_sales");

  const build = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await faFetch("/api/forecast-analytics/purchase-plan/raphaaa", {
        method: "POST",
        body: JSON.stringify({
          history_periods: historyPeriods,
          period_mode: periodMode,
          season_start_month: 10,
          season_end_month: 2,
        }),
      });
      setPlan(result);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [historyPeriods, periodMode]);

  useEffect(() => { build(); }, [build]);

  const filterFields = React.useMemo(() => [
    ...BASIC_PRODUCT_FILTERS, ["style", "Style"], ["product_type", "Type"],
    ["size", "Size"], ["promotion", "Promotion"], ["confidence", "Confidence"],
  ], []);
  const lines = React.useMemo(() => plan?.lines || [], [plan]);
  const visibleLines = React.useMemo(
    () => filterProductRows(lines, search, filters, filterFields),
    [lines, search, filters, filterFields],
  );
  const periods = plan?.periods || [];
  const summary = React.useMemo(() => ({
    recommended_products: visibleLines.filter((line) => Number(line.final_purchase_qty) > 0).length,
    final_purchase_qty: visibleLines.reduce((sum, line) => sum + Number(line.final_purchase_qty || 0), 0),
    estimated_purchase_amount: visibleLines.reduce((sum, line) => sum + Number(line.estimated_purchase_amount || 0), 0),
    historical_net_sales: visibleLines.reduce((sum, line) => sum + Number(line.net_sales || 0), 0),
  }), [visibleLines]);
  const productChart = React.useMemo(() => visibleLines
    .filter((line) => Number(line.historical_peak_qty) > 0 || Number(line.final_purchase_qty) > 0)
    .slice().sort((a, b) => Number(b.final_purchase_qty) - Number(a.final_purchase_qty))
    .slice(0, 12)
    .map((line) => ({
      label: line.design_no || line.name || line.barcode,
      ...line.quantities_by_period,
      "Final purchase": line.final_purchase_qty,
    })), [visibleLines]);
  const vendorRows = React.useMemo(() => aggregatePlanVendors(visibleLines)
    .sort((a, b) => Number(b[vendorMetric]) - Number(a[vendorMetric])).slice(0, 10), [visibleLines, vendorMetric]);
  const visibleBarcodes = React.useMemo(() => new Set(visibleLines.map((line) => line.barcode)), [visibleLines]);
  const [promoFilter, setPromoFilter] = useState({ promotion: "", promotion_type: "" });
  const promoOptions = React.useMemo(() => {
    const all = plan?.promotion_performance || [];
    return {
      promotion: [...new Set(all.map((row) => row.promotion).filter(Boolean))].sort(),
      promotion_type: [...new Set(all.map((row) => row.promotion_type).filter(Boolean))].sort(),
    };
  }, [plan]);
  const promotionRows = React.useMemo(() => (plan?.promotion_performance || [])
    .filter((row) => visibleBarcodes.has(row.barcode))
    .filter((row) => !promoFilter.promotion || row.promotion === promoFilter.promotion)
    .filter((row) => !promoFilter.promotion_type || row.promotion_type === promoFilter.promotion_type)
    .slice(0, 20), [plan, visibleBarcodes, promoFilter]);

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />
      <div className="fa-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h4 className="text-base font-black text-slate-900">Raphaaa purchase policy</h4>
            <p className="mt-1 text-sm text-slate-600">Compare completed periods, take the largest product sales quantity, add 18%, then deduct 50% of today’s recorded central and store stock.</p>
            <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800">PQ = ceil(largest period sales × 1.18). Final quantity = max(0, ceil(PQ − current stock × 0.50)). This is a recommendation only; it does not create a PO or change stock.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-bold text-slate-600">Comparison
              <select value={periodMode} onChange={(e) => setPeriodMode(e.target.value)} className="mt-1 block rounded-lg border px-2.5 py-2 text-sm">
                <option value="calendar_year">Completed calendar years</option>
                <option value="seasonal_window">Winter seasons (Oct–Feb)</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">Periods
              <select value={historyPeriods} onChange={(e) => setHistoryPeriods(Number(e.target.value))} className="mt-1 block rounded-lg border px-2.5 py-2 text-sm">
                {[2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <button onClick={build} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"><RefreshCw size={14} />{loading ? "Calculating…" : "Recalculate"}</button>
          </div>
        </div>
        {plan && <p className="mt-3 text-xs text-slate-500">Compared: {periods.map((period) => period.label).join(", ")} · Stock snapshot: {new Date(plan.generated_at).toLocaleString("en-IN")} · {plan.data_quality?.invoice_count || 0} sales/return documents reviewed.</p>}
      </div>

      <ProductFilterPanel rows={lines} search={search} setSearch={setSearch} filters={filters} setFilters={setFilters} fields={filterFields} title="Purchase-plan filters" description="All cards, charts, tables and the CSV export below use this same filtered product population." />

      {plan && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Products to repurchase" value={summary.recommended_products.toLocaleString("en-IN")} tone="emerald" />
          <StatTile label="Final purchase quantity" value={summary.final_purchase_qty.toLocaleString("en-IN")} />
          <StatTile label="Estimated purchase amount" value={formatMoney(summary.estimated_purchase_amount)} tone="amber" />
          <StatTile label="Historical net sales" value={formatMoney(summary.historical_net_sales)} />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            <p className="font-black">Stock basis</p>
            <p>{plan.data_quality?.stock_basis}. {plan.data_quality?.stock_caveat}</p>
          </div>
          <div className={`rounded-xl border p-4 text-xs leading-5 ${plan.data_quality?.promotion_name_available ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-sky-200 bg-sky-50 text-sky-900"}`}>
            <p className="font-black">Promotion evidence</p>
            <p>{plan.data_quality?.promotion_name_available ? `${plan.data_quality.named_promotion_lines} sales lines contain a promotion name.` : "Existing sales contain discount amounts but no reliable promotion names. They are shown as ‘Unlabelled discount / offer’; the system does not invent campaign names or claim causal uplift."}</p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="fa-panel p-5">
            <h4 className="text-sm font-black text-slate-900">Product performance and proposed quantity</h4>
            <p className="mt-1 text-xs text-slate-500">Top 12 filtered products by final purchase quantity. Bars start at zero and compare like-for-like completed periods.</p>
            <div className="mt-4 h-[360px]">
              {productChart.length ? <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={productChart} layout="vertical" margin={{ top: 5, right: 18, left: 24, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => [Number(value).toLocaleString("en-IN"), "Quantity"]} />
                  <Legend />
                  {periods.map((period, index) => <Bar key={period.key} dataKey={period.key} name={`${period.label} sold`} fill={["#94a3b8", "#6366f1", "#0ea5e9", "#14b8a6", "#a855f7", "#f59e0b"][index % 6]} radius={[0, 3, 3, 0]} />)}
                  <Bar dataKey="Final purchase" fill="#10b981" radius={[0, 3, 3, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-400">No products match this selection.</div>}
            </div>
          </div>

          <div className="fa-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h4 className="text-sm font-black text-slate-900">Vendor performance</h4><p className="mt-1 text-xs text-slate-500">Performance of products attributed to each supplier; choose the decision measure.</p></div>
              <select value={vendorMetric} onChange={(e) => setVendorMetric(e.target.value)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold">
                <option value="net_sales">Net sales</option><option value="units_sold">Units sold</option><option value="discount_amount">Discount amount</option><option value="final_purchase_qty">Purchase quantity</option><option value="estimated_purchase_amount">Purchase amount</option>
              </select>
            </div>
            <div className="mt-4 h-[360px]">
              {vendorRows.length ? <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={vendorRows} layout="vertical" margin={{ top: 5, right: 18, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="vendor_name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => [vendorMetric.includes("sales") || vendorMetric.includes("amount") ? formatMoney(value) : Number(value).toLocaleString("en-IN"), vendorMetric.replaceAll("_", " ")]} />
                  <Bar dataKey={vendorMetric} name={vendorMetric.replaceAll("_", " ")} fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-400">No vendor evidence matches this selection.</div>}
            </div>
            <p className="mt-2 text-[11px] leading-4 text-slate-500">{plan.data_quality?.vendor_caveat}</p>
          </div>
        </div>
      </>}

      {plan && <div className="fa-panel overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div><h4 className="text-sm font-black text-slate-900">Auditable purchase quantities</h4><p className="mt-1 text-xs text-slate-500">Exact inputs, assumptions and amounts for each filtered SKU. Zero recommendations remain visible for review.</p></div>
          <button type="button" onClick={() => downloadPurchasePlan(visibleLines, periods)} disabled={!visibleLines.length} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 disabled:opacity-50"><Download size={14} />Export filtered CSV</button>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="min-w-[1900px] w-full text-xs">
            <thead className="sticky top-0 z-10"><tr>
              {["Product / hierarchy", "Vendor", ...periods.map((p) => `${p.label} sold`), "Peak", "PQ +18%", "Current stock", "50% stock", "Final qty", "Unit cost", "Purchase amount", "Gross sales", "Discount", "Net sales", "Promotion", "Evidence"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3 text-left font-black uppercase">{heading}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {!visibleLines.length ? <tr><td colSpan={16 + periods.length} className="px-4 py-10 text-center text-slate-400">{loading ? "Calculating the plan…" : "No historical products match the selected filters."}</td></tr> : visibleLines.map((line) => <tr key={line.stock_identity || line.barcode}>
                <td className="px-3 py-3"><p className="max-w-[230px] font-bold text-slate-900">{line.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{[line.division, line.section, line.department, line.design_no, line.brand, line.style, line.size].filter(Boolean).join(" / ")}</p><p className="mt-0.5 font-mono text-[10px] text-slate-400">{line.sku || line.barcode}</p></td>
                <td className="px-3 py-3"><span className="font-semibold">{line.vendor_name || "Unavailable"}</span>{line.vendor_name && !line.vendor_linked && <span className="mt-1 block text-[10px] font-bold text-amber-600">Imported / unlinked</span>}</td>
                {periods.map((period) => <td key={period.key} className="px-3 py-3">{Number(line.quantities_by_period?.[period.key] || 0).toLocaleString("en-IN")}</td>)}
                <td className="px-3 py-3 font-bold">{line.historical_peak_qty}</td>
                <td className="px-3 py-3 font-bold text-indigo-700">{line.purchase_qty_before_stock}</td>
                <td className="px-3 py-3">{line.current_stock_qty}{line.aged_stock_qty > 0 && <span className="mt-0.5 block text-[10px] font-bold text-amber-600">Fresh {line.fresh_stock_qty} · Aged {line.aged_stock_qty}{line.aged_avg_months != null && ` (~${Math.round(line.aged_avg_months)} mo)`}</span>}</td>
                <td className="px-3 py-3">{line.stock_credit_qty}{line.aged_stock_qty > 0 && <span className="mt-0.5 block text-[10px] text-slate-400">Aged stock not credited</span>}</td>
                <td className="px-3 py-3 text-sm font-black text-emerald-700">{line.final_purchase_qty}</td>
                <td className="px-3 py-3">{line.unit_cost ? formatMoney(line.unit_cost) : "Unavailable"}<span className="block text-[10px] text-slate-400">{line.cost_source}{line.cost_reference ? ` · ${line.cost_reference}` : ""}</span></td>
                <td className="px-3 py-3 font-bold">{formatMoney(line.estimated_purchase_amount)}</td>
                <td className="px-3 py-3">{formatMoney(line.gross_sales)}</td>
                <td className="px-3 py-3 text-rose-600">{formatMoney(line.discount_amount)}</td>
                <td className="px-3 py-3 font-bold">{formatMoney(line.net_sales)}</td>
                <td className="max-w-[180px] px-3 py-3">{line.promotion}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${line.confidence === "High" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{line.confidence}</span><span className="mt-1 block text-[10px] text-slate-400">{line.periods_with_sales}/{periods.length} periods with sales</span></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>}

      {plan && <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="fa-panel overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-slate-900">Promotion and discount evidence</h4>
                <p className="mt-1 text-xs text-slate-500">Actual gross, discount and net amounts by product/promotion label. This is descriptive performance, not proof that a promotion caused the sale.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={promoFilter.promotion} onChange={(e) => setPromoFilter((f) => ({ ...f, promotion: e.target.value }))} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold">
                  <option value="">All promotions</option>
                  {promoOptions.promotion.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select value={promoFilter.promotion_type} onChange={(e) => setPromoFilter((f) => ({ ...f, promotion_type: e.target.value }))} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold capitalize">
                  <option value="">All types</option>
                  {promoOptions.promotion_type.map((value) => <option key={value} value={value} className="capitalize">{value}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="max-h-80 overflow-auto"><table className="min-w-[940px] w-full text-xs"><thead><tr>{["Promotion", "Type", "Product", "Vendor", "Qty", "Gross", "Discount", "Net"].map((heading) => <th key={heading} className="px-4 py-3 text-left font-black uppercase">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{promotionRows.length ? promotionRows.map((row, index) => <tr key={`${row.barcode}-${row.promotion}-${row.promotion_type}-${index}`}><td className="px-4 py-3 font-bold">{row.promotion}</td><td className="px-4 py-3 capitalize">{row.promotion_type}</td><td className="px-4 py-3">{row.name}{row.design_no && <span className="block text-[10px] text-slate-400">Design {row.design_no}</span>}</td><td className="px-4 py-3">{row.vendor_name}</td><td className="px-4 py-3">{row.qty}</td><td className="px-4 py-3">{formatMoney(row.gross_sales)}</td><td className="px-4 py-3 text-rose-600">{formatMoney(row.discount_amount)}</td><td className="px-4 py-3 font-bold">{formatMoney(row.net_sales)}</td></tr>) : <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No promotion evidence matches this selection.</td></tr>}</tbody></table></div>
        </div>
        <div className="fa-panel p-5">
          <h4 className="text-sm font-black text-slate-900">How to use this plan</h4>
          <ol className="mt-3 space-y-3 text-xs leading-5 text-slate-600">
            <li><b>1.</b> Choose full years or comparable winter seasons and at least two periods.</li>
            <li><b>2.</b> Filter Division → Section → Department → Design No. → size/vendor.</li>
            <li><b>3.</b> Review the peak quantity, 18% PQ, current stock and final quantity row by row.</li>
            <li><b>4.</b> Resolve “Limited history”, unavailable costs and unlinked vendors before ordering.</li>
            <li><b>5.</b> Export the filtered CSV and use approved quantities to prepare a PO in Procurement.</li>
          </ol>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500"><b>What happens next:</b> this screen does not bypass vendor approval, PO, GRC or GRN. After review, Procurement creates the PO; received goods continue through the existing GRC → GRN → inventory flow.</div>
        </div>
      </div>}

      {plan && plan.ageing_clearance?.length > 0 && <div className="fa-panel overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h4 className="text-sm font-black text-slate-900">Ageing — stock to clear out</h4>
          <p className="mt-1 text-xs text-slate-500">Stock older than {plan.policy?.fresh_max_months ?? 2} months (by CATEGORY6/Ageing). It no longer reduces how much you buy fresh — it's shown here instead so it can be discounted or otherwise cleared.</p>
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="min-w-[700px] w-full text-xs">
            <thead><tr>{["Product", "Vendor", "Fresh stock", "Aged stock", "Age"].map((heading) => <th key={heading} className="px-4 py-3 text-left font-black uppercase">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {plan.ageing_clearance.map((row) => (
                <tr key={row.barcode}>
                  <td className="px-4 py-3 font-bold">{row.name}{row.design_no && <span className="block text-[10px] font-normal text-slate-400">Design {row.design_no}</span>}</td>
                  <td className="px-4 py-3">{row.vendor_name || "Unavailable"}</td>
                  <td className="px-4 py-3">{row.fresh_stock_qty}</td>
                  <td className="px-4 py-3 font-black text-amber-700">{row.aged_stock_qty}</td>
                  <td className="px-4 py-3">{row.aged_avg_months != null ? `~${Math.round(row.aged_avg_months)} mo` : "Unavailable"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  );
}

function PurchasePlanView({ raphaaaMode = false }) {
  return raphaaaMode ? <RaphaaaPurchasePlanView /> : <GenericPurchasePlanView />;
}

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function aggregatePlanVendors(lines) {
  const grouped = new Map();
  lines.forEach((line) => {
    const key = line.vendor_name || "Vendor unavailable";
    const row = grouped.get(key) || { vendor_name: key, units_sold: 0, net_sales: 0, discount_amount: 0, final_purchase_qty: 0, estimated_purchase_amount: 0 };
    row.units_sold += Object.values(line.quantities_by_period || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    row.net_sales += Number(line.net_sales || 0);
    row.discount_amount += Number(line.discount_amount || 0);
    row.final_purchase_qty += Number(line.final_purchase_qty || 0);
    row.estimated_purchase_amount += Number(line.estimated_purchase_amount || 0);
    grouped.set(key, row);
  });
  return [...grouped.values()];
}

function aggregateRaphaaaVendors(lines) {
  const grouped = new Map();
  lines.forEach((line) => {
    const key = line.vendor_name || "Vendor unavailable";
    const row = grouped.get(key) || {
      vendor_name: key,
      product_count: 0,
      unlinked_product_count: 0,
      units_sold: 0,
      gross_sales: 0,
      discount_amount: 0,
      net_sales: 0,
      final_purchase_qty: 0,
      estimated_purchase_amount: 0,
      top_product: "Unavailable",
      top_product_net_sales: -1,
    };
    const units = Object.values(line.quantities_by_period || {})
      .reduce((sum, value) => sum + Number(value || 0), 0);
    const netSales = Number(line.net_sales || 0);
    row.product_count += 1;
    row.unlinked_product_count += line.vendor_linked ? 0 : 1;
    row.units_sold += units;
    row.gross_sales += Number(line.gross_sales || 0);
    row.discount_amount += Number(line.discount_amount || 0);
    row.net_sales += netSales;
    row.final_purchase_qty += Number(line.final_purchase_qty || 0);
    row.estimated_purchase_amount += Number(line.estimated_purchase_amount || 0);
    if (netSales > row.top_product_net_sales) {
      row.top_product = line.design_no ? `${line.name} (Design ${line.design_no})` : (line.name || line.sku || line.barcode || "Unavailable");
      row.top_product_net_sales = netSales;
    }
    grouped.set(key, row);
  });
  return [...grouped.values()].map((row) => ({
    ...row,
    top_product_net_sales: Math.max(0, row.top_product_net_sales),
    discount_rate: row.gross_sales > 0 ? (row.discount_amount / row.gross_sales) * 100 : 0,
  }));
}

function downloadPurchasePlan(lines, periods) {
  const headers = ["Product", "Division", "Section", "Department", "Design No.", "SKU", "Barcode", "Vendor", ...periods.map((p) => `${p.label} units`), "Peak units", "PQ before stock", "Current stock", "Fresh stock", "Aged stock", "Aged stock avg months", "50% stock credit", "Final purchase qty", "Unit cost", "Purchase amount", "Gross sales", "Discount", "Net sales", "Promotion", "Confidence", "Cost source"];
  const values = lines.map((line) => [
    line.name, line.division, line.section, line.department, line.design_no, line.sku, line.barcode, line.vendor_name,
    ...periods.map((p) => line.quantities_by_period?.[p.key] || 0),
    line.historical_peak_qty, line.purchase_qty_before_stock, line.current_stock_qty,
    line.fresh_stock_qty, line.aged_stock_qty, line.aged_avg_months ?? "",
    line.stock_credit_qty, line.final_purchase_qty, line.unit_cost,
    line.estimated_purchase_amount, line.gross_sales, line.discount_amount,
    line.net_sales, line.promotion, line.confidence, line.cost_source,
  ]);
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers, ...values].map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "raphaaa-purchase-plan.csv"; link.click();
  URL.revokeObjectURL(url);
}

function StatTile({ label, value, tone = "slate" }) {
  const tones = {
    slate: "text-slate-900",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    amber: "text-amber-700",
  };
  return (
    <div className="fa-stat-card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-black ${tones[tone] || tones.slate}`}>{value}</p>
    </div>
  );
}

function RowErrorsTable({ kind, rows }) {
  const flagged = rows.filter((r) => r.errors && r.errors.length);
  const shown = (flagged.length ? flagged : rows).slice(0, 25);
  if (!shown.length) return null;
  return (
    <div className="fa-panel overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
        {flagged.length ? `${flagged.length} row(s) with problems` : "Sample of parsed rows"}
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {["Row", kind === "stock" ? "Item / barcode" : "Bill No.", kind === "stock" ? "Warehouse + stores" : "Store / qty", "Issues"].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left font-bold uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((r) => (
              <tr key={r.row_no}>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{r.row_no}</td>
                <td className="px-4 py-2.5 font-semibold text-slate-800">
                  {kind === "stock" ? (r.product || r.barcode || r.item_code || "—") : (r.bill_no || "—")}
                  <span className="ml-1 block font-mono text-[11px] font-normal text-slate-400">{r.barcode || r.item_code}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {kind === "stock"
                    ? Object.entries(r.allocation || {}).map(([loc, q]) => `${loc}: ${q}`).join("  ·  ")
                    : `${r.store || "—"}  ·  qty ${r.bill_qty ?? 0}`}
                </td>
                <td className="px-4 py-2.5">
                  {r.errors && r.errors.length
                    ? <span className="text-xs font-semibold text-rose-600">{r.errors.join(" ")}</span>
                    : <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 size={12} /> ok</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportPanel({ kind, title, blurb, onCommitted }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  const reset = () => { setFile(null); setPreview(null); setResult(null); setError(null); };

  const onPick = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setError(null); setResult(null); setPreview(null); setFile(picked); setLoading(true);
    try {
      setPreview(await faUpload(`/api/forecast-analytics/data-hub/${kind}/preview`, picked));
    } catch (err) {
      setError(err.message); setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const commit = async () => {
    if (!file) return;
    const msg = kind === "stock"
      ? "Commit this stock snapshot? It sets central (HQ warehouse) + per-store on-hand quantities for every matched product. Items not in the file are left untouched."
      : "Commit these sales? Historical bills are added for forecasting and missing products are created in the catalogue. Stock levels are not changed.";
    if (!window.confirm(msg)) return;
    setCommitting(true); setError(null);
    try {
      const r = await faUpload(`/api/forecast-analytics/data-hub/${kind}/commit`, file, { confirm: "true" });
      setResult(r); setPreview(null); setFile(null);
      onCommitted?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setCommitting(false);
    }
  };

  const s = preview?.summary;
  const canCommit = Boolean(preview) && (s?.valid_count ?? 0) > 0 && !committing;

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />

      <div className="fa-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900"><FileSpreadsheet size={15} className="text-indigo-600" /> {title}</h4>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{blurb}</p>
          </div>
          <button
            type="button"
            onClick={() => faDownload(`/api/forecast-analytics/data-hub/template/${kind}`, `raphaa-${kind}-template.csv`).catch((e) => setError(e.message))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <Download size={13} /> Template
          </button>
        </div>

        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 px-4 py-8 text-center transition hover:bg-indigo-50">
          <UploadCloud className="h-7 w-7 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700">{file ? file.name : "Choose a .xlsx / .xls / .csv file"}</span>
          <span className="text-xs text-slate-400">{loading ? "Validating…" : "Nothing is written until you press Commit"}</span>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onPick} disabled={loading || committing} className="hidden" />
        </label>
      </div>

      {preview && (
        <>
          <div className={`grid gap-4 sm:grid-cols-2 ${kind === "stock" ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            <StatTile label={kind === "stock" ? "Rows / products" : "Rows in file"} value={kind === "stock" ? `${preview.rows?.length ?? 0} → ${s?.products_in_snapshot ?? 0}` : (s?.row_count ?? 0)} />
            <StatTile label={kind === "stock" ? "Ready to write" : "Ready to import"} value={s?.valid_count ?? 0} tone="emerald" />
            <StatTile label="Will be skipped" value={s?.invalid_count ?? 0} tone={s?.invalid_count ? "rose" : "slate"} />
            {kind === "stock"
              ? <StatTile label="Matched via category" value={s?.resolved_via_category ?? 0} tone="amber" />
              : <StatTile label="New products to create" value={s?.new_products ?? 0} tone={s?.new_products ? "amber" : "slate"} />}
            {kind === "stock" && <StatTile label="New products (never sold)" value={s?.new_products_from_stock ?? 0} tone={s?.new_products_from_stock ? "amber" : "slate"} />}
          </div>

          {kind === "stock" && (s?.catalogue_size ?? 0) === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
              ⚠ No products in the catalogue yet. A row with a Barcode/Item Code will create its own product; import the sales file too so items that already sold keep their real history.
            </div>
          )}

          {kind === "stock" && s?.location_totals && (
            <div className="fa-panel p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Quantity that will be set per location (Ageing rows summed)
                {s.file_format && <span className="ml-2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{s.file_format} format</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(s.location_totals).map(([loc, qty]) => (
                  <span key={loc} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">{loc}: <b className="text-slate-900">{qty}</b></span>
                ))}
              </div>
              {s.location_map && Object.keys(s.location_map).length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Locations found in the file</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(s.location_map).map(([raw, mapped]) => (
                      <span key={raw} className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${mapped ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                        {raw} {mapped ? `→ ${mapped}` : "→ not mapped (qty dropped)"}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {kind === "sales" && (
            <div className="fa-panel p-4 text-xs font-semibold text-slate-500">
              {s?.bill_count ?? 0} distinct bill(s) · {s?.new_products ?? 0} new product(s) will be added to the catalogue · stock levels are not affected
            </div>
          )}

          {kind === "stock" && (s?.error_breakdown?.length ?? 0) > 0 && (
            <div className="fa-panel p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Why rows are being skipped, grouped</p>
              <div className="space-y-1.5">
                {s.error_breakdown.map((b) => (
                  <div key={b.reason} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                    <span className="text-amber-900">{b.reason}</span>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">{b.row_count} row(s)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <RowErrorsTable kind={kind} rows={preview.rows || []} />
          {preview.truncated && <p className="text-xs text-slate-400">Preview shows the first {(preview.rows || []).length} rows — all rows in the file are validated and committed.</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={commit}
              disabled={!canCommit}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <CheckCircle2 size={15} /> {committing ? "Committing…" : `Commit ${s?.valid_count ?? 0} row(s)`}
            </button>
            <button onClick={reset} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        </>
      )}

      {result && (
        <div className="fa-panel border-l-4 border-emerald-400 p-5">
          <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-800"><CheckCircle2 size={15} /> Import committed</h4>
          <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
            {kind === "stock" ? (
              <>
                <p>Rows applied: <b className="text-slate-900">{result.rows_applied}</b></p>
                <p>Location writes: <b className="text-slate-900">{result.locations_written}</b></p>
                <p>Rows skipped: <b className="text-slate-900">{result.rows_skipped}</b></p>
                <p>New products created: <b className="text-slate-900">{result.products_created_count ?? 0}</b></p>
                <p>Batch: <span className="font-mono">{result.batch_id?.slice(0, 12)}</span></p>
              </>
            ) : (
              <>
                <p>Bills inserted: <b className="text-slate-900">{result.bills_inserted}</b></p>
                <p>Line items: <b className="text-slate-900">{result.line_items}</b></p>
                <p>Products created: <b className="text-slate-900">{result.products_created}</b></p>
                <p>Duplicate bills skipped: <b className="text-slate-900">{result.duplicate_bills_skipped}</b></p>
                <p>Rows skipped: <b className="text-slate-900">{result.rows_skipped}</b></p>
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-400">You can undo this run from the History tab.</p>
        </div>
      )}
    </div>
  );
}

function downloadImportHistory(rows) {
  const headers = ["When", "Type", "File", "File URL", "By", "Batch ID", "Products / Bills applied", "Line items", "Products created", "Rows skipped", "Duplicate bills skipped", "Status", "Rolled back at"];
  const values = rows.map((row) => [
    row.created_at ? new Date(row.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "",
    row.kind,
    row.file_name || "",
    row.file_url || "",
    row.created_by_name || "",
    row.batch_id || "",
    row.kind === "stock" ? (row.rows_applied ?? 0) : (row.bills_inserted ?? 0),
    row.line_items ?? "",
    row.products_created_count ?? 0,
    row.rows_skipped ?? 0,
    row.duplicate_bills_skipped ?? 0,
    row.rolled_back ? "Rolled back" : "Active",
    row.rolled_back_at ? new Date(row.rolled_back_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "",
  ]);
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers, ...values].map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "raphaaa-data-hub-import-history.csv"; link.click();
  URL.revokeObjectURL(url);
}

function ImportHistory({ refreshKey }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(() => {
    setLoading(true); setError(null);
    faFetch("/api/forecast-analytics/data-hub/imports")
      .then((r) => setRows(r.imports || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const rollback = async (batchId) => {
    if (!window.confirm("Roll back this import? Stock lines are restored to their previous values; imported bills are deleted, along with any products that import created (unless stock has since been written against them).")) return;
    setBusyId(batchId); setError(null);
    try {
      await faFetch(`/api/forecast-analytics/data-hub/imports/${batchId}/rollback`, { method: "POST" });
      load();
    } catch (e) { setError(e.message); } finally { setBusyId(""); }
  };

  const remove = async (batchId) => {
    if (!window.confirm("Delete this history entry? It has already been rolled back, so no stock or sales data is affected — only the log line is removed.")) return;
    setBusyId(batchId); setError(null);
    try {
      await faFetch(`/api/forecast-analytics/data-hub/imports/${batchId}`, { method: "DELETE" });
      load();
    } catch (e) { setError(e.message); } finally { setBusyId(""); }
  };

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />
      <div className="fa-panel flex items-center justify-between p-5">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Import history</h4>
          <p className="mt-0.5 text-xs text-slate-500">Every committed stock / sales import, newest first. Rollback is exact — it only touches rows this batch still owns. A rolled-back entry can then be deleted from the log.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadImportHistory(rows)} disabled={!rows.length} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"><Download size={13} /> Download CSV</button>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      <div className="fa-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>{["When", "Type", "File", "By", "Result", "Skipped", "Status", ""].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left font-bold uppercase">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No imports committed yet.</td></tr>
                : rows.map((row) => (
                  <tr key={row.batch_id}>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{row.created_at ? new Date(row.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</td>
                    <td className="px-4 py-2.5"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${row.kind === "stock" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{row.kind}</span></td>
                    <td className="px-4 py-2.5 max-w-[220px] truncate text-xs" title={row.file_url ? `Download ${row.file_name}` : row.file_name}>
                      {row.file_url ? (
                        <a href={row.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-indigo-700 hover:underline">
                          <Download size={12} className="shrink-0" /> {row.file_name || "Download"}
                        </a>
                      ) : (
                        <span className="text-slate-600">{row.file_name || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{row.created_by_name || "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-800">
                      {row.kind === "stock"
                        ? `${row.rows_applied ?? 0} products`
                        : `${row.bills_inserted ?? 0} bills · ${row.line_items ?? 0} lines${row.products_created_count ? ` · +${row.products_created_count} products` : ""}`}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{(row.rows_skipped ?? 0) + (row.duplicate_bills_skipped ?? 0)}</td>
                    <td className="px-4 py-2.5">
                      {row.rolled_back
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400"><XCircle size={12} /> rolled back</span>
                        : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600"><CheckCircle2 size={12} /> active</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {row.rolled_back ? (
                        <button
                          onClick={() => remove(row.batch_id)}
                          disabled={busyId === row.batch_id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                        >
                          <Trash2 size={12} /> {busyId === row.batch_id ? "Deleting…" : "Delete"}
                        </button>
                      ) : (
                        <button
                          onClick={() => rollback(row.batch_id)}
                          disabled={busyId === row.batch_id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                        >
                          <Undo2 size={12} /> {busyId === row.batch_id ? "Rolling back…" : "Roll back"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProductCleanupView() {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    faFetch("/api/forecast-analytics/data-hub/products/enrichment/preview")
      .then(setPreview)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const apply = async () => {
    if (!window.confirm("Apply these Raphaaa Product Master improvements? Original imported names will be preserved. Historical bills, stock quantities, barcodes and prices will not change.")) return;
    setApplying(true); setError(null); setResult(null);
    try {
      const response = await faFetch("/api/forecast-analytics/data-hub/products/enrichment/apply", {
        method: "POST", body: JSON.stringify({ confirm: true }),
      });
      setResult(response);
      load();
    } catch (e) { setError(e.message); } finally { setApplying(false); }
  };

  const summary = preview?.summary || {};
  const rows = preview?.rows || [];

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />

      <div className="fa-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CheckCircle2 size={15} className="text-indigo-600" /> 3 · Product cleanup</h4>
            <p className="mt-1 text-xs leading-5 text-slate-500">Raphaaa-only cleanup for products created by Sales History imports. It converts code-only names such as F/S into readable names using Section, Department, type and Design No.; copies Brand, Style and Size from Category 2–5; and preserves the original imported name for audit.</p>
            <p className="mt-2 text-xs font-semibold text-amber-700">Vendor names remain visible as imported supplier references. They stay marked Unlinked until the vendor is registered and approved—this cleanup never creates a false vendor relationship.</p>
          </div>
          <button onClick={load} disabled={loading || applying} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"><RefreshCw size={13} /> Refresh preview</button>
        </div>
      </div>

      {loading ? <div className="fa-panel p-8 text-center text-sm text-slate-400">Checking imported products…</div> : preview && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatTile label="Imported products" value={summary.imported_products ?? 0} />
            <StatTile label="Names to fix" value={summary.names_to_fix ?? 0} tone={summary.names_to_fix ? "amber" : "emerald"} />
            <StatTile label="Brands available" value={summary.brands_available_from_hierarchy ?? 0} tone="emerald" />
            <StatTile label="Vendors unlinked" value={summary.vendors_unlinked ?? 0} tone={summary.vendors_unlinked ? "amber" : "emerald"} />
            <StatTile label="Missing HSN" value={summary.missing_hsn ?? 0} tone={summary.missing_hsn ? "rose" : "emerald"} />
            <StatTile label="Missing GST" value={summary.missing_gst ?? 0} tone={summary.missing_gst ? "rose" : "emerald"} />
          </div>

          <div className="fa-panel overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Proposed Product Master changes</div>
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead><tr>{["Barcode / SKU", "Current name", "Proposed display name", "Classification", "Vendor", "Quality status"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left font-bold uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No imported products found.</td></tr> : rows.map((row) => (
                    <tr key={row.product_id}>
                      <td className="px-4 py-2.5"><span className="block font-mono text-xs text-slate-700">{row.barcode || "—"}</span><span className="text-[10px] text-slate-400">{row.sku || "No SKU"}</span></td>
                      <td className="px-4 py-2.5 font-semibold text-slate-600">{row.current_name || "—"}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-900">{row.proposed_name}{row.name_will_change && <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">will update</span>}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{[row.division, row.section, row.department, row.design_no, row.style, row.product_type, row.size].filter(Boolean).join(" / ") || "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{row.vendor_name || "—"}{row.vendor_name && !row.vendor_linked && <span className="mt-1 block font-bold text-amber-600">Imported · Unlinked</span>}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{row.remaining_issues?.length ? row.remaining_issues.map((issue) => issue.replaceAll("_", " ")).join(" · ") : <span className="font-bold text-emerald-600">Ready</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {preview.truncated && <p className="text-xs text-slate-400">The preview is limited to the first {rows.length} products; Apply processes every Raphaaa Data Hub product.</p>}
          <button onClick={apply} disabled={applying || !rows.length} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"><CheckCircle2 size={15} /> {applying ? "Applying…" : `Apply cleanup to ${summary.imported_products ?? 0} products`}</button>
        </>
      )}

      {result && <div className="fa-panel border-l-4 border-emerald-400 p-5 text-sm text-emerald-800"><b>Cleanup applied.</b> {result.product_names_fixed} product name(s) fixed and {result.products_updated} Product Master record(s) enriched. {result.stock_descriptions_synced > 0 && <>{result.stock_descriptions_synced} stock record(s) were refreshed so HQ Admin&apos;s Store-wise Inventory shows the same name — no re-import needed. </>}Stock quantities, barcodes and prices were not changed.</div>}
    </div>
  );
}

const IMPORT_TABS = [
  { id: "sales", label: "1 · Sales history" },
  { id: "stock", label: "2 · Stock snapshot" },
  { id: "history", label: "History" },
];

function DataImportView({ enrichmentEnabled = false }) {
  const [tab, setTab] = useState("sales");
  const [historyKey, setHistoryKey] = useState(0);
  const bumpHistory = () => setHistoryKey((k) => k + 1);
  const importTabs = enrichmentEnabled
    ? [IMPORT_TABS[0], IMPORT_TABS[1], { id: "cleanup", label: "3 · Product cleanup" }, IMPORT_TABS[2]]
    : IMPORT_TABS;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-900 px-6 py-6 text-white shadow-[0_16px_35px_rgba(15,23,42,.14)] sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-indigo-200">Sales &amp; Stock Data Hub</p>
        <h3 className="mt-1 text-xl font-bold">Import spreadsheet exports into RMS</h3>
        <p className="mt-1 text-sm text-indigo-100/75">Upload → review the preview → commit. Do <b>sales first</b> (it also builds the product catalogue), then the stock snapshot. Sales load historical bills for forecasting; stock sets central (HQ warehouse) + per-store on-hand. Finance, GST and POS are never touched.</p>
      </section>

      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {importTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${tab === t.id ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sales" && (
        <ImportPanel
          kind="sales"
          title="1 · Historical POS sales"
          blurb="One row per bill line: Bill Date, Bill No., Store, Barcode and Bill Qty are required. Bills are grouped by Bill No. and dated from Bill Date. Any barcode not in the catalogue is created as a product from Description / Division / Section / Department / Cat-1 / Vendor / Std Rate / RSP / MRP — this is also what lets the stock file match. Multi-sheet workbooks import in full — every data tab is combined and cover / filter / summary tabs are skipped. Re-uploading the same bill numbers is a no-op."
          onCommitted={bumpHistory}
        />
      )}
      {tab === "stock" && (
        <ImportPanel
          kind="stock"
          title="2 · Physical stock count"
          blurb="Two layouts are auto-detected: wide (WAREHOUSE + one column per store) or long (a Locname / Source Site column plus CLOSING_QTY, one row per product per site — rows are summed per location). Matching uses ITEM_CODE / BARCODE first; failing that, DIVISION / SECTION / DEPARTMENT / VENDOR / CATEGORY1-5, and when that maps to more than one product the row's RSP / MRP picks one (CATEGORY6 = Ageing is ignored). WAREHOUSE / a warehouse Locname → Raphaaa HQ / central. Multi-sheet workbooks import in full — cover / filter / summary tabs are skipped. Quantities are set as an absolute snapshot; products absent from the file keep their current stock. Import the sales file first."
          onCommitted={bumpHistory}
        />
      )}
      {tab === "cleanup" && enrichmentEnabled && <ProductCleanupView />}
      {tab === "history" && <ImportHistory refreshKey={historyKey} />}
    </div>
  );
}

export default function ForecastAnalytics() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [dataHubEnabled, setDataHubEnabled] = useState(false);
  const [productEnrichmentEnabled, setProductEnrichmentEnabled] = useState(false);
  const [dataHubTenantId, setDataHubTenantId] = useState("");
  const isStoreWorkspace = getAdminScope() !== "hq";
  const workspaceName = isStoreWorkspace ? (getStoreName() || "Store workspace") : "Head office workspace";
  const adminName = getAdminName() || "Analytics Administrator";
  const handleLogout = () => logoutOrReturnToDepartmentSelector();

  useEffect(() => {
    faFetch("/api/forecast-analytics/data-hub/status")
      .then((r) => {
        setDataHubEnabled(Boolean(r.enabled));
        setProductEnrichmentEnabled(Boolean(r.product_enrichment_enabled));
        setDataHubTenantId(r.tenant_id || "");
      })
      .catch(() => { setDataHubEnabled(false); setProductEnrichmentEnabled(false); });
  }, []);

  const menu = dataHubEnabled
    ? [...MENU, { id: "store-value", label: "Store Stock Value", icon: Warehouse }, { id: "import", label: "Data Import", icon: UploadCloud }]
    : MENU;
  const activeLabel = menu.find((item) => item.id === activeSection)?.label || "Overview";

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard": return <DashboardView onNavigate={setActiveSection} raphaaaMode={productEnrichmentEnabled} />;
      case "demand": return <DemandForecastView raphaaaMode={productEnrichmentEnabled} />;
      case "vendors": return <VendorRankingView raphaaaMode={productEnrichmentEnabled} />;
      case "purchase": return <PurchasePlanView raphaaaMode={productEnrichmentEnabled} />;
      case "alerts": return <AlertsView raphaaaMode={productEnrichmentEnabled} />;
      case "store-value": return dataHubEnabled ? <StoreStockValueView /> : <DashboardView onNavigate={setActiveSection} raphaaaMode={productEnrichmentEnabled} />;
      case "import": return dataHubEnabled ? <DataImportView enrichmentEnabled={productEnrichmentEnabled} /> : <DashboardView onNavigate={setActiveSection} raphaaaMode={productEnrichmentEnabled} />;
      default: return <DashboardView onNavigate={setActiveSection} raphaaaMode={productEnrichmentEnabled} />;
    }
  };

  return (
    <div className="fa-workspace flex">
      <style>{FA_UI_STYLES}</style>
      <aside className="fa-sidebar sticky top-0 flex h-screen shrink-0 flex-col p-4 text-white">
        <div className="fa-brand rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-300 to-fuchsia-500 text-lg font-black text-slate-950 shadow-lg shadow-indigo-950/20">FA</div>
            <div className="fa-brand-copy min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-indigo-200">RMS analytics</p>
              <h1 className="truncate text-lg font-bold">Forecast & Analytics</h1>
            </div>
          </div>
          <div className="fa-sidebar-note mt-4 rounded-xl border border-white/10 bg-slate-950/20 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-300">Signed in as</p>
            <p className="mt-1 truncate text-sm font-semibold">{adminName}</p>
            <p className="mt-0.5 truncate text-xs text-indigo-100/75">{workspaceName}</p>
            {dataHubTenantId && <p className="mt-0.5 truncate font-mono text-[10px] text-indigo-200/60">Tenant: {dataHubTenantId}</p>}
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-1.5 overflow-y-auto pr-1">
          <p className="fa-sidebar-note px-3 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</p>
          {menu.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`fa-nav-item flex w-full items-center rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition-all ${activeSection === id ? "fa-nav-item-active" : ""}`}
            >
              {React.createElement(icon, { className: "mr-3 h-[18px] w-[18px] shrink-0" })}
              <span className="fa-nav-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-4 border-t border-white/10 pt-4">
          <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-slate-100 transition hover:bg-rose-500/20 hover:text-white">
            <LogOut className="h-4 w-4" /> <span className="fa-nav-label">Log out</span>
          </button>
        </div>
      </aside>

      <main className="fa-content min-h-screen flex-1">
        <header className="fa-header sticky top-0 z-10 flex min-h-[92px] items-center justify-between gap-5 px-6 py-4 lg:px-9">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-indigo-700">
              <span>Forecast & Analytics</span><span className="h-1 w-1 rounded-full bg-indigo-500" /><span>{isStoreWorkspace ? "Store scoped" : "HQ oversight"}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">{activeLabel}</h2>
            <p className="mt-0.5 text-sm text-slate-500">Demand forecasting, vendor ranking and budget-constrained purchase planning from your real sales and order history.</p>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1540px] p-5 sm:p-7 lg:p-9">{renderContent()}</div>
      </main>
    </div>
  );
}
