import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck, Building2, ChevronRight, CircleAlert, Clock3, FileText,
  LoaderCircle, RefreshCw, Search, ShieldCheck, UsersRound, X,
} from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || localStorage.getItem("adminToken") || sessionStorage.getItem("access_token") || sessionStorage.getItem("token");
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

const statusStyle = (status) => {
  const value = String(status || "Not started").toLowerCase();
  if (value === "verified" || value === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value.includes("change")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "submitted") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
};

const formatDate = (value) => value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "Not submitted";

function StatusPill({ status }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyle(status)}`}>{status || "Not started"}</span>;
}

function Metric({ label, value, icon: Icon, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{value}</p></div>
        <div className={`rounded-xl p-2.5 ${tone}`}><Icon size={19} /></div>
      </div>
    </div>
  );
}

export default function HqVendorOverview() {
  const [approved, setApproved] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [review, setReview] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Keep the fetch parsing explicit: a response body can only be read once.
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [approvedRes, pendingRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/vendors/approved`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/api/vendors/pending`, { headers: authHeaders() }),
      ]);
      const [approvedData, pendingData] = await Promise.all([approvedRes.json(), pendingRes.json()]);
      if (!approvedRes.ok || !pendingRes.ok) throw new Error(approvedData?.detail || pendingData?.detail || "Vendor relationships could not be loaded.");
      setApproved(Array.isArray(approvedData) ? approvedData : []);
      setPending(Array.isArray(pendingData) ? pendingData : []);
    } catch (err) {
      setApproved([]); setPending([]); setError(err.message || "Vendor relationships could not be loaded.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const vendors = useMemo(() => [
    ...approved.map((vendor) => ({ ...vendor, relationshipStatus: "Approved" })),
    ...pending.map((vendor) => ({ ...vendor, relationshipStatus: "Pending" })),
  ], [approved, pending]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return vendors;
    return vendors.filter((vendor) => [vendor.name, vendor.vendor_name, vendor.brandName, vendor.email, vendor.vendor_code, vendor.gstin].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [vendors, query]);

  const verified = approved.filter((vendor) => vendor.kyb_status === "Verified").length;
  const awaitingKyb = approved.filter((vendor) => vendor.kyb_status !== "Verified").length;

  async function openReview(vendor) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/vendors/kyb/${vendor._id}`, { headers: authHeaders() });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Could not load vendor KYB.");
      setReview({ linkId: vendor._id, relationshipStatus: vendor.relationshipStatus, ...payload.data });
      setReviewNote(payload.data?.note || "");
    } catch (err) { setError(err.message || "Could not load vendor KYB."); }
  }

  async function saveReview(status) {
    if (!review) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vendors/kyb/${review.linkId}/review`, {
        method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status, note: reviewNote }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Could not save the KYB review.");
      setReview(null); await refresh();
    } catch (err) { setError(err.message || "Could not save the KYB review."); }
    finally { setSaving(false); }
  }

  return (
    <section className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <div className="rounded-3xl border border-teal-100 bg-gradient-to-br from-white via-cyan-50/40 to-teal-50 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex gap-3"><div className="rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-600 p-3 text-white shadow-lg shadow-teal-200"><UsersRound size={25} /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">HQ control</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Vendor Overview</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Only vendors connected to your retailer are shown. Review their KYB before enabling normal trade and payment operations.</p></div></div>
          <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-bold text-teal-800 shadow-sm transition hover:bg-teal-50 disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Connected vendors" value={vendors.length} icon={Building2} tone="bg-cyan-100 text-cyan-700" />
        <Metric label="Approved to trade" value={approved.length} icon={BadgeCheck} tone="bg-emerald-100 text-emerald-700" />
        <Metric label="KYB verified" value={verified} icon={ShieldCheck} tone="bg-teal-100 text-teal-700" />
        <Metric label="KYB action needed" value={awaitingKyb} icon={CircleAlert} tone="bg-amber-100 text-amber-700" />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black text-slate-900">Vendor relationships</h3><p className="mt-1 text-xs text-slate-500">KYB is reviewed separately for each retailer relationship.</p></div><label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:w-72"><Search size={16} className="text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Search vendor, code or GSTIN" /></label></div>
        {error && <div className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
        <div className="overflow-x-auto"><table className="min-w-[780px] w-full text-left"><thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Vendor</th><th className="px-4 py-3">Relationship</th><th className="px-4 py-3">KYB status</th><th className="px-4 py-3">Trading access</th><th className="px-4 py-3 text-right">Details</th></tr></thead><tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan="5" className="px-5 py-12 text-center text-sm text-slate-500"><LoaderCircle className="mx-auto mb-2 animate-spin text-teal-600" size={24} />Loading vendor relationships…</td></tr> : visible.length === 0 ? <tr><td colSpan="5" className="px-5 py-12 text-center text-sm text-slate-500">No vendors match this view.</td></tr> : visible.map((vendor) => { const tradeReady = vendor.relationshipStatus === "Approved" && vendor.kyb_status === "Verified"; return <tr key={vendor._id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-bold text-slate-900">{vendor.brandName || vendor.name || vendor.vendor_name || "Vendor"}</p><p className="mt-0.5 text-xs text-slate-500">{vendor.email || "No email"}{vendor.vendor_code ? ` · ${vendor.vendor_code}` : ""}</p></td><td className="px-4 py-4"><StatusPill status={vendor.relationshipStatus} /></td><td className="px-4 py-4"><StatusPill status={vendor.kyb_status || "Not started"} /></td><td className="px-4 py-4"><span className={`text-sm font-bold ${tradeReady ? "text-emerald-700" : "text-amber-700"}`}>{tradeReady ? "Ready" : "Limited until KYB"}</span></td><td className="px-4 py-4 text-right"><button type="button" onClick={() => openReview(vendor)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-bold text-teal-700 transition hover:bg-teal-50">View KYB <ChevronRight size={16} /></button></td></tr>; })}
        </tbody></table></div>
      </div>

      {review && <div className="fixed inset-0 z-[1200] flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-5"><div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"><div className="sticky top-0 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4"><div><p className="text-xs font-black uppercase tracking-wider text-teal-700">Tenant-scoped KYB</p><h3 className="mt-1 text-xl font-black text-slate-900">{review.vendor?.name || "Vendor"}</h3><p className="mt-1 text-sm text-slate-500">{review.vendor?.email || ""}</p></div><button type="button" onClick={() => setReview(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button></div><div className="space-y-5 p-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Relationship</p><div className="mt-2"><StatusPill status={review.relationshipStatus} /></div></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">KYB status</p><div className="mt-2"><StatusPill status={review.status} /></div></div></div><div className="grid gap-3 text-sm sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Legal business</p><p className="mt-1 font-semibold text-slate-800">{review.kyb?.legal_name || "Not provided"}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">PAN / GSTIN</p><p className="mt-1 font-semibold text-slate-800">{review.vendor?.pan || "PAN not provided"} · {review.vendor?.gstin || "GSTIN not provided"}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Bank account</p><p className="mt-1 font-semibold text-slate-800">{review.kyb?.bank_name || "Bank not provided"}{review.kyb?.account_last4 ? ` · •••• ${review.kyb.account_last4}` : ""}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Submitted</p><p className="mt-1 font-semibold text-slate-800">{formatDate(review.kyb?.submitted_at)}</p></div></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Business address</p><p className="mt-1 text-sm leading-6 text-slate-700">{review.kyb?.business_address || "Not provided"}</p></div><div className="rounded-xl border border-slate-200 p-3"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Uploaded documents</p><div className="flex flex-wrap gap-2">{[["GST certificate", review.kyb?.gst_certificate_url], ["PAN document", review.kyb?.pan_document_url], ["Cancelled cheque", review.kyb?.cancelled_cheque_url]].filter(([, url]) => url).map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100"><FileText size={14} /> {label}</a>)}{![review.kyb?.gst_certificate_url, review.kyb?.pan_document_url, review.kyb?.cancelled_cheque_url].some(Boolean) && <span className="text-sm text-slate-500">No document links submitted.</span>}</div></div>{review.relationshipStatus === "Approved" && <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4"><div className="flex items-center gap-2"><Clock3 size={17} className="text-teal-700" /><p className="font-bold text-slate-900">KYB review</p></div><textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-teal-500" placeholder="Optional note for this vendor" /><div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={() => saveReview("Needs changes")} className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-700 disabled:opacity-60">Request changes</button><button type="button" disabled={saving} onClick={() => saveReview("Verified")} className="rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-200 disabled:opacity-60">{saving ? "Saving…" : "Verify KYB"}</button></div></div>}</div></div></div>}
    </section>
  );
}