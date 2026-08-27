import { API_BASE_URL as APP_API_URL } from "../config/api.js";

// ─────────────────────────────────────────────────────────────────────────────
// InvoicePublicView.jsx
// Public page — no auth required. A customer opens this from the "View &
// download invoice" link/button in their POS invoice email and can review
// the bill and download it as a PDF. Backed by the public, auth-free
// GET /cashier/public/invoice/{token} endpoint, which only ever returns
// customer-facing fields (no cost price, no tenant/store internals).
//
// Router (App.jsx):
//   import InvoicePublicView from "./components/InvoicePublicView.jsx";
//   <Route path="/invoice/:token" element={<InvoicePublicView />} />
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE = APP_API_URL;
const BRAND = "#4F46E5";

const money = (v) => `Rs. ${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function buildPdf(invoice) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(79, 70, 229);
  doc.text(invoice.store_name || "RMS Store", 40, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Invoice: ${invoice.invoice_no || "-"}`, 40, 68);
  doc.text(`Date: ${invoice.date || "-"}`, 40, 82);
  doc.text(`Paid by: ${invoice.payment_method || "Cash"}`, 40, 96);
  if (invoice.type === "return") {
    doc.setTextColor(190, 18, 60);
    doc.text(`Return against: ${invoice.original_invoice || "-"}`, 300, 68);
    doc.setTextColor(51, 65, 85);
  }

  autoTable(doc, {
    startY: 116,
    head: [["Item", "HSN", "Qty", "Rate", "GST %", "Amount"]],
    body: invoice.items.map((it) => [
      it.name, it.hsn || "-", it.qty, money(it.price), `${it.gst || 0}%`, money(Math.abs(it.total)),
    ]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [238, 242, 255], textColor: [49, 46, 129] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  const summary = invoice.summary || {};
  const rows = [
    ["Taxable amount", money(summary.taxable_amount)],
    ["Total GST", money(summary.total_gst)],
    ["Round off", money(summary.round_off)],
  ];
  let y = (doc.lastAutoTable?.finalY || 116) + 24;
  doc.setFontSize(9);
  rows.forEach(([label, value]) => {
    doc.text(label, 380, y);
    doc.text(value, 555, y, { align: "right" });
    y += 16;
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Net payable", 380, y + 6);
  doc.text(money(summary.net_payable), 555, y + 6, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("This is a system-generated invoice from RMS.", 40, 800);

  doc.save(`${invoice.invoice_no || "invoice"}.pdf`);
}

export default function InvoicePublicView() {
  const { token } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!token) { setError("Invalid link."); setLoading(false); return; }
    fetch(`${API_BASE}/cashier/public/invoice/${token}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, ...j })))
      .then((j) => {
        if (!j.ok) setError(j.detail || "This invoice link is invalid or has expired.");
        else setInvoice(j.data);
      })
      .catch(() => setError("Network error. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDownload = () => {
    if (!invoice) return;
    setDownloading(true);
    try { buildPdf(invoice); } finally { setDownloading(false); }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F8FAFC", fontFamily: "system-ui, sans-serif", color: "#64748B" }}>
        Loading your invoice…
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F8FAFC", fontFamily: "system-ui, sans-serif", padding: 20 }}>
        <div style={{ maxWidth: 420, textAlign: "center", background: "#fff", border: "1px solid #FECACA", borderRadius: 16, padding: 28 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#DC2626", margin: "0 0 6px" }}>Couldn't load this invoice</p>
          <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  const summary = invoice.summary || {};
  const isReturn = invoice.type === "return";

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", fontFamily: "system-ui, sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Card */}
        <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 30px rgba(15,23,42,0.08)", border: "1px solid #E2E8F0" }}>
          {/* Header */}
          <div style={{ background: `linear-gradient(135deg, ${BRAND}, #7C3AED)`, padding: "26px 28px", color: "#fff" }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85 }}>
              {isReturn ? "Return Invoice" : "Invoice"}
            </p>
            <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800 }}>{invoice.store_name || "RMS Store"}</h1>
          </div>

          {/* Meta */}
          <div style={{ padding: "22px 28px", borderBottom: "1px solid #F1F5F9", display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Invoice No.</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0F172A", fontFamily: "monospace" }}>{invoice.invoice_no}</p>
            </div>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Date</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{invoice.date}</p>
            </div>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Paid By</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{invoice.payment_method || "Cash"}</p>
            </div>
            {isReturn && invoice.original_invoice && (
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Against</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#BE123C", fontFamily: "monospace" }}>{invoice.original_invoice}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div style={{ padding: "20px 28px", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
              <thead>
                <tr style={{ background: "#EEF2FF" }}>
                  <th style={{ padding: "9px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#312E81" }}>Item</th>
                  <th style={{ padding: "9px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#312E81" }}>Qty</th>
                  <th style={{ padding: "9px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#312E81" }}>Rate</th>
                  <th style={{ padding: "9px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#312E81" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "9px 10px", color: "#334155" }}>{it.name}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: "#334155" }}>{it.qty}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: "#334155" }}>{money(it.price)}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: "#0F172A", fontWeight: 600 }}>{money(Math.abs(it.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div style={{ padding: "0 28px 24px", display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: "100%", maxWidth: 280 }}>
              <SummaryRow label="Taxable amount" value={money(summary.taxable_amount)} />
              <SummaryRow label="Total GST" value={money(summary.total_gst)} />
              <SummaryRow label="Round off" value={money(summary.round_off)} />
              <div style={{ marginTop: 8, paddingTop: 10, borderTop: "1.5px solid #E2E8F0", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Net payable</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: BRAND }}>{money(summary.net_payable)}</span>
              </div>
            </div>
          </div>

          {/* Download */}
          <div style={{ padding: "0 28px 28px" }}>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                width: "100%", height: 46, borderRadius: 12, border: "none",
                background: BRAND, color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: downloading ? "not-allowed" : "pointer", opacity: downloading ? 0.7 : 1,
              }}
            >
              {downloading ? "Preparing…" : "Download PDF"}
            </button>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 16 }}>
          This is a system-generated invoice from RMS.
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
      <span style={{ fontSize: 13, color: "#64748B" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>{value}</span>
    </div>
  );
}
