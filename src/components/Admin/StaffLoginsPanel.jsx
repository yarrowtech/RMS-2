import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X, UserPlus, Trash2, Lock, Unlock, KeyRound, Users2, Store as StoreIcon,
  ShoppingCart, Package, Truck, ClipboardList, FileBox, ArrowLeftRight,
  FileText, Contact, Wallet, UsersRound, BarChart3, Check, Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

const API = APP_API_URL;

const api = async (path, opts = {}) => {
  const token = localStorage.getItem("admin_token") || "";
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Request failed");
  return data;
};

// Same permission ids used by the Add Admin form (Hqadminmanagement.jsx) --
// a staff login is just a narrower, store-locked version of the same
// permission taxonomy, grouped the same way, so the tabs an HQ/department
// admin can tick here line up with what a full admin account would have.
const PERMISSION_GROUPS = [
  {
    label: "Store Floor",
    tone: "emerald",
    items: [
      { id: "cashier", label: "Cashier / POS", icon: ShoppingCart },
      { id: "store_stock", label: "Store Stock", icon: Package },
      { id: "sales", label: "Sales Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Operations",
    tone: "indigo",
    items: [
      { id: "inventory", label: "Inventory", icon: FileBox },
      { id: "grn", label: "GRN / Receiving", icon: ClipboardList },
      { id: "grc", label: "GRC", icon: FileText },
      { id: "stock_transfer", label: "Stock Transfer", icon: ArrowLeftRight },
      { id: "purchase_orders", label: "Purchase Orders", icon: Truck },
      { id: "vendors", label: "Vendors", icon: Contact },
    ],
  },
  {
    label: "Admin",
    tone: "amber",
    items: [
      { id: "finance", label: "Finance", icon: Wallet },
      { id: "hr", label: "HR", icon: UsersRound },
      { id: "reports", label: "Reports", icon: BarChart3 },
    ],
  },
];
const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items);

const TONE = {
  emerald: { ring: "ring-emerald-500", bg: "bg-emerald-600", text: "text-emerald-700", soft: "bg-emerald-50", border: "border-emerald-200" },
  indigo: { ring: "ring-indigo-500", bg: "bg-indigo-600", text: "text-indigo-700", soft: "bg-indigo-50", border: "border-indigo-200" },
  amber: { ring: "ring-amber-500", bg: "bg-amber-600", text: "text-amber-700", soft: "bg-amber-50", border: "border-amber-200" },
};

const AVATAR_COLORS = ["bg-emerald-500", "bg-indigo-500", "bg-amber-500", "bg-rose-500", "bg-sky-500", "bg-violet-500"];
const avatarColor = (seed) => AVATAR_COLORS[Math.abs([...seed].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];
const initials = (name) => (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

const INP = "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition bg-white";
const LBL = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";

const EMPTY_FORM = { name: "", username: "", password: "", store_id: "", department: "", permissions: [] };

// `fixedStoreId`/`fixedStoreName` are set when a store/department admin
// (not HQ) is creating one of these for their own store -- the store
// picker is hidden since it's implicit, and the backend independently
// rejects any store_id other than the creator's own regardless.
function AddStaffModal({ stores, fixedStoreId, fixedStoreName, allowedPermissions, onClose, onCreated }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, store_id: fixedStoreId || "" }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const visibleGroups = useMemo(() => {
    if (!allowedPermissions) return PERMISSION_GROUPS;
    return PERMISSION_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((p) => allowedPermissions.includes(p.id)) }))
      .filter((g) => g.items.length);
  }, [allowedPermissions]);

  const togglePerm = (id) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(id) ? f.permissions.filter((p) => p !== id) : [...f.permissions, id],
    }));
  };

  const handleSave = async () => {
    setError("");
    if (!form.name.trim() || !form.username.trim() || !form.password || !form.store_id) {
      setError("Name, username, password, and store are all required.");
      return;
    }
    setSaving(true);
    try {
      await api("/staff-users", { method: "POST", body: JSON.stringify(form) });
      toast.success(`Staff login "${form.username}" created`);
      onCreated();
      onClose();
    } catch (e) {
      setError(e.message || "Could not create staff login");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeInUp_.18s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-6 py-5 border-b border-slate-100 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 rounded-t-3xl overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-10 -left-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">New Staff Login</h2>
                <p className="text-[11px] text-emerald-100/90">Username + password — no email required</p>
              </div>
            </div>
            <button onClick={onClose} className="text-emerald-100 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className={LBL}>Name</label>
            <input className={INP} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Priya (Counter 2)" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Username</label>
              <input className={INP} value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "") }))} placeholder="priya.store2" />
            </div>
            <div>
              <label className={LBL}>Password</label>
              <input className={INP} type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Set a password" />
            </div>
          </div>

          {fixedStoreId ? (
            <div>
              <label className={LBL}>Store</label>
              <div className={`${INP} flex items-center gap-2 bg-slate-50 text-slate-600 font-semibold`}>
                <StoreIcon className="w-4 h-4 text-slate-400" /> {fixedStoreName || fixedStoreId}
              </div>
            </div>
          ) : (
            <div>
              <label className={LBL}>Store</label>
              <select className={INP} value={form.store_id} onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))}>
                <option value="">Select a store…</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>
                ))}
              </select>
              {stores.length === 0 && (
                <p className="mt-1.5 text-[11px] text-amber-600 font-medium">No stores found for this tenant yet — create a store first under Stores & Admins.</p>
              )}
            </div>
          )}

          <div>
            <label className={LBL}>Department (optional label)</label>
            <input className={INP} value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder="e.g. Cashier" />
          </div>

          <div>
            <label className={LBL}>Tabs this login can use</label>
            <div className="space-y-3 mt-1.5">
              {visibleGroups.map((g) => {
                const t = TONE[g.tone];
                return (
                  <div key={g.label}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${t.text} mb-1.5`}>{g.label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {g.items.map((p) => {
                        const Icon = p.icon;
                        const active = form.permissions.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => togglePerm(p.id)}
                            className={`relative flex items-center gap-2 text-left px-3 py-2.5 rounded-xl text-xs font-semibold border transition ${
                              active
                                ? `${t.bg} text-white border-transparent shadow-sm`
                                : `bg-white ${t.text} ${t.border} hover:${t.soft}`
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-white" : ""}`} />
                            <span className="truncate">{p.label}</span>
                            {active && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {visibleGroups.length === 0 && (
                <p className="text-xs text-slate-400 italic">You don't hold any grantable permissions yourself yet — ask HQ to assign some to your account first.</p>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-100 bg-slate-50/60 rounded-b-3xl">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-emerald-600/20 transition disabled:opacity-60"
          >
            {saving ? "Creating…" : (<><Sparkles className="w-4 h-4" /> Create Login</>)}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function StaffLoginsPanel({ stores = [], fixedStoreId, fixedStoreName, allowedPermissions, onClose }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/staff-users");
      setStaff(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message || "Failed to load staff logins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleToggleStatus = async (s) => {
    const next = s.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await api(`/staff-users/${s.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      toast.success(`${s.username} ${next === "ACTIVE" ? "reactivated" : "suspended"}`);
      fetchStaff();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete the staff login "${s.username}"? This cannot be undone.`)) return;
    try {
      await api(`/staff-users/${s.id}`, { method: "DELETE" });
      toast.success("Staff login deleted");
      fetchStaff();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      toast.error("Password must be at least 4 characters.");
      return;
    }
    try {
      await api(`/staff-users/${resetTarget.id}/reset-password`, { method: "POST", body: JSON.stringify({ password: newPassword }) });
      toast.success(`Password reset for ${resetTarget.username}`);
      setResetTarget(null);
      setNewPassword("");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[180] bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(10px);} to {opacity:1; transform:none;} }`}</style>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-[fadeInUp_.18s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-6 py-5 border-b border-slate-100 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 rounded-t-3xl overflow-hidden">
          <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10" />
          <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
                <Users2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">Staff Logins</h2>
                <p className="text-[11px] text-emerald-100/90">{staff.length} login{staff.length !== 1 ? "s" : ""} across your stores</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-50 transition shadow-sm"
              >
                <UserPlus className="w-4 h-4" /> New Staff Login
              </button>
              <button onClick={onClose} className="text-emerald-100 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-xs text-slate-500 mb-4">
            Username + password logins scoped to one store and a chosen set of tabs — for cashiers and other
            staff who don't need a full admin account or their own email.
          </p>

          {loading ? (
            <p className="text-sm text-slate-400 py-10 text-center">Loading…</p>
          ) : staff.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
                <Users2 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No staff logins yet</p>
              <p className="text-xs text-slate-400 mt-1">Click "New Staff Login" to create the first one.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {staff.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3.5 border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${avatarColor(s.username || s.name || "?")} text-white flex items-center justify-center text-sm font-black shrink-0`}>
                      {initials(s.name || s.username)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {s.name} <span className="text-slate-400 font-normal">@{s.username}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 flex-wrap">
                        <StoreIcon className="w-3 h-3" /> {s.store_name || s.store_id}
                        <span className="text-slate-300">·</span>
                        {s.department || "—"}
                        <span className="text-slate-300">·</span>
                        {(s.permissions || []).length} tab{(s.permissions || []).length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${s.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                      {s.status === "ACTIVE" ? "Active" : "Suspended"}
                    </span>
                    <button title="Reset password" onClick={() => setResetTarget(s)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button title={s.status === "ACTIVE" ? "Suspend" : "Reactivate"} onClick={() => handleToggleStatus(s)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition">
                      {s.status === "ACTIVE" ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                    <button title="Delete" onClick={() => handleDelete(s)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <AddStaffModal
          stores={stores}
          fixedStoreId={fixedStoreId}
          fixedStoreName={fixedStoreName}
          allowedPermissions={allowedPermissions}
          onClose={() => setShowAdd(false)}
          onCreated={fetchStaff}
        />
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-[220] bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={() => setResetTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800">Reset password</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">for @{resetTarget.username}</p>
            <input className={INP} type="text" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setResetTarget(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Cancel</button>
              <button onClick={handleResetPassword} className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-emerald-600/20 transition">Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
