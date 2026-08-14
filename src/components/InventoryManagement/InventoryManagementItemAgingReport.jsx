import { useEffect, useMemo, useState } from "react";
import { FaHourglassHalf } from "react-icons/fa";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { ReportHeader, StatTile, SectionCard, EmptyState, LoadingState, ErrorState, FilterSelect, ChartTooltip } from "./reportKit.jsx";
import { fetchReport, fmtINR, fmtNum, GRID, MUTED, STATUS } from "./reportUtils.js";

const BUCKET_COLOR = { "0-30": STATUS.good, "31-60": "#2a78d6", "61-90": STATUS.warning, "90+": STATUS.critical, "Unknown": "#c3c2b7" };
const BUCKET_ORDER = ["0-30", "31-60", "61-90", "90+", "Unknown"];

export default function InventoryManagementItemAgingReport() {
  const [division, setDivision] = useState("");
  const [section, setSection] = useState("");
  const [department, setDepartment] = useState("");
  const [bucket, setBucket] = useState("");
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
        if (bucket) params.set("bucket", bucket);
        if (search) params.set("search", search);
        const body = await fetchReport(`/inventory/item-aging?${params.toString()}`);
        if (!cancelled) setPayload(body);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load item aging.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [division, section, department, bucket, search]);

  const rows = useMemo(() => payload?.data || [], [payload]);
  const summary = payload?.summary || { total_items: 0, total_qty: 0, total_value: 0, buckets: [] };

  const divisions = useMemo(() => [...new Set(rows.map((r) => r.division).filter(Boolean))].sort(), [rows]);
  const sections = useMemo(() => [...new Set(rows.map((r) => r.section).filter(Boolean))].sort(), [rows]);
  const departments = useMemo(() => [...new Set(rows.map((r) => r.department).filter(Boolean))].sort(), [rows]);

  const chartData = BUCKET_ORDER
    .map((b) => summary.buckets.find((x) => x.bucket === b) || { bucket: b, count: 0, qty: 0, value: 0 })
    .filter((b) => b.count > 0 || b.bucket !== "Unknown");

  const criticalCount = summary.buckets.find((b) => b.bucket === "90+")?.count || 0;

  return (
    <div className="p-6">
      <ReportHeader icon={FaHourglassHalf} title="Item Aging Report" subtitle="How long current stock has sat since its last GRN receipt." />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Items in stock" value={fmtNum(summary.total_items)} />
        <StatTile label="Total quantity" value={fmtNum(summary.total_qty)} />
        <StatTile label="Total value" value={fmtINR(summary.total_value)} />
        <StatTile label="Aged 90+ days" value={fmtNum(criticalCount)} tone={criticalCount > 0 ? "critical" : "good"} sub={criticalCount > 0 ? "Review for clearance or write-off" : "Nothing critically aged"} />
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <FilterSelect label="Division" value={division} onChange={setDivision} options={divisions} />
        <FilterSelect label="Section" value={section} onChange={setSection} options={sections} />
        <FilterSelect label="Department" value={department} onChange={setDepartment} options={departments} />
        <FilterSelect label="Age bucket" value={bucket} onChange={setBucket} options={BUCKET_ORDER} />
        <label className="text-xs">
          <span className="mb-1 block font-bold text-slate-500">Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Item, SKU, barcode…" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs" />
        </label>
      </div>

      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      {loading ? <LoadingState /> : (
        <div className="grid gap-4 lg:grid-cols-5">
          <SectionCard title="Stock by age" subtitle="Quantity currently held, grouped by days since last receipt" right={null}>
            {chartData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip formatter={(v) => fmtNum(v)} />} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
                  <Bar dataKey="qty" name="Quantity" radius={[4, 4, 0, 0]} maxBarSize={64}>
                    {chartData.map((d) => <Cell key={d.bucket} fill={BUCKET_COLOR[d.bucket]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState label="No aged stock to chart yet." />}
          </SectionCard>

          <div className="lg:col-span-2 space-y-3">
            {chartData.map((b) => (
              <div key={b.bucket} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: BUCKET_COLOR[b.bucket] }} />
                  <span className="text-xs font-bold text-slate-700">{b.bucket === "Unknown" ? "No GRN history" : `${b.bucket} days`}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{fmtNum(b.count)} items</p>
                  <p className="text-[11px] text-slate-400">{fmtINR(b.value)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <SectionCard title="Item detail" subtitle={`${fmtNum(rows.length)} item(s), oldest first`}>
          {rows.length ? (
            <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    {["Item", "SKU", "Division", "Vendor", "GRN date", "Qty", "Rate", "Value", "Age (days)", "Bucket"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.barcode} className="hover:bg-slate-50/70">
                      <td className="max-w-[220px] truncate px-3 py-2 font-semibold text-slate-800">{r.item}</td>
                      <td className="px-3 py-2 text-slate-500">{r.sku || "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{r.division || "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{r.vendor_name || "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{r.grn_date || "—"}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{fmtNum(r.qty)}</td>
                      <td className="px-3 py-2 text-slate-500">{fmtINR(r.rate)}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{fmtINR(r.value)}</td>
                      <td className="px-3 py-2 text-slate-500">{r.grn_date ? r.aging_days : "—"}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-black text-white" style={{ background: BUCKET_COLOR[r.bucket] }}>{r.bucket}</span>
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
