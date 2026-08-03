import React, { useCallback, useEffect, useState } from "react";
import { getAdminName, getAdminScope, getStoreName, logoutOrReturnToDepartmentSelector } from "../utils/authRedirect";
import { API_BASE_URL } from "../config/api.js";
import {
  LineChart, TrendingUp, TrendingDown, Minus, Building2, Wallet, LogOut,
  Search, RefreshCw, AlertTriangle, ShoppingCart, BarChart3,
} from "lucide-react";

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
function DashboardView({ onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    faFetch("/api/forecast-analytics/dashboard")
      .then((r) => setData(r))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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

      <div className="fa-panel overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4"><h4 className="text-sm font-bold text-slate-900">Top 5 items by recent demand</h4></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{["Item", "SKU", "Weekly avg", "Next-period forecast", "Trend"].map((h) => <th key={h} className="px-4 py-2.5 text-left font-bold uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
                : !data?.top_forecasted_items?.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No sales history yet in the lookback window.</td></tr>
                : data.top_forecasted_items.map((row) => (
                  <tr key={row.barcode}>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{row.name || row.barcode}</td>
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
function DemandForecastView() {
  const [rows, setRows] = useState([]);
  const [lookbackDays, setLookbackDays] = useState(90);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await faFetch(`/api/forecast-analytics/demand-forecast?lookback_days=${lookbackDays}&limit=50`);
      setRows(r.data || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [lookbackDays]);

  useEffect(() => { load(); }, [load]);

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

      <div className="fa-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{["Item", "SKU", "Weeks active", "Weekly avg", "Forecast (next)", "Trend", "Avg price", "Avg cost", "Margin/unit"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left font-bold uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No sales history in this window yet.</td></tr>
                : rows.map((row) => (
                  <tr key={row.barcode}>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{row.name || row.barcode}</td>
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
function VendorRankingView() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true); setError(null); setSearched(true);
    try {
      const r = await faFetch(`/api/forecast-analytics/vendor-ranking?q=${encodeURIComponent(q.trim())}&limit=20`);
      setRows(r.data || []);
      setNote(r.note || "");
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />
      <div className="fa-panel p-5">
        <h4 className="text-sm font-bold text-slate-900">Vendor ranking</h4>
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
        <div className="fa-panel overflow-hidden">
          {note && <p className="border-b border-slate-100 bg-amber-50 px-5 py-2.5 text-xs font-semibold text-amber-700">{note}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>{["Vendor", "Item", "Category", "Price range", "MOQ", "Orders with you", "Avg fulfillment", "Score"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left font-bold uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Searching…</td></tr>
                  : rows.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No approved vendors match this search.</td></tr>
                  : rows.map((row) => (
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
      )}
    </div>
  );
}

/* ── Low Stock Alerts (automation output) ── */
function AlertsView() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    faFetch("/api/forecast-analytics/alerts")
      .then((r) => setRows(r.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

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

      <div className="fa-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{["Item", "SKU", "Location", "Stock on hand", "Weekly avg sold", "Days remaining", "Severity"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left font-bold uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No low-stock items right now — nothing is projected to run out within 14 days.</td></tr>
                : rows.map((row) => (
                  <tr key={`${row.store_id || "hq"}-${row.barcode}`}>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{row.name || row.barcode}</td>
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

/* ── Purchase Plan ── */
function PurchasePlanView() {
  const [budget, setBudget] = useState("");
  const [lookbackDays, setLookbackDays] = useState(90);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(null);
  const [draftLoading, setDraftLoading] = useState(true);

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

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />

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
                {draft.lines.map((line) => (
                  <tr key={line.barcode}>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{line.name || line.barcode}</td>
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
                    : plan.lines.map((line) => (
                      <tr key={line.barcode}>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{line.name || line.barcode}{line.partial && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">partial</span>}</td>
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

export default function ForecastAnalytics() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const isStoreWorkspace = getAdminScope() !== "hq";
  const workspaceName = isStoreWorkspace ? (getStoreName() || "Store workspace") : "Head office workspace";
  const adminName = getAdminName() || "Analytics Administrator";
  const activeLabel = MENU.find((item) => item.id === activeSection)?.label || "Overview";
  const handleLogout = () => logoutOrReturnToDepartmentSelector();

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard": return <DashboardView onNavigate={setActiveSection} />;
      case "demand": return <DemandForecastView />;
      case "vendors": return <VendorRankingView />;
      case "purchase": return <PurchasePlanView />;
      case "alerts": return <AlertsView />;
      default: return <DashboardView onNavigate={setActiveSection} />;
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
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-1.5 overflow-y-auto pr-1">
          <p className="fa-sidebar-note px-3 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</p>
          {MENU.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`fa-nav-item flex w-full items-center rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition-all ${activeSection === id ? "fa-nav-item-active" : ""}`}
            >
              <Icon className="mr-3 h-[18px] w-[18px] shrink-0" />
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
