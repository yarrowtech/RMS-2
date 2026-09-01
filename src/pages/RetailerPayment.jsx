import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, LockKeyhole, ShieldCheck } from "lucide-react";
import { API_BASE_URL } from "../config/api.js";

const getAdminToken = () => (
  localStorage.getItem("admin_token") ||
  localStorage.getItem("access_token") ||
  localStorage.getItem("token") ||
  ""
);

export default function RetailerPayment() {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const status = query.get("status");
  const paymentLinkId = query.get("razorpay_payment_link_id");
  // Razorpay may append its query parameters without preserving the status flag.
  const isProcessing = status === "processing" || Boolean(paymentLinkId);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isProcessing || !paymentLinkId) return undefined;
    const token = getAdminToken();
    // New onboarding has no admin session. It must wait for the secure setup email.
    if (!token) return undefined;

    let cancelled = false;
    let attempts = 0;
    const checkVerifiedPayment = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/retailer-subscriptions/payment-return-status?payment_link_id=${encodeURIComponent(paymentLinkId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        if (data.verified && data.redirect_path) {
          setMessage("Payment verified. Opening your HQ Admin workspace...");
          window.setTimeout(() => window.location.replace(data.redirect_path), 650);
          return;
        }
        if (!data.verified) {
          setMessage("Payment received. Waiting for secure verification - this normally takes a few seconds.");
        }
      } catch {
        // Keep waiting: a temporary network problem must never mark payment as verified.
      }
    };

    checkVerifiedPayment();
    const interval = window.setInterval(() => {
      attempts += 1;
      if (attempts >= 20) window.clearInterval(interval);
      else checkVerifiedPayment();
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isProcessing, paymentLinkId]);

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,rgba(99,102,241,.18),transparent_32%),#f8fafc] p-4">
      <section className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
        <header className="bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-7 py-8 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            {isProcessing ? <Clock3 size={24} /> : <LockKeyhole size={24} />}
          </div>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[.18em] text-indigo-200">Secure RMS activation</p>
          <h1 className="mt-2 text-3xl font-black">{isProcessing ? "Payment received" : "Secure payment"}</h1>
        </header>
        <div className="p-7 sm:p-8">
          {isProcessing ? <>
            <CheckCircle2 className="text-emerald-600" size={42} />
            <h2 className="mt-5 text-2xl font-black text-slate-950">We are confirming your payment</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Razorpay has returned you to RMS. Your workspace is activated only after the signed Razorpay webhook confirms the payment. We will send the set-password email to your registered business email once that is complete.</p>
            {message && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}
          </> : <>
            <ShieldCheck className="text-emerald-600" size={42} />
            <h2 className="mt-5 text-2xl font-black text-slate-950">Pay only through the Razorpay link</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Your approved onboarding email contains a unique Razorpay-hosted payment link. RMS never asks you to send card, UPI, bank, or payment details by email.</p>
          </>}
          <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm font-semibold leading-6 text-indigo-950">For payment-link help, contact RMS support using the contact details in your approval email.</div>
        </div>
      </section>
    </main>
  );
}