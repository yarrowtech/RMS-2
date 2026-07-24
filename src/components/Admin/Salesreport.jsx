import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  FaFileExcel, FaSearch, FaFilter, FaSyncAlt, FaReceipt,
  FaUndo, FaChevronDown, FaChevronUp, FaRupeeSign,
  FaBoxOpen, FaUser, FaTimes, FaCalendarAlt,
} from "react-icons/fa";

const API_BASE = `${APP_API_URL}`;

function authHeaders() {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ─── Formatters ─── */
const fmtV = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN = (n) => Number(n || 0).toLocaleString("en-IN");
const pad  = (n) => String(n).padStart(2, "0");

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

/* ─── KPI pill ─── */
function StatPill({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 14, padding: "14px 18px", minWidth: 140 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

/* ─── Type badge ─── */
function TypeBadge({ type }) {
  return type === "return"
    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}><FaUndo style={{ fontSize: 9 }} /> Return</span>
    : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" }}><FaReceipt style={{ fontSize: 9 }} /> Sale</span>;
}

/* ─── Payment badge ─── */
function PayBadge({ method }) {
  const cfg = {
    Cash:  { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
    Card:  { bg: "#EEF2FF", color: "#6366F1", border: "#C7D2FE" },
    UPI:   { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  }[method] || { bg: "#F1F5F9", color: "#475569", border: "#E2E8F0" };
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {method}
    </span>
  );
}

/* ─── Bill Row (expandable) ─── */
function BillRow({ bill, idx, showStore }) {
  const [open, setOpen] = useState(false);
  const isReturn = bill.type === "return";
  const s        = bill.summary;

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        style={{ cursor: "pointer", background: idx % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}
        className="report-row"
      >
        <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: isReturn ? "#DC2626" : "#6366F1", whiteSpace: "nowrap" }}>
          {bill.invoice_no}
        </td>
        <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}><TypeBadge type={bill.type} /></td>
        <td style={{ padding: "12px 14px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>{bill.date}</td>
        {showStore && (
          <td style={{ padding: "12px 14px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>{bill.store_name || "—"}</td>
        )}
        <td style={{ padding: "12px 14px", fontSize: 12, color: "#475569" }}>{bill.cashier_name || "—"}</td>
        <td style={{ padding: "12px 14px", fontSize: 12, color: "#475569" }}>{bill.customer_name || "Walking Customer"}</td>
        <td style={{ padding: "12px 14px", fontSize: 12, color: "#475569" }}>{bill.mobile || "—"}</td>
        <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}><PayBadge method={bill.payment_method} /></td>
        <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, color: "#475569" }}>{fmtN(bill.items_count)}</td>
        <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#94A3B8" }}>{fmtV(s.total_sale)}</td>
        <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: "#10B981" }}>{fmtV(s.total_gst)}</td>
        <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", fontSize: 14, fontWeight: 800, color: isReturn ? "#DC2626" : "#0F172A" }}>
          {isReturn ? "-" : ""}{fmtV(s.net_payable)}
        </td>
        <td style={{ padding: "12px 14px", textAlign: "center" }}>
          {open ? <FaChevronUp style={{ color: "#94A3B8", fontSize: 11 }} /> : <FaChevronDown style={{ color: "#94A3B8", fontSize: 11 }} />}
        </td>
      </tr>

      {/* Expanded line items */}
      {open && (
        <tr style={{ background: "#F8FAFC" }}>
          <td colSpan={showStore ? 13 : 12} style={{ padding: "0 14px 14px" }}>
            <div style={{ borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden", marginTop: 8 }}>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F1F5F9" }}>
                    {["#","Barcode","SKU","Product","HSN","Qty","Rate","GST%","Taxable","CGST","SGST","Total","Division"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: h === "#" || ["Qty","Rate","GST%","Taxable","CGST","SGST","Total"].includes(h) ? "right" : "left", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.4px", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bill.items.map((item, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: "#94A3B8", fontSize: 11 }}>{i + 1}</td>
                      <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: 11, color: "#475569" }}>{item.barcode}</td>
                      <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: 11, color: "#6366F1" }}>{item.sku || "—"}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 600, color: "#0F172A", minWidth: 160 }}>{item.name}</td>
                      <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: 11, color: "#94A3B8" }}>{item.hsn || "—"}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700 }}>{item.qty}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>{fmtV(item.price)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right" }}>{item.gst_rate}%</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>{fmtV(item.taxable)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>{fmtV(item.cgst)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>{fmtV(item.sgst)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{fmtV(item.total)}</td>
                      <td style={{ padding: "7px 10px", color: "#64748B", fontSize: 11 }}>{item.division || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bill summary strip */}
            <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
              {[
                ["Total Sale",    fmtV(s.total_sale),    "#475569"],
                ["Savings",       fmtV(s.total_savings), "#059669"],
                ["CGST",          fmtV(s.cgst_amount),   "#6366F1"],
                ["SGST",          fmtV(s.sgst_amount),   "#6366F1"],
                ["Total GST",     fmtV(s.total_gst),     "#6366F1"],
                ["Round Off",     fmtV(s.round_off),     "#94A3B8"],
                ["Net Payable",   fmtV(s.net_payable),   isReturn ? "#DC2626" : "#0F172A"],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 12px", fontSize: 11 }}>
                  <div style={{ color: "#94A3B8", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, color }}>{val}</div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── By-store comparison table — HQ oversight, all stores at once ─── */
function StoreSummaryTable({ fromDate, toDate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ from_date: fromDate, to_date: toDate });
    fetch(`${API_BASE}/cashier/reports/by-store?${params}`, { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json) => setRows(json.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  const totals = rows.reduce((acc, r) => ({
    sale_count: acc.sale_count + r.sale_count,
    items_sold: acc.items_sold + r.items_sold,
    gross_revenue: acc.gross_revenue + r.gross_revenue,
    net_revenue: acc.net_revenue + r.net_revenue,
  }), { sale_count: 0, items_sold: 0, gross_revenue: 0, net_revenue: 0 });

  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #F1F5F9", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden" }}>
      {error && <div style={{ padding: 16, color: "#DC2626", fontSize: 13 }}>⚠ {error}</div>}
      {loading ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "#94A3B8" }}>
          <FaSyncAlt style={{ fontSize: 24, marginBottom: 10, animation: "spin 1s linear infinite", color: "#6366F1" }} />
          <div style={{ fontSize: 13 }}>Loading store comparison…</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                {["Store","Bills","Items Sold","Gross Revenue","Returns","Net Revenue"].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: h === "Store" ? "left" : "right", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.6px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.store_id || "unassigned"} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0F172A" }}>{r.store_name}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace" }}>{fmtN(r.sale_count)}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace" }}>{fmtN(r.items_sold)}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", color: "#475569" }}>{fmtV(r.gross_revenue)}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", color: "#DC2626" }}>{r.return_count ? fmtV(r.return_amount) : "—"}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: "#0F172A" }}>{fmtV(r.net_revenue)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} style={{ padding: "60px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No sales in this date range.</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 800, color: "#0F172A" }}>All stores</td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", fontWeight: 800 }}>{fmtN(totals.sale_count)}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", fontWeight: 800 }}>{fmtN(totals.items_sold)}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", fontWeight: 800 }}>{fmtV(totals.gross_revenue)}</td>
                  <td />
                  <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", fontWeight: 800 }}>{fmtV(totals.net_revenue)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
const isHQ = () => localStorage.getItem("admin_scope") === "hq";

export default function SalesReport() {
  const showStoreColumn = isHQ();
  const [viewMode, setViewMode] = useState("bills"); // "bills" | "byStore"

  /* Filters */
  const [fromDate,      setFromDate]      = useState(monthStartStr());
  const [toDate,        setToDate]        = useState(todayStr());
  const [typeFilter,    setTypeFilter]    = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [cashierFilter, setCashierFilter] = useState("");
  const [searchQ,       setSearchQ]       = useState("");
  const [minAmt,        setMinAmt]        = useState("");
  const [maxAmt,        setMaxAmt]        = useState("");
  const [storeFilter,   setStoreFilter]   = useState("");
  const [stores,        setStores]        = useState([]);

  useEffect(() => {
    if (!showStoreColumn) return;
    fetch(`${API_BASE}/superadmin/stores/list`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => setStores(Array.isArray(json.stores) ? json.stores : []))
      .catch(() => {});
  }, [showStoreColumn]);

  /* Data */
  const [bills,       setBills]       = useState([]);
  const [stats,       setStats]       = useState(null);
  const [totalCount,  setTotalCount]  = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [exporting,   setExporting]   = useState(false);

  /* Pagination */
  const PAGE_SIZE = 50;
  const [skip,    setSkip]    = useState(0);

  const fetchData = useCallback(async (newSkip = 0) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate)                              params.append("from_date",       fromDate);
      if (toDate)                                params.append("to_date",         toDate);
      if (typeFilter    !== "all")               params.append("type",            typeFilter);
      if (paymentFilter !== "all")               params.append("payment_method",  paymentFilter);
      if (cashierFilter.trim())                  params.append("cashier_name",    cashierFilter.trim());
      if (searchQ.trim())                        params.append("search",          searchQ.trim());
      if (minAmt !== "")                         params.append("min_amount",      minAmt);
      if (maxAmt !== "")                         params.append("max_amount",      maxAmt);
      if (storeFilter)                           params.append("store_id",        storeFilter);
      params.append("limit", PAGE_SIZE);
      params.append("skip",  newSkip);

      const res  = await fetch(`${API_BASE}/cashier/reports?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setBills(json.data || []);
      setStats(json.stats || null);
      setTotalCount(json.total_count || 0);
      setSkip(newSkip);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [fromDate, toDate, typeFilter, paymentFilter, cashierFilter, searchQ, minAmt, maxAmt, storeFilter]);

  useEffect(() => { fetchData(0); }, [fetchData]);

  /* ── Excel Export ── */
  const handleExport = async () => {
    setExporting(true);
    try {
      // Fetch ALL data (no pagination limit for export)
      const params = new URLSearchParams();
      if (fromDate)            params.append("from_date",      fromDate);
      if (toDate)              params.append("to_date",        toDate);
      if (typeFilter !== "all")params.append("type",           typeFilter);
      if (paymentFilter !== "all") params.append("payment_method", paymentFilter);
      if (cashierFilter.trim())params.append("cashier_name",   cashierFilter.trim());
      if (searchQ.trim())      params.append("search",         searchQ.trim());
      if (minAmt !== "")       params.append("min_amount",     minAmt);
      if (maxAmt !== "")       params.append("max_amount",     maxAmt);
      if (storeFilter)         params.append("store_id",       storeFilter);
      params.append("limit", "2000");
      params.append("skip",  "0");

      const res  = await fetch(`${API_BASE}/cashier/reports?${params}`, { headers: authHeaders() });
      const json = await res.json();
      const allBills = json.data || [];

      const wb = XLSX.utils.book_new();

      /* ── Sheet 1: Summary (one row per bill) ── */
      const summaryHeaders = [
        "Invoice No", "Type", "Date", ...(showStoreColumn ? ["Store"] : []), "Cashier", "Customer", "Mobile",
        "Payment Method", "Original Invoice", "Items Count",
        "Total Sale (₹)", "Total Savings (₹)", "Taxable Amount (₹)",
        "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total GST (₹)",
        "Round Off (₹)", "Net Payable (₹)",
      ];
      const summaryRows = allBills.map(b => ({
        "Invoice No":         b.invoice_no,
        "Type":               b.type.toUpperCase(),
        "Date":               b.date,
        ...(showStoreColumn ? { "Store": b.store_name || "" } : {}),
        "Cashier":            b.cashier_name || "",
        "Customer":           b.customer_name || "Walking Customer",
        "Mobile":             b.mobile || "",
        "Payment Method":     b.payment_method,
        "Original Invoice":   b.original_invoice || "",
        "Items Count":        b.items_count,
        "Total Sale (₹)":     b.summary.total_sale,
        "Total Savings (₹)":  b.summary.total_savings,
        "Taxable Amount (₹)": b.summary.taxable_amount,
        "CGST (₹)":           b.summary.cgst_amount,
        "SGST (₹)":           b.summary.sgst_amount,
        "IGST (₹)":           b.summary.igst_amount,
        "Total GST (₹)":      b.summary.total_gst,
        "Round Off (₹)":      b.summary.round_off,
        "Net Payable (₹)":    b.summary.net_payable,
      }));

      // Totals row
      summaryRows.push({
        "Invoice No":         "TOTAL",
        "Type":               "",
        "Date":               "",
        "Cashier":            "",
        "Customer":           `${allBills.length} bills`,
        "Mobile":             "",
        "Payment Method":     "",
        "Original Invoice":   "",
        "Items Count":        allBills.reduce((s, b) => s + b.items_count, 0),
        "Total Sale (₹)":     allBills.reduce((s, b) => s + b.summary.total_sale, 0),
        "Total Savings (₹)":  allBills.reduce((s, b) => s + b.summary.total_savings, 0),
        "Taxable Amount (₹)": allBills.reduce((s, b) => s + b.summary.taxable_amount, 0),
        "CGST (₹)":           allBills.reduce((s, b) => s + b.summary.cgst_amount, 0),
        "SGST (₹)":           allBills.reduce((s, b) => s + b.summary.sgst_amount, 0),
        "IGST (₹)":           allBills.reduce((s, b) => s + b.summary.igst_amount, 0),
        "Total GST (₹)":      allBills.reduce((s, b) => s + b.summary.total_gst, 0),
        "Round Off (₹)":      allBills.reduce((s, b) => s + b.summary.round_off, 0),
        "Net Payable (₹)":    allBills.reduce((s, b) => s + b.summary.net_payable, 0),
      });

      const ws1 = XLSX.utils.json_to_sheet(summaryRows, { header: summaryHeaders });
      // Column widths
      ws1["!cols"] = [
        { wch: 22 }, { wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 14 },
        { wch: 14 }, { wch: 22 }, { wch: 10 },
        { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, "Bill Summary");

      /* ── Sheet 2: Detailed (one row per line item) ── */
      const detailHeaders = [
        "Invoice No", "Type", "Date", "Cashier", "Customer", "Payment Method",
        "Barcode", "SKU", "Product Name", "HSN Code",
        "Qty", "Rate (₹)", "MRP (₹)", "Item Discount (₹)",
        "GST Rate (%)", "Taxable (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)",
        "Item Total (₹)", "Division", "Section", "Department",
      ];
      const detailRows = [];
      allBills.forEach(b => {
        b.items.forEach(item => {
          detailRows.push({
            "Invoice No":        b.invoice_no,
            "Type":              b.type.toUpperCase(),
            "Date":              b.date,
            "Cashier":           b.cashier_name || "",
            "Customer":          b.customer_name || "Walking Customer",
            "Payment Method":    b.payment_method,
            "Barcode":           item.barcode,
            "SKU":               item.sku || "",
            "Product Name":      item.name,
            "HSN Code":          item.hsn || "",
            "Qty":               item.qty,
            "Rate (₹)":          item.price,
            "MRP (₹)":           item.mrp || item.price,
            "Item Discount (₹)": item.item_discount || 0,
            "GST Rate (%)":      item.gst_rate,
            "Taxable (₹)":       item.taxable,
            "CGST (₹)":          item.cgst,
            "SGST (₹)":          item.sgst,
            "IGST (₹)":          item.igst,
            "Item Total (₹)":    item.total,
            "Division":          item.division || "",
            "Section":           item.section  || "",
            "Department":        item.department || "",
          });
        });
      });
      const ws2 = XLSX.utils.json_to_sheet(detailRows, { header: detailHeaders });
      ws2["!cols"] = [
        { wch: 22 }, { wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 14 },
        { wch: 16 }, { wch: 14 }, { wch: 28 }, { wch: 12 },
        { wch: 7 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
        { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
        { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, "Item Details");

      /* ── Sheet 3: GST Summary ── */
      const gstMap = {};
      allBills.forEach(b => {
        if (b.type === "return") return;
        b.items.forEach(item => {
          const rate = item.gst_rate || 0;
          if (!gstMap[rate]) gstMap[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
          gstMap[rate].taxable += item.taxable;
          gstMap[rate].cgst    += item.cgst;
          gstMap[rate].sgst    += item.sgst;
          gstMap[rate].igst    += item.igst;
          gstMap[rate].total   += item.cgst + item.sgst + item.igst;
        });
      });
      const gstRows = Object.entries(gstMap).map(([rate, vals]) => ({
        "GST Rate (%)":      Number(rate),
        "CGST Rate (%)":     Number(rate) / 2,
        "SGST Rate (%)":     Number(rate) / 2,
        "Taxable Amount (₹)":parseFloat(vals.taxable.toFixed(2)),
        "CGST Amount (₹)":   parseFloat(vals.cgst.toFixed(2)),
        "SGST Amount (₹)":   parseFloat(vals.sgst.toFixed(2)),
        "IGST Amount (₹)":   parseFloat(vals.igst.toFixed(2)),
        "Total GST (₹)":     parseFloat(vals.total.toFixed(2)),
      }));
      // Totals
      gstRows.push({
  "GST Rate (%)":       "TOTAL",
  "CGST Rate (%)":      "",
  "SGST Rate (%)":      "",
  "Taxable Amount (₹)": parseFloat(gstRows.reduce((s, r) => s + (r["Taxable Amount (₹)"] || 0), 0).toFixed(2)),
  "CGST Amount (₹)":    parseFloat(gstRows.reduce((s, r) => s + (r["CGST Amount (₹)"] || 0), 0).toFixed(2)),
  "SGST Amount (₹)":    parseFloat(gstRows.reduce((s, r) => s + (r["SGST Amount (₹)"] || 0), 0).toFixed(2)),
  "IGST Amount (₹)":    parseFloat(gstRows.reduce((s, r) => s + (r["IGST Amount (₹)"] || 0), 0).toFixed(2)),
  "Total GST (₹)":      parseFloat(gstRows.reduce((s, r) => s + (r["Total GST (₹)"] || 0), 0).toFixed(2)),
});
      const ws3 = XLSX.utils.json_to_sheet(gstRows);
      ws3["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws3, "GST Summary");

      /* ── Sheet 4: Payment method summary ── */
     const payMap = {};
      allBills.filter(b => b.type !== "return").forEach(b => {
        const pm = b.payment_method || "Cash";
        if (!payMap[pm]) payMap[pm] = { count: 0, amount: 0 };
        payMap[pm].count  += 1;
        payMap[pm].amount += b.summary.net_payable;
      });
      const payRows = Object.entries(payMap).map(([method, v]) => ({
        "Payment Method": method,
        "Bill Count":     v.count,
        "Total Amount (₹)": parseFloat(v.amount.toFixed(2)),
      }));
      const ws4 = XLSX.utils.json_to_sheet(payRows);
      ws4["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws4, "Payment Summary");

      /* ── Download ── */
      const fileName = `Sales_Report_${fromDate}_to_${toDate}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      alert("Export failed: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const currentPage = Math.floor(skip / PAGE_SIZE) + 1;

  return (
    <div style={{ minHeight: "100%", background: "#F8FAFC", padding: "20px 24px", fontFamily: "'DM Sans', system-ui, sans-serif", color: "#0F172A" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <style>{`
        * { box-sizing: border-box; }
        .report-row:hover { background: #F0F4FF !important; }
        .filter-input { height: 36px; border-radius: 9px; border: 1px solid #E2E8F0; padding: 0 12px; font-size: 13px; font-weight: 500; color: #475569; outline: none; background: #fff; width: 100%; }
        .filter-input:focus { border-color: #6366F1; box-shadow: 0 0 0 3px #6366F120; }
        .filter-select { height: 36px; border-radius: 9px; border: 1px solid #E2E8F0; padding: 0 12px; font-size: 13px; font-weight: 600; color: #475569; outline: none; background: #fff; cursor: pointer; }
        .filter-select:focus { border-color: #6366F1; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.5px" }}>Sales Report</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94A3B8" }}>
            {viewMode === "bills" ? `${totalCount} records · click any row to expand line items` : "All stores compared side by side"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {showStoreColumn && (
            <div style={{ display: "flex", borderRadius: 10, border: "1px solid #E2E8F0", overflow: "hidden" }}>
              <button onClick={() => setViewMode("bills")}
                style={{ height: 38, padding: "0 16px", border: "none", background: viewMode === "bills" ? "#6366F1" : "#fff", color: viewMode === "bills" ? "#fff" : "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Bill List
              </button>
              <button onClick={() => setViewMode("byStore")}
                style={{ height: 38, padding: "0 16px", border: "none", background: viewMode === "byStore" ? "#6366F1" : "#fff", color: viewMode === "byStore" ? "#fff" : "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                By Store
              </button>
            </div>
          )}
          <button onClick={() => fetchData(0)} disabled={loading}
            style={{ height: 38, display: "flex", alignItems: "center", gap: 7, padding: "0 16px", borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff", color: "#6366F1", fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
            <FaSyncAlt style={{ fontSize: 11, animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
          </button>
          <button onClick={handleExport} disabled={exporting || loading || totalCount === 0}
            style={{ height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 20px", borderRadius: 10, border: "none", background: exporting ? "#A7F3D0" : "#059669", color: "#fff", fontSize: 13, fontWeight: 700, cursor: exporting || loading || totalCount === 0 ? "not-allowed" : "pointer", opacity: totalCount === 0 ? 0.5 : 1 }}>
            {exporting ? <FaSyncAlt style={{ fontSize: 11, animation: "spin 1s linear infinite" }} /> : <FaFileExcel />}
            {exporting ? "Exporting…" : `Export Excel (${fmtN(totalCount)} bills)`}
          </button>
        </div>
      </div>

      {viewMode === "byStore" ? (
        <StoreSummaryTable fromDate={fromDate} toDate={toDate} />
      ) : (
      <>
      {/* ── Filters ── */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #F1F5F9", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <FaFilter style={{ color: "#6366F1", fontSize: 13 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Filters</span>
          <button onClick={() => { setFromDate(monthStartStr()); setToDate(todayStr()); setTypeFilter("all"); setPaymentFilter("all"); setCashierFilter(""); setSearchQ(""); setMinAmt(""); setMaxAmt(""); setStoreFilter(""); }}
            style={{ marginLeft: "auto", fontSize: 11, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
            <FaTimes style={{ fontSize: 9 }} /> Reset
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          {/* Date range */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 5 }}>From Date</label>
            <div style={{ position: "relative" }}>
              <FaCalendarAlt style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontSize: 11, pointerEvents: "none" }} />
              <input type="date" className="filter-input" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ paddingLeft: 30 }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 5 }}>To Date</label>
            <div style={{ position: "relative" }}>
              <FaCalendarAlt style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontSize: 11, pointerEvents: "none" }} />
              <input type="date" className="filter-input" value={toDate} onChange={e => setToDate(e.target.value)} style={{ paddingLeft: 30 }} />
            </div>
          </div>

          {/* Type */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 5 }}>Type</label>
            <select className="filter-select" style={{ width: "100%" }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              <option value="sale">Sale Only</option>
              <option value="return">Return Only</option>
            </select>
          </div>

          {/* Payment */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 5 }}>Payment</label>
            <select className="filter-select" style={{ width: "100%" }} value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
              <option value="all">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="UPI">UPI</option>
            </select>
          </div>

          {/* Store / Branch — HQ only, since a store admin is already locked to their own store */}
          {showStoreColumn && (
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 5 }}>Store / Branch</label>
              <select className="filter-input" value={storeFilter} onChange={e => setStoreFilter(e.target.value)}>
                <option value="">All stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Cashier */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 5 }}>Cashier</label>
            <div style={{ position: "relative" }}>
              <FaUser style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontSize: 11, pointerEvents: "none" }} />
              <input className="filter-input" placeholder="Cashier name" value={cashierFilter} onChange={e => setCashierFilter(e.target.value)} style={{ paddingLeft: 30 }} />
            </div>
          </div>

          {/* Search */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 5 }}>Search</label>
            <div style={{ position: "relative" }}>
              <FaSearch style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontSize: 11, pointerEvents: "none" }} />
              <input className="filter-input" placeholder="Invoice / Customer / Mobile" value={searchQ} onChange={e => setSearchQ(e.target.value)} style={{ paddingLeft: 30 }} />
            </div>
          </div>

          {/* Min / Max amount */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 5 }}>Min Amount (₹)</label>
            <div style={{ position: "relative" }}>
              <FaRupeeSign style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontSize: 11, pointerEvents: "none" }} />
              <input type="number" className="filter-input" placeholder="0" value={minAmt} onChange={e => setMinAmt(e.target.value)} style={{ paddingLeft: 28 }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 5 }}>Max Amount (₹)</label>
            <div style={{ position: "relative" }}>
              <FaRupeeSign style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontSize: 11, pointerEvents: "none" }} />
              <input type="number" className="filter-input" placeholder="No limit" value={maxAmt} onChange={e => setMaxAmt(e.target.value)} style={{ paddingLeft: 28 }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats strip ── */}
      {stats && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <StatPill label="Net Revenue"   value={fmtV(stats.net_revenue)}   color="#6366F1" bg="#EEF2FF" />
          <StatPill label="Gross Sales"   value={fmtV(stats.gross_revenue)} color="#059669" bg="#ECFDF5" />
          <StatPill label="Returns"       value={fmtV(stats.return_amount)} color="#DC2626" bg="#FEF2F2" />
          <StatPill label="Total GST"     value={fmtV(stats.total_gst)}     color="#7C3AED" bg="#EDE9FE" />
          <StatPill label="Total Savings" value={fmtV(stats.total_savings)} color="#D97706" bg="#FFFBEB" />
          <StatPill label="Sale Bills"    value={fmtN(stats.sale_bills)}    color="#059669" bg="#ECFDF5" />
          <StatPill label="Return Bills"  value={fmtN(stats.return_bills)}  color="#DC2626" bg="#FEF2F2" />
          <StatPill label="Total Items"   value={fmtN(stats.total_items)}   color="#0891B2" bg="#ECFEFF" />
        </div>
      )}

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", fontSize: 13, marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #F1F5F9", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 1100 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                {(showStoreColumn
                  ? ["Invoice No","Type","Date & Time","Store","Cashier","Customer","Mobile","Payment","Items","Sale Amt","GST","Net Payable",""]
                  : ["Invoice No","Type","Date & Time","Cashier","Customer","Mobile","Payment","Items","Sale Amt","GST","Net Payable",""]
                ).map((h, i) => (
                  <th key={i} style={{
                    padding: "12px 14px", textAlign: ["Items","Sale Amt","GST","Net Payable"].includes(h) ? "right" : "left",
                    fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase",
                    letterSpacing: "0.6px", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={showStoreColumn ? 13 : 12} style={{ padding: "60px 0", textAlign: "center", color: "#94A3B8" }}>
                    <FaSyncAlt style={{ fontSize: 24, marginBottom: 10, animation: "spin 1s linear infinite", color: "#6366F1" }} />
                    <div style={{ fontSize: 13 }}>Loading report…</div>
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={showStoreColumn ? 13 : 12} style={{ padding: "60px 0", textAlign: "center", color: "#94A3B8" }}>
                    <FaBoxOpen style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }} />
                    <div style={{ fontSize: 13 }}>No bills found for the selected filters</div>
                  </td>
                </tr>
              ) : (
                bills.map((bill, i) => <BillRow key={bill.id} bill={bill} idx={i} showStore={showStoreColumn} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalCount > PAGE_SIZE && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid #F1F5F9", background: "#FAFAFA" }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>
              Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, totalCount)} of {fmtN(totalCount)} bills
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => fetchData(Math.max(0, skip - PAGE_SIZE))} disabled={skip === 0 || loading}
                style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: skip === 0 ? "not-allowed" : "pointer", opacity: skip === 0 ? 0.4 : 1 }}>
                ← Prev
              </button>
              <span style={{ height: 32, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 8, background: "#EEF2FF", color: "#6366F1", fontSize: 12, fontWeight: 700 }}>
                {currentPage} / {totalPages}
              </span>
              <button onClick={() => fetchData(skip + PAGE_SIZE)} disabled={skip + PAGE_SIZE >= totalCount || loading}
                style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: skip + PAGE_SIZE >= totalCount ? "not-allowed" : "pointer", opacity: skip + PAGE_SIZE >= totalCount ? 0.4 : 1 }}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 12, fontSize: 11, color: "#94A3B8", textAlign: "center" }}>
        Excel export includes 4 sheets: Bill Summary · Item Details · GST Summary · Payment Summary
      </div>
      </>
      )}
    </div>
  );
}