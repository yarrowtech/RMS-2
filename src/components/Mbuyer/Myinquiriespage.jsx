import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useState, useEffect, useCallback } from "react";
import { MessageSquare, RefreshCw, CheckCircle2, Trophy, Filter, ShoppingBag, Plus, Trash2, ArrowLeft, Download, Scale } from "lucide-react";

/**
 * MyInquiriesPage.jsx
 * ======================
 * The missing piece: a persistent, standalone page showing EVERY inquiry
 * this tenant has ever sent, across all vendors, regardless of which flow
 * created it (single-vendor browse, multi-vendor compare, or Ã¢â‚¬â€ once real
 * Ã¢â‚¬â€ WhatsApp). Fixes two real gaps found by tracing the code:
 *
 *   1. QuickOrderFromCatalogue.jsx tracked its comparison group / single
 *      inquiry ID only in React state Ã¢â‚¬â€ navigate away or refresh and
 *      that thread is gone permanently, with no way back to it.
 *   2. The only other inquiry list (VendorCatalogueBrowserModal.jsx's
 *      "My Inquiries" tab) filters to `vendor_id === vendorId` Ã¢â‚¬â€ it only
 *      ever shows ONE vendor's inquiries, whichever is currently selected
 *      in the PO form it's nested inside. There was no page showing
 *      everything.
 *
 * Talks to the existing GET /api/catalogue/inquiries (list_my_inquiries)
 * Ã¢â‚¬â€ already returns every inquiry for this tenant, unfiltered; it just
 * had nothing pointed at it. No backend change needed for the list itself.
 *
 * Route this in as its own page, e.g.:
 *   <Route path="/inquiries" element={<MyInquiriesPage />} />
 * and it becomes the durable home for anything sent via QuickOrder,
 * single-vendor browse, or compare-search Ã¢â‚¬â€ reachable any time, not just
 * mid-wizard.
 */

const API_BASE = APP_API_URL;

function getAdminToken() {
  return (
    localStorage.getItem("admin_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

async function authFetch(url, options = {}) {
  const token = getAdminToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_ITEM = () => ({ description: "", quantity: "", rate: "", remarks: "" });

const STATUS_TABS = ["All", "Pending", "Responded", "Countered", "Expired", "Closed", "Cancelled", "Declined", "Converted"];
const statusStyle = {
  Pending:   "bg-amber-100 text-amber-700",
  Responded: "bg-emerald-100 text-emerald-700",
  Countered: "bg-violet-100 text-violet-700",
  Expired: "bg-orange-100 text-orange-700",
  Closed: "bg-slate-200 text-slate-700",
  Cancelled: "bg-rose-100 text-rose-700",
  Declined:  "bg-rose-100 text-rose-700",
  Converted: "bg-indigo-100 text-indigo-700",
};

export default function MyInquiriesPage() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [convertingId, setConvertingId] = useState(null);
  const [convertError, setConvertError] = useState(null);
  const [counterDrafts, setCounterDrafts] = useState({});
  const [counteringId, setCounteringId] = useState(null);
  const [counterError, setCounterError] = useState(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [awardQuantities, setAwardQuantities] = useState({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState(null);
  const [awardJustification, setAwardJustification] = useState("");
  const [awardRequestKey, setAwardRequestKey] = useState(null);
  const [approvalAwards, setApprovalAwards] = useState([]);
  const [approvalBusyId, setApprovalBusyId] = useState(null);

  // Order-creation drawer Ã¢â‚¬â€ appears after converting a Responded inquiry
  const [orderDraft, setOrderDraft] = useState(null); // { vendorName, items }
  const [orderDate, setOrderDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submittedOrderNo, setSubmittedOrderNo] = useState(null);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/catalogue/inquiries`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || `Failed to load (${res.status}).`);
      setInquiries(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  const filtered = statusFilter === "All" ? inquiries : inquiries.filter(i => i.status === statusFilter);

  const updateCounterDraft = (id, key, value) => setCounterDrafts(previous => ({
    ...previous, [id]: { target_price: "", target_qty: "", message: "", ...(previous[id] || {}), [key]: value },
  }));

  const sendCounteroffer = async (inq) => {
    const draft = counterDrafts[inq._id] || {};
    setCounteringId(inq._id);
    setCounterError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/${inq._id}/counteroffer`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to send counteroffer.");
      setCounterDrafts(previous => ({ ...previous, [inq._id]: { target_price: "", target_qty: "", message: "" } }));
      fetchInquiries();
    } catch (err) {
      setCounterError({ id: inq._id, message: err.message });
    } finally {
      setCounteringId(null);
    }
  };

  const changeLifecycle = async (inq, action) => {
    let payload = {};
    if (action === "reopen") {
      const deadline = window.prompt("New response deadline (YYYY-MM-DD, optional)", "");
      if (deadline === null) return;
      payload = { response_deadline: deadline };
    } else if (!window.confirm(`${action[0].toUpperCase()+action.slice(1)} this inquiry?`)) return;
    try {
      const res=await authFetch(`${API_BASE}/api/catalogue/inquiries/${inq._id}/${action}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const json=await res.json();if(!res.ok)throw new Error(json.detail||`Could not ${action} inquiry.`);
      fetchInquiries();
    } catch(err){setError(err.message)}
  };

  const convert = async (inq) => {
    setConvertingId(inq._id);
    setConvertError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/${inq._id}/convert`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to convert.");
      setOrderDraft({
        vendorName: json.vendor_name || inq.vendor_name || "",
        items: [{
          description: json.po_item_prefill.description,
          quantity:    String(json.po_item_prefill.quantity),
          rate:        String(json.po_item_prefill.rate),
          remarks:     json.po_item_prefill.remarks || "",
        }],
      });
      fetchInquiries();
    } catch (err) {
      setConvertError({ id: inq._id, message: err.message });
    } finally {
      setConvertingId(null);
    }
  };

  const updateDraftItem = (idx, key, val) => setOrderDraft(prev => ({
    ...prev,
    items: prev.items.map((it, i) => i === idx ? { ...it, [key]: val } : it),
  }));
  const addDraftItem = () => setOrderDraft(prev => ({ ...prev, items: [...prev.items, EMPTY_ITEM()] }));
  const removeDraftItem = (idx) => setOrderDraft(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const submitOrder = async () => {
    setSubmitError(null);
    if (!orderDraft.vendorName.trim()) { setSubmitError("Vendor name is required."); return; }
    const validItems = orderDraft.items.filter(it => it.description.trim() && Number(it.quantity) > 0);
    if (validItems.length === 0) { setSubmitError("At least one item with a description and quantity is required."); return; }

    setSubmitting(true);
    try {
      const payload = {
        orderDate,
        vendorName: orderDraft.vendorName.trim(),
        vendor_type: "registered",
        items: validItems.map(it => ({
          description: it.description.trim(),
          quantity:    Number(it.quantity) || 0,
          rate:        Number(it.rate) || 0,
          remarks:     it.remarks || "",
        })),
      };
      const res = await authFetch(`${API_BASE}/purchaseorders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create purchase order.");
      setSubmittedOrderNo(data.orderNo || data.id || "created");
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchApprovalAwards = useCallback(async () => {
    try {
      const res=await authFetch(`${API_BASE}/api/catalogue/inquiries/awards?status=Submitted`);
      const json=await res.json(); if(res.ok)setApprovalAwards(Array.isArray(json.data) ? json.data.map(award => ({...award, lines:Array.isArray(award.lines)?award.lines:[], purchase_orders:Array.isArray(award.purchase_orders)?award.purchase_orders:[]})) : []);
    } catch { /* approval queue remains available on next refresh */ }
  }, []);

  useEffect(()=>{ fetchApprovalAwards(); },[fetchApprovalAwards]);

  const decideAward = async (award, decision) => {
    const input=window.prompt(decision==="approve" ? "Approval comment (optional)" : "Rejection reason (required)", "");
    if(input===null || (decision==="reject"&&!input.trim()))return;
    setApprovalBusyId(award.id);setBulkMessage(null);
    try{
      const res=await authFetch(`${API_BASE}/api/catalogue/inquiries/awards/${award.id}/${decision}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(decision==="approve"?{comment:input}:{reason:input})});
      const json=await res.json();if(!res.ok)throw new Error(json.detail||`Could not ${decision} award.`);
      setBulkMessage({type:"success",text:decision==="approve"?`Award approved; ${json.purchase_orders?.length||0} vendor PO(s) created.`:"Award rejected."});
      fetchApprovalAwards();fetchInquiries();
    }catch(err){setBulkMessage({type:"error",text:err.message})}finally{setApprovalBusyId(null)}
  };

  const respondedQuotes = inquiries.filter(inq => inq.status === "Responded" && Number(inq.vendor_response?.confirmed_price) > 0);
  const selectedAwards = respondedQuotes.filter(inq => Number(awardQuantities[inq._id]) > 0);

  const setAwardQuantity = (inq, value) => {
    const maximum = Number(inq.vendor_response?.confirmed_qty || 0);
    const quantity = Math.max(0, Math.min(Number(value) || 0, maximum));
    setAwardQuantities(previous => ({ ...previous, [inq._id]: quantity || "" }));
    setAwardRequestKey(null);
  };

  const exportComparison = async format => {
    if (!selectedAwards.length) return setBulkMessage({ type:"error", text:"Select at least one quotation and enter an award quantity." });
    setBulkBusy(true); setBulkMessage(null);
    try {
      const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/export`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ inquiry_ids:selectedAwards.map(inq=>inq._id), format, award_quantities:Object.fromEntries(selectedAwards.map(inq=>[inq._id,Number(awardQuantities[inq._id])])) }),
      });
      if (!res.ok) { const json=await res.json().catch(()=>({})); throw new Error(json.detail||"Export failed."); }
      const blob=await res.blob(); const url=URL.createObjectURL(blob); const link=document.createElement("a");
      link.href=url; link.download=`quotation_comparison.${format}`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch (err) { setBulkMessage({type:"error",text:err.message}); }
    finally { setBulkBusy(false); }
  };

  const createAwardedPurchaseOrders = async () => {
    if (!selectedAwards.length) return setBulkMessage({ type:"error", text:"Enter an award quantity for at least one quotation." });
    setBulkBusy(true); setBulkMessage(null);
    const requestKey = awardRequestKey || crypto.randomUUID();
    if (!awardRequestKey) setAwardRequestKey(requestKey);
    try {
      const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/awards/create-pos`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          idempotency_key:requestKey,
          justification:awardJustification,
          awards:selectedAwards.map(inq=>({inquiry_id:inq._id,quantity:Number(awardQuantities[inq._id])})),
        }),
      });
      const json=await res.json();
      if(!res.ok) {
        if (res.status !== 409) setAwardRequestKey(null);
        throw new Error(json.detail||"Award and PO creation failed.");
      }
      const created=(json.purchase_orders||[]).map(po=>`${po.vendor_name}: ${po.order_no||po.po_id}`).join(" | ");
      setBulkMessage({type:"success",text:json.status==="Submitted" ? `Award submitted for approval because it meets the INR ${Number(json.approval_threshold||0).toLocaleString("en-IN")} threshold.` : `Award completed. Created ${json.purchase_orders?.length||0} purchase order(s)${created?`: ${created}`:""}`});
      setAwardQuantities({}); setAwardJustification(""); setAwardRequestKey(null); fetchInquiries(); fetchApprovalAwards();
    } catch (err) {
      setBulkMessage({type:"error",text:err.message});
      // Keep the key on a network-level unknown result; retrying then safely
      // replays the completed server response instead of duplicating POs.
    } finally { setBulkBusy(false); }
  };

  const closeDraft = () => {
    setOrderDraft(null);
    setSubmittedOrderNo(null);
    setSubmitError(null);
    setOrderDate(today());
  };

  return (
    <div className="min-h-full bg-[#F6F7FB] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-5">

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">My Inquiries</h1>
            <p className="text-xs text-slate-500">Every inquiry you've sent, across all vendors &mdash; persisted here regardless of how it was started</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-4 py-3 rounded-xl">Error: {error}</div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
            {STATUS_TABS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${statusFilter === s ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                {s} {s !== "All" && `(${inquiries.filter(i => i.status === s).length})`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setComparisonOpen(value=>!value)} className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white"><Scale className="h-3.5 w-3.5" /> Compare & Award ({respondedQuotes.length})</button>
            <button onClick={fetchInquiries} className="text-xs font-bold text-indigo-600 flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          </div>
        </div>

        {approvalAwards.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-black text-amber-900">Award approval queue</h2><p className="text-[11px] text-amber-700">High-value awards require approval by a different administrator.</p></div><button onClick={fetchApprovalAwards} className="text-xs font-bold text-amber-800">Refresh</button></div>
            <div className="space-y-2">{approvalAwards.map(award=><div key={award.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3"><div><p className="text-xs font-black text-slate-800">?{Number(award.total_value||0).toLocaleString("en-IN")} ? {(award.lines || []).length} award line(s)</p><p className="mt-0.5 text-[11px] text-slate-500">{award.justification||"No justification supplied"}</p><p className="mt-0.5 text-[10px] text-slate-400">Submitted by {award.created_by||"unknown"}</p></div><div className="flex gap-2"><button disabled={approvalBusyId===award.id} onClick={()=>decideAward(award,"reject")} className="h-8 rounded-lg border border-rose-200 px-3 text-[11px] font-bold text-rose-600 disabled:opacity-50">Reject</button><button disabled={approvalBusyId===award.id} onClick={()=>decideAward(award,"approve")} className="h-8 rounded-lg bg-emerald-600 px-3 text-[11px] font-bold text-white disabled:opacity-50">Approve & create POs</button></div></div>)}</div>
          </div>
        )}

        {comparisonOpen && (
          <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 bg-violet-50 px-4 py-3"><div><h2 className="text-sm font-black text-violet-900">Quotation comparison & vendor award</h2><p className="text-[11px] text-violet-600">Enter the quantity to award. The same product may be split between vendors.</p></div><div className="flex gap-2"><button disabled={bulkBusy} onClick={()=>exportComparison("xlsx")} className="flex h-8 items-center gap-1 rounded-lg border border-violet-200 bg-white px-3 text-[11px] font-bold text-violet-700"><Download className="h-3 w-3"/>Excel</button><button disabled={bulkBusy} onClick={()=>exportComparison("pdf")} className="flex h-8 items-center gap-1 rounded-lg border border-violet-200 bg-white px-3 text-[11px] font-bold text-violet-700"><Download className="h-3 w-3"/>PDF</button></div></div>
            <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{["Product","Vendor","Size / Color","Available","Unit price","Landed cost","Payment / Lead","Award qty","Award value"].map(h=><th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody>{respondedQuotes.map(inq=>{const vr=inq.vendor_response||{};const qty=Number(awardQuantities[inq._id]||0);return <tr key={inq._id} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-slate-800">{inq.item_name}</td><td className="px-3 py-2">{inq.vendor_name}</td><td className="px-3 py-2">{vr.confirmed_size||"Not provided"} / {vr.confirmed_color||"Not provided"}</td><td className="px-3 py-2">{vr.confirmed_qty}</td><td className="px-3 py-2 font-bold text-emerald-700">&#8377;{vr.confirmed_price}</td><td className="px-3 py-2 font-bold text-violet-700">&#8377;{Number(vr.landed_cost ?? ((vr.confirmed_price*vr.confirmed_qty)||0)).toLocaleString("en-IN")}</td><td className="px-3 py-2"><b>{vr.payment_terms||"Not provided"}</b><br/><span className="text-[10px] text-slate-400">{vr.credit_days||0} credit days ? {vr.lead_time_days||0} lead days</span></td><td className="px-3 py-2"><input type="number" min="0" max={vr.confirmed_qty} value={awardQuantities[inq._id]||""} onChange={e=>setAwardQuantity(inq,e.target.value)} placeholder="0" className="h-8 w-24 rounded border border-slate-200 px-2"/></td><td className="px-3 py-2 font-black text-violet-700">&#8377;{(qty*Number(vr.confirmed_price||0)).toLocaleString("en-IN")}</td></tr>})}{!respondedQuotes.length&&<tr><td colSpan="9" className="px-4 py-8 text-center text-slate-400">No responded quotations are ready for comparison.</td></tr>}</tbody></table></div>
            <div className="border-t border-slate-100 px-4 pt-3"><label className="text-[11px] font-bold text-slate-600">Award justification / approval note</label><input value={awardJustification} onChange={e=>{setAwardJustification(e.target.value);setAwardRequestKey(null)}} placeholder="Why these vendors were selected (price, quality, lead time, terms...)" className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs" /></div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="text-xs font-bold text-slate-700">{selectedAwards.length} quotation(s) selected - Total INR {selectedAwards.reduce((sum,inq)=>sum+Number(awardQuantities[inq._id]||0)*Number(inq.vendor_response?.confirmed_price||0),0).toLocaleString("en-IN")}</p>{bulkMessage&&<p className={`mt-1 text-[11px] font-semibold ${bulkMessage.type==="error"?"text-rose-600":"text-emerald-600"}`}>{bulkMessage.text}</p>}</div><button disabled={bulkBusy||!selectedAwards.length} onClick={createAwardedPurchaseOrders} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-40">{bulkBusy?"Processing...":"Award & create vendor POs"}</button></div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">No inquiries here</p>
            <p className="text-xs text-slate-400 mt-1">Sent inquiries from Quick Order or vendor browsing will show up here.</p>
          </div>
        ) : (
          // Ã¢Å¡ Ã¯Â¸Â NEW Ã¢â‚¬â€ grouped by item_name, same fix applied to the
          // comparison views (VendorCompareSearch.jsx, QuickOrderFromCatalogue
          // .jsx's step 2). This page spans every inquiry ever sent, across
          // every search session Ã¢â‚¬â€ without grouping, "Cotton T-Shirt" and
          // "Floral Kurti" quotes from completely different days interleaved
          // with no way to see them as separate product threads.
          (() => {
            const groups = [];
            const groupIndex = new Map();
            for (const inq of filtered) {
              const key = inq.item_name || "Other";
              if (!groupIndex.has(key)) {
                groupIndex.set(key, groups.length);
                groups.push({ item_name: key, rows: [] });
              }
              groups[groupIndex.get(key)].rows.push(inq);
            }
            return (
              <div className="space-y-5">
                {groups.map(group => (
                  <div key={group.item_name}>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">
                      {group.item_name} <span className="font-normal normal-case text-slate-400">&mdash; {group.rows.length}</span>
                    </p>
                    <div className="space-y-2">
                      {group.rows.map(inq => {
                        const vr = inq.vendor_response || {};
                        return (
                          <div key={inq._id} className="bg-white rounded-xl border border-slate-200 p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                {inq.item_image && <img src={inq.item_image} className="w-8 h-8 rounded object-cover shrink-0" />}
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-900 truncate">{inq.vendor_name || "Unknown Vendor"}</p>
                                </div>
                              </div>
                              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyle[inq.status] || "bg-slate-100"}`}>
                                {inq.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 mb-1.5">
                              <div>Size: <b className="text-slate-700">{inq.requested_size || "Not provided"}</b></div>
                              <div>Color: <b className="text-slate-700">{inq.requested_color || "Not provided"}</b></div>
                              <div>Qty: <b className="text-slate-700">{inq.requested_qty || "Not provided"}</b></div>
                            </div>
                            {["Responded", "Countered"].includes(inq.status) && (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs mb-2">
                                <p className="font-bold text-emerald-700 mb-1">Vendor's response:</p>
                                <p>&#8377;{vr.confirmed_price} &middot; qty {vr.confirmed_qty} &middot; {vr.confirmed_size}/{vr.confirmed_color}</p>
                                {vr.vendor_note && <p className="italic mt-1">"{vr.vendor_note}"</p>}
                                <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-emerald-800 sm:grid-cols-4">
                                  <span>Landed: <b>&#8377;{Number(vr.landed_cost ?? ((vr.confirmed_price*vr.confirmed_qty)||0)).toLocaleString("en-IN")}</b></span>
                                  <span>Tax: <b>{vr.tax_pct||0}%</b></span><span>Discount: <b>{vr.discount_pct||0}%</b></span><span>Freight: <b>&#8377;{vr.freight||0}</b></span><span>Other: <b>&#8377;{vr.other_charges||0}</b></span>
                                  <span>Payment: <b>{vr.payment_terms||"Not provided"}</b></span><span>Credit: <b>{vr.credit_days||0} days</b></span><span>Lead: <b>{vr.lead_time_days||0} days</b></span><span>Valid: <b>{vr.quote_valid_until||"Not provided"}</b></span>
                                </div>
                              </div>
                            )}
                            {inq.negotiation_history?.length > 0 && (
                              <details className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                                <summary className="cursor-pointer font-bold text-slate-600">Negotiation history ({inq.negotiation_history.length})</summary>
                                <div className="mt-2 space-y-2">
                                  {inq.negotiation_history.map((event, index) => (
                                    <div key={index} className={`rounded-md p-2 ${event.actor === "buyer" ? "bg-violet-50 text-violet-800" : "bg-white text-slate-700"}`}>
                                      <p className="font-bold">{event.actor === "buyer" ? "Buyer counteroffer" : "Vendor quotation"}{event.price > 0 ? ` - INR ${event.price}` : ""}{event.quantity > 0 ? ` - qty ${event.quantity}` : ""}</p>
                                      {event.message && <p className="mt-0.5">{event.message}</p>}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                            {inq.status === "Responded" && (
                              <div className="mb-2 rounded-lg border border-violet-200 bg-violet-50 p-2">
                                <p className="mb-2 text-xs font-bold text-violet-700">Negotiate this quotation</p>
                                <div className="grid grid-cols-2 gap-2">
                                  <input type="number" min="0" placeholder="Counter price (INR)" value={counterDrafts[inq._id]?.target_price || ""} onChange={e=>updateCounterDraft(inq._id,"target_price",e.target.value)} className="h-8 rounded border border-violet-200 px-2 text-xs" />
                                  <input type="number" min="1" placeholder="Target quantity" value={counterDrafts[inq._id]?.target_qty || ""} onChange={e=>updateCounterDraft(inq._id,"target_qty",e.target.value)} className="h-8 rounded border border-violet-200 px-2 text-xs" />
                                </div>
                                <input placeholder="Message or requested terms" value={counterDrafts[inq._id]?.message || ""} onChange={e=>updateCounterDraft(inq._id,"message",e.target.value)} className="mt-2 h-8 w-full rounded border border-violet-200 px-2 text-xs" />
                                {counterError?.id === inq._id && <p className="mt-1 text-[11px] font-semibold text-rose-600">{counterError.message}</p>}
                                <button onClick={()=>sendCounteroffer(inq)} disabled={counteringId===inq._id} className="mt-2 h-8 w-full rounded bg-violet-600 text-xs font-bold text-white disabled:opacity-50">{counteringId===inq._id?"Sending...":"Send counteroffer"}</button>
                              </div>
                            )}
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {["Pending","Responded","Countered","Expired"].includes(inq.status) && <button onClick={()=>changeLifecycle(inq,"close")} className="rounded border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600">Close</button>}
                              {["Pending","Responded","Countered","Expired","Closed"].includes(inq.status) && <button onClick={()=>changeLifecycle(inq,"cancel")} className="rounded border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-600">Cancel</button>}
                              {["Expired","Closed","Cancelled"].includes(inq.status) && <button onClick={()=>changeLifecycle(inq,"reopen")} className="rounded border border-indigo-200 px-2 py-1 text-[10px] font-bold text-indigo-600">Reopen</button>}
                              {inq.response_deadline && <span className="ml-auto text-[10px] text-slate-400">Response due {inq.response_deadline}</span>}
                            </div>
                            {inq.status === "Responded" && (
                              <>
                                <button onClick={() => convert(inq)} disabled={convertingId === inq._id}
                                  className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
                                  <ShoppingBag className="w-3.5 h-3.5" /> {convertingId === inq._id ? "Preparing order..." : "Convert to Purchase Order"}
                                </button>
                                {convertError?.id === inq._id && (
                                  <p className="mt-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                                    Error: {convertError.message}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </div>

      {/* Order-creation drawer Ã¢â‚¬â€ appears once a Responded inquiry is converted */}
      {orderDraft && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            {submittedOrderNo ? (
              <div className="p-8 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <p className="text-lg font-black text-slate-900">Purchase order created</p>
                <p className="text-sm text-slate-500">Order {submittedOrderNo} &mdash; {orderDraft.vendorName}</p>
                <button onClick={closeDraft} className="mt-4 h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold">
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">Review & create order</h2>
                  <button onClick={closeDraft} className="text-xs font-bold text-slate-500">&larr; Back</button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {submitError && (
                    <div className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">Error: {submitError}</div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">Vendor</label>
                      <input value={orderDraft.vendorName}
                        onChange={e => setOrderDraft(prev => ({ ...prev, vendorName: e.target.value }))}
                        className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">Order date</label>
                      <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
                        className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-600">Items</label>
                      <button onClick={addDraftItem} className="text-xs font-bold text-indigo-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Add item</button>
                    </div>
                    <div className="space-y-2">
                      {orderDraft.items.map((it, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_70px_80px_1fr_28px] gap-2 items-center">
                          <input placeholder="Description" value={it.description} onChange={e => updateDraftItem(idx, "description", e.target.value)} className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
                          <input type="number" placeholder="Qty" value={it.quantity} onChange={e => updateDraftItem(idx, "quantity", e.target.value)} className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
                          <input type="number" placeholder="Rate" value={it.rate} onChange={e => updateDraftItem(idx, "rate", e.target.value)} className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
                          <input placeholder="Remarks" value={it.remarks} onChange={e => updateDraftItem(idx, "remarks", e.target.value)} className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
                          <button onClick={() => removeDraftItem(idx)} disabled={orderDraft.items.length === 1}
                            className="h-9 w-9 flex items-center justify-center text-rose-500 disabled:opacity-30">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
                  <button onClick={submitOrder} disabled={submitting}
                    className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold disabled:opacity-60">
                    {submitting ? "Creating order..." : "Create purchase order"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

