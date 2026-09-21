import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import React, { useState } from "react";

// ── Restores the "fix missing classification/pricing fields" flow that used
// to live in QuickFillPanel.jsx before that component was repurposed into a
// variant-creation tool (size/colour/pack quick-fill) with an unrelated prop
// signature. This is the panel ProductList.jsx's "Fix" tab actually needs —
// a real form for HSN Code, Division, Section, Department, MRP, Selling
// Price — wired to the existing PATCH /api/products/enrich/{barcode}
// endpoint (its own backend docstring confirms this is what it's for).

const API_BASE = APP_API_URL;
const getToken = () =>
  localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";

const GST_OPTIONS = [0, 5, 12, 18, 28];
const UNITS = ["pcs", "kg", "g", "litre", "ml", "box", "pair", "set", "meter", "dozen"];

const LBL = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1";
const INP = "w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition";

function buildForm(p) {
  return {
    sku: p.sku || p.base_sku || "",
    hsn_code: p.hsn_code || "",
    gst_rate: p.gst_rate ?? 18,
    division: p.division || "",
    section: p.section || "",
    department: p.department || "",
    mrp: p.mrp || "",
    selling_price: p.selling_price || "",
    unit: p.unit || "pcs",
    description: p.description || "",
  };
}

function QField({ label, required, children }) {
  return (
    <div>
      <div className={LBL} style={{ color: required ? "#B45309" : undefined }}>
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </div>
      {children}
    </div>
  );
}

export default function ProductClassificationFix({ product = {}, onSaved }) {
  const [form, setForm] = useState(() => buildForm(product));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const barcode = (product.barcode || product.base_barcode || "").trim();

  const handleSave = async () => {
    if (!barcode) { setError("No barcode on this product — cannot save."); return; }
    setSaving(true);
    setError("");
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/api/products/enrich/${encodeURIComponent(barcode)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          sku: form.sku || undefined,
          hsn_code: form.hsn_code || undefined,
          gst_rate: form.gst_rate !== "" ? Number(form.gst_rate) : undefined,
          division: form.division || undefined,
          section: form.section || undefined,
          department: form.department || undefined,
          mrp: form.mrp !== "" ? Number(form.mrp) : undefined,
          selling_price: form.selling_price !== "" ? Number(form.selling_price) : undefined,
          unit: form.unit || undefined,
          description: form.description || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `Save failed (${res.status})`);
      }
      setSaved(true);
      setTimeout(() => { onSaved && onSaved(); }, 500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QField label="SKU" required={!product.sku && !product.base_sku}>
          <input className={INP} value={form.sku} onChange={(e) => setF("sku", e.target.value)} placeholder="e.g. COTT-SHRT-001" />
        </QField>
        <QField label="HSN Code" required={!product.hsn_code}>
          <input className={INP} value={form.hsn_code} onChange={(e) => setF("hsn_code", e.target.value)} placeholder="e.g. 6205" />
        </QField>
        <QField label="GST Rate %">
          <select className={INP} value={form.gst_rate} onChange={(e) => setF("gst_rate", e.target.value)}>
            {GST_OPTIONS.map((g) => <option key={g} value={g}>{g}%</option>)}
          </select>
        </QField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QField label="Division" required={!product.division}>
          <input className={INP} value={form.division} onChange={(e) => setF("division", e.target.value)} placeholder="e.g. Men" />
        </QField>
        <QField label="Section" required={!product.section}>
          <input className={INP} value={form.section} onChange={(e) => setF("section", e.target.value)} placeholder="e.g. Topwear" />
        </QField>
        <QField label="Department" required={!product.department}>
          <input className={INP} value={form.department} onChange={(e) => setF("department", e.target.value)} placeholder="e.g. Shirts" />
        </QField>
      </div>

      {!product.has_variants && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QField label="MRP (₹)" required={!product.mrp}>
            <input type="number" min="0" className={INP} value={form.mrp} onChange={(e) => setF("mrp", e.target.value)} placeholder="0.00" />
          </QField>
          <QField label="Selling Price (₹)" required={!product.selling_price}>
            <input type="number" min="0" className={INP} value={form.selling_price} onChange={(e) => setF("selling_price", e.target.value)} placeholder="0.00" />
          </QField>
          <QField label="Unit">
            <select className={INP} value={form.unit} onChange={(e) => setF("unit", e.target.value)}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </QField>
        </div>
      )}

      <QField label="Description">
        <textarea className={INP} rows={2} value={form.description} onChange={(e) => setF("description", e.target.value)} placeholder="Short product description…" />
      </QField>

      {error && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">⚠ {error}</div>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={handleSave} disabled={saving || saved}
          className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl transition">
          {saved ? "✓ Saved!" : saving ? "Saving…" : "Save Details"}
        </button>
      </div>
    </div>
  );
}
