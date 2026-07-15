import React, { useMemo, useState } from "react";
import { FaChartLine, FaWarehouse } from "react-icons/fa";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/* ------------------ helpers ------------------ */
const num = (n) => new Intl.NumberFormat("en-IN").format(Number(n || 0));
const parseDay = (dt) => String(dt || "").split(" ")[0] || "";
const parseTime = (dt) => (String(dt || "").split(" ")[1] || "").slice(0, 5); // HH:mm
const parseHour = (dt) => (parseTime(dt).split(":")[0] || "00").padStart(2, "0");
const sum = (arr, k) => arr.reduce((s, x) => s + Number(x[k] || 0), 0);

/* ------------------ YOUR REAL DATA ------------------ */
/* ✅ IMPORTANT: wh values MUST match the dropdown options exactly */
const TX = [
  {
    dt: "2026-01-02 10:12",
    type: "GRN (Purchase In)",
    ref: "GRN-000231",
    barcode: "8901234000001",
    sku: "ACC-ST-001",
    item: "Soft Teddy Bear (Medium)",
    inQty: 120,
    outQty: 0,
    balance: 120,
    wh: "Main - New Market",
    party: "Vendor: ABC Traders",
    remarks: "Fresh stock received",
  },
  {
    dt: "2026-01-04 15:44",
    type: "Sales (Out)",
    ref: "INV-009884",
    barcode: "8901234000001",
    sku: "ACC-ST-001",
    item: "Soft Teddy Bear (Medium)",
    inQty: 0,
    outQty: 14,
    balance: 106,
    wh: "Main - New Market",
    party: "Invoice: POS-NEW-123",
    remarks: "Retail sales",
  },
  {
    dt: "2026-01-06 11:02",
    type: "Transfer (In/Out)",
    ref: "TRF-001102",
    barcode: "8901234000006",
    sku: "KID-B-TS-032",
    item: "Kids T-Shirt (Blue)",
    inQty: 25,
    outQty: 0,
    balance: 25,
    wh: "Store - Chowringhee",
    party: "From: Main - New Market",
    remarks: "Store replenishment",
  },
  {
    dt: "2026-01-07 09:30",
    type: "Adjustment",
    ref: "ADJ-000078",
    barcode: "8901234000005",
    sku: "HHA-UT-099",
    item: "Steel Kadai 2L",
    inQty: 0,
    outQty: 2,
    balance: 10,
    wh: "Main - New Market",
    party: "Cycle count",
    remarks: "Damage found in audit",
  },
  {
    dt: "2026-01-08 17:22",
    type: "Return (In)",
    ref: "RET-000114",
    barcode: "8901234000004",
    sku: "HPC-HR-055",
    item: "Herbal Shampoo 180ml",
    inQty: 6,
    outQty: 0,
    balance: 146,
    wh: "Store - Hatibagan",
    party: "Customer return",
    remarks: "Unopened, restocked",
  },
];

export default function DailyStockMovementChartOnly() {
  /* ✅ FIXED warehouse options exactly as your system screenshot */
  const WAREHOUSES = useMemo(
    () => ["All", "Main - New Market", "Store - Chowringhee", "Store - Hatibagan"],
    []
  );

  const SKU_LIST = useMemo(() => {
    const set = new Set(TX.map((t) => t.sku));
    return Array.from(set);
  }, []);

  const [warehouse, setWarehouse] = useState("All");
  const [skuFocus, setSkuFocus] = useState(SKU_LIST[0] || "");

  const filtered = useMemo(() => {
    return TX.filter((t) => (warehouse === "All" ? true : t.wh === warehouse));
  }, [warehouse]);

  /* ------------------ dataset 1: day-wise ------------------ */
  const byDay = useMemo(() => {
    const m = new Map();
    filtered.forEach((t) => {
      const day = parseDay(t.dt);
      const cur = m.get(day) || { day, inQty: 0, outQty: 0, tx: 0 };
      cur.inQty += Number(t.inQty || 0);
      cur.outQty += Number(t.outQty || 0);
      cur.tx += 1;
      m.set(day, cur);
    });
    return Array.from(m.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((r) => ({ ...r, netQty: r.inQty - r.outQty }));
  }, [filtered]);

  /* ------------------ dataset 2: running net ------------------ */
  const running = useMemo(() => {
    let cum = 0;
    return byDay.map((d) => {
      cum += d.netQty;
      return { ...d, cumNet: cum };
    });
  }, [byDay]);

  /* ------------------ dataset 3: type-wise ------------------ */
  const byType = useMemo(() => {
    const m = new Map();
    filtered.forEach((t) => {
      const k = t.type;
      const cur = m.get(k) || { type: k, inQty: 0, outQty: 0, tx: 0 };
      cur.inQty += Number(t.inQty || 0);
      cur.outQty += Number(t.outQty || 0);
      cur.tx += 1;
      m.set(k, cur);
    });
    return Array.from(m.values())
      .map((r) => ({ ...r, netQty: r.inQty - r.outQty }))
      .sort((a, b) => b.tx - a.tx);
  }, [filtered]);

  /* ------------------ dataset 4: SKU-wise ------------------ */
  const bySku = useMemo(() => {
    const m = new Map();
    filtered.forEach((t) => {
      const k = t.sku;
      const cur = m.get(k) || { sku: k, item: t.item, inQty: 0, outQty: 0, tx: 0 };
      cur.inQty += Number(t.inQty || 0);
      cur.outQty += Number(t.outQty || 0);
      cur.tx += 1;
      m.set(k, cur);
    });
    return Array.from(m.values())
      .map((r) => ({ ...r, netQty: r.inQty - r.outQty }))
      .sort((a, b) => Math.abs(b.netQty) - Math.abs(a.netQty))
      .slice(0, 10);
  }, [filtered]);

  /* ------------------ dataset 5: warehouse-wise (overall, All) ------------------ */
  const byWarehouse = useMemo(() => {
    const m = new Map();
    TX.forEach((t) => {
      const k = t.wh;
      const cur = m.get(k) || { wh: k, inQty: 0, outQty: 0, tx: 0 };
      cur.inQty += Number(t.inQty || 0);
      cur.outQty += Number(t.outQty || 0);
      cur.tx += 1;
      m.set(k, cur);
    });
    return Array.from(m.values()).map((r) => ({ ...r, netQty: r.inQty - r.outQty }));
  }, []);

  /* ------------------ dataset 6: hourly tx count ------------------ */
  const hourlyTx = useMemo(() => {
    const m = new Map();
    filtered.forEach((t) => {
      const h = `${parseHour(t.dt)}:00`;
      const cur = m.get(h) || { hour: h, tx: 0 };
      cur.tx += 1;
      m.set(h, cur);
    });
    return Array.from(m.values()).sort((a, b) => a.hour.localeCompare(b.hour));
  }, [filtered]);

  /* ------------------ dataset 7: hourly in/out qty ------------------ */
  const hourlyQty = useMemo(() => {
    const m = new Map();
    filtered.forEach((t) => {
      const h = `${parseHour(t.dt)}:00`;
      const cur = m.get(h) || { hour: h, inQty: 0, outQty: 0 };
      cur.inQty += Number(t.inQty || 0);
      cur.outQty += Number(t.outQty || 0);
      m.set(h, cur);
    });
    return Array.from(m.values())
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .map((r) => ({ ...r, netQty: r.inQty - r.outQty }));
  }, [filtered]);

  /* ------------------ dataset 8: barcode-wise net qty ------------------ */
  const byBarcode = useMemo(() => {
    const m = new Map();
    filtered.forEach((t) => {
      const k = t.barcode;
      const cur = m.get(k) || { barcode: k, inQty: 0, outQty: 0, tx: 0 };
      cur.inQty += Number(t.inQty || 0);
      cur.outQty += Number(t.outQty || 0);
      cur.tx += 1;
      m.set(k, cur);
    });
    return Array.from(m.values())
      .map((r) => ({ ...r, netQty: r.inQty - r.outQty }))
      .sort((a, b) => Math.abs(b.netQty) - Math.abs(a.netQty))
      .slice(0, 10);
  }, [filtered]);

  /* ------------------ dataset 9: latest balance by SKU ------------------ */
  const latestBalanceBySku = useMemo(() => {
    const m = new Map();
    [...filtered]
      .sort((a, b) => a.dt.localeCompare(b.dt))
      .forEach((t) => {
        m.set(t.sku, { sku: t.sku, item: t.item, balance: Number(t.balance || 0), lastDt: t.dt });
      });
    return Array.from(m.values()).sort((a, b) => b.balance - a.balance);
  }, [filtered]);

  /* ------------------ dataset 10: balance trend for selected SKU ------------------ */
  const balanceTrend = useMemo(() => {
    return filtered
      .filter((t) => t.sku === skuFocus)
      .sort((a, b) => a.dt.localeCompare(b.dt))
      .map((t) => ({
        dt: t.dt,
        day: parseDay(t.dt),
        time: parseTime(t.dt),
        balance: Number(t.balance || 0),
        inQty: Number(t.inQty || 0),
        outQty: Number(t.outQty || 0),
      }));
  }, [filtered, skuFocus]);

  /* ------------------ dataset 11: warehouse x day multi-line ------------------ */
  const whByDayLines = useMemo(() => {
    const days = Array.from(new Set(TX.map((t) => parseDay(t.dt)))).sort();
    const whs = Array.from(new Set(TX.map((t) => t.wh))).sort();

    const m = new Map();
    days.forEach((d) => m.set(d, { day: d }));

    TX.forEach((t) => {
      const d = parseDay(t.dt);
      const row = m.get(d) || { day: d };
      const key = t.wh;
      row[key] = (row[key] || 0) + (Number(t.inQty || 0) - Number(t.outQty || 0));
      m.set(d, row);
    });

    const rows = Array.from(m.values()).sort((a, b) => a.day.localeCompare(b.day));
    return { rows, whs };
  }, []);

  /* ------------------ KPIs ------------------ */
  const kpis = useMemo(() => {
    return {
      tx: filtered.length,
      inQty: sum(filtered, "inQty"),
      outQty: sum(filtered, "outQty"),
      net: sum(filtered, "inQty") - sum(filtered, "outQty"),
    };
  }, [filtered]);

  const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

  return (
    <div className="min-h-screen w-full bg-white p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
            <FaChartLine /> Daily Stock Movement — Reports
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
          <Kpi label="Transactions" value={num(kpis.tx)} />
          <Kpi label="Total In Qty" value={num(kpis.inQty)} />
          <Kpi label="Total Out Qty" value={num(kpis.outQty)} />
          <Kpi label="Net Qty" value={num(kpis.net)} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ChartBox title="Date-wise Qty Trend (In / Out / Net)">
            <LineChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="inQty" name="In Qty" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line dataKey="outQty" name="Out Qty" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line dataKey="netQty" name="Net Qty" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartBox>

          <ChartBox title="Date-wise In vs Out (Bar)">
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="inQty" name="In Qty" fill="#22c55e" />
              <Bar dataKey="outQty" name="Out Qty" fill="#ef4444" />
            </BarChart>
          </ChartBox>

          <ChartBox title="Running Net Qty (Cumulative)">
            <AreaChart data={running}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area dataKey="cumNet" name="Cumulative Net" stroke="#6366f1" fill="#c7d2fe" strokeWidth={2} />
            </AreaChart>
          </ChartBox>

          <ChartBox title="Transactions Count per Day">
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="tx" name="Transactions" fill="#0ea5e9" />
            </BarChart>
          </ChartBox>

          <ChartBox title="Movement by Type (Net Qty)">
            <BarChart data={byType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="netQty" name="Net Qty" fill="#6366f1" />
            </BarChart>
          </ChartBox>

          <ChartBox title="Transaction Share by Type (Pie)">
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie data={byType} dataKey="tx" nameKey="type" innerRadius={60} outerRadius={110} paddingAngle={2}>
                {byType.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartBox>

          <ChartBox title="Top SKUs (Net Qty)">
            <BarChart data={bySku}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sku" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="netQty" name="Net Qty" fill="#111827" />
            </BarChart>
          </ChartBox>

          <ChartBox title="Warehouse Comparison (In / Out / Net)">
            <BarChart data={byWarehouse}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="wh" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="inQty" name="In Qty" fill="#22c55e" />
              <Bar dataKey="outQty" name="Out Qty" fill="#ef4444" />
              <Bar dataKey="netQty" name="Net Qty" fill="#6366f1" />
            </BarChart>
          </ChartBox>

          <ChartBox title="Hourly Transactions Count">
            <BarChart data={hourlyTx}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="tx" name="Transactions" fill="#0ea5e9" />
            </BarChart>
          </ChartBox>

          <ChartBox title="Hourly In/Out Qty (with Net)">
            <LineChart data={hourlyQty}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="inQty" name="In Qty" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line dataKey="outQty" name="Out Qty" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line dataKey="netQty" name="Net Qty" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartBox>

          <ChartBox title="Barcode-wise Net Qty (Top)">
            <BarChart data={byBarcode}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="barcode" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="netQty" name="Net Qty" fill="#111827" />
            </BarChart>
          </ChartBox>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
              <div className="text-sm font-extrabold text-slate-700">12) SKU Balance Trend (Select SKU)</div>
              <select
                value={skuFocus}
                onChange={(e) => setSkuFocus(e.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none"
              >
                {SKU_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={balanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dt" hide />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line dataKey="balance" name="Balance" stroke="#0ea5e9" strokeWidth={3} dot />
                  <Line dataKey="inQty" name="In Qty" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line dataKey="outQty" name="Out Qty" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <ChartBox title="Latest Balance by SKU">
            <BarChart data={latestBalanceBySku}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sku" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="balance" name="Latest Balance" fill="#0ea5e9" />
            </BarChart>
          </ChartBox>

          <ChartBox title="Warehouse × Day Net Movement (Multi-Line)">
            <LineChart data={whByDayLines.rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              {whByDayLines.whs.map((w, i) => (
                <Line key={w} dataKey={w} name={w} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ChartBox>
        </div>

        <div className="mt-5 text-xs text-slate-500 font-semibold">
        </div>
      </div>
    </div>
  );
}

/* ------------------ small UI bits ------------------ */
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

function Kpi({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-lg font-black text-slate-900">{value}</div>
    </div>
  );
}
