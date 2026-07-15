import React, { useMemo, useState } from "react";
import { FaChartPie, FaWarehouse, FaRupeeSign } from "react-icons/fa";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ScatterChart,
  Scatter,
} from "recharts";

/* ===================== helpers ===================== */
const num = (n) => new Intl.NumberFormat("en-IN").format(Number(n || 0));
const inr = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    Number(n || 0)
  );

/* ===================== DUMMY STOCK VALUATION LINES (replace with real) ===================== */
const STOCK_LINES = [
  { dt: "2026-01-01", wh: "Main - New Market", sku: "ACC-ST-001", item: "Soft Teddy Bear (Medium)", qty: 106, avgCost: 180 },
  { dt: "2026-01-01", wh: "Store - Chowringhee", sku: "KID-B-TS-032", item: "Kids T-Shirt (Blue)", qty: 25, avgCost: 240 },
  { dt: "2026-01-01", wh: "Store - Hatibagan", sku: "HPC-HR-055", item: "Herbal Shampoo 180ml", qty: 146, avgCost: 120 },

  { dt: "2026-01-05", wh: "Main - New Market", sku: "ACC-ST-001", item: "Soft Teddy Bear (Medium)", qty: 102, avgCost: 180 },
  { dt: "2026-01-05", wh: "Store - Chowringhee", sku: "KID-B-TS-032", item: "Kids T-Shirt (Blue)", qty: 29, avgCost: 240 },
  { dt: "2026-01-05", wh: "Store - Hatibagan", sku: "HPC-HR-055", item: "Herbal Shampoo 180ml", qty: 148, avgCost: 120 },

  { dt: "2026-01-10", wh: "Main - New Market", sku: "ACC-ST-001", item: "Soft Teddy Bear (Medium)", qty: 120, avgCost: 180 },
  { dt: "2026-01-10", wh: "Store - Chowringhee", sku: "KID-B-TS-032", item: "Kids T-Shirt (Blue)", qty: 21, avgCost: 240 },
  { dt: "2026-01-10", wh: "Store - Hatibagan", sku: "HPC-HR-055", item: "Herbal Shampoo 180ml", qty: 140, avgCost: 120 },

  { dt: "2026-01-15", wh: "Main - New Market", sku: "HHA-UT-099", item: "Steel Kadai 2L", qty: 10, avgCost: 520 },
  { dt: "2026-01-15", wh: "Store - Chowringhee", sku: "WIN-JK-110", item: "Winter Jacket", qty: 28, avgCost: 980 },
  { dt: "2026-01-15", wh: "Store - Hatibagan", sku: "ELEC-LB-009", item: "LED Bulb 9W", qty: 300, avgCost: 55 },

  // extra lines
  { dt: "2026-01-15", wh: "Main - New Market", sku: "ACC-JW-007", item: "Jewellery Set", qty: 18, avgCost: 1450 },
  { dt: "2026-01-10", wh: "Store - Hatibagan", sku: "FMCG-HP-090", item: "Detergent Powder 1kg", qty: 260, avgCost: 68 },
  { dt: "2026-01-05", wh: "Store - Chowringhee", sku: "FMCG-FO-021", item: "Rice 10kg", qty: 120, avgCost: 410 },
];

/* ===================== component ===================== */
export default function StockValuationGradientReport() {
  const WAREHOUSES = useMemo(
    () => ["All", "Main - New Market", "Store - Chowringhee", "Store - Hatibagan"],
    []
  );

  const [warehouse, setWarehouse] = useState("All");

  const rows = useMemo(() => {
    return STOCK_LINES
      .filter((r) => (warehouse === "All" ? true : r.wh === warehouse))
      .map((r) => ({ ...r, value: Number(r.qty) * Number(r.avgCost) }));
  }, [warehouse]);

  /* ---------- KPI ---------- */
  const kpis = useMemo(() => {
    const totalQty = rows.reduce((s, r) => s + Number(r.qty || 0), 0);
    const totalValue = rows.reduce((s, r) => s + Number(r.value || 0), 0);
    const avgCost = totalQty ? totalValue / totalQty : 0;
    const skuCount = new Set(rows.map((r) => r.sku)).size;
    return { totalQty, totalValue, avgCost, skuCount };
  }, [rows]);

  /* ---------- datasets ---------- */
  const valuationByDate = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const cur = m.get(r.dt) || { dt: r.dt, value: 0, qty: 0 };
      cur.value += r.value;
      cur.qty += r.qty;
      m.set(r.dt, cur);
    });
    return Array.from(m.values()).sort((a, b) => a.dt.localeCompare(b.dt));
  }, [rows]);

  const valuationByWarehouse = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.wh, (m.get(r.wh) || 0) + r.value));
    return Array.from(m.entries()).map(([wh, value]) => ({ wh, value }));
  }, [rows]);

  const topSkuByValue = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const cur = m.get(r.sku) || { sku: r.sku, item: r.item, value: 0, qty: 0, avgCost: 0 };
      cur.value += r.value;
      cur.qty += r.qty;
      m.set(r.sku, cur);
    });
    const list = Array.from(m.values()).map((x) => ({ ...x, avgCost: x.qty ? x.value / x.qty : 0 }));
    return list.sort((a, b) => b.value - a.value).slice(0, 10);
  }, [rows]);

  const pieWarehouse = useMemo(() => {
    const list = valuationByWarehouse.map((x) => ({ name: x.wh, value: x.value }));
    return list.sort((a, b) => b.value - a.value);
  }, [valuationByWarehouse]);

  const avgCostByDate = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const cur = m.get(r.dt) || { dt: r.dt, value: 0, qty: 0 };
      cur.value += r.value;
      cur.qty += r.qty;
      m.set(r.dt, cur);
    });
    return Array.from(m.values())
      .sort((a, b) => a.dt.localeCompare(b.dt))
      .map((x) => ({ dt: x.dt, avgCost: x.qty ? x.value / x.qty : 0 }));
  }, [rows]);

  const costBuckets = useMemo(() => {
    const buckets = [
      { bucket: "0-99", min: 0, max: 99, value: 0 },
      { bucket: "100-299", min: 100, max: 299, value: 0 },
      { bucket: "300-599", min: 300, max: 599, value: 0 },
      { bucket: "600-999", min: 600, max: 999, value: 0 },
      { bucket: "1000+", min: 1000, max: Infinity, value: 0 },
    ];
    rows.forEach((r) => {
      const c = r.avgCost;
      const b = buckets.find((x) => c >= x.min && c <= x.max);
      if (b) b.value += r.value;
    });
    return buckets;
  }, [rows]);

  const itemCountByWh = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.wh, (m.get(r.wh) || new Set()).add(r.sku)));
    return Array.from(m.entries()).map(([wh, set]) => ({ wh, items: set.size }));
  }, [rows]);

  const scatterQtyValue = useMemo(() => {
    return rows.map((r) => ({ x: r.qty, y: r.value, sku: r.sku }));
  }, [rows]);

  const scatterCostValue = useMemo(() => {
    return rows.map((r) => ({ x: r.avgCost, y: r.value, sku: r.sku }));
  }, [rows]);

  const qtyByWarehouse = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.wh, (m.get(r.wh) || 0) + r.qty));
    return Array.from(m.entries()).map(([wh, qty]) => ({ wh, qty }));
  }, [rows]);

  const qtyByDate = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.dt, (m.get(r.dt) || 0) + r.qty));
    return Array.from(m.entries())
      .map(([dt, qty]) => ({ dt, qty }))
      .sort((a, b) => a.dt.localeCompare(b.dt));
  }, [rows]);

  const PIE_COLORS = ["#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#0ea5e9"];

  return (
    <div className="min-h-screen w-full bg-white p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
            <FaChartPie /> Stock Valuation Report
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

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiLight label="Total Value" value={inr(kpis.totalValue)} />
          <KpiLight label="Total Qty" value={num(kpis.totalQty)} />
          <KpiLight label="Avg Cost" value={inr(kpis.avgCost)} />
          <KpiLight label="Unique SKUs" value={num(kpis.skuCount)} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ChartLight title="Total Stock Value Over Time (Gradient Area)">
            <AreaChart data={valuationByDate}>
              <defs>
                <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                  <stop offset="60%" stopColor="#0ea5e9" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dt" />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => inr(v)} />
              <Legend />
              <Area type="monotone" dataKey="value" name="Value" stroke="#7c3aed" strokeWidth={2} fill="url(#valGrad)" />
            </AreaChart>
          </ChartLight>

          <ChartLight title="Warehouse-wise Total Value (Gradient Bars)">
            <BarChart data={valuationByWarehouse}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="wh" hide />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => inr(v)} />
              <Legend />
              <Bar dataKey="value" name="Value" fill="url(#barGrad)" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ChartLight>

          <ChartLight title="Top SKUs by Value (Gradient Bars)">
            <BarChart data={topSkuByValue}>
              <defs>
                <linearGradient id="topSkuGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.75} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sku" />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => inr(v)} />
              <Legend />
              <Bar dataKey="value" name="Value" fill="url(#topSkuGrad)" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ChartLight>

          <ChartLight title="Value by Avg Cost Bucket (Gradient Area)">
            <AreaChart data={costBuckets}>
              <defs>
                <linearGradient id="bucketGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => inr(v)} />
              <Legend />
              <Area type="monotone" dataKey="value" name="Value" stroke="#0891b2" strokeWidth={2} fill="url(#bucketGrad)" />
            </AreaChart>
          </ChartLight>

          <ChartLight title="Value Share by Warehouse (Pie)">
            <PieChart>
              <Tooltip formatter={(v) => inr(v)} />
              <Legend />
              <Pie data={pieWarehouse} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2}>
                {pieWarehouse.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartLight>

          <ChartLight title="Avg Cost Over Time (Gradient Line)">
            <LineChart data={avgCostByDate}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.95} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dt" />
              <YAxis />
              <Tooltip formatter={(v) => inr(v)} />
              <Legend />
              <Line type="monotone" dataKey="avgCost" name="Avg Cost" stroke="url(#lineGrad)" strokeWidth={3} dot={false} />
            </LineChart>
          </ChartLight>

          {/* 7 NEW */}
          <ChartLight title="Unique SKU Count by Warehouse">
            <BarChart data={itemCountByWh}>
              <defs>
                <linearGradient id="countGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="wh" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="items" name="Unique SKUs" fill="url(#countGrad)" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ChartLight>

          {/* 8 NEW */}
          <ChartLight title="Total Qty by Warehouse (Gradient Bars)">
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
          </ChartLight>

          {/* 9 NEW */}
          <ChartLight title="Total Qty Over Time (Gradient Area)">
            <AreaChart data={qtyByDate}>
              <defs>
                <linearGradient id="qtyDateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dt" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="qty" name="Qty" stroke="#d97706" strokeWidth={2} fill="url(#qtyDateGrad)" />
            </AreaChart>
          </ChartLight>

          {/* 10 NEW */}
          <ChartLight title=" Qty vs Value (Scatter)">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" name="Qty" />
              <YAxis dataKey="y" name="Value" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v, name) => (name === "y" ? inr(v) : v)} />
              <Legend />
              <Scatter name="SKU Points" data={scatterQtyValue} fill="#0ea5e9" />
            </ScatterChart>
          </ChartLight>

          {/* 11 NEW */}
          <ChartLight title="Avg Cost vs Value (Scatter)">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" name="Avg Cost" />
              <YAxis dataKey="y" name="Value" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v, name) => (name === "y" ? inr(v) : v)} />
              <Legend />
              <Scatter name="SKU Points" data={scatterCostValue} fill="#8b5cf6" />
            </ScatterChart>
          </ChartLight>

          {/* 12 NEW */}
          <ChartLight title="Value vs Qty (Dual Line, Over Time)">
            <LineChart data={valuationByDate.map((d, i) => ({ ...d, qty: qtyByDate[i]?.qty || 0 }))}>
              <defs>
                <linearGradient id="dual1" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.95} />
                </linearGradient>
                <linearGradient id="dual2" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.95} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dt" />
              <YAxis yAxisId="left" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="value" name="Value" stroke="url(#dual1)" strokeWidth={3} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="qty" name="Qty" stroke="url(#dual2)" strokeWidth={3} dot={false} />
            </LineChart>
          </ChartLight>
        </div>

        <div className="mt-5 text-xs text-slate-500 font-semibold">
        </div>
      </div>
    </div>
  );
}

/* ===================== light ui bits ===================== */
function ChartLight({ title, children }) {
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

function KpiLight({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wide flex items-center gap-2">
        <FaRupeeSign className="opacity-60" /> {label}
      </div>
      <div className="mt-1 text-lg font-black text-slate-900">{value}</div>
    </div>
  );
}
