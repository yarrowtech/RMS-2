import React from "react";
import { CheckCircle2, Clock3, LockKeyhole, ShieldCheck } from "lucide-react";

export default function RetailerPayment() {
  const status = new URLSearchParams(window.location.search).get("status");
  const isProcessing = status === "processing";

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