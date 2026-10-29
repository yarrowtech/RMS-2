// Visual Merchandising — Phase 1.
// HQ plans placements (product + floor/zone/rack/shelf + instruction) inside
// a named layout, publishes it to one or more stores. Each store sees its
// tasks, marks them done with a proof photo. HQ/supervisor approves or
// rejects, and gets a per-store compliance view plus data-backed placement
// suggestions (from the existing Demand Forecast — rising items with no
// placement, falling items that still have one).
import React, { useCallback, useEffect, useState } from "react";
import { LayoutGrid, Plus, LogOut, CheckCircle2, XCircle, Camera, Sparkles, TrendingUp, TrendingDown, ClipboardList, Users, Activity, Building2, BarChart3, Download } from "lucide-react";
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
  IN_REVIEW: "bg-violet-100 text-violet-700", SCHEDULED: "bg-cyan-100 text-cyan-800",
  ACTIVE: "bg-emerald-100 text-emerald-800", COMPLETED: "bg-blue-100 text-blue-700", ARCHIVED: "bg-slate-200 text-slate-600",
  BLOCKED: "bg-rose-100 text-rose-700", CORRECTION_REQUIRED: "bg-violet-100 text-violet-700", SUBMITTED: "bg-sky-100 text-sky-700",
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

const LOCATION_TYPES = ["floor", "department", "zone", "fixture", "segment", "shelf"];
const LOCATION_LABELS = { floor: "Floor", department: "Department", zone: "Zone", fixture: "Rack / fixture", segment: "Segment", shelf: "Shelf" };

function flattenStores(response) {
  const flat = [];
  for (const store of response?.data || []) {
    flat.push({ id: store.id, name: store.name });
    for (const branch of store.branches || []) flat.push({ id: branch.id, name: `${store.name} - ${branch.name}` });
  }
  return flat;
}

function StoreLayoutTab() {
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");
  const [nodes, setNodes] = useState([]);
  const [parentId, setParentId] = useState("");
  const [form, setForm] = useState({ code: "", name: "", fixture_type: "", width_cm: "", height_cm: "", depth_cm: "", capacity: "", visibility: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/hq/stores`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json()).then((res) => { const rows = flattenStores(res); setStores(rows); setStoreId(rows[0]?.id || ""); })
      .catch(() => setError("Could not load stores."));
  }, []);
  const load = useCallback(async () => {
    if (!storeId) { setNodes([]); setLoading(false); return; }
    setLoading(true); setError("");
    try { setNodes(await vmFetch(`/location-nodes?store_id=${encodeURIComponent(storeId)}`)); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [storeId]);
  useEffect(() => { setParentId(""); load(); }, [load]);

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const selectedParent = byId[parentId];
  const nextType = selectedParent ? LOCATION_TYPES[LOCATION_TYPES.indexOf(selectedParent.type) + 1] : "floor";
  const pathFor = (node) => {
    const parts = [node.name]; let current = node;
    while (current.parent_id && byId[current.parent_id]) { current = byId[current.parent_id]; parts.unshift(current.name); }
    return parts.join(" / ");
  };
  const add = async () => {
    if (!form.code.trim() || !form.name.trim()) { setError("Code and name are required."); return; }
    setSaving(true); setError("");
    try {
      const numeric = (value) => value === "" ? null : Number(value);
      await vmFetch("/location-nodes", { method: "POST", body: JSON.stringify({
        store_id: storeId, parent_id: parentId || null, type: nextType, code: form.code, name: form.name,
        fixture_type: form.fixture_type, width_cm: numeric(form.width_cm), height_cm: numeric(form.height_cm),
        depth_cm: numeric(form.depth_cm), capacity: numeric(form.capacity), visibility: form.visibility,
      }) });
      setForm({ code: "", name: "", fixture_type: "", width_cm: "", height_cm: "", depth_cm: "", capacity: "", visibility: "" });
      await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const deactivate = async (node) => {
    if (!window.confirm(`Deactivate ${node.name}?`)) return;
    try { await vmFetch(`/location-nodes/${node.id}`, { method: "DELETE" }); if (parentId === node.id) setParentId(node.parent_id || ""); await load(); }
    catch (e) { setError(e.message); }
  };

  return <div className="space-y-4">
    <ErrorBanner message={error} />
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-lg font-black text-slate-900">Store Layout Master</h2><p className="text-sm text-slate-500">Build a controlled floor-to-shelf hierarchy for each store.</p></div>
      <div className="w-full sm:w-72"><label className={labelCls}>Store</label><select className={inputCls} value={storeId} onChange={(e) => setStoreId(e.target.value)}><option value="">Choose store</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
    </div>
    <div className="grid gap-4 lg:grid-cols-[1.35fr_.9fr]">
      <div className="vm-panel overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-900">Location hierarchy</div>
        {loading ? <p className="p-5 text-sm text-slate-400">Loading…</p> : !nodes.length ? <p className="p-5 text-sm text-slate-400">No layout master yet. Create the first floor.</p> : <div className="divide-y divide-slate-100">
          {nodes.map((node) => <div key={node.id} className={`flex items-center justify-between gap-3 px-5 py-3 ${parentId === node.id ? "bg-indigo-50" : ""}`}>
            <button className="min-w-0 flex-1 text-left" onClick={() => setParentId(node.id)}><p className="truncate text-sm font-bold text-slate-900">{node.code} · {node.name}</p><p className="truncate text-xs text-slate-500">{LOCATION_LABELS[node.type]} · {pathFor(node)}</p></button>
            <button onClick={() => deactivate(node)} className="text-xs font-bold text-rose-600">Deactivate</button>
          </div>)}
        </div>}
      </div>
      <div className="vm-panel p-5">
        <h3 className="font-black text-slate-900">Add {LOCATION_LABELS[nextType] || "location"}</h3>
        <p className="mt-1 text-xs text-slate-500">{selectedParent ? `Under ${pathFor(selectedParent)}` : "At the store root"}</p>
        {!nextType ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">This shelf is the final level. Select another parent to continue.</p> : <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2"><div><label className={labelCls}>Code</label><input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. R-01" /></div><div><label className={labelCls}>Name</label><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div></div>
          {nextType === "fixture" && <><div><label className={labelCls}>Fixture type</label><select className={inputCls} value={form.fixture_type} onChange={(e) => setForm({ ...form, fixture_type: e.target.value })}><option value="">Choose type</option>{["Wall rack", "Gondola", "Table", "End-cap", "Window", "Checkout"].map((x) => <option key={x}>{x}</option>)}</select></div><div className="grid grid-cols-3 gap-2">{["width_cm", "height_cm", "depth_cm"].map((key) => <div key={key}><label className={labelCls}>{key.replace("_cm", "")} cm</label><input type="number" min="1" className={inputCls} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>)}</div></>}
          {(nextType === "fixture" || nextType === "shelf") && <div className="grid grid-cols-2 gap-2"><div><label className={labelCls}>Capacity</label><input type="number" min="0" className={inputCls} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div><div><label className={labelCls}>Visibility</label><select className={inputCls} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}><option value="">Not set</option><option>High</option><option>Medium</option><option>Low</option></select></div></div>}
          <button disabled={saving || !storeId} onClick={add} className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : `Add ${LOCATION_LABELS[nextType]}`}</button>
        </div>}
      </div>
    </div>
  </div>;
}

/* ── New layout modal ── */
function NewLayoutModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [storeFormat, setStoreFormat] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-black text-slate-900">New layout</h3>
        <p className="mt-1 text-sm text-slate-500">Create a campaign layout or a reusable store-format template.</p>
        <div className="mt-4 space-y-3">
          <div><label className={labelCls}>Layout name</label><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter24 Window Reset" /></div>
          <div><label className={labelCls}>Campaign name</label><input className={inputCls} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Diwali 2027" /></div>
          <div><label className={labelCls}>Store format</label><select className={inputCls} value={storeFormat} onChange={(e) => setStoreFormat(e.target.value)}><option value="all">All stores</option><option value="large">Large</option><option value="medium">Medium</option><option value="small">Small</option><option value="flagship">Flagship</option></select></div>
          <div className="grid grid-cols-2 gap-2"><div><label className={labelCls}>Start date</label><input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div><div><label className={labelCls}>End date</label><input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div></div>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} /> Save as reusable template</label>
          <div><label className={labelCls}>Notes (optional)</label><textarea className={`${inputCls} min-h-20`} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            disabled={!name.trim() || saving}
            onClick={async () => { setSaving(true); try { await onSave({ name: name.trim(), notes, campaign_name: campaignName, store_format: storeFormat, start_date: startDate, end_date: endDate, is_template: isTemplate }); } finally { setSaving(false); } }}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >{saving ? "Creating…" : "Create layout"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Add placement form (inline, inside layout detail) ── */
function AddPlacementForm({ layoutId, onAdded }) {
  const empty = { product_id: "", barcode: "", product_name: "", sku: "", location_node_id: "", facings: 1, display_quantity: 1, orientation: "face-out", shelf_level: "", purpose: "regular", start_date: "", end_date: "", instruction: "" };
  const [form, setForm] = useState(empty);
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");
  const [nodes, setNodes] = useState([]);
  const [productQuery, setProductQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch(`${API_BASE_URL}/hq/stores`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json()).then((res) => { const rows = flattenStores(res); setStores(rows); setStoreId(rows[0]?.id || ""); }).catch(() => {});
  }, []);
  useEffect(() => {
    set("location_node_id", "");
    if (!storeId) { setNodes([]); return; }
    vmFetch(`/location-nodes?store_id=${encodeURIComponent(storeId)}`).then(setNodes).catch((e) => setError(e.message));
  }, [storeId]);
  useEffect(() => {
    if (!storeId) { setProducts([]); return; }
    const timer = setTimeout(() => {
      setSearching(true);
      vmFetch(`/products/search?store_id=${encodeURIComponent(storeId)}&q=${encodeURIComponent(productQuery)}&limit=20`)
        .then(setProducts).catch((e) => setError(e.message)).finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [storeId, productQuery]);
  const chooseProduct = (product) => {
    setForm((current) => ({ ...current, product_id: product.product_id, barcode: product.barcode, sku: product.sku, product_name: product.product_name }));
    setProductQuery(product.product_name);
    setProducts([]);
  };
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const pathFor = (node) => { const parts = [node.name]; let current = node; while (current.parent_id && byId[current.parent_id]) { current = byId[current.parent_id]; parts.unshift(current.name); } return parts.join(" / "); };

  const submit = async () => {
    setSaving(true); setError("");
    try {
      await vmFetch(`/layouts/${layoutId}/placements`, { method: "POST", body: JSON.stringify(form) });
      setForm(empty);
      setProductQuery("");
      onAdded();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Add a placement</p>
      <ErrorBanner message={error} />
      <div className="relative mt-3">
        <label className={labelCls}>Product Master item</label>
        <input className={inputCls} placeholder="Search product name, barcode or SKU" value={productQuery} onChange={(e) => { setProductQuery(e.target.value); setForm((f) => ({ ...f, product_id: "", barcode: "", product_name: "", sku: "" })); }} />
        {(searching || products.length > 0) && <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {searching ? <p className="p-3 text-sm text-slate-400">Searching…</p> : products.map((product) => <button type="button" key={`${product.product_id}-${product.barcode}`} onClick={() => chooseProduct(product)} className="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left last:border-0 hover:bg-indigo-50">
            {product.image_url ? <img src={product.image_url} alt="" className="h-11 w-11 rounded-lg object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-xs text-slate-400">No image</div>}
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{product.product_name}</p><p className="truncate text-xs text-slate-500">{product.barcode} · {product.sku || "No SKU"} · {product.brand || product.category || "Unclassified"}</p></div>
            <div className="text-right"><p className={`text-sm font-black ${product.store_stock > 0 ? "text-emerald-700" : "text-rose-600"}`}>{product.store_stock} in stock</p><p className="text-xs text-slate-500">₹{product.selling_price} · {product.margin_pct}% margin</p></div>
          </button>)}
        </div>}
      </div>
      {form.product_id && <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Selected: {form.product_name} · {form.barcode}</div>}
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <select className={inputCls} value={storeId} onChange={(e) => setStoreId(e.target.value)}><option value="">Choose store</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className={`${inputCls} sm:col-span-2`} value={form.location_node_id} onChange={(e) => set("location_node_id", e.target.value)}><option value="">Choose managed rack / segment / shelf</option>{nodes.filter((n) => ["fixture", "segment", "shelf"].includes(n.type)).map((n) => <option key={n.id} value={n.id}>{pathFor(n)}</option>)}</select>
        <div><label className={labelCls}>Facings</label><input type="number" min="1" className={inputCls} value={form.facings} onChange={(e) => set("facings", Number(e.target.value))} /></div>
        <div><label className={labelCls}>Display quantity</label><input type="number" min="1" className={inputCls} value={form.display_quantity} onChange={(e) => set("display_quantity", Number(e.target.value))} /></div>
        <div><label className={labelCls}>Orientation</label><select className={inputCls} value={form.orientation} onChange={(e) => set("orientation", e.target.value)}>{["face-out", "folded", "hanging", "stacked"].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className={labelCls}>Shelf level</label><select className={inputCls} value={form.shelf_level} onChange={(e) => set("shelf_level", e.target.value)}><option value="">Not set</option><option value="eye-level">Eye level</option><option value="hand-level">Hand level</option><option value="lower-level">Lower level</option></select></div>
        <div><label className={labelCls}>Purpose</label><select className={inputCls} value={form.purpose} onChange={(e) => set("purpose", e.target.value)}><option value="regular">Regular</option><option value="promotional">Promotional</option><option value="new-arrival">New arrival</option><option value="clearance">Clearance</option></select></div>
        <div />
        <div><label className={labelCls}>Start date</label><input type="date" className={inputCls} value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></div>
        <div><label className={labelCls}>End date</label><input type="date" className={inputCls} value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></div>
        <input className={`${inputCls} sm:col-span-3`} placeholder="Instruction for the store" value={form.instruction} onChange={(e) => set("instruction", e.target.value)} />
      </div>
      {!nodes.length && storeId && <p className="mt-2 text-xs font-semibold text-amber-700">This store has no managed rack locations yet. Add them in Store Layout first.</p>}
      <button onClick={submit} disabled={saving || !form.location_node_id || !form.product_id} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">{saving ? "Adding…" : "+ Add placement"}</button>
    </div>
  );
}

/* ── Publish modal ── */
function PublishModal({ layout, stores, onClose, onPublished }) {
  const [selected, setSelected] = useState(new Set());
  const [allStores, setAllStores] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [dueDate, setDueDate] = useState(layout.start_date || "");
  const [priority, setPriority] = useState("MEDIUM");
  const [error, setError] = useState("");

  const toggle = (id) => setSelected((s) => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const submit = async () => {
    setPublishing(true); setError("");
    try {
      const store_ids = allStores ? [] : Array.from(selected);
      const result = await vmFetch(`/layouts/${layout.id}/publish`, { method: "POST", body: JSON.stringify({ store_ids, due_date: dueDate, priority }) });
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
        <div className="mt-3 grid grid-cols-2 gap-2"><div><label className={labelCls}>Task due date</label><input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div><div><label className={labelCls}>Priority</label><select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value)}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></div></div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={publishing || (!allStores && !selected.size)} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{publishing ? "Publishing…" : "Publish"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Layout detail (placements + publish) ── */
function CloneLayoutModal({ layout, onClose, onSave }) {
  const [name, setName] = useState(`${layout.name} v${(layout.version || 1) + 1}`);
  const [campaignName, setCampaignName] = useState(layout.campaign_name || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [asTemplate, setAsTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => { setSaving(true); setError(""); try { await onSave({ name, campaign_name: campaignName, start_date: startDate, end_date: endDate, as_template: asTemplate }); } catch (e) { setError(e.message); } finally { setSaving(false); } };
  return <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
    <h3 className="text-lg font-black text-slate-900">Clone layout version</h3><p className="mt-1 text-sm text-slate-500">Copies every placement into a new editable draft.</p><ErrorBanner message={error} />
    <div className="mt-4 space-y-3"><div><label className={labelCls}>New layout name</label><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></div><div><label className={labelCls}>Campaign</label><input className={inputCls} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} /></div><div className="grid grid-cols-2 gap-2"><div><label className={labelCls}>Start date</label><input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div><div><label className={labelCls}>End date</label><input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div></div><label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={asTemplate} onChange={(e) => setAsTemplate(e.target.checked)} /> Save clone as template</label></div>
    <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">Cancel</button><button onClick={submit} disabled={saving || !name.trim()} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Cloning…" : "Clone"}</button></div>
  </div></div>;
}

function PlanogramEditor({ layout, placements, stores, onChanged }) {
  const [nodes, setNodes] = useState([]);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState("");
  const [dragOver, setDragOver] = useState("");
  useEffect(() => { vmFetch("/location-nodes").then(setNodes).catch((e) => setError(e.message)); }, []);
  const children = nodes.reduce((map, node) => { const key = node.parent_id || "root"; (map[key] ||= []).push(node); return map; }, {});
  const storeNames = Object.fromEntries(stores.map((s) => [s.id, s.name]));
  const layoutStoreIds = new Set(placements.map((p) => p.store_id).filter(Boolean));
  const fixtures = nodes.filter((n) => n.type === "fixture" && layoutStoreIds.has(n.store_id));
  const atNode = (nodeId) => placements.filter((p) => p.location_leaf_id === nodeId);
  const move = async (placementId, nodeId) => {
    if (layout.status !== "DRAFT") return;
    setMoving(placementId); setError("");
    try { await vmFetch(`/placements/${placementId}/location`, { method: "PATCH", body: JSON.stringify({ location_node_id: nodeId }) }); await onChanged(); }
    catch (e) { setError(e.message); } finally { setMoving(""); setDragOver(""); }
  };
  const ProductChip = ({ product }) => <div draggable={layout.status === "DRAFT"} onDragStart={(e) => e.dataTransfer.setData("text/plain", product.id)} className={`flex min-w-[150px] max-w-[220px] items-center gap-2 rounded-lg border border-indigo-200 bg-white p-2 shadow-sm ${layout.status === "DRAFT" ? "cursor-grab active:cursor-grabbing" : ""} ${moving === product.id ? "opacity-40" : ""}`}>
    {product.product_image_url ? <img src={product.product_image_url} alt="" className="h-9 w-9 rounded-md object-cover" /> : <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-[9px] text-slate-400">No image</div>}
    <div className="min-w-0"><p className="truncate text-xs font-black text-slate-900">{product.product_name}</p><p className="text-[10px] text-slate-500">Qty {product.display_quantity || 1} · {product.facings || 1} facing</p>{product.stock_warning && <p className="truncate text-[9px] font-bold text-amber-700">Stock warning</p>}</div>
  </div>;
  const DropRow = ({ node, label }) => {
    const products = atNode(node.id);
    return <div onDragOver={(e) => { if (layout.status === "DRAFT") { e.preventDefault(); setDragOver(node.id); } }} onDragLeave={() => setDragOver("")} onDrop={(e) => { e.preventDefault(); move(e.dataTransfer.getData("text/plain"), node.id); }} className={`min-h-20 border-t-4 border-slate-500 bg-slate-50 px-3 py-2 transition ${dragOver === node.id ? "bg-indigo-100 ring-2 ring-inset ring-indigo-400" : ""}`}>
      <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-black uppercase tracking-wide text-slate-600">{label}</p><p className="text-[10px] text-slate-400">{node.capacity != null ? `Capacity ${node.capacity}` : "No capacity set"}</p></div>
      <div className="flex flex-wrap gap-2">{products.map((p) => <ProductChip key={p.id} product={p} />)}{!products.length && <p className="py-2 text-xs text-slate-300">Drop product here</p>}</div>
    </div>;
  };
  return <div className="space-y-4">
    <ErrorBanner message={error} />
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">{layout.status === "DRAFT" ? "Drag product cards between shelves. Store, duplicate-product and capacity rules are checked when you drop." : "Published layout preview. Published placements are locked."}</div>
    {!fixtures.length ? <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">No managed fixture placements in this layout yet.</p> : fixtures.map((fixture) => {
      const segments = children[fixture.id] || [];
      return <div key={fixture.id} className="vm-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-5 py-3 text-white"><div><p className="text-sm font-black">{fixture.code} · {fixture.name}</p><p className="text-[11px] text-slate-300">{storeNames[fixture.store_id] || fixture.store_id} · {fixture.fixture_type || "Fixture"}</p></div><p className="text-xs text-slate-300">{fixture.width_cm ? `${fixture.width_cm} × ${fixture.height_cm || "—"} × ${fixture.depth_cm || "—"} cm` : "Dimensions not set"}</p></div>
        {atNode(fixture.id).length > 0 && <div className="border-b border-slate-200 bg-violet-50 p-3"><p className="mb-2 text-[11px] font-black uppercase text-violet-700">Fixture-level placements</p><div className="flex flex-wrap gap-2">{atNode(fixture.id).map((p) => <ProductChip key={p.id} product={p} />)}</div></div>}
        <div className="grid gap-4 p-4 xl:grid-cols-2">{segments.map((segment) => <div key={segment.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="bg-slate-200 px-3 py-2 text-xs font-black text-slate-700">{segment.code} · {segment.name}</div>{atNode(segment.id).length > 0 && <div className="flex flex-wrap gap-2 bg-slate-100 p-3">{atNode(segment.id).map((p) => <ProductChip key={p.id} product={p} />)}</div>}{(children[segment.id] || []).map((shelf) => <DropRow key={shelf.id} node={shelf} label={`${shelf.code} · ${shelf.name}`} />)}{!(children[segment.id] || []).length && <p className="p-4 text-xs text-slate-400">No shelves configured in this segment.</p>}</div>)}</div>
      </div>;
    })}
  </div>;
}

function LayoutDetail({ layout, onBack, onChanged }) {
  const [placements, setPlacements] = useState([]);
  const [stores, setStores] = useState([]);
  const [showPublish, setShowPublish] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [acting, setActing] = useState("");
  const [view, setView] = useState("list");
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
  const changeStatus = async (action) => {
    setActing(action); setError("");
    try { const updated = await vmFetch(`/layouts/${layout.id}/status`, { method: "POST", body: JSON.stringify({ action }) }); onChanged(`Layout is now ${updated.status.replaceAll("_", " ").toLowerCase()}.`); }
    catch (e) { setError(e.message); } finally { setActing(""); }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm font-bold text-indigo-700 hover:underline">← Back to layouts</button>
      <ErrorBanner message={error} />
      <div className="vm-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-slate-900">{layout.name}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">v{layout.version || 1}</span>{layout.is_template && <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-bold text-fuchsia-700">TEMPLATE</span>}</div><p className="text-sm text-slate-500">{layout.campaign_name || "No campaign"} · {layout.store_format || "all"} format{layout.start_date ? ` · ${layout.start_date}${layout.end_date ? ` to ${layout.end_date}` : ""}` : ""}</p><p className="text-xs text-slate-400">{layout.notes || "No notes."}</p></div>
          <div className="flex flex-wrap items-center justify-end gap-2"><Badge status={layout.status} /><button onClick={() => setShowClone(true)} className="rounded-xl border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700">Clone</button>{layout.status === "DRAFT" && !layout.is_template && <button onClick={() => changeStatus("submit_review")} disabled={acting || !placements.length} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Submit review</button>}{layout.status === "IN_REVIEW" && <><button onClick={() => changeStatus("return_draft")} disabled={acting} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Return draft</button><button onClick={() => changeStatus("approve")} disabled={acting} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Approve</button></>}{layout.status === "APPROVED" && <><button onClick={() => changeStatus("schedule")} disabled={acting} className="rounded-xl border border-cyan-300 px-3 py-2 text-xs font-bold text-cyan-700">Schedule</button><button onClick={() => setShowPublish(true)} disabled={!placements.length} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Release to stores</button></>}{layout.status === "SCHEDULED" && !layout.published_at && <button onClick={() => setShowPublish(true)} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Release tasks</button>}{["ACTIVE", "PUBLISHED"].includes(layout.status) && <button onClick={() => changeStatus("complete")} disabled={acting} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white">Complete</button>}{!["DRAFT", "ARCHIVED"].includes(layout.status) && <button onClick={() => changeStatus("archive")} disabled={acting} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600">Archive</button>}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setView("list")} className={`rounded-xl px-4 py-2 text-xs font-bold ${view === "list" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>Placement list</button>
        <button onClick={() => setView("planogram")} className={`rounded-xl px-4 py-2 text-xs font-bold ${view === "planogram" ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>Visual planogram</button>
      </div>

      {view === "list" && layout.status === "DRAFT" && <AddPlacementForm layoutId={layout.id} onAdded={load} />}

      {view === "list" && <div className="vm-panel overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3"><h4 className="text-sm font-bold text-slate-900">Placements ({placements.length})</h4></div>
        <div className="divide-y divide-slate-100">
          {placements.length === 0 ? <p className="p-5 text-sm text-slate-400">No placements yet.</p> : placements.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{p.product_name || p.barcode || "Unnamed item"}{p.sku && <span className="ml-2 font-mono text-xs text-slate-400">{p.sku}</span>}</p>
                <p className="text-xs text-slate-500">{[p.floor && `Floor ${p.floor}`, p.department, p.zone, p.rack && `Rack ${p.rack}`, p.segment && `Segment ${p.segment}`, p.shelf && `Shelf ${p.shelf}`].filter(Boolean).join(" / ")}</p>
                {(p.facings || p.display_quantity || p.orientation) && <p className="text-[11px] text-indigo-600">{p.facings || 1} facing(s) · Qty {p.display_quantity || 1} · {p.orientation || "face-out"}</p>}
                <p className="text-[11px] text-slate-500">{p.purpose || "regular"}{p.shelf_level ? ` · ${p.shelf_level}` : ""}{p.start_date ? ` · ${p.start_date}${p.end_date ? ` to ${p.end_date}` : ""}` : ""} · Stock snapshot {p.store_stock_snapshot ?? "—"}</p>
                {p.stock_warning && <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">{p.stock_warning}</p>}
                {p.instruction && <p className="mt-0.5 text-xs italic text-slate-400">"{p.instruction}"</p>}
              </div>
              {layout.status === "DRAFT" && <button onClick={() => removePlacement(p.id)} className="text-xs font-bold text-rose-600 hover:underline">Remove</button>}
            </div>
          ))}
        </div>
      </div>}
      {view === "planogram" && <PlanogramEditor layout={layout} placements={placements} stores={stores} onChanged={load} />}

      {(layout.status_history || []).length > 0 && <details className="vm-panel p-4"><summary className="cursor-pointer text-sm font-black text-slate-800">Lifecycle history ({layout.status_history.length})</summary><div className="mt-3 space-y-2">{[...layout.status_history].reverse().map((event, index) => <div key={`${event.at}-${index}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs"><span className="font-bold text-slate-700">{event.from || "New"} → {event.to}</span><span className="text-slate-500">{event.by_name || "System"} · {event.at ? new Date(event.at).toLocaleString("en-IN") : ""}</span>{event.note && <span className="w-full text-slate-400">{event.note}</span>}</div>)}</div></details>}

      {showPublish && <PublishModal layout={layout} stores={stores} onClose={() => setShowPublish(false)} onPublished={(result) => { setShowPublish(false); onChanged(result.message); }} />}
      {showClone && <CloneLayoutModal layout={layout} onClose={() => setShowClone(false)} onSave={async (payload) => { const cloned = await vmFetch(`/layouts/${layout.id}/clone`, { method: "POST", body: JSON.stringify(payload) }); setShowClone(false); onChanged(`Created ${cloned.name} as editable version ${cloned.version}.`); }} />}
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
              <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><Badge status={l.status} />{l.is_template && <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-bold text-fuchsia-700">TEMPLATE</span>}</div><span className="text-[11px] text-slate-400">v{l.version || 1} · {new Date(l.created_at).toLocaleDateString("en-IN")}</span></div>
              <p className="mt-2 font-bold text-slate-900">{l.name}</p>
              <p className="mt-0.5 text-xs font-semibold text-indigo-600">{l.campaign_name || "No campaign"} · {l.store_format || "all"} stores</p>
              {l.start_date && <p className="text-[11px] text-slate-400">{l.start_date}{l.end_date ? ` to ${l.end_date}` : ""}</p>}
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
  const [completionType, setCompletionType] = useState("COMPLETE");
  const [completionNotes, setCompletionNotes] = useState("");
  const [blockerType, setBlockerType] = useState("missing_stock");
  const [blockerNotes, setBlockerNotes] = useState("");
  const [showBlocker, setShowBlocker] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(false);
  const [staff, setStaff] = useState([]);
  const [assignment, setAssignment] = useState({ assigned_to: task.assigned_to || "", supervisor_id: task.supervisor_id || "", due_date: task.due_date || "", priority: task.priority || "MEDIUM" });
  const [audit, setAudit] = useState({ correct_product: false, correct_location: false, facings_quantity: false, orientation: false, presentation: false, comments: "" });
  const [auditing, setAuditing] = useState(false);
  const [error, setError] = useState("");

  const complete = async (file) => {
    setUploading(true); setError("");
    try { await vmUpload(`/tasks/${task.id}/complete?completion_type=${encodeURIComponent(completionType)}&notes=${encodeURIComponent(completionNotes)}`, file); onChanged(); } catch (e) { setError(e.message); } finally { setUploading(false); }
  };
  const openAssignment = async () => {
    setEditingAssignment(true);
    if (staff.length) return;
    try { const response = await fetch(`${API_BASE_URL}/hq/store-admins`, { headers: { Authorization: `Bearer ${token()}` } }); const data = await response.json(); setStaff((data.data || data || []).filter((a) => a.store_id === task.store_id)); } catch { setError("Could not load store staff."); }
  };
  const saveAssignment = async () => { try { await vmFetch(`/tasks/${task.id}/assignment`, { method: "PATCH", body: JSON.stringify(assignment) }); setEditingAssignment(false); onChanged(); } catch (e) { setError(e.message); } };
  const reportBlocker = async () => { try { await vmFetch(`/tasks/${task.id}/blocker`, { method: "POST", body: JSON.stringify({ blocker_type: blockerType, notes: blockerNotes }) }); setShowBlocker(false); onChanged(); } catch (e) { setError(e.message); } };
  const submitAudit = async () => { setAuditing(true); setError(""); try { await vmFetch(`/tasks/${task.id}/photo-audit`, { method: "POST", body: JSON.stringify(audit) }); onChanged(); } catch (e) { setError(e.message); } finally { setAuditing(false); } };
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
          <p className="text-xs text-slate-500">{[task.floor && `Floor ${task.floor}`, task.department, task.zone, task.rack && `Rack ${task.rack}`, task.segment && `Segment ${task.segment}`, task.shelf && `Shelf ${task.shelf}`].filter(Boolean).join(" / ")}</p>
          <p className="text-[11px] text-indigo-600">{task.facings || 1} facing(s) · Qty {task.display_quantity || 1} · {task.orientation || "face-out"}</p>
          <p className="text-[11px] text-slate-500">{task.purpose || "regular"}{task.shelf_level ? ` · ${task.shelf_level}` : ""}{task.start_date ? ` · ${task.start_date}${task.end_date ? ` to ${task.end_date}` : ""}` : ""}</p>
          {isHq && <p className="mt-0.5 text-[11px] font-bold text-slate-400">{task.store_name}</p>}
          <p className="mt-1 text-[11px] font-bold text-slate-500">{task.priority || "MEDIUM"} priority{task.due_date ? ` · Due ${task.due_date}` : ""}</p>
          {(task.assigned_to_name || task.supervisor_name) && <p className="text-[11px] text-slate-500">Staff: {task.assigned_to_name || "Unassigned"} · Supervisor: {task.supervisor_name || "Unassigned"}</p>}
        </div>
        <Badge status={task.status} />
      </div>
      {task.instruction && <p className="mt-2 text-xs italic text-slate-500">"{task.instruction}"</p>}
      {task.stock_warning && <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800">Stock warning at planning: {task.stock_warning}</p>}
      {task.rejection_reason && <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700">Rejected: {task.rejection_reason}</p>}
      {task.blocker_type && <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800">Blocked: {task.blocker_type.replaceAll("_", " ")}{task.blocker_notes ? ` — ${task.blocker_notes}` : ""}</p>}
      {task.reference_image_url && <img src={task.reference_image_url} alt="Reference" className="mt-2 h-24 w-full rounded-xl object-cover" />}
      {task.done_photo_url && <div className="mt-2"><p className="text-[11px] font-bold text-slate-400">Proof photo:</p><img src={task.done_photo_url} alt="Proof" className="mt-1 h-24 w-full rounded-xl object-cover" /></div>}
      {task.latest_audit && <div className={`mt-2 rounded-xl px-3 py-2 text-xs font-bold ${task.latest_audit.passed ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>Audit score: {task.latest_audit.score}% · {task.latest_audit.decision.replaceAll("_", " ")}{task.latest_audit.comments ? ` · ${task.latest_audit.comments}` : ""}</div>}
      <ErrorBanner message={error} />

      {!isHq && task.status !== "APPROVED" && <div className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2"><select className={inputCls} value={completionType} onChange={(e) => setCompletionType(e.target.value)}><option value="COMPLETE">Complete</option><option value="PARTIAL">Partial</option></select><input className={inputCls} placeholder="Completion notes" value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} /></div>
        <label className="block cursor-pointer rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white hover:bg-slate-800">
          <Camera size={13} className="mr-1 inline" />{uploading ? "Uploading…" : task.status === "DONE" ? "Re-upload photo" : "Mark done + upload photo"}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) complete(f); e.target.value = ""; }} />
        </label>
        <button onClick={() => setShowBlocker((value) => !value)} className="w-full rounded-xl border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800">Report blocker</button>
        {showBlocker && <div className="space-y-2 rounded-xl bg-amber-50 p-3"><select className={inputCls} value={blockerType} onChange={(e) => setBlockerType(e.target.value)}><option value="missing_stock">Missing stock</option><option value="damaged_fixture">Damaged fixture</option><option value="other">Other</option></select><input className={inputCls} placeholder="Explain the blocker" value={blockerNotes} onChange={(e) => setBlockerNotes(e.target.value)} /><button onClick={reportBlocker} className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white">Send to supervisor</button></div>}
      </div>}

      {isHq && <div className="mt-3"><button onClick={openAssignment} className="w-full rounded-xl border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700">Assign staff / deadline</button>{editingAssignment && <div className="mt-2 space-y-2 rounded-xl bg-indigo-50 p-3"><select className={inputCls} value={assignment.assigned_to} onChange={(e) => setAssignment({ ...assignment, assigned_to: e.target.value })}><option value="">Unassigned employee</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><select className={inputCls} value={assignment.supervisor_id} onChange={(e) => setAssignment({ ...assignment, supervisor_id: e.target.value })}><option value="">No supervisor</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><div className="grid grid-cols-2 gap-2"><input type="date" className={inputCls} value={assignment.due_date} onChange={(e) => setAssignment({ ...assignment, due_date: e.target.value })} /><select className={inputCls} value={assignment.priority} onChange={(e) => setAssignment({ ...assignment, priority: e.target.value })}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <option key={p}>{p}</option>)}</select></div><button onClick={saveAssignment} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Save assignment</button></div>}</div>}

      {isHq && ["DONE", "SUBMITTED"].includes(task.status) && (
        <div className="mt-3 space-y-2">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3"><p className="mb-2 text-xs font-black uppercase text-indigo-800">Photo compliance audit</p><div className="grid grid-cols-2 gap-2">{[["correct_product", "Correct product"], ["correct_location", "Correct location"], ["facings_quantity", "Facings & quantity"], ["orientation", "Orientation"], ["presentation", "Clean presentation"]].map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={audit[key]} onChange={(e) => setAudit({ ...audit, [key]: e.target.checked })} />{label}</label>)}</div><textarea className={`${inputCls} mt-2`} rows={2} placeholder="Reviewer comments (required when corrections are needed)" value={audit.comments} onChange={(e) => setAudit({ ...audit, comments: e.target.value })} /><button onClick={submitAudit} disabled={auditing} className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{auditing ? "Saving audit…" : "Score and submit audit"}</button><p className="mt-1 text-[10px] text-slate-500">80% passes, but product and location must both be correct.</p></div>
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
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const [taskRows, totals] = await Promise.all([vmFetch("/tasks"), vmFetch("/operations-summary")]); setTasks(taskRows); setSummary(totals); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />
      {summary && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">{[["Total", summary.total, "text-slate-800"], ["Pending", summary.pending, "text-amber-700"], ["Review", summary.awaiting_review, "text-sky-700"], ["Approved", summary.approved, "text-emerald-700"], ["Blocked", summary.blocked, "text-rose-700"], ["Corrections", summary.correction_required, "text-violet-700"], ["Overdue", summary.overdue, "text-rose-700"], ["Urgent", summary.urgent, "text-orange-700"]].map(([label, value, tone]) => <div key={label} className="vm-panel p-3 text-center"><p className={`text-xl font-black ${tone}`}>{value}</p><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p></div>)}</div>}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-900">{isHq ? "All tasks" : "My store's tasks"}</h2>
        <div className="flex gap-1.5">
          {["ALL", "PENDING", "DONE", "BLOCKED", "CORRECTION_REQUIRED", "APPROVED"].map((f) => (
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
            <thead><tr className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">{["Store", "Approved", "Review", "Corrections", "Overdue", "Total", "Execution", "Audit score"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.store_id}>
                  <td className="px-4 py-2.5 font-bold text-slate-900">{r.store_name}</td>
                  <td className="px-4 py-2.5 text-emerald-700">{r.approved}</td>
                  <td className="px-4 py-2.5 text-sky-700">{r.done}</td>
                  <td className="px-4 py-2.5 text-violet-700">{r.corrections}</td>
                  <td className="px-4 py-2.5 text-rose-700">{r.overdue}</td>
                  <td className="px-4 py-2.5">{r.total}</td>
                  <td className="px-4 py-2.5 font-black text-slate-900">{r.compliance_pct}%</td>
                  <td className="px-4 py-2.5 font-black text-indigo-700">{r.audit_score == null ? "Not audited" : `${r.audit_score}%`}</td>
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
function AnalyticsTab() {
  const [layouts, setLayouts] = useState([]);
  const [stores, setStores] = useState([]);
  const [layoutId, setLayoutId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    vmFetch("/layouts").then((rows) => { const eligible = rows.filter((l) => !l.is_template && l.start_date); setLayouts(eligible); setLayoutId(eligible[0]?.id || ""); }).catch((e) => setError(e.message));
    fetch(`${API_BASE_URL}/hq/stores`, { headers: { Authorization: `Bearer ${token()}` } }).then((r) => r.json()).then((res) => setStores(flattenStores(res))).catch(() => {});
  }, []);
  const selectedLayout = layouts.find((l) => l.id === layoutId);
  useEffect(() => { if (selectedLayout) { setFromDate(selectedLayout.start_date || ""); setToDate(selectedLayout.end_date || ""); } }, [selectedLayout]);
  const load = async () => {
    if (!layoutId) return;
    setLoading(true); setError("");
    try { const params = new URLSearchParams({ layout_id: layoutId }); if (storeId) params.set("store_id", storeId); if (fromDate) params.set("from_date", fromDate); if (toDate) params.set("to_date", toDate); setData(await vmFetch(`/analytics?${params}`)); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  const exportCsv = () => {
    if (!data?.rows?.length) return;
    const headers = ["Product", "Barcode", "Store", "Floor", "Zone", "Rack", "Segment", "Shelf", "Before units", "During units", "Before revenue", "During revenue", "Revenue uplift %", "During margin", "Current stock", "Ambiguous", "Recommendation"];
    const rows = data.rows.map((r) => [r.product_name, r.barcode, stores.find((s) => s.id === r.store_id)?.name || r.store_id, r.floor, r.zone, r.rack, r.segment, r.shelf, r.before.units, r.during.units, r.before.revenue, r.during.revenue, r.revenue_uplift_pct ?? "", r.during.margin, r.current_stock, r.ambiguous_attribution ? "Yes" : "No", r.recommendation]);
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const blob = new Blob([[headers, ...rows].map((row) => row.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `vm-placement-analytics-${layoutId}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return <div className="space-y-4">
    <ErrorBanner message={error} />
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><BarChart3 size={19} className="text-indigo-600" /> Placement impact analytics</h2><p className="text-sm text-slate-500">Compare an active placement period with an equal-length preceding period.</p></div><button onClick={exportCsv} disabled={!data?.rows?.length} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 px-4 py-2 text-sm font-bold text-indigo-700 disabled:opacity-40"><Download size={15} /> Export CSV</button></div>
    <div className="vm-panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"><div><label className={labelCls}>Campaign layout</label><select className={inputCls} value={layoutId} onChange={(e) => setLayoutId(e.target.value)}><option value="">Choose layout</option>{layouts.map((l) => <option key={l.id} value={l.id}>{l.name} v{l.version || 1}</option>)}</select></div><div><label className={labelCls}>Store</label><select className={inputCls} value={storeId} onChange={(e) => setStoreId(e.target.value)}><option value="">All placed stores</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div><label className={labelCls}>From</label><input type="date" className={inputCls} value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div><div><label className={labelCls}>To</label><input type="date" className={inputCls} value={toDate} onChange={(e) => setToDate(e.target.value)} /></div><button onClick={load} disabled={loading || !layoutId || !fromDate} className="self-end rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{loading ? "Calculating…" : "Apply"}</button></div>
    {data?.note && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{data.note}</p>}
    {data?.summary && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">{[["Before revenue", money(data.summary.before_revenue)], ["During revenue", money(data.summary.during_revenue)], ["Revenue uplift", data.summary.revenue_uplift_pct == null ? "No baseline" : `${data.summary.revenue_uplift_pct}%`], ["During units", data.summary.during_units], ["Margin", money(data.summary.during_margin)], ["Placements", data.summary.placements], ["Ambiguous", data.summary.ambiguous_placements], ["Stockouts", data.summary.stockouts]].map(([label, value]) => <div key={label} className="vm-panel p-3 text-center"><p className="text-lg font-black text-slate-900">{value}</p><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p></div>)}</div>}
    {data?.rows?.length ? <div className="vm-panel overflow-x-auto"><table className="min-w-[1100px] w-full text-xs"><thead><tr className="bg-slate-50 text-left uppercase text-slate-500">{["Product / position", "Before", "During", "Uplift", "Margin", "Stock", "Attribution", "Action"].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.rows.map((r) => <tr key={r.placement_id}><td className="px-3 py-3"><p className="font-black text-slate-900">{r.product_name}</p><p className="text-slate-500">{[r.floor, r.zone, r.rack, r.segment, r.shelf].filter(Boolean).join(" / ")}</p></td><td className="px-3 py-3">{r.before.units} units<br />{money(r.before.revenue)}</td><td className="px-3 py-3 font-bold">{r.during.units} units<br />{money(r.during.revenue)}</td><td className={`px-3 py-3 font-black ${(r.revenue_uplift_pct || 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{r.revenue_uplift_pct == null ? "No baseline" : `${r.revenue_uplift_pct}%`}</td><td className="px-3 py-3">{money(r.during.margin)}</td><td className={`px-3 py-3 font-bold ${r.stockout_signal ? "text-rose-700" : "text-slate-700"}`}>{r.current_stock}{r.stockout_signal && <><br />Stockout</>}</td><td className="px-3 py-3">{r.ambiguous_attribution ? <span className="rounded bg-amber-100 px-2 py-1 font-bold text-amber-800">Ambiguous</span> : <span className="text-emerald-700">Attributable</span>}</td><td className="max-w-64 px-3 py-3 text-slate-600">{r.recommendation}</td></tr>)}</tbody></table></div> : data && !loading ? <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">No attributable placement data for these filters.</p> : null}
  </div>;
}

function OptimizationTab() {
  const [layouts, setLayouts] = useState([]);
  const [layoutId, setLayoutId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { vmFetch("/layouts").then((rows) => { const eligible = rows.filter((l) => !l.is_template && l.start_date); setLayouts(eligible); setLayoutId(eligible[0]?.id || ""); }).catch((e) => setError(e.message)); }, []);
  const load = async () => { if (!layoutId) return; setLoading(true); setError(""); try { setData(await vmFetch(`/optimization?layout_id=${encodeURIComponent(layoutId)}`)); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  const decide = async (row, decision) => { const notes = window.prompt(`${decision === "ACCEPTED" ? "Acceptance" : "Rejection"} notes (optional)`, row.decision_notes || ""); if (notes === null) return; try { await vmFetch(`/optimization/${row.placement_id}/decision`, { method: "POST", body: JSON.stringify({ decision, notes }) }); await load(); } catch (e) { setError(e.message); } };
  const createExperiment = async (row) => { const start = window.prompt("Experiment start date (YYYY-MM-DD)"); if (!start) return; const end = window.prompt("Experiment end date (YYYY-MM-DD)"); if (!end) return; const facings = Number(window.prompt("Proposed facings", String((row.current_facings || 1) + (row.action === "EXPAND_FACINGS" ? 1 : 0)))); if (!facings) return; try { await vmFetch("/experiments", { method: "POST", body: JSON.stringify({ placement_id: row.placement_id, start_date: start, end_date: end, proposed_facings: facings, proposed_display_quantity: row.display_quantity, hypothesis: row.suggestion }) }); window.alert("Draft experiment created. Review it in the Experiments tab."); } catch (e) { setError(e.message); } };
  return <div className="space-y-4">
    <ErrorBanner message={error} />
    <div><h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Sparkles size={19} className="text-violet-600" /> Placement optimization</h2><p className="text-sm text-slate-500">Explainable recommendations from sales uplift, margin, stock and execution compliance.</p></div>
    <div className="vm-panel flex flex-wrap items-end gap-3 p-4"><div className="min-w-64 flex-1"><label className={labelCls}>Campaign layout</label><select className={inputCls} value={layoutId} onChange={(e) => setLayoutId(e.target.value)}><option value="">Choose layout</option>{layouts.map((l) => <option key={l.id} value={l.id}>{l.name} v{l.version || 1}</option>)}</select></div><button onClick={load} disabled={loading || !layoutId} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{loading ? "Calculating…" : "Generate recommendations"}</button></div>
    {data?.note && <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-900">{data.note}</p>}
    {data?.summary && <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[["Recommendations", data.summary.total], ["Expand", data.summary.expand], ["Retain", data.summary.retain], ["Needs attention", data.summary.attention], ["Evidence blocked", data.summary.blocked]].map(([label, value]) => <div key={label} className="vm-panel p-3 text-center"><p className="text-xl font-black text-slate-900">{value}</p><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p></div>)}</div>}
    {data?.rows?.length ? <div className="grid gap-3 lg:grid-cols-2">{data.rows.map((row) => <div key={row.placement_id} className="vm-panel p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-black text-slate-900">{row.product_name}</p><p className="text-xs text-slate-500">{[row.floor, row.zone, row.rack, row.shelf].filter(Boolean).join(" / ")}</p></div><span className={`rounded-lg px-2 py-1 text-[10px] font-black ${row.priority === "URGENT" ? "bg-rose-100 text-rose-800" : row.priority === "HIGH" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{row.priority}</span></div><p className="mt-3 text-sm font-black text-violet-700">{row.action.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-600">{row.suggestion}</p><div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs"><p className="font-bold text-slate-700">Confidence {row.confidence}%</p>{row.evidence.map((item) => <p key={item} className="text-slate-500">• {item}</p>)}{row.blockers.map((item) => <p key={item} className="font-bold text-rose-700">⚠ {item}</p>)}</div><div className="mt-3 flex items-center gap-2"><button onClick={() => decide(row, "ACCEPTED")} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Accept</button><button onClick={() => decide(row, "REJECTED")} className="flex-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Reject</button>{row.decision === "ACCEPTED" && <button onClick={() => createExperiment(row)} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white">Create experiment</button>}<span className="text-[10px] font-black text-slate-400">{row.decision}</span></div></div>)}</div> : data && !loading ? <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">No recommendations available for this layout.</p> : null}
  </div>;
}

function ExperimentsTab() {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); try { setRows(await vmFetch("/experiments")); } catch (e) { setError(e.message); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (id, action, result = false) => { try { await vmFetch(result ? `/experiments/${id}/calculate-result` : `/experiments/${id}/action`, { method: "POST", body: result ? undefined : JSON.stringify({ action, notes: "" }) }); load(); } catch (e) { setError(e.message); } };
  return <div className="space-y-4"><ErrorBanner message={error} /><div><h2 className="text-lg font-black text-slate-900">Optimization experiments</h2><p className="text-sm text-slate-500">Approve proposals, release store execution, measure results, then retain winners or request rollback.</p></div>{loading ? <p className="text-sm text-slate-400">Loading…</p> : rows.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Create an experiment from an accepted optimization recommendation.</p> : <div className="grid gap-3 lg:grid-cols-2">{rows.map((row) => <div key={row.id} className="vm-panel p-4"><div className="flex justify-between gap-2"><div><p className="font-black text-slate-900">{row.product_name}</p><p className="text-xs text-slate-500">{row.start_date} to {row.end_date}</p></div><Badge status={row.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-slate-50 p-3"><p className="font-black text-slate-500">BEFORE</p><p>{row.before?.rack || "—"} / {row.before?.shelf || "—"}</p><p>{row.before?.facings || 1} facings · Qty {row.before?.display_quantity || 1}</p></div><div className="rounded-xl bg-violet-50 p-3"><p className="font-black text-violet-600">PROPOSED</p><p>{row.proposed?.rack || "—"} / {row.proposed?.shelf || "—"}</p><p>{row.proposed?.facings || 1} facings · Qty {row.proposed?.display_quantity || 1}</p></div></div>{row.hypothesis && <p className="mt-2 text-xs text-slate-600">{row.hypothesis}</p>}{row.result && <div className="mt-2 rounded-xl bg-indigo-50 p-3 text-xs font-bold text-indigo-800">{row.result.classification} · Revenue uplift {row.result.revenue_uplift_pct == null ? "No baseline" : `${row.result.revenue_uplift_pct}%`}</div>}<div className="mt-3 flex flex-wrap gap-2">{row.status === "DRAFT" && <button onClick={() => act(row.id, "APPROVE")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Approve</button>}{row.status === "APPROVED" && <button onClick={() => act(row.id, "LAUNCH")} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white">Launch store task</button>}{row.status === "ACTIVE" && <button onClick={() => act(row.id, "", true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Calculate result</button>}{row.status === "COMPLETED" && <><button onClick={() => act(row.id, "RETAIN")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Retain winner</button><button onClick={() => act(row.id, "ROLLBACK")} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Request rollback</button></>}</div></div>)}</div>}</div>;
}

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
    ? [["store-layout", "Store Layout", Building2], ["layouts", "Layouts", LayoutGrid], ["tasks", "Tasks", ClipboardList], ["compliance", "Compliance", CheckCircle2], ["analytics", "Impact Analytics", BarChart3], ["optimization", "Optimization", Sparkles], ["experiments", "Experiments", Activity], ["suggestions", "Suggestions", TrendingUp], ["staffing", "Staffing", Users], ["traffic", "Traffic", Activity]]
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
              {React.createElement(Icon, { className: "mr-3 h-[18px] w-[18px] shrink-0" })}
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
          {tab === "store-layout" && isHq && <StoreLayoutTab />}
          {tab === "layouts" && <LayoutsTab isHq={isHq} onNotice={showNotice} />}
          {tab === "tasks" && <TasksTab isHq={isHq} />}
          {tab === "compliance" && isHq && <ComplianceTab />}
          {tab === "analytics" && isHq && <AnalyticsTab />}
          {tab === "optimization" && isHq && <OptimizationTab />}
          {tab === "experiments" && isHq && <ExperimentsTab />}
          {tab === "suggestions" && isHq && <SuggestionsTab />}
          {tab === "staffing" && isHq && <StaffingTab />}
          {tab === "traffic" && isHq && <TrafficTab />}
        </div>
      </main>
    </div>
  );
}
