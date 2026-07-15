import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, GitBranch, Plus, Edit, Trash2, Users, MapPin,
  Phone, ChevronRight, ChevronDown, CheckCircle, XCircle,
  RefreshCw, X, AlertTriangle, Hash, User, Store,
} from 'lucide-react';

const API_BASE = APP_API_URL;
const getToken = () => localStorage.getItem('superadmin_token');
const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
};

const EMPTY_FORM = {
  name: '', code: '', type: 'store', city: '', address: '',
  phone: '', parent_id: '', manager_id: '', active: true,
};

/* ── Store Form Modal ── */
function StoreFormModal({ open, onClose, initial, stores, admins, onSave }) {
  const [form,   setForm]   = useState(initial || EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial || EMPTY_FORM); setErrors({}); }, [initial, open]);

  const parentStores = stores.filter(s => s.type === 'store' && s.id !== initial?.id);

  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name = 'Name is required';
    if (!form.code.trim())  e.code = 'Code is required';
    if (form.type === 'branch' && !form.parent_id) e.parent_id = 'Select a parent store';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (e) { setErrors({ _global: e.message }); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  const INP = 'w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 rounded-t-2xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 flex items-center justify-center">
              {form.type === 'branch' ? <GitBranch className="w-5 h-5 text-amber-300" /> : <Building2 className="w-5 h-5 text-amber-300" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{initial?.id ? 'Edit' : 'New'} {form.type === 'branch' ? 'Branch' : 'Store'}</h2>
              <p className="text-xs text-slate-400">Fill in the details below</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {errors._global && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errors._global}</div>
          )}

          {/* Type toggle */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'store',  icon: Building2,  label: 'Store',  desc: 'Main location' },
                { val: 'branch', icon: GitBranch,  label: 'Branch', desc: 'Sub-location of a store' },
              ].map(({ val, icon: Icon, label, desc }) => (
                <button key={val} type="button" onClick={() => setForm(f => ({ ...f, type: val, parent_id: '' }))}
                  className={`p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${form.type === val ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <Icon className={`w-5 h-5 ${form.type === val ? 'text-amber-600' : 'text-gray-400'}`} />
                  <div>
                    <p className={`text-sm font-bold ${form.type === val ? 'text-amber-700' : 'text-gray-700'}`}>{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Parent store (branches only) */}
          {form.type === 'branch' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Parent Store <span className="text-red-500">*</span></label>
              <select value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
                className={`${INP} ${errors.parent_id ? 'border-red-400 bg-red-50' : 'border-gray-300'} bg-white`}>
                <option value="">— Select parent store —</option>
                {parentStores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
              {errors.parent_id && <p className="mt-1 text-xs text-red-600">{errors.parent_id}</p>}
            </div>
          )}

          {/* Name + Code */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Name <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. New Market Store"
                className={`${INP} ${errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Code <span className="text-red-500">*</span></label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. NMK" maxLength={10}
                className={`${INP} uppercase tracking-widest font-mono ${errors.code ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
              {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code}</p>}
            </div>
          </div>

          {/* City + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">City</label>
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="e.g. Kolkata"
                className={`${INP} border-gray-300`} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+91 XXXXXXXXXX"
                className={`${INP} border-gray-300`} />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Address</label>
            <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Full address..." rows={2}
              className={`${INP} border-gray-300 resize-none`} />
          </div>

          {/* Manager */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Store Manager (optional)</label>
            <select value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))}
              className={`${INP} border-gray-300 bg-white`}>
              <option value="">— Assign later —</option>
              {admins.map(a => <option key={a.id} value={a.id}>{a.name} ({a.email})</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-400">The selected admin will be automatically assigned to this {form.type}.</p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-2 border-t border-gray-100">
            <div>
              <p className="text-sm font-semibold text-gray-700">Active</p>
              <p className="text-xs text-gray-400">Inactive stores are hidden from operations</p>
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, active: !f.active }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? 'bg-amber-500' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-bold hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving...' : initial?.id ? 'Update' : `Create ${form.type === 'branch' ? 'Branch' : 'Store'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Assign Admin Modal ── */
function AssignAdminModal({ open, onClose, store, admins, onAssign }) {
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open || !store) return null;

  const handleAssign = async () => {
    if (!selected) return;
    setSaving(true);
    try { await onAssign(selected, store.id); onClose(); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  // Admins not yet assigned to this store
  const available = admins.filter(a => a.store_id !== store.id);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-gray-900">Assign Admin to Store</h3>
            <p className="text-xs text-gray-500 mt-0.5">{store.name} ({store.code})</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <select value={selected} onChange={e => setSelected(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none bg-white mb-4">
          <option value="">— Select an administrator —</option>
          {available.map(a => (
            <option key={a.id} value={a.id}>{a.name} — {a.department} ({a.email})</option>
          ))}
        </select>
        {available.length === 0 && (
          <p className="text-xs text-gray-400 mb-4 text-center">All administrators are already assigned to a store.</p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleAssign} disabled={!selected || saving}
            className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Store Card ── */
function StoreCard({ store, admins, onEdit, onDelete, onAssignAdmin, onViewAdmins }) {
  const [expanded, setExpanded] = useState(false);
  const hasBranches = (store.branches || []).length > 0;
  const isBranch = store.type === 'branch';

  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm overflow-hidden transition-all ${isBranch ? 'border-blue-100 ml-6' : 'border-gray-100'}`}>
      {/* Color stripe */}
      <div className={`h-1.5 ${isBranch ? 'bg-gradient-to-r from-blue-400 to-indigo-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: icon + info */}
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isBranch ? 'bg-blue-100' : 'bg-amber-100'}`}>
              {isBranch
                ? <GitBranch className="w-5 h-5 text-blue-600" />
                : <Building2 className="w-5 h-5 text-amber-600" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-gray-900">{store.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isBranch ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                  {store.code}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${store.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {store.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {store.city && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="w-3 h-3" /> {store.city}
                  </span>
                )}
                {store.phone && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Phone className="w-3 h-3" /> {store.phone}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Users className="w-3 h-3" /> {store.admin_count} admin{store.admin_count !== 1 ? 's' : ''}
                </span>
                {store.manager_name && (
                  <span className="flex items-center gap-1 text-xs text-indigo-600 font-semibold">
                    <User className="w-3 h-3" /> {store.manager_name}
                  </span>
                )}
              </div>
              {store.address && (
                <p className="text-xs text-gray-400 mt-1 truncate max-w-xs">{store.address}</p>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onAssignAdmin(store)} title="Assign Admin"
              className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-500 transition-colors">
              <Users className="w-4 h-4" />
            </button>
            <button onClick={() => onViewAdmins(store)} title="View Admins"
              className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 transition-colors">
              <User className="w-4 h-4" />
            </button>
            <button onClick={() => onEdit(store)} title="Edit"
              className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-500 transition-colors">
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(store)} title="Delete"
              className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            {hasBranches && (
              <button onClick={() => setExpanded(e => !e)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Branches */}
        {hasBranches && expanded && (
          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <GitBranch className="w-3 h-3" /> Branches ({store.branches.length})
            </p>
            {store.branches.map(branch => (
              <StoreCard key={branch.id} store={branch} admins={admins}
                onEdit={onEdit} onDelete={onDelete}
                onAssignAdmin={onAssignAdmin} onViewAdmins={onViewAdmins} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Store Admins Drawer ── */
function StoreAdminsDrawer({ store, onClose }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!store) return;
    setLoading(true);
    apiFetch(`/superadmin/stores/${store.id}/admins`)
      .then(d => setAdmins(d.admins || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [store]);

  if (!store) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-sm bg-white h-full shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h3 className="text-base font-bold text-gray-900">{store.name}</h3>
            <p className="text-xs text-gray-500">{store.admin_count} admin{store.admin_count !== 1 ? 's' : ''} assigned</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 text-gray-400 animate-spin" /></div>
          ) : admins.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No admins assigned to this {store.type} yet.</div>
          ) : admins.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                {a.name?.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{a.name}</p>
                  {a.is_manager && (
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold">Manager</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{a.department}</p>
                <p className="text-xs text-gray-400 truncate">{a.email}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                a.status === 'Active' ? 'bg-green-100 text-green-700' :
                a.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
              }`}>{a.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main StoresTab ── */
export default function StoresTab({ admins = [], toast }) {
  const [stores,       setStores]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [formOpen,     setFormOpen]     = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [assignStore,  setAssignStore]  = useState(null);
  const [viewStore,    setViewStore]    = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [searchTerm,   setSearchTerm]   = useState('');

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/superadmin/stores');
      setStores(data.stores || []);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  const handleSave = async (form) => {
    const payload = {
      name:       form.name.trim(),
      code:       form.code.trim(),
      type:       form.type,
      city:       form.city.trim() || null,
      address:    form.address.trim() || null,
      phone:      form.phone.trim() || null,
      parent_id:  form.parent_id || null,
      manager_id: form.manager_id || null,
      active:     form.active,
    };
    if (editingStore?.id) {
      await apiFetch(`/superadmin/stores/${editingStore.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Store updated successfully', 'success');
    } else {
      await apiFetch('/superadmin/stores', { method: 'POST', body: JSON.stringify(payload) });
      toast(`${form.type === 'branch' ? 'Branch' : 'Store'} created successfully`, 'success');
    }
    setEditingStore(null);
    await fetchStores();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/superadmin/stores/${deleteTarget.id}`, { method: 'DELETE' });
      toast(`${deleteTarget.type === 'branch' ? 'Branch' : 'Store'} deleted`, 'success');
      setDeleteTarget(null);
      await fetchStores();
    } catch (e) { toast(e.message, 'error'); }
    finally { setDeleting(false); }
  };

  const handleAssignAdmin = async (adminId, storeId) => {
    await apiFetch(`/superadmin/admins/${adminId}/store`, {
      method: 'PATCH',
      body: JSON.stringify({ store_id: storeId }),
    });
    toast('Admin assigned to store', 'success');
    await fetchStores();
  };

  // Flatten for search
  const allStores = stores.reduce((acc, s) => {
    acc.push(s);
    (s.branches || []).forEach(b => acc.push(b));
    return acc;
  }, []);

  const filteredStores = stores.filter(s => {
    const term = searchTerm.toLowerCase();
    if (typeFilter !== 'all' && s.type !== typeFilter) return false;
    if (term && !s.name.toLowerCase().includes(term) && !s.code.toLowerCase().includes(term) &&
        !(s.city || '').toLowerCase().includes(term)) return false;
    return true;
  });

  const totalStores   = allStores.filter(s => s.type === 'store').length;
  const totalBranches = allStores.filter(s => s.type === 'branch').length;
  const totalAdmins   = allStores.reduce((s, st) => s + (st.admin_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-500" /> Stores & Branches
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage your retail locations and assign administrators</p>
        </div>
        <button onClick={() => { setEditingStore(null); setFormOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-bold hover:from-amber-600 hover:to-orange-600 shadow-md shadow-amber-500/20">
          <Plus className="w-4 h-4" /> Add Store / Branch
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Stores',   value: totalStores,   color: 'from-amber-500 to-orange-500',   icon: Building2 },
          { label: 'Total Branches', value: totalBranches, color: 'from-blue-500 to-indigo-500',    icon: GitBranch },
          { label: 'Admins Assigned',value: totalAdmins,   color: 'from-violet-500 to-purple-600',  icon: Users },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-2xl font-black text-gray-900">{value}</p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
          {[['all','All'],['store','Stores'],['branch','Branches']].map(([val, label]) => (
            <button key={val} onClick={() => setTypeFilter(val)}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${typeFilter === val ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by name, code, city…"
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
        <button onClick={fetchStores} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Store List */}
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-gray-400 animate-spin" /></div>
      ) : filteredStores.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-base font-bold text-gray-500">
            {stores.length === 0 ? 'No stores yet' : 'No results found'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {stores.length === 0 ? 'Click "Add Store / Branch" to create your first retail location.' : 'Try adjusting your search or filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStores.map(store => (
            <StoreCard key={store.id} store={store} admins={admins}
              onEdit={s => { setEditingStore(s); setFormOpen(true); }}
              onDelete={setDeleteTarget}
              onAssignAdmin={setAssignStore}
              onViewAdmins={setViewStore} />
          ))}
        </div>
      )}

      {/* Modals */}
      <StoreFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingStore(null); }}
        initial={editingStore}
        stores={allStores}
        admins={admins}
        onSave={handleSave}
      />
      <AssignAdminModal
        open={!!assignStore}
        onClose={() => setAssignStore(null)}
        store={assignStore}
        admins={admins}
        onAssign={handleAssignAdmin}
      />
      <StoreAdminsDrawer store={viewStore} onClose={() => setViewStore(null)} />

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-1">
              Delete {deleteTarget.type === 'branch' ? 'Branch' : 'Store'}?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-2">
              <strong>{deleteTarget.name}</strong> ({deleteTarget.code})
            </p>
            <p className="text-xs text-gray-400 text-center mb-6">
              This cannot be undone. All assigned admins must be reassigned first.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}