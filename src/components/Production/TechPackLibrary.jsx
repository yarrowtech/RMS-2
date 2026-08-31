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
  ["details", "Details", "Enlarged construction details - collar, pocket, cuff etc."],
  ["artwork", "Artwork", "Print/embroidery/flocking artwork, actual size or to scale."],
  ["trims", "Trims & label", "Trim photos, label placement, hangtag."],
  ["colourway", "Colourways", "Swatches for each colour/fabric combo."],
];

const emptyPack = {
  design_no: "", style_name: "", department: "", version: "v1", sample_size: "",
  theme_name: "", collection: "", designer_name: "",
  description: "", fabric_notes: "", construction_notes: "", artwork_notes: "", colourway_notes: "",
  reference_images: "", document_urls: "", material_plan_id: "",
  sizes: "", artwork_width_cm: "", artwork_height_cm: "", artwork_placement: "",
};

const emptyMeasurementRow = (sizes) => ({ point: "", sample_value: "", grades: Object.fromEntries(sizes.map((s) => [s, ""])) });
const emptyTrimRow = () => ({ description: "", color: "", size: "", supplier: "", quantity: "", price: "" });
const emptyColourway = () => ({ name: "", fabric_ref: "", thread_ref: "" });

async function imageToDataUrl(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Image is unavailable");
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export async function downloadTechPackPdf(pack, plans = []) {
  const linkedPlan = pack.material_plan_id ? (plans || []).find((plan) => plan.id === pack.material_plan_id) : null;
  const linkedTheme = pack.linked_theme || null;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 34;
  const contentWidth = pageWidth - margin * 2;
  const safe = (value, fallback = "-") => String(value || fallback);
  const imageGroups = {
    sketch: [...new Set([...(pack.sketch_images || []), ...(pack.reference_images || [])])],
    details: pack.details_images || [], artwork: pack.artwork_images || [], trims: pack.trims_images || [], colourway: pack.colourway_images || [],
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
    doc.setFont("helvetica", "bold"); doc.text(`PAGE ${pageNo} / 6`, pageWidth - margin - 54, 48);
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
    const dataUrls = (await Promise.all((urls || []).slice(0, 4).map(imageToDataUrl))).filter(Boolean);
    if (!dataUrls.length) return y;
    const columns = dataUrls.length === 1 ? 1 : 2; const gap = 8;
    const cellWidth = (contentWidth - gap * (columns - 1)) / columns;
    let x = margin; let rowY = y; let rowHeight = 0;
    dataUrls.forEach((dataUrl, index) => {
      const props = doc.getImageProperties(dataUrl); const height = Math.min(maxHeight, cellWidth * (props.height / props.width));
      if (index && index % columns === 0) { rowY += rowHeight + gap; x = margin; rowHeight = 0; }
      doc.setDrawColor(203, 213, 225); doc.rect(x, rowY, cellWidth, height); doc.addImage(dataUrl, x + 2, rowY + 2, cellWidth - 4, height - 4);
      rowHeight = Math.max(rowHeight, height); x += cellWidth + gap;
    });
    return rowY + rowHeight + 10;
  };

  header("1. Sketch & Design Brief", 1); let y = 108;
  y = sectionBar("Development", y);
  if (pack.theme_name || pack.collection || pack.designer_name) {
    y = textBox("Theme / Collection / Designer", [pack.theme_name && `Theme: ${pack.theme_name}`, pack.collection && `Collection: ${pack.collection}`, pack.designer_name && `Designer: ${pack.designer_name}`].filter(Boolean).join("    |    "), y, 32);
  }
  y = textBox("Description / design brief", pack.description, y, 54); y = textBox("Fabric & material reference", pack.fabric_notes, y, 44);
  if (linkedPlan || linkedTheme?.swatches?.length) {
    y = sectionBar(linkedTheme ? `Fabric reference - Theme "${linkedTheme.theme_name}"` : "Fabric reference - linked Style BOM", y);
    if (linkedPlan) {
      y = table(["Material", "Consumption / garment", "Unit", "To purchase"], (linkedPlan.materials || []).map((m) => [m.material_name, m.consumption_per_unit, m.unit, `${m.required_quantity} ${m.unit}`]), y, [200, 150, 70, 111]);
    }
    if (linkedTheme?.swatches?.length) {
      y = await imageGrid(linkedTheme.swatches.map((s) => s.image_url).filter(Boolean), y, 100);
    }
  }
  y = sectionBar("Front, back and reference views", y); y = await imageGrid(imageGroups.sketch, y, 190);
  if (!imageGroups.sketch.length) y = textBox("Sketch reference", "No sketch image attached. Use the written description and upload a front/back reference before issuing to the job worker.", y, 50); footer();

  doc.addPage(); header("2. Spec Sheet & Measurements", 2); y = 108; y = sectionBar("Point of Measure (POM) and grading", y);
  const sizes = Array.isArray(pack.sizes) ? pack.sizes : String(pack.sizes || "").split(",").map((size) => size.trim()).filter(Boolean);
  const specColumns = ["POM / Measurement", "Sample", ...sizes]; const specWidths = [190, 78, ...sizes.map(() => (contentWidth - 268) / Math.max(sizes.length, 1))];
  y = table(specColumns, (pack.measurement_rows || []).map((row) => [row.point, row.sample_value, ...sizes.map((size) => row.grades?.[size] || "")]), y, specWidths);
  y = textBox("Measurement instructions", pack.measurement_notes || "Measure finished garment flat unless a different instruction is written. Confirm any tolerance with the merchandiser before cutting.", y, 50); footer();

  doc.addPage(); header("3. Construction Details", 3); y = 108; y = sectionBar("Construction and finishing instructions", y); y = textBox("Details", pack.construction_notes, y, 80); y = await imageGrid(imageGroups.details, y, 205);
  if (!imageGroups.details.length) y = textBox("Detail reference", "No enlarged construction image attached. Follow the construction notes above and request clarification before production if anything is unclear.", y, 50); footer();

  doc.addPage(); header("4. Artwork & Placement", 4); y = 108; y = sectionBar("Artwork reference", y);
  y = textBox("Placement and dimensions", [pack.artwork_placement, pack.artwork_width_cm && `Width: ${pack.artwork_width_cm} cm`, pack.artwork_height_cm && `Height: ${pack.artwork_height_cm} cm`].filter(Boolean).join(" | "), y, 45); y = textBox("Artwork instructions", pack.artwork_notes, y, 62); y = await imageGrid(imageGroups.artwork, y, 205);
  if (!imageGroups.artwork.length) y = textBox("Artwork reference", "No artwork file is attached for this style.", y, 40); footer();

  doc.addPage(); header("5. Trims, Labels & Packaging", 5); y = 108; y = sectionBar("Trim specification", y);
  y = table(["Description", "Colour", "Size", "Supplier", "Qty", "Price"], (pack.trims_items || []).map((item) => [item.description, item.color, item.size, item.supplier, item.quantity, item.price]), y, [150, 72, 55, 105, 52, 63]); y = textBox("Trim / label notes", pack.trims_labels_notes, y, 44); y = await imageGrid(imageGroups.trims, y, 160); footer();

  doc.addPage(); header("6. Colourways, Comments & Handover", 6); y = 108; y = sectionBar("Colour and fabric combinations", y);
  y = table(["Colourway", "Fabric reference", "Thread / trim reference"], (pack.colourways || []).map((row) => [row.name, row.fabric_ref, row.thread_ref]), y, [150, 180, 197]); y = textBox("Colourway notes", pack.colourway_notes, y, 42); y = await imageGrid(imageGroups.colourway, y, 125);
  y = sectionBar("Job worker acknowledgement", y); doc.setDrawColor(148, 163, 184); doc.rect(margin, y, contentWidth, 100); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(51, 65, 85);
  doc.text("I have reviewed this Tech Pack, all supplied references and the stated version. I will request clarification before starting work if any item is unclear.", margin + 10, y + 18, { maxWidth: contentWidth - 20 });
  doc.line(margin + 10, y + 62, margin + 205, y + 62); doc.line(margin + 225, y + 62, margin + 375, y + 62); doc.line(margin + 395, y + 62, pageWidth - margin - 10, y + 62);
  doc.setFontSize(7.5); doc.text("Job worker name / signature", margin + 10, y + 76); doc.text("Date", margin + 225, y + 76); doc.text("Production comments", margin + 395, y + 76); y += 110;
  y = textBox("Attached document links", (pack.document_urls || []).join("\n"), y, 42); footer();

  doc.save(`${String(pack.design_no || pack.tech_pack_no || "tech-pack").replace(/[^a-z0-9_-]+/gi, "-")}-${pack.version || "v1"}.pdf`);
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

function PackModal({ plans, onClose, onSaved }) {
  const [form, setForm] = useState(emptyPack);
  const [sizeList, setSizeList] = useState([]);
  const [measurementRows, setMeasurementRows] = useState([]);
  const [trimRows, setTrimRows] = useState([emptyTrimRow()]);
  const [colourways, setColourways] = useState([emptyColourway()]);
  const [images, setImages] = useState({}); // { category: File[] }
  const [previews, setPreviews] = useState({}); // { category: string[] }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

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

  const addImages = (category, files) => {
    const accepted = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    if (!accepted.length) return;
    setImages((current) => ({ ...current, [category]: [...(current[category] || []), ...accepted] }));
    setPreviews((current) => ({ ...current, [category]: [...(current[category] || []), ...accepted.map((file) => URL.createObjectURL(file))] }));
  };
  const removeImage = (category, index) => {
    setImages((current) => ({ ...current, [category]: (current[category] || []).filter((_, i) => i !== index) }));
    setPreviews((current) => ({ ...current, [category]: (current[category] || []).filter((_, i) => i !== index) }));
  };

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const cleanMeasurementRows = measurementRows.filter((row) => row.point.trim());
      const cleanTrimRows = trimRows.filter((row) => row.description.trim());
      const cleanColourways = colourways.filter((row) => row.name.trim());
      const imageCount = Object.values(images).reduce((sum, list) => sum + (list?.length || 0), 0);
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
        body.append("colourways", JSON.stringify(cleanColourways));
        Object.entries(images).forEach(([category, files]) => (files || []).forEach((file) => body.append(`pack_image_${category}`, file)));
        result = await api("/tech-packs", { method: "POST", body });
      } else {
        const jsonPayload = {
          ...form,
          reference_images: form.reference_images.split("\n").map((x) => x.trim()).filter(Boolean),
          document_urls: form.document_urls.split("\n").map((x) => x.trim()).filter(Boolean),
          sizes: JSON.stringify(sizeList),
          measurement_rows: JSON.stringify(cleanMeasurementRows),
          trims_items: JSON.stringify(cleanTrimRows),
          colourways: JSON.stringify(cleanColourways),
        };
        result = await api("/tech-packs", { method: "POST", body: JSON.stringify(jsonPayload) });
      }
      onSaved(result.data, result.message);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm"><section className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Product development</p><h2 className="mt-1 text-xl font-black text-slate-900">Create tech pack</h2><p className="mt-1 text-xs text-slate-500">One reusable approved instruction set for a design; assign it to any job work order.</p></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-xl text-slate-500">x</button></header>
    <form onSubmit={submit} className="space-y-6 p-6">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Design no. *"><input required value={form.design_no} onChange={(e) => update("design_no", e.target.value)} placeholder="e.g. D.NO 278 A" /></Field>
        <Field label="Style name *"><input required value={form.style_name} onChange={(e) => update("style_name", e.target.value)} placeholder="e.g. Embroidered cord set" /></Field>
        <Field label="Department"><input value={form.department} onChange={(e) => update("department", e.target.value)} placeholder="Women / Men / Kids" /></Field>
        <Field label="Version"><input value={form.version} onChange={(e) => update("version", e.target.value)} placeholder="v1" /></Field>
        <Field label="Sample size"><input value={form.sample_size} onChange={(e) => update("sample_size", e.target.value)} placeholder="e.g. M or 40" /></Field>
        <Field label="Link Style BOM"><select value={form.material_plan_id} onChange={(e) => update("material_plan_id", e.target.value)}><option value="">No BOM linked yet</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_no} - {plan.style_name}</option>)}</select></Field>
        <Field label="Theme (optional)"><input value={form.theme_name} onChange={(e) => update("theme_name", e.target.value)} placeholder="e.g. Neo Heritage" /></Field>
        <Field label="Collection (optional)"><input value={form.collection} onChange={(e) => update("collection", e.target.value)} placeholder="e.g. Winter 2026" /></Field>
        <Field label="Designer (optional)"><input value={form.designer_name} onChange={(e) => update("designer_name", e.target.value)} placeholder="Designer name" /></Field>
      </div>

      {/* 1. Sketch */}
      <Section number="1" title="Sketch" subtitle="Illustration, flat drawing or photo - front and back views ideally.">
        <Field label="Sketch notes"><textarea rows="2" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Front/back/side reference, fit, silhouette and the main construction intent." /></Field>
        <Field label="Fabric & material reference"><textarea rows="2" value={form.fabric_notes} onChange={(e) => update("fabric_notes", e.target.value)} placeholder="Fabric type, GSM, width, shade, thread and consumption notes." /></Field>
        <ImageUploadSection label="Sketch images" hint="Enlarge details with measurements - can be in colour." files={images.sketch} previews={previews.sketch} onAdd={(f) => addImages("sketch", f)} onRemove={(i) => removeImage("sketch", i)} />
      </Section>

      {/* 2. Spec Sheet */}
      <Section number="2" title="Spec Sheet" subtitle="Measurements with Point of Measure (POM) instructions, and grading per size.">
        <Field label="Sizes (comma separated, e.g. S, M, L, XL)"><input value={form.sizes} onChange={(e) => applySizes(e.target.value)} placeholder="S, M, L, XL" /></Field>
        {sizeList.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50"><tr>
                <th className="px-3 py-2 text-left font-bold text-slate-500">Measurement point</th>
                <th className="px-3 py-2 text-left font-bold text-slate-500">Sample</th>
                {sizeList.map((size) => <th key={size} className="px-3 py-2 text-left font-bold text-slate-500">{size}</th>)}
                <th />
              </tr></thead>
              <tbody>
                {measurementRows.map((row, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="px-3 py-1.5"><input value={row.point} onChange={(e) => changeMeasurement(index, "point", e.target.value)} placeholder="Chest" className="w-full rounded-lg border border-slate-200 px-2 py-1.5" /></td>
                    <td className="px-3 py-1.5"><input value={row.sample_value} onChange={(e) => changeMeasurement(index, "sample_value", e.target.value)} placeholder="40" className="w-20 rounded-lg border border-slate-200 px-2 py-1.5" /></td>
                    {sizeList.map((size) => <td key={size} className="px-3 py-1.5"><input value={row.grades?.[size] || ""} onChange={(e) => changeMeasurement(index, "grade", e.target.value, size)} className="w-16 rounded-lg border border-slate-200 px-2 py-1.5" /></td>)}
                    <td><button type="button" disabled={measurementRows.length === 1} onClick={() => setMeasurementRows((rows) => rows.filter((_, i) => i !== index))} className="px-2 text-lg font-bold text-rose-500 disabled:text-slate-300">x</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" onClick={() => setMeasurementRows((rows) => [...rows, emptyMeasurementRow(sizeList)])} className="text-sm font-bold text-violet-700">+ Add measurement point</button>
        <Field label="Other spec sheet notes (optional)"><textarea rows="2" value={form.measurement_notes || ""} onChange={(e) => update("measurement_notes", e.target.value)} placeholder="Tolerance, grading rule exceptions, anything the table doesn't cover." /></Field>
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
            <thead className="bg-slate-50"><tr>{["Colourway name", "Fabric reference", "Thread reference", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-bold text-slate-500">{h}</th>)}</tr></thead>
            <tbody>
              {colourways.map((row, index) => (
                <tr key={index} className="border-t border-slate-100">
                  {["name", "fabric_ref", "thread_ref"].map((key) => (
                    <td key={key} className="px-3 py-1.5"><input value={row[key]} onChange={(e) => changeColourway(index, key, e.target.value)} className="w-full min-w-[90px] rounded-lg border border-slate-200 px-2 py-1.5" /></td>
                  ))}
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
      <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save tech pack"}</button></div>
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
  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm"><section className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">{pack.tech_pack_no} - {pack.version}</p><h2 className="mt-1 text-xl font-black text-slate-900">{pack.design_no} - {pack.style_name}</h2>{(pack.theme_name || pack.collection || pack.designer_name) && <p className="mt-1 text-xs text-slate-500">{[pack.theme_name && `Theme: ${pack.theme_name}`, pack.collection && `Collection: ${pack.collection}`, pack.designer_name && `Designer: ${pack.designer_name}`].filter(Boolean).join(" - ")}</p>}</div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-xl text-slate-500">x</button></header>
    <div className="space-y-5 p-6 text-sm">
      {pack.linked_theme?.swatches?.length > 0 && (
        <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Fabric reference - Theme "{pack.linked_theme.theme_name}"</p><div className="flex flex-wrap gap-2">{pack.linked_theme.swatches.map((s, i) => s.image_url && <img key={i} src={s.image_url} alt={s.fabric_type || "swatch"} title={`${s.fabric_type || ""} ${s.gsm ? s.gsm + " GSM" : ""} ${s.color || ""} - ${s.vendor_name || ""}`} className="h-16 w-16 rounded-xl border border-slate-200 object-cover" />)}</div></div>
      )}
      {IMAGE_SECTIONS.map(([key, label]) => (pack[`${key}_images`]?.length > 0) && (
        <div key={key}><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{label} images</p><div className="flex flex-wrap gap-2">{pack[`${key}_images`].map((src) => <img key={src} src={src} alt={label} className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />)}</div></div>
      ))}
      {pack.sizes?.length > 0 && pack.measurement_rows?.length > 0 && (
        <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Spec sheet</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-xs"><thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">Point</th><th className="px-3 py-2 text-left">Sample</th>{pack.sizes.map((s) => <th key={s} className="px-3 py-2 text-left">{s}</th>)}</tr></thead><tbody>{pack.measurement_rows.map((row, i) => <tr key={i} className="border-t border-slate-100"><td className="px-3 py-1.5 font-bold">{row.point}</td><td className="px-3 py-1.5">{row.sample_value}</td>{pack.sizes.map((s) => <td key={s} className="px-3 py-1.5">{row.grades?.[s] || ""}</td>)}</tr>)}</tbody></table></div>
        </div>
      )}
      {pack.trims_items?.length > 0 && (
        <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Trims & label</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-xs"><thead className="bg-slate-50"><tr>{["Description", "Color", "Size", "Supplier", "Qty", "Price"].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead><tbody>{pack.trims_items.map((row, i) => <tr key={i} className="border-t border-slate-100"><td className="px-3 py-1.5">{row.description}</td><td className="px-3 py-1.5">{row.color}</td><td className="px-3 py-1.5">{row.size}</td><td className="px-3 py-1.5">{row.supplier}</td><td className="px-3 py-1.5">{row.quantity}</td><td className="px-3 py-1.5">{row.price}</td></tr>)}</tbody></table></div>
        </div>
      )}
      {pack.colourways?.length > 0 && (
        <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Colourways</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-xs"><thead className="bg-slate-50"><tr>{["Colourway", "Fabric ref", "Thread ref"].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead><tbody>{pack.colourways.map((row, i) => <tr key={i} className="border-t border-slate-100"><td className="px-3 py-1.5 font-bold">{row.name}</td><td className="px-3 py-1.5">{row.fabric_ref}</td><td className="px-3 py-1.5">{row.thread_ref}</td></tr>)}</tbody></table></div>
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

export default function TechPackLibrary({ plans, onSelectForOrder }) {
  const [packs, setPacks] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [showCreate, setShowCreate] = useState(false); const [viewPack, setViewPack] = useState(null);
  const load = async () => { setLoading(true); try { const result = await api("/tech-packs"); setPacks(result.data || []); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  return <section className="mb-6 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40"><div className="flex flex-col justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-cyan-50 px-6 py-5 sm:flex-row sm:items-center"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">Before creating job work</p><h2 className="mt-1 text-xl font-black text-slate-900">Tech Pack Library</h2><p className="mt-1 text-sm text-slate-500">Sketches, measurements, construction, trims, artwork and colourways - one controlled design reference.</p></div><button type="button" onClick={() => setShowCreate(true)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-violet-200 hover:bg-violet-700">+ Create tech pack</button></div>

    <div className="mx-6 mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs leading-5 text-slate-600">
      <p className="mb-1 font-black text-indigo-900">How this works</p>
      <ol className="list-decimal space-y-1 pl-4">
        <li><b className="text-slate-800">Create a tech pack once</b> for a design - Sketch, Spec Sheet (measurements + grading per size), Details, Artwork, Trims and Label, and Colourways, same 6 pages as a standard fashion tech pack.</li>
        <li><b className="text-slate-800">Select it on a job work order's design line</b> ("Use in job order", or the Tech pack dropdown when creating an order) - it locks in the pack's current version as a snapshot.</li>
        <li><b className="text-slate-800">The job worker sees that locked snapshot</b> in their portal - measurements, trims table, artwork and images - never a version that changes underneath them mid-job.</li>
      </ol>
      <p className="mt-2 text-slate-400">Changed a measurement or trim after work has started? Don't edit the old pack - save it as a new version (v2, v3...) so already-issued orders keep showing what was actually approved.</p>
    </div>

    {error && <p className="m-5 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}{loading ? <p className="p-8 text-center text-sm text-slate-400">Loading tech packs...</p> : packs.length ? <div className="divide-y divide-slate-100">{packs.map((pack) => <article key={pack.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{pack.design_no} - {pack.style_name}</p><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">{pack.version}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{pack.tech_pack_no}</span>{pack.theme_name && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{pack.theme_name}</span>}</div><p className="mt-1 text-xs text-slate-500">{pack.department || "Unassigned department"} - {pack.sample_size ? `Sample ${pack.sample_size}` : "Sample size not set"} - {pack.sizes?.length ? `${pack.sizes.length} size(s) graded` : "No spec sheet"} - {pack.trims_items?.length || 0} trim(s){pack.comments?.length ? ` - ${pack.comments.length} comment(s)` : ""}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setViewPack(pack)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">View</button><button type="button" onClick={() => downloadTechPackPdf(pack, plans)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Download PDF</button><button type="button" onClick={() => onSelectForOrder?.(pack)} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100">Use in job order</button></div></article>)}</div> : <div className="p-9 text-center"><p className="font-bold text-slate-700">No tech packs yet</p><p className="mt-1 text-sm text-slate-500">Create a pack first, then choose it for the relevant design line in a job work order.</p></div>}{showCreate && <PackModal plans={plans} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}{viewPack && <PackDetail pack={viewPack} plans={plans} onClose={() => setViewPack(null)} onUpdated={(updated) => { setViewPack(updated); setPacks((current) => current.map((p) => p.id === updated.id ? { ...p, ...updated } : p)); }} />}</section>;
}
