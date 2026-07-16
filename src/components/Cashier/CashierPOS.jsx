
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  FaBarcode, FaSearch, FaPlus, FaMinus, FaTrash,
  FaCreditCard, FaTimes, FaPrint, FaSpinner,
  FaFileInvoice, FaCheckCircle, FaExclamationTriangle,
} from "react-icons/fa";

import { CASHIER_API_BASE as API_BASE, cashierFetch } from "./cashierApi";

function money(v)  { return `₹${Math.abs(Number(v || 0)).toFixed(2)}`; }
function num(v)    { return Math.abs(Number(v || 0)).toFixed(2); }


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
      if (bill.already_returned) {
        setError(`Already returned against invoice ${bill.return_invoice}. Cannot return again.`);
        return;
      }
      setFoundBill(bill);
      // Default: select all items at their full qty
      const sel = {};
      bill.items.forEach(item => { sel[item.barcode] = item.qty; });
      setSelected(sel);
    } catch { setError("Network error. Check backend."); }
    finally { setLoading(false); }
  };

  const handleConfirm = () => {
    if (!foundBill) return;
    const returnItems = foundBill.items
      .filter(item => (selected[item.barcode] || 0) > 0)
      .map(item => ({
        _id:          item.barcode + "_ret",
        barcode:      item.barcode,
        name:         item.name,
        hsn:          item.hsn,
        sku:          item.sku,
        price:        item.price,
        mrp:          item.mrp || item.price,
        cost_price:   item.cost_price || 0,
        gst:          item.gst,
        itemDiscount: item.itemDiscount || 0,
        stock:        null,
        qty:          -(selected[item.barcode]),           // negative for return
        total:        -(selected[item.barcode] * item.price),
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
                        onChange={e => setSelected(s => ({ ...s, [item.barcode]: e.target.checked ? item.qty : 0 }))}
                        className="w-4 h-4 accent-rose-600 shrink-0"
                      />
                      {/* Product info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{item.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{item.barcode} · HSN {item.hsn || "—"}</p>
                      </div>
                      {/* Original qty & price */}
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-500">Bought: {item.qty} × ₹{num(item.price)}</p>
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
                            onClick={() => setSelected(s => ({ ...s, [item.barcode]: Math.min(item.qty, selQty + 1) }))}
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
                  <span className="text-xs font-black uppercase tracking-widest">Refund Total</span>
                  <span className="text-xl font-black">
                    ₹{num(
                      foundBill.items.reduce((s, item) => s + (selected[item.barcode] || 0) * item.price, 0)
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

/* ─── Generate Bill Popup ─── */
function GenerateBillPopup({ open, isReturn, items, bill, setBill, summary, onClose, onFinalize, saving, originalInvoice }) {
  const [paid, setPaid] = useState("");

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "auto";
    if (!open) setPaid("");
    return () => { document.body.style.overflow = "auto"; };
  }, [open]);

  if (!open) return null;

  const payable = Math.abs(summary.netPayable);
  const change  = Number(paid) > payable ? Number(paid) - payable : 0;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-3">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">{isReturn ? "Generate Return Bill" : "Generate Bill"}</h2>
            {isReturn && originalInvoice && (
              <p className="text-xs font-semibold text-rose-500 mt-0.5">Against Invoice: {originalInvoice}</p>
            )}
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-xl bg-slate-100 p-3 hover:bg-slate-200"><FaTimes size={13} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className={`relative mb-6 overflow-hidden rounded-3xl p-6 text-white shadow-lg ${isReturn ? "bg-gradient-to-br from-rose-600 to-rose-700" : "bg-gradient-to-br from-violet-600 to-violet-700"}`}>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">{isReturn ? "Refund Total" : "Net Payable Amount"}</p>
              <h1 className="mt-2 text-5xl font-black tracking-tight">{money(summary.netPayable)}</h1>
            </div>
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Customer details */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-black">Customer Details</h3>
              <div className="space-y-3">
                {[
                  { label: "Cashier Name",  key: "cashierName" },
                  { label: "Customer Name", key: "customerName" },
                  { label: "Mobile Number", key: "mobile" },
                ].map(({ label, key }) => (
                  <div key={key} className="space-y-1">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-black">{label}</label>
                    <input value={bill[key]} onChange={e => setBill({ ...bill, [key]: e.target.value })}
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
                <div className="space-y-1">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-black">Additional Disc. %</label>
                  <input type="number" value={bill.discount} onChange={e => setBill({ ...bill, discount: e.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-violet-500" />
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

            {/* Payment method */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                <div className="mt-3 space-y-1">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-black">Customer Paid</label>
                  <input type="number" value={paid} onChange={e => setPaid(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-violet-500" />
                  {change > 0 && <p className="mt-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-600">Change Return: ₹{change.toFixed(2)}</p>}
                </div>
              )}
            </div>

            {/* Bill summary */}
            <div className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-violet-600">Bill Summary</h3>
              <div className="space-y-2.5 text-sm font-bold text-slate-600">
                {[
                  ["Items",                      items.length,                                                "slate"],
                  ["Total Sale",                 money(summary.totalSale),                                   "slate"],
                  ["Offer",                      `- ${money(bill.appliedOffer || 0)}`,                       "emerald"],
                  [`Discount (${bill.discount||0}%)`, `- ${money(summary.totalSavings - (bill.appliedOffer||0))}`, "emerald"],
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
                  <span className="uppercase">{isReturn ? "Refund Total" : "Net Payable"}</span>
                  <span>{money(summary.netPayable)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white p-5">
          <button onClick={() => {
            if (bill.paymentMethod === "Cash" && !isReturn && (!paid || Number(paid) < payable)) return alert("Insufficient paid amount");
            onFinalize(Number(paid || 0), change);
          }} disabled={saving}
            className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60 ${isReturn ? "bg-rose-600" : "bg-violet-600"}`}>
            {saving ? <FaSpinner className="animate-spin" /> : <FaPrint />}
            {saving ? "Saving…" : isReturn ? "Finalize Return Bill" : "Finalize Bill"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Receipt Modal ─── */
function ReceiptModal({ open, receipt, onClose }) {
  if (!open || !receipt) return null;
  const isReturn = receipt.isReturn;
  const s = receipt.summary;

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

    const wordsStr = numToWords(Number(totalQty)) + " Items Only";


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
    <tr><td>${receipt.paymentMethod}</td><td class="val">${num(s.netPayable)}</td></tr>
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
      <td>${isReturn ? "REFUND AMOUNT :" : "NET PAYABLE :"}</td>
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3">
      <div className="w-full max-w-[400px] overflow-hidden rounded-3xl bg-white shadow-2xl">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-black text-slate-900">
            {isReturn ? "Credit Note" : "Tax Invoice"}
          </h2>
          <button onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 hover:bg-slate-200">
            <FaTimes size={13} />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-4">

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
              {receipt.originalInvoice && <p>Against: {receipt.originalInvoice}</p>}
              <div className="flex justify-between">
                <span>Date: {receipt.date}</span>
                <span>Cashier: {receipt.cashierName || "N/A"}</span>
              </div>
              <p>Customer: {receipt.customerName || "Walking Customer"}</p>
              <p>Mobile: {receipt.mobile || "N/A"}</p>
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
              <div className="flex justify-between">
                <span>{receipt.paymentMethod}</span>
                <span>{num(s.netPayable)}</span>
              </div>
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
                <span>{isReturn ? "Refund Amount :" : "Net Payable :"}</span>
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

          {/* Print Button */}
          <button onClick={handlePrint}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-3 text-[11px] font-black uppercase tracking-widest text-white hover:bg-slate-800">
            <FaPrint /> Print Receipt
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function CashierPOS() {
  const barcodeRef = useRef(null);
  const scrollRef  = useRef(null);

  const [mode,           setMode]           = useState("sale");
  const [items,          setItems]          = useState([]);
  const [barcode,        setBarcode]        = useState("");
  const [search,         setSearch]         = useState("");
  const [searchRes,      setSearchRes]      = useState([]);
  const [searching,      setSearching]      = useState(false);
  const [scanning,       setScanning]       = useState(false);
  const [toast,          setToast]          = useState({ msg: "", type: "default" });
  const [billOpen,       setBillOpen]       = useState(false);
  const [receiptOpen,    setReceiptOpen]    = useState(false);
  const [receipt,        setReceipt]        = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [invoiceLookup,  setInvoiceLookup]  = useState(false);  // ← NEW
  const [originalInvoice,setOriginalInvoice]= useState("");     // ← NEW

  // The cashier name belongs to the authenticated session, never a generic
  // POS default. `admin_name` is written by authRedirect immediately after
  // login and is shared by store cashiers and store owners.
  const [bill, setBill] = useState(() => ({
    cashierName: localStorage.getItem("admin_name") || "Cashier", customerName: "", mobile: "",
    offer: "", appliedOffer: 0, discount: "",
    paymentMethod: "Cash",
  }));

  const isReturn = mode === "return";

  useEffect(() => { barcodeRef.current?.focus(); }, []);
  useEffect(() => {
    if (items.length > 0) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items.length]);

  const showToast = useCallback((msg, type = "default") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "default" }), 1600);
  }, []);

  /* ── Search (debounced) ── */
  useEffect(() => {
    if (!search.trim()) { setSearchRes([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await cashierFetch(`${API_BASE}/cashier/search?q=${encodeURIComponent(search.trim())}`);
        const json = await res.json();
        setSearchRes(json.data || []);
      } catch { setSearchRes([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Barcode scan ── */
  const scanBarcode = useCallback(async () => {
    const bc = barcode.trim();
    if (!bc) return showToast("Enter a barcode", "error");
    setScanning(true);
    try {
      const res  = await cashierFetch(`${API_BASE}/cashier/lookup/${encodeURIComponent(bc)}`);
      if (!res.ok) { showToast("Product not found", "error"); return; }
      const json = await res.json();
      addProduct(json.data);
    } catch { showToast("Network error", "error"); }
    finally { setScanning(false); }
  }, [barcode]); // eslint-disable-line

  const addProduct = useCallback((product) => {
    const qtyDelta = isReturn ? -1 : 1;
    setItems(prev => {
      const exist = prev.find(i => i._id === product._id);
      if (exist) {
        const qty = exist.qty + qtyDelta;
        if (qty === 0) return prev.filter(i => i._id !== product._id);
        return prev.map(i => i._id === product._id ? { ...i, qty, total: qty * i.price } : i);
      }
      return [...prev, { ...product, qty: qtyDelta, total: qtyDelta * product.price }];
    });
    setBarcode(""); setSearch(""); setSearchRes([]);
    showToast(`${product.name} ${isReturn ? "returned" : "added"}`, "success");
    setTimeout(() => barcodeRef.current?.focus(), 40);
  }, [isReturn, showToast]);

  /* ── Load items from invoice lookup ── */
  const handleLoadReturnItems = useCallback((returnItems, invNo) => {
    setItems(returnItems);
    setOriginalInvoice(invNo);
    showToast(`${returnItems.length} item(s) loaded from ${invNo}`, "success");
  }, [showToast]);

  const updateQty = (id, delta) => {
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
    const additionalDisc = (totalSale * Number(bill.discount || 0)) / 100;
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
    setBill(prev => ({ ...prev, customerName: "", mobile: "", offer: "", appliedOffer: 0, discount: "", paymentMethod: "Cash" }));
  };

  const finalizeBill = useCallback(async (paidAmount = 0, changeReturn = 0) => {
    setSaving(true);
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/bill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isReturn,
          items,
          summary,
          bill,
          paidAmount,
          changeReturn,
          originalInvoice,   
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");

      if (data.inventory_warnings?.length) {
        data.inventory_warnings.forEach(w => showToast(w, "error"));
      }

      setReceipt({
        invoiceNo:       data.invoice_no,
        date:            new Date().toLocaleString("en-IN"),
        cashierName:     bill.cashierName,
        customerName:    bill.customerName,
        mobile:          bill.mobile,
        paymentMethod:   bill.paymentMethod,
        paidAmount,
        changeReturn,
        appliedOffer:    bill.appliedOffer,
        discount:        bill.discount,
        originalInvoice,
        items,
        summary,
        isReturn,
      });

      setBillOpen(false);
      setReceiptOpen(true);
      clearAll();
      showToast(isReturn ? "Return bill generated ✓" : "Bill generated ✓", "success");
    } catch (e) {
      showToast(e.message || "Failed to save bill", "error");
    } finally {
      setSaving(false);
    }
  }, [isReturn, items, summary, bill, showToast, originalInvoice]); // eslint-disable-line

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <Toast message={toast.msg} type={toast.type} />

      {/* Invoice lookup modal */}
      <InvoiceLookupModal
        open={invoiceLookup}
        onClose={() => setInvoiceLookup(false)}
        onLoadItems={handleLoadReturnItems}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight">RMS POS</h1>
            <p className="text-[11px] font-semibold text-slate-400">Barcode billing terminal · Live inventory</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => { setMode("sale"); clearAll(); }}
              className={`cursor-pointer rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest ${mode === "sale" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              Sale
            </button>

            {/* Return mode — opens invoice lookup */}
            <button onClick={() => { setMode("return"); clearAll(); setInvoiceLookup(true); }}
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

            <button disabled={!items.length} onClick={() => setBillOpen(true)}
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
        <section className="sticky top-[73px] z-30 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="relative">
              <FaBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input ref={barcodeRef} value={barcode} onChange={e => setBarcode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && scanBarcode()}
                placeholder="Scan barcode and press Enter"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-20 text-sm font-bold outline-none focus:border-violet-500" />
              <button onClick={scanBarcode} disabled={scanning || !barcode.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-violet-600 px-3 py-1.5 text-[10px] font-black uppercase text-white disabled:opacity-40">
                {scanning ? <FaSpinner className="animate-spin" /> : "Add"}
              </button>
            </div>
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              {searching && <FaSpinner className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-violet-500" />}
              <input value={search} onChange={e => setSearch(e.target.value)}
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
        </section>
      )}

      {/* Return mode banner */}
      {isReturn && (
        <section className="sticky top-[73px] z-30 border-b border-rose-200 bg-rose-50 px-4 py-3 sm:px-6">
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
                {isReturn ? "Refund Total" : "Current Total"}
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

      <GenerateBillPopup
        open={billOpen} isReturn={isReturn} items={items}
        bill={bill} setBill={setBill} summary={summary}
        onClose={() => setBillOpen(false)} onFinalize={finalizeBill}
        saving={saving} originalInvoice={originalInvoice}
      />
      <ReceiptModal open={receiptOpen} receipt={receipt} onClose={() => setReceiptOpen(false)} />
    </div>
  );
}
