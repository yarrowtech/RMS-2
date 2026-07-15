
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaChartPie,
  FaChevronDown,
  FaChevronRight,
  FaSignOutAlt,
  FaBoxes,
  FaExchangeAlt,
  FaTruckLoading,
  FaChartLine,
  FaClock,
  FaFileAlt,
  FaWarehouse,
  FaExclamationTriangle,
  FaListAlt,
  FaClipboardList,
  FaMapMarkedAlt,
  FaBoxOpen,
  FaStore,       // ← NEW: for Store Stock menu item
} from "react-icons/fa";
import { PanelLeft, PanelRight } from "lucide-react";

const cn = (...a) => a.filter(Boolean).join(" ");

/* ----------------------- Smooth 3D Tilt Hook ----------------------- */
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

/* ----------------------- Group Mapping ----------------------- */
function groupOf(key) {
  const k = String(key || "");
  if (k.startsWith("dashboard.")) return "dash";
  if (k.startsWith("stock."))     return "stock";
  if (k.startsWith("grn."))       return "grn";
  if (k.startsWith("reports."))   return "reports";
  return "root";
}

/* ══════════════════════════════════════════════════════════════════
   SIDEBAR COMPONENT
   isHQ, isStore and canReceive control which menu items are visible.
══════════════════════════════════════════════════════════════════ */
export default function RMSInventorySidebar({
  mode        = "desktop",
  active,
  setActive,
  onLogout,
  title       = "Inventory",
  subtitle    = "Department Dashboard",
  sidebarOpen = true,
  setSidebarOpen,
  isHQ        = true,    // ← NEW: true for HQ admin (store_id: null)
  isStore     = false,   // ← NEW: true for store admin (store_id: "KOL_id")
  canReceive  = false,   // Single-store owner / inventory staff can create GRC + GRN
}) {
  const isDrawer = mode === "drawer";

  const [dashOpen,    setDashOpen]    = useState(false);
  const [stockOpen,   setStockOpen]   = useState(false);
  const [grnOpen,     setGrnOpen]     = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  const userName = useMemo(() => {
    try {
      const raw = localStorage.getItem("user") || localStorage.getItem("authUser");
      if (raw) {
        const u = JSON.parse(raw);
        return u?.name || u?.fullName || "User";
      }
    } catch {}
    return localStorage.getItem("admin_name") || "User";
  }, []);

  // Auto open correct group when active changes
  useEffect(() => {
    const g = groupOf(active);
    setDashOpen(g === "dash");
    setStockOpen(g === "stock");
    setGrnOpen(g === "grn");
    setReportsOpen(g === "reports");
  }, [active]);

  const showText = sidebarOpen;

  const ACTIVE_GRAD = "bg-gradient-to-r from-emerald-500 to-cyan-500";
  const ACTIVE_TXT  = "text-white";
  const ACTIVE_BR   = "border-emerald-300/50 shadow-lg shadow-emerald-950/25";

  const topBtnBase =
    "group relative w-full flex items-center gap-3 rounded-xl border text-sm font-semibold transition-all duration-200 " +
    "border-white/[0.06] bg-white/[0.04] text-slate-200/80 " +
    "hover:border-white/10 hover:bg-white/[0.09] hover:text-white";

  const topBtnPad   = sidebarOpen ? "px-4 py-3" : "px-3 py-3 justify-center";
  const childBtnBase =
    "w-full flex items-center gap-3 rounded-lg border text-[13px] font-semibold " +
    "transition-all duration-200";
  const childBtnPad = sidebarOpen ? "px-4 py-3" : "px-3 py-3 justify-center";

  const headerTiltRef = useTilt({ disabled: true });

  const goTo = (nextKey) => setActive(nextKey);

  const groupHeader = (icon, label, open, groupKey, isActiveGroup) => (
    <button
      onClick={() => {
        setDashOpen(groupKey    === "dash"    ? !dashOpen    : false);
        setStockOpen(groupKey   === "stock"   ? !stockOpen   : false);
        setGrnOpen(groupKey     === "grn"     ? !grnOpen     : false);
        setReportsOpen(groupKey === "reports" ? !reportsOpen : false);
      }}
      className={cn(
        topBtnBase,
        topBtnPad,
        isActiveGroup ? cn(ACTIVE_GRAD, ACTIVE_TXT, ACTIVE_BR) : ""
      )}
    >
      <span className="text-lg">{icon}</span>
      {showText && (
        <>
          <span className="flex-1 text-left">{label}</span>
          <FaChevronDown className={cn("text-xs transition-transform", open && "rotate-180")} />
        </>
      )}
    </button>
  );

  const childItem = (key, icon, label) => (
    <button
      key={key}
      onClick={() => goTo(key)}
      className={cn(
        childBtnBase,
        childBtnPad,
        active === key
          ? cn(ACTIVE_GRAD, ACTIVE_TXT, ACTIVE_BR)
          : "border-transparent bg-transparent text-slate-300/75 hover:bg-white/[0.07] hover:text-white"
      )}
    >
      <span className="text-base">{icon}</span>
      {showText && (
        <>
          <span className="flex-1 text-left">{label}</span>
          <FaChevronRight className="text-xs opacity-60" />
        </>
      )}
    </button>
  );

  return (
    <aside
      className={cn(
        isDrawer ? "h-[100dvh]" : "h-full",
        "overflow-hidden rounded-2xl border border-slate-800",
        "bg-gradient-to-b from-[#0f2533] via-[#102c39] to-[#0b1726] shadow-[0_24px_70px_rgba(2,20,30,0.30)]",
        "flex flex-col",
        isDrawer ? "w-full" : sidebarOpen ? "w-[294px] max-w-[86vw]" : "w-[84px]"
      )}
    >
      {/* ── Header ── */}
      <div className="relative p-3 shrink-0">
        <div
          ref={headerTiltRef}
          className={cn(
            "rounded-2xl border border-white/10 bg-white/[0.055]",
            sidebarOpen ? "p-4" : "p-3"
          )}
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(16,185,129,0.10), rgba(34,211,238,0.04))",
          }}
        >
          <div className={cn("flex items-center", sidebarOpen ? "gap-3" : "justify-center")}>
            {sidebarOpen && (
              <div className="min-w-0">
                <h2 className="text-sm font-extrabold tracking-wide text-white truncate">{title}</h2>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100/55 truncate">{subtitle}</p>
              </div>
            )}
            <button
              onClick={() => {
                if (isDrawer) return setSidebarOpen?.(false);
                setSidebarOpen?.((s) => !s);
              }}
              className={cn(
                "ml-auto grid place-items-center rounded-xl",
                "border border-white/10 bg-white/[0.07] text-slate-100",
                "hover:bg-white/[0.14] transition",
                "h-9 w-9",
                !sidebarOpen && "ml-0"
              )}
              aria-label={isDrawer ? "Close sidebar" : "Toggle sidebar"}
            >
              {isDrawer ? (
                <span className="font-black text-white">×</span>
              ) : sidebarOpen ? (
                <PanelLeft size={18} className="text-slate-100" />
              ) : (
                <PanelRight size={18} className="text-slate-100" />
              )}
            </button>
          </div>

          {sidebarOpen && (
            <div className="mt-4 rounded-xl border border-emerald-300/15 bg-gradient-to-br from-emerald-400/20 via-cyan-400/10 to-transparent p-3.5">
              <p className="text-sm font-bold text-white">Welcome, {userName}</p>
              {/* Show scope badge */}
              <p className="mt-0.5 text-xs text-cyan-50/65">
                {isStore ? "Store Inventory" : "HQ Inventory"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Nav ── */}
      <nav
        className={cn(
          "relative z-10 flex-1 min-h-0 space-y-2 overflow-y-auto overscroll-contain px-3 pb-3 [scrollbar-color:rgba(45,212,191,.3)_transparent] [scrollbar-width:thin]",
          "[-webkit-overflow-scrolling:touch]"
        )}
      >
        {/* ── Dashboard (HQ only — store doesn't need summary/expiry) ── */}
        {isHQ && (
          <>
            {groupHeader(<FaChartPie />, "Dashboard", dashOpen, "dash", String(active).startsWith("dashboard."))}
            {dashOpen && (
              <div className={cn("space-y-2", sidebarOpen && "ml-4 border-l border-emerald-300/15 pl-3")}>
                {childItem("dashboard.summary", <FaChartPie />, "Stock Summary Overview")}
                {childItem("dashboard.aging",   <FaClock />,    "Expiry & Aging Items")}
              </div>
            )}
          </>
        )}

        {/* ── Stock Management ── */}
        {groupHeader(<FaBoxes />, "Stock Management", stockOpen, "stock", String(active).startsWith("stock."))}
        {stockOpen && (
          <div className={cn("space-y-2", sidebarOpen && "ml-4 border-l border-emerald-300/15 pl-3")}>

            {/* HQ sees central stock list + allocation */}
            {isHQ && childItem("stock.currentList", <FaListAlt />,  "Central Stock List")}
            {isHQ && childItem("stock.allocation",  <FaBoxOpen />,  "Stock Allocation")}

            {/* Store sees their own store stock */}
            {isStore && childItem("stock.storeStock", <FaStore />, "Store Stock")}

            {/* Store users get the operational essentials only. */}
            {childItem("stock.ledger", <FaExchangeAlt />, "Stock Ledger / Movement")}
            {isHQ && childItem("stock.reorderLevel", <FaClipboardList />, "Reorder Level Setup")}
            {childItem("stock.adjustment", <FaExchangeAlt />, "Stock Adjustment")}
            {isHQ && childItem("stock.transfer", <FaWarehouse />, "Stock Transfer")}
            {isHQ && childItem("stock.damagedReturned", <FaExclamationTriangle />, "Damaged / Returned Stock")}
          </div>
        )}

        {/* ── GRN / GRC (HQ and single-store receiving) ── */}
        {canReceive && (
          <>
            {groupHeader(
              <FaTruckLoading />,
              "GRC /GRN Management",
              grnOpen,
              "grn",
              String(active).startsWith("grn.")
            )}
            {grnOpen && (
              <div className={cn("space-y-2", sidebarOpen && "ml-4 border-l border-emerald-300/15 pl-3")}>
                {childItem("grn.grc",           <FaExchangeAlt />, "Goods Return Challan (GRC)")}
                {childItem("grn.grn",           <FaTruckLoading />, "Goods Receipt Note (GRN)")}
                {isHQ && childItem("grn.supplierReturn",<FaMapMarkedAlt />, "Supplier Return Register")}
              </div>
            )}
          </>
        )}

        {/* Reports remain an HQ responsibility; store users use the ledger. */}
        {isHQ && (
          <>
            {groupHeader(<FaFileAlt />, "Reports", reportsOpen, "reports", String(active).startsWith("reports."))}
            {reportsOpen && (
              <div className={cn("space-y-2", sidebarOpen && "ml-4 border-l border-emerald-300/15 pl-3")}>
                {childItem("reports.valuation",    <FaChartLine />,    "Stock Valuation Report")}
                {childItem("reports.itemAging",    <FaClock />,        "Item Aging Report")}
                {childItem("reports.dailyMovement",<FaExchangeAlt />,  "Daily Stock Movement")}
                {childItem("reports.warehouseWise",<FaWarehouse />,    "Warehouse Wise Stock")}
              </div>
            )}
          </>
        )}

        <div className="h-6" />
      </nav>

      {/* ── Logout ── */}
      <div className="sticky bottom-0 z-20 shrink-0 border-t border-white/10 bg-black/10 p-3 pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 py-3 text-sm font-bold text-rose-200 transition hover:border-rose-400/35 hover:bg-rose-500/20 hover:text-white"
        >
          <FaSignOutAlt className="text-base" />
          {showText && "Logout"}
        </button>
      </div>
    </aside>
  );
}
