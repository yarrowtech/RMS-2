import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, ShieldAlert, ShieldCheck, Upload } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

// Shared between Admin/AdminSettings.jsx (HQ admin's Settings > Verification
// tab) and StoreOwner/StoreOwnerVerification.jsx (a single-store owner's own
// page for the same thing — their admin's JWT scope is "hq" too, so these
// /hq/kyb endpoints already work for them; they just had no route in the
// app that could reach this form before).

const token = () => localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
const jsonHeaders = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

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
const Label = ({ children, ...props }) => <label className="block text-xs font-bold text-slate-600">{children}<input {...props} className={input} /></label>;
const SelectLabel = ({ children, options, ...props }) => <label className="block text-xs font-bold text-slate-600">{children}<select {...props} className={input}>{options.map((o) => <option key={o || "_empty"} value={o}>{o || "Select..."}</option>)}</select></label>;

const BUSINESS_ENTITY_TYPES = ["", "Sole Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited", "Other"];

const emptyKyb = {
  legal_name: "",
  business_address: "",
  business_entity_type: "",
  pan: "",
  gstin: "",
  aadhar_number: "",
  aadhar_last4: "",
  aadhar_document_url: "",
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

export default function RetailerVerification({ onSaved }) {
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
      const field = type === "gst_certificate" ? "gst_certificate_url" : type === "pan_document" ? "pan_document_url" : type === "aadhar_document" ? "aadhar_document_url" : "cancelled_cheque_url";
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
      onSaved?.(res.message || "Business verification submitted for review.");
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
      {readOnly && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{kyb?.status === "Verified" ? "This retailer tenant is verified." : "Submitted — waiting for SuperAdmin review. Details are locked until review is completed."}</div>}

      <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm leading-6 text-slate-700">
        <p className="font-black text-indigo-900">What to add</p>
        <p>Use registered business name/address, PAN, GSTIN, GST certificate and PAN document. Bank details and cancelled cheque are optional now, useful later for payouts/refunds/reconciliation.</p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Label value={form.legal_name || ""} disabled={readOnly} onChange={e => setField("legal_name", e.target.value)}>Legal business name *</Label>
        <SelectLabel value={form.business_entity_type || ""} disabled={readOnly} options={BUSINESS_ENTITY_TYPES} onChange={e => setField("business_entity_type", e.target.value)}>Business entity type *</SelectLabel>
        <Label value={form.gstin || ""} disabled={readOnly} maxLength={15} onChange={e => setField("gstin", e.target.value.toUpperCase())}>GSTIN *</Label>
        <Label value={form.pan || ""} disabled={readOnly} maxLength={10} onChange={e => setField("pan", e.target.value.toUpperCase())}>PAN *</Label>
        <Label value={form.ifsc || ""} disabled={readOnly} onChange={e => setField("ifsc", e.target.value.toUpperCase())}>IFSC optional</Label>
        <Label value={form.bank_account_holder || ""} disabled={readOnly} onChange={e => setField("bank_account_holder", e.target.value)}>Bank account holder optional</Label>
        <Label value={form.bank_name || ""} disabled={readOnly} onChange={e => setField("bank_name", e.target.value)}>Bank name optional</Label>
        <Label value={form.account_number || ""} disabled={readOnly} onChange={e => setField("account_number", e.target.value)}>Account number optional {form.account_last4 ? `(saved ****${form.account_last4})` : ""}</Label>
        {form.business_entity_type === "Sole Proprietorship" && (
          <Label value={form.aadhar_number || ""} disabled={readOnly} maxLength={12} onChange={e => setField("aadhar_number", e.target.value.replace(/\D/g, ""))}>Proprietor's Aadhaar number * {form.aadhar_last4 ? `(saved ****${form.aadhar_last4})` : ""}</Label>
        )}
        <label className="block text-xs font-bold text-slate-600 sm:col-span-2">Business address *<textarea value={form.business_address || ""} disabled={readOnly} onChange={e => setField("business_address", e.target.value)} className={`${input} min-h-24`} /></label>
      </div>

      {form.business_entity_type === "Sole Proprietorship" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">A Sole Proprietorship has no separate legal entity from you as an individual — Aadhaar is required to identify the business, alongside PAN and GST.</div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <DocumentUpload label="GST certificate *" type="gst_certificate" url={form.gst_certificate_url} disabled={readOnly} uploading={uploading} onUpload={uploadDoc} />
        <DocumentUpload label="PAN document *" type="pan_document" url={form.pan_document_url} disabled={readOnly} uploading={uploading} onUpload={uploadDoc} />
        <DocumentUpload label="Cancelled cheque optional" type="cancelled_cheque" url={form.cancelled_cheque_url} disabled={readOnly} uploading={uploading} onUpload={uploadDoc} />
        {form.business_entity_type === "Sole Proprietorship" && (
          <DocumentUpload label="Proprietor's Aadhaar *" type="aadhar_document" url={form.aadhar_document_url} disabled={readOnly} uploading={uploading} onUpload={uploadDoc} />
        )}
      </div>

      {!readOnly && <button disabled={saving || Boolean(uploading)} onClick={submit} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"><ShieldAlert className="h-4 w-4" />{saving ? "Submitting..." : "Submit verification"}</button>}
    </section>
  );
}
