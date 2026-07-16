import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../config/api.js";

const JOB_WORK_TYPES = ["Cutting", "Stitching", "Finishing", "Embroidery", "Washing", "Packing", "Other"];

const emptyOrder = {
  job_worker_name: "",
  vendor_id: "",
  job_work_type: "Cutting",
  finished_product: "",
  expected_quantity: "",
  unit: "pcs",
  due_date: "",
  remarks: "",
};

const emptyPlan = {
  style_name: "",
  style_code: "",
  planned_quantity: "",
  finished_unit: "pcs",
  wastage_pct: "5",
  materials: [{ material_name: "", specification: "", consumption_per_unit: "", unit: "m", rate: "" }],
};

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
  if (!response.ok) throw new Error(data.detail || "Unable to complete this job-work action.");
  return data;
}

const statusStyle = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  ISSUED: "bg-amber-50 text-amber-700 ring-amber-200",
  PARTIALLY_RECEIVED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Production control</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-xl text-slate-500 transition hover:bg-slate-100" aria-label="Close">×</button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function ProductionJobWork() {
  const [orders, setOrders] = useState([]);
  const [stock, setStock] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [plans, setPlans] = useState([]);
  const [dashboard, setDashboard] = useState({ active_orders: 0, with_job_workers: 0, completed_orders: 0, recorded_wastage: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(null);
  const [orderForm, setOrderForm] = useState(emptyOrder);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [orderData, stockData, dashboardData, vendorData, planData] = await Promise.all([
        request("/orders"), request("/material-stock"), request("/dashboard"), request("/vendors"), request("/material-plans"),
      ]);
      setOrders(orderData.data || []);
      setStock(stockData.data || []);
      setDashboard(dashboardData || {});
      setVendors(vendorData.data || []);
      setPlans(planData.data || []);
    } catch (err) {
      setError(err.message || "Could not load production and job-work data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const materialSummary = useMemo(() => stock.reduce((sum, item) => sum + Number(item.available_qty || 0), 0), [stock]);

  const closeModal = () => { setModal(null); setSaving(false); };
  const showNotice = (message) => { setNotice(message); window.setTimeout(() => setNotice(""), 5000); };

  async function createOrder(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await request("/orders", { method: "POST", body: JSON.stringify(orderForm) });
      showNotice(result.message);
      setOrderForm(emptyOrder);
      closeModal();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  async function createPlan(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await request("/material-plans", { method: "POST", body: JSON.stringify(planForm) });
      showNotice(result.message);
      setPlanForm(emptyPlan);
      closeModal();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  async function createFabricPO(plan, vendorId) {
    setSaving(true);
    try {
      const result = await request(`/material-plans/${plan.id}/purchase-order`, { method: "POST", body: JSON.stringify({ vendor_id: vendorId }) });
      showNotice(result.message);
      closeModal();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  return (
    <main className="min-h-full bg-gradient-to-br from-slate-50 via-violet-50/40 to-cyan-50/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 rounded-3xl border border-violet-100 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-2xl shadow-lg shadow-violet-200">✂</div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Central operations</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Production & Job Work</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">Issue retailer-owned fabric to cutting or stitching partners, reconcile returns and waste, then receive finished goods into central inventory.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={refresh} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">↻ Refresh</button>
            <button type="button" onClick={() => setModal({ type: "plan" })} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 transition hover:bg-violet-100">⊞ Style BOM & fabric plan</button>
            <button type="button" onClick={() => setModal({ type: "create" })} className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:brightness-105">+ New job work order</button>
          </div>
        </div>

        {notice && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">✓ {notice}</div>}
        {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Active orders", dashboard.active_orders || 0, "Draft, issued and partially received", "bg-violet-600"],
            ["With job workers", dashboard.with_job_workers || 0, "Material currently outside", "bg-amber-500"],
            ["Completed orders", dashboard.completed_orders || 0, "Fully reconciled jobs", "bg-emerald-600"],
            ["Recorded wastage", dashboard.recorded_wastage || 0, "Material units recorded", "bg-rose-500"],
          ].map(([label, value, caption, color]) => <article key={label} className="rounded-2xl border border-white bg-white p-5 shadow-sm"><span className={`mb-4 block h-1.5 w-12 rounded-full ${color}`} /><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-1 text-3xl font-black text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-400">{caption}</p></article>)}
        </section>

        <MaterialPlanList plans={plans} vendors={vendors} onCreatePO={(plan) => setModal({ type: "purchase-plan", plan })} />

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center">
            <div><h2 className="font-black text-slate-900">Job work orders</h2><p className="mt-1 text-sm text-slate-500">{orders.length} orders · {stock.length} issue-ready material SKUs · {materialSummary.toLocaleString()} available units</p></div>
            <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">Central inventory only</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[950px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-4">Order</th><th className="px-4 py-4">Job worker</th><th className="px-4 py-4">Finished product</th><th className="px-4 py-4">Expected</th><th className="px-4 py-4">Material status</th><th className="px-4 py-4">Status</th><th className="px-6 py-4 text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan="7" className="px-6 py-14 text-center text-slate-400">Loading production records…</td></tr> : orders.length === 0 ? <tr><td colSpan="7" className="px-6 py-16 text-center"><div className="text-3xl">✂</div><p className="mt-3 font-bold text-slate-700">No job work orders yet</p><p className="mt-1 text-sm text-slate-400">Create an order before sending material to a cutting or stitching partner.</p></td></tr> : orders.map((order) => {
                  const materials = order.materials || [];
                  const outstanding = materials.reduce((sum, line) => sum + Math.max(0, Number(line.issued_qty || 0) - Number(line.used_qty || 0) - Number(line.returned_qty || 0) - Number(line.waste_qty || 0)), 0);
                  return <tr key={order.id} className="transition hover:bg-violet-50/30"><td className="px-6 py-4"><p className="font-extrabold text-slate-900">{order.order_no}</p><p className="mt-1 text-xs text-slate-400">Due: {order.due_date || "Not set"}</p></td><td className="px-4 py-4"><p className="font-bold text-slate-800">{order.job_worker_name}</p><p className="mt-1 text-xs font-semibold text-violet-600">{order.job_work_type}</p></td><td className="px-4 py-4 font-semibold text-slate-700">{order.finished_product}</td><td className="px-4 py-4 font-bold text-slate-800">{order.expected_quantity} {order.unit}</td><td className="px-4 py-4"><p className="font-semibold text-slate-700">{materials.length ? `${materials.length} material line${materials.length === 1 ? "" : "s"}` : "Not issued"}</p>{materials.length > 0 && <p className="mt-1 text-xs text-slate-400">Outstanding: {outstanding.toLocaleString()}</p>}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusStyle[order.status] || statusStyle.DRAFT}`}>{String(order.status || "DRAFT").replaceAll("_", " ")}</span></td><td className="px-6 py-4 text-right">{order.status === "DRAFT" ? <button onClick={() => setModal({ type: "issue", order })} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600">Issue material</button> : order.status !== "COMPLETED" ? <button onClick={() => setModal({ type: "receive", order })} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Receive work</button> : <span className="text-xs font-bold text-emerald-600">Reconciled ✓</span>}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
        <p className="mt-4 px-2 text-xs leading-5 text-slate-500">Normal supplier purchasing remains unchanged: use PO → GRC → GRN for purchased fabric. Use this workspace only when your own material is sent to an outside job worker for processing.</p>
      </div>

      {modal?.type === "create" && <CreateOrderModal form={orderForm} setForm={setOrderForm} vendors={vendors} onClose={closeModal} onSubmit={createOrder} saving={saving} />}
      {modal?.type === "plan" && <CreateMaterialPlanModal form={planForm} setForm={setPlanForm} onClose={closeModal} onSubmit={createPlan} saving={saving} />}
      {modal?.type === "purchase-plan" && <CreateFabricPOModal plan={modal.plan} vendors={vendors} onClose={closeModal} onSubmit={createFabricPO} saving={saving} />}
      {modal?.type === "issue" && <IssueMaterialModal order={modal.order} stock={stock} onClose={closeModal} onSaved={async (message) => { closeModal(); showNotice(message); await refresh(); }} setError={setError} />}
      {modal?.type === "receive" && <ReceiveWorkModal order={modal.order} onClose={closeModal} onSaved={async (message) => { closeModal(); showNotice(message); await refresh(); }} setError={setError} />}
    </main>
  );
}

function MaterialPlanList({ plans, vendors, onCreatePO }) {
  return <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-violet-600">Before buying fabric</p><h2 className="mt-1 font-black text-slate-900">Style BOM & material plans</h2><p className="mt-1 text-sm text-slate-500">Calculate metres from garment consumption, planned quantity and wastage, then create a normal Fabric PO draft.</p></div><span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">{plans.length} plan{plans.length === 1 ? "" : "s"}</span></div>{plans.length === 0 ? <div className="px-6 py-10 text-center text-sm text-slate-400">No material plans yet. Create a Style BOM & fabric plan to calculate your fabric requirement.</div> : <div className="divide-y divide-slate-100">{plans.slice(0, 8).map((plan) => <article key={plan.id} className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{plan.style_name}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{plan.plan_no}</span>{plan.purchase_order_no && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">PO {plan.purchase_order_no}</span>}</div><p className="mt-1 text-sm text-slate-500">{plan.planned_quantity} {plan.finished_unit} planned · {plan.wastage_pct}% wastage · {plan.materials?.length || 0} material line(s)</p><div className="mt-2 flex flex-wrap gap-2">{(plan.materials || []).map((material) => <span key={`${plan.id}-${material.material_name}`} className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600"><b>{material.required_quantity} {material.unit}</b> {material.material_name}</span>)}</div></div>{plan.purchase_order_no ? <span className="text-sm font-bold text-emerald-700">Fabric PO created ✓</span> : <button onClick={() => onCreatePO(plan)} disabled={!vendors.length} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Create Fabric PO</button>}</article>)}</div>}</section>;
}

function CreateMaterialPlanModal({ form, setForm, onClose, onSubmit, saving }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const changeMaterial = (index, key, value) => setForm((current) => ({ ...current, materials: current.materials.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line) }));
  const calculated = form.materials.map((line) => Number(form.planned_quantity || 0) * Number(line.consumption_per_unit || 0) * (1 + Number(line.wastage_pct || form.wastage_pct || 0) / 100));
  return <Modal title="Style BOM & fabric material plan" onClose={onClose}><form onSubmit={onSubmit} className="p-6"><p className="mb-5 rounded-2xl bg-violet-50 p-4 text-sm text-violet-800">Define how much fabric one garment consumes. RMS calculates the purchase quantity in metres including planned wastage, then can create a normal Fabric PO draft.</p><div className="grid gap-4 md:grid-cols-2"><Field label="Style / product name *"><input required value={form.style_name} onChange={(e) => update("style_name", e.target.value)} placeholder="e.g. Men's Cotton T-shirt" /></Field><Field label="Style code"><input value={form.style_code} onChange={(e) => update("style_code", e.target.value)} placeholder="e.g. CT-SS-101" /></Field><Field label="Planned production quantity *"><div className="grid grid-cols-[1fr_100px] gap-2"><input required min="1" step="any" type="number" value={form.planned_quantity} onChange={(e) => update("planned_quantity", e.target.value)} placeholder="e.g. 1000" /><input value={form.finished_unit} onChange={(e) => update("finished_unit", e.target.value)} placeholder="pcs" /></div></Field><Field label="Default wastage %"><input min="0" max="100" step="any" type="number" value={form.wastage_pct} onChange={(e) => update("wastage_pct", e.target.value)} /></Field></div><div className="mt-6 overflow-hidden rounded-2xl border border-slate-200"><div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_105px_75px_105px_32px] gap-2 bg-slate-50 px-3 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500"><span>Fabric / material</span><span>Pattern, GSM, width, colour</span><span>Per garment</span><span>Unit</span><span>To purchase</span><span /></div>{form.materials.map((line, index) => <div key={index} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_105px_75px_105px_32px] items-center gap-2 border-t border-slate-100 px-3 py-3"><input required value={line.material_name} onChange={(e) => changeMaterial(index, "material_name", e.target.value)} placeholder="Cotton jersey fabric" /><input value={line.specification} onChange={(e) => changeMaterial(index, "specification", e.target.value)} placeholder="180 GSM, 60 inch, navy" /><input required min="0.0001" step="any" type="number" value={line.consumption_per_unit} onChange={(e) => changeMaterial(index, "consumption_per_unit", e.target.value)} placeholder="1.6" /><input value={line.unit} onChange={(e) => changeMaterial(index, "unit", e.target.value)} placeholder="m" /><span className="text-right text-sm font-black text-violet-700">{calculated[index].toFixed(3)}</span><button type="button" disabled={form.materials.length === 1} onClick={() => setForm((current) => ({ ...current, materials: current.materials.filter((_, lineIndex) => lineIndex !== index) }))} className="text-lg font-bold text-rose-500 disabled:text-slate-300">×</button><div className="col-span-6 grid grid-cols-[150px_1fr] items-center gap-2"><span className="text-xs font-semibold text-slate-500">Rate / {line.unit || "m"} (optional)</span><input min="0" step="any" type="number" value={line.rate} onChange={(e) => changeMaterial(index, "rate", e.target.value)} placeholder="Enter negotiated supplier rate, or leave 0 and complete it in the PO" /></div></div>)}</div><button type="button" onClick={() => setForm((current) => ({ ...current, materials: [...current.materials, { material_name: "", specification: "", consumption_per_unit: "", unit: "m", rate: "" }] }))} className="mt-3 text-sm font-bold text-violet-700">+ Add fabric / trim</button><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Calculating…" : "Save material plan"}</button></div></form></Modal>;
}

function CreateFabricPOModal({ plan, vendors, onClose, onSubmit, saving }) {
  const [vendorId, setVendorId] = useState("");
  return <Modal title={`Create Fabric PO · ${plan.plan_no}`} onClose={onClose}><div className="p-6"><p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">This will create a <b>Draft</b> in the existing Purchase Order module. Review prices, tax and terms there before sending it to the fabric supplier.</p><div className="mt-5"><Field label="Approved fabric supplier *"><select required value={vendorId} onChange={(e) => setVendorId(e.target.value)}><option value="">Select supplier</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></Field></div><div className="mt-5 overflow-hidden rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Material</th><th className="px-3 py-2">Specification</th><th className="px-3 py-2 text-right">Required</th></tr></thead><tbody>{(plan.materials || []).map((material) => <tr key={material.material_name} className="border-t border-slate-100"><td className="px-3 py-2.5 font-semibold text-slate-700">{material.material_name}</td><td className="px-3 py-2.5 text-slate-500">{material.specification || "—"}</td><td className="px-3 py-2.5 text-right font-black text-violet-700">{material.required_quantity} {material.unit}</td></tr>)}</tbody></table></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button type="button" disabled={saving || !vendorId} onClick={() => onSubmit(plan, vendorId)} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Creating…" : "Create draft PO"}</button></div></div></Modal>;
}

function CreateOrderModal({ form, setForm, vendors, onClose, onSubmit, saving }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const chooseVendor = (vendorId) => {
    const vendor = vendors.find((item) => item.id === vendorId);
    setForm((current) => ({ ...current, vendor_id: vendorId, job_worker_name: vendor?.name || "" }));
  };
  return <Modal title="Create job work order" onClose={onClose}><form onSubmit={onSubmit} className="p-6"><div className="grid gap-4 md:grid-cols-2"><Field label="Registered RMS vendor (recommended)"><select value={form.vendor_id} onChange={(e) => chooseVendor(e.target.value)}><option value="">Manual / unregistered job worker</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.business_type?.length ? ` · ${vendor.business_type.join(", ")}` : ""}</option>)}</select></Field><Field label="Job worker name *"><input required={!form.vendor_id} readOnly={Boolean(form.vendor_id)} value={form.job_worker_name} onChange={(e) => update("job_worker_name", e.target.value)} placeholder="e.g. ABC Cutting Works" /></Field><Field label="Job work type *"><select value={form.job_work_type} onChange={(e) => update("job_work_type", e.target.value)}>{JOB_WORK_TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field><Field label="Finished product / style *"><input required value={form.finished_product} onChange={(e) => update("finished_product", e.target.value)} placeholder="e.g. Men's cotton T-shirt" /></Field><Field label="Expected output *"><div className="grid grid-cols-[1fr_110px] gap-2"><input required min="0.001" step="any" type="number" value={form.expected_quantity} onChange={(e) => update("expected_quantity", e.target.value)} placeholder="Quantity" /><input value={form.unit} onChange={(e) => update("unit", e.target.value)} placeholder="pcs" /></div></Field><Field label="Expected completion"><input type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} /></Field><Field label="Notes"><input value={form.remarks} onChange={(e) => update("remarks", e.target.value)} placeholder="Style, measurements or instructions" /></Field></div><div className="mt-6 rounded-2xl bg-violet-50 p-4 text-sm text-violet-800"><b>Registered vendor:</b> the order becomes visible in their Vendor Portal after material is issued. Manual workers remain internal only.<br /><span className="mt-1 block"><b>Next:</b> create the material issue challan when fabric is physically sent. It will move that quantity out of central available stock into this job-work order.</span></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Creating…" : "Create order"}</button></div></form></Modal>;
}

function IssueMaterialModal({ order, stock, onClose, onSaved, setError }) {
  const [lines, setLines] = useState([{ barcode: "", issued_qty: "" }]);
  const [challanNo, setChallanNo] = useState("");
  const [saving, setSaving] = useState(false);
  const change = (index, key, value) => setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line));
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { const materials = lines.map((line) => { const selected = stock.find((item) => item.barcode === line.barcode) || {}; return { ...line, product: selected.product, rate: selected.rate, unit: selected.unit }; }); const result = await request(`/orders/${order.id}/issue`, { method: "POST", body: JSON.stringify({ challan_no: challanNo, materials }) }); await onSaved(result.message); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  return <Modal title={`Issue material · ${order.order_no}`} onClose={onClose}><form onSubmit={submit} className="p-6"><div className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><b>{order.job_worker_name}</b> · {order.job_work_type}<br /><span className="text-amber-700">Issue only material that has physically left central inventory. The quantity is no longer available for other operations.</span></div><Field label="Material issue challan no. (optional)"><input value={challanNo} onChange={(e) => setChallanNo(e.target.value)} placeholder="Auto-generated if left blank" /></Field><div className="mt-5 overflow-hidden rounded-2xl border border-slate-200"><div className="grid grid-cols-[minmax(0,1fr)_120px_40px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500"><span>Material from central stock</span><span>Issued qty</span><span /></div>{lines.map((line, index) => { const selected = stock.find((item) => item.barcode === line.barcode); return <div key={index} className="grid grid-cols-[minmax(0,1fr)_120px_40px] items-center gap-3 border-t border-slate-100 px-4 py-3"><select required value={line.barcode} onChange={(e) => change(index, "barcode", e.target.value)}><option value="">Select barcode / material</option>{stock.map((item) => <option key={item.barcode} value={item.barcode}>{item.product} · {item.barcode} · available {item.available_qty} {item.unit}</option>)}</select><input required min="0.001" step="any" type="number" value={line.issued_qty} onChange={(e) => change(index, "issued_qty", e.target.value)} placeholder={selected ? `Max ${selected.available_qty}` : "Qty"} /><button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="text-xl font-bold text-rose-500 disabled:text-slate-300">×</button></div>; })}</div><button type="button" onClick={() => setLines((current) => [...current, { barcode: "", issued_qty: "" }])} className="mt-3 text-sm font-bold text-violet-700">+ Add material</button><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving || stock.length === 0} className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Issuing…" : "Create issue challan"}</button></div></form></Modal>;
}

function ReceiveWorkModal({ order, onClose, onSaved, setError }) {
  const [reconciliation, setReconciliation] = useState(() => (order.materials || []).map((line) => ({ barcode: line.barcode, used_qty: "", returned_qty: "", waste_qty: "" })));
  const [output, setOutput] = useState({ barcode: "", product: order.finished_product || "", quantity: "", rate: "" });
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const updateLine = (index, key, value) => setReconciliation((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line));
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { const result = await request(`/orders/${order.id}/receipts`, { method: "POST", body: JSON.stringify({ materials: reconciliation, output, remarks }) }); await onSaved(result.message); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  return <Modal title={`Receive job work · ${order.order_no}`} onClose={onClose}><form onSubmit={submit} className="p-6"><div className="mb-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">Reconcile all material returned from <b>{order.job_worker_name}</b>. Returned fabric goes back to central stock; used and waste quantities remain recorded against this order.</div><div className="overflow-hidden rounded-2xl border border-slate-200"><div className="grid grid-cols-[minmax(140px,1fr)_105px_105px_105px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500"><span>Issued material</span><span>Used</span><span>Returned</span><span>Waste</span></div>{(order.materials || []).map((material, index) => { const outstanding = Number(material.issued_qty || 0) - Number(material.used_qty || 0) - Number(material.returned_qty || 0) - Number(material.waste_qty || 0); return <div key={material.barcode} className="grid grid-cols-[minmax(140px,1fr)_105px_105px_105px] items-center gap-3 border-t border-slate-100 px-4 py-3"><div><p className="font-bold text-slate-800">{material.product}</p><p className="text-xs text-slate-400">{material.barcode} · outstanding {outstanding.toLocaleString()} {material.unit}</p></div>{["used_qty", "returned_qty", "waste_qty"].map((key) => <input key={key} min="0" step="any" type="number" value={reconciliation[index]?.[key] ?? ""} onChange={(e) => updateLine(index, key, e.target.value)} placeholder="0" />)}</div>; })}</div><div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/60 p-4"><p className="mb-3 text-sm font-black text-violet-900">Finished goods received into central inventory</p><div className="grid gap-3 md:grid-cols-2"><Field label="Finished goods barcode *"><input required value={output.barcode} onChange={(e) => setOutput((current) => ({ ...current, barcode: e.target.value }))} placeholder="Scan or enter your RMS barcode" /></Field><Field label="Finished product"><input value={output.product} onChange={(e) => setOutput((current) => ({ ...current, product: e.target.value }))} /></Field><Field label="Finished quantity"><input min="0" step="any" type="number" value={output.quantity} onChange={(e) => setOutput((current) => ({ ...current, quantity: e.target.value }))} placeholder="0" /></Field><Field label="Unit rate (optional)"><input min="0" step="any" type="number" value={output.rate} onChange={(e) => setOutput((current) => ({ ...current, rate: e.target.value }))} placeholder="0" /></Field></div></div><div className="mt-4"><Field label="Receipt notes"><input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Quality remarks, shortage or issue details" /></Field></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving…" : "Record receipt"}</button></div></form></Modal>;
}

function Field({ label, children }) { return <label className="block text-sm font-bold text-slate-700"><span className="mb-1.5 block">{label}</span>{React.cloneElement(children, { className: "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100" })}</label>; }
