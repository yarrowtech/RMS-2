import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarClock,
  CircleDollarSign,
  FileSpreadsheet,
  Gift,
  HeartHandshake,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
  Tags,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";
import { logoutOrReturnToDepartmentSelector } from "../../utils/authRedirect.js";

function token() {
  return localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

async function crmFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Customer CRM request failed.");
  return data;
}

const styles = `
  .crm-shell { min-height: 100vh; background: #f8fafc; color: #0f172a; }
  .crm-sidebar { width: 264px; background: linear-gradient(180deg,#082f49,#0f766e 55%,#134e4a); }
  .crm-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
  .crm-input { width: 100%; border: 1px solid #e2e8f0; background: #fff; color: #0f172a; border-radius: 10px; padding: 10px 12px; outline: none; font-size: 14px; }
  .crm-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
  .crm-label { display:block; font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#64748b; margin-bottom:6px; }
  @media (max-width: 900px) { .crm-layout { flex-direction: column; } .crm-sidebar { width: 100%; min-height: auto; } .crm-main { padding: 14px; } }
`;

const tabs = [
  { key: "customers", label: "Customers", icon: Users },
  { key: "followups", label: "Follow-ups", icon: CalendarClock },
  { key: "feedback", label: "Feedback", icon: HeartHandshake },
  { key: "segments", label: "Segments", icon: Tags },
  { key: "luckydraw", label: "Lucky Draw", icon: Gift },
];

const emptyCustomer = {
  name: "",
  mobile: "",
  email: "",
  city: "",
  birthday: "",
  anniversary: "",
  segment: "Regular",
  tags: "",
  preferred_channel: "WhatsApp",
  consent_whatsapp: false,
  consent_sms: false,
  consent_email: false,
  notes: "",
};

const emptyFollowup = { customer_id: "", customer_name: "", mobile: "", title: "", due_date: "", channel: "WhatsApp", purpose: "Follow-up", note: "" };
const emptyFeedback = { customer_id: "", customer_name: "", mobile: "", source: "In-store", sentiment: "Neutral", note: "" };

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizedContact(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function exportDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("en-IN") : "";
}

function Stat({ label, value, helper, icon: Icon, color }) {
  return (
    <div className="crm-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${color}`}><Icon size={20} /></span>
      </div>
    </div>
  );
}

function ModalHeader({ eyebrow, title, onClose }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
      <div><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">{eyebrow}</p><h2 className="text-base font-bold text-slate-900">{title}</h2></div>
      <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-4 w-4" /></button>
    </div>
  );
}

function ModalFooter({ onClose, onSave, saveLabel }) {
  return (
    <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
      <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
      <button onClick={onSave} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">{saveLabel}</button>
    </div>
  );
}

function CustomerModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(() => initial || emptyCustomer);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
        <ModalHeader eyebrow="Customer CRM" title={initial?.id ? "Update customer profile" : "Add customer profile"} onClose={onClose} />
        <div className="grid gap-4 overflow-y-auto p-6 md:grid-cols-2">
          <div><label className="crm-label">Customer name</label><input className="crm-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Riya Das" /></div>
          <div><label className="crm-label">Mobile</label><input className="crm-input" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="10 digit mobile" /></div>
          <div><label className="crm-label">Email</label><input className="crm-input" value={form.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="customer@email.com" /></div>
          <div><label className="crm-label">City / Area</label><input className="crm-input" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Kolkata, New Market" /></div>
          <div><label className="crm-label">Birthday</label><input type="date" className="crm-input" value={form.birthday} onChange={(e) => set("birthday", e.target.value)} /></div>
          <div><label className="crm-label">Anniversary</label><input type="date" className="crm-input" value={form.anniversary} onChange={(e) => set("anniversary", e.target.value)} /></div>
          <div><label className="crm-label">Segment</label><select className="crm-input" value={form.segment} onChange={(e) => set("segment", e.target.value)}><option>Regular</option><option>VIP</option><option>New</option><option>At risk</option><option>Wholesale</option><option>Walk-in</option></select></div>
          <div><label className="crm-label">Preferred channel</label><select className="crm-input" value={form.preferred_channel} onChange={(e) => set("preferred_channel", e.target.value)}><option>WhatsApp</option><option>SMS</option><option>Email</option><option>Call</option></select></div>
          <div className="md:col-span-2"><label className="crm-label">Tags</label><input className="crm-input" value={Array.isArray(form.tags) ? form.tags.join(", ") : form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="festive buyer, kurti, premium" /></div>
          <div className="md:col-span-2 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
            {["consent_whatsapp", "consent_sms", "consent_email"].map((key) => <label key={key} className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={Boolean(form[key])} onChange={(e) => set(key, e.target.checked)} /> {key.replace("consent_", "").toUpperCase()} consent</label>)}
          </div>
          <div className="md:col-span-2"><label className="crm-label">Notes</label><textarea className="crm-input min-h-24" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Preference, complaint history, buying style..." /></div>
        </div>
        <ModalFooter onClose={onClose} onSave={() => onSave(form)} saveLabel="Save customer" />
      </div>
    </div>
  );
}

function CampaignModal({ onClose, onSave }) {
  const [form, setForm] = useState({ campaign_name: "", starts_on: "", ends_on: "", min_bill_amount: "", notes: "" });
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <ModalHeader eyebrow="Lucky Draw" title="New campaign" onClose={onClose} />
        <div className="grid gap-4 p-6">
          <div><label className="crm-label">Campaign name</label><input className="crm-input" value={form.campaign_name} onChange={(e) => set("campaign_name", e.target.value)} placeholder="e.g. Durga Puja 2026 Lucky Draw" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="crm-label">Starts on</label><input type="date" className="crm-input" value={form.starts_on} onChange={(e) => set("starts_on", e.target.value)} /></div>
            <div><label className="crm-label">Ends on</label><input type="date" className="crm-input" value={form.ends_on} onChange={(e) => set("ends_on", e.target.value)} /></div>
          </div>
          <div><label className="crm-label">Minimum bill amount (info only, shown to staff)</label><input type="number" min="0" className="crm-input" value={form.min_bill_amount} onChange={(e) => set("min_bill_amount", e.target.value)} placeholder="e.g. 2000" /></div>
          <div><label className="crm-label">Notes</label><textarea className="crm-input min-h-20" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Prize details, rules for staff at the counter..." /></div>
        </div>
        <ModalFooter onClose={onClose} onSave={() => onSave(form)} saveLabel="Create campaign" />
      </div>
    </div>
  );
}

function LuckyDrawEntryModal({ campaigns, defaultCampaignId, onClose, onSave }) {
  const [form, setForm] = useState({ campaign_id: defaultCampaignId || (campaigns[0]?.id || ""), customer_name: "", address: "", contact_no: "", profession: "", bill_no: "" });
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <ModalHeader eyebrow="Lucky Draw" title="Add slip entry" onClose={onClose} />
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="crm-label">Campaign</label>
            <select className="crm-input" value={form.campaign_id} onChange={(e) => set("campaign_id", e.target.value)}>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.campaign_name}{c.status === "CLOSED" ? " (closed)" : ""}</option>)}
            </select>
          </div>
          <div><label className="crm-label">Customer name</label><input className="crm-input" value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="As written on the slip" /></div>
          <div><label className="crm-label">Contact no.</label><input type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} className="crm-input" value={form.contact_no} onChange={(e) => set("contact_no", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 digit mobile" /></div>
          <div className="md:col-span-2"><label className="crm-label">Address</label><input className="crm-input" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="As written on the slip" /></div>
          <div><label className="crm-label">Profession</label><input className="crm-input" value={form.profession} onChange={(e) => set("profession", e.target.value)} placeholder="e.g. Teacher, Business" /></div>
          <div><label className="crm-label">Bill no.</label><input className="crm-input" value={form.bill_no} onChange={(e) => set("bill_no", e.target.value)} placeholder="From the purchase bill" /></div>
        </div>
        <ModalFooter onClose={onClose} onSave={() => onSave(form)} saveLabel="Save entry" />
      </div>
    </div>
  );
}

function DrawModal({ campaign, isHq, defaultRedo, onClose, onSave }) {
  const [form, setForm] = useState({ store_id: "", winner_count: 1, reason: "", redo: Boolean(defaultRedo) });
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <ModalHeader eyebrow="Lucky Draw" title={`Run draw — ${campaign?.campaign_name || ""}`} onClose={onClose} />
        <div className="grid gap-4 p-6">
          {isHq && (
            <div>
              <label className="crm-label">Store scope</label>
              <input className="crm-input" value={form.store_id} onChange={(e) => set("store_id", e.target.value)} placeholder="Leave blank for one chain-wide grand draw across every store" />
            </div>
          )}
          <div><label className="crm-label">Number of winners</label><input type="number" min="1" max="50" className="crm-input" value={form.winner_count} onChange={(e) => set("winner_count", e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.redo} onChange={(e) => set("redo", e.target.checked)} /> This redoes a draw already run for this exact scope</label>
          {form.redo && <div><label className="crm-label">Reason for redoing (required)</label><textarea className="crm-input min-h-20" value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. winner unreachable, entry error found..." /></div>}
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">This is a real random shuffle of every eligible entry (one chance per unique phone number). Once run, the result is locked — redoing it later always requires a written reason on record.</p>
        </div>
        <ModalFooter onClose={onClose} onSave={() => onSave(form)} saveLabel={form.redo ? "Confirm redo" : "Run draw"} />
      </div>
    </div>
  );
}

export default function CustomerCRM() {
  const [active, setActive] = useState("customers");
  const [data, setData] = useState({ stats: {}, customers: [], followups: [], feedback: [], scope: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [customerModal, setCustomerModal] = useState(null);
  const [followupDraft, setFollowupDraft] = useState(emptyFollowup);
  const [feedbackDraft, setFeedbackDraft] = useState(emptyFeedback);
  const [luckyDraw, setLuckyDraw] = useState({ campaigns: [], entries: [], results: [] });
  const [ldCampaignFilter, setLdCampaignFilter] = useState("");
  const [campaignModal, setCampaignModal] = useState(null);
  const [entryModal, setEntryModal] = useState(null);
  const [drawModal, setDrawModal] = useState(null);
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [exportingEntries, setExportingEntries] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await crmFetch("/api/customer-crm/overview")); }
    catch (e) { setError(e.message || "Unable to load CRM."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadLuckyDraw = useCallback(async () => {
    try {
      const [campaigns, entries, results] = await Promise.all([
        crmFetch("/api/customer-crm/lucky-draw/campaigns"),
        crmFetch("/api/customer-crm/lucky-draw/entries"),
        crmFetch("/api/customer-crm/lucky-draw/results"),
      ]);
      setLuckyDraw({ campaigns, entries, results });
    } catch (e) { setError(e.message || "Unable to load lucky draw."); }
  }, []);

  useEffect(() => { if (active === "luckydraw") loadLuckyDraw(); }, [active, loadLuckyDraw]);

  const customers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data.customers || []).filter((c) => !q || [c.name, c.mobile, c.email, c.segment, ...(c.tags || [])].some((x) => String(x || "").toLowerCase().includes(q)));
  }, [data.customers, query]);

  const segmentRows = useMemo(() => {
    const map = new Map();
    for (const c of data.customers || []) {
      const key = c.segment || "Regular";
      const row = map.get(key) || { segment: key, customers: 0, bills: 0, spend: 0 };
      row.customers += 1;
      row.bills += Number(c.bill_count || 0);
      row.spend += Number(c.total_spend || 0);
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.spend - a.spend);
  }, [data.customers]);

  const saveCustomer = async (form) => {
    const payload = { ...form, tags: Array.isArray(form.tags) ? form.tags : String(form.tags || "").split(",").map((x) => x.trim()).filter(Boolean) };
    await crmFetch(form.id && !String(form.id).startsWith("mobile:") && !String(form.id).startsWith("name:") ? `/api/customer-crm/customers/${form.id}` : "/api/customer-crm/customers", {
      method: form.id && !String(form.id).startsWith("mobile:") && !String(form.id).startsWith("name:") ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    setCustomerModal(null); load();
  };

  const quickFollowup = (customer) => {
    setActive("followups");
    setFollowupDraft({ ...emptyFollowup, customer_id: customer.id || "", customer_name: customer.name || "", mobile: customer.mobile || "", title: `Follow up with ${customer.name || "customer"}`, due_date: today() });
  };

  const createFollowup = async () => {
    await crmFetch("/api/customer-crm/followups", { method: "POST", body: JSON.stringify(followupDraft) });
    setFollowupDraft(emptyFollowup); load();
  };

  const createFeedback = async () => {
    await crmFetch("/api/customer-crm/feedback", { method: "POST", body: JSON.stringify(feedbackDraft) });
    setFeedbackDraft(emptyFeedback); load();
  };

  const setFollowupStatus = async (id, status) => {
    await crmFetch(`/api/customer-crm/followups/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  };

  const createCampaign = async (form) => {
    try {
      await crmFetch("/api/customer-crm/lucky-draw/campaigns", {
        method: "POST",
        body: JSON.stringify({ ...form, min_bill_amount: Number(form.min_bill_amount || 0) }),
      });
      setCampaignModal(null); loadLuckyDraw();
    } catch (e) { setError(e.message || "Unable to create campaign."); }
  };

  const toggleCampaignStatus = async (id, status) => {
    try {
      await crmFetch(`/api/customer-crm/lucky-draw/campaigns/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      loadLuckyDraw();
    } catch (e) { setError(e.message || "Unable to update campaign."); }
  };

  const removeCampaign = async (campaign) => {
    const confirmed = window.confirm("Remove '" + campaign.campaign_name + "'? It will disappear and stop accepting entries. Existing slips and draw history will remain retained for audit.");
    if (!confirmed) return;
    try {
      await crmFetch("/api/customer-crm/lucky-draw/campaigns/" + campaign.id, { method: "DELETE" });
      if (ldCampaignFilter === campaign.id) setLdCampaignFilter("");
      loadLuckyDraw();
    } catch (e) { setError(e.message || "Unable to remove campaign."); }
  };

  const saveEntry = async (form) => {
    try {
      await crmFetch("/api/customer-crm/lucky-draw/entries", { method: "POST", body: JSON.stringify(form) });
      setEntryModal(null); loadLuckyDraw();
    } catch (e) { setError(e.message || "Unable to save entry."); }
  };

  const removeEntry = async (id) => {
    if (!window.confirm("Remove this entry?")) return;
    try {
      await crmFetch(`/api/customer-crm/lucky-draw/entries/${id}`, { method: "DELETE" });
      loadLuckyDraw();
    } catch (e) { setError(e.message || "Unable to remove entry."); }
  };

  const runDraw = async (form) => {
    if (!drawModal?.campaign) return;
    try {
      const payload = { winner_count: Number(form.winner_count || 1) };
      if (data.scope?.scope === "hq") payload.store_id = form.store_id ? form.store_id : null;
      const path = form.redo
        ? `/api/customer-crm/lucky-draw/campaigns/${drawModal.campaign.id}/draw/redo`
        : `/api/customer-crm/lucky-draw/campaigns/${drawModal.campaign.id}/draw`;
      if (form.redo) payload.reason = form.reason;
      await crmFetch(path, { method: "POST", body: JSON.stringify(payload) });
      setDrawModal(null); loadLuckyDraw();
    } catch (e) { setError(e.message || "Unable to run the draw."); }
  };

  const checkPhone = async () => {
    if (!lookupPhone.trim()) return;
    setLookupBusy(true);
    try {
      const res = await crmFetch(`/api/customer-crm/lucky-draw/lookup?contact_no=${encodeURIComponent(lookupPhone.trim())}`);
      setLookupResult(res);
    } catch (e) { setError(e.message || "Unable to check this number."); }
    finally { setLookupBusy(false); }
  };

  const whatsappLink = (customer) => {
    const mobile = String(customer.mobile || "").replace(/\D/g, "");
    if (!mobile) return "#";
    const text = encodeURIComponent(`Hi ${customer.name || "there"}, thank you for shopping with us. We have new offers and collections for you.`);
    return `https://wa.me/91${mobile.slice(-10)}?text=${text}`;
  };

  const exportLuckyDrawEntries = async (entries) => {
    if (!entries.length) {
      setError("There are no slip entries in the current campaign filter to export.");
      return;
    }
    setExportingEntries(true);
    setError("");
    try {
      const XLSX = await import("xlsx");
      const profilesByPhone = new Map();
      for (const customer of data.customers || []) {
        const phone = normalizedContact(customer.mobile);
        if (phone && !profilesByPhone.has(phone)) profilesByPhone.set(phone, customer);
      }

      const campaignContacts = new Map();
      const slipRows = entries.map((entry) => {
        const phone = normalizedContact(entry.contact_no);
        const profile = phone ? profilesByPhone.get(phone) : null;
        const whatsappConsent = profile ? Boolean(profile.consent_whatsapp) : null;
        const smsConsent = profile ? Boolean(profile.consent_sms) : null;
        const emailConsent = profile ? Boolean(profile.consent_email) : null;
        const eligible = Boolean(whatsappConsent || smsConsent || emailConsent);
        const consentLabel = (value) => value === null ? "Not recorded" : value ? "Yes" : "No";
        const contactKey = phone ? "phone:" + phone : "entry:" + entry.id;
        const existing = campaignContacts.get(contactKey) || {
          "Customer Name": entry.customer_name || profile?.name || "",
          "Contact Number": phone || String(entry.contact_no || ""),
          "Email": profile?.email || "",
          "Address": entry.address || "",
          "Profession": entry.profession || "",
          "CRM Segment": profile?.segment || "",
          "Preferred Channel": profile?.preferred_channel || "",
          "WhatsApp Consent": consentLabel(whatsappConsent),
          "SMS Consent": consentLabel(smsConsent),
          "Email Consent": consentLabel(emailConsent),
          "Marketing Eligible": eligible ? "Yes" : "No",
          "Consent Check": profile ? "CRM profile matched" : "Not recorded - do not message",
          campaigns: new Set(),
          stores: new Set(),
          bills: new Set(),
          entries: 0,
          latestEntry: "",
        };
        existing.campaigns.add(entry.campaign_name || "");
        existing.stores.add(entry.store_name || data.scope?.store_name || "HQ");
        existing.bills.add(entry.bill_no || "");
        existing.entries += 1;
        if (String(entry.created_at || "") > existing.latestEntry) existing.latestEntry = String(entry.created_at || "");
        campaignContacts.set(contactKey, existing);
        return {
          "Customer Name": entry.customer_name || "",
          "Contact Number": phone || String(entry.contact_no || ""),
          "Address": entry.address || "",
          "Profession": entry.profession || "",
          "Bill No.": entry.bill_no || "",
          "Campaign": entry.campaign_name || "",
          "Store": entry.store_name || data.scope?.store_name || "HQ",
          "Entered By": entry.entered_by_name || "",
          "Entry Date": exportDate(entry.created_at),
          "WhatsApp Consent": consentLabel(whatsappConsent),
          "SMS Consent": consentLabel(smsConsent),
          "Email Consent": consentLabel(emailConsent),
          "Marketing Eligible": eligible ? "Yes" : "No",
          "Consent Check": profile ? "CRM profile matched" : "Not recorded - do not message",
        };
      });

      const contactRows = [...campaignContacts.values()].map((row) => ({
        "Customer Name": row["Customer Name"],
        "Contact Number": row["Contact Number"],
        "Email": row.Email,
        "Address": row.Address,
        "Profession": row.Profession,
        "CRM Segment": row["CRM Segment"],
        "Preferred Channel": row["Preferred Channel"],
        "WhatsApp Consent": row["WhatsApp Consent"],
        "SMS Consent": row["SMS Consent"],
        "Email Consent": row["Email Consent"],
        "Marketing Eligible": row["Marketing Eligible"],
        "Consent Check": row["Consent Check"],
        "Campaign(s)": [...row.campaigns].filter(Boolean).join(", "),
        "Store(s)": [...row.stores].filter(Boolean).join(", "),
        "Bill No(s).": [...row.bills].filter(Boolean).join(", "),
        "Slip Entries": row.entries,
        "Latest Entry Date": exportDate(row.latestEntry),
      }));

      const selectedCampaign = (luckyDraw.campaigns || []).find((campaign) => campaign.id === ldCampaignFilter);
      const campaignLabel = selectedCampaign?.campaign_name || "All campaigns";
      const workbook = XLSX.utils.book_new();
      const contactSheet = XLSX.utils.json_to_sheet(contactRows);
      contactSheet["!cols"] = [{wch:24},{wch:16},{wch:28},{wch:28},{wch:20},{wch:16},{wch:18},{wch:18},{wch:14},{wch:16},{wch:18},{wch:30},{wch:28},{wch:22},{wch:24},{wch:12},{wch:22}];
      const slipSheet = XLSX.utils.json_to_sheet(slipRows);
      slipSheet["!cols"] = [{wch:24},{wch:16},{wch:28},{wch:20},{wch:16},{wch:26},{wch:22},{wch:20},{wch:22},{wch:18},{wch:14},{wch:16},{wch:18},{wch:30}];
      const readMeSheet = XLSX.utils.aoa_to_sheet([
        ["RMS Customer Campaign Export"],
        ["Campaign filter", campaignLabel],
        ["Scope", data.scope?.scope === "hq" ? "Tenant - all stores" : data.scope?.store_name || "Current store"],
        ["Generated at", new Date().toLocaleString("en-IN")],
        ["Slip entries", entries.length],
        ["Unique contacts", contactRows.length],
        [],
        ["Important", "Send promotional messages only where the relevant channel consent is Yes. 'Not recorded' is not consent."],
        ["Campaign Contacts", "Deduplicated by the last 10 digits of the contact number and intended for campaign planning."],
        ["Slip Entries", "Raw tenant/store-scoped entry records retained for audit and campaign analysis."],
      ]);
      readMeSheet["!cols"] = [{wch:24},{wch:100}];
      XLSX.utils.book_append_sheet(workbook, contactSheet, "Campaign Contacts");
      XLSX.utils.book_append_sheet(workbook, slipSheet, "Slip Entries");
      XLSX.utils.book_append_sheet(workbook, readMeSheet, "Read Me");
      const safeCampaign = campaignLabel.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50) || "campaign";
      XLSX.writeFile(workbook, "rms-customer-" + safeCampaign + "-" + today() + ".xlsx", { compression: true });
    } catch (e) {
      setError(e.message || "Unable to export the Excel file.");
    } finally {
      setExportingEntries(false);
    }
  };

  const renderCustomers = () => (
    <div className="crm-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div><h2 className="text-lg font-bold text-slate-900">Customer master</h2><p className="text-sm text-slate-500">POS bills auto-create purchase history; CRM profile enriches it with consent, tags and follow-ups.</p></div>
        <div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16}/><input className="crm-input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer..." /></div><button onClick={() => setCustomerModal(emptyCustomer)} className="whitespace-nowrap rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"><Plus size={16} className="inline"/> Add</button></div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500"><tr><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Segment</th><th className="px-5 py-3">Bills</th><th className="px-5 py-3">Spend</th><th className="px-5 py-3">Last purchase</th><th className="px-5 py-3">Consent</th><th className="px-5 py-3">Action</th></tr></thead><tbody>{customers.map((c) => <tr key={c.id} className="border-t border-slate-100"><td className="px-5 py-3"><p className="font-bold text-slate-900">{c.name || "Customer"}</p><p className="text-xs text-slate-500">{c.mobile || "No mobile"} {c.email ? `- ${c.email}` : ""}</p><p className="text-[11px] text-slate-400">{c.source}</p></td><td className="px-5 py-3"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{c.segment || "Regular"}</span></td><td className="px-5 py-3 font-semibold text-slate-700">{c.bill_count || 0}</td><td className="px-5 py-3 font-bold text-slate-900">{money(c.total_spend)}</td><td className="px-5 py-3 text-slate-600">{c.last_purchase || "-"}</td><td className="px-5 py-3 text-xs"><span className={c.consent_whatsapp ? "font-bold text-emerald-600" : "text-slate-400"}>WA</span> / <span className={c.consent_sms ? "font-bold text-emerald-600" : "text-slate-400"}>SMS</span> / <span className={c.consent_email ? "font-bold text-emerald-600" : "text-slate-400"}>Email</span></td><td className="px-5 py-3"><div className="flex gap-2"><button onClick={() => setCustomerModal({ ...emptyCustomer, ...c, tags: (c.tags || []).join(", ") })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Edit</button><button onClick={() => quickFollowup(c)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700">Follow-up</button><a href={whatsappLink(c)} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">WhatsApp</a></div></td></tr>)}</tbody></table>{!customers.length && <p className="p-8 text-center text-sm font-semibold text-slate-500">No customers found yet. Billing with mobile number or adding a CRM profile will show here.</p>}</div>
    </div>
  );

  const renderFollowups = () => (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div className="crm-card p-5"><h2 className="text-base font-bold text-slate-900">Create follow-up</h2><p className="mb-4 text-sm text-slate-500">Use for repeat purchase reminder, complaint callback, birthday offer, payment follow-up, or VIP visit.</p>{[["customer_name","Customer name"],["mobile","Mobile"],["title","Task title"],["due_date","Due date"],["purpose","Purpose"],["note","Note"]].map(([k,l]) => <div className="mb-3" key={k}><label className="crm-label">{l}</label>{k === "note" ? <textarea className="crm-input" value={followupDraft[k]} onChange={(e) => setFollowupDraft((d) => ({...d,[k]:e.target.value}))}/> : <input type={k === "due_date" ? "date" : "text"} className="crm-input" value={followupDraft[k]} onChange={(e) => setFollowupDraft((d) => ({...d,[k]:e.target.value}))}/>}</div>)}<button onClick={createFollowup} className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"><Send size={16} className="inline"/> Save follow-up</button></div>
      <div className="crm-card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="text-base font-bold text-slate-900">Follow-up queue</h2><p className="text-sm text-slate-500">Pending/Due customer work for CRM, store and marketing teams.</p></div><div className="divide-y divide-slate-100">{(data.followups || []).map((f) => <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="font-bold text-slate-900">{f.title}</p><p className="text-sm text-slate-500">{f.customer_name || "Customer"} - {f.mobile || "No mobile"} - {f.channel} - Due {f.due_date || "not set"}</p><p className="text-xs text-slate-400">{f.note}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${f.status === "Done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{f.status}</span>{f.status !== "Done" && <button onClick={() => setFollowupStatus(f.id, "Done")} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800">Mark done</button>}</div></div>)}{!(data.followups || []).length && <p className="p-8 text-center text-sm text-slate-500">No follow-ups yet.</p>}</div></div>
    </div>
  );

  const renderFeedback = () => (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div className="crm-card p-5"><h2 className="text-base font-bold text-slate-900">Record feedback</h2><p className="mb-4 text-sm text-slate-500">Complaint, praise, WhatsApp reply, service issue or product request.</p>{[["customer_name","Customer name"],["mobile","Mobile"],["source","Source"]].map(([k,l]) => <div className="mb-3" key={k}><label className="crm-label">{l}</label><input className="crm-input" value={feedbackDraft[k]} onChange={(e) => setFeedbackDraft((d) => ({...d,[k]:e.target.value}))}/></div>)}<div className="mb-3"><label className="crm-label">Sentiment</label><select className="crm-input" value={feedbackDraft.sentiment} onChange={(e) => setFeedbackDraft((d) => ({...d,sentiment:e.target.value}))}><option>Positive</option><option>Neutral</option><option>Negative</option></select></div><div className="mb-3"><label className="crm-label">Note</label><textarea className="crm-input min-h-28" value={feedbackDraft.note} onChange={(e) => setFeedbackDraft((d) => ({...d,note:e.target.value}))}/></div><button onClick={createFeedback} className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Save feedback</button></div>
      <div className="crm-card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="text-base font-bold text-slate-900">Feedback log</h2></div><div className="divide-y divide-slate-100">{(data.feedback || []).map((f) => <div key={f.id} className="p-5"><div className="flex justify-between gap-3"><p className="font-bold text-slate-900">{f.customer_name || "Customer"}</p><span className={`rounded-full px-3 py-1 text-xs font-bold ${f.sentiment === "Positive" ? "bg-emerald-100 text-emerald-700" : f.sentiment === "Negative" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>{f.sentiment}</span></div><p className="mt-1 text-sm text-slate-500">{f.source} - {f.mobile}</p><p className="mt-2 text-sm text-slate-700">{f.note}</p></div>)}{!(data.feedback || []).length && <p className="p-8 text-center text-sm text-slate-500">No feedback logged yet.</p>}</div></div>
    </div>
  );

  const renderSegments = () => (
    <div className="crm-card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="text-base font-bold text-slate-900">Customer segments</h2><p className="text-sm text-slate-500">Use this to plan campaigns: VIP, repeat buyers, at-risk customers, birthday buyers, wholesale customers.</p></div><div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">{segmentRows.map((s) => <div key={s.segment} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">{s.segment}</p><p className="mt-3 text-2xl font-bold text-slate-900">{s.customers}</p><p className="text-sm text-slate-500">customers - {s.bills} bills - {money(s.spend)}</p><button onClick={() => { setActive("customers"); setQuery(s.segment); }} className="mt-4 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800">View customers</button></div>)}</div></div>
  );

  const renderLuckyDraw = () => {
    const isHq = data.scope?.scope === "hq";
    const myStoreId = data.scope?.store_id;
    const activeCampaigns = (luckyDraw.campaigns || []).filter((c) => c.status === "ACTIVE");
    const filteredEntries = ldCampaignFilter ? (luckyDraw.entries || []).filter((e) => e.campaign_id === ldCampaignFilter) : (luckyDraw.entries || []);
    const hasOwnDraw = (campaignId) => (luckyDraw.results || []).some((r) => r.campaign_id === campaignId && !r.superseded && (isHq ? true : r.store_id === myStoreId));
    return (
      <div className="space-y-5">
        <div className="crm-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Festival campaigns</h2>
              <p className="text-sm text-slate-500">{isHq ? "Visible across every store. Only HQ Admin can create or close a campaign." : "Pick the active campaign below when you add a slip entry."}</p>
            </div>
            {isHq && <button onClick={() => setCampaignModal({})} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"><Plus size={16} className="inline"/> New campaign</button>}
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {(luckyDraw.campaigns || []).map((c) => (
              <div key={c.id} className={`rounded-xl border p-5 ${c.status === "ACTIVE" ? "border-indigo-200 bg-indigo-50/40" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${c.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{c.status}</span>
                  {isHq && <div className="flex items-center gap-3"><button onClick={() => toggleCampaignStatus(c.id, c.status === "ACTIVE" ? "CLOSED" : "ACTIVE")} className="text-xs font-bold text-slate-500 underline hover:text-slate-700">{c.status === "ACTIVE" ? "Close" : "Reopen"}</button><button onClick={() => removeCampaign(c)} title="Remove campaign" className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800"><Trash2 size={13}/>Remove</button></div>}
                </div>
                <p className="mt-3 text-base font-bold text-slate-900">{c.campaign_name}</p>
                <p className="text-xs text-slate-500">{c.starts_on || "No start date"} - {c.ends_on || "No end date"}</p>
                {c.min_bill_amount > 0 && <p className="mt-2 text-xs font-semibold text-amber-700">Min. bill: {money(c.min_bill_amount)} (staff reminder only, not auto-checked)</p>}
                {c.notes && <p className="mt-2 text-xs text-slate-500">{c.notes}</p>}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setLdCampaignFilter(ldCampaignFilter === c.id ? "" : c.id)} className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">{ldCampaignFilter === c.id ? "Clear filter" : "View entries"}</button>
                  {c.status === "CLOSED" && <button onClick={() => setDrawModal({ campaign: c, defaultRedo: hasOwnDraw(c.id) })} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"><Trophy size={14} className="inline"/> {hasOwnDraw(c.id) ? "Redo draw" : "Run draw"}</button>}
                </div>
              </div>
            ))}
            {!(luckyDraw.campaigns || []).length && <p className="text-sm text-slate-500">No campaign yet.{isHq ? " Create one to start collecting slip entries." : " Ask HQ Admin to create one."}</p>}
          </div>
        </div>

        <div className="crm-card p-5">
          <h2 className="text-base font-bold text-slate-900"><Phone size={16} className="mr-1 inline text-indigo-600"/> Check a customer at the counter</h2>
          <p className="mb-3 text-sm text-slate-500">Look up by phone number to tell one customer whether they won, without showing anyone else's result.</p>
          <div className="flex gap-2">
            <input className="crm-input" value={lookupPhone} onChange={(e) => setLookupPhone(e.target.value)} placeholder="Enter contact number" />
            <button onClick={checkPhone} disabled={lookupBusy} className="whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">{lookupBusy ? "Checking..." : "Check"}</button>
          </div>
          {lookupResult && (lookupResult.found ? (
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-bold text-slate-900">{lookupResult.entries.length} slip{lookupResult.entries.length === 1 ? "" : "s"} found for this number.</p>
              {lookupResult.wins.length ? (
                <div className="mt-2 space-y-2">{lookupResult.wins.map((w, i) => <p key={i} className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-700">Winner! {w.campaign_name} - {w.scope} (Bill {w.bill_no})</p>)}</div>
              ) : <p className="mt-2 text-sm text-slate-500">No win on record for this number yet.</p>}
            </div>
          ) : <p className="mt-4 text-sm text-slate-500">No slip entry found for this number.</p>)}
        </div>

        <div className="crm-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div><h2 className="text-lg font-bold text-slate-900">Slip entries{isHq ? " (all stores)" : ""}</h2><p className="text-sm text-slate-500">One row per customer slip entered at the counter.</p></div>
            <div className="flex flex-wrap gap-2"><button disabled={!filteredEntries.length || exportingEntries} onClick={() => exportLuckyDrawEntries(filteredEntries)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"><FileSpreadsheet size={16} className="mr-1 inline"/>{exportingEntries ? "Preparing..." : "Export Excel"}</button><button disabled={!activeCampaigns.length} onClick={() => setEntryModal({})} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={16} className="inline"/> Add entry</button></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Profession</th><th className="px-5 py-3">Bill no.</th><th className="px-5 py-3">Campaign</th>{isHq && <th className="px-5 py-3">Store</th>}<th className="px-5 py-3">Entered by</th><th className="px-5 py-3"></th></tr>
              </thead>
              <tbody>
                {filteredEntries.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-5 py-3"><p className="font-bold text-slate-900">{e.customer_name}</p><p className="text-xs text-slate-500">{e.address}</p></td>
                    <td className="px-5 py-3 text-slate-700">{e.contact_no || "-"}</td>
                    <td className="px-5 py-3 text-slate-700">{e.profession || "-"}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{e.bill_no}</td>
                    <td className="px-5 py-3 text-slate-700">{e.campaign_name}</td>
                    {isHq && <td className="px-5 py-3 text-slate-700">{e.store_name || "HQ"}</td>}
                    <td className="px-5 py-3 text-xs text-slate-500">{e.entered_by_name || "-"}</td>
                    <td className="px-5 py-3"><button onClick={() => removeEntry(e.id)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredEntries.length && <p className="p-8 text-center text-sm font-semibold text-slate-500">No entries yet.</p>}
          </div>
        </div>

        {(luckyDraw.results || []).length > 0 && (
          <div className="crm-card overflow-hidden">
            <div className="border-b border-slate-100 p-5"><h2 className="text-lg font-bold text-slate-900"><Trophy size={17} className="mr-1 inline text-amber-500"/> Draw results</h2><p className="text-sm text-slate-500">Locked once run. A redo keeps the earlier result on record along with its reason.</p></div>
            <div className="divide-y divide-slate-100">
              {(luckyDraw.results || []).map((r) => (
                <div key={r.id} className={`p-5 ${r.superseded ? "bg-slate-50 opacity-70" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">{r.campaign_name} — <span className="text-indigo-600">{r.store_id ? (r.store_name || "Store draw") : "All stores (grand draw)"}</span></p>
                      <p className="text-xs text-slate-500">Drawn by {r.run_by_name || "-"} - {r.eligible_count} eligible entries</p>
                      {r.superseded && <p className="text-xs font-bold text-rose-600">Redone. Reason: {r.superseded_reason}</p>}
                    </div>
                    {!r.superseded && <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">FINAL</span>}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {(r.winners || []).map((w, idx) => (
                      <div key={w.entry_id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Winner #{idx + 1}</p>
                        <p className="font-bold text-slate-900">{w.customer_name}</p>
                        <p className="text-xs text-slate-500">{w.contact_no || "No contact"} - Bill {w.bill_no}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="crm-shell">
      <style>{styles}</style>
      <div className="crm-layout flex min-h-screen">
        <aside className="crm-sidebar p-5 text-white">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4"><p className="text-[11px] font-bold uppercase tracking-widest text-teal-200">RMS Growth</p><h1 className="mt-1.5 text-xl font-bold">Customer CRM</h1><p className="mt-1.5 text-xs text-teal-50/80">Profiles, loyalty signals, follow-ups and feedback in one customer view.</p></div>
          <nav className="mt-4 space-y-1.5">{tabs.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setActive(key)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm transition ${active === key ? "bg-white font-bold text-slate-900 shadow" : "font-semibold text-white/85 hover:bg-white/10"}`}><Icon size={18}/><span>{label}</span></button>)}</nav>
          <button onClick={logoutOrReturnToDepartmentSelector} className="mt-6 w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700">Logout</button>
        </aside>
        <main className="crm-main min-w-0 flex-1 p-6">
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Retail customer relationship management</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">Know who buys, follow up at the right time.</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">POS bills feed purchase history. CRM adds consent, tags, reminders, service notes and campaign-ready customer segments.</p>
            </div>
            <button onClick={load} className="whitespace-nowrap rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"><RefreshCw size={16} className="inline mr-1"/> Refresh</button>
          </section>
          {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}
          <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Stat label="Known customers" value={loading ? "..." : data.stats.customers || 0} helper="CRM + POS mobile records" icon={Users} color="bg-indigo-50 text-indigo-600" />
            <Stat label="Repeat customers" value={loading ? "..." : data.stats.repeat_customers || 0} helper="More than one bill" icon={Star} color="bg-amber-50 text-amber-600" />
            <Stat label="Customer sales" value={loading ? "..." : money(data.stats.total_spend)} helper="From POS bill history" icon={CircleDollarSign} color="bg-emerald-50 text-emerald-600" />
            <Stat label="Pending follow-ups" value={loading ? "..." : data.stats.pending_followups || 0} helper="Callbacks and reminders" icon={BellRing} color="bg-violet-50 text-violet-600" />
          </section>
          <section className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-900"><Sparkles size={16} className="mr-2 inline"/><b>Workflow:</b> cashier captures customer mobile during billing to CRM profile/history to marketing segments to WhatsApp/SMS/email follow-up to customer feedback history.</section>
          <section className="mt-5">{active === "customers" && renderCustomers()}{active === "followups" && renderFollowups()}{active === "feedback" && renderFeedback()}{active === "segments" && renderSegments()}{active === "luckydraw" && renderLuckyDraw()}</section>
        </main>
      </div>
      {customerModal && <CustomerModal initial={customerModal.id ? customerModal : null} onClose={() => setCustomerModal(null)} onSave={saveCustomer} />}
      {campaignModal && <CampaignModal onClose={() => setCampaignModal(null)} onSave={createCampaign} />}
      {entryModal && <LuckyDrawEntryModal campaigns={luckyDraw.campaigns || []} defaultCampaignId={ldCampaignFilter} onClose={() => setEntryModal(null)} onSave={saveEntry} />}
      {drawModal && <DrawModal campaign={drawModal.campaign} isHq={data.scope?.scope === "hq"} defaultRedo={drawModal.defaultRedo} onClose={() => setDrawModal(null)} onSave={runDraw} />}
    </div>
  );
}
