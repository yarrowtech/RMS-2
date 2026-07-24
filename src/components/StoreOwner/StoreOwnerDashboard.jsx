import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Boxes, Building2, Crown, LogOut, PackagePlus, ShoppingCart, Store, Tags, UsersRound, X,
} from "lucide-react";
import { clearAuthData } from "../../utils/authRedirect.js";
import { API_BASE_URL } from "../../config/api.js";

const PERMISSION_LABELS = {
  inventory: "Central inventory across all stores",
  stock_allocation: "Allocate stock to stores",
  stock_transfer: "Transfer stock between stores",
  mbuyer: "Merchandiser buyer tools",
  purchase_orders: "HQ-wide purchase orders",
  vendors: "HQ-wide vendor management",
  grn: "HQ-wide GRN",
  grc: "HQ-wide GRC",
  finance: "Finance dashboard",
  logistics: "Logistics module",
  job_work: "Production / Job Work module",
  hr: "HR module",
  reports: "Cross-store reports",
  user_management: "Create and manage HQ & store admins",
};

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-rms-razorpay-checkout="true"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load secure payment checkout.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.rmsRazorpayCheckout = "true";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load secure payment checkout."));
    document.body.appendChild(script);
  });
}

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
  const [departments, setDepartments] = useState([]);
  const [plans, setPlans] = useState({});
  const [upgradePlan, setUpgradePlan] = useState("professional");
  const [planPicked, setPlanPicked] = useState(false);
  const [upgradeDepartments, setUpgradeDepartments] = useState([]);
  const [upgradeNote, setUpgradeNote] = useState("");
  const [upgradeLoading, setUpgradeLoading] = useState(true);
  const [upgradeSaving, setUpgradeSaving] = useState(false);
  const [upgradePaying, setUpgradePaying] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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
      const [statusData, deptData, planData] = await Promise.all([
        upgradeRequest("/api/store-upgrades/me"),
        upgradeRequest("/api/store-upgrades/departments"),
        upgradeRequest("/api/store-upgrades/plans"),
      ]);
      setUpgrade(statusData);
      setDepartments(Array.isArray(deptData.departments) ? deptData.departments : []);
      setPlans(planData.plans || {});
    } catch (error) {
      setUpgradeMessage(error.message);
    } finally {
      setUpgradeLoading(false);
    }
  }, [upgradeRequest]);

  useEffect(() => { loadUpgrade(); }, [loadUpgrade]);

  const toggleDepartment = (key) => {
    setUpgradeDepartments((prev) => prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]);
  };

  useEffect(() => {
    if (upgradePlan === "enterprise") return;
    const enterpriseOnly = new Set(departments.filter((d) => d.requires_plan === "enterprise").map((d) => d.key));
    setUpgradeDepartments((prev) => prev.filter((key) => !enterpriseOnly.has(key)));
  }, [upgradePlan, departments]);

  const submitUpgrade = async () => {
    try {
      setUpgradeSaving(true);
      setUpgradeMessage("");
      await upgradeRequest("/api/store-upgrades/requests", {
        method: "POST",
        body: JSON.stringify({ requested_plan: upgradePlan, requested_departments: upgradeDepartments, note: upgradeNote.trim() }),
      });
      setUpgradeMessage("Request created. Complete payment below to send it for RMS review.");
      setUpgradeNote("");
      setUpgradeDepartments([]);
      setPlanPicked(false);
      await loadUpgrade();
    } catch (error) {
      setUpgradeMessage(error.message);
    } finally {
      setUpgradeSaving(false);
    }
  };

  const payForUpgrade = async () => {
    if (!upgrade?.request?.id) return;
    try {
      setUpgradePaying(true);
      setUpgradeMessage("");
      const checkout = await upgradeRequest(`/api/store-upgrades/${upgrade.request.id}/checkout`, { method: "POST" });
      await loadRazorpayCheckout();
      if (!window.Razorpay) throw new Error("Secure payment checkout is unavailable. Please try again.");

      const razorpay = new window.Razorpay({
        key: checkout.key_id,
        amount: checkout.amount,
        currency: checkout.currency,
        name: "RMS Multi-Store Upgrade",
        description: `${checkout.plan?.label || "Retailer HQ"} plan`,
        order_id: checkout.order_id,
        theme: { color: "#4f46e5" },
        handler: async (response) => {
          try {
            await upgradeRequest(`/api/store-upgrades/${upgrade.request.id}/verify-payment`, {
              method: "POST",
              body: JSON.stringify(response),
            });
            setUpgradeMessage("Payment captured. Your upgrade request is now with RMS for review.");
          } catch (error) {
            setUpgradeMessage(error.message);
          } finally {
            setUpgradePaying(false);
            await loadUpgrade();
          }
        },
        modal: { ondismiss: () => setUpgradePaying(false) },
      });
      razorpay.open();
    } catch (error) {
      setUpgradeMessage(error.message || "Could not start checkout.");
      setUpgradePaying(false);
    }
  };

  const logout = () => {
    clearAuthData();
    window.location.replace("/admin/login");
  };

  const requestStatus = upgrade?.request?.status;
  const upgradeBadge =
    requestStatus === "PENDING" ? { label: "Payment pending", cls: "bg-amber-400 text-amber-950" } :
    requestStatus === "PAID_PENDING_REVIEW" ? { label: "In review", cls: "bg-indigo-400 text-indigo-950" } :
    (requestStatus === "APPROVED" || !upgrade?.eligible) ? { label: "Approved", cls: "bg-emerald-400 text-emerald-950" } :
    null;

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
          <div className="flex items-center gap-3">
            <button onClick={() => setShowUpgradeModal(true)} className="relative flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/20">
              <Crown className="h-4 w-4" /> Grow with RMS
              {upgradeBadge && (
                <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${upgradeBadge.cls}`}>{upgradeBadge.label}</span>
              )}
            </button>
            <button onClick={logout} className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10">
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
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

      {showUpgradeModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowUpgradeModal(false)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-indigo-100 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="relative grid gap-6 bg-gradient-to-r from-indigo-950 via-violet-900 to-fuchsia-900 p-6 text-white lg:grid-cols-[1fr_auto] lg:items-center">
              <button onClick={() => setShowUpgradeModal(false)} className="absolute right-4 top-4 rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
              <div>
                <div className="flex items-center gap-2 text-indigo-200"><Crown className="h-4 w-4" /><span className="text-xs font-black uppercase tracking-[0.18em]">Grow with RMS</span></div>
                <h2 className="mt-2 text-2xl font-black">Ready to operate more than one store?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">Upgrade this business into a Retailer HQ workspace. Your current store remains your first location and its stock, products, sales and documents stay unchanged.</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-indigo-50"><Building2 className="mr-2 inline h-4 w-4 text-cyan-200" />HQ, multi-store and delegated teams</div>
            </div>

            <div className="p-6">
              {upgradeLoading ? <p className="text-sm text-slate-500">Checking upgrade eligibility…</p> : upgrade?.request?.status === "PENDING" ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-black">Payment required to send this upgrade for review</p>
                  <p className="mt-1">Requested plan: <b className="capitalize">{upgrade.request.requested_plan}</b> · ₹{(plans[upgrade.request.requested_plan]?.price_inr || 0).toLocaleString("en-IN")}/month.</p>
                  {upgrade.request.requested_departments?.length > 0 && (
                    <p className="mt-1">Departments requested: <b>{upgrade.request.requested_departments.join(", ")}</b></p>
                  )}
                  <button onClick={payForUpgrade} disabled={upgradePaying} className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-black text-white transition hover:bg-amber-700 disabled:opacity-60">{upgradePaying ? "Opening secure payment…" : `Pay ₹${(plans[upgrade.request.requested_plan]?.price_inr || 0).toLocaleString("en-IN")} and submit for review`}</button>
                </div>
              ) : upgrade?.request?.status === "PAID_PENDING_REVIEW" ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
                  <p className="font-black">Payment received — upgrade request is with RMS for review</p>
                  <p className="mt-1">Requested plan: <b className="capitalize">{upgrade.request.requested_plan}</b>. RMS will review the plan and migration before enabling HQ access.</p>
                  {upgrade.request.requested_departments?.length > 0 && (
                    <p className="mt-1">Departments requested: <b>{upgrade.request.requested_departments.join(", ")}</b></p>
                  )}
                </div>
              ) : upgrade?.request?.status === "APPROVED" || !upgrade?.eligible ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-black">Multi-store retailer access is approved.</p><p className="mt-1">Sign out and sign in again to enter your new Retailer HQ workspace. Your original store is still preserved as the first store.</p></div>
              ) : !planPicked ? (
                <div>
                  <p className="text-sm text-slate-500">As a single-store owner you already have Inventory, Vendors, Purchase Orders, GRN/GRC, POS and Sales for your one store. Here's what each plan adds on top of that.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {["professional", "enterprise"].map((key) => {
                      const cfg = plans[key] || {};
                      const isEnterprise = key === "enterprise";
                      return (
                        <div key={key} className={`flex flex-col rounded-2xl border-2 p-5 ${isEnterprise ? "border-amber-300 bg-amber-50/40" : "border-indigo-200 bg-indigo-50/40"}`}>
                          <p className="text-xs font-black uppercase tracking-widest text-slate-500">{cfg.label || key}</p>
                          <p className="mt-1 text-2xl font-black text-slate-900">₹{(cfg.price_inr || 0).toLocaleString("en-IN")}<span className="text-xs font-semibold text-slate-400">/month</span></p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-500">{isEnterprise ? "Unlimited stores" : "Up to 5 stores"}</p>
                          <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-400">New for you</p>
                          <ul className="mt-2 flex-1 space-y-1.5">
                            {(cfg.new_permissions || []).map((perm) => (
                              <li key={perm} className="flex items-start gap-2 text-xs text-slate-700"><span className="mt-0.5 text-emerald-500">✓</span>{PERMISSION_LABELS[perm] || perm}</li>
                            ))}
                          </ul>
                          <button
                            onClick={() => { setUpgradePlan(key); setPlanPicked(true); }}
                            className={`mt-4 h-10 rounded-xl text-sm font-black text-white transition ${isEnterprise ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
                          >
                            Select {cfg.label || key}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <button onClick={() => setPlanPicked(false)} className="text-xs font-bold text-indigo-600 hover:underline">&larr; Change plan</button>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <span className="font-black capitalize text-slate-900">{plans[upgradePlan]?.label || upgradePlan}</span>
                    <span className="text-slate-500"> · ₹{(plans[upgradePlan]?.price_inr || 0).toLocaleString("en-IN")}/month</span>
                  </div>
                  <label className="block text-sm font-bold text-slate-700">Note for RMS <input value={upgradeNote} onChange={(event) => setUpgradeNote(event.target.value)} maxLength={1000} placeholder="For example: opening two new branches next quarter" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-indigo-500" /></label>
                  <div>
                    <p className="text-sm font-bold text-slate-700">Departments you need at HQ</p>
                    <p className="mt-0.5 text-xs text-slate-500">Only pick what your business actually runs — HQ access is always included.</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {departments.filter((dept) => dept.requires_plan !== "enterprise" || upgradePlan === "enterprise").map((dept) => (
                        <label key={dept.key} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300">
                          <input type="checkbox" checked={upgradeDepartments.includes(dept.key)} onChange={() => toggleDepartment(dept.key)} className="h-4 w-4 rounded border-slate-300" />
                          {dept.key}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button onClick={submitUpgrade} disabled={upgradeSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white transition hover:bg-indigo-700 disabled:opacity-60"><ArrowRight className="h-4 w-4" />{upgradeSaving ? "Sending…" : "Request upgrade"}</button>
                </div>
              )}
              {upgradeMessage && <p className="mt-3 text-sm font-semibold text-slate-600">{upgradeMessage}</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
