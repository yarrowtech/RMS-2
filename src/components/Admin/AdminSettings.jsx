import React, { useCallback, useEffect, useState } from "react";
import { Building2, ExternalLink, KeyRound, Loader2, Save, ShieldAlert, ShieldCheck, Upload, UserRound } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

const token = () => localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
const jsonHeaders = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

const api = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}/admin/settings${path}`, {
    ...options,
    headers: { ...jsonHeaders(), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Could not save settings.");
  return body;
};

const hqApi = async (path, options = {}) => {
  const isForm = options.body instanceof FormData;
  const headers = isForm
    ? { Authorization: `Bearer ${token()}`, ...(options.headers || {}) }
    : { ...jsonHeaders(), ...(options.headers || {}) };
  const response = await fetch(`${API_BASE_URL}/hq${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Could not load business verification.");
  return body;
};

const input = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500";
const Label = ({ children, ...props }) => <label className="block text-xs font-bold text-slate-600">{children}<input {...props} className={input}/></label>;

const emptyKyb = {
  legal_name: "",
  business_address: "",
  pan: "",
  gstin: "",
  gst_certificate_url: "",
  pan_document_url: "",
  cancelled_cheque_url: "",
  bank_account_holder: "",
  bank_name: "",
  account_number: "",
  account_last4: "",
  ifsc: "",
};

function StatusBadge({ status }) {
  const cfg = status === "Verified"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "Submitted"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : status === "Rejected"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${cfg}`}>{status || "Not started"}</span>;
}

function DocumentUpload({ label, type, url, disabled, uploading, onUpload }) {
  return (
    <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">JPG, PNG, WEBP or PDF up to 10 MB. A secure link is saved after upload.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!disabled && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-extrabold text-indigo-700 hover:bg-indigo-50">
            <Upload className="h-3.5 w-3.5" /> {uploading === type ? "Uploading..." : url ? "Replace file" : "Upload file"}
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" disabled={Boolean(uploading)} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(type, file); event.target.value = ""; }} />
          </label>
        )}
        {url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"><ExternalLink className="h-3.5 w-3.5" /> Preview</a> : <span className="text-xs font-semibold text-slate-400">No file uploaded</span>}
      </div>
    </div>
  );
}

function RetailerVerification({ onSaved }) {
  const [kyb, setKyb] = useState(null);
  const [form, setForm] = useState(emptyKyb);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const res = await hqApi("/kyb");
      const data = res.data || {};
      setKyb(data);
      setForm({ ...emptyKyb, ...data, account_number: "" });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const readOnly = kyb?.status === "Submitted" || kyb?.status === "Verified";

  const uploadDoc = async (type, file) => {
    setUploading(type);
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await hqApi(`/kyb/documents/${type}`, { method: "POST", body });
      const field = type === "gst_certificate" ? "gst_certificate_url" : type === "pan_document" ? "pan_document_url" : "cancelled_cheque_url";
      setForm((prev) => ({ ...prev, [field]: result.url }));
    } catch (e) {
      setError(e.message || "Upload failed.");
    } finally {
      setUploading("");
    }
  };

  const submit = async () => {
    try {
      setSaving(true);
      setError("");
      const payload = {
        ...form,
        pan: String(form.pan || "").toUpperCase(),
        gstin: String(form.gstin || "").toUpperCase(),
        ifsc: String(form.ifsc || "").toUpperCase(),
      };
      const res = await hqApi("/kyb", { method: "PATCH", body: JSON.stringify(payload) });
      onSaved(res.message || "Business verification submitted for review.");
      await load();
    } catch (e) {
      setError(e.message || "Could not submit verification.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-indigo-600" />Loading business verification...</section>;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h2 className="font-black text-slate-900">Retailer business verification</h2></div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">For Basic/single-store and multi-store retailers. Submit GST/PAN proof once at tenant level so vendors and RMS can trust the retailer business.</p>
        </div>
        <StatusBadge status={kyb?.status} />
      </div>

      {kyb?.note && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Review note: {kyb.note}</div>}
      {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
      {readOnly && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{kyb?.status === "Verified" ? "This retailer tenant is verified." : "Submitted ? waiting for SuperAdmin review. Details are locked until review is completed."}</div>}

      <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm leading-6 text-slate-700">
        <p className="font-black text-indigo-900">What to add</p>
        <p>Use registered business name/address, PAN, GSTIN, GST certificate and PAN document. Bank details and cancelled cheque are optional now, useful later for payouts/refunds/reconciliation.</p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Label value={form.legal_name || ""} disabled={readOnly} onChange={e => setField("legal_name", e.target.value)}>Legal business name *</Label>
        <Label value={form.gstin || ""} disabled={readOnly} maxLength={15} onChange={e => setField("gstin", e.target.value.toUpperCase())}>GSTIN *</Label>
        <Label value={form.pan || ""} disabled={readOnly} maxLength={10} onChange={e => setField("pan", e.target.value.toUpperCase())}>PAN *</Label>
        <Label value={form.ifsc || ""} disabled={readOnly} onChange={e => setField("ifsc", e.target.value.toUpperCase())}>IFSC optional</Label>
        <Label value={form.bank_account_holder || ""} disabled={readOnly} onChange={e => setField("bank_account_holder", e.target.value)}>Bank account holder optional</Label>
        <Label value={form.bank_name || ""} disabled={readOnly} onChange={e => setField("bank_name", e.target.value)}>Bank name optional</Label>
        <Label value={form.account_number || ""} disabled={readOnly} onChange={e => setField("account_number", e.target.value)}>Account number optional {form.account_last4 ? `(saved ****${form.account_last4})` : ""}</Label>
        <label className="block text-xs font-bold text-slate-600 sm:col-span-2">Business address *<textarea value={form.business_address || ""} disabled={readOnly} onChange={e => setField("business_address", e.target.value)} className={`${input} min-h-24`} /></label>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <DocumentUpload label="GST certificate *" type="gst_certificate" url={form.gst_certificate_url} disabled={readOnly} uploading={uploading} onUpload={uploadDoc} />
        <DocumentUpload label="PAN document *" type="pan_document" url={form.pan_document_url} disabled={readOnly} uploading={uploading} onUpload={uploadDoc} />
        <DocumentUpload label="Cancelled cheque optional" type="cancelled_cheque" url={form.cancelled_cheque_url} disabled={readOnly} uploading={uploading} onUpload={uploadDoc} />
      </div>

      {!readOnly && <button disabled={saving || Boolean(uploading)} onClick={submit} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"><ShieldAlert className="h-4 w-4" />{saving ? "Submitting..." : "Submit verification"}</button>}
    </section>
  );
}

export default function AdminSettings() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("account");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState({});
  const [organisation, setOrganisation] = useState({});
  const [password, setPassword] = useState({ current_password: "", new_password: "", confirm: "" });

  const load = useCallback(async () => {
    try {
      setError("");
      const next = await api("");
      setData(next);
      setProfile(next.profile || {});
      setOrganisation(next.organisation || {});
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveProfile = async () => { try { setBusy(true); setError(""); const response = await api("/profile", { method: "PATCH", body: JSON.stringify(profile) }); setMessage(response.message); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const savePassword = async () => { if (password.new_password !== password.confirm) return setError("New password and confirmation do not match."); try { setBusy(true); setError(""); const response = await api("/password", { method: "PATCH", body: JSON.stringify({ current_password: password.current_password, new_password: password.new_password }) }); setMessage(response.message); setPassword({ current_password: "", new_password: "", confirm: "" }); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const saveOrganisation = async () => { try { setBusy(true); setError(""); const response = await api("/organisation", { method: "PUT", body: JSON.stringify(organisation) }); setMessage(response.message); setOrganisation(response.organisation || organisation); } catch (e) { setError(e.message); } finally { setBusy(false); } };

  if (!data && !error) return <div className="grid min-h-[360px] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-indigo-600"/></div>;
  const access = data?.access || {};
  const canManageOrg = Boolean(data?.can_manage_organisation);
  const tabs = [["account", UserRound, "My account"], ["access", ShieldCheck, "Access"], ["security", KeyRound, "Security"], ...(canManageOrg ? [["organisation", Building2, "Organisation"], ["verification", ShieldCheck, "Verification"]] : [])];

  return <div className="min-h-full bg-slate-50 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-5xl space-y-5">
    <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-800 p-6 text-white shadow-xl"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-indigo-200">Role-aware configuration</p><h1 className="mt-2 text-2xl font-black">Settings</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-100">Your account settings are private. Organisation and verification settings apply to this retailer tenant, including Basic single-store tenants.</p></section>
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{tabs.map(([key, Icon, label]) => <button key={key} onClick={() => setTab(key)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${tab === key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Icon className="h-4 w-4"/>{label}</button>)}</div>
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div>}{error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}

    {tab === "account" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><UserRound className="h-5 w-5 text-indigo-600"/><div><h2 className="font-black text-slate-900">My profile and notifications</h2><p className="text-sm text-slate-500">These details identify you in RMS records and notifications.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Label value={profile.name || ""} onChange={e => setProfile({ ...profile, name: e.target.value })}>Full name</Label><Label value={profile.email || ""} disabled>Email</Label><Label value={profile.phone || ""} onChange={e => setProfile({ ...profile, phone: e.target.value })}>Phone</Label><Label value={profile.city || ""} onChange={e => setProfile({ ...profile, city: e.target.value })}>City</Label></div><div className="mt-5 flex flex-wrap gap-4"><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={Boolean(profile.notification_email)} onChange={e => setProfile({ ...profile, notification_email: e.target.checked })}/> Email notifications</label><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={Boolean(profile.notification_whatsapp)} onChange={e => setProfile({ ...profile, notification_whatsapp: e.target.checked })}/> WhatsApp notifications</label></div><button disabled={busy} onClick={saveProfile} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"><Save className="h-4 w-4"/>Save profile</button></section>}
    {tab === "access" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-900">Your assigned access</h2><p className="mt-1 text-sm text-slate-500">Only an HQ admin can change department assignments and permissions.</p><div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-indigo-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-indigo-500">Scope</p><p className="mt-1 font-black text-indigo-950">{access.scope === "hq" ? "HQ admin" : `Store admin${access.store_name ? ` ? ${access.store_name}` : ""}`}</p></div><div className="rounded-xl bg-slate-50 p-4 sm:col-span-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Departments</p><div className="mt-2 flex flex-wrap gap-2">{(access.managed_departments || [access.department]).map(value => <span key={value} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{value}</span>)}</div></div></div><div className="mt-4 rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Permissions</p><div className="mt-2 flex flex-wrap gap-2">{(access.permissions || []).length ? access.permissions.map(value => <span key={value} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{value}</span>) : <span className="text-sm text-slate-500">Standard department access</span>}</div></div></section>}
    {tab === "security" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-900">Change password</h2><p className="mt-1 text-sm text-slate-500">Use at least 8 characters. Your current password is required.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Label type="password" value={password.current_password} onChange={e => setPassword({ ...password, current_password: e.target.value })}>Current password</Label><div className="hidden sm:block"/><Label type="password" value={password.new_password} onChange={e => setPassword({ ...password, new_password: e.target.value })}>New password</Label><Label type="password" value={password.confirm} onChange={e => setPassword({ ...password, confirm: e.target.value })}>Confirm new password</Label></div><button disabled={busy} onClick={savePassword} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"><KeyRound className="h-4 w-4"/>Update password</button></section>}
    {tab === "organisation" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-900">Organisation and document settings</h2><p className="mt-1 text-sm text-slate-500">HQ-only. Controls tenant identity and default document labels; existing document numbers are not changed.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Label value={organisation.legal_name || ""} onChange={e => setOrganisation({ ...organisation, legal_name: e.target.value })}>Legal business name</Label><Label value={organisation.gstin || ""} onChange={e => setOrganisation({ ...organisation, gstin: e.target.value })}>GSTIN</Label><Label value={organisation.currency || "INR"} onChange={e => setOrganisation({ ...organisation, currency: e.target.value.toUpperCase() })}>Currency</Label><Label value={organisation.timezone || "Asia/Kolkata"} onChange={e => setOrganisation({ ...organisation, timezone: e.target.value })}>Timezone</Label><Label type="number" value={organisation.financial_year_start_month || 4} onChange={e => setOrganisation({ ...organisation, financial_year_start_month: Number(e.target.value) })}>Financial year starts (month 1-12)</Label><Label value={organisation.po_prefix || "PO"} onChange={e => setOrganisation({ ...organisation, po_prefix: e.target.value })}>PO prefix</Label><Label value={organisation.grn_prefix || "GRN"} onChange={e => setOrganisation({ ...organisation, grn_prefix: e.target.value })}>GRN prefix</Label><Label value={organisation.invoice_prefix || "PI"} onChange={e => setOrganisation({ ...organisation, invoice_prefix: e.target.value })}>Purchase invoice prefix</Label></div><label className="mt-4 block text-xs font-bold text-slate-600">Business address<textarea value={organisation.address || ""} onChange={e => setOrganisation({ ...organisation, address: e.target.value })} className={`${input} min-h-24`} /></label><button disabled={busy} onClick={saveOrganisation} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"><Building2 className="h-4 w-4"/>Save organisation settings</button></section>}
    {tab === "verification" && <RetailerVerification onSaved={setMessage} />}
  </div></div>;
}
