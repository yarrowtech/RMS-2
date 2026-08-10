import React, { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/api.js";
import {
  BellRing, Building2, CheckCircle2, ChevronRight, Globe2, Loader2,
  MapPin, MessageCircle, PackageCheck, RefreshCw, Save, Settings2,
  ShieldCheck, ShoppingCart, Smartphone, Truck, Upload, ExternalLink, X,
} from "lucide-react";

const DEFAULT_NOTIFICATIONS = {
  purchase_orders: true,
  rfqs_and_messages: true,
  supplier_returns: true,
  email_alerts: true,
  whatsapp_alerts: false,
};

const DEFAULT_ORDER_PREFERENCES = {
  default_lead_time_days: 7,
  minimum_order_quantity: 1,
  default_payment_terms: "",
  return_policy: "",
};

function vendorToken() {
  return localStorage.getItem("vendor_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

function Field({ label, value, onChange, placeholder = "", type = "text", hint, readOnly = false }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">{label}</span><input type={type} value={value ?? ""} readOnly={readOnly} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} className={`h-11 w-full rounded-xl border px-3 text-sm outline-none transition ${readOnly ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500" : "border-slate-200 bg-white text-slate-800 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"}`} />{hint && <span className="mt-1.5 block text-[11px] leading-4 text-slate-400">{hint}</span>}</label>;
}

function KybDocumentField({ label, documentType, url, uploading, onUpload, onClear }) {
  return <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/40 p-3.5"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">Upload JPG, PNG, WEBP or PDF up to 10 MB.</p><div className="mt-3 flex flex-wrap items-center gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-teal-200 bg-white px-3 py-2 text-xs font-extrabold text-teal-700 transition hover:bg-teal-50"><Upload className="h-3.5 w-3.5" />{uploading ? "Uploading…" : url ? "Replace file" : "Upload file"}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(documentType, file); event.target.value = ""; }} /></label>{url && <><a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100"><ExternalLink className="h-3.5 w-3.5" /> Preview</a><button type="button" onClick={onClear} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${label}`}><X className="h-4 w-4" /></button></>}</div></div>;
}
function Toggle({ checked, onChange, title, text, disabled = false }) {
  return <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3.5"><div><p className="text-sm font-bold text-slate-800">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div><button type="button" disabled={disabled} onClick={() => onChange(!checked)} aria-pressed={checked} className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-teal-600" : "bg-slate-300"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} /></button></div>;
}

function TaxProfileGuide() {
  const steps = [
    ["1", "Why we ask", "PAN and GST identify your business on commercial documents — invoices and purchase orders — you exchange with retailers on RMS."],
    ["2", "Where to find them", "Use your business's own PAN card and GST registration certificate — RMS doesn't generate or verify these for you."],
    ["3", "Not required to sign up", "You could register and log in without them — they're only needed once you're ready to trade, not before."],
    ["4", "Format", "PAN is 10 characters (e.g. ABCDE1234F). GSTIN is 15 characters and starts with your state code (e.g. 27 for Maharashtra)."],
    ["5", "Who sees this", "Only retailers you're approved with — never shown publicly or to other vendors."],
    ["6", "Why bother early", "Some retailers ask for these before approving larger purchase orders — adding them now avoids a delay later."],
  ];
  return (
    <details className="overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-white to-teal-50 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-100 text-sm font-black text-teal-700">i</span>
          <div><p className="text-sm font-black text-slate-900">Why add PAN &amp; GST?</p><p className="mt-0.5 text-xs text-slate-500">What these are for, and why they aren't asked at signup</p></div>
        </div>
        <span className="rounded-full border border-teal-200 bg-white px-3 py-1 text-[11px] font-bold text-teal-700">Show guide</span>
      </summary>
      <div className="border-t border-teal-100 px-5 pb-5 pt-4">
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {steps.map(([number, title, text]) => (
            <div key={number} className="flex gap-2.5 rounded-xl border border-teal-100 bg-white p-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-600 text-[11px] font-black text-white">{number}</span>
              <div><p className="text-xs font-black text-slate-900">{title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{text}</p></div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function Card({ icon: Icon, title, subtitle, children, action }) {
  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)]"><header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6"><div className="flex min-w-0 items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-100"><Icon className="h-5 w-5" /></span><div><h2 className="text-base font-black text-slate-900">{title}</h2>{subtitle && <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>}</div></div>{action}</header><div className="p-5 sm:p-6">{children}</div></section>;
}

export default function MsellerSettings({ onNavigate = () => {} }) {
  const [profile, setProfile] = useState({ name: "", email: "", contactMobile: "", address: "", city: "", website: "", pan: "", gstin: "", gstCategory: "", gstState: "" });
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [orderPreferences, setOrderPreferences] = useState(DEFAULT_ORDER_PREFERENCES);
  const [subscription, setSubscription] = useState(null);
  const [kyb, setKyb] = useState({ legal_name: "", business_address: "", bank_account_holder: "", bank_name: "", ifsc: "", account_number: "", account_last4: "", gst_certificate_url: "", pan_document_url: "", cancelled_cheque_url: "" });
  const [kybRelationships, setKybRelationships] = useState([]);
  const [whatsApp, setWhatsApp] = useState({ loading: true, connected: false, available: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [uploadingDocument, setUploadingDocument] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const request = useCallback(async (path, options = {}) => {
    const token = vendorToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : data.detail?.message || "Request failed");
    return data;
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const account = await request("/api/vendors/me");
      const settings = account.settings || {};
      setProfile({
        name: account.name || account.brandName || "",
        email: account.email || "",
        contactMobile: account.contactMobile || account.phone || "",
        address: account.address || "",
        city: account.city || "",
        website: account.website || "",
        pan: account.pan || "",
        gstin: account.gstin || "",
        gstCategory: account.gstCategory || "",
        gstState: account.gstState || "",
      });
      setNotifications({ ...DEFAULT_NOTIFICATIONS, ...(settings.notification_preferences || {}) });
      setOrderPreferences({ ...DEFAULT_ORDER_PREFERENCES, ...(settings.order_preferences || {}) });
      const kybData = await request("/api/vendors/me/kyb");
      setKyb((current) => ({ ...current, ...(kybData.data || {}), account_number: "" }));
      setKybRelationships(kybData.data?.relationships || []);
      try {
        const currentSubscription = await request("/api/subscriptions/me");
        setSubscription(currentSubscription);
      } catch { setSubscription(null); }
      try {
        const whatsappStatus = await request("/api/whatsapp/my-catalog-connection");
        setWhatsApp({ loading: false, available: true, connected: Boolean(whatsappStatus.connected), catalogId: whatsappStatus.catalog_id || "" });
      } catch { setWhatsApp({ loading: false, available: false, connected: false }); }
    } catch (err) { setError(err.message || "Could not load vendor settings."); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { load(); }, [load]);

  const save = async (section) => {
    setSaving(section); setError(""); setNotice("");
    try {
      await request("/api/vendors/me/settings", {
        method: "PATCH",
        body: JSON.stringify({ profile: section === "profile" ? profile : {}, preferences: { notifications, order_preferences: orderPreferences } }),
      });
      setNotice(section === "profile" ? "Business profile saved." : "Vendor preferences saved.");
      window.dispatchEvent(new Event("vendor-access-updated"));
    } catch (err) { setError(err.message || "Could not save settings."); }
    finally { setSaving(""); }
  };

  const uploadKybDocument = async (documentType, file) => {
    const fieldByType = { gst_certificate: "gst_certificate_url", pan_document: "pan_document_url", cancelled_cheque: "cancelled_cheque_url" };
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) { setError("Upload JPG, PNG, WEBP or PDF only."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("KYB documents must be 10 MB or smaller."); return; }
    setUploadingDocument(documentType); setError(""); setNotice("");
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch(`${API_BASE_URL}/api/vendors/me/kyb/documents/${documentType}`, { method: "POST", headers: { Authorization: `Bearer ${vendorToken()}` }, body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Could not upload the document.");
      setKyb((current) => ({ ...current, [fieldByType[documentType]]: result.url }));
      setNotice(`${file.name} uploaded. Submit KYB for retailer review when all details are ready.`);
    } catch (err) { setError(err.message || "Could not upload the document."); }
    finally { setUploadingDocument(""); }
  };
  const saveKyb = async () => {
    setSaving("kyb"); setError(""); setNotice("");
    try {
      const result = await request("/api/vendors/me/kyb", { method: "PATCH", body: JSON.stringify(kyb) });
      setKyb((current) => ({ ...current, account_number: "", account_last4: result.account_last4 || current.account_last4 }));
      const refreshed = await request("/api/vendors/me/kyb");
      setKybRelationships(refreshed.data?.relationships || []);
      setNotice("KYB submitted for retailer finance review.");
    } catch (err) { setError(err.message || "Could not submit KYB."); }
    finally { setSaving(""); }
  };
  if (loading) return <div className="grid min-h-80 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>;

  const planLabel = subscription?.tier?.label || subscription?.label || subscription?.plan?.label || "Current plan";
  const planStatus = subscription?.subscription?.status || subscription?.status || "Active";

  return <div className="mx-auto max-w-6xl space-y-5 pb-8">
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal-950 via-emerald-800 to-cyan-700 p-6 text-white shadow-xl sm:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Settings2 className="h-6 w-6 text-emerald-100" /></span><h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">Vendor settings</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/85">Keep your business details, order defaults and alerts ready for every retailer you work with.</p></div><button type="button" onClick={load} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold transition hover:bg-white/15"><RefreshCw className="h-4 w-4" />Refresh</button></div></section>

    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
    {notice && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{notice}</div>}

    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <Card icon={Building2} title="Business profile" subtitle="Shown to connected retailers and used on commercial documents." action={<button type="button" onClick={() => save("profile")} disabled={saving !== ""} className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-600 px-3.5 text-xs font-extrabold text-white transition hover:bg-teal-700 disabled:opacity-50">{saving === "profile" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button>}><div className="grid gap-4 sm:grid-cols-2"><Field label="Business name" value={profile.name} onChange={(value) => setProfile((p) => ({ ...p, name: value }))} placeholder="Your registered business" /><Field label="Account email" value={profile.email} readOnly hint="Email changes require RMS support for security." /><Field label="Contact mobile" value={profile.contactMobile} onChange={(value) => setProfile((p) => ({ ...p, contactMobile: value }))} placeholder="Business contact number" /><Field label="City" value={profile.city} onChange={(value) => setProfile((p) => ({ ...p, city: value }))} placeholder="City" /><Field label="Website" value={profile.website} onChange={(value) => setProfile((p) => ({ ...p, website: value }))} placeholder="https://yourbusiness.com" /><Field label="Business address" value={profile.address} onChange={(value) => setProfile((p) => ({ ...p, address: value }))} placeholder="Address or dispatch location" /></div></Card>

      <div className="space-y-5"><Card icon={ShieldCheck} title="Account security" subtitle="Your vendor login is protected separately from retailer department access."><div className="space-y-3"><div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><ShieldCheck className="h-5 w-5 text-emerald-600" /><div><p className="text-sm font-bold text-emerald-900">Vendor-only access</p><p className="mt-0.5 text-xs leading-5 text-emerald-800">Your account cannot access a retailer's internal departments.</p></div></div><p className="text-xs leading-5 text-slate-500">For password recovery or an email-address change, contact RMS support from Help & Support.</p><button type="button" onClick={() => onNavigate("help-support")} className="inline-flex items-center gap-1.5 text-xs font-extrabold text-teal-700 hover:text-teal-900">Open Help & Support <ChevronRight className="h-3.5 w-3.5" /></button></div></Card>
      <Card icon={Globe2} title="Plan & visibility" subtitle="Your plan controls feature limits, not retailer department access."><div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><div><p className="text-[10px] font-black uppercase tracking-[0.13em] text-indigo-500">{planStatus}</p><p className="mt-1 text-lg font-black text-indigo-950">{planLabel}</p></div><button type="button" onClick={() => onNavigate("subscription")} className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-indigo-700 shadow-sm ring-1 ring-indigo-100">Manage plan</button></div></Card></div>
    </div>

    <TaxProfileGuide />

    <Card icon={ShieldCheck} title="Tax & registration" subtitle="Not collected at signup — add these once you're ready. Used on commercial documents with retailers." action={<button type="button" onClick={() => save("profile")} disabled={saving !== ""} className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-600 px-3.5 text-xs font-extrabold text-white transition hover:bg-teal-700 disabled:opacity-50">{saving === "profile" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="PAN" value={profile.pan} onChange={(value) => setProfile((p) => ({ ...p, pan: value.toUpperCase() }))} placeholder="ABCDE1234F" hint="Format: AAAAA9999A" />
        <Field label="GSTIN" value={profile.gstin} onChange={(value) => setProfile((p) => ({ ...p, gstin: value.toUpperCase() }))} placeholder="22AAAAA0000A1Z5" />
        <Field label="GST category" value={profile.gstCategory} onChange={(value) => setProfile((p) => ({ ...p, gstCategory: value }))} placeholder="Normal Registered / Composition / Unregistered" />
        <Field label="GST state" value={profile.gstState} onChange={(value) => setProfile((p) => ({ ...p, gstState: value }))} placeholder="e.g. 27 - Maharashtra (MH)" />
      </div>
      {(!profile.pan || !profile.gstin) && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-3 text-xs font-semibold text-amber-800">Retailers may ask for these before approving larger orders — worth completing early.</p>
      )}
    </Card>

    <Card icon={ShieldCheck} title="Vendor verification (KYB)" subtitle="Submit your business and payout details once. Every connected retailer verifies your KYB separately." action={<button type="button" onClick={saveKyb} disabled={saving !== ""} className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-600 px-3.5 text-xs font-extrabold text-white transition hover:bg-teal-700 disabled:opacity-50">{saving === "kyb" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Submit for review</button>}>
      <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-xs leading-5 text-indigo-900"><b>Safe bank handling:</b> RMS stores only the last four digits after submission. Upload your GST certificate, PAN proof and cancelled cheque below; full account numbers are never shown back in the portal.</div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Legal business name *" value={kyb.legal_name} onChange={(value) => setKyb((current) => ({ ...current, legal_name: value }))} placeholder="Name on GST registration" /><Field label="Registered business address *" value={kyb.business_address} onChange={(value) => setKyb((current) => ({ ...current, business_address: value }))} placeholder="Address on business documents" /><Field label="Account holder name *" value={kyb.bank_account_holder} onChange={(value) => setKyb((current) => ({ ...current, bank_account_holder: value }))} placeholder="Name on bank account" /><Field label="Bank name *" value={kyb.bank_name} onChange={(value) => setKyb((current) => ({ ...current, bank_name: value }))} placeholder="Your bank" /><Field label="IFSC *" value={kyb.ifsc} onChange={(value) => setKyb((current) => ({ ...current, ifsc: value.toUpperCase() }))} placeholder="ABCD0123456" /><Field label="Bank account number *" type="password" value={kyb.account_number} onChange={(value) => setKyb((current) => ({ ...current, account_number: value }))} placeholder={kyb.account_last4 ? `Saved ending ${kyb.account_last4} — re-enter to update` : "Enter account number"} hint="Used only to record the masked payout account." /><KybDocumentField label="GST certificate" documentType="gst_certificate" url={kyb.gst_certificate_url} uploading={uploadingDocument === "gst_certificate"} onUpload={uploadKybDocument} onClear={() => setKyb((current) => ({ ...current, gst_certificate_url: "" }))} /> <KybDocumentField label="PAN document" documentType="pan_document" url={kyb.pan_document_url} uploading={uploadingDocument === "pan_document"} onUpload={uploadKybDocument} onClear={() => setKyb((current) => ({ ...current, pan_document_url: "" }))} /> <KybDocumentField label="Cancelled cheque" documentType="cancelled_cheque" url={kyb.cancelled_cheque_url} uploading={uploadingDocument === "cancelled_cheque"} onUpload={uploadKybDocument} onClear={() => setKyb((current) => ({ ...current, cancelled_cheque_url: "" }))} /></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">{kybRelationships.length ? kybRelationships.map((relationship) => <div key={relationship.tenant_id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black text-slate-800">{relationship.tenant_id}</p><p className={`mt-1 text-xs font-bold ${relationship.status === "Verified" ? "text-emerald-700" : relationship.status === "Needs changes" ? "text-rose-700" : "text-amber-700"}`}>{relationship.status}</p>{relationship.note && <p className="mt-1 text-[11px] leading-4 text-slate-500">{relationship.note}</p>}</div>) : <p className="text-xs text-slate-500">Submit once your PAN and GSTIN are saved to begin verification.</p>}</div>
    </Card>

    <div className="grid gap-5 xl:grid-cols-2">
      <Card icon={BellRing} title="Notification preferences" subtitle="Choose which business events RMS should highlight for this vendor account." action={<button type="button" onClick={() => save("preferences")} disabled={saving !== ""} className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-600 px-3.5 text-xs font-extrabold text-white transition hover:bg-teal-700 disabled:opacity-50">{saving === "preferences" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button>}><div className="space-y-2.5"><Toggle checked={notifications.purchase_orders} onChange={(value) => setNotifications((current) => ({ ...current, purchase_orders: value }))} title="Purchase orders" text="Notify when a retailer assigns a PO or its status changes." /><Toggle checked={notifications.rfqs_and_messages} onChange={(value) => setNotifications((current) => ({ ...current, rfqs_and_messages: value }))} title="RFQs and buyer messages" text="Highlight new RFQs, negotiation updates and document conversations." /><Toggle checked={notifications.supplier_returns} onChange={(value) => setNotifications((current) => ({ ...current, supplier_returns: value }))} title="Supplier returns" text="Highlight returns raised for rejected receipt quantities." /><Toggle checked={notifications.email_alerts} onChange={(value) => setNotifications((current) => ({ ...current, email_alerts: value }))} title="Email alerts" text="Use your registered business email for important account notices." /><Toggle checked={notifications.whatsapp_alerts} onChange={(value) => setNotifications((current) => ({ ...current, whatsapp_alerts: value }))} title="WhatsApp alerts" text="Preference saved for future Meta WhatsApp automation." /></div></Card>

      <Card icon={ShoppingCart} title="Order defaults" subtitle="These prepare your team for consistent buyer negotiations; they do not alter an already approved PO." action={<button type="button" onClick={() => save("preferences")} disabled={saving !== ""} className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-600 px-3.5 text-xs font-extrabold text-white transition hover:bg-teal-700 disabled:opacity-50">{saving === "preferences" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button>}><div className="grid gap-4 sm:grid-cols-2"><Field label="Default lead time (days)" type="number" value={orderPreferences.default_lead_time_days} onChange={(value) => setOrderPreferences((current) => ({ ...current, default_lead_time_days: value }))} /><Field label="Minimum order quantity" type="number" value={orderPreferences.minimum_order_quantity} onChange={(value) => setOrderPreferences((current) => ({ ...current, minimum_order_quantity: value }))} /><Field label="Default payment terms" value={orderPreferences.default_payment_terms} onChange={(value) => setOrderPreferences((current) => ({ ...current, default_payment_terms: value }))} placeholder="Example: 30 days from invoice" /><Field label="Return policy summary" value={orderPreferences.return_policy} onChange={(value) => setOrderPreferences((current) => ({ ...current, return_policy: value }))} placeholder="Example: replacement within 7 days" /></div><div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800"><Truck className="mt-0.5 h-4 w-4 shrink-0" />Use the PO Message button to agree a different lead time, quantity or rate with a buyer before you submit.</div></Card>
    </div>

    <Card icon={Smartphone} title="WhatsApp catalogue connection" subtitle="A saved Meta catalogue ID lets RMS recognize your catalogue in future integration work."><div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className={`grid h-10 w-10 place-items-center rounded-2xl ${whatsApp.connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}><MessageCircle className="h-5 w-5" /></span><div><p className="text-sm font-black text-slate-800">{whatsApp.loading ? "Checking connection..." : whatsApp.connected ? "Catalogue ID saved" : "Not connected"}</p><p className="mt-1 text-xs leading-5 text-slate-500">{whatsApp.connected ? `Catalog ID: ${whatsApp.catalogId}` : whatsApp.available ? "Connect your Meta catalogue ID when it is ready." : "WhatsApp integration is not available on this server yet."}</p></div></div><button type="button" onClick={() => onNavigate("whatsapp")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-white px-3.5 py-2.5 text-xs font-extrabold text-teal-700 transition hover:bg-teal-50">Manage WhatsApp <ChevronRight className="h-3.5 w-3.5" /></button></div></Card>
  </div>;
}