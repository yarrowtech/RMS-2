import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


import React, { useEffect, useMemo, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  FaWarehouse, FaHistory, FaSearch, FaPlus, FaSave, FaTrash, FaTimes,
  FaSync, FaArrowRight, FaBoxOpen, FaTruck, FaCheckCircle, FaClock,
  FaInbox,
} from "react-icons/fa";

const API = APP_API_URL;

const cn = (...a) => a.filter(Boolean).join(" ");
const cryptoId = () => `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;

const INP = "w-full bg-white rounded-lg px-3 py-2 text-sm text-slate-900 border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none placeholder:text-slate-400 transition";
const RO  = "bg-slate-100 cursor-not-allowed text-slate-600 border-slate-200 focus:ring-0";

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   Tabs: Stock View | Dispatch | Pending Receipts | History
   The old instant "Send to Store" / "Return to Central" actions are
   replaced by Dispatch (creates a Transfer Out, in transit) and
   Receive (confirms and actually adds stock at the destination).
══════════════════════════════════════════════════════════════════ */
export default function InventoryManagementStockAllocation() {
  const [activeTab, setActiveTab] = useState("central");

  const storeId   = localStorage.getItem("store_id")   || "";
  const storeName = localStorage.getItem("store_name") || "";
  const isHQ      = !storeId;

  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  const headers = { Authorization: `Bearer ${token}` };

  const [centralStock, setCentralStock] = useState([]);
  const [storeStock,   setStoreStock]   = useState([]);
  const [stores,       setStores]       = useState([]);
  const [history,      setHistory]      = useState([]);
  const [pending,      setPending]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [receivingId,  setReceivingId]  = useState(null);

  const [dispatchTo,    setDispatchTo]    = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const genInvoiceRef = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `DSP-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  };
  const [dispatchRef,   setDispatchRef]   = useState(genInvoiceRef());
 const [dispatchLines, setDispatchLines] = useState([
    { lineId: cryptoId(), barcode: "", product: "", available: 0, qty: "", rate: 0 },
  ]);

  const [search, setSearch] = useState("");
  const [histSearch, setHistSearch] = useState("");

  const fetchCentralStock = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/stock-allocation/central-stock`, { headers });
      const data = await res.json();
      setCentralStock(Array.isArray(data.data) ? data.data : []);
    } catch { toast.error("Failed to load central stock"); }
    finally { setLoading(false); }
  }, []);

  const fetchOwnStoreStock = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await fetch(`${API}/stock-allocation/store-stock/${storeId}`, { headers });
      const data = await res.json();
      setStoreStock(Array.isArray(data.data) ? data.data : []);
    } catch { toast.error("Failed to load store stock"); }
  }, [storeId]);

  const fetchStores = useCallback(async () => {
    try {
      const res = await fetch(`${API}/superadmin/stores/list`, { headers });
      const data = await res.json();
      setStores(Array.isArray(data.stores) ? data.stores : []);
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/stock-allocation/history${storeId ? `?store_id=${storeId}` : ""}`, { headers });
      const data = await res.json();
      setHistory(Array.isArray(data.data) ? data.data : []);
    } catch { toast.error("Failed to load history"); }
    finally { setLoading(false); }
  }, [storeId]);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const location = isHQ ? "central" : storeId;
      const res = await fetch(`${API}/stock-transfers/pending/${location}`, { headers });
      const data = await res.json();
      setPending(Array.isArray(data.data) ? data.data : []);
    } catch { toast.error("Failed to load pending receipts"); }
    finally { setLoading(false); }
  }, [isHQ, storeId]);

  useEffect(() => {
    fetchStores();
    if (isHQ) fetchCentralStock(); else fetchOwnStoreStock();
  }, []);

  useEffect(() => {
    if (activeTab === "history") fetchHistory();
    if (activeTab === "pending") fetchPending();
  }, [activeTab]);

  const sourceStock = isHQ ? centralStock : storeStock;
  const filteredStock = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sourceStock;
    return sourceStock.filter(
      (r) =>
        (r.barcode || "").toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        (r.sku || "").toLowerCase().includes(q)
    );
  }, [sourceStock, search]);

  const filteredHistory = useMemo(() => {
    const q = histSearch.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (r) =>
        (r.barcode || "").toLowerCase().includes(q) ||
        (r.from_store || "").toLowerCase().includes(q) ||
        (r.to_store || "").toLowerCase().includes(q) ||
        (r.refNo || "").toLowerCase().includes(q)
    );
  }, [history, histSearch]);

  // const fillDispatchLine = (lineId, barcode) => {
  //   const found = sourceStock.find((r) => r.barcode === barcode.trim());
  //   setDispatchLines((lines) =>
  //     lines.map((l) =>
  //       l.lineId !== lineId ? l : {
  //         ...l, barcode,
  //         product:   found ? (found.description || barcode) : l.product,
  //         available: found ? (found.available ?? found.stockQty ?? 0) : 0,
  //       }
  //     )
  //   );
  // };

  const fillDispatchLine = (lineId, barcode) => {
    const found = sourceStock.find((r) => r.barcode === barcode.trim());
    setDispatchLines((lines) =>
      lines.map((l) =>
        l.lineId !== lineId ? l : {
          ...l, barcode,
          product:   found ? (found.description || barcode) : l.product,
          available: found ? (found.available ?? found.stockQty ?? 0) : 0,
          rate:      found ? (found.rate || 0) : 0,   // ← pull rate from stock
        }
      )
    );
  };

 const addDispatchLine = () =>
    setDispatchLines((l) => [...l, { lineId: cryptoId(), barcode: "", product: "", available: 0, qty: "", rate: 0 }]);


  const removeDispatchLine = (lineId) => {
    if (dispatchLines.length <= 1) { toast.error("At least one item required"); return; }
    setDispatchLines((lines) => lines.filter((x) => x.lineId !== lineId));
  };

  const setDispatchQty = (lineId, qty) =>
    setDispatchLines((lines) => lines.map((x) => (x.lineId !== lineId ? x : { ...x, qty })));

  const handleDispatch = async () => {
    if (isHQ && !dispatchTo) { toast.error("Select a destination store."); return; }
    // invoiceNo is auto-generated by default — only blocked if user manually cleared it

    const items = dispatchLines
      .filter((l) => l.barcode.trim() && Number(l.qty) > 0)
      .map((l) => ({ barcode: l.barcode.trim(), product: l.product, qty: Number(l.qty), rate: Number(l.rate) || 0 }));
    if (!items.length) { toast.error("Add at least one item with quantity."); return; }

    const overQty = dispatchLines.find((l) => Number(l.qty) > Number(l.available));
    if (overQty) { toast.error(`Qty for ${overQty.barcode} exceeds available stock.`); return; }

    const payload = {
      from_store_id: isHQ ? null : storeId,
      to_store_id:   isHQ ? dispatchTo : null,
      invoiceNo:     dispatchRef.trim(),
      remarks:       dispatchNotes,
      lines:         items,
      createdBy:     localStorage.getItem("admin_name") || "Inventory",
    };

    try {
      setSaving(true);
      const res = await fetch(`${API}/stock-transfers/`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.error("Stock transfer response:", {
  status: res.status,
  detail: data.detail,
  data,
});
      if (!res.ok) throw new Error(data.detail || "Dispatch failed");

      toast.success(data.message || "Stock dispatched — awaiting receipt confirmation.");
      setDispatchLines([{ lineId: cryptoId(), barcode: "", product: "", available: 0, qty: "", rate: 0 }]);
      setDispatchTo(""); setDispatchNotes(""); setDispatchRef(genInvoiceRef());
      if (isHQ) await fetchCentralStock(); else await fetchOwnStoreStock();
    } catch (e) {
      toast.error(e.message || "Dispatch failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = async (transferId) => {
    try {
      setReceivingId(transferId);
      const res = await fetch(`${API}/stock-transfers/${transferId}/receive`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ receivedBy: localStorage.getItem("admin_name") || "Admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Receive failed");

      toast.success(data.message || "Receipt confirmed — stock added.");
      await fetchPending();
      if (isHQ) await fetchCentralStock(); else await fetchOwnStoreStock();
    } catch (e) {
      toast.error(e.message || "Receive failed");
    } finally {
      setReceivingId(null);
    }
  };

  const TABS = [
    { key: "central",  label: isHQ ? "Central Stock" : "My Store Stock", icon: <FaWarehouse /> },
    { key: "dispatch", label: isHQ ? "Dispatch to Store" : "Return to Central", icon: <FaArrowRight /> },
    { key: "pending",  label: "Pending Receipts", icon: <FaInbox />, badge: pending.length },
    { key: "history",  label: "History", icon: <FaHistory /> },
  ];

  return (
    <div className="min-h-full w-full px-3 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <FaBoxOpen className="text-indigo-600 text-2xl shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Stock Transfers</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isHQ
                ? "Dispatch stock to stores — they confirm receipt to complete the transfer"
                : `Manage stock movement for ${storeName || "your store"}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => { fetchStores(); isHQ ? fetchCentralStock() : fetchOwnStoreStock(); fetchPending(); }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition shadow-sm"
        >
          <FaSync size={12} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl shadow-inner w-max">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition",
              activeTab === tab.key ? "bg-white text-indigo-700 shadow border border-slate-200" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <span className="text-xs">{tab.icon}</span>
            {tab.label}
            {tab.badge > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "central" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Total SKUs", value: filteredStock.length, color: "indigo" },
              { label: "Total Units", value: filteredStock.reduce((s, r) => s + (r.stockQty || 0), 0), color: "slate" },
              { label: "Available Now", value: filteredStock.reduce((s, r) => s + (r.available ?? r.stockQty ?? 0), 0), color: "emerald" },
            ].map((c) => (
              <div key={c.label} className={cn("rounded-xl p-4 border",
                c.color === "indigo"  && "bg-indigo-50 border-indigo-200 text-indigo-700",
                c.color === "slate"   && "bg-slate-50 border-slate-200 text-slate-700",
                c.color === "emerald" && "bg-emerald-50 border-emerald-200 text-emerald-700"
              )}>
                <div className="text-xs font-bold uppercase tracking-wide opacity-70">{c.label}</div>
                <div className="mt-1 text-2xl font-black">{Number(c.value).toLocaleString("en-IN")}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-3 border border-slate-200 flex items-center gap-3">
            <FaSearch className="text-slate-400 shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by barcode, description, SKU..."
              className="flex-1 outline-none text-sm text-slate-800 placeholder:text-slate-400" />
            {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><FaTimes size={12} /></button>}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-auto max-h-[56vh]">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
                  <tr>
                    {["Barcode", "SKU", "Description", "Stock Qty", "Division"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={5} className="py-16 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /> Loading…
                      </div>
                    </td></tr>
                  ) : filteredStock.length === 0 ? (
                    <tr><td colSpan={5} className="py-16 text-center text-slate-400">No stock found.</td></tr>
                  ) : filteredStock.map((row) => (
                    <tr key={row.barcode} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{row.barcode}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{row.sku || "—"}</td>
                      <td className="px-3 py-2.5 text-sm font-medium text-slate-800">{row.description || row.barcode}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border",
                          (row.stockQty || 0) <= 0 ? "bg-rose-50 text-rose-700 border-rose-200" :
                          (row.stockQty || 0) <= 20 ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-emerald-50 text-emerald-700 border-emerald-200")}>
                          {row.stockQty || 0}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{row.division || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">{filteredStock.length} items shown</div>
          </div>
        </div>
      )}

      {activeTab === "dispatch" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
            <FaTruck className="text-indigo-500" />
            {isHQ ? "Dispatch Stock to Store / Branch" : "Return Stock to Central"}
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Stock is deducted immediately on dispatch. It only appears at the destination once they confirm receipt.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {isHQ && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Destination Store / Branch *</label>
                <select className={INP} value={dispatchTo} onChange={(e) => setDispatchTo(e.target.value)}>
                  <option value="">— Select store or branch —</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code}) — {s.type}{s.city ? `, ${s.city}` : ""}</option>
                  ))}
                </select>
              </div>
            )}
            {!isHQ && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Destination</label>
                <input className={cn(INP, RO)} value="Central Inventory" readOnly />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Invoice / Reference No <span className="text-slate-400 font-normal">(auto-generated, editable)</span>
              </label>
              <input className={INP} value={dispatchRef} onChange={(e) => setDispatchRef(e.target.value)} placeholder="Auto-generated" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Notes (optional)</label>
              <input className={INP} value={dispatchNotes} onChange={(e) => setDispatchNotes(e.target.value)} placeholder="e.g. Season stock dispatch" />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <span className="font-bold text-sm text-slate-800">Items to Dispatch</span>
              <button type="button" onClick={addDispatchLine}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition">
                <FaPlus size={10} /> Add Item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>{["Barcode", "Product", "Available", "Qty to Dispatch", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-bold text-slate-500">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {dispatchLines.map((l) => (
                    <tr key={l.lineId} className="hover:bg-slate-50">
                      <td className="px-2 py-1.5 w-44">
                        <input className={cn(INP, "font-mono text-xs")} value={l.barcode}
                          onChange={(e) => fillDispatchLine(l.lineId, e.target.value)} placeholder="Scan barcode" />
                      </td>
                      <td className="px-2 py-1.5 min-w-[180px]">
                        <input className={cn(INP, RO)} value={l.product} readOnly placeholder="Auto-filled" />
                      </td>
                      <td className="px-2 py-1.5 w-32">
                        <input className={cn(INP, RO, "text-center font-bold", l.available <= 0 ? "text-rose-600" : "text-emerald-700")} value={l.available} readOnly />
                      </td>
                      <td className="px-2 py-1.5 w-32">
                        <input type="number" min="0" max={l.available}
                          className={cn(INP, "bg-indigo-50 border-indigo-300 focus:border-indigo-500 text-center font-bold text-indigo-700")}
                          value={l.qty} onChange={(e) => setDispatchQty(l.lineId, e.target.value)} placeholder="0" />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button type="button" onClick={() => removeDispatchLine(l.lineId)}
                          className="h-8 w-8 rounded-lg bg-slate-800 text-white hover:bg-rose-600 flex items-center justify-center transition mx-auto">
                          <FaTrash size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Total items: <strong className="text-slate-800">{dispatchLines.filter((l) => l.barcode.trim() && Number(l.qty) > 0).length}</strong>
              {" "}· Total qty: <strong className="text-indigo-700">{dispatchLines.reduce((s, l) => s + (Number(l.qty) || 0), 0)}</strong>
            </div>
            <button type="button" onClick={handleDispatch} disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition shadow-sm disabled:opacity-50">
              {saving ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Dispatching…</>) : (<><FaSave size={13} /> Dispatch Stock</>)}
            </button>
          </div>
        </div>
      )}

      {activeTab === "pending" && (
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /> Loading…
            </div>
          ) : pending.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <FaCheckCircle className="text-emerald-400 text-3xl mx-auto mb-3" />
              <p className="text-sm text-slate-500">No pending receipts. Everything dispatched to {isHQ ? "Central" : "this store"} has been received.</p>
            </div>
          ) : (
            pending.map((tr) => (
              <div key={tr.id} className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <FaClock className="text-amber-600" />
                    <div>
                      <p className="text-sm font-bold text-amber-900">{tr.refNo}</p>
                      <p className="text-xs text-amber-600">From: {tr.fromWh || "Central"} · Dispatched {tr.date}</p>
                    </div>
                  </div>
                  <button onClick={() => handleReceive(tr.id)} disabled={receivingId === tr.id}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-50">
                    {receivingId === tr.id
                      ? (<><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Confirming…</>)
                      : (<><FaCheckCircle size={12} /> Confirm Receipt</>)}
                  </button>
                </div>
                <div className="p-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 uppercase font-bold">
                        <th className="text-left pb-2">Barcode</th>
                        <th className="text-left pb-2">Product</th>
                        <th className="text-right pb-2">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(tr.lines || []).map((l, i) => (
                        <tr key={i}>
                          <td className="py-1.5 font-mono text-slate-600">{l.barcode}</td>
                          <td className="py-1.5 text-slate-800">{l.product}</td>
                          <td className="py-1.5 text-right font-bold text-slate-700">{l.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-xs">
                    <span className="text-slate-400">Total {tr.lines?.length || 0} line(s)</span>
                    <span className="font-bold text-slate-700">Qty: {tr.totalQty}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm p-3 border border-slate-200 flex items-center gap-3">
            <FaSearch className="text-slate-400 shrink-0" />
            <input value={histSearch} onChange={(e) => setHistSearch(e.target.value)} placeholder="Search by barcode, store, ref no..."
              className="flex-1 outline-none text-sm text-slate-800 placeholder:text-slate-400" />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
                  <tr>{["Date", "Ref No", "Status", "Barcode", "Qty", "From", "To"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={7} className="py-16 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /> Loading…
                      </div>
                    </td></tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr><td colSpan={7} className="py-16 text-center text-slate-400">No transfer history yet.</td></tr>
                  ) : filteredHistory.map((row, i) => (
                    <tr key={`${row.id}-${i}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{row.created_at?.slice(0, 16) || "—"}</td>
                      <td className="px-3 py-2.5 text-xs font-bold text-slate-700">{row.refNo}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border",
                          row.status === "Received" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          row.status === "Dispatched" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-slate-50 text-slate-600 border-slate-200")}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{row.barcode}</td>
                      <td className="px-3 py-2.5 text-sm font-bold text-slate-800">{row.qty}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{row.from_store || "Central"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{row.to_store || "Central"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">{filteredHistory.length} records</div>
          </div>
        </div>
      )}
    </div>
  );
}