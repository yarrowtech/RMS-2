import { useEffect, useMemo, useState } from "react";
import { FaCoins } from "react-icons/fa";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { ReportHeader, StatTile, SectionCard, EmptyState, LoadingState, ErrorState, FilterSelect, ChartTooltip } from "./reportKit.jsx";
import { fetchReport, fmtINR, fmtNum, SERIES, GRID, MUTED } from "./reportUtils.js";

export default function InventoryManagementStockValuationReport() {
  const [division, setDivision] = useState("");
  const [section, setSection] = useState("");
  const [department, setDepartment] = useState("");
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
        if (division) params.set("division", division);
        if (section) params.set("section", section);
        if (department) params.set("department", department);
        if (warehouse) params.set("warehouse", warehouse);
        if (search) params.set("search", search);
        const body = await fetchReport(`/inventory/stock-valuation?${params.toString()}`);
        if (!cancelled) setPayload(body);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load stock valuation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [division, section, department, warehouse, search]);

  const rows = useMemo(() => payload?.data || [], [payload]);
  const summary = payload?.summary || { total_items: 0, total_qty: 0, total_value: 0, by_warehouse: [], by_division: [] };

  const divisions = useMemo(() => [...new Set(rows.map((r) => r.division).filter(Boolean))].sort(), [rows]);
  const sections = useMemo(() => [...new Set(rows.map((r) => r.section).filter(Boolean))].sort(), [rows]);
  const departments = useMemo(() => [...new Set(rows.map((r) => r.department).filter(Boolean))].sort(), [rows]);
  const warehouses = useMemo(() => [...new Set(rows.map((r) => r.warehouse).filter(Boolean))].sort(), [rows]);

  const divisionChart = summary.by_division.slice(0, 8);
  const topItem = rows[0];

  return (
    <div className="p-6">
      <ReportHeader icon={FaCoins} title="Stock Valuation Report" subtitle="Current stock value (quantity × cost rate) across every warehouse." />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total stock value" value={fmtINR(summary.total_value)} />
        <StatTile label="Items valued" value={fmtNum(summary.total_items)} />
        <StatTile label="Total quantity" value={fmtNum(summary.total_qty)} />
        <StatTile label="Highest-value item" value={topItem ? fmtINR(topItem.value) : "—"} sub={topItem?.item} />
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <FilterSelect label="Warehouse" value={warehouse} onChange={setWarehouse} options={warehouses} />
        <FilterSelect label="Division" value={division} onChange={setDivision} options={divisions} />
        <FilterSelect label="Section" value={section} onChange={setSection} options={sections} />
        <FilterSelect label="Department" value={department} onChange={setDepartment} options={departments} />
        <label className="text-xs">
          <span className="mb-1 block font-bold text-slate-500">Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Item, SKU, barcode…" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs" />
        </label>
      </div>

      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      {loading ? <LoadingState /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Value by warehouse" subtitle="Where stock value currently sits">
            {summary.by_warehouse.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={summary.by_warehouse} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtINR(v)} />
                  <YAxis type="category" dataKey="warehouse" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip content={<ChartTooltip formatter={(v) => fmtINR(v)} />} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
                  <Bar dataKey="value" name="Value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {summary.by_warehouse.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState label="No valued stock yet." />}
          </SectionCard>

          <SectionCard title="Value by division" subtitle="Top divisions by stock value">
            {divisionChart.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={divisionChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="division" tick={{ fontSize: 10, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtINR(v)} />
                  <Tooltip content={<ChartTooltip formatter={(v) => fmtINR(v)} />} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
                  <Bar dataKey="value" name="Value" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState label="No division data yet." />}
          </SectionCard>
        </div>
      )}

      <div className="mt-4">
        <SectionCard title="Item detail" subtitle={`${fmtNum(rows.length)} item(s), highest value first`}>
          {rows.length ? (
            <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    {["Item", "SKU", "Warehouse", "Division", "Qty", "Rate", "Value"].map((h) => (
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
                      <td className="px-3 py-2 text-slate-500">{r.division || "—"}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{fmtNum(r.qty)}</td>
                      <td className="px-3 py-2 text-slate-500">{fmtINR(r.rate)}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{fmtINR(r.value)}</td>
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
