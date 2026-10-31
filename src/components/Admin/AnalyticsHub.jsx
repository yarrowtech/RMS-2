import React, { useCallback, useEffect, useState } from "react";
import {
  BarChart3, Building2, CircleDollarSign, Gift, LoaderCircle, Package,
  RefreshCw, ShoppingCart, Ticket, Users,
} from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || localStorage.getItem("adminToken") || sessionStorage.getItem("access_token") || sessionStorage.getItem("token");
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

function Metric({ label, value, helper, icon: Icon, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
          {helper && <p className="mt-1 text-xs font-medium text-slate-400">{helper}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${tone}`}><Icon size={19} /></div>
      </div>
    </div>
  );
}

export default function AnalyticsHub() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lookbackDays, setLookbackDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/analytics/hq-overview?lookback_days=${lookbackDays}`, { headers: authHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || "Could not load the analytics hub.");
      setData(body);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [lookbackDays]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-900 px-6 py-7 text-white shadow-[0_16px_35px_rgba(15,23,42,.14)] sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-indigo-200">Analytics Hub</p>
        <h3 className="mt-1 text-xl font-bold">Cross-department snapshot</h3>
        <p className="mt-1 max-w-2xl text-sm text-indigo-100/75">
          A shallow, wide view across every department at once. For deep numbers, open Finance, Forecast & Analytics
          or Customer CRM directly — this stays a quick snapshot on purpose.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select value={lookbackDays} onChange={(e) => setLookbackDays(Number(e.target.value))} className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-sm text-white">
            {[7, 30, 90, 180].map((d) => <option key={d} value={d} className="text-slate-900">{d} days</option>)}
          </select>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-60">
            {loading ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh
          </button>
        </div>
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

      {loading && !data ? (
        <div className="grid min-h-[200px] place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-indigo-600" /></div>
      ) : data && (
        <>
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Sales — last {data.lookback_days} days</h4>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label="Revenue" value={`₹${(data.sales.total_revenue || 0).toLocaleString("en-IN")}`} icon={CircleDollarSign} tone="bg-emerald-50 text-emerald-600" />
              <Metric label="Units sold" value={(data.sales.total_units_sold || 0).toLocaleString("en-IN")} icon={ShoppingCart} tone="bg-indigo-50 text-indigo-600" />
              <Metric label="Bills" value={(data.sales.bill_count || 0).toLocaleString("en-IN")} icon={BarChart3} tone="bg-sky-50 text-sky-600" />
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Procurement & inventory</h4>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Approved vendors" value={data.procurement.approved_vendors} icon={Building2} tone="bg-violet-50 text-violet-600" />
              <Metric label="Pending vendor requests" value={data.procurement.pending_vendor_requests} icon={Building2} tone="bg-amber-50 text-amber-600" />
              <Metric label="Pending purchase orders" value={data.procurement.pending_purchase_orders} icon={Package} tone="bg-orange-50 text-orange-600" />
              <Metric label="Low stock alerts" value={data.inventory.low_stock_alerts} icon={Package} tone="bg-rose-50 text-rose-600" />
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Customer engagement</h4>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label="Known customers" value={data.customer_engagement.known_customers} icon={Users} tone="bg-teal-50 text-teal-600" />
              <Metric label="Active Lucky Draw campaigns" value={data.customer_engagement.active_lucky_draw_campaigns} icon={Gift} tone="bg-fuchsia-50 text-fuchsia-600" />
              <Metric label="Active coupons" value={data.customer_engagement.active_coupons} icon={Ticket} tone="bg-sky-50 text-sky-600" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
