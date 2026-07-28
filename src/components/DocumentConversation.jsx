import React, { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../config/api.js";
import { Loader2, MessageCircle, RefreshCw, Send, X } from "lucide-react";

function tokenFor(actor) {
  return actor === "vendor"
    ? localStorage.getItem("vendor_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || ""
    : localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

async function callApi(actor, documentType, documentId, options = {}) {
  const token = tokenFor(actor);
  const response = await fetch(`${API_BASE_URL}/api/document-messages/${actor === "vendor" ? "vendor" : "admin"}/${documentType}/${documentId}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Could not load the conversation.");
  return data;
}

export default function DocumentConversation({ documentType, documentId, actor = "admin", title = "Conversation", onClose }) {
  const [messages, setMessages] = useState([]);
  const [document, setDocument] = useState(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await callApi(actor, documentType, documentId);
      setMessages(data.data || []); setDocument(data.document || null);
      window.dispatchEvent(new Event("document-messages-read"));
    } catch (err) { setError(err.message || "Could not load conversation."); }
    finally { setLoading(false); }
  }, [actor, documentId, documentType]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages, loading]);

  const send = async (event) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true); setError("");
    try {
      const data = await callApi(actor, documentType, documentId, { method: "POST", body: JSON.stringify({ message: draft }) });
      setMessages((current) => [...current, data.data]); setDraft("");
    } catch (err) { setError(err.message || "Could not send message."); }
    finally { setSending(false); }
  };

  const myType = actor === "vendor" ? "vendor" : "buyer";
  return <div className="fixed inset-0 z-[10050] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Document conversation">
    <section className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[82vh] sm:rounded-3xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-indigo-950 via-violet-900 to-slate-900 px-5 py-4 text-white"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10"><MessageCircle className="h-5 w-5 text-violet-100" /></span><div className="min-w-0"><p className="truncate text-base font-black">{document?.title || title}</p><p className="mt-0.5 truncate text-xs text-violet-200">{document?.reference || "Loading reference"} · Secure buyer-vendor thread</p></div></div><div className="flex gap-1"><button type="button" onClick={load} disabled={loading} className="grid h-9 w-9 place-items-center rounded-lg text-violet-100 hover:bg-white/10 disabled:opacity-50" title="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-violet-100 hover:bg-white/10" title="Close"><X className="h-5 w-5" /></button></div></header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-5 sm:px-5">{loading ? <div className="grid min-h-52 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-violet-600" /></div> : error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : messages.length === 0 ? <div className="grid min-h-52 place-items-center text-center"><div><MessageCircle className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-black text-slate-700">Start the conversation</p><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">Discuss quantity, price, specifications, dispatch or terms here. Messages remain attached to this document.</p></div></div> : <div className="space-y-3">{messages.map((message) => { const mine = message.sender_type === myType; return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${mine ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800"}`}><div className={`mb-1 flex items-center gap-2 text-[10px] font-bold ${mine ? "text-indigo-100" : "text-slate-400"}`}><span>{mine ? "You" : message.sender_name}</span><span>{message.created_at ? new Date(message.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : ""}</span></div><p className="whitespace-pre-wrap leading-6">{message.message}</p>{mine && <p className="mt-1.5 text-right text-[10px] font-semibold text-indigo-100/90">{myType === "vendor" ? (message.read_by_buyer ? "Read" : "Sent") : (message.read_by_vendor ? "Read" : "Sent")}</p>}</div></div>; })}<div ref={endRef} /></div>}</div>
      <form onSubmit={send} className="border-t border-slate-100 bg-white p-4"><div className="flex items-end gap-2"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} disabled={loading || sending} maxLength={2000} rows={2} className="min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 disabled:opacity-50" placeholder="Write a message about this document..." /><button disabled={loading || sending || !draft.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45" title="Send message">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></div><p className="mt-2 text-[10px] text-slate-400">This message is visible only to the connected buyer and vendor for this document.</p></form>
    </section>
  </div>;
}