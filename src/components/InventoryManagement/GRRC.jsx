import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

// import React, { useState, useEffect, useMemo, useCallback } from "react";

// /* ─── API ──── */
// const GRC_API = `${APP_API_URL}/grc`;
// const PO_API  = `${APP_API_URL}/purchaseorders`;

// /* ─── Helpers ──────────────────────────────────────────────────── */
// const n0     = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// const clamp0 = (v) => Math.max(0, n0(v));
// const money  = (v) => clamp0(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// const today  = () => new Date().toISOString().slice(0, 10);

// const EMPTY_ITEM = (poItem = {}) => ({
//   barcode:         poItem.barcode      || "",
//   description:     poItem.description  || "",
//   poQty:           poItem.amendedQty   || poItem.quantity || 0,
//   receivedQty:     poItem.amendedQty   || poItem.quantity || "",
//   acceptedQty:     "",
//   rejectedQty:     0,
//   rejectionReason: "",
//   // Prefer vendorRate (agreed rate after approval),
//   // fall back to rate (buyer's original if PO not yet approved)
//   rate:            poItem.vendorRate   || poItem.rate || 0,
//   remarks:         "",
// });

// /* ─── Status config ────────────────────────────────────────────── */
// const STATUS_META = {
//   Draft:    { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
//   Pending:  { bg: "#FFFBEB", text: "#92400E", dot: "#F59E0B" },
//   Approved: { bg: "#ECFDF5", text: "#065F46", dot: "#10B981" },
//   Rejected: { bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444" },
// };

// /* ─── GRC Type config ──────────────────────────────────────────── */
// const GRC_TYPE = {
//   po_linked: { label: "PO-Linked",  color: "#6366F1", bg: "#EEF2FF", icon: "🔗" },
//   direct:    { label: "Direct / Walk-in", color: "#0EA5E9", bg: "#E0F2FE", icon: "📦" },
// };

// function StatusPill({ s }) {
//   const m = STATUS_META[s] || { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" };
//   return (
//     <span style={{
//       display: "inline-flex", alignItems: "center", gap: 5,
//       padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
//       background: m.bg, color: m.text, letterSpacing: ".3px",
//     }}>
//       <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
//       {s || "—"}
//     </span>
//   );
// }

// function GRCTypeBadge({ poNo }) {
//   const isLinked = !!(poNo && poNo.trim());
//   const t = isLinked ? GRC_TYPE.po_linked : GRC_TYPE.direct;
//   return (
//     <span style={{
//       display: "inline-flex", alignItems: "center", gap: 4,
//       padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
//       background: t.bg, color: t.color, letterSpacing: ".3px",
//     }}>
//       {t.icon} {t.label}
//     </span>
//   );
// }

// /* ══════════════════════════════════════════════════════════════════
//    ROOT
// ══════════════════════════════════════════════════════════════════ */
// export default function GRCManager() {
//   const [grcs,        setGrcs]        = useState([]);
//   const [loading,     setLoading]     = useState(false);
//   const [toast,       setToast]       = useState(null);
//   const [modal,       setModal]       = useState(null);
//   const [active,      setActive]      = useState(null);
//   const [rejectInput, setRejectInput] = useState("");
//   const [search,      setSearch]      = useState("");
//   const [filterStatus,setFilterStatus]= useState("All");
//   const [filterType,  setFilterType]  = useState("All"); // "All" | "po_linked" | "direct"

//   const showToast = (msg, type = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   const fetchGRCs = useCallback(async () => {
//     try {
//       setLoading(true);
//       const res  = await fetch(GRC_API);
//       if (!res.ok) throw new Error("Failed to fetch GRCs");
//       const data = await res.json();
//       setGrcs(Array.isArray(data) ? data.reverse() : []);
//     } catch (e) {
//       showToast(e.message, "error");
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => { fetchGRCs(); }, [fetchGRCs]);

//   /* ── Save ── */
//   const handleSave = async (payload) => {
//     const isEdit = !!payload.id;
//     try {
//       const res = await fetch(
//         isEdit ? `${GRC_API}/${payload.id}` : GRC_API,
//         { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
//       );
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Save failed");
//       showToast(isEdit ? "GRC updated successfully" : "GRC created successfully");
//       setModal(null); setActive(null);
//       fetchGRCs();
//     } catch (e) {
//       showToast(e.message, "error");
//     }
//   };

//   /* ── Approve ── */
//   const handleApprove = async (grc) => {
//     try {
//       setLoading(true);
//       const res  = await fetch(`${GRC_API}/${grc.id}/approve`, { method: "POST" });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Approval failed");
//       showToast(data.message || "GRC Approved");
//       fetchGRCs();
//     } catch (e) {
//       showToast(e.message, "error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ── Reject ── */
//   const handleReject = async () => {
//     if (!rejectInput.trim()) return showToast("Rejection reason is required", "error");
//     try {
//       const res  = await fetch(`${GRC_API}/${active.id}/reject`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ reason: rejectInput.trim() }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Rejection failed");
//       showToast(data.message || "GRC Rejected");
//       setModal(null); setActive(null); setRejectInput("");
//       fetchGRCs();
//     } catch (e) {
//       showToast(e.message, "error");
//     }
//   };

//   /* ── Delete ── */
//   const handleDelete = async () => {
//     try {
//       const res  = await fetch(`${GRC_API}/${active.id}`, { method: "DELETE" });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Delete failed");
//       showToast("GRC deleted");
//       setModal(null); setActive(null);
//       fetchGRCs();
//     } catch (e) {
//       showToast(e.message, "error");
//     }
//   };

//   /* ── Filtered list ── */
//   const visible = useMemo(() => {
//     const q = search.toLowerCase();
//     return grcs.filter((g) => {
//       const matchStatus = filterStatus === "All" || g.status === filterStatus;
//       const isLinked    = !!(g.poNo && g.poNo.trim());
//       const matchType   =
//         filterType === "All" ||
//         (filterType === "po_linked" && isLinked) ||
//         (filterType === "direct" && !isLinked);
//       const matchSearch = !q || [g.grcNo, g.poNo, g.vendorName, g.receivedBy]
//         .some((f) => (f || "").toLowerCase().includes(q));
//       return matchStatus && matchType && matchSearch;
//     });
//   }, [grcs, search, filterStatus, filterType]);

//   /* ── KPIs ── */
//   const kpis = useMemo(() => ({
//     total:    grcs.length,
//     approved: grcs.filter((g) => g.status === "Approved").length,
//     pending:  grcs.filter((g) => g.status === "Pending" || g.status === "Draft").length,
//     rejected: grcs.filter((g) => g.status === "Rejected").length,
//     direct:   grcs.filter((g) => !(g.poNo && g.poNo.trim())).length,
//   }), [grcs]);

//   return (
//     <div style={{ minHeight: "100%", background: "#F8FAFC", fontFamily: "'DM Sans', sans-serif", color: "#0F172A" }}>
//       <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

//       {/* Toast */}
//       {toast && (
//         <div style={{
//           position: "fixed", top: 20, right: 20, zIndex: 9999,
//           padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13,
//           background: toast.type === "error" ? "#FEF2F2" : "#ECFDF5",
//           color: toast.type === "error" ? "#991B1B" : "#065F46",
//           border: `1px solid ${toast.type === "error" ? "#FECACA" : "#A7F3D0"}`,
//           boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
//           animation: "slideIn .2s ease",
//         }}>
//           {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
//         </div>
//       )}

//       <style>{`
//         @keyframes slideIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }
//         @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
//         .row-hover:hover { background: #F8FAFC !important; }
//         .btn-base { cursor:pointer; border:none; font-family:inherit; font-weight:600; border-radius:8px; transition: all .15s; }
//         .btn-base:active { transform: scale(.97); }
//         .tbl-th { padding:10px 14px; font-size:11px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:#64748B; white-space:nowrap; }
//         .tbl-td { padding:12px 14px; font-size:13px; color:#334155; white-space:nowrap; vertical-align:middle; }
//         input:focus, select:focus, textarea:focus { outline:none; border-color:#6366F1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
//         ::-webkit-scrollbar { width:5px; height:5px; }
//         ::-webkit-scrollbar-track { background:transparent; }
//         ::-webkit-scrollbar-thumb { background:#CBD5E1; border-radius:10px; }
//         .type-toggle { cursor:pointer; border:none; font-family:inherit; font-weight:600; border-radius:8px; transition:all .15s; padding:8px 14px; font-size:12px; }
//       `}</style>

//       <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 24px" }}>

//         {/* ── Header ── */}
//         <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
//           <div>
//             <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//               <div style={{ width: 36, height: 36, borderRadius: 10, background: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center" }}>
//                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                   <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
//                   <rect x="9" y="3" width="6" height="4" rx="1"/>
//                   <path d="m9 12 2 2 4-4"/>
//                 </svg>
//               </div>
//               <div>
//                 <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-.3px" }}>Goods Receipt Certificate</h1>
//                 <p style={{ margin: 0, fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Manage inbound goods receipts — PO-linked or direct walk-in</p>
//               </div>
//             </div>
//           </div>
//           {/* Split create button */}
//           <div style={{ display: "flex", gap: 8 }}>
//             <button
//               className="btn-base"
//               onClick={() => { setActive({ _grcMode: "po_linked" }); setModal("form"); }}
//               style={{ padding: "10px 16px", background: "#6366F1", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
//             >
//               🔗 PO-Linked GRC
//             </button>
//             <button
//               className="btn-base"
//               onClick={() => { setActive({ _grcMode: "direct" }); setModal("form"); }}
//               style={{ padding: "10px 16px", background: "#0EA5E9", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
//             >
//               📦 Direct GRC
//             </button>
//           </div>
//         </div>

//         {/* ── KPI Cards ── */}
//         <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 20 }}>
//           {[
//             { label: "Total GRCs",    value: kpis.total,    color: "#6366F1", bg: "#EEF2FF" },
//             { label: "Approved",      value: kpis.approved, color: "#059669", bg: "#ECFDF5" },
//             { label: "Draft/Pending", value: kpis.pending,  color: "#D97706", bg: "#FFFBEB" },
//             { label: "Rejected",      value: kpis.rejected, color: "#DC2626", bg: "#FEF2F2" },
//             { label: "Direct / Walk-in", value: kpis.direct, color: "#0EA5E9", bg: "#E0F2FE" },
//           ].map(({ label, value, color, bg }) => (
//             <div key={label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
//               <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
//                 <span style={{ fontSize: 18, fontWeight: 700, color }}>{value}</span>
//               </div>
//               <div>
//                 <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, letterSpacing: ".4px", textTransform: "uppercase" }}>{label}</div>
//               </div>
//             </div>
//           ))}
//         </div>

//         {/* ── Filters ── */}
//         <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
//           <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
//             <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
//             <input
//               placeholder="Search GRC No, PO, Vendor..."
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, background: "#fff", boxSizing: "border-box" }}
//             />
//           </div>

//           {/* Status filters */}
//           <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
//             <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>STATUS</span>
//             {["All", "Draft", "Pending", "Approved", "Rejected"].map((s) => (
//               <button
//                 key={s}
//                 className="btn-base"
//                 onClick={() => setFilterStatus(s)}
//                 style={{
//                   padding: "8px 14px", fontSize: 12,
//                   background: filterStatus === s ? "#6366F1" : "#fff",
//                   color: filterStatus === s ? "#fff" : "#64748B",
//                   border: `1px solid ${filterStatus === s ? "#6366F1" : "#E2E8F0"}`,
//                 }}
//               >
//                 {s}
//               </button>
//             ))}
//           </div>

//           {/* Type filters */}
//           <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
//             <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>TYPE</span>
//             {[
//               { key: "All",       label: "All" },
//               { key: "po_linked", label: "🔗 PO-Linked" },
//               { key: "direct",    label: "📦 Direct" },
//             ].map(({ key, label }) => (
//               <button
//                 key={key}
//                 className="type-toggle"
//                 onClick={() => setFilterType(key)}
//                 style={{
//                   background: filterType === key ? "#0F172A" : "#fff",
//                   color: filterType === key ? "#fff" : "#64748B",
//                   border: `1px solid ${filterType === key ? "#0F172A" : "#E2E8F0"}`,
//                 }}
//               >
//                 {label}
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* ── Table ── */}
//         <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden" }}>
//           <div style={{ overflowX: "auto" }}>
//             <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
//               <thead style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
//                 <tr>
//                   {["GRC No", "Type", "GRC Date", "PO No", "Vendor", "Received By", "Status", "Received", "Accepted", "Rejected", "Value (₹)", "Actions"].map((h) => (
//                     <th key={h} className="tbl-th" style={{ textAlign: ["Actions","Value (₹)","Received","Accepted","Rejected"].includes(h) ? "right" : "left" }}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {loading ? (
//                   <tr><td colSpan={12} style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
//                     <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
//                       <div style={{ width: 16, height: 16, border: "2px solid #E2E8F0", borderTopColor: "#6366F1", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
//                       Loading GRCs…
//                     </div>
//                   </td></tr>
//                 ) : visible.length === 0 ? (
//                   <tr><td colSpan={12} style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
//                     {search || filterStatus !== "All" || filterType !== "All"
//                       ? "No GRCs match your filters."
//                       : "No GRCs yet. Click 'PO-Linked GRC' or 'Direct GRC' to add one."}
//                   </td></tr>
//                 ) : visible.map((g, i) => (
//                   <tr key={g.id} className="row-hover" style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFBFF" }}>
//                     <td className="tbl-td"><span style={{ fontWeight: 700, color: "#6366F1", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{g.grcNo || "—"}</span></td>
//                     <td className="tbl-td"><GRCTypeBadge poNo={g.poNo} /></td>
//                     <td className="tbl-td">{g.grcDate || "—"}</td>
//                     <td className="tbl-td">
//                       {g.poNo
//                         ? <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600 }}>{g.poNo}</span>
//                         : <span style={{ color: "#94A3B8", fontSize: 12, fontStyle: "italic" }}>Walk-in</span>
//                       }
//                     </td>
//                     <td className="tbl-td">{g.vendorName || "—"}</td>
//                     <td className="tbl-td">{g.receivedBy || "—"}</td>
//                     <td className="tbl-td"><StatusPill s={g.status} /></td>
//                     <td className="tbl-td" style={{ textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{n0(g.totalReceivedQty).toFixed(3)}</td>
//                     <td className="tbl-td" style={{ textAlign: "right", fontFamily: "'DM Mono', monospace", color: "#059669", fontWeight: 600 }}>{n0(g.totalAcceptedQty).toFixed(3)}</td>
//                     <td className="tbl-td" style={{ textAlign: "right", fontFamily: "'DM Mono', monospace", color: n0(g.totalRejectedQty) > 0 ? "#DC2626" : "#94A3B8", fontWeight: 600 }}>{n0(g.totalRejectedQty).toFixed(3)}</td>
//                     <td className="tbl-td" style={{ textAlign: "right", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>₹{money(g.totalValue)}</td>
//                     <td className="tbl-td" style={{ textAlign: "right" }}>
//                       <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
//                         <ActionBtn color="#0EA5E9" onClick={() => { setActive(g); setModal("view"); }}>View</ActionBtn>
//                         {g.status !== "Approved" && g.status !== "Rejected" && (
//                           <ActionBtn color="#6366F1" onClick={() => { setActive(g); setModal("form"); }}>Edit</ActionBtn>
//                         )}
//                         {g.status !== "Approved" && g.status !== "Rejected" && (
//                           <ActionBtn color="#059669" onClick={() => handleApprove(g)}>Approve</ActionBtn>
//                         )}
//                         {g.status !== "Approved" && g.status !== "Rejected" && (
//                           <ActionBtn color="#F59E0B" onClick={() => { setActive(g); setRejectInput(""); setModal("reject"); }}>Reject</ActionBtn>
//                         )}
//                         {g.status !== "Approved" && (
//                           <ActionBtn color="#EF4444" onClick={() => { setActive(g); setModal("delete"); }}>Del</ActionBtn>
//                         )}
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>

//           {visible.length > 0 && (
//             <div style={{ padding: "10px 16px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//               <span style={{ fontSize: 12, color: "#94A3B8" }}>Showing {visible.length} of {grcs.length} GRCs</span>
//               <span style={{ fontSize: 12, color: "#94A3B8" }}>
//                 Total Accepted: <b style={{ color: "#059669" }}>
//                   {visible.reduce((s, g) => s + n0(g.totalAcceptedQty), 0).toFixed(3)}
//                 </b>{" "} | Value: <b style={{ color: "#334155" }}>₹{money(visible.reduce((s, g) => s + n0(g.totalValue), 0))}</b>
//               </span>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* ── Modals ── */}
//       {modal === "form" && (
//         <Overlay onClose={() => { setModal(null); setActive(null); }}>
//           <GRCForm
//             initialGRC={active}
//             onClose={() => { setModal(null); setActive(null); }}
//             onSave={handleSave}
//           />
//         </Overlay>
//       )}

//       {modal === "view" && active && (
//         <Overlay onClose={() => setModal(null)}>
//           <GRCViewModal grc={active} onClose={() => setModal(null)} />
//         </Overlay>
//       )}

//       {modal === "reject" && active && (
//         <SmallModal
//           title={`Reject ${active.grcNo}?`}
//           onClose={() => { setModal(null); setActive(null); setRejectInput(""); }}
//         >
//           <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 12px" }}>
//             Provide a reason. This cannot be undone.
//           </p>
//           <textarea
//             value={rejectInput}
//             onChange={(e) => setRejectInput(e.target.value)}
//             placeholder="e.g. Quantity mismatch, wrong item received…"
//             rows={3}
//             style={{ width: "100%", borderRadius: 8, border: "1px solid #E2E8F0", padding: "10px 12px", fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
//           />
//           <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
//             <GhostBtn onClick={() => { setModal(null); setActive(null); setRejectInput(""); }}>Cancel</GhostBtn>
//             <button className="btn-base" onClick={handleReject} style={{ padding: "9px 18px", background: "#EF4444", color: "#fff", fontSize: 13 }}>Confirm Reject</button>
//           </div>
//         </SmallModal>
//       )}

//       {modal === "delete" && active && (
//         <SmallModal
//           title="Delete GRC?"
//           onClose={() => { setModal(null); setActive(null); }}
//         >
//           <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px" }}>
//             Delete <b style={{ color: "#0F172A" }}>{active.grcNo}</b>? This cannot be undone.
//           </p>
//           <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
//             <GhostBtn onClick={() => { setModal(null); setActive(null); }}>Cancel</GhostBtn>
//             <button className="btn-base" onClick={handleDelete} style={{ padding: "9px 18px", background: "#EF4444", color: "#fff", fontSize: 13 }}>Delete</button>
//           </div>
//         </SmallModal>
//       )}

//       <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
//     </div>
//   );
// }


// /* ══════════════════════════════════════════════════════════════════
//    GRC FORM  — supports BOTH PO-linked and Direct / Walk-in modes
// ══════════════════════════════════════════════════════════════════ */
// function GRCForm({ initialGRC, onClose, onSave }) {
//   const [pos,       setPos]       = useState([]);
//   const [poLoading, setPoLoading] = useState(false);
//   const [saving,    setSaving]    = useState(false);

//   // Determine mode:
//   // - If editing an existing GRC: mode = po_linked if it has a poNo, else direct
//   // - If creating new: use _grcMode hint passed via setActive({ _grcMode: "..." })
//   const isExisting = !!(initialGRC?.id);
//   const derivedMode = isExisting
//     ? (initialGRC?.poNo ? "po_linked" : "direct")
//     : (initialGRC?._grcMode || "po_linked");

//   const [mode, setMode] = useState(derivedMode);

//   const [header, setHeader] = useState({
//     grcDate:      initialGRC?.grcDate      || today(),
//     poNo:         initialGRC?.poNo         || "",
//     vendorName:   initialGRC?.vendorName   || "",
//     receivedBy:   initialGRC?.receivedBy   || "",
//     deliveryNote: initialGRC?.deliveryNote || "",
//     vehicleNo:    initialGRC?.vehicleNo    || "",
//     remarks:      initialGRC?.remarks      || "",
//     status:       initialGRC?.status       || "Draft",
//     // Direct GRC extra fields
//     supplierRef:  initialGRC?.supplierRef  || "",
//     invoiceNo:    initialGRC?.invoiceNo    || "",
//   });

//   const [items, setItems] = useState(
//     Array.isArray(initialGRC?.items) && initialGRC.items.length
//       ? initialGRC.items.map((it) => ({ ...EMPTY_ITEM(), ...it }))
//       : [EMPTY_ITEM()]
//   );

//   const setH = (k, v) => setHeader((p) => ({ ...p, [k]: v }));

//   /* Load POs only in po_linked mode */
//   useEffect(() => {
//     if (mode !== "po_linked") return;
//     (async () => {
//       try {
//         setPoLoading(true);
//         const res  = await fetch(PO_API);
//         const data = await res.json();
//         const allowed = ["Approved", "PartiallyReceived", "WalkinAccepted"];
//         setPos(Array.isArray(data) ? data.filter((p) => allowed.includes(p.status)) : []);
//       } catch (e) { console.error(e); }
//       finally { setPoLoading(false); }
//     })();
//   }, [mode]);

//   /* When PO is selected → prefill vendor + items */
//   const handlePOSelect = (poNo) => {
//     setH("poNo", poNo);
//     const po = pos.find((p) => p.orderNo === poNo);
//     if (!po) return;
//     setH("vendorName", po.vendorName || "");
//     if (Array.isArray(po.items) && po.items.length) {
//       setItems(po.items.map(EMPTY_ITEM));
//     }
//   };

//   /* When switching mode, clear PO-related fields */
//   const handleModeSwitch = (newMode) => {
//     if (isExisting) return; // can't switch mode on existing GRC
//     setMode(newMode);
//     if (newMode === "direct") {
//       setH("poNo", "");
//       // keep vendorName editable
//     }
//   };

//   /* Item update */
//   const updateItem = (idx, k, v) => {
//     setItems((prev) => {
//       const next = [...prev];
//       const row  = { ...next[idx], [k]: v };
//       const rec  = clamp0(row.receivedQty);
//       const acc  = clamp0(row.acceptedQty);
//       row.rejectedQty = Math.max(0, rec - acc);
//       next[idx] = row;
//       return next;
//     });
//   };

//   /* Totals */
//   const totals = useMemo(() => {
//     let totalReceived = 0, totalAccepted = 0, totalRejected = 0, totalValue = 0;
//     for (const it of items) {
//       const rec = clamp0(it.receivedQty);
//       const acc = Math.min(clamp0(it.acceptedQty), rec);
//       totalReceived += rec;
//       totalAccepted += acc;
//       totalRejected += rec - acc;
//       totalValue    += acc * clamp0(it.rate);
//     }
//     return { totalReceivedQty: totalReceived, totalAcceptedQty: totalAccepted, totalRejectedQty: totalRejected, totalValue };
//   }, [items]);

//   const handleSubmit = async () => {
//     if (!header.receivedBy) return alert("Please enter Received By.");
//     if (mode === "po_linked" && !header.poNo) return alert("Please select a Purchase Order.");
//     if (!header.vendorName.trim()) return alert("Please enter Vendor Name.");
//     const hasQty = items.some((i) => clamp0(i.receivedQty) > 0);
//     if (!hasQty) return alert("Enter received quantity for at least one item.");

//     const payload = {
//       ...(initialGRC?.id ? { id: initialGRC.id } : {}),
//       ...header,
//       // For direct GRC, explicitly blank out poNo so backend knows
//       poNo: mode === "direct" ? "" : header.poNo,
//       ...totals,
//       items: items.map((it) => ({
//         ...it,
//         receivedQty: clamp0(it.receivedQty),
//         acceptedQty: Math.min(clamp0(it.acceptedQty), clamp0(it.receivedQty)),
//         rejectedQty: Math.max(0, clamp0(it.receivedQty) - clamp0(it.acceptedQty)),
//         rate:        clamp0(it.rate),
//         poQty:       mode === "direct" ? 0 : clamp0(it.poQty),
//       })),
//     };

//     setSaving(true);
//     await onSave(payload);
//     setSaving(false);
//   };

//   const inputStyle   = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, background: "#fff", fontFamily: "inherit", boxSizing: "border-box" };
//   const readonlyStyle = { ...inputStyle, background: "#F8FAFC", color: "#64748B" };
//   const labelStyle    = { fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5, display: "block" };

//   const isPoLinked = mode === "po_linked";
//   const accentColor = isPoLinked ? "#6366F1" : "#0EA5E9";

//   return (
//     <div style={{ display: "flex", flexDirection: "column", height: "90vh", background: "#F8FAFC" }}>

//       {/* Modal header */}
//       <div style={{ padding: "18px 24px", background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//         <div>
//           <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
//             {initialGRC?.id ? "Edit GRC" : "Create GRC"}
//             {" "}
//             <span style={{ fontSize: 13, fontWeight: 500, color: accentColor }}>
//               — {isPoLinked ? "🔗 PO-Linked" : "📦 Direct / Walk-in"}
//             </span>
//           </h2>
//           <p style={{ margin: 0, fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
//             {isPoLinked
//               ? "Goods Receipt Certificate linked to a Purchase Order"
//               : "Goods Receipt Certificate — no PO required"}
//           </p>
//         </div>
//         <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94A3B8" }}>✕</button>
//       </div>

//       {/* Mode toggle (only for new GRCs) */}
//       {!isExisting && (
//         <div style={{ padding: "12px 24px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", display: "flex", gap: 8, alignItems: "center" }}>
//           <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>GRC Type:</span>
//           {[
//             { key: "po_linked", label: "🔗 PO-Linked", color: "#6366F1", bg: "#EEF2FF" },
//             { key: "direct",    label: "📦 Direct / Walk-in", color: "#0EA5E9", bg: "#E0F2FE" },
//           ].map(({ key, label, color, bg }) => (
//             <button
//               key={key}
//               className="btn-base"
//               onClick={() => handleModeSwitch(key)}
//               style={{
//                 padding: "7px 16px", fontSize: 12,
//                 background: mode === key ? color : "#fff",
//                 color: mode === key ? "#fff" : "#64748B",
//                 border: `1.5px solid ${mode === key ? color : "#E2E8F0"}`,
//               }}
//             >
//               {label}
//             </button>
//           ))}
//           {isPoLinked && (
//             <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 8 }}>
//              PO must be Approved (or Partially Received for second delivery)
//             </span>
//           )}
//         </div>
//       )}

//       {/* Scrollable body */}
//       <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

//         {/* ── Info banner for direct GRC ── */}
//         {!isPoLinked && (
//           <div style={{ background: "#E0F2FE", border: "1px solid #BAE6FD", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
//             <span style={{ fontSize: 18 }}>📦</span>
//             <div>
//               <div style={{ fontWeight: 700, fontSize: 13, color: "#0369A1" }}>Direct / Walk-in GRC</div>
//               <div style={{ fontSize: 12, color: "#0284C7", marginTop: 2 }}>
//                 This GRC is not linked to any Purchase Order. All fields must be filled manually.
//                 The vendor name, item details, and rates must be entered directly.
//               </div>
//             </div>
//           </div>
//         )}

//         {/* ─ Header section ─ */}
//         <FormSection
//           title="GRC Header"
//           subtitle="Basic receipt details"
//           accentColor={accentColor}
//         >
//           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

//             {/* Left col */}
//             <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
//               <div>
//                 <label style={labelStyle}>GRC No</label>
//                 <input readOnly value={initialGRC?.grcNo || "(auto-generated)"} style={readonlyStyle} />
//               </div>
//               <div>
//                 <label style={labelStyle}>GRC Date <Req /></label>
//                 <input type="date" value={header.grcDate} onChange={(e) => setH("grcDate", e.target.value)} style={inputStyle} />
//               </div>

//               {/* PO field — only in po_linked mode */}
//               {isPoLinked ? (
//                 <div>
//                   <label style={labelStyle}>Purchase Order No <Req /></label>
//                   <input
//                     value={header.poNo}
//                     onChange={(e) => handlePOSelect(e.target.value)}
//                     list="po-list-grc"
//                     placeholder={poLoading ? "Loading POs…" : "Select or type PO No…"}
//                     style={inputStyle}
//                   />
//                   <datalist id="po-list-grc">
//                     {pos.map((p) => <option key={p.id} value={p.orderNo}>{p.orderNo} — {p.vendorName}</option>)}
//                   </datalist>
//                   {header.poNo && !pos.find((p) => p.orderNo === header.poNo) && (
//                     <p style={{ fontSize: 11, color: "#F59E0B", margin: "4px 0 0" }}>⚠ PO not in allowed statuses</p>
//                   )}
//                 </div>
//               ) : (
//                 /* Supplier reference for direct GRC */
//                 <div>
//                   <label style={labelStyle}>Supplier Reference No</label>
//                   <input
//                     value={header.supplierRef || ""}
//                     onChange={(e) => setH("supplierRef", e.target.value)}
//                     placeholder="Supplier's own ref or DC number"
//                     style={inputStyle}
//                   />
//                 </div>
//               )}

//               {/* Vendor name: readonly+autofilled for PO-linked, editable for direct */}
//               <div>
//                 <label style={labelStyle}>Vendor / Supplier Name <Req /></label>
//                 {isPoLinked
//                   ? <input readOnly value={header.vendorName} style={readonlyStyle} placeholder="Auto-filled from PO" />
//                   : <input
//                       value={header.vendorName}
//                       onChange={(e) => setH("vendorName", e.target.value)}
//                       placeholder="Enter vendor or supplier name"
//                       style={inputStyle}
//                     />
//                 }
//               </div>
//             </div>

//             {/* Right col */}
//             <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
//               <div>
//                 <label style={labelStyle}>Received By <Req /></label>
//                 <input value={header.receivedBy} onChange={(e) => setH("receivedBy", e.target.value)} placeholder="Warehouse officer name" style={inputStyle} />
//               </div>
//               <div>
//                 <label style={labelStyle}>Delivery Note / Challan No</label>
//                 <input value={header.deliveryNote} onChange={(e) => setH("deliveryNote", e.target.value)} placeholder="Vendor challan number" style={inputStyle} />
//               </div>
//               {/* Invoice No — extra for direct GRC */}
//               {!isPoLinked && (
//                 <div>
//                   <label style={labelStyle}>Invoice No</label>
//                   <input value={header.invoiceNo || ""} onChange={(e) => setH("invoiceNo", e.target.value)} placeholder="Vendor invoice number" style={inputStyle} />
//                 </div>
//               )}
//               <div>
//                 <label style={labelStyle}>Vehicle No</label>
//                 <input value={header.vehicleNo} onChange={(e) => setH("vehicleNo", e.target.value)} placeholder="e.g. WB-01-AB-1234" style={inputStyle} />
//               </div>
//               <div>
//                 <label style={labelStyle}>Status</label>
//                 <select value={header.status} onChange={(e) => setH("status", e.target.value)} style={inputStyle}>
//                   {["Draft", "Pending", "Approved", "Rejected"].map((s) => <option key={s}>{s}</option>)}
//                 </select>
//               </div>
//             </div>
//           </div>

//           <div style={{ marginTop: 14 }}>
//             <label style={labelStyle}>Remarks</label>
//             <textarea
//               rows={2} value={header.remarks}
//               onChange={(e) => setH("remarks", e.target.value)}
//               placeholder="Notes about this delivery…"
//               style={{ ...inputStyle, resize: "vertical" }}
//             />
//           </div>
//         </FormSection>

//         {/* ─ KPI bar ─ */}
//         <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, margin: "16px 0" }}>
//           {[
//             { label: "Total Received", val: totals.totalReceivedQty.toFixed(3), color: "#334155" },
//             { label: "Total Accepted", val: totals.totalAcceptedQty.toFixed(3), color: "#059669" },
//             { label: "Total Rejected", val: totals.totalRejectedQty.toFixed(3), color: totals.totalRejectedQty > 0 ? "#DC2626" : "#94A3B8" },
//             { label: "Accepted Value", val: `₹${money(totals.totalValue)}`,       color: accentColor },
//           ].map(({ label, val, color }) => (
//             <div key={label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 14px" }}>
//               <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
//               <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{val}</div>
//             </div>
//           ))}
//         </div>

//         {/* ─ Items table ─ */}
//         <FormSection
//           title="Item-wise Receipt"
//           subtitle={isPoLinked ? "Pre-filled from PO — enter received and rejected quantities" : "Enter item details, received quantity, and rejected quantity"}
//           accentColor={accentColor}
//           right={
//             <button
//               className="btn-base"
//               onClick={() => setItems((p) => [...p, EMPTY_ITEM()])}
//               style={{ padding: "7px 14px", background: isPoLinked ? "#EEF2FF" : "#E0F2FE", color: accentColor, border: `1px solid ${isPoLinked ? "#C7D2FE" : "#BAE6FD"}`, fontSize: 12 }}
//             >
//               + Add Row
//             </button>
//           }
//         >
//           <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #E2E8F0" }}>
//             <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
//               <thead style={{ background: "#F8FAFC" }}>
//                 <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
//                   {["#","Barcode","Description",
//                     ...(isPoLinked ? ["PO Qty"] : []),
//                     "Received Qty *","Rejected Qty","Accepted Qty","Rejection Reason","Rate","Accepted Value","Remarks",""].map((h) => (
//                     <th key={h} style={{ padding: "9px 10px", fontSize: 11, fontWeight: 700, color: "#64748B", textAlign: h === "#" || h === "" ? "center" : "left", whiteSpace: "nowrap", letterSpacing: ".4px", textTransform: "uppercase" }}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {items.map((it, idx) => {
//                   const rec = clamp0(it.receivedQty);
//                   const acc = Math.min(clamp0(it.acceptedQty), rec);
//                   const rej = Math.max(0, rec - acc);
//                   const val = acc * clamp0(it.rate);
//                   return (
//                     <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9", background: idx % 2 === 0 ? "#fff" : "#FAFBFF" }}>
//                       <td style={{ padding: "6px 10px", textAlign: "center", color: "#94A3B8", fontSize: 12, fontWeight: 600 }}>{idx + 1}</td>
//                       <td style={{ padding: "4px 6px" }}><ICell value={it.barcode}      onChange={(e) => updateItem(idx, "barcode", e.target.value)} /></td>
//                       <td style={{ padding: "4px 6px" }}><ICell value={it.description}  onChange={(e) => updateItem(idx, "description", e.target.value)} wide /></td>
//                       {isPoLinked && (
//                         <td style={{ padding: "4px 10px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#64748B", whiteSpace: "nowrap" }}>{n0(it.poQty).toFixed(3)}</td>
//                       )}
//                       <td style={{ padding: "4px 6px" }}><INum  value={it.receivedQty}  onChange={(e) => updateItem(idx, "receivedQty", e.target.value)} highlight accentColor={accentColor} /></td>
//                       <td style={{ padding: "4px 6px" }}><INum  value={it.acceptedQty}  onChange={(e) => updateItem(idx, "acceptedQty", e.target.value)} highlight accentColor={accentColor} /></td>
//                       <td style={{ padding: "4px 10px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: rej > 0 ? "#DC2626" : "#94A3B8", fontWeight: 700 }}>{rej.toFixed(3)}</td>
//                       <td style={{ padding: "4px 6px" }}><ICell value={it.rejectionReason} onChange={(e) => updateItem(idx, "rejectionReason", e.target.value)} placeholder="Damaged / short" /></td>
//                       <td style={{ padding: "4px 6px" }}><INum  value={it.rate}         onChange={(e) => updateItem(idx, "rate", e.target.value)} /></td>
//                       <td style={{ padding: "4px 10px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: accentColor, fontWeight: 700, whiteSpace: "nowrap" }}>₹{money(val)}</td>
//                       <td style={{ padding: "4px 6px" }}><ICell value={it.remarks}      onChange={(e) => updateItem(idx, "remarks", e.target.value)} placeholder="Remarks" /></td>
//                       <td style={{ padding: "4px 8px", textAlign: "center" }}>
//                         <button
//                           onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
//                           disabled={items.length === 1}
//                           style={{ background: "none", border: "none", cursor: items.length === 1 ? "not-allowed" : "pointer", color: "#EF4444", fontSize: 16, opacity: items.length === 1 ? 0.3 : 1 }}
//                         >✕</button>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         </FormSection>
//       </div>

//       {/* Sticky footer */}
//       <div style={{ padding: "14px 24px", background: "#fff", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end", gap: 10 }}>
//         <GhostBtn onClick={onClose}>Cancel</GhostBtn>
//         <button
//           className="btn-base"
//           onClick={handleSubmit}
//           disabled={saving}
//           style={{ padding: "10px 22px", background: saving ? "#A5B4FC" : accentColor, color: "#fff", fontSize: 13 }}
//         >
//           {saving ? "Saving…" : initialGRC?.id ? "Update GRC" : "Save GRC"}
//         </button>
//       </div>
//     </div>
//   );
// }


// /* ══════════════════════════════════════════════════════════════════
//    GRC VIEW MODAL
// ══════════════════════════════════════════════════════════════════ */
// function GRCViewModal({ grc, onClose }) {
//   const isLinked = !!(grc.poNo && grc.poNo.trim());

//   const fields = [
//     ["GRC No",          grc.grcNo],
//     ["GRC Date",        grc.grcDate],
//     ["Type",            null],   // rendered specially
//     ["PO No",           isLinked ? grc.poNo : "—  (Direct/Walk-in)"],
//     ["Vendor",          grc.vendorName],
//     ["Received By",     grc.receivedBy],
//     ["Delivery Note",   grc.deliveryNote],
//     ["Vehicle No",      grc.vehicleNo],
//     ...(grc.invoiceNo ? [["Invoice No", grc.invoiceNo]] : []),
//     ...(grc.supplierRef ? [["Supplier Ref", grc.supplierRef]] : []),
//     ["Status",          null],
//     ["Total Received",  n0(grc.totalReceivedQty).toFixed(3)],
//     ["Total Accepted",  n0(grc.totalAcceptedQty).toFixed(3)],
//     ["Total Rejected",  n0(grc.totalRejectedQty).toFixed(3)],
//     ["Total Value (₹)", `₹${money(grc.totalValue)}`],
//   ];

//   return (
//     <div style={{ display: "flex", flexDirection: "column", height: "90vh", background: "#fff" }}>

//       <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
//         <div>
//           <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
//             <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: isLinked ? "#6366F1" : "#0EA5E9" }}>
//               Goods Receipt Certificate
//             </h2>
//             <GRCTypeBadge poNo={grc.poNo} />
//           </div>
//           <p style={{ margin: 0, fontSize: 12, color: "#94A3B8" }}>
//             GRC No: <b style={{ color: "#0F172A", fontFamily: "'DM Mono',monospace" }}>{grc.grcNo}</b>
//           </p>
//         </div>
//         <div style={{ display: "flex", gap: 8 }}>
//           <button className="btn-base" onClick={() => window.print()} style={{ padding: "8px 14px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", fontSize: 12 }}>Print</button>
//           <button className="btn-base" onClick={onClose} style={{ padding: "8px 14px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", fontSize: 12 }}>Close</button>
//         </div>
//       </div>

//       <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
//         <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
//           {fields.map(([k, v]) => (
//             <div key={k} style={{ border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 14px" }}>
//               <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>{k}</div>
//               {k === "Status" ? <StatusPill s={grc.status} />
//                 : k === "Type" ? <GRCTypeBadge poNo={grc.poNo} />
//                 : <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{v || "—"}</div>
//               }
//             </div>
//           ))}
//         </div>

//         {/* Items */}
//         {Array.isArray(grc.items) && grc.items.length > 0 && (
//           <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
//             <div style={{ padding: "12px 16px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
//               <span style={{ fontSize: 13, fontWeight: 700 }}>Item-wise Receipt</span>
//             </div>
//             <div style={{ overflowX: "auto" }}>
//               <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
//                 <thead style={{ background: "#F8FAFC" }}>
//                   <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
//                     {["#","Barcode","Description",
//                       ...(isLinked ? ["PO Qty"] : []),
//                       "Received","Accepted","Rejected","Rate","Value"].map((h) => (
//                       <th key={h} style={{ padding: "9px 12px", fontSize: 11, fontWeight: 700, color: "#64748B", textAlign: h === "#" ? "center" : ["Received","Accepted","Rejected","Rate","Value","PO Qty"].includes(h) ? "right" : "left", textTransform: "uppercase", letterSpacing: ".4px" }}>{h}</th>
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {grc.items.map((it, i) => {
//                     const val = clamp0(it.acceptedQty) * clamp0(it.rate);
//                     return (
//                       <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFBFF" }}>
//                         <td style={{ padding: "10px 12px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>{i + 1}</td>
//                         <td style={{ padding: "10px 12px", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{it.barcode || "—"}</td>
//                         <td style={{ padding: "10px 12px", fontSize: 13 }}>{it.description || "—"}</td>
//                         {isLinked && <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{n0(it.poQty).toFixed(3)}</td>}
//                         <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{n0(it.receivedQty).toFixed(3)}</td>
//                         <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#059669", fontWeight: 700 }}>{n0(it.acceptedQty).toFixed(3)}</td>
//                         <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: n0(it.rejectedQty) > 0 ? "#DC2626" : "#94A3B8", fontWeight: 700 }}>{n0(it.rejectedQty).toFixed(3)}</td>
//                         <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>₹{money(it.rate)}</td>
//                         <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: isLinked ? "#6366F1" : "#0EA5E9" }}>₹{money(val)}</td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//                 <tfoot style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
//                   <tr>
//                     <td colSpan={isLinked ? 4 : 3} style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Totals</td>
//                     <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700 }}>{n0(grc.totalReceivedQty).toFixed(3)}</td>
//                     <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: "#059669" }}>{n0(grc.totalAcceptedQty).toFixed(3)}</td>
//                     <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: "#DC2626" }}>{n0(grc.totalRejectedQty).toFixed(3)}</td>
//                     <td />
//                     <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: isLinked ? "#6366F1" : "#0EA5E9" }}>₹{money(grc.totalValue)}</td>
//                   </tr>
//                 </tfoot>
//               </table>
//             </div>
//           </div>
//         )}

//         {grc.status === "Rejected" && grc.rejectionReason && (
//           <div style={{ marginTop: 14, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px" }}>
//             <div style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", textTransform: "uppercase", letterSpacing: ".4px" }}>Rejection Reason</div>
//             <div style={{ fontSize: 13, color: "#7F1D1D", marginTop: 4 }}>{grc.rejectionReason}</div>
//           </div>
//         )}

//         {grc.remarks && (
//           <div style={{ marginTop: 14, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "12px 16px" }}>
//             <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".4px" }}>Remarks</div>
//             <div style={{ fontSize: 13, color: "#334155", marginTop: 4 }}>{grc.remarks}</div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }


// /* ══════════════════════════════════════════════════════════════════
//    Shared UI Primitives
// ══════════════════════════════════════════════════════════════════ */
// function Overlay({ onClose, children }) {
//   return (
//     <div
//       onClick={(e) => e.target === e.currentTarget && onClose()}
//       style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .15s ease" }}
//     >
//       <div style={{ width: "min(1400px, calc(100vw - 32px))", height: "min(92vh, calc(100dvh - 32px))", maxHeight: "calc(100dvh - 32px)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.2)", display: "flex", flexDirection: "column" }}>
//         {children}
//       </div>
//     </div>
//   );
// }

// function SmallModal({ title, onClose, children }) {
//   return (
//     <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
//       <div style={{ background: "#fff", borderRadius: 14, padding: "24px", width: "min(420px,92vw)", boxShadow: "0 24px 80px rgba(0,0,0,.2)" }}>
//         <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>{title}</h3>
//         {children}
//       </div>
//     </div>
//   );
// }

// function FormSection({ title, subtitle, right, children, accentColor = "#6366F1" }) {
//   return (
//     <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
//       <div style={{ padding: "12px 16px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `3px solid ${accentColor}` }}>
//         <div>
//           <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{title}</div>
//           {subtitle && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{subtitle}</div>}
//         </div>
//         {right}
//       </div>
//       <div style={{ padding: 16 }}>{children}</div>
//     </div>
//   );
// }

// function ActionBtn({ children, onClick, color }) {
//   return (
//     <button className="btn-base" onClick={onClick} style={{ padding: "6px 11px", fontSize: 12, background: `${color}12`, color, border: `1px solid ${color}30` }}>
//       {children}
//     </button>
//   );
// }

// function GhostBtn({ children, onClick }) {
//   return (
//     <button className="btn-base" onClick={onClick} style={{ padding: "9px 18px", background: "#F8FAFC", color: "#475569", border: "1px solid #E2E8F0", fontSize: 13 }}>
//       {children}
//     </button>
//   );
// }

// function Req() { return <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>; }

// function ICell({ value, onChange, placeholder, wide }) {
//   return (
//     <input
//       value={value || ""}
//       onChange={onChange}
//       placeholder={placeholder}
//       style={{ height: 32, width: wide ? 160 : 110, borderRadius: 6, border: "1px solid #E2E8F0", padding: "0 8px", fontSize: 12, fontFamily: "inherit", background: "#fff" }}
//     />
//   );
// }

// function INum({ value, onChange, highlight, accentColor = "#6366F1" }) {
//   const highlightBg     = accentColor === "#0EA5E9" ? "#E0F2FE" : "#EEF2FF";
//   const highlightBorder = accentColor === "#0EA5E9" ? "#BAE6FD" : "#C7D2FE";
//   return (
//     <input
//       type="number" min="0"
//       value={value}
//       onChange={onChange}
//       style={{
//         height: 32, width: 90, borderRadius: 6,
//         border: `1px solid ${highlight ? highlightBorder : "#E2E8F0"}`,
//         padding: "0 8px", fontSize: 12, textAlign: "right",
//         fontFamily: "'DM Mono',monospace",
//         background: highlight ? highlightBg : "#fff",
//       }}
//     />
//   );
// }









import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";

/* ─── API ──── */
const GRC_API = `${APP_API_URL}/grc`;
const PO_API  = `${APP_API_URL}/purchaseorders`;

/* ─── Shared auth helper ──────────────────────────────────────────
   Every route in grc_routes.py (and purchaseorder_routes.py, used
   here for the PO dropdown) requires an HQ admin's Bearer token
   (Depends(get_hq_tenant), added during the tenant-isolation pass).
   This file previously sent NO auth header on ANY fetch call — same
   bug already fixed in PurchaseOrderManager.jsx and
   InventoryManagementCurrentStockList.jsx. Same fix pattern here.
──────────────────────────────────────────────────────────────── */
function getAdminToken() {
  return (
    localStorage.getItem("admin_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

async function authFetch(url, options = {}) {
  const token = getAdminToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

/* ─── Helpers ──────────────────────────────────────────────────── */
const n0     = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const clamp0 = (v) => Math.max(0, n0(v));
const money  = (v) => clamp0(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today  = () => new Date().toISOString().slice(0, 10);

const EMPTY_ITEM = (poItem = {}) => ({
  barcode:         poItem.barcode      || "",
  vendorBarcode:   poItem.vendorBarcode || poItem.vendor_barcode || "",
  poBarcode:       poItem.barcode      || "",
  description:     poItem.description  || "",
  poQty:           poItem.amendedQty   || poItem.quantity || 0,
  receivedQty:     poItem.amendedQty   || poItem.quantity || "",
  acceptedQty:     "",
  rejectedQty:     0,
  rejectionReason: "",
  // Prefer vendorRate (agreed rate after approval),
  // fall back to rate (buyer's original if PO not yet approved)
  rate:            poItem.vendorRate   || poItem.rate || 0,
  remarks:         "",
});

/* ─── Status config ────────────────────────────────────────────── */
const STATUS_META = {
  Draft:    { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
  Pending:  { bg: "#FFFBEB", text: "#92400E", dot: "#F59E0B" },
  Approved: { bg: "#ECFDF5", text: "#065F46", dot: "#10B981" },
  Rejected: { bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444" },
};

/* ─── GRC Type config ──────────────────────────────────────────── */
const GRC_TYPE = {
  po_linked: { label: "PO-Linked",  color: "#6366F1", bg: "#EEF2FF", icon: "🔗" },
  direct:    { label: "Direct / Walk-in", color: "#0EA5E9", bg: "#E0F2FE", icon: "📦" },
};

function StatusPill({ s }) {
  const m = STATUS_META[s] || { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: m.bg, color: m.text, letterSpacing: ".3px",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
      {s || "—"}
    </span>
  );
}

function GRCTypeBadge({ poNo }) {
  const isLinked = !!(poNo && poNo.trim());
  const t = isLinked ? GRC_TYPE.po_linked : GRC_TYPE.direct;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: t.bg, color: t.color, letterSpacing: ".3px",
    }}>
      {t.icon} {t.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════════════ */
export default function GRCManager() {
  const [grcs,        setGrcs]        = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [toast,       setToast]       = useState(null);
  const [modal,       setModal]       = useState(null);
  const [active,      setActive]      = useState(null);
  const [rejectInput, setRejectInput] = useState("");
  const [search,      setSearch]      = useState("");
  const [filterStatus,setFilterStatus]= useState("All");
  const [filterType,  setFilterType]  = useState("All"); // "All" | "po_linked" | "direct"

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchGRCs = useCallback(async () => {
    try {
      setLoading(true);
      // Trailing slash — the backend route is registered as "/" under
      // prefix "/grc", so the real path is "/grc/". Hitting it without
      // the slash triggers a 307 redirect; the redirected request never
      // carried an auth header before either, compounding the bug.
      const res  = await authFetch(`${GRC_API}/`);
      if (!res.ok) throw new Error("Failed to fetch GRCs");
      const data = await res.json();
      setGrcs(Array.isArray(data) ? data.reverse() : []);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGRCs(); }, [fetchGRCs]);

  /* ── Save ── */
  const handleSave = async (payload) => {
    const isEdit = !!payload.id;
    try {
      const res = await authFetch(
        isEdit ? `${GRC_API}/${payload.id}` : `${GRC_API}/`,
        { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      showToast(isEdit ? "GRC updated successfully" : "GRC created successfully");
      setModal(null); setActive(null);
      fetchGRCs();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  /* ── Approve ── */
  const handleApprove = async (grc) => {
    try {
      setLoading(true);
      const res  = await authFetch(`${GRC_API}/${grc.id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Approval failed");
      showToast(data.message || "GRC Approved");
      fetchGRCs();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  /* ── Reject ── */
  const handleReject = async () => {
    if (!rejectInput.trim()) return showToast("Rejection reason is required", "error");
    try {
      const res  = await authFetch(`${GRC_API}/${active.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Rejection failed");
      showToast(data.message || "GRC Rejected");
      setModal(null); setActive(null); setRejectInput("");
      fetchGRCs();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  /* ── Delete ── */
  const handleDelete = async () => {
    try {
      const res  = await authFetch(`${GRC_API}/${active.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Delete failed");
      showToast("GRC deleted");
      setModal(null); setActive(null);
      fetchGRCs();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  /* ── Filtered list ── */
  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return grcs.filter((g) => {
      const matchStatus = filterStatus === "All" || g.status === filterStatus;
      const isLinked    = !!(g.poNo && g.poNo.trim());
      const matchType   =
        filterType === "All" ||
        (filterType === "po_linked" && isLinked) ||
        (filterType === "direct" && !isLinked);
      const matchSearch = !q || [g.grcNo, g.poNo, g.vendorName, g.receivedBy]
        .some((f) => (f || "").toLowerCase().includes(q));
      return matchStatus && matchType && matchSearch;
    });
  }, [grcs, search, filterStatus, filterType]);

  /* ── KPIs ── */
  const kpis = useMemo(() => ({
    total:    grcs.length,
    approved: grcs.filter((g) => g.status === "Approved").length,
    pending:  grcs.filter((g) => g.status === "Pending" || g.status === "Draft").length,
    rejected: grcs.filter((g) => g.status === "Rejected").length,
    direct:   grcs.filter((g) => !(g.poNo && g.poNo.trim())).length,
  }), [grcs]);

  return (
    <div style={{ minHeight: "100%", background: "#F8FAFC", fontFamily: "'DM Sans', sans-serif", color: "#0F172A" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13,
          background: toast.type === "error" ? "#FEF2F2" : "#ECFDF5",
          color: toast.type === "error" ? "#991B1B" : "#065F46",
          border: `1px solid ${toast.type === "error" ? "#FECACA" : "#A7F3D0"}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          animation: "slideIn .2s ease",
        }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        .row-hover:hover { background: #F8FAFC !important; }
        .btn-base { cursor:pointer; border:none; font-family:inherit; font-weight:600; border-radius:8px; transition: all .15s; }
        .btn-base:active { transform: scale(.97); }
        .tbl-th { padding:10px 14px; font-size:11px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:#64748B; white-space:nowrap; }
        .tbl-td { padding:12px 14px; font-size:13px; color:#334155; white-space:nowrap; vertical-align:middle; }
        input:focus, select:focus, textarea:focus { outline:none; border-color:#6366F1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#CBD5E1; border-radius:10px; }
        .type-toggle { cursor:pointer; border:none; font-family:inherit; font-weight:600; border-radius:8px; transition:all .15s; padding:8px 14px; font-size:12px; }
      `}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 24px" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-.3px" }}>Goods Receipt Certificate</h1>
                <p style={{ margin: 0, fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Manage inbound goods receipts — PO-linked or direct walk-in</p>
              </div>
            </div>
          </div>
          {/* Split create button */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-base"
              onClick={() => { setActive({ _grcMode: "po_linked" }); setModal("form"); }}
              style={{ padding: "10px 16px", background: "#6366F1", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
            >
              🔗 PO-Linked GRC
            </button>
            <button
              className="btn-base"
              onClick={() => { setActive({ _grcMode: "direct" }); setModal("form"); }}
              style={{ padding: "10px 16px", background: "#0EA5E9", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
            >
              📦 Direct GRC
            </button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { label: "Total GRCs",    value: kpis.total,    color: "#6366F1", bg: "#EEF2FF" },
            { label: "Approved",      value: kpis.approved, color: "#059669", bg: "#ECFDF5" },
            { label: "Draft/Pending", value: kpis.pending,  color: "#D97706", bg: "#FFFBEB" },
            { label: "Rejected",      value: kpis.rejected, color: "#DC2626", bg: "#FEF2F2" },
            { label: "Direct / Walk-in", value: kpis.direct, color: "#0EA5E9", bg: "#E0F2FE" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 18, fontWeight: 700, color }}>{value}</span>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, letterSpacing: ".4px", textTransform: "uppercase" }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              placeholder="Search GRC No, PO, Vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, background: "#fff", boxSizing: "border-box" }}
            />
          </div>

          {/* Status filters */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>STATUS</span>
            {["All", "Draft", "Pending", "Approved", "Rejected"].map((s) => (
              <button
                key={s}
                className="btn-base"
                onClick={() => setFilterStatus(s)}
                style={{
                  padding: "8px 14px", fontSize: 12,
                  background: filterStatus === s ? "#6366F1" : "#fff",
                  color: filterStatus === s ? "#fff" : "#64748B",
                  border: `1px solid ${filterStatus === s ? "#6366F1" : "#E2E8F0"}`,
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Type filters */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>TYPE</span>
            {[
              { key: "All",       label: "All" },
              { key: "po_linked", label: "🔗 PO-Linked" },
              { key: "direct",    label: "📦 Direct" },
            ].map(({ key, label }) => (
              <button
                key={key}
                className="type-toggle"
                onClick={() => setFilterType(key)}
                style={{
                  background: filterType === key ? "#0F172A" : "#fff",
                  color: filterType === key ? "#fff" : "#64748B",
                  border: `1px solid ${filterType === key ? "#0F172A" : "#E2E8F0"}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
              <thead style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <tr>
                  {["GRC No", "Type", "GRC Date", "PO No", "Vendor", "Received By", "Status", "Received", "Accepted", "Rejected", "Value (₹)", "Actions"].map((h) => (
                    <th key={h} className="tbl-th" style={{ textAlign: ["Actions","Value (₹)","Received","Accepted","Rejected"].includes(h) ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <div style={{ width: 16, height: 16, border: "2px solid #E2E8F0", borderTopColor: "#6366F1", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                      Loading GRCs…
                    </div>
                  </td></tr>
                ) : visible.length === 0 ? (
                  <tr><td colSpan={12} style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                    {search || filterStatus !== "All" || filterType !== "All"
                      ? "No GRCs match your filters."
                      : "No GRCs yet. Click 'PO-Linked GRC' or 'Direct GRC' to add one."}
                  </td></tr>
                ) : visible.map((g, i) => (
                  <tr key={g.id} className="row-hover" style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFBFF" }}>
                    <td className="tbl-td"><span style={{ fontWeight: 700, color: "#6366F1", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{g.grcNo || "—"}</span></td>
                    <td className="tbl-td"><GRCTypeBadge poNo={g.poNo} /></td>
                    <td className="tbl-td">{g.grcDate || "—"}</td>
                    <td className="tbl-td">
                      {g.poNo
                        ? <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600 }}>{g.poNo}</span>
                        : <span style={{ color: "#94A3B8", fontSize: 12, fontStyle: "italic" }}>Walk-in</span>
                      }
                    </td>
                    <td className="tbl-td">{g.vendorName || "—"}</td>
                    <td className="tbl-td">{g.receivedBy || "—"}</td>
                    <td className="tbl-td"><StatusPill s={g.status} /></td>
                    <td className="tbl-td" style={{ textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{n0(g.totalReceivedQty).toFixed(3)}</td>
                    <td className="tbl-td" style={{ textAlign: "right", fontFamily: "'DM Mono', monospace", color: "#059669", fontWeight: 600 }}>{n0(g.totalAcceptedQty).toFixed(3)}</td>
                    <td className="tbl-td" style={{ textAlign: "right", fontFamily: "'DM Mono', monospace", color: n0(g.totalRejectedQty) > 0 ? "#DC2626" : "#94A3B8", fontWeight: 600 }}>{n0(g.totalRejectedQty).toFixed(3)}</td>
                    <td className="tbl-td" style={{ textAlign: "right", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>₹{money(g.totalValue)}</td>
                    <td className="tbl-td" style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <ActionBtn color="#0EA5E9" onClick={() => { setActive(g); setModal("view"); }}>View</ActionBtn>
                        {g.status !== "Approved" && g.status !== "Rejected" && (
                          <ActionBtn color="#6366F1" onClick={() => { setActive(g); setModal("form"); }}>Edit</ActionBtn>
                        )}
                        {g.status !== "Approved" && g.status !== "Rejected" && (
                          <ActionBtn color="#059669" onClick={() => handleApprove(g)}>Approve</ActionBtn>
                        )}
                        {g.status !== "Approved" && g.status !== "Rejected" && (
                          <ActionBtn color="#F59E0B" onClick={() => { setActive(g); setRejectInput(""); setModal("reject"); }}>Reject</ActionBtn>
                        )}
                        {g.status !== "Approved" && (
                          <ActionBtn color="#EF4444" onClick={() => { setActive(g); setModal("delete"); }}>Del</ActionBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visible.length > 0 && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>Showing {visible.length} of {grcs.length} GRCs</span>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>
                Total Accepted: <b style={{ color: "#059669" }}>
                  {visible.reduce((s, g) => s + n0(g.totalAcceptedQty), 0).toFixed(3)}
                </b>{" "} | Value: <b style={{ color: "#334155" }}>₹{money(visible.reduce((s, g) => s + n0(g.totalValue), 0))}</b>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {modal === "form" && (
        <Overlay onClose={() => { setModal(null); setActive(null); }}>
          <GRCForm
            initialGRC={active}
            onClose={() => { setModal(null); setActive(null); }}
            onSave={handleSave}
          />
        </Overlay>
      )}

      {modal === "view" && active && (
        <Overlay onClose={() => setModal(null)}>
          <GRCViewModal grc={active} onClose={() => setModal(null)} />
        </Overlay>
      )}

      {modal === "reject" && active && (
        <SmallModal
          title={`Reject ${active.grcNo}?`}
          onClose={() => { setModal(null); setActive(null); setRejectInput(""); }}
        >
          <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 12px" }}>
            Provide a reason. This cannot be undone.
          </p>
          <textarea
            value={rejectInput}
            onChange={(e) => setRejectInput(e.target.value)}
            placeholder="e.g. Quantity mismatch, wrong item received…"
            rows={3}
            style={{ width: "100%", borderRadius: 8, border: "1px solid #E2E8F0", padding: "10px 12px", fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <GhostBtn onClick={() => { setModal(null); setActive(null); setRejectInput(""); }}>Cancel</GhostBtn>
            <button className="btn-base" onClick={handleReject} style={{ padding: "9px 18px", background: "#EF4444", color: "#fff", fontSize: 13 }}>Confirm Reject</button>
          </div>
        </SmallModal>
      )}

      {modal === "delete" && active && (
        <SmallModal
          title="Delete GRC?"
          onClose={() => { setModal(null); setActive(null); }}
        >
          <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px" }}>
            Delete <b style={{ color: "#0F172A" }}>{active.grcNo}</b>? This cannot be undone.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <GhostBtn onClick={() => { setModal(null); setActive(null); }}>Cancel</GhostBtn>
            <button className="btn-base" onClick={handleDelete} style={{ padding: "9px 18px", background: "#EF4444", color: "#fff", fontSize: 13 }}>Delete</button>
          </div>
        </SmallModal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════
   GRC FORM  — supports BOTH PO-linked and Direct / Walk-in modes
══════════════════════════════════════════════════════════════════ */
function GRCForm({ initialGRC, onClose, onSave }) {
  const [pos,       setPos]       = useState([]);
  const [poLoading, setPoLoading] = useState(false);
  const [saving,    setSaving]    = useState(false);

  // Determine mode:
  // - If editing an existing GRC: mode = po_linked if it has a poNo, else direct
  // - If creating new: use _grcMode hint passed via setActive({ _grcMode: "..." })
  const isExisting = !!(initialGRC?.id);
  const derivedMode = isExisting
    ? (initialGRC?.poNo ? "po_linked" : "direct")
    : (initialGRC?._grcMode || "po_linked");

  const [mode, setMode] = useState(derivedMode);

  const [header, setHeader] = useState({
    grcDate:      initialGRC?.grcDate      || today(),
    poNo:         initialGRC?.poNo         || "",
    vendorName:   initialGRC?.vendorName   || "",
    receivedBy:   initialGRC?.receivedBy   || "",
    deliveryNote: initialGRC?.deliveryNote || "",
    vehicleNo:    initialGRC?.vehicleNo    || "",
    remarks:      initialGRC?.remarks      || "",
    status:       initialGRC?.status       || "Draft",
    // Direct GRC extra fields
    supplierRef:  initialGRC?.supplierRef  || "",
    invoiceNo:    initialGRC?.invoiceNo    || "",
  });

  const [items, setItems] = useState(
    Array.isArray(initialGRC?.items) && initialGRC.items.length
      ? initialGRC.items.map((it) => ({ ...EMPTY_ITEM(), ...it }))
      : [EMPTY_ITEM()]
  );

  const setH = (k, v) => setHeader((p) => ({ ...p, [k]: v }));

  /* Load POs only in po_linked mode */
  useEffect(() => {
    if (mode !== "po_linked") return;
    (async () => {
      try {
        setPoLoading(true);
        // Same fix as GRCManager's fetchGRCs: trailing slash + auth header.
        const res  = await authFetch(`${PO_API}/`);
        const data = await res.json();
        const allowed = ["Approved", "PartiallyReceived", "WalkinAccepted"];
        setPos(Array.isArray(data) ? data.filter((p) => allowed.includes(p.status)) : []);
      } catch (e) { console.error(e); }
      finally { setPoLoading(false); }
    })();
  }, [mode]);

  /* When PO is selected → prefill vendor + items */
  const handlePOSelect = (poNo) => {
    setH("poNo", poNo);
    const po = pos.find((p) => p.orderNo === poNo);
    if (!po) return;
    setH("vendorName", po.vendorName || "");
    if (Array.isArray(po.items) && po.items.length) {
      setItems(po.items.map(EMPTY_ITEM));
    }
  };

  /* When switching mode, clear PO-related fields */
  const handleModeSwitch = (newMode) => {
    if (isExisting) return; // can't switch mode on existing GRC
    setMode(newMode);
    if (newMode === "direct") {
      setH("poNo", "");
      // keep vendorName editable
    }
  };

  /* Item update */
  const updateItem = (idx, k, v) => {
    setItems((prev) => {
      const next = [...prev];
      const row  = { ...next[idx], [k]: v };
      const rec  = clamp0(row.receivedQty);
      const rej  = Math.min(clamp0(row.rejectedQty), rec);
      row.rejectedQty = rej;
      row.acceptedQty = Math.max(0, rec - rej);
      next[idx] = row;
      return next;
    });
  };

  const generateBarcode = async (idx) => {
    try {
      const res = await authFetch(`${GRC_API}/barcode/generate`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not generate barcode");
      updateItem(idx, "barcode", data.barcode || "");
    } catch (error) {
      alert(error.message || "Could not generate barcode");
    }
  };

  /* Totals */
  const totals = useMemo(() => {
    let totalReceived = 0, totalAccepted = 0, totalRejected = 0, totalValue = 0;
    for (const it of items) {
      const rec = clamp0(it.receivedQty);
      const rejected = Math.min(clamp0(it.rejectedQty), rec);
      const acc = rec - rejected;
      totalReceived += rec;
      totalAccepted += acc;
      totalRejected += rejected;
      totalValue    += acc * clamp0(it.rate);
    }
    return { totalReceivedQty: totalReceived, totalAcceptedQty: totalAccepted, totalRejectedQty: totalRejected, totalValue };
  }, [items]);

  const handleSubmit = async () => {
    if (!header.receivedBy) return alert("Please enter Received By.");
    if (mode === "po_linked" && !header.poNo) return alert("Please select a Purchase Order.");
    if (!header.vendorName.trim()) return alert("Please enter Vendor Name.");
    const hasQty = items.some((i) => clamp0(i.receivedQty) > 0);
    if (!hasQty) return alert("Enter received quantity for at least one item.");

    const payload = {
      ...(initialGRC?.id ? { id: initialGRC.id } : {}),
      ...header,
      // For direct GRC, explicitly blank out poNo so backend knows
      poNo: mode === "direct" ? "" : header.poNo,
      ...totals,
      items: items.map((it) => ({
        ...it,
        receivedQty: clamp0(it.receivedQty),
        acceptedQty: Math.max(0, clamp0(it.receivedQty) - Math.min(clamp0(it.rejectedQty), clamp0(it.receivedQty))),
        rejectedQty: Math.min(clamp0(it.rejectedQty), clamp0(it.receivedQty)),
        rate:        clamp0(it.rate),
        poQty:       mode === "direct" ? 0 : clamp0(it.poQty),
      })),
    };

    setSaving(true);
    await onSave(payload);
    setSaving(false);
  };

  const inputStyle   = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, background: "#fff", fontFamily: "inherit", boxSizing: "border-box" };
  const readonlyStyle = { ...inputStyle, background: "#F8FAFC", color: "#64748B" };
  const labelStyle    = { fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5, display: "block" };

  const isPoLinked = mode === "po_linked";
  const accentColor = isPoLinked ? "#6366F1" : "#0EA5E9";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "90vh", background: "#F8FAFC" }}>

      {/* Modal header */}
      <div style={{ padding: "18px 24px", background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {initialGRC?.id ? "Edit GRC" : "Create GRC"}
            {" "}
            <span style={{ fontSize: 13, fontWeight: 500, color: accentColor }}>
              — {isPoLinked ? "🔗 PO-Linked" : "📦 Direct / Walk-in"}
            </span>
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
            {isPoLinked
              ? "Goods Receipt Certificate linked to a Purchase Order"
              : "Goods Receipt Certificate — no PO required"}
          </p>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94A3B8" }}>✕</button>
      </div>

      {/* Mode toggle (only for new GRCs) */}
      {!isExisting && (
        <div style={{ padding: "12px 24px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>GRC Type:</span>
          {[
            { key: "po_linked", label: "🔗 PO-Linked", color: "#6366F1", bg: "#EEF2FF" },
            { key: "direct",    label: "📦 Direct / Walk-in", color: "#0EA5E9", bg: "#E0F2FE" },
          ].map(({ key, label, color, bg }) => (
            <button
              key={key}
              className="btn-base"
              onClick={() => handleModeSwitch(key)}
              style={{
                padding: "7px 16px", fontSize: 12,
                background: mode === key ? color : "#fff",
                color: mode === key ? "#fff" : "#64748B",
                border: `1.5px solid ${mode === key ? color : "#E2E8F0"}`,
              }}
            >
              {label}
            </button>
          ))}
          {isPoLinked && (
            <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 8 }}>
             PO must be Approved (or Partially Received for second delivery)
            </span>
          )}
        </div>
      )}

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

        {/* ── Info banner for direct GRC ── */}
        {!isPoLinked && (
          <div style={{ background: "#E0F2FE", border: "1px solid #BAE6FD", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18 }}>📦</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0369A1" }}>Direct / Walk-in GRC</div>
              <div style={{ fontSize: 12, color: "#0284C7", marginTop: 2 }}>
                This GRC is not linked to any Purchase Order. All fields must be filled manually.
                The vendor name, item details, and rates must be entered directly.
              </div>
            </div>
          </div>
        )}

        {/* ─ Header section ─ */}
        <FormSection
          title="GRC Header"
          subtitle="Basic receipt details"
          accentColor={accentColor}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Left col */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>GRC No</label>
                <input readOnly value={initialGRC?.grcNo || "(auto-generated)"} style={readonlyStyle} />
              </div>
              <div>
                <label style={labelStyle}>GRC Date <Req /></label>
                <input type="date" value={header.grcDate} onChange={(e) => setH("grcDate", e.target.value)} style={inputStyle} />
              </div>

              {/* PO field — only in po_linked mode */}
              {isPoLinked ? (
                <div>
                  <label style={labelStyle}>Purchase Order No <Req /></label>
                  <input
                    value={header.poNo}
                    onChange={(e) => handlePOSelect(e.target.value)}
                    list="po-list-grc"
                    placeholder={poLoading ? "Loading POs…" : "Select or type PO No…"}
                    style={inputStyle}
                  />
                  <datalist id="po-list-grc">
                    {pos.map((p) => <option key={p.id} value={p.orderNo}>{p.orderNo} — {p.vendorName}</option>)}
                  </datalist>
                  {header.poNo && !pos.find((p) => p.orderNo === header.poNo) && (
                    <p style={{ fontSize: 11, color: "#F59E0B", margin: "4px 0 0" }}>⚠ PO not in allowed statuses</p>
                  )}
                </div>
              ) : (
                /* Supplier reference for direct GRC */
                <div>
                  <label style={labelStyle}>Supplier Reference No</label>
                  <input
                    value={header.supplierRef || ""}
                    onChange={(e) => setH("supplierRef", e.target.value)}
                    placeholder="Supplier's own ref or DC number"
                    style={inputStyle}
                  />
                </div>
              )}

              {/* Vendor name: readonly+autofilled for PO-linked, editable for direct */}
              <div>
                <label style={labelStyle}>Vendor / Supplier Name <Req /></label>
                {isPoLinked
                  ? <input readOnly value={header.vendorName} style={readonlyStyle} placeholder="Auto-filled from PO" />
                  : <input
                      value={header.vendorName}
                      onChange={(e) => setH("vendorName", e.target.value)}
                      placeholder="Enter vendor or supplier name"
                      style={inputStyle}
                    />
                }
              </div>
            </div>

            {/* Right col */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Received By <Req /></label>
                <input value={header.receivedBy} onChange={(e) => setH("receivedBy", e.target.value)} placeholder="Warehouse officer name" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Delivery Note / Challan No</label>
                <input value={header.deliveryNote} onChange={(e) => setH("deliveryNote", e.target.value)} placeholder="Vendor challan number" style={inputStyle} />
              </div>
              {/* Invoice No — extra for direct GRC */}
              {!isPoLinked && (
                <div>
                  <label style={labelStyle}>Invoice No</label>
                  <input value={header.invoiceNo || ""} onChange={(e) => setH("invoiceNo", e.target.value)} placeholder="Vendor invoice number" style={inputStyle} />
                </div>
              )}
              <div>
                <label style={labelStyle}>Vehicle No</label>
                <input value={header.vehicleNo} onChange={(e) => setH("vehicleNo", e.target.value)} placeholder="e.g. WB-01-AB-1234" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={header.status} onChange={(e) => setH("status", e.target.value)} style={inputStyle}>
                  {["Draft", "Pending", "Approved", "Rejected"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Remarks</label>
            <textarea
              rows={2} value={header.remarks}
              onChange={(e) => setH("remarks", e.target.value)}
              placeholder="Notes about this delivery…"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
        </FormSection>

        {/* ─ KPI bar ─ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, margin: "16px 0" }}>
          {[
            { label: "Total Received", val: totals.totalReceivedQty.toFixed(3), color: "#334155" },
            { label: "Total Accepted", val: totals.totalAcceptedQty.toFixed(3), color: "#059669" },
            { label: "Total Rejected", val: totals.totalRejectedQty.toFixed(3), color: totals.totalRejectedQty > 0 ? "#DC2626" : "#94A3B8" },
            { label: "Accepted Value", val: `₹${money(totals.totalValue)}`,       color: accentColor },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* ─ Items table ─ */}
        <FormSection
          title="Item-wise Receipt"
          subtitle={isPoLinked ? "Pre-filled from PO — enter received and rejected quantities" : "Enter item details, received quantity, and rejected quantity"}
          accentColor={accentColor}
          right={
            <button
              className="btn-base"
              onClick={() => setItems((p) => [...p, EMPTY_ITEM()])}
              style={{ padding: "7px 14px", background: isPoLinked ? "#EEF2FF" : "#E0F2FE", color: accentColor, border: `1px solid ${isPoLinked ? "#C7D2FE" : "#BAE6FD"}`, fontSize: 12 }}
            >
              + Add Row
            </button>
          }
        >
          <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #E2E8F0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1260 }}>
              <thead style={{ background: "#F8FAFC" }}>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {["#","RMS Barcode","Vendor Barcode","Description",
                    ...(isPoLinked ? ["PO Qty"] : []),
                    "Received Qty *","Rejected Qty","Accepted Qty","Rejection Reason","Rate","Accepted Value","Remarks",""].map((h) => (
                    <th key={h} style={{ padding: "9px 10px", fontSize: 11, fontWeight: 700, color: "#64748B", textAlign: h === "#" || h === "" ? "center" : "left", whiteSpace: "nowrap", letterSpacing: ".4px", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const rec = clamp0(it.receivedQty);
                  const rej = Math.min(clamp0(it.rejectedQty), rec);
                  const acc = Math.max(0, rec - rej);
                  const val = acc * clamp0(it.rate);
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9", background: idx % 2 === 0 ? "#fff" : "#FAFBFF" }}>
                      <td style={{ padding: "6px 10px", textAlign: "center", color: "#94A3B8", fontSize: 12, fontWeight: 600 }}>{idx + 1}</td>
                      <td style={{ padding: "4px 6px", minWidth: 190 }}>
                        <div style={{ display: "flex", gap: 5 }}>
                          <ICell value={it.barcode} onChange={(e) => updateItem(idx, "barcode", e.target.value)} placeholder="RMS stock code" />
                          <button
                            type="button"
                            onClick={() => generateBarcode(idx)}
                            title="Generate unique RMS barcode"
                            style={{ border: `1px solid ${accentColor}`, background: isPoLinked ? "#EEF2FF" : "#E0F2FE", color: accentColor, borderRadius: 6, padding: "0 7px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                          >Generate</button>
                        </div>
                      </td>
                      <td style={{ padding: "4px 6px", minWidth: 145 }}><ICell value={it.vendorBarcode} onChange={(e) => updateItem(idx, "vendorBarcode", e.target.value)} placeholder="Supplier barcode / SKU" /></td>
                      <td style={{ padding: "4px 6px" }}><ICell value={it.description}  onChange={(e) => updateItem(idx, "description", e.target.value)} wide /></td>
                      {isPoLinked && (
                        <td style={{ padding: "4px 10px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#64748B", whiteSpace: "nowrap" }}>{n0(it.poQty).toFixed(3)}</td>
                      )}
                      <td style={{ padding: "4px 6px" }}><INum  value={it.receivedQty}  onChange={(e) => updateItem(idx, "receivedQty", e.target.value)} highlight accentColor={accentColor} /></td>
                      <td style={{ padding: "4px 6px" }}><INum  value={it.rejectedQty}  onChange={(e) => updateItem(idx, "rejectedQty", e.target.value)} /></td>
                      <td style={{ padding: "4px 10px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#059669", fontWeight: 700 }}>{acc.toFixed(3)}</td>
                      <td style={{ padding: "4px 6px" }}><ICell value={it.rejectionReason} onChange={(e) => updateItem(idx, "rejectionReason", e.target.value)} placeholder="Damaged / short" /></td>
                      <td style={{ padding: "4px 6px" }}><INum  value={it.rate}         onChange={(e) => updateItem(idx, "rate", e.target.value)} /></td>
                      <td style={{ padding: "4px 10px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: accentColor, fontWeight: 700, whiteSpace: "nowrap" }}>₹{money(val)}</td>
                      <td style={{ padding: "4px 6px" }}><ICell value={it.remarks}      onChange={(e) => updateItem(idx, "remarks", e.target.value)} placeholder="Remarks" /></td>
                      <td style={{ padding: "4px 8px", textAlign: "center" }}>
                        <button
                          onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                          disabled={items.length === 1}
                          style={{ background: "none", border: "none", cursor: items.length === 1 ? "not-allowed" : "pointer", color: "#EF4444", fontSize: 16, opacity: items.length === 1 ? 0.3 : 1 }}
                        >✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FormSection>
      </div>

      {/* Sticky footer */}
      <div style={{ padding: "14px 24px", background: "#fff", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <button
          className="btn-base"
          onClick={handleSubmit}
          disabled={saving}
          style={{ padding: "10px 22px", background: saving ? "#A5B4FC" : accentColor, color: "#fff", fontSize: 13 }}
        >
          {saving ? "Saving…" : initialGRC?.id ? "Update GRC" : "Save GRC"}
        </button>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════
   GRC VIEW MODAL
══════════════════════════════════════════════════════════════════ */
function GRCViewModal({ grc, onClose }) {
  const isLinked = !!(grc.poNo && grc.poNo.trim());

  const fields = [
    ["GRC No",          grc.grcNo],
    ["GRC Date",        grc.grcDate],
    ["Type",            null],   // rendered specially
    ["PO No",           isLinked ? grc.poNo : "—  (Direct/Walk-in)"],
    ["Vendor",          grc.vendorName],
    ["Received By",     grc.receivedBy],
    ["Delivery Note",   grc.deliveryNote],
    ["Vehicle No",      grc.vehicleNo],
    ...(grc.invoiceNo ? [["Invoice No", grc.invoiceNo]] : []),
    ...(grc.supplierRef ? [["Supplier Ref", grc.supplierRef]] : []),
    ["Status",          null],
    ["Total Received",  n0(grc.totalReceivedQty).toFixed(3)],
    ["Total Accepted",  n0(grc.totalAcceptedQty).toFixed(3)],
    ["Total Rejected",  n0(grc.totalRejectedQty).toFixed(3)],
    ["Total Value (₹)", `₹${money(grc.totalValue)}`],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "90vh", background: "#fff" }}>

      <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: isLinked ? "#6366F1" : "#0EA5E9" }}>
              Goods Receipt Certificate
            </h2>
            <GRCTypeBadge poNo={grc.poNo} />
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#94A3B8" }}>
            GRC No: <b style={{ color: "#0F172A", fontFamily: "'DM Mono',monospace" }}>{grc.grcNo}</b>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-base" onClick={() => window.print()} style={{ padding: "8px 14px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", fontSize: 12 }}>Print</button>
          <button className="btn-base" onClick={onClose} style={{ padding: "8px 14px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", fontSize: 12 }}>Close</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {fields.map(([k, v]) => (
            <div key={k} style={{ border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>{k}</div>
              {k === "Status" ? <StatusPill s={grc.status} />
                : k === "Type" ? <GRCTypeBadge poNo={grc.poNo} />
                : <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{v || "—"}</div>
              }
            </div>
          ))}
        </div>

        {/* Items */}
        {Array.isArray(grc.items) && grc.items.length > 0 && (
          <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Item-wise Receipt</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead style={{ background: "#F8FAFC" }}>
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    {["#","Barcode","Description",
                      ...(isLinked ? ["PO Qty"] : []),
                      "Received","Accepted","Rejected","Rate","Value"].map((h) => (
                      <th key={h} style={{ padding: "9px 12px", fontSize: 11, fontWeight: 700, color: "#64748B", textAlign: h === "#" ? "center" : ["Received","Accepted","Rejected","Rate","Value","PO Qty"].includes(h) ? "right" : "left", textTransform: "uppercase", letterSpacing: ".4px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grc.items.map((it, i) => {
                    const val = clamp0(it.acceptedQty) * clamp0(it.rate);
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFBFF" }}>
                        <td style={{ padding: "10px 12px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>{i + 1}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{it.barcode || "—"}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13 }}>{it.description || "—"}</td>
                        {isLinked && <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{n0(it.poQty).toFixed(3)}</td>}
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{n0(it.receivedQty).toFixed(3)}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#059669", fontWeight: 700 }}>{n0(it.acceptedQty).toFixed(3)}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: n0(it.rejectedQty) > 0 ? "#DC2626" : "#94A3B8", fontWeight: 700 }}>{n0(it.rejectedQty).toFixed(3)}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>₹{money(it.rate)}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: isLinked ? "#6366F1" : "#0EA5E9" }}>₹{money(val)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                  <tr>
                    <td colSpan={isLinked ? 4 : 3} style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Totals</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700 }}>{n0(grc.totalReceivedQty).toFixed(3)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: "#059669" }}>{n0(grc.totalAcceptedQty).toFixed(3)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: "#DC2626" }}>{n0(grc.totalRejectedQty).toFixed(3)}</td>
                    <td />
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: isLinked ? "#6366F1" : "#0EA5E9" }}>₹{money(grc.totalValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {grc.status === "Rejected" && grc.rejectionReason && (
          <div style={{ marginTop: 14, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", textTransform: "uppercase", letterSpacing: ".4px" }}>Rejection Reason</div>
            <div style={{ fontSize: 13, color: "#7F1D1D", marginTop: 4 }}>{grc.rejectionReason}</div>
          </div>
        )}

        {grc.remarks && (
          <div style={{ marginTop: 14, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".4px" }}>Remarks</div>
            <div style={{ fontSize: 13, color: "#334155", marginTop: 4 }}>{grc.remarks}</div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════
   Shared UI Primitives
══════════════════════════════════════════════════════════════════ */
function Overlay({ onClose, children }) {
  return createPortal(
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .15s ease" }}
    >
      <div style={{ width: "min(1400px, calc(100vw - 32px))", height: "min(92vh, calc(100dvh - 32px))", maxHeight: "calc(100dvh - 32px)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.2)", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>,
    document.body
  );
}

function SmallModal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "24px", width: "min(420px,92vw)", boxShadow: "0 24px 80px rgba(0,0,0,.2)" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function FormSection({ title, subtitle, right, children, accentColor = "#6366F1" }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `3px solid ${accentColor}` }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function ActionBtn({ children, onClick, color }) {
  return (
    <button className="btn-base" onClick={onClick} style={{ padding: "6px 11px", fontSize: 12, background: `${color}12`, color, border: `1px solid ${color}30` }}>
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }) {
  return (
    <button className="btn-base" onClick={onClick} style={{ padding: "9px 18px", background: "#F8FAFC", color: "#475569", border: "1px solid #E2E8F0", fontSize: 13 }}>
      {children}
    </button>
  );
}

function Req() { return <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>; }

function ICell({ value, onChange, placeholder, wide }) {
  return (
    <input
      value={value || ""}
      onChange={onChange}
      placeholder={placeholder}
      style={{ height: 32, width: wide ? 160 : 110, borderRadius: 6, border: "1px solid #E2E8F0", padding: "0 8px", fontSize: 12, fontFamily: "inherit", background: "#fff" }}
    />
  );
}

function INum({ value, onChange, highlight, accentColor = "#6366F1" }) {
  const highlightBg     = accentColor === "#0EA5E9" ? "#E0F2FE" : "#EEF2FF";
  const highlightBorder = accentColor === "#0EA5E9" ? "#BAE6FD" : "#C7D2FE";
  return (
    <input
      type="number" min="0"
      value={value}
      onChange={onChange}
      style={{
        height: 32, width: 90, borderRadius: 6,
        border: `1px solid ${highlight ? highlightBorder : "#E2E8F0"}`,
        padding: "0 8px", fontSize: 12, textAlign: "right",
        fontFamily: "'DM Mono',monospace",
        background: highlight ? highlightBg : "#fff",
      }}
    />
  );
}
