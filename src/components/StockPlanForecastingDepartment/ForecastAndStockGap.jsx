import { API_BASE_URL as APP_API_URL } from "../../config/api.js";



// import React, { useEffect, useMemo, useState } from "react";
// import { FaFilePdf, FaStore, FaLayerGroup, FaUsers, FaClock, FaWarehouse } from "react-icons/fa";
// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";

// const cn = (...a) => a.filter(Boolean).join(" ");
// const API_BASE = `${APP_API_URL}`;

// // ---------- Reusable MultiSelect ----------
// const MultiSelect = ({ label, options, selected, setSelected, icon }) => {
//   const [search, setSearch] = useState("");
//   const [open, setOpen] = useState(false);

//   const filteredOptions = useMemo(
//     () => options.filter((o) => o?.toLowerCase?.().includes(search.toLowerCase())),
//     [search, options]
//   );

//   const toggleOption = (option) =>
//     selected.includes(option)
//       ? setSelected(selected.filter((s) => s !== option))
//       : setSelected([...selected, option]);

//   return (
//     <div className="relative rounded-xl border border-[#186fda] bg-white p-3">
//       <div
//         className="flex items-center justify-between cursor-pointer"
//         onClick={() => setOpen(!open)}
//       >
//         <div className="flex items-center gap-2">
//           <span className="text-[#186fda]">{icon}</span>
//           <p className="text-xs font-bold text-slate-800">{label}</p>
//         </div>
//         <span className="text-xs text-slate-500">
//           {selected.length ? `${selected.length} selected` : "All"}
//         </span>
//       </div>

//       {open && (
//         <div className="absolute z-20 bg-white border border-blue-300 rounded-lg shadow-lg mt-2 w-full max-h-60 overflow-y-auto">
//           <input
//             type="text"
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             placeholder="Search..."
//             className="w-full px-2 py-1 text-xs border-b outline-none"
//           />
//           <div className="max-h-48 overflow-y-auto">
//             {filteredOptions.map((opt) => (
//               <label
//                 key={opt}
//                 className="flex items-center gap-2 px-3 py-1 hover:bg-blue-50 cursor-pointer text-xs"
//               >
//                 <input
//                   type="checkbox"
//                   checked={selected.includes(opt)}
//                   onChange={() => toggleOption(opt)}
//                   className="accent-blue-600"
//                 />
//                 {opt}
//               </label>
//             ))}
//             {!filteredOptions.length && (
//               <p className="px-3 py-2 text-xs text-slate-500">No match found</p>
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// // ---------- Main Component ----------
// export default function ForecastAndStockGap() {
//   const [fromDate, setFromDate] = useState("");
//   const [toDate, setToDate] = useState("");
//   const [holdingDays, setHoldingDays] = useState(45);
//   const [loading, setLoading] = useState(false);
//   const [data, setData] = useState([]);

//   const [stores, setStores] = useState([]);
//   const [divisions, setDivisions] = useState([]);
//   const [sections, setSections] = useState([]);
//   const [departments, setDepartments] = useState([]);
//   const [vendors, setVendors] = useState([]);
//   const [categories, setCategories] = useState([]);

//   const [selectedStores, setSelectedStores] = useState([]);
//   const [selectedDivisions, setSelectedDivisions] = useState([]);
//   const [selectedSections, setSelectedSections] = useState([]);
//   const [selectedDepartments, setSelectedDepartments] = useState([]);
//   const [selectedVendors, setSelectedVendors] = useState([]);
//   const [selectedCategories, setSelectedCategories] = useState([]);

//   // ---------- Date Validator ----------
//   const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) >= 2000;

//   // ---------- Fetch filters dynamically when BOTH dates valid ----------
//   useEffect(() => {
//     const fetchFilters = async () => {
//       if (!isValidDate(fromDate) || !isValidDate(toDate)) return;

//       try {
//         const params = new URLSearchParams({ fromDate, toDate });
//         const res = await fetch(`${API_BASE}/api/upload/stock-gap?${params.toString()}`);
//         const json = await res.json();

//         const uniq = (arr) => Array.from(new Set(arr.filter(Boolean))).sort();
//         setStores(uniq(json.map((r) => r.store)));
//         setDivisions(uniq(json.map((r) => r.division)));
//         setSections(uniq(json.map((r) => r.section)));
//         setDepartments(uniq(json.map((r) => r.department)));
//         setVendors(uniq(json.map((r) => r.vendor)));
//         setCategories(
//           uniq([
//             ...json.map((r) => r.category1),
//             ...json.map((r) => r.category2),
//             ...json.map((r) => r.category3),
//             ...json.map((r) => r.category4),
//             ...json.map((r) => r.category5),
//             ...json.map((r) => r.category6),
//           ])
//         );
//       } catch (err) {
//         console.error("Failed to load filters", err);
//       }
//     };

//     fetchFilters();
//   }, [fromDate, toDate]);

//   // ---------- Fetch Stock Gap ----------
//   const fetchStockGap = async () => {
//     if (!isValidDate(fromDate) || !isValidDate(toDate))
//       return alert("Please select valid From and To dates.");

//     try {
//       setLoading(true);
//       const params = new URLSearchParams({
//         fromDate,
//         toDate,
//         store: selectedStores.length ? selectedStores.join(",") : "All",
//         division: selectedDivisions.length ? selectedDivisions.join(",") : "All",
//         section: selectedSections.length ? selectedSections.join(",") : "All",
//         department: selectedDepartments.length ? selectedDepartments.join(",") : "All",
//         vendor: selectedVendors.length ? selectedVendors.join(",") : "All",
//         category: selectedCategories.length ? selectedCategories.join(",") : "All",
//         holdingDays,
//       });

//       const res = await fetch(`${API_BASE}/api/upload/stock-gap?${params.toString()}`);
//       const json = await res.json();
//       setData(json);
//     } catch (err) {
//       console.error(err);
//       alert("Failed to fetch data.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ---------- Export PDF ----------
//   const exportPDF = () => {
//     if (!data.length) return alert("No data to export.");
//     const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
//     doc.setFontSize(12);
//     doc.text(`Stock Gap Report (Holding: ${holdingDays} days)`, 40, 40);

//     autoTable(doc, {
//       startY: 60,
//       head: [
//         [
//           "Store",
//           "Division",
//           "Section",
//           "Department",
//           "Vendor",
//           "Cat1",
//           "Cat2",
//           "Cat3",
//           "Cat4",
//           "Cat5",
//           "Cat6",
//           "Sales Qty",
//           "Store Stock",
//           "Godown Stock",
//           "Total Stock",
//           "Stock Holding",
//           "Variance",
//         ],
//       ],
//       body: data.map((r) => [
//         r.store,
//         r.division,
//         r.section,
//         r.department,
//         r.vendor,
//         r.category1,
//         r.category2,
//         r.category3,
//         r.category4,
//         r.category5,
//         r.category6,
//         r.salesQty,
//         r.storeStock,
//         r.godownStock,
//         r.totalStock,
//         r.stockHolding,
//         r.variance,
//       ]),
//       styles: { fontSize: 8 },
//       headStyles: { fillColor: [240, 245, 255] },
//     });
//     doc.save(`StockGapReport_${new Date().toISOString().slice(0, 10)}.pdf`);
//   };

//   return (
//     <div className="p-6">
//       <div className="rounded-2xl border border-blue-300 bg-white/90 p-5 shadow">
//         {/* Header */}
//         <div className="flex justify-between items-center mb-4">
//           <h2 className="text-lg sm:text-xl font-bold text-slate-900">📊 Stock Gap Report</h2>
//           <button
//             onClick={exportPDF}
//             disabled={!data.length}
//             className={cn(
//               "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
//               data.length
//                 ? "bg-blue-800 text-white hover:bg-blue-900"
//                 : "bg-blue-300 text-blue-700 cursor-not-allowed"
//             )}
//           >
//             <FaFilePdf /> Export PDF
//           </button>
//         </div>

//         {/* Filters: Date + Holding */}
//         <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
//           <div className="rounded-xl border border-[#186fda] bg-white p-3">
//             <label className="text-xs font-semibold text-slate-700">
//               From Date <span className="text-red-600">*</span>
//             </label>
//             <input
//               type="date"
//               value={fromDate}
//               onChange={(e) => setFromDate(e.target.value)}
//               className="w-full mt-1 rounded-lg border border-[#186fda] px-3 py-2 outline-none"
//             />
//           </div>
//           <div className="rounded-xl border border-[#186fda] bg-white p-3">
//             <label className="text-xs font-semibold text-slate-700">
//               To Date <span className="text-red-600">*</span>
//             </label>
//             <input
//               type="date"
//               value={toDate}
//               onChange={(e) => setToDate(e.target.value)}
//               className="w-full mt-1 rounded-lg border border-[#186fda] px-3 py-2 outline-none"
//             />
//           </div>

//           <div className="rounded-xl border border-[#186fda] bg-white p-3">
//             <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
//               <FaClock className="text-[#186fda]" /> Holding Days
//             </label>
//             <select
//               value={holdingDays}
//               onChange={(e) => setHoldingDays(Number(e.target.value))}
//               className="w-full mt-1 rounded-lg border border-[#186fda] px-3 py-2 text-sm"
//             >
//               {[7, 15, 30, 45].map((d) => (
//                 <option key={d} value={d}>
//                   {d} Days
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div className="rounded-xl border border-[#186fda] bg-white p-3 text-xs">
//             <div className="font-semibold text-slate-700">Summary</div>
//             <div className="mt-1 text-slate-600">
//               Records: <b>{data.length}</b>
//             </div>
//           </div>
//         </div>

//         {/* Dynamic Filters */}
//         <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
//           <MultiSelect label="Store / Godown" options={stores} selected={selectedStores} setSelected={setSelectedStores} icon={<FaWarehouse />} />
//           <MultiSelect label="Division" options={divisions} selected={selectedDivisions} setSelected={setSelectedDivisions} icon={<FaLayerGroup />} />
//           <MultiSelect label="Section" options={sections} selected={selectedSections} setSelected={setSelectedSections} icon={<FaLayerGroup />} />
//           <MultiSelect label="Department" options={departments} selected={selectedDepartments} setSelected={setSelectedDepartments} icon={<FaLayerGroup />} />
//           <MultiSelect label="Vendor" options={vendors} selected={selectedVendors} setSelected={setSelectedVendors} icon={<FaUsers />} />
//           <MultiSelect label="Category" options={categories} selected={selectedCategories} setSelected={setSelectedCategories} icon={<FaLayerGroup />} />
//         </div>

//         <div className="flex justify-end mb-3">
//           <button
//             onClick={fetchStockGap}
//             disabled={loading}
//             className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-semibold"
//           >
//             {loading ? "Loading..." : "🔄 Generate Report"}
//           </button>
//         </div>

//         {/* Data Table */}
//         <div className="overflow-x-auto border rounded-xl bg-white">
//           <table className="min-w-[1500px] w-full text-sm border-collapse">
//             <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
//               <tr>
//                 <th className="px-3 py-2 border">Store</th>
//                 <th className="px-3 py-2 border">Division</th>
//                 <th className="px-3 py-2 border">Section</th>
//                 <th className="px-3 py-2 border">Department</th>
//                 <th className="px-3 py-2 border">Vendor</th>
//                 <th className="px-3 py-2 border">Cat1</th>
//                 <th className="px-3 py-2 border">Cat2</th>
//                 <th className="px-3 py-2 border">Cat3</th>
//                 <th className="px-3 py-2 border">Cat4</th>
//                 <th className="px-3 py-2 border">Cat5</th>
//                 <th className="px-3 py-2 border text-right">Sales Qty</th>
//                 <th className="px-3 py-2 border text-right">Store Stock</th>
//                 <th className="px-3 py-2 border text-right">Godown Stock</th>
//                 <th className="px-3 py-2 border text-right">Total Stock</th>
//                 <th className="px-3 py-2 border text-right">Stock Holding</th>
//                 <th className="px-3 py-2 border text-right">Variance</th>
//               </tr>
//             </thead>
//             <tbody>
//               {data.map((r, i) => (
//                 <tr key={i} className="border-t hover:bg-blue-50">
//                   <td className="px-3 py-2 border">{r.store}</td>
//                   <td className="px-3 py-2 border">{r.division}</td>
//                   <td className="px-3 py-2 border">{r.section}</td>
//                   <td className="px-3 py-2 border">{r.department}</td>
//                   <td className="px-3 py-2 border">{r.vendor}</td>
//                   <td className="px-3 py-2 border">{r.category1}</td>
//                   <td className="px-3 py-2 border">{r.category2}</td>
//                   <td className="px-3 py-2 border">{r.category3}</td>
//                   <td className="px-3 py-2 border">{r.category4}</td>
//                   <td className="px-3 py-2 border">{r.category5}</td>
//                   <td className="px-3 py-2 border text-right">{r.salesQty}</td>
//                   <td className="px-3 py-2 border text-right">{r.storeStock}</td>
//                   <td className="px-3 py-2 border text-right">{r.godownStock}</td>
//                   <td className="px-3 py-2 border text-right">{r.totalStock}</td>
//                   <td className="px-3 py-2 border text-right">{r.stockHolding}</td>
//                   <td
//                     className={cn(
//                       "px-3 py-2 border text-right font-semibold",
//                       r.variance < 0 ? "text-red-600" : "text-emerald-700"
//                     )}
//                   >
//                     {r.variance}
//                   </td>
//                 </tr>
//               ))}
//               {!data.length && (
//                 <tr>
//                   <td colSpan={16} className="px-4 py-6 text-center text-sm text-slate-600">
//                     No data found. Select filters and click "Generate Report".
//                   </td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// }


// import React, { useEffect, useMemo, useState } from "react";
// import { FaFilePdf, FaLayerGroup, FaUsers, FaClock, FaWarehouse } from "react-icons/fa";
// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";

// const cn = (...a) => a.filter(Boolean).join(" ");
// const API_BASE = `${APP_API_URL}`;

// // ---------- Reusable MultiSelect ----------
// const MultiSelect = ({ label, options, selected, setSelected, icon }) => {
//   const [search, setSearch] = useState("");
//   const [open, setOpen] = useState(false);

//   const filteredOptions = useMemo(
//     () => options.filter((o) => o?.toLowerCase?.().includes(search.toLowerCase())),
//     [search, options]
//   );

//   const toggleOption = (option) =>
//     selected.includes(option)
//       ? setSelected(selected.filter((s) => s !== option))
//       : setSelected([...selected, option]);

//   return (
//     <div className="relative rounded-xl border border-[#186fda] bg-white p-3">
//       <div className="flex items-center justify-between cursor-pointer" onClick={() => setOpen(!open)}>
//         <div className="flex items-center gap-2">
//           <span className="text-[#186fda]">{icon}</span>
//           <p className="text-xs font-bold text-slate-800">{label}</p>
//         </div>
//         <span className="text-xs text-slate-500">
//           {selected.length ? `${selected.length} selected` : "All"}
//         </span>
//       </div>

//       {open && (
//         <div className="absolute z-20 bg-white border border-blue-300 rounded-lg shadow-lg mt-2 w-full max-h-60 overflow-y-auto">
//           <input
//             type="text"
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             placeholder="Search..."
//             className="w-full px-2 py-1 text-xs border-b outline-none"
//           />
//           <div className="max-h-48 overflow-y-auto">
//             {filteredOptions.map((opt) => (
//               <label
//                 key={opt}
//                 className="flex items-center gap-2 px-3 py-1 hover:bg-blue-50 cursor-pointer text-xs"
//               >
//                 <input
//                   type="checkbox"
//                   checked={selected.includes(opt)}
//                   onChange={() => toggleOption(opt)}
//                   className="accent-blue-600"
//                 />
//                 {opt}
//               </label>
//             ))}
//             {!filteredOptions.length && (
//               <p className="px-3 py-2 text-xs text-slate-500">No match found</p>
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// // ---------- Main Component ----------
// export default function ForecastAndStockGap() {
//   const [fromDate, setFromDate] = useState("");
//   const [toDate, setToDate] = useState("");
//   const [holdingDays, setHoldingDays] = useState(45);
//   const [loading, setLoading] = useState(false);
//   const [data, setData] = useState([]);

//   // Filter options
//   const [stores, setStores] = useState([]);
//   const [divisions, setDivisions] = useState([]);
//   const [sections, setSections] = useState([]);
//   const [departments, setDepartments] = useState([]);
//   const [vendors, setVendors] = useState([]);
//   const [categories, setCategories] = useState([]);

//   // Selected filters
//   const [selectedStores, setSelectedStores] = useState([]);
//   const [selectedDivisions, setSelectedDivisions] = useState([]);
//   const [selectedSections, setSelectedSections] = useState([]);
//   const [selectedDepartments, setSelectedDepartments] = useState([]);
//   const [selectedVendors, setSelectedVendors] = useState([]);
//   const [selectedCategories, setSelectedCategories] = useState([]);

//   // ---------- Date Validator ----------
//   const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) >= 2000;

//   // ---------- Fetch filter options on mount ----------
//   useEffect(() => {
//     const fetchFilterOptions = async () => {
//       try {
//         const res = await fetch(`${API_BASE}/api/upload/filters/options`);
//         const json = await res.json();

//         setStores(json.stores || []);
//         setDivisions(json.divisions || []);
//         setSections(json.sections || []);
//         setDepartments(json.departments || []);
//         setVendors(json.vendors || []);
//         setCategories(json.categories || []);
//       } catch (err) {
//         console.error("Failed to load filter options", err);
//       }
//     };

//     fetchFilterOptions();
//   }, []);

//   // ---------- Fetch Stock Gap ----------
//   const fetchStockGap = async () => {
//     if (!isValidDate(fromDate) || !isValidDate(toDate))
//       return alert("Please select valid From and To dates.");

//     try {
//       setLoading(true);
//       const params = new URLSearchParams({
//         fromDate,
//         toDate,
//         store: selectedStores.length ? selectedStores.join(",") : "All",
//         division: selectedDivisions.length ? selectedDivisions.join(",") : "All",
//         section: selectedSections.length ? selectedSections.join(",") : "All",
//         department: selectedDepartments.length ? selectedDepartments.join(",") : "All",
//         vendor: selectedVendors.length ? selectedVendors.join(",") : "All",
//         category: selectedCategories.length ? selectedCategories.join(",") : "All",
//         holdingDays,
//       });

//       const res = await fetch(`${API_BASE}/api/upload/stock-gap?${params.toString()}`);
//       const json = await res.json();
//       setData(json);
//     } catch (err) {
//       console.error(err);
//       alert("Failed to fetch data.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ---------- Export PDF ----------
//   const exportPDF = () => {
//     if (!data.length) return alert("No data to export.");
//     const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
//     doc.setFontSize(12);
//     doc.text(`Stock Gap Report (Holding: ${holdingDays} days)`, 40, 40);

//     autoTable(doc, {
//       startY: 60,
//       head: [
//         [
//           "Store","Division","Section","Department","Vendor",
//           "Cat1","Cat2","Cat3","Cat4","Cat5","Cat6",
//           "Sales Qty","Store Stock","Godown Stock","Total Stock","Stock Holding","Variance"
//         ],
//       ],
//       body: data.map((r) => [
//         r.store,r.division,r.section,r.department,r.vendor,
//         r.category1,r.category2,r.category3,r.category4,r.category5,r.category6,
//         r.salesQty,r.storeStock,r.godownStock,r.totalStock,r.stockHolding,r.variance,
//       ]),
//       styles: { fontSize: 8 },
//       headStyles: { fillColor: [240, 245, 255] },
//     });
//     doc.save(`StockGapReport_${new Date().toISOString().slice(0, 10)}.pdf`);
//   };

//   return (
//     <div className="p-6">
//       <div className="rounded-2xl border border-blue-300 bg-white/90 p-5 shadow">
//         {/* Header */}
//         <div className="flex justify-between items-center mb-4">
//           <h2 className="text-lg sm:text-xl font-bold text-slate-900">📊 Stock Gap Report</h2>
//           <button
//             onClick={exportPDF}
//             disabled={!data.length}
//             className={cn(
//               "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
//               data.length
//                 ? "bg-blue-800 text-white hover:bg-blue-900"
//                 : "bg-blue-300 text-blue-700 cursor-not-allowed"
//             )}
//           >
//             <FaFilePdf /> Export PDF
//           </button>
//         </div>

//         {/* Filters: Date + Holding */}
//         <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
//           <div className="rounded-xl border border-[#186fda] bg-white p-3">
//             <label className="text-xs font-semibold text-slate-700">From Date <span className="text-red-600">*</span></label>
//             <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full mt-1 rounded-lg border border-[#186fda] px-3 py-2 outline-none"/>
//           </div>
//           <div className="rounded-xl border border-[#186fda] bg-white p-3">
//             <label className="text-xs font-semibold text-slate-700">To Date <span className="text-red-600">*</span></label>
//             <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full mt-1 rounded-lg border border-[#186fda] px-3 py-2 outline-none"/>
//           </div>
//           <div className="rounded-xl border border-[#186fda] bg-white p-3">
//             <label className="text-xs font-semibold text-slate-700 flex items-center gap-1"><FaClock className="text-[#186fda]" /> Holding Days</label>
//             <select value={holdingDays} onChange={(e) => setHoldingDays(Number(e.target.value))} className="w-full mt-1 rounded-lg border border-[#186fda] px-3 py-2 text-sm">
//               {[7,15,30,45].map(d => <option key={d} value={d}>{d} Days</option>)}
//             </select>
//           </div>
//           <div className="rounded-xl border border-[#186fda] bg-white p-3 text-xs">
//             <div className="font-semibold text-slate-700">Summary</div>
//             <div className="mt-1 text-slate-600">Records: <b>{data.length}</b></div>
//           </div>
//         </div>

//         {/* Dynamic Filters */}
//         <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
//           <MultiSelect label="Store / Godown" options={stores} selected={selectedStores} setSelected={setSelectedStores} icon={<FaWarehouse />} />
//           <MultiSelect label="Division" options={divisions} selected={selectedDivisions} setSelected={setSelectedDivisions} icon={<FaLayerGroup />} />
//           <MultiSelect label="Section" options={sections} selected={selectedSections} setSelected={setSelectedSections} icon={<FaLayerGroup />} />
//           <MultiSelect label="Department" options={departments} selected={selectedDepartments} setSelected={setSelectedDepartments} icon={<FaLayerGroup />} />
//           <MultiSelect label="Vendor" options={vendors} selected={selectedVendors} setSelected={setSelectedVendors} icon={<FaUsers />} />
//           <MultiSelect label="Category" options={categories} selected={selectedCategories} setSelected={setSelectedCategories} icon={<FaLayerGroup />} />
//         </div>

//         <div className="flex justify-end mb-3">
//           <button onClick={fetchStockGap} disabled={loading} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-semibold">
//             {loading ? "Loading..." : "🔄 Generate Report"}
//           </button>
//         </div>

//         {/* Data Table */}
//         <div className="overflow-x-auto border rounded-xl bg-white">
//           <table className="min-w-[1500px] w-full text-sm border-collapse">
//             <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
//               <tr>
//                 <th className="px-3 py-2 border">Store</th>
//                 <th className="px-3 py-2 border">Division</th>
//                 <th className="px-3 py-2 border">Section</th>
//                 <th className="px-3 py-2 border">Department</th>
//                 <th className="px-3 py-2 border">Vendor</th>
//                 <th className="px-3 py-2 border">Cat1</th>
//                 <th className="px-3 py-2 border">Cat2</th>
//                 <th className="px-3 py-2 border">Cat3</th>
//                 <th className="px-3 py-2 border">Cat4</th>
//                 <th className="px-3 py-2 border">Cat5</th>
//                 <th className="px-3 py-2 border text-right">Sales Qty</th>
//                 <th className="px-3 py-2 border text-right">Store Stock</th>
//                 <th className="px-3 py-2 border text-right">Godown Stock</th>
//                 <th className="px-3 py-2 border text-right">Total Stock</th>
//                 <th className="px-3 py-2 border text-right">Stock Holding</th>
//                 <th className="px-3 py-2 border text-right">Variance</th>
//               </tr>
//             </thead>
//             <tbody>
//               {data.map((r,i) => (
//                 <tr key={i} className="border-t hover:bg-blue-50">
//                   <td className="px-3 py-2 border">{r.store}</td>
//                   <td className="px-3 py-2 border">{r.division}</td>
//                   <td className="px-3 py-2 border">{r.section}</td>
//                   <td className="px-3 py-2 border">{r.department}</td>
//                   <td className="px-3 py-2 border">{r.vendor}</td>
//                   <td className="px-3 py-2 border">{r.category1}</td>
//                   <td className="px-3 py-2 border">{r.category2}</td>
//                   <td className="px-3 py-2 border">{r.category3}</td>
//                   <td className="px-3 py-2 border">{r.category4}</td>
//                   <td className="px-3 py-2 border">{r.category5}</td>
//                   <td className="px-3 py-2 border text-right">{r.salesQty}</td>
//                   <td className="px-3 py-2 border text-right">{r.storeStock}</td>
//                   <td className="px-3 py-2 border text-right">{r.godownStock}</td>
//                   <td className="px-3 py-2 border text-right">{r.totalStock}</td>
//                   <td className="px-3 py-2 border text-right">{r.stockHolding}</td>
//                   <td className={cn("px-3 py-2 border text-right font-semibold", r.variance<0 ? "text-red-600":"text-emerald-700")}>{r.variance}</td>
//                 </tr>
//               ))}
//               {!data.length && (
//                 <tr>
//                   <td colSpan={16} className="px-4 py-6 text-center text-sm text-slate-600">
//                     No data found. Select filters and click "Generate Report".
//                   </td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// }




import React, { useEffect, useMemo, useState } from "react";
import { FaFilePdf, FaFileExcel, FaLayerGroup, FaUsers, FaClock, FaWarehouse } from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const cn = (...a) => a.filter(Boolean).join(" ");
const API_BASE = `${APP_API_URL}`;

// ---------- Reusable MultiSelect ----------
const MultiSelect = ({ label, options, selected, setSelected, icon }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filteredOptions = useMemo(
    () => options.filter((o) => o?.toLowerCase?.().includes(search.toLowerCase())),
    [search, options]
  );

  const toggleOption = (option) =>
    selected.includes(option)
      ? setSelected(selected.filter((s) => s !== option))
      : setSelected([...selected, option]);

  return (
    <div className="relative rounded-xl border border-[#186fda] bg-white p-3">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[#186fda]">{icon}</span>
          <p className="text-xs font-bold text-slate-800">{label}</p>
        </div>
        <span className="text-xs text-slate-500">
          {selected.length ? `${selected.length} selected` : "All"}
        </span>
      </div>

      {open && (
        <div className="absolute z-20 bg-white border border-blue-300 rounded-lg shadow-lg mt-2 w-full max-h-60 overflow-y-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full px-2 py-1 text-xs border-b outline-none"
          />

          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 px-3 py-1 hover:bg-blue-50 cursor-pointer text-xs"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggleOption(opt)}
                  className="accent-blue-600"
                />
                {opt}
              </label>
            ))}

            {!filteredOptions.length && (
              <p className="px-3 py-2 text-xs text-slate-500">No match found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Main Component ----------
export default function ForecastAndStockGap() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [holdingDays, setHoldingDays] = useState(45);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  const [stores, setStores] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [sections, setSections] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);

  const [selectedStores, setSelectedStores] = useState([]);
  const [selectedDivisions, setSelectedDivisions] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  const isValidDate = (d) =>
    /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) >= 2000;

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/upload/filters/options`);
        const json = await res.json();

        setStores(json.stores || []);
        setDivisions(json.divisions || []);
        setSections(json.sections || []);
        setDepartments(json.departments || []);
        setVendors(json.vendors || []);
        setCategories(json.categories || []);
      } catch (err) {
        console.error("Failed to load filter options", err);
      }
    };

    fetchFilterOptions();
  }, []);

  const fetchStockGap = async () => {
    if (!isValidDate(fromDate) || !isValidDate(toDate))
      return alert("Please select valid From and To dates.");

    try {
      setLoading(true);

      const params = new URLSearchParams({
        fromDate,
        toDate,
        store: selectedStores.length ? selectedStores.join(",") : "All",
        division: selectedDivisions.length ? selectedDivisions.join(",") : "All",
        section: selectedSections.length ? selectedSections.join(",") : "All",
        department: selectedDepartments.length ? selectedDepartments.join(",") : "All",
        vendor: selectedVendors.length ? selectedVendors.join(",") : "All",
        category: selectedCategories.length ? selectedCategories.join(",") : "All",
        holdingDays,
      });

      const res = await fetch(
        `${API_BASE}/api/upload/stock-gap?${params.toString()}`
      );
      const json = await res.json();

      setData(json);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch data.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Export PDF ----------
  const exportPDF = () => {
    if (!data.length) return alert("No data to export.");

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    doc.setFontSize(12);
    doc.text(`Stock Gap Report (Holding: ${holdingDays} days)`, 40, 40);

    autoTable(doc, {
      startY: 60,
      head: [
        [
          "Store",
          "Division",
          "Section",
          "Department",
          "Vendor",
          "Cat1",
          "Cat2",
          "Cat3",
          "Cat4",
          "Cat5",
          "Sales Qty",
          "Store Stock",
          "Godown Stock",
          "Total Stock",
          "Stock Holding",
          "Variance",
        ],
      ],
      body: data.map((r) => [
        r.store,
        r.division,
        r.section,
        r.department,
        r.vendor,
        r.category1,
        r.category2,
        r.category3,
        r.category4,
        r.category5,
        r.salesQty,
        r.storeStock,
        r.godownStock,
        r.totalStock,
        r.stockHolding,
        r.variance,
      ]),
      styles: { fontSize: 8 },
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
      },
    });

    doc.save(`StockGapReport_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ---------- Export Excel ----------
  const exportExcel = () => {
    if (!data.length) return alert("No data to export.");

    const headers = [
      "Store",
      "Division",
      "Section",
      "Department",
      "Vendor",
      "Cat1",
      "Cat2",
      "Cat3",
      "Cat4",
      "Cat5",
      "Sales Qty",
      "Store Stock",
      "Godown Stock",
      "Total Stock",
      "Stock Holding",
      "Variance",
    ];

    const rows = data.map((r) => [
      r.store,
      r.division,
      r.section,
      r.department,
      r.vendor,
      r.category1,
      r.category2,
      r.category3,
      r.category4,
      r.category5,
      r.salesQty,
      r.storeStock,
      r.godownStock,
      r.totalStock,
      r.stockHolding,
      r.variance,
    ]);

    let csv = headers.join(",") + "\n";

    rows.forEach((row) => {
      csv += row.join(",") + "\n";
    });

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `StockGapReport_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    link.click();
  };

  return (
    <div className="p-6">
      <div className="rounded-2xl border border-blue-300 bg-white/90 p-5 shadow">

        {/* Header */}

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            📊 Stock Gap Report
          </h2>

          <div className="flex gap-2">

            <button
              onClick={exportExcel}
              disabled={!data.length}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
                data.length
                  ? "bg-green-700 text-white hover:bg-green-800"
                  : "bg-green-300 text-green-700 cursor-not-allowed"
              )}
            >
              <FaFileExcel /> Excel
            </button>

            <button
              onClick={exportPDF}
              disabled={!data.length}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
                data.length
                  ? "bg-blue-800 text-white hover:bg-blue-900"
                  : "bg-blue-300 text-blue-700 cursor-not-allowed"
              )}
            >
              <FaFilePdf /> PDF
            </button>

          </div>
        </div>

        {/* Filters */}

        <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
          <div className="rounded-xl border border-[#186fda] bg-white p-3">
            <label className="text-xs font-semibold text-slate-700">
              From Date *
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full mt-1 rounded-lg border border-[#186fda] px-3 py-2 outline-none"
            />
          </div>

          <div className="rounded-xl border border-[#186fda] bg-white p-3">
            <label className="text-xs font-semibold text-slate-700">
              To Date *
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full mt-1 rounded-lg border border-[#186fda] px-3 py-2 outline-none"
            />
          </div>

          <div className="rounded-xl border border-[#186fda] bg-white p-3">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <FaClock className="text-[#186fda]" /> Holding Days
            </label>

            <select
              value={holdingDays}
              onChange={(e) => setHoldingDays(Number(e.target.value))}
              className="w-full mt-1 rounded-lg border border-[#186fda] px-3 py-2 text-sm"
            >
              {[7, 15, 30, 45].map((d) => (
                <option key={d} value={d}>
                  {d} Days
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-[#186fda] bg-white p-3 text-xs">
            <div className="font-semibold text-slate-700">Summary</div>
            <div className="mt-1 text-slate-600">
              Records: <b>{data.length}</b>
            </div>
          </div>
        </div>

        {/* Filters MultiSelect */}

        <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
          <MultiSelect label="Store / Godown" options={stores} selected={selectedStores} setSelected={setSelectedStores} icon={<FaWarehouse />} />
          <MultiSelect label="Division" options={divisions} selected={selectedDivisions} setSelected={setSelectedDivisions} icon={<FaLayerGroup />} />
          <MultiSelect label="Section" options={sections} selected={selectedSections} setSelected={setSelectedSections} icon={<FaLayerGroup />} />
          <MultiSelect label="Department" options={departments} selected={selectedDepartments} setSelected={setSelectedDepartments} icon={<FaLayerGroup />} />
          <MultiSelect label="Vendor" options={vendors} selected={selectedVendors} setSelected={setSelectedVendors} icon={<FaUsers />} />
          <MultiSelect label="Category" options={categories} selected={selectedCategories} setSelected={setSelectedCategories} icon={<FaLayerGroup />} />
        </div>

        <div className="flex justify-end mb-3">
          <button
            onClick={fetchStockGap}
            disabled={loading}
            className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-semibold"
          >
            {loading ? "Loading..." : "🔄 Generate Report"}
          </button>
        </div>

        {/* Table */}

        <div className="overflow-x-auto border rounded-xl bg-white">
          <table className="min-w-[1500px] w-full text-sm border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
              <tr>
                <th className="px-3 py-2 border">Store</th>
                <th className="px-3 py-2 border">Division</th>
                <th className="px-3 py-2 border">Section</th>
                <th className="px-3 py-2 border">Department</th>
                <th className="px-3 py-2 border">Vendor</th>
                <th className="px-3 py-2 border">Cat1</th>
                <th className="px-3 py-2 border">Cat2</th>
                <th className="px-3 py-2 border">Cat3</th>
                <th className="px-3 py-2 border">Cat4</th>
                <th className="px-3 py-2 border">Cat5</th>
                <th className="px-3 py-2 border text-right">Sales Qty</th>
                <th className="px-3 py-2 border text-right">Store Stock</th>
                <th className="px-3 py-2 border text-right">Godown Stock</th>
                <th className="px-3 py-2 border text-right">Total Stock</th>
                <th className="px-3 py-2 border text-right">Stock Holding</th>
                <th className="px-3 py-2 border text-right">Variance</th>
              </tr>
            </thead>

            <tbody>
              {data.map((r, i) => (
                <tr key={i} className="border-t hover:bg-blue-50">
                  <td className="px-3 py-2 border">{r.store}</td>
                  <td className="px-3 py-2 border">{r.division}</td>
                  <td className="px-3 py-2 border">{r.section}</td>
                  <td className="px-3 py-2 border">{r.department}</td>
                  <td className="px-3 py-2 border">{r.vendor}</td>
                  <td className="px-3 py-2 border">{r.category1}</td>
                  <td className="px-3 py-2 border">{r.category2}</td>
                  <td className="px-3 py-2 border">{r.category3}</td>
                  <td className="px-3 py-2 border">{r.category4}</td>
                  <td className="px-3 py-2 border">{r.category5}</td>
                  <td className="px-3 py-2 border text-right">{r.salesQty}</td>
                  <td className="px-3 py-2 border text-right">{r.storeStock}</td>
                  <td className="px-3 py-2 border text-right">{r.godownStock}</td>
                  <td className="px-3 py-2 border text-right">{r.totalStock}</td>
                  <td className="px-3 py-2 border text-right">{r.stockHolding}</td>
                  <td className={cn(
                    "px-3 py-2 border text-right font-semibold",
                    r.variance < 0 ? "text-red-600" : "text-emerald-700"
                  )}>
                    {r.variance}
                  </td>
                </tr>
              ))}

              {!data.length && (
                <tr>
                  <td colSpan={16} className="px-4 py-6 text-center text-sm text-slate-600">
                    No data found. Select filters and click "Generate Report".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}