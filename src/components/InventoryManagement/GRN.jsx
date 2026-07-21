import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

// import React, { useState, useEffect, useMemo, useCallback } from "react";

// /* ─── API ──────────────────────────────────────────────────────── */
// const GRN_API = `${APP_API_URL}/grn`;
// const GRC_API = `${APP_API_URL}/grc`;

// /* ─── Helpers ──────────────────────────────────────────────────── */
// const n0     = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
// const clamp0 = (v) => Math.max(0, n0(v));
// const money  = (v) => clamp0(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// const today  = () => new Date().toISOString().slice(0, 10);

// /* ─── Empty item scaffold ─────────────────────────────────────── */
// const EMPTY_ITEM = (grcItem = {}) => ({
//   barcode:     grcItem.barcode      || "",
//   description: grcItem.description  || "",
//   acceptedQty: grcItem.acceptedQty  || 0,   // read-only — sourced from GRC
//   inwardQty:   grcItem.acceptedQty  || "",   // user edits this
//   rate:        grcItem.vendorRate   || grcItem.rate || 0,
//   amount:      0,
//   binLocation: "",
//   batchNo:     "",
//   expiryDate:  null,
//   remarks:     "",
// });

// /* ─── Status display config ──────────────────────────────────────── */
// const S = {
//   Draft:     { bg: "#1E293B", text: "#94A3B8", border: "#334155", dot: "#475569" },
//   Posted:    { bg: "#052E16", text: "#4ADE80", border: "#166534", dot: "#22C55E" },
//   Cancelled: { bg: "#2D1515", text: "#F87171", border: "#7F1D1D", dot: "#EF4444" },
// };

// function StatusPill({ s }) {
//   const m = S[s] || S.Draft;
//   return (
//     <span style={{
//       display: "inline-flex", alignItems: "center", gap: 5,
//       padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
//       letterSpacing: ".4px", background: m.bg, color: m.text, border: `1px solid ${m.border}`,
//     }}>
//       <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.dot }} />
//       {s || "—"}
//     </span>
//   );
// }

// /* ─── GRC Type badge ──────────────────────────────────────────── */
// function GRCTypeBadge({ poNo }) {
//   const isLinked = !!(poNo && poNo.trim());
//   return (
//     <span style={{
//       display: "inline-flex", alignItems: "center", gap: 4,
//       padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
//       background: isLinked ? "#1E3A5F" : "#0C2340",
//       color: isLinked ? "#60A5FA" : "#22D3EE",
//       border: `1px solid ${isLinked ? "#1D4ED8" : "#0E7490"}`,
//     }}>
//       {isLinked ? "🔗 PO-Linked" : "📦 Direct"}
//     </span>
//   );
// }

// /* ═══════════════════════════════════════════════════════════════════
//    ROOT
// ═══════════════════════════════════════════════════════════════════ */
// export default function GRNManager() {
//   const [grns,         setGrns]         = useState([]);
//   const [loading,      setLoading]      = useState(false);
//   const [toast,        setToast]        = useState(null);
//   const [modal,        setModal]        = useState(null);
//   const [active,       setActive]       = useState(null);
//   const [cancelReason, setCancelReason] = useState("");
//   const [search,       setSearch]       = useState("");
//   const [filterStatus, setFilterStatus] = useState("All");

//   const showToast = (msg, type = "ok") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   const fetchGRNs = useCallback(async () => {
//     try {
//       setLoading(true);
//       const res  = await fetch(`${GRN_API}/`);
//       if (!res.ok) throw new Error("Failed to load GRNs");
//       const data = await res.json();
//       setGrns(Array.isArray(data) ? data : []);
//     } catch (e) { showToast(e.message, "err"); }
//     finally { setLoading(false); }
//   }, []);

//   useEffect(() => { fetchGRNs(); }, [fetchGRNs]);

//   /* ── Save (create / update) ───────────────────────────────────── */
//   // FIX: POST uses trailing slash to avoid 307 redirect dropping the body.
//   // FIX: await fetchGRNs() so loading state doesn't race.
//   const handleSave = async (payload) => {
//     const isEdit = !!payload.id;
//     try {
//       const url = isEdit ? `${GRN_API}/${payload.id}` : `${GRN_API}/`;
//       const res  = await fetch(url, {
//         method:  isEdit ? "PUT" : "POST",
//         headers: { "Content-Type": "application/json" },
//         body:    JSON.stringify(payload),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Save failed");
//       showToast(isEdit ? "GRN updated" : "GRN created");
//       setModal(null);
//       setActive(null);
//       await fetchGRNs(); // FIX: was missing await — caused loading state race condition
//     } catch (e) { showToast(e.message, "err"); }
//   };

//   /* ── Post ─────────────────────────────────────────────────────── */
//   // FIX: await fetchGRNs() so the finally block doesn't kill loading prematurely.
//   const handlePost = async (grn) => {
//     try {
//       setLoading(true);
//       const res  = await fetch(`${GRN_API}/${grn.id}/post`, { method: "POST" });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Post failed");
//       showToast(data.message || "GRN posted — stock updated");
//       await fetchGRNs(); // FIX: was missing await
//     } catch (e) {
//       showToast(e.message, "err");
//       setLoading(false); // only reset here on error; fetchGRNs handles it on success
//     }
//   };

//   /* ── Cancel ───────────────────────────────────────────────────── */
//   // FIX: await fetchGRNs()
//   const handleCancel = async () => {
//     if (!cancelReason.trim()) return showToast("Enter a cancellation reason", "err");
//     try {
//       const res  = await fetch(`${GRN_API}/${active.id}/cancel`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ reason: cancelReason.trim() }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Cancel failed");
//       showToast(data.message || "GRN cancelled");
//       setModal(null);
//       setActive(null);
//       setCancelReason("");
//       await fetchGRNs(); // FIX: was missing await
//     } catch (e) { showToast(e.message, "err"); }
//   };

//   /* ── Delete ───────────────────────────────────────────────────── */
//   // FIX: await fetchGRNs()
//   const handleDelete = async () => {
//     try {
//       const res  = await fetch(`${GRN_API}/${active.id}`, { method: "DELETE" });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Delete failed");
//       showToast("GRN deleted");
//       setModal(null);
//       setActive(null);
//       await fetchGRNs(); // FIX: was missing await
//     } catch (e) { showToast(e.message, "err"); }
//   };

//   /* Filtered rows */
//   const visible = useMemo(() => {
//     const q = search.toLowerCase();
//     return grns.filter((g) => {
//       const ms = filterStatus === "All" || g.status === filterStatus;
//       const mq = !q || [g.grnNo, g.grcNo, g.poNo, g.vendorName, g.inductedBy]
//         .some((f) => (f || "").toLowerCase().includes(q));
//       return ms && mq;
//     });
//   }, [grns, search, filterStatus]);

//   /* Summary KPIs */
//   const kpis = useMemo(() => ({
//     total:     grns.length,
//     posted:    grns.filter((g) => g.status === "Posted").length,
//     draft:     grns.filter((g) => g.status === "Draft").length,
//     cancelled: grns.filter((g) => g.status === "Cancelled").length,
//     totalQty:  grns.filter((g) => g.status === "Posted").reduce((s, g) => s + n0(g.totalInwardQty), 0),
//     totalVal:  grns.filter((g) => g.status === "Posted").reduce((s, g) => s + n0(g.totalAmount), 0),
//   }), [grns]);

//   return (
//     <div style={{ minHeight: "100vh", background: "#0B0F1A", color: "#E2E8F0", fontFamily: "'Syne', sans-serif" }}>
//       <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

//       <style>{`
//         * { box-sizing: border-box; }
//         @keyframes slideDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:none; } }
//         @keyframes spin { to { transform:rotate(360deg); } }
//         .rh:hover { background: #131929 !important; }
//         .btn { cursor:pointer; border:none; font-family:'Syne',sans-serif; font-weight:700; border-radius:7px; transition:all .15s; letter-spacing:.2px; }
//         .btn:active { transform:scale(.96); }
//         input,select,textarea { font-family:'Syne',sans-serif; }
//         input:focus,select:focus,textarea:focus { outline:none !important; border-color:#3B82F6 !important; box-shadow:0 0 0 3px rgba(59,130,246,.18) !important; }
//         ::-webkit-scrollbar { width:4px; height:4px; }
//         ::-webkit-scrollbar-track { background:transparent; }
//         ::-webkit-scrollbar-thumb { background:#1E293B; border-radius:4px; }
//         .inp { background:#0F172A; border:1px solid #1E293B; color:#E2E8F0; border-radius:7px; padding:9px 12px; font-size:13px; width:100%; }
//         .inp::placeholder { color:#334155; }
//         .inp-ro { background:#070C14; border:1px solid #151E2D; color:#475569; cursor:default; }
//         .cell { background:#0F172A; border:1px solid #1E293B; color:#E2E8F0; border-radius:6px; padding:0 8px; font-size:12px; height:32px; width:100%; }
//         .cell-num { font-family:'JetBrains Mono',monospace; text-align:right; }
//         .cell-accent { border-color:#1E3A5F; background:#0A1929; }
//       `}</style>

//       {/* Toast */}
//       {toast && (
//         <div style={{
//           position: "fixed", top: 20, right: 20, zIndex: 9999,
//           padding: "12px 20px", borderRadius: 9, fontWeight: 700, fontSize: 13,
//           background: toast.type === "err" ? "#2D1515" : "#052E16",
//           color: toast.type === "err" ? "#F87171" : "#4ADE80",
//           border: `1px solid ${toast.type === "err" ? "#7F1D1D" : "#166534"}`,
//           animation: "slideDown .2s ease", letterSpacing: ".2px",
//         }}>
//           {toast.type === "err" ? "✗ " : "✓ "}{toast.msg}
//         </div>
//       )}

//       <div style={{ maxWidth: 1440, margin: "0 auto", padding: "28px 24px" }}>

//         {/* ── Header ── */}
//         <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 14 }}>
//           <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
//             <div style={{ width: 44, height: 44, borderRadius: 12, background: "#0F172A", border: "1px solid #1E293B", display: "flex", alignItems: "center", justifyContent: "center" }}>
//               <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
//                 <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
//                 <polyline points="9 22 9 12 15 12 15 22"/>
//               </svg>
//             </div>
//             <div>
//               <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", color: "#F1F5F9" }}>Goods Receipt Note</h1>
//               <p style={{ margin: 0, fontSize: 12, color: "#475569", marginTop: 2, letterSpacing: ".2px" }}>Stock induction from approved GRCs (PO-linked &amp; direct) into warehouse inventory</p>
//             </div>
//           </div>
//           <button className="btn" onClick={() => { setActive(null); setModal("form"); }}
//             style={{ padding: "11px 20px", background: "#3B82F6", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}>
//             <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 400 }}>+</span> Create GRN
//           </button>
//         </div>

//         {/* ── KPI Strip ── */}
//         <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 20 }}>
//           {[
//             { label: "Total GRNs",   val: kpis.total,                 accent: "#64748B" },
//             { label: "Posted",       val: kpis.posted,                accent: "#22C55E" },
//             { label: "Draft",        val: kpis.draft,                 accent: "#3B82F6" },
//             { label: "Cancelled",    val: kpis.cancelled,             accent: "#EF4444" },
//             { label: "Posted Qty",   val: kpis.totalQty.toFixed(2),   accent: "#F59E0B" },
//             { label: "Posted Value", val: `₹${money(kpis.totalVal)}`, accent: "#A78BFA" },
//           ].map(({ label, val, accent }) => (
//             <div key={label} style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10, padding: "14px 14px 12px" }}>
//               <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>{label}</div>
//               <div style={{ fontSize: 17, fontWeight: 800, color: accent, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "-.5px" }}>{val}</div>
//             </div>
//           ))}
//         </div>

//         {/* ── Filters ── */}
//         <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
//           <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
//             <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
//             <input className="inp" placeholder="Search GRN No, GRC No, PO, vendor…" value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               style={{ paddingLeft: 32 }} />
//           </div>
//           {["All", "Draft", "Posted", "Cancelled"].map((s) => (
//             <button key={s} className="btn"
//               onClick={() => setFilterStatus(s)}
//               style={{
//                 padding: "8px 14px", fontSize: 12,
//                 background: filterStatus === s ? "#1E3A5F" : "#0F172A",
//                 color: filterStatus === s ? "#60A5FA" : "#475569",
//                 border: `1px solid ${filterStatus === s ? "#2563EB" : "#1E293B"}`,
//               }}>
//               {s}
//             </button>
//           ))}
//         </div>

//         {/* ── Table ── */}
//         <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12, overflow: "hidden" }}>
//           <div style={{ overflowX: "auto" }}>
//             <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
//               <thead>
//                 <tr style={{ borderBottom: "1px solid #1E293B", background: "#070C14" }}>
//                   {["GRN No","Date","GRC No","Type","PO No","Vendor","Inducted By","Status","Inward Qty","Value (₹)","Actions"].map((h) => (
//                     <th key={h} style={{
//                       padding: "10px 14px", fontSize: 10, fontWeight: 700,
//                       color: "#334155", textTransform: "uppercase", letterSpacing: ".8px",
//                       textAlign: ["Inward Qty","Value (₹)","Actions"].includes(h) ? "right" : "left",
//                       whiteSpace: "nowrap",
//                     }}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {loading ? (
//                   <tr><td colSpan={11} style={{ padding: 48, textAlign: "center", color: "#334155", fontSize: 13 }}>
//                     <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
//                       <div style={{ width: 14, height: 14, border: "2px solid #1E293B", borderTopColor: "#3B82F6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
//                       Loading GRNs…
//                     </div>
//                   </td></tr>
//                 ) : visible.length === 0 ? (
//                   <tr><td colSpan={11} style={{ padding: 48, textAlign: "center", color: "#334155", fontSize: 13 }}>
//                     {search || filterStatus !== "All" ? "No GRNs match your filters." : "No GRNs yet. Click Create GRN to start."}
//                   </td></tr>
//                 ) : visible.map((g, i) => (
//                   <tr key={g.id} className="rh" style={{ borderBottom: "1px solid #0F1824", background: i % 2 === 0 ? "#0F172A" : "#0A1120" }}>
//                     <td style={{ padding: "12px 14px" }}>
//                       <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 500, color: "#3B82F6" }}>{g.grnNo || "—"}</span>
//                     </td>
//                     <td style={{ padding: "12px 14px", fontSize: 13, color: "#94A3B8" }}>{g.grnDate || "—"}</td>
//                     <td style={{ padding: "12px 14px" }}>
//                       <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#22D3EE" }}>{g.grcNo || "—"}</span>
//                     </td>
//                     <td style={{ padding: "12px 14px" }}>
//                       <GRCTypeBadge poNo={g.poNo} />
//                     </td>
//                     <td style={{ padding: "12px 14px" }}>
//                       {g.poNo
//                         ? <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#94A3B8" }}>{g.poNo}</span>
//                         : <span style={{ fontSize: 11, color: "#334155", fontStyle: "italic" }}>Walk-in</span>
//                       }
//                     </td>
//                     <td style={{ padding: "12px 14px", fontSize: 13, color: "#CBD5E1" }}>{g.vendorName || "—"}</td>
//                     <td style={{ padding: "12px 14px", fontSize: 13, color: "#94A3B8" }}>{g.inductedBy || "—"}</td>
//                     <td style={{ padding: "12px 14px" }}><StatusPill s={g.status} /></td>
//                     <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#F59E0B", fontWeight: 500 }}>
//                       {n0(g.totalInwardQty).toFixed(3)}
//                     </td>
//                     <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A78BFA", fontWeight: 500 }}>
//                       ₹{money(g.totalAmount)}
//                     </td>
//                     <td style={{ padding: "12px 14px", textAlign: "right" }}>
//                       <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
//                         <TblBtn color="#22D3EE" onClick={() => { setActive(g); setModal("view"); }}>View</TblBtn>
//                         {g.status === "Draft" && <>
//                           <TblBtn color="#3B82F6" onClick={() => { setActive(g); setModal("form"); }}>Edit</TblBtn>
//                           <TblBtn color="#22C55E" onClick={() => handlePost(g)}>Post</TblBtn>
//                           <TblBtn color="#EF4444" onClick={() => { setActive(g); setModal("delete"); }}>Del</TblBtn>
//                         </>}
//                         {g.status === "Posted" && (
//                           <TblBtn color="#F87171" onClick={() => { setActive(g); setCancelReason(""); setModal("cancel"); }}>Cancel</TblBtn>
//                         )}
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//           {visible.length > 0 && (
//             <div style={{ padding: "9px 16px", borderTop: "1px solid #1E293B", display: "flex", justifyContent: "space-between" }}>
//               <span style={{ fontSize: 11, color: "#334155" }}>Showing {visible.length} of {grns.length}</span>
//               <span style={{ fontSize: 11, color: "#334155" }}>
//                 Filtered posted qty: <b style={{ color: "#F59E0B", fontFamily: "'JetBrains Mono',monospace" }}>
//                   {visible.reduce((s, g) => s + (g.status === "Posted" ? n0(g.totalInwardQty) : 0), 0).toFixed(3)}
//                 </b>
//               </span>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* ── Modals ── */}
//       {modal === "form" && (
//         <Overlay onClose={() => { setModal(null); setActive(null); }}>
//           <GRNForm initialGRN={active} onClose={() => { setModal(null); setActive(null); }} onSave={handleSave} />
//         </Overlay>
//       )}
//       {modal === "view" && active && (
//         <Overlay onClose={() => setModal(null)}>
//           <GRNViewModal grn={active} onClose={() => setModal(null)} />
//         </Overlay>
//       )}
//       {modal === "cancel" && active && (
//         <MiniModal title={`Cancel ${active.grnNo}?`} onClose={() => { setModal(null); setActive(null); setCancelReason(""); }}>
//           <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 12px", lineHeight: 1.5 }}>
//             This will reverse stock in inventory. Enter a reason.
//           </p>
//           <textarea className="inp" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
//             placeholder="e.g. Wrong items, duplicate entry…" style={{ resize: "vertical" }} />
//           <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
//             <GhostBtn onClick={() => { setModal(null); setActive(null); setCancelReason(""); }}>Back</GhostBtn>
//             <button className="btn" onClick={handleCancel} style={{ padding: "9px 18px", background: "#7F1D1D", color: "#FCA5A5", fontSize: 13, border: "1px solid #991B1B" }}>
//               Confirm Cancel
//             </button>
//           </div>
//         </MiniModal>
//       )}
//       {modal === "delete" && active && (
//         <MiniModal title="Delete Draft GRN?" onClose={() => { setModal(null); setActive(null); }}>
//           <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px" }}>
//             Delete <b style={{ color: "#E2E8F0" }}>{active.grnNo}</b>? This cannot be undone.
//           </p>
//           <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
//             <GhostBtn onClick={() => { setModal(null); setActive(null); }}>Back</GhostBtn>
//             <button className="btn" onClick={handleDelete} style={{ padding: "9px 18px", background: "#7F1D1D", color: "#FCA5A5", fontSize: 13, border: "1px solid #991B1B" }}>
//               Delete
//             </button>
//           </div>
//         </MiniModal>
//       )}
//     </div>
//   );
// }


// /* ═══════════════════════════════════════════════════════════════════
//    GRN FORM
// ═══════════════════════════════════════════════════════════════════ */
// function GRNForm({ initialGRN, onClose, onSave }) {
//   const [grcs,       setGrcs]       = useState([]);
//   const [grcLoading, setGrcLoading] = useState(false);
//   const [saving,     setSaving]     = useState(false);

//   const [header, setHeader] = useState({
//     grnDate:       initialGRN?.grnDate       || today(),
//     grcNo:         initialGRN?.grcNo         || "",
//     poNo:          initialGRN?.poNo          || "",
//     vendorName:    initialGRN?.vendorName    || "",
//     warehouseCode: initialGRN?.warehouseCode || "",
//     inductedBy:    initialGRN?.inductedBy    || "",
//     approvedBy:    initialGRN?.approvedBy    || "",
//     remarks:       initialGRN?.remarks       || "",
//     // FIX: status is NOT stored in editable header — it's managed only by
//     // backend workflow actions (Post / Cancel). We keep it here for read-only
//     // display and to pass through unchanged on edits.
//     status:        initialGRN?.status        || "Draft",
//   });

//   // Track whether the selected GRC is direct or PO-linked
//   const [selectedGRC, setSelectedGRC] = useState(null);

//   const [items, setItems] = useState(
//     Array.isArray(initialGRN?.items) && initialGRN.items.length
//       ? initialGRN.items.map((it) => ({ ...EMPTY_ITEM(), ...it }))
//       : [EMPTY_ITEM()]
//   );

//   const setH = (k, v) => setHeader((p) => ({ ...p, [k]: v }));

//   /* Load ALL Approved GRCs (both PO-linked and direct) */
//   useEffect(() => {
//     (async () => {
//       try {
//         setGrcLoading(true);
//         const res  = await fetch(`${GRC_API}/`);
//         const data = await res.json();
//         setGrcs(Array.isArray(data) ? data.filter((g) => g.status === "Approved") : []);
//       } catch (e) { console.error(e); }
//       finally { setGrcLoading(false); }
//     })();
//   }, []);

//   /* When GRC selected → prefill header + items from GRC
//    *
//    * FIX: Direct GRCs may have items where acceptedQty === 0 (the backend sets
//    * acceptedQty = inwardQty at save time, not at GRC creation time). The old
//    * filter `.filter((it) => clamp0(it.acceptedQty) > 0)` silently dropped ALL
//    * walk-in items, leaving the item table blank for direct GRCs.
//    *
//    * Correct logic:
//    *  - PO-linked GRC → keep only items with acceptedQty > 0 (normal receiving)
//    *  - Direct GRC    → keep ALL items regardless of acceptedQty (user fills inwardQty)
//    */
//   const handleGRCSelect = (grcNo) => {
//     setH("grcNo", grcNo);
//     const grc = grcs.find((g) => g.grcNo === grcNo);
//     if (!grc) { setSelectedGRC(null); return; }
//     setSelectedGRC(grc);
//     setH("poNo", grc.poNo || "");
//     setH("vendorName", grc.vendorName || "");
//     if (Array.isArray(grc.items) && grc.items.length) {
//       const isDirect = !(grc.poNo && grc.poNo.trim());
//       const grcItems = isDirect
//         ? grc.items                                            // FIX: all items for direct GRCs
//         : grc.items.filter((it) => clamp0(it.acceptedQty) > 0); // PO-linked: only accepted items
//       setItems(grcItems.length ? grcItems.map(EMPTY_ITEM) : [EMPTY_ITEM()]);
//     }
//   };

//   const updateItem = (idx, k, v) => {
//     setItems((prev) => {
//       const next = [...prev];
//       const row  = { ...next[idx], [k]: v };
//       if (k === "inwardQty") {
//         const max = clamp0(row.acceptedQty);
//         row.inwardQty = max > 0 ? Math.min(clamp0(v), max) : clamp0(v);
//       }
//       row.amount = clamp0(row.inwardQty) * clamp0(row.rate);
//       next[idx] = row;
//       return next;
//     });
//   };

//   /* Live totals */
//   const totals = useMemo(() => {
//     let qty = 0, amt = 0;
//     for (const it of items) {
//       const max    = clamp0(it.acceptedQty);
//       const inward = max > 0 ? Math.min(clamp0(it.inwardQty), max) : clamp0(it.inwardQty);
//       qty += inward;
//       amt += inward * clamp0(it.rate);
//     }
//     return { totalInwardQty: qty, totalAmount: amt };
//   }, [items]);

//   const handleSubmit = async () => {
//     if (!header.grcNo)      return alert("Please select an Approved GRC.");
//     if (!header.inductedBy) return alert("Please enter Inducted By.");
//     const hasQty = items.some((i) => clamp0(i.inwardQty) > 0);
//     if (!hasQty) return alert("Enter inward quantity for at least one item.");

//     // FIX: status is NOT taken from editable header. New GRNs are always "Draft".
//     // Existing GRNs preserve their current status (only Post/Cancel actions change it).
//     // This prevents bypassing the inventory-update workflow by manually setting status.
//     const safeStatus = initialGRN?.id ? initialGRN.status : "Draft";

//     const payload = {
//       ...(initialGRN?.id ? { id: initialGRN.id } : {}),
//       ...header,
//       status: safeStatus, // FIX: always use safe status, not whatever the header holds
//       ...totals,
//       items: items.map((it) => {
//         const max    = clamp0(it.acceptedQty);
//         const inward = max > 0 ? Math.min(clamp0(it.inwardQty), max) : clamp0(it.inwardQty);
//         return {
//           ...it,
//           inwardQty:   inward,
//           acceptedQty: max > 0 ? max : inward,
//           amount:      inward * clamp0(it.rate),
//         };
//       }),
//     };
//     setSaving(true);
//     await onSave(payload);
//     setSaving(false);
//   };

//   const isDirectGRC = selectedGRC
//     ? !(selectedGRC.poNo && selectedGRC.poNo.trim())
//     : !(initialGRN?.poNo && initialGRN?.poNo?.trim());

//   return (
//     <div style={{ display: "flex", flexDirection: "column", height: "90vh", background: "#0B0F1A", color: "#E2E8F0" }}>

//       {/* Header */}
//       <div style={{ padding: "16px 24px", background: "#0F172A", borderBottom: "1px solid #1E293B", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//         <div>
//           <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#F1F5F9", letterSpacing: "-.3px" }}>
//             {initialGRN?.id ? "Edit GRN" : "Create GRN"}
//             {header.grcNo && (
//               <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 10 }}>
//                 <GRCTypeBadge poNo={isDirectGRC ? "" : "linked"} />
//               </span>
//             )}
//           </h2>
//           <p style={{ margin: 0, fontSize: 11, color: "#475569", marginTop: 2 }}>
//             Inducts stock from an approved GRC — works for both PO-linked and direct walk-in GRCs
//           </p>
//         </div>
//         <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 20, lineHeight: 1 }}>✕</button>
//       </div>

//       {/* Body */}
//       <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

//         {/* ─ Header fields ─ */}
//         <Card title="GRN Header" sub="Basic induction details">
//           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

//             {/* Left */}
//             <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
//               <Field label="GRN No">
//                 <input className="inp inp-ro" readOnly value={initialGRN?.grnNo || "(auto-generated)"} />
//               </Field>
//               <Field label="GRN Date" req>
//                 <input className="inp" type="date" value={header.grnDate} onChange={(e) => setH("grnDate", e.target.value)} />
//               </Field>
//               <Field label="Approved GRC No" req>
//                 <input
//                   className="inp"
//                   value={header.grcNo}
//                   onChange={(e) => handleGRCSelect(e.target.value)}
//                   list="grc-list-grn"
//                   disabled={grcLoading}
//                   placeholder={grcLoading ? "Loading GRCs…" : "Select approved GRC (PO-linked or direct)…"}
//                 />
//                 <datalist id="grc-list-grn">
//                   {grcs.map((g) => (
//                     <option key={g.id} value={g.grcNo}>
//                       {g.grcNo} — {g.vendorName} {g.poNo ? `(PO: ${g.poNo})` : "(Direct)"}
//                     </option>
//                   ))}
//                 </datalist>
//                 {header.grcNo && !grcs.find((g) => g.grcNo === header.grcNo) && !grcLoading && (
//                   <p style={{ fontSize: 11, color: "#F59E0B", margin: "4px 0 0" }}>
//                     ⚠ GRC not found in Approved list
//                   </p>
//                 )}
//               </Field>
//               <Field label="PO No">
//                 <input
//                   className="inp inp-ro"
//                   readOnly
//                   value={header.poNo || ""}
//                   placeholder={isDirectGRC ? "N/A — Direct/Walk-in GRC" : "Auto-filled from GRC"}
//                 />
//               </Field>
//               <Field label="Vendor">
//                 <input className="inp inp-ro" readOnly value={header.vendorName} placeholder="Auto-filled from GRC" />
//               </Field>
//             </div>

//             {/* Right */}
//             <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
//               <Field label="Inducted By" req>
//                 <input className="inp" value={header.inductedBy} onChange={(e) => setH("inductedBy", e.target.value)} placeholder="Warehouse officer" />
//               </Field>
//               <Field label="Approved By">
//                 <input className="inp" value={header.approvedBy} onChange={(e) => setH("approvedBy", e.target.value)} placeholder="Manager / supervisor" />
//               </Field>
//               <Field label="Warehouse Code">
//                 <input className="inp" value={header.warehouseCode} onChange={(e) => setH("warehouseCode", e.target.value)} placeholder="e.g. WH-01, RACK-B3" />
//               </Field>

//               {/* FIX: Status is now read-only — controlled by backend workflow actions only.
//                   Allowing manual status edits would bypass inventory-update logic in Post/Cancel
//                   routes and create corrupt stock records. Show it as a read-only pill instead. */}
//               <Field label="Status">
//                 <div style={{
//                   background: "#070C14", border: "1px solid #151E2D",
//                   borderRadius: 7, padding: "7px 12px",
//                   display: "flex", alignItems: "center", gap: 8,
//                 }}>
//                   <StatusPill s={header.status} />
//                   <span style={{ fontSize: 11, color: "#334155" }}>
//                     {header.status === "Draft"
//                       ? "Use Post action to update stock"
//                       : "Use Cancel action to reverse stock"}
//                   </span>
//                 </div>
//               </Field>

//               <Field label="Remarks">
//                 <textarea className="inp" rows={2} value={header.remarks} onChange={(e) => setH("remarks", e.target.value)} placeholder="Any notes…" style={{ resize: "vertical" }} />
//               </Field>
//             </div>
//           </div>
//         </Card>

//         {/* ─ Direct GRC info banner ─ */}
//         {isDirectGRC && header.grcNo && (
//           <div style={{ background: "#0C2340", border: "1px solid #0E7490", borderRadius: 9, padding: "11px 14px", marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
//             <span style={{ fontSize: 18 }}>📦</span>
//             <div>
//               <div style={{ fontSize: 12, fontWeight: 700, color: "#22D3EE" }}>Direct / Walk-in GRC</div>
//               <div style={{ fontSize: 11, color: "#0891B2", marginTop: 2 }}>
//                 This GRN is against a direct GRC (no PO). Items pre-filled from GRC — enter the inward quantity for each.
//               </div>
//             </div>
//           </div>
//         )}

//         {/* ─ KPI strip ─ */}
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "14px 0" }}>
//           {[
//             { label: "Total Inward Qty", val: totals.totalInwardQty.toFixed(3), color: "#F59E0B" },
//             { label: "Total Amount (₹)", val: `₹${money(totals.totalAmount)}`,  color: "#A78BFA" },
//           ].map(({ label, val, color }) => (
//             <div key={label} style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 9, padding: "13px 16px" }}>
//               <div style={{ fontSize: 10, color: "#334155", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 5 }}>{label}</div>
//               <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "-.5px" }}>{val}</div>
//             </div>
//           ))}
//         </div>

//         {/* ─ Items table ─ */}
//         <Card
//           title="Item-wise Induction"
//           sub={isDirectGRC
//             ? "Direct GRC — enter inward qty for each item (no acceptedQty cap)"
//             : "Inward qty cannot exceed GRC accepted qty"}
//           right={
//             <button className="btn" onClick={() => setItems((p) => [...p, EMPTY_ITEM()])}
//               style={{ padding: "6px 12px", background: "#1E3A5F", color: "#60A5FA", border: "1px solid #1D4ED8", fontSize: 11 }}>
//               + Add Row
//             </button>
//           }
//         >
//           <div style={{ overflowX: "auto", borderRadius: 7, border: "1px solid #1E293B" }}>
//             <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1140 }}>
//               <thead style={{ background: "#070C14" }}>
//                 <tr style={{ borderBottom: "1px solid #1E293B" }}>
//                   {["#","Barcode","Description","Accepted Qty","Inward Qty ✎","Bin Location","Batch No","Expiry","Rate","Amount","Remarks",""].map((h) => (
//                     <th key={h} style={{
//                       padding: "9px 10px", fontSize: 10, fontWeight: 700, color: "#334155",
//                       textTransform: "uppercase", letterSpacing: ".6px", textAlign: "left", whiteSpace: "nowrap",
//                     }}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {items.map((it, idx) => {
//                   const maxQty = clamp0(it.acceptedQty);
//                   const inward = maxQty > 0 ? Math.min(clamp0(it.inwardQty), maxQty) : clamp0(it.inwardQty);
//                   const over   = maxQty > 0 && clamp0(it.inwardQty) > maxQty;
//                   return (
//                     <tr key={idx} style={{ borderBottom: "1px solid #0B1120", background: idx % 2 === 0 ? "#0F172A" : "#0A1120" }}>
//                       <td style={{ padding: "5px 10px", fontSize: 11, color: "#334155", fontWeight: 700 }}>{idx + 1}</td>
//                       <td style={{ padding: "4px 5px" }}><input className="cell" value={it.barcode}     onChange={(e) => updateItem(idx, "barcode", e.target.value)} style={{ width: 110 }} /></td>
//                       <td style={{ padding: "4px 5px" }}><input className="cell" value={it.description} onChange={(e) => updateItem(idx, "description", e.target.value)} style={{ width: 150 }} /></td>
//                       <td style={{ padding: "5px 10px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#22D3EE" }}>
//                         {maxQty > 0 ? n0(it.acceptedQty).toFixed(3) : <span style={{ color: "#334155", fontStyle: "italic" }}>—</span>}
//                       </td>
//                       <td style={{ padding: "4px 5px" }}>
//                         <input
//                           className={`cell cell-num ${over ? "" : "cell-accent"}`}
//                           type="number" min="0"
//                           max={maxQty > 0 ? maxQty : undefined}
//                           value={it.inwardQty}
//                           onChange={(e) => updateItem(idx, "inwardQty", e.target.value)}
//                           style={{ width: 90, borderColor: over ? "#7F1D1D" : undefined, background: over ? "#2D1515" : undefined }}
//                         />
//                         {over && <div style={{ fontSize: 10, color: "#F87171", marginTop: 2 }}>Exceeds accepted</div>}
//                       </td>
//                       <td style={{ padding: "4px 5px" }}><input className="cell" value={it.binLocation} onChange={(e) => updateItem(idx, "binLocation", e.target.value)} placeholder="WH-A1-R2" style={{ width: 100 }} /></td>
//                       <td style={{ padding: "4px 5px" }}><input className="cell" value={it.batchNo}     onChange={(e) => updateItem(idx, "batchNo", e.target.value)} placeholder="BAT-001" style={{ width: 90 }} /></td>
//                       <td style={{ padding: "4px 5px" }}><input className="cell" type="date" value={it.expiryDate || ""} onChange={(e) => updateItem(idx, "expiryDate", e.target.value)} style={{ width: 120 }} /></td>
//                       <td style={{ padding: "4px 5px" }}><input className="cell cell-num" type="number" min="0" value={it.rate} onChange={(e) => updateItem(idx, "rate", e.target.value)} style={{ width: 80 }} /></td>
//                       <td style={{ padding: "5px 10px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A78BFA", fontWeight: 500, whiteSpace: "nowrap" }}>
//                         ₹{money(inward * clamp0(it.rate))}
//                       </td>
//                       <td style={{ padding: "4px 5px" }}><input className="cell" value={it.remarks} onChange={(e) => updateItem(idx, "remarks", e.target.value)} placeholder="Notes" style={{ width: 100 }} /></td>
//                       <td style={{ padding: "4px 8px" }}>
//                         <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
//                           disabled={items.length === 1}
//                           style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 15, opacity: items.length === 1 ? 0.2 : 1 }}>✕</button>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         </Card>
//       </div>

//       {/* Footer */}
//       <div style={{ padding: "14px 24px", background: "#0F172A", borderTop: "1px solid #1E293B", display: "flex", justifyContent: "flex-end", gap: 10 }}>
//         <GhostBtn onClick={onClose}>Cancel</GhostBtn>
//         <button className="btn" onClick={handleSubmit} disabled={saving}
//           style={{ padding: "10px 22px", background: saving ? "#1E3A5F" : "#3B82F6", color: saving ? "#60A5FA" : "#fff", fontSize: 13 }}>
//           {saving ? "Saving…" : initialGRN?.id ? "Update GRN" : "Save GRN"}
//         </button>
//       </div>
//     </div>
//   );
// }


// /* ═══════════════════════════════════════════════════════════════════
//    GRN VIEW MODAL
// ═══════════════════════════════════════════════════════════════════ */
// function GRNViewModal({ grn, onClose }) {
//   const isDirectGRC = !(grn.poNo && grn.poNo.trim());

//   const meta = [
//     ["GRN No",       grn.grnNo],
//     ["GRN Date",     grn.grnDate],
//     ["GRC No",       grn.grcNo],
//     ["Type",         "GRC_TYPE"],
//     ["PO No",        isDirectGRC ? "N/A — Direct Walk-in" : (grn.poNo || "—")],
//     ["Vendor",       grn.vendorName],
//     ["Inducted By",  grn.inductedBy],
//     ["Approved By",  grn.approvedBy],
//     ["Warehouse",    grn.warehouseCode],
//     ["Status",       "STATUS"],
//     ["Total Inward", n0(grn.totalInwardQty).toFixed(3)],
//     ["Total Amount", `₹${money(grn.totalAmount)}`],
//   ];

//   return (
//     <div style={{ display: "flex", flexDirection: "column", height: "90vh", background: "#0B0F1A", color: "#E2E8F0" }}>

//       {/* Header */}
//       <div style={{ padding: "16px 24px", background: "#0F172A", borderBottom: "1px solid #1E293B", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//         <div>
//           <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
//             <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#3B82F6", letterSpacing: "-.3px" }}>Goods Receipt Note</h2>
//             <GRCTypeBadge poNo={grn.poNo} />
//           </div>
//           <p style={{ margin: 0, fontSize: 11, color: "#475569", marginTop: 2 }}>
//             GRN No: <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#94A3B8" }}>{grn.grnNo}</span>
//           </p>
//         </div>
//         <div style={{ display: "flex", gap: 8 }}>
//           <button className="btn" onClick={() => window.print()}
//             style={{ padding: "8px 14px", background: "#0F172A", color: "#64748B", border: "1px solid #1E293B", fontSize: 12 }}>Print</button>
//           <button className="btn" onClick={onClose}
//             style={{ padding: "8px 14px", background: "#0F172A", color: "#64748B", border: "1px solid #1E293B", fontSize: 12 }}>Close</button>
//         </div>
//       </div>

//       <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

//         {/* Info grid */}
//         <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 20 }}>
//           {meta.map(([k, v]) => (
//             <div key={k} style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 14px" }}>
//               <div style={{ fontSize: 10, color: "#334155", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>{k}</div>
//               {v === "STATUS"
//                 ? <StatusPill s={grn.status} />
//                 : v === "GRC_TYPE"
//                 ? <GRCTypeBadge poNo={grn.poNo} />
//                 : <div style={{ fontSize: 13, fontWeight: 700, color: "#CBD5E1", fontFamily: ["GRN No","GRC No","PO No"].includes(k) ? "'JetBrains Mono',monospace" : "inherit" }}>{v || "—"}</div>
//               }
//             </div>
//           ))}
//         </div>

//         {/* Items table */}
//         {Array.isArray(grn.items) && grn.items.length > 0 && (
//           <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10, overflow: "hidden" }}>
//             <div style={{ padding: "11px 16px", borderBottom: "1px solid #1E293B", background: "#070C14" }}>
//               <span style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", letterSpacing: ".3px" }}>ITEM-WISE INDUCTION</span>
//             </div>
//             <div style={{ overflowX: "auto" }}>
//               <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
//                 <thead style={{ background: "#070C14" }}>
//                   <tr style={{ borderBottom: "1px solid #1E293B" }}>
//                     {["#","Barcode","Description","Accepted","Inducted","Bin","Batch","Expiry","Rate","Amount"].map((h) => (
//                       <th key={h} style={{
//                         padding: "9px 12px", fontSize: 10, fontWeight: 700, color: "#334155",
//                         textTransform: "uppercase", letterSpacing: ".6px",
//                         textAlign: ["Accepted","Inducted","Rate","Amount"].includes(h) ? "right" : "left",
//                       }}>{h}</th>
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {grn.items.map((it, i) => (
//                     <tr key={i} style={{ borderBottom: "1px solid #0B1120", background: i % 2 === 0 ? "#0F172A" : "#0A1120" }}>
//                       <td style={{ padding: "10px 12px", fontSize: 11, color: "#334155" }}>{i + 1}</td>
//                       <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#22D3EE" }}>{it.barcode || "—"}</td>
//                       <td style={{ padding: "10px 12px", fontSize: 13, color: "#CBD5E1" }}>{it.description || "—"}</td>
//                       <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#22D3EE" }}>{n0(it.acceptedQty).toFixed(3)}</td>
//                       <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#F59E0B", fontWeight: 700 }}>{n0(it.inwardQty).toFixed(3)}</td>
//                       <td style={{ padding: "10px 12px", fontSize: 12, color: "#64748B" }}>{it.binLocation || "—"}</td>
//                       <td style={{ padding: "10px 12px", fontSize: 12, color: "#64748B", fontFamily: "'JetBrains Mono',monospace" }}>{it.batchNo || "—"}</td>
//                       <td style={{ padding: "10px 12px", fontSize: 12, color: "#64748B" }}>{it.expiryDate || "—"}</td>
//                       <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#94A3B8" }}>₹{money(it.rate)}</td>
//                       <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#A78BFA", fontWeight: 700 }}>₹{money(it.amount)}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//                 <tfoot style={{ borderTop: "2px solid #1E293B", background: "#070C14" }}>
//                   <tr>
//                     <td colSpan={4} style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Totals</td>
//                     <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: "#F59E0B" }}>{n0(grn.totalInwardQty).toFixed(3)}</td>
//                     <td colSpan={4} />
//                     <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: "#A78BFA" }}>₹{money(grn.totalAmount)}</td>
//                   </tr>
//                 </tfoot>
//               </table>
//             </div>
//           </div>
//         )}

//         {/* Cancellation reason */}
//         {grn.status === "Cancelled" && grn.cancellationReason && (
//           <div style={{ marginTop: 14, background: "#2D1515", border: "1px solid #7F1D1D", borderRadius: 8, padding: "12px 16px" }}>
//             <div style={{ fontSize: 10, fontWeight: 700, color: "#F87171", textTransform: "uppercase", letterSpacing: ".6px" }}>Cancellation Reason</div>
//             <div style={{ fontSize: 13, color: "#FCA5A5", marginTop: 4 }}>{grn.cancellationReason}</div>
//           </div>
//         )}

//         {grn.remarks && (
//           <div style={{ marginTop: 14, background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, padding: "12px 16px" }}>
//             <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: ".6px" }}>Remarks</div>
//             <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>{grn.remarks}</div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }


// /* ═══════════════════════════════════════════════════════════════════
//    Shared primitives
// ═══════════════════════════════════════════════════════════════════ */
// function Overlay({ onClose, children }) {
//   return (
//     <div onClick={(e) => e.target === e.currentTarget && onClose()}
//       style={{
//         position: "fixed", inset: 0, zIndex: 1000,
//         background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center",
//       }}>
//       <div style={{ width: "min(1140px,96vw)", maxHeight: "93vh", borderRadius: 14, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,.5)", display: "flex", flexDirection: "column", border: "1px solid #1E293B" }}>
//         {children}
//       </div>
//     </div>
//   );
// }

// function MiniModal({ title, onClose, children }) {
//   return (
//     <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
//       <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12, padding: 24, width: "min(420px,92vw)", boxShadow: "0 24px 60px rgba(0,0,0,.5)" }}>
//         <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: "#F1F5F9" }}>{title}</h3>
//         {children}
//       </div>
//     </div>
//   );
// }

// function Card({ title, sub, right, children }) {
//   return (
//     <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
//       <div style={{ padding: "11px 16px", borderBottom: "1px solid #1E293B", background: "#070C14", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//         <div>
//           <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", letterSpacing: ".3px" }}>{title}</div>
//           {sub && <div style={{ fontSize: 11, color: "#334155", marginTop: 2 }}>{sub}</div>}
//         </div>
//         {right}
//       </div>
//       <div style={{ padding: 16 }}>{children}</div>
//     </div>
//   );
// }

// function Field({ label, req, children }) {
//   return (
//     <div>
//       <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 5, letterSpacing: ".2px" }}>
//         {label}{req && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
//       </div>
//       {children}
//     </div>
//   );
// }

// function TblBtn({ children, onClick, color }) {
//   return (
//     <button className="btn" onClick={onClick}
//       style={{ padding: "5px 10px", fontSize: 11, background: `${color}15`, color, border: `1px solid ${color}30` }}>
//       {children}
//     </button>
//   );
// }

// function GhostBtn({ children, onClick }) {
//   return (
//     <button className="btn" onClick={onClick}
//       style={{ padding: "9px 18px", background: "#0F172A", color: "#475569", border: "1px solid #1E293B", fontSize: 13 }}>
//       {children}
//     </button>
//   );
// }



import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";

/* ─── API ──────────────────────────────────────────────────────── */
const GRN_API = `${APP_API_URL}/grn`;
const GRC_API = `${APP_API_URL}/grc`;

/* ─── Shared auth helper ──────────────────────────────────────────
   Every route in grn_routes.py (and grc_routes.py, used here for the
   GRC dropdown) requires an HQ admin's Bearer token (Depends(get_hq_
   tenant), added during the tenant-isolation pass). This file's
   trailing slashes were already fixed in a prior pass, but none of
   the six fetch() calls ever attached a token — same bug already
   fixed in GRCManager.jsx, PurchaseOrderManager.jsx, and others.
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
const n0     = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const clamp0 = (v) => Math.max(0, n0(v));
const money  = (v) => clamp0(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today  = () => new Date().toISOString().slice(0, 10);

/* ─── Empty item scaffold ─────────────────────────────────────── */
const EMPTY_ITEM = (grcItem = {}) => ({
  barcode:     grcItem.barcode      || "",
  vendorBarcode: grcItem.vendorBarcode || "",
  description: grcItem.description  || "",
  acceptedQty: grcItem.acceptedQty  || 0,   // read-only — sourced from GRC
  inwardQty:   grcItem.acceptedQty  || "",   // user edits this
  rate:        grcItem.vendorRate   || grcItem.rate || 0,
  amount:      0,
  binLocation: "",
  batchNo:     "",
  expiryDate:  null,
  remarks:     "",
});

/* ─── Status display config — light theme ────────────────────────── */
const S = {
  Draft:     { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0", dot: "#94A3B8" },
  Posted:    { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0", dot: "#10B981" },
  Cancelled: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA", dot: "#EF4444" },
};

function StatusPill({ s }) {
  const m = S[s] || S.Draft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      letterSpacing: ".4px", background: m.bg, color: m.text, border: `1px solid ${m.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.dot }} />
      {s || "—"}
    </span>
  );
}

/* ─── GRC Type badge — light theme ────────────────────────────── */
function GRCTypeBadge({ poNo }) {
  const isLinked = !!(poNo && poNo.trim());
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: isLinked ? "#EEF2FF" : "#ECFEFF",
      color: isLinked ? "#4F46E5" : "#0E7490",
      border: `1px solid ${isLinked ? "#C7D2FE" : "#A5F3FC"}`,
    }}>
      {isLinked ? "🔗 PO-Linked" : "📦 Direct"}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════════════════════ */
export default function GRNManager() {
  const [grns,         setGrns]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [toast,        setToast]        = useState(null);
  const [modal,        setModal]        = useState(null);
  const [active,       setActive]       = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchGRNs = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await authFetch(`${GRN_API}/`);
      if (!res.ok) throw new Error("Failed to load GRNs");
      const data = await res.json();
      setGrns(Array.isArray(data) ? data : []);
    } catch (e) { showToast(e.message, "err"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGRNs(); }, [fetchGRNs]);

  /* ── Save (create / update) ───────────────────────────────────── */
  const handleSave = async (payload) => {
    const isEdit = !!payload.id;
    try {
      const url = isEdit ? `${GRN_API}/${payload.id}` : `${GRN_API}/`;
      const res  = await authFetch(url, {
        method:  isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      showToast(isEdit ? "GRN updated" : "GRN created");
      setModal(null);
      setActive(null);
      await fetchGRNs();
    } catch (e) { showToast(e.message, "err"); }
  };

  /* ── Post ─────────────────────────────────────────────────────── */
  const handlePost = async (grn) => {
    try {
      setLoading(true);
      const res  = await authFetch(`${GRN_API}/${grn.id}/post`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Post failed");
      showToast(data.message || "GRN posted — stock updated");
      await fetchGRNs();
    } catch (e) {
      showToast(e.message, "err");
      setLoading(false); // only reset here on error; fetchGRNs handles it on success
    }
  };

  /* ── Cancel ───────────────────────────────────────────────────── */
  const handleCancel = async () => {
    if (!cancelReason.trim()) return showToast("Enter a cancellation reason", "err");
    try {
      const res  = await authFetch(`${GRN_API}/${active.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Cancel failed");
      showToast(data.message || "GRN cancelled");
      setModal(null);
      setActive(null);
      setCancelReason("");
      await fetchGRNs();
    } catch (e) { showToast(e.message, "err"); }
  };

  /* ── Delete ───────────────────────────────────────────────────── */
  const handleDelete = async () => {
    try {
      const res  = await authFetch(`${GRN_API}/${active.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Delete failed");
      showToast("GRN deleted");
      setModal(null);
      setActive(null);
      await fetchGRNs();
    } catch (e) { showToast(e.message, "err"); }
  };

  /* Filtered rows */
  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return grns.filter((g) => {
      const ms = filterStatus === "All" || g.status === filterStatus;
      const mq = !q || [g.grnNo, g.grcNo, g.poNo, g.vendorName, g.inductedBy]
        .some((f) => (f || "").toLowerCase().includes(q));
      return ms && mq;
    });
  }, [grns, search, filterStatus]);

  /* Summary KPIs */
  const kpis = useMemo(() => ({
    total:     grns.length,
    posted:    grns.filter((g) => g.status === "Posted").length,
    draft:     grns.filter((g) => g.status === "Draft").length,
    cancelled: grns.filter((g) => g.status === "Cancelled").length,
    totalQty:  grns.filter((g) => g.status === "Posted").reduce((s, g) => s + n0(g.totalInwardQty), 0),
    totalVal:  grns.filter((g) => g.status === "Posted").reduce((s, g) => s + n0(g.totalAmount), 0),
  }), [grns]);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", color: "#0F172A", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <style>{`
        * { box-sizing: border-box; }
        @keyframes slideDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:none; } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes modalPop {
          from { opacity:0; transform: scale(.94) translateY(8px); }
          to   { opacity:1; transform: none; }
        }
        .rh:hover { background: #F8FAFC !important; }
        .btn { cursor:pointer; border:none; font-family:'DM Sans',sans-serif; font-weight:700; border-radius:8px; transition:all .15s; letter-spacing:.2px; }
        .btn:active { transform:scale(.96); }
        input,select,textarea { font-family:'DM Sans',sans-serif; }
        input:focus,select:focus,textarea:focus { outline:none !important; border-color:#3B82F6 !important; box-shadow:0 0 0 3px rgba(59,130,246,.12) !important; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#CBD5E1; border-radius:10px; }
        .inp { background:#fff; border:1px solid #E2E8F0; color:#0F172A; border-radius:8px; padding:9px 12px; font-size:13px; width:100%; }
        .inp::placeholder { color:#94A3B8; }
        .inp-ro { background:#F8FAFC; border:1px solid #E2E8F0; color:#64748B; cursor:default; }
        .cell { background:#fff; border:1px solid #E2E8F0; color:#0F172A; border-radius:6px; padding:0 8px; font-size:12px; height:32px; width:100%; }
        .cell-num { font-family:'DM Mono',monospace; text-align:right; }
        .cell-accent { border-color:#C7D2FE; background:#EFF6FF; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          padding: "12px 20px", borderRadius: 10, fontWeight: 700, fontSize: 13,
          background: toast.type === "err" ? "#FEF2F2" : "#ECFDF5",
          color: toast.type === "err" ? "#991B1B" : "#065F46",
          border: `1px solid ${toast.type === "err" ? "#FECACA" : "#A7F3D0"}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          animation: "slideDown .2s ease", letterSpacing: ".2px",
        }}>
          {toast.type === "err" ? "✗ " : "✓ "}{toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "28px 24px" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#EFF6FF", border: "1px solid #DBEAFE", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.5px", color: "#0F172A" }}>Goods Receipt Note</h1>
              <p style={{ margin: 0, fontSize: 12, color: "#94A3B8", marginTop: 2, letterSpacing: ".2px" }}>Stock induction from approved GRCs (PO-linked &amp; direct) into warehouse inventory</p>
            </div>
          </div>
          <button className="btn" onClick={() => { setActive(null); setModal("form"); }}
            style={{ padding: "11px 20px", background: "#3B82F6", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 400 }}>+</span> Create GRN
          </button>
        </div>

        {/* ── KPI Strip ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total GRNs",   val: kpis.total,                 accent: "#64748B" },
            { label: "Posted",       val: kpis.posted,                accent: "#059669" },
            { label: "Draft",        val: kpis.draft,                 accent: "#3B82F6" },
            { label: "Cancelled",    val: kpis.cancelled,             accent: "#DC2626" },
            { label: "Posted Qty",   val: kpis.totalQty.toFixed(2),   accent: "#D97706" },
            { label: "Posted Value", val: `₹${money(kpis.totalVal)}`, accent: "#7C3AED" },
          ].map(({ label, val, accent }) => (
            <div key={label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 14px 12px" }}>
              <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: accent, fontFamily: "'DM Mono',monospace", letterSpacing: "-.5px" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="inp" placeholder="Search GRN No, GRC No, PO, vendor…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }} />
          </div>
          {["All", "Draft", "Posted", "Cancelled"].map((s) => (
            <button key={s} className="btn"
              onClick={() => setFilterStatus(s)}
              style={{
                padding: "8px 14px", fontSize: 12,
                background: filterStatus === s ? "#3B82F6" : "#fff",
                color: filterStatus === s ? "#fff" : "#64748B",
                border: `1px solid ${filterStatus === s ? "#3B82F6" : "#E2E8F0"}`,
              }}>
              {s}
            </button>
          ))}
        </div>

        {/* ── Table ── */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                  {["GRN No","Date","GRC No","Type","PO No","Vendor","Inducted By","Status","Inward Qty","Value (₹)","Actions"].map((h) => (
                    <th key={h} style={{
                      padding: "10px 14px", fontSize: 10, fontWeight: 700,
                      color: "#64748B", textTransform: "uppercase", letterSpacing: ".8px",
                      textAlign: ["Inward Qty","Value (₹)","Actions"].includes(h) ? "right" : "left",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} style={{ padding: 48, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 14, height: 14, border: "2px solid #E2E8F0", borderTopColor: "#3B82F6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                      Loading GRNs…
                    </div>
                  </td></tr>
                ) : visible.length === 0 ? (
                  <tr><td colSpan={11} style={{ padding: 48, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                    {search || filterStatus !== "All" ? "No GRNs match your filters." : "No GRNs yet. Click Create GRN to start."}
                  </td></tr>
                ) : visible.map((g, i) => (
                  <tr key={g.id} className="rh" style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFBFF" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: "#3B82F6" }}>{g.grnNo || "—"}</span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "#64748B" }}>{g.grnDate || "—"}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#0891B2" }}>{g.grcNo || "—"}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <GRCTypeBadge poNo={g.poNo} />
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {g.poNo
                        ? <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#64748B" }}>{g.poNo}</span>
                        : <span style={{ fontSize: 11, color: "#94A3B8", fontStyle: "italic" }}>Walk-in</span>
                      }
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "#334155" }}>{g.vendorName || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "#64748B" }}>{g.inductedBy || "—"}</td>
                    <td style={{ padding: "12px 14px" }}><StatusPill s={g.status} /></td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#D97706", fontWeight: 600 }}>
                      {n0(g.totalInwardQty).toFixed(3)}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#7C3AED", fontWeight: 600 }}>
                      ₹{money(g.totalAmount)}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                        <TblBtn color="#0891B2" onClick={() => { setActive(g); setModal("view"); }}>View</TblBtn>
                        {g.status === "Draft" && <>
                          <TblBtn color="#3B82F6" onClick={() => { setActive(g); setModal("form"); }}>Edit</TblBtn>
                          <TblBtn color="#059669" onClick={() => handlePost(g)}>Post</TblBtn>
                          <TblBtn color="#DC2626" onClick={() => { setActive(g); setModal("delete"); }}>Del</TblBtn>
                        </>}
                        {g.status === "Posted" && (
                          <TblBtn color="#DC2626" onClick={() => { setActive(g); setCancelReason(""); setModal("cancel"); }}>Cancel</TblBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length > 0 && (
            <div style={{ padding: "9px 16px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Showing {visible.length} of {grns.length}</span>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>
                Filtered posted qty: <b style={{ color: "#D97706", fontFamily: "'DM Mono',monospace" }}>
                  {visible.reduce((s, g) => s + (g.status === "Posted" ? n0(g.totalInwardQty) : 0), 0).toFixed(3)}
                </b>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {modal === "form" && (
        <Overlay onClose={() => { setModal(null); setActive(null); }}>
          <GRNForm initialGRN={active} onClose={() => { setModal(null); setActive(null); }} onSave={handleSave} />
        </Overlay>
      )}
      {modal === "view" && active && (
        <Overlay onClose={() => setModal(null)}>
          <GRNViewModal grn={active} onClose={() => setModal(null)} />
        </Overlay>
      )}
      {modal === "cancel" && active && (
        <MiniModal title={`Cancel ${active.grnNo}?`} onClose={() => { setModal(null); setActive(null); setCancelReason(""); }}>
          <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 12px", lineHeight: 1.5 }}>
            This will reverse stock in inventory. Enter a reason.
          </p>
          <textarea className="inp" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Wrong items, duplicate entry…" style={{ resize: "vertical" }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <GhostBtn onClick={() => { setModal(null); setActive(null); setCancelReason(""); }}>Back</GhostBtn>
            <button className="btn" onClick={handleCancel} style={{ padding: "9px 18px", background: "#DC2626", color: "#fff", fontSize: 13 }}>
              Confirm Cancel
            </button>
          </div>
        </MiniModal>
      )}
      {modal === "delete" && active && (
        <MiniModal title="Delete Draft GRN?" onClose={() => { setModal(null); setActive(null); }}>
          <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px" }}>
            Delete <b style={{ color: "#0F172A" }}>{active.grnNo}</b>? This cannot be undone.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <GhostBtn onClick={() => { setModal(null); setActive(null); }}>Back</GhostBtn>
            <button className="btn" onClick={handleDelete} style={{ padding: "9px 18px", background: "#DC2626", color: "#fff", fontSize: 13 }}>
              Delete
            </button>
          </div>
        </MiniModal>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   GRN FORM
═══════════════════════════════════════════════════════════════════ */
function GRNForm({ initialGRN, onClose, onSave }) {
  const [grcs,       setGrcs]       = useState([]);
  const [grcLoading, setGrcLoading] = useState(false);
  const [saving,     setSaving]     = useState(false);

  const [header, setHeader] = useState({
    grnDate:       initialGRN?.grnDate       || today(),
    grcNo:         initialGRN?.grcNo         || "",
    poNo:          initialGRN?.poNo          || "",
    vendorName:    initialGRN?.vendorName    || "",
    warehouseCode: initialGRN?.warehouseCode || "",
    inductedBy:    initialGRN?.inductedBy    || "",
    approvedBy:    initialGRN?.approvedBy    || "",
    remarks:       initialGRN?.remarks       || "",
    // Status is NOT editable — display-only, managed by Post/Cancel actions.
    status:        initialGRN?.status        || "Draft",
  });

  // Track whether the selected GRC is direct or PO-linked
  const [selectedGRC, setSelectedGRC] = useState(null);

  const [items, setItems] = useState(
    Array.isArray(initialGRN?.items) && initialGRN.items.length
      ? initialGRN.items.map((it) => ({ ...EMPTY_ITEM(), ...it }))
      : [EMPTY_ITEM()]
  );

  const setH = (k, v) => setHeader((p) => ({ ...p, [k]: v }));

  /* Load ALL Approved GRCs (both PO-linked and direct) */
  useEffect(() => {
    (async () => {
      try {
        setGrcLoading(true);
        const res  = await authFetch(`${GRC_API}/`);
        const data = await res.json();
        setGrcs(Array.isArray(data) ? data.filter((g) => g.status === "Approved") : []);
      } catch (e) { console.error(e); }
      finally { setGrcLoading(false); }
    })();
  }, []);

  /* When GRC selected → prefill header + items from GRC
   *
   * Direct GRCs may have items where acceptedQty === 0 (the backend sets
   * acceptedQty = inwardQty at save time, not at GRC creation time), so:
   *  - PO-linked GRC → keep only items with acceptedQty > 0 (normal receiving)
   *  - Direct GRC    → keep ALL items regardless of acceptedQty (user fills inwardQty)
   */
  const handleGRCSelect = (grcNo) => {
    setH("grcNo", grcNo);
    const grc = grcs.find((g) => g.grcNo === grcNo);
    if (!grc) { setSelectedGRC(null); return; }
    setSelectedGRC(grc);
    setH("poNo", grc.poNo || "");
    setH("vendorName", grc.vendorName || "");
    if (Array.isArray(grc.items) && grc.items.length) {
      const isDirect = !(grc.poNo && grc.poNo.trim());
      const grcItems = isDirect
        ? grc.items
        : grc.items.filter((it) => clamp0(it.acceptedQty) > 0);
      setItems(grcItems.length ? grcItems.map(EMPTY_ITEM) : [EMPTY_ITEM()]);
    }
  };

  const updateItem = (idx, k, v) => {
    setItems((prev) => {
      const next = [...prev];
      const row  = { ...next[idx], [k]: v };
      if (k === "inwardQty") {
        const max = clamp0(row.acceptedQty);
        row.inwardQty = max > 0 ? Math.min(clamp0(v), max) : clamp0(v);
      }
      row.amount = clamp0(row.inwardQty) * clamp0(row.rate);
      next[idx] = row;
      return next;
    });
  };

  /* Live totals */
  const totals = useMemo(() => {
    let qty = 0, amt = 0;
    for (const it of items) {
      const max    = clamp0(it.acceptedQty);
      const inward = max > 0 ? Math.min(clamp0(it.inwardQty), max) : clamp0(it.inwardQty);
      qty += inward;
      amt += inward * clamp0(it.rate);
    }
    return { totalInwardQty: qty, totalAmount: amt };
  }, [items]);

  const handleSubmit = async () => {
    if (!header.grcNo)      return alert("Please select an Approved GRC.");
    if (!header.inductedBy) return alert("Please enter Inducted By.");
    const hasQty = items.some((i) => clamp0(i.inwardQty) > 0);
    if (!hasQty) return alert("Enter inward quantity for at least one item.");

    // New GRNs are always "Draft"; existing GRNs preserve their current
    // status — only Post/Cancel actions change it, never a manual edit.
    const safeStatus = initialGRN?.id ? initialGRN.status : "Draft";

    const payload = {
      ...(initialGRN?.id ? { id: initialGRN.id } : {}),
      ...header,
      status: safeStatus,
      ...totals,
      items: items.map((it) => {
        const max    = clamp0(it.acceptedQty);
        const inward = max > 0 ? Math.min(clamp0(it.inwardQty), max) : clamp0(it.inwardQty);
        return {
          ...it,
          inwardQty:   inward,
          acceptedQty: max > 0 ? max : inward,
          amount:      inward * clamp0(it.rate),
        };
      }),
    };
    setSaving(true);
    await onSave(payload);
    setSaving(false);
  };

  const isDirectGRC = selectedGRC
    ? !(selectedGRC.poNo && selectedGRC.poNo.trim())
    : !(initialGRN?.poNo && initialGRN?.poNo?.trim());

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "90vh", background: "#F8FAFC", color: "#0F172A" }}>

      {/* Header */}
      <div style={{ padding: "16px 24px", background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0F172A", letterSpacing: "-.3px" }}>
            {initialGRN?.id ? "Edit GRN" : "Create GRN"}
            {header.grcNo && (
              <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 10 }}>
                <GRCTypeBadge poNo={isDirectGRC ? "" : "linked"} />
              </span>
            )}
          </h2>
          <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
            Inducts stock from an approved GRC — works for both PO-linked and direct walk-in GRCs
          </p>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 20, lineHeight: 1 }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

        {/* ─ Header fields ─ */}
        <Card title="GRN Header" sub="Basic induction details">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

            {/* Left */}
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <Field label="GRN No">
                <input className="inp inp-ro" readOnly value={initialGRN?.grnNo || "(auto-generated)"} />
              </Field>
              <Field label="GRN Date" req>
                <input className="inp" type="date" value={header.grnDate} onChange={(e) => setH("grnDate", e.target.value)} />
              </Field>
              <Field label="Approved GRC No" req>
                <input
                  className="inp"
                  value={header.grcNo}
                  onChange={(e) => handleGRCSelect(e.target.value)}
                  list="grc-list-grn"
                  disabled={grcLoading}
                  placeholder={grcLoading ? "Loading GRCs…" : "Select approved GRC (PO-linked or direct)…"}
                />
                <datalist id="grc-list-grn">
                  {grcs.map((g) => (
                    <option key={g.id} value={g.grcNo}>
                      {g.grcNo} — {g.vendorName} {g.poNo ? `(PO: ${g.poNo})` : "(Direct)"}
                    </option>
                  ))}
                </datalist>
                {header.grcNo && !grcs.find((g) => g.grcNo === header.grcNo) && !grcLoading && (
                  <p style={{ fontSize: 11, color: "#D97706", margin: "4px 0 0" }}>
                    ⚠ GRC not found in Approved list
                  </p>
                )}
              </Field>
              <Field label="PO No">
                <input
                  className="inp inp-ro"
                  readOnly
                  value={header.poNo || ""}
                  placeholder={isDirectGRC ? "N/A — Direct/Walk-in GRC" : "Auto-filled from GRC"}
                />
              </Field>
              <Field label="Vendor">
                <input className="inp inp-ro" readOnly value={header.vendorName} placeholder="Auto-filled from GRC" />
              </Field>
            </div>

            {/* Right */}
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <Field label="Inducted By" req>
                <input className="inp" value={header.inductedBy} onChange={(e) => setH("inductedBy", e.target.value)} placeholder="Warehouse officer" />
              </Field>
              <Field label="Approved By">
                <input className="inp" value={header.approvedBy} onChange={(e) => setH("approvedBy", e.target.value)} placeholder="Manager / supervisor" />
              </Field>
              <Field label="Warehouse Code">
                <input className="inp" value={header.warehouseCode} onChange={(e) => setH("warehouseCode", e.target.value)} placeholder="e.g. WH-01, RACK-B3" />
              </Field>

              {/* Status is read-only — controlled by backend workflow actions only. */}
              <Field label="Status">
                <div style={{
                  background: "#F8FAFC", border: "1px solid #E2E8F0",
                  borderRadius: 8, padding: "7px 12px",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <StatusPill s={header.status} />
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>
                    {header.status === "Draft"
                      ? "Use Post action to update stock"
                      : "Use Cancel action to reverse stock"}
                  </span>
                </div>
              </Field>

              <Field label="Remarks">
                <textarea className="inp" rows={2} value={header.remarks} onChange={(e) => setH("remarks", e.target.value)} placeholder="Any notes…" style={{ resize: "vertical" }} />
              </Field>
            </div>
          </div>
        </Card>

        {/* ─ Direct GRC info banner ─ */}
        {isDirectGRC && header.grcNo && (
          <div style={{ background: "#ECFEFF", border: "1px solid #A5F3FC", borderRadius: 10, padding: "11px 14px", marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 18 }}>📦</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0E7490" }}>Direct / Walk-in GRC</div>
              <div style={{ fontSize: 11, color: "#0891B2", marginTop: 2 }}>
                This GRN is against a direct GRC (no PO). Items pre-filled from GRC — enter the inward quantity for each.
              </div>
            </div>
          </div>
        )}

        {/* ─ KPI strip ─ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "14px 0" }}>
          {[
            { label: "Total Inward Qty", val: totals.totalInwardQty.toFixed(3), color: "#D97706" },
            { label: "Total Amount (₹)", val: `₹${money(totals.totalAmount)}`,  color: "#7C3AED" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "13px 16px" }}>
              <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'DM Mono',monospace", letterSpacing: "-.5px" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* ─ Items table ─ */}
        <Card
          title="Item-wise Induction"
          sub={isDirectGRC
            ? "Direct GRC — enter inward qty for each item (no acceptedQty cap)"
            : "Inward qty cannot exceed GRC accepted qty"}
          right={
            <button className="btn" onClick={() => setItems((p) => [...p, EMPTY_ITEM()])}
              style={{ padding: "6px 12px", background: "#EFF6FF", color: "#3B82F6", border: "1px solid #DBEAFE", fontSize: 11 }}>
              + Add Row
            </button>
          }
        >
          <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #E2E8F0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1140 }}>
              <thead style={{ background: "#F8FAFC" }}>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {["#","Barcode","Description","Accepted Qty","Inward Qty ✎","Bin Location","Batch No","Expiry","Rate","Amount","Remarks",""].map((h) => (
                    <th key={h} style={{
                      padding: "9px 10px", fontSize: 10, fontWeight: 700, color: "#64748B",
                      textTransform: "uppercase", letterSpacing: ".6px", textAlign: "left", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const maxQty = clamp0(it.acceptedQty);
                  const inward = maxQty > 0 ? Math.min(clamp0(it.inwardQty), maxQty) : clamp0(it.inwardQty);
                  const over   = maxQty > 0 && clamp0(it.inwardQty) > maxQty;
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9", background: idx % 2 === 0 ? "#fff" : "#FAFBFF" }}>
                      <td style={{ padding: "5px 10px", fontSize: 11, color: "#94A3B8", fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ padding: "4px 5px" }}><input className="cell" value={it.barcode}     onChange={(e) => updateItem(idx, "barcode", e.target.value)} style={{ width: 110 }} /></td>
                      <td style={{ padding: "4px 5px" }}><input className="cell" value={it.description} onChange={(e) => updateItem(idx, "description", e.target.value)} style={{ width: 150 }} /></td>
                      <td style={{ padding: "5px 10px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#0891B2" }}>
                        {maxQty > 0 ? n0(it.acceptedQty).toFixed(3) : <span style={{ color: "#94A3B8", fontStyle: "italic" }}>—</span>}
                      </td>
                      <td style={{ padding: "4px 5px" }}>
                        <input
                          className={`cell cell-num ${over ? "" : "cell-accent"}`}
                          type="number" min="0"
                          max={maxQty > 0 ? maxQty : undefined}
                          value={it.inwardQty}
                          onChange={(e) => updateItem(idx, "inwardQty", e.target.value)}
                          style={{ width: 90, borderColor: over ? "#FECACA" : undefined, background: over ? "#FEF2F2" : undefined }}
                        />
                        {over && <div style={{ fontSize: 10, color: "#DC2626", marginTop: 2 }}>Exceeds accepted</div>}
                      </td>
                      <td style={{ padding: "4px 5px" }}><input className="cell" value={it.binLocation} onChange={(e) => updateItem(idx, "binLocation", e.target.value)} placeholder="WH-A1-R2" style={{ width: 100 }} /></td>
                      <td style={{ padding: "4px 5px" }}><input className="cell" value={it.batchNo}     onChange={(e) => updateItem(idx, "batchNo", e.target.value)} placeholder="BAT-001" style={{ width: 90 }} /></td>
                      <td style={{ padding: "4px 5px" }}><input className="cell" type="date" value={it.expiryDate || ""} onChange={(e) => updateItem(idx, "expiryDate", e.target.value)} style={{ width: 120 }} /></td>
                      <td style={{ padding: "4px 5px" }}><input className="cell cell-num" type="number" min="0" value={it.rate} onChange={(e) => updateItem(idx, "rate", e.target.value)} style={{ width: 80 }} /></td>
                      <td style={{ padding: "5px 10px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#7C3AED", fontWeight: 600, whiteSpace: "nowrap" }}>
                        ₹{money(inward * clamp0(it.rate))}
                      </td>
                      <td style={{ padding: "4px 5px" }}><input className="cell" value={it.remarks} onChange={(e) => updateItem(idx, "remarks", e.target.value)} placeholder="Notes" style={{ width: 100 }} /></td>
                      <td style={{ padding: "4px 8px" }}>
                        <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                          disabled={items.length === 1}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", fontSize: 15, opacity: items.length === 1 ? 0.25 : 1 }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Footer */}
      <div style={{ padding: "14px 24px", background: "#fff", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <button className="btn" onClick={handleSubmit} disabled={saving}
          style={{ padding: "10px 22px", background: saving ? "#93C5FD" : "#3B82F6", color: "#fff", fontSize: 13 }}>
          {saving ? "Saving…" : initialGRN?.id ? "Update GRN" : "Save GRN"}
        </button>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   GRN VIEW MODAL
═══════════════════════════════════════════════════════════════════ */
function GRNViewModal({ grn, onClose }) {
  const isDirectGRC = !(grn.poNo && grn.poNo.trim());

  const meta = [
    ["GRN No",       grn.grnNo],
    ["GRN Date",     grn.grnDate],
    ["GRC No",       grn.grcNo],
    ["Type",         "GRC_TYPE"],
    ["PO No",        isDirectGRC ? "N/A — Direct Walk-in" : (grn.poNo || "—")],
    ["Vendor",       grn.vendorName],
    ["Inducted By",  grn.inductedBy],
    ["Approved By",  grn.approvedBy],
    ["Warehouse",    grn.warehouseCode],
    ["Status",       "STATUS"],
    ["Total Inward", n0(grn.totalInwardQty).toFixed(3)],
    ["Total Amount", `₹${money(grn.totalAmount)}`],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "90vh", background: "#fff", color: "#0F172A" }}>

      {/* Header */}
      <div style={{ padding: "16px 24px", background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#3B82F6", letterSpacing: "-.3px" }}>Goods Receipt Note</h2>
            <GRCTypeBadge poNo={grn.poNo} />
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
            GRN No: <span style={{ fontFamily: "'DM Mono',monospace", color: "#334155" }}>{grn.grnNo}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => window.print()}
            style={{ padding: "8px 14px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", fontSize: 12 }}>Print</button>
          <button className="btn" onClick={onClose}
            style={{ padding: "8px 14px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", fontSize: 12 }}>Close</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

        {/* Info grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 20 }}>
          {meta.map(([k, v]) => (
            <div key={k} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>{k}</div>
              {v === "STATUS"
                ? <StatusPill s={grn.status} />
                : v === "GRC_TYPE"
                ? <GRCTypeBadge poNo={grn.poNo} />
                : <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", fontFamily: ["GRN No","GRC No","PO No"].includes(k) ? "'DM Mono',monospace" : "inherit" }}>{v || "—"}</div>
              }
            </div>
          ))}
        </div>

        {/* Items table */}
        {Array.isArray(grn.items) && grn.items.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "11px 16px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", letterSpacing: ".3px" }}>ITEM-WISE INDUCTION</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                <thead style={{ background: "#F8FAFC" }}>
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    {["#","Barcode","Description","Accepted","Inducted","Bin","Batch","Expiry","Rate","Amount"].map((h) => (
                      <th key={h} style={{
                        padding: "9px 12px", fontSize: 10, fontWeight: 700, color: "#64748B",
                        textTransform: "uppercase", letterSpacing: ".6px",
                        textAlign: ["Accepted","Inducted","Rate","Amount"].includes(h) ? "right" : "left",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grn.items.map((it, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFBFF" }}>
                      <td style={{ padding: "10px 12px", fontSize: 11, color: "#94A3B8" }}>{i + 1}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#0891B2" }}>{it.barcode || "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#334155" }}>{it.description || "—"}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#0891B2" }}>{n0(it.acceptedQty).toFixed(3)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#D97706", fontWeight: 700 }}>{n0(it.inwardQty).toFixed(3)}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#64748B" }}>{it.binLocation || "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#64748B", fontFamily: "'DM Mono',monospace" }}>{it.batchNo || "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#64748B" }}>{it.expiryDate || "—"}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#64748B" }}>₹{money(it.rate)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#7C3AED", fontWeight: 700 }}>₹{money(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                  <tr>
                    <td colSpan={4} style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Totals</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: "#D97706" }}>{n0(grn.totalInwardQty).toFixed(3)}</td>
                    <td colSpan={4} />
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: "#7C3AED" }}>₹{money(grn.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Cancellation reason */}
        {grn.status === "Cancelled" && grn.cancellationReason && (
          <div style={{ marginTop: 14, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#991B1B", textTransform: "uppercase", letterSpacing: ".6px" }}>Cancellation Reason</div>
            <div style={{ fontSize: 13, color: "#7F1D1D", marginTop: 4 }}>{grn.cancellationReason}</div>
          </div>
        )}

        {grn.remarks && (
          <div style={{ marginTop: 14, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".6px" }}>Remarks</div>
            <div style={{ fontSize: 13, color: "#334155", marginTop: 4 }}>{grn.remarks}</div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   Shared primitives
═══════════════════════════════════════════════════════════════════ */
function Overlay({ onClose, children }) {
  return createPortal(
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn .15s ease",
      }}>
      {/* Modal pops in centered, scaling up from 94% with a slight upward
          settle — rather than just appearing instantly. */}
      <div style={{
        width: "min(1400px, calc(100vw - 32px))", height: "min(93vh, calc(100dvh - 32px))", maxHeight: "calc(100dvh - 32px)", borderRadius: 16, overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,.2)", display: "flex", flexDirection: "column",
        border: "1px solid #E2E8F0", background: "#fff",
        animation: "modalPop .18s cubic-bezier(.2,.9,.3,1.2)",
      }}>
        {children}
      </div>
    </div>,
    document.body
  );
}

function MiniModal({ title, onClose, children }) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .15s ease" }}>
      <div style={{
        background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 24,
        width: "min(420px,92vw)", boxShadow: "0 24px 80px rgba(0,0,0,.2)",
        animation: "modalPop .18s cubic-bezier(.2,.9,.3,1.2)",
      }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{title}</h3>
        {children}
      </div>
    </div>,
    document.body
  );
}

function Card({ title, sub, right, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
      <div style={{ padding: "11px 16px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", letterSpacing: ".3px" }}>{title}</div>
          {sub && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{sub}</div>}
        </div>
        {right}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function Field({ label, req, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 5, letterSpacing: ".2px" }}>
        {label}{req && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
      </div>
      {children}
    </div>
  );
}

function TblBtn({ children, onClick, color }) {
  return (
    <button className="btn" onClick={onClick}
      style={{ padding: "5px 10px", fontSize: 11, background: `${color}15`, color, border: `1px solid ${color}30` }}>
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }) {
  return (
    <button className="btn" onClick={onClick}
      style={{ padding: "9px 18px", background: "#F8FAFC", color: "#475569", border: "1px solid #E2E8F0", fontSize: 13 }}>
      {children}
    </button>
  );
}