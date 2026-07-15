import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useState, useEffect, useCallback } from "react";
import { MessageCircle, Plus, Trash2, RefreshCw, AlertTriangle, Phone } from "lucide-react";

/**
 * RetailerWhatsAppConnect.jsx
 * ==============================
 * HQ/buyer-facing counterpart to VendorWhatsAppConnect.jsx — registers
 * the WhatsApp number(s) this retailer's buyers negotiate with vendors
 * from, via whatsapp_routes.py's POST/GET/DELETE /register-number,
 * /my-numbers, /numbers/{id}.
 *
 * Supports MULTIPLE numbers per tenant (e.g. one per purchasing agent,
 * or one per vendor relationship) — the backend used to silently
 * overwrite a single number per tenant; that's fixed now, and this page
 * reflects the real multi-number case rather than a single-input form.
 *
 * ⚠️ Same honesty as the vendor side: registering a number here doesn't
 * make WhatsApp orders start flowing. See the permanent notice below.
 */

const API_BASE = APP_API_URL;

function getAdminToken() {
  return (
    localStorage.getItem("admin_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

async function authFetch(url, options = {}) {
  const token = getAdminToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

export default function RetailerWhatsAppConnect() {
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notAvailable, setNotAvailable] = useState(false);

  const [newNumber, setNewNumber] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const fetchNumbers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/whatsapp/my-numbers`);
      if (!res.ok) {
        // Most likely whatsapp_routes.py isn't mounted in main.py yet —
        // not worth alarming the user with a raw error for that.
        setNotAvailable(true);
        return;
      }
      const data = await res.json();
      setNumbers(data.data || []);
    } catch {
      setNotAvailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNumbers(); }, [fetchNumbers]);

  const handleAdd = async () => {
    if (!newNumber.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/whatsapp/register-number`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: newNumber.trim(), label: newLabel.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to add number.");
      setNewNumber("");
      setNewLabel("");
      fetchNumbers();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm("Remove this number?")) return;
    setRemovingId(id);
    try {
      await authFetch(`${API_BASE}/api/whatsapp/numbers/${id}`, { method: "DELETE" });
      fetchNumbers();
    } catch { /* noop */ }
    finally { setRemovingId(null); }
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
            <h1 className="text-xl font-black text-slate-900">WhatsApp numbers</h1>
            <p className="text-xs text-slate-500">Register the numbers your team negotiates with vendors from</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Registering a number here only prepares RMS to recognize orders from it later — it doesn't connect
            live WhatsApp messaging yet. That requires a separate setup step (a real Meta Business account and
            credentials) your team completes once. Until then, use the in-app vendor comparison tools — they
            work today without any of this.
          </p>
        </div>

        {notAvailable && (
          <div className="bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold px-4 py-3 rounded-xl">
            WhatsApp registration isn't available on this server yet.
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-4 py-3 rounded-xl">
            ⚠ {error}
          </div>
        )}

        {!notAvailable && (
          <>
            {/* Add a number */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-black text-slate-900 mb-3">Add a number</p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                <input value={newNumber} onChange={e => setNewNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400" />
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  placeholder="Label (optional) — e.g. Fabric buying"
                  className="h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400" />
                <button onClick={handleAdd} disabled={adding || !newNumber.trim()}
                  className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> {adding ? "Adding…" : "Add"}
                </button>
              </div>
            </div>

            {/* Registered numbers list */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-sm font-black text-slate-900">Registered numbers</p>
                <p className="text-xs text-slate-400 mt-0.5">{numbers.length} number{numbers.length !== 1 ? "s" : ""}</p>
              </div>
              {numbers.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Phone className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No numbers registered yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {numbers.map(n => (
                    <div key={n.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-800 font-mono">{n.phone_number}</p>
                        {n.label && <p className="text-xs text-slate-400 mt-0.5">{n.label}</p>}
                      </div>
                      <button onClick={() => handleRemove(n.id)} disabled={removingId === n.id}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}