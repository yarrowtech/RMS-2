import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
// import React, { useState } from "react";
// import { Plus, Edit, Trash2, ShoppingCart, Search, X } from "lucide-react";
// import toast from "react-hot-toast";

// const makeId = () => `ORD-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// export default function Mbuyer1OrderDetail() {
//   const [orders, setOrders] = useState([]);
//   const [search, setSearch] = useState("");
//   const [isAddOpen, setIsAddOpen] = useState(false);
//   const [editingId, setEditingId] = useState(null);

//   const [form, setForm] = useState({
//     item: "",
//     amount: "",
//     size: "",
//     quantity: "",
//     colour: "",
//     fabric: ""
//   });

//   const filteredOrders = orders.filter(o => 
//     [o.item, o.colour, o.fabric].join(" ").toLowerCase().includes(search.toLowerCase())
//   );

//   const openAdd = () => {
//     setEditingId(null);
//     setForm({
//       item: "",
//       amount: "",
//       size: "",
//       quantity: "",
//       colour: "",
//       fabric: ""
//     });
//     setIsAddOpen(true);
//   };

//   const openEdit = (order) => {
//     setEditingId(order.id);
//     setForm(order);
//     setIsAddOpen(true);
//   };

//   const handleSave = () => {
//     if (editingId) {
//       setOrders(orders.map(o => o.id === editingId ? { ...o, ...form } : o));
//       toast.success("Order details updated successfully!");
//     } else {
//       setOrders([{ id: makeId(), ...form }, ...orders]);
//       toast.success("New order added successfully!");
//     }
//     setIsAddOpen(false);
//   };

//   const handleDelete = (id) => {
//     toast((t) => (
//       <div className="flex flex-col gap-3 p-1">
//         <span className="font-bold text-black text-base">Are you sure you want to delete this order?</span>
//         <div className="flex gap-2 justify-end mt-2">
//           <button 
//             onClick={() => toast.dismiss(t.id)} 
//             className="px-4 py-2 text-sm font-bold text-black bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
//           >
//             Cancel
//           </button>
//           <button 
//             onClick={() => { 
//               setOrders((prev) => prev.filter((o) => o.id !== id));
//               toast.dismiss(t.id);
//               toast.success("Order deleted successfully!");
//             }} 
//             className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700"
//           >
//             Delete
//           </button>
//         </div>
//       </div>
//     ), { duration: Infinity, style: { background: "#ffffff", color: "#000000", border: "1px solid #e2e8f0" } });
//   };

//   return (
//     <div className="space-y-5 w-full h-full overflow-y-auto p-4 sm:p-6">
      
//       {/* Header Card (HR Style) */}
//       <div className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-100 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
//         <div>
//           <h2 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">
//             Order Details
//           </h2>
//         </div>
//         <div className="flex items-center gap-3">
//           <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
//             <Search className="w-4 h-4 text-slate-400" />
//             <input
//               type="text"
//               placeholder="Search..."
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               className="bg-transparent border-none outline-none text-sm text-slate-900 placeholder-slate-400 w-44"
//             />
//           </div>
//           <button 
//             onClick={openAdd}
//             className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800 shadow-md"
//           >
//             <Plus className="w-4 h-4" /> Add Order
//           </button>
//         </div>
//       </div>

//       {/* Main Content Card (HR Style) */}
//       <div className="min-h-[420px] space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        

//         {/* Order Table */}
//         <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
//           <div className="overflow-x-auto">
//             <table className="w-full text-sm text-left">
//               <thead className="text-xs text-slate-800 bg-slate-100 border-b border-slate-200 uppercase font-black tracking-wider">
//                 <tr>
//                   <th className="px-4 py-3 border-r border-slate-200 w-48">Item</th>
//                   <th className="px-4 py-3 border-r border-slate-200 w-32">Amount</th>
//                   <th className="px-4 py-3 border-r border-slate-200 w-24">Size</th>
//                   <th className="px-4 py-3 border-r border-slate-200 w-32">Quantity</th>
//                   <th className="px-4 py-3 border-r border-slate-200 w-32">Colour</th>
//                   <th className="px-4 py-3 border-r border-slate-200 w-48">Fabric</th>
//                   <th className="px-4 py-3 text-center w-24">Actions</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {filteredOrders.length === 0 ? (
//                   <tr>
//                     <td colSpan="7" className="px-6 py-10 text-center text-sm font-medium text-slate-500 bg-slate-50">
//                       No orders found. Click "Add Order" to create one.
//                     </td>
//                   </tr>
//                 ) : (
//                   filteredOrders.map((o) => (
//                     <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-slate-700">
//                       <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-900">{o.item || "-"}</td>
//                       <td className="px-4 py-3 border-r border-slate-100">{o.amount || "-"}</td>
//                       <td className="px-4 py-3 border-r border-slate-100">{o.size || "-"}</td>
//                       <td className="px-4 py-3 border-r border-slate-100">{o.quantity || "-"}</td>
//                       <td className="px-4 py-3 border-r border-slate-100">{o.colour || "-"}</td>
//                       <td className="px-4 py-3 border-r border-slate-100">{o.fabric || "-"}</td>
//                       <td className="px-4 py-3 text-center">
//                         <div className="flex items-center justify-center gap-2">
//                           <button 
//                             onClick={() => openEdit(o)}
//                             className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
//                             title="Edit"
//                           >
//                             <Edit className="w-4 h-4" />
//                           </button>
//                           <button 
//                             onClick={() => handleDelete(o.id)}
//                             className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"
//                             title="Delete"
//                           >
//                             <Trash2 className="w-4 h-4" />
//                           </button>
//                         </div>
//                       </td>
//                     </tr>
//                   ))
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </div>

//       </div>

//       {/* Add / Edit Modal (Premium Styling) */}
//       {isAddOpen && (
//         <div className="fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-md p-4 md:p-6 flex items-center justify-center">
//           <div className="w-full max-w-4xl bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden transform transition-all">
//             {/* MODAL HEADER */}
//             <div className="flex items-center justify-between px-8 py-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-blue-100/50">
//               <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">
//                 {editingId ? "Edit Order Details" : "Add New Order"}
//               </h2>
//               <button 
//                 onClick={() => { setIsAddOpen(false); toast.error("Order cancelled successfully!"); }}
//                 className="h-10 w-10 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 grid place-items-center text-slate-500 transition-all"
//               >
//                 <X className="w-5 h-5" />
//               </button>
//             </div>

//             {/* MODAL BODY */}
//             <div className="max-h-[55vh] overflow-y-auto p-6 md:p-8">
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                
//                 <div className="flex flex-col gap-1.5">
//                   <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Item</label>
//                   <input 
//                     type="text" 
//                     value={form.item}
//                     onChange={(e) => setForm({...form, item: e.target.value})}
//                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner" 
//                     placeholder="Enter item name"
//                   />
//                 </div>

//                 <div className="flex flex-col gap-1.5">
//                   <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Amount</label>
//                   <input 
//                     type="number" 
//                     min="0"
//                     onKeyDown={(e) => { if (e.key === '-') e.preventDefault(); }}
//                     value={form.amount}
//                     onChange={(e) => setForm({...form, amount: e.target.value})}
//                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner" 
//                     placeholder="e.g. 500"
//                   />
//                 </div>

//                 <div className="flex flex-col gap-1.5">
//                   <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Size</label>
//                   <input 
//                     type="text" 
//                     value={form.size}
//                     onChange={(e) => setForm({...form, size: e.target.value})}
//                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner" 
//                     placeholder="S, M, L, XL"
//                   />
//                 </div>

//                 <div className="flex flex-col gap-1.5">
//                   <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Quantity</label>
//                   <input 
//                     type="number" 
//                     min="0"
//                     onKeyDown={(e) => { if (e.key === '-') e.preventDefault(); }}
//                     value={form.quantity}
//                     onChange={(e) => setForm({...form, quantity: e.target.value})}
//                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner" 
//                     placeholder="0"
//                   />
//                 </div>

//                 <div className="flex flex-col gap-1.5">
//                   <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Colour</label>
//                   <input 
//                     type="text" 
//                     value={form.colour}
//                     onChange={(e) => setForm({...form, colour: e.target.value})}
//                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner" 
//                     placeholder="Red, Blue, etc."
//                   />
//                 </div>

//                 <div className="flex flex-col gap-1.5">
//                   <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Fabric</label>
//                   <input 
//                     type="text" 
//                     value={form.fabric}
//                     onChange={(e) => setForm({...form, fabric: e.target.value})}
//                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner" 
//                     placeholder="Cotton, Silk, etc."
//                   />
//                 </div>

//               </div>
//             </div>

//             {/* MODAL FOOTER */}
//             <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 rounded-b-[2rem]">
//               <button 
//                 onClick={() => { setIsAddOpen(false); toast.error("Order cancelled successfully!"); }}
//                 className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-100 hover:text-slate-900 transition-all shadow-sm"
//               >
//                 Cancel
//               </button>
//               <button 
//                 onClick={handleSave}
//                 className="px-8 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all"
//               >
//                 {editingId ? "Update Order" : "Save Order"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }



import React, { useEffect, useState, useCallback } from "react";
import { Plus, Edit, Trash2, Search, X } from "lucide-react";
import toast from "react-hot-toast";

const API = `${APP_API_URL}/mbuyer/order-details`;
const token = localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
const hdrs  = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const EMPTY = { item: "", amount: "", size: "", quantity: "", colour: "", fabric: "" };

export default function Mbuyer1OrderDetail() {
  const [orders,    setOrders]    = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState("");
  const [isOpen,    setIsOpen]    = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form,      setForm]      = useState(EMPTY);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}${search ? `?search=${encodeURIComponent(search)}` : ""}`, { headers: hdrs });
      const data = await res.json();
      setOrders(Array.isArray(data.data) ? data.data : []);
    } catch { toast.error("Failed to load orders"); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAdd = () => { setEditingId(null); setForm(EMPTY); setIsOpen(true); };
  const openEdit = (o) => { setEditingId(o.id); setForm({ item:o.item, amount:o.amount, size:o.size, quantity:o.quantity, colour:o.colour, fabric:o.fabric }); setIsOpen(true); };

  const handleSave = async () => {
    try {
      setSaving(true);
      const url    = editingId ? `${API}/${editingId}` : API;
      const method = editingId ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: hdrs, body: JSON.stringify(form) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      toast.success(editingId ? "Order updated!" : "Order added!");
      setIsOpen(false);
      await fetchAll();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (id) => {
    toast((t) => (
      <div className="flex flex-col gap-3 p-1">
        <span className="font-bold text-black text-base">Delete this order?</span>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-4 py-2 text-sm font-bold bg-gray-100 border border-gray-300 rounded-lg">Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            await fetch(`${API}/${id}`, { method: "DELETE", headers: hdrs });
            toast.success("Deleted!");
            fetchAll();
          }} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg">Delete</button>
        </div>
      </div>
    ), { duration: Infinity, style: { background:"#fff", border:"1px solid #e2e8f0" } });
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-5 w-full h-full overflow-y-auto p-4 sm:p-6">

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-100 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">Order Items</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm text-slate-900 placeholder-slate-400 w-44" />
          </div>
          <button onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800 shadow-md">
            <Plus className="w-4 h-4" /> Add Order
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="min-h-[420px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-800 bg-slate-100 border-b border-slate-200 uppercase font-black tracking-wider">
                <tr>
                  {["Item","Amount","Size","Quantity","Colour","Fabric","Actions"].map(h => (
                    <th key={h} className="px-4 py-3 border-r border-slate-200 last:border-r-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" /> Loading…
                    </div>
                  </td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500 bg-slate-50">
                    No orders found. Click "Add Order" to create one.
                  </td></tr>
                ) : orders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-slate-700">
                    <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-900">{o.item || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100">{o.amount || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100">{o.size || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100">{o.quantity || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100">{o.colour || "—"}</td>
                    <td className="px-4 py-3 border-r border-slate-100">{o.fabric || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(o)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(o.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
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
          <div className="w-full max-w-4xl bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden">
            <div className="flex items-center justify-between px-8 py-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-blue-100/50">
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">{editingId ? "Edit Order" : "Add New Order"}</h2>
              <button onClick={() => setIsOpen(false)} className="h-10 w-10 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-red-50 hover:text-red-600 grid place-items-center text-slate-500 transition-all"><X className="w-5 h-5" /></button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {[
                  ["Item",     "item",     "text",   "Enter item name"],
                  ["Amount",   "amount",   "number", "e.g. 500"],
                  ["Size",     "size",     "text",   "S, M, L, XL"],
                  ["Quantity", "quantity", "number", "0"],
                  ["Colour",   "colour",   "text",   "Red, Blue, etc."],
                  ["Fabric",   "fabric",   "text",   "Cotton, Silk, etc."],
                ].map(([label, key, type, ph]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">{label}</label>
                    <input type={type} min={type==="number"?"0":undefined}
                      onKeyDown={type==="number"?(e)=>{if(e.key==="-")e.preventDefault()}:undefined}
                      value={form[key]} onChange={f(key)} placeholder={ph}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all" />
                  </div>
                ))}
              </div>
            </div>
            <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 rounded-b-[2rem]">
              <button onClick={() => setIsOpen(false)} className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-100 transition-all">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-8 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50">
                {saving ? "Saving…" : editingId ? "Update Order" : "Save Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}