import React, { useCallback, useEffect, useState } from "react";
import { BarChart2, Building2, KeyRound, Loader2, Save, ShieldCheck, UserRound } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";
import RetailerVerification from "../shared/RetailerVerification.jsx";
import TeamUsageAnalytics from "../shared/TeamUsageAnalytics.jsx";

const token = () => localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
const jsonHeaders = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

const api = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}/admin/settings${path}`, {
    ...options,
    headers: { ...jsonHeaders(), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Could not save settings.");
  return body;
};

const input = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500";
const Label = ({ children, ...props }) => <label className="block text-xs font-bold text-slate-600">{children}<input {...props} className={input}/></label>;

export default function AdminSettings() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("account");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState({});
  const [organisation, setOrganisation] = useState({});
  const [password, setPassword] = useState({ current_password: "", new_password: "", confirm: "" });

  const load = useCallback(async () => {
    try {
      setError("");
      const next = await api("");
      setData(next);
      setProfile(next.profile || {});
      setOrganisation(next.organisation || {});
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveProfile = async () => { try { setBusy(true); setError(""); const response = await api("/profile", { method: "PATCH", body: JSON.stringify(profile) }); setMessage(response.message); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const savePassword = async () => { if (password.new_password !== password.confirm) return setError("New password and confirmation do not match."); try { setBusy(true); setError(""); const response = await api("/password", { method: "PATCH", body: JSON.stringify({ current_password: password.current_password, new_password: password.new_password }) }); setMessage(response.message); setPassword({ current_password: "", new_password: "", confirm: "" }); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const saveOrganisation = async () => { try { setBusy(true); setError(""); const response = await api("/organisation", { method: "PUT", body: JSON.stringify(organisation) }); setMessage(response.message); setOrganisation(response.organisation || organisation); } catch (e) { setError(e.message); } finally { setBusy(false); } };

  if (!data && !error) return <div className="grid min-h-[360px] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-indigo-600"/></div>;
  const access = data?.access || {};
  const canManageOrg = Boolean(data?.can_manage_organisation);
  const tabs = [["account", UserRound, "My account"], ["access", ShieldCheck, "Access"], ["security", KeyRound, "Security"], ...(canManageOrg ? [["organisation", Building2, "Organisation"], ["verification", ShieldCheck, "Verification"], ["usage", BarChart2, "Usage Analytics"]] : [])];

  return <div className="min-h-full bg-slate-50 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-5xl space-y-5">
    <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-800 p-6 text-white shadow-xl"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-indigo-200">Role-aware configuration</p><h1 className="mt-2 text-2xl font-black">Settings</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-100">Your account settings are private. Organisation and verification settings apply to this retailer tenant, including Basic single-store tenants.</p></section>
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{tabs.map(([key, Icon, label]) => <button key={key} onClick={() => setTab(key)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${tab === key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Icon className="h-4 w-4"/>{label}</button>)}</div>
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div>}{error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}

    {tab === "account" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><UserRound className="h-5 w-5 text-indigo-600"/><div><h2 className="font-black text-slate-900">My profile and notifications</h2><p className="text-sm text-slate-500">These details identify you in RMS records and notifications.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Label value={profile.name || ""} onChange={e => setProfile({ ...profile, name: e.target.value })}>Full name</Label><Label value={profile.email || ""} disabled>Email</Label><Label value={profile.phone || ""} onChange={e => setProfile({ ...profile, phone: e.target.value })}>Phone</Label><Label value={profile.city || ""} onChange={e => setProfile({ ...profile, city: e.target.value })}>City</Label></div><div className="mt-5 flex flex-wrap gap-4"><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={Boolean(profile.notification_email)} onChange={e => setProfile({ ...profile, notification_email: e.target.checked })}/> Email notifications</label><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={Boolean(profile.notification_whatsapp)} onChange={e => setProfile({ ...profile, notification_whatsapp: e.target.checked })}/> WhatsApp notifications</label></div><button disabled={busy} onClick={saveProfile} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"><Save className="h-4 w-4"/>Save profile</button></section>}
    {tab === "access" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-900">Your assigned access</h2><p className="mt-1 text-sm text-slate-500">Only an HQ admin can change department assignments and permissions.</p><div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-indigo-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-indigo-500">Scope</p><p className="mt-1 font-black text-indigo-950">{access.scope === "hq" ? "HQ admin" : `Store admin${access.store_name ? ` ? ${access.store_name}` : ""}`}</p></div><div className="rounded-xl bg-slate-50 p-4 sm:col-span-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Departments</p><div className="mt-2 flex flex-wrap gap-2">{(access.managed_departments || [access.department]).map(value => <span key={value} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{value}</span>)}</div></div></div><div className="mt-4 rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Permissions</p><div className="mt-2 flex flex-wrap gap-2">{(access.permissions || []).length ? access.permissions.map(value => <span key={value} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{value}</span>) : <span className="text-sm text-slate-500">Standard department access</span>}</div></div></section>}
    {tab === "security" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-900">Change password</h2><p className="mt-1 text-sm text-slate-500">Use at least 8 characters. Your current password is required.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Label type="password" value={password.current_password} onChange={e => setPassword({ ...password, current_password: e.target.value })}>Current password</Label><div className="hidden sm:block"/><Label type="password" value={password.new_password} onChange={e => setPassword({ ...password, new_password: e.target.value })}>New password</Label><Label type="password" value={password.confirm} onChange={e => setPassword({ ...password, confirm: e.target.value })}>Confirm new password</Label></div><button disabled={busy} onClick={savePassword} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"><KeyRound className="h-4 w-4"/>Update password</button></section>}
    {tab === "organisation" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-900">Organisation and document settings</h2><p className="mt-1 text-sm text-slate-500">HQ-only. Controls tenant identity and default document labels; existing document numbers are not changed.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Label value={organisation.legal_name || ""} onChange={e => setOrganisation({ ...organisation, legal_name: e.target.value })}>Legal business name</Label><Label value={organisation.gstin || ""} onChange={e => setOrganisation({ ...organisation, gstin: e.target.value })}>GSTIN</Label><Label value={organisation.currency || "INR"} onChange={e => setOrganisation({ ...organisation, currency: e.target.value.toUpperCase() })}>Currency</Label><Label value={organisation.timezone || "Asia/Kolkata"} onChange={e => setOrganisation({ ...organisation, timezone: e.target.value })}>Timezone</Label><Label type="number" value={organisation.financial_year_start_month || 4} onChange={e => setOrganisation({ ...organisation, financial_year_start_month: Number(e.target.value) })}>Financial year starts (month 1-12)</Label><Label value={organisation.po_prefix || "PO"} onChange={e => setOrganisation({ ...organisation, po_prefix: e.target.value })}>PO prefix</Label><Label value={organisation.grn_prefix || "GRN"} onChange={e => setOrganisation({ ...organisation, grn_prefix: e.target.value })}>GRN prefix</Label><Label value={organisation.invoice_prefix || "PI"} onChange={e => setOrganisation({ ...organisation, invoice_prefix: e.target.value })}>Purchase invoice prefix</Label></div><label className="mt-4 block text-xs font-bold text-slate-600">Business address<textarea value={organisation.address || ""} onChange={e => setOrganisation({ ...organisation, address: e.target.value })} className={`${input} min-h-24`} /></label><button disabled={busy} onClick={saveOrganisation} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"><Building2 className="h-4 w-4"/>Save organisation settings</button></section>}
    {tab === "verification" && <RetailerVerification onSaved={setMessage} />}
    {tab === "usage" && <TeamUsageAnalytics />}
  </div></div>;
}
