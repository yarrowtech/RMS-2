import React, { useCallback, useEffect, useState } from "react";
import { ArrowUpCircle, Building2, CheckCircle2, ChevronDown, ChevronUp, CircleHelp, FileText, Loader2, MessageCircle, Plus, RefreshCw, Send, Paperclip, ExternalLink, X } from "lucide-react";
import { API_BASE_URL } from "../config/api.js";

const CATEGORIES = [
  ["access", "Access or login"], ["users", "Users or permissions"], ["billing", "Billing or subscription"],
  ["inventory", "Inventory or receiving"], ["purchasing", "Purchasing or vendor"], ["finance", "Finance or invoice"],
  ["pos", "POS or sales"], ["hr", "HR or staff"], ["integrations", "Integration"], ["technical", "Technical issue"], ["other", "Other"],
];
const TONES = {
  open: "bg-sky-100 text-sky-700", in_progress: "bg-amber-100 text-amber-700",
  waiting_on_rms: "bg-orange-100 text-orange-700", waiting_on_requester: "bg-violet-100 text-violet-700",
  resolved: "bg-emerald-100 text-emerald-700", closed: "bg-slate-100 text-slate-600",
};
const title = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const stamp = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";
const token = () => localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";

async function call(path, options = {}) {
  const response = await fetch(API_BASE_URL + "/api/support/retailer" + path, {
    ...options,
    headers: { Authorization: "Bearer " + token(), ...(options.body ? { "Content-Type": "application/json" } : {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Support request could not be completed.");
  return data;
}

export default function RetailerHelpSupport() {
  const [tickets, setTickets] = useState([]);
  const [workspace, setWorkspace] = useState({});
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [expanded, setExpanded] = useState("");
  const [replyFor, setReplyFor] = useState("");
  const [reply, setReply] = useState("");
  const [form, setForm] = useState({ category: "technical", subject: "", description: "", attachment_url: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentName, setAttachmentName] = useState("");
  const [escalating, setEscalating] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await call("/tickets");
      setTickets(Array.isArray(result.data) ? result.data : []);
      setWorkspace(result.workspace || {});
      setCanManage(Boolean(result.can_manage_tenant_tickets));
    } catch (err) { setError(err.message || "Could not load support tickets."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const result = await call("/tickets", { method: "POST", body: JSON.stringify(form) });
      setTickets((rows) => [result.data, ...rows]);
      setForm({ category: "technical", subject: "", description: "", attachment_url: "" }); setAttachmentName("");
      setOpenForm(false); setExpanded(result.data.id);
      setNotice("Your ticket was submitted. RMS support will reply in this private thread.");
    } catch (err) { setError(err.message || "Could not submit your ticket."); }
    finally { setSaving(false); }
  };

  const uploadAttachment = async (file) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) { setError("Attach a JPG, PNG, WEBP or PDF file."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Attachments must be 10 MB or smaller."); return; }
    setUploading(true); setError("");
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch(API_BASE_URL + "/api/support/retailer/attachments", { method: "POST", headers: { Authorization: "Bearer " + token() }, body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not upload attachment.");
      setForm((value) => ({ ...value, attachment_url: data.url })); setAttachmentName(data.name || file.name);
    } catch (err) { setError(err.message || "Could not upload attachment."); }
    finally { setUploading(false); }
  };
  const sendReply = async (ticketId) => {
    if (!reply.trim()) return;
    setSaving(true); setError("");
    try {
      const result = await call("/tickets/" + ticketId + "/reply", { method: "POST", body: JSON.stringify({ message: reply }) });
      setTickets((rows) => rows.map((item) => item.id === ticketId ? result.data : item));
      setReply(""); setReplyFor(""); setNotice("Your reply was sent to RMS support.");
    } catch (err) { setError(err.message || "Could not send your reply."); }
    finally { setSaving(false); }
  };

  const escalate = async (ticketId) => {
    setEscalating(ticketId); setError("");
    try {
      const result = await call("/tickets/" + ticketId + "/escalate", { method: "POST" });
      setTickets((rows) => rows.map((item) => item.id === ticketId ? result.data : item));
      setNotice("Ticket escalated to Super Admin.");
    } catch (err) { setError(err.message || "Could not escalate this ticket."); }
    finally { setEscalating(""); }
  };

  const scopeText = [workspace.department, workspace.store_name, workspace.scope === "hq" ? "HQ workspace" : "Store workspace"].filter(Boolean).join(" - ");

  return <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
    <section className="rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-800 to-cyan-700 p-6 text-white shadow-xl sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-200"><CircleHelp className="h-4 w-4" /> RMS workspace support</div>
          <h1 className="mt-3 text-3xl font-black">{canManage ? "Retailer support centre" : "How can we help?"}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">{canManage ? "Review retailer requests or create a new secure ticket for RMS support." : "Create a private support ticket for the workspace you are currently using."}</p>
          {scopeText && <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"><Building2 className="h-3.5 w-3.5" />{scopeText}</p>}
        </div>
        <button type="button" onClick={() => setOpenForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-indigo-800"><Plus className="h-4 w-4" />New support ticket</button>
      </div>
    </section>

    {notice && <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{notice}</div>}
    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

    {openForm && <form onSubmit={submit} className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-black text-slate-900">Create support ticket</h2><p className="mt-1 text-xs text-slate-500">Your retailer, department and store context are recorded automatically.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">Issue type<select value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{CATEGORIES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
        <label className="text-sm font-bold text-slate-700">Subject<input required minLength="3" maxLength="160" value={form.subject} onChange={(event) => setForm((value) => ({ ...value, subject: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="Short description of your issue" /></label>
      </div>
      <label className="mt-4 block text-sm font-bold text-slate-700">What happened?<textarea required minLength="10" maxLength="5000" rows="5" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Include the module, expected result, and error message." /></label>
      <div className="mt-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-700">Screenshot or document <span className="font-normal text-slate-400">(optional)</span></p><p className="mt-1 text-xs text-slate-500">Upload JPG, PNG, WEBP or PDF up to 10 MB. It is attached privately to this ticket.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-50"><Paperclip className="h-4 w-4"/>{uploading ? "Uploading…" : "Choose file"}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => uploadAttachment(event.target.files?.[0])} className="hidden" disabled={uploading}/></label></div>{form.attachment_url && <div className="mt-3 flex items-center gap-2 rounded-xl bg-white p-2.5 text-xs font-bold text-slate-700"><Paperclip className="h-4 w-4 text-indigo-600"/><span className="min-w-0 flex-1 truncate">{attachmentName || "Attached file"}</span><a href={form.attachment_url} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">Preview</a><button type="button" onClick={() => { setForm((value) => ({ ...value, attachment_url: "" })); setAttachmentName(""); }} className="text-slate-400 hover:text-rose-600"><X className="h-4 w-4"/></button></div>}<label className="mt-3 block text-xs font-bold text-slate-500">Or paste an external link<input type="url" value={form.attachment_url} onChange={(event) => { setForm((value) => ({ ...value, attachment_url: event.target.value })); setAttachmentName(""); }} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" placeholder="https://..." /></label></div>
      <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setOpenForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Submit ticket</button></div>
    </form>}

    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-black text-slate-900">{canManage ? "Retailer support tickets" : "Your support tickets"}</h2><p className="mt-1 text-xs text-slate-500">{canManage ? "HQ can view the retailer's support history." : "Only you, authorised HQ users and RMS support can view this history."}</p></div><button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"><RefreshCw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} />Refresh</button></div>
      {loading ? <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div> : !tickets.length ? <div className="grid place-items-center px-5 py-16 text-center"><FileText className="h-10 w-10 text-slate-300" /><h3 className="mt-4 font-black text-slate-800">No support tickets yet</h3><p className="mt-1 text-sm text-slate-500">Create a ticket whenever you need RMS help.</p></div> : <div className="divide-y divide-slate-100">{tickets.map((ticket) => {
        const isOpen = expanded === ticket.id; const closed = ["resolved", "closed"].includes(ticket.status);
        return <article key={ticket.id} className="p-5"><button type="button" onClick={() => setExpanded(isOpen ? "" : ticket.id)} className="flex w-full items-start justify-between gap-4 text-left"><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className={"rounded-full px-2.5 py-1 text-[11px] font-black " + (TONES[ticket.status] || TONES.open)}>{title(ticket.status)}</span><span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{title(ticket.category)}</span>{ticket.escalated && <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-100 px-2.5 py-1 text-[11px] font-black text-fuchsia-700"><ArrowUpCircle className="h-3 w-3" />Escalated to Super Admin</span>}</div><h3 className="mt-2 truncate font-black text-slate-900">{ticket.subject}</h3><p className="mt-1 text-xs text-slate-500">{canManage && ticket.requester_name ? ticket.requester_name + " - " + (ticket.department || "Retailer") + " - " : ""}Updated {stamp(ticket.updated_at)}</p></div>{isOpen ? <ChevronUp className="mt-2 h-5 w-5 text-slate-400" /> : <ChevronDown className="mt-2 h-5 w-5 text-slate-400" />}</button>
          {isOpen && <div className="mt-5 space-y-4 border-t border-slate-100 pt-5"><p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{ticket.description}</p>{ticket.attachment_url && <a href={ticket.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700"><ExternalLink className="h-3.5 w-3.5"/>Open attached screenshot / document</a>}<div className="space-y-3">{ticket.messages.map((message, index) => <div key={ticket.id + "-" + index} className={"rounded-2xl p-4 " + (message.sender_type === "rms_support" ? "bg-indigo-50" : "bg-cyan-50")}><div className="flex justify-between gap-3"><p className="text-xs font-black text-slate-800">{message.sender_type === "rms_support" ? "RMS Support" : (message.sender_name || "Retailer team")}</p><p className="text-[11px] text-slate-400">{stamp(message.created_at)}</p></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.message}</p></div>)}</div>
          {canManage && !closed && !ticket.escalated && <div className="flex justify-end"><button type="button" disabled={escalating === ticket.id} onClick={() => escalate(ticket.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-3 py-2 text-xs font-black text-fuchsia-700 disabled:opacity-50">{escalating === ticket.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}Escalate to Super Admin</button></div>}
          {!closed && ticket.can_reply && <div className="rounded-2xl border border-slate-200 p-3"><textarea rows="3" value={replyFor === ticket.id ? reply : ""} onChange={(event) => { setReplyFor(ticket.id); setReply(event.target.value); }} className="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm" placeholder="Reply to RMS support..." /><div className="mt-2 flex justify-end"><button type="button" disabled={saving || !reply.trim()} onClick={() => sendReply(ticket.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"><MessageCircle className="h-3.5 w-3.5" />Send reply</button></div></div>}
          {closed && <p className="text-xs font-semibold text-slate-500">This ticket is closed. Create a new one if you need further help.</p>}</div>}
        </article>;
      })}</div>}
    </section>
  </main>;
}
