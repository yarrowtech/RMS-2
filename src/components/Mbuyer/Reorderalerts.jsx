import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useState } from "react";
import axios from "axios";

const API   = `${APP_API_URL}/mbuyer`;
const PO_API= `${APP_API_URL}/purchaseorders`;

const URGENCY_CFG = {
  "out-of-stock": { bg:"#FEF2F2", text:"#991B1B", border:"#FECACA", label:"Out of Stock", dot:"#EF4444" },
  "critical":     { bg:"#FFF7ED", text:"#9A3412", border:"#FED7AA", label:"Critical",      dot:"#F97316" },
  "low":          { bg:"#FEFCE8", text:"#854D0E", border:"#FEF08A", label:"Low Stock",     dot:"#EAB308" },
};

function UrgencyBadge({ urgency }) {
  const cfg = URGENCY_CFG[urgency] || URGENCY_CFG["low"];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:99, fontSize:11,
      fontWeight:700, background:cfg.bg, color:cfg.text, border:`1px solid ${cfg.border}`, whiteSpace:"nowrap" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:cfg.dot }}/>
      {cfg.label}
    </span>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ flex:1, minWidth:110, padding:"14px 16px", borderRadius:14,
      background:"#fff", border:"1px solid #E4EAF3", boxShadow:"0 1px 4px rgba(15,27,45,0.05)" }}>
      <div style={{ fontSize:22, fontWeight:800, color, fontFamily:"'DM Mono',monospace" }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:600, color:"#64748B", marginTop:2, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
    </div>
  );
}

function StockBar({ current, reorder }) {
  if (!reorder) return null;
  const pct  = Math.min((current / reorder) * 100, 100);
  const color = current <= 0 ? "#EF4444" : pct < 50 ? "#F97316" : "#EAB308";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:100 }}>
      <div style={{ flex:1, height:6, borderRadius:99, background:"#F1F5F9", overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99 }}/>
      </div>
      <span style={{ fontSize:10, color:"#94A3B8", fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>
        {current}/{reorder}
      </span>
    </div>
  );
}

export default function ReorderAlerts() {
  const [data,    setData]    = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [division,setDivision]= useState("");
  const [critOnly,setCritOnly]= useState(false);
  const [quickPO, setQuickPO] = useState(null);   // item being quick-PO'd
  const [poForm,  setPoForm]  = useState({ vendorName:"", quantity:"", rate:"", notes:"" });
  const [poSaving,setPoSaving]= useState(false);
  const [vendors, setVendors] = useState([]);

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/reorder-alerts`, {
        params: { search:search||undefined, division_filter:division||undefined, critical_only:critOnly }
      });
      setData(res.data.data || []);
      setSummary(res.data.summary || {});
    } catch {} finally { setLoading(false); }
  };

  const fetchVendors = async () => {
    try {
      const res = await axios.get(`${APP_API_URL}/api/vendors/approved`);
      setVendors(res.data || []);
    } catch {}
  };

  useEffect(() => { fetch(); }, [search, division, critOnly]);

  const openQuickPO = (item) => {
    setQuickPO(item);
    setPoForm({
      vendorName: item.lastVendorName || "",
      quantity:   String(item.suggestedQty || ""),
      rate:       "",
      notes:      `Reorder alert — ${item.productName} (${item.barcode}). Stock: ${item.stockQty}, Reorder level: ${item.reorderLevel}.`,
    });
    fetchVendors();
  };

  const submitQuickPO = async () => {
    if (!poForm.vendorName || !poForm.quantity) {
      alert("Vendor and quantity are required."); return;
    }
    try {
      setPoSaving(true);
      const token = localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
      await axios.post(PO_API + "/", {
        vendorName: poForm.vendorName,
        items: [{
          barcode:     quickPO.barcode,
          description: quickPO.productName,
          quantity:    Number(poForm.quantity),
          rate:        Number(poForm.rate) || 0,
        }],
        notes:    poForm.notes,
        division: quickPO.division,
        department: quickPO.department,
        source:   "reorder_alert",
      }, { headers: token ? { Authorization:`Bearer ${token}` } : {} });
      alert(`✅ PO created for ${poForm.vendorName} — ${poForm.quantity} units of ${quickPO.productName}`);
      setQuickPO(null);
      await fetch();
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to create PO");
    } finally { setPoSaving(false); }
  };

  return (
    <div style={{ padding:24, fontFamily:"'Plus Jakarta Sans',sans-serif", minHeight:"100%" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>

      <div style={{ marginBottom:24 }}>
        <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:"#0F1B2D" }}>Reorder Alerts</h2>
        <p style={{ margin:"4px 0 0", fontSize:13, color:"#64748B" }}>Products below reorder level — create PO directly from here</p>
      </div>

      {/* Summary */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
        <SummaryCard label="Total Alerts"   value={summary.total_alerts||0}   color="#6366F1"/>
        <SummaryCard label="Out of Stock"   value={summary.out_of_stock||0}   color="#EF4444"/>
        <SummaryCard label="Critical"       value={summary.critical||0}       color="#F97316"/>
        <SummaryCard label="Low Stock"      value={summary.low||0}            color="#EAB308"/>
        <SummaryCard label="Total Shortfall"value={summary.total_shortfall||0}color="#7C3AED"/>
      </div>

      {/* Alert banners */}
      {(summary.out_of_stock||0) > 0 && (
        <div style={{ marginBottom:12, padding:"12px 16px", borderRadius:10, background:"#FEF2F2", border:"1px solid #FECACA", fontSize:13, color:"#991B1B", fontWeight:500 }}>
          🔴 <b>{summary.out_of_stock} item(s) are completely out of stock.</b> Create POs immediately.
        </div>
      )}
      {(summary.critical||0) > 0 && (
        <div style={{ marginBottom:12, padding:"12px 16px", borderRadius:10, background:"#FFF7ED", border:"1px solid #FED7AA", fontSize:13, color:"#9A3412", fontWeight:500 }}>
          ⚠ <b>{summary.critical} item(s) have critical stock levels</b> (less than 3 days remaining).
        </div>
      )}

      {/* Filters */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product, barcode, SKU…"
          style={{ flex:1, minWidth:200, padding:"8px 14px", borderRadius:10, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none" }}/>
        <input value={division} onChange={e=>setDivision(e.target.value)} placeholder="Filter by division…"
          style={{ minWidth:160, padding:"8px 14px", borderRadius:10, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none" }}/>
        <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600, color:"#64748B", cursor:"pointer", whiteSpace:"nowrap" }}>
          <input type="checkbox" checked={critOnly} onChange={e=>setCritOnly(e.target.checked)} style={{ accentColor:"#EF4444", width:14, height:14 }}/>
          Critical Only
        </label>
        {(search||division||critOnly) && (
          <button onClick={()=>{setSearch("");setDivision("");setCritOnly(false);}}
            style={{ padding:"8px 14px", borderRadius:10, background:"#F1F5F9", color:"#64748B", fontWeight:600, fontSize:12, border:"none", cursor:"pointer" }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background:"#fff", borderRadius:16, border:"1px solid #E4EAF3", overflow:"hidden", boxShadow:"0 2px 12px rgba(15,27,45,0.06)" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1000 }}>
            <thead>
              <tr style={{ background:"#F8FAFD" }}>
                {["Urgency","Product","Barcode / SKU","Division","Stock","Reorder Lvl","Shortfall","Daily Sales","Days Left","Suggested Qty","Last Vendor","Action"].map(h=>(
                  <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"#7A8BA4",
                    textTransform:"uppercase", letterSpacing:"0.07em", borderBottom:"1px solid #E4EAF3", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} style={{ padding:48, textAlign:"center", color:"#94A3B8" }}>Loading…</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={12} style={{ padding:48, textAlign:"center", color:"#94A3B8" }}>
                  {summary.total_alerts === 0 ? "✓ All products are adequately stocked." : "No results for current filters."}
                </td></tr>
              ) : data.map((item, i) => (
                <tr key={i} style={{ background:i%2===0?"#fff":"#FAFBFD", borderBottom:"1px solid #F1F5F9" }}>
                  <td style={{ padding:"10px 14px" }}><UrgencyBadge urgency={item.urgency}/></td>
                  <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700, color:"#0F1B2D", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {item.productName||"—"}
                  </td>
                  <td style={{ padding:"10px 14px" }}>
                    <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"#475569" }}>{item.barcode||"—"}</div>
                    {item.sku && <div style={{ fontSize:10, color:"#94A3B8", fontFamily:"'DM Mono',monospace" }}>{item.sku}</div>}
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:12, color:"#64748B", whiteSpace:"nowrap" }}>
                    {item.division||"—"}
                    {item.department && <div style={{ fontSize:10, color:"#94A3B8" }}>{item.department}</div>}
                  </td>
                  <td style={{ padding:"10px 14px", minWidth:120 }}>
                    <StockBar current={item.stockQty} reorder={item.reorderLevel}/>
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:13, fontFamily:"'DM Mono',monospace", color:"#6366F1", textAlign:"center" }}>
                    {item.reorderLevel}
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace",
                    color:item.shortfall>50?"#EF4444":"#F97316", textAlign:"center" }}>
                    {item.shortfall}
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:12, fontFamily:"'DM Mono',monospace", color:"#64748B", textAlign:"center" }}>
                    {item.avgDailySales > 0 ? item.avgDailySales : <span style={{ color:"#CBD5E1" }}>—</span>}
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace",
                    color: item.daysLeft===null?"#94A3B8": item.daysLeft<3?"#EF4444":"#EAB308", textAlign:"center" }}>
                    {item.daysLeft !== null ? `${item.daysLeft}d` : "—"}
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:13, fontWeight:800, color:"#7C3AED",
                    fontFamily:"'DM Mono',monospace", textAlign:"center" }}>
                    {item.suggestedQty}
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:12, color:"#3D5166", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {item.lastVendorName || <span style={{ color:"#CBD5E1" }}>Unknown</span>}
                    {item.lastGRNDate && <div style={{ fontSize:10, color:"#94A3B8" }}>{item.lastGRNDate}</div>}
                  </td>
                  <td style={{ padding:"10px 14px" }}>
                    <button onClick={() => openQuickPO(item)}
                      style={{ padding:"6px 14px", borderRadius:9, background:"linear-gradient(135deg,#6366F1,#4F46E5)", color:"#fff",
                        fontWeight:700, fontSize:12, border:"none", cursor:"pointer", whiteSpace:"nowrap" }}>
                      ⚡ Quick PO
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick PO Modal */}
      {quickPO && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:20, padding:28, width:"100%", maxWidth:480, boxShadow:"0 24px 64px rgba(15,27,45,0.25)", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
              <div>
                <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:"#0F1B2D" }}>⚡ Quick Create PO</h3>
                <p style={{ margin:"4px 0 0", fontSize:13, color:"#64748B" }}>{quickPO.productName}</p>
                <p style={{ margin:"2px 0 0", fontSize:11, color:"#94A3B8", fontFamily:"'DM Mono',monospace" }}>{quickPO.barcode}</p>
              </div>
              <button onClick={() => setQuickPO(null)}
                style={{ background:"#F1F5F9", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:16, color:"#64748B" }}>✕</button>
            </div>

            {/* Stock info strip */}
            <div style={{ display:"flex", gap:12, marginBottom:20, padding:"10px 14px", borderRadius:10, background:"#FEF2F2", border:"1px solid #FECACA" }}>
              {[["Current Stock", quickPO.stockQty],["Reorder Level", quickPO.reorderLevel],["Shortfall", quickPO.shortfall],["Suggested Qty", quickPO.suggestedQty]].map(([l,v])=>(
                <div key={l} style={{ flex:1, textAlign:"center" }}>
                  <div style={{ fontSize:16, fontWeight:800, color:"#0F1B2D", fontFamily:"'DM Mono',monospace" }}>{v}</div>
                  <div style={{ fontSize:10, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>{l}</div>
                </div>
              ))}
            </div>

            {[
              { label:"Vendor *", field:"vendorName", type:"select" },
              { label:"Quantity *", field:"quantity", type:"number", ph:"Suggested: "+quickPO.suggestedQty },
              { label:"Rate (₹)", field:"rate", type:"number", ph:"0.00" },
              { label:"Notes", field:"notes", type:"textarea" },
            ].map(({ label, field, type, ph }) => (
              <div key={field} style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:5 }}>{label}</label>
                {type==="select" ? (
                  <select value={poForm[field]} onChange={e=>setPoForm(f=>({...f,[field]:e.target.value}))}
                    style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none", background:"#fff" }}>
                    <option value="">— Select vendor —</option>
                    {poForm.vendorName && !vendors.find(v=>(v.name||v.vendor_name)===poForm.vendorName) && (
                      <option value={poForm.vendorName}>{poForm.vendorName} (last used)</option>
                    )}
                    {vendors.map((v,i) => (
                      <option key={i} value={v.name||v.vendor_name}>{v.name||v.vendor_name}</option>
                    ))}
                  </select>
                ) : type==="textarea" ? (
                  <textarea value={poForm[field]} onChange={e=>setPoForm(f=>({...f,[field]:e.target.value}))}
                    placeholder={ph||""} rows={2}
                    style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" }}/>
                ) : (
                  <input type={type} value={poForm[field]} onChange={e=>setPoForm(f=>({...f,[field]:e.target.value}))}
                    placeholder={ph||""} min="0"
                    style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none", boxSizing:"border-box" }}/>
                )}
              </div>
            ))}

            <div style={{ display:"flex", gap:10, marginTop:4 }}>
              <button onClick={submitQuickPO} disabled={poSaving}
                style={{ flex:1, padding:"11px", borderRadius:12, background:"linear-gradient(135deg,#6366F1,#4F46E5)", color:"#fff",
                  fontWeight:700, fontSize:14, border:"none", cursor:"pointer", opacity:poSaving?0.6:1 }}>
                {poSaving ? "Creating PO…" : "Create Purchase Order"}
              </button>
              <button onClick={() => setQuickPO(null)}
                style={{ padding:"11px 18px", borderRadius:12, background:"#F1F5F9", color:"#64748B", fontWeight:600, fontSize:14, border:"none", cursor:"pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}