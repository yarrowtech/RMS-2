import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Search, Image as ImageIcon, X, Upload, Edit, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

const API   = `${APP_API_URL}/mbuyer/next-plans`;
const token = localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
const hdrs  = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const emptyRecord = () => ({ vendor: "", images: [], fabric: "", quantity: "", price: "", size: "" });

export default function Mbuyer1NextPlan() {
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form,      setForm]      = useState(emptyRecord());
  const fileRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}${search ? `?search=${encodeURIComponent(search)}` : ""}`, { headers: hdrs });
      const data = await res.json();
      setRecords(Array.isArray(data.data) ? data.data : []);
    } catch { toast.error("Failed to load records"); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAdd  = () => { setEditingId(null); setForm(emptyRecord()); setIsAddOpen(true); };
  const openEdit = (r)  => { setEditingId(r.id); setForm({ ...r, images: r.images || [] }); setIsAddOpen(true); };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    Promise.all(files.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target.result);
      reader.readAsDataURL(file);
    }))).then(uploaded => setForm(prev => ({ ...prev, images: [...(prev.images || []), ...uploaded] })));
  };

  const removePhoto = (idx) => setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));

  const saveRecord = async () => {
    if (!form.vendor) { toast.error("Vendor is required"); return; }
    try {
      setSaving(true);
      const url    = editingId ? `${API}/${editingId}` : API;
      const method = editingId ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: hdrs, body: JSON.stringify(form) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      toast.success(editingId ? "Record updated successfully!" : "Record added successfully!");
      setIsAddOpen(false);
      await fetchAll();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (id) => {
    toast((t) => (
      <div className="flex flex-col gap-3 p-1">
        <span className="font-bold text-black text-base">Are you sure you want to delete this record?</span>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => { toast.dismiss(t.id); toast.error("Cancelled"); }}
            className="px-4 py-2 text-sm font-bold text-black bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            await fetch(`${API}/${id}`, { method: "DELETE", headers: hdrs });
            toast.success("Record deleted successfully!");
            fetchAll();
          }} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>
        </div>
      </div>
    ), { duration: Infinity, style: { background: "#ffffff", color: "#000000", border: "1px solid #e2e8f0" } });
  };

  return (
    <div className="space-y-5 w-full h-full overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-100 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">Next Plan</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-slate-900 placeholder-slate-400 w-44" />
          </div>
          <button onClick={openAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800 shadow-md">
            <Plus className="w-4 h-4" /> Add Record
          </button>
        </div>
      </div>

      <div className="min-h-[420px] space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-800 bg-slate-200 border-b border-slate-300 uppercase font-black tracking-wider whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 border-r border-slate-300 w-48">Vendor</th>
                  <th className="px-4 py-3 border-r border-slate-300 w-32">Images</th>
                  <th className="px-4 py-3 border-r border-slate-300">Fabric</th>
                  <th className="px-4 py-3 border-r border-slate-300 w-24 text-center">Quantity</th>
                  <th className="px-4 py-3 border-r border-slate-300 w-24 text-center">Price</th>
                  <th className="px-4 py-3 border-r border-slate-300 w-24 text-center">Size</th>
                  <th className="px-4 py-3 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"/> Loading…
                    </div>
                  </td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-sm font-medium text-slate-500 bg-slate-50">No plan records found. Click "Add Record" to create one.</td></tr>
                ) : records.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-slate-700">
                    <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-900 whitespace-pre-line">{r.vendor || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100">
                      {r.images && r.images.length > 0 ? (
                        <img src={r.images[0]} alt="product" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                          <ImageIcon className="w-6 h-6 text-slate-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 border-r border-slate-100">{r.fabric || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100 text-center font-bold text-slate-900">{r.quantity || "0"}</td>
                    <td className="px-4 py-3 border-r border-slate-100 text-center">{r.price ? `₹${r.price}` : "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100 text-center">{r.size || "—"}</td>
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

      {isAddOpen && (
        <div className="fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-md p-4 md:p-6 flex items-center justify-center">
          <div className="w-full max-w-3xl bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden transform transition-all">
            <div className="flex items-center justify-between px-8 py-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-blue-100/50">
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">{editingId ? "Edit Plan Record" : "Add Plan Record"}</h2>
              <button onClick={() => { setIsAddOpen(false); toast.error("Record cancelled successfully!"); }}
                className="h-10 w-10 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 grid place-items-center text-slate-500 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Vendor <span className="text-red-500">*</span></label>
                  <input type="text" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-inner"
                    placeholder="Enter Vendor name" />
                </div>
                {[["Fabric","fabric","text","e.g. DEMIN"],["Quantity","quantity","number","e.g. 64"],["Price","price","number","e.g. 160"],["Size","size","text","e.g. FREE"]].map(([label,key,type,ph]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">{label}</label>
                    <input type={type} min={type==="number"?"0":undefined}
                      onKeyDown={type==="number"?(e)=>{if(e.key==="-")e.preventDefault()}:undefined}
                      value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all shadow-inner"
                      placeholder={ph} />
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Product Images</h3>
                  <button onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                    <Upload className="w-3.5 h-3.5" /> Add Photo
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                </div>
                {(!form.images || form.images.length === 0) ? (
                  <div onClick={() => fileRef.current?.click()}
                    className="cursor-pointer flex flex-col items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                    <ImageIcon className="w-6 h-6 text-slate-300" />
                    <span className="text-xs text-slate-400 font-semibold">Click to upload photos</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {form.images.map((imgSrc, idx) => (
                      <div key={idx} className="relative group">
                        <img src={imgSrc} alt="uploaded" className="w-20 h-20 object-cover rounded-xl border border-slate-200 shadow-sm" />
                        <button onClick={() => removePhoto(idx)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 rounded-b-[2rem]">
              <button onClick={() => { setIsAddOpen(false); toast.error("Record cancelled successfully!"); }}
                className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-100 hover:text-slate-900 transition-all shadow-sm">Cancel</button>
              <button onClick={saveRecord} disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-bold hover:bg-blue-800 transition-all shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50">
                <Plus className="w-4 h-4" /> {saving ? "Saving…" : "Save Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}