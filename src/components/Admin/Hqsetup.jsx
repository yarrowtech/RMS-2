import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
// import React, { useEffect, useState, useCallback } from "react";
// import {
//   Store, GitBranch, Users, CheckCircle, Circle,
//   Plus, Trash2, Edit, X, ChevronDown, ChevronRight,
//   Building2, AlertCircle
// } from "lucide-react";
// import toast from "react-hot-toast";

// const API   = APP_API_URL;
// const token = localStorage.getItem("admin_token") || "";
// const hdrs  = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

// const INP = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition bg-white";
// const LBL = "block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5";

// // ── API helpers ────────────────────────────────────────────────────────────────
// const api = async (path, opts = {}) => {
//   const res  = await fetch(`${API}${path}`, { headers: hdrs, ...opts });
//   const data = await res.json();
//   if (!res.ok) throw new Error(data.detail || "Request failed");
//   return data;
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // STORES & BRANCHES SECTION
// // ══════════════════════════════════════════════════════════════════════════════
// function StoresSection() {
//   const [stores,    setStores]    = useState([]);
//   const [loading,   setLoading]   = useState(false);
//   const [saving,    setSaving]    = useState(false);
//   const [showForm,  setShowForm]  = useState(false);
//   const [expanded,  setExpanded]  = useState({});
//   const [form,      setForm]      = useState({ name:"", code:"", type:"store", city:"", address:"", phone:"", parent_id:"" });

//   const fetchStores = useCallback(async () => {
//     try {
//       setLoading(true);
//       const data = await api("/hq/stores");
//       setStores(data.data || []);
//     } catch { toast.error("Failed to load stores"); }
//     finally { setLoading(false); }
//   }, []);

//   useEffect(() => { fetchStores(); }, [fetchStores]);

//   const handleSave = async () => {
//     if (!form.name.trim() || !form.code.trim()) { toast.error("Name and Code are required"); return; }
//     if (form.type === "branch" && !form.parent_id) { toast.error("Select a parent store for the branch"); return; }
//     try {
//       setSaving(true);
//       await api("/hq/stores", { method:"POST", body: JSON.stringify(form) });
//       toast.success(`${form.type === "branch" ? "Branch" : "Store"} created!`);
//       setShowForm(false);
//       setForm({ name:"", code:"", type:"store", city:"", address:"", phone:"", parent_id:"" });
//       fetchStores();
//     } catch (e) { toast.error(e.message); }
//     finally { setSaving(false); }
//   };

//   const handleDelete = (id, name) => {
//     toast((t) => (
//       <div className="flex flex-col gap-3 p-1">
//         <span className="font-bold text-black">Delete <b>{name}</b>?</span>
//         <div className="flex gap-2 justify-end">
//           <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-bold bg-slate-100 border border-slate-200 rounded-lg">Cancel</button>
//           <button onClick={async () => {
//             toast.dismiss(t.id);
//             try { await api(`/hq/stores/${id}`, { method:"DELETE" }); toast.success("Deleted"); fetchStores(); }
//             catch (e) { toast.error(e.message); }
//           }} className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg">Delete</button>
//         </div>
//       </div>
//     ), { duration: Infinity, style: { background:"#fff", border:"1px solid #e2e8f0" } });
//   };

//   const parentStores = stores.filter(s => s.type === "store");

//   return (
//     <div className="space-y-4">
//       <div className="flex items-center justify-between">
//         <div>
//           <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
//             <Store className="w-4 h-4 text-indigo-600"/> Stores & Branches
//           </h3>
//           <p className="text-xs text-slate-500 mt-0.5">{stores.length} store{stores.length !== 1?"s":""} configured</p>
//         </div>
//         <button onClick={() => setShowForm(s => !s)}
//           className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition">
//           <Plus className="w-3.5 h-3.5"/> Add Store / Branch
//         </button>
//       </div>

//       {/* Add form */}
//       {showForm && (
//         <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-4">
//           <div className="flex items-center justify-between">
//             <p className="text-sm font-bold text-indigo-800">New Store / Branch</p>
//             <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
//           </div>

//           {/* Type toggle */}
//           <div className="flex gap-2">
//             {[["store","Store","🏪"],["branch","Branch","🌿"]].map(([val,label,emoji]) => (
//               <button key={val} type="button"
//                 onClick={() => setForm(f => ({ ...f, type:val, parent_id: val==="store"?"":f.parent_id }))}
//                 className={`flex-1 py-2 text-xs font-bold rounded-xl border-2 transition ${form.type===val?"border-indigo-500 bg-white text-indigo-700":"border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
//                 {emoji} {label}
//               </button>
//             ))}
//           </div>

//           {/* Parent store — only for branch */}
//           {form.type === "branch" && (
//             <div>
//               <label className={LBL}>Parent Store *</label>
//               <select className={INP} value={form.parent_id} onChange={e => setForm(f => ({...f, parent_id:e.target.value}))}>
//                 <option value="">— Select parent store —</option>
//                 {parentStores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
//               </select>
//             </div>
//           )}

//           <div className="grid grid-cols-2 gap-3">
//             <div>
//               <label className={LBL}>Name *</label>
//               <input className={INP} value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Phoenix Mall"/>
//             </div>
//             <div>
//               <label className={LBL}>Code *</label>
//               <input className={INP + " uppercase font-mono"} value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="e.g. PHX"/>
//             </div>
//             <div>
//               <label className={LBL}>City</label>
//               <input className={INP} value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} placeholder="Mumbai"/>
//             </div>
//             <div>
//               <label className={LBL}>Phone</label>
//               <input className={INP} value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} placeholder="+91..."/>
//             </div>
//             <div className="col-span-2">
//               <label className={LBL}>Address</label>
//               <input className={INP} value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))} placeholder="Full address"/>
//             </div>
//           </div>

//           <div className="flex justify-end gap-2">
//             <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">Cancel</button>
//             <button onClick={handleSave} disabled={saving}
//               className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
//               {saving ? "Saving…" : `Create ${form.type === "branch" ? "Branch" : "Store"}`}
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Stores list */}
//       {loading ? (
//         <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
//           <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"/> Loading…
//         </div>
//       ) : stores.length === 0 ? (
//         <div className="text-center py-8 text-sm text-slate-400">
//           No stores yet. Click "Add Store / Branch" to create your first store.
//         </div>
//       ) : (
//         <div className="space-y-2">
//           {stores.map(s => (
//             <div key={s.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
//               <div className="flex items-center justify-between px-4 py-3">
//                 <div className="flex items-center gap-3">
//                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black ${s.type==="store"?"bg-indigo-600":"bg-slate-500"}`}>
//                     {s.type === "store" ? "S" : "B"}
//                   </div>
//                   <div>
//                     <p className="text-sm font-bold text-slate-900">{s.name}</p>
//                     <p className="text-xs text-slate-400 font-mono">{s.code} {s.city ? `· ${s.city}` : ""}</p>
//                   </div>
//                 </div>
//                 <div className="flex items-center gap-2">
//                   {s.branches?.length > 0 && (
//                     <button onClick={() => setExpanded(e => ({...e,[s.id]:!e[s.id]}))}
//                       className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-50 transition">
//                       {expanded[s.id] ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
//                       {s.branches.length} branch{s.branches.length!==1?"es":""}
//                     </button>
//                   )}
//                   <button onClick={() => handleDelete(s.id, s.name)}
//                     className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5"/></button>
//                 </div>
//               </div>

//               {/* Branches */}
//               {expanded[s.id] && s.branches?.length > 0 && (
//                 <div className="border-t border-slate-100 bg-slate-50/50">
//                   {s.branches.map(b => (
//                     <div key={b.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0">
//                       <div className="flex items-center gap-3">
//                         <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-3"/>
//                         <div>
//                           <p className="text-xs font-bold text-slate-700">{b.name}</p>
//                           <p className="text-[10px] text-slate-400 font-mono">{b.code}</p>
//                         </div>
//                       </div>
//                       <button onClick={() => handleDelete(b.id, b.name)}
//                         className="p-1 text-rose-400 hover:bg-rose-50 rounded-lg transition"><Trash2 className="w-3 h-3"/></button>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // STORE ADMINS SECTION
// // ══════════════════════════════════════════════════════════════════════════════
// function StoreAdminsSection() {
//   const [admins,   setAdmins]   = useState([]);
//   const [stores,   setStores]   = useState([]);
//   const [loading,  setLoading]  = useState(false);
//   const [saving,   setSaving]   = useState(false);
//   const [showForm, setShowForm] = useState(false);
//   const [form,     setForm]     = useState({ name:"", email:"", phone:"", store_id:"" });

//   const fetchAll = useCallback(async () => {
//     try {
//       setLoading(true);
//       const [admData, stData] = await Promise.all([
//         api("/hq/store-admins"),
//         api("/hq/stores"),
//       ]);
//       setAdmins(admData.data || []);
//       setStores(stData.data  || []);
//     } catch { toast.error("Failed to load data"); }
//     finally { setLoading(false); }
//   }, []);

//   useEffect(() => { fetchAll(); }, [fetchAll]);

//  const handleSave = async () => {
//     if (!form.name.trim() || !form.code.trim()) { toast.error("Name and Code are required"); return; }
//     if (form.type === "branch" && !form.parent_id) { toast.error("Select a parent store for the branch"); return; }
//     try {
//       setSaving(true);
//       await api("/hq/stores", { method:"POST", body: JSON.stringify(form) });
//       toast.success(`${form.type === "branch" ? "Branch" : "Store"} created!`);
//       setShowForm(false);
//       if (form.type === "branch" && form.parent_id) {
//         setExpanded(e => ({ ...e, [form.parent_id]: true })); // auto-expand parent so new branch is visible
//       }
//       setForm({ name:"", code:"", type:"store", city:"", address:"", phone:"", parent_id:"" });
//       fetchStores();
//     } catch (e) { toast.error(e.message); }
//     finally { setSaving(false); }
//   };



//   const handleDelete = (id, name) => {
//     toast((t) => (
//       <div className="flex flex-col gap-3 p-1">
//         <span className="font-bold text-black">Remove <b>{name}</b>?</span>
//         <div className="flex gap-2 justify-end">
//           <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-bold bg-slate-100 border border-slate-200 rounded-lg">Cancel</button>
//           <button onClick={async () => {
//             toast.dismiss(t.id);
//             try { await api(`/hq/store-admins/${id}`, { method:"DELETE" }); toast.success("Removed"); fetchAll(); }
//             catch (e) { toast.error(e.message); }
//           }} className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg">Remove</button>
//         </div>
//       </div>
//     ), { duration: Infinity, style: { background:"#fff", border:"1px solid #e2e8f0" } });
//   };

//   // Flatten stores + branches for dropdown
//   const storeOptions = stores.flatMap(s => [
//     { id: s.id, label: `🏪 ${s.name} (${s.code})` },
//     ...(s.branches||[]).map(b => ({ id: b.id, label: `  🌿 ${b.name} (${b.code})` }))
//   ]);

//   return (
//     <div className="space-y-4">
//       <div className="flex items-center justify-between">
//         <div>
//           <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
//             <Users className="w-4 h-4 text-indigo-600"/> Store Admins
//           </h3>
//           <p className="text-xs text-slate-500 mt-0.5">{admins.length} admin{admins.length!==1?"s":""} assigned</p>
//         </div>
//         <button onClick={() => setShowForm(s=>!s)}
//           className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition">
//           <Plus className="w-3.5 h-3.5"/> Add Store Admin
//         </button>
//       </div>

//       {showForm && (
//         <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-4">
//           <div className="flex items-center justify-between">
//             <p className="text-sm font-bold text-indigo-800">New Store Admin</p>
//             <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-slate-400"/></button>
//           </div>
//           <div className="grid grid-cols-2 gap-3">
//             <div className="col-span-2">
//               <label className={LBL}>Assign to Store / Branch *</label>
//               <select className={INP} value={form.store_id} onChange={e => setForm(f=>({...f,store_id:e.target.value}))}>
//                 <option value="">— Select store or branch —</option>
//                 {storeOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
//               </select>
//             </div>
//             <div>
//               <label className={LBL}>Full Name *</label>
//               <input className={INP} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Rahul Sharma"/>
//             </div>
//             <div>
//               <label className={LBL}>Phone</label>
//               <input className={INP} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+91..."/>
//             </div>
//             <div className="col-span-2">
//               <label className={LBL}>Email *</label>
//               <input type="email" className={INP} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="store@company.com"/>
//               <p className="text-[10px] text-indigo-600 mt-1">A setup email will be sent to this address.</p>
//             </div>
//           </div>
//           <div className="flex justify-end gap-2">
//             <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">Cancel</button>
//             <button onClick={handleSave} disabled={saving}
//               className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
//               {saving ? "Creating…" : "Create & Send Email"}
//             </button>
//           </div>
//         </div>
//       )}

//       {loading ? (
//         <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
//           <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"/>Loading…
//         </div>
//       ) : admins.length === 0 ? (
//         <div className="text-center py-8 text-sm text-slate-400">No store admins yet.</div>
//       ) : (
//         <div className="space-y-2">
//           {admins.map(a => (
//             <div key={a.id} className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl">
//               <div className="flex items-center gap-3">
//                 <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-black">
//                   {a.name?.charAt(0).toUpperCase()}
//                 </div>
//                 <div>
//                   <p className="text-sm font-bold text-slate-900">{a.name}</p>
//                   <p className="text-xs text-slate-400">{a.email} · <span className="font-semibold text-slate-600">{a.store_name || "No store"}</span></p>
//                 </div>
//               </div>
//               <div className="flex items-center gap-2">
//                 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.status==="ACTIVE"||a.status==="Active"?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>
//                   {a.password_set ? "Active" : "Pending Setup"}
//                 </span>
//                 <button onClick={() => handleDelete(a.id, a.name)}
//                   className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5"/></button>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // SETUP CHECKLIST
// // ══════════════════════════════════════════════════════════════════════════════
// function SetupChecklist({ summary }) {
//   if (!summary) return null;
//   const steps = [
//     { done: summary.stores_added,       label: "Add at least one store",        sub: `${summary.store_count} store(s) created`        },
//     { done: summary.branches_added,     label: "Add branches (optional)",        sub: `${summary.branch_count} branch(es) created`     },
//     { done: summary.store_admins_added, label: "Assign store admins",            sub: `${summary.admin_count} admin(s) assigned`       },
//   ];
//   const allDone = steps.every(s => s.done);
//   return (
//     <div className={`rounded-2xl border p-4 ${allDone ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
//       <div className="flex items-center gap-2 mb-3">
//         {allDone
//           ? <CheckCircle className="w-4 h-4 text-emerald-600"/>
//           : <AlertCircle className="w-4 h-4 text-amber-600"/>}
//         <p className={`text-xs font-black uppercase tracking-wide ${allDone?"text-emerald-700":"text-amber-700"}`}>
//           {allDone ? "Setup Complete ✓" : "First Time Setup"}
//         </p>
//       </div>
//       <div className="space-y-2">
//         {steps.map((s, i) => (
//           <div key={i} className="flex items-center gap-3">
//             {s.done
//               ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0"/>
//               : <Circle className="w-4 h-4 text-slate-300 shrink-0"/>}
//             <div>
//               <p className={`text-xs font-bold ${s.done?"text-emerald-700":"text-slate-700"}`}>{s.label}</p>
//               <p className="text-[10px] text-slate-500">{s.sub}</p>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // MAIN EXPORT — HQSetup
// // ══════════════════════════════════════════════════════════════════════════════
// export default function HQSetup() {
//   const [activeSection, setActiveSection] = useState("stores");
//   const [summary,       setSummary]       = useState(null);

//   useEffect(() => {
//     api("/hq/setup-summary")
//       .then(d => setSummary(d))
//       .catch(() => {});
//   }, [activeSection]); // refresh after each section change

//   const sections = [
//     { id:"stores",       label:"Stores & Branches", icon:<Store className="w-4 h-4"/>   },
//     { id:"store-admins", label:"Store Admins",       icon:<Users className="w-4 h-4"/>   },
//   ];

//   return (
//     <div className="min-h-full p-4 sm:p-6 space-y-5">

//       {/* Header */}
//       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//         <div className="flex items-center gap-3">
//           <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
//             <Building2 className="w-5 h-5 text-white"/>
//           </div>
//           <div>
//             <h1 className="text-xl font-black text-slate-900">Setup</h1>
//             <p className="text-xs text-slate-500 mt-0.5">Configure your stores, branches and admins</p>
//           </div>
//         </div>
//       </div>

//       {/* Checklist */}
//       <SetupChecklist summary={summary} />

//       {/* Section tabs */}
//       <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-max">
//         {sections.map(s => (
//           <button key={s.id} onClick={() => setActiveSection(s.id)}
//             className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition ${
//               activeSection === s.id ? "bg-white text-indigo-700 shadow border border-slate-200" : "text-slate-500 hover:text-slate-800"
//             }`}>
//             {s.icon} {s.label}
//           </button>
//         ))}
//       </div>

//       {/* Section content */}
//       <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
//         {activeSection === "stores"       && <StoresSection />}
//         {activeSection === "store-admins" && <StoreAdminsSection />}
//       </div>
//     </div>
//   );
// }



// import React, { useEffect, useState, useCallback } from "react";
// import {
//   Store, GitBranch, Users, CheckCircle, Circle,
//   Plus, Trash2, Edit, X, ChevronDown, ChevronRight,
//   Building2, AlertCircle
// } from "lucide-react";
// import toast from "react-hot-toast";

// const API   = APP_API_URL;
// const INP = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition bg-white";
// const LBL = "block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5";

// // ── API helpers ────────────────────────────────────────────────────────────────
// const api = async (path, opts = {}) => {
//   const token = localStorage.getItem("admin_token") || "";
//   const res   = await fetch(`${API}${path}`, {
//     headers: {
//       Authorization:  `Bearer ${token}`,
//       "Content-Type": "application/json",
//       ...(opts.headers || {}),
//     },
//     ...opts,
//   });
//   const data = await res.json();
//   if (!res.ok) throw new Error(data.detail || "Request failed");
//   return data;
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // STORES & BRANCHES SECTION
// // ══════════════════════════════════════════════════════════════════════════════
// function StoresSection() {
//   const [stores,    setStores]    = useState([]);
//   const [loading,   setLoading]   = useState(false);
//   const [saving,    setSaving]    = useState(false);
//   const [showForm,  setShowForm]  = useState(false);
//   const [expanded,  setExpanded]  = useState({});
//   const [form,      setForm]      = useState({ name:"", code:"", type:"store", city:"", address:"", phone:"", parent_id:"" });

//   const fetchStores = useCallback(async () => {
//     try {
//       setLoading(true);
//       const data = await api("/hq/stores");
//       setStores(data.data || []);
//     } catch { toast.error("Failed to load stores"); }
//     finally { setLoading(false); }
//   }, []);

//   useEffect(() => { fetchStores(); }, [fetchStores]);

//   const handleSave = async () => {
//     if (!form.name.trim() || !form.code.trim()) { toast.error("Name and Code are required"); return; }
//     if (form.type === "branch" && !form.parent_id) { toast.error("Select a parent store for the branch"); return; }
//     try {
//       setSaving(true);
//       await api("/hq/stores", { method:"POST", body: JSON.stringify(form) });
//       toast.success(`${form.type === "branch" ? "Branch" : "Store"} created!`);
//       setShowForm(false);
//       setForm({ name:"", code:"", type:"store", city:"", address:"", phone:"", parent_id:"" });
//       fetchStores();
//     } catch (e) { toast.error(e.message); }
//     finally { setSaving(false); }
//   };

//   const handleDelete = (id, name) => {
//     toast((t) => (
//       <div className="flex flex-col gap-3 p-1">
//         <span className="font-bold text-black">Delete <b>{name}</b>?</span>
//         <div className="flex gap-2 justify-end">
//           <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-bold bg-slate-100 border border-slate-200 rounded-lg">Cancel</button>
//           <button onClick={async () => {
//             toast.dismiss(t.id);
//             try { await api(`/hq/stores/${id}`, { method:"DELETE" }); toast.success("Deleted"); fetchStores(); }
//             catch (e) {
//   console.error("Delete error:", e);
//   toast.error(e.message || "Delete failed");
// }
//           }} className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg">Delete</button>
//         </div>
//       </div>
//     ), { duration: Infinity, style: { background:"#fff", border:"1px solid #e2e8f0" } });
//   };

//   const parentStores = stores.filter(s => s.type === "store");

//   return (
//     <div className="space-y-4">
//       <div className="flex items-center justify-between">
//         <div>
//           <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
//             <Store className="w-4 h-4 text-indigo-600"/> Stores & Branches
//           </h3>
//           <p className="text-xs text-slate-500 mt-0.5">{stores.length} store{stores.length !== 1?"s":""} configured</p>
//         </div>
//         <button onClick={() => setShowForm(s => !s)}
//           className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition">
//           <Plus className="w-3.5 h-3.5"/> Add Store / Branch
//         </button>
//       </div>

//       {/* Add form */}
//       {showForm && (
//         <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-4">
//           <div className="flex items-center justify-between">
//             <p className="text-sm font-bold text-indigo-800">New Store / Branch</p>
//             <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
//           </div>

//           {/* Type toggle */}
//           <div className="flex gap-2">
//             {[["store","Store","🏪"],["branch","Branch","🌿"]].map(([val,label,emoji]) => (
//               <button key={val} type="button"
//                 onClick={() => setForm(f => ({ ...f, type:val, parent_id: val==="store"?"":f.parent_id }))}
//                 className={`flex-1 py-2 text-xs font-bold rounded-xl border-2 transition ${form.type===val?"border-indigo-500 bg-white text-indigo-700":"border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
//                 {emoji} {label}
//               </button>
//             ))}
//           </div>

//           {/* Parent store — only for branch */}
//           {form.type === "branch" && (
//             <div>
//               <label className={LBL}>Parent Store *</label>
//               <select className={INP} value={form.parent_id} onChange={e => setForm(f => ({...f, parent_id:e.target.value}))}>
//                 <option value="">— Select parent store —</option>
//                 {parentStores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
//               </select>
//             </div>
//           )}

//           <div className="grid grid-cols-2 gap-3">
//             <div>
//               <label className={LBL}>Name *</label>
//               <input className={INP} value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Phoenix Mall"/>
//             </div>
//             <div>
//               <label className={LBL}>Code *</label>
//               <input className={INP + " uppercase font-mono"} value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="e.g. PHX"/>
//             </div>
//             <div>
//               <label className={LBL}>City</label>
//               <input className={INP} value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} placeholder="Mumbai"/>
//             </div>
//             <div>
//               <label className={LBL}>Phone</label>
//               <input className={INP} value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} placeholder="+91..."/>
//             </div>
//             <div className="col-span-2">
//               <label className={LBL}>Address</label>
//               <input className={INP} value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))} placeholder="Full address"/>
//             </div>
//           </div>

//           <div className="flex justify-end gap-2">
//             <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">Cancel</button>
//             <button onClick={handleSave} disabled={saving}
//               className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
//               {saving ? "Saving…" : `Create ${form.type === "branch" ? "Branch" : "Store"}`}
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Stores list */}
//       {loading ? (
//         <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
//           <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"/> Loading…
//         </div>
//       ) : stores.length === 0 ? (
//         <div className="text-center py-8 text-sm text-slate-400">
//           No stores yet. Click "Add Store / Branch" to create your first store.
//         </div>
//       ) : (
//         <div className="space-y-2">
//           {stores.map(s => (
//             <div key={s.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
//               <div className="flex items-center justify-between px-4 py-3">
//                 <div className="flex items-center gap-3">
//                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black ${s.type==="store"?"bg-indigo-600":"bg-slate-500"}`}>
//                     {s.type === "store" ? "S" : "B"}
//                   </div>
//                   <div>
//                     <p className="text-sm font-bold text-slate-900">{s.name}</p>
//                     <p className="text-xs text-slate-400 font-mono">{s.code} {s.city ? `· ${s.city}` : ""}</p>
//                   </div>
//                 </div>
//                 <div className="flex items-center gap-2">
//                   {s.branches?.length > 0 && (
//                     <button onClick={() => setExpanded(e => ({...e,[s.id]:!e[s.id]}))}
//                       className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-50 transition">
//                       {expanded[s.id] ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
//                       {s.branches.length} branch{s.branches.length!==1?"es":""}
//                     </button>
//                   )}
//                   <button onClick={() => handleDelete(s.id, s.name)}
//                     className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5"/></button>
//                 </div>
//               </div>

//               {/* Branches */}
//               {expanded[s.id] && s.branches?.length > 0 && (
//                 <div className="border-t border-slate-100 bg-slate-50/50">
//                   {s.branches.map(b => (
//                     <div key={b.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0">
//                       <div className="flex items-center gap-3">
//                         <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-3"/>
//                         <div>
//                           <p className="text-xs font-bold text-slate-700">{b.name}</p>
//                           <p className="text-[10px] text-slate-400 font-mono">{b.code}</p>
//                         </div>
//                       </div>
//                       <button onClick={() => handleDelete(b.id, b.name)}
//                         className="p-1 text-rose-400 hover:bg-rose-50 rounded-lg transition"><Trash2 className="w-3 h-3"/></button>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // STORE ADMINS SECTION
// // ══════════════════════════════════════════════════════════════════════════════
// function StoreAdminsSection() {
//   const [admins,   setAdmins]   = useState([]);
//   const [stores,   setStores]   = useState([]);
//   const [loading,  setLoading]  = useState(false);
//   const [saving,   setSaving]   = useState(false);
//   const [showForm, setShowForm] = useState(false);
//   const [form,     setForm]     = useState({ name:"", email:"", phone:"", store_id:"" });

//   const fetchAll = useCallback(async () => {
//     try {
//       setLoading(true);
//       const [admData, stData] = await Promise.all([
//         api("/hq/store-admins"),
//         api("/hq/stores"),
//       ]);
//       setAdmins(admData.data || []);
//       setStores(stData.data  || []);
//     } catch { toast.error("Failed to load data"); }
//     finally { setLoading(false); }
//   }, []);

//   useEffect(() => { fetchAll(); }, [fetchAll]);

//   const handleSave = async () => {
//     if (!form.name.trim())     { toast.error("Name is required"); return; }
//     if (!form.email.trim())    { toast.error("Email is required"); return; }
//     if (!form.store_id)        { toast.error("Assign to a store"); return; }
//     try {
//       setSaving(true);
//       await api("/hq/store-admins", { method:"POST", body: JSON.stringify(form) });
//       toast.success("Store Admin created! Setup email sent.");
//       setShowForm(false);
//       setForm({ name:"", email:"", phone:"", store_id:"" });
//       fetchAll();
//     } catch (e) { toast.error(e.message); }
//     finally { setSaving(false); }
//   };

//   const handleDelete = (id, name) => {
//     toast((t) => (
//       <div className="flex flex-col gap-3 p-1">
//         <span className="font-bold text-black">Remove <b>{name}</b>?</span>
//         <div className="flex gap-2 justify-end">
//           <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-bold bg-slate-100 border border-slate-200 rounded-lg">Cancel</button>
//           <button onClick={async () => {
//             toast.dismiss(t.id);
//             try { await api(`/hq/store-admins/${id}`, { method:"DELETE" }); toast.success("Removed"); fetchAll(); }
//             catch (e) { toast.error(e.message); }
//           }} className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg">Remove</button>
//         </div>
//       </div>
//     ), { duration: Infinity, style: { background:"#fff", border:"1px solid #e2e8f0" } });
//   };

//   // Flatten stores + branches for dropdown
//   const storeOptions = stores.flatMap(s => [
//     { id: s.id, label: `🏪 ${s.name} (${s.code})` },
//     ...(s.branches||[]).map(b => ({ id: b.id, label: `  🌿 ${b.name} (${b.code})` }))
//   ]);

//   return (
//     <div className="space-y-4">
//       <div className="flex items-center justify-between">
//         <div>
//           <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
//             <Users className="w-4 h-4 text-indigo-600"/> Store Admins
//           </h3>
//           <p className="text-xs text-slate-500 mt-0.5">{admins.length} admin{admins.length!==1?"s":""} assigned</p>
//         </div>
//         <button onClick={() => setShowForm(s=>!s)}
//           className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition">
//           <Plus className="w-3.5 h-3.5"/> Add Store Admin
//         </button>
//       </div>

//       {showForm && (
//         <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-4">
//           <div className="flex items-center justify-between">
//             <p className="text-sm font-bold text-indigo-800">New Store Admin</p>
//             <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-slate-400"/></button>
//           </div>
//           <div className="grid grid-cols-2 gap-3">
//             <div className="col-span-2">
//               <label className={LBL}>Assign to Store / Branch *</label>
//               <select className={INP} value={form.store_id} onChange={e => setForm(f=>({...f,store_id:e.target.value}))}>
//                 <option value="">— Select store or branch —</option>
//                 {storeOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
//               </select>
//             </div>
//             <div>
//               <label className={LBL}>Full Name *</label>
//               <input className={INP} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Rahul Sharma"/>
//             </div>
//             <div>
//               <label className={LBL}>Phone</label>
//               <input className={INP} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+91..."/>
//             </div>
//             <div className="col-span-2">
//               <label className={LBL}>Email *</label>
//               <input type="email" className={INP} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="store@company.com"/>
//               <p className="text-[10px] text-indigo-600 mt-1">A setup email will be sent to this address.</p>
//             </div>
//           </div>
//           <div className="flex justify-end gap-2">
//             <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">Cancel</button>
//             <button onClick={handleSave} disabled={saving}
//               className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
//               {saving ? "Creating…" : "Create & Send Email"}
//             </button>
//           </div>
//         </div>
//       )}

//       {loading ? (
//         <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
//           <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"/>Loading…
//         </div>
//       ) : admins.length === 0 ? (
//         <div className="text-center py-8 text-sm text-slate-400">No store admins yet.</div>
//       ) : (
//         <div className="space-y-2">
//           {admins.map(a => (
//             <div key={a.id} className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl">
//               <div className="flex items-center gap-3">
//                 <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-black">
//                   {a.name?.charAt(0).toUpperCase()}
//                 </div>
//                 <div>
//                   <p className="text-sm font-bold text-slate-900">{a.name}</p>
//                   <p className="text-xs text-slate-400">{a.email} · <span className="font-semibold text-slate-600">{a.store_name || "No store"}</span></p>
//                 </div>
//               </div>
//               <div className="flex items-center gap-2">
//                 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.status==="ACTIVE"||a.status==="Active"?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>
//                   {a.password_set ? "Active" : "Pending Setup"}
//                 </span>
//                 <button onClick={() => handleDelete(a.id, a.name)}
//                   className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5"/></button>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // SETUP CHECKLIST
// // ══════════════════════════════════════════════════════════════════════════════
// function SetupChecklist({ summary }) {
//   if (!summary) return null;
//   const steps = [
//     { done: summary.stores_added,       label: "Add at least one store",        sub: `${summary.store_count} store(s) created`        },
//     { done: summary.branches_added,     label: "Add branches (optional)",        sub: `${summary.branch_count} branch(es) created`     },
//     { done: summary.store_admins_added, label: "Assign store admins",            sub: `${summary.admin_count} admin(s) assigned`       },
//   ];
//   const allDone = steps.every(s => s.done);
//   return (
//     <div className={`rounded-2xl border p-4 ${allDone ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
//       <div className="flex items-center gap-2 mb-3">
//         {allDone
//           ? <CheckCircle className="w-4 h-4 text-emerald-600"/>
//           : <AlertCircle className="w-4 h-4 text-amber-600"/>}
//         <p className={`text-xs font-black uppercase tracking-wide ${allDone?"text-emerald-700":"text-amber-700"}`}>
//           {allDone ? "Setup Complete ✓" : "First Time Setup"}
//         </p>
//       </div>
//       <div className="space-y-2">
//         {steps.map((s, i) => (
//           <div key={i} className="flex items-center gap-3">
//             {s.done
//               ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0"/>
//               : <Circle className="w-4 h-4 text-slate-300 shrink-0"/>}
//             <div>
//               <p className={`text-xs font-bold ${s.done?"text-emerald-700":"text-slate-700"}`}>{s.label}</p>
//               <p className="text-[10px] text-slate-500">{s.sub}</p>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // MAIN EXPORT — HQSetup
// // ══════════════════════════════════════════════════════════════════════════════
// export default function HQSetup() {
//   const [activeSection, setActiveSection] = useState("stores");
//   const [summary,       setSummary]       = useState(null);

//   useEffect(() => {
//     api("/hq/setup-summary")
//       .then(d => setSummary(d))
//       .catch(() => {});
//   }, [activeSection]); // refresh after each section change

//   const sections = [
//     { id:"stores",       label:"Stores & Branches", icon:<Store className="w-4 h-4"/>   },
//     { id:"store-admins", label:"Store Admins",       icon:<Users className="w-4 h-4"/>   },
//   ];

//   return (
//     <div className="min-h-full p-4 sm:p-6 space-y-5">

//       {/* Header */}
//       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//         <div className="flex items-center gap-3">
//           <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
//             <Building2 className="w-5 h-5 text-white"/>
//           </div>
//           <div>
//             <h1 className="text-xl font-black text-slate-900">Setup</h1>
//             <p className="text-xs text-slate-500 mt-0.5">Configure your stores, branches and admins</p>
//           </div>
//         </div>
//       </div>

//       {/* Checklist */}
//       <SetupChecklist summary={summary} />

//       {/* Section tabs */}
//       <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-max">
//         {sections.map(s => (
//           <button key={s.id} onClick={() => setActiveSection(s.id)}
//             className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition ${
//               activeSection === s.id ? "bg-white text-indigo-700 shadow border border-slate-200" : "text-slate-500 hover:text-slate-800"
//             }`}>
//             {s.icon} {s.label}
//           </button>
//         ))}
//       </div>

//       {/* Section content */}
//       <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
//         {activeSection === "stores"       && <StoresSection />}
//         {activeSection === "store-admins" && <StoreAdminsSection />}
//       </div>
//     </div>
//   );
// }

import React, { useEffect, useState, useCallback } from "react";
import {
  Store, GitBranch, Users, CheckCircle, Circle,
  Plus, Trash2, Edit, X, ChevronDown, ChevronRight,
  Building2, AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";

const API   = APP_API_URL;
const INP = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition bg-white";
const LBL = "block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5";

// ── API helpers ────────────────────────────────────────────────────────────────
const api = async (path, opts = {}) => {
  const token = localStorage.getItem("admin_token") || "";
  const res   = await fetch(`${API}${path}`, {
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
};

// ══════════════════════════════════════════════════════════════════════════════
// STORES & BRANCHES SECTION
// ══════════════════════════════════════════════════════════════════════════════
function StoresSection() {
  const [stores,    setStores]    = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [expanded,  setExpanded]  = useState({});
  const [form,      setForm]      = useState({ name:"", code:"", type:"store", city:"", address:"", phone:"", parent_id:"" });

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api("/hq/stores");
      setStores(data.data || []);
    } catch { toast.error("Failed to load stores"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error("Name and Code are required"); return; }
    if (form.type === "branch" && !form.parent_id) { toast.error("Select a parent store for the branch"); return; }
    try {
      setSaving(true);
      await api("/hq/stores", { method:"POST", body: JSON.stringify(form) });
      toast.success(`${form.type === "branch" ? "Branch" : "Store"} created!`);
      setShowForm(false);
      setForm({ name:"", code:"", type:"store", city:"", address:"", phone:"", parent_id:"" });
      fetchStores();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (id, name) => {
    toast((t) => (
      <div className="flex flex-col gap-3 p-1">
        <span className="font-bold text-black">Delete <b>{name}</b>?</span>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-bold bg-slate-100 border border-slate-200 rounded-lg">Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            try {
              await api(`/hq/stores/${id}`, { method:"DELETE" });
              toast.success("Deleted successfully!");
              fetchStores();
            } catch (e) {
              toast.error(e.message || "Delete failed");
            }
          }} className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg">Delete</button>
        </div>
      </div>
    ), { duration: Infinity, style: { background:"#fff", border:"1px solid #e2e8f0" } });
  };

  const parentStores = stores.filter(s => s.type === "store");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <Store className="w-4 h-4 text-indigo-600"/> Stores & Branches
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{stores.length} store{stores.length !== 1?"s":""} configured</p>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition">
          <Plus className="w-3.5 h-3.5"/> Add Store / Branch
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-indigo-800">New Store / Branch</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
          </div>

          {/* Type toggle */}
          <div className="flex gap-2">
            {[["store","Store","🏪"],["branch","Branch","🌿"]].map(([val,label,emoji]) => (
              <button key={val} type="button"
                onClick={() => setForm(f => ({ ...f, type:val, parent_id: val==="store"?"":f.parent_id }))}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border-2 transition ${form.type===val?"border-indigo-500 bg-white text-indigo-700":"border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                {emoji} {label}
              </button>
            ))}
          </div>

          {/* Parent store — only for branch */}
          {form.type === "branch" && (
            <div>
              <label className={LBL}>Parent Store *</label>
              <select className={INP} value={form.parent_id} onChange={e => setForm(f => ({...f, parent_id:e.target.value}))}>
                <option value="">— Select parent store —</option>
                {parentStores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Name *</label>
              <input className={INP} value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Phoenix Mall"/>
            </div>
            <div>
              <label className={LBL}>Code *</label>
              <input className={INP + " uppercase font-mono"} value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="e.g. PHX"/>
            </div>
            <div>
              <label className={LBL}>City</label>
              <input className={INP} value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} placeholder="Mumbai"/>
            </div>
            <div>
              <label className={LBL}>Phone</label>
              <input className={INP} value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} placeholder="+91..."/>
            </div>
            <div className="col-span-2">
              <label className={LBL}>Address</label>
              <input className={INP} value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))} placeholder="Full address"/>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
              {saving ? "Saving…" : `Create ${form.type === "branch" ? "Branch" : "Store"}`}
            </button>
          </div>
        </div>
      )}

      {/* Stores list */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"/> Loading…
        </div>
      ) : stores.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400">
          No stores yet. Click "Add Store / Branch" to create your first store.
        </div>
      ) : (
        <div className="space-y-2">
          {stores.map(s => (
            <div key={s.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black ${s.type==="store"?"bg-indigo-600":"bg-slate-500"}`}>
                    {s.type === "store" ? "S" : "B"}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{s.code} {s.city ? `· ${s.city}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.branches?.length > 0 && (
                    <button onClick={() => setExpanded(e => ({...e,[s.id]:!e[s.id]}))}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-50 transition">
                      {expanded[s.id] ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                      {s.branches.length} branch{s.branches.length!==1?"es":""}
                    </button>
                  )}
                  <button onClick={() => handleDelete(s.id, s.name)}
                    className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              </div>

              {/* Branches */}
              {expanded[s.id] && s.branches?.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50/50">
                  {s.branches.map(b => (
                    <div key={b.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-3"/>
                        <div>
                          <p className="text-xs font-bold text-slate-700">{b.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{b.code}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDelete(b.id, b.name)}
                        className="p-1 text-rose-400 hover:bg-rose-50 rounded-lg transition"><Trash2 className="w-3 h-3"/></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STORE ADMINS SECTION
// ══════════════════════════════════════════════════════════════════════════════
function StoreAdminsSection() {
  const [admins,   setAdmins]   = useState([]);
  const [stores,   setStores]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ name:"", email:"", phone:"", store_id:"" });

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [admData, stData] = await Promise.all([
        api("/hq/store-admins"),
        api("/hq/stores"),
      ]);
      setAdmins(admData.data || []);
      setStores(stData.data  || []);
    } catch { toast.error("Failed to load data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = async () => {
    if (!form.name.trim())     { toast.error("Name is required"); return; }
    if (!form.email.trim())    { toast.error("Email is required"); return; }
    if (!form.store_id)        { toast.error("Assign to a store"); return; }
    try {
      setSaving(true);
      await api("/hq/store-admins", { method:"POST", body: JSON.stringify(form) });
      toast.success("Store Admin created! Setup email sent.");
      setShowForm(false);
      setForm({ name:"", email:"", phone:"", store_id:"" });
      fetchAll();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (id, name) => {
    toast((t) => (
      <div className="flex flex-col gap-3 p-1">
        <span className="font-bold text-black">Remove <b>{name}</b>?</span>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-bold bg-slate-100 border border-slate-200 rounded-lg">Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            try {
              await api(`/hq/store-admins/${id}`, { method:"DELETE" });
              toast.success("Admin removed!");
              fetchAll();
            } catch (e) {
              toast.error(e.message || "Delete failed");
            }
          }} className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg">Remove</button>
        </div>
      </div>
    ), { duration: Infinity, style: { background:"#fff", border:"1px solid #e2e8f0" } });
  };

  // Flatten stores + branches for dropdown
  const storeOptions = stores.flatMap(s => [
    { id: s.id, label: `🏪 ${s.name} (${s.code})` },
    ...(s.branches||[]).map(b => ({ id: b.id, label: `  🌿 ${b.name} (${b.code})` }))
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600"/> Store Admins
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{admins.length} admin{admins.length!==1?"s":""} assigned</p>
        </div>
        <button onClick={() => setShowForm(s=>!s)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition">
          <Plus className="w-3.5 h-3.5"/> Add Store Admin
        </button>
      </div>

      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-indigo-800">New Store Admin</p>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-slate-400"/></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={LBL}>Assign to Store / Branch *</label>
              <select className={INP} value={form.store_id} onChange={e => setForm(f=>({...f,store_id:e.target.value}))}>
                <option value="">— Select store or branch —</option>
                {storeOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={LBL}>Full Name *</label>
              <input className={INP} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Rahul Sharma"/>
            </div>
            <div>
              <label className={LBL}>Phone</label>
              <input className={INP} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+91..."/>
            </div>
            <div className="col-span-2">
              <label className={LBL}>Email *</label>
              <input type="email" className={INP} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="store@company.com"/>
              <p className="text-[10px] text-indigo-600 mt-1">A setup email will be sent to this address.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
              {saving ? "Creating…" : "Create & Send Email"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"/>Loading…
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400">No store admins yet.</div>
      ) : (
        <div className="space-y-2">
          {admins.map(a => (
            <div key={a.id} className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-black">
                  {a.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{a.name}</p>
                  <p className="text-xs text-slate-400">{a.email} · <span className="font-semibold text-slate-600">{a.store_name || "No store"}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.status==="ACTIVE"||a.status==="Active"?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>
                  {a.password_set ? "Active" : "Pending Setup"}
                </span>
                <button onClick={() => handleDelete(a.id, a.name)}
                  className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SETUP CHECKLIST
// ══════════════════════════════════════════════════════════════════════════════
function SetupChecklist({ summary }) {
  if (!summary) return null;
  const steps = [
    { done: summary.stores_added,       label: "Add at least one store",        sub: `${summary.store_count} store(s) created`        },
    { done: summary.branches_added,     label: "Add branches (optional)",        sub: `${summary.branch_count} branch(es) created`     },
    { done: summary.store_admins_added, label: "Assign store admins",            sub: `${summary.admin_count} admin(s) assigned`       },
  ];
  const allDone = steps.every(s => s.done);
  return (
    <div className={`rounded-2xl border p-4 ${allDone ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
      <div className="flex items-center gap-2 mb-3">
        {allDone
          ? <CheckCircle className="w-4 h-4 text-emerald-600"/>
          : <AlertCircle className="w-4 h-4 text-amber-600"/>}
        <p className={`text-xs font-black uppercase tracking-wide ${allDone?"text-emerald-700":"text-amber-700"}`}>
          {allDone ? "Setup Complete ✓" : "First Time Setup"}
        </p>
      </div>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            {s.done
              ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0"/>
              : <Circle className="w-4 h-4 text-slate-300 shrink-0"/>}
            <div>
              <p className={`text-xs font-bold ${s.done?"text-emerald-700":"text-slate-700"}`}>{s.label}</p>
              <p className="text-[10px] text-slate-500">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — HQSetup
// ══════════════════════════════════════════════════════════════════════════════
export default function HQSetup() {
  const [activeSection, setActiveSection] = useState("stores");
  const [summary,       setSummary]       = useState(null);

  useEffect(() => {
    api("/hq/setup-summary")
      .then(d => setSummary(d))
      .catch(() => {});
  }, [activeSection]); // refresh after each section change

  const sections = [
    { id:"stores",       label:"Stores & Branches", icon:<Store className="w-4 h-4"/>   },
    { id:"store-admins", label:"Store Admins",       icon:<Users className="w-4 h-4"/>   },
  ];

  return (
    <div className="min-h-full p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-white"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Setup</h1>
            <p className="text-xs text-slate-500 mt-0.5">Configure your stores, branches and admins</p>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <SetupChecklist summary={summary} />

      {/* Section tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-max">
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition ${
              activeSection === s.id ? "bg-white text-indigo-700 shadow border border-slate-200" : "text-slate-500 hover:text-slate-800"
            }`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        {activeSection === "stores"       && <StoresSection />}
        {activeSection === "store-admins" && <StoreAdminsSection />}
      </div>
    </div>
  );
}