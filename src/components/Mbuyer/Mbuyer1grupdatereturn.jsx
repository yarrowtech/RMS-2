import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Edit, Trash2, Search, X, Upload, Image } from "lucide-react";
import toast from "react-hot-toast";

const API   = `${APP_API_URL}/mbuyer/gr-returns`;
const token = localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
const hdrs  = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const makeId = () => `SUR-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const emptyRecord = () => ({
  itemDescription: "", colour: "", pcs: "", size: "", qc: "", photos: [],
});

export default function Mbuyer1GRUpdateReturn() {
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form,      setForm]      = useState(emptyRecord());
  const photoRef = useRef(null);

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
  const openEdit = (r)  => { setEditingId(r.id); setForm({ ...r }); setIsAddOpen(true); };

  const handleSave = async () => {
    if (!form.itemDescription.trim()) { toast.error("Item description is required!"); return; }
    try {
      setSaving(true);
      const url    = editingId ? `${API}/${editingId}` : API;
      const method = editingId ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: hdrs, body: JSON.stringify(form) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      toast.success(editingId ? "Record updated successfully!" : "New record added successfully!");
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

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    Promise.all(files.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve({ id: makeId(), src: ev.target.result, name: file.name });
      reader.readAsDataURL(file);
    }))).then(uploaded => setForm(prev => ({ ...prev, photos: [...(prev.photos || []), ...uploaded] })));
  };

  const removePhoto = (id) => setForm(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== id) }));

  const filteredRecords = records; // search is server-side

  return (
    <div className="space-y-5 w-full h-full overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-100 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">Store Update & Return</h2>
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
                  <th className="px-4 py-3 border-r border-slate-300">Item Descriptions</th>
                  <th className="px-4 py-3 border-r border-slate-300 w-36">Colour</th>
                  <th className="px-4 py-3 border-r border-slate-300 w-20 text-center">PCS</th>
                  <th className="px-4 py-3 border-r border-slate-300 w-24 text-center">Size</th>
                  <th className="px-4 py-3 border-r border-slate-300 min-w-[200px]">Q.C</th>
                  <th className="px-4 py-3 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"/> Loading…
                    </div>
                  </td></tr>
                ) : filteredRecords.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-sm font-medium text-slate-500 bg-slate-50">No records found. Click "Add Record" to create one.</td></tr>
                ) : filteredRecords.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-slate-700">
                    <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-900">{r.itemDescription || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100 text-center">{r.colour || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100 text-center font-bold">{r.pcs || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100 text-center">{r.size || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100">{r.qc || "—"}</td>
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

        {records.some(r => r.photos && r.photos.length > 0) && (
          <div className="space-y-3 mt-6 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">All Return Photos</h3>
            <div className="flex flex-wrap gap-4">
              {records.flatMap(r => r.photos || []).map((p) => (
                <img key={p.id} src={p.src} alt={p.name} className="w-32 h-32 object-cover rounded-2xl border border-slate-200 shadow-sm" />
              ))}
            </div>
          </div>
        )}
      </div>

      {isAddOpen && (
        <div className="fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-md p-4 md:p-6 flex items-center justify-center">
          <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden">
            <div className="flex items-center justify-between px-8 py-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-blue-100/50">
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">{editingId ? "Edit Record" : "Add Record"}</h2>
              <button onClick={() => { setIsAddOpen(false); toast.error("Record cancelled successfully!"); }}
                className="h-10 w-10 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 grid place-items-center text-slate-500 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Item Description <span className="text-red-500">*</span></label>
                  <input type="text" value={form.itemDescription} onChange={(e) => setForm({ ...form, itemDescription: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner"
                    placeholder="e.g. CHIKAN PLAZZO" />
                </div>
                {[["Colour","colour","text","e.g. DIFFERENT COLOUR"],["PCS","pcs","number","e.g. 35"],["Size","size","text","e.g. FREE"]].map(([label,key,type,ph]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">{label}</label>
                    <input type={type} min={type==="number"?"0":undefined}
                      onKeyDown={type==="number"?(e)=>{if(e.key==="-")e.preventDefault()}:undefined}
                      value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner"
                      placeholder={ph} />
                  </div>
                ))}
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Q.C (Quality Check)</label>
                  <textarea value={form.qc} onChange={(e) => setForm({ ...form, qc: e.target.value })} rows={3}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner resize-none"
                    placeholder="e.g. QUALITY ISSUE, STITCHING IS NOT GOOD" />
                </div>
              </div>
              <div className="mt-6 border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Return Photos</h3>
                  <button onClick={() => photoRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                    <Upload className="w-3.5 h-3.5" /> Add Photo
                  </button>
                  <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                </div>
                {(!form.photos || form.photos.length === 0) ? (
                  <div onClick={() => photoRef.current?.click()}
                    className="cursor-pointer flex flex-col items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                    <Image className="w-6 h-6 text-slate-300" />
                    <span className="text-xs text-slate-400 font-semibold">Click to upload photos</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {form.photos.map((p) => (
                      <div key={p.id} className="relative group">
                        <img src={p.src} alt={p.name} className="w-20 h-20 object-cover rounded-xl border border-slate-200 shadow-sm" />
                        <button onClick={() => removePhoto(p.id)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <div onClick={() => photoRef.current?.click()}
                      className="cursor-pointer w-20 h-20 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                      <Plus className="w-5 h-5 text-slate-300" />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 rounded-b-[2rem]">
              <button onClick={() => { setIsAddOpen(false); toast.error("Record cancelled successfully!"); }}
                className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-100 hover:text-slate-900 transition-all shadow-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-8 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                {saving ? "Saving…" : editingId ? "Update Record" : "Save Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}