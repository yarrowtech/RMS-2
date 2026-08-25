import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { API_BASE_URL } from "../../config/api.js";
import { logoutOrReturnToDepartmentSelector } from "../../utils/authRedirect.js";

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


function csvValue(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const FABRIC_SHEET_HEADERS = ["Sl No", "Fabric / Material", "Fabric Type", "GSM", "Width", "Colour", "Total Fabric", "Unit", "Rate", "Amount", "Remarks", "Image Link"];

function buildFabricSheetRows(sheet, fallbackItems = []) {
  const source = sheet?.length ? sheet : fallbackItems.map((item, index) => ({
    sl_no: index + 1,
    fabric_material: item.fabric_name || item.material_name || "",
    fabric_type: item.fabric_type || "",
    gsm: item.gsm || "",
    width: item.width || "",
    color: item.color || "",
    quantity: item.total_quantity || item.required_quantity || item.quantity || "",
    unit: item.unit || "m",
    rate: item.rate || 0,
    amount: (Number(item.total_quantity || item.required_quantity || item.quantity || 0) * Number(item.rate || 0)).toFixed(2),
    remarks: item.remarks || item.specification || "",
    image_url: item.image_url || item.image || item.catalogue_image || "",
  }));
  return source.map((row) => [row.sl_no, row.fabric_material, row.fabric_type, row.gsm, row.width, row.color, row.quantity, row.unit, row.rate, row.amount, row.remarks, row.image_url || ""]);
}

function fabricSheetTotalAmount(rows) {
  return rows.reduce((sum, row) => sum + Number(row[9] || 0), 0);
}

function fabricSheetTotalRow(rows) {
  return ["", "", "", "", "", "", "", "", "TOTAL", fabricSheetTotalAmount(rows).toFixed(2), "", ""];
}

function pdfFabricSheetFootRow(rows) {
  return [[
    { content: "TOTAL", colSpan: 9, styles: { halign: "right", fontStyle: "bold" } },
    { content: fabricSheetTotalAmount(rows).toFixed(2), styles: { halign: "right", fontStyle: "bold" } },
    { content: "", colSpan: 2 },
  ]];
}

function fabricSheetFileBase(purchase_order_no) {
  return purchase_order_no ? `${purchase_order_no}-fabric-po-sheet` : "fabric-po-draft-sheet";
}

function downloadFabricSheetCsv({ purchase_order_no, vendor_name, order_date, sheet }, fallbackItems = []) {
  const rows = buildFabricSheetRows(sheet, fallbackItems);
  const lines = [
    ["Fabric PO Sheet"],
    ["PO No.", purchase_order_no || "Draft"],
    ["Vendor", vendor_name || ""],
    ["Order Date", order_date || ""],
    [],
    FABRIC_SHEET_HEADERS,
    ...rows,
    fabricSheetTotalRow(rows),
  ];
  const csv = lines.map((line) => line.map(csvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fabricSheetFileBase(purchase_order_no)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadFabricSheetExcel({ purchase_order_no, vendor_name, order_date, sheet }, fallbackItems = []) {
  const rows = buildFabricSheetRows(sheet, fallbackItems);
  const aoa = [
    ["Fabric PO Sheet"],
    ["PO No.", purchase_order_no || "Draft"],
    ["Vendor", vendor_name || ""],
    ["Order Date", order_date || ""],
    [],
    FABRIC_SHEET_HEADERS,
    ...rows,
    fabricSheetTotalRow(rows),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 6 }, { wch: 24 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 14 },
    { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 28 }, { wch: 30 },
  ];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: FABRIC_SHEET_HEADERS.length - 1 } }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fabric PO Sheet");
  XLSX.writeFile(wb, `${fabricSheetFileBase(purchase_order_no)}.xlsx`);
}

async function fetchImageAsDataUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function dataUrlImageFormat(dataUrl) {
  const match = /^data:image\/(\w+);base64,/i.exec(dataUrl || "");
  const type = (match?.[1] || "jpeg").toLowerCase();
  return type === "jpg" ? "JPEG" : type.toUpperCase();
}

const PDF_IMAGE_COL_INDEX = FABRIC_SHEET_HEADERS.length - 1;
const PDF_COLUMN_WIDTHS = [26, 96, 62, 30, 40, 52, 48, 26, 36, 46, 130, 48];

async function downloadFabricSheetPdf({ purchase_order_no, vendor_name, order_date, sheet }, fallbackItems = []) {
  const rows = buildFabricSheetRows(sheet, fallbackItems);
  const imageUrls = rows.map((row) => row[PDF_IMAGE_COL_INDEX]);
  const images = await Promise.all(imageUrls.map(fetchImageAsDataUrl));
  const tableRows = rows.map((row) => { const copy = [...row]; copy[PDF_IMAGE_COL_INDEX] = ""; return copy; });
  const headers = [...FABRIC_SHEET_HEADERS]; headers[PDF_IMAGE_COL_INDEX] = "Image";

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("Fabric PO Sheet", 40, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`PO No.: ${purchase_order_no || "Draft"}`, 40, 58);
  doc.text(`Vendor: ${vendor_name || "-"}`, 260, 58);
  doc.text(`Order Date: ${order_date || "-"}`, 480, 58);
  autoTable(doc, {
    head: [headers],
    body: tableRows,
    foot: pdfFabricSheetFootRow(rows),
    startY: 74,
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 5, overflow: "linebreak", minCellHeight: 44, valign: "middle" },
    headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42] },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: PDF_COLUMN_WIDTHS.reduce((acc, width, index) => {
      acc[index] = { cellWidth: width, ...(index === 0 || index === 8 || index === 9 ? { halign: "right" } : {}) };
      return acc;
    }, {}),
    margin: { left: 40, right: 40 },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== PDF_IMAGE_COL_INDEX) return;
      const dataUrl = images[data.row.index];
      if (!dataUrl) return;
      const size = Math.min(data.cell.height - 8, data.cell.width - 8);
      const x = data.cell.x + (data.cell.width - size) / 2;
      const y = data.cell.y + (data.cell.height - size) / 2;
      try { doc.addImage(dataUrl, dataUrlImageFormat(dataUrl), x, y, size, size); } catch { /* skip a broken image rather than failing the whole PDF */ }
    },
  });
  doc.save(`${fabricSheetFileBase(purchase_order_no)}.pdf`);
}

const statusStyle = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  ISSUED: "bg-amber-50 text-amber-700 ring-amber-200",
  PARTIALLY_RECEIVED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <section className={`${wide ? "max-w-6xl" : "max-w-4xl"} max-h-[92vh] w-full overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl`}>
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
  const [fabricSuppliers, setFabricSuppliers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [dashboard, setDashboard] = useState({ active_orders: 0, with_job_workers: 0, completed_orders: 0, recorded_wastage: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(null);
  const [orderForm, setOrderForm] = useState(emptyOrder);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [saving, setSaving] = useState(false);
  const [sheetDownload, setSheetDownload] = useState(null); // { meta, items } once a Fabric PO is created

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [orderData, stockData, dashboardData, vendorData, fabricSupplierData, planData] = await Promise.all([
        request("/orders"), request("/material-stock"), request("/dashboard"), request("/vendors"), request("/vendors?kind=fabric_supplier"), request("/material-plans"),
      ]);
      setOrders(orderData.data || []);
      setStock(stockData.data || []);
      setDashboard(dashboardData || {});
      setVendors(vendorData.data || []);
      setFabricSuppliers(fabricSupplierData.data || []);
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

  async function createFabricPO(plan, payload) {
    setSaving(true);
    try {
      const result = await request(`/material-plans/${plan.id}/purchase-order`, { method: "POST", body: JSON.stringify(payload) });
      showNotice(result.share_link ? `${result.message} Walk-in share link generated.` : result.message);
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
      showNotice(result.share_link ? `${result.message} Walk-in share link generated.` : result.message);
      if (result.whatsapp_url) window.open(result.whatsapp_url, "_blank", "noopener,noreferrer");
      setSheetDownload({ meta: result, items: payload.items });
      closeModal();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  return (
    <main className="min-h-full bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.16),_transparent_30%),linear-gradient(135deg,_#f8fafc_0%,_#eef2ff_46%,_#ecfeff_100%)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative mb-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-800 p-6 shadow-2xl shadow-indigo-300/50 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-fuchsia-400/25 blur-3xl" /><div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
            <div className="flex items-start gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 text-2xl shadow-lg shadow-black/20">✂</div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Operations command centre</p><h1 className="mt-1 text-3xl font-black tracking-tight text-white">Production &amp; Job Work</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">Plan materials, send work to approved partners, track every issue and bring finished goods back into central inventory.</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">Plan → Issue → Reconcile → Receive</span><span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-100">Central inventory controlled</span></div></div></div>
            <div className="flex flex-wrap gap-2 xl:justify-end"><button type="button" onClick={refresh} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20">Refresh</button><button type="button" onClick={() => setModal({ type: "plan" })} className="rounded-xl border border-violet-200/40 bg-violet-400/15 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-400/25">Style BOM &amp; fabric plan</button><button type="button" onClick={() => setModal({ type: "fabric-cart" })} className="rounded-xl border border-cyan-200/40 bg-cyan-300/15 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-300/25">+ Buy fabric cart</button><button type="button" onClick={() => setModal({ type: "create" })} className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-indigo-800 shadow-lg shadow-indigo-950/30 transition hover:bg-cyan-50">+ New job work order</button><button type="button" onClick={() => logoutOrReturnToDepartmentSelector()} className="rounded-xl border border-rose-300/25 bg-rose-400/10 px-4 py-2.5 text-sm font-bold text-rose-100 transition hover:bg-rose-400/20">Logout</button></div>
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
          ].map(([label, value, caption, color]) => <article key={label} className="group relative overflow-hidden rounded-2xl border border-white/80 bg-white/80 p-5 shadow-lg shadow-indigo-100/40 backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-xl"><div className={`absolute right-0 top-0 h-20 w-20 rounded-bl-[48px] opacity-10 ${color}`} /><span className={`mb-4 block h-1.5 w-12 rounded-full ${color}`} /><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-3xl font-black tracking-tight text-slate-900">{value}</p><p className="mt-1 text-xs font-medium text-slate-400">{caption}</p></article>)}
        </section>

        <MaterialPlanList plans={plans} onCreatePO={(plan) => setModal({ type: "purchase-plan", plan })} onStartJob={(plan) => { setOrderForm({ ...emptyOrder, material_plan_id: plan.id, finished_product: plan.style_name || "", expected_quantity: String(plan.planned_quantity || ""), unit: plan.finished_unit || "pcs" }); setModal({ type: "create" }); }} />

        <section className="overflow-hidden rounded-3xl border border-white bg-white/90 shadow-xl shadow-indigo-100/40 backdrop-blur">
          <div className="flex flex-col justify-between gap-2 border-b border-indigo-100/80 bg-gradient-to-r from-white via-indigo-50/60 to-cyan-50/70 px-6 py-5 sm:flex-row sm:items-center">
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
                  return <tr key={order.id} className="transition hover:bg-violet-50/30"><td className="px-6 py-4"><p className="font-extrabold text-slate-900">{order.order_no}</p><p className="mt-1 text-xs text-slate-400">Due: {order.due_date || "Not set"}</p>{order.vendor_acknowledgement?.promised_ready_date && <p className={`mt-1 text-xs font-bold ${order.is_overdue ? "text-rose-600" : "text-emerald-600"}`}>Vendor promised: {order.vendor_acknowledgement.promised_ready_date}{order.is_overdue ? " · Overdue" : ""}</p>}</td><td className="px-4 py-4"><p className="font-bold text-slate-800">{order.job_worker_name}</p><p className="mt-1 text-xs font-semibold text-violet-600">{order.job_work_type}</p></td><td className="px-4 py-4 font-semibold text-slate-700"><p>{order.finished_product}</p>{order.material_plan_no && <p className="mt-1 text-xs font-bold text-violet-600">BOM {order.material_plan_no}</p>}</td><td className="px-4 py-4 font-bold text-slate-800">{order.expected_quantity} {order.unit}</td><td className="px-4 py-4"><p className="font-semibold text-slate-700">{materials.length ? `${materials.length} material line${materials.length === 1 ? "" : "s"}` : "Not issued"}</p>{materials.length > 0 && <p className="mt-1 text-xs text-slate-400">Outstanding: {outstanding.toLocaleString()}</p>}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusStyle[order.status] || statusStyle.DRAFT}`}>{String(order.status || "DRAFT").replaceAll("_", " ")}</span></td><td className="px-6 py-4 text-right">{order.status === "DRAFT" ? <button onClick={() => setModal({ type: "issue", order })} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600">Issue material</button> : order.status !== "COMPLETED" ? <button onClick={() => setModal({ type: "receive", order })} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Receive work</button> : <span className="text-xs font-bold text-emerald-600">Reconciled ✓</span>}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
        <p className="mt-4 px-2 text-xs leading-5 text-slate-500">Normal supplier purchasing remains unchanged: use PO → GRC → GRN for purchased fabric. Use this workspace only when your own material is sent to an outside job worker for processing.</p>
      </div>

      {modal?.type === "create" && <CreateOrderModal form={orderForm} setForm={setOrderForm} vendors={vendors} plans={plans} stock={stock} onClose={closeModal} onSubmit={createOrder} saving={saving} />}
      {modal?.type === "plan" && <CreateMaterialPlanModal form={planForm} setForm={setPlanForm} onClose={closeModal} onSubmit={createPlan} saving={saving} />}
      {modal?.type === "purchase-plan" && <CreateFabricPOModal plan={modal.plan} vendors={fabricSuppliers} onClose={closeModal} onSubmit={createFabricPO} saving={saving} />}
      {modal?.type === "fabric-cart" && <CreateFabricPOModal vendors={fabricSuppliers} onClose={closeModal} onSubmit={(_, payload) => createManualFabricPO(payload)} saving={saving} />}
      {modal?.type === "issue" && <IssueMaterialModal order={modal.order} stock={stock} onClose={closeModal} onSaved={async (message) => { closeModal(); showNotice(message); await refresh(); }} setError={setError} />}
      {modal?.type === "receive" && <ReceiveWorkModal order={modal.order} onClose={closeModal} onSaved={async (message) => { closeModal(); showNotice(message); await refresh(); }} setError={setError} />}
      {sheetDownload && <DownloadSheetModal sheetDownload={sheetDownload} onClose={() => setSheetDownload(null)} />}
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

function MaterialPlanList({ plans, onCreatePO, onStartJob }) {
  return <section className="mb-6 overflow-hidden rounded-3xl border border-white bg-white/90 shadow-xl shadow-indigo-100/40 backdrop-blur"><div className="flex flex-col justify-between gap-2 border-b border-indigo-100/80 bg-gradient-to-r from-white via-indigo-50/60 to-cyan-50/70 px-6 py-5 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-violet-600">Before buying fabric</p><h2 className="mt-1 font-black text-slate-900">Style BOM & material plans</h2><p className="mt-1 text-sm text-slate-500">Calculate metres from garment consumption, planned quantity and wastage, then create a normal Fabric PO draft.</p></div><span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">{plans.length} plan{plans.length === 1 ? "" : "s"}</span></div>{plans.length === 0 ? <div className="px-6 py-10 text-center text-sm text-slate-400">No material plans yet. Create a Style BOM & fabric plan to calculate your fabric requirement.</div> : <div className="divide-y divide-slate-100">{plans.slice(0, 8).map((plan) => <article key={plan.id} className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{plan.style_name}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{plan.plan_no}</span>{plan.purchase_order_no && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">PO {plan.purchase_order_no}</span>}</div><p className="mt-1 text-sm text-slate-500">{plan.planned_quantity} {plan.finished_unit} planned · {plan.wastage_pct}% wastage · {plan.materials?.length || 0} material line(s)</p><div className="mt-2 flex flex-wrap gap-2">{(plan.materials || []).map((material) => <span key={`${plan.id}-${material.material_name}`} className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600"><b>{material.required_quantity} {material.unit}</b> {material.material_name}</span>)}</div></div><div className="flex flex-wrap items-center gap-2"><button onClick={() => onStartJob(plan)} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-100">Start production job</button>{plan.purchase_order_no ? <span className="text-sm font-bold text-emerald-700">Fabric PO created</span> : <button onClick={() => onCreatePO(plan)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white">Create Fabric PO</button>}</div></article>)}</div>}</section>;
}

function CreateMaterialPlanModal({ form, setForm, onClose, onSubmit, saving }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const changeMaterial = (index, key, value) => setForm((current) => ({ ...current, materials: current.materials.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line) }));
  const numeric = (value) => Number.parseFloat(String(value ?? "").replace(",", ".")) || 0;
  const calculated = form.materials.map((line) => numeric(form.planned_quantity) * numeric(line.consumption_per_unit) * (1 + numeric(line.wastage_pct || form.wastage_pct) / 100));
  return <Modal title="Style BOM & fabric material plan" onClose={onClose}><form onSubmit={onSubmit} className="p-6"><div className="mb-5 rounded-2xl bg-violet-50 p-4 text-sm text-violet-900"><p><b>How to fill this:</b> 1. Enter your production quantity. 2. For every fabric or trim, enter the consumption for one garment (for example, <b>1.6 m</b> per T-shirt). 3. RMS calculates <b>To purchase</b> automatically, including wastage.</p><p className="mt-2 text-violet-700">Example: 100 T-shirts × 1.6 m × 5% wastage = <b>168 m</b>. You do not type in the calculated field.</p></div><div className="grid gap-4 md:grid-cols-2"><Field label="Style / product name *"><input required value={form.style_name} onChange={(e) => update("style_name", e.target.value)} placeholder="e.g. Men's Cotton T-shirt" /></Field><Field label="Style code"><input value={form.style_code} onChange={(e) => update("style_code", e.target.value)} placeholder="e.g. CT-SS-101" /></Field><Field label="Planned production quantity *"><div className="grid grid-cols-[1fr_100px] gap-2"><input required min="1" step="any" type="number" value={form.planned_quantity} onChange={(e) => update("planned_quantity", e.target.value)} placeholder="e.g. 1000" /><input value={form.finished_unit} onChange={(e) => update("finished_unit", e.target.value)} placeholder="pcs" /></div></Field><Field label="Default wastage %"><input min="0" max="100" step="any" type="number" value={form.wastage_pct} onChange={(e) => update("wastage_pct", e.target.value)} /></Field></div><div className="mt-6 overflow-hidden rounded-2xl border border-slate-200"><div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_105px_75px_105px_32px] gap-2 bg-slate-50 px-3 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500"><span>Fabric / material</span><span>Pattern, GSM, width, colour</span><span>Per garment</span><span>Unit</span><span>To purchase (automatic)</span><span /></div>{form.materials.map((line, index) => <div key={index} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_105px_75px_105px_32px] items-center gap-2 border-t border-slate-100 px-3 py-3"><input required value={line.material_name} onChange={(e) => changeMaterial(index, "material_name", e.target.value)} placeholder="Cotton jersey fabric" /><input value={line.specification} onChange={(e) => changeMaterial(index, "specification", e.target.value)} placeholder="180 GSM, 60 inch, navy" /><input required min="0.0001" step="any" type="number" value={line.consumption_per_unit} onChange={(e) => changeMaterial(index, "consumption_per_unit", e.target.value)} placeholder="1.6" /><input value={line.unit} onChange={(e) => changeMaterial(index, "unit", e.target.value)} placeholder="m" /><span className={`text-right text-sm font-black ${calculated[index] > 0 ? "text-violet-700" : "text-slate-400"}`}>{calculated[index] > 0 ? `${calculated[index].toFixed(3)} ${line.unit || ""}` : "Enter per garment"}</span><button type="button" disabled={form.materials.length === 1} onClick={() => setForm((current) => ({ ...current, materials: current.materials.filter((_, lineIndex) => lineIndex !== index) }))} className="text-lg font-bold text-rose-500 disabled:text-slate-300">×</button><div className="col-span-6 grid grid-cols-[150px_1fr] items-center gap-2"><span className="text-xs font-semibold text-slate-500">Rate / {line.unit || "m"} (optional)</span><input min="0" step="any" type="number" value={line.rate} onChange={(e) => changeMaterial(index, "rate", e.target.value)} placeholder="Enter negotiated supplier rate, or leave 0 and complete it in the PO" /></div></div>)}</div><button type="button" onClick={() => setForm((current) => ({ ...current, materials: [...current.materials, { material_name: "", specification: "", consumption_per_unit: "", unit: "m", rate: "" }] }))} className="mt-3 text-sm font-bold text-violet-700">+ Add fabric / trim</button><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Calculating…" : "Save material plan"}</button></div></form></Modal>;
}

function CreateFabricPOModal({ plan, vendors, onClose, onSubmit, saving }) {
  const today = new Date().toISOString().slice(0, 10);
  const initialItems = (plan?.materials?.length ? plan.materials : [{ material_name: "", specification: "", required_quantity: "", unit: "m", rate: "" }]).map((material) => ({
    fabric_name: material.material_name || "",
    fabric_type: material.fabric_type || "",
    gsm: material.gsm || "",
    width: material.width || "",
    color: material.color || "",
    total_quantity: material.required_quantity || "",
    unit: material.unit || "m",
    rate: material.rate || "",
    remarks: material.specification || material.remarks || "",
  }));
  const [form, setForm] = useState({
    supplier_mode: vendors.length ? "registered" : "walkin",
    vendor_id: "",
    walkin_vendor: { name: "", mobile: "", email: "", contact_person: "", gstin: "", address: "" },
    order_date: today,
    expected_delivery_date: "",
    payment_terms: "",
    notes: "",
    items: initialItems,
  });
  const [storefront, setStorefront] = useState(null);
  const [storefrontLoading, setStorefrontLoading] = useState(false);
  const [storefrontError, setStorefrontError] = useState("");
  const [addedToCart, setAddedToCart] = useState("");
  const cartLinesRef = useRef(null);

  const supplierMode = form.supplier_mode || "registered";
  const isWalkin = supplierMode === "walkin";
  const vendor = vendors.find((item) => item.id === form.vendor_id);
  const selectedVendorName = isWalkin ? form.walkin_vendor.name : vendor?.name;
  const total = form.items.reduce((sum, item) => sum + (Number(item.total_quantity || 0) * Number(item.rate || 0)), 0);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateWalkin = (key, value) => setForm((current) => ({ ...current, walkin_vendor: { ...current.walkin_vendor, [key]: value } }));
  const changeItem = (index, key, value) => setForm((current) => ({ ...current, items: current.items.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line) }));
  const addLine = () => setForm((current) => ({ ...current, items: [...current.items, { fabric_name: "", fabric_type: "", gsm: "", width: "", color: "", total_quantity: "", unit: "m", rate: "", remarks: "" }] }));
  const removeLine = (index) => setForm((current) => ({ ...current, items: current.items.filter((_, lineIndex) => lineIndex !== index) }));

  useEffect(() => {
    let cancelled = false;
    if (isWalkin || !form.vendor_id) { setStorefront(null); setStorefrontError(""); return undefined; }
    setStorefrontLoading(true);
    setStorefrontError("");
    fetch(`${API_BASE_URL}/api/catalogue/vendor/${form.vendor_id}/storefront`, { headers: authHeaders() })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail || "Could not load supplier catalogue.");
        if (!cancelled) setStorefront(body.data || null);
      })
      .catch((err) => { if (!cancelled) { setStorefront(null); setStorefrontError(err.message || "Could not load supplier catalogue."); } })
      .finally(() => { if (!cancelled) setStorefrontLoading(false); });
    return () => { cancelled = true; };
  }, [form.vendor_id, isWalkin]);

  const fabricCatalogueItems = (storefront?.items || []).filter((item) => item.catalogue_kind === "fabric_material" || (item.fabric_specs && Object.keys(item.fabric_specs).length));
  const addCatalogueFabric = (item) => {
    const specs = item.fabric_specs || {};
    const nextLine = {
      fabric_name: item.item_name || "",
      fabric_type: specs.fabric_type || item.category || "",
      gsm: specs.gsm || "",
      width: specs.width || "",
      color: specs.shade || (item.available_colors || []).join(", "),
      total_quantity: item.moq || "",
      unit: String(specs.rate_unit || "m").toLowerCase().includes("kg") ? "kg" : "m",
      rate: item.price || item.price_range_min || "",
      remarks: [specs.composition, specs.weave, specs.finish, specs.roll_length, specs.testing_notes].filter(Boolean).join(" | "),
      image_url: item.images?.[0] || "",
      catalogue_item_id: item._id || "",
    };
    setForm((current) => {
      const firstBlank = current.items.findIndex((line) => !String(line.fabric_name || "").trim());
      if (firstBlank >= 0) return { ...current, items: current.items.map((line, index) => index === firstBlank ? nextLine : line) };
      return { ...current, items: [...current.items, nextLine] };
    });
    setAddedToCart(item.item_name || "Fabric");
    window.setTimeout(() => setAddedToCart(""), 2500);
    cartLinesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submit = (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      vendor_id: isWalkin ? "" : form.vendor_id,
      vendor_name: selectedVendorName || "",
      walkin_vendor: isWalkin ? form.walkin_vendor : undefined,
    };
    onSubmit(plan || null, payload);
  };

  const canCreate = isWalkin ? Boolean(form.walkin_vendor.name.trim()) : Boolean(form.vendor_id);

  return <Modal wide title={plan ? `Fabric cart PO from ${plan.plan_no}` : "Fabric buying cart"} onClose={onClose}>
    {addedToCart && <div className="pointer-events-none fixed left-1/2 top-6 z-[200] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-xl">✓ Added "{addedToCart}" to fabric cart — see below</div>}
    <form onSubmit={submit} className="p-6">
      <div className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950">
        <b>Use this like Quick Order for fabric:</b> choose a registered fabric supplier or enter a walk-in supplier, add fabric/trim lines, then RMS creates a draft Fabric PO and downloadable sheet. Walk-in suppliers get a public PO link they can accept/register from.
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => update("supplier_mode", "registered")} className={`rounded-2xl border px-4 py-3 text-left transition ${!isWalkin ? "border-cyan-400 bg-cyan-50 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
          <p className="font-black text-slate-900">Registered fabric supplier</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Supplier already approved in RMS; catalogue can load below.</p>
        </button>
        <button type="button" onClick={() => update("supplier_mode", "walkin")} className={`rounded-2xl border px-4 py-3 text-left transition ${isWalkin ? "border-amber-400 bg-amber-50 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
          <p className="font-black text-slate-900">Walk-in / new supplier</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Create PO now; share link by WhatsApp/email so supplier can accept/register.</p>
        </button>
      </div>

      {!isWalkin ? <div className="grid gap-4 md:grid-cols-3">
        <Field label="Approved fabric supplier *"><select required={!isWalkin} value={form.vendor_id} onChange={(e) => update("vendor_id", e.target.value)}><option value="">Select supplier</option>{vendors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Order date"><input type="date" value={form.order_date} onChange={(e) => update("order_date", e.target.value)} /></Field>
        <Field label="Expected delivery"><input type="date" value={form.expected_delivery_date} onChange={(e) => update("expected_delivery_date", e.target.value)} /></Field>
      </div> : <div className="rounded-3xl border border-amber-100 bg-amber-50/60 p-4">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-amber-700">Walk-in fabric supplier details</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Supplier name *"><input required={isWalkin} value={form.walkin_vendor.name} onChange={(e) => updateWalkin("name", e.target.value)} placeholder="e.g. ABC Fabrics" /></Field>
          <Field label="WhatsApp / mobile"><input value={form.walkin_vendor.mobile} onChange={(e) => updateWalkin("mobile", e.target.value)} placeholder="9876543210" /></Field>
          <Field label="Email"><input type="email" value={form.walkin_vendor.email} onChange={(e) => updateWalkin("email", e.target.value)} placeholder="supplier@example.com" /></Field>
          <Field label="Contact person"><input value={form.walkin_vendor.contact_person} onChange={(e) => updateWalkin("contact_person", e.target.value)} placeholder="Owner / sales person" /></Field>
          <Field label="GSTIN"><input value={form.walkin_vendor.gstin} onChange={(e) => updateWalkin("gstin", e.target.value)} placeholder="Optional" /></Field>
          <Field label="Address"><input value={form.walkin_vendor.address} onChange={(e) => updateWalkin("address", e.target.value)} placeholder="Optional" /></Field>
          <Field label="Order date"><input type="date" value={form.order_date} onChange={(e) => update("order_date", e.target.value)} /></Field>
          <Field label="Expected delivery"><input type="date" value={form.expected_delivery_date} onChange={(e) => update("expected_delivery_date", e.target.value)} /></Field>
        </div>
      </div>}

      {!isWalkin && form.vendor_id && <section className="mt-6 overflow-hidden rounded-[2rem] border border-cyan-100 bg-white shadow-xl shadow-cyan-100/40">
        <div className="bg-gradient-to-r from-teal-700 via-cyan-700 to-blue-700 px-5 py-5 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Fabric supplier storefront</p>
              <h3 className="mt-1 text-2xl font-black">{vendor?.name || "Supplier catalogue"}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-50">Pick fabric like a catalogue: view image/specs, add it to the cart, edit quantity/rate below, then create the Fabric PO.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
              <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur"><p className="text-xl font-black">{fabricCatalogueItems.length}</p><p className="text-[10px] font-bold uppercase tracking-wide text-cyan-100">Fabric SKUs</p></div>
              <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur"><p className="text-xl font-black">{form.items.filter((line) => String(line.fabric_name || "").trim()).length}</p><p className="text-[10px] font-bold uppercase tracking-wide text-cyan-100">Cart lines</p></div>
              <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur"><p className="text-xl font-black">Rs {total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p><p className="text-[10px] font-bold uppercase tracking-wide text-cyan-100">Est. value</p></div>
            </div>
          </div>
        </div>
        <div className="p-5">
          {storefrontLoading ? <div className="rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/70 p-8 text-center text-sm font-semibold text-cyan-700">Loading supplier catalogue...</div> : storefrontError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800">{storefrontError}</div> : fabricCatalogueItems.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{fabricCatalogueItems.slice(0, 9).map((item) => { const specs = item.fabric_specs || {}; const rate = Number(item.price || item.price_range_min || 0); const specChips = [specs.fabric_type, specs.gsm ? `${specs.gsm} GSM` : "", specs.width, specs.shade, specs.rate_unit].filter(Boolean); return <article key={item._id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-xl hover:shadow-cyan-100/50"><div className="relative aspect-[4/3] bg-slate-100">{item.images?.[0] ? <img src={item.images[0]} alt={item.item_name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <div className="grid h-full place-items-center text-xs font-bold text-slate-400">No fabric image</div>}<span className="absolute left-3 top-3 rounded-full bg-cyan-600 px-2.5 py-1 text-[10px] font-black text-white shadow">Fabric</span>{rate > 0 && <span className="absolute bottom-3 right-3 rounded-2xl bg-white/95 px-3 py-1.5 text-sm font-black text-slate-900 shadow">Rs {rate.toLocaleString("en-IN")}</span>}</div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h4 className="text-base font-black text-slate-900">{item.item_name}</h4><p className="mt-1 text-xs font-semibold text-slate-500">MOQ {item.moq || "to confirm"}</p></div></div><div className="mt-3 flex flex-wrap gap-1.5">{specChips.length ? specChips.slice(0, 5).map((chip) => <span key={chip} className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-bold text-cyan-700">{chip}</span>) : <span className="text-xs text-slate-400">Specs available after supplier update</span>}</div><p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-slate-500">{item.description || [specs.composition, specs.weave, specs.finish, specs.testing_notes].filter(Boolean).join(" / ") || "Add this fabric to the PO cart and edit quantity, shade or rate before creating the PO."}</p><button type="button" onClick={() => addCatalogueFabric(item)} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-100 hover:from-teal-700 hover:to-cyan-700">Add to fabric cart</button></div></article>; })}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center"><p className="text-sm font-black text-slate-700">No fabric catalogue from this supplier yet.</p><p className="mt-1 text-xs text-slate-500">Use manual fabric cart lines below, or ask the supplier to add fabric catalogue items from vendor portal.</p></div>}
        </div>
      </section>}

      <div ref={cartLinesRef} className="mt-6 space-y-3 scroll-mt-24">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-900">Fabric cart lines</p>
            <p className="text-xs font-semibold text-slate-500">Add one card per fabric, trim, shade or width. Every value can be edited before PO creation.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{form.items.length} line{form.items.length === 1 ? "" : "s"}</span>
        </div>
        {form.items.map((line, index) => <section key={index} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-50 text-sm font-black text-cyan-700">{index + 1}</span>
            <button type="button" disabled={form.items.length === 1} onClick={() => removeLine(index)} className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-600 disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300">Remove</button>
          </div>
          <div className="grid gap-3 md:grid-cols-12">
            <label className="md:col-span-4 text-xs font-black uppercase tracking-wide text-slate-500">Fabric / trim<input required value={line.fabric_name} onChange={(e) => changeItem(index, "fabric_name", e.target.value)} placeholder="Cotton viscose" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-400" /></label>
            <label className="md:col-span-3 text-xs font-black uppercase tracking-wide text-slate-500">Fabric type<input value={line.fabric_type} onChange={(e) => changeItem(index, "fabric_type", e.target.value)} placeholder="Woven / knit" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-400" /></label>
            <label className="md:col-span-2 text-xs font-black uppercase tracking-wide text-slate-500">GSM<input value={line.gsm} onChange={(e) => changeItem(index, "gsm", e.target.value)} placeholder="180" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-400" /></label>
            <label className="md:col-span-3 text-xs font-black uppercase tracking-wide text-slate-500">Width<input value={line.width} onChange={(e) => changeItem(index, "width", e.target.value)} placeholder="58 inch" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-400" /></label>
            <label className="md:col-span-3 text-xs font-black uppercase tracking-wide text-slate-500">Colour / shade<input value={line.color} onChange={(e) => changeItem(index, "color", e.target.value)} placeholder="Navy" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-400" /></label>
            <label className="md:col-span-3 text-xs font-black uppercase tracking-wide text-slate-500">Total fabric<input required min="0.001" step="any" type="number" value={line.total_quantity} onChange={(e) => changeItem(index, "total_quantity", e.target.value)} placeholder="168" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-400" /></label>
            <label className="md:col-span-2 text-xs font-black uppercase tracking-wide text-slate-500">Unit<input value={line.unit} onChange={(e) => changeItem(index, "unit", e.target.value)} placeholder="m" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-400" /></label>
            <label className="md:col-span-2 text-xs font-black uppercase tracking-wide text-slate-500">Rate<input min="0" step="any" type="number" value={line.rate} onChange={(e) => changeItem(index, "rate", e.target.value)} placeholder="Rate" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-400" /></label>
            <label className="md:col-span-12 text-xs font-black uppercase tracking-wide text-slate-500">Remarks<input value={line.remarks} onChange={(e) => changeItem(index, "remarks", e.target.value)} placeholder="Dye lot, shrinkage, shade, test report or delivery instruction" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-400" /></label>
          </div>
        </section>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={addLine} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100">+ Add fabric line</button><div className="rounded-2xl bg-slate-50 px-4 py-3 text-right"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Estimated fabric value</p><p className="text-xl font-black text-slate-900">Rs {total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p></div></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Payment terms"><input value={form.payment_terms} onChange={(e) => update("payment_terms", e.target.value)} placeholder="e.g. 30% advance, balance on delivery" /></Field><Field label="PO notes"><input value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Shade approval, test report, delivery instruction" /></Field></div>
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => downloadFabricSheetCsv({ purchase_order_no: "fabric-po-draft", vendor_name: selectedVendorName, order_date: form.order_date, sheet: [] }, form.items)} className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-bold text-cyan-700 hover:bg-cyan-100">Download draft sheet</button><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving || !canCreate} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Creating..." : isWalkin ? "Create Walk-in Fabric PO + link" : "Create Fabric PO + sheet"}</button></div>
    </form>
  </Modal>;
}

function CreateOrderModal({ form, setForm, vendors, plans, stock, onClose, onSubmit, saving }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectedPlan = plans.find((plan) => plan.id === form.material_plan_id);
  const chooseVendor = (vendorId) => { const vendor = vendors.find((item) => item.id === vendorId); setForm((current) => ({ ...current, vendor_id: vendorId, job_worker_name: vendor?.name || "" })); };
  const choosePlan = (planId) => { const plan = plans.find((item) => item.id === planId); setForm((current) => ({ ...current, material_plan_id: planId, finished_product: plan?.style_name || current.finished_product, expected_quantity: plan ? String(plan.planned_quantity || "") : current.expected_quantity, unit: plan?.finished_unit || current.unit })); };
  const readiness = (selectedPlan?.materials || []).map((material) => { const wanted = String(material.material_name || "").trim().toLowerCase(); const matches = stock.filter((item) => { const name = String(item.product || "").toLowerCase(); return wanted && (name.includes(wanted) || wanted.includes(name)); }); const available = matches.reduce((total, item) => total + Number(item.available_qty || 0), 0); const required = Number(material.required_quantity || 0); return { ...material, available, shortage: Math.max(0, required - available), matchCount: matches.length }; });
  const shortages = readiness.filter((line) => line.shortage > 0);
  return <Modal title="Create job work order" onClose={onClose}><form onSubmit={onSubmit} className="p-6"><p className="mb-5 rounded-2xl bg-violet-50 p-4 text-sm text-violet-900"><b>Simple flow:</b> select the saved style BOM, choose the job worker, create the planned order, then issue material only when it physically leaves your store. This keeps the production plan and stock movement connected.</p><div className="grid gap-4 md:grid-cols-2"><Field label="Style BOM / material plan (recommended)"><select value={form.material_plan_id} onChange={(e) => choosePlan(e.target.value)}><option value="">Manual job work order (no BOM link)</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_no} · {plan.style_name} · {plan.planned_quantity} {plan.finished_unit}</option>)}</select></Field><Field label="Registered RMS vendor (recommended)"><select value={form.vendor_id} onChange={(e) => chooseVendor(e.target.value)}><option value="">Manual / unregistered job worker</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.business_type?.length ? ` · ${vendor.business_type.join(", ")}` : ""}</option>)}</select></Field><Field label="Job worker name *"><input required={!form.vendor_id} readOnly={Boolean(form.vendor_id)} value={form.job_worker_name} onChange={(e) => update("job_worker_name", e.target.value)} placeholder="e.g. ABC Cutting Works" /></Field><Field label="Job work type *"><select value={form.job_work_type} onChange={(e) => update("job_work_type", e.target.value)}>{JOB_WORK_TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field><Field label="Finished product / style *"><input required value={form.finished_product} onChange={(e) => update("finished_product", e.target.value)} placeholder="e.g. Men's cotton T-shirt" /></Field><Field label="Expected output *"><div className="grid grid-cols-[1fr_110px] gap-2"><input required min="0.001" step="any" type="number" value={form.expected_quantity} onChange={(e) => update("expected_quantity", e.target.value)} placeholder="Quantity" /><input value={form.unit} onChange={(e) => update("unit", e.target.value)} placeholder="pcs" /></div></Field><Field label="Expected completion"><input type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} /></Field><Field label="Notes"><input value={form.remarks} onChange={(e) => update("remarks", e.target.value)} placeholder="Style, measurements or instructions" /></Field></div>{selectedPlan && <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200"><div className="flex items-center justify-between bg-slate-50 px-4 py-3"><div><p className="text-sm font-black text-slate-800">Material readiness · {selectedPlan.plan_no}</p><p className="text-xs text-slate-500">Calculated from the selected BOM; matching is based on the material name in central stock.</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${shortages.length ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>{shortages.length ? `${shortages.length} shortage${shortages.length === 1 ? "" : "s"}` : "Ready to issue"}</span></div><div className="divide-y divide-slate-100">{readiness.map((line) => <div key={line.material_name} className="grid grid-cols-[minmax(0,1fr)_100px_100px] gap-3 px-4 py-3 text-sm"><div><p className="font-bold text-slate-800">{line.material_name}</p><p className="text-xs text-slate-400">Need {line.required_quantity} {line.unit}{line.matchCount ? " · stock match found" : " · no stock match"}</p></div><span className="text-right font-semibold text-slate-600">{line.available.toLocaleString()} {line.unit}</span><span className={`text-right font-bold ${line.shortage ? "text-amber-700" : "text-emerald-700"}`}>{line.shortage ? `Short ${line.shortage.toLocaleString()}` : "Available"}</span></div>)}</div></div>}{shortages.length > 0 && <p className="mt-3 text-sm font-semibold text-amber-800">You can still create this planned job. Create a Fabric PO or receive stock first; RMS will prevent issuing more material than is available.</p>}<div className="mt-6 rounded-2xl bg-violet-50 p-4 text-sm text-violet-800"><b>What happens next:</b> the job is saved with this BOM. On the next screen, confirm the physical material dispatch and create the issue challan. Only then does central stock move out and the registered vendor sees the order.</div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Creating…" : selectedPlan ? "Create planned job" : "Create order"}</button></div></form></Modal>;
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
