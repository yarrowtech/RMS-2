import React, { Suspense, useEffect, useMemo, useState } from "react";
import { logoutOrReturnToDepartmentSelector } from "../../utils/authRedirect";
import { FaBars } from "react-icons/fa";
import { AlertTriangle, CircleHelp, Settings as SettingsIcon } from "lucide-react";
import InternalNotificationBell from "../InternalNotificationBell.jsx";
import InternalChatPanel from "../InternalChatPanel.jsx";
import CashierSidebar from "./CashierSidebar";
import CashierDashboard from "./CashierDashboard";
import CashierPOS from "./CashierPOS";
import CashierSettings from "./CashierSettings";
import RetailerHelpSupport from "../RetailerHelpSupport";
import CashierCustomer from "./CashierCustomer";
import CashierFinance from "./CashierFinance";
import CashierReport from "./CashierReport";
import CashierGuideModal, { GuideButton } from "./CashierGuideModal";
import { Lock, ShieldCheck, MonitorCog, Info } from "lucide-react";
import { CASHIER_API_BASE } from "./cashierApi";
import { getCachedTerminalRole, registerTerminal, fetchTerminalRole } from "./terminalIdentity";

const TERMINAL_ACCESS_GUIDE_STEPS = [
  {
    icon: MonitorCog,
    badgeClass: "bg-violet-100 text-violet-600",
    title: "Access is per-terminal, not per-login",
    text: "The Cashier login is shared across every POS machine at this store, so it can't tell devices apart. Instead, each physical terminal is given its own 'Cashier' or 'Supervisor' access level, independent of who's signed in.",
  },
  {
    icon: Lock,
    badgeClass: "bg-rose-100 text-rose-600",
    title: "'Cashier' terminals only see POS + Customer",
    text: "Dashboard, Finance and Reports are hidden on a Cashier-level terminal — this is the default for every new device, so a sales counter can't see store-wide numbers by default.",
  },
  {
    icon: ShieldCheck,
    badgeClass: "bg-emerald-100 text-emerald-600",
    title: "Grant 'Supervisor' to specific machines",
    text: "Go to Settings → POS Terminal Access, find the device (e.g. the manager's counter), and switch its dropdown from Cashier to Supervisor. That device immediately sees every tab — no re-login needed.",
  },
];

const TERMINAL_ACCESS_GUIDE_NOTES = [
  {
    icon: Info,
    tone: "info",
    title: "Takes effect instantly",
    text: "A role change in Settings applies the next time that terminal loads or switches tabs — it doesn't require logging out.",
  },
  {
    icon: ShieldCheck,
    tone: "caution",
    title: "Enforced on the server too",
    text: "This isn't just hidden tabs — the backend itself rejects Dashboard/Finance/Reports requests from a non-Supervisor terminal, so the restriction holds even if someone tries to call the API directly.",
  },
];

// Tabs hidden from a "cashier"-role terminal. A "supervisor"-role terminal
// (assigned by a store/HQ admin under Settings) sees everything — the
// restriction is per-device, not per-login, since the login is shared
// across every POS machine at a store.
const RESTRICTED_TABS = new Set(["dashboard", "finance", "reports"]);

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
    case "__support":
      return "Help & Support";
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
  const [terminalRole, setTerminalRole] = useState(getCachedTerminalRole());
  const [showTerminalGuide, setShowTerminalGuide] = useState(false);

  useEffect(() => {
    (async () => {
      await registerTerminal(CASHIER_API_BASE);
      const role = await fetchTerminalRole(CASHIER_API_BASE);
      setTerminalRole(role);
    })();
  }, []);

  // A restricted terminal landing on (or stuck on) a tab it just lost
  // access to — e.g. its role was downgraded by an admin mid-session —
  // gets bounced to Point of Sale rather than left on a blank/stale page.
  useEffect(() => {
    if (terminalRole !== "supervisor" && RESTRICTED_TABS.has(active)) {
      setActive("pointOfSale");
    }
  }, [terminalRole, active]);

  const pageTitle = useMemo(() => labelFromKey(active), [active]);

  // CashierPOS owns the offline-bills queue (localStorage), and its own
  // on-screen badge only renders while that tab is mounted — so switching
  // to Dashboard/Customer/Finance/Reports hides it entirely. Poll the same
  // key here so an unsynced count stays visible from anywhere in the module.
  const [unsyncedOfflineCount, setUnsyncedOfflineCount] = useState(0);
  useEffect(() => {
    const checkPending = () => {
      try {
        const raw = localStorage.getItem("rms_cashier_offline_bills_v1");
        const rows = raw ? JSON.parse(raw) : [];
        const count = Array.isArray(rows)
          ? rows.filter((row) => ["pending", "failed"].includes(row?.status)).length
          : 0;
        setUnsyncedOfflineCount(count);
      } catch {
        setUnsyncedOfflineCount(0);
      }
    };
    checkPending();
    const interval = setInterval(checkPending, 5000);
    window.addEventListener("storage", checkPending);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", checkPending);
    };
  }, []);

  const handleLogout = () => {
    // Offline-saved bills live only in this browser's localStorage until
    // synced — logging out doesn't erase them, but if this device gets
    // swapped, reset, or its browser data cleared before anyone syncs,
    // those bills are gone with no server-side copy. Catch it here rather
    // than relying on the cashier noticing the pending banner themselves.
    try {
      const raw = localStorage.getItem("rms_cashier_offline_bills_v1");
      const rows = raw ? JSON.parse(raw) : [];
      const pendingCount = Array.isArray(rows)
        ? rows.filter((row) => ["pending", "failed"].includes(row?.status)).length
        : 0;
      if (pendingCount > 0) {
        const proceed = window.confirm(
          `${pendingCount} offline bill(s) have not been synced yet. If you log out now and this device is reset or its data cleared before syncing, those bills cannot be recovered.\n\nLog out anyway?`
        );
        if (!proceed) return;
      }
    } catch {
      // Never let a storage-read issue block logout itself.
    }
    logoutOrReturnToDepartmentSelector();
  };

  const onSettingsClick = () => setActive("__settings");

  const renderPage = () => {
    if (terminalRole !== "supervisor" && RESTRICTED_TABS.has(active)) {
      return (
        <div className="h-full w-full overflow-y-auto p-6">
          <div className="rounded-3xl bg-white/90 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                  <Lock size={18} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Restricted on this terminal</h2>
                  <p className="mt-1 text-sm text-slate-700">
                    This POS terminal doesn't have access to {labelFromKey(active)}. Ask a store admin to grant it
                    Supervisor access under <span className="font-semibold">Settings → POS Terminal Access</span>.
                  </p>
                </div>
              </div>
              <GuideButton onClick={() => setShowTerminalGuide(true)} />
            </div>
            <button
              type="button"
              onClick={() => setActive("pointOfSale")}
              className="mt-5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Go to Point of Sale
            </button>
          </div>
          <CashierGuideModal
            open={showTerminalGuide}
            onClose={() => setShowTerminalGuide(false)}
            title="POS Terminal Access"
            subtitle="Why this tab is hidden, and how to unlock it"
            steps={TERMINAL_ACCESS_GUIDE_STEPS}
            notes={TERMINAL_ACCESS_GUIDE_NOTES}
          />
        </div>
      );
    }
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

      case "__support":
        return <RetailerHelpSupport />;

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

          <div className="flex items-center gap-2">
          {unsyncedOfflineCount > 0 && (
            <button
              type="button"
              onClick={() => setActive("pointOfSale")}
              className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] font-black text-amber-700"
              title={`${unsyncedOfflineCount} offline bill(s) not yet synced`}
            >
              <AlertTriangle size={14} />
              {unsyncedOfflineCount}
            </button>
          )}
          <InternalNotificationBell />
          <InternalChatPanel />
          <button
            type="button"
            onClick={() => setActive("__support")}
            className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700 transition hover:bg-slate-100"
            aria-label="Help and support"
            title="Help & Support"
          >
            <CircleHelp size={18} className="text-slate-900" />
          </button>
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
            terminalRole={terminalRole}
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
                terminalRole={terminalRole}
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

            <div className="flex items-center gap-3">
              {unsyncedOfflineCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActive("pointOfSale")}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 hover:bg-amber-100"
                  title={`${unsyncedOfflineCount} offline bill(s) not yet synced — go to Point of Sale to sync or export a backup`}
                >
                  <AlertTriangle size={14} />
                  {unsyncedOfflineCount} unsynced
                </button>
              )}
              <InternalNotificationBell />
              <InternalChatPanel />
              <button
                type="button"
                onClick={() => setActive("__support")}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                aria-label="Help and support"
                title="Help & Support"
              >
                <CircleHelp size={18} className="text-slate-800" />
              </button>
              <button
                type="button"
                onClick={onSettingsClick}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                aria-label="Settings"
                title="Settings"
              >
                <SettingsIcon size={18} className="text-slate-800" />
              </button>
            </div>
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