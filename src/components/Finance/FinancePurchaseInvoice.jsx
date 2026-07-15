import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useState, useEffect, useMemo, useCallback } from "react"; // Hot reload trigger 2
import {
  FileText, Search, Plus, X, Coins, ArrowUpRight, ShieldCheck, CheckCircle2, Clock, HelpCircle, AlertTriangle, Building2, User, Link, AlertOctagon
} from "lucide-react";
import { toast } from "react-hot-toast";

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   API CONSTANTS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const PI_API = `${APP_API_URL}/purchase-invoices`;
const PO_API = `${APP_API_URL}/purchaseorders`;
const GRN_API = `${APP_API_URL}/grn`;
const GRC_API = `${APP_API_URL}/grc`;

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   HELPERS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const n0 = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const clamp0 = (v) => Math.max(0, n0(v));
const money = (v) => clamp0(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => {
  if (!d) return "â€”";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   CONSTANTS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const PAYMENT_MODES = [
  { value: "NEFT", label: "NEFT", icon: "" },
  { value: "RTGS", label: "RTGS", icon: "" },
  { value: "UPI", label: "UPI", icon: "" },
  { value: "Cheque", label: "Cheque", icon: "" },
  { value: "PostDatedCheque", label: "PDC", icon: "" },
  { value: "Cash", label: "Cash", icon: "" },
  { value: "DD", label: "DD", icon: "" },
  { value: "Net30", label: "Net 30", icon: "" },
  { value: "Net45", label: "Net 45", icon: "" },
  { value: "Net60", label: "Net 60", icon: "" },
  { value: "Advance", label: "Advance", icon: "" },
  { value: "CreditNote", label: "Credit Note", icon: "" },
  { value: "Other", label: "Other", icon: "" },
];
const PAYMENT_TERMS = ["Net15", "Net30", "Net45", "Net60", "Net90", "Immediate", "Advance", "Custom"];
const EMPTY_ITEM = () => ({
  barcode: "", description: "", grnQty: 0, invoicedQty: "", rate: "", poRate: 0,
  taxPct: "", discountPct: "", taxAmount: 0, discountAmount: 0, lineAmount: 0, varianceFlag: "", remarks: "",
});



const C = {
  bg: "#F6F4EF", card: "#FFFFFF", border: "#E5E1D8", text: "#000000", muted: "#000000",
  accent: "#8B4513", accentLight: "#FDF0E4", accentBorder: "#F0C090",
  green: "#146B3A", red: "#9B1C1C", blue: "#1E3A8A", surface: "#FDFBF8",
  directBg: "#EFF6FF", directBorder: "#BFDBFE", directText: "#1E40AF",
  poBg: "#F5F3FF", poBorder: "#DDD6FE", poText: "#5B21B6",
};

const STATUS_META = {
  Draft: { bg: "bg-amber-200 text-amber-800 border-amber-300", dot: "bg-amber-600" },
  Submitted: { bg: "bg-blue-200 text-blue-800 border-blue-300", dot: "bg-blue-600" },
  UnderReview: { bg: "bg-purple-200 text-purple-800 border-purple-300", dot: "bg-purple-600" },
  OnHold: { bg: "bg-orange-200 text-orange-800 border-orange-300", dot: "bg-orange-600" },
  Approved: { bg: "bg-green-200 text-green-800 border-green-300", dot: "bg-green-600" },
  PartiallyPaid: { bg: "bg-cyan-200 text-cyan-800 border-cyan-300", dot: "bg-cyan-600" },
  Paid: { bg: "bg-emerald-200 text-emerald-900 border-emerald-400", dot: "bg-emerald-700" },
  Cancelled: { bg: "bg-red-200 text-red-800 border-red-300", dot: "bg-red-600" },
};

const PAY_META = {
  Unpaid: "bg-red-200 text-red-800 border-red-300",
  Partial: "bg-orange-200 text-orange-800 border-orange-300",
  Paid: "bg-green-200 text-green-800 border-green-300",
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SMALL SHARED COMPONENTS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function StatusPill({ s }) {
  const m = STATUS_META[s] || STATUS_META.Draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wide border ${m.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {s || "â€”"}
    </span>
  );
}

function PayStatusPill({ s }) {
  const m = PAY_META[s] || PAY_META.Unpaid;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wide border ${m}`}>
      {s || "â€”"}
    </span>
  );
}

function MatchBadge({ match }) {
  if (!match) return null;
  const ok = match.matched;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wide border ${ok ? "bg-green-200 text-green-800 border-green-300" : "bg-red-200 text-red-800 border-red-300"}`}>
      {ok ? "Match OK" : "Match Failed"}
    </span>
  );
}

function TypeBadge({ t }) {
  const d = t === "direct_grc";
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wide border ${d ? "bg-blue-200 text-blue-800 border-blue-300" : "bg-indigo-200 text-indigo-800 border-indigo-300"}`}>
      {d ? "Direct GRC" : "PO-Linked"}
    </span>
  );
}

function VendorBadge({ isRegistered }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wide border ${isRegistered ? "bg-emerald-200 text-emerald-800 border-emerald-300" : "bg-orange-200 text-orange-800 border-orange-300"}`}>
      {isRegistered ? "Registered" : "Walk-in"}
    </span>
  );
}

function KPICard({ title, value, icon, iconColor }) {
  return (
    <div className="relative min-h-[85px] bg-white rounded-xl p-3.5 flex flex-col justify-between overflow-hidden shadow-sm border border-slate-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer">
      <div className="flex items-center justify-between gap-2 relative z-10">
        <p className="text-sm font-bold text-black uppercase tracking-wider">
          {title}
        </p>
        <div className={`rounded-md p-1.5 shadow-sm ${iconColor}`}>{icon}</div>
      </div>
      <h3 className="mt-2 break-words text-2xl font-black text-black leading-tight relative z-10">{value}</h3>
    </div>
  );
}

function SectionCard({ title, badge, children }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm hover:shadow-[0_20px_50px_rgba(15,23,42,0.06)] transition-all duration-300">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
        <h2 className="text-lg font-medium text-slate-900">{title}</h2>
        {badge ? (
          <span className="rounded-full bg-indigo-50 border border-indigo-100 px-3.5 py-1 text-xs font-semibold text-indigo-700">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
function Overlay({ onClose, children, wide }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className={`w-full ${wide ? "max-w-6xl" : "max-w-md"} rounded-2xl border border-slate-200 bg-white shadow-2xl relative flex flex-col max-h-full overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
        {children}
      </div>
    </div>
  );
}
function MiniModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50">
          <h3 className="font-semibold text-slate-800 text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">âœ•</button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function FCard({ title, sub, right, children }) {
  return (
    <div style={{ marginBottom: 20, background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)" }}>
      <div style={{ padding: "16px 20px", background: "#F0EDE6", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{title}</div>
          {sub && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{sub}</div>}
        </div>
        {right}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function FField({ label, req, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
        {label}{req && <span style={{ color: C.red, marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function TblBtn({ children, onClick, color, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 750,
        background: `${color}15`, color, border: `1px solid ${color}30`, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s"
      }}>
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        padding: "8px 16px", borderRadius: 8, background: C.surface, color: C.text,
        border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, cursor: "pointer"
      }}>
      {children}
    </button>
  );
}

function Spinner() {
  return <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />;
}



/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ROOT COMPONENT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function PurchaseInvoiceManager() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [active, setActive] = useState(null);
  const [reasonInput, setReasonInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterVendType, setFilterVendType] = useState("All");
  const [activeTab, setActiveTab] = useState("invoices");

  const showToast = (msg, type = "ok") => {
    if (type === "err") {
      toast.error(msg, { duration: 4000, id: msg });
    } else {
      toast.success(msg, { duration: 3000, id: msg });
    }
  };

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(PI_API);
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : []);
    } catch (e) { showToast(e.message, "err"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const apiCall = async (url, method = "POST", body = null) => {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body !== null) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Action failed");
    return data;
  };

  const handleSave = async (payload) => {
    const isEdit = !!payload.id;
    try {
      await apiCall(isEdit ? `${PI_API}/${payload.id}` : PI_API, isEdit ? "PUT" : "POST", payload);
      showToast(isEdit ? "Invoice updated" : "Invoice created & vendor notified");
      setModal(null); setActive(null); fetchInvoices();
    } catch (e) { showToast(e.message, "err"); }
  };
  const handleSubmit = async (inv) => { try { const d = await apiCall(`${PI_API}/${inv.id}/submit`); showToast(d.message); fetchInvoices(); } catch (e) { showToast(e.message, "err"); } };
  const handleApprove = async (inv) => { try { const d = await apiCall(`${PI_API}/${inv.id}/approve`); showToast(d.message); fetchInvoices(); } catch (e) { showToast(e.message, "err"); } };
  const handleHold = async () => {
    if (!reasonInput.trim()) return showToast("Enter a hold reason", "err");
    try { const d = await apiCall(`${PI_API}/${active.id}/hold`, "POST", { reason: reasonInput }); showToast(d.message); closeModal(); fetchInvoices(); } catch (e) { showToast(e.message, "err"); }
  };
  const handleCancel = async () => {
    if (!reasonInput.trim()) return showToast("Enter a cancellation reason", "err");
    try { const d = await apiCall(`${PI_API}/${active.id}/cancel`, "POST", { reason: reasonInput }); showToast(d.message); closeModal(); fetchInvoices(); } catch (e) { showToast(e.message, "err"); }
  };
  const handleDelete = async () => {
    try { await apiCall(`${PI_API}/${active.id}`, "DELETE"); showToast("Invoice deleted"); closeModal(); fetchInvoices(); } catch (e) { showToast(e.message, "err"); }
  };
  const closeModal = () => { setModal(null); setActive(null); setReasonInput(""); };

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter(inv => {
      const ms = filterStatus === "All" || inv.status === filterStatus;
      const mt = filterType === "All" || inv.invoiceType === filterType;
      const mvt = filterVendType === "All"
        || (filterVendType === "registered" && inv.isRegisteredVendor)
        || (filterVendType === "walkin" && !inv.isRegisteredVendor);
      const mq = !q || [inv.invoiceNo, inv.vendorInvoiceNo, inv.poNo, inv.directGrcNo, inv.vendorName]
        .some(f => (f || "").toLowerCase().includes(q));
      return ms && mt && mvt && mq;
    });
  }, [invoices, search, filterStatus, filterType, filterVendType]);

  const kpis = useMemo(() => ({
    total: invoices.length,
    poLinked: invoices.filter(i => i.invoiceType !== "direct_grc").length,
    direct: invoices.filter(i => i.invoiceType === "direct_grc").length,
    registered: invoices.filter(i => i.isRegisteredVendor).length,
    walkin: invoices.filter(i => !i.isRegisteredVendor).length,
    noContact: invoices.filter(i => !i.isRegisteredVendor && !i.vendorEmail && !i.vendorPhone && !["Paid", "Cancelled"].includes(i.status)).length,
    onHold: invoices.filter(i => i.status === "OnHold").length,
    overdue: invoices.filter(i => i.dueDate && i.dueDate < today() && i.paymentStatus !== "Paid").length,
    totalDue: invoices.reduce((s, i) => s + n0(i.balanceDue), 0),
  }), [invoices]);

  const TABS = [
    { id: "invoices", label: "Invoices" },
    { id: "notifications", label: "Notifications" },
    { id: "aging", label: "AP Aging" },
    { id: "vendor", label: "Vendor Portal" },
  ];

  return (
    <div className="min-h-full bg-transparent p-4 lg:p-6 font-sans text-slate-900 flex flex-col gap-6">

      <div className="mx-auto w-full max-w-[1750px] space-y-6 min-w-0">
        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-2xl p-5 shadow-sm flex flex-col gap-4 md:flex-row md:items-center transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-black tracking-tight">Purchase Invoices</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button className="flex items-center gap-2 rounded-2xl bg-indigo-750 bg-indigo-700 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-800 transition shadow-md hover:-translate-y-[1px]" onClick={() => { setActive(null); setModal("form"); }}>
              <Plus size={16} />
              <span>New Invoice</span>
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <KPICard title="Total" value={kpis.total} icon={<FileText size={20} />} iconColor="bg-slate-100 text-slate-700" />
          <KPICard title="PO-Linked" value={kpis.poLinked} icon={<Link size={20} />} iconColor="bg-indigo-100 text-indigo-700" />
          <KPICard title="Direct GRC" value={kpis.direct} icon={<ArrowUpRight size={20} />} iconColor="bg-blue-100 text-blue-700" />
          <KPICard title="Registered" value={kpis.registered} icon={<ShieldCheck size={20} />} iconColor="bg-emerald-100 text-emerald-700" />
          <KPICard title="No Contact" value={kpis.noContact} icon={<AlertTriangle size={20} />} iconColor="bg-red-100 text-red-700" />
          <KPICard title="Walk-in" value={kpis.walkin} icon={<User size={20} />} iconColor="bg-amber-100 text-amber-700" />
          <KPICard title="On Hold" value={kpis.onHold} icon={<Clock size={20} />} iconColor="bg-orange-100 text-orange-700" />
          <KPICard title="Overdue" value={kpis.overdue} icon={<AlertOctagon size={20} />} iconColor="bg-rose-100 text-rose-700" />
          <KPICard title="Total Balance" value={`₹${money(kpis.totalDue)}`} icon={<Coins size={20} />} iconColor="bg-violet-100 text-violet-700" />
        </div>

        {/* No-contact alert */}
        {kpis.noContact > 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800 font-medium">
            <span><b>{kpis.noContact} walk-in invoice(s)</b> have no contact info â€” open the Notifications tab to add email/phone and send manually.</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`rounded-full px-6 py-2.5 text-lg font-semibold transition-all shadow-sm border ${activeTab === t.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-900 border-slate-300 hover:bg-slate-100"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* â•â• TAB: INVOICES â•â• */}
        {activeTab === "invoices" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="relative flex-1 min-w-[220px]">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search invoice no, PO, GRC, vendorâ€¦"
                  className="w-full rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
              </div>
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                {[["All", "All"], ["po_linked", "PO-Linked"], ["direct_grc", "Direct GRC"]].map(([v, l]) => (
                  <button key={v} onClick={() => setFilterType(v)}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all shadow-sm border ${filterType === v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-900 border-slate-300 hover:bg-slate-100"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                {[["All", "All Vendors"], ["registered", "Registered"], ["walkin", "Walk-in"]].map(([v, l]) => (
                  <button key={v} onClick={() => setFilterVendType(v)}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all shadow-sm border ${filterVendType === v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-900 border-slate-300 hover:bg-slate-100"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-l border-slate-200 pl-3">
                {["All", "Draft", "Submitted", "UnderReview", "OnHold", "Approved", "PartiallyPaid", "Paid", "Cancelled"].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all shadow-sm border ${filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-900 border-slate-300 hover:bg-slate-100"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="w-full overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm min-w-[1500px]">
                  <thead className="bg-slate-50/50 border-b border-slate-200">
                    <tr>
                      {["SL No", "Invoice No", "Vendor Inv", "Type", "Vendor", "PO/GRC", "Date", "Due", "Status", "Pay", "Match", "Total", "Balance", "Notified", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3.5 text-lg font-semibold text-slate-900 bg-slate-100 border-b border-slate-200 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loading ? (
                      <tr><td colSpan={15} className="p-14 text-center text-sm text-slate-800">
                        <div className="flex items-center justify-center gap-3">
                          Loading invoicesâ€¦
                        </div>
                      </td></tr>
                    ) : visible.length === 0 ? (
                      <tr><td colSpan={15} className="p-14 text-center text-sm text-slate-800">
                        No invoices match your filters.
                      </td></tr>
                    ) : visible.map((inv, i) => {
                      const isOverdue = inv.dueDate && inv.dueDate < today() && inv.paymentStatus !== "Paid";
                      const isDirect = inv.invoiceType === "direct_grc";
                      const sourceRef = isDirect ? (inv.directGrcNo || "â€”") : (inv.poNo || "â€”");
                      const noContact = !inv.isRegisteredVendor && !inv.vendorEmail && !inv.vendorPhone;
                      return (
                        <tr key={inv.id}
                          onClick={() => { setActive(inv); setModal("view"); }}
                          className={`group cursor-pointer transition-colors hover:bg-slate-50 ${noContact ? "bg-amber-50" : "bg-white"}`}>
                          <td className="px-4 py-4.5 font-mono text-sm font-semibold text-slate-500 text-center">
                            {i + 1}
                          </td>
                          <td className="px-4 py-4.5">
                            <span className="font-mono text-sm font-semibold text-slate-900">{inv.invoiceNo || "â€”"}</span>
                          </td>
                          <td className="px-4 py-4.5 font-mono text-[10px] font-bold text-slate-500">{inv.vendorInvoiceNo || "â€”"}</td>
                          <td className="px-4 py-4.5">
                            <TypeBadge t={inv.invoiceType} />
                            <div className="mt-1"><VendorBadge isRegistered={inv.isRegisteredVendor} /></div>
                            {noContact && <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-600"><AlertTriangle size={11} /> No contact</div>}
                          </td>
                          <td className="px-4 py-4.5 max-w-[200px]">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm shrink-0">
                                {(inv.vendorName || "â€”").charAt(0)}
                              </div>
                              <div className="">
                                <div className="font-semibold text-slate-500 text-sm break-words">{inv.vendorName || "â€”"}</div>
                                {inv.vendorEmail && <div className="mt-0.5 text-xs text-slate-500 break-words">ðŸ“§ {inv.vendorEmail}</div>}
                                {!inv.isRegisteredVendor && inv.vendorPhone && <div className="mt-0.5 text-xs text-slate-500 break-words">ðŸ“± {inv.vendorPhone}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4.5 font-mono text-[10px] font-bold text-slate-500">{sourceRef}</td>
                          <td className="px-4 py-4.5 text-sm font-medium text-slate-500">{fmtDate(inv.invoiceDate)}</td>
                          <td className={`px-4 py-4.5 text-sm ${isOverdue ? "font-semibold text-red-600" : "text-slate-500 font-medium"}`}>
                            {fmtDate(inv.dueDate)}{isOverdue && " âš "}
                          </td>
                          <td className="px-4 py-4.5"><StatusPill s={inv.status} /></td>
                          <td className="px-4 py-4.5"><PayStatusPill s={inv.paymentStatus} /></td>
                          <td className="px-4 py-4.5"><MatchBadge match={inv.threeWayMatch} /></td>
                          <td className="px-4 py-4.5 font-mono text-sm font-semibold text-slate-900">₹{money(inv.invoiceTotal)}</td>
                          <td className={`px-4 py-4.5 font-mono text-sm font-semibold ${n0(inv.balanceDue) > 0 ? "text-indigo-700" : "text-emerald-700"}`}>
                            ₹{money(inv.balanceDue)}
                          </td>
                          <td className="px-4 py-4.5">
                            {inv.vendorNotified
                              ? <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600"><CheckCircle2 size={12} /> Yes{inv.vendorAcknowledged ? " (Ack)" : ""}</span>
                              : <span className="flex items-center gap-1 text-[11px] font-medium text-red-600"><X size={12} /> Pending</span>}
                            {inv.isRegisteredVendor && <div className="mt-0.5 text-[10px] text-slate-500 font-medium">PORTAL</div>}
                          </td>
                          <td className="px-4 py-4.5" onClick={e => e.stopPropagation()}>
                            <div className="flex flex-wrap gap-1.5">
                              {inv.status === "Draft" && <TblBtn color="#8B4513" onClick={() => { setActive(inv); setModal("form"); }}>Edit</TblBtn>}
                              {inv.status === "Draft" && <TblBtn color="#7C3AED" onClick={() => handleSubmit(inv)}>Submit</TblBtn>}
                              {["Submitted", "UnderReview", "OnHold"].includes(inv.status) && <TblBtn color="#15803D" onClick={() => handleApprove(inv)}>Approve</TblBtn>}
                              {["Approved", "PartiallyPaid"].includes(inv.status) && <TblBtn color="#0D9488" onClick={() => { setActive(inv); setModal("pay"); }}>Pay</TblBtn>}
                              <TblBtn color="#2563EB" onClick={() => { setActive(inv); setModal("notify"); }}>Notify</TblBtn>
                              {!["Paid", "Cancelled"].includes(inv.status) && <TblBtn color="#EA580C" onClick={() => { setActive(inv); setReasonInput(""); setModal("hold"); }}>Hold</TblBtn>}
                              {!["Paid", "Cancelled"].includes(inv.status) && <TblBtn color="#B91C1C" onClick={() => { setActive(inv); setReasonInput(""); setModal("cancel"); }}>Cancel</TblBtn>}
                              {inv.status === "Draft" && <TblBtn color="#DC2626" onClick={() => { setActive(inv); setModal("delete"); }}>Del</TblBtn>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {visible.length > 0 && (
                <div className="flex justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
                  <span>Showing {visible.length} of {invoices.length}</span>
                  <span>Balance: <b className="font-mono text-indigo-600">₹{money(visible.reduce((s, i) => s + n0(i.balanceDue), 0))}</b></span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "notifications" && <NotificationCenter invoices={invoices} showToast={showToast} onRefresh={fetchInvoices} />}
        {activeTab === "aging" && <AgingReport showToast={showToast} />}
        {activeTab === "vendor" && <VendorPortal invoices={invoices} showToast={showToast} onRefresh={fetchInvoices} />}
      </div>

      {/* Modals */}
      {modal === "form" && <Overlay onClose={closeModal} wide><InvoiceForm initialInv={active} onClose={closeModal} onSave={handleSave} /></Overlay>}
      {modal === "view" && active && <Overlay onClose={closeModal} wide><InvoiceViewModal inv={active} onClose={closeModal} showToast={showToast} onRefresh={fetchInvoices} /></Overlay>}
      {modal === "pay" && active && <Overlay onClose={closeModal}><PaymentForm inv={active} onClose={() => { closeModal(); fetchInvoices(); }} showToast={showToast} /></Overlay>}
      {modal === "notify" && active && <Overlay onClose={closeModal}><NotifyVendorModal inv={active} onClose={() => { closeModal(); fetchInvoices(); }} showToast={showToast} /></Overlay>}
      {["hold", "cancel", "delete"].includes(modal) && active && (
        <MiniModal title={modal === "hold" ? `Hold ${active.invoiceNo}?` : modal === "cancel" ? `Cancel ${active.invoiceNo}?` : `Delete ${active.invoiceNo}?`} onClose={closeModal}>
          {modal !== "delete" && (
            <>
              <p className="mb-3 text-sm text-slate-500">
                {modal === "hold" ? "Provide a reason for holding." : "Provide a cancellation reason."}
              </p>
              <textarea rows={3} value={reasonInput} onChange={e => setReasonInput(e.target.value)} placeholder="Reasonâ€¦"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            </>
          )}
          {modal === "delete" && <p className="mb-4 text-sm text-slate-500">This permanently deletes the draft invoice.</p>}
          <div className="mt-5 flex justify-end gap-2">
            <GhostBtn onClick={closeModal}>Back</GhostBtn>
            <button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              onClick={modal === "hold" ? handleHold : modal === "cancel" ? handleCancel : handleDelete}>
              {modal === "hold" ? "Confirm Hold" : modal === "cancel" ? "Confirm Cancel" : "Delete Invoice"}
            </button>
          </div>
        </MiniModal>
      )}
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   NOTIFY VENDOR MODAL
   Handles BOTH registered vendors (portal + email)
   and non-registered / walk-in vendors (email / SMS / WhatsApp)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function NotifyVendorModal({ inv, onClose, showToast }) {
  const isReg = !!inv.isRegisteredVendor;
  const [channel, setChannel] = useState(isReg ? "email" : inv.vendorEmail ? "email" : "sms");
  const [to, setTo] = useState(isReg ? (inv.vendorEmail || "") : (inv.vendorEmail || inv.vendorPhone || ""));
  const [subject, setSubject] = useState(`Invoice ${inv.invoiceNo} â€” ${inv.vendorName}`);
  const [message, setMessage] = useState(
    `Dear ${inv.vendorName || "Vendor"},\n\nThis is to inform you regarding Invoice ${inv.invoiceNo} dated ${inv.invoiceDate}.\n\nInvoice Total : ₹${n0(inv.invoiceTotal).toLocaleString("en-IN")}\nBalance Due   : ₹${n0(inv.balanceDue).toLocaleString("en-IN")}\nStatus        : ${inv.status}\nDue Date      : ${inv.dueDate || "â€”"}\n\nPlease contact the AP team for any queries.\n\nRegards,\nAccounts Payable`
  );
  const [patchEmail, setPatchEmail] = useState(inv.vendorEmail || "");
  const [patchPhone, setPatchPhone] = useState(inv.vendorPhone || "");
  const [patchAddr, setPatchAddr] = useState(inv.vendorAddress || "");
  const [patching, setPatching] = useState(false);
  const [contactSaved, setContactSaved] = useState(!!(inv.vendorEmail || inv.vendorPhone));
  const [sending, setSending] = useState(false);

  const saveContact = async () => {
    setPatching(true);
    try {
      const res = await fetch(`${PI_API}/${inv.id}/vendor-contact`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorEmail: patchEmail, vendorPhone: patchPhone, vendorAddress: patchAddr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      showToast("Contact info saved");
      setContactSaved(true);
      setTo(patchEmail || patchPhone);
    } catch (e) { showToast(e.message, "err"); }
    finally { setPatching(false); }
  };

  const send = async () => {
    if (!to.trim()) return showToast("Enter a recipient", "err");
    setSending(true);
    try {
      const res = await fetch(`${PI_API}/${inv.id}/notify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, to: to.trim(), subject, message, senderName: "Accounts Payable" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      showToast(data.message || "Notification queued");
      onClose();
    } catch (e) { showToast(e.message, "err"); }
    finally { setSending(false); }
  };

  return (
    <div className="w-full bg-white rounded-3xl p-6 sm:p-8 font-sans max-h-[92vh] overflow-y-auto">
      {/* Title */}
      <div className="mb-6">
        <h3 className="mb-2 font-semibold text-2xl text-slate-800 tracking-tight">Notify Vendor</h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-slate-500 font-medium">{inv.invoiceNo}</span>
          <span className="text-slate-300">â€¢</span>
          <span className="text-sm font-semibold text-slate-900">{inv.vendorName}</span>
          <TypeBadge t={inv.invoiceType} />
          <VendorBadge isRegistered={isReg} />
        </div>
      </div>

      {/* Registered: info banner */}
      {isReg && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-medium"><b>âœ… Registered Vendor</b> â€” notification is recorded in their portal AND sent by email automatically on every status change. You can also send a custom message below.</p>
          {inv.vendorEmail && <div className="mt-1 text-emerald-600 font-medium">Portal email: {inv.vendorEmail}</div>}
          {inv.vendorAcknowledged
            ? <div className="mt-1.5 font-semibold flex items-center gap-1"><CheckCircle2 size={16} /> Already acknowledged by vendor</div>
            : <div className="mt-1.5 font-semibold text-amber-600 flex items-center gap-1"><Clock size={16} /> Awaiting vendor acknowledgement</div>}
        </div>
      )}

      {/* Non-registered: contact editor */}
      {!isReg && (
        <div className="mb-6">
          <div className={`mb-3 flex items-center gap-2 rounded-xl border p-3.5 text-sm font-medium ${contactSaved ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            {contactSaved
              ? <><CheckCircle2 size={18} /> Contact info saved. Fill in the message below and send.</>
              : <><AlertTriangle size={18} /> Walk-in vendor with no registered account. Add contact details so the notification can be delivered.</>}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Vendor Contact Details
            </div>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FField label="Email">
                <input type="email" value={patchEmail} onChange={e => { setPatchEmail(e.target.value); setTo(e.target.value); }} placeholder="vendor@example.com"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
              </FField>
              <FField label="Phone / WhatsApp">
                <input type="tel" value={patchPhone} onChange={e => { setPatchPhone(e.target.value); if (!patchEmail) setTo(e.target.value); }} placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
              </FField>
            </div>
            <FField label="Address (optional)">
              <input value={patchAddr} onChange={e => setPatchAddr(e.target.value)} placeholder="Mailing address"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            </FField>
            <button onClick={saveContact} disabled={patching}
              className="mt-4 flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-50">
              {patching ? <Spinner /> : "ðŸ’¾ Save Contact Info"}
            </button>
          </div>
        </div>
      )}

      {/* Channel selector */}
      <div className="mb-5">
        <div className="mb-2 text-[10px] font-bold text-slate-500">Send via</div>
        <div className="flex flex-wrap gap-2">
          {[
            { v: "email", l: "ðŸ“§ Email", enabled: isReg || !!patchEmail || !!inv.vendorEmail },
            { v: "sms", l: "ðŸ“± SMS", enabled: isReg || !!patchPhone || !!inv.vendorPhone },
            { v: "whatsapp", l: "ðŸ’¬ WhatsApp", enabled: isReg || !!patchPhone || !!inv.vendorPhone },
          ].map(({ v, l, enabled }) => (
            <button key={v} disabled={!enabled} onClick={() => { setChannel(v); setTo(v === "email" ? (patchEmail || inv.vendorEmail || "") : (patchPhone || inv.vendorPhone || "")); }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed border ${channel === v ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* To */}
      <div className="mb-4">
        <FField label={channel === "email" ? "Email Address" : "Phone Number"} req>
          <input value={to} onChange={e => setTo(e.target.value)} type={channel === "email" ? "email" : "tel"}
            placeholder={channel === "email" ? "vendor@example.com" : "+91 98765 43210"}
            readOnly={isReg && channel === "email" && !!inv.vendorEmail}
            className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 ${isReg && channel === "email" && !!inv.vendorEmail ? "bg-slate-50 text-slate-500" : "bg-white"}`} />
        </FField>
      </div>

      {/* Subject (email only) */}
      {channel === "email" && (
        <div className="mb-4">
          <FField label="Subject">
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          </FField>
        </div>
      )}

      {/* Message */}
      <div className="mb-6">
        <FField label="Message">
          <textarea rows={8} value={message} onChange={e => setMessage(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-y" />
        </FField>
        <div className="mt-1 text-xs font-medium text-slate-500">
          {message.length} chars
          {channel === "sms" && message.length > 160 && <span className="text-red-500"> â€” will be split into {Math.ceil(message.length / 160)} SMS parts</span>}
        </div>
      </div>

      {/* Preview strip */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        <span className="text-slate-500">To: </span><b className="mr-4">{to || "â€”"}</b>
        <span className="text-slate-500">Channel: </span><b className="mr-4">{isReg ? `portal + ${channel}` : channel}</b>
        {channel === "email" && <><span className="text-slate-500">Subject: </span><b>{subject}</b></>}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <button onClick={send} disabled={sending || !to.trim()}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">
          {sending ? <Spinner /> : null} {sending ? "Sendingâ€¦" : `Send via ${channel}`}
        </button>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   NOTIFICATION CENTER TAB
   AP-team view: grouped by notification status
   Walk-in vendors with no contact are highlighted for action
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function NotificationCenter({ invoices, showToast, onRefresh }) {
  const [filter, setFilter] = useState("all");
  const [notifTarget, setNotifTarget] = useState(null);

  const groups = useMemo(() => {
    const active = invoices.filter(i => !["Paid", "Cancelled"].includes(i.status));
    return {
      all: invoices,
      noContact: active.filter(i => !i.isRegisteredVendor && !i.vendorEmail && !i.vendorPhone),
      unnotified: active.filter(i => !i.vendorNotified && (i.isRegisteredVendor || i.vendorEmail || i.vendorPhone)),
      registered: invoices.filter(i => i.isRegisteredVendor),
      walkin: invoices.filter(i => !i.isRegisteredVendor),
    };
  }, [invoices]);

  const shown = groups[filter === "nocontact" ? "noContact" : filter] || groups.all;

  return (
    <div className="space-y-6">
      {/* Sub-filter bar */}
      <div className="flex flex-col items-start gap-3">
        <span className="text-base font-medium text-slate-800 tracking-tight">Notification Overview</span>
        <div className="flex flex-wrap gap-2">
          {[
            ["all", `All (${groups.all.length})`],
            ["unnotified", `Unnotified (${groups.unnotified.length})`],
            ["nocontact", `No Contact (${groups.noContact.length})`],
            ["registered", `Registered (${groups.registered.length})`],
            ["walkin", `Walk-in (${groups.walkin.length})`],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all shadow-sm border ${filter === v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-900 border-slate-300 hover:bg-slate-100"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* No-contact banner */}
      {groups.noContact.length > 0 && filter !== "nocontact" && (
        <div onClick={() => setFilter("nocontact")}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 transition hover:bg-red-100">
          <AlertTriangle size={18} className="shrink-0 text-red-600" />
          <span><b>{groups.noContact.length} walk-in invoice(s)</b> have no contact info â†’ click to view and add email/phone.</span>
        </div>
      )}

      {shown.length === 0
        ? <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center text-sm font-medium text-slate-500 shadow-sm">No invoices in this category.</div>
        : (
          <div className="space-y-3">
            {shown.map(inv => {
              const isReg = !!inv.isRegisteredVendor;
              const noContact = !isReg && !inv.vendorEmail && !inv.vendorPhone;
              let accentColor = isReg ? "border-emerald-500" : "border-amber-500";
              if (noContact) accentColor = "border-red-500 bg-red-50";

              return (
                <div key={inv.id} className={`rounded-2xl border-l-4 border-y border-r border-y-slate-200 border-r-slate-200 p-5 shadow-sm transition hover:shadow-md ${accentColor} ${noContact ? "" : "bg-white"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-base font-semibold text-slate-900">{inv.invoiceNo || "â€”"}</span>
                      <TypeBadge t={inv.invoiceType} />
                      <VendorBadge isRegistered={isReg} />
                      <StatusPill s={inv.status} />
                    </div>
                    <div className="flex items-center gap-4">
                      {inv.vendorNotified
                        ? <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 size={15} /> Notified {fmtDate(inv.vendorNotifiedAt?.slice(0, 10))}</span>
                        : <span className="flex items-center gap-1 text-sm font-semibold text-red-600"><X size={15} /> Not Notified</span>}
                      <button onClick={() => setNotifTarget(inv)}
                        className="rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-blue-700 transition hover:-translate-y-[1px]">
                        {noContact ? "Add Contact & Notify" : "Send Notification"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm font-medium text-slate-900">
                    <span>Vendor: <b className="text-slate-900 font-semibold">{inv.vendorName || "â€”"}</b></span>
                    <span>Total: <b className="font-mono text-slate-900 font-semibold">₹{money(inv.invoiceTotal)}</b></span>
                    <span>Due: <b className="text-slate-900 font-semibold">{fmtDate(inv.dueDate)}</b></span>
                    {isReg
                      ? <>
                        {inv.vendorEmail && <span className="font-semibold text-emerald-700">ðŸ“§ {inv.vendorEmail}</span>}
                        <span className="font-semibold text-emerald-700">ðŸ–¥ï¸ Portal active</span>
                        {inv.vendorAcknowledged
                          ? <span className="font-medium text-emerald-700">âœ“ Acknowledged</span>
                          : <span className="font-medium text-orange-700">â³ Awaiting acknowledgement</span>}
                      </>
                      : <>
                        {inv.vendorEmail && <span className="font-semibold text-amber-800">ðŸ“§ {inv.vendorEmail}</span>}
                        {inv.vendorPhone && <span className="font-semibold text-amber-800">ðŸ“± {inv.vendorPhone}</span>}
                        {noContact && <span className="font-medium text-red-650 flex items-center gap-1"><AlertTriangle size={14} /> No email or phone â€” cannot auto-notify</span>}
                      </>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      }

      {notifTarget && (
        <Overlay onClose={() => setNotifTarget(null)}>
          <NotifyVendorModal inv={notifTarget} onClose={() => { setNotifTarget(null); onRefresh(); }} showToast={showToast} />
        </Overlay>
      )}
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   VENDOR PORTAL TAB
   Left panel: registered vendors  |  walk-in vendors (switchable)
   Right panel: invoice list + contact management for walk-ins
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function VendorPortal({ invoices, showToast, onRefresh }) {
  const [portalTab, setPortalTab] = useState("registered");
  const [search, setSearch] = useState("");
  const [selVendor, setSelVendor] = useState(null);
  const [notifTarget, setNotifTarget] = useState(null);

  const vendorMap = useMemo(() => {
    const reg = {}, walk = {};
    invoices.forEach(inv => {
      const k = inv.vendorName || "â€”";
      const map = inv.isRegisteredVendor ? reg : walk;
      if (!map[k]) map[k] = { name: k, invoices: [], balance: 0, email: inv.vendorEmail || "", phone: inv.vendorPhone || "" };
      map[k].invoices.push(inv);
      map[k].balance += n0(inv.balanceDue);
      if (inv.vendorEmail && !map[k].email) map[k].email = inv.vendorEmail;
      if (inv.vendorPhone && !map[k].phone) map[k].phone = inv.vendorPhone;
    });
    return { registered: Object.values(reg), walkin: Object.values(walk) };
  }, [invoices]);

  const list = (portalTab === "registered" ? vendorMap.registered : vendorMap.walkin)
    .filter(v => !search || v.name.toLowerCase().includes(search.toLowerCase()));

  const selInvs = selVendor ? invoices.filter(i => i.vendorName === selVendor.name) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 min-h-[500px]">
      {/* Sidebar */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col h-[600px]">
        <div className="border-b border-slate-200 bg-slate-50 p-4 shrink-0">
          <div className="mb-4 flex gap-2">
            {[["registered", `Registered (${vendorMap.registered.length})`], ["walkin", `Walk-in (${vendorMap.walkin.length})`]].map(([v, l]) => (
              <button key={v} onClick={() => { setPortalTab(v); setSelVendor(null); }}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all shadow-sm border ${portalTab === v ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-slate-900 border-slate-300 hover:bg-slate-100"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-900" size={14} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendorâ€¦"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-indigo-100" />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {list.length === 0
            ? <div className="p-5 text-center text-sm text-slate-900">No vendors found.</div>
            : list.map(v => {
              const noContact = portalTab === "walkin" && !v.email && !v.phone;
              let borderClass = portalTab === "registered" ? "border-emerald-500" : "border-amber-500";
              if (noContact) borderClass = "border-red-500 bg-red-50";

              return (
                <div key={v.name} onClick={() => setSelVendor(selVendor?.name === v.name ? null : v)}
                  className={`cursor-pointer rounded-xl border-l-4 p-3.5 mb-2 transition hover:bg-slate-50 ${selVendor?.name === v.name ? "bg-indigo-50" : "bg-white"} ${borderClass}`}>
                  <div className={`mb-1 text-sm font-semibold ${selVendor?.name === v.name ? "text-indigo-700" : "text-slate-800"}`}>{v.name}</div>
                  <div className="text-xs text-slate-500">{v.invoices.length} inv Â· <span className="font-mono text-slate-650 font-medium">₹{v.balance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span></div>
                  {portalTab === "walkin" && <div className="mt-1 text-xs flex flex-wrap gap-x-2 gap-y-1">
                    {v.email && <span className="text-amber-850 font-semibold truncate">ðŸ“§ {v.email}</span>}
                    {v.phone && <span className="text-amber-850 font-semibold">ðŸ“± {v.phone}</span>}
                    {noContact && <span className="font-medium text-red-650 flex items-center gap-1"><AlertTriangle size={12} /> No contact</span>}
                  </div>}
                  {portalTab === "registered" && <div className="mt-1 text-xs font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> Portal access</div>}
                </div>
              );
            })
          }
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex flex-col h-full">
        {!selVendor ? (
          <div className="flex h-[600px] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            <span className="text-base font-medium">{portalTab === "registered" ? "Select a registered vendor to view their portal" : "Select a walk-in vendor to manage contact & send notifications"}</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col h-[600px]">
            {/* Vendor header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 p-6 shrink-0">
              <div>
                <h2 className="mb-2 text-2xl font-semibold text-slate-900 tracking-tight">{selVendor.name}</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-slate-500">
                  <span>{selInvs.length} invoice(s)</span>
                  <span>Balance: <b className="font-mono text-indigo-700">₹{selVendor.balance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</b></span>
                  {selVendor.email && <span className="text-slate-500">ðŸ“§ {selVendor.email}</span>}
                  {selVendor.phone && <span className="text-slate-500">ðŸ“± {selVendor.phone}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <VendorBadge isRegistered={portalTab === "registered"} />
                {portalTab === "registered" && <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-[11px] font-medium text-emerald-700"><CheckCircle2 size={12} /> Portal Active</span>}
              </div>
            </div>

            {/* Walk-in: bulk contact editor */}
            {portalTab === "walkin" && <WalkInContactManager vendor={selVendor} invoices={selInvs} showToast={showToast} onRefresh={onRefresh} onNotify={setNotifTarget} />}

            {/* Registered: portal info */}
            {portalTab === "registered" && (
              <div className="border-b border-emerald-200 bg-emerald-50 px-6 py-4 text-xs font-medium text-emerald-800 shrink-0">
                âœ… This vendor can log in at <code className="rounded bg-emerald-100 px-1 py-0.5 text-[11px] font-semibold">/vendor-invoices</code> to view all their invoices, payment schedules, match results, and raise queries.
                All status-change events (created, submitted, approved, paid) are automatically pushed to their portal.
              </div>
            )}

            {/* Invoice table */}
            <div className="overflow-auto flex-1">
              <table className="w-full border-collapse text-left text-sm min-w-[1000px]">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    {["Invoice No", "Vendor Inv", "Type", "PO/GRC", "Date", "Due", "Total", "Paid", "Balance", "Status", "Pay", "Notified", "Ack", "Action"].map(h => (
                      <th key={h} className="px-4 py-3.5 text-lg font-semibold text-slate-900 bg-slate-100 border-b border-slate-200 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selInvs.map((inv) => {
                    const isDirect = inv.invoiceType === "direct_grc";
                    const isOverdue = inv.dueDate && inv.dueDate < today() && inv.paymentStatus !== "Paid";
                    return (
                      <tr key={inv.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-4 py-3.5 font-mono text-sm font-medium text-indigo-700">{inv.invoiceNo || "â€”"}</td>
                        <td className="px-4 py-3.5 font-mono text-[10px] font-bold text-slate-500">{inv.vendorInvoiceNo || "â€”"}</td>
                        <td className="px-4 py-3.5"><TypeBadge t={inv.invoiceType} /></td>
                        <td className="px-4 py-3.5 font-mono text-[10px] font-bold text-slate-500">{isDirect ? (inv.directGrcNo || "â€”") : (inv.poNo || "â€”")}</td>
                        <td className="px-4 py-3.5 text-sm font-medium text-slate-500">{fmtDate(inv.invoiceDate)}</td>
                        <td className={`px-4 py-3.5 text-sm ${isOverdue ? "font-semibold text-red-600" : "text-slate-500 font-medium"}`}>{fmtDate(inv.dueDate)}{isOverdue && " âš "}</td>
                        <td className="px-4 py-3.5 font-mono text-sm font-semibold text-slate-900">₹{money(inv.invoiceTotal)}</td>
                        <td className="px-4 py-3.5 font-mono text-sm font-medium text-emerald-700">₹{money(inv.paidAmount)}</td>
                        <td className={`px-4 py-3.5 font-mono text-sm font-semibold ${n0(inv.balanceDue) > 0 ? "text-indigo-700" : "text-slate-500"}`}>₹{money(inv.balanceDue)}</td>
                        <td className="px-4 py-3.5"><StatusPill s={inv.status} /></td>
                        <td className="px-4 py-3.5"><PayStatusPill s={inv.paymentStatus} /></td>
                        <td className="px-4 py-3.5 text-center">
                          {inv.vendorNotified ? <CheckCircle2 size={15} className="text-emerald-600 mx-auto" /> : <X size={15} className="text-slate-400 mx-auto" />}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {inv.vendorAcknowledged ? <CheckCircle2 size={15} className="text-emerald-600 mx-auto" /> : <span className="text-slate-450 font-semibold text-xs">â€”</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <TblBtn color="#2563EB" onClick={() => setNotifTarget(inv)}>Notify</TblBtn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {notifTarget && (
        <Overlay onClose={() => setNotifTarget(null)}>
          <NotifyVendorModal inv={notifTarget} onClose={() => { setNotifTarget(null); onRefresh(); }} showToast={showToast} />
        </Overlay>
      )}
    </div>
  );
}

/* Walk-in bulk contact editor (used inside VendorPortal) */
function WalkInContactManager({ vendor, invoices, showToast, onRefresh, onNotify }) {
  const [email, setEmail] = useState(vendor.email || "");
  const [phone, setPhone] = useState(vendor.phone || "");
  const [saving, setSaving] = useState(false);

  const saveAll = async () => {
    setSaving(true);
    let errors = 0;
    for (const inv of invoices.filter(i => !i.isRegisteredVendor)) {
      try {
        const res = await fetch(`${PI_API}/${inv.id}/vendor-contact`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendorEmail: email, vendorPhone: phone }),
        });
        if (!res.ok) errors++;
      } catch { errors++; }
    }
    setSaving(false);
    errors ? showToast(`Saved with ${errors} error(s)`, "err") : (showToast("Contact info saved for all invoices"), onRefresh());
  };

  return (
    <div className="border-b border-amber-200 bg-amber-50 p-6 shrink-0">
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-amber-800">
        ðŸ“‹ Walk-in Vendor â€” Contact Management
      </div>
      <div className="mb-4 text-sm font-medium text-amber-900">
        Not a registered vendor. Add email/phone here to enable invoice notifications.
        Saving applies to <b className="font-semibold">all {invoices.length} invoice(s)</b> for this vendor.
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <FField label="Email">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vendor@example.com"
              className="w-full rounded-xl border border-amber-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white" />
          </FField>
        </div>
        <div className="flex-1 min-w-[180px]">
          <FField label="Phone / WhatsApp">
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210"
              className="w-full rounded-xl border border-amber-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white" />
          </FField>
        </div>
        <button onClick={saveAll} disabled={saving}
          className="flex items-center gap-2 rounded-2xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-50 whitespace-nowrap h-[42px] hover:-translate-y-[1px] shadow-sm">
          {saving ? <Spinner /> : "ðŸ’¾ Save & Apply"}
        </button>
        {(email || phone) && invoices[0] && (
          <button onClick={() => onNotify(invoices[0])}
            className="flex items-center gap-2 rounded-2xl bg-indigo-750 bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-850 whitespace-nowrap h-[42px] hover:-translate-y-[1px] shadow-sm">
            ðŸ”” Notify Now
          </button>
        )}
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   INVOICE FORM
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function InvoiceForm({ initialInv, onClose, onSave }) {
  const getType = () => !initialInv ? "po_linked" : (initialInv.invoiceType || (initialInv.directGrcNo ? "direct_grc" : "po_linked"));
  const [invoiceType, setInvoiceType] = useState(getType);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState(Array.isArray(initialInv?.items) && initialInv.items.length ? initialInv.items : [EMPTY_ITEM()]);
  const [pos, setPos] = useState([]);
  const [poSearch, setPoSearch] = useState(initialInv?.poNo || "");
  const [poOpen, setPoOpen] = useState(false);
  const [poGrns, setPoGrns] = useState([]);
  const [allPoGrns, setAllPoGrns] = useState([]);
  const [poGrnLoading, setPoGrnLoading] = useState(false);
  const [grcs, setGrcs] = useState([]);
  const [grcSearch, setGrcSearch] = useState(initialInv?.directGrcNo || "");
  const [grcOpen, setGrcOpen] = useState(false);
  const [directGrns, setDirectGrns] = useState([]);
  const [allDirectGrns, setAllDirectGrns] = useState([]);
  const [grcLoading, setGrcLoading] = useState(false);
  const [directGrnLoading, setDirectGrnLoading] = useState(false);

  const [header, setHeader] = useState({
    vendorInvoiceNo: initialInv?.vendorInvoiceNo || "",
    invoiceDate: initialInv?.invoiceDate || today(),
    dueDate: initialInv?.dueDate || "",
    receivedDate: initialInv?.receivedDate || today(),
    poNo: initialInv?.poNo || "",
    grnNos: initialInv?.grnNos || [],
    directGrcNo: initialInv?.directGrcNo || "",
    vendorName: initialInv?.vendorName || "",
    vendorEmail: initialInv?.vendorEmail || "",
    vendorPhone: initialInv?.vendorPhone || "",
    freightCharges: initialInv?.freightCharges || 0,
    otherCharges: initialInv?.otherCharges || 0,
    roundOff: initialInv?.roundOff || 0,
    advanceAdjusted: initialInv?.advanceAdjusted || 0,
    paymentTerms: initialInv?.paymentTerms || "Net30",
    paymentMode: initialInv?.paymentMode || "NEFT",
    bankName: initialInv?.bankName || "",
    accountNo: initialInv?.accountNo || "",
    ifscCode: initialInv?.ifscCode || "",
    chequeNo: initialInv?.chequeNo || "",
    chequeDate: initialInv?.chequeDate || "",
    upiId: initialInv?.upiId || "",
    ddNo: initialInv?.ddNo || "",
    narration: initialInv?.narration || "",
  });
  const setH = (k, v) => setHeader(p => ({ ...p, [k]: v }));

  const needsBank = ["NEFT", "RTGS", "Cheque", "PostDatedCheque", "DD"].includes(header.paymentMode);
  const needsUPI = header.paymentMode === "UPI";
  const needsCheque = ["Cheque", "PostDatedCheque"].includes(header.paymentMode);
  const needsPDC = header.paymentMode === "PostDatedCheque";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(PO_API);
        const d = await res.json();
        // Only POs that have been fully processed through GRCâ†’GRN can be invoiced.
        // VendorSubmitted = buyer hasn't approved yet (rates not locked in)
        // Approved onwards = buyer accepted, GRC/GRN can be created, invoice is valid
        const invoiceable = ["Approved", "PartiallyReceived", "FullyReceived", "StockUpdated", "Paid"];
        setPos(Array.isArray(d) ? d.filter(p => invoiceable.includes(p.status)) : []);
      } catch { }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setGrcLoading(true); const r = await fetch(GRC_API); const d = await r.json();
        setGrcs(Array.isArray(d) ? d.filter(g => g.status === "Approved" && !g.poNo) : []);
      }
      catch { } finally { setGrcLoading(false); }
    })();
  }, []);

  const handlePOSelect = async (poNo) => {
    setH("poNo", poNo); setH("grnNos", []); setPoGrns([]); setAllPoGrns([]); setPoSearch(poNo);
    const po = pos.find(p => p.orderNo === poNo);
    if (po) { setH("vendorName", po.vendorName || ""); }
    if (!poNo) return;
    try {
      setPoGrnLoading(true); const r = await fetch(`${GRN_API}/by-po/${poNo}`); const d = await r.json();
      const all = Array.isArray(d) ? d : []; setAllPoGrns(all); setPoGrns(all.filter(g => g.status === "Posted"));
    }
    catch { } finally { setPoGrnLoading(false); }
  };

  const handleGRCSelect = async (grcNo) => {
    setH("directGrcNo", grcNo); setH("grnNos", []); setDirectGrns([]); setAllDirectGrns([]); setGrcSearch(grcNo);
    const grc = grcs.find(g => g.grcNo === grcNo);
    if (grc) {
      setH("vendorName", grc.vendorName || "");
      if (grc.vendorEmail) setH("vendorEmail", grc.vendorEmail);
      if (grc.vendorPhone) setH("vendorPhone", grc.vendorPhone);
    }
    if (!grcNo) return;
    try {
      setDirectGrnLoading(true); const r = await fetch(`${GRN_API}/by-grc/${encodeURIComponent(grcNo)}`); const d = await r.json();
      const all = Array.isArray(d) ? d : []; setAllDirectGrns(all); setDirectGrns(all.filter(g => g.status === "Posted"));
    }
    catch { } finally { setDirectGrnLoading(false); }
  };

  const handleGRNToggle = (grnNo) => {
    const avail = invoiceType === "direct_grc" ? directGrns : poGrns;
    const newGrnNos = header.grnNos.includes(grnNo) ? header.grnNos.filter(n => n !== grnNo) : [...header.grnNos, grnNo];
    setH("grnNos", newGrnNos);
    const po = invoiceType === "po_linked" ? pos.find(p => p.orderNo === header.poNo) : null;
    const poRates = {}; if (po) po.items?.forEach(it => { poRates[it.barcode] = it.rate; });
    const sel = avail.filter(g => newGrnNos.includes(g.grnNo));
    const merged = {};
    for (const grn of sel) for (const it of grn.items || []) {
      const bc = (it.barcode || "").trim();
      if (!merged[bc]) merged[bc] = { ...EMPTY_ITEM(), barcode: bc, description: it.description || "", rate: it.rate || 0, poRate: poRates[bc] || it.rate || 0 };
      merged[bc].grnQty += clamp0(it.inwardQty); merged[bc].invoicedQty = merged[bc].grnQty;
    }
    setItems(Object.values(merged).length ? Object.values(merged) : [EMPTY_ITEM()]);
  };

  const switchType = (t) => {
    setInvoiceType(t);
    setH("poNo", ""); setH("directGrcNo", ""); setH("grnNos", []); setH("vendorName", ""); setH("vendorEmail", ""); setH("vendorPhone", "");
    setPoSearch(""); setGrcSearch(""); setPoGrns([]); setDirectGrns([]);
    setItems([EMPTY_ITEM()]);
  };

  const updateItem = (idx, k, v) => setItems(p => { const n = [...p]; n[idx] = { ...n[idx], [k]: v }; return n; });

  const totals = useMemo(() => {
    let sub = 0, tax = 0, disc = 0;
    for (const it of items) {
      const qty = clamp0(it.invoicedQty), rate = clamp0(it.rate), dp = clamp0(it.discountPct), tp = clamp0(it.taxPct);
      const g = qty * rate, d = g * dp / 100, t = (g - d) * tp / 100; sub += g; disc += d; tax += t;
    }
    const f = clamp0(header.freightCharges), o = clamp0(header.otherCharges), r = clamp0(header.roundOff), a = clamp0(header.advanceAdjusted);
    return { subtotal: sub, totalDiscount: disc, totalTax: tax, invoiceTotal: sub - disc + tax + f + o + r - a };
  }, [items, header.freightCharges, header.otherCharges, header.roundOff, header.advanceAdjusted]);

  const handleSubmitForm = async () => {
    if (!header.vendorInvoiceNo.trim()) return toast.error("Vendor invoice number is required.", { id: "Vendor invoice number is required." });
    if (invoiceType === "po_linked") { if (!header.poNo) return toast.error("Select a PO.", { id: "Select a PO." }); if (!header.grnNos.length) return toast.error("Select at least one GRN.", { id: "Select at least one GRN." }); }
    else { if (!header.directGrcNo) return toast.error("Select a GRC.", { id: "Select a GRC." }); if (!header.grnNos.length) return toast.error("Select at least one GRN.", { id: "Select at least one GRN." }); }
    if (!items.some(i => clamp0(i.invoicedQty) > 0)) return toast.error("Enter invoiced qty for at least one item.", { id: "Enter invoiced qty for at least one item." });
    const payload = {
      ...(initialInv?.id ? { id: initialInv.id } : {}),
      invoiceType, ...header,
      ...(invoiceType === "direct_grc" ? { poNo: "", po_id: null } : { directGrcNo: "", directGrc_id: null }),
      items: items.map(it => ({ barcode: it.barcode, description: it.description, grnQty: clamp0(it.grnQty), invoicedQty: clamp0(it.invoicedQty), rate: clamp0(it.rate), poRate: clamp0(it.poRate), taxPct: clamp0(it.taxPct), discountPct: clamp0(it.discountPct), taxAmount: 0, discountAmount: 0, lineAmount: 0, varianceFlag: "", remarks: it.remarks || "" })),
    };
    setSaving(true); await onSave(payload); setSaving(false);
  };

  const curGrns = invoiceType === "direct_grc" ? directGrns : poGrns;
  const curAllGrns = invoiceType === "direct_grc" ? allDirectGrns : allPoGrns;
  const curGrnLoad = invoiceType === "direct_grc" ? directGrnLoading : poGrnLoading;
  const srcSelected = invoiceType === "direct_grc" ? !!header.directGrcNo : !!header.poNo;
  const grnCounts = useMemo(() => { const c = {}; curAllGrns.forEach(g => { c[g.status] = (c[g.status] || 0) + 1; }); return c; }, [curAllGrns]);

  const DropDown = ({ open, setOpen, search, setSearch, items: dItems, selectedKey, onSelect, placeholder, renderItem, keyFn, labelFn }) => (
    <div className="relative">
      <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" value={search} onChange={e => { setSearch(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={placeholder} autoComplete="off" />
      {open && (
        <div className="absolute top-full left-0 right-0 z-[200] mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
          {dItems.filter(it => !search || labelFn(it).toLowerCase().includes(search.toLowerCase())).length === 0
            ? <div className="p-3 text-xs text-slate-500">No results found.</div>
            : dItems.filter(it => !search || labelFn(it).toLowerCase().includes(search.toLowerCase())).map(it => (
              <div key={keyFn(it)} onClick={() => { setSearch(labelFn(it)); setOpen(false); onSelect(keyFn(it)); }}
                className={`cursor-pointer border-b border-slate-50 px-3 py-2 text-xs transition-colors hover:bg-slate-50 ${selectedKey === keyFn(it) ? "bg-indigo-50/50" : "bg-white"}`}>
                {renderItem(it)}
              </div>
            ))}
        </div>
      )}
      {open && <div className="fixed inset-0 z-[199]" onClick={() => setOpen(false)} />}
    </div>
  );
  return (
    <div className="flex flex-col flex-1 min-h-0 bg-blue-50/40 font-sans overflow-hidden w-full">
      {/* Header bar */}
      <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{initialInv ? "Edit Invoice" : "New Purchase Invoice"}</h2>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">{invoiceType === "direct_grc" ? "Direct GRC â†’ GRN â†’ Verify â†’ Payment â†’ Save" : "PO â†’ GRN â†’ Verify â†’ Payment â†’ Save"}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-500 text-xl transition-colors">âœ•</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* Type toggle */}
        {!initialInv && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: ".7px", marginBottom: 10 }}>Invoice Type</div>
            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button className={`flex-1 rounded-lg px-4 py-3.5 text-center text-sm font-medium transition-all ${invoiceType === "po_linked" ? "bg-blue-100 text-blue-900 shadow-sm ring-2 ring-blue-500" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`} onClick={() => switchType("po_linked")}>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>PO-Linked Invoice</div>
                <div style={{ fontSize: 12, fontWeight: 500, opacity: .7, marginTop: 4 }}>Purchase Order â†’ GRC â†’ GRN â†’ Invoice</div>
              </button>
              <button className={`flex-1 rounded-lg px-4 py-3.5 text-center text-sm font-medium transition-all ${invoiceType === "direct_grc" ? "bg-blue-100 text-blue-900 shadow-sm ring-2 ring-blue-500" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`} onClick={() => switchType("direct_grc")}>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>Direct GRC Invoice</div>
                <div style={{ fontSize: 12, fontWeight: 500, opacity: .7, marginTop: 4 }}>Walk-in Supplier â†’ Direct GRC â†’ GRN â†’ Invoice</div>
              </button>
            </div>
          </div>
        )}

        {/* Info banner */}
        <div className={`mb-5 p-4 rounded-xl text-sm font-medium border ${invoiceType === "direct_grc" ? "bg-blue-50 text-blue-800 border-blue-200" : "bg-indigo-50 text-indigo-800 border-indigo-200"}`}>
          {invoiceType === "direct_grc"
            ? "Direct GRC Invoice: No PO required. Walk-in vendors may not be registered â€” add email/phone below so they can be notified."
            : "PO-Linked Invoice: Full 3-way match (PO â†” GRN â†” Invoice). Registered vendor receives portal + email notification automatically."}
        </div>

        {/* Invoice Header */}
        <FCard title="Invoice Header">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <FField label="Vendor Invoice No" req><input className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" value={header.vendorInvoiceNo} onChange={e => setH("vendorInvoiceNo", e.target.value)} placeholder="Vendor's invoice number" /></FField>
              <FField label="Invoice Date" req><input className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" type="date" value={header.invoiceDate} onChange={e => setH("invoiceDate", e.target.value)} /></FField>
              <FField label="Received Date"><input className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" type="date" value={header.receivedDate} onChange={e => setH("receivedDate", e.target.value)} /></FField>
              <FField label="Due Date"><input className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" type="date" value={header.dueDate} onChange={e => setH("dueDate", e.target.value)} /></FField>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {/* PO selector */}
              {invoiceType === "po_linked" && (
                <FField label="Purchase Order" req>
                  <DropDown open={poOpen} setOpen={setPoOpen} search={poSearch} setSearch={setPoSearch}
                    items={pos} selectedKey={header.poNo} onSelect={handlePOSelect} placeholder="Search PO numberâ€¦"
                    keyFn={p => p.orderNo} labelFn={p => p.orderNo}
                    renderItem={p => (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: C.accent, fontSize: 13 }}>{p.orderNo}</span>
                        <span style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>{p.vendorName}</span>
                      </div>
                    )} />
                </FField>
              )}
              {/* GRC selector */}
              {invoiceType === "direct_grc" && (
                <FField label="Source GRC (Direct)" req>
                  {grcLoading ? <div style={{ padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.muted, display: "flex", gap: 8, alignItems: "center" }}><Spinner />Loading GRCsâ€¦</div> : (
                    <DropDown open={grcOpen} setOpen={setGrcOpen} search={grcSearch} setSearch={setGrcSearch}
                      items={grcs} selectedKey={header.directGrcNo} onSelect={handleGRCSelect} placeholder="Search GRC numberâ€¦"
                      keyFn={g => g.grcNo} labelFn={g => g.grcNo}
                      renderItem={g => (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: C.directText, fontSize: 13 }}>{g.grcNo}</span>
                          <span style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>{g.vendorName}</span>
                        </div>
                      )} />
                  )}
                </FField>
              )}

              <FField label="Vendor (auto-filled)"><input className="w-full rounded-lg border border-slate-200 border-dashed bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-500 cursor-not-allowed focus:outline-none" readOnly value={header.vendorName} placeholder={invoiceType === "direct_grc" ? "Filled from GRC" : "Filled from PO"} /></FField>

              {/* Contact fields for direct GRC (walk-in) */}
              {invoiceType === "direct_grc" && (
                <div style={{ background: "#FFF7ED", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#92400E", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>Vendor Contact (for notification)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <FField label="Email"><input className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" type="email" value={header.vendorEmail} onChange={e => setH("vendorEmail", e.target.value)} placeholder="vendor@example.com (if not registered)" /></FField>
                    <FField label="Phone / WhatsApp"><input className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" type="tel" value={header.vendorPhone} onChange={e => setH("vendorPhone", e.target.value)} placeholder="+91 98765 43210 (fallback)" /></FField>
                    {!header.vendorEmail && !header.vendorPhone && <div style={{ fontSize: 12, color: "#C2410C", fontWeight: 700 }}>âš  Without contact info, you'll need to notify manually after saving.</div>}
                  </div>
                </div>
              )}

              {/* GRN selector */}
              <FField label="Select Posted GRNs" req>
                {!srcSelected ? <div style={{ padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontWeight: 600, color: C.muted }}>{invoiceType === "direct_grc" ? "Select a GRC first" : "Select a PO first"}</div>
                  : curGrnLoad ? <div style={{ padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.muted, display: "flex", gap: 8, alignItems: "center" }}><Spinner />Loading GRNsâ€¦</div>
                    : curGrns.length === 0 ? (
                      <div style={{
                        padding: "10px 12px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                        color: curAllGrns.length > 0 ? "#C2410C" : "#991B1B",
                        background: curAllGrns.length > 0 ? "#FFF7ED" : "#FEF2F2",
                        border: `1px solid ${curAllGrns.length > 0 ? "#FED7AA" : "#FECACA"}`
                      }}>
                        {curAllGrns.length > 0
                          ? <><b>âš  {curAllGrns.length} GRN(s) not yet Posted</b><div style={{ fontSize: 13, marginTop: 3 }}>Status: {Object.entries(grnCounts).map(([s, c]) => `${s}(${c})`).join(", ")}</div></>
                          : <div><b>No GRNs found.</b> {invoiceType === "direct_grc" ? "Create and Post a GRN for this GRC first." : "Flow: PO Approved â†’ GRC â†’ GRN Posted."}</div>}
                      </div>
                    ) : (
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 7, overflow: "hidden" }}>
                        {curGrns.map(g => (
                          <label key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: header.grnNos.includes(g.grnNo) ? C.accentLight : "#fff", fontSize: 14, fontWeight: 600 }}>
                            <input type="checkbox" checked={header.grnNos.includes(g.grnNo)} onChange={() => handleGRNToggle(g.grnNo)} style={{ accentColor: C.accent }} />
                            <span style={{ fontFamily: "'DM Mono',monospace", color: C.accent, fontWeight: 700 }}>{g.grnNo}</span>
                            <span style={{ color: C.muted }}>Qty: {n0(g.totalInwardQty).toFixed(3)} Â· ₹{money(g.totalAmount)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                {curGrns.length > 0 && curAllGrns.length > curGrns.length && (
                  <div style={{ marginTop: 5, padding: "5px 10px", borderRadius: 5, background: "#FFF7ED", border: "1px solid #FED7AA", fontSize: 13, color: "#92400E", fontWeight: 600 }}>
                    {curAllGrns.length - curGrns.length} GRN(s) not Posted are hidden.
                  </div>
                )}
              </FField>
            </div>
          </div>
        </FCard>

        {/* Payment Details */}
        <FCard title="Payment Details" sub="Payment method, banking details & terms">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <FField label="Payment Terms"><select className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" value={header.paymentTerms} onChange={e => setH("paymentTerms", e.target.value)}>{PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}</select></FField>
              <FField label="Payment Method">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {PAYMENT_MODES.map(m => (
                    <button key={m.value} type="button" onClick={() => setH("paymentMode", m.value)}
                      style={{
                        padding: "10px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                        border: `1.5px solid ${header.paymentMode === m.value ? C.accent : C.border}`,
                        background: header.paymentMode === m.value ? C.accentLight : "#fff",
                        color: header.paymentMode === m.value ? C.accent : C.muted,
                        fontFamily: "'DM Sans',sans-serif", fontWeight: 700, textAlign: "center"
                      }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{m.label}</div>
                    </button>
                  ))}
                </div>
              </FField>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {needsBank && <><FField label="Bank Name"><input className="inp text-slate-900 font-medium text-sm" value={header.bankName} onChange={e => setH("bankName", e.target.value)} placeholder="e.g. HDFC Bank" style={{ padding: "8px 12px" }} /></FField><FField label="Account No"><input className="inp text-slate-900 font-medium text-sm" value={header.accountNo} onChange={e => setH("accountNo", e.target.value)} style={{ fontFamily: "'DM Mono',monospace", padding: "8px 12px" }} /></FField><FField label="IFSC Code"><input className="inp text-slate-900 font-medium text-sm" value={header.ifscCode} onChange={e => setH("ifscCode", e.target.value.toUpperCase())} style={{ fontFamily: "'DM Mono',monospace", padding: "8px 12px" }} /></FField></>}
              {needsCheque && <FField label="Cheque No"><input className="inp text-slate-900 font-medium text-sm" value={header.chequeNo} onChange={e => setH("chequeNo", e.target.value)} style={{ fontFamily: "'DM Mono',monospace", padding: "8px 12px" }} /></FField>}
              {needsPDC && <FField label="PDC Date"><input className="inp text-slate-900 font-medium text-sm" type="date" value={header.chequeDate} onChange={e => setH("chequeDate", e.target.value)} style={{ padding: "8px 12px" }} /></FField>}
              {needsUPI && <FField label="UPI ID"><input className="inp text-slate-900 font-medium text-sm" value={header.upiId} onChange={e => setH("upiId", e.target.value)} placeholder="vendor@upi" style={{ padding: "8px 12px" }} /></FField>}
              {header.paymentMode === "DD" && <FField label="DD No"><input className="inp text-slate-900 font-medium text-sm" value={header.ddNo} onChange={e => setH("ddNo", e.target.value)} style={{ fontFamily: "'DM Mono',monospace", padding: "8px 12px" }} /></FField>}
              {header.paymentMode === "Advance" && <FField label="Advance Adjusted (₹)"><input className="inp text-slate-900 font-medium text-sm" type="number" value={header.advanceAdjusted} onChange={e => setH("advanceAdjusted", e.target.value)} style={{ fontFamily: "'DM Mono',monospace", padding: "8px 12px" }} /></FField>}
              <FField label="Narration"><textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 font-medium focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" rows={3} value={header.narration} onChange={e => setH("narration", e.target.value)} placeholder="Internal notesâ€¦" style={{ resize: "vertical" }} /></FField>
            </div>
          </div>
        </FCard>

        {/* Line Items */}
        <FCard title="Line Items"
          sub={invoiceType === "direct_grc" ? "GRN Qty vs Invoiced Qty (no PO rate comparison)" : "GRN Qty vs Invoiced Qty Â· Rate vs PO Rate â€” variances flagged"}
          right={<button className="btn" onClick={() => setItems(p => [...p, EMPTY_ITEM()])} style={{ padding: "8px 16px", background: C.accentLight, color: C.accent, border: `1px solid ${C.accentBorder}`, fontSize: 13, fontWeight: 700 }}>+ Row</button>}>
          <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 7 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead style={{ background: "#F0EDE6" }}>
                <tr>{["#", "Barcode", "Description", "GRN Qty", "Inv Qty", "Rate ₹", invoiceType === "po_linked" ? "PO Rate" : "GRN Rate", "Tax %", "Disc %", "Remarks", ""].map(h => (
                  <th key={h} style={{ padding: "12px 14px", fontSize: 13.5, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: ".5px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const qtyOver = clamp0(it.invoicedQty) > clamp0(it.grnQty) + 0.001 && clamp0(it.grnQty) > 0;
                  const rateVar = invoiceType === "po_linked" && clamp0(it.poRate) > 0 && Math.abs(clamp0(it.rate) - clamp0(it.poRate)) > 0.01;
                  return (
                    <tr key={idx} style={{ borderBottom: `1px solid ${C.border}`, background: (qtyOver || rateVar) ? "#FFFBEB" : idx % 2 === 0 ? "#fff" : "#FDFCF9" }}>
                      <td style={{ padding: "10px 8px", fontSize: 14, color: C.text, fontWeight: 600 }}>{idx + 1}</td>
                      <td style={{ padding: "10px 8px" }}><input className="cell text-sm font-medium text-slate-900" value={it.barcode} onChange={e => updateItem(idx, "barcode", e.target.value)} style={{ width: 100, padding: "6px 8px" }} /></td>
                      <td style={{ padding: "10px 8px" }}><input className="cell text-sm font-medium text-slate-900" value={it.description} onChange={e => updateItem(idx, "description", e.target.value)} style={{ width: 150, fontFamily: "'DM Sans',sans-serif", padding: "6px 8px" }} /></td>
                      <td style={{ padding: "10px 8px", fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: "#0369A1" }}>{n0(it.grnQty).toFixed(3)}</td>
                      <td style={{ padding: "10px 8px" }}><input className="cell text-sm font-medium text-slate-900" type="number" min="0" value={it.invoicedQty} onChange={e => updateItem(idx, "invoicedQty", e.target.value)} style={{ width: 80, textAlign: "right", borderColor: qtyOver ? "#B91C1C" : undefined, padding: "6px 8px" }} /></td>
                      <td style={{ padding: "10px 8px" }}><input className="cell text-sm font-medium text-slate-900" type="number" min="0" value={it.rate} onChange={e => updateItem(idx, "rate", e.target.value)} style={{ width: 90, textAlign: "right", borderColor: rateVar ? "#EA580C" : undefined, padding: "6px 8px" }} /></td>
                      <td style={{ padding: "10px 8px", fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: C.text }}>{invoiceType === "po_linked" ? n0(it.poRate).toFixed(2) : n0(it.rate).toFixed(2)}</td>
                      <td style={{ padding: "10px 8px" }}><input className="cell text-sm font-medium text-slate-900" type="number" min="0" max="100" value={it.taxPct} onChange={e => updateItem(idx, "taxPct", e.target.value)} style={{ width: 60, textAlign: "right", padding: "6px 8px" }} /></td>
                      <td style={{ padding: "10px 8px" }}><input className="cell text-sm font-medium text-slate-900" type="number" min="0" max="100" value={it.discountPct} onChange={e => updateItem(idx, "discountPct", e.target.value)} style={{ width: 60, textAlign: "right", padding: "6px 8px" }} /></td>
                      <td style={{ padding: "10px 8px" }}><input className="cell text-sm font-medium text-slate-900" value={it.remarks || ""} onChange={e => updateItem(idx, "remarks", e.target.value)} style={{ width: 100, fontFamily: "'DM Sans',sans-serif", padding: "6px 8px" }} /></td>
                      <td style={{ padding: "10px 8px" }}>
                        {(qtyOver || rateVar) && <span style={{ fontSize: 11, background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A", borderRadius: 4, padding: "2px 6px", fontWeight: 700, marginRight: 4 }}>Warning</span>}
                        <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} disabled={items.length === 1}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#B91C1C", fontSize: 18, opacity: items.length === 1 ? 0.2 : 1 }}>âœ•</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FCard>

        {/* Charges + Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <FCard title="Additional Charges">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[["Freight Charges", "freightCharges"], ["Other Charges", "otherCharges"], ["Round Off", "roundOff"], ["Advance Adjusted", "advanceAdjusted"]].map(([label, key]) => (
                <div key={key} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, color: C.muted, fontWeight: 650 }}>{label}</span>
                  <input className="inp text-sm font-medium text-slate-900" type="number" value={header[key]} onChange={e => setH(key, e.target.value)} style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", padding: "8px 12px" }} />
                </div>
              ))}
            </div>
          </FCard>
          <FCard title="Preview Totals" sub="Backend recomputes on save">
            {[["Subtotal", totals.subtotal, C.text], ["â€“ Discount", -totals.totalDiscount, C.green], ["+ Tax", totals.totalTax, C.blue], ["+ Freight", clamp0(header.freightCharges), C.muted], ["+ Other", clamp0(header.otherCharges), C.muted], ["Round Off", clamp0(header.roundOff), C.muted], ["â€“ Advance", -clamp0(header.advanceAdjusted), "#7C3AED"]].map(([label, val, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600 }}>
                <span style={{ color: C.muted }}>{label}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", color }}>{val < 0 ? "-" : ""}₹{money(Math.abs(val))}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", fontSize: 20, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>
              <span>Invoice Total</span>
              <span style={{ fontFamily: "'DM Mono',monospace", color: C.accent, fontWeight: 700 }}>₹{money(totals.invoiceTotal)}</span>
            </div>
          </FCard>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "18px 24px", background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <TypeBadge t={invoiceType} />
          {invoiceType === "direct_grc" && !header.vendorEmail && !header.vendorPhone && (
            <span style={{ fontSize: 13, color: "#92400E", fontFamily: "'DM Sans',sans-serif", fontWeight: 700 }}>No contact info â€” notification will be manual after save</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <button className="btn" onClick={handleSubmitForm} disabled={saving}
            style={{ padding: "12px 28px", background: saving ? "#D4CEBF" : C.accent, color: "#fff", fontSize: 14, fontWeight: 700, borderRadius: 8, boxShadow: saving ? "none" : "0 4px 14px rgba(139,69,19,.3)" }}>
            {saving ? "Savingâ€¦" : initialInv ? "Update Invoice" : "Save & Notify Vendor"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PAYMENT FORM
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function PaymentForm({ inv, onClose, showToast }) {
  const [form, setForm] = useState({ amount: n0(inv.balanceDue).toFixed(2), paymentDate: today(), paymentMode: inv.paymentMode || "NEFT", referenceNo: "", bankName: inv.bankName || "", accountNo: inv.accountNo || "", ifscCode: inv.ifscCode || "", chequeNo: "", chequeDate: "", upiId: inv.upiId || "", ddNo: "", remarks: "", isAdvance: false, scheduleId: "" });
  const [saving, setSaving] = useState(false);
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const needsBank = ["NEFT", "RTGS", "Cheque", "PostDatedCheque", "DD"].includes(form.paymentMode);
  const needsCheque = ["Cheque", "PostDatedCheque"].includes(form.paymentMode);
  const needsPDC = form.paymentMode === "PostDatedCheque";
  const needsUPI = form.paymentMode === "UPI";
  const schedule = inv.paymentSchedule || [];

  const pay = async () => {
    const amt = clamp0(form.amount); if (amt <= 0) return showToast("Enter a valid amount", "err");
    setSaving(true);
    try {
      const res = await fetch(`${PI_API}/${inv.id}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: amt }) });
      const d = await res.json(); if (!res.ok) throw new Error(d.detail); showToast(d.message || "Payment recorded"); onClose();
    }
    catch (e) { showToast(e.message, "err"); } finally { setSaving(false); }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: "min(540px,94vw)", fontFamily: "'DM Sans',sans-serif", maxHeight: "90vh", overflowY: "auto" }}>
      <h3 style={{ margin: "0 0 4px", fontFamily: "'Crimson Pro',serif", fontSize: 20, fontWeight: 300 }}>Record Payment</h3>
      <p style={{ margin: "0 0 4px", fontSize: 12, color: C.muted }}>{inv.invoiceNo} â€” {inv.vendorName}</p>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12 }}>Total: <b style={{ fontFamily: "'DM Mono',monospace", color: C.accent }}>₹{money(inv.invoiceTotal)}</b></span>
        <span style={{ fontSize: 12 }}>Paid: <b style={{ fontFamily: "'DM Mono',monospace", color: C.green }}>₹{money(inv.paidAmount)}</b></span>
        <span style={{ fontSize: 12 }}>Balance: <b style={{ fontFamily: "'DM Mono',monospace", color: C.red }}>₹{money(inv.balanceDue)}</b></span>
        <VendorBadge isRegistered={inv.isRegisteredVendor} />
      </div>
      {schedule.length > 0 && (
        <div style={{ marginBottom: 16, padding: 12, background: "#F6F4EF", borderRadius: 8, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 8 }}>Payment Schedule</div>
          {schedule.map((s, i) => (
            <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12, cursor: "pointer", borderBottom: i < schedule.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <input type="radio" name="scheduleId" value={s.scheduleId || i} checked={form.scheduleId === (s.scheduleId || String(i))} onChange={() => { setF("scheduleId", s.scheduleId || String(i)); setF("amount", n0(s.amount).toFixed(2)); }} style={{ accentColor: C.accent }} />
              <span style={{ fontFamily: "'DM Mono',monospace" }}>₹{money(s.amount)}</span>
              <span style={{ color: C.muted }}>{fmtDate(s.dueDate)}</span>
              <span style={{ padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: s.status === "Paid" ? "#F0FDF4" : "#FFF7ED", color: s.status === "Paid" ? "#166534" : "#C2410C" }}>{s.status}</span>
            </label>
          ))}
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Payment Method</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
          {PAYMENT_MODES.map(m => (
            <button key={m.value} type="button" onClick={() => setF("paymentMode", m.value)}
              style={{ padding: "7px 4px", borderRadius: 7, fontSize: 10, cursor: "pointer", border: `1.5px solid ${form.paymentMode === m.value ? C.accent : C.border}`, background: form.paymentMode === m.value ? C.accentLight : "#fff", color: form.paymentMode === m.value ? C.accent : C.muted, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, textAlign: "center" }}>
              <div style={{ fontSize: 13, marginBottom: 1 }}>{m.icon}</div><div>{m.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 5 }}>Amount (₹) *</div><input className="inp" type="number" value={form.amount} onChange={e => setF("amount", e.target.value)} style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 600 }} /></div>
          <div><div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 5 }}>Payment Date *</div><input className="inp" type="date" value={form.paymentDate} onChange={e => setF("paymentDate", e.target.value)} /></div>
        </div>
        {needsBank && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>{[["Bank", "bankName"], ["Account No", "accountNo"], ["IFSC", "ifscCode"]].map(([l, k]) => (<div key={k}><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5 }}>{l}</div><input className="inp" value={form[k]} onChange={e => setF(k, e.target.value)} style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }} /></div>))}</div>}
        {needsCheque && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5 }}>Cheque No</div><input className="inp" value={form.chequeNo} onChange={e => setF("chequeNo", e.target.value)} style={{ fontFamily: "'DM Mono',monospace" }} /></div>{needsPDC && <div><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5 }}>PDC Date</div><input className="inp" type="date" value={form.chequeDate} onChange={e => setF("chequeDate", e.target.value)} /></div>}</div>}
        {needsUPI && <div><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5 }}>UPI ID</div><input className="inp" value={form.upiId} onChange={e => setF("upiId", e.target.value)} placeholder="vendor@upi" /></div>}
        {form.paymentMode === "DD" && <div><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5 }}>DD Number</div><input className="inp" value={form.ddNo} onChange={e => setF("ddNo", e.target.value)} style={{ fontFamily: "'DM Mono',monospace" }} /></div>}
        {!["Net30", "Net45", "Net60", "Advance"].includes(form.paymentMode) && <div><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5 }}>Reference / Transaction No</div><input className="inp" value={form.referenceNo} onChange={e => setF("referenceNo", e.target.value)} placeholder="UTR / Txn ID" style={{ fontFamily: "'DM Mono',monospace" }} /></div>}
        <div><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5 }}>Remarks</div><input className="inp" value={form.remarks} onChange={e => setF("remarks", e.target.value)} placeholder="Optional notes" /></div>
        {needsPDC && <div style={{ padding: "10px 13px", borderRadius: 7, background: "#FFF7ED", border: "1px solid #FED7AA", fontSize: 12, color: "#C2410C" }}>ðŸ“… <b>Post-Dated Cheque:</b> Payment registered now. Mark cleared when cheque actually clears.</div>}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <button className="btn" onClick={pay} disabled={saving} style={{ padding: "10px 22px", background: "#15803D", color: "#fff", fontSize: 13 }}>{saving ? "Recordingâ€¦" : `Record ₹${money(form.amount)}`}</button>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   INVOICE VIEW MODAL â€” with Notify tab
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function InvoiceViewModal({ inv: initialInv, onClose, showToast, onRefresh }) {
  const [inv, setInv] = useState(initialInv);
  const [tab, setTab] = useState("details");
  const [queryText, setQueryText] = useState({ subject: "", description: "", queryType: "General" });
  const [replyText, setReplyText] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showNotify, setShowNotify] = useState(false);

  const match = inv.threeWayMatch || {};
  const queries = inv.vendorQueries || [];
  const payments = inv.payments || [];
  const schedule = inv.paymentSchedule || [];
  const isDirect = inv.invoiceType === "direct_grc";

  const refresh = async () => { try { const r = await fetch(`${PI_API}/${inv.id}`); const d = await r.json(); setInv(d); onRefresh(); } catch { } };

  const raiseQuery = async () => {
    if (!queryText.subject.trim()) return showToast("Subject required", "err");
    setSubmitting(true);
    try {
      const r = await fetch(`${PI_API}/${inv.id}/vendor-query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(queryText) });
      const d = await r.json(); if (!r.ok) throw new Error(d.detail); showToast("Query raised"); setQueryText({ subject: "", description: "", queryType: "General" }); refresh();
    }
    catch (e) { showToast(e.message, "err"); } finally { setSubmitting(false); }
  };
  const sendReply = async (qid) => {
    const reply = replyText[qid]?.trim(); if (!reply) return showToast("Enter a reply", "err");
    try {
      const r = await fetch(`${PI_API}/${inv.id}/vendor-query/${qid}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reply }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.detail); showToast("Reply sent"); setReplyText(p => ({ ...p, [qid]: "" })); refresh();
    }
    catch (e) { showToast(e.message, "err"); }
  };
  const resolveQuery = async (qid) => { try { await fetch(`${PI_API}/${inv.id}/vendor-query/${qid}/resolve`, { method: "POST" }); showToast("Query resolved"); refresh(); } catch (e) { showToast(e.message, "err"); } };

  const TABS = [
    { id: "details", label: "ðŸ“‹ Details" },
    { id: "items", label: "ðŸ“¦ Line Items" },
    { id: "payment", label: "ðŸ’³ Payments" },
    { id: "queries", label: `â“ Queries${queries.filter(q => q.status === "Open").length > 0 ? ` (${queries.filter(q => q.status === "Open").length})` : ""}` },
    { id: "notify", label: "ðŸ”” Notify" },
    { id: "timeline", label: "ðŸ“œ Timeline" },
  ];

  return (
    <div className="flex flex-col h-[85vh] bg-white font-sans overflow-hidden rounded-2xl w-full">
      {/* Modal header */}
      <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex justify-between items-start shrink-0">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 300, fontFamily: "'Crimson Pro',serif", color: C.accent }}>{inv.invoiceNo}</h2>
            <TypeBadge t={inv.invoiceType} /><VendorBadge isRegistered={inv.isRegisteredVendor} />
            <StatusPill s={inv.status} /><PayStatusPill s={inv.paymentStatus} /><MatchBadge match={inv.threeWayMatch} />
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: C.muted }}>
            Vendor Inv: {inv.vendorInvoiceNo}
            {isDirect ? ` Â· GRC: ${inv.directGrcNo || "â€”"}` : ` Â· PO: ${inv.poNo}`}
            {" Â· GRNs: "}{(inv.grnNos || []).join(", ") || "â€”"}
            {inv.vendorEmail && <span> Â· ðŸ“§ {inv.vendorEmail}</span>}
            {!inv.isRegisteredVendor && inv.vendorPhone && <span> Â· ðŸ“± {inv.vendorPhone}</span>}
          </p>
        </div>
        <button className="btn" onClick={onClose} style={{ padding: "7px 14px", background: C.card, color: C.muted, border: `1px solid ${C.border}`, fontSize: 12 }}>Close</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, background: C.card, padding: "0 24px", overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)}
            style={{
              borderRadius: 0, borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
              color: tab === t.id ? C.accent : C.muted, fontWeight: tab === t.id ? 600 : 400, padding: "10px 16px"
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

        {/* â”€â”€ DETAILS â”€â”€ */}
        {tab === "details" && (
          <>
            {/* Match banner */}
            <div style={{ background: match.matched ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${match.matched ? "#BBF7D0" : "#FECACA"}`, borderRadius: 10, padding: "14px 18px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  {isDirect
                    ? [["GRN Match", match.grn_match], ["Rate Consistent", match.rate_match]].map(([l, ok]) => (<span key={l} style={{ fontSize: 12, fontWeight: 700, color: ok ? "#166534" : "#991B1B" }}>{ok ? "âœ“" : "âœ—"} {l}</span>))
                    : [["PO Match", match.po_match], ["GRN Match", match.grn_match], ["Rate Match", match.rate_match]].map(([l, ok]) => (<span key={l} style={{ fontSize: 12, fontWeight: 700, color: ok ? "#166534" : "#991B1B" }}>{ok ? "âœ“" : "âœ—"} {l}</span>))}
                </div>
                {match.variance_amount > 0 && <span style={{ fontSize: 12, color: C.muted }}>Variance: ₹{money(match.variance_amount)}</span>}
              </div>
              {match.notes && <div style={{ fontSize: 12, marginTop: 6, color: match.matched ? "#166534" : "#991B1B" }}>{match.notes}</div>}
              {isDirect && <div style={{ fontSize: 11, marginTop: 4, color: C.muted }}>Direct GRC â€” PO match not applicable.</div>}
            </div>

            {/* Detail grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
              {[["Status", "STATUS"], ["Pay Status", "PAYMENT"], ["Vendor Type", "VTYPE"], ["Invoice Type", "ITYPE"],
              ["Vendor", inv.vendorName], ["Invoice Date", fmtDate(inv.invoiceDate)], ["Due Date", fmtDate(inv.dueDate)],
              isDirect ? ["Source GRC", inv.directGrcNo || "â€”"] : ["Source PO", inv.poNo || "â€”"],
              ["Payment Mode", inv.paymentMode], ["Invoice Total", `₹${money(inv.invoiceTotal)}`], ["Paid", `₹${money(inv.paidAmount)}`], ["Balance Due", `₹${money(inv.balanceDue)}`],
              ].map(([k, v]) => (
                <div key={k} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>{k}</div>
                  {v === "STATUS" ? <StatusPill s={inv.status} /> : v === "PAYMENT" ? <PayStatusPill s={inv.paymentStatus} /> : v === "VTYPE" ? <VendorBadge isRegistered={inv.isRegisteredVendor} /> : v === "ITYPE" ? <TypeBadge t={inv.invoiceType} /> : <div style={{ fontSize: 12, fontWeight: 600 }}>{v || "â€”"}</div>}
                </div>
              ))}
            </div>

            {/* Vendor notification panel */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 10 }}>Vendor Notification Status</div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12, alignItems: "center" }}>
                <div><span style={{ color: C.muted }}>Notified: </span><b style={{ color: inv.vendorNotified ? C.green : C.red }}>{inv.vendorNotified ? "âœ“ Yes" : "âœ— No"}</b>{inv.vendorNotified && <span style={{ color: C.muted, marginLeft: 6 }}>{fmtDate(inv.vendorNotifiedAt?.slice(0, 10))}</span>}</div>
                <div><span style={{ color: C.muted }}>Acknowledged: </span><b style={{ color: inv.vendorAcknowledged ? C.green : C.muted }}>{inv.vendorAcknowledged ? "âœ“ Yes" : "â€”"}</b></div>
                {inv.isRegisteredVendor ? <div style={{ color: C.green, fontWeight: 700 }}>ðŸ–¥ï¸ Portal notifications active</div> : <>
                  {inv.vendorEmail && <div>ðŸ“§ {inv.vendorEmail}</div>}
                  {inv.vendorPhone && <div>ðŸ“± {inv.vendorPhone}</div>}
                  {!inv.vendorEmail && !inv.vendorPhone && <div style={{ color: C.red, fontWeight: 700 }}>âš  No contact info â€” go to Notify tab</div>}
                </>}
                <button className="btn" onClick={() => setTab("notify")}
                  style={{ padding: "6px 14px", fontSize: 11, background: "#2563EB", color: "#fff", marginLeft: "auto" }}>
                  ðŸ”” Send Notification
                </button>
              </div>
            </div>

            {/* Financial breakdown */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 10 }}>Financial Breakdown</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, fontSize: 12 }}>
                {[["Subtotal", inv.subtotal], ["Discount", inv.totalDiscount], ["Tax", inv.totalTax], ["Freight", inv.freightCharges], ["Other", inv.otherCharges], ["Round Off", inv.roundOff]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", paddingRight: 12 }}>
                    <span style={{ color: C.muted }}>{k}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace" }}>₹{money(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* â”€â”€ LINE ITEMS â”€â”€ */}
        {tab === "items" && Array.isArray(inv.items) && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead><tr style={{ background: "#F0EDE6", borderBottom: `1px solid ${C.border}` }}>
                  {["#", "Barcode", "Description", "GRN Qty", "Inv Qty", "Rate", "Ref Rate", "Tax", "Disc", "Line Amt", "Flag"].map(h => (
                    <th key={h} style={{ padding: "9px 12px", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", textAlign: "left" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {inv.items.map((it, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: it.varianceFlag ? "#FFFBEB" : i % 2 === 0 ? "#fff" : C.surface }}>
                      <td style={{ padding: "9px 12px", fontSize: 11, color: C.muted }}>{i + 1}</td>
                      <td style={{ padding: "9px 12px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: C.accent }}>{it.barcode || "â€”"}</td>
                      <td style={{ padding: "9px 12px", fontSize: 12 }}>{it.description || "â€”"}</td>
                      <td style={{ padding: "9px 12px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: C.blue }}>{n0(it.grnQty).toFixed(3)}</td>
                      <td style={{ padding: "9px 12px", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{n0(it.invoicedQty).toFixed(3)}</td>
                      <td style={{ padding: "9px 12px", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>₹{money(it.rate)}</td>
                      <td style={{ padding: "9px 12px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: C.muted }}>₹{money(it.poRate)}</td>
                      <td style={{ padding: "9px 12px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: C.blue }}>₹{money(it.taxAmount)}</td>
                      <td style={{ padding: "9px 12px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: C.green }}>₹{money(it.discountAmount)}</td>
                      <td style={{ padding: "9px 12px", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600, color: C.accent }}>₹{money(it.lineAmount)}</td>
                      <td style={{ padding: "9px 12px" }}>{it.varianceFlag && <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A", borderRadius: 4, padding: "2px 6px", fontWeight: 700 }}>âš  {it.varianceFlag}</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ background: "#F0EDE6", borderTop: `2px solid ${C.border}` }}>
                  <td colSpan={9} style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, fontFamily: "'Crimson Pro',serif" }}>Invoice Total</td>
                  <td style={{ padding: "10px 12px", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600, color: C.accent }}>₹{money(inv.invoiceTotal)}</td>
                  <td />
                </tr></tfoot>
              </table>
            </div>
          </div>
        )}

        {/* â”€â”€ PAYMENTS â”€â”€ */}
        {tab === "payment" && (
          <>
            {schedule.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
                <div style={{ padding: "10px 16px", background: "#F0EDE6", borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".6px" }}>Payment Schedule</div>
                {schedule.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: i < schedule.length - 1 ? `1px solid ${C.border}` : "none", fontSize: 12 }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>₹{money(s.amount)}</span>
                      <span style={{ color: C.muted }}>{fmtDate(s.dueDate)}</span>
                      <span style={{ color: C.muted, fontSize: 11 }}>{s.paymentMode}</span>
                    </div>
                    <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: s.status === "Paid" ? "#F0FDF4" : "#FFF7ED", color: s.status === "Paid" ? "#166534" : "#C2410C", border: `1px solid ${s.status === "Paid" ? "#BBF7D0" : "#FED7AA"}` }}>{s.status}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", background: "#F0EDE6", borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".6px" }}>Payment History</div>
              {payments.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>No payments recorded yet.</div>
                : payments.map((p, i) => (
                  <div key={i} style={{ padding: "12px 16px", borderBottom: i < payments.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: C.green, fontSize: 14 }}>₹{money(p.amount)}</span>
                        <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 10, background: "#EFF6FF", color: "#1E40AF", fontWeight: 700 }}>{p.paymentMode}</span>
                        <span style={{ color: C.muted, fontSize: 12 }}>{fmtDate(p.paymentDate)}</span>
                        {p.referenceNo && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: C.muted }}>#{p.referenceNo}</span>}
                      </div>
                      <span style={{ fontSize: 10, color: C.muted }}>{p.recordedAt?.slice(0, 10)}</span>
                    </div>
                    {p.remarks && <div style={{ marginTop: 3, fontSize: 11, color: C.muted }}>{p.remarks}</div>}
                  </div>
                ))}
            </div>
          </>
        )}

        {/* â”€â”€ QUERIES â”€â”€ */}
        {tab === "queries" && (
          <>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 12 }}>Raise Query / Dispute</div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5 }}>Subject *</div><input className="inp" value={queryText.subject} onChange={e => setQueryText(p => ({ ...p, subject: e.target.value }))} placeholder="Brief subject" /></div>
                <div><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5 }}>Type</div><select className="inp" value={queryText.queryType} onChange={e => setQueryText(p => ({ ...p, queryType: e.target.value }))}>{["General", "RateDispute", "QtyDispute", "TaxDispute", "PaymentDispute", "Other"].map(t => <option key={t}>{t}</option>)}</select></div>
              </div>
              <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5 }}>Description</div><textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" rows={3} value={queryText.description} onChange={e => setQueryText(p => ({ ...p, description: e.target.value }))} placeholder="Describe the issueâ€¦" style={{ resize: "vertical" }} /></div>
              <button className="btn" onClick={raiseQuery} disabled={submitting} style={{ padding: "9px 18px", background: C.accent, color: "#fff", fontSize: 12 }}>{submitting ? "Raisingâ€¦" : "Raise Query"}</button>
            </div>
            {queries.length === 0 ? <div style={{ textAlign: "center", padding: 32, color: C.muted, fontSize: 13 }}>No queries yet.</div>
              : queries.map((q, i) => (
                <div key={i} style={{ background: C.card, border: `1px solid ${q.status === "Open" ? "#BFDBFE" : C.border}`, borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", background: q.status === "Open" ? "#EFF6FF" : "#F0EDE6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: q.status === "Open" ? C.blue : C.text }}>{q.subject}</span>
                      <span style={{ marginLeft: 10, fontSize: 10, padding: "2px 7px", borderRadius: 8, fontWeight: 700, background: q.status === "Open" ? "#BFDBFE" : q.status === "Resolved" ? "#BBF7D0" : "#E9D5FF", color: q.status === "Open" ? "#1E40AF" : q.status === "Resolved" ? "#166534" : "#5B21B6" }}>{q.status}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: C.muted }}>{q.raisedAt?.slice(0, 10)}</span>
                      {q.status !== "Resolved" && <button className="btn" onClick={() => resolveQuery(q.queryId)} style={{ padding: "4px 10px", fontSize: 11, background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0" }}>âœ“ Resolve</button>}
                    </div>
                  </div>
                  {q.description && <div style={{ padding: "10px 16px", fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}` }}>{q.description}</div>}
                  {(q.replies || []).map((r, j) => (
                    <div key={j} style={{ padding: "8px 16px 8px 32px", background: j % 2 === 0 ? "#FDFCF9" : "#fff", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: C.blue, fontSize: 11 }}>{r.by || "AP Team"}</span>
                        <span style={{ color: C.muted, fontSize: 10 }}>{r.repliedAt?.slice(0, 10)}</span>
                      </div>
                      <div>{r.text}</div>
                    </div>
                  ))}
                  {q.status !== "Resolved" && (
                    <div style={{ padding: "10px 16px", display: "flex", gap: 8 }}>
                      <input className="inp" value={replyText[q.queryId] || ""} onChange={e => setReplyText(p => ({ ...p, [q.queryId]: e.target.value }))} placeholder="Type replyâ€¦" style={{ flex: 1 }} onKeyDown={e => { if (e.key === "Enter") sendReply(q.queryId); }} />
                      <button className="btn" onClick={() => sendReply(q.queryId)} style={{ padding: "9px 14px", background: C.accent, color: "#fff", fontSize: 12 }}>Send</button>
                    </div>
                  )}
                </div>
              ))}
          </>
        )}

        {/* â”€â”€ NOTIFY TAB (inline) â”€â”€ */}
        {tab === "notify" && (
          <NotifyVendorModal inv={inv} onClose={() => setTab("details")} showToast={showToast} inlineMode />
        )}

        {/* â”€â”€ TIMELINE â”€â”€ */}
        {tab === "timeline" && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 16 }}>Notification &amp; Event Log</div>
            {(inv.notificationLog || []).length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>No events logged yet.</div>
              : [...(inv.notificationLog || [])].reverse().map((n, i) => (
                <div key={i} style={{ display: "flex", gap: 12, paddingBottom: 14, borderBottom: i < (inv.notificationLog || []).length - 1 ? `1px solid ${C.border}` : "none", marginBottom: 14 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.accentLight, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                    {n.event === "invoice_created" ? "ðŸ“‹" : n.event === "invoice_submitted" ? "ðŸ“¤" : n.event === "payment_recorded" ? "ðŸ’³" : n.event === "invoice_approved" ? "âœ…" : n.event === "manual_notification" ? "ðŸ“¢" : "ðŸ“§"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 2, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{n.event?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                      <span style={{
                        fontSize: 10, padding: "1px 7px", borderRadius: 8, fontWeight: 700,
                        background: n.isRegistered ? "#F0FDF4" : "#FFF7ED",
                        color: n.isRegistered ? "#166534" : "#92400E",
                        border: `1px solid ${n.isRegistered ? "#BBF7D0" : "#FDE68A"}`
                      }}>
                        {n.channel || "â€”"}
                      </span>
                      <span style={{
                        fontSize: 10, padding: "1px 7px", borderRadius: 8, fontWeight: 700,
                        background: n.status === "delivered" ? "#F0FDF4" : n.status === "queued" ? "#FFF7ED" : "#FEF2F2",
                        color: n.status === "delivered" ? "#166534" : n.status === "queued" ? "#C2410C" : "#991B1B"
                      }}>
                        {n.status || "â€”"}
                      </span>
                    </div>
                    {n.message && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{n.message}</div>}
                    {n.deliveryDetail && <div style={{ fontSize: 11, color: C.muted, marginTop: 3, fontStyle: "italic" }}>{n.deliveryDetail}</div>}
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                      {n.sentAt?.slice(0, 19).replace("T", " ")} Â· To: {n.to || "â€”"}
                      {n.isManual && <span style={{ marginLeft: 6, background: "#EFF6FF", color: "#1E40AF", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>Manual</span>}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   AP AGING REPORT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function AgingReport({ showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const r = await fetch(`${PI_API}/reports/aging`); setData(await r.json()); }
      catch (e) { showToast(e.message, "err"); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="p-12 text-center text-sm font-medium text-slate-500">Loading aging reportâ€¦</div>;
  if (!data) return null;

  const buckets = [
    { key: "current", label: "Not Yet Due", colorClass: "text-emerald-600", bgClass: "bg-emerald-50", borderClass: "border-emerald-200" },
    { key: "0-30", label: "0â€“30 Days", colorClass: "text-amber-600", bgClass: "bg-amber-50", borderClass: "border-amber-200" },
    { key: "31-60", label: "31â€“60 Days", colorClass: "text-orange-600", bgClass: "bg-orange-50", borderClass: "border-orange-200" },
    { key: "61-90", label: "61â€“90 Days", colorClass: "text-red-600", bgClass: "bg-red-50", borderClass: "border-red-200" },
    { key: "90+", label: "90+ Days", colorClass: "text-rose-800", bgClass: "bg-rose-50", borderClass: "border-rose-200" },
  ];
  const grandTotal = Object.values(data.totals || {}).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        {buckets.map(b => (
          <div key={b.key} className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${b.borderClass}`}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">{b.label}</div>
            <div className={`font-mono text-xl font-semibold ${b.colorClass}`}>â‚¹{money(data.totals?.[b.key] || 0)}</div>
            <div className="mt-1 text-sm font-medium text-slate-500">{(data.buckets?.[b.key] || []).length} invoice(s)</div>
          </div>
        ))}
      </div>
      <div className="text-base font-semibold text-slate-500 mb-4">
        Grand Total Outstanding: <b className="font-mono text-indigo-700">â‚¹{money(grandTotal)}</b>
      </div>
      <div className="space-y-4">
        {buckets.map(b => {
          const entries = data.buckets?.[b.key] || [];
          if (!entries.length) return null;
          return (
            <div key={b.key} className={`overflow-hidden rounded-2xl border bg-white shadow-sm mb-3 ${b.borderClass}`}>
              <div className={`flex items-center justify-between border-b px-5 py-4 ${b.bgClass} ${b.borderClass}`}>
                <span className={`text-base font-medium ${b.colorClass}`}>{b.label}</span>
                <span className={`font-mono text-base font-semibold ${b.colorClass}`}>â‚¹{money(data.totals?.[b.key] || 0)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm min-w-[800px]">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      {["Invoice No", "Vendor", "Type", "Vendor Type", "Total", "Balance", "Due Date", "Days Overdue", "Pay Mode"].map(h => (
                        <th key={h} className="px-4 py-3.5 text-lg font-semibold text-slate-900 bg-slate-100 border-b border-slate-200 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entries.map((e, i) => (
                      <tr key={i} className="transition-colors hover:bg-slate-50">
                        <td className="px-4 py-3.5 font-mono text-sm font-medium text-indigo-700">{e.invoiceNo || "â€”"}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">{e.vendor || "â€”"}</td>
                        <td className="px-4 py-3.5"><TypeBadge t={e.invoiceType} /></td>
                        <td className="px-4 py-3.5"><VendorBadge isRegistered={e.isRegisteredVendor} /></td>
                        <td className="px-4 py-3.5 font-mono text-sm text-slate-650 text-slate-600">â‚¹{money(e.invoiceTotal)}</td>
                        <td className={`px-4 py-3.5 font-mono text-sm font-semibold ${b.colorClass}`}>â‚¹{money(e.balanceDue)}</td>
                        <td className="px-4 py-3.5 text-sm font-medium text-slate-500">{fmtDate(e.dueDate)}</td>
                        <td className={`px-4 py-3.5 font-mono text-sm font-semibold ${e.daysOverdue > 60 ? "text-red-600" : "text-slate-500"}`}>{e.daysOverdue}d</td>
                        <td className="px-4 py-3.5 text-sm font-medium text-slate-500">{e.paymentMode || "â€”"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}





