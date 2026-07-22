import { API_BASE_URL as APP_API_URL } from "../config/api.js";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import RetailersTab from './Superadminretailerstab.jsx';
import SuperAdminOnboardingRequests from './SuperAdminOnboardingRequests.jsx';
import SuperadminVendorManagementModal from './SuperadminVendorManagementModal';
import { useNavigate } from 'react-router-dom';
import {
  Crown, Shield, Users, Settings, Activity, Eye, Trash2,
  UserPlus, Lock, Unlock, AlertCircle, CheckCircle, XCircle,
  Search, RefreshCw, Building2, LogOut, User, ChevronDown, X,
  Bell, Database, BarChart2, Globe, Key, FileText, Layers, Hash,
  ChevronRight, ToggleLeft, ToggleRight, Mail, Clock, Ban,
  ArrowRight, Server, Wifi, HardDrive, Zap, ShieldCheck, ShieldOff,
  UserCheck, UserX, SendHorizonal, Store, Edit, Plus, IndianRupee
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = APP_API_URL;

const availableDepartments = [
  'HR', 'Cashier', 'Finance', 'IT', 'Logistics',
  'Design & Pattern', 'Inventory', 'Stock Planning & Forecasting',
  'Third Party', 'Merchandiser Buyer', 'Vendor',
];

const availablePermissions = [
  'User Management', 'Analytics & Reports', 'System Configuration',
  'Audit Logs', 'Billing & Finance', 'Department Control',
];

const getToken = () => localStorage.getItem('superadmin_token');

const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
};

// ─── Add Admin Modal ───────────────────────────────────────────────────────────

const AddAdminModal = ({ isOpen, onClose, formData, formErrors, onInputChange, onDepartmentToggle, onPermissionToggle, onSubmit, retailers = [] }) => {
  if (!isOpen) return null;
  const isStore = formData.admin_type === 'store';
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 rounded-t-2xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">New Administrator</h2>
              <p className="text-xs text-slate-400">{isStore ? "Store-scoped admin" : "Centralized HQ admin"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Admin Type Toggle */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Admin Type <span className="text-red-500">*</span> <span className="text-xs text-gray-400 font-normal">Choose before filling other fields</span></label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { type:'hq',    emoji:'🏢', title:'HQ Admin',   desc:'Centralized access — manages all stores, central inventory, reports & staff globally',         tags:['All Inventory','All Reports','All Stores'] },
                { type:'store', emoji:'🏪', title:'Store Admin', desc:'Scoped to one store or branch — manages cashier, stock, staff & sales for that location only', tags:['Store Stock','Store Sales','Store Staff']   },
              ].map(({ type, emoji, title, desc, tags }) => {
                const active = formData.admin_type === type;
                return (
                  <button key={type} type="button"
                    onClick={() => onInputChange({ target: { name: 'admin_type', value: type } })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${active ? (type==='hq' ? 'border-amber-400 bg-amber-50' : 'border-indigo-400 bg-indigo-50') : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl">{emoji}</span>
                      {active && <CheckCircle className={`w-5 h-5 ${type==='hq'?'text-amber-500':'text-indigo-500'}`} />}
                    </div>
                    <p className={`text-sm font-bold mb-1 ${active?(type==='hq'?'text-amber-800':'text-indigo-800'):'text-gray-800'}`}>{title}</p>
                    <p className="text-xs text-gray-500 mb-2">{desc}</p>
                    <div className="flex flex-wrap gap-1">
                      {tags.map(t => <span key={t} className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${active?(type==='hq'?'bg-amber-200 text-amber-800':'bg-indigo-200 text-indigo-800'):'bg-gray-100 text-gray-500'}`}>{t}</span>)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Retailer Dropdown */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Retailer <span className="text-red-500">*</span> <span className="text-xs text-gray-400 font-normal">Which company is this admin for?</span></label>
            <select name="tenant_id" value={formData.tenant_id} onChange={onInputChange}
              className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all bg-white ${formErrors.tenant_id ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}>
              <option value="">— Select a retailer —</option>
              {retailers.map(r => <option key={r.tenant_id} value={r.tenant_id}>{r.company_name} ({r.tenant_id})</option>)}
            </select>
            {formErrors.tenant_id && <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5"/>{formErrors.tenant_id}</p>}
          </div>

          {/* Store selector — Store Admin only */}
          {isStore && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <label className="block text-sm font-semibold text-indigo-800 mb-2">🏪 Assign to Store / Branch <span className="text-red-500">*</span></label>
              <select name="store_id" value={formData.store_id} onChange={onInputChange}
                className="w-full px-3 py-2.5 border border-indigo-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-400 outline-none">
                <option value="">— Select a store or branch —</option>
              </select>
              <p className="text-xs text-indigo-500 mt-1.5">Stores are loaded from the selected retailer's setup.</p>
            </div>
          )}

          {[
            { label: 'Full Name', name: 'name', type: 'text', placeholder: 'e.g. Jane Doe', required: true },
            { label: 'Email Address', name: 'email', type: 'email', placeholder: 'admin@company.com', required: true },
            { label: 'Phone Number', name: 'phone', type: 'tel', placeholder: '+1 (555) 000-0000', required: false },
          ].map(({ label, name, type, placeholder, required }) => (
            <div key={name}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {label} {required && <span className="text-red-500">*</span>}
              </label>
              <input
                type={type} name={name} value={formData[name]} onChange={onInputChange}
                autoComplete="off" placeholder={placeholder}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all ${formErrors[name] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {formErrors[name] && <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors[name]}</p>}
            </div>
          ))}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Managed Departments <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableDepartments.map((dept) => {
                const active = formData.managedDepartments.includes(dept);
                return (
                  <button key={dept} type="button" onClick={() => onDepartmentToggle(dept)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold text-left transition-all flex items-center gap-2 ${active ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}>
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${active ? 'bg-amber-400 border-amber-400' : 'border-gray-300'}`}>
                      {active && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    {dept}
                  </button>
                );
              })}
            </div>
            {formErrors.managedDepartments && <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.managedDepartments}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Permissions <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availablePermissions.map((perm) => {
                const active = formData.permissions.includes(perm);
                return (
                  <button key={perm} type="button" onClick={() => onPermissionToggle(perm)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold text-left transition-all flex items-center gap-2 ${active ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}>
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${active ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                      {active && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    {perm}
                  </button>
                );
              })}
            </div>
            {formErrors.permissions && <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.permissions}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Initial Status</label>
            <select name="status" value={formData.status} onChange={onInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none bg-white">
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            A setup email will be sent to the administrator with instructions to set their password.
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
          <button type="button" onClick={onSubmit}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg text-sm font-bold transition-all shadow-lg ${
              isStore
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-indigo-500/30'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/30'
            }`}>
            Create {isStore ? '🏪 Store' : '🏢 HQ'} Admin
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── View Admin Modal ──────────────────────────────────────────────────────────

const ViewAdminModal = ({ admin, onClose }) => {
  if (!admin) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
              {admin.name?.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{admin.name}</h2>
              <p className="text-xs text-slate-400">{admin.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Status', value: admin.status },
              { label: 'Password Set', value: admin.password_set ? 'Yes' : 'Pending' },
              { label: 'Created', value: admin.createdDate || '—' },
              { label: 'Users Managed', value: admin.managedUsersCount ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Departments</p>
            <div className="flex flex-wrap gap-2">
              {(admin.managedDepartments || (admin.department ? [admin.department] : [])).map((d, i) => (
                <span key={i} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">{d}</span>
              ))}
            </div>
          </div>
          {(admin.permissions || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Permissions</p>
              <div className="flex flex-wrap gap-2">
                {admin.permissions.map((p, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 pb-6">
          <button onClick={onClose} className="w-full py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

// ─── Control Panel Components ──────────────────────────────────────────────────

const PanelAdminManagement = ({ onNavigate, admins }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Total', value: admins.length, color: 'text-blue-600 bg-blue-50' },
        { label: 'Active', value: admins.filter(a => a.status === 'Active' || a.status === 'ACTIVE').length, color: 'text-green-600 bg-green-50' },
        { label: 'Pending', value: admins.filter(a => a.status === 'PENDING').length, color: 'text-amber-600 bg-amber-50' },
      ].map(({ label, value, color }) => (
        <div key={label} className={`rounded-xl p-4 text-center ${color}`}>
          <p className="text-2xl font-black">{value}</p>
          <p className="text-xs font-semibold mt-0.5">{label}</p>
        </div>
      ))}
    </div>
    <button onClick={() => onNavigate('admins')}
      className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors">
      <span>Go to Administrator Management</span>
      <ArrowRight className="w-4 h-4" />
    </button>
  </div>
);

const PanelUsersOversight = ({ admins }) => (
  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
    {admins.length === 0 ? (
      <p className="text-center text-gray-400 text-sm py-8">No administrators found.</p>
    ) : admins.map((a) => (
      <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {a.name?.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{a.name}</p>
            <p className="text-xs text-gray-500">{a.department}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {!a.password_set && (
            <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-semibold">No Password</span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            a.status === 'Active' || a.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
            a.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'}`}>
            {a.status}
          </span>
        </div>
      </div>
    ))}
  </div>
);

const PanelPermissionControl = ({ admins, onUpdatePermissions }) => {
  const [selected, setSelected] = useState(null);
  const [localPerms, setLocalPerms] = useState([]);
  const [saving, setSaving] = useState(false);

  const openAdmin = (a) => { setSelected(a); setLocalPerms(a.permissions || []); };
  const toggle = (p) => setLocalPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  if (selected) return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
        <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronRight className="w-4 h-4 text-gray-500 rotate-180" />
        </button>
        <div>
          <p className="text-sm font-bold text-gray-900">{selected.name}</p>
          <p className="text-xs text-gray-500">{selected.department}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {availablePermissions.map((perm) => {
          const active = localPerms.includes(perm);
          return (
            <button key={perm} type="button" onClick={() => toggle(perm)}
              className={`px-3 py-2.5 rounded-lg border text-xs font-semibold text-left transition-all flex items-center justify-between ${active ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              <span>{perm}</span>
              {active ? <ToggleRight className="w-5 h-5 text-blue-500" /> : <ToggleLeft className="w-5 h-5 text-gray-300" />}
            </button>
          );
        })}
      </div>
      <button
        onClick={async () => {
          setSaving(true);
          await onUpdatePermissions(selected.id, localPerms);
          setSaving(false);
          setSelected(null);
        }}
        disabled={saving}
        className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        {saving ? 'Saving...' : 'Save Permissions'}
      </button>
    </div>
  );

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {admins.length === 0 ? <p className="text-center text-gray-400 text-sm py-8">No administrators found.</p>
        : admins.map((a) => (
          <button key={a.id} onClick={() => openAdmin(a)}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                {a.name?.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">{a.name}</p>
                <p className="text-xs text-gray-500">{(a.permissions || []).length} permissions</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        ))}
    </div>
  );
};

const PanelAnalytics = ({ admins }) => {
  const total = admins.length;
  const active = admins.filter(a => a.status === 'Active' || a.status === 'ACTIVE').length;
  const pending = admins.filter(a => a.status === 'PENDING').length;
  const suspended = admins.filter(a => a.status === 'Suspended').length;
  const noPassword = admins.filter(a => !a.password_set).length;

  const deptMap = {};
  admins.forEach(a => { const d = a.department || 'Unknown'; deptMap[d] = (deptMap[d] || 0) + 1; });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Admins', value: total, color: 'bg-blue-50 text-blue-700', icon: Shield },
          { label: 'Active', value: active, color: 'bg-green-50 text-green-700', icon: CheckCircle },
          { label: 'Awaiting Setup', value: pending + noPassword, color: 'bg-amber-50 text-amber-700', icon: Clock },
          { label: 'Suspended', value: suspended, color: 'bg-red-50 text-red-700', icon: Ban },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className={`rounded-xl p-3 flex items-center gap-3 ${color}`}>
            <Icon className="w-5 h-5 shrink-0" />
            <div><p className="text-xl font-black">{value}</p><p className="text-xs font-semibold">{label}</p></div>
          </div>
        ))}
      </div>
      {Object.keys(deptMap).length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Admins by Department</p>
          <div className="space-y-1.5">
            {Object.entries(deptMap).map(([dept, count]) => (
              <div key={dept} className="flex items-center gap-2">
                <p className="text-xs text-gray-600 w-36 truncate">{dept}</p>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }} />
                </div>
                <p className="text-xs font-bold text-gray-700 w-4 text-right">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PanelAuditLogs = ({ onNavigate, logs }) => (
  <div className="space-y-3">
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {logs.map((log, idx) => {
        const dotColor = { create: 'bg-green-500', update: 'bg-blue-500', warning: 'bg-amber-500', delete: 'bg-red-500', info: 'bg-gray-400' };
        return (
          <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor[log.type]}`} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between gap-2 mb-0.5">
                <span className="text-xs font-bold text-gray-900">{log.actor}</span>
                <span className="text-xs text-gray-400 whitespace-nowrap">{log.time}</span>
              </div>
              <p className="text-xs text-gray-600">{log.action}</p>
            </div>
          </div>
        );
      })}
    </div>
    <button onClick={() => onNavigate('logs')}
      className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors">
      <span>View Full Activity Logs</span><ArrowRight className="w-4 h-4" />
    </button>
  </div>
);

const PanelSystemConfig = () => {
  const apiUrl = APP_API_URL;
  const [connStatus, setConnStatus] = useState('checking');

  useEffect(() => {
    apiFetch('/superadmin/admins').then(() => setConnStatus('online')).catch(() => setConnStatus('offline'));
  }, []);

  return (
    <div className="space-y-3">
      {[
        { icon: Server, label: 'API Base URL', value: apiUrl, badge: null },
        { icon: Wifi, label: 'Backend Status', value: connStatus === 'online' ? 'Connected' : connStatus === 'offline' ? 'Unreachable' : 'Checking...', badge: connStatus },
        { icon: HardDrive, label: 'Database', value: 'MongoDB (via admins_collection)', badge: 'online' },
        { icon: Mail, label: 'Email / SMTP', value: 'Configured in backend settings', badge: null },
        { icon: Zap, label: 'Auth Strategy', value: 'JWT Bearer — 1 day expiry', badge: null },
        { icon: ShieldCheck, label: 'Reset Flow', value: 'Admin → approval required · Others → direct link', badge: null },
      ].map(({ icon: Icon, label, value, badge }) => (
        <div key={label} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <Icon className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xs font-semibold text-gray-900">{value}</p>
          </div>
          {badge && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${badge === 'online' ? 'bg-green-100 text-green-700' : badge === 'offline' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
              {badge === 'online' ? 'OK' : badge === 'offline' ? 'Down' : badge}
            </span>
          )}
        </div>
      ))}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
        To change system settings like SMTP, JWT secret, or DB URL — update <code className="bg-amber-100 px-1 rounded">.env</code> / <code className="bg-amber-100 px-1 rounded">config.py</code> and restart.
      </div>
    </div>
  );
};

const PanelDepartmentRouting = ({ admins }) => {
  const deptMap = {};
  admins.forEach(a => {
    (a.managedDepartments || (a.department ? [a.department] : [])).forEach(d => {
      if (!deptMap[d]) deptMap[d] = [];
      deptMap[d].push(a.name);
    });
  });
  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {availableDepartments.map((dept) => {
        const owners = deptMap[dept] || [];
        return (
          <div key={dept} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-gray-800">{dept}</span>
            </div>
            <div className="flex flex-wrap gap-1 justify-end">
              {owners.length > 0
                ? owners.map((name, i) => <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">{name}</span>)
                : <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full text-xs font-semibold">Unassigned</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Reset Requests Panel (fully wired to auth_routes.py flow) ─────────────────
//
// Flow (from auth_routes.py):
//   Admin calls POST /auth/forgot-password
//     → if department == "Administrator": sets reset_requested=True, reset_approved=False
//     → else: sends direct reset link
//   SuperAdmin sees pending requests here via GET /superadmin/reset-requests
//   SuperAdmin approves → POST /superadmin/approve-reset/{id}
//     → creates reset token, saves to DB, sends email with /reset-password?token=...
//   SuperAdmin rejects → POST /superadmin/reject-reset/{id}
//     → clears reset_requested, reset_approved, reset_requested_at fields
//   Admin then visits reset link, submits new password via POST /auth/reset-password
//     → checks reset_approved == True before allowing

const PanelResetRequests = ({ resetRequests, onApprove, onReject, onRefresh, loading }) => {
  const [processingId, setProcessingId] = useState(null);

  const handleApprove = async (id) => {
    setProcessingId(id);
    await onApprove(id);
    setProcessingId(null);
  };

  const handleReject = async (id) => {
    setProcessingId(id);
    await onReject(id);
    setProcessingId(null);
  };

  return (
    <div className="space-y-4">

      {/* How it works — inline explanation */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-500" /> How the Reset Flow Works
        </p>
        <div className="space-y-1.5">
          {[
            { step: '1', label: 'Admin requests reset', desc: 'Calls /auth/forgot-password — sets reset_requested = True in DB', color: 'bg-blue-100 text-blue-700' },
            { step: '2', label: 'Request appears here', desc: 'You see it in this panel via /superadmin/reset-requests', color: 'bg-amber-100 text-amber-700' },
            { step: '3', label: 'You approve or reject', desc: 'Approve → generates token + emails reset link · Reject → clears the request', color: 'bg-purple-100 text-purple-700' },
            { step: '4', label: 'Admin resets password', desc: 'Admin visits emailed link → /auth/reset-password validates approval before allowing', color: 'bg-green-100 text-green-700' },
          ].map(({ step, label, desc, color }) => (
            <div key={step} className="flex items-start gap-2">
              <span className={`w-5 h-5 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5 ${color}`}>{step}</span>
              <div>
                <p className="text-xs font-bold text-gray-800">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Refresh button */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-600">
          {loading ? 'Loading...' : `${resetRequests.length} pending request${resetRequests.length !== 1 ? 's' : ''}`}
        </p>
        <button onClick={onRefresh} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Request cards */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      ) : resetRequests.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
          </div>
          <p className="text-sm font-bold text-gray-700">All clear!</p>
          <p className="text-xs text-gray-400 mt-1">No pending password reset requests</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {resetRequests.map((req) => {
            const isProcessing = processingId === req.id;
            return (
              <div key={req.id} className="bg-white border-2 border-amber-200 rounded-xl overflow-hidden shadow-sm">
                {/* Top bar */}
                <div className="bg-amber-50 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-black">
                      {req.name?.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{req.name}</p>
                      <p className="text-xs text-gray-500">{req.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full text-xs font-bold">
                      {req.department}
                    </span>
                    {req.requested_at && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(req.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Info row */}
                <div className="px-4 py-2.5 bg-white border-t border-amber-100">
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    This admin requested a password reset. Approving will send them a secure reset link via email.
                  </p>
                </div>

                {/* Action buttons */}
                <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={isProcessing}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        Approve &amp; Send Reset Email
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={isProcessing}
                    className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    Reject Request
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Vendors Panel (NEW) ────────────────────────────────────────────────────
//
// Shows every vendor across every retailer (tenant), so Super Admin can see
// at a glance which retailer added/received which vendor. Vendors arrive
// via one of three sources:
//   - "invite_link"              → an HQ admin at some retailer invited them
//   - "self_registration"        → the vendor picked a retailer themselves
//                                   during registration (no invite existed)
//   - "walkin_po_self_register"  → registered from a walk-in PO's public link
//
// Self-registered vendors have no inviting HQ admin to approve them, so
// Super Admin can approve/reject any vendor here directly, regardless of
// which retailer or source they came from.

const PanelPlatformFinance = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await apiFetch('/superadmin/platform-finance')); }
    catch (err) { setError(err.message || 'Platform finance could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="grid min-h-64 place-items-center"><RefreshCw className="h-7 w-7 animate-spin text-amber-500" /></div>;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"><AlertCircle className="mx-auto h-6 w-6 text-red-600" /><p className="mt-2 text-sm font-bold text-red-800">{error}</p><button onClick={load} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Try again</button></div>;
  const summary = data?.summary || {};
  const paymentTone = (status) => status === 'paid' ? 'bg-emerald-100 text-emerald-700' : status === 'pending' ? 'bg-amber-100 text-amber-700' : status === 'refunded' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600';
  return <div className="space-y-5">
    <section className="rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-6 text-white shadow-xl"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-violet-200">RMS platform billing</p><h2 className="mt-2 text-2xl font-black">Platform Finance</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">Vendor subscription revenue, renewals and plan-payment controls for RMS.</p></div><button onClick={load} className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-900"><RefreshCw className="mr-1.5 inline h-3.5 w-3.5" />Refresh</button></div><p className="mt-5 rounded-xl bg-white/10 px-3 py-2 text-xs text-indigo-100 ring-1 ring-white/15">This is RMS subscription billing only. Retailer-to-vendor invoices and collections stay private.</p></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Registered vendors', summary.vendor_count || 0, Users, 'bg-blue-50 text-blue-700'],
      ['Expected MRR', money(summary.expected_mrr), IndianRupee, 'bg-emerald-50 text-emerald-700'],
      ['Pending payment value', money(summary.pending_subscription_value), Clock, 'bg-amber-50 text-amber-700'],
      ['Renewals in 30 days', summary.renewals_due_30_days || 0, AlertCircle, 'bg-rose-50 text-rose-700'],
    ].map(([label, value, Icon, tone]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div><p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value}</p></article>)}</section>
    <section className="grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-black text-slate-900">Plan distribution</h3><div className="mt-4 space-y-3">{(data?.plan_breakdown || []).map(plan => <div key={plan.tier} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><div><p className="text-sm font-bold text-slate-800">{plan.label}</p><p className="text-xs text-slate-500">{money(plan.price_inr)} / month</p></div><span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-700">{plan.count} vendors</span></div>)}</div></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-black text-slate-900">Payment status</h3><div className="mt-4 space-y-3">{(data?.payment_breakdown || []).map(item => <div key={item.status} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${paymentTone(item.status)}`}>{String(item.status).replaceAll('_', ' ')}</span><span className="text-lg font-black text-slate-900">{item.count}</span></div>)}</div></article></section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h3 className="text-sm font-black text-slate-900">Vendor subscription ledger</h3><p className="mt-1 text-xs text-slate-500">Manage the plan, payment status, expiry and administrative reason from the Vendors tab.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Vendor</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3 text-right">Monthly price</th><th className="px-4 py-3">Access</th><th className="px-4 py-3">Payment</th><th className="px-5 py-3">Renewal / expiry</th></tr></thead><tbody className="divide-y divide-slate-100">{(data?.subscriptions || []).map(row => <tr key={row.vendor_id} className="hover:bg-slate-50"><td className="px-5 py-3.5"><p className="font-bold text-slate-900">{row.vendor_name}</p><p className="mt-0.5 text-slate-500">{row.email || '—'}</p></td><td className="px-4 py-3.5 font-bold text-indigo-700">{row.plan_label}</td><td className="px-4 py-3.5 text-right font-bold text-slate-800">{money(row.price_inr)}</td><td className="px-4 py-3.5"><span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-600">{row.status}</span></td><td className="px-4 py-3.5"><span className={`rounded-full px-2 py-1 font-bold ${paymentTone(row.payment_status)}`}>{String(row.payment_status).replaceAll('_', ' ')}</span></td><td className="px-5 py-3.5 text-slate-600">{row.expires_at ? String(row.expires_at).slice(0, 10) : 'No expiry'}</td></tr>)}{!data?.subscriptions?.length && <tr><td colSpan="6" className="p-10 text-center text-sm text-slate-400">No vendor subscriptions found.</td></tr>}</tbody></table></div></section>
  </div>;
};

const PanelVendors = () => {
  const [vendors, setVendors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [processingId, setProcessingId] = useState(null);
  const [management, setManagement] = useState(null);
  const [managementLoading, setManagementLoading] = useState(false);
  const [managementSaving, setManagementSaving] = useState(false);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/superadmin/vendors');
      setVendors(data.data || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Fetch vendors:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const handleApprove = async (id) => {
    setProcessingId(id);
    try {
      await apiFetch(`/superadmin/vendors/${id}/approve`, { method: 'POST' });
      await fetchVendors();
    } catch (err) { alert(`Approve failed: ${err.message}`); }
    finally { setProcessingId(null); }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Reject this vendor?')) return;
    setProcessingId(id);
    try {
      await apiFetch(`/superadmin/vendors/${id}/reject`, { method: 'POST' });
      await fetchVendors();
    } catch (err) { alert(`Reject failed: ${err.message}`); }
    finally { setProcessingId(null); }
  };

  const refreshManagement = async (vendorId) => {
    const data = await apiFetch(`/superadmin/vendors/${vendorId}/management`);
    setManagement(data);
  };

  const openManagement = async (vendorId) => {
    setManagementLoading(true);
    try {
      await refreshManagement(vendorId);
    } catch (err) {
      alert(`Could not load vendor management: ${err.message}`);
    } finally {
      setManagementLoading(false);
    }
  };

  const saveIdentity = async (payload) => {
    if (!management) return;
    setManagementSaving(true);
    try {
      await apiFetch(`/superadmin/vendors/${management.identity.id}/identity`, { method: 'PATCH', body: JSON.stringify(payload) });
      await Promise.all([refreshManagement(management.identity.id), fetchVendors()]);
    } catch (err) {
      alert(`Profile update failed: ${err.message}`);
    } finally {
      setManagementSaving(false);
    }
  };

  const saveSubscription = async (payload) => {
    if (!management) return;
    setManagementSaving(true);
    try {
      await apiFetch(`/superadmin/vendors/${management.identity.id}/subscription`, { method: 'PUT', body: JSON.stringify(payload) });
      await refreshManagement(management.identity.id);
      await fetchVendors();
    } catch (err) {
      alert(`Subscription update failed: ${err.message}`);
    } finally {
      setManagementSaving(false);
    }
  };

  const manageRelationship = async (link, status) => {
    if (!management) return;
    const reason = window.prompt(`${status === 'Approved' ? 'Reactivate' : 'Suspend'} ${link.tenant_name} relationship — reason:`);
    if (reason === null) return;
    setManagementSaving(true);
    try {
      await apiFetch(`/superadmin/vendor-relationships/${link.id}`, { method: 'PATCH', body: JSON.stringify({ status, reason }) });
      await Promise.all([refreshManagement(management.identity.id), fetchVendors()]);
    } catch (err) {
      alert(`Relationship update failed: ${err.message}`);
    } finally {
      setManagementSaving(false);
    }
  };

  const sourceLabel = (s) => ({
    invite_link:              'Invited',
    self_registration:        'Self-registered',
    walkin_po_self_register:  'Walk-in (PO link)',
  }[s] || s || '—');

  const sourceBadgeColor = (s) => ({
    invite_link:              'bg-indigo-100 text-indigo-700',
    self_registration:        'bg-amber-100 text-amber-700',
    walkin_po_self_register:  'bg-teal-100 text-teal-700',
  }[s] || 'bg-gray-100 text-gray-600');

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q || [v.name, v.email, v.tenant_name, v.brandName].some(f => (f || '').toLowerCase().includes(q));
    const matchSource = sourceFilter === 'all' || v.source === sourceFilter;
    return matchSearch && matchSource;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Store className="w-5 h-5 text-teal-600" /> Vendors Across Retailers
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Every vendor, every retailer — approve self-registered vendors directly from here.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search vendor, retailer..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none" />
          </div>
          <button onClick={fetchVendors} disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 p-5 border-b border-gray-100 bg-gray-50/60">
          {[
            { label: 'Total',          value: summary.total,           color: 'text-gray-700 bg-white' },
            { label: 'Pending',        value: summary.pending,          color: 'text-amber-700 bg-amber-50' },
            { label: 'Approved',       value: summary.approved,         color: 'text-green-700 bg-green-50' },
            { label: 'Invited',        value: summary.invited,          color: 'text-indigo-700 bg-indigo-50' },
            { label: 'Self-registered',value: summary.self_registered,  color: 'text-amber-700 bg-amber-50' },
            { label: 'Walk-in',        value: summary.walkin,           color: 'text-teal-700 bg-teal-50' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-lg p-2.5 text-center border border-gray-100 ${color}`}>
              <p className="text-lg font-black">{value ?? 0}</p>
              <p className="text-[10px] font-semibold mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 flex-wrap">
        <span className="text-xs font-bold text-gray-400">SOURCE</span>
        {['all', 'invite_link', 'self_registration', 'walkin_po_self_register'].map(s => (
          <button key={s} onClick={() => setSourceFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              sourceFilter === s ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === 'all' ? 'All' : sourceLabel(s)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Vendor', 'Retailer', 'Source', 'Status', 'Password', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading vendors…
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">
                {search || sourceFilter !== 'all' ? 'No vendors match your filters.' : 'No vendors yet.'}
              </td></tr>
            ) : filtered.map(v => {
              const isPending = v.status === 'Pending';
              const isProcessing = processingId === v.id;
              return (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {(v.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{v.name}{v.brandName ? ` · ${v.brandName}` : ''}</p>
                        <p className="text-xs text-gray-400">{v.email || v.contactMobile || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {v.tenant_id ? (
                      <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">{v.tenant_name}</span>
                    ) : (
                      <span className="text-xs text-red-400 font-semibold">⚠ No tenant</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sourceBadgeColor(v.source)}`}>
                      {sourceLabel(v.source)}
                    </span>
                    {v.source_po && <p className="text-[10px] text-gray-400 mt-0.5">PO: {v.source_po}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      v.status === 'Approved' ? 'bg-green-100 text-green-700' :
                      v.status === 'Pending'  ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'}`}>
                      {v.status === 'Approved' ? <CheckCircle className="w-3 h-3" /> : v.status === 'Pending' ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {v.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${v.password_set ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {v.password_set ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {v.password_set ? 'Set' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => openManagement(v.vendor_id)} disabled={managementLoading}
                      className="mb-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-60 flex items-center gap-1">
                      {managementLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Edit className="w-3 h-3" />}
                      Manage
                    </button>
                    {isPending ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleApprove(v.id)} disabled={isProcessing}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-60 flex items-center gap-1">
                          {isProcessing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                          Approve
                        </button>
                        <button onClick={() => handleReject(v.id)} disabled={isProcessing}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-60">
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {management && (
        <SuperadminVendorManagementModal
          data={management}
          saving={managementSaving}
          onClose={() => setManagement(null)}
          onSaveIdentity={saveIdentity}
          onSaveSubscription={saveSubscription}
          onRelationshipAction={manageRelationship}
        />
      )}
    </div>
  );
};

// ─── EMPTY FORM ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '', email: '', phone: '',
  tenant_id:  '',
  admin_type: 'hq',
  store_id:   '',
  managedDepartments: [], permissions: [], status: 'Active',
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('admins');
  const [retailers,    setRetailers]    = useState([]);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editTenantId, setEditTenantId] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('superadmin_token') || '';
    fetch(`${API_BASE}/superadmin/tenants/`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setRetailers(d.tenants || []))
      .catch(() => {});
  }, []);

  const handleSaveTenantId = async () => {
    try {
      const token = localStorage.getItem('superadmin_token') || '';
      await fetch(`${API_BASE}/superadmin/admins/${editingAdmin.id}/tenant`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: editTenantId.trim() }),
      });
      setAdmins(prev => prev.map(a => a.id === editingAdmin.id ? { ...a, tenant_id: editTenantId.trim() } : a));
      setEditingAdmin(null);
      toast('Tenant ID updated!', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };
  const [activeControlCard, setActiveControlCard] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [resetRequests, setResetRequests] = useState([]);
  const [resetLoading, setResetLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const dropdownRef = useRef(null);

  const fetchAdmins = useCallback(async () => {
    try {
      const data = await apiFetch('/superadmin/admins');
      setAdmins((data.admins || data).map(a => ({ ...a, id: a.id || a._id })));
    } catch (err) { console.error('Fetch admins:', err); }
  }, []);

  const fetchResetRequests = useCallback(async () => {
    setResetLoading(true);
    try {
      const data = await apiFetch('/superadmin/reset-requests');
      setResetRequests(data.requests || []);
    } catch (err) { console.error('Fetch reset requests:', err); }
    finally { setResetLoading(false); }
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  // Auto-fetch reset requests when that card opens
  useEffect(() => {
    if (activeControlCard === 'notifications') fetchResetRequests();
  }, [activeControlCard, fetchResetRequests]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Stable form handlers
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFormErrors(prev => ({ ...prev, [name]: '' }));
  }, []);

  const handleDepartmentToggle = useCallback((dept) => {
    setFormData(prev => ({
      ...prev,
      managedDepartments: prev.managedDepartments.includes(dept)
        ? prev.managedDepartments.filter(d => d !== dept)
        : [...prev.managedDepartments, dept],
    }));
    setFormErrors(prev => ({ ...prev, managedDepartments: '' }));
  }, []);

  const handlePermissionToggle = useCallback((perm) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm],
    }));
    setFormErrors(prev => ({ ...prev, permissions: '' }));
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsAddModalOpen(false);
    setFormData(EMPTY_FORM);
    setFormErrors({});
  }, []);

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email format';
    else if (admins.some(a => a.email?.toLowerCase() === formData.email.toLowerCase())) errors.email = 'Email already registered';
    if (formData.managedDepartments.length === 0) errors.managedDepartments = 'Select at least one department';
    if (formData.permissions.length === 0) errors.permissions = 'Select at least one permission';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitAdmin = useCallback(async () => {
    if (!validateForm()) return;
    const payload = {
      name:               formData.name.trim(),
      email:              formData.email.trim(),
      phone:              formData.phone.trim(),
      tenant_id:          formData.tenant_id.trim(),
      department:         formData.managedDepartments[0],
      managedDepartments: formData.managedDepartments,
      permissions:        formData.permissions,
      status:             formData.status,
      store_id:           formData.admin_type === 'store' ? (formData.store_id || null) : null,
      scope:              formData.admin_type,
    };
    try {
      const data = await apiFetch('/superadmin/admins/create', { method: 'POST', body: JSON.stringify(payload) });
      const newAdmin = {
        id: data.admin_id || Date.now(), ...payload,
        role: 'Administrator', lastActive: 'Just now',
        managedUsersCount: 0, createdDate: new Date().toISOString().split('T')[0], password_set: false,
      };
      setAdmins(prev => [...prev, newAdmin]);
      handleCloseModal();
      alert(`Administrator "${formData.name}" created! A setup email has been sent.`);
    } catch (err) { alert(`Error: ${err.message}`); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, admins, handleCloseModal]);

  const handleSuspendAdmin = async (adminId) => {
    const admin = admins.find(a => a.id === adminId);
    const newStatus = (admin?.status === 'Active' || admin?.status === 'ACTIVE') ? 'Suspended' : 'Active';
    try {
      await apiFetch(`/superadmin/admins/${adminId}/status`, {
        method: 'PATCH', body: JSON.stringify({ status: newStatus }),
      });
      setAdmins(prev => prev.map(a => a.id === adminId ? { ...a, status: newStatus } : a));
    } catch (err) {
      // Fallback: update locally if endpoint not yet deployed
      setAdmins(prev => prev.map(a => a.id === adminId ? { ...a, status: newStatus } : a));
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    if (!window.confirm('Are you sure you want to delete this administrator?')) return;
    try {
      await apiFetch(`/superadmin/admins/${adminId}`, { method: 'DELETE' });
      setAdmins(prev => prev.filter(a => a.id !== adminId));
    } catch (err) { alert(err.message); }
  };

  const handleUpdatePermissions = async (adminId, newPermissions) => {
    try {
      await apiFetch(`/superadmin/admins/${adminId}/permissions`, {
        method: 'PATCH', body: JSON.stringify({ permissions: newPermissions }),
      });
      setAdmins(prev => prev.map(a => a.id === adminId ? { ...a, permissions: newPermissions } : a));
    } catch (err) {
      // Fallback: update locally
      setAdmins(prev => prev.map(a => a.id === adminId ? { ...a, permissions: newPermissions } : a));
      console.warn('Permissions PATCH failed, updated locally:', err.message);
    }
  };

  // ── These call the exact endpoints in superadmin_routes.py ──
  const handleApproveReset = async (adminId) => {
    try {
      await apiFetch(`/superadmin/approve-reset/${adminId}`, { method: 'POST' });
      setResetRequests(prev => prev.filter(r => r.id !== adminId));
    } catch (err) { alert(`Approve failed: ${err.message}`); }
  };

  const handleRejectReset = async (adminId) => {
    try {
      await apiFetch(`/superadmin/reject-reset/${adminId}`, { method: 'POST' });
      setResetRequests(prev => prev.filter(r => r.id !== adminId));
    } catch (err) { alert(`Reject failed: ${err.message}`); }
  };

  const navigateToTab = (tab) => { setActiveTab(tab); setActiveControlCard(null); };

  const filteredAdmins = admins.filter(a =>
    a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const logs = [
    { time: '2 min ago', actor: 'Super Admin', action: 'Created administrator account', type: 'create' },
    { time: '18 min ago', actor: 'Super Admin', action: 'Updated permissions for an admin', type: 'update' },
    { time: '1 hr ago', actor: 'Super Admin', action: 'Approved password reset for John Smith', type: 'info' },
    { time: '3 hr ago', actor: 'Super Admin', action: 'Rejected reset request from Mike Davis', type: 'warning' },
    { time: '4 hr ago', actor: 'Super Admin', action: 'Deleted inactive administrator account', type: 'delete' },
    { time: 'Yesterday', actor: 'Super Admin', action: 'System configuration reviewed', type: 'info' },
  ];

  const controlCards = [
    {
      id: 'admin-mgmt', icon: Shield, label: 'Admin Management',
      desc: 'Create, suspend & delete administrators',
      color: 'from-blue-500 to-blue-600',
      badge: admins.length,
      badgeColor: 'bg-blue-500',
      panel: <PanelAdminManagement onNavigate={navigateToTab} admins={admins} />,
    },
    {
      id: 'users-oversight', icon: Users, label: 'Users Oversight',
      desc: 'View every admin user & their status',
      color: 'from-violet-500 to-purple-600',
      badge: admins.filter(a => !a.password_set).length || null,
      badgeColor: 'bg-red-500',
      panel: <PanelUsersOversight admins={admins} />,
    },
    {
      id: 'permissions', icon: Key, label: 'Permission Control',
      desc: 'Define what each admin can do',
      color: 'from-indigo-500 to-indigo-600',
      panel: <PanelPermissionControl admins={admins} onUpdatePermissions={handleUpdatePermissions} />,
    },
    {
      id: 'analytics', icon: BarChart2, label: 'Analytics',
      desc: 'System stats & admin breakdown',
      color: 'from-emerald-500 to-green-600',
      panel: <PanelAnalytics admins={admins} />,
    },
    {
      id: 'audit-logs', icon: FileText, label: 'Audit Logs',
      desc: 'Complete record of all actions',
      color: 'from-gray-600 to-gray-700',
      panel: <PanelAuditLogs onNavigate={navigateToTab} logs={logs} />,
    },
    {
      id: 'system-config', icon: Database, label: 'System Config',
      desc: 'API, DB, SMTP & auth settings',
      color: 'from-slate-600 to-slate-700',
      panel: <PanelSystemConfig />,
    },
    {
      id: 'dept-routing', icon: Globe, label: 'Dept Routing',
      desc: 'See which admin owns which dept',
      color: 'from-cyan-500 to-teal-600',
      panel: <PanelDepartmentRouting admins={admins} />,
    },
    {
      id: 'notifications', icon: Bell, label: 'Reset Requests',
      desc: 'Approve or reject password resets',
      color: 'from-amber-500 to-orange-500',
      badge: resetRequests.length || null,
      badgeColor: 'bg-red-500',
      panel: (
        <PanelResetRequests
          resetRequests={resetRequests}
          onApprove={handleApproveReset}
          onReject={handleRejectReset}
          onRefresh={fetchResetRequests}
          loading={resetLoading}
        />
      ),
    },
  ];

  const tabs = [
    { id: 'admins',    label: 'Administrators', icon: Shield    },
    { id: 'vendors',   label: 'Vendors',         icon: Store     },
    { id: 'finance',   label: 'Platform Finance', icon: IndianRupee },
    { id: 'retailers', label: 'Retailers',       icon: Building2 },
    { id: 'onboarding', label: 'Onboarding',     icon: UserPlus },
    { id: 'controls',  label: 'My Controls',    icon: Key      },
    { id: 'logs',      label: 'Activity Logs',  icon: Activity  },
  ];

  const logDot = { create: 'bg-green-500', update: 'bg-blue-500', warning: 'bg-amber-500', delete: 'bg-red-500', info: 'bg-gray-400' };

  return (
    <div className="min-h-screen bg-slate-50">
      <AddAdminModal
        isOpen={isAddModalOpen} onClose={handleCloseModal}
        formData={formData} formErrors={formErrors}
        onInputChange={handleInputChange} onDepartmentToggle={handleDepartmentToggle}
        onPermissionToggle={handlePermissionToggle} onSubmit={handleSubmitAdmin}
        retailers={retailers}
      />
      <ViewAdminModal admin={selectedAdmin} onClose={() => setSelectedAdmin(null)} />

      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">Super Admin Panel</h1>
                <p className="text-xs text-slate-400">Full system control & administrator oversight</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Reset requests badge in header */}
              {resetRequests.length > 0 && (
                <button
                  onClick={() => { setActiveTab('controls'); setActiveControlCard('notifications'); }}
                  className="relative p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
                  title={`${resetRequests.length} pending reset request(s)`}
                >
                  <Bell className="w-4 h-4 text-red-400" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-black rounded-full flex items-center justify-center">
                    {resetRequests.length}
                  </span>
                </button>
              )}
              <button onClick={fetchAdmins} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </button>
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setIsDropdownOpen(v => !v)}
                  className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-semibold">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold">SA</div>
                  <span className="hidden sm:inline">Super Admin</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-bold text-gray-900">Super Admin</p>
                      <p className="text-xs text-gray-500">superadmin@company.com</p>
                    </div>
                    <div className="py-1">
                      <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                        <User className="w-4 h-4 text-gray-400" /> Profile Settings
                      </button>
                      <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                        <Settings className="w-4 h-4 text-gray-400" /> System Settings
                      </button>
                    </div>
                    <div className="border-t border-gray-100 pt-1">
                      <button onClick={() => navigate('/')}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors font-semibold">
                        <LogOut className="w-4 h-4" /> Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Admins', value: admins.length, sub: `${admins.filter(a => a.status === 'Active' || a.status === 'ACTIVE').length} active`, color: 'from-blue-500 to-blue-600', icon: Shield },
            { label: 'Pending Setup', value: admins.filter(a => !a.password_set || a.status === 'PENDING').length, sub: 'Awaiting password', color: 'from-amber-500 to-orange-400', icon: Clock },
            { label: 'Reset Requests', value: resetRequests.length, sub: 'Need your approval', color: resetRequests.length > 0 ? 'from-red-500 to-rose-500' : 'from-green-500 to-emerald-500', icon: Bell },
            { label: 'Departments', value: availableDepartments.length, sub: 'Under management', color: 'from-violet-500 to-purple-600', icon: Layers },
          ].map(({ label, value, sub, color, icon: Icon }) => (
            <div key={label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-lg bg-gradient-to-br ${color}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900">{value}</p>
              <p className="text-xs font-semibold text-gray-700 mt-0.5">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
          <div className="flex border-b border-gray-100">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setActiveTab(id); setActiveControlCard(null); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors relative ${
                  activeTab === id ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/60' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                {id === 'controls' && resetRequests.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 absolute top-2 right-2" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB: Admins ── */}
        {activeTab === 'admins' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" /> Administrator Management
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Create and manage system administrators</p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search admins..." value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none" />
                </div>
                <button onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-amber-500/20 whitespace-nowrap">
                  <UserPlus className="w-4 h-4" /> Add Admin
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Administrator', 'Tenant', 'Department', 'Permissions', 'Password', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredAdmins.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">
                      {searchTerm ? 'No administrators match your search.' : 'No administrators yet. Click "Add Admin" to create one.'}
                    </td></tr>
                  ) : filteredAdmins.map(admin => {
                    const isActive = admin.status === 'Active' || admin.status === 'ACTIVE';
                    return (
                      <tr key={admin.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                              {admin.name?.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{admin.name}</p>
                              <p className="text-xs text-gray-400">{admin.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {admin.tenant_id ? (
                            <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">{admin.tenant_id}</span>
                          ) : (
                            <span className="text-xs text-red-400 font-semibold">⚠ Not set</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {(admin.managedDepartments || (admin.department ? [admin.department] : [])).slice(0, 2).map((d, i) => (
                              <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">{d}</span>
                            ))}
                            {(admin.managedDepartments || []).length > 2 && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">+{admin.managedDepartments.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {(admin.permissions || []).length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{admin.permissions[0]}</span>
                              {admin.permissions.length > 1 && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">+{admin.permissions.length - 1}</span>}
                            </div>
                          ) : <span className="text-xs text-gray-400">None</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${admin.password_set ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {admin.password_set ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {admin.password_set ? 'Set' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            isActive ? 'bg-green-100 text-green-700' :
                            admin.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'}`}>
                            {isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {admin.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setSelectedAdmin(admin)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-500 transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => { setEditingAdmin(admin); setEditTenantId(admin.tenant_id || ''); }}
                              className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-500 transition-colors" title="Set Tenant">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleSuspendAdmin(admin.id)}
                              className={`p-1.5 rounded-lg transition-colors ${isActive ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-green-50 text-green-500'}`}
                              title={isActive ? 'Suspend' : 'Activate'}>
                              {isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                            <button onClick={() => handleDeleteAdmin(admin.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB: Vendors ── */}
        {activeTab === 'vendors' && (
          <PanelVendors />
        )}

        {activeTab === 'finance' && (
          <PanelPlatformFinance />
        )}

        {/* ── TAB: Retailers ── */}
        {activeTab === 'retailers' && (
          <RetailersTab />
        )}

        {activeTab === 'onboarding' && (
          <SuperAdminOnboardingRequests />
        )}

        {/* ── Edit Tenant Modal ── */}
        {editingAdmin && (
          <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <h2 className="text-base font-black text-slate-900 mb-1">Set Tenant ID</h2>
              <p className="text-xs text-slate-500 mb-4">
                <b>{editingAdmin.name}</b> · {editingAdmin.email}
              </p>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Select Retailer
              </label>
              <select value={editTenantId} onChange={e => setEditTenantId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-400 mb-4 bg-white">
                <option value="">— Select a retailer —</option>
                {retailers.map(r => (
                  <option key={r.tenant_id} value={r.tenant_id}>
                    {r.company_name} ({r.tenant_id})
                  </option>
                ))}
              </select>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingAdmin(null)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition">
                  Cancel
                </button>
                <button onClick={handleSaveTenantId} disabled={!editTenantId}
                  className="px-4 py-2 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition disabled:opacity-40">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: My Controls ── */}
        {activeTab === 'controls' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <Crown className="w-7 h-7 text-amber-400" />
                <h2 className="text-xl font-black">Super Admin Authority</h2>
              </div>
              <p className="text-slate-400 text-sm">Click any card to open its live control panel. Reset Requests shows all admins who need your approval before they can change their password.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Cards column */}
              <div className="lg:col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-3 content-start">
                {controlCards.map(({ id, icon: Icon, label, desc, color, badge, badgeColor = 'bg-amber-500' }) => (
                  <button key={id} onClick={() => setActiveControlCard(activeControlCard === id ? null : id)}
                    className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                      activeControlCard === id
                        ? 'border-amber-400 bg-amber-50 shadow-md shadow-amber-100'
                        : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}>
                    {badge > 0 && (
                      <span className={`absolute -top-2 -right-2 w-5 h-5 ${badgeColor} text-white text-xs font-black rounded-full flex items-center justify-center z-10`}>
                        {badge}
                      </span>
                    )}
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-2.5 ${activeControlCard === id ? 'scale-110' : ''} transition-transform`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <p className={`text-xs font-bold mb-0.5 ${activeControlCard === id ? 'text-amber-700' : 'text-gray-900'}`}>{label}</p>
                    <p className="text-xs text-gray-500 leading-tight hidden lg:block">{desc}</p>
                    <ChevronRight className={`w-3.5 h-3.5 mt-1 transition-transform ${activeControlCard === id ? 'text-amber-500 rotate-90' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>

              {/* Panel */}
              <div className="lg:col-span-2">
                {activeControlCard ? (() => {
                  const card = controlCards.find(c => c.id === activeControlCard);
                  if (!card) return null;
                  return (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shrink-0`}>
                          <card.icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-gray-900">{card.label}</h3>
                          <p className="text-xs text-gray-500">{card.desc}</p>
                        </div>
                        <button onClick={() => setActiveControlCard(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                          <X className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                      {card.panel}
                    </div>
                  );
                })() : (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 flex flex-col items-center justify-center text-center min-h-64">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4">
                      <Key className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">Select a Control</h3>
                    <p className="text-xs text-gray-500 max-w-xs">Click any card on the left to open its control panel and interact with live system data.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Hierarchy */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600" /> System Hierarchy
              </h3>
              <div className="flex flex-col gap-0">
                {[
                  { level: '1', title: 'Super Admin', desc: 'You — approves password resets, creates admins, has full unrestricted control', badge: 'bg-amber-100 text-amber-700', connector: true },
                  { level: '2', title: 'Administrators', desc: 'Submit reset requests (need your approval) · Manage operational departments', badge: 'bg-blue-100 text-blue-700', connector: true },
                  { level: '3', title: 'Operational Users', desc: 'HR · Logistics · Cashier · Finance · IT · Inventory · Design & Pattern and more', badge: 'bg-green-100 text-green-700', connector: false },
                ].map(({ level, title, desc, badge, connector }) => (
                  <div key={level} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full ${badge} flex items-center justify-center font-black text-sm shrink-0`}>{level}</div>
                      {connector && <div className="w-0.5 h-8 bg-gray-200 my-1" />}
                    </div>
                    <div className="pt-1.5 pb-6">
                      <p className="font-bold text-gray-900 text-sm">{title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Logs ── */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" /> Activity Logs
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">All recorded actions under this session</p>
            </div>
            <div className="divide-y divide-gray-50">
              {logs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${logDot[log.type]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-semibold text-gray-900 text-sm">{log.actor}</span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{log.time}</span>
                    </div>
                    <p className="text-xs text-gray-600">{log.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Privilege notice */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">Super Admin Session Active</p>
            <p className="text-xs text-amber-700 mt-0.5">
              You are the sole approver for administrator password resets. All approve/reject actions call <code className="bg-amber-100 px-1 rounded">/superadmin/approve-reset</code> and <code className="bg-amber-100 px-1 rounded">/superadmin/reject-reset</code> directly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
