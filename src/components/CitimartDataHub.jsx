// Citimart Data Hub — Citimart-only spreadsheet import for inventory +
// purchase forecasting. Deliberately a standalone component/route, not a
// new tab wired into the big shared ForecastAnalytics.jsx screen: this
// keeps the change additive and isolated, with zero risk to the existing
// Forecast & Analytics or Raphaa Data Hub screens.
//
// Backend: /api/citimart/data-hub/* is Citimart-only. Uploads first land in
// isolated staging; only an explicitly approved Stock batch can sync to live
// inventory/store_stock. Sales and Purchase/GRC remain analytics-only.
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
async function apiPostJson(path, body) {
  const r = await fetch(`${API_BASE_URL}/api/citimart/data-hub${path}`, { method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Request failed.");
  return d;
}

const BTN = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40";
const BTN_PRIMARY = `${BTN} bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm hover:from-violet-700 hover:to-fuchsia-700`;
const BTN_GHOST = `${BTN} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const CARD_ACCENTS = ["border-sky-400", "border-amber-400", "border-emerald-400"];

function UploadCard({ title, hint, kind, onCommitted, accent }) {
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
      onCommitted(result);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <section className={`rounded-2xl border-t-4 ${accent || "border-violet-400"} bg-gradient-to-br from-white to-slate-50/60 p-5 shadow-md`}>
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      <label className={`${BTN_GHOST} mt-3 cursor-pointer`}>
        Choose file<input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      {preview && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-gradient-to-br from-sky-50 to-slate-100 p-2"><p className="font-black text-slate-900">{preview.summary.row_count}</p><p className="text-slate-500">rows</p></div>
            <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 p-2"><p className="font-black text-emerald-700">{preview.summary.valid_count}</p><p className="text-emerald-600">valid</p></div>
            <div className="rounded-lg bg-gradient-to-br from-rose-50 to-rose-100 p-2"><p className="font-black text-rose-700">{preview.summary.invalid_count}</p><p className="text-rose-600">will skip</p></div>
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

function LiveStockSync({ batchId, onClose, onChanged }) {
  const [preview, setPreview] = useState(null);
  const mode = "partial";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!batchId) return;
    setBusy(true); setError("");
    try { setPreview((await apiGet(`/stock/${batchId}/sync-preview`)).data); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }, [batchId]);
  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    const label = "ADDITIVE update: only products and central segments present in this batch will change. Continue?";
    if (!window.confirm(`${label}\n\nThis writes approved Citimart quantities into the live stock used by POS and Store Transfer.`)) return;
    setBusy(true); setError("");
    try {
      const result = await fetch(`${API_BASE_URL}/api/citimart/data-hub/stock/${batchId}/sync`, {
        method: "POST", headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot_mode: mode, confirm: true }),
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(data.detail || "Live inventory sync failed.");
      onChanged(data.message || "Live inventory synced."); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const createProducts = async () => {
    const barcodes = [...new Set(
      (preview.problems || [])
        .filter((row) => row.errors.some((e) => e.includes("No Product Master match")))
        .map((row) => row.source_barcode || row.source_item_code)
        .filter(Boolean)
    )];
    if (!barcodes.length) return;
    if (!window.confirm(`Create ${barcodes.length} new Citimart product(s) from this batch's own data (division/section/department/vendor/rates), using the imported barcode as-is?`)) return;
    setBusy(true); setError("");
    try {
      const result = await apiPostJson(`/stock/${batchId}/create-products`, { barcodes });
      onChanged(result.message || "Products created.");
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const rollback = async () => {
    if (!window.confirm("Restore the pre-sync quantities? Rollback will be blocked if POS, transfers, or another process changed any affected stock afterward.")) return;
    setBusy(true); setError("");
    try {
      const result = await fetch(`${API_BASE_URL}/api/citimart/data-hub/stock/${batchId}/rollback`, {
        method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }),
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(data.detail || "Rollback failed.");
      onChanged(data.message || "Live stock restored."); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border-2 border-violet-300 bg-white p-5 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-black text-slate-900">Review and sync stock batch {batchId}</h3><p className="mt-1 text-xs text-slate-500">Upload remains in staging until this separate approval succeeds. Historical Sales and Purchase/GRC imports are never posted to live stock.</p></div>
        <button onClick={onClose} className={BTN_GHOST}>Close</button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      {busy && !preview && <p className="mt-4 text-sm text-slate-400">Checking Product Master and RMS store mappings…</p>}
      {preview && <div className="mt-4 space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          {[["Staged", preview.staged_row_count], ["Resolved", preview.resolved_count], ["Problems", preview.problem_count], ["Status", preview.live_sync_status]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-black text-slate-900">{value}</p></div>)}
        </div>
        {!!preview.locations?.length && <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Mapped location</th><th className="p-2">Products</th><th className="p-2">Quantity</th></tr></thead><tbody>{preview.locations.map((row) => <tr key={`${row.store_id || "central"}-${row.location}`} className="border-t"><td className="p-2 font-bold">{row.location}</td><td className="p-2">{row.product_count}</td><td className="p-2">{row.quantity}</td></tr>)}</tbody></table></div>}
        {!!preview.problems?.length && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs font-black text-rose-800">Sync blocked — resolve these mappings</p>
          {preview.problems.slice(0, 20).map((row, i) => <p key={`${row.row_no}-${i}`} className="mt-1 text-xs text-rose-700">Row {row.row_no}: {row.errors.join(" ")}</p>)}
          {preview.problems.some((row) => row.errors.some((e) => e.includes("No Product Master match"))) && (
            <button onClick={createProducts} disabled={busy} className={`${BTN_PRIMARY} mt-3`}>{busy ? "Creating…" : "Create missing products from this batch"}</button>
          )}
        </div>}
        {preview.can_sync && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-black text-amber-900">Additive stock update</p>
          <p className="mt-2 text-[11px] text-amber-800">Only supplied products, stores, and Central Inventory segments change. Omitted stock is preserved.</p>
          <button onClick={sync} disabled={busy} className={`${BTN_PRIMARY} mt-3 w-full`}>{busy ? "Reconciling…" : "Approve and sync to live POS & Inventory"}</button>
        </div>}
        {preview.live_sync_status === "SYNCED" && <button onClick={rollback} disabled={busy} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-50">Guarded rollback</button>}
      </div>}
    </section>
  );
}
function GradeBadge({ grade, reason, className = "" }) {
  if (!grade) return <span className={`text-[11px] text-slate-400 ${className}`} title={reason}>—</span>;
  const colors = { A: "bg-emerald-100 text-emerald-700", B: "bg-amber-100 text-amber-800", C: "bg-rose-100 text-rose-700" };
  return <span title={reason} className={`rounded-full px-2 py-0.5 text-[11px] font-black ${colors[grade] || "bg-slate-100 text-slate-500"} ${className}`}>{grade}</span>;
}

function PurchasePlan() {
  const [days, setDays] = useState(30);
  const [includeVendor, setIncludeVendor] = useState(false);
  const [filters, setFilters] = useState({ division: "", section: "", department: "", design_no: "", size: "", vendor_name: "" });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const load = async () => {
    setBusy(true);
    try {
      setError("");
      const params = new URLSearchParams({ days, include_vendor: includeVendor, ...filters });
      setData((await apiGet(`/purchase-plan?${params.toString()}`)).data);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const FILTER_FIELDS = [
    ["division", "Division"], ["section", "Section"], ["department", "Department"],
    ["design_no", "Design No."], ["size", "Size"], ["vendor_name", "Vendor"],
  ];

  return (
    <section className="rounded-2xl border-t-4 border-fuchsia-400 bg-gradient-to-br from-white to-violet-50/60 p-5 shadow-md">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="text-sm font-black text-slate-900">Purchase plan</h3><p className="mt-0.5 text-xs text-slate-500">From real sell-through vs current stock across imported stores. Once a product has been synced to live inventory, its current stock here comes from the live figure, not the import snapshot. Always sense-check before ordering.</p></div>
        <div className="flex items-end gap-2">
          <label className="text-xs font-bold text-slate-500">Look-back days<input type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} className="mt-1 block w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
          <label className="flex items-center gap-1.5 pb-2 text-xs font-bold text-slate-500"><input type="checkbox" checked={includeVendor} onChange={(e) => setIncludeVendor(e.target.checked)} /> Show vendor (once onboarded)</label>
          <button onClick={load} disabled={busy} className={BTN_PRIMARY}>{busy ? "Loading…" : "Load"}</button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {FILTER_FIELDS.map(([key, label]) => (
          <label key={key} className="text-[11px] font-bold text-slate-500">{label}
            <input value={filters[key]} onChange={(e) => setFilter(key, e.target.value)} placeholder="Any" className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
          </label>
        ))}
      </div>
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      {data && !!data.vendor_summary?.length && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs font-black text-amber-900">Vendors ranked by full-price units sold</p>
          <p className="mt-1 text-[11px] text-amber-800">Promotion-driven sales never count toward the rank — a vendor that only moves stock on discount shows a high promo share instead of a strong rank.</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left font-bold text-amber-900"><th className="py-1 pr-3">#</th><th className="pr-3">Vendor</th><th className="pr-3">Grade</th><th className="pr-3">Full-price qty</th><th className="pr-3">Promo qty</th><th className="pr-3">Promo share</th><th className="pr-3">Items</th><th className="pr-3">Suggested purchase</th><th>Status</th></tr></thead>
              <tbody>
                {data.vendor_summary.map((v, i) => (
                  <tr key={v.vendor_name} className="border-t border-amber-100">
                    <td className="py-1 pr-3 font-black">{i + 1}</td>
                    <td className="pr-3 font-bold text-slate-800">{v.vendor_name}</td>
                    <td className="pr-3"><GradeBadge grade={v.grade} reason={v.grade_reason} /></td>
                    <td className="pr-3">{v.full_price_qty}</td>
                    <td className="pr-3">{v.promo_qty}</td>
                    <td className="pr-3">{v.promo_share_pct == null ? "—" : `${v.promo_share_pct}%`}</td>
                    <td className="pr-3">{v.items_count}</td>
                    <td className="pr-3 font-bold text-violet-700">{v.suggested_purchase_qty_total}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${v.status === "Approved" ? "bg-emerald-50 text-emerald-700" : v.onboarded ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>{v.onboarded ? v.status : "Not onboarded"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {data && (
        data.items.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-gradient-to-r from-violet-100 to-fuchsia-100 text-left font-bold text-violet-800"><th className="py-1.5 pr-3 pl-2">Barcode / Item</th><th className="py-1.5 pr-3">Design No.</th><th className="py-1.5 pr-3">Division/Section/Dept</th><th className="py-1.5 pr-3">Size</th><th className="py-1.5 pr-3">Sold ({data.days}d)</th><th className="py-1.5 pr-3">Promo share</th><th className="py-1.5 pr-3">Current stock</th><th className="py-1.5 pr-3">Cover (days)</th><th className="py-1.5 pr-3">Suggested purchase</th>{data.vendor_info_included && <th className="py-1.5">Vendor</th>}</tr></thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.barcode || row.item_code} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 font-bold text-slate-800">{row.barcode || row.item_code}</td>
                    <td className="py-1.5 pr-3">{row.design_no || "—"}</td>
                    <td className="py-1.5 pr-3 text-[11px] text-slate-500">{[row.division, row.section, row.department].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="py-1.5 pr-3">{row.size || "—"}</td>
                    <td className="py-1.5 pr-3">{row.qty_sold}</td>
                    <td className="py-1.5 pr-3">{row.promo_share_pct == null ? "—" : `${row.promo_share_pct}%`}</td>
                    <td className="py-1.5 pr-3">
                      {row.current_stock}
                      <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${row.stock_source === "live" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{row.stock_source === "live" ? "Live" : "Snapshot"}</span>
                    </td>
                    <td className="py-1.5 pr-3">{row.stock_cover_days ?? "—"}</td>
                    <td className="py-1.5 pr-3 font-black text-violet-700">{row.suggested_purchase_qty}</td>
                    {data.vendor_info_included && (
                      <td className="py-1.5">
                        {row.vendor ? (
                          <>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${row.vendor.status === "Approved" ? "bg-emerald-50 text-emerald-700" : row.vendor.onboarded ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                              {row.vendor.vendor_name}{row.vendor.onboarded ? ` · ${row.vendor.status}` : " · not onboarded"}
                            </span>
                            <GradeBadge grade={row.vendor.grade} reason={row.vendor.grade_reason} className="ml-1" />
                          </>
                        ) : <span className="text-[11px] text-slate-400">No vendor on record</span>}
                      </td>
                    )}
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

function VendorOnboarding() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try { setError(""); setRows((await apiGet("/vendors/review")).data || []); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (name) => setSelected((s) => ({ ...s, [name]: !s[name] }));
  const onboard = async () => {
    const names = Object.keys(selected).filter((n) => selected[n]);
    if (!names.length) return;
    setBusy(true); setError("");
    try {
      const result = await apiPostJson("/vendors/onboard", { vendor_names: names });
      setNotice(result.message);
      setSelected({});
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const ACTION_LABEL = {
    create_pending: "New vendor — will be added as Pending",
    link_existing: "Matches an existing vendor — will link as Pending",
    already_linked: "Already onboarded to Citimart",
  };
  const ACTION_COLOR = {
    create_pending: "text-sky-700 bg-sky-50",
    link_existing: "text-amber-700 bg-amber-50",
    already_linked: "text-emerald-700 bg-emerald-50",
  };

  return (
    <section className="rounded-2xl border-t-4 border-emerald-400 bg-gradient-to-br from-white to-emerald-50/60 p-5 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900">Vendors seen in purchase history</h3>
          <p className="mt-1 text-xs text-slate-500">From imported Purchase/GRC rows. Onboarding adds a vendor as <span className="font-bold">Pending</span> only — the usual Approve step is still required before they can receive orders or get paid.</p>
        </div>
        <button onClick={onboard} disabled={busy || !Object.values(selected).some(Boolean)} className={BTN_PRIMARY}>{busy ? "Onboarding…" : "Onboard selected"}</button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      {notice && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{notice}</p>}
      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">No vendors found yet. Import a Purchase/GRC sheet above.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-gradient-to-r from-violet-100 to-fuchsia-100 text-left font-bold text-violet-800"><th className="py-1.5 pl-2 pr-3"></th><th className="pr-3">Vendor</th><th className="pr-3">Purchase rows</th><th className="pr-3">Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vendor_name} className="border-t border-slate-100">
                  <td className="py-1.5 pl-2 pr-3">
                    <input type="checkbox" disabled={r.suggested_action === "already_linked"} checked={!!selected[r.vendor_name]} onChange={() => toggle(r.vendor_name)} />
                  </td>
                  <td className="pr-3 font-bold text-slate-800">{r.vendor_name}</td>
                  <td className="pr-3">{r.purchase_rows}</td>
                  <td className="pr-3"><span className={`rounded-full px-2 py-0.5 font-bold ${ACTION_COLOR[r.suggested_action]}`}>{ACTION_LABEL[r.suggested_action]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function InventoryStat({ label, value, sub, tone }) {
  const TONES = {
    violet: "from-violet-600 to-fuchsia-600",
    sky: "from-sky-500 to-cyan-500",
    emerald: "from-emerald-500 to-teal-500",
  };
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${TONES[tone] || TONES.violet} p-4 text-white shadow-lg shadow-slate-900/10`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-white/75">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-white/75">{sub}</p>}
    </div>
  );
}

export function CitimartStoreInventory() {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ store: "", division: "", section: "", department: "", vendor: "" });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => { setQ(""); setFilters({ store: "", division: "", section: "", department: "", vendor: "" }); };

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setError("");
      const params = new URLSearchParams({ q, ...filters });
      setData((await apiGet(`/inventory?${params.toString()}`)).data);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }, [q, filters]);
  useEffect(() => { load(); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const money = (v) => `₹${Math.round(v || 0).toLocaleString("en-IN")}`;
  const activeFilterCount = Object.values(filters).filter(Boolean).length + (q ? 1 : 0);

  const FACET_FIELDS = [
    ["store", "Store", data?.stores?.map((s) => s.store_name) || []],
    ["division", "Division", data?.facets?.divisions || []],
    ["section", "Section", data?.facets?.sections || []],
    ["department", "Department", data?.facets?.departments || []],
    ["vendor", "Vendor", data?.facets?.vendors || []],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-8">
      <header className="rounded-3xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 p-6 text-white shadow-xl shadow-fuchsia-500/20">
        <p className="text-xs font-black uppercase tracking-[.2em] text-white/80">Citimart</p>
        <h1 className="mt-1 text-2xl font-black">Store-wise Inventory</h1>
        <p className="mt-1 text-sm text-white/85">Stock value by store from imported data. Once a product is synced to live inventory, its quantity here switches to the live figure automatically.</p>
      </header>

      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          <InventoryStat tone="violet" label="Total stock value" value={money(data.total_value)} sub={`Across ${data.stores.length} store(s)`} />
          <InventoryStat tone="sky" label="Total units" value={data.total_qty.toLocaleString("en-IN")} sub="All stores, all products" />
          <InventoryStat tone="emerald" label="Matching rows" value={data.item_count.toLocaleString("en-IN")} sub={activeFilterCount ? `${activeFilterCount} filter(s) applied` : "No filters applied"} />
        </div>
      )}

      {data && !!data.stores.length && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.stores.map((s) => (
            <button
              key={s.store_name}
              onClick={() => setFilter("store", filters.store === s.store_name ? "" : s.store_name)}
              className={`rounded-2xl border-t-4 p-4 text-left shadow-md transition ${filters.store === s.store_name ? "border-violet-500 bg-violet-50 ring-2 ring-violet-200" : "border-sky-400 bg-white hover:bg-slate-50"}`}
            >
              <p className="text-xs font-black uppercase text-slate-500">{s.store_name}</p>
              <p className="mt-1 text-lg font-black text-slate-900">{money(s.total_value)}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{s.item_count} item(s) · {s.total_qty} units</p>
            </button>
          ))}
        </div>
      )}

      <section className="rounded-2xl border-t-4 border-fuchsia-400 bg-white p-5 shadow-md">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Filters</p>
          {activeFilterCount > 0 && <button onClick={clearFilters} className="text-xs font-bold text-violet-600 hover:text-violet-800">Clear all</button>}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <label className="text-[11px] font-bold text-slate-500">Search
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Barcode, item…" className="mt-1 block w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-violet-400 focus:outline-none" />
          </label>
          {FACET_FIELDS.map(([key, label, options]) => (
            <label key={key} className="text-[11px] font-bold text-slate-500">{label}
              <select value={filters[key]} onChange={(e) => setFilter(key, e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm focus:border-violet-400 focus:outline-none">
                <option value="">All</option>
                {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </label>
          ))}
        </div>
        <div className="mt-3">
          <button onClick={load} disabled={busy} className={BTN_PRIMARY}>{busy ? "Searching…" : "Apply search"}</button>
        </div>
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
        {data && (
          data.items.length ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <p className="text-xs font-bold text-slate-600">{data.item_count.toLocaleString("en-IN")} matching row(s){data.truncated ? " — showing first 500, narrow your filters" : ""}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gradient-to-r from-violet-100 to-fuchsia-100 text-left font-bold text-violet-800"><th className="py-2 pr-3 pl-4">Store</th><th className="py-2 pr-3">Barcode / Item</th><th className="py-2 pr-3">Division/Section/Dept</th><th className="py-2 pr-3">Vendor</th><th className="py-2 pr-3">Qty</th><th className="py-2 pr-3">Rate</th><th className="py-2 pr-4">Value</th></tr></thead>
                  <tbody>
                    {data.items.map((row, i) => (
                      <tr key={`${row.store_name}-${row.barcode || row.item_code}-${i}`} className={`border-t border-slate-100 ${i % 2 ? "bg-slate-50/50" : ""} hover:bg-violet-50/40`}>
                        <td className="py-2 pr-3 pl-4 font-semibold text-slate-700">{row.store_name}</td>
                        <td className="py-2 pr-3 font-bold text-slate-800">{row.barcode || row.item_code}</td>
                        <td className="py-2 pr-3 text-[11px] text-slate-500">{[row.division, row.section, row.department].filter(Boolean).join(" / ") || "—"}</td>
                        <td className="py-2 pr-3">{row.vendor || "—"}</td>
                        <td className="py-2 pr-3">
                          {row.qty}
                          <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${row.stock_source === "live" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{row.stock_source === "live" ? "Live" : "Snapshot"}</span>
                        </td>
                        <td className="py-2 pr-3">{row.rate ? money(row.rate) : "—"}</td>
                        <td className="py-2 pr-4 font-black text-violet-700">{money(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <p className="p-10 text-center text-sm text-slate-400">{data.note || "No rows match these filters."}</p>
        )}
      </section>
    </div>
  );
}

export default function CitimartDataHub() {
  const [notice, setNotice] = useState("");
  const [imports, setImports] = useState([]);
  const [blocked, setBlocked] = useState(false);
  const [reviewBatchId, setReviewBatchId] = useState("");

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
      <header className="rounded-3xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 p-6 text-white shadow-xl shadow-fuchsia-500/20">
        <p className="text-xs font-black uppercase tracking-[.2em] text-white/80">Citimart</p>
        <h1 className="mt-1 text-2xl font-black">Inventory &amp; Purchase Forecasting Data Hub</h1>
        <p className="mt-1 text-sm text-white/85">Import Stock, Day-wise Sales and Purchase/GRC sheets. Uploads first stay isolated for review. Approved Stock batches can then be synced to Citimart's existing Central and store inventory; Sales and Purchase/GRC remain analytics-only.</p>
      </header>

      {notice && <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-2.5 text-sm font-bold text-emerald-700 shadow-sm">{notice}</div>}

      {reviewBatchId && <LiveStockSync batchId={reviewBatchId} onClose={() => setReviewBatchId("")} onChanged={(message) => { setNotice(message); loadImports(); }} />}

      <div className="grid gap-5 lg:grid-cols-3">
        <UploadCard title="Stock snapshot" hint="One row per product per store (Locname/Source Site + Barcode/Item Code)." kind="stock" accent={CARD_ACCENTS[0]} onCommitted={(result) => { setNotice(result.message || "Imported."); setReviewBatchId(result.batch_id || ""); loadImports(); }} />
        <UploadCard title="Day-wise sales" hint="Bill-line export — Bill Date, Bill No, Barcode/Item Code, Bill Qty, Net Amt. Voided rows are excluded automatically." kind="sales" accent={CARD_ACCENTS[1]} onCommitted={(result) => { setNotice(result.message || "Imported."); loadImports(); }} />
        <UploadCard title="Purchase / GRC" hint="Goods received — GRC No., Rec Dt, Rec Qty, Barcode/Item Code." kind="purchase" accent={CARD_ACCENTS[2]} onCommitted={(result) => { setNotice(result.message || "Imported."); loadImports(); }} />
      </div>

      <PurchasePlan />

      <VendorOnboarding />

      <section className="rounded-2xl border-t-4 border-sky-400 bg-gradient-to-br from-white to-sky-50/60 p-5 shadow-md">
        <h3 className="text-sm font-black text-slate-900">Import history</h3>
        <div className="mt-3 divide-y divide-slate-100">
          {imports.length ? imports.map((row) => (
<div key={row.batch_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
              <div className="flex items-center gap-2"><span className="rounded-full bg-gradient-to-r from-violet-100 to-fuchsia-100 px-2.5 py-0.5 font-bold capitalize text-violet-800">{row.kind}</span>{row.kind === "stock" && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600">{row.live_sync_status}</span>}</div>
              <div className="flex flex-wrap items-center justify-end gap-2"><span className="text-slate-500">{row.row_count} row(s) · {row.imported_by} · {new Date(row.imported_at).toLocaleString()}</span>{row.kind === "stock" && <button onClick={() => setReviewBatchId(row.batch_id)} className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 font-bold text-violet-700">Review{row.live_sync_status === "SYNCED" ? " / rollback" : " / sync"}</button>}</div>
            </div>
          )) : <p className="py-4 text-center text-xs text-slate-400">No imports yet.</p>}
        </div>
      </section>
    </div>
  );
}
