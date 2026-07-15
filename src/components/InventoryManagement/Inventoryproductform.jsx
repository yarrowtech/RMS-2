import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


import React, { useState, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import QuickFillPanel from "../Quickfillpanel";

const API = APP_API_URL;

// ── Shared auth helper ──────────────────────────────────────────────────────
// ⚠️ FIXED: this file previously read the token ONCE at module import time
// (`const token = localStorage.getItem(...)`) into a module-level `hdrs`
// object reused on every request. Since ES modules only evaluate once,
// that value is frozen forever after first load — if this component
// mounts before login completes, or the token is refreshed later without
// a full page reload, every subsequent request keeps sending the stale
// value. Replaced with authFetch(), which reads fresh from localStorage
// on every call — same pattern used everywhere else in this app. Also
// added access_token to the fallback chain, matching the 3-key pattern
// used consistently elsewhere (this file was only checking 2 of the 3).
function getAdminToken() {
  return (
    localStorage.getItem("admin_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

async function authFetch(url, options = {}) {
  const token = getAdminToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

// ── helpers ────────────────────────────────────────────────────────────────────
const uid = () => `v_${Math.random().toString(36).slice(2)}_${Date.now()}`;

const autoBarcode = (parent, ...parts) => {
  if (!parent) return "";
  const suffix = parts.filter(Boolean)
    .map(p => p.toString().replace(/\s+/g,"").toUpperCase().slice(0,5))
    .join("-");
  return suffix ? `${parent}-${suffix}` : parent;
};

// ── Product type config ────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  garment: {
    label:    "Garment / Apparel",
    accent:   "indigo",
    emoji:    "👕",
    cats: [
      { key:"category1", label:"Design No.",   type:"text",     ph:"e.g. CTSHIRT-001" },
      { key:"category2", label:"Brand",        type:"text",     ph:"e.g. Lourdes" },
      { key:"category3", label:"Style",        type:"text",     ph:"e.g. Round Neck, A-Line" },
      { key:"category4", label:"Pattern",       type:"text",     ph:"e.g. Plain, Polka Dots, Printed, Embroidery, Checks, Stripes" },
      { key:"category5", label:"Size Range",   type:"text",     ph:"e.g. S to XXL, 38-44" },
      { key:"category6", label:"Category 6 (Ageing)", type:"text", ph:"e.g. 07/2026" },
    ],
    variantCols: [
      { key:"size_label",  label:"Size",        ph:"S/M/L…",    type:"size_dropdown" },
      { key:"measurement", label:"Measurement", ph:"30, 32, 36",type:"text" },
      { key:"color",       label:"Colour",      ph:"White…",    type:"colour_dropdown" },
      { key:"pattern",     label:"Pattern",     ph:"Plain, Polka Dots, Printed…",type:"text" },
    ],
  },
  fmcg: {
    label:    "FMCG / Food & Consumer",
    accent:   "emerald",
    emoji:    "🛒",
    cats: [
      { key:"category1", label:"Category 1 (Item Code)",    type:"text",     ph:"e.g. BISCUIT-001" },
      { key:"category2", label:"Category 2 (Brand)",        type:"text",     ph:"e.g. Parle, Britannia" },
      { key:"category3", label:"Category 3 (Pack Type)",    type:"dropdown", options:["Packet","Bottle","Tin","Can","Box","Pouch","Sachet","Jar","Carton","N/A"] },
      { key:"category4", label:"Category 4 (Weight/Volume)",type:"dropdown", options:["50g","100g","200g","250g","500g","1kg","2kg","5kg","50ml","100ml","200ml","250ml","500ml","1L","2L","5L","N/A"] },
      { key:"category5", label:"Category 5 (Flavour/Variant)",type:"text",   ph:"e.g. Mango, Chocolate, Original" },
      { key:"category6", label:"Category 6 (Ageing)", type:"text", ph:"e.g. 07/2026" },
    ],
    variantCols: [
      { key:"pack_size", label:"Pack Size",      ph:"100g, 500ml…",  type:"text" },
      { key:"flavor",    label:"Flavour",        ph:"Original, Mango",type:"text" },
    ],
  },
  general: {
    label:    "General / Other",
    accent:   "slate",
    emoji:    "📦",
    cats: [
      { key:"category1", label:"Category 1 (Item Code)",    type:"text", ph:"e.g. ITEM-001" },
      { key:"category2", label:"Category 2 (Brand)",        type:"text", ph:"e.g. Brand name" },
      { key:"category3", label:"Category 3 (Type/Model)",   type:"text", ph:"e.g. Model number" },
      { key:"category4", label:"Category 4 (Specification)",type:"text", ph:"e.g. 64GB, A4 size" },
      { key:"category5", label:"Category 5 (Unit)",         type:"text", ph:"e.g. Piece, Box, Pack" },
      { key:"category6", label:"Category 6 (Warranty/Expiry)",type:"text",ph:"e.g. 1 Year, 6 months" },
    ],
    variantCols: [
      { key:"spec", label:"Specification", ph:"e.g. 64GB, Blue",type:"text" },
    ],
  },
};

const SIZE_PRESETS   = ["S","M","L","XL","XXL","3XL","Free Size"];
const COLOUR_PRESETS = ["White","Black","Navy","Red","Blue","Green","Yellow","Pink","Grey","Maroon","Beige","Multi Colour"];

// ── empty forms ────────────────────────────────────────────────────────────────
const emptyVariant = () => ({
  _uid:"", barcode:"", size_label:"", measurement:"", color:"", pattern:"",
  pack_size:"", flavor:"", spec:"", stock:"", mrp:"", cost_price:"",
});

const emptyForm = (type = "garment") => ({
  barcode:"", description:"", rate:"", mrp:"", stockQty:"",
  sku:"", hsn_code:"",gst_rate:"",
  product_type: type,
  category1:"", category2:"", category3:"", category4:"", category5:"", category6:"",
  division:"", department:"", section:"", reorderLevel:"",
  has_variants: false, variants:[],
});

// ── sub-components ──────────────────────────────────────────────────────────────
const INP = "w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition";
const SEL = INP + " cursor-pointer";
const LBL = "block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5";

function Field({ label, children, span = 1 }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className={LBL}>{label}</label>
      {children}
    </div>
  );
}

function SectionCard({ number, title, subtitle, accent = "indigo", children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start gap-3 mb-5">
        <div className={`flex items-center justify-center w-7 h-7 rounded-lg bg-${accent}-600 text-white text-xs font-black shrink-0 mt-0.5`}>
          {number}
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── CatField: renders text or dropdown based on config ─────────────────────────
function CatField({ cfg, value, onChange }) {
  if (cfg.type === "dropdown") {
    return (
      <select className={SEL} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— Select —</option>
        {cfg.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return (
    <input className={INP} value={value} onChange={e => onChange(e.target.value)}
      placeholder={cfg.ph || ""} />
  );
}

// ── Variant cell: dropdown or text based on column type ────────────────────────
function VariantCell({ col, value, onChange }) {
  if (col.type === "size_dropdown") {
    const isPreset = SIZE_PRESETS.includes(value) || value === "";
    return (
      <div>
        <select className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-indigo-400 transition"
          value={isPreset ? value : "Custom"}
          onChange={e => { if (e.target.value !== "Custom") onChange(e.target.value); }}>
          <option value="">— Size —</option>
          {SIZE_PRESETS.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="Custom">Custom…</option>
        </select>
        {!isPreset && (
          <input className="mt-1 w-full bg-white border border-indigo-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400 transition"
            value={value} onChange={e => onChange(e.target.value)} placeholder="Custom size" />
        )}
      </div>
    );
  }
  if (col.type === "colour_dropdown") {
    const isPreset = COLOUR_PRESETS.includes(value) || value === "";
    return (
      <div>
        <select className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-indigo-400 transition"
          value={isPreset ? value : "Custom"}
          onChange={e => { if (e.target.value !== "Custom") onChange(e.target.value); }}>
          <option value="">— Colour —</option>
          {COLOUR_PRESETS.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="Custom">Custom…</option>
        </select>
        {!isPreset && (
          <input className="mt-1 w-full bg-white border border-indigo-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400 transition"
            value={value} onChange={e => onChange(e.target.value)} placeholder="Custom colour" />
        )}
      </div>
    );
  }
  return (
    <input className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-indigo-400 transition"
      value={value} onChange={e => onChange(e.target.value)} placeholder={col.ph || ""} />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function InventoryProductForm({ initialData = null, onSave, onCancel }) {
  const isEdit = !!(initialData && initialData.id);
  const [form,    setForm]    = useState(() => initialData
    ? { ...emptyForm(initialData.product_type || "garment"), ...initialData,
        variants: (initialData.variants || []).map(v => ({ ...emptyVariant(), ...v, _uid: uid() })) }
    : emptyForm("garment"));
  const [saving,  setSaving]  = useState(false);

  // ── Division / Section / Department — fetched from backend, cascading ────
  const [mapping, setMapping] = useState({});

  useEffect(() => {
    authFetch(`${API}/api/product-mapping/grouped`)
      .then(r => r.json())
      .then(d => setMapping(d.data || {}))
      .catch(() => {});
  }, []);

  const divisions   = Object.keys(mapping).sort();
  const sections    = form.division && mapping[form.division]
    ? Object.keys(mapping[form.division]).sort() : [];
  const departments = form.division && form.section && mapping[form.division]?.[form.section]
    ? [...mapping[form.division][form.section]].sort() : [];

  const handleDivision = (v) => setForm(s => ({ ...s, division: v, section: "", department: "" }));
  const handleSection  = (v) => setForm(s => ({ ...s, section: v, department: "" }));

  const cfg    = TYPE_CONFIG[form.product_type] || TYPE_CONFIG.garment;
  const accent = cfg.accent;

  // ── form field setters ───────────────────────────────────────────────────
  const f = (key) => (e) => setForm(s => ({ ...s, [key]: e.target.value }));
  const setVal = (key, val) => setForm(s => ({ ...s, [key]: val }));

  const totalVariantStock = form.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);

  // ── product type change ──────────────────────────────────────────────────
  const handleTypeChange = (newType) => {
    setForm(s => ({ ...s, product_type: newType, variants: [] }));
  };

  // ── parent barcode → update auto-generated variant barcodes ─────────────
  const handleParentBarcodeChange = (newBarcode) => {
    setForm(s => ({
      ...s,
      barcode: newBarcode,
      variants: s.variants.map(v => {
        const parts = [v.size_label || v.pack_size || v.spec, v.measurement, v.color || v.flavor, v.pattern].filter(Boolean);
        const oldAuto = autoBarcode(s.barcode, ...parts);
        if (!v.barcode || v.barcode === oldAuto) {
          return { ...v, barcode: autoBarcode(newBarcode, ...parts) };
        }
        return v;
      })
    }));
  };

  // ── variant CRUD ─────────────────────────────────────────────────────────
  const addVariant = () => setForm(s => ({
    ...s, variants: [...s.variants, { ...emptyVariant(), _uid: uid() }]
  }));

  const removeVariant = (_uid) => setForm(s => ({
    ...s, variants: s.variants.filter(v => v._uid !== _uid)
  }));

  const setVariantField = useCallback((_uid, key, value) => {
    setForm(s => ({
      ...s,
      variants: s.variants.map(v => {
        if (v._uid !== _uid) return v;
        const updated = { ...v, [key]: value };
        // auto-update barcode only if it currently matches the auto pattern
        const parts    = [v.size_label||v.pack_size||v.spec, v.measurement, v.color||v.flavor, v.pattern].filter(Boolean);
        const currentAuto = autoBarcode(s.barcode, ...parts);
        if (v.barcode === "" || v.barcode === currentAuto) {
          const newParts = [
            key === "size_label"  ? value : v.size_label,
            key === "pack_size"   ? value : v.pack_size,
            key === "spec"        ? value : v.spec,
            key === "measurement" ? value : v.measurement,
            key === "color"       ? value : v.color,
            key === "flavor"      ? value : v.flavor,
            key === "pattern"     ? value : v.pattern,
          ].filter(Boolean);
          updated.barcode = autoBarcode(s.barcode, ...newParts);
        }
        return updated;
      })
    }));
  }, []);

  // bulk add from QuickFillPanel
  const handleQuickAdd = (newVariants) => {
    setForm(s => ({ ...s, variants: [...s.variants, ...newVariants] }));
  };

  // ── save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.barcode.trim())     { toast.error("Master barcode is required."); return; }
    if (!form.description.trim()) { toast.error("Product description is required."); return; }
    if (form.has_variants && form.variants.length === 0) {
      toast.error("Add at least one variant or turn off variants."); return;
    }
    if (form.has_variants) {
      const bcs = form.variants.map(v => v.barcode.trim()).filter(Boolean);
      if (new Set(bcs).size !== bcs.length) { toast.error("Variant barcodes must be unique."); return; }
    }

    const payload = {
      ...form,
      stockQty: form.has_variants ? totalVariantStock : Number(form.stockQty || 0),
      variants: form.has_variants
        ? form.variants.map(({ _uid, ...rest }) => ({
            ...rest,
            stock:      Number(rest.stock)      || 0,
            mrp:        Number(rest.mrp)        || 0,
            cost_price: Number(rest.cost_price) || 0,
          }))
        : [],
    };

    try {
      setSaving(true);
      const url    = isEdit ? `${API}/inventory/products/${initialData.id}` : `${API}/inventory/products/`;
      const method = isEdit ? "PUT" : "POST";
      const res    = await authFetch(url, { method, body: JSON.stringify(payload) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      toast.success(isEdit ? "Product updated!" : "Product created!");
      onSave?.(data);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  // ── header accent colour ─────────────────────────────────────────────────
  const accentBg = accent === "emerald" ? "bg-emerald-600" : accent === "slate" ? "bg-slate-700" : "bg-indigo-600";
  const accentText = accent === "emerald" ? "text-emerald-600" : accent === "slate" ? "text-slate-600" : "text-indigo-600";

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-base font-black text-slate-900 tracking-tight">
            {isEdit ? "Edit Product" : "Add New Product"}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            {form.barcode || "No barcode yet"} · {cfg.emoji} {cfg.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`px-6 py-2 text-sm font-bold text-white ${accentBg} hover:opacity-90 rounded-xl transition disabled:opacity-50 flex items-center gap-2`}>
            {saving
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>
              : isEdit ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">

        {/* ══ SECTION 0 — PRODUCT TYPE ══ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${accentBg} text-white text-xs font-black`}>
              ✦
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Product Type</h3>
              <p className="text-xs text-slate-500 mt-0.5">Sets category labels and variant fields</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(TYPE_CONFIG).map(([key, config]) => (
              <button key={key} type="button"
                onClick={() => handleTypeChange(key)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition ${
                  form.product_type === key
                    ? `border-${config.accent}-500 bg-${config.accent}-50`
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                <span className="text-2xl">{config.emoji}</span>
                <div>
                  <p className={`text-xs font-black ${form.product_type === key ? `text-${config.accent}-700` : "text-slate-700"}`}>
                    {config.label}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {key === "garment" ? "Size, colour, sleeve" :
                     key === "fmcg"    ? "Pack size, flavour" :
                                         "Spec, model, unit"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ══ SECTION 1 — MASTER PRODUCT ══ */}
        <SectionCard number="1" title="Master Product" accent={accent}
          subtitle="Core identity — shared across all variants">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Master Barcode *" span={2}>
              <input className={INP} value={form.barcode}
                onChange={e => handleParentBarcodeChange(e.target.value)}
                placeholder="e.g. 89909090" />
            </Field>
            <Field label="Rate / Cost (₹)">
              <input type="number" min="0" className={INP} value={form.rate}
                onChange={f("rate")} placeholder="0.00" />
            </Field>
            <Field label="MRP (₹)">
              <input type="number" min="0" className={INP} value={form.mrp}
                onChange={f("mrp")} placeholder="0.00" />
            </Field>
            <Field label="Product Description *" span={2}>
              <input className={INP} value={form.description}
                onChange={f("description")}
                placeholder={
                  form.product_type === "garment" ? "e.g. Cotton Round Neck T-Shirt" :
                  form.product_type === "fmcg"    ? "e.g. Parle-G Glucose Biscuit" :
                                                    "e.g. Samsung 64GB USB Drive"
                } />
            </Field>
            <Field label="Reorder Level">
              <input type="number" min="0" className={INP} value={form.reorderLevel}
                onChange={f("reorderLevel")} placeholder="0" />
            </Field>
            <Field label="SKU">
  <input className={INP} value={form.sku}
    onChange={f("sku")} placeholder="e.g. GAR-TSHIRT-001" />
</Field>
<Field label="HSN Code">
  <input className={INP} value={form.hsn_code}
    onChange={f("hsn_code")} placeholder="e.g. 6109" />
</Field>


<Field label="GST % (optional)">
  <input
    type="number"
    min="0"
    max="28"
    step="0.01"
    className={INP}
    value={form.gst_rate}
    onChange={f("gst_rate")}
    placeholder="e.g. 5, 12, 18"
  />
</Field>

            {!form.has_variants && (
              <Field label="Stock Qty">
                <input type="number" min="0" className={INP} value={form.stockQty}
                  onChange={f("stockQty")} placeholder="0" />
              </Field>
            )}
          </div>
          {/* Classification row — Division → Section → Department (cascading, from backend) */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
            <Field label="Division">
              <input className={INP} value={form.division} list="dl-division"
                onChange={e => handleDivision(e.target.value)}
                placeholder="Type or select…" />
              <datalist id="dl-division">{divisions.map(d => <option key={d} value={d} />)}</datalist>
            </Field>
            <Field label="Section">
              <input className={INP} value={form.section} list="dl-section"
                onChange={e => handleSection(e.target.value)}
                placeholder="Type or select…" />
              <datalist id="dl-section">{sections.map(s => <option key={s} value={s} />)}</datalist>
            </Field>
            <Field label="Department">
              <input className={INP} value={form.department} list="dl-department"
                onChange={f("department")}
                placeholder="Type or select…" />
              <datalist id="dl-department">{departments.map(d => <option key={d} value={d} />)}</datalist>
            </Field>
          </div>
        </SectionCard>

        {/* ══ SECTION 2 — CATEGORIES ══ */}
        <SectionCard number="2" title="Categories" accent={accent}
          subtitle={`Style / product identity for ${cfg.label} — filled once, shared across all variants`}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {cfg.cats.map(catCfg => (
              <Field key={catCfg.key} label={catCfg.label}>
                <CatField cfg={catCfg} value={form[catCfg.key]}
                  onChange={(val) => setVal(catCfg.key, val)} />
              </Field>
            ))}
          </div>
        </SectionCard>

        {/* ══ SECTION 3 — VARIANTS ══ */}
        <SectionCard number="3" title="Variants" accent={accent}
          subtitle="Each variant tracks stock separately with its own barcode">

          {/* Toggle */}
          <label className="inline-flex items-center gap-3 cursor-pointer mb-5 select-none">
            <div className="relative">
              <input type="checkbox" className="sr-only peer"
                checked={form.has_variants}
                onChange={e => setForm(s => ({
                  ...s,
                  has_variants: e.target.checked,
                  variants: e.target.checked && s.variants.length === 0
                    ? [{ ...emptyVariant(), _uid: uid() }]
                    : s.variants,
                }))} />
              <div className={`w-11 h-6 bg-slate-200 peer-checked:bg-${accent}-600 rounded-full transition-colors`} />
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
            </div>
            <span className="text-sm font-bold text-slate-700">
              {form.product_type === "garment" ? "This product has size / colour variants" :
               form.product_type === "fmcg"    ? "This product comes in different pack sizes" :
                                                  "This product has multiple specifications"}
            </span>
          </label>

          {form.has_variants && (
            <>
              {/* Variant table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 mb-3">
                <table className="w-full text-sm" style={{minWidth: form.product_type === "garment" ? "860px" : "680px"}}>
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest min-w-[180px]">
                        Barcode (auto, editable)
                      </th>
                      {cfg.variantCols.map(col => (
                        <th key={col.key} className="px-2 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-28">
                          {col.label}
                        </th>
                      ))}
                      <th className="px-2 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-20">Stock</th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-24">MRP (₹)</th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-24">Cost (₹)</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {form.variants.length === 0 ? (
                      <tr>
                        <td colSpan={5 + cfg.variantCols.length}
                          className="px-4 py-8 text-center text-sm text-slate-400">
                          No variants yet — click Add Variant or use Quick-fill below
                        </td>
                      </tr>
                    ) : form.variants.map((v) => (
                      <tr key={v._uid} className="hover:bg-slate-50/60 group">
                        {/* Barcode */}
                        <td className="px-2 py-1.5">
                          <input
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-[11px] font-mono text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                            value={v.barcode}
                            onChange={e => setVariantField(v._uid, "barcode", e.target.value)}
                            placeholder="Auto-generated" />
                        </td>
                        {/* Dynamic variant columns */}
                        {cfg.variantCols.map(col => (
                          <td key={col.key} className="px-2 py-1.5">
                            <VariantCell col={col} value={v[col.key] || ""}
                              onChange={val => setVariantField(v._uid, col.key, val)} />
                          </td>
                        ))}
                        {/* Stock */}
                        <td className="px-2 py-1.5">
                          <input type="number" min="0"
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition text-center"
                            value={v.stock}
                            onChange={e => setVariantField(v._uid, "stock", e.target.value)}
                            placeholder="0" />
                        </td>
                        {/* MRP */}
                        <td className="px-2 py-1.5">
                          <input type="number" min="0"
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-indigo-400 transition"
                            value={v.mrp}
                            onChange={e => setVariantField(v._uid, "mrp", e.target.value)}
                            placeholder={form.mrp || "0"} />
                        </td>
                        {/* Cost */}
                        <td className="px-2 py-1.5">
                          <input type="number" min="0"
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-indigo-400 transition"
                            value={v.cost_price}
                            onChange={e => setVariantField(v._uid, "cost_price", e.target.value)}
                            placeholder={form.rate || "0"} />
                        </td>
                        {/* Remove */}
                        <td className="px-2 py-1.5 text-center">
                          <button type="button" onClick={() => removeVariant(v._uid)}
                            className="w-6 h-6 rounded-md bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-400 flex items-center justify-center transition opacity-0 group-hover:opacity-100 mx-auto text-base leading-none">
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {form.variants.length > 0 && (
                    <tfoot className={`bg-${accent}-50 border-t-2 border-${accent}-200`}>
                      <tr>
                        <td colSpan={2 + cfg.variantCols.length}
                          className={`px-3 py-2 text-xs font-black ${accentText} uppercase tracking-wide`}>
                          {form.variants.length} variant{form.variants.length !== 1 ? "s" : ""}
                        </td>
                        <td className={`px-2 py-2 text-center text-sm font-black ${accentText}`}>
                          {totalVariantStock}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Add variant button */}
              <button type="button" onClick={addVariant}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold ${accentText} bg-${accent}-50 hover:bg-${accent}-100 border border-${accent}-200 rounded-xl transition`}>
                <span className="text-lg leading-none">+</span> Add Variant
              </button>

              {/* Quick Fill Panel */}
              <QuickFillPanel
                productType={form.product_type}
                parentBarcode={form.barcode}
                parentMrp={form.mrp}
                parentRate={form.rate}
                sku={form.sku}            
                hsnCode={form.hsn_code}  
                onAdd={handleQuickAdd} />
            </>
          )}

          {!form.has_variants && (
            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 text-center">
              {form.product_type === "garment"
                ? "Enable variants to track stock per size and colour separately."
                : form.product_type === "fmcg"
                ? "Enable variants to track stock per pack size (100g, 500ml etc.) separately."
                : "Enable variants to track stock per specification separately."}
              <br/>
              <span className="font-semibold text-slate-600">
                Without variants, total stock is tracked as one number.
              </span>
            </div>
          )}
        </SectionCard>

        {/* ══ BOTTOM ACTIONS ══ */}
        <div className="flex items-center justify-between pb-8">
          <button onClick={onCancel}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-sm">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`px-8 py-2.5 text-sm font-bold text-white ${accentBg} hover:opacity-90 rounded-xl transition shadow-sm disabled:opacity-50 flex items-center gap-2`}>
            {saving
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>
              : isEdit ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}