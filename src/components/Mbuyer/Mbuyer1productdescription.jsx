import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Edit, Trash2, Search, Upload, X } from "lucide-react";
import toast from "react-hot-toast";

const API   = `${APP_API_URL}/mbuyer/product-descriptions`;
const token = localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
const hdrs  = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const emptyRecord = () => ({
  image: null,
  productCode: "",
  fabricComposition: "",
  productPrice: "",
  barcode: "",
  productShortDescription: "",
  sizeAvailable: "",
  colours: "",
});

export default function Mbuyer1ProductDescription() {
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState("");
  const [isOpen,    setIsOpen]    = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form,      setForm]      = useState(emptyRecord());
  const fileRef = useRef(null);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}${search ? `?search=${encodeURIComponent(search)}` : ""}`, { headers: hdrs });
      const data = await res.json();
      setRecords(Array.isArray(data.data) ? data.data : []);
    } catch { toast.error("Failed to load products"); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── open/close ─────────────────────────────────────────────────────────────
  const openAdd  = () => { setEditingId(null); setForm(emptyRecord()); setIsOpen(true); };
  const openEdit = (r) => { setEditingId(r.id); setForm({ ...r }); setIsOpen(true); };
  const closeModal = () => { setIsOpen(false); toast.error("Product cancelled successfully!"); };

  // ── image upload → base64 ──────────────────────────────────────────────────
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Warn if image is large (base64 stored in MongoDB)
    if (file.size > 500 * 1024) {
      toast("Large image — consider using a smaller file for faster loading.", { icon: "⚠️" });
    }
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, image: ev.target.result }));
    reader.readAsDataURL(file);
  };

  // ── save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.productCode.trim()) { toast.error("Product Code is required!"); return; }
    try {
      setSaving(true);
      const url    = editingId ? `${API}/${editingId}` : API;
      const method = editingId ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: hdrs, body: JSON.stringify(form) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      toast.success(editingId ? "Product updated!" : "Product added!");
      setIsOpen(false);
      await fetchAll();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  // ── delete ─────────────────────────────────────────────────────────────────
  const handleDelete = (id) => {
    toast((t) => (
      <div className="flex flex-col gap-3 p-1">
        <span className="font-bold text-black text-base">Delete this product?</span>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => { toast.dismiss(t.id); toast.error("Cancelled"); }}
            className="px-4 py-2 text-sm font-bold text-black bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            await fetch(`${API}/${id}`, { method: "DELETE", headers: hdrs });
            toast.success("Product deleted!");
            fetchAll();
          }} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>
        </div>
      </div>
    ), { duration: Infinity, style: { background: "#fff", border: "1px solid #e2e8f0" } });
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const INP = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner";

  return (
    <div className="space-y-5 w-full h-full overflow-y-auto p-4 sm:p-6">

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-100 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">Product Description</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-slate-900 placeholder-slate-400 w-44" />
          </div>
          <button onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800 shadow-md">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="min-h-[420px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-800 bg-slate-200 border-b border-slate-300 uppercase font-black tracking-wider whitespace-nowrap">
                <tr>
                  {["Picture","Product Code","Fabric Composition","Product Price","Barcode","Product Short Description","Size Available","Colours","Actions"].map(h => (
                    <th key={h} className="px-4 py-3 border-r border-slate-300 last:border-r-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="py-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"/> Loading…
                    </div>
                  </td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={9} className="px-6 py-10 text-center text-sm text-slate-500 bg-slate-50">
                    No products found. Click "Add Product" to create one.
                  </td></tr>
                ) : records.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-slate-700">
                    <td className="px-4 py-3 border-r border-slate-100">
                      {r.image ? (
                        <img src={r.image} alt="product" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                          <Upload className="w-5 h-5 text-slate-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-900">{r.productCode || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100">{r.fabricComposition || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100 text-center">{r.productPrice ? `₹${r.productPrice}` : "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100 font-mono text-xs">{r.barcode || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100 text-xs max-w-[200px] truncate">{r.productShortDescription || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100">{r.sizeAvailable || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100">{r.colours || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(r)} className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(r.id)} className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-md p-4 md:p-6 flex items-center justify-center">
          <div className="w-full max-w-3xl bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-blue-100/50">
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">{editingId ? "Edit Product" : "Add Product"}</h2>
              <button onClick={closeModal} className="h-10 w-10 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 grid place-items-center text-slate-500 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[55vh] overflow-y-auto p-6 md:p-8">
              {/* Image Upload */}
              <div className="flex flex-col gap-1.5 mb-6">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Product Picture</label>
                <div onClick={() => fileRef.current?.click()}
                  className="cursor-pointer w-full h-36 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                  {form.image ? (
                    <img src={form.image} alt="preview" className="h-full w-full object-contain rounded-2xl p-2" />
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-slate-300" />
                      <span className="text-sm text-slate-400 font-semibold">Click to upload image</span>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                {form.image && (
                  <button onClick={() => setForm(p => ({ ...p, image: null }))}
                    className="self-start text-xs text-red-500 hover:text-red-700 font-semibold">
                    Remove image
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Product Code <span className="text-red-500">*</span></label>
                  <input type="text" value={form.productCode} onChange={f("productCode")} className={INP} placeholder="e.g. EMBO18" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Fabric Composition</label>
                  <input type="text" value={form.fabricComposition} onChange={f("fabricComposition")} className={INP} placeholder="e.g. RaYon" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Product Price (₹)</label>
                  <input type="number" min="0" onKeyDown={(e) => { if (e.key === '-') e.preventDefault(); }}
                    value={form.productPrice} onChange={f("productPrice")} className={INP} placeholder="e.g. 610" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Barcode</label>
                  <input type="text" value={form.barcode} onChange={f("barcode")} className={INP} placeholder="e.g. C756258" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Size Available</label>
                  <input type="text" value={form.sizeAvailable} onChange={f("sizeAvailable")} className={INP} placeholder="e.g. 38 TO 44" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Colours</label>
                  <input type="text" value={form.colours} onChange={f("colours")} className={INP} placeholder="e.g. Multi Colour" />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Product Short Description</label>
                  <textarea value={form.productShortDescription} onChange={f("productShortDescription")} rows={3}
                    className={INP + " resize-none"} placeholder="e.g. Front Embroidery with Short Aline Kurti / 3Quarter Sleeves" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 rounded-b-[2rem]">
              <button onClick={closeModal} className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-100 transition-all">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-8 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                {saving ? "Saving…" : editingId ? "Update Product" : "Save Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}