import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../config/api.js";
import { CheckCircle2, ClipboardList, Loader2, PackageX, RefreshCw, Send, Truck } from "lucide-react";

function authHeaders(json = false) {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) };
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/supplier-returns${path}`, {
    ...options,
    headers: { ...authHeaders(Boolean(options.body)), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Request failed");
  return data;
}

const statusStyle = (status) => ({
  Open: "bg-amber-50 text-amber-700 ring-amber-200",
  Closed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
}[status] || "bg-slate-100 text-slate-600 ring-slate-200");

export default function SupplierReturnRegister() {
  const [eligible, setEligible] = useState([]);
  const [returns, setReturns] = useState([]);
  const [selectedGrcId, setSelectedGrcId] = useState("");
  const [lineForms, setLineForms] = useState({});
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedGrc = useMemo(() => eligible.find((item) => item.grc_id === selectedGrcId), [eligible, selectedGrcId]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [eligibleData, returnData] = await Promise.all([api("/eligible-grcs"), api("/")]);
      setEligible(eligibleData.data || []);
      setReturns(returnData.data || []);
    } catch (err) { setError(err.message || "Could not load supplier returns."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const chooseGrc = (grcId) => {
    setSelectedGrcId(grcId);
    const grc = eligible.find((item) => item.grc_id === grcId);
    const next = {};
    (grc?.lines || []).forEach((line) => {
      next[line.grc_item_index] = { selected: true, quantity: String(line.returnable_quantity), reason: line.rejection_reason || "Damaged / rejected at receipt" };
    });
    setLineForms(next); setNote("");
  };

  const updateLine = (lineIndex, field, value) => setLineForms((current) => ({ ...current, [lineIndex]: { ...current[lineIndex], [field]: value } }));

  const createReturn = async () => {
    const lines = (selectedGrc?.lines || []).filter((line) => lineForms[line.grc_item_index]?.selected).map((line) => ({
      grc_item_index: line.grc_item_index,
      quantity: Number(lineForms[line.grc_item_index]?.quantity || 0),
      reason: lineForms[line.grc_item_index]?.reason || "",
    }));
    if (!selectedGrc || lines.length === 0) { setError("Select a GRC and at least one rejected item."); return; }
    if (lines.some((line) => !line.quantity || line.quantity <= 0 || !line.reason.trim())) { setError("Every selected line needs a quantity and return reason."); return; }
    setSaving(true); setError("");
    try {
      const data = await api("/", { method: "POST", body: JSON.stringify({ grc_id: selectedGrc.grc_id, lines, note }) });
      setNotice(`${data.data.srn_no} created. The vendor can now acknowledge the return in their portal.`);
      setSelectedGrcId(""); setLineForms({}); setNote(""); await load();
    } catch (err) { setError(err.message || "Could not create Supplier Return Note."); }
    finally { setSaving(false); }
  };

  const dispatchReturn = async (item) => {
    setSaving(true); setError("");
    try { const data = await api(`/${item.id}/dispatch`, { method: "PATCH" }); setNotice(data.message); await load(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const closeReturn = async (item) => {
    const resolution = window.prompt("How was this return settled? Example: Credit note issued, replacement received, refund processed.");
    if (!resolution?.trim()) return;
    const referenceNo = window.prompt("Optional credit note, replacement, or refund reference number:") || "";
    setSaving(true); setError("");
    try { const data = await api(`/${item.id}/close`, { method: "PATCH", body: JSON.stringify({ resolution, reference_no: referenceNo }) }); setNotice(data.message); await load(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-rose-950 to-orange-900 p-6 text-white shadow-lg sm:p-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"><PackageX className="h-6 w-6 text-rose-200" /></div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Supplier Return Register</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Create a Supplier Return Note from rejected GRC quantities, track dispatch, and record the vendor's replacement, credit note or refund outcome.</p></div><button onClick={load} disabled={loading || saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold hover:bg-white/15 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button></div>
    </section>

    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600"><ClipboardList className="h-5 w-5" /></span><div><h2 className="font-black text-slate-900">Create Supplier Return Note</h2><p className="mt-1 text-sm leading-6 text-slate-500">Only rejected GRC quantities are available here. They never entered sellable inventory, so creating or dispatching this note does not reduce stock again.</p></div></div>
      {loading ? <div className="grid min-h-36 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-rose-600" /></div> : eligible.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">No rejected GRC quantity is awaiting a Supplier Return Note.</div> : <div className="mt-5 space-y-4"><label className="block text-xs font-black uppercase tracking-wide text-slate-500">Select rejected GRC<select value={selectedGrcId} onChange={(event) => chooseGrc(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-rose-500"><option value="">Select GRC with rejected items</option>{eligible.map((grc) => <option value={grc.grc_id} key={grc.grc_id}>{grc.grc_no} · {grc.vendor_name} · {grc.po_no || "Direct receipt"}</option>)}</select></label>
      {selectedGrc && <><div className={`rounded-xl border px-4 py-3 text-xs ${selectedGrc.registered_vendor ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{selectedGrc.registered_vendor ? "Registered vendor: this Supplier Return Note will be visible in the vendor portal." : "External/walk-in vendor: the note can be tracked here, but it cannot be shown in a vendor portal without a registered vendor account."}</div><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Return</th><th className="px-3 py-3">Item</th><th className="px-3 py-3 text-right">Rejected available</th><th className="px-3 py-3">Quantity</th><th className="px-3 py-3">Reason</th></tr></thead><tbody>{selectedGrc.lines.map((line) => { const form = lineForms[line.grc_item_index] || {}; return <tr key={line.grc_item_index} className="border-t border-slate-100"><td className="px-3 py-3"><input type="checkbox" checked={Boolean(form.selected)} onChange={(event) => updateLine(line.grc_item_index, "selected", event.target.checked)} /></td><td className="px-3 py-3"><p className="font-bold text-slate-800">{line.description || "Unnamed item"}</p><p className="mt-1 text-[10px] text-slate-400">RMS: {line.barcode || "—"} {line.vendor_barcode ? `· Vendor: ${line.vendor_barcode}` : ""}</p></td><td className="px-3 py-3 text-right font-bold text-rose-600">{line.returnable_quantity}</td><td className="px-3 py-3"><input disabled={!form.selected} type="number" min="0.001" step="0.001" max={line.returnable_quantity} value={form.quantity || ""} onChange={(event) => updateLine(line.grc_item_index, "quantity", event.target.value)} className="h-9 w-28 rounded-lg border border-slate-200 px-2 disabled:bg-slate-50" /></td><td className="px-3 py-3"><input disabled={!form.selected} value={form.reason || ""} onChange={(event) => updateLine(line.grc_item_index, "reason", event.target.value)} className="h-9 min-w-52 rounded-lg border border-slate-200 px-2 disabled:bg-slate-50" placeholder="Damage / quality issue" /></td></tr>; })}</tbody></table></div><textarea value={note} onChange={(event) => setNote(event.target.value)} className="h-20 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-rose-500" placeholder="Optional collection, transport or inspection note" /><div className="flex justify-end"><button disabled={saving} onClick={createReturn} className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"><Send className="h-4 w-4" />Create Supplier Return Note</button></div></>}</div>}
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-black text-slate-900">Return status</h2><p className="mt-1 text-sm text-slate-500">Vendor responses, dispatch and closure are retained as the audit trail.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{returns.length} notes</span></div>{loading ? null : returns.length === 0 ? <div className="py-12 text-center text-sm text-slate-400">No Supplier Return Notes created yet.</div> : <div className="mt-5 space-y-3">{returns.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-900">{item.srn_no}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ring-1 ${statusStyle(item.status)}`}>{item.status}</span></div><p className="mt-1 text-sm text-slate-500">{item.vendor_name} · GRC {item.grc_no} · PO {item.po_no || "—"}</p><p className="mt-2 text-xs font-semibold text-slate-600">Dispatch: {item.dispatch_status} · Vendor: {item.vendor_response_status}</p>{item.vendor_response_note && <p className="mt-1 text-xs text-teal-700">Vendor note: {item.vendor_response_note}</p>}{item.resolution && <p className="mt-1 text-xs text-emerald-700">Resolved: {item.resolution}{item.resolution_reference ? ` · ${item.resolution_reference}` : ""}</p>}</div>{item.status === "Open" && <div className="flex flex-wrap gap-2">{item.dispatch_status !== "Dispatched" && <button disabled={saving} onClick={() => dispatchReturn(item)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"><Truck className="h-3.5 w-3.5" />Mark dispatched</button>}<button disabled={saving} onClick={() => closeReturn(item)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-50"><CheckCircle2 className="h-3.5 w-3.5" />Close</button></div>}</div><div className="mt-3 flex flex-wrap gap-2">{item.lines.map((line, index) => <span key={index} className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-600">{line.description || "Item"}: {line.quantity}</span>)}</div></article>)}</div>}</section>
  </div>;
}