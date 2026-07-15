

// import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
// import {
//   FaChartPie,
//   FaBoxes,
//   FaSignOutAlt,
//   FaUsers,
//   FaUserTie,
//   FaUserShield,
//   FaUserCog,
//   FaCashRegister,
//   FaTruck,
//   FaChevronDown,
//   FaChevronRight,
//   FaFileAlt,
//   FaWarehouse,
//   FaStore,
//   FaClipboardList,
//   FaShoppingCart,
//   FaIdBadge,
//   FaLayerGroup,
// } from "react-icons/fa";
// import { PanelLeft, PanelRight, PackageCheck, ArrowLeftRight, Building2, Wrench } from "lucide-react";
// import { FaSitemap } from "react-icons/fa";

// const cn = (...a) => a.filter(Boolean).join(" ");

// function useTilt({ max = 10, scale = 1.02, perspective = 950, disabled = false } = {}) {
//   const ref = useRef(null);
//   const raf = useRef(0);
//   const state = useRef({ x: 0, y: 0 });

//   useEffect(() => {
//     const el = ref.current;
//     if (!el || disabled) return;

//     const onMove = (e) => {
//       const r = el.getBoundingClientRect();
//       const px = (e.clientX - r.left) / r.width;
//       const py = (e.clientY - r.top) / r.height;
//       state.current.x = (py - 0.5) * max * -1;
//       state.current.y = (px - 0.5) * max;
//       el.style.setProperty("--mx", `${px * 100}%`);
//       el.style.setProperty("--my", `${py * 100}%`);
//       if (raf.current) return;
//       raf.current = requestAnimationFrame(() => {
//         raf.current = 0;
//         el.style.transform = `perspective(${perspective}px) rotateX(${state.current.x}deg) rotateY(${state.current.y}deg) scale(${scale})`;
//       });
//     };

//     const onLeave = () => {
//       if (raf.current) cancelAnimationFrame(raf.current);
//       raf.current = 0;
//       el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`;
//       el.style.setProperty("--mx", "50%");
//       el.style.setProperty("--my", "50%");
//     };

//     el.addEventListener("pointermove", onMove, { passive: true });
//     el.addEventListener("pointerleave", onLeave, { passive: true });
//     return () => {
//       if (raf.current) cancelAnimationFrame(raf.current);
//       raf.current = 0;
//       el.removeEventListener("pointermove", onMove);
//       el.removeEventListener("pointerleave", onLeave);
//     };
//   }, [max, scale, perspective, disabled]);

//   return ref;
// }

// export default function AdminSidebar({
//   mode = "desktop",
//   active,
//   setActive,
//   onLogout,
//   title = "RMS",
//   subtitle = "Admin Module",
//   sidebarOpen = true,
//   setSidebarOpen,
//   isStore = false,      // ← NEW: true for store admins
//   storeName = "",       // ← NEW: store name for display
// }) {
//   const isDrawer   = mode === "drawer";
//   const showText   = sidebarOpen;

//   const [usersOpen,  setUsersOpen]  = useState(false);
//   const [stockOpen,  setStockOpen]  = useState(false);

//   const usersHeaderActive = String(active || "").startsWith("users.");
//   const stockHeaderActive = ["stockAllocation", "purchaseOrders", "grn"].includes(active);

//   useEffect(() => { if (usersHeaderActive) setUsersOpen(true);  }, [usersHeaderActive]);
//   useEffect(() => { if (stockHeaderActive) setStockOpen(true);  }, [stockHeaderActive]);
//   useEffect(() => { if (!sidebarOpen) { setUsersOpen(false); setStockOpen(false); } }, [sidebarOpen]);

//   const userName = useMemo(() => {
//     try {
//       const raw = localStorage.getItem("user") || localStorage.getItem("authUser");
//       if (raw) { const u = JSON.parse(raw); return u?.name || u?.fullName || "User"; }
//     } catch {}
//     return localStorage.getItem("admin_name") || "User";
//   }, []);

//   const headerTiltRef = useTilt({ max: 10, scale: 1.02, perspective: 950, disabled: isDrawer });

//   const ACTIVE_GRAD = "bg-gradient-to-r from-indigo-700 to-slate-800";
//   const ACTIVE_TXT  = "text-slate-50";
//   const ACTIVE_BR   = "border-slate-800/20";

//   const topBtnBase =
//     "group relative w-full flex items-center gap-3 rounded-2xl text-sm font-semibold transition " +
//     "bg-slate-200 border border-slate-300 shadow-sm " +
//     "hover:-translate-y-[2px] hover:shadow-lg active:translate-y-0";

//   const topBtnPad  = sidebarOpen ? "px-4 py-3" : "px-3 py-3 justify-center";

//   const childBtnBase =
//     "w-full flex items-center gap-3 rounded-xl text-sm border shadow-sm " +
//     "hover:-translate-y-[2px] hover:shadow-lg active:translate-y-0 transition-all duration-200";

//   const childBtnPad = sidebarOpen ? "px-4 py-3" : "px-3 py-3 justify-center";

//   const onSelect = useCallback((key) => {
//     setActive(key);
//     if (isDrawer) setSidebarOpen?.(false);
//   }, [isDrawer, setActive, setSidebarOpen]);

//   // Top-level button
//   const topBtn = (key, icon, label) => (
//     <button key={key} type="button" onClick={() => onSelect(key)}
//       className={cn(topBtnBase, topBtnPad,
//         active === key ? cn(ACTIVE_GRAD, ACTIVE_TXT, ACTIVE_BR) : "text-slate-800"
//       )}
//       title={label} aria-label={label}>
//       <span className="text-lg">{icon}</span>
//       {showText && <span className="flex-1 text-left">{label}</span>}
//     </button>
//   );

//   // Child nav item (inside dropdowns)
//   const navItem = (key, icon, label) => (
//     <button key={key} type="button" onClick={() => onSelect(key)}
//       className={cn(childBtnBase, childBtnPad,
//         active === key
//           ? cn(ACTIVE_GRAD, ACTIVE_TXT, "border-slate-800/20")
//           : "bg-white/75 border-slate-200 text-slate-800 hover:bg-white"
//       )}
//       title={label} aria-label={label}>
//       <span className="text-base">{icon}</span>
//       {showText && (
//         <>
//           <span className="flex-1 text-left">{label}</span>
//           <FaChevronRight className="text-xs opacity-60" />
//         </>
//       )}
//     </button>
//   );

//   // Collapsible group
//   const group = (key, icon, label, isOpen, setOpen, children) => (
//     <div className="space-y-2" key={key}>
//       <button type="button"
//         onClick={() => {
//           if (!sidebarOpen && !isDrawer) setSidebarOpen?.(true);
//           setOpen(v => !v);
//         }}
//         className={cn(topBtnBase, topBtnPad,
//           isOpen && showText ? cn(ACTIVE_GRAD, ACTIVE_TXT, ACTIVE_BR) : "text-slate-800"
//         )}>
//         <span className="text-lg">{icon}</span>
//         {showText && (
//           <>
//             <span className="flex-1 text-left">{label}</span>
//             <FaChevronDown className={cn("text-xs transition-transform", isOpen && "rotate-180")} />
//           </>
//         )}
//       </button>
//       {showText && (
//         <div className={cn("space-y-2", sidebarOpen && "pl-3", isOpen ? "block" : "hidden")}>
//           {children}
//         </div>
//       )}
//     </div>
//   );

//   // ── Section label ─────────────────────────────────────────────────────────
//   const sectionLabel = (label) => showText && (
//     <p className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
//       {label}
//     </p>
//   );

//   return (
//     <aside className={cn(
//       isDrawer ? "h-[100dvh]" : "h-full",
//       "rounded-3xl border border-slate-300 overflow-hidden",
//       "bg-slate-100/70 backdrop-blur-2xl shadow-[0_30px_90px_rgba(15,23,42,0.18)]",
//       "flex flex-col",
//       isDrawer ? "w-full" : sidebarOpen ? "w-[320px] max-w-[86vw]" : "w-[96px]"
//     )}>

//       {/* ── Header ──────────────────────────────────────────────────────────── */}
//       <div className="relative p-3 shrink-0">
//         <div ref={headerTiltRef}
//           className={cn("rounded-2xl border border-slate-300 bg-white/60 shadow-sm", sidebarOpen ? "p-4" : "p-3")}
//           style={{ backgroundImage: "radial-gradient(800px circle at var(--mx,50%) var(--my,50%), rgba(99,102,241,0.18) 0%, rgba(99,102,241,0) 45%)" }}>
//           <div className={cn("flex items-center", sidebarOpen ? "gap-3" : "justify-center")}>
//             {sidebarOpen && (
//               <div className="min-w-0">
//                 <h2 className="text-sm font-bold text-slate-900 truncate">{title}</h2>
//                 <p className="text-xs font-semibold text-slate-700 truncate">{subtitle}</p>
//               </div>
//             )}
//             <button type="button"
//               onClick={() => { if (isDrawer) return setSidebarOpen?.(false); setSidebarOpen?.(s => !s); }}
//               className={cn("ml-auto grid place-items-center rounded-xl border border-slate-300 bg-slate-200 hover:bg-slate-300 transition h-9 w-9", !sidebarOpen && "ml-0")}
//               aria-label={isDrawer ? "Close sidebar" : "Toggle sidebar"}>
//               {isDrawer ? <span className="text-slate-800 font-black">×</span>
//                 : sidebarOpen ? <PanelLeft size={18} className="text-slate-800" />
//                 : <PanelRight size={18} className="text-slate-800" />}
//             </button>
//           </div>

//           {sidebarOpen && (
//             <div className={cn("mt-4 rounded-xl p-3 shadow-lg shadow-slate-900/15", ACTIVE_GRAD, ACTIVE_TXT)}>
//               <p className="text-sm font-semibold">Welcome, {userName}</p>
//               <p className="text-xs opacity-90">
//                 {isStore ? `🏪 ${storeName}` : "HQ Admin operations ready!"}
//               </p>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* ── Nav ─────────────────────────────────────────────────────────────── */}
//       <nav className="relative z-10 flex-1 min-h-0 px-3 space-y-2 overflow-y-auto overscroll-contain pb-3 [-webkit-overflow-scrolling:touch]">

//         {/* ── STORE ADMIN MENU ────────────────────────────────────────────── */}
//         {isStore && (
//           <>
//             {sectionLabel("Store Overview")}
//             {topBtn("dashboard",   <FaChartPie />,     "Dashboard")}
//             {topBtn("storeStock",  <FaWarehouse />,    "Store Stock")}

//             {sectionLabel("Sales & POS")}
//             {topBtn("storeSales",   <FaFileAlt />,      "Sales Report")}
//             {topBtn("storeCashier", <FaCashRegister />, "Cashier / POS")}
//             {topBtn("storeOrders",  <FaShoppingCart />, "Orders")}

//             {sectionLabel("Staff")}
//             {topBtn("storeStaff",  <FaIdBadge />,      "Staff Management")}
//           </>
//         )}

//         {/* ── HQ ADMIN MENU ───────────────────────────────────────────────── */}
//         {!isStore && (
//           <>
//             {sectionLabel("Setup")}
//             {topBtn("setup", <Wrench size={14}/>, "Stores & Admins")}

//             {sectionLabel("Overview")}
//             {topBtn("dashboard",      <FaChartPie />,  "Dashboard")}

//             {sectionLabel("Inventory")}
//             {topBtn("products",       <FaBoxes />,     "Products")}
//             {topBtn("productMapping", <FaSitemap />,   "Product Mapping")}

//             {/* Stock group */}
//             {group("stock", <FaLayerGroup />, "Stock Management", stockOpen, setStockOpen, <>
//               {navItem("stockAllocation", <ArrowLeftRight size={14} />, "Stock Allocation")}
//               {navItem("purchaseOrders",  <FaClipboardList />,          "Purchase Orders")}
//               {navItem("grn",             <PackageCheck size={14} />,   "GRN / Receiving")}
//             </>)}

//             {sectionLabel("Team")}
//             {/* Users group */}
//             {group("users", <FaUsers />, "Users", usersOpen, setUsersOpen, <>
//               {navItem("users.vendor",           <FaUserTie />,    "Vendor")}
//               {navItem("users.hr",               <FaUserShield />, "HR")}
//               {navItem("users.inventoryManager", <FaUserCog />,    "Inventory Manager")}
//               {navItem("users.cashier",          <FaCashRegister />, "Cashier")}
//               {navItem("users.logistics",        <FaTruck />,      "Logistics")}
//             </>)}

//             {sectionLabel("Analytics")}
//             {topBtn("reports",        <FaFileAlt />,   "Sales Reports")}
//           </>
//         )}

//         <div className="h-6" />
//       </nav>

//       {/* ── Logout ──────────────────────────────────────────────────────────── */}
//       <div className="shrink-0 sticky bottom-0 z-20 p-3 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
//         <button type="button" onClick={onLogout}
//           className="w-full flex items-center justify-center gap-2 rounded-2xl py-3
//             text-sm font-semibold text-white
//             bg-gradient-to-r from-rose-600 via-red-600 to-rose-600
//             shadow-md hover:brightness-110 active:scale-[0.99] transition-all duration-200">
//           <FaSignOutAlt className="text-base" />
//           {showText && "Logout"}
//         </button>
//       </div>
//     </aside>
//   );
// }

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  FaChartPie,
  FaBoxes,
  FaSignOutAlt,
  FaUsers,
  FaUserTie,
  FaUserShield,
  FaUserCog,
  FaCashRegister,
  FaTruck,
  FaChevronDown,
  FaChevronRight,
  FaFileAlt,
  FaWarehouse,
  FaStore,
  FaClipboardList,
  FaShoppingCart,
  FaIdBadge,
  FaLayerGroup,
} from "react-icons/fa";
import { PanelLeft, PanelRight, PackageCheck, ArrowLeftRight, Building2, Wrench, Shield } from "lucide-react";
import { FaSitemap } from "react-icons/fa";

const cn = (...a) => a.filter(Boolean).join(" ");

function useTilt({ max = 10, scale = 1.02, perspective = 950, disabled = false } = {}) {
  const ref = useRef(null);
  const raf = useRef(0);
  const state = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      state.current.x = (py - 0.5) * max * -1;
      state.current.y = (px - 0.5) * max;
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        el.style.transform = `perspective(${perspective}px) rotateX(${state.current.x}deg) rotateY(${state.current.y}deg) scale(${scale})`;
      });
    };

    const onLeave = () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
      el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`;
      el.style.setProperty("--mx", "50%");
      el.style.setProperty("--my", "50%");
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [max, scale, perspective, disabled]);

  return ref;
}

export default function AdminSidebar({
  mode = "desktop",
  active,
  setActive,
  onLogout,
  title = "RMS",
  subtitle = "Admin Module",
  sidebarOpen = true,
  setSidebarOpen,
  isStore = false,      // ← NEW: true for store admins
  storeName = "",       // ← NEW: store name for display
}) {
  const isDrawer   = mode === "drawer";
  const showText   = sidebarOpen;

  const [usersOpen,  setUsersOpen]  = useState(false);
  const [stockOpen,  setStockOpen]  = useState(false);

  const usersHeaderActive = String(active || "").startsWith("users.");
  const stockHeaderActive = ["stockAllocation", "purchaseOrders", "grn"].includes(active);

  useEffect(() => { if (usersHeaderActive) setUsersOpen(true);  }, [usersHeaderActive]);
  useEffect(() => { if (stockHeaderActive) setStockOpen(true);  }, [stockHeaderActive]);
  useEffect(() => { if (!sidebarOpen) { setUsersOpen(false); setStockOpen(false); } }, [sidebarOpen]);

  const userName = useMemo(() => {
    try {
      const raw = localStorage.getItem("user") || localStorage.getItem("authUser");
      if (raw) { const u = JSON.parse(raw); return u?.name || u?.fullName || "User"; }
    } catch {}
    return localStorage.getItem("admin_name") || "User";
  }, []);

  const headerTiltRef = useTilt({ disabled: true });

  const ACTIVE_GRAD = "bg-indigo-600";
  const ACTIVE_TXT  = "text-white";
  const ACTIVE_BR   = "border-indigo-500";

  const topBtnBase =
    "group relative flex w-full items-center gap-3 rounded-xl border text-[13px] font-semibold transition-colors " +
    "border-transparent bg-transparent hover:border-white/5 hover:bg-white/[0.06]";

  const topBtnPad  = sidebarOpen ? "px-3 py-2.5" : "px-3 py-2.5 justify-center";

  const childBtnBase =
    "flex w-full items-center gap-3 rounded-lg border text-[12px] font-medium transition-colors";

  const childBtnPad = sidebarOpen ? "px-3 py-2" : "px-3 py-2 justify-center";

  const onSelect = useCallback((key) => {
    setActive(key);
    if (isDrawer) setSidebarOpen?.(false);
  }, [isDrawer, setActive, setSidebarOpen]);

  // Top-level button
  const topBtn = (key, icon, label) => (
    <button key={key} type="button" onClick={() => onSelect(key)}
      className={cn(topBtnBase, topBtnPad,
        active === key ? cn(ACTIVE_GRAD, ACTIVE_TXT, ACTIVE_BR) : "text-slate-300 hover:text-white"
      )}
      title={label} aria-label={label}>
      <span className="text-lg">{icon}</span>
      {showText && <span className="flex-1 text-left">{label}</span>}
    </button>
  );

  // Child nav item (inside dropdowns)
  const navItem = (key, icon, label) => (
    <button key={key} type="button" onClick={() => onSelect(key)}
      className={cn(childBtnBase, childBtnPad,
        active === key
          ? cn(ACTIVE_GRAD, ACTIVE_TXT, "border-slate-800/20")
          : "border-transparent bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-white"
      )}
      title={label} aria-label={label}>
      <span className="text-base">{icon}</span>
      {showText && (
        <>
          <span className="flex-1 text-left">{label}</span>
          <FaChevronRight className="text-xs opacity-60" />
        </>
      )}
    </button>
  );

  // Collapsible group
  const group = (key, icon, label, isOpen, setOpen, children) => (
    <div className="space-y-2" key={key}>
      <button type="button"
        onClick={() => {
          if (!sidebarOpen && !isDrawer) setSidebarOpen?.(true);
          setOpen(v => !v);
        }}
        className={cn(topBtnBase, topBtnPad,
          isOpen && showText ? cn(ACTIVE_GRAD, ACTIVE_TXT, ACTIVE_BR) : "text-slate-300 hover:text-white"
        )}>
        <span className="text-lg">{icon}</span>
        {showText && (
          <>
            <span className="flex-1 text-left">{label}</span>
            <FaChevronDown className={cn("text-xs transition-transform", isOpen && "rotate-180")} />
          </>
        )}
      </button>
      {showText && (
        <div className={cn("space-y-2", sidebarOpen && "pl-3", isOpen ? "block" : "hidden")}>
          {children}
        </div>
      )}
    </div>
  );

  // ── Section label ─────────────────────────────────────────────────────────
  const sectionLabel = (label) => showText && (
    <p className="px-2 pb-1 pt-4 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
      {label}
    </p>
  );

  return (
    <aside className={cn(
      isDrawer ? "h-[100dvh]" : "h-full",
      "overflow-hidden rounded-2xl border border-slate-800",
      "bg-slate-950 shadow-[0_20px_60px_rgba(15,23,42,0.20)]",
      "flex flex-col",
      isDrawer ? "w-full" : sidebarOpen ? "w-[280px] max-w-[86vw]" : "w-[80px]"
    )}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="relative p-3 shrink-0">
        <div ref={headerTiltRef}
          className={cn("rounded-xl border border-slate-800 bg-slate-900", sidebarOpen ? "p-3.5" : "p-3")}
          >
          <div className={cn("flex items-center", sidebarOpen ? "gap-3" : "justify-center")}>
            {sidebarOpen && (
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white truncate">{title}</h2>
                <p className="text-[11px] font-medium text-slate-400 truncate">{subtitle}</p>
              </div>
            )}
            <button type="button"
              onClick={() => { if (isDrawer) return setSidebarOpen?.(false); setSidebarOpen?.(s => !s); }}
              className={cn("ml-auto grid h-8 w-8 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white", !sidebarOpen && "ml-0")}
              aria-label={isDrawer ? "Close sidebar" : "Toggle sidebar"}>
              {isDrawer ? <span className="font-black text-slate-300">×</span>
                : sidebarOpen ? <PanelLeft size={18} className="text-slate-300" />
                : <PanelRight size={18} className="text-slate-300" />}
            </button>
          </div>

          {sidebarOpen && (
            <div className="mt-3 rounded-lg border border-indigo-400/20 bg-indigo-500/10 p-3 text-indigo-100">
              <p className="text-sm font-semibold">Welcome, {userName}</p>
              <p className="text-xs opacity-90">
                {isStore ? `🏪 ${storeName}` : "HQ Admin operations ready!"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-3 [-webkit-overflow-scrolling:touch]">

        {/* ── STORE ADMIN MENU ────────────────────────────────────────────── */}
        {isStore && (
          <>
            {sectionLabel("Store Overview")}
            {topBtn("dashboard",   <FaChartPie />,     "Dashboard")}
            {topBtn("storeStock",  <FaWarehouse />,    "Store Stock")}

            {sectionLabel("Sales & POS")}
            {topBtn("storeSales",   <FaFileAlt />,      "Sales Report")}
            {topBtn("storeCashier", <FaCashRegister />, "Cashier / POS")}
            {topBtn("storeOrders",  <FaShoppingCart />, "Orders")}

            {sectionLabel("Staff")}
            {topBtn("storeStaff",  <FaIdBadge />,      "Staff Management")}
          </>
        )}

        {/* ── HQ ADMIN MENU ───────────────────────────────────────────────── */}
        {!isStore && (
          <>
            {sectionLabel("Setup")}
            {topBtn("setup",            <Wrench size={14}/>,          "Stores & Admins")}
            {topBtn("adminManagement",  <Shield size={14}/>,          "Admin Management")}

            {sectionLabel("Overview")}
            {topBtn("dashboard",      <FaChartPie />,  "Dashboard")}

            {sectionLabel("Inventory")}
            {topBtn("products",       <FaBoxes />,     "Products")}
            {topBtn("productMapping", <FaSitemap />,   "Product Mapping")}

            {/* Stock group */}
            {group("stock", <FaLayerGroup />, "Stock Management", stockOpen, setStockOpen, <>
              {navItem("stockAllocation", <ArrowLeftRight size={14} />, "Stock Allocation")}
              {navItem("purchaseOrders",  <FaClipboardList />,          "Purchase Orders")}
              {navItem("grn",             <PackageCheck size={14} />,   "GRN / Receiving")}
            </>)}

            {sectionLabel("Team")}
            {/* Users group */}
            {group("users", <FaUsers />, "Users", usersOpen, setUsersOpen, <>
              {navItem("users.vendor",           <FaUserTie />,    "Vendor")}
              {navItem("users.hr",               <FaUserShield />, "HR")}
              {navItem("users.inventoryManager", <FaUserCog />,    "Inventory Manager")}
              {navItem("users.cashier",          <FaCashRegister />, "Cashier")}
              {navItem("users.logistics",        <FaTruck />,      "Logistics")}
            </>)}

            {sectionLabel("Analytics")}
            {topBtn("reports",        <FaFileAlt />,   "Sales Reports")}
          </>
        )}

        <div className="h-6" />
      </nav>

      {/* ── Logout ──────────────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-20 shrink-0 border-t border-slate-800 bg-slate-950 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button type="button" onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 py-2.5 text-[13px] font-semibold text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-200">
          <FaSignOutAlt className="text-base" />
          {showText && "Logout"}
        </button>
      </div>
    </aside>
  );
}