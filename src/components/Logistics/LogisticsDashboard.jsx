import React, { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/api.js";
import { logoutOrReturnToDepartmentSelector } from "../../utils/authRedirect.js";

// Logistics is an independent, opt-in add-on (logistics_addon_routes.py) —
// not every retailer needs shipment/transfer tracking, so it's off by
// default and Super Admin turns it on per tenant. Once enabled, this page
// reads real data that already exists elsewhere (inbound purchase orders
// + their vendor dispatch info, and in-transit stock transfers) instead
// of inventing a parallel tracking system.
// Backend: GET /api/logistics/dashboard, /api/logistics-addon/* (logistics_routes.py).

function authHeaders() {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function addonRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/logistics-addon${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Unable to complete this action.");
  return data;
}

async function request(path) {
  const response = await fetch(`${API_BASE_URL}/api/logistics${path}`, { headers: authHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Unable to load logistics data.");
  return data;
}

const statusTone = {
  Pending: "bg-slate-100 text-slate-700",
  SentToVendor: "bg-amber-50 text-amber-700",
  VendorSubmitted: "bg-indigo-50 text-indigo-700",
  Approved: "bg-emerald-50 text-emerald-700",
};

export default function LogisticsDashboard() {
  const [addonStatus, setAddonStatus] = useState(null);
  const [addonChecking, setAddonChecking] = useState(true);
  const [data, setData] = useState({ inbound: [], transfers: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await request("/dashboard");
      setData({ inbound: result.inbound || [], transfers: result.transfers || [], summary: result.summary || {} });
    } catch (err) {
      setError(err.message || "Could not load logistics data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAddon = useCallback(async () => {
    setAddonChecking(true);
    try {
      const status = await addonRequest("/me");
      setAddonStatus(status);
      if (status.enabled) await refresh();
    } catch {
      setAddonStatus({ enabled: true, request: null });
      await refresh();
    } finally {
      setAddonChecking(false);
    }
  }, [refresh]);

  useEffect(() => { checkAddon(); }, [checkAddon]);

  if (addonChecking) {
    return <main className="grid min-h-full place-items-center bg-slate-50 p-8 text-sm font-semibold text-slate-400">Checking Logistics access…</main>;
  }

  if (addonStatus && !addonStatus.enabled) {
    return <AddonRequestScreen status={addonStatus} onRequested={(req) => setAddonStatus((current) => ({ ...current, request: req }))} />;
  }

  const { inbound, transfers, summary } = data;

  return (
    <main className="min-h-full bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_30%),linear-gradient(135deg,_#f8fafc_0%,_#ecfeff_46%,_#f0fdfa_100%)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative mb-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-cyan-950 to-teal-800 p-6 shadow-2xl shadow-cyan-300/40 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-teal-400/25 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 text-2xl shadow-lg shadow-black/20">🚚</div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Movement command centre</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-white">Logistics</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-100">What's still on the road — inbound purchase orders awaiting delivery, and stock transfers dispatched but not yet received.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <button type="button" onClick={refresh} disabled={loading} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-60">{loading ? "Loading…" : "Refresh"}</button>
              <button type="button" onClick={() => logoutOrReturnToDepartmentSelector()} className="rounded-xl border border-rose-300/25 bg-rose-400/10 px-4 py-2.5 text-sm font-bold text-rose-100 transition hover:bg-rose-400/20">Logout</button>
            </div>
          </div>
        </div>

        {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Inbound in transit", summary.inbound_in_transit || 0, "POs with dispatch info from the vendor", "bg-cyan-600"],
            ["Awaiting dispatch", summary.inbound_awaiting_dispatch || 0, "POs sent but no dispatch info yet", "bg-amber-500"],
            ["Transfers in transit", summary.transfers_in_transit || 0, "Dispatched, not yet received", "bg-teal-600"],
            ["Overdue transfers", summary.overdue_transfers || 0, "Past their transit due date", "bg-rose-500"],
          ].map(([label, value, caption, color]) => (
            <article key={label} className="group relative overflow-hidden rounded-2xl border border-white/80 bg-white/80 p-5 shadow-lg shadow-cyan-100/40 backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-xl">
              <div className={`absolute right-0 top-0 h-20 w-20 rounded-bl-[48px] opacity-10 ${color}`} />
              <span className={`mb-4 block h-1.5 w-12 rounded-full ${color}`} />
              <p className="text-sm font-bold text-slate-500">{label}</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">{value}</p>
              <p className="mt-1 text-xs font-medium text-slate-400">{caption}</p>
            </article>
          ))}
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="font-black text-slate-900">Inbound shipments</p>
            <p className="text-xs text-slate-500 mt-0.5">Purchase orders sent to a vendor and not yet fully closed. Vehicle/tracking info shows once the vendor dispatches.</p>
          </div>
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
          ) : inbound.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-black text-slate-700">Nothing inbound right now</p>
              <p className="mt-1 text-xs text-slate-500">Purchase orders sent to vendors will show up here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {inbound.map((po) => (
                <div key={po.order_no} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sky-700">{po.order_no}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusTone[po.status] || "bg-slate-100 text-slate-600"}`}>{po.status}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-50 text-slate-500">{po.order_type}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{po.vendor_name}{po.expected_delivery_date ? ` · Expected ${po.expected_delivery_date}` : ""}</p>
                    {po.dispatched ? (
                      <p className="text-xs text-emerald-700 mt-1 font-semibold">
                        🚚 {po.vehicle_number || "Vehicle N/A"}{po.transporter_name ? ` · ${po.transporter_name}` : ""}{po.tracking_number ? ` · Tracking ${po.tracking_number}` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 mt-1 font-semibold">No dispatch info yet from vendor</p>
                    )}
                  </div>
                  <p className="font-bold text-slate-900">₹{Number(po.net_amount || 0).toLocaleString("en-IN")}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="font-black text-slate-900">Stock transfers in transit</p>
            <p className="text-xs text-slate-500 mt-0.5">Dispatched from source, not yet confirmed received at destination.</p>
          </div>
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
          ) : transfers.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-black text-slate-700">No transfers in transit</p>
              <p className="mt-1 text-xs text-slate-500">Store-to-store or central-to-store dispatches will show up here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transfers.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-teal-700">{t.ref_no}</p>
                      {t.is_overdue && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700">Overdue</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{t.from} → {t.to}{t.transporter ? ` · ${t.transporter}` : ""}{t.transit_due_date ? ` · Due ${t.transit_due_date}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{t.total_qty} pcs</p>
                    <p className="text-xs text-slate-400">₹{Number(t.total_value || 0).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function AddonRequestScreen({ status, onRequested }) {
  const pending = status.request?.status === "PENDING";
  const declined = status.request?.status === "DECLINED";
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSending(true);
    setError("");
    try {
      const result = await addonRequest("/requests", { method: "POST", body: JSON.stringify({ note }) });
      onRequested(result.request);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="grid min-h-full place-items-center bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_30%),linear-gradient(135deg,_#f8fafc_0%,_#ecfeff_46%,_#f0fdfa_100%)] p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg rounded-[28px] border border-white bg-white/90 p-8 text-center shadow-2xl shadow-cyan-100/60 backdrop-blur">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-slate-950 via-cyan-950 to-teal-800 text-2xl text-white shadow-lg">🚚</div>
        <h1 className="mt-4 text-xl font-black tracking-tight text-slate-900">Logistics is not activated</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">This workspace is a separate, optional add-on — not every retailer needs it. Activate it to track inbound shipments and stock transfers still in transit, in one place.</p>

        {pending ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Your activation request is awaiting review. You'll get access as soon as it's approved.</div>
        ) : (
          <div className="mt-6 text-left">
            {declined && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">Your previous request was declined. You can send another one below.</div>}
            {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
            <label className="block text-sm font-bold text-slate-700">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Note to RMS (optional)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="e.g. We move stock between stores often and want visibility on what's in transit." className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" />
            </label>
            <button type="button" disabled={sending} onClick={submit} className="mt-4 w-full rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white transition hover:bg-cyan-700 disabled:opacity-60">{sending ? "Sending…" : "Request activation"}</button>
          </div>
        )}

        <button type="button" onClick={() => logoutOrReturnToDepartmentSelector()} className="mt-6 text-xs font-bold text-slate-400 hover:text-slate-600">Back to department selector</button>
      </div>
    </main>
  );
}
