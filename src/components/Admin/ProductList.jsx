import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


// import React, { useEffect, useState } from "react";
// import ReactDOM from "react-dom";
// import axios from "axios";
// import { useNavigate } from "react-router-dom";
// import QuickFillPanel from "../Quickfillpanel";

// const API_BASE = `${APP_API_URL}`;

// const getToken = () =>
//   localStorage.getItem("admin_token") || localStorage.getItem("token") || "";

// const calcMargin = (cp, sp) => {
//   const c = parseFloat(cp), s = parseFloat(sp);
//   if (!c || !s || c <= 0) return null;
//   return (((s - c) / c) * 100).toFixed(1);
// };

// function detectSource(p) {
//   if (p.source === "grn" || p.created_by === "GRN") return "grn";
//   if (p.source === "vendor") return "vendor";
//   if (!p.source && (p.vendor_name || p.vendor_id)) return "vendor";
//   return "admin";
// }

// /* ─── Design tokens ──────────────────────────────────────────────── */
// const T = {
//   bg:           "#FAFAFA",
//   surface:      "#FFFFFF",
//   surfaceHover: "#F5F7FF",
//   border:       "#E8ECF4",
//   brand:        "#5B5FEF",
//   brandDark:    "#4347CC",
//   brandLight:   "#EEEFFE",
//   brandBorder:  "#C5C8F8",
//   amber:        "#C97D00",
//   amberLight:   "#FEF8E7",
//   amberBorder:  "#F5D97A",
//   green:        "#0D9974",
//   greenLight:   "#E8FAF4",
//   greenBorder:  "#A0EDD4",
//   red:          "#D93025",
//   redLight:     "#FFF0EE",
//   redBorder:    "#FFCCC9",
//   blue:         "#1A6FDB",
//   blueLight:    "#EEF5FF",
//   blueBorder:   "#BFDBFE",
//   text:         "#0E1117",
//   textMid:      "#4A5168",
//   textMuted:    "#8C93AB",
//   white:        "#FFFFFF",
//   slate50:      "#F8FAFC",
//   slate100:     "#F1F5F9",
//   slate200:     "#E2E8F0",
// };

// /* ─── Micro components ───────────────────────────────────────────── */
// const Tag = ({ children, color = T.brand, bg = T.brandLight, border = T.brandBorder }) => (
//   <span style={{
//     display: "inline-flex", alignItems: "center",
//     padding: "2px 8px", borderRadius: 6,
//     background: bg, border: `1px solid ${border}`,
//     fontFamily: "monospace", fontSize: 11, fontWeight: 600, color,
//   }}>{children}</span>
// );

// const SectionHead = ({ children }) => (
//   <div style={{ marginTop: 22, marginBottom: 10 }}>
//     <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: T.brand }}>{children}</span>
//     <div style={{ height: 1, background: `linear-gradient(90deg, ${T.brandBorder}, transparent)`, marginTop: 5 }} />
//   </div>
// );

// const fmt = (n) => { const x = parseFloat(n); return isNaN(x) ? "—" : `₹${x.toFixed(2)}`; };

// function PriceCard({ label, value, accent }) {
//   return (
//     <div style={{ background: accent.bg, border: `1px solid ${accent.border}`, borderRadius: 10, padding: "12px 14px" }}>
//       <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", color: accent.muted, marginBottom: 5 }}>{label}</div>
//       <div style={{ fontFamily: "monospace", fontSize: 17, fontWeight: 800, color: accent.color }}>{fmt(value)}</div>
//     </div>
//   );
// }

// function SourceBadge({ source, compact = false }) {
//   const pad = compact ? "2px 7px" : "3px 11px";
//   const sz  = compact ? 10 : 11;
//   if (source === "grn")
//     return <span style={{ display: "inline-block", padding: pad, borderRadius: 20, background: T.amberLight, border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: sz, fontWeight: 700 }}>GRN</span>;
//   if (source === "vendor")
//     return <span style={{ display: "inline-block", padding: pad, borderRadius: 20, background: T.greenLight, border: `1px solid ${T.greenBorder}`, color: T.green, fontSize: sz, fontWeight: 700 }}>Vendor</span>;
//   return <span style={{ display: "inline-block", padding: pad, borderRadius: 20, background: T.brandLight, border: `1px solid ${T.brandBorder}`, color: T.brand, fontSize: sz, fontWeight: 700 }}>Admin</span>;
// }

// function MissingPill({ label }) {
//   return (
//     <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, background: T.amberLight, border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: 11, fontWeight: 600 }}>
//       <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.amber, flexShrink: 0 }} />
//       {label}
//     </span>
//   );
// }

// function VariantRow({ v, variantType }) {
//   const margin = calcMargin(v.cost_price, v.selling_price);
//   const mColor = margin === null ? T.textMuted : parseFloat(margin) < 0 ? T.red : parseFloat(margin) >= 20 ? T.green : T.amber;
//   return (
//     <tr style={{ borderBottom: `1px solid ${T.border}` }}
//       onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
//       onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
//       <td style={{ padding: "9px 12px" }}><Tag>{v.sku || "—"}</Tag></td>
//       <td style={{ padding: "9px 12px" }}><Tag color={T.textMid} bg={T.slate100} border={T.slate200}>{v.barcode || "—"}</Tag></td>
//       {variantType === "size_color" && <td style={{ padding: "9px 12px" }}><Tag>{v.size_label || "—"}</Tag></td>}
//       <td style={{ padding: "9px 12px" }}>
//         <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
//           <span style={{ width: 12, height: 12, borderRadius: 3, background: v.color || "#ccc", border: "1px solid rgba(0,0,0,0.12)", flexShrink: 0 }} />
//           <span style={{ fontSize: 11, color: T.textMid, fontFamily: "monospace" }}>{v.color || "—"}</span>
//         </div>
//       </td>
//       <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 12, color: T.textMid }}>{fmt(v.cost_price)}</td>
//       <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 12, color: T.brand, fontWeight: 600 }}>{fmt(v.mrp)}</td>
//       <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: parseFloat(v.selling_price) < parseFloat(v.cost_price) ? T.red : T.green }}>{fmt(v.selling_price)}</td>
//       <td style={{ padding: "9px 12px" }}>
//         {margin !== null
//           ? <span style={{ background: mColor + "18", border: `1px solid ${mColor}40`, borderRadius: 6, padding: "2px 7px", fontFamily: "monospace", fontSize: 11, color: mColor, fontWeight: 700 }}>{margin}%</span>
//           : <span style={{ color: T.border }}>—</span>}
//       </td>
//       <td style={{ padding: "9px 12px" }}>
//         <span style={{ background: T.blueLight, border: `1px solid ${T.blueBorder}`, borderRadius: 6, padding: "2px 7px", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: T.blue }}>{v.stock ?? 0}</span>
//       </td>
//       <td style={{ padding: "9px 12px", fontSize: 11, color: T.textMuted }}>{v.unit || "pcs"}</td>
//     </tr>
//   );
// }

// /* ─── ProductModal — rendered via portal to escape overflow:hidden ── */
// function ProductModal({ product, onClose, onSaved }) {
//   const [lightbox, setLightbox] = useState(null);
//   const [tab, setTab]           = useState("details");
//   const [visible, setVisible]   = useState(false);

//   /* Animate in after mount */
//   useEffect(() => {
//     const t = setTimeout(() => setVisible(true), 10);
//     return () => clearTimeout(t);
//   }, []);

//   /* Lock body scroll */
//   useEffect(() => {
//     const prev = document.body.style.overflow;
//     document.body.style.overflow = "hidden";
//     return () => { document.body.style.overflow = prev; };
//   }, []);

//   /* Escape key */
//   useEffect(() => {
//     const handler = (e) => { if (e.key === "Escape") onClose(); };
//     window.addEventListener("keydown", handler);
//     return () => window.removeEventListener("keydown", handler);
//   }, [onClose]);

//   const sku     = product.sku || product.base_sku || "—";
//   const barcode = product.barcode || product.base_barcode || "—";
//   const images  = product.images || [];
//   const source  = detectSource(product);

//   const getMissingFields = (p) => {
//     const effectiveSku = p.sku || p.base_sku || "";
//     const allFields = p.has_variants
//       ? ["division", "section", "department", "hsn_code"]
//       : ["division", "section", "department", "hsn_code", "sku", "mrp", "selling_price"];
//     const labels = { division: "Division", section: "Section", department: "Department", hsn_code: "HSN Code", sku: "SKU", mrp: "MRP", selling_price: "Selling Price" };
//     return allFields
//       .filter(f => { const v = f === "sku" ? effectiveSku : p[f]; return !v || v === 0; })
//       .map(f => labels[f]);
//   };

//   const missingFields = getMissingFields(product);
//   const incomplete    = missingFields.length > 0;
//   const tabs = [
//     { key: "details", label: "Details" },
//     ...(incomplete ? [{ key: "fill", label: `Fix (${missingFields.length})` }] : []),
//   ];

//   const margin = !product.has_variants ? calcMargin(product.cost_price, product.selling_price) : null;
//   const mColor = margin === null ? T.textMuted : parseFloat(margin) < 0 ? T.red : parseFloat(margin) >= 20 ? T.green : T.amber;

//   /* ── The actual UI ── */
//   const modal = (
//     <>
//       {/* Backdrop */}
//       <div
//         onClick={onClose}
//         style={{
//           position: "fixed", inset: 0, zIndex: 99998,
//           background: "rgba(10,14,22,0.65)",
//           backdropFilter: "blur(8px)",
//           WebkitBackdropFilter: "blur(8px)",
//           transition: "opacity .22s ease",
//           opacity: visible ? 1 : 0,
//         }}
//       />

//       {/* Dialog */}
//       <div
//         role="dialog"
//         aria-modal="true"
//         onClick={e => e.stopPropagation()}
//         style={{
//           position: "fixed",
//           top: "50%", left: "50%",
//           transform: visible
//             ? "translate(-50%, -50%) scale(1)"
//             : "translate(-50%, -48%) scale(0.96)",
//           zIndex: 99999,
//           width: "calc(100vw - 40px)",
//           maxWidth: 840,
//           maxHeight: "88vh",
//           display: "flex",
//           flexDirection: "column",
//           borderRadius: 20,
//           background: T.surface,
//           border: `1px solid ${T.border}`,
//           boxShadow: "0 32px 80px rgba(10,14,22,0.28), 0 6px 20px rgba(10,14,22,0.12)",
//           overflow: "hidden",
//           transition: "transform .28s cubic-bezier(.16,1,.3,1), opacity .22s ease",
//           opacity: visible ? 1 : 0,
//         }}
//       >
//         {/* ══ HEADER ══ */}
//         <div style={{
//           flexShrink: 0,
//           padding: "20px 24px 0",
//           borderBottom: `1px solid ${T.border}`,
//           background: T.surface,
//         }}>
//           <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
//             {/* Icon */}
//             <div style={{
//               flexShrink: 0, width: 44, height: 44, borderRadius: 12,
//               background: T.brandLight, border: `1px solid ${T.brandBorder}`,
//               display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
//             }}>📦</div>

//             {/* Name + tags */}
//             <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
//               <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 7 }}>
//                 <h2 style={{ fontSize: 16, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.3, wordBreak: "break-word" }}>
//                   {product.product_name}
//                 </h2>
//                 {incomplete && (
//                   <span style={{ padding: "2px 8px", borderRadius: 20, background: T.amberLight, border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: 10, fontWeight: 700 }}>⚠ Incomplete</span>
//                 )}
//               </div>
//               <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
//                 <Tag>{sku}</Tag>
//                 <Tag color={T.textMid} bg={T.slate100} border={T.slate200}>{barcode}</Tag>
//                 {product.has_variants && (
//                   <Tag>{product.variant_type === "color" ? "Color variants" : "Size + Color variants"}</Tag>
//                 )}
//                 <SourceBadge source={source} />
//               </div>
//             </div>

//             {/* Close */}
//             <button
//               onClick={onClose}
//               style={{
//                 flexShrink: 0, width: 32, height: 32, borderRadius: 8,
//                 border: `1px solid ${T.border}`, background: T.surface,
//                 cursor: "pointer", display: "flex", alignItems: "center",
//                 justifyContent: "center", fontSize: 15, color: T.textMuted,
//                 transition: "all .15s",
//               }}
//               onMouseEnter={e => { e.currentTarget.style.background = T.redLight; e.currentTarget.style.color = T.red; e.currentTarget.style.borderColor = T.redBorder; }}
//               onMouseLeave={e => { e.currentTarget.style.background = T.surface; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; }}
//             >✕</button>
//           </div>

//           {/* Tab bar */}
//           <div style={{ display: "flex" }}>
//             {tabs.map(({ key, label }) => {
//               const active = tab === key;
//               const isFill = key === "fill";
//               return (
//                 <button key={key} onClick={() => setTab(key)} style={{
//                   padding: "9px 20px", border: "none", cursor: "pointer",
//                   fontSize: 12, fontWeight: 700, borderRadius: "8px 8px 0 0",
//                   transition: "all .15s",
//                   background: active ? (isFill ? T.amberLight : T.brandLight) : "transparent",
//                   color: active ? (isFill ? T.amber : T.brand) : T.textMuted,
//                   borderBottom: active ? `2px solid ${isFill ? T.amber : T.brand}` : "2px solid transparent",
//                   marginBottom: -1,
//                 }}>{label}</button>
//               );
//             })}
//           </div>
//         </div>

//         {/* ══ BODY — scrollable ══ */}
//         <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "22px 24px 28px" }}>

//           {/* ── FILL TAB ── */}
//           {tab === "fill" && incomplete && (
//             <div>
//               <div style={{
//                 marginBottom: 18, padding: "14px 18px", borderRadius: 12,
//                 background: T.amberLight, border: `1px solid ${T.amberBorder}`,
//                 display: "flex", alignItems: "flex-start", gap: 12,
//               }}>
//                 <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
//                 <div>
//                   <div style={{ fontSize: 12, fontWeight: 700, color: "#78350F", marginBottom: 6 }}>
//                     {missingFields.length} field{missingFields.length !== 1 ? "s" : ""} need attention
//                   </div>
//                   <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
//                     {missingFields.map(f => <MissingPill key={f} label={f} />)}
//                   </div>
//                 </div>
//               </div>

//               {source === "grn" && (
//                 <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "#F0F9FF", border: "1px solid #BAE6FD", fontSize: 12, color: "#0369A1", fontWeight: 600 }}>
//                   📋 Auto-created from GRN {product.grn_no || ""} — complete classification below
//                 </div>
//               )}

//               <div style={{ borderRadius: 14, border: `1px solid ${T.border}`, overflow: "hidden" }}>
//                 <div style={{ padding: "12px 18px", background: `linear-gradient(135deg, ${T.brand}, ${T.brandDark})`, display: "flex", alignItems: "center", gap: 8 }}>
//                   <span style={{ fontSize: 14 }}>✏️</span>
//                   <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Complete Product Details</span>
//                   <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginLeft: "auto" }}>{product.product_name}</span>
//                 </div>
//                 <div style={{ padding: 18 }}>
//                   <QuickFillPanel product={product} onSaved={() => { onSaved && onSaved(); onClose(); }} />
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* ── DETAILS TAB ── */}
//           {tab === "details" && (
//             <>
//               {/* Source strip */}
//               {source === "grn" && (
//                 <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: T.amberLight, border: `1px solid ${T.amberBorder}` }}>
//                   <span style={{ fontSize: 20 }}>📋</span>
//                   <div>
//                     <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.amber, marginBottom: 2 }}>Added via GRN Inward</div>
//                     <div style={{ fontSize: 13, fontWeight: 700, color: "#78350F" }}>{product.grn_no || "—"}{product.vendor_name ? ` · ${product.vendor_name}` : ""}</div>
//                   </div>
//                 </div>
//               )}
//               {source === "vendor" && (
//                 <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: T.greenLight, border: `1px solid ${T.greenBorder}` }}>
//                   <span style={{ fontSize: 20 }}>🏪</span>
//                   <div>
//                     <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.green, marginBottom: 2 }}>Added by Vendor</div>
//                     <div style={{ fontSize: 13, fontWeight: 700, color: "#065F46" }}>{product.vendor_name || product.vendor_id || "—"}</div>
//                   </div>
//                 </div>
//               )}

//               {/* Classification */}
//               <SectionHead>Classification</SectionHead>
//               <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 4 }}>
//                 {[["Division", product.division], ["Section", product.section], ["Department", product.department], ["HSN Code", product.hsn_code]].map(([label, val]) => (
//                   <div key={label} style={{ background: val ? T.slate50 : T.amberLight, border: `1px solid ${val ? T.border : T.amberBorder}`, borderRadius: 10, padding: "10px 12px" }}>
//                     <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: T.textMuted, marginBottom: 4 }}>{label}</div>
//                     <div style={{ fontSize: 13, fontWeight: 700, color: val ? T.text : T.amber }}>{val || "—"}</div>
//                   </div>
//                 ))}
//               </div>

//               {/* Pricing */}
//               {!product.has_variants && (
//                 <>
//                   <SectionHead>Pricing</SectionHead>
//                   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
//                     <PriceCard label="Cost Price"    value={product.cost_price}    accent={{ bg: T.slate50,    border: T.border,      color: T.textMid, muted: T.textMuted }} />
//                     <PriceCard label="MRP"           value={product.mrp}           accent={{ bg: T.brandLight, border: T.brandBorder, color: T.brand,   muted: T.brand }} />
//                     <PriceCard label="Selling Price" value={product.selling_price} accent={{ bg: T.greenLight, border: T.greenBorder, color: T.green,   muted: T.green }} />
//                   </div>
//                   {margin !== null && (
//                     <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "7px 14px", borderRadius: 8, background: mColor + "14", border: `1px solid ${mColor}30`, marginBottom: 4 }}>
//                       <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: mColor, opacity: 0.7 }}>Margin</span>
//                       <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 800, color: mColor }}>{margin}%</span>
//                       <span style={{ fontSize: 10, fontWeight: 600, color: mColor }}>
//                         {parseFloat(margin) < 0 ? "⚠ Selling at loss" : parseFloat(margin) >= 20 ? "✓ Healthy" : "↑ Low margin"}
//                       </span>
//                     </div>
//                   )}

//                   <SectionHead>Inventory</SectionHead>
//                   <div style={{ display: "inline-flex", alignItems: "center", gap: 20, padding: "12px 18px", borderRadius: 10, background: T.blueLight, border: `1px solid ${T.blueBorder}`, marginBottom: 4 }}>
//                     <div>
//                       <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 2 }}>Stock</div>
//                       <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 800, color: T.blue }}>{product.quantity ?? 0}</div>
//                     </div>
//                     <div style={{ width: 1, height: 32, background: T.blueBorder }} />
//                     <div>
//                       <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 2 }}>Unit</div>
//                       <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: T.blue }}>{product.unit || "pcs"}</div>
//                     </div>
//                   </div>
//                 </>
//               )}

//               {/* Images */}
//               {images.length > 0 && (
//                 <>
//                   <SectionHead>Images</SectionHead>
//                   <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
//                     {images.map((src, i) => (
//                       <img key={i} src={src} alt=""
//                         onClick={() => setLightbox(src)}
//                         style={{ width: 68, height: 68, borderRadius: 10, border: `1px solid ${T.border}`, objectFit: "cover", cursor: "pointer", transition: "transform .15s" }}
//                         onMouseEnter={e => e.currentTarget.style.transform = "scale(1.07)"}
//                         onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
//                       />
//                     ))}
//                   </div>
//                 </>
//               )}

//               {/* Description */}
//               {product.description && (
//                 <>
//                   <SectionHead>Description</SectionHead>
//                   <div style={{ padding: "10px 14px", borderRadius: 8, background: T.slate50, border: `1px solid ${T.border}`, fontSize: 13, color: T.textMid, lineHeight: 1.7, marginBottom: 4 }}>{product.description}</div>
//                 </>
//               )}

//               {/* Specification */}
//               {product.specification && (
//                 <>
//                   <SectionHead>Specification</SectionHead>
//                   <div style={{ padding: "10px 14px", borderRadius: 8, background: T.slate50, border: `1px solid ${T.border}`, fontSize: 13, color: T.textMid, lineHeight: 1.7, marginBottom: 4 }}>{product.specification}</div>
//                 </>
//               )}

//               {/* Variants */}
//               {product.has_variants && (product.variants || []).length > 0 && (
//                 <>
//                   <SectionHead>
//                     Variants &nbsp;
//                     <span style={{ background: T.brandLight, border: `1px solid ${T.brandBorder}`, borderRadius: 20, padding: "1px 9px", fontFamily: "monospace", fontSize: 11, color: T.brand }}>{product.variants.length}</span>
//                   </SectionHead>
//                   <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}` }}>
//                     <div style={{ overflowX: "auto" }}>
//                       <table style={{ minWidth: 780, width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
//                         <thead>
//                           <tr style={{ background: `linear-gradient(135deg, ${T.brand}, ${T.brandDark})` }}>
//                             {["SKU", "Barcode", ...(product.variant_type === "size_color" ? ["Size"] : []), "Color", "Cost", "MRP", "Selling", "Margin", "Stock", "Unit"].map(h => (
//                               <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>{h}</th>
//                             ))}
//                           </tr>
//                         </thead>
//                         <tbody>
//                           {product.variants.map((v, i) => <VariantRow key={i} v={v} variantType={product.variant_type} />)}
//                         </tbody>
//                       </table>
//                     </div>
//                   </div>
//                 </>
//               )}
//             </>
//           )}
//         </div>
//       </div>

//       {/* Lightbox */}
//       {lightbox && ReactDOM.createPortal(
//         <div
//           style={{ position: "fixed", inset: 0, zIndex: 999999, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, cursor: "pointer" }}
//           onClick={() => setLightbox(null)}>
//           <button
//             style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", borderRadius: 8, width: 38, height: 38 }}
//             onClick={() => setLightbox(null)}>✕</button>
//           <img src={lightbox} alt="" style={{ maxHeight: "88vh", maxWidth: "90vw", borderRadius: 14 }} onClick={e => e.stopPropagation()} />
//         </div>,
//         document.body
//       )}
//     </>
//   );

//   return ReactDOM.createPortal(modal, document.body);
// }

// /* ─── isIncomplete ───────────────────────────────────────────────── */
// const isIncomplete = (p) => {
//   const effectiveSku = p.sku || p.base_sku || "";
//   const fields = p.has_variants
//     ? ["division", "section", "department", "hsn_code"]
//     : ["division", "section", "department", "hsn_code", "mrp", "selling_price"];
//   return fields.some(f => {
//     const v = f === "sku" ? effectiveSku : p[f];
//     return v === undefined || v === null || v === "" || v === 0;
//   });
// };

// /* ─── Main ProductList ───────────────────────────────────────────── */
// export default function ProductList({ embedded = false, onAddProduct, onEditProduct }) {
//   const [products,        setProducts]        = useState([]);
//   const [search,          setSearch]          = useState("");
//   const [sourceTab,       setSourceTab]       = useState("all");
//   const [loading,         setLoading]         = useState(false);
//   const [error,           setError]           = useState("");
//   const [selectedProduct, setSelectedProduct] = useState(null);
//   const navigate = useNavigate();

//   const fetchProducts = async () => {
//     setLoading(true); setError("");
//     try {
//       const token = getToken();
//       if (!token) { setError("Not authenticated. Please log in again."); return; }

//       const [prodRes, invRes] = await Promise.all([
//         axios.get(`${API_BASE}/api/products/`, { headers: { Authorization: `Bearer ${token}` } }),
//         axios.get(`${API_BASE}/inventory/current-stock`).catch(() => ({ data: { data: [] } })),
//       ]);

//       const invRows = invRes.data?.data || [];
//       const invMap  = {};
//       for (const row of invRows) { if (row.barcode) invMap[row.barcode] = row.qty; }
//       const invBarcodes    = new Set(invRows.map(r => r.barcode).filter(Boolean));
//       const invVendorNames = new Set(invRows.map(r => r.vendor_name).filter(Boolean));

//       const result = [];
//       for (const p of (prodRes.data.data || [])) {
//         const source     = (p.source || "").toLowerCase();
//         const created_by = (p.created_by || "").toUpperCase();
//         const isVendor   = source === "vendor" || created_by === "VENDOR" ||
//                            (p.vendor_id && !["grn", "admin"].includes(source));

//         if (!isVendor) {
//           if (!p.has_variants) {
//             const lq = invMap[p.barcode];
//             result.push(lq !== undefined ? { ...p, quantity: lq } : p);
//           } else {
//             result.push({ ...p, variants: (p.variants || []).map(v => { const lq = invMap[v.barcode]; return lq !== undefined ? { ...v, stock: lq } : v; }) });
//           }
//           continue;
//         }

//         if (!p.has_variants) {
//           const barcode  = p.barcode || p.base_barcode || "";
//           const inducted = invBarcodes.has(barcode);
//           if (!inducted) continue;
//           const lq = invMap[barcode];
//           result.push(lq !== undefined ? { ...p, quantity: lq } : p);
//         } else {
//           const inducted = (p.variants || []).filter(v => { const vbc = (v.barcode || "").trim(); return vbc && invBarcodes.has(vbc); });
//           const vName    = (p.vendor_name || "").trim();
//           const hasVendorRows = vName && invRows.some(r => r.vendor_name === vName && invBarcodes.has(r.barcode));
//           if (inducted.length === 0 && !hasVendorRows) continue;
//           if (inducted.length > 0) {
//             result.push({ ...p, variants: inducted.map(v => { const lq = invMap[v.barcode]; return lq !== undefined ? { ...v, stock: lq } : v; }) });
//           } else {
//             result.push({ ...p, variants: [] });
//           }
//         }
//       }
//       setProducts(result);
//     } catch (err) {
//       setError(err.response?.status === 401 ? "Session expired. Please log in again." : "Failed to load products.");
//     } finally { setLoading(false); }
//   };

//   useEffect(() => { fetchProducts(); }, []);

//   const counts = {
//     all:    products.length,
//     admin:  products.filter(p => detectSource(p) === "admin").length,
//     vendor: products.filter(p => detectSource(p) === "vendor").length,
//     grn:    products.filter(p => detectSource(p) === "grn").length,
//   };

//   const filtered = products.filter(p => {
//     if (sourceTab !== "all" && detectSource(p) !== sourceTab) return false;
//     const q = search.toLowerCase();
//     if (!q) return true;
//     const sku = (p.sku || p.base_sku || "").toLowerCase();
//     const bc  = (p.barcode || p.base_barcode || "").toLowerCase();
//     return p.product_name?.toLowerCase().includes(q) || sku.includes(q) || bc.includes(q) ||
//       p.division?.toLowerCase().includes(q) || p.section?.toLowerCase().includes(q) ||
//       (p.vendor_name || "").toLowerCase().includes(q) || (p.grn_no || "").toLowerCase().includes(q);
//   });

//   const deleteProduct = async (p) => {
//     const sku = p.sku || p.base_sku;
//     if (!window.confirm(`Delete "${p.product_name}"?`)) return;
//     try {
//       await axios.delete(`${API_BASE}/api/products/${sku}`, { headers: { Authorization: `Bearer ${getToken()}` } });
//       fetchProducts();
//     } catch { alert("Failed to delete product"); }
//   };

//   const handleOpenAdd = () => { if (embedded && onAddProduct) { onAddProduct(); return; } navigate("/products/add"); };
//   const handleEdit    = (p)  => { if (embedded && onEditProduct) { onEditProduct(p); return; } navigate(`/products/edit/${p.sku || p.base_sku}`); };

//   const tabBtn = (key, activeColor) => ({
//     padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700,
//     cursor: "pointer", transition: "all .15s",
//     background: sourceTab === key ? activeColor : T.surface,
//     color:      sourceTab === key ? T.white     : T.textMid,
//     boxShadow:  sourceTab === key ? `0 2px 8px ${activeColor}40` : "none",
//     outline:    sourceTab === key ? "none"      : `1px solid ${T.border}`,
//   });

//   return (
//     <div style={{ minHeight: embedded ? 0 : "100vh", background: embedded ? "transparent" : T.bg, padding: embedded ? 0 : "20px 24px" }}>
//       <div style={{ maxWidth: 1280, margin: "0 auto" }}>

//         {/* Page header */}
//         <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18, padding: "16px 22px", borderRadius: 14, background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 2px 12px rgba(91,95,239,0.06)", flexWrap: "wrap" }}>
//           <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
//             <div style={{ width: 42, height: 42, borderRadius: 11, background: `linear-gradient(135deg, ${T.brand}, ${T.brandDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📦</div>
//             <div>
//               <h1 style={{ fontSize: 20, fontWeight: 900, color: T.text, margin: 0, letterSpacing: "-0.4px" }}>Product Master</h1>
//               <p style={{ fontSize: 12, color: T.textMuted, margin: "2px 0 0" }}>{counts.all} total · {counts.admin} admin · {counts.vendor} vendor · {counts.grn} GRN</p>
//             </div>
//           </div>
//           <button
//             onClick={handleOpenAdd}
//             style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 20px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${T.brand}, ${T.brandDark})`, color: T.white, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${T.brand}35`, transition: "all .15s" }}
//             onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
//             onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
//             ＋ Add Product
//           </button>
//         </div>

//         {error && (
//           <div style={{ marginBottom: 12, padding: "11px 16px", borderRadius: 10, background: T.redLight, border: `1px solid ${T.redBorder}`, fontSize: 13, color: T.red }}>⚠ {error}</div>
//         )}

//         {/* Tabs + search */}
//         <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, flexWrap: "wrap" }}>
//           <button style={tabBtn("all",    T.brand)}   onClick={() => setSourceTab("all")}>All ({counts.all})</button>
//           <button style={tabBtn("admin",  T.textMid)} onClick={() => setSourceTab("admin")}>Admin ({counts.admin})</button>
//           <button style={tabBtn("vendor", T.green)}   onClick={() => setSourceTab("vendor")}>Vendor ({counts.vendor})</button>
//           <button style={tabBtn("grn",    T.amber)}   onClick={() => setSourceTab("grn")}>GRN ({counts.grn})</button>
//           <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 13px", minWidth: 270 }}>
//             <span style={{ color: T.textMuted, fontSize: 13 }}>🔍</span>
//             <input type="text" placeholder="Search name, SKU, barcode, vendor, GRN…" value={search} onChange={e => setSearch(e.target.value)}
//               style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, color: T.text, width: "100%" }} />
//             {search && <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", color: T.textMuted, fontSize: 13 }}>✕</button>}
//           </div>
//         </div>

//         {/* Table */}
//         <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${T.border}`, background: T.surface, boxShadow: "0 2px 16px rgba(14,17,23,0.04)" }}>
//           <div style={{ overflowX: "auto" }}>
//             <table style={{ minWidth: 960, width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
//               <thead>
//                 <tr style={{ background: `linear-gradient(135deg, ${T.brand} 0%, ${T.brandDark} 100%)` }}>
//                   {["SKU", "Product", "Source", "Division", "Section / Dept", "Variants", "Images", "Actions"].map(h => (
//                     <th key={h} style={{ padding: "12px 16px", textAlign: h === "Actions" ? "center" : "left", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.82)", whiteSpace: "nowrap" }}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {loading ? (
//                   <tr><td colSpan={8} style={{ padding: "56px 20px", textAlign: "center", color: T.textMuted }}>
//                     <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.35 }}>⏳</div>
//                     <p style={{ fontSize: 13, fontWeight: 500 }}>Loading products…</p>
//                   </td></tr>
//                 ) : filtered.length === 0 ? (
//                   <tr><td colSpan={8} style={{ padding: "56px 20px", textAlign: "center", color: T.textMuted }}>
//                     <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.25 }}>📭</div>
//                     <p style={{ fontSize: 13, fontWeight: 500 }}>{search || sourceTab !== "all" ? "No results found" : "No products yet"}</p>
//                   </td></tr>
//                 ) : filtered.map((p, i) => {
//                   const sku    = p.sku || p.base_sku || "—";
//                   const images = p.images || [];
//                   const src    = detectSource(p);
//                   const inc    = isIncomplete(p);
//                   return (
//                     <tr key={i}
//                       style={{ borderBottom: `1px solid ${T.border}`, transition: "background .12s", background: T.surface }}
//                       onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
//                       onMouseLeave={e => e.currentTarget.style.background = T.surface}>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle" }}><Tag>{sku}</Tag></td>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
//                         <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
//                           <span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{p.product_name}</span>
//                           {inc && <span style={{ padding: "1px 7px", borderRadius: 20, background: T.amberLight, border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: 9, fontWeight: 700 }}>⚠ Incomplete</span>}
//                         </div>
//                         {p.description && <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</p>}
//                       </td>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
//                         <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
//                           <SourceBadge source={src} compact />
//                           {src === "vendor" && p.vendor_name && <span style={{ fontSize: 11, color: T.textMuted }}>{p.vendor_name}</span>}
//                           {src === "grn"    && p.grn_no      && <span style={{ fontFamily: "monospace", fontSize: 10, color: T.amber }}>{p.grn_no}</span>}
//                         </div>
//                       </td>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle", fontWeight: 600, fontSize: 13, color: p.division ? T.text : T.border }}>{p.division || "—"}</td>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
//                         <span style={{ fontWeight: 600, fontSize: 13, color: p.section ? T.text : T.border }}>{p.section || "—"}</span>
//                         {p.department && <p style={{ fontSize: 11, color: T.textMuted, margin: "2px 0 0" }}>{p.department}</p>}
//                       </td>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
//                         {p.has_variants ? (
//                           <div>
//                             <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.brandLight, border: `1px solid ${T.brandBorder}`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: T.brand }}>
//                               <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.brand }} />
//                               {p.variant_type === "color" ? "Color" : "Size + Color"}
//                             </span>
//                             <p style={{ fontFamily: "monospace", fontSize: 10, color: T.textMuted, margin: "4px 0 0" }}>{(p.variants || []).length} variant{(p.variants || []).length !== 1 ? "s" : ""}</p>
//                           </div>
//                         ) : <span style={{ fontSize: 12, color: T.border }}>Simple</span>}
//                       </td>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
//                         <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
//                           {images.slice(0, 3).map((s, j) => (
//                             <img key={j} src={s} alt="" style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.border}`, objectFit: "cover" }} />
//                           ))}
//                           {images.length > 3 && (
//                             <div style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.border}`, background: T.slate100, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: T.textMid }}>+{images.length - 3}</div>
//                           )}
//                           {images.length === 0 && <span style={{ fontSize: 11, color: T.border }}>—</span>}
//                         </div>
//                       </td>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
//                         <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
//                           <button onClick={() => setSelectedProduct(p)}
//                             style={{ padding: "5px 13px", borderRadius: 7, border: `1px solid ${T.brandBorder}`, background: T.brandLight, color: T.brand, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s", whiteSpace: "nowrap" }}
//                             onMouseEnter={e => { e.currentTarget.style.background = T.brand; e.currentTarget.style.color = T.white; }}
//                             onMouseLeave={e => { e.currentTarget.style.background = T.brandLight; e.currentTarget.style.color = T.brand; }}>
//                             👁 View
//                           </button>
//                           <button onClick={() => handleEdit(p)}
//                             style={{ padding: "5px 13px", borderRadius: 7, border: `1px solid ${T.blueBorder}`, background: T.blueLight, color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s", whiteSpace: "nowrap" }}
//                             onMouseEnter={e => { e.currentTarget.style.background = T.blue; e.currentTarget.style.color = T.white; }}
//                             onMouseLeave={e => { e.currentTarget.style.background = T.blueLight; e.currentTarget.style.color = T.blue; }}>
//                             ✏ Edit
//                           </button>
//                           <button onClick={() => deleteProduct(p)}
//                             style={{ padding: "5px 9px", borderRadius: 7, border: `1px solid ${T.redBorder}`, background: T.redLight, color: T.red, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s" }}
//                             onMouseEnter={e => { e.currentTarget.style.background = T.red; e.currentTarget.style.color = T.white; }}
//                             onMouseLeave={e => { e.currentTarget.style.background = T.redLight; e.currentTarget.style.color = T.red; }}>
//                             🗑
//                           </button>
//                         </div>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       </div>

//       {/* Modal — rendered outside all overflow:hidden ancestors */}
//       {selectedProduct && (
//         <ProductModal
//           product={selectedProduct}
//           onClose={() => setSelectedProduct(null)}
//           onSaved={fetchProducts}
//         />
//       )}
//     </div>
//   );
// }






// import React, { useEffect, useState } from "react";
// import ReactDOM from "react-dom";
// import axios from "axios";
// import { useNavigate } from "react-router-dom";
// import QuickFillPanel from "../Quickfillpanel";
// import BarcodeStickerPrint from "../BarcodeStickerPrint";


// const API_BASE = `${APP_API_URL}`;

// const getToken = () =>
//   localStorage.getItem("admin_token") || localStorage.getItem("token") || "";

// const calcMargin = (cp, sp) => {
//   const c = parseFloat(cp), s = parseFloat(sp);
//   if (!c || !s || c <= 0) return null;
//   return (((s - c) / c) * 100).toFixed(1);
// };

// function detectSource(p) {
//   if (p.source === "grn" || p.created_by === "GRN") return "grn";
//   if (p.source === "vendor") return "vendor";
//   if (!p.source && (p.vendor_name || p.vendor_id)) return "vendor";
//   return "admin";
// }

// /* ─── Design tokens ──────────────────────────────────────────────── */
// const T = {
//   bg:           "#FAFAFA",
//   surface:      "#FFFFFF",
//   surfaceHover: "#F5F7FF",
//   border:       "#E8ECF4",
//   brand:        "#5B5FEF",
//   brandDark:    "#4347CC",
//   brandLight:   "#EEEFFE",
//   brandBorder:  "#C5C8F8",
//   amber:        "#C97D00",
//   amberLight:   "#FEF8E7",
//   amberBorder:  "#F5D97A",
//   green:        "#0D9974",
//   greenLight:   "#E8FAF4",
//   greenBorder:  "#A0EDD4",
//   red:          "#D93025",
//   redLight:     "#FFF0EE",
//   redBorder:    "#FFCCC9",
//   blue:         "#1A6FDB",
//   blueLight:    "#EEF5FF",
//   blueBorder:   "#BFDBFE",
//   text:         "#0E1117",
//   textMid:      "#4A5168",
//   textMuted:    "#8C93AB",
//   white:        "#FFFFFF",
//   slate50:      "#F8FAFC",
//   slate100:     "#F1F5F9",
//   slate200:     "#E2E8F0",
// };

// /* ─── Micro components ───────────────────────────────────────────── */
// const Tag = ({ children, color = T.brand, bg = T.brandLight, border = T.brandBorder }) => (
//   <span style={{
//     display: "inline-flex", alignItems: "center",
//     padding: "2px 8px", borderRadius: 6,
//     background: bg, border: `1px solid ${border}`,
//     fontFamily: "monospace", fontSize: 11, fontWeight: 600, color,
//   }}>{children}</span>
// );

// const SectionHead = ({ children }) => (
//   <div style={{ marginTop: 22, marginBottom: 10 }}>
//     <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: T.brand }}>{children}</span>
//     <div style={{ height: 1, background: `linear-gradient(90deg, ${T.brandBorder}, transparent)`, marginTop: 5 }} />
//   </div>
// );

// const fmt = (n) => { const x = parseFloat(n); return isNaN(x) ? "—" : `₹${x.toFixed(2)}`; };

// function PriceCard({ label, value, accent }) {
//   return (
//     <div style={{ background: accent.bg, border: `1px solid ${accent.border}`, borderRadius: 10, padding: "12px 14px" }}>
//       <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", color: accent.muted, marginBottom: 5 }}>{label}</div>
//       <div style={{ fontFamily: "monospace", fontSize: 17, fontWeight: 800, color: accent.color }}>{fmt(value)}</div>
//     </div>
//   );
// }

// function SourceBadge({ source, compact = false }) {
//   const pad = compact ? "2px 7px" : "3px 11px";
//   const sz  = compact ? 10 : 11;
//   if (source === "grn")
//     return <span style={{ display: "inline-block", padding: pad, borderRadius: 20, background: T.amberLight, border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: sz, fontWeight: 700 }}>GRN</span>;
//   if (source === "vendor")
//     return <span style={{ display: "inline-block", padding: pad, borderRadius: 20, background: T.greenLight, border: `1px solid ${T.greenBorder}`, color: T.green, fontSize: sz, fontWeight: 700 }}>Vendor</span>;
//   return <span style={{ display: "inline-block", padding: pad, borderRadius: 20, background: T.brandLight, border: `1px solid ${T.brandBorder}`, color: T.brand, fontSize: sz, fontWeight: 700 }}>Admin</span>;
// }

// function MissingPill({ label }) {
//   return (
//     <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, background: T.amberLight, border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: 11, fontWeight: 600 }}>
//       <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.amber, flexShrink: 0 }} />
//       {label}
//     </span>
//   );
// }

// function VariantRow({ v, variantType }) {
//   const margin = calcMargin(v.cost_price, v.selling_price);
//   const mColor = margin === null ? T.textMuted : parseFloat(margin) < 0 ? T.red : parseFloat(margin) >= 20 ? T.green : T.amber;
//   return (
//     <tr style={{ borderBottom: `1px solid ${T.border}` }}
//       onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
//       onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
//       <td style={{ padding: "9px 12px" }}><Tag>{v.sku || "—"}</Tag></td>
//       <td style={{ padding: "9px 12px" }}><Tag color={T.textMid} bg={T.slate100} border={T.slate200}>{v.barcode || "—"}</Tag></td>
//       {variantType === "size_color" && <td style={{ padding: "9px 12px" }}><Tag>{v.size_label || "—"}</Tag></td>}
//       <td style={{ padding: "9px 12px" }}>
//         <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
//           <span style={{ width: 12, height: 12, borderRadius: 3, background: v.color || "#ccc", border: "1px solid rgba(0,0,0,0.12)", flexShrink: 0 }} />
//           <span style={{ fontSize: 11, color: T.textMid, fontFamily: "monospace" }}>{v.color || "—"}</span>
//         </div>
//       </td>
//       <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 12, color: T.textMid }}>{fmt(v.cost_price)}</td>
//       <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 12, color: T.brand, fontWeight: 600 }}>{fmt(v.mrp)}</td>
//       <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: parseFloat(v.selling_price) < parseFloat(v.cost_price) ? T.red : T.green }}>{fmt(v.selling_price)}</td>
//       <td style={{ padding: "9px 12px" }}>
//         {margin !== null
//           ? <span style={{ background: mColor + "18", border: `1px solid ${mColor}40`, borderRadius: 6, padding: "2px 7px", fontFamily: "monospace", fontSize: 11, color: mColor, fontWeight: 700 }}>{margin}%</span>
//           : <span style={{ color: T.border }}>—</span>}
//       </td>
//       <td style={{ padding: "9px 12px" }}>
//         <span style={{ background: T.blueLight, border: `1px solid ${T.blueBorder}`, borderRadius: 6, padding: "2px 7px", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: T.blue }}>{v.stock ?? 0}</span>
//       </td>
//       <td style={{ padding: "9px 12px", fontSize: 11, color: T.textMuted }}>{v.unit || "pcs"}</td>
//     </tr>
//   );
// }

// /* ─── ProductModal — rendered via portal to escape overflow:hidden ── */
// function ProductModal({ product, onClose, onSaved }) {
//   const [lightbox, setLightbox] = useState(null);
//   const [tab, setTab]           = useState("details");
//   const [visible, setVisible]   = useState(false);
//   const [printOpen, setPrintOpen] = useState(false);

//   /* Animate in after mount */
//   useEffect(() => {
//     const t = setTimeout(() => setVisible(true), 10);
//     return () => clearTimeout(t);
//   }, []);

//   /* Lock body scroll */
//   useEffect(() => {
//     const prev = document.body.style.overflow;
//     document.body.style.overflow = "hidden";
//     return () => { document.body.style.overflow = prev; };
//   }, []);

//   /* Escape key */
//   useEffect(() => {
//     const handler = (e) => { if (e.key === "Escape") onClose(); };
//     window.addEventListener("keydown", handler);
//     return () => window.removeEventListener("keydown", handler);
//   }, [onClose]);

//   const sku     = product.sku || product.base_sku || "—";
//   const barcode = product.barcode || product.base_barcode || "—";
//   const images  = product.images || [];
//   const source  = detectSource(product);

//   const getMissingFields = (p) => {
//     const effectiveSku = p.sku || p.base_sku || "";
//     const allFields = p.has_variants
//       ? ["division", "section", "department", "hsn_code"]
//       : ["division", "section", "department", "hsn_code", "sku", "mrp", "selling_price"];
//     const labels = { division: "Division", section: "Section", department: "Department", hsn_code: "HSN Code", sku: "SKU", mrp: "MRP", selling_price: "Selling Price" };
//     return allFields
//       .filter(f => { const v = f === "sku" ? effectiveSku : p[f]; return !v || v === 0; })
//       .map(f => labels[f]);
//   };

//   const missingFields = getMissingFields(product);
//   const incomplete    = missingFields.length > 0;
//   const tabs = [
//     { key: "details", label: "Details" },
//     ...(incomplete ? [{ key: "fill", label: `Fix (${missingFields.length})` }] : []),
//   ];

//     const stickerItems = !product.has_variants
//     ? [{
//         barcode:    product.barcode || product.base_barcode || "",
//         name:       product.product_name,
//         sku:        product.sku || product.base_sku || "",
//         rate:       product.selling_price || product.mrp || 0,
//         division:   product.division || "",
//       }]
//     : (product.variants || []).map(v => ({
//         barcode:    v.barcode || "",
//         name:       product.product_name,
//         sku:        v.sku || "",
//         rate:       v.selling_price || v.mrp || 0,
//         size_label: v.size_label || "",
//         color:      v.color || "",
//         division:   product.division || "",
//       }));



//   const margin = !product.has_variants ? calcMargin(product.cost_price, product.selling_price) : null;
//   const mColor = margin === null ? T.textMuted : parseFloat(margin) < 0 ? T.red : parseFloat(margin) >= 20 ? T.green : T.amber;

//   /* ── The actual UI ── */
//   const modal = (
//     <>
//       {/* Backdrop */}
//       <div
//         onClick={onClose}
//         style={{
//           position: "fixed", inset: 0, zIndex: 99998,
//           background: "rgba(10,14,22,0.65)",
//           backdropFilter: "blur(8px)",
//           WebkitBackdropFilter: "blur(8px)",
//           transition: "opacity .22s ease",
//           opacity: visible ? 1 : 0,
//         }}
//       />

//       {/* Dialog */}
//       <div
//         role="dialog"
//         aria-modal="true"
//         onClick={e => e.stopPropagation()}
//         style={{
//           position: "fixed",
//           top: "50%", left: "50%",
//           transform: visible
//             ? "translate(-50%, -50%) scale(1)"
//             : "translate(-50%, -48%) scale(0.96)",
//           zIndex: 99999,
//           width: "calc(100vw - 40px)",
//           maxWidth: 840,
//           maxHeight: "88vh",
//           display: "flex",
//           flexDirection: "column",
//           borderRadius: 20,
//           background: T.surface,
//           border: `1px solid ${T.border}`,
//           boxShadow: "0 32px 80px rgba(10,14,22,0.28), 0 6px 20px rgba(10,14,22,0.12)",
//           overflow: "hidden",
//           transition: "transform .28s cubic-bezier(.16,1,.3,1), opacity .22s ease",
//           opacity: visible ? 1 : 0,
//         }}
//       >
//         {/* ══ HEADER ══ */}
//         <div style={{
//           flexShrink: 0,
//           padding: "20px 24px 0",
//           borderBottom: `1px solid ${T.border}`,
//           background: T.surface,
//         }}>
//           <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
//             {/* Icon */}
//             <div style={{
//               flexShrink: 0, width: 44, height: 44, borderRadius: 12,
//               background: T.brandLight, border: `1px solid ${T.brandBorder}`,
//               display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
//             }}>📦</div>

//             {/* Name + tags */}
//             <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
//               <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 7 }}>
//                 <h2 style={{ fontSize: 16, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.3, wordBreak: "break-word" }}>
//                   {product.product_name}
//                 </h2>
//                 {incomplete && (
//                   <span style={{ padding: "2px 8px", borderRadius: 20, background: T.amberLight, border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: 10, fontWeight: 700 }}>⚠ Incomplete</span>
//                 )}
//               </div>
//               <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
//                 <Tag>{sku}</Tag>
//                 <Tag color={T.textMid} bg={T.slate100} border={T.slate200}>{barcode}</Tag>
//                 {product.has_variants && (
//                   <Tag>{product.variant_type === "color" ? "Color variants" : "Size + Color variants"}</Tag>
//                 )}
//                 <SourceBadge source={source} />
//               </div>
//             </div>

//             {/* Close */}
//             <button
//               onClick={onClose}
//               style={{
//                 flexShrink: 0, width: 32, height: 32, borderRadius: 8,
//                 border: `1px solid ${T.border}`, background: T.surface,
//                 cursor: "pointer", display: "flex", alignItems: "center",
//                 justifyContent: "center", fontSize: 15, color: T.textMuted,
//                 transition: "all .15s",
//               }}
//               onMouseEnter={e => { e.currentTarget.style.background = T.redLight; e.currentTarget.style.color = T.red; e.currentTarget.style.borderColor = T.redBorder; }}
//               onMouseLeave={e => { e.currentTarget.style.background = T.surface; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; }}
//             >✕</button>
//           </div>

//           {/* Tab bar */}
//           <div style={{ display: "flex" }}>
//             {tabs.map(({ key, label }) => {
//               const active = tab === key;
//               const isFill = key === "fill";
//               return (
//                 <button
//             onClick={() => setPrintOpen(true)}
//             style={{
//               marginLeft: "auto", marginBottom: -1,
//               padding: "7px 16px", border: "none", cursor: "pointer",
//               fontSize: 12, fontWeight: 700, borderRadius: "8px 8px 0 0",
//               background: "#FEF3C7", color: "#D97706",
//               borderBottom: "2px solid #F59E0B",
//               display: "flex", alignItems: "center", gap: 6,
//               transition: "all .15s",
//             }}
//             title="Print barcode stickers for this product"
//           >
//             🏷️ Print Stickers{product.has_variants ? ` (${(product.variants||[]).length})` : ""}
//           </button>
//               );
//             })}
//           </div>
//         </div>

//         {/* ══ BODY — scrollable ══ */}
//         <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "22px 24px 28px" }}>

//           {/* ── FILL TAB ── */}
//           {tab === "fill" && incomplete && (
//             <div>
//               <div style={{
//                 marginBottom: 18, padding: "14px 18px", borderRadius: 12,
//                 background: T.amberLight, border: `1px solid ${T.amberBorder}`,
//                 display: "flex", alignItems: "flex-start", gap: 12,
//               }}>
//                 <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
//                 <div>
//                   <div style={{ fontSize: 12, fontWeight: 700, color: "#78350F", marginBottom: 6 }}>
//                     {missingFields.length} field{missingFields.length !== 1 ? "s" : ""} need attention
//                   </div>
//                   <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
//                     {missingFields.map(f => <MissingPill key={f} label={f} />)}
//                   </div>
//                 </div>
//               </div>

//               {source === "grn" && (
//                 <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "#F0F9FF", border: "1px solid #BAE6FD", fontSize: 12, color: "#0369A1", fontWeight: 600 }}>
//                   📋 Auto-created from GRN {product.grn_no || ""} — complete classification below
//                 </div>
//               )}

//               <div style={{ borderRadius: 14, border: `1px solid ${T.border}`, overflow: "hidden" }}>
//                 <div style={{ padding: "12px 18px", background: `linear-gradient(135deg, ${T.brand}, ${T.brandDark})`, display: "flex", alignItems: "center", gap: 8 }}>
//                   <span style={{ fontSize: 14 }}>✏️</span>
//                   <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Complete Product Details</span>
//                   <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginLeft: "auto" }}>{product.product_name}</span>
//                 </div>
//                 <div style={{ padding: 18 }}>
//                   <QuickFillPanel product={product} onSaved={() => { onSaved && onSaved(); onClose(); }} />
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* ── DETAILS TAB ── */}
//           {tab === "details" && (
//             <>
//               {/* Source strip */}
//               {source === "grn" && (
//                 <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: T.amberLight, border: `1px solid ${T.amberBorder}` }}>
//                   <span style={{ fontSize: 20 }}>📋</span>
//                   <div>
//                     <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.amber, marginBottom: 2 }}>Added via GRN Inward</div>
//                     <div style={{ fontSize: 13, fontWeight: 700, color: "#78350F" }}>{product.grn_no || "—"}{product.vendor_name ? ` · ${product.vendor_name}` : ""}</div>
//                   </div>
//                 </div>
//               )}
//               {source === "vendor" && (
//                 <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: T.greenLight, border: `1px solid ${T.greenBorder}` }}>
//                   <span style={{ fontSize: 20 }}>🏪</span>
//                   <div>
//                     <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.green, marginBottom: 2 }}>Added by Vendor</div>
//                     <div style={{ fontSize: 13, fontWeight: 700, color: "#065F46" }}>{product.vendor_name || product.vendor_id || "—"}</div>
//                   </div>
//                 </div>
//               )}

//               {/* Classification */}
//               <SectionHead>Classification</SectionHead>
//               <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 4 }}>
//                 {[["Division", product.division], ["Section", product.section], ["Department", product.department], ["HSN Code", product.hsn_code]].map(([label, val]) => (
//                   <div key={label} style={{ background: val ? T.slate50 : T.amberLight, border: `1px solid ${val ? T.border : T.amberBorder}`, borderRadius: 10, padding: "10px 12px" }}>
//                     <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: T.textMuted, marginBottom: 4 }}>{label}</div>
//                     <div style={{ fontSize: 13, fontWeight: 700, color: val ? T.text : T.amber }}>{val || "—"}</div>
//                   </div>
//                 ))}
//               </div>

//               {/* Pricing */}
//               {!product.has_variants && (
//                 <>
//                   <SectionHead>Pricing</SectionHead>
//                   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
//                     <PriceCard label="Cost Price"    value={product.cost_price}    accent={{ bg: T.slate50,    border: T.border,      color: T.textMid, muted: T.textMuted }} />
//                     <PriceCard label="MRP"           value={product.mrp}           accent={{ bg: T.brandLight, border: T.brandBorder, color: T.brand,   muted: T.brand }} />
//                     <PriceCard label="Selling Price" value={product.selling_price} accent={{ bg: T.greenLight, border: T.greenBorder, color: T.green,   muted: T.green }} />
//                   </div>
//                   {margin !== null && (
//                     <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "7px 14px", borderRadius: 8, background: mColor + "14", border: `1px solid ${mColor}30`, marginBottom: 4 }}>
//                       <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: mColor, opacity: 0.7 }}>Margin</span>
//                       <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 800, color: mColor }}>{margin}%</span>
//                       <span style={{ fontSize: 10, fontWeight: 600, color: mColor }}>
//                         {parseFloat(margin) < 0 ? "⚠ Selling at loss" : parseFloat(margin) >= 20 ? "✓ Healthy" : "↑ Low margin"}
//                       </span>
//                     </div>
//                   )}

//                   <SectionHead>Inventory</SectionHead>
//                   <div style={{ display: "inline-flex", alignItems: "center", gap: 20, padding: "12px 18px", borderRadius: 10, background: T.blueLight, border: `1px solid ${T.blueBorder}`, marginBottom: 4 }}>
//                     <div>
//                       <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 2 }}>Stock</div>
//                       <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 800, color: T.blue }}>{product.quantity ?? 0}</div>
//                     </div>
//                     <div style={{ width: 1, height: 32, background: T.blueBorder }} />
//                     <div>
//                       <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 2 }}>Unit</div>
//                       <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: T.blue }}>{product.unit || "pcs"}</div>
//                     </div>
//                   </div>
//                 </>
//               )}

//               {/* Images */}
//               {images.length > 0 && (
//                 <>
//                   <SectionHead>Images</SectionHead>
//                   <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
//                     {images.map((src, i) => (
//                       <img key={i} src={src} alt=""
//                         onClick={() => setLightbox(src)}
//                         style={{ width: 68, height: 68, borderRadius: 10, border: `1px solid ${T.border}`, objectFit: "cover", cursor: "pointer", transition: "transform .15s" }}
//                         onMouseEnter={e => e.currentTarget.style.transform = "scale(1.07)"}
//                         onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
//                       />
//                     ))}
//                   </div>
//                 </>
//               )}

//               {/* Description */}
//               {product.description && (
//                 <>
//                   <SectionHead>Description</SectionHead>
//                   <div style={{ padding: "10px 14px", borderRadius: 8, background: T.slate50, border: `1px solid ${T.border}`, fontSize: 13, color: T.textMid, lineHeight: 1.7, marginBottom: 4 }}>{product.description}</div>
//                 </>
//               )}

//               {/* Specification */}
//               {product.specification && (
//                 <>
//                   <SectionHead>Specification</SectionHead>
//                   <div style={{ padding: "10px 14px", borderRadius: 8, background: T.slate50, border: `1px solid ${T.border}`, fontSize: 13, color: T.textMid, lineHeight: 1.7, marginBottom: 4 }}>{product.specification}</div>
//                 </>
//               )}

//               {/* Variants */}
//               {product.has_variants && (product.variants || []).length > 0 && (
//                 <>
//                   <SectionHead>
//                     Variants &nbsp;
//                     <span style={{ background: T.brandLight, border: `1px solid ${T.brandBorder}`, borderRadius: 20, padding: "1px 9px", fontFamily: "monospace", fontSize: 11, color: T.brand }}>{product.variants.length}</span>
//                   </SectionHead>
//                   <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}` }}>
//                     <div style={{ overflowX: "auto" }}>
//                       <table style={{ minWidth: 780, width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
//                         <thead>
//                           <tr style={{ background: `linear-gradient(135deg, ${T.brand}, ${T.brandDark})` }}>
//                             {["SKU", "Barcode", ...(product.variant_type === "size_color" ? ["Size"] : []), "Color", "Cost", "MRP", "Selling", "Margin", "Stock", "Unit"].map(h => (
//                               <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>{h}</th>
//                             ))}
//                           </tr>
//                         </thead>
//                         <tbody>
//                           {product.variants.map((v, i) => <VariantRow key={i} v={v} variantType={product.variant_type} />)}
//                         </tbody>
//                       </table>
//                     </div>
//                   </div>
//                 </>
//               )}
//             </>
//           )}
//         </div>
//       </div>




//        {/* Sticker Print Modal */}
//       {printOpen && (
//         <BarcodeStickerPrint
//           items={stickerItems}
//           onClose={() => setPrintOpen(false)}
//           storeName=""
//         />
//       )}

//       {/* Lightbox */}
//       {lightbox && ReactDOM.createPortal(
//         <div
//           style={{ position: "fixed", inset: 0, zIndex: 999999, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, cursor: "pointer" }}
//           onClick={() => setLightbox(null)}>
//           <button
//             style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", borderRadius: 8, width: 38, height: 38 }}
//             onClick={() => setLightbox(null)}>✕</button>
//           <img src={lightbox} alt="" style={{ maxHeight: "88vh", maxWidth: "90vw", borderRadius: 14 }} onClick={e => e.stopPropagation()} />
//         </div>,
//         document.body
//       )}
//     </>
//   );

//   return ReactDOM.createPortal(modal, document.body);
// }

// /* ─── isIncomplete ───────────────────────────────────────────────── */
// const isIncomplete = (p) => {
//   const effectiveSku = p.sku || p.base_sku || "";
//   const fields = p.has_variants
//     ? ["division", "section", "department", "hsn_code"]
//     : ["division", "section", "department", "hsn_code", "mrp", "selling_price"];
//   return fields.some(f => {
//     const v = f === "sku" ? effectiveSku : p[f];
//     return v === undefined || v === null || v === "" || v === 0;
//   });
// };

// /* ─── Main ProductList ───────────────────────────────────────────── */
// export default function ProductList({ embedded = false, onAddProduct, onEditProduct }) {
//   const [products,        setProducts]        = useState([]);
//   const [search,          setSearch]          = useState("");
//   const [sourceTab,       setSourceTab]       = useState("all");
//   const [loading,         setLoading]         = useState(false);
//   const [error,           setError]           = useState("");
//   const [selectedProduct, setSelectedProduct] = useState(null);
//   const navigate = useNavigate();

//   const fetchProducts = async () => {
//     setLoading(true); setError("");
//     try {
//       const token = getToken();
//       if (!token) { setError("Not authenticated. Please log in again."); return; }

//       const [prodRes, invRes] = await Promise.all([
//         axios.get(`${API_BASE}/api/products/`, { headers: { Authorization: `Bearer ${token}` } }),
//         axios.get(`${API_BASE}/inventory/current-stock`).catch(() => ({ data: { data: [] } })),
//       ]);

//       const invRows = invRes.data?.data || [];
//       const invMap  = {};
//       for (const row of invRows) { if (row.barcode) invMap[row.barcode] = row.qty; }
//       const invBarcodes    = new Set(invRows.map(r => r.barcode).filter(Boolean));
//       const invVendorNames = new Set(invRows.map(r => r.vendor_name).filter(Boolean));

//       const result = [];
//       for (const p of (prodRes.data.data || [])) {
//         const source     = (p.source || "").toLowerCase();
//         const created_by = (p.created_by || "").toUpperCase();
//         const isVendor   = source === "vendor" || created_by === "VENDOR" ||
//                            (p.vendor_id && !["grn", "admin"].includes(source));

//         if (!isVendor) {
//           if (!p.has_variants) {
//             const lq = invMap[p.barcode];
//             result.push(lq !== undefined ? { ...p, quantity: lq } : p);
//           } else {
//             result.push({ ...p, variants: (p.variants || []).map(v => { const lq = invMap[v.barcode]; return lq !== undefined ? { ...v, stock: lq } : v; }) });
//           }
//           continue;
//         }

//         if (!p.has_variants) {
//           const barcode  = p.barcode || p.base_barcode || "";
//           const inducted = invBarcodes.has(barcode);
//           if (!inducted) continue;
//           const lq = invMap[barcode];
//           result.push(lq !== undefined ? { ...p, quantity: lq } : p);
//         } else {
//           const inducted = (p.variants || []).filter(v => { const vbc = (v.barcode || "").trim(); return vbc && invBarcodes.has(vbc); });
//           const vName    = (p.vendor_name || "").trim();
//           const hasVendorRows = vName && invRows.some(r => r.vendor_name === vName && invBarcodes.has(r.barcode));
//           if (inducted.length === 0 && !hasVendorRows) continue;
//           if (inducted.length > 0) {
//             result.push({ ...p, variants: inducted.map(v => { const lq = invMap[v.barcode]; return lq !== undefined ? { ...v, stock: lq } : v; }) });
//           } else {
//             result.push({ ...p, variants: [] });
//           }
//         }
//       }
//       setProducts(result);
//     } catch (err) {
//       setError(err.response?.status === 401 ? "Session expired. Please log in again." : "Failed to load products.");
//     } finally { setLoading(false); }
//   };

//   useEffect(() => { fetchProducts(); }, []);

//   const counts = {
//     all:    products.length,
//     admin:  products.filter(p => detectSource(p) === "admin").length,
//     vendor: products.filter(p => detectSource(p) === "vendor").length,
//     grn:    products.filter(p => detectSource(p) === "grn").length,
//   };

//   const filtered = products.filter(p => {
//     if (sourceTab !== "all" && detectSource(p) !== sourceTab) return false;
//     const q = search.toLowerCase();
//     if (!q) return true;
//     const sku = (p.sku || p.base_sku || "").toLowerCase();
//     const bc  = (p.barcode || p.base_barcode || "").toLowerCase();
//     return p.product_name?.toLowerCase().includes(q) || sku.includes(q) || bc.includes(q) ||
//       p.division?.toLowerCase().includes(q) || p.section?.toLowerCase().includes(q) ||
//       (p.vendor_name || "").toLowerCase().includes(q) || (p.grn_no || "").toLowerCase().includes(q);
//   });

//   const deleteProduct = async (p) => {
//     const sku = p.sku || p.base_sku;
//     if (!window.confirm(`Delete "${p.product_name}"?`)) return;
//     try {
//       await axios.delete(`${API_BASE}/api/products/${sku}`, { headers: { Authorization: `Bearer ${getToken()}` } });
//       fetchProducts();
//     } catch { alert("Failed to delete product"); }
//   };

//   const handleOpenAdd = () => { if (embedded && onAddProduct) { onAddProduct(); return; } navigate("/products/add"); };
//   const handleEdit    = (p)  => { if (embedded && onEditProduct) { onEditProduct(p); return; } navigate(`/products/edit/${p.sku || p.base_sku}`); };

//   const tabBtn = (key, activeColor) => ({
//     padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700,
//     cursor: "pointer", transition: "all .15s",
//     background: sourceTab === key ? activeColor : T.surface,
//     color:      sourceTab === key ? T.white     : T.textMid,
//     boxShadow:  sourceTab === key ? `0 2px 8px ${activeColor}40` : "none",
//     outline:    sourceTab === key ? "none"      : `1px solid ${T.border}`,
//   });

//   return (
//     <div style={{ minHeight: embedded ? 0 : "100vh", background: embedded ? "transparent" : T.bg, padding: embedded ? 0 : "20px 24px" }}>
//       <div style={{ maxWidth: 1280, margin: "0 auto" }}>

//         {/* Page header */}
//         <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18, padding: "16px 22px", borderRadius: 14, background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 2px 12px rgba(91,95,239,0.06)", flexWrap: "wrap" }}>
//           <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
//             <div style={{ width: 42, height: 42, borderRadius: 11, background: `linear-gradient(135deg, ${T.brand}, ${T.brandDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📦</div>
//             <div>
//               <h1 style={{ fontSize: 20, fontWeight: 900, color: T.text, margin: 0, letterSpacing: "-0.4px" }}>Product Master</h1>
//               <p style={{ fontSize: 12, color: T.textMuted, margin: "2px 0 0" }}>{counts.all} total · {counts.admin} admin · {counts.vendor} vendor · {counts.grn} GRN</p>
//             </div>
//           </div>
//           <button
//             onClick={handleOpenAdd}
//             style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 20px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${T.brand}, ${T.brandDark})`, color: T.white, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${T.brand}35`, transition: "all .15s" }}
//             onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
//             onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
//             ＋ Add Product
//           </button>
//         </div>

//         {error && (
//           <div style={{ marginBottom: 12, padding: "11px 16px", borderRadius: 10, background: T.redLight, border: `1px solid ${T.redBorder}`, fontSize: 13, color: T.red }}>⚠ {error}</div>
//         )}

//         {/* Tabs + search */}
//         <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, flexWrap: "wrap" }}>
//           <button style={tabBtn("all",    T.brand)}   onClick={() => setSourceTab("all")}>All ({counts.all})</button>
//           <button style={tabBtn("admin",  T.textMid)} onClick={() => setSourceTab("admin")}>Admin ({counts.admin})</button>
//           <button style={tabBtn("vendor", T.green)}   onClick={() => setSourceTab("vendor")}>Vendor ({counts.vendor})</button>
//           <button style={tabBtn("grn",    T.amber)}   onClick={() => setSourceTab("grn")}>GRN ({counts.grn})</button>
//           <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 13px", minWidth: 270 }}>
//             <span style={{ color: T.textMuted, fontSize: 13 }}>🔍</span>
//             <input type="text" placeholder="Search name, SKU, barcode, vendor, GRN…" value={search} onChange={e => setSearch(e.target.value)}
//               style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, color: T.text, width: "100%" }} />
//             {search && <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", color: T.textMuted, fontSize: 13 }}>✕</button>}
//           </div>
//         </div>

//         {/* Table */}
//         <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${T.border}`, background: T.surface, boxShadow: "0 2px 16px rgba(14,17,23,0.04)" }}>
//           <div style={{ overflowX: "auto" }}>
//             <table style={{ minWidth: 960, width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
//               <thead>
//                 <tr style={{ background: `linear-gradient(135deg, ${T.brand} 0%, ${T.brandDark} 100%)` }}>
//                   {["SKU", "Product", "Source", "Division", "Section / Dept", "Variants", "Images", "Actions"].map(h => (
//                     <th key={h} style={{ padding: "12px 16px", textAlign: h === "Actions" ? "center" : "left", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.82)", whiteSpace: "nowrap" }}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {loading ? (
//                   <tr><td colSpan={8} style={{ padding: "56px 20px", textAlign: "center", color: T.textMuted }}>
//                     <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.35 }}>⏳</div>
//                     <p style={{ fontSize: 13, fontWeight: 500 }}>Loading products…</p>
//                   </td></tr>
//                 ) : filtered.length === 0 ? (
//                   <tr><td colSpan={8} style={{ padding: "56px 20px", textAlign: "center", color: T.textMuted }}>
//                     <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.25 }}>📭</div>
//                     <p style={{ fontSize: 13, fontWeight: 500 }}>{search || sourceTab !== "all" ? "No results found" : "No products yet"}</p>
//                   </td></tr>
//                 ) : filtered.map((p, i) => {
//                   const sku    = p.sku || p.base_sku || "—";
//                   const images = p.images || [];
//                   const src    = detectSource(p);
//                   const inc    = isIncomplete(p);
//                   return (
//                     <tr key={i}
//                       style={{ borderBottom: `1px solid ${T.border}`, transition: "background .12s", background: T.surface }}
//                       onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
//                       onMouseLeave={e => e.currentTarget.style.background = T.surface}>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle" }}><Tag>{sku}</Tag></td>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
//                         <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
//                           <span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{p.product_name}</span>
//                           {inc && <span style={{ padding: "1px 7px", borderRadius: 20, background: T.amberLight, border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: 9, fontWeight: 700 }}>⚠ Incomplete</span>}
//                         </div>
//                         {p.description && <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</p>}
//                       </td>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
//                         <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
//                           <SourceBadge source={src} compact />
//                           {src === "vendor" && p.vendor_name && <span style={{ fontSize: 11, color: T.textMuted }}>{p.vendor_name}</span>}
//                           {src === "grn"    && p.grn_no      && <span style={{ fontFamily: "monospace", fontSize: 10, color: T.amber }}>{p.grn_no}</span>}
//                         </div>
//                       </td>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle", fontWeight: 600, fontSize: 13, color: p.division ? T.text : T.border }}>{p.division || "—"}</td>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
//                         <span style={{ fontWeight: 600, fontSize: 13, color: p.section ? T.text : T.border }}>{p.section || "—"}</span>
//                         {p.department && <p style={{ fontSize: 11, color: T.textMuted, margin: "2px 0 0" }}>{p.department}</p>}
//                       </td>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
//                         {p.has_variants ? (
//                           <div>
//                             <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.brandLight, border: `1px solid ${T.brandBorder}`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: T.brand }}>
//                               <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.brand }} />
//                               {p.variant_type === "color" ? "Color" : "Size + Color"}
//                             </span>
//                             <p style={{ fontFamily: "monospace", fontSize: 10, color: T.textMuted, margin: "4px 0 0" }}>{(p.variants || []).length} variant{(p.variants || []).length !== 1 ? "s" : ""}</p>
//                           </div>
//                         ) : <span style={{ fontSize: 12, color: T.border }}>Simple</span>}
//                       </td>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
//                         <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
//                           {images.slice(0, 3).map((s, j) => (
//                             <img key={j} src={s} alt="" style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.border}`, objectFit: "cover" }} />
//                           ))}
//                           {images.length > 3 && (
//                             <div style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.border}`, background: T.slate100, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: T.textMid }}>+{images.length - 3}</div>
//                           )}
//                           {images.length === 0 && <span style={{ fontSize: 11, color: T.border }}>—</span>}
//                         </div>
//                       </td>

//                       <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
//                         <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
//                           <button onClick={() => setSelectedProduct(p)}
//                             style={{ padding: "5px 13px", borderRadius: 7, border: `1px solid ${T.brandBorder}`, background: T.brandLight, color: T.brand, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s", whiteSpace: "nowrap" }}
//                             onMouseEnter={e => { e.currentTarget.style.background = T.brand; e.currentTarget.style.color = T.white; }}
//                             onMouseLeave={e => { e.currentTarget.style.background = T.brandLight; e.currentTarget.style.color = T.brand; }}>
//                             👁 View
//                           </button>
//                           <button onClick={() => handleEdit(p)}
//                             style={{ padding: "5px 13px", borderRadius: 7, border: `1px solid ${T.blueBorder}`, background: T.blueLight, color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s", whiteSpace: "nowrap" }}
//                             onMouseEnter={e => { e.currentTarget.style.background = T.blue; e.currentTarget.style.color = T.white; }}
//                             onMouseLeave={e => { e.currentTarget.style.background = T.blueLight; e.currentTarget.style.color = T.blue; }}>
//                             ✏ Edit
//                           </button>
//                           <button onClick={() => deleteProduct(p)}
//                             style={{ padding: "5px 9px", borderRadius: 7, border: `1px solid ${T.redBorder}`, background: T.redLight, color: T.red, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s" }}
//                             onMouseEnter={e => { e.currentTarget.style.background = T.red; e.currentTarget.style.color = T.white; }}
//                             onMouseLeave={e => { e.currentTarget.style.background = T.redLight; e.currentTarget.style.color = T.red; }}>
//                             🗑
//                           </button>
//                         </div>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       </div>

//       {/* Modal — rendered outside all overflow:hidden ancestors */}
//       {selectedProduct && (
//         <ProductModal
//           product={selectedProduct}
//           onClose={() => setSelectedProduct(null)}
//           onSaved={fetchProducts}
//         />
//       )}
//     </div>
//   );
// }



import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import QuickFillPanel from "../Quickfillpanel";
import BarcodeStickerPrint from "../BarcodeStickerPrint";

const API_BASE = `${APP_API_URL}`;

const getToken = () =>
  localStorage.getItem("admin_token") || localStorage.getItem("token") || "";

const calcMargin = (cp, sp) => {
  const c = parseFloat(cp), s = parseFloat(sp);
  if (!c || !s || c <= 0) return null;
  return (((s - c) / c) * 100).toFixed(1);
};

function detectSource(p) {
  if (p.source === "grn" || p.created_by === "GRN") return "grn";
  if (p.source === "vendor") return "vendor";
  if (!p.source && (p.vendor_name || p.vendor_id)) return "vendor";
  return "admin";
}

/* ─── Design tokens ──────────────────────────────────────────────── */
const T = {
  bg:           "#FAFAFA",
  surface:      "#FFFFFF",
  surfaceHover: "#F5F7FF",
  border:       "#E8ECF4",
  brand:        "#5B5FEF",
  brandDark:    "#4347CC",
  brandLight:   "#EEEFFE",
  brandBorder:  "#C5C8F8",
  amber:        "#C97D00",
  amberLight:   "#FEF8E7",
  amberBorder:  "#F5D97A",
  green:        "#0D9974",
  greenLight:   "#E8FAF4",
  greenBorder:  "#A0EDD4",
  red:          "#D93025",
  redLight:     "#FFF0EE",
  redBorder:    "#FFCCC9",
  blue:         "#1A6FDB",
  blueLight:    "#EEF5FF",
  blueBorder:   "#BFDBFE",
  text:         "#0E1117",
  textMid:      "#4A5168",
  textMuted:    "#8C93AB",
  white:        "#FFFFFF",
  slate50:      "#F8FAFC",
  slate100:     "#F1F5F9",
  slate200:     "#E2E8F0",
};

/* ─── Micro components ───────────────────────────────────────────── */
const Tag = ({ children, color = T.brand, bg = T.brandLight, border = T.brandBorder }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    padding: "2px 8px", borderRadius: 6,
    background: bg, border: `1px solid ${border}`,
    fontFamily: "monospace", fontSize: 11, fontWeight: 600, color,
  }}>{children}</span>
);

const SectionHead = ({ children }) => (
  <div style={{ marginTop: 22, marginBottom: 10 }}>
    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: T.brand }}>{children}</span>
    <div style={{ height: 1, background: `linear-gradient(90deg, ${T.brandBorder}, transparent)`, marginTop: 5 }} />
  </div>
);

const fmt = (n) => { const x = parseFloat(n); return isNaN(x) ? "—" : `₹${x.toFixed(2)}`; };

function PriceCard({ label, value, accent }) {
  return (
    <div style={{ background: accent.bg, border: `1px solid ${accent.border}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", color: accent.muted, marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: "monospace", fontSize: 17, fontWeight: 800, color: accent.color }}>{fmt(value)}</div>
    </div>
  );
}

function SourceBadge({ source, compact = false }) {
  const pad = compact ? "2px 7px" : "3px 11px";
  const sz  = compact ? 10 : 11;
  if (source === "grn")
    return <span style={{ display: "inline-block", padding: pad, borderRadius: 20, background: T.amberLight, border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: sz, fontWeight: 700 }}>GRN</span>;
  if (source === "vendor")
    return <span style={{ display: "inline-block", padding: pad, borderRadius: 20, background: T.greenLight, border: `1px solid ${T.greenBorder}`, color: T.green, fontSize: sz, fontWeight: 700 }}>Vendor</span>;
  return <span style={{ display: "inline-block", padding: pad, borderRadius: 20, background: T.brandLight, border: `1px solid ${T.brandBorder}`, color: T.brand, fontSize: sz, fontWeight: 700 }}>Admin</span>;
}

function MissingPill({ label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, background: T.amberLight, border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: 11, fontWeight: 600 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.amber, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function VariantRow({ v, variantType }) {
  const margin = calcMargin(v.cost_price, v.selling_price);
  const mColor = margin === null ? T.textMuted : parseFloat(margin) < 0 ? T.red : parseFloat(margin) >= 20 ? T.green : T.amber;
  return (
    <tr style={{ borderBottom: `1px solid ${T.border}` }}
      onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <td style={{ padding: "9px 12px" }}><Tag>{v.sku || "—"}</Tag></td>
      <td style={{ padding: "9px 12px" }}><Tag color={T.textMid} bg={T.slate100} border={T.slate200}>{v.barcode || "—"}</Tag></td>
      {variantType === "size_color" && <td style={{ padding: "9px 12px" }}><Tag>{v.size_label || "—"}</Tag></td>}
      <td style={{ padding: "9px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: v.color || "#ccc", border: "1px solid rgba(0,0,0,0.12)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: T.textMid, fontFamily: "monospace" }}>{v.color || "—"}</span>
        </div>
      </td>
      <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 12, color: T.textMid }}>{fmt(v.cost_price)}</td>
      <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 12, color: T.brand, fontWeight: 600 }}>{fmt(v.mrp)}</td>
      <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: parseFloat(v.selling_price) < parseFloat(v.cost_price) ? T.red : T.green }}>{fmt(v.selling_price)}</td>
      <td style={{ padding: "9px 12px" }}>
        {margin !== null
          ? <span style={{ background: mColor + "18", border: `1px solid ${mColor}40`, borderRadius: 6, padding: "2px 7px", fontFamily: "monospace", fontSize: 11, color: mColor, fontWeight: 700 }}>{margin}%</span>
          : <span style={{ color: T.border }}>—</span>}
      </td>
      <td style={{ padding: "9px 12px" }}>
        <span style={{ background: T.blueLight, border: `1px solid ${T.blueBorder}`, borderRadius: 6, padding: "2px 7px", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: T.blue }}>{v.stock ?? 0}</span>
      </td>
      <td style={{ padding: "9px 12px", fontSize: 11, color: T.textMuted }}>{v.unit || "pcs"}</td>
    </tr>
  );
}

/* ─── ProductModal — rendered via portal to escape overflow:hidden ── */
function ProductModal({ product, onClose, onSaved }) {
  const [lightbox,  setLightbox]  = useState(null);
  const [tab,       setTab]       = useState("details");
  const [visible,   setVisible]   = useState(false);
  const [printOpen, setPrintOpen] = useState(false);  // ← ADDED

  /* Animate in after mount */
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  /* Lock body scroll */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* Escape key */
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const sku     = product.sku || product.base_sku || "—";
  const barcode = product.barcode || product.base_barcode || "—";
  const images  = product.images || [];
  const source  = detectSource(product);

  const getMissingFields = (p) => {
    const effectiveSku = p.sku || p.base_sku || "";
    const allFields = p.has_variants
      ? ["division", "section", "department", "hsn_code"]
      : ["division", "section", "department", "hsn_code", "sku", "mrp", "selling_price"];
    const labels = { division: "Division", section: "Section", department: "Department", hsn_code: "HSN Code", sku: "SKU", mrp: "MRP", selling_price: "Selling Price" };
    return allFields
      .filter(f => { const v = f === "sku" ? effectiveSku : p[f]; return !v || v === 0; })
      .map(f => labels[f]);
  };

  const missingFields = getMissingFields(product);
  const incomplete    = missingFields.length > 0;
  const tabs = [
    { key: "details", label: "Details" },
    ...(incomplete ? [{ key: "fill", label: `Fix (${missingFields.length})` }] : []),
  ];

  /* ← ADDED: sticker items — 1 per simple product, 1 per variant */
  const stickerItems = !product.has_variants
    ? [{ barcode: product.barcode || product.base_barcode || "", name: product.product_name, sku: product.sku || product.base_sku || "", rate: product.selling_price || product.mrp || 0, division: product.division || "" }]
    : (product.variants || []).map(v => ({ barcode: v.barcode || "", name: product.product_name, sku: v.sku || "", rate: v.selling_price || v.mrp || 0, size_label: v.size_label || "", color: v.color || "", division: product.division || "" }));

  const margin = !product.has_variants ? calcMargin(product.cost_price, product.selling_price) : null;
  const mColor = margin === null ? T.textMuted : parseFloat(margin) < 0 ? T.red : parseFloat(margin) >= 20 ? T.green : T.amber;

  /* ── The actual UI ── */
  const modal = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 99998,
          background: "rgba(10,14,22,0.65)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          transition: "opacity .22s ease",
          opacity: visible ? 1 : 0,
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: visible
            ? "translate(-50%, -50%) scale(1)"
            : "translate(-50%, -48%) scale(0.96)",
          zIndex: 99999,
          width: "calc(100vw - 40px)",
          maxWidth: 840,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 20,
          background: T.surface,
          border: `1px solid ${T.border}`,
          boxShadow: "0 32px 80px rgba(10,14,22,0.28), 0 6px 20px rgba(10,14,22,0.12)",
          overflow: "hidden",
          transition: "transform .28s cubic-bezier(.16,1,.3,1), opacity .22s ease",
          opacity: visible ? 1 : 0,
        }}
      >
        {/* ══ HEADER ══ */}
        <div style={{
          flexShrink: 0,
          padding: "20px 24px 0",
          borderBottom: `1px solid ${T.border}`,
          background: T.surface,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            {/* Icon */}
            <div style={{
              flexShrink: 0, width: 44, height: 44, borderRadius: 12,
              background: T.brandLight, border: `1px solid ${T.brandBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
            }}>📦</div>

            {/* Name + tags */}
            <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 7 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.3, wordBreak: "break-word" }}>
                  {product.product_name}
                </h2>
                {incomplete && (
                  <span style={{ padding: "2px 8px", borderRadius: 20, background: T.amberLight, border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: 10, fontWeight: 700 }}>⚠ Incomplete</span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <Tag>{sku}</Tag>
                <Tag color={T.textMid} bg={T.slate100} border={T.slate200}>{barcode}</Tag>
                {product.has_variants && (
                  <Tag>{product.variant_type === "color" ? "Color variants" : "Size + Color variants"}</Tag>
                )}
                <SourceBadge source={source} />
              </div>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              style={{
                flexShrink: 0, width: 32, height: 32, borderRadius: 8,
                border: `1px solid ${T.border}`, background: T.surface,
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 15, color: T.textMuted,
                transition: "all .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.redLight; e.currentTarget.style.color = T.red; e.currentTarget.style.borderColor = T.redBorder; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.surface; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; }}
            >✕</button>
          </div>

          {/* Tab bar — UNCHANGED + Print Stickers added on the right */}
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            {tabs.map(({ key, label }) => {
              const active = tab === key;
              const isFill = key === "fill";
              return (
                <button key={key} onClick={() => setTab(key)} style={{
                  padding: "9px 20px", border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 700, borderRadius: "8px 8px 0 0",
                  transition: "all .15s",
                  background: active ? (isFill ? T.amberLight : T.brandLight) : "transparent",
                  color: active ? (isFill ? T.amber : T.brand) : T.textMuted,
                  borderBottom: active ? `2px solid ${isFill ? T.amber : T.brand}` : "2px solid transparent",
                  marginBottom: -1,
                }}>{label}</button>
              );
            })}

            {/* ← ADDED: Print Stickers button, pushed right */}
            <button
              onClick={() => setPrintOpen(true)}
              style={{
                marginLeft: "auto", marginBottom: -1,
                padding: "7px 16px", border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 700, borderRadius: "8px 8px 0 0",
                background: "#FEF3C7", color: "#D97706",
                borderBottom: "2px solid #F59E0B",
                display: "flex", alignItems: "center", gap: 6,
                transition: "all .15s",
              }}
              title="Print barcode stickers for this product"
            >
              🏷️ Print Stickers{product.has_variants ? ` (${(product.variants || []).length})` : ""}
            </button>
          </div>
        </div>

        {/* ══ BODY — scrollable ══ */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "22px 24px 28px" }}>

          {/* ── FILL TAB ── */}
          {tab === "fill" && incomplete && (
            <div>
              <div style={{
                marginBottom: 18, padding: "14px 18px", borderRadius: 12,
                background: T.amberLight, border: `1px solid ${T.amberBorder}`,
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#78350F", marginBottom: 6 }}>
                    {missingFields.length} field{missingFields.length !== 1 ? "s" : ""} need attention
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {missingFields.map(f => <MissingPill key={f} label={f} />)}
                  </div>
                </div>
              </div>

              {source === "grn" && (
                <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "#F0F9FF", border: "1px solid #BAE6FD", fontSize: 12, color: "#0369A1", fontWeight: 600 }}>
                  📋 Auto-created from GRN {product.grn_no || ""} — complete classification below
                </div>
              )}

              <div style={{ borderRadius: 14, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", background: `linear-gradient(135deg, ${T.brand}, ${T.brandDark})`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>✏️</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Complete Product Details</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginLeft: "auto" }}>{product.product_name}</span>
                </div>
                <div style={{ padding: 18 }}>
                  <QuickFillPanel product={product} onSaved={() => { onSaved && onSaved(); onClose(); }} />
                </div>
              </div>
            </div>
          )}

          {/* ── DETAILS TAB ── */}
          {tab === "details" && (
            <>
              {/* Source strip */}
              {source === "grn" && (
                <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: T.amberLight, border: `1px solid ${T.amberBorder}` }}>
                  <span style={{ fontSize: 20 }}>📋</span>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.amber, marginBottom: 2 }}>Added via GRN Inward</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#78350F" }}>{product.grn_no || "—"}{product.vendor_name ? ` · ${product.vendor_name}` : ""}</div>
                  </div>
                </div>
              )}
              {source === "vendor" && (
                <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: T.greenLight, border: `1px solid ${T.greenBorder}` }}>
                  <span style={{ fontSize: 20 }}>🏪</span>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.green, marginBottom: 2 }}>Added by Vendor</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#065F46" }}>{product.vendor_name || product.vendor_id || "—"}</div>
                  </div>
                </div>
              )}

              {/* Classification */}
              <SectionHead>Classification</SectionHead>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 4 }}>
                {[["Division", product.division], ["Section", product.section], ["Department", product.department], ["HSN Code", product.hsn_code]].map(([label, val]) => (
                  <div key={label} style={{ background: val ? T.slate50 : T.amberLight, border: `1px solid ${val ? T.border : T.amberBorder}`, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: T.textMuted, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: val ? T.text : T.amber }}>{val || "—"}</div>
                  </div>
                ))}
              </div>

              {/* Pricing */}
              {!product.has_variants && (
                <>
                  <SectionHead>Pricing</SectionHead>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <PriceCard label="Cost Price"    value={product.cost_price}    accent={{ bg: T.slate50,    border: T.border,      color: T.textMid, muted: T.textMuted }} />
                    <PriceCard label="MRP"           value={product.mrp}           accent={{ bg: T.brandLight, border: T.brandBorder, color: T.brand,   muted: T.brand }} />
                    <PriceCard label="Selling Price" value={product.selling_price} accent={{ bg: T.greenLight, border: T.greenBorder, color: T.green,   muted: T.green }} />
                  </div>
                  {margin !== null && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "7px 14px", borderRadius: 8, background: mColor + "14", border: `1px solid ${mColor}30`, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: mColor, opacity: 0.7 }}>Margin</span>
                      <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 800, color: mColor }}>{margin}%</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: mColor }}>
                        {parseFloat(margin) < 0 ? "⚠ Selling at loss" : parseFloat(margin) >= 20 ? "✓ Healthy" : "↑ Low margin"}
                      </span>
                    </div>
                  )}

                  <SectionHead>Inventory</SectionHead>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 20, padding: "12px 18px", borderRadius: 10, background: T.blueLight, border: `1px solid ${T.blueBorder}`, marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 2 }}>Stock</div>
                      <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 800, color: T.blue }}>{product.quantity ?? 0}</div>
                    </div>
                    <div style={{ width: 1, height: 32, background: T.blueBorder }} />
                    <div>
                      <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 2 }}>Unit</div>
                      <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: T.blue }}>{product.unit || "pcs"}</div>
                    </div>
                  </div>
                </>
              )}

              {/* Images */}
              {images.length > 0 && (
                <>
                  <SectionHead>Images</SectionHead>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
                    {images.map((src, i) => (
                      <img key={i} src={src} alt=""
                        onClick={() => setLightbox(src)}
                        style={{ width: 68, height: 68, borderRadius: 10, border: `1px solid ${T.border}`, objectFit: "cover", cursor: "pointer", transition: "transform .15s" }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.07)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Description */}
              {product.description && (
                <>
                  <SectionHead>Description</SectionHead>
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: T.slate50, border: `1px solid ${T.border}`, fontSize: 13, color: T.textMid, lineHeight: 1.7, marginBottom: 4 }}>{product.description}</div>
                </>
              )}

              {/* Specification */}
              {product.specification && (
                <>
                  <SectionHead>Specification</SectionHead>
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: T.slate50, border: `1px solid ${T.border}`, fontSize: 13, color: T.textMid, lineHeight: 1.7, marginBottom: 4 }}>{product.specification}</div>
                </>
              )}

              {/* Variants */}
              {product.has_variants && (product.variants || []).length > 0 && (
                <>
                  <SectionHead>
                    Variants &nbsp;
                    <span style={{ background: T.brandLight, border: `1px solid ${T.brandBorder}`, borderRadius: 20, padding: "1px 9px", fontFamily: "monospace", fontSize: 11, color: T.brand }}>{product.variants.length}</span>
                  </SectionHead>
                  <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}` }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ minWidth: 780, width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: `linear-gradient(135deg, ${T.brand}, ${T.brandDark})` }}>
                            {["SKU", "Barcode", ...(product.variant_type === "size_color" ? ["Size"] : []), "Color", "Cost", "MRP", "Selling", "Margin", "Stock", "Unit"].map(h => (
                              <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {product.variants.map((v, i) => <VariantRow key={i} v={v} variantType={product.variant_type} />)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ← ADDED: Sticker Print Modal */}
      {printOpen && (
        <BarcodeStickerPrint
          items={stickerItems}
          onClose={() => setPrintOpen(false)}
          storeName=""
        />
      )}

      {/* Lightbox */}
      {lightbox && ReactDOM.createPortal(
        <div
          style={{ position: "fixed", inset: 0, zIndex: 999999, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, cursor: "pointer" }}
          onClick={() => setLightbox(null)}>
          <button
            style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", borderRadius: 8, width: 38, height: 38 }}
            onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox} alt="" style={{ maxHeight: "88vh", maxWidth: "90vw", borderRadius: 14 }} onClick={e => e.stopPropagation()} />
        </div>,
        document.body
      )}
    </>
  );

  return ReactDOM.createPortal(modal, document.body);
}

/* ─── isIncomplete ───────────────────────────────────────────────── */
const isIncomplete = (p) => {
  const effectiveSku = p.sku || p.base_sku || "";
  const fields = p.has_variants
    ? ["division", "section", "department", "hsn_code"]
    : ["division", "section", "department", "hsn_code", "mrp", "selling_price"];
  return fields.some(f => {
    const v = f === "sku" ? effectiveSku : p[f];
    return v === undefined || v === null || v === "" || v === 0;
  });
};

/* ─── Main ProductList ───────────────────────────────────────────── */
export default function ProductList({ embedded = false, onAddProduct, onEditProduct }) {
  const [products,        setProducts]        = useState([]);
  const [search,          setSearch]          = useState("");
  const [sourceTab,       setSourceTab]       = useState("all");
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const navigate = useNavigate();

  const fetchProducts = async () => {
    setLoading(true); setError("");
    try {
      const token = getToken();
      if (!token) { setError("Not authenticated. Please log in again."); return; }

      const [prodRes, invRes] = await Promise.all([
        axios.get(`${API_BASE}/api/products/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/inventory/current-stock`).catch(() => ({ data: { data: [] } })),
      ]);

      const invRows = invRes.data?.data || [];
      const invMap  = {};
      for (const row of invRows) { if (row.barcode) invMap[row.barcode] = row.qty; }
      const invBarcodes    = new Set(invRows.map(r => r.barcode).filter(Boolean));
      const invVendorNames = new Set(invRows.map(r => r.vendor_name).filter(Boolean));

      const result = [];
      for (const p of (prodRes.data.data || [])) {
        const source     = (p.source || "").toLowerCase();
        const created_by = (p.created_by || "").toUpperCase();
        const isVendor   = source === "vendor" || created_by === "VENDOR" ||
                           (p.vendor_id && !["grn", "admin"].includes(source));

        if (!isVendor) {
          if (!p.has_variants) {
            const lq = invMap[p.barcode];
            result.push(lq !== undefined ? { ...p, quantity: lq } : p);
          } else {
            result.push({ ...p, variants: (p.variants || []).map(v => { const lq = invMap[v.barcode]; return lq !== undefined ? { ...v, stock: lq } : v; }) });
          }
          continue;
        }

        if (!p.has_variants) {
          const barcode  = p.barcode || p.base_barcode || "";
          const inducted = invBarcodes.has(barcode);
          if (!inducted) continue;
          const lq = invMap[barcode];
          result.push(lq !== undefined ? { ...p, quantity: lq } : p);
        } else {
          const inducted = (p.variants || []).filter(v => { const vbc = (v.barcode || "").trim(); return vbc && invBarcodes.has(vbc); });
          const vName    = (p.vendor_name || "").trim();
          const hasVendorRows = vName && invRows.some(r => r.vendor_name === vName && invBarcodes.has(r.barcode));
          if (inducted.length === 0 && !hasVendorRows) continue;
          if (inducted.length > 0) {
            result.push({ ...p, variants: inducted.map(v => { const lq = invMap[v.barcode]; return lq !== undefined ? { ...v, stock: lq } : v; }) });
          } else {
            result.push({ ...p, variants: [] });
          }
        }
      }
      setProducts(result);
    } catch (err) {
      setError(err.response?.status === 401 ? "Session expired. Please log in again." : "Failed to load products.");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, []);

  const counts = {
    all:    products.length,
    admin:  products.filter(p => detectSource(p) === "admin").length,
    vendor: products.filter(p => detectSource(p) === "vendor").length,
    grn:    products.filter(p => detectSource(p) === "grn").length,
  };

  const filtered = products.filter(p => {
    if (sourceTab !== "all" && detectSource(p) !== sourceTab) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    const sku = (p.sku || p.base_sku || "").toLowerCase();
    const bc  = (p.barcode || p.base_barcode || "").toLowerCase();
    return p.product_name?.toLowerCase().includes(q) || sku.includes(q) || bc.includes(q) ||
      p.division?.toLowerCase().includes(q) || p.section?.toLowerCase().includes(q) ||
      (p.vendor_name || "").toLowerCase().includes(q) || (p.grn_no || "").toLowerCase().includes(q);
  });

  const deleteProduct = async (p) => {
    const sku = p.sku || p.base_sku;
    if (!window.confirm(`Delete "${p.product_name}"?`)) return;
    try {
      await axios.delete(`${API_BASE}/api/products/${sku}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      fetchProducts();
    } catch { alert("Failed to delete product"); }
  };

  const handleOpenAdd = () => { if (embedded && onAddProduct) { onAddProduct(); return; } navigate("/products/add"); };
  const handleEdit    = (p)  => { if (embedded && onEditProduct) { onEditProduct(p); return; } navigate(`/products/edit/${p.sku || p.base_sku}`); };

  const tabBtn = (key, activeColor) => ({
    padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700,
    cursor: "pointer", transition: "all .15s",
    background: sourceTab === key ? activeColor : T.surface,
    color:      sourceTab === key ? T.white     : T.textMid,
    boxShadow:  sourceTab === key ? `0 2px 8px ${activeColor}40` : "none",
    outline:    sourceTab === key ? "none"      : `1px solid ${T.border}`,
  });

  return (
    <div style={{ minHeight: embedded ? 0 : "100vh", background: embedded ? "transparent" : T.bg, padding: embedded ? 0 : "20px 24px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18, padding: "16px 22px", borderRadius: 14, background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 2px 12px rgba(91,95,239,0.06)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: `linear-gradient(135deg, ${T.brand}, ${T.brandDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📦</div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: T.text, margin: 0, letterSpacing: "-0.4px" }}>Product Master</h1>
              <p style={{ fontSize: 12, color: T.textMuted, margin: "2px 0 0" }}>{counts.all} total · {counts.admin} admin · {counts.vendor} vendor · {counts.grn} GRN</p>
            </div>
          </div>
          <button
            onClick={handleOpenAdd}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 20px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${T.brand}, ${T.brandDark})`, color: T.white, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${T.brand}35`, transition: "all .15s" }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
            ＋ Add Product
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "11px 16px", borderRadius: 10, background: T.redLight, border: `1px solid ${T.redBorder}`, fontSize: 13, color: T.red }}>⚠ {error}</div>
        )}

        {/* Tabs + search */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, flexWrap: "wrap" }}>
          <button style={tabBtn("all",    T.brand)}   onClick={() => setSourceTab("all")}>All ({counts.all})</button>
          <button style={tabBtn("admin",  T.textMid)} onClick={() => setSourceTab("admin")}>Admin ({counts.admin})</button>
          <button style={tabBtn("vendor", T.green)}   onClick={() => setSourceTab("vendor")}>Vendor ({counts.vendor})</button>
          <button style={tabBtn("grn",    T.amber)}   onClick={() => setSourceTab("grn")}>GRN ({counts.grn})</button>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 13px", minWidth: 270 }}>
            <span style={{ color: T.textMuted, fontSize: 13 }}>🔍</span>
            <input type="text" placeholder="Search name, SKU, barcode, vendor, GRN…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, color: T.text, width: "100%" }} />
            {search && <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", color: T.textMuted, fontSize: 13 }}>✕</button>}
          </div>
        </div>

        {/* Table */}
        <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${T.border}`, background: T.surface, boxShadow: "0 2px 16px rgba(14,17,23,0.04)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 960, width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: `linear-gradient(135deg, ${T.brand} 0%, ${T.brandDark} 100%)` }}>
                  {["SKU", "Product", "Source", "Division", "Section / Dept", "Variants", "Images", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: h === "Actions" ? "center" : "left", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.82)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: "56px 20px", textAlign: "center", color: T.textMuted }}>
                    <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.35 }}>⏳</div>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>Loading products…</p>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: "56px 20px", textAlign: "center", color: T.textMuted }}>
                    <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.25 }}>📭</div>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{search || sourceTab !== "all" ? "No results found" : "No products yet"}</p>
                  </td></tr>
                ) : filtered.map((p, i) => {
                  const sku    = p.sku || p.base_sku || "—";
                  const images = p.images || [];
                  const src    = detectSource(p);
                  const inc    = isIncomplete(p);
                  return (
                    <tr key={i}
                      style={{ borderBottom: `1px solid ${T.border}`, transition: "background .12s", background: T.surface }}
                      onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
                      onMouseLeave={e => e.currentTarget.style.background = T.surface}>

                      <td style={{ padding: "13px 16px", verticalAlign: "middle" }}><Tag>{sku}</Tag></td>

                      <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{p.product_name}</span>
                          {inc && <span style={{ padding: "1px 7px", borderRadius: 20, background: T.amberLight, border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: 9, fontWeight: 700 }}>⚠ Incomplete</span>}
                        </div>
                        {p.description && <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</p>}
                      </td>

                      <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <SourceBadge source={src} compact />
                          {src === "vendor" && p.vendor_name && <span style={{ fontSize: 11, color: T.textMuted }}>{p.vendor_name}</span>}
                          {src === "grn"    && p.grn_no      && <span style={{ fontFamily: "monospace", fontSize: 10, color: T.amber }}>{p.grn_no}</span>}
                        </div>
                      </td>

                      <td style={{ padding: "13px 16px", verticalAlign: "middle", fontWeight: 600, fontSize: 13, color: p.division ? T.text : T.border }}>{p.division || "—"}</td>

                      <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: p.section ? T.text : T.border }}>{p.section || "—"}</span>
                        {p.department && <p style={{ fontSize: 11, color: T.textMuted, margin: "2px 0 0" }}>{p.department}</p>}
                      </td>

                      <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
                        {p.has_variants ? (
                          <div>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.brandLight, border: `1px solid ${T.brandBorder}`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: T.brand }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.brand }} />
                              {p.variant_type === "color" ? "Color" : "Size + Color"}
                            </span>
                            <p style={{ fontFamily: "monospace", fontSize: 10, color: T.textMuted, margin: "4px 0 0" }}>{(p.variants || []).length} variant{(p.variants || []).length !== 1 ? "s" : ""}</p>
                          </div>
                        ) : <span style={{ fontSize: 12, color: T.border }}>Simple</span>}
                      </td>

                      <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          {images.slice(0, 3).map((s, j) => (
                            <img key={j} src={s} alt="" style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.border}`, objectFit: "cover" }} />
                          ))}
                          {images.length > 3 && (
                            <div style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.border}`, background: T.slate100, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: T.textMid }}>+{images.length - 3}</div>
                          )}
                          {images.length === 0 && <span style={{ fontSize: 11, color: T.border }}>—</span>}
                        </div>
                      </td>

                      <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <button onClick={() => setSelectedProduct(p)}
                            style={{ padding: "5px 13px", borderRadius: 7, border: `1px solid ${T.brandBorder}`, background: T.brandLight, color: T.brand, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s", whiteSpace: "nowrap" }}
                            onMouseEnter={e => { e.currentTarget.style.background = T.brand; e.currentTarget.style.color = T.white; }}
                            onMouseLeave={e => { e.currentTarget.style.background = T.brandLight; e.currentTarget.style.color = T.brand; }}>
                            👁 View
                          </button>
                          <button onClick={() => handleEdit(p)}
                            style={{ padding: "5px 13px", borderRadius: 7, border: `1px solid ${T.blueBorder}`, background: T.blueLight, color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s", whiteSpace: "nowrap" }}
                            onMouseEnter={e => { e.currentTarget.style.background = T.blue; e.currentTarget.style.color = T.white; }}
                            onMouseLeave={e => { e.currentTarget.style.background = T.blueLight; e.currentTarget.style.color = T.blue; }}>
                            ✏ Edit
                          </button>
                          <button onClick={() => deleteProduct(p)}
                            style={{ padding: "5px 9px", borderRadius: 7, border: `1px solid ${T.redBorder}`, background: T.redLight, color: T.red, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = T.red; e.currentTarget.style.color = T.white; }}
                            onMouseLeave={e => { e.currentTarget.style.background = T.redLight; e.currentTarget.style.color = T.red; }}>
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal — rendered outside all overflow:hidden ancestors */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onSaved={fetchProducts}
        />
      )}
    </div>
  );
}