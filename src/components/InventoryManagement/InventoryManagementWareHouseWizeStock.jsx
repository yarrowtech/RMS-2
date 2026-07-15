import React, { useMemo, useState } from "react";
import { FaWarehouse, FaBoxes, FaChartBar, FaChartLine } from "react-icons/fa";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

/* ===================== helpers ===================== */
const num = (n) => new Intl.NumberFormat("en-IN").format(Number(n || 0));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ===================== PART 4: WAREHOUSE WISE STOCK (Charts only) ===================== */
/* ✅ background WHITE + ✅ 10 graphs + ✅ warehouses fixed */
const STOCK = [
  { dt: "2026-01-01", wh: "Main - New Market", sku: "ACC-ST-001", item: "Soft Teddy Bear (Medium)", qty: 106, rop: 40, ageDays: 25, daysToExpire: 250 },
  { dt: "2026-01-01", wh: "Store - Chowringhee", sku: "KID-B-TS-032", item: "Kids T-Shirt (Blue)", qty: 25, rop: 15, ageDays: 45, daysToExpire: 999 },
  { dt: "2026-01-01", wh: "Store - Hatibagan", sku: "HPC-HR-055", item: "Herbal Shampoo 180ml", qty: 146, rop: 60, ageDays: 18, daysToExpire: 180 },

  { dt: "2026-01-05", wh: "Main - New Market", sku: "HHA-UT-099", item: "Steel Kadai 2L", qty: 10, rop: 6, ageDays: 120, daysToExpire: 999 },
  { dt: "2026-01-05", wh: "Store - Chowringhee", sku: "WIN-JK-110", item: "Winter Jacket", qty: 28, rop: 12, ageDays: 70, daysToExpire: 999 },
  { dt: "2026-01-05", wh: "Store - Hatibagan", sku: "ELEC-LB-009", item: "LED Bulb 9W", qty: 300, rop: 120, ageDays: 15, daysToExpire: 999 },

  { dt: "2026-01-10", wh: "Main - New Market", sku: "FMCG-FO-021", item: "Rice 10kg", qty: 120, rop: 80, ageDays: 30, daysToExpire: 365 },
  { dt: "2026-01-10", wh: "Store - Chowringhee", sku: "FMCG-HP-090", item: "Detergent Powder 1kg", qty: 110, rop: 90, ageDays: 22, daysToExpire: 999 },
  { dt: "2026-01-10", wh: "Store - Hatibagan", sku: "ACC-JW-007", item: "Jewellery Set", qty: 18, rop: 8, ageDays: 10, daysToExpire: 999 },

  { dt: "2026-01-15", wh: "Main - New Market", sku: "HPC-HR-055", item: "Herbal Shampoo 180ml", qty: 135, rop: 60, ageDays: 28, daysToExpire: 160 },
  { dt: "2026-01-15", wh: "Store - Chowringhee", sku: "ACC-ST-001", item: "Soft Teddy Bear (Medium)", qty: 42, rop: 40, ageDays: 35, daysToExpire: 220 },
  { dt: "2026-01-15", wh: "Store - Hatibagan", sku: "FMCG-FO-021", item: "Rice 10kg", qty: 95, rop: 80, ageDays: 44, daysToExpire: 340 },
];

export default function WarehouseWiseStock_Part4_10Graphs() {
  const WAREHOUSES = useMemo(
    () => ["All", "Main - New Market", "Store - Chowringhee", "Store - Hatibagan"],
    []
  );

  const [warehouse, setWarehouse] = useState("All");

  const rows = useMemo(() => {
    return STOCK.filter((r) => (warehouse === "All" ? true : r.wh === warehouse));
  }, [warehouse]);

  /* ===================== KPIs ===================== */
  const kpis = useMemo(() => {
    const totalQty = rows.reduce((s, r) => s + Number(r.qty || 0), 0);
    const skuCount = new Set(rows.map((r) => r.sku)).size;
    const lowCount = rows.filter((r) => Number(r.qty || 0) <= Number(r.rop || 0)).length;
    const avgAge = rows.length ? rows.reduce((s, r) => s + Number(r.ageDays || 0), 0) / rows.length : 0;
    return { totalQty, skuCount, lowCount, avgAge };
  }, [rows]);

  /* ===================== datasets ===================== */

  // 1) Qty by Date (trend)
  const qtyByDate = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.dt, (m.get(r.dt) || 0) + r.qty));
    return Array.from(m.entries())
      .map(([dt, qty]) => ({ dt, qty }))
      .sort((a, b) => a.dt.localeCompare(b.dt));
  }, [rows]);

  // 2) Qty by Warehouse (overall, ignores filter so user can compare)
  const qtyByWarehouse = useMemo(() => {
    const m = new Map();
    STOCK.forEach((r) => m.set(r.wh, (m.get(r.wh) || 0) + r.qty));
    return Array.from(m.entries()).map(([wh, qty]) => ({ wh, qty }));
  }, []);

  // 3) SKU Count by Warehouse
  const skuCountByWh = useMemo(() => {
    const m = new Map();
    STOCK.forEach((r) => {
      const set = m.get(r.wh) || new Set();
      set.add(r.sku);
      m.set(r.wh, set);
    });
    return Array.from(m.entries()).map(([wh, set]) => ({ wh, skus: set.size }));
  }, []);

  // 4) Top SKUs by Qty (filtered)
  const topSkuQty = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.sku, (m.get(r.sku) || 0) + r.qty));
    return Array.from(m.entries())
      .map(([sku, qty]) => ({ sku, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [rows]);

  // 5) Low stock count by Warehouse (overall)
  const lowStockByWh = useMemo(() => {
    const m = new Map();
    STOCK.forEach((r) => {
      const isLow = Number(r.qty || 0) <= Number(r.rop || 0);
      if (!isLow) return;
      m.set(r.wh, (m.get(r.wh) || 0) + 1);
    });
    return Array.from(m.entries()).map(([wh, low]) => ({ wh, low }));
  }, []);

  // 6) Aging distribution buckets (filtered)
  const agingBuckets = useMemo(() => {
    const buckets = [
      { bucket: "0-30", min: 0, max: 30, count: 0 },
      { bucket: "31-60", min: 31, max: 60, count: 0 },
      { bucket: "61-90", min: 61, max: 90, count: 0 },
      { bucket: "91-180", min: 91, max: 180, count: 0 },
      { bucket: "180+", min: 181, max: Infinity, count: 0 },
    ];
    rows.forEach((r) => {
      const a = Number(r.ageDays || 0);
      const b = buckets.find((x) => a >= x.min && a <= x.max);
      if (b) b.count += 1;
    });
    return buckets;
  }, [rows]);

  // 7) Expiry risk buckets (filtered) - daysToExpire
  const expiryBuckets = useMemo(() => {
    const buckets = [
      { bucket: "0-30", min: 0, max: 30, count: 0 },
      { bucket: "31-60", min: 31, max: 60, count: 0 },
      { bucket: "61-90", min: 61, max: 90, count: 0 },
      { bucket: "90+", min: 91, max: Infinity, count: 0 },
    ];
    rows.forEach((r) => {
      const d = Number(r.daysToExpire || 999);
      const b = buckets.find((x) => d >= x.min && d <= x.max);
      if (b) b.count += 1;
    });
    return buckets;
  }, [rows]);

  // 8) Scatter: Qty vs Age (filtered)
  const scatterQtyAge = useMemo(() => {
    return rows.map((r) => ({
      x: Number(r.qty || 0),
      y: Number(r.ageDays || 0),
      sku: r.sku,
    }));
  }, [rows]);

  // 9) ROP vs Qty (filtered)
  const ropVsQty = useMemo(() => {
    return rows.map((r) => ({
      sku: r.sku,
      qty: Number(r.qty || 0),
      rop: Number(r.rop || 0),
    }));
  }, [rows]);

  // 10) Radar: Warehouse Health Score (overall)
  const whHealthRadar = useMemo(() => {
    // simple heuristic per warehouse:
    // - higher qty is better
    // - fewer low stock is better
    // - lower avg age is better
    // - more sku variety is better
    const whs = ["Main - New Market", "Store - Chowringhee", "Store - Hatibagan"];

    const qty = new Map();
    const low = new Map();
    const ageSum = new Map();
    const ageCnt = new Map();
    const skuSet = new Map();

    STOCK.forEach((r) => {
      qty.set(r.wh, (qty.get(r.wh) || 0) + r.qty);
      const isLow = Number(r.qty || 0) <= Number(r.rop || 0);
      if (isLow) low.set(r.wh, (low.get(r.wh) || 0) + 1);

      ageSum.set(r.wh, (ageSum.get(r.wh) || 0) + Number(r.ageDays || 0));
      ageCnt.set(r.wh, (ageCnt.get(r.wh) || 0) + 1);

      const set = skuSet.get(r.wh) || new Set();
      set.add(r.sku);
      skuSet.set(r.wh, set);
    });

    const qtyMax = Math.max(...whs.map((w) => qty.get(w) || 0), 1);
    const lowMax = Math.max(...whs.map((w) => low.get(w) || 0), 1);
    const ageMax = Math.max(...whs.map((w) => (ageSum.get(w) || 0) / Math.max(1, ageCnt.get(w) || 0)), 1);
    const skuMax = Math.max(...whs.map((w) => (skuSet.get(w)?.size || 0)), 1);

    return whs.map((w) => {
      const q = qty.get(w) || 0;
      const l = low.get(w) || 0;
      const a = (ageSum.get(w) || 0) / Math.max(1, ageCnt.get(w) || 0);
      const s = skuSet.get(w)?.size || 0;

      return {
        wh: w,
        StockLevel: clamp((q / qtyMax) * 100, 0, 100),
        Variety: clamp((s / skuMax) * 100, 0, 100),
        LowStockSafety: clamp((1 - l / lowMax) * 100, 0, 100),
        Freshness: clamp((1 - a / ageMax) * 100, 0, 100),
      };
    });
  }, []);

  const PIE_COLORS = ["#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#0ea5e9"];

  return (
    <div className="min-h-screen w-full bg-white p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
            <FaWarehouse /> Warehouse Wise Stock — Reports
          </h1>

          <div className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 bg-slate-50">
            <FaWarehouse className="text-slate-600" />
            <select
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              className="bg-transparent text-slate-900 font-bold outline-none"
            >
              {WAREHOUSES.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Kpi label="Total Qty" value={num(kpis.totalQty)} icon={<FaBoxes />} />
          <Kpi label="Unique SKUs" value={num(kpis.skuCount)} icon={<FaChartBar />} />
          <Kpi label="Low Stock Lines" value={num(kpis.lowCount)} icon={<FaChartLine />} />
          <Kpi label="Avg Age (days)" value={num(Math.round(kpis.avgAge))} icon={<FaChartLine />} />
        </div>

        {/* 10 Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* 1 */}
          <ChartBox title="Total Qty Over Time (Gradient Area)">
            <AreaChart data={qtyByDate}>
              <defs>
                <linearGradient id="qtyDateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dt" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="qty" name="Qty" stroke="#0284c7" strokeWidth={2} fill="url(#qtyDateGrad)" />
            </AreaChart>
          </ChartBox>

          {/* 2 */}
          <ChartBox title="Total Qty by Warehouse (Gradient Bars)">
            <BarChart data={qtyByWarehouse}>
              <defs>
                <linearGradient id="qtyWhGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="wh" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="qty" name="Qty" fill="url(#qtyWhGrad)" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ChartBox>

          {/* 3 */}
          <ChartBox title="Unique SKU Count by Warehouse">
            <BarChart data={skuCountByWh}>
              <defs>
                <linearGradient id="skuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="wh" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="skus" name="SKUs" fill="url(#skuGrad)" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ChartBox>

          {/* 4 */}
          <ChartBox title="Top 10 SKUs by Qty (Selected Warehouse)">
            <BarChart data={topSkuQty}>
              <defs>
                <linearGradient id="topSkuQtyGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.75} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sku" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="qty" name="Qty" fill="url(#topSkuQtyGrad)" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ChartBox>

          {/* 5 */}
          <ChartBox title="Low Stock Lines by Warehouse (Pie)">
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie
                data={lowStockByWh.map((x) => ({ name: x.wh, value: x.low }))}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={2}
              >
                {lowStockByWh.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartBox>

          {/* 6 */}
          <ChartBox title="Aging Buckets (Count)">
            <BarChart data={agingBuckets}>
              <defs>
                <linearGradient id="ageGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.12} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Count" fill="url(#ageGrad)" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ChartBox>

          {/* 7 */}
          <ChartBox title="Expiry Risk Buckets (Count)">
            <BarChart data={expiryBuckets}>
              <defs>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.12} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Count" fill="url(#expGrad)" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ChartBox>

          {/* 8 */}
          <ChartBox title="Qty vs Aging Days (Scatter)">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" name="Qty" />
              <YAxis dataKey="y" name="Age (days)" />
              <Tooltip />
              <Legend />
              <Scatter name="Stock Lines" data={scatterQtyAge} fill="#0ea5e9" />
            </ScatterChart>
          </ChartBox>

          {/* 9 */}
          <ChartBox title="Qty vs Reorder Level (Line Compare)">
            <LineChart data={ropVsQty}>
              <defs>
                <linearGradient id="qtyGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.95} />
                </linearGradient>
                <linearGradient id="ropGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.85} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sku" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="qty" name="Qty" stroke="url(#qtyGrad)" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="rop" name="Reorder Level" stroke="url(#ropGrad)" strokeWidth={3} dot={false} />
            </LineChart>
          </ChartBox>

          {/* 10 */}
          <ChartBox title="Warehouse Health Score (Radar)">
            <RadarChart data={whHealthRadar}>
              <PolarGrid />
              <PolarAngleAxis dataKey="wh" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Radar dataKey="StockLevel" name="StockLevel" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.12} />
              <Radar dataKey="Variety" name="Variety" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.12} />
              <Radar dataKey="LowStockSafety" name="LowStockSafety" stroke="#22c55e" fill="#22c55e" fillOpacity={0.12} />
              <Radar dataKey="Freshness" name="Freshness" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} />
            </RadarChart>
          </ChartBox>
        </div>

        <div className="mt-5 text-xs text-slate-500 font-semibold">
        </div>
      </div>
    </div>
  );
}

/* ===================== UI bits ===================== */
function ChartBox({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="text-sm font-extrabold text-slate-700 mb-3">{title}</div>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wide flex items-center gap-2">
        <span className="text-slate-500">{icon}</span> {label}
      </div>
      <div className="mt-1 text-lg font-black text-slate-900">{value}</div>
    </div>
  );
}
