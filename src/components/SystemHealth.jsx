import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, MailWarning, RefreshCw, ServerCrash } from "lucide-react";
import { API_BASE_URL } from "../config/api.js";

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/superadmin${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${localStorage.getItem("superadmin_token") || ""}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Request failed.");
  return body;
}

function fmtWhen(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

const FILTERS = [["all", "All"], ["unresolved", "Unresolved"], ["resolved", "Resolved"]];

function ErrorLogRow({ row, onResolve, resolving }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border p-3.5 ${row.resolved ? "border-slate-100 bg-slate-50/60" : "border-rose-100 bg-rose-50/40"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${row.severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{row.severity}</span>
            <span className="truncate font-mono text-xs font-bold text-slate-700">{row.source}</span>
            {row.resolved && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">Resolved</span>}
          </div>
          <p className="mt-1.5 text-sm text-slate-700">{row.message}</p>
          <p className="mt-1 text-[11px] text-slate-400">{fmtWhen(row.created_at)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {row.traceback && (
            <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}Traceback
            </button>
          )}
          {!row.resolved && (
            <button disabled={resolving} onClick={() => onResolve(row.id)} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" />Resolve
            </button>
          )}
        </div>
      </div>
      {open && row.traceback && <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-[10.5px] leading-5 text-slate-200">{row.traceback}</pre>}
    </div>
  );
}

function ErrorLogsSection() {
  const [rows, setRows] = useState([]);
  const [unresolved, setUnresolved] = useState(0);
  const [filter, setFilter] = useState("unresolved");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolvingId, setResolvingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const q = filter === "all" ? "" : `&resolved=${filter === "resolved"}`;
      const data = await api(`/error-logs?limit=100${q}`);
      setRows(data.logs || []); setUnresolved(data.unresolved || 0);
    } catch (err) { setError(err.message || "Could not load error logs."); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id) => {
    setResolvingId(id);
    try { await api(`/error-logs/${id}/resolve`, { method: "POST" }); await load(); }
    catch (err) { setError(err.message || "Could not resolve this entry."); }
    finally { setResolvingId(""); }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600"><ServerCrash className="h-5 w-5" /></span>
          <div>
            <h3 className="font-black text-slate-900">Error Logs</h3>
            <p className="text-xs text-slate-500">Unhandled exceptions across every route, caught automatically — {unresolved} unresolved</p>
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</button>
      </div>
      <div className="flex gap-2 border-b border-slate-100 px-5 py-3">
        {FILTERS.map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === key ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>
        ))}
      </div>
      {error && <div className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
      <div className="space-y-2.5 p-5">
        {loading ? <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
          : !rows.length ? <p className="py-8 text-center text-sm text-slate-400">No {filter === "all" ? "" : filter} errors recorded.</p>
          : rows.map((row) => <ErrorLogRow key={row.id} row={row} onResolve={resolve} resolving={resolvingId === row.id} />)}
      </div>
    </div>
  );
}

function EmailFailuresSection() {
  const [rows, setRows] = useState([]);
  const [unresolved, setUnresolved] = useState(0);
  const [filter, setFilter] = useState("unresolved");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolvingId, setResolvingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const q = filter === "all" ? "" : `&resolved=${filter === "resolved"}`;
      const data = await api(`/email-failures?limit=100${q}`);
      setRows(data.failures || []); setUnresolved(data.unresolved || 0);
    } catch (err) { setError(err.message || "Could not load email failures."); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id) => {
    setResolvingId(id);
    try { await api(`/email-failures/${id}/resolve`, { method: "POST" }); await load(); }
    catch (err) { setError(err.message || "Could not resolve this entry."); }
    finally { setResolvingId(""); }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><MailWarning className="h-5 w-5" /></span>
          <div>
            <h3 className="font-black text-slate-900">Email Failures</h3>
            <p className="text-xs text-slate-500">Every email that didn't go out, and why — {unresolved} unresolved</p>
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</button>
      </div>
      <div className="flex gap-2 border-b border-slate-100 px-5 py-3">
        {FILTERS.map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === key ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>
        ))}
      </div>
      {error && <div className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>{["Subject", "Recipients", "Reason", "Sent", "Status", ""].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-bold uppercase text-slate-500">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
              : !rows.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No {filter === "all" ? "" : filter} email failures.</td></tr>
              : rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-semibold text-slate-800">{row.subject || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{(row.recipients || []).join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{row.reason || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{fmtWhen(row.created_at)}</td>
                  <td className="px-4 py-3">{row.resolved ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">Resolved</span> : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">Open</span>}</td>
                  <td className="px-4 py-3">{!row.resolved && <button disabled={resolvingId === row.id} onClick={() => resolve(row.id)} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"><Check className="h-3.5 w-3.5" />Resolve</button>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SystemHealth() {
  return (
    <section className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-rose-950 to-slate-900 p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-rose-200"><AlertTriangle className="h-4 w-4" /> RMS operations</div>
        <h2 className="mt-2 text-2xl font-black">System Health</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Unhandled exceptions and failed email sends — the things that used to only show up in a server console nobody was watching.</p>
      </div>
      <ErrorLogsSection />
      <EmailFailuresSection />
    </section>
  );
}
