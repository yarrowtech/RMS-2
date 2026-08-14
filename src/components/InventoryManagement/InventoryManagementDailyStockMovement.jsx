import { useEffect, useMemo, useState } from "react";
import { FaExchangeAlt } from "react-icons/fa";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ReportHeader, StatTile, SectionCard, EmptyState, LoadingState, ErrorState, FilterSelect, ChartTooltip } from "./reportKit.jsx";
import { fetchReport, fmtINR, fmtNum, SERIES, GRID, MUTED } from "./reportUtils.js";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

export default function InventoryManagementDailyStockMovement() {
  const [warehouse, setWarehouse] = useState("");
  const [fromDate, setFromDate] = useState(daysAgoISO(30));
  const [toDate, setToDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError("");
      try {
        const params = new URLSearchParams();
        if (warehouse) params.set("warehouse", warehouse);
        if (fromDate) params.set("from_date", fromDate);
        if (toDate) params.set("to_date", toDate);
        if (search) params.set("search", search);
        const body = await fetchReport(`/inventory/daily-stock-movement?${params.toString()}`);
        if (!cancelled) setPayload(body);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load stock movement.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [warehouse, fromDate, toDate, search]);

  const rows = useMemo(() => payload?.data || [], [payload]);
  const summary = payload?.summary || { total_in_qty: 0, total_out_qty: 0, total_in_value: 0, total_out_value: 0, daily: [] };
  const warehouses = useMemo(() => [...new Set(rows.map((r) => r.warehouse).filter(Boolean))].sort(), [rows]);
  const netQty = summary.total_in_qty - summary.total_out_qty;

  return (
    <div className="p-6">
      <ReportHeader icon={FaExchangeAlt} title="Daily Stock Movement" subtitle="Stock received (GRN) vs. issued/adjusted, by day." />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Stock in" value={fmtNum(summary.total_in_qty)} sub={fmtINR(summary.total_in_value)} tone="good" />
        <StatTile label="Stock out" value={fmtNum(summary.total_out_qty)} sub={fmtINR(summary.total_out_value)} tone={summary.total_out_qty > 0 ? "warning" : "default"} />
        <StatTile label="Net change" value={`${netQty >= 0 ? "+" : ""}${fmtNum(netQty)}`} tone={netQty >= 0 ? "good" : "critical"} />
        <StatTile label="Transactions" value={fmtNum(rows.length)} />
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <label className="text-xs">
          <span className="mb-1 block font-bold text-slate-500">From</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs" />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-bold text-slate-500">To</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs" />
        </label>
        <FilterSelect label="Warehouse" value={warehouse} onChange={setWarehouse} options={warehouses} />
        <label className="text-xs">
          <span className="mb-1 block font-bold text-slate-500">Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Item, SKU, doc no…" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs" />
        </label>
      </div>

      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      {loading ? <LoadingState /> : (
        <SectionCard title="In vs. out over time" subtitle="Daily quantity moved, by transaction date">
          {summary.daily.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={summary.daily} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip formatter={(v) => fmtNum(v)} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                <Line type="monotone" dataKey="in_qty" name="Stock in" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="out_qty" name="Stock out" stroke={SERIES[1]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState label="No stock movement in this date range." />}
        </SectionCard>
      )}

      <div className="mt-4">
        <SectionCard title="Transaction detail" subtitle={`${fmtNum(rows.length)} transaction(s), newest first`}>
          {rows.length ? (
            <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    {["Date", "Type", "Doc no.", "Item", "Warehouse", "In", "Out", "Value", "Reference"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={`${r.doc_no}-${r.barcode}-${i}`} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.date}</td>
                      <td className="px-3 py-2 text-slate-500">{r.doc_type}</td>
                      <td className="px-3 py-2 text-slate-500">{r.doc_no || "—"}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 font-semibold text-slate-800">{r.product}</td>
                      <td className="px-3 py-2 text-slate-500">{r.warehouse}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: r.in_qty > 0 ? SERIES[0] : undefined }}>{r.in_qty > 0 ? `+${fmtNum(r.in_qty)}` : "—"}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: r.out_qty > 0 ? SERIES[1] : undefined }}>{r.out_qty > 0 ? `-${fmtNum(r.out_qty)}` : "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{r.value ? fmtINR(r.value) : "—"}</td>
                      <td className="max-w-[160px] truncate px-3 py-2 text-slate-400">{r.ref}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState label="No transactions match these filters." />}
        </SectionCard>
      </div>
    </div>
  );
}
