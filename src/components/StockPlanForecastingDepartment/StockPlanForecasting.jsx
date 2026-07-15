import React, { Suspense, useEffect, useMemo, useState } from "react";
import { logoutOrReturnToDepartmentSelector } from "../../utils/authRedirect";
import { FaBars, FaCog } from "react-icons/fa";

/* ================== EXISTING COMPONENTS ================== */
import StockPlanForecastingSidebar from "./StockPlanForecastingSidebar";
import StockPlanForecastingSalesDataImportIntegration from "./StockPlanForecastingSalesDataImportIntegration";
import StockPlanForecastingDemandForecastSheet from "./StockPlanForecastingDemandForecastSheet";
import StockPlanForecastingPurchasePlanCreation from "./StockPlanForecastingPurchasePlanCreation";
import StockPlanForecastingBudgetAllocation from "./StockPlanForecastingBudgetAllocation";
import StockPlanForecastingForecastApproval from "./StockPlanForecastingForecastApproval";
import StockPlanForecastingPlanVsActualPlanningReports from "./StockPlanForecastingPlanvsActualPlanningReports";
import StockPlanForecastingForecastAccuracyReport from "./StockPlanForecastingForecastAccuracyReport";
import StockPlanForecastingDemandvsStockGapAnalysis from "./StockPlanForecastingDemandvsStockGapAnalysis";
import StockPlanForecastingSettings from "./StockPlanForecastingSettings";
import StockPlanForecastingDashboard from "./StockPlanForecastingDashboard";

/* ✅ NEWLY ADDED PAGES */
import Upload from "./Upload";
import ForecastAndStockGap from "./ForecastAndStockGap";

const COMPANY_NAME = "RMS";

/* --------------------- BRAND STRIP --------------------- */
function BrandStrip() {
  return (
    <div className="w-full h-[4px] shrink-0 overflow-hidden">
      <div className="w-full h-full bg-gradient-to-r from-[#0B2A4A] via-[#1D4ED8] to-[#38BDF8]" />
    </div>
  );
}

/* --------------------- PAGE TITLES --------------------- */
function labelFromKey(key) {
  switch (key) {
    case "dashboard":
    case "dashboard.overview":
      return "Dashboard";

    case "plan.salesImport":
      return "Sales Data Import / Integration";
    case "plan.demandForecast":
      return "Demand Forecast Sheet";
    case "plan.purchasePlan":
      return "Purchase Plan Creation";
    case "plan.budgetAllocation":
      return "Budget Allocation";
    case "plan.approvalWorkflow":
      return "Forecast Approval Workflow";

    case "reports.planVsActual":
      return "Plan vs Actual Purchase";
    case "reports.forecastAccuracy":
      return "Forecast Accuracy Report";
    case "reports.stockGap":
      return "Demand vs Stock Gap Analysis";

    /* ✅ NEW LABELS */
    case "upload.data":
      return "Data Upload Center";
    case "reports.forecastStockGap":
      return "Forecast & Stock Gap Report";

    case "settings":
      return "Settings";

    default:
      return "Stock Plan Forecasting";
  }
}

/* --------------------- LOADER --------------------- */
function PageLoader() {
  return (
    <div className="p-6">
      <p className="text-sm font-semibold text-slate-900">Loading…</p>
    </div>
  );
}

function MinimalPlaceholder({ title }) {
  return (
    <div className="p-6">
      <div className="rounded-2xl border border-[#D6DEE8] bg-white/90 p-6">
        <p className="text-sm font-semibold text-slate-900">{String(title)}</p>
      </div>
    </div>
  );
}

/* --------------------- MAIN COMPONENT --------------------- */
export default function StockPlanForecasting() {
  const [active, setActive] = useState("dashboard.overview");
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const pageTitle = useMemo(() => labelFromKey(active), [active]);

  useEffect(() => {
    document.title = `${pageTitle} | RMS Stock Plan Forecasting`;
  }, [pageTitle]);

  const handleLogout = () => logoutOrReturnToDepartmentSelector();
  const handleOpenSettings = () => setSettingsOpen(true);
  const handleCloseSettings = () => setSettingsOpen(false);

  useEffect(() => setSettingsOpen(false), [active]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = prev);
  }, [drawerOpen]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setDrawerOpen(false);
    if (drawerOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  /* --------------------- PAGE SWITCHER --------------------- */
  const renderPage = () => {
    if (settingsOpen)
      return <StockPlanForecastingSettings onClose={handleCloseSettings} />;

    switch (active) {
      case "dashboard":
      case "dashboard.overview":
        return <StockPlanForecastingDashboard />;

      case "plan.salesImport":
        return <StockPlanForecastingSalesDataImportIntegration />;

      case "plan.demandForecast":
        return <StockPlanForecastingDemandForecastSheet />;

      case "plan.purchasePlan":
        return <StockPlanForecastingPurchasePlanCreation />;

      case "plan.budgetAllocation":
        return <StockPlanForecastingBudgetAllocation />;

      case "plan.approvalWorkflow":
        return <StockPlanForecastingForecastApproval />;

      case "reports.planVsActual":
        return <StockPlanForecastingPlanVsActualPlanningReports />;

      case "reports.forecastAccuracy":
        return <StockPlanForecastingForecastAccuracyReport />;

      case "reports.stockGap":
        return <StockPlanForecastingDemandvsStockGapAnalysis />;

      /* ✅ NEW PAGE — Data Upload Center */
      case "upload.data":
        return <Upload />;

      /* ✅ NEW PAGE — Forecast & Stock Gap Report */
      case "reports.forecastStockGap":
        return <ForecastAndStockGap />;

      default:
        return <MinimalPlaceholder title={pageTitle} />;
    }
  };

  /* --------------------- MAIN UI --------------------- */
  return (
    <div className="h-[100dvh] w-full overflow-hidden flex flex-col text-slate-900">
      {/* Background Blur Gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#7d95b8]" />
        <div className="absolute -top-52 -left-56 h-[680px] w-[680px] rounded-full bg-sky-400/20 blur-[170px]" />
        <div className="absolute top-1/4 -right-60 h-[640px] w-[640px] rounded-full bg-blue-600/15 blur-[190px]" />
        <div className="absolute -bottom-56 left-1/4 h-[720px] w-[720px] rounded-full bg-indigo-700/10 blur-[210px]" />
      </div>

      {/* ---------------- MOBILE HEADER ---------------- */}
      <div className="lg:hidden sticky top-0 z-50 bg-white/85 backdrop-blur-2xl border-b border-[#D6DEE8]">
        <BrandStrip />
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-xl border border-[#D6DEE8] bg-white shadow-sm active:scale-[0.98] transition"
            aria-label="Open sidebar"
          >
            <FaBars size={18} />
          </button>

          <div className="text-center">
            <h1 className="text-sm font-semibold text-slate-900">
              {COMPANY_NAME} — Forecasting
            </h1>
            <p className="text-xs text-slate-600">
              {settingsOpen ? "Settings" : pageTitle}
            </p>
          </div>

          <button
            onClick={handleOpenSettings}
            className="p-2 rounded-xl border border-[#D6DEE8] bg-white shadow-sm active:scale-[0.98] transition"
            aria-label="Open settings"
          >
            <FaCog size={16} />
          </button>
        </div>
      </div>

      {/* ---------------- MAIN LAYOUT ---------------- */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-6 px-3 lg:px-4 py-3 lg:py-4">
        {/* Sidebar (Desktop) */}
        <aside className="hidden lg:block shrink-0 lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)]">
          <StockPlanForecastingSidebar
            mode="desktop"
            active={active}
            setActive={setActive}
            onLogout={handleLogout}
            title="RMS"
            subtitle="Stock Plan Forecasting"
            sidebarOpen={desktopSidebarOpen}
            setSidebarOpen={setDesktopSidebarOpen}
          />
        </aside>

        {/* Drawer (Mobile Sidebar) */}
        {drawerOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-[1000] lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <div
              className="fixed top-0 left-0 z-[1001] lg:hidden
                         h-[100dvh] w-[86vw] max-w-[360px]
                         overflow-y-auto overscroll-contain
                         pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
                         rounded-r-3xl shadow-[0_30px_90px_rgba(15,23,42,0.25)]"
            >
              <StockPlanForecastingSidebar
                mode="drawer"
                active={active}
                setActive={(k) => {
                  setActive(k);
                  setDrawerOpen(false);
                }}
                onLogout={handleLogout}
                title="RMS"
                subtitle="Stock Plan Forecasting"
                sidebarOpen={true}
                setSidebarOpen={() => setDrawerOpen(false)}
              />
            </div>
          </>
        )}

        {/* ---------------- MAIN CONTENT ---------------- */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3 lg:gap-6 overflow-hidden">
          {/* Header */}
          <header className="hidden lg:block sticky top-4 z-40 rounded-2xl border border-[#D6DEE8] bg-white/80 backdrop-blur-2xl shadow-[0_18px_50px_rgba(15,23,42,0.08)] overflow-hidden">
            <BrandStrip />
            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Stock Plan Forecasting Panel
                </h1>
                <p className="text-sm text-slate-700">
                  {settingsOpen ? "Settings" : pageTitle}
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenSettings}
                aria-label="Open settings"
                className="
                  shrink-0
                  p-2.5
                  rounded-xl
                  border border-[#D6DEE8]
                  bg-white
                  text-slate-700
                  shadow-sm
                  hover:bg-slate-50
                  hover:text-slate-900
                  active:scale-[0.96]
                  transition
                "
              >
                <FaCog size={18} />
              </button>
            </div>
          </header>

          {/* ---------------- PAGE CONTAINER ---------------- */}
          <div className="flex-1 min-h-0 rounded-3xl border border-[#D6DEE8] bg-white/75 backdrop-blur-2xl shadow-[0_30px_90px_rgba(15,23,42,0.10)] overflow-hidden">
            <main className="h-full min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
              <div className="sticky top-0 z-30 bg-white/75 backdrop-blur-2xl">
                <BrandStrip />
              </div>

              <div className="px-6 pt-6 pb-3">
                <h2 className="text-2xl font-bold text-slate-900">
                  {settingsOpen ? "Settings" : pageTitle}
                </h2>
                <p className="text-sm text-slate-600">RMS • Stock Plan Forecasting</p>
              </div>

              <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
