import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

// import React, { useState, useCallback } from "react";
// import { Search, X, Image as ImageIcon, Send, RefreshCw, CheckCircle2, Trophy } from "lucide-react";

// /**
//  * VendorCompareSearch.jsx
//  * ==========================
//  * Buyer-side (HQ admin) — search catalogue items across ALL approved
//  * vendors by category/business type, multi-select items from DIFFERENT
//  * vendors, and send one fan-out inquiry to all of them at once. Then view
//  * their responses side by side, and convert the winner straight into a PO
//  * item — same conversion endpoint the single-vendor flow already uses.
//  *
//  * Talks to catalogue_routes.py's GET /search, POST /inquiries/compare,
//  * and GET /inquiries/compare/{group_id} routes.
//  *
//  * HOW TO WIRE INTO PurchaseOrderManager.jsx (same pattern as
//  * VendorCatalogueBrowserModal.jsx's wiring note):
//  *   1. import VendorCompareSearch from "./VendorCompareSearch";
//  *   2. const [showCompare, setShowCompare] = useState(false);
//  *   3. A button anywhere in the PO form, NOT gated on a vendor being
//  *      selected (unlike the single-vendor browse button) — this is for
//  *      finding a vendor in the first place:
//  *        <button onClick={() => setShowCompare(true)}>
//  *          🔍 Search vendors by category
//  *        </button>
//  *   4. {showCompare && (
//  *        <VendorCompareSearch
//  *          onClose={() => setShowCompare(false)}
//  *          onConvertToItem={(prefill) => {
//  *            setItems(prev => [...prev, { ...EMPTY_ITEM(), ...prefill }]);
//  *            setShowCompare(false);
//  *          }}
//  *        />
//  *      )}
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

// const BUSINESS_TYPES = [
//   ["", "All types"],
//   ["wholesaler", "Wholesaler"],
//   ["manufacturer", "Manufacturer"],
//   ["retailer", "Retailer"],
//   ["fabric_supplier", "Fabric supplier"],
//   ["exporter", "Exporter"],
// ];

// function CompareRequestForm({ selectedItems, onClose, onSent }) {
//   const [form, setForm] = useState({
//     requested_size: "", requested_color: "", requested_qty: 1,
//     requested_price: "", buyer_note: "",
//   });
//   const [sending, setSending] = useState(false);
//   const [error, setError] = useState(null);

//   const submit = async () => {
//     setSending(true);
//     setError(null);
//     try {
//       const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/compare`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           catalogue_item_ids: selectedItems.map(i => i._id),
//           ...form,
//         }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Failed to send comparison request.");
//       onSent(data.comparison_group_id);
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setSending(false);
//     }
//   };

//   return (
//     <div className="p-5 space-y-3">
//       <p className="text-xs font-bold text-slate-600">
//         Sending to {selectedItems.length} vendors: {selectedItems.map(i => i.vendor_name).join(", ")}
//       </p>
//       <div className="grid grid-cols-3 gap-2">
//         <input placeholder="Size" value={form.requested_size}
//           onChange={e => setForm(f => ({ ...f, requested_size: e.target.value }))}
//           className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
//         <input placeholder="Color" value={form.requested_color}
//           onChange={e => setForm(f => ({ ...f, requested_color: e.target.value }))}
//           className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
//         <input type="number" min="1" placeholder="Qty" value={form.requested_qty}
//           onChange={e => setForm(f => ({ ...f, requested_qty: e.target.value }))}
//           className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
//       </div>
//       <input type="number" min="0" placeholder="Your target price (₹)" value={form.requested_price}
//         onChange={e => setForm(f => ({ ...f, requested_price: e.target.value }))}
//         className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs" />
//       <textarea rows={2} placeholder="Note to vendors (optional)" value={form.buyer_note}
//         onChange={e => setForm(f => ({ ...f, buyer_note: e.target.value }))}
//         className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs resize-none" />
//       {error && <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">⚠ {error}</p>}
//       <div className="flex gap-2">
//         <button onClick={onClose} className="flex-1 h-9 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">Cancel</button>
//         <button onClick={submit} disabled={sending}
//           className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
//           <Send className="w-3.5 h-3.5" /> {sending ? "Sending…" : `Request from ${selectedItems.length} vendors`}
//         </button>
//       </div>
//     </div>
//   );
// }

// function ComparisonResults({ groupId, onConvertToItem, onBack }) {
//   const [rows, setRows] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [convertingId, setConvertingId] = useState(null);
//   const [error, setError] = useState(null);

//   const fetchResults = useCallback(async () => {
//     setLoading(true);
//     try {
//       const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/compare/${groupId}`);
//       const json = await res.json();
//       setRows(json.data || []);
//     } catch { setRows([]); }
//     finally { setLoading(false); }
//   }, [groupId]);

//   React.useEffect(() => { fetchResults(); }, [fetchResults]);

//   const convert = async (row) => {
//     setConvertingId(row._id);
//     setError(null);
//     try {
//       const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/${row._id}/convert`, { method: "POST" });
//       const json = await res.json();
//       if (!res.ok) throw new Error(json.detail || "Failed to convert.");
//       if (json.po_item_prefill && onConvertToItem) onConvertToItem(json.po_item_prefill);
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setConvertingId(null);
//     }
//   };

//   const statusStyle = {
//     Pending: "bg-amber-100 text-amber-700", Responded: "bg-emerald-100 text-emerald-700",
//     Declined: "bg-rose-100 text-rose-700", Converted: "bg-indigo-100 text-indigo-700",
//   };

//   const cheapestRespondedId = rows.find(r => r.status === "Responded")?._id;

//   return (
//     <div className="p-5 space-y-3">
//       <div className="flex items-center justify-between">
//         <button onClick={onBack} className="text-xs font-bold text-slate-500 hover:text-slate-700">← Back to search</button>
//         <button onClick={fetchResults} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
//           <RefreshCw className="w-3 h-3" /> Refresh
//         </button>
//       </div>

//       {error && <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">⚠ {error}</p>}

//       {loading ? (
//         <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
//       ) : rows.length === 0 ? (
//         <p className="text-center text-sm text-slate-400 py-12">No responses yet — check back soon.</p>
//       ) : (
//         <div className="space-y-2">
//           {rows.map(row => {
//             const vr = row.vendor_response || {};
//             const isCheapest = row._id === cheapestRespondedId;
//             return (
//               <div key={row._id} className={`rounded-xl border p-3 ${isCheapest ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200"}`}>
//                 <div className="flex items-center justify-between mb-1.5">
//                   <div className="flex items-center gap-2">
//                     {isCheapest && <Trophy className="w-3.5 h-3.5 text-emerald-600" />}
//                     <p className="text-sm font-bold text-slate-900">{row.vendor_name}</p>
//                     <span className="text-xs text-slate-400">· {row.item_name}</span>
//                   </div>
//                   <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyle[row.status] || "bg-slate-100"}`}>{row.status}</span>
//                 </div>
//                 {row.status === "Responded" ? (
//                   <div className="flex items-center justify-between">
//                     <p className="text-xs text-slate-600">
//                       ₹{vr.confirmed_price} · qty {vr.confirmed_qty} · {vr.confirmed_size}/{vr.confirmed_color}
//                     </p>
//                     <button onClick={() => convert(row)} disabled={convertingId === row._id}
//                       className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 disabled:opacity-60">
//                       <CheckCircle2 className="w-3 h-3" /> {convertingId === row._id ? "Adding…" : "Add to PO"}
//                     </button>
//                   </div>
//                 ) : (
//                   <p className="text-xs text-slate-400">Waiting for vendor's response…</p>
//                 )}
//               </div>
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// }

// export default function VendorCompareSearch({ onClose, onConvertToItem }) {
//   const [category, setCategory] = useState("");
//   const [businessType, setBusinessType] = useState("");
//   const [results, setResults] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [searched, setSearched] = useState(false);
//   const [searchError, setSearchError] = useState(null);
//   const [stage, setStage] = useState("search"); // search | request | results
//   const [groupId, setGroupId] = useState(null);
//   const [selectedMap, setSelectedMap] = useState(new Map());

//   const runSearch = async () => {
//     setLoading(true);
//     setSearched(true);
//     setSearchError(null);
//     try {
//       const params = new URLSearchParams();
//       if (category) params.set("category", category);
//       if (businessType) params.set("business_type", businessType);
//       const res = await authFetch(`${API_BASE}/api/catalogue/search?${params.toString()}`);
//       const json = await res.json();
//       if (!res.ok) {
//         // ⚠️ FIXED: same bug as QuickOrderFromCatalogue.jsx's runSearch —
//         // any backend error was silently indistinguishable from a
//         // genuine zero-result search.
//         throw new Error(json.detail || `Search failed (${res.status}).`);
//       }
//       setResults(json.data || []);
//     } catch (err) {
//       setResults([]);
//       setSearchError(err.message || "Search failed.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const toggleItem = (item) => {
//     setSelectedMap(prev => {
//       const next = new Map(prev);
//       if (next.has(item._id)) next.delete(item._id); else next.set(item._id, item);
//       return next;
//     });
//   };

//   const selectedItems = Array.from(selectedMap.values());

//   return (
//     <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
//       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
//         <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
//           <div>
//             <h2 className="text-base font-bold text-slate-900">Compare vendors</h2>
//             <p className="text-xs text-slate-500">Search by category, select items from several vendors, request quotes at once</p>
//           </div>
//           <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
//         </div>

//         {stage === "search" && (
//           <>
//             <div className="px-5 pt-4 pb-2 flex gap-2">
//               <div className="flex-1 relative">
//                 <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
//                 <input value={category} onChange={e => setCategory(e.target.value)}
//                   onKeyDown={e => e.key === "Enter" && runSearch()}
//                   placeholder="e.g. casual t-shirts"
//                   className="w-full h-9 pl-8 pr-3 border border-slate-200 rounded-lg text-sm" />
//               </div>
//               <select value={businessType} onChange={e => setBusinessType(e.target.value)}
//                 className="h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white">
//                 {BUSINESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
//               </select>
//               <button onClick={runSearch}
//                 className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold">
//                 Search
//               </button>
//             </div>

//             <div className="flex-1 overflow-y-auto p-5 pt-2">
//               {loading ? (
//                 <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
//               ) : searchError ? (
//                 <div className="text-center py-16">
//                   <p className="text-sm font-semibold text-rose-600">⚠ {searchError}</p>
//                   <p className="text-xs text-slate-400 mt-1">This is a search error, not a zero-result search — try again.</p>
//                 </div>
//               ) : !searched ? (
//                 <p className="text-center text-sm text-slate-400 py-16">Search to see matching items across your approved vendors.</p>
//               ) : results.length === 0 ? (
//                 <p className="text-center text-sm text-slate-400 py-16">No matching items found among your approved vendors.</p>
//               ) : (
//                 <div className="grid grid-cols-2 gap-3">
//                   {results.map(item => {
//                     const selected = selectedMap.has(item._id);
//                     return (
//                       <button key={item._id} onClick={() => toggleItem(item)}
//                         className={`text-left rounded-xl border overflow-hidden transition ${selected ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200"}`}>
//                         <div className="aspect-video bg-slate-100 relative">
//                           {item.images?.[0] && <img src={item.images[0]} className="w-full h-full object-cover" />}
//                           {selected && <div className="absolute top-2 right-2 bg-indigo-600 rounded-full p-1"><CheckCircle2 className="w-3.5 h-3.5 text-white" /></div>}
//                         </div>
//                         <div className="p-2.5">
//                           <p className="text-xs font-bold text-slate-900 truncate">{item.item_name}</p>
//                           <p className="text-[10px] text-slate-500 flex items-center gap-1">
//                             {item.vendor_name}
//                             {item.featured_badge && (
//                               <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-bold">✓ Verified</span>
//                             )}
//                           </p>
//                           {(item.price_range_min || item.price_range_max) && (
//                             <p className="text-[10px] text-emerald-600 font-bold mt-0.5">₹{item.price_range_min}–₹{item.price_range_max}</p>
//                           )}
//                         </div>
//                       </button>
//                     );
//                   })}
//                 </div>
//               )}
//             </div>

//             <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
//               <span className="text-xs font-bold text-slate-500">
//                 {selectedItems.length === 0 ? "Select 2+ items from different vendors" : `${selectedItems.length} selected`}
//               </span>
//               <button onClick={() => setStage("request")} disabled={selectedItems.length < 2}
//                 className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-40">
//                 Request quotes →
//               </button>
//             </div>
//           </>
//         )}

//         {stage === "request" && (
//           <CompareRequestForm
//             selectedItems={selectedItems}
//             onClose={() => setStage("search")}
//             onSent={(gid) => { setGroupId(gid); setStage("results"); }}
//           />
//         )}

//         {stage === "results" && groupId && (
//           <ComparisonResults
//             groupId={groupId}
//             onConvertToItem={onConvertToItem}
//             onBack={() => setStage("search")}
//           />
//         )}
//       </div>
//     </div>
//   );
// }


import React, { useState, useCallback } from "react";
import { Search, X, Image as ImageIcon, Send, RefreshCw, CheckCircle2, Trophy } from "lucide-react";

/**
 * VendorCompareSearch.jsx
 * ==========================
 * Buyer-side (HQ admin) — search catalogue items across ALL approved
 * vendors by category/business type, multi-select items from DIFFERENT
 * vendors, and send one fan-out inquiry to all of them at once. Then view
 * their responses side by side, and convert the winner straight into a PO
 * item — same conversion endpoint the single-vendor flow already uses.
 *
 * Talks to catalogue_routes.py's GET /search, POST /inquiries/compare,
 * and GET /inquiries/compare/{group_id} routes.
 *
 * HOW TO WIRE INTO PurchaseOrderManager.jsx (same pattern as
 * VendorCatalogueBrowserModal.jsx's wiring note):
 *   1. import VendorCompareSearch from "./VendorCompareSearch";
 *   2. const [showCompare, setShowCompare] = useState(false);
 *   3. A button anywhere in the PO form, NOT gated on a vendor being
 *      selected (unlike the single-vendor browse button) — this is for
 *      finding a vendor in the first place:
 *        <button onClick={() => setShowCompare(true)}>
 *          🔍 Search vendors by category
 *        </button>
 *   4. {showCompare && (
 *        <VendorCompareSearch
 *          onClose={() => setShowCompare(false)}
 *          onConvertToItem={(prefill) => {
 *            setItems(prev => [...prev, { ...EMPTY_ITEM(), ...prefill }]);
 *            setShowCompare(false);
 *          }}
 *        />
 *      )}
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

const BUSINESS_TYPES = [
  ["", "All types"],
  ["general_vendor", "General vendor"],
  ["wholesaler", "Wholesaler"],
  ["manufacturer", "Manufacturer"],
  ["distributor", "Distributor"],
  ["retailer", "Retailer"],
  ["fabric_supplier", "Fabric supplier"],
  ["exporter", "Exporter"],
];

function CompareRequestForm({ selectedItems, onClose, onSent }) {
  const [form, setForm] = useState({
    requested_size: "", requested_color: "", requested_qty: 1,
    requested_price: "", buyer_note: "",
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogue_item_ids: selectedItems.map(i => i._id),
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send comparison request.");
      onSent(data.comparison_group_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-5 space-y-3">
      <p className="text-xs font-bold text-slate-600">
        Sending to {selectedItems.length} vendors: {selectedItems.map(i => i.vendor_name).join(", ")}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <input placeholder="Size" value={form.requested_size}
          onChange={e => setForm(f => ({ ...f, requested_size: e.target.value }))}
          className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
        <input placeholder="Color" value={form.requested_color}
          onChange={e => setForm(f => ({ ...f, requested_color: e.target.value }))}
          className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
        <input type="number" min="1" placeholder="Qty" value={form.requested_qty}
          onChange={e => setForm(f => ({ ...f, requested_qty: e.target.value }))}
          className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
      </div>
      <input type="number" min="0" placeholder="Your target price (₹)" value={form.requested_price}
        onChange={e => setForm(f => ({ ...f, requested_price: e.target.value }))}
        className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs" />
      <textarea rows={2} placeholder="Note to vendors (optional)" value={form.buyer_note}
        onChange={e => setForm(f => ({ ...f, buyer_note: e.target.value }))}
        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs resize-none" />
      {error && <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">⚠ {error}</p>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 h-9 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">Cancel</button>
        <button onClick={submit} disabled={sending}
          className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
          <Send className="w-3.5 h-3.5" /> {sending ? "Sending…" : `Request from ${selectedItems.length} vendors`}
        </button>
      </div>
    </div>
  );
}

function ComparisonResults({ groupId, onConvertToItem, onBack }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState(null);
  const [error, setError] = useState(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/compare/${groupId}`);
      const json = await res.json();
      setRows(json.data || []);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [groupId]);

  React.useEffect(() => { fetchResults(); }, [fetchResults]);

  const convert = async (row) => {
    setConvertingId(row._id);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/${row._id}/convert`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to convert.");
      if (json.po_item_prefill && onConvertToItem) onConvertToItem(json.po_item_prefill);
    } catch (err) {
      setError(err.message);
    } finally {
      setConvertingId(null);
    }
  };

  const statusStyle = {
    Pending: "bg-amber-100 text-amber-700", Responded: "bg-emerald-100 text-emerald-700",
    Declined: "bg-rose-100 text-rose-700", Converted: "bg-indigo-100 text-indigo-700",
  };

  // ⚠️ FIXED: rows now arrive pre-grouped by item_name from the backend
  // (see catalogue_routes.py's get_comparison_group sort fix), but
  // grouping still needs to happen HERE too — a flat list with no visual
  // headers looked identical whether it was sorted correctly or not.
  // Also fixes a second bug found while doing this: the old single
  // `cheapestRespondedId` was computed across ALL rows regardless of
  // product, so the Trophy badge could crown the globally cheapest item
  // (e.g. a kurti) even on a t-shirt row, which made no sense — cheapest
  // is now computed per item_name group.
  const groups = [];
  const groupIndex = new Map();
  for (const row of rows) {
    const key = row.item_name || "Other";
    if (!groupIndex.has(key)) {
      groupIndex.set(key, groups.length);
      groups.push({ item_name: key, rows: [] });
    }
    groups[groupIndex.get(key)].rows.push(row);
  }
  for (const g of groups) {
    const cheapest = g.rows.find(r => r.status === "Responded");
    g.cheapestId = cheapest?._id;
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs font-bold text-slate-500 hover:text-slate-700">← Back to search</button>
        <button onClick={fetchResults} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {error && <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">⚠ {error}</p>}

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-12">No responses yet — check back soon.</p>
      ) : (
        groups.map(group => (
          <div key={group.item_name}>
            <p className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              {group.item_name}
              <span className="font-normal normal-case text-slate-400">— {group.rows.length} quote{group.rows.length !== 1 ? "s" : ""}</span>
            </p>
            <div className="space-y-2 mb-4">
              {group.rows.map(row => {
                const vr = row.vendor_response || {};
                const isCheapest = row._id === group.cheapestId;
                return (
                  <div key={row._id} className={`rounded-xl border p-3 ${isCheapest ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200"}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {isCheapest && <Trophy className="w-3.5 h-3.5 text-emerald-600" />}
                        <p className="text-sm font-bold text-slate-900">{row.vendor_name}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyle[row.status] || "bg-slate-100"}`}>{row.status}</span>
                    </div>
                    {row.status === "Responded" ? (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-600">
                          ₹{vr.confirmed_price} · qty {vr.confirmed_qty} · {vr.confirmed_size}/{vr.confirmed_color}
                        </p>
                        <button onClick={() => convert(row)} disabled={convertingId === row._id}
                          className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 disabled:opacity-60">
                          <CheckCircle2 className="w-3 h-3" /> {convertingId === row._id ? "Adding…" : "Add to PO"}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Waiting for vendor's response…</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function VendorCompareSearch({ onClose, onConvertToItem }) {
  const [category, setCategory] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [stage, setStage] = useState("search"); // search | request | results
  const [groupId, setGroupId] = useState(null);
  const [selectedMap, setSelectedMap] = useState(new Map());

  const runSearch = async () => {
    setLoading(true);
    setSearched(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (businessType) params.set("business_type", businessType);
      const res = await authFetch(`${API_BASE}/api/catalogue/search?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        // ⚠️ FIXED: same bug as QuickOrderFromCatalogue.jsx's runSearch —
        // any backend error was silently indistinguishable from a
        // genuine zero-result search.
        throw new Error(json.detail || `Search failed (${res.status}).`);
      }
      setResults(json.data || []);
    } catch (err) {
      setResults([]);
      setSearchError(err.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (item) => {
    setSelectedMap(prev => {
      const next = new Map(prev);
      if (next.has(item._id)) next.delete(item._id); else next.set(item._id, item);
      return next;
    });
  };

  const selectedItems = Array.from(selectedMap.values());

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
          <div>
            <h2 className="text-base font-bold text-slate-900">Compare vendors</h2>
            <p className="text-xs text-slate-500">Search by category, select items from several vendors, request quotes at once</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        {stage === "search" && (
          <>
            <div className="px-5 pt-4 pb-2 flex gap-2">
              <div className="flex-1 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={category} onChange={e => setCategory(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runSearch()}
                  placeholder="e.g. casual t-shirts"
                  className="w-full h-9 pl-8 pr-3 border border-slate-200 rounded-lg text-sm" />
              </div>
              <select value={businessType} onChange={e => setBusinessType(e.target.value)}
                className="h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white">
                {BUSINESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button onClick={runSearch}
                className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold">
                Search
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 pt-2">
              {loading ? (
                <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
              ) : searchError ? (
                <div className="text-center py-16">
                  <p className="text-sm font-semibold text-rose-600">⚠ {searchError}</p>
                  <p className="text-xs text-slate-400 mt-1">This is a search error, not a zero-result search — try again.</p>
                </div>
              ) : !searched ? (
                <p className="text-center text-sm text-slate-400 py-16">Search to see matching items across your approved vendors.</p>
              ) : results.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-16">No matching items found among your approved vendors.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {results.map(item => {
                    const selected = selectedMap.has(item._id);
                    return (
                      <button key={item._id} onClick={() => toggleItem(item)}
                        className={`text-left rounded-xl border overflow-hidden transition ${selected ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200"}`}>
                        <div className="aspect-video bg-slate-100 relative">
                          {item.images?.[0] && <img src={item.images[0]} className="w-full h-full object-cover" />}
                          {selected && <div className="absolute top-2 right-2 bg-indigo-600 rounded-full p-1"><CheckCircle2 className="w-3.5 h-3.5 text-white" /></div>}
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.item_name}</p>
                          <p className="text-[10px] text-slate-500 flex items-center gap-1">
                            {item.vendor_name}
                            {item.featured_badge && (
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-bold">✓ Verified</span>
                            )}
                          </p>
                          {(item.price_range_min || item.price_range_max) && (
                            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">₹{item.price_range_min}–₹{item.price_range_max}</p>
                          )}
                          {item.available_sizes?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.available_sizes.slice(0, 6).map(s => (
                                <span key={s} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold">{s}</span>
                              ))}
                            </div>
                          )}
                          {item.available_colors?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.available_colors.slice(0, 4).map(c => (
                                <span key={c} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-semibold">{c}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">
                {selectedItems.length === 0 ? "Select 2+ items from different vendors" : `${selectedItems.length} selected`}
              </span>
              <button onClick={() => setStage("request")} disabled={selectedItems.length < 2}
                className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-40">
                Request quotes →
              </button>
            </div>
          </>
        )}

        {stage === "request" && (
          <CompareRequestForm
            selectedItems={selectedItems}
            onClose={() => setStage("search")}
            onSent={(gid) => { setGroupId(gid); setStage("results"); }}
          />
        )}

        {stage === "results" && groupId && (
          <ComparisonResults
            groupId={groupId}
            onConvertToItem={onConvertToItem}
            onBack={() => setStage("search")}
          />
        )}
      </div>
    </div>
  );
}
