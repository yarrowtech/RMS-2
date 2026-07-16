import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Plus, Eye, Trash2, Lock, Unlock, Search,
  CheckCircle, XCircle, Clock, X, AlertCircle,
  Users, Shield, UserPlus, Pencil
} from "lucide-react";
import toast from "react-hot-toast";

const API   = APP_API_URL;
const api = async (path, opts = {}) => {
  const token = localStorage.getItem("admin_token") || "";
  const res   = await fetch(`${API}${path}`, {
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
};

// ── Static config that's genuinely static (colors, groupings, presets) ────────
// The department LIST itself is no longer hardcoded here — it now comes from
// GET /hq/departments so backend and frontend can never drift apart the way
// they did before (backend only had Cashier/Store Admin at the store level;
// frontend matched it exactly because both were hand-written separately).

const DEPT_COLOR_BY_ID = {
  "Inventory":                    "indigo",
  "Merchandiser Buyer":           "violet",
  "HR":                           "pink",
  "Finance":                      "emerald",
  "Logistics":                    "amber",
  "IT":                           "cyan",
  "Design & Pattern":             "rose",
  "Stock Planning & Forecasting": "blue",
  "Third Party":                  "slate",
  "Production & Job Work":        "fuchsia",
  "Cashier":                      "orange",
  "Inventory (Store)":            "indigo",
  "Finance (Store)":              "emerald",
  "HR (Store)":                   "pink",
  "Store Management":             "teal",
  // Legacy alias some existing records may still carry
  "Store":                        "teal",
};

const DEPT_LABEL_OVERRIDES = {
  "Stock Planning & Forecasting": "Stock Planning",
};

const PERMISSIONS = [
  { id:"inventory",       label:"Inventory",         group:"Operations" },
  { id:"purchase_orders", label:"Purchase Orders",   group:"Operations" },
  { id:"grn",             label:"GRN / Receiving",   group:"Operations" },
  { id:"grc",             label:"GRC",               group:"Operations" },
  { id:"vendors",         label:"Vendors",           group:"Operations" },
  { id:"stock_allocation",label:"Stock Allocation",  group:"Operations" },
  { id:"stock_transfer",  label:"Stock Transfer",    group:"Operations" },
  { id:"job_work",        label:"Production & Job Work", group:"Operations" },
  { id:"mbuyer",          label:"Merchandiser Buyer",group:"Operations" },
  { id:"cashier",         label:"Cashier / POS",     group:"Store"      },
  { id:"store_stock",     label:"Store Stock",       group:"Store"      },
  { id:"sales",           label:"Sales Reports",     group:"Store"      },
  { id:"hr",              label:"HR",                group:"Admin"      },
  { id:"finance",         label:"Finance",           group:"Admin"      },
  { id:"logistics",       label:"Logistics",         group:"Admin"      },
  { id:"reports",         label:"Reports",           group:"Admin"      },
  { id:"user_management", label:"User Management",   group:"Admin"      },
];

// Quick permission presets — still a frontend-only UX convenience; the
// backend enforces whatever ends up in the saved `permissions` array
// regardless of how it got there (preset click, department default, or
// manual checkbox).
const PRESETS = {
  "Inventory Manager": ["inventory","stock_allocation","stock_transfer","reports"],
  "Production Manager": ["inventory","job_work","reports"],
  "Buyer":             ["purchase_orders","vendors","mbuyer","reports"],
  "Store Manager":     ["cashier","store_stock","sales","reports"],
  "Finance":           ["finance","reports"],
  "Full HQ Access":    ["inventory","purchase_orders","grn","grc","vendors","stock_allocation","stock_transfer","job_work","mbuyer","hr","finance","logistics","reports","user_management"],
};

const DEPT_COLOR = {
  indigo:"bg-indigo-100 text-indigo-700", violet:"bg-violet-100 text-violet-700",
  pink:"bg-pink-100 text-pink-700",       emerald:"bg-emerald-100 text-emerald-700",
  amber:"bg-amber-100 text-amber-700",    cyan:"bg-cyan-100 text-cyan-700",
  rose:"bg-rose-100 text-rose-700",       blue:"bg-blue-100 text-blue-700",
  slate:"bg-slate-100 text-slate-600",    orange:"bg-orange-100 text-orange-700",
  teal:"bg-teal-100 text-teal-700",          fuchsia:"bg-fuchsia-100 text-fuchsia-700",
};

const INP = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition bg-white";
const LBL = "block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5";

const EMPTY_FORM = {
  name:"", email:"", phone:"",
  scope:"hq",   // "hq" | "store" — explicit now, chosen by the person creating
                // the admin, NOT inferred from which department checkbox is
                // clicked. Departments like "Inventory" exist at both levels
                // under the identical name (same frontend route either way —
                // the page itself branches on localStorage.store_id), so a
                // department string alone can no longer tell us the scope.
  managedDepartments:[], permissions:[], store_id:"",
};

function deptLabel(id) {
  return DEPT_LABEL_OVERRIDES[id] || id;
}

function deptColor(id) {
  return DEPT_COLOR_BY_ID[id] || "slate";
}

// ══════════════════════════════════════════════════════════════════════════════
// ADD ADMIN MODAL
// ══════════════════════════════════════════════════════════════════════════════
function AddAdminModal({ onClose, onCreated, stores = [], deptConfig }) {
  const [form,   setForm]   = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const hqDepartments      = deptConfig?.hq_departments    || [];
  const storeDepartments   = deptConfig?.store_departments || [];
  const defaultPermsByDept = deptConfig?.store_department_default_permissions || {};

  const selectedDepts = form.managedDepartments;
  const isStoreScope  = form.scope === "store";

  // Switching Level clears department selections that don't exist at the
  // new level (e.g. "Merchandiser Buyer" isn't valid at store scope), and
  // resets store_id when moving away from store scope.
  const setScope = (scope) => {
    setForm(f => {
      const validDepts = scope === "hq" ? hqDepartments : storeDepartments;
      return {
        ...f,
        scope,
        managedDepartments: f.managedDepartments.filter(d => validDepts.includes(d)),
        store_id: scope === "hq" ? "" : f.store_id,
      };
    });
  };

  const toggleDept = (id) => {
    setForm(f => {
      const cur = f.managedDepartments;
      const alreadySelected = cur.includes(id);
      const nextDepts = alreadySelected ? cur.filter(d => d !== id) : [...cur, id];

      // Auto-apply suggested default permissions the first time a
      // department is picked at STORE scope (only if no permissions
      // chosen yet, so we never clobber something already customized).
      let nextPerms = f.permissions;
      if (!alreadySelected && f.scope === "store" && f.permissions.length === 0) {
        const suggested = defaultPermsByDept[id];
        if (suggested) nextPerms = suggested;
      }

      return {
        ...f,
        managedDepartments: nextDepts,
        permissions: nextPerms,
      };
    });
  };

  const togglePerm = (id) => {
    setForm(f => {
      const cur = f.permissions;
      return {
        ...f,
        permissions: cur.includes(id) ? cur.filter(p=>p!==id) : [...cur, id],
      };
    });
  };

  const applyPreset = (presetPerms) => {
    setForm(f => ({ ...f, permissions: presetPerms }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())                e.name  = "Name is required";
    if (!form.email.trim())               e.email = "Email is required";
    if (!form.managedDepartments.length)  e.depts = "Select at least one department";
    if (isStoreScope && !form.store_id)   e.store = "Select a store/branch for a store-level admin";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      await api("/hq/admins", {
        method: "POST",
        body:   JSON.stringify({
          name:               form.name.trim(),
          email:              form.email.trim(),
          phone:              form.phone.trim(),
          scope:              form.scope,
          managedDepartments: form.managedDepartments,
          permissions:        form.permissions,
          store_id:           isStoreScope ? form.store_id : null,
        }),
      });
      toast.success(`Admin created! Setup email sent to ${form.email}`);
      onCreated();
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const permGroups = ["Operations","Store","Admin"];

  // Flatten stores + branches
  const storeOptions = stores.flatMap(s => [
    { id:s.id, label:`🏪 ${s.name} (${s.code})`, type:"store" },
    ...(s.branches||[]).map(b => ({ id:b.id, label:`  🌿 ${b.name} (${b.code})`, type:"branch" })),
  ]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5" style={{zIndex:99999,position:"fixed",top:0,left:0,right:0,bottom:0}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{maxHeight:"88dvh",overflow:"hidden"}}>

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-400/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-indigo-300"/>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Add Admin</h2>
              <p className="text-xs text-slate-400">Creates an account and sends setup email</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5" style={{flex:1,overflowY:"auto",minHeight:0}}>

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={LBL}>Full Name *</label>
              <input className={`${INP} ${errors.name?"border-red-400":""}`}
                value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                placeholder="e.g. Rahul Sharma"/>
              {errors.name && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.name}</p>}
            </div>
            <div>
              <label className={LBL}>Email *</label>
              <input type="email" className={`${INP} ${errors.email?"border-red-400":""}`}
                value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
                placeholder="admin@company.com"/>
              {errors.email && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.email}</p>}
            </div>
            <div>
              <label className={LBL}>Phone</label>
              <input className={INP} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}
                placeholder="+91 98765 43210"/>
            </div>
          </div>

          {/* Level (scope) — explicit choice, no longer inferred from
              which department checkbox gets clicked */}
          <div>
            <label className={LBL}>Level *</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setScope("hq")}
                className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  form.scope === "hq"
                    ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"
                }`}>
                🏢 HQ Admin
              </button>
              <button type="button" onClick={() => setScope("store")}
                className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  form.scope === "store"
                    ? "border-teal-400 bg-teal-50 text-teal-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"
                }`}>
                🏪 Store Admin
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Some departments (Inventory, Finance, HR) exist at both levels — same page, same department name,
              but scoped to central stock at HQ or to one store's stock/till when created as a Store Admin.
            </p>
          </div>

          {/* Department selection — picklist depends on the Level chosen above */}
          <div>
            <label className={LBL}>Departments * <span className="text-slate-400 font-normal normal-case tracking-normal">— determines what they can access</span></label>
            {errors.depts && <p className="mb-2 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.depts}</p>}

            {!deptConfig ? (
              <div className="text-xs text-slate-400 py-4 text-center">Loading departments…</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(isStoreScope ? storeDepartments : hqDepartments).map(deptId => {
                  const active = selectedDepts.includes(deptId);
                  const color  = deptColor(deptId);
                  // NOTE: Tailwind scans source for complete, literal class
                  // strings at build time — `border-${accent}-400` would
                  // never get generated into the CSS bundle. Use full
                  // static strings per scope instead.
                  const activeBorderCls = isStoreScope ? "border-teal-400"        : "border-indigo-400";
                  const checkboxCls     = isStoreScope ? "bg-teal-500 border-teal-500" : "bg-indigo-500 border-indigo-500";
                  return (
                    <button key={deptId} type="button" onClick={() => toggleDept(deptId)}
                      className={`px-3 py-2 rounded-xl border text-xs font-semibold text-left transition-all flex items-center gap-2 ${
                        active ? `${activeBorderCls} ${DEPT_COLOR[color]}` : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                      }`}>
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${active ? checkboxCls : "border-slate-300"}`}>
                        {active && <CheckCircle className="w-3 h-3 text-white"/>}
                      </div>
                      {deptLabel(deptId)}
                    </button>
                  );
                })}
              </div>
            )}

            {isStoreScope && (
              <p className="mt-2 text-[11px] text-slate-400">
                Each store department gets its own permission set — e.g. an Inventory admin at this store can
                receive stock transfers; a Cashier cannot, unless also given that permission below.
              </p>
            )}
          </div>

          {/* Store assignment — only when Level = Store */}
          {isStoreScope && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <label className={LBL + " text-teal-800"}>Assign to Store / Branch *</label>
              {errors.store && <p className="mb-2 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.store}</p>}
              <select className={INP} value={form.store_id} onChange={e=>setForm(f=>({...f,store_id:e.target.value}))}>
                <option value="">— Select store or branch —</option>
                {storeOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          )}

          {/* Permissions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={LBL}>Permissions</label>
              <div className="flex flex-wrap gap-1">
                {Object.entries(PRESETS).map(([name, perms]) => (
                  <button key={name} type="button" onClick={() => applyPreset(perms)}
                    className="px-2 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition">
                    {name}
                  </button>
                ))}
              </div>
            </div>
            {permGroups.map(group => (
              <div key={group} className="mb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{group}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {PERMISSIONS.filter(p=>p.group===group).map(perm => {
                    const active = form.permissions.includes(perm.id);
                    return (
                      <button key={perm.id} type="button" onClick={() => togglePerm(perm.id)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold text-left transition-all flex items-center gap-2 ${
                          active ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"
                        }`}>
                        <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${active?"bg-indigo-500 border-indigo-500":"border-slate-300"}`}>
                          {active && <CheckCircle className="w-2.5 h-2.5 text-white"/>}
                        </div>
                        {perm.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3" style={{flexShrink:0}}>
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {saving
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Creating…</>
              : "Create Admin & Send Email"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VIEW ADMIN MODAL
// ══════════════════════════════════════════════════════════════════════════════
function EditPermissionsModal({ admin, onClose, onSaved, deptConfig }) {
  const [permissions, setPermissions] = useState([...(admin.permissions || [])]);
  const [departments, setDepartments] = useState([...(admin.managedDepartments || [])]);
  const [saving, setSaving] = useState(false);

  const availableDepartments = admin.scope === "store"
    ? (deptConfig?.store_departments || [])
    : (deptConfig?.hq_departments || []);

  const toggle = (id) => setPermissions(current =>
    current.includes(id) ? current.filter(p => p !== id) : [...current, id]
  );

  const toggleDepartment = (id) => setDepartments(current =>
    current.includes(id) ? current.filter(department => department !== id) : [...current, id]
  );

  const save = async () => {
    if (!departments.length) {
      toast.error("Select at least one department for this admin.");
      return;
    }
    try {
      setSaving(true);
      await api(`/hq/admins/${admin.id}`, {
        method: "PATCH",
        body: JSON.stringify({ permissions, managedDepartments: departments }),
      });
      toast.success(`Access updated for ${admin.name}`);
      await onSaved();
      onClose();
    } catch (e) {
      toast.error(e.message || "Could not update permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" style={{zIndex:99999}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Edit Admin Access</h2>
            <p className="text-xs text-slate-500 mt-0.5">{admin.name} · {admin.email}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 overflow-y-auto">
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Departments</p>
                <p className="mt-1 text-xs text-slate-400">{admin.scope === "store" ? "Store scope is fixed for this admin." : "HQ scope is fixed for this admin."}</p>
              </div>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{departments.length} selected</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {availableDepartments.map(department => {
                const active = departments.includes(department);
                return <button key={department} type="button" onClick={() => toggleDepartment(department)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-semibold transition ${active ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 text-slate-600 hover:border-violet-200"}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${active ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300"}`}>
                    {active && <CheckCircle className="h-3 w-3"/>}
                  </span>
                  {deptLabel(department)}
                </button>;
              })}
            </div>
          </section>
          {["Operations", "Store", "Admin"].map(group => (
            <div key={group} className="mb-6 last:mb-0">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">{group}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PERMISSIONS.filter(p => p.group === group).map(permission => {
                  const active = permissions.includes(permission.id);
                  return (
                    <button key={permission.id} type="button" onClick={() => toggle(permission.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${active ? "bg-indigo-50 border-indigo-300 text-indigo-800" : "border-slate-200 text-slate-600 hover:border-indigo-200"}`}>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${active ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300"}`}>
                        {active && <CheckCircle className="w-3 h-3"/>}
                      </span>
                      <span className="text-sm font-semibold">{permission.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2.5 bg-indigo-600 rounded-xl text-sm font-bold text-white disabled:opacity-50">
            {saving ? "Saving..." : "Save Access"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewAdminModal({ admin, onClose }) {
  if (!admin) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" style={{zIndex:99999}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Admin Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl">
              {admin.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">{admin.name}</p>
              <p className="text-sm text-slate-500">{admin.email}</p>
              {admin.phone && <p className="text-xs text-slate-400">{admin.phone}</p>}
            </div>
          </div>
          {[
            ["Scope",       admin.scope === "hq" ? "HQ Admin" : "Store Admin"],
            ["Store",       admin.store_name || "—"],
            ["Status",      admin.status],
            ["Password",    admin.password_set ? "Set" : "Pending setup"],
            ["Tenant",      admin.tenant_id],
            ["Created",     (admin.created_at||"").slice(0,10)],
          ].map(([label,value]) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
              <span className="text-xs text-slate-500 font-semibold">{label}</span>
              <span className="text-xs text-slate-900 font-bold">{value}</span>
            </div>
          ))}
          <div>
            <p className="text-xs text-slate-500 font-semibold mb-2">Departments</p>
            <div className="flex flex-wrap gap-1.5">
              {(admin.managedDepartments||[]).map(d => (
                <span key={d} className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">{deptLabel(d)}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold mb-2">Permissions ({(admin.permissions||[]).length})</p>
            <div className="flex flex-wrap gap-1.5">
              {(admin.permissions||[]).map(p => (
                <span key={p} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">{p}</span>
              ))}
              {!(admin.permissions||[]).length && <span className="text-xs text-slate-400">No permissions set</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════════════════════════════════════
export default function HQAdminManagement() {
  const [admins,    setAdmins]    = useState([]);
  const [stores,    setStores]    = useState([]);
  const [deptConfig, setDeptConfig] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState("");
  const [filterScope, setFilterScope] = useState("all");
  const [showAdd,   setShowAdd]   = useState(false);
  const [viewAdmin, setViewAdmin] = useState(null);
  const [editAdmin, setEditAdmin] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [admData, stData, deptData] = await Promise.all([
        api("/hq/admins"),
        api("/hq/stores"),
        api("/hq/departments"),
      ]);
      setAdmins(admData.data || []);
      setStores(stData.data  || []);
      setDeptConfig(deptData.data || null);
    } catch { toast.error("Failed to load data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSuspend = async (admin) => {
    const newStatus = (admin.status==="ACTIVE"||admin.status==="Active") ? "SUSPENDED" : "ACTIVE";
    try {
      await api(`/hq/admins/${admin.id}`, { method:"PATCH", body: JSON.stringify({ status: newStatus }) });
      toast.success(`${admin.name} ${newStatus === "ACTIVE" ? "activated" : "suspended"} — takes effect on their next request`);
      fetchAll();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete    = (admin) => setConfirmDelete(admin);
  const confirmDoDelete = async () => {
    const admin = confirmDelete;
    setConfirmDelete(null);
    try {
      await api(`/hq/admins/${admin.id}`, { method:"DELETE" });
      toast.success(`${admin.name} deleted!`);
      fetchAll();
    } catch (e) {
      toast.error(e.message || "Delete failed");
    }
  };

  const filtered = admins.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || [a.name, a.email, ...(a.managedDepartments||[])].some(f => (f||"").toLowerCase().includes(q));
    const matchScope  = filterScope === "all" || a.scope === filterScope;
    return matchSearch && matchScope;
  });

  const hqCount    = admins.filter(a => a.scope === "hq").length;
  const storeCount = admins.filter(a => a.scope === "store").length;

  return (
    <div className="min-h-full p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-white"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Admin Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">{admins.length} admin{admins.length!==1?"s":""} · {hqCount} HQ · {storeCount} store</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-bold hover:opacity-90 transition shadow-md">
          <UserPlus className="w-4 h-4"/> Add Admin
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Total",  admins.length,  "bg-slate-50  border-slate-200  text-slate-900"],
          ["HQ",     hqCount,        "bg-indigo-50 border-indigo-200 text-indigo-800"],
          ["Store",  storeCount,     "bg-teal-50   border-teal-200   text-teal-800"],
        ].map(([label, value, cls]) => (
          <div key={label} className={`rounded-xl border px-4 py-3 ${cls}`}>
            <p className="text-2xl font-black">{value}</p>
            <p className="text-xs font-semibold opacity-70 mt-0.5">{label} Admins</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input type="text" placeholder="Search by name, email, department…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-white"/>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {[["all","All"],["hq","HQ"],["store","Store"]].map(([val,label]) => (
            <button key={val} onClick={() => setFilterScope(val)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${filterScope===val?"bg-white text-indigo-700 shadow border border-slate-200":"text-slate-500 hover:text-slate-700"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["Admin","Scope","Departments","Permissions","Password","Status","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="py-14 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"/>Loading…
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-14 text-center text-slate-400 text-sm">
                  {search ? "No admins match your search." : "No admins yet. Click \"Add Admin\" to create one."}
                </td></tr>
              ) : filtered.map(admin => {
                const isActive = admin.status === "ACTIVE" || admin.status === "Active";
                return (
                  <tr key={admin.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Name */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-black text-xs shrink-0">
                          {admin.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{admin.name}</p>
                          <p className="text-xs text-slate-400">{admin.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Scope */}
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${admin.scope==="hq"?"bg-indigo-100 text-indigo-700":"bg-teal-100 text-teal-700"}`}>
                        {admin.scope === "hq" ? "HQ" : admin.store_name || "Store"}
                      </span>
                    </td>
                    {/* Depts */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(admin.managedDepartments||[]).slice(0,2).map(d => (
                          <span key={d} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">{deptLabel(d)}</span>
                        ))}
                        {(admin.managedDepartments||[]).length > 2 && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">+{admin.managedDepartments.length-2}</span>
                        )}
                      </div>
                    </td>
                    {/* Permissions */}
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-semibold text-slate-600">
                        {(admin.permissions||[]).length} permission{(admin.permissions||[]).length!==1?"s":""}
                      </span>
                    </td>
                    {/* Password */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${admin.password_set?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>
                        {admin.password_set ? <CheckCircle className="w-3 h-3"/> : <Clock className="w-3 h-3"/>}
                        {admin.password_set ? "Set" : "Pending"}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${isActive?"bg-emerald-100 text-emerald-700":admin.status==="PENDING"?"bg-amber-100 text-amber-700":"bg-red-100 text-red-700"}`}>
                        {isActive ? <CheckCircle className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>}
                        {admin.status}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewAdmin(admin)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-500 transition" title="View">
                          <Eye className="w-4 h-4"/>
                        </button>
                        <button onClick={() => setEditAdmin(admin)} className="p-1.5 hover:bg-violet-50 rounded-lg text-violet-500 transition" title="Edit departments and permissions">
                          <Pencil className="w-4 h-4"/>
                        </button>
                        <button onClick={() => handleSuspend(admin)}
                          className={`p-1.5 rounded-lg transition ${isActive?"hover:bg-amber-50 text-amber-500":"hover:bg-emerald-50 text-emerald-500"}`}
                          title={isActive?"Suspend":"Activate"}>
                          {isActive ? <Lock className="w-4 h-4"/> : <Unlock className="w-4 h-4"/>}
                        </button>
                        <button onClick={() => handleDelete(admin)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition" title="Delete">
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirmDelete && createPortal((
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{zIndex:99999}}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-black text-slate-900 mb-2">Delete Admin?</h3>
            <p className="text-sm text-slate-600 mb-1">Delete <b>{confirmDelete.name}</b>?</p>
            <p className="text-xs text-red-500 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={confirmDoDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-bold text-white transition">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
      {showAdd && createPortal(<AddAdminModal onClose={() => setShowAdd(false)} onCreated={fetchAll} stores={stores} deptConfig={deptConfig}/>, document.body)}
      {viewAdmin && createPortal(<ViewAdminModal admin={viewAdmin} onClose={() => setViewAdmin(null)}/>, document.body)}
      {editAdmin && createPortal(<EditPermissionsModal admin={editAdmin} onClose={() => setEditAdmin(null)} onSaved={fetchAll} deptConfig={deptConfig}/>, document.body)}
    </div>
  );
}
