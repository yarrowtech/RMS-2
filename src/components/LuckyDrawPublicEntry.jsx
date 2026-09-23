import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PartyPopper } from "lucide-react";
import { API_BASE_URL } from "../config/api.js";

const emptyForm = { customer_name: "", email: "", address: "", contact_no: "", profession: "", bill_no: "", newsletter_opt_in: true };
// The box outline AND its "Your full name"-style hint text are both baked
// into the template image itself — a real border/shadow on the input would
// double up on the drawn outline, but a permanent background would cover
// that hint text even while the field is genuinely empty. So: transparent
// (hint text shows through) until there's a real value, then an opaque fill
// matching the box's own colour so typed text doesn't overlap the hint.
const overlayInputBase = "absolute rounded-xl border-0 px-[2.6%] font-sans text-sm font-semibold text-red-950 outline-none focus:ring-2 focus:ring-red-600/40";
const overlayInputClass = (value, position) => overlayInputBase + " " + (value ? "bg-[#fffbe8]" : "bg-transparent") + " " + position;

export default function LuckyDrawPublicEntry() {
  const { token } = useParams();
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null);
  const [redeemState, setRedeemState] = useState("idle"); // idle | sending | sent | error
  const [newsletterState, setNewsletterState] = useState("idle"); // idle | sending | done

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(API_BASE_URL + "/api/customer-crm/lucky-draw/public/" + token);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "This QR code isn't recognized.");
        if (!cancelled) setStatus(data);
      } catch (error) {
        if (!cancelled) setLoadError(error.message || "Unable to load this contest right now.");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch(API_BASE_URL + "/api/customer-crm/lucky-draw/public/" + token + "/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to submit your entry.");
      setResult(data);
    } catch (error) {
      setSubmitError(error.message || "Unable to submit your entry.");
    } finally {
      setSubmitting(false);
    }
  };

  // "Redeem now" doesn't redeem anything itself (staff still do that in
  // person at the counter) — it emails a copy of the coupon (image + code)
  // to the address the customer already typed in, so they still have it
  // even after this one-time Thank You page is gone.
  const redeemNow = async () => {
    if (!result?.coupon?.id) return;
    // Opening the website has to happen synchronously, in direct response
    // to the click — doing it after the awaited fetch below would run
    // outside the click's call stack and get blocked as a popup by most
    // browsers. Email sending still proceeds either way.
    if (couponWebsiteLink) {
      window.open(couponWebsiteLink, "_blank", "noopener,noreferrer");
      logWebsiteClick();
    }
    setRedeemState("sending");
    try {
      const response = await fetch(API_BASE_URL + "/api/customer-crm/coupons/public/" + result.coupon.id + "/email", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not email the coupon.");
      setRedeemState(data.sent ? "sent" : "error");
    } catch {
      setRedeemState("error");
    }
  };

  const signUpForNewsletter = async () => {
    setNewsletterState("sending");
    try {
      const response = await fetch(API_BASE_URL + "/api/customer-crm/lucky-draw/public/" + token + "/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: form.customer_name, contact_no: form.contact_no, email: form.email }),
      });
      if (!response.ok) throw new Error();
      setNewsletterState("done");
    } catch {
      setNewsletterState("idle");
    }
  };

  const overlayMessage = (text, error = false) => (
    <div className={"absolute inset-[18%] grid place-items-center p-6 text-center " + (error ? "text-red-800" : "text-red-950")}>
      <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/95 p-5 font-bold shadow-xl">{text}</div>
    </div>
  );

  // Shared between the desktop and mobile Thank You screens — a coupon only
  // shows up here if the campaign has an entry_reward_pct set (HQ decides
  // that per campaign; most won't have one, and that's fine, this section
  // just renders nothing then).
  // The website link needs the coupon's own code riding along in the URL
  // (?code=...) so whatever site it points at can show the same code —
  // otherwise clicking through lands on a page with no idea which coupon
  // the customer holds. Same pattern used on the standalone coupon link
  // page (CouponPublicView.jsx) and in the coupon emails. BUT if HQ's link
  // already has its own ?code=... (e.g. a real third-party partner site
  // where only their own fixed code, like FIRST20, actually works — our
  // made-up per-customer code means nothing to a site we don't control),
  // that's deliberate and must not be overwritten.
  const couponWebsiteLink = (() => {
    const link = result?.coupon?.website_link;
    if (!link) return "";
    try {
      const url = new URL(link);
      if (!url.searchParams.has("code")) url.searchParams.set("code", result.coupon.code);
      return url.toString();
    } catch {
      if (link.includes("code=")) return link;
      const separator = link.includes("?") ? "&" : "?";
      return `${link}${separator}code=${encodeURIComponent(result.coupon.code)}`;
    }
  })();

  // Fire-and-forget — logs that this specific customer (already known from
  // their entry) actually tapped through, without blocking or delaying the
  // target="_blank" navigation itself.
  const logWebsiteClick = () => {
    if (!result?.coupon?.id) return;
    fetch(API_BASE_URL + "/api/customer-crm/coupons/public/" + result.coupon.id + "/click", { method: "POST" }).catch(() => {});
  };

  const resultExtras = () => (
    <>
      {result?.coupon && (
        <div className="w-full max-w-xs rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-3 text-red-950">
          {result.coupon.coupon_image_url && (
            couponWebsiteLink ? (
              <a href={couponWebsiteLink} target="_blank" rel="noopener noreferrer" onClick={logWebsiteClick}>
                <img src={result.coupon.coupon_image_url} alt="Your coupon" className="mb-2 w-full rounded-xl object-cover" />
              </a>
            ) : (
              <img src={result.coupon.coupon_image_url} alt="Your coupon" className="mb-2 w-full rounded-xl object-cover" />
            )
          )}
          <p className="text-[10px] font-bold uppercase tracking-wide text-red-700">Your coupon code</p>
          <p className="text-2xl font-bold tracking-widest">{result.coupon.code}</p>
          <p className="text-sm font-semibold">{result.coupon.discount_pct}% off{result.coupon.min_bill_amount > 0 ? ` on bills over ₹${result.coupon.min_bill_amount}` : ""}</p>
          {couponWebsiteLink && (
            <a href={couponWebsiteLink} target="_blank" rel="noopener noreferrer" onClick={logWebsiteClick} className="mt-2 block w-full rounded-full bg-emerald-600 px-4 py-2 text-center text-xs font-bold text-white hover:bg-emerald-700">
              Start exploring
            </a>
          )}
          {result.coupon.email ? (
            <button type="button" onClick={redeemNow} disabled={redeemState === "sending" || redeemState === "sent"} className="mt-2 w-full rounded-full bg-red-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
              {redeemState === "sending" ? "Emailing..." : redeemState === "sent" ? "Sent! Check your inbox ✓" : "Redeem now"}
            </button>
          ) : (
            <p className="mt-2 text-[11px] font-semibold text-red-700">Show this code at the counter to redeem.</p>
          )}
          {redeemState === "error" && <p className="mt-1 text-[11px] font-semibold text-rose-700">Could not send the email — the code above still works at the counter.</p>}
        </div>
      )}
      {(form.newsletter_opt_in || newsletterState === "done") ? (
        <p className="text-xs font-semibold text-amber-200">✓ You're signed up for offers and festival updates.</p>
      ) : (
        <button type="button" onClick={signUpForNewsletter} disabled={newsletterState === "sending"} className="rounded-full border border-amber-200/60 px-4 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-200/10 disabled:opacity-60">
          {newsletterState === "sending" ? "Signing up..." : "Sign up for offers & festival updates"}
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[#570006]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
      {/* Desktop — template image with real inputs positioned exactly over
          each drawn box. */}
      <div className="relative hidden min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#a31623_0%,#70000a_46%,#350005_100%)] p-6 md:flex">
        <div className="relative w-full max-w-[980px] overflow-hidden shadow-2xl" style={{ aspectRatio: "1319 / 1193" }}>
          <img src="/lucky-draw-qr-form-template.png" alt="Festival Lucky Draw" className="absolute inset-0 h-full w-full" />
          {!status && !loadError && overlayMessage("Loading lucky draw...")}
          {loadError && overlayMessage(loadError, true)}
          {status && !status.campaign_active && overlayMessage("No contest is running for this store right now.")}
          {status?.campaign_active && !result && (
            <form onSubmit={submit} className="absolute inset-0">
              <input aria-label="Name" required className={overlayInputClass(form.customer_name, "left-[31.4%] top-[31.5%] h-[4%] w-[42.2%]")} value={form.customer_name} onChange={(event) => set("customer_name", event.target.value)} />
              <input aria-label="Email" type="email" className={overlayInputClass(form.email, "left-[31.4%] top-[39.8%] h-[4%] w-[42.2%]")} value={form.email} onChange={(event) => set("email", event.target.value)} />
              <input aria-label="Address" className={overlayInputClass(form.address, "left-[31.4%] top-[48.5%] h-[4%] w-[42.2%]")} value={form.address} onChange={(event) => set("address", event.target.value)} />
              <input aria-label="Contact number" required type="tel" inputMode="numeric" maxLength={10} className={overlayInputClass(form.contact_no, "left-[31.4%] top-[57.1%] h-[4%] w-[42.2%]")} value={form.contact_no} onChange={(event) => set("contact_no", event.target.value.replace(/\D/g, "").slice(0, 10))} />
              <input aria-label="Profession" className={overlayInputClass(form.profession, "left-[31.4%] top-[65.7%] h-[4%] w-[42.2%]")} value={form.profession} onChange={(event) => set("profession", event.target.value)} />
              <input aria-label="Bill number" required className={overlayInputClass(form.bill_no, "left-[31.4%] top-[74.3%] h-[4%] w-[42.2%]")} value={form.bill_no} onChange={(event) => set("bill_no", event.target.value)} />
              <label aria-label="Receive offers, new arrivals and festival updates" className="absolute left-[26.7%] top-[80.3%] h-[3.3%] w-[48%] cursor-pointer">
                <input type="checkbox" className="peer sr-only" checked={form.newsletter_opt_in} onChange={(event) => set("newsletter_opt_in", event.target.checked)} />
                <span aria-hidden="true" className="absolute left-0 top-0 h-[85%] aspect-square rounded-sm bg-[#fff4c9] peer-checked:bg-transparent" />
              </label>
              {submitError && <p className="absolute left-[28%] top-[84%] w-[46%] rounded bg-red-50/95 px-2 py-1 text-center font-sans text-[10px] font-bold text-red-700">{submitError}</p>}
              <button type="submit" disabled={submitting} aria-label="Submit entry" className="absolute left-[30.8%] top-[86%] h-[6.5%] w-[40.8%] rounded-full bg-transparent outline-none disabled:opacity-50">{submitting && <span className="font-sans text-xs font-black text-amber-50">Submitting...</span>}</button>
            </form>
          )}
          {/* Covers the whole card, not just a small popup over it — once
              submitted, none of the (now stale/empty-looking) form artwork
              should still show through behind the confirmation. */}
          {result && (
            <div className="absolute inset-0 flex flex-col items-center gap-4 overflow-y-auto bg-gradient-to-b from-red-900 via-red-800 to-red-950 p-10 text-center">
              <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-amber-300 bg-red-950/60"><PartyPopper className="text-amber-200" size={40} /></div>
              <h2 className="text-3xl font-bold text-amber-100">Thank you!</h2>
              <p className="max-w-md text-base text-amber-50/90">{result.message}</p>
              {resultExtras()}
            </div>
          )}
        </div>
      </div>

      {/* Mobile — same overlay technique, its own template image (a taller,
          single-column layout with decorative header/footer already drawn
          in), field positions calibrated separately since the artwork and
          aspect ratio are different from the desktop one. */}
      <div className="relative flex min-h-screen items-start justify-center overflow-hidden bg-[#570006] p-0 md:hidden">
        <div className="relative w-full max-w-[560px] overflow-hidden" style={{ aspectRatio: "941 / 1672" }}>
          <img src="/lucky-draw-mobile-template.png" alt="Festival Lucky Draw" className="absolute inset-0 h-full w-full" />
          {!status && !loadError && overlayMessage("Loading lucky draw...")}
          {loadError && overlayMessage(loadError, true)}
          {status && !status.campaign_active && overlayMessage("No contest is running for this store right now.")}
          {status?.campaign_active && !result && (
            <form onSubmit={submit} className="absolute inset-0">
              <input aria-label="Name" required className={overlayInputClass(form.customer_name, "left-[28.5%] top-[35.0%] h-[2.9%] w-[52%]")} value={form.customer_name} onChange={(event) => set("customer_name", event.target.value)} />
              <input aria-label="Email" type="email" className={overlayInputClass(form.email, "left-[28.5%] top-[42.6%] h-[2.9%] w-[52%]")} value={form.email} onChange={(event) => set("email", event.target.value)} />
              <input aria-label="Address" className={overlayInputClass(form.address, "left-[28.5%] top-[50.6%] h-[2.9%] w-[52%]")} value={form.address} onChange={(event) => set("address", event.target.value)} />
              <input aria-label="Contact number" required type="tel" inputMode="numeric" maxLength={10} className={overlayInputClass(form.contact_no, "left-[28.5%] top-[58.7%] h-[2.9%] w-[52%]")} value={form.contact_no} onChange={(event) => set("contact_no", event.target.value.replace(/\D/g, "").slice(0, 10))} />
              <input aria-label="Profession" className={overlayInputClass(form.profession, "left-[28.5%] top-[66.9%] h-[2.9%] w-[52%]")} value={form.profession} onChange={(event) => set("profession", event.target.value)} />
              <input aria-label="Bill number" required className={overlayInputClass(form.bill_no, "left-[28.5%] top-[75.1%] h-[2.9%] w-[52%]")} value={form.bill_no} onChange={(event) => set("bill_no", event.target.value)} />
              <label aria-label="Receive offers, new arrivals and festival updates" className="absolute left-[19%] top-[80.6%] h-[2.4%] w-[62%] cursor-pointer">
                <input type="checkbox" className="peer sr-only" checked={form.newsletter_opt_in} onChange={(event) => set("newsletter_opt_in", event.target.checked)} />
                <span aria-hidden="true" className="absolute left-0 top-0 h-[85%] aspect-square rounded-sm bg-[#fff4c9] peer-checked:bg-transparent" />
              </label>
              {submitError && <p className="absolute left-[19%] top-[91.5%] w-[62%] rounded bg-red-50/95 px-2 py-1 text-center font-sans text-[10px] font-bold text-red-700">{submitError}</p>}
              <button type="submit" disabled={submitting} aria-label="Submit entry" className="absolute left-[20.5%] top-[85.8%] h-[3.8%] w-[57%] rounded-full bg-transparent outline-none disabled:opacity-50">{submitting && <span className="font-sans text-xs font-black text-amber-50">Submitting...</span>}</button>
            </form>
          )}
          {result && (
            <div className="absolute inset-0 flex flex-col items-center gap-3 overflow-y-auto bg-gradient-to-b from-red-900 via-red-800 to-red-950 p-8 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full border-4 border-amber-300 bg-red-950/60"><PartyPopper className="text-amber-200" size={32} /></div>
              <h2 className="text-2xl font-bold text-amber-100">Thank you!</h2>
              <p className="max-w-xs text-sm text-amber-50/90">{result.message}</p>
              {resultExtras()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
