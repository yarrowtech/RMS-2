import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
// import React, { useEffect, useMemo, useState } from "react";
// import {
//   FaWarehouse,
//   FaLayerGroup,
//   FaFilter,
//   FaBuilding,
//   FaSearch,
//   FaPlus,
//   FaSave,
//   FaTrash,
//   FaFilePdf,
//   FaTimes,
//   FaExchangeAlt,
// } from "react-icons/fa";
// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";

// /* ===================== MASTER DATA ===================== */

// const DIVISIONS = [
//   "Accessories",
//   "Branded Items",
//   "CMO",
//   "Fmcg Home & Personal Care",
//   "Fmcg-Food",
//   "Handcraft",
//   "Home Decor",
//   "House Hold Appliences",
//   "Kids",
//   "Ladies",
//   "Leather Accoessories",
//   "Mens",
//   "Staples",
//   "Winter Garments",
// ];

// const SECTION_MAP = {
//   Accessories: ["Gift & Novelties", "Jewellery & Ornaments"],
//   "Branded Items": ["Mens(Bi)"],
//   CMO: [
//     "Kids Boys(CMO)",
//     "Kids Girls(CMO)",
//     "Kids Winter Garments Boys(CMO)",
//     "Kids Winter Garments Girls(CMO)",
//     "Ladies Ethnic Wear(CMO)",
//     "Ladies Western Wear(CMO)",
//     "Ladies Winter Garments(CMO)",
//     "Mens(CMO)",
//     "Mens Winter Garments(CMO)",
//     "Saree(CMO)",
//   ],
//   "Fmcg Home & Personal Care": [
//     "Fabric Care Detergent",
//     "Home Care Disposables",
//     "Home Care Freshner",
//     "Home Care House Cleaning",
//     "Home Care Puja Needs",
//     "Home Care Utensil Cleaners",
//     "Personal Care Baby Care",
//     "Personal Care Beauty Aids",
//     "Personal Care Cosmetics",
//     "Personal Care Deo & Perfume",
//     "Personal Care Disposables Goods",
//     "Personal Care Eye Care",
//     "Personal Care Hair Care",
//     "Personal Care Oral Care",
//     "Personal Care Shaving Needs",
//     "Personal Care Skin Care",
//   ],
//   "Fmcg-Food": [
//     "Additives & Preservatives",
//     "Aftermints",
//     "Dairy Products",
//     "Dairy Products Drink Concentrates",
//     "Drinks & Beverages Juices",
//     "Drinks & Beverages Coffee",
//     "Drinks & Beverages Drinks",
//     "Drinks & Beverages Tea",
//     "Health Foods Health Enrichers",
//     "Ready To Cook",
//     "Ready To Eat",
//     "Ready To Eat Biscuits",
//     "Ready To Eat Breakfast Cereals",
//   ],
//   Handcraft: ["Bag(H)", "Ornaments(H)"],
//   "Home Decor": ["Others", "Crockery"],
//   "House Hold Appliences": [
//     "Crockery",
//     "Electronics",
//     "Melamine",
//     "Other",
//     "Plasticware",
//     "Utensils",
//   ],
//   Kids: ["Boy", "Girls", "Others(K)"],
//   Ladies: ["Ethnic Wear", "Fabric", "Lingeries", "Saree", "Westen Wear"],
//   "Leather Accoessories": ["Kids Boy", "Kids Girls", "Ladies", "Luggage", "Mens", "Others"],
//   Mens: ["Casual(M)", "Fabric(M)", "Formal(M)", "Jeans", "Others", "Trousers(M)", "T-Shirts"],
//   Staples: ["Basic Staples(Packed)", "Flours"],
//   "Winter Garments": ["Kids", "Ladies", "Men'S", "Others"],
// };

// const DEPARTMENT_MAP = {
//   "Gift & Novelties": ["Soft Toys", "Gift Articles", "Stationery", "Others"],
//   "Jewellery & Ornaments": ["Imitation", "Fashion Jewellery", "Others"],
//   "Kids Boys(CMO)": ["Shirts", "Trousers", "Winter Wear", "Others"],
//   "Kids Girls(CMO)": ["Tops", "Leggings", "Winter Wear", "Others"],
//   "Mens(CMO)": ["Casual", "Formal", "Winter Wear", "Others"],
//   "Saree(CMO)": ["Cotton Saree", "Silk Saree", "Others"],
//   "Fabric Care Detergent": ["Detergent Powder", "Liquid Detergent", "Others"],
//   "Drinks & Beverages Tea": ["Tea", "Green Tea", "Others"],
// };

// const WAREHOUSES = ["All", "Main - New Market", "Store - Chowringhee", "Store - Hatibagan"];

// /* ===================== DUMMY DATA ===================== */

// const INITIAL_ADJUSTMENTS = [
//   {
//     id: 1,
//     date: "2026-01-12 11:15",
//     warehouse: "Main - New Market",
//     refNo: "ADJ-000101",
//     createdBy: "Admin",
//     note: "Cycle count correction",
//     lines: [
//       {
//         lineId: "L1",
//         sku: "ACC-ST-001",
//         barcode: "8901234000001",
//         product: "Soft Teddy Bear (Medium)",
//         division: "Accessories",
//         section: "Gift & Novelties",
//         department: "Soft Toys",
//         qtyChange: -3,
//         reason: "Cycle Count",
//         remarks: "Short found",
//       },
//     ],
//   },
// ];

// /* ===================== STYLES / HELPERS ===================== */

// const cn = (...a) => a.filter(Boolean).join(" ");

// // ✅ SAME BORDER TYPE (visible)
// const BLUE_INPUT =
//   "w-full bg-slate-100 rounded-xl px-3 py-2 text-sm text-slate-900 " +
//   "border border-blue-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 " +
//   "outline-none placeholder:text-slate-400";

// const BLUE_CELL =
//   "w-full min-w-[140px] bg-slate-100 rounded-xl px-3 py-2 text-sm text-slate-900 " +
//   "border border-blue-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 " +
//   "outline-none placeholder:text-slate-400";

// const READONLY =
//   "bg-slate-100 cursor-not-allowed text-slate-700 " +
//   "border-blue-300 focus:ring-0 focus:border-blue-300";

// function todayStamp() {
//   const d = new Date();
//   const pad = (n) => String(n).padStart(2, "0");
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
//     d.getHours()
//   )}:${pad(d.getMinutes())}`;
// }

// function todayYmd() {
//   const d = new Date();
//   const pad = (n) => String(n).padStart(2, "0");
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// }

// function withAll(arr) {
//   return ["All", ...(arr || [])];
// }

// function clampSignedInt(v) {
//   if (v === "" || v === null || v === undefined) return 0;
//   if (v === "-") return 0;
//   const n = Number(v);
//   if (!Number.isFinite(n)) return 0;
//   return Math.trunc(n);
// }

// function parseSignedIntOrEmpty(v) {
//   if (v === "" || v === null || v === undefined) return "";
//   if (v === "-") return "-";
//   const n = Number(v);
//   if (!Number.isFinite(n)) return "";
//   return Math.trunc(n);
// }

// function makeRef(prefix = "ADJ") {
//   const rand = Math.floor(100000 + Math.random() * 900000);
//   return `${prefix}-${String(rand).slice(-6)}`;
// }

// function cryptoRandomId() {
//   try {
//     // eslint-disable-next-line no-undef
//     if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
//   } catch {}
//   return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
// }

// function sectionsForDivision(div) {
//   if (!div) return [];
//   return SECTION_MAP[div] || [];
// }

// function departmentsForSection(sec) {
//   if (!sec) return [];
//   return DEPARTMENT_MAP[sec] || [];
// }

// /* ===================== COMPONENT ===================== */

// export default function InventoryManagementStockAdjustment() {
//   // Header filters
//   const [division, setDivision] = useState("All");
//   const [section, setSection] = useState("All");
//   const [department, setDepartment] = useState("All");
//   const [warehouse, setWarehouse] = useState("All");
//   const [search, setSearch] = useState("");

//   // Records
//   const [adjustments, setAdjustments] = useState(() => INITIAL_ADJUSTMENTS);

//   const sections = useMemo(() => {
//     if (!division || division === "All") return [];
//     return SECTION_MAP[division] || [];
//   }, [division]);

//   const departments = useMemo(() => {
//     if (!section || section === "All") return [];
//     return DEPARTMENT_MAP[section] || [];
//   }, [section]);

//   const filtered = useMemo(() => {
//     const q = search.trim().toLowerCase();

//     return adjustments.filter((rec) => {
//       const mWarehouse = warehouse === "All" || rec.warehouse === warehouse;

//       const lineMatch = rec.lines.some((l) => {
//         const mCat =
//           (division === "All" || (l.division || "") === division) &&
//           (section === "All" || (l.section || "") === section) &&
//           (department === "All" || (l.department || "") === department);

//         const mQ =
//           !q ||
//           (l.product || "").toLowerCase().includes(q) ||
//           (l.sku || "").toLowerCase().includes(q) ||
//           String(l.barcode || "").toLowerCase().includes(q) ||
//           (rec.refNo || "").toLowerCase().includes(q) ||
//           (l.reason || "").toLowerCase().includes(q);

//         return mCat && mQ;
//       });

//       return mWarehouse && lineMatch;
//     });
//   }, [adjustments, division, section, department, warehouse, search]);

//   /* ------------------ POPUP ------------------ */
//   const [open, setOpen] = useState(false);

//   // ✅ AUTO LOCKED VALUES
//   const emptyForm = () => ({
//     date: todayStamp(),
//     warehouse: "Main - New Market",
//     refNo: makeRef("ADJ"),
//     createdBy: "Admin",
//     note: "Auto note",
//     lines: [
//       {
//         lineId: cryptoRandomId(),
//         sku: "",
//         barcode: "",
//         product: "",
//         division: "",
//         section: "",
//         department: "",
//         qtyChange: "",
//         reason: "",
//         remarks: "",
//       },
//     ],
//   });

//   const [form, setForm] = useState(emptyForm());

//   const openCreate = () => {
//     setForm(emptyForm());
//     setOpen(true);
//   };

//   const close = () => setOpen(false);

//   useEffect(() => {
//     if (!open) return;
//     const onKeyDown = (e) => e.key === "Escape" && close();
//     window.addEventListener("keydown", onKeyDown);
//     const prev = document.body.style.overflow;
//     document.body.style.overflow = "hidden";
//     return () => {
//       window.removeEventListener("keydown", onKeyDown);
//       document.body.style.overflow = prev;
//     };
//   }, [open]);

//   const totals = useMemo(() => {
//     const totalPlus = form.lines.reduce(
//       (a, l) => a + Math.max(0, clampSignedInt(l.qtyChange)),
//       0
//     );
//     const totalMinus = form.lines.reduce(
//       (a, l) => a + Math.abs(Math.min(0, clampSignedInt(l.qtyChange))),
//       0
//     );
//     const net = form.lines.reduce((a, l) => a + clampSignedInt(l.qtyChange), 0);
//     return { totalPlus, totalMinus, net };
//   }, [form.lines]);

//   const addLine = () => {
//     setForm((s) => ({
//       ...s,
//       lines: [
//         ...s.lines,
//         {
//           lineId: cryptoRandomId(),
//           sku: "",
//           barcode: "",
//           product: "",
//           division: "",
//           section: "",
//           department: "",
//           qtyChange: "",
//           reason: "",
//           remarks: "",
//         },
//       ],
//     }));
//   };

//   const removeLine = (lineId) => {
//     setForm((s) => ({
//       ...s,
//       lines: s.lines.length <= 1 ? s.lines : s.lines.filter((l) => l.lineId !== lineId),
//     }));
//   };

//   const setLine = (lineId, patch) => {
//     setForm((s) => ({
//       ...s,
//       lines: s.lines.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)),
//     }));
//   };

//   // ✅ dropdown dependency
//   const onLineDivisionChange = (lineId, div) => {
//     const secs = sectionsForDivision(div);
//     const nextSec = secs[0] || "";
//     const deps = departmentsForSection(nextSec);
//     const nextDep = deps[0] || "";
//     setLine(lineId, { division: div, section: nextSec, department: nextDep });
//   };

//   const onLineSectionChange = (lineId, sec) => {
//     const deps = departmentsForSection(sec);
//     const nextDep = deps[0] || "";
//     setLine(lineId, { section: sec, department: nextDep });
//   };

//   const save = () => {
//     if (!form.warehouse) return alert("Warehouse is required.");
//     if (!form.refNo.trim()) return alert("Reference No is required.");

//     const cleanLines = form.lines
//       .map((l) => ({ ...l, qtyChange: clampSignedInt(l.qtyChange) }))
//       .filter((l) => l.sku.trim() && l.product.trim() && l.qtyChange !== 0);

//     if (cleanLines.length === 0) {
//       return alert("Add at least 1 line with SKU + Product and Qty Change (non-zero).");
//     }

//     const record = {
//       id: Math.max(0, ...adjustments.map((x) => x.id)) + 1,
//       date: form.date || todayStamp(),
//       warehouse: form.warehouse,
//       refNo: form.refNo,
//       createdBy: form.createdBy || "Admin",
//       note: form.note || "",
//       lines: cleanLines,
//     };

//     setAdjustments((prev) => [record, ...prev]);
//     setOpen(false);
//   };

//   const exportPdf = () => {
//     const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
//     const createdOn = todayYmd();

//     doc.setFont("helvetica", "bold");
//     doc.setFontSize(16);
//     doc.text("Stock Adjustment", 40, 40);

//     doc.setFont("helvetica", "normal");
//     doc.setFontSize(10);
//     doc.text(`Generated: ${createdOn}`, 40, 58);

//     const head = [
//       [
//         "Date",
//         "Ref No",
//         "Warehouse",
//         "SKU",
//         "Barcode",
//         "Product",
//         "Division",
//         "Section",
//         "Department",
//         "Qty Change",
//         "Reason",
//         "Remarks",
//       ],
//     ];

//     const body = [];
//     filtered.forEach((rec) => {
//       rec.lines.forEach((l) => {
//         body.push([
//           rec.date,
//           rec.refNo,
//           rec.warehouse,
//           l.sku,
//           l.barcode,
//           l.product,
//           l.division || "",
//           l.section || "",
//           l.department || "",
//           String(l.qtyChange),
//           l.reason || "",
//           l.remarks || "",
//         ]);
//       });
//     });

//     autoTable(doc, {
//       head,
//       body,
//       startY: 80,
//       styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
//       headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42] },
//       alternateRowStyles: { fillColor: [248, 250, 252] },
//       columnStyles: { 9: { halign: "right" } },
//       margin: { left: 40, right: 40 },
//     });

//     doc.save(`stock-adjustment-${createdOn}.pdf`);
//   };

//   return (
//     <div className="h-full min-h-0 overflow-hidden p-6 flex flex-col gap-6">
//       {/* Header */}
//       <div className="flex items-start justify-between gap-4 shrink-0">
//         <div className="flex items-center gap-3">
//           <FaExchangeAlt className="text-indigo-600 text-2xl" />
//           <div>
//             <h1 className="text-2xl font-bold text-slate-900">Stock Adjustment</h1>
//           </div>
//         </div>

//         <div className="flex items-center gap-2">
//           <button
//             type="button"
//             onClick={exportPdf}
//             className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-[0.99]"
//           >
//             <FaFilePdf />
//             Export PDF
//           </button>

//           <button
//             type="button"
//             onClick={openCreate}
//             className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.99]"
//           >
//             <FaPlus />
//             Add Stock Adjustment
//           </button>
//         </div>
//       </div>

//       {/* Filters ✅ border visible */}
//       <div className="bg-white rounded-2xl shadow-sm p-4 shrink-0 border border-blue-500">
//         <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
//           <FilterSelect
//             label="Division"
//             icon={<FaLayerGroup className="text-slate-600" />}
//             value={division}
//             onChange={(v) => {
//               setDivision(v);
//               setSection("All");
//               setDepartment("All");
//             }}
//             options={withAll(DIVISIONS)}
//           />

//           <FilterSelect
//             label="Section"
//             icon={<FaFilter className="text-slate-600" />}
//             value={section}
//             onChange={(v) => {
//               setSection(v);
//               setDepartment("All");
//             }}
//             options={withAll(sections)}
//             disabled={division === "All"}
//           />

//           <FilterSelect
//             label="Department"
//             icon={<FaBuilding className="text-slate-600" />}
//             value={department}
//             onChange={setDepartment}
//             options={withAll(departments)}
//             disabled={section === "All"}
//           />

//           <FilterSelect
//             label="Warehouse"
//             icon={<FaWarehouse className="text-slate-600" />}
//             value={warehouse}
//             onChange={setWarehouse}
//             options={WAREHOUSES}
//           />

//           <div>
//             <label className="text-sm font-semibold text-slate-800">Search</label>
//             <div className="mt-1 flex items-center gap-2 rounded-xl px-3 bg-slate-100 border border-blue-400">
//               <FaSearch className="text-slate-400" />
//               <input
//                 type="text"
//                 placeholder="Ref No / SKU / Barcode / Product / Reason"
//                 className="bg-transparent outline-none w-full text-sm py-2"
//                 value={search}
//                 onChange={(e) => setSearch(e.target.value)}
//               />
//             </div>
//           </div>
//         </div>

//         <div className="mt-4 text-xs text-slate-500">
//           Showing <span className="font-semibold text-slate-900">{filtered.length}</span> adjustments
//         </div>
//       </div>

//       {/* List table ✅ border visible */}
//       <div className="bg-white rounded-2xl shadow-sm flex-1 min-h-0 overflow-hidden border border-blue-500">
//         <div className="h-full overflow-y-auto">
//           <table className="w-full text-sm">
//             <thead className="sticky top-0 z-10 bg-slate-200 text-slate-900 border-b border-blue-400">
//               <tr>
//                 <th className="p-3 text-left">Date</th>
//                 <th className="p-3 text-left">Ref No</th>
//                 <th className="p-3 text-left">Warehouse</th>
//                 <th className="p-3 text-left">Note</th>
//                 <th className="p-3 text-right">Lines</th>
//                 <th className="p-3 text-right">Net Qty</th>
//               </tr>
//             </thead>

//             <tbody>
//               {filtered.length === 0 ? (
//                 <tr>
//                   <td colSpan={6} className="p-8 text-center text-slate-500">
//                     No adjustments found
//                   </td>
//                 </tr>
//               ) : (
//                 filtered.map((rec) => {
//                   const net = rec.lines.reduce((a, l) => a + (Number(l.qtyChange) || 0), 0);
//                   return (
//                     <tr key={rec.id} className="hover:bg-slate-50 border-b border-blue-100">
//                       <td className="p-3 whitespace-nowrap">{rec.date}</td>
//                       <td className="p-3 font-semibold">{rec.refNo}</td>
//                       <td className="p-3">{rec.warehouse}</td>
//                       <td className="p-3">{rec.note || "-"}</td>
//                       <td className="p-3 text-right font-semibold">{rec.lines.length}</td>
//                       <td
//                         className={cn(
//                           "p-3 text-right font-bold",
//                           net > 0 ? "text-emerald-700" : net < 0 ? "text-rose-700" : "text-slate-700"
//                         )}
//                       >
//                         {net}
//                       </td>
//                     </tr>
//                   );
//                 })
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {/* FULL PAGE POPUP */}
//       {open && (
//         <ModalShell onClose={close} title="Add Stock Adjustment">
//           {/* ✅ ALL AUTO + LOCKED */}
//           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
//             <Input label="Date & Time" value={form.date} placeholder="YYYY-MM-DD HH:mm" readOnly />

//             <Input label="Warehouse" value={form.warehouse} readOnly />
//             <Input label="Reference No" value={form.refNo} placeholder="ADJ-xxxxxx" readOnly />
//             <Input label="Created By" value={form.createdBy} placeholder="Admin" readOnly />

//             <div className="md:col-span-4">
//               <label className="text-sm font-semibold text-slate-800">Note</label>
//               <textarea
//                 className={cn("mt-1 min-h-[70px]", BLUE_INPUT, READONLY)}
//                 value={form.note}
//                 onChange={() => {}}
//                 readOnly
//               />
//             </div>
//           </div>

//           <div className="mt-6 flex items-center justify-between gap-3">
//             <div>
//               <div className="text-base font-bold text-slate-900">Adjustment Lines</div>
//               <div className="text-sm text-slate-500">Use dropdowns for Division / Section / Department.</div>
//             </div>

//             <button
//               type="button"
//               onClick={addLine}
//               className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.99]"
//             >
//               <FaPlus />
//               Add Line
//             </button>
//           </div>

//           {/* SCROLL BOX */}
//           <div className="mt-3 rounded-2xl bg-white shadow-sm border border-blue-300">
//             <div className="overflow-x-auto">
//               <div className="max-h-[45vh] overflow-y-auto">
//                 <table className="w-full text-sm">
//                   <thead className="sticky top-0 z-10 bg-slate-200 text-slate-900 border-b border-blue-400">
//                     <tr>
//                       <th className="p-3 text-left">SKU</th>
//                       <th className="p-3 text-left">Barcode</th>
//                       <th className="p-3 text-left">Product</th>
//                       <th className="p-3 text-left">Division</th>
//                       <th className="p-3 text-left">Section</th>
//                       <th className="p-3 text-left">Department</th>
//                       <th className="p-3 text-right">Qty</th>
//                       <th className="p-3 text-left">Reason</th>
//                       <th className="p-3 text-left">Remarks</th>
//                       <th className="p-3 text-right">Action</th>
//                     </tr>
//                   </thead>

//                   <tbody>
//                     {form.lines.map((l) => {
//                       const secOpts = sectionsForDivision(l.division);
//                       const depOpts = departmentsForSection(l.section);

//                       return (
//                         <tr key={l.lineId} className="border-b border-blue-100">
//                           <td className="p-3">
//                             <input
//                               className={cn(BLUE_CELL, "w-[140px]")}
//                               value={l.sku}
//                               onChange={(e) => setLine(l.lineId, { sku: e.target.value })}
//                               placeholder="SKU"
//                             />
//                           </td>

//                           <td className="p-3">
//                             <input
//                               className={cn(BLUE_CELL, "w-[160px]")}
//                               value={l.barcode}
//                               onChange={(e) => setLine(l.lineId, { barcode: e.target.value })}
//                               placeholder="Barcode"
//                             />
//                           </td>

//                           <td className="p-3">
//                             <input
//                               className={cn(BLUE_CELL, "w-[240px]")}
//                               value={l.product}
//                               onChange={(e) => setLine(l.lineId, { product: e.target.value })}
//                               placeholder="Product name"
//                             />
//                           </td>

//                           {/* ✅ DROPDOWNS (no manual typing) */}
//                           <td className="p-3">
//                             <select
//                               className={cn(BLUE_CELL, "w-[190px]")}
//                               value={l.division}
//                               onChange={(e) => onLineDivisionChange(l.lineId, e.target.value)}
//                             >
//                               <option value="">Select</option>
//                               {DIVISIONS.map((d) => (
//                                 <option key={d} value={d}>
//                                   {d}
//                                 </option>
//                               ))}
//                             </select>
//                           </td>

//                           <td className="p-3">
//                             <select
//                               className={cn(BLUE_CELL, "w-[220px]")}
//                               value={l.section}
//                               onChange={(e) => onLineSectionChange(l.lineId, e.target.value)}
//                               disabled={!l.division}
//                             >
//                               <option value="">{l.division ? "Select" : "Select Division"}</option>
//                               {secOpts.map((s) => (
//                                 <option key={s} value={s}>
//                                   {s}
//                                 </option>
//                               ))}
//                             </select>
//                           </td>

//                           <td className="p-3">
//                             <select
//                               className={cn(BLUE_CELL, "w-[210px]")}
//                               value={l.department}
//                               onChange={(e) => setLine(l.lineId, { department: e.target.value })}
//                               disabled={!l.section}
//                             >
//                               <option value="">{l.section ? "Select" : "Select Section"}</option>
//                               {depOpts.map((d) => (
//                                 <option key={d} value={d}>
//                                   {d}
//                                 </option>
//                               ))}
//                             </select>
//                           </td>

//                           <td className="p-3 text-right">
//                             <input
//                               className={cn(BLUE_CELL, "w-[110px] text-right")}
//                               value={l.qtyChange}
//                               onChange={(e) =>
//                                 setLine(l.lineId, { qtyChange: parseSignedIntOrEmpty(e.target.value) })
//                               }
//                               placeholder="-2 / +5"
//                             />
//                           </td>

//                           <td className="p-3">
//                             <input
//                               className={cn(BLUE_CELL, "w-[190px]")}
//                               value={l.reason}
//                               onChange={(e) => setLine(l.lineId, { reason: e.target.value })}
//                               placeholder="Reason"
//                             />
//                           </td>

//                           <td className="p-3">
//                             <input
//                               className={cn(BLUE_CELL, "w-[210px]")}
//                               value={l.remarks}
//                               onChange={(e) => setLine(l.lineId, { remarks: e.target.value })}
//                               placeholder="Remarks"
//                             />
//                           </td>

//                           <td className="p-3 text-right">
//                             <button
//                               type="button"
//                               onClick={() => removeLine(l.lineId)}
//                               className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
//                               title="Remove line"
//                             >
//                               <FaTrash />
//                             </button>
//                           </td>
//                         </tr>
//                       );
//                     })}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           </div>

//           <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
//             <MiniStat label="Total Added (+)" value={totals.totalPlus} tone="green" />
//             <MiniStat label="Total Reduced (-)" value={totals.totalMinus} tone="red" />
//             <MiniStat label="Net Change" value={totals.net} tone={totals.net >= 0 ? "green" : "red"} />
//           </div>

//           <div className="w-full flex items-center justify-end mt-5">
//             <button
//               type="button"
//               onClick={save}
//               className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.99]"
//             >
//               <FaSave />
//               Save
//             </button>
//           </div>
//         </ModalShell>
//       )}
//     </div>
//   );
// }

// /* ===================== UI ===================== */

// function FilterSelect({ label, icon, value, onChange, options, disabled }) {
//   return (
//     <div>
//       <label className="text-sm font-semibold text-slate-800">{label}</label>
//       <div className={cn("mt-1 flex items-center gap-2 rounded-xl px-3", BLUE_INPUT, disabled && READONLY)}>
//         {icon}
//         <select
//           className={cn("bg-transparent outline-none py-2 w-full text-sm", disabled && "cursor-not-allowed")}
//           value={value}
//           onChange={(e) => !disabled && onChange(e.target.value)}
//           disabled={disabled}
//         >
//           {(options || []).map((o) => (
//             <option key={o} value={o}>
//               {o}
//             </option>
//           ))}
//         </select>
//       </div>
//     </div>
//   );
// }

// function Input({ label, value, onChange, placeholder = "", readOnly = false }) {
//   return (
//     <div>
//       <label className="text-sm font-semibold text-slate-800">{label}</label>
//       <input
//         className={cn("mt-1", BLUE_INPUT, readOnly && READONLY)}
//         value={value}
//         onChange={(e) => !readOnly && onChange?.(e.target.value)}
//         placeholder={placeholder}
//         readOnly={readOnly}
//       />
//     </div>
//   );
// }

// function MiniStat({ label, value, tone = "slate" }) {
//   const toneClass =
//     tone === "green"
//       ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
//       : tone === "red"
//       ? "bg-rose-50 text-rose-700 border border-rose-200"
//       : "bg-slate-50 text-slate-700 border border-slate-200";

//   return (
//     <div className={cn("rounded-2xl px-4 py-3", toneClass)}>
//       <div className="text-[11px] font-black tracking-[0.22em] uppercase opacity-80">{label}</div>
//       <div className="mt-1 text-xl font-black">{value}</div>
//     </div>
//   );
// }

// function ModalShell({ children, onClose, title }) {
//   return (
//     <div className="fixed inset-0 z-[999]">
//       <div className="absolute inset-0 bg-black/40" onClick={onClose} />
//       <div className="absolute inset-0 bg-white flex flex-col">
//         <div className="sticky top-0 z-10 bg-white px-5 py-4 flex items-center justify-between shadow-sm border-b border-blue-200">
//           <div>
//             <h2 className="text-lg font-bold text-slate-900">{title}</h2>
//             <p className="text-sm text-slate-500">Fill details and click Save.</p>
//           </div>

//           <button
//             type="button"
//             onClick={onClose}
//             className="h-10 w-10 grid place-items-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-blue-200"
//             title="Close"
//           >
//             <FaTimes />
//           </button>
//         </div>

//         <div className="flex-1 overflow-y-auto p-5">
//           <div className="max-w-[1500px] mx-auto">{children}</div>
//         </div>
//       </div>
//     </div>
//   );
// }

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  FaWarehouse, FaLayerGroup, FaFilter, FaBuilding,
  FaSearch, FaPlus, FaSave, FaTrash, FaFilePdf,
  FaTimes, FaExchangeAlt, FaSyncAlt, FaBarcode,
} from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE = `${APP_API_URL}`;

/* ─── Helpers ─── */
const cn = (...a) => a.filter(Boolean).join(" ");

const BLUE_INPUT =
  "w-full bg-slate-100 rounded-xl px-3 py-2 text-sm text-slate-900 " +
  "border border-blue-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 " +
  "outline-none placeholder:text-slate-400";

const BLUE_CELL =
  "w-full min-w-[140px] bg-slate-100 rounded-xl px-3 py-2 text-sm text-slate-900 " +
  "border border-blue-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 " +
  "outline-none placeholder:text-slate-400";

const READONLY = "bg-slate-200 cursor-not-allowed text-slate-600 border-slate-300 focus:ring-0 focus:border-slate-300";

function todayStamp() {
  const d = new Date(), pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function todayYmd() {
  const d = new Date(), pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function makeRef() {
  return `ADJ-${String(Math.floor(100000 + Math.random() * 900000)).slice(-6)}`;
}
function cryptoId() {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch {}
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
function parseSignedInt(v) {
  if (v === "" || v === "-") return v;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : "";
}
function clampInt(v) {
  const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

/* ─── Main Component ─── */
export default function StockAdjustment() {
  const storeId = localStorage.getItem("store_id") || localStorage.getItem("admin_store_id") || "";
  const storeName = localStorage.getItem("store_name") || localStorage.getItem("admin_store_name") || "Your Store";
  const isStoreWorkspace = Boolean(storeId);
  /* Filters */
  const [division,   setDivision]   = useState("All");
  const [section,    setSection]    = useState("All");
  const [department, setDepartment] = useState("All");
  const [warehouse,  setWarehouse]  = useState("All");
  const [search,     setSearch]     = useState("");

  /* Mapping + inventory */
  const [mapping,    setMapping]    = useState({});
  const [invRows,    setInvRows]    = useState([]); // current-stock for barcode lookup
  const [warehouses, setWarehouses] = useState(["All"]);

  /* Records */
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  /* Modal */
  const [open,     setOpen]    = useState(false);
  const [saving,   setSaving]  = useState(false);
  const [formErr,  setFormErr] = useState("");
  const [form,     setForm]    = useState(null);

  /* Cascade from mapping */
  const divisions   = useMemo(() => Object.keys(mapping).sort(), [mapping]);
  const sections    = useMemo(() =>
    division !== "All" && mapping[division] ? Object.keys(mapping[division]).sort() : [], [division, mapping]);
  const departments = useMemo(() =>
    division !== "All" && section !== "All" && mapping[division]?.[section]
      ? [...mapping[division][section]].sort() : [], [division, section, mapping]);

  /* Load mapping + inventory */
  useEffect(() => {
    fetch(`${API_BASE}/api/product-mapping/grouped`, { headers: authHeaders() })
      .then(r => r.json()).then(d => setMapping(d.data || {})).catch(() => {});
    const stockUrl = isStoreWorkspace
      ? `${API_BASE}/stock-allocation/store-stock/${storeId}`
      : `${API_BASE}/inventory/current-stock`;
    fetch(stockUrl, { headers: authHeaders() })
      .then(r => r.json()).then(d => setInvRows(d.data || [])).catch(() => {});
  }, [isStoreWorkspace, storeId]);

  /* Fetch records */
  const fetchRecords = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (division   !== "All") params.append("division",   division);
      if (section    !== "All") params.append("section",    section);
      if (department !== "All") params.append("department", department);
      if (warehouse  !== "All") params.append("warehouse",  warehouse);
      if (search.trim())        params.append("search",     search.trim());

      const res  = await fetch(`${API_BASE}/inventory/stock-adjustments?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      const data = json.data || [];
      setRecords(data);
      const whs = ["All", ...new Set(data.map(r => r.warehouse).filter(Boolean))].sort();
      setWarehouses(whs);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [division, section, department, warehouse, search]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  /* Barcode lookup from inventory */
  const lookupBarcode = (barcode) => {
    const row = invRows.find(r => r.barcode === barcode || r.sku === barcode);
    return row || null;
  };

  /* Empty line */
  const emptyLine = () => ({
    lineId: cryptoId(), sku: "", barcode: "", product: "",
    division: "", section: "", department: "",
    current_stock: null, qty_change: "", reason: "", remarks: "",
  });

  /* Open modal */
  const openCreate = () => {
    setForm({
      date: todayStamp(),
      warehouse: isStoreWorkspace ? storeName : "Main Warehouse",
      ref_no: makeRef(),
      created_by: localStorage.getItem("admin_name") || "Admin",
      note: "",
      lines: [emptyLine()],
    });
    setFormErr(""); setOpen(true);
  };
  const closeModal = () => setOpen(false);

  /* ESC + scroll lock */
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") closeModal(); };
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = prev; };
  }, [open]);

  /* Line helpers */
  const setLine = (lineId, patch) => setForm(f => ({ ...f, lines: f.lines.map(l => l.lineId === lineId ? { ...l, ...patch } : l) }));
  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, emptyLine()] }));
  const removeLine = (lineId) => setForm(f => ({ ...f, lines: f.lines.length <= 1 ? f.lines : f.lines.filter(l => l.lineId !== lineId) }));

  /* Barcode/SKU auto-fill */
  const handleBarcodeBlur = (lineId, val) => {
    if (!val.trim()) return;
    const found = lookupBarcode(val.trim());
    if (found) {
      setLine(lineId, {
        barcode:       found.barcode,
        sku:           found.sku || "",
        product:       found.product || found.description || "",
        division:      found.division || "",
        section:       found.section || "",
        department:    found.department || "",
        current_stock: found.qty ?? found.stockQty ?? 0,
      });
    }
  };

  /* Totals */
  const totals = useMemo(() => {
    if (!form) return { plus: 0, minus: 0, net: 0 };
    const plus  = form.lines.reduce((a, l) => a + Math.max(0, clampInt(l.qty_change)), 0);
    const minus = form.lines.reduce((a, l) => a + Math.abs(Math.min(0, clampInt(l.qty_change))), 0);
    return { plus, minus, net: plus - minus };
  }, [form]);

  /* Save */
  const handleSave = async () => {
    if (!form.warehouse.trim()) { setFormErr("Warehouse is required."); return; }
    const clean = form.lines.filter(l => (l.barcode || l.sku) && clampInt(l.qty_change) !== 0 && l.reason.trim());
    if (!clean.length) { setFormErr("Add at least 1 line with barcode/SKU, non-zero qty, and reason."); return; }

    setSaving(true); setFormErr("");
    try {
      const payload = { ...form, lines: clean.map(l => ({ ...l, qty_change: clampInt(l.qty_change) })) };
      const res  = await fetch(`${API_BASE}/inventory/stock-adjustments`, {
        method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      closeModal();
      fetchRecords();
      // Refresh inventory lookup
      const stockUrl = isStoreWorkspace
        ? `${API_BASE}/stock-allocation/store-stock/${storeId}`
        : `${API_BASE}/inventory/current-stock`;
      fetch(stockUrl, { headers: authHeaders() }).then(r => r.json()).then(d => setInvRows(d.data || []));
    } catch (e) { setFormErr(e.message); }
    finally { setSaving(false); }
  };

  /* PDF */
  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("Stock Adjustment", 40, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Generated: ${todayYmd()}`, 40, 58);
    const body = [];
    records.forEach(rec => rec.lines.forEach(l => body.push([
      rec.date, rec.ref_no, rec.warehouse, l.sku, l.barcode, l.product,
      l.division||"", l.section||"", l.department||"",
      String(l.qty_change), l.reason||"", l.remarks||"",
    ])));
    autoTable(doc, {
      head: [["Date","Ref No","Warehouse","SKU","Barcode","Product","Division","Section","Dept","Qty","Reason","Remarks"]],
      body, startY: 76,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 9: { halign: "right" } }, margin: { left: 40, right: 40 },
    });
    doc.save(`stock-adjustment-${todayYmd()}.pdf`);
  };

  /* Form cascade helpers */
  const formDivisions   = useMemo(() => Object.keys(mapping).sort(), [mapping]);
  const formSections    = (div) => div && mapping[div] ? Object.keys(mapping[div]).sort() : [];
  const formDepartments = (div, sec) => div && sec && mapping[div]?.[sec] ? [...mapping[div][sec]].sort() : [];

  return (
    <div className="h-full min-h-0 overflow-hidden p-4 lg:p-6 flex flex-col gap-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl"><FaExchangeAlt className="text-white text-lg" /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{isStoreWorkspace ? "Store Stock Adjustment" : "Stock Adjustment"}</h1>
            <p className="text-xs text-slate-500">{records.length} records {isStoreWorkspace ? `· ${storeName}` : ""}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={fetchRecords} disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm font-medium disabled:opacity-50">
            <FaSyncAlt className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={exportPdf}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
            <FaFilePdf /> Export PDF
          </button>
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
            <FaPlus /> Add Adjustment
          </button>
        </div>
      </div>

      {error && <div className="shrink-0 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm"><span className="font-semibold">Error:</span> {error}</div>}

      {isStoreWorkspace && (
        <div className="shrink-0 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <span className="font-bold">Store-only adjustment:</span> changes apply only to {storeName}. Use + for stock found and − for a verified shortage; stock cannot go below zero.
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-3 sm:p-4 shrink-0 border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <FS label="Division" icon={<FaLayerGroup className="text-slate-500 text-xs" />}
            value={division} onChange={v => { setDivision(v); setSection("All"); setDepartment("All"); }}
            options={["All", ...divisions]} />
          <FS label="Section" icon={<FaFilter className="text-slate-500 text-xs" />}
            value={section} onChange={v => { setSection(v); setDepartment("All"); }}
            options={["All", ...sections]} disabled={division === "All"} />
          <FS label="Department" icon={<FaBuilding className="text-slate-500 text-xs" />}
            value={department} onChange={setDepartment}
            options={["All", ...departments]} disabled={section === "All"} />
          {isStoreWorkspace ? (
            <div className="min-w-0"><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Store</label><div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700"><FaWarehouse className="text-xs" />{storeName}</div></div>
          ) : (
            <FS label="Warehouse" icon={<FaWarehouse className="text-slate-500 text-xs" />}
              value={warehouse} onChange={setWarehouse} options={warehouses} />
          )}
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Search</label>
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 border border-slate-200 focus-within:border-indigo-400">
              <FaSearch className="text-slate-400 text-xs shrink-0" />
              <input type="text" placeholder="Ref / SKU / Barcode / Product / Reason"
                className="bg-transparent outline-none py-2 w-full text-sm"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch("")} className="text-slate-400 text-xs">✕</button>}
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">Showing <span className="font-semibold text-slate-900">{records.length}</span> adjustments</div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm flex-1 min-h-0 overflow-hidden border border-slate-200">
        <div className="h-full overflow-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                {["Date","Ref No","Warehouse","Note","Lines","Net Qty"].map((h, i) => (
                  <th key={h} className={`px-3 py-3 text-xs font-semibold uppercase tracking-wider ${i >= 4 ? "text-right" : "text-left"} whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <FaSyncAlt className="animate-spin text-xl text-indigo-400" />
                    <span className="text-sm">Loading…</span>
                  </div>
                </td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <FaExchangeAlt className="text-3xl opacity-30" />
                    <span className="text-sm">No adjustments yet</span>
                    <button onClick={openCreate} className="text-indigo-600 text-xs font-semibold hover:underline">+ Add first adjustment</button>
                  </div>
                </td></tr>
              ) : records.map(rec => {
                const net = rec.lines.reduce((a, l) => a + (Number(l.qty_change) || 0), 0);
                return (
                  <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{rec.date}</td>
                    <td className="px-3 py-3 font-semibold text-indigo-600 font-mono text-xs whitespace-nowrap">{rec.ref_no}</td>
                    <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{rec.warehouse}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{rec.note || "—"}</td>
                    <td className="px-3 py-3 text-right font-semibold">{rec.lines.length}</td>
                    <td className={`px-3 py-3 text-right font-bold tabular-nums ${net > 0 ? "text-emerald-700" : net < 0 ? "text-rose-700" : "text-slate-500"}`}>{net > 0 ? `+${net}` : net}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {open && form && (
        <div className="fixed inset-0 z-[999]">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="absolute inset-0 bg-white flex flex-col">
            <div className="sticky top-0 z-10 bg-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3 border-b border-slate-200 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add Stock Adjustment</h2>
                <p className="text-xs text-slate-500 mt-0.5">Enter barcode/SKU — product & stock auto-fill from inventory</p>
              </div>
              <button onClick={closeModal} className="w-9 h-9 grid place-items-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"><FaTimes /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
              <div className="max-w-[1600px] mx-auto">

                {/* Header fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Date & Time</label>
                    <input className={cn(BLUE_INPUT, READONLY)} value={form.date} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Warehouse *</label>
                    <input className={cn(BLUE_INPUT, isStoreWorkspace && READONLY)} value={form.warehouse}
                      readOnly={isStoreWorkspace}
                      onChange={e => setForm(f => ({ ...f, warehouse: e.target.value }))}
                      placeholder="e.g. Main Warehouse" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Reference No</label>
                    <input className={cn(BLUE_INPUT, READONLY)} value={form.ref_no} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Created By</label>
                    <input className={cn(BLUE_INPUT, READONLY)} value={form.created_by} readOnly />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Note</label>
                    <textarea className={cn(BLUE_INPUT, "min-h-[64px]")} value={form.note}
                      onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                      placeholder="Reason for adjustment batch…" />
                  </div>
                </div>

                {/* Lines */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">Adjustment Lines</div>
                    <div className="text-xs text-slate-500">Scan or type barcode — product & current stock auto-fill</div>
                  </div>
                  <button onClick={addLine}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
                    <FaPlus /> Add Line
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="max-h-[45vh] overflow-y-auto">
                      <table className="w-full text-sm min-w-[1400px]">
                        <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                          <tr>
                            {["Barcode / SKU","Product","Division","Section","Department","Current Stock","Qty Change","Reason","Remarks",""].map((h, i) => (
                              <th key={i} className={`px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${["Current Stock","Qty Change"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {form.lines.map(l => {
                            const secs = l.division && mapping[l.division] ? Object.keys(mapping[l.division]).sort() : [];
                            const deps = l.division && l.section && mapping[l.division]?.[l.section] ? [...mapping[l.division][l.section]].sort() : [];
                            return (
                              <tr key={l.lineId} className="hover:bg-slate-50">
                                {/* Barcode/SKU */}
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1">
                                    <FaBarcode className="text-slate-400 text-xs shrink-0" />
                                    <input className={cn(BLUE_CELL, "w-[180px]")}
                                      value={l.barcode || l.sku}
                                      onChange={e => setLine(l.lineId, { barcode: e.target.value, sku: e.target.value })}
                                      onBlur={e => handleBarcodeBlur(l.lineId, e.target.value)}
                                      placeholder="Scan barcode or SKU" />
                                  </div>
                                </td>
                                {/* Product */}
                                <td className="px-3 py-2">
                                  <input className={cn(BLUE_CELL, "w-[220px]")} value={l.product}
                                    onChange={e => setLine(l.lineId, { product: e.target.value })}
                                    placeholder="Product name" />
                                </td>
                                {/* Division */}
                                <td className="px-3 py-2">
                                  <select className={cn(BLUE_CELL, "w-[180px]")} value={l.division}
                                    onChange={e => setLine(l.lineId, { division: e.target.value, section: "", department: "" })}>
                                    <option value="">Select</option>
                                    {formDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                                  </select>
                                </td>
                                {/* Section */}
                                <td className="px-3 py-2">
                                  <select className={cn(BLUE_CELL, "w-[200px]")} value={l.section}
                                    onChange={e => setLine(l.lineId, { section: e.target.value, department: "" })}
                                    disabled={!l.division || !secs.length}>
                                    <option value="">{l.division ? "Select" : "— Division first —"}</option>
                                    {secs.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </td>
                                {/* Department */}
                                <td className="px-3 py-2">
                                  <select className={cn(BLUE_CELL, "w-[190px]")} value={l.department}
                                    onChange={e => setLine(l.lineId, { department: e.target.value })}
                                    disabled={!l.section || !deps.length}>
                                    <option value="">{l.section ? "Select" : "— Section first —"}</option>
                                    {deps.map(d => <option key={d} value={d}>{d}</option>)}
                                  </select>
                                </td>
                                {/* Current stock */}
                                <td className="px-3 py-2 text-right">
                                  <span className={`inline-block px-3 py-2 rounded-xl text-sm font-mono font-bold ${l.current_stock !== null ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-slate-100 text-slate-400"}`}>
                                    {l.current_stock !== null ? l.current_stock : "—"}
                                  </span>
                                </td>
                                {/* Qty change */}
                                <td className="px-3 py-2 text-right">
                                  <input className={cn(BLUE_CELL, "w-[110px] text-right font-mono")}
                                    value={l.qty_change}
                                    onChange={e => setLine(l.lineId, { qty_change: parseSignedInt(e.target.value) })}
                                    placeholder="-3 / +5" />
                                </td>
                                {/* Reason */}
                                <td className="px-3 py-2">
                                  <input className={cn(BLUE_CELL, "w-[180px]")} value={l.reason}
                                    onChange={e => setLine(l.lineId, { reason: e.target.value })}
                                    placeholder="Reason (required)" />
                                </td>
                                {/* Remarks */}
                                <td className="px-3 py-2">
                                  <input className={cn(BLUE_CELL, "w-[180px]")} value={l.remarks}
                                    onChange={e => setLine(l.lineId, { remarks: e.target.value })}
                                    placeholder="Remarks" />
                                </td>
                                {/* Remove */}
                                <td className="px-3 py-2 text-right">
                                  <button onClick={() => removeLine(l.lineId)}
                                    className="w-9 h-9 grid place-items-center rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200">
                                    <FaTrash style={{ fontSize: 11 }} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Added (+)", val: `+${totals.plus}`, color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
                    { label: "Total Reduced (-)", val: `-${totals.minus}`, color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
                    { label: "Net Change", val: totals.net >= 0 ? `+${totals.net}` : String(totals.net), color: totals.net >= 0 ? "#059669" : "#DC2626", bg: totals.net >= 0 ? "#ECFDF5" : "#FEF2F2", border: totals.net >= 0 ? "#A7F3D0" : "#FECACA" },
                  ].map(({ label, val, color, bg, border }) => (
                    <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 16px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "monospace" }}>{val}</div>
                    </div>
                  ))}
                </div>

                {formErr && <div className="mt-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{formErr}</div>}

                <div className="mt-5 flex justify-end">
                  <button onClick={handleSave} disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
                    <FaSave /> {saving ? "Saving…" : "Save Adjustment"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FS({ label, icon, value, onChange, options, disabled }) {
  return (
    <div className="min-w-0">
      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
      <div className={cn("relative flex items-center gap-2 rounded-xl px-3 border transition-all",
        disabled ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus-within:border-indigo-400")}>
        {icon}
        <select className="bg-transparent outline-none py-2 w-full text-sm appearance-none"
          value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
          {(options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    </div>
  );
}
