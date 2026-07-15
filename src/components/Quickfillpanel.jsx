import { API_BASE_URL as APP_API_URL } from "../config/api.js";

// /**
//  * QuickFillPanel
//  * ──────────────
//  * Admin side  (ProductList.jsx)           → <QuickFillPanel product={p} onSaved={fn} />
//  * Inventory   (InventoryCurrentStockList) → <QuickFillPanel product={p} onSaved={fn} />
//  *
//  * Fixes applied:
//  *  1. handleSave now reads token from localStorage and sends Authorization header on PUT
//  *  2. For variant products, uses product._inventoryBarcode to hit the correct enrich barcode
//  *  3. PUT fallback now sends FormData (backend uses Form(...) params, not JSON body)
//  */

// import React, { useState, useEffect } from "react";

// const API_BASE = `${APP_API_URL}`;

// const CLASSIFICATION_FIELDS = ["division", "section", "department", "hsn_code", "sku"];
// const PRICING_FIELDS        = ["mrp", "selling_price"];
// const ALL_REQUIRED          = [...CLASSIFICATION_FIELDS, ...PRICING_FIELDS];

// function isIncomplete(product = {}) {
//   if (product.source === "vendor") return false;
//   const effectiveSku = product.sku || product.base_sku || "";
//   const effective = { ...product, sku: effectiveSku };
//   const fieldsToCheck = product.has_variants
//     ? ["division", "section", "department", "hsn_code"]
//     : ["division", "section", "department", "hsn_code", "sku", "mrp", "selling_price"];
//   return fieldsToCheck.some(f => {
//     const v = effective[f];
//     return v === undefined || v === null || v === "" || v === 0;
//   });
// }

// const GST_OPTIONS = [0, 5, 12, 18, 28];
// const UNITS       = ["pcs", "kg", "g", "litre", "ml", "box", "pair", "set", "meter", "dozen"];

// // ─────────────────────────────────────────────────────────────────────────────
// export default function QuickFillPanel({ product = {}, onSaved, readOnly = false }) {
//   const barcode = (product.barcode || product.base_barcode || "").trim();
//   if (readOnly) return <ReadOnlyPanel product={product} />;
//   return <EditPanel product={product} barcode={barcode} onSaved={onSaved} />;
// }


// // ─────────────────────────────────────────────────────────────────────────────
// // READ-ONLY — display only, no form
// // ─────────────────────────────────────────────────────────────────────────────
// function ReadOnlyPanel({ product }) {
//   const fields = [
//     { label: "Division",   value: product.division },
//     { label: "Section",    value: product.section },
//     { label: "Department", value: product.department },
//     { label: "HSN Code",   value: product.hsn_code },
//     { label: "SKU",        value: product.sku || product.base_sku, mono: true },
//     { label: "GST %",      value: product.gst_rate != null && product.gst_rate !== "" ? `${product.gst_rate}%` : null },
//     { label: "MRP",        value: product.mrp ? `₹${Number(product.mrp).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : null, mono: true },
//     { label: "Selling ₹",  value: product.selling_price ? `₹${Number(product.selling_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : null, mono: true },
//     { label: "Unit",       value: product.unit },
//   ];

//   const filled     = fields.filter((f) => f.value);
//   const incomplete = isIncomplete(product);

//   if (filled.length === 0) {
//     return (
//       <div style={{ margin: "14px 0", padding: "12px 16px", borderRadius: 10, background: "#FFF7ED", border: "1px solid #FED7AA", display: "flex", alignItems: "flex-start", gap: 10 }}>
//         <span style={{ fontSize: 18, flexShrink: 0 }}>📋</span>
//         <div>
//           <div style={{ fontSize: 12, fontWeight: 700, color: "#C2410C" }}>Classification not set</div>
//           <div style={{ fontSize: 11, color: "#EA580C", marginTop: 3, lineHeight: 1.5 }}>
//             Division, Section, Department and HSN have not been filled yet.
//             An admin can complete these from <b>Product Master</b>.
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div style={{ margin: "14px 0" }}>
//       <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
//         📂 Classification &amp; Pricing
//         {incomplete && (
//           <span style={{ padding: "2px 8px", borderRadius: 20, background: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E", fontSize: 10, fontWeight: 700 }}>
//             Partial — admin can complete from Product Master
//           </span>
//         )}
//       </div>
//       <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
//         {fields.map(({ label, value, mono }) => (
//           <div key={label} style={{ background: value ? "#F9FAFB" : "#FFF7ED", border: `1px solid ${value ? "#E5E7EB" : "#FED7AA"}`, borderRadius: 8, padding: "8px 12px" }}>
//             <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{label}</div>
//             <div style={{ fontSize: 13, fontWeight: 600, color: value ? "#111827" : "#D97706", fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-all" }}>
//               {value || "—"}
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }


// // ─────────────────────────────────────────────────────────────────────────────
// // EDIT PANEL
// // ─────────────────────────────────────────────────────────────────────────────
// function EditPanel({ product, barcode, onSaved }) {
//   const [open,    setOpen]    = useState(false);
//   const [saving,  setSaving]  = useState(false);
//   const [saved,   setSaved]   = useState(false);
//   const [error,   setError]   = useState("");
//   const [form,    setForm]    = useState(buildForm(product));
//   const [mapping, setMapping] = useState({});
//   const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

//   useEffect(() => {
//     fetch(`${API_BASE}/api/product-mapping/grouped`)
//       .then(r => r.json())
//       .then(d => setMapping(d.data || {}))
//       .catch(() => {});
//   }, []);

//   useEffect(() => {
//     setForm(buildForm(product));
//     setSaved(false);
//     setError("");
//     // Auto-open when product is incomplete (e.g. opened from Fix Fields tab)
//     if (isIncomplete(product)) setOpen(true);
//   }, [product.barcode, product.base_barcode]);

//   const divisions   = Object.keys(mapping).sort();
//   const sections    = form.division && mapping[form.division]
//     ? Object.keys(mapping[form.division]).sort()
//     : [];
//   const departments = form.division && form.section && mapping[form.division]?.[form.section]
//     ? [...mapping[form.division][form.section]].sort()
//     : [];

//   const handleDivision = (v) => setForm(p => ({ ...p, division: v, section: "", department: "" }));
//   const handleSection  = (v) => setForm(p => ({ ...p, section: v, department: "" }));

//   if (!isIncomplete(product) && !open) return null;

//   const handleSave = async () => {
//     // ── 1. Read token from all possible localStorage keys ──
//     const token =
//       localStorage.getItem("admin_token") ||
//       localStorage.getItem("access_token") ||
//       localStorage.getItem("token") || "";
//     const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

//     const payload = {
//       ...form,
//       mrp:           parseFloat(form.mrp)           || 0,
//       selling_price: parseFloat(form.selling_price) || 0,
//       gst_rate:      parseFloat(form.gst_rate)      || 0,
//     };

//     setSaving(true);
//     setError("");

//     try {
//       // ── 2. Resolve the correct barcode for the enrich endpoint ──
//       // For variant products the inventory row barcode (e.g. 890645983019) is a
//       // VARIANT barcode stored in product.variants[].barcode — not product.barcode.
//       // We store it on the product object as _inventoryBarcode in
//       // InventoryCurrentStockList when we call setProduct({ ...found, _inventoryBarcode: row.barcode })
//       let enrichBarcode = product._inventoryBarcode || barcode;

//       // Extra safety: if it's a variant product and we have no _inventoryBarcode,
//       // fall back to base_barcode so enrich can still match the parent doc
//       if (product.has_variants && !product._inventoryBarcode) {
//         enrichBarcode = product.base_barcode || product.barcode || barcode;
//       }

//       if (!enrichBarcode) {
//         setError("No barcode — cannot save.");
//         setSaving(false);
//         return;
//       }

//       // ── 3. Try PATCH /enrich/{barcode} first (no auth required on this route) ──
//       let res = await fetch(
//         `${API_BASE}/api/products/enrich/${encodeURIComponent(enrichBarcode)}`,
//         {
//           method: "PATCH",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify(payload),
//         }
//       );

//       // ── 4. Fallback: PUT /{sku} if enrich returns 404 or 405 ──
//       if (res.status === 404 || res.status === 405) {
//         const sku = form.sku || product.sku || product.base_sku;
//         if (!sku) throw new Error("No SKU — enter a SKU first, then save.");

//         // Backend PUT /{sku} uses Form(...) params — must send FormData, NOT JSON
//         const fd = new FormData();
//         if (form.division)              fd.append("division",      form.division);
//         if (form.section)               fd.append("section",       form.section);
//         if (form.department)            fd.append("department",    form.department);
//         if (form.hsn_code)              fd.append("hsn_code",      form.hsn_code);
//         if (form.gst_rate)              fd.append("gst_rate",      payload.gst_rate);
//         if (payload.mrp)                fd.append("mrp",           payload.mrp);
//         if (payload.selling_price)      fd.append("selling_price", payload.selling_price);
//         if (form.unit)                  fd.append("unit",          form.unit);
//         if (form.description)           fd.append("description",   form.description);
//         fd.append("existing_images", JSON.stringify(product.images || []));

//         res = await fetch(
//           `${API_BASE}/api/products/${encodeURIComponent(sku)}`,
//           {
//             method: "PUT",
//             // No Content-Type header — browser sets it automatically for FormData
//             headers: { ...authHeader },
//             body: fd,
//           }
//         );
//       }

//       if (!res.ok) {
//         const d = await res.json().catch(() => ({}));
//         throw new Error(d.detail || `Save failed (${res.status})`);
//       }

//       setSaved(true);
//       setTimeout(() => { if (onSaved) onSaved(); }, 700);
//     } catch (e) {
//       setError(e.message);
//     } finally {
//       setSaving(false);
//     }
//   };

//   // ── Collapsed state ──
//   if (!open) {
//     return (
//       <div style={{ margin: "16px 0", padding: "12px 16px", borderRadius: 12, background: "#FFFBEB", border: "1.5px dashed #FCD34D", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
//         <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//           <span style={{ fontSize: 18 }}>⚠️</span>
//           <div>
//             <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>Product details incomplete</div>
//             <div style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>
//               Missing: {ALL_REQUIRED.filter((f) => !product[f] && product[f] !== 0).join(", ")}
//             </div>
//           </div>
//         </div>
//         <button onClick={() => setOpen(true)} style={btnAmber}>✏ Fill Details</button>
//       </div>
//     );
//   }

//   // ── Expanded form ──
//   return (
//     <div style={{ margin: "16px 0", borderRadius: 14, border: "1.5px solid #FCD34D", overflow: "hidden", background: "#fff" }}>

//       {/* Panel header */}
//       <div style={{ padding: "12px 16px", background: "linear-gradient(135deg,#FFFBEB,#FEF3C7)", borderBottom: "1px solid #FDE68A", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//         <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//           <span style={{ fontSize: 16 }}>✏️</span>
//           <div>
//             <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>
//               Fill Product Details — {product.product_name || barcode}
//             </div>
//             <div style={{ fontSize: 10, color: "#B45309", marginTop: 1 }}>
//               {product.source === "grn"
//                 ? "Auto-created from GRN — complete classification & pricing below"
//                 : "Some required fields are missing"}
//             </div>
//           </div>
//         </div>
//         <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#92400E" }}>✕</button>
//       </div>

//       {/* Form fields */}
//       <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>

//         {/* Row 1: SKU + HSN + GST */}
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
//           <QField label="SKU" required={!product.sku && !product.base_sku}>
//             <input value={form.sku} onChange={(e) => setF("sku", e.target.value)} placeholder="e.g. COTT-SHRT-001" style={inp} />
//           </QField>
//           <QField label="HSN Code" required={!product.hsn_code}>
//             <input value={form.hsn_code} onChange={(e) => setF("hsn_code", e.target.value)} placeholder="e.g. 6205" style={inp} />
//           </QField>
//           <QField label="GST Rate %">
//             <select value={form.gst_rate} onChange={(e) => setF("gst_rate", e.target.value)} style={inp}>
//               {GST_OPTIONS.map((g) => <option key={g} value={g}>{g}%</option>)}
//             </select>
//           </QField>
//         </div>

//         {/* Row 2: Division → Section → Department */}
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
//           <QField label="Division" required={!product.division}>
//             <input value={form.division} onChange={(e) => handleDivision(e.target.value)} placeholder="Type or select…" list="dl-divisions" style={inp} />
//             <datalist id="dl-divisions">{divisions.map(d => <option key={d} value={d} />)}</datalist>
//           </QField>
//           <QField label="Section" required={!product.section}>
//             <input value={form.section} onChange={(e) => handleSection(e.target.value)} placeholder="Type or select…" list="dl-sections" style={inp} />
//             <datalist id="dl-sections">{sections.map(s => <option key={s} value={s} />)}</datalist>
//           </QField>
//           <QField label="Department" required={!product.department}>
//             <input value={form.department} onChange={(e) => setF("department", e.target.value)} placeholder="Type or select…" list="dl-departments" style={inp} />
//             <datalist id="dl-departments">{departments.map(d => <option key={d} value={d} />)}</datalist>
//           </QField>
//         </div>

//         {/* Row 3: MRP + Selling Price + Unit */}
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
//           <QField label="MRP (₹)" required={!product.mrp}>
//             <input type="number" min="0" value={form.mrp} onChange={(e) => setF("mrp", e.target.value)} placeholder="0.00" style={{ ...inp, textAlign: "right", fontFamily: "monospace" }} />
//           </QField>
//           <QField label="Selling Price (₹)" required={!product.selling_price}>
//             <input type="number" min="0" value={form.selling_price} onChange={(e) => setF("selling_price", e.target.value)} placeholder="0.00" style={{ ...inp, textAlign: "right", fontFamily: "monospace" }} />
//           </QField>
//           <QField label="Unit">
//             <select value={form.unit} onChange={(e) => setF("unit", e.target.value)} style={inp}>
//               {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
//             </select>
//           </QField>
//         </div>

//         {/* Description */}
//         <QField label="Description">
//           <textarea value={form.description} onChange={(e) => setF("description", e.target.value)} rows={2} placeholder="Short product description…" style={{ ...inp, resize: "vertical", height: "auto", paddingTop: 8, paddingBottom: 8 }} />
//         </QField>

//         {error && (
//           <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 12, color: "#991B1B" }}>⚠ {error}</div>
//         )}

//         <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
//           <button onClick={() => setOpen(false)} style={btnGhost}>Cancel</button>
//           <button onClick={handleSave} disabled={saving || saved} style={{ ...btnAmber, opacity: saving || saved ? 0.7 : 1, cursor: saving || saved ? "not-allowed" : "pointer" }}>
//             {saved ? "✓ Saved!" : saving ? "Saving…" : "💾 Save Details"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }


// // ─── Micro helpers ────────────────────────────────────────────────────────────
// function buildForm(p) {
//   return {
//     sku:           p.sku           || p.base_sku    || "",
//     hsn_code:      p.hsn_code      || "",
//     gst_rate:      p.gst_rate      ?? 18,
//     division:      p.division      || "",
//     section:       p.section       || "",
//     department:    p.department    || "",
//     mrp:           p.mrp           || p.cost_price  || "",
//     selling_price: p.selling_price || p.cost_price  || "",
//     description:   p.description   || "",
//     unit:          p.unit          || "pcs",
//   };
// }

// function QField({ label, required, children }) {
//   return (
//     <div>
//       <div style={{ fontSize: 10, fontWeight: 700, color: required ? "#B45309" : "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
//         {label}{required && <span style={{ color: "#EF4444" }}>*</span>}
//       </div>
//       {children}
//     </div>
//   );
// }

// const inp = {
//   width: "100%", padding: "8px 10px", border: "1.5px solid #E5E7EB",
//   borderRadius: 8, fontSize: 13, color: "#111827", background: "#fff",
//   fontFamily: "inherit", outline: "none", boxSizing: "border-box",
// };
// const btnAmber = { padding: "9px 22px", borderRadius: 8, border: "none", background: "#F59E0B", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" };
// const btnGhost = { padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#6B7280" };




import React, { useState } from "react";
import toast from "react-hot-toast";

// ── helpers ────────────────────────────────────────────────────────────────────
const uid = () => `v_${Math.random().toString(36).slice(2)}_${Date.now()}`;

const autoBarcode = (parent, ...parts) => {
  if (!parent) return "";
  const suffix = parts
    .filter(Boolean)
    .map(p => p.toString().replace(/\s+/g, "").toUpperCase().slice(0, 5))
    .join("-");
  return suffix ? `${parent}-${suffix}` : parent;
};

const LBL = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1";
const INP = "w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition";
const SEL = INP + " cursor-pointer";


function MissingFieldsBanner({ missingFields }) {
  if (!missingFields.length) return null;
  return (
    <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
      <span className="text-lg leading-none">⚠️</span>
      <div>
        <p className="text-xs font-black text-amber-800 mb-1">
          Missing: {missingFields.join(", ")}
        </p>
        <p className="text-xs text-amber-700">
          Complete these fields so this item appears correctly in reports and filters.
        </p>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// GARMENT QUICK FILL
// Pick sizes → enter colour → enter measurement + stock per size
// ══════════════════════════════════════════════════════════════════════════════
function GarmentQuickFill({ parentBarcode, parentMrp, parentRate, onAdd, onClose }) {
  const SIZE_GRID = ["S","M","L","XL","XXL","3XL","Free Size"];

  const [selectedSizes, setSelectedSizes] = useState([]);
  const [colour,        setColour]        = useState("");
  const [customColour,  setCustomColour]  = useState("");
  const [perSize,       setPerSize]       = useState({});  // size → { stock, measurement, mrp }
  const [globalMrp,     setGlobalMrp]     = useState(parentMrp || "");
  const [useGlobalMrp,  setUseGlobalMrp]  = useState(true);

  const COLOUR_PRESETS = ["White","Black","Navy","Red","Blue","Green","Yellow","Pink","Grey","Maroon","Beige","Multi Colour"];

  const toggleSize = (s) =>
    setSelectedSizes(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s]);

  const setSizeField = (size, key, value) =>
    setPerSize(prev => ({ ...prev, [size]: { ...(prev[size]||{}), [key]: value } }));

  const finalColour = colour === "Custom" ? customColour : colour;

  const handleAdd = () => {
    if (!selectedSizes.length) { toast.error("Select at least one size."); return; }
    if (!finalColour.trim())   { toast.error("Enter a colour."); return; }

    const variants = selectedSizes.map(size => {
      const ps   = perSize[size] || {};
      const meas = ps.measurement || "";
      const mrp  = useGlobalMrp ? Number(globalMrp || parentMrp || 0) : Number(ps.mrp || globalMrp || parentMrp || 0);
      return {
        _uid:        uid(),
        barcode:     autoBarcode(parentBarcode, size, meas, finalColour),
        size_label:  size,
        measurement: meas,
        color:       finalColour.trim(),
        pack_size:   "",
        flavor:      "",
        spec:        "",
        stock:       Number(ps.stock || 0),
        mrp,
        cost_price:  Number(parentRate || 0),
      };
    });

    onAdd(variants);
    toast.success(`${variants.length} variant${variants.length>1?"s":""} added!`);
    onClose();
  };

  return (
    <div className="space-y-5">
      {/* Size toggles */}
      <div>
        <label className={LBL}>Select Sizes *</label>
        <div className="flex flex-wrap gap-2">
          {SIZE_GRID.map(s => (
            <button key={s} type="button" onClick={() => toggleSize(s)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                selectedSizes.includes(s)
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Colour */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LBL}>Colour *</label>
          <select className={SEL} value={colour} onChange={e => setColour(e.target.value)}>
            <option value="">— Select colour —</option>
            {COLOUR_PRESETS.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="Custom">Custom…</option>
          </select>
          {colour === "Custom" && (
            <input className={INP + " mt-1.5"} value={customColour}
              onChange={e => setCustomColour(e.target.value)} placeholder="Type colour name" />
          )}
        </div>
        <div>
          <label className={LBL}>MRP (₹)</label>
          <div className="flex items-center gap-2">
            <input type="number" min="0" className={INP} value={globalMrp}
              onChange={e => setGlobalMrp(e.target.value)} placeholder={parentMrp || "0"} />
          </div>
          <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
            <input type="checkbox" checked={useGlobalMrp}
              onChange={e => setUseGlobalMrp(e.target.checked)}
              className="accent-indigo-600" />
            <span className="text-[10px] text-slate-500">Same MRP for all sizes</span>
          </label>
        </div>
      </div>

      {/* Per-size grid */}
      {selectedSizes.length > 0 && (
        <div>
          <label className={LBL}>Measurement & Stock per Size</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {selectedSizes.map(size => (
              <div key={size} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-700 uppercase tracking-wide">{size}</span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {autoBarcode(parentBarcode, size, perSize[size]?.measurement || "", finalColour || "").slice(-8)}
                  </span>
                </div>
                <input className={INP}
                  value={perSize[size]?.measurement || ""}
                  onChange={e => setSizeField(size, "measurement", e.target.value)}
                  placeholder="Meas. e.g. 30, 32" />
                <input type="number" min="0" className={INP + " text-center font-bold"}
                  value={perSize[size]?.stock || ""}
                  onChange={e => setSizeField(size, "stock", e.target.value)}
                  placeholder="Stock qty" />
                {!useGlobalMrp && (
                  <input type="number" min="0" className={INP}
                    value={perSize[size]?.mrp || ""}
                    onChange={e => setSizeField(size, "mrp", e.target.value)}
                    placeholder={`MRP (${globalMrp || parentMrp || "0"})`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {selectedSizes.length > 0 && finalColour && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Preview</p>
          <div className="space-y-1">
            {selectedSizes.map(size => (
              <div key={size} className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-600 text-[10px]">
                  {autoBarcode(parentBarcode, size, perSize[size]?.measurement || "", finalColour)}
                </span>
                <span className="font-bold text-slate-700">
                  {size} · {perSize[size]?.measurement || "—"} · {finalColour} · Qty: {perSize[size]?.stock || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={handleAdd}
          className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition">
          Add {selectedSizes.length > 0 ? `${selectedSizes.length} Variant${selectedSizes.length>1?"s":""}` : "Variants"}
        </button>
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FMCG QUICK FILL
// Pick pack sizes → enter flavour → enter stock per pack size
// ══════════════════════════════════════════════════════════════════════════════
function FMCGQuickFill({ parentBarcode, parentMrp, parentRate, onAdd, onClose }) {
  const PACK_SIZES = ["50g","100g","200g","250g","500g","1kg","2kg","5kg","50ml","100ml","200ml","250ml","500ml","1L","2L"];

  const [selectedPacks, setSelectedPacks] = useState([]);
  const [flavour,       setFlavour]       = useState("");
  const [perPack,       setPerPack]       = useState({});  // pack → { stock, mrp }
  const [globalMrp,     setGlobalMrp]     = useState(parentMrp || "");
  const [useGlobalMrp,  setUseGlobalMrp]  = useState(true);

  const togglePack = (p) =>
    setSelectedPacks(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev, p]);

  const setPackField = (pack, key, value) =>
    setPerPack(prev => ({ ...prev, [pack]: { ...(prev[pack]||{}), [key]: value } }));

  const handleAdd = () => {
    if (!selectedPacks.length) { toast.error("Select at least one pack size."); return; }

    const variants = selectedPacks.map(pack => {
      const pp  = perPack[pack] || {};
      const mrp = useGlobalMrp ? Number(globalMrp || parentMrp || 0) : Number(pp.mrp || globalMrp || parentMrp || 0);
      return {
        _uid:        uid(),
        barcode:     autoBarcode(parentBarcode, pack, flavour),
        size_label:  "",
        measurement: "",
        color:       "",
        pack_size:   pack,
        flavor:      flavour.trim(),
        spec:        "",
        stock:       Number(pp.stock || 0),
        mrp,
        cost_price:  Number(parentRate || 0),
      };
    });

    onAdd(variants);
    toast.success(`${variants.length} variant${variants.length>1?"s":""} added!`);
    onClose();
  };

  return (
    <div className="space-y-5">
      {/* Pack size toggles */}
      <div>
        <label className={LBL}>Select Pack Sizes *</label>
        <div className="flex flex-wrap gap-2">
          {PACK_SIZES.map(p => (
            <button key={p} type="button" onClick={() => togglePack(p)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                selectedPacks.includes(p)
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
              }`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Flavour + MRP */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LBL}>Flavour / Variant</label>
          <input className={INP} value={flavour}
            onChange={e => setFlavour(e.target.value)}
            placeholder="e.g. Original, Mango, Classic" />
        </div>
        <div>
          <label className={LBL}>MRP (₹)</label>
          <input type="number" min="0" className={INP} value={globalMrp}
            onChange={e => setGlobalMrp(e.target.value)} placeholder={parentMrp || "0"} />
          <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
            <input type="checkbox" checked={useGlobalMrp}
              onChange={e => setUseGlobalMrp(e.target.checked)}
              className="accent-emerald-600" />
            <span className="text-[10px] text-slate-500">Same MRP for all pack sizes</span>
          </label>
        </div>
      </div>

      {/* Per-pack grid */}
      {selectedPacks.length > 0 && (
        <div>
          <label className={LBL}>Stock per Pack Size</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {selectedPacks.map(pack => (
              <div key={pack} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-700 uppercase tracking-wide">{pack}</span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {autoBarcode(parentBarcode, pack, flavour).slice(-8)}
                  </span>
                </div>
                <input type="number" min="0" className={INP + " text-center font-bold"}
                  value={perPack[pack]?.stock || ""}
                  onChange={e => setPackField(pack, "stock", e.target.value)}
                  placeholder="Stock qty" />
                {!useGlobalMrp && (
                  <input type="number" min="0" className={INP}
                    value={perPack[pack]?.mrp || ""}
                    onChange={e => setPackField(pack, "mrp", e.target.value)}
                    placeholder={`MRP (${globalMrp || parentMrp || "0"})`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {selectedPacks.length > 0 && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Preview</p>
          <div className="space-y-1">
            {selectedPacks.map(pack => (
              <div key={pack} className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-600 text-[10px]">
                  {autoBarcode(parentBarcode, pack, flavour)}
                </span>
                <span className="font-bold text-slate-700">
                  {pack} {flavour ? `· ${flavour}` : ""} · Qty: {perPack[pack]?.stock || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={handleAdd}
          className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition">
          Add {selectedPacks.length > 0 ? `${selectedPacks.length} Variant${selectedPacks.length>1?"s":""}` : "Variants"}
        </button>
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERAL QUICK FILL
// Just spec + stock rows (no preset toggles)
// ══════════════════════════════════════════════════════════════════════════════
function GeneralQuickFill({ parentBarcode, parentMrp, parentRate, onAdd, onClose }) {
  const [rows, setRows] = useState([{ _uid: uid(), spec: "", stock: "", mrp: "", barcode: "" }]);

  const addRow = () => setRows(prev => [...prev, { _uid: uid(), spec: "", stock: "", mrp: "", barcode: "" }]);
  const removeRow = (id) => setRows(prev => prev.filter(r => r._uid !== id));

  const setField = (id, key, value) => {
    setRows(prev => prev.map(r => {
      if (r._uid !== id) return r;
      const updated = { ...r, [key]: value };
      if (key === "spec") {
        const autoBC = autoBarcode(parentBarcode, value);
        const currentAuto = autoBarcode(parentBarcode, r.spec);
        if (!r.barcode || r.barcode === currentAuto) updated.barcode = autoBC;
      }
      return updated;
    }));
  };

  const handleAdd = () => {
    const valid = rows.filter(r => r.spec.trim() || r.barcode.trim());
    if (!valid.length) { toast.error("Add at least one variant with a spec or barcode."); return; }

    const variants = valid.map(r => ({
      _uid:        uid(),
      barcode:     r.barcode.trim() || autoBarcode(parentBarcode, r.spec),
      size_label:  "",
      measurement: "",
      color:       "",
      pack_size:   "",
      flavor:      "",
      spec:        r.spec.trim(),
      stock:       Number(r.stock || 0),
      mrp:         Number(r.mrp || parentMrp || 0),
      cost_price:  Number(parentRate || 0),
    }));

    onAdd(variants);
    toast.success(`${variants.length} variant${variants.length>1?"s":""} added!`);
    onClose();
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Add variants by specification (e.g. 64GB/128GB for phones, A4/A5 for notebooks).
      </p>

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={row._uid} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-1 text-[10px] font-bold text-slate-400 text-center">{idx+1}</div>
            <div className="col-span-4">
              <input className={INP} value={row.spec}
                onChange={e => setField(row._uid, "spec", e.target.value)}
                placeholder="Spec (e.g. 64GB, A4)" />
            </div>
            <div className="col-span-4">
              <input className={INP + " font-mono text-[10px]"} value={row.barcode}
                onChange={e => setField(row._uid, "barcode", e.target.value)}
                placeholder="Barcode (auto)" />
            </div>
            <div className="col-span-2">
              <input type="number" min="0" className={INP + " text-center"} value={row.stock}
                onChange={e => setField(row._uid, "stock", e.target.value)}
                placeholder="Stock" />
            </div>
            <div className="col-span-1 text-center">
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(row._uid)}
                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-400 text-xs flex items-center justify-center transition">
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow}
        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
        <span className="text-base leading-none">+</span> Add row
      </button>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={handleAdd}
          className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition">
          Add Variants
        </button>
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — QuickFillPanel
// Wraps all three panels with a trigger button + collapsible container
// ══════════════════════════════════════════════════════════════════════════════
export default function QuickFillPanel({ productType, parentBarcode, parentMrp, parentRate, onAdd }) {
  const [open, setOpen] = useState(false);

  const type    = (productType || "garment").toLowerCase();
  const accent  = type === "fmcg" ? "emerald" : "indigo";
  const label   = type === "garment" ? "Quick-fill by size & colour"
                : type === "fmcg"    ? "Quick-fill by pack size"
                :                      "Quick-fill by specification";

  return (
    <div className="mt-3">
      <MissingFieldsBanner missingFields={[]} />
      <button type="button"
        onClick={() => setOpen(o => !o)}
        className={`text-xs font-bold underline underline-offset-2 transition ${
          open ? "text-slate-400" : `text-${accent}-600 hover:text-${accent}-800`
        }`}>
        {open ? "▲ Hide quick-fill" : `▼ ${label}`}
      </button>

      {open && (
        <div className={`mt-3 p-5 bg-slate-50 rounded-2xl border ${
          type === "fmcg" ? "border-emerald-200" : "border-indigo-100"
        }`}>
          <p className={`text-[10px] font-black uppercase tracking-widest mb-4 ${
            type === "fmcg" ? "text-emerald-700" : "text-indigo-700"
          }`}>
            {label}
          </p>

          {type === "garment" && (
            <GarmentQuickFill
              parentBarcode={parentBarcode}
              parentMrp={parentMrp}
              parentRate={parentRate}
              onAdd={onAdd}
              onClose={() => setOpen(false)} />
          )}

          {type === "fmcg" && (
            <FMCGQuickFill
              parentBarcode={parentBarcode}
              parentMrp={parentMrp}
              parentRate={parentRate}
              onAdd={onAdd}
              onClose={() => setOpen(false)} />
          )}

          {type === "general" && (
            <GeneralQuickFill
              parentBarcode={parentBarcode}
              parentMrp={parentMrp}
              parentRate={parentRate}
              onAdd={onAdd}
              onClose={() => setOpen(false)} />
          )}
        </div>
      )}
    </div>
  );
}