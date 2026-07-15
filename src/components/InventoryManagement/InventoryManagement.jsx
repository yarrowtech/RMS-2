

import React, { Suspense, useMemo, useState } from "react";
import { logoutOrReturnToDepartmentSelector } from "../../utils/authRedirect";
import { FaBars, FaCog } from "react-icons/fa";
import InventoryManagementSidebar from "./InventoryManagementSidebar";
import InventoryManagementCurrentStockList from "./InventoryManagementCurrentStockList";
import InventoryManagementStockLedgerMovement from "./InventoryManagementStockLedgerMovement";
import InventoryManagementReorderLevelSetup from "./InventoryManagementReorderLevelSetup";
import InventoryManagementStockAdjustment from "./InventoryManagementStockAdjustment";
import InventoryManagementStockTransfer from "./InventoryManagementStockTransfer";
import InventoryManagementDamageAndReturn from "./InventoryManagementDamageAndReturn";
import InventoryManagementStockSummeryOverview from "./InventoryManagementStockSummaryOverview";
import InventoryManagemntExpiryAgingItems from "./InventoryManagementExpiryAgingItems";
import InventoryManagementStockValuationReport from "./InventoryManagementStockValuationReport";
import InventoryManagementItemAgingReport from "./InventoryManagementItemAgingReport";
import InventoryManagementDailyStockMovement from "./InventoryManagementDailyStockMovement";
import InventoryManagementWareHouseWizeStock from "./InventoryManagementWareHouseWizeStock";
import InventoryManagementSettings from "./InventoryManagementSettings";
import InventoryManagementStockAllocation from "./InventoryManagementStockAllocation";
import InventoryManagementStoreStock from "./Inventorymanagementstorestock.jsx";
import GRRC from "./GRRC";
import GRN from "./GRN";

const COMPANY_NAME = "RMS";

// Read fresh on every render — not cached at module level
function getStoreContext() {
  // `admin_*` is written by the current login. Fall back only for a legacy
  // session so a previous retailer's store key can never win.
  const storeId   = localStorage.getItem("admin_store_id") || localStorage.getItem("store_id") || "";
  const storeName = localStorage.getItem("admin_store_name") || localStorage.getItem("store_name") || "";
  return {
    storeId,
    storeName,
    isHQ:    !storeId,
    isStore: !!storeId,
  };
}

// ── Page titles ──────────────────────────────────────────────────────────────
function labelFromKey(key, storeName = "") {
  switch (key) {
    // Dashboard (HQ only)
    case "dashboard.summary":     return "Stock Summary Overview";
    case "dashboard.aging":       return "Expiry & Aging Items";

    // Stock
    case "stock.currentList":     return "Central Stock List";
    case "stock.storeStock":      return `Store Stock — ${storeName || "Store"}`;
    case "stock.ledger":          return "Stock Ledger / Movement";
    case "stock.reorderLevel":    return "Reorder Level Setup";
    case "stock.adjustment":      return "Stock Adjustment";
    case "stock.transfer":        return "Stock Transfer";
    case "stock.allocation":      return "Stock Allocation";
    case "stock.damagedReturned": return "Damaged / Returned Stock";

    // GRN (HQ only)
    case "grn.grn":               return "Goods Receipt Note (GRN)";
    case "grn.grc":               return "Goods Return Challan (GRC)";
    case "grn.supplierReturn":    return "Supplier Return Register";

    // Reports
    case "reports.valuation":     return "Stock Valuation Report";
    case "reports.itemAging":     return "Item Aging Report";
    case "reports.dailyMovement": return "Daily Stock Movement";
    case "reports.warehouseWise": return "Warehouse Wise Stock";

    case "settings":              return "Settings";
    default:                      return "Inventory Dashboard";
  }
}

// ── Loaders ──────────────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="p-6">
      <p className="text-sm font-semibold text-slate-900">Loading…</p>
    </div>
  );
}

function MinimalPlaceholder({ title, subtitle }) {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-700">{subtitle || "Content will go here."}</p>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white/70 p-4">
        <p className="text-xs font-semibold text-slate-600">
          Active: <span className="text-slate-900">{String(title)}</span>
        </p>
      </div>
    </div>
  );
}

// ── Access denied page (shown when store admin tries HQ-only page) ────────────
function HQOnly() {
  return (
    <div className="p-8 flex flex-col items-center justify-center gap-4 text-center min-h-[40vh]">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl">
        🏢
      </div>
      <h2 className="text-lg font-bold text-slate-800">HQ Access Only</h2>
      <p className="text-sm text-slate-500 max-w-xs">
        This page is managed at Head Office level. Contact your HQ Inventory admin.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InventoryManagement() {

  const { storeId, storeName, isHQ, isStore } = getStoreContext();
  // A single-store business receives goods directly into its primary store.
  // Branches of a multi-store retailer continue to receive through HQ.
  const isSingleStore = localStorage.getItem("admin_account_type") === "single_store";
  const canReceiveAtStore = isHQ || (isStore && isSingleStore);
  // Store admin lands on Store Stock. HQ admin lands on Dashboard Summary.
  const [active, setActive] = useState(
    isStore ? "stock.storeStock" : "dashboard.summary"
  );
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen]                 = useState(false);

  const pageTitle = useMemo(() => labelFromKey(active, storeName), [active, storeName]);
  const handleLogout = () => logoutOrReturnToDepartmentSelector();

  // ── Page renderer ──────────────────────────────────────────────────────────
  const renderPage = () => {
    switch (active) {

      // ── DASHBOARD (HQ only) ───────────────────────────────────────────────
      case "dashboard.summary":
        return isHQ ? <InventoryManagementStockSummeryOverview /> : <HQOnly />;
      case "dashboard.aging":
        return isHQ ? <InventoryManagemntExpiryAgingItems /> : <HQOnly />;

      // ── STOCK MANAGEMENT ─────────────────────────────────────────────────

      // Central stock list — HQ only
      case "stock.currentList":
        return isHQ ? <InventoryManagementCurrentStockList /> : <HQOnly />;

      // Store stock — Store/Branch only
      case "stock.storeStock":
        return isStore ? <InventoryManagementStoreStock /> : <HQOnly />;

      // Stock Allocation — HQ only (allocates FROM central TO store)
      case "stock.allocation":
        return isHQ ? <InventoryManagementStockAllocation /> : <HQOnly />;

      // These show for BOTH — API is store-aware via JWT
      case "stock.ledger":
        return <InventoryManagementStockLedgerMovement />;
      case "stock.reorderLevel":
        return <InventoryManagementReorderLevelSetup />;
      case "stock.adjustment":
        return <InventoryManagementStockAdjustment />;
      case "stock.transfer":
        return <InventoryManagementStockTransfer />;
      case "stock.damagedReturned":
        return <InventoryManagementDamageAndReturn />;

      // ── GRN / GRC ─────────────────────────────────────────────────────────
      // HQ receives centrally; a single-store tenant receives directly to its
      // own store. Other retailer branches remain HQ-managed.
      case "grn.grn":
        return canReceiveAtStore ? <GRN /> : <HQOnly />;
      case "grn.grc":
        return canReceiveAtStore ? <GRRC /> : <HQOnly />;
      case "grn.supplierReturn":
        return isHQ
          ? <MinimalPlaceholder title="Supplier Return Register" subtitle="All returns register with status & approvals." />
          : <HQOnly />;

      // ── REPORTS (both — API scoped by store_id in JWT) ────────────────────
      case "reports.valuation":
        return <InventoryManagementStockValuationReport />;
      case "reports.itemAging":
        return <InventoryManagementItemAgingReport />;
      case "reports.dailyMovement":
        return <InventoryManagementDailyStockMovement />;
      case "reports.warehouseWise":
        return <InventoryManagementWareHouseWizeStock />;

      // ── SETTINGS (both) ───────────────────────────────────────────────────
      case "settings":
        return <InventoryManagementSettings />;

      default:
        return <MinimalPlaceholder title={pageTitle} />;
    }
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#f5faf9] text-slate-900">

      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.18),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.13),transparent_34%)]" />

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-50 border-b border-emerald-100 bg-white/95 shadow-sm backdrop-blur-xl pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-xl border border-emerald-100 bg-emerald-50 p-2 text-emerald-700 shadow-sm transition hover:bg-emerald-100"
            aria-label="Open sidebar"
          >
            <FaBars size={18} className="text-slate-900" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-semibold text-slate-900">
              {COMPANY_NAME} — Inventory
            </h1>
            <p className="text-xs font-semibold text-emerald-700">{pageTitle}</p>
          </div>
          <button
            onClick={() => setActive("settings")}
            className="rounded-xl border border-emerald-100 bg-emerald-50 p-2 text-emerald-700 shadow-sm transition hover:bg-emerald-100"
          >
            <FaCog size={16} className="text-slate-900" />
          </button>
        </div>
      </div>

      {/* Body layout */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 px-3 py-3 lg:gap-4 lg:px-4 lg:py-4">

        {/* Desktop sidebar */}
        <aside className="hidden lg:block shrink-0 lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)]">
          <InventoryManagementSidebar
            mode="desktop"
            active={active}
            setActive={setActive}
            onLogout={handleLogout}
            title="RMS"
            subtitle={isStore ? `Store: ${storeName}` : "Inventory Department"}
            sidebarOpen={desktopSidebarOpen}
            setSidebarOpen={setDesktopSidebarOpen}
            isHQ={isHQ}
            isStore={isStore}
            canReceive={canReceiveAtStore}
          />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-[1000] lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="fixed top-0 left-0 z-[1001] lg:hidden h-[100dvh] w-[86vw] max-w-[360px] overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] rounded-r-3xl">
              <InventoryManagementSidebar
                mode="drawer"
                active={active}
                setActive={(k) => { setActive(k); setDrawerOpen(false); }}
                onLogout={handleLogout}
                title="RMS"
                subtitle={isStore ? `Store: ${storeName}` : "Inventory Department"}
                sidebarOpen={true}
                setSidebarOpen={() => setDrawerOpen(false)}
                isHQ={isHQ}
                isStore={isStore}
                canReceive={canReceiveAtStore}
              />
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden lg:gap-4">

          {/* Desktop header */}
          <header className="sticky top-4 z-40 hidden rounded-2xl border border-emerald-100 bg-white/95 px-5 py-3.5 shadow-[0_12px_35px_rgba(6,78,59,0.08)] backdrop-blur-xl lg:block">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  Inventory Management Panel
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">{pageTitle}</p>
                  {/* Store badge — shows which store this admin manages */}
                  {isStore && (
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-cyan-700">
                      🏪 {storeName}
                    </span>
                  )}
                  {isHQ && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                      🏢 HQ
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setActive("settings")}
                className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-emerald-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-100"
              >
                <FaCog className="text-emerald-700" size={16} />
              </button>
            </div>
          </header>

          {/* Page content */}
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-emerald-100 bg-white/75 shadow-[0_24px_70px_rgba(6,78,59,0.09)] backdrop-blur-xl">
            <main className="h-full min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
              <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
