import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


import React, { useEffect, useState } from "react";
import { Plus, Trash2, Edit, Save, RefreshCcw, Package } from "lucide-react";

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

const ProductMapping = () => {
  const [mappings, setMappings] = useState([]);
  const [groupedData, setGroupedData] = useState({});
  const [form, setForm] = useState({
    product_type: "",
    division: "",
    section: "",
    department: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  // ---------------- Fetch Flat & Grouped Mappings ----------------
  async function fetchMappings() {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/product-mapping/`);
      const data = await res.json();
      setMappings(data);
    } catch (err) {
      console.error(err);
      alert("Failed to load mappings");
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

  // ---------------- Utility: Auto-Capitalize ----------------
  const capitalizeWords = (text) =>
    text
      .split(" ")
      .filter((t) => t.trim() !== "")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

  // ---------------- Handle Submit ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    const formattedForm = {
      product_type: capitalizeWords(form.product_type),
      division: capitalizeWords(form.division),
      section: capitalizeWords(form.section),
      department: capitalizeWords(form.department),
    };

    if (Object.values(formattedForm).some((value) => !value)) {
      alert("Please complete Product Type, Division, Section, and Department.");
      return;
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/api/product-mapping/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save mapping");
      alert(data.message || "Mapping saved successfully");

      // ✅ Keep same product_type, clear only lower fields
      setForm({
        product_type: formattedForm.product_type,
        division: "",
        section: "",
        department: "",
      });

      setEditingId(null);
      fetchMappings();
      fetchGroupedMappings();
    } catch (err) {
      console.error(err);
      alert(err.message || "Error saving mapping");
    }
  };

  // ---------------- Handle Edit ----------------
  const handleEdit = (m) => {
    setForm({
      product_type: m.product_type,
      division: m.division,
      section: m.section,
      department: m.department,
    });
    setEditingId(m._id);
  };

  // ---------------- Handle Delete ----------------
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this mapping?")) return;
    try {
      await authFetch(`${API_BASE_URL}/api/product-mapping/${id}`, { method: "DELETE" });
      fetchMappings();
      fetchGroupedMappings();
    } catch (err) {
      alert("Error deleting mapping");
    }
  };

  // ---------------- Dropdown Logic ----------------
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-3 p-3 sm:p-4">
      {/* Header Section */}
      <div className="">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 ring-1 ring-inset ring-indigo-100">
              <Package size={17} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                Product Type Mappings
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">Define the product type, division, section and department hierarchy</p>
            </div>
          </div>
          <button
            onClick={() => {
              fetchMappings();
              fetchGroupedMappings();
            }}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Form Section */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-indigo-50">
            <Plus size={14} className="text-indigo-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">
            {editingId ? "Edit Mapping" : "Add New Mapping"}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 px-4 pt-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Product Type */}
          <HybridInputSelect
            label="Product Type"
            value={form.product_type}
            options={productTypes}
            placeholder="Select or Type Product Type"
            color="indigo"
            onChange={(val) =>
              setForm({
                product_type: val,
                division: "",
                section: "",
                department: "",
              })
            }
          />

          {/* Division */}
          <HybridInputSelect
            label="Division"
            value={form.division}
            options={divisions}
            placeholder={
              form.product_type ? "Select or Type Division" : "Select Product Type First"
            }
            color="purple"
            disabled={!form.product_type}
            onChange={(val) =>
              setForm({
                ...form,
                division: val,
                section: "",
                department: "",
              })
            }
          />

          {/* Section */}
          <HybridInputSelect
            label="Section"
            value={form.section}
            options={sections}
            placeholder={
              form.division ? "Select or Type Section" : "Select Division First"
            }
            color="pink"
            disabled={!form.division}
            onChange={(val) =>
              setForm({
                ...form,
                section: val,
                department: "",
              })
            }
          />

          {/* Department */}
          <HybridInputSelect
            label="Department"
            value={form.department}
            options={departments}
            placeholder={
              form.section ? "Select or Type Department" : "Select Section First"
            }
            color="blue"
            disabled={!form.section}
            onChange={(val) => setForm({ ...form, department: val })}
          />
        </div>

        <button
          type="submit"
          disabled={!form.product_type.trim() || !form.division.trim() || !form.section.trim() || !form.department.trim()}
          className="mx-4 mb-4 mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          <Save size={14} />
          {editingId ? "Update Mapping" : "Add Mapping"}
        </button>
      </form>

      <MappingTable
        mappings={mappings}
        loading={loading}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
      />
    </div>
  );
};

// ---------------- Hybrid Input + Dropdown Component ----------------
const HybridInputSelect = ({ label, value, onChange, options, placeholder, color, disabled }) => {
  const colorClasses = {
    indigo: "focus:ring-indigo-200 focus:border-indigo-400 border-slate-200",
    purple: "focus:ring-indigo-200 focus:border-indigo-400 border-slate-200",
    pink: "focus:ring-indigo-200 focus:border-indigo-400 border-slate-200",
    blue: "focus:ring-indigo-200 focus:border-indigo-400 border-slate-200",
  };

  return (
    <div className="relative">
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <input
        list={`${label}-options`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-9 w-full rounded-lg border px-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-2 ${
          colorClasses[color]
        } ${disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-white"}`}
      />
      <datalist id={`${label}-options`}>
        {options.map((opt, i) => (
          <option key={i} value={opt} />
        ))}
      </datalist>
      <p className="mt-1 text-[10px] text-slate-400">
        You can type a new {label.toLowerCase()} to add it.
      </p>
    </div>
  );
};

// ---------------- Table Component ----------------
const MappingTable = ({ mappings, loading, handleEdit, handleDelete }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Package size={16} className="text-indigo-600" />
        Current Mappings ({mappings.length})
      </h3>
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="bg-slate-50/80">
          <tr>
            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Product Type
            </th>
            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Division
            </th>
            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Section
            </th>
            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Department
            </th>
            <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {loading ? (
            <tr>
              <td colSpan={5} className="py-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCcw size={22} className="animate-spin text-indigo-500" />
                  <span className="text-xs font-medium text-slate-500">Loading mappings...</span>
                </div>
              </td>
            </tr>
          ) : mappings.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <Package size={30} className="text-slate-300" />
                  <span className="text-xs font-medium text-slate-500">
                    No mappings found. Add your first mapping above!
                  </span>
                </div>
              </td>
            </tr>
          ) : (
            mappings.map((m) => (
              <tr
                key={m._id}
                className="transition-colors hover:bg-indigo-50/40"

              >
                <td className="px-4 py-2.5 text-[13px] font-semibold text-slate-800">{m.product_type}</td>
                <td className="px-4 py-2.5 text-[13px] text-slate-600">{m.division}</td>
                <td className="px-4 py-2.5 text-[13px] text-slate-600">{m.section}</td>
                <td className="px-4 py-2.5 text-[13px] text-slate-600">{m.department}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => handleEdit(m)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      <Edit size={13} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(m._id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
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
