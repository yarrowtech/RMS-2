import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, CircleHelp, ExternalLink, FileText, Loader2, MessageCircle, Plus, RefreshCw, Send, TicketCheck } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

const categories = [
  ["login", "Login & account access"], ["subscription", "Subscription plan"], ["payment", "Payment or invoice"],
  ["purchase_order", "Purchase order"], ["catalogue", "Catalogue or products"], ["whatsapp", "WhatsApp connection"],
  ["technical", "Technical issue"], ["other", "Other"],
];
const statusStyle = { open: "bg-sky-100 text-sky-700", in_progress: "bg-amber-100 text-amber-700", waiting_on_vendor: "bg-violet-100 text-violet-700", waiting_on_rms: "bg-orange-100 text-orange-700", waiting_on_requester: "bg-violet-100 text-violet-700", resolved: "bg-emerald-100 text-emerald-700", closed: "bg-slate-100 text-slate-600" };
const label = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const stamp = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";
function vendorToken() { return localStorage.getItem("vendor_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || ""; }
async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/support/vendor${path}`, { ...options, headers: { Authorization: `Bearer ${vendorToken()}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Support request could not be completed.");
  return body;
}

export default function VendorHelpSupport() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replying, setReplying] = useState("");
  const [expanded, setExpanded] = useState("");
  const [replyText, setReplyText] = useState("");
  const [form, setForm] = useState({ category: "technical", subject: "", description: "", attachment_url: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await api("/tickets"); setTickets(Array.isArray(data.data) ? data.data : []); }
    catch (err) { setError(err.message || "Could not load support tickets."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault(); setSubmitting(true); setError(""); setNotice("");
    try {
      const data = await api("/tickets", { method: "POST", body: JSON.stringify(form) });
      setTickets((rows) => [data.data, ...rows]); setForm({ category: "technical", subject: "", description: "", attachment_url: "" });
      setFormOpen(false); setNotice("Your ticket was submitted. RMS support will reply in this thread."); setExpanded(data.data.id);
    } catch (err) { setError(err.message || "Could not submit your ticket."); }
    finally { setSubmitting(false); }
  };

  const reply = async (ticketId) => {
    if (!replyText.trim()) return;
    setReplying(ticketId); setError("");
    try {
      const data = await api(`/tickets/${ticketId}/reply`, { method: "POST", body: JSON.stringify({ message: replyText }) });
      setTickets((rows) => rows.map((row) => row.id === ticketId ? data.data : row)); setReplyText(""); setNotice("Your reply was sent to RMS support.");
    } catch (err) { setError(err.message || "Could not send your reply."); }
    finally { setReplying(""); }
  };

  return <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal-800 via-emerald-700 to-cyan-700 p-6 text-white shadow-xl shadow-teal-950/10 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-teal-100"><CircleHelp className="h-4 w-4" /> RMS partner support</div><h1 className="mt-3 text-3xl font-black tracking-tight">How can we help?</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-teal-50">Create a secure support ticket for account, catalogue, order, payment or technical help. Only your business and RMS support can view it.</p></div><button type="button" onClick={() => setFormOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-teal-800 shadow-sm transition hover:bg-teal-50"><Plus className="h-4 w-4" />New support ticket</button></div>
    </section>

    {notice && <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{notice}</div>}
    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

    {formOpen && <form onSubmit={submit} className="rounded-3xl border border-teal-100 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-center gap-2"><TicketCheck className="h-5 w-5 text-teal-600" /><div><h2 className="font-black text-slate-900">Create support ticket</h2><p className="text-xs text-slate-500">Give RMS support enough detail to investigate quickly.</p></div></div><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-700">Issue type<select value={form.category} onChange={(e) => setForm((value) => ({ ...value, category: e.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100">{categories.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Subject<input required minLength="3" maxLength="160" value={form.subject} onChange={(e) => setForm((value) => ({ ...value, subject: e.target.value }))} placeholder="Short description of your issue" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" /></label></div><label className="mt-4 block text-sm font-bold text-slate-700">What happened?<textarea required minLength="10" maxLength="5000" rows="5" value={form.description} onChange={(e) => setForm((value) => ({ ...value, description: e.target.value }))} placeholder="Include the page name, what you expected, and any error message." className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" /></label><label className="mt-4 block text-sm font-bold text-slate-700">Screenshot or document link <span className="font-normal text-slate-400">(optional)</span><input type="url" value={form.attachment_url} onChange={(e) => setForm((value) => ({ ...value, attachment_url: e.target.value }))} placeholder="https://..." className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" /></label><div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-teal-700 disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit ticket</button></div></form>}

    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-black text-slate-900">Your support tickets</h2><p className="mt-1 text-xs text-slate-500">Replies are private between your business and RMS support.</p></div><button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</button></div>{loading ? <div className="grid place-items-center py-14"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div> : !tickets.length ? <div className="grid place-items-center px-5 py-16 text-center"><FileText className="h-10 w-10 text-slate-300" /><h3 className="mt-4 font-black text-slate-800">No support tickets yet</h3><p className="mt-1 max-w-md text-sm text-slate-500">Create a ticket whenever you need RMS help. Your history will stay here.</p></div> : <div className="divide-y divide-slate-100">{tickets.map((ticket) => { const isOpen = expanded === ticket.id; const closed = ["resolved", "closed"].includes(ticket.status); return <article key={ticket.id} className="p-5"><button type="button" onClick={() => setExpanded(isOpen ? "" : ticket.id)} className="flex w-full items-start justify-between gap-4 text-left"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${statusStyle[ticket.status] || statusStyle.open}`}>{label(ticket.status)}</span><span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label(ticket.category)}</span></div><h3 className="mt-2 truncate font-black text-slate-900">{ticket.subject}</h3><p className="mt-1 text-xs text-slate-500">Updated {stamp(ticket.updated_at)}</p></div>{isOpen ? <ChevronUp className="mt-2 h-5 w-5 shrink-0 text-slate-400" /> : <ChevronDown className="mt-2 h-5 w-5 shrink-0 text-slate-400" />}</button>{isOpen && <div className="mt-5 space-y-4 border-t border-slate-100 pt-5"><p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{ticket.description}</p>{ticket.attachment_url && <a href={ticket.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 hover:text-teal-900"><ExternalLink className="h-4 w-4" />Open attached link</a>}<div className="space-y-3">{ticket.messages.map((message, index) => <div key={`${ticket.id}-${index}`} className={`rounded-2xl p-4 ${message.sender_type === "rms_support" ? "bg-indigo-50 ring-1 ring-indigo-100" : "bg-teal-50 ring-1 ring-teal-100"}`}><div className="flex items-center justify-between gap-3"><p className="text-xs font-black text-slate-800">{message.sender_type === "rms_support" ? "RMS Support" : "You"}</p><p className="text-[11px] text-slate-400">{stamp(message.created_at)}</p></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.message}</p></div>)}</div>{!closed && <div className="rounded-2xl border border-slate-200 p-3"><textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows="3" placeholder="Reply to RMS support…" className="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" /><div className="mt-2 flex justify-end"><button type="button" disabled={replying === ticket.id || !replyText.trim()} onClick={() => reply(ticket.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50">{replying === ticket.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}Send reply</button></div></div>}{closed && <p className="text-xs font-semibold text-slate-500">This ticket is closed. Create a new ticket if you need further help.</p>}</div>}</article>; })}</div>}</section>
  </main>;
}