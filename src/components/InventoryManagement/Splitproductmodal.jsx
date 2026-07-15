import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


import React, { useState, useCallback, useEffect } from "react";
import toast from "react-hot-toast";

const API = APP_API_URL;

// ── Shared auth helper — same fix as InventoryProductForm.jsx ──────────────
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

const uid = () => `_${Math.random().toString(36).slice(2)}_${Date.now()}`;

const SIZE_OPTS   = ["S","M","L","XL","XXL","3XL","Free Size"];
const COLOUR_OPTS = ["White","Black","Navy","Red","Blue","Green","Yellow","Pink","Grey","Maroon","Beige","Multi Colour"];
const SLEEVE_OPTS = ["Full Sleeve","Half Sleeve","Sleeveless","3-Quarter Sleeve","Cap Sleeve","N/A"];
const SEASON_OPTS = ["Summer","Winter","Monsoon","Festive","All Season","Spring","N/A"];

const INP  = "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition";
const SEL  = INP + " cursor-pointer";
const LBL  = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1";

// ── auto barcode ───────────────────────────────────────────────────────────────
const autoBC = (designNo, size, colour) => {
  const parts = [designNo, size, colour?.slice(0,3).toUpperCase()].filter(Boolean);
  return parts.join("-");
};

// ── empty style ────────────────────────────────────────────────────────────────
const emptyStyle = (commonFields = {}) => ({
  _uid:       uid(),
  designNo:   "",
  pattern:    "",
  // inherit common fields
  brand:      commonFields.brand      || "",
  style:      commonFields.style      || "",
  sleeveType: commonFields.sleeveType || "",
  sizeRange:  commonFields.sizeRange  || "",
  ageing:     commonFields.ageing     || "",
  variants: [{ _uid: uid(), size_label:"", measurement:"", color:"", stock:"", mrp:"", barcode:"" }],
});

// ── StyleCard ──────────────────────────────────────────────────────────────────
function StyleCard({ style, idx, totalStyles, commonFields, parentMrp,
  onChange, onRemove, onAddVariant, onRemoveVariant, onVariantChange }) {

  const totalStock = style.variants.reduce((s,v) => s + (Number(v.stock)||0), 0);

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">

      {/* Style header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0">
            {idx + 1}
          </div>
          <span className="text-sm font-black text-slate-800">
            {style.pattern || style.designNo || `Style ${idx + 1}`}
          </span>
          {totalStock > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full">
              {totalStock} pcs
            </span>
          )}
        </div>
        {totalStyles > 1 && (
          <button type="button" onClick={onRemove}
            className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition px-2 py-1 rounded-lg hover:bg-rose-50">
            Remove
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">

        {/* Style-specific fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LBL}>Design No. *</label>
            <input className={INP} value={style.designNo}
              onChange={e => onChange("designNo", e.target.value)}
              placeholder="e.g. KRT-001" />
          </div>
          <div>
            <label className={LBL}>Pattern </label>
            <input className={INP} value={style.pattern}
              onChange={e => onChange("pattern", e.target.value)}
              placeholder="Plain, Polka Dots, Printed…" />
          </div>
        </div>

        {/* Variant rows */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={LBL}>Sizes & Stock</label>
            <button type="button" onClick={onAddVariant}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              + Add size
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Barcode","Size","Measurement","Colour","Stock","MRP (₹)",""].map(h => (
                    <th key={h} className="px-2 py-2 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {style.variants.map((v, vi) => (
                  <tr key={v._uid} className="group hover:bg-slate-50">

                    {/* Barcode */}
                    <td className="px-2 py-1.5">
                      <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-mono text-[10px] text-slate-600 outline-none focus:border-indigo-400 transition"
                        value={v.barcode}
                        onChange={e => onVariantChange(v._uid, "barcode", e.target.value)}
                        placeholder="Auto" />
                    </td>

                    {/* Size */}
                    <td className="px-2 py-1.5 w-24">
                      <select className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400 transition"
                        value={SIZE_OPTS.includes(v.size_label) ? v.size_label : v.size_label ? "__custom" : ""}
                        onChange={e => {
                          if (e.target.value !== "__custom") {
                            const bc = autoBC(style.designNo, e.target.value, v.color);
                            onVariantChange(v._uid, "size_label", e.target.value);
                            if (!v.barcode || v.barcode === autoBC(style.designNo, v.size_label, v.color))
                              onVariantChange(v._uid, "barcode", bc);
                          }
                        }}>
                        <option value="">— Size —</option>
                        {SIZE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="__custom">Custom…</option>
                      </select>
                      {!SIZE_OPTS.includes(v.size_label) && v.size_label && (
                        <input className="mt-1 w-full bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs outline-none"
                          value={v.size_label} onChange={e => onVariantChange(v._uid, "size_label", e.target.value)}
                          placeholder="Custom" />
                      )}
                    </td>

                    {/* Measurement */}
                    <td className="px-2 py-1.5 w-24">
                      <input className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400 transition"
                        value={v.measurement}
                        onChange={e => onVariantChange(v._uid, "measurement", e.target.value)}
                        placeholder="30, 32…" />
                    </td>

                    {/* Colour */}
                    <td className="px-2 py-1.5 w-28">
                      <select className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400 transition"
                        value={COLOUR_OPTS.includes(v.color) ? v.color : v.color ? "__custom" : ""}
                        onChange={e => {
                          if (e.target.value !== "__custom") {
                            const bc = autoBC(style.designNo, v.size_label, e.target.value);
                            onVariantChange(v._uid, "color", e.target.value);
                            if (!v.barcode || v.barcode === autoBC(style.designNo, v.size_label, v.color))
                              onVariantChange(v._uid, "barcode", bc);
                          }
                        }}>
                        <option value="">— Colour —</option>
                        {COLOUR_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="__custom">Custom…</option>
                      </select>
                      {!COLOUR_OPTS.includes(v.color) && v.color && (
                        <input className="mt-1 w-full bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs outline-none"
                          value={v.color} onChange={e => onVariantChange(v._uid, "color", e.target.value)}
                          placeholder="Custom" />
                      )}
                    </td>

                    {/* Stock */}
                    <td className="px-2 py-1.5 w-20">
                      <input type="number" min="0"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center outline-none focus:border-indigo-400 transition"
                        value={v.stock}
                        onChange={e => onVariantChange(v._uid, "stock", e.target.value)}
                        placeholder="0" />
                    </td>

                    {/* MRP */}
                    <td className="px-2 py-1.5 w-24">
                      <input type="number" min="0"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400 transition"
                        value={v.mrp}
                        onChange={e => onVariantChange(v._uid, "mrp", e.target.value)}
                        placeholder={parentMrp || "0"} />
                    </td>

                    {/* Remove */}
                    <td className="px-2 py-1.5 text-center">
                      {style.variants.length > 1 && (
                        <button type="button" onClick={() => onRemoveVariant(v._uid)}
                          className="w-5 h-5 rounded-md bg-slate-100 hover:bg-rose-100 hover:text-rose-500 text-slate-400 text-sm flex items-center justify-center transition opacity-0 group-hover:opacity-100 mx-auto">
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {style.variants.length > 0 && (
                <tfoot className="bg-indigo-50 border-t-2 border-indigo-100">
                  <tr>
                    <td colSpan={4} className="px-3 py-1.5 text-[10px] font-black text-indigo-600 uppercase">
                      {style.variants.length} size{style.variants.length !== 1 ? "s" : ""}
                    </td>
                    <td className="px-2 py-1.5 text-center text-xs font-black text-indigo-700">{totalStock}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN — SplitProductModal
// ══════════════════════════════════════════════════════════════════════════════
export default function SplitProductModal({ row, onClose, onDone }) {
  const totalQty = row?.qty || row?.stockQty || 0;

  // ── Common fields (shared across all styles) ───────────────────────────────
  const [common, setCommon] = useState({
    brand:      row?.category2  || "",
    style:      row?.category3  || "",
    sleeveType: row?.category4  || "",
    sizeRange:  row?.category5  || "",
    ageing:     row?.category6  || "",
    hsnCode:    row?.hsn_code   || "", 
    mrp:        row?.mrp        || "",
    rate:       row?.rate       || "",
    division:   row?.division   || "",
    department: row?.department || "",
    section:    row?.section    || "",
  });

  // ── Division / Section / Department — fetched from backend ────────────────
  const [mapping, setMapping] = useState({});

  useEffect(() => {
    authFetch(`${API}/api/product-mapping/grouped`)
      .then(r => r.json())
      .then(d => setMapping(d.data || {}))
      .catch(() => {});
  }, []);

  const divisions   = Object.keys(mapping).sort();
  const sections    = common.division && mapping[common.division]
    ? Object.keys(mapping[common.division]).sort() : [];
  const departments = common.division && common.section && mapping[common.division]?.[common.section]
    ? [...mapping[common.division][common.section]].sort() : [];

  // ── Styles list ────────────────────────────────────────────────────────────
  const [styles,  setStyles]  = useState([emptyStyle(common)]);
  const [saving,  setSaving]  = useState(false);
  const [step,    setStep]    = useState(1); // 1=common, 2=styles

  const setCommonField = (k, v) => setCommon(p => ({ ...p, [k]: v }));

  // Total stock entered across all styles
  const totalEntered = styles.reduce((s, st) =>
    s + st.variants.reduce((vs, v) => vs + (Number(v.stock)||0), 0), 0);

  const remaining = totalQty - totalEntered;

  // ── Style CRUD ─────────────────────────────────────────────────────────────
  const addStyle = () => setStyles(s => [...s, emptyStyle(common)]);

  const removeStyle = (uid) => setStyles(s => s.filter(st => st._uid !== uid));

  const changeStyle = (uid, key, value) =>
    setStyles(s => s.map(st => st._uid === uid ? { ...st, [key]: value } : st));

  const addVariant = (styleUid) =>
    setStyles(s => s.map(st => st._uid === styleUid
      ? { ...st, variants: [...st.variants, { _uid: uid(), size_label:"", measurement:"", color:"", stock:"", mrp:"", barcode:"" }] }
      : st));

  const removeVariant = (styleUid, varUid) =>
    setStyles(s => s.map(st => st._uid === styleUid
      ? { ...st, variants: st.variants.filter(v => v._uid !== varUid) }
      : st));

  const changeVariant = useCallback((styleUid, varUid, key, value) =>
    setStyles(s => s.map(st => {
      if (st._uid !== styleUid) return st;
      return {
        ...st,
        variants: st.variants.map(v => {
          if (v._uid !== varUid) return v;
          return { ...v, [key]: value };
        })
      };
    })), []);

  // ── Save — creates N products, deletes original blob ──────────────────────
  const handleSave = async () => {
    // Validate
    for (const [i, st] of styles.entries()) {
      if (!st.designNo.trim()) { toast.error(`Style ${i+1}: Design No. is required.`); return; }
      for (const v of st.variants) {
        if (!v.stock || Number(v.stock) <= 0) { toast.error(`Style ${i+1}: All variants need a stock qty.`); return; }
      }
    }

    // Check all variant barcodes are unique globally
    const allBarcodes = styles.flatMap(st => st.variants.map(v => v.barcode.trim())).filter(Boolean);
    if (new Set(allBarcodes).size !== allBarcodes.length) {
      toast.error("Duplicate variant barcodes found. Each variant must have a unique barcode."); return;
    }

    try {
      setSaving(true);

      // 1. Create each style as a separate product
      const promises = styles.map(st => {
        const payload = {
          barcode:      st.designNo.trim(),
          description:  `${row.product || "Product"} — ${st.pattern || st.designNo}`,
          rate:         Number(common.rate  || row.rate || 0),
          mrp:          Number(common.mrp   || row.mrp  || 0),
          hsn_code:     common.hsnCode || "", 
          product_type: "garment",
          category1:    st.designNo.trim(),
          category2:    common.brand,
          category3:    common.style,
          category4:    st.pattern,
          category5:    common.sizeRange,
          category6:    common.ageing,
          division:     common.division,
          department:   common.department,
          section:      common.section,
          has_variants: true,
          variants:     st.variants.map(({ _uid, ...rest }) => ({
            ...rest,
            stock:      Number(rest.stock)  || 0,
            mrp:        Number(rest.mrp || common.mrp || row.mrp || 0),
            cost_price: Number(common.rate  || row.rate || 0),
            barcode:    rest.barcode.trim() || autoBC(st.designNo, rest.size_label, rest.color),
          })),
        };
        return authFetch(`${API}/inventory/products/`, {
          method: "POST", body: JSON.stringify(payload),
        }).then(r => r.json());
      });

      const results = await Promise.all(promises);
      const failed  = results.filter(r => r.status !== "success");
      if (failed.length) {
        toast.error(`${failed.length} product(s) failed: ${failed.map(f=>f.detail||"Unknown error").join(", ")}`);
        return;
      }

      // 2. Delete the original blob barcode from inventory_collection
      if (row.barcode) {
        await authFetch(`${API}/inventory/delete/${row.barcode}`, {
          method: "DELETE",
        });
      }

      toast.success(`✓ ${styles.length} product${styles.length>1?"s":""} created — original record removed.`);
      onDone?.();
      onClose();

    } catch (e) {
      toast.error(e.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-black text-white">Split Product into Styles</h2>
            <p className="text-xs text-indigo-200 mt-0.5">
              {row.product} · Barcode {row.barcode} · {totalQty} pcs total
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-lg transition">
            ×
          </button>
        </div>

        {/* Stock tracker bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-600">Stock accounted</span>
            <span className={`text-xs font-black ${remaining < 0 ? "text-rose-600" : remaining === 0 ? "text-emerald-600" : "text-amber-600"}`}>
              {totalEntered} / {totalQty} pcs
              {remaining > 0 && ` · ${remaining} remaining`}
              {remaining < 0 && ` · ${Math.abs(remaining)} over!`}
              {remaining === 0 && " · All accounted ✓"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${remaining < 0 ? "bg-rose-500" : remaining === 0 ? "bg-emerald-500" : "bg-indigo-500"}`}
              style={{ width: `${Math.min((totalEntered / Math.max(totalQty,1)) * 100, 100)}%` }} />
          </div>
        </div>

        {/* Step tabs */}
        <div className="flex shrink-0 border-b border-slate-200">
          {[["1","Common Fields"],["2","Styles & Variants"]].map(([num, label]) => (
            <button key={num} type="button" onClick={() => setStep(Number(num))}
              className={`flex-1 py-3 text-sm font-bold transition border-b-2 ${
                step === Number(num)
                  ? "border-indigo-600 text-indigo-700 bg-indigo-50"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs mr-2 ${
                step === Number(num) ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
              }`}>{num}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── STEP 1: COMMON FIELDS ── */}
          {step === 1 && (
            <div className="space-y-4 max-w-2xl">
              <p className="text-xs text-slate-500">
                These fields are <b className="text-slate-700">shared across all styles</b> of this product.
                Fill once, applies to all.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LBL}>Brand</label>
                  <input className={INP} value={common.brand} onChange={e => setCommonField("brand", e.target.value)} placeholder="e.g. Lourdes" />
                </div>

               <div>
                  <label className={LBL}>HSN Code</label>
                  <input className={INP} value={common.hsnCode}
                   onChange={e => setCommonField("hsnCode", e.target.value)}
                   placeholder="e.g. 6204" />
               </div>


                <div>
                  <label className={LBL}>Style</label>
                  <input className={INP} value={common.style} onChange={e => setCommonField("style", e.target.value)} placeholder="e.g. A-Line Kurti" />
                </div>
                <div>
                  <label className={LBL}>Size Range</label>
                  <input className={INP} value={common.sizeRange} onChange={e => setCommonField("sizeRange", e.target.value)} placeholder="e.g. S to XL" />
                </div>
                <div>
                  <label className={LBL}>Ageing</label>
                  <select className={SEL} value={common.ageing} onChange={e => setCommonField("ageing", e.target.value)}>
                    <option value="">— Select —</option>
                    {SEASON_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LBL}>Default MRP (₹)</label>
                  <input type="number" min="0" className={INP} value={common.mrp} onChange={e => setCommonField("mrp", e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className={LBL}>Cost / Rate (₹)</label>
                  <input type="number" min="0" className={INP} value={common.rate} onChange={e => setCommonField("rate", e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className={LBL}>Division</label>
                  <input className={INP} value={common.division} list="dl-divisions"
                    onChange={e => setCommon(p => ({ ...p, division: e.target.value, section: "", department: "" }))}
                    placeholder="Type or select…" />
                  <datalist id="dl-divisions">{divisions.map(d => <option key={d} value={d} />)}</datalist>
                </div>
                <div>
                  <label className={LBL}>Section</label>
                  <input className={INP} value={common.section} list="dl-sections"
                    onChange={e => setCommon(p => ({ ...p, section: e.target.value, department: "" }))}
                    placeholder="Type or select…" />
                  <datalist id="dl-sections">{sections.map(s => <option key={s} value={s} />)}</datalist>
                </div>
                <div>
                  <label className={LBL}>Department</label>
                  <input className={INP} value={common.department} list="dl-departments"
                    onChange={e => setCommonField("department", e.target.value)}
                    placeholder="Type or select…" />
                  <datalist id="dl-departments">{departments.map(d => <option key={d} value={d} />)}</datalist>
                </div>
              </div>

              <button type="button" onClick={() => setStep(2)}
                className="mt-2 w-full py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition">
                Next → Define Styles & Variants
              </button>
            </div>
          )}

          {/* ── STEP 2: STYLES & VARIANTS ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Each style gets its own <b className="text-slate-700">Design No.</b> and <b className="text-slate-700">Pattern</b>.
                  Variants within a style share the same pattern but differ by size/colour.
                </p>
                <button type="button" onClick={addStyle}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition shrink-0">
                  + Add Style
                </button>
              </div>

              {styles.map((st, idx) => (
                <StyleCard
                  key={st._uid}
                  style={st}
                  idx={idx}
                  totalStyles={styles.length}
                  commonFields={common}
                  parentMrp={common.mrp || row.mrp}
                  onChange={(key, val) => changeStyle(st._uid, key, val)}
                  onRemove={() => removeStyle(st._uid)}
                  onAddVariant={() => addVariant(st._uid)}
                  onRemoveVariant={(vuid) => removeVariant(st._uid, vuid)}
                  onVariantChange={(vuid, key, val) => changeVariant(st._uid, vuid, key, val)}
                />
              ))}

              {/* Stock check */}
              {remaining !== 0 && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  remaining < 0
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-amber-50 border-amber-200 text-amber-700"
                }`}>
                  {remaining > 0
                    ? `⚠ ${remaining} pcs not yet assigned to any style. Assign all pieces before saving.`
                    : `⚠ ${Math.abs(remaining)} pcs over the original qty of ${totalQty}. Check your numbers.`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {styles.length} style{styles.length>1?"s":""} · {totalEntered} pcs · Original ({totalQty} pcs) will be removed
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
              Cancel
            </button>
            {step === 1 ? (
              <button onClick={() => setStep(2)}
                className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition">
                Next →
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving || remaining !== 0}
                className="px-6 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50 flex items-center gap-2">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Creating…</>
                  : `✓ Create ${styles.length} Product${styles.length>1?"s":""}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}