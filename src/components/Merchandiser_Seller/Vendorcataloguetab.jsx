import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


// import React, { useState, useEffect, useCallback } from "react";
// import { Image as ImageIcon, Plus, X, Trash2, MessageSquare, RefreshCw, Tag, Images } from "lucide-react";
// import VendorSubscriptionTab from "./VendorSubscriptionTab";

// const API_BASE = APP_API_URL;

// function getVendorToken() {
//   return (
//     localStorage.getItem("access_token") ||
//     localStorage.getItem("vendor_token") ||
//     localStorage.getItem("token") ||
//     ""
//   );
// }

// async function vendorFetch(path, options = {}) {
//   const token = getVendorToken();
//   return fetch(`${API_BASE}${path}`, {
//     ...options,
//     headers: {
//       ...(token ? { Authorization: `Bearer ${token}` } : {}),
//       ...(options.headers || {}),
//     },
//   });
// }

// const EMPTY_ITEM_FORM = {
//   item_name: "", category: "", description: "",
//   price_range_min: "", price_range_max: "",
//   available_sizes: "", available_colors: "", moq: "",
//   images: [],
// };

// function AddItemModal({ onClose, onAdded }) {
//   const [form, setForm] = useState(EMPTY_ITEM_FORM);
//   const [saving, setSaving] = useState(false);
//   const [error, setError] = useState(null);

//   const handleFiles = (e) => {
//     const files = Array.from(e.target.files || []);
//     setForm(f => ({ ...f, images: files }));
//   };

//   const handleSubmit = async () => {
//     if (!form.item_name.trim()) { setError("Item name is required."); return; }
//     if (form.images.length === 0) { setError("At least one image is required."); return; }
//     setSaving(true);
//     setError(null);
//     try {
//       const fd = new FormData();
//       fd.append("item_name", form.item_name);
//       fd.append("category", form.category);
//       fd.append("description", form.description);
//       fd.append("price_range_min", form.price_range_min || 0);
//       fd.append("price_range_max", form.price_range_max || 0);
//       fd.append("available_sizes", form.available_sizes);
//       fd.append("available_colors", form.available_colors);
//       fd.append("moq", form.moq || 0);
//       form.images.forEach(img => fd.append("images", img));

//       const res = await vendorFetch("/api/catalogue/my-catalogue", { method: "POST", body: fd });
//       if (!res.ok) {
//         const err = await res.json().catch(() => ({}));
//         throw new Error(err.detail || "Failed to add catalogue item.");
//       }
//       onAdded();
//       onClose();
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
//       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
//         <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
//           <h2 className="text-base font-bold text-slate-900">Add Catalogue Item</h2>
//           <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
//         </div>

//         <div className="p-5 space-y-4">
//           {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-3 py-2 rounded-lg">{error}</div>}

//           <div>
//             <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Item Name *</label>
//             <input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
//               className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
//               placeholder="e.g. Cotton Kurti — Floral Print" />
//           </div>

//           <div className="grid grid-cols-2 gap-3">
//             <div>
//               <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Category</label>
//               <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
//                 className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
//                 placeholder="Apparel" />
//             </div>
//             <div>
//               <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">MOQ</label>
//               <input type="number" min="0" value={form.moq} onChange={e => setForm(f => ({ ...f, moq: e.target.value }))}
//                 className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
//                 placeholder="Minimum order qty" />
//             </div>
//           </div>

//           <div className="grid grid-cols-2 gap-3">
//             <div>
//               <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Price From (₹)</label>
//               <input type="number" min="0" value={form.price_range_min} onChange={e => setForm(f => ({ ...f, price_range_min: e.target.value }))}
//                 className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
//             </div>
//             <div>
//               <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Price To (₹)</label>
//               <input type="number" min="0" value={form.price_range_max} onChange={e => setForm(f => ({ ...f, price_range_max: e.target.value }))}
//                 className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
//             </div>
//           </div>

//           <div>
//             <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Available Sizes</label>
//             <input value={form.available_sizes} onChange={e => setForm(f => ({ ...f, available_sizes: e.target.value }))}
//               className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
//               placeholder="S, M, L, XL (comma separated)" />
//           </div>

//           <div>
//             <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Available Colors</label>
//             <input value={form.available_colors} onChange={e => setForm(f => ({ ...f, available_colors: e.target.value }))}
//               className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
//               placeholder="Red, Navy, Black (comma separated)" />
//           </div>

//           <div>
//             <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Description</label>
//             <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
//               className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
//           </div>

//           <div>
//             <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Images *</label>
//             <input type="file" accept="image/*" multiple onChange={handleFiles}
//               className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-semibold file:text-xs hover:file:bg-indigo-100" />
//             {form.images.length > 0 && <p className="text-xs text-emerald-600 mt-1">{form.images.length} image(s) selected</p>}
//           </div>
//         </div>

//         <div className="px-5 py-4 border-t border-slate-100 flex gap-3 sticky bottom-0 bg-white">
//           <button onClick={onClose} className="flex-1 h-10 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
//           <button onClick={handleSubmit} disabled={saving}
//             className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold disabled:opacity-60">
//             {saving ? "Uploading…" : "Add Item"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ── Manage Images Modal ──
//    Fixes two gaps at once: (1) items with multiple images previously only
//    ever showed the first one, with a "+N" badge and no way to see the
//    rest; (2) images could only be changed by deleting and recreating the
//    whole item. This shows every image and lets the vendor add/remove
//    individually via the new backend routes. */
// function ManageImagesModal({ item, onClose, onUpdated }) {
//   const [images, setImages] = useState(item.images || []);
//   const [uploading, setUploading] = useState(false);
//   const [removingUrl, setRemovingUrl] = useState(null);
//   const [error, setError] = useState(null);

//   const handleAdd = async (e) => {
//     const files = Array.from(e.target.files || []);
//     if (files.length === 0) return;
//     setUploading(true);
//     setError(null);
//     try {
//       const fd = new FormData();
//       files.forEach(f => fd.append("images", f));
//       const res = await vendorFetch(`/api/catalogue/my-catalogue/${item._id}/images`, { method: "POST", body: fd });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Failed to add image(s).");
//       setImages(prev => [...prev, ...(data.added || [])]);
//       onUpdated();
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setUploading(false);
//       e.target.value = "";
//     }
//   };

//   const handleRemove = async (url) => {
//     setRemovingUrl(url);
//     setError(null);
//     try {
//       const res = await vendorFetch(`/api/catalogue/my-catalogue/${item._id}/images`, {
//         method: "DELETE",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ image_url: url }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Failed to remove image.");
//       setImages(prev => prev.filter(u => u !== url));
//       onUpdated();
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setRemovingUrl(null);
//     }
//   };

//   return (
//     <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
//       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
//         <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
//           <div>
//             <h2 className="text-base font-bold text-slate-900">Manage images</h2>
//             <p className="text-xs text-slate-500">{item.item_name}</p>
//           </div>
//           <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
//         </div>

//         <div className="flex-1 overflow-y-auto p-5">
//           {error && (
//             <div className="mb-3 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">⚠ {error}</div>
//           )}

//           {images.length === 0 ? (
//             <p className="text-center text-sm text-slate-400 py-8">No images left — add at least one below.</p>
//           ) : (
//             <div className="grid grid-cols-3 gap-2">
//               {images.map(url => (
//                 <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
//                   <img src={url} className="w-full h-full object-cover" />
//                   <button onClick={() => handleRemove(url)} disabled={removingUrl === url || images.length <= 1}
//                     title={images.length <= 1 ? "Can't remove the last image" : "Remove"}
//                     className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center disabled:opacity-30 disabled:hover:bg-black/60 transition">
//                     {removingUrl === url ? <RefreshCw className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
//                   </button>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>

//         <div className="px-5 py-4 border-t border-slate-100">
//           <label className="flex items-center justify-center gap-2 h-10 border-2 border-dashed border-slate-300 rounded-lg text-xs font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 cursor-pointer transition">
//             {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
//             {uploading ? "Uploading…" : "Add images"}
//             <input type="file" accept="image/*" multiple onChange={handleAdd} disabled={uploading} className="hidden" />
//           </label>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ── Edit Details Modal ──
//    Fixes: the backend's PATCH /my-catalogue/{id} already accepted
//    item_name, category, description, price range, sizes, colors, moq —
//    but nothing in the frontend ever sent those fields. Only "active" got
//    toggled. This is the missing edit form. */
// function EditDetailsModal({ item, onClose, onSaved }) {
//   const [form, setForm] = useState({
//     item_name:        item.item_name || "",
//     category:         item.category || "",
//     description:      item.description || "",
//     price_range_min:  item.price_range_min || "",
//     price_range_max:  item.price_range_max || "",
//     available_sizes:  (item.available_sizes || []).join(", "),
//     available_colors: (item.available_colors || []).join(", "),
//     moq:              item.moq || "",
//   });
//   const [saving, setSaving] = useState(false);
//   const [error, setError] = useState(null);

//   const handleSave = async () => {
//     if (!form.item_name.trim()) { setError("Item name is required."); return; }
//     setSaving(true);
//     setError(null);
//     try {
//       const res = await vendorFetch(`/api/catalogue/my-catalogue/${item._id}`, {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           item_name:        form.item_name.trim(),
//           category:         form.category.trim(),
//           description:      form.description.trim(),
//           price_range_min:  Number(form.price_range_min) || 0,
//           price_range_max:  Number(form.price_range_max) || 0,
//           available_sizes:  form.available_sizes.split(",").map(s => s.trim()).filter(Boolean),
//           available_colors: form.available_colors.split(",").map(c => c.trim()).filter(Boolean),
//           moq:              Number(form.moq) || 0,
//         }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.detail || "Failed to save.");
//       onSaved();
//       onClose();
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
//       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
//         <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
//           <h2 className="text-base font-bold text-slate-900">Edit item details</h2>
//           <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
//         </div>

//         <div className="flex-1 overflow-y-auto p-5 space-y-3">
//           {error && <div className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">⚠ {error}</div>}

//           <div>
//             <label className="text-xs font-bold text-slate-600 block mb-1">Item name *</label>
//             <input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
//               className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
//           </div>
//           <div>
//             <label className="text-xs font-bold text-slate-600 block mb-1">Category</label>
//             <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
//               className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
//           </div>
//           <div className="grid grid-cols-2 gap-2">
//             <div>
//               <label className="text-xs font-bold text-slate-600 block mb-1">Price from (₹)</label>
//               <input type="number" value={form.price_range_min} onChange={e => setForm(f => ({ ...f, price_range_min: e.target.value }))}
//                 className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
//             </div>
//             <div>
//               <label className="text-xs font-bold text-slate-600 block mb-1">Price to (₹)</label>
//               <input type="number" value={form.price_range_max} onChange={e => setForm(f => ({ ...f, price_range_max: e.target.value }))}
//                 className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
//             </div>
//           </div>
//           <div>
//             <label className="text-xs font-bold text-slate-600 block mb-1">Sizes (comma separated)</label>
//             <input value={form.available_sizes} onChange={e => setForm(f => ({ ...f, available_sizes: e.target.value }))}
//               placeholder="S, M, L, XL" className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
//           </div>
//           <div>
//             <label className="text-xs font-bold text-slate-600 block mb-1">Colors (comma separated)</label>
//             <input value={form.available_colors} onChange={e => setForm(f => ({ ...f, available_colors: e.target.value }))}
//               placeholder="Red, Navy, Black" className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
//           </div>
//           <div>
//             <label className="text-xs font-bold text-slate-600 block mb-1">MOQ</label>
//             <input type="number" value={form.moq} onChange={e => setForm(f => ({ ...f, moq: e.target.value }))}
//               className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
//           </div>
//           <div>
//             <label className="text-xs font-bold text-slate-600 block mb-1">Description</label>
//             <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
//               className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
//           </div>
//         </div>

//         <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
//           <button onClick={onClose} className="flex-1 h-10 border border-slate-200 rounded-lg text-sm font-bold text-slate-600">Cancel</button>
//           <button onClick={handleSave} disabled={saving}
//             className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold disabled:opacity-60">
//             {saving ? "Saving…" : "Save changes"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// function CataloguePanel() {
//   const [items, setItems] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [showAdd, setShowAdd] = useState(false);
//   const [sub, setSub] = useState(null);
//   const [manageItem, setManageItem] = useState(null);
//   const [editItem, setEditItem] = useState(null);

//   const fetchItems = useCallback(async () => {
//     setLoading(true);
//     try {
//       const [itemsRes, subRes] = await Promise.all([
//         vendorFetch("/api/catalogue/my-catalogue"),
//         vendorFetch("/api/subscriptions/me"),
//       ]);
//       const itemsJson = await itemsRes.json();
//       const subJson = await subRes.json();
//       setItems(itemsJson.data || []);
//       setSub(subJson.data || null);
//     } catch { /* noop */ }
//     finally { setLoading(false); }
//   }, []);

//   useEffect(() => { fetchItems(); }, [fetchItems]);

//   const handleDelete = async (id) => {
//     if (!window.confirm("Delete this catalogue item?")) return;
//     await vendorFetch(`/api/catalogue/my-catalogue/${id}`, { method: "DELETE" });
//     fetchItems();
//   };

//   const toggleActive = async (item) => {
//     await vendorFetch(`/api/catalogue/my-catalogue/${item._id}`, {
//       method: "PATCH",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ active: !item.active }),
//     });
//     fetchItems();
//   };

//   // Active items count against the tier limit — matches the backend's own
//   // count (active: true) in catalogue_routes.py's add_catalogue_item.
//   const activeCount = items.filter(i => i.active).length;
//   const atLimit = sub && activeCount >= sub.image_limit;

//   return (
//     <div className="space-y-4">
//       {sub && (
//         <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-4">
//           <div className="flex-1">
//             <div className="flex items-center justify-between mb-1">
//               <span className="text-xs font-bold text-slate-600">{sub.label} plan — catalogue items</span>
//               <span className={`text-xs font-bold ${atLimit ? "text-rose-600" : "text-slate-500"}`}>
//                 {activeCount} / {sub.image_limit}
//               </span>
//             </div>
//             <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
//               <div className={`h-full rounded-full ${atLimit ? "bg-rose-500" : "bg-indigo-500"}`}
//                 style={{ width: `${Math.min(100, (activeCount / Math.max(sub.image_limit, 1)) * 100)}%` }} />
//             </div>
//           </div>
//           {atLimit && (
//             <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded-full whitespace-nowrap">
//               Limit reached
//             </span>
//           )}
//         </div>
//       )}

//       <div className="flex items-center justify-between">
//         <p className="text-xs font-bold text-slate-500">{items.length} catalogue item{items.length !== 1 ? "s" : ""}</p>
//         <button onClick={() => setShowAdd(true)} disabled={atLimit}
//           title={atLimit ? `You've reached your ${sub?.label} plan's limit — upgrade to add more.` : undefined}
//           className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600">
//           <Plus className="w-3.5 h-3.5" /> {atLimit ? "Upgrade to add more" : "Add Item"}
//         </button>
//       </div>

//       {atLimit && (
//         <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
//           You've used all {sub.image_limit} catalogue slots on your {sub.label} plan. Delete an item, or
//           check the Subscription tab to upgrade for more.
//         </div>
//       )}

//       {loading ? (
//         <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
//       ) : items.length === 0 ? (
//         <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
//           <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
//           <p className="text-sm font-bold text-slate-600">No catalogue items yet</p>
//           <p className="text-xs text-slate-400 mt-1">Add your first item to start sharing your catalogue with retailers.</p>
//         </div>
//       ) : (
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//           {items.map(item => (
//             <div key={item._id} className={`rounded-2xl border overflow-hidden bg-white shadow-sm ${!item.active ? "opacity-50" : ""}`}>
//               <button onClick={() => setManageItem(item)} className="w-full aspect-square bg-slate-100 relative block">
//                 {item.images?.[0] && <img src={item.images[0]} alt={item.item_name} className="w-full h-full object-cover" />}
//                 {item.images?.length > 1 && (
//                   <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
//                     <Images className="w-2.5 h-2.5" /> {item.images.length}
//                   </span>
//                 )}
//               </button>
//               <div className="p-3 space-y-2">
//                 <p className="text-sm font-bold text-slate-900 truncate">{item.item_name}</p>
//                 {(item.price_range_min || item.price_range_max) && (
//                   <p className="text-xs text-emerald-600 font-bold">₹{item.price_range_min}–₹{item.price_range_max}</p>
//                 )}
//                 <div className="flex flex-wrap gap-1">
//                   {(item.available_sizes || []).slice(0, 4).map(s => (
//                     <span key={s} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">{s}</span>
//                   ))}
//                 </div>
//                 <div className="flex gap-1.5 pt-1">
//                   <button onClick={() => setEditItem(item)}
//                     className="flex-1 h-7 text-[10px] font-bold rounded border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center gap-1">
//                     <Tag className="w-3 h-3" /> Edit
//                   </button>
//                   <button onClick={() => setManageItem(item)}
//                     className="flex-1 h-7 text-[10px] font-bold rounded border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center gap-1">
//                     <Images className="w-3 h-3" /> Images
//                   </button>
//                   <button onClick={() => toggleActive(item)}
//                     className="flex-1 h-7 text-[10px] font-bold rounded border border-slate-200 hover:bg-slate-50 text-slate-600">
//                     {item.active ? "Hide" : "Show"}
//                   </button>
//                   <button onClick={() => handleDelete(item._id)}
//                     className="h-7 w-7 flex items-center justify-center rounded border border-rose-200 text-rose-500 hover:bg-rose-50">
//                     <Trash2 className="w-3.5 h-3.5" />
//                   </button>
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}

//       {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onAdded={fetchItems} />}
//       {manageItem && (
//         <ManageImagesModal
//           item={manageItem}
//           onClose={() => setManageItem(null)}
//           onUpdated={fetchItems}
//         />
//       )}
//       {editItem && (
//         <EditDetailsModal
//           item={editItem}
//           onClose={() => setEditItem(null)}
//           onSaved={fetchItems}
//         />
//       )}
//     </div>
//   );
// }

// function InquiriesPanel() {
//   const [inquiries, setInquiries] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [respondingId, setRespondingId] = useState(null);
//   const [respForm, setRespForm] = useState({});

//   const fetchInquiries = useCallback(async () => {
//     setLoading(true);
//     try {
//       const res = await vendorFetch("/api/catalogue/my-inquiries");
//       const json = await res.json();
//       setInquiries(json.data || []);
//     } catch { /* noop */ }
//     finally { setLoading(false); }
//   }, []);

//   useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

//   const openRespond = (inq) => {
//     setRespondingId(inq._id);
//     setRespError(null);
//     setRespForm({
//       confirmed_size: inq.requested_size, confirmed_color: inq.requested_color,
//       confirmed_qty: inq.requested_qty, confirmed_price: inq.requested_price,
//       available: true, vendor_note: "",
//     });
//   };

//   const [respError, setRespError] = useState(null);
//   const [responding, setResponding] = useState(false);

//   const submitResponse = async (id) => {
//     setResponding(true);
//     setRespError(null);
//     try {
//       const res = await vendorFetch(`/api/catalogue/inquiries/${id}/respond`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(respForm),
//       });
//       if (!res.ok) {
//         // ⚠️ FIX: this previously wasn't checked at all — a rejected
//         // response (e.g. price/qty of 0, now blocked server-side) closed
//         // the form and refreshed the list as if it had succeeded, with no
//         // indication anything went wrong.
//         const err = await res.json().catch(() => ({}));
//         throw new Error(err.detail || "Failed to send response.");
//       }
//       setRespondingId(null);
//       fetchInquiries();
//     } catch (err) {
//       setRespError(err.message);
//     } finally {
//       setResponding(false);
//     }
//   };

//   const statusStyle = {
//     Pending:   "bg-amber-100 text-amber-700",
//     Responded: "bg-emerald-100 text-emerald-700",
//     Declined:  "bg-rose-100 text-rose-700",
//     Converted: "bg-indigo-100 text-indigo-700",
//   };

//   return (
//     <div className="space-y-3">
//       {loading ? (
//         <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
//       ) : inquiries.length === 0 ? (
//         <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
//           <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
//           <p className="text-sm font-bold text-slate-600">No inquiries yet</p>
//           <p className="text-xs text-slate-400 mt-1">When a retailer asks about a catalogue item, it'll show up here.</p>
//         </div>
//       ) : inquiries.map(inq => (
//         <div key={inq._id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
//           <div className="px-4 py-3 flex items-center justify-between bg-slate-50 border-b border-slate-100">
//             <div className="flex items-center gap-2">
//               {inq.item_image && <img src={inq.item_image} className="w-8 h-8 rounded object-cover" />}
//               <div>
//                 <p className="text-xs font-bold text-slate-900">{inq.item_name}</p>
//                 <p className="text-[10px] text-slate-400">from {inq.tenant_name}</p>
//               </div>
//             </div>
//             <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyle[inq.status] || "bg-slate-100 text-slate-600"}`}>
//               {inq.status}
//             </span>
//           </div>
//           <div className="px-4 py-3 grid grid-cols-3 gap-2 text-xs">
//             <div><p className="text-slate-400">Size</p><p className="font-bold">{inq.requested_size || "—"}</p></div>
//             <div><p className="text-slate-400">Color</p><p className="font-bold">{inq.requested_color || "—"}</p></div>
//             <div><p className="text-slate-400">Qty</p><p className="font-bold">{inq.requested_qty || "—"}</p></div>
//           </div>
//           {inq.buyer_note && <p className="px-4 pb-3 text-xs text-slate-500 italic">"{inq.buyer_note}"</p>}

//           {inq.status === "Pending" && respondingId !== inq._id && (
//             <div className="px-4 pb-3">
//               <button onClick={() => openRespond(inq)}
//                 className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold">
//                 Respond
//               </button>
//             </div>
//           )}

//           {respondingId === inq._id && (
//             <div className="px-4 pb-4 pt-1 space-y-2 bg-indigo-50/50 border-t border-indigo-100">
//               <div className="grid grid-cols-3 gap-2">
//                 <input placeholder="Size" value={respForm.confirmed_size}
//                   onChange={e => setRespForm(f => ({ ...f, confirmed_size: e.target.value }))}
//                   className="h-8 px-2 border border-slate-200 rounded text-xs" />
//                 <input placeholder="Color" value={respForm.confirmed_color}
//                   onChange={e => setRespForm(f => ({ ...f, confirmed_color: e.target.value }))}
//                   className="h-8 px-2 border border-slate-200 rounded text-xs" />
//                 <input type="number" placeholder="Qty" value={respForm.confirmed_qty}
//                   onChange={e => setRespForm(f => ({ ...f, confirmed_qty: e.target.value }))}
//                   className="h-8 px-2 border border-slate-200 rounded text-xs" />
//               </div>
//               <input type="number" placeholder="Confirmed price (₹)" value={respForm.confirmed_price}
//                 onChange={e => setRespForm(f => ({ ...f, confirmed_price: e.target.value }))}
//                 className="w-full h-8 px-2 border border-slate-200 rounded text-xs" />
//               <textarea rows={2} placeholder="Note (optional)" value={respForm.vendor_note}
//                 onChange={e => setRespForm(f => ({ ...f, vendor_note: e.target.value }))}
//                 className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs resize-none" />
//               <div className="flex items-center gap-2">
//                 <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
//                   <input type="checkbox" checked={respForm.available}
//                     onChange={e => setRespForm(f => ({ ...f, available: e.target.checked }))} />
//                   Available
//                 </label>
//               </div>
//               {respError && (
//                 <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">
//                   ⚠ {respError}
//                 </p>
//               )}
//               <div className="flex gap-2">
//                 <button onClick={() => { setRespondingId(null); setRespError(null); }}
//                   className="flex-1 h-8 border border-slate-200 rounded text-xs font-bold text-slate-600">Cancel</button>
//                 <button onClick={() => submitResponse(inq._id)} disabled={responding}
//                   className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold disabled:opacity-60">
//                   {responding ? "Sending…" : "Send Response"}
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>
//       ))}
//     </div>
//   );
// }

// export default function VendorCatalogueTab() {
//   const [tab, setTab] = useState("catalogue");

//   return (
//     <div className="min-h-full bg-[#F6F7FB] p-4 sm:p-6">
//       <div className="max-w-5xl mx-auto space-y-5">
//         <div className="flex items-center gap-3">
//           <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
//             <Tag className="w-5 h-5 text-white" />
//           </div>
//           <div>
//             <h1 className="text-xl font-black text-slate-900">My Catalogue</h1>
//             <p className="text-xs text-slate-500">Share your products with retailers and manage their inquiries</p>
//           </div>
//         </div>

//         <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 w-fit">
//           {[["catalogue", "Catalogue"], ["inquiries", "Inquiries"], ["subscription", "Subscription"]].map(([id, label]) => (
//             <button key={id} onClick={() => setTab(id)}
//               className={`px-4 py-2 rounded-lg text-xs font-bold transition ${tab === id ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
//               {label}
//             </button>
//           ))}
//         </div>

//         {tab === "catalogue" ? <CataloguePanel /> : tab === "inquiries" ? <InquiriesPanel /> : <VendorSubscriptionTab />}
//       </div>
//     </div>
//   );
// }

import React, { useState, useEffect, useCallback } from "react";
import { Image as ImageIcon, Plus, X, Trash2, MessageSquare, RefreshCw, Tag, Images } from "lucide-react";
import VendorSubscriptionTab from "./Vendorsubscriptiontab.jsx";

const API_BASE = APP_API_URL;

function getVendorToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("vendor_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

async function vendorFetch(path, options = {}) {
  const token = getVendorToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

const EMPTY_ITEM_FORM = {
  item_name: "", category: "", description: "",
  price_range_min: "", price_range_max: "",
  available_sizes: "", available_colors: "", moq: "",
  images: [],
};

function AddItemModal({ onClose, onAdded }) {
  const [form, setForm] = useState(EMPTY_ITEM_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    setForm(f => ({ ...f, images: files }));
  };

  const handleSubmit = async () => {
    if (!form.item_name.trim()) { setError("Item name is required."); return; }
    if (form.images.length === 0) { setError("At least one image is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("item_name", form.item_name);
      fd.append("category", form.category);
      fd.append("description", form.description);
      fd.append("price_range_min", form.price_range_min || 0);
      fd.append("price_range_max", form.price_range_max || 0);
      fd.append("available_sizes", form.available_sizes);
      fd.append("available_colors", form.available_colors);
      fd.append("moq", form.moq || 0);
      form.images.forEach(img => fd.append("images", img));

      const res = await vendorFetch("/api/catalogue/my-catalogue", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to add catalogue item.");
      }
      onAdded();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-base font-bold text-slate-900">Add Catalogue Item</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-3 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Item Name *</label>
            <input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="e.g. Cotton Kurti — Floral Print" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Category</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Apparel" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">MOQ</label>
              <input type="number" min="0" value={form.moq} onChange={e => setForm(f => ({ ...f, moq: e.target.value }))}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Minimum order qty" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Price From (₹)</label>
              <input type="number" min="0" value={form.price_range_min} onChange={e => setForm(f => ({ ...f, price_range_min: e.target.value }))}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Price To (₹)</label>
              <input type="number" min="0" value={form.price_range_max} onChange={e => setForm(f => ({ ...f, price_range_max: e.target.value }))}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Available Sizes</label>
            <input value={form.available_sizes} onChange={e => setForm(f => ({ ...f, available_sizes: e.target.value }))}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="S, M, L, XL (comma separated)" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Available Colors</label>
            <input value={form.available_colors} onChange={e => setForm(f => ({ ...f, available_colors: e.target.value }))}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Red, Navy, Black (comma separated)" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Description</label>
            <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Images *</label>
            <input type="file" accept="image/*" multiple onChange={handleFiles}
              className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-semibold file:text-xs hover:file:bg-indigo-100" />
            {form.images.length > 0 && <p className="text-xs text-emerald-600 mt-1">{form.images.length} image(s) selected</p>}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 h-10 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold disabled:opacity-60">
            {saving ? "Uploading…" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Manage Images Modal ──
   Fixes two gaps at once: (1) items with multiple images previously only
   ever showed the first one, with a "+N" badge and no way to see the
   rest; (2) images could only be changed by deleting and recreating the
   whole item. This shows every image and lets the vendor add/remove
   individually via the new backend routes. */
function ManageImagesModal({ item, onClose, onUpdated }) {
  const [images, setImages] = useState(item.images || []);
  const [uploading, setUploading] = useState(false);
  const [removingUrl, setRemovingUrl] = useState(null);
  const [error, setError] = useState(null);

  const handleAdd = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append("images", f));
      const res = await vendorFetch(`/api/catalogue/my-catalogue/${item._id}/images`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to add image(s).");
      setImages(prev => [...prev, ...(data.added || [])]);
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemove = async (url) => {
    setRemovingUrl(url);
    setError(null);
    try {
      const res = await vendorFetch(`/api/catalogue/my-catalogue/${item._id}/images`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to remove image.");
      setImages(prev => prev.filter(u => u !== url));
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingUrl(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Manage images</h2>
            <p className="text-xs text-slate-500">{item.item_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-3 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">⚠ {error}</div>
          )}

          {images.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">No images left — add at least one below.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {images.map(url => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                  <img src={url} className="w-full h-full object-cover" />
                  <button onClick={() => handleRemove(url)} disabled={removingUrl === url || images.length <= 1}
                    title={images.length <= 1 ? "Can't remove the last image" : "Remove"}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center disabled:opacity-30 disabled:hover:bg-black/60 transition">
                    {removingUrl === url ? <RefreshCw className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100">
          <label className="flex items-center justify-center gap-2 h-10 border-2 border-dashed border-slate-300 rounded-lg text-xs font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 cursor-pointer transition">
            {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {uploading ? "Uploading…" : "Add images"}
            <input type="file" accept="image/*" multiple onChange={handleAdd} disabled={uploading} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
}

/* ── Edit Details Modal ──
   Fixes: the backend's PATCH /my-catalogue/{id} already accepted
   item_name, category, description, price range, sizes, colors, moq —
   but nothing in the frontend ever sent those fields. Only "active" got
   toggled. This is the missing edit form. */
function EditDetailsModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    item_name:        item.item_name || "",
    category:         item.category || "",
    description:      item.description || "",
    price_range_min:  item.price_range_min || "",
    price_range_max:  item.price_range_max || "",
    available_sizes:  (item.available_sizes || []).join(", "),
    available_colors: (item.available_colors || []).join(", "),
    moq:              item.moq || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!form.item_name.trim()) { setError("Item name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await vendorFetch(`/api/catalogue/my-catalogue/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name:        form.item_name.trim(),
          category:         form.category.trim(),
          description:      form.description.trim(),
          price_range_min:  Number(form.price_range_min) || 0,
          price_range_max:  Number(form.price_range_max) || 0,
          available_sizes:  form.available_sizes.split(",").map(s => s.trim()).filter(Boolean),
          available_colors: form.available_colors.split(",").map(c => c.trim()).filter(Boolean),
          moq:              Number(form.moq) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Edit item details</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && <div className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">⚠ {error}</div>}

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Item name *</label>
            <input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Category</label>
            <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Price from (₹)</label>
              <input type="number" value={form.price_range_min} onChange={e => setForm(f => ({ ...f, price_range_min: e.target.value }))}
                className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Price to (₹)</label>
              <input type="number" value={form.price_range_max} onChange={e => setForm(f => ({ ...f, price_range_max: e.target.value }))}
                className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Sizes (comma separated)</label>
            <input value={form.available_sizes} onChange={e => setForm(f => ({ ...f, available_sizes: e.target.value }))}
              placeholder="S, M, L, XL" className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Colors (comma separated)</label>
            <input value={form.available_colors} onChange={e => setForm(f => ({ ...f, available_colors: e.target.value }))}
              placeholder="Red, Navy, Black" className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">MOQ</label>
            <input type="number" value={form.moq} onChange={e => setForm(f => ({ ...f, moq: e.target.value }))}
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Description</label>
            <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 border border-slate-200 rounded-lg text-sm font-bold text-slate-600">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CataloguePanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [sub, setSub] = useState(null);
  const [manageItem, setManageItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [error, setError] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, subRes] = await Promise.all([
        vendorFetch("/api/catalogue/my-catalogue"),
        vendorFetch("/api/subscriptions/me"),
      ]);
      const itemsJson = await itemsRes.json();
      const subJson = await subRes.json();
      setItems(itemsJson.data || []);
      setSub(subJson.data || null);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this catalogue item?")) return;
    await vendorFetch(`/api/catalogue/my-catalogue/${id}`, { method: "DELETE" });
    fetchItems();
  };

  const toggleActive = async (item) => {
    setError(null);
    try {
      const res = await vendorFetch(`/api/catalogue/my-catalogue/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not update this item.");
    } catch (err) {
      setError(err.message);
    } finally {
      fetchItems();
    }
  };

  const daysUntil = (dateStr) => {
    if (!dateStr) return null;
    const diffMs = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  // Active items count against the tier limit — matches the backend's own
  // count (active: true) in catalogue_routes.py's add_catalogue_item.
  const activeCount = items.filter(i => i.active).length;
  const atLimit = sub && activeCount >= sub.image_limit;

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">⚠ {error}</div>
      )}

      {sub && (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-600">{sub.label} plan — catalogue items</span>
              <span className={`text-xs font-bold ${atLimit ? "text-rose-600" : "text-slate-500"}`}>
                {activeCount} / {sub.image_limit}
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${atLimit ? "bg-rose-500" : "bg-indigo-500"}`}
                style={{ width: `${Math.min(100, (activeCount / Math.max(sub.image_limit, 1)) * 100)}%` }} />
            </div>
          </div>
          {atLimit && (
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded-full whitespace-nowrap">
              Limit reached
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500">{items.length} catalogue item{items.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowAdd(true)} disabled={atLimit}
          title={atLimit ? `You've reached your ${sub?.label} plan's limit — upgrade to add more.` : undefined}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600">
          <Plus className="w-3.5 h-3.5" /> {atLimit ? "Upgrade to add more" : "Add Item"}
        </button>
      </div>

      {atLimit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          You've used all {sub.image_limit} catalogue slots on your {sub.label} plan. Delete an item, or
          check the Subscription tab to upgrade for more.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No catalogue items yet</p>
          <p className="text-xs text-slate-400 mt-1">Add your first item to start sharing your catalogue with retailers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div key={item._id} className={`rounded-2xl border overflow-hidden bg-white shadow-sm ${!item.active ? "opacity-50" : ""}`}>
              <button onClick={() => setManageItem(item)} className="w-full aspect-square bg-slate-100 relative block">
                {item.images?.[0] && <img src={item.images[0]} alt={item.item_name} className="w-full h-full object-cover" />}
                {item.images?.length > 1 && (
                  <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Images className="w-2.5 h-2.5" /> {item.images.length}
                  </span>
                )}
              </button>
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900 truncate">{item.item_name}</p>
                  {!item.active ? (
                    <span className="shrink-0 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">Expired</span>
                  ) : (() => {
                    const days = daysUntil(item.expires_at);
                    if (days === null) return null;
                    const dueSoon = days <= 7;
                    return (
                      <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap border ${dueSoon ? "text-amber-700 bg-amber-50 border-amber-200" : "text-slate-500 bg-slate-50 border-slate-200"}`}>
                        {days <= 0 ? "Expiring today" : `${days}d left`}
                      </span>
                    );
                  })()}
                </div>
                {(item.price_range_min || item.price_range_max) && (
                  <p className="text-xs text-emerald-600 font-bold">₹{item.price_range_min}–₹{item.price_range_max}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {(item.available_sizes || []).slice(0, 4).map(s => (
                    <span key={s} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">{s}</span>
                  ))}
                </div>
                <div className="flex gap-1.5 pt-1">
                  <button onClick={() => setEditItem(item)}
                    className="flex-1 h-7 text-[10px] font-bold rounded border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center gap-1">
                    <Tag className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => setManageItem(item)}
                    className="flex-1 h-7 text-[10px] font-bold rounded border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center gap-1">
                    <Images className="w-3 h-3" /> Images
                  </button>
                  <button onClick={() => toggleActive(item)}
                    className="flex-1 h-7 text-[10px] font-bold rounded border border-slate-200 hover:bg-slate-50 text-slate-600">
                    {item.active ? "Hide" : "Show"}
                  </button>
                  <button onClick={() => handleDelete(item._id)}
                    className="h-7 w-7 flex items-center justify-center rounded border border-rose-200 text-rose-500 hover:bg-rose-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onAdded={fetchItems} />}
      {manageItem && (
        <ManageImagesModal
          item={manageItem}
          onClose={() => setManageItem(null)}
          onUpdated={fetchItems}
        />
      )}
      {editItem && (
        <EditDetailsModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={fetchItems}
        />
      )}
    </div>
  );
}

function InquiriesPanel() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState(null);
  const [respForm, setRespForm] = useState({});

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await vendorFetch("/api/catalogue/my-inquiries");
      const json = await res.json();
      setInquiries(json.data || []);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  const openRespond = (inq) => {
    setRespondingId(inq._id);
    setRespError(null);
    setRespForm({
      confirmed_size: inq.requested_size, confirmed_color: inq.requested_color,
      confirmed_qty: inq.requested_qty, confirmed_price: inq.requested_price,
      available: true, vendor_note: "",
      discount_pct: 0, tax_pct: 0, freight: 0, other_charges: 0,
      payment_terms: "", credit_days: 0, lead_time_days: 0, delivery_date: "",
      sample_cost: 0, moq: 0, quote_valid_until: "",
    });
  };

  const [respError, setRespError] = useState(null);
  const [responding, setResponding] = useState(false);

  const submitResponse = async (id) => {
    setResponding(true);
    setRespError(null);
    try {
      const res = await vendorFetch(`/api/catalogue/inquiries/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(respForm),
      });
      if (!res.ok) {
        // ⚠️ FIX: this previously wasn't checked at all — a rejected
        // response (e.g. price/qty of 0, now blocked server-side) closed
        // the form and refreshed the list as if it had succeeded, with no
        // indication anything went wrong.
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to send response.");
      }
      setRespondingId(null);
      fetchInquiries();
    } catch (err) {
      setRespError(err.message);
    } finally {
      setResponding(false);
    }
  };

  const statusStyle = {
    Pending:   "bg-amber-100 text-amber-700",
    Responded: "bg-emerald-100 text-emerald-700",
    Countered: "bg-violet-100 text-violet-700",
    Declined:  "bg-rose-100 text-rose-700",
    Converted: "bg-indigo-100 text-indigo-700",
  };

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
      ) : inquiries.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No inquiries yet</p>
          <p className="text-xs text-slate-400 mt-1">When a retailer asks about a catalogue item, it'll show up here.</p>
        </div>
      ) : inquiries.map(inq => (
        <div key={inq._id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-2">
              {inq.item_image && <img src={inq.item_image} className="w-8 h-8 rounded object-cover" />}
              <div>
                <p className="text-xs font-bold text-slate-900">{inq.item_name}</p>
                <p className="text-[10px] text-slate-400">from {inq.tenant_name}</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyle[inq.status] || "bg-slate-100 text-slate-600"}`}>
              {inq.status}
            </span>
          </div>
          {/* ⚠️ NEW — vendor's OWN listed price/colors, from their
              catalogue item this inquiry was raised on. Previously only
              the buyer's requested price was visible here — the vendor
              had no reference point on this same screen to negotiate
              against, and had to switch to the Catalogue tab and
              remember their own price separately. */}
          {(inq.my_price_range_min || inq.my_price_range_max || inq.my_available_colors?.length > 0) && (
            <div className="px-4 pt-3 pb-1 flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Your listing:</span>
              {(inq.my_price_range_min || inq.my_price_range_max) && (
                <span className="text-xs font-bold text-indigo-600">
                  ₹{inq.my_price_range_min}–₹{inq.my_price_range_max}
                </span>
              )}
              {inq.my_available_colors?.length > 0 && (
                <span className="text-[10px] text-slate-500">
                  Colors: {inq.my_available_colors.join(", ")}
                </span>
              )}
            </div>
          )}
          <div className="px-4 py-3 grid grid-cols-3 gap-2 text-xs">
            <div><p className="text-slate-400">Size</p><p className="font-bold">{inq.requested_size || "—"}</p></div>
            <div><p className="text-slate-400">Color</p><p className="font-bold">{inq.requested_color || "—"}</p></div>
            <div><p className="text-slate-400">Qty</p><p className="font-bold">{inq.requested_qty || "—"}</p></div>
          </div>
          {inq.requested_price > 0 && (
            <p className="px-4 pb-2 text-xs">
              <span className="text-slate-400">Buyer asked: </span>
              <span className="font-bold text-amber-600">₹{inq.requested_price}</span>
            </p>
          )}
          {inq.buyer_note && <p className="px-4 pb-3 text-xs text-slate-500 italic">"{inq.buyer_note}"</p>}

          {inq.negotiation_history?.length > 0 && (
            <details className="mx-4 mb-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
              <summary className="cursor-pointer font-bold text-slate-600">Negotiation history ({inq.negotiation_history.length})</summary>
              <div className="mt-2 space-y-2">
                {inq.negotiation_history.map((event, index) => (
                  <div key={index} className={`rounded-md p-2 ${event.actor === "buyer" ? "bg-violet-50 text-violet-800" : "bg-white text-slate-700"}`}>
                    <p className="font-bold">{event.actor === "buyer" ? "Buyer counteroffer" : "Your quotation"}{event.price > 0 ? ` ? ?${event.price}` : ""}{event.quantity > 0 ? ` ? qty ${event.quantity}` : ""}</p>
                    {event.message && <p className="mt-0.5">{event.message}</p>}
                  </div>
                ))}
              </div>
            </details>
          )}

          {["Pending", "Countered", "Responded"].includes(inq.status) && respondingId !== inq._id && (
            <div className="px-4 pb-3">
              <button onClick={() => openRespond(inq)}
                className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold">
                {inq.status === "Pending" ? "Respond" : inq.status === "Countered" ? "Reply with revised quote" : "Revise quotation"}
              </button>
            </div>
          )}

          {respondingId === inq._id && (
            <div className="px-4 pb-4 pt-1 space-y-2 bg-indigo-50/50 border-t border-indigo-100">
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="Size" value={respForm.confirmed_size}
                  onChange={e => setRespForm(f => ({ ...f, confirmed_size: e.target.value }))}
                  className="h-8 px-2 border border-slate-200 rounded text-xs" />
                <input placeholder="Color" value={respForm.confirmed_color}
                  onChange={e => setRespForm(f => ({ ...f, confirmed_color: e.target.value }))}
                  className="h-8 px-2 border border-slate-200 rounded text-xs" />
                <input type="number" placeholder="Qty" value={respForm.confirmed_qty}
                  onChange={e => setRespForm(f => ({ ...f, confirmed_qty: e.target.value }))}
                  className="h-8 px-2 border border-slate-200 rounded text-xs" />
              </div>
              <input type="number" placeholder="Confirmed price (₹)" value={respForm.confirmed_price}
                onChange={e => setRespForm(f => ({ ...f, confirmed_price: e.target.value }))}
                className="w-full h-8 px-2 border border-slate-200 rounded text-xs" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <input type="number" min="0" max="100" placeholder="Discount %" value={respForm.discount_pct} onChange={e=>setRespForm(f=>({...f,discount_pct:e.target.value}))} className="h-8 px-2 border border-slate-200 rounded text-xs" />
                <input type="number" min="0" max="100" placeholder="Tax %" value={respForm.tax_pct} onChange={e=>setRespForm(f=>({...f,tax_pct:e.target.value}))} className="h-8 px-2 border border-slate-200 rounded text-xs" />
                <input type="number" min="0" placeholder="Freight ?" value={respForm.freight} onChange={e=>setRespForm(f=>({...f,freight:e.target.value}))} className="h-8 px-2 border border-slate-200 rounded text-xs" />
                <input type="number" min="0" placeholder="Other charges ?" value={respForm.other_charges} onChange={e=>setRespForm(f=>({...f,other_charges:e.target.value}))} className="h-8 px-2 border border-slate-200 rounded text-xs" />
                <input placeholder="Payment terms" value={respForm.payment_terms} onChange={e=>setRespForm(f=>({...f,payment_terms:e.target.value}))} className="h-8 px-2 border border-slate-200 rounded text-xs" />
                <input type="number" min="0" placeholder="Credit days" value={respForm.credit_days} onChange={e=>setRespForm(f=>({...f,credit_days:e.target.value}))} className="h-8 px-2 border border-slate-200 rounded text-xs" />
                <input type="number" min="0" placeholder="Lead time days" value={respForm.lead_time_days} onChange={e=>setRespForm(f=>({...f,lead_time_days:e.target.value}))} className="h-8 px-2 border border-slate-200 rounded text-xs" />
                <input type="number" min="0" placeholder="MOQ" value={respForm.moq} onChange={e=>setRespForm(f=>({...f,moq:e.target.value}))} className="h-8 px-2 border border-slate-200 rounded text-xs" />
                <label className="text-[10px] text-slate-500">Delivery date<input type="date" value={respForm.delivery_date} onChange={e=>setRespForm(f=>({...f,delivery_date:e.target.value}))} className="mt-0.5 h-8 w-full px-2 border border-slate-200 rounded text-xs" /></label>
                <label className="text-[10px] text-slate-500">Quote valid until<input type="date" value={respForm.quote_valid_until} onChange={e=>setRespForm(f=>({...f,quote_valid_until:e.target.value}))} className="mt-0.5 h-8 w-full px-2 border border-slate-200 rounded text-xs" /></label>
                <input type="number" min="0" placeholder="Sample cost ?" value={respForm.sample_cost} onChange={e=>setRespForm(f=>({...f,sample_cost:e.target.value}))} className="h-8 self-end px-2 border border-slate-200 rounded text-xs" />
              </div>
              <textarea rows={2} placeholder="Note (optional)" value={respForm.vendor_note}
                onChange={e => setRespForm(f => ({ ...f, vendor_note: e.target.value }))}
                className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs resize-none" />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <input type="checkbox" checked={respForm.available}
                    onChange={e => setRespForm(f => ({ ...f, available: e.target.checked }))} />
                  Available
                </label>
              </div>
              {respError && (
                <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">
                  ⚠ {respError}
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setRespondingId(null); setRespError(null); }}
                  className="flex-1 h-8 border border-slate-200 rounded text-xs font-bold text-slate-600">Cancel</button>
                <button onClick={() => submitResponse(inq._id)} disabled={responding}
                  className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold disabled:opacity-60">
                  {responding ? "Sending…" : "Send Response"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function VendorCatalogueTab() {
  const [tab, setTab] = useState("catalogue");

  return (
    <div className="min-h-full bg-[#F6F7FB] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">My Catalogue</h1>
            <p className="text-xs text-slate-500">Share your products with retailers and manage their inquiries</p>
          </div>
        </div>

        <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 w-fit">
          {[["catalogue", "Catalogue"], ["inquiries", "Inquiries"], ["subscription", "Subscription"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${tab === id ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "catalogue" ? <CataloguePanel /> : tab === "inquiries" ? <InquiriesPanel /> : <VendorSubscriptionTab />}
      </div>
    </div>
  );
}
