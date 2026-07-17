import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useState, useEffect, useCallback } from "react";
import { Tag, Check, AlertTriangle, RefreshCw, X, Plus } from "lucide-react";

/**
 * MSellerCategory.jsx
 * ======================
 * Vendor-facing: sets which business type(s) they are (wholesaler /
 * manufacturer / retailer / fabric_supplier / exporter — multi-select,
 * tier-limited) and free-text product categories (e.g. "casual t-shirts").
 *
 * This is NOT just a display page — without it, a vendor has no way to
 * set business_type at all, which means the buyer-side search
 * (VendorCompareSearch.jsx, QuickOrderFromCatalogue.jsx) has nothing to
 * find. GET /api/vendors/me already returns these fields (they're just
 * on the vendor identity document), but nothing lets the vendor WRITE
 * them until this page calls PATCH /api/vendors/me/classification.
 */

const API_BASE = APP_API_URL;

function getVendorToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("vendor_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

async function vendorFetch(path, options = {}) {
  const token = getVendorToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

const BUSINESS_TYPES = [
  { key: "general_vendor",  label: "General vendor",  hint: "Finished goods or services without a specialist classification" },
  { key: "wholesaler",      label: "Wholesaler",      hint: "Bulk sales to retailers" },
  { key: "manufacturer",    label: "Manufacturer",    hint: "Makes the goods directly" },
  { key: "distributor",     label: "Distributor",     hint: "Distributes brands across a territory" },
  { key: "retailer",        label: "Retailer",        hint: "Sells to end customers too" },
  { key: "fabric_supplier", label: "Fabric supplier", hint: "Raw material / fabric" },
  { key: "exporter",        label: "Exporter",        hint: "Ships outside the country" },
  { key: "job_worker",      label: "Job-work partner", hint: "Provides cutting, stitching, embroidery, washing, finishing or packing for retailer-owned material" },
];

export default function MSellerCategory() {
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [tierLimit, setTierLimit] = useState(null); // null = unlimited
  const [tierLabel, setTierLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, subRes] = await Promise.all([
        vendorFetch("/api/vendors/me"),
        vendorFetch("/api/subscriptions/me"),
      ]);
      const me = await meRes.json();
      const sub = await subRes.json();
      if (!meRes.ok) throw new Error(me.detail || "Could not load your profile.");
      setSelectedTypes(me.business_type || []);
      setCategories(me.product_categories || []);
      if (subRes.ok) {
        setTierLimit(sub.data?.business_type_limit ?? null);
        setTierLabel(sub.data?.label || "");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const atLimit = tierLimit !== null && selectedTypes.length >= tierLimit;

  const toggleType = (key) => {
    setSaved(false);
    setSelectedTypes(prev => {
      if (prev.includes(key)) return prev.filter(t => t !== key);
      if (tierLimit !== null && prev.length >= tierLimit) return prev; // silently blocked, wall shown separately
      return [...prev, key];
    });
  };

  const addCategory = () => {
    const val = categoryInput.trim();
    if (!val || categories.includes(val)) return;
    setCategories(prev => [...prev, val]);
    setCategoryInput("");
    setSaved(false);
  };

  const removeCategory = (val) => {
    setCategories(prev => prev.filter(c => c !== val));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await vendorFetch("/api/vendors/me/classification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_type: selectedTypes, product_categories: categories }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save.");
      setSaved(true);
      window.dispatchEvent(new Event("vendor-access-updated"));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F6F7FB] p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Business category</h1>
            <p className="text-xs text-slate-500">Helps retailers find you when searching by category</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-4 py-3 rounded-xl">
            ⚠ {error}
          </div>
        )}

        {saved && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4" /> Saved — retailers can now find you by these tags.
          </div>
        )}

        {/* Business type selection */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-black text-slate-900">What kind of business are you?</p>
            <span className="text-xs font-bold text-slate-400">
              {selectedTypes.length}{tierLimit !== null ? ` / ${tierLimit}` : ""} selected
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">Select all that apply.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BUSINESS_TYPES.map(({ key, label, hint }) => {
              const isSelected = selectedTypes.includes(key);
              const disabled = !isSelected && atLimit;
              return (
                <button key={key} type="button" onClick={() => toggleType(key)} disabled={disabled}
                  className={`text-left rounded-xl border-2 p-3 transition ${
                    isSelected ? "border-indigo-500 bg-indigo-50" :
                    disabled ? "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed" :
                    "border-slate-200 hover:border-slate-300"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>{label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>
                </button>
              );
            })}
          </div>

          {atLimit && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Your {tierLabel} plan allows {tierLimit} tag{tierLimit !== 1 ? "s" : ""}. Untick one to pick a
                different tag, or check the Subscription tab to upgrade.
              </p>
            </div>
          )}
        </div>

        {/* Product categories */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm font-black text-slate-900 mb-1">What do you sell?</p>
          <p className="text-xs text-slate-500 mb-4">e.g. "casual t-shirts", "formal shirts", "cotton fabric" — free text, add as many as you like.</p>

          <div className="flex gap-2 mb-3">
            <input value={categoryInput} onChange={e => setCategoryInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
              placeholder="Type a category and press Enter"
              className="flex-1 h-9 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400" />
            <button onClick={addCategory} disabled={!categoryInput.trim()}
              className="h-9 w-9 flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg disabled:opacity-40">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {categories.length === 0 ? (
            <p className="text-xs text-slate-400">No categories added yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <span key={cat} className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 bg-slate-100 rounded-full text-xs font-semibold text-slate-700">
                  {cat}
                  <button onClick={() => removeCategory(cat)} className="hover:text-rose-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
