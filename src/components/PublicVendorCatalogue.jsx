import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api.js";
import { ArrowLeft, Building2, CheckCircle2, Mail, MapPin, MessageCircle, Minus, PackageOpen, Pencil, Phone, Plus, RefreshCw, ShoppingBag, Store, Trash2 } from "lucide-react";

const money = (value) => `\u20b9${Number(value || 0).toLocaleString("en-IN")}`;
const cleanPhone = (phone) => String(phone || "").replace(/[^0-9+]/g, "");
const today = () => new Date().toISOString().slice(0, 10);
const getBuyerToken = () => localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
const variantsOf = (value, fallback) => Array.isArray(value) && value.length ? value : [fallback];
const orderMinQty = () => 1;
const availableQty = (item) => { const raw = item?.available_to_order ?? item?.stock; const value = Number(raw); return !Number.isFinite(value) || value <= 0 ? Infinity : value; };
const availableText = (item) => Number.isFinite(availableQty(item)) ? `${Math.floor(availableQty(item))} available` : "Check stock";

function optionKey(itemId, size, color) {
  return `${itemId}::${size || ""}::${color || ""}`;
}

export default function PublicVendorCatalogue() {
  const { vendorId } = useParams();
  const [storefront, setStorefront] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cart, setCart] = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [buyer, setBuyer] = useState({ name: "", phone: "", business: "", email: "" });
  const [note, setNote] = useState("");
  const [commercial, setCommercial] = useState({ gstPct: "", freight: "", discount: "", dueDate: "", paymentTerms: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [isOwnVendor, setIsOwnVendor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch(`${API_BASE_URL}/api/catalogue/public/${vendorId}/storefront`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Catalogue is not available.");
        if (!cancelled) setStorefront(data.data || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Catalogue is not available.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [vendorId]);

  // If the person viewing this public link is logged in as the vendor who
  // owns this catalogue, offer a shortcut back to their own management tab
  // instead of leaving them stuck on the anonymous buyer view.
  useEffect(() => {
    let cancelled = false;
    const vendorToken = localStorage.getItem("vendor_token");
    if (!vendorToken) return;
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/vendors/me`, { headers: { Authorization: `Bearer ${vendorToken}` } });
        const data = await response.json();
        if (!cancelled && response.ok && String(data?._id) === String(vendorId)) setIsOwnVendor(true);
      } catch {
        // Not fatal — the page just stays in anonymous buyer view.
      }
    })();
    return () => { cancelled = true; };
  }, [vendorId]);

  const vendor = storefront?.vendor || {};
  const items = storefront?.items || [];
  const total = useMemo(() => cart.reduce((sum, line) => sum + Number(line.rate || 0) * Number(line.quantity || 0), 0), [cart]);
  const buyerToken = getBuyerToken();
  const isRmsBuyer = Boolean(buyerToken);

  const addToCart = (item, size = "", color = "") => {
    const key = optionKey(item._id, size, color);
    setSuccess("");
    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      const minimum = orderMinQty(item);
      const cap = Math.max(0, availableQty(item));
      if (existing) {
        return current;
      }
      return [...current, {
        key,
        catalogue_item_id: item._id,
        item_name: item.item_name,
        image: item.images?.[0] || "",
        size: size === "Standard" ? "" : size,
        color: color === "Default" ? "" : color,
        quantity: Math.min(cap || minimum, minimum),
        rate: Number(item.price || 0),
        moq: minimum,
        stock: cap,
      }];
    });
  };

  const updateQty = (key, nextQty) => setCart((current) => current.map((line) => {
    if (line.key !== key) return line;
    const minimum = orderMinQty(line);
    const cap = Number(line.stock || 0) || Infinity;
    return { ...line, quantity: Math.max(minimum, Math.min(cap, Number(nextQty) || minimum)) };
  }));
  const removeLine = (key) => setCart((current) => current.filter((line) => line.key !== key));

  const submit = async () => {
    setError(""); setSuccess("");
    if (!cart.length) { setError("Add at least one product to cart."); return; }
    if (!isRmsBuyer && (!buyer.name.trim() || !buyer.phone.trim())) { setError("Enter your name and mobile number."); return; }
    setSubmitting(true);
    try {
      let response;
      if (isRmsBuyer) {
        const payload = {
          orderDate: today(),
          vendorName: vendor.name || "Vendor",
          vendor_id: vendor._id || vendorId,
          vendor_type: "registered",
          direct_purchase: true,
          currency: "INR",
          ownerSite: buyer.business || "RMS buyer",
          freightCharges: Number(commercial.freight) || 0,
          overallDiscount: Number(commercial.discount) || 0,
          overallTaxPct: Number(commercial.gstPct) || 0,
          otherTerms: [commercial.paymentTerms, note].filter(Boolean).join(" | "),
          items: cart.map((line) => ({
            description: line.item_name,
            catalogue_item_id: line.catalogue_item_id,
            size: line.size || "",
            color: line.color || "",
            quantity: Number(line.quantity) || 0,
            originalQty: Number(line.quantity) || 0,
            buyerRequestedQty: Number(line.quantity) || 0,
            rate: Number(line.rate) || 0,
            buyerRequestedRate: Number(line.rate) || 0,
            dueDate: commercial.dueDate || null,
            remarks: "Direct storefront order - fixed listed price.",
          })),
        };
        response = await fetch(`${API_BASE_URL}/purchaseorders/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyerToken}` },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch(`${API_BASE_URL}/api/catalogue/public/${vendorId}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buyer, note, commercial, items: cart }),
        });
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || (isRmsBuyer ? "Could not create purchase order." : "Could not send this catalogue order."));
      setCart([]); setCheckoutOpen(false); setNote(""); setCommercial({ gstPct: "", freight: "", discount: "", dueDate: "", paymentTerms: "" });
      setSuccess(isRmsBuyer ? `Purchase order ${data.order?.orderNo || ""} created and sent to vendor.` : (data.message || "Catalogue order request sent."));
    } catch (err) {
      setError(err.message || "Could not complete this catalogue order.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-950 text-white"><RefreshCw className="h-7 w-7 animate-spin" /></div>;
  if (error && !storefront) return <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-center text-white"><div><PackageOpen className="mx-auto h-10 w-10 text-slate-400" /><h1 className="mt-4 text-2xl font-black">Catalogue unavailable</h1><p className="mt-2 text-sm text-slate-300">{error}</p><Link to="/" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950">Back to RMS</Link></div></div>;

  return <div className="min-h-screen bg-[#071411] text-white">
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#071411]/90 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-100"><ArrowLeft className="h-4 w-4" /> RMS</Link>
        <div className="flex items-center gap-2">
          {isOwnVendor && <Link to="/dashboard/vendor?tab=catalogue" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-emerald-100 ring-1 ring-white/15 hover:bg-white/15"><Pencil className="h-3.5 w-3.5" /> Manage this catalogue</Link>}
          <button onClick={() => setCheckoutOpen(true)} className="relative rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-slate-950 shadow-lg shadow-emerald-900/30"><ShoppingBag className="mr-1.5 inline h-4 w-4" /> Cart {cart.length ? `(${cart.length})` : ""}</button>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-5xl px-4 pb-28 pt-5">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-950 shadow-2xl shadow-black/30">
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-white/15 text-2xl font-black ring-1 ring-white/20">{vendor.name?.slice(0,1)?.toUpperCase() || "V"}</div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">RMS Vendor Catalogue</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{vendor.name}</h1>
              <p className="mt-2 text-sm text-emerald-100">Browse, add to cart, and create an RMS PO if you are logged in as a buyer.</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {vendor.phone && <a href={`tel:${cleanPhone(vendor.phone)}`} className="rounded-2xl bg-white/10 p-3 text-center text-xs font-bold ring-1 ring-white/10"><Phone className="mx-auto mb-1 h-5 w-5" />Call</a>}
            {vendor.phone && <a href={`https://wa.me/${cleanPhone(vendor.phone).replace(/^\+/, "")}`} className="rounded-2xl bg-white/10 p-3 text-center text-xs font-bold ring-1 ring-white/10"><MessageCircle className="mx-auto mb-1 h-5 w-5" />WhatsApp</a>}
            {vendor.email && <a href={`mailto:${vendor.email}`} className="rounded-2xl bg-white/10 p-3 text-center text-xs font-bold ring-1 ring-white/10"><Mail className="mx-auto mb-1 h-5 w-5" />Email</a>}
            {vendor.location && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor.location)}`} className="rounded-2xl bg-white/10 p-3 text-center text-xs font-bold ring-1 ring-white/10"><MapPin className="mx-auto mb-1 h-5 w-5" />Location</a>}
          </div>
        </div>
      </section>

      {success && <div className="mt-5 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 p-4 text-sm font-bold text-emerald-100"><CheckCircle2 className="mr-2 inline h-5 w-5" />{success}</div>}
      {error && <div className="mt-5 rounded-2xl border border-rose-400/40 bg-rose-500/15 p-4 text-sm font-bold text-rose-100">{error}</div>}

      <div className="mt-6 flex items-end justify-between gap-4">
        <div><h2 className="text-2xl font-black">Products</h2><p className="mt-1 text-sm text-slate-300">Fixed-price products available for direct catalogue order or RMS PO.</p></div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-emerald-100">{items.length} live</span>
      </div>

      {items.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => <ProductCard key={item._id} item={item} onAdd={addToCart} />)}
      </div> : <div className="mt-6 rounded-3xl border border-dashed border-white/15 p-10 text-center text-slate-300"><Store className="mx-auto mb-3 h-10 w-10 text-slate-500" />This vendor has no public direct-purchase products right now.</div>}
    </main>

    {cart.length > 0 && <button onClick={() => setCheckoutOpen(true)} className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-emerald-500 px-5 py-4 text-left font-black text-slate-950 shadow-2xl shadow-emerald-950/50"><span>View cart ({cart.length})</span><span>{money(total)}</span></button>}

    {checkoutOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center sm:p-5" onClick={() => setCheckoutOpen(false)}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-slate-950 p-5 text-white shadow-2xl sm:rounded-[2rem]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-2xl font-black">Your cart</h2><button onClick={() => setCheckoutOpen(false)} className="rounded-full bg-white/10 px-3 py-1 text-sm font-black">Close</button></div>
        <div className="mt-4 space-y-3">{cart.map((line) => <div key={line.key} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">{line.image ? <img src={line.image} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="grid h-14 w-14 place-items-center rounded-xl bg-white/10 text-slate-400"><PackageOpen className="h-5 w-5" /></div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{line.item_name}</p><p className="text-xs text-slate-400">{[line.size, line.color].filter(Boolean).join(" / ") || "Standard"} - {money(line.rate)}</p></div><div className="flex items-center gap-2"><button onClick={() => updateQty(line.key, line.quantity - 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><Minus className="h-4 w-4" /></button><span className="w-7 text-center font-black">{line.quantity}</span><button onClick={() => updateQty(line.key, line.quantity + 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><Plus className="h-4 w-4" /></button></div><button onClick={() => removeLine(line.key)} className="text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}</div>
        <div className="mt-5 rounded-2xl bg-white/10 p-4 ring-1 ring-white/10"><div className="flex justify-between text-sm font-bold text-slate-300"><span>Estimated total</span><span className="text-xl font-black text-white">{money(total)}</span></div><p className="mt-2 text-xs leading-5 text-slate-400">{isRmsBuyer ? "You are logged in as an RMS buyer, so this cart will create a real PO and notify the vendor." : "External buyers send an order request first. Login as an RMS buyer to create a PO directly."}</p></div>
        {!isRmsBuyer && <div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={buyer.name} onChange={(e) => setBuyer({...buyer, name: e.target.value})} placeholder="Your name *" className="h-11 rounded-xl border border-white/10 bg-white/10 px-3 text-sm outline-none" /><input value={buyer.phone} onChange={(e) => setBuyer({...buyer, phone: e.target.value})} placeholder="Mobile / WhatsApp *" className="h-11 rounded-xl border border-white/10 bg-white/10 px-3 text-sm outline-none" /><input value={buyer.business} onChange={(e) => setBuyer({...buyer, business: e.target.value})} placeholder="Business name" className="h-11 rounded-xl border border-white/10 bg-white/10 px-3 text-sm outline-none" /><input value={buyer.email} onChange={(e) => setBuyer({...buyer, email: e.target.value})} placeholder="Email optional" className="h-11 rounded-xl border border-white/10 bg-white/10 px-3 text-sm outline-none" /></div>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><input type="number" min="0" value={commercial.freight} onChange={(e) => setCommercial({...commercial, freight: e.target.value})} placeholder="Freight charge" className="h-11 rounded-xl border border-white/10 bg-white/10 px-3 text-sm outline-none" /><input type="number" min="0" value={commercial.discount} onChange={(e) => setCommercial({...commercial, discount: e.target.value})} placeholder="Discount amount" className="h-11 rounded-xl border border-white/10 bg-white/10 px-3 text-sm outline-none" /><input type="number" min="0" value={commercial.gstPct} onChange={(e) => setCommercial({...commercial, gstPct: e.target.value})} placeholder="GST %" className="h-11 rounded-xl border border-white/10 bg-white/10 px-3 text-sm outline-none" /><input type="date" value={commercial.dueDate} onChange={(e) => setCommercial({...commercial, dueDate: e.target.value})} className="h-11 rounded-xl border border-white/10 bg-white/10 px-3 text-sm outline-none" /></div>
        <input value={commercial.paymentTerms} onChange={(e) => setCommercial({...commercial, paymentTerms: e.target.value})} placeholder="Payment terms e.g. 30 days credit / advance" className="mt-3 h-11 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm outline-none" />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes: delivery city, urgent requirement, packing terms..." className="mt-3 min-h-20 w-full rounded-xl border border-white/10 bg-white/10 p-3 text-sm outline-none" />
        <button disabled={submitting || !cart.length} onClick={submit} className="mt-4 w-full rounded-2xl bg-emerald-500 py-4 text-sm font-black text-slate-950 disabled:opacity-50">{submitting ? "Sending..." : (isRmsBuyer ? "Create RMS purchase order" : "Place order request")}</button>
      </div>
    </div>}
  </div>;
}

function ProductCard({ item, onAdd }) {
  const [size, setSize] = useState(variantsOf(item.available_sizes, "Standard")[0]);
  const [color, setColor] = useState(variantsOf(item.available_colors, "Default")[0]);
  const sizes = variantsOf(item.available_sizes, "Standard");
  const colors = variantsOf(item.available_colors, "Default");
  return <article className="overflow-hidden rounded-3xl bg-white text-slate-950 shadow-xl shadow-black/20">
    <div className="aspect-[4/4.5] bg-slate-100">{item.images?.[0] ? <img src={item.images[0]} alt={item.item_name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-300"><PackageOpen className="h-10 w-10" /></div>}</div>
    <div className="p-4">
      <div className="flex items-start justify-between gap-3"><h3 className="text-base font-black leading-tight">{item.item_name}</h3><span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">{money(item.price)}</span></div>
      {item.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.description}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <select value={size} onChange={(e) => setSize(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold"><option value="Standard">Standard size</option>{sizes.filter(s => s !== "Standard").map(s => <option key={s} value={s}>{s}</option>)}</select>
        <select value={color} onChange={(e) => setColor(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold"><option value="Default">Default colour</option>{colors.filter(c => c !== "Default").map(c => <option key={c} value={c}>{c}</option>)}</select>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500"><span>Min 1</span><span>{availableText(item)}</span></div>
      <button onClick={() => onAdd(item, size, color)} className="mt-4 w-full rounded-2xl bg-emerald-500 py-3 text-sm font-black text-slate-950 hover:bg-emerald-400">Add to cart</button>
    </div>
  </article>;
}
