import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";

const API = `${APP_API_URL}/mbuyer/vendor-performance`;
const money = (v) => `₹${Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`;
const pct   = (v) => v!=null ? `${v}%` : "—";

const RATING = {
  Excellent: { bg:"#F0FDF4", text:"#166534", border:"#BBF7D0" },
  Good:      { bg:"#EFF6FF", text:"#1E40AF", border:"#BFDBFE" },
  Average:   { bg:"#FEFCE8", text:"#854D0E", border:"#FEF08A" },
  Poor:      { bg:"#FEF2F2", text:"#991B1B", border:"#FECACA" },
};

function ScoreBar({ score }) {
  const color = score>=80?"#22C55E": score>=60?"#6366F1": score>=40?"#EAB308":"#EF4444";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height:6, borderRadius:99, background:"#F1F5F9", overflow:"hidden" }}>
        <div style={{ width:`${Math.min(score,100)}%`, height:"100%", background:color, borderRadius:99, transition:"width 0.5s" }}/>
      </div>
      <span style={{ fontSize:12, fontWeight:700, color, minWidth:32, fontFamily:"'DM Mono',monospace" }}>{score}</span>
    </div>
  );
}

function RatingBadge({ rating }) {
  const cfg = RATING[rating] || RATING.Average;
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:99, background:cfg.bg, color:cfg.text, border:`1px solid ${cfg.border}` }}>
      {rating}
    </span>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ flex:1, minWidth:110, padding:"14px 16px", borderRadius:14, background:"#fff", border:"1px solid #E4EAF3", boxShadow:"0 1px 4px rgba(15,27,45,0.05)" }}>
      <div style={{ fontSize:22, fontWeight:800, color, fontFamily:"'DM Mono',monospace" }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:600, color:"#64748B", marginTop:2, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
    </div>
  );
}

export default function VendorPerformance() {
  const [data,    setData]    = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [sortBy,  setSortBy]  = useState("total_value");
  const [expanded,setExpanded]= useState(null);

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await axios.get(API, { params:{ sort_by:sortBy, search:search||undefined } });
      setData(res.data.data || []);
      setSummary(res.data.summary || {});
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [sortBy, search]);

  return (
    <div style={{ padding:"24px", fontFamily:"'Plus Jakarta Sans',sans-serif", minHeight:"100%" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>

      <div style={{ marginBottom:24 }}>
        <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:"#0F1B2D" }}>Vendor Performance</h2>
        <p style={{ margin:"4px 0 0", fontSize:13, color:"#64748B" }}>Scorecards computed from POs, GRCs and GRNs</p>
      </div>

      {/* Summary */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
        <SummaryCard label="Total Vendors" value={summary.total_vendors||0}    color="#6366F1"/>
        <SummaryCard label="Excellent"     value={summary.excellent||0}        color="#22C55E"/>
        <SummaryCard label="Good"          value={summary.good||0}             color="#6366F1"/>
        <SummaryCard label="Average"       value={summary.average||0}          color="#EAB308"/>
        <SummaryCard label="Poor"          value={summary.poor||0}             color="#EF4444"/>
        <SummaryCard label="Total PO Value"value={money(summary.total_po_value)} color="#0EA5E9"/>
        <SummaryCard label="Avg Fulfilment"value={pct(summary.avg_fulfillment)} color="#10B981"/>
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendor…"
          style={{ flex:1, minWidth:180, padding:"8px 14px", borderRadius:10, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none" }}/>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
          style={{ padding:"8px 12px", borderRadius:10, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none", background:"#fff" }}>
          <option value="total_value">Sort: PO Value</option>
          <option value="score">Sort: Overall Score</option>
          <option value="fulfillment">Sort: Fulfilment %</option>
          <option value="on_time">Sort: On-Time %</option>
          <option value="variance">Sort: Variance Items</option>
        </select>
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{ textAlign:"center", padding:64, color:"#94A3B8" }}>Loading…</div>
      ) : data.length === 0 ? (
        <div style={{ textAlign:"center", padding:64, color:"#94A3B8" }}>No vendor data found</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {data.map((v, i) => {
            const isOpen = expanded === i;
            return (
              <div key={i} style={{ background:"#fff", borderRadius:16, border:"1px solid #E4EAF3", overflow:"hidden", boxShadow:"0 2px 8px rgba(15,27,45,0.05)" }}>
                {/* Main row */}
                <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:12, padding:"16px 20px", cursor:"pointer" }}
                  onClick={() => setExpanded(isOpen ? null : i)}>
                  {/* Name + rating */}
                  <div style={{ flex:"1 1 180px", minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:"#0F1B2D", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.vendorName}</div>
                    <div style={{ marginTop:4, display:"flex", alignItems:"center", gap:8 }}>
                      <RatingBadge rating={v.rating}/>
                      <span style={{ fontSize:11, color:"#94A3B8" }}>{v.total_pos} POs</span>
                      {v.blocked_items > 0 && <span style={{ fontSize:11, color:"#EF4444", fontWeight:700 }}>⚠ {v.blocked_items} blocked</span>}
                    </div>
                  </div>

                  {/* Score bar */}
                  <div style={{ flex:"0 0 160px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Overall Score</div>
                    <ScoreBar score={v.overall_score}/>
                  </div>

                  {/* Stats */}
                  {[
                    ["Fulfilment",  pct(v.fulfillment_pct), v.fulfillment_pct>=80?"#22C55E":v.fulfillment_pct>=60?"#EAB308":"#EF4444"],
                    ["On-Time",     pct(v.on_time_pct),     v.on_time_pct==null?"#94A3B8":v.on_time_pct>=80?"#22C55E":v.on_time_pct>=60?"#EAB308":"#EF4444"],
                    ["PO Value",    money(v.total_po_value), "#6366F1"],
                    ["Variance ₹",  money(v.total_variance_amt), v.total_variance_amt>0?"#F97316":"#22C55E"],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ flex:"0 0 90px", textAlign:"center" }}>
                      <div style={{ fontSize:14, fontWeight:800, color, fontFamily:"'DM Mono',monospace" }}>{val}</div>
                      <div style={{ fontSize:10, fontWeight:600, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.05em", marginTop:2 }}>{label}</div>
                    </div>
                  ))}

                  <div style={{ color:"#CBD5E1", fontSize:16 }}>{isOpen?"▲":"▼"}</div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop:"1px solid #F1F5F9", padding:"16px 20px", background:"#FAFBFD" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12 }}>
                      {[
                        ["Total POs",          v.total_pos,              "#6366F1"],
                        ["Completed POs",       v.completed_pos,          "#22C55E"],
                        ["Active POs",          v.active_pos,             "#0EA5E9"],
                        ["Cancelled POs",       v.cancelled_pos,          "#EF4444"],
                        ["Ordered Qty",         v.total_ordered_qty,      "#7C3AED"],
                        ["Received Qty",        v.total_received_qty,     "#10B981"],
                        ["On-Time Deliveries",  v.on_time_count,          "#22C55E"],
                        ["Late Deliveries",     v.late_count,             "#EF4444"],
                        ["Variance Items",      v.variance_items,         "#F97316"],
                        ["Blocked Items",       v.blocked_items,          "#EF4444"],
                      ].map(([label, val, color]) => (
                        <div key={label} style={{ background:"#fff", borderRadius:10, padding:"12px 14px", border:"1px solid #E4EAF3" }}>
                          <div style={{ fontSize:18, fontWeight:800, color, fontFamily:"'DM Mono',monospace" }}>{val}</div>
                          <div style={{ fontSize:10, fontWeight:600, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.05em", marginTop:2 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    {v.divisions.length > 0 && (
                      <div style={{ marginTop:12, fontSize:12, color:"#64748B" }}>
                        <b>Divisions:</b> {v.divisions.join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}