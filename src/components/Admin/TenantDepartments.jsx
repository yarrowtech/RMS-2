import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Lock, LoaderCircle, Clock, Sparkles } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || localStorage.getItem("adminToken") || sessionStorage.getItem("access_token") || sessionStorage.getItem("token");
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

export default function TenantDepartments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyDept, setBusyDept] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/hq/tenant-departments`, { headers: authHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || "Could not load departments.");
      setData(body);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleFree = async (department, enabled) => {
    setBusyDept(department);
    try {
      const res = await fetch(`${API_BASE_URL}/hq/tenant-departments`, {
        method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ department, enabled }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || "Could not update this department.");
      await load();
    } catch (e) { alert(e.message); }
    finally { setBusyDept(""); }
  };

  const requestUpgrade = async (department) => {
    const note = window.prompt(`Request to unlock "${department}" — optional note for whoever reviews it:`, "") || "";
    setBusyDept(department);
    try {
      const res = await fetch(`${API_BASE_URL}/hq/tenant-departments/upgrade-request`, {
        method: "POST", headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ department, note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || "Could not submit the request.");
      await load();
    } catch (e) { alert(e.message); }
    finally { setBusyDept(""); }
  };

  if (loading && !data) {
    return <div className="grid min-h-[300px] place-items-center text-slate-400"><LoaderCircle className="animate-spin" size={28} /></div>;
  }
  if (error && !data) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-700">{error}</div>;
  }

  const enabledSet = new Set(data?.enabled_departments || []);
  const pendingSet = new Set(data?.pending_requests || []);

  return (
    <div className="space-y-6">
      <section className="rounded-[22px] border border-slate-200 bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-900 px-6 py-7 text-white shadow-[0_16px_35px_rgba(15,23,42,.14)] sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-indigo-200">Admin Management</p>
        <h1 className="mt-1 text-2xl font-black">Departments</h1>
        <p className="mt-2 max-w-2xl text-sm text-indigo-100">
          Choose which departments are relevant to how this business actually operates — toggle free departments on or off any time. A few departments are paid add-ons; request to unlock them whenever you need them.
        </p>
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Free departments</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.free_departments || []).map((dept) => {
            const on = enabledSet.has(dept);
            const busy = busyDept === dept;
            return (
              <button
                key={dept}
                type="button"
                disabled={busy}
                onClick={() => toggleFree(dept, !on)}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition disabled:opacity-60 ${on ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
              >
                <span>
                  <span className="block text-sm font-bold text-slate-900">{dept}</span>
                  <span className={`mt-0.5 block text-xs font-semibold ${on ? "text-emerald-700" : "text-slate-400"}`}>{on ? "Enabled" : "Disabled"}</span>
                </span>
                {busy ? <LoaderCircle className="animate-spin text-slate-400" size={18} /> : on ? <CheckCircle2 className="text-emerald-600" size={20} /> : <span className="h-5 w-5 rounded-full border-2 border-slate-300" />}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
          <Sparkles size={15} className="text-amber-500" /> Paid departments
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.paid_departments || []).map((dept) => {
            const unlocked = enabledSet.has(dept);
            const pending = pendingSet.has(dept);
            const busy = busyDept === dept;
            return (
              <div key={dept} className={`rounded-2xl border p-4 ${unlocked ? "border-emerald-300 bg-emerald-50" : "border-amber-200 bg-amber-50/50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="block text-sm font-bold text-slate-900">{dept}</span>
                  {unlocked ? <CheckCircle2 className="text-emerald-600" size={20} /> : <Lock className="text-amber-500" size={18} />}
                </div>
                {unlocked ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-700">Unlocked</p>
                ) : pending ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700"><Clock size={13} /> Upgrade requested — awaiting approval</p>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => requestUpgrade(dept)}
                    className="mt-3 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {busy ? "Submitting…" : "Request upgrade"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
