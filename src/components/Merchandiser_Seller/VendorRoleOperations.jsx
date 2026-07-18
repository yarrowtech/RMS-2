import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../config/api.js";
import { Building2, CheckCircle2, LoaderCircle, Save, Sparkles } from "lucide-react";

const ROLE_CONFIG = {
  wholesaler: {
    title: "Wholesale Operations",
    description: "Publish your MOQ, bulk pricing approach and dispatch commitments for retail buyers.",
    fields: [
      { key: "minimum_order_quantity", label: "Minimum order quantity", placeholder: "e.g. 100" },
      { key: "minimum_order_unit", label: "Order unit", placeholder: "pcs, cartons or packs" },
      { key: "bulk_price_note", label: "Bulk pricing policy", type: "textarea", placeholder: "Describe quantity slabs or bulk pricing terms" },
      { key: "stock_availability", label: "Stock availability", placeholder: "Ready stock / made to order" },
      { key: "service_regions", label: "Service regions", type: "tags", placeholder: "Kerala, Tamil Nadu, Pan India" },
      { key: "dispatch_lead_days", label: "Dispatch lead time (days)", type: "number", placeholder: "e.g. 3" },
    ],
  },
  manufacturer: {
    title: "Manufacturing Operations",
    description: "Show buyers your production capacity, quality standards and available manufacturing services.",
    fields: [
      { key: "monthly_capacity", label: "Monthly capacity", placeholder: "e.g. 25000" },
      { key: "capacity_unit", label: "Capacity unit", placeholder: "pieces, sets or units" },
      { key: "minimum_order_quantity", label: "Minimum order quantity", placeholder: "e.g. 500" },
      { key: "production_lead_days", label: "Production lead time (days)", type: "number", placeholder: "e.g. 21" },
      { key: "quality_standards", label: "Quality standards", type: "textarea", placeholder: "Quality checks, certifications or inspection standards" },
      { key: "services", label: "Services", type: "tags", placeholder: "Cutting, stitching, embroidery" },
    ],
  },
  fabric_supplier: {
    title: "Fabric Supply Operations",
    description: "Make material sourcing easier by describing your fabric range, specifications and sampling support.",
    fields: [
      { key: "fabric_types", label: "Fabric types", type: "tags", placeholder: "Cotton, denim, rayon" },
      { key: "compositions", label: "Compositions", type: "tags", placeholder: "100% cotton, 60/40 blend" },
      { key: "gsm_range", label: "GSM range", placeholder: "e.g. 120–300 GSM" },
      { key: "width_range", label: "Width range", placeholder: "e.g. 44–60 inches" },
      { key: "shade_colours", label: "Available shades / colours", type: "tags", placeholder: "Black, Navy, custom dyeing" },
      { key: "minimum_order_quantity", label: "Minimum order quantity", placeholder: "e.g. 100 metres" },
      { key: "sample_available", label: "Sample availability", type: "select", options: ["Yes", "No", "On request"] },
    ],
  },
  distributor: {
    title: "Distribution Operations",
    description: "Tell buyers which brands, territories and sales channels you can serve.",
    fields: [
      { key: "brands", label: "Brands / product lines", type: "tags", placeholder: "Add each brand or product line" },
      { key: "territories", label: "Territories", type: "tags", placeholder: "Kochi, Kerala, South India" },
      { key: "sales_channels", label: "Sales channels", type: "tags", placeholder: "Retail, online, B2B" },
      { key: "stock_availability", label: "Stock availability", placeholder: "Ready stock / allocation based" },
      { key: "dispatch_lead_days", label: "Dispatch lead time (days)", type: "number", placeholder: "e.g. 2" },
      { key: "minimum_order_quantity", label: "Minimum order quantity", placeholder: "e.g. 50" },
    ],
  },
  exporter: {
    title: "Export Operations",
    description: "Publish the countries, Incoterms and export documents you support for international buyers.",
    fields: [
      { key: "export_countries", label: "Export countries", type: "tags", placeholder: "UAE, USA, UK" },
      { key: "incoterms", label: "Incoterms", type: "tags", placeholder: "FOB, CIF, EXW" },
      { key: "currencies", label: "Accepted currencies", type: "tags", placeholder: "USD, EUR, AED" },
      { key: "minimum_order_quantity", label: "Minimum order quantity", placeholder: "e.g. 1000" },
      { key: "export_lead_days", label: "Export lead time (days)", type: "number", placeholder: "e.g. 30" },
      { key: "export_documents", label: "Export documents supported", type: "tags", placeholder: "Invoice, packing list, certificate of origin" },
    ],
  },
  retailer: {
    title: "Retail Sourcing Operations",
    description: "Describe the categories and locations where you source products as a retail business.",
    fields: [
      { key: "store_categories", label: "Store categories", type: "tags", placeholder: "Menswear, kidswear, lifestyle" },
      { key: "sourcing_regions", label: "Sourcing regions", type: "tags", placeholder: "India, South India, local suppliers" },
      { key: "minimum_order_quantity", label: "Preferred minimum order quantity", placeholder: "e.g. 20" },
      { key: "seasonal_requirements", label: "Seasonal requirements", type: "textarea", placeholder: "Describe upcoming collections, seasons or demand" },
      { key: "delivery_locations", label: "Delivery locations", type: "tags", placeholder: "Kochi, Bengaluru, warehouse address" },
    ],
  },
};

const toTextValue = (value) => Array.isArray(value) ? value.join(", ") : value ?? "";

function getToken() {
  return localStorage.getItem("vendor_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

function emptyForm(role) {
  return (ROLE_CONFIG[role]?.fields || []).reduce((result, field) => {
    result[field.key] = "";
    return result;
  }, {});
}

function dataToForm(role, data = {}) {
  return (ROLE_CONFIG[role]?.fields || []).reduce((result, field) => {
    result[field.key] = toTextValue(data[field.key]);
    return result;
  }, {});
}

function formToPayload(role, form) {
  return (ROLE_CONFIG[role]?.fields || []).reduce((result, field) => {
    const value = String(form[field.key] || "").trim();
    if (!value) return result;
    result[field.key] = field.type === "tags"
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : value;
    return result;
  }, {});
}

export default function VendorRoleOperations({ businessTypes = [] }) {
  const availableRoles = useMemo(
    () => (Array.isArray(businessTypes) ? businessTypes : []).filter((type) => ROLE_CONFIG[type]),
    [businessTypes]
  );
  const [role, setRole] = useState(availableRoles[0] || "");
  const [form, setForm] = useState(() => emptyForm(availableRoles[0]));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!availableRoles.includes(role)) setRole(availableRoles[0] || "");
  }, [availableRoles, role]);

  const loadProfile = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/vendor-role-operations/${role}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "Could not load this business profile.");
      setForm(dataToForm(role, payload.data));
    } catch (requestError) {
      setError(requestError.message || "Could not load this business profile.");
      setForm(emptyForm(role));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!role) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/vendor-role-operations/${role}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ data: formToPayload(role, form) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "Could not save this business profile.");
      setMessage("Business operations saved. Your profile is ready for the matching workflow.");
    } catch (requestError) {
      setError(requestError.message || "Could not save this business profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!availableRoles.length) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Building2 className="mx-auto mb-3 text-teal-600" size={28} />
        <h2 className="text-lg font-bold text-slate-900">Choose a specialist business type first</h2>
        <p className="mt-2 text-sm text-slate-500">Add Wholesale, Manufacturing, Fabric Supply, Distribution, Export or Retailer in My Categories to unlock its operations workspace.</p>
      </div>
    );
  }

  const config = ROLE_CONFIG[role];
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-teal-700 to-emerald-600 px-6 py-6 text-white">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15"><Sparkles size={20} /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">Business profile</p>
              <h2 className="mt-1 text-xl font-bold">{config.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-emerald-50/90">{config.description}</p>
            </div>
          </div>
        </div>
        {availableRoles.length > 1 && (
          <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
            {availableRoles.map((item) => (
              <button key={item} type="button" onClick={() => setRole(item)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${role === item ? "bg-teal-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-700"}`}>
                {ROLE_CONFIG[item].title.replace(" Operations", "")}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={saveProfile} className="p-5 sm:p-6">
          {loading ? (
            <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18} /> Loading profile…</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {config.fields.map((field) => (
                <label key={field.key} className={`block ${field.type === "textarea" ? "md:col-span-2" : ""}`}>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">{field.label}</span>
                  {field.type === "textarea" ? (
                    <textarea rows={3} value={form[field.key] || ""} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10" />
                  ) : field.type === "select" ? (
                    <select value={form[field.key] || ""} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10">
                      <option value="">Select an option</option>
                      {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input type={field.type === "number" ? "number" : "text"} min={field.type === "number" ? "0" : undefined} value={form[field.key] || ""} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10" />
                  )}
                  {field.type === "tags" && <span className="mt-1 block text-xs text-slate-400">Separate multiple values with commas.</span>}
                </label>
              ))}
            </div>
          )}
          {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
          {message && <p className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"><CheckCircle2 size={17} /> {message}</p>}
          <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
            <button type="submit" disabled={loading || saving} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />} {saving ? "Saving…" : "Save operations"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
