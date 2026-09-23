import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Ticket } from "lucide-react";
import { API_BASE_URL } from "../config/api.js";

// Public, no-login page a shared coupon link opens to (see the "Copy link"
// button in Customer CRM's Coupons tab). Read-only — the coupon itself is
// still only ever redeemed in person, by staff, at the counter.
export default function CouponPublicView() {
  const { couponId } = useParams();
  const [coupon, setCoupon] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [emailState, setEmailState] = useState("idle"); // idle | sending | sent | error

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/customer-crm/coupons/public/${couponId}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "This coupon link isn't recognized.");
        if (!cancelled) setCoupon(data);
      } catch (error) {
        if (!cancelled) setLoadError(error.message || "Unable to load this coupon right now.");
      }
    })();
    return () => { cancelled = true; };
  }, [couponId]);

  // The website link is HQ's own site — it has no idea which coupon this
  // customer holds unless we tell it. Appending ?code=... (matching the
  // ?code=FIRST20 pattern most "apply a coupon" landing pages already use)
  // is what makes the destination site show the SAME code, instead of
  // whatever it displays by default.
  const websiteLinkWithCode = (() => {
    if (!coupon?.website_link) return "";
    try {
      const url = new URL(coupon.website_link);
      url.searchParams.set("code", coupon.code);
      return url.toString();
    } catch {
      const separator = coupon.website_link.includes("?") ? "&" : "?";
      return `${coupon.website_link}${separator}code=${encodeURIComponent(coupon.code)}`;
    }
  })();

  // Fire-and-forget — logs that this specific customer (name/phone/email
  // already on the coupon from however it was issued) tapped through to
  // the website, without blocking or delaying the target="_blank" nav.
  const logWebsiteClick = () => {
    if (!coupon) return;
    fetch(`${API_BASE_URL}/api/customer-crm/coupons/public/${couponId}/click`, { method: "POST" }).catch(() => {});
  };

  const emailMe = async () => {
    setEmailState("sending");
    try {
      const response = await fetch(`${API_BASE_URL}/api/customer-crm/coupons/public/${couponId}/email`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not email the coupon.");
      setEmailState(data.sent ? "sent" : "error");
    } catch {
      setEmailState("error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      {!coupon && !loadError && <p className="font-semibold text-slate-500">Loading coupon...</p>}
      {loadError && <p className="max-w-sm text-center font-semibold text-rose-600">{loadError}</p>}
      {coupon && (
        <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
          {coupon.coupon_image_url && (
            websiteLinkWithCode ? (
              <a href={websiteLinkWithCode} target="_blank" rel="noopener noreferrer" onClick={logWebsiteClick}>
                <img src={coupon.coupon_image_url} alt="Coupon" className="h-48 w-full object-cover" />
              </a>
            ) : (
              <img src={coupon.coupon_image_url} alt="Coupon" className="h-48 w-full object-cover" />
            )
          )}
          <div className="p-6 text-center">
            <Ticket className="mx-auto mb-2 text-indigo-600" size={28} />
            {coupon.customer_name && <p className="text-xs font-semibold text-slate-500">Issued to {coupon.customer_name}</p>}
            <p className="mt-2 text-3xl font-black tracking-widest text-slate-900">{coupon.code}</p>
            <p className="mt-2 text-lg font-bold text-indigo-700">
              {coupon.discount_pct}% off{coupon.min_bill_amount > 0 ? ` on bills over ₹${coupon.min_bill_amount}` : ""}
            </p>
            {coupon.expiry_date && <p className="mt-1 text-xs font-semibold text-amber-700">Valid until {coupon.expiry_date}</p>}

            {coupon.status === "REDEEMED" && <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm font-bold text-slate-500">This coupon has already been redeemed.</p>}
            {coupon.status === "DISABLED" && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-600">This coupon is no longer valid.</p>}
            {coupon.status === "ACTIVE" && (
              <>
                <p className="mt-4 text-xs font-semibold text-slate-500">Show this code at the counter to redeem it.</p>
                {websiteLinkWithCode && (
                  <a
                    href={websiteLinkWithCode}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={logWebsiteClick}
                    className="mt-3 block w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600"
                  >
                    Start exploring
                  </a>
                )}
                {coupon.has_email && (
                  <button
                    type="button"
                    onClick={emailMe}
                    disabled={emailState === "sending" || emailState === "sent"}
                    className="mt-3 w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {emailState === "sending" ? "Emailing..." : emailState === "sent" ? "Sent! Check your inbox ✓" : "Email me this coupon"}
                  </button>
                )}
                {emailState === "error" && <p className="mt-2 text-xs font-semibold text-rose-600">Could not send the email — the code above still works at the counter.</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
