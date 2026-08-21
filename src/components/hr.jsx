import React, { useCallback, useEffect, useState } from "react";
import { getAdminName, getAdminScope, getStoreId, getStoreName, logoutOrReturnToDepartmentSelector } from "../utils/authRedirect";
import { API_BASE_URL } from "../config/api.js";
import {
  Users, Calendar, DollarSign, Clock, Plane, LogOut, Bell, X, Plus,
  Check, Search, RefreshCw, LogIn, BarChart3, UserPlus, AlertCircle, UploadCloud, Store, Trash2, Pencil,
} from "lucide-react";
import BulkStaffImportModal from "../utils/BulkStaffImportModal.jsx";

function getAdminToken() {
  return (
    localStorage.getItem("admin_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

async function hrFetch(path, options = {}) {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Request failed.");
  return data;
}

const MENU = [
  { id: "dashboard", label: "Overview", icon: BarChart3 },
  { id: "employees", label: "People", icon: Users },
  { id: "floor-staff", label: "Floor Staff", icon: Store },
  { id: "attendance", label: "Attendance", icon: Clock },
  { id: "leaves", label: "Leave Centre", icon: Calendar },
  { id: "salary", label: "Payroll", icon: DollarSign },
  { id: "holidays", label: "Holiday Calendar", icon: Plane },
];

const HR_UI_STYLES = `
  .hr-workspace {
    min-height: 100vh;
    color: #17213a;
    background: radial-gradient(circle at 88% -8%, rgba(45, 212, 191, .16), transparent 32rem), radial-gradient(circle at 38% 0%, rgba(99, 102, 241, .10), transparent 31rem), #f5f7fb;
  }
  .hr-workspace .hr-sidebar { width: 280px; background: linear-gradient(165deg, #111c3a 0%, #142a4b 50%, #0b766f 145%); box-shadow: 14px 0 40px rgba(15, 23, 42, .10); }
  .hr-workspace .hr-brand { border: 1px solid rgba(255,255,255,.13); background: rgba(255,255,255,.065); box-shadow: inset 0 1px 0 rgba(255,255,255,.08); }
  .hr-workspace .hr-nav-item { color: #bfccdf; border: 1px solid transparent; }
  .hr-workspace .hr-nav-item:hover { background: rgba(255,255,255,.075); color: #fff; }
  .hr-workspace .hr-nav-item-active { color: #fff; border-color: rgba(94,234,212,.22); background: linear-gradient(90deg, rgba(20,184,166,.34), rgba(99,102,241,.26)); box-shadow: 0 8px 18px rgba(2,6,23,.18); }
  .hr-workspace .hr-content { min-width: 0; }
  .hr-workspace .hr-header { background: rgba(255,255,255,.86); border-bottom: 1px solid #e5eaf2; backdrop-filter: blur(14px); }
  .hr-workspace .hr-panel { background: rgba(255,255,255,.94); border: 1px solid #e2e8f0; border-radius: 20px; box-shadow: 0 14px 35px rgba(15,23,42,.07); }
  .hr-workspace .hr-panel > div:first-child { border-color: #e7edf5; }
  .hr-workspace input, .hr-workspace select, .hr-workspace textarea { border-color: #d9e2ef; background: #fbfcfe; color: #17213a; box-shadow: 0 1px 2px rgba(15,23,42,.02); }
  .hr-workspace input:focus, .hr-workspace select:focus, .hr-workspace textarea:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
  .hr-workspace table thead { background: #f6f8fc; }
  .hr-workspace table th { color: #66748d; font-size: .68rem; letter-spacing: .07em; }
  .hr-workspace table td { color: #3b4860; }
  .hr-workspace table tbody tr { transition: background .16s ease; }
  .hr-workspace table tbody tr:hover { background: #f8fbff !important; }
  .hr-workspace .hr-stat-card { border: 1px solid #e4eaf2; background: rgba(255,255,255,.92); border-radius: 18px; box-shadow: 0 12px 26px rgba(15,23,42,.055); }
  .hr-workspace .hr-stat-icon { border-radius: 14px; }
  @media (max-width: 900px) { .hr-workspace .hr-sidebar { width: 76px; } .hr-workspace .hr-brand-copy, .hr-workspace .hr-nav-label, .hr-workspace .hr-sidebar-note { display: none; } .hr-workspace .hr-nav-item { justify-content: center; padding-left: 0; padding-right: 0; } .hr-workspace .hr-nav-item svg { margin-right: 0; } }
`;

function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-4">⚠ {message}</div>;
}

/* ── Dashboard ── */
function DashboardView() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    hrFetch("/api/hr/dashboard").then((r) => setStats(r.data)).catch((e) => setError(e.message));
  }, []);

  const cards = [
    { label: "Team members", helper: "Active people in this workspace", value: stats?.total_employees, icon: Users, iconClass: "bg-indigo-50 text-indigo-600", accent: "bg-indigo-500" },
    { label: "Present today", helper: "Checked in or marked present", value: stats?.present_today, icon: Clock, iconClass: "bg-emerald-50 text-emerald-600", accent: "bg-emerald-500" },
    { label: "On leave", helper: "Approved leave for today", value: stats?.on_leave_today, icon: Calendar, iconClass: "bg-amber-50 text-amber-600", accent: "bg-amber-500" },
    { label: "Needs review", helper: "Pending leave requests", value: stats?.pending_leave_requests, icon: Bell, iconClass: "bg-violet-50 text-violet-600", accent: "bg-violet-500" },
  ];

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} />
      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 px-6 py-7 text-white shadow-[0_16px_35px_rgba(15,23,42,.14)] sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-teal-200">Workforce pulse</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold tracking-tight">Your people operations, at a glance.</h3>
            <p className="mt-1 text-sm text-slate-300">Monitor attendance, leave activity and payroll readiness from one workspace.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-teal-100">Live department data</div>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, helper, value, icon: Icon, iconClass, accent }) => (
          <article key={label} className="hr-stat-card relative overflow-hidden p-5">
            <div className={`absolute left-0 top-0 h-1 w-full ${accent}`} />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.1em] text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value ?? "—"}</p>
                <p className="mt-1 text-xs text-slate-500">{helper}</p>
              </div>
              <span className={`hr-stat-icon flex h-11 w-11 items-center justify-center ${iconClass}`}><Icon className="h-5 w-5" /></span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
const INP2 = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition bg-white";
const LBL2 = "block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5";

// Distinct previously-typed values for one store, so Division/Section/Floor
// stay consistent instead of every admin spelling "Menswear" differently.
function orgValuesForStore(list, storeId, key) {
  if (!storeId) return [];
  return [...new Set(
    list
      .filter((e) => e.store_id === storeId && e[key])
      .map((e) => e[key])
  )].sort();
}

/* ── Add Staff modal — store HR (and HQ HR) can create staff without
   needing Admin Management, which store-scoped HR can't reach anyway. ── */
function AddStaffModal({ onClose, onCreated, employees = [] }) {
  const ownScope = getAdminScope();
  const ownStoreId = getStoreId();
  const isStoreScope = ownScope === "store";

  const [deptConfig, setDeptConfig] = useState(null);
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    scope: isStoreScope ? "store" : "hq",
    store_id: isStoreScope ? ownStoreId : "",
    managedDepartments: [],
    division: "", section: "", floor: "", is_department_head: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const divisionOptions = orgValuesForStore(employees, form.store_id, "division");
  const sectionOptions  = orgValuesForStore(employees, form.store_id, "section");
  const floorOptions    = orgValuesForStore(employees, form.store_id, "floor");

  useEffect(() => {
    hrFetch("/hq/departments").then((res) => setDeptConfig(res.data)).catch(() => {});
    if (!isStoreScope) hrFetch("/hq/stores").then((res) => setStores(res.data || [])).catch(() => {});
  }, [isStoreScope]);

  const formScopeIsStore = form.scope === "store";
  const depts = formScopeIsStore ? (deptConfig?.store_departments || []) : (deptConfig?.hq_departments || []);
  const defaultPerms = deptConfig?.store_department_default_permissions || {};

  const toggleDept = (id) => setForm((f) => {
    const has = f.managedDepartments.includes(id);
    return { ...f, managedDepartments: has ? f.managedDepartments.filter((d) => d !== id) : [...f.managedDepartments, id] };
  });

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.managedDepartments.length) {
      setError("Name, email and at least one department are required.");
      return;
    }
    if (formScopeIsStore && !form.store_id) { setError("Select a store."); return; }
    setSaving(true); setError("");
    try {
      const permissions = [...new Set(form.managedDepartments.flatMap((d) => defaultPerms[d] || []))];
      await hrFetch("/hq/admins", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(),
          scope: form.scope, managedDepartments: form.managedDepartments, permissions,
          store_id: formScopeIsStore ? form.store_id : null,
          division: form.division.trim(), section: form.section.trim(), floor: form.floor.trim(),
          is_department_head: form.is_department_head,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message || "Could not create staff.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5" style={{ zIndex: 99999 }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" style={{ maxHeight: "88dvh", overflow: "hidden" }}>
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-400/20 flex items-center justify-center"><UserPlus className="w-5 h-5 text-teal-300" /></div>
            <div>
              <h2 className="text-lg font-bold text-white">Add Staff</h2>
              <p className="text-xs text-slate-400">{isStoreScope ? `For ${getStoreName() || "your store"}` : "Creates an account and sends setup email"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={LBL2}>Full Name *</label>
              <input className={INP2} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Rahul Sharma" />
            </div>
            <div>
              <label className={LBL2}>Email *</label>
              <input type="email" className={INP2} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="staff@company.com" />
            </div>
            <div>
              <label className={LBL2}>Phone</label>
              <input className={INP2} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
            </div>
          </div>

          {!isStoreScope && (
            <div>
              <label className={LBL2}>Store</label>
              <select className={INP2} value={form.store_id} onChange={(e) => setForm((f) => ({ ...f, scope: "store", store_id: e.target.value }))}>
                <option value="">— Select store / branch —</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">Leave blank to create an HQ-level HR staff instead of store staff.</p>
            </div>
          )}

          <div>
            <label className={LBL2}>Departments *</label>
            {!deptConfig ? (
              <div className="text-xs text-slate-400 py-3 text-center">Loading departments…</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {depts.map((deptId) => {
                  const active = form.managedDepartments.includes(deptId);
                  return (
                    <button key={deptId} type="button" onClick={() => toggleDept(deptId)}
                      className={`px-3 py-2 rounded-xl border text-xs font-semibold text-left transition-all flex items-center gap-2 ${active ? "border-teal-400 bg-teal-50 text-teal-700" : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"}`}>
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${active ? "bg-teal-500 border-teal-500" : "border-slate-300"}`}>
                        {active && <Check className="w-3 h-3 text-white" />}
                      </div>
                      {deptId}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {formScopeIsStore && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <p className={LBL2}>Org placement <span className="text-slate-400 font-normal normal-case tracking-normal">— optional</span></p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LBL2}>Division</label>
                  <input className={INP2} list="staff-division-options" value={form.division} onChange={(e) => setForm((f) => ({ ...f, division: e.target.value }))} placeholder="e.g. Menswear" />
                  <datalist id="staff-division-options">{divisionOptions.map((v) => <option key={v} value={v} />)}</datalist>
                </div>
                <div>
                  <label className={LBL2}>Section</label>
                  <input className={INP2} list="staff-section-options" value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} placeholder="e.g. Billing" />
                  <datalist id="staff-section-options">{sectionOptions.map((v) => <option key={v} value={v} />)}</datalist>
                </div>
                <div>
                  <label className={LBL2}>Floor</label>
                  <input className={INP2} list="staff-floor-options" value={form.floor} onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))} placeholder="e.g. Ground Floor" />
                  <datalist id="staff-floor-options">{floorOptions.map((v) => <option key={v} value={v} />)}</datalist>
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.is_department_head} onChange={(e) => setForm((f) => ({ ...f, is_department_head: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-400" />
                <span className="text-sm font-semibold text-slate-700">Make head of {form.managedDepartments[0] || "this department"}</span>
              </label>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3" style={{ flexShrink: 0 }}>
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
            {saving ? "Creating…" : "Create Staff & Send Email"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Employees ── */
function EmployeesView() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ join_date: "", employment_type: "Full-time", notes: "" });
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrFetch("/api/hr/employees");
      setEmployees(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const startEdit = (emp) => {
    setEditing(emp.id);
    setForm({ join_date: emp.join_date || "", employment_type: emp.employment_type || "Full-time", notes: emp.notes || "" });
  };

  const save = async (id) => {
    setSaving(true);
    try {
      await hrFetch(`/api/hr/employees/${id}/profile`, { method: "PATCH", body: JSON.stringify(form) });
      setEditing(null);
      await fetchEmployees();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = employees.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="hr-panel overflow-hidden">
      <ErrorBanner message={error} />
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Employee Directory</h2>
            <p className="text-xs text-slate-400">Pulled from your admin & store staff accounts.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowBulkImport(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-teal-200 bg-teal-50 text-teal-700 rounded-xl text-sm font-bold hover:bg-teal-100 transition">
              <UploadCloud className="w-4 h-4" /> Bulk Import
            </button>
            <button onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl text-sm font-bold hover:opacity-90 transition">
              <UserPlus className="w-4 h-4" /> Add Staff
            </button>
          </div>
        </div>
        {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} onCreated={fetchEmployees} employees={employees} />}
        {showBulkImport && (
          <BulkStaffImportModal
            onClose={() => setShowBulkImport(false)}
            onImported={fetchEmployees}
            lockedStoreId={getAdminScope() === "store" ? getStoreId() : ""}
            postJson={(path, body) => hrFetch(path, { method: "POST", body: JSON.stringify(body) })}
            getToken={getAdminToken}
          />
        )}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Join date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4"><div className="font-medium">{emp.name}</div><div className="text-sm text-gray-500">{emp.email}</div></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {emp.is_department_head && <span className="px-1.5 py-0.5 bg-indigo-600 text-white rounded-full text-[10px] font-bold">★</span>}
                      {emp.department}
                    </div>
                    {(emp.division || emp.section || emp.floor) && (
                      <p className="mt-0.5 text-[11px] text-slate-400">{[emp.division, emp.section, emp.floor].filter(Boolean).join(" · ")}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">{emp.store_name || (emp.scope === "hq" ? "HQ" : "—")}</td>
                  <td className="px-6 py-4">
                    {editing === emp.id ? (
                      <input type="date" value={form.join_date} onChange={(e) => setForm((f) => ({ ...f, join_date: e.target.value }))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm" />
                    ) : (emp.join_date || "—")}
                  </td>
                  <td className="px-6 py-4">
                    {editing === emp.id ? (
                      <select value={form.employment_type} onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm">
                        <option>Full-time</option><option>Part-time</option><option>Contract</option>
                      </select>
                    ) : emp.employment_type}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${emp.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>{emp.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    {editing === emp.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => save(emp.id)} disabled={saving} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold">{saving ? "Saving…" : "Save"}</button>
                        <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-gray-700 text-xs font-bold">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(emp)} className="text-blue-600 hover:text-blue-800 text-xs font-bold">Edit</button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Floor Staff — HR-tracked people with no system login (e.g. salespeople).
   Separate list from Employees: no email, no password, no admin seat. ── */
function FloorStaffModal({ onClose, onSaved, existing, ownStoreId, employees }) {
  const isStoreScope = Boolean(ownStoreId);
  const [form, setForm] = useState({
    name: existing?.name || "", phone: existing?.phone || "", role: existing?.role || "",
    division: existing?.division || "", section: existing?.section || "", floor: existing?.floor || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const divisionOptions = orgValuesForStore(employees, ownStoreId, "division");
  const sectionOptions  = orgValuesForStore(employees, ownStoreId, "section");
  const floorOptions    = orgValuesForStore(employees, ownStoreId, "floor");

  const submit = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    try {
      if (existing) {
        await hrFetch(`/api/hr/floor-staff/${existing.id}`, { method: "PATCH", body: JSON.stringify(form) });
      } else {
        await hrFetch("/api/hr/floor-staff", { method: "POST", body: JSON.stringify({ ...form, store_id: ownStoreId }) });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Could not save this record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5" style={{ zIndex: 99999 }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: "88dvh", overflow: "hidden" }}>
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">{existing ? "Edit Floor Staff" : "Add Floor Staff"}</h2>
            <p className="text-xs text-slate-400">No login required — just an HR record for tracking</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
          {!isStoreScope && !existing && <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Only store HR can add floor staff directly — head office HR can view but not create them here yet.</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={LBL2}>Full Name *</label>
              <input className={INP2} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Priya Sharma" />
            </div>
            <div>
              <label className={LBL2}>Phone</label>
              <input className={INP2} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className={LBL2}>Role</label>
              <input className={INP2} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="e.g. Sales Associate" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LBL2}>Division</label>
              <input className={INP2} list="floor-division-options" value={form.division} onChange={(e) => setForm((f) => ({ ...f, division: e.target.value }))} placeholder="e.g. Menswear" />
              <datalist id="floor-division-options">{divisionOptions.map((v) => <option key={v} value={v} />)}</datalist>
            </div>
            <div>
              <label className={LBL2}>Section</label>
              <input className={INP2} list="floor-section-options" value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} placeholder="e.g. Billing" />
              <datalist id="floor-section-options">{sectionOptions.map((v) => <option key={v} value={v} />)}</datalist>
            </div>
            <div>
              <label className={LBL2}>Floor</label>
              <input className={INP2} list="floor-floor-options" value={form.floor} onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))} placeholder="e.g. Ground Floor" />
              <datalist id="floor-floor-options">{floorOptions.map((v) => <option key={v} value={v} />)}</datalist>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3" style={{ flexShrink: 0 }}>
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button onClick={submit} disabled={saving || (!isStoreScope && !existing)} className="flex-1 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
            {saving ? "Saving…" : existing ? "Save Changes" : "Add Floor Staff"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FloorStaffView() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [modalFor, setModalFor] = useState(null); // null | "new" | staff object
  const [confirmDelete, setConfirmDelete] = useState(null);
  const ownStoreId = getAdminScope() === "store" ? getStoreId() : "";

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrFetch("/api/hr/floor-staff");
      setStaff(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const doDelete = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    try {
      await hrFetch(`/api/hr/floor-staff/${target.id}`, { method: "DELETE" });
      await fetchStaff();
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = staff.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || (s.role || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="hr-panel overflow-hidden">
      <ErrorBanner message={error} />
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Floor Staff</h2>
            <p className="text-xs text-slate-400">Salespeople and other floor staff — tracked here, no system login needed.</p>
          </div>
          <button onClick={() => setModalFor("new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl text-sm font-bold hover:opacity-90 transition shrink-0">
            <UserPlus className="w-4 h-4" /> Add Floor Staff
          </button>
        </div>
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search floor staff…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Placement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4"><div className="font-medium">{s.name}</div><div className="text-sm text-gray-500">{s.phone || "—"}</div></td>
                  <td className="px-6 py-4">{s.role || "—"}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{[s.division, s.section, s.floor].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-6 py-4">{s.store_name || "—"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${s.status === "Active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>{s.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-3">
                      <button onClick={() => setModalFor(s)} className="text-blue-600 hover:text-blue-800" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setConfirmDelete(s)} className="text-rose-500 hover:text-rose-700" title="Remove"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">No floor staff yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {modalFor && (
        <FloorStaffModal
          onClose={() => setModalFor(null)}
          onSaved={fetchStaff}
          existing={modalFor === "new" ? null : modalFor}
          ownStoreId={ownStoreId || (modalFor !== "new" ? modalFor.store_id : "")}
          employees={staff}
        />
      )}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-black text-slate-900 mb-2">Remove {confirmDelete.name}?</h3>
            <p className="text-xs text-red-500 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={doDelete} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-bold text-white transition">Yes, Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Attendance ── */
function AttendanceView() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selfState, setSelfState] = useState(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrFetch(`/api/hr/attendance?date=${date}`);
      setRecords(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const doCheckIn = async () => {
    try {
      await hrFetch("/api/hr/attendance/checkin", { method: "POST" });
      setSelfState("Checked in.");
      fetchRecords();
    } catch (err) { setError(err.message); }
  };
  const doCheckOut = async () => {
    try {
      const res = await hrFetch("/api/hr/attendance/checkout", { method: "POST" });
      setSelfState(`Checked out — ${res.hours}h logged.`);
      fetchRecords();
    } catch (err) { setError(err.message); }
  };

  const mark = async (admin_id, status) => {
    try {
      await hrFetch("/api/hr/attendance/manual", { method: "POST", body: JSON.stringify({ admin_id, date, status }) });
      fetchRecords();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="hr-panel overflow-hidden">
      <ErrorBanner message={error} />
      <div className="p-6 border-b flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">Attendance</h2>
        <div className="flex items-center gap-3">
          <button onClick={doCheckIn} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold"><LogIn className="w-4 h-4" /> Check in</button>
          <button onClick={doCheckOut} className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-xs font-bold"><LogOut className="w-4 h-4" /> Check out</button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      {selfState && <p className="px-6 pt-3 text-xs font-semibold text-emerald-600">{selfState}</p>}
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check in</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{r.employee_name}</td>
                  <td className="px-6 py-4">{r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}</td>
                  <td className="px-6 py-4">{r.check_out ? new Date(r.check_out).toLocaleTimeString() : "—"}</td>
                  <td className="px-6 py-4">{r.hours ? `${r.hours}h` : "—"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      r.status === "Present" ? "bg-green-100 text-green-800" :
                      r.status === "Late" ? "bg-yellow-100 text-yellow-800" :
                      r.status === "Absent" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    <select onChange={(e) => e.target.value && mark(r.admin_id, e.target.value)} defaultValue="" className="border border-gray-300 rounded px-2 py-1 text-xs">
                      <option value="">Set…</option>
                      <option value="Present">Present</option>
                      <option value="Late">Late</option>
                      <option value="Absent">Absent</option>
                      <option value="On Leave">On Leave</option>
                    </select>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">No attendance recorded for this date yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Leaves ── */
function LeavesView() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRequest, setShowRequest] = useState(false);
  const [form, setForm] = useState({ leave_type: "Sick Leave", start_date: "", end_date: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrFetch("/api/hr/leaves");
      setLeaves(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  const submitRequest = async () => {
    if (!form.start_date || !form.end_date) { setError("Start and end date are required."); return; }
    setSaving(true);
    try {
      await hrFetch("/api/hr/leaves", { method: "POST", body: JSON.stringify(form) });
      setShowRequest(false);
      setForm({ leave_type: "Sick Leave", start_date: "", end_date: "", reason: "" });
      await fetchLeaves();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const review = async (id, action) => {
    try {
      await hrFetch(`/api/hr/leaves/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
      fetchLeaves();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="hr-panel overflow-hidden">
      <ErrorBanner message={error} />
      <div className="p-6 border-b flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Leave Requests</h2>
        <button onClick={() => setShowRequest(true)} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2 text-sm font-bold">
          <Plus className="w-4 h-4" /><span>Request Leave</span>
        </button>
      </div>

      {showRequest && (
        <div className="p-6 border-b bg-slate-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.leave_type} onChange={(e) => setForm((f) => ({ ...f, leave_type: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {["Sick Leave", "Vacation", "Personal Leave", "Maternity Leave", "Paternity Leave", "Unpaid Leave"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} className="border border-gray-300 rounded-lg px-2 py-2 text-sm" />
              <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className="border border-gray-300 rounded-lg px-2 py-2 text-sm" />
            </div>
          </div>
          <textarea placeholder="Reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={submitRequest} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-60">{saving ? "Submitting…" : "Submit"}</button>
            <button onClick={() => setShowRequest(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-bold">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leaves.map((l) => (
                <tr key={l._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{l.employee_name}</td>
                  <td className="px-6 py-4">{l.leave_type}</td>
                  <td className="px-6 py-4">{l.start_date} → {l.end_date}</td>
                  <td className="px-6 py-4">{l.days}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      l.status === "Approved" ? "bg-green-100 text-green-800" :
                      l.status === "Rejected" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                    }`}>{l.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    {l.status === "Pending" && (
                      <div className="flex gap-2">
                        <button onClick={() => review(l._id, "approve")} className="text-emerald-600 hover:text-emerald-800"><Check className="w-4 h-4" /></button>
                        <button onClick={() => review(l._id, "reject")} className="text-rose-600 hover:text-rose-800"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {leaves.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">No leave requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Salary ── */
function SalaryView() {
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ admin_id: "", month: new Date().toISOString().slice(0, 7), basic_salary: "", allowances: "", deductions: "" });
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, salRes] = await Promise.all([hrFetch("/api/hr/employees"), hrFetch("/api/hr/salary")]);
      setEmployees(empRes.data || []);
      setRecords(salRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async () => {
    if (!form.admin_id || !form.month) { setError("Employee and month are required."); return; }
    setSaving(true);
    try {
      await hrFetch("/api/hr/salary", {
        method: "POST",
        body: JSON.stringify({
          admin_id: form.admin_id, month: form.month,
          basic_salary: Number(form.basic_salary) || 0,
          allowances: Number(form.allowances) || 0,
          deductions: Number(form.deductions) || 0,
        }),
      });
      setForm((f) => ({ ...f, basic_salary: "", allowances: "", deductions: "" }));
      await fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hr-panel overflow-hidden">
      <ErrorBanner message={error} />
      <div className="p-6 border-b space-y-3">
        <h2 className="text-2xl font-semibold">Salary Records</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select value={form.admin_id} onChange={(e) => setForm((f) => ({ ...f, admin_id: e.target.value }))} className="border border-gray-300 rounded-lg px-2 py-2 text-sm col-span-2">
            <option value="">Select employee</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input type="month" value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))} className="border border-gray-300 rounded-lg px-2 py-2 text-sm" />
          <input type="number" placeholder="Basic" value={form.basic_salary} onChange={(e) => setForm((f) => ({ ...f, basic_salary: e.target.value }))} className="border border-gray-300 rounded-lg px-2 py-2 text-sm" />
          <input type="number" placeholder="Allowances" value={form.allowances} onChange={(e) => setForm((f) => ({ ...f, allowances: e.target.value }))} className="border border-gray-300 rounded-lg px-2 py-2 text-sm" />
        </div>
        <div className="flex gap-2 items-center">
          <input type="number" placeholder="Deductions" value={form.deductions} onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value }))} className="border border-gray-300 rounded-lg px-2 py-2 text-sm w-40" />
          <button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-60">{saving ? "Saving…" : "Save record"}</button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Basic</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allowances</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deductions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{r.employee_name}</td>
                  <td className="px-6 py-4">{r.month}</td>
                  <td className="px-6 py-4">₹{r.basic_salary?.toLocaleString("en-IN")}</td>
                  <td className="px-6 py-4 text-green-600">₹{r.allowances?.toLocaleString("en-IN")}</td>
                  <td className="px-6 py-4 text-red-600">₹{r.deductions?.toLocaleString("en-IN")}</td>
                  <td className="px-6 py-4 font-semibold">₹{r.net_salary?.toLocaleString("en-IN")}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">No salary records yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Holidays ── */
function HolidaysView({ canManageHolidays }) {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", type: "Company Holiday", description: "" });

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrFetch("/api/hr/holidays");
      setHolidays(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

  const add = async () => {
    if (!form.name || !form.date) { setError("Name and date are required."); return; }
    try {
      await hrFetch("/api/hr/holidays", { method: "POST", body: JSON.stringify(form) });
      setShowAdd(false);
      setForm({ name: "", date: "", type: "Company Holiday", description: "" });
      await fetchHolidays();
    } catch (err) { setError(err.message); }
  };

  const remove = async (id) => {
    try {
      await hrFetch(`/api/hr/holidays/${id}`, { method: "DELETE" });
      fetchHolidays();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} />
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Holiday Calendar</h2>
        {canManageHolidays ? (
          <button onClick={() => setShowAdd(true)} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2 text-sm font-bold">
            <Plus className="w-4 h-4" /><span>Add Holiday</span>
          </button>
        ) : <p className="text-sm text-slate-500">Company holidays are managed by HQ HR.</p>}
      </div>
      {showAdd && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Holiday name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full">
            {["Federal Holiday", "National Holiday", "Company Holiday", "Optional Holiday"].map((t) => <option key={t}>{t}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={add} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold">Save</button>
            <button onClick={() => setShowAdd(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-bold">Cancel</button>
          </div>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {holidays.map((h) => (
            <div key={h._id} className="bg-white border rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-full"><Plane className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <h3 className="font-semibold">{h.name}</h3>
                  <p className="text-sm text-gray-600">{h.date}</p>
                  <p className="text-xs text-gray-500">{h.type}</p>
                </div>
              </div>
              {canManageHolidays && <button onClick={() => remove(h._id)} className="text-rose-500 hover:text-rose-700"><X className="w-4 h-4" /></button>}
            </div>
          ))}
          {holidays.length === 0 && <p className="text-sm text-gray-400 col-span-full text-center py-8">No holidays added yet.</p>}
        </div>
      )}
    </div>
  );
}

export default function HR() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const canManageHolidays = getAdminScope() === "hq";
  const isStoreWorkspace = !canManageHolidays;
  const workspaceName = isStoreWorkspace ? (getStoreName() || "Store workspace") : "Head office workspace";
  const adminName = getAdminName() || "HR Administrator";
  const activeLabel = MENU.find((item) => item.id === activeSection)?.label || "Overview";
  const handleLogout = () => logoutOrReturnToDepartmentSelector();

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard": return <DashboardView />;
      case "employees": return <EmployeesView />;
      case "floor-staff": return <FloorStaffView />;
      case "attendance": return <AttendanceView />;
      case "leaves": return <LeavesView />;
      case "salary": return <SalaryView />;
      case "holidays": return <HolidaysView canManageHolidays={canManageHolidays} />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="hr-workspace flex">
      <style>{HR_UI_STYLES}</style>
      <aside className="hr-sidebar sticky top-0 flex h-screen shrink-0 flex-col p-4 text-white">
        <div className="hr-brand rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-300 to-cyan-500 text-lg font-black text-slate-950 shadow-lg shadow-teal-950/20">HR</div>
            <div className="hr-brand-copy min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-teal-200">RMS workforce</p>
              <h1 className="truncate text-lg font-bold">People Operations</h1>
            </div>
          </div>
          <div className="hr-sidebar-note mt-4 rounded-xl border border-white/10 bg-slate-950/20 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-300">Signed in as</p>
            <p className="mt-1 truncate text-sm font-semibold">{adminName}</p>
            <p className="mt-0.5 truncate text-xs text-teal-100/75">{workspaceName}</p>
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-1.5 overflow-y-auto pr-1">
          <p className="hr-sidebar-note px-3 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</p>
          {MENU.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`hr-nav-item flex w-full items-center rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition-all ${activeSection === id ? "hr-nav-item-active" : ""}`}
            >
              <Icon className="mr-3 h-[18px] w-[18px] shrink-0" />
              <span className="hr-nav-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-4 border-t border-white/10 pt-4">
          <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-slate-100 transition hover:bg-rose-500/20 hover:text-white">
            <LogOut className="h-4 w-4" /> <span className="hr-nav-label">Log out</span>
          </button>
        </div>
      </aside>

      <main className="hr-content min-h-screen flex-1">
        <header className="hr-header sticky top-0 z-10 flex min-h-[92px] items-center justify-between gap-5 px-6 py-4 lg:px-9">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-teal-700">
              <span>Human resources</span><span className="h-1 w-1 rounded-full bg-teal-500" /><span>{isStoreWorkspace ? "Store scoped" : "HQ oversight"}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">{activeLabel}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{isStoreWorkspace ? `People operations for ${workspaceName}.` : "Manage people, attendance, leave and payroll across your organisation."}</p>
          </div>
          <div className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-right shadow-sm sm:block">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">Access level</p>
            <p className="mt-0.5 text-sm font-bold text-slate-700">{isStoreWorkspace ? "Store HR" : "HQ HR"}</p>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1540px] p-5 sm:p-7 lg:p-9">{renderContent()}</div>
      </main>
    </div>
  );
}