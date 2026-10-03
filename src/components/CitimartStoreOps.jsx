// Citimart Store Ops — live per-store retail floor KPIs (Footfall, NOB,
// ATV, RPV, Basket Size, Conversion %, Sales Target Achievement %), modeled
// on the standalone CitiMart3 Daily Operations system. Standalone component/
// route, Citimart-only, isolated backend collections — see
// citimart_store_ops_routes.py for the full isolation note.
import React, { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api.js";
import { getAdminScope, getStoreName } from "../utils/authRedirect.js";

const STORES = [
  { code: "NM", name: "CITIMART-NEW MARKET" },
  { code: "HB", name: "CITIMART-HATIBAGAN" },
  { code: "CHW", name: "CITIMART-CHOWRINGHEEE" },
];

function headers() {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
async function api(path, options = {}) {
  const r = await fetch(`${API_BASE_URL}/api/citimart/store-ops${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Request failed.");
  return d;
}

const BTN = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40";
const BTN_PRIMARY = `${BTN} bg-violet-600 text-white shadow-sm hover:bg-violet-700`;
const BTN_GHOST = `${BTN} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const todayISO = () => new Date().toISOString().slice(0, 10);

function fmt(value, suffix = "") {
  return value == null ? "N/A" : `${Math.round(value * 100) / 100}${suffix}`;
}
function statusColor(value, band, invertAchievement = false) {
  if (value == null || !band) return "bg-slate-100 text-slate-500";
  const greenKey = "green_above" in band ? "green_above" : "green_at_or_above";
  const isGreen = "green_above" in band ? value > band[greenKey] : value >= band[greenKey];
  if (isGreen) return "bg-emerald-100 text-emerald-700";
  if (value < band.red_below) return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

const CARD_GRADIENTS = [
  "from-violet-500 to-fuchsia-500", "from-sky-500 to-cyan-500", "from-emerald-500 to-teal-500",
  "from-amber-400 to-orange-500", "from-rose-500 to-pink-500", "from-indigo-500 to-blue-600",
];
function KpiCard({ label, value, suffix, band, tone = 0 }) {
  const status = value != null && band ? statusColor(value, band) : "";
  const badge = status.includes("emerald") ? "● On track" : status.includes("rose") ? "● Red" : status.includes("amber") ? "● Watch" : "";
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${CARD_GRADIENTS[tone % CARD_GRADIENTS.length]} p-4 text-white shadow-lg shadow-slate-900/10`}>
      <div className="absolute -right-4 -top-4 h-14 w-14 rounded-full bg-white/15" />
      <p className="text-[11px] font-black uppercase tracking-wide text-white/80">{label}</p>
      <p className="mt-1 text-2xl font-black">{fmt(value, suffix)}</p>
      {badge && <p className="mt-1 text-[10px] font-bold text-white/90">{badge}</p>}
    </div>
  );
}

function LiveDashboard({ scope, ownStoreCode }) {
  const [store, setStore] = useState(ownStoreCode || "NM");
  const [date, setDate] = useState(todayISO());
  const [kpis, setKpis] = useState(null);
  const [overall, setOverall] = useState(null);
  const [thresholds, setThresholds] = useState({});
  const [error, setError] = useState("");
  const [logForm, setLogForm] = useState({ bill_time: "", net_amount: "", bill_quantity: "", footfall_time: "", footfall: "", nob_time: "", nob: "" });
  const [targetValue, setTargetValue] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const r = await api(`/live?store=${store}&date=${date}`);
      setKpis(r.data);
      setTargetValue(r.data.sales_target ?? "");
      if (scope !== "store") {
        try { setOverall((await api(`/live/overall?date=${date}`)).data.overall); } catch { setOverall(null); }
      }
    } catch (e) { setError(e.message); }
  }, [store, date, scope]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api("/kpi-thresholds").then((r) => setThresholds(r.data)).catch(() => {}); }, []);

  const logBill = async () => {
    if (!logForm.bill_time || !Number(logForm.net_amount)) return;
    try {
      await api("/bill-log", { method: "POST", body: JSON.stringify({ store, entry_date: date, bill_time: logForm.bill_time, net_amount: Number(logForm.net_amount), bill_quantity: Number(logForm.bill_quantity) || 0 }) });
      setLogForm({ ...logForm, bill_time: "", net_amount: "", bill_quantity: "" });
      await load();
    } catch (e) { setError(e.message); }
  };
  const logFootfall = async () => {
    if (!logForm.footfall_time || !Number(logForm.footfall)) return;
    try {
      await api("/footfall-log", { method: "POST", body: JSON.stringify({ store, entry_date: date, entry_time: logForm.footfall_time, footfall: Number(logForm.footfall) }) });
      setLogForm({ ...logForm, footfall_time: "", footfall: "" });
      await load();
    } catch (e) { setError(e.message); }
  };
  const logNob = async () => {
    if (!logForm.nob_time || !Number(logForm.nob)) return;
    try {
      await api("/nob-log", { method: "POST", body: JSON.stringify({ store, entry_date: date, entry_time: logForm.nob_time, nob: Number(logForm.nob) }) });
      setLogForm({ ...logForm, nob_time: "", nob: "" });
      await load();
    } catch (e) { setError(e.message); }
  };
  const saveTarget = async () => {
    try { await api("/target", { method: "PUT", body: JSON.stringify({ store, entry_date: date, sales_target: targetValue === "" ? null : Number(targetValue) }) }); await load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border-t-4 border-sky-400 bg-gradient-to-br from-white to-sky-50/60 p-4 shadow-md">
        {scope !== "store" && (
          <label className="text-xs font-bold text-slate-500">Store
            <select value={store} onChange={(e) => setStore(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
              {STORES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </label>
        )}
        <label className="text-xs font-bold text-slate-500">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
        <button onClick={load} className={BTN_PRIMARY}>Refresh</button>
      </div>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}

      {overall && (
        <section className="rounded-2xl border-t-4 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-md">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-violet-700">Overall Stores Summary</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard tone={0} label="Net Sales" value={overall.net_sales} />
            <KpiCard tone={1} label="Footfall" value={overall.footfall} />
            <KpiCard tone={2} label="NOB" value={overall.nob} />
            <KpiCard tone={3} label="Achievement %" value={overall.achievement_pct} suffix="%" band={thresholds.achievement} />
          </div>
        </section>
      )}

      {kpis && (
        <section className="rounded-2xl border-t-4 border-fuchsia-400 bg-gradient-to-br from-white to-violet-50/60 p-5 shadow-md">
          <p className="mb-3 text-sm font-black text-slate-900">{kpis.store_name} — {kpis.entry_date}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard tone={4} label="Net Sales" value={kpis.net_sales} />
            <KpiCard tone={5} label="Footfall" value={kpis.footfall} />
            <KpiCard tone={6} label="NOB" value={kpis.nob} />
            <KpiCard tone={7} label="Bill Qty" value={kpis.bill_quantity} />
            <KpiCard tone={8} label="ATV" value={kpis.atv} band={thresholds.atv} />
            <KpiCard tone={9} label="RPV" value={kpis.rpv} band={thresholds.rpv} />
            <KpiCard tone={10} label="Basket Size" value={kpis.basket_size} band={thresholds.basket_size} />
            <KpiCard tone={11} label="Conversion %" value={kpis.conversion_pct} suffix="%" band={thresholds.conversion} />
            <KpiCard tone={12} label="Sales Target" value={kpis.sales_target} />
            <KpiCard tone={13} label="Achievement %" value={kpis.achievement_pct} suffix="%" band={thresholds.achievement} />
            <KpiCard tone={14} label="Remaining" value={kpis.remaining} />
          </div>
          {kpis.overridden?.length > 0 && <p className="mt-2 text-[11px] font-bold text-amber-700">Manually overridden: {kpis.overridden.join(", ")}</p>}

          <div className="mt-5 flex flex-wrap items-end gap-2">
            <label className="text-xs font-bold text-slate-500">Sales target (₹)<input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="mt-1 block w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
            <button onClick={saveTarget} className={BTN_GHOST}>Save target</button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-[11px] font-black uppercase text-slate-500">Log a bill</p>
              <input type="time" value={logForm.bill_time} onChange={(e) => setLogForm({ ...logForm, bill_time: e.target.value })} className="mb-1.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <input type="number" placeholder="Net amount" value={logForm.net_amount} onChange={(e) => setLogForm({ ...logForm, net_amount: e.target.value })} className="mb-1.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <input type="number" placeholder="Bill quantity" value={logForm.bill_quantity} onChange={(e) => setLogForm({ ...logForm, bill_quantity: e.target.value })} className="mb-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <button onClick={logBill} className={`${BTN_PRIMARY} w-full`}>Log bill</button>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-[11px] font-black uppercase text-slate-500">Log footfall</p>
              <input type="time" value={logForm.footfall_time} onChange={(e) => setLogForm({ ...logForm, footfall_time: e.target.value })} className="mb-1.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <input type="number" placeholder="Footfall count" value={logForm.footfall} onChange={(e) => setLogForm({ ...logForm, footfall: e.target.value })} className="mb-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <button onClick={logFootfall} className={`${BTN_PRIMARY} w-full`}>Log footfall</button>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-[11px] font-black uppercase text-slate-500">Log NOB (buyers)</p>
              <input type="time" value={logForm.nob_time} onChange={(e) => setLogForm({ ...logForm, nob_time: e.target.value })} className="mb-1.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <input type="number" placeholder="NOB count" value={logForm.nob} onChange={(e) => setLogForm({ ...logForm, nob: e.target.value })} className="mb-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <button onClick={logNob} className={`${BTN_PRIMARY} w-full`}>Log NOB</button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function HqReview() {
  const [date, setDate] = useState(todayISO());
  const [comparison, setComparison] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [audit, setAudit] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [c, e, a] = await Promise.all([
        api(`/review/comparison?date=${date}`),
        api(`/review/exceptions?date=${date}`),
        api(`/review/override-audit?date=${date}`),
      ]);
      setComparison(c.data.stores);
      setExceptions(e.data.items);
      setAudit(a.data);
    } catch (err) { setError(err.message); }
  }, [date]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border-t-4 border-sky-400 bg-gradient-to-br from-white to-sky-50/60 p-4 shadow-md">
        <label className="text-xs font-bold text-slate-500">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
        <button onClick={load} className={BTN_PRIMARY}>Refresh</button>
      </div>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}

      <section className="rounded-2xl border-t-4 border-fuchsia-400 bg-gradient-to-br from-white to-violet-50/60 p-5 shadow-md">
        <p className="mb-3 text-sm font-black text-slate-900">Store comparison (ranked by achievement %)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-gradient-to-r from-violet-100 to-fuchsia-100 text-left font-bold text-violet-800"><th className="py-1.5">Store</th><th>Net sales</th><th>Target</th><th>Achievement</th><th>Footfall</th><th>NOB</th><th>ATV</th><th>Conv %</th></tr></thead>
            <tbody>{comparison.map((s) => (
              <tr key={s.store} className="border-t border-slate-100">
                <td className="py-1.5 font-bold">{s.store_name}</td><td>{s.net_sales}</td><td>{fmt(s.sales_target)}</td><td>{fmt(s.achievement_pct, "%")}</td><td>{s.footfall}</td><td>{s.nob}</td><td>{fmt(s.atv)}</td><td>{fmt(s.conversion_pct, "%")}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border-t-4 border-fuchsia-400 bg-gradient-to-br from-white to-violet-50/60 p-5 shadow-md">
        <p className="mb-3 text-sm font-black text-slate-900">Exceptions needing attention</p>
        {exceptions.length ? (
          <ul className="space-y-2">{exceptions.map((x, i) => (
            <li key={i} className="rounded-xl bg-gradient-to-r from-rose-100 to-orange-100 px-3 py-2 text-xs text-rose-800 shadow-sm"><b>{x.store_name}</b> — {x.message}</li>
          ))}</ul>
        ) : <p className="text-xs text-slate-400">Nothing flagged for this date.</p>}
      </section>

      <section className="rounded-2xl border-t-4 border-fuchsia-400 bg-gradient-to-br from-white to-violet-50/60 p-5 shadow-md">
        <p className="mb-3 text-sm font-black text-slate-900">Manual override audit</p>
        {audit.length ? (
          <table className="w-full text-xs">
            <thead><tr className="bg-gradient-to-r from-violet-100 to-fuchsia-100 text-left font-bold text-violet-800"><th className="py-1.5">When</th><th>Store</th><th>Field</th><th>From</th><th>To</th><th>By</th></tr></thead>
            <tbody>{audit.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="py-1.5">{new Date(a.changed_at).toLocaleString()}</td><td>{a.store}</td><td>{a.field}</td><td>{a.old_value ?? "—"}</td><td>{a.new_value ?? "cleared"}</td><td>{a.changed_by}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="text-xs text-slate-400">No overrides recorded for this date.</p>}
      </section>
    </div>
  );
}

function History({ scope, ownStoreCode }) {
  const [store, setStore] = useState(ownStoreCode || "ALL");
  const [dates, setDates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setError(""); setDates((await api(`/history/dates?store=${store}`)).data || []); }
    catch (e) { setError(e.message); }
  }, [store]);
  useEffect(() => { load(); }, [load]);

  const openDate = async (row) => {
    setSelected(row);
    try { setDetails((await api(`/history/details?store=${row.store}&date=${row.entry_date}`)).data); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border-t-4 border-sky-400 bg-gradient-to-br from-white to-sky-50/60 p-4 shadow-md">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-slate-900">Recorded dates</p>
          {scope !== "store" && (
            <select value={store} onChange={(e) => setStore(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
              <option value="ALL">All stores</option>
              {STORES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          )}
        </div>
        {error && <p className="mb-2 rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">{error}</p>}
        <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {dates.length ? dates.map((row) => (
            <button key={`${row.store}-${row.entry_date}`} onClick={() => openDate(row)} className="flex w-full items-center justify-between py-2 text-left text-xs hover:bg-slate-50">
              <span className="font-bold text-slate-800">{row.entry_date} · {row.store}</span>
              <span className="text-slate-500">₹{row.net_sales} · {row.footfall} footfall</span>
            </button>
          )) : <p className="py-6 text-center text-xs text-slate-400">No recorded dates yet.</p>}
        </div>
      </section>
      <section className="rounded-2xl border-t-4 border-sky-400 bg-gradient-to-br from-white to-sky-50/60 p-4 shadow-md">
        <p className="mb-3 text-sm font-black text-slate-900">Time-slot breakdown</p>
        {details ? (
          <table className="w-full text-xs">
            <thead><tr className="bg-gradient-to-r from-violet-100 to-fuchsia-100 text-left font-bold text-violet-800"><th className="py-1">Slot</th><th className="py-1">Net sales</th><th className="py-1">Footfall</th><th className="py-1">NOB</th><th className="py-1">Conv %</th></tr></thead>
            <tbody>{details.time_slots.map((s) => (
              <tr key={s.time_slot} className="border-t border-slate-100">
                <td className="py-1.5">{s.time_slot}</td><td className="py-1.5">₹{s.net_sales}</td><td className="py-1.5">{s.footfall}</td><td className="py-1.5">{s.nob}</td><td className="py-1.5">{s.conversion_pct ?? "N/A"}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="py-6 text-center text-xs text-slate-400">Select a date on the left.</p>}
      </section>
    </div>
  );
}

export default function CitimartStoreOps() {
  const [section, setSection] = useState("live");
  const [blocked, setBlocked] = useState(false);
  const scope = getAdminScope();
  const ownStoreName = getStoreName();
  const normalize = (v) => (v || "").trim().toUpperCase().replace(/\s+/g, " ");
  const ownStoreCode = STORES.find((s) => normalize(s.name) === normalize(ownStoreName))?.code || "";

  const [accessError, setAccessError] = useState("");
  useEffect(() => {
    api(`/live?store=${ownStoreCode || "NM"}&date=${todayISO()}`).catch((e) => {
      // Only a genuine "wrong tenant" 404 should show the generic blocked
      // screen — a store-mismatch 403 ("your store isn't recognised") is a
      // real, fixable problem (admin not yet reassigned to a real store)
      // and must surface its own message, not be swallowed into this one.
      if (e.message?.includes("available only for the Citimart tenant")) setBlocked(true);
      else if (ownStoreCode === "" && e.message) setAccessError(e.message);
    });
  }, [ownStoreCode]);

  if (blocked) return <div className="p-8 text-center text-sm text-slate-500">Citimart Store Ops is available only for the Citimart tenant.</div>;
  if (!ownStoreCode && scope === "store") {
    return <div className="p-8 text-center text-sm text-slate-500">{accessError || "Your login isn't assigned to a recognised Citimart store yet (New Market / Hatibagan / Chowringhee). Ask HQ to reassign your store in Admin Management."}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-8">
      <header className="rounded-3xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 p-6 text-white shadow-xl shadow-fuchsia-500/20">
        <p className="text-xs font-black uppercase tracking-[.2em] text-white/80">Citimart</p>
        <h1 className="mt-1 text-2xl font-black">Store Operations — Live KPIs</h1>
        <p className="mt-1 text-sm text-white/85">Footfall, NOB, billing and sales-target tracking per store, time-slot by time-slot.</p>
      </header>
      <nav className="inline-flex gap-2 rounded-2xl bg-white p-1.5 shadow-md ring-1 ring-slate-200">
        <button onClick={() => setSection("live")} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${section === "live" ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow" : "text-slate-600 hover:bg-violet-50"}`}>Live Dashboard</button>
        <button onClick={() => setSection("history")} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${section === "history" ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow" : "text-slate-600 hover:bg-violet-50"}`}>History</button>
        {scope !== "store" && <button onClick={() => setSection("review")} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${section === "review" ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow" : "text-slate-600 hover:bg-violet-50"}`}>HQ Review</button>}
      </nav>
      {section === "live" && <LiveDashboard scope={scope} ownStoreCode={ownStoreCode} />}
      {section === "history" && <History scope={scope} ownStoreCode={ownStoreCode} />}
      {section === "review" && scope !== "store" && <HqReview />}
    </div>
  );
}
