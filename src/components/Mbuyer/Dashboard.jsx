import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";

const API_BASE = APP_API_URL;
const API = `${API_BASE}/mbuyer/dashboard`;

const money = (v) =>
  `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const URGENCY_COLOR = {
  "out-of-stock": "#EF4444",
  critical:       "#F97316",
  low:            "#EAB308",
};

/* ─── tiny helpers ─── */
function ago(isoStr) {
  if (!isoStr) return "—";
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 60000);
  if (diff < 60)  return `${diff}m ago`;
  if (diff < 1440)return `${Math.floor(diff/60)}h ago`;
  return `${Math.floor(diff/1440)}d ago`;
}

/* ─── KPI card ─── */
function KPI({ label, value, sub, color, icon, alert }) {
  return (
    <div style={{
      flex: "1 1 150px", minWidth: 140,
      background: "#fff",
      borderRadius: 18,
      padding: "18px 20px",
      border: `1px solid ${alert ? "#FECACA" : "#E4EAF3"}`,
      borderTop: `4px solid ${color}`,
      boxShadow: alert
        ? "0 4px 20px rgba(239,68,68,0.10)"
        : "0 2px 10px rgba(15,27,45,0.05)",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 14, right: 16,
        fontSize: 26, opacity: 0.12, color,
      }}>{icon}</div>
      <div style={{
        fontSize: 28, fontWeight: 800, color,
        fontFamily: "'DM Mono',monospace", lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#64748B",
        marginTop: 6, textTransform: "uppercase", letterSpacing: "0.07em",
      }}>{label}</div>
      {sub && (
        <div style={{ fontSize: 11, color: alert ? "#EF4444" : "#94A3B8", marginTop: 3, fontWeight: 500 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ─── Section header ─── */
function SectionHead({ title, sub }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0F1B2D" }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ─── Card wrapper ─── */
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      border: "1px solid #E4EAF3", padding: "20px",
      boxShadow: "0 2px 12px rgba(15,27,45,0.05)",
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ─── Donut chart (pure CSS/SVG) ─── */
function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return (
    <div style={{ textAlign: "center", padding: 32, color: "#94A3B8", fontSize: 13 }}>No POs yet</div>
  );

  const size = 160, cx = 80, cy = 80, r = 60, stroke = 22;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map(d => {
    const pct  = d.count / total;
    const dash = pct * circumference;
    const gap  = circumference - dash;
    const slice = { ...d, dash, gap, offset, pct };
    offset += dash;
    return slice;
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <circle key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 0.5s" }}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle"
          style={{ fontSize: 22, fontWeight: 800, fill: "#0F1B2D", fontFamily: "'DM Mono',monospace" }}>
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle"
          style={{ fontSize: 9, fill: "#94A3B8", fontWeight: 700, letterSpacing: "0.1em" }}>
          TOTAL POs
        </text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 140 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }}/>
            <span style={{ fontSize: 12, color: "#475569", flex: 1, fontWeight: 500 }}>{s.status}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0F1B2D", fontFamily: "'DM Mono',monospace" }}>
              {s.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Bar chart (SVG) ─── */
function BarChart({ data, valueKey, labelKey, color = "#6366F1", prefix = "₹" }) {
  if (!data || data.length === 0) return (
    <div style={{ textAlign: "center", padding: 32, color: "#94A3B8", fontSize: 13 }}>No data yet</div>
  );

  const maxVal = Math.max(...data.map(d => d[valueKey]), 1);
  const W = 100, H = 80, barW = Math.floor(W / data.length) - 2;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 20}`} width="100%" style={{ overflow: "visible" }}>
        {data.map((d, i) => {
          const barH = Math.max((d[valueKey] / maxVal) * H, 2);
          const x    = i * (W / data.length) + 1;
          const y    = H - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH}
                rx={2} fill={color} opacity={0.85}
                style={{ transition: "height 0.5s, y 0.5s" }}/>
              <text x={x + barW / 2} y={H + 14} textAnchor="middle"
                style={{ fontSize: 5, fill: "#94A3B8", fontFamily: "sans-serif" }}>
                {String(d[labelKey]).slice(0, 7)}
              </text>
              {d[valueKey] > 0 && (
                <title>{d[labelKey]}: {prefix}{Number(d[valueKey]).toLocaleString("en-IN")}</title>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Pill badge ─── */
function Pill({ label, color = "#6366F1", bg }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 99,
      fontSize: 10, fontWeight: 700,
      color, background: bg || color + "18",
      border: `1px solid ${color}33`,
    }}>{label}</span>
  );
}

/* ─── Activity row ─── */
function ActivityRow({ icon, title, sub, right, alert }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "10px 0", borderBottom: "1px solid #F1F5F9",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: alert ? "#FEF2F2" : "#F0F9FF",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0F1B2D",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{sub}</div>
      </div>
      {right && (
        <div style={{ fontSize: 11, color: alert ? "#EF4444" : "#64748B",
          fontWeight: 700, flexShrink: 0, textAlign: "right" }}>
          {right}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
══════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchDashboard = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem("admin_token");
    if (!token) {
      setError("Not logged in. Please sign in again.");
      setLoading(false);
      return;
    }

    const res = await axios.get(API, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setData(res.data);
  } catch (e) {
    if (e.response?.status === 401) {
      setError("Session expired. Please log in again.");
    } else if (e.response?.status === 403) {
      setError("HQ access only — this account doesn't have permission.");
    } else {
      setError("Failed to load dashboard. Check backend connection.");
    }
  } finally {
    setLoading(false);
  }
}, []);
  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      height: "100%", minHeight: 300, flexDirection: "column", gap: 16,
      fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div style={{
        width: 40, height: 40, border: "3px solid #E4EAF3",
        borderTop: "3px solid #6366F1", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: "#94A3B8", fontSize: 14 }}>Loading dashboard…</p>
    </div>
  );

  if (error) return (
    <div style={{ padding: 32, textAlign: "center", color: "#EF4444", fontSize: 14,
      fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      {error}
      <br/>
      <button onClick={fetchDashboard}
        style={{ marginTop: 12, padding: "8px 18px", borderRadius: 10,
          background: "#6366F1", color: "#fff", border: "none", cursor: "pointer",
          fontSize: 13, fontWeight: 600 }}>
        Retry
      </button>
    </div>
  );

  const { kpis, status_dist, monthly_value, division_spend,
          top_vendors, needs_review, overdue_pos,
          pending_vendors, low_stock } = data;

  return (
    <div style={{ padding: 24, fontFamily: "'Plus Jakarta Sans',sans-serif",
      minHeight: "100%", background: "transparent" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F1B2D" }}>
            Buyer Dashboard
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748B" }}>
            {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
          </p>
        </div>
        <button onClick={fetchDashboard}
          style={{ padding: "8px 16px", borderRadius: 10, background: "#F1F5F9",
            border: "1px solid #E4EAF3", color: "#475569", fontSize: 13,
            fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          ↻ Refresh
        </button>
      </div>

      {/* ── Alert banners ── */}
      {kpis.overdue_pos > 0 && (
        <div style={{ marginBottom: 14, padding: "11px 16px", borderRadius: 10,
          background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 13,
          color: "#991B1B", fontWeight: 500 }}>
          🔴 <b>{kpis.overdue_pos} PO(s) are past due date.</b> Go to <b>Open PO Tracker</b> for details.
        </div>
      )}
      {kpis.needs_review > 0 && (
        <div style={{ marginBottom: 14, padding: "11px 16px", borderRadius: 10,
          background: "#F5F3FF", border: "1px solid #DDD6FE", fontSize: 13,
          color: "#4C1D95", fontWeight: 500 }}>
          ⏳ <b>{kpis.needs_review} PO(s)</b> submitted by vendors are waiting for your review.
        </div>
      )}

      {/* ── KPI Row ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <KPI label="Active POs"       value={kpis.active_pos}
          color="#6366F1" icon="📋" />
        <KPI label="Needs Review"     value={kpis.needs_review}
          color="#7C3AED" icon="👁" alert={kpis.needs_review > 0}
          sub={kpis.needs_review > 0 ? "Vendor submitted — action required" : "All clear"} />
        <KPI label="Overdue POs"      value={kpis.overdue_pos}
          color="#EF4444" icon="⏰" alert={kpis.overdue_pos > 0}
          sub={kpis.overdue_pos > 0 ? "Past due date" : "None overdue"} />
        <KPI label="Pending Vendors"  value={kpis.pending_vendors}
          color="#F97316" icon="🏪" alert={kpis.pending_vendors > 0}
          sub={kpis.pending_vendors > 0 ? "Awaiting approval" : "None pending"} />
        <KPI label="This Month POs"   value={money(kpis.month_po_value)}
          color="#0EA5E9" icon="📅" />
        <KPI label="OTB Remaining"
          value={kpis.otb_set ? money(kpis.otb_remaining) : "Not set"}
          color={!kpis.otb_set ? "#94A3B8" : kpis.otb_remaining < 0 ? "#EF4444" : "#22C55E"}
          icon="💰"
          alert={kpis.otb_remaining < 0 && kpis.otb_set}
          sub={!kpis.otb_set ? "Set budgets in Budget & OTB" :
               kpis.otb_remaining < 0 ? "Over budget!" : "Open to buy"} />
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>

        {/* PO Status Donut */}
        <Card>
          <SectionHead title="PO Status Distribution" sub="All purchase orders by current status"/>
          <DonutChart data={status_dist}/>
        </Card>

        {/* Monthly PO Value */}
        <Card>
          <SectionHead title="Monthly PO Value" sub="Last 6 months — total order value"/>
          <BarChart data={monthly_value} valueKey="value" labelKey="month" color="#6366F1"/>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8,
            fontSize: 11, color: "#94A3B8" }}>
            {monthly_value.map((m, i) => (
              <span key={i} style={{ fontWeight: 600 }}>
                {m.value > 0 ? money(m.value) : "—"}
              </span>
            ))}
          </div>
        </Card>

        {/* Division Spend */}
        <Card>
          <SectionHead title="Division-wise Spend" sub="Committed PO value by division"/>
          {division_spend.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "#94A3B8", fontSize: 13 }}>
              No division data yet
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {division_spend.map((d, i) => {
                const maxVal = division_spend[0].value || 1;
                const pct    = (d.value / maxVal) * 100;
                const colors = ["#6366F1","#0EA5E9","#10B981","#F97316","#7C3AED","#EAB308","#EF4444","#22C55E"];
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between",
                      fontSize: 12, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, color: "#3D5166" }}>{d.division}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700,
                        color: "#0F1B2D" }}>{money(d.value)}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: "#F1F5F9", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%",
                        background: colors[i % colors.length], borderRadius: 99,
                        transition: "width 0.6s" }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Bottom grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Needs Review */}
          <Card>
            <SectionHead title="⏳ Needs Your Review"
              sub="Vendor-submitted POs waiting for buyer action"/>
            {needs_review.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "#22C55E",
                fontSize: 13, fontWeight: 600 }}>
                ✓ All clear — no POs pending review
              </div>
            ) : needs_review.map((po, i) => (
              <ActivityRow key={i}
                icon="📄"
                title={`${po.orderNo} — ${po.vendorName}`}
                sub={`${money(po.value)} · Submitted ${ago(po.updatedAt)}`}
                right={po.daysWaiting > 3
                  ? <span style={{ color: "#EF4444" }}>{po.daysWaiting}d waiting!</span>
                  : <span style={{ color: "#7C3AED" }}>{po.daysWaiting}d</span>}
                alert={po.daysWaiting > 3}
              />
            ))}
          </Card>

          {/* Overdue POs */}
          {overdue_pos.length > 0 && (
            <Card>
              <SectionHead title="🔴 Overdue POs"
                sub="Active POs past their expected delivery date"/>
              {overdue_pos.map((po, i) => (
                <ActivityRow key={i}
                  icon="⚠️"
                  title={`${po.orderNo} — ${po.vendorName}`}
                  sub={`${money(po.value)} · Due: ${po.dueDate} · ${po.status}`}
                  right={<span style={{ color: "#EF4444" }}>{po.daysOverdue}d overdue</span>}
                  alert
                />
              ))}
            </Card>
          )}

          {/* Top Vendors */}
          <Card>
            <SectionHead title="🏆 Top Vendors by PO Value"/>
            {top_vendors.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "#94A3B8", fontSize: 13 }}>
                No vendor data yet
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #F1F5F9" }}>
                    {["#","Vendor","POs","Total Value"].map(h => (
                      <th key={h} style={{ padding: "6px 8px", textAlign: "left",
                        fontSize: 10, fontWeight: 700, color: "#94A3B8",
                        textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {top_vendors.map((v, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F8FAFD" }}>
                      <td style={{ padding: "8px", fontSize: 12, fontWeight: 800,
                        color: i === 0 ? "#F59E0B" : i === 1 ? "#94A3B8" : "#CD7C4E" }}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}`}
                      </td>
                      <td style={{ padding: "8px", fontWeight: 600, color: "#0F1B2D",
                        maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.vendorName}
                      </td>
                      <td style={{ padding: "8px", color: "#64748B", textAlign: "center" }}>
                        {v.po_count}
                      </td>
                      <td style={{ padding: "8px", fontWeight: 700, color: "#6366F1",
                        fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>
                        {money(v.total_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Pending Vendors */}
          <Card>
            <SectionHead title="🏪 Pending Vendor Approvals"
              sub="New registrations awaiting your action"/>
            {pending_vendors.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "#22C55E",
                fontSize: 13, fontWeight: 600 }}>
                ✓ No pending approvals
              </div>
            ) : pending_vendors.map((v, i) => (
              <ActivityRow key={i}
                icon="🏪"
                title={v.name || "Unknown Vendor"}
                sub={`${v.email || v.mobile || "No contact"} · ${ago(v.createdAt)}`}
                right={
                  <Pill label={v.source === "walkin_po_self_register" ? "Walk-in" : "Direct"}
                    color={v.source === "walkin_po_self_register" ? "#F97316" : "#6366F1"}/>
                }
                alert
              />
            ))}
          </Card>

          {/* Low Stock */}
          <Card>
            <SectionHead title="📦 Low Stock Alerts"
              sub="Top 5 products below reorder level"/>
            {low_stock.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "#22C55E",
                fontSize: 13, fontWeight: 600 }}>
                ✓ All products adequately stocked
              </div>
            ) : low_stock.map((item, i) => (
              <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", alignItems: "center",
                  justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0F1B2D",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: "60%" }}>
                    {item.productName || item.barcode || "—"}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                    color: URGENCY_COLOR[item.urgency] || "#EAB308",
                    background: (URGENCY_COLOR[item.urgency] || "#EAB308") + "18",
                    border: `1px solid ${(URGENCY_COLOR[item.urgency] || "#EAB308")}33`,
                  }}>
                    {item.urgency === "out-of-stock" ? "Out of Stock"
                     : item.urgency === "critical" ? "Critical" : "Low"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 99, background: "#F1F5F9" }}>
                    <div style={{
                      width: `${Math.min((item.stockQty / item.reorderLevel) * 100, 100)}%`,
                      height: "100%", borderRadius: 99,
                      background: URGENCY_COLOR[item.urgency] || "#EAB308",
                      transition: "width 0.5s",
                    }}/>
                  </div>
                  <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: "'DM Mono',monospace",
                    whiteSpace: "nowrap" }}>
                    {item.stockQty}/{item.reorderLevel}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>
                  Shortfall: <b style={{ color: URGENCY_COLOR[item.urgency] }}>{item.shortfall}</b> units
                </div>
              </div>
            ))}
          </Card>

          {/* Quick Links */}
          <Card>
            <SectionHead title="⚡ Quick Actions"/>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Review Submitted POs",  icon: "📄", color: "#7C3AED", count: kpis.needs_review,   key: "order-details" },
                { label: "Open PO Tracker",       icon: "📊", color: "#6366F1", count: kpis.active_pos,    key: "open-po-tracker" },
                { label: "Approve Vendors",       icon: "✅", color: "#F97316", count: kpis.pending_vendors,key: "vendorlist" },
                { label: "View Reorder Alerts",   icon: "📦", color: "#EF4444", count: low_stock.length,   key: "reorder-alerts" },
                { label: "Variance Log",          icon: "⚠️", color: "#F59E0B", count: null,              key: "variance-log" },
                { label: "Budget & OTB",          icon: "💰", color: "#22C55E", count: null,              key: "budget-otb" },
              ].map(({ label, icon, color, count, key }) => (
                <div key={key} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 12,
                  background: "#F8FAFD", border: "1px solid #E4EAF3",
                  cursor: "pointer", transition: "all 0.15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = color + "0F"}
                  onMouseLeave={e => e.currentTarget.style.background = "#F8FAFD"}
                >
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#3D5166" }}>{label}</span>
                  {count !== null && count > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 99,
                      background: color, color: "#fff", minWidth: 22, textAlign: "center",
                    }}>{count}</span>
                  )}
                  <span style={{ color: "#CBD5E1", fontSize: 14 }}>›</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}