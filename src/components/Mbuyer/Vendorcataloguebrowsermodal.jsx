import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
// import React, { useState, useEffect, useCallback } from "react";
// import { X, Image as ImageIcon, Send, RefreshCw, Clock, CheckCircle2, MessageSquare } from "lucide-react";

// /**
//  * VendorCatalogueBrowserModal.jsx
//  * =================================
//  * Buyer-side (HQ admin) — browse a vendor's shared catalogue and send an
//  * inquiry (price/size/color/qty). Talks to catalogue_routes.py.
//  *
//  * HOW TO WIRE INTO PurchaseOrderManager.jsx (small, surgical addition —
//  * did NOT re-dump that 2000-line file for this):
//  *
//  *   1. Import: import VendorCatalogueBrowserModal from "./VendorCatalogueBrowserModal";
//  *   2. Add state near the other modal states in PurchaseOrderForm:
//  *        const [showCatalogue, setShowCatalogue] = useState(false);
//  *   3. Add a button next to the vendor name field (only when a registered
//  *      vendor is selected), e.g. right after the "X product(s) loaded"
//  *      message block:
//  *        {general.vendorId && (
//  *          <button type="button" onClick={() => setShowCatalogue(true)}
//  *            className="mt-1 text-[10px] text-indigo-600 font-bold underline">
//  *            📷 Browse catalogue & ask vendor
//  *          </button>
//  *        )}
//  *   4. Render the modal at the bottom of PurchaseOrderForm's JSX, alongside
//  *      showCharges/showReceive:
//  *        {showCatalogue && (
//  *          <VendorCatalogueBrowserModal
//  *            vendorId={general.vendorId}
//  *            vendorName={general.vendorName}
//  *            onClose={() => setShowCatalogue(false)}
//  *            onConvertToItem={(prefill) => {
//  *              // Drop the confirmed inquiry straight into a new item row
//  *              setItems(prev => [...prev, {
//  *                ...EMPTY_ITEM(),
//  *                description: prefill.description,
//  *                quantity:    String(prefill.quantity),
//  *                rate:        String(prefill.rate),
//  *                remarks:     prefill.remarks,
//  *              }]);
//  *              setShowCatalogue(false);
//  *            }}
//  *          />
//  *        )}
//  *
//  *   That's the entire integration — no other changes needed.
//  */

// const API_BASE = APP_API_URL;

// function getAdminToken() {
//   return (
//     localStorage.getItem("admin_token") ||
//     localStorage.getItem("access_token") ||
//     localStorage.getItem("token") ||
//     ""
//   );
// }

// async function authFetch(url, options = {}) {
//   const token = getAdminToken();
//   return fetch(url, {
//     ...options,
//     headers: {
//       ...(token ? { Authorization: `Bearer ${token}` } : {}),
//       ...(options.headers || {}),
//     },
//   });
// }

// function InquiryForm({ item, onClose, onSent }) {
//   const [form, setForm] = useState({
//     requested_size: "", requested_color: "", requested_qty: item.moq || 1,
//     requested_price: item.price_range_min || "", buyer_note: "",
//   });
//   const [sending, setSending] = useState(false);

//   const submit = async () => {
//     setSending(true);
//     try {
//       await authFetch(`${API_BASE}/api/catalogue/inquiries`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ catalogue_item_id: item._id, ...form }),
//       });
//       onSent();
//       onClose();
//     } catch { /* noop */ }
//     finally { setSending(false); }
//   };

//   return (
//     <div className="p-4 space-y-3 bg-indigo-50/60 border-t border-indigo-100">
//       <div className="grid grid-cols-3 gap-2">
//         <select value={form.requested_size} onChange={e => setForm(f => ({ ...f, requested_size: e.target.value }))}
//           className="h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white">
//           <option value="">Size</option>
//           {(item.available_sizes || []).map(s => <option key={s} value={s}>{s}</option>)}
//         </select>
//         <select value={form.requested_color} onChange={e => setForm(f => ({ ...f, requested_color: e.target.value }))}
//           className="h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white">
//           <option value="">Color</option>
//           {(item.available_colors || []).map(c => <option key={c} value={c}>{c}</option>)}
//         </select>
//         <input type="number" min="1" placeholder="Qty" value={form.requested_qty}
//           onChange={e => setForm(f => ({ ...f, requested_qty: e.target.value }))}
//           className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
//       </div>
//       <input type="number" min="0" placeholder="Your target price (₹)" value={form.requested_price}
//         onChange={e => setForm(f => ({ ...f, requested_price: e.target.value }))}
//         className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs" />
//       <textarea rows={2} placeholder="Note to vendor (optional)" value={form.buyer_note}
//         onChange={e => setForm(f => ({ ...f, buyer_note: e.target.value }))}
//         className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs resize-none" />
//       <div className="flex gap-2">
//         <button onClick={onClose} className="flex-1 h-8 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">Cancel</button>
//         <button onClick={submit} disabled={sending}
//           className="flex-1 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-60">
//           <Send className="w-3 h-3" /> {sending ? "Sending…" : "Send Inquiry"}
//         </button>
//       </div>
//     </div>
//   );
// }

// export default function VendorCatalogueBrowserModal({ vendorId, vendorName, onClose, onConvertToItem }) {
//   const [tab, setTab] = useState("browse"); // browse | inquiries
//   const [items, setItems] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [inquiringItem, setInquiringItem] = useState(null);
//   const [inquiries, setInquiries] = useState([]);
//   const [inqLoading, setInqLoading] = useState(false);

//   const fetchCatalogue = useCallback(async () => {
//     if (!vendorId) return;
//     setLoading(true);
//     try {
//       const res = await authFetch(`${API_BASE}/api/catalogue/vendor/${vendorId}`);
//       const json = await res.json();
//       setItems(json.data || []);
//     } catch { setItems([]); }
//     finally { setLoading(false); }
//   }, [vendorId]);

//   const fetchInquiries = useCallback(async () => {
//     setInqLoading(true);
//     try {
//       const res = await authFetch(`${API_BASE}/api/catalogue/inquiries`);
//       const json = await res.json();
//       setInquiries((json.data || []).filter(i => i.vendor_id === vendorId));
//     } catch { setInquiries([]); }
//     finally { setInqLoading(false); }
//   }, [vendorId]);

//   useEffect(() => { fetchCatalogue(); }, [fetchCatalogue]);
//   useEffect(() => { if (tab === "inquiries") fetchInquiries(); }, [tab, fetchInquiries]);

//   const convertInquiry = async (inq) => {
//     try {
//       const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/${inq._id}/convert`, { method: "POST" });
//       const json = await res.json();
//       if (json.po_item_prefill && onConvertToItem) {
//         onConvertToItem(json.po_item_prefill);
//       }
//     } catch { /* noop */ }
//   };

//   const statusStyle = {
//     Pending: "bg-amber-100 text-amber-700", Responded: "bg-emerald-100 text-emerald-700",
//     Declined: "bg-rose-100 text-rose-700", Converted: "bg-indigo-100 text-indigo-700",
//   };

//   return (
//     <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
//       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
//         <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
//           <div>
//             <h2 className="text-base font-bold text-slate-900">{vendorName}'s Catalogue</h2>
//             <p className="text-xs text-slate-500">Browse items, ask for price/size/variants before adding to the PO</p>
//           </div>
//           <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
//         </div>

//         <div className="px-5 pt-3 flex gap-2">
//           {[["browse", "Browse"], ["inquiries", "My Inquiries"]].map(([id, label]) => (
//             <button key={id} onClick={() => setTab(id)}
//               className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
//               {label}
//             </button>
//           ))}
//         </div>

//         <div className="flex-1 overflow-y-auto p-5">
//           {tab === "browse" ? (
//             loading ? (
//               <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
//             ) : items.length === 0 ? (
//               <div className="text-center py-16">
//                 <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
//                 <p className="text-sm font-bold text-slate-600">No catalogue items shared yet</p>
//                 <p className="text-xs text-slate-400 mt-1">This vendor hasn't uploaded a catalogue.</p>
//               </div>
//             ) : (
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//                 {items.map(item => (
//                   <div key={item._id} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
//                     <div className="aspect-video bg-slate-100">
//                       {item.images?.[0] && <img src={item.images[0]} alt={item.item_name} className="w-full h-full object-cover" />}
//                     </div>
//                     <div className="p-3 space-y-1.5">
//                       <p className="text-sm font-bold text-slate-900">{item.item_name}</p>
//                       {(item.price_range_min || item.price_range_max) && (
//                         <p className="text-xs text-emerald-600 font-bold">₹{item.price_range_min}–₹{item.price_range_max}</p>
//                       )}
//                       <div className="flex flex-wrap gap-1">
//                         {(item.available_sizes || []).map(s => <span key={s} className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-600">{s}</span>)}
//                       </div>
//                       {item.description && <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>}
//                       {inquiringItem === item._id ? (
//                         <InquiryForm item={item} onClose={() => setInquiringItem(null)} onSent={() => setTab("inquiries")} />
//                       ) : (
//                         <button onClick={() => setInquiringItem(item._id)}
//                           className="w-full h-8 mt-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
//                           <MessageSquare className="w-3.5 h-3.5" /> Ask price / size / variant
//                         </button>
//                       )}
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )
//           ) : (
//             inqLoading ? (
//               <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
//             ) : inquiries.length === 0 ? (
//               <div className="text-center py-16">
//                 <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
//                 <p className="text-sm font-bold text-slate-600">No inquiries yet</p>
//               </div>
//             ) : (
//               <div className="space-y-3">
//                 {inquiries.map(inq => (
//                   <div key={inq._id} className="rounded-xl border border-slate-200 p-3">
//                     <div className="flex items-center justify-between mb-2">
//                       <p className="text-sm font-bold text-slate-900">{inq.item_name}</p>
//                       <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyle[inq.status]}`}>{inq.status}</span>
//                     </div>
//                     <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 mb-2">
//                       <div>Size: <b className="text-slate-700">{inq.requested_size || "—"}</b></div>
//                       <div>Color: <b className="text-slate-700">{inq.requested_color || "—"}</b></div>
//                       <div>Qty: <b className="text-slate-700">{inq.requested_qty || "—"}</b></div>
//                     </div>
//                     {inq.vendor_response && (
//                       <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs mb-2">
//                         <p className="font-bold text-emerald-700 mb-1">Vendor's response:</p>
//                         <p>Price: ₹{inq.vendor_response.confirmed_price} · Qty: {inq.vendor_response.confirmed_qty} · {inq.vendor_response.confirmed_size}/{inq.vendor_response.confirmed_color}</p>
//                         {inq.vendor_response.vendor_note && <p className="italic mt-1">"{inq.vendor_response.vendor_note}"</p>}
//                       </div>
//                     )}
//                     {inq.status === "Responded" && (
//                       <button onClick={() => convertInquiry(inq)}
//                         className="w-full h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1">
//                         <CheckCircle2 className="w-3.5 h-3.5" /> Add to PO Items
//                       </button>
//                     )}
//                   </div>
//                 ))}
//               </div>
//             )
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }



import React, { useState, useEffect, useCallback } from "react";
import { X, Image as ImageIcon, Send, RefreshCw, Clock, CheckCircle2, MessageSquare } from "lucide-react";

/**
 * VendorCatalogueBrowserModal.jsx
 * =================================
 * Buyer-side (HQ admin) — browse a vendor's shared catalogue and send an
 * inquiry (price/size/color/qty). Talks to catalogue_routes.py.
 *
 * HOW TO WIRE INTO PurchaseOrderManager.jsx (small, surgical addition —
 * did NOT re-dump that 2000-line file for this):
 *
 *   1. Import: import VendorCatalogueBrowserModal from "./VendorCatalogueBrowserModal";
 *   2. Add state near the other modal states in PurchaseOrderForm:
 *        const [showCatalogue, setShowCatalogue] = useState(false);
 *   3. Add a button next to the vendor name field (only when a registered
 *      vendor is selected), e.g. right after the "X product(s) loaded"
 *      message block:
 *        {general.vendorId && (
 *          <button type="button" onClick={() => setShowCatalogue(true)}
 *            className="mt-1 text-[10px] text-indigo-600 font-bold underline">
 *            📷 Browse catalogue & ask vendor
 *          </button>
 *        )}
 *   4. Render the modal at the bottom of PurchaseOrderForm's JSX, alongside
 *      showCharges/showReceive:
 *        {showCatalogue && (
 *          <VendorCatalogueBrowserModal
 *            vendorId={general.vendorId}
 *            vendorName={general.vendorName}
 *            onClose={() => setShowCatalogue(false)}
 *            onConvertToItem={(prefill) => {
 *              // Drop the confirmed inquiry straight into a new item row
 *              setItems(prev => [...prev, {
 *                ...EMPTY_ITEM(),
 *                description: prefill.description,
 *                quantity:    String(prefill.quantity),
 *                rate:        String(prefill.rate),
 *                remarks:     prefill.remarks,
 *              }]);
 *              setShowCatalogue(false);
 *            }}
 *          />
 *        )}
 *
 *   That's the entire integration — no other changes needed.
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

function InquiryForm({ item, onClose, onSent }) {
  const [form, setForm] = useState({
    requested_size: "", requested_color: "", requested_qty: item.moq || 1,
    requested_price: item.price_range_min || "", buyer_note: "",
  });
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      await authFetch(`${API_BASE}/api/catalogue/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogue_item_id: item._id, ...form }),
      });
      onSent();
      onClose();
    } catch { /* noop */ }
    finally { setSending(false); }
  };

  return (
    <div className="p-4 space-y-3 bg-indigo-50/60 border-t border-indigo-100">
      <div className="grid grid-cols-3 gap-2">
        <select value={form.requested_size} onChange={e => setForm(f => ({ ...f, requested_size: e.target.value }))}
          className="h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white">
          <option value="">Size</option>
          {(item.available_sizes || []).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={form.requested_color} onChange={e => setForm(f => ({ ...f, requested_color: e.target.value }))}
          className="h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white">
          <option value="">Color</option>
          {(item.available_colors || []).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="number" min="1" placeholder="Qty" value={form.requested_qty}
          onChange={e => setForm(f => ({ ...f, requested_qty: e.target.value }))}
          className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
      </div>
      <input type="number" min="0" placeholder="Your target price (₹)" value={form.requested_price}
        onChange={e => setForm(f => ({ ...f, requested_price: e.target.value }))}
        className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs" />
      <textarea rows={2} placeholder="Note to vendor (optional)" value={form.buyer_note}
        onChange={e => setForm(f => ({ ...f, buyer_note: e.target.value }))}
        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs resize-none" />
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 h-8 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">Cancel</button>
        <button onClick={submit} disabled={sending}
          className="flex-1 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-60">
          <Send className="w-3 h-3" /> {sending ? "Sending…" : "Send Inquiry"}
        </button>
      </div>
    </div>
  );
}

export default function VendorCatalogueBrowserModal({ vendorId, vendorName, onClose, onConvertToItem }) {
  const [tab, setTab] = useState("browse"); // browse | inquiries
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inquiringItem, setInquiringItem] = useState(null);
  const [inquiries, setInquiries] = useState([]);
  const [inqLoading, setInqLoading] = useState(false);
  const [convertingId, setConvertingId] = useState(null);
  const [convertError, setConvertError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exportFormat, setExportFormat] = useState("pdf");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null); // { id, message }

  const fetchCatalogue = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/catalogue/vendor/${vendorId}`);
      const json = await res.json();
      setItems(json.data || []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [vendorId]);

  const fetchInquiries = useCallback(async () => {
    setInqLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/catalogue/inquiries`);
      const json = await res.json();
      setInquiries((json.data || []).filter(i => i.vendor_id === vendorId));
    } catch { setInquiries([]); }
    finally { setInqLoading(false); }
  }, [vendorId]);

  useEffect(() => { fetchCatalogue(); }, [fetchCatalogue]);
  useEffect(() => { if (tab === "inquiries") fetchInquiries(); }, [tab, fetchInquiries]);
  useEffect(() => { setSelectedIds(new Set()); }, [vendorId]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const downloadSummary = async () => {
    if (selectedIds.size === 0) return;
    setExporting(true);
    setExportError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiry_ids: Array.from(selectedIds), format: exportFormat }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to generate summary sheet.");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `quotation_summary.${exportFormat}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const convertInquiry = async (inq) => {
    setConvertingId(inq._id);
    setConvertError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/${inq._id}/convert`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        // ⚠️ FIX: previously unchecked — a rejected convert (e.g. the
        // inquiry's confirmed price/qty turned out invalid) just silently
        // did nothing, with the buyer clicking "Add to PO Items" and
        // seeing no feedback at all about why.
        throw new Error(json.detail || "Failed to convert this inquiry.");
      }
      if (json.po_item_prefill && onConvertToItem) {
        onConvertToItem(json.po_item_prefill);
      }
    } catch (err) {
      setConvertError({ id: inq._id, message: err.message });
    } finally {
      setConvertingId(null);
    }
  };

  const statusStyle = {
    Pending: "bg-amber-100 text-amber-700", Responded: "bg-emerald-100 text-emerald-700",
    Declined: "bg-rose-100 text-rose-700", Converted: "bg-indigo-100 text-indigo-700",
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
          <div>
            <h2 className="text-base font-bold text-slate-900">{vendorName}'s Catalogue</h2>
            <p className="text-xs text-slate-500">Browse items, ask for price/size/variants before adding to the PO</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        <div className="px-5 pt-3 flex gap-2">
          {[["browse", "Browse"], ["inquiries", "My Inquiries"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "browse" ? (
            loading ? (
              <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
            ) : items.length === 0 ? (
              <div className="text-center py-16">
                <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-600">No catalogue items shared yet</p>
                <p className="text-xs text-slate-400 mt-1">This vendor hasn't uploaded a catalogue.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.map(item => (
                  <div key={item._id} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <div className="aspect-video bg-slate-100">
                      {item.images?.[0] && <img src={item.images[0]} alt={item.item_name} className="w-full h-full object-cover" />}
                    </div>
                    <div className="p-3 space-y-1.5">
                      <p className="text-sm font-bold text-slate-900">{item.item_name}</p>
                      {(item.price_range_min || item.price_range_max) && (
                        <p className="text-xs text-emerald-600 font-bold">₹{item.price_range_min}–₹{item.price_range_max}</p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {(item.available_sizes || []).map(s => <span key={s} className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-600">{s}</span>)}
                      </div>
                      {item.description && <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>}
                      {inquiringItem === item._id ? (
                        <InquiryForm item={item} onClose={() => setInquiringItem(null)} onSent={() => setTab("inquiries")} />
                      ) : (
                        <button onClick={() => setInquiringItem(item._id)}
                          className="w-full h-8 mt-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" /> Ask price / size / variant
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            inqLoading ? (
              <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
            ) : inquiries.length === 0 ? (
              <div className="text-center py-16">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-600">No inquiries yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inquiries.some(i => i.status === "Responded" || i.status === "Converted") && (
                  <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border border-slate-200 rounded-xl px-3 py-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">
                      {selectedIds.size === 0
                        ? "Tick negotiated items to download a summary"
                        : `${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""} selected`}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <select value={exportFormat} onChange={e => setExportFormat(e.target.value)}
                        className="h-8 px-2 border border-slate-200 rounded-lg text-xs bg-white">
                        <option value="pdf">PDF</option>
                        <option value="xlsx">Excel</option>
                      </select>
                      <button onClick={downloadSummary} disabled={selectedIds.size === 0 || exporting}
                        className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 rotate-90" /> {exporting ? "Preparing…" : "Download Summary"}
                      </button>
                    </div>
                    {exportError && (
                      <p className="w-full text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                        ⚠ {exportError}
                      </p>
                    )}
                  </div>
                )}
                {inquiries.map(inq => {
                  const selectable = inq.status === "Responded" || inq.status === "Converted";
                  return (
                  <div key={inq._id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {selectable && (
                          <input type="checkbox" checked={selectedIds.has(inq._id)}
                            onChange={() => toggleSelect(inq._id)}
                            className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                        )}
                        <p className="text-sm font-bold text-slate-900">{inq.item_name}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyle[inq.status]}`}>{inq.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 mb-2">
                      <div>Size: <b className="text-slate-700">{inq.requested_size || "—"}</b></div>
                      <div>Color: <b className="text-slate-700">{inq.requested_color || "—"}</b></div>
                      <div>Qty: <b className="text-slate-700">{inq.requested_qty || "—"}</b></div>
                    </div>
                    {inq.vendor_response && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs mb-2">
                        <p className="font-bold text-emerald-700 mb-1">Vendor's response:</p>
                        <p>Price: ₹{inq.vendor_response.confirmed_price} · Qty: {inq.vendor_response.confirmed_qty} · {inq.vendor_response.confirmed_size}/{inq.vendor_response.confirmed_color}</p>
                        {inq.vendor_response.vendor_note && <p className="italic mt-1">"{inq.vendor_response.vendor_note}"</p>}
                      </div>
                    )}
                    {inq.status === "Responded" && (
                      <>
                        <button onClick={() => convertInquiry(inq)} disabled={convertingId === inq._id}
                          className="w-full h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-60">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {convertingId === inq._id ? "Adding…" : "Add to PO Items"}
                        </button>
                        {convertError?.id === inq._id && (
                          <p className="mt-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                            ⚠ {convertError.message}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}