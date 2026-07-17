import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useState, useEffect, useCallback } from "react";
import { Check, Zap, Crown, TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";

/**
 * VendorSubscriptionTab.jsx
 * ============================
 * Vendor-facing tier display + upgrade. Talks to subscription_routes.py.
 *
 * ⚠️ Payment is a stub on the backend (see subscription_routes.py's big
 * warning on upgrade_subscription()). The "Upgrade" button here calls
 * POST /api/subscriptions/upgrade with simulate_payment: true — that only
 * works if the server has ALLOW_SIMULATED_PAYMENTS=true set, which should
 * NEVER be true in production. Once a real payment gateway exists, this
 * component's upgrade button should instead redirect to that gateway's
 * checkout page/flow, not call this endpoint directly.
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
const TIER_COLOR = {
  free:     { bg: "bg-slate-100", text: "text-slate-600", ring: "ring-slate-200", btn: "bg-slate-600 hover:bg-slate-700" },
  standard: { bg: "bg-indigo-100", text: "text-indigo-700", ring: "ring-indigo-300", btn: "bg-indigo-600 hover:bg-indigo-700" },
  premium:  { bg: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-300", btn: "bg-amber-600 hover:bg-amber-700" },
};

function UsageBar({ used, limit, label }) {
  const unlimited = limit === null || limit === undefined;
  const pct = unlimited ? 0 : Math.min(100, (used / Math.max(limit, 1)) * 100);
  const nearLimit = !unlimited && used >= limit;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <span className={`text-xs font-bold ${nearLimit ? "text-rose-600" : "text-slate-500"}`}>
          {unlimited ? `${used} used · Unlimited` : `${used} / ${limit}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${nearLimit ? "bg-rose-500" : "bg-indigo-500"}`}
            style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function VendorSubscriptionTab() {
  const [tiers, setTiers] = useState({});
  const [mySub, setMySub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);
  const [error, setError] = useState(null);
  const [devModeNote, setDevModeNote] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tiersRes, meRes] = await Promise.all([
        vendorFetch("/api/subscriptions/tiers"),
        vendorFetch("/api/subscriptions/me"),
      ]);
      const tiersJson = await tiersRes.json();
      const meJson = await meRes.json();
      setTiers(tiersJson.data || {});
      setMySub(meJson.data || null);
    } catch {
      setError("Could not load subscription info.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleUpgrade = async (tierKey) => {
    if (tierKey === mySub?.tier) return;
    setUpgrading(tierKey);
    setError(null);
    try {
      const res = await vendorFetch("/api/subscriptions/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ⚠️ simulate_payment only works if the SERVER has
        // ALLOW_SIMULATED_PAYMENTS=true — see the file-level warning.
        // A real integration replaces this whole call with a redirect to
        // a payment gateway's checkout instead.
        body: JSON.stringify({ tier: tierKey, simulate_payment: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.detail && data.detail.includes("Simulated payments are disabled")) {
          setDevModeNote(true);
        }
        throw new Error(data.detail || "Upgrade failed.");
      }
      await fetchAll();
      window.dispatchEvent(new Event("vendor-access-updated"));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F6F7FB] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        <div>
          <h1 className="text-xl font-black text-slate-900">Subscription</h1>
          <p className="text-xs text-slate-500 mt-1">Manage your catalogue plan and see your current usage</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {devModeNote && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Payment isn't connected yet on this server — upgrades are disabled outside a development
              environment. Contact your administrator once billing is set up.
            </p>
          </div>
        )}

        {/* Current usage */}
        {mySub && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Current plan</p>
                <p className="text-lg font-black text-slate-900">{mySub.label}</p>
              </div>
              {mySub.status === "pending_payment" && (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                  Awaiting payment
                </span>
              )}
            </div>
            <UsageBar used={mySub.images_used} limit={mySub.image_limit} label="Catalogue images" />
            <UsageBar used={mySub.business_types_used} limit={mySub.business_type_limit} label="Business type tags" />
            <p className="text-xs text-slate-400">
              Images stay visible for {mySub.visibility_days} days after upload, then auto-hide until renewed or replaced.
            </p>
          </div>
        )}

        {/* Tier cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(tiers).map(([key, cfg]) => {
            const Icon = TIER_ICON[key] || Zap;
            const colors = TIER_COLOR[key] || TIER_COLOR.free;
            const isCurrent = mySub?.tier === key;
            return (
              <div key={key} className={`bg-white rounded-2xl border-2 p-5 flex flex-col ${isCurrent ? `${colors.ring} ring-2` : "border-slate-200"}`}>
                <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
                <p className="text-base font-black text-slate-900">{cfg.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {cfg.price_inr === 0 ? "Free" : `₹${cfg.price_inr}`}
                  {cfg.price_inr > 0 && <span className="text-xs font-semibold text-slate-400">/month</span>}
                </p>

                <ul className="mt-4 space-y-2 flex-1">
                  {[
                    `${cfg.image_limit} catalogue images`,
                    `Visible for ${cfg.visibility_days} days`,
                    cfg.business_type_limit ? `${cfg.business_type_limit} business type tag${cfg.business_type_limit > 1 ? "s" : ""}` : "Unlimited business types",
                    cfg.inquiry_limit_per_month ? `${cfg.inquiry_limit_per_month} inquiries/month` : "Unlimited inquiries",
                    `${cfg.finance_history_months} months finance history`,
                    `${cfg.finance_transaction_limit} recent payment records`,
                    cfg.finance_export ? "Transaction CSV export" : "Finance dashboard view",
                    cfg.finance_retailer_breakdown ? "Retailer account breakdown" : "Combined account totals",
                    cfg.finance_forecasting ? "Receipt forecasting" : null,
                  ].filter(Boolean).map((line) => (
                    <li key={line} className="flex items-start gap-2 text-xs text-slate-600">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      {line}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(key)}
                  disabled={isCurrent || upgrading === key}
                  className={`mt-4 h-9 rounded-lg text-xs font-bold text-white transition disabled:opacity-50 ${isCurrent ? "bg-slate-300" : colors.btn}`}
                >
                  {isCurrent ? "Current plan" : upgrading === key ? "Processing…" : `Switch to ${cfg.label}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
