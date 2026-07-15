import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useState } from "react";
import axios from "axios";

const API = `${APP_API_URL}/mbuyer`;
const money = (v) => `₹${Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`;
const pct   = (v) => `${Number(v||0).toFixed(1)}%`;

const STATUS_CFG = {
  "healthy":    { bg:"#F0FDF4", text:"#166534", border:"#BBF7D0", label:"Healthy" },
  "warning":    { bg:"#FEFCE8", text:"#854D0E", border:"#FEF08A", label:"Warning" },
  "over-budget":{ bg:"#FEF2F2", text:"#991B1B", border:"#FECACA", label:"Over Budget" },
  "no-budget":  { bg:"#F8FAFC", text:"#475569", border:"#E2E8F0", label:"No Budget" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG["healthy"];
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:99,
      background:cfg.bg, color:cfg.text, border:`1px solid ${cfg.border}`, whiteSpace:"nowrap" }}>
      {cfg.label}
    </span>
  );
}

function UtilBar({ pct: p }) {
  const color = p >= 100 ? "#EF4444" : p >= 80 ? "#EAB308" : "#22C55E";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height:7, borderRadius:99, background:"#F1F5F9", overflow:"hidden" }}>
        <div style={{ width:`${Math.min(p,100)}%`, height:"100%", background:color, borderRadius:99, transition:"width 0.5s" }}/>
      </div>
      <span style={{ fontSize:11, fontWeight:700, color, minWidth:38, fontFamily:"'DM Mono',monospace" }}>{pct(p)}</span>
    </div>
  );
}

function SummaryCard({ label, value, color, sub }) {
  return (
    <div style={{ flex:1, minWidth:130, padding:"16px 18px", borderRadius:14,
      background:"#fff", border:"1px solid #E4EAF3", boxShadow:"0 1px 6px rgba(15,27,45,0.06)" }}>
      <div style={{ fontSize:22, fontWeight:800, color, fontFamily:"'DM Mono',monospace" }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:600, color:"#64748B", marginTop:3, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:"#94A3B8", marginTop:2 }}>{sub}</div>}
    </div>
  );
}

const emptyForm = () => ({ season:"", division:"", department:"", totalBudget:"", notes:"" });

export default function BudgetOTB() {
  const [data,    setData]    = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState(emptyForm());
  const [editId,  setEditId]  = useState(null);
  const [showForm,setShowForm]= useState(false);
  const [saving,  setSaving]  = useState(false);
  const [search,  setSearch]  = useState("");

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/budgets`);
      setData(res.data.data || []);
      setSummary(res.data.summary || {});
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleSave = async () => {
    if (!form.season || !form.division || !form.totalBudget) {
      alert("Season, Division and Budget Amount are required."); return;
    }
    try {
      setSaving(true);
      if (editId) {
        await axios.put(`${API}/budgets/${editId}`, { totalBudget: Number(form.totalBudget), notes: form.notes, season: form.season });
      } else {
        await axios.post(`${API}/budgets`, { ...form, totalBudget: Number(form.totalBudget) });
      }
      setShowForm(false); setForm(emptyForm()); setEditId(null);
      await fetch();
    } catch (e) {
      alert(e.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this budget?")) return;
    await axios.delete(`${API}/budgets/${id}`);
    await fetch();
  };

  const handleEdit = (row) => {
    setForm({ season:row.season, division:row.division, department:row.department||"", totalBudget:row.totalBudget, notes:row.notes||"" });
    setEditId(row.id); setShowForm(true);
  };

  const filtered = data.filter(row => {
    if (!search) return true;
    const s = search.toLowerCase();
    return row.division?.toLowerCase().includes(s) || row.department?.toLowerCase().includes(s) || row.season?.toLowerCase().includes(s);
  });

  const INP = { width:"100%", padding:"9px 12px", borderRadius:10, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };

  return (
    <div style={{ padding:24, fontFamily:"'Plus Jakarta Sans',sans-serif", minHeight:"100%" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:24 }}>
        <div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:"#0F1B2D" }}>Budget & OTB</h2>
          <p style={{ margin:"4px 0 0", fontSize:13, color:"#64748B" }}>Open To Buy = Budget − Committed PO Value</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm()); }}
          style={{ padding:"9px 18px", borderRadius:10, background:"linear-gradient(135deg,#6366F1,#4F46E5)", color:"#fff", fontWeight:700, fontSize:13, border:"none", cursor:"pointer" }}>
          + Add Budget
        </button>
      </div>

      {/* Summary */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
        <SummaryCard label="Total Budget"    value={money(summary.total_budget)}    color="#6366F1" />
        <SummaryCard label="Committed"       value={money(summary.total_committed)} color="#F97316" sub="Active PO value" />
        <SummaryCard label="OTB Remaining"   value={money(summary.total_otb)}
          color={summary.total_otb < 0 ? "#EF4444" : "#22C55E"}
          sub={summary.total_otb < 0 ? "Over budget!" : "Available to spend"} />
        <SummaryCard label="Utilisation"     value={pct(summary.utilisation)}
          color={summary.utilisation >= 100 ? "#EF4444" : summary.utilisation >= 80 ? "#EAB308" : "#22C55E"} />
        <SummaryCard label="Over Budget"     value={summary.over_budget_count||0}   color="#EF4444" />
        <SummaryCard label="Warnings"        value={summary.warning_count||0}       color="#EAB308" />
      </div>

      {/* Over-budget alert */}
      {(summary.over_budget_count||0) > 0 && (
        <div style={{ marginBottom:16, padding:"12px 16px", borderRadius:10, background:"#FEF2F2", border:"1px solid #FECACA", fontSize:13, color:"#991B1B", fontWeight:500 }}>
          🔴 <b>{summary.over_budget_count} division(s) are over budget.</b> Review and cancel or defer pending POs.
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div style={{ marginBottom:20, padding:20, borderRadius:16, background:"#fff", border:"1px solid #E4EAF3", boxShadow:"0 2px 12px rgba(15,27,45,0.08)" }}>
          <h3 style={{ margin:"0 0 16px", fontSize:15, fontWeight:800, color:"#0F1B2D" }}>
            {editId ? "Edit Budget" : "New Budget"}
          </h3>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:12 }}>
            {[
              ["Season *",    "season",      "e.g. SS-2026"],
              ["Division *",  "division",    "e.g. Apparel"],
              ["Department",  "department",  "e.g. Kids"],
              ["Budget (₹) *","totalBudget", "0"],
            ].map(([label, field, ph]) => (
              <div key={field}>
                <label style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:5 }}>{label}</label>
                <input style={INP} placeholder={ph} value={form[field]}
                  onChange={e => setForm(f=>({...f,[field]:e.target.value}))}
                  type={field==="totalBudget"?"number":"text"} min="0" disabled={editId && (field==="division"||field==="department")}/>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:5 }}>Notes</label>
            <textarea style={{ ...INP, height:60, resize:"vertical" }} placeholder="Optional notes…"
              value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding:"9px 20px", borderRadius:10, background:"#6366F1", color:"#fff", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", opacity:saving?0.6:1 }}>
              {saving ? "Saving…" : editId ? "Update" : "Create"}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm()); }}
              style={{ padding:"9px 16px", borderRadius:10, background:"#F1F5F9", color:"#64748B", fontWeight:600, fontSize:13, border:"none", cursor:"pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom:14 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search division, department, season…"
          style={{ width:"100%", maxWidth:340, padding:"8px 14px", borderRadius:10, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none", boxSizing:"border-box" }}/>
      </div>

      {/* Table */}
      <div style={{ background:"#fff", borderRadius:16, border:"1px solid #E4EAF3", overflow:"hidden", boxShadow:"0 2px 12px rgba(15,27,45,0.06)" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:860 }}>
            <thead>
              <tr style={{ background:"#F8FAFD" }}>
                {["Season","Division","Department","Budget","Committed","OTB","Utilisation","Status","Actions"].map(h=>(
                  <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"#7A8BA4", textTransform:"uppercase", letterSpacing:"0.07em", borderBottom:"1px solid #E4EAF3", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding:48, textAlign:"center", color:"#94A3B8" }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding:48, textAlign:"center", color:"#94A3B8" }}>
                  {data.length===0 ? "No budgets yet. Click + Add Budget to start." : "No results."}
                </td></tr>
              ) : filtered.map((row, i) => (
                <tr key={row.id||i} style={{ background:i%2===0?"#fff":"#FAFBFD", borderBottom:"1px solid #F1F5F9" }}>
                  <td style={{ padding:"10px 14px", fontSize:12, fontFamily:"'DM Mono',monospace", color:"#475569", whiteSpace:"nowrap" }}>{row.season||"—"}</td>
                  <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700, color:"#0F1B2D" }}>{row.division}</td>
                  <td style={{ padding:"10px 14px", fontSize:13, color:"#3D5166" }}>{row.department||"—"}</td>
                  <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700, color:"#6366F1", fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>{money(row.totalBudget)}</td>
                  <td style={{ padding:"10px 14px", fontSize:13, fontFamily:"'DM Mono',monospace", color:"#F97316", whiteSpace:"nowrap" }}>{money(row.committed)}</td>
                  <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap",
                    color: row.otb < 0 ? "#EF4444" : "#22C55E" }}>
                    {money(row.otb)}
                  </td>
                  <td style={{ padding:"10px 14px", minWidth:140 }}><UtilBar pct={row.utilisation}/></td>
                  <td style={{ padding:"10px 14px" }}><StatusBadge status={row.status}/></td>
                  <td style={{ padding:"10px 14px", whiteSpace:"nowrap" }}>
                    <div style={{ display:"flex", gap:8 }}>
                      {row.id && (
                        <>
                          <button onClick={() => handleEdit(row)}
                            style={{ padding:"4px 12px", borderRadius:8, background:"#EFF6FF", color:"#1E40AF", fontWeight:600, fontSize:12, border:"1px solid #BFDBFE", cursor:"pointer" }}>
                            Edit
                          </button>
                          <button onClick={() => handleDelete(row.id)}
                            style={{ padding:"4px 12px", borderRadius:8, background:"#FEF2F2", color:"#991B1B", fontWeight:600, fontSize:12, border:"1px solid #FECACA", cursor:"pointer" }}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}