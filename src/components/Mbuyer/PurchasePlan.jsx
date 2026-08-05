import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardList,
  Download,
  Filter,
  IndianRupee,
  PackageSearch,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  TrendingUp,
} from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

const RUPEE = "\u20B9";

function money(value) {
  return `${RUPEE}${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function qty(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

const priorityStyle = {
  High: "border-rose-200 bg-rose-50 text-rose-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-sky-200 bg-sky-50 text-sky-700",
};

function MetricCard({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
          {hint && <p className="mt-1 text-xs font-medium text-slate-500">{hint}</p>}
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ value }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold ${priorityStyle[value] || priorityStyle.Low}`}>
      {value}
    </span>
  );
}

function EmptyState({ loading }) {
  return (
    <div className="grid min-h-[320px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-white text-center">
      <div className="max-w-md p-8">
        <PackageSearch className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-4 text-lg font-black text-slate-900">{loading ? "Loading purchase plan" : "No buying suggestions yet"}</h3>
        <p className="mt-2 text-sm text-slate-500">
          {loading
            ? "Checking stock, sales, pending PO quantity and vendor history."
            : "Set reorder levels, receive sales data, or add stock movement to start generating purchase suggestions."}
        </p>
      </div>
    </div>
  );
}

export default function PurchasePlan({ onNavigate }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");

  const token = localStorage.getItem("admin_token") || localStorage.getItem("token");

  const loadPlan = useCallback(async () => {
    if (!token) {
      setError("Your session has ended. Please sign in again.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      if (priority) query.set("priority", priority);
      const response = await fetch(`${API_BASE_URL}/mbuyer/purchase-plan?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not load purchase plan.");
      setRows(data.data || []);
      setSummary(data.summary || {});
    } catch (requestError) {
      setError(requestError.message || "Could not load purchase plan.");
    } finally {
      setLoading(false);
    }
  }, [priority, search, token]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const filteredRows = useMemo(() => rows, [rows]);

  const downloadCsv = () => {
    const columns = [
      "Priority", "Product", "Barcode", "SKU", "Current Stock", "Pending PO Qty",
      "Avg Daily Sales", "Suggested Qty", "Suggested Vendor", "Expected Rate", "Expected Value", "Reason",
    ];
    const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const body = filteredRows.map((row) => [
      row.priority, row.productName, row.barcode, row.sku, row.currentStock, row.pendingPOQty,
      row.avgDailySales, row.suggestedQty, row.suggestedVendor, row.expectedRate, row.expectedValue, row.reason,
    ].map(escapeCsv).join(","));
    const blob = new Blob([[columns.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mbuyer-purchase-plan.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1680px] space-y-5">
        <section className="overflow-hidden rounded-3xl border border-cyan-100 bg-[radial-gradient(circle_at_88%_10%,rgba(34,211,238,0.24),transparent_34%),linear-gradient(135deg,#0f172a,#312e81_52%,#0369a1)] p-5 text-white shadow-lg shadow-indigo-950/10 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-200">Buying intelligence</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Purchase Plan</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-100">
                Review system-suggested buys from Forecast & Analytics demand, stock levels, pending PO quantity and vendor history before creating RFQs or purchase orders.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onNavigate?.("quick-order")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15">
                <ShoppingCart className="h-4 w-4" /> Open RFQ
              </button>
              <button type="button" onClick={() => onNavigate?.("order-details")} className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-black text-slate-950 transition hover:bg-cyan-200">
                <ClipboardList className="h-4 w-4" /> Create PO
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={PackageSearch} label="Suggestions" value={summary.totalSuggestions || 0} hint="Forecast + reorder review" tone="bg-indigo-50 text-indigo-700" />
          <MetricCard icon={AlertTriangle} label="High Priority" value={summary.highPriority || 0} hint="Urgent buying needs" tone="bg-rose-50 text-rose-700" />
          <MetricCard icon={Activity} label="Forecast Backed" value={summary.forecastBacked || 0} hint="Using Forecast & Analytics" tone="bg-amber-50 text-amber-700" />
          <MetricCard icon={Store} label="Vendor Matched" value={summary.itemsWithVendor || 0} hint="Has purchase history" tone="bg-emerald-50 text-emerald-700" />
          <MetricCard icon={IndianRupee} label="Expected Value" value={money(summary.expectedValue)} hint="Estimated buy value" tone="bg-cyan-50 text-cyan-700" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_210px_auto_auto] lg:items-end">
            <label className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">
              Search
              <div className="mt-1 flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500 focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100">
                <Search className="h-4 w-4" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product, barcode, SKU, division..." className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" />
              </div>
            </label>
            <label className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">
              Priority
              <select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100">
                <option value="">All priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </label>
            <button type="button" onClick={loadPlan} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-black text-indigo-700 transition hover:bg-indigo-50">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button type="button" onClick={downloadCsv} disabled={!filteredRows.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

        {!filteredRows.length ? <EmptyState loading={loading} /> : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Suggested purchase queue</h3>
                <p className="mt-1 text-xs font-medium text-slate-500">Buyer approves the action. The system only recommends.</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">
                <Filter className="h-3.5 w-3.5" /> {filteredRows.length} records
              </div>
            </div>
            <div className="max-h-[620px] overflow-auto">
              <table className="min-w-[1180px] w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    {["Priority", "Product", "Stock Position", "Demand", "Suggested Buy", "Vendor", "Expected", "Action"].map((head) => (
                      <th key={head} className="border-b border-slate-200 px-4 py-3">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => (
                    <tr key={`${row.barcode}-${row.productName}`} className="hover:bg-slate-50/80">
                      <td className="px-4 py-4"><PriorityBadge value={row.priority} /></td>
                      <td className="px-4 py-4">
                        <div className="font-black text-slate-900">{row.productName || "Unnamed product"}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                          <span>{row.barcode || "No barcode"}</span>
                          {row.sku && <span>{row.sku}</span>}
                          {row.department && <span>{row.department}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <div className="font-bold">Stock {qty(row.currentStock)}</div>
                        <div className="text-xs text-slate-500">Reorder {qty(row.reorderLevel)} - Pending PO {qty(row.pendingPOQty)}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <div className="inline-flex items-center gap-1 font-bold"><TrendingUp className="h-4 w-4 text-cyan-600" /> {qty(row.last30DaySales)} sold</div>
                        <div className="text-xs text-slate-500">{qty(row.avgDailySales)} per day - {row.daysLeft ?? "No"} days cover</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-lg font-black text-indigo-700">{qty(row.suggestedQty)}</div>
                        <div className="text-xs font-semibold text-slate-500">{row.reason}</div>{row.forecastTrend && <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-cyan-600">Forecast: {row.forecastTrend}</div>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-black text-slate-900">{row.suggestedVendor || "No matched vendor"}</div>
                        <div className="text-xs text-slate-500">{row.vendorOptions?.length ? `${row.vendorOptions.length} option(s) from PO history` : "Use RFQ to discover vendors"}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-black text-slate-900">{money(row.expectedValue)}</div>
                        <div className="text-xs text-slate-500">Rate {money(row.expectedRate)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => onNavigate?.("quick-order")} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700 transition hover:bg-cyan-100">
                            <BarChart3 className="h-3.5 w-3.5" /> RFQ
                          </button>
                          <button type="button" onClick={() => onNavigate?.("order-details")} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white transition hover:bg-indigo-700">
                            <ClipboardList className="h-3.5 w-3.5" /> PO
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}