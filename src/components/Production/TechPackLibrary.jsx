import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/api.js";
import { jsPDF } from "jspdf";

function headers(isFormData = false) {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function api(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}/api/job-work${path}`, { ...options, headers: { ...headers(isFormData), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Unable to save the tech pack.");
  return data;
}

const IMAGE_SECTIONS = [
  ["sketch", "Sketch", "Front/back flat drawing or photo reference."],
  ["spec", "Spec sheet", "Measurement drawing with numbered POM callouts."],
  ["details", "Details", "Enlarged construction details - collar, pocket, cuff etc."],
  ["artwork", "Artwork", "Print/embroidery/flocking artwork, actual size or to scale."],
  ["trims", "Trims & label", "Trim photos, label placement, hangtag."],
  ["colourway", "Colourways", "Swatches for each colour/fabric combo."],
];

const emptyPack = {
  design_no: "", style_name: "", department: "", version: "v1", sample_size: "",
  theme_id: "", theme_name: "", collection: "", designer_name: "",
  description: "", fabric_notes: "", construction_notes: "", artwork_notes: "", colourway_notes: "",
  reference_images: "", document_urls: "", material_plan_id: "",
  sizes: "", artwork_width_cm: "", artwork_height_cm: "", artwork_placement: "",
};

const emptyMeasurementRow = (sizes) => ({
  pom_code: "", point: "", measure_instruction: "", unit: "cm", sample_value: "",
  tolerance: "", grade_rule: "", grades: Object.fromEntries(sizes.map((s) => [s, ""])),
});
const emptyTrimRow = () => ({ description: "", color: "", size: "", supplier: "", quantity: "", price: "" });
const emptyColourway = () => ({ name: "", fabric_ref: "", thread_ref: "", image_file: null, image_preview: "" });
const emptyFabricReference = () => ({
  reference_name: "", usage: "", fabric_type: "", composition: "", color: "", color_code: "",
  gsm: "", width: "", consumption: "", unit: "metres", supplier: "", supplier_ref: "", lot_no: "",
  grain_notes: "", shrinkage: "", handling_notes: "", bom_material: "", image_urls: [], image_files: [], image_previews: [],
});
const DEFAULT_ALLOWANCE_POLICY = {
  PATTERN:{value:7,unit:"inches"}, LAYERING:{value:7,unit:"inches_per_lay"},
  CUTTING:{value:5,unit:"percent"}, STITCHING:{value:2,unit:"percent"}, FINISHING:{value:2,unit:"percent"},
};
const emptyProcessAllowance = () => ({
  process:"PATTERN", allowance_type:"", fabric_reference:"", value:"", unit:"inches",
  basis:"per garment", reason:"", worker_scope:"ANY",
});
function allowanceExceedsPolicy(row,rule){
  const value=Number(row.value||0);
  if(value<=0)return false;
  if(row.unit===rule.unit)return value>Number(rule.value||0);
  const lengthToInches={inches:1,centimetres:0.3937007874,metres:39.37007874};
  if(lengthToInches[row.unit]&&lengthToInches[rule.unit]){
    return value*lengthToInches[row.unit]/lengthToInches[rule.unit]>Number(rule.value||0);
  }
  return true;
}

function cleanAssetUrls(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter((item) => item && !["[]", "{}", "null", "none", "undefined"].includes(item.toLowerCase()));
}

function themeReference(pack) {
  const snapshot = pack?.theme_snapshot || null;
  const current = pack?.linked_theme || null;
  if (!snapshot && !current) return null;
  return { ...(current || {}), ...(snapshot || {}), swatches: current?.swatches?.length ? current.swatches : (snapshot?.swatches || []) };
}

async function imageToDataUrl(url) {
  const candidate = cleanAssetUrls([url])[0];
  if (!candidate) return null;
  try {
    const response = await fetch(candidate);
    if (!response.ok) return null;
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) return null;
    const blob = await response.blob();
    if (!String(blob.type || contentType).toLowerCase().startsWith("image/")) return null;
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}
async function buildTechPackPdf(pack, plans = []) {
  const linkedPlan = pack.material_plan_id ? (plans || []).find((plan) => plan.id === pack.material_plan_id) : null;
  const linkedTheme = themeReference(pack);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 34;
  const contentWidth = pageWidth - margin * 2;
  const safe = (value, fallback = "-") => String(value || fallback);
  const imageGroups = {
    sketch: [...new Set([...cleanAssetUrls(pack.sketch_images), ...cleanAssetUrls(pack.reference_images)])],
    spec: cleanAssetUrls(pack.spec_images), details: cleanAssetUrls(pack.details_images), artwork: cleanAssetUrls(pack.artwork_images), trims: cleanAssetUrls(pack.trims_images), colourway: cleanAssetUrls(pack.colourway_images),
  };
  const header = (section, pageNo) => {
    doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.8); doc.rect(margin, 26, contentWidth, 64);
    doc.setFillColor(15, 23, 42); doc.rect(margin, 26, 114, 64, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("RMS", margin + 12, 56);
    doc.setFontSize(7.5); doc.text("FASHION TECH PACK", margin + 12, 71);
    doc.setTextColor(15, 23, 42); doc.setFontSize(13); doc.text(section, margin + 128, 49);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`Design: ${safe(pack.design_no)}    Style: ${safe(pack.style_name)}`, margin + 128, 64);
    doc.text(`Department: ${safe(pack.department)}    Sample: ${safe(pack.sample_size)}    Version: ${safe(pack.version, "v1")}`, margin + 128, 77);
    doc.setFont("helvetica", "bold"); doc.text(`PAGE ${pageNo}`, pageWidth - margin - 54, 48);
  };
  const footer = () => {
    doc.setDrawColor(203, 213, 225); doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
    doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139); doc.setFontSize(7.5);
    doc.text("Controlled RMS job-worker handoff. Follow the version and comments shown above before production.", margin, pageHeight - 18);
  };
  const sectionBar = (title, y) => {
    doc.setFillColor(254, 243, 199); doc.rect(margin, y, contentWidth, 20, "F");
    doc.setTextColor(120, 53, 15); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(title.toUpperCase(), margin + 8, y + 14);
    return y + 30;
  };
  const textBox = (label, value, y, minHeight = 40) => {
    const lines = doc.splitTextToSize(safe(value, "No details provided."), contentWidth - 16);
    const height = Math.max(minHeight, 23 + lines.length * 11);
    doc.setDrawColor(203, 213, 225); doc.rect(margin, y, contentWidth, height);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(71, 85, 105); doc.text(label.toUpperCase(), margin + 8, y + 12);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(15, 23, 42); doc.text(lines, margin + 8, y + 25);
    return y + height + 10;
  };
  const table = (columns, rows, y, widths) => {
    const rowHeight = 18; let x = margin;
    doc.setFillColor(226, 232, 240); doc.rect(margin, y, contentWidth, rowHeight, "F");
    columns.forEach((column, index) => { doc.setDrawColor(203, 213, 225); doc.rect(x, y, widths[index], rowHeight); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(51, 65, 85); doc.text(column, x + 4, y + 12); x += widths[index]; });
    let cursor = y + rowHeight;
    (rows.length ? rows : [["No entries added yet."]]).forEach((row) => {
      const cellLines = row.map((cell, index) => doc.splitTextToSize(safe(cell, ""), widths[index] - 8));
      const height = Math.max(rowHeight, Math.max(...cellLines.map((lines) => lines.length)) * 9 + 8); x = margin;
      cellLines.forEach((lines, index) => { doc.setDrawColor(226, 232, 240); doc.rect(x, cursor, widths[index], height); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(15, 23, 42); doc.text(lines, x + 4, cursor + 11); x += widths[index]; });
      cursor += height;
    });
    return cursor + 10;
  };
  const imageGrid = async (urls, y, maxHeight = 215) => {
    const dataUrls = (await Promise.all(cleanAssetUrls(urls).slice(0, 4).map(imageToDataUrl))).filter(Boolean);
    const renderable = dataUrls.map((dataUrl) => {
      try { return { dataUrl, props: doc.getImageProperties(dataUrl) }; }
      catch { return null; }
    }).filter(Boolean);
    if (!renderable.length) return y;
    const columns = renderable.length === 1 ? 1 : 2; const gap = 8;
    const cellWidth = (contentWidth - gap * (columns - 1)) / columns;
    let x = margin; let rowY = y; let rowHeight = 0;
    renderable.forEach(({ dataUrl, props }, index) => {
      const ratio = Number(props.width) > 0 ? Number(props.height) / Number(props.width) : 1;
      const height = Math.min(maxHeight, cellWidth * ratio);
      if (index && index % columns === 0) { rowY += rowHeight + gap; x = margin; rowHeight = 0; }
      doc.setDrawColor(203, 213, 225); doc.rect(x, rowY, cellWidth, height); doc.addImage(dataUrl, x + 2, rowY + 2, cellWidth - 4, height - 4);
      rowHeight = Math.max(rowHeight, height); x += cellWidth + gap;
    });
    return rowY + rowHeight + 10;
  };

  let pageNo = 1;
  header("1. Sketch & Design Brief", pageNo); let y = 108;
  y = sectionBar("Development", y);
  if (pack.theme_name || pack.collection || pack.designer_name) {
    y = textBox("Theme / Collection / Designer", [pack.theme_name && `Theme: ${pack.theme_name}`, pack.collection && `Collection: ${pack.collection}`, pack.designer_name && `Designer: ${pack.designer_name}`].filter(Boolean).join("    |    "), y, 32);
  }
  if (linkedTheme?.creative_direction || linkedTheme?.palette?.length) {
    const direction = [linkedTheme.creative_direction, linkedTheme.palette?.length && `Palette: ${linkedTheme.palette.join(", ")}`].filter(Boolean).join("\n").slice(0, 700);
    y = textBox("Approved theme direction (locked snapshot)", direction, y, 42);
    y = await imageGrid(linkedTheme.moodboard_urls || [], y, 80);
  }
  y = textBox("Description / design brief", pack.description, y, 54); y = textBox("General fabric & material notes", pack.fabric_notes, y, 44); footer();

  for (const [fabricIndex, fabric] of (pack.fabric_references || []).entries()) {
    doc.addPage(); pageNo += 1; header(`1A. Fabric Reference ${fabricIndex + 1}`, pageNo); y = 108;
    y = sectionBar(fabric.reference_name || `Fabric ${fabricIndex + 1}`, y);
    y = textBox("Identity / placement", [
      fabric.usage && `Used at: ${fabric.usage}`,
      fabric.fabric_type && `Type: ${fabric.fabric_type}`,
      fabric.composition && `Composition: ${fabric.composition}`,
      fabric.color && `Colour: ${fabric.color}${fabric.color_code ? ` (${fabric.color_code})` : ""}`,
    ].filter(Boolean).join("\n"), y, 56);
    y = textBox("Technical / sourcing", [
      fabric.gsm && `Weight: ${fabric.gsm}`,
      fabric.width && `Width: ${fabric.width}`,
      fabric.consumption && `Consumption: ${fabric.consumption} ${fabric.unit || ""} per garment`,
      fabric.supplier && `Supplier: ${fabric.supplier}`,
      fabric.supplier_ref && `Supplier ref: ${fabric.supplier_ref}`,
      fabric.lot_no && `Lot / batch: ${fabric.lot_no}`,
      fabric.bom_material && `Linked BOM material: ${fabric.bom_material}`,
    ].filter(Boolean).join(" | "), y, 54);
    y = textBox("Cutting / handling", [fabric.grain_notes, fabric.shrinkage, fabric.handling_notes].filter(Boolean).join("\n"), y, 50);
    const swatches = cleanAssetUrls(fabric.image_urls);
    if (swatches.length) {
      y = sectionBar("Approved fabric swatch photos", y);
      y = await imageGrid(swatches.slice(0, 4), y, 88);
      if (swatches.length > 4) y = await imageGrid(swatches.slice(4, 8), y, 88);
    } else {
      y = textBox("Fabric swatch", "No image attached; identify this fabric from the written reference above.", y, 38);
    }
    footer();
  }

  doc.addPage(); pageNo += 1; header("1B. Sketch Visuals", pageNo); y = 108;
  if (linkedPlan || linkedTheme?.swatches?.length) {
    y = sectionBar(linkedTheme ? `Fabric reference - Theme "${linkedTheme.theme_name}"` : "Fabric reference - linked Style BOM", y);
    if (linkedPlan) {
      y = table(["Material", "Consumption / garment", "Unit", "To purchase"], (linkedPlan.materials || []).map((m) => [m.material_name, m.consumption_per_unit, m.unit, `${m.required_quantity} ${m.unit}`]), y, [200, 150, 70, 111]);
    }
    if (linkedTheme?.swatches?.length) {
      y = await imageGrid(linkedTheme.swatches.map((s) => s.image_url).filter(Boolean), y, 100);
    }
  }
  if (pack.process_allowances?.length) {
    y = sectionBar("Manual process allowances - "+String(pack.allowance_approval?.status||"NOT REQUIRED").replaceAll("_"," "), y);
    y = table(["Process", "Allowance", "Fabric", "Value / basis", "Worker", "Reason"], pack.process_allowances.map((row) => [
      row.process, row.allowance_type, row.fabric_reference || "All",
      row.value+" "+String(row.unit||"").replaceAll("_"," / ")+" · "+row.basis,
      row.worker_scope, row.reason,
    ]), y, [60, 88, 70, 105, 65, 143]);
    if (pack.allowance_approval?.note) y = textBox("HQ decision note", pack.allowance_approval.note, y, 38);
  }
  y = sectionBar("Front, back and reference views", y); y = await imageGrid(imageGroups.sketch, y, 190);
  if (!imageGroups.sketch.length) y = textBox("Sketch reference", "No sketch image attached. Use the written description and upload a front/back reference before issuing to the job worker.", y, 50); footer();

  doc.addPage(); pageNo += 1; header("2A. Spec Sheet Reference", pageNo); y = 108; y = sectionBar("Measurement drawing and POM callouts", y);
  y = await imageGrid(imageGroups.spec, y, 285);
  if (!imageGroups.spec.length) y = textBox("Measurement reference", "No measurement drawing attached. Confirm every POM instruction in the table before cutting or inspection.", y, 55);
  y = textBox("General measurement notes", pack.measurement_notes || "Measure the finished garment flat unless a row states otherwise.", y, 55); footer();

  doc.addPage(); pageNo += 1; header("2B. POM & Size Grading", pageNo); y = 108; y = sectionBar("Point of Measure instructions", y);
  const sizes = Array.isArray(pack.sizes) ? pack.sizes : String(pack.sizes || "").split(",").map((size) => size.trim()).filter(Boolean);
  y = table(["Code", "POM / Measurement", "How to measure", "Unit", "Tolerance", "Grade rule"], (pack.measurement_rows || []).map((row) => [row.pom_code, row.point, row.measure_instruction, row.unit || "cm", row.tolerance, row.grade_rule]), y, [44, 112, 194, 40, 55, 82]);
  y = sectionBar(`Approved measurements${pack.sample_size ? ` - base/sample ${pack.sample_size}` : ""}`, y);
  const specColumns = ["POM", "Sample", ...sizes]; const specWidths = [150, 70, ...sizes.map(() => (contentWidth - 220) / Math.max(sizes.length, 1))];
  y = table(specColumns, (pack.measurement_rows || []).map((row) => [`${row.pom_code ? `${row.pom_code} - ` : ""}${row.point}`, row.sample_value, ...sizes.map((size) => row.grades?.[size] || "")]), y, specWidths); footer();

  doc.addPage(); pageNo += 1; header("3. Construction Details", pageNo); y = 108; y = sectionBar("Construction and finishing instructions", y); y = textBox("Details", pack.construction_notes, y, 80); y = await imageGrid(imageGroups.details, y, 205);
  if (!imageGroups.details.length) y = textBox("Detail reference", "No enlarged construction image attached. Follow the construction notes above and request clarification before production if anything is unclear.", y, 50); footer();

  doc.addPage(); pageNo += 1; header("4. Artwork & Placement", pageNo); y = 108; y = sectionBar("Artwork reference", y);
  y = textBox("Placement and dimensions", [pack.artwork_placement, pack.artwork_width_cm && `Width: ${pack.artwork_width_cm} cm`, pack.artwork_height_cm && `Height: ${pack.artwork_height_cm} cm`].filter(Boolean).join(" | "), y, 45); y = textBox("Artwork instructions", pack.artwork_notes, y, 62); y = await imageGrid(imageGroups.artwork, y, 205);
  if (!imageGroups.artwork.length) y = textBox("Artwork reference", "No artwork file is attached for this style.", y, 40); footer();

  doc.addPage(); pageNo += 1; header("5. Trims, Labels & Packaging", pageNo); y = 108; y = sectionBar("Trim specification", y);
  y = table(["Description", "Colour", "Size", "Supplier", "Qty", "Price"], (pack.trims_items || []).map((item) => [item.description, item.color, item.size, item.supplier, item.quantity, item.price]), y, [150, 72, 55, 105, 52, 63]); y = textBox("Trim / label notes", pack.trims_labels_notes, y, 44); y = await imageGrid(imageGroups.trims, y, 160); footer();

  doc.addPage(); pageNo += 1; header("6. Colourways, Comments & Handover", pageNo); y = 108; y = sectionBar("Colour and fabric combinations", y);
  y = table(["Colourway", "Fabric reference", "Thread / trim reference"], (pack.colourways || []).map((row) => [row.name, row.fabric_ref, row.thread_ref]), y, [150, 180, 197]);
  y = await imageGrid((Array.isArray(pack.colourways) ? pack.colourways : []).map((row) => row.image_url), y, 90);
  y = textBox("Colourway notes", pack.colourway_notes, y, 42); y = await imageGrid(imageGroups.colourway, y, 125);
  y = sectionBar("Job worker acknowledgement", y); doc.setDrawColor(148, 163, 184); doc.rect(margin, y, contentWidth, 100); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(51, 65, 85);
  doc.text("I have reviewed this Tech Pack, all supplied references and the stated version. I will request clarification before starting work if any item is unclear.", margin + 10, y + 18, { maxWidth: contentWidth - 20 });
  doc.line(margin + 10, y + 62, margin + 205, y + 62); doc.line(margin + 225, y + 62, margin + 375, y + 62); doc.line(margin + 395, y + 62, pageWidth - margin - 10, y + 62);
  doc.setFontSize(7.5); doc.text("Job worker name / signature", margin + 10, y + 76); doc.text("Date", margin + 225, y + 76); doc.text("Production comments", margin + 395, y + 76); y += 110;
  y = textBox("Attached document links", (Array.isArray(pack.document_urls) ? pack.document_urls : []).join("\n"), y, 42); footer();

  doc.save(`${String(pack.design_no || pack.tech_pack_no || "tech-pack").replace(/[^a-z0-9_-]+/gi, "-")}-${pack.version || "v1"}.pdf`);
}

// eslint-disable-next-line react-refresh/only-export-components
export async function downloadTechPackPdf(pack, plans = []) {
  try {
    await buildTechPackPdf(pack, plans);
    return true;
  } catch (error) {
    console.error("Tech Pack PDF generation failed", error);
    if (typeof window !== "undefined") window.alert(`PDF could not be generated: ${error?.message || "Unknown error"}. Please check the Tech Pack images and try again.`);
    return false;
  }
}
function ImageUploadSection({ label, hint, previews, onAdd, onRemove }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-black text-slate-700">{label}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
      <input type="file" accept="image/*" multiple onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }}
        className="mt-2 w-full rounded-xl border border-dashed border-violet-200 bg-white px-3 py-2 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white" />
      {previews?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {previews.map((src, index) => (
            <div key={src} className="relative">
              <img src={src} alt={label} className="h-14 w-14 rounded-lg border border-slate-200 object-cover" />
              <button type="button" onClick={() => onRemove(index)} className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-[10px] font-black text-white">x</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FabricReferenceEditor({ rows, onChange, onAddImages, onRemoveImage, onAddRow, onRemoveRow, linkedPlan }) {
  const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100";
  const materials = linkedPlan?.materials || [];
  const field = (label, control, hint = "") => <label className="block text-xs font-bold uppercase tracking-wide text-slate-500"><span>{label}</span>{hint && <span className="ml-1 normal-case font-normal tracking-normal text-slate-400">— {hint}</span>}{control}</label>;
  return (
    <div className="rounded-2xl border border-violet-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-sm font-black text-slate-900">Fabric references and swatches</p><p className="mt-0.5 text-xs leading-5 text-slate-500">Add one row for every fabric used—main body, lining, cuff, collar or contrast. Images are optional; attach close-up swatches so cutting and production can identify the correct material.</p></div>
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700">OPTIONAL · MULTIPLE ALLOWED</span>
      </div>
      <div className="mt-4 space-y-4">
        {rows.map((row, index) => (
          <article key={index} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-2"><p className="font-black text-slate-800">Fabric {index + 1}{row.reference_name ? ` · ${row.reference_name}` : ""}</p><button type="button" disabled={rows.length === 1} onClick={() => onRemoveRow(index)} className="rounded-lg border border-rose-100 bg-white px-2.5 py-1 text-xs font-bold text-rose-600 disabled:text-slate-300">Remove</button></div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {field("Reference name *", <input className={`${inputClass} mt-1`} value={row.reference_name} onChange={(e) => onChange(index, "reference_name", e.target.value)} placeholder="Main fabric / Lining / Cuff" />, "required only when saving this row")}
              {field("Used at / placement", <input className={`${inputClass} mt-1`} value={row.usage} onChange={(e) => onChange(index, "usage", e.target.value)} placeholder="Body, collar, cuff, pocket" />)}
              {field("Fabric type", <input className={`${inputClass} mt-1`} value={row.fabric_type} onChange={(e) => onChange(index, "fabric_type", e.target.value)} placeholder="Woven cotton, knit rib, denim" />)}
              {field("Composition", <input className={`${inputClass} mt-1`} value={row.composition} onChange={(e) => onChange(index, "composition", e.target.value)} placeholder="80% cotton, 20% polyester" />)}
              {field("Colour / shade", <input className={`${inputClass} mt-1`} value={row.color} onChange={(e) => onChange(index, "color", e.target.value)} placeholder="Off white / Stone grey" />)}
              {field("Colour code", <input className={`${inputClass} mt-1`} value={row.color_code} onChange={(e) => onChange(index, "color_code", e.target.value)} placeholder="Pantone / internal shade code" />)}
            </div>

            <div className="mt-3 rounded-xl border border-dashed border-violet-200 bg-white p-3">
              <label className="block text-xs font-black uppercase tracking-wide text-slate-600">Fabric swatch images <span className="font-normal normal-case tracking-normal text-slate-400">— optional, up to 8 per fabric</span>
                <input type="file" accept="image/*" multiple onChange={(e) => { onAddImages(index, e.target.files); e.target.value = ""; }} className="mt-2 w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white" />
              </label>
              {row.image_previews?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{row.image_previews.map((src, imageIndex) => <div key={`${src}-${imageIndex}`} className="relative"><img src={src} alt={`${row.reference_name || `Fabric ${index + 1}`} swatch ${imageIndex + 1}`} className="h-20 w-20 rounded-xl border border-slate-200 object-cover" /><button type="button" onClick={() => onRemoveImage(index, imageIndex)} className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-[10px] font-black text-white">x</button></div>)}</div>}
            </div>

            <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-xs font-black text-violet-700">Technical sourcing and cutting details</summary>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">Use these when the worker must match weight, width, consumption, lot, grain direction or shrinkage. Leave unknown fields blank instead of guessing.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {field("GSM / weight", <input className={`${inputClass} mt-1`} value={row.gsm} onChange={(e) => onChange(index, "gsm", e.target.value)} placeholder="180 GSM" />)}
                {field("Width", <input className={`${inputClass} mt-1`} value={row.width} onChange={(e) => onChange(index, "width", e.target.value)} placeholder="58 inches / 147 cm" />)}
                {field("Consumption / garment", <input className={`${inputClass} mt-1`} value={row.consumption} onChange={(e) => onChange(index, "consumption", e.target.value)} placeholder="1.85" />)}
                {field("Consumption unit", <select className={`${inputClass} mt-1`} value={row.unit} onChange={(e) => onChange(index, "unit", e.target.value)}><option>metres</option><option>yards</option><option>kg</option><option>grams</option><option>pieces</option></select>)}
                {field("Supplier", <input className={`${inputClass} mt-1`} value={row.supplier} onChange={(e) => onChange(index, "supplier", e.target.value)} placeholder="Supplier name" />)}
                {field("Supplier fabric ref", <input className={`${inputClass} mt-1`} value={row.supplier_ref} onChange={(e) => onChange(index, "supplier_ref", e.target.value)} placeholder="Mill / vendor article code" />)}
                {field("Lot / batch", <input className={`${inputClass} mt-1`} value={row.lot_no} onChange={(e) => onChange(index, "lot_no", e.target.value)} placeholder="Optional approved lot" />)}
                {field("BOM material link", <select className={`${inputClass} mt-1`} value={row.bom_material} onChange={(e) => onChange(index, "bom_material", e.target.value)}><option value="">Not linked</option>{materials.map((item, materialIndex) => <option key={`${item.material_name}-${materialIndex}`} value={item.material_name}>{item.material_name}</option>)}</select>, materials.length ? "from selected Style BOM" : "link a Style BOM above first")}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {field("Grain / nap / print direction", <textarea rows="2" className={`${inputClass} mt-1`} value={row.grain_notes} onChange={(e) => onChange(index, "grain_notes", e.target.value)} placeholder="One-way print; cut all panels in same direction" />)}
                {field("Shrinkage / tolerance", <textarea rows="2" className={`${inputClass} mt-1`} value={row.shrinkage} onChange={(e) => onChange(index, "shrinkage", e.target.value)} placeholder="Pre-wash; 3% length shrinkage" />)}
                {field("Handling / cutting notes", <textarea rows="2" className={`${inputClass} mt-1`} value={row.handling_notes} onChange={(e) => onChange(index, "handling_notes", e.target.value)} placeholder="Avoid defects; match checks at side seam" />)}
              </div>
            </details>
          </article>
        ))}
      </div>
      <button type="button" onClick={onAddRow} className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-black text-violet-700">+ Add fabric reference</button>
    </div>
  );
}

function ProcessAllowanceEditor({ rows, onChange, onAdd, onRemove, policy, fabricReferences }) {
  const input = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-violet-400";
  const units = ["inches","centimetres","metres","percent","pieces","inches_per_lay"];
  const setProcess = (index, process) => {
    const rule = policy[process] || DEFAULT_ALLOWANCE_POLICY[process];
    onChange(index, "process", process);
    onChange(index, "unit", rule.unit);
  };
  return <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-black text-slate-900">Manual process allowances &amp; wastage</p><p className="mt-1 text-xs leading-5 text-slate-600">Nothing is added automatically. Add only what this design needs. An entry above its tenant limit is sent to HQ and blocks release until approved.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-amber-700">OPTIONAL · MANUAL</span></div>
    <div className="mt-4 space-y-3">{rows.map((row,index)=>{const rule=policy[row.process]||DEFAULT_ALLOWANCE_POLICY[row.process];const exceeds=allowanceExceedsPolicy(row,rule);return <article key={index} className={"rounded-xl border bg-white p-3 "+(exceeds?"border-rose-300":"border-slate-200")}>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-[10px] font-black uppercase text-slate-500">Process<select value={row.process} onChange={event=>setProcess(index,event.target.value)} className={input}>{Object.keys(DEFAULT_ALLOWANCE_POLICY).map(value=><option key={value}>{value}</option>)}</select></label>
        <label className="text-[10px] font-black uppercase text-slate-500">Allowance / loss type<input value={row.allowance_type} onChange={event=>onChange(index,"allowance_type",event.target.value)} placeholder="Seam, end loss, defects..." className={input}/></label>
        <label className="text-[10px] font-black uppercase text-slate-500">Fabric reference<select value={row.fabric_reference} onChange={event=>onChange(index,"fabric_reference",event.target.value)} className={input}><option value="">All / not fabric-specific</option>{fabricReferences.filter(item=>item.reference_name).map((item,i)=><option key={i}>{item.reference_name}</option>)}</select></label>
        <label className="text-[10px] font-black uppercase text-slate-500">Internal / external<select value={row.worker_scope} onChange={event=>onChange(index,"worker_scope",event.target.value)} className={input}><option value="ANY">Any worker</option><option value="INTERNAL">Internal</option><option value="EXTERNAL">External job worker</option></select></label>
        <label className="text-[10px] font-black uppercase text-slate-500">Manual value<input type="number" min="0" step="0.01" value={row.value} onChange={event=>onChange(index,"value",event.target.value)} className={input}/></label>
        <label className="text-[10px] font-black uppercase text-slate-500">Unit<select value={row.unit} onChange={event=>onChange(index,"unit",event.target.value)} className={input}>{units.map(value=><option key={value} value={value}>{value.replaceAll("_"," / ")}</option>)}</select></label>
        <label className="text-[10px] font-black uppercase text-slate-500">Basis<input value={row.basis} onChange={event=>onChange(index,"basis",event.target.value)} placeholder="per garment / per lay" className={input}/></label>
        <div className="flex items-end"><button type="button" disabled={rows.length===1} onClick={()=>onRemove(index)} className="w-full rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-30">Remove</button></div>
      </div>
      <label className="mt-2 block text-[10px] font-black uppercase text-slate-500">Reason / technical justification<textarea rows="2" value={row.reason} onChange={event=>onChange(index,"reason",event.target.value)} placeholder={exceeds?"Required because this exceeds the HQ limit.":"Explain why this allowance is needed."} className={input}/></label>
      <p className={"mt-2 text-[11px] font-bold "+(exceeds?"text-rose-700":"text-slate-500")}>{exceeds?"HQ approval required before release.":"HQ exception limit: "+rule.value+" "+rule.unit.replaceAll("_"," / ")+". Length units are converted; a non-comparable unit is sent to HQ for review."}</p>
    </article>})}</div>
    <button type="button" onClick={onAdd} className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-black text-amber-800">+ Add process allowance</button>
  </div>;
}

function PackModal({ plans = [], themes = [], allowancePolicy = DEFAULT_ALLOWANCE_POLICY, pack = null, onClose, onSaved }) {
  const editing = Boolean(pack?.id);
  const [form, setForm] = useState(() => Object.fromEntries(Object.keys(emptyPack).map((key) => [key, key === "sizes" ? (pack?.sizes || []).join(", ") : key === "reference_images" || key === "document_urls" ? (pack?.[key] || []).join("\n") : pack?.[key] ?? emptyPack[key]])));
  const [sizeList, setSizeList] = useState(() => pack?.sizes || []);
  const [measurementRows, setMeasurementRows] = useState(() => pack?.measurement_rows?.length
    ? pack.measurement_rows.map((row) => ({ ...emptyMeasurementRow(pack?.sizes || []), ...row }))
    : [emptyMeasurementRow(pack?.sizes || [])]);
  const [trimRows, setTrimRows] = useState(() => pack?.trims_items?.length ? pack.trims_items : [emptyTrimRow()]);
  const [colourways, setColourways] = useState(() => pack?.colourways?.length ? pack.colourways.map((row) => ({ ...row, image_file: null, image_preview: row.image_url || "" })) : [emptyColourway()]);
  const [fabricReferences, setFabricReferences] = useState(() => pack?.fabric_references?.length
    ? pack.fabric_references.map((row) => ({ ...emptyFabricReference(), ...row, image_urls: cleanAssetUrls(row.image_urls), image_previews: cleanAssetUrls(row.image_urls) }))
    : [emptyFabricReference()]);
  const [processAllowances, setProcessAllowances] = useState(() => pack?.process_allowances?.length
    ? pack.process_allowances.map((row) => ({ ...emptyProcessAllowance(), ...row }))
    : [emptyProcessAllowance()]);
  const [images, setImages] = useState({}); // newly selected files by category
  const [previews, setPreviews] = useState(() => Object.fromEntries(IMAGE_SECTIONS.map(([key]) => [key, pack?.[`${key}_images`] || []])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectedTheme = themes.find((theme) => theme.id === form.theme_id) || themeReference(pack);
  const selectTheme = (themeId) => { const theme = themes.find((item) => item.id === themeId); setForm((current) => ({ ...current, theme_id: themeId, theme_name: theme?.theme_name || (themeId ? current.theme_name : ""), collection: theme?.collection || (themeId ? current.collection : ""), department: theme?.department || current.department })); };

  const applySizes = (raw) => {
    update("sizes", raw);
    const parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);
    setSizeList(parsed);
    setMeasurementRows((rows) => rows.map((row) => ({ ...row, grades: Object.fromEntries(parsed.map((s) => [s, row.grades?.[s] || ""])) })));
  };

  const changeMeasurement = (index, key, value, size) => setMeasurementRows((rows) => rows.map((row, i) => {
    if (i !== index) return row;
    if (key === "grade") return { ...row, grades: { ...row.grades, [size]: value } };
    return { ...row, [key]: value };
  }));
  const changeTrim = (index, key, value) => setTrimRows((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  const changeColourway = (index, key, value) => setColourways((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  const changeFabricReference = (index, key, value) => setFabricReferences((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  const addFabricImages = (index, files) => {
    const accepted = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    if (!accepted.length) return;
    setFabricReferences((rows) => rows.map((row, i) => {
      if (i !== index) return row;
      const room = Math.max(0, 8 - (row.image_previews?.length || 0));
      const selected = accepted.slice(0, room);
      return {
        ...row,
        image_files: [...(row.image_files || []), ...selected],
        image_previews: [...(row.image_previews || []), ...selected.map((file) => URL.createObjectURL(file))],
      };
    }));
  };
  const removeFabricImage = (rowIndex, imageIndex) => setFabricReferences((rows) => rows.map((row, index) => {
    if (index !== rowIndex) return row;
    const existingCount = (row.image_urls || []).length;
    return {
      ...row,
      image_urls: imageIndex < existingCount ? row.image_urls.filter((_, i) => i !== imageIndex) : row.image_urls,
      image_files: imageIndex >= existingCount ? (row.image_files || []).filter((_, i) => i !== imageIndex - existingCount) : row.image_files,
      image_previews: (row.image_previews || []).filter((_, i) => i !== imageIndex),
    };
  }));
  const setColourwayImage = (index, files) => {
    const file = Array.from(files || []).find((item) => item.type.startsWith("image/"));
    if (!file) return;
    setColourways((rows) => rows.map((row, i) => i === index ? { ...row, image_file: file, image_preview: URL.createObjectURL(file) } : row));
  };

  const addImages = (category, files) => {
    const accepted = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    if (!accepted.length) return;
    setImages((current) => ({ ...current, [category]: [...(current[category] || []), ...accepted] }));
    setPreviews((current) => ({ ...current, [category]: [...(current[category] || []), ...accepted.map((file) => URL.createObjectURL(file))] }));
  };
  const removeImage = (category, index) => {
    const existingCount = (previews[category] || []).length - (images[category] || []).length;
    if (index >= existingCount) setImages((current) => ({ ...current, [category]: (current[category] || []).filter((_, i) => i !== index - existingCount) }));
    setPreviews((current) => ({ ...current, [category]: (current[category] || []).filter((_, i) => i !== index) }));
  };

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const incompleteFabric = fabricReferences.find((row) => !row.reference_name.trim() && (
        [row.usage, row.fabric_type, row.composition, row.color, row.color_code, row.gsm, row.width, row.consumption,
          row.supplier, row.supplier_ref, row.lot_no, row.grain_notes, row.shrinkage, row.handling_notes, row.bom_material]
          .some((value) => String(value || "").trim()) || row.image_previews?.length
      ));
      if (incompleteFabric) throw new Error("Give every entered fabric a reference name (for example Main fabric, Lining or Cuff fabric), or remove its unfinished row.");
      const cleanMeasurementRows = measurementRows.filter((row) => row.point.trim());
      const cleanTrimRows = trimRows.filter((row) => row.description.trim());
      const cleanColourways = colourways.filter((row) => row.name.trim());
      const cleanFabricReferences = fabricReferences.filter((row) => row.reference_name.trim());
      const cleanProcessAllowances = processAllowances.filter((row) => Number(row.value) > 0);
      const serializableColourways = cleanColourways.map((row) => ({ name: row.name, fabric_ref: row.fabric_ref, thread_ref: row.thread_ref, image_url: row.image_url || "" }));
      const serializableFabricReferences = cleanFabricReferences.map((row) => ({
        reference_name: row.reference_name, usage: row.usage, fabric_type: row.fabric_type, composition: row.composition,
        color: row.color, color_code: row.color_code, gsm: row.gsm, width: row.width,
        consumption: row.consumption, unit: row.unit, supplier: row.supplier, supplier_ref: row.supplier_ref,
        lot_no: row.lot_no, grain_notes: row.grain_notes, shrinkage: row.shrinkage,
        handling_notes: row.handling_notes, bom_material: row.bom_material, image_urls: cleanAssetUrls(row.image_urls),
      }));
      const fabricImageCount = cleanFabricReferences.reduce((sum, row) => sum + (row.image_files?.length || 0), 0);
      const imageCount = Object.values(images).reduce((sum, list) => sum + (list?.length || 0), 0) + cleanColourways.filter((row) => row.image_file).length + fabricImageCount;
      let result;
      if (imageCount > 0) {
        // Multipart: every field must be a single string value (repeated
        // form keys would otherwise overwrite each other on the backend),
        // so arrays go over the wire newline-joined or JSON-encoded.
        const body = new FormData();
        Object.entries(form).forEach(([key, value]) => {
          if (key === "reference_images" || key === "document_urls" || key === "sizes") return;
          body.append(key, value ?? "");
        });
        body.append("reference_images", form.reference_images);
        body.append("document_urls", form.document_urls);
        body.append("sizes", JSON.stringify(sizeList));
        body.append("measurement_rows", JSON.stringify(cleanMeasurementRows));
        body.append("trims_items", JSON.stringify(cleanTrimRows));
        body.append("colourways", JSON.stringify(serializableColourways));
        body.append("fabric_references", JSON.stringify(serializableFabricReferences));
        body.append("process_allowances", JSON.stringify(cleanProcessAllowances));
        IMAGE_SECTIONS.forEach(([category]) => body.append(`${category}_images`, JSON.stringify((previews[category] || []).filter((url) => !url.startsWith("blob:")))));
        Object.entries(images).forEach(([category, files]) => (files || []).forEach((file) => body.append(`pack_image_${category}`, file)));
        cleanColourways.forEach((row, index) => { if (row.image_file) body.append(`pack_image_colourway_row_${index}`, row.image_file); });
        cleanFabricReferences.forEach((row, index) => (row.image_files || []).forEach((file) => body.append(`pack_image_fabric_row_${index}`, file)));
        result = await api(editing ? `/tech-packs/${pack.id}` : "/tech-packs", { method: editing ? "PUT" : "POST", body });
      } else {
        const jsonPayload = {
          ...form,
          reference_images: form.reference_images.split("\n").map((x) => x.trim()).filter(Boolean),
          document_urls: form.document_urls.split("\n").map((x) => x.trim()).filter(Boolean),
          sizes: JSON.stringify(sizeList),
          measurement_rows: JSON.stringify(cleanMeasurementRows),
          trims_items: JSON.stringify(cleanTrimRows),
          colourways: JSON.stringify(serializableColourways),
          fabric_references: JSON.stringify(serializableFabricReferences),
          process_allowances: JSON.stringify(cleanProcessAllowances),
          ...Object.fromEntries(IMAGE_SECTIONS.map(([category]) => [`${category}_images`, (previews[category] || []).filter((url) => !url.startsWith("blob:"))])),
        };
        result = await api(editing ? `/tech-packs/${pack.id}` : "/tech-packs", { method: editing ? "PUT" : "POST", body: JSON.stringify(jsonPayload) });
      }
      onSaved(result.data, result.message);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm"><section className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Product development</p><h2 className="mt-1 text-xl font-black text-slate-900">{editing ? "Edit tech pack" : "Create tech pack"}</h2><p className="mt-1 text-xs text-slate-500">One reusable approved instruction set for a design; assign it to any job work order.</p></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-xl text-slate-500">x</button></header>
    <form onSubmit={submit} className="space-y-6 p-6">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Design no. *"><input required value={form.design_no} onChange={(e) => update("design_no", e.target.value)} placeholder="e.g. D.NO 278 A" /></Field>
        <Field label="Style name *"><input required value={form.style_name} onChange={(e) => update("style_name", e.target.value)} placeholder="e.g. Embroidered cord set" /></Field>
        <Field label="Department"><input value={form.department} onChange={(e) => update("department", e.target.value)} placeholder="Women / Men / Kids" /></Field>
        <Field label="Version"><input value={form.version} onChange={(e) => update("version", e.target.value)} placeholder="v1" /></Field>
        <Field label="Sample size"><input value={form.sample_size} onChange={(e) => update("sample_size", e.target.value)} placeholder="e.g. M or 40" /></Field>
        <Field label="Link Style BOM"><select value={form.material_plan_id} onChange={(e) => update("material_plan_id", e.target.value)}><option value="">No BOM linked yet</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_no} - {plan.style_name}</option>)}</select></Field>
                {themes.length > 0 && <Field label="Approved Design theme (optional)"><select value={form.theme_id} onChange={(e) => selectTheme(e.target.value)}><option value="">No linked approved theme</option>{themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.theme_name}{theme.collection ? ` - ${theme.collection}` : ""}</option>)}</select></Field>}
        <Field label="Theme (optional)"><input disabled={Boolean(form.theme_id)} value={form.theme_name} onChange={(e) => update("theme_name", e.target.value)} placeholder="e.g. Neo Heritage" /></Field>
        <Field label="Collection (optional)"><input disabled={Boolean(form.theme_id)} value={form.collection} onChange={(e) => update("collection", e.target.value)} placeholder="e.g. Winter 2026" /></Field>
        <Field label="Designer (optional)"><input value={form.designer_name} onChange={(e) => update("designer_name", e.target.value)} placeholder="Designer name" /></Field>
      </div>
      {selectedTheme && form.theme_id && <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-slate-700"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-violet-900">Inherited approved direction: {selectedTheme.theme_name}</p><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">LOCKED SNAPSHOT ON SAVE</span></div>{selectedTheme.creative_direction && <p className="mt-2 leading-6">{selectedTheme.creative_direction}</p>}{selectedTheme.palette?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{selectedTheme.palette.map((colour, index) => <span key={`${colour}-${index}`} title={colour} className="h-7 w-7 rounded-full border-2 border-white shadow ring-1 ring-slate-200" style={{ backgroundColor: colour }} />)}</div>}<p className="mt-2 text-xs text-violet-700">To change approved direction, create and approve a new theme in Design & Pattern; do not overwrite production history.</p></div>}

      {/* 1. Sketch */}
      <Section number="1" title="Sketch" subtitle="Illustration, flat drawing or photo - front and back views ideally.">
        <Field label="Sketch notes"><textarea rows="2" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Front/back/side reference, fit, silhouette and the main construction intent." /></Field>
        <Field label="General fabric & material notes"><textarea rows="2" value={form.fabric_notes} onChange={(e) => update("fabric_notes", e.target.value)} placeholder="Instructions that apply across all fabrics; add each actual fabric separately below." /></Field>
        <FabricReferenceEditor
          rows={fabricReferences}
          onChange={changeFabricReference}
          onAddImages={addFabricImages}
          onRemoveImage={removeFabricImage}
          onAddRow={() => setFabricReferences((rows) => [...rows, emptyFabricReference()])}
          onRemoveRow={(index) => setFabricReferences((rows) => rows.filter((_, i) => i !== index))}
          linkedPlan={plans.find((plan) => plan.id === form.material_plan_id)}
        />
        <ProcessAllowanceEditor
          rows={processAllowances}
          policy={allowancePolicy}
          fabricReferences={fabricReferences}
          onChange={(index,key,value)=>setProcessAllowances(current=>current.map((row,i)=>i===index?{...row,[key]:value}:row))}
          onAdd={()=>setProcessAllowances(current=>[...current,emptyProcessAllowance()])}
          onRemove={(index)=>setProcessAllowances(current=>current.filter((_,i)=>i!==index))}
        />
        <ImageUploadSection label="Sketch images" hint="Enlarge details with measurements - can be in colour." files={images.sketch} previews={previews.sketch} onAdd={(f) => addImages("sketch", f)} onRemove={(i) => removeImage("sketch", i)} />
      </Section>

      {/* 2. Spec Sheet */}
      <Section number="2" title="Spec Sheet" subtitle="Measurements with Point of Measure (POM) instructions, and grading per size.">
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900"><b>How to prepare this section:</b> upload a front/back measurement drawing with POM callout codes, enter the same code in each table row, explain exactly how it is measured, then enter the approved sample and graded size measurements. Leave unknown values blank rather than guessing.</div>
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,.75fr)_minmax(0,1.25fr)]">
          <ImageUploadSection label="Measurement reference images" hint="Upload product drawings or photos with numbered POM callouts. Multiple images are allowed for front, back or detail views." files={images.spec} previews={previews.spec} onAdd={(f) => addImages("spec", f)} onRemove={(i) => removeImage("spec", i)} />
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <Field label="Sizes (comma separated, e.g. S, M, L, XL)"><input value={form.sizes} onChange={(e) => applySizes(e.target.value)} placeholder="S, M, L, XL" /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-violet-50 p-3 text-xs text-violet-800"><b>Base/sample size:</b> {form.sample_size || "Set the Sample size at the top of this Tech Pack."}</div><div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><b>Grading:</b> each POM can have its own increment/rule and exact approved value for every size.</div></div>
            <Field label="Other spec sheet notes (optional)"><textarea rows="2" value={form.measurement_notes || ""} onChange={(e) => update("measurement_notes", e.target.value)} placeholder="General measuring position, garment condition, tolerance policy or grading exceptions." /></Field>
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1500px] w-full text-xs">
            <thead className="bg-slate-50"><tr>
              {[["POM code", "w-24"], ["Measurement point", "w-40"], ["How to measure", "w-64"], ["Unit", "w-20"], [`Sample${form.sample_size ? ` (${form.sample_size})` : ""}`, "w-24"], ["Tolerance", "w-24"], ["Grade rule / increment", "w-40"]].map(([label, width]) => <th key={label} className={`px-3 py-2 text-left font-bold text-slate-500 ${width}`}>{label}</th>)}
              {sizeList.map((size) => <th key={size} className="w-24 px-3 py-2 text-left font-bold text-slate-500">{size}</th>)}
              <th className="w-10" />
            </tr></thead>
            <tbody>
              {measurementRows.map((row, index) => (
                <tr key={index} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2"><input value={row.pom_code || ""} onChange={(e) => changeMeasurement(index, "pom_code", e.target.value)} placeholder={`P${index + 1}`} className="w-20 rounded-lg border border-slate-200 px-2 py-1.5" /></td>
                  <td className="px-3 py-2"><input value={row.point} onChange={(e) => changeMeasurement(index, "point", e.target.value)} placeholder="Chest width" className="w-36 rounded-lg border border-slate-200 px-2 py-1.5" /></td>
                  <td className="px-3 py-2"><textarea rows="2" value={row.measure_instruction || ""} onChange={(e) => changeMeasurement(index, "measure_instruction", e.target.value)} placeholder="Measure straight across, 2.5 cm below armhole" className="w-60 rounded-lg border border-slate-200 px-2 py-1.5" /></td>
                  <td className="px-3 py-2"><select value={row.unit || "cm"} onChange={(e) => changeMeasurement(index, "unit", e.target.value)} className="w-20 rounded-lg border border-slate-200 px-2 py-1.5"><option>cm</option><option>inch</option><option>mm</option></select></td>
                  <td className="px-3 py-2"><input value={row.sample_value} onChange={(e) => changeMeasurement(index, "sample_value", e.target.value)} placeholder="50" className="w-20 rounded-lg border border-slate-200 px-2 py-1.5" /></td>
                  <td className="px-3 py-2"><input value={row.tolerance || ""} onChange={(e) => changeMeasurement(index, "tolerance", e.target.value)} placeholder="±0.5" className="w-20 rounded-lg border border-slate-200 px-2 py-1.5" /></td>
                  <td className="px-3 py-2"><input value={row.grade_rule || ""} onChange={(e) => changeMeasurement(index, "grade_rule", e.target.value)} placeholder="+2 cm each size" className="w-36 rounded-lg border border-slate-200 px-2 py-1.5" /></td>
                  {sizeList.map((size) => <td key={size} className="px-3 py-2"><input value={row.grades?.[size] || ""} onChange={(e) => changeMeasurement(index, "grade", e.target.value, size)} placeholder={size} className="w-20 rounded-lg border border-slate-200 px-2 py-1.5" /></td>)}
                  <td className="px-1 py-2"><button type="button" disabled={measurementRows.length === 1} onClick={() => setMeasurementRows((rows) => rows.filter((_, i) => i !== index))} className="px-2 text-lg font-bold text-rose-500 disabled:text-slate-300">x</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setMeasurementRows((rows) => [...rows, emptyMeasurementRow(sizeList)])} className="text-sm font-bold text-violet-700">+ Add measurement point</button>
      </Section>

      {/* 3. Details */}
      <Section number="3" title="Details" subtitle="Enlarged special construction details, with measurements.">
        <Field label="Construction notes"><textarea rows="3" value={form.construction_notes} onChange={(e) => update("construction_notes", e.target.value)} placeholder="Stitch type, collar, pocket, seam, finishing and quality details." /></Field>
        <ImageUploadSection label="Detail images" hint="Enlarge details with measurements - can be in colour." files={images.details} previews={previews.details} onAdd={(f) => addImages("details", f)} onRemove={(i) => removeImage("details", i)} />
      </Section>

      {/* 4. Artwork */}
      <Section number="4" title="Artwork" subtitle="Print/embroidery/flocking artwork, actual size or to scale, with colour and material references.">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Width (cm)"><input value={form.artwork_width_cm} onChange={(e) => update("artwork_width_cm", e.target.value)} placeholder="15" /></Field>
          <Field label="Height (cm)"><input value={form.artwork_height_cm} onChange={(e) => update("artwork_height_cm", e.target.value)} placeholder="15" /></Field>
          <Field label="Placement"><input value={form.artwork_placement} onChange={(e) => update("artwork_placement", e.target.value)} placeholder="e.g. centre chest" /></Field>
        </div>
        <Field label="Artwork notes"><textarea rows="2" value={form.artwork_notes} onChange={(e) => update("artwork_notes", e.target.value)} placeholder="Placement, colour, scale and other artwork instructions." /></Field>
        <ImageUploadSection label="Artwork images" hint="Use actual size or to scale - can be in colour." files={images.artwork} previews={previews.artwork} onAdd={(f) => addImages("artwork", f)} onRemove={(i) => removeImage("artwork", i)} />
      </Section>

      {/* 5. Trims and Label */}
      <Section number="5" title="Trims and Label" subtitle="Drawings or images of trims and label details, ideally in colour with materials.">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50"><tr>{["Description", "Color", "Size", "Supplier", "Quantity", "Price", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-bold text-slate-500">{h}</th>)}</tr></thead>
            <tbody>
              {trimRows.map((row, index) => (
                <tr key={index} className="border-t border-slate-100">
                  {["description", "color", "size", "supplier", "quantity", "price"].map((key) => (
                    <td key={key} className="px-3 py-1.5"><input value={row[key]} onChange={(e) => changeTrim(index, key, e.target.value)} className="w-full min-w-[70px] rounded-lg border border-slate-200 px-2 py-1.5" /></td>
                  ))}
                  <td><button type="button" disabled={trimRows.length === 1} onClick={() => setTrimRows((rows) => rows.filter((_, i) => i !== index))} className="px-2 text-lg font-bold text-rose-500 disabled:text-slate-300">x</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setTrimRows((rows) => [...rows, emptyTrimRow()])} className="text-sm font-bold text-violet-700">+ Add trim</button>
        <ImageUploadSection label="Trim & label images" hint="Show trims, label placement and attachment methods - can be in colour." files={images.trims} previews={previews.trims} onAdd={(f) => addImages("trims", f)} onRemove={(i) => removeImage("trims", i)} />
      </Section>

      {/* 6. Colorways */}
      <Section number="6" title="Colorways" subtitle="Color and fabric references for each combo - swatches should match the corresponding order.">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50"><tr>{["Colourway name", "Fabric reference", "Thread reference", "Image (optional)", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-bold text-slate-500">{h}</th>)}</tr></thead>
            <tbody>
              {colourways.map((row, index) => (
                <tr key={index} className="border-t border-slate-100">
                  {["name", "fabric_ref", "thread_ref"].map((key) => (
                    <td key={key} className="px-3 py-1.5"><input value={row[key]} onChange={(e) => changeColourway(index, key, e.target.value)} className="w-full min-w-[90px] rounded-lg border border-slate-200 px-2 py-1.5" /></td>
                  ))}
                  <td className="min-w-[150px] px-3 py-1.5"><input type="file" accept="image/*" onChange={(e) => { setColourwayImage(index, e.target.files); e.target.value = ""; }} className="w-full text-[10px] file:mr-2 file:rounded-lg file:border-0 file:bg-violet-600 file:px-2 file:py-1.5 file:text-[10px] file:font-bold file:text-white" />{row.image_preview && <div className="relative mt-2 w-fit"><img src={row.image_preview} alt={`${row.name || "Colourway"} preview`} className="h-12 w-12 rounded-lg border object-cover" /><button type="button" onClick={() => setColourways((rows) => rows.map((item, i) => i === index ? { ...item, image_file: null, image_preview: "", image_url: "" } : item))} className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-[10px] font-bold text-white">x</button></div>}</td>
                  <td><button type="button" disabled={colourways.length === 1} onClick={() => setColourways((rows) => rows.filter((_, i) => i !== index))} className="px-2 text-lg font-bold text-rose-500 disabled:text-slate-300">x</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setColourways((rows) => [...rows, emptyColourway()])} className="text-sm font-bold text-violet-700">+ Add colourway</button>
        <ImageUploadSection label="Colourway swatches" hint="Can be in colour." files={images.colourway} previews={previews.colourway} onAdd={(f) => addImages("colourway", f)} onRemove={(i) => removeImage("colourway", i)} />
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Reference image links (one per line, optional)"><textarea rows="2" value={form.reference_images} onChange={(e) => update("reference_images", e.target.value)} placeholder="https://.../front.jpg" /></Field>
        <Field label="PDF / document links (one per line, optional)"><textarea rows="2" value={form.document_urls} onChange={(e) => update("document_urls", e.target.value)} placeholder="https://.../measurement-sheet.pdf" /></Field>
      </div>

      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><b>Important:</b> use a new version (v2, v3) when the approved measurements or construction change. A job work order stores a snapshot so a worker never sees later changes by mistake.</p>
      <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : editing ? "Save changes" : "Save tech pack"}</button></div>
    </form>
  </section></div>;
}

function Section({ number, title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/30 p-4">
      <div className="mb-3 flex items-start gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-black text-white">{number}</span>
        <div><p className="font-black text-slate-900">{title}</p><p className="text-xs text-slate-500">{subtitle}</p></div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }) { return <label className="block text-sm font-bold text-slate-700"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>{React.cloneElement(children, { className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 " + (children.props.className || "") })}</label>; }

function CommentLog({ pack, onUpdated }) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (!note.trim()) return;
    setSending(true); setError("");
    try {
      const result = await api(`/tech-packs/${pack.id}/comments`, { method: "POST", body: JSON.stringify({ note: note.trim() }) });
      setNote("");
      onUpdated?.(result.data);
    } catch (err) { setError(err.message); } finally { setSending(false); }
  };
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Comments</p>
      {error && <p className="mb-2 text-xs font-bold text-rose-600">{error}</p>}
      {pack.comments?.length > 0 ? (
        <div className="space-y-1.5">
          {pack.comments.map((c, i) => (
            <div key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="font-bold text-slate-800">{c.author || "Someone"}</span> <span className="text-slate-400">- {c.date ? new Date(c.date).toLocaleDateString() : ""}</span><p className="mt-0.5 text-slate-600">{c.note}</p></div>
          ))}
        </div>
      ) : <p className="text-xs text-slate-400">No comments yet - a small correction doesn't need a new version, just a note here.</p>}
      <div className="mt-2 flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Use the right button reference" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-violet-400" />
        <button type="button" disabled={sending} onClick={submit} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{sending ? "Adding..." : "Add"}</button>
      </div>
    </div>
  );
}

function PackDetail({ pack, plans, onClose, onUpdated }) {
  const linkedTheme = themeReference(pack);
  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm"><section className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">{pack.tech_pack_no} - {pack.version}</p><h2 className="mt-1 text-xl font-black text-slate-900">{pack.design_no} - {pack.style_name}</h2>{(pack.theme_name || pack.collection || pack.designer_name) && <p className="mt-1 text-xs text-slate-500">{[pack.theme_name && `Theme: ${pack.theme_name}`, pack.collection && `Collection: ${pack.collection}`, pack.designer_name && `Designer: ${pack.designer_name}`].filter(Boolean).join(" - ")}</p>}</div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-xl text-slate-500">x</button></header>
    <div className="space-y-5 p-6 text-sm">
      {linkedTheme && <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-wide text-violet-800">Approved Design direction - {linkedTheme.theme_name}</p><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-violet-700">READ-ONLY SNAPSHOT</span></div><p className="mt-1 text-xs text-slate-500">{[linkedTheme.collection, linkedTheme.season, linkedTheme.department, linkedTheme.target_customer].filter(Boolean).join(" - ")}</p>{linkedTheme.creative_direction && <p className="mt-3 whitespace-pre-line leading-6 text-slate-700">{linkedTheme.creative_direction}</p>}{linkedTheme.palette?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{linkedTheme.palette.map((colour, index) => <span key={`${colour}-${index}`} title={colour} className="h-8 w-8 rounded-full border-2 border-white shadow ring-1 ring-slate-200" style={{ backgroundColor: colour }} />)}</div>}{linkedTheme.moodboard_urls?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{linkedTheme.moodboard_urls.map((src) => <a key={src} href={src} target="_blank" rel="noreferrer"><img src={src} alt="Theme mood board" className="h-20 w-20 rounded-xl border border-violet-100 object-cover" /></a>)}</div>}{linkedTheme.swatches?.some((item) => item.image_url) && <div className="mt-3"><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Production fabric swatches</p><div className="flex flex-wrap gap-2">{linkedTheme.swatches.map((s, i) => s.image_url && <img key={i} src={s.image_url} alt={s.fabric_type || "swatch"} title={`${s.fabric_type || ""} ${s.gsm ? s.gsm + " GSM" : ""} ${s.color || ""} - ${s.vendor_name || ""}`} className="h-16 w-16 rounded-xl border border-slate-200 object-cover" />)}</div></div>}</div>}
      {pack.fabric_references?.length > 0 && <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Sketch fabric references</p><div className="grid gap-3 md:grid-cols-2">{pack.fabric_references.map((fabric, index) => <article key={`${fabric.reference_name}-${index}`} className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-black text-slate-900">{fabric.reference_name}</p><p className="text-xs text-slate-500">{[fabric.usage, fabric.fabric_type, fabric.composition, fabric.color, fabric.color_code].filter(Boolean).join(" · ") || "No descriptive details"}</p></div>{fabric.bom_material && <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-violet-700">BOM: {fabric.bom_material}</span>}</div><p className="mt-2 text-xs leading-5 text-slate-600">{[fabric.gsm && `Weight ${fabric.gsm}`, fabric.width && `Width ${fabric.width}`, fabric.consumption && `${fabric.consumption} ${fabric.unit || ""}/garment`, fabric.supplier && `Supplier ${fabric.supplier}`, fabric.supplier_ref && `Ref ${fabric.supplier_ref}`, fabric.lot_no && `Lot ${fabric.lot_no}`].filter(Boolean).join(" · ")}</p>{[fabric.grain_notes, fabric.shrinkage, fabric.handling_notes].filter(Boolean).map((note, noteIndex) => <p key={noteIndex} className="mt-1 text-xs text-slate-600">{note}</p>)}{fabric.image_urls?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{fabric.image_urls.map((src, imageIndex) => <a key={`${src}-${imageIndex}`} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`${fabric.reference_name} swatch`} className="h-20 w-20 rounded-xl border border-white object-cover shadow-sm" /></a>)}</div>}</article>)}</div></div>}
      {IMAGE_SECTIONS.map(([key, label]) => (pack[`${key}_images`]?.length > 0) && (
        <div key={key}><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{label} images</p><div className="flex flex-wrap gap-2">{pack[`${key}_images`].map((src) => <img key={src} src={src} alt={label} className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />)}</div></div>
      ))}
      {pack.process_allowances?.length > 0 && <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Manual process allowances</p><span className={"rounded-full px-2 py-1 text-[10px] font-black "+(["APPROVED","NOT_REQUIRED"].includes(pack.allowance_approval?.status)?"bg-emerald-100 text-emerald-700":pack.allowance_approval?.status==="PENDING"?"bg-amber-100 text-amber-800":"bg-rose-100 text-rose-700")}>{String(pack.allowance_approval?.status||"NOT_REQUIRED").replaceAll("_"," ")}</span></div><div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-xs"><thead className="bg-slate-50"><tr>{["Process","Type","Fabric","Value","Basis","Scope","Reason"].map(value=><th key={value} className="px-3 py-2 text-left">{value}</th>)}</tr></thead><tbody>{pack.process_allowances.map((row,index)=><tr key={index} className="border-t border-slate-100"><td className="px-3 py-2 font-bold">{row.process}</td><td className="px-3 py-2">{row.allowance_type}</td><td className="px-3 py-2">{row.fabric_reference||"All"}</td><td className="px-3 py-2">{row.value} {String(row.unit||"").replaceAll("_"," / ")}</td><td className="px-3 py-2">{row.basis}</td><td className="px-3 py-2">{row.worker_scope}</td><td className="max-w-xs px-3 py-2">{row.reason||"—"}</td></tr>)}</tbody></table></div>{pack.allowance_approval?.note&&<p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600"><b>HQ note:</b> {pack.allowance_approval.note}</p>}</div>}
      {pack.measurement_rows?.length > 0 && (
        <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Spec sheet</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-[1100px] w-full text-xs"><thead className="bg-slate-50"><tr>{["Code", "Point", "How to measure", "Unit", "Sample", "Tolerance", "Grade rule"].map((heading) => <th key={heading} className="px-3 py-2 text-left">{heading}</th>)}{(pack.sizes || []).map((s) => <th key={s} className="px-3 py-2 text-left">{s}</th>)}</tr></thead><tbody>{pack.measurement_rows.map((row, i) => <tr key={i} className="border-t border-slate-100"><td className="px-3 py-1.5 font-bold text-violet-700">{row.pom_code || `P${i + 1}`}</td><td className="px-3 py-1.5 font-bold">{row.point}</td><td className="max-w-[240px] px-3 py-1.5">{row.measure_instruction || "—"}</td><td className="px-3 py-1.5">{row.unit || "cm"}</td><td className="px-3 py-1.5">{row.sample_value}</td><td className="px-3 py-1.5">{row.tolerance || "—"}</td><td className="px-3 py-1.5">{row.grade_rule || "—"}</td>{(pack.sizes || []).map((s) => <td key={s} className="px-3 py-1.5">{row.grades?.[s] || ""}</td>)}</tr>)}</tbody></table></div>
        </div>
      )}
      {pack.trims_items?.length > 0 && (
        <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Trims & label</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-xs"><thead className="bg-slate-50"><tr>{["Description", "Color", "Size", "Supplier", "Qty", "Price"].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead><tbody>{pack.trims_items.map((row, i) => <tr key={i} className="border-t border-slate-100"><td className="px-3 py-1.5">{row.description}</td><td className="px-3 py-1.5">{row.color}</td><td className="px-3 py-1.5">{row.size}</td><td className="px-3 py-1.5">{row.supplier}</td><td className="px-3 py-1.5">{row.quantity}</td><td className="px-3 py-1.5">{row.price}</td></tr>)}</tbody></table></div>
        </div>
      )}
      {pack.colourways?.length > 0 && (
        <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Colourways</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-xs"><thead className="bg-slate-50"><tr>{["Colourway", "Fabric ref", "Thread ref", "Image"].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead><tbody>{pack.colourways.map((row, i) => <tr key={i} className="border-t border-slate-100"><td className="px-3 py-1.5 font-bold">{row.name}</td><td className="px-3 py-1.5">{row.fabric_ref}</td><td className="px-3 py-1.5">{row.thread_ref}</td><td className="px-3 py-1.5">{row.image_url ? <img src={row.image_url} alt={`${row.name} colourway`} className="h-12 w-12 rounded-lg border object-cover" /> : <span className="text-slate-400">—</span>}</td></tr>)}</tbody></table></div>
        </div>
      )}
      {(pack.artwork_width_cm || pack.artwork_height_cm || pack.artwork_placement) && (
        <div><p className="mb-1 text-xs font-black uppercase tracking-wide text-slate-500">Artwork</p><p className="text-slate-700">{[pack.artwork_width_cm && `${pack.artwork_width_cm} cm wide`, pack.artwork_height_cm && `${pack.artwork_height_cm} cm high`, pack.artwork_placement].filter(Boolean).join(" - ") || "-"}</p></div>
      )}
      {[["Sketch notes", pack.description], ["Fabric & material", pack.fabric_notes], ["Construction", pack.construction_notes], ["Artwork notes", pack.artwork_notes], ["Other spec sheet notes", pack.measurement_notes], ["Other colourway notes", pack.colourway_notes]].filter(([, v]) => v).map(([label, value]) => (
        <div key={label}><p className="mb-1 text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="whitespace-pre-line text-slate-700">{value}</p></div>
      ))}
      <CommentLog pack={pack} onUpdated={onUpdated} />
      <div className="flex justify-end"><button type="button" onClick={() => downloadTechPackPdf(pack, plans)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white">Download PDF</button></div>
    </div>
  </section></div>;
}

export default function TechPackLibrary({ plans = [], themes = [], onSelectForOrder }) {
  const [packs, setPacks] = useState([]);
  const [allowancePolicy, setAllowancePolicy] = useState(DEFAULT_ALLOWANCE_POLICY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingPack, setEditingPack] = useState(null);
  const [viewPack, setViewPack] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api("/tech-packs");
      setPacks(result.data || []);
    } catch (err) {
      setError(err.message);
    }
    try {
      const policyResult = await api("/allowance-policy");
      setAllowancePolicy(policyResult.data || DEFAULT_ALLOWANCE_POLICY);
    } catch {
      // Secondary config for the fabric-allowance workflow — never let it
      // block the tech pack list itself from showing (that used to happen
      // when both calls shared one Promise.all and this one alone failed).
      setAllowancePolicy(DEFAULT_ALLOWANCE_POLICY);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const removePack = async (pack) => {
    if (!window.confirm(`Delete draft Tech Pack ${pack.tech_pack_no}? This cannot be undone.`)) return;
    setError("");
    try {
      const result = await api(`/tech-packs/${pack.id}`, { method: "DELETE" });
      setPacks((current) => current.filter((item) => item.id !== pack.id));
      if (viewPack?.id === pack.id) setViewPack(null);
      window.alert(result.message || "Draft Tech Pack deleted.");
    } catch (err) { setError(err.message); }
  };

  const releasePack = async (pack) => {
    const reason = window.prompt(
      `Release ${pack.tech_pack_no} (${pack.design_no}) straight to Production?\n\n`
      + "This is for a design with no Design Project to route through Production Handoff's normal sign-off "
      + "(e.g. it was already produced/sold in an earlier season). If a Design Project for this design DOES "
      + "exist, cancel and release it from Production Handoff instead so that approval is recorded properly.\n\n"
      + "Enter a reason to continue:"
    );
    if (reason == null) return;
    if (!reason.trim()) { window.alert("A reason is required to release directly."); return; }
    setError("");
    try {
      const result = await api(`/tech-packs/${pack.id}/quick-release`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) });
      await load();
      window.alert(result.message || "Tech pack released to Production.");
    } catch (err) { setError(err.message); }
  };

  return <section className="mb-6 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40">
    <div className="flex flex-col justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-cyan-50 px-6 py-5 sm:flex-row sm:items-center">
      <div><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">Before creating job work</p><h2 className="mt-1 text-xl font-black text-slate-900">Tech Pack Library</h2><p className="mt-1 text-sm text-slate-500">Sketches, measurements, construction, trims, artwork and colourways - one controlled design reference.</p></div>
      <button type="button" onClick={() => setShowCreate(true)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-violet-200 hover:bg-violet-700">+ Create tech pack</button>
    </div>

    <div className="mx-6 mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs leading-5 text-slate-600">
      <p className="mb-1 font-black text-indigo-900">How this works</p>
      <ol className="list-decimal space-y-1 pl-4">
        <li><b className="text-slate-800">Create a tech pack once</b> for a design - Sketch, Spec Sheet, Details, Artwork, Trims and Label, and Colourways.</li>
        <li><b className="text-slate-800">Drafts can be edited or deleted</b> from either Design & Pattern or Production & Job Work under the same tenant.</li>
        <li><b className="text-slate-800">Released packs are protected</b>. Create a new version for changes so existing job-order snapshots remain historically correct.</li>
      </ol>
    </div>

    <details className="mx-6 mt-3 mb-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-black uppercase tracking-wide text-slate-500 hover:bg-slate-50">What each button does</summary>
      <div className="divide-y divide-slate-100 border-t border-slate-100 text-xs leading-5 text-slate-600">
        <div className="grid gap-1.5 p-3.5 sm:grid-cols-[140px_1fr]"><b className="text-slate-800">View</b><p>Read-only preview. Safe anytime.</p></div>
        <div className="grid gap-1.5 p-3.5 sm:grid-cols-[140px_1fr]"><b className="text-slate-800">Edit</b><p>Changes any field while still Draft. Disabled once Released, so a spec Production is already building against can't quietly change.</p></div>
        <div className="grid gap-1.5 p-3.5 sm:grid-cols-[140px_1fr]"><b className="text-slate-800">Delete</b><p>Removes an unused Draft only. Blocked once a job order references it, and never available once Released.</p></div>
        <div className="grid gap-1.5 p-3.5 sm:grid-cols-[140px_1fr]"><b className="text-slate-800">Release</b><p>Releases a Draft straight to Production, skipping Production Handoff's approval screen. Use only for a design with no Design Project to route it through (e.g. it already sold in an earlier season). If a Design Project exists for this design, it's blocked — release it from Production Handoff instead so real sign-off is recorded. Always requires a written reason.</p></div>
        <div className="grid gap-1.5 p-3.5 sm:grid-cols-[140px_1fr]"><b className="text-slate-800">Download PDF</b><p>Exports the pack for sharing outside RMS. Safe anytime.</p></div>
        <div className="grid gap-1.5 p-3.5 sm:grid-cols-[140px_1fr]"><b className="text-slate-800">Use in job order</b><p>Jumps to Production Handoff with this pack pre-selected. Doesn't release anything by itself.</p></div>
      </div>
    </details>

    {packs.some(pack=>["PENDING","REJECTED","CHANGES_REQUESTED","APPROVED"].includes(pack.allowance_approval?.status))&&<div className="mx-6 mt-4 space-y-2">{packs.filter(pack=>["PENDING","REJECTED","CHANGES_REQUESTED","APPROVED"].includes(pack.allowance_approval?.status)).slice(0,6).map(pack=>{const status=pack.allowance_approval.status;const good=status==="APPROVED";const pending=status==="PENDING";return <button type="button" onClick={()=>setViewPack(pack)} key={pack.id} className={"block w-full rounded-xl border p-3 text-left text-xs font-bold "+(good?"border-emerald-200 bg-emerald-50 text-emerald-800":pending?"border-amber-200 bg-amber-50 text-amber-900":"border-rose-200 bg-rose-50 text-rose-800")}>{pack.tech_pack_no} · {pack.design_no}: allowance exception {status.replaceAll("_"," ").toLowerCase()}{pack.allowance_approval.note?" — "+pack.allowance_approval.note:""}. {pending?"Waiting for HQ.":good?"HQ approved it; normal handoff gates still apply.":"Edit the draft and correct/resubmit the allowance."}</button>})}</div>}
    {error && <p className="m-5 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
    {loading ? <p className="p-8 text-center text-sm text-slate-400">Loading tech packs...</p> : packs.length ? <div className="divide-y divide-slate-100">
      {packs.map((pack) => {
        const draft = String(pack.status || "Draft").toUpperCase() === "DRAFT";
        return <article key={pack.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{pack.design_no} - {pack.style_name}</p><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">{pack.version}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{pack.tech_pack_no}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${draft ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{pack.status || "Draft"}</span>{pack.theme_name && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{pack.theme_name}</span>}</div><p className="mt-1 text-xs text-slate-500">{pack.department || "Unassigned department"} - {pack.sample_size ? `Sample ${pack.sample_size}` : "Sample size not set"} - {pack.sizes?.length ? `${pack.sizes.length} size(s) graded` : "No spec sheet"} - {pack.trims_items?.length || 0} trim(s){pack.comments?.length ? ` - ${pack.comments.length} comment(s)` : ""}</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setViewPack(pack)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">View</button>
            <button type="button" disabled={!draft} title={draft ? "Edit this draft" : "Released packs are locked; create a revision instead"} onClick={() => setEditingPack(pack)} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">Edit</button>
            <button type="button" disabled={!draft} title={draft ? "Delete this unused draft" : "Released packs are retained for production history"} onClick={() => removePack(pack)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40">Delete</button>
            {draft && <button type="button" title="Release directly, for a design with no Design Project to route through Production Handoff" onClick={() => releasePack(pack)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Release</button>}
            <button type="button" onClick={() => downloadTechPackPdf(pack, plans)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Download PDF</button>
            <button type="button" onClick={() => onSelectForOrder?.(pack)} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100">Use in job order</button>
          </div>
        </article>;
      })}
    </div> : <div className="p-9 text-center"><p className="font-bold text-slate-700">No tech packs yet</p><p className="mt-1 text-sm text-slate-500">Create a pack first, then choose it for the relevant design line in a job work order.</p></div>}
    {showCreate && <PackModal plans={plans} themes={themes} allowancePolicy={allowancePolicy} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
    {editingPack && <PackModal plans={plans} themes={themes} allowancePolicy={allowancePolicy} pack={editingPack} onClose={() => setEditingPack(null)} onSaved={() => { setEditingPack(null); load(); }} />}
    {viewPack && <PackDetail pack={viewPack} plans={plans} onClose={() => setViewPack(null)} onUpdated={(updated) => { setViewPack(updated); setPacks((current) => current.map((p) => p.id === updated.id ? { ...p, ...updated } : p)); }} />}
  </section>;
}
