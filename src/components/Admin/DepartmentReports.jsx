import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";
const InventoryManagementStockValuationReport = lazy(() => import("../InventoryManagement/InventoryManagementStockValuationReport.jsx"));
const InventoryManagementItemAgingReport = lazy(() => import("../InventoryManagement/InventoryManagementItemAgingReport.jsx"));
const BuyerReports = lazy(() => import("../Mbuyer/Reports.jsx"));
const DepartmentOverviewReport = lazy(() => import("./DepartmentOverviewReport.jsx"));

function FinanceReport() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/finance/reports`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.detail || "Could not load finance report."); return body; })
      .then(setData).catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert" className="p-6 text-sm text-rose-700">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-slate-500">Loading finance report…</p>;
  const metrics = [["Revenue", "revenue"], ["Purchase total", "purchase_total"], ["Expenses", "expense_total"], ["Estimated margin", "estimated_margin"], ["Accounts payable", "accounts_payable"], ["Accounts receivable", "accounts_receivable"], ["Net GST", "gst_net"]];
  return <div className="space-y-5 p-5"><div><h3 className="text-lg font-bold text-slate-900">Finance summary</h3><p className="text-sm text-slate-500">Tenant-wide totals from the finance report.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, key]) => <div key={key} className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-slate-900">₹{Number(data.summary?.[key] || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p></div>)}</div><div><h4 className="font-semibold text-slate-800">Vouchers · last 30 days</h4>{(data.voucher_totals_30_days || []).length ? data.voucher_totals_30_days.map(row => <div key={row.type} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span className="capitalize text-slate-600">{row.type.replaceAll("_", " ")}</span><span className="font-semibold">₹{Number(row.amount).toLocaleString("en-IN")}</span></div>) : <p className="mt-2 text-sm text-slate-500">No vouchers recorded in this period.</p>}</div></div>;
}

const DEPARTMENTS = ["Inventory", "Finance", "Logistics", "Merchandiser Buyer", "Design & Pattern", "Forecast & Analytics", "Third Party", "Production & Job Work", "Marketing", "Customer CRM", "Visual Merchandising"];
const REPORTS = {
  Inventory: [
    { label: "Stock valuation", Component: InventoryManagementStockValuationReport },
    { label: "Item ageing", Component: InventoryManagementItemAgingReport },
  ],
  "Merchandiser Buyer": [{ label: "Buying reports", Component: BuyerReports }],
  Finance: [{ label: "Finance summary", Component: FinanceReport }],
  ...Object.fromEntries(["Logistics", "Design & Pattern", "Forecast & Analytics", "Third Party", "Production & Job Work", "Marketing", "Customer CRM", "Visual Merchandising"].map(department => [department, [{ label: "Overview", Component: DepartmentOverviewReport }]])),
};

export default function DepartmentReports({ selectedDepartment = "" }) {
  const managedDepartments = useMemo(() => {
    try {
      const data = JSON.parse(localStorage.getItem("admin_login_data") || "{}");
      return Array.isArray(data.departments) ? data.departments : [];
    } catch { return []; }
  }, []);
  const available = DEPARTMENTS.filter(department => managedDepartments.includes(department));
  const [activeDept, setActiveDept] = useState(() => available.includes(selectedDepartment) ? selectedDepartment : available[0]);
  const [reportIndex, setReportIndex] = useState(0);
  const reports = REPORTS[activeDept] || [];
  const Report = reports[reportIndex]?.Component || reports[0]?.Component;

  if (!available.length) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No departments are assigned to this admin account.</div>;
  return <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
    {!selectedDepartment && <><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">HQ overview</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Department reports</h2><p className="mt-1 text-sm text-slate-500">Choose a department to review its reports.</p></div>
    <div className="flex flex-wrap gap-2">{available.map(department => <button key={department} onClick={() => { setActiveDept(department); setReportIndex(0); }} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${activeDept === department ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{department}</button>)}</div></>}
    {reports.length > 1 && <div className="flex flex-wrap gap-2">{reports.map((report, i) => <button key={report.label} onClick={() => setReportIndex(i)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${reportIndex === i ? "bg-indigo-50 text-indigo-700" : "bg-white text-slate-600"}`}>{report.label}</button>)}</div>}
    {Report ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)]"><Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading report…</p>}><Report key={`${activeDept}-${reportIndex}`} department={activeDept} /></Suspense></div> : <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><BarChart3 className="mx-auto h-7 w-7 text-slate-400" /><h3 className="mt-3 font-semibold text-slate-800">No standalone {activeDept} report is available here yet</h3><p className="mt-1 text-sm text-slate-500">This department needs a dedicated report view before its consolidated figures can be shown.</p></div>}
  </div>;
}
