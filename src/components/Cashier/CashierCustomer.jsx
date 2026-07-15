

import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  FaSearch, FaDownload, FaPrint, FaEye, FaTimes, FaReceipt,
  FaUser, FaPhone, FaCalendarAlt, FaUserTie, FaCreditCard,
  FaBoxes, FaRupeeSign, FaFileInvoice, FaUndo, FaSyncAlt,
  FaChevronDown, FaChevronUp, FaFilter,
} from "react-icons/fa";

import { CASHIER_API_BASE as API_BASE, cashierFetch } from "./cashierApi";

function num(v)   { return Math.abs(Number(v || 0)).toFixed(2); }
function money(v) { return `₹${num(v)}`; }

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
  if (n < 10000000) return numToWords(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + numToWords(n%100000) : "");
  return numToWords(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + numToWords(n%10000000) : "");
}

/* ── KPI Card ── */
function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E4EAF3", padding:"16px 18px", display:"flex", alignItems:"center", gap:14, boxShadow:"0 2px 8px rgba(15,27,45,0.05)" }}>
      <div style={{ width:42, height:42, borderRadius:11, background:color+"18", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <Icon style={{ color, fontSize:18 }} />
      </div>
      <div>
        <div style={{ fontSize:11, color:"#7A8BA4", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
        <div style={{ fontSize:20, fontWeight:800, color:"#0F1B2D", lineHeight:1.2 }}>{value}</div>
        {sub && <div style={{ fontSize:11, color:"#7A8BA4", marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Type Badge ── */
function TypeBadge({ type }) {
  const isReturn = type === "return";
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:5,
      padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700,
      background: isReturn ? "#FFF0EE" : "#E8FAF4",
      color:      isReturn ? "#D93025" : "#0D9974",
      border:     `1px solid ${isReturn ? "#FFCCC9" : "#A0EDD4"}`,
    }}>
      {isReturn ? <FaUndo style={{ fontSize:9 }} /> : <FaReceipt style={{ fontSize:9 }} />}
      {isReturn ? "Return" : "Sale"}
    </span>
  );
}

/* ── Payment Badge ── */
function PayBadge({ method }) {
  const colors = { Cash:"#C97D00", Card:"#1A6FDB", UPI:"#5B5FEF" };
  const bgs    = { Cash:"#FEF8E7", Card:"#EEF5FF", UPI:"#EEEFFE" };
  const color  = colors[method] || "#7A8BA4";
  const bg     = bgs[method]    || "#F1F5F9";
  return (
    <span style={{ padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:700, background:bg, color, border:`1px solid ${color}30` }}>
      {method || "—"}
    </span>
  );
}

/* ── Print thermal receipt ── */
function printBill(bill) {
  const s         = bill.summary || {};
  const isReturn  = bill.type === "return";
  const totalSale = (bill.items || []).reduce((a, i) => a + Number(i.total || 0), 0);
  const totalQty  = (bill.items || []).reduce((a, i) => a + Number(i.qty || 0), 0);

  const rates = [...new Set((bill.items || []).map(i => Number(i.gst_rate || i.gst || 0)))].sort((a, b) => a - b);
  const gstRows = rates.map(rate => {
    const inBkt   = (bill.items || []).filter(i => Number(i.gst_rate || i.gst || 0) === rate);
    const total   = inBkt.reduce((a, i) => a + Number(i.total || 0), 0);
    const share   = totalSale > 0 ? total / totalSale : 0;
    const taxable = (s.taxable_amount || s.taxableAmount || 0) * share;
    const gst     = (taxable * rate) / 100;
    return `<tr>
      <td>GST ${rate}%</td>
      <td class="right">${num(taxable)}</td>
      <td class="right">${num(gst/2)}</td>
      <td class="right">${num(gst/2)}</td>
      <td class="right">0.00</td>
      <td class="right">${num(gst)}</td>
    </tr>`;
  }).join("");

  const itemRows = (bill.items || []).map((item, idx) => `
    <tr>
      <td>${idx+1}</td>
      <td class="bold">${item.name || ""}</td>
      <td class="right">${num(item.qty)}</td>
      <td class="right">${num(item.price)}</td>
      <td class="right">${num(item.item_discount || item.itemDiscount || 0)}</td>
      <td class="right bold">${num(item.total)}</td>
    </tr>
    <tr class="sub">
      <td></td>
      <td class="tiny">${item.barcode || ""}</td>
      <td></td>
      <td class="right tiny">${item.hsn || "—"}</td>
      <td colspan="2"></td>
    </tr>
  `).join("");

  const netPayable = s.net_payable || s.netPayable || 0;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>${isReturn ? "Credit Note" : "Tax Invoice"} - ${bill.invoice_no}</title>
<style>
  @page { size: 80mm auto; margin: 4mm 3mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 74mm; background: #fff; color: #000; font-family: 'Courier New', monospace; font-size: 10pt; line-height: 1.35; }
  .center { text-align: center; } .right { text-align: right; }
  .bold { font-weight: bold; } .tiny { font-size: 8pt; }
  .store { font-size: 15pt; font-weight: 900; letter-spacing: 1px; }
  .dash { border: none; border-top: 1px dashed #000; margin: 3mm 0; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th, td { padding: 1px; vertical-align: top; }
  th { font-weight: bold; border-bottom: 1px dashed #000; padding-bottom: 2px; }
  tr.sub td { font-size: 8pt; color: #555; padding-bottom: 2px; }
  tfoot tr { border-top: 1px dashed #000; font-weight: bold; }
  .summary { width: 100%; font-size: 9.5pt; }
  .summary td { padding: 0.5px 0; }
  .val { text-align: right; }
  .net-row td { font-size: 12pt; font-weight: 900; border-top: 1px solid #000; padding-top: 3px; }
  .thankyou { text-align: center; font-weight: bold; margin: 3mm 0 1mm; }
  .barcode-text { text-align: center; font-size: 9pt; letter-spacing: 3px; margin-top: 3mm; }
</style></head><body>
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
  <table class="summary">
    <tr><td colspan="2"><span class="bold">Invoice No:</span> ${bill.invoice_no}</td></tr>
    ${bill.original_invoice ? `<tr><td colspan="2"><span class="bold">Against:</span> ${bill.original_invoice}</td></tr>` : ""}
    <tr><td>Date: ${bill.date || ""}</td><td class="val">Cashier: ${bill.cashier_name || "N/A"}</td></tr>
    <tr><td colspan="2">Customer: ${bill.customer_name || "Walking Customer"}</td></tr>
    <tr><td colspan="2">Mobile: ${bill.mobile || "N/A"}</td></tr>
  </table>
  <hr class="dash"/>
  <table>
    <thead>
      <tr><th style="width:14px">#</th><th>Product</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Disc</th><th class="right">Amt</th></tr>
      <tr><th></th><th>Barcode</th><th></th><th class="right">HSN</th><th colspan="2"></th></tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr><td></td><td class="bold">Total Qty: ${totalQty}</td><td colspan="3"></td><td class="right bold">${num(totalSale)}</td></tr>
    </tfoot>
  </table>
  <hr class="dash"/>
  <table class="summary">
    <tr><td>Total Sale :</td><td class="val">${num(s.total_sale || s.totalSale || 0)}</td></tr>
    <tr><td>Total Savings :</td><td class="val">- ${num(s.total_savings || s.totalSavings || 0)}</td></tr>
    <tr><td>Taxable Amount :</td><td class="val">${num(s.taxable_amount || s.taxableAmount || 0)}</td></tr>
    <tr><td>CGST :</td><td class="val">${num(s.cgst_amount || s.cgstAmount || 0)}</td></tr>
    <tr><td>SGST :</td><td class="val">${num(s.sgst_amount || s.sgstAmount || 0)}</td></tr>
    <tr><td>Total GST :</td><td class="val">${num(s.total_gst || s.totalGstAmount || 0)}</td></tr>
    <tr><td>Round Off :</td><td class="val">${num(s.round_off || s.roundOff || 0)}</td></tr>
  </table>
  <table class="summary">
    <tr class="net-row">
      <td>${isReturn ? "REFUND AMOUNT :" : "NET PAYABLE :"}</td>
      <td class="val">${num(netPayable)}</td>
    </tr>
  </table>
  <p style="font-size:8pt;font-style:italic;margin-top:2px">${numToWords(Math.round(netPayable))} Rupees Only</p>
  <hr class="dash"/>
  <p class="bold" style="margin-bottom:2px">GST Summary</p>
  <table style="font-size:8pt">
    <thead>
      <tr><th>Description</th><th class="right">Taxable</th><th class="right">CGST</th><th class="right">SGST</th><th class="right">IGST</th><th class="right">Amount</th></tr>
    </thead>
    <tbody>${gstRows}</tbody>
    <tfoot>
      <tr>
        <td class="bold">Totals:</td>
        <td class="right bold">${num(s.taxable_amount || 0)}</td>
        <td class="right bold">${num(s.cgst_amount || 0)}</td>
        <td class="right bold">${num(s.sgst_amount || 0)}</td>
        <td class="right bold">0.00</td>
        <td class="right bold">${num(s.total_gst || 0)}</td>
      </tr>
    </tfoot>
  </table>
  <hr class="dash"/>
  <p class="thankyou">*** THANK YOU. PLEASE VISIT AGAIN ***</p>
  <p class="barcode-text">* ${bill.invoice_no} *</p>
  <script>window.onload = function() { window.print(); };</script>
</body></html>`;

  const win = window.open("", "_blank", "width=400,height=800");
  win.document.write(html);
  win.document.close();
}

/* ── Bill Detail Modal ── */
function BillDetailModal({ bill, onClose, onPrint }) {
  if (!bill) return null;
  const s        = bill.summary || {};
  const isReturn = bill.type === "return";
  const netPayable = s.net_payable || s.netPayable || 0;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(10,14,22,0.65)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#fff", borderRadius:20, width:"100%", maxWidth:780,
        maxHeight:"90vh", display:"flex", flexDirection:"column",
        boxShadow:"0 32px 80px rgba(10,14,22,0.28)", overflow:"hidden",
      }}>
        {/* Header */}
        <div style={{
          flexShrink:0, padding:"18px 22px", borderBottom:"1px solid #F1F5F9",
          background: isReturn ? "linear-gradient(135deg,#FFF0EE,#fff)" : "linear-gradient(135deg,#F0FDF4,#fff)",
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:12, background: isReturn?"#FFCCC9":"#A0EDD4", display:"flex", alignItems:"center", justifyContent:"center" }}>
              {isReturn ? <FaUndo style={{ color:"#D93025", fontSize:18 }} /> : <FaFileInvoice style={{ color:"#0D9974", fontSize:18 }} />}
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:"#0F1B2D" }}>{bill.invoice_no}</div>
              <div style={{ fontSize:12, color:"#7A8BA4", display:"flex", gap:10, flexWrap:"wrap", marginTop:2 }}>
                <span><FaCalendarAlt style={{ marginRight:4, fontSize:10 }} />{bill.date}</span>
                <TypeBadge type={bill.type} />
                <PayBadge method={bill.payment_method} />
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => onPrint(bill)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:10, border:"none", background:"#0F1B2D", color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}>
              <FaPrint /> Print
            </button>
            <button onClick={onClose}
              style={{ width:36, height:36, borderRadius:9, border:"1px solid #E4EAF3", background:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#7A8BA4" }}>
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px 22px" }}>

          {/* Customer + Bill Info */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:18 }}>
            {/* Customer */}
            <div style={{ background:"#F8FAFD", borderRadius:12, padding:"14px 16px", border:"1px solid #E4EAF3" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#7A8BA4", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Customer Details</div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <FaUser style={{ color:"#5B5FEF", fontSize:12, flexShrink:0 }} />
                  <span style={{ fontSize:13, fontWeight:700, color:"#0F1B2D" }}>{bill.customer_name || "Walking Customer"}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <FaPhone style={{ color:"#5B5FEF", fontSize:12, flexShrink:0 }} />
                  <span style={{ fontSize:13, color:"#4A5168" }}>{bill.mobile || "—"}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <FaUserTie style={{ color:"#5B5FEF", fontSize:12, flexShrink:0 }} />
                  <span style={{ fontSize:13, color:"#4A5168" }}>Cashier: {bill.cashier_name || "—"}</span>
                </div>
                {bill.original_invoice && (
                  <div style={{ fontSize:11, color:"#D93025", fontWeight:600, marginTop:2 }}>
                    Against: {bill.original_invoice}
                  </div>
                )}
              </div>
            </div>

            {/* Bill Summary */}
            <div style={{ background:"#F8FAFD", borderRadius:12, padding:"14px 16px", border:"1px solid #E4EAF3" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#7A8BA4", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Bill Summary</div>
              <div style={{ display:"flex", flexDirection:"column", gap:4, fontSize:12 }}>
                {[
                  ["Total Sale",     money(s.total_sale || s.totalSale || 0),      "#0F1B2D"],
                  ["Total Savings",  `- ${money(s.total_savings || s.totalSavings || 0)}`, "#0D9974"],
                  ["Taxable Amt",    money(s.taxable_amount || s.taxableAmount || 0), "#4A5168"],
                  ["CGST",           money(s.cgst_amount || s.cgstAmount || 0),     "#4A5168"],
                  ["SGST",           money(s.sgst_amount || s.sgstAmount || 0),     "#4A5168"],
                  ["Total GST",      money(s.total_gst || s.totalGstAmount || 0),   "#4A5168"],
                  ["Round Off",      money(s.round_off || s.roundOff || 0),         "#7A8BA4"],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ color:"#7A8BA4" }}>{label}</span>
                    <span style={{ fontWeight:600, color }}>{val}</span>
                  </div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", borderTop:"1.5px solid #E4EAF3", paddingTop:6, marginTop:4 }}>
                  <span style={{ fontSize:13, fontWeight:800, color:"#0F1B2D" }}>{isReturn ? "Refund Total" : "Net Payable"}</span>
                  <span style={{ fontSize:15, fontWeight:900, color: isReturn?"#D93025":"#5B5FEF" }}>{money(netPayable)}</span>
                </div>
                <div style={{ fontSize:10, fontStyle:"italic", color:"#7A8BA4" }}>
                  {numToWords(Math.round(netPayable))} Rupees Only
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div style={{ fontSize:10, fontWeight:700, color:"#7A8BA4", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
            Items ({(bill.items || []).length})
          </div>
          <div style={{ borderRadius:12, overflow:"hidden", border:"1px solid #E4EAF3" }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", minWidth:620, borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"#0F1B2D" }}>
                    {["#","Barcode","Product","SKU","Qty","Rate","Disc","GST%","Total"].map(h => (
                      <th key={h} style={{ padding:"9px 10px", textAlign: h==="Total"||h==="Rate"||h==="Disc"||h==="GST%"||h==="Qty" ? "right" : "left", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:"rgba(255,255,255,0.82)", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(bill.items || []).map((item, i) => (
                    <tr key={i} style={{ borderBottom:"1px solid #F1F5F9", background: i%2===0?"#fff":"#FAFBFF" }}>
                      <td style={{ padding:"9px 10px", color:"#7A8BA4", fontSize:11 }}>{i+1}</td>
                      <td style={{ padding:"9px 10px", fontFamily:"monospace", fontSize:11, color:"#4A5168" }}>{item.barcode || "—"}</td>
                      <td style={{ padding:"9px 10px", fontWeight:700, color:"#0F1B2D", maxWidth:180 }}>
                        <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name || "—"}</div>
                        {item.hsn && <div style={{ fontSize:10, color:"#7A8BA4", marginTop:1 }}>HSN: {item.hsn}</div>}
                      </td>
                      <td style={{ padding:"9px 10px", fontFamily:"monospace", fontSize:11, color:"#5B5FEF" }}>{item.sku || "—"}</td>
                      <td style={{ padding:"9px 10px", textAlign:"right", fontWeight:700, color:"#0F1B2D" }}>{item.qty}</td>
                      <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"monospace", color:"#4A5168" }}>{money(item.price)}</td>
                      <td style={{ padding:"9px 10px", textAlign:"right", color:"#0D9974", fontFamily:"monospace" }}>{item.item_discount || item.itemDiscount ? money(item.item_discount || item.itemDiscount) : "—"}</td>
                      <td style={{ padding:"9px 10px", textAlign:"right" }}>
                        <span style={{ background:"#EEEFFE", borderRadius:6, padding:"2px 7px", fontSize:11, fontWeight:700, color:"#5B5FEF" }}>{item.gst_rate || item.gst || 0}%</span>
                      </td>
                      <td style={{ padding:"9px 10px", textAlign:"right", fontWeight:800, fontSize:13, color: isReturn?"#D93025":"#0F1B2D" }}>{money(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:"#F8FAFD", borderTop:"2px solid #E4EAF3" }}>
                    <td colSpan={4} style={{ padding:"10px 10px", fontWeight:700, fontSize:12, color:"#4A5168" }}>
                      Total — {(bill.items||[]).reduce((a,i)=>a+Number(i.qty||0),0)} items
                    </td>
                    <td colSpan={4} />
                    <td style={{ padding:"10px 10px", textAlign:"right", fontWeight:900, fontSize:14, color: isReturn?"#D93025":"#5B5FEF" }}>
                      {money(netPayable)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ MAIN ══════════════════════════════════════ */
export default function CashierCustomer() {
  const today = new Date().toISOString().split("T")[0];

  const [bills,      setBills]      = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [detailBill, setDetailBill] = useState(null);
  const [expanded,   setExpanded]   = useState(new Set());

  // Filters
  const [fromDate,   setFromDate]   = useState(today);
  const [toDate,     setToDate]     = useState(today);
  const [typeFilter, setTypeFilter] = useState("all");
  const [payFilter,  setPayFilter]  = useState("all");
  const [search,     setSearch]     = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (fromDate)             params.set("from_date", fromDate);
      if (toDate)               params.set("to_date",   toDate);
      if (typeFilter !== "all") params.set("type",      typeFilter);
      if (payFilter  !== "all") params.set("payment_method", payFilter);
      if (search.trim())        params.set("search",    search.trim());
      params.set("limit", "500");

      const res  = await cashierFetch(`${API_BASE}/cashier/reports?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to load");
      setBills(json.data || []);
      setStats(json.stats || null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [fromDate, toDate, typeFilter, payFilter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Load full bill detail ── */
  const openDetail = useCallback(async (invoiceNo) => {
    try {
      const res  = await cashierFetch(`${API_BASE}/cashier/bill/${encodeURIComponent(invoiceNo)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Not found");
      setDetailBill(json.data);
    } catch (e) { alert("Could not load bill: " + e.message); }
  }, []);

  /* ── Download Excel ── */
  const downloadExcel = useCallback(() => {
    if (!bills.length) return;

    // Sheet 1: Bills summary
    const billRows = bills.map(b => ({
      "Invoice No":      b.invoice_no,
      "Type":            b.type,
      "Date":            b.date,
      "Customer":        b.customer_name || "Walking Customer",
      "Mobile":          b.mobile || "",
      "Cashier":         b.cashier_name || "",
      "Payment Method":  b.payment_method || "",
      "Items Count":     b.items_count,
      "Total Sale":      b.summary?.total_sale || 0,
      "Total Savings":   b.summary?.total_savings || 0,
      "Taxable Amount":  b.summary?.taxable_amount || 0,
      "CGST":            b.summary?.cgst_amount || 0,
      "SGST":            b.summary?.sgst_amount || 0,
      "Total GST":       b.summary?.total_gst || 0,
      "Round Off":       b.summary?.round_off || 0,
      "Net Payable":     b.summary?.net_payable || 0,
      "Original Invoice":b.original_invoice || "",
    }));

    // Sheet 2: Line items
    const lineRows = [];
    bills.forEach(b => {
      (b.items || []).forEach(item => {
        lineRows.push({
          "Invoice No":    b.invoice_no,
          "Type":          b.type,
          "Date":          b.date,
          "Customer":      b.customer_name || "Walking Customer",
          "Mobile":        b.mobile || "",
          "Cashier":       b.cashier_name || "",
          "Payment Method":b.payment_method || "",
          "Barcode":       item.barcode || "",
          "SKU":           item.sku || "",
          "Product Name":  item.name || "",
          "HSN Code":      item.hsn || "",
          "Qty":           item.qty || 0,
          "Rate":          item.price || 0,
          "MRP":           item.mrp || 0,
          "Item Discount": item.item_discount || item.itemDiscount || 0,
          "GST Rate %":    item.gst_rate || item.gst || 0,
          "Taxable":       item.taxable || 0,
          "CGST":          item.cgst || 0,
          "SGST":          item.sgst || 0,
          "Total":         item.total || 0,
          "Division":      item.division || "",
          "Section":       item.section || "",
          "Department":    item.department || "",
        });
      });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(billRows),  "Bills Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lineRows),  "Line Items");
    XLSX.writeFile(wb, `Sales_Report_${fromDate}_to_${toDate}.xlsx`);
  }, [bills, fromDate, toDate]);

  /* ── Toggle inline expand ── */
  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const INP = {
    padding:"8px 12px", borderRadius:9, border:"1.5px solid #E4EAF3",
    fontSize:13, outline:"none", background:"#FAFBFF", fontFamily:"inherit",
  };
  const SEL = { ...INP, cursor:"pointer" };

  return (
    <div style={{ minHeight:"100vh", background:"#F4F7FB", padding:"20px 24px", fontFamily:"'Inter','Plus Jakarta Sans',sans-serif" }}>
      <div style={{ maxWidth:1300, margin:"0 auto" }}>

        {/* Page Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, color:"#0F1B2D", margin:0 }}>Sales & Customer Records</h1>
            <p style={{ fontSize:13, color:"#7A8BA4", margin:"3px 0 0" }}>View, print and download all bills and customer purchase history</p>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={fetchData} disabled={loading}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 18px", borderRadius:10, border:"1.5px solid #E4EAF3", background:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", color:"#4A5168" }}>
              <FaSyncAlt style={{ fontSize:12, animation: loading?"spin 1s linear infinite":undefined }} />
              Refresh
            </button>
            <button onClick={downloadExcel} disabled={!bills.length}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 18px", borderRadius:10, border:"none", background: bills.length?"linear-gradient(135deg,#5B5FEF,#4347CC)":"#E4EAF3", color: bills.length?"#fff":"#7A8BA4", fontSize:13, fontWeight:700, cursor: bills.length?"pointer":"not-allowed" }}>
              <FaDownload /> Download Excel
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        {stats && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12, marginBottom:20 }}>
            <KpiCard icon={FaReceipt}    label="Sale Bills"    value={stats.sale_bills}                           color="#5B5FEF" />
            <KpiCard icon={FaUndo}       label="Returns"       value={stats.return_bills}                         color="#D93025" />
            <KpiCard icon={FaRupeeSign}  label="Gross Revenue" value={money(stats.gross_revenue)}                 color="#0D9974" />
            <KpiCard icon={FaRupeeSign}  label="Net Revenue"   value={money(stats.net_revenue)}  sub="After returns" color="#C97D00" />
            <KpiCard icon={FaBoxes}      label="Items Sold"    value={stats.total_items}                          color="#1A6FDB" />
            <KpiCard icon={FaCreditCard} label="Total GST"     value={money(stats.total_gst)}                     color="#5B5FEF" />
          </div>
        )}

        {/* Filters */}
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E4EAF3", padding:"16px 18px", marginBottom:16, display:"flex", flexWrap:"wrap", gap:12, alignItems:"flex-end" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <FaFilter style={{ color:"#7A8BA4", fontSize:12 }} />
            <span style={{ fontSize:11, fontWeight:700, color:"#7A8BA4", textTransform:"uppercase", letterSpacing:"0.07em" }}>Filters</span>
          </div>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#7A8BA4", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.06em" }}>From Date</div>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={INP} />
          </div>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#7A8BA4", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.06em" }}>To Date</div>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={INP} />
          </div>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#7A8BA4", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.06em" }}>Type</div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={SEL}>
              <option value="all">All</option>
              <option value="sale">Sales Only</option>
              <option value="return">Returns Only</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#7A8BA4", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.06em" }}>Payment</div>
            <select value={payFilter} onChange={e => setPayFilter(e.target.value)} style={SEL}>
              <option value="all">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="UPI">UPI</option>
            </select>
          </div>
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#7A8BA4", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.06em" }}>Search</div>
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"#FAFBFF", border:"1.5px solid #E4EAF3", borderRadius:9, padding:"0 12px" }}>
              <FaSearch style={{ color:"#7A8BA4", fontSize:12, flexShrink:0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Invoice no, customer, mobile…"
                style={{ border:"none", outline:"none", background:"transparent", fontSize:13, padding:"8px 0", width:"100%", fontFamily:"inherit" }} />
              {search && <button onClick={() => setSearch("")} style={{ border:"none", background:"none", cursor:"pointer", color:"#7A8BA4" }}><FaTimes /></button>}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding:"12px 16px", borderRadius:10, background:"#FFF0EE", border:"1px solid #FFCCC9", color:"#D93025", fontSize:13, marginBottom:12 }}>
            ⚠ {error}
          </div>
        )}

        {/* Bills Table */}
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E4EAF3", overflow:"hidden", boxShadow:"0 2px 12px rgba(15,27,45,0.05)" }}>

          {/* Table header */}
          <div style={{ padding:"14px 18px", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#0F1B2D" }}>
              {loading ? "Loading…" : `${bills.length} bill${bills.length !== 1 ? "s" : ""}`}
              {stats && !loading && <span style={{ fontSize:12, color:"#7A8BA4", marginLeft:8 }}>· {fromDate} → {toDate}</span>}
            </div>
          </div>

          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", minWidth:900, borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#F8FAFD", borderBottom:"1.5px solid #E4EAF3" }}>
                  {["Invoice No","Date","Type","Customer","Cashier","Payment","Items","Net Amount","Actions"].map(h => (
                    <th key={h} style={{ padding:"11px 14px", textAlign: h==="Net Amount"||h==="Items" ? "right":"left", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:"#7A8BA4", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ padding:"56px 20px", textAlign:"center", color:"#7A8BA4" }}>
                    <FaSyncAlt style={{ fontSize:24, marginBottom:8, opacity:0.3 }} />
                    <div style={{ fontSize:13 }}>Loading bills…</div>
                  </td></tr>
                ) : bills.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding:"56px 20px", textAlign:"center", color:"#7A8BA4" }}>
                    <FaFileInvoice style={{ fontSize:32, marginBottom:8, opacity:0.2 }} />
                    <div style={{ fontSize:13 }}>No bills found for the selected filters</div>
                  </td></tr>
                ) : bills.map(bill => {
                  const isEx = expanded.has(bill.id);
                  const isReturn = bill.type === "return";
                  const net = bill.summary?.net_payable || 0;
                  return (
                    <React.Fragment key={bill.id}>
                      <tr style={{ borderBottom:"1px solid #F1F5F9", background: isEx ? (isReturn?"#FFF8F8":"#F8FAFF") : "#fff", transition:"background 0.12s" }}
                        onMouseEnter={e => { if (!isEx) e.currentTarget.style.background="#FAFBFF"; }}
                        onMouseLeave={e => { if (!isEx) e.currentTarget.style.background="#fff"; }}>

                        {/* Invoice No */}
                        <td style={{ padding:"12px 14px" }}>
                          <span style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:"#5B5FEF" }}>{bill.invoice_no}</span>
                          {bill.original_invoice && (
                            <div style={{ fontSize:10, color:"#D93025", marginTop:2 }}>↩ {bill.original_invoice}</div>
                          )}
                        </td>

                        {/* Date */}
                        <td style={{ padding:"12px 14px", fontSize:12, color:"#4A5168", whiteSpace:"nowrap" }}>{bill.date}</td>

                        {/* Type */}
                        <td style={{ padding:"12px 14px" }}><TypeBadge type={bill.type} /></td>

                        {/* Customer */}
                        <td style={{ padding:"12px 14px" }}>
                          <div style={{ fontWeight:600, color:"#0F1B2D", fontSize:13 }}>{bill.customer_name || "Walking Customer"}</div>
                          {bill.mobile && <div style={{ fontSize:11, color:"#7A8BA4", marginTop:1 }}>{bill.mobile}</div>}
                        </td>

                        {/* Cashier */}
                        <td style={{ padding:"12px 14px", fontSize:12, color:"#4A5168" }}>{bill.cashier_name || "—"}</td>

                        {/* Payment */}
                        <td style={{ padding:"12px 14px" }}><PayBadge method={bill.payment_method} /></td>

                        {/* Items */}
                        <td style={{ padding:"12px 14px", textAlign:"right", fontWeight:700, color:"#0F1B2D" }}>{bill.items_count}</td>

                        {/* Amount */}
                        <td style={{ padding:"12px 14px", textAlign:"right", fontWeight:800, fontSize:14, color: isReturn?"#D93025":"#0F1B2D" }}>
                          {isReturn ? "- " : ""}{money(net)}
                        </td>

                        {/* Actions */}
                        <td style={{ padding:"12px 14px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end" }}>
                            <button onClick={() => openDetail(bill.invoice_no)}
                              title="Full details"
                              style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:8, border:"1px solid #C5C8F8", background:"#EEEFFE", color:"#5B5FEF", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                              <FaEye style={{ fontSize:10 }} /> View
                            </button>
                            <button onClick={() => printBill(bill)}
                              title="Print receipt"
                              style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:8, border:"1px solid #E4EAF3", background:"#F8FAFD", color:"#4A5168", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                              <FaPrint style={{ fontSize:10 }} /> Print
                            </button>
                            <button onClick={() => toggleExpand(bill.id)}
                              title={isEx ? "Collapse items" : "Expand items"}
                              style={{ width:30, height:30, borderRadius:8, border:"1px solid #E4EAF3", background:"#F8FAFD", color:"#4A5168", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              {isEx ? <FaChevronUp style={{ fontSize:10 }} /> : <FaChevronDown style={{ fontSize:10 }} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Inline expanded items */}
                      {isEx && (
                        <tr>
                          <td colSpan={9} style={{ padding:"0 14px 14px 14px", background: isReturn?"#FFF8F8":"#F8FAFF" }}>
                            <div style={{ borderRadius:10, overflow:"hidden", border:`1px solid ${isReturn?"#FFCCC9":"#C5C8F8"}` }}>
                              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                                <thead>
                                  <tr style={{ background: isReturn?"#FFCCC9":"#C5C8F8" }}>
                                    {["Barcode","Product","SKU","Qty","Rate","GST%","Total"].map(h => (
                                      <th key={h} style={{ padding:"7px 10px", textAlign: h==="Total"||h==="Rate"||h==="GST%"||h==="Qty"?"right":"left", fontSize:9, fontWeight:700, textTransform:"uppercase", color: isReturn?"#8B1A15":"#3B3FAA", whiteSpace:"nowrap" }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(bill.items || []).map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom:"1px solid #F1F5F9", background:"#fff" }}>
                                      <td style={{ padding:"7px 10px", fontFamily:"monospace", fontSize:11, color:"#4A5168" }}>{item.barcode || "—"}</td>
                                      <td style={{ padding:"7px 10px", fontWeight:600, color:"#0F1B2D", maxWidth:200 }}>
                                        <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
                                        {item.hsn && <div style={{ fontSize:10, color:"#7A8BA4" }}>HSN: {item.hsn}</div>}
                                      </td>
                                      <td style={{ padding:"7px 10px", fontFamily:"monospace", fontSize:11, color:"#5B5FEF" }}>{item.sku || "—"}</td>
                                      <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:700 }}>{item.qty}</td>
                                      <td style={{ padding:"7px 10px", textAlign:"right", fontFamily:"monospace" }}>{money(item.price)}</td>
                                      <td style={{ padding:"7px 10px", textAlign:"right" }}>
                                        <span style={{ background:"#EEEFFE", borderRadius:5, padding:"1px 6px", fontSize:10, fontWeight:700, color:"#5B5FEF" }}>{item.gst_rate || item.gst || 0}%</span>
                                      </td>
                                      <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:800, color: isReturn?"#D93025":"#0F1B2D" }}>{money(item.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>

              {/* Footer totals */}
              {bills.length > 0 && stats && !loading && (
                <tfoot>
                  <tr style={{ background:"#F8FAFD", borderTop:"2px solid #E4EAF3" }}>
                    <td colSpan={6} style={{ padding:"12px 14px", fontWeight:700, fontSize:13, color:"#4A5168" }}>
                      {stats.sale_bills} sales · {stats.return_bills} returns · {bills.length} total
                    </td>
                    <td style={{ padding:"12px 14px", textAlign:"right", fontWeight:700, color:"#0F1B2D", fontSize:13 }}>
                      {stats.total_items}
                    </td>
                    <td style={{ padding:"12px 14px", textAlign:"right", fontWeight:900, fontSize:15, color:"#5B5FEF" }}>
                      {money(stats.net_revenue)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Bill Detail Modal */}
      {detailBill && (
        <BillDetailModal
          bill={detailBill}
          onClose={() => setDetailBill(null)}
          onPrint={printBill}
        />
      )}
    </div>
  );
}