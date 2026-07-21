import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import VendorCatalogueBrowserModal from "./Vendorcataloguebrowsermodal.jsx";
import VendorCompareSearch from "./Vendorcomparesearch.jsx";

const API_BASE = `${APP_API_URL}/purchaseorders`;

// â”€â”€ Shared auth helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Every route this file calls (purchaseorders, /api/vendors/approved,
// /api/products/vendor/{id}, /inventory/*) now requires an HQ admin's Bearer
// token — added during the tenant-isolation pass. This file previously sent
// NO auth header on ANY fetch call. getAdminToken() uses the same
// localStorage fallback chain used elsewhere in this app (admin_token →
// access_token → token); authFetch() is a drop-in replacement for fetch()
// that attaches it automatically.
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

const n0 = (v) => {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp0 = (v) => Math.max(0, n0(v));
const money = (v) =>
  clamp0(v).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const EMPTY_ITEM = () => ({
  barcode: "",
  description: "",
  originalQty: "",
  quantity: "",
  amendedQty: "",
  receivedQty: "",
  cancelledQty: "",
  pendingQty: 0,
  rate: "",
  tolerancePct: "",
  dueDate: "",
  remarks: "",
  removed: false,
});

const EMPTY_SCHEDULE_ROW = (seq = 1) => ({ seq, date: "", percentage: "", quantity: "" });

const EMPTY_WALKIN = () => ({
  name: "", contact_person: "", mobile: "",
  email: "", address: "", gstin: "", pan: "",
});

function flattenVendorProducts(products = []) {
  const rows = [];
  for (const p of products) {
    if (!p.has_variants) {
      rows.push({
        product_name: p.product_name || "",
        sku:          p.sku     || "",
        barcode:      p.barcode || "",
        color:        "",
        originalQty:  p.quantity ?? 0,
        rate:         p.selling_price ?? p.mrp ?? 0,
        label:        p.product_name || "",
        sublabel:     `SKU: ${p.sku || "—"} · BC: ${p.barcode || "—"} · Stock: ${p.quantity ?? 0}`,
      });
    } else {
      for (const v of (p.variants || [])) {
        const labelParts = [p.product_name];
        if (v.size_label) labelParts.push(v.size_label);
        if (labelParts.length === 1 && v.sku) {
          labelParts.push(v.sku.split("-").slice(-1)[0]);
        }
        rows.push({
          product_name: labelParts.join(" | "),
          sku:          v.sku     || "",
          barcode:      v.barcode || "",
          color:        v.color   || "",
          size_label:   v.size_label  || "",
          size_value:   v.size_value  || "",
          originalQty:  v.stock   ?? 0,
          rate:         v.selling_price ?? v.mrp ?? 0,
          label:        labelParts.join(" — "),
          sublabel:     [
            `SKU: ${v.sku || "—"}`,
            `BC: ${v.barcode || "—"}`,
            v.size_value ? `Size: ${v.size_value}` : "",
            v.color      ? `Colour: ${v.color}`    : "",
            `Stock: ${v.stock ?? 0}`,
          ].filter(Boolean).join(" · "),
        });
      }
    }
  }
  return rows;
}

/* ================================================================
   SHARE PO MODAL
================================================================ */
function SharePOModal({ po, onClose }) {
  const [linkData,  setLinkData]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [copied,    setCopied]    = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);

  useEffect(() => {
    authFetch(`${API_BASE}/share/${po.id}/link`)
      .then(r => r.json())
      .then(j => setLinkData(j))
      .catch(() => alert("Failed to load share link"))
      .finally(() => setLoading(false));
  }, [po.id]);

  const copyLink = () => {
    navigator.clipboard.writeText(linkData.share_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyMsg = () => {
    navigator.clipboard.writeText(linkData.whatsapp_message);
    setMsgCopied(true);
    setTimeout(() => setMsgCopied(false), 2000);
  };

  const openWhatsApp = () => {
    const mob = (linkData.whatsapp_mobile || "").replace(/\D/g, "");
    const txt = encodeURIComponent(linkData.whatsapp_message);
    window.open(mob ? `https://wa.me/${mob}?text=${txt}` : `https://wa.me/?text=${txt}`, "_blank");
  };

  const wv = po.walkin_vendor || {};

  return (
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-5 py-4" style={{ background: "linear-gradient(135deg,#059669,#047857)" }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest mb-1">Share Purchase Order</p>
              <p className="text-xl font-black text-white">{po.orderNo}</p>
              <p className="text-xs text-emerald-100 mt-1">{wv.name || po.vendorName} · {po.orderDate}</p>
            </div>
            <button onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white hover:bg-white/20 transition text-xl font-bold">
              ×
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Generating link…</div>
          ) : linkData ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["Vendor",   wv.name || po.vendorName || "—"],
                  ["Mobile",   wv.mobile || "—"],
                  ["Viewed",   linkData.po_viewed_at?.includes("Not") ? "Not yet" : "✓ Viewed"],
                  ["Accepted", linkData.vendor_accepted_at?.includes("Not") ? "Not yet" : "✓ Accepted"],
                ].map(([label, val]) => (
                  <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">{label}</p>
                    <p className="font-bold text-slate-800 mt-0.5">{val}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Shareable Link</p>
                <div className="flex gap-2">
                  <input readOnly value={linkData.share_link}
                    className="flex-1 h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-600 outline-none" />
                  <button onClick={copyLink}
                    className={`h-9 px-4 rounded-lg text-white text-xs font-bold transition ${copied ? "bg-emerald-600" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                    {copied ? "✓ Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">WhatsApp Message</p>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-xs text-emerald-900 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                  {linkData.whatsapp_message}
                </div>
              </div>

              <p className="text-[10px] text-center text-slate-400">
                🔒 Link expires: {new Date(linkData.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>

              <div className="flex gap-2">
                <button onClick={copyMsg}
                  className="flex-1 h-11 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition">
                  {msgCopied ? "✓ Copied" : "📋 Copy Message"}
                </button>
                <button onClick={openWhatsApp}
                  className="flex-1 h-11 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition"
                  style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
                  </svg>
                  Send on WhatsApp
                </button>
              </div>
            </>
          ) : (
            <div className="text-center text-rose-600 py-6 text-sm">Failed to load share link.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MAIN MANAGER
================================================================ */
export default function PurchaseOrderManager() {
  const [orders,       setOrders]       = useState([]);
  const [openPO,       setOpenPO]       = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [deletingOrder,setDeletingOrder]= useState(null);
  const [loading,      setLoading]      = useState(false);
  const [reviewOrder,  setReviewOrder]  = useState(null);
  const [shareOrder,   setShareOrder]   = useState(null);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Trailing slash — the backend route is registered as "/", under
      // prefix "/purchaseorders", so the real path is "/purchaseorders/".
      const res = await authFetch(`${API_BASE}/`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(Array.isArray(data) ? data.reverse() : []);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setEditingOrder(null); setOpenPO(true); };
  const openEdit   = (order) => { setEditingOrder(order); setOpenPO(true); };
  const closePopup = () => { setOpenPO(false); setEditingOrder(null); };

  const handleSave = async (newOrder) => {
    try {
      const isEdit = !!newOrder.id && orders.some((o) => o.id === newOrder.id);
      const method = isEdit ? "PUT" : "POST";
      const url    = isEdit ? `${API_BASE}/${newOrder.id}` : `${API_BASE}/`;
      const res    = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrder),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      await fetchOrders();

      if (!isEdit && newOrder.vendor_type === "walkin" && data.order?.id) {
        setShareOrder(data.order);
      }
    } catch (err) {
      alert("Failed to save order: " + err.message);
    } finally {
      closePopup();
    }
  };

  const openDelete  = (order) => { setDeletingOrder(order); setDeleteOpen(true); };
  const closeDelete = () => { setDeleteOpen(false); setDeletingOrder(null); };
  const confirmDelete = async () => {
    if (!deletingOrder?.id) return closeDelete();
    try {
      const res = await authFetch(`${API_BASE}/${deletingOrder.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await fetchOrders();
    } catch (err) {
      alert("Failed to delete order: " + err.message);
    } finally {
      closeDelete();
    }
  };

  const sendToVendor = async (order) => {
    if (!window.confirm(`Send PO ${order.orderNo} to vendor '${order.vendorName}'?`)) return;
    try {
      setLoading(true);
      const res  = await authFetch(`${API_BASE}/${order.id}/send-to-vendor`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send PO");
      alert(data.message || "PO sent successfully!");
      await fetchOrders();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const approveVendor = async (order) => {
    if (!window.confirm(`Approve vendor submission for PO ${order.orderNo}?`)) return;
    try {
      setLoading(true);
      const res  = await authFetch(`${API_BASE}/${order.id}/approve-vendor`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to approve vendor submission");
      alert(data.message || "Vendor submission approved!");
      await fetchOrders();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const rejectVendor = async (order, reason) => {
    try {
      setLoading(true);
      const res  = await authFetch(`${API_BASE}/${order.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to reject");
      alert(data.message || "Submission rejected. Vendor stock restored.");
      await fetchOrders();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const overrideVariance = async (order) => {
    const reason = window.prompt(
      `Override price variance for ${order.orderNo}?\n\nEnter reason:`
    );
    if (!reason?.trim()) return;
    try {
      setLoading(true);
      const res  = await authFetch(`${API_BASE}/${order.id}/override-variance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to override");
      alert(`Override granted. Vendor can now resubmit.\n\nReason recorded: ${reason}`);
      await fetchOrders();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Purchase Orders</h1>
            <p className="text-xs text-slate-500 mt-0.5">{orders.length} order{orders.length !== 1 ? "s" : ""} total</p>
          </div>
          <button onClick={openCreate} type="button"
            className="h-10 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold border border-sky-600 flex items-center gap-2 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Create Order
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-auto shadow-sm">
          <table className="w-full min-w-[1200px] text-xs">
            <thead className="bg-[#F2F4F8] text-slate-600">
              <tr className="border-b border-slate-200">
                <TH>Order No</TH>
                <TH>Order Date</TH>
                <TH>Vendor Name</TH>
                <TH>Status</TH>
                <TH>Order Type</TH>
                <TH>Owner Site</TH>
                <TH>Trade Group</TH>
                <TH>Term Name</TH>
                <TH className="text-right">Net Amount</TH>
                <TH className="text-center">Set Applicable</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      <span className="text-sm">Loading purchase orders…</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span className="text-sm text-slate-500">No orders yet.</span>
                      <span className="text-xs text-slate-400">Click <b className="text-sky-600">Create Order</b> to add one.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <TD className="font-semibold text-sky-700">{o.orderNo || "-"}</TD>
                    <TD>{o.orderDate || "-"}</TD>

                    <TD className="font-medium">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {o.vendor_type === "walkin" && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                            Walk-in
                          </span>
                        )}
                        {o.vendorName || "-"}
                      </div>
                      {o.vendor_type === "walkin" && o.po_viewed_at && (
                        <p className="text-[9px] text-emerald-600 mt-0.5">👁 Viewed by vendor</p>
                      )}
                      {o.vendor_type === "walkin" && o.vendor_accepted_at && (
                        <p className="text-[9px] text-indigo-600">✓ Accepted</p>
                      )}
                    </TD>

                    <TD><StatusBadge status={o.status} /></TD>
                    <TD>{o.orderType || "-"}</TD>
                    <TD>{o.ownerSiteShortName || "-"}</TD>
                    <TD>{o.tradeGroupName || "-"}</TD>
                    <TD>{o.termName || "-"}</TD>
                    <TD className="text-right font-bold tabular-nums">₹{money(o.netAmount)}</TD>
                    <TD className="text-center">
                      <span className={["px-2 py-1 rounded-full text-[11px] font-bold border",
                        o.setApplicable ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-slate-100 text-slate-500 border-slate-200"].join(" ")}>
                        {o.setApplicable ? "Yes" : "No"}
                      </span>
                    </TD>
                    <TD className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <ActionBtn color="sky" onClick={() => openEdit(o)}>Edit</ActionBtn>
                        <ActionBtn color="rose" onClick={() => openDelete(o)}>Delete</ActionBtn>

                        {o.vendor_type !== "walkin" && (
                          <ActionBtn color="emerald" disabled={o.status !== "Pending"} onClick={() => sendToVendor(o)}>
                            Send to Vendor
                          </ActionBtn>
                        )}
                        {o.vendor_type === "walkin" && (
                          <ActionBtn color="emerald" onClick={() => setShareOrder(o)}>
                            Share Link
                          </ActionBtn>
                        )}

                        <ActionBtn color="violet" disabled={o.status !== "VendorSubmitted"} onClick={() => setReviewOrder(o)}>
                          Review Submission
                        </ActionBtn>
                        {o.status === "SentToVendor" && (
                          <ActionBtn color="amber" onClick={() => overrideVariance(o)}>
                            Override Price
                          </ActionBtn>
                        )}
                      </div>
                    </TD>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openPO && (
        <ModalShell onClose={closePopup}>
          <PurchaseOrderForm onClose={closePopup} onSave={handleSave} initialOrder={editingOrder} />
        </ModalShell>
      )}

      {deleteOpen && (
        <ConfirmDeleteModal
          title="Delete Purchase Order?"
          message={<>Are you sure you want to delete <b>{deletingOrder?.orderNo || "this order"}</b>? This action cannot be undone.</>}
          onClose={closeDelete}
          onConfirm={confirmDelete}
        />
      )}

      {reviewOrder && (
        <ReviewModal
          order={reviewOrder}
          onClose={() => setReviewOrder(null)}
          onApprove={async () => { await approveVendor(reviewOrder); setReviewOrder(null); }}
          onReject={async (reason) => { await rejectVendor(reviewOrder, reason); setReviewOrder(null); }}
        />
      )}

      {shareOrder && (
        <SharePOModal po={shareOrder} onClose={() => setShareOrder(null)} />
      )}
    </div>
  );
}


/* ================================================================
   REVIEW MODAL  — unchanged
================================================================ */
function ReviewModal({ order, onClose, onApprove, onReject }) {
  const [rejectMode,    setRejectMode]    = React.useState(false);
  const [rejectReason,  setRejectReason]  = React.useState("");
  const [hasHighVariance, setHasHighVariance] = React.useState(false);

  const items = order.items || [];

  const enrichedItems = React.useMemo(() => {
    let anyHigh = false;
    const rows = items.map((it) => {
      const buyerRate   = clamp0(it.buyerRate  || it.rate);
      const vendorRate  = clamp0(it.vendorRate || it.rate);
      const vendorQty   = clamp0(it.amendedQty) > 0 ? clamp0(it.amendedQty) : clamp0(it.quantity);
      const varPct      = buyerRate > 0 ? ((vendorRate - buyerRate) / buyerRate) * 100 : 0;
      const varAmt      = (vendorRate - buyerRate) * vendorQty;
      const rateChanged = Math.abs(varPct) > 0.01;
      if (Math.abs(varPct) > 10) anyHigh = true;
      return { ...it, buyerRate, vendorRate, vendorQty, varPct, varAmt, rateChanged };
    });
    setHasHighVariance(anyHigh);
    return rows;
  }, [items]);

  const totalQty         = enrichedItems.reduce((s, i) => s + i.vendorQty, 0);
  const totalVal         = enrichedItems.reduce((s, i) => s + i.vendorQty * i.vendorRate, 0);
  const totalVarAmt      = enrichedItems.reduce((s, i) => s + i.varAmt, 0);
  const itemsWithVariance= enrichedItems.filter((i) => i.rateChanged).length;

  const handleApprove = () => {
    if (hasHighVariance) {
      const ok = window.confirm(
        `Warning: ${itemsWithVariance} item(s) have price variance > 10%.\n\nTotal price impact: ₹${money(Math.abs(totalVarAmt))}\n\nApprove anyway?`
      );
      if (!ok) return;
    }
    onApprove();
  };

  const handleRejectConfirm = () => {
    if (!rejectReason.trim()) { alert("Please enter a rejection reason."); return; }
    onReject(rejectReason.trim());
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg,#f5f3ff,#ede9fe)" }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Vendor Submission Review</div>
              <div className="text-xs text-slate-500 mt-0.5">
                <span className="font-semibold text-violet-700">{order.orderNo}</span>
                <span className="mx-1.5 text-slate-300">·</span>{order.vendorName}
                <span className="mx-1.5 text-slate-300">·</span>{order.orderDate}
              </div>
            </div>
          </div>
          <button onClick={onClose} type="button"
            className="h-8 w-8 rounded-lg border border-slate-200 hover:bg-white flex items-center justify-center text-slate-500 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-4 bg-slate-50">
          <KpiPill label="Items"         value={String(items.length)}             color="#7c3aed" />
          <KpiPill label="Vendor Qty"    value={totalQty.toLocaleString("en-IN")} color="#0284c7" />
          <KpiPill label="Total Value"   value={`₹${money(totalVal)}`}            color="#059669" />
          <KpiPill label="Price Changes" value={String(itemsWithVariance)}        color={itemsWithVariance > 0 ? "#d97706" : "#6b7280"} />
          {totalVarAmt !== 0 && (
            <KpiPill label="Price Impact"
              value={`${totalVarAmt > 0 ? "+" : ""}₹${money(Math.abs(totalVarAmt))}`}
              color={totalVarAmt > 0 ? "#dc2626" : "#059669"} />
          )}
          {hasHighVariance && (
            <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-bold text-red-700">
              âš  High variance (&gt;10%) detected
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto p-5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <p className="text-sm font-medium text-slate-500">No items found in this submission.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F2F4F8] border-b border-slate-200">
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide w-8">#</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Barcode</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Order Qty</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-sky-600 uppercase tracking-wide">Vendor Qty</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide">PO Rate</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-sky-600 uppercase tracking-wide">Vendor Rate</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Var %</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrichedItems.map((it, i) => {
                    const amt       = it.vendorQty * it.vendorRate;
                    const varPct    = it.varPct;
                    const isHigh    = Math.abs(varPct) > 10;
                    const isMed     = Math.abs(varPct) > 3 && !isHigh;
                    const rowBg     = isHigh ? "bg-red-50/60" : isMed ? "bg-amber-50/40" : i % 2 === 0 ? "bg-white" : "bg-slate-50/60";
                    const varColor  = isHigh ? "#dc2626" : isMed ? "#d97706" : "#6b7280";
                    const varBg     = isHigh ? "#fef2f2" : isMed ? "#fffbeb" : "transparent";
                    const varBorder = isHigh ? "1px solid #fecaca" : isMed ? "1px solid #fde68a" : "none";
                    return (
                      <tr key={i} className={`${rowBg} hover:bg-slate-100/60 transition-colors`}>
                        <td className="px-3 py-2.5 text-slate-400 font-medium">{i + 1}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-600 text-[11px]">{it.barcode || "—"}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800 max-w-[180px] truncate" title={it.description}>{it.description || "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-700">{clamp0(it.quantity)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold text-sky-700">
                          {it.vendorQty}
                          {clamp0(it.amendedQty) > 0 && clamp0(it.amendedQty) !== clamp0(it.quantity) && (
                            <span className="ml-1 text-[10px] text-amber-500 font-semibold">↓{clamp0(it.quantity) - clamp0(it.amendedQty)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">₹{it.buyerRate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          <span className="inline-block rounded px-1.5 py-0.5 font-semibold"
                            style={{ color: it.rateChanged ? varColor : "#374151", background: it.rateChanged ? varBg : "transparent", border: it.rateChanged ? varBorder : "none" }}>
                            ₹{it.vendorRate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {it.rateChanged ? (
                            <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={{ color: varColor, background: varBg, border: varBorder }}>
                              {varPct > 0 ? "+" : ""}{varPct.toFixed(1)}%
                            </span>
                          ) : <span className="text-slate-300 text-[10px]">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold text-emerald-700">₹{amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2.5 text-slate-500 max-w-[120px] truncate" title={it.remarks}>{it.remarks || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-100">
                    <td colSpan={3} className="px-3 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wide">Totals</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-700">{enrichedItems.reduce((s, i) => s + clamp0(i.quantity), 0).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-sky-700">{totalQty.toLocaleString("en-IN")}</td>
                    <td colSpan={2} />
                    <td className="px-3 py-3 text-right text-[11px] font-bold tabular-nums"
                      style={{ color: totalVarAmt > 0 ? "#dc2626" : totalVarAmt < 0 ? "#059669" : "#6b7280" }}>
                      {totalVarAmt !== 0 ? `${totalVarAmt > 0 ? "+" : ""}₹${money(Math.abs(totalVarAmt))}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-700">₹{totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {itemsWithVariance > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-600">Variance bands:</span>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-500">0â€“3% — auto-accept</span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">3â€“10% — review</span>
              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-700">&gt;10% — needs approval</span>
            </div>
          )}

          {rejectMode && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-semibold text-red-700 mb-2">Rejection reason (required — sent to vendor)</p>
              <textarea rows={3}
                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition"
                placeholder="e.g. Price variance exceeds budget. Please resubmit at ₹100 per piece."
                value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => { setRejectMode(false); setRejectReason(""); }} type="button"
                  className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleRejectConfirm} type="button"
                  className="h-9 px-5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors">
                  Confirm Reject
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between bg-white">
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{items.length}</span> item{items.length !== 1 ? "s" : ""} submitted
            {itemsWithVariance > 0 && <span className="ml-2 text-amber-600 font-semibold">· {itemsWithVariance} price change{itemsWithVariance !== 1 ? "s" : ""}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} type="button"
              className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors">
              Close
            </button>
            {!rejectMode && (
              <button onClick={() => setRejectMode(true)} type="button"
                className="h-9 px-4 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 font-semibold text-sm transition-colors">
                Reject
              </button>
            )}
            {!rejectMode && (
              <button onClick={handleApprove} disabled={items.length === 0} type="button"
                className="h-9 px-5 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: hasHighVariance ? "linear-gradient(135deg,#dc2626,#b91c1c)" : "linear-gradient(135deg,#7c3aed,#9333ea)", color: "#fff" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {hasHighVariance ? "Approve (High Variance)" : "Approve Submission"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiPill({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}:</span>
      <span className="text-xs font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

/* ================================================================
   ITEM DESCRIPTION DROPDOWN  — unchanged
================================================================ */
function ItemDescriptionDropdown({ value, products, disabled, onSelect, onChange }) {
  const [query, setQuery] = useState(value || "");
  const [open,  setOpen]  = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return products.slice(0, 300);
    const q = query.toLowerCase();
    return products.filter((p) =>
      p.label.toLowerCase().includes(q)               ||
      (p.product_name || "").toLowerCase().includes(q) ||
      (p.sku          || "").toLowerCase().includes(q) ||
      (p.barcode      || "").includes(q)               ||
      (p.size_label   || "").toLowerCase().includes(q) ||
      (p.color        || "").toLowerCase().includes(q)
    ).slice(0, 300);
  }, [query, products]);

  const isEmpty = products.length === 0;
  const placeholderText = disabled
    ? isEmpty ? "Select a vendor first" : "Disabled"
      : isEmpty ? "Type item description…" : "Search by name, SKU or barcode…";
  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: disabled ? "#cbd5e1" : "#94a3b8" }}
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (onChange) onChange(e.target.value); }}
          onFocus={() => setOpen(true)} disabled={disabled} placeholder={placeholderText}
          className={["h-9 w-full rounded-lg border pl-8 pr-2 text-xs outline-none transition-all duration-200",
            disabled ? "cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
              : "bg-white border-slate-200 text-slate-800 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 hover:border-slate-300",
          ].join(" ")} />
      </div>

      {open && !disabled && (
        <div className="absolute left-0 z-[999] mt-1.5 w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white"
          style={{ boxShadow: "0 8px 32px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.08)" }}>
           {filtered.length > 0 ? (
            <div className="max-h-56 overflow-auto">
              <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {filtered.length} item{filtered.length !== 1 ? "s" : ""}
                </span>
                <span className="text-[10px] text-slate-400">SKU · Barcode · Stock</span>
              </div>
              {filtered.map((p, i) => (
                <button key={i} type="button" onMouseDown={() => { setQuery(p.label); setOpen(false); if (onSelect) onSelect(p); }}
                  className="group flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-sky-50 border-b border-slate-50 last:border-0">

                  {p.color ? (
                    <div className="mt-0.5 h-6 w-6 rounded-md flex-shrink-0 border border-black/10 shadow-sm"
                      style={{ background: p.color }} title={p.color} />
                  ) : (
                    <div className="mt-0.5 h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                      style={{ background: `hsl(${(i * 47) % 360},60%,94%)`, color: `hsl(${(i * 47) % 360},55%,42%)` }}>
                      {p.label.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 leading-tight truncate group-hover:text-sky-700">
                      {p.label}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">{p.sublabel}</div>
                  </div>

                  {p.rate > 0 && (
                    <div className="flex-shrink-0 text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5 mt-0.5">
                      ₹{Number(p.rate).toLocaleString("en-IN")}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="px-4 py-5 text-center">
              <div className="text-2xl mb-1">🔍</div>
              <div className="text-xs text-slate-500">No products match <span className="font-semibold text-slate-700">"{query}"</span></div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   PURCHASE ORDER FORM  — vendor fetch now authenticated (THE BUG FIX)
================================================================ */
function PurchaseOrderForm({ onClose, onSave, initialOrder }) {
  const [activeTab,              setActiveTab]              = useState("General");
  const [vendors,                setVendors]                = useState([]);
  const [vendorLoading,          setVendorLoading]          = useState(false);
  const [vendorError,            setVendorError]            = useState(null);
  const [vendorProducts,         setVendorProducts]         = useState([]);
  const [vendorProductsLoading,  setVendorProductsLoading]  = useState(false);
  const [showCatalogue,          setShowCatalogue]          = useState(false);
  const [showCompareSearch,      setShowCompareSearch]      = useState(false);

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        setVendorLoading(true);
        setVendorError(null);
        // âš ï¸ THE FIX: this call had NO auth header at all. GET
        // /api/vendors/approved requires get_hq_tenant now (tenant-scoped —
        // returns only THIS tenant's approved vendors, e.g. Citimart's
        // admin sees only Citimart's approved vendors, never Zudio's).
        // With no token it silently 401'd, the catch block only logged to
        // console, and `vendors` stayed empty forever — which is exactly
        // "approved vendors don't show up when creating a PO."
        const res = await authFetch(`${APP_API_URL}/api/vendors/approved`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Failed to load approved vendors");
        }
        const data = await res.json();
        // Response is the vendor-tenant LINK rows (see vendor_routes.py's
        // identity/link split) merged with identity fields — "name" comes
        // from the vendor identity, "_id" is the link's id. Both are
        // already read correctly below; no shape change needed here.
        // âš ï¸ FIXED: under the vendor identity/tenant-link split, "_id" in
        // this response is now the LINK's id (see vendor_routes.py's
        // module docstring) — NOT the vendor's real identity id that
        // /api/products/vendor/{id} and PO creation actually key on.
        // The identity id is exposed separately as "vendor_id" in the same
        // response; use that instead, or the products lookup and PO's
        // stored vendor_id will silently point at the wrong document.
        setVendors(data.map((v) => ({ id: v.vendor_id || v._id || v.id || "", name: v.vendor_name || v.name || "" })));
      } catch (err) {
        console.error("Vendor fetch error:", err);
        setVendorError(err.message || "Could not load approved vendors.");
        setVendors([]);
      } finally {
        setVendorLoading(false);
      }
    };
    fetchVendors();
  }, []);

  const fetchVendorProducts = useCallback(async (vendorId) => {
    if (!vendorId) { setVendorProducts([]); return; }
    try {
      setVendorProductsLoading(true);
      const res  = await authFetch(`${APP_API_URL}/api/products/vendor/${vendorId}`);
      if (!res.ok) throw new Error("Failed to load vendor products");
      const data = await res.json();
      setVendorProducts(flattenVendorProducts(data.data || data || []));
    } catch (err) {
      console.error("Vendor products fetch error:", err);
      setVendorProducts([]);
    } finally {
      setVendorProductsLoading(false);
    }
  }, []);

  const [general, setGeneral] = useState({
    vendorId: "", ownerSite: "", ownerSiteShortName: "",
    date: new Date().toISOString().slice(0, 10), orderNo: "", documentNo: "",
    vendorName: "", purchaseType: "", validFrom: new Date().toISOString().slice(0, 10),
    validTill: "", currency: "", exchangeRate: "", agent: "", teamName: "",
    commissionRate: "", transporter: "", merchandiserName: "", tradeGroup: "",
    terms: "", entryMode: "", status: "", setApplicable: false,
    vendorType:         "registered",
    walkinVendor:       EMPTY_WALKIN(),
    saveWalkinToSystem: false,
  });

  const [items,       setItems]       = useState([EMPTY_ITEM()]);
  const [others,      setOthers]      = useState({ remarks: "", terms: "" });
  const [showCharges, setShowCharges] = useState(false);
  const [charges,     setCharges]     = useState({ freight: "", discount: "", taxPct: "" });
  const [showReceive, setShowReceive] = useState(false);
  const [receiveRows, setReceiveRows] = useState([EMPTY_SCHEDULE_ROW(1)]);

  const setG = (k, v) => setGeneral((p) => ({ ...p, [k]: v }));

  const handleVendorChange = (name) => {
    setG("vendorName", name);
    if (general.vendorType === "walkin") return;
    const found    = vendors.find((v) => v.name === name);
    const vendorId = found?.id || "";
    setG("vendorId", vendorId);
    fetchVendorProducts(vendorId);
  };

  useEffect(() => {
    if (!initialOrder) return;
    setGeneral({
      ownerSite:          initialOrder.ownerSite          || "",
      ownerSiteShortName: initialOrder.ownerSiteShortName || "",
      date:               initialOrder.orderDate          || new Date().toISOString().slice(0, 10),
      orderNo:            initialOrder.orderNo            || "",
      vendorName:         initialOrder.vendorName         || "",
      vendorId:           initialOrder.vendor_id ? String(initialOrder.vendor_id) : "",
      purchaseType:       initialOrder.purchaseType       || initialOrder.orderType || "",
      tradeGroup:         initialOrder.tradeGroupName     || "",
      terms:              initialOrder.termName           || "",
      status:             initialOrder.status             || "",
      setApplicable:      !!initialOrder.setApplicable,
      documentNo:         initialOrder.documentNo         || "",
      validFrom:          initialOrder.validFrom          || "",
      validTill:          initialOrder.validTill          || "",
      currency:           initialOrder.currency           || "",
      exchangeRate:       String(initialOrder.exchangeRate   || ""),
      agent:              initialOrder.agent              || "",
      teamName:           initialOrder.teamName           || "",
      commissionRate:     String(initialOrder.commissionRate || ""),
      transporter:        initialOrder.transporter        || "",
      merchandiserName:   initialOrder.merchandiserName   || "",
      entryMode:          initialOrder.entryMode          || "",
      vendorType:         initialOrder.vendor_type        || "registered",
      walkinVendor:       initialOrder.walkin_vendor      || EMPTY_WALKIN(),
      saveWalkinToSystem: false,
    });
    setItems(Array.isArray(initialOrder.items) && initialOrder.items.length ? initialOrder.items : [EMPTY_ITEM()]);
    setOthers({ remarks: initialOrder.notes || "", terms: initialOrder.otherTerms || "" });
    const resolvedId = initialOrder.vendor_id
      ? String(initialOrder.vendor_id)
      : vendors.find((v) => v.name === initialOrder.vendorName)?.id || "";
    if (resolvedId && initialOrder.vendor_type !== "walkin") fetchVendorProducts(resolvedId);
  }, [initialOrder?.id]);

  useEffect(() => {
    if (!initialOrder || !vendors.length) return;
    if (!general.vendorId && initialOrder.vendorName && general.vendorType !== "walkin") {
      const found = vendors.find((v) => v.name === initialOrder.vendorName);
      if (found?.id) { setG("vendorId", found.id); fetchVendorProducts(found.id); }
    }
  }, [vendors]);

  const updateItem = (idx, k, v) => {
    setItems((prev) => {
      const copy = [...prev];
      const row  = { ...copy[idx], [k]: v };
      const q = clamp0(row.quantity), r = clamp0(row.receivedQty), c = clamp0(row.cancelledQty);
      row.pendingQty = clamp0(q - r - c);
      copy[idx] = row;
      return copy;
    });
  };

  const selectProductForItem = (idx, product) => {
    setItems((prev) => {
      const copy = [...prev];
      const row  = { ...copy[idx] };
      row.description = product.product_name;
      row.barcode     = product.barcode     || "";
      row.originalQty = String(product.originalQty ?? "");
      row.rate        = String(product.rate        ?? "");
      const q = clamp0(row.quantity), r = clamp0(row.receivedQty), c = clamp0(row.cancelledQty);
      row.pendingQty = clamp0(q - r - c);
      copy[idx] = row;
      return copy;
    });
  };

  const addRow      = () => setItems((p) => [...p, EMPTY_ITEM()]);
  const markRemoved = (idx) => setItems((p) => p.map((it, i) => i === idx ? { ...it, removed: true }  : it));
  const undoRemoved = (idx) => setItems((p) => p.map((it, i) => i === idx ? { ...it, removed: false } : it));

  const totals = useMemo(() => {
    const activeItems      = items.filter((it) => !it.removed);
    const recordCount      = activeItems.length;
    const totalItemQuantity= clamp0(activeItems.reduce((s, it) => s + clamp0(it.quantity), 0));
    const basicValue       = clamp0(activeItems.reduce((s, it) => s + clamp0(it.quantity) * clamp0(it.rate), 0));
    const freight          = clamp0(charges.freight);
    const discount         = clamp0(charges.discount);
    const taxPct           = clamp0(charges.taxPct);
    const taxable          = clamp0(basicValue + freight - discount);
    const taxAmount        = clamp0((taxable * taxPct) / 100);
    const grossAmount      = taxable;
    const netAmount        = clamp0(taxable + taxAmount);
    return { recordCount, totalItemQuantity, basicValue, grossAmount, netAmount, taxAmount, freight, discount, taxPct };
  }, [items, charges]);

  const totalOrderQty = totals.totalItemQuantity;

  useEffect(() => {
    setReceiveRows((prev) =>
      prev.map((r) => {
        const pct = clamp0(r.percentage);
        const qty = pct > 0 ? ((totalOrderQty * pct) / 100).toFixed(3) : r.quantity;
        return { ...r, quantity: String(clamp0(qty)) };
      })
    );
  }, [totalOrderQty]);

  const validateStep = () => {
    if (activeTab === "General") {
      if (!general.ownerSite || !general.vendorName || !general.purchaseType) {
        alert("Please fill required fields in General (Owner Site, Vendor Name, Purchase Type).");
        return false;
      }
    }
    if (activeTab === "Items") {
      if (items.filter((i) => !i.removed).length === 0) {
        alert("Please add at least 1 item."); return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    if (activeTab === "General") setActiveTab("Items");
    else if (activeTab === "Items") setActiveTab("Others");
  };

  const handleSaveOrder = () => {
    if (!validateStep()) return;
    const activeItems = items.filter((it) => !it.removed);
    const newOrder = {
      id:                 initialOrder?.id || `PO-${Date.now()}`,
      vendor_id:          general.vendorId  || undefined,
      orderNo:            general.orderNo,
      orderDate:          general.date,
      vendorName:         general.vendorName,
      status:             general.status,
      orderType:          general.purchaseType,
      ownerSiteShortName: general.ownerSiteShortName || (general.ownerSite ? general.ownerSite.slice(0, 8).toUpperCase() : ""),
      tradeGroupName:     general.tradeGroup,
      termName:           general.terms,
      netAmount:          totals.netAmount,
      setApplicable:      !!general.setApplicable,
      ownerSite:          general.ownerSite,
      documentNo:         general.documentNo,
      validFrom:          general.validFrom,
      validTill:          general.validTill,
      currency:           general.currency,
      exchangeRate:       Number(general.exchangeRate)    || 0,
      agent:              general.agent,
      teamName:           general.teamName,
      commissionRate:     Number(general.commissionRate)  || 0,
      transporter:        general.transporter,
      merchandiserName:   general.merchandiserName,
      entryMode:          general.entryMode,
      purchaseType:       general.purchaseType,
      notes:              others?.remarks   || "",
      otherTerms:         others?.terms     || "",
      items:              activeItems,
      vendor_type:        general.vendorType,
      walkin_vendor:      general.vendorType === "walkin" ? general.walkinVendor : undefined,
    };
    if (typeof onSave === "function") onSave(newOrder);
  };

  const updateReceiveRow = (idx, k, v) => {
    setReceiveRows((prev) => {
      const copy = [...prev];
      const row  = { ...copy[idx], [k]: v };
      if (k === "percentage") { const pct = clamp0(v); row.quantity = clamp0((totalOrderQty * pct) / 100) ? (clamp0((totalOrderQty * pct) / 100)).toFixed(3) : ""; }
      if (k === "quantity")   { const q   = clamp0(v); row.percentage = q && totalOrderQty > 0 ? clamp0((q / totalOrderQty) * 100).toFixed(2) : ""; }
      copy[idx] = row;
      return copy;
    });
  };

  const removeReceiveRow = (idx) =>
    setReceiveRows((p) => p.length === 1 ? p : p.filter((_, i) => i !== idx).map((r, i) => ({ ...r, seq: i + 1 })));

  const sumReceiveQty = useMemo(() => clamp0(receiveRows.reduce((s, r) => s + clamp0(r.quantity), 0)), [receiveRows]);

  const onReceiveOk = () => {
    if (sumReceiveQty > totalOrderQty + 0.0005) { alert("Schedule quantity cannot exceed Total Order Quantity."); return; }
    setShowReceive(false);
  };

  return (
    <div className="min-h-full bg-[#F6F7FB] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-5 pb-28 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {["General", "Items", "Others"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} type="button"
              className={["h-10 px-5 rounded-lg border text-sm font-semibold transition-all duration-200",
                activeTab === tab
                  ? "bg-sky-600 text-white border-sky-600 shadow-sm shadow-sky-200"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300",
              ].join(" ")}>
              {tab === "Items" ? "Item Details" : tab}
            </button>
          ))}
        </div>

        {activeTab === "General" && (
          <Section title="General Information" subtitle="Fill order header details">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="grid grid-cols-1 gap-3">
                <Row label="Owner Site" required>
                  <Input value={general.ownerSite} onChange={(e) => setG("ownerSite", e.target.value)} placeholder="Owner site" />
                </Row>
                <Row label="Owner Site Short Name" required>
                  <Input value={general.ownerSiteShortName} onChange={(e) => setG("ownerSiteShortName", e.target.value)} placeholder="e.g. NKOL" />
                </Row>
                <Row label="Order No" required>
                  <Input value={general.orderNo || "(auto-generate on save)"} onChange={(e) => setG("orderNo", e.target.value)}
                    placeholder="Auto-generated" readOnly className="bg-slate-50 text-slate-500" />
                </Row>

                <Row label="Vendor Type" required>
                  <div className="flex gap-2">
                    {[
                      { value: "registered", label: "Registered Vendor" },
                      { value: "walkin",     label: "Walk-in / Ad-hoc"  },
                    ].map(({ value, label }) => (
                      <button key={value} type="button"
                        onClick={() => {
                          setG("vendorType", value);
                          setG("vendorName", "");
                          setG("vendorId",   "");
                          setVendorProducts([]);
                        }}
                        className={["flex-1 h-10 rounded-lg border text-sm font-semibold transition",
                          general.vendorType === value
                            ? value === "walkin"
                              ? "bg-amber-500 text-white border-amber-500"
                              : "bg-sky-600 text-white border-sky-600"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                        ].join(" ")}>
                        {label}
                      </button>
                    ))}
                  </div>
                </Row>

                {general.vendorType === "registered" ? (
                  <Row label="Vendor Name" required>
                    <div>
                      <input value={general.vendorName} onChange={(e) => handleVendorChange(e.target.value)}
                        list="vendorList"
                        placeholder={
                          vendorLoading ? "Loading vendors…"
                          : vendorError ? "Failed to load vendors — see below"
                          : vendors.length === 0 ? "No approved vendors yet"
                          : "Type or select vendor"
                        }
                        className={inputClass} />
                      <datalist id="vendorList">{vendors.map((v) => <option key={v.id} value={v.name} />)}</datalist>
                      {vendorError && (
                        <p className="mt-1 text-[10px] text-rose-600 flex items-center gap-1">
                          âš  {vendorError} — check that you're logged in and try refreshing the page.
                        </p>
                      )}
                      {!vendorLoading && !vendorError && vendors.length === 0 && (
                        <p className="mt-1 text-[10px] text-amber-600">
                          No approved vendors found for your retailer yet. Approve a vendor first, or use Walk-in / Ad-hoc.
                        </p>
                      )}
                      {vendorProductsLoading && <p className="mt-1 text-[10px] text-sky-600 animate-pulse">Loading vendor products…</p>}
                      {!vendorProductsLoading && general.vendorName && vendorProducts.length > 0 && (
                        <p className="mt-1 text-[10px] text-emerald-600 flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          {vendorProducts.length} product{vendorProducts.length !== 1 ? "s" : ""} loaded
                        </p>
                      )}
                      {general.vendorId && (
                        <button type="button" onClick={() => setShowCatalogue(true)}
                          className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-indigo-600 font-bold hover:text-indigo-800 hover:underline">
                          📷 Browse catalogue & ask vendor
                        </button>
                      )}
                      <button type="button" onClick={() => setShowCompareSearch(true)}
                        className="mt-1.5 ml-3 inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold hover:text-emerald-800 hover:underline">
                        🔍 Search vendors by category
                      </button>
                    </div>
                  </Row>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                      <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Walk-in Vendor Details</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Business Name *", key: "name",           placeholder: "Ramesh Traders",  span: 2 },
                        { label: "Contact Person",  key: "contact_person", placeholder: "Contact name",    span: 1 },
                        { label: "Mobile",          key: "mobile",         placeholder: "+91 XXXXXXXXXX",  span: 1 },
                        { label: "GSTIN",           key: "gstin",          placeholder: "GSTIN (optional)",span: 1 },
                        { label: "Email",           key: "email",          placeholder: "email@domain.com",span: 1 },
                        { label: "Address",         key: "address",        placeholder: "Business address",span: 2 },
                      ].map(({ label, key, placeholder, span }) => (
                        <div key={key} style={{ gridColumn: span === 2 ? "1/-1" : undefined }}>
                          <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block mb-1">{label}</label>
                          <input
                            value={general.walkinVendor?.[key] || ""}
                            onChange={(e) => {
                              const updated = { ...(general.walkinVendor || {}), [key]: e.target.value };
                              setG("walkinVendor", updated);
                              if (key === "name") setG("vendorName", e.target.value);
                            }}
                            placeholder={placeholder}
                            className="h-9 w-full rounded-lg border border-amber-300 bg-white px-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input type="checkbox" id="saveWalkin" checked={general.saveWalkinToSystem || false}
                        onChange={(e) => setG("saveWalkinToSystem", e.target.checked)}
                        className="w-4 h-4 accent-amber-600 cursor-pointer" />
                      <label htmlFor="saveWalkin" className="text-xs font-semibold text-amber-700 cursor-pointer">
                        Save this vendor to the system for future use
                      </label>
                    </div>
                    <div className="rounded-lg bg-amber-100 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
                      💡 After saving, you'll get a shareable link to send via WhatsApp so the vendor can view and accept the PO.
                    </div>
                  </div>
                )}

                <Row label="Valid From" required>
                  <Input type="date" value={general.validFrom} onChange={(e) => setG("validFrom", e.target.value)} />
                </Row>
                <Row label="Currency" required>
                  <Combo value={general.currency} onChange={(v) => setG("currency", v)} listId="currencyList"
                    placeholder="Select or type…" options={["INR", "USD", "EUR", "AED"]} />
                </Row>
                <Row label="Agent">
                  <Input value={general.agent} onChange={(e) => setG("agent", e.target.value)} placeholder="Agent" />
                </Row>
                <Row label="Transporter">
                  <Input value={general.transporter} onChange={(e) => setG("transporter", e.target.value)} placeholder="Transporter" />
                </Row>
                <Row label="Trade Group Name">
                  <Input value={general.tradeGroup} onChange={(e) => setG("tradeGroup", e.target.value)} placeholder="Trade group" />
                </Row>
                <Row label="Entry Mode">
                  <div className="grid grid-cols-2 gap-2">
                    <Toggle active={general.entryMode === "items"} onClick={() => setG("entryMode", "items")}>Items</Toggle>
                    <Toggle active={general.entryMode === "sets"}  onClick={() => setG("entryMode", "sets")}>Sets</Toggle>
                  </div>
                </Row>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Row label="Order Date" required>
                  <Input type="date" value={general.date} onChange={(e) => setG("date", e.target.value)} />
                </Row>
                <Row label="Document No" required>
                  <Input value={general.documentNo} onChange={(e) => setG("documentNo", e.target.value)} placeholder="Document no" />
                </Row>
                <Row label="Purchase Type" required>
                  <Combo value={general.purchaseType} onChange={(v) => setG("purchaseType", v)} listId="purchaseTypeList"
                    placeholder="Select or type…" options={["Standard", "Import", "Job Work", "Consignment"]} />
                </Row>
                <Row label="Valid Till" required>
                  <Input type="date" value={general.validTill} onChange={(e) => setG("validTill", e.target.value)} />
                </Row>
                <Row label="Exchange Rate" required>
                  <Input type="number" min="0" value={general.exchangeRate}
                    onChange={(e) => setG("exchangeRate", String(clamp0(e.target.value)))} placeholder="0" />
                </Row>
                <Row label="Commission Rate">
                  <Input type="number" min="0" value={general.commissionRate}
                    onChange={(e) => setG("commissionRate", String(clamp0(e.target.value)))} placeholder="0" />
                </Row>
                <Row label="Buyer Contact Reference (optional)">
                  <Input value={general.merchandiserName} onChange={(e) => setG("merchandiserName", e.target.value)} placeholder="Optional internal reference" />
                </Row>
                <Row label="Term Name">
                  <Input value={general.terms} onChange={(e) => setG("terms", e.target.value)} placeholder="Term name" />
                </Row>
                <Row label="Status">
                  <Combo value={general.status} onChange={(v) => setG("status", v)} listId="statusList"
                    placeholder="Select or type…" options={["New", "Pending", "Approved", "Closed", "Cancelled"]} />
                </Row>
                <Row label="Set Applicable">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setG("setApplicable", !general.setApplicable)}
                      className={["h-10 px-4 rounded-lg border font-semibold transition",
                        general.setApplicable ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50",
                      ].join(" ")}>
                      {general.setApplicable ? "Yes" : "No"}
                    </button>
                    <span className="text-xs text-slate-500">Toggle if this PO is applicable for sets.</span>
                  </div>
                </Row>
              </div>
            </div>
          </Section>
        )}

        {activeTab === "Items" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Records"     value={String(totals.recordCount)}          color="sky"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} />
              <KpiCard label="Total Qty"   value={totals.totalItemQuantity.toFixed(3)} color="violet"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>} />
              <KpiCard label="Basic Value" value={`₹${money(totals.basicValue)}`}     color="emerald"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
              <KpiCard label="Net Amount"  value={`₹${money(totals.netAmount)}`}      color="amber"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>} />
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-4 py-3 text-xs"
              style={{ background: "linear-gradient(135deg,#f0f9ff,#e0f2fe)", border: "1px solid #bae6fd" }}>
              <ChargePill label="Freight"  value={money(totals.freight)}                       color="#0284c7" />
              <ChargePill label="Discount" value={money(totals.discount)}                      color="#7c3aed" />
              <ChargePill label="Tax"      value={`${clamp0(totals.taxPct).toFixed(2)}%`}      color="#0891b2" />
              <ChargePill label="Tax Amt"  value={`₹${money(totals.taxAmount)}`}              color="#0369a1" />
              <div className="ml-auto">
                <button type="button" onClick={() => setShowCharges(true)}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold bg-sky-600 text-white hover:bg-sky-700 transition-colors">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                  Charges
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100"
                style={{ background: "linear-gradient(135deg,#f8fafc,#f1f5f9)" }}>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-1 rounded-full bg-sky-500" />
                  <span className="text-sm font-semibold text-slate-800">Item Details</span>
                  <span className="ml-1 rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold px-2 py-0.5">
                    {items.filter((i) => !i.removed).length}
                  </span>
                </div>
                <button onClick={addRow} type="button"
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Row
                </button>
              </div>

              <div className="p-4 space-y-3 max-h-[58vh] overflow-y-auto">
                {items.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-14 text-slate-400">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-30">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                    <p className="text-sm font-medium text-slate-500">No items yet</p>
                    <p className="text-xs text-slate-400 mt-1">Click <span className="font-semibold text-sky-600">+ Add Row</span> to begin</p>
                  </div>
                )}

                {items.map((it, idx) => {
                  const amount    = clamp0(it.quantity) * clamp0(it.rate);
                  const isRemoved = it.removed;
                  return (
                    <div key={idx}
                      className={["rounded-xl border transition-all duration-200",
                        isRemoved ? "opacity-50 border-slate-200 bg-slate-50"
                          : "border-slate-200 bg-white hover:border-sky-200 hover:shadow-sm",
                      ].join(" ")}
                      style={isRemoved ? {} : { boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>

                      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-t-xl border-b border-slate-100"
                        style={{ background: isRemoved ? "#f8fafc" : "linear-gradient(135deg,#f8fafc,#f0f9ff)" }}>
                        <div className="flex-shrink-0 h-6 w-6 rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold flex items-center justify-center">{idx + 1}</div>
                        <div className="flex-1 min-w-[220px]">
                          <ItemDescriptionDropdown
                            value={it.description} products={vendorProducts} disabled={isRemoved}
                            onSelect={(product) => selectProductForItem(idx, product)}
                            onChange={(val) => updateItem(idx, "description", val)} />
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="1.5" height="16"/><rect x="6" y="4" width="1" height="16"/>
                            <rect x="9" y="4" width="2" height="16"/><rect x="13" y="4" width="1" height="16"/>
                            <rect x="16" y="4" width="1.5" height="16"/><rect x="19" y="4" width="2" height="16"/>
                          </svg>
                          <input value={it.barcode || ""} readOnly tabIndex={-1} placeholder="Barcode (auto-filled)"
                            className="h-8 w-[150px] rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 text-[11px] font-mono text-slate-500 outline-none cursor-default" />
                        </div>
                        <div className="flex-shrink-0 h-8 px-3 rounded-lg flex items-center gap-1 text-xs font-bold"
                          style={{ background: amount > 0 ? "#ecfdf5" : "#f8fafc", color: amount > 0 ? "#059669" : "#94a3b8", border: `1px solid ${amount > 0 ? "#6ee7b7" : "#e2e8f0"}` }}>
                          ₹{money(isRemoved ? 0 : amount)}
                        </div>
                        {!isRemoved ? (
                          <button onClick={() => markRemoved(idx)} type="button" title="Remove row"
                            className="flex-shrink-0 h-8 w-8 rounded-lg border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-700 flex items-center justify-center transition-colors">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        ) : (
                          <button onClick={() => undoRemoved(idx)} type="button"
                            className="flex-shrink-0 h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200 text-xs font-semibold transition-colors">
                            Undo
                          </button>
                        )}
                      </div>

                      <div className="px-3 py-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                        <QtyField label="Original Qty"  value={it.originalQty}  disabled={isRemoved} onChange={(e) => updateItem(idx, "originalQty",  String(clamp0(e.target.value)))} />
                        <QtyField label="Order Qty"     value={it.quantity}     disabled={isRemoved} highlight onChange={(e) => updateItem(idx, "quantity",     String(clamp0(e.target.value)))} />
                        <QtyField label="Amended Qty"   value={it.amendedQty}   disabled={isRemoved} onChange={(e) => updateItem(idx, "amendedQty",   String(clamp0(e.target.value)))} />
                        <QtyField label="Received Qty"  value={it.receivedQty}  disabled={isRemoved} onChange={(e) => updateItem(idx, "receivedQty",  String(clamp0(e.target.value)))} />
                        <QtyField label="Cancelled Qty" value={it.cancelledQty} disabled={isRemoved} onChange={(e) => updateItem(idx, "cancelledQty", String(clamp0(e.target.value)))} />
                        <QtyField label="Pending Qty"   value={it.pendingQty}   disabled readOnly customStyle={{ background: "#f0fdf4", borderColor: "#bbf7d0", color: "#16a34a" }} />
                      </div>

                      <div className="px-3 pb-3 pt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 border-t border-slate-50">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Rate</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-semibold pointer-events-none">₹</span>
                            <input type="number" min="0" value={it.rate} disabled={isRemoved}
                              onChange={(e) => updateItem(idx, "rate", String(clamp0(e.target.value)))}
                              className={["h-8 w-full rounded-lg border border-slate-200 bg-white pl-6 pr-2 text-xs text-right tabular-nums outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100",
                                isRemoved ? "bg-slate-50 text-slate-400 cursor-not-allowed" : ""].join(" ")}
                              placeholder="0.00" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Tolerance %</label>
                          <input type="number" min="0" value={it.tolerancePct} disabled={isRemoved}
                            onChange={(e) => updateItem(idx, "tolerancePct", String(clamp0(e.target.value)))}
                            className={["h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-right tabular-nums outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100",
                              isRemoved ? "bg-slate-50 text-slate-400 cursor-not-allowed" : ""].join(" ")}
                            placeholder="0.00" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Due Date</label>
                          <input type="date" value={it.dueDate} disabled={isRemoved}
                            onChange={(e) => updateItem(idx, "dueDate", e.target.value)}
                            className={["h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100",
                              isRemoved ? "bg-slate-50 text-slate-400 cursor-not-allowed" : ""].join(" ")} />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Remarks</label>
                          <input value={it.remarks} disabled={isRemoved}
                            onChange={(e) => updateItem(idx, "remarks", e.target.value)}
                            className={["h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100",
                              isRemoved ? "bg-slate-50 text-slate-400 cursor-not-allowed" : ""].join(" ")}
                            placeholder="Remarks…" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-2">
                  <div className="h-4 w-1 rounded-full bg-amber-400" />
                  Qty Tolerance %
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" placeholder="0.00"
                    className="h-9 w-36 rounded-lg border border-slate-200 bg-white px-3 text-sm text-right outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400" />
                  <button type="button"
                    className="h-9 px-4 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 text-sm font-semibold hover:bg-sky-100 transition-colors">
                    Assign to All
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-2">
                  <div className="h-4 w-1 rounded-full bg-emerald-400" />
                  Order Totals
                </div>
                <div className="space-y-1.5">
                  <TotalRow k="Basic Value"  v={`₹${money(totals.basicValue)}`}  />
                  <TotalRow k="Tax Amount"   v={`₹${money(totals.taxAmount)}`}   />
                  <TotalRow k="Gross Amount" v={`₹${money(totals.grossAmount)}`} />
                  <TotalRow k="Net Amount"   v={`₹${money(totals.netAmount)}`}   highlight />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Others" && (
          <Section title="Others" subtitle="Remarks and Terms">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FieldBlock label="Remarks">
                <textarea rows={7} className={textareaClass} value={others.remarks}
                  onChange={(e) => setOthers((p) => ({ ...p, remarks: e.target.value }))} />
              </FieldBlock>
              <FieldBlock label="Terms">
                <textarea rows={7} className={textareaClass} value={others.terms}
                  onChange={(e) => setOthers((p) => ({ ...p, terms: e.target.value }))} />
              </FieldBlock>
            </div>
            <div className="flex justify-end mt-3">
              <Btn ghost onClick={() => setShowReceive(true)}>Receive Schedules</Btn>
            </div>
          </Section>
        )}
      </div>

      {showCharges && <ChargesModal charges={charges} setCharges={setCharges} totals={totals} onClose={() => setShowCharges(false)} />}
      {showReceive && (
        <ReceiveScheduleModal totalQty={totalOrderQty} rows={receiveRows} onChangeRow={updateReceiveRow}
          onAdd={() => setReceiveRows((p) => [...p, EMPTY_SCHEDULE_ROW(p.length + 1)])}
          onRemove={removeReceiveRow} onClose={() => setShowReceive(false)} onOk={onReceiveOk} sumQty={sumReceiveQty} />
      )}
      {showCatalogue && (
        <VendorCatalogueBrowserModal
          vendorId={general.vendorId}
          vendorName={general.vendorName}
          onClose={() => setShowCatalogue(false)}
          onConvertToItem={(prefill) => {
            setItems(prev => [...prev, {
              ...EMPTY_ITEM(),
              description: prefill.description,
              quantity:    String(prefill.quantity),
              rate:        String(prefill.rate),
              remarks:     prefill.remarks,
            }]);
            setShowCatalogue(false);
          }}
        />
      )}
      {showCompareSearch && (
        <VendorCompareSearch
          onClose={() => setShowCompareSearch(false)}
          onConvertToItem={(prefill) => {
            setItems(prev => [...prev, {
              ...EMPTY_ITEM(),
              description: prefill.description,
              quantity:    String(prefill.quantity),
              rate:        String(prefill.rate),
              remarks:     prefill.remarks,
            }]);
            setShowCompareSearch(false);
          }}
        />
      )}

      <div className="sticky bottom-0 z-50 border-t border-slate-200 bg-white/95 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-2">
          <Btn ghost onClick={onClose}>Close</Btn>
          <div className="flex items-center gap-2">
            {activeTab !== "Others"
              ? <Btn onClick={goNext}>Save & Continue →</Btn>
              : <Btn onClick={handleSaveOrder}>Submit Order</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MODAL SHELL — unchanged
================================================================ */
function ModalShell({ children, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex h-[calc(100dvh-1rem)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:h-[calc(100dvh-2rem)]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            Purchase Order
          </div>
          <button onClick={onClose} type="button" title="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ================================================================
   CONFIRM DELETE MODAL — unchanged
================================================================ */
function ConfirmDeleteModal({ title, message, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            {title}
          </div>
          <button onClick={onClose} type="button"
            className="h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center justify-center transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="text-sm text-slate-600 leading-relaxed">{message}</div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} type="button"
              className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors">
              Cancel
            </button>
            <button onClick={onConfirm} type="button"
              className="h-10 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition-colors">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   CHARGES MODAL — unchanged
================================================================ */
function ChargesModal({ charges, setCharges, totals, onClose }) {
  return (
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Calculate Charges</div>
          <button onClick={onClose} type="button"
            className="h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center justify-center transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FieldBlock label="Freight">
              <input type="number" min="0" value={charges.freight}
                onChange={(e) => setCharges((p) => ({ ...p, freight: String(clamp0(e.target.value)) }))}
                className={inputClass} placeholder="0" />
            </FieldBlock>
            <FieldBlock label="Discount">
              <input type="number" min="0" value={charges.discount}
                onChange={(e) => setCharges((p) => ({ ...p, discount: String(clamp0(e.target.value)) }))}
                className={inputClass} placeholder="0" />
            </FieldBlock>
            <FieldBlock label="Tax %">
              <input type="number" min="0" value={charges.taxPct}
                onChange={(e) => setCharges((p) => ({ ...p, taxPct: String(clamp0(e.target.value)) }))}
                className={inputClass} placeholder="0" />
            </FieldBlock>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <MiniKV k="Basic" v={`₹${money(totals.basicValue)}`} />
            <MiniKV k="Tax"   v={`₹${money(totals.taxAmount)}`}  />
            <MiniKV k="Gross" v={`₹${money(totals.grossAmount)}`}/>
            <MiniKV k="Net"   v={`₹${money(totals.netAmount)}`}  />
          </div>
          <div className="flex justify-end gap-2">
            <Btn ghost onClick={onClose}>Cancel</Btn>
            <Btn onClick={onClose}>OK</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   RECEIVE SCHEDULE MODAL — unchanged
================================================================ */
function ReceiveScheduleModal({ totalQty, rows, onChangeRow, onAdd, onRemove, onClose, onOk, sumQty }) {
  return (
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Receive Schedule</div>
          <button onClick={onClose} type="button"
            className="h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center justify-center transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="p-4">
          <div className="rounded-xl border border-slate-200 overflow-auto max-h-[45vh]">
            <table className="w-full text-xs min-w-[600px] table-fixed">
              <colgroup>
                <col className="w-[70px]"/><col className="w-[180px]"/>
                <col className="w-[160px]"/><col className="w-[170px]"/><col className="w-[120px]"/>
              </colgroup>
              <thead className="bg-[#F2F4F8] text-slate-600 sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <TH className="text-center">Seq</TH>
                  <TH>Date</TH>
                  <TH className="text-right">Percentage</TH>
                  <TH className="text-right">Quantity</TH>
                  <TH className="text-right">Action</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <TD className="text-center font-semibold">{r.seq}</TD>
                    <TD><input type="date" value={r.date} onChange={(e) => onChangeRow(idx, "date", e.target.value)} className={cellInput} /></TD>
                    <TD className="text-right">
                      <input type="number" min="0" value={r.percentage} onChange={(e) => onChangeRow(idx, "percentage", e.target.value)}
                        className={[cellInput, "text-right tabular-nums"].join(" ")} placeholder="0.00" />
                    </TD>
                    <TD className="text-right">
                      <input type="number" min="0" value={r.quantity} onChange={(e) => onChangeRow(idx, "quantity", e.target.value)}
                        className={[cellInput, "text-right tabular-nums"].join(" ")} placeholder="0.000" />
                    </TD>
                    <TD className="text-right">
                      <button onClick={() => onRemove(idx)} type="button"
                        className="h-8 px-3 rounded-lg border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold text-xs transition-colors">
                        Remove
                      </button>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600">
              Total Order Qty: <span className="font-bold text-slate-900 tabular-nums">{clamp0(totalQty).toFixed(3)}</span>
              <span className="ml-3 text-slate-500">Scheduled: <span className="font-semibold tabular-nums">{clamp0(sumQty).toFixed(3)}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Btn ghost onClick={onAdd}>+ Add Line</Btn>
              <Btn ghost onClick={onClose}>Cancel</Btn>
              <Btn onClick={onOk}>OK</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   UI PRIMITIVES — all unchanged
================================================================ */
function StatusBadge({ status }) {
  const map = {
    Approved:        "bg-emerald-50 text-emerald-700 border-emerald-200",
    Pending:         "bg-amber-50 text-amber-700 border-amber-200",
    Closed:          "bg-slate-100 text-slate-600 border-slate-200",
    Cancelled:       "bg-rose-50 text-rose-700 border-rose-200",
    VendorSubmitted: "bg-violet-50 text-violet-700 border-violet-200",
    SentToVendor:    "bg-sky-50 text-sky-700 border-sky-200",
    WalkinAccepted:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={["px-2 py-1 rounded-full text-[11px] font-bold border", map[status] || "bg-sky-50 text-sky-700 border-sky-200"].join(" ")}>
      {status === "WalkinAccepted" ? "✓ Accepted" : status || "—"}
    </span>
  );
}

function ActionBtn({ children, color, disabled, onClick }) {
  const colors = {
    sky:     { base: "border-sky-200 bg-white text-sky-700 hover:bg-sky-50",         dis: "border-slate-200 bg-slate-100 text-slate-400" },
    rose:    { base: "border-rose-200 bg-white text-rose-700 hover:bg-rose-50",       dis: "border-slate-200 bg-slate-100 text-slate-400" },
    emerald: { base: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100", dis: "border-slate-200 bg-slate-100 text-slate-400" },
    violet:  { base: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",     dis: "border-slate-200 bg-slate-100 text-slate-400" },
    amber:   { base: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",         dis: "border-slate-200 bg-slate-100 text-slate-400" },
  };
  const c = colors[color] || colors.sky;
  return (
    <button onClick={onClick} disabled={disabled} type="button"
      className={["h-8 px-3 rounded-lg border font-semibold text-xs transition-colors",
        disabled ? c.dis + " cursor-not-allowed" : c.base].join(" ")}>
      {children}
    </button>
  );
}

function Section({ title, subtitle, right, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-3"
        style={{ background: "linear-gradient(135deg,#f8fafc,#f1f5f9)" }}>
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Btn({ children, ghost, onClick, type = "button" }) {
  return (
    <button onClick={onClick} type={type}
      className={["h-10 px-4 rounded-lg text-sm font-semibold transition-colors border",
        ghost ? "bg-white text-sky-700 border-sky-200 hover:bg-sky-50" : "bg-sky-600 hover:bg-sky-700 text-white border-sky-600",
      ].join(" ")}>
      {children}
    </button>
  );
}

function Row({ label, required, children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[190px_1fr] gap-2 items-start">
      <div className="text-xs font-semibold text-slate-600 pt-2.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </div>
      {children}
    </div>
  );
}

function KpiCard({ label, value, icon, color }) {
  const p = {
    sky:     { bg: "#f0f9ff", border: "#bae6fd", icon: "#0284c7", text: "#0369a1" },
    violet:  { bg: "#f5f3ff", border: "#ddd6fe", icon: "#7c3aed", text: "#6d28d9" },
    emerald: { bg: "#ecfdf5", border: "#a7f3d0", icon: "#059669", text: "#047857" },
    amber:   { bg: "#fffbeb", border: "#fde68a", icon: "#d97706", text: "#b45309" },
  }[color] || { bg: "#f0f9ff", border: "#bae6fd", icon: "#0284c7", text: "#0369a1" };
  return (
    <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: p.bg, border: `1px solid ${p.border}` }}>
      <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "#fff", color: p.icon, border: `1px solid ${p.border}` }}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: p.icon }}>{label}</div>
        <div className="text-sm font-bold tabular-nums mt-0.5" style={{ color: p.text }}>{value}</div>
      </div>
    </div>
  );
}

function ChargePill({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-500">{label}:</span>
      <span className="font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

function QtyField({ label, value, onChange, disabled, readOnly, highlight, customStyle }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">{label}</label>
      <input type="number" min="0" value={value ?? ""} onChange={onChange} disabled={disabled} readOnly={readOnly}
        style={customStyle}
        className={["h-8 w-full rounded-lg border px-2 text-xs text-right tabular-nums outline-none transition",
          highlight
            ? "border-sky-300 bg-sky-50 text-sky-800 focus:ring-2 focus:ring-sky-100 focus:border-sky-400 font-semibold"
            : "border-slate-200 bg-white text-slate-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-100",
          disabled || readOnly ? "cursor-not-allowed" : "",
        ].join(" ")}
        placeholder="0" />
    </div>
  );
}

function TotalRow({ k, v, highlight }) {
  return (
    <div className={["flex items-center justify-between rounded-lg px-3 py-1.5 text-xs",
      highlight ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50 border border-slate-100"].join(" ")}>
      <span className={highlight ? "font-semibold text-emerald-700" : "text-slate-600"}>{k}</span>
      <span className={highlight ? "font-bold tabular-nums text-emerald-700" : "font-semibold tabular-nums text-slate-800"}>{v}</span>
    </div>
  );
}

function FieldBlock({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-slate-600 mb-1">{label}</div>
      {children}
    </label>
  );
}

function MiniKV({ k, v }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center justify-between">
      <span className="text-slate-500 text-xs">{k}</span>
      <span className="font-semibold tabular-nums text-slate-900 text-xs">{v}</span>
    </div>
  );
}

function Toggle({ active, onClick, children }) {
  return (
    <button onClick={onClick} type="button"
      className={["h-10 rounded-lg border text-sm font-semibold transition w-full",
        active ? "bg-sky-600 text-white border-sky-600" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800",
      ].join(" ")}>
      {children}
    </button>
  );
}

function TH({ className = "", children }) {
  return <th className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-left ${className}`}>{children}</th>;
}

function TD({ className = "", children }) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}

function Combo({ value, onChange, options, listId, placeholder }) {
  return (
    <div className="relative">
      <input value={value} onChange={(e) => onChange(e.target.value)} list={listId}
        placeholder={placeholder} className={inputClass} />
      <datalist id={listId}>{options.map((o) => <option key={o} value={o} />)}</datalist>
    </div>
  );
}

const inputClass    = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition";
const cellInput     = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition";
const textareaClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition";

function Input({ className = "", ...props }) {
  return <input {...props} className={[inputClass, className].join(" ")} />;
}




