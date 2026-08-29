import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import React, { useEffect, useState, useCallback } from "react";
import {
  Building2, Plus, Search, Eye, Pencil, Trash2, X,
  CheckCircle, XCircle, AlertCircle, Store, Users,
  Crown, Zap, Rocket, ChevronDown, ChevronUp, CreditCard, Gift,
  ShieldCheck, ShieldAlert, ShieldQuestion, Factory, Truck,
} from "lucide-react";
import toast from "react-hot-toast";

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

// Basic/Professional/Enterprise paid ladder — kept in sync with
// STORE_PLAN_CONFIG in store_upgrade_routes.py. Separate from the legacy
// starter/professional/enterprise PLAN_CFG below, which belongs only to the
// original (untouched) Department Retailer / free Single Store flow.
const SIGNUP_PLAN_CFG = {
  basic:        { label: "Basic",        price: 50000,  workspace: "Single Store",   icon: Store,  bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
  professional: { label: "Professional", price: 90000,  workspace: "Multi-Store HQ", icon: Rocket, bg: "bg-blue-50",   text: "text-blue-700",  border: "border-blue-200"  },
  enterprise:   { label: "Enterprise",   price: 125000, workspace: "Multi-Store HQ", icon: Crown,  bg: "bg-amber-50",  text: "text-amber-700", border: "border-amber-200" },
};

const API   = APP_API_URL;
const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem("superadmin_token") || "";
  const res   = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    ...opts,
  });
  const raw = await res.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { detail: raw }; }
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
};

const PLAN_CFG = {
  basic:                    { label: "Basic",                    icon: <Zap className="w-3 h-3"/>,    bg: "bg-slate-100",   text: "text-slate-700",  border: "border-slate-200"  },
  professional:             { label: "Professional",             icon: <Rocket className="w-3 h-3"/>, bg: "bg-blue-50",     text: "text-blue-700",   border: "border-blue-200"   },
  enterprise:               { label: "Enterprise",               icon: <Crown className="w-3 h-3"/>,  bg: "bg-amber-50",    text: "text-amber-700",  border: "border-amber-200"  },
  internal_free_enterprise: { label: "Internal Free Enterprise", icon: <Gift className="w-3 h-3"/>,   bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
};

const STATUS_CFG = {
  active:    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  suspended: { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    dot: "bg-rose-500"    },
};

const KYB_STATUS_CFG = {
  "Not started": { bg: "bg-slate-100",  text: "text-slate-500",  border: "border-slate-200",  icon: ShieldQuestion },
  "Submitted":   { bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-200",  icon: ShieldAlert },
  "Verified":    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: ShieldCheck },
  "Rejected":    { bg: "bg-rose-50",    text: "text-rose-700",   border: "border-rose-200",   icon: ShieldAlert },
};

const INP = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition bg-white";
const LBL = "block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5";

// ── EMPTY FORMS ────────────────────────────────────────────────────────────────
const EMPTY_TENANT = {
  account_type:    "department_retailer",
  company_name:    "",
  tenant_id:       "",
  gstin:           "",
  plan:            "professional",
  phone:           "",
  city:            "",
  state:           "",
  address:         "",
  hq_admin_name:   "",
  hq_admin_email:  "",
  hq_admin_phone:  "",
};

// ── Auto-generate tenant_id from company name ──────────────────────────────────
const toSlug = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

// ══════════════════════════════════════════════════════════════════════════════
// ADD RETAILER MODAL
// ══════════════════════════════════════════════════════════════════════════════
function AddRetailerModal({ onClose, onCreated, onboardingRequest }) {
  const [form,   setForm]   = useState(EMPTY_TENANT);
  const [saving, setSaving] = useState(false);
  const [step,   setStep]   = useState(1); // 1 = retailer info, 2 = hq admin

  useEffect(() => {
    if (!onboardingRequest) return;
    setForm({
      ...EMPTY_TENANT,
      company_name: onboardingRequest.business_name || "",
      tenant_id: toSlug(onboardingRequest.business_name || ""),
      plan: onboardingRequest.requested_plan || "professional",
      account_type: onboardingRequest.requested_plan === "basic" ? "single_store" : "department_retailer",
      phone: onboardingRequest.phone || "",
      city: onboardingRequest.city || "",
      state: onboardingRequest.state || "",
      hq_admin_name: onboardingRequest.contact_name || "",
      hq_admin_email: onboardingRequest.email || "",
      onboarding_request_id: onboardingRequest.id,
    });
  }, [onboardingRequest]);

  const f = (k) => (e) => {
    const val = e.target.value;
    setForm(p => {
      const next = { ...p, [k]: val };
      // Auto-fill tenant_id from company_name (only if not manually edited)
      if (k === "company_name") {
        const autoSlug = toSlug(val);
        const wasAuto  = p.tenant_id === toSlug(p.company_name);
        if (wasAuto || !p.tenant_id) next.tenant_id = autoSlug;
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!form.company_name.trim()) { toast.error("Company name is required"); return; }
    if (!form.tenant_id.trim()) { toast.error("Tenant ID is required"); return; }
    if (!form.hq_admin_name.trim()) { toast.error("Primary admin name is required"); return; }
    if (!form.hq_admin_email.trim()) { toast.error("Primary admin email is required"); return; }

    try {
      setSaving(true);
      if (form.plan === "internal_free_enterprise") {
        const data = await apiFetch("/superadmin/tenants/", {
          method: "POST",
          body: JSON.stringify({ ...form, billing_mode: "waived", subscription_status: "active", free_reason: "Internal RMS tenant" }),
        });
        toast.success(`${form.company_name} was activated as an internal waived Enterprise tenant.`);
        onCreated(data);
        onClose();
        return;
      }

      const signup = await apiFetch("/api/retailer-signups/", {
        method: "POST",
        body: JSON.stringify({
          company_name: form.company_name, tenant_id: form.tenant_id, gstin: form.gstin,
          plan: form.plan, phone: form.phone, address: form.address, city: form.city, state: form.state,
          hq_admin_name: form.hq_admin_name, hq_admin_email: form.hq_admin_email,
          hq_admin_phone: form.hq_admin_phone, onboarding_request_id: form.onboarding_request_id || null,
        }),
      });
      const paymentEmail = await apiFetch(`/api/retailer-signups/${signup.signup.id}/send-payment-link`, { method: "POST" });
      toast.success(`Secure payment link sent to ${paymentEmail.email}.`);
      onCreated(paymentEmail);
      onClose();    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Onboard New Retailer</h2>
              <p className="text-xs text-slate-400">
                {step === 1 ? "Step 1 — Business details" : `Step 2 — ${form.account_type === "single_store" ? "Store Owner" : "HQ Admin"} account`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex shrink-0 border-b border-slate-100">
          {["Business Info", form.account_type === "single_store" ? "Store Owner" : "HQ Admin"].map((label, i) => (
            <button key={i} type="button" onClick={() => setStep(i+1)}
              className={`flex-1 py-3 text-sm font-bold transition border-b-2 ${
                step === i+1
                  ? "border-amber-500 text-amber-700 bg-amber-50/50"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}>
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs mr-2 ${
                step === i+1 ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"
              }`}>{i+1}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {step === 1 && (
            <>
              <div>
                <label className={LBL}>Business Setup *</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "department_retailer", title: "Department Retailer", text: "Multiple teams, departments, stores and delegated admins.", icon: Building2 },
                    { key: "single_store", title: "Single Store", text: "One owner workspace with products, stock, purchasing and POS.", icon: Store },
                  ].map(({ key, title, text, icon: Icon }) => (
                    <button key={key} type="button" onClick={() => setForm(p => ({ ...p, account_type: key, plan: key === "single_store" ? "basic" : (p.plan === "basic" ? "professional" : p.plan) }))}
                      className={`rounded-2xl border-2 p-4 text-left transition ${form.account_type === key ? "border-amber-400 bg-amber-50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}>
                      <div className="flex items-center gap-2"><Icon className={`h-5 w-5 ${form.account_type === key ? "text-amber-600" : "text-slate-500"}`} /><span className="text-sm font-black text-slate-900">{title}</span></div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={LBL}>Company Name *</label>
                  <input className={INP} value={form.company_name} onChange={f("company_name")}
                    placeholder="e.g. Zudio Retail Pvt Ltd" />
                </div>

                <div>
                  <label className={LBL}>Tenant ID * <span className="text-slate-400 font-normal normal-case tracking-normal">(unique, never changes)</span></label>
                  <input className={INP + " font-mono"} value={form.tenant_id} onChange={f("tenant_id")}
                    placeholder="e.g. zudio" />
                  <p className="text-[10px] text-slate-400 mt-1">Auto-filled from company name. Only lowercase letters, numbers, underscores.</p>
                </div>

                <div>
                  <label className={LBL}>GSTIN</label>
                  <input className={INP + " font-mono uppercase"} value={form.gstin} onChange={f("gstin")}
                    placeholder="27AAAZUD..." maxLength={15} />
                </div>

                <div>
                  <label className={LBL}>Plan *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(PLAN_CFG).map(([key, cfg]) => (
                      <button key={key} type="button"
                        onClick={() => setForm(p => ({ ...p, plan: key, account_type: key === "basic" ? "single_store" : "department_retailer" }))}
                        className={`p-2.5 rounded-xl border-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          form.plan === key
                            ? `${cfg.bg} ${cfg.text} ${cfg.border} border-opacity-100`
                            : "border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}>
                        {cfg.icon} {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={LBL}>Phone</label>
                  <input className={INP} value={form.phone} onChange={f("phone")} placeholder="+91 98765 43210" />
                </div>

                <div>
                  <label className={LBL}>City</label>
                  <input className={INP} value={form.city} onChange={f("city")} placeholder="Mumbai" />
                </div>

                <div>
                  <label className={LBL}>State</label>
                  <input className={INP} value={form.state} onChange={f("state")} placeholder="Maharashtra" />
                </div>

                <div className="col-span-2">
                  <label className={LBL}>Address</label>
                  <input className={INP} value={form.address} onChange={f("address")} placeholder="Registered address" />
                </div>
              </div>

              {/* Plan limits preview */}
              <div className={`p-3 rounded-xl border text-xs ${PLAN_CFG[form.plan].bg} ${PLAN_CFG[form.plan].border}`}>
                <p className={`font-bold mb-1 ${PLAN_CFG[form.plan].text}`}>
                  {PLAN_CFG[form.plan].label} Plan Includes:
                </p>
                <div className={`flex gap-4 ${PLAN_CFG[form.plan].text}`}>
                  <span>🏪 {form.plan === "enterprise" || form.plan === "internal_free_enterprise" ? "Unlimited" : form.plan === "professional" ? "5" : "1"} Store{form.plan !== "basic" ? "s" : ""}</span>
                  <span>👤 {form.plan === "enterprise" || form.plan === "internal_free_enterprise" ? "Unlimited" : form.plan === "professional" ? "15" : "3"} Admins</span>
                  <span>✅ Full RMS Access</span>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{form.plan === "internal_free_enterprise" ? <>This creates the <b>{form.account_type === "single_store" ? "Store Owner" : "HQ Admin"} account</b> for <b>{form.company_name || "this retailer"}</b>. They will receive a setup-password email.</> : <>After you confirm, RMS emails the retailer a secure Razorpay payment link. Their tenant and first admin are created only after payment is verified.</>}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={LBL}>{form.account_type === "single_store" ? "Store Owner" : "HQ Admin"} Full Name *</label>
                  <input className={INP} value={form.hq_admin_name} onChange={f("hq_admin_name")}
                    placeholder="e.g. Rahul Sharma" />
                </div>
                <div className="col-span-2">
                  <label className={LBL}>{form.account_type === "single_store" ? "Store Owner" : "HQ Admin"} Email *</label>
                  <input type="email" className={INP} value={form.hq_admin_email} onChange={f("hq_admin_email")}
                    placeholder="hq@zudio.com" />
                </div>
                <div className="col-span-2">
                  <label className={LBL}>{form.account_type === "single_store" ? "Store Owner" : "HQ Admin"} Phone</label>
                  <input className={INP} value={form.hq_admin_phone} onChange={f("hq_admin_phone")}
                    placeholder="+91 98765 43210" />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 text-sm">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Summary</p>
                {[
                  ["Retailer",   form.company_name || "—"],
                  ["Setup",      form.account_type === "single_store" ? "Single Store" : "Department Retailer"],
                  ["Tenant ID",  form.tenant_id    || "—"],
                  ["GSTIN",      form.gstin         || "—"],
                  ["Plan",       PLAN_CFG[form.plan]?.label],
                  ["City",       form.city          || "—"],
                  [form.account_type === "single_store" ? "Store Owner" : "HQ Admin", form.hq_admin_name || "—"],
                  ["Admin Email",form.hq_admin_email|| "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-slate-500 text-xs">{label}</span>
                    <span className="font-semibold text-slate-900 text-xs font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={() => setStep(2)}
                disabled={!form.company_name || !form.tenant_id}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-40">
                Next → {form.account_type === "single_store" ? "Store Owner" : "HQ Admin"} Setup
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition">← Back</button>
              <button onClick={handleCreate} disabled={saving || !form.hq_admin_name || !form.hq_admin_email}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Creating…</>
                  : `Create ${form.account_type === "single_store" ? "Single Store" : "Retailer & HQ Admin"}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BUSINESS VERIFICATION (KYB) REVIEW MODAL
// ══════════════════════════════════════════════════════════════════════════════
function KybReviewModal({ tenant, onClose, onReviewed }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(`/superadmin/tenants/${tenant.tenant_id}/kyb`)
      .then((res) => { setData(res.data); setNote(res.data?.note || ""); })
      .catch(() => toast.error("Failed to load business verification"))
      .finally(() => setLoading(false));
  }, [tenant.tenant_id]);

  const review = async (status) => {
    setSaving(true);
    try {
      await apiFetch(`/superadmin/tenants/${tenant.tenant_id}/kyb/review`, {
        method: "PATCH",
        body: JSON.stringify({ status, note }),
      });
      toast.success(`Business verification ${status.toLowerCase()}.`);
      onReviewed();
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const canReview = data && ["Submitted", "Rejected"].includes(data.status);

  return (
    <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Business Verification</h2>
            <p className="text-xs text-slate-400">{tenant.company_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
          ) : !data || data.status === "Not started" ? (
            <p className="text-sm text-slate-500 text-center py-8">This retailer hasn't submitted business verification yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Legal name", data.legal_name],
                  ["GSTIN", data.gstin],
                  ["PAN", data.pan],
                  ["Business address", data.business_address],
                ].map(([label, value]) => (
                  <div key={label} className={label === "Business address" ? "col-span-2" : ""}>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
                    <p className="text-slate-800 font-semibold mt-0.5">{value || "—"}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[["GST certificate", data.gst_certificate_url], ["PAN document", data.pan_document_url]].map(([label, url]) => (
                  <a key={label} href={url} target="_blank" rel="noreferrer"
                    className={`block rounded-xl border p-3 text-xs font-bold text-center transition ${url ? "border-indigo-200 text-indigo-700 hover:bg-indigo-50" : "border-slate-100 text-slate-300 pointer-events-none"}`}>
                    {label} {url ? "→" : "(not uploaded)"}
                  </a>
                ))}
              </div>
              {data.status === "Rejected" && data.note && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">Previous rejection note: {data.note}</div>
              )}
              {canReview && (
                <div>
                  <label className={LBL}>Review note {"(shown to the retailer)"}</label>
                  <textarea className={INP} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
                </div>
              )}
            </>
          )}
        </div>
        {canReview && (
          <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
            <button onClick={() => review("Rejected")} disabled={saving}
              className="flex-1 py-2.5 border border-rose-200 text-rose-700 rounded-xl text-sm font-bold hover:bg-rose-50 transition disabled:opacity-50">Reject</button>
            <button onClick={() => review("Verified")} disabled={saving}
              className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
              {saving ? "Saving…" : "Verify"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RETAILER DETAIL PANEL (expandable row)
// ══════════════════════════════════════════════════════════════════════════════
function RetailerDetail({ tenant, onClose }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/superadmin/tenants/${tenant.tenant_id}/summary`)
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenant.tenant_id]);

  return (
    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="w-3 h-3 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin"/> Loading…
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Admins ({summary.admins?.length || 0})</p>
            <div className="space-y-1.5">
              {(summary.admins || []).map(a => (
                <div key={a.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100 text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{a.name}</span>
                    <span className="text-slate-400 ml-2">{a.email}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    a.scope === 'hq' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                  }`}>{a.scope === 'hq' ? 'HQ' : a.store_name || 'Store'}</span>
                </div>
              ))}
              {!summary.admins?.length && <p className="text-xs text-slate-400">No admins yet</p>}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Stores ({summary.stores?.length || 0})</p>
            <div className="space-y-1.5">
              {(summary.stores || []).map(s => (
                <div key={s.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100 text-xs">
                  <span className="font-bold text-slate-800">{s.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    s.type === 'store' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>{s.type}</span>
                </div>
              ))}
              {!summary.stores?.length && <p className="text-xs text-slate-400">No stores yet</p>}
            </div>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              Add-on Billing ({summary.addon_payments?.length || 0})
            </p>
            <div className="space-y-1.5">
              {(summary.addon_payments || []).map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100 text-xs">
                  <div>
                    <span className="font-bold text-slate-800">
                      {p.kind === "admin_seats" ? `${p.quantity} admin seat${p.quantity !== 1 ? "s" : ""}` : `${p.quantity} store slot${p.quantity !== 1 ? "s" : ""}`}
                    </span>
                    <span className="text-slate-400 ml-2">{p.captured_at ? new Date(p.captured_at).toLocaleDateString("en-IN") : ""}</span>
                    {p.recurring && <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">Monthly</span>}
                  </div>
                  <span className="font-bold text-emerald-700">₹{Number(p.amount_inr || 0).toLocaleString("en-IN")}</span>
                </div>
              ))}
              {!summary.addon_payments?.length && <p className="text-xs text-slate-400">No add-on purchases yet</p>}
            </div>
          </div>
        </div>
      ) : <p className="text-xs text-slate-400">Failed to load details</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN — RetailersTab
// ══════════════════════════════════════════════════════════════════════════════
export default function RetailersTab({ pendingOnboarding, onConsumeOnboarding }) {
  const [tenants,    setTenants]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState("");
  const [showAdd,    setShowAdd]    = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [kybTenant,  setKybTenant]  = useState(null);
  const [upgradeRequests, setUpgradeRequests] = useState([]);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeDepartmentCatalog, setUpgradeDepartmentCatalog] = useState([]);
  const [deptSelections, setDeptSelections] = useState({});
  const [addonRequests, setAddonRequests] = useState([]);
  const [addonLoading, setAddonLoading] = useState(false);
  const [logisticsAddonRequests, setLogisticsAddonRequests] = useState([]);
  const [logisticsAddonLoading, setLogisticsAddonLoading] = useState(false);

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/superadmin/tenants/");
      setTenants(Array.isArray(data.tenants) ? data.tenants : []);
    } catch { toast.error("Failed to load retailers"); }
    finally { setLoading(false); }
  }, []);

  const fetchUpgradeRequests = useCallback(async () => {
    try {
      setUpgradeLoading(true);
      const data = await apiFetch("/api/store-upgrades/");
      const requests = Array.isArray(data.requests) ? data.requests : [];
      setUpgradeRequests(requests);
      setDeptSelections((prev) => {
        const next = { ...prev };
        requests.filter((r) => ["PENDING", "PAID_PENDING_REVIEW"].includes(r.status)).forEach((r) => {
          if (!next[r.id]) next[r.id] = r.requested_departments || [];
        });
        return next;
      });
    } catch (error) {
      toast.error(error.message || "Failed to load store upgrade requests");
    } finally {
      setUpgradeLoading(false);
    }
  }, []);

  const fetchUpgradeDepartmentCatalog = useCallback(async () => {
    try {
      const data = await apiFetch("/api/store-upgrades/departments");
      setUpgradeDepartmentCatalog(Array.isArray(data.departments) ? data.departments : []);
    } catch {
      // non-critical — approve still works with the requested departments as-is
    }
  }, []);

  const fetchAddonRequests = useCallback(async () => {
    try {
      setAddonLoading(true);
      const data = await apiFetch("/api/production-addon/requests");
      setAddonRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (error) {
      toast.error(error.message || "Failed to load Production & Job Work requests");
    } finally {
      setAddonLoading(false);
    }
  }, []);

  const reviewAddonRequest = async (request, action) => {
    try {
      await apiFetch(`/api/production-addon/requests/${request.id}`, {
        method: "PATCH", body: JSON.stringify({ action }),
      });
      toast.success(action === "approve" ? `Production & Job Work activated for ${request.company_name}` : "Activation request declined");
      fetchTenants();
      fetchAddonRequests();
    } catch (error) { toast.error(error.message); }
  };

  const fetchLogisticsAddonRequests = useCallback(async () => {
    try {
      setLogisticsAddonLoading(true);
      const data = await apiFetch("/api/logistics-addon/requests");
      setLogisticsAddonRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (error) {
      toast.error(error.message || "Failed to load Logistics requests");
    } finally {
      setLogisticsAddonLoading(false);
    }
  }, []);

  const reviewLogisticsAddonRequest = async (request, action) => {
    try {
      await apiFetch(`/api/logistics-addon/requests/${request.id}`, {
        method: "PATCH", body: JSON.stringify({ action }),
      });
      toast.success(action === "approve" ? `Logistics activated for ${request.company_name}` : "Activation request declined");
      fetchTenants();
      fetchLogisticsAddonRequests();
    } catch (error) { toast.error(error.message); }
  };

  useEffect(() => { fetchTenants(); fetchUpgradeRequests(); fetchUpgradeDepartmentCatalog(); fetchAddonRequests(); fetchLogisticsAddonRequests(); }, [fetchTenants, fetchUpgradeRequests, fetchUpgradeDepartmentCatalog, fetchAddonRequests, fetchLogisticsAddonRequests]);
  useEffect(() => { if (pendingOnboarding) setShowAdd(true); }, [pendingOnboarding]);

  const toggleDeptSelection = (requestId, key) => {
    setDeptSelections((prev) => {
      const current = prev[requestId] || [];
      const next = current.includes(key) ? current.filter((d) => d !== key) : [...current, key];
      return { ...prev, [requestId]: next };
    });
  };

  const reviewUpgradeRequest = async (request, action) => {
    try {
      await apiFetch(`/api/store-upgrades/${request.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          approved_plan: action === "approve" ? request.requested_plan : undefined,
          approved_departments: action === "approve" ? (deptSelections[request.id] || request.requested_departments || []) : undefined,
        }),
      });
      toast.success(action === "approve" ? `${request.company_name} is now a multi-store retailer` : "Upgrade request declined");
      fetchTenants();
      fetchUpgradeRequests();
    } catch (error) { toast.error(error.message); }
  };

  const handleGrantInternalFree = async (tenant) => {
    if (!window.confirm(`Move ${tenant.company_name} to Internal Free Enterprise? This only changes billing and plan capacity; it does not alter departments, admins, stores or stock.`)) return;
    try {
      await apiFetch(`/superadmin/tenants/${tenant.tenant_id}/billing`, {
        method: "PUT",
        body: JSON.stringify({ plan: "internal_free_enterprise", billing_mode: "waived", subscription_status: "active", free_reason: "Internal RMS tenant" }),
      });
      toast.success(`${tenant.company_name} is now an internal waived Enterprise tenant.`);
      fetchTenants();
    } catch (error) { toast.error(error.message); }
  };

  const handleToggleJobWorkAddon = async (tenant) => {
    const enable = !tenant.production_job_work_enabled;
    if (tenant.plan === "enterprise" && !enable) {
      toast.error("Enterprise-plan tenants have this bundled in — move them off Enterprise first to deactivate it.");
      return;
    }
    try {
      await apiFetch(`/superadmin/tenants/${tenant.tenant_id}/production-addon`, {
        method: "PUT", body: JSON.stringify({ enabled: enable }),
      });
      toast.success(`Production & Job Work ${enable ? "activated" : "deactivated"} for ${tenant.company_name}.`);
      fetchTenants();
    } catch (e) { toast.error(e.message); }
  };

  const handleToggleLogisticsAddon = async (tenant) => {
    const enable = !tenant.logistics_enabled;
    try {
      await apiFetch(`/superadmin/tenants/${tenant.tenant_id}/logistics-addon`, {
        method: "PUT", body: JSON.stringify({ enabled: enable }),
      });
      toast.success(`Logistics ${enable ? "activated" : "deactivated"} for ${tenant.company_name}.`);
      fetchTenants();
    } catch (e) { toast.error(e.message); }
  };

  const handleSuspend = async (tenant) => {
    const newStatus = tenant.status === "active" ? "suspended" : "active";
    try {
      await apiFetch(`/superadmin/tenants/${tenant.tenant_id}`, {
        method: "PUT", body: JSON.stringify({ status: newStatus }),
      });
      toast.success(`${tenant.company_name} ${newStatus === "active" ? "activated" : "suspended"}`);
      fetchTenants();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = (tenant) => {
    toast((t) => (
      <div className="flex flex-col gap-3 p-1">
        <span className="font-bold text-black">Delete <b>{tenant.company_name}</b>?</span>
        <p className="text-xs text-slate-500">This cannot be undone. All their data must be removed first.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-bold bg-slate-100 border border-slate-200 rounded-lg">Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            try {
              await apiFetch(`/superadmin/tenants/${tenant.tenant_id}`, { method: "DELETE" });
              toast.success("Retailer deleted");
              fetchTenants();
            } catch (e) { toast.error(e.message); }
          }} className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg">Delete</button>
        </div>
      </div>
    ), { duration: Infinity, style: { background: "#fff", border: "1px solid #e2e8f0" } });
  };

  const filtered = tenants.filter(t =>
    [t.company_name, t.tenant_id, t.city, t.gstin]
      .some(f => (f||"").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-500" /> Retailers
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {tenants.length} retailer{tenants.length !== 1 ? "s" : ""} on RMS platform
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search retailers..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
            </div>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-bold hover:opacity-90 transition shadow-md whitespace-nowrap">
              <Plus className="w-4 h-4" /> Add Retailer
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50">
          {[
            ["Total Retailers", tenants.length,                                                         "text-slate-900"],
            ["Active",          tenants.filter(t => t.status === "active").length,                      "text-emerald-600"],
            ["Total Stores",    tenants.reduce((s, t) => s + (t.store_count || 0), 0),                  "text-indigo-600"],
          ].map(([label, value, color]) => (
            <div key={label} className="p-4 text-center">
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {(
        <section className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 bg-violet-50 px-5 py-4">
            <div><h3 className="font-black text-violet-950">Single Store → Multi-Store requests</h3><p className="mt-0.5 text-xs text-violet-700">Approval keeps the original store and stock in place, then gives the owner Retailer HQ access after their next login.</p></div>
            <button onClick={fetchUpgradeRequests} disabled={upgradeLoading} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100">{upgradeLoading ? "Refreshing…" : "Refresh"}</button>
          </div>
          <div className="divide-y divide-slate-100">
            {upgradeRequests.filter((request) => ["PENDING", "PAID_PENDING_REVIEW"].includes(request.status)).map((request) => {
              const isPaid = request.status === "PAID_PENDING_REVIEW";
              return (
              <div key={request.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-[260px] flex-1">
                  <p className="font-bold text-slate-900">{request.company_name} <span className="font-normal text-slate-400">· {request.tenant_id}</span></p>
                  <p className="mt-1 text-xs text-slate-600">Owner: {request.owner_name} · {request.owner_email} · Current store: {request.primary_store_name || "Main store"}</p>
                  <p className="mt-1 text-xs font-bold">
                    {isPaid
                      ? <span className="text-emerald-600">Payment captured — ready for review</span>
                      : <span className="text-amber-600">Awaiting payment from the retailer</span>}
                  </p>
                  {request.note && <p className="mt-1 text-xs italic text-slate-500">“{request.note}”</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {upgradeDepartmentCatalog.map((dept) => {
                      const locked = dept.requires_plan === "enterprise" && request.requested_plan !== "enterprise";
                      const selected = (deptSelections[request.id] || []).includes(dept.key);
                      return (
                        <button
                          key={dept.key}
                          type="button"
                          disabled={locked}
                          onClick={() => toggleDeptSelection(request.id, dept.key)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${locked ? "cursor-not-allowed border-slate-100 text-slate-300" : selected ? "border-violet-300 bg-violet-100 text-violet-800" : "border-slate-200 text-slate-500 hover:border-violet-200"}`}
                        >
                          {dept.key}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black capitalize text-indigo-700">{request.requested_plan}</span>
                  <button onClick={() => reviewUpgradeRequest(request, "decline")} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">Decline</button>
                  <button
                    onClick={() => reviewUpgradeRequest(request, "approve")}
                    disabled={!isPaid}
                    title={isPaid ? "" : "Waiting for the retailer to complete payment"}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Approve upgrade
                  </button>
                </div>
              </div>
              );
            })}
            {upgradeRequests.filter((request) => ["PENDING", "PAID_PENDING_REVIEW"].includes(request.status)).length === 0 && (
              <p className="px-5 py-5 text-sm text-slate-500">
                No pending single-store upgrade requests. Use Refresh to check for new requests.
              </p>
            )}
          </div>
        </section>
      )}

      {(
        <section className="overflow-hidden rounded-xl border border-fuchsia-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-fuchsia-100 bg-fuchsia-50 px-5 py-4">
            <div><h3 className="flex items-center gap-2 font-black text-fuchsia-950"><Factory className="h-4 w-4" /> Production &amp; Job Work add-on requests</h3><p className="mt-0.5 text-xs text-fuchsia-700">Independent of plan tier — approving turns the add-on on for that tenant immediately.</p></div>
            <button onClick={fetchAddonRequests} disabled={addonLoading} className="rounded-lg border border-fuchsia-200 bg-white px-3 py-2 text-xs font-bold text-fuchsia-700 hover:bg-fuchsia-100">{addonLoading ? "Refreshing…" : "Refresh"}</button>
          </div>
          <div className="divide-y divide-slate-100">
            {addonRequests.filter((request) => request.status === "PENDING").map((request) => (
              <div key={request.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-[260px] flex-1">
                  <p className="font-bold text-slate-900">{request.company_name} <span className="font-normal text-slate-400">· {request.tenant_id}</span></p>
                  <p className="mt-1 text-xs text-slate-600">Requested by: {request.requested_by_name} · {request.requested_by_email}</p>
                  {request.note && <p className="mt-1 text-xs italic text-slate-500">“{request.note}”</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => reviewAddonRequest(request, "decline")} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">Decline</button>
                  <button onClick={() => reviewAddonRequest(request, "approve")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Activate</button>
                </div>
              </div>
            ))}
            {addonRequests.filter((request) => request.status === "PENDING").length === 0 && (
              <p className="px-5 py-5 text-sm text-slate-500">
                No pending Production &amp; Job Work activation requests. Use Refresh to check for new requests.
              </p>
            )}
          </div>
        </section>
      )}

      {(
        <section className="overflow-hidden rounded-xl border border-cyan-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100 bg-cyan-50 px-5 py-4">
            <div><h3 className="flex items-center gap-2 font-black text-cyan-950"><Truck className="h-4 w-4" /> Logistics add-on requests</h3><p className="mt-0.5 text-xs text-cyan-700">Pure opt-in, independent of plan tier — not every retailer needs shipment/transfer tracking.</p></div>
            <button onClick={fetchLogisticsAddonRequests} disabled={logisticsAddonLoading} className="rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100">{logisticsAddonLoading ? "Refreshing…" : "Refresh"}</button>
          </div>
          <div className="divide-y divide-slate-100">
            {logisticsAddonRequests.filter((request) => request.status === "PENDING").map((request) => (
              <div key={request.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-[260px] flex-1">
                  <p className="font-bold text-slate-900">{request.company_name} <span className="font-normal text-slate-400">· {request.tenant_id}</span></p>
                  <p className="mt-1 text-xs text-slate-600">Requested by: {request.requested_by_name} · {request.requested_by_email}</p>
                  {request.note && <p className="mt-1 text-xs italic text-slate-500">“{request.note}”</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => reviewLogisticsAddonRequest(request, "decline")} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">Decline</button>
                  <button onClick={() => reviewLogisticsAddonRequest(request, "approve")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Activate</button>
                </div>
              </div>
            ))}
            {logisticsAddonRequests.filter((request) => request.status === "PENDING").length === 0 && (
              <p className="px-5 py-5 text-sm text-slate-500">
                No pending Logistics activation requests. Use Refresh to check for new requests.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["Retailer","Tenant ID","Plan","Stores","Admins","Status","KYB","Actions"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={8} className="py-14 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin"/> Loading retailers…
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-14 text-center text-slate-400 text-sm">
                  {search ? "No retailers match your search." : "No retailers yet. Click \"Add Retailer\" to onboard the first one."}
                </td></tr>
              ) : filtered.map(t => {
                const plan      = PLAN_CFG[t.plan]    || PLAN_CFG.basic;
                const statusCfg = STATUS_CFG[t.status] || STATUS_CFG.active;
                const kybCfg    = KYB_STATUS_CFG[t.kyb_status] || KYB_STATUS_CFG["Not started"];
                const KybIcon   = kybCfg.icon;
                const expanded  = expandedId === t.tenant_id;
                return (
                  <React.Fragment key={t.tenant_id}>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      {/* Retailer */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-sm shrink-0">
                            {t.company_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{t.company_name}</p>
                            <p className="text-xs text-slate-400">{t.city || t.gstin || "—"}</p>
                          </div>
                        </div>
                      </td>
                      {/* Tenant ID */}
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">{t.tenant_id}</span>
                      </td>
                      {/* Plan */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${plan.bg} ${plan.text} ${plan.border}`}>
                          {plan.icon} {plan.label}
                        </span>
                      </td>
                      {/* Stores */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-800">{t.store_count}</span>
                          <span className="text-slate-400 text-xs">/ {t.store_limit === 999 ? "∞" : t.store_limit}</span>
                        </div>
                      </td>
                      {/* Admins */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-800">{t.admin_count}</span>
                          <span className="text-slate-400 text-xs">/ {t.admin_limit === 999 ? "∞" : t.admin_limit}</span>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}/>
                          {t.status}
                        </span>
                      </td>
                      {/* KYB */}
                      <td className="px-5 py-4">
                        <button onClick={() => setKybTenant(t)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition hover:opacity-80 ${kybCfg.bg} ${kybCfg.text} ${kybCfg.border}`}>
                          <KybIcon className="w-3.5 h-3.5" /> {t.kyb_status || "Not started"}
                        </button>
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setExpandedId(expanded ? null : t.tenant_id)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition" title="View details">
                            {expanded ? <ChevronUp className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                          </button>
                          {t.plan !== "internal_free_enterprise" && <button onClick={() => handleGrantInternalFree(t)}
                            className="p-1.5 rounded-lg text-emerald-600 transition hover:bg-emerald-50" title="Grant internal free Enterprise plan">
                            <Gift className="w-4 h-4"/>
                          </button>}
                          <button onClick={() => handleToggleJobWorkAddon(t)}
                            className={`p-1.5 rounded-lg transition ${t.production_job_work_enabled ? "text-violet-600 hover:bg-violet-50" : "text-slate-400 hover:bg-slate-100"}`}
                            title={t.production_job_work_enabled ? "Production & Job Work add-on: ON — click to deactivate" : "Production & Job Work add-on: OFF — click to activate"}>
                            <Factory className="w-4 h-4"/>
                          </button>
                          <button onClick={() => handleToggleLogisticsAddon(t)}
                            className={`p-1.5 rounded-lg transition ${t.logistics_enabled ? "text-cyan-600 hover:bg-cyan-50" : "text-slate-400 hover:bg-slate-100"}`}
                            title={t.logistics_enabled ? "Logistics add-on: ON — click to deactivate" : "Logistics add-on: OFF — click to activate"}>
                            <Truck className="w-4 h-4"/>
                          </button>
                          <button onClick={() => handleSuspend(t)}
                            className={`p-1.5 rounded-lg transition ${t.status === "active" ? "hover:bg-amber-50 text-amber-500" : "hover:bg-emerald-50 text-emerald-500"}`}
                            title={t.status === "active" ? "Suspend" : "Activate"}>
                            {t.status === "active" ? <XCircle className="w-4 h-4"/> : <CheckCircle className="w-4 h-4"/>}
                          </button>
                          <button onClick={() => handleDelete(t)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition" title="Delete">
                            <Trash2 className="w-4 h-4"/>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded detail row */}
                    {expanded && (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <RetailerDetail tenant={t} onClose={() => setExpandedId(null)} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <AddRetailerModal
          onboardingRequest={pendingOnboarding}
          onClose={() => { setShowAdd(false); onConsumeOnboarding?.(); }}
          onCreated={() => { fetchTenants(); onConsumeOnboarding?.(); }}
        />
      )}

      {kybTenant && (
        <KybReviewModal tenant={kybTenant} onClose={() => setKybTenant(null)} onReviewed={fetchTenants} />
      )}
    </div>
  );
}
