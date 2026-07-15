import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
// import React, { useEffect, useMemo, useState } from "react";
// import { FaFilePdf, FaBarcode, FaStore, FaLayerGroup } from "react-icons/fa";
// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";

// const cn = (...a) => a.filter(Boolean).join(" ");
// const num = (n) => {
//   const x = Number(n ?? 0);
//   return Number.isNaN(x) ? 0 : x;
// };

// const clamp = (v, min, max) => Math.min(max, Math.max(min, num(v)));
// const calcForecastQty = (avgSales, trendPct, seasonalityPct) => {
//   const avg = num(avgSales);
//   const t = num(trendPct);
//   const s = num(seasonalityPct);
//   return Math.round(avg * (1 + t / 100) * (s / 100));
// };

// const makeBarcode = (r) => {
//   const sku = String(r.sku || "").trim().toUpperCase();
//   const div = String(r.division || "")
//     .trim()
//     .toUpperCase()
//     .replace(/\s+/g, "-");
//   const sec = String(r.section || "")
//     .trim()
//     .toUpperCase()
//     .replace(/\s+/g, "-");
//   const dept = String(r.department || "")
//     .trim()
//     .toUpperCase()
//     .replace(/\s+/g, "-");
//   const dt = String(r.date || "").trim();

//   const base = sku || "NO-SKU";
//   return `BC-${base}-${div || "DIV"}-${sec || "SEC"}-${dept || "DEPT"}-${dt || "DATE"}`;
// };

// /* ------------------ Store Master ------------------ */
// const STORE_MASTER = ["Main - New Market", "Store - Chowringhee", "Store - Hatibagan"];

// /* ------------------ Helpers ------------------ */
// const uniqSorted = (arr) =>
//   Array.from(new Set(arr.map((x) => String(x || "").trim()).filter(Boolean))).sort((a, b) =>
//     a.localeCompare(b)
//   );

// const fmtISO = (v) => {
//   if (!v) return "";
//   const dt = new Date(v);
//   if (Number.isNaN(dt.getTime())) return "";
//   return dt.toISOString().slice(0, 10);
// };

// const isFoodDivision = (division) => {
//   const d = String(division || "").toLowerCase();
//   return d.includes("fmcg-food") || d.includes("food") || d.includes("grocery") || d.includes("snack");
// };

// const daysBetween = (aISO, bISO) => {
//   const A = new Date(aISO);
//   const B = new Date(bISO);
//   if (Number.isNaN(A.getTime()) || Number.isNaN(B.getTime())) return NaN;
//   return Math.floor((B.getTime() - A.getTime()) / (1000 * 60 * 60 * 24));
// };

// const getExpiryBadge = (division, expDate) => {
//   if (!isFoodDivision(division)) return { label: "N/A", tone: "muted" };

//   const exp = fmtISO(expDate);
//   if (!exp) return { label: "Missing", tone: "bad" };

//   const todayISO = new Date().toISOString().slice(0, 10);
//   const d = daysBetween(todayISO, exp);

//   if (!Number.isFinite(d)) return { label: "Invalid", tone: "bad" };
//   if (d < 0) return { label: "Expired", tone: "bad" };
//   if (d <= 30) return { label: `Near Expiry (${d}d)`, tone: "warn" };
//   return { label: `OK (${d}d)`, tone: "ok" };
// };

// /* ------------------ Dummy Data (includes store + food mfg/exp) ------------------ */
// const VIEW_ROWS = [
//   {
//     id: "r1",
//     store: "Main - New Market",
//     date: "2026-01-01",
//     sku: "SKU-10001",
//     division: "Mens",
//     section: "Casual Shirt",
//     department: "Apparel",
//     vendorName: "ABC Traders",
//     brand: "RAPHA",
//     size: "L",
//     currentStock: 44,
//     purchase: 20,
//     dailySales: 7,
//     avgSales: 120,
//     stockAlert: "OK",
//     mfgDate: "",
//     expDate: "",
//     trend: 8,
//     seasonality: 110,
//   },
//   {
//     id: "r2",
//     store: "Store - Hatibagan",
//     date: "2026-01-02",
//     sku: "SKU-10002",
//     division: "Ladies",
//     section: "Formal Shirt",
//     department: "Apparel",
//     vendorName: "Zen Suppliers",
//     brand: "LUNA",
//     size: "M",
//     currentStock: 18,
//     purchase: 40,
//     dailySales: 5,
//     avgSales: 80,
//     stockAlert: "LOW",
//     mfgDate: "",
//     expDate: "",
//     trend: 5,
//     seasonality: 95,
//   },
//   {
//     id: "r3",
//     store: "Main - New Market",
//     date: "2026-01-05",
//     sku: "SKU-20011",
//     division: "Fmcg-Food",
//     section: "FMCG Snacks",
//     department: "Food",
//     vendorName: "SnackHub",
//     brand: "Crunchy",
//     size: "200g",
//     currentStock: 90,
//     purchase: 60,
//     dailySales: 18,
//     avgSales: 220,
//     stockAlert: "OK",
//     // ✅ usable dates for food
//     mfgDate: "2026-01-01",
//     expDate: "2026-07-01",
//     trend: 12,
//     seasonality: 130,
//   },
//   {
//     id: "r4",
//     store: "Store - Chowringhee",
//     date: "2026-01-09",
//     sku: "SKU-90111",
//     division: "Accessories",
//     section: "Perfume",
//     department: "Beauty",
//     vendorName: "Aroma Co",
//     brand: "MIST",
//     size: "50ml",
//     currentStock: 8,
//     purchase: 25,
//     dailySales: 2,
//     avgSales: 60,
//     stockAlert: "CRITICAL",
//     mfgDate: "",
//     expDate: "",
//     trend: 3,
//     seasonality: 160,
//   },
//   {
//     id: "r5",
//     store: "Store - Chowringhee",
//     date: "2026-01-15",
//     sku: "SKU-77721",
//     division: "Kids",
//     section: "Kids Boy",
//     department: "Apparel",
//     vendorName: "TinyWear",
//     brand: "KIDZ",
//     size: "6Y",
//     currentStock: 30,
//     purchase: 15,
//     dailySales: 4,
//     avgSales: 95,
//     stockAlert: "OK",
//     mfgDate: "",
//     expDate: "",
//     trend: 6,
//     seasonality: 100,
//   },
//   // extra food rows for better demo
//   {
//     id: "r6",
//     store: "Store - Hatibagan",
//     date: "2026-01-12",
//     sku: "SKU-20055",
//     division: "Fmcg-Food",
//     section: "Ready To Eat Biscuits",
//     department: "Biscuits",
//     vendorName: "Biscuit World",
//     brand: "BITE",
//     size: "300g",
//     currentStock: 22,
//     purchase: 40,
//     dailySales: 6,
//     avgSales: 140,
//     stockAlert: "LOW",
//     mfgDate: "2025-12-15",
//     expDate: "2026-03-15",
//     trend: 10,
//     seasonality: 120,
//   },
//   {
//     id: "r7",
//     store: "Main - New Market",
//     date: "2026-01-18",
//     sku: "SKU-20101",
//     division: "Fmcg-Food",
//     section: "Staples - Flour",
//     department: "Atta",
//     vendorName: "GrainMart",
//     brand: "SHUDH",
//     size: "5kg",
//     currentStock: 70,
//     purchase: 55,
//     dailySales: 9,
//     avgSales: 200,
//     stockAlert: "OK",
//     mfgDate: "2025-11-01",
//     expDate: "2026-11-01",
//     trend: 6,
//     seasonality: 105,
//   },
// ];

// const FilterSelect = ({ label, value, onChange, options, icon }) => {
//   return (
//     <div className="rounded-xl border border-[#186fda] bg-white p-3">
//       <div className="flex items-center gap-2 mb-2">
//         <span className="text-[#186fda]">{icon}</span>
//         <p className="text-xs font-bold text-slate-800">{label}</p>
//       </div>

//       <select
//         value={value}
//         onChange={(e) => onChange(e.target.value)}
//         className="w-full rounded-lg border border-[#186fda] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
//       >
//         <option value="All">All</option>
//         {options.map((o) => (
//           <option key={o} value={o}>
//             {o}
//           </option>
//         ))}
//       </select>

//       {value !== "All" && (
//         <p className="mt-2 text-[11px] text-slate-500">
//           Filter active: <span className="font-semibold">{value}</span>
//         </p>
//       )}
//     </div>
//   );
// };

// export default function StockPlanForecastingDemandForecastSheet() {
//   const [fromDate, setFromDate] = useState("");
//   const [toDate, setToDate] = useState("");
//   const [error, setError] = useState("");

//   const [storeFilter, setStoreFilter] = useState("All");
//   const [divisionFilter, setDivisionFilter] = useState("All");
//   const [sectionFilter, setSectionFilter] = useState("All");
//   const [departmentFilter, setDepartmentFilter] = useState("All");

//   const dateValid = useMemo(() => {
//     if (!fromDate || !toDate) return false;
//     return new Date(fromDate).getTime() <= new Date(toDate).getTime();
//   }, [fromDate, toDate]);

//   useEffect(() => {
//     if (!fromDate || !toDate) {
//       setError("From Date and To Date are required.");
//       return;
//     }
//     if (!dateValid) {
//       setError("From Date cannot be after To Date.");
//       return;
//     }
//     setError("");
//   }, [fromDate, toDate, dateValid]);

//   /* ✅ Date range filter first */
//   const dateRows = useMemo(() => {
//     if (!fromDate || !toDate) return [];

//     const from = new Date(fromDate);
//     from.setHours(0, 0, 0, 0);

//     const to = new Date(toDate);
//     to.setHours(23, 59, 59, 999);

//     return VIEW_ROWS.filter((r) => {
//       if (!r.date) return false;
//       const d = new Date(r.date);
//       if (Number.isNaN(d.getTime())) return false;
//       return d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
//     });
//   }, [fromDate, toDate]);

//   /* ✅ Dropdown options (cascading) */
//   const storeOptions = useMemo(() => STORE_MASTER, []);

//   const divisionOptions = useMemo(() => {
//     const base = storeFilter === "All" ? dateRows : dateRows.filter((r) => r.store === storeFilter);
//     return uniqSorted(base.map((r) => r.division));
//   }, [dateRows, storeFilter]);

//   const sectionOptions = useMemo(() => {
//     let base = dateRows;
//     if (storeFilter !== "All") base = base.filter((r) => r.store === storeFilter);
//     if (divisionFilter !== "All") base = base.filter((r) => r.division === divisionFilter);
//     return uniqSorted(base.map((r) => r.section));
//   }, [dateRows, storeFilter, divisionFilter]);

//   const departmentOptions = useMemo(() => {
//     let base = dateRows;
//     if (storeFilter !== "All") base = base.filter((r) => r.store === storeFilter);
//     if (divisionFilter !== "All") base = base.filter((r) => r.division === divisionFilter);
//     if (sectionFilter !== "All") base = base.filter((r) => r.section === sectionFilter);
//     return uniqSorted(base.map((r) => r.department));
//   }, [dateRows, storeFilter, divisionFilter, sectionFilter]);

//   /* ✅ Final filtered rows */
//   const filteredRows = useMemo(() => {
//     let rows = dateRows;
//     if (storeFilter !== "All") rows = rows.filter((r) => r.store === storeFilter);
//     if (divisionFilter !== "All") rows = rows.filter((r) => r.division === divisionFilter);
//     if (sectionFilter !== "All") rows = rows.filter((r) => r.section === sectionFilter);
//     if (departmentFilter !== "All") rows = rows.filter((r) => r.department === departmentFilter);
//     return rows;
//   }, [dateRows, storeFilter, divisionFilter, sectionFilter, departmentFilter]);

//   /* ✅ Cascading safety */
//   useEffect(() => {
//     if (divisionFilter !== "All" && !divisionOptions.includes(divisionFilter)) {
//       setDivisionFilter("All");
//       setSectionFilter("All");
//       setDepartmentFilter("All");
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [divisionOptions.join("|")]);

//   useEffect(() => {
//     if (sectionFilter !== "All" && !sectionOptions.includes(sectionFilter)) {
//       setSectionFilter("All");
//       setDepartmentFilter("All");
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [sectionOptions.join("|")]);

//   useEffect(() => {
//     if (departmentFilter !== "All" && !departmentOptions.includes(departmentFilter)) {
//       setDepartmentFilter("All");
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [departmentOptions.join("|")]);

//   const totals = useMemo(() => {
//     const totalForecast = filteredRows.reduce((s, r) => {
//       const trendSafe = clamp(r.trend, 0, 50);
//       const seasonSafe = clamp(r.seasonality, 50, 200);
//       const fq = calcForecastQty(r.avgSales, trendSafe, seasonSafe);
//       return s + num(fq);
//     }, 0);

//     const filledSkus = filteredRows.filter((r) => String(r.sku || "").trim()).length;
//     return { totalForecast, filledSkus, rowsVisible: filteredRows.length };
//   }, [filteredRows]);

//   const canGenerate = dateValid && filteredRows.length > 0;

//   /* ------------------ style tokens ------------------ */
//   const BRAND_BORDER = "border-[#186fda]";
//   const HEADER_BG = "bg-white/70";
//   const CARD_BG_STRONG = "bg-white/85";
//   const CARD_BG_SOFT = "bg-white/80";

//   const inputCls =
//     "w-full rounded-lg border border-[#186fda] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-300";

//   const boxCls = "rounded-lg border border-[#D6DEE8] bg-slate-50 px-3 py-2 text-slate-900";
//   const monoBoxCls =
//     "rounded-lg border border-[#D6DEE8] bg-slate-50 px-3 py-2 font-mono text-[12px] text-slate-800";

//   const generatePDF = () => {
//     if (!canGenerate) return;

//     const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
//     const pageWidth = doc.internal.pageSize.getWidth();

//     doc.setFont("helvetica", "bold");
//     doc.setFontSize(14);
//     doc.text("Demand Forecast Sheet (View Only)", pageWidth / 2, 34, { align: "center" });

//     doc.setFont("helvetica", "normal");
//     doc.setFontSize(10);

//     const filterLine = [
//       `From: ${fromDate}`,
//       `To: ${toDate}`,
//       `Store: ${storeFilter}`,
//       `Division: ${divisionFilter}`,
//       `Section: ${sectionFilter}`,
//       `Department: ${departmentFilter}`,
//     ].join("   |   ");

//     doc.text(filterLine, 40, 56);

//     doc.text(
//       `Rows Visible: ${totals.rowsVisible}   Filled SKU: ${totals.filledSkus}   Total Forecast Qty: ${totals.totalForecast}`,
//       40,
//       72
//     );

//     const head = [
//       [
//         "SL NO",
//         "DATE",
//         "STORE",
//         "BARCODE",
//         "SKU",
//         "Division",
//         "Section",
//         "Department",
//         "Vendor Name",
//         "Brand",
//         "Size",
//         "Current Stock",
//         "Purchase",
//         "Daily Sales",
//         "Avg Sales",
//         "Stock Alert",
//         "MFG",
//         "EXP",
//         "Expiry Status",
//         "Trend (%)",
//         "Seasonality (%)",
//         "Forecast Qty",
//       ],
//     ];

//     const body = filteredRows.map((r, idx) => {
//       const trendSafe = clamp(r.trend, 0, 50);
//       const seasonSafe = clamp(r.seasonality, 50, 200);
//       const forecastQty = calcForecastQty(r.avgSales, trendSafe, seasonSafe);

//       const isFood = isFoodDivision(r.division);
//       const mfg = isFood ? fmtISO(r.mfgDate) : "N/A";
//       const exp = isFood ? fmtISO(r.expDate) : "N/A";
//       const expBadge = isFood ? getExpiryBadge(r.division, r.expDate).label : "N/A";

//       return [
//         String(idx + 1),
//         r.date || "",
//         r.store || "",
//         makeBarcode(r),
//         r.sku || "",
//         r.division || "",
//         r.section || "",
//         r.department || "",
//         r.vendorName || "",
//         r.brand || "",
//         r.size || "",
//         String(r.currentStock ?? ""),
//         String(r.purchase ?? ""),
//         String(r.dailySales ?? ""),
//         String(r.avgSales ?? ""),
//         String(r.stockAlert ?? ""),
//         mfg || "—",
//         exp || "—",
//         expBadge || "—",
//         String(trendSafe),
//         String(seasonSafe),
//         String(forecastQty),
//       ];
//     });

//     autoTable(doc, {
//       head,
//       body,
//       startY: 90,
//       styles: {
//         font: "helvetica",
//         fontSize: 7.8,
//         cellPadding: 5,
//         lineColor: [24, 111, 218],
//         lineWidth: 0.5,
//       },
//       headStyles: {
//         fillColor: [248, 250, 252],
//         textColor: [15, 23, 42],
//         lineColor: [24, 111, 218],
//         lineWidth: 0.8,
//       },
//       alternateRowStyles: { fillColor: [255, 255, 255] },
//       margin: { left: 22, right: 22 },
//     });

//     doc.save(`Demand_Forecast_ViewOnly_${fromDate}_to_${toDate}.pdf`);
//   };

//   return (
//     <div className="p-4 sm:p-6">
//       {/* Main Card */}
//       <div
//         className={cn(
//           "rounded-2xl border",
//           BRAND_BORDER,
//           CARD_BG_STRONG,
//           "backdrop-blur-2xl shadow-[0_18px_50px_rgba(15,23,42,0.08)] overflow-hidden"
//         )}
//       >
//         <div className="px-4 py-4 sm:px-6 sm:py-5">
//           <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
//             <div>
//               <h2 className="text-lg sm:text-xl font-bold text-slate-900">Demand Forecast Sheet</h2>
//             </div>

//             <button
//               type="button"
//               onClick={generatePDF}
//               disabled={!canGenerate}
//               className={cn(
//                 "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
//                 canGenerate ? "bg-blue-900 text-white hover:opacity-90" : "bg-blue-300 text-blue-600 cursor-not-allowed"
//               )}
//               title={!filteredRows.length ? "No rows in selected filters" : "Generate PDF"}
//             >
//               <FaFilePdf /> Generate PDF
//             </button>
//           </div>

//           {/* Dates + Summary */}
//           <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
//             <div className={cn("rounded-xl border bg-white p-3", BRAND_BORDER)}>
//               <label className="text-xs font-semibold text-slate-700">
//                 From Date <span className="text-red-600">*</span>
//               </label>
//               <input
//                 type="date"
//                 value={fromDate}
//                 onChange={(e) => setFromDate(e.target.value)}
//                 className={cn("mt-1", inputCls)}
//                 required
//               />
//             </div>

//             <div className={cn("rounded-xl border bg-white p-3", BRAND_BORDER)}>
//               <label className="text-xs font-semibold text-slate-700">
//                 To Date <span className="text-red-600">*</span>
//               </label>
//               <input
//                 type="date"
//                 value={toDate}
//                 onChange={(e) => setToDate(e.target.value)}
//                 className={cn("mt-1", inputCls)}
//                 required
//               />
//             </div>

//             <div className={cn("rounded-xl border bg-white p-3", BRAND_BORDER)}>
//               <div className="text-xs font-semibold text-slate-700">Summary</div>

//               <div className="mt-2 flex items-center justify-between">
//                 <div className="text-xs text-slate-600">Rows Visible</div>
//                 <div className="text-sm font-bold text-slate-900">{totals.rowsVisible}</div>
//               </div>

//               <div className="mt-2 flex items-center justify-between">
//                 <div className="text-xs text-slate-600">Filled SKU</div>
//                 <div className="text-sm font-bold text-slate-900">{totals.filledSkus}</div>
//               </div>

//               <div className="mt-2 flex items-center justify-between">
//                 <div className="text-xs text-slate-600">Total Forecast Qty</div>
//                 <div className="text-sm font-bold text-slate-900">{totals.totalForecast}</div>
//               </div>
//             </div>
//           </div>

//           {/* Filters */}
//           <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
//             <FilterSelect
//               label="Store"
//               value={storeFilter}
//               onChange={(v) => {
//                 setStoreFilter(v);
//                 setDivisionFilter("All");
//                 setSectionFilter("All");
//                 setDepartmentFilter("All");
//               }}
//               options={storeOptions}
//               icon={<FaStore className="text-emerald-600" />}
//             />

//             <FilterSelect
//               label="Division"
//               value={divisionFilter}
//               onChange={(v) => {
//                 setDivisionFilter(v);
//                 setSectionFilter("All");
//                 setDepartmentFilter("All");
//               }}
//               options={divisionOptions}
//               icon={<FaLayerGroup className="text-blue-700" />}
//             />

//             <FilterSelect
//               label="Section"
//               value={sectionFilter}
//               onChange={(v) => {
//                 setSectionFilter(v);
//                 setDepartmentFilter("All");
//               }}
//               options={sectionOptions}
//               icon={<FaLayerGroup className="text-indigo-700" />}
//             />

//             <FilterSelect
//               label="Department"
//               value={departmentFilter}
//               onChange={setDepartmentFilter}
//               options={departmentOptions}
//               icon={<FaLayerGroup className="text-violet-700" />}
//             />
//           </div>

//           {error && (
//             <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
//               {error}
//             </div>
//           )}

//           {!error && dateValid && filteredRows.length === 0 && (
//             <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
//               No data available for the selected date range / filters.
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Table Card */}
//       <div
//         className={cn(
//           "mt-4 rounded-2xl border",
//           BRAND_BORDER,
//           CARD_BG_SOFT,
//           "backdrop-blur-2xl shadow-[0_18px_50px_rgba(15,23,42,0.08)] overflow-hidden"
//         )}
//       >
//         <div className={cn("px-4 py-3 border-b", BRAND_BORDER, HEADER_BG)}>
//           <div className="text-sm font-bold text-slate-900">Table</div>
//         </div>

//         <div className="w-full overflow-x-auto">
//           <div className="max-h-[62vh] overflow-y-auto overscroll-contain">
//             <table className={cn("min-w-[2100px] w-full text-sm border", BRAND_BORDER)}>
//               <thead className="sticky top-0 z-10 bg-slate-50/95 border-b border-blue-500 backdrop-blur">
//                 <tr className="text-left text-xs font-bold text-slate-800">
//                   <th className="px-3 py-3 w-[70px] border-r border-[#D6DEE8]">SL</th>
//                   <th className="px-3 py-3 w-[140px] border-r border-[#D6DEE8]">Date</th>
//                   <th className="px-3 py-3 w-[180px] border-r border-[#D6DEE8]">Store</th>
//                   <th className="px-3 py-3 w-[280px] border-r border-[#D6DEE8]">
//                     <span className="inline-flex items-center gap-2">
//                       <FaBarcode /> Barcode
//                     </span>
//                   </th>
//                   <th className="px-3 py-3 w-[120px] border-r border-[#D6DEE8]">SKU</th>
//                   <th className="px-3 py-3 w-[160px] border-r border-[#D6DEE8]">Division</th>
//                   <th className="px-3 py-3 w-[180px] border-r border-[#D6DEE8]">Section</th>
//                   <th className="px-3 py-3 w-[160px] border-r border-[#D6DEE8]">Department</th>
//                   <th className="px-3 py-3 w-[180px] border-r border-[#D6DEE8]">Vendor</th>
//                   <th className="px-3 py-3 w-[120px] border-r border-[#D6DEE8]">Brand</th>
//                   <th className="px-3 py-3 w-[110px] border-r border-[#D6DEE8]">Size</th>
//                   <th className="px-3 py-3 w-[120px] border-r border-[#D6DEE8]">Stock</th>
//                   <th className="px-3 py-3 w-[120px] border-r border-[#D6DEE8]">Purchase</th>
//                   <th className="px-3 py-3 w-[120px] border-r border-[#D6DEE8]">Daily Sales</th>
//                   <th className="px-3 py-3 w-[120px] border-r border-[#D6DEE8]">Avg Sales</th>
//                   <th className="px-3 py-3 w-[120px] border-r border-[#D6DEE8]">Alert</th>
//                   <th className="px-3 py-3 w-[240px] border-r border-[#D6DEE8]">MFG / EXP (Food)</th>
//                   <th className="px-3 py-3 w-[120px] border-r border-[#D6DEE8]">Trend %</th>
//                   <th className="px-3 py-3 w-[140px] border-r border-[#D6DEE8]">Seasonality %</th>
//                 </tr>
//               </thead>

//               <tbody>
//                 {filteredRows.map((r, idx) => {
//                   const trendSafe = clamp(r.trend, 0, 50);
//                   const seasonSafe = clamp(r.seasonality, 50, 200);
//                   const barcode = makeBarcode(r);

//                   const isFood = isFoodDivision(r.division);
//                   const b = getExpiryBadge(r.division, r.expDate);

//                   return (
//                     <tr
//                       key={r.id}
//                       className={cn("border-b border-[#D6DEE8]", idx % 2 === 0 ? "bg-white/60" : "bg-white/40")}
//                     >
//                       <td className="px-3 py-2 text-center font-semibold text-slate-700 border-r border-[#D6DEE8]">
//                         {idx + 1}
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{r.date || "-"}</div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{r.store || "-"}</div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={monoBoxCls}>
//                           <span className="inline-flex items-center gap-2">
//                             <FaBarcode className="text-slate-600" />
//                             {barcode}
//                           </span>
//                         </div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{r.sku || "-"}</div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{r.division || "-"}</div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{r.section || "-"}</div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{r.department || "-"}</div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{r.vendorName || "-"}</div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{r.brand || "-"}</div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{r.size || "-"}</div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{String(r.currentStock ?? "-")}</div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{String(r.purchase ?? "-")}</div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{String(r.dailySales ?? "-")}</div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{String(r.avgSales ?? "-")}</div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div
//                           className={cn(
//                             boxCls,
//                             r.stockAlert === "CRITICAL"
//                               ? "font-bold text-red-700"
//                               : r.stockAlert === "LOW"
//                               ? "font-semibold text-amber-700"
//                               : "text-slate-900"
//                           )}
//                         >
//                           {r.stockAlert || "-"}
//                         </div>
//                       </td>

//                       {/* ✅ Food-only MFG/EXP */}
//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         {isFood ? (
//                           <div className={cn(boxCls, "space-y-1")}>
//                             <div className="text-[12px]">
//                               <span className="font-semibold">MFG:</span> {fmtISO(r.mfgDate) || "—"}
//                             </div>
//                             <div className="text-[12px]">
//                               <span className="font-semibold">EXP:</span> {fmtISO(r.expDate) || "—"}
//                             </div>

//                             <div
//                               className={cn(
//                                 "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold w-fit border",
//                                 b.tone === "ok" && "bg-emerald-50 text-emerald-700 border-emerald-200",
//                                 b.tone === "warn" && "bg-amber-50 text-amber-800 border-amber-200",
//                                 b.tone === "bad" && "bg-red-50 text-red-700 border-red-200",
//                                 b.tone === "muted" && "bg-slate-50 text-slate-600 border-slate-200"
//                               )}
//                             >
//                               {b.label}
//                             </div>
//                           </div>
//                         ) : (
//                           <div className={cn(boxCls, "text-slate-500")}>N/A</div>
//                         )}
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{String(trendSafe)}</div>
//                       </td>

//                       <td className="px-3 py-2 border-r border-[#D6DEE8]">
//                         <div className={boxCls}>{String(seasonSafe)}</div>
//                       </td>
//                     </tr>
//                   );
//                 })}

//                 {filteredRows.length === 0 && (
//                   <tr>
//                     <td colSpan={19} className="px-4 py-10 text-center text-sm text-slate-600">
//                       No rows in this date range / filters.
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>

//             {filteredRows.length > 0 && (
//               <div className="px-4 py-3 text-[12px] text-slate-600 border-t border-blue-200 bg-white/60">
//                 Showing <span className="font-semibold">{filteredRows.length}</span> rows after filters.
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
// src/components/StockPlanForecastingDemandForecastSheet.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  FaFilePdf,
  FaFileUpload,
  FaStore,
  FaLayerGroup,
} from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ------------------ Helpers ------------------ */
const cn = (...a) => a.filter(Boolean).join(" ");
const num = (n) => (Number.isNaN(Number(n)) ? 0 : Number(n));

/* ------------------ Store Master ------------------ */
const STORE_MASTER = ["Main - New Market", "Store - Chowringhee", "Store - Hatibagan"];

/* ------------------ FilterSelect Component ------------------ */
const FilterSelect = ({ label, value, onChange, options, icon }) => (
  <div className="rounded-xl border border-[#186fda] bg-white p-3">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[#186fda]">{icon}</span>
      <p className="text-xs font-bold text-slate-800">{label}</p>
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-[#186fda] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </div>
);

/* ------------------ Main Component ------------------ */
export default function StockPlanForecastingDemandForecastSheet() {
  /* ---------- Filters ---------- */
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [storeFilter, setStoreFilter] = useState("All");
  const [divisionFilter, setDivisionFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [error, setError] = useState("");

  /* ---------- Stock Gap Data ---------- */
  const [salesRowsCount, setSalesRowsCount] = useState(0);
  const [stockRowsCount, setStockRowsCount] = useState(0);
  const [stockGapData, setStockGapData] = useState([]);
  const [loading, setLoading] = useState(false);

  const API_BASE = ""; // e.g., `${APP_API_URL}`

  const dateValid = useMemo(() => {
    if (!fromDate || !toDate) return false;
    return new Date(fromDate).getTime() <= new Date(toDate).getTime();
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!fromDate || !toDate) {
      setError("From Date and To Date are required.");
      return;
    }
    if (!dateValid) {
      setError("From Date cannot be after To Date.");
      return;
    }
    setError("");
  }, [fromDate, toDate, dateValid]);

  /* ---------- Upload Handlers ---------- */
  const uploadFiles = async (e, type) => {
    const files = e.target.files;
    if (!files.length) return;
    const formData = new FormData();
    for (const file of files) formData.append("files", file);

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/upload/${type}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (type === "sales") setSalesRowsCount(data.count || 0);
      if (type === "stock") setStockRowsCount(data.count || 0);
      alert(`${type.toUpperCase()} files uploaded successfully.`);
    } catch (err) {
      console.error(err);
      alert("Upload failed. Please check the server.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Fetch Stock Gap ---------- */
  const fetchStockGap = async () => {
    if (!fromDate || !toDate) return alert("Please select date range first.");
    try {
      setLoading(true);
      const params = new URLSearchParams({
        fromDate,
        toDate,
        store: storeFilter,
        division: divisionFilter,
        section: sectionFilter,
        department: departmentFilter,
      });
      const res = await fetch(`${API_BASE}/api/stock-gap?${params.toString()}`);
      const data = await res.json();
      setStockGapData(data);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch Stock Gap data.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Export PDF ---------- */
  const exportStockGapPDF = () => {
    if (!stockGapData.length) return alert("No data to export.");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(12);
    doc.text("Stock Gap Report", 40, 40);
    autoTable(doc, {
      startY: 60,
      head: [
        [
          "Store",
          "Division",
          "Section",
          "Department",
          "Cat1",
          "Cat2",
          "Cat3",
          "Cat4",
          "Cat5",
          "Sales Qty",
          "Stock Qty",
          "Holding (%)",
          "Variance",
        ],
      ],
      body: stockGapData.map((r) => [
        r.store,
        r.division,
        r.section,
        r.department,
        r.category1,
        r.category2,
        r.category3,
        r.category4,
        r.category5,
        r.salesQty,
        r.stockQty,
        r.holdingPercent,
        r.variance,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [248, 250, 252] },
    });
    doc.save(`StockGapReport_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const uniqSorted = (arr) =>
    Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b));

  const storeOptions = useMemo(() => ["All", ...STORE_MASTER], []);
  const divisionOptions = useMemo(
    () => ["All", ...uniqSorted(stockGapData.map((r) => r.division))],
    [stockGapData]
  );
  const sectionOptions = useMemo(
    () => ["All", ...uniqSorted(stockGapData.map((r) => r.section))],
    [stockGapData]
  );
  const departmentOptions = useMemo(
    () => ["All", ...uniqSorted(stockGapData.map((r) => r.department))],
    [stockGapData]
  );

  /* ---------- UI ---------- */
  return (
    <div className="p-4 sm:p-6">
      <div className="rounded-2xl border border-blue-300 bg-white/90 backdrop-blur-2xl shadow-lg p-5">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Stock Gap & Demand Forecast Sheet
          </h2>
          <button
            onClick={exportStockGapPDF}
            disabled={!stockGapData.length}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
              stockGapData.length
                ? "bg-blue-800 text-white hover:bg-blue-900"
                : "bg-blue-300 text-blue-700 cursor-not-allowed"
            )}
          >
            <FaFilePdf /> Export PDF
          </button>
        </div>

        {/* Date Pickers */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl border border-[#186fda] bg-white p-3">
            <label className="text-xs font-semibold text-slate-700">
              From Date <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full mt-1 rounded-lg border border-[#186fda] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div className="rounded-xl border border-[#186fda] bg-white p-3">
            <label className="text-xs font-semibold text-slate-700">
              To Date <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full mt-1 rounded-lg border border-[#186fda] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div className="rounded-xl border border-[#186fda] bg-white p-3">
            <div className="text-xs font-semibold text-slate-700">Summary</div>
            <div className="mt-2 text-xs text-slate-600">
              Sales Rows: <b>{salesRowsCount}</b>
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Stock Rows: <b>{stockRowsCount}</b>
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Results: <b>{stockGapData.length}</b>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Upload Section */}
        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          <div className="rounded-xl border p-3 bg-white">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  <FaFileUpload /> Sales Data Upload
                </div>
                <div className="text-[12px] text-slate-500 mt-1">
                  Expected: Store, Division, Section, Department, BillQty, Cat1–Cat5
                </div>
              </div>
              <input
                type="file"
                multiple
                accept=".xlsx,.xls,.csv"
                onChange={(e) => uploadFiles(e, "sales")}
              />
            </div>
          </div>

          <div className="rounded-xl border p-3 bg-white">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  <FaFileUpload /> Stock Data Upload
                </div>
                <div className="text-[12px] text-slate-500 mt-1">
                  Expected: Store, Division, Section, Department, ClosingQty, Cat1–Cat5
                </div>
              </div>
              <input
                type="file"
                multiple
                accept=".xlsx,.xls,.csv"
                onChange={(e) => uploadFiles(e, "stock")}
              />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid sm:grid-cols-4 gap-3 mb-5">
          <FilterSelect
            label="Store"
            value={storeFilter}
            onChange={setStoreFilter}
            options={storeOptions}
            icon={<FaStore className="text-emerald-600" />}
          />
          <FilterSelect
            label="Division"
            value={divisionFilter}
            onChange={setDivisionFilter}
            options={divisionOptions}
            icon={<FaLayerGroup className="text-blue-700" />}
          />
          <FilterSelect
            label="Section"
            value={sectionFilter}
            onChange={setSectionFilter}
            options={sectionOptions}
            icon={<FaLayerGroup className="text-indigo-700" />}
          />
          <FilterSelect
            label="Department"
            value={departmentFilter}
            onChange={setDepartmentFilter}
            options={departmentOptions}
            icon={<FaLayerGroup className="text-violet-700" />}
          />
        </div>

        <div className="flex justify-end mb-3">
          <button
            onClick={fetchStockGap}
            disabled={loading}
            className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-semibold"
          >
            {loading ? "Loading..." : "🔄 Generate Stock Gap Report"}
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border rounded-xl bg-white">
          <table className="min-w-[1200px] w-full text-sm border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
              <tr>
                <th className="px-3 py-2 border">Store</th>
                <th className="px-3 py-2 border">Division</th>
                <th className="px-3 py-2 border">Section</th>
                <th className="px-3 py-2 border">Department</th>
                <th className="px-3 py-2 border">Cat1</th>
                <th className="px-3 py-2 border">Cat2</th>
                <th className="px-3 py-2 border">Cat3</th>
                <th className="px-3 py-2 border">Cat4</th>
                <th className="px-3 py-2 border">Cat5</th>
                <th className="px-3 py-2 border text-right">Sales Qty</th>
                <th className="px-3 py-2 border text-right">Stock Qty</th>
                <th className="px-3 py-2 border text-right">Holding (%)</th>
                <th className="px-3 py-2 border text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {stockGapData.map((r, i) => (
                <tr key={i} className="border-t hover:bg-blue-50">
                  <td className="px-3 py-2 border">{r.store}</td>
                  <td className="px-3 py-2 border">{r.division}</td>
                  <td className="px-3 py-2 border">{r.section}</td>
                  <td className="px-3 py-2 border">{r.department}</td>
                  <td className="px-3 py-2 border">{r.category1}</td>
                  <td className="px-3 py-2 border">{r.category2}</td>
                  <td className="px-3 py-2 border">{r.category3}</td>
                  <td className="px-3 py-2 border">{r.category4}</td>
                  <td className="px-3 py-2 border">{r.category5}</td>
                  <td className="px-3 py-2 border text-right">{r.salesQty}</td>
                  <td className="px-3 py-2 border text-right">{r.stockQty}</td>
                  <td className="px-3 py-2 border text-right">{r.holdingPercent}</td>
                  <td
                    className={cn(
                      "px-3 py-2 border text-right font-semibold",
                      r.variance < 0 ? "text-red-600" : "text-emerald-700"
                    )}
                  >
                    {r.variance}
                  </td>
                </tr>
              ))}

              {!stockGapData.length && (
                <tr>
                  <td colSpan={13} className="px-4 py-6 text-center text-sm text-slate-600">
                    No Stock Gap data available. Upload files and click “Generate Stock Gap Report”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-3 py-2 text-xs text-slate-500">
            Showing <span className="font-semibold">{stockGapData.length}</span> records.
          </div>
        </div>
      </div>
    </div>
  );
}
