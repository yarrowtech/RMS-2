import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, CreditCard, Plus, ShieldCheck, UserRound, UsersRound, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/api.js";

const ROLES = {
  Inventory: {
    description: "Store stock, GRC and GRN receiving.",
    permissions: ["store_stock", "stock_ledger", "stock_adjustment", "grc", "grn"],
  },
  Cashier: {
    description: "POS, returns and sales for this store.",
    permissions: ["cashier", "sales"],
  },
};

const emptyForm = { name: "", email: "", phone: "", role: "Inventory" };

// ── Razorpay checkout script loader ─────────────────────────────────────────────
function loadRazorpayCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const existing = document.querySelector('script[data-rms-razorpay-checkout="true"]');
    if (existing) { existing.addEventListener("load", resolve, { once: true }); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.rmsRazorpayCheckout = "true";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load secure payment checkout."));
    document.body.appendChild(script);
  });
}

// Basic plan's 3-seat cap covers "Owner + staff" — every staff account
// created below is an admins_collection record counted against the same
// limit hq_create_admin enforces, so this is the same purchase flow
// Hqadminmanagement.jsx already offers multi-store HQ Admins.
function BuySeatsModal({ request, onClose, onPurchased }) {
  const [status, setStatus] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    request("/api/retailer-seats/me")
      .then(setStatus)
      .catch((e) => setError(e.message || "Could not load seat info."))
      .finally(() => setLoading(false));
  }, [request]);

  const pay = async () => {
    setPaying(true); setError("");
    try {
      const checkout = await request("/api/retailer-seats/checkout", {
        method: "POST",
        body: JSON.stringify({ quantity }),
      });
      await loadRazorpayCheckout();
      if (!window.Razorpay) throw new Error("Secure payment checkout is unavailable. Please try again.");
      const razorpay = new window.Razorpay({
        key: checkout.key_id,
        amount: checkout.amount,
        currency: checkout.currency,
        name: "RMS Admin Seats",
        description: `${checkout.quantity} extra admin seat${checkout.quantity !== 1 ? "s" : ""}`,
        order_id: checkout.order_id,
        theme: { color: "#7c3aed" },
        handler: async (response) => {
          try {
            const result = await request("/api/retailer-seats/verify-payment", {
              method: "POST",
              body: JSON.stringify(response),
            });
            if (result.bonus_seats_added > 0) {
              onPurchased(result.message);
              onClose();
            } else {
              setError(result.message);
              setPaying(false);
            }
          } catch (e) {
            setError(e.message || "Could not verify payment.");
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      razorpay.open();
    } catch (e) {
      setError(e.message || "Could not start checkout.");
      setPaying(false);
    }
  };

  const total = status ? status.price_per_seat_inr * quantity : 0;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-700 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Buy Extra Admin Seats</h2>
            <p className="text-violet-100 text-xs mt-0.5">Add seats without upgrading your whole plan</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-md px-3 py-2">{error}</div>}
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-6">Loading…</p>
          ) : status ? (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm">
                <p className="text-slate-600">
                  {status.plan_label} plan · {status.used} / {status.unlimited ? "Unlimited" : status.effective_limit} seats used
                </p>
                {status.bonus_seats > 0 && (
                  <p className="text-xs text-violet-600 mt-1 font-semibold">
                    {status.bonus_seats} add-on seat{status.bonus_seats !== 1 ? "s" : ""} already purchased
                  </p>
                )}
              </div>
              {status.unlimited ? (
                <p className="text-sm text-slate-500 text-center py-4">Your plan already has unlimited admin seats — no add-on needed.</p>
              ) : (
                <>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">How many extra seats?</span>
                    <input
                      type="number" min="1" max={status.max_seats_per_purchase} value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(status.max_seats_per_purchase, Number(e.target.value) || 1)))}
                      className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-violet-400 outline-none"
                    />
                  </label>
                  <div className="flex items-center justify-between rounded-xl bg-violet-50 border border-violet-100 px-4 py-3">
                    <span className="text-sm font-semibold text-violet-800">
                      ₹{status.price_per_seat_inr.toLocaleString("en-IN")} × {quantity} seat{quantity !== 1 ? "s" : ""}
                    </span>
                    <span className="text-lg font-black text-violet-900">₹{total.toLocaleString("en-IN")}</span>
                  </div>
                  <button
                    onClick={pay} disabled={paying}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-700 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {paying ? "Opening secure payment…" : `Pay ₹${total.toLocaleString("en-IN")} & Add Seats`}
                  </button>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function StoreOwnerStaff() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showBuySeats, setShowBuySeats] = useState(false);
  const storeId = localStorage.getItem("admin_store_id") || "";

  const request = useCallback(async (path, options = {}) => {
    const token = localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Request failed");
    return data;
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      const data = await request("/hq/admins");
      setStaff((data.data || []).filter((person) => person.scope === "store"));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const selectedRole = useMemo(() => ROLES[form.role], [form.role]);
  const addStaff = async (event) => {
    event.preventDefault();
    if (!storeId) { setMessage("Your primary store is not available. Please sign in again."); return; }
    try {
      setSaving(true); setMessage("");
      await request("/hq/admins", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(),
          scope: "store", store_id: storeId, managedDepartments: [form.role],
          permissions: selectedRole.permissions,
        }),
      });
      setForm(emptyForm);
      setMessage("Staff account created. A password setup email was sent.");
      loadStaff();
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (person) => {
    try {
      const next = person.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
      await request(`/hq/admins/${person.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      loadStaff();
    } catch (error) { setMessage(error.message); }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-50 via-sky-50 to-emerald-50 px-4 py-6 text-slate-900 sm:px-7">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-200/70 bg-gradient-to-r from-indigo-950 via-violet-900 to-cyan-900 p-5 text-white shadow-xl shadow-indigo-950/15">
          <button onClick={() => navigate("/dashboard/store-owner")} className="rounded-xl border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex-1"><h1 className="flex items-center gap-2 text-xl font-black"><UsersRound className="h-5 w-5 text-cyan-300" /> Store Staff</h1><p className="mt-1 text-sm text-indigo-100">Create only Inventory or Cashier accounts for your primary store.</p></div>
          <button onClick={() => setShowBuySeats(true)} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20"><CreditCard className="h-4 w-4" /> Buy Seats</button>
        </header>

        {showBuySeats && (
          <BuySeatsModal
            request={request}
            onClose={() => setShowBuySeats(false)}
            onPurchased={(msg) => { setMessage(msg); loadStaff(); }}
          />
        )}

        <form onSubmit={addStaff} className="rounded-2xl border border-violet-200 bg-white/90 p-5 shadow-xl shadow-violet-950/5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2"><Plus className="h-5 w-5 text-violet-600" /><h2 className="font-black">Add staff member</h2></div>
          <div className="grid gap-3 md:grid-cols-2">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone (optional)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold">
              {Object.keys(ROLES).map((role) => <option key={role}>{role}</option>)}
            </select>
          </div>
          <p className="mt-3 text-xs text-slate-500"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />{selectedRole.description}</p>
          <button disabled={saving || !storeId} className="mt-4 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">{saving ? "Creating…" : "Create staff account"}</button>
          {message && <p className="mt-3 text-sm font-medium text-slate-600">{message}</p>}
        </form>

        <section className="overflow-hidden rounded-2xl border border-cyan-200 bg-white/90 shadow-xl shadow-cyan-950/5 backdrop-blur">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black">Your store staff</h2></div>
          {loading ? <p className="p-6 text-sm text-slate-500">Loading staff…</p> : staff.length === 0 ? <p className="p-6 text-sm text-slate-500">No staff accounts yet.</p> : <div className="divide-y divide-slate-100">
            {staff.map((person) => <div key={person.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><UserRound className="h-5 w-5" /></div>
              <div className="min-w-[180px] flex-1"><p className="font-bold">{person.name}</p><p className="text-xs text-slate-500">{person.email} · {person.department}</p></div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${person.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{person.status}</span>
              <button onClick={() => toggleStatus(person)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">{person.status === "ACTIVE" ? "Suspend" : "Activate"}</button>
            </div>)}
          </div>}
        </section>
      </div>
    </main>
  );
}
