import React, { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/api.js";
import { Boxes, ChevronDown, ChevronUp, ClipboardList, Loader2, RefreshCw, SlidersHorizontal } from "lucide-react";

function headers(json = false) {
  const token = localStorage.getItem("vendor_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) };
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/vendor-b2b${path}`, { ...options, headers: { ...headers(Boolean(options.body)), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Request failed");
  return data;
}

export default function VendorB2BStock() {
  const [stock, setStock] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [adjustments, setAdjustments] = useState({});
  const [ledger, setLedger] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await api("/stock"); setStock(data.data || []); setTotalValue(data.total_value || 0); }
    catch (err) { setError(err.message || "Could not load B2B stock."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateAdjustment = (id, key, value) => setAdjustments((current) => ({ ...current, [id]: { ...(current[id] || { direction: "out", quantity: "", note: "" }), [key]: value } }));
  const adjust = async (item) => {
    const form = adjustments[item._id] || {};
    const quantity = Number(form.quantity || 0);
    if (!quantity || quantity <= 0) { setError("Enter an adjustment quantity greater than zero."); return; }
    if (!String(form.note || "").trim()) { setError("Enter a reason for the B2B stock adjustment."); return; }
    setSaving(true); setError("");
    try {
      const delta = form.direction === "out" ? -quantity : quantity;
      await api(`/stock/${item._id}/adjust`, { method: "POST", body: JSON.stringify({ quantity_delta: delta, note: form.note }) });
      setAdjustments((current) => ({ ...current, [item._id]: { direction: "out", quantity: "", note: "" } }));
      setNotice("B2B stock adjustment recorded."); await load();
    } catch (err) { setError(err.message || "Could not adjust B2B stock."); }
    finally { setSaving(false); }
  };

  const toggleLedger = async (item) => {
    if (ledger[item._id]) { setLedger((current) => ({ ...current, [item._id]: null })); return; }
    setSaving(true); setError("");
    try { const data = await api(`/stock/${item._id}/ledger`); setLedger((current) => ({ ...current, [item._id]: data.data || [] })); }
    catch (err) { setError(err.message || "Could not load stock movement."); }
    finally { setSaving(false); }
  };

  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-cyan-950 to-teal-900 p-6 text-white shadow-lg sm:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Boxes className="h-6 w-6 text-cyan-200" /></div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">B2B Stock Ledger</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Stock received through Vendor B2B Trade. This is separate from every retailer's stock, GRC and GRN records.</p></div><div className="flex items-center gap-3"><div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-cyan-200">B2B stock value</p><p className="mt-1 text-xl font-black">INR {Number(totalValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p></div><button onClick={load} disabled={loading} className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 disabled:opacity-50" title="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div></div></section>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}
    {loading ? <div className="grid min-h-72 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div> : stock.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-20 text-center shadow-sm"><Boxes className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-4 font-black text-slate-700">No B2B stock received yet</h2><p className="mt-2 text-sm text-slate-400">Complete a Vendor B2B Trade order and record the material receipt to add stock here.</p></div> : <div className="space-y-4">{stock.map((item) => { const form = adjustments[item._id] || { direction: "out", quantity: "", note: "" }; const movements = ledger[item._id]; return <article key={item._id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-slate-900">{item.title}</h2><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-bold uppercase text-cyan-700">{item.item_code || item.item_key}</span></div><p className="mt-1 text-sm text-slate-500">{item.category || "B2B material"} · Unit: {item.unit}</p></div><div className="grid grid-cols-3 gap-5 rounded-2xl bg-slate-50 px-4 py-3 text-right"><div><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">On hand</p><p className="mt-1 text-lg font-black text-slate-900">{item.quantity} <span className="text-xs text-slate-500">{item.unit}</span></p></div><div><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Average cost</p><p className="mt-1 text-sm font-bold text-slate-900">{item.currency || "INR"} {Number(item.average_cost || 0).toLocaleString("en-IN")}</p></div><div><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Value</p><p className="mt-1 text-sm font-bold text-teal-700">{item.currency || "INR"} {Number(item.total_value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p></div></div></div><div className="mt-5 border-t border-slate-100 pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-slate-500" /><p className="text-sm font-black text-slate-800">Manual B2B stock adjustment</p></div><button onClick={() => toggleLedger(item)} disabled={saving} className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800">{movements ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}<ClipboardList className="h-4 w-4" />{movements ? "Hide movement" : "View movement"}</button></div><div className="mt-3 grid gap-3 md:grid-cols-[150px_150px_1fr_auto]"><select value={form.direction} onChange={e => updateAdjustment(item._id, "direction", e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="out">Stock out / consumed</option><option value="in">Stock in / correction</option></select><input type="number" min="0.001" step="0.001" value={form.quantity} onChange={e => updateAdjustment(item._id, "quantity", e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" placeholder={`Quantity (${item.unit})`} /><input value={form.note} onChange={e => updateAdjustment(item._id, "note", e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" placeholder="Reason, production use, damage or correction" /><button disabled={saving} onClick={() => adjust(item)} className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50">Save adjustment</button></div>{movements && <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Movement</th><th className="px-3 py-3 text-right">In</th><th className="px-3 py-3 text-right">Out</th><th className="px-3 py-3 text-right">Value</th><th className="px-3 py-3">Reference / note</th></tr></thead><tbody>{movements.length === 0 ? <tr><td colSpan="6" className="px-3 py-5 text-center text-slate-400">No movement records.</td></tr> : movements.map((movement) => <tr key={movement._id} className="border-t border-slate-100 text-slate-600"><td className="whitespace-nowrap px-3 py-3">{movement.created_at ? new Date(movement.created_at).toLocaleDateString() : "—"}</td><td className="px-3 py-3 font-semibold text-slate-800">{movement.movement_type}</td><td className="px-3 py-3 text-right font-bold text-emerald-600">{movement.quantity_in || "—"}</td><td className="px-3 py-3 text-right font-bold text-rose-600">{movement.quantity_out || "—"}</td><td className="px-3 py-3 text-right">{movement.value || 0}</td><td className="px-3 py-3">{movement.reference_no || movement.note || "—"}</td></tr>)}</tbody></table></div>}</div></article>; })}</div>}
  </div>;
}
