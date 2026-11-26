import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { csvValue } from "./fabricSheetExport.js";

// Generic Purchase Order sheet — for every order type OTHER than
// "Fabric / Raw Material", which already has its own richer sheet
// (fabricSheetExport.js, with fabric photos/GSM/width columns). This one
// covers the plain barcode/description/qty/rate line items a Standard
// order actually has.

export const PO_SHEET_HEADERS = ["Sl No", "Barcode", "Description", "Qty", "Rate", "Amount", "Remarks"];

export function buildPoSheetRows(items = []) {
  return items
    .filter((item) => !item.removed)
    .map((item, index) => {
      const qty = Number(item.quantity || 0);
      const rate = Number(item.rate || 0);
      return [index + 1, item.barcode || "", item.description || "", qty, rate.toFixed(2), (qty * rate).toFixed(2), item.remarks || ""];
    });
}

export function poSheetTotalAmount(rows) {
  return rows.reduce((sum, row) => sum + Number(row[5] || 0), 0);
}

function poSheetTotals(rows, meta = {}) {
  const subtotal = meta.subtotal_amount != null ? Number(meta.subtotal_amount) : poSheetTotalAmount(rows);
  const tax = Number(meta.tax_amount || 0);
  const cgst = Number(meta.cgst_amount || 0);
  const sgst = Number(meta.sgst_amount || 0);
  const igst = Number(meta.igst_amount || 0);
  // Only a saved PO (computed server-side, GSTIN-aware) carries the split —
  // a pre-save draft just shows the one blended Tax line until it's saved.
  const hasGstSplit = cgst > 0 || sgst > 0 || igst > 0;
  const grandTotal = meta.net_amount != null ? Number(meta.net_amount) : subtotal + tax;
  return { subtotal, tax, cgst, sgst, igst, hasGstSplit, grandTotal };
}

function poSheetFooterRows(rows, meta = {}) {
  const { subtotal, tax, cgst, sgst, igst, hasGstSplit, grandTotal } = poSheetTotals(rows, meta);
  const taxLines = hasGstSplit
    ? (igst > 0
        ? [["", "", "", "", "IGST", igst.toFixed(2), ""]]
        : [["", "", "", "", "CGST", cgst.toFixed(2), ""], ["", "", "", "", "SGST", sgst.toFixed(2), ""]])
    : [["", "", "", "", "Tax", tax.toFixed(2), ""]];
  return [
    ["", "", "", "", "Subtotal", subtotal.toFixed(2), ""],
    ...taxLines,
    ["", "", "", "", "Grand Total", grandTotal.toFixed(2), ""],
  ];
}

function pdfPoSheetFootRow(rows, meta = {}) {
  const { subtotal, tax, cgst, sgst, igst, hasGstSplit, grandTotal } = poSheetTotals(rows, meta);
  const line = (label, value, bold = false) => [
    { content: label, colSpan: 4, styles: { halign: "right", fontStyle: bold ? "bold" : "normal" } },
    { content: value, styles: { halign: "right", fontStyle: bold ? "bold" : "normal" } },
    { content: "", colSpan: 2 },
  ];
  const taxLines = hasGstSplit
    ? (igst > 0 ? [line("IGST", igst.toFixed(2))] : [line("CGST", cgst.toFixed(2)), line("SGST", sgst.toFixed(2))])
    : [line("Tax", tax.toFixed(2))];
  return [line("Subtotal", subtotal.toFixed(2)), ...taxLines, line("Grand Total", grandTotal.toFixed(2), true)];
}

export function poSheetFileBase(purchase_order_no) {
  return purchase_order_no ? `${purchase_order_no}-po-sheet` : "purchase-order-draft-sheet";
}

function poSheetMetaRows(meta) {
  const rows = [];
  if (meta.company_name) rows.push(["Buyer", meta.company_name, meta.company_gstin ? "GSTIN" : "", meta.company_gstin || ""]);
  if (meta.company_address) rows.push(["Buyer Address", meta.company_address]);
  rows.push(["Vendor", meta.vendor_name || "", meta.vendor_gstin ? "GSTIN" : "", meta.vendor_gstin || ""]);
  if (meta.vendor_mobile || meta.vendor_address) rows.push(["Vendor Contact", meta.vendor_mobile || "", meta.vendor_address ? "Vendor Address" : "", meta.vendor_address || ""]);
  if (meta.expected_delivery_date || meta.payment_terms) rows.push([meta.expected_delivery_date ? "Delivery By" : "", meta.expected_delivery_date || "", meta.payment_terms ? "Payment Terms" : "", meta.payment_terms || ""]);
  return rows;
}

export function downloadPoSheetCsv(meta) {
  const { purchase_order_no, order_date, items = [] } = meta;
  const rows = buildPoSheetRows(items);
  const lines = [
    ["Purchase Order Sheet"],
    ["PO No.", purchase_order_no || "Draft", "Order Date", order_date || ""],
    ...poSheetMetaRows(meta),
    [],
    PO_SHEET_HEADERS,
    ...rows,
    [],
    ...poSheetFooterRows(rows, meta),
  ];
  const csv = lines.map((line) => line.map(csvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${poSheetFileBase(purchase_order_no)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadPoSheetExcel(meta) {
  const { purchase_order_no, order_date, items = [] } = meta;
  const rows = buildPoSheetRows(items);
  const aoa = [
    ["Purchase Order Sheet"],
    ["PO No.", purchase_order_no || "Draft", "Order Date", order_date || ""],
    ...poSheetMetaRows(meta),
    [],
    PO_SHEET_HEADERS,
    ...rows,
    [],
    ...poSheetFooterRows(rows, meta),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 6 }, { wch: 16 }, { wch: 34 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 28 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: PO_SHEET_HEADERS.length - 1 } }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Purchase Order");
  XLSX.writeFile(wb, `${poSheetFileBase(purchase_order_no)}.xlsx`);
}

export function downloadPoSheetPdf(meta) {
  const { purchase_order_no, vendor_name, order_date, items = [] } = meta;
  const rows = buildPoSheetRows(items);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("Purchase Order", 40, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`PO No.: ${purchase_order_no || "Draft"}`, 40, 58);
  doc.text(`Order Date: ${order_date || "-"}`, 260, 58);
  if (meta.expected_delivery_date) doc.text(`Delivery By: ${meta.expected_delivery_date}`, 400, 58);

  let y = 74;
  if (meta.company_name) {
    doc.text(`Buyer: ${meta.company_name}${meta.company_gstin ? `  |  GSTIN: ${meta.company_gstin}` : ""}${meta.company_address ? `  |  ${meta.company_address}` : ""}`, 40, y);
    y += 15;
  }
  doc.text(`Vendor: ${vendor_name || "-"}${meta.vendor_gstin ? `  |  GSTIN: ${meta.vendor_gstin}` : ""}${meta.vendor_mobile ? `  |  ${meta.vendor_mobile}` : ""}`, 40, y);
  y += 15;
  if (meta.payment_terms) {
    doc.text(`Payment Terms: ${meta.payment_terms}`, 40, y);
    y += 15;
  }
  y += 4;

  autoTable(doc, {
    head: [PO_SHEET_HEADERS],
    body: rows,
    foot: pdfPoSheetFootRow(rows, meta),
    startY: y,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42] },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });
  doc.save(`${poSheetFileBase(purchase_order_no)}.pdf`);
}
