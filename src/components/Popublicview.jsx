import { API_BASE_URL as APP_API_URL } from "../config/api.js";
// import React, { useEffect, useState } from "react";

// // ─────────────────────────────────────────────────────────────────────────────
// // POPublicView.jsx
// // Public page — no auth required. Vendor opens share link and sees PO.
// //
// // Add to your router (e.g. App.jsx or router.jsx):
// //   import POPublicView from "./POPublicView";
// //   <Route path="/po-view/:token" element={<POPublicView />} />
// // ─────────────────────────────────────────────────────────────────────────────

// const API_BASE = `${APP_API_URL}`;

// const money = (v, currency = "INR") =>
//   `${currency} ${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// function getTokenFromPath() {
//   // Works with both React Router and plain window.location
//   const parts = window.location.pathname.split("/");
//   return parts[parts.length - 1] || "";
// }

// /* ─── Status colour map ─── */
// const STATUS_STYLE = {
//   Pending:        { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
//   WalkinAccepted: { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
//   Approved:       { bg: "#EEF2FF", color: "#4F46E5", border: "#C7D2FE" },
//   Cancelled:      { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
//   Rejected:       { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
// };

// export default function POPublicView() {
//   const token = getTokenFromPath();

//   const [po,        setPo]        = useState(null);
//   const [loading,   setLoading]   = useState(true);
//   const [error,     setError]     = useState("");
//   const [view,      setView]      = useState("po");   // "po" | "accept" | "register"
//   const [submitting,setSubmitting]= useState(false);
//   const [done,      setDone]      = useState("");

//   // Accept form
//   const [acceptForm, setAcceptForm] = useState({
//     remarks: "", mobile: "", email: "", contact_person: "",
//   });

//   // Register form
//   const [regForm, setRegForm] = useState({
//     name: "", contact_person: "", mobile: "", email: "",
//     gstin: "", pan: "", address: "",
//   });

//   useEffect(() => {
//     if (!token) { setError("Invalid link."); setLoading(false); return; }
//     fetch(`${API_BASE}/purchaseorders/public/${token}`)
//       .then(r => r.json().then(j => ({ ok: r.ok, ...j })))
//       .then(j => {
//         if (!j.ok) { setError(j.detail || "This link is invalid or has expired."); }
//         else {
//           setPo(j.data);
//           // Pre-fill register form with walkin_vendor data
//           const wv = j.data.walkin_vendor || {};
//           setRegForm(f => ({
//             ...f,
//             name:           wv.name || j.data.vendorName || "",
//             contact_person: wv.contact_person || "",
//             mobile:         wv.mobile || "",
//             email:          wv.email  || "",
//             gstin:          wv.gstin  || "",
//             address:        wv.address|| "",
//           }));
//           setAcceptForm(f => ({
//             ...f,
//             mobile:         wv.mobile || "",
//             email:          wv.email  || "",
//             contact_person: wv.contact_person || "",
//           }));
//         }
//       })
//       .catch(() => setError("Network error. Please try again."))
//       .finally(() => setLoading(false));
//   }, [token]);

//   const handleAccept = async () => {
//     setSubmitting(true);
//     try {
//       const res  = await fetch(`${API_BASE}/purchaseorders/public/${token}/accept`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ remarks: acceptForm.remarks, contact: acceptForm }),
//       });
//       const json = await res.json();
//       if (!res.ok) throw new Error(json.detail || "Failed to accept.");
//       setDone("accepted");
//       setPo(p => ({ ...p, vendor_accepted_at: new Date().toISOString(), status: "WalkinAccepted" }));
//       setView("po");
//     } catch (e) { alert(e.message); }
//     finally { setSubmitting(false); }
//   };

//   const handleRegister = async () => {
//     if (!regForm.name || !regForm.mobile) { alert("Name and Mobile are required."); return; }
//     setSubmitting(true);
//     try {
//       const res  = await fetch(`${API_BASE}/purchaseorders/public/${token}/register`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(regForm),
//       });
//       const json = await res.json();
//       if (!res.ok) throw new Error(json.detail || "Registration failed.");
//       setDone("registered");
//       alert(
//         `Registration successful!\n\nYour temporary password: ${json.temp_password}\n\nPlease log in and change your password.`
//       );
//       setView("po");
//     } catch (e) { alert(e.message); }
//     finally { setSubmitting(false); }
//   };

//   // ── Loading ──────────────────────────────────────────────────────────────
//   if (loading) {
//     return (
//       <div style={styles.page}>
//         <div style={styles.center}>
//           <div style={styles.spinner} />
//           <p style={{ color: "#64748B", marginTop: 16 }}>Loading Purchase Order…</p>
//         </div>
//       </div>
//     );
//   }

//   // ── Error ────────────────────────────────────────────────────────────────
//   if (error) {
//     return (
//       <div style={styles.page}>
//         <div style={styles.card}>
//           <div style={{ textAlign: "center", padding: "40px 20px" }}>
//             <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
//             <h2 style={{ color: "#DC2626", fontWeight: 700, marginBottom: 8 }}>Link Invalid or Expired</h2>
//             <p style={{ color: "#64748B", fontSize: 14 }}>{error}</p>
//             <p style={{ color: "#94A3B8", fontSize: 12, marginTop: 12 }}>
//               Please contact the buyer to get a fresh link.
//             </p>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   const statusStyle = STATUS_STYLE[po.status] || { bg: "#F8FAFC", color: "#475569", border: "#E2E8F0" };
//   const isAccepted  = po.vendor_accepted_at || po.status === "WalkinAccepted";
//   const isRegistered = done === "registered";

//   return (
//     <div style={styles.page}>
//       <style>{`
//         * { box-sizing: border-box; }
//         body { margin: 0; background: #F1F5F9; font-family: system-ui, -apple-system, sans-serif; }
//         @keyframes spin { to { transform: rotate(360deg); } }
//         @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
//         .pub-btn { cursor: pointer; transition: opacity 0.15s, transform 0.15s; }
//         .pub-btn:hover { opacity: 0.9; transform: translateY(-1px); }
//         .pub-btn:active { transform: translateY(0); }
//         .pub-input { width: 100%; height: 42px; border-radius: 10px; border: 1px solid #E2E8F0; padding: 0 12px; font-size: 14px; outline: none; background: #fff; }
//         .pub-input:focus { border-color: #6366F1; box-shadow: 0 0 0 3px #6366F120; }
//       `}</style>

//       {/* ── Company header ── */}
//       <div style={styles.header}>
//         <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 16px" }}>
//           <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>CitiMart</h1>
//           <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
//             A Unit of Lourdes Textiles Private Limited · 19B J.L.Nehru Road, Kolkata 700087
//           </p>
//         </div>
//       </div>

//       <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 40px" }}>

//         {/* ── Accepted banner ── */}
//         {isAccepted && (
//           <div style={{ ...styles.banner, background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#065F46", marginBottom: 16, animation: "fadeIn .4s ease" }}>
//             ✅ You have accepted this Purchase Order. The buyer will be in touch.
//           </div>
//         )}
//         {isRegistered && (
//           <div style={{ ...styles.banner, background: "#EEF2FF", border: "1px solid #C7D2FE", color: "#3730A3", marginBottom: 16 }}>
//             🎉 You are now registered as a vendor! Check the alert for your temporary password.
//           </div>
//         )}

//         {/* ── PO header card ── */}
//         <div style={{ ...styles.card, marginBottom: 14, animation: "fadeIn .3s ease" }}>
//           <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
//             <div>
//               <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px" }}>
//                 Purchase Order
//               </div>
//               <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.5px", marginTop: 4 }}>
//                 {po.orderNo}
//               </div>
//               <div style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>
//                 Dated: <b>{po.orderDate}</b>
//                 {po.validTill && <span style={{ marginLeft: 12 }}>Valid till: <b>{po.validTill}</b></span>}
//               </div>
//               <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
//                 From: <b>{po.ownerSite || "RMS Retail"}</b>
//               </div>
//             </div>
//             <div style={{ textAlign: "right" }}>
//               <span style={{
//                 display: "inline-block", padding: "4px 12px", borderRadius: 20,
//                 fontSize: 12, fontWeight: 700,
//                 background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`,
//               }}>
//                 {po.status === "WalkinAccepted" ? "✓ Accepted" : po.status}
//               </span>
//               {po.po_viewed_at && (
//                 <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 6 }}>
//                   Viewed {new Date(po.po_viewed_at).toLocaleString("en-IN")}
//                 </div>
//               )}
//             </div>
//           </div>

//           {/* Vendor details */}
//           <div style={{ marginTop: 16, padding: "12px 16px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #F1F5F9" }}>
//             <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
//               Vendor Details
//             </div>
//             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontSize: 13 }}>
//               {[
//                 ["Name",    po.walkin_vendor?.name    || po.vendorName],
//                 ["Contact", po.walkin_vendor?.contact_person || "—"],
//                 ["Mobile",  po.walkin_vendor?.mobile  || "—"],
//                 ["GSTIN",   po.walkin_vendor?.gstin   || "—"],
//                 ["Address", po.walkin_vendor?.address || "—"],
//               ].map(([label, val]) => (
//                 <div key={label}>
//                   <span style={{ color: "#94A3B8", fontSize: 11 }}>{label}: </span>
//                   <span style={{ fontWeight: 600, color: "#0F172A" }}>{val}</span>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>

//         {/* ── Items table ── */}
//         <div style={{ ...styles.card, marginBottom: 14, animation: "fadeIn .4s ease" }}>
//           <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>
//             Order Items ({po.items?.length || 0})
//           </div>
//           <div style={{ overflowX: "auto" }}>
//             <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
//               <thead>
//                 <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
//                   {["#", "Item Description", "Barcode", "Qty", "Rate", "Tax", "Amount"].map((h, i) => (
//                     <th key={h} style={{
//                       padding: "10px 12px", textAlign: i >= 3 ? "right" : "left",
//                       fontSize: 10, fontWeight: 700, color: "#64748B",
//                       textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap",
//                     }}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {(po.items || []).map((item, i) => (
//                   <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
//                     <td style={{ padding: "10px 12px", color: "#94A3B8", fontSize: 12 }}>{i + 1}</td>
//                     <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0F172A" }}>
//                       {item.description}
//                       {item.remarks && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{item.remarks}</div>}
//                       {item.dueDate && <div style={{ fontSize: 10, color: "#6366F1", marginTop: 1 }}>Due: {item.dueDate}</div>}
//                     </td>
//                     <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#475569" }}>
//                       {item.barcode || "—"}
//                     </td>
//                     <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>{item.quantity}</td>
//                     <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace" }}>
//                       ₹{Number(item.rate).toFixed(2)}
//                     </td>
//                     <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, color: "#6366F1" }}>
//                       {item.taxPct}%
//                     </td>
//                     <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>
//                       ₹{Number(item.amount || (item.quantity * item.rate)).toFixed(2)}
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//               <tfoot>
//                 <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
//                   <td colSpan={4} />
//                   <td colSpan={2} style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#475569" }}>Net Payable</td>
//                   <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: "#0F172A" }}>
//                     {money(po.netAmount, po.currency || "₹")}
//                   </td>
//                 </tr>
//               </tfoot>
//             </table>
//           </div>

//           {/* Amount breakdown */}
//           <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
//             {[
//               ["Basic Value",  po.basicValue],
//               ["Tax Amount",   po.taxAmount],
//               ["Gross Amount", po.grossAmount],
//             ].map(([label, val]) => (
//               <div key={label} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 12px", fontSize: 12, textAlign: "right" }}>
//                 <div style={{ color: "#94A3B8", fontSize: 10 }}>{label}</div>
//                 <div style={{ fontWeight: 700, color: "#0F172A", fontFamily: "monospace" }}>₹{Number(val || 0).toFixed(2)}</div>
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* ── Terms & Notes ── */}
//         {(po.notes || po.otherTerms) && (
//           <div style={{ ...styles.card, marginBottom: 14, fontSize: 13 }}>
//             {po.notes && (
//               <div style={{ marginBottom: 8 }}>
//                 <div style={{ fontWeight: 700, color: "#475569", marginBottom: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Notes</div>
//                 <p style={{ margin: 0, color: "#64748B" }}>{po.notes}</p>
//               </div>
//             )}
//             {po.otherTerms && (
//               <div>
//                 <div style={{ fontWeight: 700, color: "#475569", marginBottom: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Terms & Conditions</div>
//                 <p style={{ margin: 0, color: "#64748B" }}>{po.otherTerms}</p>
//               </div>
//             )}
//           </div>
//         )}

//         {/* ── Action buttons ── */}
//         {!isAccepted && po.status !== "Cancelled" && po.status !== "Rejected" && view === "po" && (
//           <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
//             <button
//               className="pub-btn"
//               onClick={() => setView("accept")}
//               style={{ flex: 1, minWidth: 160, height: 48, borderRadius: 12, border: "none", background: "linear-gradient(135deg,#059669,#047857)", color: "#fff", fontWeight: 700, fontSize: 14 }}>
//               ✓ Accept this PO
//             </button>
//             {!isRegistered && (
//               <button
//                 className="pub-btn"
//                 onClick={() => setView("register")}
//                 style={{ flex: 1, minWidth: 160, height: 48, borderRadius: 12, border: "1px solid #6366F1", background: "#EEF2FF", color: "#4F46E5", fontWeight: 700, fontSize: 14 }}>
//                 Register as Vendor
//               </button>
//             )}
//           </div>
//         )}

//         {/* ── Accept form ── */}
//         {view === "accept" && (
//           <div style={{ ...styles.card, animation: "fadeIn .3s ease", marginBottom: 14 }}>
//             <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>Accept Purchase Order</div>

//             <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
//               <div>
//                 <label style={styles.label}>Your Mobile (confirm)</label>
//                 <input className="pub-input" value={acceptForm.mobile}
//                   onChange={e => setAcceptForm(f => ({ ...f, mobile: e.target.value }))}
//                   placeholder="Mobile number" />
//               </div>
//               <div>
//                 <label style={styles.label}>Email (optional)</label>
//                 <input className="pub-input" value={acceptForm.email}
//                   onChange={e => setAcceptForm(f => ({ ...f, email: e.target.value }))}
//                   placeholder="your@email.com" />
//               </div>
//               <div style={{ gridColumn: "1/-1" }}>
//                 <label style={styles.label}>Contact Person</label>
//                 <input className="pub-input" value={acceptForm.contact_person}
//                   onChange={e => setAcceptForm(f => ({ ...f, contact_person: e.target.value }))}
//                   placeholder="Your name" />
//               </div>
//               <div style={{ gridColumn: "1/-1" }}>
//                 <label style={styles.label}>Remarks (optional)</label>
//                 <textarea
//                   style={{ ...styles.textarea }}
//                   value={acceptForm.remarks}
//                   onChange={e => setAcceptForm(f => ({ ...f, remarks: e.target.value }))}
//                   placeholder="Any remarks about this PO…"
//                   rows={3}
//                 />
//               </div>
//             </div>

//             <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
//               <button className="pub-btn" onClick={() => setView("po")}
//                 style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff", color: "#475569", fontWeight: 600 }}>
//                 Cancel
//               </button>
//               <button className="pub-btn" onClick={handleAccept} disabled={submitting}
//                 style={{ flex: 2, height: 44, borderRadius: 10, border: "none", background: "#059669", color: "#fff", fontWeight: 700, opacity: submitting ? 0.6 : 1 }}>
//                 {submitting ? "Submitting…" : "✓ Confirm Acceptance"}
//               </button>
//             </div>
//           </div>
//         )}

//         {/* ── Register form ── */}
//         {view === "register" && (
//           <div style={{ ...styles.card, animation: "fadeIn .3s ease", marginBottom: 14 }}>
//             <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Register as a System Vendor</div>
//             <p style={{ fontSize: 12, color: "#64748B", marginTop: 0, marginBottom: 16 }}>
//               Once registered, you can log in to our vendor portal to manage future purchase orders.
//             </p>

//             <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
//               {[
//                 { label: "Business / Trade Name *", key: "name",           placeholder: "Your business name" },
//                 { label: "Contact Person *",         key: "contact_person", placeholder: "Your name" },
//                 { label: "Mobile *",                 key: "mobile",         placeholder: "+91 XXXXXXXXXX" },
//                 { label: "Email",                    key: "email",          placeholder: "email@domain.com" },
//                 { label: "GSTIN",                    key: "gstin",          placeholder: "15-digit GSTIN" },
//                 { label: "PAN",                      key: "pan",            placeholder: "ABCDE1234F" },
//               ].map(({ label, key, placeholder }) => (
//                 <div key={key}>
//                   <label style={styles.label}>{label}</label>
//                   <input className="pub-input" value={regForm[key]}
//                     onChange={e => setRegForm(f => ({ ...f, [key]: e.target.value }))}
//                     placeholder={placeholder} />
//                 </div>
//               ))}
//               <div style={{ gridColumn: "1/-1" }}>
//                 <label style={styles.label}>Address</label>
//                 <textarea style={styles.textarea} rows={2} value={regForm.address}
//                   onChange={e => setRegForm(f => ({ ...f, address: e.target.value }))}
//                   placeholder="Business address" />
//               </div>
//             </div>

//             <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400E", marginTop: 12 }}>
//               ⚠ A temporary password will be generated after registration. Please note it down — you will need it to log in.
//             </div>

//             <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
//               <button className="pub-btn" onClick={() => setView("po")}
//                 style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff", color: "#475569", fontWeight: 600 }}>
//                 Cancel
//               </button>
//               <button className="pub-btn" onClick={handleRegister} disabled={submitting}
//                 style={{ flex: 2, height: 44, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366F1,#4F46E5)", color: "#fff", fontWeight: 700, opacity: submitting ? 0.6 : 1 }}>
//                 {submitting ? "Registering…" : "Register & Get Password"}
//               </button>
//             </div>
//           </div>
//         )}

//         {/* ── Footer ── */}
//         <div style={{ textAlign: "center", fontSize: 11, color: "#94A3B8", marginTop: 20 }}>
//           This is an official Purchase Order from CitiMart (Lourdes Textiles Private Limited).
//           <br />For queries contact: 03322493502
//         </div>
//       </div>
//     </div>
//   );
// }

// const styles = {
//   page: {
//     minHeight: "100vh",
//     background: "#F1F5F9",
//     fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
//   },
//   header: {
//     background: "linear-gradient(135deg, #1E293B, #334155)",
//     boxShadow: "0 4px 20px rgba(15,23,42,0.2)",
//   },
//   card: {
//     background: "#fff",
//     borderRadius: 16,
//     border: "1px solid #F1F5F9",
//     boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
//     padding: 20,
//   },
//   banner: {
//     padding: "12px 16px",
//     borderRadius: 12,
//     fontSize: 13,
//     fontWeight: 600,
//   },
//   label: {
//     display: "block",
//     fontSize: 11,
//     fontWeight: 700,
//     color: "#64748B",
//     textTransform: "uppercase",
//     letterSpacing: "0.5px",
//     marginBottom: 5,
//   },
//   textarea: {
//     width: "100%",
//     borderRadius: 10,
//     border: "1px solid #E2E8F0",
//     padding: "10px 12px",
//     fontSize: 13,
//     outline: "none",
//     fontFamily: "inherit",
//     resize: "vertical",
//     background: "#fff",
//   },
//   center: {
//     display: "flex",
//     flexDirection: "column",
//     alignItems: "center",
//     justifyContent: "center",
//     minHeight: "100vh",
//   },
//   spinner: {
//     width: 36,
//     height: 36,
//     borderRadius: "50%",
//     border: "3px solid #E2E8F0",
//     borderTopColor: "#6366F1",
//     animation: "spin 0.8s linear infinite",
//   },
// };



import React, { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// POPublicView.jsx
// Public page — no auth required. Vendor opens share link and sees PO.
//
// Add to your router (e.g. App.jsx or router.jsx):
//   import POPublicView from "./POPublicView";
//   <Route path="/po-view/:token" element={<POPublicView />} />
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = `${APP_API_URL}`;

const money = (v, currency = "INR") =>
  `${currency} ${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getTokenFromPath() {
  const parts = window.location.pathname.split("/");
  return parts[parts.length - 1] || "";
}

const STATUS_STYLE = {
  Pending:        { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  WalkinAccepted: { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
  Approved:       { bg: "#EEF2FF", color: "#4F46E5", border: "#C7D2FE" },
  Cancelled:      { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  Rejected:       { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
};

export default function POPublicView() {
  const token = getTokenFromPath();

  const [po,         setPo]         = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [view,       setView]       = useState("po"); // "po" | "accept" | "register"
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState("");   // "" | "accepted" | "registered"

  const [acceptForm, setAcceptForm] = useState({
    remarks: "", mobile: "", email: "", contact_person: "",
  });

  const [regForm, setRegForm] = useState({
    name: "", contact_person: "", mobile: "", email: "",
    gstin: "", pan: "", address: "",
  });

  useEffect(() => {
    if (!token) { setError("Invalid link."); setLoading(false); return; }
    fetch(`${API_BASE}/purchaseorders/public/${token}`)
      .then(r => r.json().then(j => ({ ok: r.ok, ...j })))
      .then(j => {
        if (!j.ok) {
          setError(j.detail || "This link is invalid or has expired.");
        } else {
          setPo(j.data);
          const wv = j.data.walkin_vendor || {};
          setRegForm(f => ({
            ...f,
            name:           wv.name           || j.data.vendorName || "",
            contact_person: wv.contact_person || "",
            mobile:         wv.mobile         || "",
            email:          wv.email          || "",
            gstin:          wv.gstin          || "",
            address:        wv.address        || "",
          }));
          setAcceptForm(f => ({
            ...f,
            mobile:         wv.mobile         || "",
            email:          wv.email          || "",
            contact_person: wv.contact_person || "",
          }));
        }
      })
      .catch(() => setError("Network error. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  /* ── Accept ── */
  const handleAccept = async () => {
    setSubmitting(true);
    try {
      const res  = await fetch(`${API_BASE}/purchaseorders/public/${token}/accept`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ remarks: acceptForm.remarks, contact: acceptForm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to accept.");
      setDone("accepted");
      setPo(p => ({ ...p, vendor_accepted_at: new Date().toISOString(), status: "WalkinAccepted" }));
      setView("po");
    } catch (e) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  /* ── Register — secure flow, no temp password ── */
  const handleRegister = async () => {
    if (!regForm.name || !regForm.mobile) {
      alert("Business Name and Mobile are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res  = await fetch(`${API_BASE}/purchaseorders/public/${token}/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(regForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Registration failed.");
      setDone("registered");
      setView("po");
    } catch (e) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.center}>
          <div style={styles.spinner} />
          <p style={{ color: "#64748B", marginTop: 16 }}>Loading Purchase Order…</p>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: 480, margin: "60px auto 0", padding: "0 16px" }}>
          <div style={styles.card}>
            <div style={{ textAlign: "center", padding: "32px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
              <h2 style={{ color: "#DC2626", fontWeight: 700, marginBottom: 8, fontSize: 18 }}>
                Link Invalid or Expired
              </h2>
              <p style={{ color: "#64748B", fontSize: 14, margin: 0 }}>{error}</p>
              <p style={{ color: "#94A3B8", fontSize: 12, marginTop: 12 }}>
                Please contact the buyer to get a fresh link.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusStyle  = STATUS_STYLE[po.status] || { bg: "#F8FAFC", color: "#475569", border: "#E2E8F0" };
  const isAccepted   = !!(po.vendor_accepted_at || po.status === "WalkinAccepted");
  const isRegistered = done === "registered";

  return (
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #F1F5F9; font-family: system-ui, -apple-system, sans-serif; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .pub-btn { cursor: pointer; transition: opacity 0.15s, transform 0.15s; }
        .pub-btn:hover  { opacity: 0.9; transform: translateY(-1px); }
        .pub-btn:active { transform: translateY(0); }
        .pub-input { width: 100%; height: 42px; border-radius: 10px; border: 1px solid #E2E8F0; padding: 0 12px; font-size: 14px; outline: none; background: #fff; font-family: inherit; }
        .pub-input:focus { border-color: #6366F1; box-shadow: 0 0 0 3px #6366F120; }
      `}</style>

      {/* ── Company header ── */}
      <div style={styles.header}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 16px" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
            CitiMart
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
            A Unit of Lourdes Textiles Private Limited · 19B J.L.Nehru Road, Kolkata 700087
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 40px" }}>

        {/* ── Accepted banner ── */}
        {isAccepted && (
          <div style={{
            ...styles.banner,
            background: "#ECFDF5", border: "1px solid #A7F3D0",
            color: "#065F46", marginBottom: 16, animation: "fadeIn .4s ease",
          }}>
            ✅ You have accepted this Purchase Order. The buyer will be in touch shortly.
          </div>
        )}

        {/* ── Registration pending banner ── */}
        {isRegistered && (
          <div style={{
            ...styles.banner,
            background: "#EEF2FF", border: "1px solid #C7D2FE",
            color: "#3730A3", marginBottom: 16, animation: "fadeIn .4s ease",
          }}>
            🎉 Registration submitted! Your account is <b>pending admin approval</b>.
            Once approved, you will receive an email to set up your password and access the vendor portal.
          </div>
        )}

        {/* ── PO header card ── */}
        <div style={{ ...styles.card, marginBottom: 14, animation: "fadeIn .3s ease" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px" }}>
                Purchase Order
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.5px", marginTop: 4 }}>
                {po.orderNo}
              </div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>
                Dated: <b>{po.orderDate}</b>
                {po.validTill && (
                  <span style={{ marginLeft: 12 }}>Valid till: <b>{po.validTill}</b></span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                From: <b>{po.ownerSite || "RMS Retail"}</b>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{
                display: "inline-block", padding: "4px 12px", borderRadius: 20,
                fontSize: 12, fontWeight: 700,
                background: statusStyle.bg, color: statusStyle.color,
                border: `1px solid ${statusStyle.border}`,
              }}>
                {po.status === "WalkinAccepted" ? "✓ Accepted" : po.status}
              </span>
              {po.po_viewed_at && (
                <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 6 }}>
                  Viewed {new Date(po.po_viewed_at).toLocaleString("en-IN")}
                </div>
              )}
            </div>
          </div>

          {/* Vendor details strip */}
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
              Vendor Details
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontSize: 13 }}>
              {[
                ["Name",    po.walkin_vendor?.name    || po.vendorName],
                ["Contact", po.walkin_vendor?.contact_person || "—"],
                ["Mobile",  po.walkin_vendor?.mobile  || "—"],
                ["GSTIN",   po.walkin_vendor?.gstin   || "—"],
                ["Address", po.walkin_vendor?.address || "—"],
              ].map(([label, val]) => (
                <div key={label}>
                  <span style={{ color: "#94A3B8", fontSize: 11 }}>{label}: </span>
                  <span style={{ fontWeight: 600, color: "#0F172A" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Items table ── */}
        <div style={{ ...styles.card, marginBottom: 14, animation: "fadeIn .4s ease" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>
            Order Items ({po.items?.length || 0})
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                  {["#", "Item Description", "Barcode", "Qty", "Rate", "Tax", "Amount"].map((h, i) => (
                    <th key={h} style={{
                      padding: "10px 12px", textAlign: i >= 3 ? "right" : "left",
                      fontSize: 10, fontWeight: 700, color: "#64748B",
                      textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(po.items || []).map((item, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                    <td style={{ padding: "10px 12px", color: "#94A3B8", fontSize: 12 }}>{i + 1}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0F172A" }}>
                      {item.description}
                      {item.remarks && (
                        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{item.remarks}</div>
                      )}
                      {item.dueDate && (
                        <div style={{ fontSize: 10, color: "#6366F1", marginTop: 1 }}>Due: {item.dueDate}</div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#475569" }}>
                      {item.barcode || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>{item.quantity}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace" }}>
                      ₹{Number(item.rate).toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, color: "#6366F1" }}>
                      {item.taxPct}%
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>
                      ₹{Number(item.amount || (item.quantity * item.rate)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                  <td colSpan={4} />
                  <td colSpan={2} style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#475569" }}>
                    Net Payable
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: "#0F172A" }}>
                    {money(po.netAmount, po.currency || "₹")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Amount breakdown */}
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {[
              ["Basic Value",  po.basicValue],
              ["Tax Amount",   po.taxAmount],
              ["Gross Amount", po.grossAmount],
            ].map(([label, val]) => (
              <div key={label} style={{
                background: "#F8FAFC", border: "1px solid #E2E8F0",
                borderRadius: 8, padding: "6px 12px", fontSize: 12, textAlign: "right",
              }}>
                <div style={{ color: "#94A3B8", fontSize: 10 }}>{label}</div>
                <div style={{ fontWeight: 700, color: "#0F172A", fontFamily: "monospace" }}>
                  ₹{Number(val || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Terms & Notes ── */}
        {(po.notes || po.otherTerms) && (
          <div style={{ ...styles.card, marginBottom: 14, fontSize: 13 }}>
            {po.notes && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 700, color: "#475569", marginBottom: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Notes
                </div>
                <p style={{ margin: 0, color: "#64748B" }}>{po.notes}</p>
              </div>
            )}
            {po.otherTerms && (
              <div>
                <div style={{ fontWeight: 700, color: "#475569", marginBottom: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Terms & Conditions
                </div>
                <p style={{ margin: 0, color: "#64748B" }}>{po.otherTerms}</p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            ACTION AREA
            ════════════════════════════════════════════════════════════ */}

        {/* ── Accept button — only before acceptance ── */}
        {!isAccepted && po.status !== "Cancelled" && po.status !== "Rejected" && view === "po" && (
          <div style={{ marginBottom: 14 }}>
            <button
              className="pub-btn"
              onClick={() => setView("accept")}
              style={{
                width: "100%", height: 52, borderRadius: 12, border: "none",
                background: "linear-gradient(135deg,#059669,#047857)",
                color: "#fff", fontWeight: 700, fontSize: 15,
              }}>
              ✓ Accept this Purchase Order
            </button>
          </div>
        )}

        {/* ── Register button — only AFTER acceptance, only if not yet registered ── */}
        {isAccepted && !isRegistered && view === "po" && (
          <div style={{ marginBottom: 14 }}>
            <div style={{
              background: "#F0FDF4", border: "1px solid #BBF7D0",
              borderRadius: 12, padding: "14px 16px", marginBottom: 12,
              fontSize: 13, color: "#166534", lineHeight: 1.6,
            }}>
              ✅ PO accepted successfully.
              <div style={{ marginTop: 6, fontSize: 12, color: "#15803D" }}>
                Want to register in our system for faster future orders?
                Registration is <b>optional</b> and requires admin approval before you get access.
              </div>
            </div>
            <button
              className="pub-btn"
              onClick={() => setView("register")}
              style={{
                width: "100%", height: 46, borderRadius: 12,
                border: "1px solid #6366F1", background: "#EEF2FF",
                color: "#4F46E5", fontWeight: 700, fontSize: 14,
              }}>
              Register as Vendor (Optional)
            </button>
          </div>
        )}

        {/* ── Accept form ── */}
        {view === "accept" && (
          <div style={{ ...styles.card, animation: "fadeIn .3s ease", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
              Accept Purchase Order
            </div>
            <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 16px" }}>
              Please confirm your contact details. The buyer will use these to coordinate delivery.
            </p>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label style={styles.label}>Your Mobile <span style={{ color: "#EF4444" }}>*</span></label>
                <input
                  className="pub-input"
                  value={acceptForm.mobile}
                  onChange={e => setAcceptForm(f => ({ ...f, mobile: e.target.value }))}
                  placeholder="+91 XXXXXXXXXX"
                />
              </div>
              <div>
                <label style={styles.label}>Email (optional)</label>
                <input
                  className="pub-input"
                  value={acceptForm.email}
                  onChange={e => setAcceptForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="your@email.com"
                />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={styles.label}>Contact Person</label>
                <input
                  className="pub-input"
                  value={acceptForm.contact_person}
                  onChange={e => setAcceptForm(f => ({ ...f, contact_person: e.target.value }))}
                  placeholder="Your name"
                />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={styles.label}>Remarks (optional)</label>
                <textarea
                  style={styles.textarea}
                  value={acceptForm.remarks}
                  onChange={e => setAcceptForm(f => ({ ...f, remarks: e.target.value }))}
                  placeholder="Any remarks about this PO…"
                  rows={3}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                className="pub-btn"
                onClick={() => setView("po")}
                style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff", color: "#475569", fontWeight: 600 }}>
                Cancel
              </button>
              <button
                className="pub-btn"
                onClick={handleAccept}
                disabled={submitting}
                style={{ flex: 2, height: 44, borderRadius: 10, border: "none", background: "#059669", color: "#fff", fontWeight: 700, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? "Submitting…" : "✓ Confirm Acceptance"}
              </button>
            </div>
          </div>
        )}

        {/* ── Register form ── */}
        {view === "register" && (
          <div style={{ ...styles.card, animation: "fadeIn .3s ease", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
              Register as a System Vendor
            </div>
            <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 16px" }}>
              Fill in your business details. Admin will review and approve your account,
              then email you a link to set up your password.
            </p>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              {[
                { label: "Business / Trade Name *", key: "name",           placeholder: "Your business name",  span: 2 },
                { label: "Contact Person *",         key: "contact_person", placeholder: "Your name",           span: 1 },
                { label: "Mobile *",                 key: "mobile",         placeholder: "+91 XXXXXXXXXX",      span: 1 },
                { label: "Email",                    key: "email",          placeholder: "email@domain.com",    span: 1 },
                { label: "GSTIN",                    key: "gstin",          placeholder: "15-digit GSTIN",      span: 1 },
                { label: "PAN",                      key: "pan",            placeholder: "ABCDE1234F",          span: 1 },
              ].map(({ label, key, placeholder, span }) => (
                <div key={key} style={{ gridColumn: span === 2 ? "1/-1" : undefined }}>
                  <label style={styles.label}>{label}</label>
                  <input
                    className="pub-input"
                    value={regForm[key]}
                    onChange={e => setRegForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={styles.label}>Address</label>
                <textarea
                  style={styles.textarea}
                  rows={2}
                  value={regForm.address}
                  onChange={e => setRegForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Business address"
                />
              </div>
            </div>

            {/* Security notice — explains the approval flow */}
            <div style={{
              background: "#EEF2FF", border: "1px solid #C7D2FE",
              borderRadius: 10, padding: "12px 14px", fontSize: 12,
              color: "#3730A3", marginTop: 14, lineHeight: 1.6,
            }}>
              🔒 <b>Secure Registration Process</b>
              <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                <li>Your details are submitted for admin review</li>
                <li>Admin approves your account</li>
                <li>You receive an email with a secure link to set your own password</li>
                <li>You log in with your email and chosen password</li>
              </ol>
              <div style={{ marginTop: 8, color: "#4F46E5" }}>
                No temporary passwords. Your account is only activated after admin approval.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                className="pub-btn"
                onClick={() => setView("po")}
                style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff", color: "#475569", fontWeight: 600 }}>
                Cancel
              </button>
              <button
                className="pub-btn"
                onClick={handleRegister}
                disabled={submitting}
                style={{
                  flex: 2, height: 44, borderRadius: 10, border: "none",
                  background: submitting ? "#A5B4FC" : "linear-gradient(135deg,#6366F1,#4F46E5)",
                  color: "#fff", fontWeight: 700,
                }}>
                {submitting ? "Submitting…" : "Submit Registration"}
              </button>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ textAlign: "center", fontSize: 11, color: "#94A3B8", marginTop: 24 }}>
          This is an official Purchase Order from CitiMart (Lourdes Textiles Private Limited).
          <br />For queries contact: 03322493502
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#F1F5F9",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  header: {
    background: "linear-gradient(135deg, #1E293B, #334155)",
    boxShadow: "0 4px 20px rgba(15,23,42,0.2)",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #F1F5F9",
    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
    padding: 20,
  },
  banner: {
    padding: "12px 16px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.5,
  },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 5,
  },
  textarea: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #E2E8F0",
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical",
    background: "#fff",
    boxSizing: "border-box",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
  },
  spinner: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "3px solid #E2E8F0",
    borderTopColor: "#6366F1",
    animation: "spin 0.8s linear infinite",
  },
};