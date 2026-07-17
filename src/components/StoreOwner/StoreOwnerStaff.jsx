import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/api.js";

const ROLES = {
  Inventory: {
    description: "Store stock, GRC and GRN receiving.",
    permissions: ["store_stock", "stock_ledger", "stock_adjustment", "grc", "grn"],
  },
  Cashier: {
    description: "POS, returns and sales for this store.",
    permissions: ["cashier", "sales"],
  },
};

const emptyForm = { name: "", email: "", phone: "", role: "Inventory" };

export default function StoreOwnerStaff() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const storeId = localStorage.getItem("admin_store_id") || "";

  const request = useCallback(async (path, options = {}) => {
    const token = localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Request failed");
    return data;
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      const data = await request("/hq/admins");
      setStaff((data.data || []).filter((person) => person.scope === "store"));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const selectedRole = useMemo(() => ROLES[form.role], [form.role]);
  const addStaff = async (event) => {
    event.preventDefault();
    if (!storeId) { setMessage("Your primary store is not available. Please sign in again."); return; }
    try {
      setSaving(true); setMessage("");
      await request("/hq/admins", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(),
          scope: "store", store_id: storeId, managedDepartments: [form.role],
          permissions: selectedRole.permissions,
        }),
      });
      setForm(emptyForm);
      setMessage("Staff account created. A password setup email was sent.");
      loadStaff();
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (person) => {
    try {
      const next = person.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
      await request(`/hq/admins/${person.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      loadStaff();
    } catch (error) { setMessage(error.message); }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-7">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <button onClick={() => navigate("/dashboard/store-owner")} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></button>
          <div><h1 className="flex items-center gap-2 text-xl font-black"><UsersRound className="h-5 w-5 text-violet-600" /> Store Staff</h1><p className="mt-1 text-sm text-slate-500">Create only Inventory or Cashier accounts for your primary store.</p></div>
        </header>

        <form onSubmit={addStaff} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Plus className="h-5 w-5 text-violet-600" /><h2 className="font-black">Add staff member</h2></div>
          <div className="grid gap-3 md:grid-cols-2">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone (optional)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold">
              {Object.keys(ROLES).map((role) => <option key={role}>{role}</option>)}
            </select>
          </div>
          <p className="mt-3 text-xs text-slate-500"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />{selectedRole.description}</p>
          <button disabled={saving || !storeId} className="mt-4 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">{saving ? "Creating…" : "Create staff account"}</button>
          {message && <p className="mt-3 text-sm font-medium text-slate-600">{message}</p>}
        </form>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black">Your store staff</h2></div>
          {loading ? <p className="p-6 text-sm text-slate-500">Loading staff…</p> : staff.length === 0 ? <p className="p-6 text-sm text-slate-500">No staff accounts yet.</p> : <div className="divide-y divide-slate-100">
            {staff.map((person) => <div key={person.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><UserRound className="h-5 w-5" /></div>
              <div className="min-w-[180px] flex-1"><p className="font-bold">{person.name}</p><p className="text-xs text-slate-500">{person.email} · {person.department}</p></div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${person.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{person.status}</span>
              <button onClick={() => toggleStatus(person)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">{person.status === "ACTIVE" ? "Suspend" : "Activate"}</button>
            </div>)}
          </div>}
        </section>
      </div>
    </main>
  );
}
