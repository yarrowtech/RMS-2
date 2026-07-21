import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = APP_API_URL;

// â”€â”€ Token helper: vendor_token first, then admin_token, then token â”€â”€
const getToken = () =>
  localStorage.getItem("vendor_token") ||
  localStorage.getItem("admin_token") ||
  localStorage.getItem("token") ||
  "";

/* â”€â”€ Toast â”€â”€ */
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3800);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-7 right-7 z-[9999] flex max-w-[340px] items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-2xl ${
      type === "ok"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-red-200 bg-red-50 text-red-700"
    }`}>
      <span>{type === "ok" ? "Saved" : "Error"}</span>
      <span>{msg}</span>
    </div>
  );
}

function Price({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 font-mono text-xs text-slate-400">Rs</span>
        <input
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-7 pr-4 font-mono text-sm text-slate-900 outline-none transition placeholder:text-slate-300 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          type="number" min="0" step="0.01" value={value}
          onChange={(e) => onChange(e.target.value)} placeholder="0.00"
        />
      </div>
    </div>
  );
}

function IRow({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{k}</span>
      <div className="break-all text-right font-mono text-xs text-slate-500">{v || "Not available"}</div>
    </div>
  );
}

export default function EditProduct({ embedded = false, product: productProp = null, onBackToList }) {
  const { sku } = useParams();
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  const [product,  setProduct]  = useState(productProp || null);
  const [loading,  setLoading]  = useState(!productProp);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Basic info
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [spec, setSpec] = useState("");

  // Pricing & stock
  const [costPrice,    setCostPrice]    = useState("");
  const [mrp,          setMrp]          = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [quantity,     setQuantity]     = useState("");
  const [unit,         setUnit]         = useState("pcs");

  // Images & variants
  const [keepImgs, setKeepImgs] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [variants, setVariants] = useState([]);

  const isGRNProduct = (p) => p?.source === "grn" || p?.created_by === "GRN";

  const hydrateForm = useCallback((d) => {
    if (!d) return;
    setProduct(d);
    setName(d.product_name || "");
    setDesc(d.description || "");
    setSpec(d.specification || "");
    setKeepImgs(d.images || []);
    setNewFiles([]);

    if (!d.has_variants) {
      setCostPrice(d.cost_price ?? "");
      setMrp(d.mrp ?? "");
      setSellingPrice(d.selling_price ?? "");
      setQuantity(d.quantity ?? "");
      setUnit(d.unit || "pcs");
      setVariants([]);
    } else {
      setVariants((d.variants || []).map((v) => ({ ...v })));
      setCostPrice(""); setMrp(""); setSellingPrice(""); setQuantity(""); setUnit("pcs");
    }
  }, []);

  useEffect(() => {
    if (productProp) {
      setLoading(false);
      hydrateForm(productProp);
      return;
    }
    if (!sku) { setLoading(false); return; }
    setLoading(true);
    axios.get(`${API_BASE}/api/products/${sku}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => hydrateForm(res.data.data))
      .catch((err) => setToast({ msg: err.response?.data?.detail || "Failed to load product", type: "err" }))
      .finally(() => setLoading(false));
  }, [sku, productProp, hydrateForm]);

  const goBack = () => {
    if (embedded && onBackToList) { onBackToList(); return; }
    navigate("/products");
  };

  const addFiles = useCallback((files) => {
    setNewFiles((p) => [...p, ...Array.from(files).filter((f) => f.type.startsWith("image/"))]);
  }, []);

  const patchV = (i, field, val) =>
    setVariants((p) => { const n = [...p]; n[i] = { ...n[i], [field]: val }; return n; });

  const handleSave = async () => {
    if (!product || saving) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("product_name",    name);
      fd.append("description",     desc);
      fd.append("specification",   spec);
      fd.append("existing_images", JSON.stringify(keepImgs));

      if (!product.has_variants) {
        if (costPrice    !== "") fd.append("cost_price",    costPrice);
        if (mrp          !== "") fd.append("mrp",           mrp);
        if (sellingPrice !== "") fd.append("selling_price", sellingPrice);
        if (quantity     !== "") fd.append("quantity",      quantity);
        fd.append("unit", unit);
      } else {
        fd.append("variants_update", JSON.stringify(
          variants.map((v) => ({
            sku:           v.sku,
            cost_price:    v.cost_price,
            mrp:           v.mrp,
            selling_price: v.selling_price,
            stock:         v.stock,
            unit:          v.unit,
          }))
        ));
      }

      newFiles.forEach((f) => fd.append("images", f));

      const skuKey = product.base_sku || product.sku;
      await axios.put(`${API_BASE}/api/products/${skuKey}`, fd, {
        headers: {
          Authorization:  `Bearer ${getToken()}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setToast({ msg: "Saved successfully!", type: "ok" });
      setTimeout(goBack, 900);
    } catch (err) {
      setToast({ msg: err.response?.data?.detail || "Save failed", type: "err" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={embedded ? "min-h-[320px]" : "min-h-screen bg-slate-50"}>
        <div className="grid gap-5 p-6">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!product) return null;

  const isVariant  = product.has_variants;
  const vType      = product.variant_type;
  const displaySku = product.base_sku || product.sku;
  const isGRN      = isGRNProduct(product);
  return (
    <div className={embedded ? "w-full rounded-2xl bg-slate-50 p-4 sm:p-5" : "min-h-screen bg-slate-50"}>

      {/* â”€â”€ Standalone header â”€â”€ */}
      {!embedded && (
        <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700" onClick={goBack}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
              Back
            </button>
            <span className="hidden text-sm font-bold uppercase tracking-[0.08em] text-slate-500 sm:inline">Edit Product</span>
            {displaySku && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 font-mono text-[11px] text-indigo-700">{displaySku}</span>}
            {isGRN && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700">GRN Inward</span>}
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700" onClick={goBack}>Discard</button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-indigo-700 hover:shadow-md disabled:opacity-50"
              onClick={handleSave} disabled={saving}
            >
              {saving ? <><span className="h-[14px] w-[14px] animate-spin rounded-full border-2 border-white/30 border-t-white" />Savingâ€¦</> : <>âœ“ Save Changes</>}
            </button>
          </div>
        </header>
      )}

      {/* â”€â”€ Embedded header â”€â”€ */}
      {embedded && (
        <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">Edit Product</h2>
              {isGRN && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700">GRN Inward</span>}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {isGRN
                ? "This product was auto-created from a GRN. Fill in the missing details below."
                : "Update product details, inventory, pricing and images."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {displaySku && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 font-mono text-[11px] text-indigo-700">{displaySku}</span>}
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700" onClick={goBack}>Back</button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-indigo-700 hover:shadow-md disabled:opacity-50"
              onClick={handleSave} disabled={saving}
            >
              {saving ? <><span className="h-[14px] w-[14px] animate-spin rounded-full border-2 border-white/30 border-t-white" />Savingâ€¦</> : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* â”€â”€ GRN banner â”€â”€ */}
      {isGRN && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-[22px]">ðŸ“‹</span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1px] text-amber-600">Auto-created from GRN Inward</p>
            <p className="text-[13px] font-semibold text-amber-800">
              GRN: {product.grn_no || "â€”"}
              {product.vendor_name ? ` Â· ${product.vendor_name}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-amber-600">
              Review the product details, pricing, stock and images before saving.</p>
          </div>
        </div>
      )}

      <div className={`mx-auto grid w-full max-w-[1480px] grid-cols-1 gap-5 ${embedded ? "" : "px-4 py-6 sm:px-6"} lg:grid-cols-[1fr_340px]`}>

        {/* â”€â”€ Left column â”€â”€ */}
        <div className="flex min-w-0 flex-col gap-5">

          {/* Basic info */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-[10px] font-bold text-indigo-700">01</div>
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Basic Information</span>
            </div>
            <div className="p-5">
              <div className="mb-4">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Product Name</label>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter product name"
                />
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Description</label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-300 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe this product..."
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Specification</label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-300 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  rows={3} value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="Material, dimensions, care instructions..."
                />
              </div>
            </div>
          </div>

          {/* Pricing & stock â€” simple product */}
          {!isVariant && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-[10px] font-bold text-indigo-700">02</div>
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Pricing & Inventory</span>
              </div>
              <div className="p-5">
                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Price label="Cost Price"    value={costPrice}    onChange={setCostPrice} />
                  <Price label="MRP"           value={mrp}          onChange={setMrp} />
                  <Price label="Selling Price" value={sellingPrice} onChange={setSellingPrice} />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {isGRN ? "Opening Stock" : "Stock Qty"}
                    </label>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                      type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0"
                    />
                    {isGRN && <p className="mt-1 text-[10px] text-amber-600">This was set from the GRN inward quantity. Adjust if needed.</p>}
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Unit</label>
                    <select
                      className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                      value={unit} onChange={(e) => setUnit(e.target.value)}
                    >
                      {["pcs","kg","g","l","ml","m","set","box","pair"].map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Variant pricing */}
          {isVariant && variants.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-[10px] font-bold text-indigo-700">03</div>
                <span className="flex items-center text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Variants â€” Pricing & Stock
                  <span className="ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{variants.length}</span>
                </span>
                <span className={`ml-auto rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${vType === "size_color" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                  {vType === "size_color" ? "Size + Color" : "Color"}
                </span>
              </div>
              <div className="max-h-[440px] overflow-auto">
                <table className="w-full min-w-[760px] border-collapse text-xs">
                  <thead className="sticky top-0 z-[1] bg-slate-900">
                    <tr className="border-b border-slate-200">
                      {["Variant","Cost (INR)","MRP (INR)","Selling (INR)","Stock","Unit"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-[0.12em] text-slate-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, i) => (
                      <tr key={v.sku || i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-2 align-middle">
                          <div className="flex flex-col gap-1">
                            {v.size_label && <span className="inline-flex max-w-[120px] items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] text-slate-500"><span className="truncate font-semibold">{v.size_label}</span></span>}
                            {v.color && <span className="inline-flex max-w-[120px] items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] text-slate-500"><span className="h-[9px] w-[9px] shrink-0 rounded-full border border-black/10" style={{ background: v.color }} /><span className="truncate">{v.color}</span></span>}
                          </div>
                        </td>
                        {[["cost_price","0.01"],["mrp","0.01"],["selling_price","0.01"],["stock","1"]].map(([field, step]) => (
                          <td key={field} className="px-2 py-2">
                            <input
                              className="min-w-[68px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-900 outline-none transition focus:border-indigo-500"
                              type="number" min="0" step={step} value={v[field] ?? ""}
                              onChange={(e) => patchV(i, field, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2">
                          <select
                            className="w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-900 outline-none transition focus:border-indigo-500"
                            value={v.unit || "pcs"} onChange={(e) => patchV(i, "unit", e.target.value)}
                          >
                            {["pcs","kg","g","l","ml","m","set","box","pair"].map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* â”€â”€ Right column â”€â”€ */}
        <div className="flex min-w-0 flex-col gap-5">

          {/* Images */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-[10px] font-bold text-indigo-700">04</div>
              <span className="flex items-center text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Product Images
                {keepImgs.length + newFiles.length > 0 && (
                  <span className="ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{keepImgs.length + newFiles.length}</span>
                )}
              </span>
            </div>
            <div className="p-5">
              {keepImgs.length > 0 && (
                <div className="mb-4 grid grid-cols-3 gap-2.5">
                  {keepImgs.map((url) => (
                    <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <img src={url} alt="" className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
                      <button type="button" className="absolute right-1 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-red-500 text-[10px] text-white opacity-0 transition group-hover:opacity-100" onClick={() => setKeepImgs((p) => p.filter((u) => u !== url))}>âœ•</button>
                    </div>
                  ))}
                </div>
              )}
              {newFiles.length > 0 && (
                <>
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-indigo-700">New â€” pending upload</p>
                  <div className="mb-4 grid grid-cols-3 gap-2.5">
                    {newFiles.map((f, i) => (
                      <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-indigo-300 bg-indigo-50">
                        <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                        <span className="absolute bottom-1 left-1 rounded bg-indigo-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-white">New</span>
                        <button type="button" className="absolute right-1 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-red-500 text-[10px] text-white" onClick={() => setNewFiles((p) => p.filter((_, j) => j !== i))}>âœ•</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {keepImgs.length === 0 && newFiles.length === 0 && <p className="py-5 text-center text-sm text-slate-400">No images attached yet</p>}
              <div className="my-4 h-px bg-slate-100" />
              <div
                className={`cursor-pointer rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${dragOver ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/70"}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              >
                <div className="mb-2 text-2xl opacity-50">Upload</div>
                <p className="text-sm leading-6 text-slate-400">
                  <span className="font-semibold text-indigo-700">Click to upload</span> or drag & drop<br />PNG | JPG | WEBP
                </p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
            </div>
          </div>

          {/* Locked / read-only info */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-[10px] font-bold text-indigo-700">05</div>
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Product Info</span>
            </div>
            <div className="p-5">
              <IRow k="SKU"     v={displaySku} />
              <IRow k="Barcode" v={product.barcode || product.base_barcode} />
              <IRow k="Source"  v={product.source === "grn" ? "GRN Inward" : product.source === "vendor" ? "Vendor" : "Admin"} />
              {isGRN && <IRow k="GRN No"      v={product.grn_no} />}
              {isGRN && <IRow k="Vendor"      v={product.vendor_name} />}
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}






