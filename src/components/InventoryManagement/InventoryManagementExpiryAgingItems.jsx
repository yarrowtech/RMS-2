import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { FaClock, FaSearch, FaTimes, FaSyncAlt, FaBoxes } from "react-icons/fa";

const API_BASE = `${APP_API_URL}`;

/* ─── Status config ─── */
function getExpiryStatus(daysLeft, status) {
  if (status === "Expired"      || daysLeft <= 0)  return { label: "Expired",       cls: "bg-red-50 text-red-700 border-red-200" };
  if (status === "Expiring Soon"|| daysLeft <= 30)  return { label: "Expiring Soon", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "OK", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

function getAgingBadge(days) {
  if (days >= 120) return "bg-red-50 text-red-700 border-red-200";
  if (days >= 90)  return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

/* ─── Main ─── */
export default function ExpiryAgingItems() {
  const [showSearch, setShowSearch] = useState(false);
  const [query,      setQuery]      = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [data,    setData]    = useState([]);
  const [summary, setSummary] = useState({ total: 0, expired: 0, expiring_soon: 0, ok: 0, aging_90_plus: 0, aging_120_plus: 0 });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const fetchData = useCallback(async () => {
  setLoading(true); setError(null);
  try {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "All") params.append("status", statusFilter);
    if (query.trim()) params.append("search", query.trim());

    const token = localStorage.getItem("admin_token");
    const res = await fetch(`${API_BASE}/inventory/expiry-aging?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    setData(json.data || []);
    setSummary(json.summary || {});
  } catch (e) {
    setError(e.message);
  } finally {
    setLoading(false);
  }
}, [statusFilter, query]);
  /* Debounce search */
  useEffect(() => {
    const t = setTimeout(() => { fetchData(); }, 400);
    return () => clearTimeout(t);
  }, [fetchData]);

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Expiry & Aging Items</h2>
          <p className="text-sm text-slate-500 mt-1">Products with expiry dates tracked from GRN inward records</p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 self-start lg:self-auto">
          <FaSyncAlt className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi title="Total Records"    value={summary.total}         tone="indigo" />
        <Kpi title="Expired"          value={summary.expired}       tone="red" />
        <Kpi title="Expiring Soon"    value={summary.expiring_soon} tone="amber" />
        <Kpi title="OK"               value={summary.ok}            tone="emerald" />
        <Kpi title="Aging ≥ 90 days"  value={summary.aging_90_plus} tone="slate" />
        <Kpi title="Aging ≥ 120 days" value={summary.aging_120_plus}tone="red" />
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* ── Glowing card ── */}
      <div className="relative rounded-[30px] p-[2px] overflow-visible">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-gradient-to-r from-indigo-500 via-sky-500 to-violet-500 opacity-75 blur-xl" />
        <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-gradient-to-r from-indigo-500 via-sky-500 to-violet-500 opacity-90" />

        {/* Inner Card */}
        <div className="relative w-full rounded-[28px] border border-white/70 bg-gradient-to-br from-white via-white to-indigo-50/70 shadow-[0_20px_65px_-24px_rgba(30,58,138,0.65)] overflow-hidden">
          <div className="pointer-events-none absolute -top-28 left-1/2 h-56 w-[620px] -translate-x-1/2 rounded-full bg-indigo-500/12 blur-3xl" />

          {/* Header row */}
          <div className="px-6 py-4 border-b border-indigo-200/80 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-indigo-50">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl border border-indigo-200 bg-indigo-50 grid place-items-center text-indigo-700 shadow-sm">
                <FaClock />
              </div>
              <div>
                <div className="font-black text-slate-900">Expiry & Aging List</div>
                <div className="text-xs text-slate-500 mt-0.5">{data.length} record{data.length !== 1 ? "s" : ""} shown</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status filter tabs */}
              {["All","Expired","Expiring Soon","OK"].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    statusFilter === s
                      ? s === "Expired"       ? "bg-red-600    text-white border-red-600"
                      : s === "Expiring Soon" ? "bg-amber-500  text-white border-amber-500"
                      : s === "OK"            ? "bg-emerald-600 text-white border-emerald-600"
                      :                         "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                  }`}>
                  {s}
                </button>
              ))}

              {/* Search */}
              {showSearch ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border-2 border-indigo-200 bg-white shadow-sm">
                  <FaSearch className="text-slate-400" />
                  <input
                    value={query} onChange={e => setQuery(e.target.value)} autoFocus
                    placeholder="SKU / Item / Batch / GRN…"
                    className="w-52 outline-none text-sm text-slate-700 placeholder:text-slate-400 bg-transparent"
                  />
                  <button onClick={() => { setQuery(""); setShowSearch(false); }}
                    className="h-7 w-7 rounded-lg border border-slate-200 grid place-items-center hover:bg-slate-50">
                    <FaTimes className="text-slate-500 text-xs" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowSearch(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-indigo-200 bg-white text-indigo-800 font-bold hover:bg-indigo-50 text-sm">
                  <FaSearch /> Search
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="h-[calc(100vh-400px)] overflow-auto">
            <table className="min-w-[1080px] w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-indigo-50">
                <tr className="text-left text-slate-700">
                  <th className="px-5 py-3 font-black">SKU</th>
                  <th className="px-5 py-3 font-black">Item</th>
                  <th className="px-5 py-3 font-black">Division</th>
                  <th className="px-5 py-3 font-black">Batch</th>
                  <th className="px-5 py-3 font-black">Expiry Date</th>
                  <th className="px-5 py-3 font-black text-right">Days Left</th>
                  <th className="px-5 py-3 font-black">Status</th>
                  <th className="px-5 py-3 font-black text-right">Stock</th>
                  <th className="px-5 py-3 font-black text-right">Aging (days)</th>
                  <th className="px-5 py-3 font-black">GRN No</th>
                  <th className="px-5 py-3 font-black">Vendor</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={11} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <FaSyncAlt className="animate-spin text-2xl text-indigo-400" />
                      <span className="text-sm font-medium">Loading expiry data…</span>
                    </div>
                  </td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={11} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <FaBoxes className="text-4xl opacity-30" />
                      <span className="text-sm font-medium">
                        {query || statusFilter !== "All"
                          ? "No items match your filters."
                          : "No items with expiry dates found. Set expiry dates when creating GRNs."}
                      </span>
                    </div>
                  </td></tr>
                ) : data.map((x, i) => {
                  const exp = getExpiryStatus(x.days_left, x.expiry_status);
                  return (
                    <tr key={i} className={`hover:bg-indigo-50/40 transition-colors ${x.expiry_status === "Expired" ? "bg-red-50/20" : ""}`}>
                      <td className="px-5 py-3">
                        <span className="inline-flex px-3 py-1 rounded-full border-2 border-indigo-300 bg-indigo-50 text-indigo-900 text-xs font-black">
                          {x.sku || x.barcode || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-900 font-semibold max-w-[200px]">
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap" title={x.item}>{x.item}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">{x.division || "—"}</td>
                      <td className="px-5 py-3 text-slate-700 font-mono text-xs">{x.batch}</td>
                      <td className="px-5 py-3 text-slate-700 font-mono text-xs whitespace-nowrap">{x.expiry}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-black text-sm ${x.days_left <= 0 ? "text-red-600" : x.days_left <= 30 ? "text-amber-600" : "text-emerald-600"}`}>
                          {x.days_left <= 0 ? "Expired" : `${x.days_left}d`}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-black ${exp.cls}`}>
                          {exp.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-slate-700">{x.current_stock}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-black ${getAgingBadge(x.aging_days)}`}>
                          {x.aging_days}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-indigo-600 whitespace-nowrap">{x.grn_no || "—"}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">{x.vendor || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── KPI Card ─── */
function Kpi({ title, value, tone = "indigo" }) {
  const toneMap = {
    indigo:  "border-indigo-300 bg-indigo-50 text-indigo-700",
    red:     "border-red-200 bg-red-50 text-red-700",
    amber:   "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate:   "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <div
      tabIndex={-1}
      onMouseDown={e => e.preventDefault()}
      className="relative bg-white rounded-2xl border-2 border-indigo-200 shadow-sm overflow-hidden p-4 min-h-[110px] flex flex-col select-none focus:outline-none"
    >
      <div className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(420px 180px at 50% -20%, rgba(79,70,229,0.18), transparent 60%)" }} />
      <div className="relative">
        <p className="text-xs text-slate-500 font-semibold truncate">{title}</p>
        <p className="mt-1 text-2xl font-black text-slate-900 leading-none">{value ?? 0}</p>
      </div>
      <div className="relative mt-auto">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 text-xs font-black ${toneMap[tone]}`}>
          <FaClock /> Live
        </div>
      </div>
    </div>
  );
}