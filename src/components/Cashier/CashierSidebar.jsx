import React, { useEffect, useMemo, useRef, useCallback } from "react";
import {
  FaChartPie,
  FaUserShield,
  FaUsers,
  FaCashRegister,
  FaReceipt,
  FaChartLine,
  FaSignOutAlt,
  FaChevronRight,
  FaAsterisk,
  FaCalendarAlt,
} from "react-icons/fa";
import { PanelLeft, PanelRight } from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

function useTilt({
  max = 10,
  scale = 1.02,
  perspective = 950,
  disabled = false,
} = {}) {
  const ref = useRef(null);
  const raf = useRef(0);
  const state = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;

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

export default function CashierSidebar({
  mode = "desktop",
  active = "dashboard",
  setActive = () => {},
  onLogout = () => {},
  title = "RMS",
  subtitle = "Cashier",
  sidebarOpen = true,
  setSidebarOpen = () => {},
}) {
  const isDrawer = mode === "drawer";
  const showText = sidebarOpen;

  const userName = useMemo(() => {
    try {
      const raw =
        localStorage.getItem("user") || localStorage.getItem("authUser");
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.name || parsed?.fullName || "Cashier";
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage:", error);
    }
    return "Cashier";
  }, []);

  const headerTiltRef = useTilt({ disabled: true });

  const ACTIVE_GRAD = "bg-emerald-500";
  const ACTIVE_TXT = "text-slate-950";
  const ACTIVE_BR = "border-emerald-400";

  const navBtnBase =
    "group relative flex w-full items-center gap-3 rounded-xl border text-[13px] font-semibold transition-all";

  const navBtnPad = sidebarOpen
    ? "px-3 py-2.5"
    : "px-3 py-2.5 justify-center";

  const onSelect = useCallback(
    (key) => {
      setActive(key);
      if (isDrawer) setSidebarOpen(false);
    },
    [isDrawer, setActive, setSidebarOpen]
  );

  const navItems = [
    { key: "dashboard", icon: <FaChartPie />, label: "Dashboard" },
    { key: "pointOfSale", icon: <FaCashRegister />, label: "Point of Sale" },
    { key: "customer", icon: <FaUserShield />, label: "Customer" },
    { key: "finance", icon: <FaReceipt />, label: "Finance" },
    { key: "reports", icon: <FaChartLine />, label: "Reports" },
  ];

  return (
    <aside
      className={cn(
        isDrawer ? "h-[100dvh]" : "h-full",
        "overflow-hidden rounded-2xl border border-slate-800",
        "bg-slate-950 shadow-[0_20px_60px_rgba(15,23,42,0.20)]",
        "flex flex-col",
        isDrawer
          ? "w-full"
          : sidebarOpen
          ? "w-[276px] max-w-[86vw]"
          : "w-[80px]"
      )}
    >
      <div className="relative p-3 shrink-0">
        <div
          ref={headerTiltRef}
          className={cn(
            "rounded-xl border border-slate-800 bg-slate-900",
            sidebarOpen ? "p-4" : "p-3"
          )}
        >
          <div
            className={cn(
              "flex items-center",
              sidebarOpen ? "gap-3" : "justify-center"
            )}
          >
            {sidebarOpen && (
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white truncate">
                  {title}
                </h2>
                <p className="text-[11px] font-medium text-slate-400 truncate">
                  {subtitle}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (isDrawer) {
                  setSidebarOpen(false);
                } else {
                  setSidebarOpen((prev) => !prev);
                }
              }}
              className={cn(
                "ml-auto grid h-8 w-8 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white",
                !sidebarOpen && "ml-0"
              )}
              aria-label={isDrawer ? "Close sidebar" : "Toggle sidebar"}
              title={isDrawer ? "Close" : "Collapse sidebar"}
            >
              {isDrawer ? (
                <span className="font-black text-slate-300">×</span>
              ) : sidebarOpen ? (
                <PanelLeft size={18} className="text-slate-300" />
              ) : (
                <PanelRight size={18} className="text-slate-300" />
              )}
            </button>
          </div>

          {sidebarOpen && (
            <div
              className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-100"
            >
              <p className="text-sm font-semibold">Welcome, {userName}</p>
              <p className="text-xs opacity-90">Cashier workspace ready!</p>
            </div>
          )}
        </div>
      </div>

      <nav className="relative z-10 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2 pb-3 [-webkit-overflow-scrolling:touch]">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className={cn(
              navBtnBase,
              navBtnPad,
              active === item.key
                ? cn(ACTIVE_GRAD, ACTIVE_TXT, ACTIVE_BR, "shadow-md shadow-emerald-950/20")
                : "border-transparent bg-transparent text-slate-300 hover:border-white/5 hover:bg-white/[0.06] hover:text-white"
            )}
            title={item.label}
            aria-label={item.label}
          >
            <span className="text-lg">{item.icon}</span>
            {showText && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                <FaChevronRight className="text-xs opacity-60" />
              </>
            )}
          </button>
        ))}

        <div className="h-6" />
      </nav>

      <div className="sticky bottom-0 z-20 shrink-0 border-t border-slate-800 bg-slate-950 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 py-2.5 text-[13px] font-semibold text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-200"
        >
          <FaSignOutAlt className="text-base" />
          {showText && "Logout"}
        </button>
      </div>
    </aside>
  );
}