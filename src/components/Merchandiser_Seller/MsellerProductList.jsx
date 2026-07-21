import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

// import React, { useEffect, useState } from "react";
// import axios from "axios";
// import { useNavigate } from "react-router-dom";

// const API_BASE = `${APP_API_URL}`;

// import AddProduct from "./MsellerAddProduct"; 

// // â”€â”€â”€ Helpers â”€â”€â”€
// Legacy formatter (inactive copy).
// const calcMargin = (cp, sp) => {
//   const c = parseFloat(cp),
//     s = parseFloat(sp);
//   if (!c || !s || c <= 0) return null;
//   return (((s - c) / c) * 100).toFixed(1);
// };

// // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// // Helper: get token from localStorage
// // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// const getAuthHeaders = () => {
//   const token =
//     localStorage.getItem("vendor_token") ||
//     localStorage.getItem("admin_token") ||
//     localStorage.getItem("token");

//   return token
//     ? { Authorization: `Bearer ${token}` }
//     : {};
// };

// // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// // Helper: is the current user a vendor?
// // Decodes the JWT payload without a library.
// // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// const getTokenPayload = () => {
//   try {
//     const token = localStorage.getItem("token");
//     if (!token) return null;
//     const payload = token.split(".")[1];
//     return JSON.parse(atob(payload));
//   } catch {
//     return null;
//   }
// };

// const isVendorUser = () => {
//   const p = getTokenPayload();
//   return !!(p && p.vendor_id);
// };

// // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// // PriceCard â€” for simple products
// // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// function PriceCard({ label, value, type }) {
//   const styles = {
//     cp: "bg-slate-50 border-slate-200 text-slate-700",
//     mrp: "bg-indigo-50 border-indigo-200 text-indigo-700",
//     sp: "bg-emerald-50 border-emerald-200 text-emerald-700",
//   };

//   return (
//     <div className={`rounded-xl border p-3 ${styles[type] || styles.cp}`}>
//       <p className="mb-1 text-[10px] font-bold uppercase tracking-[1px] text-slate-600">
//         {label}
//       </p>
//       <p className="font-mono text-[15px] font-bold">{fmt(value)}</p>
//     </div>
//   );
// }

// // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// // VariantRow â€” single row in variants table
// // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// function VariantRow({ v, variantType }) {
//   const margin = calcMargin(v.cost_price, v.selling_price);
//   const marginClass =
//     margin === null
//       ? ""
//       : parseFloat(margin) < 0
//       ? "bg-red-50 text-red-700 border-red-200"
//       : parseFloat(margin) >= 20
//       ? "bg-emerald-50 text-emerald-700 border-emerald-200"
//       : "bg-amber-50 text-amber-700 border-amber-200";

//   return (
//     <tr className="border-b border-slate-100 transition hover:bg-slate-50">
//       <td className="px-3 py-3">
//         <span className="inline-block rounded border border-indigo-200 bg-indigo-50 px-2 py-1 font-mono text-[10px] font-medium text-indigo-700">
//           {v.sku || "â€”"}
//         </span>
//       </td>

//       <td className="px-3 py-3">
//         <span className="inline-block rounded border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-500">
//           {v.barcode || "â€”"}
//         </span>
//       </td>

//       {variantType === "size_color" && (
//         <td className="px-3 py-3">
//           <span className="inline-block rounded border border-indigo-200 bg-indigo-50 px-2 py-1 font-mono text-[10px] font-semibold text-indigo-700">
//             {v.size_label || "â€”"}
//           </span>
//           {v.size_value && (
//             <span className="ml-1 font-mono text-[10px] text-slate-400">
//               ({v.size_value})
//             </span>
//           )}
//         </td>
//       )}

//       <td className="px-3 py-3">
//         <span
//           className="mr-2 inline-block h-4 w-4 rounded border border-black/10 align-middle"
//           style={{ backgroundColor: v.color || "transparent" }}
//         />
//         <span className="align-middle font-mono text-[10px] text-slate-500">
//           {v.color || "â€”"}
//         </span>
//       </td>

//       <td className="px-3 py-3">
//         <span className="font-mono text-[11px] text-slate-700">
//           {fmt(v.cost_price)}
//         </span>
//       </td>

//       <td className="px-3 py-3">
//         <span className="font-mono text-[11px] text-slate-700">{fmt(v.mrp)}</span>
//       </td>

//       <td className="px-3 py-3">
//         <span
//           className={`font-mono text-[11px] font-semibold ${
//             parseFloat(v.selling_price) < parseFloat(v.cost_price)
//               ? "text-red-700"
//               : "text-emerald-700"
//           }`}
//         >
//           {fmt(v.selling_price)}
//         </span>
//       </td>

//       <td className="px-3 py-3">
//         {margin !== null ? (
//           <span
//             className={`inline-block rounded border px-2 py-1 font-mono text-[10px] font-semibold ${marginClass}`}
//           >
//             {margin}%
//           </span>
//         ) : (
//           <span className="text-slate-300">â€”</span>
//         )}
//       </td>

//       <td className="px-3 py-3">
//         <span className="inline-block rounded border border-blue-200 bg-blue-50 px-2 py-1 font-mono text-[11px] font-semibold text-blue-700">
//           {v.stock ?? 0}
//         </span>
//       </td>

//       <td className="px-3 py-3">
//         <span className="text-[10px] text-slate-400">{v.unit || "pcs"}</span>
//       </td>
//     </tr>
//   );
// }

// // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// // Product Detail Modal
// // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// function ProductModal({ product, onClose, onEdit, onInvView, onInvEdit, isVendor }) {
//   const [lightbox, setLightbox] = useState(null);

//   const sku = product.sku || product.base_sku || "â€”";
//   const barcode = product.barcode || product.base_barcode || "â€”";
//   const images = product.images || [];

//   const handleOverlayClick = (e) => {
//     if (e.target === e.currentTarget) onClose();
//   };

//   return (
//     <div
//       className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4"
//       onClick={handleOverlayClick}
//     >
//       <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-indigo-100">
//         <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5 sm:px-6">
//           <div className="min-w-0">
//             <h2 className="break-words text-lg font-extrabold leading-snug text-slate-900">
//               {product.product_name}
//             </h2>

//             <div className="mt-2 flex flex-wrap items-center gap-2">
//               <span className="rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-mono text-[11px] font-medium text-indigo-700">
//                 {sku}
//               </span>

//               <span className="rounded border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-500">
//                 ðŸ”– {barcode}
//               </span>

//               {product.has_variants && (
//                 <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-bold text-indigo-700">
//                   {product.variant_type === "color"
//                     ? "Color Variants"
//                     : "Size + Color Variants"}
//                 </span>
//               )}
//             </div>
//           </div>

//           <button
//             className="shrink-0 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
//             onClick={onClose}
//           >
//             âœ•
//           </button>
//         </div>

//         <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
//           <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
//             {[
//               ["Division", product.division || "â€”"],
//               ["Section", product.section || "â€”"],
//               ["Department", product.department || "â€”"],
//               [
//                 "Created",
//                 product.created_at
//                   ? new Date(
//                       product.created_at.$date || product.created_at
//                     ).toLocaleDateString("en-IN", {
//                       day: "2-digit",
//                       month: "short",
//                       year: "numeric",
//                     })
//                   : "â€”",
//               ],
//             ].map(([label, val]) => (
//               <div
//                 key={label}
//                 className="rounded-xl border border-slate-200 bg-slate-50 p-3"
//               >
//                 <p className="mb-1 text-[9px] font-bold uppercase tracking-[1px] text-slate-400">
//                   {label}
//                 </p>
//                 <p className="break-words text-[13px] font-semibold text-slate-900">
//                   {val}
//                 </p>
//               </div>
//             ))}
//           </div>

//           {!product.has_variants && (
//             <>
//               <span className="mb-2 block text-[10px] font-bold uppercase tracking-[2px] text-indigo-700">
//                 Pricing
//               </span>
//               <div className="mb-4 h-[1.5px] rounded-full bg-gradient-to-r from-indigo-200 to-transparent" />

//               <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
//                 <PriceCard label="Cost Price" value={product.cost_price} type="cp" />
//                 <PriceCard label="MRP" value={product.mrp} type="mrp" />
//                 <PriceCard
//                   label="Selling Price"
//                   value={product.selling_price}
//                   type="sp"
//                 />
//               </div>

//               {(() => {
//                 const m = calcMargin(product.cost_price, product.selling_price);
//                 if (m === null) return null;
//                 const isLoss = parseFloat(m) < 0;

//                 return (
//                   <div
//                     className={`mb-5 inline-flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2 font-mono text-[13px] font-semibold ${
//                       isLoss
//                         ? "border-red-200 bg-red-50 text-red-700"
//                         : "border-emerald-200 bg-emerald-50 text-emerald-700"
//                     }`}
//                   >
//                     <span className="text-[10px] uppercase tracking-[0.8px] opacity-70">
//                       Margin
//                     </span>
//                     <span>{m}%</span>
//                     <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px]">
//                       {isLoss
//                         ? "âš  Loss"
//                         : parseFloat(m) >= 20
//                         ? "âœ“ Healthy"
//                         : "â†‘ Low"}
//                     </span>
//                   </div>
//                 );
//               })()}

//               <span className="mb-2 block text-[10px] font-bold uppercase tracking-[2px] text-indigo-700">
//                 Inventory
//               </span>
//               <div className="mb-4 h-[1.5px] rounded-full bg-gradient-to-r from-indigo-200 to-transparent" />

//               <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-700">
//                 <span>Stock</span>
//                 <b className="font-mono">{product.quantity ?? 0}</b>
//                 <span className="text-[11px] text-slate-400">Â·</span>
//                 <span>Unit</span>
//                 <b className="font-mono">{product.unit || "pcs"}</b>
//               </div>
//             </>
//           )}

//           {images.length > 0 && (
//             <>
//               <span className="mb-2 block text-[10px] font-bold uppercase tracking-[2px] text-indigo-700">
//                 Images
//               </span>
//               <div className="mb-4 h-[1.5px] rounded-full bg-gradient-to-r from-indigo-200 to-transparent" />

//               <div className="mb-5 flex flex-wrap gap-3">
//                 {images.map((src, i) => (
//                   <img
//                     key={i}
//                     src={src}
//                     alt=""
//                     className="h-[72px] w-[72px] cursor-pointer rounded-xl border border-slate-200 object-cover shadow-sm transition hover:scale-105"
//                     onClick={() => setLightbox(src)}
//                   />
//                 ))}
//               </div>
//             </>
//           )}

//           {product.description && (
//             <>
//               <span className="mb-2 block text-[10px] font-bold uppercase tracking-[2px] text-indigo-700">
//                 Description
//               </span>
//               <div className="mb-4 h-[1.5px] rounded-full bg-gradient-to-r from-indigo-200 to-transparent" />
//               <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] leading-6 text-slate-700">
//                 {product.description}
//               </div>
//             </>
//           )}

//           {product.specification && (
//             <>
//               <span className="mb-2 block text-[10px] font-bold uppercase tracking-[2px] text-indigo-700">
//                 Specification
//               </span>
//               <div className="mb-4 h-[1.5px] rounded-full bg-gradient-to-r from-indigo-200 to-transparent" />
//               <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] leading-6 text-slate-700">
//                 {product.specification}
//               </div>
//             </>
//           )}

//           {product.has_variants && (product.variants || []).length > 0 && (
//             <>
//               <span className="mb-2 block text-[10px] font-bold uppercase tracking-[2px] text-indigo-700">
//                 Variants
//               </span>
//               <div className="mb-4 h-[1.5px] rounded-full bg-gradient-to-r from-indigo-200 to-transparent" />

//               <div className="mb-3 inline-flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
//                 <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 font-mono text-[11px] text-indigo-700">
//                   {product.variants.length}
//                 </span>
//                 variant{product.variants.length !== 1 ? "s" : ""} total
//               </div>

//               <div className="overflow-hidden rounded-2xl border border-slate-200">
//                 <div className="overflow-x-auto">
//                   <table className="min-w-[860px] w-full border-collapse text-[12px]">
//                     <thead className="bg-gradient-to-r from-indigo-600 to-indigo-500">
//                       <tr>
//                         <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
//                           SKU
//                         </th>
//                         <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
//                           Barcode
//                         </th>
//                         {product.variant_type === "size_color" && (
//                           <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
//                             Size
//                           </th>
//                         )}
//                         <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
//                           Color
//                         </th>
//                         <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
//                           Cost (â‚¹)
//                         </th>
//                         <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
//                           MRP (â‚¹)
//                         </th>
//                         <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
//                           Selling (â‚¹)
//                         </th>
//                         <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
//                           Margin
//                         </th>
//                         <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
//                           Stock
//                         </th>
//                         <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
//                           Unit
//                         </th>
//                       </tr>
//                     </thead>

//                     <tbody>
//                       {product.variants.map((v, i) => (
//                         <VariantRow
//                           key={i}
//                           v={v}
//                           variantType={product.variant_type}
//                         />
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               </div>
//             </>
//           )}
//         </div>

//         <div className="flex flex-wrap gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
//           <button
//             className="min-w-[120px] flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-md transition hover:-translate-y-[1px] hover:shadow-lg"
//             onClick={onEdit}
//           >
//             âœ Edit Product
//           </button>

//           {/* Inventory buttons hidden for vendors â€” they don't own inventory routes */}
//           {!isVendor && (
//             <>
//               <button
//                 className="min-w-[120px] flex-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-[13px] font-semibold text-blue-700 transition hover:bg-blue-100"
//                 onClick={onInvView}
//               >
//                 ðŸ“¦ View Inventory
//               </button>

//               <button
//                 className="min-w-[120px] flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
//                 onClick={onInvEdit}
//               >
//                 âš™ Edit Inventory
//               </button>
//             </>
//           )}
//         </div>
//       </div>

//       {lightbox && (
//         <div
//           className="fixed inset-0 z-[200] flex cursor-pointer items-center justify-center bg-black/80 p-4"
//           onClick={() => setLightbox(null)}
//         >
//           <button
//             className="absolute right-4 top-4 border-none bg-transparent text-[28px] text-white opacity-70 transition hover:opacity-100"
//             onClick={() => setLightbox(null)}
//           >
//             âœ•
//           </button>
//           <img
//             src={lightbox}
//             alt=""
//             className="max-h-[88vh] max-w-[90vw] rounded-2xl shadow-2xl"
//             onClick={(e) => e.stopPropagation()}
//           />
//         </div>
//       )}
//     </div>
//   );
// }

// // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// // Main ProductList
// // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// export default function ProductList({
//   embedded = false,
//   onAddProduct,
//   onEditProduct,
// }) {
//   const [products, setProducts] = useState([]);
//   const [search, setSearch] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [selectedProduct, setSelectedProduct] = useState(null);
//   const navigate = useNavigate();

//   // FIX: detect vendor once so we can use it everywhere in this component
//   const vendor = isVendorUser();

//   const fetchProducts = async () => {
//     setLoading(true);
//     try {
//       const res = await axios.get(`${API_BASE}/api/products/`, {
//         headers: getAuthHeaders(),
//       });
//       setProducts(res.data.data || []);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchProducts();
//   }, []);

//   const filtered = products.filter((p) => {
//     const sku = (p.sku || p.base_sku || "").toLowerCase();
//     const barcode = (p.barcode || p.base_barcode || "").toLowerCase();
//     const q = search.toLowerCase();

//     return (
//       !q ||
//       p.product_name?.toLowerCase().includes(q) ||
//       sku.includes(q) ||
//       barcode.includes(q) ||
//       p.division?.toLowerCase().includes(q) ||
//       p.section?.toLowerCase().includes(q)
//     );
//   });

//   const deleteProduct = async (p) => {
//     const sku = p.sku || p.base_sku;
//     if (!window.confirm(`Delete "${p.product_name}"?`)) return;
//     try {
//       await axios.delete(`${API_BASE}/api/products/${sku}`, {
//         headers: getAuthHeaders(),
//       });
//       fetchProducts();
//     } catch {
//       alert("âŒ Failed to delete product");
//     }
//   };

//   const handleEdit = (product) => {
//   // Vendor panel uses internal tab switching
//   if (onEditProduct) {
//     onEditProduct(product);
//     return;
//   }

//   // Admin route navigation
//   const sku = product.sku || product.base_sku;
//   navigate(`/products/edit/${sku}`);
// };

//   return (
//     <div className="h-full min-h-0 overflow-hidden bg-gradient-to-br from-indigo-300 via-purple-400 to-indigo-500 p-4 sm:p-5 lg:p-6">
//       <div className="mx-auto flex h-full min-h-0 w-full flex-col">
//         <div className="shrink-0 mb-6 flex flex-col gap-4 rounded-2xl border border-white/30 bg-white/70 p-4 shadow-[0_8px_24px_rgba(79,70,229,0.08)] backdrop-blur-xl sm:flex-row sm:items-center sm:p-5">
//           <div className="flex min-w-0 items-center gap-3.5">
//             <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-[20px] text-white shadow-md">
//               ðŸ“¦
//             </div>

//             <div className="min-w-0">
//               <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.4px] text-slate-900 sm:text-[22px]">
//                 My Product List
//               </h1>
//               <p className="mt-0.5 text-[12px] text-slate-700">
//                 {products.length} product{products.length !== 1 ? "s" : ""} total
//               </p>
//             </div>
//           </div>
//         </div>

//         <div className="shrink-0 mb-5 flex w-full max-w-[420px] items-center gap-2 rounded-xl border border-white/30 bg-white/70 px-4 py-2.5 shadow-sm backdrop-blur-xl transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
//           <span className="shrink-0 text-[14px] text-slate-900">ðŸ”</span>
//           <input
//             type="text"
//             placeholder="Search by name, SKU, barcode, divisionâ€¦"
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             className="w-full border-none bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-600"
//           />
//           {search && (
//             <button
//               onClick={() => setSearch("")}
//               className="border-none bg-transparent text-[14px] text-slate-600"
//             >
//               âœ•
//             </button>
//           )}
//         </div>

//         <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/30 bg-white/70 shadow-[0_8px_22px_rgba(15,23,42,0.05)] backdrop-blur-xl">
//           <div className="flex-1 min-h-0 overflow-auto">
//             <table className="min-w-[900px] w-full border-collapse text-[13px]">
//               <thead className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 to-indigo-500">
//                 <tr>
//                   <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-white">
//                     SKU
//                   </th>
//                   <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-white">
//                     Product
//                   </th>
//                   <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-white">
//                     Division
//                   </th>
//                   <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-white">
//                     Section / Dept
//                   </th>
//                   <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-white">
//                     Variants
//                   </th>
//                   <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-white">
//                     Images
//                   </th>
//                   <th className="px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-[0.8px] text-white">
//                     Actions
//                   </th>
//                 </tr>
//               </thead>

//               <tbody>
//                 {loading ? (
//                   <tr>
//                     <td colSpan={7} className="px-5 py-14 text-center text-slate-400">
//                       <div className="mb-3 text-[40px] opacity-40">â³</div>
//                       <p className="text-[14px] font-medium">Loading productsâ€¦</p>
//                     </td>
//                   </tr>
//                 ) : filtered.length === 0 ? (
//                   <tr>
//                     <td colSpan={7} className="px-5 py-14 text-center text-slate-400">
//                       <div className="mb-3 text-[40px] opacity-40">ðŸ“­</div>
//                       <p className="text-[14px] font-medium">
//                         {search ? "No results found" : "No products yet"}
//                       </p>
//                     </td>
//                   </tr>
//                 ) : (
//                   filtered.map((p, i) => {
//                     const sku = p.sku || p.base_sku || "â€”";
//                     const images = p.images || [];

//                     return (
//                       <tr
//                         key={i}
//                         className="border-b border-slate-100 transition last:border-b-0 hover:bg-slate-50"
//                       >
//                         <td className="px-4 py-3.5 align-middle">
//                           <span className="inline-block whitespace-nowrap rounded border border-indigo-200 bg-indigo-50 px-2 py-1 font-mono text-[11px] font-medium text-indigo-700">
//                             {sku}
//                           </span>
//                         </td>

//                         <td className="px-4 py-3.5 align-middle">
//                           <p className="font-semibold leading-6 text-slate-900">
//                             {p.product_name}
//                           </p>
//                           {p.description && (
//                             <p className="mt-0.5 max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-5 text-slate-400">
//                               {p.description}
//                             </p>
//                           )}
//                         </td>

//                         <td className="px-4 py-3.5 align-middle font-medium text-slate-700">
//                           {p.division || "â€”"}
//                         </td>

//                         <td className="px-4 py-3.5 align-middle">
//                           <p className="font-medium text-slate-700">
//                             {p.section || "â€”"}
//                           </p>
//                           {p.department && (
//                             <p className="mt-0.5 text-[11px] leading-5 text-slate-400">
//                               {p.department}
//                             </p>
//                           )}
//                         </td>

//                         <td className="px-4 py-3.5 align-middle">
//                           {p.has_variants ? (
//                             <div className="flex flex-col gap-1">
//                               <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
//                                 <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
//                                 {p.variant_type === "color"
//                                   ? "Color"
//                                   : "Size + Color"}
//                               </span>
//                               <span className="font-mono text-[10px] text-slate-400">
//                                 {(p.variants || []).length} variant
//                                 {(p.variants || []).length !== 1 ? "s" : ""}
//                               </span>
//                             </div>
//                           ) : (
//                             <span className="text-[12px] text-slate-300">Simple</span>
//                           )}
//                         </td>

//                         <td className="px-4 py-3.5 align-middle">
//                           <div className="flex flex-wrap items-center gap-1.5">
//                             {images.slice(0, 3).map((src, j) => (
//                               <img
//                                 key={j}
//                                 src={src}
//                                 alt=""
//                                 className="h-[38px] w-[38px] rounded-lg border border-slate-200 object-cover shadow-sm"
//                               />
//                             ))}
//                             {images.length > 3 && (
//                               <div className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-[10px] font-semibold text-slate-500">
//                                 +{images.length - 3}
//                               </div>
//                             )}
//                             {images.length === 0 && (
//                               <span className="text-[11px] text-slate-300">â€”</span>
//                             )}
//                           </div>
//                         </td>

//                         <td className="px-4 py-3.5 align-middle">
//                           <div className="flex flex-wrap items-center justify-center gap-2">
//                             <button
//                               className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[12px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
//                               onClick={() => setSelectedProduct(p)}
//                             >
//                               ðŸ‘ View
//                             </button>

//                             <button
//                               className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[12px] font-semibold text-blue-700 transition hover:bg-blue-100"
//                               onClick={() => handleEdit(p)}
//                             >
//                               âœ Edit
//                             </button>

//                             <button
//                               className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] font-semibold text-red-700 transition hover:bg-red-100"
//                               onClick={() => deleteProduct(p)}
//                             >
//                               ðŸ—‘
//                             </button>
//                           </div>
//                         </td>
//                       </tr>
//                     );
//                   })
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </div>

//         {selectedProduct && (
//           <ProductModal
//             product={selectedProduct}
//
//             onClose={() => setSelectedProduct(null)}
//             onEdit={() => {
//               handleEdit(selectedProduct);
//               setSelectedProduct(null);
//             }}
//             onInvView={() => {
//               navigate(
//                 `/inventory/view/${selectedProduct.sku || selectedProduct.base_sku}`
//               );
//               setSelectedProduct(null);
//             }}
//             onInvEdit={() => {
//               navigate(
//                 `/inventory/edit/${selectedProduct.sku || selectedProduct.base_sku}`
//               );
//               setSelectedProduct(null);
//             }}
//           />
//         )}
//       </div>
//     </div>
//   );
// }
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import AddProduct from "./MsellerAddProduct"; // adjust path if AddProduct.jsx lives elsewhere

const API_BASE = `${APP_API_URL}`;

// â”€â”€â”€ Helpers â”€â”€â”€
const fmt = (n) => {
  const num = parseFloat(n);
  return isNaN(num) ? "Not set" : `${String.fromCharCode(0x20B9)}${num.toFixed(2)}`;
};

const calcMargin = (cp, sp) => {
  const c = parseFloat(cp),
    s = parseFloat(sp);
  if (!c || !s || c <= 0) return null;
  return (((s - c) / c) * 100).toFixed(1);
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helper: get token from localStorage
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const getAuthHeaders = () => {
  const token =
    localStorage.getItem("vendor_token") ||
    localStorage.getItem("admin_token") ||
    localStorage.getItem("token");

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helper: is the current user a vendor?
// Decodes the JWT payload without a library.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const getTokenPayload = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
};

const isVendorUser = () => {
  const p = getTokenPayload();
  return !!(p && p.vendor_id);
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PriceCard â€” for simple products
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PriceCard({ label, value, type }) {
  const styles = {
    cp: "bg-slate-50 border-slate-200 text-slate-700",
    mrp: "bg-indigo-50 border-indigo-200 text-indigo-700",
    sp: "bg-emerald-50 border-emerald-200 text-emerald-700",
  };

  return (
    <div className={`rounded-xl border p-3 ${styles[type] || styles.cp}`}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[1px] text-slate-600">
        {label}
      </p>
      <p className="font-mono text-[15px] font-bold">{fmt(value)}</p>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VariantRow â€” single row in variants table
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function VariantRow({ v, variantType }) {
  const margin = calcMargin(v.cost_price, v.selling_price);
  const marginClass =
    margin === null
      ? ""
      : parseFloat(margin) < 0
      ? "bg-red-50 text-red-700 border-red-200"
      : parseFloat(margin) >= 20
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <tr className="border-b border-slate-100 transition hover:bg-slate-50">
      <td className="px-3 py-3">
        <span className="inline-block rounded border border-indigo-200 bg-indigo-50 px-2 py-1 font-mono text-[10px] font-medium text-indigo-700">
          {v.sku || "â€”"}
        </span>
      </td>

      <td className="px-3 py-3">
        <span className="inline-block rounded border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-500">
          {v.barcode || "â€”"}
        </span>
      </td>

      {variantType === "size_color" && (
        <td className="px-3 py-3">
          <span className="inline-block rounded border border-indigo-200 bg-indigo-50 px-2 py-1 font-mono text-[10px] font-semibold text-indigo-700">
            {v.size_label || "â€”"}
          </span>
          {v.size_value && (
            <span className="ml-1 font-mono text-[10px] text-slate-400">
              ({v.size_value})
            </span>
          )}
        </td>
      )}

      <td className="px-3 py-3">
        <span
          className="mr-2 inline-block h-4 w-4 rounded border border-black/10 align-middle"
          style={{ backgroundColor: v.color || "transparent" }}
        />
        <span className="align-middle font-mono text-[10px] text-slate-500">
          {v.color || "â€”"}
        </span>
      </td>

      <td className="px-3 py-3">
        <span className="font-mono text-[11px] text-slate-700">
          {fmt(v.cost_price)}
        </span>
      </td>

      <td className="px-3 py-3">
        <span className="font-mono text-[11px] text-slate-700">{fmt(v.mrp)}</span>
      </td>

      <td className="px-3 py-3">
        <span
          className={`font-mono text-[11px] font-semibold ${
            parseFloat(v.selling_price) < parseFloat(v.cost_price)
              ? "text-red-700"
              : "text-emerald-700"
          }`}
        >
          {fmt(v.selling_price)}
        </span>
      </td>

      <td className="px-3 py-3">
        {margin !== null ? (
          <span
            className={`inline-block rounded border px-2 py-1 font-mono text-[10px] font-semibold ${marginClass}`}
          >
            {margin}%
          </span>
        ) : (
          <span className="text-slate-300">â€”</span>
        )}
      </td>

      <td className="px-3 py-3">
        <span className="inline-block rounded border border-blue-200 bg-blue-50 px-2 py-1 font-mono text-[11px] font-semibold text-blue-700">
          {v.stock ?? 0}
        </span>
      </td>

      <td className="px-3 py-3">
        <span className="text-[10px] text-slate-400">{v.unit || "pcs"}</span>
      </td>
    </tr>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Product Detail Modal
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ProductModal({ product, onClose, onEdit }) {
  const [lightbox, setLightbox] = useState(null);

  const sku = product.sku || product.base_sku || "Not available";
  const barcode = product.barcode || product.base_barcode || "Not available";
  const images = product.images || [];

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4"
      onClick={handleOverlayClick}
    >
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-indigo-100">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-extrabold leading-snug text-slate-900">
              {product.product_name}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-mono text-[11px] font-medium text-indigo-700">
                {sku}
              </span>

              <span className="rounded border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-500">Barcode: {barcode}
              </span>

              {product.has_variants && (
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-bold text-indigo-700">
                  {product.variant_type === "color"
                    ? "Color Variants"
                    : "Size + Color Variants"}
                </span>
              )}
            </div>
          </div>

          <button
            className="shrink-0 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            onClick={onClose}
          >Close</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="mb-5 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
            <span className="font-semibold text-slate-700">Created</span>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">
              {product.created_at
                ? new Date(product.created_at.$date || product.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "Not available"}
            </span>
          </div>
          {!product.has_variants && (
            <>
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[2px] text-indigo-700">
                Pricing
              </span>
              <div className="mb-4 h-[1.5px] rounded-full bg-gradient-to-r from-indigo-200 to-transparent" />

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <PriceCard label="Cost Price" value={product.cost_price} type="cp" />
                <PriceCard label="MRP" value={product.mrp} type="mrp" />
                <PriceCard
                  label="Selling Price"
                  value={product.selling_price}
                  type="sp"
                />
              </div>

              {(() => {
                const m = calcMargin(product.cost_price, product.selling_price);
                if (m === null) return null;
                const isLoss = parseFloat(m) < 0;

                return (
                  <div
                    className={`mb-5 inline-flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2 font-mono text-[13px] font-semibold ${
                      isLoss
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-[0.8px] opacity-70">
                      Margin
                    </span>
                    <span>{m}%</span>
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px]">
                      {isLoss
                        ? "Loss"
                        : parseFloat(m) >= 20
                        ? "Healthy"
                        : "Low"}
                    </span>
                  </div>
                );
              })()}

              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[2px] text-indigo-700">
                Inventory
              </span>
              <div className="mb-4 h-[1.5px] rounded-full bg-gradient-to-r from-indigo-200 to-transparent" />

              <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-700">
                <span>Stock</span>
                <b className="font-mono">{product.quantity ?? 0}</b>
                <span className="text-[11px] text-slate-400">|</span>
                <span>Unit</span>
                <b className="font-mono">{product.unit || "pcs"}</b>
              </div>
            </>
          )}

          {images.length > 0 && (
            <>
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[2px] text-indigo-700">
                Images
              </span>
              <div className="mb-4 h-[1.5px] rounded-full bg-gradient-to-r from-indigo-200 to-transparent" />

              <div className="mb-5 flex flex-wrap gap-3">
                {images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="h-[72px] w-[72px] cursor-pointer rounded-xl border border-slate-200 object-cover shadow-sm transition hover:scale-105"
                    onClick={() => setLightbox(src)}
                  />
                ))}
              </div>
            </>
          )}

          {product.description && (
            <>
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[2px] text-indigo-700">
                Description
              </span>
              <div className="mb-4 h-[1.5px] rounded-full bg-gradient-to-r from-indigo-200 to-transparent" />
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] leading-6 text-slate-700">
                {product.description}
              </div>
            </>
          )}

          {product.specification && (
            <>
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[2px] text-indigo-700">
                Specification
              </span>
              <div className="mb-4 h-[1.5px] rounded-full bg-gradient-to-r from-indigo-200 to-transparent" />
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] leading-6 text-slate-700">
                {product.specification}
              </div>
            </>
          )}

          {product.has_variants && (product.variants || []).length > 0 && (
            <>
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[2px] text-indigo-700">
                Variants
              </span>
              <div className="mb-4 h-[1.5px] rounded-full bg-gradient-to-r from-indigo-200 to-transparent" />

              <div className="mb-3 inline-flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 font-mono text-[11px] text-indigo-700">
                  {product.variants.length}
                </span>
                variant{product.variants.length !== 1 ? "s" : ""} total
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-[860px] w-full border-collapse text-[12px]">
                    <thead className="bg-gradient-to-r from-indigo-600 to-indigo-500">
                      <tr>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
                          SKU
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
                          Barcode
                        </th>
                        {product.variant_type === "size_color" && (
                          <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
                            Size
                          </th>
                        )}
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
                          Color
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
                          Cost (INR)
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
                          MRP (INR)
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
                          Selling (INR)
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
                          Margin
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
                          Stock
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.8px] text-white">
                          Unit
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {product.variants.map((v, i) => (
                        <VariantRow
                          key={i}
                          v={v}
                          variantType={product.variant_type}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
          <button
            className="min-w-[120px] flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-md transition hover:-translate-y-[1px] hover:shadow-lg"
            onClick={onEdit}
          >Edit Product</button>

        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[200] flex cursor-pointer items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute right-4 top-4 border-none bg-transparent text-[28px] text-white opacity-70 transition hover:opacity-100"
            onClick={() => setLightbox(null)}>
            Close
          </button>
          <img
            src={lightbox}
            alt=""
            className="max-h-[88vh] max-w-[90vw] rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Add Product Modal Wrapper
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AddProductModal({ onClose, onSuccess }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4"
      onClick={handleOverlayClick}
    >
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl shadow-2xl">
        <AddProduct onClose={onClose} onSuccess={onSuccess} />
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Main ProductList
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function ProductList({
  embedded = false,
  onAddProduct,
  onEditProduct,
}) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false); // NEW
  const navigate = useNavigate();

  // FIX: detect vendor once so we can use it everywhere in this component
  const vendor = isVendorUser();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/products/`, {
        headers: getAuthHeaders(),
      });
      setProducts(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filtered = products.filter((p) => {
    const sku = (p.sku || p.base_sku || "").toLowerCase();
    const barcode = (p.barcode || p.base_barcode || "").toLowerCase();
    const q = search.toLowerCase();

    return (
      !q ||
      p.product_name?.toLowerCase().includes(q) ||
      sku.includes(q) ||
      barcode.includes(q)
    );
  });

  const deleteProduct = async (p) => {
    const sku = p.sku || p.base_sku;
    if (!window.confirm(`Delete "${p.product_name}"?`)) return;
    try {
      await axios.delete(`${API_BASE}/api/products/${sku}`, {
        headers: getAuthHeaders(),
      });
      fetchProducts();
    } catch {
      alert("âŒ Failed to delete product");
    }
  };

  const handleEdit = (product) => {
    // Vendor panel uses internal tab switching
    if (onEditProduct) {
      onEditProduct(product);
      return;
    }

    // Admin route navigation
    const sku = product.sku || product.base_sku;
    navigate(`/products/edit/${sku}`);
  };

  // NEW: Add Product click handler
  const handleAddClick = () => {
    if (onAddProduct) {
      // Embedded/vendor panel: switch internal tab instead of popup
      onAddProduct();
      return;
    }
    // Standalone: open popup modal
    setShowAddModal(true);
  };

  return (
    <div className="h-full min-h-0 overflow-hidden bg-slate-50 p-4 sm:p-5 lg:p-6">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col">
        <div className="shrink-0 mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[20px] text-indigo-600 ring-1 ring-indigo-100">PL</div>

            <div className="min-w-0">
              <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.4px] text-slate-900 sm:text-[22px]">
                My Product List
              </h1>
              <p className="mt-1 text-[12px] font-medium text-slate-500">
                {products.length} product{products.length !== 1 ? "s" : ""} total
              </p>
            </div>
          </div>

          {/* NEW: Add Product button */}
          <button
            onClick={handleAddClick}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-indigo-700 hover:shadow-md"
          >
            <span className="text-base">+</span> Add Product
          </button>
        </div>

        <div className="shrink-0 mb-4 flex w-full max-w-[480px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-50">
          <span className="shrink-0 text-[14px] text-slate-900">Search</span>
          <input
            type="text"
            placeholder="Search products, SKU or barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border-none bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-600"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="border-none bg-transparent text-[14px] text-slate-600"
            >
              âœ•
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full min-w-[1080px] border-collapse text-[13px]">
              <thead className="sticky top-0 z-10 bg-slate-900">
                <tr>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-white">
                    SKU
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-white">
                    Product
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-white">
                    Barcode
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-white">
                    Pricing / Stock
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-white">
                    Variants
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-white">
                    Images
                  </th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-[0.8px] text-white">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-slate-400">
                      <div className="mb-3 text-[40px] opacity-40">â³</div>
                      <p className="text-[14px] font-medium">Loading productsâ€¦</p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-slate-400">
                      <div className="mb-3 text-[40px] opacity-40">ðŸ“­</div>
                      <p className="text-[14px] font-medium">
                        {search ? "No results found" : "No products yet"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((p, i) => {
                    const sku = p.sku || p.base_sku || "â€”";
                    const images = p.images || [];
                    const barcode = p.barcode || p.base_barcode || "â€”";
                    const mrp = Number(p.mrp ?? p.MRP ?? 0);
                    const sellingPrice = Number(p.selling_price ?? p.sellingPrice ?? p.price ?? 0);
                    const stock = p.has_variants
                      ? (p.variants || []).reduce((sum, variant) => sum + Number(variant.stock ?? variant.quantity ?? 0), 0)
                      : Number(p.stock ?? p.quantity ?? 0);

                    return (
                      <tr
                        key={i}
                        className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-indigo-50/40"
                      >
                        <td className="px-4 py-3.5 align-middle">
                          <span className="inline-block whitespace-nowrap rounded border border-indigo-200 bg-indigo-50 px-2 py-1 font-mono text-[11px] font-medium text-indigo-700">
                            {sku}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <p className="font-semibold leading-6 text-slate-900">
                            {p.product_name}
                          </p>
                          {p.description && (
                            <p className="mt-0.5 max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-5 text-slate-400">
                              {p.description}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3.5 align-middle font-medium text-slate-700">
                          {barcode}
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex flex-col gap-1 text-[11px]">
                            <span className="font-semibold text-slate-700">MRP {"\u20B9"}{mrp.toLocaleString("en-IN")}</span>
                            <span className="font-semibold text-emerald-700">Selling {"\u20B9"}{sellingPrice.toLocaleString("en-IN")}</span>
                            <span className="font-mono text-slate-500">Stock {stock.toLocaleString("en-IN")}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          {p.has_variants ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                                {p.variant_type === "color"
                                  ? "Color"
                                  : "Size + Color"}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {(p.variants || []).length} variant
                                {(p.variants || []).length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[12px] text-slate-300">Simple</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {images.slice(0, 3).map((src, j) => (
                              <img
                                key={j}
                                src={src}
                                alt=""
                                className="h-[38px] w-[38px] rounded-lg border border-slate-200 object-cover shadow-sm"
                              />
                            ))}
                            {images.length > 3 && (
                              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-[10px] font-semibold text-slate-500">
                                +{images.length - 3}
                              </div>
                            )}
                            {images.length === 0 && (
                              <span className="text-[11px] text-slate-300">No image</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <button
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                              onClick={() => setSelectedProduct(p)}
                            >
                              View</button>

                            <button
                              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[12px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
                              onClick={() => handleEdit(p)}
                            >
                              Edit</button>

                            <button
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-100"
                              onClick={() => deleteProduct(p)}
                            >
                              Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedProduct && (
          <ProductModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onEdit={() => {
              handleEdit(selectedProduct);
              setSelectedProduct(null);
            }}
          />
        )}

        {/* NEW: Add Product modal */}
        {showAddModal && (
          <AddProductModal
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              setShowAddModal(false);
              fetchProducts();
            }}
          />
        )}
      </div>
    </div>
  );
}








