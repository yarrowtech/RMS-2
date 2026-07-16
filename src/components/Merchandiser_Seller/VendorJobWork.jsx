import React, { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/api.js";

const stages = [
  ["CUTTING_STARTED", "Cutting started"],
  ["STITCHING_STARTED", "Stitching started"],
  ["READY_FOR_RETURN", "Ready for return"],
  ["DELAYED", "Delayed"],
  ["UPDATE", "General update"],
];

function vendorHeaders() {
  const token = localStorage.getItem("vendor_token") || localStorage.getItem("token") || "";
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/job-work/vendor${path}`, {
    ...options,
    headers: { ...vendorHeaders(), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Unable to load job-work records.");
  return data;
}

function chip(status) {
  const text = String(status || "DRAFT").replaceAll("_", " ");
  const style = {
    DRAFT: "bg-slate-100 text-slate-600", ISSUED: "bg-amber-50 text-amber-700",
    PARTIALLY_RECEIVED: "bg-indigo-50 text-indigo-700", COMPLETED: "bg-emerald-50 text-emerald-700",
  }[status] || "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${style}`}>{text}</span>;
}

export default function VendorJobWork() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await api("/orders"); setOrders(data.data || []); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const updateDraft = (id, patch) => setDrafts((current) => ({ ...current, [id]: { stage: "UPDATE", message: "", ...(current[id] || {}), ...patch } }));
  const notify = (message) => { setNotice(message); window.setTimeout(() => setNotice(""), 4000); };

  const acknowledge = async (order) => {
    setSaving(`ack-${order.id}`); setError("");
    try { const result = await api(`/orders/${order.id}/acknowledge`, { method: "POST", body: JSON.stringify({ note: drafts[order.id]?.message || "" }) }); notify(result.message); await load(); }
    catch (err) { setError(err.message); } finally { setSaving(""); }
  };
  const shareProgress = async (order) => {
    const draft = drafts[order.id] || {};
    setSaving(`progress-${order.id}`); setError("");
    try { const result = await api(`/orders/${order.id}/progress`, { method: "POST", body: JSON.stringify({ stage: draft.stage || "UPDATE", message: draft.message || "" }) }); notify(result.message); updateDraft(order.id, { message: "" }); await load(); }
    catch (err) { setError(err.message); } finally { setSaving(""); }
  };

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-col justify-between gap-4 rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50 via-white to-emerald-50 p-6 sm:flex-row sm:items-center">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Vendor workspace</p><h1 className="mt-1 text-2xl font-black text-slate-900">Job Work Orders</h1><p className="mt-1 text-sm text-slate-500">Orders from approved retailer partners for cutting, stitching and finishing work.</p></div>
      <button onClick={load} className="rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-bold text-teal-700 transition hover:bg-teal-50">↻ Refresh</button>
    </header>
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">✓ {notice}</div>}
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}
    {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center text-sm text-slate-400">Loading assigned job work…</div> : orders.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center"><div className="text-3xl">✂</div><p className="mt-3 font-bold text-slate-700">No linked job-work orders</p><p className="mt-1 text-sm text-slate-400">When an approved retailer assigns and issues a job-work order to your RMS account, it appears here.</p></div> : orders.map((order) => {
      const draft = drafts[order.id] || { stage: "UPDATE", message: "" };
      const acknowledged = Boolean(order.vendor_acknowledged_at);
      return <article key={order.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-black text-slate-900">{order.order_no}</h2>{chip(order.status)}{acknowledged && <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">Acknowledged</span>}</div><p className="mt-2 text-sm font-semibold text-slate-700">{order.finished_product} · {order.expected_quantity} {order.unit}</p><p className="mt-1 text-xs text-slate-500">Retailer: <b>{order.retailer_name || order.tenant_id}</b> · {order.job_work_type} · Due: {order.due_date || "Not set"}</p></div><div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Challan: <b className="text-slate-700">{order.issue_challan_no || "Not issued yet"}</b></div></div><div className="grid gap-5 p-5 lg:grid-cols-[1fr_320px]"><div><p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Material issue</p><div className="overflow-hidden rounded-xl border border-slate-100"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Material</th><th className="px-3 py-2">Barcode</th><th className="px-3 py-2 text-right">Issued</th></tr></thead><tbody>{(order.materials || []).length ? order.materials.map((line) => <tr key={line.barcode} className="border-t border-slate-100"><td className="px-3 py-2.5 font-semibold text-slate-700">{line.product}</td><td className="px-3 py-2.5 font-mono text-xs text-slate-500">{line.barcode}</td><td className="px-3 py-2.5 text-right font-bold text-slate-700">{line.issued_qty} {line.unit}</td></tr>) : <tr><td colSpan="3" className="px-3 py-6 text-center text-xs text-slate-400">Material has not been issued by the retailer yet.</td></tr>}</tbody></table></div>{order.vendor_progress?.length > 0 && <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-600">Latest update: <span className="text-teal-700">{order.vendor_progress[order.vendor_progress.length - 1].stage.replaceAll("_", " ")}</span></p><p className="mt-1 text-xs text-slate-500">{order.vendor_progress[order.vendor_progress.length - 1].message || "No note"}</p></div>}</div><aside className="rounded-xl border border-teal-100 bg-teal-50/50 p-4"><p className="text-sm font-black text-teal-900">Update retailer</p>{!acknowledged && order.status !== "DRAFT" && <button onClick={() => acknowledge(order)} disabled={saving === `ack-${order.id}`} className="mt-3 w-full rounded-lg bg-teal-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving === `ack-${order.id}` ? "Saving…" : "Acknowledge challan"}</button>}<label className="mt-3 block text-xs font-bold text-slate-600">Progress stage<select value={draft.stage} onChange={(e) => updateDraft(order.id, { stage: e.target.value })} className="mt-1.5 w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none">{stages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="mt-3 block text-xs font-bold text-slate-600">Message<textarea value={draft.message} onChange={(e) => updateDraft(order.id, { message: e.target.value })} rows="3" placeholder="Share progress, expected dispatch or delay reason" className="mt-1.5 w-full resize-none rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none" /></label><button onClick={() => shareProgress(order)} disabled={saving === `progress-${order.id}`} className="mt-3 w-full rounded-lg border border-teal-600 bg-white px-3 py-2.5 text-sm font-bold text-teal-700 disabled:opacity-60">{saving === `progress-${order.id}` ? "Sending…" : "Share update"}</button><p className="mt-3 text-[11px] leading-4 text-slate-500">Stock changes only when the retailer physically receives and records the completed goods.</p></aside></div></article>;
    })}
  </div>;
}
