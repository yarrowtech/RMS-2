
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  FaBarcode, FaSearch, FaPlus, FaMinus, FaTrash,
  FaCreditCard, FaTimes, FaPrint, FaSpinner, FaEnvelope,
  FaFileInvoice, FaCheckCircle, FaExclamationTriangle,
  FaQuestionCircle, FaUndo, FaLock, FaWifi, FaClock, FaExchangeAlt, FaCalculator,
} from "react-icons/fa";

import { CASHIER_API_BASE as API_BASE, cashierFetch } from "./cashierApi";
import CashierGuideModal from "./CashierGuideModal";
import { getTerminalId, getTerminalName, setTerminalName } from "./terminalIdentity";

function money(v)  { return `₹${Math.abs(Number(v || 0)).toFixed(2)}`; }
function num(v)    { return Math.abs(Number(v || 0)).toFixed(2); }

// Returns need a reason so HQ can tell a genuine customer return apart
// from a cashier correcting their own mistake. The last four need a
// manager (HQ-scoped admin) to verify their password before the credit
// note can be saved — kept in sync with the backend's
// RETURN_REASONS_NEEDING_APPROVAL in cashier_routes.py.
const RETURN_REASONS = ["Customer Return", "Billing Error", "Wrong Item/Qty", "Price Correction", "Other"];
const REASONS_NEEDING_APPROVAL = new Set(["Billing Error", "Wrong Item/Qty", "Price Correction", "Other"]);

const OFFLINE_BILLS_KEY = "rms_cashier_offline_bills_v1";
const POS_PRODUCT_CACHE_KEY = "rms_cashier_product_cache_v1";

// ─────────────────────────────────────────────────────────────────────────
// Offline storage: IndexedDB backing, localStorage-shaped API.
//
// A store's full product cache (needed for offline scanning/search) can
// run several MB for a large catalogue — one citimart branch alone is
// ~4.5MB of JSON for ~15,500 SKUs, right at the edge of localStorage's
// typical ~5MB-per-origin quota, shared with the offline bills queue and
// everything else this app stores there. A write that silently fails past
// that quota used to mean a device quietly had an incomplete/empty offline
// cache with zero indication to anyone. IndexedDB's practical limit is
// hundreds of MB+, which removes that ceiling.
//
// Every call site in this file expects synchronous read/write (the same
// shape localStorage gave them) — rewriting every caller to be async would
// touch a lot of surface for one storage swap. Instead: an in-memory
// mirror backs every read/write synchronously exactly as before, and each
// write also persists to IndexedDB in the background. On load, memory is
// hydrated from IndexedDB (migrating any pre-existing localStorage data in
// once, then clearing it to free that quota for other app data). If
// IndexedDB itself is unavailable, writes fall back to localStorage so the
// POS keeps working exactly as it did before this change.
const IDB_NAME = "rms_cashier_offline_db";
const IDB_VERSION = 1;
const IDB_STORE = "kv";

let _idbPromise = null;
function openOfflineDb() {
  if (_idbPromise) return _idbPromise;
  _idbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB unavailable")); return; }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
  return _idbPromise;
}

async function idbGet(key) {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB read failed"));
  });
}

async function idbSet(key, value) {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"));
  });
}

let _persistenceListeners = [];
function onPersistenceWarning(cb) {
  _persistenceListeners.push(cb);
  return () => { _persistenceListeners = _persistenceListeners.filter(fn => fn !== cb); };
}
function warnPersistenceFailure(message) {
  _persistenceListeners.forEach(cb => { try { cb(message); } catch {} });
}

let _offlineBillsMemory = [];
let _productCacheMemory = { products: [], cachedAt: "" };
let _heldBillsMemory = [];
const HELD_BILLS_KEY = "rms_cashier_held_bills_v1";

function persistOfflineBills(rows) {
  idbSet(OFFLINE_BILLS_KEY, rows).catch(() => {
    try { localStorage.setItem(OFFLINE_BILLS_KEY, JSON.stringify(rows)); return; } catch {}
    warnPersistenceFailure("Could not save this offline bill to device storage — it only exists in this tab right now. Do not close or reload until it syncs.");
  });
}

function persistHeldBills(rows) {
  idbSet(HELD_BILLS_KEY, rows).catch(() => {
    try { localStorage.setItem(HELD_BILLS_KEY, JSON.stringify(rows)); return; } catch {}
    warnPersistenceFailure("Could not save a held bill to device storage — it only exists in this tab right now.");
  });
}

function readHeldBills() {
  return _heldBillsMemory;
}

function writeHeldBills(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  _heldBillsMemory = safeRows;
  persistHeldBills(safeRows);
}

function persistProductCache(snapshot) {
  idbSet(POS_PRODUCT_CACHE_KEY, snapshot).catch(() => {
    try { localStorage.setItem(POS_PRODUCT_CACHE_KEY, JSON.stringify(snapshot)); return; } catch {}
    warnPersistenceFailure("Could not save the offline product cache to device storage (likely out of space) — offline scanning may be incomplete until this is resolved.");
  });
}

// Resolves once memory has been hydrated from IndexedDB (migrating any
// older localStorage copy in on first run). Components await this once on
// mount so a cold page load never briefly reads an empty cache that's
// actually sitting in IndexedDB from a previous session.
const offlineStorageReady = (async () => {
  try {
    const [billsFromIdb, cacheFromIdb, heldFromIdb] = await Promise.all([idbGet(OFFLINE_BILLS_KEY), idbGet(POS_PRODUCT_CACHE_KEY), idbGet(HELD_BILLS_KEY)]);
    if (Array.isArray(billsFromIdb)) {
      _offlineBillsMemory = billsFromIdb;
    } else {
      let legacy = [];
      try { const raw = localStorage.getItem(OFFLINE_BILLS_KEY); const parsed = raw ? JSON.parse(raw) : []; legacy = Array.isArray(parsed) ? parsed : []; } catch {}
      _offlineBillsMemory = legacy;
      if (legacy.length) persistOfflineBills(legacy);
    }
    if (cacheFromIdb && Array.isArray(cacheFromIdb.products)) {
      _productCacheMemory = cacheFromIdb;
    } else {
      let legacy = { products: [], cachedAt: "" };
      try { const raw = localStorage.getItem(POS_PRODUCT_CACHE_KEY); const parsed = raw ? JSON.parse(raw) : null; if (parsed && Array.isArray(parsed.products)) legacy = parsed; } catch {}
      _productCacheMemory = legacy;
      if (legacy.products.length) persistProductCache(legacy);
    }
    _heldBillsMemory = Array.isArray(heldFromIdb) ? heldFromIdb : [];
    // Free the old localStorage quota now that IndexedDB holds the data.
    try { localStorage.removeItem(OFFLINE_BILLS_KEY); localStorage.removeItem(POS_PRODUCT_CACHE_KEY); } catch {}
  } catch {
    // IndexedDB unavailable entirely — fall back to whatever localStorage has, same as before this change.
    try { const raw = localStorage.getItem(OFFLINE_BILLS_KEY); const parsed = raw ? JSON.parse(raw) : []; _offlineBillsMemory = Array.isArray(parsed) ? parsed : []; } catch {}
    try { const raw = localStorage.getItem(POS_PRODUCT_CACHE_KEY); const parsed = raw ? JSON.parse(raw) : null; _productCacheMemory = parsed && Array.isArray(parsed.products) ? parsed : { products: [], cachedAt: "" }; } catch {}
    try { const raw = localStorage.getItem(HELD_BILLS_KEY); const parsed = raw ? JSON.parse(raw) : []; _heldBillsMemory = Array.isArray(parsed) ? parsed : []; } catch {}
  }
})();

function readOfflineBills() {
  return _offlineBillsMemory;
}

function writeOfflineBills(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  _offlineBillsMemory = safeRows;
  persistOfflineBills(safeRows);
}

function makeOfflineInvoiceNo(isReturn = false) {
  const d = new Date();
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
    String(d.getSeconds()).padStart(2, "0"),
  ].join("");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${isReturn ? "OFF-RET" : "OFF-INV"}-${stamp}-${rand}`;
}

function makeOfflineId() {
  return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// In-progress cart draft — autosaved (debounced) while the cashier is
// still scanning/building a bill, before Finalize or Save offline is
// ever clicked. Without this, a frozen/crashed tab loses the whole
// in-progress bill with nothing recoverable, which is worse than the
// offline-sync case (that one at least has a saved copy).
const DRAFT_CART_KEY = "rms_cashier_draft_cart_v1";

function readDraftCart() {
  try {
    const raw = localStorage.getItem(DRAFT_CART_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeDraftCart(draft) {
  try {
    localStorage.setItem(DRAFT_CART_KEY, JSON.stringify(draft));
  } catch {
    // Draft autosave is a convenience, not critical — never break billing over it.
  }
}

function clearDraftCart() {
  try {
    localStorage.removeItem(DRAFT_CART_KEY);
  } catch {
    // ignore
  }
}


function readProductCache() {
  return _productCacheMemory;
}

function writeProductCache(products, cachedAt = new Date().toISOString()) {
  const safeProducts = Array.isArray(products) ? products : [];
  const snapshot = { products: safeProducts, cachedAt };
  _productCacheMemory = snapshot;
  persistProductCache(snapshot);
}

function mergeProductCache(existingProducts, nextProducts) {
  const byBarcode = new Map();
  [...(existingProducts || []), ...(nextProducts || [])].forEach(product => {
    const bc = String(product?.barcode || "").trim();
    if (bc) byBarcode.set(bc, product);
  });
  return Array.from(byBarcode.values());
}

function findCachedProductByBarcode(products, barcode) {
  const target = String(barcode || "").trim().toLowerCase();
  return (products || []).find(product => String(product?.barcode || "").trim().toLowerCase() === target) || null;
}

function searchCachedProducts(products, query, limit = 20) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  return (products || []).filter(product => {
    const haystack = [product.name, product.barcode, product.sku, product.division, product.section, product.department]
      .map(value => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(q);
  }).slice(0, limit);
}

function paymentSplitTotal(split = {}) {
  return ["Cash", "Card", "UPI"].reduce((sum, key) => sum + Number(split?.[key] || 0), 0);
}

function cleanPaymentSplit(split = {}) {
  return {
    Cash: Number(split.Cash || 0),
    Card: Number(split.Card || 0),
    UPI: Number(split.UPI || 0),
  };
}

function makeWhatsAppBillUrl(mobile, invoiceNo, shareUrl) {
  const digits = String(mobile || "").replace(/\D/g, "").slice(-10);
  const text = encodeURIComponent(`Your RMS invoice ${invoiceNo} is ready: ${shareUrl}`);
  return digits ? `https://wa.me/91${digits}?text=${text}` : "";
}


function numToWords(n) {
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
    "Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  n = Math.round(Math.abs(n));
  if (n === 0) return "Zero";
  if (n < 20)  return a[n];
  if (n < 100) return b[Math.floor(n/10)] + (n%10 ? " " + a[n%10] : "");
  if (n < 1000) return a[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + numToWords(n%100) : "");
  if (n < 100000)  return numToWords(Math.floor(n/1000))  + " Thousand"  + (n%1000   ? " " + numToWords(n%1000)   : "");
  if (n < 10000000) return numToWords(Math.floor(n/100000)) + " Lakh"   + (n%100000  ? " " + numToWords(n%100000)  : "");
  return numToWords(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + numToWords(n%10000000) : "");
}

/* ─── Toast ─── */
function Toast({ message, type = "default" }) {
  if (!message) return null;
  const bg = type === "error" ? "bg-rose-600" : type === "success" ? "bg-emerald-700" : "bg-slate-950";
  return ReactDOM.createPortal(
    <div className={`fixed left-1/2 top-4 z-[99999] -translate-x-1/2 rounded-xl ${bg} px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-xl`}>
      {message}
    </div>,
    document.body
  );
}

/* ─── Invoice Lookup Modal (for return flow) ─── */
function InvoiceLookupModal({ open, onClose, onLoadItems }) {
  const [invoiceNo,  setInvoiceNo]  = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [foundBill,  setFoundBill]  = useState(null);
  const [selected,   setSelected]   = useState({});   // barcode → qty to return
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setInvoiceNo(""); setError(""); setFoundBill(null); setSelected({});
      setTimeout(() => inputRef.current?.focus(), 80);
    }
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const lookupInvoice = async () => {
    const inv = invoiceNo.trim();
    if (!inv) { setError("Enter an invoice number."); return; }
    setLoading(true); setError(""); setFoundBill(null); setSelected({});
    try {
      const res  = await cashierFetch(`${API_BASE}/cashier/bill/${encodeURIComponent(inv)}`);
      const json = await res.json();
      if (!res.ok) { setError(json.detail || "Invoice not found."); return; }
      const bill = json.data;
      if (bill.type === "return") { setError("This is already a return bill — cannot return again."); return; }
      bill.items = bill.items.map(item => ({ ...item, returnableQty: Math.max(0, Number(item.qty) - Number(bill.returned_quantities?.[item.barcode] || 0)) }));
      if (!bill.items.some(item => item.returnableQty > 0)) { setError("All items on this invoice have already been returned."); return; }
      setFoundBill(bill);
      // Default: select all items at their full qty
      const sel = {};
      bill.items.forEach(item => { sel[item.barcode] = item.returnableQty; });
      setSelected(sel);
    } catch { setError("Network error. Check backend."); }
    finally { setLoading(false); }
  };

  const handleConfirm = () => {
    if (!foundBill) return;
    const originalTotal = foundBill.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
    const selectedTotal = foundBill.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(selected[item.barcode] || 0), 0);
    const originalPaid = Number(foundBill.summary?.net_payable || 0);
    const creditValue = Math.min(Math.round(selectedTotal * originalPaid / (originalTotal || 1)), Math.max(0, originalPaid - Number(foundBill.returned_credit || 0)));
    const creditRatio = selectedTotal > 0 ? creditValue / selectedTotal : 0;
    const returnItems = foundBill.items
      .filter(item => (selected[item.barcode] || 0) > 0)
      .map(item => ({
        _id:          item.barcode + "_ret",
        barcode:      item.barcode,
        name:         item.name,
        hsn:          item.hsn,
        sku:          item.sku,
        price:        item.price * creditRatio,
        mrp:          item.mrp || item.price,
        cost_price:   item.cost_price || 0,
        gst:          item.gst,
        itemDiscount: item.itemDiscount || 0,
        stock:        null,
        qty:          -(selected[item.barcode]),           // negative for return
        total:        -(selected[item.barcode] * item.price * creditRatio),
      }));

    if (!returnItems.length) { setError("Select at least one item to return."); return; }
    onLoadItems(returnItems, foundBill.invoice_no);
    onClose();
  };

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600">
              <FaFileInvoice size={16} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-950">Return Against Invoice</h2>
              <p className="text-[11px] font-semibold text-slate-400">Enter original invoice number to load items</p>
            </div>
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-xl bg-slate-100 p-3 hover:bg-slate-200">
            <FaTimes size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Invoice lookup */}
          <div className="flex gap-2 mb-4">
            <input
              ref={inputRef}
              value={invoiceNo}
              onChange={e => setInvoiceNo(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && lookupInvoice()}
              placeholder="e.g. NM/INV/2601/00001"
              className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-rose-400 font-mono"
            />
            <button
              onClick={lookupInvoice}
              disabled={loading || !invoiceNo.trim()}
              className="h-11 px-5 rounded-xl bg-rose-600 text-white text-xs font-black uppercase tracking-widest hover:bg-rose-700 disabled:opacity-40 flex items-center gap-2"
            >
              {loading ? <FaSpinner className="animate-spin" /> : <FaSearch />}
              {loading ? "Looking…" : "Find"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-4">
              <FaExclamationTriangle className="shrink-0" />
              {error}
            </div>
          )}

          {/* Found bill */}
          {foundBill && (
            <div>
              {/* Bill summary strip */}
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 mb-4 flex items-center gap-3">
                <FaCheckCircle className="text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-emerald-800">{foundBill.invoice_no}</p>
                  <p className="text-[11px] text-emerald-600">
                    {foundBill.date} · {foundBill.customer_name || "Walking Customer"} · {foundBill.payment_method}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">Net Paid</p>
                  <p className="text-base font-black text-emerald-800">₹{num(foundBill.summary?.net_payable)}</p>
                </div>
              </div>

              {/* Items to return */}
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Select items & qty to return</p>
              <div className="space-y-2">
                {foundBill.items.map(item => {
                  const selQty = selected[item.barcode] || 0;
                  return (
                    <div key={item.barcode}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selQty > 0 ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50"}`}>
                      {/* Checkbox */}
                      <input type="checkbox"
                        checked={selQty > 0}
                        disabled={!item.returnableQty}
                        onChange={e => setSelected(s => ({ ...s, [item.barcode]: e.target.checked ? item.returnableQty : 0 }))}
                        className="w-4 h-4 accent-rose-600 shrink-0"
                      />
                      {/* Product info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{item.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{item.barcode} · HSN {item.hsn || "—"}</p>
                      </div>
                      {/* Original qty & price */}
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-500">Bought: {item.qty} × ₹{num(item.price)} · Returnable: {item.returnableQty}</p>
                        <p className="text-xs font-bold text-slate-700">= ₹{num(item.qty * item.price)}</p>
                      </div>
                      {/* Return qty selector */}
                      {selQty > 0 && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setSelected(s => ({ ...s, [item.barcode]: Math.max(1, selQty - 1) }))}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600">
                            <FaMinus size={8} />
                          </button>
                          <span className="w-8 text-center text-sm font-black text-rose-600">{selQty}</span>
                          <button
                            onClick={() => setSelected(s => ({ ...s, [item.barcode]: Math.min(item.returnableQty, selQty + 1) }))}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600">
                            <FaPlus size={8} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Return total preview */}
              {Object.values(selected).some(v => v > 0) && (
                <div className="mt-4 rounded-xl bg-rose-600 text-white px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest">Credit note total</span>
                  <span className="text-xl font-black">
                    ₹{num(
                      Math.min(Math.round(foundBill.items.reduce((s, item) => s + (selected[item.barcode] || 0) * item.price, 0) * Number(foundBill.summary?.net_payable || 0) / (foundBill.items.reduce((s, item) => s + item.qty * item.price, 0) || 1)), Math.max(0, Number(foundBill.summary?.net_payable || 0) - Number(foundBill.returned_credit || 0)))
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {foundBill && (
          <div className="border-t border-slate-100 bg-white px-5 py-4">
            <button
              onClick={handleConfirm}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3.5 text-xs font-black uppercase tracking-widest text-white hover:bg-rose-700"
            >
              <FaCheckCircle /> Load Return Items
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ─── POS step-by-step guide ─── */
// Tailwind can't resolve classes built from a template literal (bg-${color}-100)
// at build time — it only generates CSS for class names it can see written out
// in full somewhere in the source. So each step carries its complete, static
// className strings instead of a bare color name.
const POS_GUIDE_STEPS = [
  { icon: FaCheckCircle, badgeClass: "bg-emerald-100 text-emerald-600", title: "Open your shift", text: "Before selling anything, click \"Open shift\" (top right) and enter your starting cash. If a shift is already open, that button reads \"Close shift\" instead." },
  { icon: FaBarcode, badgeClass: "bg-violet-100 text-violet-600", title: "Scan or search a product", text: "Use a barcode scanner, or type a product name/code in the search box. Only items actually received into your store's stock will come up — something a vendor has only listed in their catalogue won't scan as sellable." },
  { icon: FaPlus, badgeClass: "bg-indigo-100 text-indigo-600", title: "Build the bill", text: "Adjust quantity with the +/− buttons, remove a line with the trash icon, and apply a discount if your store allows it." },
  { icon: FaCreditCard, badgeClass: "bg-violet-100 text-violet-600", title: "Generate the bill", text: "Click \"Generate Bill\", choose the payment method, and confirm. Stock is deducted from your store the moment the bill is generated — there's no separate confirm step after." },
  { icon: FaUndo, badgeClass: "bg-rose-100 text-rose-600", title: "Process a return", text: "Switch to \"Return\" mode and look up the original invoice number. Pick which items are coming back, then choose a reason — \"Customer Return\" goes straight through. Any other reason (billing error, wrong item/qty, price correction) needs a manager to verify their password before you can finalize it. Returned stock goes back into your store automatically." },
  { icon: FaLock, badgeClass: "bg-emerald-100 text-emerald-600", title: "Close your shift", text: "At the end of the day, click \"Close shift\" and enter the cash you actually counted. RMS compares it to what it expected — a mismatch is recorded for review, but it will not stop you from closing." },
];

const POS_GUIDE_NOTES = [
  { tone: "info", icon: FaWifi, title: "Before you go offline — do this first", text: "Click \"Offline products\" at least once while you still have internet, so today's stock is cached on this device. Do this at the start of every shift, not just when you notice the connection is already down." },
  { tone: "info", icon: FaWifi, title: "While offline — what you CAN do", text: "Scan/search cached products, build a bill, and click \"Save offline\" instead of Generate Bill. The bill is recorded on this device with a temporary offline invoice number and marked \"Pending offline sync\" — sharing/emailing it is disabled until it syncs." },
  { tone: "caution", icon: FaExclamationTriangle, title: "While offline — what NOT to do", text: "Don't clear this browser's data, switch to a different browser, or hand billing over to a different device until every offline bill shows \"Synced\". Those bills exist ONLY on this device until synced — there is no server copy yet. Also: don't treat an offline sale as final — it's checked for stock conflicts only when it syncs." },
  { tone: "info", icon: FaExclamationTriangle, title: "Getting back online", text: "Syncing now happens automatically the moment this device reconnects — you don't have to click anything. If it doesn't catch up within a minute, use the amber \"Offline X pending\" button to retry manually. Don't log out while that counter is still above zero — you'll get a warning if you try." },
  { tone: "info", icon: FaExclamationTriangle, title: "If you must switch devices before syncing", text: "Use the \"Export backup\" button next to the offline counter to download the unsynced bills as a file first. It's the only way to recover them if this device is reset or its data is cleared before they sync." },
  { tone: "caution", icon: FaExclamationTriangle, title: "Two things RMS will not stop you from doing", text: "It does not block a sale that goes beyond what's actually in stock, and there's no automatic discount limit. Keep an eye on the shelf, and follow your store's discount policy yourself — the system trusts the cashier here." },
  { tone: "info", icon: FaExclamationTriangle, title: "If the screen freezes mid-bill", text: "An in-progress cart autosaves every second or so. If the tab has to be reloaded, an amber banner offers to restore the last unsaved cart — check it before re-scanning everything from scratch." },
  { tone: "info", icon: FaCalculator, title: "Keyboard shortcuts — the one rule first", text: "Every shortcut below only works when you are NOT typing in a text field — click or tap anywhere outside an input first (or press Esc to close whatever's open), then use the key. This is deliberate: it stops a shortcut from firing by accident while you're typing a customer name or a discount value." },
  { tone: "info", icon: FaSearch, title: "F2 / F3 — product and customer", text: "F2 focuses product search. F3 opens customer details for the current bill." },
  { tone: "info", icon: FaPrint, title: "F4 / F8 — receipts and payment", text: "F4 searches saved bills to reprint. F8 opens the payment window for the current cart." },
  { tone: "info", icon: FaClock, title: "F5 — Drawer Summary", text: "Shows opening cash, today's Cash/Card/UPI totals so far, and the expected cash in the drawer right now — without closing your shift. Type in what you've actually counted to see any mismatch instantly; that number is only shown to you, it is never saved. The real recorded reconciliation still only happens when you actually close the shift." },
  { tone: "info", icon: FaLock, title: "F6 — rename this terminal", text: "Opens the \"Name this terminal\" box so you can rename this specific machine (e.g. if it's replaced or moved to a different counter). This name is stored on this device only, separate from your login, and is what Reports uses to tell POS machines apart." },
  { tone: "info", icon: FaUndo, title: "F7 — start a return", text: "Switches to Return mode and opens invoice lookup in one step, so you can search the original bill and pick a return reason immediately. If you're already in Return mode, F7 just reopens the lookup." },
  { tone: "info", icon: FaCalculator, title: "Alt+D — percentage or flat-amount discount", text: "Opens the discount field. Use the switch beside it to select percentage or amount." },
  { tone: "caution", icon: FaPrint, title: "Alt+I — save and print in one step", text: "Does exactly what \"Finalize Bill\" does, but skips the extra click on \"Print Receipt\" afterward — the receipt prints the instant it's saved. The normal Finalize button still only saves, so nothing changes unless you actually use this shortcut." },
  { tone: "info", icon: FaClock, title: "Ctrl+7 / Ctrl+8 — hold and recall", text: "Ctrl+7 holds the current cart and clears the screen for the next customer, same as the \"Hold\" button. Ctrl+8 opens the Held Bills list — if more than one is held, a filter box appears so you can find the right one by the name/label you gave it." },
];

// Large-button on-screen numpad for a touchscreen POS that also has a
// physical keyboard attached — the OS already pops its own numeric pad on
// tap for `type="number"` inputs, so this isn't needed everywhere, only on
// the couple of fields a cashier taps most often mid-sale (paid amount,
// discount %), where a bigger dedicated keypad beats reaching for the
// device's own on-screen keyboard every time.
function TouchKeyboard({ target, onClose }) {
  const [shift, setShift] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [symbols, setSymbols] = useState(false);
  const uppercase = shift !== capsLock;
  const rows = symbols ? ["1234567890", "!@#$%&*()", "-_+=/\\:;", "?,.'\"[]{}", "<>^|~`"] : ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
  const press = (key) => {
    if (!target || !target.isConnected || target.disabled || target.readOnly) return;
    if (key === "Enter") {
      target.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
      return;
    }
    const value = target.value || "";
    let start = value.length, end = value.length;
    try { start = target.selectionStart ?? value.length; end = target.selectionEnd ?? start; } catch { /* number inputs do not expose a selection */ }
    let next, cursor;
    if (key === "Backspace") {
      const from = start === end ? Math.max(0, start - 1) : start;
      next = value.slice(0, from) + value.slice(end); cursor = from;
    } else {
      const char = key === "Space" ? " " : uppercase ? key.toUpperCase() : key;
      next = value.slice(0, start) + char + value.slice(end); cursor = start + char.length;
    }
    const proto = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(target, next);
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.focus({ preventScroll: true });
    try { target.setSelectionRange(cursor, cursor); } catch { /* number inputs */ }
    if (shift && key !== "Backspace") setShift(false);
  };
  return ReactDOM.createPortal(
    <div role="group" aria-label="On-screen keyboard" onPointerDown={e => e.preventDefault()} className="fixed inset-x-0 bottom-0 z-[12000] mx-auto w-full max-w-4xl rounded-t-2xl border border-slate-300 bg-slate-200 p-2 shadow-2xl sm:p-3">
      <div className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-slate-700"><span>Touch keyboard</span><button type="button" onClick={onClose} className="rounded-lg bg-slate-700 px-3 py-1.5 text-white">Close</button></div>
      <div className="space-y-1.5">{rows.map(row => <div key={row} className="flex justify-center gap-1">{Array.from(row).map(key => <button type="button" key={key} onClick={() => press(key)} className="h-10 min-w-0 flex-1 rounded-lg bg-white text-base font-bold text-slate-900 shadow-sm active:bg-violet-200 sm:h-12">{uppercase ? key.toUpperCase() : key}</button>)}</div>)}
        <div className="flex gap-1"><button type="button" onClick={() => setCapsLock(v => !v)} aria-pressed={capsLock} className={`h-10 rounded-lg px-2 text-xs font-bold sm:h-12 sm:px-3 ${capsLock ? 'bg-violet-600 text-white' : 'bg-white text-slate-900'}`}>Caps Lock</button><button type="button" onClick={() => setShift(v => !v)} aria-pressed={shift} className={`h-10 rounded-lg px-2 text-xs font-bold sm:h-12 sm:px-3 ${shift ? 'bg-violet-600 text-white' : 'bg-white text-slate-900'}`}>Shift</button><button type="button" onClick={() => setSymbols(v => !v)} className="h-10 rounded-lg bg-white px-2 text-xs font-bold sm:h-12 sm:px-3">{symbols ? 'ABC' : '?123'}</button>{["-", "/", "@", "."].map(key => <button type="button" key={key} onClick={() => press(key)} className="h-10 flex-1 rounded-lg bg-white font-bold sm:h-12">{key}</button>)}<button type="button" onClick={() => press("Space")} className="h-10 flex-[4] rounded-lg bg-white font-bold sm:h-12">Space</button><button type="button" onClick={() => press("Backspace")} className="h-10 rounded-lg bg-white px-3 font-bold sm:h-12">⌫</button><button type="button" onClick={() => press("Enter")} className="h-10 rounded-lg bg-violet-600 px-3 font-bold text-white sm:h-12">Enter</button></div>
      </div>
    </div>, document.body
  );
}

function TouchNumpad({ value, onChange, onClose }) {
  const append = (ch) => {
    const str = String(value ?? "");
    if (ch === "." && str.includes(".")) return;
    onChange(str + ch);
  };
  const backspace = () => onChange(String(value ?? "").slice(0, -1));
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"];
  return (
    <div onMouseDown={e => e.stopPropagation()}
      className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
      <div className="grid grid-cols-3 gap-2">
        {keys.map(k => (
          <button key={k} type="button" onClick={() => (k === "⌫" ? backspace() : append(k))}
            className="rounded-xl border border-slate-200 bg-slate-50 py-3 text-base font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200">
            {k}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onChange("")} className="rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-xs font-black uppercase text-rose-600 hover:bg-rose-100">Clear</button>
        <button type="button" onClick={onClose} className="rounded-xl bg-emerald-600 py-2.5 text-xs font-black uppercase text-white hover:bg-emerald-700">Done</button>
      </div>
    </div>
  );
}

/* ─── Generate Bill Popup ─── */

function ManualOfflineItemModal({ open, barcode, onClose, onAdd }) {
  const [form, setForm] = useState({ barcode: "", name: "", price: "", gst: "0", qty: "1" });

  useEffect(() => {
    if (!open) return;
    setForm({ barcode: barcode || "", name: "", price: "", gst: "0", qty: "1" });
  }, [open, barcode]);

  if (!open) return null;

  const submit = () => {
    const cleanBarcode = String(form.barcode || "").trim();
    const name = String(form.name || "").trim();
    const price = Number(form.price || 0);
    const gst = Number(form.gst || 0);
    const qty = Math.max(1, Number(form.qty || 1));
    if (!cleanBarcode) return alert("Barcode is required for offline sync.");
    if (!name) return alert("Product name is required.");
    if (!price || price <= 0) return alert("Enter valid selling price.");

    onAdd({
      _id: `manual-offline-${cleanBarcode}-${Date.now()}`,
      name,
      barcode: cleanBarcode,
      hsn: "",
      price,
      mrp: price,
      cost_price: 0,
      gst,
      itemDiscount: 0,
      sku: "MANUAL-OFFLINE",
      division: "Manual Offline",
      section: "POS",
      department: "Emergency Billing",
      unit: "pcs",
      stock: null,
      has_variants: false,
      manual_offline: true,
      qty,
      total: qty * price,
    });
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-3">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">No internet / not in cache</p>
            <h2 className="text-lg font-black text-slate-950">Add manual offline item</h2>
          </div>
          <button onClick={onClose} className="rounded-xl bg-slate-100 p-3 hover:bg-slate-200"><FaTimes size={13} /></button>
        </div>
        <div className="space-y-3 p-5">
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
            Use this only when the product was not cached. It will sync as a normal bill later; stock may need review if barcode is not found on server.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Barcode</span>
              <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-amber-500" />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Product name</span>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cotton T-shirt" className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-amber-500" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Qty</span>
              <input type="number" min="1" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-amber-500" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Price</span>
              <input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-amber-500" />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">GST %</span>
              <input type="number" min="0" value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-amber-500" />
            </label>
          </div>
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <button onClick={onClose} className="rounded-2xl border border-slate-200 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={submit} className="rounded-2xl bg-amber-600 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-amber-700">Add to bill</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const GenerateBillPopup = React.forwardRef(function GenerateBillPopup({ open, isReturn, items, bill, setBill, summary, onClose, onFinalize, onSaveOffline, saving, originalInvoice, exchangeCredit }, ref) {
  const discountInputRef = useRef(null);
  const [paid, setPaid] = useState("");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [split, setSplit] = useState({ Cash: "", Card: "", UPI: "" });

  const [returnReason, setReturnReason] = useState("");
  const [managerUser, setManagerUser] = useState("");
  const [managerPass, setManagerPass] = useState("");
  const [managerVerifying, setManagerVerifying] = useState(false);
  const [managerError, setManagerError] = useState("");
  const [managerVerifiedName, setManagerVerifiedName] = useState("");
  const [numpadField, setNumpadField] = useState(null); // "paid" | "discount" | null

  const needsApproval = isReturn && REASONS_NEEDING_APPROVAL.has(returnReason);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "auto";
    if (!open) {
      setPaid("");
      setSplitEnabled(false);
      setSplit({ Cash: "", Card: "", UPI: "" });
      setReturnReason("");
      setManagerUser("");
      setManagerPass("");
      setManagerError("");
      setManagerVerifiedName("");
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [open]);

  // Switching to a reason that no longer needs approval (or back to one
  // that does) clears any prior verification — approval is tied to the
  // specific reason selected, not left dangling from an earlier choice.
  useEffect(() => { setManagerVerifiedName(""); setManagerError(""); }, [returnReason]);

  const verifyManager = async () => {
    if (!managerUser.trim() || !managerPass) {
      setManagerError("Enter the manager's username and password.");
      return;
    }
    setManagerVerifying(true);
    setManagerError("");
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/verify-manager`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: managerUser.trim(), password: managerPass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Verification failed");
      setManagerVerifiedName(data.manager_name || managerUser.trim());
      setManagerPass("");
    } catch (e) {
      setManagerError(e.message || "Verification failed");
    } finally {
      setManagerVerifying(false);
    }
  };

  const payable = Math.abs(summary.netPayable);
  // Exchange: a prior return's credit can cover part or all of what's
  // actually owed on THIS cart — the cashier only needs to collect
  // whatever's left after it, and if the credit is worth more than this
  // purchase, the difference is a cash refund due back right now rather
  // than something to keep collecting payment against.
  const creditApplied = !isReturn && exchangeCredit ? Math.min(exchangeCredit.amount, payable) : 0;
  const payableAfterCredit = Math.max(0, payable - creditApplied);
  const refundDueNow = !isReturn && exchangeCredit ? Math.max(0, exchangeCredit.amount - payable) : 0;
  const splitClean = cleanPaymentSplit(split);
  const paidTotal = splitEnabled ? paymentSplitTotal(splitClean) : Number(paid || (bill.paymentMethod === "Cash" ? 0 : payableAfterCredit));
  const change  = paidTotal > payableAfterCredit ? paidTotal - payableAfterCredit : 0;
  const selectedPaymentMethod = isReturn ? "Credit Note" : splitEnabled ? "Split" : bill.paymentMethod;
  const validateCash = () => {
    if (isReturn) return true;
    if (exchangeCredit && payable + 0.009 < Number(exchangeCredit.amount)) {
      alert(`Add ${money(Number(exchangeCredit.amount) - payable)} more to use this credit note.`);
      return false;
    }
    if (payableAfterCredit <= 0) return true;
    if (splitEnabled) {
      if (paidTotal < payableAfterCredit) {
        alert(`Split payment is short by ?${(payableAfterCredit - paidTotal).toFixed(2)}`);
        return false;
      }
      return true;
    }
    if (bill.paymentMethod === "Cash" && (!paid || Number(paid) < payableAfterCredit)) {
      alert("Insufficient paid amount");
      return false;
    }
    return true;
  };

  const doFinalize = (autoPrint = false) => {
    if (saving || !items.length) return false;
    const discountValue = Number(bill.discount || 0);
    const offerValue = Number(bill.appliedOffer || 0);
    if (!Number.isFinite(discountValue) || discountValue < 0 || (bill.discountType !== 'amount' && discountValue > 100) || !Number.isFinite(offerValue) || offerValue < 0 || summary.totalSavings > summary.totalSale + 0.001) {
      alert("Enter a valid discount that does not exceed the bill total."); return false;
    }
    if (isReturn && (discountValue || offerValue)) { alert("Credit notes use the original bill's discounts. Remove the additional discount."); return false; }
    if (!validateCash()) return false;
    if (isReturn && !returnReason) { setManagerError("Select a reason for this return first."); return false; }
    if (needsApproval && !managerVerifiedName) { setManagerError("Manager approval is required before this return can be saved."); return false; }
    onFinalize(paidTotal, change, selectedPaymentMethod, splitEnabled ? splitClean : {}, returnReason, managerVerifiedName, autoPrint);
    return true;
  };

  // Alt+I ("save and print") is a global keyboard shortcut handled by the
  // parent screen, but the payment/split/return-reason state it needs to
  // validate against only exists inside this popup — exposing just this
  // one action avoids lifting all of that state up.
  React.useImperativeHandle(ref, () => ({
    finalizeWithPrint: () => { if (open) doFinalize(true); },
    focusDiscount: () => discountInputRef.current?.focus(),
  }), [open, paidTotal, change, selectedPaymentMethod, splitClean, returnReason, managerVerifiedName, isReturn, needsApproval, payable, exchangeCredit, saving]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-3">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">{isReturn ? "Generate Credit Note" : "Generate Bill"}</h2>
            {isReturn && originalInvoice && (
              <p className="text-xs font-semibold text-rose-500 mt-0.5">Against Invoice: {originalInvoice}</p>
            )}
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-xl bg-slate-100 p-3 hover:bg-slate-200"><FaTimes size={13} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className={`relative mb-6 overflow-hidden rounded-3xl p-6 text-white shadow-lg ${isReturn ? "bg-gradient-to-br from-rose-600 to-rose-700" : "bg-gradient-to-br from-violet-600 to-violet-700"}`}>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">{isReturn ? "Credit Note Total" : "Net Payable Amount"}</p>
              <h1 className="mt-2 text-5xl font-black tracking-tight">{money(summary.netPayable)}</h1>
            </div>
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Customer details */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-black">Customer Details</h3>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700">Digital bill ready</span>
              </div>
              <p className="mb-3 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] font-bold text-sky-800">
                Add email to send the invoice automatically after saving. Mobile is kept for WhatsApp/SMS sharing when credentials are connected.
              </p>
              <div className="space-y-3">
                {[
                  { label: "Cashier Name",  key: "cashierName" },
                  { label: "Salesman Code (optional)", key: "salesmanCode" },
                  { label: "Customer Name", key: "customerName" },
                  { label: "Mobile Number", key: "mobile" },
                  { label: "Email for invoice", key: "customerEmail", type: "email" },
                ].map(({ label, key }) => (
                  <div key={key} className="space-y-1">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-black">{label}</label>
                    <input type={key === "customerEmail" ? "email" : "text"} value={bill[key]} onChange={e => setBill({ ...bill, [key]: e.target.value })}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-violet-500" />
                  </div>
                ))}
              </div>
            </div>

            {/* Offer & Discount */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-black">Offer & Discount</h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-black">Offer Code / Amt</label>
                  <div className="flex gap-2">
                    <input type="text" value={bill.offer} onChange={e => setBill({ ...bill, offer: e.target.value })}
                      className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-violet-500" />
                    <button onClick={() => { const val = Number(bill.offer); if (isNaN(val)) return alert("Invalid"); setBill({ ...bill, appliedOffer: val }); }}
                      className="h-11 rounded-xl bg-violet-600 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-violet-700">Apply</button>
                  </div>
                </div>
                <div className="relative space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-black">
                      Additional Disc. ({bill.discountType === "amount" ? "₹" : "%"})
                    </label>
                    <button type="button" onClick={() => setBill({ ...bill, discountType: bill.discountType === "amount" ? "percent" : "amount" })}
                      className="text-[10px] font-black uppercase tracking-widest text-violet-600 hover:text-violet-800">
                      Switch to {bill.discountType === "amount" ? "%" : "₹"}
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <input ref={discountInputRef} type="number" value={bill.discount} onFocus={() => setNumpadField("discount")} onChange={e => setBill({ ...bill, discount: e.target.value })}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-violet-500" />
                    <button type="button" onClick={() => setNumpadField(f => f === "discount" ? null : "discount")}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100" title="Touch keypad">
                      <FaCalculator size={14} />
                    </button>
                  </div>
                  {numpadField === "discount" && (
                    <TouchNumpad value={bill.discount} onChange={v => setBill({ ...bill, discount: v })} onClose={() => setNumpadField(null)} />
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-black">Promotion name (optional)</label>
                    <input type="text" value={bill.promotionName} onChange={e => setBill({ ...bill, promotionName: e.target.value })} placeholder="e.g. Winter Sale"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-violet-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-black">Promotion type</label>
                    <select value={bill.promotionType} onChange={e => setBill({ ...bill, promotionType: e.target.value })}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-violet-500">
                      <option value="">Not specified</option><option value="discount">Discount</option><option value="coupon">Coupon</option><option value="bundle">Bundle</option><option value="seasonal">Seasonal</option><option value="clearance">Clearance</option><option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* GST Breakdown */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-black">GST Breakdown</h3>
                <span className="text-[10px] font-black uppercase text-slate-400">Total Tax: {money(summary.totalGstAmount)}</span>
              </div>
              <div className="flex flex-wrap gap-4">
                {Array.from(new Set(items.map(i => Number(i.gst || 0)))).sort().map(rate => {
                  const inBracket = items.filter(i => Number(i.gst || 0) === rate);
                  const saleInBkt = inBracket.reduce((s, i) => s + Math.abs(i.total), 0);
                  const share     = summary.totalSale > 0 ? saleInBkt / summary.totalSale : 0;
                  const taxable   = summary.taxableAmount * share;
                  const gstInBkt  = (taxable * rate) / 100;
                  return (
                    <div key={rate} className="min-w-[240px] flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><FaCreditCard size={13} /></div>
                          <div>
                            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Bracket</span>
                            <span className="text-sm font-black text-violet-600">GST {rate}%</span>
                          </div>
                        </div>
                        <span className="text-lg font-black text-slate-950">{money(gstInBkt)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[["CGST", rate/2, gstInBkt/2], ["SGST", rate/2, gstInBkt/2], ["IGST", 0, 0]].map(([label, pct, amt]) => (
                          <div key={label} className="rounded-xl bg-slate-50 p-2">
                            <p className="text-[9px] font-black uppercase text-slate-400">{label} ({pct}%)</p>
                            <p className="text-xs font-black text-slate-900">{money(amt)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && <div className="py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-300 w-full">No products added</div>}
              </div>
            </div>

            {/* Return reason + manager approval */}
            {isReturn && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
                <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-rose-700">Reason for return</h3>
                <select
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  className="h-11 w-full rounded-xl border border-rose-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-rose-500"
                >
                  <option value="">Select a reason…</option>
                  {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                {needsApproval && (
                  managerVerifiedName ? (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-black text-emerald-700">
                      <FaCheckCircle /> Approved by {managerVerifiedName}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                      <p className="mb-2 flex items-center gap-2 text-xs font-black text-amber-800">
                        <FaLock size={11} /> Manager approval required for this reason
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text" placeholder="Manager username"
                          value={managerUser} onChange={e => setManagerUser(e.target.value)}
                          className="h-10 rounded-lg border border-amber-200 bg-white px-3 text-xs font-bold outline-none focus:border-amber-500"
                        />
                        <input
                          type="password" placeholder="Manager password"
                          value={managerPass} onChange={e => setManagerPass(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && verifyManager()}
                          className="h-10 rounded-lg border border-amber-200 bg-white px-3 text-xs font-bold outline-none focus:border-amber-500"
                        />
                      </div>
                      {managerError && <p className="mt-2 text-xs font-bold text-rose-600">{managerError}</p>}
                      <button
                        type="button" onClick={verifyManager} disabled={managerVerifying}
                        className="mt-2 w-full rounded-lg bg-amber-600 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-amber-700 disabled:opacity-60"
                      >
                        {managerVerifying ? "Verifying…" : "Verify manager"}
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Payment method */}
            {!isReturn && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-black">
                {isReturn ? "Refund Method" : "Payment Method"}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {["Cash", "Card", "UPI"].map(m => (
                  <button key={m} onClick={() => setBill({ ...bill, paymentMethod: m })}
                    className={`cursor-pointer rounded-xl border py-3 text-xs font-black uppercase tracking-widest ${bill.paymentMethod === m ? (isReturn ? "border-rose-600 bg-rose-600 text-white" : "border-violet-600 bg-violet-600 text-white") : "border-slate-200 bg-white text-black hover:bg-slate-100"}`}>
                    {m}
                  </button>
                ))}
              </div>
              {bill.paymentMethod === "Cash" && !isReturn && (
                <div className="relative mt-3 space-y-1">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-black">Customer Paid</label>
                  <div className="flex gap-1.5">
                    <input type="number" value={paid} onFocus={() => setNumpadField("paid")} onChange={e => setPaid(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-violet-500" />
                    <button type="button" onClick={() => setNumpadField(f => f === "paid" ? null : "paid")}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100" title="Touch keypad">
                      <FaCalculator size={14} />
                    </button>
                  </div>
                  {numpadField === "paid" && (
                    <TouchNumpad value={paid} onChange={setPaid} onClose={() => setNumpadField(null)} />
                  )}
                  {change > 0 && <p className="mt-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-600">Change Return: ₹{change.toFixed(2)}</p>}
                </div>
              )}
            </div>}

            {/* Bill summary */}
            <div className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-violet-600">Bill Summary</h3>
              <div className="space-y-2.5 text-sm font-bold text-slate-600">
                {[
                  ["Items",                      items.length,                                                "slate"],
                  ["Total Sale",                 money(summary.totalSale),                                   "slate"],
                  ["Offer",                      `- ${money(bill.appliedOffer || 0)}`,                       "emerald"],
                  [`Discount (${bill.discountType === "amount" ? money(bill.discount||0) : `${bill.discount||0}%`})`, `- ${money(summary.totalSavings - (bill.appliedOffer||0))}`, "emerald"],
                  ["CGST",                       money(summary.cgstAmount),                                  "slate"],
                  ["SGST",                       money(summary.sgstAmount),                                  "slate"],
                  ["Total Tax",                  money(summary.totalGstAmount),                              "slate"],
                  ["Round Off",                  money(summary.roundOff),                                    "gray"],
                ].map(([label, val, tone]) => (
                  <div key={label} className={`flex justify-between ${tone === "emerald" ? "text-emerald-600" : tone === "gray" ? "text-slate-400 text-[11px]" : ""}`}>
                    <span className="font-medium">{label}</span><span>{val}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-black text-slate-950">
                  <span className="uppercase">{isReturn ? "Credit Note Total" : "Net Payable"}</span>
                  <span>{money(summary.netPayable)}</span>
                </div>
                {creditApplied > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span className="font-medium">Exchange credit applied</span><span>- {money(creditApplied)}</span>
                  </div>
                )}
                {!isReturn && exchangeCredit && (
                  <div className="flex justify-between border-t border-dashed border-slate-200 pt-2 text-base font-black text-slate-950">
                    <span className="uppercase">Amount due now</span>
                    <span>{money(payableAfterCredit)}</span>
                  </div>
                )}
                {refundDueNow > 0 && (
                  <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                    Add {money(refundDueNow)} more to use this credit note.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-[0.75fr_1.25fr]">
            {!isReturn && !exchangeCredit && (
              <button
                type="button"
                onClick={() => {
                  if (!validateCash()) return;
                  onSaveOffline?.(paidTotal, change, "Saved manually by cashier", selectedPaymentMethod, splitEnabled ? splitClean : {});
                }}
                disabled={saving}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 py-4 text-xs font-black uppercase tracking-widest text-amber-700 hover:bg-amber-100 disabled:opacity-60"
              >
                <FaExclamationTriangle /> Save offline
              </button>
            )}
            <button onClick={() => doFinalize(false)} disabled={saving || (isReturn && (!returnReason || (needsApproval && !managerVerifiedName)))}
              className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60 ${isReturn ? "bg-rose-600 sm:col-span-2" : "bg-violet-600"}`}>
              {saving ? <FaSpinner className="animate-spin" /> : <FaPrint />}
              {saving ? "Saving..." : isReturn ? "Finalize Credit Note" : "Finalize Bill"}
            </button>
          </div>
          {!isReturn && (
            <p className="mt-3 text-center text-[11px] font-semibold text-slate-400">
              Offline bills print with a temporary invoice and sync later when internet/backend is back.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
});

/* ─── Receipt Modal ─── */
function ReceiptModal({ open, receipt, onClose, onStartExchange, autoPrint, onAutoPrinted }) {
  const [shareInfo, setShareInfo] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [emailing, setEmailing] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = event => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setShareInfo(null);
  }, [open]);

  // Alt+I ("save and print") finalizes the bill and should immediately
  // print it without the cashier having to click "Print Receipt"
  // themselves — this fires once, right when the receipt opens, only if
  // the finalize call that got us here asked for it.
  useEffect(() => {
    if (!open || !receipt || !autoPrint) return;
    handlePrint();
    onAutoPrinted?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, receipt, autoPrint]);

  if (!open || !receipt) return null;
  const isReturn = receipt.isReturn;
  const s = receipt.summary;
  const splitRows = Object.entries(receipt.paymentSplit || {}).filter(([, value]) => Number(value || 0) > 0);

  const sendReceiptEmail = async () => {
    if (receipt.offline) return alert("Sync this offline bill before emailing it.");
    const email = (receipt.customerEmail || window.prompt("Customer email address", "") || "").trim();
    if (!email) return;
    setEmailing(true);
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/bill/${encodeURIComponent(receipt.invoiceNo)}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Email failed");
      alert(`Invoice emailed to ${json.email || email}`);
    } catch (e) {
      alert(e.message || "Could not email invoice right now.");
    } finally {
      setEmailing(false);
    }
  };

  const prepareShare = async () => {
    const fallbackUrl = receipt.shareUrl || "";
    if (receipt.offline) {
      if (fallbackUrl && navigator.clipboard) await navigator.clipboard.writeText(fallbackUrl);
      setShareInfo({ share_url: fallbackUrl, whatsapp_url: makeWhatsAppBillUrl(receipt.mobile, receipt.invoiceNo, fallbackUrl) });
      return;
    }
    setSharing(true);
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/bill/${encodeURIComponent(receipt.invoiceNo)}/share`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Share link failed");
      setShareInfo(json);
      if (json.share_url && navigator.clipboard) await navigator.clipboard.writeText(json.share_url);
    } catch {
      if (fallbackUrl) {
        setShareInfo({ share_url: fallbackUrl, whatsapp_url: makeWhatsAppBillUrl(receipt.mobile, receipt.invoiceNo, fallbackUrl) });
      } else {
        alert("Could not prepare bill link right now.");
      }
    } finally {
      setSharing(false);
    }
  };

  const handlePrint = () => {
    const totalSale = receipt.items.reduce((a, i) => a + Math.abs(i.total), 0);
    const rates = Array.from(new Set(receipt.items.map(i => Number(i.gst || 0)))).sort((a, b) => a - b);

    const gstRows = rates.map(rate => {
      const inBkt   = receipt.items.filter(i => Number(i.gst || 0) === rate);
      const total   = inBkt.reduce((a, i) => a + Math.abs(i.total), 0);
      const share   = totalSale > 0 ? total / totalSale : 0;
      const taxable = s.taxableAmount * share;
      const gst     = (taxable * rate) / 100;
      return `<tr>
        <td>GST ${rate}%</td>
        <td class="right">${num(taxable)}</td>
        <td class="right">${num(gst / 2)}</td>
        <td class="right">${num(gst / 2)}</td>
        <td class="right">0.00</td>
        <td class="right">${num(gst)}</td>
      </tr>`;
    }).join("");

    const itemRows = receipt.items.map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td class="bold">${item.name}</td>
        <td class="right">${num(Math.abs(item.qty))}</td>
        <td class="right">${num(item.price)}</td>
        <td class="right">${num(item.itemDiscount || 0)}</td>
        <td class="right bold">${num(Math.abs(item.total))}</td>
      </tr>
      <tr class="sub">
        <td></td>
        <td class="tiny">${item.barcode}</td>
        <td></td>
        <td class="right tiny">${item.hsn || "—"}</td>
        <td colspan="2"></td>
      </tr>
    `).join("");

    const totalQty = receipt.items.reduce((a, i) => a + Math.abs(i.qty), 0).toFixed(0);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${isReturn ? "Credit Note" : "Tax Invoice"} - ${receipt.invoiceNo}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm 3mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 74mm;
      background: #fff;
      color: #000;
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      line-height: 1.35;
    }
    .center  { text-align: center; }
    .right   { text-align: right; }
    .bold    { font-weight: bold; }
    .tiny    { font-size: 8pt; }
    .store   { font-size: 15pt; font-weight: 900; letter-spacing: 1px; }
    .dash    { border: none; border-top: 1px dashed #000; margin: 3mm 0; }
    table    { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th, td   { padding: 1px; vertical-align: top; }
    th       { font-weight: bold; border-bottom: 1px dashed #000; padding-bottom: 2px; }
    tr.sub td { font-size: 8pt; color: #555; padding-bottom: 2px; }
    tfoot tr { border-top: 1px dashed #000; font-weight: bold; }
    .summary { width: 100%; font-size: 9.5pt; }
    .summary td { padding: 0.5px 0; }
    .val     { text-align: right; }
    .net-row td { font-size: 12pt; font-weight: 900; border-top: 1px solid #000; padding-top: 3px; }
    .thankyou { text-align: center; font-weight: bold; margin: 3mm 0 1mm; font-size: 9.5pt; }
    .barcode-text { text-align: center; font-size: 9pt; letter-spacing: 3px; margin-top: 3mm; }
  </style>
</head>
<body>
  <!-- Store Header -->
  <div class="center">
    <p class="store">CitiMart</p>
    <p class="bold">Value For Money Re-Defined</p>
    <p class="tiny">(A Unit of Lourdes Textiles Private Limited)</p>
    <p class="tiny">19B J.L.NEHRU ROAD, KOLKATA - 700087</p>
    <p class="tiny">Helpline: 03322493502</p>
    <p class="tiny">CIN No: U51909WB1996PTC081759</p>
    <p class="tiny">GSTIN: 19AAACL5546PIZW</p>
  </div>

  <hr class="dash"/>
  <p class="center bold">${isReturn ? "CREDIT NOTE (RETURN)" : "TAX INVOICE FOR SUPPLY"}</p>
  <hr class="dash"/>

  <!-- Invoice Details -->
  <table class="summary">
    <tr><td colspan="2"><span class="bold">Invoice No:</span> ${receipt.invoiceNo}</td></tr>
    ${receipt.offline ? `<tr><td colspan="2"><span class="bold">Status:</span> Pending offline sync</td></tr>` : ""}
    ${receipt.originalInvoice ? `<tr><td colspan="2"><span class="bold">Against:</span> ${receipt.originalInvoice}</td></tr>` : ""}
    <tr>
      <td>Date: ${receipt.date}</td>
      <td class="val">Cashier: ${receipt.cashierName || "N/A"}</td>
    </tr>
    <tr><td colspan="2">Customer: ${receipt.customerName || "Walking Customer"}</td></tr>
    <tr><td colspan="2">Mobile: ${receipt.mobile || "N/A"}</td></tr>
  </table>

  <hr class="dash"/>

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th style="width:14px">#</th>
        <th class="left">Product</th>
        <th class="right">Qty</th>
        <th class="right">Rate</th>
        <th class="right">Disc</th>
        <th class="right">Amt</th>
      </tr>
      <tr>
        <th></th>
        <th class="left">Barcode</th>
        <th></th>
        <th class="right">HSN</th>
        <th colspan="2"></th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
   <tfoot>
  <tr>
    <td></td>
    <td class="bold">Total Qty: ${totalQty}</td>
    <td colspan="3"></td>
    <td class="right bold">${num(totalSale)}</td>
  </tr>
  <tr>
    <td colspan="6" style="font-size:8pt;font-style:italic;padding-top:2px">
      ${numToWords(Math.round(s.netPayable))} Rupees Only
    </td>
  </tr>
</tfoot>
  </table>

  <hr class="dash"/>

  <!-- Payment -->
  <table class="summary">
    ${receipt.exchangeCredit ? `<tr><td>Credit note ${receipt.exchangeInvoice || ""}</td><td class="val">${num(receipt.exchangeCredit)}</td></tr>` : ""}
    ${splitRows.length ? splitRows.map(([mode, amount]) => `<tr><td>${mode}</td><td class="val">${num(amount)}</td></tr>`).join("") : `<tr><td>${receipt.paymentMethod}</td><td class="val">${num(Math.max(0, s.netPayable - (receipt.exchangeCredit || 0)))}</td></tr>`}
    <tr><td>Customer Paid :</td><td class="val">${num(receipt.paidAmount)}</td></tr>
    <tr><td>Balance Refund :</td><td class="val">${num(receipt.changeReturn)}</td></tr>
  </table>

  <hr class="dash"/>

  <!-- Bill Summary -->
  <table class="summary">
    <tr><td>Total Sale :</td><td class="val">${num(s.totalSale)}</td></tr>
    <tr><td>Offer Applied :</td><td class="val">- ${num(receipt.appliedOffer || 0)}</td></tr>
    <tr><td>Addl. Disc. (${receipt.discount || 0}%) :</td><td class="val">- ${num(s.totalSavings - (receipt.appliedOffer || 0))}</td></tr>
    <tr class="bold"><td>Total Savings :</td><td class="val">- ${num(s.totalSavings)}</td></tr>
    <tr><td>Taxable Amount :</td><td class="val">${num(s.taxableAmount)}</td></tr>
    <tr><td>CGST :</td><td class="val">${num(s.cgstAmount)}</td></tr>
    <tr><td>SGST :</td><td class="val">${num(s.sgstAmount)}</td></tr>
    <tr><td>Total GST :</td><td class="val">${num(s.totalGstAmount)}</td></tr>
    <tr><td>Round Off :</td><td class="val">${num(s.roundOff)}</td></tr>
  </table>
  <table class="summary">
    <tr class="net-row">
      <td>${isReturn ? "CREDIT NOTE AMOUNT :" : "NET PAYABLE :"}</td>
      <td class="val">${num(s.netPayable)}</td>
    </tr>
  </table>

  <hr class="dash"/>

  <!-- GST Summary -->
  <p class="bold" style="margin-bottom:2px">GST Summary</p>
  <table style="font-size:8pt">
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Taxable</th>
        <th class="right">CGST</th>
        <th class="right">SGST</th>
        <th class="right">IGST</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>${gstRows}</tbody>
    <tfoot>
      <tr>
        <td class="bold">Totals:</td>
        <td class="right bold">${num(s.taxableAmount)}</td>
        <td class="right bold">${num(s.cgstAmount)}</td>
        <td class="right bold">${num(s.sgstAmount)}</td>
        <td class="right bold">0.00</td>
        <td class="right bold">${num(s.totalGstAmount)}</td>
      </tr>
    </tfoot>
  </table>

  <hr class="dash"/>

  <p class="thankyou">*** THANK YOU. PLEASE VISIT AGAIN ***</p>
  <p class="barcode-text">* ${receipt.invoiceNo} *</p>

  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=400,height=800");
    win.document.write(html);
    win.document.close();
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3"
      onMouseDown={onClose}
    >
      <div
        className="relative flex max-h-[94vh] w-full max-w-[400px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onMouseDown={e => e.stopPropagation()}
      >

        {/* Modal Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">
            {isReturn ? "Credit Note" : "Tax Invoice"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            onMouseDown={e => e.stopPropagation()}
            className="relative z-30 grid h-12 w-12 cursor-pointer place-items-center rounded-2xl bg-slate-100 text-slate-950 shadow-sm hover:bg-rose-50 hover:text-rose-600 active:scale-95"
            aria-label="Close receipt"
          >
            <FaTimes size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">

          {/* ── Thermal Preview ── */}
          <div
            id="thermal-print-area"
            className="mx-auto w-[280px] bg-white font-mono text-[11px] leading-tight text-black"
          >
            {/* Store Header */}
            <div className="text-center">
              <h1 className="text-[20px] font-black">CitiMart</h1>
              <p className="font-bold">Value For Money Re-Defined</p>
              <p>(A Unit of Lourdes Textiles Private Limited)</p>
              <p>19B J.L.NEHRU ROAD, KOLKATA - 700087</p>
              <p>Helpline No: 03322493502</p>
              <p>CIN No: U51909WB1996PTC081759</p>
              <p>GSTIN: 19AAACL5546PIZW</p>
            </div>

            <div className="my-2 border-t border-dashed border-black" />
            <div className="text-center font-black">
              {isReturn ? "Credit Note (Return)" : "Tax Invoice For Supply"}
            </div>
            <div className="my-2 border-t border-dashed border-black" />

            {/* Invoice Details */}
            <div className="space-y-0.5">
              <div><span className="font-bold">Invoice No:</span> {receipt.invoiceNo}</div>
              {receipt.offline && <p className="font-black text-amber-700">Status: Pending offline sync</p>}
              {receipt.originalInvoice && <p>Against: {receipt.originalInvoice}</p>}
              <div className="flex justify-between">
                <span>Date: {receipt.date}</span>
                <span>Cashier: {receipt.cashierName || "N/A"}</span>
              </div>
              <p>Customer: {receipt.customerName || "Walking Customer"}</p>
              <p>Mobile: {receipt.mobile || "N/A"}</p>
              <p>Email: {receipt.customerEmail || "N/A"}</p>
              <p className={receipt.offline ? "font-black text-amber-700" : receipt.customerEmail ? (receipt.emailSent ? "font-black text-emerald-700" : receipt.emailQueued ? "font-black text-amber-700" : "font-black text-rose-700") : "font-bold text-slate-500"}>
                Digital bill: {receipt.offline ? "Will send after sync" : receipt.customerEmail ? (receipt.emailSent ? "Email sent" : receipt.emailQueued ? "Sending…" : "Email not sent") : "No email added"}
              </p>
            </div>

            <div className="my-2 border-t border-dashed border-black" />

            {/* Items Table */}
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left">Sl</th>
                  <th className="text-left">Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Disc</th>
                  <th className="text-right">Amt</th>
                </tr>
                <tr>
                  <th />
                  <th className="text-left">Barcode</th>
                  <th />
                  <th className="text-right">HSN</th>
                  <th colSpan={2} />
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <tr>
                      <td>{idx + 1}</td>
                      <td className="font-bold">{item.name}</td>
                      <td className="text-right">{num(Math.abs(item.qty))}</td>
                      <td className="text-right">{num(item.price)}</td>
                      <td className="text-right">{num(item.itemDiscount || 0)}</td>
                      <td className="text-right font-bold">{num(Math.abs(item.total))}</td>
                    </tr>
                    <tr>
                      <td />
                      <td className="text-[9px]">{item.barcode}</td>
                      <td />
                      <td className="text-right text-[9px]">{item.hsn || "—"}</td>
                      <td colSpan={2} />
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            <div className="my-1 border-t border-dashed border-black" />

            {/* Total Qty row */}
            <div className="flex justify-between font-bold">
  <span>Total Qty:</span>
  <span>{receipt.items.reduce((a, i) => a + Math.abs(i.qty), 0).toFixed(0)}</span>
  <span>{num(s.totalSale)}</span>
</div>


            <div className="my-2 border-t border-dashed border-black" />

            {/* Payment */}
            <div className="space-y-1">
              {receipt.exchangeCredit > 0 && <div className="flex justify-between"><span>Credit note {receipt.exchangeInvoice}</span><span>{num(receipt.exchangeCredit)}</span></div>}
              {splitRows.length ? splitRows.map(([mode, amount]) => (
                <div key={mode} className="flex justify-between">
                  <span>{mode}</span>
                  <span>{num(amount)}</span>
                </div>
              )) : (
                <div className="flex justify-between">
                  <span>{receipt.paymentMethod}</span>
                  <span>{num(Math.max(0, s.netPayable - (receipt.exchangeCredit || 0)))}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Customer Paid :</span>
                <span>{num(receipt.paidAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Balance Refund :</span>
                <span>{num(receipt.changeReturn)}</span>
              </div>
            </div>

            <div className="my-2 border-t border-dashed border-black" />

            {/* Bill Summary */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Total Sale :</span>
                <span>{num(s.totalSale)}</span>
              </div>
              <div className="flex justify-between">
                <span>Offer Applied :</span>
                <span>- {num(receipt.appliedOffer || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Addl. Disc. ({receipt.discount || 0}%) :</span>
                <span>- {num(s.totalSavings - (receipt.appliedOffer || 0))}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total Savings :</span>
                <span>- {num(s.totalSavings)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxable Amount :</span>
                <span>{num(s.taxableAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST :</span>
                <span>{num(s.cgstAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST :</span>
                <span>{num(s.sgstAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total GST :</span>
                <span>{num(s.totalGstAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Round Off :</span>
                <span>{num(s.roundOff)}</span>
              </div>
              <div className="flex justify-between text-[14px] font-black">
                <span>{isReturn ? "Credit Note Amount :" : "Net Payable :"}</span>
                <span>{num(s.netPayable)}</span>
              </div>
               <div className="text-[9px] italic text-slate-500 mt-0.5">
                {numToWords(Math.round(s.netPayable))} Rupees Only
              </div>
            </div>

            <div className="my-2 border-t border-dashed border-black" />

            {/* GST Summary */}
            <p className="font-black">GST Summary</p>
            <table className="w-full text-[9px]">
              <thead>
                <tr className="border-b border-dashed border-black">
                  <th className="text-left">Description</th>
                  <th className="text-right">Taxable</th>
                  <th className="text-right">CGST</th>
                  <th className="text-right">SGST</th>
                  <th className="text-right">IGST</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const totalSale = receipt.items.reduce((a, i) => a + Math.abs(i.total), 0);
                  const rates = Array.from(new Set(receipt.items.map(i => Number(i.gst || 0)))).sort((a, b) => a - b);
                  return rates.map(rate => {
                    const inBkt   = receipt.items.filter(i => Number(i.gst || 0) === rate);
                    const total   = inBkt.reduce((a, i) => a + Math.abs(i.total), 0);
                    const share   = totalSale > 0 ? total / totalSale : 0;
                    const taxable = s.taxableAmount * share;
                    const gst     = (taxable * rate) / 100;
                    return (
                      <tr key={rate}>
                        <td>GST {rate}%</td>
                        <td className="text-right">{num(taxable)}</td>
                        <td className="text-right">{num(gst / 2)}</td>
                        <td className="text-right">{num(gst / 2)}</td>
                        <td className="text-right">0.00</td>
                        <td className="text-right">{num(gst)}</td>
                      </tr>
                    );
                  });
                })()}
                <tr className="font-bold border-t border-dashed border-black">
                  <td>Totals:</td>
                  <td className="text-right">{num(s.taxableAmount)}</td>
                  <td className="text-right">{num(s.cgstAmount)}</td>
                  <td className="text-right">{num(s.sgstAmount)}</td>
                  <td className="text-right">0.00</td>
                  <td className="text-right">{num(s.totalGstAmount)}</td>
                </tr>
              </tbody>
            </table>

            <div className="my-3 text-center font-bold">*** THANK YOU. PLEASE VISIT AGAIN ***</div>
            <div className="text-center">*{receipt.invoiceNo}*</div>
          </div>

          {receipt.stockConflicts?.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-bold text-amber-800">
              Stock conflict flagged: {receipt.stockConflicts.length} item(s) were low during offline sync. Admin should review stock.
            </div>
          )}

          <div className="mt-5 grid gap-2">
            <button onClick={handlePrint}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-3 text-[11px] font-black uppercase tracking-widest text-white hover:bg-slate-800">
              <FaPrint /> Print Receipt
            </button>
            <button onClick={prepareShare} disabled={sharing || receipt.offline}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 py-3 text-[11px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
              {sharing ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />} {receipt.offline ? "Sync first to share bill" : "Copy bill link / WhatsApp"}
            </button>
            <button onClick={sendReceiptEmail} disabled={emailing || receipt.offline}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 py-3 text-[11px] font-black uppercase tracking-widest text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
              {emailing ? <FaSpinner className="animate-spin" /> : <FaEnvelope />} {receipt.offline ? "Sync first to email bill" : receipt.emailSent ? "Email sent / resend" : "Send email bill"}
            </button>
            {shareInfo?.share_url && (
              <div className="rounded-2xl bg-slate-50 p-3 text-[11px] font-bold text-slate-600">
                <p className="break-all">{shareInfo.share_url}</p>
                {shareInfo.whatsapp_url && <a className="mt-2 inline-block font-black text-emerald-700" href={shareInfo.whatsapp_url} target="_blank" rel="noreferrer">Open WhatsApp message</a>}
              </div>
            )}

            {/* Exchange: let the customer spend this return's refund value
                on a new purchase right now, instead of only handing back
                cash/credit with nothing to apply it to in the moment. */}
            {isReturn && !receipt.offline && (
              <button onClick={() => onStartExchange?.(receipt)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 py-3 text-[11px] font-black uppercase tracking-widest text-amber-700 hover:bg-amber-100">
                <FaExchangeAlt /> Use {money(receipt.summary?.netPayable)} as credit for a new purchase
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function CashierPOS() {
  const barcodeRef = useRef(null);
  const searchRef  = useRef(null);
  const generateBillRef = useRef(null);
  const scrollRef  = useRef(null);
  const scannerFallbackRef = useRef(null);
  const [touchKeyboardTarget, setTouchKeyboardTarget] = useState(null);
  const [touchKeyboardOpen, setTouchKeyboardOpen] = useState(false);
  const lastInputRef = useRef(null);

  useEffect(() => {
    const isEditable = (target) => (target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "file", "hidden"].includes(target.type))) && !target.readOnly && !target.disabled;
    const onFocus = (event) => {
      if (!isEditable(event.target)) return;
      lastInputRef.current = event.target;
      setTouchKeyboardTarget(event.target);
    };
    const onPointer = (event) => {
      if (event.pointerType === "touch" && isEditable(event.target)) {
        lastInputRef.current = event.target;
        setTouchKeyboardTarget(event.target);
        setTouchKeyboardOpen(true);
      }
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("pointerdown", onPointer, true);
    return () => { document.removeEventListener("focusin", onFocus); document.removeEventListener("pointerdown", onPointer, true); };
  }, []);

  const [mode,           setMode]           = useState("sale");
  const [items,          setItems]          = useState([]);
  // Stable per-cart idempotency key. Sent with every Finalize request so
  // that if the tab freezes/stalls right after the request goes out and
  // the cashier retries with the same cart, the backend's existing
  // client_offline_id dedup check (built for offline sync) recognizes the
  // retry and returns the already-saved bill instead of double-billing
  // the customer and double-deducting stock. Rotates only when the cart
  // is actually cleared (after a successful save, or manually).
  const [cartId,         setCartId]         = useState(() => makeOfflineId());
  const [draftPrompt,    setDraftPrompt]    = useState(() => readDraftCart());
  const [barcode,        setBarcode]        = useState("");
  const [search,         setSearch]         = useState("");
  const [searchRes,      setSearchRes]      = useState([]);
  const [searching,      setSearching]      = useState(false);
  const [scanning,       setScanning]       = useState(false);
  const [toast,          setToast]          = useState({ msg: "", type: "default" });
  const [billOpen,       setBillOpen]       = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [reprintOpen, setReprintOpen] = useState(false);
  const [reprintSearch, setReprintSearch] = useState("");
  const [reprintBills, setReprintBills] = useState([]);
  const [receiptOpen,    setReceiptOpen]    = useState(false);
  const [receipt,        setReceipt]        = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [invoiceLookup,  setInvoiceLookup]  = useState(false);  // ← NEW
  const [originalInvoice,setOriginalInvoice]= useState("");     // ← NEW
  const [showGuide,      setShowGuide]      = useState(false);
  const [offlineBills,   setOfflineBills]   = useState(() => readOfflineBills());
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [productCache,     setProductCache] = useState(() => readProductCache());
  const [cacheRefreshing,  setCacheRefreshing] = useState(false);
  const [manualOfflineOpen, setManualOfflineOpen] = useState(false);
  const [manualOfflineBarcode, setManualOfflineBarcode] = useState("");
  const [currentShift, setCurrentShift] = useState(null);
  const [shiftBusy, setShiftBusy] = useState(false);
  const [openShiftModalOpen, setOpenShiftModalOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState("0");
  const [openingCashHint, setOpeningCashHint] = useState(null);
  const [closeShiftModalOpen, setCloseShiftModalOpen] = useState(false);
  const [closingCashInput, setClosingCashInput] = useState("");
  const [closingNotesInput, setClosingNotesInput] = useState("");
  const [serverReachable, setServerReachable] = useState(true);
  const [pendingAutoPrint, setPendingAutoPrint] = useState(false);
  const [drawerSummaryOpen, setDrawerSummaryOpen] = useState(false);
  const [drawerSummaryData, setDrawerSummaryData] = useState(null);
  const [drawerSummaryLoading, setDrawerSummaryLoading] = useState(false);
  const [drawerCountedCash, setDrawerCountedCash] = useState("");
  const [heldBills, setHeldBills] = useState(() => readHeldBills());
  const [heldPanelOpen, setHeldPanelOpen] = useState(false);
  const [heldFilter, setHeldFilter] = useState("");
  // Exchange: { amount, againstInvoice } — an earlier return's refund
  // value, offered as spendable credit on the NEXT sale built on this
  // screen. One-shot: cleared the moment it's actually applied to a bill,
  // or if the cashier cancels it.
  const [exchangeCredit, setExchangeCredit] = useState(null);
  const [terminalNamePrompt, setTerminalNamePrompt] = useState(false);
  const [terminalNameDraft, setTerminalNameDraft] = useState("");
  const [terminalSetupRequired, setTerminalSetupRequired] = useState(false);
  const [terminalSetupError, setTerminalSetupError] = useState("");

  const findReprintBills = async () => {
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/bills?search=${encodeURIComponent(reprintSearch)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Could not find bills");
      setReprintBills(json.data || []);
    } catch (e) { showToast(e.message || "Could not find bills", "error"); }
  };
  const reprintBill = async (invoiceNo) => {
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/bill/${encodeURIComponent(invoiceNo)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Could not load bill");
      const b = json.data, s = b.summary || {};
      setReceipt({ invoiceNo: b.invoice_no, date: b.date, cashierName: b.cashier_name, customerName: b.customer_name, mobile: b.mobile, paymentMethod: b.payment_method, paymentSplit: b.payment_split || {}, paidAmount: b.paid_amount, changeReturn: b.change_return, appliedOffer: b.applied_offer, discount: b.discount_pct, originalInvoice: b.original_invoice, items: b.items || [], isReturn: b.type === 'return', exchangeCredit: b.exchange_credit_applied || 0, exchangeInvoice: b.exchange_against_invoice || '', summary: { totalSale: s.total_sale, totalSavings: s.total_savings, taxableAmount: s.taxable_amount, cgstAmount: s.cgst_amount, sgstAmount: s.sgst_amount, igstAmount: s.igst_amount, totalGstAmount: s.total_gst, roundOff: s.round_off, netPayable: s.net_payable } });
      setReprintOpen(false); setReceiptOpen(true);
    } catch (e) { showToast(e.message || "Could not load bill", "error"); }
  };

  const confirmTerminalName = useCallback(() => {
    const clean = terminalNameDraft.trim();
    if (!clean) return;
    setTerminalName(clean);
    if (getTerminalName() !== clean.slice(0, 40)) {
      setTerminalSetupError("Could not save the terminal name on this device. Check browser storage and try again.");
      return;
    }
    setTerminalSetupError("");
    setTerminalSetupRequired(false);
    setTerminalNamePrompt(false);
  }, [terminalNameDraft]);

  const requireTerminal = useCallback(() => {
    if (getTerminalName().trim()) return true;
    setTerminalNameDraft("");
    setTerminalSetupError("");
    setTerminalSetupRequired(true);
    setTerminalNamePrompt(true);
    return false;
  }, []);

  // The cashier name belongs to the authenticated session, never a generic
  // POS default. `admin_name` is written by authRedirect immediately after
  // login and is shared by store cashiers and store owners.
  const [bill, setBill] = useState(() => ({
    cashierName: localStorage.getItem("admin_name") || "Cashier", salesmanCode: "", customerName: "", mobile: "", customerEmail: "",
    offer: "", appliedOffer: 0, discount: "", discountType: "percent", promotionName: "", promotionType: "",
    paymentMethod: "Cash",
  }));

  const isReturn = mode === "return";
  const pendingOfflineCount = useMemo(
    () => offlineBills.filter(row => row.status === "pending").length,
    [offlineBills]
  );
  const failedOfflineCount = useMemo(
    () => offlineBills.filter(row => row.status === "failed").length,
    [offlineBills]
  );
  const syncedOfflineCount = useMemo(
    () => offlineBills.filter(row => row.status === "synced").length,
    [offlineBills]
  );
  const cachedProducts = useMemo(
    () => (Array.isArray(productCache?.products) ? productCache.products : []),
    [productCache]
  );
  const cachedProductCount = cachedProducts.length;

  useEffect(() => { barcodeRef.current?.focus(); }, []);
  useEffect(() => {
    if (items.length > 0) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items.length]);

  const showToast = useCallback((msg, type = "default") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "default" }), 1600);
  }, []);

  const loadCurrentShift = useCallback(async () => {
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/shift/current?terminal_id=${encodeURIComponent(getTerminalId())}`);
      const json = await res.json();
      if (res.ok) setCurrentShift(json.shift || null);
    } catch {
      // shift status is helpful but should not block POS billing
    }
  }, []);

  useEffect(() => {
    loadCurrentShift();
  }, [loadCurrentShift]);

  // Replaces a raw window.prompt() with a real modal, and offers yesterday's
  // counted closing cash on THIS terminal as a suggested opening figure —
  // in practice the float carried forward is usually the same amount, so
  // defaulting to "0" every morning just made the cashier retype it. It's
  // only ever a suggestion: still editable, never applied automatically.
  const openShift = useCallback(async () => {
    setOpenShiftModalOpen(true);
    setOpeningCashInput("0");
    setOpeningCashHint(null);
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/shift/last-closed?terminal_id=${encodeURIComponent(getTerminalId())}`);
      const json = await res.json();
      if (res.ok && json.found) {
        setOpeningCashInput(String(json.counted_cash));
        setOpeningCashHint(json);
      }
    } catch {
      // No hint available — the field just stays at the plain default.
    }
  }, []);

  const confirmOpenShift = useCallback(async () => {
    setShiftBusy(true);
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/shift/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingCash: Number(openingCashInput || 0), terminalId: getTerminalId(), terminalName: getTerminalName() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Could not open shift");
      setCurrentShift(json.shift || null);
      setOpenShiftModalOpen(false);
      showToast("Shift opened", "success");
    } catch (e) {
      showToast(e.message || "Could not open shift", "error");
    } finally {
      setShiftBusy(false);
    }
  }, [openingCashInput, showToast]);

  const closeShift = useCallback(() => {
    setClosingCashInput(String(currentShift?.expected_cash || ""));
    setClosingNotesInput("");
    setCloseShiftModalOpen(true);
  }, [currentShift]);

  const confirmCloseShift = useCallback(async () => {
    setShiftBusy(true);
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/shift/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countedCash: Number(closingCashInput || 0), notes: closingNotesInput, terminalId: getTerminalId() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Could not close shift");
      setCurrentShift(null);
      setCloseShiftModalOpen(false);
      const mismatch = Number(json.shift?.cash_mismatch || 0);
      showToast(`Shift closed. Mismatch ₹${mismatch.toFixed(2)}`, Math.abs(mismatch) > 0.01 ? "error" : "success");
    } catch (e) {
      showToast(e.message || "Could not close shift", "error");
    } finally {
      setShiftBusy(false);
    }
  }, [closingCashInput, closingNotesInput, showToast]);

  const openDrawerSummary = useCallback(async () => {
    setDrawerSummaryLoading(true);
    setDrawerSummaryOpen(true);
    setDrawerCountedCash("");
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/shift/drawer-summary?terminal_id=${encodeURIComponent(getTerminalId())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Could not load drawer summary");
      setDrawerSummaryData(json);
    } catch (e) {
      setDrawerSummaryData(null);
      showToast(e.message || "Could not load drawer summary", "error");
    } finally {
      setDrawerSummaryLoading(false);
    }
  }, [showToast]);

  const refreshProductCache = useCallback(async (silent = false) => {
    setCacheRefreshing(true);
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/product-cache`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Product cache failed");
      const mergedProducts = mergeProductCache(readProductCache().products, json.data || []);
      const cachedAt = json.cached_at || new Date().toISOString();
      writeProductCache(mergedProducts, cachedAt);
      setProductCache({ products: mergedProducts, cachedAt });
      if (!silent) showToast(`${mergedProducts.length} products cached for offline billing`, "success");
    } catch (e) {
      setProductCache(readProductCache());
      if (!silent) showToast(e.message || "Could not refresh offline product cache", "error");
    } finally {
      setCacheRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    refreshProductCache(true);
  }, [refreshProductCache]);

  // The component's initial state reads the in-memory cache mirror
  // synchronously, same as it always did — but on a fresh page load that
  // mirror hasn't been hydrated from IndexedDB yet (that's async). Once
  // hydration resolves, re-read both caches so a cold load picks up
  // whatever was actually saved from a previous session instead of
  // silently showing empty until the next online refresh.
  useEffect(() => {
    let cancelled = false;
    offlineStorageReady.then(() => {
      if (cancelled) return;
      setOfflineBills(readOfflineBills());
      setProductCache(readProductCache());
      setHeldBills(readHeldBills());
    });
    return () => { cancelled = true; };
  }, []);

  // Surface a storage-persistence failure (IndexedDB AND localStorage both
  // failed — most likely the device is genuinely out of space) as a loud,
  // specific toast instead of it being invisible, since for the offline
  // bills queue this means a sale currently exists only in this tab's
  // memory with nothing backing it up.
  useEffect(() => onPersistenceWarning((message) => showToast(message, "error")), [showToast]);

  /* ── Search (debounced) ── */
  useEffect(() => {
    if (!search.trim()) { setSearchRes([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await cashierFetch(`${API_BASE}/cashier/search?q=${encodeURIComponent(search.trim())}`);
        const json = await res.json();
        const onlineResults = json.data || [];
        setSearchRes(onlineResults);
        if (onlineResults.length) {
          const mergedProducts = mergeProductCache(readProductCache().products, onlineResults);
          writeProductCache(mergedProducts);
          setProductCache(prev => ({ ...prev, products: mergedProducts }));
        }
      } catch {
        const cachedResults = searchCachedProducts(readProductCache().products, search.trim());
        setSearchRes(cachedResults);
        if (cachedResults.length) showToast("Showing offline cached products", "success");
      }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search, showToast]);

  /* ── Barcode scan ── */
  const openManualOfflineItem = useCallback((prefillBarcode = "") => {
    setManualOfflineBarcode(prefillBarcode || barcode || "");
    setManualOfflineOpen(true);
  }, [barcode]);

  const addManualOfflineItem = useCallback((product) => {
    setItems(prev => [...prev, product]);
    setBarcode("");
    setSearch("");
    setSearchRes([]);
    setManualOfflineOpen(false);
    showToast("Manual offline item added", "success");
  }, [showToast]);

  const addProduct = useCallback((product) => {
    if (!product || !product._id) {
      showToast("Invalid product data. Refresh products or add it manually.", "error");
      return;
    }
    const price = Number(product.price || 0);
    const qtyDelta = isReturn ? -1 : 1;
    setItems(prev => {
      const exist = prev.find(i => i._id === product._id);
      if (exist) {
        const qty = exist.qty + qtyDelta;
        if (qty === 0) return prev.filter(i => i._id !== product._id);
        return prev.map(i => i._id === product._id ? { ...i, qty, total: qty * Number(i.price || 0) } : i);
      }
      return [...prev, { ...product, price, qty: qtyDelta, total: qtyDelta * price }];
    });
    setBarcode(""); setSearch(""); setSearchRes([]);
    showToast(`${product.name || "Product"} ${isReturn ? "returned" : "added"}`, "success");
    setTimeout(() => barcodeRef.current?.focus(), 40);
  }, [isReturn, showToast]);

  const scanBarcode = useCallback(async () => {
    const bc = barcode.trim();
    if (!bc) return showToast("Enter a barcode", "error");
    setScanning(true);
    try {
      const res  = await cashierFetch(`${API_BASE}/cashier/lookup/${encodeURIComponent(bc)}`);
      if (!res.ok) {
        if (res.status === 409) {
          // The server is reachable and explicitly refused this item (not
          // allocated to this store) — this is a deliberate block, not a
          // "couldn't find it" case, so it must NOT fall through to the
          // offline cache or manual-add escape hatch, or the guard is
          // trivially bypassed by just typing the item in by hand.
          let detail = "This item has not been allocated to this store yet.";
          try { detail = (await res.json())?.detail || detail; } catch {}
          showToast(detail, "error");
          return;
        }
        const cached = findCachedProductByBarcode(readProductCache().products, bc);
        if (cached) {
          addProduct(cached);
          showToast("Added from offline cache", "success");
          return;
        }
        showToast("Product not found in online/cache. Add manually if needed.", "error");
        openManualOfflineItem(bc);
        return;
      }
      const json = await res.json();
      addProduct(json.data);
      const mergedProducts = mergeProductCache(readProductCache().products, [json.data]);
      writeProductCache(mergedProducts);
      setProductCache(prev => ({ ...prev, products: mergedProducts }));
    } catch {
      const cached = findCachedProductByBarcode(readProductCache().products, bc);
      if (cached) {
        addProduct(cached);
        showToast("Added from offline cache", "success");
      } else {
        showToast("Network error and product not in offline cache", "error");
        openManualOfflineItem(bc);
      }
    }
    finally { setScanning(false); }
  }, [barcode, showToast, openManualOfflineItem, addProduct]);

  useEffect(() => {
    const clean = barcode.trim();
    if (isReturn || scanning || clean.length < 6 || clean.includes(" ")) return undefined;
    window.clearTimeout(scannerFallbackRef.current);
    scannerFallbackRef.current = window.setTimeout(() => {
      scanBarcode();
    }, 550);
    return () => window.clearTimeout(scannerFallbackRef.current);
  }, [barcode, isReturn, scanning, scanBarcode]);


  /* ── Load items from invoice lookup ── */
  const handleLoadReturnItems = useCallback((returnItems, invNo) => {
    setItems(returnItems);
    setOriginalInvoice(invNo);
    showToast(`${returnItems.length} item(s) loaded from ${invNo}`, "success");
  }, [showToast]);

  const updateQty = (id, delta) => {
    if (isReturn) { showToast("Change return quantities using Load Invoice.", "error"); return; }
    setItems(prev => prev.map(item => {
      if (item._id !== id) return item;
      const qty = item.qty + delta;
      if (!isReturn && qty < 1) return item;
      if (isReturn  && qty > -1) return item;
      return { ...item, qty, total: qty * item.price };
    }));
  };


  const summary = useMemo(() => {
    const totalSale      = items.reduce((s, i) => s + Math.abs(i.total), 0);
    const offerDiscount  = Number(bill.appliedOffer || 0);
    const additionalDisc = bill.discountType === "amount"
      ? Math.min(Number(bill.discount || 0), totalSale)
      : (totalSale * Number(bill.discount || 0)) / 100;
    const totalSavings   = offerDiscount + additionalDisc;
    const discountedSale = Math.max(0, totalSale - totalSavings);

    // GST is INCLUSIVE in MRP — extract it backwards per item
    const totalGstAmount = items.reduce((sum, item) => {
      const gstRate = Number(item.gst || 0);
      if (!gstRate) return sum;
      const itemTotal    = Math.abs(item.total);
      const itemDiscount = (itemTotal / totalSale) * (totalSavings);
      const itemAfterDisc = itemTotal - itemDiscount;
      const gstAmt = itemAfterDisc - (itemAfterDisc / (1 + gstRate / 100));
      return sum + gstAmt;
    }, 0);

    const taxableAmount = discountedSale - totalGstAmount;
    const cgstAmount    = totalGstAmount / 2;
    const sgstAmount    = totalGstAmount / 2;
    const igstAmount    = 0;
    const grandTotal    = discountedSale;          // already includes GST
    const netPayable    = Math.round(grandTotal);
    const roundOff      = netPayable - grandTotal;
    return { totalSale, offerDiscount, additionalDisc, totalSavings, taxableAmount, cgstAmount, sgstAmount, igstAmount, totalGstAmount, grandTotal, roundOff, netPayable };
  }, [items, bill]);

  const clearAll = () => {
    setItems([]); setBarcode(""); setSearch(""); setSearchRes([]);
    setOriginalInvoice("");
    setBill(prev => ({ ...prev, salesmanCode: "", customerName: "", mobile: "", customerEmail: "", offer: "", appliedOffer: 0, discount: "", discountType: "percent", promotionName: "", promotionType: "", paymentMethod: "Cash" }));
    setCartId(makeOfflineId());
    clearDraftCart();
  };

  // Hold Bill — a queue can back up mid-sale (customer remembers another
  // item, steps away, etc.) and real POS flows need to serve the next few
  // customers without losing that first cart. Unlike the single draft-cart
  // autosave slot (crash-recovery only), this is a genuine list: several
  // carts can be held at once, each resumed independently by whoever's
  // ready, in any order.
  const holdCurrentBill = useCallback(() => {
    if (!items.length) { showToast("Nothing in the cart to hold", "error"); return; }
    const label = bill.customerName?.trim() || `Hold ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
    const entry = {
      id: cartId, label, heldAt: new Date().toISOString(),
      items, bill, mode, originalInvoice, exchangeCredit,
      itemCount: items.length,
    };
    writeHeldBills([entry, ...readHeldBills()]);
    setHeldBills(readHeldBills());
    clearAll();
    setExchangeCredit(null);
    showToast(`Held — "${label}"`, "success");
  }, [items, bill, mode, originalInvoice, cartId, exchangeCredit, showToast]);

  const resumeHeldBill = useCallback((id) => {
    const target = readHeldBills().find(row => row.id === id);
    if (!target) return;
    // Don't silently drop whatever the cashier was already mid-way on —
    // auto-hold it first so switching between queued customers never
    // loses a cart, it just adds another one to the list.
    if (items.length) {
      const autoLabel = bill.customerName?.trim() || `Hold ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
      const autoEntry = { id: cartId, label: autoLabel, heldAt: new Date().toISOString(), items, bill, mode, originalInvoice, exchangeCredit, itemCount: items.length };
      writeHeldBills([autoEntry, ...readHeldBills().filter(row => row.id !== id)]);
    } else {
      writeHeldBills(readHeldBills().filter(row => row.id !== id));
    }
    setItems(target.items || []);
    setBill(prev => ({ ...prev, ...(target.bill || {}) }));
    setMode(target.mode || "sale");
    setOriginalInvoice(target.originalInvoice || "");
    setExchangeCredit(target.exchangeCredit || null);
    setCartId(target.id || makeOfflineId());
    setHeldBills(readHeldBills());
    setHeldPanelOpen(false);
    showToast(`Resumed — "${target.label}"`, "success");
  }, [items, bill, mode, originalInvoice, cartId, exchangeCredit, showToast]);

  const discardHeldBill = useCallback((id) => {
    writeHeldBills(readHeldBills().filter(row => row.id !== id));
    setHeldBills(readHeldBills());
  }, []);

  // Exchange: offered right after a return is saved — jump straight into
  // a fresh sale with that return's refund value ready to spend, instead
  // of the cashier having to separately remember the amount and manually
  // adjust payment themselves.
  const startExchange = useCallback((receipt) => {
    setExchangeCredit({ amount: Number(receipt?.summary?.netPayable || 0), againstInvoice: receipt?.invoiceNo || "" });
    setMode("sale");
    clearAll();
    setReceiptOpen(false);
    showToast(`Exchange credit ready — ${money(receipt?.summary?.netPayable || 0)} available`, "success");
  }, [showToast]);

  const cancelExchangeCredit = useCallback(() => setExchangeCredit(null), []);

  // Scanning a credit note's barcode/number should feel exactly like
  // scanning a product — a dedicated, auto-focused field that the
  // scanner's trailing Enter submits on its own, not a raw browser
  // prompt() (which has no app styling and nothing marking it as
  // scan-ready).
  const [creditNoteModalOpen, setCreditNoteModalOpen] = useState(false);
  const [creditNoteInput, setCreditNoteInput] = useState("");
  const [creditNoteBusy, setCreditNoteBusy] = useState(false);

  const openCreditNoteLookup = () => { setCreditNoteInput(""); setCreditNoteModalOpen(true); };

  const submitCreditNote = async () => {
    const invoice = creditNoteInput.trim();
    if (!invoice) return;
    setCreditNoteBusy(true);
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/bill/${encodeURIComponent(invoice)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Credit note not found");
      const note = data.data;
      if (note.type !== "return") throw new Error("This number is not a credit note.");
      if (!note.credit_note_only) throw new Error("This older return needs manager review before it can be used as credit.");
      if (note.exchange_consumed) throw new Error("This credit note has already been used.");
      const amount = Number(note.summary?.net_payable || 0);
      if (amount <= 0) throw new Error("This credit note has no usable value.");
      setExchangeCredit({ amount, againstInvoice: note.invoice_no });
      showToast(`Credit note ${note.invoice_no} ready`, "success");
      setCreditNoteModalOpen(false);
    } catch (error) {
      showToast(error.message || "Could not load credit note", "error");
    } finally {
      setCreditNoteBusy(false);
    }
  };

  // Debounced draft autosave — covers a freeze/crash while the cashier is
  // still building the bill (before Finalize/Save offline, where nothing
  // was persisted at all before this). Skipped for return mode: a return
  // always starts from "Load Invoice" again anyway, and its items came
  // from the server, not typed in, so there's nothing meaningfully lost.
  useEffect(() => {
    if (isReturn || items.length === 0) return undefined;
    const timer = setTimeout(() => {
      writeDraftCart({ items, bill, mode, originalInvoice, exchangeCredit, cartId, savedAt: new Date().toISOString() });
    }, 800);
    return () => clearTimeout(timer);
  }, [items, bill, mode, originalInvoice, exchangeCredit, cartId, isReturn]);

  const restoreDraftCart = () => {
    if (!draftPrompt) return;
    setItems(draftPrompt.items || []);
    setBill(prev => ({ ...prev, ...(draftPrompt.bill || {}) }));
    setOriginalInvoice(draftPrompt.originalInvoice || "");
    setExchangeCredit(draftPrompt.exchangeCredit || null);
    setCartId(draftPrompt.cartId || makeOfflineId());
    setDraftPrompt(null);
    showToast("Cart restored", "success");
  };

  const discardDraftCart = () => {
    clearDraftCart();
    setDraftPrompt(null);
  };

  const saveOfflineBill = useCallback((paidAmount = 0, changeReturn = 0, reason = "Backend unavailable", paymentMethodOverride = bill.paymentMethod, paymentSplitOverride = {}) => {
    if (!requireTerminal()) { setBillOpen(false); return; }
    if (isReturn) {
      showToast("Returns need online invoice validation", "error");
      return;
    }
    if (!items.length) {
      showToast("No items to save offline", "error");
      return;
    }
    if (exchangeCredit) {
      showToast("Exchange credit needs a live connection to validate — can't save this one offline.", "error");
      return;
    }

    const clientOfflineId = makeOfflineId();
    const offlineInvoiceNo = makeOfflineInvoiceNo(false);
    const createdOfflineAt = new Date().toISOString();
    const itemSnapshot = items.map(item => ({ ...item }));
    const summarySnapshot = { ...summary };
    const billSnapshot = { ...bill, paymentMethod: paymentMethodOverride, paymentSplit: paymentSplitOverride };
    const queueItem = {
      id: clientOfflineId,
      status: "pending",
      offlineInvoiceNo,
      createdAt: createdOfflineAt,
      reason,
      storeId: localStorage.getItem("store_id") || localStorage.getItem("selected_store_id") || "",
      cashierName: billSnapshot.cashierName,
      total: summarySnapshot.netPayable,
      payload: {
        isReturn: false,
        items: itemSnapshot,
        summary: summarySnapshot,
        bill: billSnapshot,
        paidAmount,
        changeReturn,
        originalInvoice: "",
        clientOfflineId,
        offlineInvoiceNo,
        createdOfflineAt,
        syncSource: "offline_pos",
        terminalId: getTerminalId(),
        terminalName: getTerminalName(),
      },
    };

    const next = [queueItem, ...readOfflineBills()];
    writeOfflineBills(next);
    setOfflineBills(next);
    setReceipt({
      invoiceNo: offlineInvoiceNo,
      date: new Date(createdOfflineAt).toLocaleString("en-IN"),
      cashierName: billSnapshot.cashierName,
      customerName: billSnapshot.customerName,
      mobile: billSnapshot.mobile,
      customerEmail: billSnapshot.customerEmail,
      paymentMethod: billSnapshot.paymentMethod,
      paymentSplit: billSnapshot.paymentSplit,
      paidAmount,
      changeReturn,
      appliedOffer: billSnapshot.appliedOffer,
      discount: billSnapshot.discount,
      originalInvoice: "",
      items: itemSnapshot,
      summary: summarySnapshot,
      isReturn: false,
      offline: true,
    });
    setBillOpen(false);
    setReceiptOpen(true);
    clearAll();
    showToast("Bill saved offline. Sync when backend is back.", "success");
  }, [isReturn, items, summary, bill, showToast, exchangeCredit, requireTerminal]); // eslint-disable-line

  const syncOfflineBills = useCallback(async () => {
    const pending = readOfflineBills().filter(row => ["pending", "failed"].includes(row.status));
    if (!pending.length) {
      setOfflineBills(readOfflineBills());
      return showToast("No offline bills to sync", "success");
    }

    setSyncingOffline(true);
    let synced = 0;
    let failed = 0;

    for (const row of pending) {
      if (row.status === "syncing" || row.status === "synced") continue;
      const markedSyncing = readOfflineBills().map(item => item.id === row.id ? { ...item, status: "syncing", lastError: "" } : item);
      writeOfflineBills(markedSyncing);
      setOfflineBills(markedSyncing);
      try {
        const res = await cashierFetch(`${API_BASE}/cashier/bill`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row.payload),
        });
        let data = {};
        try { data = await res.json(); } catch { data = {}; }
        if (!res.ok) throw new Error(data.detail || "Sync failed");

        const nextRows = readOfflineBills().map(item => item.id === row.id
          ? { ...item, status: "synced", syncedAt: new Date().toISOString(), serverInvoiceNo: data.invoice_no, shareUrl: data.share_url || item.shareUrl || "", emailSent: Boolean(data.email_sent), emailQueued: Boolean(data.email_queued), customerEmail: data.customer_email || item.payload?.bill?.customerEmail || "", stockConflicts: data.stock_conflicts || [], lastError: "" }
          : item
        );
        writeOfflineBills(nextRows);
        setOfflineBills(nextRows);
        synced += 1;
        if (data.inventory_not_found?.length) {
          data.inventory_not_found.forEach(nf => showToast(
            `Synced offline bill ${data.invoice_no}, but stock was NOT deducted for '${nf.name}' — ${nf.reason === "not_allocated_to_store" ? "it isn't allocated to this store" : "item not found"}. Tell HQ.`,
            "error"
          ));
        }
      } catch (e) {
        const nextRows = readOfflineBills().map(item => item.id === row.id
          ? { ...item, status: "failed", lastError: e.message || "Sync failed" }
          : item
        );
        writeOfflineBills(nextRows);
        setOfflineBills(nextRows);
        failed += 1;
      }
    }

    setSyncingOffline(false);
    if (failed) showToast(`${synced} synced, ${failed} failed`, "error");
    else showToast(`${synced} offline bill(s) synced`, "success");
  }, [showToast]);

  // Pure insurance copy: this localStorage queue is the only place these
  // bills exist until synced. A download lets the cashier keep an external
  // copy before anything risky (device swap, a forced reset) — nothing else
  // can protect against an actual "clear this browser's data" action, since
  // that's outside any website's control.
  const exportOfflineBillsBackup = useCallback(() => {
    const pending = readOfflineBills().filter(row => ["pending", "failed"].includes(row.status));
    if (!pending.length) return showToast("No unsynced offline bills to export", "success");
    const blob = new Blob([JSON.stringify(pending, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `offline-bills-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${pending.length} unsynced bill(s) as backup`, "success");
  }, [showToast]);

  // Offline bills otherwise only sync when the cashier notices the pending
  // banner and clicks it — easy to miss, and leaves bills sitting on just
  // this one device/browser for longer than necessary. Three triggers cover
  // this without relying on the cashier remembering anything:
  //  1. The browser's `online` event — fires the instant the network
  //     interface itself comes back, which is the common case.
  //  2. A short poll while pending bills exist — `online`/navigator.onLine
  //     only reflects the network interface, not whether the RMS server is
  //     actually reachable again (e.g. wifi stays "connected" the whole
  //     time the server itself was down), so a timer retry is the only way
  //     to catch "server is back" rather than "wifi is back".
  //  3. A check right when this screen mounts — covers reopening the tab
  //     (or switching back to Point of Sale) after already having gone
  //     back online, which fires no `online` event at all since nothing
  //     transitioned while the tab/screen was closed.
  const trySyncIfPending = useCallback(() => {
    if (syncingOffline) return;
    if (readOfflineBills().some(row => ["pending", "failed"].includes(row.status))) {
      syncOfflineBills();
    }
  }, [syncingOffline, syncOfflineBills]);

  useEffect(() => {
    trySyncIfPending();
    window.addEventListener("online", trySyncIfPending);
    const interval = setInterval(trySyncIfPending, 30000);
    return () => {
      window.removeEventListener("online", trySyncIfPending);
      clearInterval(interval);
    };
  }, [trySyncIfPending]);

  // Proactive connectivity alert. The sync triggers above only reveal
  // themselves when the cashier tries to DO something and it fails — there
  // is otherwise zero indication that the connection (or just the server)
  // went down. `navigator.onLine`/`online`/`offline` events are no good
  // for this alone: they only reflect the device's own network interface,
  // so a server crash with wifi/LAN still up would show nothing. A real
  // reachability ping against the backend itself is the only way to catch
  // both "no network" and "network's fine, server's dead" the same way.
  useEffect(() => {
    let cancelled = false;
    const pingServer = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`${API_BASE}/`, { signal: controller.signal });
        clearTimeout(timeout);
        if (cancelled) return;
        const reachable = res.ok;
        setServerReachable(prev => {
          if (!prev && reachable) trySyncIfPending();
          return reachable;
        });
      } catch {
        if (!cancelled) setServerReachable(false);
      }
    };
    pingServer();
    const interval = setInterval(pingServer, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [trySyncIfPending]);

  // Keyboard shortcuts for a terminal that has a physical keyboard
  // attached — only active when the cashier isn't typing in a text field,
  // so a shortcut key never fires mid-entry in a customer-name/discount/
  // barcode input (that would be worse than not having shortcuts at all).
  useEffect(() => {
    const isTypingTarget = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };
    const onKeyDown = (event) => {
      if (isTypingTarget(document.activeElement) && event.key !== 'Escape' && !/^F[2-8]$/.test(event.key) && event.code !== 'F6' && !(event.altKey && ['d', 'i'].includes(event.key.toLowerCase())) && !(event.ctrlKey && ['7', '8'].includes(event.key))) return;
      if ((billOpen || customerOpen || reprintOpen || drawerSummaryOpen || heldPanelOpen || invoiceLookup || receiptOpen || terminalNamePrompt) && event.key !== 'Escape' && !(billOpen && event.altKey && ['d', 'i'].includes(event.key.toLowerCase()))) {
        if (/^F[2-8]$/.test(event.key) || (event.ctrlKey && ['7', '8'].includes(event.key))) event.preventDefault();
        return;
      }
      if (event.key === "F1" || event.key === "?") {
        event.preventDefault();
        setShowGuide(v => !v);
      } else if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "F3") {
        event.preventDefault();
        setCustomerOpen(true);
      } else if (event.key === "F4") {
        event.preventDefault();
        setReprintOpen(true);
      } else if (event.key === "F5") {
        event.preventDefault();
        openDrawerSummary();
      } else if (event.key === "F6" || event.code === "F6") {
        event.preventDefault();
        setTerminalNameDraft(getTerminalName());
        setTerminalNamePrompt(true);
      } else if (event.key === "F7") {
        event.preventDefault();
        if (isReturn) setInvoiceLookup(true);
        else if (exchangeCredit && !items.length) showToast("Add items and hold this credit-note sale before starting a return.", "error");
        else { if (items.length) holdCurrentBill(); setMode("return"); clearAll(); setInvoiceLookup(true); }
      } else if (event.key === "F8") {
        event.preventDefault();
        if (items.length && requireTerminal()) setBillOpen(true);
      } else if (event.altKey && (event.key === "d" || event.key === "D")) {
        event.preventDefault();
        if (items.length && !isReturn && requireTerminal()) { setBillOpen(true); setTimeout(() => generateBillRef.current?.focusDiscount(), 50); }
      } else if (event.altKey && (event.key === "i" || event.key === "I")) {
        event.preventDefault();
        generateBillRef.current?.finalizeWithPrint();
      } else if (event.ctrlKey && event.key === "7") {
        event.preventDefault();
        if (!isReturn) holdCurrentBill();
      } else if (event.ctrlKey && event.key === "8") {
        event.preventDefault();
        setHeldPanelOpen(true);
      } else if (event.key === "Escape") {
        if (reprintOpen) setReprintOpen(false);
        else if (customerOpen) setCustomerOpen(false);
        else if (terminalNamePrompt) setTerminalNamePrompt(false);
        else if (creditNoteModalOpen) setCreditNoteModalOpen(false);
        else if (openShiftModalOpen && !shiftBusy) setOpenShiftModalOpen(false);
        else if (closeShiftModalOpen && !shiftBusy) setCloseShiftModalOpen(false);
        else if (billOpen) setBillOpen(false);
        else if (drawerSummaryOpen) setDrawerSummaryOpen(false);
        else if (heldPanelOpen) setHeldPanelOpen(false);
        else if (invoiceLookup) setInvoiceLookup(false);
        else if (manualOfflineOpen) setManualOfflineOpen(false);
        else if (showGuide) setShowGuide(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [items.length, isReturn, receipt, receiptOpen, billOpen, customerOpen, reprintOpen, drawerSummaryOpen, heldPanelOpen, invoiceLookup, terminalNamePrompt, creditNoteModalOpen, openShiftModalOpen, closeShiftModalOpen, shiftBusy, exchangeCredit, manualOfflineOpen, showGuide, holdCurrentBill, openDrawerSummary, showToast, requireTerminal]);

  const finalizeBill = useCallback(async (paidAmount = 0, changeReturn = 0, paymentMethodOverride = bill.paymentMethod, paymentSplitOverride = {}, returnReason = "", managerName = "", autoPrint = false) => {
    if (!requireTerminal()) { setBillOpen(false); return; }
    setSaving(true);
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/bill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isReturn,
          items,
          summary,
          bill: { ...bill, paymentMethod: paymentMethodOverride, paymentSplit: paymentSplitOverride },
          paidAmount,
          changeReturn,
          originalInvoice,
          returnReason,
          managerVerified: Boolean(managerName),
          managerName,
          clientOfflineId: cartId,
          terminalId: getTerminalId(),
          terminalName: getTerminalName(),
          exchangeCredit: !isReturn && exchangeCredit ? { amount: exchangeCredit.amount, againstInvoice: exchangeCredit.againstInvoice } : null,
        }),
      });
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) {
        const err = new Error(data.detail || "Save failed");
        err.serverRejected = true;
        throw err;
      }

      if (data.inventory_warnings?.length) {
        data.inventory_warnings.forEach(w => showToast(w, "error"));
      }
      if (data.inventory_not_found?.length) {
        data.inventory_not_found.forEach(row => showToast(
          `Bill saved, but stock was NOT deducted for '${row.name}' — ${row.reason === "not_allocated_to_store" ? "it isn't allocated to this store" : "item not found"}. Tell HQ.`,
          "error"
        ));
      }

      setReceipt({
        invoiceNo:       data.invoice_no,
        date:            new Date().toLocaleString("en-IN"),
        cashierName:     bill.cashierName,
        customerName:    bill.customerName,
        mobile:          bill.mobile,
        customerEmail:   bill.customerEmail,
        emailSent:       Boolean(data.email_sent),
        emailQueued:     Boolean(data.email_queued),
        paymentMethod:   paymentMethodOverride,
        paymentSplit:    paymentSplitOverride,
        shareUrl:        data.share_url || "",
        stockConflicts:  data.stock_conflicts || [],
        paidAmount,
        changeReturn,
        appliedOffer:    bill.appliedOffer,
        discount:        bill.discount,
        exchangeCredit:  data.exchange_credit_applied || 0,
        exchangeInvoice: exchangeCredit?.againstInvoice || "",
        originalInvoice,
        items,
        summary,
        isReturn,
      });

      setBillOpen(false);
      setReceiptOpen(true);
      setPendingAutoPrint(autoPrint);
      clearAll();
      if (!isReturn && exchangeCredit) {
        setExchangeCredit(null);
        const refundDue = Number(data.exchange_refund_due || 0);
        if (refundDue > 0.009) {
          showToast(`Exchange applied — hand back ₹${refundDue.toFixed(2)} cash to the customer`, "success");
        } else {
          showToast("Exchange applied to this bill ✓", "success");
        }
      } else {
        showToast(isReturn ? "Return bill generated ✓" : "Bill generated ✓", "success");
      }
    } catch (e) {
      if (!isReturn && exchangeCredit) {
        // Can't fall back to offline here — validating/consuming the
        // original return's credit needs the server, and letting this
        // queue offline risks the same credit being spent twice from two
        // different devices before either ever syncs.
        showToast("Could not reach the server — exchange needs a connection. The cart was not cleared; try again once it's back.", "error");
        setBillOpen(false);
      } else if (!isReturn && !e.serverRejected) {
        saveOfflineBill(paidAmount, changeReturn, e.message || "Network/backend unavailable", paymentMethodOverride, paymentSplitOverride);
      } else {
        showToast(e.message || "Failed to save bill", "error");
      }
    } finally {
      setSaving(false);
    }
  }, [isReturn, items, summary, bill, showToast, originalInvoice, saveOfflineBill, cartId, exchangeCredit, requireTerminal]); // eslint-disable-line

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <Toast message={toast.msg} type={toast.type} />
      {touchKeyboardOpen && <TouchKeyboard target={touchKeyboardTarget} onClose={() => setTouchKeyboardOpen(false)} />}
      <div className="flex flex-wrap gap-x-4 gap-y-1 bg-slate-900 px-4 py-2 text-[11px] font-bold text-white sm:px-6" aria-label="Cashier keyboard shortcuts">
        <span>F2 Search</span><span>F3 Customer</span><span>F4 Reprint</span><span>F5 Drawer</span><button type="button" onClick={() => { setTerminalNameDraft(getTerminalName()); setTerminalNamePrompt(true); }} className="rounded underline underline-offset-2 hover:text-emerald-300" title="Open terminal and device configuration">F6 Terminal</button><span>F7 Return</span><span>F8 Payment</span><span>Alt+D Discount</span><span>Alt+I Save &amp; print</span><span>Ctrl+7 Hold</span><span>Ctrl+8 Recall</span><button type="button" onClick={() => { const input = lastInputRef.current?.isConnected ? lastInputRef.current : searchRef.current; if (!input) { showToast('Select a text field first', 'error'); return; } setTouchKeyboardTarget(input); setTouchKeyboardOpen(true); input.focus(); }} className="rounded underline underline-offset-2 hover:text-emerald-300">Touch keyboard</button>
      </div>
      {reprintOpen && <div className="fixed inset-0 z-[2500] grid place-items-center bg-black/50 p-4" onClick={() => setReprintOpen(false)}><div className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}><h2 className="text-lg font-black">Find a bill to reprint</h2><div className="flex gap-2"><input autoFocus value={reprintSearch} onChange={e => setReprintSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && findReprintBills()} placeholder="Invoice, customer name or mobile" className="h-11 flex-1 rounded-xl border px-3"/><button onClick={findReprintBills} className="rounded-xl bg-violet-600 px-4 font-bold text-white">Search</button></div><div className="max-h-80 space-y-2 overflow-auto">{reprintBills.map(b => <button key={b.id} onClick={() => reprintBill(b.invoice_no)} className="block w-full rounded-xl border p-3 text-left"><strong>{b.invoice_no}</strong> · {b.customer_name || 'Walking Customer'} · {b.date} · {money(b.net_payable)}</button>)}</div><button onClick={() => setReprintOpen(false)} className="font-bold">Close</button></div></div>}
      {customerOpen && <div className="fixed inset-0 z-[2500] grid place-items-center bg-black/50 p-4" onClick={() => setCustomerOpen(false)}>
        <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
          <h2 className="text-lg font-black">Customer details</h2>
          {[['customerName', 'Customer name'], ['mobile', 'Mobile number'], ['customerEmail', 'Email']].map(([key, label]) => <label key={key} className="block text-sm font-bold">{label}<input autoFocus={key === 'customerName'} value={bill[key]} onChange={e => setBill(b => ({ ...b, [key]: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3" /></label>)}
          <button onClick={() => setCustomerOpen(false)} className="w-full rounded-xl bg-violet-600 p-3 font-bold text-white">Done</button>
        </div>
      </div>}

      {/* One-time per-machine naming — HQ gives a store one shared login
          used across several physical POS terminals there, so the login
          can't tell them apart. This name lives only in this device's own
          storage and is asked once per machine, never per login. */}
      {terminalNamePrompt && (
        <div className="fixed inset-0 z-[3000] grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-base font-black text-slate-900">Terminal setup</h2>
            <p className="mt-1.5 text-xs text-slate-500">
              {terminalSetupRequired ? "Set up this terminal to continue billing. Your current cart will be kept." : "Give this POS machine a name, such as Counter 1."}
            </p>
            {terminalSetupError && <p role="alert" className="mt-2 text-xs font-bold text-rose-700">{terminalSetupError}</p>}
            <input
              autoFocus
              value={terminalNameDraft}
              onChange={e => setTerminalNameDraft(e.target.value)}
              onKeyDown={e => e.key === "Enter" && confirmTerminalName()}
              placeholder="e.g. Counter 1"
              className="mt-4 h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-emerald-500"
            />
            <button
              onClick={confirmTerminalName}
              disabled={!terminalNameDraft.trim()}
              className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white disabled:opacity-40"
            >
              Save terminal name
            </button>
            <button type="button" onClick={() => { if (lastInputRef.current?.isConnected) { setTouchKeyboardTarget(lastInputRef.current); setTouchKeyboardOpen(true); } }} className="mt-3 w-full rounded-xl border border-violet-200 bg-violet-50 py-2 text-sm font-bold text-violet-700">Open touch keyboard</button>
            <button onClick={() => setTerminalNamePrompt(false)} className="mt-3 w-full rounded-xl border py-2 text-sm font-bold">Close</button>
          </div>
        </div>
      )}

      {/* Held Bills panel — resume or discard any parked cart. */}
      {heldPanelOpen && (
        <div className="fixed inset-0 z-[2500] grid place-items-center bg-black/50 p-4" onClick={() => setHeldPanelOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900">Held Bills</h2>
              <button onClick={() => setHeldPanelOpen(false)} className="text-slate-400 hover:text-slate-700"><FaTimes /></button>
            </div>
            {heldBills.length > 1 && (
              <input autoFocus value={heldFilter} onChange={e => setHeldFilter(e.target.value)} placeholder="Find by name…"
                className="mb-3 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-amber-500" />
            )}
            {heldBills.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Nothing held right now.</p>
            ) : (
              <div className="space-y-2">
                {heldBills.filter(row => !heldFilter.trim() || row.label.toLowerCase().includes(heldFilter.trim().toLowerCase())).map(row => (
                  <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{row.label}</p>
                      <p className="text-[11px] text-slate-500">{row.itemCount} item{row.itemCount === 1 ? "" : "s"} · held {new Date(row.heldAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => resumeHeldBill(row.id)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-black text-white hover:bg-amber-700">Resume</button>
                      <button onClick={() => { if (window.confirm(`Discard held bill "${row.label}"? This cannot be undone.`)) discardHeldBill(row.id); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-500 hover:bg-slate-50">Discard</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Open Shift — replaces a raw window.prompt() with a real modal,
          pre-filled with yesterday's closing cash on this terminal as a
          suggestion (still freely editable). */}
      {openShiftModalOpen && (
        <div className="fixed inset-0 z-[2600] grid place-items-center bg-black/50 p-4" onClick={() => !shiftBusy && setOpenShiftModalOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900">Open Shift</h2>
              <button onClick={() => setOpenShiftModalOpen(false)} className="text-slate-400 hover:text-slate-700"><FaTimes /></button>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              {openingCashHint
                ? `Pre-filled from this terminal's last close (${openingCashHint.closed_at_label}) — change it if the float's different today.`
                : "How much cash is in the drawer right now?"}
            </p>
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Opening cash</label>
            <input
              autoFocus type="number" value={openingCashInput} onChange={e => setOpeningCashInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && confirmOpenShift()}
              disabled={shiftBusy}
              className="mt-1 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-emerald-500 disabled:opacity-60"
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setOpenShiftModalOpen(false)} disabled={shiftBusy}
                className="rounded-xl border border-slate-200 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                Cancel
              </button>
              <button onClick={confirmOpenShift} disabled={shiftBusy}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-60">
                {shiftBusy ? <FaSpinner className="animate-spin" /> : null}
                {shiftBusy ? "Opening…" : "Open Shift"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift */}
      {closeShiftModalOpen && (
        <div className="fixed inset-0 z-[2600] grid place-items-center bg-black/50 p-4" onClick={() => !shiftBusy && setCloseShiftModalOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900">Close Shift</h2>
              <button onClick={() => setCloseShiftModalOpen(false)} className="text-slate-400 hover:text-slate-700"><FaTimes /></button>
            </div>
            <p className="mb-4 text-xs text-slate-500">Expected cash: {money(currentShift?.expected_cash || 0)}. Count the drawer and enter what you actually found.</p>
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Counted cash</label>
            <input
              autoFocus type="number" value={closingCashInput} onChange={e => setClosingCashInput(e.target.value)}
              disabled={shiftBusy}
              className="mt-1 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-emerald-500 disabled:opacity-60"
            />
            <label className="ml-1 mt-3 block text-[10px] font-black uppercase tracking-widest text-slate-500">Closing note (optional)</label>
            <input
              value={closingNotesInput} onChange={e => setClosingNotesInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && confirmCloseShift()}
              disabled={shiftBusy}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-emerald-500 disabled:opacity-60"
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setCloseShiftModalOpen(false)} disabled={shiftBusy}
                className="rounded-xl border border-slate-200 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                Cancel
              </button>
              <button onClick={confirmCloseShift} disabled={shiftBusy}
                className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-rose-700 disabled:opacity-60">
                {shiftBusy ? <FaSpinner className="animate-spin" /> : null}
                {shiftBusy ? "Closing…" : "Close Shift"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Summary (F5) — live, read-only preview of the current
          shift's reconciliation, without closing it. */}
      {drawerSummaryOpen && (
        <div className="fixed inset-0 z-[2500] grid place-items-center bg-black/50 p-4" onClick={() => setDrawerSummaryOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900">Drawer Summary</h2>
              <button onClick={() => setDrawerSummaryOpen(false)} className="text-slate-400 hover:text-slate-700"><FaTimes /></button>
            </div>
            {drawerSummaryLoading ? (
              <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
            ) : !drawerSummaryData ? (
              <p className="py-10 text-center text-sm text-slate-400">No open shift on this terminal.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Terminal</span><span className="font-bold text-slate-900">{drawerSummaryData.terminal_name || "This terminal"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Shift opened</span><span className="font-bold text-slate-900">{drawerSummaryData.opened_at_label}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Opening cash</span><span className="font-bold text-slate-900">{money(drawerSummaryData.opening_cash)}</span></div>
                <div className="my-2 border-t border-dashed border-slate-200" />
                {Object.entries(drawerSummaryData.payment_totals || {}).map(([method, amt]) => (
                  <div key={method} className="flex justify-between"><span className="text-slate-500">{method} sales</span><span className="font-bold text-slate-900">{money(amt)}</span></div>
                ))}
                <div className="flex justify-between"><span className="text-slate-500">Bills this shift</span><span className="font-bold text-slate-900">{drawerSummaryData.bill_count}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Credit notes ({drawerSummaryData.return_count || 0})</span><span className="font-bold text-slate-900">{money(drawerSummaryData.return_total)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-black text-slate-950"><span>Expected cash</span><span>{money(drawerSummaryData.expected_cash)}</span></div>
                <div className="my-2 border-t border-dashed border-slate-200" />
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Counted cash (just to check — not saved)</label>
                <input type="number" value={drawerCountedCash} onChange={e => setDrawerCountedCash(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-emerald-500" />
                {drawerCountedCash !== "" && (
                  <p className={`rounded-xl px-3 py-2 text-xs font-black ${Math.abs(Number(drawerCountedCash) - drawerSummaryData.expected_cash) < 0.01 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {Math.abs(Number(drawerCountedCash) - drawerSummaryData.expected_cash) < 0.01
                      ? "Matches expected cash ✓"
                      : `Mismatch: ${money(Number(drawerCountedCash) - drawerSummaryData.expected_cash)}`}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active exchange credit — shown until it's spent on a bill or cancelled. */}
      {exchangeCredit && !isReturn && (
        <div className="border-b border-amber-300 bg-amber-100 px-4 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-amber-900">
              <FaExchangeAlt className="mr-1.5 inline" />
              Exchange credit of {money(exchangeCredit.amount)} ready (from {exchangeCredit.againstInvoice}) — add items, it'll be applied at payment.
            </p>
            <button onClick={cancelExchangeCredit} className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-black text-amber-800 hover:bg-amber-50">Cancel</button>
          </div>
        </div>
      )}
      {!exchangeCredit && !isReturn && <div className="px-4 pt-2 sm:px-6"><button onClick={openCreditNoteLookup} className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-2 text-xs font-black text-amber-800">Apply credit note</button></div>}

      {/* Credit note lookup — a dedicated, scan-ready field instead of a
          raw browser prompt(). Auto-focused, and Enter submits it, same as
          a barcode scanner finishing a scan. */}
      {creditNoteModalOpen && (
        <div className="fixed inset-0 z-[2600] grid place-items-center bg-black/50 p-4" onClick={() => !creditNoteBusy && setCreditNoteModalOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900">Apply credit note</h2>
              <button onClick={() => setCreditNoteModalOpen(false)} className="text-slate-400 hover:text-slate-700"><FaTimes /></button>
            </div>
            <p className="mb-4 text-xs text-slate-500">Scan the credit note's barcode, or type its invoice number, then press Enter.</p>
            <div className="relative">
              <FaBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={creditNoteInput}
                onChange={e => setCreditNoteInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitCreditNote()}
                placeholder="Scan or type credit note number"
                disabled={creditNoteBusy}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-bold outline-none focus:border-amber-500 disabled:opacity-60"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setCreditNoteModalOpen(false)} disabled={creditNoteBusy}
                className="rounded-xl border border-slate-200 py-3 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                Cancel
              </button>
              <button onClick={submitCreditNote} disabled={creditNoteBusy || !creditNoteInput.trim()}
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-amber-700 disabled:opacity-40">
                {creditNoteBusy ? <FaSpinner className="animate-spin" /> : null}
                {creditNoteBusy ? "Checking…" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent, proactive connectivity banner — unlike the reactive
          "offline cache" toasts elsewhere, this appears the instant a
          background reachability ping to the server fails, whether that's
          a real network drop or just the server itself being unreachable,
          without the cashier having to attempt a scan/bill first. */}
      {!serverReachable && (
        <div className="border-b border-rose-300 bg-rose-600 px-4 py-2 sm:px-6">
          <p className="text-center text-xs font-black text-white">
            <FaWifi className="mr-1.5 inline" />
            No connection to the server — billing will save on this device and sync automatically once it's back.
          </p>
        </div>
      )}

      {/* Recovered draft cart — shown when a previous session left an
          unsaved in-progress bill behind (tab freeze/crash/accidental close). */}
      {draftPrompt && (
        <div className="border-b border-amber-300 bg-amber-100 px-4 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-amber-900">
              <FaExclamationTriangle className="mr-1.5 inline" />
              Found an unsaved cart from earlier ({draftPrompt.items?.length || 0} item{draftPrompt.items?.length === 1 ? "" : "s"}). Restore it?
            </p>
            <div className="flex gap-2">
              <button onClick={restoreDraftCart} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-black text-white hover:bg-amber-700">Restore</button>
              <button onClick={discardDraftCart} className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-black text-amber-800 hover:bg-amber-50">Discard</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice lookup modal */}
      <InvoiceLookupModal
        open={invoiceLookup}
        onClose={() => setInvoiceLookup(false)}
        onLoadItems={handleLoadReturnItems}
      />

      {/* Step-by-step POS guide */}
      <CashierGuideModal
        open={showGuide}
        onClose={() => setShowGuide(false)}
        title="How to use the POS"
        subtitle="Step-by-step guide for the billing counter"
        steps={POS_GUIDE_STEPS}
        notes={POS_GUIDE_NOTES}
      />

      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-black tracking-tight">RMS POS</h1>
              <p className="text-[11px] font-semibold text-slate-400">Barcode billing terminal · Live inventory</p>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              title="How to use the POS"
              className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100"
            >
              <FaQuestionCircle size={13} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => { setMode("sale"); clearAll(); }}
              className={`cursor-pointer rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest ${mode === "sale" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              Sale
            </button>

            {/* Return mode — opens invoice lookup */}
            <button onClick={() => { if (!isReturn && exchangeCredit && !items.length) { showToast("Add items and hold this credit-note sale before starting a return.", "error"); return; } if (!isReturn && items.length) holdCurrentBill(); setMode("return"); clearAll(); setInvoiceLookup(true); }}
              className={`cursor-pointer rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest ${mode === "return" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              Return
            </button>

            {/* If in return mode and have original invoice, show lookup button again */}
            {isReturn && (
              <button onClick={() => setInvoiceLookup(true)}
                className="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center gap-2">
                <FaFileInvoice size={11} />
                {originalInvoice ? originalInvoice : "Load Invoice"}
              </button>
            )}

            <button
              type="button"
              onClick={currentShift ? closeShift : openShift}
              disabled={shiftBusy}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-widest disabled:opacity-60 ${currentShift ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
              title={currentShift ? `${getTerminalName() || "This terminal"} — opened ${currentShift.opened_at_label || "today"}` : `Open shift for ${getTerminalName() || "this terminal"}`}
            >
              {shiftBusy ? <FaSpinner className="animate-spin" /> : <FaCheckCircle size={12} />}
              {currentShift ? `Close shift${getTerminalName() ? ` (${getTerminalName()})` : ""}` : "Open shift"}
            </button>

            {(pendingOfflineCount > 0 || failedOfflineCount > 0) && (
              <button
                type="button"
                onClick={syncOfflineBills}
                disabled={syncingOffline}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                title={`${pendingOfflineCount} pending, ${failedOfflineCount} failed, ${syncedOfflineCount} synced locally`}
              >
                {syncingOffline ? <FaSpinner className="animate-spin" /> : <FaExclamationTriangle size={12} />}
                Offline {pendingOfflineCount} pending / {failedOfflineCount} failed
              </button>
            )}

            {(pendingOfflineCount > 0 || failedOfflineCount > 0) && (
              <button
                type="button"
                onClick={exportOfflineBillsBackup}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                title="Download the unsynced bills as a backup file, in case this device is reset before they sync"
              >
                Export backup
              </button>
            )}

            <button
              type="button"
              onClick={() => refreshProductCache(false)}
              disabled={cacheRefreshing}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
              title={productCache.cachedAt ? `Last cached ${new Date(productCache.cachedAt).toLocaleString("en-IN")}` : "No product cache yet"}
            >
              {cacheRefreshing ? <FaSpinner className="animate-spin" /> : <FaBarcode size={12} />}
              Offline products {cachedProductCount ? `(${cachedProductCount})` : ""}
            </button>

            {!isReturn && (
              <button type="button" disabled={!items.length} onClick={holdCurrentBill}
                title="Park this cart and start the next customer — resume it later from Held Bills"
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-widest ${!items.length ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300" : "cursor-pointer border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"}`}>
                <FaClock size={12} /> Hold
              </button>
            )}

            {heldBills.length > 0 && (
              <button type="button" onClick={() => setHeldPanelOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-100 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-amber-800 hover:bg-amber-200"
                title={`${heldBills.length} held bill(s) waiting to be resumed`}>
                <FaClock size={12} /> Held ({heldBills.length})
              </button>
            )}

            <button disabled={!items.length} onClick={() => { if (requireTerminal()) setBillOpen(true); }}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest ${
                !items.length
                  ? "cursor-not-allowed bg-slate-100 text-slate-300"
                  : isReturn
                    ? "cursor-pointer bg-rose-600 text-white hover:bg-rose-700"
                    : "cursor-pointer bg-violet-600 text-white hover:bg-violet-700"
              }`}>
              <FaCreditCard /> {isReturn ? "Return Bill" : "Generate Bill"}
            </button>
          </div>
        </div>
      </header>

      {/* Scan / Search — hidden in return mode (items come from invoice) */}
      {!isReturn && (
        <section className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="relative">
              <FaBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input ref={barcodeRef} value={barcode} onChange={e => setBarcode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && scanBarcode()}
                placeholder="Scan barcode - auto-adds after scan"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-20 text-sm font-bold outline-none focus:border-violet-500" />
              <button onClick={scanBarcode} disabled={scanning || !barcode.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-violet-600 px-3 py-1.5 text-[10px] font-black uppercase text-white disabled:opacity-40">
                {scanning ? <FaSpinner className="animate-spin" /> : "Add"}
              </button>
            </div>
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              {searching && <FaSpinner className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-violet-500" />}
              <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by product name or barcode"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-10 text-sm font-bold outline-none focus:border-violet-500" />
              {searchRes.length > 0 && (
                <div className="absolute left-0 right-0 top-14 z-50 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                  {searchRes.map(p => (
                    <button key={p._id} onClick={() => addProduct(p)}
                      className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-slate-100">
                      <div>
                        <p className="text-sm font-black">{p.name}</p>
                        <p className="text-[11px] font-bold text-slate-400">
                          {p.barcode} · HSN {p.hsn || "—"}
                          {p.stock !== null && <span className={`ml-2 ${p.stock <= 0 ? "text-rose-500" : p.stock <= 20 ? "text-amber-500" : "text-emerald-600"}`}>Stock: {p.stock}</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-violet-600">{money(p.price)}</p>
                        {p.gst > 0 && <p className="text-[10px] text-slate-400">GST {p.gst}%</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="mt-2 text-[11px] font-bold text-slate-500">
            Scanner tip: RMS adds the item on Enter. If your scanner does not send Enter, it auto-adds after a short pause on barcode-like input.
          </p>
        </section>
      )}

      {/* Return mode banner */}
      {isReturn && (
        <section className="border-b border-rose-200 bg-rose-50 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaFileInvoice className="text-rose-600" />
              <div>
                <p className="text-sm font-black text-rose-800">Return Mode</p>
                <p className="text-[11px] text-rose-500">
                  {originalInvoice
                    ? `Items loaded from invoice ${originalInvoice}`
                    : "No invoice loaded — click Load Invoice in header"}
                </p>
              </div>
            </div>
            <button onClick={() => setInvoiceLookup(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black uppercase tracking-widest hover:bg-rose-700">
              {originalInvoice ? "Change Invoice" : "Load Invoice"}
            </button>
          </div>
        </section>
      )}

      {/* Cart */}
      <main className="p-4 sm:p-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-600">
                {isReturn ? "Items to Return" : "Scanned Products"}
              </h2>
              <p className="text-[11px] font-semibold text-slate-400">
                {isReturn
                  ? originalInvoice ? `From invoice ${originalInvoice}` : "Load an invoice to populate items"
                  : "Product auto-fills from your product catalogue"}
              </p>
            </div>
            <div className="rounded-xl bg-white px-4 py-2 text-right shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">
                {isReturn ? "Credit Note Total" : "Current Total"}
              </p>
              <p className={`text-lg font-black ${isReturn ? "text-rose-600" : "text-violet-600"}`}>{money(summary.netPayable)}</p>
            </div>
          </div>

          {!items.length ? (
            <div className="flex h-[330px] flex-col items-center justify-center text-center text-slate-300">
              {isReturn ? <FaFileInvoice size={46} /> : <FaBarcode size={46} />}
              <p className="mt-3 text-xs font-black uppercase tracking-widest">
                {isReturn ? "Load an invoice to start return" : "Scan product to show here"}
              </p>
              {isReturn && (
                <button onClick={() => setInvoiceLookup(true)}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black uppercase tracking-widest hover:bg-rose-700">
                  Load Invoice
                </button>
              )}
            </div>
          ) : (
            <div ref={scrollRef} className="max-h-[500px] overflow-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-white">
                    {["Product","Qty","Rate","Tax (GST)","Amount (Inc GST)","Action"].map((h, i) => (
                      <th key={h} className={`px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-400 ${i >= 1 ? "text-center" : "text-left"} ${i >= 4 ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    
                    return (
                      <tr key={item._id} className={`border-b border-slate-100 last:border-b-0 hover:bg-slate-50 ${isReturn ? "bg-rose-50/30" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-900">{item.name}</p>
                          <p className="text-[11px] font-semibold text-slate-400">{item.barcode} · HSN {item.hsn || "—"} · {item.sku || ""}</p>
                          {item.stock !== null && item.stock !== undefined && (
                            <p className={`text-[10px] font-bold ${item.stock <= 0 ? "text-rose-500" : item.stock <= 20 ? "text-amber-500" : "text-emerald-600"}`}>
                              Stock: {item.stock}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => updateQty(item._id, isReturn ? 1 : -1)}
                              className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100">
                              <FaMinus size={8} />
                            </button>
                            <span className="w-8 text-center font-black">{Math.abs(item.qty)}</span>
                            <button onClick={() => updateQty(item._id, isReturn ? -1 : 1)}
                              className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100">
                              <FaPlus size={8} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-900">{money(item.price)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-black ${isReturn ? "bg-rose-50 text-rose-600" : "bg-violet-50 text-violet-600"}`}>
                            {item.gst || 0}%
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-black ${isReturn ? "text-rose-600" : "text-violet-600"}`}>
                         <p className="text-base">{money(Math.abs(item.total))}</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase">Total (Inc. GST)</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => setItems(prev => prev.filter(i => i._id !== item._id))}
                            className="cursor-pointer rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-black uppercase text-rose-600 hover:bg-rose-100">
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <ManualOfflineItemModal
        open={manualOfflineOpen}
        barcode={manualOfflineBarcode}
        onClose={() => setManualOfflineOpen(false)}
        onAdd={addManualOfflineItem}
      />

      <GenerateBillPopup
        ref={generateBillRef}
        open={billOpen} isReturn={isReturn} items={items}
        bill={bill} setBill={setBill} summary={summary}
        onClose={() => setBillOpen(false)} onFinalize={finalizeBill}
        onSaveOffline={saveOfflineBill}
        saving={saving} originalInvoice={originalInvoice}
        exchangeCredit={exchangeCredit}
      />
      <ReceiptModal
        open={receiptOpen} receipt={receipt} onClose={() => setReceiptOpen(false)} onStartExchange={startExchange}
        autoPrint={pendingAutoPrint} onAutoPrinted={() => setPendingAutoPrint(false)}
      />
    </div>
  );
}
