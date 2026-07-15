import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaChartPie,
  FaChevronDown,
  FaChevronRight,
  FaSignOutAlt,
  FaChartLine,
  FaFileAlt,
  FaCogs,
  FaTable,
  FaUpload,
  FaCheckCircle,
  FaMoneyBillWave,
  FaDatabase,
} from "react-icons/fa";
import { PanelLeft, PanelRight } from "lucide-react";

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

function groupOf(key) {
  const k = String(key || "");
  if (k.startsWith("plan.")) return "plan";
  if (k.startsWith("reports.")) return "reports";
  if (k.startsWith("upload.")) return "upload";
  return "root";
}

export default function StockPlanForecastingSidebar({
  mode = "desktop",
  active,
  setActive,
  onLogout,
  title = "RMS",
  subtitle = "Stock Plan Forecasting",
  sidebarOpen = true,
  setSidebarOpen,
}) {
  const isDrawer = mode === "drawer";
  const [planOpen, setPlanOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const userName = useMemo(() => {
    try {
      const raw = localStorage.getItem("user") || localStorage.getItem("authUser");
      if (raw) {
        const u = JSON.parse(raw);
        return u?.name || u?.fullName || "User";
      }
    } catch {}
    return "User";
  }, []);

  useEffect(() => {
    const g = groupOf(active);
    setPlanOpen(g === "plan");
    setReportsOpen(g === "reports");
    setUploadOpen(g === "upload");
  }, [active]);

  const showText = sidebarOpen;

  const SIDEBAR_BG = "bg-[#7d95b8]";
  const SIDEBAR_BORDER = "border-[#C7D2FE]";
  const TEXT_MAIN = "text-[#111827]";
  const ACTIVE_GRAD = "bg-gradient-to-r from-[#1E3A5F] via-[#2563EB] to-[#60A5FA]";
  const ACTIVE_TXT = "text-white";
  const LOGOUT_GRAD = "bg-gradient-to-r from-rose-700 via-red-700 to-rose-800";
  const LOGOUT_TXT = "text-white";
  const BTN_IDLE = "bg-white/90 border-[#D6DEE8] hover:bg-[#EEF3FA]";
  const CHILD_IDLE = "bg-white/80 border-[#D6DEE8] hover:bg-[#7d95b8]";

  const topBtnBase =
    "group relative w-full flex items-center gap-3 rounded-2xl text-sm font-semibold transition border shadow-sm hover:-translate-y-[2px] hover:shadow-md active:translate-y-0";
  const topBtnPad = sidebarOpen ? "px-4 py-3" : "px-3 py-3 justify-center";

  const childBtnBase =
    "w-full flex items-center gap-3 rounded-xl text-sm border shadow-sm hover:-translate-y-[2px] hover:shadow-md active:translate-y-0 transition-all duration-200";
  const childBtnPad = sidebarOpen ? "px-4 py-3" : "px-3 py-3 justify-center";

  const headerTiltRef = useTilt({ disabled: isDrawer });
  const logoutTiltRef = useTilt({ disabled: isDrawer });

  const goTo = (nextKey) => setActive(nextKey);

  const groupHeader = (icon, label, open, groupKey, isActiveGroup) => (
    <button
      onClick={() => {
        if (groupKey === "plan") setPlanOpen(!planOpen);
        if (groupKey === "reports") setReportsOpen(!reportsOpen);
        if (groupKey === "upload") setUploadOpen(!uploadOpen);
      }}
      className={cn(
        topBtnBase,
        topBtnPad,
        isActiveGroup ? cn(ACTIVE_GRAD, ACTIVE_TXT, "border-transparent") : cn(BTN_IDLE, TEXT_MAIN)
      )}
    >
      <span className="text-lg">{icon}</span>
      {showText && (
        <>
          <span className="flex-1 text-left">{label}</span>
          <FaChevronDown
            className={cn("text-xs transition-transform text-[#475569]", open && "rotate-180")}
          />
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
          ? cn(ACTIVE_GRAD, ACTIVE_TXT, "border-transparent")
          : cn(CHILD_IDLE, TEXT_MAIN)
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
        "rounded-3xl border overflow-hidden flex flex-col",
        SIDEBAR_BG,
        SIDEBAR_BORDER,
        "shadow-[0_20px_60px_rgba(15,23,42,0.12)]",
        isDrawer ? "w-full" : sidebarOpen ? "w-[320px]" : "w-[96px]"
      )}
    >
      {/* Header */}
      <div className="p-3 shrink-0">
        <div
          ref={headerTiltRef}
          className="rounded-2xl border border-[#D6DEE8] bg-white/90 p-4 shadow-sm"
        >
          <div className={cn("flex items-center", sidebarOpen ? "gap-3" : "justify-center")}>
            {sidebarOpen && (
              <button
                type="button"
                onClick={() => setActive("dashboard.overview")}
                className="min-w-0 text-left group"
                title="Go to Dashboard"
              >
                <h2 className="text-sm font-bold text-[#0F172A] truncate group-hover:underline">
                  {title}
                </h2>
                <p className="text-xs font-semibold text-[#475569] truncate">{subtitle}</p>
              </button>
            )}
            <button
              onClick={() => {
                if (isDrawer) return setSidebarOpen?.(false);
                setSidebarOpen?.((s) => !s);
              }}
              className="ml-auto grid place-items-center h-9 w-9 rounded-xl border border-[#D6DEE8] bg-white hover:bg-[#EEF3FA]"
              aria-label="Toggle sidebar"
            >
              {isDrawer ? (
                <span className="text-[#0F172A] font-black">×</span>
              ) : sidebarOpen ? (
                <PanelLeft size={18} />
              ) : (
                <PanelRight size={18} />
              )}
            </button>
          </div>

          {sidebarOpen && (
            <div className="mt-4 rounded-xl p-3 text-white bg-gradient-to-r from-[#1E3A5F] to-[#2563EB] shadow-[0_16px_35px_rgba(37,99,235,0.22)]">
              <p className="text-sm font-semibold">Welcome, {userName}</p>
              <p className="text-xs opacity-90">Forecast & planning ready!</p>
            </div>
          )}
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 min-h-0 px-3 space-y-3 overflow-y-auto pb-3">
        {/* Dashboard */}
        {childItem("dashboard.overview", <FaChartPie />, "Dashboard")}

        {/* Forecasting & Planning */}
        {groupHeader(
          <FaCogs />,
          "Forecasting & Planning",
          planOpen,
          "plan",
          String(active).startsWith("plan.")
        )}
        {planOpen && (
          <div className={cn("space-y-2", sidebarOpen && "pl-3")}>
            {childItem("plan.salesImport", <FaUpload />, "Sales Data Import / Integration")}
            {childItem("plan.demandForecast", <FaTable />, "Demand Forecast Sheet")}
            {childItem("plan.purchasePlan", <FaChartLine />, "Purchase Plan Creation")}
            {childItem("plan.budgetAllocation", <FaMoneyBillWave />, "Budget Allocation")}
            {childItem("plan.approvalWorkflow", <FaCheckCircle />, "Forecast Approval Workflow")}
          </div>
        )}

        {/* ✅ NEW: Data Management Section */}
        {groupHeader(
          <FaDatabase />,
          "Data Management",
          uploadOpen,
          "upload",
          String(active).startsWith("upload.")
        )}
        {uploadOpen && (
          <div className={cn("space-y-2", sidebarOpen && "pl-3")}>
            {childItem("upload.data", <FaUpload />, "Data Upload Center")}
          </div>
        )}

        {/* Reports */}
        {groupHeader(
          <FaFileAlt />,
          "Reports",
          reportsOpen,
          "reports",
          String(active).startsWith("reports.")
        )}
        {reportsOpen && (
          <div className={cn("space-y-2", sidebarOpen && "pl-3")}>
            {childItem("reports.planVsActual", <FaChartLine />, "Plan vs Actual Purchase")}
            {childItem("reports.forecastAccuracy", <FaChartLine />, "Forecast Accuracy Report")}
            {childItem("reports.stockGap", <FaChartLine />, "Demand vs Stock Gap Analysis")}
            {/* ✅ NEW: Forecast & Stock Gap Report */}
            {childItem("reports.forecastStockGap", <FaChartLine />, "Forecast & Stock Gap Report")}
          </div>
        )}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-[#D6DEE8] bg-[#F5F7FA]">
        <button
          ref={logoutTiltRef}
          onClick={onLogout}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold",
            LOGOUT_GRAD,
            LOGOUT_TXT,
            "shadow-md shadow-red-800/30 hover:-translate-y-[2px] hover:shadow-lg transition"
          )}
        >
          <FaSignOutAlt />
          {showText && "Logout"}
        </button>
      </div>
    </aside>
  );
}
