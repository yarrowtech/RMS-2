import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";

const API = `${APP_API_URL}/mbuyer/open-po-tracker`;

const URGENCY = {
  overdue:  { label: "Overdue",    bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444", border: "#FECACA" },
  critical: { label: "Due ≤ 2d",   bg: "#FFF7ED", text: "#9A3412", dot: "#F97316", border: "#FED7AA" },
  "due-soon":{ label: "Due ≤ 7d",  bg: "#FEFCE8", text: "#854D0E", dot: "#EAB308", border: "#FEF08A" },
  "on-track":{ label: "On Track",  bg: "#F0FDF4", text: "#166534", dot: "#22C55E", border: "#BBF7D0" },
  "no-date": { label: "No Date",   bg: "#F8FAFC", text: "#475569", dot: "#94A3B8", border: "#E2E8F0" },
};

const STATUS_COLOR = {
  Pending:         "#6366F1",
  SentToVendor:    "#0EA5E9",
  WalkinAccepted:  "#10B981",
  VendorSubmitted: "#7C3AED",
  Approved:        "#059669",
};

const money = (v) => `₹${Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`;

function UrgencyBadge({ urgency }) {
  const cfg = URGENCY[urgency] || URGENCY["no-date"];
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:5,
      padding:"3px 10px", borderRadius:99, fontSize:11, fontWeight:700,
      background:cfg.bg, color:cfg.text, border:`1px solid ${cfg.border}`,
    }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function SummaryCard({ label, value, color, onClick, active }) {
  return (
    <button onClick={onClick} style={{
      flex:1, minWidth:100, padding:"14px 16px", borderRadius:14,
      background: active ? color+"18" : "#fff",
      border:`1.5px solid ${active ? color : "#E4EAF3"}`,
      cursor:"pointer", textAlign:"left", transition:"all 0.15s",
    }}>
      <div style={{ fontSize:22, fontWeight:800, color, fontFamily:"'DM Mono',monospace" }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:600, color:"#64748B", marginTop:2, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
    </button>
  );
}

export default function OpenPOTracker() {
  const [data,    setData]    = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [urgencyF,setUrgencyF]= useState("");
  const [statusF, setStatusF] = useState("");
  const [search,  setSearch]  = useState("");

  const fetch = async () => {
    try {
      setLoading(true);
      const params = {};
      if (urgencyF) params.urgency_filter = urgencyF;
      if (statusF)  params.status_filter  = statusF;
      if (search)   params.search         = search;
      const res = await axios.get(API, { params });
      setData(res.data.data || []);
      setSummary(res.data.summary || {});
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [urgencyF, statusF, search]);

  const filtered = useMemo(() => data, [data]);

  return (
    <div style={{ padding:"24px", fontFamily:"'Plus Jakarta Sans',sans-serif", minHeight:"100%" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:"#0F1B2D" }}>Open PO Tracker</h2>
        <p style={{ margin:"4px 0 0", fontSize:13, color:"#64748B" }}>
          Monitor active purchase orders by urgency and follow-up status
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
        <SummaryCard label="Total Open"   value={summary.total||0}         color="#6366F1" onClick={()=>setUrgencyF("")}         active={!urgencyF} />
        <SummaryCard label="Overdue"      value={summary.overdue||0}       color="#EF4444" onClick={()=>setUrgencyF(u=>u==="overdue"?"":"overdue")}   active={urgencyF==="overdue"} />
        <SummaryCard label="Due ≤ 2 Days" value={summary.critical||0}      color="#F97316" onClick={()=>setUrgencyF(u=>u==="critical"?"":"critical")}  active={urgencyF==="critical"} />
        <SummaryCard label="Due This Week"value={summary.due_soon||0}      color="#EAB308" onClick={()=>setUrgencyF(u=>u==="due-soon"?"":"due-soon")}  active={urgencyF==="due-soon"} />
        <SummaryCard label="Needs Review" value={summary.needs_review||0}  color="#7C3AED" onClick={()=>{setUrgencyF(""); setStatusF(s=>s==="VendorSubmitted"?"":"VendorSubmitted");}} active={statusF==="VendorSubmitted"} />
        <SummaryCard label="Total Value"  value={money(summary.total_value)} color="#0EA5E9" onClick={()=>{}} active={false} />
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search PO No, vendor…"
          style={{ flex:1, minWidth:200, padding:"8px 14px", borderRadius:10, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none" }}/>
        <select value={statusF} onChange={e=>setStatusF(e.target.value)}
          style={{ padding:"8px 12px", borderRadius:10, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none", background:"#fff" }}>
          <option value="">All Statuses</option>
          {["Pending","SentToVendor","WalkinAccepted","VendorSubmitted","Approved"].map(s=>(
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(urgencyF||statusF||search) && (
          <button onClick={()=>{setUrgencyF("");setStatusF("");setSearch("");}}
            style={{ padding:"8px 14px", borderRadius:10, border:"1.5px solid #E4EAF3", background:"#F8FAFC", fontSize:12, fontWeight:600, cursor:"pointer", color:"#64748B" }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background:"#fff", borderRadius:16, border:"1px solid #E4EAF3", overflow:"hidden", boxShadow:"0 2px 12px rgba(15,27,45,0.06)" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900 }}>
            <thead>
              <tr style={{ background:"#F8FAFD" }}>
                {["PO Number","Vendor","Status","Urgency","Due Date","Days Since Sent","Items","PO Value","Alert"].map(h=>(
                  <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"#7A8BA4", textTransform:"uppercase", letterSpacing:"0.07em", borderBottom:"1px solid #E4EAF3", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding:48, textAlign:"center", color:"#94A3B8", fontSize:14 }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding:48, textAlign:"center", color:"#94A3B8", fontSize:14 }}>No open POs found</td></tr>
              ) : filtered.map((po, i) => (
                <tr key={po.id} style={{ background: i%2===0?"#fff":"#FAFBFD", borderBottom:"1px solid #F1F5F9" }}>
                  <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700, color:"#0F1B2D", whiteSpace:"nowrap" }}>
                    {po.orderNo || "—"}
                    {po.hasVariance && <span style={{ marginLeft:6, fontSize:10, color:"#F97316", fontWeight:700 }}>⚠ Variance</span>}
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:13, color:"#3D5166", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {po.vendorName || "—"}
                    {po.vendorType==="walkin" && <span style={{ marginLeft:6, fontSize:10, padding:"1px 6px", borderRadius:9, background:"#FFF7ED", color:"#9A3412", fontWeight:700 }}>Walk-in</span>}
                  </td>
                  <td style={{ padding:"10px 14px" }}>
                    <span style={{ fontSize:12, fontWeight:600, color:STATUS_COLOR[po.status]||"#64748B", background:(STATUS_COLOR[po.status]||"#94A3B8")+"18", padding:"3px 10px", borderRadius:8 }}>
                      {po.status}
                    </span>
                  </td>
                  <td style={{ padding:"10px 14px" }}><UrgencyBadge urgency={po.urgency}/></td>
                  <td style={{ padding:"10px 14px", fontSize:12, color:"#475569", whiteSpace:"nowrap", fontFamily:"'DM Mono',monospace" }}>
                    {po.dueDate || <span style={{ color:"#CBD5E1" }}>No date</span>}
                    {po.daysUntilDue !== null && po.daysUntilDue !== undefined && (
                      <div style={{ fontSize:10, color: po.daysUntilDue < 0 ? "#EF4444" : "#94A3B8", marginTop:1 }}>
                        {po.daysUntilDue < 0 ? `${Math.abs(po.daysUntilDue)}d overdue` : `${po.daysUntilDue}d left`}
                      </div>
                    )}
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:12, color: po.daysSinceSent>7?"#EF4444":"#64748B", fontFamily:"'DM Mono',monospace", textAlign:"center" }}>
                    {po.daysSinceSent}d
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:13, fontWeight:600, color:"#3D5166", textAlign:"center" }}>{po.itemCount}</td>
                  <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700, color:"#0F1B2D", fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>{money(po.poValue)}</td>
                  <td style={{ padding:"10px 14px" }}>
                    {po.needsReview && (
                      <span style={{ fontSize:11, fontWeight:700, color:"#7C3AED", background:"#F5F3FF", padding:"3px 8px", borderRadius:8, border:"1px solid #DDD6FE" }}>
                        ⏳ Review Now
                      </span>
                    )}
                    {po.urgency==="overdue" && (
                      <span style={{ fontSize:11, fontWeight:700, color:"#EF4444", background:"#FEF2F2", padding:"3px 8px", borderRadius:8, border:"1px solid #FECACA" }}>
                        🔴 Overdue
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div style={{ padding:"10px 16px", borderTop:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", fontSize:12, color:"#94A3B8" }}>
            <span>{filtered.length} POs shown</span>
            <span>Total value: <b style={{ color:"#0F1B2D" }}>{money(filtered.reduce((s,p)=>s+p.poValue,0))}</b></span>
          </div>
        )}
      </div>
    </div>
  );
}