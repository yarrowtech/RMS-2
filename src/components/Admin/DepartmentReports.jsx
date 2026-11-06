import React, { useMemo, useState } from "react";
import {
  Package, DollarSign, Truck, Building2, Palette, LineChart, Network,
  Factory, Megaphone, HeartHandshake, LayoutGrid,
} from "lucide-react";

import Logistics from "../Logistics/LogisticsDashboard.jsx";
import Finance from "../Finance/Finance.jsx";
import DesignPattern from "../dnp.jsx";
import InventoryManagement from "../InventoryManagement/InventoryManagement.jsx";
import ForecastAnalytics from "../ForecastAnalytics.jsx";
import ProductionJobWork from "../Production/ProductionJobWork.jsx";
import Marketing from "../Marketing/Marketing.jsx";
import CustomerCRM from "../CustomerCRM/CustomerCRM.jsx";
import VisualMerchandising from "../VisualMerchandising/VisualMerchandising.jsx";
import Mbuyer from "../Mbuyer/mbuyer.jsx";
import ThirdPartyDept from "../thirdparty.jsx";

// One entry per real department module — same components the dedicated
// routes in App.jsx render, reused here as-is rather than extracted.
// Each one is already a complete, self-contained dashboard with its own
// real analytics and report/export features; this screen's only job is
// to switch which one is mounted, not to rebuild any of them.
const DEPARTMENTS = [
  { department: "Inventory",             icon: Package,        Component: InventoryManagement },
  { department: "Finance",               icon: DollarSign,     Component: Finance },
  { department: "Logistics",             icon: Truck,          Component: Logistics },
  { department: "Merchandiser Buyer",    icon: Building2,      Component: Mbuyer },
  { department: "Design & Pattern",      icon: Palette,        Component: DesignPattern },
  { department: "Forecast & Analytics",  icon: LineChart,      Component: ForecastAnalytics },
  { department: "Third Party",           icon: Network,        Component: ThirdPartyDept },
  { department: "Production & Job Work", icon: Factory,        Component: ProductionJobWork },
  { department: "Marketing",             icon: Megaphone,      Component: Marketing },
  { department: "Customer CRM",          icon: HeartHandshake, Component: CustomerCRM },
  { department: "Visual Merchandising",  icon: LayoutGrid,     Component: VisualMerchandising },
];

export default function DepartmentReports() {
  // Same source of truth AdminSidebar.jsx already uses for which
  // departments this specific HQ admin is allowed to see — read fresh on
  // every mount, not frozen at module load time, for the same reason
  // AdminSidebar does it this way (see its own comment on this).
  const managedDepartments = useMemo(() => {
    try {
      const loginData = JSON.parse(localStorage.getItem("admin_login_data") || "{}");
      return Array.isArray(loginData.departments) ? loginData.departments : [];
    } catch {
      return [];
    }
  }, []);

  const available = DEPARTMENTS.filter((d) => managedDepartments.includes(d.department));
  const [activeDept, setActiveDept] = useState(available[0]?.department || "");

  const active = available.find((d) => d.department === activeDept) || available[0];
  const ActiveComponent = active?.Component;

  if (!available.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">
        No departments are assigned to this admin account yet.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex flex-wrap gap-2 shrink-0">
        {available.map(({ department, icon: Icon }) => (
          <button
            key={department}
            onClick={() => setActiveDept(department)}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
              activeDept === department
                ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon size={15} /> {department}
          </button>
        ))}
      </div>

      {/* Each department module manages its own internal scrolling/layout
          (most assume full-viewport height) — this just gives it a clean,
          contained area to render into so it doesn't fight Admin's own
          page chrome. Remounts on tab switch (key=department) rather than
          staying mounted, since these modules aren't designed to be
          hidden/shown — a fresh mount is the safe behavior, matching what
          happens when you navigate to them directly today. */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <div className="h-full overflow-y-auto">
          {ActiveComponent && <ActiveComponent key={active.department} />}
        </div>
      </div>
    </div>
  );
}
