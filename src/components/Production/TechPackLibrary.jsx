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
  ["details", "Details", "Enlarged construction details — collar, pocket, cuff etc."],
  ["artwork", "Artwork", "Print/embroidery/flocking artwork, actual size or to scale."],
  ["trims", "Trims & label", "Trim photos, label placement, hangtag."],
  ["colourway", "Colourways", "Swatches for each colour/fabric combo."],
];

const emptyPack = {
  design_no: "", style_name: "", department: "", version: "v1", sample_size: "",
  description: "", fabric_notes: "", construction_notes: "", artwork_notes: "", colourway_notes: "",
  reference_images: "", document_urls: "", material_plan_id: "",
  sizes: "", artwork_width_cm: "", artwork_height_cm: "", artwork_placement: "",
};

const emptyMeasurementRow = (sizes) => ({ point: "", sample_value: "", grades: Object.fromEntries(sizes.map((s) => [s, ""])) });
const emptyTrimRow = () => ({ description: "", color: "", size: "", supplier: "", quantity: "", price: "" });
const emptyColourway = () => ({ name: "", fabric_ref: "", thread_ref: "" });

function downloadTechPackPdf(pack) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 42;
  const pageBreakIfNeeded = (y, needed) => { if (y + needed > 790) { doc.addPage(); return 52; } return y; };
  const heading = (title) => { doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(title, margin, 52); };
  const add = (y, title, value) => {
    if (!value) return y;
    const lines = doc.splitTextToSize(String(value), 510);
    y = pageBreakIfNeeded(y, 28 + lines.length * 13);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(title, margin, y); y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.text(lines, margin, y); y += lines.length * 13 + 13;
    return y;
  };

  // Page 1 — cover + sketch
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("RMS Tech Pack", margin, 52);
  doc.setFontSize(12); doc.text(`${pack.tech_pack_no || "Tech Pack"} · ${pack.version || "v1"}`, margin, 76);
  let y = 106;
  y = add(y, "1. Design / style", `${pack.design_no || ""} — ${pack.style_name || ""}`);
  y = add(y, "Department / sample", [pack.department, pack.sample_size && `Sample ${pack.sample_size}`].filter(Boolean).join(" · "));
  y = add(y, "Sketch notes", pack.description);
  y = add(y, "Fabric & material reference", pack.fabric_notes);

  // Page 2 — spec sheet / grading
  doc.addPage(); heading("2. Spec Sheet — measurements & grading"); y = 80;
  if (pack.sizes?.length && pack.measurement_rows?.length) {
    const colWidth = Math.min(70, 470 / (pack.sizes.length + 2));
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    doc.text("Point", margin, y); doc.text("Sample", margin + colWidth * 1.6, y);
    pack.sizes.forEach((size, i) => doc.text(String(size), margin + colWidth * (2.6 + i), y));
    y += 14;
    doc.setFont("helvetica", "normal");
    pack.measurement_rows.forEach((row) => {
      y = pageBreakIfNeeded(y, 14);
      doc.text(String(row.point || ""), margin, y);
      doc.text(String(row.sample_value || ""), margin + colWidth * 1.6, y);
      pack.sizes.forEach((size, i) => doc.text(String(row.grades?.[size] || ""), margin + colWidth * (2.6 + i), y));
      y += 14;
    });
    y += 10;
  } else {
    y = add(y, "Measurement notes", pack.measurement_notes || "No structured spec sheet added yet.");
  }

  // Page 3 — construction details
  doc.addPage(); heading("3. Details — construction"); y = 80;
  y = add(y, "Construction notes", pack.construction_notes);

  // Page 4 — artwork
  doc.addPage(); heading("4. Artwork"); y = 80;
  y = add(y, "Dimensions", [pack.artwork_width_cm && `Width ${pack.artwork_width_cm} cm`, pack.artwork_height_cm && `Height ${pack.artwork_height_cm} cm`].filter(Boolean).join(" · "));
  y = add(y, "Placement", pack.artwork_placement);
  y = add(y, "Artwork notes", pack.artwork_notes);

  // Page 5 — trims & label
  doc.addPage(); heading("5. Trims & Label"); y = 80;
  if (pack.trims_items?.length) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    ["Description", "Color", "Size", "Supplier", "Qty", "Price"].forEach((h, i) => doc.text(h, margin + i * 85, y));
    y += 14;
    doc.setFont("helvetica", "normal");
    pack.trims_items.forEach((item) => {
      y = pageBreakIfNeeded(y, 14);
      [item.description, item.color, item.size, item.supplier, item.quantity, item.price].forEach((v, i) => doc.text(String(v || ""), margin + i * 85, y));
      y += 14;
    });
    y += 10;
  } else {
    y = add(y, "Trims & label notes", pack.trims_labels_notes || "No trims added yet.");
  }

  // Page 6 — colourways
  doc.addPage(); heading("6. Colourways"); y = 80;
  if (pack.colourways?.length) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    ["Colourway", "Fabric reference", "Thread reference"].forEach((h, i) => doc.text(h, margin + i * 160, y));
    y += 14;
    doc.setFont("helvetica", "normal");
    pack.colourways.forEach((row) => {
      y = pageBreakIfNeeded(y, 14);
      [row.name, row.fabric_ref, row.thread_ref].forEach((v, i) => doc.text(String(v || ""), margin + i * 160, y));
      y += 14;
    });
  } else {
    y = add(y, "Colourway notes", pack.colourway_notes || "No colourways added yet.");
  }
  y = add(y, "Reference images", (pack.reference_images || []).join("\n"));
  y = add(y, "Attached documents", (pack.document_urls || []).join("\n"));

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
              <button type="button" onClick={() => onRemove(index)} className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-[10px] font-black text-white">×</button>
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

  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm"><section className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Product development</p><h2 className="mt-1 text-xl font-black text-slate-900">Create tech pack</h2><p className="mt-1 text-xs text-slate-500">One reusable approved instruction set for a design; assign it to any job work order.</p></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-xl text-slate-500">×</button></header>
    <form onSubmit={submit} className="space-y-6 p-6">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Design no. *"><input required value={form.design_no} onChange={(e) => update("design_no", e.target.value)} placeholder="e.g. D.NO 278 A" /></Field>
        <Field label="Style name *"><input required value={form.style_name} onChange={(e) => update("style_name", e.target.value)} placeholder="e.g. Embroidered cord set" /></Field>
        <Field label="Department"><input value={form.department} onChange={(e) => update("department", e.target.value)} placeholder="Women / Men / Kids" /></Field>
        <Field label="Version"><input value={form.version} onChange={(e) => update("version", e.target.value)} placeholder="v1" /></Field>
        <Field label="Sample size"><input value={form.sample_size} onChange={(e) => update("sample_size", e.target.value)} placeholder="e.g. M or 40" /></Field>
        <Field label="Link Style BOM"><select value={form.material_plan_id} onChange={(e) => update("material_plan_id", e.target.value)}><option value="">No BOM linked yet</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_no} - {plan.style_name}</option>)}</select></Field>
      </div>

      {/* 1. Sketch */}
      <Section number="1" title="Sketch" subtitle="Illustration, flat drawing or photo — front and back views ideally.">
        <Field label="Sketch notes"><textarea rows="2" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Front/back/side reference, fit, silhouette and the main construction intent." /></Field>
        <Field label="Fabric & material reference"><textarea rows="2" value={form.fabric_notes} onChange={(e) => update("fabric_notes", e.target.value)} placeholder="Fabric type, GSM, width, shade, thread and consumption notes." /></Field>
        <ImageUploadSection label="Sketch images" hint="Enlarge details with measurements — can be in colour." files={images.sketch} previews={previews.sketch} onAdd={(f) => addImages("sketch", f)} onRemove={(i) => removeImage("sketch", i)} />
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
                    <td><button type="button" disabled={measurementRows.length === 1} onClick={() => setMeasurementRows((rows) => rows.filter((_, i) => i !== index))} className="px-2 text-lg font-bold text-rose-500 disabled:text-slate-300">×</button></td>
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
        <ImageUploadSection label="Detail images" hint="Enlarge details with measurements — can be in colour." files={images.details} previews={previews.details} onAdd={(f) => addImages("details", f)} onRemove={(i) => removeImage("details", i)} />
      </Section>

      {/* 4. Artwork */}
      <Section number="4" title="Artwork" subtitle="Print/embroidery/flocking artwork, actual size or to scale, with colour and material references.">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Width (cm)"><input value={form.artwork_width_cm} onChange={(e) => update("artwork_width_cm", e.target.value)} placeholder="15" /></Field>
          <Field label="Height (cm)"><input value={form.artwork_height_cm} onChange={(e) => update("artwork_height_cm", e.target.value)} placeholder="15" /></Field>
          <Field label="Placement"><input value={form.artwork_placement} onChange={(e) => update("artwork_placement", e.target.value)} placeholder="e.g. centre chest" /></Field>
        </div>
        <Field label="Artwork notes"><textarea rows="2" value={form.artwork_notes} onChange={(e) => update("artwork_notes", e.target.value)} placeholder="Placement, colour, scale and other artwork instructions." /></Field>
        <ImageUploadSection label="Artwork images" hint="Use actual size or to scale — can be in colour." files={images.artwork} previews={previews.artwork} onAdd={(f) => addImages("artwork", f)} onRemove={(i) => removeImage("artwork", i)} />
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
                  <td><button type="button" disabled={trimRows.length === 1} onClick={() => setTrimRows((rows) => rows.filter((_, i) => i !== index))} className="px-2 text-lg font-bold text-rose-500 disabled:text-slate-300">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setTrimRows((rows) => [...rows, emptyTrimRow()])} className="text-sm font-bold text-violet-700">+ Add trim</button>
        <ImageUploadSection label="Trim & label images" hint="Show trims, label placement and attachment methods — can be in colour." files={images.trims} previews={previews.trims} onAdd={(f) => addImages("trims", f)} onRemove={(i) => removeImage("trims", i)} />
      </Section>

      {/* 6. Colorways */}
      <Section number="6" title="Colorways" subtitle="Color and fabric references for each combo — swatches should match the corresponding order.">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50"><tr>{["Colourway name", "Fabric reference", "Thread reference", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-bold text-slate-500">{h}</th>)}</tr></thead>
            <tbody>
              {colourways.map((row, index) => (
                <tr key={index} className="border-t border-slate-100">
                  {["name", "fabric_ref", "thread_ref"].map((key) => (
                    <td key={key} className="px-3 py-1.5"><input value={row[key]} onChange={(e) => changeColourway(index, key, e.target.value)} className="w-full min-w-[90px] rounded-lg border border-slate-200 px-2 py-1.5" /></td>
                  ))}
                  <td><button type="button" disabled={colourways.length === 1} onClick={() => setColourways((rows) => rows.filter((_, i) => i !== index))} className="px-2 text-lg font-bold text-rose-500 disabled:text-slate-300">×</button></td>
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

function PackDetail({ pack, onClose }) {
  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm"><section className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">{pack.tech_pack_no} · {pack.version}</p><h2 className="mt-1 text-xl font-black text-slate-900">{pack.design_no} — {pack.style_name}</h2></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-xl text-slate-500">×</button></header>
    <div className="space-y-5 p-6 text-sm">
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
        <div><p className="mb-1 text-xs font-black uppercase tracking-wide text-slate-500">Artwork</p><p className="text-slate-700">{[pack.artwork_width_cm && `${pack.artwork_width_cm} cm wide`, pack.artwork_height_cm && `${pack.artwork_height_cm} cm high`, pack.artwork_placement].filter(Boolean).join(" · ") || "—"}</p></div>
      )}
      {[["Sketch notes", pack.description], ["Fabric & material", pack.fabric_notes], ["Construction", pack.construction_notes], ["Artwork notes", pack.artwork_notes], ["Other spec sheet notes", pack.measurement_notes], ["Other colourway notes", pack.colourway_notes]].filter(([, v]) => v).map(([label, value]) => (
        <div key={label}><p className="mb-1 text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="whitespace-pre-line text-slate-700">{value}</p></div>
      ))}
      <div className="flex justify-end"><button type="button" onClick={() => downloadTechPackPdf(pack)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white">Download PDF</button></div>
    </div>
  </section></div>;
}

export default function TechPackLibrary({ plans, onSelectForOrder }) {
  const [packs, setPacks] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [showCreate, setShowCreate] = useState(false); const [viewPack, setViewPack] = useState(null);
  const load = async () => { setLoading(true); try { const result = await api("/tech-packs"); setPacks(result.data || []); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  return <section className="mb-6 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/40"><div className="flex flex-col justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-cyan-50 px-6 py-5 sm:flex-row sm:items-center"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">Before creating job work</p><h2 className="mt-1 text-xl font-black text-slate-900">Tech Pack Library</h2><p className="mt-1 text-sm text-slate-500">Sketches, measurements, construction, trims, artwork and colourways — one controlled design reference.</p></div><button type="button" onClick={() => setShowCreate(true)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-violet-200 hover:bg-violet-700">+ Create tech pack</button></div>

    <div className="mx-6 mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs leading-5 text-slate-600">
      <p className="mb-1 font-black text-indigo-900">How this works</p>
      <ol className="list-decimal space-y-1 pl-4">
        <li><b className="text-slate-800">Create a tech pack once</b> for a design — Sketch, Spec Sheet (measurements + grading per size), Details, Artwork, Trims and Label, and Colourways, same 6 pages as a standard fashion tech pack.</li>
        <li><b className="text-slate-800">Select it on a job work order's design line</b> ("Use in job order", or the Tech pack dropdown when creating an order) — it locks in the pack's current version as a snapshot.</li>
        <li><b className="text-slate-800">The job worker sees that locked snapshot</b> in their portal — measurements, trims table, artwork and images — never a version that changes underneath them mid-job.</li>
      </ol>
      <p className="mt-2 text-slate-400">Changed a measurement or trim after work has started? Don't edit the old pack — save it as a new version (v2, v3…) so already-issued orders keep showing what was actually approved.</p>
    </div>

    {error && <p className="m-5 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}{loading ? <p className="p-8 text-center text-sm text-slate-400">Loading tech packs...</p> : packs.length ? <div className="divide-y divide-slate-100">{packs.map((pack) => <article key={pack.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{pack.design_no} - {pack.style_name}</p><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">{pack.version}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{pack.tech_pack_no}</span></div><p className="mt-1 text-xs text-slate-500">{pack.department || "Unassigned department"} · {pack.sample_size ? `Sample ${pack.sample_size}` : "Sample size not set"} · {pack.sizes?.length ? `${pack.sizes.length} size(s) graded` : "No spec sheet"} · {pack.trims_items?.length || 0} trim(s)</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setViewPack(pack)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">View</button><button type="button" onClick={() => downloadTechPackPdf(pack)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Download PDF</button><button type="button" onClick={() => onSelectForOrder?.(pack)} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100">Use in job order</button></div></article>)}</div> : <div className="p-9 text-center"><p className="font-bold text-slate-700">No tech packs yet</p><p className="mt-1 text-sm text-slate-500">Create a pack first, then choose it for the relevant design line in a job work order.</p></div>}{showCreate && <PackModal plans={plans} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}{viewPack && <PackDetail pack={viewPack} onClose={() => setViewPack(null)} />}</section>;
}
