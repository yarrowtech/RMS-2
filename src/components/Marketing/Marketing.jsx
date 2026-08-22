import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Eye,
  LogOut,
  Mail,
  Megaphone,
  MessageCircle,
  MinusCircle,
  MousePointerClick,
  PauseCircle,
  Plus,
  RefreshCw,
  Send,
  Share2,
  Smartphone,
  Store,
  Target,
  ThumbsDown,
  ThumbsUp,
  Wallet,
  X,
} from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";
import { getAdminName, logoutOrReturnToDepartmentSelector } from "../../utils/authRedirect.js";

function token() {
  return localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

async function marketingFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Marketing request failed.");
  return data;
}

const emptyForm = {
  name: "",
  channel: "WhatsApp",
  objective: "",
  status: "Draft",
  start_date: "",
  end_date: "",
  budget: "",
  target_audience: "",
  target_stores: "",
  offer_type: "",
  offer_value: "",
  notes: "",
};

const channels = ["WhatsApp", "Email", "SMS", "In-store", "Social", "Marketplace"];
const statuses = ["Draft", "Scheduled", "Active", "Paused", "Completed"];

const marketingStyles = `
  .marketing-shell { min-height: 100vh; color: #102033; background: radial-gradient(circle at 85% -8%, rgba(45,212,191,.22), transparent 34rem), radial-gradient(circle at 20% 0%, rgba(59,130,246,.14), transparent 30rem), #f4f8fb; }
  .marketing-sidebar { width: 286px; background: linear-gradient(165deg, #062b3a 0%, #0f766e 57%, #14532d 140%); box-shadow: 18px 0 44px rgba(15,23,42,.14); }
  .marketing-nav { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); }
  .marketing-panel { background: rgba(255,255,255,.92); border: 1px solid #dfe8f2; border-radius: 24px; box-shadow: 0 18px 48px rgba(15,23,42,.08); }
  .marketing-card { background: rgba(255,255,255,.94); border: 1px solid #e2e8f0; border-radius: 20px; box-shadow: 0 14px 32px rgba(15,23,42,.06); }
  .marketing-input { width: 100%; border: 1px solid #d7e2ee; background: #fbfdff; color: #102033; border-radius: 14px; padding: 12px 14px; font-size: 14px; outline: none; transition: .18s ease; }
  .marketing-input:focus { border-color: #14b8a6; box-shadow: 0 0 0 4px rgba(20,184,166,.14); }
  .marketing-label { display:block; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #64748b; margin-bottom: 7px; }
  .marketing-pill { border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 800; }
  @media (max-width: 900px) { .marketing-sidebar { width: 78px; } .marketing-hide-sm { display:none; } .marketing-main { padding-left: 16px; padding-right: 16px; } }
`;

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function statusClass(status) {
  return {
    Draft: "bg-slate-100 text-slate-700",
    Scheduled: "bg-blue-100 text-blue-700",
    Active: "bg-emerald-100 text-emerald-700",
    Paused: "bg-amber-100 text-amber-700",
    Completed: "bg-violet-100 text-violet-700",
  }[status] || "bg-slate-100 text-slate-700";
}

function channelIcon(channel) {
  if (channel === "WhatsApp") return MessageCircle;
  if (channel === "Email") return Mail;
  if (channel === "SMS") return Smartphone;
  if (channel === "In-store") return Store;
  return Megaphone;
}

function StatCard({ label, value, helper, icon: Icon, tone }) {
  return (
    <div className="marketing-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{helper}</p>
        </div>
        <div className={`rounded-2xl p-3 ${tone}`}><Icon size={22} /></div>
      </div>
    </div>
  );
}

export default function Marketing() {
  const [overview, setOverview] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [engagementFormFor, setEngagementFormFor] = useState(null);
  const [feedbackFormFor, setFeedbackFormFor] = useState(null);
  const [engagementDraft, setEngagementDraft] = useState({ impressions: "", clicks: "", shares: "", source: "" });
  const [feedbackDraft, setFeedbackDraft] = useState({ sentiment: "Positive", source: "", comment: "" });
  const [loggingId, setLoggingId] = useState("");

  const adminName = getAdminName() || "Marketing team";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewRes, campaignRes] = await Promise.all([
        marketingFetch("/api/marketing/overview"),
        marketingFetch(`/api/marketing/campaigns?status=${encodeURIComponent(statusFilter)}`),
      ]);
      setOverview(overviewRes.data || {});
      setCampaigns(campaignRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filteredUpcoming = useMemo(() => overview?.upcoming || [], [overview]);

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const saveCampaign = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!form.name.trim()) return setError("Add a campaign name first.");
    setSaving(true);
    try {
      const payload = {
        ...form,
        budget: Number(form.budget || 0),
        offer_value: Number(form.offer_value || 0),
        target_stores: form.target_stores.split(",").map((x) => x.trim()).filter(Boolean),
      };
      const res = await marketingFetch("/api/marketing/campaigns", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSuccess(res.message || "Campaign saved.");
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (campaign, status) => {
    setError("");
    setSuccess("");
    try {
      const res = await marketingFetch(`/api/marketing/campaigns/${campaign.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setSuccess(res.message || "Status updated.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const submitEngagement = async (campaign) => {
    setError(""); setSuccess(""); setLoggingId(campaign.id);
    try {
      const res = await marketingFetch(`/api/marketing/campaigns/${campaign.id}/engagement`, {
        method: "POST",
        body: JSON.stringify({
          impressions: Number(engagementDraft.impressions || 0),
          clicks: Number(engagementDraft.clicks || 0),
          shares: Number(engagementDraft.shares || 0),
          source: engagementDraft.source,
        }),
      });
      setSuccess(res.message || "Engagement logged.");
      setEngagementFormFor(null);
      setEngagementDraft({ impressions: "", clicks: "", shares: "", source: "" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoggingId("");
    }
  };

  const submitFeedback = async (campaign) => {
    setError(""); setSuccess(""); setLoggingId(campaign.id);
    try {
      const res = await marketingFetch(`/api/marketing/campaigns/${campaign.id}/feedback`, {
        method: "POST",
        body: JSON.stringify(feedbackDraft),
      });
      setSuccess(res.message || "Feedback logged.");
      setFeedbackFormFor(null);
      setFeedbackDraft({ sentiment: "Positive", source: "", comment: "" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoggingId("");
    }
  };

  return (
    <div className="marketing-shell flex min-h-screen">
      <style>{marketingStyles}</style>
      <aside className="marketing-sidebar sticky top-0 hidden h-screen shrink-0 flex-col p-5 text-white md:flex">
        <div className="marketing-nav rounded-3xl p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/12"><Megaphone size={24} /></div>
            <div className="marketing-hide-sm">
              <p className="text-xl font-black">RMS</p>
              <p className="text-xs font-bold uppercase tracking-widest text-teal-100">Marketing</p>
            </div>
          </div>
          <div className="marketing-hide-sm mt-6 rounded-2xl bg-white/10 p-4">
            <p className="font-black">Welcome, {adminName}</p>
            <p className="mt-1 text-sm text-teal-50">Campaign workspace ready.</p>
          </div>
        </div>
        <nav className="mt-6 space-y-3">
          {[{ label: "Campaigns", icon: Megaphone }, { label: "Offer calendar", icon: CalendarDays }, { label: "ROI tracker", icon: BarChart3 }].map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 font-bold text-teal-50">
              <item.icon size={18} /><span className="marketing-hide-sm">{item.label}</span>
            </div>
          ))}
        </nav>
        <button onClick={logoutOrReturnToDepartmentSelector} className="mt-auto flex items-center justify-center gap-2 rounded-2xl border border-rose-200/20 bg-rose-500/12 px-4 py-3 font-black text-rose-50 hover:bg-rose-500/20">
          <LogOut size={18} /><span className="marketing-hide-sm">Logout</span>
        </button>
      </aside>

      <main className="marketing-main min-w-0 flex-1 p-5 md:p-8">
        <header className="marketing-panel mb-6 flex flex-col justify-between gap-4 p-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-blue-600 text-white shadow-lg shadow-teal-500/20"><Megaphone size={26} /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.26em] text-teal-600">Growth operations</p>
              <h1 className="text-2xl font-black text-slate-950 md:text-3xl">Marketing Department</h1>
              <p className="mt-1 text-sm text-slate-600">Plan offers, run campaigns, and track sales impact tenant-wise.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={load} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black text-slate-700 shadow-sm hover:bg-slate-50"><RefreshCw size={17} /> Refresh</button>
          </div>
        </header>

        {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
        {success && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</div>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Campaigns" value={overview?.total_campaigns ?? 0} helper="All tenant campaigns" icon={Megaphone} tone="bg-teal-50 text-teal-600" />
          <StatCard label="Active now" value={overview?.active_campaigns ?? 0} helper={`${overview?.scheduled_campaigns ?? 0} scheduled next`} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
          <StatCard label="Budget" value={formatMoney(overview?.total_budget)} helper="Planned spend" icon={Wallet} tone="bg-blue-50 text-blue-600" />
          <StatCard label="Tracked sales" value={formatMoney(overview?.redeemed_value)} helper={`${overview?.roi_hint ?? 0}% budget ROI hint`} icon={BarChart3} tone="bg-violet-50 text-violet-600" />
          <StatCard label="Reach" value={Math.round(overview?.engagement?.impressions ?? 0).toLocaleString("en-IN")} helper={`${Math.round(overview?.engagement?.clicks ?? 0).toLocaleString("en-IN")} clicks · ${Math.round(overview?.engagement?.shares ?? 0).toLocaleString("en-IN")} shares`} icon={Eye} tone="bg-sky-50 text-sky-600" />
          <StatCard label="Feedback" value={(overview?.feedback?.Positive ?? 0) + (overview?.feedback?.Negative ?? 0) + (overview?.feedback?.Neutral ?? 0)} helper={`${overview?.feedback?.Positive ?? 0} positive · ${overview?.feedback?.Negative ?? 0} negative`} icon={ThumbsUp} tone="bg-rose-50 text-rose-600" />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <div className="marketing-panel overflow-hidden">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-black text-slate-950">Campaign board</h2>
                <p className="text-sm text-slate-500">Use this as the central list before WhatsApp/email automation is connected.</p>
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="marketing-input max-w-[190px]">
                {["All", ...statuses].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="p-10 text-center font-bold text-slate-500">Loading campaigns...</div>
              ) : campaigns.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-600"><Plus /></div>
                  <p className="mt-4 font-black text-slate-800">No campaigns yet</p>
                  <p className="text-sm text-slate-500">Create your first offer, launch plan, or store promotion.</p>
                </div>
              ) : campaigns.map((campaign) => {
                const Icon = channelIcon(campaign.channel);
                return (
                  <div key={campaign.id} className="p-5 hover:bg-slate-50/70">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex gap-4">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-100 to-blue-100 text-teal-700"><Icon size={22} /></div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black text-slate-950">{campaign.name}</h3>
                            <span className={`marketing-pill ${statusClass(campaign.status)}`}>{campaign.status}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{campaign.campaign_code} ? {campaign.channel} ? {campaign.objective || "Campaign objective not added"}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                            <span className="rounded-full bg-slate-100 px-3 py-1">Audience: {campaign.target_audience || "All customers"}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">Offer: {campaign.offer_type || "No offer"} {campaign.offer_value ? campaign.offer_value : ""}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">Budget: {formatMoney(campaign.budget)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {campaign.status !== "Active" && <button onClick={() => setStatus(campaign, "Active")} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white">Activate</button>}
                        {campaign.status !== "Paused" && <button onClick={() => setStatus(campaign, "Paused")} className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-black text-amber-700"><PauseCircle size={15} className="inline" /> Pause</button>}
                        {campaign.status !== "Completed" && <button onClick={() => setStatus(campaign, "Completed")} className="rounded-xl bg-violet-100 px-3 py-2 text-sm font-black text-violet-700">Complete</button>}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700"><Eye size={13} /> {Math.round(campaign.engagement?.impressions || 0).toLocaleString("en-IN")}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700"><MousePointerClick size={13} /> {Math.round(campaign.engagement?.clicks || 0).toLocaleString("en-IN")}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700"><Share2 size={13} /> {Math.round(campaign.engagement?.shares || 0).toLocaleString("en-IN")}</span>
                      <button onClick={() => { setEngagementFormFor(engagementFormFor === campaign.id ? null : campaign.id); setFeedbackFormFor(null); }} className="inline-flex items-center gap-1 rounded-full border border-sky-200 px-3 py-1 text-xs font-black text-sky-700 hover:bg-sky-50"><Plus size={13} /> Log reach</button>

                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><ThumbsUp size={13} /> {campaign.feedback?.Positive || 0}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700"><ThumbsDown size={13} /> {campaign.feedback?.Negative || 0}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"><MinusCircle size={13} /> {campaign.feedback?.Neutral || 0}</span>
                      <button onClick={() => { setFeedbackFormFor(feedbackFormFor === campaign.id ? null : campaign.id); setEngagementFormFor(null); }} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 px-3 py-1 text-xs font-black text-emerald-700 hover:bg-emerald-50"><Plus size={13} /> Log feedback</button>
                    </div>

                    {engagementFormFor === campaign.id && (
                      <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-black text-sky-900">Log reach for this campaign</p>
                          <button onClick={() => setEngagementFormFor(null)} className="text-sky-500 hover:text-sky-700"><X size={16} /></button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div><label className="marketing-label">Impressions</label><input type="number" min="0" className="marketing-input" value={engagementDraft.impressions} onChange={(e) => setEngagementDraft((d) => ({ ...d, impressions: e.target.value }))} placeholder="0" /></div>
                          <div><label className="marketing-label">Clicks</label><input type="number" min="0" className="marketing-input" value={engagementDraft.clicks} onChange={(e) => setEngagementDraft((d) => ({ ...d, clicks: e.target.value }))} placeholder="0" /></div>
                          <div><label className="marketing-label">Shares</label><input type="number" min="0" className="marketing-input" value={engagementDraft.shares} onChange={(e) => setEngagementDraft((d) => ({ ...d, shares: e.target.value }))} placeholder="0" /></div>
                        </div>
                        <div className="mt-3"><label className="marketing-label">Source</label><input className="marketing-input" value={engagementDraft.source} onChange={(e) => setEngagementDraft((d) => ({ ...d, source: e.target.value }))} placeholder="e.g. WhatsApp Business report, social insights" /></div>
                        <button onClick={() => submitEngagement(campaign)} disabled={loggingId === campaign.id} className="mt-3 rounded-xl bg-sky-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{loggingId === campaign.id ? "Saving..." : "Save reach"}</button>
                      </div>
                    )}

                    {feedbackFormFor === campaign.id && (
                      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-black text-emerald-900">Log feedback for this campaign</p>
                          <button onClick={() => setFeedbackFormFor(null)} className="text-emerald-500 hover:text-emerald-700"><X size={16} /></button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="marketing-label">Sentiment</label>
                            <select className="marketing-input" value={feedbackDraft.sentiment} onChange={(e) => setFeedbackDraft((d) => ({ ...d, sentiment: e.target.value }))}>
                              {["Positive", "Negative", "Neutral"].map((s) => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                          <div><label className="marketing-label">Source</label><input className="marketing-input" value={feedbackDraft.source} onChange={(e) => setFeedbackDraft((d) => ({ ...d, source: e.target.value }))} placeholder="e.g. Customer call, WhatsApp reply, in-store" /></div>
                        </div>
                        <div className="mt-3"><label className="marketing-label">Comment</label><textarea className="marketing-input min-h-[70px]" value={feedbackDraft.comment} onChange={(e) => setFeedbackDraft((d) => ({ ...d, comment: e.target.value }))} placeholder="What did they say?" /></div>
                        <button onClick={() => submitFeedback(campaign)} disabled={loggingId === campaign.id} className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{loggingId === campaign.id ? "Saving..." : "Save feedback"}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <form onSubmit={saveCampaign} className="marketing-panel p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-50 text-teal-600"><Send size={20} /></div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Create campaign</h2>
                  <p className="text-sm text-slate-500">Keep it simple first; automation hooks come later.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div><label className="marketing-label">Campaign name</label><input className="marketing-input" value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="e.g. Durga Puja WhatsApp offer" /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="marketing-label">Channel</label><select className="marketing-input" value={form.channel} onChange={(e) => updateForm("channel", e.target.value)}>{channels.map((c) => <option key={c}>{c}</option>)}</select></div>
                  <div><label className="marketing-label">Status</label><select className="marketing-input" value={form.status} onChange={(e) => updateForm("status", e.target.value)}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
                </div>
                <div><label className="marketing-label">Objective</label><input className="marketing-input" value={form.objective} onChange={(e) => updateForm("objective", e.target.value)} placeholder="New launch, clearance, festival, loyalty win-back..." /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="marketing-label">Start date</label><input type="date" className="marketing-input" value={form.start_date} onChange={(e) => updateForm("start_date", e.target.value)} /></div>
                  <div><label className="marketing-label">End date</label><input type="date" className="marketing-input" value={form.end_date} onChange={(e) => updateForm("end_date", e.target.value)} /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="marketing-label">Budget</label><input type="number" min="0" className="marketing-input" value={form.budget} onChange={(e) => updateForm("budget", e.target.value)} placeholder="0" /></div>
                  <div><label className="marketing-label">Offer value</label><input type="number" min="0" className="marketing-input" value={form.offer_value} onChange={(e) => updateForm("offer_value", e.target.value)} placeholder="0" /></div>
                </div>
                <div><label className="marketing-label">Offer type</label><input className="marketing-input" value={form.offer_type} onChange={(e) => updateForm("offer_type", e.target.value)} placeholder="Flat discount, percentage, bundle, freebie..." /></div>
                <div><label className="marketing-label">Audience</label><input className="marketing-input" value={form.target_audience} onChange={(e) => updateForm("target_audience", e.target.value)} placeholder="Women ethnic buyers, dormant customers, high ATV shoppers..." /></div>
                <div><label className="marketing-label">Target stores</label><input className="marketing-input" value={form.target_stores} onChange={(e) => updateForm("target_stores", e.target.value)} placeholder="Comma separated store names, optional" /></div>
                <div><label className="marketing-label">Notes</label><textarea className="marketing-input min-h-[88px]" value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Creative, coupon code, approval notes, WhatsApp copy..." /></div>
                <button disabled={saving} className="w-full rounded-2xl bg-gradient-to-r from-teal-600 to-blue-600 px-4 py-3 font-black text-white shadow-lg shadow-teal-500/20 disabled:opacity-60">{saving ? "Saving..." : "Save campaign"}</button>
              </div>
            </form>

            <div className="marketing-panel p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-600"><CalendarDays size={19} /></div>
                <div>
                  <h2 className="font-black text-slate-950">Upcoming launch queue</h2>
                  <p className="text-sm text-slate-500">Next active/scheduled/draft campaigns.</p>
                </div>
              </div>
              <div className="space-y-3">
                {filteredUpcoming.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">No upcoming campaigns yet.</p> : filteredUpcoming.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-900">{item.name}</p>
                        <p className="text-xs font-bold text-slate-500">{item.start_date || "No start date"} ? {item.end_date || "Open end"}</p>
                      </div>
                      <span className={`marketing-pill ${statusClass(item.status)}`}>{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-panel mt-6 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Target /></div>
            <div>
              <h2 className="text-lg font-black text-slate-950">Real-world flow this module supports</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Marketing plans campaign ? selects audience/channel/offer ? schedules launch ? stores run the promotion ? sales/redemption impact is recorded. Later we can connect WhatsApp templates, coupon validation at POS, and campaign-wise sales attribution.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
