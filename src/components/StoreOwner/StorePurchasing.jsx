import React, { useState } from "react";
import { ArrowLeft, ClipboardList, FileText, PackageSearch, ShoppingCart, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import VendorList from "../Mbuyer/VendorList.jsx";
import OrderDetails from "../Mbuyer/OrderDetails.jsx";
import QuickOrderFromCatalogue from "../Mbuyer/Quickorderfromcatalogue.jsx";
import PurchaseInvoice from "../PurchaseInvoice.jsx";

const TABS = [
  { key: "vendors", label: "Vendors", icon: UsersRound, component: VendorList },
  { key: "quick-order", label: "Quick Order", icon: PackageSearch, component: QuickOrderFromCatalogue },
  { key: "orders", label: "Purchase Orders", icon: ShoppingCart, component: OrderDetails },
  { key: "invoices", label: "Invoices", icon: FileText, component: PurchaseInvoice },
];

export default function StorePurchasing() {
  const [active, setActive] = useState("orders");
  const navigate = useNavigate();
  const current = TABS.find((tab) => tab.key === active) || TABS[0];
  const Page = current.component;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-7">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <button onClick={() => navigate("/dashboard/store-owner")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" /> Workspace
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-violet-600" />
              <h1 className="text-lg font-black tracking-tight">Store Purchasing</h1>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Only the supplier, ordering and invoice tools needed by your store.</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-7">
        <nav className="mb-5 flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = active === tab.key;
            return <button key={tab.key} onClick={() => setActive(tab.key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${selected ? "bg-violet-600 text-white shadow" : "text-slate-600 hover:bg-violet-50 hover:text-violet-700"}`}>
              <Icon className="h-4 w-4" /> {tab.label}
            </button>;
          })}
        </nav>
        <section className="min-h-[70vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Page />
        </section>
      </div>
    </main>
  );
}
