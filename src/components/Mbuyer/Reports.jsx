import React, { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  Download,
  IndianRupee,
  PackageCheck,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

const COLORS = ["#5b3df5", "#0891b2", "#16a34a", "#f97316", "#db2777", "#ca8a04", "#64748b"];
const RUPEE = "\u20B9";

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

function money(value) {
  return `${RUPEE}${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function MetricCard({ icon: Icon, label, value, hint, tone = "indigo" }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{hint}</p>
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ChartEmpty({ text = "No data for the selected period." }) {
  return <div className="grid h-full min-h-[260px] place-items-center text-sm font-medium text-slate-400">{text}</div>;
}

export default function Reports() {
  const today = new Date();
  const initialStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const [fromDate, setFromDate] = useState(ymd(initialStart));
  const [toDate, setToDate] = useState(ymd(today));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
    if (!token) {
      setError("Your session has ended. Please sign in again.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const query = new URLSearchParams();
      if (fromDate) query.set("from_date", fromDate);
      if (toDate) query.set("to_date", toDate);
      const response = await fetch(`${API_BASE_URL}/mbuyer/reports?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not load the procurement report.");
      setReport(data);
    } catch (requestError) {
      setError(requestError.message || "Could not load the procurement report.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const downloadCsv = () => {
    const rows = report?.rows || [];
    const columns = ["PO Number", "Order Date", "Vendor", "Status", "Items", "PO Value", "Due Date", "Raised By"];
    const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const body = rows.map((row) => [
      row.order_no, row.order_date, row.vendor, row.status, row.item_count,
      Number(row.value || 0).toFixed(2), row.due_date, row.buyer,
    ].map(escapeCsv).join(","));
    const csv = [columns.join(","), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mbuyer-procurement-report_${fromDate || "all"}_to_${toDate || "today"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const summary = report?.summary || {};
  const rows = report?.rows || [];
  const monthlySpend = report?.monthly_spend || [];
  const statusDistribution = report?.status_distribution || [];
  const vendorSpend = report?.vendor_spend || [];

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <section className="rounded-3xl border border-indigo-100 bg-[radial-gradient(circle_at_90%_0%,rgba(129,140,248,0.24),transparent_36%),linear-gradient(135deg,#ffffff,#f7f7ff)] p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-600">Procurement intelligence</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">M-Buyer Reports</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">Live purchase-order performance, vendor spend, receiving value and delivery exposure for your retailer.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="text-xs font-bold text-slate-600">From
                <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none ring-indigo-500 focus:ring-2" />
              </label>
              <label className="text-xs font-bold text-slate-600">To
                <input type="date" value={toDate} min={fromDate || undefined} max={ymd(today)} onChange={(event) => setToDate(event.target.value)} className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none ring-indigo-500 focus:ring-2" />
              </label>
              <button type="button" onClick={loadReport} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              <button type="button" onClick={downloadCsv} disabled={!rows.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Download className="h-4 w-4" /> Download CSV
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={CalendarDays} label="Purchase orders" value={summary.po_count || 0} hint={`${summary.item_count || 0} total line items`} />
          <MetricCard icon={IndianRupee} label="Committed value" value={money(summary.total_value)} hint={`Average ${money(summary.average_po_value)} per PO`} tone="cyan" />
          <MetricCard icon={PackageCheck} label="Received through GRC" value={money(summary.received_value)} hint={`${summary.grc_count || 0} goods receipt certificate(s)`} tone="emerald" />
          <MetricCard icon={TriangleAlert} label="Overdue POs" value={summary.overdue_pos || 0} hint={`${summary.committed_pos || 0} committed / approved POs`} tone="rose" />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4"><h3 className="font-extrabold text-slate-900">Monthly PO value</h3><p className="mt-1 text-xs text-slate-500">Order value created in the selected period.</p></div>
            <div className="h-[285px]">
              {loading ? <ChartEmpty text="Loading chart..." /> : monthlySpend.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlySpend} margin={{ left: 5, right: 10, top: 10 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(value) => `${RUPEE}${Math.round(value / 1000)}k`} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip formatter={(value) => [money(value), "PO value"]} contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }} />
                    <Line type="monotone" dataKey="value" stroke="#5b3df5" strokeWidth={3} dot={{ r: 4, fill: "#5b3df5" }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <ChartEmpty />}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4"><h3 className="font-extrabold text-slate-900">PO status mix</h3><p className="mt-1 text-xs text-slate-500">Current status of purchase orders created in the selected period.</p></div>
            <div className="h-[285px]">
              {loading ? <ChartEmpty text="Loading chart..." /> : statusDistribution.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusDistribution} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={3}>
                      {statusDistribution.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [value, "POs"]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <ChartEmpty />}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
            <div className="mb-4"><h3 className="font-extrabold text-slate-900">Top vendors by PO value</h3><p className="mt-1 text-xs text-slate-500">Where the buying budget is being committed.</p></div>
            <div className="h-[300px]">
              {loading ? <ChartEmpty text="Loading chart..." /> : vendorSpend.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendorSpend} layout="vertical" margin={{ left: 10, right: 25, top: 5, bottom: 5 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(value) => `${RUPEE}${Math.round(value / 1000)}k`} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="vendor" width={130} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => [money(value), "PO value"]} contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }} />
                    <Bar dataKey="value" fill="#0891b2" radius={[0, 7, 7, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <ChartEmpty />}
            </div>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="font-extrabold text-slate-900">Purchase order register</h3><p className="mt-1 text-xs text-slate-500">The exact rows included in the CSV download.</p></div>
            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{rows.length} records</span>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-[940px] w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
                <tr>{["PO number", "Date", "Vendor", "Status", "Items", "Value", "Due date", "Raised by"].map((head) => <th key={head} className="border-b border-slate-200 px-4 py-3">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan="8" className="px-4 py-10 text-center text-slate-400">Loading procurement data...</td></tr>
                  : !rows.length ? <tr><td colSpan="8" className="px-4 py-10 text-center text-slate-400">No purchase orders match this period.</td></tr>
                  : rows.map((row) => <tr key={`${row.order_no}-${row.order_date}`} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-bold text-indigo-700">{row.order_no || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.order_date || "-"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.vendor}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{row.status}</span></td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-700">{row.item_count}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{money(row.value)}</td>
                    <td className="px-4 py-3 text-slate-600">{row.due_date || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.buyer || "-"}</td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
