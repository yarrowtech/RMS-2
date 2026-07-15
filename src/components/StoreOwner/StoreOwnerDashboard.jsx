import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Boxes, LogOut, PackagePlus, ShoppingCart, Store, Tags, UsersRound,
} from "lucide-react";
import { clearAuthData } from "../../utils/authRedirect.js";

const WORKSPACES = [
  {
    title: "Products",
    description: "Create products, prices, barcodes and variants.",
    path: "/products",
    icon: PackagePlus,
    color: "from-violet-500 to-indigo-600",
  },
  {
    title: "Product Classification",
    description: "Define product type, division, section and department before creating products.",
    path: "/product-mapping",
    icon: Tags,
    color: "from-fuchsia-500 to-purple-600",
  },
  {
    title: "Stock & Receiving",
    description: "Store stock, stock ledger, adjustments, GRC and GRN in one focused workspace.",
    path: "/dashboard/inventory",
    icon: Boxes,
    color: "from-cyan-500 to-blue-600",
  },
  {
    title: "Purchasing & Vendors",
    description: "Manage only vendors, quick orders, purchase orders and invoices.",
    path: "/dashboard/store-owner/purchasing",
    icon: UsersRound,
    color: "from-fuchsia-500 to-purple-600",
  },
  {
    title: "Point of Sale",
    description: "Create bills, process returns and view sales.",
    path: "/dashboard/cashier",
    icon: ShoppingCart,
    color: "from-orange-500 to-rose-500",
  },
  {
    title: "Store Staff",
    description: "Add Inventory or Cashier staff for this store only.",
    path: "/dashboard/store-owner/staff",
    icon: UsersRound,
    color: "from-slate-600 to-slate-800",
  },
];

export default function StoreOwnerDashboard() {
  const ownerName = localStorage.getItem("admin_name") || "Store Owner";
  const storeName = localStorage.getItem("admin_store_name") || "Your Store";

  const logout = () => {
    clearAuthData();
    window.location.replace("/admin/login");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-900">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-5 pb-24 pt-6 sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 top-24 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
        <header className="relative mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <Store className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-white">RMS</p>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Store Owner</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </header>

        <section className="relative mx-auto mt-16 max-w-7xl">
          <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-200">Single-store workspace</span>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">Welcome, {ownerName}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">Run {storeName} from one focused workspace. Products, purchasing, receiving, stock and billing stay connected without showing HQ-only tools.</p>
        </section>
      </div>

      <section className="bg-slate-50 px-5 pb-14 sm:px-8 lg:px-12">
        <div className="mx-auto -translate-y-14 max-w-7xl">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {WORKSPACES.map(({ title, description, path, icon: Icon, color }) => (
              <Link key={title} to={path} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl">
                <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${color} text-white shadow-lg`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-lg font-black text-slate-900">{title}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{description}</p>
                <span className="mt-5 flex items-center gap-2 text-sm font-bold text-indigo-600">Open workspace <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
