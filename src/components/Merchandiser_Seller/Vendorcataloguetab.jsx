import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import DocumentConversation from "../DocumentConversation.jsx";


// import React, { useState, useEffect, useCallback } from "react";
// import { Image as ImageIcon, Plus, X, Trash2, MessageSquare, RefreshCw, Tag, Images, Send } from "lucide-react";
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
//                   <button onClick={() => setShareItem(item)} disabled={!item.active} title={item.active ? "Share with approved retailers" : "Reactivate this listing before sharing"} className="flex-1 h-7 text-[10px] font-bold rounded border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 flex items-center justify-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"><Send className="w-3 h-3" /> Share</button>
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

//       {shareItem && <ShareCatalogueItemModal item={shareItem} onClose={() => setShareItem(null)} />}
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
//   const [conversationInquiry, setConversationInquiry] = useState(null);

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
import { CheckCircle2, CircleHelp, Image as ImageIcon, Plus, Sparkles, X, Trash2, MessageSquare, RefreshCw, Tag, Images, Send } from "lucide-react";
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

const LISTING_ESSENTIALS = [
  { key: "photo", label: "Product photo", ready: (item) => Array.isArray(item.images) && item.images.length > 0 },
  { key: "category", label: "Category", ready: (item) => Boolean(String(item.category || "").trim()) },
  { key: "price", label: "Price", ready: (item) => Number(item.price_range_min) > 0 || Number(item.price_range_max) > 0 },
  { key: "moq", label: "Minimum order quantity", ready: (item) => Number(item.moq) > 0 },
  { key: "description", label: "Description", ready: (item) => String(item.description || "").trim().length >= 20 },
];

function ListingProgress({ item }) {
  const checks = LISTING_ESSENTIALS.map((entry) => ({ ...entry, done: entry.ready(item) }));
  const completed = checks.filter((entry) => entry.done).length;
  const nextStep = checks.find((entry) => !entry.done);
  const percent = Math.round((completed / checks.length) * 100);

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-indigo-700"><span>Retailer-ready listing</span><span>{completed}/{checks.length}</span></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${percent}%` }} /></div>
      {nextStep ? <p className="mt-1.5 text-[10px] leading-4 text-slate-500">Next: add {nextStep.label.toLowerCase()}.</p> : <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><CheckCircle2 className="h-3 w-3" />Ready to share with retailers</p>}
    </div>
  );
}
const emptyVariant = () => ({ label: "", sku: "", price: "", moq: "", stock: "" });

function VariantMatrix({ variants = [], onChange }) {
  const update = (index, field, value) => onChange(variants.map((variant, row) => row === index ? { ...variant, [field]: value } : variant));
  const remove = (index) => onChange(variants.filter((_, row) => row !== index));
  return (
    <section className="rounded-xl border border-violet-100 bg-violet-50/70 p-3">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-violet-950">Variant options <span className="font-normal text-violet-700">(optional)</span></p><p className="mt-0.5 text-[10px] leading-4 text-violet-700">Add a row for each colour, size, pack, or other sellable option.</p></div><button type="button" onClick={() => onChange([...variants, emptyVariant()])} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-violet-700"><Plus className="h-3 w-3" />Add option</button></div>
      {variants.length > 0 && <div className="mt-3 space-y-2">{variants.map((variant, index) => <div key={index} className="rounded-lg border border-violet-100 bg-white p-2"><div className="grid grid-cols-2 gap-2 sm:grid-cols-5"><input value={variant.label} onChange={(event) => update(index, "label", event.target.value)} placeholder="Red / M" className="h-8 rounded border border-slate-200 px-2 text-xs sm:col-span-2" /><input value={variant.sku} onChange={(event) => update(index, "sku", event.target.value)} placeholder="SKU" className="h-8 rounded border border-slate-200 px-2 text-xs" /><input type="number" min="0" value={variant.price} onChange={(event) => update(index, "price", event.target.value)} placeholder="Price" className="h-8 rounded border border-slate-200 px-2 text-xs" /><button type="button" onClick={() => remove(index)} className="grid h-8 place-items-center rounded border border-rose-200 text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button></div><div className="mt-2 grid grid-cols-2 gap-2"><input type="number" min="0" value={variant.moq} onChange={(event) => update(index, "moq", event.target.value)} placeholder="Variant MOQ" className="h-8 rounded border border-slate-200 px-2 text-xs" /><input type="number" min="0" value={variant.stock} onChange={(event) => update(index, "stock", event.target.value)} placeholder="Available stock" className="h-8 rounded border border-slate-200 px-2 text-xs" /></div></div>)}</div>}
    </section>
  );
}
const EMPTY_ITEM_FORM = {
  item_name: "", category: "", description: "",
  price_range_min: "", price_range_max: "",
  price: "", direct_purchase_enabled: false,
  available_sizes: "", available_colors: "", moq: "",
  variants: [], images: [],
};

function AddItemModal({ onClose, onAdded }) {
  const [form, setForm] = useState(EMPTY_ITEM_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assisting, setAssisting] = useState(false);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    setForm(f => ({ ...f, images: files }));
  };

const askCatalogueAssistant = async () => {
    if (!assistantPrompt.trim() && !form.item_name.trim()) {
      setError("Describe the product or add a product name before asking the assistant.");
      return;
    }
    setAssisting(true);
    setError(null);
    try {
      const res = await vendorFetch("/api/catalogue/my-catalogue/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: assistantPrompt, item_name: form.item_name, category: form.category, available_sizes: form.available_sizes, available_colors: form.available_colors }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || "Catalogue Assistant could not create a draft.");
      const draft = body.data || {};
      setForm((current) => ({
        ...current,
        item_name: draft.item_name || current.item_name,
        category: draft.category || current.category,
        description: draft.description || current.description,
        available_sizes: draft.available_sizes || current.available_sizes,
        available_colors: draft.available_colors || current.available_colors,
        moq: draft.moq || current.moq,
        variants: Array.isArray(draft.variants) && draft.variants.length ? draft.variants : current.variants,
      }));
    } catch (err) {
      setError(err.message || "Catalogue Assistant could not create a draft.");
    } finally {
      setAssisting(false);
    }
  };
  const handleSubmit = async () => {
    if (!form.item_name.trim()) { setError("Item name is required."); return; }
    if (form.images.length === 0) { setError("At least one image is required."); return; }
    if (form.direct_purchase_enabled && !(Number(form.price) > 0)) { setError("A firm price is required to enable direct purchase."); return; }
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("item_name", form.item_name);
      fd.append("category", form.category);
      fd.append("description", form.description);
      fd.append("price_range_min", form.price_range_min || 0);
      fd.append("price_range_max", form.price_range_max || 0);
      fd.append("price", form.price || 0);
      fd.append("direct_purchase_enabled", form.direct_purchase_enabled);
      fd.append("available_sizes", form.available_sizes);
      fd.append("available_colors", form.available_colors);
      fd.append("moq", form.moq || 0);
      fd.append("variants", JSON.stringify(form.variants.filter((variant) => variant.label.trim())));
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
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5">
            <p className="text-xs font-bold text-indigo-900">First item? Start with the essentials.</p>
            <p className="mt-1 text-[11px] leading-4 text-indigo-700">A clear name, photo, price, MOQ and short description help retailers find and inquire about your product.</p>
          </div>
          <div className="rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 p-3">
            <div className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" /><div><p className="text-xs font-bold text-violet-950">Catalogue Assistant</p><p className="mt-0.5 text-[10px] leading-4 text-violet-700">Describe the product in your own words. RMS will draft fields for you to review before saving.</p></div></div>
            <textarea rows={2} value={assistantPrompt} onChange={(event) => setAssistantPrompt(event.target.value)} placeholder="Example: Women's cotton kurti, floral print, sizes S to XL, navy and maroon, sold in packs of 6." className="mt-2 w-full resize-none rounded-lg border border-violet-100 bg-white px-2.5 py-2 text-xs outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
            <button type="button" onClick={askCatalogueAssistant} disabled={assisting} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-violet-700 disabled:opacity-60">{assisting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{assisting ? "Creating draft..." : "Create draft"}</button>
          </div>

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

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
            <label className="flex items-start gap-2 text-xs font-bold text-emerald-950">
              <input type="checkbox" checked={form.direct_purchase_enabled}
                onChange={e => setForm(f => ({ ...f, direct_purchase_enabled: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-400" />
              <span>Enable Direct Purchase <span className="font-normal text-emerald-700">— buyers can order this instantly, skipping inquiry/negotiation</span></span>
            </label>
            {form.direct_purchase_enabled && (
              <div className="mt-2.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Firm Price (₹) *</label>
                <input type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Fixed price buyers pay, no negotiation" />
              </div>
            )}
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

          <VariantMatrix variants={form.variants} onChange={(variants) => setForm((current) => ({ ...current, variants }))} />

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
    variants:         Array.isArray(item.variants) ? item.variants : [],
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
          variants:         form.variants.filter((variant) => variant.label.trim()),
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
          <VariantMatrix variants={form.variants} onChange={(variants) => setForm((current) => ({ ...current, variants }))} />
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

function ShareCatalogueItemModal({ item, onClose }) {
  const [retailers, setRetailers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { let cancelled = false; (async () => {
    try {
      const response = await vendorFetch("/api/vendors/my-tenant");
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not load retailers.");
      const approved = (data.data || []).filter((retailer) => retailer.status === "Approved");
      if (!cancelled) setRetailers(approved);
    } catch (err) { if (!cancelled) setError(err.message || "Could not load retailers."); }
    finally { if (!cancelled) setLoading(false); }
  })(); return () => { cancelled = true; }; }, []);

  const toggle = (tenantId) => setSelected((current) => { const next = new Set(current); next.has(tenantId) ? next.delete(tenantId) : next.add(tenantId); return next; });
  const share = async () => {
    if (!selected.size) { setError("Select at least one approved retailer."); return; }
    setSaving(true); setError("");
    try {
      const response = await vendorFetch(`/api/catalogue/my-catalogue/${item._id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenant_ids: [...selected] }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || "Could not share this item.");
      setSuccess(data.message || "Item shared with selected retailers.");
    } catch (err) { setError(err.message || "Could not share this item."); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[1200] flex items-end bg-slate-950/45 sm:items-center sm:justify-center sm:p-5"><div className="w-full max-w-lg rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"><div className="flex items-start justify-between border-b border-slate-100 p-5"><div><p className="text-xs font-black uppercase tracking-wider text-indigo-600">Share catalogue item</p><h2 className="mt-1 text-lg font-black text-slate-900">{item.item_name}</h2><p className="mt-1 text-xs leading-5 text-slate-500">Only selected retailers that already approved your account will receive it.</p></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="p-5">{error && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}{success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-black text-emerald-800">{success}</p><p className="mt-1 text-xs leading-5 text-emerald-700">Buyers can open Quick Order, choose variants and quantity, then request your confirmed quote.</p><button type="button" onClick={onClose} className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white">Done</button></div> : loading ? <div className="py-10 text-center"><RefreshCw className="mx-auto h-5 w-5 animate-spin text-indigo-500" /><p className="mt-2 text-xs text-slate-500">Loading approved retailers…</p></div> : retailers.length === 0 ? <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">You do not have an approved retailer yet. A retailer must approve your vendor account before you can share catalogue items.</div> : <><div className="max-h-64 space-y-2 overflow-y-auto">{retailers.map((retailer) => <label key={retailer.tenant_id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:border-indigo-200 hover:bg-indigo-50/40"><input type="checkbox" checked={selected.has(retailer.tenant_id)} onChange={() => toggle(retailer.tenant_id)} className="h-4 w-4 accent-indigo-600" /><span className="min-w-0"><span className="block text-sm font-bold text-slate-800">{retailer.company_name}</span><span className="text-[11px] text-slate-500">Approved vendor relationship</span></span></label>)}</div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600">Cancel</button><button type="button" disabled={saving || !selected.size} onClick={share} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Send className="h-3.5 w-3.5" />{saving ? "Sharing…" : `Share with ${selected.size || "…"}`}</button></div></>}</div></div></div>;
}
function CataloguePanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [sub, setSub] = useState(null);
  const [manageItem, setManageItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [error, setError] = useState(null);
  const [shareItem, setShareItem] = useState(null);

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

      <section className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-cyan-50 p-4">
        <div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm"><CircleHelp className="h-4 w-4" /></span><div><h2 className="text-sm font-black text-slate-900">Create a retailer-ready catalogue</h2><p className="mt-1 text-xs leading-5 text-slate-600">Add the basics first, then improve your listing anytime from Edit and Images.</p></div></div>
        <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-3"><p><span className="font-black text-indigo-600">1.</span> Add a clear product name and photo.</p><p><span className="font-black text-indigo-600">2.</span> Set price, MOQ and description.</p><p><span className="font-black text-indigo-600">3.</span> Add sizes and colours if applicable.</p></div>
        <p className="mt-3 border-t border-indigo-100 pt-3 text-[11px] leading-5 text-slate-500"><strong className="text-slate-700">Need detailed SKU or variant stock?</strong> Use Product List for operational product data; keep My Catalogue focused on what retailers should discover and inquire about.</p>
      </section>

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
                <ListingProgress item={item} />
                {Array.isArray(item.variants) && item.variants.length > 0 && <p className="text-[10px] font-semibold text-violet-700">{item.variants.length} variant{item.variants.length !== 1 ? "s" : ""} available</p>}
                <div className="flex gap-1.5 pt-1">
                  <button onClick={() => setEditItem(item)}
                    className="flex-1 h-7 text-[10px] font-bold rounded border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center gap-1">
                    <Tag className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => setShareItem(item)} disabled={!item.active} title={item.active ? "Share with approved retailers" : "Reactivate this listing before sharing"} className="flex-1 h-7 text-[10px] font-bold rounded border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 flex items-center justify-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"><Send className="w-3 h-3" /> Share</button>
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

      {shareItem && <ShareCatalogueItemModal item={shareItem} onClose={() => setShareItem(null)} />}
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
  const [conversationInquiry, setConversationInquiry] = useState(null);

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

          <div className="px-4 pb-3">
            <button onClick={() => setConversationInquiry(inq)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-bold text-indigo-700 hover:bg-indigo-100"><MessageSquare className="h-3.5 w-3.5" />Message buyer</button>
          </div>
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
      {conversationInquiry && <DocumentConversation documentType="rfq" documentId={conversationInquiry._id} actor="vendor" title={conversationInquiry.item_name || "RFQ (Request for Quotation) conversation"} onClose={() => setConversationInquiry(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// BULK IMPORT — CSV/Excel of products with hosted image links, so a vendor
// with an existing photo library elsewhere doesn't have to upload items one
// at a time. Every row becomes direct_purchase_enabled with a firm price
// (see POST /my-catalogue/bulk docstring for why) — this is specifically
// the path that lets buyers order instantly instead of negotiating first.
// ══════════════════════════════════════════════════════════════════════════
const CATALOGUE_CSV_ALIASES = {
  item_name:   ["item_name", "name", "product_name", "title"],
  sku:         ["sku", "product_sku", "style_code"],
  image_key:   ["image_key", "image_filename", "photo_key"],
  category:    ["category"],
  description: ["description", "desc"],
  price:       ["price", "firm_price", "amount"],
  moq:         ["moq", "minimum_order_quantity", "min_qty"],
  image_url:   ["image_url", "image_urls", "image", "images", "photo_url", "link"],
  available_sizes:  ["available_sizes", "sizes"],
  available_colors: ["available_colors", "colors", "colours"],
};

function splitCatalogueCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function normalizeCatalogueRow(raw) {
  const row = {};
  for (const [key, aliases] of Object.entries(CATALOGUE_CSV_ALIASES)) {
    for (const alias of aliases) {
      if (raw[alias]) { row[key] = String(raw[alias]).trim(); break; }
    }
  }
  return row;
}

function parseCatalogueCsv(text) {
  const lines = text.split(/\r\n|\n|\r/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCatalogueCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const cells = splitCatalogueCsvLine(line);
    const raw = {};
    headers.forEach((h, i) => { raw[h] = cells[i] || ""; });
    return normalizeCatalogueRow(raw);
  }).filter((row) => row.item_name || row.image_url);
}

async function parseCatalogueXlsx(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return sheetRows.map((sheetRow) => {
    const raw = {};
    Object.entries(sheetRow).forEach(([header, value]) => {
      raw[String(header).toLowerCase().trim().replace(/\s+/g, "_")] = String(value ?? "").trim();
    });
    return normalizeCatalogueRow(raw);
  }).filter((row) => row.item_name || row.image_url);
}

function BulkImportPanel() {
  const [rawText, setRawText] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [imageArchive, setImageArchive] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  const handleText = (text) => {
    setRawText(text);
    setParsedRows(parseCatalogueCsv(text));
    setError("");
  };

  const handleFile = async (file) => {
    setError("");
    const isExcel = /\.xlsx?$/i.test(file.name) || file.type.includes("spreadsheet") || file.type.includes("excel");
    if (isExcel) {
      setRawText("");
      try {
        setParsedRows(await parseCatalogueXlsx(file));
      } catch {
        setError("Could not read that Excel file. Make sure it's a valid .xlsx/.xls workbook.");
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = () => handleText(String(reader.result || ""));
    reader.readAsText(file);
  };

  const submit = async () => {
    if (!parsedRows.length) { setError("No valid rows to import. Each row needs at least an item name and price."); return; }
    setSubmitting(true); setError("");
    try {
      const hasLocalMedia = imageFiles.length > 0 || Boolean(imageArchive);
      const requestOptions = hasLocalMedia
        ? (() => {
            const body = new FormData();
            body.append("rows_json", JSON.stringify(parsedRows));
            imageFiles.forEach((file) => body.append("images", file));
            if (imageArchive) body.append("archive", imageArchive);
            return { method: "POST", body };
          })()
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: parsedRows }) };
      const res = await vendorFetch(hasLocalMedia ? "/api/catalogue/my-catalogue/bulk-upload" : "/api/catalogue/my-catalogue/bulk", requestOptions);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Bulk import failed.");
      setResults(json);
    } catch (err) {
      setError(err.message || "Bulk import failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const startOver = () => { setResults(null); setRawText(""); setParsedRows([]); setImageFiles([]); setImageArchive(null); setError(""); };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-sm font-black text-slate-900">Bulk Import Products</h2>
        <p className="mt-1 text-xs text-slate-500">Add many products at once using hosted image links instead of uploading files one at a time. Every item created here lets buyers order it instantly — no inquiry needed.</p>
      </div>

      {!results ? (
        <>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            <p className="font-bold text-slate-700">Expected columns (header row required):</p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">item_name, sku or image_key, price, image_url (optional), category, moq, description, available_sizes, available_colors</p>
            <p className="mt-2"><strong>item_name</strong> and <strong>price</strong> are required. Use <strong>image_url</strong>, or upload local images named as the row SKU/image_key (for example <code>SKU-001.jpg</code>).</p>
          </div>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">Upload CSV or Excel file</span>
            <input type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
              className="mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-indigo-700 hover:file:bg-indigo-100" />
          </label>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
            <p className="text-sm font-black text-emerald-950">Add local product images <span className="font-normal text-emerald-700">(optional instead of image_url)</span></p>
            <p className="mt-1 text-[11px] leading-5 text-emerald-800">Choose images from a folder or one ZIP. RMS matches filenames to <strong>image_key</strong>, <strong>SKU</strong>, or product name: <code>SKU-001.jpg</code>, <code>SKU-001-2.jpg</code>.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="text-xs font-bold text-slate-700">Images / image folder</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple webkitdirectory="" directory="" onChange={(event) => setImageFiles(Array.from(event.target.files || []))} className="mt-1.5 block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-emerald-800" />{imageFiles.length > 0 && <p className="mt-1 text-[11px] font-bold text-emerald-700">{imageFiles.length} image(s) selected</p>}</label>
              <label className="block"><span className="text-xs font-bold text-slate-700">Or one image ZIP</span><input type="file" accept=".zip,application/zip" onChange={(event) => setImageArchive(event.target.files?.[0] || null)} className="mt-1.5 block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-emerald-800" />{imageArchive && <p className="mt-1 truncate text-[11px] font-bold text-emerald-700">{imageArchive.name}</p>}</label>
            </div>
            <p className="mt-2 text-[10px] text-emerald-700">Your plan limit is checked before saving: Free 5 products / 1 photo each; Standard 10 / 3; Premium 25 / unlimited.</p>
          </div>
          <div className="text-center text-xs font-bold text-slate-400">— or paste CSV text —</div>

          <textarea value={rawText} onChange={(e) => handleText(e.target.value)} rows={5}
            placeholder="item_name,price,image_url,category,moq"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />

          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">⚠️ {error}</div>}

          {parsedRows.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left font-bold uppercase text-slate-500">
                  <tr>{["Item", "Price", "Image URL(s)", "Category", "MOQ"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r, i) => (
                    <tr key={i} className={!r.item_name || !r.price ? "bg-red-50" : ""}>
                      <td className="px-3 py-1.5">{r.item_name || "—"}</td>
                      <td className="px-3 py-1.5">{r.price || "—"}</td>
                      <td className="max-w-[220px] truncate px-3 py-1.5">{r.image_url || "—"}</td>
                      <td className="px-3 py-1.5">{r.category || "—"}</td>
                      <td className="px-3 py-1.5">{r.moq || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={submit} disabled={submitting || !parsedRows.length}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-600/15 transition hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? "Importing…" : `Import ${parsedRows.length} product${parsedRows.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{results.message}</div>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-left font-bold uppercase text-slate-500">
                <tr>{["Item", "Status", "Reason"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.results.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5">{r.item_name}</td>
                    <td className="px-3 py-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.status === "created" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-500">{r.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button onClick={startOver} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-600/15 transition hover:bg-indigo-700">Import more</button>
          </div>
        </>
      )}
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
          {[["catalogue", "Catalogue"], ["bulk", "Bulk Import"], ["inquiries", "Inquiries"], ["subscription", "Subscription"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${tab === id ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "catalogue" ? <CataloguePanel /> : tab === "bulk" ? <BulkImportPanel /> : tab === "inquiries" ? <InquiriesPanel /> : <VendorSubscriptionTab />}
      </div>
    </div>
  );
}
