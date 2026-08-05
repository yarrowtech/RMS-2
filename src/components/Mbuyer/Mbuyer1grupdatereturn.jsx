import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, PackageX, RefreshCw, Send, Truck } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

const API = `${API_BASE_URL}/api/supplier-returns`;
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("admin_token") || localStorage.getItem("token") || ""}`, "Content-Type": "application/json" });
const qty = (value) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function Mbuyer1GRUpdateReturn() {
  const [eligible, setEligible] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState("");
  const [quantities, setQuantities] = useState({});
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const [eligibleResponse, notesResponse] = await Promise.all([
        fetch(`${API}/eligible-grcs`, { headers: auth(), cache: "no-store" }),
        fetch(`${API}/`, { headers: auth(), cache: "no-store" }),
      ]);
      const [eligibleData, notesData] = await Promise.all([eligibleResponse.json(), notesResponse.json()]);
      if (!eligibleResponse.ok) throw new Error(eligibleData.detail || "Could not load rejected GRC items.");
      if (!notesResponse.ok) throw new Error(notesData.detail || "Could not load supplier returns.");
      setEligible(eligibleData.data || []); setNotes(notesData.data || []);
    } catch (requestError) { setError(requestError.message || "Could not load supplier returns."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const current = eligible.find((row) => row.grc_id === selected);
  const createReturn = async () => {
    if (!current) return;
    const lines = current.lines.map((line) => ({ grc_item_index: line.grc_item_index, quantity: Number(quantities[line.grc_item_index] || 0), reason: line.rejection_reason || "Rejected during goods receipt" })).filter((line) => line.quantity > 0);
    if (!lines.length) { setError("Enter a return quantity for at least one rejected item."); return; }
    try {
      setError("");
      const response = await fetch(`${API}/`, { method: "POST", headers: auth(), body: JSON.stringify({ grc_id: current.grc_id, lines, note }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not create Supplier Return Note.");
      setMessage(`${data.data.srn_no} created. Rejected quantity was never added to available stock.`);
      setSelected(""); setQuantities({}); setNote(""); load();
    } catch (requestError) { setError(requestError.message); }
  };
  const dispatch = async (id) => {
    try {
      const response = await fetch(`${API}/${id}/dispatch`, { method: "PATCH", headers: auth() });
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || "Could not update dispatch.");
      setMessage(data.message); load();
    } catch (requestError) { setError(requestError.message); }
  };

  return <div className="h-full overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-6xl space-y-5">
    <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-800 p-6 text-white shadow-xl"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-violet-200">Receipt exception workflow</p><h2 className="mt-2 text-2xl font-black">Goods Returns</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-100">Only rejected GRC quantities appear here. Create a Supplier Return Note, dispatch the rejected goods, then close it after replacement, credit note or refund.</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20"><RefreshCw className="h-4 w-4"/> Refresh</button></div></section>
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</div>}{error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-violet-100 p-3 text-violet-700"><PackageX className="h-5 w-5"/></div><div><h3 className="font-black text-slate-900">Create supplier return note</h3><p className="text-sm text-slate-500">This does not reduce stock—rejected goods never entered inventory.</p></div></div>
      <select value={selected} onChange={(e) => { setSelected(e.target.value); setQuantities({}); }} className="mt-5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold"><option value="">Select a GRC with rejected quantity</option>{eligible.map((row) => <option key={row.grc_id} value={row.grc_id}>{row.grc_no || "GRC"} · {row.po_no || "No PO"} · {row.vendor_name}</option>)}</select>
      {current && <div className="mt-4 overflow-hidden rounded-xl border border-slate-200"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Item</th><th className="p-3">Rejected</th><th className="p-3">Available to return</th><th className="p-3">Rate</th><th className="p-3">Return qty</th></tr></thead><tbody>{current.lines.map((line) => <tr key={line.grc_item_index} className="border-t border-slate-100"><td className="p-3 font-bold text-slate-800">{line.description || line.barcode || "Unnamed item"}<div className="text-xs font-normal text-slate-500">{line.rejection_reason || "Rejected during GRC"}</div></td><td className="p-3">{qty(line.rejected_quantity)}</td><td className="p-3 font-bold text-rose-600">{qty(line.returnable_quantity)}</td><td className="p-3">{money(line.rate)}</td><td className="p-3"><input type="number" min="0" max={line.returnable_quantity} step="0.01" value={quantities[line.grc_item_index] ?? ""} onChange={(e) => setQuantities({ ...quantities, [line.grc_item_index]: e.target.value })} className="w-28 rounded-lg border border-slate-200 px-2 py-1.5"/></td></tr>)}</tbody></table></div><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the supplier" className="m-3 w-[calc(100%-1.5rem)] rounded-lg border border-slate-200 p-2 text-sm"/><button onClick={createReturn} className="m-3 mt-0 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white hover:bg-indigo-700"><Send className="h-4 w-4"/> Create return note</button></div>}
      {!loading && !eligible.length && <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No rejected GRC quantity is waiting for a supplier return.</p>}</section>
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-3 border-b border-slate-100 p-5"><ClipboardCheck className="h-5 w-5 text-indigo-600"/><div><h3 className="font-black text-slate-900">Supplier return register</h3><p className="text-sm text-slate-500">Track acknowledgement, dispatch and final commercial resolution.</p></div></div><div className="divide-y divide-slate-100">{notes.map((row) => <div key={row.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div><div className="font-black text-slate-900">{row.srn_no} <span className="ml-2 text-sm font-semibold text-slate-500">{row.vendor_name}</span></div><div className="mt-1 text-sm text-slate-500">GRC {row.grc_no || "—"} · {row.lines?.length || 0} item(s) · {money(row.total_value)} · {row.vendor_response_status || "Awaiting response"}</div></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{row.dispatch_status || "PendingDispatch"}</span>{row.status === "Open" && row.dispatch_status !== "Dispatched" && <button onClick={() => dispatch(row.id)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white"><Truck className="h-3.5 w-3.5"/> Mark dispatched</button>}{row.status === "Closed" && <CheckCircle2 className="h-5 w-5 text-emerald-600"/>}</div></div>)}{!loading && !notes.length && <p className="p-6 text-sm text-slate-500">No supplier return notes created yet.</p>}</div></section>
  </div></div>;
}