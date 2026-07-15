import { API_BASE_URL } from "../../config/api.js";
import React, { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck, Building2, Check, ChevronLeft, ChevronRight, Clock3,
  Globe2, Link2, Loader2, Mail, MapPin, Search, Send, Settings2,
  ShieldCheck, Store, UsersRound, X,
} from "lucide-react";

const BUSINESS_TYPES = [
  ["", "All business types"], ["general_vendor", "General vendor"], ["wholesaler", "Wholesaler"],
  ["manufacturer", "Manufacturer"], ["distributor", "Distributor"],
  ["exporter", "Exporter"], ["fabric_supplier", "Fabric supplier"],
  ["retailer", "Retailer / store owner"],
];

const TYPE_LABELS = Object.fromEntries(BUSINESS_TYPES);

function token() {
  return localStorage.getItem("vendor_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/business-network${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Request failed");
  return data;
}

function BusinessAvatar({ name }) {
  return <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-600 text-lg font-black text-white shadow-sm">{(name || "B")[0].toUpperCase()}</div>;
}

function StatusBadge({ status }) {
  const style = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
    declined: "bg-rose-50 text-rose-700 border-rose-200",
    cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  }[status] || "bg-slate-100 text-slate-600 border-slate-200";
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${style}`}>{status}</span>;
}

export default function BusinessNetwork() {
  const [tab, setTab] = useState("discover");
  const [visibility, setVisibility] = useState({ marketplace_visible: false, headline: "", description: "" });
  const [filters, setFilters] = useState({ q: "", business_type: "", location: "" });
  const [result, setResult] = useState({ data: [], total: 0, page: 1, pages: 1, subscription: {} });
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connectTarget, setConnectTarget] = useState(null);
  const [connectionMessage, setConnectionMessage] = useState("");

  const loadDiscover = useCallback(async (page = 1, nextFilters = filters) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page) });
      Object.entries(nextFilters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
      setResult(await api(`/discover?${params.toString()}`));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [filters]);

  const loadConnections = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await api("/connections"); setConnections(data.data || []); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  const loadVisibility = useCallback(async () => {
    try { setVisibility(await api("/me/visibility")); }
    catch (err) { setError(err.message); }
  }, []);

  useEffect(() => { loadVisibility(); loadDiscover(1); }, []);
  useEffect(() => { if (tab === "connections") loadConnections(); }, [tab, loadConnections]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };

  const saveVisibility = async () => {
    setSaving(true); setError("");
    try {
      await api("/me/visibility", { method: "PATCH", body: JSON.stringify(visibility) });
      showNotice(visibility.marketplace_visible ? "Your public business profile is now visible." : "Your profile is hidden from discovery.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const sendConnection = async () => {
    if (!connectTarget) return;
    setSaving(true); setError("");
    try {
      await api("/connections", { method: "POST", body: JSON.stringify({ target_vendor_id: connectTarget.vendor_id, message: connectionMessage }) });
      setResult(current => ({ ...current, data: current.data.map(item => item.vendor_id === connectTarget.vendor_id ? { ...item, connection_status: "pending" } : item) }));
      setConnectTarget(null); setConnectionMessage(""); showNotice("Connection request sent.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const updateConnection = async (connectionId, action) => {
    setSaving(true); setError("");
    try {
      await api(`/connections/${connectionId}`, { method: "PATCH", body: JSON.stringify({ action }) });
      await loadConnections(); showNotice(`Connection ${action === "accept" ? "accepted" : action === "decline" ? "declined" : "cancelled"}.`);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-teal-950 to-indigo-950 p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Globe2 className="h-6 w-6 text-teal-300" /></div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Business Network</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Discover verified suppliers and trading partners. Private contact details unlock only after a connection is accepted.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-teal-300">Your network plan</p>
              <p className="mt-1 text-lg font-black">{result.subscription?.label || "Free"}</p>
              <p className="text-xs text-slate-400">{result.subscription?.monthly_request_limit == null ? "Unlimited requests" : `${result.subscription?.monthly_request_limit || 3} requests / month`}</p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {[["discover", Search, "Discover"], ["connections", UsersRound, "Connections"], ["visibility", Settings2, "My visibility"]].map(([key, Icon, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === key ? "bg-teal-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}

        {tab === "discover" && (
          <>
            <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_220px_auto]">
              <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} placeholder="Products, category or business name" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" /></div>
              <select value={filters.business_type} onChange={e => setFilters({ ...filters, business_type: e.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500">{BUSINESS_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <div className="relative"><MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={filters.location} onChange={e => setFilters({ ...filters, location: e.target.value })} placeholder="City or state" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-teal-500" /></div>
              <button onClick={() => loadDiscover(1)} className="h-11 rounded-xl bg-teal-600 px-5 text-sm font-bold text-white hover:bg-teal-700">Search</button>
            </section>

            {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-teal-600" /></div> : result.data.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center"><Building2 className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-bold text-slate-700">No public businesses found</p><p className="mt-1 text-sm text-slate-400">Businesses must opt in before they appear here.</p></div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {result.data.map(business => (
                  <article key={business.vendor_id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start gap-3"><BusinessAvatar name={business.name} /><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><h2 className="truncate font-black text-slate-900">{business.name}</h2>{business.featured_badge && <BadgeCheck className="h-4 w-4 shrink-0 text-blue-600" />}</div><p className="truncate text-xs text-slate-400">{business.brand_name || business.headline || "B2B supplier"}</p></div></div>
                    <div className="mt-4 flex flex-wrap gap-1.5">{business.business_type.map(type => <span key={type} className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-700">{TYPE_LABELS[type] || type}</span>)}</div>
                    <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">{business.description || business.product_categories.join(", ") || "Business profile available for new B2B connections."}</p>
                    <div className="mt-3 flex items-center gap-1 text-xs text-slate-400"><MapPin className="h-3.5 w-3.5" />{[business.city, business.state].filter(Boolean).join(", ") || "Location not provided"}</div>
                    <div className="mt-auto pt-5">{business.connection_status ? <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span className="text-xs font-semibold text-slate-500">Connection</span><StatusBadge status={business.connection_status} /></div> : <button onClick={() => setConnectTarget(business)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-teal-700"><Link2 className="h-4 w-4" />Connect</button>}</div>
                  </article>
                ))}
              </div>
            )}

            {result.pages > 1 && <div className="flex items-center justify-center gap-3"><button disabled={result.page <= 1} onClick={() => loadDiscover(result.page - 1)} className="rounded-lg border bg-white p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="text-sm font-bold text-slate-600">Page {result.page} of {result.pages}</span><button disabled={result.page >= result.pages} onClick={() => loadDiscover(result.page + 1)} className="rounded-lg border bg-white p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div>}
          </>
        )}

        {tab === "connections" && (loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-teal-600" /></div> : connections.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">No connection requests yet.</div> : <div className="space-y-3">{connections.map(item => <article key={item.connection_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><BusinessAvatar name={item.business.name} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-black text-slate-900">{item.business.name}</h2><StatusBadge status={item.status} /><span className="text-[10px] font-bold uppercase text-slate-400">{item.direction}</span></div><p className="mt-1 text-xs text-slate-500">{item.message || "Business connection request"}</p>{item.business.contact && <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-teal-700"><span className="flex items-center gap-1"><Mail className="h-3 w-3" />{item.business.contact.email || "Email not provided"}</span><span>{item.business.contact.mobile}</span></div>}</div>{item.status === "pending" && <div className="flex gap-2">{item.direction === "incoming" ? <><button disabled={saving} onClick={() => updateConnection(item.connection_id, "accept")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Accept</button><button disabled={saving} onClick={() => updateConnection(item.connection_id, "decline")} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600">Decline</button></> : <button disabled={saving} onClick={() => updateConnection(item.connection_id, "cancel")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Cancel request</button>}</div>}</div></article>)}</div>)}

        {tab === "visibility" && <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-teal-600" /><h2 className="font-black text-slate-900">Public business profile</h2></div><p className="mt-2 text-sm leading-6 text-slate-500">Opt in to appear in Business Network search. Your private email and phone remain hidden until you accept a connection.</p></div><button onClick={() => setVisibility({ ...visibility, marketplace_visible: !visibility.marketplace_visible })} className={`relative h-7 w-12 shrink-0 rounded-full transition ${visibility.marketplace_visible ? "bg-teal-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${visibility.marketplace_visible ? "left-6" : "left-1"}`} /></button></div><div className="mt-6 space-y-4"><label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Profile headline<input maxLength={120} value={visibility.headline || ""} onChange={e => setVisibility({ ...visibility, headline: e.target.value })} placeholder="e.g. Cotton apparel wholesaler serving Eastern India" className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal normal-case tracking-normal outline-none focus:border-teal-500" /></label><label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Business introduction<textarea maxLength={800} value={visibility.description || ""} onChange={e => setVisibility({ ...visibility, description: e.target.value })} placeholder="Describe your products, capacity, MOQ and regions served." className="mt-2 h-32 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm font-normal normal-case tracking-normal outline-none focus:border-teal-500" /></label><button disabled={saving} onClick={saveVisibility} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save visibility</button></div></section>}
      </div>

      {connectTarget && <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><BusinessAvatar name={connectTarget.name} /><div><p className="text-xs font-bold uppercase text-teal-600">Connect with</p><h2 className="font-black text-slate-900">{connectTarget.name}</h2></div></div><button onClick={() => setConnectTarget(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><textarea value={connectionMessage} onChange={e => setConnectionMessage(e.target.value)} maxLength={500} placeholder="Introduce your business and explain what you want to discuss…" className="mt-5 h-28 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" /><p className="mt-2 text-xs text-slate-400">Your contact details stay private until this business accepts.</p><button disabled={saving} onClick={sendConnection} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send connection request</button></div></div>}
    </div>
  );
}
