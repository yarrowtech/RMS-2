import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  HeartHandshake,
  Mail,
  Megaphone,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
  Store,
  Tags,
  UserPlus,
  Users,
  WalletCards,
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
  .crm-shell { min-height: 100vh; background: #f6fbff; color: #0f172a; }
  .crm-sidebar { width: 280px; background: linear-gradient(180deg,#082f49,#0f766e 55%,#134e4a); }
  .crm-card { background: rgba(255,255,255,.92); border: 1px solid #dbeafe; border-radius: 24px; box-shadow: 0 20px 60px rgba(15,23,42,.08); }
  .crm-glass { background: rgba(255,255,255,.72); border: 1px solid rgba(255,255,255,.5); backdrop-filter: blur(18px); }
  .crm-input { width: 100%; border: 1px solid #dbeafe; background: #fff; color: #0f172a; border-radius: 14px; padding: 11px 13px; outline: none; font-size: 14px; }
  .crm-input:focus { border-color: #0d9488; box-shadow: 0 0 0 4px rgba(13,148,136,.12); }
  .crm-label { display:block; font-size:11px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; color:#64748b; margin-bottom:6px; }
  @media (max-width: 900px) { .crm-layout { flex-direction: column; } .crm-sidebar { width: 100%; min-height: auto; } .crm-main { padding: 14px; } }
`;

const tabs = [
  { key: "customers", label: "Customers", icon: Users },
  { key: "followups", label: "Follow-ups", icon: CalendarClock },
  { key: "feedback", label: "Feedback", icon: HeartHandshake },
  { key: "segments", label: "Segments", icon: Tags },
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

function Stat({ label, value, helper, icon: Icon, color }) {
  return (
    <div className="crm-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
        </div>
        <span className={`grid h-12 w-12 place-items-center rounded-2xl ${color}`}><Icon size={22} /></span>
      </div>
    </div>
  );
}

function CustomerModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(() => initial || emptyCustomer);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-slate-950 p-5 text-white">
          <div><p className="text-xs font-black uppercase tracking-widest text-teal-200">Customer CRM</p><h2 className="text-xl font-black">{initial?.id ? "Update customer profile" : "Add customer profile"}</h2></div>
          <button onClick={onClose} className="rounded-xl bg-white/10 px-3 py-2 font-black">x</button>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div><label className="crm-label">Customer name</label><input className="crm-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Riya Das" /></div>
          <div><label className="crm-label">Mobile</label><input className="crm-input" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="10 digit mobile" /></div>
          <div><label className="crm-label">Email</label><input className="crm-input" value={form.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="customer@email.com" /></div>
          <div><label className="crm-label">City / Area</label><input className="crm-input" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Kolkata, New Market" /></div>
          <div><label className="crm-label">Birthday</label><input type="date" className="crm-input" value={form.birthday} onChange={(e) => set("birthday", e.target.value)} /></div>
          <div><label className="crm-label">Anniversary</label><input type="date" className="crm-input" value={form.anniversary} onChange={(e) => set("anniversary", e.target.value)} /></div>
          <div><label className="crm-label">Segment</label><select className="crm-input" value={form.segment} onChange={(e) => set("segment", e.target.value)}><option>Regular</option><option>VIP</option><option>New</option><option>At risk</option><option>Wholesale</option><option>Walk-in</option></select></div>
          <div><label className="crm-label">Preferred channel</label><select className="crm-input" value={form.preferred_channel} onChange={(e) => set("preferred_channel", e.target.value)}><option>WhatsApp</option><option>SMS</option><option>Email</option><option>Call</option></select></div>
          <div className="md:col-span-2"><label className="crm-label">Tags</label><input className="crm-input" value={Array.isArray(form.tags) ? form.tags.join(", ") : form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="festive buyer, kurti, premium" /></div>
          <div className="md:col-span-2 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-3">
            {["consent_whatsapp", "consent_sms", "consent_email"].map((key) => <label key={key} className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={Boolean(form[key])} onChange={(e) => set(key, e.target.checked)} /> {key.replace("consent_", "").toUpperCase()} consent</label>)}
          </div>
          <div className="md:col-span-2"><label className="crm-label">Notes</label><textarea className="crm-input min-h-24" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Preference, complaint history, buying style..." /></div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 p-5"><button onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-3 font-black">Cancel</button><button onClick={() => onSave(form)} className="rounded-2xl bg-teal-600 px-5 py-3 font-black text-white">Save customer</button></div>
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

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await crmFetch("/api/customer-crm/overview")); }
    catch (e) { setError(e.message || "Unable to load CRM."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const whatsappLink = (customer) => {
    const mobile = String(customer.mobile || "").replace(/\D/g, "");
    if (!mobile) return "#";
    const text = encodeURIComponent(`Hi ${customer.name || "there"}, thank you for shopping with us. We have new offers and collections for you.`);
    return `https://wa.me/91${mobile.slice(-10)}?text=${text}`;
  };

  const renderCustomers = () => (
    <div className="crm-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div><h2 className="text-xl font-black">Customer master</h2><p className="text-sm text-slate-500">POS bills auto-create purchase history; CRM profile enriches it with consent, tags and follow-ups.</p></div>
        <div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16}/><input className="crm-input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer..." /></div><button onClick={() => setCustomerModal(emptyCustomer)} className="rounded-2xl bg-teal-600 px-4 py-2 font-black text-white"><Plus size={16} className="inline"/> Add</button></div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Segment</th><th className="px-5 py-3">Bills</th><th className="px-5 py-3">Spend</th><th className="px-5 py-3">Last purchase</th><th className="px-5 py-3">Consent</th><th className="px-5 py-3">Action</th></tr></thead><tbody>{customers.map((c) => <tr key={c.id} className="border-t border-slate-100"><td className="px-5 py-3"><p className="font-black">{c.name || "Customer"}</p><p className="text-xs text-slate-500">{c.mobile || "No mobile"} {c.email ? `- ${c.email}` : ""}</p><p className="text-[11px] text-slate-400">{c.source}</p></td><td className="px-5 py-3"><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-black text-cyan-700">{c.segment || "Regular"}</span></td><td className="px-5 py-3 font-bold">{c.bill_count || 0}</td><td className="px-5 py-3 font-black">{money(c.total_spend)}</td><td className="px-5 py-3">{c.last_purchase || "-"}</td><td className="px-5 py-3 text-xs"><span className={c.consent_whatsapp ? "text-emerald-600 font-black" : "text-slate-400"}>WA</span> / <span className={c.consent_sms ? "text-emerald-600 font-black" : "text-slate-400"}>SMS</span> / <span className={c.consent_email ? "text-emerald-600 font-black" : "text-slate-400"}>Email</span></td><td className="px-5 py-3"><div className="flex gap-2"><button onClick={() => setCustomerModal({ ...emptyCustomer, ...c, tags: (c.tags || []).join(", ") })} className="rounded-xl border border-slate-200 px-3 py-2 font-bold">Edit</button><button onClick={() => quickFollowup(c)} className="rounded-xl bg-indigo-600 px-3 py-2 font-bold text-white">Follow-up</button><a href={whatsappLink(c)} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-3 py-2 font-bold text-white">WhatsApp</a></div></td></tr>)}</tbody></table>{!customers.length && <p className="p-8 text-center text-sm font-semibold text-slate-500">No customers found yet. Billing with mobile number or adding a CRM profile will show here.</p>}</div>
    </div>
  );

  const renderFollowups = () => (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div className="crm-card p-5"><h2 className="text-lg font-black">Create follow-up</h2><p className="mb-4 text-sm text-slate-500">Use for repeat purchase reminder, complaint callback, birthday offer, payment follow-up, or VIP visit.</p>{[["customer_name","Customer name"],["mobile","Mobile"],["title","Task title"],["due_date","Due date"],["purpose","Purpose"],["note","Note"]].map(([k,l]) => <div className="mb-3" key={k}><label className="crm-label">{l}</label>{k === "note" ? <textarea className="crm-input" value={followupDraft[k]} onChange={(e) => setFollowupDraft((d) => ({...d,[k]:e.target.value}))}/> : <input type={k === "due_date" ? "date" : "text"} className="crm-input" value={followupDraft[k]} onChange={(e) => setFollowupDraft((d) => ({...d,[k]:e.target.value}))}/>}</div>)}<button onClick={createFollowup} className="w-full rounded-2xl bg-teal-600 py-3 font-black text-white"><Send size={16} className="inline"/> Save follow-up</button></div>
      <div className="crm-card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="text-lg font-black">Follow-up queue</h2><p className="text-sm text-slate-500">Pending/Due customer work for CRM, store and marketing teams.</p></div><div className="divide-y divide-slate-100">{(data.followups || []).map((f) => <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="font-black">{f.title}</p><p className="text-sm text-slate-500">{f.customer_name || "Customer"} - {f.mobile || "No mobile"} - {f.channel} - Due {f.due_date || "not set"}</p><p className="text-xs text-slate-400">{f.note}</p></div><div className="flex gap-2"><span className={`rounded-full px-3 py-1 text-xs font-black ${f.status === "Done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{f.status}</span>{f.status !== "Done" && <button onClick={() => setFollowupStatus(f.id, "Done")} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Mark done</button>}</div></div>)}{!(data.followups || []).length && <p className="p-8 text-center text-sm text-slate-500">No follow-ups yet.</p>}</div></div>
    </div>
  );

  const renderFeedback = () => (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div className="crm-card p-5"><h2 className="text-lg font-black">Record feedback</h2><p className="mb-4 text-sm text-slate-500">Complaint, praise, WhatsApp reply, service issue or product request.</p>{[["customer_name","Customer name"],["mobile","Mobile"],["source","Source"]].map(([k,l]) => <div className="mb-3" key={k}><label className="crm-label">{l}</label><input className="crm-input" value={feedbackDraft[k]} onChange={(e) => setFeedbackDraft((d) => ({...d,[k]:e.target.value}))}/></div>)}<div className="mb-3"><label className="crm-label">Sentiment</label><select className="crm-input" value={feedbackDraft.sentiment} onChange={(e) => setFeedbackDraft((d) => ({...d,sentiment:e.target.value}))}><option>Positive</option><option>Neutral</option><option>Negative</option></select></div><div className="mb-3"><label className="crm-label">Note</label><textarea className="crm-input min-h-28" value={feedbackDraft.note} onChange={(e) => setFeedbackDraft((d) => ({...d,note:e.target.value}))}/></div><button onClick={createFeedback} className="w-full rounded-2xl bg-indigo-600 py-3 font-black text-white">Save feedback</button></div>
      <div className="crm-card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="text-lg font-black">Feedback log</h2></div><div className="divide-y divide-slate-100">{(data.feedback || []).map((f) => <div key={f.id} className="p-5"><div className="flex justify-between gap-3"><p className="font-black">{f.customer_name || "Customer"}</p><span className={`rounded-full px-3 py-1 text-xs font-black ${f.sentiment === "Positive" ? "bg-emerald-100 text-emerald-700" : f.sentiment === "Negative" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>{f.sentiment}</span></div><p className="mt-1 text-sm text-slate-500">{f.source} - {f.mobile}</p><p className="mt-2 text-sm text-slate-700">{f.note}</p></div>)}{!(data.feedback || []).length && <p className="p-8 text-center text-sm text-slate-500">No feedback logged yet.</p>}</div></div>
    </div>
  );

  const renderSegments = () => (
    <div className="crm-card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="text-lg font-black">Customer segments</h2><p className="text-sm text-slate-500">Use this to plan campaigns: VIP, repeat buyers, at-risk customers, birthday buyers, wholesale customers.</p></div><div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">{segmentRows.map((s) => <div key={s.segment} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-cyan-50 p-5"><p className="text-xs font-black uppercase tracking-widest text-teal-700">{s.segment}</p><p className="mt-3 text-3xl font-black">{s.customers}</p><p className="text-sm text-slate-500">customers - {s.bills} bills - {money(s.spend)}</p><button onClick={() => { setActive("customers"); setQuery(s.segment); }} className="mt-4 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">View customers</button></div>)}</div></div>
  );

  return (
    <div className="crm-shell">
      <style>{styles}</style>
      <div className="crm-layout flex min-h-screen">
        <aside className="crm-sidebar p-5 text-white">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl"><p className="text-xs font-black uppercase tracking-widest text-teal-200">RMS Growth</p><h1 className="mt-2 text-2xl font-black">Customer CRM</h1><p className="mt-2 text-sm text-teal-50/80">Profiles, loyalty signals, follow-ups and feedback in one customer view.</p></div>
          <nav className="mt-5 space-y-2">{tabs.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setActive(key)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-black transition ${active === key ? "bg-white text-slate-950 shadow-xl" : "bg-white/8 text-white hover:bg-white/14"}`}><Icon size={18}/><span>{label}</span></button>)}</nav>
          <button onClick={logoutOrReturnToDepartmentSelector} className="mt-6 w-full rounded-2xl bg-rose-600 px-4 py-3 font-black text-white">Logout</button>
        </aside>
        <main className="crm-main min-w-0 flex-1 p-6">
          <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-teal-700 via-cyan-700 to-indigo-700 p-6 text-white shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,.26),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(255,255,255,.18),transparent_28%)]" />
            <div className="relative flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-100">Retail customer relationship management</p><h1 className="mt-3 text-3xl font-black">Know who buys, follow up at the right time.</h1><p className="mt-2 max-w-3xl text-sm text-cyan-50/90">POS bills feed purchase history. CRM adds consent, tags, reminders, service notes and campaign-ready customer segments.</p></div><button onClick={load} className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"><RefreshCw size={16} className="inline"/> Refresh</button></div>
          </section>
          {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
          <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Stat label="Known customers" value={loading ? "..." : data.stats.customers || 0} helper="CRM + POS mobile records" icon={Users} color="bg-cyan-100 text-cyan-700" />
            <Stat label="Repeat customers" value={loading ? "..." : data.stats.repeat_customers || 0} helper="More than one bill" icon={Star} color="bg-amber-100 text-amber-700" />
            <Stat label="Customer sales" value={loading ? "..." : money(data.stats.total_spend)} helper="From POS bill history" icon={CircleDollarSign} color="bg-emerald-100 text-emerald-700" />
            <Stat label="Pending follow-ups" value={loading ? "..." : data.stats.pending_followups || 0} helper="Callbacks and reminders" icon={BellRing} color="bg-violet-100 text-violet-700" />
          </section>
          <section className="mt-5 rounded-3xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900"><Sparkles size={17} className="mr-2 inline"/><b>Workflow:</b> cashier captures customer mobile during billing to CRM profile/history to marketing segments to WhatsApp/SMS/email follow-up to customer feedback history.</section>
          <section className="mt-5">{active === "customers" && renderCustomers()}{active === "followups" && renderFollowups()}{active === "feedback" && renderFeedback()}{active === "segments" && renderSegments()}</section>
        </main>
      </div>
      {customerModal && <CustomerModal initial={customerModal.id ? customerModal : null} onClose={() => setCustomerModal(null)} onSave={saveCustomer} />}
    </div>
  );
}
