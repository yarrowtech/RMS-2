import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  CreditCard,
  Users,
  Receipt,
  FileText,
  BarChart3,
  LogOut,
  Wallet,
} from "lucide-react";
import { FaMoneyBillWave, FaChevronRight } from "react-icons/fa";
import { PanelLeft, PanelRight } from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const sidebarItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "revenue", label: "Revenue", icon: TrendingUp },
  { id: "expenses", label: "Expenses", icon: CreditCard },
  {
    id: "vendorPayments",
    label: "Vendor Payments",
    icon: Wallet,
    subItems: [
      { id: "purchaseInvoice", label: "Purchase Invoice" },
      { id: "arVoucher", label: "AR Voucher" },
      { id: "apVoucher", label: "AP Voucher" },
      { id: "generalVoucher", label: "General Voucher" },
      { id: "contraVoucher", label: "Contra Voucher" },
    ],
  },
  { id: "payroll", label: "Payroll", icon: Users },
  { id: "taxGst", label: "GST & Tax", icon: Receipt },
  { id: "profitLoss", label: "Profit & Loss", icon: BarChart3 },
  { id: "reports", label: "Financial Reports", icon: FileText },
];

/* ----------------------- Smooth 3D Tilt Hook ----------------------- */
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

export default function FinanceSidebar({
  mode = "desktop",
  active = "dashboard",
  setActive = () => { },
  onLogout = () => { },
  title = "Finance",
  subtitle = "Department Dashboard",
  sidebarOpen = true,
  setSidebarOpen = () => { },
}) {
  const [vendorOpen, setVendorOpen] = useState(
    active === "vendorPayments" ||
    active === "purchaseInvoice" ||
    active === "arVoucher" ||
    active === "apVoucher" ||
    active === "generalVoucher" ||
    active === "contraVoucher"
  );

  useEffect(() => {
    if (["purchaseInvoice", "arVoucher", "apVoucher", "generalVoucher", "contraVoucher", "vendorPayments"].includes(active)) {
      setVendorOpen(true);
    } else {
      setVendorOpen(false);
    }
  }, [active]);

  const isDrawer = mode === "drawer";
  const isDesktop = mode === "desktop";

  const showText = sidebarOpen || !isDesktop;

  const headerTiltRef = useTilt({
    max: 10,
    scale: 1.02,
    perspective: 950,
    disabled: isDrawer,
  });

  const userName = useMemo(() => {
    try {
      const raw =
        localStorage.getItem("user") || localStorage.getItem("authUser");

      if (raw) {
        const user = JSON.parse(raw);
        return user?.name || user?.fullName || "User";
      }
    } catch {
      // ignore localStorage parse error
    }

    return "User";
  }, []);

  const ACTIVE_GRAD = "bg-gradient-to-r from-indigo-700 to-slate-800";
  const ACTIVE_TEXT = "text-slate-50";

  const navBtnBase =
    "group relative w-full flex items-center gap-3 rounded-2xl text-sm font-semibold transition " +
    "bg-slate-200 border border-slate-300 shadow-sm cursor-pointer " +
    "hover:-translate-y-[2px] hover:shadow-lg active:translate-y-0";

  const navBtnPad = showText ? "px-4 py-3" : "px-3 py-3 justify-center";

  const handleSelect = (id) => {
    setActive(id);

    if (isDrawer) {
      setSidebarOpen(false);
    }
  };

  return (
    <aside
      className={cn(
        isDrawer ? "h-[100dvh]" : "h-full",
        "rounded-3xl border border-slate-300 overflow-hidden",
        "bg-slate-100/70 backdrop-blur-2xl shadow-[0_30px_90px_rgba(15,23,42,0.18)]",
        "flex flex-col",
        isDrawer
          ? "w-full"
          : sidebarOpen
            ? "w-[320px] max-w-[86vw]"
            : "w-[96px]"
      )}
    >
      {/* Header */}
      <div className="relative p-3 shrink-0">
        <div
          ref={headerTiltRef}
          className={cn(
            "rounded-2xl border border-slate-300 bg-white/60 shadow-sm transition-transform duration-200",
            showText ? "p-4" : "p-3"
          )}
          style={{
            backgroundImage:
              "radial-gradient(800px circle at var(--mx,50%) var(--my,50%), rgba(99,102,241,0.18) 0%, rgba(99,102,241,0) 45%)",
          }}
        >
          <div
            className={cn(
              "flex items-center",
              showText ? "gap-3" : "justify-center"
            )}
          >
            {showText && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-700 to-slate-800 text-white shadow-md">
                <FaMoneyBillWave size={20} />
              </div>
            )}

            {showText && (
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  {title}
                </h2>
                <p className="text-xs font-semibold text-slate-700 truncate">
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
                "ml-auto grid place-items-center rounded-xl cursor-pointer",
                "border border-slate-300 bg-slate-200",
                "hover:bg-slate-300 transition",
                "h-9 w-9",
                !sidebarOpen && isDesktop && "ml-0"
              )}
              aria-label={isDrawer ? "Close sidebar" : "Toggle sidebar"}
              title={isDrawer ? "Close" : "Collapse sidebar"}
            >
              {isDrawer ? (
                <span className="text-slate-800 font-black">Ã—</span>
              ) : sidebarOpen ? (
                <PanelLeft size={18} className="text-slate-800" />
              ) : (
                <PanelRight size={18} className="text-slate-800" />
              )}
            </button>
          </div>

          {showText && (
            <div
              className={cn(
                "mt-4 rounded-xl p-3 shadow-lg shadow-slate-900/15 cursor-pointer hover:-translate-y-0.5 transform transition-all duration-300 will-change-transform hover:shadow-[0_20px_50px_rgba(99,102,241,0.25)]",
                ACTIVE_GRAD,
                ACTIVE_TEXT
              )}
            >
              <p className="text-sm font-semibold">Welcome, {userName}</p>
              <p className="text-xs opacity-90">Finance operations ready!</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex-1 min-h-0 px-3 space-y-3 overflow-y-auto overscroll-contain pb-3 [-webkit-overflow-scrolling:touch]">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const hasSubItems = !!item.subItems;
          const isParentActive = hasSubItems && (active === item.id || item.subItems.some(sub => sub.id === active));
          const isActive = !hasSubItems ? active === item.id : isParentActive;

          const mainButton = (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (hasSubItems) {
                  if (!showText) {
                    setSidebarOpen(true);
                    setVendorOpen(true);
                  } else {
                    setVendorOpen(!vendorOpen);
                  }
                } else {
                  handleSelect(item.id);
                }
              }}
              className={cn(
                navBtnBase,
                navBtnPad,
                isActive
                  ? cn(ACTIVE_GRAD, ACTIVE_TEXT, "border-slate-800/20")
                  : "text-slate-800"
              )}
              title={item.label}
              aria-label={item.label}
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                  isActive
                    ? "bg-white/10 text-white"
                    : "bg-white/50 text-slate-700 group-hover:bg-white"
                )}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              </span>

              {showText && (
                <>
                  <span className="flex-1 text-left truncate">
                    {item.label}
                  </span>
                  <FaChevronRight
                    className={cn(
                      "text-xs opacity-60 transition-transform duration-200",
                      hasSubItems && vendorOpen && "rotate-90"
                    )}
                  />
                </>
              )}

              {!showText && (
                <div className="fixed left-[96px] z-50 ml-2 hidden pointer-events-none group-hover:block">
                  <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-xl whitespace-nowrap">
                    {item.label}
                  </div>
                </div>
              )}
            </button>
          );

          if (hasSubItems) {
            return (
              <div key={item.id} className="w-full flex flex-col gap-1">
                {mainButton}
                {showText && vendorOpen && (
                  <div className="mt-1 ml-4 pl-3 border-l-2 border-indigo-400/40 flex flex-col gap-1.5 transition-all duration-300">
                    {item.subItems.map((subItem) => {
                      const isSubActive = active === subItem.id;
                      return (
                        <button
                          key={subItem.id}
                          type="button"
                          onClick={() => handleSelect(subItem.id)}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-xl text-xs font-semibold transition px-3 py-2 cursor-pointer shadow-sm border",
                            isSubActive
                              ? "bg-gradient-to-r from-indigo-700/90 to-slate-800/90 text-white border-slate-800/20"
                              : "bg-slate-200/80 hover:bg-white text-slate-700 hover:text-indigo-700 hover:-translate-y-[1px] border-slate-300"
                          )}
                        >
                          <span className={cn(
                            "h-2 w-2 rounded-full",
                            isSubActive ? "bg-indigo-400" : "bg-slate-450"
                          )} />
                          <span className="truncate">{subItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return mainButton;
        })}



        <div className="h-6" />
      </nav>

      {/* Footer */}
      <div className="shrink-0 sticky bottom-0 z-20 p-3 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={onLogout}
          className={cn(
            "w-full flex items-center justify-center gap-2 cursor-pointer",
            "rounded-2xl py-3",
            "text-sm font-semibold text-white",
            "bg-gradient-to-r from-rose-600 via-red-600 to-rose-600",
            "shadow-md hover:brightness-110 active:scale-[0.99]",
            "transition-all duration-200"
          )}
        >
          <LogOut size={18} />
          {showText && "Logout"}
        </button>
      </div>
    </aside>
  );
}


