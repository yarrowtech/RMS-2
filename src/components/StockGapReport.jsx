// import React, { useState } from "react";
// import * as XLSX from "xlsx";
// import {
//   Accordion,
//   AccordionItem,
//   AccordionTrigger,
//   AccordionContent,
// } from "@/components/ui/accordion";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
// import { BarChart, Bar, PieChart, Pie, Cell, Tooltip, Legend, XAxis, YAxis, ResponsiveContainer } from "recharts";
// import { Upload, FileSpreadsheet, BarChart3 } from "lucide-react";

// export default function StockGapReport() {
//   const [salesFile, setSalesFile] = useState(null);
//   const [stockFile, setStockFile] = useState(null);
//   const [report, setReport] = useState([]);
//   const [filters, setFilters] = useState({ store: "", division: "", department: "" });
//   const [chartData, setChartData] = useState([]);

//   const COLORS = ["#2563eb", "#22c55e", "#f97316", "#ef4444", "#14b8a6"];

//   const handleFileUpload = (e, type) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".csv")) {
//       alert("Please upload a valid Excel or CSV file.");
//       return;
//     }
//     type === "sales" ? setSalesFile(file) : setStockFile(file);
//   };

//   const readExcel = (file) =>
//     new Promise((resolve) => {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const workbook = XLSX.read(e.target.result, { type: "binary" });
//         const sheet = workbook.Sheets[workbook.SheetNames[0]];
//         resolve(XLSX.utils.sheet_to_json(sheet));
//       };
//       reader.readAsBinaryString(file);
//     });

//   const generateReport = async () => {
//     if (!salesFile || !stockFile) {
//       alert("Please upload both Sales and Stock files!");
//       return;
//     }

//     const salesData = await readExcel(salesFile);
//     const stockData = await readExcel(stockFile);

//     const requiredCols = ["Store", "Division", "Section", "Department", "Bill Quantity", "Closing Quantity"];
//     const hasCols = requiredCols.every((col) =>
//       [...Object.keys(salesData[0]), ...Object.keys(stockData[0])].includes(col)
//     );
//     if (!hasCols) {
//       alert("Missing required columns in uploaded files!");
//       return;
//     }

//     const merged = [];

//     salesData.forEach((sale) => {
//       const stock = stockData.find(
//         (s) =>
//           s.Store === sale.Store &&
//           s.Division === sale.Division &&
//           s.Section === sale.Section &&
//           s.Department === sale.Department
//       );

//       const saleQty = Number(sale["Bill Quantity"]) || 0;
//       const stockQty = stock ? Number(stock["Closing Quantity"]) || 0 : 0;

//       merged.push({
//         Store: sale.Store,
//         Division: sale.Division,
//         Section: sale.Section,
//         Department: sale.Department,
//         SaleQty: saleQty,
//         StockLying: stockQty,
//         StockHolding: saleQty ? (stockQty / saleQty).toFixed(2) : "0",
//         StockVariance: stockQty - saleQty,
//       });
//     });

//     setReport(merged);

//     const varianceSummary = merged.reduce((acc, cur) => {
//       const key = cur.Division;
//       acc[key] = (acc[key] || 0) + cur.StockVariance;
//       return acc;
//     }, {});
//     setChartData(
//       Object.entries(varianceSummary).map(([division, variance]) => ({ division, variance }))
//     );
//   };

//   const filteredReport = report.filter((r) => {
//     return (
//       (!filters.store || r.Store === filters.store) &&
//       (!filters.division || r.Division === filters.division) &&
//       (!filters.department || r.Department === filters.department)
//     );
//   });

//   const stores = [...new Set(report.map((r) => r.Store))];
//   const divisions = [...new Set(report.map((r) => r.Division))];
//   const departments = [...new Set(report.map((r) => r.Department))];

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
//       <div className="max-w-6xl mx-auto bg-white shadow-2xl rounded-2xl p-6">
//         <h1 className="text-3xl font-bold mb-8 flex items-center gap-3 text-indigo-700">
//           <FileSpreadsheet className="w-7 h-7 text-indigo-600" />
//           Stock Gap Report Dashboard
//         </h1>

//         {/* Upload Section */}
//         <div className="flex flex-col sm:flex-row gap-6 mb-6">
//           <div className="flex-1">
//             <label className="font-semibold mb-1 block">Upload Sales Data</label>
//             <Input type="file" accept=".xlsx,.csv" onChange={(e) => handleFileUpload(e, "sales")} />
//           </div>
//           <div className="flex-1">
//             <label className="font-semibold mb-1 block">Upload Stock Data</label>
//             <Input type="file" accept=".xlsx,.csv" onChange={(e) => handleFileUpload(e, "stock")} />
//           </div>
//           <div className="flex items-end">
//             <Button onClick={generateReport} className="bg-indigo-600 hover:bg-indigo-700">
//               <Upload className="w-4 h-4 mr-2" /> Generate
//             </Button>
//           </div>
//         </div>

//         {/* Filters */}
//         {report.length > 0 && (
//           <div className="flex flex-wrap gap-4 mb-6 bg-indigo-50 p-4 rounded-xl">
//             <Select onValueChange={(v) => setFilters({ ...filters, store: v })}>
//               <SelectTrigger className="w-40">
//                 <SelectValue placeholder="Store" />
//               </SelectTrigger>
//               <SelectContent>
//                 {stores.map((s) => (
//                   <SelectItem key={s} value={s}>
//                     {s}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>

//             <Select onValueChange={(v) => setFilters({ ...filters, division: v })}>
//               <SelectTrigger className="w-40">
//                 <SelectValue placeholder="Division" />
//               </SelectTrigger>
//               <SelectContent>
//                 {divisions.map((s) => (
//                   <SelectItem key={s} value={s}>
//                     {s}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>

//             <Select onValueChange={(v) => setFilters({ ...filters, department: v })}>
//               <SelectTrigger className="w-40">
//                 <SelectValue placeholder="Department" />
//               </SelectTrigger>
//               <SelectContent>
//                 {departments.map((s) => (
//                   <SelectItem key={s} value={s}>
//                     {s}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>
//           </div>
//         )}

//         {/* Charts */}
//         {chartData.length > 0 && (
//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
//             <div className="bg-white p-4 shadow-md rounded-xl">
//               <h2 className="font-semibold mb-2 text-gray-700 flex items-center gap-2">
//                 <BarChart3 className="w-5 h-5" /> Stock Variance by Division
//               </h2>
//               <ResponsiveContainer width="100%" height={250}>
//                 <BarChart data={chartData}>
//                   <XAxis dataKey="division" />
//                   <YAxis />
//                   <Tooltip />
//                   <Legend />
//                   <Bar dataKey="variance" fill="#6366f1" />
//                 </BarChart>
//               </ResponsiveContainer>
//             </div>

//             <div className="bg-white p-4 shadow-md rounded-xl">
//               <h2 className="font-semibold mb-2 text-gray-700">Variance Pie Chart</h2>
//               <ResponsiveContainer width="100%" height={250}>
//                 <PieChart>
//                   <Pie
//                     dataKey="variance"
//                     data={chartData}
//                     nameKey="division"
//                     outerRadius={100}
//                     fill="#8884d8"
//                     label
//                   >
//                     {chartData.map((_, i) => (
//                       <Cell key={i} fill={COLORS[i % COLORS.length]} />
//                     ))}
//                   </Pie>
//                   <Tooltip />
//                 </PieChart>
//               </ResponsiveContainer>
//             </div>
//           </div>
//         )}

//         {/* Accordion Grouping */}
//         {filteredReport.length > 0 && (
//           <Accordion type="multiple" className="space-y-3">
//             {[...new Set(filteredReport.map((r) => r.Store))].map((store) => (
//               <AccordionItem key={store} value={store} className="border rounded-xl">
//                 <AccordionTrigger className="bg-indigo-100 px-4 py-2 font-semibold text-indigo-700">
//                   Store: {store}
//                 </AccordionTrigger>
//                 <AccordionContent>
//                   {[...new Set(filteredReport.filter((r) => r.Store === store).map((r) => r.Division))].map(
//                     (div) => (
//                       <AccordionItem key={div} value={div}>
//                         <AccordionTrigger className="bg-gray-50 px-4 py-2 text-gray-700">
//                           Division: {div}
//                         </AccordionTrigger>
//                         <AccordionContent>
//                           <table className="w-full border text-sm">
//                             <thead className="bg-gray-100">
//                               <tr>
//                                 <th className="border p-2">Section</th>
//                                 <th className="border p-2">Department</th>
//                                 <th className="border p-2">Sale Qty</th>
//                                 <th className="border p-2">Stock Lying</th>
//                                 <th className="border p-2">Stock Holding</th>
//                                 <th className="border p-2">Variance</th>
//                               </tr>
//                             </thead>
//                             <tbody>
//                               {filteredReport
//                                 .filter((r) => r.Store === store && r.Division === div)
//                                 .map((row, i) => (
//                                   <tr key={i} className="text-center">
//                                     <td className="border p-2">{row.Section}</td>
//                                     <td className="border p-2">{row.Department}</td>
//                                     <td className="border p-2">{row.SaleQty}</td>
//                                     <td className="border p-2">{row.StockLying}</td>
//                                     <td className="border p-2">{row.StockHolding}</td>
//                                     <td
//                                       className={`border p-2 font-semibold ${
//                                         row.StockVariance < 0
//                                           ? "text-red-600"
//                                           : "text-green-600"
//                                       }`}
//                                     >
//                                       {row.StockVariance}
//                                     </td>
//                                   </tr>
//                                 ))}
//                             </tbody>
//                           </table>
//                         </AccordionContent>
//                       </AccordionItem>
//                     )
//                   )}
//                 </AccordionContent>
//               </AccordionItem>
//             ))}
//           </Accordion>
//         )}
//       </div>
//     </div>
//   );
// }
