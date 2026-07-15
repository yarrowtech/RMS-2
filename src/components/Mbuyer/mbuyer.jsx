import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


// import React, { Suspense, useEffect, useMemo, useState } from "react";
// import { logoutOrReturnToDepartmentSelector } from "../../utils/authRedirect";
// import { FaBars } from "react-icons/fa";
// import { Settings as SettingsIcon } from "lucide-react";

// import Sidebar from "./Sidedbar";
import ProcurementNotificationCenter from "../ProcurementNotificationCenter.jsx";
// import Dashboard from "./Dashboard";
// import VendorList from "./VendorList";
// import OrderDetails from "./OrderDetails";
// import TaskList from "./TaskList";
// import CheckList from "./CheckList";
// import Reports from "./Reports";
// import Settings from "./Settings";

// // â”€â”€ High-priority new tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// import OpenPOTracker    from "./OpenPOTracker";
// import VendorPerformance from "./VendorPerformance";
// import VarianceLog      from "./VarianceLog";
// import BudgetOTB        from "./BudgetOTB";
// import DeliveryTracking from "./DeliveryTracking";
// import ReorderAlerts    from "./ReorderAlerts";
// import BuyersCalendar   from "./BuyersCalendar";

// const COMPANY_NAME = "RMS";

// function labelFromKey(key) {
//   switch (key) {
//     case "dashboard":           return "Dashboard";
//     case "vendorlist":          return "Vendor List";
//     case "order-details":       return "Order Details";
//     case "task-list":           return "Task List";
//     case "check-list":          return "Check List";
//     case "reports":             return "Reports";
//     case "settings":            return "Settings";
//     // â”€â”€ New tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//     case "open-po-tracker":     return "Open PO Tracker";
//     case "vendor-performance":  return "Vendor Performance";
//     case "variance-log":        return "Variance & Override Log";
//     case "budget-otb":          return "Budget & OTB";
//     case "delivery-tracking":   return "Delivery Tracking";
//     case "reorder-alerts":      return "Reorder Alerts";
//     case "buyers-calendar":     return "Buyer's Calendar";
//     default:                    return "Merchandiser Buyer Panel";
//   }
// }

// function PageLoader() {
//   return (
//     <div className="p-6">
//       <p className="text-sm font-semibold text-slate-900">Loading...</p>
//     </div>
//   );
// }

// function MinimalPlaceholder({ title, subtitle }) {
//   return (
//     <div className="p-6 md:p-8">
//       <div className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm">
//         <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">{title}</h2>
//         <p className="mt-2 text-sm text-slate-700 md:text-base">
//           {subtitle || "Content will go here."}
//         </p>
//         <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
//           <p className="text-xs font-semibold text-slate-600">
//             Active Page: <span className="text-slate-900">{title}</span>
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// }

// function MerchandiserSettings() {
//   return (
//     <MinimalPlaceholder
//       title="Settings"
//       subtitle="Merchandiser buyer settings, preferences, access, and profile controls will appear here."
//     />
//   );
// }

// export default function Mbuyer() {
//   const [active, setActive] = useState("dashboard");
//   const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
//   const [drawerOpen, setDrawerOpen] = useState(false);

//   const pageTitle = useMemo(() => labelFromKey(active), [active]);

//   const handleLogout = () => {
//     window.location.href = "/admin/login";
//   };

//   const onSettingsClick = () => setActive("settings");

//   const renderPage = () => {
//     switch (active) {
//       // â”€â”€ Existing tabs (unchanged) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//       case "dashboard":
//         return <Dashboard />;
//       case "vendorlist":
//         return <VendorList />;
//       case "order-details":
//         return <OrderDetails />;
//       case "task-list":
//         return <TaskList />;
//       case "check-list":
//         return <CheckList />;
//       case "reports":
//         return <Reports />;
//       case "settings":
//         return <Settings />;

//       // â”€â”€ New high-priority tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//       case "open-po-tracker":
//         return <OpenPOTracker />;
//       case "vendor-performance":
//         return <VendorPerformance />;
//       case "variance-log":
//         return <VarianceLog />;

//       // â”€â”€ Medium priority â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//       case "budget-otb":
//         return <BudgetOTB />;
//       case "delivery-tracking":
//         return <DeliveryTracking />;
//       case "reorder-alerts":
//         return <ReorderAlerts />;
//       case "buyers-calendar":
//         return <BuyersCalendar />;

//       default:
//         return <MinimalPlaceholder title="Merchandiser Buyer Panel" />;
//     }
//   };

//   return (
//     <div className="flex h-[100dvh] w-full flex-col overflow-hidden text-slate-900">
//       <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
//         <div className="absolute inset-0 bg-gradient-to-br from-slate-400 via-indigo-500 to-slate-500" />
//         <div className="absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-indigo-300/25 blur-[150px]" />
//         <div className="absolute top-1/3 -right-52 h-[520px] w-[520px] rounded-full bg-slate-400/20 blur-[170px]" />
//         <div className="absolute bottom-0 left-1/4 h-[520px] w-[520px] rounded-full bg-indigo-200/22 blur-[170px]" />
//       </div>

//       {/* Mobile top bar */}
//       <div className="sticky top-0 z-50 border-b border-slate-300 bg-slate-100/80 backdrop-blur-2xl pt-[env(safe-area-inset-top)] lg:hidden">
//         <div className="flex items-center justify-between px-4 py-3">
//           <button
//             type="button"
//             onClick={() => setDrawerOpen(true)}
//             className="rounded-md border border-slate-300 bg-slate-200/80 p-2 shadow-sm backdrop-blur-xl"
//             aria-label="Open sidebar"
//             title="Menu"
//           >
//             <FaBars size={18} className="text-slate-900" />
//           </button>

//           <div className="text-center">
//             <h1 className="text-base font-semibold text-slate-900">
//               {COMPANY_NAME} â€” Merchandiser Buyer
//             </h1>
//             <p className="text-xs text-slate-700">{pageTitle}</p>
//           </div>

//           <button
//             type="button"
//             onClick={onSettingsClick}
//             className="rounded-md border border-slate-300 bg-slate-200/80 p-2 shadow-sm backdrop-blur-xl"
//             aria-label="Settings"
//             title="Settings"
//           >
//             <SettingsIcon size={18} className="text-slate-900" />
//           </button>
//         </div>
//       </div>

//       <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-3 lg:flex-row lg:gap-6 lg:px-4 lg:py-4">
//         {/* Desktop sidebar */}
//         <aside className="hidden shrink-0 lg:sticky lg:top-4 lg:block lg:h-[calc(100dvh-2rem)]">
//           <Sidebar
//             mode="desktop"
//             active={active}
//             setActive={setActive}
//             onLogout={handleLogout}
//             title="RMS"
//             subtitle="Merchandiser Buyer"
//             sidebarOpen={desktopSidebarOpen}
//             setSidebarOpen={setDesktopSidebarOpen}
//           />
//         </aside>

//         {/* Mobile drawer */}
//         {drawerOpen && (
//           <>
//             <div
//               className="fixed inset-0 z-[1000] bg-black/40 lg:hidden"
//               onClick={() => setDrawerOpen(false)}
//             />
//             <div className="fixed left-0 top-0 z-[1001] h-[100dvh] w-[86vw] max-w-[360px] overflow-y-auto overscroll-contain rounded-r-3xl pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] lg:hidden">
//               <Sidebar
//                 mode="drawer"
//                 active={active}
//                 setActive={(key) => {
//                   setActive(key);
//                   setDrawerOpen(false);
//                 }}
//                 onLogout={handleLogout}
//                 title="RMS"
//                 subtitle="Merchandiser Buyer"
//                 sidebarOpen={true}
//                 setSidebarOpen={() => setDrawerOpen(false)}
//               />
//             </div>
//           </>
//         )}

//         {/* Main content */}
//         <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden lg:gap-6">
//           <header className="sticky top-4 z-40 hidden items-center justify-between rounded-2xl border border-slate-300 bg-slate-100/70 px-4 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.10)] backdrop-blur-2xl lg:flex">
//             <div>
//               <h1 className="text-xl font-bold text-slate-900">
//                 Merchandiser Buyer Management Panel
//               </h1>
//               <p className="capitalize text-sm text-slate-700">{pageTitle}</p>
//             </div>
//             <button
//               type="button"
//               onClick={onSettingsClick}
//               className="rounded-xl border border-slate-300 bg-white/70 p-2 shadow-sm transition hover:bg-white"
//               aria-label="Settings"
//               title="Settings"
//             >
//               <SettingsIcon size={18} className="text-slate-800" />
//             </button>
//           </header>

//           <div className="flex-1 min-h-0 overflow-hidden rounded-3xl border border-slate-300 bg-slate-100/55 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-2xl">
//             <main className="h-full min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
//               <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
//             </main>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }




import React, { Suspense, useEffect, useMemo, useState } from "react";
import { logoutOrReturnToDepartmentSelector } from "../../utils/authRedirect";
import { FaBars } from "react-icons/fa";
import { Settings as SettingsIcon } from "lucide-react";

import Sidebar from "./Sidedbar";
import Dashboard from "./Dashboard";
import VendorList from "./VendorList";
import OrderDetails from "./OrderDetails";      // â† existing Order Details (ke
import TaskList from "./TaskList";
import CheckList from "./CheckList";
import Reports from "./Reports";
import Settings from "./Settings";
import QuickOrderFromCatalogue from "./Quickorderfromcatalogue";
import PurchaseInvoice from "../PurchaseInvoice.jsx";
import RetailerWhatsAppConnect from "./Retailerwhatsappconnect";
import Mbuyer1GRUpdateReturn from "./Mbuyer1grupdatereturn";
import Mbuyer1NextPlan from "./Mbuyer1nextplan";
import Mbuyer1DebitNote from "./Mbuyer1debitnote";

// â”€â”€ New Order sub-tabs from Mbuyer1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import Mbuyer1OrderDetail  from "./Mbuyer1OrderDetail";   // item/amount/size/qty/colour/fabric
import Mbuyer1SampleOrReal from "./Mbuyer1SampleOrReal";  // payment tracking samples vs real
import MbuyerGRN from "./MbuyerGRN";


// â”€â”€ Analytics tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import OpenPOTracker    from "./OpenPOTracker";
import VendorPerformance from "./VendorPerformance";
import VarianceLog      from "./VarianceLog";

const COMPANY_NAME = "RMS";

function labelFromKey(key) {
  switch (key) {
    // â”€â”€ Existing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case "dashboard":           return "Dashboard";
    case "vendorlist":          return "Vendor List";
    case "retailer-whatsapp":  return "WhatsApp";
    case "gr-update-return":   return "GR Update / Return";
    case "next-plan":          return "Next Plan";
    case "debit-note":         return "Debit Note";
    case "quick-order":         return "Quick Order";
    case "purchase-invoice":    return "Purchase Invoice";
    case "order-details":       return "Order Details";

    // â”€â”€ New Order group â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case "orders":              return "Orders";
    case "order-items":         return "Order Items";        // Mbuyer1OrderDetail
    case "sample-or-real":      return "Sample or Real";     // Mbuyer1SampleOrReal
    case "buyer-grn": return "Buyer GRN";
    // â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case "open-po-tracker":     return "Open PO Tracker";
    case "vendor-performance":  return "Vendor Performance";
    case "variance-log":        return "Variance & Override Log";

    // â”€â”€ Others â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case "task-list":           return "Task List";
    case "check-list":          return "Check List";
    case "reports":             return "Reports";
    case "settings":            return "Settings";
    default:                    return "Merchandiser Buyer Panel";
  }
}

function PageLoader() {
  return (
    <div className="p-6">
      <p className="text-sm font-semibold text-slate-900">Loading...</p>
    </div>
  );
}

function MinimalPlaceholder({ title, subtitle }) {
  return (
    <div className="p-6 md:p-8">
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-slate-700 md:text-base">
          {subtitle || "Content will go here."}
        </p>
      </div>
    </div>
  );
}

export default function Mbuyer() {
  const [active, setActive] = useState("dashboard");
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inquiryResponseCount, setInquiryResponseCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const API_BASE = APP_API_URL;
    const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
    if (!token) return undefined;
    const headers = { Authorization: `Bearer ${token}` };
    const refresh = async () => {
      try {
        if (active === "quick-order") {
          await fetch(`${API_BASE}/api/procurement-notifications/buyer/read`, { method:"POST", headers:{...headers,"Content-Type":"application/json"}, body:JSON.stringify({category:"quick_order"}) });
          if (!cancelled) setInquiryResponseCount(0);
        } else {
          const response=await fetch(`${API_BASE}/api/procurement-notifications/buyer/unread-count`,{headers,cache:"no-store"});
          const data=await response.json(); if(response.ok&&!cancelled)setInquiryResponseCount(Number(data.count)||0);
        }
      } catch { /* retain the last known count */ }
    };
    refresh(); const timer=window.setInterval(refresh,30000); window.addEventListener("focus",refresh);
    return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener("focus",refresh)};
  }, [active]);

  const pageTitle = useMemo(() => labelFromKey(active), [active]);

  const handleLogout = () => logoutOrReturnToDepartmentSelector();
  const onSettingsClick = () => setActive("settings");

  const renderPage = () => {
    switch (active) {
      // â”€â”€ Existing tabs (unchanged) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "dashboard":          return <Dashboard />;
      case "vendorlist":         return <VendorList />;
      case "retailer-whatsapp": return <RetailerWhatsAppConnect />;
      case "gr-update-return":  return <Mbuyer1GRUpdateReturn />;
      case "next-plan":         return <Mbuyer1NextPlan />;
      case "debit-note":        return <Mbuyer1DebitNote />;
      case "quick-order":        return <QuickOrderFromCatalogue />;
      case "purchase-invoice":   return <PurchaseInvoice />;
      case "task-list":          return <TaskList />;
      case "check-list":         return <CheckList />;
      case "reports":            return <Reports />;
      case "settings":           return <Settings />;

      // â”€â”€ Orders group â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // "order-details" = existing OrderDetails component (unchanged, now sub-tab)
      case "order-details":      return <OrderDetails />;
      // "order-items"   = Mbuyer1OrderDetail (item/amount/size/qty/colour/fabric grid)
      case "order-items":        return <Mbuyer1OrderDetail />;
      // "sample-or-real" = Mbuyer1SampleOrReal (sample vs real payment tracking)
      case "sample-or-real":     return <Mbuyer1SampleOrReal />;

      case "buyer-grn": return <MbuyerGRN />;

      // â”€â”€ Analytics tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "open-po-tracker":    return <OpenPOTracker />;
      case "vendor-performance": return <VendorPerformance />;
      case "variance-log":       return <VarianceLog />;

      default:
        return <MinimalPlaceholder title="Merchandiser Buyer Panel" />;
    }
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#f7f7ff] text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(196,181,253,0.3),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.18),transparent_34%)]" />

      {/* Mobile top bar */}
      <div className="sticky top-0 z-50 border-b border-violet-100 bg-white/95 shadow-sm backdrop-blur-xl pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button type="button" onClick={() => setDrawerOpen(true)}
            className="rounded-xl border border-violet-100 bg-violet-50 p-2 text-violet-700 shadow-sm transition hover:bg-violet-100"
            aria-label="Open sidebar">
            <FaBars size={18} className="text-slate-900" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-semibold text-slate-900">{COMPANY_NAME} â€” Merchandiser Buyer</h1>
            <p className="text-xs font-semibold text-violet-600">{pageTitle}</p>
          </div>
          <button type="button" onClick={onSettingsClick}
            className="rounded-xl border border-violet-100 bg-violet-50 p-2 text-violet-700 shadow-sm transition hover:bg-violet-100"
            aria-label="Settings">
            <SettingsIcon size={18} className="text-slate-900" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-3 lg:flex-row lg:gap-4 lg:px-4 lg:py-4">
        {/* Desktop sidebar */}
        <aside className="hidden shrink-0 lg:sticky lg:top-4 lg:block lg:h-[calc(100dvh-2rem)]">
          <Sidebar
            mode="desktop"
            active={active}
            setActive={setActive}
            onLogout={handleLogout}
            title="RMS"
            subtitle="Merchandiser Buyer"
            sidebarOpen={desktopSidebarOpen}
            setSidebarOpen={setDesktopSidebarOpen}
            inquiryResponseCount={inquiryResponseCount}
          />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <>
            <div className="fixed inset-0 z-[1000] bg-black/40 lg:hidden" onClick={() => setDrawerOpen(false)} />
            <div className="fixed left-0 top-0 z-[1001] h-[100dvh] w-[86vw] max-w-[360px] overflow-y-auto overscroll-contain rounded-r-3xl pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] lg:hidden">
              <Sidebar
                mode="drawer"
                active={active}
                setActive={(key) => { setActive(key); setDrawerOpen(false); }}
                onLogout={handleLogout}
                title="RMS"
                subtitle="Merchandiser Buyer"
                sidebarOpen={true}
                setSidebarOpen={() => setDrawerOpen(false)}
                inquiryResponseCount={inquiryResponseCount}
              />
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden lg:gap-4">
          <header className="sticky top-4 z-40 hidden items-center justify-between relative overflow-hidden rounded-2xl border border-violet-100 bg-white/95 px-5 py-3.5 shadow-[0_12px_35px_rgba(76,29,149,0.08)] backdrop-blur-xl lg:flex">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Merchandiser Buyer Management Panel</h1>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.16em] text-violet-600">{pageTitle}</p>
            </div>
            <div className="flex items-center gap-2"><ProcurementNotificationCenter mode="buyer" count={inquiryResponseCount} onCountChange={setInquiryResponseCount} onNavigate={()=>setActive("quick-order")}/><button type="button" onClick={onSettingsClick} className="rounded-xl border border-violet-100 bg-violet-50 p-2.5 text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-100" aria-label="Settings"><SettingsIcon size={18} className="text-slate-800" /></button></div>
          </header>

          <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-violet-100 bg-white/70 shadow-[0_24px_70px_rgba(76,29,149,0.10)] backdrop-blur-xl">
            <main className="h-full min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
              <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
