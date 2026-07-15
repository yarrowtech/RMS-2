import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


// import React, { useEffect, useMemo, useState, useCallback } from "react";
// import toast from "react-hot-toast";
// import {
//   FaExchangeAlt, FaWarehouse, FaLayerGroup, FaFilter,
//   FaBuilding, FaSearch, FaPlus, FaSave, FaTrash,
//   FaEdit, FaFilePdf, FaTimes, FaChevronDown, FaChevronUp,
//   FaSync, FaInbox, FaClock, FaCheckCircle,
// } from "react-icons/fa";
// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";

// const API = APP_API_URL;
// const API_BASE = `${API}/stock-transfers`;

// /* ─── helpers ─── */
// const cn = (...a) => a.filter(Boolean).join(" ");
// const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// const sumQty = (lines = []) => lines.reduce((a, l) => a + (Number(l.qty) || 0), 0);
// const sumVal = (lines = []) => lines.reduce((a, l) => a + (Number(l.value) || 0), 0);
// const cryptoId = () => `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;

// function todayStamp() {
//   const d = new Date(), p = (n) => String(n).padStart(2, "0");
//   return `${p(d.getDate())}-${p(d.getMonth()+1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
// }
// function todayYmd() {
//   const d = new Date(), p = (n) => String(n).padStart(2, "0");
//   return `${p(d.getDate())}-${p(d.getMonth()+1)}-${d.getFullYear()}`;
// }
// const pInt = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : ""; };
// const pFlt = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, n) : ""; };

// /* ─── styles ─── */
// const INP = "w-full bg-white rounded-lg px-3 py-2 text-sm text-slate-900 border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none placeholder:text-slate-400 transition";
// const RO  = "bg-slate-100 cursor-not-allowed text-slate-600 border-slate-200 focus:ring-0";

// /* ─── Store context ─── */
// const storeId   = localStorage.getItem("store_id")   || "";
// const storeName = localStorage.getItem("store_name") || "";
// const isHQ      = !storeId;

// const token   = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
// const authHdr = { Authorization: `Bearer ${token}` };

// /* ─── PDF helpers (unchanged) ─── */
// const drawFooter = (doc, y, color, rec) => {
//   const tq = sumQty(rec.lines), tv = sumVal(rec.lines);
//   doc.setFillColor(248,250,252); doc.rect(340,y,215,60,"F");
//   doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(71,85,105);
//   doc.text("Total Items:",        355, y+18); doc.setFont("helvetica","normal"); doc.setTextColor(30,41,59); doc.text(String((rec.lines||[]).length), 540, y+18, {align:"right"});
//   doc.setFont("helvetica","bold"); doc.setTextColor(71,85,105);
//   doc.text("Total Qty Transferred:", 355, y+33); doc.setFont("helvetica","normal"); doc.setTextColor(30,41,59); doc.text(String(tq), 540, y+33, {align:"right"});
//   doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(...color);
//   doc.text("Total Net Value (Rs):", 355, y+50); doc.text(`Rs. ${tv.toFixed(2)}`, 540, y+50, {align:"right"});
//   const sy = y+100;
//   doc.setDrawColor(203,213,225); doc.setLineWidth(1);
//   [[40,"Prepared By / Dispatcher"],[230,"Checked By / Store Incharge"],[420,"Received By / Signatory"]].forEach(([x,lbl]) => {
//     doc.line(x,sy,x+130,sy); doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100,116,139); doc.text(lbl, x, sy+12);
//   });
// };

// const printRecord = (rec) => {
//   const isOut = rec.type === "Out";
//   const title = isOut ? "STOCK TRANSFER CHALLAN (DISPATCH)" : "GOODS RECEIPT NOTE (RECEIPT)";
//   const color = isOut ? [79,70,229] : [5,150,105];
//   const doc = new jsPDF({orientation:"portrait",unit:"pt",format:"a4"});
//   doc.setDrawColor(...color); doc.setLineWidth(4); doc.line(40,40,555,40);
//   doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.setTextColor(...color); doc.text(title,40,65);
//   doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(100,116,139);
//   doc.text("RETAIL MANAGEMENT SYSTEM (RMS) - STOCK MODULE",40,80);
//   doc.setDrawColor(226,232,240); doc.setLineWidth(1); doc.line(40,92,555,92);

//   const li=[], ri=[];
//   if (isOut) {
//     li.push(["Challan Ref No:",rec.refNo||"N/A"],["Date & Time:",rec.date||"N/A"],["Owner Site:",rec.ownerSite||"N/A"],["Source Warehouse:",rec.fromWh||"N/A"],["Destination Site:",rec.toWh||"N/A"],["Invoice Number:",rec.invoiceNo||"N/A"],["Transfer Ledger:",rec.transferLedger||"N/A"]);
//     ri.push(["Document No:",rec.documentNo||"N/A"],["Document Date:",rec.documentDate||"N/A"],["Status:",rec.status||"Dispatched"],["Created By:",rec.createdBy||"System"],["Transporter:",rec.transporter||"N/A"],["Transit Days:",rec.transitDays?`${rec.transitDays} Days`:"N/A"],["Agent/Carrier:",rec.agent||"N/A"]);
//   } else {
//     li.push(["GRN Ref No:",rec.refNo||"N/A"],["Date & Time:",rec.date||"N/A"],["Owner Site:",rec.ownerSite||"N/A"],["Source Site:",rec.fromWh||"N/A"],["Destination WH:",rec.toWh||"N/A"],["Linked Out Ref:",rec.outDocNo||"N/A"],["Transfer Ledger:",rec.transferLedger||"N/A"]);
//     ri.push(["Document No:",rec.documentNo||"N/A"],["Document Date:",rec.documentDate||"N/A"],["Status:",rec.status||"Received"],["Gate Entry No:",rec.gateEntryNo||"N/A"],["Logistic AWB No:",rec.logisticNo||"N/A"],["Gate Qty / AWB Qty:",`${rec.gateEntryQty||0} / ${rec.logisticQty||0}`],["Agent/Carrier:",rec.agent||"N/A"]);
//   }
//   let sy=110;
//   for (let i=0; i<Math.max(li.length,ri.length); i++) {
//     if (li[i]) { doc.setFont("helvetica","bold"); doc.setTextColor(71,85,105); doc.text(li[i][0],40,sy); doc.setFont("helvetica","normal"); doc.setTextColor(30,41,59); doc.text(String(li[i][1]),150,sy); }
//     if (ri[i]) { doc.setFont("helvetica","bold"); doc.setTextColor(71,85,105); doc.text(ri[i][0],310,sy); doc.setFont("helvetica","normal"); doc.setTextColor(30,41,59); doc.text(String(ri[i][1]),420,sy); }
//     sy+=16;
//   }
//   sy+=15;
//   doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(...color); doc.text("TRANSFER ITEM LINES",40,sy); sy+=10;
//   autoTable(doc,{
//     head:[["#","Barcode","Item Description","Qty","Rate (Rs)","Amount (Rs)"]],
//     body:(rec.lines||[]).map((l,i)=>[i+1,l.barcode||"N/A",l.product||"N/A",l.qty||0,Number(l.rate||0).toFixed(2),Number((l.qty||0)*(l.rate||0)).toFixed(2)]),
//     startY:sy,
//     styles:{font:"helvetica",fontSize:9,cellPadding:6},
//     headStyles:{fillColor:color,textColor:[255,255,255],fontStyle:"bold"},
//     alternateRowStyles:{fillColor:[248,250,252]},
//     columnStyles:{0:{width:30,halign:"center"},1:{width:110},2:{width:220},3:{width:50,halign:"right"},4:{width:70,halign:"right"},5:{width:80,halign:"right"}},
//     margin:{left:40,right:40},
//   });
//   const fy = doc.lastAutoTable.finalY+25;
//   if (fy>600) { doc.addPage(); drawFooter(doc,60,color,rec); } else { drawFooter(doc,fy,color,rec); }
//   doc.save(`Transfer-${rec.refNo||"record"}.pdf`);
// };

// /* ─── empty form (Out only — In is now auto-created via Receive) ─── */
// const emptyOut = () => ({
//   date:todayStamp(), refNo:"", createdBy:"", ownerSite: isHQ ? "Central Inventory" : storeName,
//   invoiceNo:"", documentNo:"", documentDate:"", toWh:"", to_store_id: "",
//   tradeGroup:"", transferLedger:"", transferSubLedger:"", transitDays:"",
//   transporter:"", agent:"", customer:"", salesTerm:"", transitInLedger:"",
//   transitInSubLedger:"", transitDueDate:"", creditDueDate:"", commissionRate:"",
//   logisticsNo:"", declarationAmount:"", logisticsDate:"", remarks:"",
//   challans:[{id:cryptoId(),challanNo:"",challanBarcode:"",challanDate:todayYmd()}],
//   lines:[{lineId:cryptoId(),sku:"",barcode:"",product:"",available:0,qty:"",rate:0,value:0,ledgerName:"",subLedgerName:"",remarks:""}],
// });

// /* ══════════════════════════════════════════════════════════════════
//    MAIN COMPONENT
//    Tabs: Transfer Out (dispatch history) | Pending Receipts | Transfer In (received history)
//    Manual "Create Transfer In" is REMOVED — In docs are only created
//    automatically when a Pending receipt is confirmed via /receive.
// ══════════════════════════════════════════════════════════════════ */
// export default function StockTransfer() {
//   const [activeTab,   setActiveTab]   = useState("out");
//   const [records,     setRecords]     = useState([]);
//   const [pending,     setPending]     = useState([]);
//   const [stores,      setStores]      = useState([]);
//   const [loading,     setLoading]     = useState(false);
//   const [saving,      setSaving]      = useState(false);
//   const [receivingId, setReceivingId] = useState(null);

//   const [editId,   setEditId]   = useState(null);
//   const [openOut,  setOpenOut]  = useState(false);
//   const [formOut,  setFormOut]  = useState(emptyOut());

//   const [secOut, setSecOut] = useState({general:true,additional:false,quickScan:false,itemInfo:false});
//   const [subOut, setSubOut] = useState({logistics:false,others:false});

//   // filters
//   const [search,        setSearch]       = useState("");
//   const [outOwnerSite,  setOutOwnerSite] = useState("");
//   const [outToWh,       setOutToWh]      = useState("");
//   const [outInvoiceNo,  setOutInvoiceNo] = useState("");
//   const [outDocNo,      setOutDocNo]     = useState("");
//   const [outTransporter,setOutTransporter]=useState("");
//   const [outStatus,     setOutStatus]    = useState("");

//   /* ── fetch ── */
//   const fetchAll = useCallback(async () => {
//     try {
//       setLoading(true);
//       const res  = await fetch(API_BASE + "/", { headers: authHdr });
//       const data = await res.json();
//       setRecords(Array.isArray(data.data) ? data.data : []);
//     } catch { toast.error("Failed to load transfers"); }
//     finally   { setLoading(false); }
//   }, []);

//   const fetchPending = useCallback(async () => {
//     try {
//       setLoading(true);
//       const location = isHQ ? "central" : storeId;
//       const res  = await fetch(`${API_BASE}/pending/${location}`, { headers: authHdr });
//       const data = await res.json();
//       setPending(Array.isArray(data.data) ? data.data : []);
//     } catch { toast.error("Failed to load pending receipts"); }
//     finally { setLoading(false); }
//   }, []);

//   const fetchStores = useCallback(async () => {
//     try {
//       const res  = await fetch(`${API}/superadmin/stores/list`, { headers: authHdr });
//       const data = await res.json();
//       setStores(Array.isArray(data.stores) ? data.stores : []);
//     } catch {}
//   }, []);

//   useEffect(() => { fetchAll(); fetchPending(); fetchStores(); }, [fetchAll, fetchPending, fetchStores]);

//   useEffect(() => {
//     if (activeTab === "pending") fetchPending();
//   }, [activeTab]);

//   /* ── filtered (Out tab = dispatched by me, In tab = received by me) ── */
//   const outRecords = useMemo(() => records.filter(r => r.type === "Out"), [records]);
//   const inRecords  = useMemo(() => records.filter(r => r.type === "In"),  [records]);

//   const filtered = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     const base = activeTab === "out" ? outRecords : inRecords;
//     return base.filter(rec => {
//       if (activeTab === "out") {
//         if (outOwnerSite  && !(rec.ownerSite||"").toLowerCase().includes(outOwnerSite.toLowerCase()))  return false;
//         if (outToWh       && !(rec.toWh||"").toLowerCase().includes(outToWh.toLowerCase()))            return false;
//         if (outInvoiceNo  && !(rec.invoiceNo||"").toLowerCase().includes(outInvoiceNo.toLowerCase()))  return false;
//         if (outDocNo      && !(rec.documentNo||"").toLowerCase().includes(outDocNo.toLowerCase()))     return false;
//         if (outTransporter&& !(rec.transporter||"").toLowerCase().includes(outTransporter.toLowerCase()))return false;
//         if (outStatus     && !(rec.status||"").toLowerCase().includes(outStatus.toLowerCase()))        return false;
//       }
//       if (q) {
//         const hit = [rec.refNo,rec.documentNo,rec.invoiceNo,rec.transporter,rec.gateEntryNo,rec.logisticNo]
//           .some(f=>(f||"").toLowerCase().includes(q))
//           || (rec.lines||[]).some(l=>[l.product,l.sku,l.barcode].some(f=>(f||"").toLowerCase().includes(q)));
//         if (!hit) return false;
//       }
//       return true;
//     });
//   }, [outRecords, inRecords, activeTab, search, outOwnerSite, outToWh, outInvoiceNo, outDocNo, outTransporter, outStatus]);

//   /* ── line helpers ── */
//   const setLineOut = (lineId, patch) => setFormOut(s => ({
//     ...s, lines: s.lines.map(l => {
//       if (l.lineId !== lineId) return l;
//       const u = {...l,...patch};
//       if ("qty" in patch || "rate" in patch) u.value = (Number(u.qty)||0)*(Number(u.rate)||0);
//       return u;
//     })
//   }));

//   /* ── save (Dispatch — creates a Transfer Out, deducts source immediately) ── */
//   const handleSave = async () => {
//     if (isHQ && !formOut.to_store_id) { toast.error("Select a destination store."); return; }
//     if (!formOut.invoiceNo.trim()) { toast.error("Invoice / Reference Number is required."); return; }

//     const lines = formOut.lines.filter(l => (l.product||"").trim() && Number(l.qty) > 0);
//     if (!lines.length) { toast.error("At least one valid line is required."); return; }

//     const payload = {
//       from_store_id: isHQ ? null : storeId,
//       to_store_id:   isHQ ? formOut.to_store_id : null,   // store admins dispatch back to central only
//       invoiceNo:     formOut.invoiceNo.trim(),
//       documentNo:    formOut.documentNo,
//       documentDate:  formOut.documentDate,
//       date:          formOut.date,
//       createdBy:     formOut.createdBy || localStorage.getItem("admin_name") || "Inventory",
//       tradeGroup:    formOut.tradeGroup,
//       transferLedger:    formOut.transferLedger,
//       transferSubLedger: formOut.transferSubLedger,
//       transitDays:   formOut.transitDays,
//       transporter:   formOut.transporter,
//       agent:         formOut.agent,
//       remarks:       formOut.remarks,
//       challans:      formOut.challans,
//       logisticsNo:       formOut.logisticsNo,
//       logisticsDate:     formOut.logisticsDate,
//       declarationAmount: formOut.declarationAmount,
//       lines: lines.map(l => ({...l, qty: Number(l.qty)||0, rate: Number(l.rate)||0, value: (Number(l.qty)||0)*(Number(l.rate)||0)})),
//     };

//     try {
//       setSaving(true);
//       const url    = editId ? `${API_BASE}/${editId}` : `${API_BASE}/`;
//       const method = editId ? "PUT" : "POST";
//       const res    = await fetch(url, {method, headers:{...authHdr,"Content-Type":"application/json"}, body: JSON.stringify(payload)});
//       const data   = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Save failed");
//       toast.success(data.message || "Stock dispatched — awaiting receipt confirmation.");
//       setOpenOut(false);
//       setEditId(null);
//       await fetchAll();
//       await fetchPending();
//       if (data.data) printRecord(data.data);
//     } catch (e) {
//       toast.error(e.message || "Save failed");
//     } finally {
//       setSaving(false);
//     }
//   };

//   /* ── delete (only allowed while status === Dispatched) ── */
//   const handleDelete = async (rec) => {
//     if (rec.status !== "Dispatched") {
//       toast.error("Only Dispatched (not yet received) transfers can be cancelled.");
//       return;
//     }
//     if (!window.confirm("Cancel this dispatch? Stock will be returned to source.")) return;
//     try {
//       const res  = await fetch(`${API_BASE}/${rec.id}`, {method:"DELETE", headers: authHdr});
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Cancel failed");
//       toast.success(data.message || "Cancelled");
//       await fetchAll();
//       await fetchPending();
//     } catch (e) { toast.error(e.message); }
//   };

//   /* ── edit (only allowed while status === Dispatched) ── */
//   const handleEdit = (rec) => {
//     if (rec.status !== "Dispatched") {
//       toast.error("Only Dispatched (not yet received) transfers can be edited.");
//       return;
//     }
//     setEditId(rec.id);
//     setFormOut({
//       date:rec.date||"", refNo:rec.refNo||"", createdBy:rec.createdBy||"",
//       ownerSite:rec.ownerSite||"", invoiceNo:rec.invoiceNo||"",
//       documentNo:rec.documentNo||"", documentDate:rec.documentDate||"",
//       toWh:rec.toWh||"", to_store_id: rec.to_store_id || "",
//       tradeGroup:rec.tradeGroup||"",
//       transferLedger:rec.transferLedger||"", transferSubLedger:rec.transferSubLedger||"",
//       transitDays:rec.transitDays||"", transporter:rec.transporter||"",
//       agent:rec.agent||"", customer:rec.customer||"",
//       salesTerm:rec.salesTerm||"", transitInLedger:rec.transitInLedger||"",
//       transitInSubLedger:rec.transitInSubLedger||"", transitDueDate:rec.transitDueDate||"",
//       creditDueDate:rec.creditDueDate||"", commissionRate:rec.commissionRate||"",
//       logisticsNo:rec.logisticsNo||"", declarationAmount:rec.declarationAmount||"",
//       logisticsDate:rec.logisticsDate||"", remarks:rec.remarks||"",
//       challans:(rec.challans||[]).map(c=>({...c,id:cryptoId()})),
//       lines:(rec.lines||[]).map(l=>({...l,lineId:cryptoId()})),
//     });
//     setOpenOut(true);
//   };

//   /* ── Receive (confirms a Pending dispatch — adds stock at destination) ── */
//   const handleReceive = async (transferId) => {
//     try {
//       setReceivingId(transferId);
//       const res = await fetch(`${API_BASE}/${transferId}/receive`, {
//         method: "POST",
//         headers: { ...authHdr, "Content-Type": "application/json" },
//         body: JSON.stringify({ receivedBy: localStorage.getItem("admin_name") || "Admin" }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Receive failed");
//       toast.success(data.message || "Receipt confirmed — stock added.");
//       await fetchPending();
//       await fetchAll();
//       if (data.data?.in) printRecord(data.data.in);
//     } catch (e) {
//       toast.error(e.message || "Receive failed");
//     } finally {
//       setReceivingId(null);
//     }
//   };

//   /* ── PDF export (bulk) ── */
//   const exportPdf = () => {
//     const createdOn = todayYmd();
//     const targetRecs = filtered;
//     if (!targetRecs.length) { toast.error("No records to export."); return; }

//     const doc    = new jsPDF({orientation:"landscape",unit:"pt",format:"a4"});
//     const isOut  = activeTab === "out";
//     const color  = isOut ? [79,70,229] : [5,150,105];
//     const title  = isOut ? "Stock Transfer Outward (Dispatch) Report" : "Stock Transfer Inward (Receipt) Report";

//     doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.setTextColor(15,23,42); doc.text(title,40,45);
//     doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(100,116,139);
//     doc.text(`Generated: ${createdOn} | RMS`,40,62);

//     const head = isOut
//       ? [["Date","Ref No","Invoice","From","To","Status","SKU","Barcode","Product","Qty","Rate","Value"]]
//       : [["Date","Ref No","From Out Ref","Source","Dest","Status","SKU","Barcode","Product","Qty","Rate","Value"]];

//     const body = [];
//     targetRecs.forEach(rec => {
//       (rec.lines||[]).forEach(l => {
//         body.push([
//           rec.date, rec.refNo,
//           isOut ? rec.invoiceNo||"N/A" : rec.outDocNo||"N/A",
//           rec.fromWh, rec.toWh, rec.status||"",
//           l.sku||"", l.barcode||"", l.product||"",
//           String(l.qty||0),
//           `Rs.${Number(l.rate||0).toFixed(2)}`,
//           `Rs.${Number((l.qty||0)*(l.rate||0)).toFixed(2)}`
//         ]);
//       });
//     });

//     autoTable(doc,{head,body,startY:85,styles:{font:"helvetica",fontSize:7,cellPadding:4},headStyles:{fillColor:color,textColor:[255,255,255]},alternateRowStyles:{fillColor:[248,250,252]},columnStyles:{9:{halign:"right"},10:{halign:"right"},11:{halign:"right"}},margin:{left:40,right:40}});

//     const pc = doc.internal.getNumberOfPages();
//     for (let i=1;i<=pc;i++) { doc.setPage(i); doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(148,163,184); doc.text(`Page ${i} of ${pc}`,750,565); }
//     doc.save(`stock-transfer-${activeTab}-${createdOn}.pdf`);
//     toast.success("PDF exported!");
//   };

//   /* ── totals ── */
//   const totOut = useMemo(() => ({ qty: sumQty(formOut.lines), val: sumVal(formOut.lines), valid: formOut.lines.filter(l=>(l.product||"").trim()&&Number(l.qty)>0).length }), [formOut.lines]);

//   /* ── ESC close ── */
//   useEffect(() => {
//     if (!openOut) return;
//     const h = e => { if (e.key === "Escape") { setOpenOut(false); setEditId(null); } };
//     window.addEventListener("keydown", h);
//     document.body.style.overflow = "hidden";
//     return () => { window.removeEventListener("keydown",h); document.body.style.overflow = ""; };
//   }, [openOut]);

//   const clearFilters = () => {
//     setSearch(""); setOutOwnerSite(""); setOutToWh(""); setOutInvoiceNo(""); setOutDocNo(""); setOutTransporter(""); setOutStatus("");
//   };
//   const hasFilters = search||outOwnerSite||outToWh||outInvoiceNo||outDocNo||outTransporter||outStatus;

//   return (
//     <div className="min-h-full w-full px-3 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">

//       {/* Header */}
//       <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
//         <div className="flex items-center gap-3">
//           <FaExchangeAlt className="text-indigo-600 text-2xl shrink-0" />
//           <div>
//             <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Stock Transfer & Logistics</h1>
//             <p className="text-xs text-slate-500 mt-0.5">
//               {isHQ ? "Dispatch stock to stores — they confirm receipt to complete the transfer" : `Manage stock movement for ${storeName || "your store"}`}
//             </p>
//           </div>
//         </div>
//         <div className="flex flex-wrap gap-2">
//           <button onClick={() => { fetchAll(); fetchPending(); }} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition shadow-sm">
//             <FaSync size={12} /> Refresh
//           </button>
//           <button onClick={exportPdf} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition shadow-sm">
//             <FaFilePdf /> Export PDF
//           </button>
//           <button onClick={() => { setEditId(null); setFormOut(emptyOut()); setSecOut({general:true,additional:false,quickScan:false,itemInfo:false}); setSubOut({logistics:false,others:false}); setOpenOut(true); }}
//             className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-sm">
//             <FaPlus /> {isHQ ? "Dispatch to Store" : "Return to Central"}
//           </button>
//         </div>
//       </div>

//       {/* Tabs */}
//       <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-max shadow-inner">
//         {[
//           { key: "out",     label: "Transfer Out",     count: outRecords.length },
//           { key: "pending", label: "Pending Receipts",  count: pending.length, badge: true },
//           { key: "in",      label: "Transfer In",       count: inRecords.length },
//         ].map(tab => (
//           <button key={tab.key} onClick={() => setActiveTab(tab.key)}
//             className={cn("flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition",
//               activeTab===tab.key ? "bg-white text-indigo-700 shadow border border-slate-200" : "text-slate-500 hover:text-slate-800")}>
//             {tab.label}
//             <span className={cn("px-2 py-0.5 text-xs font-bold rounded-full",
//               tab.badge && tab.count > 0 ? "bg-amber-500 text-white" :
//               activeTab===tab.key ? "bg-indigo-100 text-indigo-800" : "bg-slate-300 text-slate-600")}>
//               {tab.count}
//             </span>
//           </button>
//         ))}
//       </div>

//       {/* ══════════════════════ TAB: OUT / IN — same table ══════════════════════ */}
//       {(activeTab === "out" || activeTab === "in") && (
//         <>
//           {/* Filters (Out tab only — In is read-only history) */}
//           {activeTab === "out" && (
//             <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
//               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
//                 <FiltInput label="Owner Site"  icon={<FaBuilding/>}   val={outOwnerSite}  set={setOutOwnerSite}  ph="Filter..." />
//                 <FiltInput label="Destination" icon={<FaWarehouse/>}  val={outToWh}       set={setOutToWh}       ph="Filter..." />
//                 <FiltInput label="Invoice No"  icon={<FaLayerGroup/>} val={outInvoiceNo}  set={setOutInvoiceNo}  ph="Filter..." />
//                 <FiltInput label="Document No" icon={<FaLayerGroup/>} val={outDocNo}      set={setOutDocNo}      ph="Filter..." />
//                 <FiltInput label="Transporter" icon={<FaWarehouse/>}  val={outTransporter}set={setOutTransporter} ph="Filter..." />
//                 <FiltInput label="Status"      icon={<FaFilter/>}     val={outStatus}     set={setOutStatus}     ph="Dispatched / Received" />
//                 <div>
//                   <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1"><FaSearch className="text-slate-400"/> Search</label>
//                   <div className="flex items-center gap-2 rounded-lg px-3 bg-slate-50 border border-slate-300">
//                     <FaSearch className="text-slate-400 shrink-0" size={12}/>
//                     <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="General search..." className="bg-transparent outline-none w-full text-xs py-2"/>
//                   </div>
//                 </div>
//               </div>
//               <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
//                 <span>Showing <b className="text-slate-900">{filtered.length}</b> records</span>
//                 {hasFilters && <button onClick={clearFilters} className="text-indigo-600 hover:text-indigo-800 font-bold">Clear Filters</button>}
//               </div>
//             </div>
//           )}

//           {/* Table */}
//           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
//             <div className="overflow-auto max-h-[56vh]">
//               <table className="w-full text-sm min-w-[1100px]">
//                 <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
//                   <tr>
//                     {["Date","Ref No / Doc No","From","To","Logistics / Details","Lines","Total Qty","Value","Status","Actions"].map(h => (
//                       <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-50">
//                   {loading ? (
//                     <tr><td colSpan={10} className="py-16 text-center text-slate-400">
//                       <div className="flex items-center justify-center gap-2">
//                         <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin"/>
//                         Loading transfers…
//                       </div>
//                     </td></tr>
//                   ) : filtered.length === 0 ? (
//                     <tr><td colSpan={10} className="py-16 text-center text-slate-400">
//                       {activeTab === "out" ? "No dispatches found. Create one above." : "No receipts yet. Confirm a Pending Receipt to see it here."}
//                     </td></tr>
//                   ) : filtered.map(rec => {
//                     const tv = sumVal(rec.lines||[]);
//                     return (
//                       <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
//                         <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{rec.date}</td>
//                         <td className="px-3 py-2.5 whitespace-nowrap">
//                           <div className="font-bold text-slate-800 text-xs">{rec.refNo}</div>
//                           <div className="text-[10px] text-slate-400 font-mono">{rec.documentNo||"—"}</div>
//                         </td>
//                         <td className="px-3 py-2.5 text-xs font-medium text-slate-700 whitespace-nowrap">{rec.fromWh||"—"}</td>
//                         <td className="px-3 py-2.5 text-xs font-medium text-slate-700 whitespace-nowrap">{rec.toWh||"—"}</td>
//                         <td className="px-3 py-2.5 text-xs text-slate-600">
//                           {rec.type==="Out"
//                             ? <><span className="font-semibold">Transporter:</span> {rec.transporter||"—"}<br/><span className="font-semibold">Transit:</span> {rec.transitDays?`${rec.transitDays} Days`:"—"}</>
//                             : <><span className="font-semibold">Out Ref:</span> {rec.outDocNo||"—"}<br/><span className="font-semibold">Received By:</span> {rec.createdBy||"—"}</>}
//                         </td>
//                         <td className="px-3 py-2.5 text-xs font-semibold text-slate-700">{(rec.lines||[]).length}</td>
//                         <td className="px-3 py-2.5 text-xs font-bold text-slate-800">{sumQty(rec.lines||[])}</td>
//                         <td className="px-3 py-2.5 text-xs font-black text-indigo-700 whitespace-nowrap">₹{money(tv)}</td>
//                         <td className="px-3 py-2.5">
//                           <span className={cn("inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border",
//                             rec.status==="Received" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
//                             : rec.status==="Dispatched" ? "bg-amber-50 text-amber-700 border-amber-200"
//                             : rec.status==="Partially Received" ? "bg-sky-50 text-sky-700 border-sky-200"
//                             : "bg-slate-50 text-slate-600 border-slate-200")}>
//                             {rec.status||"—"}
//                           </span>
//                         </td>
//                         <td className="px-3 py-2.5">
//                           <div className="flex gap-1.5">
//                             <button onClick={() => printRecord(rec)} title="Print" className="h-7 px-2 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-200 text-xs font-bold transition"><FaFilePdf size={11}/></button>
//                             {rec.type === "Out" && rec.status === "Dispatched" && (
//                               <>
//                                 <button onClick={() => handleEdit(rec)} className="h-7 px-2.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold transition flex items-center gap-1"><FaEdit size={10}/> Edit</button>
//                                 <button onClick={() => handleDelete(rec)} className="h-7 px-2.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition flex items-center gap-1"><FaTrash size={10}/> Cancel</button>
//                               </>
//                             )}
//                           </div>
//                         </td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             </div>
//             {filtered.length > 0 && (
//               <div className="px-4 py-2.5 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
//                 <span>Showing {filtered.length} records</span>
//                 <span>Total Value: <b className="text-indigo-700">₹{money(filtered.reduce((s,r)=>s+sumVal(r.lines||[]),0))}</b></span>
//               </div>
//             )}
//           </div>
//         </>
//       )}

//       {/* ══════════════════════ TAB: PENDING RECEIPTS ══════════════════════ */}
//       {activeTab === "pending" && (
//         <div className="flex flex-col gap-4">
//           {loading ? (
//             <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
//               <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /> Loading…
//             </div>
//           ) : pending.length === 0 ? (
//             <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
//               <FaCheckCircle className="text-emerald-400 text-3xl mx-auto mb-3" />
//               <p className="text-sm text-slate-500">No pending receipts. Everything dispatched to {isHQ ? "Central" : "this store"} has been received.</p>
//             </div>
//           ) : (
//             pending.map((tr) => (
//               <div key={tr.id} className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
//                 <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between flex-wrap gap-2">
//                   <div className="flex items-center gap-3">
//                     <FaClock className="text-amber-600" />
//                     <div>
//                       <p className="text-sm font-bold text-amber-900">{tr.refNo}</p>
//                       <p className="text-xs text-amber-600">From: {tr.fromWh || "Central"} · Transporter: {tr.transporter || "—"} · Dispatched {tr.date}</p>
//                     </div>
//                   </div>
//                   <button onClick={() => handleReceive(tr.id)} disabled={receivingId === tr.id}
//                     className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-50">
//                     {receivingId === tr.id
//                       ? (<><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Confirming…</>)
//                       : (<><FaCheckCircle size={12} /> Confirm Receipt</>)}
//                   </button>
//                 </div>
//                 <div className="p-4">
//                   <table className="w-full text-xs">
//                     <thead>
//                       <tr className="text-slate-400 uppercase font-bold">
//                         <th className="text-left pb-2">Barcode</th>
//                         <th className="text-left pb-2">Product</th>
//                         <th className="text-right pb-2">Qty</th>
//                       </tr>
//                     </thead>
//                     <tbody className="divide-y divide-slate-50">
//                       {(tr.lines || []).map((l, i) => (
//                         <tr key={i}>
//                           <td className="py-1.5 font-mono text-slate-600">{l.barcode}</td>
//                           <td className="py-1.5 text-slate-800">{l.product}</td>
//                           <td className="py-1.5 text-right font-bold text-slate-700">{l.qty}</td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                   <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-xs">
//                     <span className="text-slate-400">Total {tr.lines?.length || 0} line(s)</span>
//                     <span className="font-bold text-slate-700">Qty: {tr.totalQty}</span>
//                   </div>
//                 </div>
//               </div>
//             ))
//           )}
//         </div>
//       )}

//       {/* ══════════════════════ MODAL: DISPATCH (Transfer Out) ══════════════════════ */}
//       {openOut && (
//         <ModalShell title={editId ? "Edit Dispatch" : (isHQ ? "Dispatch to Store" : "Return to Central")} onClose={() => { setOpenOut(false); setEditId(null); }}>

//           <Acc title="General Information" open={secOut.general} toggle={() => setSecOut(s=>({...s,general:!s.general}))}>
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
//               <div className="flex flex-col gap-4">
//                 <Field label="Owner Site">
//                   <input className={cn(INP, RO)} value={formOut.ownerSite} readOnly/>
//                 </Field>
//                 <Field label="Invoice / Reference Number *">
//                   <input className={INP} value={formOut.invoiceNo} onChange={e=>setFormOut(s=>({...s,invoiceNo:e.target.value}))} placeholder="e.g. DSP-2026-001"/>
//                 </Field>
//                 <Field label="Document No">
//                   <input className={INP} value={formOut.documentNo} onChange={e=>setFormOut(s=>({...s,documentNo:e.target.value}))} placeholder="Doc no"/>
//                 </Field>
//                 {isHQ ? (
//                   <Field label="Destination Store / Branch *">
//                     <select className={INP} value={formOut.to_store_id}
//                       onChange={e=>{
//                         const s = stores.find(x=>x.id===e.target.value);
//                         setFormOut(prev=>({...prev, to_store_id: e.target.value, toWh: s ? s.name : ""}));
//                       }}>
//                       <option value="">— Select store or branch —</option>
//                       {stores.map((s) => (
//                         <option key={s.id} value={s.id}>{s.name} ({s.code}) — {s.type}{s.city ? `, ${s.city}` : ""}</option>
//                       ))}
//                     </select>
//                   </Field>
//                 ) : (
//                   <Field label="Destination">
//                     <input className={cn(INP, RO)} value="Central Inventory" readOnly/>
//                   </Field>
//                 )}
//                 <Field label="Trade Group">
//                   <input className={INP} value={formOut.tradeGroup} onChange={e=>setFormOut(s=>({...s,tradeGroup:e.target.value}))}/>
//                 </Field>
//                 <Field label="Transfer Out Ledger">
//                   <input className={INP} value={formOut.transferLedger} onChange={e=>setFormOut(s=>({...s,transferLedger:e.target.value}))}/>
//                 </Field>
//               </div>
//               <div className="flex flex-col gap-4">
//                 <Field label="Date & Time *">
//                   <input className={INP} value={formOut.date} onChange={e=>setFormOut(s=>({...s,date:e.target.value}))}/>
//                 </Field>
//                 <Field label="Document Date">
//                   <input className={INP} value={formOut.documentDate} onChange={e=>setFormOut(s=>({...s,documentDate:e.target.value}))} placeholder="DD-MM-YYYY"/>
//                 </Field>
//                 <Field label="Customer">
//                   <input className={INP} value={formOut.customer} onChange={e=>setFormOut(s=>({...s,customer:e.target.value}))}/>
//                 </Field>
//                 <Field label="Sales Term">
//                   <input className={INP} value={formOut.salesTerm} onChange={e=>setFormOut(s=>({...s,salesTerm:e.target.value}))}/>
//                 </Field>
//                 <Field label="Transfer Out Sub Ledger">
//                   <input className={INP} value={formOut.transferSubLedger} onChange={e=>setFormOut(s=>({...s,transferSubLedger:e.target.value}))}/>
//                 </Field>
//               </div>
//             </div>
//           </Acc>

//           <Acc title="Additional Details" open={secOut.additional} toggle={() => setSecOut(s=>({...s,additional:!s.additional}))}>
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
//               <div className="flex flex-col gap-4">
//                 <Field label="Transit In Ledger"><input className={INP} value={formOut.transitInLedger} onChange={e=>setFormOut(s=>({...s,transitInLedger:e.target.value}))}/></Field>
//                 <Field label="Transit Days"><input type="number" min="0" className={INP} value={formOut.transitDays} onChange={e=>setFormOut(s=>({...s,transitDays:pInt(e.target.value)}))}/></Field>
//                 <Field label="Transporter"><input className={INP} value={formOut.transporter} onChange={e=>setFormOut(s=>({...s,transporter:e.target.value}))}/></Field>
//                 <Field label="Agent"><input className={INP} value={formOut.agent} onChange={e=>setFormOut(s=>({...s,agent:e.target.value}))}/></Field>
//               </div>
//               <div className="flex flex-col gap-4">
//                 <Field label="Transit In Sub Ledger"><input className={INP} value={formOut.transitInSubLedger} onChange={e=>setFormOut(s=>({...s,transitInSubLedger:e.target.value}))}/></Field>
//                 <Field label="Transit Due Date"><input className={INP} value={formOut.transitDueDate} onChange={e=>setFormOut(s=>({...s,transitDueDate:e.target.value}))} placeholder="DD-MM-YYYY"/></Field>
//                 <Field label="Credit Due Date"><input className={INP} value={formOut.creditDueDate} onChange={e=>setFormOut(s=>({...s,creditDueDate:e.target.value}))} placeholder="DD-MM-YYYY"/></Field>
//                 <Field label="Commission Rate"><input className={INP} value={formOut.commissionRate} onChange={e=>setFormOut(s=>({...s,commissionRate:e.target.value}))}/></Field>
//               </div>
//             </div>
//           </Acc>

//           <Acc title="Item Information (Logistics & Others)" open={secOut.itemInfo} toggle={() => setSecOut(s=>({...s,itemInfo:!s.itemInfo}))}>
//             <div className="border border-slate-200 rounded-xl overflow-hidden mb-3">
//               <button type="button" onClick={() => setSubOut(s=>({...s,logistics:!s.logistics}))}
//                 className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition">
//                 Logistics {subOut.logistics ? <FaChevronUp/> : <FaChevronDown/>}
//               </button>
//               {subOut.logistics && (
//                 <div className="p-4 grid grid-cols-3 gap-3">
//                   <Field label="Logistics No"><input className={INP} value={formOut.logisticsNo} onChange={e=>setFormOut(s=>({...s,logisticsNo:e.target.value}))}/></Field>
//                   <Field label="Declaration Amount"><input type="number" min="0" className={INP} value={formOut.declarationAmount} onChange={e=>setFormOut(s=>({...s,declarationAmount:pFlt(e.target.value)}))}/></Field>
//                   <Field label="Date"><input className={INP} value={formOut.logisticsDate} onChange={e=>setFormOut(s=>({...s,logisticsDate:e.target.value}))} placeholder="DD-MM-YYYY"/></Field>
//                 </div>
//               )}
//             </div>
//             <div className="border border-slate-200 rounded-xl overflow-hidden">
//               <button type="button" onClick={() => setSubOut(s=>({...s,others:!s.others}))}
//                 className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition">
//                 Others {subOut.others ? <FaChevronUp/> : <FaChevronDown/>}
//               </button>
//               {subOut.others && (
//                 <div className="p-4">
//                   <Field label="Remarks / Note">
//                     <textarea className={INP} rows={2} value={formOut.remarks} onChange={e=>setFormOut(s=>({...s,remarks:e.target.value}))} placeholder="Additional remarks..."/>
//                   </Field>
//                 </div>
//               )}
//             </div>
//           </Acc>

//           {/* Challans */}
//           <LineBox title="Challan Details" onAdd={() => setFormOut(s=>({...s,challans:[...s.challans,{id:cryptoId(),challanNo:"",challanBarcode:"",challanDate:todayYmd()}]}))}>
//             <table className="w-full text-sm min-w-[600px]">
//               <thead className="bg-slate-100 border-b border-slate-200">
//                 <tr>{["Challan No","Challan Barcode","Challan Date",""].map(h=><th key={h} className="px-3 py-2 text-left text-xs font-bold text-slate-500">{h}</th>)}</tr>
//               </thead>
//               <tbody className="divide-y divide-slate-50">
//                 {formOut.challans.map(c => (
//                   <tr key={c.id}>
//                     <td className="px-3 py-2"><input className={INP} value={c.challanNo} onChange={e=>setFormOut(s=>({...s,challans:s.challans.map(x=>x.id===c.id?{...x,challanNo:e.target.value}:x)}))}/></td>
//                     <td className="px-3 py-2"><input className={INP} value={c.challanBarcode} onChange={e=>setFormOut(s=>({...s,challans:s.challans.map(x=>x.id===c.id?{...x,challanBarcode:e.target.value}:x)}))}/></td>
//                     <td className="px-3 py-2"><input className={INP} value={c.challanDate} onChange={e=>setFormOut(s=>({...s,challans:s.challans.map(x=>x.id===c.id?{...x,challanDate:e.target.value}:x)}))}/></td>
//                     <td className="px-3 py-2 text-center"><DelBtn onClick={()=>{ if(formOut.challans.length<=1){toast.error("At least one challan required");return;} setFormOut(s=>({...s,challans:s.challans.filter(x=>x.id!==c.id)})); }}/></td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </LineBox>

//           {/* Transfer Lines */}
//           <LineBox title="Items to Dispatch" onAdd={() => setFormOut(s=>({...s,lines:[...s.lines,{lineId:cryptoId(),sku:"",barcode:"",product:"",available:0,qty:"",rate:0,value:0,ledgerName:"",subLedgerName:"",remarks:""}]}))}>
//             <div className="max-h-[35vh] overflow-auto">
//               <table className="w-full text-sm min-w-[1200px]">
//                 <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
//                   <tr>{["Barcode","Item Description","Qty","Rate (₹)","Value (₹)","Ledger","Sub Ledger",""].map(h=><th key={h} className="px-3 py-2 text-left text-xs font-bold text-slate-500 whitespace-nowrap">{h}</th>)}</tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-50">
//                   {formOut.lines.map(l => (
//                     <tr key={l.lineId} className="hover:bg-slate-50">
//                       <td className="px-2 py-1.5 w-44"><input className={cn(INP,"font-mono text-xs")} value={l.barcode} onChange={e=>setLineOut(l.lineId,{barcode:e.target.value})} placeholder="Barcode"/></td>
//                       <td className="px-2 py-1.5 min-w-[200px]"><input className={INP} value={l.product} onChange={e=>setLineOut(l.lineId,{product:e.target.value})} placeholder="Item description"/></td>
//                       <td className="px-2 py-1.5 w-24"><input type="number" min="0" className={INP} value={l.qty} onChange={e=>setLineOut(l.lineId,{qty:pInt(e.target.value)})} placeholder="0"/></td>
//                       <td className="px-2 py-1.5 w-28"><input type="number" min="0" className={INP} value={l.rate} onChange={e=>setLineOut(l.lineId,{rate:pFlt(e.target.value)})} placeholder="0.00"/></td>
//                       <td className="px-2 py-1.5 w-28"><input className={cn(INP,RO)} value={`₹${money(l.value)}`} readOnly/></td>
//                       <td className="px-2 py-1.5 w-32"><input className={INP} value={l.ledgerName} onChange={e=>setLineOut(l.lineId,{ledgerName:e.target.value})} placeholder="Ledger"/></td>
//                       <td className="px-2 py-1.5 w-32"><input className={INP} value={l.subLedgerName} onChange={e=>setLineOut(l.lineId,{subLedgerName:e.target.value})} placeholder="Sub Ledger"/></td>
//                       <td className="px-2 py-1.5 text-center"><DelBtn onClick={()=>{ if(formOut.lines.length<=1){toast.error("At least one line required");return;} setFormOut(s=>({...s,lines:s.lines.filter(x=>x.lineId!==l.lineId)})); }}/></td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </LineBox>

//           <Totals qty={totOut.qty} val={totOut.val} valid={totOut.valid}/>
//           <ModalFooter onClose={()=>{setOpenOut(false);setEditId(null);}} onSave={handleSave} saving={saving} label={editId ? "Save Changes" : "Dispatch Stock"} color="indigo"/>
//         </ModalShell>
//       )}
//     </div>
//   );
// }

// /* ── UI primitives (unchanged) ── */
// function FiltInput({ label, icon, val, set, ph }) {
//   return (
//     <div>
//       <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1">
//         <span className="text-slate-400">{icon}</span> {label}
//       </label>
//       <input value={val} onChange={e=>set(e.target.value)} placeholder={ph}
//         className="w-full bg-white rounded-lg px-3 py-2 text-xs text-slate-900 border border-slate-300 focus:border-indigo-400 outline-none placeholder:text-slate-400 transition"/>
//     </div>
//   );
// }

// function Field({ label, children }) {
//   return (
//     <div>
//       <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
//       {children}
//     </div>
//   );
// }

// function Acc({ title, open, toggle, children }) {
//   return (
//     <div className="border border-slate-200 rounded-xl overflow-hidden mb-3 bg-white shadow-sm">
//       <button type="button" onClick={toggle}
//         className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-indigo-50/20 text-slate-800 font-bold text-sm transition">
//         {title}
//         {open ? <FaChevronUp className="text-indigo-500"/> : <FaChevronDown className="text-indigo-500"/>}
//       </button>
//       {open && <div className="p-4 border-t border-slate-100 bg-slate-50/40">{children}</div>}
//     </div>
//   );
// }

// function LineBox({ title, onAdd, addLabel="Add", addColor="indigo", children }) {
//   return (
//     <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
//       <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
//         <span className="font-bold text-sm text-slate-800">{title}</span>
//         <button type="button" onClick={onAdd}
//           className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition shadow-sm",
//             addColor==="emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700")}>
//           <FaPlus size={10}/> {addLabel}
//         </button>
//       </div>
//       <div className="overflow-x-auto p-2">{children}</div>
//     </div>
//   );
// }

// function DelBtn({ onClick }) {
//   return (
//     <button type="button" onClick={onClick}
//       className="h-8 w-8 rounded-lg bg-slate-800 text-white hover:bg-slate-700 flex items-center justify-center transition">
//       <FaTrash size={11}/>
//     </button>
//   );
// }

// function Totals({ qty, val, valid, labels=["Valid Lines","Total Quantity","Total Value (₹)"] }) {
//   return (
//     <div className="mt-4 grid grid-cols-3 gap-3">
//       {[
//         [labels[0], valid, "slate"],
//         [labels[1], qty,   "slate"],
//         [labels[2], `₹${Number(val||0).toLocaleString("en-IN",{minimumFractionDigits:2})}`, "green"],
//       ].map(([label,value,tone]) => (
//         <div key={label} className={cn("rounded-xl px-4 py-3 border",
//           tone==="green" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-700 border-slate-200")}>
//           <div className="text-[10px] font-black tracking-widest uppercase opacity-70">{label}</div>
//           <div className="mt-1 text-xl font-black">{value}</div>
//         </div>
//       ))}
//     </div>
//   );
// }

// function ModalFooter({ onClose, onSave, saving, label, color="indigo" }) {
//   return (
//     <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
//       <button type="button" onClick={onClose}
//         className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition text-sm">
//         Close
//       </button>
//       <button type="button" onClick={onSave} disabled={saving}
//         className={cn("inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-bold transition shadow-sm disabled:opacity-50",
//           color==="emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700")}>
//         {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Saving…</> : <><FaSave size={13}/> {label}</>}
//       </button>
//     </div>
//   );
// }

// function ModalShell({ title, onClose, children }) {
//   return (
//     <div className="fixed inset-0 z-[999]">
//       <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
//       <div className="absolute inset-0 bg-white flex flex-col">
//         <div className="sticky top-0 z-10 bg-white px-5 py-4 flex items-center justify-between shadow-sm border-b border-slate-200"
//           style={{paddingTop:"calc(env(safe-area-inset-top,0px) + 12px)"}}>
//           <h2 className="text-lg font-bold text-slate-900">{title}</h2>
//           <button type="button" onClick={onClose}
//             className="h-9 w-9 grid place-items-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition">
//             <FaTimes/>
//           </button>
//         </div>
//         <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4"
//           style={{paddingBottom:"calc(env(safe-area-inset-bottom,0px) + 16px)"}}>
//           <div className="max-w-[1600px] mx-auto">{children}</div>
//         </div>
//       </div>
//     </div>
//   );
// }




import React, { useEffect, useMemo, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  FaExchangeAlt, FaWarehouse, FaLayerGroup, FaFilter,
  FaBuilding, FaSearch, FaPlus, FaSave, FaTrash,
  FaEdit, FaFilePdf, FaTimes, FaChevronDown, FaChevronUp,
  FaSync, FaInbox, FaClock, FaCheckCircle,
} from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API = APP_API_URL;
const API_BASE = `${API}/stock-transfers`;

/* ─── helpers ─── */
const cn = (...a) => a.filter(Boolean).join(" ");
const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sumQty = (lines = []) => lines.reduce((a, l) => a + (Number(l.qty) || 0), 0);
const sumVal = (lines = []) => lines.reduce((a, l) => a + (Number(l.value) || 0), 0);
const cryptoId = () => `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;

function todayStamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth()+1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function todayYmd() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth()+1)}-${d.getFullYear()}`;
}
function genInvoiceRef() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `DSP-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
const pInt = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : ""; };
const pFlt = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, n) : ""; };

/* ─── styles ─── */
const INP = "w-full bg-white rounded-lg px-3 py-2 text-sm text-slate-900 border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none placeholder:text-slate-400 transition";
const RO  = "bg-slate-100 cursor-not-allowed text-slate-600 border-slate-200 focus:ring-0";

/* ─── Store context ─── */
const storeId   = localStorage.getItem("store_id")   || "";
const storeName = localStorage.getItem("store_name") || "";
const isHQ      = !storeId;

const token   = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
const authHdr = { Authorization: `Bearer ${token}` };

/* ─── PDF helpers (unchanged) ─── */
const drawFooter = (doc, y, color, rec) => {
  const tq = sumQty(rec.lines), tv = sumVal(rec.lines);
  doc.setFillColor(248,250,252); doc.rect(340,y,215,60,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(71,85,105);
  doc.text("Total Items:",        355, y+18); doc.setFont("helvetica","normal"); doc.setTextColor(30,41,59); doc.text(String((rec.lines||[]).length), 540, y+18, {align:"right"});
  doc.setFont("helvetica","bold"); doc.setTextColor(71,85,105);
  doc.text("Total Qty Transferred:", 355, y+33); doc.setFont("helvetica","normal"); doc.setTextColor(30,41,59); doc.text(String(tq), 540, y+33, {align:"right"});
  doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(...color);
  doc.text("Total Net Value (Rs):", 355, y+50); doc.text(`Rs. ${tv.toFixed(2)}`, 540, y+50, {align:"right"});
  const sy = y+100;
  doc.setDrawColor(203,213,225); doc.setLineWidth(1);
  [[40,"Prepared By / Dispatcher"],[230,"Checked By / Store Incharge"],[420,"Received By / Signatory"]].forEach(([x,lbl]) => {
    doc.line(x,sy,x+130,sy); doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100,116,139); doc.text(lbl, x, sy+12);
  });
};

const printRecord = (rec) => {
  const isOut = rec.type === "Out";
  const title = isOut ? "STOCK TRANSFER CHALLAN (DISPATCH)" : "GOODS RECEIPT NOTE (RECEIPT)";
  const color = isOut ? [79,70,229] : [5,150,105];
  const doc = new jsPDF({orientation:"portrait",unit:"pt",format:"a4"});
  doc.setDrawColor(...color); doc.setLineWidth(4); doc.line(40,40,555,40);
  doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.setTextColor(...color); doc.text(title,40,65);
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(100,116,139);
  doc.text("RETAIL MANAGEMENT SYSTEM (RMS) - STOCK MODULE",40,80);
  doc.setDrawColor(226,232,240); doc.setLineWidth(1); doc.line(40,92,555,92);

  const li=[], ri=[];
  if (isOut) {
    li.push(["Challan Ref No:",rec.refNo||"N/A"],["Date & Time:",rec.date||"N/A"],["Owner Site:",rec.ownerSite||"N/A"],["Source Warehouse:",rec.fromWh||"N/A"],["Destination Site:",rec.toWh||"N/A"],["Invoice Number:",rec.invoiceNo||"N/A"],["Transfer Ledger:",rec.transferLedger||"N/A"]);
    ri.push(["Document No:",rec.documentNo||"N/A"],["Document Date:",rec.documentDate||"N/A"],["Status:",rec.status||"Dispatched"],["Created By:",rec.createdBy||"System"],["Transporter:",rec.transporter||"N/A"],["Transit Days:",rec.transitDays?`${rec.transitDays} Days`:"N/A"],["Agent/Carrier:",rec.agent||"N/A"]);
  } else {
    li.push(["GRN Ref No:",rec.refNo||"N/A"],["Date & Time:",rec.date||"N/A"],["Owner Site:",rec.ownerSite||"N/A"],["Source Site:",rec.fromWh||"N/A"],["Destination WH:",rec.toWh||"N/A"],["Linked Out Ref:",rec.outDocNo||"N/A"],["Transfer Ledger:",rec.transferLedger||"N/A"]);
    ri.push(["Document No:",rec.documentNo||"N/A"],["Document Date:",rec.documentDate||"N/A"],["Status:",rec.status||"Received"],["Gate Entry No:",rec.gateEntryNo||"N/A"],["Logistic AWB No:",rec.logisticNo||"N/A"],["Gate Qty / AWB Qty:",`${rec.gateEntryQty||0} / ${rec.logisticQty||0}`],["Agent/Carrier:",rec.agent||"N/A"]);
  }
  let sy=110;
  for (let i=0; i<Math.max(li.length,ri.length); i++) {
    if (li[i]) { doc.setFont("helvetica","bold"); doc.setTextColor(71,85,105); doc.text(li[i][0],40,sy); doc.setFont("helvetica","normal"); doc.setTextColor(30,41,59); doc.text(String(li[i][1]),150,sy); }
    if (ri[i]) { doc.setFont("helvetica","bold"); doc.setTextColor(71,85,105); doc.text(ri[i][0],310,sy); doc.setFont("helvetica","normal"); doc.setTextColor(30,41,59); doc.text(String(ri[i][1]),420,sy); }
    sy+=16;
  }
  sy+=15;
  doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(...color); doc.text("TRANSFER ITEM LINES",40,sy); sy+=10;
  autoTable(doc,{
    head:[["#","Barcode","Item Description","Qty","Rate (Rs)","Amount (Rs)"]],
    body:(rec.lines||[]).map((l,i)=>[i+1,l.barcode||"N/A",l.product||"N/A",l.qty||0,Number(l.rate||0).toFixed(2),Number((l.qty||0)*(l.rate||0)).toFixed(2)]),
    startY:sy,
    styles:{font:"helvetica",fontSize:9,cellPadding:6},
    headStyles:{fillColor:color,textColor:[255,255,255],fontStyle:"bold"},
    alternateRowStyles:{fillColor:[248,250,252]},
    columnStyles:{0:{width:30,halign:"center"},1:{width:110},2:{width:220},3:{width:50,halign:"right"},4:{width:70,halign:"right"},5:{width:80,halign:"right"}},
    margin:{left:40,right:40},
  });
  const fy = doc.lastAutoTable.finalY+25;
  if (fy>600) { doc.addPage(); drawFooter(doc,60,color,rec); } else { drawFooter(doc,fy,color,rec); }
  doc.save(`Transfer-${rec.refNo||"record"}.pdf`);
};

/* ─── empty form (Out only — In is now auto-created via Receive) ─── */
const emptyOut = () => ({
  date:todayStamp(), refNo:"", createdBy:"", ownerSite: isHQ ? "Central Inventory" : storeName,
  invoiceNo: genInvoiceRef(), documentNo:"", documentDate:"", toWh:"", to_store_id: "",
  tradeGroup:"", transferLedger:"", transferSubLedger:"", transitDays:"",
  transporter:"", agent:"", customer:"", salesTerm:"", transitInLedger:"",
  transitInSubLedger:"", transitDueDate:"", creditDueDate:"", commissionRate:"",
  logisticsNo:"", declarationAmount:"", logisticsDate:"", remarks:"",
  challans:[{id:cryptoId(),challanNo:"",challanBarcode:"",challanDate:todayYmd()}],
  lines:[{lineId:cryptoId(),sku:"",barcode:"",product:"",available:0,qty:"",rate:0,value:0,ledgerName:"",subLedgerName:"",remarks:""}],
});

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   Tabs: Transfer Out (dispatch history) | Pending Receipts | Transfer In (received history)
   Manual "Create Transfer In" is REMOVED — In docs are only created
   automatically when a Pending receipt is confirmed via /receive.
══════════════════════════════════════════════════════════════════ */
export default function StockTransfer() {
  const [activeTab,   setActiveTab]   = useState("out");
  const [records,     setRecords]     = useState([]);
  const [pending,     setPending]     = useState([]);
  const [stores,      setStores]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [receivingId, setReceivingId] = useState(null);

  const [editId,   setEditId]   = useState(null);
  const [openOut,  setOpenOut]  = useState(false);
  const [formOut,  setFormOut]  = useState(emptyOut());

  const [secOut, setSecOut] = useState({general:true,additional:false,quickScan:false,itemInfo:false});
  const [subOut, setSubOut] = useState({logistics:false,others:false});

  // filters
  const [search,        setSearch]       = useState("");
  const [outOwnerSite,  setOutOwnerSite] = useState("");
  const [outToWh,       setOutToWh]      = useState("");
  const [outInvoiceNo,  setOutInvoiceNo] = useState("");
  const [outDocNo,      setOutDocNo]     = useState("");
  const [outTransporter,setOutTransporter]=useState("");
  const [outStatus,     setOutStatus]    = useState("");

  /* ── fetch ── */
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(API_BASE + "/", { headers: authHdr });
      const data = await res.json();
      setRecords(Array.isArray(data.data) ? data.data : []);
    } catch { toast.error("Failed to load transfers"); }
    finally   { setLoading(false); }
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const location = isHQ ? "central" : storeId;
      const res  = await fetch(`${API_BASE}/pending/${location}`, { headers: authHdr });
      const data = await res.json();
      setPending(Array.isArray(data.data) ? data.data : []);
    } catch { toast.error("Failed to load pending receipts"); }
    finally { setLoading(false); }
  }, []);

  const fetchStores = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/superadmin/stores/list`, { headers: authHdr });
      const data = await res.json();
      setStores(Array.isArray(data.stores) ? data.stores : []);
    } catch {}
  }, []);

  // Stock lookup for barcode auto-fill
  const [stockLookup, setStockLookup] = useState([]);
  const fetchStockLookup = useCallback(async () => {
    try {
      const url = isHQ
        ? `${API}/stock-allocation/central-stock`
        : `${API}/stock-allocation/store-stock/${storeId}`;
      const res  = await fetch(url, { headers: authHdr });
      const data = await res.json();
      setStockLookup(Array.isArray(data.data) ? data.data : []);
    } catch {}
  }, []);

  useEffect(() => { fetchAll(); fetchPending(); fetchStores(); fetchStockLookup(); }, [fetchAll, fetchPending, fetchStores, fetchStockLookup]);
  useEffect(() => {
    if (activeTab === "pending") fetchPending();
  }, [activeTab]);

  /* ── filtered (Out tab = dispatched by me, In tab = received by me) ── */
  const outRecords = useMemo(() => records.filter(r => r.type === "Out"), [records]);
  const inRecords  = useMemo(() => records.filter(r => r.type === "In"),  [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = activeTab === "out" ? outRecords : inRecords;
    return base.filter(rec => {
      if (activeTab === "out") {
        if (outOwnerSite  && !(rec.ownerSite||"").toLowerCase().includes(outOwnerSite.toLowerCase()))  return false;
        if (outToWh       && !(rec.toWh||"").toLowerCase().includes(outToWh.toLowerCase()))            return false;
        if (outInvoiceNo  && !(rec.invoiceNo||"").toLowerCase().includes(outInvoiceNo.toLowerCase()))  return false;
        if (outDocNo      && !(rec.documentNo||"").toLowerCase().includes(outDocNo.toLowerCase()))     return false;
        if (outTransporter&& !(rec.transporter||"").toLowerCase().includes(outTransporter.toLowerCase()))return false;
        if (outStatus     && !(rec.status||"").toLowerCase().includes(outStatus.toLowerCase()))        return false;
      }
      if (q) {
        const hit = [rec.refNo,rec.documentNo,rec.invoiceNo,rec.transporter,rec.gateEntryNo,rec.logisticNo]
          .some(f=>(f||"").toLowerCase().includes(q))
          || (rec.lines||[]).some(l=>[l.product,l.sku,l.barcode].some(f=>(f||"").toLowerCase().includes(q)));
        if (!hit) return false;
      }
      return true;
    });
  }, [outRecords, inRecords, activeTab, search, outOwnerSite, outToWh, outInvoiceNo, outDocNo, outTransporter, outStatus]);

  /* ── line helpers ── */
 const setLineOut = (lineId, patch) => setFormOut(s => ({
    ...s, lines: s.lines.map(l => {
      if (l.lineId !== lineId) return l;
      const u = {...l,...patch};
      if ("qty" in patch || "rate" in patch) u.value = (Number(u.qty)||0)*(Number(u.rate)||0);
      // Auto-fill product + rate when barcode is typed
      if ("barcode" in patch && patch.barcode.trim()) {
        const found = stockLookup.find(r => r.barcode === patch.barcode.trim());
        if (found) {
          u.product = found.description || found.product || u.product;
          u.rate    = found.rate || u.rate;
          u.value   = (Number(u.qty)||0) * (Number(u.rate)||0);
        }
      }
      return u;
    })
  }));

  /* ── save (Dispatch — creates a Transfer Out, deducts source immediately) ── */
  const handleSave = async () => {
    if (isHQ && !formOut.to_store_id) { toast.error("Select a destination store."); return; }
    const lines = formOut.lines.filter(l => (l.product||"").trim() && Number(l.qty) > 0);
    if (!lines.length) { toast.error("At least one valid line is required."); return; }

    const payload = {
      from_store_id: isHQ ? null : storeId,
      to_store_id:   isHQ ? formOut.to_store_id : null,   // store admins dispatch back to central only
      invoiceNo:     (formOut.invoiceNo || genInvoiceRef()).trim(),
      documentNo:    formOut.documentNo,
      documentDate:  formOut.documentDate,
      date:          formOut.date,
      createdBy:     formOut.createdBy || localStorage.getItem("admin_name") || "Inventory",
      tradeGroup:    formOut.tradeGroup,
      transferLedger:    formOut.transferLedger,
      transferSubLedger: formOut.transferSubLedger,
      transitDays:   formOut.transitDays,
      transporter:   formOut.transporter,
      agent:         formOut.agent,
      remarks:       formOut.remarks,
      challans:      formOut.challans,
      logisticsNo:       formOut.logisticsNo,
      logisticsDate:     formOut.logisticsDate,
      declarationAmount: formOut.declarationAmount,
      lines: lines.map(l => ({...l, qty: Number(l.qty)||0, rate: Number(l.rate)||0, value: (Number(l.qty)||0)*(Number(l.rate)||0)})),
    };

    try {
      setSaving(true);
      const url    = editId ? `${API_BASE}/${editId}` : `${API_BASE}/`;
      const method = editId ? "PUT" : "POST";
      const res    = await fetch(url, {method, headers:{...authHdr,"Content-Type":"application/json"}, body: JSON.stringify(payload)});
      const data   = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      toast.success(data.message || "Stock dispatched — awaiting receipt confirmation.");
      setOpenOut(false);
      setEditId(null);
      await fetchAll();
      await fetchPending();
      if (data.data) printRecord(data.data);
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /* ── delete (only allowed while status === Dispatched) ── */
  const handleDelete = async (rec) => {
    if (rec.status !== "Dispatched") {
      toast.error("Only Dispatched (not yet received) transfers can be cancelled.");
      return;
    }
    if (!window.confirm("Cancel this dispatch? Stock will be returned to source.")) return;
    try {
      const res  = await fetch(`${API_BASE}/${rec.id}`, {method:"DELETE", headers: authHdr});
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Cancel failed");
      toast.success(data.message || "Cancelled");
      await fetchAll();
      await fetchPending();
    } catch (e) { toast.error(e.message); }
  };

  /* ── edit (only allowed while status === Dispatched) ── */
  const handleEdit = (rec) => {
    if (rec.status !== "Dispatched") {
      toast.error("Only Dispatched (not yet received) transfers can be edited.");
      return;
    }
    setEditId(rec.id);
    setFormOut({
      date:rec.date||"", refNo:rec.refNo||"", createdBy:rec.createdBy||"",
      ownerSite:rec.ownerSite||"", invoiceNo:rec.invoiceNo||"",
      documentNo:rec.documentNo||"", documentDate:rec.documentDate||"",
      toWh:rec.toWh||"", to_store_id: rec.to_store_id || "",
      tradeGroup:rec.tradeGroup||"",
      transferLedger:rec.transferLedger||"", transferSubLedger:rec.transferSubLedger||"",
      transitDays:rec.transitDays||"", transporter:rec.transporter||"",
      agent:rec.agent||"", customer:rec.customer||"",
      salesTerm:rec.salesTerm||"", transitInLedger:rec.transitInLedger||"",
      transitInSubLedger:rec.transitInSubLedger||"", transitDueDate:rec.transitDueDate||"",
      creditDueDate:rec.creditDueDate||"", commissionRate:rec.commissionRate||"",
      logisticsNo:rec.logisticsNo||"", declarationAmount:rec.declarationAmount||"",
      logisticsDate:rec.logisticsDate||"", remarks:rec.remarks||"",
      challans:(rec.challans||[]).map(c=>({...c,id:cryptoId()})),
      lines:(rec.lines||[]).map(l=>({...l,lineId:cryptoId()})),
    });
    setOpenOut(true);
  };

  /* ── Receive (confirms a Pending dispatch — adds stock at destination) ── */
  const handleReceive = async (transferId) => {
    try {
      setReceivingId(transferId);
      const res = await fetch(`${API_BASE}/${transferId}/receive`, {
        method: "POST",
        headers: { ...authHdr, "Content-Type": "application/json" },
        body: JSON.stringify({ receivedBy: localStorage.getItem("admin_name") || "Admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Receive failed");
      toast.success(data.message || "Receipt confirmed — stock added.");
      await fetchPending();
      await fetchAll();
      if (data.data?.in) printRecord(data.data.in);
    } catch (e) {
      toast.error(e.message || "Receive failed");
    } finally {
      setReceivingId(null);
    }
  };

  /* ── PDF export (bulk) ── */
  const exportPdf = () => {
    const createdOn = todayYmd();
    const targetRecs = filtered;
    if (!targetRecs.length) { toast.error("No records to export."); return; }

    const doc    = new jsPDF({orientation:"landscape",unit:"pt",format:"a4"});
    const isOut  = activeTab === "out";
    const color  = isOut ? [79,70,229] : [5,150,105];
    const title  = isOut ? "Stock Transfer Outward (Dispatch) Report" : "Stock Transfer Inward (Receipt) Report";

    doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.setTextColor(15,23,42); doc.text(title,40,45);
    doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(100,116,139);
    doc.text(`Generated: ${createdOn} | RMS`,40,62);

    const head = isOut
      ? [["Date","Ref No","Invoice","From","To","Status","SKU","Barcode","Product","Qty","Rate","Value"]]
      : [["Date","Ref No","From Out Ref","Source","Dest","Status","SKU","Barcode","Product","Qty","Rate","Value"]];

    const body = [];
    targetRecs.forEach(rec => {
      (rec.lines||[]).forEach(l => {
        body.push([
          rec.date, rec.refNo,
          isOut ? rec.invoiceNo||"N/A" : rec.outDocNo||"N/A",
          rec.fromWh, rec.toWh, rec.status||"",
          l.sku||"", l.barcode||"", l.product||"",
          String(l.qty||0),
          `Rs.${Number(l.rate||0).toFixed(2)}`,
          `Rs.${Number((l.qty||0)*(l.rate||0)).toFixed(2)}`
        ]);
      });
    });

    autoTable(doc,{head,body,startY:85,styles:{font:"helvetica",fontSize:7,cellPadding:4},headStyles:{fillColor:color,textColor:[255,255,255]},alternateRowStyles:{fillColor:[248,250,252]},columnStyles:{9:{halign:"right"},10:{halign:"right"},11:{halign:"right"}},margin:{left:40,right:40}});

    const pc = doc.internal.getNumberOfPages();
    for (let i=1;i<=pc;i++) { doc.setPage(i); doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(148,163,184); doc.text(`Page ${i} of ${pc}`,750,565); }
    doc.save(`stock-transfer-${activeTab}-${createdOn}.pdf`);
    toast.success("PDF exported!");
  };

  /* ── totals ── */
  const totOut = useMemo(() => ({ qty: sumQty(formOut.lines), val: sumVal(formOut.lines), valid: formOut.lines.filter(l=>(l.product||"").trim()&&Number(l.qty)>0).length }), [formOut.lines]);

  /* ── ESC close ── */
  useEffect(() => {
    if (!openOut) return;
    const h = e => { if (e.key === "Escape") { setOpenOut(false); setEditId(null); } };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown",h); document.body.style.overflow = ""; };
  }, [openOut]);

  const clearFilters = () => {
    setSearch(""); setOutOwnerSite(""); setOutToWh(""); setOutInvoiceNo(""); setOutDocNo(""); setOutTransporter(""); setOutStatus("");
  };
  const hasFilters = search||outOwnerSite||outToWh||outInvoiceNo||outDocNo||outTransporter||outStatus;

  return (
    <div className="min-h-full w-full px-3 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <FaExchangeAlt className="text-indigo-600 text-2xl shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Stock Transfer & Logistics</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isHQ ? "Dispatch stock to stores — they confirm receipt to complete the transfer" : `Manage stock movement for ${storeName || "your store"}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { fetchAll(); fetchPending(); }} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition shadow-sm">
            <FaSync size={12} /> Refresh
          </button>
          <button onClick={exportPdf} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition shadow-sm">
            <FaFilePdf /> Export PDF
          </button>
          <button onClick={() => { setEditId(null); setFormOut(emptyOut()); setSecOut({general:true,additional:false,quickScan:false,itemInfo:false}); setSubOut({logistics:false,others:false}); setOpenOut(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-sm">
            <FaPlus /> {isHQ ? "Dispatch to Store" : "Return to Central"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-max shadow-inner">
        {[
          { key: "out",     label: "Transfer Out",     count: outRecords.length },
          { key: "pending", label: "Pending Receipts",  count: pending.length, badge: true },
          { key: "in",      label: "Transfer In",       count: inRecords.length },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn("flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition",
              activeTab===tab.key ? "bg-white text-indigo-700 shadow border border-slate-200" : "text-slate-500 hover:text-slate-800")}>
            {tab.label}
            <span className={cn("px-2 py-0.5 text-xs font-bold rounded-full",
              tab.badge && tab.count > 0 ? "bg-amber-500 text-white" :
              activeTab===tab.key ? "bg-indigo-100 text-indigo-800" : "bg-slate-300 text-slate-600")}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ══════════════════════ TAB: OUT / IN — same table ══════════════════════ */}
      {(activeTab === "out" || activeTab === "in") && (
        <>
          {/* Filters (Out tab only — In is read-only history) */}
          {activeTab === "out" && (
            <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <FiltInput label="Owner Site"  icon={<FaBuilding/>}   val={outOwnerSite}  set={setOutOwnerSite}  ph="Filter..." />
                <FiltInput label="Destination" icon={<FaWarehouse/>}  val={outToWh}       set={setOutToWh}       ph="Filter..." />
                <FiltInput label="Invoice No"  icon={<FaLayerGroup/>} val={outInvoiceNo}  set={setOutInvoiceNo}  ph="Filter..." />
                <FiltInput label="Document No" icon={<FaLayerGroup/>} val={outDocNo}      set={setOutDocNo}      ph="Filter..." />
                <FiltInput label="Transporter" icon={<FaWarehouse/>}  val={outTransporter}set={setOutTransporter} ph="Filter..." />
                <FiltInput label="Status"      icon={<FaFilter/>}     val={outStatus}     set={setOutStatus}     ph="Dispatched / Received" />
                <div>
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1"><FaSearch className="text-slate-400"/> Search</label>
                  <div className="flex items-center gap-2 rounded-lg px-3 bg-slate-50 border border-slate-300">
                    <FaSearch className="text-slate-400 shrink-0" size={12}/>
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="General search..." className="bg-transparent outline-none w-full text-xs py-2"/>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Showing <b className="text-slate-900">{filtered.length}</b> records</span>
                {hasFilters && <button onClick={clearFilters} className="text-indigo-600 hover:text-indigo-800 font-bold">Clear Filters</button>}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-auto max-h-[56vh]">
              <table className="w-full text-sm min-w-[1100px]">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
                  <tr>
                    {["Date","Ref No / Doc No","From","To","Logistics / Details","Lines","Total Qty","Value","Status","Actions"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={10} className="py-16 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin"/>
                        Loading transfers…
                      </div>
                    </td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={10} className="py-16 text-center text-slate-400">
                      {activeTab === "out" ? "No dispatches found. Create one above." : "No receipts yet. Confirm a Pending Receipt to see it here."}
                    </td></tr>
                  ) : filtered.map(rec => {
                    const tv = sumVal(rec.lines||[]);
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{rec.date}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-bold text-slate-800 text-xs">{rec.refNo}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{rec.documentNo||"—"}</div>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-medium text-slate-700 whitespace-nowrap">{rec.fromWh||"—"}</td>
                        <td className="px-3 py-2.5 text-xs font-medium text-slate-700 whitespace-nowrap">{rec.toWh||"—"}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {rec.type==="Out"
                            ? <><span className="font-semibold">Transporter:</span> {rec.transporter||"—"}<br/><span className="font-semibold">Transit:</span> {rec.transitDays?`${rec.transitDays} Days`:"—"}</>
                            : <><span className="font-semibold">Out Ref:</span> {rec.outDocNo||"—"}<br/><span className="font-semibold">Received By:</span> {rec.createdBy||"—"}</>}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-slate-700">{(rec.lines||[]).length}</td>
                        <td className="px-3 py-2.5 text-xs font-bold text-slate-800">{sumQty(rec.lines||[])}</td>
                        <td className="px-3 py-2.5 text-xs font-black text-indigo-700 whitespace-nowrap">₹{money(tv)}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border",
                            rec.status==="Received" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : rec.status==="Dispatched" ? "bg-amber-50 text-amber-700 border-amber-200"
                            : rec.status==="Partially Received" ? "bg-sky-50 text-sky-700 border-sky-200"
                            : "bg-slate-50 text-slate-600 border-slate-200")}>
                            {rec.status||"—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1.5">
                            <button onClick={() => printRecord(rec)} title="Print" className="h-7 px-2 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-200 text-xs font-bold transition"><FaFilePdf size={11}/></button>
                            {rec.type === "Out" && rec.status === "Dispatched" && (
                              <>
                                <button onClick={() => handleEdit(rec)} className="h-7 px-2.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold transition flex items-center gap-1"><FaEdit size={10}/> Edit</button>
                                <button onClick={() => handleDelete(rec)} className="h-7 px-2.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition flex items-center gap-1"><FaTrash size={10}/> Cancel</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                <span>Showing {filtered.length} records</span>
                <span>Total Value: <b className="text-indigo-700">₹{money(filtered.reduce((s,r)=>s+sumVal(r.lines||[]),0))}</b></span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════ TAB: PENDING RECEIPTS ══════════════════════ */}
      {activeTab === "pending" && (
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /> Loading…
            </div>
          ) : pending.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <FaCheckCircle className="text-emerald-400 text-3xl mx-auto mb-3" />
              <p className="text-sm text-slate-500">No pending receipts. Everything dispatched to {isHQ ? "Central" : "this store"} has been received.</p>
            </div>
          ) : (
            pending.map((tr) => (
              <div key={tr.id} className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <FaClock className="text-amber-600" />
                    <div>
                      <p className="text-sm font-bold text-amber-900">{tr.refNo}</p>
                      <p className="text-xs text-amber-600">From: {tr.fromWh || "Central"} · Transporter: {tr.transporter || "—"} · Dispatched {tr.date}</p>
                    </div>
                  </div>
                  <button onClick={() => handleReceive(tr.id)} disabled={receivingId === tr.id}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-50">
                    {receivingId === tr.id
                      ? (<><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Confirming…</>)
                      : (<><FaCheckCircle size={12} /> Confirm Receipt</>)}
                  </button>
                </div>
                <div className="p-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 uppercase font-bold">
                        <th className="text-left pb-2">Barcode</th>
                        <th className="text-left pb-2">Product</th>
                        <th className="text-right pb-2">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(tr.lines || []).map((l, i) => (
                        <tr key={i}>
                          <td className="py-1.5 font-mono text-slate-600">{l.barcode}</td>
                          <td className="py-1.5 text-slate-800">{l.product}</td>
                          <td className="py-1.5 text-right font-bold text-slate-700">{l.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-xs">
                    <span className="text-slate-400">Total {tr.lines?.length || 0} line(s)</span>
                    <span className="font-bold text-slate-700">Qty: {tr.totalQty}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══════════════════════ MODAL: DISPATCH (Transfer Out) ══════════════════════ */}
      {openOut && (
        <ModalShell title={editId ? "Edit Dispatch" : (isHQ ? "Dispatch to Store" : "Return to Central")} onClose={() => { setOpenOut(false); setEditId(null); }}>

          <Acc title="General Information" open={secOut.general} toggle={() => setSecOut(s=>({...s,general:!s.general}))}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-4">
                <Field label="Owner Site">
                  <input className={cn(INP, RO)} value={formOut.ownerSite} readOnly/>
                </Field>
                <Field label={<>Invoice / Reference No <span className="text-slate-400 font-normal">(auto-generated, editable)</span></>}>
                  <input className={INP} value={formOut.invoiceNo} onChange={e=>setFormOut(s=>({...s,invoiceNo:e.target.value}))} placeholder="Auto-generated"/>
                </Field>
                <Field label="Document No">
                  <input className={INP} value={formOut.documentNo} onChange={e=>setFormOut(s=>({...s,documentNo:e.target.value}))} placeholder="Doc no"/>
                </Field>
                {isHQ ? (
                  <Field label="Destination Store / Branch *">
                    <select className={INP} value={formOut.to_store_id}
                      onChange={e=>{
                        const s = stores.find(x=>x.id===e.target.value);
                        setFormOut(prev=>({...prev, to_store_id: e.target.value, toWh: s ? s.name : ""}));
                      }}>
                      <option value="">— Select store or branch —</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code}) — {s.type}{s.city ? `, ${s.city}` : ""}</option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Destination">
                    <input className={cn(INP, RO)} value="Central Inventory" readOnly/>
                  </Field>
                )}
                <Field label="Trade Group">
                  <input className={INP} value={formOut.tradeGroup} onChange={e=>setFormOut(s=>({...s,tradeGroup:e.target.value}))}/>
                </Field>
                <Field label="Transfer Out Ledger">
                  <input className={INP} value={formOut.transferLedger} onChange={e=>setFormOut(s=>({...s,transferLedger:e.target.value}))}/>
                </Field>
              </div>
              <div className="flex flex-col gap-4">
                <Field label="Date & Time *">
                  <input className={INP} value={formOut.date} onChange={e=>setFormOut(s=>({...s,date:e.target.value}))}/>
                </Field>
                <Field label="Document Date">
                  <input className={INP} value={formOut.documentDate} onChange={e=>setFormOut(s=>({...s,documentDate:e.target.value}))} placeholder="DD-MM-YYYY"/>
                </Field>
                <Field label="Customer">
                  <input className={INP} value={formOut.customer} onChange={e=>setFormOut(s=>({...s,customer:e.target.value}))}/>
                </Field>
                <Field label="Sales Term">
                  <input className={INP} value={formOut.salesTerm} onChange={e=>setFormOut(s=>({...s,salesTerm:e.target.value}))}/>
                </Field>
                <Field label="Transfer Out Sub Ledger">
                  <input className={INP} value={formOut.transferSubLedger} onChange={e=>setFormOut(s=>({...s,transferSubLedger:e.target.value}))}/>
                </Field>
              </div>
            </div>
          </Acc>

          <Acc title="Additional Details" open={secOut.additional} toggle={() => setSecOut(s=>({...s,additional:!s.additional}))}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-4">
                <Field label="Transit In Ledger"><input className={INP} value={formOut.transitInLedger} onChange={e=>setFormOut(s=>({...s,transitInLedger:e.target.value}))}/></Field>
                <Field label="Transit Days"><input type="number" min="0" className={INP} value={formOut.transitDays} onChange={e=>setFormOut(s=>({...s,transitDays:pInt(e.target.value)}))}/></Field>
                <Field label="Transporter"><input className={INP} value={formOut.transporter} onChange={e=>setFormOut(s=>({...s,transporter:e.target.value}))}/></Field>
                <Field label="Agent"><input className={INP} value={formOut.agent} onChange={e=>setFormOut(s=>({...s,agent:e.target.value}))}/></Field>
              </div>
              <div className="flex flex-col gap-4">
                <Field label="Transit In Sub Ledger"><input className={INP} value={formOut.transitInSubLedger} onChange={e=>setFormOut(s=>({...s,transitInSubLedger:e.target.value}))}/></Field>
                <Field label="Transit Due Date"><input className={INP} value={formOut.transitDueDate} onChange={e=>setFormOut(s=>({...s,transitDueDate:e.target.value}))} placeholder="DD-MM-YYYY"/></Field>
                <Field label="Credit Due Date"><input className={INP} value={formOut.creditDueDate} onChange={e=>setFormOut(s=>({...s,creditDueDate:e.target.value}))} placeholder="DD-MM-YYYY"/></Field>
                <Field label="Commission Rate"><input className={INP} value={formOut.commissionRate} onChange={e=>setFormOut(s=>({...s,commissionRate:e.target.value}))}/></Field>
              </div>
            </div>
          </Acc>

          <Acc title="Item Information (Logistics & Others)" open={secOut.itemInfo} toggle={() => setSecOut(s=>({...s,itemInfo:!s.itemInfo}))}>
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-3">
              <button type="button" onClick={() => setSubOut(s=>({...s,logistics:!s.logistics}))}
                className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition">
                Logistics {subOut.logistics ? <FaChevronUp/> : <FaChevronDown/>}
              </button>
              {subOut.logistics && (
                <div className="p-4 grid grid-cols-3 gap-3">
                  <Field label="Logistics No"><input className={INP} value={formOut.logisticsNo} onChange={e=>setFormOut(s=>({...s,logisticsNo:e.target.value}))}/></Field>
                  <Field label="Declaration Amount"><input type="number" min="0" className={INP} value={formOut.declarationAmount} onChange={e=>setFormOut(s=>({...s,declarationAmount:pFlt(e.target.value)}))}/></Field>
                  <Field label="Date"><input className={INP} value={formOut.logisticsDate} onChange={e=>setFormOut(s=>({...s,logisticsDate:e.target.value}))} placeholder="DD-MM-YYYY"/></Field>
                </div>
              )}
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button type="button" onClick={() => setSubOut(s=>({...s,others:!s.others}))}
                className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition">
                Others {subOut.others ? <FaChevronUp/> : <FaChevronDown/>}
              </button>
              {subOut.others && (
                <div className="p-4">
                  <Field label="Remarks / Note">
                    <textarea className={INP} rows={2} value={formOut.remarks} onChange={e=>setFormOut(s=>({...s,remarks:e.target.value}))} placeholder="Additional remarks..."/>
                  </Field>
                </div>
              )}
            </div>
          </Acc>

          {/* Challans */}
          <LineBox title="Challan Details" onAdd={() => setFormOut(s=>({...s,challans:[...s.challans,{id:cryptoId(),challanNo:"",challanBarcode:"",challanDate:todayYmd()}]}))}>
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>{["Challan No","Challan Barcode","Challan Date",""].map(h=><th key={h} className="px-3 py-2 text-left text-xs font-bold text-slate-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {formOut.challans.map(c => (
                  <tr key={c.id}>
                    <td className="px-3 py-2"><input className={INP} value={c.challanNo} onChange={e=>setFormOut(s=>({...s,challans:s.challans.map(x=>x.id===c.id?{...x,challanNo:e.target.value}:x)}))}/></td>
                    <td className="px-3 py-2"><input className={INP} value={c.challanBarcode} onChange={e=>setFormOut(s=>({...s,challans:s.challans.map(x=>x.id===c.id?{...x,challanBarcode:e.target.value}:x)}))}/></td>
                    <td className="px-3 py-2"><input className={INP} value={c.challanDate} onChange={e=>setFormOut(s=>({...s,challans:s.challans.map(x=>x.id===c.id?{...x,challanDate:e.target.value}:x)}))}/></td>
                    <td className="px-3 py-2 text-center"><DelBtn onClick={()=>{ if(formOut.challans.length<=1){toast.error("At least one challan required");return;} setFormOut(s=>({...s,challans:s.challans.filter(x=>x.id!==c.id)})); }}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </LineBox>

          {/* Transfer Lines */}
          <LineBox title="Items to Dispatch" onAdd={() => setFormOut(s=>({...s,lines:[...s.lines,{lineId:cryptoId(),sku:"",barcode:"",product:"",available:0,qty:"",rate:0,value:0,ledgerName:"",subLedgerName:"",remarks:""}]}))}>
            <div className="max-h-[35vh] overflow-auto">
              <table className="w-full text-sm min-w-[1200px]">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                  <tr>{["Barcode","Item Description","Qty","Rate (₹)","Value (₹)","Ledger","Sub Ledger",""].map(h=><th key={h} className="px-3 py-2 text-left text-xs font-bold text-slate-500 whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {formOut.lines.map(l => (
                    <tr key={l.lineId} className="hover:bg-slate-50">
                      <td className="px-2 py-1.5 w-44"><input className={cn(INP,"font-mono text-xs")} value={l.barcode} onChange={e=>setLineOut(l.lineId,{barcode:e.target.value})} placeholder="Barcode"/></td>
                      <td className="px-2 py-1.5 min-w-[200px]"><input className={INP} value={l.product} onChange={e=>setLineOut(l.lineId,{product:e.target.value})} placeholder="Item description"/></td>
                      <td className="px-2 py-1.5 w-24"><input type="number" min="0" className={INP} value={l.qty} onChange={e=>setLineOut(l.lineId,{qty:pInt(e.target.value)})} placeholder="0"/></td>
                      <td className="px-2 py-1.5 w-28"><input type="number" min="0" className={INP} value={l.rate} onChange={e=>setLineOut(l.lineId,{rate:pFlt(e.target.value)})} placeholder="0.00"/></td>
                      <td className="px-2 py-1.5 w-28"><input className={cn(INP,RO)} value={`₹${money(l.value)}`} readOnly/></td>
                      <td className="px-2 py-1.5 w-32"><input className={INP} value={l.ledgerName} onChange={e=>setLineOut(l.lineId,{ledgerName:e.target.value})} placeholder="Ledger"/></td>
                      <td className="px-2 py-1.5 w-32"><input className={INP} value={l.subLedgerName} onChange={e=>setLineOut(l.lineId,{subLedgerName:e.target.value})} placeholder="Sub Ledger"/></td>
                      <td className="px-2 py-1.5 text-center"><DelBtn onClick={()=>{ if(formOut.lines.length<=1){toast.error("At least one line required");return;} setFormOut(s=>({...s,lines:s.lines.filter(x=>x.lineId!==l.lineId)})); }}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </LineBox>

          <Totals qty={totOut.qty} val={totOut.val} valid={totOut.valid}/>
          <ModalFooter onClose={()=>{setOpenOut(false);setEditId(null);}} onSave={handleSave} saving={saving} label={editId ? "Save Changes" : "Dispatch Stock"} color="indigo"/>
        </ModalShell>
      )}
    </div>
  );
}

/* ── UI primitives (unchanged) ── */
function FiltInput({ label, icon, val, set, ph }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1">
        <span className="text-slate-400">{icon}</span> {label}
      </label>
      <input value={val} onChange={e=>set(e.target.value)} placeholder={ph}
        className="w-full bg-white rounded-lg px-3 py-2 text-xs text-slate-900 border border-slate-300 focus:border-indigo-400 outline-none placeholder:text-slate-400 transition"/>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Acc({ title, open, toggle, children }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-3 bg-white shadow-sm">
      <button type="button" onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-indigo-50/20 text-slate-800 font-bold text-sm transition">
        {title}
        {open ? <FaChevronUp className="text-indigo-500"/> : <FaChevronDown className="text-indigo-500"/>}
      </button>
      {open && <div className="p-4 border-t border-slate-100 bg-slate-50/40">{children}</div>}
    </div>
  );
}

function LineBox({ title, onAdd, addLabel="Add", addColor="indigo", children }) {
  return (
    <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
        <span className="font-bold text-sm text-slate-800">{title}</span>
        <button type="button" onClick={onAdd}
          className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition shadow-sm",
            addColor==="emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700")}>
          <FaPlus size={10}/> {addLabel}
        </button>
      </div>
      <div className="overflow-x-auto p-2">{children}</div>
    </div>
  );
}

function DelBtn({ onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="h-8 w-8 rounded-lg bg-slate-800 text-white hover:bg-slate-700 flex items-center justify-center transition">
      <FaTrash size={11}/>
    </button>
  );
}

function Totals({ qty, val, valid, labels=["Valid Lines","Total Quantity","Total Value (₹)"] }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-3">
      {[
        [labels[0], valid, "slate"],
        [labels[1], qty,   "slate"],
        [labels[2], `₹${Number(val||0).toLocaleString("en-IN",{minimumFractionDigits:2})}`, "green"],
      ].map(([label,value,tone]) => (
        <div key={label} className={cn("rounded-xl px-4 py-3 border",
          tone==="green" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-700 border-slate-200")}>
          <div className="text-[10px] font-black tracking-widest uppercase opacity-70">{label}</div>
          <div className="mt-1 text-xl font-black">{value}</div>
        </div>
      ))}
    </div>
  );
}

function ModalFooter({ onClose, onSave, saving, label, color="indigo" }) {
  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
      <button type="button" onClick={onClose}
        className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition text-sm">
        Close
      </button>
      <button type="button" onClick={onSave} disabled={saving}
        className={cn("inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-bold transition shadow-sm disabled:opacity-50",
          color==="emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700")}>
        {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Saving…</> : <><FaSave size={13}/> {label}</>}
      </button>
    </div>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[999]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="absolute inset-0 bg-white flex flex-col">
        <div className="sticky top-0 z-10 bg-white px-5 py-4 flex items-center justify-between shadow-sm border-b border-slate-200"
          style={{paddingTop:"calc(env(safe-area-inset-top,0px) + 12px)"}}>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition">
            <FaTimes/>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4"
          style={{paddingBottom:"calc(env(safe-area-inset-bottom,0px) + 16px)"}}>
          <div className="max-w-[1600px] mx-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}