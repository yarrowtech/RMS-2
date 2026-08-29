import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import RetailerVerification from "../shared/RetailerVerification.jsx";

// A single-store owner's admin has scope "hq" (same as a department
// retailer's HQ admin — see superadmin_tenant_routes.py's tenant creation),
// so the existing GET/PATCH /hq/kyb endpoints already work for them. The
// only thing missing was a route they could actually reach: the KYB form
// previously only lived inside Admin.jsx at /admin, which DepartmentRouteGuard
// restricts to ["HQ", "IT", "Administrator", "SUPERADMIN"] — "Store Owner"
// was never on that list, so this page was unreachable end to end.
export default function StoreOwnerVerification() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");

  return (
    <main className="min-h-full bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-800 p-6 text-white shadow-xl">
          <div className="flex items-center gap-2 text-indigo-200"><ShieldCheck className="h-4 w-4" /><span className="text-xs font-black uppercase tracking-[.18em]">Business verification</span></div>
          <h1 className="mt-2 text-2xl font-black">Verify your business (KYB)</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">Submit this once so vendors and RMS can trust your store. Required before raising purchase orders or paying vendors once your setup grace period ends.</p>
        </section>

        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div>}

        <RetailerVerification onSaved={setMessage} />
      </div>
    </main>
  );
}
