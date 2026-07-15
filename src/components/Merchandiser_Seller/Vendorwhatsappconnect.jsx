import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useState, useEffect, useCallback } from "react";
import { MessageCircle, Check, ExternalLink, RefreshCw, AlertTriangle, Link2, Unlink } from "lucide-react";

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
      </div>
    </div>
  );
}