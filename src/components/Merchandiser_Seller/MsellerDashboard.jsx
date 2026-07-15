import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useState, useEffect, useCallback } from "react";
import {
  Crown, Zap, TrendingUp, Image as ImageIcon, MessageSquare, Users, ShoppingBag,
  ArrowUpRight, Clock, CheckCircle2, AlertTriangle, RefreshCw, ChevronRight,
} from "lucide-react";

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
 *   "catalogue" | "inquiries" | "subscription" | "category" | "retailers" | "orders"
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

function KpiCard({ icon: Icon, label, value, accent, onClick }) {
  return (
    <button onClick={onClick}
      className="text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-sm transition group">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent.bg}`}>
          <Icon className={`w-4.5 h-4.5 ${accent.text}`} />
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition" />
      </div>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
    </button>
  );
}

export default function MSellerDashboard({ onNavigate = () => {} }) {
  const [vendorName, setVendorName] = useState("");
  const [sub, setSub] = useState(null);
  const [catalogueCount, setCatalogueCount] = useState(0);
  const [inquiries, setInquiries] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, subRes, catRes, inqRes, tenantRes, poRes] = await Promise.all([
        vendorFetch("/api/vendors/me"),
        vendorFetch("/api/subscriptions/me"),
        vendorFetch("/api/catalogue/my-catalogue"),
        vendorFetch("/api/catalogue/my-inquiries"),
        vendorFetch("/api/vendors/my-tenant"),
        vendorFetch("/api/vendors/my-purchaseorders"),
      ]);

      const me = await meRes.json();
      if (meRes.ok) setVendorName(me.name || me.vendor_name || "there");

      if (subRes.ok) setSub((await subRes.json()).data);

      if (catRes.ok) {
        const cat = await catRes.json();
        setCatalogueCount((cat.data || []).filter(i => i.active).length);
      }

      if (inqRes.ok) setInquiries((await inqRes.json()).data || []);

      if (tenantRes.ok) setRetailers((await tenantRes.json()).data || []);

      if (poRes.ok) setOrders(await poRes.json() || []);
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

  const TierIcon = sub ? (TIER_ICON[sub.tier] || Zap) : Zap;
  const tierGradient = sub ? (TIER_GRADIENT[sub.tier] || TIER_GRADIENT.free) : TIER_GRADIENT.free;
  const imagesNearLimit = sub && sub.images_used >= sub.image_limit;

  const recentInquiries = [...inquiries].slice(0, 4);
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0))
    .slice(0, 4);

  return (
    <div className="min-h-full bg-[#F6F7FB] p-4 sm:p-6">
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

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={ImageIcon} label="Catalogue items" value={catalogueCount}
            accent={{ bg: "bg-indigo-100", text: "text-indigo-600" }}
            onClick={() => onNavigate("catalogue")} />
          <KpiCard icon={MessageSquare} label="Pending inquiries" value={pendingInquiries}
            accent={{ bg: "bg-amber-100", text: "text-amber-600" }}
            onClick={() => onNavigate("inquiries")} />
          <KpiCard icon={Users} label="Active retailers" value={activeRetailers}
            accent={{ bg: "bg-emerald-100", text: "text-emerald-600" }}
            onClick={() => onNavigate("retailers")} />
          <KpiCard icon={ShoppingBag} label="Open orders" value={openOrders}
            accent={{ bg: "bg-sky-100", text: "text-sky-600" }}
            onClick={() => onNavigate("orders")} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Recent inquiries */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-black text-slate-900">Recent inquiries</p>
              <button onClick={() => onNavigate("inquiries")}
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
              <button onClick={() => onNavigate("orders")}
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
              ["category",    Users,         "Set your category"],
              ["inquiries",   MessageSquare, "Respond to inquiries"],
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
  );
}