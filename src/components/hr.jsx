import React, { useCallback, useEffect, useState } from "react";
import { logoutOrReturnToDepartmentSelector } from "../utils/authRedirect";
import { API_BASE_URL } from "../config/api.js";
import {
  Users, Calendar, DollarSign, Clock, Plane, LogOut, Bell, X, Plus,
  Check, Search, RefreshCw, LogIn, BarChart3,
} from "lucide-react";

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
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "employees", label: "Employees", icon: Users },
  { id: "attendance", label: "Attendance", icon: Clock },
  { id: "leaves", label: "Leaves", icon: Calendar },
  { id: "salary", label: "Salary", icon: DollarSign },
  { id: "holidays", label: "Holidays", icon: Plane },
];

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

  const CARDS = stats ? [
    { label: "Total Employees", value: stats.total_employees, icon: Users, color: "bg-blue-500" },
    { label: "Present Today", value: stats.present_today, icon: Clock, color: "bg-green-500" },
    { label: "On Leave Today", value: stats.on_leave_today, icon: Calendar, color: "bg-orange-500" },
    { label: "Pending Leave Requests", value: stats.pending_leave_requests, icon: Bell, color: "bg-purple-500" },
  ] : [];

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {CARDS.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`${color} text-white p-6 rounded-lg shadow-lg`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold opacity-90">{label}</h3>
                <p className="text-3xl font-bold">{value ?? "—"}</p>
              </div>
              <Icon className="w-10 h-10 opacity-80" />
            </div>
          </div>
        ))}
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
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <ErrorBanner message={error} />
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Employee Directory</h2>
          <p className="text-xs text-slate-400">Pulled from your admin & store staff accounts — add or remove staff via Admin Management.</p>
        </div>
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
                  <td className="px-6 py-4">{emp.department}</td>
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
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
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
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
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
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
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
function HolidaysView() {
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
        <button onClick={() => setShowAdd(true)} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2 text-sm font-bold">
          <Plus className="w-4 h-4" /><span>Add Holiday</span>
        </button>
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
              <button onClick={() => remove(h._id)} className="text-rose-500 hover:text-rose-700"><X className="w-4 h-4" /></button>
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
  const handleLogout = () => logoutOrReturnToDepartmentSelector();

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard": return <DashboardView />;
      case "employees": return <EmployeesView />;
      case "attendance": return <AttendanceView />;
      case "leaves": return <LeavesView />;
      case "salary": return <SalaryView />;
      case "holidays": return <HolidaysView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-sky-600 text-white flex flex-col">
        <div className="p-6 text-center"><h1 className="text-xl font-bold">HR</h1></div>
        <nav className="flex-1">
          {MENU.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveSection(id)}
              className={`w-full flex items-center px-6 py-3 text-left hover:bg-sky-700 transition-colors ${activeSection === id ? "bg-sky-700 border-r-4 border-white" : ""}`}>
              <Icon className="w-5 h-5 mr-3" />{label}
            </button>
          ))}
        </nav>
        <div className="p-4">
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-bold bg-sky-700 hover:bg-sky-800">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900">HR Management</h2>
          <p className="text-sm text-gray-600">Your tenant's real employee, attendance, leave and payroll data.</p>
        </header>
        <div className="p-8">{renderContent()}</div>
      </div>
    </div>
  );
}
