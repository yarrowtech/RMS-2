import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

// import React, { useEffect, useState, useCallback } from "react";
// import {
//   FaFilter, FaSearch, FaBoxes, FaLayerGroup, FaBuilding,
//   FaSyncAlt, FaChevronDown, FaWarehouse, FaTimes, FaTag,
//   FaStore, FaUserTie, FaTrashAlt, FaClipboardList, FaEdit,
//   FaPrint, FaExclamationTriangle, FaPlus,
// } from "react-icons/fa";
// import QuickFillPanel from "../Quickfillpanel";
// import BarcodeStickerPrint from "../BarcodeStickerPrint";
// import ReactDOM from "react-dom";
// import InventoryProductForm from "./InventoryProductForm";
// import SplitProductModal from "./SplitProductModal";

// const API = APP_API_URL;

// // ── Shared auth token lookup — keeps the same fallback order used
// // elsewhere in this app (admin_token → access_token → token) so this
// // component matches how the rest of the authenticated pages resolve it.
// function getAdminToken() {
//   return (
//     localStorage.getItem("admin_token")  ||
//     localStorage.getItem("access_token") ||
//     localStorage.getItem("token")        ||
//     ""
//   );
// }

// // ── Colour helpers ────────────────────────────────────────────────────────────
// const colourLabel = (raw = "") => {
//   if (!raw) return null;
//   const cleaned = raw.replace(/^#/, "").trim();
//   return /^[0-9A-Fa-f]{3,6}$/.test(cleaned) ? `#${cleaned}` : cleaned;
// };
// const swatchBg = (raw = "") => {
//   const cleaned = raw.replace(/^#/, "").trim();
//   return /^[0-9A-Fa-f]{3,6}$/.test(cleaned) ? `#${cleaned}` : raw;
// };

// function parseVariantLabel(productLabel = "") {
//   const parts = productLabel.split(" | ");
//   const base  = parts[0] || productLabel;
//   const size  = parts.length === 3 ? parts[1] : null;
//   const color = parts.length >= 2 ? parts[parts.length - 1] : null;
//   const isColour = color && (/^#?[0-9A-Fa-f]{3,6}$/.test(color) || /^[A-Za-z\s]+$/.test(color));
//   return { base, size, color: isColour ? color : null };
// }

// function VariantBadge({ size, color }) {
//   if (!size && !color) return null;
//   const label = colourLabel(color);
//   const bg    = color ? swatchBg(color) : null;
//   return (
//     <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 whitespace-nowrap">
//       {size && <span className="font-semibold text-indigo-700">{size}</span>}
//       {size && color && <span className="text-slate-300">|</span>}
//       {color && (
//         <>
//           <span className="inline-block w-3 h-3 rounded-sm border border-slate-300 shrink-0" style={{ background: bg }} />
//           <span>{label}</span>
//         </>
//       )}
//     </span>
//   );
// }

// function SourceBadge({ source, vendorName, grnNo }) {
//   if (source === "grn") return (
//     <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700, background:"#FFFBEB", color:"#D97706", border:"1px solid #FDE68A", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={grnNo || "GRN Inward"}>
//       <FaClipboardList style={{ fontSize:9, flexShrink:0 }} />
//       {grnNo ? `GRN · ${grnNo.split("/")[1] || grnNo}` : "GRN Inward"}
//     </span>
//   );
//   if (source === "vendor") return (
//     <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700, background:"#ECFDF5", color:"#059669", border:"1px solid #A7F3D0", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={vendorName}>
//       <FaUserTie style={{ fontSize:9, flexShrink:0 }} />
//       {vendorName || "Vendor"}
//     </span>
//   );
//   return (
//     <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700, background:"#EEF2FF", color:"#6366F1", border:"1px solid #C7D2FE" }}>
//       <FaStore style={{ fontSize:9, flexShrink:0 }} /> Admin
//     </span>
//   );
// }

// function StatusBadge({ status }) {
//   if (!status) return null;
//   return (
//     <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${status.cls}`}>
//       {status.label}
//     </span>
//   );
// }

// // ── Delete confirm modal ──────────────────────────────────────────────────────
// function DeleteConfirmModal({ barcode, productName, onConfirm, onCancel }) {
//   if (!barcode) return null;
//   return (
//     <div style={{ position:"fixed", inset:0, zIndex:10000, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(2px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onCancel}>
//       <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:400, padding:"28px 28px 24px", boxShadow:"0 24px 64px rgba(0,0,0,0.2)", border:"1px solid #e2e8f0" }} onClick={e => e.stopPropagation()}>
//         <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
//           <div style={{ width:42, height:42, borderRadius:12, background:"#FEF2F2", border:"1px solid #FECACA", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
//             <FaTrashAlt style={{ color:"#DC2626", fontSize:16 }} />
//           </div>
//           <div>
//             <p style={{ fontWeight:700, fontSize:15, color:"#0f172a", margin:0 }}>Delete from Inventory?</p>
//             <p style={{ fontSize:12, color:"#64748b", margin:"2px 0 0" }}>This cannot be undone</p>
//           </div>
//         </div>
//         <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px", marginBottom:20, border:"1px solid #f1f5f9" }}>
//           <p style={{ fontSize:14, fontWeight:600, color:"#1e293b", margin:0 }}>{productName}</p>
//           <p style={{ fontSize:11, color:"#94a3b8", fontFamily:"monospace", margin:"3px 0 0" }}>{barcode}</p>
//         </div>
//         <div style={{ display:"flex", gap:10 }}>
//           <button onClick={onCancel} style={{ flex:1, padding:"9px 0", borderRadius:10, border:"1px solid #e2e8f0", background:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", color:"#374151" }}>Cancel</button>
//           <button onClick={onConfirm} style={{ flex:1, padding:"9px 0", borderRadius:10, border:"none", background:"#DC2626", fontSize:13, fontWeight:700, cursor:"pointer", color:"#fff" }}>Delete</button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ── Product Detail Modal — now with Fix + Print Stickers ─────────────────────
// function ProductDetailModal({ row, onClose, onSaved, setShowForm, setEditProduct, setSplitRow }) {
//   const [visible,    setVisible]    = useState(false);
//   const [tab,        setTab]        = useState("details");
//   const [printOpen,  setPrintOpen]  = useState(false);
//   const [product,    setProduct]    = useState(null);  // full product from API
//   const [loadingProd,setLoadingProd]= useState(false);

//   useEffect(() => {
//     if (!row) return;
//     const t = setTimeout(() => setVisible(true), 10);
//     const h = (e) => { if (e.key === "Escape") onClose(); };
//     window.addEventListener("keydown", h);
//     document.body.style.overflow = "hidden";
//     return () => { clearTimeout(t); window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
//   }, [row, onClose]);

//   // Fetch full product record for QuickFillPanel + sticker data
//   useEffect(() => {
//     if (!row?.barcode) return;
//     setLoadingProd(true);
//     const token = getAdminToken();
//     // Try to find by barcode via diagnose endpoint (already exists)
//     fetch(`${API}/inventory/diagnose/${encodeURIComponent(row.barcode)}`, {
//       headers: token ? { Authorization: `Bearer ${token}` } : {},
//     })
//       .then(r => r.json())
//       .then(data => {
//         // Build a product-like object from what we have
//         setProduct({
//           product_name: row.product || row.barcode,
//           barcode:      row.barcode,
//           sku:          row.sku || "",
//           division:     row.division || "",
//           section:      row.section  || "",
//           department:   row.department || "",
//           hsn_code:     row.hsn_code || "",
//           source:       row.source || "admin",
//           vendor_name:  row.vendor_name || "",
//           grn_no:       row.grn_no || "",
//           has_variants: false,
//           mrp:          row.rate || 0,
//           selling_price:row.rate || 0,
//           cost_price:   row.rate || 0,
//           quantity:     row.qty  || 0,
//         });
//       })
//       .catch(() => {
//         setProduct({
//           product_name: row.product || row.barcode,
//           barcode:      row.barcode,
//           sku:          row.sku || "",
//           division:     row.division || "",
//           section:      row.section  || "",
//           department:   row.department || "",
//           hsn_code:     row.hsn_code || "",
//           source:       row.source || "admin",
//           vendor_name:  row.vendor_name || "",
//           grn_no:       row.grn_no || "",
//           has_variants: false,
//           quantity:     row.qty || 0,
//         });
//       })
//       .finally(() => setLoadingProd(false));
//   }, [row?.barcode]);

//   if (!row) return null;

//   const { base, size, color } = parseVariantLabel(row.product || "");
//   const bg         = color ? swatchBg(color) : null;
//   const colorLabel = color ? colourLabel(color) : null;
//   const qtyColor   = (row.qty||0) <= 0 ? "#EF4444" : (row.qty||0) <= 20 ? "#D97706" : "#059669";
//   const rowValue   = (row.qty||0) * (row.rate||0);

//   // Is this product missing classification?
//   const isMissingFields =
//     !row.division || !row.section || !row.department || !row.hsn_code || !row.sku;

//   // Sticker items
//   const stickerItems = [{
//     barcode:    row.barcode,
//     name:       row.product || row.barcode,
//     sku:        row.sku || "",
//     rate:       row.rate || 0,
//     division:   row.division || "",
//     size_label: size || "",
//     color:      color || "",
//   }];

//   const TABS = [
//     { key: "details", label: "Details" },
//     ...(isMissingFields ? [{ key: "fix", label: `Fix Fields` }] : []),
//   ];

//   const modal = (
//     <>
//       <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:99998, background:"rgba(10,14,22,0.65)", backdropFilter:"blur(8px)", transition:"opacity .22s ease", opacity: visible ? 1 : 0 }} />

//       <div onClick={e => e.stopPropagation()} style={{
//         position:"fixed", top:"50%", left:"50%",
//         transform: visible ? "translate(-50%,-50%) scale(1)" : "translate(-50%,-48%) scale(0.96)",
//         zIndex:99999,
//         width:"calc(100vw - 40px)", maxWidth:780,
//         maxHeight:"90vh",
//         display:"flex", flexDirection:"column",
//         borderRadius:20, background:"#fff",
//         border:"1px solid #E8ECF4",
//         boxShadow:"0 32px 80px rgba(10,14,22,0.28)",
//         overflow:"hidden",
//         transition:"transform .28s cubic-bezier(.16,1,.3,1), opacity .22s ease",
//         opacity: visible ? 1 : 0,
//       }}>

//         {/* ── Header ── */}
//         <div style={{ flexShrink:0, padding:"18px 22px 0", borderBottom:"1px solid #F1F5F9", background:"linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%)" }}>
//           <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:14 }}>
//             <div style={{ flex:1, minWidth:0 }}>
//               <div style={{ fontWeight:800, fontSize:17, color:"#0E1117", lineHeight:1.3, marginBottom:6, wordBreak:"break-word" }}>
//                 {base}
//                 {isMissingFields && (
//                   <span style={{ marginLeft:8, padding:"2px 8px", borderRadius:20, background:"#FFFBEB", border:"1px solid #FDE68A", color:"#D97706", fontSize:10, fontWeight:700, verticalAlign:"middle" }}>
//                     ⚠ Incomplete
//                   </span>
//                 )}
//               </div>
//               <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
//                 {row.sku && (
//                   <span style={{ fontFamily:"monospace", fontSize:11, color:"#6366f1", background:"#EEEFFE", border:"1px solid #C5C8F8", borderRadius:6, padding:"2px 8px" }}>{row.sku}</span>
//                 )}
//                 <span style={{ fontFamily:"monospace", fontSize:11, color:"#4A5168", background:"#F1F5F9", border:"1px solid #E2E8F0", borderRadius:6, padding:"2px 8px" }}>{row.barcode}</span>
//                 <SourceBadge source={row.source} vendorName={row.vendor_name} grnNo={row.grn_no} />
//                 {(size || color) && (
//                   <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:6, background:"#f8fafc", border:"1px solid #e2e8f0", fontSize:12, color:"#475569" }}>
//                     {size && <span style={{ fontWeight:700, color:"#6366f1" }}>{size}</span>}
//                     {size && color && <span style={{ color:"#cbd5e1" }}>|</span>}
//                     {color && <><span style={{ width:12, height:12, borderRadius:3, background:bg, border:"1px solid #e2e8f0", display:"inline-block" }} /><span>{colorLabel}</span></>}
//                   </span>
//                 )}
//               </div>
//             </div>
//             <button onClick={onClose} style={{ flexShrink:0, width:32, height:32, borderRadius:8, border:"1px solid #E8ECF4", background:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#8C93AB" }}>
//               <FaTimes />
//             </button>
//           </div>

//           {/* Tabs + Print button */}
//           <div style={{ display:"flex", alignItems:"flex-end" }}>
//             {TABS.map(({ key, label }) => {
//               const isActive = tab === key;
//               const isFix    = key === "fix";
//               return (
//                 <button key={key} onClick={() => setTab(key)} style={{
//                   padding:"9px 20px", border:"none", cursor:"pointer",
//                   fontSize:12, fontWeight:700, borderRadius:"8px 8px 0 0", transition:"all .15s",
//                   background: isActive ? (isFix ? "#FFFBEB" : "#EEF2FF") : "transparent",
//                   color:      isActive ? (isFix ? "#D97706" : "#6366F1") : "#94a3b8",
//                   borderBottom: isActive ? `2px solid ${isFix ? "#D97706" : "#6366F1"}` : "2px solid transparent",
//                   marginBottom: -1,
//                 }}>{label}</button>
//               );
//             })}

//             {/* Print Stickers button */}
//             <button
//               onClick={() => setPrintOpen(true)}
//               style={{
//                 marginLeft:"auto", marginBottom:-1,
//                 padding:"7px 16px", border:"none", cursor:"pointer",
//                 fontSize:12, fontWeight:700, borderRadius:"8px 8px 0 0",
//                 background:"#FEF3C7", color:"#D97706",
//                 borderBottom:"2px solid #F59E0B",
//                 display:"flex", alignItems:"center", gap:6,
//               }}
//             >
//               🏷️ Print Stickers
//             </button>
//           </div>
//         </div>

//         {/* ── Body ── */}
//         <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:"20px 22px 24px" }}>

//           {/* FIX TAB */}
//           {tab === "fix" && (
//             <div>
//               {/* Missing fields warning */}
//               <div style={{ marginBottom:16, padding:"14px 18px", borderRadius:12, background:"#FFFBEB", border:"1px solid #FDE68A", display:"flex", alignItems:"flex-start", gap:12 }}>
//                 <FaExclamationTriangle style={{ color:"#D97706", fontSize:18, flexShrink:0, marginTop:2 }} />
//                 <div>
//                   <div style={{ fontSize:12, fontWeight:700, color:"#78350F", marginBottom:4 }}>
//                     Missing: {[!row.division && "Division", !row.section && "Section", !row.department && "Department", !row.hsn_code && "HSN Code", !row.sku && "SKU"].filter(Boolean).join(", ")}
//                   </div>
//                   <div style={{ fontSize:12, color:"#92400E" }}>
//                     Complete these fields so this item appears correctly in reports and filters.
//                   </div>
//                 </div>
//               </div>

//               {/* GRN source note */}
//               {row.source === "grn" && (
//                 <div style={{ marginBottom:14, padding:"10px 14px", borderRadius:10, background:"#F0F9FF", border:"1px solid #BAE6FD", fontSize:12, color:"#0369A1", fontWeight:600 }}>
//                   📋 Auto-created from GRN {row.grn_no || ""} — complete classification below
//                 </div>
//               )}

//               {/* SPLIT into styles — fastest way when pattern/size differ per batch */}
//               <button
//                 onClick={() => {
//                   onClose();
//                   setSplitRow(row);
//                 }}
//                 style={{
//                   width:"100%", padding:"14px 18px", marginBottom:10,
//                   borderRadius:14, border:"2px solid #6366f1", cursor:"pointer",
//                   background:"#EEF2FF",
//                   display:"flex", alignItems:"center", gap:10,
//                   transition:"opacity .15s",
//                 }}>
//                 <span style={{ fontSize:20 }}>✂️</span>
//                 <div style={{ textAlign:"left" }}>
//                   <div style={{ fontSize:13, fontWeight:800, color:"#4338CA" }}>Split into Styles (Fastest)</div>
//                   <div style={{ fontSize:11, color:"#6366F1", marginTop:2 }}>
//                     Plain / Polka Dots / Printed — define all styles in one screen
//                   </div>
//                 </div>
//               </button>

//               {/* OR label */}
//               <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
//                 <div style={{ flex:1, height:1, background:"#e2e8f0" }}/>
//                 <span style={{ fontSize:11, color:"#94a3b8", fontWeight:600 }}>OR — same pattern, just fix fields</span>
//                 <div style={{ flex:1, height:1, background:"#e2e8f0" }}/>
//               </div>

//               {/* Complete Product Details → opens InventoryProductForm */}
//               <button
//                 onClick={() => {
//                   onClose();
//                   setEditProduct({
//                     id:          row.id || row._id || "",
//                     barcode:     row.barcode || "",
//                     description: row.product || "",
//                     rate:        row.rate || 0,
//                     mrp:         row.mrp  || 0,
//                     stockQty:    row.qty  || 0,
//                     division:    row.division   || "",
//                     department:  row.department || "",
//                     section:     row.section    || "",
//                     sku:         row.sku        || "",
//                     product_type: row.product_type || "garment",
//                     category1:   row.category1  || "",
//                     category2:   row.category2  || "",
//                     category3:   row.category3  || "",
//                     category4:   row.category4  || "",
//                     category5:   row.category5  || "",
//                     category6:   row.category6  || "",
//                     grn_date:    row.grn_date   || "",
//                     has_variants: row.has_variants || false,
//                     variants:    row.variants   || [],
//                   });
//                   setShowForm(true);
//                 }}
//                 style={{
//                   width:"100%", padding:"14px 18px",
//                   borderRadius:14, border:"none", cursor:"pointer",
//                   background:"linear-gradient(135deg,#6366f1,#4f46e5)",
//                   display:"flex", alignItems:"center", gap:10,
//                   transition:"opacity .15s",
//                 }}
//                 onMouseEnter={e => e.currentTarget.style.opacity="0.9"}
//                 onMouseLeave={e => e.currentTarget.style.opacity="1"}
//               >
//                 <FaEdit style={{ color:"#fff", fontSize:14 }} />
//                 <span style={{ fontSize:13, fontWeight:700, color:"#fff" }}>Complete Product Details</span>
//                 <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginLeft:"auto" }}>{row.product}</span>
//               </button>
//             </div>
//           )}

//           {/* DETAILS TAB */}
//           {tab === "details" && (
//             <>
//               {/* GRN / Vendor strip */}
//               {row.source === "grn" && (
//                 <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", background:"#FFFBEB", borderRadius:10, border:"1px solid #FDE68A", marginBottom:18 }}>
//                   <FaClipboardList style={{ color:"#D97706", fontSize:18, flexShrink:0 }} />
//                   <div>
//                     <div style={{ fontSize:10, color:"#92400E", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px" }}>Added via GRN Inward</div>
//                     <div style={{ fontSize:14, fontWeight:700, color:"#78350F", marginTop:1 }}>{row.grn_no || "—"}{row.vendor_name ? ` · ${row.vendor_name}` : ""}</div>
//                   </div>
//                 </div>
//               )}
//               {row.source === "vendor" && row.vendor_name && (
//                 <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", background:"#F0FDF4", borderRadius:10, border:"1px solid #BBF7D0", marginBottom:18 }}>
//                   <FaUserTie style={{ color:"#16A34A", fontSize:18, flexShrink:0 }} />
//                   <div>
//                     <div style={{ fontSize:10, color:"#86EFAC", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px" }}>Supplied by Vendor</div>
//                     <div style={{ fontSize:14, fontWeight:700, color:"#15803D", marginTop:1 }}>{row.vendor_name}</div>
//                   </div>
//                 </div>
//               )}

//               {/* Classification */}
//               <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:10 }}>Classification</div>
//               <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:18 }}>
//                 {[
//                   { label:"Division",   value:row.division },
//                   { label:"Section",    value:row.section  },
//                   { label:"Department", value:row.department },
//                 ].map(({ label, value }) => (
//                   <div key={label} style={{ background: value ? "#F8FAFC" : "#FFF7ED", borderRadius:10, padding:"10px 14px", border: value ? "1px solid #F1F5F9" : "1px solid #FED7AA" }}>
//                     <div style={{ fontSize:9, color:"#94a3b8", marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px" }}>{label}</div>
//                     <div style={{ fontSize:13, fontWeight:700, color: value ? "#1e293b" : "#D97706" }}>{value || "—"}</div>
//                   </div>
//                 ))}
//               </div>

//               <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:18 }}>
//                 {[
//                   { label:"HSN Code", value:row.hsn_code },
//                   { label:"SKU",      value:row.sku, mono:true },
//                   { label:"Source",   value:row.source || "admin" },
//                 ].map(({ label, value, mono }) => (
//                   <div key={label} style={{ background:"#F8FAFC", borderRadius:10, padding:"10px 14px", border:"1px solid #F1F5F9" }}>
//                     <div style={{ fontSize:9, color:"#94a3b8", marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px" }}>{label}</div>
//                     <div style={{ fontSize:13, fontWeight:700, color: value ? "#1e293b" : "#cbd5e1", fontFamily: mono ? "monospace" : "inherit" }}>{value || "—"}</div>
//                   </div>
//                 ))}
//               </div>

//               {/* Stock & Pricing */}
//               <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:10 }}>Stock & Pricing</div>
//               <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
//                 <div style={{ background:"#f8fafc", borderRadius:10, padding:"16px 12px", textAlign:"center", border:"1px solid #f1f5f9" }}>
//                   <div style={{ fontSize:28, fontWeight:800, color:qtyColor, lineHeight:1.1 }}>{(row.qty||0).toLocaleString()}</div>
//                   <div style={{ fontSize:10, color:"#94a3b8", marginTop:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px" }}>Qty in Stock</div>
//                 </div>
//                 <div style={{ background:"#f8fafc", borderRadius:10, padding:"16px 12px", textAlign:"center", border:"1px solid #f1f5f9" }}>
//                   <div style={{ fontSize: row.rate > 0 ? 20 : 26, fontWeight:800, color:"#d97706", lineHeight:1.1 }}>
//                     {row.rate > 0 ? `₹${row.rate.toLocaleString("en-IN", {minimumFractionDigits:2})}` : "—"}
//                   </div>
//                   <div style={{ fontSize:10, color:"#94a3b8", marginTop:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px" }}>Rate</div>
//                 </div>
//                 <div style={{ background: rowValue > 0 ? "#eef2ff" : "#f8fafc", borderRadius:10, padding:"16px 12px", textAlign:"center", border: rowValue > 0 ? "1px solid #c7d2fe" : "1px solid #f1f5f9" }}>
//                   <div style={{ fontSize: rowValue > 0 ? 18 : 26, fontWeight:800, color: rowValue > 0 ? "#6366f1" : "#cbd5e1", lineHeight:1.1 }}>
//                     {rowValue > 0 ? `₹${rowValue.toLocaleString("en-IN", {minimumFractionDigits:2})}` : "—"}
//                   </div>
//                   <div style={{ fontSize:10, color:"#94a3b8", marginTop:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px" }}>Stock Value</div>
//                 </div>
//               </div>

//               {row.status && (
//                 <div style={{ marginTop:14 }}>
//                   <StatusBadge status={row.status} />
//                 </div>
//               )}
//             </>
//           )}
//         </div>

//         {/* ── Footer ── */}
//         <div style={{ flexShrink:0, padding:"12px 22px", borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fafafa" }}>
//           <div style={{ display:"flex", gap:8 }}>
//             {isMissingFields && tab !== "fix" && (
//               <button
//                 onClick={() => setTab("fix")}
//                 style={{ padding:"7px 16px", borderRadius:8, border:"1px solid #FDE68A", background:"#FFFBEB", fontSize:12, fontWeight:700, cursor:"pointer", color:"#D97706", display:"flex", alignItems:"center", gap:6 }}
//               >
//                 <FaEdit size={11} /> Fix Fields
//               </button>
//             )}
//             <button
//               onClick={() => setPrintOpen(true)}
//               style={{ padding:"7px 16px", borderRadius:8, border:"1px solid #FDE68A", background:"#FEF3C7", fontSize:12, fontWeight:700, cursor:"pointer", color:"#D97706", display:"flex", alignItems:"center", gap:6 }}
//             >
//               🏷️ Print Sticker
//             </button>
//           </div>
//           <button onClick={onClose} style={{ padding:"8px 22px", borderRadius:8, border:"1px solid #e2e8f0", background:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", color:"#374151" }}>
//             Close
//           </button>
//         </div>
//       </div>

//       {/* Sticker Print Modal */}
//       {printOpen && (
//         <BarcodeStickerPrint
//           items={stickerItems}
//           onClose={() => setPrintOpen(false)}
//           storeName=""
//         />
//       )}
//     </>
//   );

//   return ReactDOM.createPortal(modal, document.body);
// }

// // ═══════════════════════════════════════════════════════════════════════════════
// // MAIN COMPONENT
// // ═══════════════════════════════════════════════════════════════════════════════
// export default function InventoryCurrentStockList() {
//   const [division,     setDivision]     = useState("");
//   const [section,      setSection]      = useState("");
//   const [department,   setDepartment]   = useState("");
//   const [search,       setSearch]       = useState("");
//   const [sourceFilter, setSourceFilter] = useState("all");
//   const [vendorFilter, setVendorFilter] = useState("");
//   const [selectedRow,  setSelectedRow]  = useState(null);
//   const [showForm,     setShowForm]     = useState(false);
//   const [splitRow,     setSplitRow]     = useState(null);
//   const [editProduct,  setEditProduct]  = useState(null);
//   const [deleteTarget, setDeleteTarget] = useState(null);
//   const [deleting,     setDeleting]     = useState(false);

//   const [divisions,   setDivisions]   = useState([]);
//   const [sections,    setSections]    = useState([]);
//   const [departments, setDepartments] = useState([]);
//   const [sectionMap,  setSectionMap]  = useState({});
//   const [deptMap,     setDeptMap]     = useState({});
//   const [metaLoading, setMetaLoading] = useState(true);

//   const [data,    setData]    = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error,   setError]   = useState(null);

//   useEffect(() => {
//     const fetchMeta = async () => {
//       setMetaLoading(true);
//       try {
//         // ── FIXED: this used to call /api/products/public with no query
//         // string. That endpoint is the PUBLIC customer-facing catalog and
//         // now requires an explicit ?tenant= identifier (public endpoints
//         // must be tenant-scoped too — there's no login to derive tenant
//         // from). This page is an authenticated HQ admin screen; it already
//         // has a Bearer token, so it uses the authenticated, already-
//         // tenant-scoped inventory endpoint instead — no query param
//         // needed, tenant comes from the JWT via get_hq_tenant.
//         //
//         // limit=1000 to actually cover the full catalog for building filter
//         // dropdowns — the endpoint's default (200) could silently omit
//         // divisions/sections that only appear later in a large catalog.
//         const token = getAdminToken();
//         const res = await fetch(`${API}/inventory/products/?limit=1000`, {
//           headers: token ? { Authorization: `Bearer ${token}` } : {},
//         });
//         if (!res.ok) throw new Error();
//         const json = await res.json();
//         const products = json.data || [];
//         const divSet = new Set();
//         const secMap = {};
//         const deptMapLocal = {};
//         for (const p of products) {
//           const d = p.division || "", s = p.section || "", dp = p.department || "";
//           if (d) { divSet.add(d); if (!secMap[d]) secMap[d] = new Set(); if (s) secMap[d].add(s); }
//           if (s) { if (!deptMapLocal[s]) deptMapLocal[s] = new Set(); if (dp) deptMapLocal[s].add(dp); }
//         }
//         setDivisions([...divSet].sort());
//         setSectionMap(Object.fromEntries(Object.entries(secMap).map(([k,v])=>[k,[...v].sort()])));
//         setDeptMap(Object.fromEntries(Object.entries(deptMapLocal).map(([k,v])=>[k,[...v].sort()])));
//       } catch { setError("Could not load filter options."); }
//       finally { setMetaLoading(false); }
//     };
//     fetchMeta();
//   }, []);

//   useEffect(() => { setSections(division && sectionMap[division] ? sectionMap[division] : []); setSection(""); setDepartment(""); }, [division, sectionMap]);
//   useEffect(() => { setDepartments(section && deptMap[section] ? deptMap[section] : []); setDepartment(""); }, [section, deptMap]);

//   const fetchData = useCallback(async () => {
//     setLoading(true); setError(null);
//     try {
//       const params = new URLSearchParams();
//       if (division)   params.append("division",   division);
//       if (section)    params.append("section",    section);
//       if (department) params.append("department", department);
//       if (search)     params.append("search",     search);

//       const token = getAdminToken();
//       const res = await fetch(`${API}/inventory/current-stock?${params.toString()}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) throw new Error();
//       const json = await res.json();
//       setData((json.data || []).map(r => ({ ...r, /* unchanged */ })));
//     } catch { setError("Could not load stock data."); }
//     finally { setLoading(false); }
//   }, [division, section, department, search]);

//   useEffect(() => { fetchData(); }, [fetchData]);

//   const handleDeleteConfirm = async () => {
//     if (!deleteTarget) return;
//     setDeleting(true);
//     try {
//       const token = getAdminToken();
//       const res = await fetch(`${API}/inventory/delete/${encodeURIComponent(deleteTarget.barcode)}`, {
//         method: "DELETE",
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) { const err = await res.json().catch(()=>({})); alert(`❌ Delete failed: ${err.detail || res.status}`); return; }
//       setDeleteTarget(null);
//       fetchData();
//     } catch { alert("❌ Network error."); }
//     finally { setDeleting(false); }
//   };

//   const vendorNames = React.useMemo(() => {
//     const names = new Set(data.filter(r => r.source === "vendor" && r.vendor_name).map(r => r.vendor_name));
//     return [...names].sort();
//   }, [data]);

//   const sourceCounts = React.useMemo(() => ({
//     all:    data.length,
//     admin:  data.filter(r => r.source === "admin").length,
//     vendor: data.filter(r => r.source === "vendor").length,
//     grn:    data.filter(r => r.source === "grn").length,
//   }), [data]);

//   const filtered = React.useMemo(() => {
//     let rows = data;
//     if (sourceFilter !== "all") rows = rows.filter(r => (r.source || "admin") === sourceFilter);
//     if (vendorFilter) rows = rows.filter(r => r.vendor_name === vendorFilter);
//     return rows;
//   }, [data, sourceFilter, vendorFilter]);

//   const inStock    = filtered.filter(r => r.status?.label === "In Stock").length;
//   const lowStock   = filtered.filter(r => r.status?.label === "Low Stock").length;
//   const outStock   = filtered.filter(r => r.status?.label === "Out of Stock").length;
//   const totalValue = filtered.filter(r => (r.qty||0) > 0).reduce((s,r) => s + r.qty * r.rate, 0);

//   const tabStyle = (key, activeColor) => ({
//     padding:"6px 14px", fontSize:12, fontWeight:700, borderRadius:8,
//     cursor:"pointer", border:"none", transition:"all .15s",
//     background: sourceFilter === key ? activeColor : "#F1F5F9",
//     color:      sourceFilter === key ? "#fff"       : "#64748B",
//   });

//   return (
//     <>
//       <ProductDetailModal
//         row={selectedRow}
//         onClose={() => setSelectedRow(null)}
//         onSaved={fetchData}
//         setShowForm={setShowForm}
//         setEditProduct={setEditProduct}
//         setSplitRow={setSplitRow}
//       />
//       <DeleteConfirmModal
//         barcode={deleteTarget?.barcode}
//         productName={deleteTarget?.product}
//         onConfirm={handleDeleteConfirm}
//         onCancel={() => !deleting && setDeleteTarget(null)}
//       />

//       <div className="h-full min-h-0 overflow-hidden px-3 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">

//         {/* Header */}
//         <div className="flex items-center justify-between shrink-0">
//           <div className="flex items-center gap-3">
//             <div className="p-2 bg-indigo-600 rounded-xl"><FaBoxes className="text-white text-lg" /></div>
//             <div>
//               <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">Central Stock List</h1>
//               <p className="text-xs text-slate-500">{filtered.length} items · Central Inventory (HQ)</p>
//             </div>
//           </div>
//           <div className="flex items-center gap-2">
//             <button onClick={fetchData} disabled={loading}
//               className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm font-medium transition-colors disabled:opacity-50">
//               <FaSyncAlt className={loading ? "animate-spin" : ""} /> Refresh
//             </button>
//             <button onClick={() => { setEditProduct(null); setShowForm(true); }}
//               className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors shadow-sm">
//               <FaPlus className="text-xs" /> Add Product
//             </button>
//           </div>
//         </div>

//         {error && (
//           <div className="shrink-0 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
//             <span className="font-semibold">Error:</span> {error}
//           </div>
//         )}

//         {/* KPI pills */}
//         <div className="flex gap-2 flex-wrap shrink-0">
//           {[
//             { label:"In Stock",     count:inStock,  cls:"bg-emerald-50 text-emerald-700 border-emerald-200" },
//             { label:"Low Stock",    count:lowStock, cls:"bg-amber-50 text-amber-700 border-amber-200" },
//             { label:"Out of Stock", count:outStock, cls:"bg-rose-50 text-rose-700 border-rose-200" },
//           ].map(p => (
//             <span key={p.label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${p.cls}`}>
//               <span className="text-base font-bold tabular-nums">{p.count}</span> {p.label}
//             </span>
//           ))}
//           <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4, padding:"4px 12px", borderRadius:24, background:"#EEF2FF", border:"1px solid #C7D2FE", fontSize:12, fontWeight:700, color:"#4F46E5" }}>
//             <FaWarehouse style={{ fontSize:11 }} />
//             Stock Value: ₹{totalValue.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
//           </div>
//         </div>

//         {/* Source tabs */}
//         <div className="flex gap-2 shrink-0 flex-wrap items-center">
//           <span style={{ fontSize:11, color:"#94A3B8", fontWeight:700 }}>SOURCE</span>
//           <button onClick={() => { setSourceFilter("all"); setVendorFilter(""); }}    style={tabStyle("all",    "#6366F1")}>All ({sourceCounts.all})</button>
//           <button onClick={() => { setSourceFilter("admin"); setVendorFilter(""); }}  style={tabStyle("admin",  "#6366F1")}>Admin ({sourceCounts.admin})</button>
//           <button onClick={() => { setSourceFilter("vendor"); }}                      style={tabStyle("vendor", "#059669")}>🏪 Vendor ({sourceCounts.vendor})</button>
//           <button onClick={() => { setSourceFilter("grn"); setVendorFilter(""); }}    style={tabStyle("grn",    "#D97706")}>📋 GRN Inward ({sourceCounts.grn})</button>
//           {sourceFilter === "vendor" && vendorNames.length > 0 && (
//             <>
//               <span style={{ fontSize:11, color:"#94A3B8", fontWeight:700, marginLeft:8 }}>VENDOR</span>
//               <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
//                 <FaUserTie style={{ position:"absolute", left:10, color:"#059669", fontSize:11, pointerEvents:"none" }} />
//                 <select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)}
//                   style={{ paddingLeft:28, paddingRight:28, paddingTop:6, paddingBottom:6, fontSize:12, fontWeight:700, borderRadius:8, border:"1px solid #A7F3D0", background:vendorFilter?"#ECFDF5":"#F0FDF4", color:vendorFilter?"#059669":"#6B7280", cursor:"pointer", appearance:"none", outline:"none" }}>
//                   <option value="">All Vendors</option>
//                   {vendorNames.map(n => <option key={n} value={n}>{n}</option>)}
//                 </select>
//                 <FaChevronDown style={{ position:"absolute", right:10, color:"#94A3B8", fontSize:10, pointerEvents:"none" }} />
//               </div>
//               {vendorFilter && <button onClick={() => setVendorFilter("")} style={{ fontSize:11, color:"#94A3B8", background:"none", border:"none", cursor:"pointer", fontWeight:700 }}>✕ Clear</button>}
//             </>
//           )}
//         </div>

//         {/* Filters */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3 sm:p-4 rounded-2xl shadow-sm shrink-0 border border-slate-200">
//           <FilterSelect icon={<FaLayerGroup className="text-slate-500 text-xs" />} label="Division"   value={division}   onChange={setDivision}   options={divisions}   disabled={metaLoading} placeholder={metaLoading?"Loading…":"All Divisions"} />
//           <FilterSelect icon={<FaFilter className="text-slate-500 text-xs" />}    label="Section"    value={section}    onChange={setSection}    options={sections}    disabled={!division||sections.length===0} placeholder={division&&sections.length===0?"No sections":"All Sections"} />
//           <FilterSelect icon={<FaBuilding className="text-slate-500 text-xs" />}  label="Department" value={department} onChange={setDepartment} options={departments} disabled={!section||departments.length===0} placeholder={section&&departments.length===0?"No departments":"All Departments"} />
//           <div className="sm:col-span-2 lg:col-span-1">
//             <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Search</label>
//             <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
//               <FaSearch className="text-slate-400 shrink-0 text-xs" />
//               <input type="text" placeholder="Barcode / SKU / Product / Vendor / GRN"
//                 className="bg-transparent outline-none py-2 w-full text-sm"
//                 value={search} onChange={e => setSearch(e.target.value)} />
//               {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>}
//             </div>
//           </div>
//         </div>

//         {/* Table */}
//         <div className="bg-white rounded-2xl shadow-sm flex-1 min-h-0 overflow-hidden border border-slate-200">
//           <div className="h-full overflow-auto">
//             <table className="w-full text-sm min-w-[1220px]">
//               <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 border-b border-slate-200">
//                 <tr>
//                   {[
//                     { col:"Barcode", align:"left" }, { col:"SKU", align:"left" },
//                     { col:"Product", align:"left" }, { col:"Added By", align:"left" },
//                     { col:"Division", align:"left" }, { col:"Section", align:"left" },
//                     { col:"Dept", align:"left" }, { col:"Variant", align:"left" },
//                     { col:"Qty", align:"right" }, { col:"Rate", align:"right" },
//                     { col:"Value", align:"right" }, { col:"Status", align:"left" },
//                     { col:"Actions", align:"right" },
//                   ].map(({ col, align }) => (
//                     <th key={col} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ textAlign:align }}>{col}</th>
//                   ))}
//                 </tr>
//               </thead>

//               <tbody className="divide-y divide-slate-100">
//                 {loading ? (
//                   <tr><td colSpan={13} className="p-10 text-center">
//                     <div className="flex flex-col items-center gap-2 text-slate-400">
//                       <FaSyncAlt className="animate-spin text-xl text-indigo-400" />
//                       <span className="text-sm">Loading stock data…</span>
//                     </div>
//                   </td></tr>
//                 ) : filtered.length === 0 ? (
//                   <tr><td colSpan={13} className="p-10 text-center">
//                     <div className="flex flex-col items-center gap-2 text-slate-400">
//                       <FaBoxes className="text-3xl opacity-30" />
//                       <span className="text-sm">No stock found</span>
//                     </div>
//                   </td></tr>
//                 ) : filtered.map((row, i) => {
//                   const { base, size, color } = parseVariantLabel(row.product || "");
//                   const hasVariant = size || color;
//                   const rowValue   = (row.qty||0) * (row.rate||0);
//                   const isMissing  = !row.division || !row.section || !row.department || !row.hsn_code || !row.sku;
//                   const rowBg      = row.source === "grn" ? "hover:bg-amber-50/40" : "hover:bg-indigo-50/40";

//                   return (
//                     <tr key={i} className={`transition-colors ${rowBg}`}>
//                       <td className="px-3 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{row.barcode}</td>
//                       <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">{row.sku || <span className="text-slate-300">—</span>}</td>
//                       <td className="px-3 py-3 min-w-[180px] max-w-[260px]">
//                         <span className="font-medium text-slate-800 leading-snug">{base}</span>
//                         {isMissing && <span className="ml-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">⚠ Fix</span>}
//                         {row.source === "grn" && row.grn_no && (
//                           <p className="font-mono text-[10px] text-amber-600 mt-0.5">{row.grn_no}</p>
//                         )}
//                       </td>
//                       <td className="px-3 py-3 whitespace-nowrap">
//                         <SourceBadge source={row.source} vendorName={row.vendor_name} grnNo={row.grn_no} />
//                       </td>
//                       <td className="px-3 py-3 whitespace-nowrap text-slate-600 text-xs">{row.division   || <span className="text-slate-300">—</span>}</td>
//                       <td className="px-3 py-3 whitespace-nowrap text-slate-600 text-xs">{row.section    || <span className="text-slate-300">—</span>}</td>
//                       <td className="px-3 py-3 whitespace-nowrap text-slate-600 text-xs">{row.department || <span className="text-slate-300">—</span>}</td>
//                       <td className="px-3 py-3 whitespace-nowrap">
//                         {hasVariant ? <VariantBadge size={size} color={color} /> : <span className="text-slate-300 text-xs">—</span>}
//                       </td>
//                       <td className="px-3 py-3 text-right font-bold whitespace-nowrap tabular-nums"
//                         style={{ color:(row.qty||0)<=0?"#EF4444":(row.qty||0)<=20?"#D97706":"#0F172A" }}>
//                         {(row.qty||0).toLocaleString()}
//                       </td>
//                       <td className="px-3 py-3 text-right text-slate-500 text-xs whitespace-nowrap tabular-nums">
//                         {row.rate > 0 ? `₹${row.rate.toLocaleString("en-IN",{minimumFractionDigits:2})}` : <span className="text-slate-300">—</span>}
//                       </td>
//                       <td className="px-3 py-3 text-right text-xs font-semibold whitespace-nowrap tabular-nums" style={{ color:rowValue>0?"#6366F1":"#CBD5E1" }}>
//                         {rowValue > 0 ? `₹${rowValue.toLocaleString("en-IN",{minimumFractionDigits:2})}` : "—"}
//                       </td>
//                       <td className="px-3 py-3 whitespace-nowrap"><StatusBadge status={row.status} /></td>
//                       <td className="px-3 py-3 text-right whitespace-nowrap">
//                         <div className="inline-flex items-center gap-1.5">
//                           <button type="button"
//                             className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all"
//                             onClick={() => setSelectedRow(row)}>
//                             View
//                           </button>
//                           <button type="button"
//                             className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 text-xs font-semibold hover:bg-rose-100 transition-all"
//                             onClick={() => setDeleteTarget({ barcode: row.barcode, product: row.product })}
//                             title="Remove from inventory">
//                             <FaTrashAlt style={{ fontSize:11 }} />
//                           </button>
//                         </div>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>

//               {filtered.length > 0 && (
//                 <tfoot className="border-t-2 border-slate-200 bg-slate-50 sticky bottom-0">
//                   <tr>
//                     <td colSpan={8} className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
//                       {filtered.length} items
//                       {vendorFilter && <span style={{ marginLeft:8, color:"#059669" }}>· {vendorFilter}</span>}
//                       {sourceFilter === "grn" && <span style={{ marginLeft:8, color:"#D97706" }}>· GRN Inward</span>}
//                     </td>
//                     <td className="px-3 py-3 text-right text-xs font-bold text-slate-700 tabular-nums">
//                       {filtered.reduce((s,r) => s+(r.qty||0), 0).toLocaleString()}
//                     </td>
//                     <td />
//                     <td className="px-3 py-3 text-right text-xs font-bold text-indigo-700 tabular-nums">
//                       ₹{totalValue.toLocaleString("en-IN",{minimumFractionDigits:2})}
//                     </td>
//                     <td colSpan={2} />
//                   </tr>
//                 </tfoot>
//               )}
//             </table>
//           </div>
//         </div>
//       </div>

//       {/* ── Split Product Modal ── */}
//       {splitRow && (
//         <SplitProductModal
//           row={splitRow}
//           onClose={() => setSplitRow(null)}
//           onDone={fetchData}
//         />
//       )}

//       {/* ── Inventory Product Form (Add / Edit) ── */}
//       {showForm && (
//         <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-50">
//           <InventoryProductForm
//             initialData={editProduct}
//             onSave={() => {
//               setShowForm(false);
//               setEditProduct(null);
//               fetchData();
//             }}
//             onCancel={() => {
//               setShowForm(false);
//               setEditProduct(null);
//             }}
//           />
//         </div>
//       )}
//     </>
//   );
// }

// function FilterSelect({ label, icon, value, onChange, options, disabled, placeholder }) {
//   return (
//     <div className="min-w-0">
//       <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
//       <div className={`relative flex items-center gap-2 rounded-xl px-3 border transition-all ${disabled?"bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed":"bg-slate-50 border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100"}`}>
//         {icon}
//         <select className="bg-transparent outline-none py-2 w-full text-sm min-w-0 appearance-none pr-6"
//           value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
//           <option value="">{placeholder || `All ${label}s`}</option>
//           {(options||[]).map(o => <option key={o} value={o}>{o}</option>)}
//         </select>
//         <FaChevronDown className="absolute right-3 text-slate-400 text-xs pointer-events-none" />
//       </div>
//     </div>
//   );
// }


import React, { useEffect, useState, useCallback } from "react";
import {
  FaFilter, FaSearch, FaBoxes, FaLayerGroup, FaBuilding,
  FaSyncAlt, FaChevronDown, FaWarehouse, FaTimes, FaTag,
  FaStore, FaUserTie, FaTrashAlt, FaClipboardList, FaEdit,
  FaPrint, FaExclamationTriangle, FaPlus,
} from "react-icons/fa";
import QuickFillPanel from "../Quickfillpanel";
import BarcodeStickerPrint from "../Barcodestickerprint.jsx";
import ReactDOM from "react-dom";
import InventoryProductForm from "./Inventoryproductform.jsx";
import SplitProductModal from "./Splitproductmodal.jsx";

const API = APP_API_URL;

// ── Shared auth token lookup — keeps the same fallback order used
// elsewhere in this app (admin_token → access_token → token) so this
// component matches how the rest of the authenticated pages resolve it.
function getAdminToken() {
  return (
    localStorage.getItem("admin_token")  ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")        ||
    ""
  );
}

// ── Barcode helpers ───────────────────────────────────────────────────────────
// A row "needs a barcode" when it has no scannable code yet, or only a GRN blob
// code (ITEM/…, WALKIN/…, or anything with a slash). FMCG products that already
// carry a real 8-13 digit manufacturer barcode are considered done.
function isRealManufacturerBarcode(bc = "") {
  const s = (bc || "").trim();
  return /^\d{8,13}$/.test(s);
}
function isBlobBarcode(bc = "") {
  const s = (bc || "").trim();
  return !s || s.startsWith("ITEM/") || s.startsWith("WALKIN/") || s.includes("/");
}
function rowNeedsBarcode(row) {
  const bc = (row.barcode || "").trim();
  if (isRealManufacturerBarcode(bc)) return false; // real FMCG/EAN code — leave it
  return isBlobBarcode(bc);
}

async function callGenerateBarcode(productId) {
  const token = getAdminToken();
  return fetch(`${API}/inventory/products/generate-barcode/${encodeURIComponent(productId)}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

// ── Colour helpers ────────────────────────────────────────────────────────────
const colourLabel = (raw = "") => {
  if (!raw) return null;
  const cleaned = raw.replace(/^#/, "").trim();
  return /^[0-9A-Fa-f]{3,6}$/.test(cleaned) ? `#${cleaned}` : cleaned;
};
const swatchBg = (raw = "") => {
  const cleaned = raw.replace(/^#/, "").trim();
  return /^[0-9A-Fa-f]{3,6}$/.test(cleaned) ? `#${cleaned}` : raw;
};

function parseVariantLabel(productLabel = "") {
  const parts = productLabel.split(" | ");
  const base  = parts[0] || productLabel;
  const size  = parts.length === 3 ? parts[1] : null;
  const color = parts.length >= 2 ? parts[parts.length - 1] : null;
  const isColour = color && (/^#?[0-9A-Fa-f]{3,6}$/.test(color) || /^[A-Za-z\s]+$/.test(color));
  return { base, size, color: isColour ? color : null };
}

function VariantBadge({ size, color }) {
  if (!size && !color) return null;
  const label = colourLabel(color);
  const bg    = color ? swatchBg(color) : null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 whitespace-nowrap">
      {size && <span className="font-semibold text-indigo-700">{size}</span>}
      {size && color && <span className="text-slate-300">|</span>}
      {color && (
        <>
          <span className="inline-block w-3 h-3 rounded-sm border border-slate-300 shrink-0" style={{ background: bg }} />
          <span>{label}</span>
        </>
      )}
    </span>
  );
}

function SourceBadge({ source, vendorName, grnNo }) {
  if (source === "grn") return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700, background:"#FFFBEB", color:"#D97706", border:"1px solid #FDE68A", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={grnNo || "GRN Inward"}>
      <FaClipboardList style={{ fontSize:9, flexShrink:0 }} />
      {grnNo ? `GRN · ${grnNo.split("/")[1] || grnNo}` : "GRN Inward"}
    </span>
  );
  if (source === "vendor") return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700, background:"#ECFDF5", color:"#059669", border:"1px solid #A7F3D0", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={vendorName}>
      <FaUserTie style={{ fontSize:9, flexShrink:0 }} />
      {vendorName || "Vendor"}
    </span>
  );
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700, background:"#EEF2FF", color:"#6366F1", border:"1px solid #C7D2FE" }}>
      <FaStore style={{ fontSize:9, flexShrink:0 }} /> Admin
    </span>
  );
}

function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${status.cls}`}>
      {status.label}
    </span>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({ barcode, productName, onConfirm, onCancel }) {
  if (!barcode) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:10000, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(2px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onCancel}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:400, padding:"28px 28px 24px", boxShadow:"0 24px 64px rgba(0,0,0,0.2)", border:"1px solid #e2e8f0" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:"#FEF2F2", border:"1px solid #FECACA", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <FaTrashAlt style={{ color:"#DC2626", fontSize:16 }} />
          </div>
          <div>
            <p style={{ fontWeight:700, fontSize:15, color:"#0f172a", margin:0 }}>Delete from Inventory?</p>
            <p style={{ fontSize:12, color:"#64748b", margin:"2px 0 0" }}>This cannot be undone</p>
          </div>
        </div>
        <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px", marginBottom:20, border:"1px solid #f1f5f9" }}>
          <p style={{ fontSize:14, fontWeight:600, color:"#1e293b", margin:0 }}>{productName}</p>
          <p style={{ fontSize:11, color:"#94a3b8", fontFamily:"monospace", margin:"3px 0 0" }}>{barcode}</p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onCancel} style={{ flex:1, padding:"9px 0", borderRadius:10, border:"1px solid #e2e8f0", background:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", color:"#374151" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex:1, padding:"9px 0", borderRadius:10, border:"none", background:"#DC2626", fontSize:13, fontWeight:700, cursor:"pointer", color:"#fff" }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Product Detail Modal — now with Fix + Print Stickers ─────────────────────
function ProductDetailModal({ row, onClose, onSaved, setShowForm, setEditProduct, setSplitRow, onGenerateBarcode }) {
  const [visible,    setVisible]    = useState(false);
  const [tab,        setTab]        = useState("details");
  const [printOpen,  setPrintOpen]  = useState(false);
  const [product,    setProduct]    = useState(null);  // full product from API
  const [loadingProd,setLoadingProd]= useState(false);

  useEffect(() => {
    if (!row) return;
    const t = setTimeout(() => setVisible(true), 10);
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [row, onClose]);

  // Fetch full product record for QuickFillPanel + sticker data
  useEffect(() => {
    if (!row?.barcode) return;
    setLoadingProd(true);
    const token = getAdminToken();
    fetch(`${API}/inventory/diagnose/${encodeURIComponent(row.barcode)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => {
        setProduct({
          product_name: row.product || row.barcode,
          barcode:      row.barcode,
          sku:          row.sku || "",
          division:     row.division || "",
          section:      row.section  || "",
          department:   row.department || "",
          hsn_code:     row.hsn_code || "",
          source:       row.source || "admin",
          vendor_name:  row.vendor_name || "",
          grn_no:       row.grn_no || "",
          has_variants: false,
          mrp:          row.rate || 0,
          selling_price:row.rate || 0,
          cost_price:   row.rate || 0,
          quantity:     row.qty  || 0,
        });
      })
      .catch(() => {
        setProduct({
          product_name: row.product || row.barcode,
          barcode:      row.barcode,
          sku:          row.sku || "",
          division:     row.division || "",
          section:      row.section  || "",
          department:   row.department || "",
          hsn_code:     row.hsn_code || "",
          source:       row.source || "admin",
          vendor_name:  row.vendor_name || "",
          grn_no:       row.grn_no || "",
          has_variants: false,
          quantity:     row.qty || 0,
        });
      })
      .finally(() => setLoadingProd(false));
  }, [row?.barcode]);

  if (!row) return null;

  const { base, size, color } = parseVariantLabel(row.product || "");
  const bg         = color ? swatchBg(color) : null;
  const colorLabel = color ? colourLabel(color) : null;
  const qtyColor   = (row.qty||0) <= 0 ? "#EF4444" : (row.qty||0) <= 20 ? "#D97706" : "#059669";
  const rowValue   = (row.qty||0) * (row.rate||0);

  const isMissingFields =
    !row.division || !row.section || !row.department || !row.hsn_code || !row.sku;

  const needsBarcode = rowNeedsBarcode(row);

  const stickerItems = [{
    barcode:    row.barcode,
    name:       row.product || row.barcode,
    sku:        row.sku || "",
    rate:       row.rate || 0,
    division:   row.division || "",
    size_label: size || "",
    color:      color || "",
  }];

  const TABS = [
    { key: "details", label: "Details" },
    ...(isMissingFields ? [{ key: "fix", label: `Fix Fields` }] : []),
  ];

  const modal = (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:99998, background:"rgba(10,14,22,0.65)", backdropFilter:"blur(8px)", transition:"opacity .22s ease", opacity: visible ? 1 : 0 }} />

      <div onClick={e => e.stopPropagation()} style={{
        position:"fixed", top:"50%", left:"50%",
        transform: visible ? "translate(-50%,-50%) scale(1)" : "translate(-50%,-48%) scale(0.96)",
        zIndex:99999,
        width:"calc(100vw - 40px)", maxWidth:780,
        maxHeight:"90vh",
        display:"flex", flexDirection:"column",
        borderRadius:20, background:"#fff",
        border:"1px solid #E8ECF4",
        boxShadow:"0 32px 80px rgba(10,14,22,0.28)",
        overflow:"hidden",
        transition:"transform .28s cubic-bezier(.16,1,.3,1), opacity .22s ease",
        opacity: visible ? 1 : 0,
      }}>

        {/* ── Header ── */}
        <div style={{ flexShrink:0, padding:"18px 22px 0", borderBottom:"1px solid #F1F5F9", background:"linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%)" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:14 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:800, fontSize:17, color:"#0E1117", lineHeight:1.3, marginBottom:6, wordBreak:"break-word" }}>
                {base}
                {isMissingFields && (
                  <span style={{ marginLeft:8, padding:"2px 8px", borderRadius:20, background:"#FFFBEB", border:"1px solid #FDE68A", color:"#D97706", fontSize:10, fontWeight:700, verticalAlign:"middle" }}>
                    ⚠ Incomplete
                  </span>
                )}
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
                {row.sku && (
                  <span style={{ fontFamily:"monospace", fontSize:11, color:"#6366f1", background:"#EEEFFE", border:"1px solid #C5C8F8", borderRadius:6, padding:"2px 8px" }}>{row.sku}</span>
                )}
                <span style={{ fontFamily:"monospace", fontSize:11, color:"#4A5168", background:"#F1F5F9", border:"1px solid #E2E8F0", borderRadius:6, padding:"2px 8px" }}>{row.barcode}</span>
                <SourceBadge source={row.source} vendorName={row.vendor_name} grnNo={row.grn_no} />
                {(size || color) && (
                  <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:6, background:"#f8fafc", border:"1px solid #e2e8f0", fontSize:12, color:"#475569" }}>
                    {size && <span style={{ fontWeight:700, color:"#6366f1" }}>{size}</span>}
                    {size && color && <span style={{ color:"#cbd5e1" }}>|</span>}
                    {color && <><span style={{ width:12, height:12, borderRadius:3, background:bg, border:"1px solid #e2e8f0", display:"inline-block" }} /><span>{colorLabel}</span></>}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} style={{ flexShrink:0, width:32, height:32, borderRadius:8, border:"1px solid #E8ECF4", background:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#8C93AB" }}>
              <FaTimes />
            </button>
          </div>

          {/* Tabs + Print button */}
          <div style={{ display:"flex", alignItems:"flex-end" }}>
            {TABS.map(({ key, label }) => {
              const isActive = tab === key;
              const isFix    = key === "fix";
              return (
                <button key={key} onClick={() => setTab(key)} style={{
                  padding:"9px 20px", border:"none", cursor:"pointer",
                  fontSize:12, fontWeight:700, borderRadius:"8px 8px 0 0", transition:"all .15s",
                  background: isActive ? (isFix ? "#FFFBEB" : "#EEF2FF") : "transparent",
                  color:      isActive ? (isFix ? "#D97706" : "#6366F1") : "#94a3b8",
                  borderBottom: isActive ? `2px solid ${isFix ? "#D97706" : "#6366F1"}` : "2px solid transparent",
                  marginBottom: -1,
                }}>{label}</button>
              );
            })}

            {/* Print Stickers button */}
            <button
              onClick={() => setPrintOpen(true)}
              style={{
                marginLeft:"auto", marginBottom:-1,
                padding:"7px 16px", border:"none", cursor:"pointer",
                fontSize:12, fontWeight:700, borderRadius:"8px 8px 0 0",
                background:"#FEF3C7", color:"#D97706",
                borderBottom:"2px solid #F59E0B",
                display:"flex", alignItems:"center", gap:6,
              }}
            >
              🏷️ Print Stickers
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:"20px 22px 24px" }}>

          {/* FIX TAB */}
          {tab === "fix" && (
            <div>
              {/* Missing fields warning */}
              <div style={{ marginBottom:16, padding:"14px 18px", borderRadius:12, background:"#FFFBEB", border:"1px solid #FDE68A", display:"flex", alignItems:"flex-start", gap:12 }}>
                <FaExclamationTriangle style={{ color:"#D97706", fontSize:18, flexShrink:0, marginTop:2 }} />
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#78350F", marginBottom:4 }}>
                    Missing: {[!row.division && "Division", !row.section && "Section", !row.department && "Department", !row.hsn_code && "HSN Code", !row.sku && "SKU"].filter(Boolean).join(", ")}
                  </div>
                  <div style={{ fontSize:12, color:"#92400E" }}>
                    Complete these fields so this item appears correctly in reports and filters.
                  </div>
                </div>
              </div>

              {/* GRN source note */}
              {row.source === "grn" && (
                <div style={{ marginBottom:14, padding:"10px 14px", borderRadius:10, background:"#F0F9FF", border:"1px solid #BAE6FD", fontSize:12, color:"#0369A1", fontWeight:600 }}>
                  📋 Auto-created from GRN {row.grn_no || ""} — complete classification below
                </div>
              )}

              {/* SPLIT into styles — fastest way when pattern/size differ per batch */}
              <button
                onClick={() => {
                  onClose();
                  setSplitRow(row);
                }}
                style={{
                  width:"100%", padding:"14px 18px", marginBottom:10,
                  borderRadius:14, border:"2px solid #6366f1", cursor:"pointer",
                  background:"#EEF2FF",
                  display:"flex", alignItems:"center", gap:10,
                  transition:"opacity .15s",
                }}>
                <span style={{ fontSize:20 }}>✂️</span>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:13, fontWeight:800, color:"#4338CA" }}>Split into Styles (Fastest)</div>
                  <div style={{ fontSize:11, color:"#6366F1", marginTop:2 }}>
                    Plain / Polka Dots / Printed — define all styles in one screen
                  </div>
                </div>
              </button>

              {/* OR label */}
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <div style={{ flex:1, height:1, background:"#e2e8f0" }}/>
                <span style={{ fontSize:11, color:"#94a3b8", fontWeight:600 }}>OR — same pattern, just fix fields</span>
                <div style={{ flex:1, height:1, background:"#e2e8f0" }}/>
              </div>

              {/* Complete Product Details → opens InventoryProductForm */}
              <button
                onClick={() => {
                  onClose();
                  setEditProduct({
                    id:          row.id || row._id || "",
                    barcode:     row.barcode || "",
                    description: row.product || "",
                    rate:        row.rate || 0,
                    mrp:         row.mrp  || 0,
                    stockQty:    row.qty  || 0,
                    division:    row.division   || "",
                    department:  row.department || "",
                    section:     row.section    || "",
                    sku:         row.sku        || "",
                    product_type: row.product_type || "garment",
                    category1:   row.category1  || "",
                    category2:   row.category2  || "",
                    category3:   row.category3  || "",
                    category4:   row.category4  || "",
                    category5:   row.category5  || "",
                    category6:   row.category6  || "",
                    grn_date:    row.grn_date   || "",
                    has_variants: row.has_variants || false,
                    variants:    row.variants   || [],
                  });
                  setShowForm(true);
                }}
                style={{
                  width:"100%", padding:"14px 18px",
                  borderRadius:14, border:"none", cursor:"pointer",
                  background:"linear-gradient(135deg,#6366f1,#4f46e5)",
                  display:"flex", alignItems:"center", gap:10,
                  transition:"opacity .15s",
                }}
                onMouseEnter={e => e.currentTarget.style.opacity="0.9"}
                onMouseLeave={e => e.currentTarget.style.opacity="1"}
              >
                <FaEdit style={{ color:"#fff", fontSize:14 }} />
                <span style={{ fontSize:13, fontWeight:700, color:"#fff" }}>Complete Product Details</span>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginLeft:"auto" }}>{row.product}</span>
              </button>
            </div>
          )}

          {/* DETAILS TAB */}
          {tab === "details" && (
            <>
              {/* GRN / Vendor strip */}
              {row.source === "grn" && (
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", background:"#FFFBEB", borderRadius:10, border:"1px solid #FDE68A", marginBottom:18 }}>
                  <FaClipboardList style={{ color:"#D97706", fontSize:18, flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:10, color:"#92400E", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px" }}>Added via GRN Inward</div>
                    <div style={{ fontSize:14, fontWeight:700, color:"#78350F", marginTop:1 }}>{row.grn_no || "—"}{row.vendor_name ? ` · ${row.vendor_name}` : ""}</div>
                  </div>
                </div>
              )}
              {row.source === "vendor" && row.vendor_name && (
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", background:"#F0FDF4", borderRadius:10, border:"1px solid #BBF7D0", marginBottom:18 }}>
                  <FaUserTie style={{ color:"#16A34A", fontSize:18, flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:10, color:"#86EFAC", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px" }}>Supplied by Vendor</div>
                    <div style={{ fontSize:14, fontWeight:700, color:"#15803D", marginTop:1 }}>{row.vendor_name}</div>
                  </div>
                </div>
              )}

              {/* Barcode-needed strip (garment purchased from vendor, no scannable code yet) */}
              {needsBarcode && (
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", background:"#FEF3C7", borderRadius:10, border:"1px solid #FDE68A", marginBottom:18 }}>
                  <FaTag style={{ color:"#D97706", fontSize:16, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, color:"#92400E", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px" }}>No scannable barcode</div>
                    <div style={{ fontSize:12, fontWeight:600, color:"#78350F", marginTop:1 }}>Generate a barcode before printing stickers / selling.</div>
                  </div>
                  {(row.id || row._id) ? (
                    <button
                      onClick={() => { onGenerateBarcode(row); }}
                      style={{ padding:"7px 14px", borderRadius:8, border:"none", background:"#D97706", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                      Generate
                    </button>
                  ) : (
                    <button
                      onClick={() => { onClose(); setSplitRow(row); }}
                      style={{ padding:"7px 14px", borderRadius:8, border:"1px solid #D97706", background:"#fff", color:"#D97706", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                      Split first
                    </button>
                  )}
                </div>
              )}

              {/* Classification */}
              <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:10 }}>Classification</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:18 }}>
                {[
                  { label:"Division",   value:row.division },
                  { label:"Section",    value:row.section  },
                  { label:"Department", value:row.department },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: value ? "#F8FAFC" : "#FFF7ED", borderRadius:10, padding:"10px 14px", border: value ? "1px solid #F1F5F9" : "1px solid #FED7AA" }}>
                    <div style={{ fontSize:9, color:"#94a3b8", marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px" }}>{label}</div>
                    <div style={{ fontSize:13, fontWeight:700, color: value ? "#1e293b" : "#D97706" }}>{value || "—"}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:18 }}>
                {[
                  { label:"HSN Code", value:row.hsn_code },
                  { label:"SKU",      value:row.sku, mono:true },
                  { label:"Source",   value:row.source || "admin" },
                ].map(({ label, value, mono }) => (
                  <div key={label} style={{ background:"#F8FAFC", borderRadius:10, padding:"10px 14px", border:"1px solid #F1F5F9" }}>
                    <div style={{ fontSize:9, color:"#94a3b8", marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px" }}>{label}</div>
                    <div style={{ fontSize:13, fontWeight:700, color: value ? "#1e293b" : "#cbd5e1", fontFamily: mono ? "monospace" : "inherit" }}>{value || "—"}</div>
                  </div>
                ))}
              </div>

              {/* Stock & Pricing */}
              <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:10 }}>Stock & Pricing</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                <div style={{ background:"#f8fafc", borderRadius:10, padding:"16px 12px", textAlign:"center", border:"1px solid #f1f5f9" }}>
                  <div style={{ fontSize:28, fontWeight:800, color:qtyColor, lineHeight:1.1 }}>{(row.qty||0).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:"#94a3b8", marginTop:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px" }}>Qty in Stock</div>
                </div>
                <div style={{ background:"#f8fafc", borderRadius:10, padding:"16px 12px", textAlign:"center", border:"1px solid #f1f5f9" }}>
                  <div style={{ fontSize: row.rate > 0 ? 20 : 26, fontWeight:800, color:"#d97706", lineHeight:1.1 }}>
                    {row.rate > 0 ? `₹${row.rate.toLocaleString("en-IN", {minimumFractionDigits:2})}` : "—"}
                  </div>
                  <div style={{ fontSize:10, color:"#94a3b8", marginTop:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px" }}>Rate</div>
                </div>
                <div style={{ background: rowValue > 0 ? "#eef2ff" : "#f8fafc", borderRadius:10, padding:"16px 12px", textAlign:"center", border: rowValue > 0 ? "1px solid #c7d2fe" : "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: rowValue > 0 ? 18 : 26, fontWeight:800, color: rowValue > 0 ? "#6366f1" : "#cbd5e1", lineHeight:1.1 }}>
                    {rowValue > 0 ? `₹${rowValue.toLocaleString("en-IN", {minimumFractionDigits:2})}` : "—"}
                  </div>
                  <div style={{ fontSize:10, color:"#94a3b8", marginTop:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px" }}>Stock Value</div>
                </div>
              </div>

              {row.status && (
                <div style={{ marginTop:14 }}>
                  <StatusBadge status={row.status} />
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ flexShrink:0, padding:"12px 22px", borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fafafa" }}>
          <div style={{ display:"flex", gap:8 }}>
            {isMissingFields && tab !== "fix" && (
              <button
                onClick={() => setTab("fix")}
                style={{ padding:"7px 16px", borderRadius:8, border:"1px solid #FDE68A", background:"#FFFBEB", fontSize:12, fontWeight:700, cursor:"pointer", color:"#D97706", display:"flex", alignItems:"center", gap:6 }}
              >
                <FaEdit size={11} /> Fix Fields
              </button>
            )}
            <button
              onClick={() => setPrintOpen(true)}
              style={{ padding:"7px 16px", borderRadius:8, border:"1px solid #FDE68A", background:"#FEF3C7", fontSize:12, fontWeight:700, cursor:"pointer", color:"#D97706", display:"flex", alignItems:"center", gap:6 }}
            >
              🏷️ Print Sticker
            </button>
          </div>
          <button onClick={onClose} style={{ padding:"8px 22px", borderRadius:8, border:"1px solid #e2e8f0", background:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", color:"#374151" }}>
            Close
          </button>
        </div>
      </div>

      {/* Sticker Print Modal */}
      {printOpen && (
        <BarcodeStickerPrint
          items={stickerItems}
          onClose={() => setPrintOpen(false)}
          storeName=""
        />
      )}
    </>
  );

  return ReactDOM.createPortal(modal, document.body);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function InventoryCurrentStockList() {
  const [division,     setDivision]     = useState("");
  const [section,      setSection]      = useState("");
  const [department,   setDepartment]   = useState("");
  const [search,       setSearch]       = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [selectedRow,  setSelectedRow]  = useState(null);
  const [showForm,     setShowForm]     = useState(false);
  const [splitRow,     setSplitRow]     = useState(null);
  const [editProduct,  setEditProduct]  = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [genBarcodeFor,setGenBarcodeFor]= useState(null); // barcode string currently generating

  const [divisions,   setDivisions]   = useState([]);
  const [sections,    setSections]    = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sectionMap,  setSectionMap]  = useState({});
  const [deptMap,     setDeptMap]     = useState({});
  const [metaLoading, setMetaLoading] = useState(true);

  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const fetchMeta = async () => {
      setMetaLoading(true);
      try {
        const token = getAdminToken();
        const res = await fetch(`${API}/inventory/products/?limit=1000`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        const products = json.data || [];
        const divSet = new Set();
        const secMap = {};
        const deptMapLocal = {};
        for (const p of products) {
          const d = p.division || "", s = p.section || "", dp = p.department || "";
          if (d) { divSet.add(d); if (!secMap[d]) secMap[d] = new Set(); if (s) secMap[d].add(s); }
          if (s) { if (!deptMapLocal[s]) deptMapLocal[s] = new Set(); if (dp) deptMapLocal[s].add(dp); }
        }
        setDivisions([...divSet].sort());
        setSectionMap(Object.fromEntries(Object.entries(secMap).map(([k,v])=>[k,[...v].sort()])));
        setDeptMap(Object.fromEntries(Object.entries(deptMapLocal).map(([k,v])=>[k,[...v].sort()])));
      } catch { setError("Could not load filter options."); }
      finally { setMetaLoading(false); }
    };
    fetchMeta();
  }, []);

  useEffect(() => { setSections(division && sectionMap[division] ? sectionMap[division] : []); setSection(""); setDepartment(""); }, [division, sectionMap]);
  useEffect(() => { setDepartments(section && deptMap[section] ? deptMap[section] : []); setDepartment(""); }, [section, deptMap]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (division)   params.append("division",   division);
      if (section)    params.append("section",    section);
      if (department) params.append("department", department);
      if (search)     params.append("search",     search);

      const token = getAdminToken();
      const res = await fetch(`${API}/inventory/current-stock?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData((json.data || []).map(r => ({ ...r, /* unchanged */ })));
    } catch { setError("Could not load stock data."); }
    finally { setLoading(false); }
  }, [division, section, department, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API}/inventory/delete/${encodeURIComponent(deleteTarget.barcode)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const err = await res.json().catch(()=>({})); alert(`❌ Delete failed: ${err.detail || res.status}`); return; }
      setDeleteTarget(null);
      fetchData();
    } catch { alert("❌ Network error."); }
    finally { setDeleting(false); }
  };

  // ── Smart edit routing: incomplete rows → Split; complete rows → full form ──
  // const handleEdit = (row) => {
  //   const isMissing =
  //     !row.division || !row.section || !row.department || !row.hsn_code || !row.sku;
  //   if (isMissing) {
  //     setSplitRow(row);
  //   } else {
  //     setEditProduct({
  //       id:           row.id || row._id || "",
  //       barcode:      row.barcode || "",
  //       description:  row.product || "",
  //       rate:         row.rate || 0,
  //       mrp:          row.mrp  || 0,
  //       stockQty:     row.qty  || 0,
  //       division:     row.division   || "",
  //       department:   row.department || "",
  //       section:      row.section    || "",
  //       sku:          row.sku        || "",
  //       product_type: row.product_type || "garment",
  //       hsn_code:     row.hsn_code    || "",
  //       category1:    row.category1   || "",
  //       category2:    row.category2   || "",
  //       category3:    row.category3   || "",
  //       category4:    row.category4   || "",
  //       category5:    row.category5   || "",
  //       category6:    row.category6   || "",
  //       has_variants: row.has_variants || false,
  //       variants:     row.variants     || [],
  //     });
  //     setShowForm(true);
  //   }
  // };
    const handleEdit = async (row) => {
  try {
    setError(null);

    const token = getAdminToken();

    if (!token) {
      throw new Error("Session expired. Please log in again.");
    }

    const res = await fetch(
      `${API}/inventory/products/barcode/${encodeURIComponent(row.barcode)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      throw new Error("Session expired. Please log in again.");
    }

    if (!res.ok) {
      throw new Error(json.detail || "Could not load product details.");
    }

    const product = json.data;

    setEditProduct({
      ...product,

      // Convert backend field names into InventoryProductForm field names
      id: product.id,
      description: product.product_name || "",
      rate: product.cost_price || 0,
      stockQty: product.stockQty ?? product.quantity ?? 0,

      category1: product.category1 || "",
      category2: product.category2 || "",
      category3: product.category3 || "",
      category4: product.category4 || "",
      category5: product.category5 || "",
      category6: product.category6 || "",

      product_type: product.product_type || "garment",
      has_variants: Boolean(product.has_variants),
      variants: product.variants || [],
    });

    setShowForm(true);
  } catch (error) {
    setError(error.message || "Could not open product.");
  }
};
  // ── Generate barcode for a garment row (needs a real product_id) ──
  const handleGenerateBarcode = async (row) => {
    const pid = row.id || row._id;
    if (!pid) {
      // No product_collection record (pure GRN blob) — must split into real products first.
      setSelectedRow(null);
      setSplitRow(row);
      return;
    }
    setGenBarcodeFor(row.barcode);
    try {
      const res  = await callGenerateBarcode(pid);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`❌ Barcode generation failed: ${data.detail || res.status}`);
        return;
      }
      alert(`✅ ${data.message || "Barcodes generated."}\nMaster: ${data.barcode || "—"}`);
      setSelectedRow(null);
      fetchData();
    } catch {
      alert("❌ Network error while generating barcode.");
    } finally {
      setGenBarcodeFor(null);
    }
  };

  const vendorNames = React.useMemo(() => {
    const names = new Set(data.filter(r => r.source === "vendor" && r.vendor_name).map(r => r.vendor_name));
    return [...names].sort();
  }, [data]);

  const sourceCounts = React.useMemo(() => ({
    all:    data.length,
    admin:  data.filter(r => r.source === "admin").length,
    vendor: data.filter(r => r.source === "vendor").length,
    grn:    data.filter(r => r.source === "grn").length,
  }), [data]);

  const filtered = React.useMemo(() => {
    let rows = data;
    if (sourceFilter !== "all") rows = rows.filter(r => (r.source || "admin") === sourceFilter);
    if (vendorFilter) rows = rows.filter(r => r.vendor_name === vendorFilter);
    return rows;
  }, [data, sourceFilter, vendorFilter]);

  const inStock    = filtered.filter(r => r.status?.label === "In Stock").length;
  const lowStock   = filtered.filter(r => r.status?.label === "Low Stock").length;
  const outStock   = filtered.filter(r => r.status?.label === "Out of Stock").length;
  const totalValue = filtered.filter(r => (r.qty||0) > 0).reduce((s,r) => s + r.qty * r.rate, 0);

  const tabStyle = (key, activeColor) => ({
    padding:"6px 14px", fontSize:12, fontWeight:700, borderRadius:8,
    cursor:"pointer", border:"none", transition:"all .15s",
    background: sourceFilter === key ? activeColor : "#F1F5F9",
    color:      sourceFilter === key ? "#fff"       : "#64748B",
  });

  return (
    <>
      <ProductDetailModal
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onSaved={fetchData}
        setShowForm={setShowForm}
        setEditProduct={setEditProduct}
        setSplitRow={setSplitRow}
        onGenerateBarcode={handleGenerateBarcode}
      />
      <DeleteConfirmModal
        barcode={deleteTarget?.barcode}
        productName={deleteTarget?.product}
        onConfirm={handleDeleteConfirm}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      <div className="h-full min-h-0 overflow-hidden px-3 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl"><FaBoxes className="text-white text-lg" /></div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">Central Stock List</h1>
              <p className="text-xs text-slate-500">{filtered.length} items · Central Inventory (HQ)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm font-medium transition-colors disabled:opacity-50">
              <FaSyncAlt className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button onClick={() => { setEditProduct(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors shadow-sm">
              <FaPlus className="text-xs" /> Add Product
            </button>
          </div>
        </div>

        {error && (
          <div className="shrink-0 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        {/* KPI pills */}
        <div className="flex gap-2 flex-wrap shrink-0">
          {[
            { label:"In Stock",     count:inStock,  cls:"bg-emerald-50 text-emerald-700 border-emerald-200" },
            { label:"Low Stock",    count:lowStock, cls:"bg-amber-50 text-amber-700 border-amber-200" },
            { label:"Out of Stock", count:outStock, cls:"bg-rose-50 text-rose-700 border-rose-200" },
          ].map(p => (
            <span key={p.label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${p.cls}`}>
              <span className="text-base font-bold tabular-nums">{p.count}</span> {p.label}
            </span>
          ))}
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4, padding:"4px 12px", borderRadius:24, background:"#EEF2FF", border:"1px solid #C7D2FE", fontSize:12, fontWeight:700, color:"#4F46E5" }}>
            <FaWarehouse style={{ fontSize:11 }} />
            Stock Value: ₹{totalValue.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
        </div>

        {/* Source tabs */}
        <div className="flex gap-2 shrink-0 flex-wrap items-center">
          <span style={{ fontSize:11, color:"#94A3B8", fontWeight:700 }}>SOURCE</span>
          <button onClick={() => { setSourceFilter("all"); setVendorFilter(""); }}    style={tabStyle("all",    "#6366F1")}>All ({sourceCounts.all})</button>
          <button onClick={() => { setSourceFilter("admin"); setVendorFilter(""); }}  style={tabStyle("admin",  "#6366F1")}>Admin ({sourceCounts.admin})</button>
          <button onClick={() => { setSourceFilter("vendor"); }}                      style={tabStyle("vendor", "#059669")}>🏪 Vendor ({sourceCounts.vendor})</button>
          <button onClick={() => { setSourceFilter("grn"); setVendorFilter(""); }}    style={tabStyle("grn",    "#D97706")}>📋 GRN Inward ({sourceCounts.grn})</button>
          {sourceFilter === "vendor" && vendorNames.length > 0 && (
            <>
              <span style={{ fontSize:11, color:"#94A3B8", fontWeight:700, marginLeft:8 }}>VENDOR</span>
              <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
                <FaUserTie style={{ position:"absolute", left:10, color:"#059669", fontSize:11, pointerEvents:"none" }} />
                <select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)}
                  style={{ paddingLeft:28, paddingRight:28, paddingTop:6, paddingBottom:6, fontSize:12, fontWeight:700, borderRadius:8, border:"1px solid #A7F3D0", background:vendorFilter?"#ECFDF5":"#F0FDF4", color:vendorFilter?"#059669":"#6B7280", cursor:"pointer", appearance:"none", outline:"none" }}>
                  <option value="">All Vendors</option>
                  {vendorNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <FaChevronDown style={{ position:"absolute", right:10, color:"#94A3B8", fontSize:10, pointerEvents:"none" }} />
              </div>
              {vendorFilter && <button onClick={() => setVendorFilter("")} style={{ fontSize:11, color:"#94A3B8", background:"none", border:"none", cursor:"pointer", fontWeight:700 }}>✕ Clear</button>}
            </>
          )}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3 sm:p-4 rounded-2xl shadow-sm shrink-0 border border-slate-200">
          <FilterSelect icon={<FaLayerGroup className="text-slate-500 text-xs" />} label="Division"   value={division}   onChange={setDivision}   options={divisions}   disabled={metaLoading} placeholder={metaLoading?"Loading…":"All Divisions"} />
          <FilterSelect icon={<FaFilter className="text-slate-500 text-xs" />}    label="Section"    value={section}    onChange={setSection}    options={sections}    disabled={!division||sections.length===0} placeholder={division&&sections.length===0?"No sections":"All Sections"} />
          <FilterSelect icon={<FaBuilding className="text-slate-500 text-xs" />}  label="Department" value={department} onChange={setDepartment} options={departments} disabled={!section||departments.length===0} placeholder={section&&departments.length===0?"No departments":"All Departments"} />
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Search</label>
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <FaSearch className="text-slate-400 shrink-0 text-xs" />
              <input type="text" placeholder="Barcode / SKU / Product / Vendor / GRN"
                className="bg-transparent outline-none py-2 w-full text-sm"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm flex-1 min-h-0 overflow-hidden border border-slate-200">
          <div className="h-full overflow-auto">
            <table className="w-full text-sm min-w-[1320px]">
              <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  {[
                    { col:"Barcode", align:"left" }, { col:"SKU", align:"left" },
                    { col:"Product", align:"left" }, { col:"Added By", align:"left" },
                    { col:"Division", align:"left" }, { col:"Section", align:"left" },
                    { col:"Dept", align:"left" }, { col:"Variant", align:"left" },
                    { col:"Qty", align:"right" }, { col:"Rate", align:"right" },
                    { col:"Value", align:"right" }, { col:"Status", align:"left" },
                    { col:"Actions", align:"right" },
                  ].map(({ col, align }) => (
                    <th key={col} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ textAlign:align }}>{col}</th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={13} className="p-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <FaSyncAlt className="animate-spin text-xl text-indigo-400" />
                      <span className="text-sm">Loading stock data…</span>
                    </div>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={13} className="p-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <FaBoxes className="text-3xl opacity-30" />
                      <span className="text-sm">No stock found</span>
                    </div>
                  </td></tr>
                ) : filtered.map((row, i) => {
                  const { base, size, color } = parseVariantLabel(row.product || "");
                  const hasVariant = size || color;
                  const rowValue   = (row.qty||0) * (row.rate||0);
                  const isMissing  = !row.division || !row.section || !row.department || !row.hsn_code || !row.sku;
                  const needsBc    = rowNeedsBarcode(row);
                  const hasProductId = !!(row.id || row._id);
                  const generating = genBarcodeFor === row.barcode;
                  const rowBg      = row.source === "grn" ? "hover:bg-amber-50/40" : "hover:bg-indigo-50/40";

                  return (
                    <tr key={i} className={`transition-colors ${rowBg}`}>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{row.barcode}</td>
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">{row.sku || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 min-w-[180px] max-w-[260px]">
                        <span className="font-medium text-slate-800 leading-snug">{base}</span>
                        {isMissing && <span className="ml-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">⚠ Fix</span>}
                        {row.source === "grn" && row.grn_no && (
                          <p className="font-mono text-[10px] text-amber-600 mt-0.5">{row.grn_no}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <SourceBadge source={row.source} vendorName={row.vendor_name} grnNo={row.grn_no} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-slate-600 text-xs">{row.division   || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-slate-600 text-xs">{row.section    || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-slate-600 text-xs">{row.department || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {hasVariant ? <VariantBadge size={size} color={color} /> : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-bold whitespace-nowrap tabular-nums"
                        style={{ color:(row.qty||0)<=0?"#EF4444":(row.qty||0)<=20?"#D97706":"#0F172A" }}>
                        {(row.qty||0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-500 text-xs whitespace-nowrap tabular-nums">
                        {row.rate > 0 ? `₹${row.rate.toLocaleString("en-IN",{minimumFractionDigits:2})}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-semibold whitespace-nowrap tabular-nums" style={{ color:rowValue>0?"#6366F1":"#CBD5E1" }}>
                        {rowValue > 0 ? `₹${rowValue.toLocaleString("en-IN",{minimumFractionDigits:2})}` : "—"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap"><StatusBadge status={row.status} /></td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button type="button"
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all"
                            onClick={() => setSelectedRow(row)}>
                            View
                          </button>

                          <button type="button"
                            className="px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-all"
                            onClick={() => handleEdit(row)}
                            title={isMissing ? "Fix / split into styles" : "Edit product"}>
                            <FaEdit style={{ fontSize:11 }} />
                          </button>

                          {needsBc && (
                            <button type="button"
                              disabled={generating}
                              className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-600 text-xs font-semibold hover:bg-amber-100 transition-all disabled:opacity-50 inline-flex items-center gap-1"
                              onClick={() => handleGenerateBarcode(row)}
                              title={hasProductId ? "Generate barcode (garment)" : "Split into styles first, then barcodes are generated"}>
                              {generating
                                ? <FaSyncAlt className="animate-spin" style={{ fontSize:11 }} />
                                : <FaTag style={{ fontSize:11 }} />}
                            </button>
                          )}

                          <button type="button"
                            className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 text-xs font-semibold hover:bg-rose-100 transition-all"
                            onClick={() => setDeleteTarget({ barcode: row.barcode, product: row.product })}
                            title="Remove from inventory">
                            <FaTrashAlt style={{ fontSize:11 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {filtered.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 sticky bottom-0">
                  <tr>
                    <td colSpan={8} className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {filtered.length} items
                      {vendorFilter && <span style={{ marginLeft:8, color:"#059669" }}>· {vendorFilter}</span>}
                      {sourceFilter === "grn" && <span style={{ marginLeft:8, color:"#D97706" }}>· GRN Inward</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-slate-700 tabular-nums">
                      {filtered.reduce((s,r) => s+(r.qty||0), 0).toLocaleString()}
                    </td>
                    <td />
                    <td className="px-3 py-3 text-right text-xs font-bold text-indigo-700 tabular-nums">
                      ₹{totalValue.toLocaleString("en-IN",{minimumFractionDigits:2})}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* ── Split Product Modal ── */}
      {splitRow && (
        <SplitProductModal
          row={splitRow}
          onClose={() => setSplitRow(null)}
          onDone={fetchData}
        />
      )}

      {/* ── Inventory Product Form (Add / Edit) ── */}
      {showForm && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-50">
          <InventoryProductForm
            initialData={editProduct}
            onSave={() => {
              setShowForm(false);
              setEditProduct(null);
              fetchData();
            }}
            onCancel={() => {
              setShowForm(false);
              setEditProduct(null);
            }}
          />
        </div>
      )}
    </>
  );
}

function FilterSelect({ label, icon, value, onChange, options, disabled, placeholder }) {
  return (
    <div className="min-w-0">
      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
      <div className={`relative flex items-center gap-2 rounded-xl px-3 border transition-all ${disabled?"bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed":"bg-slate-50 border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100"}`}>
        {icon}
        <select className="bg-transparent outline-none py-2 w-full text-sm min-w-0 appearance-none pr-6"
          value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
          <option value="">{placeholder || `All ${label}s`}</option>
          {(options||[]).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <FaChevronDown className="absolute right-3 text-slate-400 text-xs pointer-events-none" />
      </div>
    </div>
  );
}
