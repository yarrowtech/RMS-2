

import React, { useMemo, useCallback } from "react";
import { FaWhatsapp } from "react-icons/fa";
import {
  LayoutGrid,
  Tags,
  PlusCircle,
  Boxes,
  ClipboardList,
  ReceiptText,
  Store,
  UserCircle2,
  HeadphonesIcon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  BookOpen, 
  Crown,
  Network,
  ChartNoAxesCombined,
  Scissors,
} from "lucide-react";

const cn = (...a) => a.filter(Boolean).join(" ");

const NAV_ITEMS = [
  { key: "dashboard",      label: "Dashboard",         icon: LayoutGrid },
  { key: "categories",     label: "My Categories",     icon: Tags },
  { key: "catalogue",      label: "My Catalogue",      icon: BookOpen },
  { key: "subscription",   label: "Subscription",      icon: Crown },
  { key: "whatsapp",       label: "WhatsApp",          icon: FaWhatsapp },
  { key: "product-list",   label: "Product List",      icon: Boxes },
  { key: "purchase-order", label: "Purchase Orders",   icon: ClipboardList },
  { key: "job-work",       label: "Job Work Orders",    icon: Scissors },
  { key: "purchase-invoice", label: "Purchase Invoices", icon: ReceiptText },
  { key: "finance",        label: "Finance & Analytics", icon: ChartNoAxesCombined },
  { key: "retailers",      label: "My Retailers",      icon: Store },
  { key: "network",        label: "Business Network",  icon: Network },
  { key: "profile",        label: "Profile",           icon: UserCircle2 },
  { key: "help-support",   label: "Help & Support",    icon: HeadphonesIcon },
];

const PRODUCT_BUSINESS_TYPES = new Set([
  "general_vendor", "wholesaler", "manufacturer", "distributor",
  "retailer", "fabric_supplier", "exporter",
]);

const ROLE_LABELS = {
  general_vendor: "Vendor workspace",
  wholesaler: "Wholesale workspace",
  manufacturer: "Manufacturer workspace",
  distributor: "Distribution workspace",
  retailer: "Retail partner workspace",
  fabric_supplier: "Fabric supplier workspace",
  exporter: "Export partner workspace",
  job_worker: "Job-work workspace",
};

function roleSpecificLabels(types) {
  const selected = new Set(types || []);
  if (selected.has("fabric_supplier")) return {
    catalogue: "Fabric Catalogue", productList: "Fabric & Material List", orders: "Material Orders", invoices: "Material Invoices",
  };
  if (selected.has("wholesaler")) return {
    catalogue: "Bulk Catalogue", productList: "Bulk Stock List", orders: "Bulk Orders", invoices: "Wholesale Invoices",
  };
  if (selected.has("manufacturer")) return {
    catalogue: "Production Catalogue", productList: "Finished Goods List", orders: "Production Orders", invoices: "Production Invoices",
  };
  if (selected.has("distributor")) return {
    catalogue: "Brand Catalogue", productList: "Distributed Stock", orders: "Distribution Orders", invoices: "Distribution Invoices",
  };
  if (selected.has("exporter")) return {
    catalogue: "Export Catalogue", productList: "Export Product List", orders: "Export Orders", invoices: "Export Invoices",
  };
  if (selected.has("retailer")) return {
    catalogue: "Retail Catalogue", productList: "Store Product List", orders: "Retail Orders", invoices: "Retail Invoices",
  };
  return { catalogue: "My Catalogue", productList: "Product List", orders: "Purchase Orders", invoices: "Purchase Invoices" };
}

export default function MsellerSidebar({
  mode = "desktop",
  active,
  setActive,
  onLogout,
  title = "RMS",
  subtitle = "Merchandiser Seller",
  sidebarOpen = true,
  setSidebarOpen,
  inquiryNotificationCount = 0,
  jobWorkEnabled = false,
  businessTypes = [],
}) {
  const isDrawer = mode === "drawer";
  const showText = sidebarOpen;
  const selectedTypes = Array.isArray(businessTypes) ? businessTypes : [];
  const roleLabels = roleSpecificLabels(selectedTypes);
  const workspaceLabel = ROLE_LABELS[selectedTypes[0]] || "Vendor workspace";
  const showProductTools = selectedTypes.length === 0 || selectedTypes.some((type) => PRODUCT_BUSINESS_TYPES.has(type));
  const visibleNavItems = NAV_ITEMS
    .filter((item) => item.key !== "job-work" || jobWorkEnabled)
    .filter((item) => !["catalogue", "product-list"].includes(item.key) || showProductTools)
    .map((item) => ({
      ...item,
      label: item.key === "catalogue" ? roleLabels.catalogue
        : item.key === "product-list" ? roleLabels.productList
          : item.key === "purchase-order" ? roleLabels.orders
            : item.key === "purchase-invoice" ? roleLabels.invoices
              : item.label,
    }));

  const userName = useMemo(() => {
    try {
      const raw = localStorage.getItem("user") || localStorage.getItem("authUser");
      if (raw) {
        const u = JSON.parse(raw);
        return u?.name || u?.fullName || "Vendor";
      }
    } catch {}
    return "Vendor";
  }, []);

  const onSelect = useCallback(
    (key) => {
      setActive(key);
      if (isDrawer) setSidebarOpen?.(false);
    },
    [isDrawer, setActive, setSidebarOpen]
  );

  return (
    <aside
      className={cn(
        isDrawer ? "h-[100dvh]" : "h-full",
        "relative flex flex-col overflow-hidden rounded-2xl",
        "shadow-[0_8px_28px_-6px_rgba(15,23,42,0.28)]",
        isDrawer ? "w-full" : sidebarOpen ? "w-[276px]" : "w-[88px]"
      )}
      style={{ background: "linear-gradient(185deg,#0E7C66 0%,#0B5C4C 100%)" }}
    >
      {/* ── Header ── */}
      <div className={cn("relative shrink-0 flex items-center gap-3 px-4 pt-5 pb-4", !sidebarOpen && "justify-center px-3")}>
        <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-white/10 border border-white/15">
          <Store size={18} className="text-emerald-100" strokeWidth={2} />
        </div>
        {sidebarOpen && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-white">{title}</p>
            <p className="truncate text-[11px] font-medium text-emerald-100/70">{subtitle}</p>
          </div>
        )}
        {sidebarOpen && (
          <button
            type="button"
            onClick={() => (isDrawer ? setSidebarOpen?.(false) : setSidebarOpen?.((s) => !s))}
            className="ml-auto grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-emerald-100/80 hover:bg-white/10 hover:text-white transition-colors"
            aria-label={isDrawer ? "Close sidebar" : "Collapse sidebar"}
          >
            {isDrawer ? <X size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
        {!sidebarOpen && !isDrawer && (
          <button
            type="button"
            onClick={() => setSidebarOpen?.(true)}
            className="absolute right-2 top-5 grid h-7 w-7 place-items-center rounded-lg text-emerald-100/80 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen size={15} />
          </button>
        )}
      </div>

      {/* ── User chip ── */}
      <div className={cn("shrink-0 px-4 mb-2", !sidebarOpen && "px-3")}>
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-xl bg-white/[0.07] border border-white/10 px-3 py-2.5",
            !sidebarOpen && "justify-center px-2"
          )}
        >
          <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-emerald-400/90 text-[13px] font-bold text-emerald-950">
            {userName?.[0]?.toUpperCase() ?? "V"}
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-white">{userName}</p>
              <p className="text-[10.5px] font-medium text-emerald-100/60">{workspaceLabel}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="relative z-10 flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1 overscroll-contain [-webkit-overflow-scrolling:touch]">
        {visibleNavItems.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              title={label}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative w-full flex items-center gap-3 rounded-lg text-[13px] font-medium transition-colors duration-150",
                sidebarOpen ? "px-3 py-2.5" : "px-0 py-2.5 justify-center",
                isActive
                  ? "bg-white/[0.12] text-white"
                  : "text-emerald-50/65 hover:bg-white/[0.06] hover:text-white"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-amber-400" />
              )}
              <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} className="flex-shrink-0" />
              {showText && <span className="flex-1 truncate text-left">{label}</span>}
              {key === "catalogue" && inquiryNotificationCount > 0 && !isActive && (
                <span className={`${showText ? "min-w-5 px-1.5" : "absolute right-1 top-1"} flex h-5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-emerald-950`}>{inquiryNotificationCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Logout ── */}
      <div className="shrink-0 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onLogout}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold",
            "bg-white/[0.08] text-emerald-50 border border-white/10",
            "hover:bg-white/[0.14] hover:text-white transition-colors"
          )}
        >
          <LogOut size={15} />
          {showText && "Log out"}
        </button>
      </div>
    </aside>
  );
}
