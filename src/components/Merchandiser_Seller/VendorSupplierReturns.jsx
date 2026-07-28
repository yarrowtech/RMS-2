import React, { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/api.js";
import { CheckCircle2, CircleAlert, ClipboardList, Loader2, RefreshCw, RotateCcw, Send, Truck } from "lucide-react";

function headers(json = false) {
  const token = localStorage.getItem("vendor_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) };
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/supplier-returns${path}`, {
    ...options,
    headers: { ...headers(Boolean(options.body)), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Request failed");
  return data;
}

const statusClass = (status) => ({
  Open: "bg-amber-50 text-amber-700 ring-amber-200",
  Closed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
}[status] || "bg-slate-100 text-slate-600 ring-slate-200");

const responseClass = (status) => ({
  Acknowledged: "bg-sky-50 text-sky-700 ring-sky-200",
  ReplacementOffered: "bg-violet-50 text-violet-700 ring-violet-200",
  CreditNoteOffered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Disputed: "bg-rose-50 text-rose-700 ring-rose-200",
}[status] || "bg-slate-100 text-slate-600 ring-slate-200");

export default function VendorSupplierReturns() {
  const [returns, setReturns] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await api("/vendor/me"); setReturns(data.data || []); }
    catch (err) { setError(err.message || "Could not load supplier returns."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const respond = async (item, action) => {
    setSavingId(item._id); setError("");
    try {
      const data = await api(`/vendor/${item._id}/respond`, {
        method: "PATCH",
        body: JSON.stringify({ action, note: notes[item._id] || "" }),
      });
      setNotice(`${data.data.srn_no} updated.`);
      await load();
    } catch (err) { setError(err.message || "Could not update the return."); }
    finally { setSavingId(""); }
  };

  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-rose-950 via-orange-900 to-amber-700 p-6 text-white shadow-lg sm:p-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"><RotateCcw className="h-6 w-6 text-amber-100" /></div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Supplier Returns</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-amber-50/85">Returns raised by your retail buyers for quantities rejected at receipt. Respond with an acknowledgement, replacement or credit-note proposal.</p></div>
        <button onClick={load} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold hover:bg-white/15 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
      </div>
    </section>

    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}

    {loading ? <div className="grid min-h-72 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></div> : returns.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-20 text-center shadow-sm"><ClipboardList className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-4 font-black text-slate-800">No supplier returns yet</h2><p className="mt-2 text-sm text-slate-500">When a connected retailer rejects goods in a GRC and raises a Supplier Return Note, it will appear here.</p></div> : <div className="space-y-4">{returns.map((item) => {
      const isClosed = item.status === "Closed" || item.status === "Cancelled";
      const isSaving = savingId === item._id;
      return <article key={item._id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-orange-50 via-white to-rose-50 px-5 py-4 sm:px-6"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-black text-slate-900">{item.srn_no}</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ring-1 ${statusClass(item.status)}`}>{item.status}</span>{item.vendor_response_status && <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ring-1 ${responseClass(item.vendor_response_status)}`}>{item.vendor_response_status}</span>}</div><p className="mt-1 text-sm text-slate-600">Buyer: <span className="font-bold text-slate-800">{item.retailer_name || "Retailer"}</span> · GRC: {item.grc_no || "—"} · PO: {item.po_no || "—"}</p></div><div className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Truck className="h-4 w-4 text-orange-600" />{item.dispatch_status === "Dispatched" ? `Dispatched ${item.dispatched_at ? new Date(item.dispatched_at).toLocaleDateString() : ""}` : "Awaiting retailer dispatch"}</div></div></div>
        <div className="p-5 sm:p-6"><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Barcode</th><th className="px-4 py-3 text-right">Return qty</th><th className="px-4 py-3">Reason</th></tr></thead><tbody>{(item.lines || []).map((line, index) => <tr key={`${item._id}-${index}`} className="border-t border-slate-100 text-slate-700"><td className="px-4 py-3 font-bold">{line.description || "Item"}</td><td className="px-4 py-3 font-mono text-slate-500">{line.vendor_barcode || line.rms_barcode || "—"}</td><td className="px-4 py-3 text-right font-black text-rose-600">{line.quantity}</td><td className="px-4 py-3">{line.reason || "Rejected at receipt"}</td></tr>)}</tbody></table></div>
          {item.note && <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><span className="font-bold text-slate-800">Buyer note:</span> {item.note}</p>}
          {item.vendor_response_note && <p className="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800"><span className="font-bold">Your latest response:</span> {item.vendor_response_note}</p>}
          {!isClosed && <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50/60 p-4"><div className="flex items-center gap-2"><Send className="h-4 w-4 text-orange-600" /><h3 className="text-sm font-black text-slate-800">Respond to this return</h3></div><textarea value={notes[item._id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [item._id]: event.target.value }))} maxLength={600} className="mt-3 min-h-20 w-full rounded-xl border border-orange-100 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400" placeholder="Add a reference, credit note number, replacement date or dispute reason..." /><div className="mt-3 flex flex-wrap gap-2"><button disabled={isSaving} onClick={() => respond(item, "acknowledge")} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" />Acknowledge</button><button disabled={isSaving} onClick={() => respond(item, "replacement")} className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-50">Offer replacement</button><button disabled={isSaving} onClick={() => respond(item, "credit_note")} className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Offer credit note</button><button disabled={isSaving} onClick={() => respond(item, "dispute")} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><CircleAlert className="h-3.5 w-3.5" />Dispute</button></div></div>}
        </div>
      </article>;
    })}</div>}
  </div>;
}