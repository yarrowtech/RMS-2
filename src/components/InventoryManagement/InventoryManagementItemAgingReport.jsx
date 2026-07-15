import React, { useMemo, useState } from "react";
import { FaClock, FaWarehouse } from "react-icons/fa";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
} from "recharts";

/* ---------------- helpers ---------------- */
const num = (n) => new Intl.NumberFormat("en-IN").format(Number(n || 0));
const moneyINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    Number(n || 0)
  );

function bandFromDays(days) {
  if (days <= 30) return "Fast (0–30)";
  if (days <= 90) return "Normal (31–90)";
  if (days <= 150) return "Slow (91–150)";
  return "Dead (>150)";
}

function bucketAging(days) {
  // 0-30, 31-60, 61-90, 91-120, 121-150, 151+
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  if (days <= 120) return "91-120";
  if (days <= 150) return "121-150";
  return "151+";
}

export default function ItemAgingChartOnly() {
  const WAREHOUSES = useMemo(
    () => ["All",  "Main - New Market", "Store - Chowringhee", "Store - Hatibagan"],
    []
  );
  const [warehouse, setWarehouse] = useState("All");

  // ✅ dummy aging lines (replace with real later)
  const raw = useMemo(
    () => [
      { wh: "Main Warehouse", sku: "ACC-ST-001", item: "Soft Teddy Bear (Medium)", qty: 106, avgCost: 180, agingDays: 65 },
      { wh: "Store - New Market", sku: "ACC-ST-001", item: "Soft Teddy Bear (Medium)", qty: 106, avgCost: 180, agingDays: 65 },
      { wh: "Main Warehouse", sku: "HPC-HR-055", item: "Herbal Shampoo 180ml", qty: 146, avgCost: 120, agingDays: 22 },
      { wh: "Main Warehouse", sku: "HHA-UT-099", item: "Steel Kadai 2L", qty: 10, avgCost: 520, agingDays: 160 },
      { wh: "Store - City Center", sku: "KID-B-TS-032", item: "Kids T-Shirt (Blue)", qty: 25, avgCost: 240, agingDays: 18 },
      { wh: "Store - Chowringhee", sku: "FMCG-FO-021", item: "Rice 10kg", qty: 120, avgCost: 410, agingDays: 92 },
      { wh: "Store - Hatibagan", sku: "ELEC-LB-009", item: "LED Bulb 9W", qty: 300, avgCost: 55, agingDays: 44 },
      { wh: "Main Warehouse", sku: "LEA-WL-004", item: "Leather Wallet", qty: 40, avgCost: 260, agingDays: 128 },
      { wh: "Store - Chowringhee", sku: "WIN-JK-110", item: "Winter Jacket", qty: 28, avgCost: 980, agingDays: 175 },
      { wh: "Store - Hatibagan", sku: "HPC-SO-014", item: "Body Soap Pack", qty: 210, avgCost: 38, agingDays: 33 },
      { wh: "Main Warehouse", sku: "ACC-JW-007", item: "Jewellery Set", qty: 18, avgCost: 1450, agingDays: 205 },
      { wh: "Store - New Market", sku: "TOY-CAR-002", item: "Toy Car", qty: 65, avgCost: 220, agingDays: 74 },
      { wh: "Store - Hatibagan", sku: "FMCG-HP-090", item: "Detergent Powder 1kg", qty: 260, avgCost: 68, agingDays: 41 },
      { wh: "Store - City Center", sku: "KID-SH-010", item: "Kids Shoes", qty: 34, avgCost: 720, agingDays: 113 },
    ],
    []
  );

  const rows = useMemo(() => {
    return raw
      .filter((r) => (warehouse === "All" ? true : r.wh === warehouse))
      .map((r) => {
        const value = Number((r.qty * r.avgCost).toFixed(2));
        const band = bandFromDays(Number(r.agingDays || 0));
        const bucket = bucketAging(Number(r.agingDays || 0));
        return { ...r, value, band, bucket };
      });
  }, [raw, warehouse]);

  /* ---------------- datasets (previous + new) ---------------- */

  // 1) Pie: value by band
  const valueByBand = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.band, (m.get(r.band) || 0) + r.value));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [rows]);

  // 2) Count by band
  const countByBand = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.band, (m.get(r.band) || 0) + 1));
    return Array.from(m.entries()).map(([band, count]) => ({ band, count }));
  }, [rows]);

  // 3) Qty by band
  const qtyByBand = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.band, (m.get(r.band) || 0) + r.qty));
    return Array.from(m.entries()).map(([band, qty]) => ({ band, qty }));
  }, [rows]);

  // 4) Value by warehouse
  const valueByWarehouse = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.wh, (m.get(r.wh) || 0) + r.value));
    return Array.from(m.entries()).map(([wh, value]) => ({ wh, value }));
  }, [rows]);

  // 5) Avg aging by warehouse
  const avgAgingByWarehouse = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const cur = m.get(r.wh) || { wh: r.wh, days: 0, n: 0 };
      cur.days += r.agingDays;
      cur.n += 1;
      m.set(r.wh, cur);
    });
    return Array.from(m.values()).map((x) => ({ wh: x.wh, avgDays: Number((x.days / x.n).toFixed(1)) }));
  }, [rows]);

  // 6) Scatter: aging vs value
  const scatterAgingValue = useMemo(() => {
    return rows.map((r) => ({ x: r.agingDays, y: r.value, sku: r.sku }));
  }, [rows]);

  // 7) Top aged items
  const topAged = useMemo(() => {
    return [...rows]
      .sort((a, b) => b.agingDays - a.agingDays)
      .slice(0, 8)
      .map((r) => ({ label: r.sku, agingDays: r.agingDays }));
  }, [rows]);

  // 8) Aging vs qty (line sorted)
  const agingVsQty = useMemo(() => {
    return [...rows]
      .sort((a, b) => a.agingDays - b.agingDays)
      .map((r) => ({ agingDays: r.agingDays, qty: r.qty, sku: r.sku }));
  }, [rows]);

  // 9) Top value items (₹)
  const topValueItems = useMemo(() => {
    return [...rows]
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((r) => ({ sku: r.sku, value: r.value }));
  }, [rows]);

  // 10) Scatter: qty vs value
  const scatterQtyValue = useMemo(() => {
    return rows.map((r) => ({ x: r.qty, y: r.value, sku: r.sku }));
  }, [rows]);

  // 11) Avg cost by band
  const avgCostByBand = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const cur = m.get(r.band) || { band: r.band, cost: 0, n: 0 };
      cur.cost += r.avgCost;
      cur.n += 1;
      m.set(r.band, cur);
    });
    return Array.from(m.values()).map((x) => ({ band: x.band, avgCost: Number((x.cost / x.n).toFixed(1)) }));
  }, [rows]);

  // 12) Warehouse-wise item count
  const countByWarehouse = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.wh, (m.get(r.wh) || 0) + 1));
    return Array.from(m.entries()).map(([wh, count]) => ({ wh, count }));
  }, [rows]);

  // 13) SKU-wise aging days (line)
  const skuAgingLine = useMemo(() => {
    return [...rows]
      .sort((a, b) => b.agingDays - a.agingDays)
      .slice(0, 12)
      .map((r) => ({ sku: r.sku, agingDays: r.agingDays }));
  }, [rows]);

  // 14) Bucketed aging trend value
  const valueByBucket = useMemo(() => {
    const order = ["0-30", "31-60", "61-90", "91-120", "121-150", "151+"];
    const m = new Map();
    rows.forEach((r) => m.set(r.bucket, (m.get(r.bucket) || 0) + r.value));
    return order.map((b) => ({ bucket: b, value: m.get(b) || 0 }));
  }, [rows]);

  const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

  return (
    <div className="min-h-screen w-full bg-white p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
            <FaClock /> Item Aging — Reports
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* 1 */}
          <ChartBox title="Value Share by Aging Band (Pie)">
            <PieChart>
              <Tooltip formatter={(v) => moneyINR(v)} />
              <Legend />
              <Pie data={valueByBand} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2}>
                {valueByBand.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartBox>

          {/* 2 */}
          <ChartBox title="Item Count by Aging Band">
            <BarChart data={countByBand}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="band" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Items" fill="#0ea5e9" />
            </BarChart>
          </ChartBox>

          {/* 3 */}
          <ChartBox title="Total Qty by Aging Band">
            <BarChart data={qtyByBand}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="band" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="qty" name="Qty" fill="#22c55e" />
            </BarChart>
          </ChartBox>

          {/* 4 */}
          <ChartBox title="Total Stock Value by Warehouse">
            <BarChart data={valueByWarehouse}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="wh" hide />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => moneyINR(v)} />
              <Legend />
              <Bar dataKey="value" name="Value" fill="#6366f1" />
            </BarChart>
          </ChartBox>

          {/* 5 */}
          <ChartBox title="Avg Aging Days by Warehouse">
            <BarChart data={avgAgingByWarehouse}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="wh" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="avgDays" name="Avg Aging Days" fill="#f59e0b" />
            </BarChart>
          </ChartBox>

          {/* 6 */}
          <ChartBox title="Aging Days vs Stock Value (Scatter)">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" name="Aging Days" />
              <YAxis dataKey="y" name="Value" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v, name) => (name === "y" ? moneyINR(v) : v)} />
              <Legend />
              <Scatter name="SKU Points" data={scatterAgingValue} fill="#111827" />
            </ScatterChart>
          </ChartBox>

          {/* 7 */}
          <ChartBox title="Top 8 Aged Items (Aging Days)">
            <BarChart data={topAged}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="agingDays" name="Aging Days" fill="#ef4444" />
            </BarChart>
          </ChartBox>

          {/* 8 */}
          <ChartBox title="Qty vs Aging (Sorted by Aging Days)">
            <LineChart data={agingVsQty}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="agingDays" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="qty" name="Qty" stroke="#0ea5e9" strokeWidth={3} dot={false} />
            </LineChart>
          </ChartBox>

          {/* 9 NEW */}
          <ChartBox title="Top 10 High Value Items (₹)">
            <BarChart data={topValueItems}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sku" />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => moneyINR(v)} />
              <Legend />
              <Bar dataKey="value" name="Value" fill="#111827" />
            </BarChart>
          </ChartBox>

          {/* 10 NEW */}
          <ChartBox title="Qty vs Value (Scatter)">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" name="Qty" />
              <YAxis dataKey="y" name="Value" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v, name) => (name === "y" ? moneyINR(v) : v)} />
              <Legend />
              <Scatter name="SKU Points" data={scatterQtyValue} fill="#0ea5e9" />
            </ScatterChart>
          </ChartBox>

          {/* 11 NEW */}
          <ChartBox title="Avg Cost by Aging Band">
            <BarChart data={avgCostByBand}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="band" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="avgCost" name="Avg Cost" fill="#22c55e" />
            </BarChart>
          </ChartBox>

          {/* 12 NEW */}
          <ChartBox title="Item Count by Warehouse">
            <BarChart data={countByWarehouse}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="wh" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Items" fill="#f59e0b" />
            </BarChart>
          </ChartBox>

          {/* 13 NEW */}
          <ChartBox title="SKU-wise Aging Days (Top 12)">
            <LineChart data={skuAgingLine}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sku" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="agingDays" name="Aging Days" stroke="#ef4444" strokeWidth={3} dot={false} />
            </LineChart>
          </ChartBox>

          {/* 14 NEW */}
          <ChartBox title="Aging Bucket Trend (Value by Aging Range)">
            <LineChart data={valueByBucket}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => moneyINR(v)} />
              <Legend />
              <Line dataKey="value" name="Value" stroke="#6366f1" strokeWidth={3} dot />
            </LineChart>
          </ChartBox>
        </div>

        <div className="mt-5 text-xs text-slate-500 font-semibold">
        </div>
      </div>
    </div>
  );
}

/* ---------------- small reusable box ---------------- */
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
