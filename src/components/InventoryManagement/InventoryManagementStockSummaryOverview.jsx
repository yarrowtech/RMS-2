import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useEffect, useState, useCallback } from "react";
import {
  FaBoxes, FaSyncAlt, FaExclamationTriangle, FaArrowUp,
  FaArrowDown, FaWarehouse, FaChartBar, FaTruck,
  FaExchangeAlt, FaFire, FaSnowflake,
} from "react-icons/fa";

const API_BASE = `${APP_API_URL}`;

/* ─── Formatting ─── */
const fmt  = (n) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmtV = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtV2= (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ─── Sparkline mini bar ─── */
function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 1s ease" }} />
    </div>
  );
}

/* ─── KPI Card ─── */
function KpiCard({ label, value, sub, icon, accent, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div style={{
      background: "linear-gradient(135deg, #0F1923 0%, #111D28 100%)",
      border: `1px solid ${accent}30`,
      borderRadius: 16,
      padding: "20px 22px",
      position: "relative",
      overflow: "hidden",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 0.5s ease, transform 0.5s ease",
    }}>
      {/* Accent glow */}
      <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, borderRadius: "0 16px 0 80px", background: `${accent}12` }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#4A6070", textTransform: "uppercase", letterSpacing: "1.2px" }}>{label}</div>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}20`, border: `1px solid ${accent}40`, display: "flex", alignItems: "center", justifyContent: "center", color: accent, fontSize: 13 }}>
          {icon}
        </div>
      </div>

      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: "#F0F4F8", letterSpacing: "-1px", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "#4A6070", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

/* ─── Division Bar Chart ─── */
function DivisionChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const colors = ["#00D4FF","#7C3AED","#059669","#D97706","#DC2626","#EC4899","#3B82F6","#F59E0B","#10B981","#8B5CF6"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.slice(0, 8).map((item, i) => (
        <div key={item.division} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: "#8097A8", width: 110, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.division}>
            {item.division}
          </div>
          <MiniBar value={item.value} max={max} color={colors[i % colors.length]} />
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#F0F4F8", fontWeight: 600, width: 80, textAlign: "right", flexShrink: 0 }}>
            {fmtV(item.value)}
          </div>
          <div style={{ fontSize: 10, color: "#4A6070", width: 28, textAlign: "right", flexShrink: 0 }}>{item.count}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Donut Chart (SVG) ─── */
function DonutChart({ data }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const segments = [
    { key: "admin",  label: "Admin",  color: "#3B82F6" },
    { key: "vendor", label: "Vendor", color: "#10B981" },
    { key: "grn",    label: "GRN",    color: "#F59E0B" },
  ];

  let cumulativePct = 0;
  const r = 40, cx = 56, cy = 56, stroke = 14;
  const circumference = 2 * Math.PI * r;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <svg width={112} height={112} style={{ flexShrink: 0 }}>
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1E2D3A" strokeWidth={stroke} />
        {segments.map(seg => {
          const value = data[seg.key] || 0;
          const pct   = value / total;
          const dash  = pct * circumference;
          const gap   = circumference - dash;
          const offset= circumference * (1 - cumulativePct);
          cumulativePct += pct;
          return (
            <circle key={seg.key} cx={cx} cy={cy} r={r} fill="none"
              stroke={seg.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px`, transition: "stroke-dasharray 1s ease" }}
            />
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#F0F4F8" fontSize={16} fontWeight={800} fontFamily="monospace">{fmt(total)}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#4A6070" fontSize={9} fontFamily="sans-serif">SKUs</text>
      </svg>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {segments.map(seg => {
          const value = data[seg.key] || 0;
          const pct   = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
          return (
            <div key={seg.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: "#8097A8" }}>{seg.label}</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: seg.color, marginLeft: "auto" }}>{value}</div>
              <div style={{ fontSize: 10, color: "#4A6070" }}>{pct}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Movement Row ─── */
function MovementRow({ item }) {
  const cfg = {
    GRN:        { color: "#10B981", bg: "#10B98115", icon: <FaTruck style={{ fontSize: 10 }} /> },
    Adjustment: { color: "#F59E0B", bg: "#F59E0B15", icon: <FaExchangeAlt style={{ fontSize: 10 }} /> },
    Damage:     { color: "#EF4444", bg: "#EF444415", icon: <FaExclamationTriangle style={{ fontSize: 10 }} /> },
    Return:     { color: "#3B82F6", bg: "#3B82F615", icon: <FaSyncAlt style={{ fontSize: 10 }} /> },
  }[item.type] || { color: "#8097A8", bg: "#8097A815", icon: null };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #0F1923" }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}30`, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color, flexShrink: 0 }}>
        {cfg.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D8E4", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.ref}</div>
        <div style={{ fontSize: 10, color: "#4A6070", marginTop: 1 }}>{item.date} {item.vendor ? `· ${item.vendor}` : ""}</div>
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: item.qty >= 0 ? "#10B981" : "#EF4444", flexShrink: 0 }}>
        {item.qty >= 0 ? `+${fmt(item.qty)}` : fmt(item.qty)}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>
        {item.type}
      </div>
    </div>
  );
}

/* ─── Alert Row ─── */
function AlertRow({ item, type }) {
  const isLow = type === "low";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #0F1923" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D8E4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.product}</div>
        <div style={{ fontSize: 10, color: "#4A6070", fontFamily: "monospace", marginTop: 1 }}>{item.sku || item.barcode} · {item.division || "—"}</div>
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 800, color: isLow ? "#F59E0B" : "#EF4444", flexShrink: 0 }}>
        {isLow ? fmt(item.qty) : "0"}
      </div>
    </div>
  );
}

/* ─── Top Value Row ─── */
function TopValueRow({ item, rank, max }) {
  const pct = max > 0 ? (item.value / max) * 100 : 0;
  const rankColors = ["#FFD700","#C0C0C0","#CD7F32","#4A6070","#4A6070"];
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #0F1923" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: `${rankColors[rank]}20`, border: `1px solid ${rankColors[rank]}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: rankColors[rank], flexShrink: 0 }}>
          {rank + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D8E4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.product}</div>
          <div style={{ fontSize: 10, color: "#4A6070", fontFamily: "monospace", marginTop: 1 }}>{item.sku || item.barcode}</div>
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#00D4FF", flexShrink: 0 }}>{fmtV(item.value)}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: "#1E2D3A", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #00D4FF, #7C3AED)", borderRadius: 2, transition: "width 1s ease" }} />
        </div>
        <div style={{ fontSize: 10, color: "#4A6070", flexShrink: 0 }}>{fmt(item.qty)} units</div>
      </div>
    </div>
  );
}

/* ─── Panel wrapper ─── */
function Panel({ title, sub, icon, children, accent = "#00D4FF", delay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div style={{
      background: "linear-gradient(135deg, #0C1520 0%, #0F1923 100%)",
      border: `1px solid #1E2D3A`,
      borderRadius: 16, overflow: "hidden",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(16px)",
      transition: "opacity 0.5s ease, transform 0.5s ease",
    }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #1E2D3A", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${accent}20`, border: `1px solid ${accent}40`, display: "flex", alignItems: "center", justifyContent: "center", color: accent, fontSize: 12, flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#C8D8E4", letterSpacing: "0.3px" }}>{title}</div>
          {sub && <div style={{ fontSize: 10, color: "#4A6070", marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function InventoryDashboard() {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [lastUpdate,setLastUpdate]= useState(null);

 const fetchDashboard = useCallback(async () => {
  setLoading(true); setError(null);
  try {
    const token = localStorage.getItem("admin_token");
    const res = await fetch(`${API_BASE}/inventory/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    setData(json.data);
    setLastUpdate(new Date().toLocaleTimeString("en-IN"));
  } catch (e) {
    setError(e.message);
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const kpis    = data?.kpis || {};
  const topMax  = data?.top_value_items?.[0]?.value || 1;

  return (
    <div style={{
      minHeight: "100%",
      background: "#080E16",
      padding: "20px 24px",
      fontFamily: "'Syne', 'DM Sans', system-ui, sans-serif",
      color: "#F0F4F8",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1E2D3A; border-radius: 4px; }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg, #00D4FF20, #7C3AED20)",
            border: "1px solid #00D4FF30",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FaWarehouse style={{ color: "#00D4FF", fontSize: 18 }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#F0F4F8", letterSpacing: "-0.5px" }}>
              Inventory Command Centre
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", animation: "pulse-dot 2s infinite" }} />
              <span style={{ fontSize: 11, color: "#4A6070" }}>
                {lastUpdate ? `Last updated ${lastUpdate}` : "Loading…"}
              </span>
            </div>
          </div>
        </div>

        <button onClick={fetchDashboard} disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 18px", borderRadius: 10, border: "1px solid #1E2D3A",
            background: "#0F1923", color: "#00D4FF", fontSize: 12, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
          }}>
          <FaSyncAlt style={{ fontSize: 11, animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#EF444415", border: "1px solid #EF444430", color: "#EF4444", fontSize: 13, marginBottom: 20 }}>
          ⚠ {error} — check that backend is running
        </div>
      )}

      {loading && !data ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#4A6070" }}>
          <FaWarehouse style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }} />
          <div style={{ fontSize: 14 }}>Loading inventory data…</div>
        </div>
      ) : data && (
        <>
          {/* ── KPI Grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12, marginBottom: 20 }}>
            <KpiCard label="Total SKUs"        value={fmt(kpis.total_skus)}     sub="across all divisions"              icon={<FaBoxes />}             accent="#00D4FF" delay={0} />
            <KpiCard label="Stock Value"        value={fmtV(kpis.total_value)}   sub="at cost price"                     icon={<FaChartBar />}           accent="#7C3AED" delay={60} />
            <KpiCard label="In Stock"           value={fmt(kpis.in_stock)}       sub={`${fmt(kpis.low_stock)} low stock`} icon={<FaArrowUp />}           accent="#10B981" delay={120} />
            <KpiCard label="Out of Stock"       value={fmt(kpis.out_of_stock)}   sub="need restocking"                   icon={<FaSnowflake />}          accent="#EF4444" delay={180} />
            <KpiCard label="GRNs This Month"    value={fmt(kpis.grn_this_month)} sub="posted inward"                     icon={<FaTruck />}              accent="#F59E0B" delay={240} />
            <KpiCard label="Adjustments"        value={fmt(kpis.adj_this_month)} sub="this month"                        icon={<FaExchangeAlt />}         accent="#EC4899" delay={300} />
            <KpiCard label="Damage / Returns"   value={fmt(kpis.dmg_this_month)} sub="this month"                        icon={<FaExclamationTriangle />} accent="#F97316" delay={360} />
            <KpiCard label="Low Stock Alerts"   value={fmt(kpis.low_stock)}      sub="action required"                   icon={<FaFire />}               accent="#EAB308" delay={420} />
          </div>

          {/* ── Row 2: Charts ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginBottom: 16 }}>

            {/* Division value chart */}
            <Panel title="Stock Value by Division" sub="Top divisions · cost value" icon={<FaChartBar />} accent="#00D4FF" delay={200}>
              {data.division_chart?.length > 0
                ? <DivisionChart data={data.division_chart} />
                : <div style={{ color: "#4A6070", fontSize: 13 }}>No division data yet</div>
              }
            </Panel>

            {/* Source donut */}
            <Panel title="Stock by Source" sub="Admin · Vendor · GRN" icon={<FaBoxes />} accent="#7C3AED" delay={250}>
              <DonutChart data={data.source_breakdown || {}} />

              {/* Status pills */}
              <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
                {[
                  { label: "In Stock",  val: kpis.in_stock,    color: "#10B981" },
                  { label: "Low",       val: kpis.low_stock,   color: "#F59E0B" },
                  { label: "Out",       val: kpis.out_of_stock, color: "#EF4444" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ flex: 1, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color }}>{fmt(val)}</div>
                    <div style={{ fontSize: 10, color: "#4A6070", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* ── Row 3: Alerts + Movements + Top ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

            {/* Low stock alerts */}
            <Panel title="Low Stock Alerts" sub={`${data.low_stock_items?.length || 0} items need attention`} icon={<FaFire />} accent="#F59E0B" delay={300}>
              {data.low_stock_items?.length > 0 ? (
                <div>
                  {data.low_stock_items.map((item, i) => (
                    <AlertRow key={i} item={item} type="low" />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#4A6070" }}>
                  <FaArrowUp style={{ fontSize: 24, marginBottom: 8, color: "#10B981", opacity: 0.7 }} />
                  <div style={{ fontSize: 13 }}>All good — no low stock</div>
                </div>
              )}

              {/* Out of stock section */}
              {data.out_stock_items?.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#EF4444", textTransform: "uppercase", letterSpacing: "1px", margin: "16px 0 8px" }}>Out of Stock</div>
                  {data.out_stock_items.slice(0, 5).map((item, i) => (
                    <AlertRow key={i} item={item} type="out" />
                  ))}
                </>
              )}
            </Panel>

            {/* Recent movements */}
            <Panel title="Recent Movements" sub="GRN · Adjustments · Damage" icon={<FaExchangeAlt />} accent="#EC4899" delay={350}>
              {data.recent_movements?.length > 0 ? (
                data.recent_movements.map((item, i) => <MovementRow key={i} item={item} />)
              ) : (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#4A6070", fontSize: 13 }}>
                  No movements yet
                </div>
              )}
            </Panel>

            {/* Top value SKUs */}
            <Panel title="Top Value SKUs" sub="Highest inventory value" icon={<FaChartBar />} accent="#00D4FF" delay={400}>
              {data.top_value_items?.length > 0 ? (
                data.top_value_items.map((item, i) => (
                  <TopValueRow key={i} item={item} rank={i} max={topMax} />
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#4A6070", fontSize: 13 }}>
                  No inventory data yet
                </div>
              )}
            </Panel>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
