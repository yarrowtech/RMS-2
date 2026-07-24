import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useState, useEffect, useCallback } from "react";
import { Check, Zap, Crown, TrendingUp, RefreshCw } from "lucide-react";

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

function responseMessage(data, fallback) {
  return data?.detail || data?.message || fallback;
}

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

const TIER_ICON = { free: Zap, standard: TrendingUp, premium: Crown };
const TIER_COLOR = {
  free: { bg: "bg-slate-100", text: "text-slate-600", ring: "ring-slate-200", btn: "bg-slate-600 hover:bg-slate-700" },
  standard: { bg: "bg-indigo-100", text: "text-indigo-700", ring: "ring-indigo-300", btn: "bg-indigo-600 hover:bg-indigo-700" },
  premium: { bg: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-300", btn: "bg-amber-600 hover:bg-amber-700" },
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
          {unlimited ? `${used} used - Unlimited` : `${used} / ${limit}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${nearLimit ? "bg-rose-500" : "bg-indigo-500"}`}
            style={{ width: `${pct}%` }}
          />
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
  const [paymentNotice, setPaymentNotice] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tiersRes, meRes] = await Promise.all([
        vendorFetch("/api/subscriptions/tiers"),
        vendorFetch("/api/subscriptions/me"),
      ]);
      const [tiersJson, meJson] = await Promise.all([tiersRes.json(), meRes.json()]);
      if (!tiersRes.ok) throw new Error(responseMessage(tiersJson, "Could not load subscription plans."));
      if (!meRes.ok) throw new Error(responseMessage(meJson, "Could not load your subscription."));
      setTiers(tiersJson.data || {});
      setMySub(meJson.data || null);
    } catch (err) {
      setError(err.message || "Could not load subscription info.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const verifyPayment = async (paymentResponse) => {
    try {
      const res = await vendorFetch("/api/subscriptions/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentResponse),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(responseMessage(data, "Payment verification failed."));

      if (data.subscription_active) {
        setPaymentNotice("Payment captured. Your subscription is active now.");
        await fetchAll();
        window.dispatchEvent(new Event("vendor-access-updated"));
      } else {
        setPaymentNotice("Payment received. Your plan activates after Razorpay captures it.");
        setTimeout(async () => {
          await fetchAll();
          window.dispatchEvent(new Event("vendor-access-updated"));
        }, 2500);
      }
    } catch (err) {
      setError(err.message || "Payment verification failed. Please contact support with your payment reference.");
    } finally {
      setUpgrading(null);
    }
  };

  const handleUpgrade = async (tierKey, isRenewal = false) => {
    if (tierKey === mySub?.tier && !isRenewal) return;
    setUpgrading(tierKey);
    setError(null);
    setPaymentNotice("");

    try {
      if (tierKey === "free") {
        const res = await vendorFetch("/api/subscriptions/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: "free" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(responseMessage(data, "Could not switch to Free."));
        await fetchAll();
        window.dispatchEvent(new Event("vendor-access-updated"));
        setUpgrading(null);
        return;
      }

      const checkoutRes = await vendorFetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierKey }),
      });
      const checkout = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error(responseMessage(checkout, "Could not start secure checkout."));

      await loadRazorpayCheckout();
      if (!window.Razorpay) throw new Error("Secure payment checkout is unavailable. Please try again.");

      const razorpay = new window.Razorpay({
        key: checkout.key_id,
        amount: checkout.amount,
        currency: checkout.currency,
        name: "RMS Vendor Subscription",
        description: `${checkout.plan?.label || "Vendor"} plan - 30 days`,
        order_id: checkout.order_id,
        prefill: checkout.prefill || {},
        theme: { color: "#4f46e5" },
        handler: verifyPayment,
        modal: { ondismiss: () => setUpgrading(null) },
      });
      razorpay.open();
    } catch (err) {
      setError(err.message || "Could not start checkout.");
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
          <p className="text-xs text-slate-500 mt-1">Manage your catalogue plan and pay securely through Razorpay</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {paymentNotice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold px-4 py-3 rounded-xl">
            {paymentNotice}
          </div>
        )}

        {mySub?.lapsed_tier && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold px-4 py-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <span>Your {tiers[mySub.lapsed_tier]?.label || mySub.lapsed_tier} plan expired and you're now on Free tier limits. Renew to get your benefits back.</span>
            <button onClick={() => handleUpgrade(mySub.lapsed_tier, true)} disabled={upgrading === mySub.lapsed_tier} className="shrink-0 h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50">
              {upgrading === mySub.lapsed_tier ? "Opening secure payment..." : `Renew ${tiers[mySub.lapsed_tier]?.label || mySub.lapsed_tier}`}
            </button>
          </div>
        )}

        {!mySub?.lapsed_tier && mySub?.renewal_due_soon && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold px-4 py-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <span>Your {mySub.label} plan renews in {mySub.days_until_expiry} day{mySub.days_until_expiry === 1 ? "" : "s"}. Renew now to avoid dropping to Free limits.</span>
            <button onClick={() => handleUpgrade(mySub.tier, true)} disabled={upgrading === mySub.tier} className="shrink-0 h-9 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-50">
              {upgrading === mySub.tier ? "Opening secure payment..." : `Renew ${mySub.label}`}
            </button>
          </div>
        )}

        {mySub && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Current plan</p>
                <p className="text-lg font-black text-slate-900">{mySub.label}</p>
              </div>
              {mySub.status === "pending_payment" && (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Awaiting payment</span>
              )}
              {mySub.pending_tier && mySub.pending_payment_status && mySub.status !== "pending_payment" && (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                  {mySub.pending_tier} payment pending
                </span>
              )}
            </div>
            {mySub.tier !== "free" && mySub.expires_at && !mySub.lapsed_tier && (
              <p className="text-xs font-semibold text-slate-500">
                Renews on {new Date(mySub.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                {typeof mySub.days_until_expiry === "number" && ` · ${mySub.days_until_expiry <= 0 ? "expiring today" : `${mySub.days_until_expiry} day${mySub.days_until_expiry === 1 ? "" : "s"} left`}`}
              </p>
            )}
            <UsageBar used={mySub.images_used} limit={mySub.image_limit} label="Catalogue images" />
            <UsageBar used={mySub.business_types_used} limit={mySub.business_type_limit} label="Business type tags" />
            <p className="text-xs text-slate-400">
              Images stay visible for {mySub.visibility_days} days after upload, then auto-hide until renewed or replaced.
            </p>
          </div>
        )}

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
                  {cfg.price_inr === 0 ? "Free" : `\u20B9${cfg.price_inr}`}
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
                  {isCurrent ? "Current plan" : upgrading === key ? "Opening secure payment..." : key === "free" ? "Switch to Free" : `Pay and switch to ${cfg.label}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}