import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit, Save, RefreshCcw, Package, UploadCloud, X, Search, Layers, Boxes } from "lucide-react";
import BulkMappingImportModal from "../../utils/BulkMappingImportModal.jsx";

const API_BASE_URL = APP_API_URL;

function getAdminToken() {
  return (
    localStorage.getItem("admin_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function authFetch(url, options = {}) {
  const token = getAdminToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

const FIELD_ACCENTS = {
  indigo: { ring: "focus:ring-indigo-100 focus:border-indigo-400", dot: "bg-indigo-500", text: "text-indigo-700", chip: "bg-indigo-50 text-indigo-700 ring-indigo-100" },
  purple: { ring: "focus:ring-violet-100 focus:border-violet-400", dot: "bg-violet-500", text: "text-violet-700", chip: "bg-violet-50 text-violet-700 ring-violet-100" },
  pink:   { ring: "focus:ring-rose-100 focus:border-rose-400",     dot: "bg-rose-500",   text: "text-rose-700",   chip: "bg-rose-50 text-rose-700 ring-rose-100" },
  blue:   { ring: "focus:ring-sky-100 focus:border-sky-400",       dot: "bg-sky-500",    text: "text-sky-700",    chip: "bg-sky-50 text-sky-700 ring-sky-100" },
};

const EMPTY_FORM = { product_type: "", division: "", section: "", department: "" };

const ProductMapping = () => {
  const [mappings, setMappings] = useState([]);
  const [groupedData, setGroupedData] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showBulkImport, setShowBulkImport] = useState(false);

  async function fetchMappings() {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/product-mapping/`);
      if (!res.ok) throw new Error("Could not load product mappings");
      const data = await res.json();
      setMappings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load mappings");
    } finally {
      setLoading(false);
    }
  }

  async function fetchGroupedMappings() {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/product-mapping/grouped`);
      const data = await res.json();
      setGroupedData(data.data || {});
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetchMappings();
    fetchGroupedMappings();
  }, []);

  const capitalizeWords = (text) =>
    text
      .split(" ")
      .filter((t) => t.trim() !== "")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formattedForm = {
      product_type: capitalizeWords(form.product_type),
      division: capitalizeWords(form.division),
      section: capitalizeWords(form.section),
      department: capitalizeWords(form.department),
    };

    if (Object.values(formattedForm).some((value) => !value)) {
      toast.error("Complete Product Type, Division, Section, and Department.");
      return;
    }

    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/product-mapping/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save mapping");
      toast.success(data.message || "Mapping saved successfully");

      setForm({ ...EMPTY_FORM, product_type: formattedForm.product_type });
      setEditingId(null);
      fetchMappings();
      fetchGroupedMappings();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error saving mapping");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (m) => {
    setForm({
      product_type: m.product_type,
      division: m.division,
      section: m.section,
      department: m.department,
    });
    setEditingId(m._id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleDelete = (m) => {
    toast((t) => (
      <div className="flex flex-col gap-3 p-1">
        <span className="font-bold text-black">
          Delete <b>{m.product_type} / {m.division} / {m.section} / {m.department}</b>?
        </span>
        <p className="text-xs text-slate-500">This cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => toast.dismiss(t.id)} className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold">Cancel</button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                const res = await authFetch(`${API_BASE_URL}/api/product-mapping/${m._id}`, { method: "DELETE" });
                if (!res.ok) throw new Error("Failed");
                toast.success("Mapping deleted");
                fetchMappings();
                fetchGroupedMappings();
              } catch {
                toast.error("Error deleting mapping");
              }
            }}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white"
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: Infinity, style: { background: "#fff", border: "1px solid #e2e8f0" } });
  };

  const productTypes = Object.keys(groupedData);
  const divisions = form.product_type ? Object.keys(groupedData[form.product_type] || {}) : [];
  const sections =
    form.product_type && form.division
      ? Object.keys(groupedData[form.product_type]?.[form.division] || {})
      : [];
  const departments =
    form.product_type && form.division && form.section
      ? groupedData[form.product_type]?.[form.division]?.[form.section] || []
      : [];

  const filteredMappings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mappings;
    return mappings.filter((m) =>
      [m.product_type, m.division, m.section, m.department].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [mappings, search]);

  const divisionCount = new Set(mappings.map((m) => m.division)).size;

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl space-y-5 p-3 sm:p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-800 p-6 shadow-2xl shadow-indigo-300/40 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-lg shadow-black/20">
              <Layers size={24} className="text-cyan-300" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Catalogue structure</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Product Mappings</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-indigo-100">
                Define the Product Type &rarr; Division &rarr; Section &rarr; Department hierarchy every product is classified under.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">{mappings.length} mapping{mappings.length === 1 ? "" : "s"}</span>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-100">{productTypes.length} product type{productTypes.length === 1 ? "" : "s"}</span>
                <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-bold text-violet-100">{divisionCount} division{divisionCount === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              onClick={() => setShowBulkImport(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300/15 px-4 text-sm font-bold text-white transition hover:bg-cyan-300/25"
            >
              <UploadCloud size={15} /> Bulk import (CSV)
            </button>
            <button
              onClick={() => { fetchMappings(); fetchGroupedMappings(); }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
            >
              <RefreshCcw size={15} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {showBulkImport && (
        <BulkMappingImportModal
          onClose={() => setShowBulkImport(false)}
          onImported={() => { setShowBulkImport(false); fetchMappings(); fetchGroupedMappings(); }}
        />
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-3xl border border-white bg-white/90 shadow-xl shadow-indigo-100/40 backdrop-blur"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100/80 bg-gradient-to-r from-white via-indigo-50/60 to-cyan-50/70 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-100 ring-1 ring-indigo-200/70">
              <Plus size={16} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-black text-slate-900">{editingId ? "Edit mapping" : "Add new mapping"}</h2>
              <p className="text-xs text-slate-500">Pick an existing value or type a new one — new values are saved automatically.</p>
            </div>
          </div>
          {editingId && (
            <button type="button" onClick={handleCancelEdit} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
              <X size={13} /> Cancel edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          <HybridInputSelect
            label="Product Type" value={form.product_type} options={productTypes}
            placeholder="Select or type product type" color="indigo"
            onChange={(val) => setForm({ product_type: val, division: "", section: "", department: "" })}
          />
          <HybridInputSelect
            label="Division" value={form.division} options={divisions}
            placeholder={form.product_type ? "Select or type division" : "Select product type first"} color="purple"
            disabled={!form.product_type}
            onChange={(val) => setForm({ ...form, division: val, section: "", department: "" })}
          />
          <HybridInputSelect
            label="Section" value={form.section} options={sections}
            placeholder={form.division ? "Select or type section" : "Select division first"} color="pink"
            disabled={!form.division}
            onChange={(val) => setForm({ ...form, section: val, department: "" })}
          />
          <HybridInputSelect
            label="Department" value={form.department} options={departments}
            placeholder={form.section ? "Select or type department" : "Select section first"} color="blue"
            disabled={!form.section}
            onChange={(val) => setForm({ ...form, department: val })}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="submit"
            disabled={saving || !form.product_type.trim() || !form.division.trim() || !form.section.trim() || !form.department.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            <Save size={15} />
            {saving ? "Saving…" : editingId ? "Update mapping" : "Add mapping"}
          </button>
        </div>
      </form>

      <MappingTable
        mappings={filteredMappings}
        totalCount={mappings.length}
        loading={loading}
        search={search}
        setSearch={setSearch}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
      />
    </div>
  );
};

const HybridInputSelect = ({ label, value, onChange, options, placeholder, color, disabled }) => {
  const accent = FIELD_ACCENTS[color] || FIELD_ACCENTS.indigo;

  return (
    <div className="relative">
      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
        {label}
      </label>
      <input
        list={`${label}-options`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-4 ${accent.ring} ${
          disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-white hover:border-slate-300"
        }`}
      />
      <datalist id={`${label}-options`}>
        {options.map((opt, i) => (
          <option key={i} value={opt} />
        ))}
      </datalist>
      <p className="mt-1 text-[10px] text-slate-400">Type a new {label.toLowerCase()} to add it.</p>
    </div>
  );
};

const MappingTable = ({ mappings, totalCount, loading, search, setSearch, handleEdit, handleDelete }) => (
  <div className="overflow-hidden rounded-3xl border border-white bg-white/90 shadow-xl shadow-indigo-100/40 backdrop-blur">
    <div className="flex flex-col justify-between gap-3 border-b border-indigo-100/80 bg-gradient-to-r from-white via-indigo-50/60 to-cyan-50/70 px-6 py-5 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 ring-1 ring-violet-200/70">
          <Boxes size={16} className="text-violet-600" />
        </div>
        <div>
          <h3 className="font-black text-slate-900">Current mappings</h3>
          <p className="text-xs text-slate-500">{mappings.length} of {totalCount} shown</p>
        </div>
      </div>
      <div className="relative w-full sm:w-64">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search mappings…"
          className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        />
      </div>
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-[720px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-6 py-4">Product Type</th>
            <th className="px-4 py-4">Division</th>
            <th className="px-4 py-4">Section</th>
            <th className="px-4 py-4">Department</th>
            <th className="px-6 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan={5} className="px-6 py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCcw size={22} className="animate-spin text-indigo-500" />
                  <span className="text-xs font-semibold text-slate-400">Loading mappings…</span>
                </div>
              </td>
            </tr>
          ) : mappings.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <Package size={30} className="text-slate-300" />
                  <p className="font-bold text-slate-700">{totalCount === 0 ? "No mappings yet" : "No mappings match your search"}</p>
                  <p className="text-xs text-slate-400">{totalCount === 0 ? "Add your first mapping above, or bulk import a CSV." : "Try a different search term."}</p>
                </div>
              </td>
            </tr>
          ) : (
            mappings.map((m) => (
              <tr key={m._id} className="transition hover:bg-indigo-50/30">
                <td className="px-6 py-3.5">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${FIELD_ACCENTS.indigo.chip}`}>{m.product_type}</span>
                </td>
                <td className="px-4 py-3.5 text-slate-700">{m.division}</td>
                <td className="px-4 py-3.5 text-slate-700">{m.section}</td>
                <td className="px-4 py-3.5 text-slate-700">{m.department}</td>
                <td className="px-6 py-3.5">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => handleEdit(m)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      <Edit size={13} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(m)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default ProductMapping;
