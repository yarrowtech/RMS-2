import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Boxes, Building2, Crown, LogOut, PackagePlus, ShoppingCart, Store, Tags, UsersRound,
} from "lucide-react";
import { clearAuthData } from "../../utils/authRedirect.js";
import { API_BASE_URL } from "../../config/api.js";

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
  const [upgrade, setUpgrade] = useState(null);
  const [upgradePlan, setUpgradePlan] = useState("professional");
  const [upgradeNote, setUpgradeNote] = useState("");
  const [upgradeLoading, setUpgradeLoading] = useState(true);
  const [upgradeSaving, setUpgradeSaving] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  const upgradeRequest = useCallback(async (path, options = {}) => {
    const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Could not complete the upgrade request.");
    return data;
  }, []);

  const loadUpgrade = useCallback(async () => {
    try {
      setUpgradeLoading(true);
      const data = await upgradeRequest("/api/store-upgrades/me");
      setUpgrade(data);
    } catch (error) {
      setUpgradeMessage(error.message);
    } finally {
      setUpgradeLoading(false);
    }
  }, [upgradeRequest]);

  useEffect(() => { loadUpgrade(); }, [loadUpgrade]);

  const submitUpgrade = async () => {
    try {
      setUpgradeSaving(true);
      setUpgradeMessage("");
      await upgradeRequest("/api/store-upgrades/requests", {
        method: "POST",
        body: JSON.stringify({ requested_plan: upgradePlan, note: upgradeNote.trim() }),
      });
      setUpgradeMessage("Your request was sent to RMS for review.");
      setUpgradeNote("");
      await loadUpgrade();
    } catch (error) {
      setUpgradeMessage(error.message);
    } finally {
      setUpgradeSaving(false);
    }
  };

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

          <section className="mt-6 overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm">
            <div className="grid gap-6 bg-gradient-to-r from-indigo-950 via-violet-900 to-fuchsia-900 p-6 text-white lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex items-center gap-2 text-indigo-200"><Crown className="h-4 w-4" /><span className="text-xs font-black uppercase tracking-[0.18em]">Grow with RMS</span></div>
                <h2 className="mt-2 text-2xl font-black">Ready to operate more than one store?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">Upgrade this business into a Retailer HQ workspace. Your current store remains your first location and its stock, products, sales and documents stay unchanged.</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-indigo-50"><Building2 className="mr-2 inline h-4 w-4 text-cyan-200" />HQ, multi-store and delegated teams</div>
            </div>

            <div className="p-6">
              {upgradeLoading ? <p className="text-sm text-slate-500">Checking upgrade eligibility…</p> : upgrade?.request?.status === "PENDING" ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-black">Multi-store upgrade request pending</p><p className="mt-1">Requested plan: <b className="capitalize">{upgrade.request.requested_plan}</b>. RMS will review the plan and migration before enabling HQ access.</p></div>
              ) : upgrade?.request?.status === "APPROVED" || !upgrade?.eligible ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-black">Multi-store retailer access is approved.</p><p className="mt-1">Sign out and sign in again to enter your new Retailer HQ workspace. Your original store is still preserved as the first store.</p></div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[180px_1fr_auto] lg:items-end">
                  <label className="text-sm font-bold text-slate-700">Choose plan<select value={upgradePlan} onChange={(event) => setUpgradePlan(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500"><option value="professional">Professional · up to 5 stores</option><option value="enterprise">Enterprise · unlimited stores</option></select></label>
                  <label className="text-sm font-bold text-slate-700">Note for RMS <input value={upgradeNote} onChange={(event) => setUpgradeNote(event.target.value)} maxLength={1000} placeholder="For example: opening two new branches next quarter" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-indigo-500" /></label>
                  <button onClick={submitUpgrade} disabled={upgradeSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white transition hover:bg-indigo-700 disabled:opacity-60"><ArrowRight className="h-4 w-4" />{upgradeSaving ? "Sending…" : "Request upgrade"}</button>
                </div>
              )}
              {upgradeMessage && <p className="mt-3 text-sm font-semibold text-slate-600">{upgradeMessage}</p>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
