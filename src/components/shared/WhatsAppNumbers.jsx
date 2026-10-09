// HQ-only settings screen: register the WhatsApp number(s) this retailer's
// buyers message vendors from. This is the "tell RMS which number is yours"
// step — once a real Meta webhook is wired up later, an incoming order from
// any registered number here resolves back to this tenant automatically.
// Multiple numbers are supported on purpose (one per department/agent) —
// see POST /api/whatsapp/register-number's own docstring for why.
import React, { useCallback, useEffect, useState } from "react";
import { Loader2, MessageCircle, Plus, Trash2 } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

function SetupGuide() {
  const steps = [
    ["1", "What this screen does", "Registers the WhatsApp number(s) your buying team messages vendors from. When an order comes in, RMS matches it back to your account by this number — nothing else needs typing in on your side."],
    ["2", "Register a number per department", "Add one entry per department or purchasing agent (e.g. 'Men's Department', 'Women's Department') — RMS supports as many numbers as you actually use, each correctly mapped to your account."],
    ["3", "One-time setup your developer/platform owner does separately", "Before any order can actually arrive, someone needs: a Meta App (developers.facebook.com) with an App Secret, a self-chosen Verify Token, and the webhook URL registered in Meta's dashboard. This is done once for the whole platform — not per department, not per vendor."],
    ["4", "Business Verification — only for going fully live", "Not needed for testing (Meta gives a free test number). Needed once you're ready for a real, dedicated WhatsApp number at scale — a one-time check of your Meta Business Account's documents."],
    ["5", "What your vendors need to do (their side, not yours)", "Each vendor connects however suits them: directly via Meta Commerce Manager, via their own system/BSP with an API key, or by manually logging orders in RMS if they have neither. Point them to their own WhatsApp settings page — none of it needs action from you beyond step 2 above."],
    ["6", "How to know it's actually working", "Once a vendor sends a test order from a number you've registered here, check Catalogue → Inquiries for a new Pending entry tagged as coming from WhatsApp. Nothing arriving usually means step 3 isn't complete yet."],
  ];
  return (
    <details className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-sm font-black text-emerald-700">i</span>
          <div><p className="text-sm font-black text-slate-900">How to set up WhatsApp ordering</p><p className="mt-0.5 text-xs text-slate-500">Read this first — what you do here vs. what's done once, platform-wide</p></div>
        </div>
        <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-bold text-emerald-700">Show guide</span>
      </summary>
      <div className="border-t border-emerald-100 px-5 pb-5 pt-4">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {steps.map(([number, title, text]) => (
            <div key={number} className="flex gap-2.5 rounded-xl border border-emerald-100 bg-white p-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-[11px] font-black text-white">{number}</span>
              <div><p className="text-xs font-black text-slate-900">{title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{text}</p></div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function authHeaders() {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { Authorization: `Bearer ${token}` };
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/whatsapp${path}`, {
    ...options,
    headers: { ...authHeaders(), "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Request failed.");
  return body;
}

export default function WhatsAppNumbers() {
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const res = await api("/my-numbers");
      setNumbers(res.data || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addNumber = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await api("/register-number", { method: "POST", body: JSON.stringify({ phone_number: phone.trim(), label: label.trim() }) });
      setPhone(""); setLabel("");
      setMessage("Number registered.");
      await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const removeNumber = async (id) => {
    setError(""); setMessage("");
    try {
      await api(`/numbers/${id}`, { method: "DELETE" });
      setMessage("Number removed.");
      await load();
    } catch (e) { setError(e.message); }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <MessageCircle className="h-5 w-5 text-emerald-600" />
        <div>
          <h2 className="font-black text-slate-900">WhatsApp numbers</h2>
          <p className="text-sm text-slate-500">
            HQ-only. Register every WhatsApp number your buying team messages vendors from — one per department or
            purchasing agent is fine. This is what lets an incoming WhatsApp order resolve back to your account
            once the WhatsApp integration goes live; it does not send or receive anything by itself yet.
          </p>
        </div>
      </div>

      <div className="mt-4"><SetupGuide /></div>

      <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs leading-5 text-indigo-900">
        <b>Good to know:</b> a vendor can connect either by linking their Meta WhatsApp Catalog directly, or —
        if they use their own system or a provider like Interakt/WATI/Gupshup instead of Meta directly — via a
        simple API key on their end. Either way, this number registration is the same required step on your
        side; nothing changes here based on which path the vendor uses.
      </div>

      {message && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div>}
      {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}

      <form onSubmit={addNumber} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block text-xs font-bold text-slate-600">
          WhatsApp number
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 91 98765 43210"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="block text-xs font-bold text-slate-600">
          Label (optional)
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Men's Department"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <button
          type="submit"
          disabled={saving || !phone.trim()}
          className="mt-1 inline-flex h-[42px] items-center justify-center gap-2 self-end rounded-xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-50 sm:mt-0"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </form>

      <div className="mt-5">
        {loading ? (
          <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : numbers.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No WhatsApp numbers registered yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {numbers.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-bold text-slate-900">{n.phone_number}</p>
                  <p className="text-xs text-slate-500">{n.label || "No label"} &middot; registered {n.registered_at ? new Date(n.registered_at).toLocaleDateString("en-IN") : ""}</p>
                </div>
                <button
                  onClick={() => removeNumber(n.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
