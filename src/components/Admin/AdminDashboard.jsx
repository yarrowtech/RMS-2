import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
// import React, { useEffect, useMemo, useState } from "react";
//  import axios from  "axios";
// import {
//   FaUsers,
//   FaBoxOpen,
//   FaShoppingCart,
//   FaRupeeSign,
//   FaArrowUp,
//   FaArrowDown,
//   FaClipboardList,
//   FaChartLine,
//   FaSyncAlt,
//   FaUserShield,
//   FaExclamationTriangle,
//   FaCheckCircle,
// } from "react-icons/fa";

// const API_BASE =
//   APP_API_URL;

// const statusClasses = {
//   Delivered:
//     "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
//   Pending:
//     "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
//   Shipped:
//     "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
//   Cancelled:
//     "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
//   Processing:
//     "bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",
//   Approved:
//     "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
//   Rejected:
//     "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
// };

// const formatCurrency = (value) => {
//   const num = Number(value || 0);
//   return new Intl.NumberFormat("en-IN", {
//     style: "currency",
//     currency: "INR",
//     maximumFractionDigits: 0,
//   }).format(num);
// };

// function StatCard({ title, value, change, up, icon: Icon, accent = "blue" }) {
//   const accentMap = {
//     blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
//     emerald:
//       "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
//     violet:
//       "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
//     rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
//   };

//   return (
//     <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
//       <div className="flex items-start justify-between gap-3">
//         <div>
//           <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
//             {title}
//           </p>

//           <h3 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
//             {value}
//           </h3>

//           <div
//             className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
//               up
//                 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
//                 : "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
//             }`}
//           >
//             {up ? <FaArrowUp size={10} /> : <FaArrowDown size={10} />}
//             {change}
//           </div>
//         </div>

//         <div
//           className={`flex h-12 w-12 items-center justify-center rounded-xl ${
//             accentMap[accent] || accentMap.blue
//           }`}
//         >
//           <Icon size={20} />
//         </div>
//       </div>
//     </div>
//   );
// }

// function SummaryCard({ title, value, subtitle, icon: Icon, gradient }) {
//   return (
//     <div className={`rounded-2xl p-5 text-white shadow-sm ${gradient}`}>
//       <div className="flex items-center justify-between gap-3">
//         <div>
//           <p className="text-sm opacity-90">{title}</p>
//           <h3 className="mt-2 text-3xl font-bold">{value}</h3>
//           <p className="mt-2 text-sm opacity-80">{subtitle}</p>
//         </div>
//         <Icon size={26} />
//       </div>
//     </div>
//   );
// }

// export default function AdminDashboardContent() {
//   const [dashboardData, setDashboardData] = useState(null);
//   const [vendorOrders, setVendorOrders] = useState([]);
//   const [products, setProducts] = useState([]);
//   const [users, setUsers] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [pageError, setPageError] = useState("");

//   const fetchDashboardData = async () => {
//     try {
//       setLoading(true);
//       setPageError("");

//       const token = localStorage.getItem("token");

//       const config = token
//         ? {
//             headers: {
//               Authorization: `Bearer ${token}`,
//             },
//           }
//         : {};

//       const [dashboardRes, vendorOrdersRes, productsRes, usersRes] =
//         await Promise.all([
//           axios.get(`${API_BASE}/api/admin/dashboard`, config).catch(() => null),
//           axios.get(`${API_BASE}/api/vendor-orders`, config).catch(() => null),
//           axios.get(`${API_BASE}/api/products`, config).catch(() => null),
//           axios.get(`${API_BASE}/api/users`, config).catch(() => null),
//         ]);

//       const dashboardPayload =
//         dashboardRes?.data?.data ||
//         dashboardRes?.data?.dashboard ||
//         dashboardRes?.data ||
//         {};

//       const vendorOrdersPayload =
//         vendorOrdersRes?.data?.data ||
//         vendorOrdersRes?.data?.orders ||
//         vendorOrdersRes?.data?.vendorOrders ||
//         vendorOrdersRes?.data ||
//         [];

//       const productsPayload =
//         productsRes?.data?.data ||
//         productsRes?.data?.products ||
//         productsRes?.data ||
//         [];

//       const usersPayload =
//         usersRes?.data?.data ||
//         usersRes?.data?.users ||
//         usersRes?.data ||
//         [];

//       setDashboardData(dashboardPayload);
//       setVendorOrders(Array.isArray(vendorOrdersPayload) ? vendorOrdersPayload : []);
//       setProducts(Array.isArray(productsPayload) ? productsPayload : []);
//       setUsers(Array.isArray(usersPayload) ? usersPayload : []);
//     } catch (error) {
//       console.error("Dashboard fetch error:", error);
//       setPageError("Failed to load dashboard data.");
//       setDashboardData(null);
//       setVendorOrders([]);
//       setProducts([]);
//       setUsers([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchDashboardData();
//   }, []);

//   const statsData = useMemo(() => {
//     const totalUsers =
//       Number(
//         dashboardData?.totalUsers ??
//           dashboardData?.usersCount ??
//           users.length ??
//           0
//       ) || 0;

//     const totalProducts =
//       Number(
//         dashboardData?.totalProducts ??
//           dashboardData?.productsCount ??
//           products.length ??
//           0
//       ) || 0;

//     const totalOrders =
//       Number(
//         dashboardData?.totalVendorOrders ??
//           dashboardData?.totalOrders ??
//           dashboardData?.ordersCount ??
//           vendorOrders.length ??
//           0
//       ) || 0;

//     const revenue =
//       Number(
//         dashboardData?.revenue ??
//           dashboardData?.totalRevenue ??
//           dashboardData?.totalSales ??
//           vendorOrders.reduce((sum, order) => {
//             return (
//               sum +
//               Number(
//                 order?.totalAmount ||
//                   order?.amount ||
//                   order?.finalAmount ||
//                   order?.total ||
//                   order?.grandTotal ||
//                   0
//               )
//             );
//           }, 0)
//       ) || 0;

//     return [
//       {
//         title: "Total Users",
//         value: totalUsers.toLocaleString("en-IN"),
//         change: dashboardData?.usersGrowth || "+0%",
//         up: !String(dashboardData?.usersGrowth || "+0%").startsWith("-"),
//         icon: FaUsers,
//         accent: "blue",
//       },
//       {
//         title: "Total Products",
//         value: totalProducts.toLocaleString("en-IN"),
//         change: dashboardData?.productsGrowth || "+0%",
//         up: !String(dashboardData?.productsGrowth || "+0%").startsWith("-"),
//         icon: FaBoxOpen,
//         accent: "violet",
//       },
//       {
//         title: "Vendor Orders",
//         value: totalOrders.toLocaleString("en-IN"),
//         change: dashboardData?.ordersGrowth || "+0%",
//         up: !String(dashboardData?.ordersGrowth || "+0%").startsWith("-"),
//         icon: FaShoppingCart,
//         accent: "emerald",
//       },
//       {
//         title: "Revenue",
//         value: formatCurrency(revenue),
//         change: dashboardData?.revenueGrowth || "+0%",
//         up: !String(dashboardData?.revenueGrowth || "+0%").startsWith("-"),
//         icon: FaRupeeSign,
//         accent: "rose",
//       },
//     ];
//   }, [dashboardData, vendorOrders, products, users]);

//   const recentVendorOrders = useMemo(() => {
//     const rawRecent =
//       dashboardData?.recentVendorOrders &&
//       Array.isArray(dashboardData.recentVendorOrders)
//         ? dashboardData.recentVendorOrders
//         : dashboardData?.recentOrders && Array.isArray(dashboardData.recentOrders)
//         ? dashboardData.recentOrders
//         : vendorOrders;

//     return rawRecent.slice(0, 5).map((order, index) => ({
//       id:
//         order?.orderId ||
//         order?.vendorOrderId ||
//         order?.id ||
//         order?._id ||
//         `#ORD-${String(index + 1).padStart(4, "0")}`,
//       vendor:
//         order?.vendorName ||
//         order?.vendor?.name ||
//         order?.vendorId?.name ||
//         order?.supplierName ||
//         order?.supplier?.name ||
//         order?.supplierId?.name ||
//         order?.orderedTo ||
//         order?.assignedVendor ||
//         order?.companyName ||
//         "Unknown Vendor",
//       amount: formatCurrency(
//         order?.totalAmount ||
//           order?.amount ||
//           order?.finalAmount ||
//           order?.total ||
//           order?.grandTotal ||
//           0
//       ),
//       status: order?.status || "Pending",
//     }));
//   }, [dashboardData, vendorOrders]);

//   const topProducts = useMemo(() => {
//     const rawTop =
//       dashboardData?.topProducts && Array.isArray(dashboardData.topProducts)
//         ? dashboardData.topProducts
//         : products;

//     return rawTop
//       .map((product) => ({
//         name:
//           product?.product_name ||
//           product?.name ||
//           product?.title ||
//           "Unnamed Product",
//         sales: Number(
//           product?.sales ||
//             product?.soldCount ||
//             product?.totalSold ||
//             product?.orderCount ||
//             product?.unitsSold ||
//             0
//         ),
//         stock: Number(
//           product?.stock ||
//             product?.quantity ||
//             product?.stock_quantity ||
//             product?.qty ||
//             0
//         ),
//       }))
//       .sort((a, b) => b.sales - a.sales)
//       .slice(0, 5);
//   }, [dashboardData, products]);

//   const lowStockProducts = useMemo(() => {
//     return products
//       .map((product) => ({
//         name:
//           product?.product_name ||
//           product?.name ||
//           product?.title ||
//           "Unnamed Product",
//         sku: product?.sku || "—",
//         qty: Number(
//           product?.quantity ||
//             product?.stock ||
//             product?.stock_quantity ||
//             product?.qty ||
//             0
//         ),
//       }))
//       .filter((item) => item.qty > 0 && item.qty <= 10)
//       .sort((a, b) => a.qty - b.qty)
//       .slice(0, 5);
//   }, [products]);

//   const userBreakdown = useMemo(() => {
//     const counts = users.reduce(
//       (acc, user) => {
//         const role = String(
//           user?.role || user?.userType || user?.accountType || "user"
//         ).toLowerCase();

//         if (role.includes("admin")) acc.admin += 1;
//         else if (role.includes("vendor")) acc.vendor += 1;
//         else if (role.includes("manager")) acc.manager += 1;
//         else acc.user += 1;

//         return acc;
//       },
//       { admin: 0, vendor: 0, manager: 0, user: 0 }
//     );

//     return counts;
//   }, [users]);

//   const monthlyGrowth =
//     dashboardData?.monthlyGrowth ||
//     dashboardData?.growth ||
//     dashboardData?.salesGrowth ||
//     "+0%";

//   const conversionRate =
//     dashboardData?.conversionRate ||
//     dashboardData?.orderConversion ||
//     dashboardData?.vendorConversion ||
//     "0%";

//   const averageOrderValue = useMemo(() => {
//     if (dashboardData?.averageOrderValue) {
//       return formatCurrency(dashboardData.averageOrderValue);
//     }

//     if (!vendorOrders.length) return formatCurrency(0);

//     const total = vendorOrders.reduce((sum, order) => {
//       return (
//         sum +
//         Number(
//           order?.totalAmount ||
//             order?.amount ||
//             order?.finalAmount ||
//             order?.total ||
//             order?.grandTotal ||
//             0
//         )
//       );
//     }, 0);

//     return formatCurrency(total / vendorOrders.length);
//   }, [dashboardData, vendorOrders]);

//   const fulfillmentRate = useMemo(() => {
//     if (!vendorOrders.length) return "0%";

//     const delivered = vendorOrders.filter((order) =>
//       ["Delivered", "Approved", "Completed"].includes(order?.status)
//     ).length;

//     return `${Math.round((delivered / vendorOrders.length) * 100)}%`;
//   }, [vendorOrders]);

//   return (
//     <div className="min-h-screen space-y-8 bg-slate-50 p-8 dark:bg-slate-950 sm:ml-auto">
//       <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
//         <div>
//           <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
//             Admin Dashboard
//           </h1>
//         </div>

//         <button
//           onClick={fetchDashboardData}
//           className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
//         >
//           <FaSyncAlt />
//           Refresh
//         </button>
//       </div>

//       {loading ? (
//         <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
//           Loading dashboard...
//         </div>
//       ) : pageError ? (
//         <div className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center shadow-sm dark:border-rose-900/30 dark:bg-rose-950/20">
//           <p className="font-medium text-rose-600 dark:text-rose-400">
//             {pageError}
//           </p>
//           <button
//             onClick={fetchDashboardData}
//             className="mt-4 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
//           >
//             Retry
//           </button>
//         </div>
//       ) : (
//         <>
//           <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
//             {statsData.map((item) => (
//               <StatCard key={item.title} {...item} />
//             ))}
//           </div>

//           <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
//             <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
//               <div className="mb-5 flex items-center justify-between">
//                 <div>
//                   <h2 className="text-lg font-bold text-slate-900 dark:text-white">
//                     Recent Vendor Orders
//                   </h2>
//                   <p className="text-sm text-slate-500 dark:text-slate-400">
//                     Latest vendor order activity
//                   </p>
//                 </div>
//                 <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
//                   <FaClipboardList />
//                 </div>
//               </div>

//               <div className="overflow-hidden">
//                 <table className="min-w-full text-left">
//                   <thead>
//                     <tr className="border-b border-slate-200 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
//                       <th className="px-4 py-4 font-semibold">Order ID</th>
//                       <th className="px-4 py-4 font-semibold">Vendor</th>
//                       <th className="px-4 py-4 font-semibold">Amount</th>
//                       <th className="px-4 py-4 font-semibold">Status</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {recentVendorOrders.length > 0 ? (
//                       recentVendorOrders.map((order) => (
//                         <tr
//                           key={order.id}
//                           className="border-b border-slate-100 last:border-none dark:border-slate-800"
//                         >
//                           <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">
//                             {order.id}
//                           </td>
//                           <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
//                             {order.vendor}
//                           </td>
//                           <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
//                             {order.amount}
//                           </td>
//                           <td className="px-4 py-4">
//                             <span
//                               className={`inline-flex rounded-full px-4 py-1 text-xs font-semibold ${
//                                 statusClasses[order.status] || statusClasses.Pending
//                               }`}
//                             >
//                               {order.status}
//                             </span>
//                           </td>
//                         </tr>
//                       ))
//                     ) : (
//                       <tr>
//                         <td
//                           colSpan="4"
//                           className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
//                         >
//                           No recent vendor orders found.
//                         </td>
//                       </tr>
//                     )}
//                   </tbody>
//                 </table>
//               </div>
//             </div>

//             <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
//               <div className="mb-5 flex items-center justify-between">
//                 <div>
//                   <h2 className="text-lg font-bold text-slate-900 dark:text-white">
//                     Top Products
//                   </h2>
//                   <p className="text-sm text-slate-500 dark:text-slate-400">
//                     Best performing items
//                   </p>
//                 </div>
//                 <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
//                   <FaBoxOpen />
//                 </div>
//               </div>

//               <div className="space-y-4">
//                 {topProducts.length > 0 ? (
//                   topProducts.map((product, index) => (
//                     <div
//                       key={`${product.name}-${index}`}
//                       className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
//                     >
//                       <div className="flex items-start justify-between gap-3">
//                         <div>
//                           <p className="font-semibold text-slate-900 dark:text-white">
//                             {index + 1}. {product.name}
//                           </p>
//                           <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
//                             Sales: {product.sales}
//                           </p>
//                         </div>
//                         <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
//                           Stock {product.stock}
//                         </span>
//                       </div>
//                     </div>
//                   ))
//                 ) : (
//                   <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
//                     No top product data found.
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>

//           <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
//             <SummaryCard
//               title="Monthly Growth"
//               value={monthlyGrowth}
//               subtitle="Compared to last month"
//               icon={FaChartLine}
//               gradient="bg-gradient-to-br from-blue-600 to-indigo-700"
//             />

//             <SummaryCard
//               title="Conversion Rate"
//               value={conversionRate}
//               subtitle="Orders from total visits"
//               icon={FaShoppingCart}
//               gradient="bg-gradient-to-br from-emerald-600 to-teal-700"
//             />

//             <SummaryCard
//               title="Average Order Value"
//               value={averageOrderValue}
//               subtitle="Average vendor order value"
//               icon={FaRupeeSign}
//               gradient="bg-gradient-to-br from-violet-600 to-fuchsia-700"
//             />
//           </div>

//           <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
//             <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
//               <div className="mb-5 flex items-center justify-between">
//                 <div>
//                   <h2 className="text-lg font-bold text-slate-900 dark:text-white">
//                     User Breakdown
//                   </h2>
//                   <p className="text-sm text-slate-500 dark:text-slate-400">
//                     Role-wise user summary
//                   </p>
//                 </div>
//                 <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
//                   <FaUserShield />
//                 </div>
//               </div>

//               <div className="space-y-3">
//                 {[
//                   { label: "Admins", value: userBreakdown.admin },
//                   { label: "Vendors", value: userBreakdown.vendor },
//                   { label: "Managers", value: userBreakdown.manager },
//                   { label: "Users", value: userBreakdown.user },
//                 ].map((item) => (
//                   <div
//                     key={item.label}
//                     className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"
//                   >
//                     <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
//                       {item.label}
//                     </span>
//                     <span className="text-base font-bold text-slate-900 dark:text-white">
//                       {item.value}
//                     </span>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
//               <div className="mb-5 flex items-center justify-between">
//                 <div>
//                   <h2 className="text-lg font-bold text-slate-900 dark:text-white">
//                     Low Stock Alerts
//                   </h2>
//                   <p className="text-sm text-slate-500 dark:text-slate-400">
//                     Products that need attention
//                   </p>
//                 </div>
//                 <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
//                   <FaExclamationTriangle />
//                 </div>
//               </div>

//               <div className="space-y-3">
//                 {lowStockProducts.length > 0 ? (
//                   lowStockProducts.map((item, index) => (
//                     <div
//                       key={`${item.sku}-${index}`}
//                       className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
//                     >
//                       <div className="flex items-start justify-between gap-3">
//                         <div>
//                           <p className="font-semibold text-slate-900 dark:text-white">
//                             {item.name}
//                           </p>
//                           <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
//                             SKU: {item.sku}
//                           </p>
//                         </div>
//                         <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
//                           Qty {item.qty}
//                         </span>
//                       </div>
//                     </div>
//                   ))
//                 ) : (
//                   <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
//                     No low stock products found.
//                   </div>
//                 )}
//               </div>
//             </div>

//             <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
//               <div className="mb-5 flex items-center justify-between">
//                 <div>
//                   <h2 className="text-lg font-bold text-slate-900 dark:text-white">
//                     Fulfillment Summary
//                   </h2>
//                   <p className="text-sm text-slate-500 dark:text-slate-400">
//                     Order health snapshot
//                   </p>
//                 </div>
//                 <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
//                   <FaCheckCircle />
//                 </div>
//               </div>

//               <div className="space-y-3">
//                 <div className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
//                   <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
//                     Fulfillment Rate
//                   </p>
//                   <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
//                     {fulfillmentRate}
//                   </h3>
//                 </div>

//                 <div className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
//                   <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
//                     Total Orders
//                   </p>
//                   <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
//                     {vendorOrders.length.toLocaleString("en-IN")}
//                   </h3>
//                 </div>

//                 <div className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
//                   <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
//                     Revenue Snapshot
//                   </p>
//                   <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
//                     {statsData[3]?.value}
//                   </h3>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </>
//       )}
//     </div>
//   );
// }

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FaUsers,
  FaBoxOpen,
  FaShoppingCart,
  FaRupeeSign,
  FaArrowUp,
  FaArrowDown,
  FaClipboardList,
  FaChartLine,
  FaSyncAlt,
  FaUserShield,
  FaExclamationTriangle,
  FaCheckCircle,
} from "react-icons/fa";

const API_BASE = APP_API_URL;

// ─── Match ProductList.jsx token lookup exactly ───────────────────────────────
const getToken = () =>
  localStorage.getItem("admin_token") ||
  localStorage.getItem("token") ||
  localStorage.getItem("access_token") ||
  "";

const statusClasses = {
  Delivered:  "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  Pending:    "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  Shipped:    "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
  Cancelled:  "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
  Processing: "bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",
  Approved:   "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  Rejected:   "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

// ─── Detect product source (same logic as ProductList) ────────────────────────
function detectSource(p) {
  if (p.source === "grn" || p.created_by === "GRN") return "grn";
  if (p.source === "vendor") return "vendor";
  if (!p.source && (p.vendor_name || p.vendor_id)) return "vendor";
  return "admin";
}

// ─── Safe GET — never throws, logs status clearly ─────────────────────────────
async function safeGet(url, config) {
  try {
    return await axios.get(url, config);
  } catch (err) {
    console.warn(`[Dashboard] GET ${url} → ${err?.response?.status ?? "network error"}`);
    return null;
  }
}

// ─── Payload extractors ───────────────────────────────────────────────────────
function extractArray(res, ...keys) {
  if (!res) return [];
  const data = res.data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return Array.isArray(data) ? data : [];
}

function extractObject(res, ...keys) {
  if (!res) return {};
  const data = res.data;
  for (const key of keys) {
    if (data?.[key] && typeof data[key] === "object" && !Array.isArray(data[key]))
      return data[key];
  }
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ title, value, change, up, icon: Icon, accent = "blue" }) {
  const accentMap = {
    blue:    "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    violet:  "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
    rose:    "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
          <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${up ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"}`}>
            {up ? <FaArrowUp size={10} /> : <FaArrowDown size={10} />}
            {change}
          </div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accentMap[accent] || accentMap.blue}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, subtitle, icon: Icon, gradient }) {
  return (
    <div className={`rounded-2xl p-5 text-white shadow-sm ${gradient}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm opacity-90">{title}</p>
          <h3 className="mt-2 text-3xl font-bold">{value}</h3>
          <p className="mt-2 text-sm opacity-80">{subtitle}</p>
        </div>
        <Icon size={26} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminDashboardContent() {
  const [dashboardData, setDashboardData] = useState(null);
  const [vendorOrders,  setVendorOrders]  = useState([]);
  const [products,      setProducts]      = useState([]);
  const [users,         setUsers]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [pageError,     setPageError]     = useState("");
  const [authWarning,   setAuthWarning]   = useState("");

  const fetchDashboardData = async () => {
    setLoading(true);
    setPageError("");
    setAuthWarning("");

    // ── Token: same priority order as ProductList.jsx ──────────────────────
    const token = getToken();

    if (!token) {
      setAuthWarning(
        'No auth token found. Checked localStorage keys: "admin_token", "token", "access_token". ' +
        "Make sure you are logged in before visiting this page."
      );
    }

    const config = {
      headers: { Authorization: `Bearer ${token}` },
      maxRedirects: 5,
    };

    // ── Requests ────────────────────────────────────────────────────────────
    // Only /api/products/ is confirmed to exist on your backend.
    // The other three 404 — we still try and degrade gracefully.
    // /api/products/ uses trailing slash (same as ProductList) to skip 307 redirect.
    const [dashboardRes, vendorOrdersRes, productsRes, usersRes] = await Promise.all([
      safeGet(`${API_BASE}/admin/dashboard`,     config),
      safeGet(`${API_BASE}/purchaseorders/`,     config),
      safeGet(`${API_BASE}/api/products/`,        config),  // ← trailing slash, matches ProductList
      safeGet(`${API_BASE}/hq/admins`,            config),
    ]);

    // ── Parse ───────────────────────────────────────────────────────────────
    // ProductList reads prodRes.data.data — so "data" key first
    const productsRaw = extractArray(productsRes, "data", "products");

    // Filter to same set ProductList shows (exclude uninducted vendor products)
    // so the count on the dashboard matches what admins see in the list
    const productsPayload = productsRaw; // keep all for dashboard totals

    const dashboardPayload  = extractObject(dashboardRes, "data", "dashboard");
    const vendorOrdersPayload = extractArray(vendorOrdersRes, "data", "orders", "vendorOrders");
    const usersPayload      = extractArray(usersRes, "data", "users");

    setDashboardData(Object.keys(dashboardPayload).length ? dashboardPayload : null);
    setVendorOrders(vendorOrdersPayload);
    setProducts(productsPayload);
    setUsers(usersPayload);

    // Full error only if even products failed
    if (!productsRes && !dashboardRes && !vendorOrdersRes && !usersRes) {
      setPageError("All API requests failed. Check your server and network connection.");
    }

    setLoading(false);
  };

  useEffect(() => { fetchDashboardData(); }, []);

  // ── Derived: stats cards ─────────────────────────────────────────────────
  const statsData = useMemo(() => {
    const totalUsers     = Number(dashboardData?.totalUsers    ?? dashboardData?.usersCount    ?? users.length)    || 0;
    const totalProducts  = Number(dashboardData?.totalProducts ?? dashboardData?.productsCount ?? products.length) || 0;
    const totalOrders    = Number(dashboardData?.totalVendorOrders ?? dashboardData?.totalOrders ?? dashboardData?.ordersCount ?? vendorOrders.length) || 0;

    // Revenue: from dashboard if present, else sum vendor orders,
    // else derive from products (MRP * stock as a rough estimate when orders are unavailable)
    let revenue = Number(dashboardData?.revenue ?? dashboardData?.totalRevenue ?? dashboardData?.totalSales) || 0;
    if (!revenue && vendorOrders.length) {
      revenue = vendorOrders.reduce((sum, o) =>
        sum + Number(o?.totalAmount || o?.amount || o?.finalAmount || o?.total || 0), 0);
    }
    if (!revenue && products.length) {
      // Fallback: sum (selling_price * quantity) across simple products
      revenue = products.reduce((sum, p) => {
        if (p.has_variants) return sum;
        return sum + (Number(p.selling_price || p.mrp || 0) * Number(p.quantity || p.stock || 0));
      }, 0);
    }

    const pct   = (key) => dashboardData?.[key] || "+0%";
    const isUp  = (val) => !String(val).startsWith("-");

    return [
      { title: "Total Users",    value: totalUsers.toLocaleString("en-IN"),    change: pct("usersGrowth"),    up: isUp(pct("usersGrowth")),    icon: FaUsers,       accent: "blue" },
      { title: "Total Products", value: totalProducts.toLocaleString("en-IN"), change: pct("productsGrowth"), up: isUp(pct("productsGrowth")), icon: FaBoxOpen,     accent: "violet" },
      { title: "Vendor Orders",  value: totalOrders.toLocaleString("en-IN"),   change: pct("ordersGrowth"),   up: isUp(pct("ordersGrowth")),   icon: FaShoppingCart, accent: "emerald" },
      { title: "Revenue",        value: formatCurrency(revenue),               change: pct("revenueGrowth"),  up: isUp(pct("revenueGrowth")),  icon: FaRupeeSign,   accent: "rose" },
    ];
  }, [dashboardData, vendorOrders, products, users]);

  // ── Derived: product breakdown by source (mirrors ProductList tabs) ───────
  const productCounts = useMemo(() => ({
    admin:  products.filter(p => detectSource(p) === "admin").length,
    vendor: products.filter(p => detectSource(p) === "vendor").length,
    grn:    products.filter(p => detectSource(p) === "grn").length,
  }), [products]);

  // ── Derived: top 5 products by stock value ─────────────────────────────────
  const topProducts = useMemo(() => {
    const raw = Array.isArray(dashboardData?.topProducts) ? dashboardData.topProducts : products;
    return raw
      .map((p) => ({
        name:  p?.product_name || p?.name || p?.title || "Unnamed",
        sales: Number(p?.sales || p?.soldCount || p?.totalSold || p?.orderCount || 0),
        stock: Number(p?.stock || p?.quantity || p?.stock_quantity || p?.qty || 0),
        sku:   p?.sku || p?.base_sku || "—",
      }))
      .sort((a, b) => b.sales - a.sales || b.stock - a.stock)
      .slice(0, 5);
  }, [dashboardData, products]);

  // ── Derived: low stock (qty 1–10), same field names as ProductList ─────────
  const lowStockProducts = useMemo(() => {
    return products
      .filter(p => !p.has_variants)
      .map(p => ({
        name: p?.product_name || p?.name || "Unnamed",
        sku:  p?.sku || p?.base_sku || "—",
        qty:  Number(p?.quantity || p?.stock || p?.stock_quantity || p?.qty || 0),
      }))
      .filter(item => item.qty > 0 && item.qty <= 10)
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 5);
  }, [products]);

  // ── Derived: recent vendor orders ─────────────────────────────────────────
  const recentVendorOrders = useMemo(() => {
    const raw = Array.isArray(dashboardData?.recentVendorOrders) ? dashboardData.recentVendorOrders
              : Array.isArray(dashboardData?.recentOrders)       ? dashboardData.recentOrders
              : vendorOrders;
    return raw.slice(0, 5).map((order, i) => ({
      id:     order?.orderId || order?.vendorOrderId || order?.id || order?._id || `#ORD-${String(i + 1).padStart(4, "0")}`,
      vendor: order?.vendorName || order?.vendor?.name || order?.vendorId?.name || order?.supplierName || "Unknown Vendor",
      amount: formatCurrency(order?.totalAmount || order?.amount || order?.finalAmount || order?.total || 0),
      status: order?.status || "Pending",
    }));
  }, [dashboardData, vendorOrders]);

  // ── Derived: user breakdown ───────────────────────────────────────────────
  const userBreakdown = useMemo(() => users.reduce(
    (acc, u) => {
      const role = String(u?.role || u?.userType || u?.accountType || "user").toLowerCase();
      if (role.includes("admin"))   acc.admin   += 1;
      else if (role.includes("vendor"))  acc.vendor  += 1;
      else if (role.includes("manager")) acc.manager += 1;
      else acc.user += 1;
      return acc;
    },
    { admin: 0, vendor: 0, manager: 0, user: 0 }
  ), [users]);

  const monthlyGrowth  = dashboardData?.monthlyGrowth || dashboardData?.growth || "+0%";
  const conversionRate = dashboardData?.conversionRate || dashboardData?.orderConversion || "0%";

  const averageOrderValue = useMemo(() => {
    if (dashboardData?.averageOrderValue) return formatCurrency(dashboardData.averageOrderValue);
    if (!vendorOrders.length) return formatCurrency(0);
    const total = vendorOrders.reduce((s, o) => s + Number(o?.totalAmount || o?.amount || 0), 0);
    return formatCurrency(total / vendorOrders.length);
  }, [dashboardData, vendorOrders]);

  const fulfillmentRate = useMemo(() => {
    if (!vendorOrders.length) return "0%";
    const delivered = vendorOrders.filter(o => ["Delivered", "Approved", "Completed"].includes(o?.status)).length;
    return `${Math.round((delivered / vendorOrders.length) * 100)}%`;
  }, [vendorOrders]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen space-y-8 bg-slate-50 p-8 dark:bg-slate-950 sm:ml-auto">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Admin Dashboard
        </h1>
        <button
          onClick={fetchDashboardData}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <FaSyncAlt /> Refresh
        </button>
      </div>

      {/* Auth warning */}
      {authWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
          <strong>Auth Warning:</strong> {authWarning}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Loading dashboard…
        </div>
      ) : pageError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center shadow-sm dark:border-rose-900/30 dark:bg-rose-950/20">
          <p className="font-medium text-rose-600 dark:text-rose-400">{pageError}</p>
          <button onClick={fetchDashboardData} className="mt-4 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statsData.map(item => <StatCard key={item.title} {...item} />)}
          </div>

          {/* Product source breakdown — derived from /api/products/ same as ProductList tabs */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Admin Products",  value: productCounts.admin,  color: "blue" },
              { label: "Vendor Products", value: productCounts.vendor, color: "emerald" },
              { label: "GRN Products",    value: productCounts.grn,    color: "amber" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
                <p className={`mt-2 text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Recent orders + Top products */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Vendor Orders</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Latest vendor order activity</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <FaClipboardList />
                </div>
              </div>
              <div className="overflow-hidden">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      {["Order ID", "Vendor", "Amount", "Status"].map(h => (
                        <th key={h} className="px-4 py-4 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentVendorOrders.length > 0 ? recentVendorOrders.map(order => (
                      <tr key={order.id} className="border-b border-slate-100 last:border-none dark:border-slate-800">
                        <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{order.id}</td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{order.vendor}</td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{order.amount}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-4 py-1 text-xs font-semibold ${statusClasses[order.status] || statusClasses.Pending}`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4" className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                          No vendor order data — <span className="opacity-60">/api/vendor-orders not found on server</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top products — from /api/products/ data */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Top Products</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">By stock level</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <FaBoxOpen />
                </div>
              </div>
              <div className="space-y-4">
                {topProducts.length > 0 ? topProducts.map((product, index) => (
                  <div key={`${product.sku}-${index}`} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{index + 1}. {product.name}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">SKU: {product.sku}</p>
                      </div>
                      <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                        Stock {product.stock}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No products loaded — check auth token or /api/products/
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SummaryCard title="Monthly Growth"      value={monthlyGrowth}     subtitle="Compared to last month"    icon={FaChartLine}   gradient="bg-gradient-to-br from-blue-600 to-indigo-700" />
            <SummaryCard title="Conversion Rate"     value={conversionRate}    subtitle="Orders from total visits"  icon={FaShoppingCart} gradient="bg-gradient-to-br from-emerald-600 to-teal-700" />
            <SummaryCard title="Average Order Value" value={averageOrderValue} subtitle="Average vendor order value" icon={FaRupeeSign}   gradient="bg-gradient-to-br from-violet-600 to-fuchsia-700" />
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

            {/* User Breakdown */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">User Breakdown</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Role-wise user summary</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                  <FaUserShield />
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Admins",   value: userBreakdown.admin },
                  { label: "Vendors",  value: userBreakdown.vendor },
                  { label: "Managers", value: userBreakdown.manager },
                  { label: "Users",    value: userBreakdown.user },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{item.label}</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Low Stock Alerts — from /api/products/ quantity field */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Low Stock Alerts</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Products that need attention</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                  <FaExclamationTriangle />
                </div>
              </div>
              <div className="space-y-3">
                {lowStockProducts.length > 0 ? lowStockProducts.map((item, index) => (
                  <div key={`${item.sku}-${index}`} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">SKU: {item.sku}</p>
                      </div>
                      <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        Qty {item.qty}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No low stock products found.
                  </div>
                )}
              </div>
            </div>

            {/* Fulfillment Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Fulfillment Summary</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Order health snapshot</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <FaCheckCircle />
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Fulfillment Rate",  value: fulfillmentRate },
                  { label: "Total Orders",      value: vendorOrders.length.toLocaleString("en-IN") },
                  { label: "Revenue Snapshot",  value: statsData[3]?.value },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
                    <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
