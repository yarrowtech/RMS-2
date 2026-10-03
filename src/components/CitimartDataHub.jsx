// Citimart Data Hub — Citimart-only spreadsheet import for inventory +
// purchase forecasting. Deliberately a standalone component/route, not a
// new tab wired into the big shared ForecastAnalytics.jsx screen: this
// keeps the change additive and isolated, with zero risk to the existing
// Forecast & Analytics or Raphaa Data Hub screens.
//
// Backend: /api/citimart/data-hub/* — 404s itself for any tenant other
// than Citimart, and every import lands in its OWN collections, never the
// live store_stock/sales/products collections POS/billing/GRN use.
import React, { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api.js";

function headers() {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function apiUpload(path, file) {
  const body = new FormData();
  body.append("file", file);
  const r = await fetch(`${API_BASE_URL}/api/citimart/data-hub${path}`, { method: "POST", headers: headers(), body });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Request failed.");
  return d;
}
async function apiGet(path) {
  const r = await fetch(`${API_BASE_URL}/api/citimart/data-hub${path}`, { headers: headers() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Request failed.");
  return d;
}

const BTN = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40";
const BTN_PRIMARY = `${BTN} bg-violet-600 text-white shadow-sm hover:bg-violet-700`;
const BTN_GHOST = `${BTN} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;

function UploadCard({ title, hint, kind, onCommitted }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const choose = async (f) => {
    if (!f) return;
    setFile(f); setPreview(null); setError(""); setBusy(true);
    try { setPreview(await apiUpload(`/${kind}/preview`, f)); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const commit = async () => {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const result = await apiUpload(`/${kind}/commit`, file);
      setPreview(null); setFile(null);
      onCommitted(result.message || "Imported.");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      <label className={`${BTN_GHOST} mt-3 cursor-pointer`}>
        Choose file<input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      {preview && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-slate-50 p-2"><p className="font-black text-slate-900">{preview.summary.row_count}</p><p className="text-slate-500">rows</p></div>
            <div className="rounded-lg bg-emerald-50 p-2"><p className="font-black text-emerald-700">{preview.summary.valid_count}</p><p className="text-emerald-600">valid</p></div>
            <div className="rounded-lg bg-rose-50 p-2"><p className="font-black text-rose-700">{preview.summary.invalid_count}</p><p className="text-rose-600">will skip</p></div>
          </div>
          {preview.rows.filter((r) => r.errors?.length).slice(0, 10).map((r) => (
            <p key={r.row_no} className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] text-rose-700">Row {r.row_no}: {r.errors.join("; ")}</p>
          ))}
          <button onClick={commit} disabled={busy || !preview.summary.valid_count} className={`${BTN_PRIMARY} w-full`}>
            {busy ? "Importing…" : `Import ${preview.summary.valid_count} row(s)`}
          </button>
        </div>
      )}
    </section>
  );
}

function PurchasePlan() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = async () => {
    try { setError(""); setData((await apiGet(`/purchase-plan?days=${days}`)).data); }
    catch (e) { setError(e.message); }
  };
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="text-sm font-black text-slate-900">Purchase plan</h3><p className="mt-0.5 text-xs text-slate-500">From real sell-through vs current stock across imported stores. Always sense-check before ordering.</p></div>
        <div className="flex items-end gap-2">
          <label className="text-xs font-bold text-slate-500">Look-back days<input type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} className="mt-1 block w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
          <button onClick={load} className={BTN_PRIMARY}>Load</button>
        </div>
      </div>
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      {data && (
        data.items.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left font-bold text-slate-500"><th className="py-1.5 pr-3">Barcode / Item</th><th className="py-1.5 pr-3">Design No.</th><th className="py-1.5 pr-3">Sold ({data.days}d)</th><th className="py-1.5 pr-3">Current stock</th><th className="py-1.5 pr-3">Cover (days)</th><th className="py-1.5">Suggested purchase</th></tr></thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.barcode || row.item_code} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 font-bold text-slate-800">{row.barcode || row.item_code}</td>
                    <td className="py-1.5 pr-3">{row.design_no || "—"}</td>
                    <td className="py-1.5 pr-3">{row.qty_sold}</td>
                    <td className="py-1.5 pr-3">{row.current_stock}</td>
                    <td className="py-1.5 pr-3">{row.stock_cover_days ?? "—"}</td>
                    <td className="py-1.5 font-black text-violet-700">{row.suggested_purchase_qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">{data.note}</p>
      )}
    </section>
  );
}

export default function CitimartDataHub() {
  const [notice, setNotice] = useState("");
  const [imports, setImports] = useState([]);
  const [blocked, setBlocked] = useState(false);

  const loadImports = useCallback(async () => {
    try { setImports((await apiGet("/imports")).data || []); setBlocked(false); }
    catch (e) { if (e.message?.includes("Citimart")) setBlocked(true); }
  }, []);
  useEffect(() => { loadImports(); }, [loadImports]);

  if (blocked) {
    return <div className="p-8 text-center text-sm text-slate-500">The Citimart Data Hub is available only for the Citimart tenant.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-8">
      <header>
        <p className="text-xs font-black uppercase tracking-[.16em] text-violet-600">Citimart</p>
        <h1 className="mt-1 text-xl font-black text-slate-900">Inventory &amp; Purchase Forecasting Data Hub</h1>
        <p className="mt-1 text-sm text-slate-500">Import Stock, Day-wise Sales and Purchase/GRC sheets. Everything here is kept separate from live POS/billing data — this only ever feeds the Purchase Plan below.</p>
      </header>

      {notice && <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700">{notice}</div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <UploadCard title="Stock snapshot" hint="One row per product per store (Locname/Source Site + Barcode/Item Code)." kind="stock" onCommitted={(m) => { setNotice(m); loadImports(); }} />
        <UploadCard title="Day-wise sales" hint="Bill-line export — Bill Date, Bill No, Barcode/Item Code, Bill Qty, Net Amt. Voided rows are excluded automatically." kind="sales" onCommitted={(m) => { setNotice(m); loadImports(); }} />
        <UploadCard title="Purchase / GRC" hint="Goods received — GRC No., Rec Dt, Rec Qty, Barcode/Item Code." kind="purchase" onCommitted={(m) => { setNotice(m); loadImports(); }} />
      </div>

      <PurchasePlan />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-slate-900">Import history</h3>
        <div className="mt-3 divide-y divide-slate-100">
          {imports.length ? imports.map((row) => (
            <div key={row.batch_id} className="flex items-center justify-between py-2 text-xs">
              <span className="font-bold capitalize text-slate-800">{row.kind}</span>
              <span className="text-slate-500">{row.row_count} row(s) · {row.imported_by} · {new Date(row.imported_at).toLocaleString()}</span>
            </div>
          )) : <p className="py-4 text-center text-xs text-slate-400">No imports yet.</p>}
        </div>
      </section>
    </div>
  );
}
