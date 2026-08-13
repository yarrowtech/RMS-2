import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import { buyerHeaders } from "./buyerApi.js";

const API = `${APP_API_URL}/tasklist`;
const empty = () => ({ name:"", taskDetails:"", priority:"medium", status:"open", dueDate:"", communication:"", workTransferredTo:"" });
const priority = { urgent:"#DC2626", high:"#EA580C", medium:"#4F46E5", low:"#64748B" };
const statusLabel = { open:"Open", in_progress:"In progress", waiting:"Waiting", done:"Done" };

export default function TaskList() {
  const [items, setItems] = useState([]), [form, setForm] = useState(empty()), [editing, setEditing] = useState(null), [showForm, setShowForm] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const load = async () => { try { setLoading(true); const r = await axios.get(`${API}/`, { headers: buyerHeaders() }); setItems(r.data || []); setError(""); } catch (e) { setError(e.response?.data?.detail || "Could not load tasks."); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const save = async () => { if (!form.name.trim() || !form.taskDetails.trim()) return setError("Add a task title and details."); try { if (editing) await axios.put(`${API}/${editing}`, form, { headers: buyerHeaders() }); else await axios.post(`${API}/`, form, { headers: buyerHeaders() }); setShowForm(false); setEditing(null); setForm(empty()); await load(); } catch (e) { setError(e.response?.data?.detail || "Could not save task."); } };
  const updateStatus = async (item, status) => { try { await axios.put(`${API}/${item.id}`, { ...item, status }, { headers: buyerHeaders() }); await load(); } catch { setError("Could not update task."); } };
  const overdue = (d) => d && d < new Date().toISOString().slice(0,10);
  const active = useMemo(() => items.filter(x => x.status !== "done"), [items]);
  return <div className="buyer-work-page" style={{ padding:24, fontFamily:"'Plus Jakarta Sans',sans-serif", minHeight:"100%" }}><style>{`
  .buyer-work-page { max-width: 1320px; margin: 0 auto; }
  .buyer-work-page input:not([type="checkbox"]), .buyer-work-page select, .buyer-work-page textarea {
    border: 1px solid #D8E1EF; border-radius: 10px; padding: 10px 12px; color: #1E293B;
    font: 500 13px 'Plus Jakarta Sans', sans-serif; background: #fff; outline: none;
    transition: border-color .15s, box-shadow .15s;
  }
  .buyer-work-page input:focus, .buyer-work-page select:focus, .buyer-work-page textarea:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,.12); }
  .buyer-work-page button { border: 1px solid #D8E1EF; border-radius: 9px; padding: 8px 12px; background:#fff; color:#334155; font:700 12px 'Plus Jakarta Sans', sans-serif; cursor:pointer; transition:transform .15s, box-shadow .15s, background .15s; }
  .buyer-work-page button:hover { transform:translateY(-1px); box-shadow:0 5px 12px rgba(15,23,42,.10); background:#F8FAFC; }
  .buyer-work-page button:active { transform:translateY(0); }
  .buyer-work-page input[type="checkbox"] { width:20px; height:20px; accent-color:#059669; cursor:pointer; }
  @media (max-width: 560px) { .buyer-work-page { padding: 4px !important; } .buyer-work-page h2 { font-size:21px !important; } }
`}</style>
    <div style={{ display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginBottom:18 }}><div><div style={{ color:"#4F46E5", fontWeight:800, fontSize:11, letterSpacing:".12em", textTransform:"uppercase" }}>Buyer work management</div><h2 style={{ margin:"5px 0", color:"#0F1B2D" }}>Task List</h2><p style={{ margin:0, color:"#64748B", fontSize:13 }}>Work assigned to a buyer. Completing it does not change a PO, delivery, or stock automatically.</p></div><button onClick={()=>{setForm(empty());setEditing(null);setShowForm(true)}} style={{ border:0,borderRadius:10,padding:"10px 15px",background:"#4F46E5",color:"#fff",fontWeight:800,cursor:"pointer" }}>+ Add task</button></div>
    <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:18 }}>{[["Open work",active.length,"#4F46E5"],["Urgent",active.filter(x=>x.priority==="urgent").length,"#DC2626"],["Due today / overdue",active.filter(x=>x.dueDate && x.dueDate<=new Date().toISOString().slice(0,10)).length,"#EA580C"]].map(([l,v,c])=><div key={l} style={{ minWidth:145,padding:"13px 16px",border:"1px solid #E2E8F0",borderRadius:14,background:"#fff" }}><b style={{ fontSize:22,color:c }}>{v}</b><div style={{ fontSize:11,color:"#64748B",fontWeight:700,textTransform:"uppercase",marginTop:3 }}>{l}</div></div>)}</div>
    {error && <div style={{ marginBottom:12,padding:10,borderRadius:9,background:"#FEF2F2",color:"#991B1B",fontSize:13 }}>{error}</div>}
    {showForm && <div style={{ marginBottom:18,padding:18,borderRadius:15,background:"#F8FAFF",border:"1px solid #C7D2FE" }}><div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10 }}><input placeholder="Task title *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{Object.keys(priority).map(x=><option key={x} value={x}>{x}</option>)}</select><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{Object.entries(statusLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></div><textarea style={{width:"100%",boxSizing:"border-box",marginTop:10,minHeight:68}} placeholder="What needs to be done? *" value={form.taskDetails} onChange={e=>setForm({...form,taskDetails:e.target.value})}/><div style={{display:"flex",gap:8,marginTop:10}}><button onClick={save}>Save task</button><button onClick={()=>setShowForm(false)}>Cancel</button></div></div>}
    <div style={{ display:"grid",gap:10 }}>{loading ? <div>Loading tasks…</div> : items.length===0 ? <div style={{padding:34,textAlign:"center",border:"1px dashed #CBD5E1",borderRadius:15,color:"#64748B"}}>No buyer tasks yet. Add only work that needs someone’s attention.</div> : items.map(item => <div key={item.id} style={{ display:"flex",gap:13,alignItems:"center",flexWrap:"wrap",padding:15,borderRadius:14,border:"1px solid #E2E8F0",background:item.status==="done"?"#F8FAFC":"#fff" }}><div style={{width:10,height:44,borderRadius:9,background:priority[item.priority]||priority.medium}}/><div style={{flex:1,minWidth:200}}><div style={{fontWeight:800,color:"#0F1B2D",textDecoration:item.status==="done"?"line-through":"none"}}>{item.name}</div><div style={{fontSize:12,color:"#64748B",marginTop:3}}>{item.taskDetails}</div></div><div style={{fontSize:12,color:overdue(item.dueDate)?"#DC2626":"#64748B",fontWeight:700}}>{item.dueDate ? `Due ${item.dueDate}` : "No due date"}</div><select value={item.status} onChange={e=>updateStatus(item,e.target.value)}>{Object.entries(statusLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><button onClick={()=>{setEditing(item.id);setForm({...empty(),...item});setShowForm(true)}}>Edit</button><button onClick={async()=>{if(confirm("Delete this task?")){await axios.delete(`${API}/${item.id}`,{headers:buyerHeaders()});load()}}}>Delete</button></div>)}</div>
  </div>;
}