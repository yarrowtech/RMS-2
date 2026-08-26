import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { API_BASE_URL } from "../../config/api.js";

// Fabric Themes — group fabric selections from several suppliers under one
// named requirement (e.g. "Summer 2026"), then finalize into one Fabric PO
// PER SUPPLIER at once (a PO is always single-vendor). Backend lives in
// job_work_routes.py under /api/job-work/fabric-themes.

function authHeaders() {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/job-work${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Unable to complete this action.");
  return data;
}

function Modal({ title, subtitle, children, onClose, wide = false }) {
  // Portalled straight to document.body — same containing-block reasoning
  // as every other modal in this feature (see FabricBuyingCart.jsx's Modal).
  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <section className={`${wide ? "max-w-5xl" : "max-w-lg"} max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl`}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-600">Fabric theme</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-lg text-slate-500 transition hover:bg-slate-50" aria-label="Close">×</button>
        </header>
        {children}
      </section>
    </div>,
    document.body
  );
}

const statusTone = {
  draft: "bg-slate-100 text-slate-700",
  ordered: "bg-emerald-50 text-emerald-700",
};

function CreateThemeModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ theme_name: "", target_date: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await request("/fabric-themes", { method: "POST", body: JSON.stringify(form) });
      onCreated(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="New fabric theme" subtitle="e.g. Summer 2026, Festive Collection" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-6">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
        <label className="block text-sm font-bold text-slate-700">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Theme name *</span>
          <input required value={form.theme_name} onChange={(e) => setForm((f) => ({ ...f, theme_name: e.target.value }))} placeholder="Summer 2026" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
        </label>
        <label className="block text-sm font-bold text-slate-700">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Target date</span>
          <input type="date" value={form.target_date} onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
        </label>
        <label className="block text-sm font-bold text-slate-700">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Notes</span>
          <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
          <button disabled={saving} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Creating…" : "Create theme"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ThemeDetailModal({ themeId, vendors, onClose, onChanged }) {
  const [theme, setTheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [vendorId, setVendorId] = useState("");
  const [storefront, setStorefront] = useState(null);
  const [storefrontLoading, setStorefrontLoading] = useState(false);
  const [addQty, setAddQty] = useState({});
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeForm, setFinalizeForm] = useState({ order_date: new Date().toISOString().slice(0, 10), expected_delivery_date: "", payment_terms: "" });

  const showNotice = (message) => { setNotice(message); window.setTimeout(() => setNotice(""), 4000); };

  const reload = async () => {
    try {
      const result = await request(`/fabric-themes/${themeId}`);
      setTheme(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [themeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    if (!vendorId) { setStorefront(null); return undefined; }
    setStorefrontLoading(true);
    fetch(`${API_BASE_URL}/api/catalogue/vendor/${vendorId}/storefront`, { headers: authHeaders() })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail || "Could not load supplier catalogue.");
        if (!cancelled) setStorefront(body.data || null);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setStorefrontLoading(false); });
    return () => { cancelled = true; };
  }, [vendorId]);

  const fabricItems = (storefront?.items || []).filter((item) => item.catalogue_kind === "fabric_material");

  const addLine = async (item) => {
    const specs = item.fabric_specs || {};
    const quantity = Number(addQty[item._id] || item.moq || 1);
    try {
      await request(`/fabric-themes/${themeId}/lines`, {
        method: "POST",
        body: JSON.stringify({
          vendor_id: vendorId,
          catalogue_item_id: item._id,
          fabric_name: item.item_name,
          fabric_type: specs.fabric_type || "",
          gsm: specs.gsm || "",
          width: specs.width || "",
          color: specs.shade || "",
          quantity,
          unit: String(specs.rate_unit || "m").toLowerCase().includes("kg") ? "kg" : "m",
          rate: item.price || 0,
          image_url: item.images?.[0] || "",
        }),
      });
      showNotice(`Added ${item.item_name} to the theme.`);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateLine = async (lineId, field, value) => {
    try {
      await request(`/fabric-themes/${themeId}/lines/${lineId}`, { method: "PATCH", body: JSON.stringify({ [field]: value }) });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeLine = async (lineId) => {
    try {
      await request(`/fabric-themes/${themeId}/lines/${lineId}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteTheme = async () => {
    if (!window.confirm("Delete this draft theme? This cannot be undone.")) return;
    try {
      await request(`/fabric-themes/${themeId}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const finalize = async () => {
    if (!window.confirm("Finalize this theme? One purchase order will be created per supplier and lines can no longer be edited.")) return;
    setFinalizing(true);
    try {
      const result = await request(`/fabric-themes/${themeId}/finalize`, { method: "POST", body: JSON.stringify(finalizeForm) });
      showNotice(result.message);
      await reload();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) return <Modal title="Loading theme…" onClose={onClose}><div className="p-10 text-center text-sm text-slate-400">Loading…</div></Modal>;
  if (!theme) return <Modal title="Theme not found" onClose={onClose}><div className="p-6 text-sm text-rose-600">{error || "This theme could not be loaded."}</div></Modal>;

  const isDraft = theme.status === "draft";
  const lines = theme.lines || [];
  const total = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.rate || 0), 0);
  const linesByVendor = lines.reduce((acc, line) => {
    const key = line.vendor_name || "Unassigned";
    (acc[key] = acc[key] || []).push(line);
    return acc;
  }, {});

  return (
    <Modal wide title={theme.theme_name} subtitle={theme.target_date ? `Target: ${theme.target_date}` : undefined} onClose={onClose}>
      <div className="p-6 space-y-5">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</div>}

        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${statusTone[theme.status] || "bg-slate-100 text-slate-600"}`}>{theme.status}</span>
          <span className="text-xs font-bold text-slate-500">{lines.length} selection{lines.length === 1 ? "" : "s"} · Est. value ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
        </div>

        {isDraft && (
          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Browse a supplier's fabric catalogue</p>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium">
              <option value="">Select a fabric supplier</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            {vendorId && (
              storefrontLoading ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs font-bold text-slate-400">Loading catalogue…</div>
              ) : fabricItems.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {fabricItems.map((item) => {
                    const specs = item.fabric_specs || {};
                    const chips = [specs.fabric_type, specs.gsm ? `${specs.gsm} GSM` : "", specs.width, specs.shade].filter(Boolean);
                    return (
                      <article key={item._id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-sm font-black text-slate-900">{item.item_name}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {chips.map((chip) => <span key={chip} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{chip}</span>)}
                        </div>
                        <p className="mt-1.5 text-xs font-bold text-slate-500">₹{Number(item.price || 0).toLocaleString("en-IN")} / {String(specs.rate_unit || "m").toLowerCase().includes("kg") ? "kg" : "m"}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <input type="number" min="0.1" step="any" placeholder="Qty" value={addQty[item._id] ?? ""} onChange={(e) => setAddQty((q) => ({ ...q, [item._id]: e.target.value }))} className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-xs" />
                          <button type="button" onClick={() => addLine(item)} className="flex-1 rounded-lg bg-violet-600 px-2 py-1.5 text-xs font-bold text-white hover:bg-violet-700">Add to theme</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-400">This supplier has no fabric catalogue items yet.</p>
              )
            )}
          </section>
        )}

        <section>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Selections {isDraft ? "(edit before finalizing)" : ""}</p>
          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-400">No fabric added to this theme yet.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(linesByVendor).map(([vendorName, vendorLines]) => (
                <div key={vendorName} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">{vendorName}</div>
                  <div className="divide-y divide-slate-100">
                    {vendorLines.map((line) => (
                      <div key={line.line_id} className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-[1.3fr_90px_90px_1fr_36px] sm:items-center">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{line.fabric_name}</p>
                          <p className="text-[11px] text-slate-500">{[line.fabric_type, line.gsm && `${line.gsm} GSM`, line.width, line.color].filter(Boolean).join(" · ")}</p>
                        </div>
                        <input type="number" min="0.1" step="any" disabled={!isDraft} value={line.quantity} onChange={(e) => updateLine(line.line_id, "quantity", e.target.value)} className="h-8 rounded-lg border border-slate-200 px-2 text-xs disabled:bg-slate-50" />
                        <input type="number" min="0" step="any" disabled={!isDraft} value={line.rate} onChange={(e) => updateLine(line.line_id, "rate", e.target.value)} className="h-8 rounded-lg border border-slate-200 px-2 text-xs disabled:bg-slate-50" />
                        <p className="text-xs font-bold text-slate-600 text-right sm:text-left">₹{(Number(line.quantity || 0) * Number(line.rate || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                        {isDraft && <button type="button" onClick={() => removeLine(line.line_id)} className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-50" title="Remove">×</button>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {isDraft ? (
          <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-violet-700 mb-2">Finalize — creates one PO per supplier</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold text-slate-600">Order date<input type="date" value={finalizeForm.order_date} onChange={(e) => setFinalizeForm((f) => ({ ...f, order_date: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></label>
              <label className="text-xs font-bold text-slate-600">Expected delivery<input type="date" value={finalizeForm.expected_delivery_date} onChange={(e) => setFinalizeForm((f) => ({ ...f, expected_delivery_date: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></label>
              <label className="text-xs font-bold text-slate-600">Payment terms<input value={finalizeForm.payment_terms} onChange={(e) => setFinalizeForm((f) => ({ ...f, payment_terms: e.target.value }))} placeholder="e.g. 30% advance" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></label>
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-3">
              <button type="button" onClick={deleteTheme} className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">Delete draft theme</button>
              <button type="button" disabled={finalizing || lines.length === 0} onClick={finalize} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{finalizing ? "Creating POs…" : "Finalize → Create purchase order(s)"}</button>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700 mb-2">Purchase orders created from this theme</p>
            <div className="space-y-2">
              {(theme.purchase_orders || []).map((po) => (
                <div key={po.purchase_order_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs">
                  <span className="font-bold text-sky-700">{po.purchase_order_no}</span>
                  <span className="text-slate-500">{po.vendor_name}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-emerald-800">Manage sending, editing or reviewing each PO from the Order Details tab.</p>
          </section>
        )}
      </div>
    </Modal>
  );
}

export default function FabricThemesSection({ vendors }) {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [openThemeId, setOpenThemeId] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const result = await request("/fabric-themes");
      setThemes(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="font-black text-slate-900">Fabric Themes</p>
          <p className="text-xs text-slate-500 mt-0.5">Collect fabric picks across several suppliers under one seasonal requirement, then finalize into one PO per supplier.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100">+ New theme</button>
      </div>

      {error && <div className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
      ) : themes.length === 0 ? (
        <div className="p-10 text-center">
          <p className="font-black text-slate-700">No fabric themes yet</p>
          <p className="mt-1 text-xs text-slate-500">Click "+ New theme" to start collecting fabric picks for a season or collection.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {themes.map((theme) => {
            const total = (theme.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.rate || 0), 0);
            return (
              <button key={theme.id} type="button" onClick={() => setOpenThemeId(theme.id)} className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900">{theme.theme_name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusTone[theme.status] || "bg-slate-100 text-slate-600"}`}>{theme.status}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{(theme.lines || []).length} selection{(theme.lines || []).length === 1 ? "" : "s"}{theme.target_date ? ` · Target ${theme.target_date}` : ""}</p>
                </div>
                <p className="font-bold text-slate-900">₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
              </button>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateThemeModal onClose={() => setShowCreate(false)} onCreated={(theme) => { setShowCreate(false); reload(); setOpenThemeId(theme.id); }} />
      )}
      {openThemeId && (
        <ThemeDetailModal themeId={openThemeId} vendors={vendors} onClose={() => setOpenThemeId(null)} onChanged={reload} />
      )}
    </div>
  );
}
