import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useState } from "react";
import axios from "axios";

const API   = `${APP_API_URL}/mbuyer`;
const money = (v) => `₹${Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`;

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ flex:1, minWidth:120, padding:"14px 16px", borderRadius:14,
      background:"#fff", border:"1px solid #E4EAF3", boxShadow:"0 1px 4px rgba(15,27,45,0.05)" }}>
      <div style={{ fontSize:22, fontWeight:800, color, fontFamily:"'DM Mono',monospace" }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:600, color:"#64748B", marginTop:2, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
    </div>
  );
}

function LeadBar({ avg, max: maxVal }) {
  if (!avg || !maxVal) return <span style={{ color:"#CBD5E1", fontSize:12 }}>—</span>;
  const w = Math.min((avg / maxVal) * 100, 100);
  const color = avg <= 7 ? "#22C55E" : avg <= 14 ? "#EAB308" : "#EF4444";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height:6, borderRadius:99, background:"#F1F5F9", overflow:"hidden" }}>
        <div style={{ width:`${w}%`, height:"100%", background:color, borderRadius:99 }}/>
      </div>
      <span style={{ fontSize:12, fontWeight:700, color, minWidth:40, fontFamily:"'DM Mono',monospace" }}>{avg}d</span>
    </div>
  );
}

export default function DeliveryTracking() {
  const [vendors,    setVendors]    = useState([]);
  const [delayed,    setDelayed]    = useState([]);
  const [summary,    setSummary]    = useState({});
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [tab,        setTab]        = useState("vendors");  // vendors | delayed
  const [notePoId,   setNotePoId]   = useState(null);
  const [noteText,   setNoteText]   = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [expandedVendor, setExpandedVendor] = useState(null);

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/delivery-tracking`, { params: { search: search || undefined } });
      setVendors(res.data.vendors || []);
      setDelayed(res.data.delayed_pos || []);
      setSummary(res.data.summary || {});
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [search]);

  const maxLead = Math.max(...vendors.map(v => v.avg_lead_days || 0), 1);

  const addNote = async (poId) => {
    if (!noteText.trim()) return;
    try {
      setNoteSaving(true);
      await axios.put(`${API}/po-followup/${poId}`, { note: noteText.trim(), addedBy: "M-Buyer" });
      setNotePoId(null); setNoteText("");
      await fetch();
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to save note");
    } finally { setNoteSaving(false); }
  };

  return (
    <div style={{ padding:24, fontFamily:"'Plus Jakarta Sans',sans-serif", minHeight:"100%" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>

      <div style={{ marginBottom:24 }}>
        <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:"#0F1B2D" }}>Delivery & Lead Time Tracking</h2>
        <p style={{ margin:"4px 0 0", fontSize:13, color:"#64748B" }}>Average lead time per vendor and delayed PO follow-ups</p>
      </div>

      {/* Summary */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
        <SummaryCard label="Vendors Tracked" value={summary.total_vendors||0}  color="#6366F1"/>
        <SummaryCard label="Delayed POs"     value={summary.total_delayed||0}  color="#EF4444"/>
        <SummaryCard label="Avg Lead Time"   value={summary.avg_lead_time ? `${summary.avg_lead_time}d` : "—"} color="#0EA5E9"/>
      </div>

      {delayed.length > 0 && (
        <div style={{ marginBottom:16, padding:"12px 16px", borderRadius:10, background:"#FEF2F2", border:"1px solid #FECACA", fontSize:13, color:"#991B1B", fontWeight:500 }}>
          🔴 <b>{delayed.length} PO(s) are past due date.</b> Add follow-up notes and contact vendors immediately.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["vendors","Vendor Lead Times"],["delayed","Delayed POs"]].map(([key,label])=>(
          <button key={key} onClick={()=>setTab(key)}
            style={{ padding:"7px 16px", borderRadius:10, fontSize:13, fontWeight:600, border:"none", cursor:"pointer",
              background: tab===key ? "#6366F1" : "#F1F5F9",
              color: tab===key ? "#fff" : "#64748B" }}>
            {label}
            {key==="delayed" && delayed.length > 0 && (
              <span style={{ marginLeft:6, background:"#EF4444", color:"#fff", borderRadius:99, padding:"1px 7px", fontSize:10, fontWeight:800 }}>{delayed.length}</span>
            )}
          </button>
        ))}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendor or PO…"
          style={{ marginLeft:"auto", padding:"7px 14px", borderRadius:10, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none", minWidth:200 }}/>
      </div>

      {/* ── VENDOR LEAD TIMES TAB ── */}
      {tab === "vendors" && (
        <div style={{ background:"#fff", borderRadius:16, border:"1px solid #E4EAF3", overflow:"hidden", boxShadow:"0 2px 12px rgba(15,27,45,0.06)" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:780 }}>
              <thead>
                <tr style={{ background:"#F8FAFD" }}>
                  {["Vendor","Total POs","Completed","Avg Lead Time","Min","Max","On-Time","Delayed","Follow-ups"].map(h=>(
                    <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"#7A8BA4", textTransform:"uppercase", letterSpacing:"0.07em", borderBottom:"1px solid #E4EAF3", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ padding:48, textAlign:"center", color:"#94A3B8" }}>Loading…</td></tr>
                ) : vendors.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding:48, textAlign:"center", color:"#94A3B8" }}>No vendor delivery data found.</td></tr>
                ) : vendors.map((v, i) => (
                  <tr key={i} style={{ background:i%2===0?"#fff":"#FAFBFD", borderBottom:"1px solid #F1F5F9" }}>
                    <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700, color:"#0F1B2D", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.vendorName}</td>
                    <td style={{ padding:"10px 14px", fontSize:13, color:"#64748B", textAlign:"center" }}>{v.total_pos}</td>
                    <td style={{ padding:"10px 14px", fontSize:13, color:"#22C55E", fontWeight:600, textAlign:"center" }}>{v.completed}</td>
                    <td style={{ padding:"10px 14px", minWidth:160 }}>
                      <LeadBar avg={v.avg_lead_days} max={maxLead}/>
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"#22C55E", fontFamily:"'DM Mono',monospace", textAlign:"center" }}>{v.min_lead_days!=null?`${v.min_lead_days}d`:"—"}</td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"#EF4444", fontFamily:"'DM Mono',monospace", textAlign:"center" }}>{v.max_lead_days!=null?`${v.max_lead_days}d`:"—"}</td>
                    <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700, color:"#22C55E", textAlign:"center" }}>{v.on_time_count}</td>
                    <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700, color: v.delayed_count>0?"#EF4444":"#94A3B8", textAlign:"center" }}>{v.delayed_count}</td>
                    <td style={{ padding:"10px 14px", fontSize:13, color:"#7C3AED", textAlign:"center" }}>{v.follow_ups||0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DELAYED POs TAB ── */}
      {tab === "delayed" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:48, color:"#94A3B8" }}>Loading…</div>
          ) : delayed.length === 0 ? (
            <div style={{ textAlign:"center", padding:48, color:"#94A3B8" }}>No delayed POs. Great job! ✓</div>
          ) : delayed.map((po, i) => (
            <div key={i} style={{ background:"#fff", borderRadius:14, border:"1px solid #FECACA", padding:"16px 20px", boxShadow:"0 2px 8px rgba(239,68,68,0.08)" }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                    <span style={{ fontWeight:800, fontSize:15, color:"#0F1B2D" }}>{po.orderNo}</span>
                    <span style={{ fontSize:11, fontWeight:700, background:"#FEF2F2", color:"#991B1B", padding:"2px 8px", borderRadius:8, border:"1px solid #FECACA" }}>
                      {po.daysOverdue}d overdue
                    </span>
                  </div>
                  <div style={{ fontSize:13, color:"#64748B" }}>
                    <b style={{ color:"#3D5166" }}>{po.vendorName}</b>
                    &nbsp;·&nbsp;Due: <span style={{ color:"#EF4444", fontFamily:"'DM Mono',monospace" }}>{po.dueDate}</span>
                    &nbsp;·&nbsp;Status: <span style={{ color:"#7C3AED", fontWeight:600 }}>{po.status}</span>
                    &nbsp;·&nbsp;<span style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, color:"#0F1B2D" }}>{money(po.poValue)}</span>
                  </div>
                </div>
                <button onClick={() => setNotePoId(notePoId===po.id?null:po.id)}
                  style={{ padding:"7px 14px", borderRadius:10, background:"#7C3AED", color:"#fff", fontWeight:700, fontSize:12, border:"none", cursor:"pointer" }}>
                  + Follow-up Note
                </button>
              </div>

              {/* Existing notes */}
              {(po.followupNotes||[]).length > 0 && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #F1F5F9" }}>
                  {po.followupNotes.map((n, ni) => (
                    <div key={ni} style={{ display:"flex", gap:10, marginBottom:8 }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:"#7C3AED22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#7C3AED", flexShrink:0 }}>
                        {n.addedBy?.[0]||"M"}
                      </div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:"#3D5166" }}>{n.addedBy} <span style={{ fontWeight:400, color:"#94A3B8", fontSize:11 }}>{n.addedAt?.slice(0,16)?.replace("T"," ")}</span></div>
                        <div style={{ fontSize:13, color:"#0F1B2D", marginTop:2 }}>{n.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add note form */}
              {notePoId === po.id && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #F1F5F9", display:"flex", gap:10 }}>
                  <textarea value={noteText} onChange={e=>setNoteText(e.target.value)}
                    placeholder="e.g. Called vendor, says shipment dispatched today…"
                    style={{ flex:1, padding:"8px 12px", borderRadius:10, border:"1.5px solid #DDD6FE", fontSize:13, outline:"none", resize:"vertical", minHeight:56, fontFamily:"inherit" }}/>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <button onClick={() => addNote(po.id)} disabled={noteSaving||!noteText.trim()}
                      style={{ padding:"8px 14px", borderRadius:10, background:"#7C3AED", color:"#fff", fontWeight:700, fontSize:12, border:"none", cursor:"pointer", opacity:noteSaving||!noteText.trim()?0.5:1 }}>
                      {noteSaving?"…":"Save"}
                    </button>
                    <button onClick={() => { setNotePoId(null); setNoteText(""); }}
                      style={{ padding:"8px 14px", borderRadius:10, background:"#F1F5F9", color:"#64748B", fontWeight:600, fontSize:12, border:"none", cursor:"pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}