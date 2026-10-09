import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useState, useEffect, useCallback } from "react";
import { MessageCircle, Check, ExternalLink, RefreshCw, AlertTriangle, Link2, Unlink, Key, Copy, Trash2 } from "lucide-react";

/**
 * VendorWhatsAppConnect.jsx
 * ============================
 * Vendor-facing: registers their Meta WhatsApp Catalog ID against their
 * RMS vendor_id, via POST /api/whatsapp/connect-catalog.
 *
 * ⚠️ HONEST ABOUT WHAT THIS DOES AND DOESN'T DO:
 * Saving a catalog_id here only records a mapping in RMS's database. It
 * does NOT make WhatsApp orders start flowing in — that also requires:
 *   1. The retailer/RMS admin to have real Meta credentials configured
 *      server-side (WHATSAPP_APP_SECRET etc. — see whatsapp_routes.py).
 *   2. whatsapp_routes.py's router to actually be mounted in main.py,
 *      which it deliberately isn't yet.
 * This component shows that status honestly rather than implying a
 * "Connected ✓" badge means orders are live — see the amber notice below.
 *
 * The catalog_id itself comes from the VENDOR'S OWN Meta Commerce Manager
 * — this page doesn't create it or walk them through Meta's setup, only
 * records the ID once they have one. A short explainer is included since
 * most vendors won't know what a "Catalog ID" is without context.
 */

const API_BASE = APP_API_URL;

function WhatsAppGuide() {
  const steps = [
    ["1", "What this page is for", "Letting your retailer receive orders you get over WhatsApp, so they land in RMS automatically instead of being typed in by hand."],
    ["2", "Three ways to connect — pick ONE", "Meta Commerce Manager (if you manage WhatsApp directly), your own system/BSP with an API key (if you have a developer or automation tool), or Log an order manually (if you have neither — just read the WhatsApp message and type it in)."],
    ["3", "Meta path — what you need", "A WhatsApp Business Catalog already set up in Meta Commerce Manager, plus each product's ID recorded against your RMS catalogue item (Catalogue tab → edit item → WhatsApp Catalog product ID)."],
    ["4", "Generic path — what you need", "Nothing from Meta. Generate an API key below, then have your own system call RMS with the buyer's number, your product ID and quantity whenever an order comes in."],
    ["5", "Manual path — what you need", "Nothing at all beyond your normal RMS login. Read the order off WhatsApp yourself, then use 'Log a WhatsApp order' below to type it in — no key, no Meta, no automation tool."],
    ["6", "Either way, orders still need two things set up first", "Your retailer must have registered the buyer's WhatsApp number in their RMS settings, AND your vendor account must be Approved with that retailer — without both, an order correctly comes back unresolved rather than being guessed."],
    ["7", "What happens to a successful order", "It becomes a normal Pending inquiry — the same place and process as any order placed inside RMS's own Catalogue tab. Nothing about negotiation, pricing or PO conversion changes."],
    ["8", "What this does NOT do yet", "Size and color aren't carried by a WhatsApp order message — note them in the order's free-text note, or follow up with the buyer directly."],
  ];
  return (
    <details className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-100 text-sm font-black text-indigo-700">i</span>
          <div><p className="text-sm font-black text-slate-900">How WhatsApp orders work in RMS</p><p className="mt-0.5 text-xs text-slate-500">Read this first — two different setup paths, pick the one that matches you</p></div>
        </div>
        <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-bold text-indigo-700">Show guide</span>
      </summary>
      <div className="border-t border-indigo-100 px-5 pb-5 pt-4">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {steps.map(([number, title, text]) => (
            <div key={number} className="flex gap-2.5 rounded-xl border border-indigo-100 bg-white p-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-600 text-[11px] font-black text-white">{number}</span>
              <div><p className="text-xs font-black text-slate-900">{title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{text}</p></div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function getVendorToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("vendor_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

async function vendorFetch(path, options = {}) {
  const token = getVendorToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

export default function VendorWhatsAppConnect() {
  const [connected, setConnected] = useState(false);
  const [catalogId, setCatalogId] = useState("");
  const [connectedAt, setConnectedAt] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  // Generic (non-Meta) order-push API key — for vendors using their own
  // system or a BSP (Interakt, WATI, Gupshup, ...) instead of connecting
  // directly to Meta's raw Cloud API above.
  const [keyStatus, setKeyStatus] = useState({ loading: true, hasKey: false });
  const [newKey, setNewKey] = useState(""); // shown exactly once, right after generating
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchKeyStatus = useCallback(async () => {
    setKeyStatus((s) => ({ ...s, loading: true }));
    try {
      const res = await vendorFetch("/api/whatsapp/integration/api-key/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not load API key status.");
      setKeyStatus({ loading: false, hasKey: Boolean(data.has_key), createdAt: data.created_at, lastUsedAt: data.last_used_at });
    } catch {
      setKeyStatus({ loading: false, hasKey: false, unavailable: true });
    }
  }, []);

  useEffect(() => { fetchKeyStatus(); }, [fetchKeyStatus]);

  const generateKey = async () => {
    setKeyBusy(true); setKeyError(null); setCopied(false);
    try {
      const res = await vendorFetch("/api/whatsapp/integration/api-key", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not generate a key.");
      setNewKey(data.api_key);
      fetchKeyStatus();
    } catch (err) {
      setKeyError(err.message);
    } finally {
      setKeyBusy(false);
    }
  };

  const revokeKey = async () => {
    setKeyBusy(true); setKeyError(null);
    try {
      const res = await vendorFetch("/api/whatsapp/integration/api-key", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not revoke the key.");
      setNewKey("");
      fetchKeyStatus();
    } catch (err) {
      setKeyError(err.message);
    } finally {
      setKeyBusy(false);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available — the key stays visible to copy manually */ }
  };

  // Manual order logging — no API key, no Meta, just the vendor's own
  // login. For vendors with neither a developer nor an automation tool.
  const [myCatalogue, setMyCatalogue] = useState([]);
  const [manualForm, setManualForm] = useState({ catalogue_item_id: "", from_number: "", quantity: "", price: "", note: "" });
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState(null);
  const [manualResult, setManualResult] = useState(null); // { ok: true } | { ok: false, reason }

  useEffect(() => {
    vendorFetch("/api/catalogue/my-catalogue")
      .then((res) => res.json())
      .then((data) => setMyCatalogue((data.data || []).filter((item) => item.active)))
      .catch(() => setMyCatalogue([]));
  }, []);

  const logManualOrder = async () => {
    if (!manualForm.catalogue_item_id || !manualForm.from_number.trim() || !manualForm.quantity) return;
    setManualBusy(true); setManualError(null); setManualResult(null);
    try {
      const res = await vendorFetch("/api/whatsapp/integration/manual-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogue_item_id: manualForm.catalogue_item_id,
          from_number: manualForm.from_number.trim(),
          quantity: Number(manualForm.quantity) || 0,
          price: manualForm.price ? Number(manualForm.price) : undefined,
          note: manualForm.note.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not log this order.");
      if (data.status === "success") {
        setManualResult({ ok: true });
        setManualForm({ catalogue_item_id: "", from_number: "", quantity: "", price: "", note: "" });
      } else {
        setManualResult({ ok: false, reason: data.reason });
      }
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualBusy(false);
    }
  };

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await vendorFetch("/api/whatsapp/my-catalog-connection");
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not load connection status.");
      setConnected(!!data.connected);
      setCatalogId(data.catalog_id || "");
      setConnectedAt(data.connected_at || null);
      setInputValue(data.catalog_id || "");
    } catch (err) {
      // This route doesn't exist until whatsapp_routes.py is mounted in
      // main.py — a fetch failure here most likely means that, not a
      // real error worth alarming the vendor about.
      setError("WhatsApp connection isn't available yet — check back later or contact support.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleConnect = async () => {
    if (!inputValue.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await vendorFetch("/api/whatsapp/connect-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog_id: inputValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save.");
      setSaved(true);
      fetchStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F6F7FB] p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">WhatsApp catalogue</h1>
            <p className="text-xs text-slate-500">Link your WhatsApp Business Catalog to RMS</p>
          </div>
        </div>

        <WhatsAppGuide />

        {/* Honest status notice — always shown, not just on error */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            This saves your Catalog ID so RMS can recognize orders from your WhatsApp catalogue in the future.
            It doesn't automatically send or receive WhatsApp orders yet — that depends on setup your retailer's
            team completes separately. Until then, keep using the in-app Catalogue tab for negotiations — it
            works today.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-4 py-3 rounded-xl">
            ⚠ {error}
          </div>
        )}

        {saved && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4" /> Catalog ID saved.
          </div>
        )}

        {/* Status card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-black text-slate-900">Connection status</p>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}>
              {connected ? <Link2 className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
              {connected ? "Catalog ID saved" : "Not connected"}
            </span>
          </div>

          {connected && (
            <div className="bg-slate-50 rounded-lg px-3 py-2 mb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Current Catalog ID</p>
              <p className="text-sm font-mono text-slate-700 mt-0.5">{catalogId}</p>
              {connectedAt && <p className="text-[10px] text-slate-400 mt-1">Saved {new Date(connectedAt).toLocaleDateString()}</p>}
            </div>
          )}

          <label className="text-xs font-bold text-slate-600 block mb-1.5">
            {connected ? "Update your Catalog ID" : "Your WhatsApp Catalog ID"}
          </label>
          <div className="flex gap-2">
            <input value={inputValue} onChange={e => setInputValue(e.target.value)}
              placeholder="e.g. 1234567890123456"
              className="flex-1 h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400" />
            <button onClick={handleConnect} disabled={saving || !inputValue.trim()}
              className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-50">
              {saving ? "Saving…" : connected ? "Update" : "Connect"}
            </button>
          </div>
        </div>

        {/* Where to find the Catalog ID */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm font-black text-slate-900 mb-3">Where do I find my Catalog ID?</p>
          <ol className="space-y-2.5 text-xs text-slate-600">
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-[10px]">1</span>
              <span>You need a WhatsApp Business Catalog already set up in Meta Commerce Manager — this is separate from RMS, on Meta's own site.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-[10px]">2</span>
              <span>Open Meta Commerce Manager → your catalog → Settings. The Catalog ID is shown there, a long number.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-[10px]">3</span>
              <span>Copy that number and paste it above.</span>
            </li>
          </ol>
          <a href="https://www.facebook.com/commerce_manager" target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800">
            Open Meta Commerce Manager <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Alternative path: not using Meta directly */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              <Key className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">Not using Meta directly?</p>
              <p className="text-[11px] text-slate-500">If you manage WhatsApp through your own system or a provider like Interakt, WATI or Gupshup, use this instead.</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed mt-3">
            This key lets your own system send RMS an order directly — no Meta catalog or webhook needed on your end.
            Whatever you use for WhatsApp, have it call RMS with this key when an order comes in.
          </p>

          {keyError && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-3 py-2.5 rounded-lg mt-3">⚠ {keyError}</div>}

          {newKey ? (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
              <p className="text-[11px] font-bold text-emerald-800 mb-1.5">Your new API key — copy it now, it won't be shown again:</p>
              <div className="flex gap-2">
                <code className="flex-1 bg-white border border-emerald-200 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-800 break-all">{newKey}</code>
                <button onClick={copyKey} className="shrink-0 h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ) : keyStatus.loading ? (
            <div className="mt-3 flex justify-center py-3"><RefreshCw className="w-4 h-4 text-slate-300 animate-spin" /></div>
          ) : keyStatus.hasKey ? (
            <div className="mt-3 bg-slate-50 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-700">Active key {keyStatus.createdAt ? `· created ${new Date(keyStatus.createdAt).toLocaleDateString()}` : ""}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{keyStatus.lastUsedAt ? `Last used ${new Date(keyStatus.lastUsedAt).toLocaleString()}` : "Not used yet"}</p>
              </div>
              <button onClick={revokeKey} disabled={keyBusy} className="h-8 px-2.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> Revoke
              </button>
            </div>
          ) : null}

          <button onClick={generateKey} disabled={keyBusy}
            className="mt-3 h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-50">
            {keyBusy ? "Working…" : keyStatus.hasKey ? "Generate new key (replaces current)" : "Generate API key"}
          </button>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-600 mb-1.5">How your system should call RMS:</p>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-[10.5px] overflow-x-auto"><code>{`POST ${API_BASE}/api/whatsapp/integration/order
X-API-Key: <your key above>
Content-Type: application/json

{
  "from_number": "<buyer's WhatsApp number>",
  "whatsapp_retailer_id": "<your product ID, set in Catalogue>",
  "quantity": 3,
  "price": 499.0
}`}</code></pre>
          </div>
        </div>

        {/* No developer, no automation tool — log it by hand */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">Log a WhatsApp order manually</p>
              <p className="text-[11px] text-slate-500">No developer, no automation tool? Just read the order off WhatsApp and type it in here — no key or setup needed.</p>
            </div>
          </div>

          {manualError && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-3 py-2.5 rounded-lg mt-3">⚠ {manualError}</div>}
          {manualResult?.ok === false && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-2.5 rounded-lg mt-3">
              Could not log this order: {manualResult.reason}
            </div>
          )}
          {manualResult?.ok === true && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-2.5 rounded-lg mt-3 flex items-center gap-2">
              <Check className="w-4 h-4" /> Order logged — it's now a Pending inquiry, same as any order placed inside RMS.
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold text-slate-600 block mb-1">Item</span>
              <select value={manualForm.catalogue_item_id} onChange={(e) => setManualForm((f) => ({ ...f, catalogue_item_id: e.target.value }))}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="">Select item…</option>
                {myCatalogue.map((item) => <option key={item._id} value={item._id}>{item.item_name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-600 block mb-1">Buyer's WhatsApp number</span>
              <input value={manualForm.from_number} onChange={(e) => setManualForm((f) => ({ ...f, from_number: e.target.value }))}
                placeholder="e.g. 919876543210" className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-600 block mb-1">Quantity</span>
              <input type="number" min="1" value={manualForm.quantity} onChange={(e) => setManualForm((f) => ({ ...f, quantity: e.target.value }))}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-600 block mb-1">Price (optional — uses catalogue price if blank)</span>
              <input type="number" min="0" value={manualForm.price} onChange={(e) => setManualForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold text-slate-600 block mb-1">Note (size, color, anything the buyer mentioned)</span>
              <input value={manualForm.note} onChange={(e) => setManualForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Size M, navy blue" className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm" />
            </label>
          </div>

          <button onClick={logManualOrder} disabled={manualBusy || !manualForm.catalogue_item_id || !manualForm.from_number.trim() || !manualForm.quantity}
            className="mt-4 h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold disabled:opacity-50">
            {manualBusy ? "Logging…" : "Log this order"}
          </button>
        </div>
      </div>
    </div>
  );
}