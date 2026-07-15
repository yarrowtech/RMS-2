import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


// import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
// import {
//   FaChartPie,
//   FaSignOutAlt,
//   FaStore,
//   FaClipboardList,
//   FaTasks,
//   FaCheckSquare,
//   FaFileAlt,
//   FaExclamationTriangle,
//   FaTachometerAlt,
//   FaChartBar,
//   FaWallet,
//   FaTruck,
//   FaBell,
//   FaCalendarAlt,
// } from "react-icons/fa";
// import { PanelLeft, PanelRight } from "lucide-react";

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

// export default function MerchendiserBuyerSidebar({
//   mode = "desktop",
//   active,
//   setActive,
//   onLogout,
//   title = "RMS",
//   subtitle = "Merchandiser Buyer",
//   sidebarOpen = true,
//   setSidebarOpen,
// }) {
//   const isDrawer = mode === "drawer";
//   const showText = sidebarOpen;

//   const [adminName, setAdminName] = useState(() => {
//     return localStorage.getItem("admin_name") || "";
//   });

//   useEffect(() => {
//     if (adminName) return;

//     const token =
//       localStorage.getItem("admin_token") ||
//       localStorage.getItem("token");

//     if (!token) return;

//     const fetchAdmin = async () => {
//       try {
//         const res = await fetch(
//           `${APP_API_URL}/admin/me`,
//           { headers: { Authorization: `Bearer ${token}` } }
//         );
//         if (!res.ok) return;
//         const data = await res.json();
//         if (data.name) {
//           setAdminName(data.name);
//           localStorage.setItem("admin_name", data.name);
//         }
//       } catch {}
//     };

//     fetchAdmin();
//   }, [adminName]);

//   const headerTiltRef = useTilt({
//     max: 10,
//     scale: 1.02,
//     perspective: 950,
//     disabled: isDrawer,
//   });

//   const ACTIVE_GRAD = "bg-gradient-to-r from-indigo-700 to-slate-800";
//   const ACTIVE_TXT  = "text-slate-50";
//   const ACTIVE_BR   = "border-slate-800/20";

//   const topBtnBase =
//     "group relative w-full flex items-center gap-3 rounded-2xl text-sm font-semibold transition " +
//     "bg-slate-200 border border-slate-300 shadow-sm " +
//     "hover:-translate-y-[2px] hover:shadow-lg active:translate-y-0";

//   const topBtnPad = sidebarOpen ? "px-4 py-3" : "px-3 py-3 justify-center";

//   const onSelect = useCallback(
//     (key) => {
//       setActive(key);
//       if (isDrawer) setSidebarOpen?.(false);
//     },
//     [isDrawer, setActive, setSidebarOpen]
//   );

//   // ── Nav items — existing + 3 new high-priority analytics tabs ─────────────
//   const navItems = [
//     // ── Existing ──────────────────────────────────────────────────────────────
//     {
//       key:   "dashboard",
//       label: "Dashboard",
//       icon:  <FaChartPie />,
//     },
//     {
//       key:   "vendorlist",
//       label: "Vendor List",
//       icon:  <FaStore />,
//     },
//     {
//       key:   "order-details",
//       label: "Order Details",
//       icon:  <FaClipboardList />,
//     },
//     {
//       key:   "task-list",
//       label: "Task List",
//       icon:  <FaTasks />,
//     },
//     {
//       key:   "check-list",
//       label: "Check List",
//       icon:  <FaCheckSquare />,
//     },
//     {
//       key:   "reports",
//       label: "Reports",
//       icon:  <FaFileAlt />,
//     },

//     // ── New high-priority analytics tabs ─────────────────────────────────────
//     {
//       key:      "open-po-tracker",
//       label:    "Open PO Tracker",
//       icon:     <FaTachometerAlt />,
//       isNew:    true,
//       newLabel: "Live",
//       accent:   "#EF4444",   // red — urgency tool
//     },
//     {
//       key:      "vendor-performance",
//       label:    "Vendor Performance",
//       icon:     <FaChartBar />,
//       isNew:    true,
//       newLabel: "New",
//       accent:   "#6366F1",
//     },
//     {
//       key:      "variance-log",
//       label:    "Variance Log",
//       icon:     <FaExclamationTriangle />,
//       isNew:    true,
//       newLabel: "New",
//       accent:   "#F97316",
//     },
//     // ── Medium priority ──────────────────────────────────────────────────
//     {
//       key:      "budget-otb",
//       label:    "Budget & OTB",
//       icon:     <FaWallet />,
//       isNew:    true,
//       newLabel: "New",
//       accent:   "#22C55E",
//     },
//     {
//       key:      "delivery-tracking",
//       label:    "Delivery Tracking",
//       icon:     <FaTruck />,
//       isNew:    true,
//       newLabel: "New",
//       accent:   "#0EA5E9",
//     },
//     {
//       key:      "reorder-alerts",
//       label:    "Reorder Alerts",
//       icon:     <FaBell />,
//       isNew:    true,
//       newLabel: "Live",
//       accent:   "#EF4444",
//     },
//     {
//       key:      "buyers-calendar",
//       label:    "Buyer's Calendar",
//       icon:     <FaCalendarAlt />,
//       isNew:    true,
//       newLabel: "New",
//       accent:   "#6366F1",
//     },
//   ];

//   const firstName = adminName ? adminName.split(" ")[0] : "";

//   // Separator index — draw a thin divider before the new analytics section
//   const SEPARATOR_BEFORE = "open-po-tracker";
//   const SEPARATOR_BEFORE_MEDIUM = "budget-otb";

//   return (
//     <aside
//       className={cn(
//         isDrawer ? "h-[100dvh]" : "h-full",
//         "flex flex-col overflow-hidden rounded-3xl border border-slate-300",
//         "bg-slate-100/70 backdrop-blur-2xl shadow-[0_30px_90px_rgba(15,23,42,0.18)]",
//         isDrawer ? "w-full" : sidebarOpen ? "w-[320px] max-w-[86vw]" : "w-[96px]"
//       )}
//     >
//       {/* ── Header ── */}
//       <div className="relative shrink-0 p-3">
//         <div
//           ref={headerTiltRef}
//           className={cn(
//             "rounded-2xl border border-slate-300 bg-white/60 shadow-sm",
//             sidebarOpen ? "p-4" : "p-3"
//           )}
//           style={{
//             backgroundImage:
//               "radial-gradient(800px circle at var(--mx,50%) var(--my,50%), rgba(99,102,241,0.18) 0%, rgba(99,102,241,0) 45%)",
//           }}
//         >
//           <div className={cn("flex items-center", sidebarOpen ? "gap-3" : "justify-center")}>
//             {sidebarOpen && (
//               <div className="min-w-0">
//                 <h2 className="truncate text-sm font-bold text-slate-900">{title}</h2>
//                 <p className="truncate text-xs font-semibold text-slate-700">{subtitle}</p>
//               </div>
//             )}

//             <button
//               type="button"
//               onClick={() => {
//                 if (isDrawer) return setSidebarOpen?.(false);
//                 setSidebarOpen?.((s) => !s);
//               }}
//               className={cn(
//                 "ml-auto grid h-9 w-9 place-items-center rounded-xl border border-slate-300 bg-slate-200 transition hover:bg-slate-300",
//                 !sidebarOpen && "ml-0"
//               )}
//             >
//               {isDrawer ? (
//                 <span className="font-black text-slate-800">×</span>
//               ) : sidebarOpen ? (
//                 <PanelLeft size={18} className="text-slate-800" />
//               ) : (
//                 <PanelRight size={18} className="text-slate-800" />
//               )}
//             </button>
//           </div>

//           {/* Welcome card */}
//           {sidebarOpen && (
//             <div
//               className={cn(
//                 "mt-4 rounded-xl p-3 shadow-lg shadow-slate-900/15",
//                 ACTIVE_GRAD,
//                 ACTIVE_TXT
//               )}
//             >
//               <p className="text-sm font-semibold">
//                 {firstName ? `Welcome, ${firstName}!` : "Welcome!"}
//               </p>
//               <p className="text-xs opacity-90">Buyer operations ready!</p>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* ── Nav ── */}
//       <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
//         {navItems.map((item) => {
//           const isActive = active === item.key;

//           return (
//             <React.Fragment key={item.key}>
//               {/* Thin divider before analytics section */}
//               {item.key === SEPARATOR_BEFORE_MEDIUM && (
//                 <div className="py-1.5">
//                   <div className="h-px rounded-full bg-slate-300/70" />
//                   {sidebarOpen && (
//                     <p className="mt-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
//                       Planning
//                     </p>
//                   )}
//                 </div>
//               )}
//               {/* Thin divider before analytics section */}
//               {item.key === SEPARATOR_BEFORE && (
//                 <div className="py-1.5">
//                   <div className="h-px rounded-full bg-slate-300/70" />
//                   {sidebarOpen && (
//                     <p className="mt-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
//                       Analytics
//                     </p>
//                   )}
//                 </div>
//               )}

//               <button
//                 onClick={() => onSelect(item.key)}
//                 className={cn(
//                   topBtnBase,
//                   topBtnPad,
//                   isActive
//                     ? cn(ACTIVE_GRAD, ACTIVE_TXT, ACTIVE_BR)
//                     : "text-slate-800"
//                 )}
//               >
//                 {/* Icon — tinted with accent color when not active */}
//                 <span
//                   className="text-lg shrink-0"
//                   style={{ color: isActive ? undefined : item.accent }}
//                 >
//                   {item.icon}
//                 </span>

//                 {showText && (
//                   <span className="flex-1 text-left truncate">{item.label}</span>
//                 )}

//                 {/* New / Live badge */}
//                 {showText && item.isNew && !isActive && (
//                   <span
//                     className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
//                     style={{ background: item.accent || "#6366F1" }}
//                   >
//                     {item.newLabel || "New"}
//                   </span>
//                 )}
//               </button>
//             </React.Fragment>
//           );
//         })}
//       </nav>

//       {/* ── Logout ── */}
//       <div className="border-t border-slate-200 bg-white p-3">
//         <button
//           onClick={onLogout}
//           className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white bg-gradient-to-r from-rose-600 via-red-600 to-rose-600"
//         >
//           <FaSignOutAlt />
//           {showText && "Logout"}
//         </button>
//       </div>
//     </aside>
//   );
// }


import React, { useCallback, useEffect, useState } from "react";
import {
  FaBell,
  FaBoxOpen,
  FaCalendarAlt,
  FaChartBar,
  FaChartPie,
  FaCheckSquare,
  FaChevronDown,
  FaChevronRight,
  FaClipboardCheck,
  FaClipboardList,
  FaExchangeAlt,
  FaExclamationTriangle,
  FaFileAlt,
  FaFileInvoiceDollar,
  FaShoppingCart,
  FaSignOutAlt,
  FaStore,
  FaTachometerAlt,
  FaTasks,
  FaTruck,
  FaVials,
  FaWallet,
  FaWarehouse,
  FaWhatsapp,
} from "react-icons/fa";
import { PanelLeft, PanelRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const cn = (...classes) => classes.filter(Boolean).join(" ");

export default function MerchendiserBuyerSidebar({
  mode = "desktop",
  active,
  setActive,
  onLogout,
  title = "RMS",
  subtitle = "Merchandiser Buyer",
  sidebarOpen = true,
  setSidebarOpen,
  inquiryResponseCount = 0,
}) {
  const isDrawer = mode === "drawer";
  const showText = sidebarOpen;
  const [adminName, setAdminName] = useState(
    () => localStorage.getItem("admin_name") || ""
  );
  const [openGroups, setOpenGroups] = useState({ orders: false, store: false });

  useEffect(() => {
    if (adminName) return;
    const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
    if (!token) return;

    fetch(`${APP_API_URL}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.name) return;
        setAdminName(data.name);
        localStorage.setItem("admin_name", data.name);
      })
      .catch(() => {});
  }, [adminName]);

  const onSelect = useCallback(
    (key) => {
      setActive(key);
      if (isDrawer) setSidebarOpen?.(false);
    },
    [isDrawer, setActive, setSidebarOpen]
  );

  const toggleGroup = (group) => {
    if (!sidebarOpen) setSidebarOpen?.(true);
    setOpenGroups((previous) => ({ ...previous, [group]: !previous[group] }));
  };

  const storeChildren = [
    { key: "gr-update-return", label: "GR Update / Return", icon: <FaExchangeAlt /> },
    { key: "next-plan", label: "Next Plan", icon: <FaCalendarAlt /> },
    { key: "debit-note", label: "Debit Note", icon: <FaFileInvoiceDollar /> },
  ];

  const orderChildren = [
    { key: "order-details", label: "Order Details", icon: <FaClipboardList /> },
    { key: "order-items", label: "Order Items", icon: <FaBoxOpen /> },
    { key: "sample-or-real", label: "Sample or Real", icon: <FaVials /> },
  ];

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: <FaChartPie />, accent: "#a78bfa" },
    { key: "vendorlist", label: "Vendor List", icon: <FaStore />, accent: "#38bdf8" },
    { key: "retailer-whatsapp", label: "WhatsApp", icon: <FaWhatsapp />, accent: "#25d366" },
    { key: "quick-order", label: "Quick Order", icon: <FaShoppingCart />, accent: "#fbbf24", badge: inquiryResponseCount > 0 ? inquiryResponseCount : null },
    { key: "buyer-grn", label: "Buyer GRN", icon: <FaClipboardCheck />, accent: "#2dd4bf" },
    { key: "purchase-invoice", label: "Purchase Invoice", icon: <FaFileInvoiceDollar />, accent: "#f59e0b" },
    { key: "task-list", label: "Task List", icon: <FaTasks />, accent: "#fb7185" },
    { key: "check-list", label: "Check List", icon: <FaCheckSquare />, accent: "#4ade80" },
    { key: "reports", label: "Reports", icon: <FaFileAlt />, accent: "#60a5fa" },
    { key: "open-po-tracker", label: "Open PO Tracker", icon: <FaTachometerAlt />, accent: "#f87171", badge: "Live" },
    { key: "vendor-performance", label: "Vendor Performance", icon: <FaChartBar />, accent: "#818cf8", badge: "New" },
    { key: "variance-log", label: "Variance Log", icon: <FaExclamationTriangle />, accent: "#fb923c", badge: "New" },
    { key: "budget-otb", label: "Budget & OTB", icon: <FaWallet />, accent: "#34d399" },
    { key: "delivery-tracking", label: "Delivery Tracking", icon: <FaTruck />, accent: "#38bdf8" },
    { key: "reorder-alerts", label: "Reorder Alerts", icon: <FaBell />, accent: "#fb7185", badge: "Live" },
    { key: "buyers-calendar", label: "Buyer's Calendar", icon: <FaCalendarAlt />, accent: "#c084fc" },
  ];

  const storeActive = storeChildren.some((item) => item.key === active);
  const ordersActive = orderChildren.some((item) => item.key === active);
  const storeOpen = openGroups.store || storeActive;
  const ordersOpen = openGroups.orders || ordersActive;
  const firstName = adminName ? adminName.split(" ")[0] : "Buyer";

  const navButtonClass = (isActive) =>
    cn(
      "group relative flex w-full items-center gap-3 rounded-xl border text-sm font-semibold transition-all duration-200",
      sidebarOpen ? "px-3.5 py-2.5" : "justify-center px-2 py-3",
      isActive
        ? "border-violet-400/60 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-950/30"
        : "border-white/[0.05] bg-white/[0.035] text-violet-100/75 hover:border-white/10 hover:bg-white/[0.09] hover:text-white"
    );

  const renderGroup = ({ key, label, icon, accent, children, open, isActive }) => (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => toggleGroup(key)}
        title={label}
        className={navButtonClass(isActive)}
      >
        <span className="shrink-0 text-lg" style={{ color: isActive ? undefined : accent }}>
          {icon}
        </span>
        {showText && (
          <>
            <span className="flex-1 truncate text-left">{label}</span>
            {open ? <FaChevronDown className="text-[11px]" /> : <FaChevronRight className="text-[11px] opacity-70" />}
          </>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && sidebarOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="ml-4 space-y-1 border-l border-violet-400/20 py-1 pl-3">
              {children.map((child) => {
                const childActive = active === child.key;
                return (
                  <button
                    key={child.key}
                    type="button"
                    onClick={() => onSelect(child.key)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] font-semibold transition",
                      childActive
                        ? "border-cyan-300/30 bg-cyan-400/15 text-cyan-100"
                        : "border-transparent text-violet-100/65 hover:bg-white/[0.07] hover:text-white"
                    )}
                  >
                    <span className={childActive ? "text-cyan-300" : "text-violet-300"}>{child.icon}</span>
                    <span className="truncate">{child.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <aside
      className={cn(
        isDrawer ? "h-[100dvh] rounded-none" : "h-full rounded-2xl",
        "flex flex-col overflow-hidden border border-violet-900/70 bg-gradient-to-b from-[#18143d] via-[#21194f] to-[#111529] shadow-[0_24px_70px_rgba(30,20,80,0.28)]",
        isDrawer ? "w-full" : sidebarOpen ? "w-[292px] max-w-[86vw]" : "w-[84px]"
      )}
    >
      <div className="shrink-0 p-3">
        <div className={cn("rounded-2xl border border-white/10 bg-white/[0.055]", sidebarOpen ? "p-4" : "p-3")}>
          <div className={cn("flex items-center", sidebarOpen ? "gap-3" : "justify-center")}>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                  <h2 className="truncate text-sm font-extrabold tracking-wide text-white">{title}</h2>
                </div>
                <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.13em] text-violet-200/65">{subtitle}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => (isDrawer ? setSidebarOpen?.(false) : setSidebarOpen?.((value) => !value))}
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-violet-100 transition hover:bg-white/[0.14]",
                sidebarOpen && "ml-auto"
              )}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isDrawer ? <span className="text-xl leading-none">×</span> : sidebarOpen ? <PanelLeft size={18} /> : <PanelRight size={18} />}
            </button>
          </div>

          {sidebarOpen && (
            <div className="mt-4 overflow-hidden rounded-xl border border-violet-300/15 bg-gradient-to-br from-violet-500/25 via-fuchsia-500/15 to-cyan-400/10 p-3.5">
              <p className="text-sm font-bold text-white">Welcome, {firstName}</p>
              <p className="mt-0.5 text-xs text-violet-100/70">Buyer workspace ready</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-4 [scrollbar-color:rgba(167,139,250,.35)_transparent] [scrollbar-width:thin]">
        {navItems.map((item) => {
          const isActive = active === item.key;
          return (
            <React.Fragment key={item.key}>
              {item.key === "open-po-tracker" && (
                <div className="pb-1 pt-3">
                  <div className="h-px bg-gradient-to-r from-transparent via-violet-300/25 to-transparent" />
                  {showText && <p className="mt-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300/50">Insights</p>}
                </div>
              )}

              <button
                type="button"
                onClick={() => onSelect(item.key)}
                title={item.label}
                className={navButtonClass(isActive)}
              >
                <span className="shrink-0 text-lg" style={{ color: isActive ? undefined : item.accent }}>{item.icon}</span>
                {showText && <span className="flex-1 truncate text-left">{item.label}</span>}
                {showText && item.badge && !isActive && (
                  <span className="min-w-5 rounded-full px-1.5 py-0.5 text-center text-[9px] font-extrabold text-slate-950 shadow-sm" style={{ backgroundColor: item.accent }}>
                    {item.badge}
                  </span>
                )}
                {!showText && item.badge && !isActive && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white shadow-sm">
                    {item.badge}
                  </span>
                )}
              </button>

              {item.key === "retailer-whatsapp" && (
                <>
                  {renderGroup({ key: "store", label: "Store", icon: <FaWarehouse />, accent: "#fbbf24", children: storeChildren, open: storeOpen, isActive: storeActive })}
                  {renderGroup({ key: "orders", label: "Orders", icon: <FaShoppingCart />, accent: "#fb7185", children: orderChildren, open: ordersOpen, isActive: ordersActive })}
                </>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      <div className="border-t border-white/10 bg-black/10 p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 py-3 text-sm font-bold text-rose-200 transition hover:border-rose-400/35 hover:bg-rose-500/20 hover:text-white"
        >
          <FaSignOutAlt />
          {showText && "Logout"}
        </button>
      </div>
    </aside>
  );
}