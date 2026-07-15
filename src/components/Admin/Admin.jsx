

// import React, { Suspense, useMemo, useState } from "react";
import { logoutOrReturnToDepartmentSelector } from "../../utils/authRedirect";
// import { FaBars } from "react-icons/fa";
// import { Settings as SettingsIcon } from "lucide-react";
// import AdminSidebar from "./AdminSidebar";
// import AdminSettings from "./AdminSettings";
// import AdminDashboard from "./AdminDashboard";
// import AdminProduct from "./AdminProduct";
// import ProductMapping from "./ProductMapping";
// import SalesReport from "./SalesReport";
// import InventoryManagementCurrentStockList from "../InventoryManagement/InventoryManagementCurrentStockList";
// import HQSetup from "./HQSetup";

// // ─── Store context from localStorage ─────────────────────────────────────────
// const storeId   = localStorage.getItem("admin_store_id")   || "";
// const storeName = localStorage.getItem("admin_store_name") || "";
// const tenantId  = localStorage.getItem("admin_tenant_id")  || "";
// const scope     = localStorage.getItem("admin_scope")      || "hq";
// const isHQ      = scope === "hq";
// const isStore   = scope === "store";

// const COMPANY_NAME = "RMS";

// function labelFromKey(key) {
//   const labels = {
//     "dashboard":             "Dashboard",
//     "__settings":            "Settings",
//     // HQ
//     "products":              "Products",
//     "productMapping":        "Product Mapping",
//     "stockAllocation":       "Stock Allocation",
//     "purchaseOrders":        "Purchase Orders",
//     "grn":                   "GRN / Receiving",
//     "reports":               "Sales Reports",
//     "users.vendor":          "Vendor",
//     "users.hr":              "HR",
//     "users.inventoryManager":"Inventory Manager",
//     "users.cashier":         "Cashier",
//     "users.logistics":       "Logistics",
//     // Store
//     "storeStock":            "Store Stock",
//     "storeSales":            "Sales Report",
//     "storeCashier":          "Cashier / POS",
//     "storeStaff":            "Staff Management",
//     "storeOrders":           "Orders",
//     // Setup
//     "setup":                 "Setup — Stores & Admins",
//   };
//   return labels[key] || "Admin Panel";
// }

// function PageLoader() {
//   return (
//     <div className="p-6">
//       <p className="text-sm font-semibold text-slate-900">Loading…</p>
//     </div>
//   );
// }

// function MinimalPlaceholder({ title, subtitle, badge }) {
//   return (
//     <div className="p-6">
//       <div className="flex items-center gap-3 mb-2">
//         <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
//         {badge && (
//           <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
//             {badge}
//           </span>
//         )}
//       </div>
//       <p className="mt-1 text-sm text-slate-700">{subtitle || "Content will go here."}</p>
//       <div className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-4">
//         <p className="text-xs font-semibold text-slate-600">
//           Active: <span className="text-slate-900">{title}</span>
//         </p>
//         {isStore && (
//           <p className="text-xs text-indigo-600 mt-1">
//             🏪 Scoped to: <strong>{storeName}</strong>
//           </p>
//         )}
//       </div>
//     </div>
//   );
// }

// function StoreBanner() {
//   if (isHQ) return null;
//   return (
//     <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
//       <span className="text-lg">🏪</span>
//       <div>
//         <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Store Admin</p>
//         <p className="text-sm font-bold text-indigo-900">{storeName}</p>
//       </div>
//       <span className="ml-auto px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold capitalize">
//         {scope}
//       </span>
//     </div>
//   );
// }

// export default function AdminModule() {
//   const defaultTab = isStore ? "storeStock" : "dashboard";

//   const [active, setActive]                         = useState(defaultTab);
//   const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
//   const [drawerOpen, setDrawerOpen]                 = useState(false);

//   const pageTitle = useMemo(() => labelFromKey(active), [active]);

//   const handleLogout = () => {
//     localStorage.clear();
//     window.location.href = "/admin/login";
//   };

//   const onSettingsClick = () => setActive("__settings");

//   const renderPage = () => {
//     if (active === "__settings") return <AdminSettings />;

//     // ── HQ ADMIN ─────────────────────────────────────────────────────────────
//     if (isHQ) {
//       switch (active) {
//         case "dashboard":
//           return <AdminDashboard />;

//         case "setup":
//           return <HQSetup />;

//         case "products":
//           return <AdminProduct />;

//         case "productMapping":
//           return <ProductMapping />;

//         case "stockAllocation":
//           // InventoryManagementCurrentStockList handles isHQ internally:
//           // shows Central Stock + Allocate to Store tabs
//           return <InventoryManagementCurrentStockList />;

//         case "purchaseOrders":
//           return (
//             <MinimalPlaceholder
//               title="Purchase Orders"
//               subtitle="Create and manage purchase orders to vendors."
//             />
//           );

//         case "grn":
//           return (
//             <MinimalPlaceholder
//               title="GRN / Receiving"
//               subtitle="Goods Received Notes — confirm and record incoming stock."
//             />
//           );

//         case "reports":
//           return <SalesReport />;

//         case "users.vendor":
//           return (
//             <MinimalPlaceholder
//               title="Vendor"
//               subtitle="Vendor users list, permissions, onboarding, and access control."
//             />
//           );

//         case "users.hr":
//           return (
//             <MinimalPlaceholder
//               title="HR"
//               subtitle="HR users list, attendance access, payroll access, and HR permissions."
//             />
//           );

//         case "users.inventoryManager":
//           return (
//             <MinimalPlaceholder
//               title="Inventory Manager"
//               subtitle="Inventory manager users, role permissions, and access to stock modules."
//             />
//           );

//         case "users.cashier":
//           return (
//             <MinimalPlaceholder
//               title="Cashier"
//               subtitle="Cashier users, POS permissions, counter mapping, and device access."
//             />
//           );

//         case "users.logistics":
//           return (
//             <MinimalPlaceholder
//               title="Logistics"
//               subtitle="Shipments, tracking, pickup/manifest, courier serviceability, NDR & RTO."
//             />
//           );

//         default:
//           return <MinimalPlaceholder title="Admin Panel" />;
//       }
//     }

//     // ── STORE ADMIN ───────────────────────────────────────────────────────────
//     if (isStore) {
//       switch (active) {
//         case "dashboard":
//           return (
//             <MinimalPlaceholder
//               title="Store Dashboard"
//               subtitle={`Overview of sales, stock levels, and staff activity for ${storeName}.`}
//               badge={storeName}
//             />
//           );

//         case "storeStock":
//           // InventoryManagementCurrentStockList handles isStore internally:
//           // shows only this store's stock (scoped by store_id from localStorage)
//           return <InventoryManagementCurrentStockList />;

//         case "storeSales":
//           return <SalesReport />;

//         case "storeCashier":
//           return (
//             <MinimalPlaceholder
//               title="Cashier / POS"
//               subtitle={`Manage cashier sessions, counter assignments, and POS access for ${storeName}.`}
//               badge={storeName}
//             />
//           );

//         case "storeStaff":
//           return (
//             <MinimalPlaceholder
//               title="Staff Management"
//               subtitle={`Add and manage cashiers and other staff members for ${storeName}.`}
//               badge={storeName}
//             />
//           );

//         case "storeOrders":
//           return (
//             <MinimalPlaceholder
//               title="Orders"
//               subtitle={`View and manage customer orders at ${storeName}.`}
//               badge={storeName}
//             />
//           );

//         default:
//           return <MinimalPlaceholder title="Store Panel" badge={storeName} />;
//       }
//     }
//   };

//   return (
//     <div className="h-[100dvh] w-full overflow-hidden text-slate-900 flex flex-col">
//       {/* Background */}
//       <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
//         <div className="absolute inset-0 bg-gradient-to-br from-slate-400 via-indigo-500 to-slate-500" />
//         <div className="absolute -top-40 -left-40 h-[560px] w-[560px] rounded-full bg-indigo-300/25 blur-[150px]" />
//         <div className="absolute top-1/3 -right-52 h-[520px] w-[520px] rounded-full bg-slate-400/20 blur-[170px]" />
//         <div className="absolute bottom-0 left-1/4 h-[520px] w-[520px] rounded-full bg-indigo-200/22 blur-[170px]" />
//       </div>

//       {/* Mobile top bar */}
//       <div className="lg:hidden sticky top-0 z-50 border-b border-slate-300 bg-slate-100/80 backdrop-blur-2xl pt-[env(safe-area-inset-top)]">
//         <div className="flex items-center justify-between px-4 py-3">
//           <button
//             type="button"
//             onClick={() => setDrawerOpen(true)}
//             className="p-2 rounded-md border border-slate-300 bg-slate-200/80 backdrop-blur-xl shadow-sm"
//             aria-label="Open sidebar"
//           >
//             <FaBars size={18} className="text-slate-900" />
//           </button>
//           <div className="text-center">
//             <h1 className="text-base font-semibold text-slate-900">
//               {COMPANY_NAME} — {isStore ? storeName : "Admin Panel"}
//             </h1>
//             <p className="text-xs text-slate-700">{pageTitle}</p>
//           </div>
//           <button
//             type="button"
//             onClick={onSettingsClick}
//             className="p-2 rounded-md border border-slate-300 bg-slate-200/80 backdrop-blur-xl shadow-sm"
//             aria-label="Settings"
//           >
//             <SettingsIcon size={18} className="text-slate-900" />
//           </button>
//         </div>
//       </div>

//       <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-6 px-3 lg:px-4 py-3 lg:py-4">

//         {/* Desktop sidebar */}
//         <aside className="hidden lg:block shrink-0 lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)]">
//           <AdminSidebar
//             mode="desktop"
//             active={active}
//             setActive={setActive}
//             onLogout={handleLogout}
//             title="RMS"
//             subtitle={isStore ? storeName : "Admin Module"}
//             sidebarOpen={desktopSidebarOpen}
//             setSidebarOpen={setDesktopSidebarOpen}
//             isStore={isStore}
//             storeName={storeName}
//           />
//         </aside>

//         {/* Mobile drawer */}
//         {drawerOpen && (
//           <>
//             <div
//               className="fixed inset-0 bg-black/40 z-[1000] lg:hidden"
//               onClick={() => setDrawerOpen(false)}
//             />
//             <div className="fixed top-0 left-0 z-[1001] lg:hidden h-[100dvh] w-[86vw] max-w-[360px]
//                            overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)]
//                            pb-[env(safe-area-inset-bottom)] rounded-r-3xl">
//               <AdminSidebar
//                 mode="drawer"
//                 active={active}
//                 setActive={(k) => { setActive(k); setDrawerOpen(false); }}
//                 onLogout={handleLogout}
//                 title="RMS"
//                 subtitle={isStore ? storeName : "Admin Module"}
//                 sidebarOpen={true}
//                 setSidebarOpen={() => setDrawerOpen(false)}
//                 isStore={isStore}
//                 storeName={storeName}
//               />
//             </div>
//           </>
//         )}

//         <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3 lg:gap-6 overflow-hidden">
//           {/* Desktop header */}
//           <header className="hidden lg:flex items-center justify-between sticky top-4 z-40 rounded-2xl border border-slate-300 bg-slate-100/70 backdrop-blur-2xl shadow-[0_18px_50px_rgba(15,23,42,0.10)] px-4 py-3">
//             <div>
//               <h1 className="text-xl font-bold text-slate-900">
//                 {isStore ? `${storeName} — Store Panel` : "Admin Management Panel"}
//               </h1>
//               <p className="text-sm text-slate-700 capitalize">{pageTitle}</p>
//             </div>
//             <div className="flex items-center gap-3">
//               {isStore && (
//                 <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
//                   🏪 {storeName}
//                 </span>
//               )}
//               <button
//                 type="button"
//                 onClick={onSettingsClick}
//                 className="p-2 rounded-xl border border-slate-300 bg-white/70 hover:bg-white shadow-sm transition"
//                 aria-label="Settings"
//               >
//                 <SettingsIcon size={18} className="text-slate-800" />
//               </button>
//             </div>
//           </header>

//           {/* Main content */}
//           <div className="flex-1 min-h-0 rounded-3xl border border-slate-300 bg-slate-100/55 backdrop-blur-2xl shadow-[0_30px_90px_rgba(15,23,42,0.14)] overflow-hidden">
//             <main className="h-full min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
//               <StoreBanner />
//               <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
//             </main>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }



import React, { Suspense, useMemo, useState } from "react";
import { FaBars } from "react-icons/fa";
import { Settings as SettingsIcon } from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import AdminSettings from "./AdminSettings";
import AdminDashboard from "./AdminDashboard";
import AdminProduct from "./AdminProduct";
import ProductMapping from "./ProductMapping";
import SalesReport from "./Salesreport.jsx";
 import InventoryManagementCurrentStockList from "../InventoryManagement/InventoryManagementCurrentStockList";
import HQSetup from "./Hqsetup.jsx";
import HQAdminManagement from "./Hqadminmanagement.jsx";

// ─── Store context from localStorage ─────────────────────────────────────────
const storeId   = localStorage.getItem("admin_store_id")   || "";
const storeName = localStorage.getItem("admin_store_name") || "";
const tenantId  = localStorage.getItem("admin_tenant_id")  || "";
const scope     = localStorage.getItem("admin_scope")      || "hq";
const isHQ      = scope === "hq";
const isStore   = scope === "store";

const COMPANY_NAME = "RMS";

function labelFromKey(key) {
  const labels = {
    "dashboard":             "Dashboard",
    "__settings":            "Settings",
    // HQ
    "products":              "Products",
    "productMapping":        "Product Mapping",
    "stockAllocation":       "Stock Allocation",
    "purchaseOrders":        "Purchase Orders",
    "grn":                   "GRN / Receiving",
    "reports":               "Sales Reports",
    "users.vendor":          "Vendor",
    "users.hr":              "HR",
    "users.inventoryManager":"Inventory Manager",
    "users.cashier":         "Cashier",
    "users.logistics":       "Logistics",
    // Store
    "storeStock":            "Store Stock",
    "storeSales":            "Sales Report",
    "storeCashier":          "Cashier / POS",
    "storeStaff":            "Staff Management",
    "storeOrders":           "Orders",
    // Setup
    "setup":                 "Setup — Stores & Admins",
    "adminManagement":       "Admin Management",
  };
  return labels[key] || "Admin Panel";
}

function PageLoader() {
  return (
    <div className="p-6">
      <p className="text-sm font-semibold text-slate-900">Loading…</p>
    </div>
  );
}

function MinimalPlaceholder({ title, subtitle, badge }) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        {badge && (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-700">{subtitle || "Content will go here."}</p>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-4">
        <p className="text-xs font-semibold text-slate-600">
          Active: <span className="text-slate-900">{title}</span>
        </p>
        {isStore && (
          <p className="text-xs text-indigo-600 mt-1">
            🏪 Scoped to: <strong>{storeName}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

function StoreBanner() {
  if (isHQ) return null;
  return (
    <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
      <span className="text-lg">🏪</span>
      <div>
        <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Store Admin</p>
        <p className="text-sm font-bold text-indigo-900">{storeName}</p>
      </div>
      <span className="ml-auto px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold capitalize">
        {scope}
      </span>
    </div>
  );
}

export default function AdminModule() {
  const defaultTab = isStore ? "storeStock" : "dashboard";

  const [active, setActive]                         = useState(defaultTab);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen]                 = useState(false);

  const pageTitle = useMemo(() => labelFromKey(active), [active]);

  const handleLogout = () => logoutOrReturnToDepartmentSelector();

  const onSettingsClick = () => setActive("__settings");

  const renderPage = () => {
    if (active === "__settings") return <AdminSettings />;

    // ── HQ ADMIN ─────────────────────────────────────────────────────────────
    if (isHQ) {
      switch (active) {
        case "dashboard":
          return <AdminDashboard />;

        case "setup":
          return <HQSetup />;

        case "adminManagement":
          return <HQAdminManagement />;

        case "products":
          return <AdminProduct />;

        case "productMapping":
          return <ProductMapping />;

        case "stockAllocation":
          // InventoryManagementCurrentStockList handles isHQ internally:
          // shows Central Stock + Allocate to Store tabs
          return <InventoryManagementCurrentStockList />;

        case "purchaseOrders":
          return (
            <MinimalPlaceholder
              title="Purchase Orders"
              subtitle="Create and manage purchase orders to vendors."
            />
          );

        case "grn":
          return (
            <MinimalPlaceholder
              title="GRN / Receiving"
              subtitle="Goods Received Notes — confirm and record incoming stock."
            />
          );

        case "reports":
          return <SalesReport />;

        case "users.vendor":
          return (
            <MinimalPlaceholder
              title="Vendor"
              subtitle="Vendor users list, permissions, onboarding, and access control."
            />
          );

        case "users.hr":
          return (
            <MinimalPlaceholder
              title="HR"
              subtitle="HR users list, attendance access, payroll access, and HR permissions."
            />
          );

        case "users.inventoryManager":
          return (
            <MinimalPlaceholder
              title="Inventory Manager"
              subtitle="Inventory manager users, role permissions, and access to stock modules."
            />
          );

        case "users.cashier":
          return (
            <MinimalPlaceholder
              title="Cashier"
              subtitle="Cashier users, POS permissions, counter mapping, and device access."
            />
          );

        case "users.logistics":
          return (
            <MinimalPlaceholder
              title="Logistics"
              subtitle="Shipments, tracking, pickup/manifest, courier serviceability, NDR & RTO."
            />
          );

        default:
          return <MinimalPlaceholder title="Admin Panel" />;
      }
    }

    // ── STORE ADMIN ───────────────────────────────────────────────────────────
    if (isStore) {
      switch (active) {
        case "dashboard":
          return (
            <MinimalPlaceholder
              title="Store Dashboard"
              subtitle={`Overview of sales, stock levels, and staff activity for ${storeName}.`}
              badge={storeName}
            />
          );

        case "storeStock":
          // InventoryManagementCurrentStockList handles isStore internally:
          // shows only this store's stock (scoped by store_id from localStorage)
          return <InventoryManagementCurrentStockList />;

        case "storeSales":
          return <SalesReport />;

        case "storeCashier":
          return (
            <MinimalPlaceholder
              title="Cashier / POS"
              subtitle={`Manage cashier sessions, counter assignments, and POS access for ${storeName}.`}
              badge={storeName}
            />
          );

        case "storeStaff":
          return (
            <MinimalPlaceholder
              title="Staff Management"
              subtitle={`Add and manage cashiers and other staff members for ${storeName}.`}
              badge={storeName}
            />
          );

        case "storeOrders":
          return (
            <MinimalPlaceholder
              title="Orders"
              subtitle={`View and manage customer orders at ${storeName}.`}
              badge={storeName}
            />
          );

        default:
          return <MinimalPlaceholder title="Store Panel" badge={storeName} />;
      }
    }
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#F4F7FB] text-slate-900">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur lg:hidden pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700 transition hover:bg-slate-100"
            aria-label="Open sidebar"
          >
            <FaBars size={18} className="text-slate-900" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-semibold text-slate-900">
              {COMPANY_NAME} — {isStore ? storeName : "Admin Panel"}
            </h1>
            <p className="text-xs text-slate-700">{pageTitle}</p>
          </div>
          <button
            type="button"
            onClick={onSettingsClick}
            className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700 transition hover:bg-slate-100"
            aria-label="Settings"
          >
            <SettingsIcon size={18} className="text-slate-900" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row lg:gap-4 lg:p-4">

        {/* Desktop sidebar */}
        <aside className="hidden lg:block shrink-0 lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)]">
          <AdminSidebar
            mode="desktop"
            active={active}
            setActive={setActive}
            onLogout={handleLogout}
            title="RMS"
            subtitle={isStore ? storeName : "Admin Module"}
            sidebarOpen={desktopSidebarOpen}
            setSidebarOpen={setDesktopSidebarOpen}
            isStore={isStore}
            storeName={storeName}
          />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-[1000] lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="fixed top-0 left-0 z-[1001] lg:hidden h-[100dvh] w-[86vw] max-w-[360px]
                           overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)]
                           pb-[env(safe-area-inset-bottom)] rounded-r-3xl">
              <AdminSidebar
                mode="drawer"
                active={active}
                setActive={(k) => { setActive(k); setDrawerOpen(false); }}
                onLogout={handleLogout}
                title="RMS"
                subtitle={isStore ? storeName : "Admin Module"}
                sidebarOpen={true}
                setSidebarOpen={() => setDrawerOpen(false)}
                isStore={isStore}
                storeName={storeName}
              />
            </div>
          </>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          {/* Desktop header */}
          <header className="sticky top-4 z-40 hidden min-h-16 items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.06)] lg:flex">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                {isStore ? `${storeName} — Store Panel` : "Admin Management Panel"}
              </h1>
              <p className="mt-0.5 text-xs font-medium capitalize text-slate-500">{pageTitle}</p>
            </div>
            <div className="flex items-center gap-3">
              {isStore && (
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                  🏪 {storeName}
                </span>
              )}
              <button
                type="button"
                onClick={onSettingsClick}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                aria-label="Settings"
              >
                <SettingsIcon size={18} className="text-slate-800" />
              </button>
            </div>
          </header>

          {/* Main content */}
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-[#F8FAFC] shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <main className="h-full min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
              <StoreBanner />
              <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
