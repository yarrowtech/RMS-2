import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import React, { useEffect, useState, useCallback } from "react";
import {
  Building2, Plus, Search, Eye, Pencil, Trash2, X,
  CheckCircle, XCircle, AlertCircle, Store, Users,
  Crown, Zap, Rocket, ChevronDown, ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";

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
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
};

const PLAN_CFG = {
  starter:      { label: "Starter",      icon: <Zap className="w-3 h-3"/>,    bg: "bg-slate-100",   text: "text-slate-700",  border: "border-slate-200"  },
  professional: { label: "Professional", icon: <Rocket className="w-3 h-3"/>, bg: "bg-blue-50",     text: "text-blue-700",   border: "border-blue-200"   },
  enterprise:   { label: "Enterprise",   icon: <Crown className="w-3 h-3"/>,  bg: "bg-amber-50",    text: "text-amber-700",  border: "border-amber-200"  },
};

const STATUS_CFG = {
  active:    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  suspended: { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    dot: "bg-rose-500"    },
};

const INP = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition bg-white";
const LBL = "block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5";

// ── EMPTY FORMS ────────────────────────────────────────────────────────────────
const EMPTY_TENANT = {
  account_type:    "department_retailer",
  company_name:    "",
  tenant_id:       "",
  gstin:           "",
  plan:            "starter",
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
function AddRetailerModal({ onClose, onCreated }) {
  const [form,   setForm]   = useState(EMPTY_TENANT);
  const [saving, setSaving] = useState(false);
  const [step,   setStep]   = useState(1); // 1 = retailer info, 2 = hq admin

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
    if (!form.tenant_id.trim())    { toast.error("Tenant ID is required"); return; }
    if (!form.hq_admin_name.trim()){ toast.error("Primary admin name is required"); return; }
    if (!form.hq_admin_email.trim()){ toast.error("Primary admin email is required"); return; }

    try {
      setSaving(true);
      const data = await apiFetch("/superadmin/tenants/", {
        method: "POST", body: JSON.stringify(form),
      });
      toast.success(`✅ ${form.company_name} is now live on RMS!`);
      onCreated(data);
      onClose();
    } catch (e) { toast.error(e.message); }
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
                    <button key={key} type="button" onClick={() => setForm(p => ({ ...p, account_type: key, plan: key === "single_store" ? "starter" : p.plan }))}
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
                        onClick={() => setForm(p => ({ ...p, plan: key }))}
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
                  <span>🏪 {form.plan === "enterprise" ? "Unlimited" : form.plan === "professional" ? "5" : "1"} Store{form.plan !== "starter" ? "s" : ""}</span>
                  <span>👤 {form.plan === "enterprise" ? "Unlimited" : form.plan === "professional" ? "15" : "3"} Admins</span>
                  <span>✅ Full RMS Access</span>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>This creates the <b>{form.account_type === "single_store" ? "Store Owner" : "HQ Admin"} account</b> for <b>{form.company_name || "this retailer"}</b>. They will receive a setup email to set their password.</span>
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
        </div>
      ) : <p className="text-xs text-slate-400">Failed to load details</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN — RetailersTab
// ══════════════════════════════════════════════════════════════════════════════
export default function RetailersTab() {
  const [tenants,    setTenants]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState("");
  const [showAdd,    setShowAdd]    = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [upgradeRequests, setUpgradeRequests] = useState([]);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeDepartmentCatalog, setUpgradeDepartmentCatalog] = useState([]);
  const [deptSelections, setDeptSelections] = useState({});

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

  useEffect(() => { fetchTenants(); fetchUpgradeRequests(); fetchUpgradeDepartmentCatalog(); }, [fetchTenants, fetchUpgradeRequests, fetchUpgradeDepartmentCatalog]);

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

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["Retailer","Tenant ID","Plan","Stores","Admins","Status","Actions"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="py-14 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin"/> Loading retailers…
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-14 text-center text-slate-400 text-sm">
                  {search ? "No retailers match your search." : "No retailers yet. Click \"Add Retailer\" to onboard the first one."}
                </td></tr>
              ) : filtered.map(t => {
                const plan      = PLAN_CFG[t.plan]    || PLAN_CFG.starter;
                const statusCfg = STATUS_CFG[t.status] || STATUS_CFG.active;
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
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setExpandedId(expanded ? null : t.tenant_id)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition" title="View details">
                            {expanded ? <ChevronUp className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
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
                        <td colSpan={7} className="p-0">
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
          onClose={() => setShowAdd(false)}
          onCreated={() => fetchTenants()}
        />
      )}
    </div>
  );
}
