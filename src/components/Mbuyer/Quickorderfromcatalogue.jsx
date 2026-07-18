import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


import React, { useState, useCallback, useEffect } from "react";
import { Search, Send, RefreshCw, CheckCircle2, Trophy, ArrowLeft, Plus, Trash2, ShoppingBag, MessageSquare, FileQuestion, Users } from "lucide-react";
import MyInquiriesPage from "./Myinquiriespage.jsx";
/* The import above intentionally matches the lowercase filename on disk;
   this is required on case-sensitive filesystems such as Linux. */

/**
 * QuickOrderFromCatalogue.jsx
 * ==============================
 * A dedicated page for the "negotiate first, order once you've picked a
 * winner" flow — distinct from PurchaseOrderManager.jsx's general-purpose
 * form. That form assumes you already know which vendor you're ordering
 * from; this page assumes you don't yet, and walks:
 *
 *   1. Search & compare catalogue items across approved vendors
 *   2. Send one request to several vendors at once
 *   3. Wait for responses (this page can be left and re-opened any time —
 *      nothing here is time-sensitive until you actually submit)
 *   4. Pick ONE winning quote — a PO is always single-vendor, so picking
 *      converts that inquiry and locks in vendor + first item
 *   5. Review/add items, then submit — THIS is the only step that
 *      actually creates a real purchase order (POST /purchaseorders/).
 *      Everything before it is non-binding negotiation.
 *
 * Steps 1-3 reuse the same backend routes as VendorCompareSearch.jsx
 * (GET /api/catalogue/search, POST/GET /api/catalogue/inquiries/compare).
 * Step 4 reuses the same POST /api/catalogue/inquiries/{id}/convert every
 * other conversion path in this app already uses — same safety gate,
 * same "only a Responded inquiry with a real price can convert" rule.
 * Step 5 calls the real PO creation endpoint directly.
 *
 * A second tab (My Inquiries) sits alongside the wizard, so a buyer can
 * check on past negotiations across every vendor/session without losing
 * their place — MyInquiriesPage.jsx is a persistent inbox, independent
 * of this wizard's own in-memory step/groupId state.
 *
 * Route this in wherever your app mounts top-level pages, e.g.:
 *   <Route path="/purchase-orders/quick" element={<QuickOrderFromCatalogue />} />
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
  ["", "All types"], ["general_vendor", "General vendor"], ["wholesaler", "Wholesaler"], ["manufacturer", "Manufacturer"],
  ["distributor", "Distributor"], ["retailer", "Retailer"], ["fabric_supplier", "Fabric supplier"], ["exporter", "Exporter"],
];

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_ITEM = () => ({ description: "", quantity: "", rate: "", remarks: "" });

function supplierHighlights(item) {
  const values = (item.supplier_operations || []).flatMap((operation) =>
    Object.values(operation.data || {}).flatMap((value) => Array.isArray(value) ? value : [value])
  );
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, 3);
}

const STEP_LABELS = ["Search", "Request quotes", "Compare & pick", "Review & submit"];

function StepHeader({ step }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEP_LABELS.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
              i === step ? "bg-indigo-600 text-white" : i < step ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
            }`}>
              {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-bold ${i === step ? "text-slate-900" : "text-slate-400"}`}>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && <div className="w-8 h-px bg-slate-200" />}
        </React.Fragment>
      ))}
    </div>
  );
}

class InquiryTabErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("My Inquiries tab failed:", error, info); }
  render() {
    if (this.state.error) return (
      <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-black text-rose-700">My Inquiries could not be displayed</p>
        <p className="mt-2 break-words text-xs text-slate-500">{this.state.error.message || "Unexpected inquiry data."}</p>
        <button type="button" onClick={() => { this.setState({ error: null }); window.location.reload(); }} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white">Reload inquiries</button>
      </div>
    );
    return this.props.children;
  }
}

function QuickOrderTabs({ activeView, onChange }) {
  const tabClass = (key) => `flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
    activeView === key
      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
  }`;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
      <button type="button" onClick={() => onChange("order")} className={tabClass("order")}>
        <ShoppingBag className="h-4 w-4" /> Create Quick Order
      </button>
      <button type="button" onClick={() => onChange("rfq")} className={tabClass("rfq")}><FileQuestion className="h-4 w-4" /> Create Open RFQ</button>
      <button type="button" onClick={() => onChange("inquiries")} className={tabClass("inquiries")}>
        <MessageSquare className="h-4 w-4" /> My Inquiries
      </button>
    </div>
  );
}
function OpenRfqPanel({ onOpenInquiries }) {
  const empty = { item_name:"", category:"", material:"", audience:"", requested_qty:1, requested_size:"", requested_color:"", target_price:"", price_range_min:"", price_range_max:"", delivery_date:"", reference_image_url:"", buyer_note:"", response_deadline:"", allow_alternatives:true };
  const [form,setForm]=useState(empty), [vendors,setVendors]=useState([]), [selected,setSelected]=useState(new Set());
  const [loading,setLoading]=useState(false), [error,setError]=useState(""), [success,setSuccess]=useState("");
  useEffect(()=>{ let dead=false; authFetch(`${API_BASE}/api/catalogue/approved-vendors`).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.detail||"Could not load vendors");if(!dead)setVendors(j.data||[])}).catch(e=>!dead&&setError(e.message));return()=>{dead=true}},[]);
  const change=(key,value)=>setForm(f=>({...f,[key]:value}));
  const toggle=id=>setSelected(old=>{const n=new Set(old);n.has(id)?n.delete(id):n.add(id);return n});
  const send=async()=>{setError("");setSuccess("");if(!form.item_name.trim())return setError("Enter what you want to source.");if(Number(form.requested_qty)<=0)return setError("Quantity must be greater than zero.");if(!selected.size)return setError("Select at least one approved vendor.");setLoading(true);try{const r=await authFetch(`${API_BASE}/api/catalogue/inquiries/open-rfq`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,vendor_ids:[...selected]})});const j=await r.json();if(!r.ok)throw new Error(j.detail||"Failed to send RFQ");setSuccess(j.message);setSelected(new Set())}catch(e){setError(e.message)}finally{setLoading(false)}};
  const input="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm";
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-5 flex gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600"><FileQuestion className="h-5 w-5 text-white"/></div><div><h1 className="text-xl font-black text-slate-900">Open sourcing RFQ</h1><p className="text-xs text-slate-500">Tell approved vendors what you need, even when it is not in their catalogue.</p></div></div>
    {error&&<p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs font-bold text-rose-600">{error}</p>}{success&&<div className="mb-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs font-bold text-emerald-700"><span>{success}</span><button onClick={onOpenInquiries} className="underline">View inquiries</button></div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="lg:col-span-2"><span className="mb-1 block text-[11px] font-bold">Product / requirement *</span><input className={input} value={form.item_name} onChange={e=>change("item_name",e.target.value)} placeholder="e.g. Men's cotton casual shirts"/></label>
      <label><span className="mb-1 block text-[11px] font-bold">Category</span><input className={input} value={form.category} onChange={e=>change("category",e.target.value)} placeholder="Shirts, footwear..."/></label>
      <label><span className="mb-1 block text-[11px] font-bold">Material</span><input className={input} value={form.material} onChange={e=>change("material",e.target.value)} placeholder="Cotton, linen..."/></label>
      <label><span className="mb-1 block text-[11px] font-bold">Audience</span><select className={input} value={form.audience} onChange={e=>change("audience",e.target.value)}><option value="">Any</option><option>Men</option><option>Women</option><option>Kids</option><option>Unisex</option></select></label>
      <label><span className="mb-1 block text-[11px] font-bold">Quantity *</span><input className={input} type="number" min="1" value={form.requested_qty} onChange={e=>change("requested_qty",e.target.value)}/></label>
      <label><span className="mb-1 block text-[11px] font-bold">Sizes</span><input className={input} value={form.requested_size} onChange={e=>change("requested_size",e.target.value)} placeholder="M, L, XL or custom"/></label>
      <label><span className="mb-1 block text-[11px] font-bold">Colors</span><input className={input} value={form.requested_color} onChange={e=>change("requested_color",e.target.value)} placeholder="Navy, white, assorted"/></label>
      <label><span className="mb-1 block text-[11px] font-bold">Exact target price</span><input className={input} type="number" min="0" value={form.target_price} onChange={e=>change("target_price",e.target.value)} placeholder="Optional"/></label>
      <label><span className="mb-1 block text-[11px] font-bold">Price from</span><input className={input} type="number" min="0" value={form.price_range_min} onChange={e=>change("price_range_min",e.target.value)} placeholder="?"/></label>
      <label><span className="mb-1 block text-[11px] font-bold">Price to</span><input className={input} type="number" min="0" value={form.price_range_max} onChange={e=>change("price_range_max",e.target.value)} placeholder="?"/></label>
      <label><span className="mb-1 block text-[11px] font-bold">Required delivery</span><input className={input} type="date" value={form.delivery_date} onChange={e=>change("delivery_date",e.target.value)}/></label>
      <label><span className="mb-1 block text-[11px] font-bold">Vendor response deadline</span><input className={input} type="date" value={form.response_deadline} onChange={e=>change("response_deadline",e.target.value)}/></label>
      <label className="sm:col-span-2"><span className="mb-1 block text-[11px] font-bold">Reference image URL</span><input className={input} value={form.reference_image_url} onChange={e=>change("reference_image_url",e.target.value)} placeholder="Optional reference link"/></label>
      <label className="sm:col-span-2 lg:col-span-3"><span className="mb-1 block text-[11px] font-bold">Specifications and commercial notes</span><textarea rows="3" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.buyer_note} onChange={e=>change("buyer_note",e.target.value)} placeholder="Quality, GSM, branding, sample, packaging, payment terms..."/></label>
    </div>
    <label className="mt-3 flex gap-2 text-xs font-semibold"><input type="checkbox" checked={form.allow_alternatives} onChange={e=>change("allow_alternatives",e.target.checked)}/>Allow close alternatives</label>
    <div className="mt-5 border-t pt-4"><div className="mb-3 flex justify-between"><div><h2 className="flex items-center gap-2 text-sm font-black"><Users className="h-4 w-4 text-violet-600"/>Approved vendors</h2><p className="text-[10px] text-slate-400">Select vendors who should quote.</p></div><button onClick={()=>setSelected(new Set(vendors.map(v=>v._id)))} className="text-xs font-bold text-violet-600">Select all</button></div>
      <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{vendors.map(v=><button type="button" key={v._id} onClick={()=>toggle(v._id)} className={`rounded-xl border p-3 text-left ${selected.has(v._id)?"border-violet-500 bg-violet-50 ring-2 ring-violet-100":"border-slate-200"}`}><div className="flex justify-between"><b className="truncate text-xs">{v.vendor_name}</b>{selected.has(v._id)&&<CheckCircle2 className="h-4 w-4 text-violet-600"/>}</div><p className="mt-1 truncate text-[10px] text-slate-400">{(v.business_type||[]).join(", ")||"Vendor"}</p></button>)}{!vendors.length&&<p className="col-span-full py-5 text-center text-xs text-slate-400">No approved vendors found.</p>}</div>
    </div>
    <div className="mt-5 flex justify-end"><button disabled={loading} onClick={send} className="flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-5 text-xs font-bold text-white disabled:opacity-50"><Send className="h-4 w-4"/>{loading?"Sending...":`Send to ${selected.size} vendor${selected.size===1?"":"s"}`}</button></div>
  </div>;
}

export default function QuickOrderFromCatalogue() {
  const [activeView, setActiveView] = useState("order");
  const [step, setStep] = useState(0);

  const [category, setCategory] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const [capabilityFilter, setCapabilityFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedMap, setSelectedMap] = useState(new Map());
  const [showDropdown, setShowDropdown] = useState(false);

  const [reqForm, setReqForm] = useState({ requested_size: "", requested_color: "", requested_qty: 1, requested_price: "", buyer_note: "", response_deadline: "" });
  const [itemRequests, setItemRequests] = useState({});
  const [sending, setSending] = useState(false);

  const [groupId, setGroupId] = useState(null);
  const [singleInquiryId, setSingleInquiryId] = useState(null); // single-vendor path, no comparison group
  const [rows, setRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [converting, setConverting] = useState(false);

  const [orderVendorName, setOrderVendorName] = useState("");
  const [orderDate, setOrderDate] = useState(today());
  const [orderItems, setOrderItems] = useState([EMPTY_ITEM()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submittedOrderNo, setSubmittedOrderNo] = useState(null);

  const selectedItems = Array.from(selectedMap.values());

  const runSearch = async () => {
    setSearchLoading(true);
    setSearched(true);
    setSubmitError(null);
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (businessType) params.set("business_type", businessType);
      if (vendorName.trim()) params.set("vendor_name", vendorName.trim());
      if (materialFilter.trim()) params.set("material", materialFilter.trim());
      if (capabilityFilter.trim()) params.set("capability", capabilityFilter.trim());
      if (regionFilter.trim()) params.set("service_region", regionFilter.trim());
      if (audienceFilter) params.set("audience", audienceFilter);
      if (minPrice) params.set("min_price", minPrice);
      if (maxPrice) params.set("max_price", maxPrice);
      const res = await authFetch(`${API_BASE}/api/catalogue/search?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || `Search failed (${res.status}).`);
      }
      setResults(json.data || []);
    } catch (err) {
      setResults([]);
      setSubmitError(err.message || "Search failed.");
    } finally {
      setSearchLoading(false);
    }
  };

  // Live search-as-you-type, debounced 350ms. Backend's
  // /api/catalogue/search already matches case-insensitively
  // ($options: "i"), so "C" and "c" have always returned identical
  // results — this just triggers the search automatically while typing.
  useEffect(() => {
    if (step !== 0) return;
    if (!category.trim() && !businessType) {
      setResults([]);
      setSearched(false);
      setShowDropdown(false);
      return;
    }
    setShowDropdown(true);
    const t = setTimeout(() => { runSearch(); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, businessType, step]);

  const toggleItem = (item) => {
    const wasSelected = selectedMap.has(item._id);
    setSelectedMap(prev => {
      const next = new Map(prev);
      if (next.has(item._id)) next.delete(item._id); else next.set(item._id, item);
      return next;
    });
    setItemRequests(prev => {
      const next = { ...prev };
      if (wasSelected) delete next[item._id];
      else if (!next[item._id]) next[item._id] = { ...reqForm };
      return next;
    });
  };

  const updateItemRequest = (itemId, field, value) => {
    setItemRequests(prev => ({
      ...prev,
      [itemId]: { ...reqForm, ...(prev[itemId] || {}), [field]: value },
    }));
  };

  const sendRequest = async () => {
    setSending(true);
    setSubmitError(null);
    try {
      // Single selection uses the plain POST /inquiries endpoint (no
      // comparison group needed for one item); 2+ uses /inquiries/compare.
      if (selectedItems.length === 1) {
        const res = await authFetch(`${API_BASE}/api/catalogue/inquiries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ catalogue_item_id: selectedItems[0]._id, ...reqForm, ...(itemRequests[selectedItems[0]._id] || {}) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to send request.");
        setSingleInquiryId(data.id);
        setGroupId(null);
        setStep(2);
        fetchComparison(null, data.id);
      } else {
        const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/compare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: selectedItems.map(item => ({
              catalogue_item_id: item._id,
              ...reqForm,
              ...(itemRequests[item._id] || {}),
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to send request.");
        setGroupId(data.comparison_group_id);
        setSingleInquiryId(null);
        setStep(2);
        fetchComparison(data.comparison_group_id, null);
      }
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSending(false);
    }
  };

  const fetchComparison = useCallback(async (gid, singleId) => {
    const useGid    = gid ?? groupId;
    const useSingle = singleId ?? singleInquiryId;
    if (!useGid && !useSingle) return;
    setRowsLoading(true);
    try {
      if (useGid) {
        const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/compare/${useGid}`);
        const json = await res.json();
        setRows(json.data || []);
      } else {
        // Single-vendor path has no comparison-group endpoint to poll —
        // reuses GET /inquiries (lists every inquiry for this tenant) and
        // filters down to the one we care about.
        const res = await authFetch(`${API_BASE}/api/catalogue/inquiries`);
        const json = await res.json();
        const match = (json.data || []).find(r => r._id === useSingle);
        setRows(match ? [match] : []);
      }
    } catch { setRows([]); }
    finally { setRowsLoading(false); }
  }, [groupId, singleInquiryId]);

  const pickWinner = async (row) => {
    setConverting(true);
    setSubmitError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/catalogue/inquiries/${row._id}/convert`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to select this quote.");

      setOrderVendorName(json.vendor_name || row.vendor_name);
      setOrderItems([{
        description: json.po_item_prefill.description,
        quantity:    String(json.po_item_prefill.quantity),
        rate:        String(json.po_item_prefill.rate),
        remarks:     json.po_item_prefill.remarks || "",
      }]);
      setStep(3);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setConverting(false);
    }
  };

  const updateItem = (idx, key, val) => setOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));
  const addItem = () => setOrderItems(prev => [...prev, EMPTY_ITEM()]);
  const removeItem = (idx) => setOrderItems(prev => prev.filter((_, i) => i !== idx));

  const submitOrder = async () => {
    setSubmitError(null);
    if (!orderVendorName.trim()) { setSubmitError("Vendor name is required."); return; }
    const validItems = orderItems.filter(it => it.description.trim() && Number(it.quantity) > 0);
    if (validItems.length === 0) { setSubmitError("At least one item with a description and quantity is required."); return; }

    setSubmitting(true);
    try {
      const payload = {
        orderDate:  orderDate,
        vendorName: orderVendorName.trim(),
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

  const resetAll = () => {
    setStep(0); setCategory(""); setBusinessType(""); setResults([]); setSearched(false);
    setSelectedMap(new Map()); setItemRequests({}); setGroupId(null); setSingleInquiryId(null); setRows([]);
    setOrderVendorName(""); setOrderItems([EMPTY_ITEM()]); setSubmittedOrderNo(null); setSubmitError(null);
  };

  const statusStyle = {
    Pending: "bg-amber-100 text-amber-700", Responded: "bg-emerald-100 text-emerald-700",
    Declined: "bg-rose-100 text-rose-700", Converted: "bg-indigo-100 text-indigo-700",
  };

  // ⚠️ MERGED IN — item_name grouping fix. This file previously (in the
  // version you pasted) still had the OLD flat rendering: one global
  // cheapestId and a plain rows.map with no grouping, meaning selecting
  // multiple different products in one compare batch (e.g. Cotton
  // T-Shirt + Floral Kurti quotes together) interleaved them by price
  // with no way to tell which quote belonged to which product, and could
  // crown the wrong product's quote as "cheapest." Grouped by item_name
  // here, cheapest computed per group — same fix already applied to
  // VendorCompareSearch.jsx and MyInquiriesPage.jsx.
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

  if (activeView === "rfq") {
    return <div className="min-h-full bg-[#F6F7FB] p-4 sm:p-6"><div className="mx-auto max-w-5xl space-y-5"><QuickOrderTabs activeView={activeView} onChange={setActiveView}/><OpenRfqPanel onOpenInquiries={()=>setActiveView("inquiries")}/></div></div>;
  }

  if (activeView === "inquiries") {
    return (
      <div className="min-h-full bg-[#F6F7FB] p-4 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-5">
          <QuickOrderTabs activeView={activeView} onChange={setActiveView} />
          <InquiryTabErrorBoundary><MyInquiriesPage /></InquiryTabErrorBoundary>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F6F7FB] p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <QuickOrderTabs activeView={activeView} onChange={setActiveView} />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Quick order from catalogue</h1>
            <p className="text-xs text-slate-500">Negotiate with several vendors first, then create the order once you've picked a winner</p>
          </div>
        </div>

        {submittedOrderNo ? (
          <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-lg font-black text-slate-900">Purchase order created</p>
            <p className="text-sm text-slate-500">Order {submittedOrderNo} — {orderVendorName}</p>
            <button onClick={resetAll}
              className="mt-4 h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold">
              Start another order
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <StepHeader step={step} />

            {submitError && (
              <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                ⚠ {submitError}
              </div>
            )}

            {step === 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <input value={vendorName} onChange={e=>setVendorName(e.target.value)} placeholder="Vendor name" className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs" />
                  <input value={materialFilter} onChange={e=>setMaterialFilter(e.target.value)} placeholder="Material" className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs" />
                  <input value={capabilityFilter} onChange={e=>setCapabilityFilter(e.target.value)} placeholder="Capability: cotton, FOB, embroidery" className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs" />
                  <input value={regionFilter} onChange={e=>setRegionFilter(e.target.value)} placeholder="Service region / territory" className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs" />
                  <select value={audienceFilter} onChange={e=>setAudienceFilter(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs"><option value="">All audiences</option><option>Men</option><option>Women</option><option>Kids</option><option>Unisex</option></select>
                  <input type="number" min="0" value={minPrice} onChange={e=>setMinPrice(e.target.value)} placeholder="Minimum price" className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs" />
                  <input type="number" min="0" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="Maximum price" className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs" />
                </div>
                <div className="flex gap-2 relative">
                  <div className="flex-1 relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={category}
                      onChange={e => setCategory(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && (setShowDropdown(false), runSearch())}
                      onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                      placeholder="e.g. casual t-shirts — try typing just 'c'"
                      autoComplete="off"
                      className="w-full h-9 pl-8 pr-3 border border-slate-200 rounded-lg text-sm" />

                    {showDropdown && category.trim() && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                        {searchLoading ? (
                          <div className="px-3 py-3 flex items-center gap-2 text-xs text-slate-400">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Searching…
                          </div>
                        ) : results.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-slate-400">No matches for "{category}"</p>
                        ) : (
                          results.slice(0, 8).map(item => {
                            const selected = selectedMap.has(item._id);
                            return (
                              <button key={item._id}
                                onMouseDown={() => { toggleItem(item); setShowDropdown(false); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition ${selected ? "bg-indigo-50" : ""}`}>
                                {item.images?.[0] && (
                                  <img src={item.images[0]} className="w-7 h-7 rounded object-cover shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-800 truncate">{item.item_name}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{item.vendor_name}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {(item.price_range_min || item.price_range_max) && (
                                      <span className="text-[10px] font-bold text-emerald-600">
                                        ₹{item.price_range_min}–₹{item.price_range_max}
                                      </span>
                                    )}
                                    {item.available_sizes?.length > 0 && (
                                      <span className="text-[10px] text-slate-400">
                                        · {item.available_sizes.slice(0, 4).join(", ")}{item.available_sizes.length > 4 ? "…" : ""}
                                      </span>
                                    )}
                                    {item.available_colors?.length > 0 && (
                                      <span className="text-[10px] text-slate-400">
                                        · {item.available_colors.slice(0, 3).join(", ")}{item.available_colors.length > 3 ? "…" : ""}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {selected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                  <select value={businessType} onChange={e => setBusinessType(e.target.value)}
                    className="h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white">
                    {BUSINESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <button onClick={() => { setShowDropdown(false); runSearch(); }}
                    className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold">Search</button>
                </div>

                {/* ⚠️ NEW — persistent selection summary. selectedMap already
                    survived across searches before this (runSearch only
                    ever calls setResults, never touches selectedMap) — the
                    capability existed, but nothing showed it, so picking
                    items from one search, then searching something totally
                    different, LOOKED like it discarded your earlier picks
                    even though it never did. This makes that visible. */}
                {selectedItems.length > 0 && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wide mb-2">
                      {selectedItems.length} selected so far — search again to add more
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedItems.map(item => (
                        <span key={item._id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-white border border-indigo-200 rounded-full text-[11px] font-semibold text-slate-700">
                          {item.item_name} <span className="text-slate-400">· {item.vendor_name}</span>
                          <button onClick={() => toggleItem(item)} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-rose-100 hover:text-rose-600 text-slate-400">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {searchLoading ? (
                  <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
                ) : !searched ? (
                  <p className="text-center text-sm text-slate-400 py-12">Search to see matching items across your approved vendors.</p>
                ) : results.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-12">No matching items found.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                    {results.map(item => {
                      const selected = selectedMap.has(item._id);
                      const highlights = supplierHighlights(item);
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
                              <p className="text-[10px] font-bold text-emerald-600 mt-0.5">
                                ₹{item.price_range_min}–₹{item.price_range_max}
                              </p>
                            )}
                            {highlights.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {highlights.map((highlight) => <span key={highlight} className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-semibold text-teal-700">{highlight}</span>)}
                              </div>
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

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button onClick={() => setStep(1)} disabled={selectedItems.length < 1}
                    className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-40">
                    {selectedItems.length === 0
                      ? "Select an item to continue"
                      : selectedItems.length === 1
                      ? "Continue with this vendor →"
                      : `Continue with ${selectedItems.length} selected →`}
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <button onClick={() => setStep(0)} className="text-xs font-bold text-slate-500 flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back</button>
                <div>
                  <p className="text-xs font-bold text-slate-700">Product quote requirements</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Enter the required specification separately for every selected product.</p>
                </div>
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {selectedItems.map((item, index) => {
                    const form = { ...reqForm, ...(itemRequests[item._id] || {}) };
                    return (
                      <div key={item._id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                        <div className="flex items-center gap-2 mb-3">
                          {item.images?.[0] ? <img src={item.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200" /> : null}
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">{index + 1}. {item.item_name || "Catalogue product"}</p>
                            <p className="text-[11px] text-slate-500 truncate">{item.vendor_name}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                          <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Available sizes</p>
                            <div className="flex flex-wrap gap-1">
                              {item.available_sizes?.length > 0 ? item.available_sizes.map(size => (
                                <button key={size} type="button" onClick={() => updateItemRequest(item._id, "requested_size", size)}
                                  className={`px-2 py-1 rounded-md border text-[10px] font-bold transition ${form.requested_size === size ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300"}`}>
                                  {size}
                                </button>
                              )) : <span className="text-[10px] text-slate-400">Not specified by vendor</span>}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Available colors</p>
                            <div className="flex flex-wrap gap-1">
                              {item.available_colors?.length > 0 ? item.available_colors.map(color => (
                                <button key={color} type="button" onClick={() => updateItemRequest(item._id, "requested_color", color)}
                                  className={`px-2 py-1 rounded-md border text-[10px] font-bold transition ${form.requested_color === color ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300"}`}>
                                  {color}
                                </button>
                              )) : <span className="text-[10px] text-slate-400">Not specified by vendor</span>}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <input list={`quote-sizes-${item._id}`} placeholder="Select or type custom size" value={form.requested_size}
                              onChange={e => updateItemRequest(item._id, "requested_size", e.target.value)}
                              className="w-full h-9 px-2 border border-slate-200 bg-white rounded-lg text-xs" />
                            <datalist id={`quote-sizes-${item._id}`}>
                              {(item.available_sizes || []).map(size => <option key={size} value={size} />)}
                            </datalist>
                          </div>
                          <div>
                            <input list={`quote-colors-${item._id}`} placeholder="Select or type custom color" value={form.requested_color}
                              onChange={e => updateItemRequest(item._id, "requested_color", e.target.value)}
                              className="w-full h-9 px-2 border border-slate-200 bg-white rounded-lg text-xs" />
                            <datalist id={`quote-colors-${item._id}`}>
                              {(item.available_colors || []).map(color => <option key={color} value={color} />)}
                            </datalist>
                          </div>
                          <input type="number" min="1" placeholder="Quantity" value={form.requested_qty} onChange={e => updateItemRequest(item._id, "requested_qty", e.target.value)} className="h-9 px-2 border border-slate-200 bg-white rounded-lg text-xs" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                          <input type="number" min="0" placeholder="Target price (?)" value={form.requested_price} onChange={e => updateItemRequest(item._id, "requested_price", e.target.value)} className="h-9 px-2 border border-slate-200 bg-white rounded-lg text-xs" />
                          <input type="date" title="Response deadline" value={form.response_deadline} onChange={e => updateItemRequest(item._id, "response_deadline", e.target.value)} className="h-9 px-2 border border-slate-200 bg-white rounded-lg text-xs" />
                          <input placeholder="Note to this vendor (optional)" value={form.buyer_note} onChange={e => updateItemRequest(item._id, "buyer_note", e.target.value)} className="h-9 px-2 border border-slate-200 bg-white rounded-lg text-xs" />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button onClick={sendRequest} disabled={sending}
                    className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-60">
                    <Send className="w-3.5 h-3.5" /> {sending ? "Sending…" : selectedItems.length === 1 ? "Send inquiry" : `Send to ${selectedItems.length} vendors`}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button onClick={() => setStep(1)} className="text-xs font-bold text-slate-500 flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back</button>
                  <button onClick={() => fetchComparison()} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Refresh responses
                  </button>
                </div>
                <p className="text-xs text-slate-400">Nothing is ordered yet — this just shows what's come back so far. Come back anytime; vendors respond on their own schedule.</p>

                {rowsLoading ? (
                  <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
                ) : rows.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-12">No responses yet.</p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {groups.map(group => (
                      <div key={group.item_name}>
                        <p className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                          {group.item_name}
                          <span className="font-normal normal-case text-slate-400">— {group.rows.length} quote{group.rows.length !== 1 ? "s" : ""}</span>
                        </p>
                        <div className="space-y-2">
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
                                    <p className="text-xs text-slate-600">₹{vr.confirmed_price} · qty {vr.confirmed_qty} · {vr.confirmed_size}/{vr.confirmed_color}</p>
                                    <button onClick={() => pickWinner(row)} disabled={converting}
                                      className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold disabled:opacity-60">
                                      {converting ? "Selecting…" : "Choose this quote →"}
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
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <button onClick={() => setStep(2)} className="text-xs font-bold text-slate-500 flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back to comparison</button>
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-700 font-semibold">
                  This step creates a real purchase order. Everything before this was non-binding negotiation.
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Vendor</label>
                    <input value={orderVendorName} onChange={e => setOrderVendorName(e.target.value)}
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
                    <button onClick={addItem} className="text-xs font-bold text-indigo-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Add item</button>
                  </div>
                  <div className="space-y-2">
                    {orderItems.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_80px_90px_1fr_28px] gap-2 items-center">
                        <input placeholder="Description" value={it.description} onChange={e => updateItem(idx, "description", e.target.value)} className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
                        <input type="number" placeholder="Qty" value={it.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
                        <input type="number" placeholder="Rate" value={it.rate} onChange={e => updateItem(idx, "rate", e.target.value)} className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
                        <input placeholder="Remarks" value={it.remarks} onChange={e => updateItem(idx, "remarks", e.target.value)} className="h-9 px-2 border border-slate-200 rounded-lg text-xs" />
                        <button onClick={() => removeItem(idx)} disabled={orderItems.length === 1}
                          className="h-9 w-9 flex items-center justify-center text-rose-500 disabled:opacity-30">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button onClick={submitOrder} disabled={submitting}
                    className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold disabled:opacity-60">
                    {submitting ? "Creating order…" : "Create purchase order"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
