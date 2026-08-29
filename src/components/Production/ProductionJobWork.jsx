import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../config/api.js";
import { logoutOrReturnToDepartmentSelector } from "../../utils/authRedirect.js";
import { downloadFabricSheetCsv, downloadFabricSheetExcel, downloadFabricSheetPdf } from "../../utils/fabricSheetExport.js";
import { Modal, Field, CreateFabricPOModal } from "../shared/FabricBuyingCart.jsx";
import FabricThemesSection from "../Mbuyer/FabricThemes.jsx";
import FabricRequirementSummary from "../Mbuyer/FabricRequirementSummary.jsx";
import TechPackLibrary from "./TechPackLibrary.jsx";

const JOB_WORK_TYPES = ["Cutting", "Stitching", "Embroidery", "Printing", "Washing", "Finishing", "Packing", "Other"];
const DESIGN_DEPARTMENTS = ["Men", "Women", "Kids Boys", "Kids Girls", "Infant", "Accessories", "Other"];
const emptyDesignLine = () => ({ design_no: "", department: "Men", product_type: "", quantity: "", unit: "pcs", rate: "", remarks: "", tech_pack_id: "", images: [], imagePreviews: [] });

const emptyOrder = {
  job_worker_name: "",
  vendor_id: "",
  job_worker_mobile: "",
  job_worker_email: "",
  job_work_type: "Cutting",
  finished_product: "",
  expected_quantity: "",
  unit: "pcs",
  design_lines: [emptyDesignLine()],
  due_date: "",
  remarks: "",
  material_plan_id: "",
};

const emptyPlan = {
  style_name: "",
  style_code: "",
  planned_quantity: "",
  finished_unit: "pcs",
  wastage_pct: "5",
  materials: [{ material_name: "", specification: "", consumption_per_unit: "", unit: "m", rate: "" }],
};

function authHeaders(isFormData = false) {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function request(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}/api/job-work${path}`, {
    ...options,
    headers: { ...authHeaders(isFormData), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Unable to complete this job-work action.");
  return data;
}

async function addonRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/production-addon${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Unable to complete this action.");
  return data;
}


const statusStyle = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  ISSUED: "bg-amber-50 text-amber-700 ring-amber-200",
  PARTIALLY_RECEIVED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

// Real production workflow order: design reference → material calculation →
// procure fabric → issue/track/receive job work. "Overview" is the landing
// step, not part of the numbered sequence.
const WORKFLOW_STEPS = [
  { key: "overview", label: "Overview", icon: "📊" },
  { key: "techpack", label: "1 · Tech Pack", icon: "📐" },
  { key: "bom", label: "2 · Style BOM & Fabric Plan", icon: "🧮" },
  { key: "fabric", label: "3 · Fabric Buying", icon: "🧵" },
  { key: "orders", label: "4 · Job Work Orders", icon: "✂️" },
];

// Every Tailwind class below is written out in full (never built from a
// template literal) so the JIT scanner picks all of them up regardless of
// which step is active at runtime.
const STEP_STYLES = {
  overview: { active: "border-slate-700 bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-lg shadow-slate-300/50", chipActive: "border-slate-700 bg-slate-800 text-white", dot: "bg-slate-600" },
  techpack: { active: "border-fuchsia-500 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-lg shadow-fuchsia-200", chipActive: "border-fuchsia-500 bg-fuchsia-600 text-white", dot: "bg-fuchsia-600" },
  bom:      { active: "border-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200", chipActive: "border-indigo-500 bg-indigo-600 text-white", dot: "bg-indigo-600" },
  fabric:   { active: "border-cyan-500 bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg shadow-cyan-200", chipActive: "border-cyan-500 bg-cyan-600 text-white", dot: "bg-cyan-600" },
  orders:   { active: "border-amber-400 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-200", chipActive: "border-amber-400 bg-amber-500 text-white", dot: "bg-amber-500" },
};

function StepSidebar({ activeStep, setActiveStep, counts }) {
  return (
    <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:gap-2">
      {WORKFLOW_STEPS.map((step) => {
        const isActive = activeStep === step.key;
        const style = STEP_STYLES[step.key];
        const count = counts[step.key];
        return (
          <button key={step.key} type="button" onClick={() => setActiveStep(step.key)}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${isActive ? style.active : "border-white bg-white/80 text-slate-600 shadow-sm hover:border-slate-200 hover:bg-white"}`}>
            <span className="text-lg">{step.icon}</span>
            <span className="flex-1">{step.label}</span>
            {typeof count === "number" && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"}`}>{count}</span>
            )}
          </button>
        );
      })}
    </aside>
  );
}

function StepChips({ activeStep, setActiveStep }) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
      {WORKFLOW_STEPS.map((step) => {
        const isActive = activeStep === step.key;
        const style = STEP_STYLES[step.key];
        return (
          <button key={step.key} type="button" onClick={() => setActiveStep(step.key)}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${isActive ? style.chipActive : "border-slate-200 bg-white text-slate-600"}`}>
            {step.icon} {step.label}
          </button>
        );
      })}
    </div>
  );
}

const STEP_CARDS = [
  { key: "techpack", step: "1", title: "Tech Pack", desc: "Lock the approved design reference — sketch, spec sheet, artwork, trims, colourways.", grad: "from-fuchsia-600 to-pink-600" },
  { key: "bom", step: "2", title: "Style BOM & Fabric Plan", desc: "Calculate metres needed from garment consumption × quantity × wastage.", grad: "from-indigo-600 to-violet-600" },
  { key: "fabric", step: "3", title: "Fabric Buying", desc: "Pool fabric demand across themes, see what's in stock, raise supplier POs.", grad: "from-cyan-600 to-teal-600" },
  { key: "orders", step: "4", title: "Job Work Orders", desc: "Issue material to a job worker, track it, and reconcile on return.", grad: "from-amber-500 to-orange-500" },
];

function OverviewPanel({ dashboard, plans, techPacks, orders, stock, materialSummary, setActiveStep }) {
  const stepCounts = { techpack: techPacks.length, bom: plans.length, fabric: null, orders: orders.length };
  return (
    <div>
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STEP_CARDS.map((card) => (
          <button key={card.key} type="button" onClick={() => setActiveStep(card.key)}
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.grad} p-5 text-left shadow-lg transition duration-200 hover:-translate-y-0.5 hover:shadow-xl`}>
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/20 text-sm font-black text-white">{card.step}</span>
            <p className="mt-3 font-black text-white">{card.title}</p>
            <p className="mt-1 text-xs leading-5 text-white/85">{card.desc}</p>
            <div className="mt-3 flex items-center justify-between">
              {typeof stepCounts[card.key] === "number" ? <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white">{stepCounts[card.key]} so far</span> : <span />}
              <span className="text-xs font-bold text-white/90 group-hover:translate-x-0.5 transition">Open →</span>
            </div>
          </button>
        ))}
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active orders", dashboard.active_orders || 0, "Draft, issued and partially received", "bg-violet-600"],
          ["With job workers", dashboard.with_job_workers || 0, "Material currently outside", "bg-amber-500"],
          ["Completed orders", dashboard.completed_orders || 0, "Fully reconciled jobs", "bg-emerald-600"],
          ["Recorded wastage", dashboard.recorded_wastage || 0, "Material units recorded", "bg-rose-500"],
          ["Reusable leftover", dashboard.recorded_leftover || 0, "Remnants available to reuse", "bg-teal-500"],
        ].map(([label, value, caption, color]) => <article key={label} className="group relative overflow-hidden rounded-2xl border border-white/80 bg-white/80 p-5 shadow-lg shadow-indigo-100/40 backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-xl"><div className={`absolute right-0 top-0 h-20 w-20 rounded-bl-[48px] opacity-10 ${color}`} /><span className={`mb-4 block h-1.5 w-12 rounded-full ${color}`} /><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-3xl font-black tracking-tight text-slate-900">{value}</p><p className="mt-1 text-xs font-medium text-slate-400">{caption}</p></article>)}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 text-sm text-slate-600">
        <p className="font-black text-slate-900">Ready-to-issue material</p>
        <p className="mt-1">{stock.length} material SKU{stock.length === 1 ? "" : "s"} in central stock · {materialSummary.toLocaleString()} available units. Open <button type="button" onClick={() => setActiveStep("orders")} className="font-bold text-amber-700 underline">Job Work Orders</button> to issue material against an order.</p>
      </section>
    </div>
  );
}

export default function ProductionJobWork() {
  const [orders, setOrders] = useState([]);
  const [stock, setStock] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [fabricSuppliers, setFabricSuppliers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [techPacks, setTechPacks] = useState([]);
  const [dashboard, setDashboard] = useState({ active_orders: 0, with_job_workers: 0, completed_orders: 0, recorded_wastage: 0, recorded_leftover: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");
  const [modal, setModal] = useState(null);
  const [orderForm, setOrderForm] = useState(emptyOrder);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [saving, setSaving] = useState(false);
  const [sheetDownload, setSheetDownload] = useState(null); // { meta, items } once a Fabric PO is created
  const [addonStatus, setAddonStatus] = useState(null); // { enabled, request } — null while checking
  const [addonChecking, setAddonChecking] = useState(true);
  const [activeStep, setActiveStep] = useState("overview");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [orderData, stockData, dashboardData, vendorData, fabricSupplierData, planData, techPackData] = await Promise.all([
        request("/orders"), request("/material-stock"), request("/dashboard"), request("/vendors"), request("/vendors?kind=fabric_supplier"), request("/material-plans"), request("/tech-packs"),
      ]);
      setOrders(orderData.data || []);
      setStock(stockData.data || []);
      setDashboard(dashboardData || {});
      setVendors(vendorData.data || []);
      setFabricSuppliers(fabricSupplierData.data || []);
      setPlans(planData.data || []);
      setTechPacks(techPackData.data || []);
    } catch (err) {
      setError(err.message || "Could not load production and job-work data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAddon = useCallback(async () => {
    setAddonChecking(true);
    try {
      const status = await addonRequest("/me");
      setAddonStatus(status);
      if (status.enabled) await refresh();
    } catch {
      // If the status check itself fails, fall through to the normal
      // workspace — its own error banner will explain what went wrong.
      setAddonStatus({ enabled: true, request: null });
      await refresh();
    } finally {
      setAddonChecking(false);
    }
  }, [refresh]);

  useEffect(() => { checkAddon(); }, [checkAddon]);

  const materialSummary = useMemo(() => stock.reduce((sum, item) => sum + Number(item.available_qty || 0), 0), [stock]);

  const closeModal = () => { setModal(null); setSaving(false); };
  const showNotice = (message) => { setNotice(message); window.setTimeout(() => setNotice(""), 5000); };
  const showWarning = (message) => { setWarning(message); window.setTimeout(() => setWarning(""), 12000); };

  async function createOrder(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const designLines = (orderForm.design_lines || [])
        .map((line) => ({
          design_no: line.design_no,
          department: line.department,
          product_type: line.product_type,
          quantity: line.quantity,
          unit: line.unit,
          rate: line.rate,
          remarks: line.remarks,
          tech_pack_id: line.tech_pack_id,
        }))
        .filter((line) => String(line.design_no || line.product_type || "").trim() || Number(line.quantity) > 0);
      const imageCount = (orderForm.design_lines || []).reduce((sum, line) => sum + (line.images?.length || 0), 0);
      let result;
      if (imageCount > 0) {
        const body = new FormData();
        Object.entries({ ...orderForm, design_lines: JSON.stringify(designLines) }).forEach(([key, value]) => {
          if (key !== "design_lines" && key !== "images" && key !== "imagePreviews") body.append(key, value ?? "");
        });
        body.set("design_lines", JSON.stringify(designLines));
        (orderForm.design_lines || []).forEach((line, index) => {
          (line.images || []).forEach((file) => body.append(`design_image_${index}`, file));
        });
        result = await request("/orders", { method: "POST", body });
      } else {
        result = await request("/orders", { method: "POST", body: JSON.stringify({ ...orderForm, design_lines: designLines }) });
      }
      const extra = [result.email_sent ? "Email sent to the job worker." : "", result.whatsapp_url ? "WhatsApp message ready to send." : ""].filter(Boolean).join(" ");
      showNotice(extra ? `${result.message} ${extra}` : result.message);
      if (result.whatsapp_url) window.open(result.whatsapp_url, "_blank", "noopener,noreferrer");
      setOrderForm(emptyOrder);
      closeModal();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  async function linkTechPack(plan) {
    if (!plan.suggested_tech_pack) return;
    try {
      const result = await request(`/tech-packs/${plan.suggested_tech_pack.id}/link-material-plan`, { method: "PATCH", body: JSON.stringify({ material_plan_id: plan.id }) });
      showNotice(result.message);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
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

  async function createFabricPO(plan, payload) {
    setSaving(true);
    try {
      const result = await request(`/material-plans/${plan.id}/purchase-order`, { method: "POST", body: JSON.stringify(payload) });
      showNotice(result.share_link ? `${result.message} Walk-in share link generated.${result.email_sent ? " Email sent." : ""}` : `${result.message}${result.email_sent ? " Email sent." : ""}`);
      if (result.whatsapp_url) window.open(result.whatsapp_url, "_blank", "noopener,noreferrer");
      setSheetDownload({ meta: result, items: payload.items });
      closeModal();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  async function createManualFabricPO(payload) {
    setSaving(true);
    try {
      const result = await request("/fabric-purchase-orders", { method: "POST", body: JSON.stringify(payload) });
      showNotice(result.share_link ? `${result.message} Walk-in share link generated.${result.email_sent ? " Email sent." : ""}` : `${result.message}${result.email_sent ? " Email sent." : ""}`);
      if (result.whatsapp_url) window.open(result.whatsapp_url, "_blank", "noopener,noreferrer");
      setSheetDownload({ meta: result, items: payload.items });
      closeModal();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  if (addonChecking) {
    return <main className="grid min-h-full place-items-center bg-slate-50 p-8 text-sm font-semibold text-slate-400">Checking Production &amp; Job Work access…</main>;
  }

  if (addonStatus && !addonStatus.enabled) {
    return <AddonRequestScreen status={addonStatus} onRequested={(req) => setAddonStatus((current) => ({ ...current, request: req }))} />;
  }

  return (
    <main className="min-h-full bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.16),_transparent_30%),linear-gradient(135deg,_#f8fafc_0%,_#eef2ff_46%,_#ecfeff_100%)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative mb-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-800 p-6 shadow-2xl shadow-indigo-300/50 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-fuchsia-400/25 blur-3xl" /><div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
            <div className="flex items-start gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 text-2xl shadow-lg shadow-black/20">✂</div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Operations command centre</p><h1 className="mt-1 text-3xl font-black tracking-tight text-white">Production &amp; Job Work</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">Plan materials, send work to approved partners, track every issue and bring finished goods back into central inventory.</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">Plan → Issue → Reconcile → Receive</span><span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-100">Central inventory controlled</span></div></div></div>
            <div className="flex flex-wrap gap-2 xl:justify-end"><button type="button" onClick={refresh} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20">Refresh</button><button type="button" onClick={() => logoutOrReturnToDepartmentSelector()} className="rounded-xl border border-rose-300/25 bg-rose-400/10 px-4 py-2.5 text-sm font-bold text-rose-100 transition hover:bg-rose-400/20">Logout</button></div>
          </div>
        </div>
        {notice && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">✓ {notice}</div>}
        {warning && <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">⚠ {warning}</div>}
        {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

        <StepChips activeStep={activeStep} setActiveStep={setActiveStep} />

        <div className="flex gap-6">
          <StepSidebar activeStep={activeStep} setActiveStep={setActiveStep} counts={{ techpack: techPacks.length, bom: plans.length, orders: orders.length }} />

          <div className="min-w-0 flex-1">
            {activeStep === "overview" && (
              <OverviewPanel dashboard={dashboard} plans={plans} techPacks={techPacks} orders={orders} stock={stock} materialSummary={materialSummary} setActiveStep={setActiveStep} />
            )}

            {activeStep === "techpack" && (
              <TechPackLibrary plans={plans} onSelectForOrder={(pack) => { setOrderForm({ ...emptyOrder, finished_product: pack.style_name || "", design_lines: [{ ...emptyDesignLine(), tech_pack_id: pack.id, design_no: pack.design_no || "", department: pack.department || "Men", product_type: pack.style_name || "" }] }); setModal({ type: "create" }); }} />
            )}

            {activeStep === "bom" && (
              <section className="mb-6 overflow-hidden rounded-3xl border border-white bg-white/90 shadow-xl shadow-indigo-100/40 backdrop-blur">
                <div className="flex flex-col justify-between gap-3 border-b border-indigo-100/80 bg-gradient-to-r from-white via-indigo-50/60 to-cyan-50/70 px-6 py-5 sm:flex-row sm:items-center">
                  <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-600">Step 2</p><h2 className="mt-0.5 font-black text-slate-900">Style BOM & Fabric Plan</h2><p className="mt-1 text-sm text-slate-500">Calculate metres from garment consumption, planned quantity and wastage.</p></div>
                  <button type="button" onClick={() => setModal({ type: "plan" })} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700">+ Style BOM & fabric plan</button>
                </div>
                <div className="p-0">
                  <MaterialPlanList plans={plans} onCreatePO={(plan) => setModal({ type: "purchase-plan", plan })} onStartJob={(plan) => { setOrderForm({ ...emptyOrder, material_plan_id: plan.id, finished_product: plan.style_name || "", expected_quantity: String(plan.planned_quantity || ""), unit: plan.finished_unit || "pcs", design_lines: [{ ...emptyDesignLine(), design_no: plan.style_code || plan.plan_no || "", product_type: plan.style_name || "", quantity: String(plan.planned_quantity || ""), unit: plan.finished_unit || "pcs" }] }); setModal({ type: "create" }); }} onLinkTechPack={linkTechPack} embedded />
                </div>
              </section>
            )}

            {activeStep === "fabric" && (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/60 px-5 py-4">
                  <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-700">Step 3</p><h2 className="mt-0.5 font-black text-slate-900">Fabric Buying</h2><p className="mt-1 text-sm text-slate-500">Pool fabric across themes, see what's already in stock, and raise POs with fabric suppliers.</p></div>
                  <button type="button" onClick={() => setModal({ type: "fabric-cart" })} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-cyan-200 hover:bg-cyan-700">+ Buy fabric cart</button>
                </div>
                <section className="mb-6">
                  <FabricThemesSection vendors={fabricSuppliers} plans={plans} />
                </section>
                <section className="mb-6">
                  <FabricRequirementSummary />
                </section>
              </>
            )}

            {activeStep === "orders" && (
              <section className="overflow-hidden rounded-3xl border border-white bg-white/90 shadow-xl shadow-indigo-100/40 backdrop-blur">
                <div className="flex flex-col justify-between gap-3 border-b border-indigo-100/80 bg-gradient-to-r from-white via-amber-50/60 to-orange-50/60 px-6 py-5 sm:flex-row sm:items-center">
                  <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-700">Step 4</p><h2 className="mt-0.5 font-black text-slate-900">Job work orders</h2><p className="mt-1 text-sm text-slate-500">{orders.length} orders · {stock.length} issue-ready material SKUs · {materialSummary.toLocaleString()} available units</p></div>
                  <div className="flex items-center gap-2"><span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">Central inventory only</span><button type="button" onClick={() => setModal({ type: "create" })} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-amber-200 hover:bg-amber-600">+ New job work order</button></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[950px] w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-4">Order</th><th className="px-4 py-4">Job worker</th><th className="px-4 py-4">Finished product</th><th className="px-4 py-4">Expected</th><th className="px-4 py-4">Material status</th><th className="px-4 py-4">Status</th><th className="px-6 py-4 text-right">Action</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? <tr><td colSpan="7" className="px-6 py-14 text-center text-slate-400">Loading production records…</td></tr> : orders.length === 0 ? <tr><td colSpan="7" className="px-6 py-16 text-center"><div className="text-3xl">✂</div><p className="mt-3 font-bold text-slate-700">No job work orders yet</p><p className="mt-1 text-sm text-slate-400">Create an order before sending material to a cutting or stitching partner.</p></td></tr> : orders.map((order) => {
                        const materials = order.materials || [];
                        const outstanding = materials.reduce((sum, line) => sum + Math.max(0, Number(line.issued_qty || 0) - Number(line.used_qty || 0) - Number(line.returned_qty || 0) - Number(line.leftover_qty || 0) - Number(line.waste_qty || 0)), 0);
                        return <tr key={order.id} className="transition hover:bg-violet-50/30"><td className="px-6 py-4"><p className="font-extrabold text-slate-900">{order.order_no}</p><p className="mt-1 text-xs text-slate-400">Due: {order.due_date || "Not set"}</p>{order.vendor_acknowledgement?.promised_ready_date && <p className={`mt-1 text-xs font-bold ${order.is_overdue ? "text-rose-600" : "text-emerald-600"}`}>Vendor promised: {order.vendor_acknowledgement.promised_ready_date}{order.is_overdue ? " · Overdue" : ""}</p>}</td><td className="px-4 py-4"><p className="font-bold text-slate-800">{order.job_worker_name}</p><p className="mt-1 text-xs font-semibold text-violet-600">{order.job_work_type}</p></td><td className="px-4 py-4 font-semibold text-slate-700"><p>{order.finished_product}</p><DesignLinesPreview lines={order.design_lines} />{order.material_plan_no && <p className="mt-1 text-xs font-bold text-violet-600">BOM {order.material_plan_no}</p>}</td><td className="px-4 py-4 font-bold text-slate-800">{order.expected_quantity} {order.unit}</td><td className="px-4 py-4"><p className="font-semibold text-slate-700">{materials.length ? `${materials.length} material line${materials.length === 1 ? "" : "s"}` : "Not issued"}</p>{materials.length > 0 && <p className="mt-1 text-xs text-slate-400">Outstanding: {outstanding.toLocaleString()}</p>}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusStyle[order.status] || statusStyle.DRAFT}`}>{String(order.status || "DRAFT").replaceAll("_", " ")}</span></td><td className="px-6 py-4 text-right">{order.status === "DRAFT" ? <button onClick={() => setModal({ type: "issue", order })} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600">Issue material</button> : order.status !== "COMPLETED" ? <button onClick={() => setModal({ type: "receive", order })} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Receive work</button> : <span className="text-xs font-bold text-emerald-600">Reconciled ✓</span>}</td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="px-6 py-4 text-xs leading-5 text-slate-500">Normal supplier purchasing remains unchanged: use PO → GRC → GRN for purchased fabric. Use this workspace only when your own material is sent to an outside job worker for processing.</p>
              </section>
            )}
          </div>
        </div>
      </div>

      {modal?.type === "create" && <CreateOrderModal form={orderForm} setForm={setOrderForm} vendors={vendors} plans={plans} techPacks={techPacks} stock={stock} onClose={closeModal} onSubmit={createOrder} saving={saving} />}
      {modal?.type === "plan" && <CreateMaterialPlanModal form={planForm} setForm={setPlanForm} onClose={closeModal} onSubmit={createPlan} saving={saving} />}
      {modal?.type === "purchase-plan" && <CreateFabricPOModal plan={modal.plan} vendors={fabricSuppliers} onClose={closeModal} onSubmit={createFabricPO} saving={saving} />}
      {modal?.type === "fabric-cart" && <CreateFabricPOModal vendors={fabricSuppliers} onClose={closeModal} onSubmit={(_, payload) => createManualFabricPO(payload)} saving={saving} />}
      {modal?.type === "issue" && <IssueMaterialModal order={modal.order} stock={stock} onClose={closeModal} onSaved={async (message) => { closeModal(); showNotice(message); await refresh(); }} setError={setError} />}
      {modal?.type === "receive" && <ReceiveWorkModal order={modal.order} onClose={closeModal} onSaved={async (message, warnings) => { closeModal(); if (warnings?.length) showWarning(message); else showNotice(message); await refresh(); }} setError={setError} />}
      {sheetDownload && <DownloadSheetModal sheetDownload={sheetDownload} onClose={() => setSheetDownload(null)} />}
    </main>
  );
}

function AddonRequestScreen({ status, onRequested }) {
  const pending = status.request?.status === "PENDING";
  const declined = status.request?.status === "DECLINED";
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSending(true);
    setError("");
    try {
      const result = await addonRequest("/requests", { method: "POST", body: JSON.stringify({ note }) });
      onRequested(result.request);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="grid min-h-full place-items-center bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.16),_transparent_30%),linear-gradient(135deg,_#f8fafc_0%,_#eef2ff_46%,_#ecfeff_100%)] p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg rounded-[28px] border border-white bg-white/90 p-8 text-center shadow-2xl shadow-indigo-100/60 backdrop-blur">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-800 text-2xl text-white shadow-lg">✂</div>
        <h1 className="mt-4 text-xl font-black tracking-tight text-slate-900">Production &amp; Job Work is not activated</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">This workspace is a separate add-on, independent of your plan. Activate it to plan materials, issue fabric to job workers and reconcile finished goods.</p>

        {pending ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Your activation request is awaiting review. You'll get access as soon as it's approved.</div>
        ) : (
          <div className="mt-6 text-left">
            {declined && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">Your previous request was declined. You can send another one below.</div>}
            {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
            <label className="block text-sm font-bold text-slate-700">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Note to RMS (optional)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="e.g. We cut and stitch our own garments and need to track fabric sent to job workers." className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
            </label>
            <button type="button" disabled={sending} onClick={submit} className="mt-4 w-full rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-700 disabled:opacity-60">{sending ? "Sending…" : "Request activation"}</button>
          </div>
        )}

        <button type="button" onClick={() => logoutOrReturnToDepartmentSelector()} className="mt-6 text-xs font-bold text-slate-400 hover:text-slate-600">Back to department selector</button>
      </div>
    </main>
  );
}

function DownloadSheetModal({ sheetDownload, onClose }) {
  const { meta, items } = sheetDownload;
  const [busy, setBusy] = useState("");
  const options = [
    { label: "PDF", hint: "Best for sharing or printing — includes fabric photos", run: () => downloadFabricSheetPdf(meta, items) },
    { label: "Excel (.xlsx)", hint: "Best for editing rates before sending", run: () => downloadFabricSheetExcel(meta, items) },
    { label: "CSV", hint: "Best for importing elsewhere", run: () => downloadFabricSheetCsv(meta, items) },
  ];
  const runOption = async (option) => {
    setBusy(option.label);
    try { await option.run(); } finally { setBusy(""); }
  };
  return <Modal title={`Fabric PO ${meta.purchase_order_no || "Draft"} created`} onClose={onClose}>
    <div className="p-6">
      <p className="text-sm text-slate-600">Download the sheet in whichever format you need — you can come back and download it again later from Purchase Order.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <button key={option.label} type="button" disabled={Boolean(busy)} onClick={() => runOption(option)}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-violet-300 hover:bg-violet-50/40 disabled:opacity-60">
            <p className="font-black text-slate-900">{busy === option.label ? "Preparing…" : option.label}</p>
            <p className="mt-1 text-xs text-slate-500">{option.hint}</p>
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Done</button>
      </div>
    </div>
  </Modal>;
}

function MaterialPlanList({ plans, onCreatePO, onStartJob, onLinkTechPack, embedded = false }) {
  const list = plans.length === 0 ? <div className="px-6 py-10 text-center text-sm text-slate-400">No material plans yet. Create a Style BOM & fabric plan to calculate your fabric requirement.</div> : <div className="divide-y divide-slate-100">{plans.slice(0, 8).map((plan) => <article key={plan.id} className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{plan.style_name}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{plan.plan_no}</span>{plan.purchase_order_no && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">PO {plan.purchase_order_no}</span>}{plan.linked_tech_pack && <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[11px] font-bold text-fuchsia-700">🔗 Tech Pack {plan.linked_tech_pack.tech_pack_no}</span>}</div><p className="mt-1 text-sm text-slate-500">{plan.planned_quantity} {plan.finished_unit} planned · {plan.wastage_pct}% wastage · {plan.materials?.length || 0} material line(s)</p><div className="mt-2 flex flex-wrap gap-2">{(plan.materials || []).map((material) => <span key={`${plan.id}-${material.material_name}`} className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600"><b>{material.required_quantity} {material.unit}</b> {material.material_name}</span>)}</div>{plan.suggested_tech_pack && <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-fuchsia-100 bg-fuchsia-50/60 px-2.5 py-1.5 text-xs text-fuchsia-800"><span>Tech pack <b>{plan.suggested_tech_pack.tech_pack_no}</b> ({plan.suggested_tech_pack.design_no || "no design no."}) matches this style name.</span><button type="button" onClick={() => onLinkTechPack(plan)} className="rounded-lg bg-fuchsia-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-fuchsia-700">Link it</button></div>}</div><div className="flex flex-wrap items-center gap-2"><button onClick={() => onStartJob(plan)} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-100">Start production job</button>{plan.purchase_order_no ? <span className="text-sm font-bold text-emerald-700">Fabric PO created</span> : <button onClick={() => onCreatePO(plan)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white">Create Fabric PO</button>}</div></article>)}</div>;
  if (embedded) return list;
  return <section className="mb-6 overflow-hidden rounded-3xl border border-white bg-white/90 shadow-xl shadow-indigo-100/40 backdrop-blur"><div className="flex flex-col justify-between gap-2 border-b border-indigo-100/80 bg-gradient-to-r from-white via-indigo-50/60 to-cyan-50/70 px-6 py-5 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-violet-600">Before buying fabric</p><h2 className="mt-1 font-black text-slate-900">Style BOM & material plans</h2><p className="mt-1 text-sm text-slate-500">Calculate metres from garment consumption, planned quantity and wastage, then create a normal Fabric PO draft.</p></div><span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">{plans.length} plan{plans.length === 1 ? "" : "s"}</span></div>{list}</section>;
}

function CreateMaterialPlanModal({ form, setForm, onClose, onSubmit, saving }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const changeMaterial = (index, key, value) => setForm((current) => ({ ...current, materials: current.materials.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line) }));
  const numeric = (value) => Number.parseFloat(String(value ?? "").replace(",", ".")) || 0;
  const calculated = form.materials.map((line) => numeric(form.planned_quantity) * numeric(line.consumption_per_unit) * (1 + numeric(line.wastage_pct || form.wastage_pct) / 100));
  return <Modal title="Style BOM & fabric material plan" onClose={onClose}><form onSubmit={onSubmit} className="p-6"><div className="mb-5 rounded-2xl bg-violet-50 p-4 text-sm text-violet-900"><p><b>How to fill this:</b> 1. Enter your production quantity. 2. For every fabric or trim, enter the consumption for one garment (for example, <b>1.6 m</b> per T-shirt). 3. RMS calculates <b>To purchase</b> automatically, including wastage.</p><p className="mt-2 text-violet-700">Example: 100 T-shirts × 1.6 m × 5% wastage = <b>168 m</b>. You do not type in the calculated field.</p></div><div className="grid gap-4 md:grid-cols-2"><Field label="Style / product name *"><input required value={form.style_name} onChange={(e) => update("style_name", e.target.value)} placeholder="e.g. Men's Cotton T-shirt" /></Field><Field label="Style code"><input value={form.style_code} onChange={(e) => update("style_code", e.target.value)} placeholder="e.g. CT-SS-101" /></Field><Field label="Planned production quantity *"><div className="grid grid-cols-[1fr_100px] gap-2"><input required min="1" step="any" type="number" value={form.planned_quantity} onChange={(e) => update("planned_quantity", e.target.value)} placeholder="e.g. 1000" /><input value={form.finished_unit} onChange={(e) => update("finished_unit", e.target.value)} placeholder="pcs" /></div></Field><Field label="Default wastage %"><input min="0" max="100" step="any" type="number" value={form.wastage_pct} onChange={(e) => update("wastage_pct", e.target.value)} /></Field></div><div className="mt-6 overflow-hidden rounded-2xl border border-slate-200"><div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_105px_75px_105px_32px] gap-2 bg-slate-50 px-3 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500"><span>Fabric / material</span><span>Pattern, GSM, width, colour</span><span>Per garment</span><span>Unit</span><span>To purchase (automatic)</span><span /></div>{form.materials.map((line, index) => <div key={index} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_105px_75px_105px_32px] items-center gap-2 border-t border-slate-100 px-3 py-3"><input required value={line.material_name} onChange={(e) => changeMaterial(index, "material_name", e.target.value)} placeholder="Cotton jersey fabric" /><input value={line.specification} onChange={(e) => changeMaterial(index, "specification", e.target.value)} placeholder="180 GSM, 60 inch, navy" /><input required min="0.0001" step="any" type="number" value={line.consumption_per_unit} onChange={(e) => changeMaterial(index, "consumption_per_unit", e.target.value)} placeholder="1.6" /><input value={line.unit} onChange={(e) => changeMaterial(index, "unit", e.target.value)} placeholder="m" /><span className={`text-right text-sm font-black ${calculated[index] > 0 ? "text-violet-700" : "text-slate-400"}`}>{calculated[index] > 0 ? `${calculated[index].toFixed(3)} ${line.unit || ""}` : "Enter per garment"}</span><button type="button" disabled={form.materials.length === 1} onClick={() => setForm((current) => ({ ...current, materials: current.materials.filter((_, lineIndex) => lineIndex !== index) }))} className="text-lg font-bold text-rose-500 disabled:text-slate-300">×</button><div className="col-span-6 grid grid-cols-[150px_1fr] items-center gap-2"><span className="text-xs font-semibold text-slate-500">Rate / {line.unit || "m"} (optional)</span><input min="0" step="any" type="number" value={line.rate} onChange={(e) => changeMaterial(index, "rate", e.target.value)} placeholder="Enter negotiated supplier rate, or leave 0 and complete it in the PO" /></div></div>)}</div><button type="button" onClick={() => setForm((current) => ({ ...current, materials: [...current.materials, { material_name: "", specification: "", consumption_per_unit: "", unit: "m", rate: "" }] }))} className="mt-3 text-sm font-bold text-violet-700">+ Add fabric / trim</button><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Calculating…" : "Save material plan"}</button></div></form></Modal>;
}


function DesignLinesPreview({ lines = [] }) {
  const visible = (lines || []).filter((line) => line?.design_no || line?.product_type || line?.images?.length || line?.image_urls?.length);
  if (!visible.length) return null;
  return <div className="mt-2 space-y-1.5">{visible.slice(0, 3).map((line, index) => <div key={`${line.design_no || line.product_type || index}`} className="flex items-center gap-2 rounded-xl bg-violet-50 px-2 py-1.5 text-xs text-slate-600"><div className="flex -space-x-1">{(line.image_urls || line.imagePreviews || []).slice(0, 2).map((src, imgIndex) => <img key={imgIndex} src={src} alt="Design" className="h-7 w-7 rounded-lg border border-white object-cover" />)}</div><span className="font-bold text-slate-800">{line.design_no || "Design"}</span><span>{line.department || "Dept"}</span><span>{line.quantity || 0} {line.unit || "pcs"}</span></div>)}</div>;
}

function CreateOrderModal({ form, setForm, vendors, plans, techPacks, stock, onClose, onSubmit, saving }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectedPlan = plans.find((plan) => plan.id === form.material_plan_id);
  const designLines = form.design_lines?.length ? form.design_lines : [emptyDesignLine()];
  const setDesignLines = (updater) => setForm((current) => ({ ...current, design_lines: typeof updater === "function" ? updater(current.design_lines || [emptyDesignLine()]) : updater }));
  const changeDesign = (index, key, value) => setDesignLines((lines) => lines.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line));
  const addDesign = () => setDesignLines((lines) => [...lines, emptyDesignLine()]);
  const removeDesign = (index) => setDesignLines((lines) => lines.length === 1 ? lines : lines.filter((_, lineIndex) => lineIndex !== index));
  const attachImages = (index, files) => {
    const accepted = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    if (!accepted.length) return;
    setDesignLines((lines) => lines.map((line, lineIndex) => lineIndex === index ? { ...line, images: [...(line.images || []), ...accepted], imagePreviews: [...(line.imagePreviews || []), ...accepted.map((file) => URL.createObjectURL(file))] } : line));
  };
  const removeImage = (lineIndex, imageIndex) => setDesignLines((lines) => lines.map((line, index) => index === lineIndex ? { ...line, images: (line.images || []).filter((_, i) => i !== imageIndex), imagePreviews: (line.imagePreviews || []).filter((_, i) => i !== imageIndex) } : line));
  const chooseVendor = (vendorId) => { const vendor = vendors.find((item) => item.id === vendorId); setForm((current) => ({ ...current, vendor_id: vendorId, job_worker_name: vendor?.name || "" })); };
  const choosePlan = (planId) => { const plan = plans.find((item) => item.id === planId); setForm((current) => ({ ...current, material_plan_id: planId, finished_product: plan?.style_name || current.finished_product, expected_quantity: plan ? String(plan.planned_quantity || "") : current.expected_quantity, unit: plan?.finished_unit || current.unit, design_lines: plan ? [{ ...emptyDesignLine(), design_no: plan.style_code || plan.plan_no || "", product_type: plan.style_name || "", quantity: String(plan.planned_quantity || ""), unit: plan.finished_unit || "pcs" }] : (current.design_lines || [emptyDesignLine()]) })); };
  const chooseTechPack = (index, packId) => { const pack = techPacks.find((item) => item.id === packId); setDesignLines((lines) => lines.map((line, lineIndex) => lineIndex !== index ? line : { ...line, tech_pack_id: packId, design_no: line.design_no || pack?.design_no || "", department: (line.department && (line.department !== "Men" || line.design_no || line.product_type) ? line.department : pack?.department || "Men"), product_type: line.product_type || pack?.style_name || "" })); };
  const readiness = (selectedPlan?.materials || []).map((material) => { const wanted = String(material.material_name || "").trim().toLowerCase(); const matches = stock.filter((item) => { const name = String(item.product || "").toLowerCase(); return wanted && (name.includes(wanted) || wanted.includes(name)); }); const available = matches.reduce((total, item) => total + Number(item.available_qty || 0), 0); const required = Number(material.required_quantity || 0); return { ...material, available, shortage: Math.max(0, required - available), matchCount: matches.length }; });
  const shortages = readiness.filter((line) => line.shortage > 0);
  const totalQty = designLines.reduce((sum, line) => sum + (Number.parseFloat(line.quantity) || 0), 0);
  return <Modal title="Create job work order" onClose={onClose} wide><form onSubmit={onSubmit} className="p-6"><p className="mb-5 rounded-2xl bg-violet-50 p-4 text-sm text-violet-900"><b>Real job-work flow:</b> choose registered or walk-in job worker, select the work type, then add one or many design numbers. Each design can carry its own department, output quantity and design images so the worker knows exactly what to cut/stitch/embroider.</p><div className="grid gap-4 md:grid-cols-2"><Field label="Style BOM / material plan (optional)"><select value={form.material_plan_id} onChange={(e) => choosePlan(e.target.value)}><option value="">Manual job work order (no BOM link)</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_no} - {plan.style_name} - {plan.planned_quantity} {plan.finished_unit}</option>)}</select></Field><Field label="Registered RMS job worker"><select value={form.vendor_id} onChange={(e) => chooseVendor(e.target.value)}><option value="">Walk-in / unregistered job worker</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.business_type?.length ? ` - ${vendor.business_type.join(", ")}` : ""}</option>)}</select></Field><Field label="Job worker name *"><input required={!form.vendor_id} readOnly={Boolean(form.vendor_id)} value={form.job_worker_name} onChange={(e) => update("job_worker_name", e.target.value)} placeholder="e.g. ABC Cutting Works" /></Field>{!form.vendor_id && <><Field label="Job worker mobile (for WhatsApp)"><input value={form.job_worker_mobile} onChange={(e) => update("job_worker_mobile", e.target.value)} placeholder="10-digit mobile, optional" /></Field><Field label="Job worker email (for order email)"><input type="email" value={form.job_worker_email} onChange={(e) => update("job_worker_email", e.target.value)} placeholder="optional" /></Field></>}<Field label="Job work type *"><select value={form.job_work_type} onChange={(e) => update("job_work_type", e.target.value)}>{JOB_WORK_TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field><Field label="Expected completion"><input type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} /></Field><Field label="Order notes"><input value={form.remarks} onChange={(e) => update("remarks", e.target.value)} placeholder="Measurements, packaging, delivery or quality instructions" /></Field></div><div className="mt-6 rounded-3xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/50 p-4"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">Design lines</p><h3 className="text-lg font-black text-slate-900">Design no., department and image references</h3><p className="text-sm text-slate-500">Use separate lines for D-101, D-102 etc. Select a Tech Pack to lock its current instructions to that design; multiple images are still allowed per design.</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-violet-700 shadow-sm">Total {totalQty || 0} pcs</span></div><div className="mt-4 space-y-4">{designLines.map((line, index) => <article key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-50 text-sm font-black text-cyan-700">{index + 1}</span><button type="button" disabled={designLines.length === 1} onClick={() => removeDesign(index)} className="rounded-xl border border-rose-100 px-3 py-1.5 text-xs font-bold text-rose-600 disabled:opacity-40">Remove</button></div><div className="grid gap-3 md:grid-cols-3"><Field label="Tech pack / version"><select value={line.tech_pack_id || ""} onChange={(e) => chooseTechPack(index, e.target.value)}><option value="">No tech pack selected</option>{techPacks.map((pack) => <option key={pack.id} value={pack.id}>{pack.tech_pack_no} · {pack.design_no} · {pack.version}</option>)}</select></Field><Field label="Design no. *"><input required value={line.design_no} onChange={(e) => changeDesign(index, "design_no", e.target.value)} placeholder="e.g. D.NO 278 A" /></Field><Field label="Department"><select value={line.department} onChange={(e) => changeDesign(index, "department", e.target.value)}>{DESIGN_DEPARTMENTS.map((dept) => <option key={dept}>{dept}</option>)}</select></Field><Field label="Product type / style"><input value={line.product_type} onChange={(e) => changeDesign(index, "product_type", e.target.value)} placeholder="e.g. Cord set, kurti, shirt" /></Field><Field label="Output quantity *"><input required min="1" step="any" type="number" value={line.quantity} onChange={(e) => changeDesign(index, "quantity", e.target.value)} placeholder="e.g. 120" /></Field><Field label="Unit"><input value={line.unit} onChange={(e) => changeDesign(index, "unit", e.target.value)} placeholder="pcs" /></Field><Field label="Job rate / pc"><input min="0" step="any" type="number" value={line.rate} onChange={(e) => changeDesign(index, "rate", e.target.value)} placeholder="Optional" /></Field></div><div className="mt-3 grid gap-3 lg:grid-cols-[1fr_260px]"><Field label="Design remarks"><input value={line.remarks} onChange={(e) => changeDesign(index, "remarks", e.target.value)} placeholder="Embroidery placement, size set, sample reference, finishing notes" /></Field><label className="block text-sm font-bold text-slate-700"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Design images</span><input type="file" accept="image/*" multiple onChange={(e) => { attachImages(index, e.target.files); e.target.value = ""; }} className="w-full rounded-xl border border-dashed border-violet-200 bg-violet-50/60 px-3 py-2 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white" /></label></div>{line.imagePreviews?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{line.imagePreviews.map((src, imageIndex) => <div key={src} className="relative"><img src={src} alt="Design preview" className="h-16 w-16 rounded-xl border border-slate-200 object-cover" /><button type="button" onClick={() => removeImage(index, imageIndex)} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-rose-600 text-xs font-black text-white">x</button></div>)}</div>}</article>)}</div><button type="button" onClick={addDesign} className="mt-4 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-black text-violet-700 shadow-sm hover:bg-violet-50">+ Add another design no.</button></div>{selectedPlan && <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200"><div className="flex items-center justify-between bg-slate-50 px-4 py-3"><div><p className="text-sm font-black text-slate-800">Material readiness - {selectedPlan.plan_no}</p><p className="text-xs text-slate-500">Calculated from the selected BOM; matching is based on the material name in central stock.</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${shortages.length ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>{shortages.length ? `${shortages.length} shortage${shortages.length === 1 ? "" : "s"}` : "Ready to issue"}</span></div><div className="divide-y divide-slate-100">{readiness.map((line) => <div key={line.material_name} className="grid grid-cols-[minmax(0,1fr)_100px_100px] gap-3 px-4 py-3 text-sm"><div><p className="font-bold text-slate-800">{line.material_name}</p><p className="text-xs text-slate-400">Need {line.required_quantity} {line.unit}{line.matchCount ? " - stock match found" : " - no stock match"}</p></div><span className="text-right font-semibold text-slate-600">{line.available.toLocaleString()} {line.unit}</span><span className={`text-right font-bold ${line.shortage ? "text-amber-700" : "text-emerald-700"}`}>{line.shortage ? `Short ${line.shortage.toLocaleString()}` : "Available"}</span></div>)}</div></div>}{shortages.length > 0 && <p className="mt-3 text-sm font-semibold text-amber-800">You can still create this planned job. Create a Fabric PO or receive stock first; RMS will prevent issuing more material than is available.</p>}<div className="mt-6 rounded-2xl bg-violet-50 p-4 text-sm text-violet-800"><b>What happens next:</b> the job is saved as a draft. After this, issue material only when it physically leaves central inventory. Registered job workers will see the design lines and images in their portal and get an email + portal alert now. A walk-in job worker gets an email if you entered one, plus a WhatsApp message ready to send (opens automatically — you still tap Send).</div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Creating..." : selectedPlan ? "Create planned job" : "Create order"}</button></div></form></Modal>;
}

function IssueMaterialModal({ order, stock, onClose, onSaved, setError }) {
  const [lines, setLines] = useState([{ barcode: "", issued_qty: "" }]);
  const [challanNo, setChallanNo] = useState("");
  const [saving, setSaving] = useState(false);
  const change = (index, key, value) => setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line));
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { const materials = lines.map((line) => { const selected = stock.find((item) => item.barcode === line.barcode) || {}; return { ...line, product: selected.product, rate: selected.rate, unit: selected.unit }; }); const result = await request(`/orders/${order.id}/issue`, { method: "POST", body: JSON.stringify({ challan_no: challanNo, materials }) }); await onSaved(result.message); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  return <Modal title={`Issue material · ${order.order_no}`} onClose={onClose}><form onSubmit={submit} className="p-6"><div className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><b>{order.job_worker_name}</b> · {order.job_work_type}<br /><span className="text-amber-700">Issue only material that has physically left central inventory. The quantity is no longer available for other operations.</span></div><Field label="Material issue challan no. (optional)"><input value={challanNo} onChange={(e) => setChallanNo(e.target.value)} placeholder="Auto-generated if left blank" /></Field><div className="mt-5 overflow-hidden rounded-2xl border border-slate-200"><div className="grid grid-cols-[minmax(0,1fr)_120px_40px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500"><span>Material from central stock</span><span>Issued qty</span><span /></div>{lines.map((line, index) => { const selected = stock.find((item) => item.barcode === line.barcode); return <div key={index} className="grid grid-cols-[minmax(0,1fr)_120px_40px] items-center gap-3 border-t border-slate-100 px-4 py-3"><select required value={line.barcode} onChange={(e) => change(index, "barcode", e.target.value)}><option value="">Select barcode / material</option>{stock.map((item) => { const fabricSpec = item.is_fabric ? [item.fabric_type, item.gsm && `${item.gsm} GSM`, item.width, item.color].filter(Boolean).join(", ") : ""; return <option key={item.barcode} value={item.barcode}>{item.is_leftover ? "♻ " : ""}{item.product}{fabricSpec ? ` (${fabricSpec})` : ""} · {item.barcode} · available {item.available_qty} {item.unit}</option>; })}</select><input required min="0.001" step="any" type="number" value={line.issued_qty} onChange={(e) => change(index, "issued_qty", e.target.value)} placeholder={selected ? `Max ${selected.available_qty}` : "Qty"} /><button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="text-xl font-bold text-rose-500 disabled:text-slate-300">×</button></div>; })}</div><button type="button" onClick={() => setLines((current) => [...current, { barcode: "", issued_qty: "" }])} className="mt-3 text-sm font-bold text-violet-700">+ Add material</button><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving || stock.length === 0} className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Issuing…" : "Create issue challan"}</button></div></form></Modal>;
}

function ReceiveWorkModal({ order, onClose, onSaved, setError }) {
  const [reconciliation, setReconciliation] = useState(() => (order.materials || []).map((line) => ({ barcode: line.barcode, used_qty: "", returned_qty: "", leftover_qty: "", waste_qty: "" })));
  const [output, setOutput] = useState({ barcode: "", product: order.finished_product || "", quantity: "", rate: "" });
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const updateLine = (index, key, value) => setReconciliation((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line));
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { const result = await request(`/orders/${order.id}/receipts`, { method: "POST", body: JSON.stringify({ materials: reconciliation, output, remarks }) }); await onSaved(result.message, result.consumption_warnings); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  return <Modal title={`Receive job work · ${order.order_no}`} onClose={onClose}><form onSubmit={submit} className="p-6"><div className="mb-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">Reconcile all material returned from <b>{order.job_worker_name}</b>. Returned fabric goes back to central stock as regular stock. Leftover is a reusable remnant — it also goes back to stock, but flagged separately so it stays visible to reuse on a future small job instead of buying fresh fabric. Waste is a true write-off, not added back to stock. Rough guide: anything under about 1 unit of fabric isn't worth tracking as a reusable leftover — record it as Waste instead.</div><div className="overflow-hidden rounded-2xl border border-slate-200"><div className="grid grid-cols-[minmax(140px,1fr)_88px_88px_88px_88px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500"><span>Issued material</span><span>Used</span><span>Returned</span><span>Leftover</span><span>Waste</span></div>{(order.materials || []).map((material, index) => { const outstanding = Number(material.issued_qty || 0) - Number(material.used_qty || 0) - Number(material.returned_qty || 0) - Number(material.leftover_qty || 0) - Number(material.waste_qty || 0); return <div key={material.barcode} className="grid grid-cols-[minmax(140px,1fr)_88px_88px_88px_88px] items-center gap-3 border-t border-slate-100 px-4 py-3"><div><p className="font-bold text-slate-800">{material.product}</p><p className="text-xs text-slate-400">{material.barcode} · outstanding {outstanding.toLocaleString()} {material.unit}</p></div>{["used_qty", "returned_qty", "leftover_qty", "waste_qty"].map((key) => <input key={key} min="0" step="any" type="number" value={reconciliation[index]?.[key] ?? ""} onChange={(e) => updateLine(index, key, e.target.value)} placeholder="0" title={key === "leftover_qty" ? "Reusable remnant — kept as its own stock line" : key === "waste_qty" ? "True scrap — not reusable" : undefined} />)}</div>; })}</div><div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/60 p-4"><p className="mb-3 text-sm font-black text-violet-900">Finished goods received into central inventory</p><div className="grid gap-3 md:grid-cols-2"><Field label="Finished goods barcode *"><input required value={output.barcode} onChange={(e) => setOutput((current) => ({ ...current, barcode: e.target.value }))} placeholder="Scan or enter your RMS barcode" /></Field><Field label="Finished product"><input value={output.product} onChange={(e) => setOutput((current) => ({ ...current, product: e.target.value }))} /></Field><Field label="Finished quantity"><input min="0" step="any" type="number" value={output.quantity} onChange={(e) => setOutput((current) => ({ ...current, quantity: e.target.value }))} placeholder="0" /></Field><Field label="Unit rate (optional)"><input min="0" step="any" type="number" value={output.rate} onChange={(e) => setOutput((current) => ({ ...current, rate: e.target.value }))} placeholder="0" /></Field></div></div><div className="mt-4"><Field label="Receipt notes"><input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Quality remarks, shortage or issue details" /></Field></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving…" : "Record receipt"}</button></div></form></Modal>;
}

