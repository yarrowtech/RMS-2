import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../config/api.js";
import {
  BadgeIndianRupee, Check, CheckCircle2, ClipboardPlus, FileText, Loader2,
  PackageCheck, RefreshCw, Send, ShoppingCart, Truck, UsersRound,
} from "lucide-react";

function authHeaders(json = false) {
  const token = localStorage.getItem("vendor_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/vendor-b2b${path}`, {
    ...options,
    headers: { ...authHeaders(Boolean(options.body)), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Request failed");
  return data;
}

const emptyRfq = { supplier_vendor_id: "", title: "", category: "", specification: "", quantity: "", unit: "pcs", target_price: "", deadline: "" };
const emptyQuote = { unit_price: "", currency: "INR", minimum_order_quantity: "", lead_days: "", valid_until: "", note: "" };

const statusTone = {
  Sent: "bg-sky-50 text-sky-700 border-sky-200", Quoted: "bg-violet-50 text-violet-700 border-violet-200",
  Awarded: "bg-emerald-50 text-emerald-700 border-emerald-200", Confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200", Cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  PartiallyReceived: "bg-amber-50 text-amber-700 border-amber-200", Received: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Issued: "bg-violet-50 text-violet-700 border-violet-200",
};

function Status({ value }) {
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${statusTone[value] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{String(value || "Draft").replace(/([a-z])([A-Z])/g, "$1 $2")}</span>;
}

function Field({ label, children, wide = false }) {
  return <label className={`block ${wide ? "sm:col-span-2" : ""}`}><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>{children}</label>;
}

const input = "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100";

function QuoteForm({ onSubmit, saving }) {
  const [form, setForm] = useState(emptyQuote);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
    <p className="mb-3 text-sm font-black text-violet-800">Submit supplier quotation</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Unit price *"><input required type="number" min="0" step="0.01" value={form.unit_price} onChange={e => update("unit_price", e.target.value)} className={input} placeholder="0.00" /></Field>
      <Field label="Currency"><select value={form.currency} onChange={e => update("currency", e.target.value)} className={input}><option>INR</option><option>USD</option><option>EUR</option><option>AED</option></select></Field>
      <Field label="Supplier MOQ"><input type="number" min="0" step="0.01" value={form.minimum_order_quantity} onChange={e => update("minimum_order_quantity", e.target.value)} className={input} placeholder="Optional" /></Field>
      <Field label="Lead time (days)"><input type="number" min="0" value={form.lead_days} onChange={e => update("lead_days", e.target.value)} className={input} placeholder="Optional" /></Field>
      <Field label="Valid until" wide><input type="date" value={form.valid_until} onChange={e => update("valid_until", e.target.value)} className={input} /></Field>
      <Field label="Terms / note" wide><textarea rows="2" value={form.note} onChange={e => update("note", e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-teal-500" placeholder="Payment, dispatch, quality or commercial terms" /></Field>
    </div>
    <button disabled={saving} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"><Send className="h-4 w-4" />{saving ? "Sending…" : "Send quotation"}</button>
  </form>;
}

export default function VendorB2BTrade() {
  const [tab, setTab] = useState("rfqs");
  const [partners, setPartners] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [rfqForm, setRfqForm] = useState(emptyRfq);
  const [receiptForms, setReceiptForms] = useState({});
  const [invoiceForm, setInvoiceForm] = useState({ order_id: "", invoice_no: "", amount: "", due_date: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [partnerData, rfqData, orderData, invoiceData] = await Promise.all([
        request("/partners"), request("/rfqs"), request("/orders"), request("/invoices"),
      ]);
      setPartners(partnerData.data || []); setRfqs(rfqData.data || []); setOrders(orderData.data || []); setInvoices(invoiceData.data || []);
    } catch (err) { setError(err.message || "Could not load B2B trade data."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const run = async (operation, successMessage) => {
    setSaving(true); setError("");
    try { await operation(); setNotice(successMessage); await refresh(); }
    catch (err) { setError(err.message || "Could not complete this action."); }
    finally { setSaving(false); }
  };

  const invoiceableOrders = useMemo(() => orders.filter((order) => order.viewer_role === "selling" && ["Confirmed", "PartiallyReceived", "Received"].includes(order.status)), [orders]);

  const createRfq = (event) => {
    event.preventDefault();
    run(async () => {
      await request("/rfqs", { method: "POST", body: JSON.stringify(rfqForm) });
      setRfqForm(emptyRfq);
    }, "RFQ sent to your connected supplier.");
  };

  const quote = (rfqId, form) => run(() => request(`/rfqs/${rfqId}/quote`, { method: "POST", body: JSON.stringify(form) }), "Quotation sent to the buyer.");
  const award = (rfqId) => run(() => request(`/rfqs/${rfqId}/award`, { method: "POST" }), "Supplier purchase order created.");
  const orderAction = (orderId, action) => run(() => request(`/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ action }) }), `Order ${action === "accept" ? "confirmed" : action === "reject" ? "rejected" : "cancelled"}.`);
  const receive = (orderId) => {
    const form = receiptForms[orderId] || {};
    return run(async () => {
      await request(`/orders/${orderId}/receipts`, { method: "POST", body: JSON.stringify(form) });
      setReceiptForms((current) => ({ ...current, [orderId]: { received_quantity: "", note: "" } }));
    }, "Material receipt recorded in Vendor B2B Trade.");
  };
  const createInvoice = (event) => {
    event.preventDefault();
    if (!invoiceForm.order_id) { setError("Select a confirmed sales order first."); return; }
    run(async () => {
      await request(`/orders/${invoiceForm.order_id}/invoices`, { method: "POST", body: JSON.stringify(invoiceForm) });
      setInvoiceForm({ order_id: "", invoice_no: "", amount: "", due_date: "" });
    }, "B2B sales invoice issued.");
  };

  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-teal-900 p-6 text-white shadow-lg sm:p-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"><ShoppingCart className="h-6 w-6 text-teal-200" /></div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Vendor B2B Trade</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Buy from and sell to accepted Business Network partners. This workspace is separate from retailer purchase orders, GRC and GRN.</p></div><button onClick={refresh} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold hover:bg-white/15 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button></div>
    </section>

    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{[["rfqs", ClipboardPlus, "RFQs & Quotations"], ["orders", PackageCheck, "Purchase & Sales Orders"], ["invoices", FileText, "B2B Invoices"]].map(([key, Icon, label]) => <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === key ? "bg-teal-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}

    {loading ? <div className="grid min-h-72 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div> : tab === "rfqs" ? <>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600"><Send className="h-5 w-5" /></span><div><h2 className="font-black text-slate-900">Create supplier RFQ</h2><p className="mt-1 text-sm text-slate-500">Send a purchase requirement to a connected business. Accept connections first in Business Network.</p></div></div>{partners.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">No accepted B2B connections yet. Open Business Network, connect with a supplier, and wait for acceptance before trading.</div> : <form onSubmit={createRfq} className="grid gap-4 sm:grid-cols-2"><Field label="Supplier partner *"><select required value={rfqForm.supplier_vendor_id} onChange={e => setRfqForm({ ...rfqForm, supplier_vendor_id: e.target.value })} className={input}><option value="">Select accepted business</option>{partners.map(partner => <option value={partner.vendor_id} key={partner.vendor_id}>{partner.name} {partner.brand_name ? `— ${partner.brand_name}` : ""}</option>)}</select></Field><Field label="Product / requirement *"><input required value={rfqForm.title} onChange={e => setRfqForm({ ...rfqForm, title: e.target.value })} className={input} placeholder="e.g. 180 GSM cotton jersey" /></Field><Field label="Category"><input value={rfqForm.category} onChange={e => setRfqForm({ ...rfqForm, category: e.target.value })} className={input} placeholder="Fabric, finished goods, packaging…" /></Field><Field label="Quantity and unit *"><div className="flex gap-2"><input required type="number" min="0.001" step="0.001" value={rfqForm.quantity} onChange={e => setRfqForm({ ...rfqForm, quantity: e.target.value })} className={input} placeholder="Quantity" /><input required value={rfqForm.unit} onChange={e => setRfqForm({ ...rfqForm, unit: e.target.value })} className={`${input} max-w-28`} placeholder="pcs" /></div></Field><Field label="Target unit price"><input type="number" min="0" step="0.01" value={rfqForm.target_price} onChange={e => setRfqForm({ ...rfqForm, target_price: e.target.value })} className={input} placeholder="Optional" /></Field><Field label="Response deadline"><input type="date" value={rfqForm.deadline} onChange={e => setRfqForm({ ...rfqForm, deadline: e.target.value })} className={input} /></Field><Field label="Specifications" wide><textarea rows="3" value={rfqForm.specification} onChange={e => setRfqForm({ ...rfqForm, specification: e.target.value })} className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-teal-500" placeholder="Material, colour, quality, packaging, payment or delivery requirements" /></Field><div className="sm:col-span-2 flex justify-end"><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-600 px-5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"><Send className="h-4 w-4" />{saving ? "Sending…" : "Send RFQ"}</button></div></form>}</section>
      <section className="space-y-4"><h2 className="px-1 text-lg font-black text-slate-900">RFQ activity</h2>{rfqs.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">No B2B RFQs yet.</div> : rfqs.map((rfq) => <article key={rfq._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-900">{rfq.title}</h3><Status value={rfq.status} /></div><p className="mt-1 text-xs font-semibold text-teal-700">{rfq.rfq_no} · {rfq.quantity} {rfq.unit}</p><p className="mt-2 max-w-3xl text-sm text-slate-500">{rfq.specification || "No additional specifications"}</p></div><div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500"><p>Buyer: <b className="text-slate-700">{rfq.buyer?.name}</b></p><p className="mt-1">Supplier: <b className="text-slate-700">{rfq.supplier?.name}</b></p></div></div>{rfq.quote && <div className="mt-4 grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:grid-cols-4"><div><p className="text-[10px] font-black uppercase text-emerald-700">Quoted unit price</p><p className="mt-1 font-black text-emerald-900">{rfq.quote.currency || "INR"} {rfq.quote.unit_price}</p></div><div><p className="text-[10px] font-black uppercase text-emerald-700">MOQ</p><p className="mt-1 font-bold text-emerald-900">{rfq.quote.minimum_order_quantity || "—"}</p></div><div><p className="text-[10px] font-black uppercase text-emerald-700">Lead time</p><p className="mt-1 font-bold text-emerald-900">{rfq.quote.lead_days ? `${rfq.quote.lead_days} days` : "—"}</p></div><div><p className="text-[10px] font-black uppercase text-emerald-700">Supplier terms</p><p className="mt-1 text-sm text-emerald-900">{rfq.quote.note || "—"}</p></div></div>}{rfq.viewer_role === "selling" && rfq.status === "Sent" && <QuoteForm saving={saving} onSubmit={(form) => quote(rfq._id, form)} />}{rfq.viewer_role === "buying" && rfq.status === "Quoted" && <div className="mt-4 flex justify-end"><button disabled={saving} onClick={() => award(rfq._id)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Award & create supplier PO</button></div>}</article>)}</section>
    </> : tab === "orders" ? <section className="space-y-4"><div className="flex items-center justify-between px-1"><div><h2 className="text-lg font-black text-slate-900">Purchase & sales orders</h2><p className="text-sm text-slate-500">The same B2B trade order is visible to both connected businesses.</p></div><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">{orders.length} orders</span></div>{orders.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">Award a quoted RFQ to create the first B2B purchase order.</div> : orders.map((order) => { const form = receiptForms[order._id] || { received_quantity: "", note: "" }; return <article key={order._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-900">{order.title}</h3><Status value={order.status} /></div><p className="mt-1 text-xs font-semibold text-teal-700">{order.order_no} · {order.quantity} {order.unit} · {order.currency} {order.total_amount}</p><p className="mt-2 text-sm text-slate-500">{order.specification || "No additional specifications"}</p></div><div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500"><p>Buyer: <b className="text-slate-700">{order.buyer?.name}</b></p><p className="mt-1">Supplier: <b className="text-slate-700">{order.supplier?.name}</b></p><p className="mt-1">Received: <b className="text-slate-700">{order.received_quantity || 0}/{order.quantity} {order.unit}</b></p></div></div>{order.viewer_role === "selling" && order.status === "Sent" && <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button disabled={saving} onClick={() => orderAction(order._id, "accept")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" />Accept order</button><button disabled={saving} onClick={() => orderAction(order._id, "reject")} className="h-9 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-600 disabled:opacity-50">Reject</button></div>}{order.viewer_role === "buying" && order.status === "Sent" && <div className="mt-4 border-t border-slate-100 pt-4"><button disabled={saving} onClick={() => orderAction(order._id, "cancel")} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 disabled:opacity-50">Cancel order</button></div>}{order.viewer_role === "buying" && ["Confirmed", "PartiallyReceived"].includes(order.status) && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-amber-700" /><p className="text-sm font-black text-amber-900">Buyer material receipt</p></div><div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr_auto]"><input type="number" min="0.001" step="0.001" value={form.received_quantity} onChange={e => setReceiptForms((current) => ({ ...current, [order._id]: { ...form, received_quantity: e.target.value } }))} className={input} placeholder={`Qty (${order.unit})`} /><input value={form.note} onChange={e => setReceiptForms((current) => ({ ...current, [order._id]: { ...form, note: e.target.value } }))} className={input} placeholder="Delivery note / quality remarks" /><button disabled={saving} onClick={() => receive(order._id)} className="h-10 rounded-xl bg-amber-500 px-4 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50">Record receipt</button></div></div>}</article>; })}</section> : <section className="space-y-5"><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><BadgeIndianRupee className="h-5 w-5" /></span><div><h2 className="font-black text-slate-900">Issue B2B sales invoice</h2><p className="mt-1 text-sm text-slate-500">Only the supplier issues this invoice after a B2B order is confirmed. It stays separate from retailer purchase invoices.</p></div></div><form onSubmit={createInvoice} className="grid gap-4 sm:grid-cols-2"><Field label="Confirmed order *" wide><select required value={invoiceForm.order_id} onChange={e => setInvoiceForm({ ...invoiceForm, order_id: e.target.value })} className={input}><option value="">Select B2B sales order</option>{invoiceableOrders.map(order => <option value={order._id} key={order._id}>{order.order_no} — {order.title} ({order.currency} {order.total_amount})</option>)}</select></Field><Field label="Invoice number"><input value={invoiceForm.invoice_no} onChange={e => setInvoiceForm({ ...invoiceForm, invoice_no: e.target.value })} className={input} placeholder="Leave empty to auto-generate" /></Field><Field label="Invoice amount"><input type="number" min="0" step="0.01" value={invoiceForm.amount} onChange={e => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} className={input} placeholder="Order total if blank" /></Field><Field label="Due date" wide><input type="date" value={invoiceForm.due_date} onChange={e => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} className={input} /></Field><div className="sm:col-span-2 flex justify-end"><button disabled={saving || invoiceableOrders.length === 0} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"><FileText className="h-4 w-4" />Issue B2B invoice</button></div></form></div><div className="space-y-3"><h2 className="px-1 text-lg font-black text-slate-900">Issued / received B2B invoices</h2>{invoices.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">No B2B invoices issued yet.</div> : invoices.map(invoice => <article key={invoice._id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><h3 className="font-black text-slate-900">{invoice.invoice_no}</h3><Status value={invoice.status} /></div><p className="mt-1 text-sm text-slate-500">{invoice.title} · Order {invoice.order_no}</p><p className="mt-1 text-xs text-slate-400">Supplier: {invoice.supplier?.name} · Buyer: {invoice.buyer?.name}</p></div><div className="text-left sm:text-right"><p className="text-lg font-black text-slate-900">{invoice.currency} {invoice.amount}</p><p className="text-xs text-slate-400">Due: {invoice.due_date || "Not specified"}</p></div></article>)}</div></section>}
  </div>;
}
