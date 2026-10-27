// Visual Merchandising — Phase 1.
// HQ plans placements (product + floor/zone/rack/shelf + instruction) inside
// a named layout, publishes it to one or more stores. Each store sees its
// tasks, marks them done with a proof photo. HQ/supervisor approves or
// rejects, and gets a per-store compliance view plus data-backed placement
// suggestions (from the existing Demand Forecast — rising items with no
// placement, falling items that still have one).
import React, { useCallback, useEffect, useState } from "react";
import { LayoutGrid, Plus, LogOut, CheckCircle2, XCircle, Camera, Sparkles, TrendingUp, TrendingDown, ClipboardList, Users, Activity } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";
import { getAdminName, getStoreName, isHQAdmin, logoutOrReturnToDepartmentSelector } from "../../utils/authRedirect.js";

function token() {
  return localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

async function vmFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/visual-merchandising${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Visual Merchandising request failed.");
  return data;
}

async function vmUpload(path, file) {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/visual-merchandising${path}`, {
    method: "POST", headers: { Authorization: `Bearer ${token()}` }, body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Upload failed.");
  return data;
}

const STATUS_TONE = {
  DRAFT: "bg-slate-100 text-slate-600", PUBLISHED: "bg-indigo-100 text-indigo-700",
  PENDING: "bg-amber-100 text-amber-800", DONE: "bg-sky-100 text-sky-700", APPROVED: "bg-emerald-100 text-emerald-700",
};
function Badge({ status }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status] || "bg-slate-100 text-slate-600"}`}>{status}</span>;
}

// What each tab does, plus the Phase 3 hardware-integration plan kept
// visible in-app (not just in chat history) so it survives even if nobody
// remembers the conversation where it was agreed.
const TAB_GUIDE = [
  ["Layouts", "HQ plans a named set of product placements (e.g. \"Winter24 Window Reset\"), then publishes it to one or more stores. A store sees only layouts actually published to it."],
  ["Tasks", "One task per (store × placement) is created on publish. A store marks a task done by uploading a proof photo. HQ reviews it in the Tasks tab and approves or rejects with a reason — a rejection sends it back to Pending for the store to redo."],
  ["Compliance", "Per-store rollup: how many of that store's tasks are Approved vs Done-but-unreviewed vs still Pending, as a %. Use this to see which stores are actually executing vs falling behind."],
  ["Suggestions", "Not sensor-based — pulled from the real Demand Forecast (last 90 days). Flags rising-trend items with no active placement (worth a high-visibility spot) and falling-trend items that still have one (candidate to move to clearance)."],
  ["Staffing", "Assign one of a store's own admins as the person covering a floor/zone. This is an org-chart record only — it does NOT control who can complete a task; any admin with Visual Merchandising access at that store can already do that."],
  ["Traffic", "A working shell, not live data. Zones shown come from real published placements, but every visitor count reads \"No data\" because no footfall sensor/camera is connected yet. See the Phase 3 plan below for exactly what turns this on."],
];

const PHASE3_PLAN = {
  decision: "Pick a real footfall data source — this is a hardware/vendor decision, not a coding task:",
  options: [
    "Entrance people-counters (infrared/thermal beam) — cheapest, footfall per entrance only, not per-zone.",
    "In-store cameras + vision analytics — real per-zone dwell time and movement, needs camera coverage per zone + an aggregate-only, no-identity privacy policy.",
    "Wi-Fi/BLE presence beacons — cheaper than cameras, decent per-zone estimates, needs a beacon/AP per zone.",
    "Realistic starting point for a 3-store setup: entrance counters + a couple of Wi-Fi beacons per store. Full camera analytics is more of a Phase 4.",
  ],
  integration: "The integration point already exists and won't change: whatever hardware is picked just needs to WRITE ROWS into the vm_zone_traffic collection — {tenant_id, store_id, floor, zone, date, visitor_count, source}. No new endpoint or UI rework needed; GET /api/visual-merchandising/zone-traffic and this Traffic tab already render real counts the moment rows exist.",
  later: "Once real counts flow in: (1) this tab becomes a real heatmap instead of a table of \"No data\", (2) zone traffic can feed the Suggestions tab as a second signal alongside Demand Forecast trend (e.g. rising item + low-traffic zone → move it somewhere busier), (3) sales-per-zone needs a separate, small POS change to tag a sale to a shelf/rack position — unrelated to sensors, worth doing alongside.",
};

function GuidePanel() {
  const [open, setOpen] = useState(false);
  return (
    <details className="overflow-hidden vm-panel" open={open} onToggle={(e) => setOpen(e.target.open)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3">
        <span className="text-sm font-black text-slate-700">How this module works — read before you forget</span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-600">{open ? "Hide" : "Show guide"}</span>
      </summary>
      <div className="space-y-4 border-t border-slate-100 px-5 py-4">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {TAB_GUIDE.map(([name, text]) => (
            <div key={name} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-black text-slate-900">{name}</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-xs font-black text-indigo-900">Phase 3 plan — how Traffic becomes real (saved here so it isn't lost)</p>
          <p className="mt-2 text-[11px] font-bold text-indigo-800">{PHASE3_PLAN.decision}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-5 text-indigo-900">
            {PHASE3_PLAN.options.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
          <p className="mt-2 text-[11px] leading-5 text-indigo-900"><span className="font-bold">Integration point (already built):</span> {PHASE3_PLAN.integration}</p>
          <p className="mt-2 text-[11px] leading-5 text-indigo-900"><span className="font-bold">Once real data flows:</span> {PHASE3_PLAN.later}</p>
        </div>
      </div>
    </details>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700">⚠ {message}</div>;
}

const inputCls = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const labelCls = "block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1";

/* ── New layout modal ── */
function NewLayoutModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-black text-slate-900">New layout</h3>
        <p className="mt-1 text-sm text-slate-500">A named plan you'll add product placements to, then publish to one or more stores.</p>
        <div className="mt-4 space-y-3">
          <div><label className={labelCls}>Layout name</label><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter24 Window Reset" /></div>
          <div><label className={labelCls}>Notes (optional)</label><textarea className={`${inputCls} min-h-20`} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            disabled={!name.trim() || saving}
            onClick={async () => { setSaving(true); try { await onSave({ name: name.trim(), notes }); } finally { setSaving(false); } }}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >{saving ? "Creating…" : "Create layout"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Add placement form (inline, inside layout detail) ── */
function AddPlacementForm({ layoutId, onAdded }) {
  const empty = { barcode: "", product_name: "", sku: "", floor: "", zone: "", rack: "", shelf: "", instruction: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true); setError("");
    try {
      await vmFetch(`/layouts/${layoutId}/placements`, { method: "POST", body: JSON.stringify(form) });
      setForm(empty);
      onAdded();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Add a placement</p>
      <ErrorBanner message={error} />
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <input className={inputCls} placeholder="Product name" value={form.product_name} onChange={(e) => set("product_name", e.target.value)} />
        <input className={inputCls} placeholder="Barcode (optional — autofills name)" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />
        <input className={inputCls} placeholder="SKU (optional)" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
        <input className={inputCls} placeholder="Floor" value={form.floor} onChange={(e) => set("floor", e.target.value)} />
        <input className={inputCls} placeholder="Zone" value={form.zone} onChange={(e) => set("zone", e.target.value)} />
        <input className={inputCls} placeholder="Rack" value={form.rack} onChange={(e) => set("rack", e.target.value)} />
        <input className={inputCls} placeholder="Shelf" value={form.shelf} onChange={(e) => set("shelf", e.target.value)} />
        <input className={`${inputCls} sm:col-span-2`} placeholder="Instruction for the store (e.g. face-out, eye level)" value={form.instruction} onChange={(e) => set("instruction", e.target.value)} />
      </div>
      <button onClick={submit} disabled={saving} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">{saving ? "Adding…" : "+ Add placement"}</button>
    </div>
  );
}

/* ── Publish modal ── */
function PublishModal({ layout, stores, onClose, onPublished }) {
  const [selected, setSelected] = useState(new Set());
  const [allStores, setAllStores] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const toggle = (id) => setSelected((s) => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const submit = async () => {
    setPublishing(true); setError("");
    try {
      const store_ids = allStores ? [] : Array.from(selected);
      const result = await vmFetch(`/layouts/${layout.id}/publish`, { method: "POST", body: JSON.stringify({ store_ids }) });
      onPublished(result);
    } catch (e) { setError(e.message); } finally { setPublishing(false); }
  };

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-black text-slate-900">Publish "{layout.name}"</h3>
        <p className="mt-1 text-sm text-slate-500">Creates one task per placement, per chosen store. Placements can't be edited after this.</p>
        <ErrorBanner message={error} />
        <label className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={allStores} onChange={(e) => setAllStores(e.target.checked)} /> Every store</label>
        {!allStores && (
          <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-3">
            {stores.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} /> {s.name}</label>
            ))}
            {!stores.length && <p className="text-xs text-slate-400">No stores set up yet.</p>}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={publishing || (!allStores && !selected.size)} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{publishing ? "Publishing…" : "Publish"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Layout detail (placements + publish) ── */
function LayoutDetail({ layout, onBack, onChanged }) {
  const [placements, setPlacements] = useState([]);
  const [stores, setStores] = useState([]);
  const [showPublish, setShowPublish] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const rows = await vmFetch(`/layouts/${layout.id}/placements`);
      setPlacements(rows);
    } catch (e) { setError(e.message); }
  }, [layout.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch(`${API_BASE_URL}/hq/stores`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json()).then((res) => {
        const flat = [];
        for (const s of res.data || []) { flat.push({ id: s.id, name: s.name }); for (const b of s.branches || []) flat.push({ id: b.id, name: `${s.name} - ${b.name}` }); }
        setStores(flat);
      }).catch(() => {});
  }, []);

  const removePlacement = async (id) => {
    try { await vmFetch(`/placements/${id}`, { method: "DELETE" }); load(); } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm font-bold text-indigo-700 hover:underline">← Back to layouts</button>
      <ErrorBanner message={error} />
      <div className="vm-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-black text-slate-900">{layout.name}</h2><p className="text-sm text-slate-500">{layout.notes || "No notes."}</p></div>
          <div className="flex items-center gap-2"><Badge status={layout.status} />{layout.status === "DRAFT" && <button onClick={() => setShowPublish(true)} disabled={!placements.length} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40">Publish</button>}</div>
        </div>
      </div>

      {layout.status === "DRAFT" && <AddPlacementForm layoutId={layout.id} onAdded={load} />}

      <div className="vm-panel overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3"><h4 className="text-sm font-bold text-slate-900">Placements ({placements.length})</h4></div>
        <div className="divide-y divide-slate-100">
          {placements.length === 0 ? <p className="p-5 text-sm text-slate-400">No placements yet.</p> : placements.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{p.product_name || p.barcode || "Unnamed item"}{p.sku && <span className="ml-2 font-mono text-xs text-slate-400">{p.sku}</span>}</p>
                <p className="text-xs text-slate-500">{[p.floor && `Floor ${p.floor}`, p.zone, p.rack && `Rack ${p.rack}`, p.shelf && `Shelf ${p.shelf}`].filter(Boolean).join(" / ")}</p>
                {p.instruction && <p className="mt-0.5 text-xs italic text-slate-400">"{p.instruction}"</p>}
              </div>
              {layout.status === "DRAFT" && <button onClick={() => removePlacement(p.id)} className="text-xs font-bold text-rose-600 hover:underline">Remove</button>}
            </div>
          ))}
        </div>
      </div>

      {showPublish && <PublishModal layout={layout} stores={stores} onClose={() => setShowPublish(false)} onPublished={(result) => { setShowPublish(false); onChanged(result.message); }} />}
    </div>
  );
}

/* ── Layouts tab ── */
function LayoutsTab({ isHq, onNotice }) {
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [openLayout, setOpenLayout] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setLayouts(await vmFetch("/layouts")); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (openLayout) {
    return <LayoutDetail layout={openLayout} onBack={() => { setOpenLayout(null); load(); }} onChanged={(msg) => { onNotice(msg); load(); setOpenLayout(null); }} />;
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-black text-slate-900">Layouts</h2><p className="text-sm text-slate-500">{isHq ? "Plan placements, then publish to stores." : "Published layouts that have tasks assigned to your store."}</p></div>
        {isHq && <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"><Plus size={16} /> New layout</button>}
      </div>
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : layouts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">{isHq ? "No layouts yet — create one to start planning." : "Nothing published to your store yet."}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {layouts.map((l) => (
            <button key={l.id} onClick={() => setOpenLayout(l)} className="vm-panel p-4 text-left hover:border-indigo-300 hover:shadow-md">
              <div className="flex items-center justify-between"><Badge status={l.status} /><span className="text-[11px] text-slate-400">{new Date(l.created_at).toLocaleDateString("en-IN")}</span></div>
              <p className="mt-2 font-bold text-slate-900">{l.name}</p>
              {l.notes && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{l.notes}</p>}
            </button>
          ))}
        </div>
      )}
      {showNew && <NewLayoutModal onClose={() => setShowNew(false)} onSave={async (payload) => { try { await vmFetch("/layouts", { method: "POST", body: JSON.stringify(payload) }); setShowNew(false); load(); } catch (e) { setError(e.message); } }} />}
    </div>
  );
}

/* ── Tasks tab (store execution + HQ approval) ── */
function TaskCard({ task, isHq, onChanged }) {
  const [uploading, setUploading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const complete = async (file) => {
    setUploading(true); setError("");
    try { await vmUpload(`/tasks/${task.id}/complete`, file); onChanged(); } catch (e) { setError(e.message); } finally { setUploading(false); }
  };
  const approve = async (approved) => {
    if (approved) {
      try { await vmFetch(`/tasks/${task.id}/approve`, { method: "POST", body: JSON.stringify({ approved: true }) }); onChanged(); } catch (e) { setError(e.message); }
      return;
    }
    if (!reason.trim()) { setRejecting(true); return; }
    try { await vmFetch(`/tasks/${task.id}/approve`, { method: "POST", body: JSON.stringify({ approved: false, rejection_reason: reason.trim() }) }); onChanged(); } catch (e) { setError(e.message); }
  };

  return (
    <div className="vm-panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900">{task.product_name || task.barcode || "Unnamed item"}</p>
          <p className="text-xs text-slate-500">{[task.floor && `Floor ${task.floor}`, task.zone, task.rack && `Rack ${task.rack}`, task.shelf && `Shelf ${task.shelf}`].filter(Boolean).join(" / ")}</p>
          {isHq && <p className="mt-0.5 text-[11px] font-bold text-slate-400">{task.store_name}</p>}
        </div>
        <Badge status={task.status} />
      </div>
      {task.instruction && <p className="mt-2 text-xs italic text-slate-500">"{task.instruction}"</p>}
      {task.rejection_reason && <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700">Rejected: {task.rejection_reason}</p>}
      {task.reference_image_url && <img src={task.reference_image_url} alt="Reference" className="mt-2 h-24 w-full rounded-xl object-cover" />}
      {task.done_photo_url && <div className="mt-2"><p className="text-[11px] font-bold text-slate-400">Proof photo:</p><img src={task.done_photo_url} alt="Proof" className="mt-1 h-24 w-full rounded-xl object-cover" /></div>}
      <ErrorBanner message={error} />

      {!isHq && task.status !== "APPROVED" && (
        <label className="mt-3 block cursor-pointer rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white hover:bg-slate-800">
          <Camera size={13} className="mr-1 inline" />{uploading ? "Uploading…" : task.status === "DONE" ? "Re-upload photo" : "Mark done + upload photo"}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) complete(f); e.target.value = ""; }} />
        </label>
      )}

      {isHq && task.status === "DONE" && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <button onClick={() => approve(true)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"><CheckCircle2 size={13} /> Approve</button>
            <button onClick={() => approve(false)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700"><XCircle size={13} /> Reject</button>
          </div>
          {rejecting && (
            <div className="flex gap-2">
              <input className={inputCls} placeholder="Reason for rejecting" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button onClick={() => approve(false)} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700">Send</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TasksTab({ isHq }) {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setTasks(await vmFetch("/tasks")); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-900">{isHq ? "All tasks" : "My store's tasks"}</h2>
        <div className="flex gap-1.5">
          {["ALL", "PENDING", "DONE", "APPROVED"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === f ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{f}</button>
          ))}
        </div>
      </div>
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">No tasks here.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => <TaskCard key={t.id} task={t} isHq={isHq} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}

/* ── Compliance tab ── */
function ComplianceTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { vmFetch("/compliance").then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />
      <h2 className="text-lg font-black text-slate-900">Compliance by store</h2>
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">No tasks published yet.</p>
      ) : (
        <div className="overflow-hidden vm-panel">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">{["Store", "Approved", "Done (pending review)", "Pending", "Total", "Compliance"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.store_id}>
                  <td className="px-4 py-2.5 font-bold text-slate-900">{r.store_name}</td>
                  <td className="px-4 py-2.5 text-emerald-700">{r.approved}</td>
                  <td className="px-4 py-2.5 text-sky-700">{r.done}</td>
                  <td className="px-4 py-2.5 text-amber-700">{r.pending}</td>
                  <td className="px-4 py-2.5">{r.total}</td>
                  <td className="px-4 py-2.5 font-black text-slate-900">{r.compliance_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Suggestions tab ── */
function SuggestionsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { vmFetch("/suggestions").then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />
      <div className="flex items-center gap-2"><Sparkles size={18} className="text-indigo-600" /><h2 className="text-lg font-black text-slate-900">Placement suggestions</h2></div>
      {data?.note && <p className="text-xs text-slate-500">{data.note}</p>}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
            <p className="flex items-center gap-1.5 text-sm font-black text-emerald-800"><TrendingUp size={15} /> Rising, not yet placed</p>
            <div className="mt-3 space-y-2">
              {(data?.rising_without_placement || []).length === 0 ? <p className="text-xs text-slate-400">Nothing to suggest right now.</p> : data.rising_without_placement.map((r) => (
                <div key={r.barcode} className="rounded-xl bg-white p-3 text-sm"><p className="font-bold text-slate-900">{r.name}</p><p className="text-xs text-slate-500">{r.avg_weekly_qty}/week avg · {r.reason}</p></div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
            <p className="flex items-center gap-1.5 text-sm font-black text-rose-800"><TrendingDown size={15} /> Falling, still placed</p>
            <div className="mt-3 space-y-2">
              {(data?.falling_with_placement || []).length === 0 ? <p className="text-xs text-slate-400">Nothing to suggest right now.</p> : data.falling_with_placement.map((r) => (
                <div key={r.barcode} className="rounded-xl bg-white p-3 text-sm"><p className="font-bold text-slate-900">{r.name}</p><p className="text-xs text-slate-500">{r.avg_weekly_qty}/week avg · {r.reason}</p></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Staffing tab (Phase 2) — assign a store's own admin to a floor/zone ── */
function NewAssignmentModal({ stores, onClose, onSave }) {
  const [storeId, setStoreId] = useState(stores[0]?.id || "");
  const [storeAdmins, setStoreAdmins] = useState([]);
  const [adminId, setAdminId] = useState("");
  const [floor, setFloor] = useState("");
  const [zone, setZone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!storeId) { setStoreAdmins([]); return; }
    fetch(`${API_BASE_URL}/hq/store-admins`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json()).then((res) => {
        const mine = (res.data || res || []).filter((a) => a.store_id === storeId);
        setStoreAdmins(mine);
        setAdminId(mine[0]?.id || "");
      }).catch(() => {});
  }, [storeId]);

  const submit = async () => {
    if (!storeId || !adminId || (!floor.trim() && !zone.trim())) { setError("Choose a store, an admin, and at least a floor or zone."); return; }
    setSaving(true); setError("");
    try {
      await onSave({ store_id: storeId, admin_id: adminId, floor: floor.trim(), zone: zone.trim(), notes: notes.trim() });
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-black text-slate-900">Assign staff to a zone</h3>
        <ErrorBanner message={error} />
        <div className="mt-4 space-y-3">
          <div><label className={labelCls}>Store</label><select className={inputCls} value={storeId} onChange={(e) => setStoreId(e.target.value)}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className={labelCls}>Admin (that store's own staff)</label>
            {storeAdmins.length ? (
              <select className={inputCls} value={adminId} onChange={(e) => setAdminId(e.target.value)}>{storeAdmins.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.managedDepartments?.join(", ") || "no department set"})</option>)}</select>
            ) : <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">No admins found at this store yet.</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Floor</label><input className={inputCls} value={floor} onChange={(e) => setFloor(e.target.value)} /></div>
            <div><label className={labelCls}>Zone</label><input className={inputCls} value={zone} onChange={(e) => setZone(e.target.value)} /></div>
          </div>
          <div><label className={labelCls}>Notes (optional)</label><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={saving || !adminId} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? "Saving…" : "Assign"}</button>
        </div>
      </div>
    </div>
  );
}

function StaffingTab() {
  const [rows, setRows] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await vmFetch("/staff-assignments")); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch(`${API_BASE_URL}/hq/stores`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json()).then((res) => {
        const flat = [];
        for (const s of res.data || []) { flat.push({ id: s.id, name: s.name }); for (const b of s.branches || []) flat.push({ id: b.id, name: `${s.name} - ${b.name}` }); }
        setStores(flat);
      }).catch(() => {});
  }, []);

  const remove = async (id) => { try { await vmFetch(`/staff-assignments/${id}`, { method: "DELETE" }); load(); } catch (e) { setError(e.message); } };

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-black text-slate-900">Staffing by zone</h2><p className="text-sm text-slate-500">Who covers which floor/zone — an org-chart record, not a separate access control.</p></div>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"><Plus size={16} /> Assign staff</button>
      </div>
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">No assignments yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.id} className="vm-panel p-4">
              <p className="font-bold text-slate-900">{r.admin_name}</p>
              <p className="text-xs text-slate-500">{r.store_name}{r.floor && ` · Floor ${r.floor}`}{r.zone && ` · ${r.zone}`}</p>
              {r.notes && <p className="mt-1 text-xs italic text-slate-400">{r.notes}</p>}
              <button onClick={() => remove(r.id)} className="mt-2 text-xs font-bold text-rose-600 hover:underline">Remove</button>
            </div>
          ))}
        </div>
      )}
      {showNew && <NewAssignmentModal stores={stores} onClose={() => setShowNew(false)} onSave={async (payload) => { await vmFetch("/staff-assignments", { method: "POST", body: JSON.stringify(payload) }); setShowNew(false); load(); }} />}
    </div>
  );
}

/* ── Traffic tab (Phase 3 scaffold) — shell only, honestly labeled empty until a sensor/camera integration exists ── */
function TrafficTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { vmFetch("/zone-traffic").then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />
      <div className="flex items-center gap-2"><Activity size={18} className="text-indigo-600" /><h2 className="text-lg font-black text-slate-900">Zone traffic (Phase 3 — not yet live)</h2></div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        No footfall sensor or camera integration is connected. This screen is a real, working shell — the zones below come from your actual published placements — but every traffic count will show "No data" until hardware/sensor data starts flowing into this endpoint. Nothing here is estimated or made up.
      </div>
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (data?.zones || []).length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">No zones published yet — publish a layout first, then zones will appear here.</p>
      ) : (
        <div className="overflow-hidden vm-panel">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">{["Store", "Floor", "Zone", "Visitor count"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.zones.map((z, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 font-bold text-slate-900">{z.store_name}</td>
                  <td className="px-4 py-2.5">{z.floor || "—"}</td>
                  <td className="px-4 py-2.5">{z.zone || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-400">{z.has_data ? z.visitor_count : "No data"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const VM_UI_STYLES = `
  .vm-workspace { min-height: 100vh; color: #17213a; background: radial-gradient(circle at 88% -8%, rgba(129,140,248,.16), transparent 32rem), radial-gradient(circle at 38% 0%, rgba(99,102,241,.10), transparent 31rem), #f5f7fb; }
  .vm-workspace .vm-sidebar { width: 264px; background: linear-gradient(165deg, #1e1b4b 0%, #312e81 55%, #4338ca 150%); box-shadow: 14px 0 40px rgba(15,23,42,.10); }
  .vm-workspace .vm-brand { border: 1px solid rgba(255,255,255,.13); background: rgba(255,255,255,.065); }
  .vm-workspace .vm-nav-item { color: #c7d2fe; border: 1px solid transparent; }
  .vm-workspace .vm-nav-item:hover { background: rgba(255,255,255,.075); color: #fff; }
  .vm-workspace .vm-nav-item-active { color: #fff; border-color: rgba(199,210,254,.22); background: linear-gradient(90deg, rgba(99,102,241,.4), rgba(79,70,229,.28)); box-shadow: 0 8px 18px rgba(2,6,23,.18); }
  .vm-workspace .vm-header { background: rgba(255,255,255,.86); border-bottom: 1px solid #e5eaf2; backdrop-filter: blur(14px); }
  .vm-workspace .vm-panel { background: rgba(255,255,255,.94); border: 1px solid #e2e8f0; border-radius: 20px; box-shadow: 0 14px 35px rgba(15,23,42,.07); }
  @media (max-width: 900px) { .vm-workspace .vm-sidebar { width: 76px; } .vm-workspace .vm-brand-copy, .vm-workspace .vm-nav-label, .vm-workspace .vm-sidebar-note { display: none; } .vm-workspace .vm-nav-item { justify-content: center; padding-left: 0; padding-right: 0; } .vm-workspace .vm-nav-item svg { margin-right: 0; } }
`;

/* ── Root ── */
export default function VisualMerchandising() {
  const isHq = isHQAdmin();
  const [tab, setTab] = useState("layouts");
  const [notice, setNotice] = useState("");

  const tabs = isHq
    ? [["layouts", "Layouts", LayoutGrid], ["tasks", "Tasks", ClipboardList], ["compliance", "Compliance", CheckCircle2], ["suggestions", "Suggestions", Sparkles], ["staffing", "Staffing", Users], ["traffic", "Traffic", Activity]]
    : [["layouts", "Layouts", LayoutGrid], ["tasks", "My tasks", ClipboardList]];

  const activeLabel = tabs.find(([key]) => key === tab)?.[1] || "Layouts";
  const showNotice = (msg) => { setNotice(msg); setTimeout(() => setNotice(""), 4000); };

  return (
    <div className="vm-workspace flex">
      <style>{VM_UI_STYLES}</style>
      <aside className="vm-sidebar sticky top-0 flex h-screen shrink-0 flex-col p-4 text-white">
        <div className="vm-brand rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-300 to-violet-500 text-slate-950 shadow-lg shadow-indigo-950/20">
              <LayoutGrid size={20} />
            </div>
            <div className="vm-brand-copy min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-indigo-200">RMS retail</p>
              <h1 className="truncate text-lg font-bold">Visual Merchandising</h1>
            </div>
          </div>
          <div className="vm-sidebar-note mt-4 rounded-xl border border-white/10 bg-slate-950/20 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-300">Signed in as</p>
            <p className="mt-1 truncate text-sm font-semibold">{getAdminName()}</p>
            <p className="mt-0.5 truncate text-xs text-indigo-100/75">{isHq ? "Head office" : getStoreName() || "Store"}</p>
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-1.5 overflow-y-auto pr-1">
          <p className="vm-sidebar-note px-3 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</p>
          {tabs.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`vm-nav-item flex w-full items-center rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition-all ${tab === key ? "vm-nav-item-active" : ""}`}
            >
              <Icon className="mr-3 h-[18px] w-[18px] shrink-0" />
              <span className="vm-nav-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-4 border-t border-white/10 pt-4">
          <button onClick={() => logoutOrReturnToDepartmentSelector()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-slate-100 transition hover:bg-rose-500/20 hover:text-white">
            <LogOut className="h-4 w-4" /> <span className="vm-nav-label">Log out</span>
          </button>
        </div>
      </aside>

      <main className="min-h-screen flex-1">
        <header className="vm-header sticky top-0 z-10 flex min-h-[92px] items-center justify-between gap-5 px-6 py-4 lg:px-9">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-indigo-700">
              <span>Visual Merchandising</span><span className="h-1 w-1 rounded-full bg-indigo-500" /><span>{isHq ? "HQ oversight" : "Store scoped"}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">{activeLabel}</h2>
            <p className="mt-0.5 text-sm text-slate-500">Plan, publish and verify in-store product placement, from real layouts to real compliance.</p>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-5 px-6 py-6 lg:px-9">
          <GuidePanel />
          {notice && <div className="vm-panel px-4 py-2.5 text-sm font-bold text-emerald-700">{notice}</div>}
          {tab === "layouts" && <LayoutsTab isHq={isHq} onNotice={showNotice} />}
          {tab === "tasks" && <TasksTab isHq={isHq} />}
          {tab === "compliance" && isHq && <ComplianceTab />}
          {tab === "suggestions" && isHq && <SuggestionsTab />}
          {tab === "staffing" && isHq && <StaffingTab />}
          {tab === "traffic" && isHq && <TrafficTab />}
        </div>
      </main>
    </div>
  );
}
