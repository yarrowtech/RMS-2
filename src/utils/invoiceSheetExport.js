import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { csvValue } from "./fabricSheetExport.js";

// Purchase Invoice download — mirrors poSheetExport.js, reading the
// backend's own authoritative computed fields (Purchaseinvoice_routes.py's
// compute_invoice_totals: subtotal/totalTax/totalCgst/totalSgst/totalIgst/
// invoiceTotal, items' taxAmount/cgstAmount/sgstAmount/igstAmount/
// lineAmount) rather than any client-only total, since those are what
// actually gets persisted.

export const INVOICE_SHEET_HEADERS = ["Sl No", "HSN", "Barcode", "Description", "Qty", "Rate", "Taxable", "CGST", "SGST", "IGST", "Line Total"];

export function buildInvoiceSheetRows(items = []) {
  return items.map((item, index) => {
    const qty = Number(item.invoicedQty || 0);
    const rate = Number(item.rate || 0);
    const discount = Number(item.discountAmount || 0);
    const taxable = qty * rate - discount;
    return [
      index + 1,
      item.hsn_code || item.hsn || "",
      item.barcode || "",
      item.description || "",
      qty,
      rate.toFixed(2),
      taxable.toFixed(2),
      Number(item.cgstAmount || 0).toFixed(2),
      Number(item.sgstAmount || 0).toFixed(2),
      Number(item.igstAmount || 0).toFixed(2),
      Number(item.lineAmount || 0).toFixed(2),
    ];
  });
}

function invoiceSheetTotals(meta = {}) {
  const subtotal = Number(meta.subtotal || 0);
  const cgst = Number(meta.cgst_amount || 0);
  const sgst = Number(meta.sgst_amount || 0);
  const igst = Number(meta.igst_amount || 0);
  const hasGstSplit = cgst > 0 || sgst > 0 || igst > 0;
  const tax = Number(meta.tax_amount || 0);
  const grandTotal = meta.net_amount != null ? Number(meta.net_amount) : subtotal + tax;
  return { subtotal, cgst, sgst, igst, hasGstSplit, tax, grandTotal };
}

function invoiceSheetFooterRows(meta = {}) {
  const { subtotal, cgst, sgst, igst, hasGstSplit, tax, grandTotal } = invoiceSheetTotals(meta);
  const taxLines = hasGstSplit
    ? (igst > 0
        ? [["", "", "", "", "", "", "IGST", "", "", igst.toFixed(2), ""]]
        : [["", "", "", "", "", "", "CGST", "", "", cgst.toFixed(2), ""], ["", "", "", "", "", "", "SGST", "", "", sgst.toFixed(2), ""]])
    : [["", "", "", "", "", "", "Tax", "", "", tax.toFixed(2), ""]];
  return [
    ["", "", "", "", "", "", "Subtotal", "", "", subtotal.toFixed(2), ""],
    ...taxLines,
    ["", "", "", "", "", "", "Grand Total", "", "", grandTotal.toFixed(2), ""],
  ];
}

function pdfInvoiceSheetFootRow(meta = {}) {
  const { subtotal, cgst, sgst, igst, hasGstSplit, tax, grandTotal } = invoiceSheetTotals(meta);
  const line = (label, value, bold = false) => [
    { content: label, colSpan: 9, styles: { halign: "right", fontStyle: bold ? "bold" : "normal" } },
    { content: value, styles: { halign: "right", fontStyle: bold ? "bold" : "normal" } },
  ];
  const taxLines = hasGstSplit
    ? (igst > 0 ? [line("IGST", igst.toFixed(2))] : [line("CGST", cgst.toFixed(2)), line("SGST", sgst.toFixed(2))])
    : [line("Tax", tax.toFixed(2))];
  return [line("Subtotal", subtotal.toFixed(2)), ...taxLines, line("Grand Total", grandTotal.toFixed(2), true)];
}

export function invoiceSheetFileBase(invoice_no) {
  return invoice_no ? `${invoice_no}-invoice-sheet` : "purchase-invoice-draft-sheet";
}

function invoiceSheetMetaRows(meta) {
  const rows = [];
  if (meta.company_name) rows.push(["Buyer", meta.company_name, meta.company_gstin ? "GSTIN" : "", meta.company_gstin || ""]);
  rows.push(["Vendor", meta.vendor_name || "", meta.vendor_gstin ? "GSTIN" : "", meta.vendor_gstin || ""]);
  if (meta.vendor_invoice_no) rows.push(["Vendor Invoice No", meta.vendor_invoice_no, meta.due_date ? "Due Date" : "", meta.due_date || ""]);
  if (meta.po_no || meta.grn_no) rows.push([meta.po_no ? "PO No" : "", meta.po_no || "", meta.grn_no ? "GRN No" : "", meta.grn_no || ""]);
  return rows;
}

export function downloadInvoiceSheetCsv(meta) {
  const { invoice_no, invoice_date, items = [] } = meta;
  const rows = buildInvoiceSheetRows(items);
  const lines = [
    ["Purchase Invoice"],
    ["Invoice No.", invoice_no || "Draft", "Invoice Date", invoice_date || ""],
    ...invoiceSheetMetaRows(meta),
    [],
    INVOICE_SHEET_HEADERS,
    ...rows,
    [],
    ...invoiceSheetFooterRows(meta),
  ];
  const csv = lines.map((line) => line.map(csvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${invoiceSheetFileBase(invoice_no)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadInvoiceSheetExcel(meta) {
  const { invoice_no, invoice_date, items = [] } = meta;
  const rows = buildInvoiceSheetRows(items);
  const aoa = [
    ["Purchase Invoice"],
    ["Invoice No.", invoice_no || "Draft", "Invoice Date", invoice_date || ""],
    ...invoiceSheetMetaRows(meta),
    [],
    INVOICE_SHEET_HEADERS,
    ...rows,
    [],
    ...invoiceSheetFooterRows(meta),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: INVOICE_SHEET_HEADERS.length - 1 } }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Purchase Invoice");
  XLSX.writeFile(wb, `${invoiceSheetFileBase(invoice_no)}.xlsx`);
}

export function downloadInvoiceSheetPdf(meta) {
  const { invoice_no, vendor_name, invoice_date, items = [] } = meta;
  const rows = buildInvoiceSheetRows(items);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("Purchase Invoice", 40, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`Invoice No.: ${invoice_no || "Draft"}`, 40, 58);
  doc.text(`Invoice Date: ${invoice_date || "-"}`, 260, 58);
  if (meta.due_date) doc.text(`Due Date: ${meta.due_date}`, 420, 58);

  let y = 74;
  if (meta.company_name) {
    doc.text(`Buyer: ${meta.company_name}${meta.company_gstin ? `  |  GSTIN: ${meta.company_gstin}` : ""}`, 40, y);
    y += 15;
  }
  doc.text(`Vendor: ${vendor_name || "-"}${meta.vendor_gstin ? `  |  GSTIN: ${meta.vendor_gstin}` : ""}`, 40, y);
  y += 15;
  if (meta.po_no || meta.grn_no) {
    doc.text(`${meta.po_no ? `PO: ${meta.po_no}` : ""}${meta.po_no && meta.grn_no ? "  |  " : ""}${meta.grn_no ? `GRN: ${meta.grn_no}` : ""}`, 40, y);
    y += 15;
  }
  y += 4;

  autoTable(doc, {
    head: [INVOICE_SHEET_HEADERS],
    body: rows,
    foot: pdfInvoiceSheetFootRow(meta),
    startY: y,
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42] },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" }, 9: { halign: "right" }, 10: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });
  doc.save(`${invoiceSheetFileBase(invoice_no)}.pdf`);
}
