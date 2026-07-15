// import React, { useMemo } from "react";
// import {
//   AreaChart,
//   Area,
//   BarChart,
//   Bar,
//   PieChart,
//   Pie,
//   Cell,
//   LineChart,
//   Line,
//   ComposedChart,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   Legend,
//   ResponsiveContainer,
//   ReferenceLine,
// } from "recharts";

// function money(value) {
//   return `₹${Number(value || 0).toLocaleString("en-IN", {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })}`;
// }

// function moneyShort(value) {
//   const n = Number(value || 0);
//   if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
//   if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
//   return `₹${n.toFixed(0)}`;
// }

// function formatDate(dateString) {
//   if (!dateString) return "—";
//   const d = new Date(dateString);
//   if (Number.isNaN(d.getTime())) return dateString;
//   return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
// }

// function formatDateKey(dateString) {
//   if (!dateString) return "";
//   const d = new Date(dateString);
//   if (Number.isNaN(d.getTime())) return "";
//   return d.toISOString().slice(0, 10);
// }

// function isTodayDate(dateString) {
//   if (!dateString) return false;
//   const d = new Date(dateString);
//   if (Number.isNaN(d.getTime())) return false;

//   const now = new Date();
//   return (
//     d.getDate() === now.getDate() &&
//     d.getMonth() === now.getMonth() &&
//     d.getFullYear() === now.getFullYear()
//   );
// }

// const PIE_COLORS = [
//   "#2563eb",
//   "#7c3aed",
//   "#d97706",
//   "#0d9488",
//   "#e11d48",
//   "#059669",
//   "#0891b2",
//   "#f59e0b",
// ];

// const CustomTooltip = ({ active, payload, label }) => {
//   if (!active || !payload?.length) return null;

//   return (
//     <div className="min-w-[170px] rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg">
//       <p className="mb-2 font-bold text-slate-800">{label}</p>
//       {payload.map((p, i) => (
//         <div key={i} className="mt-2 flex items-center justify-between gap-4">
//           <div className="flex items-center gap-2">
//             <span
//               className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
//               style={{ backgroundColor: p.color }}
//             />
//             <span className="text-slate-600">{p.name}</span>
//           </div>
//           <span className="font-bold text-slate-900">
//             {typeof p.value === "number" ? money(p.value) : p.value}
//           </span>
//         </div>
//       ))}
//     </div>
//   );
// };

// const PLTooltip = ({ active, payload, label }) => {
//   if (!active || !payload?.length) return null;

//   const netRow = payload.find((p) => p.dataKey === "net");
//   const netValue = netRow ? Number(netRow.value || 0) : 0;
//   const isProfit = netValue >= 0;

//   return (
//     <div className="min-w-[180px] rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg">
//       <p className="mb-2 font-bold text-slate-800">{label}</p>
//       {payload.map((p, i) => (
//         <div key={i} className="mt-2 flex items-center justify-between gap-4">
//           <div className="flex items-center gap-2">
//             <span
//               className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
//               style={{ backgroundColor: p.color }}
//             />
//             <span className="text-slate-600">{p.name}</span>
//           </div>
//           <span className="font-bold text-slate-900">{money(p.value)}</span>
//         </div>
//       ))}

//       <div
//         className={`mt-3 border-t pt-3 text-sm font-bold ${
//           isProfit ? "text-emerald-600" : "text-rose-600"
//         }`}
//       >
//         {isProfit ? "Profit" : "Loss"}: {money(Math.abs(netValue))}
//       </div>
//     </div>
//   );
// };

// function Empty() {
//   return (
//     <div className="flex h-full items-center justify-center text-base text-slate-400">
//       No data available
//     </div>
//   );
// }

// function GraphBox({ title, children, height = 320 }) {
//   return (
//     <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
//       <h2 className="mb-4 text-base font-bold text-slate-900">{title}</h2>
//       <div style={{ height }}>{children}</div>
//     </div>
//   );
// }

// export default function CashierAnalytics({ transactions = [] }) {
//   const filtered = useMemo(() => transactions, [transactions]);

//   const dailyData = useMemo(() => {
//     const map = new Map();

//     filtered.forEach((tx) => {
//       const key = formatDateKey(tx.date);
//       if (!key) return;

//       const type = String(tx.type || "sale").toLowerCase();
//       const payment = String(tx.payment || "").trim().toLowerCase();
//       if (payment === "bank transfer") return;

//       const amount = Number(tx.grandTotal || tx.amount || 0);
//       const refund = Number(tx.refundAmount || tx.grandTotal || 0);

//       if (!map.has(key)) {
//         map.set(key, {
//           date: key,
//           label: formatDate(key),
//           sales: 0,
//           returns: 0,
//           net: 0,
//           bills: 0,
//           profit: 0,
//           loss: 0,
//         });
//       }

//       const row = map.get(key);

//       if (type === "sale") {
//         row.sales += amount;
//         row.bills += 1;
//       }

//       if (type === "return") {
//         row.returns += refund;
//       }

//       row.net = row.sales - row.returns;
//       row.profit = row.net > 0 ? row.net : 0;
//       row.loss = row.net < 0 ? Math.abs(row.net) : 0;
//     });

//     return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
//   }, [filtered]);

//   const paymentData = useMemo(() => {
//     const map = new Map();

//     filtered.forEach((tx) => {
//       if (String(tx.type || "sale").toLowerCase() !== "sale") return;

//       const payRaw = String(tx.payment || "Unknown").trim();
//       const payNormalized = payRaw.toLowerCase();
//       if (payNormalized === "bank transfer") return;

//       const amount = Number(tx.grandTotal || tx.amount || 0);

//       if (!map.has(payRaw)) {
//         map.set(payRaw, { name: payRaw, value: 0 });
//       }

//       const row = map.get(payRaw);
//       row.value += amount;
//     });

//     return Array.from(map.values()).sort((a, b) => b.value - a.value);
//   }, [filtered]);

//   const todaySalesData = useMemo(() => {
//     const hours = Array.from({ length: 24 }, (_, i) => ({
//       hour: `${String(i).padStart(2, "0")}:00`,
//       sales: 0,
//     }));

//     filtered.forEach((tx) => {
//       const type = String(tx.type || "sale").toLowerCase();
//       const payment = String(tx.payment || "").trim().toLowerCase();

//       if (type !== "sale") return;
//       if (payment === "bank transfer") return;
//       if (!isTodayDate(tx.date)) return;

//       const d = new Date(tx.date);
//       if (Number.isNaN(d.getTime())) return;

//       const h = d.getHours();
//       hours[h].sales += Number(tx.grandTotal || tx.amount || 0);
//     });

//     return hours;
//   }, [filtered]);

//   return (
//     <div className="min-h-screen bg-slate-50 p-4 sm:p-5 lg:p-6">
//       <div className="mx-auto max-w-[1650px] space-y-5">
//         <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
//           <GraphBox title="Sales Trend" height={320}>
//             {dailyData.length === 0 ? (
//               <Empty />
//             ) : (
//               <ResponsiveContainer width="100%" height="100%">
//                 <AreaChart
//                   data={dailyData}
//                   margin={{ top: 5, right: 10, left: 0, bottom: 10 }}
//                 >
//                   <defs>
//                     <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
//                       <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
//                       <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
//                     </linearGradient>
//                     <linearGradient id="returnsFill" x1="0" y1="0" x2="0" y2="1">
//                       <stop offset="5%" stopColor="#e11d48" stopOpacity={0.16} />
//                       <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
//                     </linearGradient>
//                     <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
//                       <stop offset="5%" stopColor="#059669" stopOpacity={0.18} />
//                       <stop offset="95%" stopColor="#059669" stopOpacity={0} />
//                     </linearGradient>
//                   </defs>

//                   <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
//                   <XAxis
//                     dataKey="label"
//                     tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }}
//                     tickLine={false}
//                     axisLine={false}
//                   />
//                   <YAxis
//                     tickFormatter={moneyShort}
//                     tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }}
//                     tickLine={false}
//                     axisLine={false}
//                     width={70}
//                   />
//                   <Tooltip content={<CustomTooltip />} />
//                   <Legend />
//                   <Area
//                     type="monotone"
//                     dataKey="sales"
//                     name="Sales"
//                     stroke="#2563eb"
//                     fill="url(#salesFill)"
//                     strokeWidth={2.5}
//                   />
//                   <Area
//                     type="monotone"
//                     dataKey="returns"
//                     name="Returns"
//                     stroke="#e11d48"
//                     fill="url(#returnsFill)"
//                     strokeWidth={2.5}
//                   />
//                   <Area
//                     type="monotone"
//                     dataKey="net"
//                     name="Net"
//                     stroke="#059669"
//                     fill="url(#netFill)"
//                     strokeWidth={2.5}
//                   />
//                 </AreaChart>
//               </ResponsiveContainer>
//             )}
//           </GraphBox>

//           <GraphBox title="Profit vs Loss" height={320}>
//             {dailyData.length === 0 ? (
//               <Empty />
//             ) : (
//               <ResponsiveContainer width="100%" height="100%">
//                 <ComposedChart
//                   data={dailyData}
//                   margin={{ top: 5, right: 10, left: 0, bottom: 10 }}
//                 >
//                   <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
//                   <XAxis
//                     dataKey="label"
//                     tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }}
//                     tickLine={false}
//                     axisLine={false}
//                   />
//                   <YAxis
//                     tickFormatter={moneyShort}
//                     tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }}
//                     tickLine={false}
//                     axisLine={false}
//                     width={70}
//                   />
//                   <Tooltip content={<PLTooltip />} />
//                   <Legend />
//                   <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="4 4" />
//                   <Bar
//                     dataKey="profit"
//                     name="Profit"
//                     fill="#059669"
//                     radius={[4, 4, 0, 0]}
//                     maxBarSize={28}
//                   />
//                   <Bar
//                     dataKey="loss"
//                     name="Loss"
//                     fill="#e11d48"
//                     radius={[4, 4, 0, 0]}
//                     maxBarSize={28}
//                   />
//                   <Line
//                     type="monotone"
//                     dataKey="net"
//                     name="Net"
//                     stroke="#2563eb"
//                     strokeWidth={3}
//                     dot={{ r: 4 }}
//                     activeDot={{ r: 6 }}
//                   />
//                 </ComposedChart>
//               </ResponsiveContainer>
//             )}
//           </GraphBox>
//         </div>

//         <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
//           <GraphBox title="Payment Method" height={300}>
//             {paymentData.length === 0 ? (
//               <Empty />
//             ) : (
//               <ResponsiveContainer width="100%" height="100%">
//                 <PieChart>
//                   <Pie
//                     data={paymentData}
//                     cx="50%"
//                     cy="50%"
//                     innerRadius={55}
//                     outerRadius={90}
//                     paddingAngle={3}
//                     dataKey="value"
//                   >
//                     {paymentData.map((_, i) => (
//                       <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
//                     ))}
//                   </Pie>
//                   <Tooltip formatter={(v) => money(v)} />
//                   <Legend />
//                 </PieChart>
//               </ResponsiveContainer>
//             )}
//           </GraphBox>

//           <GraphBox title="Payment Revenue" height={300}>
//             {paymentData.length === 0 ? (
//               <Empty />
//             ) : (
//               <ResponsiveContainer width="100%" height="100%">
//                 <BarChart
//                   data={paymentData}
//                   margin={{ top: 5, right: 10, left: 0, bottom: 10 }}
//                 >
//                   <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
//                   <XAxis
//                     dataKey="name"
//                     tick={{ fontSize: 12, fill: "#475569", fontWeight: 700 }}
//                     tickLine={false}
//                     axisLine={false}
//                   />
//                   <YAxis
//                     tickFormatter={moneyShort}
//                     tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }}
//                     tickLine={false}
//                     axisLine={false}
//                     width={70}
//                   />
//                   <Tooltip formatter={(v) => [money(v), "Revenue"]} />
//                   <Bar
//                     dataKey="value"
//                     name="Revenue"
//                     radius={[6, 6, 0, 0]}
//                     maxBarSize={70}
//                   >
//                     {paymentData.map((_, i) => (
//                       <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
//                     ))}
//                   </Bar>
//                 </BarChart>
//               </ResponsiveContainer>
//             )}
//           </GraphBox>
//         </div>

//         <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
//           <GraphBox title="Today Sales" height={300}>
//             {todaySalesData.length === 0 ? (
//               <Empty />
//             ) : (
//               <ResponsiveContainer width="100%" height="100%">
//                 <LineChart
//                   data={todaySalesData}
//                   margin={{ top: 5, right: 10, left: 0, bottom: 10 }}
//                 >
//                   <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
//                   <XAxis
//                     dataKey="hour"
//                     tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
//                     tickLine={false}
//                     axisLine={false}
//                   />
//                   <YAxis
//                     tickFormatter={moneyShort}
//                     tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }}
//                     tickLine={false}
//                     axisLine={false}
//                     width={70}
//                   />
//                   <Tooltip content={<CustomTooltip />} />
//                   <Legend />
//                   <Line
//                     type="monotone"
//                     dataKey="sales"
//                     name="Today Sales"
//                     stroke="#2563eb"
//                     strokeWidth={3}
//                     dot={{ r: 3.5 }}
//                     activeDot={{ r: 6 }}
//                   />
//                 </LineChart>
//               </ResponsiveContainer>
//             )}
//           </GraphBox>

//           <GraphBox title="Sales vs Returns" height={340}>
//             {dailyData.length === 0 ? (
//               <Empty />
//             ) : (
//               <ResponsiveContainer width="100%" height="100%">
//                 <BarChart
//                   data={dailyData}
//                   margin={{ top: 5, right: 10, left: 0, bottom: 10 }}
//                   barGap={6}
//                 >
//                   <CartesianGrid
//                     strokeDasharray="3 3"
//                     stroke="#f1f5f9"
//                     vertical={false}
//                   />
//                   <XAxis
//                     dataKey="label"
//                     tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }}
//                     tickLine={false}
//                     axisLine={false}
//                   />
//                   <YAxis
//                     tickFormatter={moneyShort}
//                     tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }}
//                     tickLine={false}
//                     axisLine={false}
//                     width={70}
//                   />
//                   <Tooltip content={<CustomTooltip />} />
//                   <Legend />
//                   <Bar
//                     dataKey="sales"
//                     name="Sales"
//                     fill="#2563eb"
//                     radius={[4, 4, 0, 0]}
//                     maxBarSize={30}
//                   />
//                   <Bar
//                     dataKey="returns"
//                     name="Returns"
//                     fill="#e11d48"
//                     radius={[4, 4, 0, 0]}
//                     maxBarSize={30}
//                   />
//                 </BarChart>
//               </ResponsiveContainer>
//             )}
//           </GraphBox>
//         </div>
//       </div>
//     </div>
//   );
// }

import React, { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  FaChartBar, FaBoxes, FaFileInvoiceDollar, FaUserTie,
  FaCreditCard, FaSyncAlt, FaDownload, FaCalendarAlt,
  FaRupeeSign, FaReceipt, FaArrowUp, FaArrowDown,
} from "react-icons/fa";

import { CASHIER_API_BASE as API_BASE, cashierFetch } from "./cashierApi";
const money = v => `₹${Math.abs(Number(v || 0)).toFixed(2)}`;
const num   = v =>  Math.abs(Number(v || 0)).toFixed(2);
const pct   = (a, b) => b ? (((a - b) / b) * 100).toFixed(1) : null;

/* ── helpers ── */
function fmt(n) { return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

const TODAY      = new Date().toISOString().split("T")[0];
const MONTH_START = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString().split("T")[0];

/* ── KPI Card ── */
function KpiCard({ icon: Icon, label, value, sub, color, small }) {
  return (
    <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E4EAF3", padding:"16px 18px", display:"flex", alignItems:"center", gap:14, boxShadow:"0 2px 8px rgba(15,27,45,0.05)" }}>
      <div style={{ width:44, height:44, borderRadius:11, background:color+"18", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <Icon style={{ color, fontSize:18 }} />
      </div>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:10, color:"#7A8BA4", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</div>
        <div style={{ fontSize: small ? 16 : 20, fontWeight:800, color:"#0F1B2D", lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}</div>
        {sub && <div style={{ fontSize:11, color:"#7A8BA4", marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Simple bar chart ── */
function BarChart({ data, valueKey, labelKey, color, height = 120 }) {
  if (!data?.length) return <div style={{ textAlign:"center", color:"#7A8BA4", padding:24, fontSize:13 }}>No data</div>;
  const max = Math.max(...data.map(d => Number(d[valueKey] || 0)));
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:4, height, overflowX:"auto", paddingBottom:4 }}>
      {data.map((d, i) => {
        const h = max > 0 ? (Number(d[valueKey] || 0) / max) * (height - 24) : 0;
        return (
          <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, minWidth:32, flex:1 }}
            title={`${d[labelKey]}: ₹${fmt(d[valueKey])}`}>
            <div style={{ width:"100%", background:color, borderRadius:"4px 4px 0 0", height:Math.max(h, 2), transition:"height 0.3s", opacity:0.85 }} />
            <span style={{ fontSize:8, color:"#7A8BA4", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:36, textAlign:"center" }}>
              {(d[labelKey] || "").slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Tab button ── */
function Tab({ label, icon: Icon, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:"flex", alignItems:"center", gap:7,
      padding:"10px 18px", borderRadius:10, border:"none", cursor:"pointer",
      fontSize:13, fontWeight:700, transition:"all 0.15s",
      background: active ? "#5B5FEF" : "#F8FAFD",
      color:      active ? "#fff"    : "#4A5168",
      boxShadow:  active ? "0 4px 12px #5B5FEF30" : "none",
    }}>
      <Icon style={{ fontSize:13 }} /> {label}
    </button>
  );
}

/* ── Date filter bar ── */
function DateBar({ from, to, setFrom, setTo, onRefresh, loading, children }) {
  const presets = [
    { label:"Today",     f: TODAY,       t: TODAY },
    { label:"This Month",f: MONTH_START, t: TODAY },
    { label:"Last 7d",   f: new Date(Date.now()-6*864e5).toISOString().split("T")[0], t: TODAY },
    { label:"Last 30d",  f: new Date(Date.now()-29*864e5).toISOString().split("T")[0], t: TODAY },
  ];
  const INP = { padding:"7px 11px", borderRadius:9, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none", background:"#FAFBFF", fontFamily:"inherit" };
  return (
    <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E4EAF3", padding:"14px 18px", marginBottom:16, display:"flex", flexWrap:"wrap", gap:10, alignItems:"center" }}>
      <FaCalendarAlt style={{ color:"#7A8BA4", fontSize:13 }} />
      {presets.map(p => (
        <button key={p.label} onClick={() => { setFrom(p.f); setTo(p.t); }}
          style={{ padding:"6px 12px", borderRadius:8, border:`1.5px solid ${from===p.f&&to===p.t?"#5B5FEF":"#E4EAF3"}`, background: from===p.f&&to===p.t?"#EEEFFE":"#fff", color: from===p.f&&to===p.t?"#5B5FEF":"#4A5168", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          {p.label}
        </button>
      ))}
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={INP} />
        <span style={{ color:"#7A8BA4", fontSize:12 }}>→</span>
        <input type="date" value={to}   onChange={e => setTo(e.target.value)}   style={INP} />
      </div>
      <button onClick={onRefresh} disabled={loading}
        style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:9, border:"1.5px solid #E4EAF3", background:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", color:"#4A5168", marginLeft:"auto" }}>
        <FaSyncAlt style={{ fontSize:11, animation: loading?"spin 1s linear infinite":"none" }} /> Refresh
      </button>
      {children}
    </div>
  );
}

/* ══════════════════════════ TAB 1: SUMMARY ══════════════════════════ */
function SummaryTab() {
  const [from,    setFrom]    = useState(MONTH_START);
  const [to,      setTo]      = useState(TODAY);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await cashierFetch(`${API_BASE}/cashier/reports/summary?from_date=${from}&to_date=${to}`);
      const json = await res.json();
      setData(json);
    } catch {}
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const k = data?.kpis || {};

  const downloadExcel = () => {
    if (!data?.trend?.length) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
      "From": from, "To": to,
      "Sale Count": k.sale_count, "Return Count": k.return_count,
      "Gross Revenue": k.gross_revenue, "Return Amount": k.return_amount,
      "Net Revenue": k.net_revenue, "Total GST": k.total_gst,
      "Total Savings": k.total_savings, "Items Sold": k.items_sold, "Avg Bill": k.avg_bill,
    }]), "KPIs");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.trend), "Daily Trend");
    XLSX.writeFile(wb, `Sales_Summary_${from}_${to}.xlsx`);
  };

  return (
    <div>
      <DateBar from={from} to={to} setFrom={setFrom} setTo={setTo} onRefresh={fetch_} loading={loading}>
        <button onClick={downloadExcel} disabled={!data}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:9, border:"none", background:"#5B5FEF", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          <FaDownload /> Export
        </button>
      </DateBar>

      {/* KPI Grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12, marginBottom:20 }}>
        <KpiCard icon={FaReceipt}           label="Sale Bills"    value={k.sale_count || 0}          color="#5B5FEF" />
        <KpiCard icon={FaReceipt}           label="Returns"       value={k.return_count || 0}        color="#D93025" />
        <KpiCard icon={FaRupeeSign}         label="Gross Revenue" value={money(k.gross_revenue)}      color="#0D9974" />
        <KpiCard icon={FaRupeeSign}         label="Net Revenue"   value={money(k.net_revenue)}        color="#C97D00" sub="After returns" />
        <KpiCard icon={FaBoxes}             label="Items Sold"    value={k.items_sold || 0}           color="#1A6FDB" />
        <KpiCard icon={FaRupeeSign}         label="Avg Bill"      value={money(k.avg_bill)}           color="#5B5FEF" />
        <KpiCard icon={FaFileInvoiceDollar} label="Total GST"     value={money(k.total_gst)}          color="#7C3AED" />
        <KpiCard icon={FaRupeeSign}         label="Total Savings" value={money(k.total_savings)}      color="#0D9974" sub="Discounts given" />
      </div>

      {/* Daily Chart */}
      {data?.trend?.length > 0 && (
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E4EAF3", padding:"20px 22px", marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:800, color:"#0F1B2D", marginBottom:16 }}>Daily Revenue Trend</div>
          <BarChart data={data.trend} valueKey="net" labelKey="date" color="#5B5FEF" height={140} />
        </div>
      )}

      {/* Daily table */}
      {data?.trend?.length > 0 && (
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E4EAF3", overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#F8FAFD", borderBottom:"1.5px solid #E4EAF3" }}>
                  {["Date","Sales","Returns","Gross","Net Revenue","GST","Items"].map(h => (
                    <th key={h} style={{ padding:"11px 14px", textAlign: h==="Date"?"left":"right", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:"#7A8BA4" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.trend.map((d, i) => (
                  <tr key={i} style={{ borderBottom:"1px solid #F1F5F9", background: i%2===0?"#fff":"#FAFBFF" }}>
                    <td style={{ padding:"10px 14px", fontWeight:600, color:"#0F1B2D" }}>{d.date}</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", color:"#0D9974", fontWeight:700 }}>{d.sales}</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", color:"#D93025", fontWeight:700 }}>{d.returns}</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", fontFamily:"monospace" }}>{money(d.gross)}</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:800, color:"#5B5FEF", fontFamily:"monospace" }}>{money(d.net)}</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", fontFamily:"monospace", color:"#7C3AED" }}>{money(d.gst)}</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:700 }}>{d.items}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════ TAB 2: ITEMS ══════════════════════════ */
function ItemsTab() {
  const [from,    setFrom]   = useState(MONTH_START);
  const [to,      setTo]     = useState(TODAY);
  const [sortBy,  setSortBy] = useState("qty");
  const [data,    setData]   = useState([]);
  const [loading, setLoading]= useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await cashierFetch(`${API_BASE}/cashier/reports/items?from_date=${from}&to_date=${to}&sort_by=${sortBy}&limit=100`);
      const json = await res.json();
      setData(json.data || []);
    } catch {}
    finally { setLoading(false); }
  }, [from, to, sortBy]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const downloadExcel = () => {
    if (!data.length) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.map(r => ({
      "Barcode": r.barcode, "SKU": r.sku, "Product": r.name, "HSN": r.hsn,
      "Division": r.division, "GST Rate%": r.gst_rate,
      "Qty Sold": r.qty_sold, "Qty Returned": r.qty_returned, "Net Qty": r.net_qty,
      "Revenue": r.revenue, "Return Value": r.return_value, "Net Revenue": r.net_revenue,
      "Bill Count": r.bill_count,
    }))), "Item-wise Sales");
    XLSX.writeFile(wb, `ItemWise_Sales_${from}_${to}.xlsx`);
  };

  return (
    <div>
      <DateBar from={from} to={to} setFrom={setFrom} setTo={setTo} onRefresh={fetch_} loading={loading}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:12, color:"#7A8BA4", fontWeight:600 }}>Sort by:</span>
          {["qty","revenue","returns"].map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              style={{ padding:"5px 12px", borderRadius:7, border:`1.5px solid ${sortBy===s?"#5B5FEF":"#E4EAF3"}`, background: sortBy===s?"#EEEFFE":"#fff", color: sortBy===s?"#5B5FEF":"#4A5168", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              {s === "qty" ? "Qty Sold" : s === "revenue" ? "Revenue" : "Returns"}
            </button>
          ))}
        </div>
        <button onClick={downloadExcel} disabled={!data.length}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:9, border:"none", background:"#5B5FEF", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          <FaDownload /> Export
        </button>
      </DateBar>

      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E4EAF3", overflow:"hidden" }}>
        <div style={{ padding:"14px 18px", borderBottom:"1px solid #F1F5F9", fontSize:13, fontWeight:700, color:"#0F1B2D" }}>
          {loading ? "Loading…" : `${data.length} products`}
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", minWidth:800, borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ background:"#0F1B2D" }}>
                {["#","Product","Barcode / SKU","Division","GST%","Qty Sold","Qty Ret.","Net Qty","Revenue","Ret. Value","Net Revenue","Bills"].map(h => (
                  <th key={h} style={{ padding:"10px 12px", textAlign: ["#","Qty Sold","Qty Ret.","Net Qty","Revenue","Ret. Value","Net Revenue","Bills"].includes(h)?"right":"left", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:"rgba(255,255,255,0.82)", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} style={{ padding:40, textAlign:"center", color:"#7A8BA4" }}>Loading…</td></tr>
              ) : !data.length ? (
                <tr><td colSpan={12} style={{ padding:40, textAlign:"center", color:"#7A8BA4" }}>No data for this period</td></tr>
              ) : data.map((r, i) => (
                <tr key={i} style={{ borderBottom:"1px solid #F1F5F9", background: i%2===0?"#fff":"#FAFBFF" }}>
                  <td style={{ padding:"9px 12px", textAlign:"right", color:"#7A8BA4", fontSize:11 }}>{i+1}</td>
                  <td style={{ padding:"9px 12px", fontWeight:700, color:"#0F1B2D", maxWidth:180 }}>
                    <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                    {r.hsn && <div style={{ fontSize:10, color:"#7A8BA4" }}>HSN: {r.hsn}</div>}
                  </td>
                  <td style={{ padding:"9px 12px", fontFamily:"monospace", fontSize:11 }}>
                    <div style={{ color:"#4A5168" }}>{r.barcode}</div>
                    <div style={{ color:"#5B5FEF", fontSize:10 }}>{r.sku}</div>
                  </td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:"#4A5168" }}>{r.division || "—"}</td>
                  <td style={{ padding:"9px 12px", textAlign:"right" }}>
                    <span style={{ background:"#EEEFFE", borderRadius:6, padding:"2px 7px", fontSize:11, fontWeight:700, color:"#5B5FEF" }}>{r.gst_rate}%</span>
                  </td>
                  <td style={{ padding:"9px 12px", textAlign:"right", fontWeight:800, color:"#0D9974" }}>{r.qty_sold}</td>
                  <td style={{ padding:"9px 12px", textAlign:"right", color:"#D93025", fontWeight:700 }}>{r.qty_returned}</td>
                  <td style={{ padding:"9px 12px", textAlign:"right", fontWeight:800, color:"#0F1B2D" }}>{r.net_qty}</td>
                  <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", color:"#0D9974" }}>{money(r.revenue)}</td>
                  <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", color:"#D93025" }}>{money(r.return_value)}</td>
                  <td style={{ padding:"9px 12px", textAlign:"right", fontFamily:"monospace", fontWeight:800, color:"#5B5FEF" }}>{money(r.net_revenue)}</td>
                  <td style={{ padding:"9px 12px", textAlign:"right", color:"#4A5168" }}>{r.bill_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════ TAB 3: GST ══════════════════════════ */
function GSTTab() {
  const [from,    setFrom]   = useState(MONTH_START);
  const [to,      setTo]     = useState(TODAY);
  const [data,    setData]   = useState(null);
  const [loading, setLoading]= useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await cashierFetch(`${API_BASE}/cashier/reports/gst?from_date=${from}&to_date=${to}`);
      const json = await res.json();
      setData(json);
    } catch {}
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const downloadExcel = () => {
    if (!data?.brackets?.length) return;
    const wb = XLSX.utils.book_new();
    const rows = data.brackets.map(b => ({
      "GST Rate %": b.rate, "Gross Sales": b.gross_sales,
      "Taxable Amount": b.taxable, "CGST": b.cgst, "SGST": b.sgst,
      "IGST": b.igst, "Total GST": b.total_gst,
    }));
    rows.push({ "GST Rate %": "TOTALS", "Gross Sales": data.totals.gross,
      "Taxable Amount": data.totals.taxable, "CGST": data.totals.cgst,
      "SGST": data.totals.sgst, "IGST": 0, "Total GST": data.totals.total_gst });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "GST Report");
    XLSX.writeFile(wb, `GST_Report_${from}_${to}.xlsx`);
  };

  const t = data?.totals || {};

  return (
    <div>
      <DateBar from={from} to={to} setFrom={setFrom} setTo={setTo} onRefresh={fetch_} loading={loading}>
        <button onClick={downloadExcel} disabled={!data}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:9, border:"none", background:"#5B5FEF", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          <FaDownload /> Export for Filing
        </button>
      </DateBar>

      {/* GST KPIs */}
      {data && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:20 }}>
          <KpiCard icon={FaRupeeSign} label="Gross Sales"     value={money(t.gross)}      color="#0D9974" />
          <KpiCard icon={FaRupeeSign} label="Taxable Amount"  value={money(t.taxable)}    color="#5B5FEF" />
          <KpiCard icon={FaRupeeSign} label="Total CGST"      value={money(t.cgst)}       color="#C97D00" />
          <KpiCard icon={FaRupeeSign} label="Total SGST"      value={money(t.sgst)}       color="#C97D00" />
          <KpiCard icon={FaRupeeSign} label="Total GST"       value={money(t.total_gst)}  color="#7C3AED" />
        </div>
      )}

      {/* GST Bracket Table */}
      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E4EAF3", overflow:"hidden" }}>
        <div style={{ padding:"14px 18px", borderBottom:"1px solid #F1F5F9", fontSize:13, fontWeight:700, color:"#0F1B2D" }}>
          GST Bracket Summary — {from} to {to}
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#0F1B2D" }}>
                {["GST Bracket","Gross Sales","Taxable Amount","CGST","SGST","IGST","Total GST"].map(h => (
                  <th key={h} style={{ padding:"12px 16px", textAlign: h==="GST Bracket"?"left":"right", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:"rgba(255,255,255,0.82)", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding:40, textAlign:"center", color:"#7A8BA4" }}>Loading…</td></tr>
              ) : !data?.brackets?.length ? (
                <tr><td colSpan={7} style={{ padding:40, textAlign:"center", color:"#7A8BA4" }}>No GST data for this period</td></tr>
              ) : (
                <>
                  {data.brackets.map((b, i) => (
                    <tr key={i} style={{ borderBottom:"1px solid #F1F5F9", background: i%2===0?"#fff":"#FAFBFF" }}>
                      <td style={{ padding:"12px 16px" }}>
                        <span style={{ background:"#EEEFFE", border:"1px solid #C5C8F8", borderRadius:8, padding:"4px 12px", fontSize:13, fontWeight:800, color:"#5B5FEF" }}>{b.label}</span>
                      </td>
                      <td style={{ padding:"12px 16px", textAlign:"right", fontFamily:"monospace", color:"#0F1B2D" }}>{money(b.gross_sales)}</td>
                      <td style={{ padding:"12px 16px", textAlign:"right", fontFamily:"monospace", fontWeight:700 }}>{money(b.taxable)}</td>
                      <td style={{ padding:"12px 16px", textAlign:"right", fontFamily:"monospace", color:"#C97D00", fontWeight:700 }}>{money(b.cgst)}</td>
                      <td style={{ padding:"12px 16px", textAlign:"right", fontFamily:"monospace", color:"#C97D00", fontWeight:700 }}>{money(b.sgst)}</td>
                      <td style={{ padding:"12px 16px", textAlign:"right", fontFamily:"monospace", color:"#7A8BA4" }}>0.00</td>
                      <td style={{ padding:"12px 16px", textAlign:"right", fontFamily:"monospace", fontWeight:800, fontSize:14, color:"#7C3AED" }}>{money(b.total_gst)}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr style={{ background:"#F8FAFD", borderTop:"2px solid #E4EAF3" }}>
                    <td style={{ padding:"13px 16px", fontWeight:900, fontSize:13, color:"#0F1B2D" }}>TOTALS</td>
                    <td style={{ padding:"13px 16px", textAlign:"right", fontFamily:"monospace", fontWeight:800 }}>{money(t.gross)}</td>
                    <td style={{ padding:"13px 16px", textAlign:"right", fontFamily:"monospace", fontWeight:800 }}>{money(t.taxable)}</td>
                    <td style={{ padding:"13px 16px", textAlign:"right", fontFamily:"monospace", fontWeight:800, color:"#C97D00" }}>{money(t.cgst)}</td>
                    <td style={{ padding:"13px 16px", textAlign:"right", fontFamily:"monospace", fontWeight:800, color:"#C97D00" }}>{money(t.sgst)}</td>
                    <td style={{ padding:"13px 16px", textAlign:"right", fontFamily:"monospace", color:"#7A8BA4" }}>0.00</td>
                    <td style={{ padding:"13px 16px", textAlign:"right", fontFamily:"monospace", fontWeight:900, fontSize:15, color:"#7C3AED" }}>{money(t.total_gst)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════ TAB 4: CASHIERS ══════════════════════════ */
function CashiersTab() {
  const [from,    setFrom]   = useState(MONTH_START);
  const [to,      setTo]     = useState(TODAY);
  const [data,    setData]   = useState([]);
  const [loading, setLoading]= useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await cashierFetch(`${API_BASE}/cashier/reports/cashiers?from_date=${from}&to_date=${to}`);
      const json = await res.json();
      setData(json.data || []);
    } catch {}
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const downloadExcel = () => {
    if (!data.length) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.map(r => ({
      "Cashier": r.cashier, "Sale Count": r.sale_count, "Return Count": r.return_count,
      "Gross Revenue": r.gross_revenue, "Return Amount": r.return_amount,
      "Net Revenue": r.net_revenue, "Items Sold": r.items_sold,
      "Avg Bill": r.avg_bill, "Total GST": r.total_gst,
    }))), "Cashier Report");
    XLSX.writeFile(wb, `Cashier_Report_${from}_${to}.xlsx`);
  };

  const maxRev = Math.max(...data.map(d => d.net_revenue || 0), 1);

  return (
    <div>
      <DateBar from={from} to={to} setFrom={setFrom} setTo={setTo} onRefresh={fetch_} loading={loading}>
        <button onClick={downloadExcel} disabled={!data.length}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:9, border:"none", background:"#5B5FEF", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          <FaDownload /> Export
        </button>
      </DateBar>

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {loading ? (
          <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E4EAF3", padding:40, textAlign:"center", color:"#7A8BA4" }}>Loading…</div>
        ) : !data.length ? (
          <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E4EAF3", padding:40, textAlign:"center", color:"#7A8BA4" }}>No data for this period</div>
        ) : data.map((c, i) => (
          <div key={i} style={{ background:"#fff", borderRadius:14, border:"1px solid #E4EAF3", padding:"18px 20px", boxShadow:"0 2px 8px rgba(15,27,45,0.04)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
              {/* Rank */}
              <div style={{ width:36, height:36, borderRadius:10, background: i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":"#EEEFFE", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:14, color: i<3?"#fff":"#5B5FEF", flexShrink:0 }}>
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:"#0F1B2D" }}>{c.cashier}</div>
                <div style={{ fontSize:12, color:"#7A8BA4" }}>{c.sale_count} sales · {c.return_count} returns · {c.items_sold} items</div>
              </div>
              <div style={{ marginLeft:"auto", textAlign:"right" }}>
                <div style={{ fontSize:11, color:"#7A8BA4", fontWeight:600, textTransform:"uppercase" }}>Net Revenue</div>
                <div style={{ fontSize:20, fontWeight:900, color:"#5B5FEF" }}>{money(c.net_revenue)}</div>
              </div>
            </div>

            {/* Revenue bar */}
            <div style={{ height:8, background:"#F1F5F9", borderRadius:4, marginBottom:14, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(c.net_revenue/maxRev)*100}%`, background:`linear-gradient(90deg,#5B5FEF,#7C3AED)`, borderRadius:4, transition:"width 0.5s" }} />
            </div>

            {/* Stats grid */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:10 }}>
              {[
                ["Gross Revenue", money(c.gross_revenue), "#0D9974"],
                ["Return Amount", money(c.return_amount), "#D93025"],
                ["Avg Bill",      money(c.avg_bill),      "#C97D00"],
                ["Total GST",     money(c.total_gst),     "#7C3AED"],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background:"#F8FAFD", borderRadius:10, padding:"10px 12px", border:"1px solid #E4EAF3" }}>
                  <div style={{ fontSize:10, color:"#7A8BA4", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:14, fontWeight:800, color, fontFamily:"monospace" }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Payment split */}
            {Object.keys(c.payment_split || {}).length > 0 && (
              <div style={{ marginTop:12, display:"flex", gap:8, flexWrap:"wrap" }}>
                {Object.entries(c.payment_split).map(([pm, cnt]) => (
                  <span key={pm} style={{ padding:"4px 12px", borderRadius:20, background:"#EEEFFE", color:"#5B5FEF", fontSize:12, fontWeight:700, border:"1px solid #C5C8F8" }}>
                    {pm}: {cnt}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════ TAB 5: PAYMENTS ══════════════════════════ */
function PaymentsTab() {
  const [from,    setFrom]   = useState(MONTH_START);
  const [to,      setTo]     = useState(TODAY);
  const [data,    setData]   = useState(null);
  const [loading, setLoading]= useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await cashierFetch(`${API_BASE}/cashier/reports/payments?from_date=${from}&to_date=${to}`);
      const json = await res.json();
      setData(json);
    } catch {}
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const COLORS = { Cash:"#C97D00", Card:"#1A6FDB", UPI:"#5B5FEF" };

  return (
    <div>
      <DateBar from={from} to={to} setFrom={setFrom} setTo={setTo} onRefresh={fetch_} loading={loading} />

      {/* Cards */}
      {data && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12, marginBottom:20 }}>
          {(data.data || []).map(p => (
            <div key={p.method} style={{ background:"#fff", borderRadius:14, border:`2px solid ${COLORS[p.method]||"#E4EAF3"}20`, padding:"18px 20px", boxShadow:"0 2px 8px rgba(15,27,45,0.05)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <span style={{ fontSize:15, fontWeight:800, color:"#0F1B2D" }}>{p.method}</span>
                <span style={{ padding:"3px 10px", borderRadius:20, background:(COLORS[p.method]||"#5B5FEF")+"18", color: COLORS[p.method]||"#5B5FEF", fontSize:13, fontWeight:800 }}>{p.pct}%</span>
              </div>
              {/* Pie-like bar */}
              <div style={{ height:8, background:"#F1F5F9", borderRadius:4, marginBottom:12, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${p.pct}%`, background: COLORS[p.method]||"#5B5FEF", borderRadius:4 }} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div>
                  <div style={{ fontSize:10, color:"#7A8BA4", fontWeight:700, textTransform:"uppercase" }}>Bills</div>
                  <div style={{ fontSize:18, fontWeight:900, color:"#0F1B2D" }}>{p.count}</div>
                </div>
                <div>
                  <div style={{ fontSize:10, color:"#7A8BA4", fontWeight:700, textTransform:"uppercase" }}>Revenue</div>
                  <div style={{ fontSize:14, fontWeight:800, color: COLORS[p.method]||"#5B5FEF", fontFamily:"monospace" }}>{money(p.revenue)}</div>
                </div>
              </div>
            </div>
          ))}
          {data.grand_total > 0 && (
            <div style={{ background:"linear-gradient(135deg,#5B5FEF,#7C3AED)", borderRadius:14, padding:"18px 20px", display:"flex", flexDirection:"column", justifyContent:"center" }}>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)", fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>Total Revenue</div>
              <div style={{ fontSize:22, fontWeight:900, color:"#fff" }}>{money(data.grand_total)}</div>
            </div>
          )}
        </div>
      )}

      {/* Daily breakdown per method */}
      {data?.data?.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {data.data.map(p => (
            <div key={p.method} style={{ background:"#fff", borderRadius:14, border:"1px solid #E4EAF3", overflow:"hidden" }}>
              <div style={{ padding:"14px 18px", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:14, fontWeight:800, color: COLORS[p.method]||"#5B5FEF" }}>{p.method}</span>
                <span style={{ fontSize:12, color:"#7A8BA4" }}>— daily trend</span>
              </div>
              <div style={{ padding:"14px 18px" }}>
                <BarChart data={p.daily} valueKey="revenue" labelKey="date" color={COLORS[p.method]||"#5B5FEF"} height={100} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════ MAIN ════════════════════════════════ */
export default function CashierReports() {
  const [tab, setTab] = useState("summary");

  const TABS = [
    { key:"summary",  label:"Sales Summary",  icon:FaChartBar           },
    { key:"items",    label:"Item-wise",       icon:FaBoxes              },
    { key:"gst",      label:"GST Report",      icon:FaFileInvoiceDollar  },
    { key:"cashiers", label:"Cashier Report",  icon:FaUserTie            },
    { key:"payments", label:"Payments",        icon:FaCreditCard         },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#F4F7FB", padding:"20px 24px", fontFamily:"'Inter','Plus Jakarta Sans',sans-serif" }}>
      <div style={{ maxWidth:1300, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontSize:22, fontWeight:900, color:"#0F1B2D", margin:0 }}>Reports</h1>
          <p style={{ fontSize:13, color:"#7A8BA4", margin:"3px 0 0" }}>Sales analytics, GST filing, cashier performance and payment breakdown</p>
        </div>

        {/* Tab bar */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
          {TABS.map(t => <Tab key={t.key} {...t} active={tab===t.key} onClick={() => setTab(t.key)} />)}
        </div>

        {/* Content */}
        {tab === "summary"  && <SummaryTab  />}
        {tab === "items"    && <ItemsTab    />}
        {tab === "gst"      && <GSTTab      />}
        {tab === "cashiers" && <CashiersTab />}
        {tab === "payments" && <PaymentsTab />}
      </div>
    </div>
  );
}