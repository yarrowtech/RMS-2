import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Crown, Zap, TrendingUp, TrendingDown, Image as ImageIcon, MessageSquare, Users, ShoppingBag,
  ArrowUpRight, Clock, CheckCircle2, AlertTriangle, RefreshCw, ChevronRight, ListChecks, Circle, PackagePlus, MessageCircle, Store, ShieldCheck,
  X, Save, Loader2, Wrench, IndianRupee,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// dataviz-skill categorical/status palette (same reference instance used by
// the Inventory Management dashboards this session) — fixed hue order,
// never reassigned by rank/filter.
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const STATUS_TONE = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" };
const INK = "#1c2126", MUTED = "#5b6470", GRID = "#e6e8eb";
const ORDER_STATUS_COLOR = {
  Pending: STATUS_TONE.warning, SentToVendor: SERIES[0], WalkinAccepted: SERIES[2],
  VendorSubmitted: SERIES[6], Approved: STATUS_TONE.good, PartiallyReceived: SERIES[3],
  Received: STATUS_TONE.good, GRNCompleted: STATUS_TONE.good, Paid: STATUS_TONE.good,
  Cancelled: STATUS_TONE.critical, Rejected: STATUS_TONE.critical,
};
const money = (value, currency = "INR") => `${currency === "INR" ? "₹" : currency + " "}${Number(value || 0).toLocaleString("en-IN")}`;
const monthLabel = (key) => { const [y, m] = String(key).split("-").map(Number); return new Date(y, (m || 1) - 1, 1).toLocaleDateString("en-IN", { month: "short" }); };

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-bold text-slate-700">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color || entry.payload?.fill }} className="font-semibold">
          {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

/**
 * MSellerDashboard.jsx
 * =======================
 * Vendor's home/landing page — aggregates data from five existing
 * endpoints into one overview, with quick links out to the fuller tabs
 * (Catalogue, Inquiries, Subscription, Category, Retailers, Orders).
 * Doesn't duplicate any logic those tabs already own — this is read-only
 * summary + navigation, nothing here writes anything.
 *
 * Props:
 *   onNavigate(tabKey) — called when a quick-action card is clicked, so
 *   the parent shell can switch tabs. tabKey values used below:
 *   "catalogue" | "subscription" | "categories" | "whatsapp" | "retailers" | "purchase-order"
 *   If you don't have a callback wired yet, pass a no-op — the cards will
 *   just not navigate anywhere until you do.
 */

const API_BASE = APP_API_URL;

function getVendorToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("vendor_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

async function vendorFetch(path, options = {}) {
  const token = getVendorToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

const TIER_ICON = { free: Zap, standard: TrendingUp, premium: Crown };
const TIER_GRADIENT = {
  free:     "from-slate-600 to-slate-700",
  standard: "from-indigo-600 to-indigo-700",
  premium:  "from-amber-500 to-amber-600",
};

const PO_STATUS_STYLE = {
  Pending:       "bg-amber-100 text-amber-700",
  Approved:      "bg-emerald-100 text-emerald-700",
  SentToVendor:  "bg-sky-100 text-sky-700",
  WalkinAccepted:"bg-sky-100 text-sky-700",
  Rejected:      "bg-rose-100 text-rose-700",
  Cancelled:     "bg-slate-100 text-slate-600",
  Paid:          "bg-emerald-100 text-emerald-700",
};

function KpiCard({ icon: Icon, label, value, accent, onClick, trend }) {
  const hasTrend = trend !== null && trend !== undefined;
  return (
    <button onClick={onClick}
      className="text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-sm transition group">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent.bg}`}>
          <Icon className={`w-4.5 h-4.5 ${accent.text}`} />
        </div>
        {hasTrend ? (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(trend)}%
          </span>
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition" />
        )}
      </div>
      <p className="text-xl font-black text-slate-900 truncate">{value}</p>
      <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
    </button>
  );
}

const VENDOR_WORKSPACES = [
  { key: "catalogue", title: "My Catalogue", desc: "Upload products, images, bulk links and handle catalogue orders.", icon: ImageIcon, tone: "indigo", badge: "Core" },
  { key: "product-list", title: "Finished Goods List", desc: "Manage product masters, variants, barcode and item details.", icon: PackagePlus, tone: "teal" },
  { key: "inventory", title: "My Inventory", desc: "Track own stock, reserve for POs and dispatch stock correctly.", icon: PackagePlus, tone: "emerald" },
  { key: "purchase-order", title: "Purchase Orders", desc: "Review buyer POs, update items, submit and dispatch goods.", icon: ShoppingBag, tone: "sky", badge: "Action" },
  { key: "supplier-returns", title: "Supplier Returns", desc: "Handle retailer return requests and related credit flow.", icon: RefreshCw, tone: "rose" },
  { key: "purchase-invoice", title: "Production Invoices", desc: "See invoices, payment proofs and commercial records.", icon: ListChecks, tone: "amber" },
  { key: "finance", title: "Finance & Analytics", desc: "Revenue, outstanding, payments and performance insights.", icon: TrendingUp, tone: "emerald" },
  { key: "categories", title: "My Categories", desc: "Set business type tags so retailers find the right products.", icon: Users, tone: "violet" },
  { key: "role-operations", title: "Business Operations", desc: "Role-specific workflows for manufacturer, wholesaler or supplier.", icon: ListChecks, tone: "slate" },
  { key: "job-work", title: "Job Work Orders", desc: "Receive job-work requests, track making work and delivery.", icon: Zap, tone: "orange" },
  { key: "whatsapp", title: "WhatsApp", desc: "Connect your business number and prepare WhatsApp commerce.", icon: MessageCircle, tone: "green" },
  { key: "retailers", title: "My Retailers", desc: "See approved retailer relationships and tenant-wise status.", icon: Store, tone: "cyan" },
  { key: "network", title: "Business Network", desc: "Discover and connect with other businesses inside RMS.", icon: Users, tone: "blue" },
  { key: "b2b-trade", title: "Vendor B2B Trade", desc: "RFQ, quote, B2B PO, dispatch, receipt, invoice and payment.", icon: ShoppingBag, tone: "purple", badge: "B2B" },
  { key: "b2b-stock", title: "B2B Stock Ledger", desc: "Stock received from vendor-to-vendor B2B trade only.", icon: PackagePlus, tone: "emerald", badge: "B2B" },
  { key: "subscription", title: "Subscription", desc: "Check plan limits, renewal, catalogue visibility and upgrades.", icon: Crown, tone: "amber" },
  { key: "settings", title: "Settings & KYB", desc: "PAN, GST, bank details, documents and verification status.", icon: ShieldCheck, tone: "teal", badge: "Important" },
  { key: "profile", title: "Profile", desc: "Business contact details, address and public identity.", icon: Users, tone: "slate" },
  { key: "help-support", title: "Help & Support", desc: "Raise tickets with screenshot/link when you are blocked.", icon: MessageSquare, tone: "rose" },
];

const WORKSPACE_TONES = {
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-100 group-hover:border-indigo-300",
  teal: "bg-teal-50 text-teal-700 border-teal-100 group-hover:border-teal-300",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100 group-hover:border-emerald-300",
  sky: "bg-sky-50 text-sky-700 border-sky-100 group-hover:border-sky-300",
  rose: "bg-rose-50 text-rose-700 border-rose-100 group-hover:border-rose-300",
  amber: "bg-amber-50 text-amber-700 border-amber-100 group-hover:border-amber-300",
  violet: "bg-violet-50 text-violet-700 border-violet-100 group-hover:border-violet-300",
  slate: "bg-slate-50 text-slate-700 border-slate-100 group-hover:border-slate-300",
  orange: "bg-orange-50 text-orange-700 border-orange-100 group-hover:border-orange-300",
  green: "bg-green-50 text-green-700 border-green-100 group-hover:border-green-300",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-100 group-hover:border-cyan-300",
  blue: "bg-blue-50 text-blue-700 border-blue-100 group-hover:border-blue-300",
  purple: "bg-purple-50 text-purple-700 border-purple-100 group-hover:border-purple-300",
};

function VendorWorkspaceGrid({ onNavigate }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">All vendor workspaces</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">Open any vendor page from here</h2>
          <p className="mt-1 text-sm text-slate-500">This dashboard now covers the same important tabs your sidebar has ? catalogue, stock, POs, finance, B2B, KYB and support.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{VENDOR_WORKSPACES.length} pages</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {VENDOR_WORKSPACES.map((item) => {
          const Icon = item.icon;
          const tone = WORKSPACE_TONES[item.tone] || WORKSPACE_TONES.slate;
          return (
            <button key={item.key} type="button" onClick={() => onNavigate(item.key)} className="group flex min-h-[132px] flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${tone}`}><Icon className="h-5 w-5" /></span>
                <div className="flex items-center gap-2">
                  {item.badge && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500">{item.badge}</span>}
                  <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-600" />
                </div>
              </div>
              <p className="mt-3 text-sm font-black text-slate-900">{item.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.desc}</p>
              <span className="mt-auto pt-3 text-xs font-black text-teal-700">Open workspace</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function VendorGetStarted({ businessTypes, catalogueCount, activeRetailers, hasWhatsApp, hasOrders, hasTaxProfile, hasKyb, kybStatus, onNavigate }) {
  const typeLabel = businessTypes.length
    ? businessTypes.map((type) => String(type).replace(/_/g, " ")).join(", ")
    : "vendor";
  const steps = [
    { label: "Confirm your business type", detail: "Set the products and operations your business provides.", tab: "categories", done: businessTypes.length > 0, icon: ListChecks },
    { label: "Complete your business profile", detail: "Add your PAN and GST details — not collected at signup.", tab: "settings", done: hasTaxProfile, icon: ShieldCheck },
    { label: "Complete vendor verification (KYB)", detail: hasTaxProfile ? `Add payout and document details, then wait for retailer verification (${kybStatus}).` : "Save PAN and GST first, then add your payout and document details.", tab: "settings", done: hasKyb, icon: ShieldCheck },
    { label: "Add your catalogue", detail: "Add products, variants, images and your selling price.", tab: "catalogue", done: catalogueCount > 0, icon: PackagePlus },
    { label: "Connect WhatsApp", detail: "Use your business number for catalogues and buyer conversations.", tab: "whatsapp", done: hasWhatsApp, icon: MessageCircle },
    { label: "Connect with retailers", detail: "Review your retailer connections and make your catalogue discoverable.", tab: "retailers", done: activeRetailers > 0, icon: Store },
    { label: "Review orders and inquiries", detail: "Respond to buyer requests and purchase orders from one place.", tab: "purchase-order", done: hasOrders, icon: CheckCircle2 },
  ];
  const completed = steps.filter((step) => step.done).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-teal-100 bg-gradient-to-r from-teal-50 via-cyan-50 to-indigo-50 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-teal-700"><ListChecks className="h-4 w-4" /><span className="text-xs font-black uppercase tracking-[.16em]">Get started</span></div>
          <h2 className="mt-1 text-lg font-black text-slate-900">Set up your {typeLabel} workspace</h2>
          <p className="mt-1 text-sm text-slate-600">Complete these steps in order. Each opens the existing RMS workspace you need.</p>
        </div>
        <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm ring-1 ring-teal-100">
          <p className="text-xs font-semibold text-slate-500">Setup progress</p>
          <p className="text-lg font-black text-teal-700">{completed} / {steps.length}</p>
        </div>
      </div>
      <div className="grid divide-y divide-slate-100 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 md:divide-x md:divide-y-0">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <button key={step.label} onClick={() => onNavigate(step.tab)} className="group p-4 text-left transition hover:bg-teal-50/70">
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-teal-600">0{index + 1}</span>{step.done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-slate-300 group-hover:text-teal-500" />}</div>
              <Icon className="mt-4 h-5 w-5 text-indigo-600" />
              <p className="mt-3 text-sm font-black text-slate-900">{step.label}</p>
              <p className="mt-1 min-h-12 text-xs leading-5 text-slate-500">{step.detail}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-600">{step.done ? "Manage" : "Open"} <ChevronRight className="h-3.5 w-3.5" /></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
// One-time welcome prompt — shown once per vendor on first dashboard load
// while PAN/GST is missing. "Skip for now" dismisses it permanently for
// that vendor (localStorage-scoped by vendor id); the Get Started checklist
// step and the banners on Finance/Invoices stay as the lighter, persistent
// reminder after that, so it never nags on every login.
function TaxProfileWelcomeModal({ onSaved, onSkip }) {
  const [pan, setPan] = useState("");
  const [gstin, setGstin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true); setError("");
    try {
      const response = await vendorFetch("/api/vendors/me/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: { pan, gstin }, preferences: {} }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not save your business profile.");
      onSaved();
    } catch (err) {
      setError(err.message || "Could not save your business profile.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-teal-700 to-emerald-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"><ShieldCheck className="h-5 w-5 text-white" /></span>
            <div><h2 className="text-lg font-bold text-white">Welcome — add your PAN &amp; GST</h2><p className="mt-0.5 text-xs text-emerald-100">Not required to log in, but needed for real business with retailers</p></div>
          </div>
          <button type="button" onClick={onSkip} className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-6">
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">PAN</span>
            <input value={pan} onChange={(event) => setPan(event.target.value.toUpperCase())} placeholder="ABCDE1234F"
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">GSTIN</span>
            <input value={gstin} onChange={(event) => setGstin(event.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5"
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
          </label>
          <p className="text-[11px] leading-5 text-slate-400">Used on invoices and purchase orders with retailers you're approved with — never shown publicly.</p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onSkip} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-100">Skip for now</button>
            <button type="button" onClick={save} disabled={saving || !pan || !gstin}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function MSellerDashboard({ onNavigate = () => {}, planTier = "free" }) {
  const [vendorName, setVendorName] = useState("");
  const [businessTypes, setBusinessTypes] = useState([]);
  const [hasWhatsApp, setHasWhatsApp] = useState(false);
  const [hasTaxProfile, setHasTaxProfile] = useState(false);
  const [kybStatus, setKybStatus] = useState("Not started");
  const [hasKyb, setHasKyb] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [sub, setSub] = useState(null);
  const [catalogueCount, setCatalogueCount] = useState(0);
  const [inquiries, setInquiries] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [jobWorkOrders, setJobWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, subRes, catRes, inqRes, tenantRes, poRes, kybRes, summaryRes, jobWorkRes] = await Promise.all([
        vendorFetch("/api/vendors/me"),
        vendorFetch("/api/subscriptions/me"),
        vendorFetch("/api/catalogue/my-catalogue"),
        vendorFetch("/api/catalogue/my-inquiries"),
        vendorFetch("/api/vendors/my-tenant"),
        vendorFetch("/api/vendors/my-purchaseorders"),
        vendorFetch("/api/vendors/me/kyb"),
        vendorFetch("/api/vendors/dashboard-summary"),
        vendorFetch("/api/job-work/vendor/orders"),
      ]);

      const me = await meRes.json();
      if (meRes.ok) {
        setVendorName(me.name || me.vendor_name || "there");
        setBusinessTypes(Array.isArray(me.business_type) ? me.business_type : []);
        setHasWhatsApp(Boolean(me.whatsapp_connected || me.whatsapp_number || me.whatsapp_phone || me.whatsapp));
        const taxComplete = Boolean(me.pan && me.gstin);
        setHasTaxProfile(taxComplete);
        setVendorId(me._id || "");
        if (!taxComplete && me._id && localStorage.getItem(`vendor_tax_modal_dismissed_${me._id}`) !== "true") {
          setShowTaxModal(true);
        }
      }

      if (subRes.ok) setSub((await subRes.json()).data);

      if (catRes.ok) {
        const cat = await catRes.json();
        setCatalogueCount((cat.data || []).filter(i => i.active).length);
      }

      if (inqRes.ok) setInquiries((await inqRes.json()).data || []);

      if (tenantRes.ok) setRetailers((await tenantRes.json()).data || []);

      if (poRes.ok) setOrders(await poRes.json() || []);

      if (kybRes.ok) {
        const kyb = await kybRes.json();
        const relationships = (kyb?.data?.relationships || []).filter((relationship) => relationship.relationship_status === "Approved");
        const allVerified = relationships.length > 0 && relationships.every((relationship) => relationship.status === "Verified");
        const status = allVerified ? "Verified" : relationships.some((relationship) => relationship.status === "Needs changes") ? "Needs changes" : relationships.some((relationship) => relationship.status === "Submitted") ? "Submitted" : "Not started";
        setKybStatus(status);
        setHasKyb(allVerified);
      }

      if (summaryRes.ok) setDashboardSummary(await summaryRes.json());
      if (jobWorkRes.ok) setJobWorkOrders((await jobWorkRes.json()).data || []);
    } catch {
      setError("Could not load your dashboard. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  const pendingInquiries   = inquiries.filter(i => i.status === "Pending").length;
  const respondedInquiries = inquiries.filter(i => i.status === "Responded").length;
  const activeRetailers    = retailers.filter(r => r.status === "Approved").length;
  const openOrders         = orders.filter(o => !["Cancelled", "Rejected", "Paid"].includes(o.status)).length;
  const setupComplete = businessTypes.length > 0 && hasTaxProfile && hasKyb && catalogueCount > 0 && hasWhatsApp && activeRetailers > 0 && orders.length > 0;
  const isJobWorker = businessTypes.includes("job_worker");
  const jobWorkOpen = jobWorkOrders.filter(o => o.status !== "COMPLETED").length;
  const jobWorkOverdue = jobWorkOrders.filter(o => o.is_overdue).length;
  const revenueTrend = (dashboardSummary?.monthly_revenue_trend || []).map(row => ({ ...row, label: monthLabel(row.month) }));
  const statusBreakdown = dashboardSummary?.order_status_breakdown || [];
  const topItems = dashboardSummary?.top_items || [];
  const dashCurrency = dashboardSummary?.currency || "INR";

  const TierIcon = sub ? (TIER_ICON[sub.tier] || Zap) : Zap;
  const tierGradient = sub ? (TIER_GRADIENT[sub.tier] || TIER_GRADIENT.free) : TIER_GRADIENT.free;
  const imagesNearLimit = sub && sub.images_used >= sub.image_limit;

  const recentInquiries = [...inquiries].slice(0, 4);
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0))
    .slice(0, 4);
  const activeTier = sub?.tier || planTier;
  const dashboardBackground = {
    free: "bg-[#F6F7FB]",
    standard: "bg-[#F6F7FB]",
    premium: "bg-[#F6F7FB]",
  }[activeTier] || "bg-[#F6F7FB]";

  return (
    <>
    <div className={`min-h-full ${dashboardBackground} p-4 sm:p-6`}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header / greeting + tier banner */}
        <div className={`rounded-2xl bg-gradient-to-br ${tierGradient} p-6 text-white relative overflow-hidden`}>
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -right-2 -bottom-12 w-32 h-32 rounded-full bg-white/5" />
          <div className="relative flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-white/70 font-semibold">Welcome back,</p>
              <h1 className="text-2xl font-black">{vendorName}</h1>
            </div>
            <button onClick={() => onNavigate("subscription")}
              className="flex items-center gap-3 bg-white/15 hover:bg-white/25 transition rounded-xl px-4 py-2.5 backdrop-blur-sm">
              <TierIcon className="w-5 h-5" />
              <div className="text-left">
                <p className="text-xs text-white/70 font-semibold leading-tight">Current plan</p>
                <p className="text-sm font-black leading-tight">{sub?.label || "Free"}</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-white/70" />
            </button>
          </div>

          {sub && (
            <div className="relative mt-5 flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-white/60 font-semibold uppercase tracking-wide">Catalogue images</p>
                <p className="text-lg font-black mt-0.5">
                  {sub.images_used} <span className="text-white/50 font-semibold text-sm">/ {sub.image_limit}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-white/60 font-semibold uppercase tracking-wide">Visibility window</p>
                <p className="text-lg font-black mt-0.5">{sub.visibility_days} days</p>
              </div>
              {imagesNearLimit && (
                <div className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-1.5 self-center">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">Catalogue limit reached</span>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-4 py-3 rounded-xl">
            ⚠ {error}
          </div>
        )}

        {!hasKyb && (
          <section className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-teal-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><ShieldCheck className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-black text-slate-900">Complete vendor verification to receive retailer orders</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{hasTaxProfile ? `Your KYB is ${kybStatus.toLowerCase()}. Add or update payout and document details in Settings.` : "First add your PAN and GST, then submit payout and document details in Settings."}</p>
              </div>
            </div>
            <button type="button" onClick={() => onNavigate("settings")} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800">
              Complete now <ChevronRight className="h-4 w-4" />
            </button>
          </section>
        )}

        {!setupComplete && (
          <VendorGetStarted
            businessTypes={businessTypes}
            catalogueCount={catalogueCount}
            activeRetailers={activeRetailers}
            hasWhatsApp={hasWhatsApp}
            hasOrders={orders.length > 0}
            hasTaxProfile={hasTaxProfile}
            hasKyb={hasKyb}
            kybStatus={kybStatus}
            onNavigate={onNavigate}
          />
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard icon={IndianRupee} label="Confirmed revenue" value={money(dashboardSummary?.confirmed_revenue, dashCurrency)}
            accent={{ bg: "bg-teal-100", text: "text-teal-700" }}
            trend={dashboardSummary?.revenue_change_pct}
            onClick={() => onNavigate("purchase-order")} />
          <KpiCard icon={ImageIcon} label="Catalogue items" value={catalogueCount}
            accent={{ bg: "bg-indigo-100", text: "text-indigo-600" }}
            onClick={() => onNavigate("catalogue")} />
          <KpiCard icon={MessageSquare} label="Pending inquiries" value={pendingInquiries}
            accent={{ bg: "bg-amber-100", text: "text-amber-600" }}
            onClick={() => onNavigate("catalogue")} />
          <KpiCard icon={Users} label="Active retailers" value={activeRetailers}
            accent={{ bg: "bg-emerald-100", text: "text-emerald-600" }}
            onClick={() => onNavigate("retailers")} />
          <KpiCard icon={ShoppingBag} label="Open orders" value={openOrders}
            accent={{ bg: "bg-sky-100", text: "text-sky-600" }}
            onClick={() => onNavigate("purchase-order")} />
        </div>

        {/* Analytics: revenue trend + order status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-sm font-black text-slate-900">Revenue trend</p>
            <p className="text-xs text-slate-500 mb-3">Confirmed order value by month, last 6 months</p>
            {revenueTrend.every(r => r.revenue === 0) ? (
              <div className="py-12 text-center text-xs text-slate-400">No confirmed revenue yet in this window.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} content={<ChartTooltip formatter={(v) => money(v, dashCurrency)} />} />
                  <Bar dataKey="revenue" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-sm font-black text-slate-900">Orders by status</p>
            <p className="text-xs text-slate-500 mb-3">All-time, this vendor</p>
            {statusBreakdown.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No orders yet</div>
            ) : (
              <div className="space-y-2.5">
                {statusBreakdown.map((row) => {
                  const max = statusBreakdown[0].count || 1;
                  const color = ORDER_STATUS_COLOR[row.status] || MUTED;
                  return (
                    <div key={row.status}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-700">{row.status}</span>
                        <span className="font-bold" style={{ color: INK }}>{row.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(6, (row.count / max) * 100)}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top items + Job Work (job-work vendors only) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-sm font-black text-slate-900">Top selling catalogue items</p>
            <p className="text-xs text-slate-500 mb-3">By confirmed order revenue</p>
            {topItems.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">No confirmed order lines yet</div>
            ) : (
              <div className="space-y-3">
                {topItems.map((item, i) => {
                  const max = topItems[0].revenue || 1;
                  return (
                    <div key={item.description + i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-700 truncate pr-2">{item.description}</span>
                        <span className="shrink-0 font-bold text-slate-900">{money(item.revenue, dashCurrency)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(6, (item.revenue / max) * 100)}%`, background: SERIES[i % SERIES.length] }} />
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400">{item.quantity} units</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isJobWorker && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-violet-700"><Wrench className="h-4 w-4" /></span>
                <p className="text-sm font-black text-slate-900">Job work</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => onNavigate("job-work")} className="rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50">
                  <p className="text-2xl font-black text-slate-900">{jobWorkOpen}</p>
                  <p className="text-xs font-semibold text-slate-500">Open orders</p>
                </button>
                <button onClick={() => onNavigate("job-work")} className={`rounded-xl border p-3 text-left ${jobWorkOverdue > 0 ? "border-rose-200 bg-rose-50 hover:bg-rose-100" : "border-slate-200 hover:bg-slate-50"}`}>
                  <p className={`text-2xl font-black ${jobWorkOverdue > 0 ? "text-rose-600" : "text-slate-900"}`}>{jobWorkOverdue}</p>
                  <p className={`text-xs font-semibold ${jobWorkOverdue > 0 ? "text-rose-600" : "text-slate-500"}`}>Overdue</p>
                </button>
              </div>
              {jobWorkOrders.length === 0 && <p className="mt-3 text-xs text-slate-400">No job-work orders assigned yet.</p>}
            </div>
          )}
        </div>

        <VendorWorkspaceGrid onNavigate={onNavigate} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Recent inquiries */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-black text-slate-900">Recent inquiries</p>
              <button onClick={() => onNavigate("catalogue")}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {recentInquiries.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No inquiries yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {recentInquiries.map(inq => (
                  <div key={inq._id} className="px-5 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{inq.item_name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{inq.tenant_name || "Retailer"}</p>
                    </div>
                    <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      inq.status === "Pending"   ? "bg-amber-100 text-amber-700" :
                      inq.status === "Responded" ? "bg-emerald-100 text-emerald-700" :
                      inq.status === "Converted" ? "bg-indigo-100 text-indigo-700" :
                      "bg-slate-100 text-slate-500"
                    }`}>{inq.status}</span>
                  </div>
                ))}
              </div>
            )}
            {respondedInquiries > 0 && (
              <div className="px-5 py-2.5 bg-emerald-50 border-t border-emerald-100">
                <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {respondedInquiries} awaiting buyer's next step
                </p>
              </div>
            )}
          </div>

          {/* Recent orders */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-black text-slate-900">Recent orders</p>
              <button onClick={() => onNavigate("purchase-order")}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {recentOrders.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <ShoppingBag className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No orders yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {recentOrders.map(po => (
                  <div key={po.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 font-mono">{po.orderNo}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {po.orderDate}
                      </p>
                    </div>
                    <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${PO_STATUS_STYLE[po.status] || "bg-slate-100 text-slate-500"}`}>
                      {po.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm font-black text-slate-900 mb-3">Quick actions</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ["catalogue",   ImageIcon,     "Add catalogue item"],
              ["categories",  Users,         "Set your category"],
              ["catalogue",   MessageSquare, "Respond to inquiries"],
              ["subscription",Crown,         "Manage subscription"],
            ].map(([key, Icon, label]) => (
              <button key={key} onClick={() => onNavigate(key)}
                className="flex flex-col items-start gap-2 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition text-left">
                <Icon className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-700">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
    {showTaxModal && (
      <TaxProfileWelcomeModal
        onSaved={() => { setShowTaxModal(false); setHasTaxProfile(true); }}
        onSkip={() => {
          if (vendorId) localStorage.setItem(`vendor_tax_modal_dismissed_${vendorId}`, "true");
          setShowTaxModal(false);
        }}
      />
    )}
    </>
  );
}