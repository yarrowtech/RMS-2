import React, { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Activity, ArrowDownToLine, BarChart3, ClipboardList, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

// Each view uses its department's existing authorized, tenant-scoped source.
const CONFIG = {
  Logistics: { path: "/api/logistics/report", note: "Counts cover all matching records; each detail list shows up to 100 recent records.", metrics: [["Inbound orders", "inbound_count"], ["Dispatched transfers", "transfer_count"]], tables: [["Inbound orders", "orders", [["Order", "order_no"], ["Vendor", "vendor"], ["Status", "status"], ["Expected", "expected"]]], ["Transfers", "transfers", [["Reference", "reference"], ["From", "from"], ["To", "to"], ["Due date", "due_date"], ["Quantity", "quantity"]]]] },
  "Design & Pattern": { path: "/api/design-pattern/insights", note: "Design insights include material cost, sample cost and recorded sales units.", metrics: [], tables: [["Design insights", "data", [["Design", "design_no"], ["Style", "style_name"], ["Status", "status"], ["Material cost", "material_cost"], ["Sample cost", "sample_cost"], ["Target cost", "target_cost"], ["Sales units", "sales_units"]]]] },
  "Forecast & Analytics": { path: "/api/forecast-analytics/dashboard", note: "Sales and demand metrics use the forecast dashboard's 90-day lookback.", metrics: [["Sales revenue", "sales_kpis.total_revenue"], ["Units sold", "sales_kpis.total_units_sold"], ["Bills", "sales_kpis.bill_count"], ["Low-stock alerts", "low_stock_alert_count"], ["Approved vendors", "active_vendor_count"]], tables: [["Forecast items", "top_forecasted_items", [["Barcode", "barcode"], ["Item", "name"], ["Division", "division"], ["Sold quantity", "total_qty_sold"]]], ["Division sales", "division_breakdown", [["Division", "division"], ["Quantity sold", "qty"]]]] },
  "Production & Job Work": { path: "/api/production-flow/workspace", note: "Latest 300 production batches are shown; this list is not a complete historical total.", metrics: [], tables: [["Production batches", "batches", [["Batch", "batch_no"], ["Design", "design_no"], ["Style", "style_name"], ["Planned quantity", "planned_quantity"], ["Unit", "unit"], ["Due", "due_date"], ["Status", "status"]]]] },
  Marketing: { path: "/api/marketing/overview", note: "Campaign and engagement figures follow the marketing overview's source limits.", metrics: [["Campaigns", "data.total_campaigns"], ["Active", "data.active_campaigns"], ["Scheduled", "data.scheduled_campaigns"], ["Draft", "data.draft_campaigns"], ["Budget", "data.total_budget"], ["Redeemed value", "data.redeemed_value"], ["Impressions", "data.engagement.impressions"], ["Clicks", "data.engagement.clicks"]], tables: [["Upcoming campaigns", "data.upcoming", [["Campaign", "name"], ["Status", "status"], ["Start", "start_date"], ["End", "end_date"], ["Budget", "budget"]]]] },
  "Customer CRM": { path: "/api/customer-crm/overview", note: "Metrics reflect the tabs and records available to this login. Some source lists are limited; an unavailable metric is shown as a dash.", metrics: [["Customers", "stats.customers", "customers"], ["Repeat customers", "stats.repeat_customers", "customers"], ["Customer spend", "stats.total_spend", "customers"], ["Pending follow-ups", "stats.pending_followups", "followups"], ["Active campaigns", "stats.active_campaigns", "luckydraw"], ["Active coupons", "stats.active_coupons", "coupons"]], tables: [] },
  "Visual Merchandising": { path: "/api/visual-merchandising/operations-summary", note: "Execution task summary across stores; the source reads up to 10,000 tasks.", metrics: [["Tasks", "total"], ["Pending", "pending"], ["Awaiting review", "awaiting_review"], ["Approved", "approved"], ["Blocked", "blocked"], ["Correction required", "correction_required"], ["Overdue", "overdue"], ["Urgent", "urgent"]], tables: [] },
  "Third Party": { path: "/hq/reports/third-party", note: "Only records assigned to this tenant are shown. Older records without a tenant cannot be attributed safely and are excluded; each list is limited to 1,000 records.", metrics: [], tables: [["Vendors", "vendors", [["Name", "name"], ["Category", "category"], ["Status", "status"]]], ["Bookings", "bookings", [["Vendor", "vendorName"], ["Category", "category"], ["Project", "project"], ["Date", "date"], ["Status", "status"]]]] },
};
const get = (obj, path) => path.split(".").reduce((value, key) => value?.[key], obj);
const printable = value => value === undefined || value === null || value === "" ? "—" : typeof value === "number" ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : String(value);

export default function DepartmentOverviewReport({ department }) {
  const config = CONFIG[department];
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal) => {
    setLoading(true); setError(""); setData(null);
    try {
      const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE_URL}${config.path}`, { headers: { Authorization: `Bearer ${token}` }, signal });
      const body = await res.json();
      if (!res.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Could not load the report.");
      setData(body);
    } catch (e) { if (e.name !== "AbortError") setError(e.message || "Could not load the report."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [config]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  const metrics = config.metrics.filter(([, , tab]) => !tab || data?.crm_tabs == null || data.crm_tabs.includes(tab));
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const summary = metrics.map(([label, path]) => ({ Metric: label, Value: get(data, path) ?? "" }));
    if (summary.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
    config.tables.forEach(([title, path, columns]) => {
      const rows = get(data, path) || [];
      const mapped = rows.map(row => Object.fromEntries(columns.map(([label, key]) => [label, get(row, key) ?? ""])));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mapped, { header: columns.map(([label]) => label) }), title.slice(0, 31));
    });
    if (wb.SheetNames.length) XLSX.writeFile(wb, `${department.replace(/[^a-z0-9]+/gi, "_")}_report.xlsx`);
  };
  return <section>
    <div className="flex flex-wrap items-start justify-between gap-5 border-b border-slate-100 px-5 py-6 sm:px-8 sm:py-7">
      <div className="flex items-start gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><BarChart3 size={21} /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">Department overview</p><h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900">{department}</h3><p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-500">{data?.note || config.note}</p></div></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button><button onClick={exportExcel} disabled={!data} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50"><ArrowDownToLine size={14} /> Export Excel</button></div>
    </div>
    <div className="space-y-7 bg-slate-50/50 px-5 py-6 sm:px-8 sm:py-7">
    {loading && <p className="py-8 text-sm text-slate-500">Loading report…</p>}
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    {data && <>{metrics.length > 0 && <div><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Activity size={15} className="text-teal-700" /><h4 className="text-sm font-bold text-slate-800">Performance overview</h4></div><span className="text-xs text-slate-400">Current data</span></div><div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, path]) => <div key={path} className="border-b border-slate-100 px-5 py-5 last:border-b-0 sm:border-r"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{printable(get(data, path))}</p></div>)}</div></div>}
      {department === "Visual Merchandising" && Number(data.total) > 0 && <div className="rounded-xl border border-slate-200 bg-white p-5"><h4 className="text-sm font-semibold text-slate-800">Task status</h4><p className="mt-1 text-xs text-slate-500">Distribution of recorded execution tasks.</p><div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-slate-100">{[["pending", "bg-slate-400"], ["awaiting_review", "bg-sky-500"], ["approved", "bg-emerald-500"], ["blocked", "bg-rose-500"], ["correction_required", "bg-amber-500"]].map(([key, color]) => <div key={key} className={color} style={{ width: `${(Number(data[key] || 0) / Number(data.total)) * 100}%` }} title={`${key.replaceAll("_", " ")}: ${data[key] || 0}`} />)}</div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">{[["Pending", "pending", "bg-slate-400"], ["Awaiting review", "awaiting_review", "bg-sky-500"], ["Approved", "approved", "bg-emerald-500"], ["Blocked", "blocked", "bg-rose-500"], ["Correction required", "correction_required", "bg-amber-500"]].map(([label, key, color]) => <span key={key} className="inline-flex items-center gap-2 text-xs text-slate-600"><span className={`h-2 w-2 rounded-full ${color}`} />{label} <strong className="text-slate-800">{printable(data[key])}</strong></span>)}</div></div>}
      {department === "Visual Merchandising" && data.total != null && Number(data.total) === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center"><ClipboardList size={22} className="mx-auto text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-700">No execution tasks yet</p><p className="mt-1 text-xs text-slate-500">Task activity will appear here when records are available.</p></div>}
      {config.tables.map(([title, path, columns]) => { const rows = get(data, path) || []; return <div key={path}><div className="mb-3 flex items-center gap-2"><ClipboardList size={15} className="text-teal-700" /><h4 className="text-sm font-bold text-slate-800">{title}</h4><span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{rows.length}</span></div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{columns.map(([label]) => <th key={label} className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-t border-slate-100 transition hover:bg-slate-50">{columns.map(([, key]) => <td key={key} className="whitespace-nowrap px-4 py-3 text-slate-700">{printable(get(row, key))}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="p-6 text-center text-sm text-slate-500">No records available.</p>}</div></div>; })}</>}
    </div>
  </section>;
}
