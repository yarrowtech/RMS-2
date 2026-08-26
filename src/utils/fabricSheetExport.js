import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Shared by ProductionJobWork.jsx (right after a Fabric PO is created) and
// PurchesOrder.jsx (re-downloading a fabric PO later from the Order Details
// list) — one place for the sheet layout so both stay in sync.

export function csvValue(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const FABRIC_SHEET_HEADERS = ["Sl No", "Fabric / Material", "Fabric Type", "GSM", "Width", "Colour", "Total Fabric", "Unit", "Rate", "Amount", "Remarks", "Image Link"];

export function buildFabricSheetRows(sheet, fallbackItems = []) {
  const source = sheet?.length ? sheet : fallbackItems.map((item, index) => ({
    sl_no: index + 1,
    fabric_material: item.fabric_name || item.material_name || "",
    fabric_type: item.fabric_type || "",
    gsm: item.gsm || "",
    width: item.width || "",
    color: item.color || "",
    quantity: item.total_quantity || item.required_quantity || item.quantity || "",
    unit: item.unit || "m",
    rate: item.rate || 0,
    amount: (Number(item.total_quantity || item.required_quantity || item.quantity || 0) * Number(item.rate || 0)).toFixed(2),
    remarks: item.remarks || item.specification || "",
    image_url: item.image_url || item.image || item.catalogue_image || "",
  }));
  return source.map((row) => [row.sl_no, row.fabric_material, row.fabric_type, row.gsm, row.width, row.color, row.quantity, row.unit, row.rate, row.amount, row.remarks, row.image_url || ""]);
}

export function fabricSheetTotalAmount(rows) {
  return rows.reduce((sum, row) => sum + Number(row[9] || 0), 0);
}

export function fabricSheetTotalRow(rows) {
  return ["", "", "", "", "", "", "", "", "TOTAL", fabricSheetTotalAmount(rows).toFixed(2), "", ""];
}

export function pdfFabricSheetFootRow(rows) {
  return [[
    { content: "TOTAL", colSpan: 9, styles: { halign: "right", fontStyle: "bold" } },
    { content: fabricSheetTotalAmount(rows).toFixed(2), styles: { halign: "right", fontStyle: "bold" } },
    { content: "", colSpan: 2 },
  ]];
}

export function fabricSheetFileBase(purchase_order_no) {
  return purchase_order_no ? `${purchase_order_no}-fabric-po-sheet` : "fabric-po-draft-sheet";
}

export function downloadFabricSheetCsv({ purchase_order_no, vendor_name, order_date, sheet }, fallbackItems = []) {
  const rows = buildFabricSheetRows(sheet, fallbackItems);
  const lines = [
    ["Fabric PO Sheet"],
    ["PO No.", purchase_order_no || "Draft"],
    ["Vendor", vendor_name || ""],
    ["Order Date", order_date || ""],
    [],
    FABRIC_SHEET_HEADERS,
    ...rows,
    fabricSheetTotalRow(rows),
  ];
  const csv = lines.map((line) => line.map(csvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fabricSheetFileBase(purchase_order_no)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadFabricSheetExcel({ purchase_order_no, vendor_name, order_date, sheet }, fallbackItems = []) {
  const rows = buildFabricSheetRows(sheet, fallbackItems);
  const aoa = [
    ["Fabric PO Sheet"],
    ["PO No.", purchase_order_no || "Draft"],
    ["Vendor", vendor_name || ""],
    ["Order Date", order_date || ""],
    [],
    FABRIC_SHEET_HEADERS,
    ...rows,
    fabricSheetTotalRow(rows),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 6 }, { wch: 24 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 14 },
    { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 28 }, { wch: 30 },
  ];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: FABRIC_SHEET_HEADERS.length - 1 } }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fabric PO Sheet");
  XLSX.writeFile(wb, `${fabricSheetFileBase(purchase_order_no)}.xlsx`);
}

async function fetchImageAsDataUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function dataUrlImageFormat(dataUrl) {
  const match = /^data:image\/(\w+);base64,/i.exec(dataUrl || "");
  const type = (match?.[1] || "jpeg").toLowerCase();
  return type === "jpg" ? "JPEG" : type.toUpperCase();
}

const PDF_IMAGE_COL_INDEX = FABRIC_SHEET_HEADERS.length - 1;
const PDF_COLUMN_WIDTHS = [26, 96, 62, 30, 40, 52, 48, 26, 36, 46, 130, 48];

export async function downloadFabricSheetPdf({ purchase_order_no, vendor_name, order_date, sheet }, fallbackItems = []) {
  const rows = buildFabricSheetRows(sheet, fallbackItems);
  const imageUrls = rows.map((row) => row[PDF_IMAGE_COL_INDEX]);
  const images = await Promise.all(imageUrls.map(fetchImageAsDataUrl));
  const tableRows = rows.map((row) => { const copy = [...row]; copy[PDF_IMAGE_COL_INDEX] = ""; return copy; });
  const headers = [...FABRIC_SHEET_HEADERS]; headers[PDF_IMAGE_COL_INDEX] = "Image";

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("Fabric PO Sheet", 40, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`PO No.: ${purchase_order_no || "Draft"}`, 40, 58);
  doc.text(`Vendor: ${vendor_name || "-"}`, 260, 58);
  doc.text(`Order Date: ${order_date || "-"}`, 480, 58);
  autoTable(doc, {
    head: [headers],
    body: tableRows,
    foot: pdfFabricSheetFootRow(rows),
    startY: 74,
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 5, overflow: "linebreak", minCellHeight: 44, valign: "middle" },
    headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42] },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: PDF_COLUMN_WIDTHS.reduce((acc, width, index) => {
      acc[index] = { cellWidth: width, ...(index === 0 || index === 8 || index === 9 ? { halign: "right" } : {}) };
      return acc;
    }, {}),
    margin: { left: 40, right: 40 },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== PDF_IMAGE_COL_INDEX) return;
      const dataUrl = images[data.row.index];
      if (!dataUrl) return;
      const size = Math.min(data.cell.height - 8, data.cell.width - 8);
      const x = data.cell.x + (data.cell.width - size) / 2;
      const y = data.cell.y + (data.cell.height - size) / 2;
      try { doc.addImage(dataUrl, dataUrlImageFormat(dataUrl), x, y, size, size); } catch { /* skip a broken image rather than failing the whole PDF */ }
    },
  });
  doc.save(`${fabricSheetFileBase(purchase_order_no)}.pdf`);
}
