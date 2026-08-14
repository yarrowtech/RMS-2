import { useEffect, useMemo, useState } from "react";
import { FaWarehouse } from "react-icons/fa";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { ReportHeader, StatTile, SectionCard, EmptyState, LoadingState, ErrorState, FilterSelect, ChartTooltip } from "./reportKit.jsx";
import { fetchReport, fmtNum, SERIES, STATUS, GRID, MUTED } from "./reportUtils.js";

const STATUS_COLOR = { "In Stock": STATUS.good, "Low Stock": STATUS.warning, "Out of Stock": STATUS.critical };

export default function InventoryManagementWareHouseWizeStock() {
  const [warehouse, setWarehouse] = useState("");
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
        if (search) params.set("search", search);
        const body = await fetchReport(`/inventory/warehouse-stock?${params.toString()}`);
        if (!cancelled) setPayload(body);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load warehouse stock.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [warehouse, search]);

  const rows = useMemo(() => payload?.data || [], [payload]);
  const summary = payload?.summary || { warehouses: [], by_warehouse: [] };

  const totalQty = useMemo(() => summary.by_warehouse.reduce((s, w) => s + w.qty, 0), [summary.by_warehouse]);
  const totalLow = useMemo(() => summary.by_warehouse.reduce((s, w) => s + w.low_stock, 0), [summary.by_warehouse]);
  const totalOut = useMemo(() => summary.by_warehouse.reduce((s, w) => s + w.out_of_stock, 0), [summary.by_warehouse]);

  return (
    <div className="p-6">
      <ReportHeader icon={FaWarehouse} title="Warehouse-wise Stock" subtitle="Current stock quantity split by warehouse / store." />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Warehouses" value={fmtNum(summary.warehouses.length)} />
        <StatTile label="Total quantity" value={fmtNum(totalQty)} />
        <StatTile label="Low stock items" value={fmtNum(totalLow)} tone={totalLow > 0 ? "warning" : "good"} />
        <StatTile label="Out of stock items" value={fmtNum(totalOut)} tone={totalOut > 0 ? "critical" : "good"} />
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <FilterSelect label="Warehouse" value={warehouse} onChange={setWarehouse} options={summary.warehouses} />
        <label className="text-xs">
          <span className="mb-1 block font-bold text-slate-500">Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Item, SKU, barcode…" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs" />
        </label>
      </div>

      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      {loading ? <LoadingState /> : (
        <div className="grid gap-4 lg:grid-cols-5">
          <SectionCard title="Quantity per warehouse" subtitle="Total units currently held">
            {summary.by_warehouse.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={summary.by_warehouse} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="warehouse" tick={{ fontSize: 11, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip formatter={(v) => fmtNum(v)} />} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
                  <Bar dataKey="qty" name="Quantity" radius={[4, 4, 0, 0]} maxBarSize={64}>
                    {summary.by_warehouse.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState label="No warehouse stock yet." />}
          </SectionCard>

          <div className="lg:col-span-2 space-y-3">
            {summary.by_warehouse.map((w, i) => (
              <div key={w.warehouse} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
                    {w.warehouse}
                  </span>
                  <span className="text-sm font-bold text-slate-900">{fmtNum(w.qty)} units</span>
                </div>
                <div className="mt-1.5 flex gap-3 text-[11px] text-slate-500">
                  <span>{fmtNum(w.items)} items</span>
                  {w.low_stock > 0 && <span className="font-bold" style={{ color: STATUS.warning }}>{w.low_stock} low</span>}
                  {w.out_of_stock > 0 && <span className="font-bold" style={{ color: STATUS.critical }}>{w.out_of_stock} out</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <SectionCard title="Item detail" subtitle={`${fmtNum(rows.length)} item(s)`}>
          {rows.length ? (
            <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    {["Item", "SKU", "Warehouse", "Qty", "Reorder level", "Status"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={`${r.barcode}-${r.warehouse}`} className="hover:bg-slate-50/70">
                      <td className="max-w-[220px] truncate px-3 py-2 font-semibold text-slate-800">{r.item}</td>
                      <td className="px-3 py-2 text-slate-500">{r.sku || "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{r.warehouse}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{fmtNum(r.qty)}</td>
                      <td className="px-3 py-2 text-slate-500">{r.reorder_level != null ? fmtNum(r.reorder_level) : "—"}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-black text-white" style={{ background: STATUS_COLOR[r.status] }}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState label="No stock matches these filters." />}
        </SectionCard>
      </div>
    </div>
  );
}
