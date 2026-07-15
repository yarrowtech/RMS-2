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
//   FaUndoAlt,
//   FaExclamationTriangle,
// } from "react-icons/fa";
// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";

// /* ===================== MASTER DATA (same system) ===================== */

// const WAREHOUSES = ["All", "Main - New Market", "Store - Chowringhee", "Store - Hatibagan"];

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
//   "House Hold Appliences": ["Crockery", "Electronics", "Melamine", "Other", "Plasticware", "Utensils"],
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
//   Utensils: ["Kadai", "Spoon", "Knife", "Plate", "Others"],
//   Crockery: ["Bowl", "Cup Set", "Dinner Set", "Plate", "Others"],
// };

// /* == DUMMY STOCK (auto fill) == */

// const DUMMY_STOCK = [
//   {
//     sku: "ACC-ST-001",
//     barcode: "8901234000001",
//     product: "Soft Teddy Bear (Medium)",
//     division: "Accessories",
//     section: "Gift & Novelties",
//     department: "Soft Toys",
//     stockByWh: { "Main - New Market": 60, "Store - Chowringhee": 18, "Store - Hatibagan": 9 },
//   },
//   {
//     sku: "HHA-UT-099",
//     barcode: "8901234000005",
//     product: "Steel Kadai 2L",
//     division: "House Hold Appliences",
//     section: "Utensils",
//     department: "Kadai",
//     stockByWh: { "Main - New Market": 12, "Store - Chowringhee": 4, "Store - Hatibagan": 2 },
//   },
//   {
//     sku: "KID-B-TS-032",
//     barcode: "8901234000006",
//     product: "Kids T-Shirt (Blue)",
//     division: "Kids",
//     section: "Boy",
//     department: "T-Shirt(B)",
//     stockByWh: { "Main - New Market": 44, "Store - Chowringhee": 10, "Store - Hatibagan": 6 },
//   },
// ];

// /* ===================== DUMMY RECORDS ===================== */

// const INITIAL_RECORDS = [
//   {
//     id: 1,
//     type: "Damage",
//     date: "2026-01-14 10:20",
//     refNo: "DMG-000081",
//     createdBy: "Inventory",
//     warehouse: "Store - Chowringhee",
//     note: "Broken during handling",
//     lines: [
//       {
//         lineId: "L1",
//         sku: "HHA-UT-099",
//         barcode: "8901234000005",
//         product: "Steel Kadai 2L",
//         division: "House Hold Appliences",
//         section: "Utensils",
//         department: "Kadai",
//         available: 4,
//         qty: 1,
//         action: "Scrap",
//         remarks: "Handle bent",
//       },
//     ],
//     status: "Completed",
//   },
//   {
//     id: 2,
//     type: "Return",
//     date: "2026-01-14 13:10",
//     refNo: "RTN-000044",
//     createdBy: "Inventory",
//     warehouse: "Main - New Market",
//     note: "Customer return (OK condition)",
//     lines: [
//       {
//         lineId: "L1",
//         sku: "ACC-ST-001",
//         barcode: "8901234000001",
//         product: "Soft Teddy Bear (Medium)",
//         division: "Accessories",
//         section: "Gift & Novelties",
//         department: "Soft Toys",
//         available: 60,
//         qty: 2,
//         action: "Restock",
//         remarks: "Seal OK",
//       },
//     ],
//     status: "Completed",
//   },
// ];

// /* ===================== HELPERS / UI ===================== */

// const cn = (...a) => a.filter(Boolean).join(" ");

// const BLUE_INPUT =
//   "w-full bg-slate-100 rounded-xl px-3 py-2 text-sm text-slate-900 " +
//   "border border-blue-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 " +
//   "outline-none placeholder:text-slate-400";

// const BLUE_CELL =
//   "w-full min-w-[140px] bg-slate-100 rounded-xl px-3 py-2 text-sm text-slate-900 " +
//   "border border-blue-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 " +
//   "outline-none placeholder:text-slate-400";

// const READONLY =
//   "bg-slate-100 cursor-not-allowed text-slate-700 border-blue-300 focus:ring-0 focus:border-blue-300";

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

// function makeRef(prefix) {
//   const rand = Math.floor(100000 + Math.random() * 900000);
//   return `${prefix}-${String(rand).slice(-6)}`;
// }

// function cryptoRandomId() {
//   try {
//     if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
//   } catch {}
//   return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
// }

// function parseIntOrEmpty(v) {
//   if (v === "" || v === null || v === undefined) return "";
//   const n = Number(v);
//   if (!Number.isFinite(n)) return "";
//   return Math.max(0, Math.trunc(n));
// }

// function sectionsForDivision(div) {
//   if (!div) return [];
//   return SECTION_MAP[div] || [];
// }

// function departmentsForSection(sec) {
//   if (!sec) return [];
//   return DEPARTMENT_MAP[sec] || [];
// }

// function sumQty(lines) {
//   return (lines || []).reduce((a, l) => a + (Number(l.qty) || 0), 0);
// }

// /* ===================== COMPONENT ===================== */

// export default function InventoryManagementDamageAndReturn() {
//   // Filters
//   const [type, setType] = useState("All");
//   const [warehouse, setWarehouse] = useState("All");
//   const [division, setDivision] = useState("All");
//   const [section, setSection] = useState("All");
//   const [department, setDepartment] = useState("All");
//   const [search, setSearch] = useState("");

//   // Records
//   const [records, setRecords] = useState(() => INITIAL_RECORDS);

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
//     return records.filter((rec) => {
//       const mType = type === "All" || rec.type === type;
//       const mWh = warehouse === "All" || rec.warehouse === warehouse;

//       const lineMatch = rec.lines.some((l) => {
//         const mCat =
//           (division === "All" || l.division === division) &&
//           (section === "All" || l.section === section) &&
//           (department === "All" || l.department === department);

//         const mQ =
//           !q ||
//           (rec.refNo || "").toLowerCase().includes(q) ||
//           (l.product || "").toLowerCase().includes(q) ||
//           (l.sku || "").toLowerCase().includes(q) ||
//           String(l.barcode || "").toLowerCase().includes(q) ||
//           (l.action || "").toLowerCase().includes(q);

//         return mCat && mQ;
//       });

//       return mType && mWh && lineMatch;
//     });
//   }, [records, type, warehouse, division, section, department, search]);

//   /* ------------------ POPUP ------------------ */

//   const [open, setOpen] = useState(false);

//   const emptyForm = () => ({
//     type: "Damage",
//     date: todayStamp(),
//     refNo: makeRef("DMG"),
//     createdBy: "Inventory",
//     warehouse: "Main - New Market",
//     note: "",
//     status: "Draft",
//     lines: [
//       {
//         lineId: cryptoRandomId(),
//         sku: "",
//         barcode: "",
//         product: "",
//         division: "",
//         section: "",
//         department: "",
//         available: 0,
//         qty: "",
//         action: "Scrap",
//         remarks: "",
//       },
//     ],
//   });

//   const [form, setForm] = useState(emptyForm());

//   const openCreate = (t) => {
//     const f = emptyForm();
//     const prefix = t === "Return" ? "RTN" : "DMG";
//     f.type = t;
//     f.refNo = makeRef(prefix);
//     f.lines = [
//       {
//         ...f.lines[0],
//         action: t === "Return" ? "Restock" : "Scrap",
//       },
//     ];
//     setForm(f);
//     setOpen(true);
//   };

//   const close = () => setOpen(false);

//   // ✅ mobile-safe modal scroll lock + ESC
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

//   // SKU -> auto fill
//   const fillFromSku = (lineId, sku) => {
//     const stock = DUMMY_STOCK.find((x) => x.sku === sku);
//     if (!stock) {
//       setLine(lineId, {
//         sku,
//         barcode: "",
//         product: "",
//         division: "",
//         section: "",
//         department: "",
//         available: 0,
//       });
//       return;
//     }
//     const avail = Number(stock.stockByWh?.[form.warehouse] || 0);
//     setLine(lineId, {
//       sku: stock.sku,
//       barcode: stock.barcode,
//       product: stock.product,
//       division: stock.division,
//       section: stock.section,
//       department: stock.department,
//       available: avail,
//     });
//   };

//   const setLine = (lineId, patch) => {
//     setForm((s) => ({
//       ...s,
//       lines: s.lines.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)),
//     }));
//   };

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
//           available: 0,
//           qty: "",
//           action: s.type === "Return" ? "Restock" : "Scrap",
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

//   // Division/Section/Department optional overrides
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

//   const totals = useMemo(() => {
//     const qty = sumQty(form.lines);
//     const validLines = form.lines.filter((l) => l.sku && Number(l.qty) > 0).length;
//     return { qty, validLines };
//   }, [form.lines]);

//   const save = () => {
//     if (!form.warehouse) return alert("Warehouse is required.");

//     const cleanLines = form.lines
//       .map((l) => ({ ...l, qty: Number(l.qty) || 0 }))
//       .filter((l) => l.sku.trim() && l.product.trim() && l.qty > 0);

//     if (cleanLines.length === 0) return alert("Add at least 1 line with SKU + Qty > 0.");

//     // Damage cannot exceed available
//     if (form.type === "Damage") {
//       for (const l of cleanLines) {
//         const avail = Number(l.available || 0);
//         if (l.qty > avail) {
//           return alert(`Damage Qty cannot be more than Available for SKU ${l.sku}. Available: ${avail}`);
//         }
//       }
//     }

//     const record = {
//       id: Math.max(0, ...records.map((x) => x.id)) + 1,
//       type: form.type,
//       date: form.date || todayStamp(),
//       refNo: form.refNo,
//       createdBy: form.createdBy || "Inventory",
//       warehouse: form.warehouse,
//       note: form.note || "",
//       status: "Completed",
//       lines: cleanLines,
//     };

//     setRecords((prev) => [record, ...prev]);
//     setOpen(false);
//   };

//   const exportPdf = () => {
//     const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
//     const createdOn = todayYmd();

//     doc.setFont("helvetica", "bold");
//     doc.setFontSize(16);
//     doc.text("Damage & Returned Stock", 40, 40);

//     doc.setFont("helvetica", "normal");
//     doc.setFontSize(10);
//     doc.text(`Generated: ${createdOn}`, 40, 58);

//     const head = [
//       [
//         "Type",
//         "Date",
//         "Ref No",
//         "Warehouse",
//         "SKU",
//         "Barcode",
//         "Product",
//         "Division",
//         "Section",
//         "Department",
//         "Qty",
//         "Action",
//         "Remarks",
//       ],
//     ];

//     const body = [];
//     filtered.forEach((rec) => {
//       rec.lines.forEach((l) => {
//         body.push([
//           rec.type,
//           rec.date,
//           rec.refNo,
//           rec.warehouse,
//           l.sku,
//           l.barcode,
//           l.product,
//           l.division || "",
//           l.section || "",
//           l.department || "",
//           String(l.qty),
//           l.action || "",
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
//       columnStyles: { 10: { halign: "right" } },
//       margin: { left: 40, right: 40 },
//     });

//     doc.save(`damage-return-${createdOn}.pdf`);
//   };

//   return (
//     // ✅ FIX: full responsive + scroll works
//     <div className="min-h-full w-full px-3 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">
//       {/* Header */}
//       <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
//         <div className="flex items-center gap-3">
//           <div className="flex items-center gap-2">
//             <FaExclamationTriangle className="text-indigo-600 text-2xl shrink-0" />
//             <FaUndoAlt className="text-indigo-600 text-xl shrink-0" />
//           </div>
//           <div className="min-w-0">
//             <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
//               Damage & Returned Stock
//             </h1>
//           </div>
//         </div>

//         {/* ✅ buttons stack on mobile */}
//         <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
//           <button
//             type="button"
//             onClick={exportPdf}
//             className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-[0.99]"
//           >
//             <FaFilePdf />
//             Export PDF
//           </button>

//           <button
//             type="button"
//             onClick={() => openCreate("Damage")}
//             className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 active:scale-[0.99]"
//           >
//             <FaPlus />
//             Add Damage
//           </button>

//           <button
//             type="button"
//             onClick={() => openCreate("Return")}
//             className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.99]"
//           >
//             <FaPlus />
//             Add Return
//           </button>
//         </div>
//       </div>

//       {/* Filters */}
//       <div className="bg-white rounded-2xl shadow-sm p-3 sm:p-4 shrink-0 border border-blue-500">
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
//           <FilterSelect
//             label="Type"
//             icon={<FaFilter className="text-slate-600" />}
//             value={type}
//             onChange={setType}
//             options={["All", "Damage", "Return"]}
//           />

//           <FilterSelect
//             label="Warehouse"
//             icon={<FaWarehouse className="text-slate-600" />}
//             value={warehouse}
//             onChange={setWarehouse}
//             options={WAREHOUSES}
//           />

//           <FilterSelect
//             label="Division"
//             icon={<FaLayerGroup className="text-slate-600" />}
//             value={division}
//             onChange={(v) => {
//               setDivision(v);
//               setSection("All");
//               setDepartment("All");
//             }}
//             options={["All", ...DIVISIONS]}
//           />

//           <FilterSelect
//             label="Section"
//             icon={<FaFilter className="text-slate-600" />}
//             value={section}
//             onChange={(v) => {
//               setSection(v);
//               setDepartment("All");
//             }}
//             options={["All", ...(division === "All" ? [] : sections)]}
//             disabled={division === "All"}
//           />

//           <FilterSelect
//             label="Department"
//             icon={<FaBuilding className="text-slate-600" />}
//             value={department}
//             onChange={setDepartment}
//             options={["All", ...(section === "All" ? [] : departments)]}
//             disabled={section === "All"}
//           />

//           <div className="min-w-0">
//             <label className="text-sm font-semibold text-slate-800">Search</label>
//             <div className="mt-1 flex items-center gap-2 rounded-xl px-3 bg-slate-100 border border-blue-400">
//               <FaSearch className="text-slate-400 shrink-0" />
//               <input
//                 type="text"
//                 placeholder="Ref / SKU / Barcode / Product / Action"
//                 className="bg-transparent outline-none w-full text-sm py-2 min-w-0"
//                 value={search}
//                 onChange={(e) => setSearch(e.target.value)}
//               />
//             </div>
//           </div>
//         </div>

//         <div className="mt-3 text-xs text-slate-500">
//           Showing <span className="font-semibold text-slate-900">{filtered.length}</span> records
//         </div>
//       </div>

//       {/* ✅ TABLE (mobile scroll + swipe) */}
//       <div className="bg-white rounded-2xl shadow-sm flex-1 min-h-0 overflow-hidden border border-blue-500">
//         <div className="h-full overflow-auto">
//           <table className="w-full text-sm min-w-[980px]">
//             <thead className="sticky top-0 z-10 bg-slate-200 text-slate-900 border-b border-blue-400">
//               <tr>
//                 <th className="p-3 text-left whitespace-nowrap">Type</th>
//                 <th className="p-3 text-left whitespace-nowrap">Date & Time</th>
//                 <th className="p-3 text-left whitespace-nowrap">Ref No</th>
//                 <th className="p-3 text-left whitespace-nowrap">Warehouse</th>
//                 <th className="p-3 text-left whitespace-nowrap">Note</th>
//                 <th className="p-3 text-right whitespace-nowrap">Lines</th>
//                 <th className="p-3 text-right whitespace-nowrap">Total Qty</th>
//                 <th className="p-3 text-left whitespace-nowrap">Status</th>
//               </tr>
//             </thead>

//             <tbody>
//               {filtered.length === 0 ? (
//                 <tr>
//                   <td colSpan={8} className="p-8 text-center text-slate-500">
//                     No records found
//                   </td>
//                 </tr>
//               ) : (
//                 filtered.map((rec) => (
//                   <tr key={rec.id} className="hover:bg-slate-50 border-b border-blue-100">
//                     <td className="p-3 whitespace-nowrap">
//                       <span
//                         className={cn(
//                           "inline-flex items-center px-2 py-1 rounded-xl text-xs font-semibold border",
//                           rec.type === "Damage"
//                             ? "bg-rose-50 text-rose-700 border-rose-200"
//                             : "bg-indigo-50 text-indigo-700 border-indigo-200"
//                         )}
//                       >
//                         {rec.type}
//                       </span>
//                     </td>

//                     <td className="p-3 whitespace-nowrap">{rec.date}</td>
//                     <td className="p-3 font-semibold whitespace-nowrap">{rec.refNo}</td>
//                     <td className="p-3 whitespace-nowrap">{rec.warehouse}</td>
//                     <td className="p-3">{rec.note || "-"}</td>
//                     <td className="p-3 text-right font-semibold whitespace-nowrap">{rec.lines.length}</td>
//                     <td className="p-3 text-right font-bold whitespace-nowrap">{sumQty(rec.lines)}</td>
//                     <td className="p-3 whitespace-nowrap">
//                       <span className="inline-flex items-center px-2 py-1 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
//                         {rec.status}
//                       </span>
//                     </td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {/* FULL PAGE POPUP */}
//       {open && (
//         <ModalShell
//           onClose={close}
//           title={`${form.type === "Damage" ? "Add Damage" : "Add Return"} Record`}
//           subtitle="Fill details and click Save."
//         >
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
//             <Input label="Date & Time" value={form.date} readOnly />
//             <Input label="Reference No" value={form.refNo} readOnly />
//             <Input label="Created By" value={form.createdBy} readOnly />

//             <div className="min-w-0">
//               <label className="text-sm font-semibold text-slate-800">Warehouse</label>
//               <select
//                 className={cn("mt-1", BLUE_INPUT)}
//                 value={form.warehouse}
//                 onChange={(e) =>
//                   setForm((s) => ({
//                     ...s,
//                     warehouse: e.target.value,
//                     lines: s.lines.map((l) => ({ ...l, available: 0 })), // refresh available
//                   }))
//                 }
//               >
//                 {WAREHOUSES.filter((x) => x !== "All").map((w) => (
//                   <option key={w} value={w}>
//                     {w}
//                   </option>
//                 ))}
//               </select>
//             </div>

//             <div className="sm:col-span-2 lg:col-span-4 min-w-0">
//               <label className="text-sm font-semibold text-slate-800">Note</label>
//               <textarea
//                 className={cn("mt-1 min-h-[80px]", BLUE_INPUT)}
//                 value={form.note}
//                 onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))}
//                 placeholder={form.type === "Damage" ? "Damage reason..." : "Return details..."}
//               />
//             </div>
//           </div>

//           <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//             <div>
//               <div className="text-base font-bold text-slate-900">Lines</div>
//               <div className="text-sm text-slate-500">SKU auto-fills product + available stock</div>
//             </div>

//             <button
//               type="button"
//               onClick={addLine}
//               className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.99]"
//             >
//               <FaPlus />
//               Add Line
//             </button>
//           </div>

//           <div className="mt-3 rounded-2xl bg-white shadow-sm border border-blue-300 overflow-hidden">
//             {/* ✅ horizontal swipe */}
//             <div className="overflow-x-auto">
//               {/* ✅ vertical scroll area */}
//               <div className="max-h-[45vh] sm:max-h-[55vh] overflow-y-auto">
//                 <table className="w-full text-sm min-w-[1600px]">
//                   <thead className="sticky top-0 z-10 bg-slate-200 text-slate-900 border-b border-blue-400">
//                     <tr>
//                       <th className="p-3 text-left whitespace-nowrap">SKU</th>
//                       <th className="p-3 text-left whitespace-nowrap">Barcode</th>
//                       <th className="p-3 text-left whitespace-nowrap">Product</th>
//                       <th className="p-3 text-left whitespace-nowrap">Division</th>
//                       <th className="p-3 text-left whitespace-nowrap">Section</th>
//                       <th className="p-3 text-left whitespace-nowrap">Department</th>
//                       <th className="p-3 text-right whitespace-nowrap">Available</th>
//                       <th className="p-3 text-right whitespace-nowrap">Qty</th>
//                       <th className="p-3 text-left whitespace-nowrap">Action</th>
//                       <th className="p-3 text-left whitespace-nowrap">Remarks</th>
//                       <th className="p-3 text-right whitespace-nowrap">Remove</th>
//                     </tr>
//                   </thead>

//                   <tbody>
//                     {form.lines.map((l) => {
//                       const secOpts = sectionsForDivision(l.division);
//                       const depOpts = departmentsForSection(l.section);

//                       const actionOptions =
//                         form.type === "Damage"
//                           ? ["Scrap", "Repair", "Return to Vendor", "Write-off"]
//                           : ["Restock", "Exchange", "Return to Vendor", "Hold (QC)"];

//                       return (
//                         <tr key={l.lineId} className="border-b border-blue-100">
//                           <td className="p-3">
//                             <select
//                               className={cn(BLUE_CELL, "w-[170px]")}
//                               value={l.sku}
//                               onChange={(e) => fillFromSku(l.lineId, e.target.value)}
//                             >
//                               <option value="">Select SKU</option>
//                               {DUMMY_STOCK.map((x) => (
//                                 <option key={x.sku} value={x.sku}>
//                                   {x.sku}
//                                 </option>
//                               ))}
//                             </select>
//                           </td>

//                           <td className="p-3">
//                             <input className={cn(BLUE_CELL, "w-[170px]", READONLY)} value={l.barcode} readOnly />
//                           </td>

//                           <td className="p-3">
//                             <input className={cn(BLUE_CELL, "w-[260px]", READONLY)} value={l.product} readOnly />
//                           </td>

//                           <td className="p-3">
//                             <select
//                               className={cn(BLUE_CELL, "w-[200px]")}
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
//                               className={cn(BLUE_CELL, "w-[230px]")}
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
//                               className={cn(BLUE_CELL, "w-[220px]")}
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
//                               className={cn(BLUE_CELL, "w-[110px] text-right", READONLY)}
//                               value={l.available}
//                               readOnly
//                             />
//                           </td>

//                           <td className="p-3 text-right">
//                             <input
//                               className={cn(BLUE_CELL, "w-[110px] text-right")}
//                               value={l.qty}
//                               onChange={(e) => setLine(l.lineId, { qty: parseIntOrEmpty(e.target.value) })}
//                               placeholder="0"
//                             />
//                           </td>

//                           <td className="p-3">
//                             <select
//                               className={cn(BLUE_CELL, "w-[200px]")}
//                               value={l.action}
//                               onChange={(e) => setLine(l.lineId, { action: e.target.value })}
//                             >
//                               {actionOptions.map((a) => (
//                                 <option key={a} value={a}>
//                                   {a}
//                                 </option>
//                               ))}
//                             </select>
//                           </td>

//                           <td className="p-3">
//                             <input
//                               className={cn(BLUE_CELL, "w-[240px]")}
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

//           <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
//             <MiniStat label="Valid Lines" value={totals.validLines} tone="slate" />
//             <MiniStat label="Total Qty" value={totals.qty} tone={form.type === "Damage" ? "red" : "green"} />
//           </div>

//           <div className="w-full flex items-center justify-end mt-5">
//             <button
//               type="button"
//               onClick={save}
//               className={cn(
//                 "w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl text-white text-sm font-semibold active:scale-[0.99]",
//                 form.type === "Damage" ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"
//               )}
//             >
//               <FaSave />
//               Save {form.type}
//             </button>
//           </div>
//         </ModalShell>
//       )}
//     </div>
//   );
// }

// /* ===================== UI COMPONENTS ===================== */

// function FilterSelect({ label, icon, value, onChange, options, disabled }) {
//   return (
//     <div className="min-w-0">
//       <label className="text-sm font-semibold text-slate-800">{label}</label>
//       <div className={cn("mt-1 flex items-center gap-2 rounded-xl px-3", BLUE_INPUT, disabled && "opacity-80")}>
//         {icon}
//         <select
//           className={cn("bg-transparent outline-none py-2 w-full text-sm min-w-0", disabled && "cursor-not-allowed")}
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

// function Input({ label, value, readOnly = false }) {
//   return (
//     <div className="min-w-0">
//       <label className="text-sm font-semibold text-slate-800">{label}</label>
//       <input className={cn("mt-1", BLUE_INPUT, readOnly && "cursor-not-allowed opacity-90")} value={value} readOnly={readOnly} />
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
//     <div className={cn("rounded-2xl px-4 py-3 border", toneClass)}>
//       <div className="text-[11px] font-black tracking-[0.22em] uppercase opacity-80">{label}</div>
//       <div className="mt-1 text-xl font-black">{value}</div>
//     </div>
//   );
// }

// /**
//  * ✅ FULL SCREEN MODAL (mobile safe)
//  * - safe area padding
//  * - sticky header
//  * - scroll body
//  */
// function ModalShell({ children, onClose, title, subtitle }) {
//   return (
//     <div className="fixed inset-0 z-[999]">
//       <div className="absolute inset-0 bg-black/40" onClick={onClose} />
//       <div className="absolute inset-0 bg-white flex flex-col">
//         <div
//           className="sticky top-0 z-10 bg-white px-4 sm:px-5 py-4 flex items-start sm:items-center justify-between gap-3 shadow-sm border-b border-blue-200"
//           style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
//         >
//           <div className="min-w-0">
//             <h2 className="text-lg font-bold text-slate-900 truncate">{title}</h2>
//             <p className="text-sm text-slate-500">{subtitle}</p>
//           </div>

//           <button
//             type="button"
//             onClick={onClose}
//             className="h-10 w-10 shrink-0 grid place-items-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-blue-200"
//             title="Close"
//           >
//             <FaTimes />
//           </button>
//         </div>

//         <div
//           className="flex-1 overflow-y-auto px-3 sm:px-5 py-4"
//           style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
//         >
//           <div className="max-w-[1700px] mx-auto">{children}</div>
//         </div>
//       </div>
//     </div>
//   );
// }

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  FaWarehouse, FaLayerGroup, FaFilter, FaBuilding,
  FaSearch, FaPlus, FaSave, FaTrash, FaFilePdf,
  FaTimes, FaUndoAlt, FaExclamationTriangle, FaSyncAlt, FaBarcode,
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

const READONLY = "bg-slate-200 cursor-not-allowed text-slate-600 border-slate-300 focus:ring-0";

function todayStamp() {
  const d = new Date(), pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function todayYmd() {
  const d = new Date(), pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function makeRef(prefix) {
  return `${prefix}-${String(Math.floor(100000 + Math.random() * 900000)).slice(-6)}`;
}
function cryptoId() {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch {}
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
function parsePositiveInt(v) {
  if (v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : "";
}
function clampInt(v) {
  const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}
function sumQty(lines) {
  return (lines || []).reduce((a, l) => a + (Number(l.qty) || 0), 0);
}

/* ─── Type badge ─── */
function TypeBadge({ type }) {
  return type === "Damage"
    ? <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:"#FEF2F2", color:"#DC2626", border:"1px solid #FECACA" }}>Damage</span>
    : <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:"#EEF2FF", color:"#6366F1", border:"1px solid #C7D2FE" }}>Return</span>;
}

/* ─── Main Component ─── */
export default function DamageReturnStock() {
  /* Filters */
  const [typeFilter, setTypeFilter] = useState("All");
  const [warehouse,  setWarehouse]  = useState("All");
  const [division,   setDivision]   = useState("All");
  const [section,    setSection]    = useState("All");
  const [department, setDepartment] = useState("All");
  const [search,     setSearch]     = useState("");

  /* Mapping + inventory */
  const [mapping,    setMapping]    = useState({});
  const [invRows,    setInvRows]    = useState([]);
  const [warehouses, setWarehouses] = useState(["All"]);

  /* Records */
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  /* Modal */
  const [open,    setOpen]   = useState(false);
  const [saving,  setSaving] = useState(false);
  const [formErr, setFormErr]= useState("");
  const [form,    setForm]   = useState(null);

  /* Cascade */
  const divisions   = useMemo(() => Object.keys(mapping).sort(), [mapping]);
  const sections    = useMemo(() => division !== "All" && mapping[division] ? Object.keys(mapping[division]).sort() : [], [division, mapping]);
  const departments = useMemo(() => division !== "All" && section !== "All" && mapping[division]?.[section] ? [...mapping[division][section]].sort() : [], [division, section, mapping]);

  /* Load mapping + inventory */
  useEffect(() => {
    fetch(`${API_BASE}/api/product-mapping/grouped`).then(r => r.json()).then(d => setMapping(d.data || {})).catch(() => {});
    fetch(`${API_BASE}/inventory/current-stock`).then(r => r.json()).then(d => setInvRows(d.data || [])).catch(() => {});
  }, []);

  /* Fetch records */
  const fetchRecords = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "All") params.append("type",       typeFilter);
      if (warehouse  !== "All") params.append("warehouse",  warehouse);
      if (division   !== "All") params.append("division",   division);
      if (section    !== "All") params.append("section",    section);
      if (department !== "All") params.append("department", department);
      if (search.trim())        params.append("search",     search.trim());

      const res  = await fetch(`${API_BASE}/inventory/damage-return?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      const data = json.data || [];
      setRecords(data);
      const whs = ["All", ...new Set(data.map(r => r.warehouse).filter(Boolean))].sort();
      setWarehouses(whs);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [typeFilter, warehouse, division, section, department, search]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  /* Barcode lookup */
  const lookupBarcode = (val) => invRows.find(r => r.barcode === val || r.sku === val) || null;

  /* Empty line */
  const emptyLine = (type) => ({
    lineId: cryptoId(), sku: "", barcode: "", product: "",
    division: "", section: "", department: "",
    available: null, qty: "",
    action: type === "Return" ? "Restock" : "Scrap",
    remarks: "",
  });

  /* Open modal */
  const openCreate = (type) => {
    const prefix = type === "Return" ? "RTN" : "DMG";
    setForm({ type, date: todayStamp(), ref_no: makeRef(prefix), created_by: "Inventory", warehouse: "Main Warehouse", note: "", lines: [emptyLine(type)] });
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
  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, emptyLine(f.type)] }));
  const removeLine = (lineId) => setForm(f => ({ ...f, lines: f.lines.length <= 1 ? f.lines : f.lines.filter(l => l.lineId !== lineId) }));

  /* Barcode auto-fill */
  const handleBarcodeBlur = (lineId, val) => {
    if (!val.trim()) return;
    const found = lookupBarcode(val.trim());
    if (found) {
      setLine(lineId, {
        barcode: found.barcode, sku: found.sku || "",
        product: found.product || "",
        division: found.division || "", section: found.section || "", department: found.department || "",
        available: found.qty,
      });
    }
  };

  /* Totals */
  const totals = useMemo(() => form ? { qty: sumQty(form.lines), valid: form.lines.filter(l => l.barcode && clampInt(l.qty) > 0).length } : { qty: 0, valid: 0 }, [form]);

  /* Save */
  const handleSave = async () => {
    if (!form.warehouse.trim()) { setFormErr("Warehouse is required."); return; }
    const clean = form.lines.filter(l => (l.barcode || l.sku) && clampInt(l.qty) > 0)
      .map(l => ({ ...l, qty: clampInt(l.qty) }));
    if (!clean.length) { setFormErr("Add at least 1 line with barcode/SKU and qty > 0."); return; }

    setSaving(true); setFormErr("");
    try {
      const payload = { ...form, lines: clean };
      const res  = await fetch(`${API_BASE}/inventory/damage-return`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      closeModal(); fetchRecords();
      fetch(`${API_BASE}/inventory/current-stock`).then(r => r.json()).then(d => setInvRows(d.data || []));
    } catch (e) { setFormErr(e.message); }
    finally { setSaving(false); }
  };

  /* PDF */
  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("Damage & Returned Stock", 40, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Generated: ${todayYmd()}`, 40, 58);
    const body = [];
    records.forEach(rec => rec.lines.forEach(l => body.push([
      rec.type, rec.date, rec.ref_no, rec.warehouse,
      l.sku, l.barcode, l.product, l.division||"", l.section||"", l.department||"",
      String(l.qty), l.action||"", l.remarks||"",
    ])));
    autoTable(doc, {
      head: [["Type","Date","Ref No","Warehouse","SKU","Barcode","Product","Division","Section","Dept","Qty","Action","Remarks"]],
      body, startY: 76,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 10: { halign: "right" } }, margin: { left: 40, right: 40 },
    });
    doc.save(`damage-return-${todayYmd()}.pdf`);
  };

  /* Form cascade helpers */
  const formDivisions   = useMemo(() => Object.keys(mapping).sort(), [mapping]);
  const lineSections    = (div) => div && mapping[div] ? Object.keys(mapping[div]).sort() : [];
  const lineDepartments = (div, sec) => div && sec && mapping[div]?.[sec] ? [...mapping[div][sec]].sort() : [];

  return (
    <div className="min-h-full w-full px-3 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="p-2 bg-rose-600 rounded-xl"><FaExclamationTriangle className="text-white" /></div>
            <div className="p-2 bg-indigo-600 rounded-xl"><FaUndoAlt className="text-white" /></div>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Damage & Returned Stock</h1>
            <p className="text-xs text-slate-500">{records.length} records</p>
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
          <button onClick={() => openCreate("Damage")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700">
            <FaPlus /> Add Damage
          </button>
          <button onClick={() => openCreate("Return")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
            <FaPlus /> Add Return
          </button>
        </div>
      </div>

      {error && <div className="shrink-0 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm"><span className="font-semibold">Error:</span> {error}</div>}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-3 sm:p-4 shrink-0 border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <FS label="Type" icon={<FaFilter className="text-slate-500 text-xs" />}
            value={typeFilter} onChange={setTypeFilter} options={["All","Damage","Return"]} />
          <FS label="Warehouse" icon={<FaWarehouse className="text-slate-500 text-xs" />}
            value={warehouse} onChange={setWarehouse} options={warehouses} />
          <FS label="Division" icon={<FaLayerGroup className="text-slate-500 text-xs" />}
            value={division} onChange={v => { setDivision(v); setSection("All"); setDepartment("All"); }}
            options={["All", ...divisions]} />
          <FS label="Section" icon={<FaFilter className="text-slate-500 text-xs" />}
            value={section} onChange={v => { setSection(v); setDepartment("All"); }}
            options={["All", ...sections]} disabled={division === "All"} />
          <FS label="Department" icon={<FaBuilding className="text-slate-500 text-xs" />}
            value={department} onChange={setDepartment}
            options={["All", ...departments]} disabled={section === "All"} />
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Search</label>
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 border border-slate-200 focus-within:border-indigo-400">
              <FaSearch className="text-slate-400 text-xs shrink-0" />
              <input type="text" placeholder="Ref / SKU / Barcode / Product / Action"
                className="bg-transparent outline-none py-2 w-full text-sm"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch("")} className="text-slate-400 text-xs">✕</button>}
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">Showing <span className="font-semibold text-slate-900">{records.length}</span> records</div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm flex-1 min-h-0 overflow-hidden border border-slate-200">
        <div className="h-full overflow-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                {["Type","Date","Ref No","Warehouse","Note","Lines","Total Qty","Status"].map((h, i) => (
                  <th key={h} className={`px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${["Lines","Total Qty"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="p-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <FaSyncAlt className="animate-spin text-xl text-indigo-400" />
                    <span className="text-sm">Loading…</span>
                  </div>
                </td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={8} className="p-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <FaExclamationTriangle className="text-3xl opacity-30" />
                    <span className="text-sm">No damage or return records yet</span>
                  </div>
                </td></tr>
              ) : records.map(rec => (
                <tr key={rec.id} className={`hover:bg-slate-50 transition-colors ${rec.type === "Damage" ? "bg-rose-50/20" : ""}`}>
                  <td className="px-3 py-3 whitespace-nowrap"><TypeBadge type={rec.type} /></td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{rec.date}</td>
                  <td className="px-3 py-3 font-semibold text-xs font-mono whitespace-nowrap" style={{ color: rec.type === "Damage" ? "#DC2626" : "#6366F1" }}>{rec.ref_no}</td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{rec.warehouse}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{rec.note || "—"}</td>
                  <td className="px-3 py-3 text-right font-semibold">{rec.lines.length}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums" style={{ color: rec.type === "Damage" ? "#DC2626" : "#6366F1" }}>{sumQty(rec.lines)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:"#ECFDF5", color:"#059669", border:"1px solid #A7F3D0" }}>
                      {rec.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {open && form && (
        <div className="fixed inset-0 z-[999]">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="absolute inset-0 bg-white flex flex-col">
            <div className="sticky top-0 z-10 bg-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3 border-b shadow-sm"
              style={{ borderColor: form.type === "Damage" ? "#FECACA" : "#C7D2FE" }}>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {form.type === "Damage" ? "Add Damage Record" : "Add Return Record"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Scan barcode — product & available stock auto-fill</p>
              </div>
              <button onClick={closeModal} className="w-9 h-9 grid place-items-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"><FaTimes /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
              <div className="max-w-[1700px] mx-auto">

                {/* Header */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Date & Time</label>
                    <input className={cn(BLUE_INPUT, READONLY)} value={form.date} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Reference No</label>
                    <input className={cn(BLUE_INPUT, READONLY)} value={form.ref_no} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Created By</label>
                    <input className={cn(BLUE_INPUT, READONLY)} value={form.created_by} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Warehouse *</label>
                    <input className={BLUE_INPUT} value={form.warehouse}
                      onChange={e => setForm(f => ({ ...f, warehouse: e.target.value }))}
                      placeholder="e.g. Main Warehouse" />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Note</label>
                    <textarea className={cn(BLUE_INPUT, "min-h-[64px]")} value={form.note}
                      onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                      placeholder={form.type === "Damage" ? "Damage description…" : "Return details…"} />
                  </div>
                </div>

                {/* Lines */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">Lines</div>
                    <div className="text-xs text-slate-500">Scan barcode → product & available stock auto-fill from inventory</div>
                  </div>
                  <button onClick={addLine}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-white text-xs font-semibold"
                    style={{ background: form.type === "Damage" ? "#DC2626" : "#6366F1" }}>
                    <FaPlus /> Add Line
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="max-h-[45vh] overflow-y-auto">
                      <table className="w-full text-sm min-w-[1600px]">
                        <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                          <tr>
                            {["Barcode / SKU","Product","Division","Section","Department","Available","Qty","Action","Remarks",""].map((h, i) => (
                              <th key={i} className={`px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${["Available","Qty"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {form.lines.map(l => {
                            const secs = lineSections(l.division);
                            const deps = lineDepartments(l.division, l.section);
                            const actionOptions = form.type === "Damage"
                              ? ["Scrap","Repair","Return to Vendor","Write-off"]
                              : ["Restock","Exchange","Return to Vendor","Hold (QC)"];
                            const isOverQty = form.type === "Damage" && l.available !== null && clampInt(l.qty) > l.available;

                            return (
                              <tr key={l.lineId} className={`hover:bg-slate-50 ${isOverQty ? "bg-rose-50" : ""}`}>
                                {/* Barcode */}
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
                                {/* Available */}
                                <td className="px-3 py-2 text-right">
                                  <span className={`inline-block px-3 py-2 rounded-xl text-sm font-mono font-bold ${l.available !== null ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-slate-100 text-slate-400"}`}>
                                    {l.available !== null ? l.available : "—"}
                                  </span>
                                </td>
                                {/* Qty */}
                                <td className="px-3 py-2 text-right">
                                  <div>
                                    <input className={cn(BLUE_CELL, "w-[110px] text-right font-mono", isOverQty && "border-rose-500 bg-rose-50")}
                                      value={l.qty}
                                      onChange={e => setLine(l.lineId, { qty: parsePositiveInt(e.target.value) })}
                                      placeholder="0" />
                                    {isOverQty && <div className="text-xs text-rose-600 mt-1">Exceeds available</div>}
                                  </div>
                                </td>
                                {/* Action */}
                                <td className="px-3 py-2">
                                  <select className={cn(BLUE_CELL, "w-[190px]")} value={l.action}
                                    onChange={e => setLine(l.lineId, { action: e.target.value })}>
                                    {actionOptions.map(a => <option key={a} value={a}>{a}</option>)}
                                  </select>
                                </td>
                                {/* Remarks */}
                                <td className="px-3 py-2">
                                  <input className={cn(BLUE_CELL, "w-[200px]")} value={l.remarks}
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
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { label: "Valid Lines", val: totals.valid, color: "#6366F1", bg: "#EEF2FF", border: "#C7D2FE" },
                    { label: "Total Qty", val: totals.qty, color: form.type === "Damage" ? "#DC2626" : "#059669", bg: form.type === "Damage" ? "#FEF2F2" : "#ECFDF5", border: form.type === "Damage" ? "#FECACA" : "#A7F3D0" },
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
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
                    style={{ background: form.type === "Damage" ? "#DC2626" : "#6366F1" }}>
                    <FaSave /> {saving ? "Saving…" : `Save ${form.type}`}
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