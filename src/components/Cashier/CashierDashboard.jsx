

import React, { useEffect, useState, useCallback } from "react";
import {
  FaShoppingCart, FaUndo, FaRupeeSign, FaBoxOpen,
  FaChartBar, FaSyncAlt, FaCreditCard, FaMobileAlt,
  FaMoneyBillWave, FaTrophy, FaArrowUp, FaArrowDown,
  FaReceipt, FaUser, FaClock,
} from "react-icons/fa";

import { CASHIER_API_BASE as API_BASE, cashierFetch } from "./cashierApi";

/* ─── Helpers ─── */
const fmtV  = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN  = (n) => Number(n || 0).toLocaleString("en-IN");
const pad   = (n) => String(n).padStart(2, "0");

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ─── KPI Card ─── */
function KpiCard({ label, value, sub, icon, color, change, delay = 0 }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t); }, [delay]);

  const isUp   = change > 0;
  const isDown = change < 0;

  return (
    <div style={{
      background: "#fff",
      borderRadius: 20,
      padding: "22px 24px",
      border: "1px solid #F1F5F9",
      boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
      position: "relative",
      overflow: "hidden",
      opacity: vis ? 1 : 0,
      transform: vis ? "translateY(0)" : "translateY(14px)",
      transition: "opacity .45s ease, transform .45s ease",
    }}>
      {/* Color bar top */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: "20px 20px 0 0" }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>{label}</div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color, fontSize: 15 }}>
          {icon}
        </div>
      </div>

      <div style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", letterSpacing: "-1px", lineHeight: 1.1 }}>{value}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        {sub && <span style={{ fontSize: 11, color: "#94A3B8" }}>{sub}</span>}
        {change !== null && change !== undefined && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: 11, fontWeight: 700,
            color: isUp ? "#059669" : isDown ? "#DC2626" : "#94A3B8",
            background: isUp ? "#ECFDF5" : isDown ? "#FEF2F2" : "#F1F5F9",
            padding: "2px 7px", borderRadius: 20,
          }}>
            {isUp ? <FaArrowUp style={{ fontSize: 9 }} /> : isDown ? <FaArrowDown style={{ fontSize: 9 }} /> : null}
            {change !== null ? `${Math.abs(change)}% vs yesterday` : "No data yesterday"}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Hourly Bar Chart ─── */
function HourlyChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "#CBD5E1", fontSize: 13 }}>
        No sales recorded today
      </div>
    );
  }
  const maxRev = Math.max(...data.map(d => d.revenue), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160, paddingBottom: 24, position: "relative" }}>
      {data.map((d, i) => {
        const pct = (d.revenue / maxRev) * 100;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 700 }}>
              {d.count > 0 ? d.count : ""}
            </div>
            <div style={{
              width: "100%", borderRadius: "4px 4px 0 0",
              background: `linear-gradient(180deg, #6366F1, #818CF8)`,
              height: `${Math.max(pct, 4)}%`,
              minHeight: d.revenue > 0 ? 8 : 2,
              opacity: d.revenue > 0 ? 1 : 0.15,
              transition: "height 0.8s ease",
              position: "relative",
              cursor: "pointer",
            }}
              title={`${d.hour}: ₹${d.revenue.toLocaleString("en-IN")} (${d.count} bills)`}
            />
            <div style={{ fontSize: 9, color: "#94A3B8", position: "absolute", bottom: 0, fontWeight: 600 }}>
              {d.hour.replace(":00", "")}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Donut Chart ─── */
function PaymentDonut({ data }) {
  const entries = Object.entries(data || {});
  const total   = entries.reduce((s, [, v]) => s + v, 0) || 1;

  const colors  = {
    Cash:  "#10B981",
    Card:  "#6366F1",
    UPI:   "#F59E0B",
  };
  const defaultColors = ["#06B6D4","#EC4899","#8B5CF6"];

  const r = 42, cx = 56, cy = 56, stroke = 16;
  const circ = 2 * Math.PI * r;
  let cumPct = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={112} height={112} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
        {entries.map(([method, count], i) => {
          const pct  = count / total;
          const dash = pct * circ;
          const gap  = circ - dash;
          const off  = circ * (1 - cumPct);
          cumPct += pct;
          const col = colors[method] || defaultColors[i % defaultColors.length];
          return (
            <circle key={method} cx={cx} cy={cy} r={r} fill="none"
              stroke={col} strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={off}
              style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px`, transition: "stroke-dasharray 1s ease" }}
            />
          );
        })}
        <text x={cx} y={cy - 3} textAnchor="middle" fill="#0F172A" fontSize={14} fontWeight={800} fontFamily="monospace">{total}</text>
        <text x={cx} y={cx + 10} textAnchor="middle" fill="#94A3B8" fontSize={9}>bills</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {entries.map(([method, count], i) => {
          const col = colors[method] || defaultColors[i % defaultColors.length];
          const icon = method === "Cash" ? <FaMoneyBillWave /> : method === "Card" ? <FaCreditCard /> : <FaMobileAlt />;
          return (
            <div key={method} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: col }} />
              <span style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 5 }}>
                {icon} {method}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: col, marginLeft: "auto" }}>{count}</span>
              <span style={{ fontSize: 10, color: "#94A3B8" }}>{((count / total) * 100).toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Top Products ─── */
function TopProductRow({ item, rank, maxQty }) {
  const pct    = maxQty > 0 ? (item.qty / maxQty) * 100 : 0;
  const colors = ["#6366F1","#10B981","#F59E0B","#EC4899","#06B6D4","#8B5CF6","#EF4444","#14B8A6"];
  const color  = colors[rank % colors.length];
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #F8FAFC" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, background: `${color}18`, border: `1px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color, flexShrink: 0 }}>
          {rank + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
          <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "monospace" }}>{item.sku || item.barcode}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color }}>{fmtN(item.qty)} units</div>
          <div style={{ fontSize: 10, color: "#94A3B8" }}>{fmtV(item.revenue)}</div>
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "#F1F5F9", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

/* ─── Recent Bill Row ─── */
function BillRow({ bill }) {
  const isReturn = bill.type === "return";
  const time     = (bill.date || "").slice(11, 16);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #F8FAFC" }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: isReturn ? "#FEF2F2" : "#EEF2FF",
        border: `1px solid ${isReturn ? "#FECACA" : "#C7D2FE"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: isReturn ? "#DC2626" : "#6366F1", fontSize: 13,
      }}>
        {isReturn ? <FaUndo /> : <FaReceipt />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", fontFamily: "monospace" }}>{bill.invoice_no}</span>
          {isReturn && (
            <span style={{ fontSize: 9, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", padding: "1px 6px", borderRadius: 20 }}>RETURN</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>
          {bill.customer_name || "Walking Customer"} · {bill.items_count} items · {bill.payment_method}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: isReturn ? "#DC2626" : "#059669" }}>
          {isReturn ? "-" : "+"}{fmtV(bill.net_payable)}
        </div>
        <div style={{ fontSize: 10, color: "#94A3B8", display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
          <FaClock style={{ fontSize: 8 }} /> {time}
        </div>
      </div>
    </div>
  );
}

/* ─── Panel ─── */
function Panel({ title, sub, icon, children, color = "#6366F1", delay = 0, action }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div style={{
      background: "#fff", borderRadius: 20, border: "1px solid #F1F5F9",
      boxShadow: "0 2px 16px rgba(0,0,0,0.06)", overflow: "hidden",
      opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(16px)",
      transition: "opacity .5s ease, transform .5s ease",
    }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F8FAFC", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color, fontSize: 13 }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{title}</div>
            {sub && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>{sub}</div>}
          </div>
        </div>
        {action}
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function CashierDashboard() {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [date,       setDate]       = useState(todayStr());
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await cashierFetch(`${API_BASE}/cashier/dashboard?date=${date}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data);
      setLastUpdate(new Date().toLocaleTimeString("en-IN"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  /* Auto-refresh every 60s */
  useEffect(() => {
    const t = setInterval(fetchDashboard, 60000);
    return () => clearInterval(t);
  }, [fetchDashboard]);

  const kpis    = data?.kpis    || {};
  const changes = data?.changes || {};
  const maxQty  = data?.top_products?.[0]?.qty || 1;

  return (
    <div style={{ minHeight: "100%", background: "#F8FAFC", padding: "20px 24px", fontFamily: "'DM Sans', system-ui, sans-serif", color: "#0F172A" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg, #6366F1, #818CF8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FaChartBar style={{ color: "#fff", fontSize: 18 }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.5px" }}>Cashier Dashboard</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", animation: "pulse-dot 2s infinite" }} />
                <span style={{ fontSize: 11, color: "#94A3B8" }}>{lastUpdate ? `Updated ${lastUpdate} · auto-refreshes every 60s` : "Loading…"}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="date" value={date}
            onChange={e => setDate(e.target.value)}
            style={{ height: 38, borderRadius: 10, border: "1px solid #E2E8F0", padding: "0 12px", fontSize: 13, fontWeight: 600, color: "#475569", outline: "none", background: "#fff" }}
          />
          <button onClick={fetchDashboard} disabled={loading}
            style={{
              height: 38, display: "flex", alignItems: "center", gap: 7,
              padding: "0 16px", borderRadius: 10, border: "1px solid #E2E8F0",
              background: "#fff", color: "#6366F1", fontSize: 12, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
            }}>
            <FaSyncAlt style={{ fontSize: 11, animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", fontSize: 13, marginBottom: 20 }}>
          ⚠ {error} — check backend is running
        </div>
      )}

      {loading && !data ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#94A3B8" }}>
          <FaShoppingCart style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }} />
          <div style={{ fontSize: 14 }}>Loading dashboard…</div>
        </div>
      ) : data && (
        <>
          {/* ── KPI Grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
            <KpiCard label="Net Revenue"    value={fmtV(kpis.net_revenue)}   sub={`${fmtN(kpis.sale_count)} bills`}     icon={<FaRupeeSign />}      color="#6366F1" change={changes.net_revenue}  delay={0}   />
            <KpiCard label="Gross Sales"    value={fmtV(kpis.gross_revenue)} sub="before returns"                        icon={<FaShoppingCart />}   color="#10B981" change={changes.sale_count}   delay={60}  />
            <KpiCard label="Returns"        value={fmtV(kpis.return_amount)} sub={`${fmtN(kpis.return_count)} returns`} icon={<FaUndo />}           color="#EF4444" change={null}                delay={120} />
            <KpiCard label="Items Sold"     value={fmtN(kpis.items_sold)}    sub="units across all bills"               icon={<FaBoxOpen />}        color="#F59E0B" change={changes.items_sold}   delay={180} />
            <KpiCard label="Average Bill"   value={fmtV(kpis.avg_bill)}      sub="per transaction"                      icon={<FaReceipt />}        color="#06B6D4" change={changes.avg_bill}     delay={240} />
            <KpiCard label="Total GST"      value={fmtV(kpis.total_gst)}     sub="collected today"                      icon={<FaChartBar />}       color="#8B5CF6" change={null}                delay={300} />
          </div>

          {/* ── Row 2: Hourly + Payment ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, marginBottom: 16 }}>

            <Panel title="Hourly Sales Trend" sub={`${date} · bar = bill count`} icon={<FaChartBar />} color="#6366F1" delay={150}>
              <HourlyChart data={data.hourly_trend} />
              {data.hourly_trend?.length > 0 && (
                <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                  {[
                    { label: "Peak Hour", val: data.hourly_trend.reduce((a, b) => b.revenue > a.revenue ? b : a, data.hourly_trend[0])?.hour || "—" },
                    { label: "Busiest",   val: `${data.hourly_trend.reduce((a, b) => b.count > a.count ? b : a, data.hourly_trend[0])?.count || 0} bills` },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ background: "#F8FAFC", borderRadius: 10, padding: "8px 14px" }}>
                      <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#6366F1", fontFamily: "monospace" }}>{val}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Payment Methods" sub="today's bill split" icon={<FaCreditCard />} color="#10B981" delay={200}>
              <PaymentDonut data={data.payment_breakdown} />

              {/* Summary pills */}
              <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                {[
                  { label: "Sales",   val: fmtN(kpis.sale_count),   color: "#6366F1", bg: "#EEF2FF" },
                  { label: "Returns", val: fmtN(kpis.return_count),  color: "#EF4444", bg: "#FEF2F2" },
                ].map(({ label, val, color, bg }) => (
                  <div key={label} style={{ flex: 1, background: bg, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color }}>{val}</div>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* ── Row 3: Top Products + Recent Bills + Leaderboard ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 280px", gap: 16 }}>

            {/* Top products */}
            <Panel title="Top Products" sub="by units sold today" icon={<FaBoxOpen />} color="#F59E0B" delay={250}>
              {data.top_products?.length > 0 ? (
                data.top_products.map((item, i) => (
                  <TopProductRow key={item.barcode} item={item} rank={i} maxQty={maxQty} />
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#CBD5E1", fontSize: 13 }}>
                  No sales yet today
                </div>
              )}
            </Panel>

            {/* Recent bills */}
            <Panel title="Recent Bills" sub="last 12 transactions" icon={<FaReceipt />} color="#06B6D4" delay={300}>
              {data.recent_bills?.length > 0 ? (
                data.recent_bills.map((bill, i) => <BillRow key={i} bill={bill} />)
              ) : (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#CBD5E1", fontSize: 13 }}>
                  No bills yet today
                </div>
              )}
            </Panel>

            {/* Cashier leaderboard */}
            <Panel title="Cashier Leaders" sub="revenue today" icon={<FaTrophy />} color="#8B5CF6" delay={350}>
              {data.cashier_leaderboard?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.cashier_leaderboard.map((cashier, i) => {
                    const medals = ["🥇","🥈","🥉"];
                    const maxRev = data.cashier_leaderboard[0].revenue || 1;
                    const pct    = (cashier.revenue / maxRev) * 100;
                    return (
                      <div key={cashier.name}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 14 }}>{medals[i] || "  "}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 24, height: 24, borderRadius: 7, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <FaUser style={{ color: "#6366F1", fontSize: 10 }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cashier.name}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#6366F1" }}>{fmtV(cashier.revenue)}</div>
                            <div style={{ fontSize: 9, color: "#94A3B8" }}>{cashier.bills} bills</div>
                          </div>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: "#F1F5F9", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: i === 0 ? "#F59E0B" : i === 1 ? "#94A3B8" : "#CD7F32", borderRadius: 2, transition: "width 1s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#CBD5E1", fontSize: 13 }}>
                  No cashier data yet
                </div>
              )}

              {/* Quick stats */}
              <div style={{ marginTop: 18, padding: "12px 14px", background: "#F8FAFC", borderRadius: 12 }}>
                <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Today's Totals</div>
                {[
                  { label: "Net Revenue", val: fmtV(kpis.net_revenue), color: "#6366F1" },
                  { label: "Total Bills",  val: fmtN(kpis.sale_count),  color: "#10B981" },
                  { label: "Avg Bill",     val: fmtV(kpis.avg_bill),    color: "#F59E0B" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#64748B" }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: "monospace" }}>{val}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}