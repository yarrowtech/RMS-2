import React, { Suspense, useMemo, useState } from "react";
import { logoutOrReturnToDepartmentSelector } from "../../utils/authRedirect";
import { FaBars } from "react-icons/fa";
import { Settings as SettingsIcon } from "lucide-react";
import CashierSidebar from "./CashierSidebar";
import CashierDashboard from "./CashierDashboard";
import CashierPOS from "./CashierPOS";
import CashierSettings from "./CashierSettings";
import CashierCustomer from "./CashierCustomer";
import CashierFinance from "./CashierFinance";
import CashierReport from "./CashierReport";

const COMPANY_NAME = "RMS";

function labelFromKey(key) {
  switch (key) {
    case "dashboard":
      return "Dashboard";
    case "pointOfSale":
      return "Point of Sale";
    case "customer":
      return "Customer";
    case "finance":
      return "Finance";
    case "reports":
      return "Reports";
    case "__settings":
      return "Settings";
    default:
      return "Cashier Panel";
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
    <div className="h-full w-full overflow-y-auto p-6">
      <div className="rounded-3xl bg-white/90 p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">
          {title || "Cashier Panel"}
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          {subtitle || "Content will go here."}
        </p>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-4">
          <p className="text-xs font-semibold text-slate-600">
            Active: <span className="text-slate-900">{title || "Cashier Panel"}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Cashier() {
  const [active, setActive] = useState("dashboard");
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const pageTitle = useMemo(() => labelFromKey(active), [active]);

  const handleLogout = () => logoutOrReturnToDepartmentSelector();

  const onSettingsClick = () => setActive("__settings");

  const renderPage = () => {
    switch (active) {
      case "dashboard":
        return (
          <CashierDashboard />
        );

      case "pointOfSale":
        return <CashierPOS />;

      case "customer":
        return (
          <CashierCustomer  />
        );

      case "finance":
        return (
          <CashierFinance />
        );

      case "reports":
        return (
          <CashierReport  />
        );

      case "__settings":
        return <CashierSettings />;

      default:
        return <MinimalPlaceholder title="Cashier Panel" />;
    }
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#F3F6F8] text-slate-900">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700 transition hover:bg-slate-100"
            aria-label="Open sidebar"
            title="Menu"
          >
            <FaBars size={18} className="text-slate-900" />
          </button>

          <div className="text-center">
            <h1 className="text-base font-semibold text-slate-900">
              {COMPANY_NAME} — Cashier Panel
            </h1>
            <p className="text-xs font-medium text-emerald-700">{pageTitle}</p>
          </div>

          <button
            type="button"
            onClick={onSettingsClick}
            className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700 transition hover:bg-slate-100"
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon size={18} className="text-slate-900" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row lg:gap-4 lg:p-4">
        {/* Desktop Sidebar */}
        <aside className="hidden shrink-0 lg:sticky lg:top-4 lg:block lg:h-[calc(100dvh-2rem)]">
          <CashierSidebar
            mode="desktop"
            active={active}
            setActive={setActive}
            onLogout={handleLogout}
            title="RMS"
            subtitle="Cashier"
            sidebarOpen={desktopSidebarOpen}
            setSidebarOpen={setDesktopSidebarOpen}
          />
        </aside>

        {/* Mobile Drawer Sidebar */}
        {drawerOpen && (
          <>
            <div
              className="fixed inset-0 z-[1000] bg-black/40 lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />

            <div className="fixed left-0 top-0 z-[1001] h-[100dvh] w-[86vw] max-w-[360px] overflow-y-auto overscroll-contain rounded-r-3xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:hidden">
              <CashierSidebar
                mode="drawer"
                active={active}
                setActive={(key) => {
                  setActive(key);
                  setDrawerOpen(false);
                }}
                onLogout={handleLogout}
                title="RMS"
                subtitle="Cashier"
                sidebarOpen={true}
                setSidebarOpen={() => setDrawerOpen(false)}
              />
            </div>
          </>
        )}

        {/* Main Content */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          <header className="sticky top-4 z-40 hidden min-h-16 items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.06)] lg:flex">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                Cashier Panel
              </h1>
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">{pageTitle}</p>
            </div>

            <button
              type="button"
              onClick={onSettingsClick}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon size={18} className="text-slate-800" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <main className="h-full min-h-0 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
              <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}