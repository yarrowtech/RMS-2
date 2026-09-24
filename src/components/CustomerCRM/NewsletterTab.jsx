import React, { useCallback, useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

function token() {
  return localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

async function nlFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/customer-crm/newsletter${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Newsletter request failed.");
  return data;
}

const emptyForm = { subject: "", message: "", image_url: "", link: "", link_label: "", test_email: "" };

// Customer CRM -> Newsletter. HQ Admin only (the backend enforces it too).
// Audience is whoever ticked "yes" to updates and has an email on file.
export default function NewsletterTab({ isHq }) {
  const [audience, setAudience] = useState({ total: 0, subscribers: [] });
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const load = useCallback(async () => {
    if (!isHq) return;
    try {
      const [a, h] = await Promise.all([nlFetch("/audience"), nlFetch("/history")]);
      setAudience(a);
      setHistory(h);
    } catch (e) { setError(e.message || "Unable to load newsletter data."); }
  }, [isHq]);

  useEffect(() => { load(); }, [load]);

  // Sends a real announcement, or (with the test box filled) one test email.
  const send = async (asTest) => {
    setError(""); setNotice("");
    if (!form.subject.trim() || !form.message.trim()) { setError("Enter a subject and a message."); return; }
    if (asTest && !form.test_email.trim()) { setError("Enter an email address to send the test to."); return; }
    if (!asTest && !window.confirm(`Send this to ${audience.total} subscriber(s)?`)) return;
    setBusy(true);
    try {
      const result = await nlFetch("/send", { method: "POST", body: JSON.stringify({ ...form, test_email: asTest ? form.test_email : "" }) });
      setNotice(result.message);
      if (!asTest) { setForm(emptyForm); setTimeout(load, 1500); }
    } catch (e) { setError(e.message || "Unable to send."); }
    finally { setBusy(false); }
  };

  if (!isHq) {
    return <div className="crm-card p-6 text-sm text-slate-600">Only HQ Admin can send newsletters.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="crm-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Mail size={18}/> Newsletter</h2>
            <p className="text-sm text-slate-500">Email offers, coupons and new lucky draws to customers who ticked yes to updates. Every email has an unsubscribe link.</p>
          </div>
          <div className="rounded-xl bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700">{audience.total} subscriber(s) with email</div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input className="crm-input md:col-span-2" placeholder="Subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} />
          <textarea className="crm-input md:col-span-2" rows={6} placeholder="Message — each new line becomes a paragraph" value={form.message} onChange={(e) => set("message", e.target.value)} />
          <input className="crm-input" placeholder="Image link (optional)" value={form.image_url} onChange={(e) => set("image_url", e.target.value)} />
          <input className="crm-input" placeholder="Button link (optional) e.g. https://..." value={form.link} onChange={(e) => set("link", e.target.value)} />
          <input className="crm-input" placeholder="Button text (optional) e.g. Shop now" value={form.link_label} onChange={(e) => set("link_label", e.target.value)} />
          <input className="crm-input" placeholder="Test email address" value={form.test_email} onChange={(e) => set("test_email", e.target.value)} />
        </div>

        {error && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
        {notice && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</p>}

        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <button disabled={busy} onClick={() => send(true)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Send test</button>
          <button disabled={busy || audience.total === 0} onClick={() => send(false)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"><Send size={15} className="mr-1 inline"/> Send to all subscribers</button>
        </div>
      </div>

      <div className="crm-card overflow-hidden">
        <div className="border-b border-slate-100 p-5"><h3 className="font-bold text-slate-900">Sent history</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Subject</th><th className="px-5 py-3">Recipients</th><th className="px-5 py-3">Sent</th><th className="px-5 py-3">Failed</th><th className="px-5 py-3">Status</th></tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-slate-100">
                  <td className="px-5 py-3 text-slate-700">{h.created_at ? new Date(h.created_at).toLocaleString() : "-"}</td>
                  <td className="px-5 py-3 font-semibold text-slate-900">{h.subject}</td>
                  <td className="px-5 py-3 text-slate-700">{h.recipient_count}</td>
                  <td className="px-5 py-3 text-slate-700">{h.sent_count}</td>
                  <td className="px-5 py-3 text-slate-700">{h.failed_count}</td>
                  <td className="px-5 py-3 text-slate-700">{h.status === "DONE" ? "Done" : "Sending…"}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">Nothing sent yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="crm-card overflow-hidden">
        <div className="border-b border-slate-100 p-5"><h3 className="font-bold text-slate-900">Subscribers</h3><p className="text-xs text-slate-500">Showing the latest {Math.min(audience.subscribers.length, 300)} of {audience.total}.</p></div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <tbody>
              {audience.subscribers.map((s) => (
                <tr key={s.id} className="border-t border-slate-100"><td className="px-5 py-2 font-semibold text-slate-900">{s.name || "-"}</td><td className="px-5 py-2 text-slate-700">{s.email}</td><td className="px-5 py-2 text-slate-500">{s.mobile}</td></tr>
              ))}
              {audience.subscribers.length === 0 && <tr><td className="px-5 py-8 text-center text-slate-400">No subscribers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
