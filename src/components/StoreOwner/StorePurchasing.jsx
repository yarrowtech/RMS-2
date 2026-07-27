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
    <main className="min-h-screen bg-gradient-to-br from-violet-50 via-sky-50 to-emerald-50 text-slate-900">
      <header className="border-b border-indigo-200/70 bg-gradient-to-r from-indigo-950 via-violet-900 to-cyan-900 px-4 py-4 shadow-lg shadow-indigo-950/15 sm:px-7">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <button onClick={() => navigate("/dashboard/store-owner")}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20">
            <ArrowLeft className="h-4 w-4" /> Workspace
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-cyan-300" />
              <h1 className="text-lg font-black tracking-tight text-white">Store Purchasing</h1>
            </div>
            <p className="mt-0.5 text-xs text-indigo-100">Only the supplier, ordering and invoice tools needed by your store.</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-7">
        <nav className="mb-5 flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-indigo-200/70 bg-white/80 p-2 shadow-lg shadow-indigo-950/5 backdrop-blur">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = active === tab.key;
            return <button key={tab.key} onClick={() => setActive(tab.key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${selected ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-600 hover:bg-violet-50 hover:text-violet-700"}`}>
              <Icon className="h-4 w-4" /> {tab.label}
            </button>;
          })}
        </nav>
        <section className="min-h-[70vh] overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-xl shadow-indigo-950/10 backdrop-blur">
          {current.key === "vendors" ? <VendorList showQuestionnaires={false} /> : <Page />}
        </section>
      </div>
    </main>
  );
}
