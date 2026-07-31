import React, { useCallback, useEffect, useState } from "react";
import { Eye, Layers, Loader2, MonitorSmartphone, RefreshCw, Timer, UserPlus, Users, Zap } from "lucide-react";
import { API_BASE_URL } from "../config/api.js";

const RANGES = [
  [7, "7 days"], [30, "30 days"], [90, "90 days"],
];

function fmt(n) {
  return typeof n === "number" ? n.toLocaleString("en-IN") : "0";
}

function fmtDuration(seconds) {
  if (!seconds) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

async function api(path) {
  const response = await fetch(`${API_BASE_URL}/api/analytics${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("superadmin_token") || ""}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Usage analytics could not be loaded.");
  return body;
}

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4.5 w-4.5" /></div>
      <p className="mt-3 text-2xl font-black text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}

function FunnelRow({ label, visited, submitted }) {
  const rate = visited > 0 ? Math.round((submitted / visited) * 100) : 0;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-sm font-bold text-slate-700">{label}</p>
      <p className="text-xs font-semibold text-slate-500">
        <span className="text-slate-900">{fmt(visited)}</span> visited &middot;{" "}
        <span className="text-slate-900">{fmt(submitted)}</span> submitted &middot;{" "}
        <span className={rate >= 20 ? "text-emerald-600" : "text-amber-600"}>{rate}%</span>
      </p>
    </div>
  );
}

export default function UsageAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await api(`/summary?days=${days}`)); }
    catch (err) { setError(err.message || "Could not load usage analytics."); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const devices = data?.device_breakdown || { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
  const deviceTotal = Object.values(devices).reduce((sum, n) => sum + n, 0) || 1;

  return (
    <section className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-800 to-blue-950 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Usage Analytics</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Page visits, feature usage, session duration and device type across every RMS surface — vendor, retailer, and public pages.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-white/10 p-1.5">
            {RANGES.map(([value, label]) => (
              <button key={value} onClick={() => setDays(value)} className={`rounded-xl px-3 py-2 text-xs font-black transition ${days === value ? "bg-white text-slate-900" : "text-slate-200 hover:bg-white/10"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

      {loading ? (
        <div className="grid place-items-center rounded-2xl border border-slate-200 bg-white py-20">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
        </div>
      ) : !data ? null : (
        <>
          <div className="flex justify-end">
            <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200">
              <RefreshCw className="h-3.5 w-3.5" />Refresh
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Users} label="Unique sessions" value={fmt(data.unique_sessions)} tone="bg-blue-50 text-blue-600" />
            <StatCard icon={Eye} label="Page views" value={fmt(data.page_views)} tone="bg-indigo-50 text-indigo-600" />
            <StatCard icon={Timer} label="Avg. session duration" value={fmtDuration(data.avg_session_duration_seconds)} tone="bg-emerald-50 text-emerald-600" />
            <StatCard icon={Zap} label="Subscription CTA taps" value={fmt(data.subscription_cta_taps)} tone="bg-amber-50 text-amber-600" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-slate-400" /><h3 className="font-black text-slate-900">Top pages</h3></div>
              {!data.top_pages.length ? <p className="mt-4 text-sm text-slate-400">No page views yet in this range.</p> : (
                <div className="mt-3 divide-y divide-slate-100">
                  {data.top_pages.map((row) => (
                    <div key={row.path} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="truncate font-semibold text-slate-700">{row.path}</span>
                      <span className="ml-3 shrink-0 font-black text-slate-900">{fmt(row.views)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-slate-400" /><h3 className="font-black text-slate-900">Top features used</h3></div>
              {!data.top_features.length ? <p className="mt-4 text-sm text-slate-400">No feature usage recorded yet in this range.</p> : (
                <div className="mt-3 divide-y divide-slate-100">
                  {data.top_features.map((row) => (
                    <div key={row.feature} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="truncate font-semibold text-slate-700">{row.feature}</span>
                      <span className="ml-3 shrink-0 font-black text-slate-900">{fmt(row.count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><MonitorSmartphone className="h-4 w-4 text-slate-400" /><h3 className="font-black text-slate-900">Device type</h3></div>
              <div className="mt-4 space-y-3">
                {Object.entries(devices).map(([key, count]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500"><span className="capitalize">{key}</span><span>{fmt(count)}</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.round((count / deviceTotal) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-slate-400" /><h3 className="font-black text-slate-900">Onboarding funnel</h3></div>
              <div className="mt-4 space-y-2.5">
                <FunnelRow label="Retailer onboarding" visited={data.onboarding.retailer.visited} submitted={data.onboarding.retailer.submitted} />
                <FunnelRow label="Vendor onboarding" visited={data.onboarding.vendor.visited} submitted={data.onboarding.vendor.submitted} />
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
