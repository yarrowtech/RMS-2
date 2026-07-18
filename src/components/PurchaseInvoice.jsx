import { API_BASE_URL as APP_API_URL } from "../config/api.js";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";

/* ═══════════════════════════════════════════════════════════════════
   API CONSTANTS
═══════════════════════════════════════════════════════════════════ */
const API_BASE = APP_API_URL;
const PI_API  = `${API_BASE}/purchase-invoices`;
const PO_API  = `${API_BASE}/purchaseorders`;
const GRN_API = `${API_BASE}/grn`;
const GRC_API = `${API_BASE}/grc`;

function getAuthToken(vendorMode = false) {
  if (vendorMode) return localStorage.getItem("vendor_token") || "";
  return localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

async function authFetch(url, options = {}, vendorMode = false) {
  const token = getAuthToken(vendorMode);
  return window.fetch(url, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════ */
const n0      = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const clamp0  = (v) => Math.max(0, n0(v));
const money   = (v) => clamp0(v).toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 });
const today   = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }); }
  catch { return d; }
};

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════════ */
const PAYMENT_MODES = [
  { value:"NEFT",            label:"NEFT",         icon:"🏦" },
  { value:"RTGS",            label:"RTGS",         icon:"⚡" },
  { value:"UPI",             label:"UPI",          icon:"📱" },
  { value:"Cheque",          label:"Cheque",       icon:"📄" },
  { value:"PostDatedCheque", label:"PDC",          icon:"📅" },
  { value:"Cash",            label:"Cash",         icon:"💵" },
  { value:"DD",              label:"DD",           icon:"🏛️" },
  { value:"Net30",           label:"Net 30",       icon:"📆" },
  { value:"Net45",           label:"Net 45",       icon:"📆" },
  { value:"Net60",           label:"Net 60",       icon:"📆" },
  { value:"Advance",         label:"Advance",      icon:"⬆️" },
  { value:"CreditNote",      label:"Credit Note",  icon:"🔄" },
  { value:"Other",           label:"Other",        icon:"❓" },
];
const PAYMENT_TERMS = ["Net15","Net30","Net45","Net60","Net90","Immediate","Advance","Custom"];
const EMPTY_ITEM = () => ({
  barcode:"", description:"", grnQty:0, invoicedQty:"", rate:"", poRate:0,
  taxPct:"", discountPct:"", taxAmount:0, discountAmount:0, lineAmount:0, varianceFlag:"", remarks:"",
});

/* ═══════════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════════ */
const C = {
  bg:"#F8F7FF", card:"#FFFFFF", border:"#E8E5F5", text:"#172033", muted:"#667085",
  accent:"#6D28D9", accentLight:"#F3E8FF", accentBorder:"#D8B4FE",
  green:"#047857", red:"#B42318", blue:"#1D4ED8", surface:"#FBFAFF",
  directBg:"#EFF6FF", directBorder:"#BFDBFE", directText:"#1E40AF",
  poBg:"#F5F3FF", poBorder:"#DDD6FE", poText:"#5B21B6",
};

const STATUS_META = {
  Draft:         { bg:"#FEF9EE", text:"#92400E", border:"#FDE68A", dot:"#F59E0B" },
  Submitted:     { bg:"#EFF6FF", text:"#1E40AF", border:"#BFDBFE", dot:"#3B82F6" },
  UnderReview:   { bg:"#F5F3FF", text:"#5B21B6", border:"#DDD6FE", dot:"#8B5CF6" },
  OnHold:        { bg:"#FFF7ED", text:"#C2410C", border:"#FED7AA", dot:"#F97316" },
  Approved:      { bg:"#F0FDF4", text:"#166534", border:"#BBF7D0", dot:"#22C55E" },
  PartiallyPaid: { bg:"#ECFEFF", text:"#155E75", border:"#A5F3FC", dot:"#06B6D4" },
  Paid:          { bg:"#F0FDF4", text:"#14532D", border:"#86EFAC", dot:"#16A34A" },
  Cancelled:     { bg:"#FEF2F2", text:"#991B1B", border:"#FECACA", dot:"#EF4444" },
};
const PAY_META = {
  Unpaid:  { bg:"#FEF2F2", text:"#991B1B", border:"#FECACA" },
  Partial: { bg:"#FFF7ED", text:"#C2410C", border:"#FED7AA" },
  Paid:    { bg:"#F0FDF4", text:"#14532D", border:"#86EFAC" },
};

/* ═══════════════════════════════════════════════════════════════════
   SMALL SHARED COMPONENTS
═══════════════════════════════════════════════════════════════════ */
function StatusPill({ s }) {
  const m = STATUS_META[s] || STATUS_META.Draft;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px",
      borderRadius:20, fontSize:11, fontWeight:700, background:m.bg, color:m.text, border:`1px solid ${m.border}` }}>
      <span style={{ width:5,height:5,borderRadius:"50%",background:m.dot }} />{s||"—"}
    </span>
  );
}
function PayStatusPill({ s }) {
  const m = PAY_META[s] || PAY_META.Unpaid;
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",
      borderRadius:12,fontSize:10,fontWeight:700,background:m.bg,color:m.text,border:`1px solid ${m.border}` }}>
      {s||"—"}
    </span>
  );
}
function MatchBadge({ match }) {
  if (!match) return null;
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",
      borderRadius:20,fontSize:11,fontWeight:700,
      background:match.matched?"#F0FDF4":"#FEF2F2",
      color:match.matched?"#166534":"#991B1B",
      border:`1px solid ${match.matched?"#BBF7D0":"#FECACA"}` }}>
      {match.matched?"✓ Match OK":"⚠ Match Failed"}
    </span>
  );
}
function TypeBadge({ t }) {
  const d = t==="direct_grc";
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",
      borderRadius:10,fontSize:10,fontWeight:700,
      background:d?C.directBg:C.poBg,color:d?C.directText:C.poText,
      border:`1px solid ${d?C.directBorder:C.poBorder}` }}>
      {d?"🔗 Direct GRC":"📋 PO-Linked"}
    </span>
  );
}
function VendorBadge({ isRegistered }) {
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",
      borderRadius:10,fontSize:10,fontWeight:700,
      background:isRegistered?"#F0FDF4":"#FFF7ED",
      color:isRegistered?"#166534":"#92400E",
      border:`1px solid ${isRegistered?"#BBF7D0":"#FDE68A"}` }}>
      {isRegistered?"✅ Registered":"🔔 Walk-in"}
    </span>
  );
}
function Overlay({ onClose, children, wide }) {
  return createPortal(
    <div className="purchase-invoice-modal" onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{ position:"fixed",inset:0,zIndex:99999,background:"rgba(15,23,42,.62)",padding:12,
        display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}>
      <div style={{ width:wide?"min(1300px,97vw)":"auto",maxWidth:"100%",maxHeight:"calc(100dvh - 24px)",
        borderRadius:16,overflow:"auto",boxShadow:"0 40px 100px rgba(15,23,42,.28)",border:`1px solid ${C.border}` }}>
        {children}
      </div>
    </div>, document.body
  );
}
function MiniModal({ title, onClose, children }) {
  return createPortal(
    <div className="purchase-invoice-modal" onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{ position:"fixed",inset:0,zIndex:100000,background:"rgba(15,23,42,.62)",padding:12,
        display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}>
      <div style={{ background:"#fff",border:`1px solid ${C.border}`,borderRadius:16,padding:24,
        width:"min(440px,100%)",maxHeight:"calc(100dvh - 24px)",overflowY:"auto",boxShadow:"0 28px 70px rgba(15,23,42,.24)" }}>
        <h3 style={{ margin:"0 0 14px",fontSize:17,fontWeight:800,fontFamily:"'DM Sans',sans-serif",color:C.text }}>{title}</h3>
        {children}
      </div>
    </div>, document.body
  );
}
function FCard({ title, sub, right, children }) {
  return (
    <div style={{ background:"#fff",border:`1px solid ${C.border}`,borderRadius:10,marginBottom:14,overflow:"hidden" }}>
      <div style={{ padding:"11px 16px",borderBottom:`1px solid ${C.border}`,background:"#F0EDE6",
        display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div>
          <div style={{ fontSize:12,fontWeight:700,color:C.text,fontFamily:"'DM Sans',sans-serif" }}>{title}</div>
          {sub&&<div style={{ fontSize:10,color:C.muted,marginTop:1 }}>{sub}</div>}
        </div>{right}
      </div>
      <div style={{ padding:16 }}>{children}</div>
    </div>
  );
}
function FField({ label, req, children }) {
  return (
    <div>
      <div style={{ fontSize:11,fontWeight:600,color:C.muted,marginBottom:5,fontFamily:"'DM Sans',sans-serif" }}>
        {label}{req&&<span style={{ color:C.red,marginLeft:2 }}>*</span>}
      </div>{children}
    </div>
  );
}
function TblBtn({ children, onClick, color, disabled }) {
  return (
    <button className="btn" onClick={onClick} disabled={disabled}
      style={{ padding:"4px 9px",fontSize:10,background:`${color}18`,color,border:`1px solid ${color}35`,
        fontFamily:"'DM Sans',sans-serif",opacity:disabled?0.4:1 }}>
      {children}
    </button>
  );
}
function GhostBtn({ children, onClick }) {
  return (
    <button className="btn" onClick={onClick}
      style={{ padding:"9px 18px",background:C.surface,color:C.muted,border:`1px solid ${C.border}`,
        fontSize:13,fontFamily:"'DM Sans',sans-serif" }}>
      {children}
    </button>
  );
}
function Spinner() {
  return <div style={{ width:14,height:14,border:`2px solid #E5E1D8`,borderTopColor:C.accent,
    borderRadius:"50%",animation:"piSpin 1s linear infinite",display:"inline-block" }} />;
}

/* ═══════════════════════════════════════════════════════════════════
   GLOBAL CSS
═══════════════════════════════════════════════════════════════════ */
const GLOBAL_CSS = `
  .purchase-invoice-page,.purchase-invoice-page *,.purchase-invoice-modal,.purchase-invoice-modal *{box-sizing:border-box}
  .purchase-invoice-page{width:100%;min-width:0;max-width:100%}
  .purchase-invoice-page h1,.purchase-invoice-page h2,.purchase-invoice-page h3,.purchase-invoice-page p{margin:0}
  @keyframes piFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @keyframes piSpin{to{transform:rotate(360deg)}}
  .purchase-invoice-page .row-hover:hover{background:#F5F3FF!important;cursor:pointer}
  .purchase-invoice-page .btn,.purchase-invoice-modal .btn{cursor:pointer;border:none;font-family:'DM Sans',sans-serif;font-weight:600;border-radius:9px;transition:all .15s}
  .purchase-invoice-page .btn:active,.purchase-invoice-modal .btn:active{transform:scale(.97)}
  .purchase-invoice-page .btn:disabled,.purchase-invoice-modal .btn:disabled{opacity:.4;cursor:not-allowed}
  .purchase-invoice-page input,.purchase-invoice-page select,.purchase-invoice-page textarea,.purchase-invoice-modal input,.purchase-invoice-modal select,.purchase-invoice-modal textarea{font-family:'DM Sans',sans-serif;transition:border-color .15s,box-shadow .15s}
  .purchase-invoice-page input:focus,.purchase-invoice-page select:focus,.purchase-invoice-page textarea:focus,.purchase-invoice-modal input:focus,.purchase-invoice-modal select:focus,.purchase-invoice-modal textarea:focus{outline:none!important;border-color:#7C3AED!important;box-shadow:0 0 0 3px rgba(124,58,237,.12)!important}
  .purchase-invoice-page ::-webkit-scrollbar,.purchase-invoice-modal ::-webkit-scrollbar{width:5px;height:5px}
  .purchase-invoice-page ::-webkit-scrollbar-track,.purchase-invoice-modal ::-webkit-scrollbar-track{background:#F6F4EF}
  .purchase-invoice-page ::-webkit-scrollbar-thumb,.purchase-invoice-modal ::-webkit-scrollbar-thumb{background:#D4CEBF;border-radius:10px}
  .purchase-invoice-page .inp,.purchase-invoice-modal .inp{background:#fff;border:1px solid #DDD6FE;color:#172033;border-radius:9px;padding:9px 13px;font-size:13px;width:100%;font-family:'DM Sans',sans-serif}
  .purchase-invoice-page .inp::placeholder,.purchase-invoice-modal .inp::placeholder{color:#98A2B3}
  .purchase-invoice-page .inp-ro,.purchase-invoice-modal .inp-ro{background:#FDFBF8;color:#6B6560;border-style:dashed;cursor:default}
  .purchase-invoice-page .cell,.purchase-invoice-modal .cell{background:#fff;border:1.5px solid #E5E1D8;color:#1A1714;border-radius:5px;padding:0 8px;font-size:12px;height:32px;width:100%;font-family:'DM Mono',monospace}
  .purchase-invoice-page .cell:focus,.purchase-invoice-modal .cell:focus{border-color:#8B4513!important}
  .purchase-invoice-page .tab-btn{cursor:pointer;border:none;background:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;padding:10px 18px;border-radius:8px;transition:all .15s}
  .purchase-invoice-page .type-toggle,.purchase-invoice-modal .type-toggle{display:flex;border:1.5px solid #E5E1D8;border-radius:10px;overflow:hidden}
  .purchase-invoice-page .type-btn,.purchase-invoice-modal .type-btn{flex:1;padding:14px 16px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;font-size:13px;transition:all .2s;text-align:center}
  .purchase-invoice-page .type-btn-po,.purchase-invoice-modal .type-btn-po{background:#F5F3FF;color:#5B21B6;border-right:1.5px solid #DDD6FE}
  .purchase-invoice-page .type-btn-direct,.purchase-invoice-modal .type-btn-direct{background:#EFF6FF;color:#1E40AF}
  .purchase-invoice-page .type-btn-off,.purchase-invoice-modal .type-btn-off{background:#FDFBF8;color:#B0A898}
  .purchase-invoice-page .type-btn-off:hover,.purchase-invoice-modal .type-btn-off:hover{background:#F0EDE6;color:#6B6560}
  .purchase-invoice-page .notif-row{border-radius:10px;padding:14px 16px;margin-bottom:8px;border:1px solid #E5E1D8;background:#fff;transition:box-shadow .15s}
  .purchase-invoice-page .notif-row:hover{box-shadow:0 4px 16px rgba(0,0,0,.07)}
  .purchase-invoice-page .pi-shell{width:100%;min-width:0;max-width:100%;margin:0 auto;padding:16px}
  .purchase-invoice-page .pi-header{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;margin-bottom:14px;background:#fff;border:1px solid #E8E5F5;border-radius:16px;box-shadow:0 8px 24px rgba(76,29,149,.06)}
  .purchase-invoice-page .pi-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:14px}
  .purchase-invoice-page .pi-tabs{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px;background:#fff;border:1px solid #E8E5F5;border-radius:12px;padding:5px;width:100%}
  .purchase-invoice-page .pi-filters{display:grid;grid-template-columns:minmax(240px,1fr) repeat(3,minmax(145px,180px));gap:8px;margin-bottom:12px;padding:12px;background:#fff;border:1px solid #E8E5F5;border-radius:12px}
  .purchase-invoice-page .pi-table-wrap{width:100%;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain}
  @media(max-width:1200px){.purchase-invoice-page .pi-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.purchase-invoice-page .pi-filters{grid-template-columns:1fr 1fr}}
  @media(max-width:700px){.purchase-invoice-page .pi-shell{padding:10px}.purchase-invoice-page .pi-header{align-items:flex-start;flex-direction:column}.purchase-invoice-page .pi-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.purchase-invoice-page .pi-filters{grid-template-columns:1fr}.purchase-invoice-page .pi-header .btn{width:100%}}
`;

/* ═══════════════════════════════════════════════════════════════════
   ROOT COMPONENT
═══════════════════════════════════════════════════════════════════ */
export default function PurchaseInvoiceManager({ vendorMode = false }) {
  return vendorMode ? <VendorPurchaseInvoiceView /> : <AdminPurchaseInvoiceManager />;
}

function AdminPurchaseInvoiceManager() {
  const [invoices,        setInvoices]        = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [toast,           setToast]           = useState(null);
  const [modal,           setModal]           = useState(null);
  const [active,          setActive]          = useState(null);
  const [reasonInput,     setReasonInput]     = useState("");
  const [search,          setSearch]          = useState("");
  const [filterStatus,    setFilterStatus]    = useState("All");
  const [filterType,      setFilterType]      = useState("All");
  const [filterVendType,  setFilterVendType]  = useState("All");
  const [activeTab,       setActiveTab]       = useState("invoices");

  const showToast = (msg, type="ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await authFetch(PI_API);
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : []);
    } catch (e) { showToast(e.message, "err"); }
    finally     { setLoading(false); }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const apiCall = async (url, method="POST", body=null) => {
    const opts = { method, headers:{"Content-Type":"application/json"} };
    if (body !== null) opts.body = JSON.stringify(body);
    const res  = await authFetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Action failed");
    return data;
  };

  const handleSave    = async (payload) => {
    const isEdit = !!payload.id;
    try {
      await apiCall(isEdit ? `${PI_API}/${payload.id}` : PI_API, isEdit?"PUT":"POST", payload);
      showToast(isEdit ? "Invoice updated" : "Invoice created & vendor notified");
      setModal(null); setActive(null); fetchInvoices();
    } catch (e) { showToast(e.message, "err"); }
  };
  const handleSubmit  = async (inv) => { try { const d=await apiCall(`${PI_API}/${inv.id}/submit`); showToast(d.message); fetchInvoices(); } catch(e){showToast(e.message,"err");} };
  const handleApprove = async (inv) => { try { const d=await apiCall(`${PI_API}/${inv.id}/approve`); showToast(d.message); fetchInvoices(); } catch(e){showToast(e.message,"err");} };
  const handleHold    = async () => {
    if (!reasonInput.trim()) return showToast("Enter a hold reason","err");
    try { const d=await apiCall(`${PI_API}/${active.id}/hold`,"POST",{reason:reasonInput}); showToast(d.message); closeModal(); fetchInvoices(); } catch(e){showToast(e.message,"err");}
  };
  const handleCancel  = async () => {
    if (!reasonInput.trim()) return showToast("Enter a cancellation reason","err");
    try { const d=await apiCall(`${PI_API}/${active.id}/cancel`,"POST",{reason:reasonInput}); showToast(d.message); closeModal(); fetchInvoices(); } catch(e){showToast(e.message,"err");}
  };
  const handleDelete  = async () => {
    try { await apiCall(`${PI_API}/${active.id}`,"DELETE"); showToast("Invoice deleted"); closeModal(); fetchInvoices(); } catch(e){showToast(e.message,"err");}
  };
  const closeModal = () => { setModal(null); setActive(null); setReasonInput(""); };

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter(inv => {
      const ms  = filterStatus   === "All" || inv.status      === filterStatus;
      const mt  = filterType     === "All" || inv.invoiceType === filterType;
      const mvt = filterVendType === "All"
        || (filterVendType==="registered" &&  inv.isRegisteredVendor)
        || (filterVendType==="walkin"     && !inv.isRegisteredVendor);
      const mq  = !q || [inv.invoiceNo,inv.vendorInvoiceNo,inv.poNo,inv.directGrcNo,inv.vendorName]
        .some(f=>(f||"").toLowerCase().includes(q));
      return ms && mt && mvt && mq;
    });
  }, [invoices, search, filterStatus, filterType, filterVendType]);

  const kpis = useMemo(() => ({
    total:      invoices.length,
    poLinked:   invoices.filter(i=>i.invoiceType!=="direct_grc").length,
    direct:     invoices.filter(i=>i.invoiceType==="direct_grc").length,
    registered: invoices.filter(i=>i.isRegisteredVendor).length,
    walkin:     invoices.filter(i=>!i.isRegisteredVendor).length,
    noContact:  invoices.filter(i=>!i.isRegisteredVendor&&!i.vendorEmail&&!i.vendorPhone&&!["Paid","Cancelled"].includes(i.status)).length,
    onHold:     invoices.filter(i=>i.status==="OnHold").length,
    overdue:    invoices.filter(i=>i.dueDate&&i.dueDate<today()&&i.paymentStatus!=="Paid").length,
    totalDue:   invoices.reduce((s,i)=>s+n0(i.balanceDue),0),
  }), [invoices]);

  const TABS = [
    {id:"invoices", label:"Invoices"},
    {id:"notifications", label:"Notifications"},
    {id:"aging", label:"AP Aging"},
    {id:"vendor", label:"Vendor Portal"},
  ];

  return (
    <div className="purchase-invoice-page" style={{ width:"100%",minWidth:0,maxWidth:"100%",minHeight:"100%",background:C.bg,fontFamily:"'DM Sans',sans-serif",color:C.text,overflow:"hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{GLOBAL_CSS}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed",top:20,right:20,zIndex:9999,padding:"12px 20px",
          borderRadius:8,fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",
          animation:"piFadeUp .2s ease",
          background:toast.type==="err"?"#FEF2F2":"#F0FDF4",
          color:toast.type==="err"?"#991B1B":"#166534",
          border:`1px solid ${toast.type==="err"?"#FECACA":"#BBF7D0"}`,
          boxShadow:"0 8px 24px rgba(0,0,0,.12)" }}>
          {toast.type==="err"?"✗ ":"✓ "}{toast.msg}
        </div>
      )}

      <div className="pi-shell">

        {/* Header */}
        <div className="pi-header">
          <div>
            <h1 style={{ fontSize:23,fontWeight:800,letterSpacing:"-.45px",color:C.text,lineHeight:1.15 }}>Purchase Invoices</h1>
            <p style={{ fontSize:12,color:C.muted,marginTop:4,fontFamily:"'DM Sans',sans-serif" }}>
              PO-Linked &amp; Direct GRC · Three-Way Match · Registered &amp; Walk-in Vendor Notifications
            </p>
          </div>
          <button className="btn" onClick={()=>{setActive(null);setModal("form");}}
            style={{ padding:"11px 22px",background:C.accent,color:"#fff",fontSize:13,
              fontFamily:"'DM Sans',sans-serif",boxShadow:"0 6px 16px rgba(109,40,217,.22)" }}>
            + New Invoice
          </button>
        </div>

        {/* KPIs */}
        <div className="pi-kpis">
          {[
            {label:"Total invoices", val:kpis.total, color:C.text, code:"ALL"},
            {label:"PO-linked", val:kpis.poLinked, color:C.poText, code:"PO"},
            {label:"Direct GRC", val:kpis.direct, color:C.directText, code:"GRC"},
            {label:"On hold", val:kpis.onHold, color:"#C2410C", code:"HOLD"},
            {label:"Overdue", val:kpis.overdue, color:C.red, code:"DUE"},
            {label:"Balance due", val:`?${money(kpis.totalDue)}`, color:C.accent, code:"PAY"},
          ].map(({label,val,color,code})=>(
            <div key={label} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 15px",boxShadow:"0 4px 14px rgba(23,32,51,.04)" }}>
              <div style={{ display:"inline-flex",padding:"3px 7px",borderRadius:7,background:C.accentLight,color:C.accent,fontSize:9,fontWeight:800,letterSpacing:".5px",marginBottom:8 }}>{code}</div>
              <div style={{ fontSize:9,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:".6px",fontFamily:"'DM Sans',sans-serif",marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:17,color,fontFamily:"'DM Mono',monospace",fontWeight:700 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* No-contact alert */}
        {kpis.noContact > 0 && (
          <div style={{ marginBottom:12,padding:"10px 16px",borderRadius:8,fontSize:12,
            background:"#FEF2F2",border:"1px solid #FECACA",color:"#991B1B",fontFamily:"'DM Sans',sans-serif",
            display:"flex",alignItems:"center",gap:10 }}>
            ⚠️ <span><b>{kpis.noContact} walk-in invoice(s)</b> have no contact info — open the 🔔 Notifications tab to add email/phone and send manually.</span>
          </div>
        )}

        {/* Tabs */}
        <div className="pi-tabs">
          {TABS.map(t=>(
            <button key={t.id} className="tab-btn" onClick={()=>setActiveTab(t.id)}
              style={{ background:activeTab===t.id?C.accentLight:"transparent",
                color:activeTab===t.id?C.accent:C.muted,
                border:activeTab===t.id?`1px solid ${C.accentBorder}`:"1px solid transparent",
                fontWeight:activeTab===t.id?600:400 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ TAB: INVOICES ══ */}
        {activeTab==="invoices" && (
          <>
            {/* Filters */}
            <div className="pi-filters">
              <div style={{ position:"relative",flex:1,minWidth:220 }}>
                <svg style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)" }}
                  width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0A898" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input className="inp" value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Search invoice no, PO, GRC, vendor…" style={{ paddingLeft:30 }} />
              </div>
              {/* Invoice type */}
              {[["All","All"],["po_linked","PO-Linked"],["direct_grc","Direct GRC"]].map(([v,l])=>(
                <button key={v} className="btn" onClick={()=>setFilterType(v)}
                  style={{ padding:"7px 10px",fontSize:11,fontFamily:"'DM Sans',sans-serif",
                    background:filterType===v?(v==="direct_grc"?C.directBg:v==="po_linked"?C.poBg:C.accentLight):C.card,
                    color:filterType===v?(v==="direct_grc"?C.directText:v==="po_linked"?C.poText:C.accent):C.muted,
                    border:`1px solid ${filterType===v?(v==="direct_grc"?C.directBorder:v==="po_linked"?C.poBorder:C.accentBorder):C.border}` }}>
                  {l}
                </button>
              ))}
              {/* Vendor type */}
              {[["All","All Vendors"],["registered","Registered ✅"],["walkin","Walk-in 🔔"]].map(([v,l])=>(
                <button key={v} className="btn" onClick={()=>setFilterVendType(v)}
                  style={{ padding:"7px 10px",fontSize:11,fontFamily:"'DM Sans',sans-serif",
                    background:filterVendType===v?C.accentLight:C.card,
                    color:filterVendType===v?C.accent:C.muted,
                    border:`1px solid ${filterVendType===v?C.accentBorder:C.border}` }}>
                  {l}
                </button>
              ))}
              {/* Status */}
              <select className="inp" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} aria-label="Invoice status">
                {["All","Draft","Submitted","UnderReview","OnHold","Approved","PartiallyPaid","Paid","Cancelled"].map(s=><option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
              </select>
            </div>

            {/* Table */}
            <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",boxShadow:"0 1px 8px rgba(0,0,0,.05)" }}>
              <div className="pi-table-wrap">
                <table style={{ width:"100%",borderCollapse:"collapse",minWidth:1180 }}>
                  <thead style={{ background:"#F8FAFC",borderBottom:`1px solid ${C.border}` }}>
                    <tr>
                      {["Invoice No","Vendor Inv","Type","Vendor","PO/GRC","Date","Due","Status","Pay","Match","Total","Balance","Notified","Actions"].map(h=>(
                        <th key={h} style={{ padding:"10px 12px",fontSize:10,fontWeight:700,color:C.muted,
                          textTransform:"uppercase",letterSpacing:".6px",textAlign:"left",
                          fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={14} style={{ padding:56,textAlign:"center",color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:13 }}>
                        <div style={{ display:"flex",gap:10,alignItems:"center",justifyContent:"center" }}>
                          <Spinner />Loading invoices…
                        </div>
                      </td></tr>
                    ) : visible.length===0 ? (
                      <tr><td colSpan={14} style={{ padding:56,textAlign:"center",color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:13 }}>
                        No invoices match your filters.
                      </td></tr>
                    ) : visible.map((inv,i)=>{
                      const isOverdue   = inv.dueDate&&inv.dueDate<today()&&inv.paymentStatus!=="Paid";
                      const isDirect    = inv.invoiceType==="direct_grc";
                      const sourceRef   = isDirect?(inv.directGrcNo||"—"):(inv.poNo||"—");
                      const noContact   = !inv.isRegisteredVendor&&!inv.vendorEmail&&!inv.vendorPhone;
                      return (
                        <tr key={inv.id} className="row-hover"
                          onClick={()=>{setActive(inv);setModal("view");}}
                          style={{ borderBottom:`1px solid ${C.border}`,
                            background:noContact?"#FFFBEB":i%2===0?C.card:C.surface,
                            animation:`piFadeUp .2s ease ${i*0.02}s both` }}>
                          <td style={{ padding:"10px 12px" }}>
                            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:500,color:C.accent }}>{inv.invoiceNo||"—"}</span>
                          </td>
                          <td style={{ padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:11,color:C.muted }}>{inv.vendorInvoiceNo||"—"}</td>
                          <td style={{ padding:"10px 12px" }}>
                            <TypeBadge t={inv.invoiceType} />
                            <div style={{ marginTop:3 }}><VendorBadge isRegistered={inv.isRegisteredVendor} /></div>
                            {noContact&&<div style={{ fontSize:9,color:C.red,fontFamily:"'DM Sans',sans-serif",fontWeight:700,marginTop:2 }}>⚠ No contact</div>}
                          </td>
                          <td style={{ padding:"10px 12px",fontSize:12,fontFamily:"'DM Sans',sans-serif",maxWidth:130 }}>
                            <div style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{inv.vendorName||"—"}</div>
                            {inv.vendorEmail&&<div style={{ fontSize:10,color:C.muted,marginTop:1 }}>📧 {inv.vendorEmail}</div>}
                            {!inv.isRegisteredVendor&&inv.vendorPhone&&<div style={{ fontSize:10,color:C.muted,marginTop:1 }}>📱 {inv.vendorPhone}</div>}
                          </td>
                          <td style={{ padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:11 }}>{sourceRef}</td>
                          <td style={{ padding:"10px 12px",fontSize:11,color:C.muted,fontFamily:"'DM Sans',sans-serif" }}>{fmtDate(inv.invoiceDate)}</td>
                          <td style={{ padding:"10px 12px",fontSize:11,fontFamily:"'DM Sans',sans-serif",
                            color:isOverdue?C.red:C.muted,fontWeight:isOverdue?700:400 }}>
                            {fmtDate(inv.dueDate)}{isOverdue?" ⚠":""}
                          </td>
                          <td style={{ padding:"10px 12px" }}><StatusPill s={inv.status} /></td>
                          <td style={{ padding:"10px 12px" }}><PayStatusPill s={inv.paymentStatus} /></td>
                          <td style={{ padding:"10px 12px" }}><MatchBadge match={inv.threeWayMatch} /></td>
                          <td style={{ padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600 }}>₹{money(inv.invoiceTotal)}</td>
                          <td style={{ padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,
                            color:n0(inv.balanceDue)>0?C.accent:C.green }}>₹{money(inv.balanceDue)}</td>
                          <td style={{ padding:"10px 12px" }}>
                            {inv.vendorNotified
                              ? <span style={{ fontSize:10,color:C.green,fontFamily:"'DM Sans',sans-serif",fontWeight:700 }}>✓ Yes{inv.vendorAcknowledged?" ✓Ack":""}</span>
                              : <span style={{ fontSize:10,color:C.red, fontFamily:"'DM Sans',sans-serif",fontWeight:700 }}>✗ Pending</span>}
                            {inv.isRegisteredVendor&&<div style={{ fontSize:9,color:C.muted,marginTop:1,fontFamily:"'DM Sans',sans-serif" }}>🖥️ Portal</div>}
                          </td>
                          <td style={{ padding:"10px 12px" }} onClick={e=>e.stopPropagation()}>
                            <div style={{ display:"flex",gap:3,flexWrap:"wrap" }}>
                              {inv.status==="Draft"&&<TblBtn color="#8B4513" onClick={()=>{setActive(inv);setModal("form");}}>Edit</TblBtn>}
                              {inv.status==="Draft"&&<TblBtn color="#7C3AED" onClick={()=>handleSubmit(inv)}>Submit</TblBtn>}
                              {["Submitted","UnderReview","OnHold"].includes(inv.status)&&<TblBtn color="#15803D" onClick={()=>handleApprove(inv)}>Approve</TblBtn>}
                              {["Approved","PartiallyPaid"].includes(inv.status)&&<TblBtn color="#0D9488" onClick={()=>{setActive(inv);setModal("pay");}}>Pay</TblBtn>}
                              <TblBtn color="#2563EB" onClick={()=>{setActive(inv);setModal("notify");}}>🔔 Notify</TblBtn>
                              {!["Paid","Cancelled"].includes(inv.status)&&<TblBtn color="#EA580C" onClick={()=>{setActive(inv);setReasonInput("");setModal("hold");}}>Hold</TblBtn>}
                              {!["Paid","Cancelled"].includes(inv.status)&&<TblBtn color="#B91C1C" onClick={()=>{setActive(inv);setReasonInput("");setModal("cancel");}}>Cancel</TblBtn>}
                              {inv.status==="Draft"&&<TblBtn color="#DC2626" onClick={()=>{setActive(inv);setModal("delete");}}>Del</TblBtn>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {visible.length>0&&(
                <div style={{ padding:"9px 16px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",fontFamily:"'DM Sans',sans-serif" }}>
                  <span style={{ fontSize:11,color:C.muted }}>Showing {visible.length} of {invoices.length}</span>
                  <span style={{ fontSize:11,color:C.muted }}>Balance: <b style={{ color:C.accent,fontFamily:"'DM Mono',monospace" }}>₹{money(visible.reduce((s,i)=>s+n0(i.balanceDue),0))}</b></span>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab==="notifications" && <NotificationCenter invoices={invoices} showToast={showToast} onRefresh={fetchInvoices} />}
        {activeTab==="aging"         && <AgingReport showToast={showToast} />}
        {activeTab==="vendor"        && <VendorPortal invoices={invoices} showToast={showToast} onRefresh={fetchInvoices} />}
      </div>

      {/* Modals */}
      {modal==="form"   && <Overlay onClose={closeModal} wide><InvoiceForm initialInv={active} onClose={closeModal} onSave={handleSave} /></Overlay>}
      {modal==="view"   && active && <Overlay onClose={closeModal} wide><InvoiceViewModal inv={active} onClose={closeModal} showToast={showToast} onRefresh={fetchInvoices} /></Overlay>}
      {modal==="pay"    && active && <Overlay onClose={closeModal}><PaymentForm inv={active} onClose={()=>{closeModal();fetchInvoices();}} showToast={showToast} /></Overlay>}
      {modal==="notify" && active && <Overlay onClose={closeModal}><NotifyVendorModal inv={active} onClose={()=>{closeModal();fetchInvoices();}} showToast={showToast} /></Overlay>}
      {["hold","cancel","delete"].includes(modal) && active && (
        <MiniModal title={modal==="hold"?`Hold ${active.invoiceNo}?`:modal==="cancel"?`Cancel ${active.invoiceNo}?`:`Delete ${active.invoiceNo}?`} onClose={closeModal}>
          {modal!=="delete"&&(
            <><p style={{ fontSize:13,color:C.muted,margin:"0 0 10px",fontFamily:"'DM Sans',sans-serif" }}>
              {modal==="hold"?"Provide a reason for holding.":"Provide a cancellation reason."}
            </p>
            <textarea className="inp" rows={3} value={reasonInput} onChange={e=>setReasonInput(e.target.value)} placeholder="Reason…" style={{ resize:"vertical" }} /></>
          )}
          {modal==="delete"&&<p style={{ fontSize:13,color:C.muted,margin:"0 0 14px",fontFamily:"'DM Sans',sans-serif" }}>This permanently deletes the draft invoice.</p>}
          <div style={{ display:"flex",justifyContent:"flex-end",gap:8,marginTop:14 }}>
            <GhostBtn onClick={closeModal}>Back</GhostBtn>
            <button className="btn" style={{ padding:"9px 18px",background:"#B91C1C",color:"#fff",fontSize:13,fontFamily:"'DM Sans',sans-serif" }}
              onClick={modal==="hold"?handleHold:modal==="cancel"?handleCancel:handleDelete}>
              {modal==="hold"?"Confirm Hold":modal==="cancel"?"Confirm Cancel":"Delete Invoice"}
            </button>
          </div>
        </MiniModal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   NOTIFY VENDOR MODAL
   Handles BOTH registered vendors (portal + email)
   and non-registered / walk-in vendors (email / SMS / WhatsApp)
═══════════════════════════════════════════════════════════════════ */
function NotifyVendorModal({ inv, onClose, showToast }) {
  const isReg  = !!inv.isRegisteredVendor;
  const [channel,  setChannel]  = useState(isReg?"email": inv.vendorEmail?"email":"sms");
  const [to,       setTo]       = useState(isReg?(inv.vendorEmail||""):(inv.vendorEmail||inv.vendorPhone||""));
  const [subject,  setSubject]  = useState(`Invoice ${inv.invoiceNo} — ${inv.vendorName}`);
  const [message,  setMessage]  = useState(
    `Dear ${inv.vendorName||"Vendor"},\n\nThis is to inform you regarding Invoice ${inv.invoiceNo} dated ${inv.invoiceDate}.\n\nInvoice Total : ₹${n0(inv.invoiceTotal).toLocaleString("en-IN")}\nBalance Due   : ₹${n0(inv.balanceDue).toLocaleString("en-IN")}\nStatus        : ${inv.status}\nDue Date      : ${inv.dueDate||"—"}\n\nPlease contact the AP team for any queries.\n\nRegards,\nAccounts Payable`
  );
  const [patchEmail, setPatchEmail] = useState(inv.vendorEmail||"");
  const [patchPhone, setPatchPhone] = useState(inv.vendorPhone||"");
  const [patchAddr,  setPatchAddr]  = useState(inv.vendorAddress||"");
  const [patching,   setPatching]   = useState(false);
  const [contactSaved, setContactSaved] = useState(!!(inv.vendorEmail||inv.vendorPhone));
  const [sending, setSending] = useState(false);

  const saveContact = async () => {
    setPatching(true);
    try {
      const res  = await authFetch(`${PI_API}/${inv.id}/vendor-contact`,{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({vendorEmail:patchEmail,vendorPhone:patchPhone,vendorAddress:patchAddr}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      showToast("Contact info saved");
      setContactSaved(true);
      setTo(patchEmail||patchPhone);
    } catch(e){showToast(e.message,"err");}
    finally{setPatching(false);}
  };

  const send = async () => {
    if (!to.trim()) return showToast("Enter a recipient","err");
    setSending(true);
    try {
      const res  = await authFetch(`${PI_API}/${inv.id}/notify`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({channel,to:to.trim(),subject,message,senderName:"Accounts Payable"}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      showToast(data.message||"Notification queued");
      onClose();
    } catch(e){showToast(e.message,"err");}
    finally{setSending(false);}
  };

  return (
    <div style={{ background:"#fff",borderRadius:14,padding:28,width:"min(580px,95vw)",
      fontFamily:"'DM Sans',sans-serif",maxHeight:"92vh",overflowY:"auto" }}>

      {/* Title */}
      <div style={{ marginBottom:16 }}>
        <h3 style={{ margin:"0 0 6px",fontFamily:"'Crimson Pro',serif",fontSize:20,fontWeight:300 }}>Notify Vendor</h3>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
          <span style={{ fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace" }}>{inv.invoiceNo}</span>
          <span style={{ fontSize:12,color:C.muted }}>·</span>
          <span style={{ fontSize:12,color:C.text }}>{inv.vendorName}</span>
          <TypeBadge t={inv.invoiceType} />
          <VendorBadge isRegistered={isReg} />
        </div>
      </div>

      {/* Registered: info banner */}
      {isReg && (
        <div style={{ marginBottom:16,padding:"12px 14px",borderRadius:8,fontSize:12,
          background:"#F0FDF4",border:"1px solid #BBF7D0",color:"#166534" }}>
          <b>✅ Registered Vendor</b> — notification is recorded in their portal AND sent by email automatically on every status change.
          You can also send a custom message below.
          {inv.vendorEmail&&<div style={{ marginTop:4,opacity:.8 }}>Portal email: {inv.vendorEmail}</div>}
          {inv.vendorAcknowledged
            ? <div style={{ marginTop:4,fontWeight:700 }}>✓ Already acknowledged by vendor</div>
            : <div style={{ marginTop:4,color:"#C2410C" }}>⏳ Awaiting vendor acknowledgement</div>}
        </div>
      )}

      {/* Non-registered: contact editor */}
      {!isReg && (
        <div style={{ marginBottom:16 }}>
          <div style={{ padding:"10px 14px",borderRadius:8,fontSize:12,marginBottom:10,
            background:contactSaved?"#F0FDF4":"#FFF7ED",
            border:`1px solid ${contactSaved?"#BBF7D0":"#FDE68A"}`,
            color:contactSaved?"#166534":"#92400E" }}>
            {contactSaved
              ? "✅ Contact info saved. Fill in the message below and send."
              : "⚠ Walk-in vendor with no registered account. Add contact details so the notification can be delivered."}
          </div>
          <div style={{ background:"#FDFBF8",border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:8 }}>
            <div style={{ fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".6px",marginBottom:10 }}>
              Vendor Contact Details
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
              <FField label="Email"><input className="inp" type="email" value={patchEmail} onChange={e=>{setPatchEmail(e.target.value);setTo(e.target.value);}} placeholder="vendor@example.com" /></FField>
              <FField label="Phone / WhatsApp"><input className="inp" type="tel" value={patchPhone} onChange={e=>{setPatchPhone(e.target.value);if(!patchEmail)setTo(e.target.value);}} placeholder="+91 98765 43210" /></FField>
            </div>
            <FField label="Address (optional)"><input className="inp" value={patchAddr} onChange={e=>setPatchAddr(e.target.value)} placeholder="Mailing address" /></FField>
            <button className="btn" onClick={saveContact} disabled={patching}
              style={{ marginTop:10,padding:"8px 16px",background:"#1E40AF",color:"#fff",fontSize:12 }}>
              {patching?<Spinner />:"💾 Save Contact Info"}
            </button>
          </div>
        </div>
      )}

      {/* Channel selector */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:12,fontWeight:600,color:C.muted,marginBottom:8 }}>Send via</div>
        <div style={{ display:"flex",gap:8 }}>
          {[
            {v:"email",    l:"📧 Email",    enabled:isReg||!!patchEmail||!!inv.vendorEmail},
            {v:"sms",      l:"📱 SMS",      enabled:isReg||!!patchPhone||!!inv.vendorPhone},
            {v:"whatsapp", l:"💬 WhatsApp", enabled:isReg||!!patchPhone||!!inv.vendorPhone},
          ].map(({v,l,enabled})=>(
            <button key={v} className="btn" disabled={!enabled} onClick={()=>{setChannel(v);setTo(v==="email"?(patchEmail||inv.vendorEmail||""):(patchPhone||inv.vendorPhone||""));}}
              style={{ padding:"8px 16px",fontSize:12,
                background:channel===v?C.accentLight:C.card,
                color:channel===v?C.accent:enabled?C.muted:"#CCC",
                border:`1px solid ${channel===v?C.accentBorder:C.border}` }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* To */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11,fontWeight:600,color:C.muted,marginBottom:5 }}>{channel==="email"?"Email Address *":"Phone Number *"}</div>
        <input className="inp" value={to} onChange={e=>setTo(e.target.value)}
          type={channel==="email"?"email":"tel"}
          placeholder={channel==="email"?"vendor@example.com":"+91 98765 43210"}
          readOnly={isReg&&channel==="email"&&!!inv.vendorEmail} />
      </div>

      {/* Subject (email only) */}
      {channel==="email"&&(
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11,fontWeight:600,color:C.muted,marginBottom:5 }}>Subject</div>
          <input className="inp" value={subject} onChange={e=>setSubject(e.target.value)} />
        </div>
      )}

      {/* Message */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11,fontWeight:600,color:C.muted,marginBottom:5 }}>Message</div>
        <textarea className="inp" rows={9} value={message} onChange={e=>setMessage(e.target.value)} style={{ resize:"vertical",fontSize:12 }} />
        <div style={{ fontSize:10,color:C.muted,marginTop:3 }}>
          {message.length} chars
          {channel==="sms"&&message.length>160&&<span style={{ color:C.red }}> — will be split into {Math.ceil(message.length/160)} SMS parts</span>}
        </div>
      </div>

      {/* Preview strip */}
      <div style={{ marginBottom:16,padding:"10px 14px",borderRadius:8,fontSize:12,background:"#F6F4EF",border:`1px solid ${C.border}` }}>
        <span style={{ color:C.muted }}>To: </span><b>{to||"—"}</b>
        {"  ·  "}<span style={{ color:C.muted }}>Channel: </span><b>{isReg?`portal + ${channel}`:channel}</b>
        {channel==="email"&&<>{"  ·  "}<span style={{ color:C.muted }}>Subject: </span><b>{subject}</b></>}
      </div>

      <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <button className="btn" onClick={send} disabled={sending||!to.trim()}
          style={{ padding:"10px 24px",background:sending?"#D4CEBF":"#2563EB",color:"#fff",fontSize:13 }}>
          {sending?<><Spinner /> Sending…</>:`Send via ${channel}`}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATION CENTER TAB
   AP-team view: grouped by notification status
   Walk-in vendors with no contact are highlighted for action
═══════════════════════════════════════════════════════════════════ */
function NotificationCenter({ invoices, showToast, onRefresh }) {
  const [filter,      setFilter]      = useState("all");
  const [notifTarget, setNotifTarget] = useState(null);

  const groups = useMemo(() => {
    const active = invoices.filter(i=>!["Paid","Cancelled"].includes(i.status));
    return {
      all:        invoices,
      noContact:  active.filter(i=>!i.isRegisteredVendor&&!i.vendorEmail&&!i.vendorPhone),
      unnotified: active.filter(i=>!i.vendorNotified&&(i.isRegisteredVendor||i.vendorEmail||i.vendorPhone)),
      registered: invoices.filter(i=>i.isRegisteredVendor),
      walkin:     invoices.filter(i=>!i.isRegisteredVendor),
    };
  }, [invoices]);

  const shown = groups[filter==="nocontact"?"noContact":filter] || groups.all;

  return (
    <div>
      {/* Sub-filter bar */}
      <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:14 }}>
        <span style={{ fontSize:13,fontFamily:"'Crimson Pro',serif",fontWeight:600,color:C.text }}>Notification Overview</span>
        {[
          ["all",        `All (${groups.all.length})`,                     C.muted],
          ["unnotified", `⏳ Unnotified (${groups.unnotified.length})`,    "#C2410C"],
          ["nocontact",  `❗ No Contact (${groups.noContact.length})`,      C.red],
          ["registered", `✅ Registered (${groups.registered.length})`,    C.green],
          ["walkin",     `🔔 Walk-in (${groups.walkin.length})`,           "#92400E"],
        ].map(([v,l,color])=>(
          <button key={v} className="btn" onClick={()=>setFilter(v)}
            style={{ padding:"7px 12px",fontSize:11,fontFamily:"'DM Sans',sans-serif",
              background:filter===v?C.accentLight:C.card,color:filter===v?C.accent:color,
              border:`1px solid ${filter===v?C.accentBorder:C.border}` }}>
            {l}
          </button>
        ))}
      </div>

      {/* No-contact banner */}
      {groups.noContact.length>0&&filter!=="nocontact"&&(
        <div style={{ marginBottom:12,padding:"10px 16px",borderRadius:8,background:"#FEF2F2",
          border:"1px solid #FECACA",fontSize:12,color:"#991B1B",fontFamily:"'DM Sans',sans-serif",
          cursor:"pointer",display:"flex",alignItems:"center",gap:10 }}
          onClick={()=>setFilter("nocontact")}>
          ❗ <span><b>{groups.noContact.length} walk-in invoice(s)</b> have no contact info → click to view and add email/phone.</span>
        </div>
      )}

      {shown.length===0
        ? <div style={{ padding:48,textAlign:"center",color:C.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif" }}>No invoices in this category.</div>
        : shown.map(inv=>{
          const isReg      = !!inv.isRegisteredVendor;
          const noContact  = !isReg&&!inv.vendorEmail&&!inv.vendorPhone;
          const accentColor = noContact?C.red:isReg?C.green:"#F59E0B";
          return (
            <div key={inv.id} className="notif-row" style={{ borderLeft:`3px solid ${accentColor}` }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10 }}>
                <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:600,color:C.accent }}>{inv.invoiceNo||"—"}</span>
                  <TypeBadge t={inv.invoiceType} />
                  <VendorBadge isRegistered={isReg} />
                  <StatusPill s={inv.status} />
                </div>
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  {inv.vendorNotified
                    ? <span style={{ fontSize:11,color:C.green,fontFamily:"'DM Sans',sans-serif",fontWeight:700 }}>✓ Notified {fmtDate(inv.vendorNotifiedAt?.slice(0,10))}</span>
                    : <span style={{ fontSize:11,color:C.red, fontFamily:"'DM Sans',sans-serif",fontWeight:700 }}>✗ Not Notified</span>}
                  <button className="btn" onClick={()=>setNotifTarget(inv)}
                    style={{ padding:"6px 14px",fontSize:11,background:"#2563EB",color:"#fff" }}>
                    {noContact?"Add Contact & Notify":"Send Notification"}
                  </button>
                </div>
              </div>
              <div style={{ marginTop:8,display:"flex",gap:20,flexWrap:"wrap",fontSize:12,fontFamily:"'DM Sans',sans-serif" }}>
                <span style={{ color:C.muted }}>Vendor: <b style={{ color:C.text }}>{inv.vendorName||"—"}</b></span>
                <span style={{ color:C.muted }}>Total: <b style={{ fontFamily:"'DM Mono',monospace" }}>₹{money(inv.invoiceTotal)}</b></span>
                <span style={{ color:C.muted }}>Due: <b>{fmtDate(inv.dueDate)}</b></span>
                {isReg
                  ? <>
                      {inv.vendorEmail&&<span style={{ color:C.green }}>📧 {inv.vendorEmail}</span>}
                      <span style={{ color:C.green }}>🖥️ Portal active</span>
                      {inv.vendorAcknowledged
                        ? <span style={{ color:C.green,fontWeight:700 }}>✓ Acknowledged</span>
                        : <span style={{ color:"#C2410C" }}>⏳ Awaiting acknowledgement</span>}
                    </>
                  : <>
                      {inv.vendorEmail&&<span style={{ color:"#92400E" }}>📧 {inv.vendorEmail}</span>}
                      {inv.vendorPhone&&<span style={{ color:"#92400E" }}>📱 {inv.vendorPhone}</span>}
                      {noContact&&<span style={{ color:C.red,fontWeight:700 }}>⚠ No email or phone — cannot auto-notify</span>}
                    </>}
              </div>
            </div>
          );
        })
      }

      {notifTarget&&(
        <Overlay onClose={()=>setNotifTarget(null)}>
          <NotifyVendorModal inv={notifTarget} onClose={()=>{setNotifTarget(null);onRefresh();}} showToast={showToast} />
        </Overlay>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VENDOR PORTAL TAB
   Left panel: registered vendors  |  walk-in vendors (switchable)
   Right panel: invoice list + contact management for walk-ins
═══════════════════════════════════════════════════════════════════ */
function VendorPortal({ invoices, showToast, onRefresh }) {
  const [portalTab,   setPortalTab]   = useState("registered");
  const [search,      setSearch]      = useState("");
  const [selVendor,   setSelVendor]   = useState(null);
  const [notifTarget, setNotifTarget] = useState(null);

  const vendorMap = useMemo(() => {
    const reg = {}, walk = {};
    invoices.forEach(inv => {
      const k   = inv.vendorName||"—";
      const map = inv.isRegisteredVendor ? reg : walk;
      if (!map[k]) map[k] = { name:k, invoices:[], balance:0, email:inv.vendorEmail||"", phone:inv.vendorPhone||"" };
      map[k].invoices.push(inv);
      map[k].balance += n0(inv.balanceDue);
      if (inv.vendorEmail && !map[k].email) map[k].email = inv.vendorEmail;
      if (inv.vendorPhone && !map[k].phone) map[k].phone = inv.vendorPhone;
    });
    return { registered:Object.values(reg), walkin:Object.values(walk) };
  }, [invoices]);

  const list = (portalTab==="registered"?vendorMap.registered:vendorMap.walkin)
    .filter(v=>!search||v.name.toLowerCase().includes(search.toLowerCase()));

  const selInvs = selVendor ? invoices.filter(i=>i.vendorName===selVendor.name) : [];

  return (
    <div style={{ display:"grid",gridTemplateColumns:"270px 1fr",gap:14,minHeight:500 }}>
      {/* Sidebar */}
      <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden" }}>
        <div style={{ padding:"12px 14px",borderBottom:`1px solid ${C.border}`,background:"#F0EDE6" }}>
          <div style={{ display:"flex",gap:4,marginBottom:10 }}>
            {[["registered",`✅ Registered (${vendorMap.registered.length})`],["walkin",`🔔 Walk-in (${vendorMap.walkin.length})`]].map(([v,l])=>(
              <button key={v} className="btn" onClick={()=>{setPortalTab(v);setSelVendor(null);}}
                style={{ flex:1,padding:"6px 4px",fontSize:10,fontFamily:"'DM Sans',sans-serif",
                  background:portalTab===v?C.accentLight:C.card,
                  color:portalTab===v?C.accent:C.muted,
                  border:`1px solid ${portalTab===v?C.accentBorder:C.border}` }}>
                {l}
              </button>
            ))}
          </div>
          <input className="inp" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search vendor…" style={{ fontSize:12,padding:"6px 10px" }} />
        </div>
        <div style={{ overflowY:"auto",maxHeight:540 }}>
          {list.length===0
            ? <div style={{ padding:20,textAlign:"center",color:C.muted,fontSize:12 }}>No vendors found.</div>
            : list.map(v=>{
              const noContact = portalTab==="walkin"&&!v.email&&!v.phone;
              return (
                <div key={v.name} onClick={()=>setSelVendor(selVendor?.name===v.name?null:v)}
                  style={{ padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${C.border}`,
                    background:selVendor?.name===v.name?C.accentLight:"#fff",
                    borderLeft:`3px solid ${noContact?C.red:portalTab==="registered"?C.green:"#F59E0B"}` }}>
                  <div style={{ fontSize:12,fontWeight:600,color:selVendor?.name===v.name?C.accent:C.text,fontFamily:"'DM Sans',sans-serif",marginBottom:2 }}>{v.name}</div>
                  <div style={{ fontSize:10,color:C.muted }}>{v.invoices.length} inv · <span style={{ fontFamily:"'DM Mono',monospace" }}>₹{v.balance.toLocaleString("en-IN",{maximumFractionDigits:0})}</span></div>
                  {portalTab==="walkin"&&<div style={{ fontSize:10,marginTop:2 }}>
                    {v.email&&<span style={{ color:"#92400E",marginRight:6 }}>📧 {v.email}</span>}
                    {v.phone&&<span style={{ color:"#92400E" }}>📱 {v.phone}</span>}
                    {noContact&&<span style={{ color:C.red,fontWeight:700 }}>⚠ No contact</span>}
                  </div>}
                  {portalTab==="registered"&&<div style={{ fontSize:10,color:C.green,marginTop:2 }}>🖥️ Portal access</div>}
                </div>
              );
            })
          }
        </div>
      </div>

      {/* Detail panel */}
      <div>
        {!selVendor ? (
          <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:10,
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            height:"100%",minHeight:300,color:C.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif",gap:8 }}>
            <span style={{ fontSize:36 }}>{portalTab==="registered"?"✅":"🔔"}</span>
            <span>{portalTab==="registered"?"Select a registered vendor to view their portal":"Select a walk-in vendor to manage contact &amp; send notifications"}</span>
          </div>
        ) : (
          <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden" }}>
            {/* Vendor header */}
            <div style={{ padding:"14px 18px",background:"#F0EDE6",borderBottom:`1px solid ${C.border}`,
              display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10 }}>
              <div>
                <div style={{ fontSize:16,fontWeight:600,color:C.text,fontFamily:"'Crimson Pro',serif",marginBottom:3 }}>{selVendor.name}</div>
                <div style={{ fontSize:11,color:C.muted,fontFamily:"'DM Sans',sans-serif",display:"flex",gap:12,flexWrap:"wrap" }}>
                  <span>{selInvs.length} invoice(s)</span>
                  <span>Balance: ₹{selVendor.balance.toLocaleString("en-IN",{maximumFractionDigits:0})}</span>
                  {selVendor.email&&<span>📧 {selVendor.email}</span>}
                  {selVendor.phone&&<span>📱 {selVendor.phone}</span>}
                </div>
              </div>
              <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                <VendorBadge isRegistered={portalTab==="registered"} />
                {portalTab==="registered"&&<span style={{ fontSize:11,padding:"4px 10px",borderRadius:20,background:"#F0FDF4",color:C.green,border:"1px solid #BBF7D0",fontFamily:"'DM Sans',sans-serif",fontWeight:600 }}>🖥️ Portal Active</span>}
              </div>
            </div>

            {/* Walk-in: bulk contact editor */}
            {portalTab==="walkin"&&<WalkInContactManager vendor={selVendor} invoices={selInvs} showToast={showToast} onRefresh={onRefresh} onNotify={setNotifTarget} />}

            {/* Registered: portal info */}
            {portalTab==="registered"&&(
              <div style={{ padding:"12px 18px",background:"#F0FDF4",borderBottom:`1px solid #BBF7D0`,fontSize:12,color:"#166534",fontFamily:"'DM Sans',sans-serif" }}>
                ✅ This vendor can log in at <code style={{ fontSize:11 }}>/vendor-invoices</code> to view all their invoices, payment schedules, match results, and raise queries.
                All status-change events (created, submitted, approved, paid) are automatically pushed to their portal.
              </div>
            )}

            {/* Invoice table */}
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",minWidth:1000 }}>
                <thead><tr style={{ background:C.surface,borderBottom:`1px solid ${C.border}` }}>
                  {["Invoice No","Vendor Inv","Type","PO/GRC","Date","Due","Total","Paid","Balance","Status","Pay","Notified","Ack","Action"].map(h=>(
                    <th key={h} style={{ padding:"8px 12px",fontSize:9,fontWeight:700,color:C.muted,
                      textTransform:"uppercase",letterSpacing:".5px",textAlign:"left",
                      fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {selInvs.map((inv,i)=>{
                    const isDirect = inv.invoiceType==="direct_grc";
                    const isOverdue = inv.dueDate&&inv.dueDate<today()&&inv.paymentStatus!=="Paid";
                    return (
                      <tr key={inv.id} style={{ borderBottom:`1px solid ${C.border}`,background:i%2===0?"#fff":C.surface }}>
                        <td style={{ padding:"8px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.accent }}>{inv.invoiceNo||"—"}</td>
                        <td style={{ padding:"8px 12px",fontFamily:"'DM Mono',monospace",fontSize:11,color:C.muted }}>{inv.vendorInvoiceNo||"—"}</td>
                        <td style={{ padding:"8px 12px" }}><TypeBadge t={inv.invoiceType} /></td>
                        <td style={{ padding:"8px 12px",fontFamily:"'DM Mono',monospace",fontSize:11 }}>{isDirect?(inv.directGrcNo||"—"):(inv.poNo||"—")}</td>
                        <td style={{ padding:"8px 12px",fontSize:11 }}>{fmtDate(inv.invoiceDate)}</td>
                        <td style={{ padding:"8px 12px",fontSize:11,color:isOverdue?C.red:C.muted,fontWeight:isOverdue?700:400 }}>{fmtDate(inv.dueDate)}{isOverdue?" ⚠":""}</td>
                        <td style={{ padding:"8px 12px",fontFamily:"'DM Mono',monospace",fontSize:12 }}>₹{money(inv.invoiceTotal)}</td>
                        <td style={{ padding:"8px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.green }}>₹{money(inv.paidAmount)}</td>
                        <td style={{ padding:"8px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,color:n0(inv.balanceDue)>0?C.accent:C.green }}>₹{money(inv.balanceDue)}</td>
                        <td style={{ padding:"8px 12px" }}><StatusPill s={inv.status} /></td>
                        <td style={{ padding:"8px 12px" }}><PayStatusPill s={inv.paymentStatus} /></td>
                        <td style={{ padding:"8px 12px",fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:700,color:inv.vendorNotified?C.green:C.red }}>{inv.vendorNotified?"✓":"✗"}</td>
                        <td style={{ padding:"8px 12px",fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:700,color:inv.vendorAcknowledged?C.green:C.muted }}>{inv.vendorAcknowledged?"✓":"—"}</td>
                        <td style={{ padding:"8px 12px" }}><TblBtn color="#2563EB" onClick={()=>setNotifTarget(inv)}>🔔 Notify</TblBtn></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {notifTarget&&(
        <Overlay onClose={()=>setNotifTarget(null)}>
          <NotifyVendorModal inv={notifTarget} onClose={()=>{setNotifTarget(null);onRefresh();}} showToast={showToast} />
        </Overlay>
      )}
    </div>
  );
}

/* Walk-in bulk contact editor (used inside VendorPortal) */
function WalkInContactManager({ vendor, invoices, showToast, onRefresh, onNotify }) {
  const [email,   setEmail]   = useState(vendor.email||"");
  const [phone,   setPhone]   = useState(vendor.phone||"");
  const [saving,  setSaving]  = useState(false);

  const saveAll = async () => {
    setSaving(true);
    let errors = 0;
    for (const inv of invoices.filter(i=>!i.isRegisteredVendor)) {
      try {
        const res = await authFetch(`${PI_API}/${inv.id}/vendor-contact`,{
          method:"PATCH",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({vendorEmail:email,vendorPhone:phone}),
        });
        if (!res.ok) errors++;
      } catch { errors++; }
    }
    setSaving(false);
    errors ? showToast(`Saved with ${errors} error(s)`,"err") : (showToast("Contact info saved for all invoices"),onRefresh());
  };

  return (
    <div style={{ padding:"14px 18px",borderBottom:`1px solid ${C.border}`,
      background:"#FFFBEB",fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"#92400E",textTransform:"uppercase",letterSpacing:".6px",marginBottom:8 }}>
        📋 Walk-in Vendor — Contact Management
      </div>
      <div style={{ fontSize:12,color:"#92400E",marginBottom:10 }}>
        Not a registered vendor. Add email/phone here to enable invoice notifications.
        Saving applies to <b>all {invoices.length} invoice(s)</b> for this vendor.
      </div>
      <div style={{ display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap" }}>
        <div style={{ flex:1,minWidth:200 }}>
          <div style={{ fontSize:11,fontWeight:600,color:C.muted,marginBottom:4 }}>Email</div>
          <input className="inp" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="vendor@example.com" />
        </div>
        <div style={{ flex:1,minWidth:180 }}>
          <div style={{ fontSize:11,fontWeight:600,color:C.muted,marginBottom:4 }}>Phone / WhatsApp</div>
          <input className="inp" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 98765 43210" />
        </div>
        <button className="btn" onClick={saveAll} disabled={saving}
          style={{ padding:"9px 16px",background:"#1E40AF",color:"#fff",fontSize:12,whiteSpace:"nowrap" }}>
          {saving?<Spinner />:"💾 Save & Apply"}
        </button>
        {(email||phone)&&invoices[0]&&(
          <button className="btn" onClick={()=>onNotify(invoices[0])}
            style={{ padding:"9px 16px",background:"#2563EB",color:"#fff",fontSize:12,whiteSpace:"nowrap" }}>
            🔔 Notify Now
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   INVOICE FORM
═══════════════════════════════════════════════════════════════════ */
function InvoiceForm({ initialInv, onClose, onSave }) {
  const getType = () => !initialInv?"po_linked":(initialInv.invoiceType||(initialInv.directGrcNo?"direct_grc":"po_linked"));
  const [invoiceType,      setInvoiceType]      = useState(getType);
  const [saving,           setSaving]           = useState(false);
  const [items,            setItems]            = useState(Array.isArray(initialInv?.items)&&initialInv.items.length?initialInv.items:[EMPTY_ITEM()]);
  const [pos,              setPos]              = useState([]);
  const [poSearch,         setPoSearch]         = useState(initialInv?.poNo||"");
  const [poOpen,           setPoOpen]           = useState(false);
  const [poGrns,           setPoGrns]           = useState([]);
  const [allPoGrns,        setAllPoGrns]        = useState([]);
  const [poGrnLoading,     setPoGrnLoading]     = useState(false);
  const [grcs,             setGrcs]             = useState([]);
  const [grcSearch,        setGrcSearch]        = useState(initialInv?.directGrcNo||"");
  const [grcOpen,          setGrcOpen]          = useState(false);
  const [directGrns,       setDirectGrns]       = useState([]);
  const [allDirectGrns,    setAllDirectGrns]    = useState([]);
  const [grcLoading,       setGrcLoading]       = useState(false);
  const [directGrnLoading, setDirectGrnLoading] = useState(false);

  const [header, setHeader] = useState({
    vendorInvoiceNo:initialInv?.vendorInvoiceNo||"",
    invoiceDate:    initialInv?.invoiceDate||today(),
    dueDate:        initialInv?.dueDate||"",
    receivedDate:   initialInv?.receivedDate||today(),
    poNo:           initialInv?.poNo||"",
    grnNos:         initialInv?.grnNos||[],
    directGrcNo:    initialInv?.directGrcNo||"",
    vendorName:     initialInv?.vendorName||"",
    vendorEmail:    initialInv?.vendorEmail||"",
    vendorPhone:    initialInv?.vendorPhone||"",
    freightCharges: initialInv?.freightCharges||0,
    otherCharges:   initialInv?.otherCharges||0,
    roundOff:       initialInv?.roundOff||0,
    advanceAdjusted:initialInv?.advanceAdjusted||0,
    paymentTerms:   initialInv?.paymentTerms||"Net30",
    paymentMode:    initialInv?.paymentMode||"NEFT",
    bankName:       initialInv?.bankName||"",
    accountNo:      initialInv?.accountNo||"",
    ifscCode:       initialInv?.ifscCode||"",
    chequeNo:       initialInv?.chequeNo||"",
    chequeDate:     initialInv?.chequeDate||"",
    upiId:          initialInv?.upiId||"",
    ddNo:           initialInv?.ddNo||"",
    narration:      initialInv?.narration||"",
  });
  const setH = (k,v) => setHeader(p=>({...p,[k]:v}));

  const needsBank   = ["NEFT","RTGS","Cheque","PostDatedCheque","DD"].includes(header.paymentMode);
  const needsUPI    = header.paymentMode==="UPI";
  const needsCheque = ["Cheque","PostDatedCheque"].includes(header.paymentMode);
  const needsPDC    = header.paymentMode==="PostDatedCheque";

  useEffect(()=>{(async()=>{
    try{ const res = await authFetch(PO_API);
const d   = await res.json();
// Only POs that have been fully processed through GRC→GRN can be invoiced.
// VendorSubmitted = buyer hasn't approved yet (rates not locked in)
// Approved onwards = buyer accepted, GRC/GRN can be created, invoice is valid
const invoiceable = ["Approved", "PartiallyReceived", "FullyReceived", "StockUpdated", "Paid"];
setPos(Array.isArray(d) ? d.filter(p => invoiceable.includes(p.status)) : []); }catch{}
  })();},[]);

  useEffect(()=>{(async()=>{
    try{ setGrcLoading(true); const r=await authFetch(GRC_API); const d=await r.json();
      setGrcs(Array.isArray(d)?d.filter(g=>g.status==="Approved"&&!g.poNo):[]); }
    catch{}finally{setGrcLoading(false);}
  })();},[]);

  const handlePOSelect = async (poNo) => {
    setH("poNo",poNo); setH("grnNos",[]); setPoGrns([]); setAllPoGrns([]); setPoSearch(poNo);
    const po = pos.find(p=>p.orderNo===poNo);
    if(po){ setH("vendorName",po.vendorName||""); }
    if(!poNo) return;
    try{ setPoGrnLoading(true); const r=await authFetch(`${GRN_API}/by-po/${poNo}`); const d=await r.json();
      const all=Array.isArray(d)?d:[]; setAllPoGrns(all); setPoGrns(all.filter(g=>g.status==="Posted")); }
    catch{}finally{setPoGrnLoading(false);}
  };

  const handleGRCSelect = async (grcNo) => {
    setH("directGrcNo",grcNo); setH("grnNos",[]); setDirectGrns([]); setAllDirectGrns([]); setGrcSearch(grcNo);
    const grc = grcs.find(g=>g.grcNo===grcNo);
    if(grc){
      setH("vendorName",grc.vendorName||"");
      if(grc.vendorEmail) setH("vendorEmail",grc.vendorEmail);
      if(grc.vendorPhone) setH("vendorPhone",grc.vendorPhone);
    }
    if(!grcNo) return;
    try{ setDirectGrnLoading(true); const r=await authFetch(`${GRN_API}/by-grc/${encodeURIComponent(grcNo)}`); const d=await r.json();
      const all=Array.isArray(d)?d:[]; setAllDirectGrns(all); setDirectGrns(all.filter(g=>g.status==="Posted")); }
    catch{}finally{setDirectGrnLoading(false);}
  };

  const handleGRNToggle = (grnNo) => {
    const avail = invoiceType==="direct_grc"?directGrns:poGrns;
    const newGrnNos = header.grnNos.includes(grnNo)?header.grnNos.filter(n=>n!==grnNo):[...header.grnNos,grnNo];
    setH("grnNos",newGrnNos);
    const po = invoiceType==="po_linked"?pos.find(p=>p.orderNo===header.poNo):null;
    const poRates = {}; if(po) po.items?.forEach(it=>{poRates[it.barcode]=it.rate;});
    const sel = avail.filter(g=>newGrnNos.includes(g.grnNo));
    const merged = {};
    for(const grn of sel) for(const it of grn.items||[]){
      const bc=(it.barcode||"").trim();
      if(!merged[bc]) merged[bc]={...EMPTY_ITEM(),barcode:bc,description:it.description||"",rate:it.rate||0,poRate:poRates[bc]||it.rate||0};
      merged[bc].grnQty+=clamp0(it.inwardQty); merged[bc].invoicedQty=merged[bc].grnQty;
    }
    setItems(Object.values(merged).length?Object.values(merged):[EMPTY_ITEM()]);
  };

  const switchType = (t) => {
    setInvoiceType(t);
    setH("poNo",""); setH("directGrcNo",""); setH("grnNos",[]); setH("vendorName",""); setH("vendorEmail",""); setH("vendorPhone","");
    setPoSearch(""); setGrcSearch(""); setPoGrns([]); setDirectGrns([]);
    setItems([EMPTY_ITEM()]);
  };

  const updateItem = (idx,k,v) => setItems(p=>{const n=[...p];n[idx]={...n[idx],[k]:v};return n;});

  const totals = useMemo(()=>{
    let sub=0,tax=0,disc=0;
    for(const it of items){
      const qty=clamp0(it.invoicedQty),rate=clamp0(it.rate),dp=clamp0(it.discountPct),tp=clamp0(it.taxPct);
      const g=qty*rate,d=g*dp/100,t=(g-d)*tp/100; sub+=g;disc+=d;tax+=t;
    }
    const f=clamp0(header.freightCharges),o=clamp0(header.otherCharges),r=clamp0(header.roundOff),a=clamp0(header.advanceAdjusted);
    return{subtotal:sub,totalDiscount:disc,totalTax:tax,invoiceTotal:sub-disc+tax+f+o+r-a};
  },[items,header.freightCharges,header.otherCharges,header.roundOff,header.advanceAdjusted]);

  const handleSubmitForm = async () => {
    if(!header.vendorInvoiceNo.trim()) return alert("Vendor invoice number is required.");
    if(invoiceType==="po_linked"){if(!header.poNo) return alert("Select a PO."); if(!header.grnNos.length) return alert("Select at least one GRN.");}
    else{if(!header.directGrcNo) return alert("Select a GRC."); if(!header.grnNos.length) return alert("Select at least one GRN.");}
    if(!items.some(i=>clamp0(i.invoicedQty)>0)) return alert("Enter invoiced qty for at least one item.");
    const payload={
      ...(initialInv?.id?{id:initialInv.id}:{}),
      invoiceType,...header,
      ...(invoiceType==="direct_grc"?{poNo:"",po_id:null}:{directGrcNo:"",directGrc_id:null}),
      items:items.map(it=>({barcode:it.barcode,description:it.description,grnQty:clamp0(it.grnQty),invoicedQty:clamp0(it.invoicedQty),rate:clamp0(it.rate),poRate:clamp0(it.poRate),taxPct:clamp0(it.taxPct),discountPct:clamp0(it.discountPct),taxAmount:0,discountAmount:0,lineAmount:0,varianceFlag:"",remarks:it.remarks||""})),
    };
    setSaving(true); await onSave(payload); setSaving(false);
  };

  const curGrns     = invoiceType==="direct_grc"?directGrns:poGrns;
  const curAllGrns  = invoiceType==="direct_grc"?allDirectGrns:allPoGrns;
  const curGrnLoad  = invoiceType==="direct_grc"?directGrnLoading:poGrnLoading;
  const srcSelected = invoiceType==="direct_grc"?!!header.directGrcNo:!!header.poNo;
  const grnCounts   = useMemo(()=>{const c={};curAllGrns.forEach(g=>{c[g.status]=(c[g.status]||0)+1;});return c;},[curAllGrns]);

  const DropDown = ({open,setOpen,search,setSearch,items:dItems,selectedKey,onSelect,placeholder,renderItem,keyFn,labelFn}) => (
    <div style={{position:"relative"}}>
      <input className="inp" value={search} onChange={e=>{setSearch(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} placeholder={placeholder} autoComplete="off"/>
      {open&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 12px 32px rgba(0,0,0,.12)",maxHeight:240,overflowY:"auto",marginTop:2}}>
          {dItems.filter(it=>!search||labelFn(it).toLowerCase().includes(search.toLowerCase())).length===0
            ?<div style={{padding:"12px 14px",fontSize:12,color:C.muted}}>No results found.</div>
            :dItems.filter(it=>!search||labelFn(it).toLowerCase().includes(search.toLowerCase())).map(it=>(
              <div key={keyFn(it)} onClick={()=>{setSearch(labelFn(it));setOpen(false);onSelect(keyFn(it));}}
                style={{padding:"9px 13px",cursor:"pointer",fontSize:12,borderBottom:`1px solid #F5F2EC`,
                  background:selectedKey===keyFn(it)?C.accentLight:"#fff"}}
                onMouseEnter={e=>e.currentTarget.style.background="#F5F2EC"}
                onMouseLeave={e=>e.currentTarget.style.background=selectedKey===keyFn(it)?C.accentLight:"#fff"}>
                {renderItem(it)}
              </div>
            ))}
        </div>
      )}
      {open&&<div style={{position:"fixed",inset:0,zIndex:199}} onClick={()=>setOpen(false)}/>}
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",height:"90vh",background:C.bg,fontFamily:"'DM Sans',sans-serif"}}>
      {/* Header bar */}
      <div style={{padding:"16px 24px",background:C.card,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:300,fontFamily:"'Crimson Pro',serif",color:C.text}}>{initialInv?"Edit Invoice":"New Purchase Invoice"}</h2>
          <p style={{fontSize:11,color:C.muted,marginTop:2}}>{invoiceType==="direct_grc"?"Direct GRC → GRN → Verify → Payment → Save":"PO → GRN → Verify → Payment → Save"}</p>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:20}}>✕</button>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>

        {/* Type toggle */}
        {!initialInv&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".7px",marginBottom:8}}>Invoice Type</div>
            <div className="type-toggle">
              <button className={`type-btn ${invoiceType==="po_linked"?"type-btn-po":"type-btn-off"}`} onClick={()=>switchType("po_linked")}>
                <div style={{fontSize:16,marginBottom:3}}>📋</div>
                <div style={{fontWeight:700}}>PO-Linked Invoice</div>
                <div style={{fontSize:11,fontWeight:400,opacity:.7,marginTop:2}}>Purchase Order → GRC → GRN → Invoice</div>
              </button>
              <button className={`type-btn ${invoiceType==="direct_grc"?"type-btn-direct":"type-btn-off"}`} onClick={()=>switchType("direct_grc")}>
                <div style={{fontSize:16,marginBottom:3}}>🔗</div>
                <div style={{fontWeight:700}}>Direct GRC Invoice</div>
                <div style={{fontSize:11,fontWeight:400,opacity:.7,marginTop:2}}>Walk-in Supplier → Direct GRC → GRN → Invoice</div>
              </button>
            </div>
          </div>
        )}

        {/* Info banner */}
        <div style={{marginBottom:14,padding:"10px 14px",borderRadius:8,fontSize:12,
          background:invoiceType==="direct_grc"?C.directBg:C.poBg,
          color:invoiceType==="direct_grc"?C.directText:C.poText,
          border:`1px solid ${invoiceType==="direct_grc"?C.directBorder:C.poBorder}`}}>
          {invoiceType==="direct_grc"
            ?"ℹ Direct GRC Invoice: No PO required. Walk-in vendors may not be registered — add email/phone below so they can be notified."
            :"ℹ PO-Linked Invoice: Full 3-way match (PO ↔ GRN ↔ Invoice). Registered vendor receives portal + email notification automatically."}
        </div>

        {/* Invoice Header */}
        <FCard title="Invoice Header">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <div style={{display:"flex",flexDirection:"column",gap:13}}>
              <FField label="Vendor Invoice No" req><input className="inp" value={header.vendorInvoiceNo} onChange={e=>setH("vendorInvoiceNo",e.target.value)} placeholder="Vendor's invoice number"/></FField>
              <FField label="Invoice Date" req><input className="inp" type="date" value={header.invoiceDate} onChange={e=>setH("invoiceDate",e.target.value)}/></FField>
              <FField label="Received Date"><input className="inp" type="date" value={header.receivedDate} onChange={e=>setH("receivedDate",e.target.value)}/></FField>
              <FField label="Due Date"><input className="inp" type="date" value={header.dueDate} onChange={e=>setH("dueDate",e.target.value)}/></FField>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:13}}>
              {/* PO selector */}
              {invoiceType==="po_linked"&&(
                <FField label="Purchase Order" req>
                  <DropDown open={poOpen} setOpen={setPoOpen} search={poSearch} setSearch={setPoSearch}
                    items={pos} selectedKey={header.poNo} onSelect={handlePOSelect} placeholder="Search PO number…"
                    keyFn={p=>p.orderNo} labelFn={p=>p.orderNo}
                    renderItem={p=>(
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <span style={{fontFamily:"'DM Mono',monospace",fontWeight:500,color:C.accent}}>{p.orderNo}</span>
                        <span style={{color:C.muted,fontSize:11}}>{p.vendorName}</span>
                      </div>
                    )}/>
                </FField>
              )}
              {/* GRC selector */}
              {invoiceType==="direct_grc"&&(
                <FField label="Source GRC (Direct)" req>
                  {grcLoading?<div style={{padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.muted,display:"flex",gap:8,alignItems:"center"}}><Spinner/>Loading GRCs…</div>:(
                    <DropDown open={grcOpen} setOpen={setGrcOpen} search={grcSearch} setSearch={setGrcSearch}
                      items={grcs} selectedKey={header.directGrcNo} onSelect={handleGRCSelect} placeholder="Search GRC number…"
                      keyFn={g=>g.grcNo} labelFn={g=>g.grcNo}
                      renderItem={g=>(
                        <div style={{display:"flex",justifyContent:"space-between"}}>
                          <span style={{fontFamily:"'DM Mono',monospace",fontWeight:500,color:C.directText}}>{g.grcNo}</span>
                          <span style={{color:C.muted,fontSize:11}}>{g.vendorName}</span>
                        </div>
                      )}/>
                  )}
                </FField>
              )}

              <FField label="Vendor (auto-filled)"><input className="inp inp-ro" readOnly value={header.vendorName} placeholder={invoiceType==="direct_grc"?"Filled from GRC":"Filled from PO"}/></FField>

              {/* Contact fields for direct GRC (walk-in) */}
              {invoiceType==="direct_grc"&&(
                <div style={{background:"#FFF7ED",border:"1px solid #FDE68A",borderRadius:8,padding:"10px 12px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#92400E",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Vendor Contact (for notification)</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <FField label="Email"><input className="inp" type="email" value={header.vendorEmail} onChange={e=>setH("vendorEmail",e.target.value)} placeholder="vendor@example.com (if not registered)"/></FField>
                    <FField label="Phone / WhatsApp"><input className="inp" type="tel" value={header.vendorPhone} onChange={e=>setH("vendorPhone",e.target.value)} placeholder="+91 98765 43210 (fallback)"/></FField>
                    {!header.vendorEmail&&!header.vendorPhone&&<div style={{fontSize:11,color:"#C2410C"}}>⚠ Without contact info, you'll need to notify manually after saving.</div>}
                  </div>
                </div>
              )}

              {/* GRN selector */}
              <FField label="Select Posted GRNs" req>
                {!srcSelected?<div style={{padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.muted}}>{invoiceType==="direct_grc"?"Select a GRC first":"Select a PO first"}</div>
                :curGrnLoad?<div style={{padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.muted,display:"flex",gap:8,alignItems:"center"}}><Spinner/>Loading GRNs…</div>
                :curGrns.length===0?(
                  <div style={{padding:"10px 12px",borderRadius:7,fontSize:12,
                    color:curAllGrns.length>0?"#C2410C":"#991B1B",
                    background:curAllGrns.length>0?"#FFF7ED":"#FEF2F2",
                    border:`1px solid ${curAllGrns.length>0?"#FED7AA":"#FECACA"}`}}>
                    {curAllGrns.length>0
                      ?<><b>⚠ {curAllGrns.length} GRN(s) not yet Posted</b><div style={{fontSize:11,marginTop:3}}>Status: {Object.entries(grnCounts).map(([s,c])=>`${s}(${c})`).join(", ")}</div></>
                      :<div><b>No GRNs found.</b> {invoiceType==="direct_grc"?"Create and Post a GRN for this GRC first.":"Flow: PO Approved → GRC → GRN Posted."}</div>}
                  </div>
                ):(
                  <div style={{border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>
                    {curGrns.map(g=>(
                      <label key={g.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",background:header.grnNos.includes(g.grnNo)?C.accentLight:"#fff",fontSize:12}}>
                        <input type="checkbox" checked={header.grnNos.includes(g.grnNo)} onChange={()=>handleGRNToggle(g.grnNo)} style={{accentColor:C.accent}}/>
                        <span style={{fontFamily:"'DM Mono',monospace",color:C.accent,fontWeight:500}}>{g.grnNo}</span>
                        <span style={{color:C.muted}}>Qty: {n0(g.totalInwardQty).toFixed(3)} · ₹{money(g.totalAmount)}</span>
                      </label>
                    ))}
                  </div>
                )}
                {curGrns.length>0&&curAllGrns.length>curGrns.length&&(
                  <div style={{marginTop:5,padding:"5px 10px",borderRadius:5,background:"#FFF7ED",border:"1px solid #FED7AA",fontSize:11,color:"#92400E"}}>
                    ℹ {curAllGrns.length-curGrns.length} GRN(s) not Posted are hidden.
                  </div>
                )}
              </FField>
            </div>
          </div>
        </FCard>

        {/* Payment Details */}
        <FCard title="Payment Details" sub="Payment method, banking details & terms">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <div style={{display:"flex",flexDirection:"column",gap:13}}>
              <FField label="Payment Terms"><select className="inp" value={header.paymentTerms} onChange={e=>setH("paymentTerms",e.target.value)}>{PAYMENT_TERMS.map(t=><option key={t}>{t}</option>)}</select></FField>
              <FField label="Payment Method">
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  {PAYMENT_MODES.map(m=>(
                    <button key={m.value} type="button" onClick={()=>setH("paymentMode",m.value)}
                      style={{padding:"7px 8px",borderRadius:7,fontSize:11,cursor:"pointer",
                        border:`1.5px solid ${header.paymentMode===m.value?C.accent:C.border}`,
                        background:header.paymentMode===m.value?C.accentLight:"#fff",
                        color:header.paymentMode===m.value?C.accent:C.muted,
                        fontFamily:"'DM Sans',sans-serif",fontWeight:600,textAlign:"center"}}>
                      <div style={{fontSize:14,marginBottom:2}}>{m.icon}</div>
                      <div style={{fontSize:10}}>{m.label}</div>
                    </button>
                  ))}
                </div>
              </FField>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:13}}>
              {needsBank&&<><FField label="Bank Name"><input className="inp" value={header.bankName} onChange={e=>setH("bankName",e.target.value)} placeholder="e.g. HDFC Bank"/></FField><FField label="Account No"><input className="inp" value={header.accountNo} onChange={e=>setH("accountNo",e.target.value)} style={{fontFamily:"'DM Mono',monospace"}}/></FField><FField label="IFSC Code"><input className="inp" value={header.ifscCode} onChange={e=>setH("ifscCode",e.target.value.toUpperCase())} style={{fontFamily:"'DM Mono',monospace"}}/></FField></>}
              {needsCheque&&<FField label="Cheque No"><input className="inp" value={header.chequeNo} onChange={e=>setH("chequeNo",e.target.value)} style={{fontFamily:"'DM Mono',monospace"}}/></FField>}
              {needsPDC&&<FField label="PDC Date"><input className="inp" type="date" value={header.chequeDate} onChange={e=>setH("chequeDate",e.target.value)}/></FField>}
              {needsUPI&&<FField label="UPI ID"><input className="inp" value={header.upiId} onChange={e=>setH("upiId",e.target.value)} placeholder="vendor@upi"/></FField>}
              {header.paymentMode==="DD"&&<FField label="DD No"><input className="inp" value={header.ddNo} onChange={e=>setH("ddNo",e.target.value)} style={{fontFamily:"'DM Mono',monospace"}}/></FField>}
              {header.paymentMode==="Advance"&&<FField label="Advance Adjusted (₹)"><input className="inp" type="number" value={header.advanceAdjusted} onChange={e=>setH("advanceAdjusted",e.target.value)} style={{fontFamily:"'DM Mono',monospace"}}/></FField>}
              <FField label="Narration"><textarea className="inp" rows={3} value={header.narration} onChange={e=>setH("narration",e.target.value)} placeholder="Internal notes…" style={{resize:"vertical"}}/></FField>
            </div>
          </div>
        </FCard>

        {/* Line Items */}
        <FCard title="Line Items"
          sub={invoiceType==="direct_grc"?"GRN Qty vs Invoiced Qty (no PO rate comparison)":"GRN Qty vs Invoiced Qty · Rate vs PO Rate — variances flagged"}
          right={<button className="btn" onClick={()=>setItems(p=>[...p,EMPTY_ITEM()])} style={{padding:"6px 12px",background:C.accentLight,color:C.accent,border:`1px solid ${C.accentBorder}`,fontSize:11}}>+ Row</button>}>
          <div style={{overflowX:"auto",border:`1px solid ${C.border}`,borderRadius:7}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:980}}>
              <thead style={{background:"#F0EDE6"}}>
                <tr>{["#","Barcode","Description","GRN Qty","Inv Qty","Rate ₹",invoiceType==="po_linked"?"PO Rate":"GRN Rate","Tax %","Disc %","Remarks",""].map(h=>(
                  <th key={h} style={{padding:"8px 10px",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".5px",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {items.map((it,idx)=>{
                  const qtyOver = clamp0(it.invoicedQty)>clamp0(it.grnQty)+0.001&&clamp0(it.grnQty)>0;
                  const rateVar = invoiceType==="po_linked"&&clamp0(it.poRate)>0&&Math.abs(clamp0(it.rate)-clamp0(it.poRate))>0.01;
                  return(
                    <tr key={idx} style={{borderBottom:`1px solid ${C.border}`,background:(qtyOver||rateVar)?"#FFFBEB":idx%2===0?"#fff":"#FDFCF9"}}>
                      <td style={{padding:"5px 10px",fontSize:11,color:C.muted,fontWeight:600}}>{idx+1}</td>
                      <td style={{padding:"4px 5px"}}><input className="cell" value={it.barcode} onChange={e=>updateItem(idx,"barcode",e.target.value)} style={{width:100}}/></td>
                      <td style={{padding:"4px 5px"}}><input className="cell" value={it.description} onChange={e=>updateItem(idx,"description",e.target.value)} style={{width:150,fontFamily:"'DM Sans',sans-serif"}}/></td>
                      <td style={{padding:"5px 10px",fontFamily:"'DM Mono',monospace",fontSize:12,color:"#0369A1"}}>{n0(it.grnQty).toFixed(3)}</td>
                      <td style={{padding:"4px 5px"}}><input className="cell" type="number" min="0" value={it.invoicedQty} onChange={e=>updateItem(idx,"invoicedQty",e.target.value)} style={{width:80,textAlign:"right",borderColor:qtyOver?"#B91C1C":undefined}}/></td>
                      <td style={{padding:"4px 5px"}}><input className="cell" type="number" min="0" value={it.rate} onChange={e=>updateItem(idx,"rate",e.target.value)} style={{width:90,textAlign:"right",borderColor:rateVar?"#EA580C":undefined}}/></td>
                      <td style={{padding:"5px 10px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.muted}}>{invoiceType==="po_linked"?n0(it.poRate).toFixed(2):n0(it.rate).toFixed(2)}</td>
                      <td style={{padding:"4px 5px"}}><input className="cell" type="number" min="0" max="100" value={it.taxPct} onChange={e=>updateItem(idx,"taxPct",e.target.value)} style={{width:60,textAlign:"right"}}/></td>
                      <td style={{padding:"4px 5px"}}><input className="cell" type="number" min="0" max="100" value={it.discountPct} onChange={e=>updateItem(idx,"discountPct",e.target.value)} style={{width:60,textAlign:"right"}}/></td>
                      <td style={{padding:"4px 5px"}}><input className="cell" value={it.remarks||""} onChange={e=>updateItem(idx,"remarks",e.target.value)} style={{width:100,fontFamily:"'DM Sans',sans-serif"}}/></td>
                      <td style={{padding:"4px 8px"}}>
                        {(qtyOver||rateVar)&&<span style={{fontSize:9,background:"#FEF3C7",color:"#92400E",border:"1px solid #FDE68A",borderRadius:4,padding:"2px 5px",fontWeight:700,marginRight:4}}>⚠</span>}
                        <button onClick={()=>setItems(p=>p.filter((_,i)=>i!==idx))} disabled={items.length===1}
                          style={{background:"none",border:"none",cursor:"pointer",color:"#B91C1C",fontSize:15,opacity:items.length===1?0.2:1}}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FCard>

        {/* Charges + Summary */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <FCard title="Additional Charges">
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[["Freight Charges","freightCharges"],["Other Charges","otherCharges"],["Round Off","roundOff"],["Advance Adjusted","advanceAdjusted"]].map(([label,key])=>(
                <div key={key} style={{display:"grid",gridTemplateColumns:"1fr 1fr",alignItems:"center",gap:10}}>
                  <span style={{fontSize:12,color:C.muted}}>{label}</span>
                  <input className="inp" type="number" value={header[key]} onChange={e=>setH(key,e.target.value)} style={{textAlign:"right",fontFamily:"'DM Mono',monospace"}}/>
                </div>
              ))}
            </div>
          </FCard>
          <FCard title="Preview Totals" sub="Backend recomputes on save">
            {[["Subtotal",totals.subtotal,C.text],["– Discount",-totals.totalDiscount,C.green],["+ Tax",totals.totalTax,C.blue],["+ Freight",clamp0(header.freightCharges),C.muted],["+ Other",clamp0(header.otherCharges),C.muted],["Round Off",clamp0(header.roundOff),C.muted],["– Advance",-clamp0(header.advanceAdjusted),"#7C3AED"]].map(([label,val,color])=>(
              <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}>
                <span style={{color:C.muted}}>{label}</span>
                <span style={{fontFamily:"'DM Mono',monospace",color}}>{val<0?"-":""}₹{money(Math.abs(val))}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",fontSize:17,fontWeight:300,fontFamily:"'Crimson Pro',serif"}}>
              <span>Invoice Total</span>
              <span style={{fontFamily:"'DM Mono',monospace",color:C.accent,fontWeight:500}}>₹{money(totals.invoiceTotal)}</span>
            </div>
          </FCard>
        </div>
      </div>

      {/* Footer */}
      <div style={{padding:"14px 24px",background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <TypeBadge t={invoiceType}/>
          {invoiceType==="direct_grc"&&!header.vendorEmail&&!header.vendorPhone&&(
            <span style={{fontSize:11,color:"#92400E",fontFamily:"'DM Sans',sans-serif"}}>⚠ No contact info — notification will be manual after save</span>
          )}
        </div>
        <div style={{display:"flex",gap:10}}>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <button className="btn" onClick={handleSubmitForm} disabled={saving}
            style={{padding:"10px 24px",background:saving?"#D4CEBF":C.accent,color:"#fff",fontSize:13,boxShadow:saving?"none":"0 4px 14px rgba(139,69,19,.3)"}}>
            {saving?"Saving…":initialInv?"Update Invoice":"Save & Notify Vendor"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAYMENT FORM
═══════════════════════════════════════════════════════════════════ */
function PaymentForm({ inv, onClose, showToast }) {
  const [form,setForm]=useState({amount:n0(inv.balanceDue).toFixed(2),paymentDate:today(),paymentMode:inv.paymentMode||"NEFT",referenceNo:"",bankName:inv.bankName||"",accountNo:inv.accountNo||"",ifscCode:inv.ifscCode||"",chequeNo:"",chequeDate:"",upiId:inv.upiId||"",ddNo:"",remarks:"",isAdvance:false,scheduleId:""});
  const [saving,setSaving]=useState(false);
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));
  const needsBank=["NEFT","RTGS","Cheque","PostDatedCheque","DD"].includes(form.paymentMode);
  const needsCheque=["Cheque","PostDatedCheque"].includes(form.paymentMode);
  const needsPDC=form.paymentMode==="PostDatedCheque";
  const needsUPI=form.paymentMode==="UPI";
  const schedule=inv.paymentSchedule||[];

  const pay=async()=>{
    const amt=clamp0(form.amount); if(amt<=0) return showToast("Enter a valid amount","err");
    setSaving(true);
    try{const res=await authFetch(`${PI_API}/${inv.id}/pay`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,amount:amt})});
      const d=await res.json(); if(!res.ok) throw new Error(d.detail); showToast(d.message||"Payment recorded"); onClose();}
    catch(e){showToast(e.message,"err");}finally{setSaving(false);}
  };

  return(
    <div style={{background:"#fff",borderRadius:14,padding:28,width:"min(540px,94vw)",fontFamily:"'DM Sans',sans-serif",maxHeight:"90vh",overflowY:"auto"}}>
      <h3 style={{margin:"0 0 4px",fontFamily:"'Crimson Pro',serif",fontSize:20,fontWeight:300}}>Record Payment</h3>
      <p style={{margin:"0 0 4px",fontSize:12,color:C.muted}}>{inv.invoiceNo} — {inv.vendorName}</p>
      <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
        <span style={{fontSize:12}}>Total: <b style={{fontFamily:"'DM Mono',monospace",color:C.accent}}>₹{money(inv.invoiceTotal)}</b></span>
        <span style={{fontSize:12}}>Paid: <b style={{fontFamily:"'DM Mono',monospace",color:C.green}}>₹{money(inv.paidAmount)}</b></span>
        <span style={{fontSize:12}}>Balance: <b style={{fontFamily:"'DM Mono',monospace",color:C.red}}>₹{money(inv.balanceDue)}</b></span>
        <VendorBadge isRegistered={inv.isRegisteredVendor}/>
      </div>
      {schedule.length>0&&(
        <div style={{marginBottom:16,padding:12,background:"#F6F4EF",borderRadius:8,border:`1px solid ${C.border}`}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".6px",marginBottom:8}}>Payment Schedule</div>
          {schedule.map((s,i)=>(
            <label key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",fontSize:12,cursor:"pointer",borderBottom:i<schedule.length-1?`1px solid ${C.border}`:"none"}}>
              <input type="radio" name="scheduleId" value={s.scheduleId||i} checked={form.scheduleId===(s.scheduleId||String(i))} onChange={()=>{setF("scheduleId",s.scheduleId||String(i));setF("amount",n0(s.amount).toFixed(2));}} style={{accentColor:C.accent}}/>
              <span style={{fontFamily:"'DM Mono',monospace"}}>₹{money(s.amount)}</span>
              <span style={{color:C.muted}}>{fmtDate(s.dueDate)}</span>
              <span style={{padding:"1px 6px",borderRadius:8,fontSize:10,fontWeight:700,background:s.status==="Paid"?"#F0FDF4":"#FFF7ED",color:s.status==="Paid"?"#166534":"#C2410C"}}>{s.status}</span>
            </label>
          ))}
        </div>
      )}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:6}}>Payment Method</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
          {PAYMENT_MODES.map(m=>(
            <button key={m.value} type="button" onClick={()=>setF("paymentMode",m.value)}
              style={{padding:"7px 4px",borderRadius:7,fontSize:10,cursor:"pointer",border:`1.5px solid ${form.paymentMode===m.value?C.accent:C.border}`,background:form.paymentMode===m.value?C.accentLight:"#fff",color:form.paymentMode===m.value?C.accent:C.muted,fontFamily:"'DM Sans',sans-serif",fontWeight:600,textAlign:"center"}}>
              <div style={{fontSize:13,marginBottom:1}}>{m.icon}</div><div>{m.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:5}}>Amount (₹) *</div><input className="inp" type="number" value={form.amount} onChange={e=>setF("amount",e.target.value)} style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:600}}/></div>
          <div><div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:5}}>Payment Date *</div><input className="inp" type="date" value={form.paymentDate} onChange={e=>setF("paymentDate",e.target.value)}/></div>
        </div>
        {needsBank&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>{[["Bank","bankName"],["Account No","accountNo"],["IFSC","ifscCode"]].map(([l,k])=>(<div key={k}><div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{l}</div><input className="inp" value={form[k]} onChange={e=>setF(k,e.target.value)} style={{fontFamily:"'DM Mono',monospace",fontSize:12}}/></div>))}</div>}
        {needsCheque&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>Cheque No</div><input className="inp" value={form.chequeNo} onChange={e=>setF("chequeNo",e.target.value)} style={{fontFamily:"'DM Mono',monospace"}}/></div>{needsPDC&&<div><div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>PDC Date</div><input className="inp" type="date" value={form.chequeDate} onChange={e=>setF("chequeDate",e.target.value)}/></div>}</div>}
        {needsUPI&&<div><div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>UPI ID</div><input className="inp" value={form.upiId} onChange={e=>setF("upiId",e.target.value)} placeholder="vendor@upi"/></div>}
        {form.paymentMode==="DD"&&<div><div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>DD Number</div><input className="inp" value={form.ddNo} onChange={e=>setF("ddNo",e.target.value)} style={{fontFamily:"'DM Mono',monospace"}}/></div>}
        {!["Net30","Net45","Net60","Advance"].includes(form.paymentMode)&&<div><div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>Reference / Transaction No</div><input className="inp" value={form.referenceNo} onChange={e=>setF("referenceNo",e.target.value)} placeholder="UTR / Txn ID" style={{fontFamily:"'DM Mono',monospace"}}/></div>}
        <div><div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>Remarks</div><input className="inp" value={form.remarks} onChange={e=>setF("remarks",e.target.value)} placeholder="Optional notes"/></div>
        {needsPDC&&<div style={{padding:"10px 13px",borderRadius:7,background:"#FFF7ED",border:"1px solid #FED7AA",fontSize:12,color:"#C2410C"}}>📅 <b>Post-Dated Cheque:</b> Payment registered now. Mark cleared when cheque actually clears.</div>}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <button className="btn" onClick={pay} disabled={saving} style={{padding:"10px 22px",background:"#15803D",color:"#fff",fontSize:13}}>{saving?"Recording…":`Record ₹${money(form.amount)}`}</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   INVOICE VIEW MODAL — with Notify tab
═══════════════════════════════════════════════════════════════════ */
function InvoiceViewModal({ inv:initialInv, onClose, showToast, onRefresh }) {
  const [inv,setInv]=useState(initialInv);
  const [tab,setTab]=useState("details");
  const [queryText,setQueryText]=useState({subject:"",description:"",queryType:"General"});
  const [replyText,setReplyText]=useState({});
  const [submitting,setSubmitting]=useState(false);
  const [showNotify,setShowNotify]=useState(false);

  const match=inv.threeWayMatch||{};
  const queries=inv.vendorQueries||[];
  const payments=inv.payments||[];
  const schedule=inv.paymentSchedule||[];
  const isDirect=inv.invoiceType==="direct_grc";

  const refresh=async()=>{ try{const r=await authFetch(`${PI_API}/${inv.id}`);const d=await r.json();setInv(d);onRefresh();}catch{} };

  const raiseQuery=async()=>{
    if(!queryText.subject.trim()) return showToast("Subject required","err");
    setSubmitting(true);
    try{const r=await authFetch(`${PI_API}/${inv.id}/vendor-query`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(queryText)});
      const d=await r.json();if(!r.ok)throw new Error(d.detail);showToast("Query raised");setQueryText({subject:"",description:"",queryType:"General"});refresh();}
    catch(e){showToast(e.message,"err");}finally{setSubmitting(false);}
  };
  const sendReply=async(qid)=>{
    const reply=replyText[qid]?.trim(); if(!reply) return showToast("Enter a reply","err");
    try{const r=await authFetch(`${PI_API}/${inv.id}/vendor-query/${qid}/reply`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reply})});
      const d=await r.json();if(!r.ok)throw new Error(d.detail);showToast("Reply sent");setReplyText(p=>({...p,[qid]:""}));refresh();}
    catch(e){showToast(e.message,"err");}
  };
  const resolveQuery=async(qid)=>{ try{await authFetch(`${PI_API}/${inv.id}/vendor-query/${qid}/resolve`,{method:"POST"});showToast("Query resolved");refresh();}catch(e){showToast(e.message,"err");} };

  const TABS=[
    {id:"details",  label:"📋 Details"},
    {id:"items",    label:"📦 Line Items"},
    {id:"payment",  label:"💳 Payments"},
    {id:"queries",  label:`❓ Queries${queries.filter(q=>q.status==="Open").length>0?` (${queries.filter(q=>q.status==="Open").length})`:""}` },
    {id:"notify",   label:"🔔 Notify"},
    {id:"timeline", label:"📜 Timeline"},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"90vh",background:C.bg,fontFamily:"'DM Sans',sans-serif"}}>
      {/* Modal header */}
      <div style={{padding:"16px 24px",background:C.card,borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <h2 style={{margin:0,fontSize:20,fontWeight:300,fontFamily:"'Crimson Pro',serif",color:C.accent}}>{inv.invoiceNo}</h2>
            <TypeBadge t={inv.invoiceType}/><VendorBadge isRegistered={inv.isRegisteredVendor}/>
            <StatusPill s={inv.status}/><PayStatusPill s={inv.paymentStatus}/><MatchBadge match={inv.threeWayMatch}/>
          </div>
          <p style={{margin:"4px 0 0",fontSize:11,color:C.muted}}>
            Vendor Inv: {inv.vendorInvoiceNo}
            {isDirect?` · GRC: ${inv.directGrcNo||"—"}`:` · PO: ${inv.poNo}`}
            {" · GRNs: "}{(inv.grnNos||[]).join(", ")||"—"}
            {inv.vendorEmail&&<span> · 📧 {inv.vendorEmail}</span>}
            {!inv.isRegisteredVendor&&inv.vendorPhone&&<span> · 📱 {inv.vendorPhone}</span>}
          </p>
        </div>
        <button className="btn" onClick={onClose} style={{padding:"7px 14px",background:C.card,color:C.muted,border:`1px solid ${C.border}`,fontSize:12}}>Close</button>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.border}`,background:C.card,padding:"0 24px",overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} className="tab-btn" onClick={()=>setTab(t.id)}
            style={{borderRadius:0,borderBottom:tab===t.id?`2px solid ${C.accent}`:"2px solid transparent",
              color:tab===t.id?C.accent:C.muted,fontWeight:tab===t.id?600:400,padding:"10px 16px"}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>

        {/* ── DETAILS ── */}
        {tab==="details"&&(
          <>
            {/* Match banner */}
            <div style={{background:match.matched?"#F0FDF4":"#FEF2F2",border:`1px solid ${match.matched?"#BBF7D0":"#FECACA"}`,borderRadius:10,padding:"14px 18px",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                  {isDirect
                    ?[["GRN Match",match.grn_match],["Rate Consistent",match.rate_match]].map(([l,ok])=>(<span key={l} style={{fontSize:12,fontWeight:700,color:ok?"#166534":"#991B1B"}}>{ok?"✓":"✗"} {l}</span>))
                    :[["PO Match",match.po_match],["GRN Match",match.grn_match],["Rate Match",match.rate_match]].map(([l,ok])=>(<span key={l} style={{fontSize:12,fontWeight:700,color:ok?"#166534":"#991B1B"}}>{ok?"✓":"✗"} {l}</span>))}
                </div>
                {match.variance_amount>0&&<span style={{fontSize:12,color:C.muted}}>Variance: ₹{money(match.variance_amount)}</span>}
              </div>
              {match.notes&&<div style={{fontSize:12,marginTop:6,color:match.matched?"#166534":"#991B1B"}}>{match.notes}</div>}
              {isDirect&&<div style={{fontSize:11,marginTop:4,color:C.muted}}>Direct GRC — PO match not applicable.</div>}
            </div>

            {/* Detail grid */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
              {[["Status","STATUS"],["Pay Status","PAYMENT"],["Vendor Type","VTYPE"],["Invoice Type","ITYPE"],
                ["Vendor",inv.vendorName],["Invoice Date",fmtDate(inv.invoiceDate)],["Due Date",fmtDate(inv.dueDate)],
                isDirect?["Source GRC",inv.directGrcNo||"—"]:["Source PO",inv.poNo||"—"],
                ["Payment Mode",inv.paymentMode],["Invoice Total",`₹${money(inv.invoiceTotal)}`],["Paid",`₹${money(inv.paidAmount)}`],["Balance Due",`₹${money(inv.balanceDue)}`],
              ].map(([k,v])=>(
                <div key={k} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px"}}>
                  <div style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".6px",marginBottom:4}}>{k}</div>
                  {v==="STATUS"?<StatusPill s={inv.status}/>:v==="PAYMENT"?<PayStatusPill s={inv.paymentStatus}/>:v==="VTYPE"?<VendorBadge isRegistered={inv.isRegisteredVendor}/>:v==="ITYPE"?<TypeBadge t={inv.invoiceType}/>:<div style={{fontSize:12,fontWeight:600}}>{v||"—"}</div>}
                </div>
              ))}
            </div>

            {/* Vendor notification panel */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 18px",marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".6px",marginBottom:10}}>Vendor Notification Status</div>
              <div style={{display:"flex",gap:20,flexWrap:"wrap",fontSize:12,alignItems:"center"}}>
                <div><span style={{color:C.muted}}>Notified: </span><b style={{color:inv.vendorNotified?C.green:C.red}}>{inv.vendorNotified?"✓ Yes":"✗ No"}</b>{inv.vendorNotified&&<span style={{color:C.muted,marginLeft:6}}>{fmtDate(inv.vendorNotifiedAt?.slice(0,10))}</span>}</div>
                <div><span style={{color:C.muted}}>Acknowledged: </span><b style={{color:inv.vendorAcknowledged?C.green:C.muted}}>{inv.vendorAcknowledged?"✓ Yes":"—"}</b></div>
                {inv.isRegisteredVendor?<div style={{color:C.green,fontWeight:700}}>🖥️ Portal notifications active</div>:<>
                  {inv.vendorEmail&&<div>📧 {inv.vendorEmail}</div>}
                  {inv.vendorPhone&&<div>📱 {inv.vendorPhone}</div>}
                  {!inv.vendorEmail&&!inv.vendorPhone&&<div style={{color:C.red,fontWeight:700}}>⚠ No contact info — go to Notify tab</div>}
                </>}
                <button className="btn" onClick={()=>setTab("notify")}
                  style={{padding:"6px 14px",fontSize:11,background:"#2563EB",color:"#fff",marginLeft:"auto"}}>
                  🔔 Send Notification
                </button>
              </div>
            </div>

            {/* Financial breakdown */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 18px"}}>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".6px",marginBottom:10}}>Financial Breakdown</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,fontSize:12}}>
                {[["Subtotal",inv.subtotal],["Discount",inv.totalDiscount],["Tax",inv.totalTax],["Freight",inv.freightCharges],["Other",inv.otherCharges],["Round Off",inv.roundOff]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",paddingRight:12}}>
                    <span style={{color:C.muted}}>{k}</span>
                    <span style={{fontFamily:"'DM Mono',monospace"}}>₹{money(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── LINE ITEMS ── */}
        {tab==="items"&&Array.isArray(inv.items)&&(
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
                <thead><tr style={{background:"#F0EDE6",borderBottom:`1px solid ${C.border}`}}>
                  {["#","Barcode","Description","GRN Qty","Inv Qty","Rate","Ref Rate","Tax","Disc","Line Amt","Flag"].map(h=>(
                    <th key={h} style={{padding:"9px 12px",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".5px",textAlign:"left"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {inv.items.map((it,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:it.varianceFlag?"#FFFBEB":i%2===0?"#fff":C.surface}}>
                      <td style={{padding:"9px 12px",fontSize:11,color:C.muted}}>{i+1}</td>
                      <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.accent}}>{it.barcode||"—"}</td>
                      <td style={{padding:"9px 12px",fontSize:12}}>{it.description||"—"}</td>
                      <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.blue}}>{n0(it.grnQty).toFixed(3)}</td>
                      <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:12}}>{n0(it.invoicedQty).toFixed(3)}</td>
                      <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:12}}>₹{money(it.rate)}</td>
                      <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.muted}}>₹{money(it.poRate)}</td>
                      <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.blue}}>₹{money(it.taxAmount)}</td>
                      <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.green}}>₹{money(it.discountAmount)}</td>
                      <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,color:C.accent}}>₹{money(it.lineAmount)}</td>
                      <td style={{padding:"9px 12px"}}>{it.varianceFlag&&<span style={{fontSize:10,background:"#FEF3C7",color:"#92400E",border:"1px solid #FDE68A",borderRadius:4,padding:"2px 6px",fontWeight:700}}>⚠ {it.varianceFlag}</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{background:"#F0EDE6",borderTop:`2px solid ${C.border}`}}>
                  <td colSpan={9} style={{padding:"10px 12px",fontSize:13,fontWeight:600,fontFamily:"'Crimson Pro',serif"}}>Invoice Total</td>
                  <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:600,color:C.accent}}>₹{money(inv.invoiceTotal)}</td>
                  <td/>
                </tr></tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── PAYMENTS ── */}
        {tab==="payment"&&(
          <>
            {schedule.length>0&&(
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,marginBottom:14,overflow:"hidden"}}>
                <div style={{padding:"10px 16px",background:"#F0EDE6",borderBottom:`1px solid ${C.border}`,fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".6px"}}>Payment Schedule</div>
                {schedule.map((s,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderBottom:i<schedule.length-1?`1px solid ${C.border}`:"none",fontSize:12}}>
                    <div style={{display:"flex",gap:16,alignItems:"center"}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontWeight:600}}>₹{money(s.amount)}</span>
                      <span style={{color:C.muted}}>{fmtDate(s.dueDate)}</span>
                      <span style={{color:C.muted,fontSize:11}}>{s.paymentMode}</span>
                    </div>
                    <span style={{padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,background:s.status==="Paid"?"#F0FDF4":"#FFF7ED",color:s.status==="Paid"?"#166534":"#C2410C",border:`1px solid ${s.status==="Paid"?"#BBF7D0":"#FED7AA"}`}}>{s.status}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"10px 16px",background:"#F0EDE6",borderBottom:`1px solid ${C.border}`,fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".6px"}}>Payment History</div>
              {payments.length===0?<div style={{padding:24,textAlign:"center",color:C.muted,fontSize:13}}>No payments recorded yet.</div>
                :payments.map((p,i)=>(
                  <div key={i} style={{padding:"12px 16px",borderBottom:i<payments.length-1?`1px solid ${C.border}`:"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,color:C.green,fontSize:14}}>₹{money(p.amount)}</span>
                        <span style={{fontSize:11,padding:"2px 7px",borderRadius:10,background:"#EFF6FF",color:"#1E40AF",fontWeight:700}}>{p.paymentMode}</span>
                        <span style={{color:C.muted,fontSize:12}}>{fmtDate(p.paymentDate)}</span>
                        {p.referenceNo&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.muted}}>#{p.referenceNo}</span>}
                      </div>
                      <span style={{fontSize:10,color:C.muted}}>{p.recordedAt?.slice(0,10)}</span>
                    </div>
                    {p.remarks&&<div style={{marginTop:3,fontSize:11,color:C.muted}}>{p.remarks}</div>}
                  </div>
                ))}
            </div>
          </>
        )}

        {/* ── QUERIES ── */}
        {tab==="queries"&&(
          <>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:12}}>Raise Query / Dispute</div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10,marginBottom:10}}>
                <div><div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>Subject *</div><input className="inp" value={queryText.subject} onChange={e=>setQueryText(p=>({...p,subject:e.target.value}))} placeholder="Brief subject"/></div>
                <div><div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>Type</div><select className="inp" value={queryText.queryType} onChange={e=>setQueryText(p=>({...p,queryType:e.target.value}))}>{["General","RateDispute","QtyDispute","TaxDispute","PaymentDispute","Other"].map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
              <div style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>Description</div><textarea className="inp" rows={3} value={queryText.description} onChange={e=>setQueryText(p=>({...p,description:e.target.value}))} placeholder="Describe the issue…" style={{resize:"vertical"}}/></div>
              <button className="btn" onClick={raiseQuery} disabled={submitting} style={{padding:"9px 18px",background:C.accent,color:"#fff",fontSize:12}}>{submitting?"Raising…":"Raise Query"}</button>
            </div>
            {queries.length===0?<div style={{textAlign:"center",padding:32,color:C.muted,fontSize:13}}>No queries yet.</div>
              :queries.map((q,i)=>(
                <div key={i} style={{background:C.card,border:`1px solid ${q.status==="Open"?"#BFDBFE":C.border}`,borderRadius:10,marginBottom:12,overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",background:q.status==="Open"?"#EFF6FF":"#F0EDE6",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <span style={{fontSize:12,fontWeight:700,color:q.status==="Open"?C.blue:C.text}}>{q.subject}</span>
                      <span style={{marginLeft:10,fontSize:10,padding:"2px 7px",borderRadius:8,fontWeight:700,background:q.status==="Open"?"#BFDBFE":q.status==="Resolved"?"#BBF7D0":"#E9D5FF",color:q.status==="Open"?"#1E40AF":q.status==="Resolved"?"#166534":"#5B21B6"}}>{q.status}</span>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:10,color:C.muted}}>{q.raisedAt?.slice(0,10)}</span>
                      {q.status!=="Resolved"&&<button className="btn" onClick={()=>resolveQuery(q.queryId)} style={{padding:"4px 10px",fontSize:11,background:"#F0FDF4",color:"#166534",border:"1px solid #BBF7D0"}}>✓ Resolve</button>}
                    </div>
                  </div>
                  {q.description&&<div style={{padding:"10px 16px",fontSize:13,color:C.text,borderBottom:`1px solid ${C.border}`}}>{q.description}</div>}
                  {(q.replies||[]).map((r,j)=>(
                    <div key={j} style={{padding:"8px 16px 8px 32px",background:j%2===0?"#FDFCF9":"#fff",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                        <span style={{fontWeight:600,color:C.blue,fontSize:11}}>{r.by||"AP Team"}</span>
                        <span style={{color:C.muted,fontSize:10}}>{r.repliedAt?.slice(0,10)}</span>
                      </div>
                      <div>{r.text}</div>
                    </div>
                  ))}
                  {q.status!=="Resolved"&&(
                    <div style={{padding:"10px 16px",display:"flex",gap:8}}>
                      <input className="inp" value={replyText[q.queryId]||""} onChange={e=>setReplyText(p=>({...p,[q.queryId]:e.target.value}))} placeholder="Type reply…" style={{flex:1}} onKeyDown={e=>{if(e.key==="Enter")sendReply(q.queryId);}}/>
                      <button className="btn" onClick={()=>sendReply(q.queryId)} style={{padding:"9px 14px",background:C.accent,color:"#fff",fontSize:12}}>Send</button>
                    </div>
                  )}
                </div>
              ))}
          </>
        )}

        {/* ── NOTIFY TAB (inline) ── */}
        {tab==="notify"&&(
          <NotifyVendorModal inv={inv} onClose={()=>setTab("details")} showToast={showToast} inlineMode />
        )}

        {/* ── TIMELINE ── */}
        {tab==="timeline"&&(
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:20}}>
            <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".6px",marginBottom:16}}>Notification &amp; Event Log</div>
            {(inv.notificationLog||[]).length===0?<div style={{color:C.muted,fontSize:13}}>No events logged yet.</div>
              :[...(inv.notificationLog||[])].reverse().map((n,i)=>(
                <div key={i} style={{display:"flex",gap:12,paddingBottom:14,borderBottom:i<(inv.notificationLog||[]).length-1?`1px solid ${C.border}`:"none",marginBottom:14}}>
                  <div style={{width:34,height:34,borderRadius:"50%",background:C.accentLight,border:`1px solid ${C.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>
                    {n.event==="invoice_created"?"📋":n.event==="invoice_submitted"?"📤":n.event==="payment_recorded"?"💳":n.event==="invoice_approved"?"✅":n.event==="manual_notification"?"📢":"📧"}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:2,flexWrap:"wrap"}}>
                      <span style={{fontSize:12,fontWeight:600,color:C.text}}>{n.event?.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())}</span>
                      <span style={{fontSize:10,padding:"1px 7px",borderRadius:8,fontWeight:700,
                        background:n.isRegistered?"#F0FDF4":"#FFF7ED",
                        color:n.isRegistered?"#166534":"#92400E",
                        border:`1px solid ${n.isRegistered?"#BBF7D0":"#FDE68A"}`}}>
                        {n.channel||"—"}
                      </span>
                      <span style={{fontSize:10,padding:"1px 7px",borderRadius:8,fontWeight:700,
                        background:n.status==="delivered"?"#F0FDF4":n.status==="queued"?"#FFF7ED":"#FEF2F2",
                        color:n.status==="delivered"?"#166534":n.status==="queued"?"#C2410C":"#991B1B"}}>
                        {n.status||"—"}
                      </span>
                    </div>
                    {n.message&&<div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>{n.message}</div>}
                    {n.deliveryDetail&&<div style={{fontSize:11,color:C.muted,marginTop:3,fontStyle:"italic"}}>{n.deliveryDetail}</div>}
                    <div style={{fontSize:10,color:C.muted,marginTop:4}}>
                      {n.sentAt?.slice(0,19).replace("T"," ")} · To: {n.to||"—"}
                      {n.isManual&&<span style={{marginLeft:6,background:"#EFF6FF",color:"#1E40AF",padding:"1px 5px",borderRadius:4,fontWeight:700}}>Manual</span>}
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

/* ═══════════════════════════════════════════════════════════════════
   AP AGING REPORT
═══════════════════════════════════════════════════════════════════ */
function AgingReport({ showToast }) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{(async()=>{
    try{const r=await authFetch(`${PI_API}/reports/aging`);setData(await r.json());}
    catch(e){showToast(e.message,"err");}
    finally{setLoading(false);}
  })();},[]);

  if(loading) return <div style={{padding:48,textAlign:"center",color:C.muted,fontFamily:"'DM Sans',sans-serif"}}>Loading aging report…</div>;
  if(!data) return null;

  const buckets=[
    {key:"current",label:"Not Yet Due",  color:C.green},
    {key:"0-30",   label:"0–30 Days",    color:"#B8860B"},
    {key:"31-60",  label:"31–60 Days",   color:"#C2410C"},
    {key:"61-90",  label:"61–90 Days",   color:C.red},
    {key:"90+",    label:"90+ Days",     color:"#7F1D1D"},
  ];
  const grandTotal=Object.values(data.totals||{}).reduce((s,v)=>s+v,0);

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
        {buckets.map(b=>(
          <div key={b.key} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px"}}>
            <div style={{fontSize:10,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:".6px",fontFamily:"'DM Sans',sans-serif",marginBottom:6}}>{b.label}</div>
            <div style={{fontSize:20,fontFamily:"'DM Mono',monospace",fontWeight:500,color:b.color}}>₹{money(data.totals?.[b.key]||0)}</div>
            <div style={{fontSize:11,color:C.muted,fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{(data.buckets?.[b.key]||[]).length} invoice(s)</div>
          </div>
        ))}
      </div>
      <div style={{marginBottom:14,fontSize:13,fontFamily:"'DM Sans',sans-serif",color:C.muted}}>
        Grand Total Outstanding: <b style={{color:C.accent,fontFamily:"'DM Mono',monospace"}}>₹{money(grandTotal)}</b>
      </div>
      {buckets.map(b=>{
        const entries=data.buckets?.[b.key]||[];
        if(!entries.length) return null;
        return(
          <div key={b.key} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",marginBottom:12}}>
            <div style={{padding:"10px 16px",background:"#F0EDE6",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:12,fontWeight:700,color:b.color}}>{b.label}</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:b.color}}>₹{money(data.totals?.[b.key]||0)}</span>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`,background:C.surface}}>
                {["Invoice No","Vendor","Type","Vendor Type","Total","Balance","Due Date","Days Overdue","Pay Mode"].map(h=>(
                  <th key={h} style={{padding:"8px 12px",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".5px",textAlign:"left",fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {entries.map((e,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?"#fff":C.surface}}>
                    <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.accent}}>{e.invoiceNo||"—"}</td>
                    <td style={{padding:"9px 12px",fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>{e.vendor||"—"}</td>
                    <td style={{padding:"9px 12px"}}><TypeBadge t={e.invoiceType}/></td>
                    <td style={{padding:"9px 12px"}}><VendorBadge isRegistered={e.isRegisteredVendor}/></td>
                    <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:12}}>₹{money(e.invoiceTotal)}</td>
                    <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,color:b.color}}>₹{money(e.balanceDue)}</td>
                    <td style={{padding:"9px 12px",fontSize:12}}>{fmtDate(e.dueDate)}</td>
                    <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,color:e.daysOverdue>60?C.red:C.muted}}>{e.daysOverdue}d</td>
                    <td style={{padding:"9px 12px",fontSize:11,color:C.muted}}>{e.paymentMode||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
function VendorPurchaseInvoiceView() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch(`${PI_API}/vendor/my-invoices`, {}, true);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to load purchase invoices.");
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const acknowledge = async (invoice) => {
    setBusyId(invoice.id);
    setError("");
    try {
      const response = await authFetch(`${PI_API}/vendor/${invoice.id}/acknowledge`, { method: "POST" }, true);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Acknowledgement failed.");
      await loadInvoices();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-600">Accounts receivable</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Purchase Invoices</h1>
            <p className="mt-1 text-sm text-slate-500">Invoices created for your vendor account across approved retailers.</p>
          </div>
          <button onClick={loadInvoices} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100">Refresh</button>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm font-semibold text-slate-400">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center"><p className="font-bold text-slate-700">No purchase invoices yet</p><p className="mt-1 text-sm text-slate-400">Invoices issued to your vendor account will appear here.</p></div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  <tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Retailer reference</th><th className="px-4 py-3">Date / Due</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Balance</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-slate-100 last:border-0 hover:bg-emerald-50/30">
                      <td className="px-4 py-3"><p className="font-bold text-slate-900">{invoice.invoiceNo || "—"}</p><p className="text-xs text-slate-400">{invoice.vendorInvoiceNo || ""}</p></td>
                      <td className="px-4 py-3 text-slate-600">{invoice.poNo || invoice.directGrcNo || "Direct"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600"><p>{invoice.invoiceDate || "—"}</p><p className="text-slate-400">Due {invoice.dueDate || "—"}</p></td>
                      <td className="px-4 py-3 font-bold text-slate-900">₹{money(invoice.invoiceTotal)}</td>
                      <td className="px-4 py-3 font-bold text-rose-600">₹{money(invoice.balanceDue)}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-extrabold text-indigo-700">{invoice.paymentStatus || invoice.status}</span></td>
                      <td className="px-4 py-3 text-right">
                        {invoice.vendorAcknowledged ? <span className="text-xs font-bold text-emerald-600">Acknowledged</span> : <button disabled={busyId === invoice.id} onClick={() => acknowledge(invoice)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{busyId === invoice.id ? "Saving..." : "Acknowledge"}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
