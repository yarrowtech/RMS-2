import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { API_BASE_URL } from "../../config/api.js";
import { downloadFabricSheetCsv } from "../../utils/fabricSheetExport.js";

// Shared by Production & Job Work (its own "Fabric buying cart" flow) and
// the Merchandiser Buyer's "Fabric Purchasing" tab — one cart UI, two
// entry points, both ultimately hitting the same job-work fabric-PO
// endpoints (POST /api/job-work/fabric-purchase-orders,
// GET /api/job-work/vendors?kind=fabric_supplier).

function authHeaders() {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// Regional fabric rate benchmark — mirrors the backend's grouping exactly
// (fabric_type lowercased/trimmed, GSM bucketed into 50-wide bands) so a
// client-side lookup lands on the same bucket the server computed.
const FABRIC_GSM_BAND_WIDTH = 50;
function parseLeadingNumber(value) {
  const match = String(value ?? "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}
function gsmBandLabel(gsm) {
  const lower = Math.floor(gsm / FABRIC_GSM_BAND_WIDTH) * FABRIC_GSM_BAND_WIDTH;
  return `${lower}-${lower + FABRIC_GSM_BAND_WIDTH}`;
}
function findRateBenchmark(benchmarks, fabricType, gsmRaw) {
  const type = String(fabricType || "").trim().toLowerCase();
  const gsm = parseLeadingNumber(gsmRaw);
  if (!type || gsm == null) return null;
  const band = gsmBandLabel(gsm);
  return benchmarks.find((b) => b.fabric_type === type && b.gsm_band === band) || null;
}
// Prefers the buyer's own-state figure when the benchmark carries enough
// same-state listings to compute one; otherwise falls back to the
// marketplace-wide figure — mirrors the backend's "never go silent"
// fallback in GET /api/catalogue/fabric-rate-benchmarks.
function resolveBenchmarkStats(benchmark) {
  if (!benchmark) return null;
  if (benchmark.regional) return { medianRate: benchmark.regional.median_rate, sampleSize: benchmark.regional.sample_size, source: "regional", state: benchmark.regional.state };
  return { medianRate: benchmark.median_rate, sampleSize: benchmark.sample_size, source: "marketplace" };
}
function RateSignalBadge({ rate, benchmark }) {
  const stats = resolveBenchmarkStats(benchmark);
  if (!stats || !(rate > 0)) return null;
  const diffPct = Math.round(((rate - stats.medianRate) / stats.medianRate) * 100);
  if (Math.abs(diffPct) < 10) return null;
  const isHigh = diffPct > 0;
  const label = stats.source === "regional" ? "your state avg" : "marketplace avg";
  return (
    <span
      title={`${stats.source === "regional" ? `Your state (${stats.state})` : "Marketplace"} median for similar fabric: Rs ${stats.medianRate.toLocaleString("en-IN")} (from ${stats.sampleSize} listings)`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${isHigh ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
    >
      {isHigh ? "▲" : "▼"} {Math.abs(diffPct)}% {isHigh ? "above" : "below"} {label}
    </span>
  );
}

function CompareVendorsModal({ fabricType, gsm, itemName, onClose, onPickVendor }) {
  const [listings, setListings] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/catalogue/fabric-rate-benchmarks/compare?fabric_type=${encodeURIComponent(fabricType)}&gsm=${encodeURIComponent(gsm)}`, { headers: authHeaders() })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail || "Could not load vendor comparison.");
        if (!cancelled) setListings(body.data?.listings || []);
      })
      .catch((err) => { if (!cancelled) setError(err.message || "Could not load vendor comparison."); });
    return () => { cancelled = true; };
  }, [fabricType, gsm]);

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <section className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-600">Compare vendors</p>
            <h2 className="mt-1 text-base font-black text-slate-900">Similar to "{itemName}"</h2>
            <p className="mt-0.5 text-xs text-slate-500">Among suppliers you're already approved with — same fabric type and GSM range.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-lg text-slate-500 hover:bg-slate-50" aria-label="Close">×</button>
        </header>
        <div className="space-y-2 p-5">
          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>
          ) : listings === null ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs font-bold text-slate-400">Loading…</p>
          ) : listings.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">No other approved supplier has similar fabric in their catalogue yet.</p>
          ) : (
            listings.map((listing, index) => (
              <div key={listing.item_id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${index === 0 ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-slate-900">{listing.vendor_name}</p>
                    {index === 0 && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">Cheapest</span>}
                    {listing.same_state && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-teal-700">Your state</span>}
                  </div>
                  <p className="truncate text-xs text-slate-500">{listing.item_name} · {[listing.gsm && `${listing.gsm} GSM`, listing.width, listing.shade].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <p className="text-sm font-black text-slate-900">₹{listing.rate.toLocaleString("en-IN")}</p>
                  <button type="button" onClick={() => onPickVendor(listing.vendor_id)} className="rounded-lg bg-teal-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-teal-700">Use this vendor</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}

export function Modal({ title, children, onClose, wide = false }) {
  // Rendered via a portal straight into document.body — some host pages
  // (e.g. the Merchandiser Buyer shell) wrap their content in a container
  // with backdrop-blur/overflow-hidden, which creates a new CSS containing
  // block and traps a plain `fixed` overlay inside that content area
  // instead of covering the real viewport. Portalling out sidesteps that
  // regardless of what any parent page does.
  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <section className={`${wide ? "max-w-6xl" : "max-w-4xl"} max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl`}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-600">Production control</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-lg text-slate-500 transition hover:bg-slate-50" aria-label="Close">×</button>
        </header>
        {children}
      </section>
    </div>,
    document.body
  );
}

export function Field({ label, children }) {
  return <label className="block text-sm font-bold text-slate-700"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>{React.cloneElement(children, { className: "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-100" })}</label>;
}

export function CreateFabricPOModal({ plan, vendors, onClose, onSubmit, saving }) {
  const today = new Date().toISOString().slice(0, 10);
  const initialItems = (plan?.materials?.length ? plan.materials : [{ material_name: "", specification: "", required_quantity: "", unit: "m", rate: "" }]).map((material) => ({
    fabric_name: material.material_name || "",
    fabric_type: material.fabric_type || "",
    gsm: material.gsm || "",
    width: material.width || "",
    color: material.color || "",
    total_quantity: material.required_quantity || "",
    unit: material.unit || "m",
    rate: material.rate || "",
    remarks: material.specification || material.remarks || "",
  }));
  const [form, setForm] = useState({
    supplier_mode: vendors.length ? "registered" : "walkin",
    vendor_id: "",
    walkin_vendor: { name: "", mobile: "", email: "", contact_person: "", gstin: "", address: "" },
    order_date: today,
    expected_delivery_date: "",
    payment_terms: "",
    notes: "",
    items: initialItems,
  });
  const [storefront, setStorefront] = useState(null);
  const [storefrontLoading, setStorefrontLoading] = useState(false);
  const [storefrontError, setStorefrontError] = useState("");
  const [rateBenchmarks, setRateBenchmarks] = useState([]);
  const [compareItem, setCompareItem] = useState(null);
  const [addedToCart, setAddedToCart] = useState("");
  const cartLinesRef = useRef(null);

  const supplierMode = form.supplier_mode || "registered";
  const isWalkin = supplierMode === "walkin";
  const vendor = vendors.find((item) => item.id === form.vendor_id);
  const selectedVendorName = isWalkin ? form.walkin_vendor.name : vendor?.name;
  const total = form.items.reduce((sum, item) => sum + (Number(item.total_quantity || 0) * Number(item.rate || 0)), 0);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateWalkin = (key, value) => setForm((current) => ({ ...current, walkin_vendor: { ...current.walkin_vendor, [key]: value } }));
  const changeItem = (index, key, value) => setForm((current) => ({ ...current, items: current.items.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line) }));
  const addLine = () => setForm((current) => ({ ...current, items: [...current.items, { fabric_name: "", fabric_type: "", gsm: "", width: "", color: "", total_quantity: "", unit: "m", rate: "", remarks: "" }] }));
  const removeLine = (index) => setForm((current) => ({ ...current, items: current.items.filter((_, lineIndex) => lineIndex !== index) }));

  useEffect(() => {
    let cancelled = false;
    if (isWalkin || !form.vendor_id) { setStorefront(null); setStorefrontError(""); return undefined; }
    setStorefrontLoading(true);
    setStorefrontError("");
    fetch(`${API_BASE_URL}/api/catalogue/vendor/${form.vendor_id}/storefront`, { headers: authHeaders() })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail || "Could not load supplier catalogue.");
        if (!cancelled) setStorefront(body.data || null);
      })
      .catch((err) => { if (!cancelled) { setStorefront(null); setStorefrontError(err.message || "Could not load supplier catalogue."); } })
      .finally(() => { if (!cancelled) setStorefrontLoading(false); });
    return () => { cancelled = true; };
  }, [form.vendor_id, isWalkin]);

  // Marketplace-wide, so fetched once regardless of which supplier is
  // selected — not scoped to form.vendor_id.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/catalogue/fabric-rate-benchmarks`, { headers: authHeaders() })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!cancelled && response.ok) setRateBenchmarks(body.data || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const fabricCatalogueItems = (storefront?.items || []).filter((item) => item.catalogue_kind === "fabric_material" || (item.fabric_specs && Object.keys(item.fabric_specs).length));
  const addCatalogueFabric = (item) => {
    const specs = item.fabric_specs || {};
    const nextLine = {
      fabric_name: item.item_name || "",
      fabric_type: specs.fabric_type || item.category || "",
      gsm: specs.gsm || "",
      width: specs.width || "",
      color: specs.shade || (item.available_colors || []).join(", "),
      total_quantity: item.moq || "",
      unit: String(specs.rate_unit || "m").toLowerCase().includes("kg") ? "kg" : "m",
      rate: item.price || item.price_range_min || "",
      remarks: [specs.composition, specs.weave, specs.finish, specs.roll_length, specs.testing_notes].filter(Boolean).join(" | "),
      image_url: item.images?.[0] || "",
      catalogue_item_id: item._id || "",
    };
    setForm((current) => {
      const firstBlank = current.items.findIndex((line) => !String(line.fabric_name || "").trim());
      if (firstBlank >= 0) return { ...current, items: current.items.map((line, index) => index === firstBlank ? nextLine : line) };
      return { ...current, items: [...current.items, nextLine] };
    });
    setAddedToCart(item.item_name || "Fabric");
    window.setTimeout(() => setAddedToCart(""), 2500);
    cartLinesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submit = (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      vendor_id: isWalkin ? "" : form.vendor_id,
      vendor_name: selectedVendorName || "",
      walkin_vendor: isWalkin ? form.walkin_vendor : undefined,
    };
    onSubmit(plan || null, payload);
  };

  const canCreate = isWalkin ? Boolean(form.walkin_vendor.name.trim()) : Boolean(form.vendor_id);

  return <>
  <Modal wide title={plan ? `Fabric cart PO from ${plan.plan_no}` : "Fabric buying cart"} onClose={onClose}>
    {addedToCart && <div className="pointer-events-none fixed left-1/2 top-6 z-[200] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-lg">✓ Added "{addedToCart}" to fabric cart — see below</div>}
    <form onSubmit={submit} className="p-6">
      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        <b className="text-slate-900">Use this like Quick Order for fabric:</b> choose a registered fabric supplier or enter a walk-in supplier, add fabric/trim lines, then RMS creates a Fabric PO and downloadable sheet. Walk-in suppliers get a public PO link they can accept/register from.
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => update("supplier_mode", "registered")} className={`rounded-xl border px-4 py-3 text-left transition ${!isWalkin ? "border-teal-400 bg-teal-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
          <p className="font-black text-slate-900">Registered fabric supplier</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Supplier already approved in RMS; catalogue can load below.</p>
        </button>
        <button type="button" onClick={() => update("supplier_mode", "walkin")} className={`rounded-xl border px-4 py-3 text-left transition ${isWalkin ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
          <p className="font-black text-slate-900">Walk-in / new supplier</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Create PO now; share link by WhatsApp/email so supplier can accept/register.</p>
        </button>
      </div>

      {!isWalkin ? <div className="grid gap-4 md:grid-cols-3">
        <Field label="Approved fabric supplier *"><select required={!isWalkin} value={form.vendor_id} onChange={(e) => update("vendor_id", e.target.value)}><option value="">Select supplier</option>{vendors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Order date"><input type="date" value={form.order_date} onChange={(e) => update("order_date", e.target.value)} /></Field>
        <Field label="Expected delivery"><input type="date" value={form.expected_delivery_date} onChange={(e) => update("expected_delivery_date", e.target.value)} /></Field>
      </div> : <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-amber-700">Walk-in fabric supplier details</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Supplier name *"><input required={isWalkin} value={form.walkin_vendor.name} onChange={(e) => updateWalkin("name", e.target.value)} placeholder="e.g. ABC Fabrics" /></Field>
          <Field label="WhatsApp / mobile"><input value={form.walkin_vendor.mobile} onChange={(e) => updateWalkin("mobile", e.target.value)} placeholder="9876543210" /></Field>
          <Field label="Email"><input type="email" value={form.walkin_vendor.email} onChange={(e) => updateWalkin("email", e.target.value)} placeholder="supplier@example.com" /></Field>
          <Field label="Contact person"><input value={form.walkin_vendor.contact_person} onChange={(e) => updateWalkin("contact_person", e.target.value)} placeholder="Owner / sales person" /></Field>
          <Field label="GSTIN"><input value={form.walkin_vendor.gstin} onChange={(e) => updateWalkin("gstin", e.target.value)} placeholder="Optional" /></Field>
          <Field label="Address"><input value={form.walkin_vendor.address} onChange={(e) => updateWalkin("address", e.target.value)} placeholder="Optional" /></Field>
          <Field label="Order date"><input type="date" value={form.order_date} onChange={(e) => update("order_date", e.target.value)} /></Field>
          <Field label="Expected delivery"><input type="date" value={form.expected_delivery_date} onChange={(e) => update("expected_delivery_date", e.target.value)} /></Field>
        </div>
      </div>}

      {!isWalkin && form.vendor_id && <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-600">Fabric supplier storefront</p>
              <h3 className="mt-1 text-lg font-black text-slate-900">{vendor?.name || "Supplier catalogue"}</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Pick fabric like a catalogue: view image/specs, add it to the cart, edit quantity/rate below, then create the Fabric PO.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5"><p className="text-lg font-black text-slate-900">{fabricCatalogueItems.length}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Fabric SKUs</p></div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5"><p className="text-lg font-black text-slate-900">{form.items.filter((line) => String(line.fabric_name || "").trim()).length}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cart lines</p></div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5"><p className="text-lg font-black text-slate-900">Rs {total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Est. value</p></div>
            </div>
          </div>
        </div>
        <div className="p-5">
          {storefrontLoading ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">Loading supplier catalogue...</div> : storefrontError ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800">{storefrontError}</div> : fabricCatalogueItems.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{fabricCatalogueItems.slice(0, 9).map((item) => { const specs = item.fabric_specs || {}; const rate = Number(item.price || item.price_range_min || 0); const benchmark = findRateBenchmark(rateBenchmarks, specs.fabric_type, specs.gsm); const benchmarkStats = resolveBenchmarkStats(benchmark); const rateDiffPct = benchmarkStats && rate > 0 ? Math.round(((rate - benchmarkStats.medianRate) / benchmarkStats.medianRate) * 100) : null; const specChips = [specs.fabric_type, specs.gsm ? `${specs.gsm} GSM` : "", specs.width, specs.shade, specs.rate_unit].filter(Boolean); return <article key={item._id} className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-teal-300"><div className="relative aspect-[4/3] bg-slate-100">{item.images?.[0] ? <img src={item.images[0]} alt={item.item_name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs font-bold text-slate-400">No fabric image</div>}<span className="absolute left-3 top-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] font-black text-white">Fabric</span>{rate > 0 && <span className="absolute bottom-3 right-3 rounded-lg bg-white px-3 py-1.5 text-sm font-black text-slate-900 shadow-sm">Rs {rate.toLocaleString("en-IN")}</span>}</div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h4 className="text-base font-black text-slate-900">{item.item_name}</h4><p className="mt-1 text-xs font-semibold text-slate-500">MOQ {item.moq || "to confirm"}</p></div></div>{(rateDiffPct !== null && Math.abs(rateDiffPct) >= 10) || (specs.fabric_type && specs.gsm) ? <div className="mt-2 flex flex-wrap items-center gap-2">{rateDiffPct !== null && Math.abs(rateDiffPct) >= 10 && <RateSignalBadge rate={rate} benchmark={benchmark} />}{specs.fabric_type && specs.gsm && <button type="button" onClick={() => setCompareItem(item)} className="text-[10px] font-bold text-teal-700 underline decoration-dotted underline-offset-2 hover:text-teal-800">Compare vendors</button>}</div> : null}<div className="mt-3 flex flex-wrap gap-1.5">{specChips.length ? specChips.slice(0, 5).map((chip) => <span key={chip} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{chip}</span>) : <span className="text-xs text-slate-400">Specs available after supplier update</span>}</div><p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-slate-500">{item.description || [specs.composition, specs.weave, specs.finish, specs.testing_notes].filter(Boolean).join(" / ") || "Add this fabric to the PO cart and edit quantity, shade or rate before creating the PO."}</p><button type="button" onClick={() => addCatalogueFabric(item)} className="mt-4 w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700">Add to fabric cart</button></div></article>; })}</div> : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center"><p className="text-sm font-black text-slate-700">No fabric catalogue from this supplier yet.</p><p className="mt-1 text-xs text-slate-500">Use manual fabric cart lines below, or ask the supplier to add fabric catalogue items from vendor portal.</p></div>}
        </div>
      </section>}

      <div ref={cartLinesRef} className="mt-6 space-y-3 scroll-mt-24">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-900">Fabric cart lines</p>
            <p className="text-xs font-semibold text-slate-500">Add one card per fabric, trim, shade or width. Every value can be edited before PO creation.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{form.items.length} line{form.items.length === 1 ? "" : "s"}</span>
        </div>
        {form.items.map((line, index) => <section key={index} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-sm font-black text-teal-700">{index + 1}</span>
            <button type="button" disabled={form.items.length === 1} onClick={() => removeLine(index)} className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-600 disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300">Remove</button>
          </div>
          <div className="grid gap-3 md:grid-cols-12">
            <label className="md:col-span-4 text-xs font-black uppercase tracking-wide text-slate-500">Fabric / trim<input required value={line.fabric_name} onChange={(e) => changeItem(index, "fabric_name", e.target.value)} placeholder="Cotton viscose" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-teal-400" /></label>
            <label className="md:col-span-3 text-xs font-black uppercase tracking-wide text-slate-500">Fabric type<input value={line.fabric_type} onChange={(e) => changeItem(index, "fabric_type", e.target.value)} placeholder="Woven / knit" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-teal-400" /></label>
            <label className="md:col-span-2 text-xs font-black uppercase tracking-wide text-slate-500">GSM<input value={line.gsm} onChange={(e) => changeItem(index, "gsm", e.target.value)} placeholder="180" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-teal-400" /></label>
            <label className="md:col-span-3 text-xs font-black uppercase tracking-wide text-slate-500">Width<input value={line.width} onChange={(e) => changeItem(index, "width", e.target.value)} placeholder="58 inch" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-teal-400" /></label>
            <label className="md:col-span-3 text-xs font-black uppercase tracking-wide text-slate-500">Colour / shade<input value={line.color} onChange={(e) => changeItem(index, "color", e.target.value)} placeholder="Navy" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-teal-400" /></label>
            <label className="md:col-span-3 text-xs font-black uppercase tracking-wide text-slate-500">Total fabric<input required min="0.001" step="any" type="number" value={line.total_quantity} onChange={(e) => changeItem(index, "total_quantity", e.target.value)} placeholder="168" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-teal-400" /></label>
            <label className="md:col-span-2 text-xs font-black uppercase tracking-wide text-slate-500">Unit<input value={line.unit} onChange={(e) => changeItem(index, "unit", e.target.value)} placeholder="m" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-teal-400" /></label>
            <label className="md:col-span-2 text-xs font-black uppercase tracking-wide text-slate-500">Rate<input min="0" step="any" type="number" value={line.rate} onChange={(e) => changeItem(index, "rate", e.target.value)} placeholder="Rate" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-teal-400" /></label>
            <label className="md:col-span-12 text-xs font-black uppercase tracking-wide text-slate-500">Remarks<input value={line.remarks} onChange={(e) => changeItem(index, "remarks", e.target.value)} placeholder="Dye lot, shrinkage, shade, test report or delivery instruction" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-teal-400" /></label>
          </div>
        </section>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={addLine} className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700 hover:bg-teal-100">+ Add fabric line</button><div className="rounded-2xl bg-slate-50 px-4 py-3 text-right"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Estimated fabric value</p><p className="text-xl font-black text-slate-900">Rs {total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p></div></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Payment terms"><input value={form.payment_terms} onChange={(e) => update("payment_terms", e.target.value)} placeholder="e.g. 30% advance, balance on delivery" /></Field><Field label="PO notes"><input value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Shade approval, test report, delivery instruction" /></Field></div>
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => downloadFabricSheetCsv({ purchase_order_no: "fabric-po-draft", vendor_name: selectedVendorName, order_date: form.order_date, payment_terms: form.payment_terms, sheet: [] }, form.items)} className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-700 hover:bg-teal-100">Download draft sheet</button><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving || !canCreate} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Creating..." : isWalkin ? "Create Walk-in Fabric PO + link" : "Create Fabric PO + sheet"}</button></div>
    </form>
  </Modal>
  {compareItem && (
    <CompareVendorsModal
      fabricType={(compareItem.fabric_specs || {}).fabric_type}
      gsm={(compareItem.fabric_specs || {}).gsm}
      itemName={compareItem.item_name}
      onClose={() => setCompareItem(null)}
      onPickVendor={(vendorId) => { update("vendor_id", vendorId); update("supplier_mode", "registered"); setCompareItem(null); }}
    />
  )}
  </>;
}
