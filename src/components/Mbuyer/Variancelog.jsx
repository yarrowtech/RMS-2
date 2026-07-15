import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";

const API   = `${APP_API_URL}/mbuyer/variance-log`;
const money = (v) => `₹${Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

const VSTATUS = {
  blocked:        { label:"Blocked",       bg:"#FEF2F2", text:"#991B1B", border:"#FECACA" },
  flagged:        { label:"Flagged",       bg:"#FFF7ED", text:"#9A3412", border:"#FED7AA" },
  auto_accepted:  { label:"Auto Accepted", bg:"#F0FDF4", text:"#166534", border:"#BBF7D0" },
  walkin_matched: { label:"Walk-in Match", bg:"#EFF6FF", text:"#1E40AF", border:"#BFDBFE" },
};

function VStatusBadge({ status }) {
  const cfg = VSTATUS[status] || { label:status, bg:"#F8FAFC", text:"#475569", border:"#E2E8F0" };
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:99, background:cfg.bg, color:cfg.text, border:`1px solid ${cfg.border}`, whiteSpace:"nowrap" }}>
      {cfg.label}
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

export default function VarianceLog() {
  const [data,    setData]    = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusF, setStatusF] = useState("");
  const [search,  setSearch]  = useState("");

  const fetch = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusF) params.status_filter = statusF;
      if (search)  params.search        = search;
      const res = await axios.get(API, { params });
      setData(res.data.data || []);
      setSummary(res.data.summary || {});
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [statusF, search]);

  return (
    <div style={{ padding:"24px", fontFamily:"'Plus Jakarta Sans',sans-serif", minHeight:"100%" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>

      <div style={{ marginBottom:24 }}>
        <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:"#0F1B2D" }}>Variance & Price Override Log</h2>
        <p style={{ margin:"4px 0 0", fontSize:13, color:"#64748B" }}>
          All items where vendor rate ≠ buyer rate — audit trail and override decisions
        </p>
      </div>

      {/* Summary */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
        <SummaryCard label="Total Items"    value={summary.total_entries||0}    color="#6366F1"/>
        <SummaryCard label="Blocked"        value={summary.blocked||0}          color="#EF4444"/>
        <SummaryCard label="Flagged"        value={summary.flagged||0}          color="#F97316"/>
        <SummaryCard label="Auto Accepted"  value={summary.auto_accepted||0}    color="#22C55E"/>
        <SummaryCard label="Overrides Applied" value={summary.overrides_applied||0} color="#7C3AED"/>
        <SummaryCard label="Total Impact"   value={money(summary.total_impact_amt)} color="#EF4444"/>
      </div>

      {/* Info banner for blocked */}
      {(summary.blocked||0) > 0 && (
        <div style={{ marginBottom:16, padding:"12px 16px", borderRadius:10, background:"#FEF2F2", border:"1px solid #FECACA", fontSize:13, color:"#991B1B", fontWeight:500 }}>
          🔴 <b>{summary.blocked} items are blocked</b> (variance {">"} 10%) — go to the PO and click <b>Override Price</b> to allow vendor submission.
        </div>
      )}
      {(summary.flagged||0) > 0 && (
        <div style={{ marginBottom:16, padding:"12px 16px", borderRadius:10, background:"#FFF7ED", border:"1px solid #FED7AA", fontSize:13, color:"#9A3412", fontWeight:500 }}>
          ⚠ <b>{summary.flagged} items are flagged</b> (variance 3–10%) — review and confirm these are acceptable before GRC.
        </div>
      )}

      {/* Filters */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search PO, vendor, item…"
          style={{ flex:1, minWidth:200, padding:"8px 14px", borderRadius:10, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none" }}/>
        <select value={statusF} onChange={e=>setStatusF(e.target.value)}
          style={{ padding:"8px 12px", borderRadius:10, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none", background:"#fff" }}>
          <option value="">All Variance Types</option>
          <option value="blocked">Blocked (&gt;10%)</option>
          <option value="flagged">Flagged (3–10%)</option>
          <option value="auto_accepted">Auto Accepted (≤3%)</option>
          <option value="walkin_matched">Walk-in Matched</option>
        </select>
        {(statusF||search) && (
          <button onClick={()=>{setStatusF("");setSearch("");}}
            style={{ padding:"8px 14px", borderRadius:10, border:"1.5px solid #E4EAF3", background:"#F8FAFC", fontSize:12, fontWeight:600, cursor:"pointer", color:"#64748B" }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background:"#fff", borderRadius:16, border:"1px solid #E4EAF3", overflow:"hidden", boxShadow:"0 2px 12px rgba(15,27,45,0.06)" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:960 }}>
            <thead>
              <tr style={{ background:"#F8FAFD" }}>
                {["PO No","Vendor","Item Description","Buyer Rate","Vendor Rate","Variance %","Impact Amt","Qty","Status","Override"].map(h=>(
                  <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"#7A8BA4", textTransform:"uppercase", letterSpacing:"0.07em", borderBottom:"1px solid #E4EAF3", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ padding:48, textAlign:"center", color:"#94A3B8" }}>Loading…</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={10} style={{ padding:48, textAlign:"center", color:"#94A3B8" }}>No variance records found</td></tr>
              ) : data.map((e, i) => {
                const isUp = e.variancePct > 0;
                const varColor = e.varianceStatus==="blocked"?"#EF4444": e.varianceStatus==="flagged"?"#F97316":"#22C55E";
                return (
                  <tr key={i} style={{ background:i%2===0?"#fff":"#FAFBFD", borderBottom:"1px solid #F1F5F9" }}>
                    <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700, color:"#0F1B2D", whiteSpace:"nowrap" }}>{e.orderNo}</td>
                    <td style={{ padding:"10px 14px", fontSize:13, color:"#3D5166", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.vendorName}</td>
                    <td style={{ padding:"10px 14px", fontSize:13, color:"#0F1B2D", maxWidth:200 }}>
                      <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.description || e.barcode || "—"}</div>
                      {e.barcode && e.description && (
                        <div style={{ fontSize:10, color:"#94A3B8", fontFamily:"'DM Mono',monospace", marginTop:1 }}>{e.barcode}</div>
                      )}
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:13, fontFamily:"'DM Mono',monospace", color:"#475569", whiteSpace:"nowrap" }}>{money(e.buyerRate)}</td>
                    <td style={{ padding:"10px 14px", fontSize:13, fontFamily:"'DM Mono',monospace", fontWeight:700, color: isUp?"#EF4444":"#22C55E", whiteSpace:"nowrap" }}>{money(e.vendorRate)}</td>
                    <td style={{ padding:"10px 14px", whiteSpace:"nowrap" }}>
                      <span style={{ fontSize:13, fontWeight:800, fontFamily:"'DM Mono',monospace", color:varColor }}>
                        {isUp?"+":""}{e.variancePct}%
                      </span>
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace", color:e.impactAmt>5000?"#EF4444":"#475569", whiteSpace:"nowrap" }}>
                      {money(e.impactAmt)}
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:13, color:"#64748B", textAlign:"center" }}>{e.amendedQty}</td>
                    <td style={{ padding:"10px 14px" }}><VStatusBadge status={e.varianceStatus}/></td>
                    <td style={{ padding:"10px 14px", textAlign:"center" }}>
                      {e.overrideApplied ? (
                        <span style={{ fontSize:11, color:"#7C3AED", fontWeight:700, background:"#F5F3FF", padding:"3px 8px", borderRadius:8, border:"1px solid #DDD6FE" }}>✓ Overridden</span>
                      ) : e.varianceStatus==="blocked" ? (
                        <span style={{ fontSize:11, color:"#EF4444", fontWeight:600 }}>Go to PO →</span>
                      ) : (
                        <span style={{ color:"#CBD5E1", fontSize:12 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data.length > 0 && (
          <div style={{ padding:"10px 16px", borderTop:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", fontSize:12, color:"#94A3B8" }}>
            <span>{data.length} variance records</span>
            <span>Total financial impact: <b style={{ color:"#EF4444" }}>{money(data.reduce((s,e)=>s+e.impactAmt,0))}</b></span>
          </div>
        )}
      </div>
    </div>
  );
}