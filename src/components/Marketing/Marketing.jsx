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
  imc_goal: "",
  brand_message: "",
  whatsapp_message: "",
  email_message: "",
  sms_message: "",
  social_message: "",
  creative_checklist: "",
  approval_status: "Draft",
  budget_whatsapp: "",
  budget_email: "",
  budget_social: "",
  budget_instore: "",
};

const channels = ["WhatsApp", "Email", "SMS", "In-store", "Social", "Marketplace"];
const statuses = ["Draft", "Scheduled", "Active", "Paused", "Completed"];

const marketingStyles = `
  .marketing-shell { min-height: 100vh; color: #0f172a; background: #f8fafc; }
  .marketing-sidebar { width: 264px; background: #0f2a2e; }
  .marketing-nav { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); }
  .marketing-panel { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
  .marketing-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; }
  .marketing-input { width: 100%; border: 1px solid #e2e8f0; background: #ffffff; color: #0f172a; border-radius: 12px; padding: 11px 13px; font-size: 14px; outline: none; transition: .15s ease; }
  .marketing-input:focus { border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,.12); }
  .marketing-label { display:block; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
  .marketing-pill { border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 700; }
  @media (max-width: 900px) { .marketing-sidebar { width: 76px; } .marketing-hide-sm { display:none; } .marketing-main { padding-left: 16px; padding-right: 16px; } }
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

function StatCard({ label, value, helper, icon: Icon, emphasis = false }) {
  return (
    <div className="marketing-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${emphasis ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"}`}><Icon size={19} /></div>
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
  const [activeTab, setActiveTab] = useState("campaigns");
  const [redemptionFormFor, setRedemptionFormFor] = useState(null);
  const [redemptionDraft, setRedemptionDraft] = useState({ store_name: "", bill_no: "", customer_ref: "", amount: "", note: "" });

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

  const tabConfig = [
    { id: "campaigns", label: "Campaigns", icon: Megaphone, helper: "Create and manage offers" },
    { id: "imc", label: "IMC Planner", icon: Target, helper: "Integrated campaign plan" },
    { id: "calendar", label: "Offer calendar", icon: CalendarDays, helper: "See upcoming launches" },
    { id: "roi", label: "ROI tracker", icon: BarChart3, helper: "Log sales impact" },
  ];

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
        budget_whatsapp: Number(form.budget_whatsapp || 0),
        budget_email: Number(form.budget_email || 0),
        budget_social: Number(form.budget_social || 0),
        budget_instore: Number(form.budget_instore || 0),
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

  const submitRedemption = async (campaign) => {
    setError("");
    setSuccess("");
    setLoggingId(campaign.id);
    try {
      const res = await marketingFetch(`/api/marketing/campaigns/${campaign.id}/redemptions`, {
        method: "POST",
        body: JSON.stringify({
          ...redemptionDraft,
          amount: Number(redemptionDraft.amount || 0),
        }),
      });
      setSuccess(res.message || "Sales impact recorded.");
      setRedemptionFormFor(null);
      setRedemptionDraft({ store_name: "", bill_no: "", customer_ref: "", amount: "", note: "" });
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
      <aside className="marketing-sidebar sticky top-0 hidden h-screen shrink-0 flex-col p-4 text-white md:flex">
        <div className="marketing-nav rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Megaphone size={20} /></div>
            <div className="marketing-hide-sm">
              <p className="text-base font-black">RMS</p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-teal-200">Marketing</p>
            </div>
          </div>
          <div className="marketing-hide-sm mt-4 rounded-xl bg-white/5 p-3">
            <p className="text-sm font-bold">{adminName}</p>
            <p className="mt-0.5 text-xs text-teal-200">Campaign workspace</p>
          </div>
        </div>
        <nav className="mt-4 space-y-1.5">
          {tabConfig.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-bold transition ${activeTab === item.id ? "bg-white text-teal-900" : "text-teal-100 hover:bg-white/8"}`}
            >
              <item.icon size={17} /><span className="marketing-hide-sm">{item.label}</span>
            </button>
          ))}
        </nav>
        <button onClick={logoutOrReturnToDepartmentSelector} className="mt-auto flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-teal-100 hover:bg-white/8">
          <LogOut size={17} /><span className="marketing-hide-sm">Logout</span>
        </button>
      </aside>

      <main className="marketing-main min-w-0 flex-1 p-5 md:p-8">
        <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-xl font-black text-slate-900">Marketing</h1>
            <p className="mt-1 text-sm text-slate-500">Plan offers, run campaigns, and track sales impact tenant-wide.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"><RefreshCw size={15} /> Refresh</button>
          </div>
        </header>

        {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
        {success && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</div>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Campaigns" value={overview?.total_campaigns ?? 0} helper="All tenant campaigns" icon={Megaphone} emphasis />
          <StatCard label="Active now" value={overview?.active_campaigns ?? 0} helper={`${overview?.scheduled_campaigns ?? 0} scheduled next`} icon={CheckCircle2} emphasis />
          <StatCard label="Budget" value={formatMoney(overview?.total_budget)} helper="Planned spend" icon={Wallet} />
          <StatCard label="Tracked sales" value={formatMoney(overview?.redeemed_value)} helper={`${overview?.roi_hint ?? 0}% budget ROI hint`} icon={BarChart3} emphasis />
          <StatCard label="Reach" value={Math.round(overview?.engagement?.impressions ?? 0).toLocaleString("en-IN")} helper={`${Math.round(overview?.engagement?.clicks ?? 0).toLocaleString("en-IN")} clicks · ${Math.round(overview?.engagement?.shares ?? 0).toLocaleString("en-IN")} shares`} icon={Eye} />
          <StatCard label="Feedback" value={(overview?.feedback?.Positive ?? 0) + (overview?.feedback?.Negative ?? 0) + (overview?.feedback?.Neutral ?? 0)} helper={`${overview?.feedback?.Positive ?? 0} positive · ${overview?.feedback?.Negative ?? 0} negative`} icon={ThumbsUp} />
        </section>

        {activeTab === "campaigns" && <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
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
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon size={20} /></div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-black text-slate-900">{campaign.name}</h3>
                            <span className={`marketing-pill ${statusClass(campaign.status)}`}>{campaign.status}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{campaign.campaign_code} · {campaign.channel} · {campaign.objective || "Campaign objective not added"}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                            <span className="rounded-full bg-slate-100 px-3 py-1">Audience: {campaign.target_audience || "All customers"}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">Offer: {campaign.offer_type || "No offer"} {campaign.offer_value ? campaign.offer_value : ""}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">Budget: {formatMoney(campaign.budget)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {campaign.status !== "Active" && <button onClick={() => setStatus(campaign, "Active")} className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700">Activate</button>}
                        {campaign.status !== "Paused" && <button onClick={() => setStatus(campaign, "Paused")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"><PauseCircle size={13} className="inline -mt-0.5" /> Pause</button>}
                        {campaign.status !== "Completed" && <button onClick={() => setStatus(campaign, "Completed")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Complete</button>}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"><Eye size={13} /> {Math.round(campaign.engagement?.impressions || 0).toLocaleString("en-IN")}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"><MousePointerClick size={13} /> {Math.round(campaign.engagement?.clicks || 0).toLocaleString("en-IN")}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"><Share2 size={13} /> {Math.round(campaign.engagement?.shares || 0).toLocaleString("en-IN")}</span>
                      <button onClick={() => { setEngagementFormFor(engagementFormFor === campaign.id ? null : campaign.id); setFeedbackFormFor(null); }} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"><Plus size={13} /> Log reach</button>

                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><ThumbsUp size={13} /> {campaign.feedback?.Positive || 0}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700"><ThumbsDown size={13} /> {campaign.feedback?.Negative || 0}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"><MinusCircle size={13} /> {campaign.feedback?.Neutral || 0}</span>
                      <button onClick={() => { setFeedbackFormFor(feedbackFormFor === campaign.id ? null : campaign.id); setEngagementFormFor(null); }} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"><Plus size={13} /> Log feedback</button>
                    </div>

                    {engagementFormFor === campaign.id && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-bold text-slate-700">Log reach for this campaign</p>
                          <button onClick={() => setEngagementFormFor(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div><label className="marketing-label">Impressions</label><input type="number" min="0" className="marketing-input" value={engagementDraft.impressions} onChange={(e) => setEngagementDraft((d) => ({ ...d, impressions: e.target.value }))} placeholder="0" /></div>
                          <div><label className="marketing-label">Clicks</label><input type="number" min="0" className="marketing-input" value={engagementDraft.clicks} onChange={(e) => setEngagementDraft((d) => ({ ...d, clicks: e.target.value }))} placeholder="0" /></div>
                          <div><label className="marketing-label">Shares</label><input type="number" min="0" className="marketing-input" value={engagementDraft.shares} onChange={(e) => setEngagementDraft((d) => ({ ...d, shares: e.target.value }))} placeholder="0" /></div>
                        </div>
                        <div className="mt-3"><label className="marketing-label">Source</label><input className="marketing-input" value={engagementDraft.source} onChange={(e) => setEngagementDraft((d) => ({ ...d, source: e.target.value }))} placeholder="e.g. WhatsApp Business report, social insights" /></div>
                        <button onClick={() => submitEngagement(campaign)} disabled={loggingId === campaign.id} className="mt-3 rounded-lg bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">{loggingId === campaign.id ? "Saving..." : "Save reach"}</button>
                      </div>
                    )}

                    {feedbackFormFor === campaign.id && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-bold text-slate-700">Log feedback for this campaign</p>
                          <button onClick={() => setFeedbackFormFor(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
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
                        <button onClick={() => submitFeedback(campaign)} disabled={loggingId === campaign.id} className="mt-3 rounded-lg bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">{loggingId === campaign.id ? "Saving..." : "Save feedback"}</button>
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
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Send size={18} /></div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Create campaign</h2>
                  <p className="text-xs text-slate-500">Keep it simple first; automation hooks come later.</p>
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

                <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">
                  <p className="text-sm font-black text-teal-900">IMC planner</p>
                  <p className="mt-1 text-xs text-teal-700">Keep all customer communication consistent across WhatsApp, email, SMS, social and store floor.</p>
                  <div className="mt-4 space-y-3">
                    <div><label className="marketing-label">IMC goal</label><input className="marketing-input" value={form.imc_goal} onChange={(e) => updateForm("imc_goal", e.target.value)} placeholder="e.g. Drive Puja ethnicwear walk-ins and repeat purchases" /></div>
                    <div><label className="marketing-label">Core brand message</label><textarea className="marketing-input min-h-[70px]" value={form.brand_message} onChange={(e) => updateForm("brand_message", e.target.value)} placeholder="One clear message customers should remember" /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><label className="marketing-label">WhatsApp copy</label><textarea className="marketing-input min-h-[64px]" value={form.whatsapp_message} onChange={(e) => updateForm("whatsapp_message", e.target.value)} placeholder="Short broadcast or catalogue message" /></div>
                      <div><label className="marketing-label">Email copy</label><textarea className="marketing-input min-h-[64px]" value={form.email_message} onChange={(e) => updateForm("email_message", e.target.value)} placeholder="Subject/body idea" /></div>
                      <div><label className="marketing-label">SMS copy</label><textarea className="marketing-input min-h-[64px]" value={form.sms_message} onChange={(e) => updateForm("sms_message", e.target.value)} placeholder="Very short offer text" /></div>
                      <div><label className="marketing-label">Social/In-store copy</label><textarea className="marketing-input min-h-[64px]" value={form.social_message} onChange={(e) => updateForm("social_message", e.target.value)} placeholder="Poster/reel/floor talking point" /></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div><label className="marketing-label">WA budget</label><input type="number" min="0" className="marketing-input" value={form.budget_whatsapp} onChange={(e) => updateForm("budget_whatsapp", e.target.value)} placeholder="0" /></div>
                      <div><label className="marketing-label">Email budget</label><input type="number" min="0" className="marketing-input" value={form.budget_email} onChange={(e) => updateForm("budget_email", e.target.value)} placeholder="0" /></div>
                      <div><label className="marketing-label">Social budget</label><input type="number" min="0" className="marketing-input" value={form.budget_social} onChange={(e) => updateForm("budget_social", e.target.value)} placeholder="0" /></div>
                      <div><label className="marketing-label">Store budget</label><input type="number" min="0" className="marketing-input" value={form.budget_instore} onChange={(e) => updateForm("budget_instore", e.target.value)} placeholder="0" /></div>
                    </div>
                    <div><label className="marketing-label">Creative checklist</label><textarea className="marketing-input min-h-[64px]" value={form.creative_checklist} onChange={(e) => updateForm("creative_checklist", e.target.value)} placeholder="Banner, product photos, coupon code, staff script, landing/catalogue link" /></div>
                    <div><label className="marketing-label">Approval status</label><select className="marketing-input" value={form.approval_status} onChange={(e) => updateForm("approval_status", e.target.value)}>{["Draft", "Needs approval", "Approved", "Changes needed"].map((s) => <option key={s}>{s}</option>)}</select></div>
                  </div>
                </div>

                <div><label className="marketing-label">Notes</label><textarea className="marketing-input min-h-[88px]" value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Creative, coupon code, approval notes, WhatsApp copy..." /></div>
                <button disabled={saving} className="w-full rounded-xl bg-teal-600 px-4 py-3 font-bold text-white hover:bg-teal-700 disabled:opacity-60">{saving ? "Saving..." : "Save campaign"}</button>
              </div>
            </form>

            <div className="marketing-panel p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500"><CalendarDays size={17} /></div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">Upcoming launch queue</h2>
                  <p className="text-xs text-slate-500">Next active/scheduled/draft campaigns.</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {filteredUpcoming.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">No upcoming campaigns yet.</p> : filteredUpcoming.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.start_date || "No start date"} to {item.end_date || "Open end"}</p>
                      </div>
                      <span className={`marketing-pill ${statusClass(item.status)}`}>{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>}

        {activeTab === "imc" && (
          <section className="marketing-panel mt-6 overflow-hidden">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-black text-slate-900">IMC Planner</h2>
              <p className="text-sm text-slate-500">Integrated Marketing Communication keeps one offer/message consistent across WhatsApp, email, SMS, social and store staff.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {campaigns.length === 0 ? (
                <div className="p-8 text-center font-bold text-slate-500">Create a campaign first, then its IMC plan will show here.</div>
              ) : campaigns.map((campaign) => {
                const messages = campaign.channel_messages || {};
                const split = campaign.budget_split || {};
                return (
                  <div key={campaign.id} className="p-5">
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-slate-900">{campaign.name}</p>
                          <span className={`marketing-pill ${statusClass(campaign.approval_status || "Draft")}`}>{campaign.approval_status || "Draft"}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">Goal: {campaign.imc_goal || campaign.objective || "Not added"}</p>
                      </div>
                      <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">{campaign.channel}</span>
                    </div>
                    <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Core message</p>
                        <p className="mt-2 text-sm text-slate-700">{campaign.brand_message || "No brand message added yet."}</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg bg-white p-3"><p className="text-xs font-bold text-slate-500">WhatsApp</p><p className="mt-1 text-sm text-slate-700">{messages.whatsapp || "Not planned"}</p></div>
                          <div className="rounded-lg bg-white p-3"><p className="text-xs font-bold text-slate-500">Email</p><p className="mt-1 text-sm text-slate-700">{messages.email || "Not planned"}</p></div>
                          <div className="rounded-lg bg-white p-3"><p className="text-xs font-bold text-slate-500">SMS</p><p className="mt-1 text-sm text-slate-700">{messages.sms || "Not planned"}</p></div>
                          <div className="rounded-lg bg-white p-3"><p className="text-xs font-bold text-slate-500">Social/In-store</p><p className="mt-1 text-sm text-slate-700">{messages.social || "Not planned"}</p></div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Budget split</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">WhatsApp</p><p className="font-black">{formatMoney(split.whatsapp)}</p></div>
                          <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Email</p><p className="font-black">{formatMoney(split.email)}</p></div>
                          <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Social</p><p className="font-black">{formatMoney(split.social)}</p></div>
                          <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Store</p><p className="font-black">{formatMoney(split.instore)}</p></div>
                        </div>
                        <div className="mt-4 rounded-lg bg-amber-50 p-3">
                          <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Creative checklist</p>
                          <p className="mt-1 text-sm text-amber-900">{campaign.creative_checklist || "Add banner, catalogue link, coupon code, staff script and product creatives."}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "calendar" && (
          <section className="marketing-panel mt-6 p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><CalendarDays size={19} /></div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Offer calendar</h2>
                <p className="text-sm text-slate-500">A launch queue for campaign dates, store execution and status follow-up.</p>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredUpcoming.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center font-bold text-slate-500">No dated campaigns yet. Create a campaign with start/end dates first.</div>
              ) : filteredUpcoming.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-slate-900">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.start_date || "No start date"} to {item.end_date || "Open end"}</p>
                      <p className="mt-2 text-sm text-slate-600">{item.channel} · {item.target_audience || "All customers"}</p>
                    </div>
                    <span className={`marketing-pill ${statusClass(item.status)}`}>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "roi" && (
          <section className="marketing-panel mt-6 overflow-hidden">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-black text-slate-900">ROI and redemption tracker</h2>
              <p className="text-sm text-slate-500">Record campaign-wise bill value manually now; later POS coupon validation can automate this.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {campaigns.length === 0 ? <div className="p-8 text-center font-bold text-slate-500">Create campaigns first, then log sales impact here.</div> : campaigns.map((campaign) => (
                <div key={campaign.id} className="p-5">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div>
                      <p className="font-black text-slate-900">{campaign.name}</p>
                      <p className="text-sm text-slate-500">Budget {formatMoney(campaign.budget)} · {campaign.channel} · {campaign.status}</p>
                    </div>
                    <button onClick={() => setRedemptionFormFor(redemptionFormFor === campaign.id ? null : campaign.id)} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700">Log sale/redemption</button>
                  </div>
                  {redemptionFormFor === campaign.id && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <input className="marketing-input" placeholder="Store name" value={redemptionDraft.store_name} onChange={(e) => setRedemptionDraft((d) => ({ ...d, store_name: e.target.value }))} />
                        <input className="marketing-input" placeholder="Bill no." value={redemptionDraft.bill_no} onChange={(e) => setRedemptionDraft((d) => ({ ...d, bill_no: e.target.value }))} />
                        <input className="marketing-input" placeholder="Customer ref optional" value={redemptionDraft.customer_ref} onChange={(e) => setRedemptionDraft((d) => ({ ...d, customer_ref: e.target.value }))} />
                        <input type="number" min="0" className="marketing-input" placeholder="Sale amount" value={redemptionDraft.amount} onChange={(e) => setRedemptionDraft((d) => ({ ...d, amount: e.target.value }))} />
                        <input className="marketing-input md:col-span-2" placeholder="Note optional" value={redemptionDraft.note} onChange={(e) => setRedemptionDraft((d) => ({ ...d, note: e.target.value }))} />
                      </div>
                      <button onClick={() => submitRedemption(campaign)} disabled={loggingId === campaign.id} className="mt-3 rounded-lg bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">{loggingId === campaign.id ? "Saving..." : "Save sale impact"}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="marketing-panel mt-6 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500"><Target size={18} /></div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Real-world flow this module supports</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Marketing plans campaign to select audience/channel/offer, schedule launch, run the promotion in stores, then record sales/redemption impact. Later we can connect WhatsApp templates, coupon validation at POS, and campaign-wise sales attribution.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
