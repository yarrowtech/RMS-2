// Floor Log Kiosk — a worker's OWN side of the Daily Floor Log, opened from
// a shared link/QR on a floor tablet or PC. No login (floor workers never
// have one anywhere in RMS): pick your name, tap Start when you begin a
// task, tap End when you're done and fill in what you actually did. HQ's
// own Daily Floor Log tab (manual entry + Excel bulk upload) is completely
// separate and unaffected — this is just another entry point into the same
// data, same as the Workstation Display is another view onto production
// batches.
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, ClipboardList, Clock, Plus, X } from "lucide-react";
import { API_BASE_URL } from "../config/api.js";

const BTN = "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-black transition disabled:cursor-not-allowed disabled:opacity-40";
const BTN_PRIMARY = `${BTN} bg-violet-600 text-white shadow-lg hover:bg-violet-700 active:scale-[0.98]`;
const BTN_GHOST = `${BTN} border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;

async function kioskApi(token, path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/design-pattern/floor-kiosk/${token}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Something went wrong — try again.");
  return data;
}

function elapsedLabel(startedAt) {
  if (!startedAt) return "0m";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function FloorLogKiosk() {
  const { token } = useParams();
  const [loadError, setLoadError] = useState("");
  const [context, setContext] = useState(null);
  const [step, setStep] = useState("pick"); // pick -> active -> end -> done
  const [department, setDepartment] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [designNo, setDesignNo] = useState("");
  const [designPreview, setDesignPreview] = useState(null); // live lookup as they type — style/garment/gender, never typed by hand
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [session, setSession] = useState(null);
  const [tick, setTick] = useState(0); // forces the elapsed-time label to re-render every minute
  const [endForm, setEndForm] = useState({ design_no: "", fabric_lot_id: "", rejected_qty: "", rework_qty: "", fabric_used_mtrs: "", remarks: "" });
  const [sizeRows, setSizeRows] = useState([]);
  const [wasteRows, setWasteRows] = useState([]);
  const [doneResult, setDoneResult] = useState(null);
  const [fabricLots, setFabricLots] = useState([]);
  const [showNewLot, setShowNewLot] = useState(false);
  const [newLot, setNewLot] = useState({ fabric_name: "", lot_no: "", colour: "", width: "", gsm: "", unit: "MTR", received_qty: "" });
  const [lotBusy, setLotBusy] = useState(false);

  useEffect(() => {
    kioskApi(token, "/context").then((r) => setContext(r.data)).catch((e) => setLoadError(e.message));
  }, [token]);
  useEffect(() => {
    if (step !== "active") return undefined;
    const timer = window.setInterval(() => setTick((x) => x + 1), 30000);
    return () => window.clearInterval(timer);
  }, [step]);
  // Live preview as the worker types a Design No. — style name, garment
  // type and gender/segment show up automatically from the matching Design
  // Project; nothing here is ever typed by the worker, just confirmed.
  useEffect(() => {
    const q = designNo.trim();
    if (!q) { setDesignPreview(null); return undefined; }
    const timer = window.setTimeout(() => {
      kioskApi(token, `/design-lookup?design_no=${encodeURIComponent(q)}`).then((r) => setDesignPreview(r.data)).catch(() => setDesignPreview(null));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [designNo, token]);

  const wasteCategoryOptions = useMemo(() => {
    const all = context?.wastage_categories || [];
    if (!department) return all;
    const scoped = all.filter((c) => (c.departments || []).includes(department));
    return scoped.length ? scoped : all;
  }, [context, department]);

  const checkIn = async () => {
    const name = workerName.trim();
    const design = designNo.trim();
    if (!department || !name || !design) return;
    setBusy(true); setActionError("");
    try {
      // If this worker already has a session open (e.g. they tapped Start,
      // walked to the floor, and are coming back to the kiosk later), pick
      // that up instead of starting a second one.
      const open = await kioskApi(token, `/open?worker_name=${encodeURIComponent(name)}`);
      const existing = (open.data || [])[0];
      if (existing) { setSession(existing); setStep("active"); return; }
      const started = await kioskApi(token, "/start", { method: "POST", body: JSON.stringify({ department, worker_id: workerId, worker_name: name, design_no: design }) });
      setSession(started.data);
      setStep("active");
    } catch (e) { setActionError(e.message); }
    finally { setBusy(false); }
  };

  const submitEnd = async (e) => {
    e.preventDefault();
    setBusy(true); setActionError("");
    try {
      const payload = {
        design_no: endForm.design_no, fabric_lot_id: endForm.fabric_lot_id || undefined,
        rejected_qty: endForm.rejected_qty || 0, rework_qty: endForm.rework_qty || 0,
        fabric_used_mtrs: endForm.fabric_used_mtrs || 0, remarks: endForm.remarks,
        size_breakdown: sizeRows.filter((r) => r.size && Number(r.qty) > 0).map((r) => ({ size: r.size, qty: Number(r.qty) })),
        wastage_breakdown: wasteRows.filter((r) => r.category && Number(r.qty) > 0).map((r) => ({ category: r.category, qty: Number(r.qty) })),
      };
      const result = await kioskApi(token, `/${session.id}/end`, { method: "POST", body: JSON.stringify(payload) });
      setDoneResult(result.data);
      setStep("done");
    } catch (e) { setActionError(e.message); }
    finally { setBusy(false); }
  };

  const addQuickLot = async () => {
    if (!newLot.fabric_name.trim() || !newLot.lot_no.trim() || !Number(newLot.received_qty)) return;
    setLotBusy(true); setActionError("");
    try {
      const created = await kioskApi(token, "/quick-lot", { method: "POST", body: JSON.stringify({ ...newLot, design_no: endForm.design_no, worker_name: session?.worker_name }) });
      setFabricLots([...fabricLots, created.data]);
      setEndForm({ ...endForm, fabric_lot_id: created.data.id });
      setShowNewLot(false);
      setNewLot({ fabric_name: "", lot_no: "", colour: "", width: "", gsm: "", unit: "MTR", received_qty: "" });
    } catch (e) { setActionError(e.message); }
    finally { setLotBusy(false); }
  };

  const startOver = () => {
    setStep("pick"); setDepartment(""); setWorkerId(""); setWorkerName(""); setDesignNo(""); setDesignPreview(null); setSession(null);
    setEndForm({ design_no: "", fabric_lot_id: "", rejected_qty: "", rework_qty: "", fabric_used_mtrs: "", remarks: "" });
    setFabricLots([]); setShowNewLot(false); setNewLot({ fabric_name: "", lot_no: "", colour: "", width: "", gsm: "", unit: "MTR", received_qty: "" });
    setSizeRows([]); setWasteRows([]); setDoneResult(null); setActionError("");
  };

  if (loadError) {
    return <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-center text-white"><div><p className="text-2xl font-black">Kiosk link not available</p><p className="mt-2 text-slate-400">{loadError}</p></div></div>;
  }
  if (!context) {
    return <div className="grid min-h-screen place-items-center bg-slate-950 text-lg font-black text-white">Loading floor log kiosk…</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-950 via-slate-950 to-slate-950 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-xl">
        <header className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-600"><ClipboardList size={22} /></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Daily Floor Log</p><h1 className="text-xl font-black">Log your work</h1></div>
        </header>

        {actionError && <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-bold text-rose-200">{actionError}</div>}

        {step === "pick" && (
          <div className="space-y-5">
            <section>
              <p className="mb-2 text-sm font-bold uppercase tracking-wide text-violet-300">1. Which department?</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(context.departments || []).map((d) => (
                  <button key={d.name} onClick={() => setDepartment(d.name)} className={`rounded-2xl border-2 p-4 text-center font-black transition ${department === d.name ? "border-violet-400 bg-violet-500/20 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>{d.name}</button>
                ))}
              </div>
            </section>
            {department && (
              <section>
                <p className="mb-2 text-sm font-bold uppercase tracking-wide text-violet-300">2. Who are you?</p>
                <div className="flex flex-wrap gap-2">
                  {(context.workers || []).filter((w) => (w.departments || []).includes(department) || !(w.departments || []).length).map((w) => (
                    <button key={w.id} onClick={() => { setWorkerId(w.id); setWorkerName(w.name); }} className={`rounded-xl border-2 px-4 py-2.5 font-bold ${workerId === w.id ? "border-violet-400 bg-violet-500/20" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>{w.name}</button>
                  ))}
                </div>
                <p className="mb-1 mt-3 text-xs font-bold text-slate-400">Not in the list? Type your name:</p>
                <input value={workerId ? "" : workerName} onChange={(e) => { setWorkerId(""); setWorkerName(e.target.value); }} placeholder="Your full name" className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-violet-400" />
              </section>
            )}
            {department && workerName.trim() && (
              <section>
                <p className="mb-2 text-sm font-bold uppercase tracking-wide text-violet-300">3. Which Design No.?</p>
                <input value={designNo} onChange={(e) => setDesignNo(e.target.value)} placeholder="e.g. D-101" className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-violet-400" />
                {designPreview?.found && (
                  <div className="mt-2 rounded-xl border-2 border-emerald-400/30 bg-emerald-500/10 p-3">
                    <p className="font-bold text-emerald-200">{designPreview.style_name}</p>
                    <p className="text-xs text-emerald-300/80">{[designPreview.garment_type, designPreview.gender_segment].filter(Boolean).join(" · ") || "No garment type/segment on file for this design"}</p>
                  </div>
                )}
                {designNo.trim() && designPreview && !designPreview.found && (
                  <p className="mt-2 text-xs text-amber-300">No design record found for this number — you can still log against it.</p>
                )}
              </section>
            )}
            {department && workerName.trim() && designNo.trim() && (
              <button onClick={checkIn} disabled={busy} className={`${BTN_PRIMARY} w-full`}><Clock size={20} />{busy ? "Checking…" : "Start"}</button>
            )}
          </div>
        )}

        {step === "active" && session && (
          <div className="space-y-6 text-center">
            <div className="rounded-3xl border-2 border-emerald-400/30 bg-emerald-500/10 p-8">
              <p className="text-sm font-bold uppercase tracking-wide text-emerald-300">Working on</p>
              <p className="mt-1 text-2xl font-black">{session.department}</p>
              <p className="mt-1 text-slate-300">{session.worker_name}{session.design_no ? ` · ${session.design_no}` : ""}</p>
              {(session.garment_type || session.gender_segment) && <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-emerald-400/80">{[session.garment_type, session.gender_segment].filter(Boolean).join(" · ")}</p>}
              <p className="mt-4 text-4xl font-black text-emerald-300">{elapsedLabel(session.started_at)}</p>
              <p className="text-xs text-slate-400">elapsed since you tapped Start</p>
            </div>
            <button onClick={() => {
              setEndForm({ ...endForm, design_no: session.design_no || "" });
              kioskApi(token, `/fabric-lots?design_no=${encodeURIComponent(session.design_no || "")}`).then((r) => setFabricLots(r.data || [])).catch(() => setFabricLots([]));
              // Pre-fill size rows from the pattern's own size ratio (Step 4)
              // — the worker just fills in real counts instead of typing
              // "S"/"M"/"L" from scratch every time. Purely a starting
              // point: they can still add, remove or rename any row.
              if ((session.pattern_size_ratio || []).length) setSizeRows(session.pattern_size_ratio.map((r) => ({ size: r.size, qty: "" })));
              setStep("end");
            }} className={`${BTN_PRIMARY} w-full`}><CheckCircle2 size={20} />Done — End &amp; log my work</button>
          </div>
        )}

        {step === "end" && session && (
          <form onSubmit={submitEnd} className="space-y-5">
            <p className="text-sm text-slate-300">Ending your <b>{session.department}</b> session, started {elapsedLabel(session.started_at)} ago. Fill in what you actually did — the rest is calculated for you.</p>
            <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-400">Design No. (from Start — change only if it was wrong)</span><input value={endForm.design_no} onChange={(e) => setEndForm({ ...endForm, design_no: e.target.value })} className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-violet-400" /></label>

            <div className="rounded-2xl border-2 border-white/10 bg-white/5 p-4">
              <p className="mb-2 text-xs font-bold uppercase text-slate-400">Which fabric roll? (optional — leave blank to skip)</p>
              {fabricLots.length > 0 && (
                <select value={endForm.fabric_lot_id} onChange={(e) => setEndForm({ ...endForm, fabric_lot_id: e.target.value })} className="w-full rounded-xl border-2 border-white/10 bg-white/10 px-3 py-2.5 text-white outline-none focus:border-violet-400">
                  <option value="">Select a fabric roll</option>
                  {fabricLots.map((l) => <option key={l.id} value={l.id}>{l.lot_no} — {[l.fabric_name, l.colour, l.width].filter(Boolean).join(" · ")} ({l.closing_balance} {l.unit} left)</option>)}
                </select>
              )}
              {!fabricLots.length && <p className="text-xs text-slate-500">No fabric lot found for this design yet.</p>}
              {!showNewLot && <button type="button" onClick={() => setShowNewLot(true)} className="mt-2 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold"><Plus size={14} className="inline" /> This roll isn't in the list — add it</button>}
              {showNewLot && (
                <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                  <input placeholder="Fabric name" value={newLot.fabric_name} onChange={(e) => setNewLot({ ...newLot, fabric_name: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-sm text-white" />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Lot No." value={newLot.lot_no} onChange={(e) => setNewLot({ ...newLot, lot_no: e.target.value })} className="rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-sm text-white" />
                    <input placeholder="Colour" value={newLot.colour} onChange={(e) => setNewLot({ ...newLot, colour: e.target.value })} className="rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-sm text-white" />
                    <input placeholder="Width" value={newLot.width} onChange={(e) => setNewLot({ ...newLot, width: e.target.value })} className="rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-sm text-white" />
                    <input placeholder="GSM" value={newLot.gsm} onChange={(e) => setNewLot({ ...newLot, gsm: e.target.value })} className="rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-sm text-white" />
                    <input type="number" min="0.01" step="0.01" placeholder="Qty received" value={newLot.received_qty} onChange={(e) => setNewLot({ ...newLot, received_qty: e.target.value })} className="rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-sm text-white" />
                    <select value={newLot.unit} onChange={(e) => setNewLot({ ...newLot, unit: e.target.value })} className="rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-sm text-white"><option value="MTR">MTR</option><option value="KG">KG</option><option value="UNIT">UNIT</option></select>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={addQuickLot} disabled={lotBusy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold disabled:opacity-40">{lotBusy ? "Adding…" : "Add this roll"}</button>
                    <button type="button" onClick={() => setShowNewLot(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold">Cancel</button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border-2 border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase text-slate-400">Pieces by size (optional)</p><button type="button" onClick={() => setSizeRows([...sizeRows, { size: "", qty: "" }])} className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold"><Plus size={14} className="inline" /> Add size</button></div>
              {(session.pattern_size_ratio || []).length > 0 && <p className="mb-2 text-[11px] text-slate-400">Pre-filled from this design's size ratio — just enter the actual counts, add or remove rows as needed.</p>}
              {sizeRows.map((row, i) => {
                const suggested = (session.pattern_size_ratio || []).find((r) => r.size === row.size)?.ratio_pct;
                return (
                <div key={i} className="mb-2 flex items-center gap-2">
                  <input placeholder="Size" value={row.size} onChange={(e) => setSizeRows(sizeRows.map((r, n) => n === i ? { ...r, size: e.target.value } : r))} className="w-24 rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-sm text-white" />
                  <input type="number" min="0" placeholder="Qty" value={row.qty} onChange={(e) => setSizeRows(sizeRows.map((r, n) => n === i ? { ...r, qty: e.target.value } : r))} className="w-20 rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-sm text-white" />
                  {suggested != null && <span className="text-[10px] text-slate-500">suggested {suggested}%</span>}
                  <button type="button" onClick={() => setSizeRows(sizeRows.filter((_, n) => n !== i))} className="ml-auto text-rose-400"><X size={18} /></button>
                </div>
                );
              })}
            </div>

            <div className="rounded-2xl border-2 border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase text-slate-400">Wastage by category (optional)</p><button type="button" onClick={() => setWasteRows([...wasteRows, { category: "", qty: "" }])} className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold"><Plus size={14} className="inline" /> Add</button></div>
              {wasteRows.map((row, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <select value={row.category} onChange={(e) => setWasteRows(wasteRows.map((r, n) => n === i ? { ...r, category: e.target.value } : r))} className="flex-1 rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-sm text-white"><option value="">Select</option>{wasteCategoryOptions.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select>
                  <input type="number" min="0" step="0.01" placeholder="Qty" value={row.qty} onChange={(e) => setWasteRows(wasteRows.map((r, n) => n === i ? { ...r, qty: e.target.value } : r))} className="w-20 rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-sm text-white" />
                  <button type="button" onClick={() => setWasteRows(wasteRows.filter((_, n) => n !== i))} className="text-rose-400"><X size={18} /></button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-400">Rejected qty</span><input type="number" min="0" value={endForm.rejected_qty} onChange={(e) => setEndForm({ ...endForm, rejected_qty: e.target.value })} className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-violet-400" /></label>
              <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-400">Rework qty</span><input type="number" min="0" value={endForm.rework_qty} onChange={(e) => setEndForm({ ...endForm, rework_qty: e.target.value })} className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-violet-400" /></label>
            </div>
            <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-400">Fabric used (mtrs)</span><input type="number" min="0" step="0.01" value={endForm.fabric_used_mtrs} onChange={(e) => setEndForm({ ...endForm, fabric_used_mtrs: e.target.value })} className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-violet-400" /></label>
            <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-400">Remarks</span><textarea rows="2" value={endForm.remarks} onChange={(e) => setEndForm({ ...endForm, remarks: e.target.value })} className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none focus:border-violet-400" /></label>

            <button type="submit" disabled={busy} className={`${BTN_PRIMARY} w-full`}>{busy ? "Saving…" : "Submit my log"}</button>
          </form>
        )}

        {step === "done" && doneResult && (
          <div className="space-y-5 text-center">
            <div className="rounded-3xl border-2 border-emerald-400/30 bg-emerald-500/10 p-8">
              <CheckCircle2 size={48} className="mx-auto text-emerald-300" />
              <p className="mt-3 text-2xl font-black">Nice work, {doneResult.worker_name}!</p>
              <p className="mt-1 text-slate-300">{doneResult.department}{doneResult.design_no ? ` · ${doneResult.design_no}` : ""} · {doneResult.elapsed_minutes} min logged</p>
              {(doneResult.garment_type || doneResult.gender_segment) && <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-emerald-400/80">{[doneResult.garment_type, doneResult.gender_segment].filter(Boolean).join(" · ")}</p>}
              {doneResult.completed_qty > 0 && <p className="mt-2 text-lg font-bold text-emerald-300">{doneResult.completed_qty} pcs completed</p>}
            </div>
            <button onClick={startOver} className={`${BTN_GHOST} w-full !border-white/20 !bg-white/5 !text-white`}>Log another entry</button>
          </div>
        )}
      </div>
    </div>
  );
}
