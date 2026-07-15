import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
// import React, { useMemo, useState, useEffect } from "react";
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
// } from "react-icons/fa";
// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";

// /* ===================== MASTER DATA (same as your system) ===================== */

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
//     "Personal Care Shavingving Needs",
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
//     "Ready To Cook Italian Delicacies",
//     "Ready To Cook Noodles",
//     "Ready To Eat Bakery & Poultry",
//     "Ready To Eat Bakery Products",
//     "Ready To Eat Biscuits",
//     "Ready To Eat Breakfast Cereals",
//     "Ready To Eat Chocolates & Candies",
//     "Ready To Eat Sweets & Chikkis",
//     "Ready To Eat Wafers & Namkeens",
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
//   Staples: [
//     "Basic Staples(Packed)",
//     "Basic Staples Packed Spices",
//     "Basic Staples Packed Dry Fruits",
//     "Basic Staples Packed Flours",
//     "Basic Staples Packed Pulses",
//     "Basic Staples Packed Sugar,Salt,Jaggary",
//     "Flours",
//   ],
//   "Winter Garments": ["Kids", "Ladies", "Men'S", "Others"],
// };

// const DEPARTMENT_MAP = {
//   "Gift & Novelties": ["Baby Accessory", "Books", "Soft Toys", "Stationary", "Toys"],
//   "Jewellery & Ornaments": ["Imitation"],
//   "Mens(Bi)": ["Shirt(Casual)", "Shirt(Formal)"],
//   Boy: ["T-Shirt(B)", "Jeans(B)", "Shirt(B)", "Trouser(B)"],
//   Girls: ["Frock(G)", "Jeans(G)", "Top(G)", "T-Shirt(G)"],
//   Utensils: ["Kadai", "Spoon", "Knife", "Plate"],
//   Crockery: ["Bowl", "Cup Set", "Dinner Set", "Plate"],
//   "Personal Care Hair Care": ["Hair Shampoo", "Hair Oils", "Hair Serum"],
//   "Personal Care Skin Care": ["Face Wash", "Body Lotion", "Hand Wash"],
//   "Ready To Eat Biscuits": ["Plain Biscuits", "Salted Biscuits", "Wafer Biscuits"],
//   "Ready To Eat Chocolates & Candies": ["Confectionery", "Sweets & Candies"],
// };

// const WAREHOUSES = ["All", "Main - New Market", "Store - Chowringhee", "Store - Hatibagan"];

// /* ===================== DUMMY STOCK (frontend only) ===================== */

// const DUMMY_REORDER_RULES = [
//   {
//     id: 1,
//     division: "Accessories",
//     section: "Gift & Novelties",
//     department: "Soft Toys",
//     sku: "ACC-ST-001",
//     barcode: "8901234000001",
//     product: "Soft Teddy Bear (Medium)",
//     warehouse: "Main - New Market",
//     currentStock: 38,
//     reorderLevel: 50,
//     reorderQty: 120,
//     leadTimeDays: 7,
//     supplier: "ABC Traders",
//     remarks: "Fast mover",
//   },
//   {
//     id: 2,
//     division: "Kids",
//     section: "Boy",
//     department: "T-Shirt(B)",
//     sku: "KID-B-TS-032",
//     barcode: "8901234000006",
//     product: "Kids T-Shirt (Blue)",
//     warehouse: "Store - Chowringhee",
//     currentStock: 12,
//     reorderLevel: 15,
//     reorderQty: 60,
//     leadTimeDays: 5,
//     supplier: "KidsWear Hub",
//     remarks: "Weekly refill",
//   },
//   {
//     id: 3,
//     division: "House Hold Appliences",
//     section: "Utensils",
//     department: "Kadai",
//     sku: "HHA-UT-099",
//     barcode: "8901234000005",
//     product: "Steel Kadai 2L",
//     warehouse: "Main - New Market",
//     currentStock: 84,
//     reorderLevel: 40,
//     reorderQty: 30,
//     leadTimeDays: 10,
//     supplier: "SteelMart",
//     remarks: "",
//   },
// ];

// /* ===================== HELPERS ===================== */

// const cn = (...c) => c.filter(Boolean).join(" ");
// const withAll = (arr) => ["All", ...(arr || [])];

// function computeStatus(current, level) {
//   const c = Number(current || 0);
//   const l = Number(level || 0);
//   if (!l) return "NA";
//   return c <= l ? "LOW" : "OK";
// }

// function todayYmd() {
//   const d = new Date();
//   const pad = (n) => String(n).padStart(2, "0");
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// }

// function parseNonNegativeNumberOrEmpty(v) {
//   if (v === "" || v === null || v === undefined) return "";
//   const n = Number(v);
//   if (!Number.isFinite(n)) return "";
//   return Math.max(0, n);
// }

// function clampToNumber(v) {
//   if (v === "" || v === null || v === undefined) return 0;
//   const n = Number(v);
//   if (!Number.isFinite(n)) return 0;
//   return Math.max(0, n);
// }

// /* ===================== COMPONENT ===================== */

// export default function InventoryReorderLevelSetup() {
//   // filters
//   const [division, setDivision] = useState("All");
//   const [section, setSection] = useState("All");
//   const [department, setDepartment] = useState("All");
//   const [warehouse, setWarehouse] = useState("All");
//   const [search, setSearch] = useState("");

//   // modal
//   const [open, setOpen] = useState(false);
//   const [editingId, setEditingId] = useState(null);

//   // rows
//   const [rows, setRows] = useState(() => DUMMY_REORDER_RULES);

//   // derived dropdowns
//   const sections = useMemo(() => {
//     if (!division || division === "All") return [];
//     return SECTION_MAP[division] || [];
//   }, [division]);

//   const departments = useMemo(() => {
//     if (!section || section === "All") return [];
//     return DEPARTMENT_MAP[section] || [];
//   }, [section]);

//   // filtered rows
//   const filtered = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     return rows.filter((r) => {
//       const m1 =
//         (division === "All" || r.division === division) &&
//         (section === "All" || r.section === section) &&
//         (department === "All" || r.department === department);

//       const m2 = warehouse === "All" || r.warehouse === warehouse;

//       const m3 =
//         !q ||
//         String(r.product || "").toLowerCase().includes(q) ||
//         String(r.sku || "").toLowerCase().includes(q) ||
//         String(r.barcode || "").toLowerCase().includes(q);

//       return m1 && m2 && m3;
//     });
//   }, [rows, division, section, department, warehouse, search]);

//   const lowOnly = useMemo(
//     () => filtered.filter((r) => computeStatus(r.currentStock, r.reorderLevel) === "LOW"),
//     [filtered]
//   );

//   function getEmptyForm() {
//     return {
//       division: "All",
//       section: "All",
//       department: "All",
//       sku: "",
//       barcode: "",
//       product: "",
//       warehouse: "Main - New Market",
//       currentStock: "",
//       reorderLevel: "",
//       reorderQty: "",
//       leadTimeDays: "",
//       supplier: "",
//       remarks: "",
//     };
//   }

//   // form
//   const [form, setForm] = useState(getEmptyForm());

//   const formSections = useMemo(() => {
//     if (!form.division || form.division === "All") return [];
//     return SECTION_MAP[form.division] || [];
//   }, [form.division]);

//   const formDepartments = useMemo(() => {
//     if (!form.section || form.section === "All") return [];
//     return DEPARTMENT_MAP[form.section] || [];
//   }, [form.section]);

//   const openCreate = () => {
//     setEditingId(null);
//     setForm(getEmptyForm());
//     setOpen(true);
//   };

//   const openEdit = (r) => {
//     setEditingId(r.id);
//     setForm({
//       division: r.division,
//       section: r.section,
//       department: r.department,
//       sku: r.sku || "",
//       barcode: r.barcode || "",
//       product: r.product || "",
//       warehouse: r.warehouse || "Main - New Market",
//       currentStock: String(r.currentStock ?? ""),
//       reorderLevel: String(r.reorderLevel ?? ""),
//       reorderQty: String(r.reorderQty ?? ""),
//       leadTimeDays: String(r.leadTimeDays ?? ""),
//       supplier: r.supplier || "",
//       remarks: r.remarks || "",
//     });
//     setOpen(true);
//   };

//   const close = () => setOpen(false);

//   // ESC close + body scroll lock (safe)
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

//   const save = () => {
//     const payload = {
//       ...form,
//       currentStock: clampToNumber(form.currentStock),
//       reorderLevel: clampToNumber(form.reorderLevel),
//       reorderQty: clampToNumber(form.reorderQty),
//       leadTimeDays: clampToNumber(form.leadTimeDays),
//     };

//     if (!payload.sku.trim() || !payload.product.trim()) {
//       alert("SKU and Product are required.");
//       return;
//     }
//     if (payload.division === "All" || payload.section === "All" || payload.department === "All") {
//       alert("Please select Division, Section, Department (not All).");
//       return;
//     }

//     if (editingId) {
//       setRows((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...payload } : r)));
//     } else {
//       const newId = Math.max(0, ...rows.map((x) => x.id)) + 1;
//       setRows((prev) => [...prev, { id: newId, ...payload }]);
//     }

//     setOpen(false);
//   };

//   const removeRow = (id) => {
//     if (!window.confirm("Delete this reorder rule?")) return;
//     setRows((prev) => prev.filter((r) => r.id !== id));
//   };

//   const exportPdf = () => {
//     const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

//     const title = "Reorder Level Setup";
//     const createdOn = todayYmd();

//     doc.setFont("helvetica", "bold");
//     doc.setFontSize(16);
//     doc.text(title, 40, 40);

//     doc.setFont("helvetica", "normal");
//     doc.setFontSize(10);
//     doc.text(`Generated: ${createdOn}`, 40, 58);

//     const head = [
//       [
//         "SKU",
//         "Barcode",
//         "Product",
//         "Division",
//         "Section",
//         "Department",
//         "Warehouse",
//         "Current",
//         "Reorder Level",
//         "Reorder Qty",
//         "Lead Time",
//         "Supplier",
//         "Status",
//         "Remarks",
//       ],
//     ];

//     const body = filtered.map((r) => [
//       r.sku,
//       r.barcode,
//       r.product,
//       r.division,
//       r.section,
//       r.department,
//       r.warehouse,
//       String(r.currentStock ?? 0),
//       String(r.reorderLevel ?? 0),
//       String(r.reorderQty ?? 0),
//       String(r.leadTimeDays ?? 0),
//       r.supplier || "",
//       computeStatus(r.currentStock, r.reorderLevel),
//       r.remarks || "",
//     ]);

//     autoTable(doc, {
//       head,
//       body,
//       startY: 80,
//       styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
//       headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42] },
//       alternateRowStyles: { fillColor: [248, 250, 252] },
//       margin: { left: 40, right: 40 },
//     });

//     doc.save(`reorder-level-setup-${createdOn}.pdf`);
//   };

//   return (
//     // ✅ KEY FIX: remove overflow-hidden + responsive padding
//     <div className="min-h-full w-full px-3 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">
//       {/* Header (responsive) */}
//       <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
//         <div className="flex items-center gap-3">
//           <FaWarehouse className="text-indigo-600 text-2xl shrink-0" />
//           <div className="min-w-0">
//             <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
//               Reorder Level Setup
//             </h1>
//           </div>
//         </div>

//         {/* Buttons stack on mobile */}
//         <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
//           <button
//             type="button"
//             onClick={exportPdf}
//             className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-[0.99]"
//             title="Export to PDF"
//           >
//             <FaFilePdf />
//             Export PDF
//           </button>

//           <button
//             type="button"
//             onClick={openCreate}
//             className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.99]"
//           >
//             <FaPlus />
//             Add Reorder Rule
//           </button>
//         </div>
//       </div>

//       {/* Filters (responsive grid) */}
//       <div className="bg-white rounded-2xl shadow-sm p-3 sm:p-4 shrink-0 border border-blue-500">
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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

//           <div className="min-w-0 sm:col-span-2 lg:col-span-1">
//             <label className="text-sm font-semibold text-slate-800">Search</label>
//             <div className="flex items-center gap-2 mt-1 bg-slate-100 rounded-xl px-3 border border-blue-400">
//               <FaSearch className="text-slate-400 shrink-0" />
//               <input
//                 type="text"
//                 placeholder="SKU / Barcode / Product"
//                 className="bg-transparent outline-none py-2 w-full text-sm min-w-0"
//                 value={search}
//                 onChange={(e) => setSearch(e.target.value)}
//               />
//             </div>
//           </div>
//         </div>

//         <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
//           <span>
//             Showing <span className="font-semibold text-slate-900">{filtered.length}</span> rules
//           </span>
//           <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
//             Low stock now: <span className="font-semibold">{lowOnly.length}</span>
//           </span>
//         </div>
//       </div>

//       {/* Table (✅ phone horizontal swipe + vertical scroll) */}
//       <div className="bg-white rounded-2xl shadow-sm flex-1 min-h-0 overflow-hidden border border-blue-500">
//         <div className="h-full overflow-auto">
//           <table className="w-full text-sm min-w-[1280px]">
//             <thead className="sticky top-0 z-10 bg-slate-200 text-slate-900 border-b border-blue-400">
//               <tr>
//                 <th className="p-3 text-left whitespace-nowrap">SKU</th>
//                 <th className="p-3 text-left whitespace-nowrap">Barcode</th>
//                 <th className="p-3 text-left whitespace-nowrap">Product</th>
//                 <th className="p-3 text-left whitespace-nowrap">Division</th>
//                 <th className="p-3 text-left whitespace-nowrap">Section</th>
//                 <th className="p-3 text-left whitespace-nowrap">Department</th>
//                 <th className="p-3 text-left whitespace-nowrap">Warehouse</th>
//                 <th className="p-3 text-right whitespace-nowrap">Current</th>
//                 <th className="p-3 text-right whitespace-nowrap">Reorder Level</th>
//                 <th className="p-3 text-right whitespace-nowrap">Reorder Qty</th>
//                 <th className="p-3 text-right whitespace-nowrap">Lead (Days)</th>
//                 <th className="p-3 text-left whitespace-nowrap">Supplier</th>
//                 <th className="p-3 text-left whitespace-nowrap">Status</th>
//                 <th className="p-3 text-left whitespace-nowrap">Remarks</th>
//                 <th className="p-3 text-right whitespace-nowrap">Action</th>
//               </tr>
//             </thead>

//             <tbody>
//               {filtered.length === 0 ? (
//                 <tr>
//                   <td colSpan={15} className="p-8 text-center text-slate-500">
//                     No rules found
//                   </td>
//                 </tr>
//               ) : (
//                 filtered.map((r) => {
//                   const status = computeStatus(r.currentStock, r.reorderLevel);
//                   return (
//                     <tr key={r.id} className="hover:bg-slate-50 border-b border-blue-100">
//                       <td className="p-3 font-semibold whitespace-nowrap">{r.sku}</td>
//                       <td className="p-3 whitespace-nowrap">{r.barcode}</td>
//                       <td className="p-3 min-w-[260px]">{r.product}</td>
//                       <td className="p-3 whitespace-nowrap">{r.division}</td>
//                       <td className="p-3 whitespace-nowrap">{r.section}</td>
//                       <td className="p-3 whitespace-nowrap">{r.department}</td>
//                       <td className="p-3 whitespace-nowrap">{r.warehouse}</td>

//                       <td className="p-3 text-right font-semibold whitespace-nowrap">{r.currentStock}</td>
//                       <td className="p-3 text-right font-semibold whitespace-nowrap">{r.reorderLevel}</td>
//                       <td className="p-3 text-right font-semibold whitespace-nowrap">{r.reorderQty}</td>
//                       <td className="p-3 text-right whitespace-nowrap">{r.leadTimeDays}</td>

//                       <td className="p-3 whitespace-nowrap">{r.supplier}</td>

//                       <td className="p-3 whitespace-nowrap">
//                         <span
//                           className={cn(
//                             "inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold border",
//                             status === "LOW"
//                               ? "bg-rose-50 text-rose-700 border-rose-200"
//                               : status === "OK"
//                               ? "bg-emerald-50 text-emerald-700 border-emerald-200"
//                               : "bg-slate-100 text-slate-600 border-slate-200"
//                           )}
//                         >
//                           {status}
//                         </span>
//                       </td>

//                       <td className="p-3 min-w-[220px]">{r.remarks}</td>

//                       <td className="p-3 text-right whitespace-nowrap">
//                         <button
//                           type="button"
//                           onClick={() => openEdit(r)}
//                           className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
//                         >
//                           Edit
//                         </button>
//                         <button
//                           type="button"
//                           onClick={() => removeRow(r.id)}
//                           className="ml-2 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
//                           title="Delete"
//                         >
//                           <FaTrash className="inline -mt-[2px]" />
//                         </button>
//                       </td>
//                     </tr>
//                   );
//                 })
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {/* ===================== FULL PAGE MODAL ===================== */}
//       {open && (
//         <ModalShell onClose={close} title={editingId ? "Edit Reorder Rule" : "Add Reorder Rule"}>
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//             <FilterSelect
//               label="Division"
//               icon={<FaLayerGroup className="text-slate-600" />}
//               value={form.division}
//               onChange={(v) =>
//                 setForm((s) => ({ ...s, division: v, section: "All", department: "All" }))
//               }
//               options={withAll(DIVISIONS)}
//             />

//             <FilterSelect
//               label="Section"
//               icon={<FaFilter className="text-slate-600" />}
//               value={form.section}
//               onChange={(v) => setForm((s) => ({ ...s, section: v, department: "All" }))}
//               options={withAll(formSections)}
//               disabled={form.division === "All"}
//             />

//             <FilterSelect
//               label="Department"
//               icon={<FaBuilding className="text-slate-600" />}
//               value={form.department}
//               onChange={(v) => setForm((s) => ({ ...s, department: v }))}
//               options={withAll(formDepartments)}
//               disabled={form.section === "All"}
//             />

//             <Input label="SKU" value={form.sku} onChange={(v) => setForm((s) => ({ ...s, sku: v }))} />
//             <Input
//               label="Barcode"
//               value={form.barcode}
//               onChange={(v) => setForm((s) => ({ ...s, barcode: v }))}
//             />
//             <Input
//               label="Product"
//               value={form.product}
//               onChange={(v) => setForm((s) => ({ ...s, product: v }))}
//             />

//             <FilterSelect
//               label="Warehouse"
//               icon={<FaWarehouse className="text-slate-600" />}
//               value={form.warehouse}
//               onChange={(v) => setForm((s) => ({ ...s, warehouse: v }))}
//               options={WAREHOUSES.filter((x) => x !== "All")}
//             />

//             <NumberInput
//               label="Current Stock"
//               value={form.currentStock}
//               onChange={(v) => setForm((s) => ({ ...s, currentStock: parseNonNegativeNumberOrEmpty(v) }))}
//             />
//             <NumberInput
//               label="Reorder Level"
//               value={form.reorderLevel}
//               onChange={(v) => setForm((s) => ({ ...s, reorderLevel: parseNonNegativeNumberOrEmpty(v) }))}
//             />
//             <NumberInput
//               label="Reorder Qty"
//               value={form.reorderQty}
//               onChange={(v) => setForm((s) => ({ ...s, reorderQty: parseNonNegativeNumberOrEmpty(v) }))}
//             />
//             <NumberInput
//               label="Lead Time (Days)"
//               value={form.leadTimeDays}
//               onChange={(v) => setForm((s) => ({ ...s, leadTimeDays: parseNonNegativeNumberOrEmpty(v) }))}
//             />

//             <Input
//               label="Supplier"
//               value={form.supplier}
//               onChange={(v) => setForm((s) => ({ ...s, supplier: v }))}
//             />

//             <div className="sm:col-span-2 lg:col-span-3">
//               <label className="text-sm font-semibold text-slate-800">Remarks</label>
//               <textarea
//                 className="mt-1 w-full bg-slate-100 rounded-2xl px-3 py-2 outline-none text-sm min-h-[90px] border border-blue-400"
//                 value={form.remarks}
//                 onChange={(e) => setForm((s) => ({ ...s, remarks: e.target.value }))}
//                 placeholder="Notes (optional)"
//               />
//             </div>
//           </div>

//           <div className="w-full flex items-center justify-end mt-4">
//             <button
//               type="button"
//               onClick={save}
//               className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.99]"
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

// /* ===================== UI HELPERS ===================== */

// function FilterSelect({ label, icon, value, onChange, options, disabled }) {
//   return (
//     <div className="min-w-0">
//       <label className="text-sm font-semibold text-slate-800">{label}</label>
//       <div
//         className={cn(
//           "flex items-center gap-2 mt-1 rounded-xl px-3 border",
//           disabled ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-slate-100 border-blue-400"
//         )}
//       >
//         {icon}
//         <select
//           className="bg-transparent outline-none py-2 w-full text-sm min-w-0"
//           value={value}
//           onChange={(e) => onChange(e.target.value)}
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

// function Input({ label, value, onChange, placeholder = "" }) {
//   return (
//     <div className="min-w-0">
//       <label className="text-sm font-semibold text-slate-800">{label}</label>
//       <input
//         className="mt-1 w-full bg-slate-100 rounded-xl px-3 py-2 outline-none text-sm border border-blue-400"
//         value={value}
//         onChange={(e) => onChange(e.target.value)}
//         placeholder={placeholder}
//       />
//     </div>
//   );
// }

// function NumberInput({ label, value, onChange }) {
//   return (
//     <div className="min-w-0">
//       <label className="text-sm font-semibold text-slate-800">{label}</label>
//       <input
//         inputMode="numeric"
//         pattern="[0-9]*"
//         className="mt-1 w-full bg-slate-100 rounded-xl px-3 py-2 outline-none text-sm border border-blue-400"
//         value={value}
//         onKeyDown={(e) => {
//           if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") e.preventDefault();
//         }}
//         onChange={(e) => onChange(e.target.value)}
//         placeholder="(blank)"
//       />
//     </div>
//   );
// }

// /**
//  * ✅ FULL PAGE MODAL
//  * - full viewport
//  * - sticky header
//  * - scrollable body
//  * - mobile safe-area padding
//  */
// function ModalShell({ children, onClose, title }) {
//   return (
//     <div className="fixed inset-0 z-[999]">
//       {/* backdrop */}
//       <div className="absolute inset-0 bg-black/40" onClick={onClose} />

//       {/* panel */}
//       <div className="absolute inset-0 bg-white flex flex-col ring-2 ring-blue-500">
//         {/* Header */}
//         <div
//           className="sticky top-0 z-10 border-b border-blue-200 bg-white px-4 sm:px-5 py-4 flex items-start sm:items-center justify-between gap-3"
//           style={{
//             paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
//           }}
//         >
//           <div className="min-w-0">
//             <h2 className="text-lg font-bold text-slate-900 truncate">{title}</h2>
//             <p className="text-sm text-slate-500">Fill details then click Save.</p>
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

//         {/* Body (scrollable) */}
//         <div
//           className="flex-1 overflow-y-auto px-3 sm:px-5 py-4"
//           style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
//         >
//           <div className="max-w-6xl mx-auto border border-blue-300 rounded-2xl p-3 sm:p-4">
//             {children}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }


import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  FaWarehouse, FaLayerGroup, FaFilter, FaBuilding,
  FaSearch, FaPlus, FaSave, FaTrash, FaFilePdf,
  FaTimes, FaSyncAlt,
} from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE = `${APP_API_URL}`;

/* ─── Helpers ─── */
const cn = (...c) => c.filter(Boolean).join(" ");

function todayYmd() {
  const d = new Date(), pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clamp(v) {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function emptyForm() {
  return {
    division: "", section: "", department: "",
    sku: "", barcode: "", product: "",
    warehouse: "",
    reorder_level: "", reorder_qty: "", lead_time_days: "",
    supplier: "", remarks: "",
  };
}

/* ─── Status badge ─── */
function StatusBadge({ status }) {
  const cfg = {
    LOW: { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", label: "LOW" },
    OK:  { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0", label: "OK"  },
    NA:  { bg: "#F1F5F9", color: "#475569", border: "#E2E8F0", label: "N/A" },
  }[status] || { bg: "#F1F5F9", color: "#475569", border: "#E2E8F0", label: status };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>{cfg.label}</span>
  );
}

/* ─── Main Component ─── */
export default function ReorderLevelSetup() {
  /* Filter state */
  const [division,   setDivision]   = useState("");
  const [section,    setSection]    = useState("");
  const [department, setDepartment] = useState("");
  const [warehouse,  setWarehouse]  = useState("All");
  const [search,     setSearch]     = useState("");
  const [lowOnly,    setLowOnly]    = useState(false);

  /* Cascade mapping from product-mapping API */
  const [mapping,    setMapping]    = useState({});
  const [warehouses, setWarehouses] = useState(["All"]);

  /* Data */
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  /* Modal */
  const [open,      setOpen]      = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form,      setForm]      = useState(emptyForm());
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState("");

  /* Cascade from mapping */
  const divisions   = useMemo(() => Object.keys(mapping).sort(), [mapping]);
  const sections    = useMemo(() =>
    division && mapping[division] ? Object.keys(mapping[division]).sort() : [],
    [division, mapping]);
  const departments = useMemo(() =>
    division && section && mapping[division]?.[section]
      ? [...mapping[division][section]].sort() : [],
    [division, section, mapping]);

  /* Form cascade */
  const formSections = useMemo(() =>
    form.division && mapping[form.division]
      ? Object.keys(mapping[form.division]).sort() : [],
    [form.division, mapping]);
  const formDepartments = useMemo(() =>
    form.division && form.section && mapping[form.division]?.[form.section]
      ? [...mapping[form.division][form.section]].sort() : [],
    [form.division, form.section, mapping]);

  /* Load mapping */
  useEffect(() => {
    fetch(`${API_BASE}/api/product-mapping/grouped`)
      .then(r => r.json())
      .then(d => setMapping(d.data || {}))
      .catch(() => {});
  }, []);

  /* Fetch rules */
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (division   && division   !== "All") params.append("division",   division);
      if (section    && section    !== "All") params.append("section",    section);
      if (department && department !== "All") params.append("department", department);
      if (warehouse  && warehouse  !== "All") params.append("warehouse",  warehouse);
      if (search.trim())                      params.append("search",     search.trim());
      if (lowOnly)                            params.append("low_only",   "true");

      const res  = await fetch(`${API_BASE}/inventory/reorder-rules?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load rules");
      const json = await res.json();
      const data = json.data || [];
      setRows(data);

      const whs = ["All", ...new Set(data.map(r => r.warehouse).filter(Boolean))].sort();
      setWarehouses(whs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false); }
  }, [division, section, department, warehouse, search, lowOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Modal helpers */
  const openCreate = () => {
    setEditingId(null); setForm(emptyForm()); setFormError(""); setOpen(true);
  };
  const openEdit = (r) => {
    setEditingId(r.id);
    setForm({
      division: r.division || "", section: r.section || "", department: r.department || "",
      sku: r.sku || "", barcode: r.barcode || "", product: r.product || "",
      warehouse: r.warehouse || "",
      reorder_level: String(r.reorder_level ?? ""),
      reorder_qty:   String(r.reorder_qty   ?? ""),
      lead_time_days:String(r.lead_time_days ?? ""),
      supplier: r.supplier || "", remarks: r.remarks || "",
    });
    setFormError(""); setOpen(true);
  };
  const closeModal = () => setOpen(false);

  /* ESC + scroll lock */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") closeModal(); };
    window.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", handler); document.body.style.overflow = prev; };
  }, [open]);

  /* Save */
  const handleSave = async () => {
    if (!form.barcode.trim() && !form.sku.trim()) {
      setFormError("Barcode or SKU is required."); return;
    }
    if (!form.product.trim()) {
      setFormError("Product name is required."); return;
    }
    setSaving(true); setFormError("");
    try {
      const payload = {
        ...form,
        reorder_level:  clamp(form.reorder_level),
        reorder_qty:    clamp(form.reorder_qty),
        lead_time_days: clamp(form.lead_time_days),
      };

      const url    = editingId
        ? `${API_BASE}/inventory/reorder-rules/${editingId}`
        : `${API_BASE}/inventory/reorder-rules`;
      const method = editingId ? "PUT" : "POST";

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      closeModal();
      fetchData();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  /* Delete */
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this reorder rule?")) return;
    try {
      const res = await fetch(`${API_BASE}/inventory/reorder-rules/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Delete failed"); }
      fetchData();
    } catch (e) {
      alert(`❌ ${e.message}`);
    }
  };

  /* Counts */
  const lowCount = useMemo(() => rows.filter(r => r.status === "LOW").length, [rows]);

  /* PDF export */
  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("Reorder Level Setup", 40, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`Generated: ${todayYmd()}`, 40, 58);

    autoTable(doc, {
      head: [["SKU","Barcode","Product","Division","Section","Department","Warehouse","Current","Reorder Lvl","Reorder Qty","Lead Days","Supplier","Status","Remarks"]],
      body: rows.map(r => [
        r.sku, r.barcode, r.product, r.division, r.section, r.department,
        r.warehouse, String(r.current_stock ?? 0), String(r.reorder_level ?? 0),
        String(r.reorder_qty ?? 0), String(r.lead_time_days ?? 0),
        r.supplier || "", r.status, r.remarks || "",
      ]),
      startY: 76,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 40, right: 40 },
    });
    doc.save(`reorder-levels-${todayYmd()}.pdf`);
  };

  return (
    <div className="min-h-full w-full px-3 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <FaWarehouse className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Reorder Level Setup</h1>
            <p className="text-xs text-slate-500">{rows.length} rules · {lowCount} low stock alerts</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={fetchData} disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm font-medium disabled:opacity-50">
            <FaSyncAlt className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={exportPdf}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
            <FaFilePdf /> Export PDF
          </button>
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
            <FaPlus /> Add Rule
          </button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl shadow-sm p-3 sm:p-4 shrink-0 border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">

          <FS label="Division" icon={<FaLayerGroup className="text-slate-500 text-xs" />}
            value={division} onChange={v => { setDivision(v); setSection(""); setDepartment(""); }}
            options={["", ...divisions]} placeholder="All Divisions" />

          <FS label="Section" icon={<FaFilter className="text-slate-500 text-xs" />}
            value={section} onChange={v => { setSection(v); setDepartment(""); }}
            options={["", ...sections]}
            placeholder={division ? (sections.length ? "All Sections" : "No sections") : "Select Division"}
            disabled={!division || sections.length === 0} />

          <FS label="Department" icon={<FaBuilding className="text-slate-500 text-xs" />}
            value={department} onChange={setDepartment}
            options={["", ...departments]}
            placeholder={section ? (departments.length ? "All Departments" : "No departments") : "Select Section"}
            disabled={!section || departments.length === 0} />

          <FS label="Warehouse" icon={<FaWarehouse className="text-slate-500 text-xs" />}
            value={warehouse} onChange={setWarehouse}
            options={warehouses} />

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Search</label>
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
              <FaSearch className="text-slate-400 shrink-0 text-xs" />
              <input type="text" placeholder="SKU / Barcode / Product"
                className="bg-transparent outline-none py-2 w-full text-sm"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch("")} className="text-slate-400 text-xs">✕</button>}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Showing <span className="font-semibold text-slate-900">{rows.length}</span> rules</span>
          <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
            Low stock: {lowCount}
          </span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)}
              className="rounded accent-rose-600" />
            <span className="text-slate-600">Show low stock only</span>
          </label>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl shadow-sm flex-1 min-h-0 overflow-hidden border border-slate-200">
        <div className="h-full overflow-auto">
          <table className="w-full text-sm min-w-[1400px]">
            <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                {[
                  { col: "SKU",          align: "left"  },
                  { col: "Barcode",      align: "left"  },
                  { col: "Product",      align: "left"  },
                  { col: "Division",     align: "left"  },
                  { col: "Section",      align: "left"  },
                  { col: "Department",   align: "left"  },
                  { col: "Warehouse",    align: "left"  },
                  { col: "Current",      align: "right" },
                  { col: "Reorder Lvl", align: "right" },
                  { col: "Reorder Qty", align: "right" },
                  { col: "Lead (Days)", align: "right" },
                  { col: "Supplier",     align: "left"  },
                  { col: "Status",       align: "left"  },
                  { col: "Remarks",      align: "left"  },
                  { col: "Actions",      align: "right" },
                ].map(({ col, align }) => (
                  <th key={col} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ textAlign: align }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={15} className="p-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <FaSyncAlt className="animate-spin text-xl text-indigo-400" />
                    <span className="text-sm">Loading rules…</span>
                  </div>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={15} className="p-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <FaWarehouse className="text-3xl opacity-30" />
                    <span className="text-sm">No reorder rules found</span>
                    <button onClick={openCreate} className="text-indigo-600 text-xs font-semibold hover:underline">
                      + Add your first rule
                    </button>
                  </div>
                </td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className={cn("hover:bg-slate-50 transition-colors", r.status === "LOW" && "bg-rose-50/30")}>
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-indigo-600 whitespace-nowrap">{r.sku || "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{r.barcode || "—"}</td>
                  <td className="px-3 py-3 font-medium text-slate-800 min-w-[200px] max-w-[260px]">{r.product}</td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{r.division  || "—"}</td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{r.section   || "—"}</td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{r.department|| "—"}</td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{r.warehouse || "—"}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums whitespace-nowrap"
                    style={{ color: r.status === "LOW" ? "#DC2626" : "#0F172A" }}>
                    {(r.current_stock ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700 whitespace-nowrap">{r.reorder_level ?? 0}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700 whitespace-nowrap">{r.reorder_qty   ?? 0}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-500 whitespace-nowrap">{r.lead_time_days ?? 0}</td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{r.supplier || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-3 text-xs text-slate-400 min-w-[160px]">{r.remarks || "—"}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button onClick={() => openEdit(r)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 active:scale-[0.98]">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(r.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 text-xs font-semibold hover:bg-rose-100 active:scale-[0.98]">
                        <FaTrash style={{ fontSize: 11 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal ── */}
      {open && (
        <div className="fixed inset-0 z-[999]">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="absolute inset-0 bg-white flex flex-col">

            {/* Modal header */}
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{editingId ? "Edit Reorder Rule" : "Add Reorder Rule"}</h2>
                <p className="text-xs text-slate-500 mt-0.5">Fill details then click Save</p>
              </div>
              <button onClick={closeModal} className="w-9 h-9 grid place-items-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600">
                <FaTimes />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
              <div className="max-w-5xl mx-auto border border-slate-200 rounded-2xl p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                  {/* Classification */}
                  <FS label="Division" icon={<FaLayerGroup className="text-slate-500 text-xs" />}
                    value={form.division}
                    onChange={v => setForm(s => ({ ...s, division: v, section: "", department: "" }))}
                    options={["", ...divisions]} placeholder="Select Division" />

                  <FS label="Section" icon={<FaFilter className="text-slate-500 text-xs" />}
                    value={form.section}
                    onChange={v => setForm(s => ({ ...s, section: v, department: "" }))}
                    options={["", ...formSections]}
                    placeholder={form.division ? "Select Section" : "Select Division first"}
                    disabled={!form.division || formSections.length === 0} />

                  <FS label="Department" icon={<FaBuilding className="text-slate-500 text-xs" />}
                    value={form.department}
                    onChange={v => setForm(s => ({ ...s, department: v }))}
                    options={["", ...formDepartments]}
                    placeholder={form.section ? "Select Department" : "Select Section first"}
                    disabled={!form.section || formDepartments.length === 0} />

                  {/* Product info */}
                  <FI label="SKU"      value={form.sku}      onChange={v => setForm(s => ({ ...s, sku: v }))}      placeholder="e.g. ACC-ST-001" />
                  <FI label="Barcode"  value={form.barcode}  onChange={v => setForm(s => ({ ...s, barcode: v }))}  placeholder="e.g. 8901234000001" />
                  <FI label="Product *" value={form.product} onChange={v => setForm(s => ({ ...s, product: v }))}  placeholder="Product name" />

                  {/* Warehouse */}
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Warehouse</label>
                    <input
                      value={form.warehouse}
                      onChange={e => setForm(s => ({ ...s, warehouse: e.target.value }))}
                      placeholder="e.g. Main - New Market"
                      className="w-full bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 outline-none text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  {/* Numeric fields */}
                  <NI label="Reorder Level"   value={form.reorder_level}  onChange={v => setForm(s => ({ ...s, reorder_level: v }))}  />
                  <NI label="Reorder Qty"     value={form.reorder_qty}    onChange={v => setForm(s => ({ ...s, reorder_qty: v }))}    />
                  <NI label="Lead Time (Days)"value={form.lead_time_days} onChange={v => setForm(s => ({ ...s, lead_time_days: v }))} />

                  {/* Supplier */}
                  <FI label="Supplier" value={form.supplier} onChange={v => setForm(s => ({ ...s, supplier: v }))} placeholder="Supplier name" />

                  {/* Remarks — full width */}
                  <div className="sm:col-span-2 lg:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Remarks</label>
                    <textarea
                      value={form.remarks}
                      onChange={e => setForm(s => ({ ...s, remarks: e.target.value }))}
                      rows={2} placeholder="Notes (optional)"
                      className="w-full bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 outline-none text-sm resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                {formError && (
                  <div className="mt-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{formError}</div>
                )}

                <div className="mt-6 flex justify-end">
                  <button onClick={handleSave} disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
                    <FaSave /> {saving ? "Saving…" : "Save Rule"}
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

/* ── Reusable filter select ── */
function FS({ label, icon, value, onChange, options, placeholder, disabled }) {
  return (
    <div className="min-w-0">
      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
      <div className={cn(
        "relative flex items-center gap-2 rounded-xl px-3 border transition-all",
        disabled
          ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
          : "bg-slate-50 border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100"
      )}>
        {icon}
        <select className="bg-transparent outline-none py-2 w-full text-sm min-w-0 appearance-none pr-4"
          value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
          {placeholder && <option value="">{placeholder}</option>}
          {(options || []).filter(o => o !== "").map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ── Text input ── */
function FI({ label, value, onChange, placeholder }) {
  return (
    <div className="min-w-0">
      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 outline-none text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
    </div>
  );
}

/* ── Number input ── */
function NI({ label, value, onChange }) {
  return (
    <div className="min-w-0">
      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
      <input
        inputMode="numeric" value={value}
        onKeyDown={e => { if (["-","e","E","+"].includes(e.key)) e.preventDefault(); }}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
        className="w-full bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 outline-none text-sm font-mono focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}